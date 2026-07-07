import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import { METRICS, PILLARS } from '../data/metrics';
import { scoreMetric } from '../utils/scoring';
import { formatMetricValue } from '../utils/formatting';
import type { ScoredMarket, Pillar } from '../types';

const COLOURS = ['#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626'];

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const _tick = useMarketStore(s => s._lastTick);
  const ranked = useMemo(() => getScoredMarkets(), [markets, _tick]);

  const ids = (searchParams.get('markets') || '').split(',').filter(Boolean);
  const selected: ScoredMarket[] = ids
    .map(id => ranked.find(m => m.market.id === id))
    .filter((m): m is ScoredMarket => !!m);

  if (selected.length < 2) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Select at least 2 markets to compare.</p>
        <button
          onClick={() => navigate('/rankings')}
          className="px-4 py-2 rounded-lg text-white font-medium"
          style={{ background: '#3B1F6B' }}
        >
          Back to Rankings
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Comparison</h1>
          <p className="text-gray-500 text-sm mt-1">
            Side-by-side view of {selected.length} markets across all {METRICS.length} metrics
          </p>
        </div>
        <button
          onClick={() => navigate('/rankings')}
          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50"
        >
          ← Back to Rankings
        </button>
      </div>

      {/* Score headers */}
      <div className="rounded-xl border border-purple-100 shadow-sm overflow-hidden mb-6">
        <div
          className="grid"
          style={{ gridTemplateColumns: `220px repeat(${selected.length}, 1fr)` }}
        >
          {/* Header row */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3"></div>
          {selected.map((sm, i) => (
            <div
              key={sm.market.id}
              className="border-b border-gray-200 px-4 py-3 border-l"
              style={{ background: COLOURS[i % COLOURS.length] + '10' }}
            >
              <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: COLOURS[i % COLOURS.length] }}>
                #{sm.rank} {sm.market.region}
              </div>
              <div className="font-bold text-gray-900">{sm.market.name}</div>
            </div>
          ))}

          {/* Total score */}
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 font-semibold text-sm text-gray-700">
            Total Score
          </div>
          {selected.map((sm, i) => {
            const colour = sm.rag === 'Green' ? '#15803d' : sm.rag === 'Amber' ? '#b45309' : '#b91c1c';
            return (
              <div key={sm.market.id} className="border-b border-gray-100 px-4 py-3 border-l bg-white">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" style={{ color: colour }}>
                    {sm.totalScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">/ 100</span>
                </div>
                <div className="text-xs font-medium" style={{ color: colour }}>Tier {sm.rag === 'Green' ? '1' : sm.rag === 'Amber' ? '2' : '3'} · {sm.rag}</div>
              </div>
            );
          })}

          {/* Pillar rows */}
          {PILLARS.map(pillar => (
            <PillarRow
              key={pillar.name}
              pillarName={pillar.name}
              colour={pillar.colour}
              selected={selected}
            />
          ))}
        </div>
      </div>

      {/* Full metric breakdown */}
      <div className="rounded-xl border border-purple-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700 text-sm">All 60 metrics</h2>
        </div>
        {PILLARS.map(pillar => (
          <PillarMetricsBlock
            key={pillar.name}
            pillarName={pillar.name}
            colour={pillar.colour}
            selected={selected}
          />
        ))}
      </div>
    </div>
  );
}

function PillarRow({
  pillarName, colour, selected,
}: { pillarName: Pillar; colour: string; selected: ScoredMarket[] }) {
  // Find which market scores highest on this pillar for highlighting
  const scores = selected.map(sm => sm.pillarScores[pillarName]?.score ?? 0);
  const maxScore = Math.max(...scores);

  return (
    <>
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full" style={{ background: colour }} />
        <span className="font-medium text-gray-700">{pillarName}</span>
      </div>
      {selected.map((sm, i) => {
        const ps = sm.pillarScores[pillarName];
        const score = ps?.score ?? 0;
        const count = ps?.scoredCount ?? 0;
        const isWinner = count > 0 && Math.abs(score - maxScore) < 0.01 && maxScore > 0;
        return (
          <div
            key={sm.market.id}
            className={`border-b border-gray-100 px-4 py-2.5 border-l flex items-center justify-between ${
              isWinner ? 'bg-green-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
            }`}
          >
            <div className="flex-1">
              {count === 0 ? (
                <span className="text-xs text-gray-400">No data</span>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{score.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400">/ 5</span>
                    {isWinner && <span className="text-[10px] font-semibold text-green-600 uppercase">Best</span>}
                  </div>
                  <div className="text-[10px] text-gray-400">{count}/{ps?.totalCount} metrics</div>
                </>
              )}
            </div>
            <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(score / 5) * 100}%`, background: colour }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

function PillarMetricsBlock({
  pillarName, colour, selected,
}: { pillarName: Pillar; colour: string; selected: ScoredMarket[] }) {
  const metrics = METRICS.filter(m => m.pillar === pillarName);
  return (
    <div>
      <div
        className="px-4 py-2 flex items-center gap-2 text-sm font-semibold text-gray-700"
        style={{ background: colour + '10' }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: colour }} />
        {pillarName}
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: `220px repeat(${selected.length}, 1fr)` }}
      >
        {metrics.map(metric => {
          // Find best performer for highlighting
          const values = selected.map(sm => sm.market.values[metric.id]);
          const scores = values.map(v => v !== null && v !== undefined ? scoreMetric(metric.id, v) : null);
          const nonNullScores = scores.filter((s): s is number => s !== null);
          const maxScore = nonNullScores.length > 0 ? Math.max(...nonNullScores) : 0;

          return (
            <>
              <div
                key={`${metric.id}-label`}
                className="border-b border-gray-50 px-4 py-2 text-xs bg-gray-50/40"
              >
                <div className="text-gray-700">M{metric.id} {metric.name}</div>
                <div className="text-[10px] text-gray-400">{metric.unit}</div>
              </div>
              {selected.map((sm, i) => {
                const v = sm.market.values[metric.id];
                const s = scores[i];
                const hasData = v !== null && v !== undefined;
                const isWinner = hasData && s !== null && Math.abs(s - maxScore) < 0.01 && maxScore > 0;
                return (
                  <div
                    key={`${metric.id}-${sm.market.id}`}
                    className={`border-b border-gray-50 px-4 py-2 text-xs border-l ${
                      isWinner ? 'bg-green-50/50' : 'bg-white'
                    }`}
                  >
                    {hasData ? (
                      <>
                        <span className="font-mono text-gray-800">{formatMetricValue(v, metric.unit)}</span>
                        {s !== null && (
                          <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            s >= 4 ? 'bg-green-100 text-green-700' :
                            s >= 3 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {s}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                );
              })}
            </>
          );
        })}
      </div>
    </div>
  );
}

