/**
 * VOA source — Metrics 46 + 54
 *
 * Dataset: VOA Non-Domestic Rating Compiled List (England only)
 * Download: https://voaratinglists.blob.core.windows.net/html/rli2023.html
 *   — Check this URL for the current bulk file link. The ZIP is typically 3–5 GB.
 *   — This script streams and parses the CSV without loading it into memory.
 *
 * M46 — Business rates / occupancy cost burden (index, national = 100)
 *   Derived from: median rateable value per m² for industrial/warehouse premises by LA,
 *   indexed to the national median.
 *   Industrial desc_codes: IND, WH, FP, LS, INDW, INDS, WHA, WHB, WHC, WHS
 *
 * M54 — Competing land-use pressure (retail+office RV / industrial RV ratio)
 *   Derived from: mean RV/m² for retail+office vs industrial by LA.
 *   A higher ratio = greater competing demand for land from non-industrial uses.
 *   Normalised to national median = 1.0.
 *
 * Coverage: England only. Welsh, Scottish and NI markets → null.
 *
 * VOA CSV columns (zero-indexed after header row):
 *   0: ba_reference_number
 *   1: property_category_code      ← property type (e.g. IND, SH, OFF)
 *   2: primary_description         ← text description
 *   3: effective_date
 *   4: composite_indicator
 *   5: rateable_value              ← rateable value (£)
 *   6: uarn
 *   7: ba_code                     ← ONS billing authority code
 *   8: paon
 *   9: saon
 *  10: postcode
 *  11: total_area                  ← floor area (m²) — may be blank
 *  12: list_altered_code
 *
 * Note: column positions and headers vary by release. The script discovers them
 * from the header row. If a required column is missing it throws a clear error.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as https from 'https';
import * as http from 'http';
import { pipeline } from 'stream/promises';
import { createUnzip } from 'zlib';
import * as path from 'path';
import * as os from 'os';

// ── Property category codes ──────────────────────────────────────────────────

/** Industrial / warehouse desc codes in the VOA compiled list */
const INDUSTRIAL_CODES = new Set([
  'IND', 'WH', 'FP', 'LS', 'INDW', 'INDS', 'WHA', 'WHB', 'WHC', 'WHS',
  'FACT', 'WKSP', 'LIGHT', 'DIST', 'STOR',
]);

/** Retail + office desc codes (competing uses) */
const COMPETING_CODES = new Set([
  'SH', 'OFF', 'SC', 'SHOP', 'OFFW', 'OFFI', 'RET', 'RETAIL', 'OFFICE',
  'SUPM', 'RTLW', 'SHPG',
]);

/** URL of the VOA compiled list — verify at https://voaratinglists.blob.core.windows.net/html/rli2023.html */
export const VOA_BULK_URL =
  'https://voaratinglists.blob.core.windows.net/html/compiledlist-data-england.zip';

interface LaStats {
  indRvSum: number;   indAreaSum: number;   indCount: number;
  compRvSum: number;  compAreaSum: number;  compCount: number;
}

export interface VoaResult {
  m46: Record<string, number>;  // LA code → RV/m² index (national = 100)
  m54: Record<string, number>;  // LA code → competing pressure index (national = 1.0)
}

/**
 * Download the VOA bulk CSV (streaming) and compute M46 + M54 per LA.
 * @param voaUrl - Override the default bulk download URL if needed.
 */
