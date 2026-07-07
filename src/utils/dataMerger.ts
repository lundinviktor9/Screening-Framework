/**
 * Merges scraped data from master_data.json into the existing market data.
 *
 * Priority hierarchy (lower wins):
 *   1. VERIFIED (government API)
 *   2. ESTIMATED (manual entry with source)
 *   3. REGIONAL_PROXY
 *   4. No source / missing
 *
 * Scraped VERIFIED data overwrites existing values unless the existing
 * value was manually entered via the Data Entry panel (has a non-empty
 * sourceName that doesn't match a known government source).
 */

import type { MarketInput, MetricSource, MetricStatusFlag, GeographicLevel } from '../types';
import { METRICS } from '../data/metrics';
import { UK_MARKETS } from '../data/ukMarkets';

// ─── Master data JSON shape ───────────────────────────────────────────────────

interface MasterMetric {
  value: number;
  source_name: string;
  source_url: string;
  source_date: string;
  status: string;
  geographic_level: string;
}

interface MasterMarket {
  name: string;
  region: string;
  metrics: Record<string, MasterMetric>;
}

export interface MasterData {
  generated_at: string;
  version: number;
  metrics: string[];
  markets: Record<string, MasterMarket>;
}

// ─── Priority ─────────────────────────────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  VERIFIED: 1,
  ESTIMATED: 2,
  REGIONAL_PROXY: 3,
};

function getPriority(status?: MetricStatusFlag | string): number {
  if (!status) return 99;
  return STATUS_PRIORITY[status] ?? 99;
}

// ─── Merge ────────────────────────────────────────────────────────────────────

export function mergeMasterData(
  markets: MarketInput[],
  master: MasterData,
): MarketInput[] {
  // Build a map of UK_MARKETS for coordinate restoration
  const ukMarketsById = new Map(UK_MARKETS.map(m => [m.id, m]));

  return markets.map(market => {
    const masterEntry = master.markets[market.id];
    if (!masterEntry) return market;

    const values = { ...market.values };
    const sources = { ...market.sources };

    for (const [metricIdStr, scraped] of Object.entries(masterEntry.metrics)) {
      const metricId = Number(metricIdStr);
      if (isNaN(metricId)) continue;

      const existingSource = sources[metricId];
      const existingPriority = getPriority(existingSource?.status);
      const scrapedPriority = getPriority(scraped.status as MetricStatusFlag);

      // Scraped data wins if it has equal or higher priority
      // Exception: if existing was manually entered (has sourceName from Data Entry),
      // keep the manual entry even if scraped has same priority
      const isManualEntry = existingSource?.sourceName &&
        !existingSource.sourceName.startsWith('ONS') &&
        !existingSource.sourceName.startsWith('NOMIS') &&
        !existingSource.sourceName.startsWith('Environment Agency') &&
        existingSource.confidence === 'primary_source';

      if (scrapedPriority < existingPriority || (!isManualEntry && scrapedPriority <= existingPriority)) {
        values[metricId] = scraped.value;
        sources[metricId] = {
          sourceName: scraped.source_name,
          sourceUrl: scraped.source_url,
          dataDate: scraped.source_date,
          status: scraped.status as MetricStatusFlag,
          geographicLevel: (scraped.geographic_level || 'market') as GeographicLevel,
          confidence: scraped.status === 'VERIFIED' ? 'primary_source' : 'estimated',
        };
      }
    }

    const merged = { ...market, values, sources };

    // Safeguard: restore lat/lng from UK_MARKETS if missing (prevents NaN errors in map)
    if (!merged.lat || !merged.lng) {
      const ukMarket = ukMarketsById.get(market.id);
      if (ukMarket) {
        merged.lat = ukMarket.lat;
        merged.lng = ukMarket.lng;
      }
    }

    return merged;
  });
}

// ─── Completeness ─────────────────────────────────────────────────────────────

export interface CompletenessInfo {
  filled: number;
  total: number;
  percent: number;
}

export function computeCompleteness(market: MarketInput): CompletenessInfo {
  const total = METRICS.length;
  let filled = 0;
  for (const metric of METRICS) {
    const val = market.values[metric.id];
    if (val !== null && val !== undefined) {
      const status = market.sources[metric.id]?.status;
      // REVIEW_NEEDED does not count as filled
      if (!status || status !== 'REVIEW_NEEDED') {
        filled++;
      }
    }
  }
  return { filled, total, percent: Math.round((filled / total) * 100) };
}
