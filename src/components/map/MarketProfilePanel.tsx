import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { ScoredMarket, Pillar } from '../../types';
import { PILLARS, METRICS } from '../../data/metrics';
import { formatCompact } from '../../utils/formatting';

interface Props {
  market: ScoredMarket | null;
  totalCount: number;
  onClose: () => void;
}

const TIER_STYLE = {
  Green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: 'Tier 1 — Core' },
  Amber:  { bg: '#fffbeb', border: '#fde68a', text: '#b45309', label: 'Tier 2 — Value-add' },
  Red:    { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', label: 'Tier 3 — Monitor' },
};

function pillarBarColor(score: number): string {
  if (score >= 3.5) return '#22c55e';
  if (score >= 2.5) return '#f59e0b';
  return '#ef4444';
}

function scoreColour(score: number): string {
  if (score >= 4) return '#15803d';
  if (score >= 3) return '#b45309';
  if (score > 0) return '#b91c1c';
  return '#9ca3af';
}

export default function MarketProfilePanel({ market, totalCount, onClose }: Props) {
  const navigate = useNavigate();
  // Track which pillars are expanded (default: all collapsed, one-at-a-time feel)
  const [openPillars, setOpenPillars] = useState<Set<Pillar>>(new Set());

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 select-none px-6 text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="text-sm font-medium">Click a market on the map</p>
        <p className="text-xs mt-1">to see its profile here</p>
      </div>
    );
  }

  const tier = TIER_STYLE[market.rag];
  const pillarEntries = PILLARS.map(p => ({
    name: p.name,
    colour: p.colour,
    score: market.pillarScores[p.name]?.score ?? 0,
    count: market.pillarScores[p.name]?.scoredCount ?? 0,
    total: market.pillarScores[p.name]?.totalCount ?? 0,
  }));

  function togglePillar(name: Pillar) {
    setOpenPillars(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900 leading-snug">{market.market.name}</h2>
          <span className="inline-block text-xs font-medium px-2 py-0.5 mt-1 rounded-full bg-gray-100 text-gray-600">
            {market.market.region}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5 ml-3 flex-shrink-0"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Score card */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div
          className="rounded-xl px-5 py-3 flex-shrink-0 text-center"
          style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
        >
          <div className="text-3xl font-extrabold" style={{ color: tier.text }}>
            {market.totalScore}
          </div>
          <div className="text-xs font-medium mt-0.5" style={{ color: tier.text }}>/ 100</div>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-bold px-2 py-0.5 rounded-full mb-1 inline-block"
            style={{ background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}
          >
            {tier.label}
          </div>
          <div className="text-xs text-gray-500">
            Rank <span className="font-bold text-gray-800">#{market.rank}</span> of {totalCount}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {market.market.isPreFilled ? 'Pre-filled dataset' : 'Custom market'}
          </div>
        </div>
      </div>

      {/* Pillar bars */}
      <div className="px-5 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Pillar summary</p>
        <div className="space-y-2">
          {pillarEntries.map(({ name, colour, score, count, total }) => {
            const pct = Math.min(100, (score / 5) * 100);
            const barColour = pillarBarColor(score);
            return (
              <div key={name}>
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span className="font-medium truncate flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: colour }} />
                    {name}
                  </span>
                  <span className="font-mono tabular-nums ml-2">
                    <span className="font-bold" style={{ color: barColour }}>{score.toFixed(2)}</span>
                    <span className="text-gray-400 text-[10px]"> · {count}/{total}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: barColour }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw metric data — collapsible pillar accordions */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Underlying data</p>
          <div className="flex gap-2">
            <button
              onClick={() => setOpenPillars(new Set(PILLARS.map(p => p.name)))}
              className="text-[10px] text-purple-600 hover:text-purple-800 underline"
            >
              Expand all
            </button>
            <button
              onClick={() => setOpenPillars(new Set())}
              className="text-[10px] text-gray-500 hover:text-gray-700 underline"
            >
              Collapse
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {PILLARS.map(p => {
            const metrics = METRICS.filter(m => m.pillar === p.name);
            const isOpen = openPillars.has(p.name);
            const ps = market.pillarScores[p.name];
            const filled = ps?.scoredCount ?? 0;

            return (
              <div key={p.name} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => togglePillar(p.name)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  style={{ background: isOpen ? p.colour + '10' : 'transparent' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.colour }} />
                    <span className="text-xs font-bold text-gray-800">{p.name}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {filled}/{metrics.length}
                    </span>
                  </div>
                  <span className={`text-[10px] text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                </button>

                {isOpen && (
                  <table className="w-full text-[11px] border-t border-gray-100">
                    <tbody>
                      {metrics.map(metric => {
                        const v = market.market.values[metric.id];
                        const s = ps?.metricScores[metric.id] ?? 0;
                        const hasData = v !== null && v !== undefined;
                        const src = market.market.sources[metric.id];
                        return (
                          <tr key={metric.id} className="border-b border-gray-50 last:border-0">
                            <td className="px-2 py-1 text-[10px] text-gray-400 font-mono w-8">M{metric.id}</td>
                            <td className="px-1 py-1">
                              <div className="text-[11px] text-gray-700 leading-tight">{metric.name}</div>
                              {src?.status && (
                                <div className="text-[9px] text-gray-400 mt-0.5">
                                  {src.status}{src.dataDate ? ` · ${src.dataDate}` : ''}
                                </div>
                              )}
                            </td>
                            <td
                              className="px-2 py-1 text-right text-[10px] font-mono text-gray-700 tabular-nums whitespace-nowrap"
                              title={metric.unit}
                            >
                              {hasData ? formatCompact(v, metric.unit) : <span className="text-gray-300">—</span>}
                            </td>
                            <td
                              className="px-2 py-1 text-right text-xs font-bold tabular-nums w-8"
                              style={{ color: scoreColour(s) }}
                            >
                              {s > 0 ? s : '–'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      {market.market.notes && (
        <div className="px-5 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</p>
          <p className="text-xs text-gray-600 leading-relaxed">{market.market.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-5 pb-5 pt-3 border-t border-gray-100 flex flex-col gap-2">
        <button
          onClick={() => navigate(`/dashboard?market=${market.market.id}`)}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#3B1F6B' }}
        >
          Open in Dashboard
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => window.open(`/market/${market.market.id}/print`, '_blank')}
            className="py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            🖨 One-pager
          </button>
          <button
            onClick={() => navigate(`/edit/${market.market.id}`)}
            className="py-2 rounded-lg text-xs font-medium border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
