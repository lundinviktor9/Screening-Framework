/**
 * fetchDriveTimes.ts — Metric 21: Drive time to nearest major urban core
 *
 * Uses the TravelTime API (https://traveltime.com) to query road driving time
 * from each of the 76 market centroids to their nearest major UK city centres,
 * then writes metric 21 values (minutes) to an output JSON file.
 *
 * Requirements:
 *   TRAVELTIME_APP_ID  — env var (TravelTime application ID)
 *   TRAVELTIME_API_KEY — env var (TravelTime API key)
 *   Get credentials at: https://traveltime.com/
 *
 * Usage:
 *   npx tsx data-refresh/fetchDriveTimes.ts
 *   npx tsx data-refresh/fetchDriveTimes.ts --dry-run   # print plan, no API calls
 *
 * Output:
 *   data-refresh/output/drive-times-YYYY-MM-DD.json
 *
 * API used: POST /v4/time-filter
 *   https://docs.traveltime.com/api/reference/time-filter
 *
 *   Each request contains up to 10 departure searches (one per market).
 *   Each departure search queries up to NEAREST_CITIES_PER_MARKET city centres.
 *   The minimum returned travel_time (seconds) across all city centre candidates
 *   becomes the M21 value (converted to minutes).
 *
 * Rate limiting:
 *   The script batches 10 markets per API request and waits BATCH_DELAY_MS between
 *   requests. With 76 markets this is 8 requests total.
 *
 * Departure time:
 *   Tuesday at 10:00 UTC (post-rush-hour working day) — represents realistic
 *   daytime drive access, not peak congestion. Computed as the next Tuesday from now.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ── Configuration ────────────────────────────────────────────────────────────

const TRAVELTIME_APP_ID  = process.env['TRAVELTIME_APP_ID']  ?? '';
const TRAVELTIME_API_KEY = process.env['TRAVELTIME_API_KEY'] ?? '';
const TRAVELTIME_URL     = 'https://api.traveltimeapp.com/v4/time-filter';

/** Number of geographically nearest city centres to query per market */
const NEAREST_CITIES_PER_MARKET = 5;

/** Maximum travel time sent to the API (seconds). 2 hours covers all UK markets. */
const MAX_TRAVEL_TIME_SECS = 7200;

/** Delay between API batches in milliseconds (avoids rate limits) */
const BATCH_DELAY_MS = 1500;

/** Markets per API request (TravelTime max 10 departure searches per request) */
const BATCH_SIZE = 10;

const isDryRun = process.argv.includes('--dry-run');

// ── Types ────────────────────────────────────────────────────────────────────

interface Coords { lat: number; lng: number }
interface LocationDef { id: string; name: string; coords: Coords }

interface TravelTimeRequest {
  locations: Array<{ id: string; coords: Coords }>;
  departure_searches: Array<{
    id: string;
    departure_location_id: string;
    arrival_location_ids: string[];
    transportation: { type: string };
    departure_time: string;
    travel_time: number;
    properties: string[];
  }>;
}

interface TravelTimeResponse {
  results: Array<{
    search_id: string;
    locations: Array<{
      id: string;
      properties: Array<{ travel_time: number }>;
    }>;
    unreachable: string[];
  }>;
}

interface DriveTimeOutput {
  generatedAt: string;
  departureTime: string;
  markets: Record<string, {
    marketName: string;
    nearestCity: string | null;
    m21Minutes: number | null;
    candidatesQueried: string[];
  }>;
  warnings: string[];
  summary: { updated: number; nulled: number; totalWarnings: number };
}

// ── Market centroids ─────────────────────────────────────────────────────────
// Approximate geographic centre of the industrial market area.
// Values are manually researched from OS / Google Maps centroids.

