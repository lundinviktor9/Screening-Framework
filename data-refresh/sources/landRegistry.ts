/**
 * HM Land Registry source — Metric 7: Land price growth (5-year CAGR)
 *
 * Dataset: HM Land Registry Price Paid Data (full bulk download)
 * URL pattern: http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-{YEAR}.csv
 * Coverage: England and Wales only. Scotland and NI → null.
 *
 * Derivation of M7 (industrial land price 5yr CAGR):
 *   The standard PPD includes property_type = "O" (Other), which covers commercial,
 *   industrial, and other non-residential transactions. This is the closest free proxy
 *   for industrial land price movements at LA level.
 *
 *   Steps:
 *   1. Download pp-{baseYear}.csv and pp-{endYear}.csv (streaming, not full in-memory).
 *   2. Filter to property_type = "O" (Other / commercial-industrial).
 *   3. For each LA, compute median transaction price in each year.
 *   4. CAGR = (endMedian / baseMedian)^(1/years) - 1
 *
 *   ⚠ Caveats:
 *   - "O" type includes ALL non-residential transactions (retail, office, industrial,
 *     land) — not industrial-only. It is a market-wide proxy, not a pure industrial metric.
 *   - Many commercial transactions are not registered with HMLR (e.g. company-to-company
 *     transfers, long leases). Coverage is higher for freehold transactions.
 *   - LAs with fewer than MIN_TRANSACTIONS in either year are returned as null.
 *   - The LA is identified via the "District" text column (column 13), which is matched
 *     to GSS codes via a lookup table. Unmatched districts are warned and skipped.
 *
 * CSV column layout (1-indexed, as per HMLR specification):
 *   1:  Transaction ID
 *   2:  Price (£)
 *   3:  Date of transfer (YYYY-MM-DD or YYYY-MM-DDThh:mm)
 *   4:  Postcode
 *   5:  Property type  (D=Detached, S=Semi, T=Terraced, F=Flat, O=Other)
 *   6:  Old/New  (Y=new build, N=established)
 *   7:  Duration (F=Freehold, L=Leasehold)
 *   8:  PAON
 *   9:  SAON
 *  10:  Street
 *  11:  Locality
 *  12:  Town/City
 *  13:  District (local authority name)
 *  14:  County
 *  15:  PPD category type (A=standard, B=additional)
 *  16:  Record status (A=Addition, C=Change, D=Delete)
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import * as os from 'os';

const HMLR_BASE =
  'http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com';

const MIN_TRANSACTIONS = 5; // minimum to trust a median estimate

export interface LandRegistryResult {
  /** LA code → 5yr CAGR (%) */
  m7: Record<string, number>;
  warnings: string[];
}

export async function fetchLandRegistryM7(
  log: (msg: string) => void,
  years = 5,
): Promise<LandRegistryResult> {
  const endYear = new Date().getFullYear() - 1; // last complete calendar year
  const baseYear = endYear - years;
  const warnings: string[] = [];

  log(`Land Registry: fetching "Other" transactions for ${baseYear} and ${endYear}…`);

  const [basePrices, endPrices] = await Promise.all([
    fetchYearPrices(baseYear, log),
    fetchYearPrices(endYear, log),
  ]);

  // ── Compute CAGR per district-name key, then map to GSS ──────────────────
  const m7: Record<string, number> = {};

  const allDistricts = new Set([...Object.keys(basePrices), ...Object.keys(endPrices)]);

  for (const district of allDistricts) {
    const base = basePrices[district];
    const end = endPrices[district];

    if (!base || base.count < MIN_TRANSACTIONS) {
      warnings.push(`M7: ${district} — insufficient base-year (${baseYear}) transactions (${base?.count ?? 0}). Skipped.`);
      continue;
    }
    if (!end || end.count < MIN_TRANSACTIONS) {
      warnings.push(`M7: ${district} — insufficient end-year (${endYear}) transactions (${end?.count ?? 0}). Skipped.`);
      continue;
    }

    const baseMedian = base.median;
    const endMedian = end.median;

    if (baseMedian <= 0) continue;

    const cagr = (Math.pow(endMedian / baseMedian, 1 / years) - 1) * 100;
    // Map district name → GSS code
    const gss = DISTRICT_TO_GSS[normaliseDistrictName(district)];
    if (!gss) {
      warnings.push(`M7: district "${district}" not mapped to a GSS code. Add to DISTRICT_TO_GSS lookup.`);
      continue;
    }
    m7[gss] = Math.round(cagr * 100) / 100;
  }

  log(`Land Registry: computed M7 for ${Object.keys(m7).length} LAs.`);
  return { m7, warnings };
}

