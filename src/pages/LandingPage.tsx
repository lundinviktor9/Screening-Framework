import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Trophy, LayoutDashboard, Map as MapIcon, SlidersHorizontal, PencilLine, Database, GitCompare, Inbox } from 'lucide-react';

import { useMarketStore } from '../store/marketStore';
import { METRICS, PILLARS } from '../data/metrics';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Restrained, brand-family accents (muted purples/teals/slates) — replaces the rainbow.
const PILLAR_ACCENT: Record<string, string> = {
  Supply: '#7D5A7D',
  Demand: '#5A7D6F',
  Connectivity: '#5A6E7D',
  Labour: '#7D6E5A',
  'Rents & Yields': '#6F5A7D',
  'Strategic / Risk': '#7D5A6E',
};

export default function LandingPage() {
  const navigate = useNavigate();
  const markets = useMarketStore((s) => s.markets);
  const getScoredMarkets = useMarketStore((s) => s.getScoredMarkets);
  const masterDataDate = useMarketStore((s) => s.masterDataDate);
  const _tick = useMarketStore((s) => s._lastTick);

  const ranked = useMemo(() => getScoredMarkets(), [markets, _tick]);

  const stats = useMemo(() => {
    const tier1 = ranked.filter((m) => m.totalScore >= 80).length;
    let verified = 0,
      filled = 0;
    for (const m of markets) {
      for (const [idStr, v] of Object.entries(m.values)) {
        if (v === null || v === undefined) continue;
        filled++;
        if (m.sources[Number(idStr)]?.status === 'VERIFIED') verified++;
      }
    }
    return { tier1, verified, filled };
  }, [markets, ranked]);

  const topFive = ranked.slice(0, 5);

  return (
    <div className="min-h-full bg-background">
      {/* Hero */}
      <section className="border-b px-8 pt-10 pb-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Brunswick · Industrial Real Estate
            </span>
            {masterDataDate && <Badge variant="success">Data refreshed {masterDataDate}</Badge>}
          </div>

          <h1 className="mb-3 text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Systematic screening of <span className="text-primary">{markets.length}</span> UK industrial markets.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            A weighted scoring model across <strong className="text-foreground">{PILLARS.length} pillars</strong> and{' '}
            <strong className="text-foreground">{METRICS.length} quantitative metrics</strong>, producing a composite
            0–100 score that surfaces investment-grade targets and flags markets to monitor.
          </p>

          {/* Hero metric cards */}
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Markets screened" value={String(markets.length)} />
            <MetricCard
              label="Tier 1 — Core"
              value={String(stats.tier1)}
              accent
              sub={`of ${ranked.length} (${ranked.length ? Math.round((100 * stats.tier1) / ranked.length) : 0}%)`}
            />
            <MetricCard
              label="Verified data points"
              value={stats.verified.toLocaleString('en-GB')}
              sub={`${stats.filled ? Math.round((100 * stats.verified) / stats.filled) : 0}% of filled cells`}
            />
            <MetricCard label="Metrics tracked" value={String(METRICS.length)} sub={`${PILLARS.length} pillars`} />
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/rankings')}>
              Open Rankings <ArrowRight />
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/map')}>
              Map
            </Button>
            <Button variant="outline" onClick={() => navigate('/sources')}>
              Methodology
            </Button>
          </div>
        </div>
      </section>

      {/* Framework — pillar grid */}
      <section className="px-8 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary">The framework</div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Six pillars. {METRICS.length} metrics. One score.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Every market is scored 1–5 against each metric. Metric scores aggregate to pillar scores; the six
              pillars — equally weighted by default — combine into a composite 0–100 rating classifying each market
              Tier 1 (Core), Tier 2 (Value-add) or Tier 3 (Monitor).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {PILLARS.map((p) => (
              <PillarCard
                key={p.name}
                name={p.name}
                weight={p.totalWeight}
                accent={PILLAR_ACCENT[p.name] || '#7D5A7D'}
                metrics={PILLAR_HIGHLIGHTS[p.name] ?? []}
              />
            ))}
          </div>

          {/* Tier thresholds */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <TierChip label="Tier 1 — Core" range="≥ 80" variant="success" />
            <TierChip label="Tier 2 — Value-add" range="60–79" variant="warning" />
            <TierChip label="Tier 3 — Monitor" range="< 60" variant="danger" />
          </div>
        </div>
      </section>

      {/* Data quality + top 5 */}
      <section className="border-y bg-card/40 px-8 py-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Data provenance</div>
            <h2 className="mb-3 text-xl font-semibold text-foreground">Every number, traceable to source.</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Government APIs (NOMIS, ONS, VOA, Environment Agency, OSRM) take priority. Commercial data (CoStar, MSCI,
              broker reports) is entered with source &amp; date. Regional figures cascade with explicit flagging.
            </p>
            <Button variant="link" className="px-0" onClick={() => navigate('/sources')}>
              See full methodology &amp; source audit <ArrowRight />
            </Button>
          </div>

          <Card className="overflow-hidden lg:col-span-3">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Top 5 — current ranking
                </div>
                <h3 className="text-sm font-semibold text-foreground">Highest composite scores</h3>
              </div>
              <Button variant="link" className="px-0" onClick={() => navigate('/rankings')}>
                View all <ArrowRight />
              </Button>
            </div>
            <table className="w-full">
              <tbody>
                {topFive.map((sm) => {
                  const variant = sm.totalScore >= 80 ? 'text-success' : sm.totalScore >= 60 ? 'text-warning' : 'text-danger';
                  return (
                    <tr
                      key={sm.market.id}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
                      onClick={() => navigate(`/dashboard?market=${sm.market.id}`)}
                    >
                      <td className="w-10 px-5 py-3 font-mono text-xs text-muted-foreground">#{sm.rank}</td>
                      <td className="py-3">
                        <div className="text-sm font-semibold text-foreground">{sm.market.name}</div>
                        <div className="text-[11px] text-muted-foreground">{sm.market.region}</div>
                      </td>
                      <td className="py-3">
                        <div className="flex h-6 items-end gap-0.5">
                          {PILLARS.map((p) => {
                            const score = sm.pillarScores[p.name]?.score ?? 0;
                            return (
                              <div
                                key={p.name}
                                className="flex-1 rounded-sm bg-primary"
                                style={{ height: `${Math.max(2, (score / 5) * 24)}px`, opacity: score > 0 ? 0.4 + (score / 5) * 0.6 : 0.12 }}
                                title={`${p.name}: ${score.toFixed(1)}`}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="w-20 px-5 py-3 text-right">
                        <span className={cn('text-xl font-bold tabular-nums', variant)}>{sm.totalScore.toFixed(1)}</span>
                      </td>
                    </tr>
                  );
                })}
                {topFive.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-center text-xs text-muted-foreground">No markets loaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-8 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Capabilities</div>
            <h2 className="text-xl font-semibold text-foreground">Screen. Compare. Deep-dive. Track.</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Capability icon={Trophy} title="Screen" body="Filter by tier, region, or thesis. Auto-sort by what matters." onClick={() => navigate('/rankings')} />
            <Capability icon={GitCompare} title="Compare" body="Side-by-side up to 5 markets across all metrics." onClick={() => navigate('/compare')} />
            <Capability icon={LayoutDashboard} title="Deep-dive" body="Radar, pillar bars, metric heatmap, portfolio fit." onClick={() => navigate('/dashboard')} />
            <Capability icon={Inbox} title="Pipeline" body="Extract IMs, match markets, export decks." onClick={() => navigate('/pipeline')} />
            <Capability icon={MapIcon} title="Geographic view" body="Interactive map with overlays and radius analysis." onClick={() => navigate('/map')} />
            <Capability icon={SlidersHorizontal} title="Sensitivity" body="Adjust weights live, save scenarios, see movers." onClick={() => navigate('/sensitivity')} />
            <Capability icon={PencilLine} title="Data entry" body="Enter commercial data with validation + source tracking." onClick={() => navigate('/data-entry')} />
            <Capability icon={Database} title="Source audit" body="Methodology, thresholds, provenance of every number." onClick={() => navigate('/sources')} />
          </div>
        </div>
      </section>

      <footer className="border-t px-8 py-6 text-center">
        <div className="mx-auto max-w-6xl text-[11px] text-muted-foreground">
          Brunswick Industrial Screening Framework · {PILLARS.length} pillars · {METRICS.length} metrics ·{' '}
          {markets.length} markets{masterDataDate && ` · Data: ${masterDataDate}`}
        </div>
      </footer>
    </div>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-[22px] font-bold tabular-nums', accent ? 'text-primary' : 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function PillarCard({ name, weight, accent, metrics }: { name: string; weight: number; accent: string; metrics: string[] }) {
  return (
    <Card className="relative overflow-hidden p-4 pt-5 transition-shadow hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="mb-3">
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
          style={{ background: accent + '1f', color: accent }}
        >
          {weight}% weight
        </span>
      </div>
      <h3 className="mb-3 min-h-[2.5rem] text-sm font-semibold leading-tight text-foreground">{name}</h3>
      <ul className="space-y-1.5 text-[11px] text-muted-foreground">
        {metrics.slice(0, 4).map((m) => (
          <li key={m} className="flex items-start gap-1.5 leading-tight">
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
            <span>{m}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TierChip({ label, range, variant }: { label: string; range: string; variant: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
      <Badge variant={variant}>{range}</Badge>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

function Capability({ icon: Icon, title, body, onClick }: { icon: any; title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <div className="mb-1 text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs leading-relaxed text-muted-foreground">{body}</div>
    </button>
  );
}

const PILLAR_HIGHLIGHTS: Record<string, string[]> = {
  Supply: ['Vacancy rate', 'Development pipeline', 'Planning approval', 'MLI concentration'],
  Demand: ['Take-up growth', 'Net absorption', 'SME density', 'Clustering'],
  Connectivity: ['Motorway access', 'Rail / port / airport', 'Drive time to core', 'Grid capacity'],
  Labour: ['30/60-min catchment', 'Unemployment', 'Wages / cost', 'Workforce mix'],
  'Rents & Yields': ['Prime rent', 'Rental growth', 'Prime yield', 'Yield spread'],
  'Strategic / Risk': ['Flood risk', 'Digital infra', 'ESG quality', 'Housing growth'],
};
