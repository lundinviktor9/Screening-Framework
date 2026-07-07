import { useMemo } from 'react';
import { useMarketStore } from '../store/marketStore';
import { METRICS, PILLARS } from '../data/metrics';
import type { MetricSource } from '../types';
import MethodologySection from '../components/sources/MethodologySection';
import LiveGiltYieldCard from '../components/sources/LiveGiltYieldCard';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/** Unique source key for deduplication */
function sourceKey(s: MetricSource): string {
  return `${s.sourceName}||${s.sourceUrl}||${s.dataDate}`;
}

/**
 * Detect whether a data source date is older than 12 months.
 * Handles many formats that appear in scraper outputs:
 *  - "2025" → treats as Jan 1 of that year
 *  - "2024-01-01", "2024-01" → ISO fragments
 *  - "Jan 2025-Dec 2025" → takes the end year
 *  - "February 2026" → parses as month + year
 *  - "2014 to 2024" → takes the end year
 *  - "2026 to 2031" → future projection → not stale
 */
function isStaleDate(dataDate: string): boolean {
  const yearFromString = (s: string): number | null => {
    const m = s.match(/\b(19|20)\d{2}\b/g);
    if (!m || m.length === 0) return null;
    // If multiple years, take the latest (most recent)
    return Math.max(...m.map(y => parseInt(y, 10)));
  };
  const year = yearFromString(dataDate);
  if (year === null) return false;
  const now = new Date();
  // If data year is current or in the future, not stale
  if (year >= now.getFullYear()) return false;
  // Simple rule: any year >= 12 months ago is stale. For April 2026 app,
  // data from 2024 or earlier counts as stale.
  const yearsBack = now.getFullYear() - year;
  return yearsBack >= 2;
}

interface SourceSummary {
  sourceName: string;
  sourceUrl: string;
  dataDate: string;
  status: string;
  metricIds: Set<number>;
  marketCount: number;
}