export async function fetchVoaMetrics(
  voaUrl: string = VOA_BULK_URL,
  log: (msg: string) => void = console.log,
): Promise<VoaResult> {
  const laStats: Record<string, LaStats> = {};

  // ── Download and stream-parse the ZIP ────────────────────────────────────
  log(`VOA: starting download from ${voaUrl}`);
  log('VOA: this will take several minutes — the file is 3–5 GB compressed.');

  // Write decompressed CSV to a temp file to allow two-pass reading if needed.
  // Actually we parse in a single streaming pass.
  const tmpFile = path.join(os.tmpdir(), `voa-compiled-${Date.now()}.csv`);
  log(`VOA: streaming to temp file ${tmpFile}`);

  await downloadAndDecompress(voaUrl, tmpFile, log);
  log('VOA: download complete, parsing CSV…');

  // ── Parse CSV line by line ────────────────────────────────────────────────
  const rl = readline.createInterface({
    input: fs.createReadStream(tmpFile, { encoding: 'latin1' }), // VOA uses Windows-1252
    crlfDelay: Infinity,
  });

  let headerParsed = false;
  let colDescCode = -1;
  let colRv = -1;
  let colBaCode = -1;
  let colArea = -1;
  let lineCount = 0;
  let parsedCount = 0;

  for await (const line of rl) {
    lineCount++;

    if (!headerParsed) {
      const headers = splitCsvLine(line).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
      colDescCode = findCol(headers, ['propertycategorycode', 'desc_code', 'scat_code_only']);
      colRv = findCol(headers, ['rateablevalue', 'rateable_value', 'rv']);
      colBaCode = findCol(headers, ['bacode', 'ba_code', 'billing_authority_code']);
      colArea = findCol(headers, ['totalarea', 'total_area', 'total_area_m2', 'floorarea']);

      if (colDescCode < 0 || colRv < 0 || colBaCode < 0) {
        throw new Error(
          `VOA CSV header missing required columns.\n` +
          `  Found: ${headers.join(', ')}\n` +
          `  Required: property category code, rateable value, BA code.`,
        );
      }
      if (colArea < 0) {
        log('VOA: floor area column not found — M46 will use RV totals only (less accurate).');
      }
      headerParsed = true;
      continue;
    }

    if (lineCount % 1_000_000 === 0) log(`VOA: parsed ${lineCount.toLocaleString()} lines…`);

    const cols = splitCsvLine(line);
    const descCode = (cols[colDescCode] ?? '').trim().toUpperCase();
    const rvRaw = parseFloat(cols[colRv] ?? '');
    const baCode = (cols[colBaCode] ?? '').trim().toUpperCase();
    const areaRaw = colArea >= 0 ? parseFloat(cols[colArea] ?? '') : NaN;

    if (!baCode || isNaN(rvRaw) || rvRaw <= 0) continue;

    const rv = rvRaw;
    const area = isNaN(areaRaw) || areaRaw <= 0 ? null : areaRaw;

    if (!laStats[baCode]) {
      laStats[baCode] = {
        indRvSum: 0, indAreaSum: 0, indCount: 0,
        compRvSum: 0, compAreaSum: 0, compCount: 0,
      };
    }

    if (INDUSTRIAL_CODES.has(descCode)) {
      laStats[baCode].indRvSum += rv;
      if (area) laStats[baCode].indAreaSum += area;
      laStats[baCode].indCount++;
      parsedCount++;
    } else if (COMPETING_CODES.has(descCode)) {
      laStats[baCode].compRvSum += rv;
      if (area) laStats[baCode].compAreaSum += area;
      laStats[baCode].compCount++;
      parsedCount++;
    }
  }

  // Remove temp file
  try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

  log(`VOA: parsed ${parsedCount.toLocaleString()} relevant records from ${lineCount.toLocaleString()} lines.`);

  // ── Compute RV/m² per LA ──────────────────────────────────────────────────
  // Use RV/area if area data available; fall back to RV/count as a proxy.
  function indRvPerUnit(s: LaStats): number {
    if (s.indAreaSum > 0) return s.indRvSum / s.indAreaSum;
    return s.indCount > 0 ? s.indRvSum / s.indCount : 0;
  }
  function compRvPerUnit(s: LaStats): number {
    if (s.compAreaSum > 0) return s.compRvSum / s.compAreaSum;
    return s.compCount > 0 ? s.compRvSum / s.compCount : 0;
  }

  // National medians (across all LAs with sufficient data)
  const indUnits = Object.values(laStats)
    .filter(s => s.indCount >= 5)
    .map(indRvPerUnit)
    .sort((a, b) => a - b);
  const compUnits = Object.values(laStats)
    .filter(s => s.compCount >= 5)
    .map(s => compRvPerUnit(s) / Math.max(indRvPerUnit(s), 1))
    .sort((a, b) => a - b);

  const nationalIndMedian = median(indUnits) || 1;
  const nationalRatioMedian = median(compUnits) || 1;

  log(`VOA: national industrial RV/unit median = ${nationalIndMedian.toFixed(2)}`);
  log(`VOA: national comp/ind ratio median = ${nationalRatioMedian.toFixed(2)}`);

  // ── Convert VOA billing authority codes to ONS GSS codes ─────────────────
  // VOA BA codes are 3-letter codes (e.g. "5060" or "E" prefixed strings).
  // They do NOT directly match ONS GSS E06/E07/E08/E09 codes.
  // We use the ONS lookup table published alongside the VOA data.
  // For now, we note this limitation and return raw BA-keyed results.
  // The main script maps BA → GSS using the supplementary lookup below.

  const m46: Record<string, number> = {};
  const m54: Record<string, number> = {};

  for (const [baCode, stats] of Object.entries(laStats)) {
    if (stats.indCount < 5) continue; // insufficient data

    const indRpu = indRvPerUnit(stats);
    m46[baCode] = Math.round((indRpu / nationalIndMedian) * 100 * 10) / 10;

    if (stats.compCount >= 5) {
      const ratio = compRvPerUnit(stats) / Math.max(indRpu, 1);
      m54[baCode] = Math.round((ratio / nationalRatioMedian) * 100) / 100;
    }
  }

  return { m46, m54 };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Naive CSV splitter — handles double-quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function downloadAndDecompress(
  url: string,
  destPath: string,
  log: (msg: string) => void,
): Promise<void> {
  const dest = fs.createWriteStream(destPath);
  const unzip = createUnzip();

  await new Promise<void>((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        log(`VOA: following redirect to ${res.headers.location}`);
        downloadAndDecompress(res.headers.location!, destPath, log).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`VOA download failed: HTTP ${res.statusCode} from ${url}`));
        return;
      }
      res.pipe(unzip).pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
      unzip.on('error', reject);
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

/**
 * VOA billing authority code → ONS GSS code lookup.
 * This is a partial lookup covering the most common codes.
 * Full lookup: https://www.gov.uk/government/publications/rates-retention-and-billing-authority-data
 *
 * Key: VOA 4-digit billing authority code (as found in ba_code column)
 * Value: ONS GSS code
 */
export const VOA_BA_TO_GSS: Record<string, string> = {
  // London
  '5030': 'E09000001', // City of London
  '5060': 'E09000002', // Barking and Dagenham
  '5090': 'E09000003', // Barnet
  '5120': 'E09000004', // Bexley
  '5150': 'E09000005', // Brent
  '5180': 'E09000006', // Bromley
  '5210': 'E09000007', // Camden
  '5240': 'E09000008', // Croydon
  '5270': 'E09000009', // Ealing
  '5300': 'E09000010', // Enfield
  '5330': 'E09000011', // Greenwich
  '5360': 'E09000012', // Hackney
  '5390': 'E09000013', // Hammersmith and Fulham
  '5420': 'E09000014', // Haringey
  '5450': 'E09000015', // Harrow
  '5480': 'E09000016', // Havering
  '5510': 'E09000017', // Hillingdon
  '5540': 'E09000018', // Hounslow
  '5570': 'E09000019', // Islington
  '5600': 'E09000020', // Kensington and Chelsea
  '5630': 'E09000021', // Kingston upon Thames
  '5660': 'E09000022', // Lambeth
  '5690': 'E09000023', // Lewisham
  '5720': 'E09000024', // Merton
  '5750': 'E09000025', // Newham
  '5780': 'E09000026', // Redbridge
  '5810': 'E09000027', // Richmond upon Thames
  '5840': 'E09000028', // Southwark
  '5870': 'E09000029', // Sutton
  '5900': 'E09000030', // Tower Hamlets
  '5930': 'E09000031', // Waltham Forest
  '5960': 'E09000032', // Wandsworth
  '5990': 'E09000033', // Westminster
  // South East (sample — extend from full ONS lookup as needed)
  '3450': 'E07000061', // Crawley
  '3090': 'E06000038', // Reading
  '2250': 'E07000110', // Maidstone
  '1760': 'E06000042', // Milton Keynes
  '3560': 'E06000039', // Slough
  '1560': 'E07000064', // Hastings
  '1585': 'E07000062', // Eastbourne
  '1725': 'E07000092', // Rushmoor (Farnborough)
  '3140': 'E07000178', // Oxford
  '1590': 'E07000114', // Thanet
  '2240': 'E06000035', // Medway
  '1245': 'E06000043', // Brighton and Hove
  '1730': 'E07000084', // Basingstoke and Deane
};
