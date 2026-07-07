/**
 * Validation bounds for all 64 metrics.
 *
 * Values outside these bounds are flagged REVIEW_NEEDED by default and excluded
 * from scoring (see src/store/marketStore.ts getScoredMarkets selector). Users
 * can override with a justification note to restore REVIEW_NEEDED → ESTIMATED.
 *
 * Bounds are calibrated to be wider than the scoring thresholds in metrics.ts
 * (t2 to t5) to allow outliers but catch obvious data-entry errors like
 * missing decimals or wrong units.
 */

export interface ValidationRule {
  min: number;
  max: number;
  unit: string;
  /** Optional short hint shown to users explaining typical range */
  hint?: string;
}

export const METRIC_VALIDATION: Record<number, ValidationRule> = {
  // ── SUPPLY ────────────────────────────────────────────────────────────────
  1:  { min: 0, max: 40, unit: '% of stock', hint: 'UK industrial vacancy typically 3-10%' },
  2:  { min: 0, max: 30, unit: '% of prime stock', hint: 'Prime vacancy typically 2-8%' },
  3:  { min: 0, max: 50, unit: '% of stock', hint: 'Pipeline typically 2-15% of stock' },
  4:  { min: 0, max: 100, unit: '% of pipeline' },
  5:  { min: 1, max: 5, unit: 'score 1-5' },
  6:  { min: 1, max: 5, unit: 'score 1-5' },
  7:  { min: -20, max: 50, unit: '% CAGR', hint: 'Typical land value CAGR 1-10%' },
  8:  { min: 0, max: 60, unit: 'months', hint: 'UK planning approval 6-18 months typical' },
  9:  { min: 0, max: 100, unit: '%' },
  10: { min: 0, max: 100, unit: '% of stock' },

  // ── DEMAND ────────────────────────────────────────────────────────────────
  11: { min: -30, max: 50, unit: '% CAGR', hint: 'Take-up CAGR typically -10% to +15%' },
  12: { min: -20, max: 30, unit: '% of stock' },
  13: { min: 0, max: 200, unit: '%' },
  14: { min: 0, max: 100, unit: '% of pipeline' },
  15: { min: -20, max: 20, unit: '% YoY', hint: 'Business formation typically -3% to +5% YoY' },
  16: { min: 0, max: 200, unit: 'SMEs per 1,000 pop', hint: 'UK typical range 20-80' },
  17: { min: 0, max: 100, unit: 'deals/year' },
  18: { min: 0, max: 10, unit: 'location quotient', hint: 'LQ 1.0 = national average' },
  19: { min: 0, max: 15, unit: '# sectors' },
  20: { min: 0, max: 100, unit: '%' },

  // ── CONNECTIVITY ──────────────────────────────────────────────────────────
  21: { min: 0, max: 300, unit: 'minutes' },
  22: { min: 0, max: 100, unit: 'km' },
  23: { min: 0, max: 200, unit: 'km' },
  24: { min: 0, max: 500, unit: 'km' },
  25: { min: 0, max: 500, unit: 'km' },
  26: { min: 1, max: 5, unit: 'score 1-5' },
  27: { min: 0.8, max: 3, unit: 'index', hint: 'Congestion index = peak/off-peak ratio' },
  28: { min: 0, max: 100, unit: '%' },
  29: { min: 0, max: 50, unit: 'km' },
  30: { min: 0, max: 1000, unit: 'MW' },

  // ── LABOUR ────────────────────────────────────────────────────────────────
  31: { min: 0, max: 20_000_000, unit: 'people' },
  32: { min: 0, max: 40_000_000, unit: 'people' },
  33: { min: -20, max: 50, unit: '% over 10 years' },
  34: { min: -5, max: 20, unit: '% over 5 years', hint: 'Typical UK household growth 2-8% per 5yr' },
  35: { min: 40, max: 80, unit: '% of population' },
  36: { min: 0, max: 25, unit: '%' },
  37: { min: 50, max: 95, unit: '%' },
  38: { min: 50, max: 200, unit: 'index (national=100)' },
  39: { min: 50, max: 200, unit: 'index (national=100)' },
  40: { min: 0, max: 60, unit: '% of employment' },

  // ── RENTS & YIELDS ────────────────────────────────────────────────────────
  // M41/M42 redefined (v5): now £psf direct values sourced from Newmark Q3 2025
  41: { min: 3,  max: 30, unit: '£psf', hint: 'Newmark all-grades ERV £/sqft' },
  42: { min: 4,  max: 45, unit: '£psf', hint: 'Newmark prime rent £/sqft' },
  43: { min: 0, max: 100, unit: '%' },
  44: { min: -20, max: 30, unit: '% CAGR', hint: 'Rental CAGR typically 0-8%' },
  45: { min: -10, max: 20, unit: '% CAGR' },
  46: { min: 0, max: 30, unit: '% of occupancy cost' },
  47: { min: 0, max: 36, unit: 'months free on 10yr lease' },
  48: { min: 2, max: 15, unit: '%', hint: 'UK prime industrial yields typically 4.5-6.5%' },
  49: { min: -500, max: 500, unit: 'bps' },
  50: { min: -500, max: 1000, unit: 'bps' },

  // ── STRATEGIC / RISK ──────────────────────────────────────────────────────
  51: { min: 0, max: 50_000, unit: 'GBP £m' },
  52: { min: 0, max: 500, unit: 'deals/year' },
  53: { min: 1, max: 5, unit: '# bands' },
  54: { min: 0.5, max: 10, unit: 'ratio', hint: 'Residential:industrial land value ratio' },
  55: { min: 1, max: 5, unit: 'score 1-5' },
  56: { min: 0, max: 100_000, unit: 'homes/year within 15km' },
  57: { min: 0, max: 100, unit: '% certified' },
  58: { min: 1, max: 5, unit: 'score 1-5' },
  59: { min: 0, max: 10_000, unit: 'Mbps' },
  60: { min: 0, max: 100, unit: '% EV-ready' },

  // ── VOA MLI (M61-M64) ─────────────────────────────────────────────────────
  61: { min: 0, max: 100_000_000, unit: 'sqft' },
  62: { min: 0, max: 50_000, unit: 'units' },
  63: { min: 0, max: 100, unit: '%' },
  64: { min: -5000, max: 10_000, unit: 'units (3yr)' },

  // ── NEWMARK (M65-M72) — Multi-let Winter Bulletin Q3 2025 ────────────────
  65: { min: 3.5, max: 8,   unit: '%',      hint: 'Newmark equivalent yield (regional)' },
  66: { min: -2,  max: 6,   unit: '%',      hint: 'Yield spread vs UK 10-yr gilt (calculated)' },
  67: { min: 0,   max: 40,  unit: '%',      hint: 'Newmark rental reversion (regional)' },
  68: { min: -5,  max: 10,  unit: '% pa',   hint: 'Newmark prime rent growth forecast 2024-29' },
  69: { min: 0,   max: 30,  unit: '%',      hint: 'Newmark MLI vacancy rate (regional)' },
  70: { min: 30,  max: 90,  unit: '%',      hint: 'Newmark occupier retention rate (national)' },
  71: { min: 0,   max: 10,  unit: '%',      hint: 'Newmark default rate (national)' },
  72: { min: 0,   max: 24,  unit: 'months', hint: 'Newmark development pipeline months of supply' },
};
