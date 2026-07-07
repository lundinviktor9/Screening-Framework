import { useMemo, useState, useEffect } from 'react';
import { useMarketStore } from '../../store/marketStore';
import { rankMarkets } from '../../utils/scoring';
import type { ScoredMarket } from '../../types';

export function BiggestMovers() {
  const markets = useMarketStore(s => s.markets);
  const currentScenario = useMarketStore(s => s.currentScenario);
  const _tick = useMarketStore(s => s._lastTick);
  const [debouncedScenario, setDebouncedScenario] = useState(currentScenario);

  // Debounce scenario changes by 150ms to avoid excessive recalculation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScenario(currentScenario);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentScenario]);

  // Compute scorable markets (exclude REVIEW_NEEDED values)
  const scorableMarkets = useMemo(() => {
    return markets.map(m => {
      const values = { ...m.values };
      for (const key of Object.keys(m.sources)) {
        const id = Number(key);
        if (m.sources[id]?.status === 'REVIEW_NEEDED') {
          values[id] = null;
        }
      }
      return { ...m, values };
    });
  }, [markets]);

  // Current ranking (with debounced scenario)
  const currentRanked = useMemo(() => {
    return rankMarkets(scorableMarkets, debouncedScenario);
  }, [scorableMarkets, debouncedScenario, _tick]);

  // Default ranking (no scenario)
  const defaultRanked = useMemo(() => {
    return rankMarkets(scorableMarkets);
  }, [scorableMarkets, _tick]);

  // Create rank lookup and score lookup
  const defaultRankMap: Record<string, number> = {};
  const defaultScoreMap: Record<string, number> = {};
  defaultRanked.forEach(m => {
    defaultRankMap[m.market.id] = m.rank;
    defaultScoreMap[m.market.id] = m.totalScore;
  });

  // Calculate movers (rank shift of 2+ ranks)
  const movers = useMemo(() => {
    return currentRanked
      .map(m => {
        const defaultRank = defaultRankMap[m.market.id] ?? m.rank;
        const defaultScore = defaultScoreMap[m.market.id] ?? m.totalScore;
        const rankShift = defaultRank - m.rank;
        const scoreChange = m.totalScore - defaultScore;

        return {
          market: m.market,
          currentRank: m.rank,
          defaultRank,
          currentScore: m.totalScore,
          scoreChange,
          rankShift,
        };
      })
      .filter(m => Math.abs(m.rankShift) >= 2);
  }, [currentRanked, defaultRankMap, defaultScoreMap]);

  // Separate into risers and fallers
  const risers = movers.filter(m => m.rankShift > 0).slice(0, 5);
  const fallers = movers.filter(m => m.rankShift < 0).slice(0, 5);

  const hasMovement = risers.length > 0 || fallers.length > 0;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Biggest movers vs default
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Markets with rank shifts of 2+ positions</p>
      </div>

      {!hasMovement && (
        <div className="rounded-lg border bg-card px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No significant movement from default</p>
        </div>
      )}

      {hasMovement && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Risers */}
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b bg-success/10 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-success">▲ Risers ({risers.length})</h3>
            </div>
            <div className="divide-y">
              {risers.map((m) => (
                <div key={m.market.id} className="px-4 py-2.5 transition-colors hover:bg-success/5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{m.market.name}</span>
                    <span className="text-xs font-semibold tabular-nums text-success">
                      #{m.currentRank} <span className="text-muted-foreground">(was #{m.defaultRank})</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Score: {m.currentScore.toFixed(1)}{' '}
                    <span className="font-medium text-success">+{m.scoreChange.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fallers */}
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b bg-danger/10 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-danger">▼ Fallers ({fallers.length})</h3>
            </div>
            <div className="divide-y">
              {fallers.map((m) => (
                <div key={m.market.id} className="px-4 py-2.5 transition-colors hover:bg-danger/5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{m.market.name}</span>
                    <span className="text-xs font-semibold tabular-nums text-danger">
                      #{m.currentRank} <span className="text-muted-foreground">(was #{m.defaultRank})</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Score: {m.currentScore.toFixed(1)}{' '}
                    <span className="font-medium text-danger">{m.scoreChange.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
