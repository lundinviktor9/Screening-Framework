import type { MarketInput, MetricSource } from '../types';
import { METRICS } from '../data/metrics';
import { validateMetricValue } from './validation';

// Column headers: market_id, market_name, region, m1 … m60
const FIXED_COLS = ['market_id', 'market_name', 'region'];
const METRIC_COLS = METRICS.map(m => `m${m.id}`);
const ALL_COLS = [...FIXED_COLS, ...METRIC_COLS];

// ─── Export ────────────────────────────────────────────────────────────────────

/** Build a CSV string from the current list of markets and trigger a download. */
export function exportToCSV(markets: MarketInput[]): void {
  const rows: string[] = [ALL_COLS.join(',')];

  for (const mkt of markets) {
    const cells: string[] = [
      csvCell(mkt.id),
      csvCell(mkt.name),
      csvCell(mkt.region),
      ...METRICS.map(m => {
        const v = mkt.values[m.id];
        return v === null || v === undefined ? '' : String(v);
      }),
    ];
    rows.push(cells.join(','));
  }

  const csv = rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `screening-data-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Import ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  updatedMarkets: MarketInput[];
  valuesUpdated: number;
  marketsUpdated: number;
  warnings: string[];
  /** Count of values that passed validation */
  valuesVerified: number;
  /** Count of values flagged REVIEW_NEEDED (outside validation bounds) */
  valuesFlaggedReview: number;
}

/**
 * Parse an imported CSV string and merge values into the existing markets.
 * Rules:
 *  - Only markets whose market_id matches an existing market are updated.
 *  - Blank cells are skipped (existing value preserved).
 *  - Non-numeric values for metric columns produce a warning and are skipped.
 *  - market_name and region are NOT overwritten — edit those in the app.
 */
export function parseImportedCSV(csvText: string, existingMarkets: MarketInput[]): ImportResult {
  const warnings: string[] = [];
  let valuesUpdated = 0;
  let valuesVerified = 0;
  let valuesFlaggedReview = 0;
  const updatedIds = new Set<string>();

  // Parse CSV rows
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    return {
      updatedMarkets: existingMarkets, valuesUpdated: 0, marketsUpdated: 0,
      valuesVerified: 0, valuesFlaggedReview: 0,
      warnings: ['CSV file appears to be empty.'],
    };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idIdx = headers.indexOf('market_id');
  if (idIdx === -1) {
    return {
      updatedMarkets: existingMarkets, valuesUpdated: 0, marketsUpdated: 0,
      valuesVerified: 0, valuesFlaggedReview: 0,
      warnings: ['CSV is missing a "market_id" column. Make sure you are using the exported template.'],
    };
  }

  // Build a map of metric column name → metric id
  const metricColMap: Record<string, number> = {};
  for (const m of METRICS) {
    metricColMap[`m${m.id}`] = m.id;
  }

  // Deep-clone existing markets so we don't mutate the originals
  const markets: MarketInput[] = existingMarkets.map(m => ({
    ...m,
    values: { ...m.values },
    sources: { ...m.sources },
  }));

  const marketById: Record<string, MarketInput> = {};
  for (const m of markets) marketById[m.id] = m;

  const now = new Date().toISOString();

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cells = lines[rowIdx].split(',');
    const id = cells[idIdx]?.trim();
    if (!id) continue;

    const mkt = marketById[id];
    if (!mkt) {
      warnings.push(`Row ${rowIdx + 1}: market_id "${id}" not found — skipped.`);
      continue;
    }

    let rowUpdated = false;
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const col = headers[colIdx];
      const metricId = metricColMap[col];
      if (metricId === undefined) continue; // not a metric column

      const raw = cells[colIdx]?.trim();
      if (!raw) continue; // blank — preserve existing value

      const num = Number(raw);
      if (isNaN(num)) {
        warnings.push(`Row ${rowIdx + 1}, column "${col}": "${raw}" is not a number — skipped.`);
        continue;
      }

      // Run validation — flag out-of-range values as REVIEW_NEEDED
      const valResult = validateMetricValue(metricId, num);
      const status = valResult.valid ? 'ESTIMATED' : 'REVIEW_NEEDED';
      if (!valResult.valid) {
        warnings.push(`Row ${rowIdx + 1} (${mkt.name}), ${col}: ${valResult.message} — flagged REVIEW_NEEDED.`);
        valuesFlaggedReview++;
      } else {
        valuesVerified++;
      }

      const existingSource = mkt.sources[metricId];
      const newSource: MetricSource = {
        sourceName: existingSource?.sourceName || 'CSV import',
        sourceUrl: existingSource?.sourceUrl || '',
        dataDate: existingSource?.dataDate || now.slice(0, 10),
        status,
        geographicLevel: existingSource?.geographicLevel || 'market',
        confidence: 'estimated',
        justificationNote: valResult.valid ? existingSource?.justificationNote : undefined,
      };

      mkt.values[metricId] = num;
      mkt.sources[metricId] = newSource;
      valuesUpdated++;
      rowUpdated = true;
    }

    if (rowUpdated) {
      mkt.updatedAt = now;
      updatedIds.add(id);
    }
  }

  return {
    updatedMarkets: markets,
    valuesUpdated,
    marketsUpdated: updatedIds.size,
    valuesVerified,
    valuesFlaggedReview,
    warnings,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Wrap a cell value in quotes if it contains a comma or quote. */
function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
