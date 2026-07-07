import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import { METRICS, PILLARS } from '../data/metrics';
import { formatMetricValue } from '../utils/formatting';
import type { ScoredMarket } from '../types';

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .print-page { box-shadow: none !important; border: none !important; }
  }
`;

const TIER_STYLE = {
  Green: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: 'Tier 1 — Core target' },
  Amber: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', label: 'Tier 2 — Value-add' },
  Red:   { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', label: 'Tier 3 — Monitor' },
};

// Marquee metric IDs per pillar, shown up front on the one-pager
const KEY_METRICS: Record<string, number[]> = {
  Supply:             [1, 3, 63],
  Demand:             [11, 13, 15],
  Connectivity:       [22, 23, 24],
  Labour:             [31, 32, 36],
  'Rents & Yields':   [41, 44, 47],
  'Strategic / Risk': [56, 58, 60],
};

export default function MarketPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const masterDataDate = useMarketStore(s => s.masterDataDate);
  const _tick = useMarketStore(s => s._lastTick);

  const ranked = useMemo(() => getScoredMarkets(), [markets, _tick]);
  const sm = ranked.find(m => m.market.id === id);

  // Inject print styles once
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!sm) {
    return (
      <div className="p-8 text-center text-gray-500">
        Market not found.{' '}
        <button onClick={() => navigate('/rankings')} className="text-purple-600 underline">
          Back to Rankings
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen py-6 print:bg-white print:py-0">
      {/* Toolbar (hidden in print) */}
      <div className="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between px-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#3B1F6B' }}
          >
            🖨 Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable page */}
      <div
        className="print-page max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-10 print:shadow-none print:rounded-none print:p-0"
        style={{ minHeight: '29.7cm', width: '21cm' }}
      >
        <OnePager sm={sm} totalCount={ranked.length} masterDataDate={masterDataDate} />
      </div>
    </div>
  );
}

function OnePager({
  sm, totalCount, masterDataDate,
}: { sm: ScoredMarket; totalCount: number; masterDataDate: string | null }) {
  const tier = TIER_STYLE[sm.rag];

  // Top/bottom metrics by score (only scored ones)
  const metricEntries = Object.entries(sm.pillarScores).flatMap(([, ps]) =>
    Object.entries(ps.metricScores).map(([mid, score]) => {
      const mdef = METRICS.find(x => x.id === Number(mid));
      return { id: Number(mid), score, name: mdef?.name ?? `M${mid}`, pillar: mdef?.pillar ?? '' };
    }),
  ).filter(m => m.score > 0);
  metricEntries.sort((a, b) => b.score - a.score);
  const top5 = metricEntries.slice(0, 5);
  const bottom5 = [...metricEntries].reverse().slice(0, 5);

  // Completeness
  const filled = Object.values(sm.market.values).filter(v => v !== null && v !== undefined).length;
  const completenessPct = Math.round((filled / METRICS.length) * 100);

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b-2" style={{ borderColor: '#3B1F6B' }}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
            Brunswick Industrial Screening · Market One-Pager
          </div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">{sm.market.name}</h1>
          <div className="text-sm text-gray-500 mt-1">
            {sm.market.region} · Rank #{sm.rank} of {totalCount}
          </div>
        </div>
        <div
          className="rounded-lg px-5 py-3 text-center flex-shrink-0"
          style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
        >
          <div className="text-4xl font-extrabold" style={{ color: tier.text }}>
            {sm.totalScore.toFixed(1)}
          </div>
          <div className="text-[10px] font-bold mt-0.5 uppercase tracking-wide" style={{ color: tier.text }}>
            {tier.label}
          </div>
        </div>
      </div>

      {/* Pillar scores */}
      <section className="mt-5">
        <SectionTitle>Pillar scores</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2">
          {PILLARS.map(p => {
            const ps = sm.pillarScores[p.name];
            const score = ps?.score ?? 0;
            const count = ps?.scoredCount ?? 0;
            const total = ps?.totalCount ?? 0;
            const pct = Math.min(100, (score / 5) * 100);
            return (
              <div key={p.name}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-semibold text-gray-700">{p.name}</span>
                  <span className="font-mono">
                    <span className="font-bold" style={{ color: p.colour }}>{score.toFixed(2)}</span>
                    <span className="text-gray-400"> / 5 · {count}/{total} metrics</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.colour }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Strengths / gaps */}
      <section className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <SectionTitle>▲ Top strengths</SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {top5.map(m => (
              <li key={m.id} className="flex items-baseline justify-between text-xs border-b border-gray-100 pb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-gray-400">M{m.id} · {m.pillar}</div>
                </div>
                <span className="font-bold text-green-700 tabular-nums ml-2">{m.score}/5</span>
              </li>
            ))}
            {top5.length === 0 && <li className="text-xs text-gray-400 italic">No scored metrics</li>}
          </ul>
        </div>
        <div>
          <SectionTitle>▼ Top gaps</SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {bottom5.map(m => (
              <li key={m.id} className="flex items-baseline justify-between text-xs border-b border-gray-100 pb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-gray-400">M{m.id} · {m.pillar}</div>
                </div>
                <span className="font-bold text-red-700 tabular-nums ml-2">{m.score}/5</span>
              </li>
            ))}
            {bottom5.length === 0 && <li className="text-xs text-gray-400 italic">No scored metrics</li>}
          </ul>
        </div>
      </section>

      {/* Key metrics per pillar */}
      <section className="mt-5">
        <SectionTitle>Marquee metrics</SectionTitle>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {PILLARS.map(p => {
            const ids = KEY_METRICS[p.name] ?? [];
            return (
              <div key={p.name} className="border border-gray-200 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-100">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.colour }} />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: p.colour }}>
                    {p.name}
                  </span>
                </div>
                <ul className="space-y-1">
                  {ids.map(mid => {
                    const metric = METRICS.find(m => m.id === mid);
                    if (!metric) return null;
                    const v = sm.market.values[mid];
                    return (
                      <li key={mid} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="text-gray-500 truncate" title={metric.name}>
                          {metric.name}
                        </span>
                        <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                          {v !== null && v !== undefined ? formatMetricValue(v, metric.unit) : '—'}
                          <span className="text-[9px] text-gray-400 ml-0.5">{metric.unit}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Notes */}
      {(sm.market.notes || sm.market.internalNotes) && (
        <section className="mt-5">
          <SectionTitle>Notes</SectionTitle>
          {sm.market.notes && (
            <p className="mt-1 text-xs text-gray-600 leading-relaxed">{sm.market.notes}</p>
          )}
          {sm.market.internalNotes && (
            <div className="mt-2 p-2 rounded border border-purple-100 bg-purple-50/30 text-xs text-gray-700">
              <span className="text-[9px] font-bold uppercase tracking-wide text-purple-700 block mb-0.5">
                Internal pipeline notes
              </span>
              {sm.market.internalNotes}
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-6 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400">
        <div>
          Data completeness: <strong className="text-gray-600">{filled}/{METRICS.length}</strong> ({completenessPct}%)
          {sm.market.pipelineStatus && sm.market.pipelineStatus !== 'untracked' && (
            <span className="ml-3">
              Pipeline: <strong className="text-gray-600 uppercase">{sm.market.pipelineStatus}</strong>
            </span>
          )}
        </div>
        <div>
          Generated {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          {masterDataDate && ` · Data source: ${masterDataDate}`}
        </div>
      </footer>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 pb-1">
      {children}
    </h2>
  );
}