// ── Per-year price fetcher ───────────────────────────────────────────────────

interface PriceSummary { count: number; median: number }

async function fetchYearPrices(
  year: number,
  log: (msg: string) => void,
): Promise<Record<string, PriceSummary>> {
  const url = `${HMLR_BASE}/pp-${year}.csv`;
  log(`Land Registry: downloading ${url}…`);

  const tmpFile = path.join(os.tmpdir(), `hmlr-pp-${year}-${Date.now()}.csv`);
  await downloadFile(url, tmpFile);
  log(`Land Registry: ${year} file downloaded, parsing…`);

  // Collect all prices per district
  const districtPrices: Record<string, number[]> = {};

  const rl = readline.createInterface({
    input: fs.createReadStream(tmpFile, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    // cols[4] = property type (0-indexed)
    if (cols[4] !== 'O') continue;
    // cols[15] = record status; skip deletions/changes (keep only Additions)
    if (cols[15] && cols[15] !== 'A') continue;

    const price = parseFloat(cols[1]);
    if (isNaN(price) || price <= 0) continue;

    const district = cols[12]; // District column
    if (!district) continue;

    if (!districtPrices[district]) districtPrices[district] = [];
    districtPrices[district].push(price);
  }

  fs.unlink(tmpFile, () => { /* ignore cleanup errors */ });

  // Compute medians
  const result: Record<string, PriceSummary> = {};
  for (const [dist, prices] of Object.entries(districtPrices)) {
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const med = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
    result[dist] = { count: prices.length, median: med };
  }

  log(`Land Registry: ${year} — ${Object.keys(result).length} districts with "Other" transactions.`);
  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normaliseDistrictName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const dest = fs.createWriteStream(destPath);
  await new Promise<void>((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location!, destPath).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HMLR download failed: HTTP ${res.statusCode} from ${url}`));
        return;
      }
      res.pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Mapping from normalised district names (as they appear in the HMLR PPD "District" column)
 * to ONS GSS codes. Extend this table if warnings appear for unmatched districts.
 *
 * Run the script once to discover district names present in the data, then add missing ones.
 */
export const DISTRICT_TO_GSS: Record<string, string> = {
  // London
  'cityoflondon': 'E09000001',
  'barkinganddagenham': 'E09000002',
  'barnet': 'E09000003',
  'bexley': 'E09000004',
  'brent': 'E09000005',
  'bromley': 'E09000006',
  'camden': 'E09000007',
  'croydon': 'E09000008',
  'ealing': 'E09000009',
  'enfield': 'E09000010',
  'greenwich': 'E09000011',
  'hackney': 'E09000012',
  'hammersmithandfulham': 'E09000013',
  'haringey': 'E09000014',
  'harrow': 'E09000015',
  'havering': 'E09000016',
  'hillingdon': 'E09000017',
  'hounslow': 'E09000018',
  'islington': 'E09000019',
  'kensingtonandchelsea': 'E09000020',
  'kingstonupongames': 'E09000021',
  'kingstononthames': 'E09000021',
  'lambeth': 'E09000022',
  'lewisham': 'E09000023',
  'merton': 'E09000024',
  'newham': 'E09000025',
  'redbridge': 'E09000026',
  'richmondupongames': 'E09000027',
  'richmondthames': 'E09000027',
  'southwark': 'E09000028',
  'sutton': 'E09000029',
  'towerhamlets': 'E09000030',
  'walthamforest': 'E09000031',
  'wandsworth': 'E09000032',
  'westminster': 'E09000033',
  // South East
  'crawley': 'E07000061',
  'reading': 'E06000038',
  'maidstone': 'E07000110',
  'miltonkeynes': 'E06000042',
  'slough': 'E06000039',
  'hastings': 'E07000064',
  'buckinghamshire': 'E06000060',
  'wycombe': 'E06000060', // pre-2020 name
  'basingstokeanddean': 'E07000084',
  'basingstoke': 'E07000084',
  'brightonandhove': 'E06000043',
  'medway': 'E06000035',
  'eastbourne': 'E07000062',
  'rushmoor': 'E07000092',
  'oxford': 'E07000178',
  'thanet': 'E07000114',
  'portsmouth': 'E06000044',
  'southampton': 'E06000045',
  'eastleigh': 'E07000086',
  'fareham': 'E07000087',
  'gosport': 'E07000088',
  'havant': 'E07000090',
  // East of England
  'norwich': 'E07000148',
  'chelmsford': 'E07000070',
  'peterborough': 'E06000031',
  'ipswich': 'E07000202',
  'cambridge': 'E07000008',
  'colchester': 'E07000071',
  'bedford': 'E06000055',
  'luton': 'E06000032',
  'basildon': 'E07000066',
  'southendsea': 'E06000033',
  'southendonsea': 'E06000033',
  // West Midlands
  'birmingham': 'E08000025',
  'solihull': 'E08000029',
  'dudley': 'E08000027',
  'sandwell': 'E08000028',
  'walsall': 'E08000030',
  'wolverhampton': 'E08000031',
  'coventry': 'E08000026',
  'telfordandwrekin': 'E06000020',
  'telford': 'E06000020',
  // East Midlands
  'leicester': 'E06000016',
  'westnorthamptonshire': 'E06000061',
  'northampton': 'E06000061',
  'derby': 'E06000015',
  'nottingham': 'E06000018',
  'stoke': 'E06000021',
  'stokeontrent': 'E06000021',
  'chesterfield': 'E07000034',
  'mansfield': 'E07000174',
  'lincoln': 'E07000138',
  'eaststaffordshire': 'E07000032',
  // Yorkshire & Humber
  'leeds': 'E08000035',
  'bradford': 'E08000032',
  'calderdale': 'E08000033',
  'kirklees': 'E08000034',
  'wakefield': 'E08000036',
  'sheffield': 'E08000019',
  'rotherham': 'E08000018',
  'northeastlincolnshire': 'E06000012',
  'york': 'E06000014',
  'barnsley': 'E08000016',
  'doncaster': 'E08000017',
  'kingstonuponhull': 'E06000010',
  'hull': 'E06000010',
  // North West
  'manchester': 'E08000003',
  'bolton': 'E08000001',
  'bury': 'E08000002',
  'oldham': 'E08000004',
  'rochdale': 'E08000005',
  'salford': 'E08000006',
  'stockport': 'E08000007',
  'tameside': 'E08000008',
  'trafford': 'E08000009',
  'wigan': 'E08000010',
  'knowsley': 'E08000011',
  'liverpool': 'E08000012',
  'sefton': 'E08000014',
  'wirral': 'E08000015',
  'preston': 'E07000123',
  'southribble': 'E07000126',
  'burnley': 'E07000117',
  'blackburnwithdarwen': 'E06000008',
  'blackburn': 'E06000008',
  'warrington': 'E06000007',
  'hyndburn': 'E07000116',
  'rossendale': 'E07000125',
  'blackpool': 'E06000009',
  // North East
  'sunderland': 'E08000024',
  'newcastleupontyne': 'E08000021',
  'northtyneside': 'E08000022',
  'southtyneside': 'E08000023',
  'gateshead': 'E08000037',
  'middlesbrough': 'E06000002',
  'redcarandcleveland': 'E06000003',
  'stocktonontees': 'E06000004',
  // South West
  'bristol': 'E06000023',
  'cheltenham': 'E07000078',
  'bournemouthchristchurchandpoole': 'E06000058',
  'bournemouth': 'E06000058',
  'poole': 'E06000058',
  'gloucester': 'E07000081',
  'exeter': 'E07000041',
  'plymouth': 'E06000026',
  'swindon': 'E06000030',
  'torbay': 'E06000027',
  // Wales
  'cardiff': 'W06000015',
  'newport': 'W06000022',
  'swansea': 'W06000011',
};