const MARKET_CENTROIDS: Record<string, { name: string } & Coords> = {
  'uk-01': { name: 'Greater London',          lat: 51.5074, lng: -0.1278 },
  'uk-02': { name: 'Crawley',                 lat: 51.1099, lng: -0.1895 },
  'uk-03': { name: 'Reading',                 lat: 51.4543, lng: -0.9781 },
  'uk-04': { name: 'Maidstone',               lat: 51.2720, lng:  0.5299 },
  'uk-05': { name: 'South Hampshire',         lat: 50.9097, lng: -1.4044 },
  'uk-06': { name: 'Milton Keynes',           lat: 52.0406, lng: -0.7594 },
  'uk-07': { name: 'Slough',                  lat: 51.5105, lng: -0.5950 },
  'uk-08': { name: 'Hastings',                lat: 50.8543, lng:  0.5730 },
  'uk-09': { name: 'High Wycombe',            lat: 51.6288, lng: -0.7482 },
  'uk-10': { name: 'Basingstoke',             lat: 51.2667, lng: -1.0876 },
  'uk-11': { name: 'Brighton & Hove',         lat: 50.8225, lng: -0.1372 },
  'uk-12': { name: 'Medway Towns',            lat: 51.3840, lng:  0.5229 },
  'uk-13': { name: 'Eastbourne',              lat: 50.7684, lng:  0.2820 },
  'uk-14': { name: 'Farnborough/Aldershot',   lat: 51.2968, lng: -0.7542 },
  'uk-15': { name: 'Oxford',                  lat: 51.7520, lng: -1.2577 },
  'uk-16': { name: 'Thanet',                  lat: 51.3814, lng:  1.3895 },
  'uk-17': { name: 'Norwich',                 lat: 52.6309, lng:  1.2974 },
  'uk-18': { name: 'Chelmsford',              lat: 51.7361, lng:  0.4798 },
  'uk-19': { name: 'Peterborough',            lat: 52.5695, lng: -0.2405 },
  'uk-20': { name: 'Ipswich',                 lat: 52.0567, lng:  1.1482 },
  'uk-21': { name: 'Cambridge',               lat: 52.2053, lng:  0.1218 },
  'uk-22': { name: 'Colchester',              lat: 51.8959, lng:  0.8919 },
  'uk-23': { name: 'Bedford',                 lat: 52.1361, lng: -0.4667 },
  'uk-24': { name: 'Luton',                   lat: 51.8787, lng: -0.4200 },
  'uk-25': { name: 'Basildon',                lat: 51.5731, lng:  0.4906 },
  'uk-26': { name: 'Southend-on-Sea',         lat: 51.5461, lng:  0.7077 },
  'uk-27': { name: 'Birmingham/Solihull',     lat: 52.4862, lng: -1.8904 },
  'uk-28': { name: 'Black Country',           lat: 52.5070, lng: -2.0500 },
  'uk-29': { name: 'Coventry',                lat: 52.4068, lng: -1.5197 },
  'uk-30': { name: 'Telford',                 lat: 52.6766, lng: -2.4469 },
  'uk-31': { name: 'Leicester',               lat: 52.6369, lng: -1.1398 },
  'uk-32': { name: 'Northampton',             lat: 52.2405, lng: -0.9027 },
  'uk-33': { name: 'Derby',                   lat: 52.9226, lng: -1.4746 },
  'uk-34': { name: 'Nottingham',              lat: 52.9548, lng: -1.1581 },
  'uk-35': { name: 'Stoke-on-Trent',          lat: 53.0027, lng: -2.1794 },
  'uk-36': { name: 'Chesterfield',            lat: 53.2350, lng: -1.4209 },
  'uk-37': { name: 'Mansfield',               lat: 53.1476, lng: -1.1950 },
  'uk-38': { name: 'Lincoln',                 lat: 53.2307, lng: -0.5406 },
  'uk-39': { name: 'Burton-upon-Trent',       lat: 52.8019, lng: -1.6367 },
  'uk-40': { name: 'West Yorkshire (Leeds)',  lat: 53.7997, lng: -1.5492 },
  'uk-41': { name: 'Sheffield',               lat: 53.3811, lng: -1.4701 },
  'uk-42': { name: 'Grimsby',                 lat: 53.5674, lng: -0.0806 },
  'uk-43': { name: 'York',                    lat: 53.9590, lng: -1.0815 },
  'uk-44': { name: 'Barnsley/Dearne Valley',  lat: 53.5527, lng: -1.4797 },
  'uk-45': { name: 'Doncaster',               lat: 53.5228, lng: -1.1285 },
  'uk-46': { name: 'Kingston upon Hull',      lat: 53.7457, lng: -0.3367 },
  'uk-47': { name: 'Greater Manchester',      lat: 53.4808, lng: -2.2426 },
  'uk-48': { name: 'Liverpool',               lat: 53.4084, lng: -2.9916 },
  'uk-49': { name: 'Preston',                 lat: 53.7632, lng: -2.7031 },
  'uk-50': { name: 'Wigan',                   lat: 53.5453, lng: -2.6328 },
  'uk-51': { name: 'Burnley',                 lat: 53.7895, lng: -2.2374 },
  'uk-52': { name: 'Blackburn',               lat: 53.7481, lng: -2.4817 },
  'uk-53': { name: 'Warrington',              lat: 53.3900, lng: -2.5970 },
  'uk-54': { name: 'Accrington/Rossendale',   lat: 53.7534, lng: -2.3640 },
  'uk-55': { name: 'Blackpool',               lat: 53.8175, lng: -3.0357 },
  'uk-56': { name: 'Birkenhead',              lat: 53.3933, lng: -3.0146 },
  'uk-57': { name: 'Sunderland',              lat: 54.9069, lng: -1.3838 },
  'uk-58': { name: 'Tyneside',                lat: 54.9783, lng: -1.6178 },
  'uk-59': { name: 'Teesside',                lat: 54.5751, lng: -1.2348 },
  'uk-60': { name: 'Bristol',                 lat: 51.4545, lng: -2.5879 },
  'uk-61': { name: 'Cheltenham',              lat: 51.8994, lng: -2.0785 },
  'uk-62': { name: 'Bournemouth/Poole',       lat: 50.7192, lng: -1.8808 },
  'uk-63': { name: 'Gloucester',              lat: 51.8642, lng: -2.2382 },
  'uk-64': { name: 'Exeter',                  lat: 50.7184, lng: -3.5339 },
  'uk-65': { name: 'Plymouth',                lat: 50.3755, lng: -4.1427 },
  'uk-66': { name: 'Swindon',                 lat: 51.5580, lng: -1.7826 },
  'uk-67': { name: 'Torquay/Paignton',        lat: 50.4619, lng: -3.5253 },
  'uk-68': { name: 'Cardiff',                 lat: 51.4816, lng: -3.1791 },
  'uk-69': { name: 'Newport',                 lat: 51.5842, lng: -2.9977 },
  'uk-70': { name: 'Swansea',                 lat: 51.6214, lng: -3.9436 },
  'uk-71': { name: 'Greater Glasgow',         lat: 55.8642, lng: -4.2518 },
  'uk-72': { name: 'Motherwell',              lat: 55.7928, lng: -3.9954 },
  'uk-73': { name: 'Edinburgh',               lat: 55.9533, lng: -3.1883 },
  'uk-74': { name: 'Aberdeen',                lat: 57.1497, lng: -2.0943 },
  'uk-75': { name: 'Dundee',                  lat: 56.4620, lng: -2.9707 },
  'uk-76': { name: 'Belfast',                 lat: 54.5973, lng: -5.9301 },
};

