import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flame, Target, Scale } from 'lucide-react';
import { useMarketStore } from '../store/marketStore';
import { PILLARS } from '../data/metrics';
import MarketRadar from '../components/dashboard/MarketRadar';
import PillarBarChart from '../components/dashboard/PillarBarChart';
import HeatmapTable from '../components/dashboard/HeatmapTable';
import AllMarketsHeatmap from '../components/dashboard/AllMarketsHeatmap';
import PortfolioFitAnalyser from '../components/dashboard/PortfolioFitAnalyser';
import MarketOverview from '../components/dashboard/MarketOverview';
import RAGBadge from '../components/rankings/RAGBadge';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const COLOURS = ['#7D5A7D', '#5A6E7D', '#5A7D6F', '#7D6E5A', '#6F5A7D', '#7D5A6E'];
const MAX_SELECT = 5;

type ViewMode = 'overview' | 'compare' | 'portfolio';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const _tick = useMarketStore(s => s._lastTick);

  const allMarkets = useMemo(() => getScoredMarkets(), [markets, _tick]);
  const [view, setView] = useState<ViewMode>('overview');
  const [selected, setSelected] = useState<string[]>([]);
  const [chartTab, setChartTab] = useState<'radar' | 'bars' | 'heatmap'>('radar');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || allMarkets.length === 0) return;
    const preselect = searchParams.get('market');
    if (preselect) {
      setSelected([preselect]);
      setView('compare');
    } else {
      setSelected(allMarkets.slice(0, Math.min(3, allMarkets.length)).map(m => m.market.id));
    }
    setInitialized(true);
  }, [allMarkets, initialized, searchParams]);

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < MAX_SELECT
        ? [...prev, id]
        : prev
    );
  }

  const selectedMarkets = allMarkets.filter(m => selected.includes(m.market.id));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analytical views across all markets · {allMarkets.length} markets · {PILLARS.length} pillars
          </p>
        </div>
      </div>

      {/* View switcher */}
      <div className="mb-6 flex flex-wrap gap-2">
        {([
          { key: 'overview' as ViewMode, label: 'All-market heatmap', icon: Flame, sub: 'Scan all markets × all pillars' },
          { key: 'portfolio' as ViewMode, label: 'Portfolio fit', icon: Target, sub: 'Custom-weighted match' },
          { key: 'compare' as ViewMode, label: 'Compare markets', icon: Scale, sub: 'Up to 5 side-by-side' },
        ]).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={cn(
                'rounded-lg border px-4 py-3 text-left transition-all',
                view === t.key
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-foreground hover:border-primary/40'
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" />
                {t.label}
              </div>
              <div className={cn('mt-0.5 text-xs', view === t.key ? 'opacity-80' : 'text-muted-foreground')}>
                {t.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Views */}
      {view === 'overview' && (
        <>
          <MarketOverview markets={allMarkets} />
          <AllMarketsHeatmap markets={allMarkets} />
        </>
      )}
      {view === 'portfolio' && <PortfolioFitAnalyser markets={allMarkets} />}

      {view === 'compare' && (
        <>
          {/* Market selector */}
          <Card className="mb-6 p-5">
            <div className="mb-3 text-sm font-semibold text-foreground">
              Select markets to compare ({selected.length}/{MAX_SELECT})
            </div>
            <div className="flex flex-wrap gap-2">
              {allMarkets.map((sm) => {
                const isSelected = selected.includes(sm.market.id);
                return (
                  <button
                    key={sm.market.id}
                    onClick={() => toggle(sm.market.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                      isSelected ? 'border-transparent text-white' : 'border-border bg-card text-foreground hover:border-primary/40'
                    )}
                    style={isSelected ? { background: COLOURS[selected.indexOf(sm.market.id) % COLOURS.length] } : {}}
                  >
                    <span className="font-mono text-xs opacity-60">#{sm.rank}</span>
                    {sm.market.name}
                    <span className={cn('text-xs font-bold', isSelected ? 'text-white/80' : 'text-muted-foreground')}>
                      {sm.totalScore.toFixed(0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {selectedMarkets.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Select at least one market above.</div>
          ) : (
            <>
              {/* Scorecards */}
              <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(selectedMarkets.length, 3)}, 1fr)` }}>
                {selectedMarkets.map((sm, i) => {
                  const accent = COLOURS[i % COLOURS.length];
                  return (
                    <Card key={sm.market.id} className="p-5" style={{ borderColor: accent + '40' }}>
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <div className="mb-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
                            #{sm.rank} {sm.market.region}
                          </div>
                          <div className="font-semibold text-foreground">{sm.market.name}</div>
                        </div>
                        <RAGBadge rag={sm.rag} />
                      </div>
                      <div
                        className="mb-3 text-4xl font-bold"
                        style={{ color: sm.rag === 'Green' ? '#1B8A5A' : sm.rag === 'Amber' ? '#B7791F' : '#C53030' }}
                      >
                        {sm.totalScore.toFixed(1)}
                        <span className="ml-1 text-base font-normal text-muted-foreground">/ 100</span>
                      </div>
                      <div className="space-y-1.5">
                        {PILLARS.map((p) => (
                          <div key={p.name} className="flex items-center gap-2">
                            <div className="w-24 truncate text-xs text-muted-foreground">{p.name}</div>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${((sm.pillarScores[p.name]?.score ?? 0) / 5) * 100}%`, background: accent }}
                              />
                            </div>
                            <div className="w-6 text-right text-xs font-semibold text-foreground">
                              {(sm.pillarScores[p.name]?.score ?? 0).toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Charts */}
              <Card className="p-5">
                <div className="mb-5 flex gap-1">
                  {(['radar', 'bars', 'heatmap'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartTab(t)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        chartTab === t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {t === 'radar' ? 'Radar' : t === 'bars' ? 'Pillar bars' : 'Heatmap (60 metrics)'}
                    </button>
                  ))}
                </div>

                {chartTab === 'radar' && <MarketRadar markets={selectedMarkets} />}
                {chartTab === 'bars' && <PillarBarChart markets={selectedMarkets} />}
                {chartTab === 'heatmap' && <HeatmapTable markets={selectedMarkets} />}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
