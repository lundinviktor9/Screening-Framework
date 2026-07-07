/**
 * Format a metric value using unit-aware heuristics.
 * Returns only the numeric part (no unit). Use formatCompact() for
 * value + unit in one string.
 */
export function formatMetricValue(value: number, unit: string): string {
  const u = unit.toLowerCase();
  if (!Number.isFinite(value)) return '—';

  if (u.includes('%') || u.includes('cagr') || u.includes('index')) {
    return value.toFixed(1);
  }
  if (Math.abs(value) >= 10_000) {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) < 10) return value.toFixed(2);
  return value.toFixed(1);
}

/**
 * Format value + unit into a compact, self-explanatory string.
 * Examples:
 *   3891897,  'people'               → '3,891,897 people'
 *   45,       'minutes'              → '45 min'
 *   9,        'months'               → '9 months'
 *   400,      'Mbps available'       → '400 Mbps'
 *   4,        'score 1–5'            → '4 / 5'
 *   2.3,      'residential/industrial land value multiple' → '2.3×'
 *   500,      'GBP £m'               → '£500m'
 *   12,       '% of stock in high-risk zones' → '12% high-risk'
 *   115,      'index (national=100)' → '115 (nat=100)'
 */
export function formatCompact(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  const u = unit.toLowerCase().trim();
  const numeric = formatMetricValue(value, unit);

  // Scores — always out of 5
  if (u.startsWith('score')) return `${value.toFixed(0)} / 5`;

  // Time units
  if (u === 'minutes' || u === 'mins') return `${numeric} min`;
  if (u === 'months') return `${numeric} months`;
  if (u.startsWith('months free')) return `${numeric} mo free`;
  if (u.includes('over 10 years')) return `${numeric}% over 10y`;
  if (u.includes('over 5 years')) return `${numeric}% over 5y`;
  if (u.includes('yoy') || u.includes('% yoy')) return `${numeric}% YoY`;
  if (u.includes('cagr')) return `${numeric}% CAGR`;

  // Currency
  if (u === 'gbp £m' || u === '£m') return `£${numeric}m`;

  // Distance / telecoms / power
  if (u === 'km') return `${numeric} km`;
  if (u === 'mw') return `${numeric} MW`;
  if (u.startsWith('mbps')) return `${numeric} Mbps`;
  if (u === 'bps') return `${numeric} bps`;

  // Multiples and indices
  if (u.includes('multiple')) return `${Number(value).toFixed(1)}×`;
  if (u === 'location quotient' || u === 'lq') return `${Number(value).toFixed(2)} LQ`;
  if (u === 'index') return `${numeric} idx`;
  if (u.startsWith('index (national=100)')) return `${numeric} (nat=100)`;

  // Flood / ESG / EV coverage
  if (u.includes('high-risk zones')) return `${numeric}% high-risk`;
  if (u.includes('ev-ready')) return `${numeric}% EV-ready`;
  if (u.includes('certified')) return `${numeric}% certified`;
  if (u.includes('pipeline')) return `${numeric}% of pipeline`;
  if (u.includes('of stock')) return `${numeric}% of stock`;
  if (u.includes('of population')) return `${numeric}% pop.`;
  if (u.includes('of employment')) return `${numeric}% empl.`;
  if (u.includes('reachable in 45 min')) return `${numeric}% in 45min`;
  if (u.includes('occupancy cost')) return `${numeric}% occ. cost`;

  // Counts
  if (u === 'people') return `${numeric} people`;
  if (u === 'units' || u === 'units (3yr)') return `${numeric} units`;
  if (u === 'sqft') return `${numeric} sqft`;
  if (u.includes('new homes within 15km')) return `${numeric} homes/yr`;
  if (u.includes('smes per 1,000')) return `${numeric} /1k pop`;
  if (u.includes('deals / year') || u === 'deals/yr') return `${numeric} /yr`;
  if (u.includes('sectors')) return `${numeric} sectors`;
  if (u.includes('active bands')) return `${numeric} bands`;

  // Fallback: any raw '%' or '%' combinations
  if (u.includes('%')) return `${numeric}%`;

  // Last resort: just value, with unit if short
  if (unit.length > 0 && unit.length <= 6) return `${numeric} ${unit}`;
  return numeric;
}

/**
 * Human-readable short unit label (for table header chips, etc.).
 * Avoids awkward long unit strings like "residential/industrial land value multiple".
 */
export function shortUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u.startsWith('score')) return '/5';
  if (u === 'minutes') return 'min';
  if (u === 'months') return 'months';
  if (u.startsWith('months free')) return 'mo free';
  if (u === 'gbp £m') return '£m';
  if (u.startsWith('mbps')) return 'Mbps';
  if (u.includes('multiple')) return '×';
  if (u === 'location quotient') return 'LQ';
  if (u.startsWith('index (national=100)')) return 'idx';
  if (u.includes('people')) return 'people';
  if (u.includes('sqft')) return 'sqft';
  if (u.includes('units')) return 'units';
  if (u.includes('homes')) return 'homes/yr';
  if (u.includes('smes per')) return '/1k pop';
  if (u.includes('deals / year')) return '/yr';
  if (u.includes('sectors')) return 'sectors';
  if (u.includes('bands')) return 'bands';
  if (u.includes('cagr')) return '% CAGR';
  if (u.includes('yoy')) return '% YoY';
  if (u.includes('%')) return '%';
  return unit;
}

export function formatWithUnit(value: number | null | undefined, unit: string): string {
  return formatCompact(value, unit);
}