// ── UK city centres ───────────────────────────────────────────────────────────
// Major urban cores used as potential destinations for M21.
// These are city/town centre coordinates, not market centroids.

const CITY_CENTRES: LocationDef[] = [
  { id: 'city-london',      name: 'London',       coords: { lat: 51.5074, lng: -0.1278 } },
  { id: 'city-birmingham',  name: 'Birmingham',   coords: { lat: 52.4862, lng: -1.8904 } },
  { id: 'city-manchester',  name: 'Manchester',   coords: { lat: 53.4808, lng: -2.2426 } },
  { id: 'city-leeds',       name: 'Leeds',        coords: { lat: 53.8008, lng: -1.5491 } },
  { id: 'city-sheffield',   name: 'Sheffield',    coords: { lat: 53.3811, lng: -1.4701 } },
  { id: 'city-bristol',     name: 'Bristol',      coords: { lat: 51.4545, lng: -2.5879 } },
  { id: 'city-liverpool',   name: 'Liverpool',    coords: { lat: 53.4084, lng: -2.9916 } },
  { id: 'city-newcastle',   name: 'Newcastle',    coords: { lat: 54.9783, lng: -1.6178 } },
  { id: 'city-edinburgh',   name: 'Edinburgh',    coords: { lat: 55.9533, lng: -3.1883 } },
  { id: 'city-glasgow',     name: 'Glasgow',      coords: { lat: 55.8642, lng: -4.2518 } },
  { id: 'city-cardiff',     name: 'Cardiff',      coords: { lat: 51.4816, lng: -3.1791 } },
  { id: 'city-nottingham',  name: 'Nottingham',   coords: { lat: 52.9548, lng: -1.1581 } },
  { id: 'city-leicester',   name: 'Leicester',    coords: { lat: 52.6369, lng: -1.1398 } },
  { id: 'city-coventry',    name: 'Coventry',     coords: { lat: 52.4068, lng: -1.5197 } },
  { id: 'city-brighton',    name: 'Brighton',     coords: { lat: 50.8225, lng: -0.1372 } },
  { id: 'city-southampton', name: 'Southampton',  coords: { lat: 50.9097, lng: -1.4044 } },
  { id: 'city-portsmouth',  name: 'Portsmouth',   coords: { lat: 50.8198, lng: -1.0880 } },
  { id: 'city-norwich',     name: 'Norwich',      coords: { lat: 52.6309, lng:  1.2974 } },
  { id: 'city-plymouth',    name: 'Plymouth',     coords: { lat: 50.3755, lng: -4.1427 } },
  { id: 'city-reading',     name: 'Reading',      coords: { lat: 51.4543, lng: -0.9781 } },
  { id: 'city-aberdeen',    name: 'Aberdeen',     coords: { lat: 57.1497, lng: -2.0943 } },
  { id: 'city-belfast',     name: 'Belfast',      coords: { lat: 54.5973, lng: -5.9301 } },
  { id: 'city-dundee',      name: 'Dundee',       coords: { lat: 56.4620, lng: -2.9707 } },
  { id: 'city-derby',       name: 'Derby',        coords: { lat: 52.9226, lng: -1.4746 } },
  { id: 'city-stoke',       name: 'Stoke',        coords: { lat: 53.0027, lng: -2.1794 } },
  { id: 'city-middlesbrough', name: 'Middlesbrough', coords: { lat: 54.5751, lng: -1.2348 } },
  { id: 'city-swansea',     name: 'Swansea',      coords: { lat: 51.6214, lng: -3.9436 } },
  { id: 'city-exeter',      name: 'Exeter',       coords: { lat: 50.7184, lng: -3.5339 } },
  { id: 'city-cambridge',   name: 'Cambridge',    coords: { lat: 52.2053, lng:  0.1218 } },
  { id: 'city-oxford',      name: 'Oxford',       coords: { lat: 51.7520, lng: -1.2577 } },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Return the next Tuesday at 10:00 UTC as an ISO 8601 string */
function nextTuesdayAt10UTC(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 2=Tue
  const daysUntilTuesday = ((2 - day + 7) % 7) || 7; // always a future Tuesday
  const tuesday = new Date(now);
  tuesday.setUTCDate(now.getUTCDate() + daysUntilTuesday);
  tuesday.setUTCHours(10, 0, 0, 0);
  return tuesday.toISOString().replace('.000Z', 'Z');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── TravelTime API call ───────────────────────────────────────────────────────

async function callTravelTimeFilter(body: TravelTimeRequest): Promise<TravelTimeResponse> {
  const res = await fetch(TRAVELTIME_URL, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'Accept':         'application/json',
      'X-Application-Id': TRAVELTIME_APP_ID,
      'X-Api-Key':        TRAVELTIME_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TravelTime API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<TravelTimeResponse>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('=== fetchDriveTimes — Metric 21 ===');

  // Validate credentials
  if (!isDryRun) {
    if (!TRAVELTIME_APP_ID || !TRAVELTIME_API_KEY) {
      console.error(
        'ERROR: Missing TravelTime credentials.\n' +
        '  Set TRAVELTIME_APP_ID and TRAVELTIME_API_KEY environment variables.\n' +
        '  Get credentials at https://traveltime.com/\n' +
        '  Run with --dry-run to preview the query plan without API calls.',
      );
      process.exit(1);
    }
    log(`App ID: ${TRAVELTIME_APP_ID.slice(0, 4)}**** (${TRAVELTIME_APP_ID.length} chars)`);
  } else {
    log('DRY RUN — no API calls will be made.');
  }

  const departureTime = nextTuesdayAt10UTC();
  log(`Departure time: ${departureTime} (next Tuesday 10:00 UTC)`);

  const marketIds = Object.keys(MARKET_CENTROIDS);
  log(`Markets: ${marketIds.length}`);
  log(`City centres: ${CITY_CENTRES.length}`);
  log(`Nearest cities per market: ${NEAREST_CITIES_PER_MARKET}`);
  log(`Batch size: ${BATCH_SIZE} markets/request → ${Math.ceil(marketIds.length / BATCH_SIZE)} API calls`);

  // ── Pre-compute nearest city centres per market (Haversine) ──────────────
  const nearestCities: Record<string, LocationDef[]> = {};

  for (const [marketId, centroid] of Object.entries(MARKET_CENTROIDS)) {
    const sorted = [...CITY_CENTRES].sort((a, b) =>
      haversineKm(centroid, a.coords) - haversineKm(centroid, b.coords),
    );
    nearestCities[marketId] = sorted.slice(0, NEAREST_CITIES_PER_MARKET);
  }

  if (isDryRun) {
    log('');
    log('Query plan (nearest city candidates per market):');
    for (const [id, cities] of Object.entries(nearestCities)) {
      const centroid = MARKET_CENTROIDS[id]!;
      log(
        `  ${id} ${centroid.name}: ` +
        cities.map(c => {
          const km = haversineKm(centroid, c.coords).toFixed(0);
          return `${c.name} (${km}km)`;
        }).join(', '),
      );
    }
    log('');
    log('Dry run complete — no API calls made.');
    return;
  }

  // ── Process in batches ────────────────────────────────────────────────────
  const warnings: string[] = [];
  const results: Record<string, { nearestCity: string | null; m21Minutes: number | null; candidates: string[] }> = {};

  const batches: string[][] = [];
  for (let i = 0; i < marketIds.length; i += BATCH_SIZE) {
    batches.push(marketIds.slice(i, i + BATCH_SIZE));
  }

  log(`Processing ${batches.length} batches…`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]!;
    log(`Batch ${batchIdx + 1}/${batches.length}: markets ${batch.join(', ')}`);

    // Collect unique location IDs needed for this batch
    const locationMap = new Map<string, Coords>();
    for (const marketId of batch) {
      const centroid = MARKET_CENTROIDS[marketId]!;
      locationMap.set(marketId, { lat: centroid.lat, lng: centroid.lng });
      for (const city of nearestCities[marketId]!) {
        locationMap.set(city.id, city.coords);
      }
    }

    const locations = Array.from(locationMap.entries()).map(([id, coords]) => ({ id, coords }));

    const departureSearches = batch.map(marketId => ({
      id: `search-${marketId}`,
      departure_location_id: marketId,
      arrival_location_ids: nearestCities[marketId]!.map(c => c.id),
      transportation: { type: 'driving' },
      departure_time: departureTime,
      travel_time: MAX_TRAVEL_TIME_SECS,
      properties: ['travel_time'],
    }));

    try {
      const response = await callTravelTimeFilter({ locations, departure_searches: departureSearches });

      for (const result of response.results) {
        const marketId = result.search_id.replace('search-', '');
        const candidates = nearestCities[marketId]!.map(c => c.name);

        if (result.locations.length === 0) {
          // All city centres unreachable within 2 hours
          warnings.push(`${marketId} (${MARKET_CENTROIDS[marketId]!.name}): all city centres unreachable within ${MAX_TRAVEL_TIME_SECS / 60} min.`);
          results[marketId] = { nearestCity: null, m21Minutes: null, candidates };
          continue;
        }

        // Find the minimum travel time across all returned city centre candidates
        let minSecs = Infinity;
        let nearestCityName = '';

        for (const loc of result.locations) {
          const secs = loc.properties[0]?.travel_time ?? Infinity;
          if (secs < minSecs) {
            minSecs = secs;
            const cityDef = CITY_CENTRES.find(c => c.id === loc.id);
            nearestCityName = cityDef?.name ?? loc.id;
          }
        }

        // Note cities in unreachable list
        if (result.unreachable.length > 0) {
          const names = result.unreachable
            .map(id => CITY_CENTRES.find(c => c.id === id)?.name ?? id)
            .join(', ');
          warnings.push(`${marketId}: ${result.unreachable.length} city/cities unreachable within 2h (${names}).`);
        }

        const minutes = minSecs === Infinity ? null : Math.round(minSecs / 60);
        results[marketId] = { nearestCity: nearestCityName || null, m21Minutes: minutes, candidates };
      }
    } catch (err) {
      const msg = `Batch ${batchIdx + 1} failed: ${(err as Error).message}`;
      warnings.push(msg);
      log(`ERROR: ${msg}`);
      for (const marketId of batch) {
        results[marketId] = { nearestCity: null, m21Minutes: null, candidates: [] };
      }
    }

    if (batchIdx < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ── Build output ──────────────────────────────────────────────────────────
  const markets: DriveTimeOutput['markets'] = {};
  let updated = 0;
  let nulled = 0;

  for (const marketId of marketIds) {
    const centroid = MARKET_CENTROIDS[marketId]!;
    const r = results[marketId];
    markets[marketId] = {
      marketName: centroid.name,
      nearestCity: r?.nearestCity ?? null,
      m21Minutes: r?.m21Minutes ?? null,
      candidatesQueried: r?.candidates ?? [],
    };
    if (r?.m21Minutes !== null && r?.m21Minutes !== undefined) updated++;
    else nulled++;
  }

  const output: DriveTimeOutput = {
    generatedAt: new Date().toISOString(),
    departureTime,
    markets,
    warnings,
    summary: { updated, nulled, totalWarnings: warnings.length },
  };

  // ── Write output file ─────────────────────────────────────────────────────
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const dateStr = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outputDir, `drive-times-${dateStr}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  log('');
  log('=== Complete ===');
  log(`Output: ${outputPath}`);
  log(`M21 updated: ${updated} markets`);
  log(`M21 null:    ${nulled} markets`);
  log(`Warnings:    ${warnings.length}`);
  if (warnings.length > 0) {
    log('');
    log('Warnings:');
    for (const w of warnings) log(`  ⚠ ${w}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
