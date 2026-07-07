import { useMemo } from 'react';
import { Card, DonutChart, BarChart, Legend } from '@tremor/react';

import { PILLARS } from '../../data/metrics';
import type { ScoredMarket } from '../../types';

/**
 * Professional Tremor overview band shown atop the Dashboard: headline metric
 * cards + a tier-distribution donut + a mean-score-by-pillar bar chart.
 */
export default function MarketOverview({ markets }: { markets: ScoredMarket[] }) {
  const stats = useMemo(() => {
    const t1 = markets.filter((m) => m.totalScore >= 80).length;
    const t2 = markets.filter((m) => m.totalScore >= 60 && m.totalScore < 80).length;
    const t3 = markets.filter((m) => m.totalScore < 60).length;
    const mean = markets.length ? markets.reduce((s, m) => s + m.totalScore, 0) / markets.length : 0;

    const pillarAvg = PILLARS.map((p) => {
      const scored = markets
        .map((m) => m.pillarScores[p.name]?.score ?? 0)
        .filter((s) => s > 0);
      const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
      return { pillar: p.name.split(' ')[0], 'Mean score': Number(avg.toFixed(2)) };
    });

    return {
      mean,
      tierData: [
        { name: 'Tier 1 — Core', value: t1 },
        { name: 'Tier 2 — Value-add', value: t2 },
        { name: 'Tier 3 — Monitor', value: t3 },
      ],
      pillarAvg,
      regions: new Set(markets.map((m) => m.market.region)).size,
    };
  }, [markets]);

  const top = markets[0];

  return (
    <div className="mb-6 space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Markets" value={String(markets.length)} sub={`across ${stats.regions} regions`} />
        <Kpi label="Tier 1 — Core" value={String(stats.tierData[0].value)} sub="score ≥ 80" accent />
        <Kpi label="Mean composite" value={stats.mean.toFixed(1)} sub="all markets" />
        <Kpi label="Top market" value={top ? top.totalScore.toFixed(1) : '—'} sub={top?.market.name ?? '—'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-tremor-content">Tier distribution</h3>
          <DonutChart
            className="mt-4 h-52"
            data={stats.tierData}
            category="value"
            index="name"
            colors={['emerald', 'amber', 'rose']}
            valueFormatter={(v) => `${v} markets`}
            showAnimation
          />
          <Legend
            className="mt-3 justify-center"
            categories={stats.tierData.map((t) => t.name)}
            colors={['emerald', 'amber', 'rose']}
          />
        </Card>

        <Card className="rounded-lg">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-tremor-content">
            Mean score by pillar (0–5)
          </h3>
          <BarChart
            className="mt-4 h-52"
            data={stats.pillarAvg}
            index="pillar"
            categories={['Mean score']}
            colors={['violet']}
            valueFormatter={(v) => v.toFixed(2)}
            yAxisWidth={32}
            maxValue={5}
            showAnimation
            showLegend={false}
          />
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className="rounded-lg">
      <p className="text-tremor-label font-semibold uppercase tracking-wide text-tremor-content">{label}</p>
      <p className={`mt-1 text-tremor-metric font-bold ${accent ? 'text-tremor-brand' : 'text-tremor-content-strong'}`}>
        {value}
      </p>
      {sub && <p className="truncate text-tremor-label text-tremor-content">{sub}</p>}
    </Card>
  );
}
