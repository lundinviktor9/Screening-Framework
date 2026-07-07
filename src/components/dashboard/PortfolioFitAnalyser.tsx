import { useMemo, useState } from 'react';
import type { ScoredMarket, Pillar } from '../../types';
import { PILLARS } from '../../data/metrics';

interface Props {
  markets: ScoredMarket[];
}

const PRESETS: Record<string, Record<Pillar, number>> = {
  'Custom': { Supply: 17, Demand: 17, Connectivity: 17, Labour: 17, 'Rents & Yields': 16, 'Strategic / Risk': 16 },
  'Core logistics': { Supply: 10, Demand: 15, Connectivity: 30, Labour: 15, 'Rents & Yields': 20, 'Strategic / Risk': 10 },
  'Supply-constrained MLI': { Supply: 35, Demand: 15, Connectivity: 15, Labour: 10, 'Rents & Yields': 15, 'Strategic / Risk': 10 },
  'Labour-led occupier': { Supply: 10, Demand: 20, Connectivity: 15, Labour: 35, 'Rents & Yields': 10, 'Strategic / Risk': 10 },
  'Income / yield': { Supply: 10, Demand: 15, Connectivity: 15, Labour: 10, 'Rents & Yields': 35, 'Strategic / Risk': 15 },
  'Defensive / risk-aware': { Supply: 15, Demand: 15, Connectivity: 15, Labour: 15, 'Rents & Yields': 15, 'Strategic / Risk': 25 },
};

export default function PortfolioFitAnalyser({ markets }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string>('Core logistics');
  const [profile, setProfile] = useState<Record<Pillar, number>>(PRESETS['Core logistics']);

  function loadPreset(name: string) {
    setSelectedPreset(name);
    setProfile({ ...PRESETS[name] });
  }

  function adjustWeight(pillar: Pillar, newVal: number) {
    const clamped = Math.max(0, Math.min(100, newVal));
    const delta = clamped - profile[pillar];
    if (Math.abs(delta) < 0.01) return;
    const othersSum = Object.entries(profile).reduce((s, [p, v]) => p === pillar ? s : s + v, 0);
    const next: Record<Pillar, number> = { ...profile, [pillar]: clamped };
    if (othersSum > 0) {
      for (const p of PILLARS) {
        if (p.name === pillar) continue;
        const share = profile[p.name] / othersSum;
        next[p.name] = Math.max(0, profile[p.name] - delta * share);
      }
      // Normalise
      const sum = Object.values(next).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (const p of PILLARS) next[p.name] = (next[p.name] / sum) * 100;
      }
    }
    setProfile(next);
    setSelectedPreset('Custom');
  }

  // Compute fit score per market using the custom weights
  const ranked = useMemo(() => {
    const totalWeight = Object.values(profile).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return [];
    const result = markets.map(m => {
      // Only consider pillars the market has data for; redistribute missing weight
      const activePillars = PILLARS.filter(p => (m.pillarScores[p.name]?.scoredCount ?? 0) > 0);
      const activeWeightSum = activePillars.reduce((s, p) => s + profile[p.name], 0);
      let fitScore = 0;
      if (activeWeightSum > 0) {
        fitScore = activePillars.reduce((sum, p) => {
          const avg = m.pillarScores[p.name]?.score ?? 0;
          return sum + (avg / 5) * (profile[p.name] / activeWeightSum) * 100;
        }, 0);
      }
      return { ...m, fitScore: Math.round(fitScore * 10) / 10 };
    });
    result.sort((a, b) => b.fitScore - a.fitScore);
    return result.map((m, i) => ({ ...m, fitRank: i + 1 }));
  }, [markets, profile]);

  // Top movers vs default scoring
  const movers = useMemo(() => {
    return ranked
      .map(m => ({ ...m, delta: m.rank - m.fitRank }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
  }, [ranked]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Profile config ── */}
      <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5 lg:col-span-1">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">Target profile</h3>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Object.keys(PRESETS).map(name => (
            <button
              key={name}
              onClick={() => loadPreset(name)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                selectedPreset === name ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              style={selectedPreset === name ? { background: '#3B1F6B' } : {}}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Pillar weight sliders */}
        <div className="space-y-3">
          {PILLARS.map(p => {
            const w = profile[p.name];
            return (
              <div key={p.name}>
                <div className="flex justify-between items-center mb-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.colour }} />
                    {p.name}
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{ color: p.colour }}>
                    {w.toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={Math.round(w)}
                  onChange={e => adjustWeight(p.name, Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    accentColor: p.colour,
                    background: `linear-gradient(to right, ${p.colour} ${(w / 60) * 100}%, #e5e7eb ${(w / 60) * 100}%)`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Top movers */}
        {movers.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Biggest movers vs default scoring
            </h4>
            <div className="space-y-1">
              {movers.map(m => (
                <div key={m.market.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-800 truncate">{m.market.name}</span>
                  <span
                    className={`font-bold tabular-nums ${
                      m.delta > 0 ? 'text-green-600' : m.delta < 0 ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {m.delta > 0 ? '▲' : m.delta < 0 ? '▼' : '●'}{Math.abs(m.delta) || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Fit rankings ── */}
      <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden lg:col-span-2">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Top matches for this profile</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Markets ranked by custom-weighted fit score · {ranked.length} markets
          </p>
        </div>
        <div className="overflow-auto" style={{ maxHeight: '55vh' }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-100">
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase w-10">Fit #</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Market</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase w-20">Fit score</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase w-20">Default</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase w-14">Δ</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 25).map((m, i) => {
                const tierColor = m.fitScore >= 80 ? '#15803d' : m.fitScore >= 60 ? '#b45309' : '#b91c1c';
                return (
                  <tr key={m.market.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                    <td className="px-3 py-1.5 text-gray-500 font-mono text-xs">{m.fitRank}</td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-gray-900 text-xs">{m.market.name}</div>
                      <div className="text-[10px] text-gray-400">{m.market.region}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="font-bold text-sm tabular-nums" style={{ color: tierColor }}>
                        {m.fitScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs text-gray-500 tabular-nums">
                      {m.totalScore.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs">
                      {m.delta > 0 && <span className="text-green-600 font-semibold">▲{m.delta}</span>}
                      {m.delta < 0 && <span className="text-red-500 font-semibold">▼{Math.abs(m.delta)}</span>}
                      {m.delta === 0 && <span className="text-gray-300">●</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
