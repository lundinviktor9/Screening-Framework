import { BarChart } from '@tremor/react';

import { PILLARS } from '../../data/metrics';
import type { ScoredMarket } from '../../types';

// Restrained, brand-family Tremor palette for up to 5 compared markets.
const SERIES_COLORS = ['violet', 'cyan', 'emerald', 'amber', 'rose'];

/** Grouped Tremor bar chart: per-pillar score (0–5) for each selected market. */
export default function PillarBarChart({ markets }: { markets: ScoredMarket[] }) {
  const names = markets.map((m) => m.market.name);
  const data = PILLARS.map((p) => {
    const row: Record<string, any> = { pillar: p.name.split(' ')[0] };
    markets.forEach((m) => {
      row[m.market.name] = Number((m.pillarScores[p.name]?.score ?? 0).toFixed(2));
    });
    return row;
  });

  return (
    <BarChart
      className="h-80"
      data={data}
      index="pillar"
      categories={names}
      colors={SERIES_COLORS.slice(0, names.length)}
      valueFormatter={(v) => v.toFixed(1)}
      yAxisWidth={32}
      maxValue={5}
      showAnimation
    />
  );
}
