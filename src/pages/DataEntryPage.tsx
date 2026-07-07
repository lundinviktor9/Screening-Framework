import { useState, useMemo } from 'react';
import { useMarketStore } from '../store/marketStore';
import { METRICS, PILLARS } from '../data/metrics';
import { scoreMetric } from '../utils/scoring';
import type { MetricSource, MetricDef } from '../types';
import DataEntryFilters, { type QuickFilter } from '../components/dataentry/DataEntryFilters';
import MetricEntryRow from '../components/dataentry/MetricEntryRow';
import { toast } from '@/components/ui/sonner';

export default function DataEntryPage() {
  const markets = useMarketStore(s => s.markets);
  const updateMetricValue = useMarketStore(s => s.updateMetricValue);
  const cascadeRegionalProxy = useMarketStore(s => s.cascadeRegionalProxy);

  const [selectedMarketId, setSelectedMarketId] = useState(markets[0]?.id ?? '');
  const [pillarFilter, setPillarFilter] = useState('All');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PILLARS.forEach((p, i) => { init[p.name] = i === 0; });
    return init;
  });

  const selectedMarket = useMemo(
    () => markets.find(m => m.id === selectedMarketId),
    [markets, selectedMarketId],
  );

  // Count markets per region for cascade info
  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of markets) {
      counts.set(m.region, (counts.get(m.region) || 0) + 1);
    }
    return counts;
  }, [markets]);

  // Data completeness for selected market
  const completeness = useMemo(() => {
    if (!selectedMarket) return { filled: 0, total: METRICS.length };
    let filled = 0;
    for (const metric of METRICS) {
      const val = selectedMarket.values[metric.id];
      if (val !== null && val !== undefined) {
        const status = selectedMarket.sources[metric.id]?.status;
        if (!status || status !== 'REVIEW_NEEDED') filled++;
      }
    }
    return { filled, total: METRICS.length };
  }, [selectedMarket]);

  // Filter metrics
  function filterMetrics(metrics: MetricDef[]): MetricDef[] {
    if (!selectedMarket) return metrics;

    return metrics.filter(m => {
      if (quickFilter === 'missing') {
        const val = selectedMarket.values[m.id];
        return val === null || val === undefined;
      }
      if (quickFilter === 'review_needed') {
        return selectedMarket.sources[m.id]?.status === 'REVIEW_NEEDED';
      }
      return true;
    });
  }

  function togglePillar(name: string) {
    setExpandedPillars(p => ({ ...p, [name]: !p[name] }));
  }

  function handleSave(metricId: number, value: number | null, source: MetricSource) {
    if (!selectedMarket) return;
    updateMetricValue(selectedMarket.id, metricId, value, source);
    const metric = METRICS.find((m) => m.id === metricId);
    toast.success(`Saved ${metric?.name ?? `M${metricId}`}`);
  }

  function handleCascade(
    metricId: number,
    value: number | null,
    source: Omit<MetricSource, 'status' | 'geographicLevel' | 'confidence' | 'regionalSourceMarketId'>,
  ) {
    if (!selectedMarket) return;
    cascadeRegionalProxy(selectedMarket.id, selectedMarket.region, metricId, value, source);
  }

  // Pillar-level score preview
  function pillarScore(pillarName: string): number {
    if (!selectedMarket) return 0;
    const pillarMetrics = METRICS.filter(m => m.pillar === pillarName);
    const scores: number[] = [];
    for (const m of pillarMetrics) {
      const raw = selectedMarket.values[m.id];
      if (raw !== null && raw !== undefined) {
        const st = selectedMarket.sources[m.id]?.status;
        if (st !== 'REVIEW_NEEDED') {
          scores.push(scoreMetric(m.id, raw));
        }
      }
    }
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  const filteredPillars = pillarFilter === 'All'
    ? PILLARS
    : PILLARS.filter(p => p.name === pillarFilter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b bg-card px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Data Entry</h1>
          <p className="text-xs text-muted-foreground">
            Enter and manage metric values with source verification
          </p>
        </div>
        {selectedMarket && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {completeness.filled}/{completeness.total} metrics populated
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(completeness.filled / completeness.total) * 100}%`,
                  background: completeness.filled / completeness.total >= 0.4 ? '#1B8A5A' : '#C53030',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <DataEntryFilters
          markets={markets}
          selectedMarketId={selectedMarketId}
          onMarketChange={setSelectedMarketId}
          pillarFilter={pillarFilter}
          onPillarChange={setPillarFilter}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
        />
      </div>

      {/* Pillar accordions */}
      <div className="flex-1 overflow-auto">
        {!selectedMarket ? (
          <div className="text-center py-16 text-gray-400">Select a market to begin data entry.</div>
        ) : (
          <div className="space-y-2 p-4">
            {filteredPillars.map(pillarDef => {
              const allPillarMetrics = METRICS.filter(m => m.pillar === pillarDef.name);
              const visibleMetrics = filterMetrics(allPillarMetrics);
              const isOpen = expandedPillars[pillarDef.name];
              const avg = pillarScore(pillarDef.name);
              const filledCount = allPillarMetrics.filter(m => {
                const v = selectedMarket.values[m.id];
                return v !== null && v !== undefined;
              }).length;

              if (visibleMetrics.length === 0 && quickFilter !== 'all') return null;

              return (
                <div key={pillarDef.name} className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
                  {/* Pillar header */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-purple-50/50 transition-colors"
                    onClick={() => togglePillar(pillarDef.name)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: pillarDef.colour }} />
                      <span className="font-semibold text-gray-800">{pillarDef.name}</span>
                      <span className="text-xs text-gray-400">
                        {filledCount}/{allPillarMetrics.length} filled · {pillarDef.totalWeight} pts
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${avg >= 4 ? 'text-green-600' : avg >= 3 ? 'text-amber-600' : avg > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                        {avg > 0 ? `${avg.toFixed(2)} / 5.0` : '–'}
                      </span>
                      <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-purple-50">
                      {visibleMetrics.length === 0 ? (
                        <div className="px-5 py-4 text-sm text-gray-400 text-center">
                          No metrics match the current filter.
                        </div>
                      ) : (
                        visibleMetrics.map(metric => (
                          <MetricEntryRow
                            key={metric.id}
                            metric={metric}
                            value={selectedMarket.values[metric.id] ?? null}
                            source={selectedMarket.sources[metric.id]}
                            onSave={(val, src) => handleSave(metric.id, val, src)}
                            onCascade={(val, src) => handleCascade(metric.id, val, src)}
                            regionMarketCount={regionCounts.get(selectedMarket.region) || 1}
                            regionName={selectedMarket.region}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