export default function DataSourcesPage() {
  const markets = useMarketStore(s => s.markets);
  const masterDataDate = useMarketStore(s => s.masterDataDate);

  // Build a summary of all sources across all markets
  const { byPillar, globalStats } = useMemo(() => {
    // Collect sources per metric across all markets
    const metricSources = new Map<number, Map<string, SourceSummary>>();

    for (const market of markets) {
      for (const [idStr, src] of Object.entries(market.sources)) {
        const metricId = Number(idStr);
        if (!src || !src.sourceName) continue;

        if (!metricSources.has(metricId)) {
          metricSources.set(metricId, new Map());
        }
        const key = sourceKey(src);
        const map = metricSources.get(metricId)!;
        if (!map.has(key)) {
          map.set(key, {
            sourceName: src.sourceName,
            sourceUrl: src.sourceUrl || '',
            dataDate: src.dataDate || '',
            status: src.status || 'ESTIMATED',
            metricIds: new Set([metricId]),
            marketCount: 0,
          });
        }
        map.get(key)!.marketCount++;
      }
    }

    // Organize by pillar
    const byPillar: Record<string, {
      metricId: number;
      metricName: string;
      unit: string;
      sources: SourceSummary[];
      marketsWithData: number;
      marketsTotal: number;
    }[]> = {};

    for (const pillar of PILLARS) {
      const pillarMetrics = METRICS.filter(m => m.pillar === pillar.name);
      byPillar[pillar.name] = pillarMetrics.map(metric => {
        const srcMap = metricSources.get(metric.id);
        const sources = srcMap ? Array.from(srcMap.values()) : [];
        // Sort: VERIFIED first, then by market count
        sources.sort((a, b) => {
          if (a.status === 'VERIFIED' && b.status !== 'VERIFIED') return -1;
          if (b.status === 'VERIFIED' && a.status !== 'VERIFIED') return 1;
          return b.marketCount - a.marketCount;
        });

        const marketsWithData = markets.filter(m => {
          const v = m.values[metric.id];
          return v !== null && v !== undefined;
        }).length;

        return {
          metricId: metric.id,
          metricName: metric.name,
          unit: metric.unit,
          sources,
          marketsWithData,
          marketsTotal: markets.length,
        };
      });
    }

    // Global stats
    const totalMetricsWithData = METRICS.filter(metric =>
      markets.some(m => m.values[metric.id] !== null && m.values[metric.id] !== undefined)
    ).length;

    const uniqueSources = new Set<string>();
    for (const market of markets) {
      for (const src of Object.values(market.sources)) {
        if (src?.sourceName) uniqueSources.add(src.sourceName);
      }
    }

    return {
      byPillar,
      globalStats: {
        metricsWithData: totalMetricsWithData,
        totalMetrics: 60,
        uniqueSources: uniqueSources.size,
        totalMarkets: markets.length,
      },
    };
  }, [markets]);

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Data Sources</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Audit trail for all metric values — every data point is traceable to its source.
          {masterDataDate && <Badge variant="success">Last scraped: {masterDataDate}</Badge>}
        </div>
      </div>

      {/* Newmark source block (attribution + accuracy note) */}
      <Card className="mb-6 px-4 py-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
          Newmark Multi-let Winter Bulletin Q3 2025
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              Regional rents, yields, reversion, vacancy, growth forecast, pipeline
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Source date: 2025-11-01 · Metrics covered: M41, M42, M65, M66, M67, M68, M69, M70, M72
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              Newmark data is used for internal screening purposes only in accordance with professional research use.
              © Newmark Gerald Eve LLP 2025.
            </div>
            <div className="mt-2 inline-block rounded border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] text-warning">
              Values with <strong>~</strong> prefix (vacancy, reversion, pipeline) are chart-approximated from PDF
              diagrams and carry ±2-5 pp. For precise underlying data contact
              <a href="mailto:Steve.Sharman@nmrk.com" className="ml-1 text-primary underline">Steve.Sharman@nmrk.com</a>.
            </div>
          </div>
        </div>
      </Card>

      {/* Methodology — how scores are built */}
      <MethodologySection />

      {/* Live data: UK 10-year gilt yield (below methodology per spec) */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
          Live data feed
        </div>
        <LiveGiltYieldCard />
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Metrics with data', value: `${globalStats.metricsWithData}/${METRICS.length}`, sub: 'at least 1 market' },
          { label: 'Unique sources', value: String(globalStats.uniqueSources), sub: 'across all markets' },
          { label: 'Markets', value: String(globalStats.totalMarkets), sub: 'in framework' },
          { label: 'Scraper coverage', value: 'M22-25, M33, M35-36, M40, M58, M61-64', sub: 'automated via API + VOA' },
        ].map(c => (
          <Card key={c.label} className="px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-0.5 text-lg font-bold text-foreground">{c.value}</div>
            <div className="text-[10px] text-muted-foreground">{c.sub}</div>
          </Card>
        ))}
      </div>

      {/* Pillar sections */}
      {PILLARS.map(pillar => {
        const metrics = byPillar[pillar.name] || [];
        const filledCount = metrics.filter(m => m.marketsWithData > 0).length;

        return (
          <div key={pillar.name} className="mb-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: pillar.colour }} />
              <h2 className="text-base font-semibold text-foreground">{pillar.name}</h2>
              <span className="text-xs text-muted-foreground">
                {filledCount}/{metrics.length} metrics have data · {pillar.totalWeight} pts weight
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Metric</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Source</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-24">Data date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-20">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-24">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(metric => {
                    const primary = metric.sources[0];
                    const hasData = metric.marketsWithData > 0;
                    const coveragePct = Math.round((metric.marketsWithData / metric.marketsTotal) * 100);

                    return (
                      <tr key={metric.metricId} className={`border-b border-gray-50 ${hasData ? '' : 'opacity-50'}`}>
                        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                          M{metric.metricId}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800">{metric.metricName}</div>
                          <div className="text-[11px] text-gray-400">{metric.unit}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {primary ? (
                            <div>
                              {primary.sourceUrl ? (
                                <a
                                  href={primary.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-600 hover:text-purple-800 hover:underline font-medium text-xs"
                                >
                                  {primary.sourceName}
                                </a>
                              ) : (
                                <span className="text-xs font-medium text-gray-700">{primary.sourceName}</span>
                              )}
                              {metric.sources.length > 1 && (
                                <span className="text-[10px] text-gray-400 ml-1">
                                  +{metric.sources.length - 1} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No source — manual entry needed</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {primary?.dataDate ? (
                            (() => {
                              const stale = isStaleDate(primary.dataDate);
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span className={stale ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                                    {primary.dataDate}
                                  </span>
                                  {stale && (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 w-fit"
                                      title={`Data is older than 12 months — consider refreshing`}
                                    >
                                      ⚠ Stale
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {primary ? (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                              primary.status === 'VERIFIED'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : primary.status === 'REGIONAL_PROXY'
                                ? 'bg-gray-50 text-gray-600 border-gray-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {primary.status === 'VERIFIED' ? 'Verified' :
                               primary.status === 'REGIONAL_PROXY' ? 'Regional' : 'Estimated'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-gray-400">Missing</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`text-xs font-semibold tabular-nums ${
                              coveragePct >= 80 ? 'text-green-600' :
                              coveragePct >= 40 ? 'text-amber-600' :
                              coveragePct > 0 ? 'text-red-600' : 'text-gray-300'
                            }`}>
                              {metric.marketsWithData}/{metric.marketsTotal}
                            </span>
                            <div className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${coveragePct}%`,
                                  background: coveragePct >= 80 ? '#15803d' :
                                             coveragePct >= 40 ? '#b45309' :
                                             coveragePct > 0 ? '#dc2626' : '#d1d5db',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div className="mt-8 text-xs text-gray-400 border-t border-gray-100 pt-4">
        <p className="mb-2 font-semibold text-gray-500">Source hierarchy (highest priority first):</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li><span className="text-green-600 font-semibold">Verified</span> — Government API (NOMIS, ONS, VOA, Environment Agency)</li>
          <li><span className="text-amber-600 font-semibold">Estimated</span> — Manual entry with primary source cited (CoStar, MSCI)</li>
          <li><span className="text-amber-600 font-semibold">Estimated</span> — PDF or HTML scrape with source URL stored</li>
          <li><span className="text-gray-500 font-semibold">Regional proxy</span> — Regional figure cascaded to market level</li>
          <li><span className="text-gray-400 font-semibold">Missing</span> — No data, excluded from scoring</li>
        </ol>
      </div>
    </div>
  );
}
