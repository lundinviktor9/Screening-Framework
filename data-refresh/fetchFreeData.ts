/**
 * fetchFreeData.ts — Data refresh script
 *
 * Pulls three free public datasets and writes a JSON file of updated metric
 * values keyed by market ID. Does NOT modify ukMarkets.ts directly.
 *
 * Metrics updated:
 *   M7  — Land price growth 5yr CAGR (%) — HM Land Registry PPD
 *   M28 — Labour commute accessibility (%) — NOMIS NM_568_1 (Census 2021)
 *   M46 — Business rates burden index — VOA Compiled List
 *   M54 — Competing land-use pressure index — VOA Compiled List
 *
 * Usage:
 *   npx tsx data-refresh/fetchFreeData.ts [--skip-voa] [--skip-lr] [--skip-nomis]
 *
 * Options:
 *   --skip-voa     Skip the VOA download (large file, takes several minutes)
 *   --skip-lr      Skip the Land Registry download
 *   --skip-nomis   Skip the NOMIS API call
 *
 * Output:
 *   data-refresh/output/refreshed-values-YYYY-MM-DD.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MARKET_META } from './marketLACodes.js';
import { fetchNomisM28, aggregateM28ToMarket } from './sources/nomis.js';
import { fetchVoaMetrics, VOA_BA_TO_GSS, VOA_BULK_URL } from './sources/voa.js';
import { fetchLandRegistryM7 } from './sources/landRegistry.js';

// ── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const skipVoa = args.includes('--skip-voa');
const skipLr = args.includes('--skip-lr');
const skipNomis = args.includes('--skip-nomis');

// ── Types ────────────────────────────────────────────────────────────────────
interface MarketUpdate {
  m7?: number | null;
  m28?: number | null;
  m46?: number | null;
  m54?: number | null;
}

interface RefreshOutput {
  generatedAt: string;
  sources: {
    nomis: { skipped: boolean; dataset: string };
    voa: { skipped: boolean; url: string };
    landRegistry: { skipped: boolean; note: string };
  };
  markets: Record<string, MarketUpdate & { marketName: string }>;
  warnings: string[];
  summary: {
    m7Updated: number;
    m28Updated: number;
    m46Updated: number;
    m54Updated: number;
    totalWarnings: number;
  };
}

// ── Logger ───────────────────────────────────────────────────────────────────
function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  log('=== Screening Framework — free data refresh ===');
  log(`Flags: skip-voa=${skipVoa}, skip-lr=${skipLr}, skip-nomis=${skipNomis}`);

  const warnings: string[] = [];

  // Collect all unique LA codes for NOMIS query
  const allLaCodes = Array.from(
    new Set(Object.values(MARKET_META).flatMap(m => m.laCodes)),
  );
  log(`Markets: ${Object.keys(MARKET_META).length}, unique LA codes: ${allLaCodes.length}`);

  // ── NOMIS: M28 ─────────────────────────────────────────────────────────────
  let laM28: Record<string, number> = {};
  if (!skipNomis) {
    try {
      log('--- NOMIS (M28) ---');
      laM28 = await fetchNomisM28(allLaCodes, log);
      log(`NOMIS: computed M28 for ${Object.keys(laM28).length} LAs.`);
    } catch (err) {
      const msg = `NOMIS fetch failed: ${(err as Error).message}`;
      warnings.push(msg);
      log(`ERROR: ${msg}`);
    }
  } else {
    log('NOMIS: skipped (--skip-nomis).');
  }

  // ── VOA: M46 + M54 ────────────────────────────────────────────────────────
  let voaM46Raw: Record<string, number> = {};
  let voaM54Raw: Record<string, number> = {};
  if (!skipVoa) {
    try {
      log('--- VOA (M46, M54) ---');
      log(`VOA URL: ${VOA_BULK_URL}`);
      log('If this URL returns 404, visit https://voaratinglists.blob.core.windows.net/html/rli2023.html');
      log('to find the current bulk file URL and pass it via --voa-url=<url>');
      const voa = await fetchVoaMetrics(VOA_BULK_URL, log);
      voaM46Raw = voa.m46;
      voaM54Raw = voa.m54;
      log(`VOA: M46 for ${Object.keys(voaM46Raw).length} LAs, M54 for ${Object.keys(voaM54Raw).length} LAs.`);
    } catch (err) {
      const msg = `VOA fetch failed: ${(err as Error).message}`;
      warnings.push(msg);
      log(`ERROR: ${msg}`);
    }
  } else {
    log('VOA: skipped (--skip-voa).');
  }

  // ── Land Registry: M7 ─────────────────────────────────────────────────────
  let lrM7: Record<string, number> = {};
  if (!skipLr) {
    try {
      log('--- Land Registry (M7) ---');
      const lr = await fetchLandRegistryM7(log);
      lrM7 = lr.m7;
      warnings.push(...lr.warnings);
      log(`Land Registry: M7 for ${Object.keys(lrM7).length} LAs.`);
    } catch (err) {
      const msg = `Land Registry fetch failed: ${(err as Error).message}`;
      warnings.push(msg);
      log(`ERROR: ${msg}`);
    }
  } else {
    log('Land Registry: skipped (--skip-lr).');
  }

  // ── Aggregate to market level ─────────────────────────────────────────────
  log('--- Aggregating to market level ---');

  const markets: Record<string, MarketUpdate & { marketName: string }> = {};
  let m7Count = 0, m28Count = 0, m46Count = 0, m54Count = 0;

  for (const [marketId, meta] of Object.entries(MARKET_META)) {
    const update: MarketUpdate & { marketName: string } = { marketName: meta.name };

    // M28 — NOMIS (England + Wales only)
    if (!skipNomis) {
      if (!meta.nomisEW) {
        update.m28 = null;
        warnings.push(`${marketId} (${meta.name}): M28 skipped — NM_568_1 covers England/Wales only.`);
      } else {
        const m28 = aggregateM28ToMarket(laM28, meta.laCodes);
        update.m28 = m28;
        if (m28 !== null) m28Count++;
        else warnings.push(`${marketId} (${meta.name}): M28 — no NOMIS data returned for LA codes.`);
      }
    }

    // M46 + M54 — VOA (England only)
    if (!skipVoa) {
      if (!meta.voaEngland) {
        update.m46 = null;
        update.m54 = null;
        warnings.push(`${marketId} (${meta.name}): M46/M54 skipped — VOA covers England only.`);
      } else {
        // VOA keys by billing authority (BA) code; map each LA GSS → BA → metric
        const m46Vals: number[] = [];
        const m54Vals: number[] = [];

        for (const gss of meta.laCodes) {
          // Reverse-lookup: GSS → BA code (using the reverse of VOA_BA_TO_GSS)
          const ba = gssToVoaBa(gss);
          if (!ba) {
            warnings.push(`${marketId}: GSS ${gss} not in VOA_BA_TO_GSS reverse map. Extend the lookup.`);
            continue;
          }
          if (voaM46Raw[ba] !== undefined) m46Vals.push(voaM46Raw[ba]);
          if (voaM54Raw[ba] !== undefined) m54Vals.push(voaM54Raw[ba]);
        }

        update.m46 = m46Vals.length > 0 ? round1dp(mean(m46Vals)) : null;
        update.m54 = m54Vals.length > 0 ? round2dp(mean(m54Vals)) : null;

        if (update.m46 !== null) m46Count++;
        if (update.m54 !== null) m54Count++;
      }
    }

    // M7 — Land Registry (England + Wales)
    if (!skipLr) {
      const m7Vals: number[] = [];
      for (const gss of meta.laCodes) {
        if (lrM7[gss] !== undefined) m7Vals.push(lrM7[gss]);
      }
      update.m7 = m7Vals.length > 0 ? round2dp(mean(m7Vals)) : null;
      if (update.m7 !== null) m7Count++;
      else if (meta.nomisEW) {
        // Only warn for E&W markets (Scotland/NI expected to be null)
        warnings.push(`${marketId} (${meta.name}): M7 — insufficient Land Registry transactions or district name unmatched.`);
      }
    }

    markets[marketId] = update;
  }

  // ── Build output ──────────────────────────────────────────────────────────
  const output: RefreshOutput = {
    generatedAt: new Date().toISOString(),
    sources: {
      nomis: { skipped: skipNomis, dataset: 'NM_568_1 — Census 2021 Distance Travelled to Work' },
      voa: { skipped: skipVoa, url: VOA_BULK_URL },
      landRegistry: {
        skipped: skipLr,
        note: 'Property type "O" (Other/commercial) transactions — 5yr CAGR of median price per LA',
      },
    },
    markets,
    warnings,
    summary: {
      m7Updated: m7Count,
      m28Updated: m28Count,
      m46Updated: m46Count,
      m54Updated: m54Count,
      totalWarnings: warnings.length,
    },
  };

  // ── Write output file ─────────────────────────────────────────────────────
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const dateStr = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outputDir, `refreshed-values-${dateStr}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  log('');
  log('=== Complete ===');
  log(`Output: ${outputPath}`);
  log(`M7  updated: ${m7Count} markets`);
  log(`M28 updated: ${m28Count} markets`);
  log(`M46 updated: ${m46Count} markets`);
  log(`M54 updated: ${m54Count} markets`);
  log(`Warnings: ${warnings.length}`);
  if (warnings.length > 0) {
    log('');
    log('Warnings:');
    for (const w of warnings) log(`  ⚠ ${w}`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build reverse map: GSS → VOA BA code (lazy, built once)
let _reverseVoaMap: Record<string, string> | null = null;
function gssToVoaBa(gss: string): string | null {
  if (!_reverseVoaMap) {
    _reverseVoaMap = {};
    for (const [ba, g] of Object.entries(VOA_BA_TO_GSS)) {
      _reverseVoaMap[g] = ba;
    }
  }
  return _reverseVoaMap[gss] ?? null;
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function round1dp(v: number): number { return Math.round(v * 10) / 10; }
function round2dp(v: number): number { return Math.round(v * 100) / 100; }

// ── Run ───────────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
