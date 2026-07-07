import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Pencil, Trash2 } from 'lucide-react';

import type { ScoredMarket, PillarScore, Pillar } from '../../types';
import { PILLARS, METRICS } from '../../data/metrics';
import { formatCompact } from '../../utils/formatting';
import { computeCompleteness } from '../../utils/dataMerger';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import RAGBadge from './RAGBadge';
import CompletenessBadge from './CompletenessBadge';
import PillarSparkline from './PillarSparkline';
import RankMovement from './RankMovement';

const PILLAR_ACCENT: Record<string, string> = {
  Supply: '#7D5A7D',
  Demand: '#5A7D6F',
  Connectivity: '#5A6E7D',
  Labour: '#7D6E5A',
  'Rents & Yields': '#6F5A7D',
  'Strategic / Risk': '#7D5A6E',
};

/** Tier from composite score. */
function tierOf(score: number): { label: string; variant: 'success' | 'warning' | 'danger' } {
  if (score >= 80) return { label: 'T1', variant: 'success' };
  if (score >= 60) return { label: 'T2', variant: 'warning' };
  return { label: 'T3', variant: 'danger' };
}

/** Inline composite-score CategoryBar (0–100) coloured by tier. */
function CompositeBar({ score }: { score: number }) {
  const color = score >= 80 ? '#1B8A5A' : score >= 60 ? '#B7791F' : '#C53030';
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-right text-base font-bold tabular-nums" style={{ color }}>
        {score.toFixed(1)}
      </span>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: color }} />
      </div>
    </div>
  );
}

function pillarCell(ps: PillarScore | undefined, key: string) {
  const score = ps?.score ?? 0;
  const count = ps?.scoredCount ?? 0;
  const total = ps?.totalCount ?? 0;
  const pct = score / 5;
  let bg = 'text-muted-foreground';
  if (count > 0) {
    bg = pct >= 0.8 ? 'bg-success/10 text-success' : pct >= 0.6 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger';
  }
  return (
    <td key={key} className={cn('px-3 py-2 text-center', bg)}>
      {count > 0 ? (
        <>
          <div className="text-sm font-medium">{score.toFixed(1)}</div>
          <div className="text-[10px] opacity-60">{count}/{total}</div>
        </>
      ) : (
        <div className="text-xs">--</div>
      )}
    </td>
  );
}

interface Props {
  markets: ScoredMarket[];
  onDelete?: (id: string) => void;
  compareMode?: boolean;
  compareIds?: Set<string>;
  onToggleCompare?: (id: string) => void;
  previousRanks?: Record<string, number>;
}

export default function RankingsTable({
  markets, onDelete, compareMode, compareIds, onToggleCompare, previousRanks,
}: Props) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (markets.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-sm text-muted-foreground">
        No markets match the current filters.
      </div>
    );
  }

  const colCount = 11 + PILLARS.length + (compareMode ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-primary text-primary-foreground">
            {compareMode && <th className="w-8 px-2 py-3"></th>}
            <th className="w-6 px-2 py-3"></th>
            <th className="w-10 px-3 py-3 text-left text-xs font-semibold">#</th>
            <th className="w-12 px-2 py-3 text-center text-xs font-semibold">Δ</th>
            <th className="px-3 py-3 text-left text-xs font-semibold">Market</th>
            <th className="px-3 py-3 text-left text-xs font-semibold">Region</th>
            <th className="px-3 py-3 text-left text-xs font-semibold">Tier</th>
            <th className="px-3 py-3 text-left text-xs font-semibold">Data</th>
            <th className="w-32 px-3 py-3 text-left text-xs font-semibold">Balance</th>
            <th className="w-40 px-4 py-3 text-left text-xs font-semibold">Composite</th>
            {PILLARS.map((p) => (
              <th key={p.name} className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold">
                {p.name.split(' ')[0]}
              </th>
            ))}
            <th className="px-3 py-3 text-center text-xs font-semibold">RAG</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {markets.map((sm) => {
            const prevRank = previousRanks?.[sm.market.id];
            const isCompared = compareIds?.has(sm.market.id) ?? false;
            const isExpanded = expandedId === sm.market.id;
            const tier = tierOf(sm.totalScore);
            return (
              <Fragment key={sm.market.id}>
                <tr
                  className={cn(
                    'cursor-pointer border-t transition-colors hover:bg-muted/50',
                    isCompared && 'bg-accent/40',
                    isExpanded && 'bg-accent/30'
                  )}
                  onClick={() => {
                    if (compareMode && onToggleCompare) onToggleCompare(sm.market.id);
                    else navigate(`/dashboard?market=${sm.market.id}`);
                  }}
                >
                  {compareMode && (
                    <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => onToggleCompare?.(sm.market.id)}
                        disabled={!isCompared && (compareIds?.size ?? 0) >= 5}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                    </td>
                  )}
                  <td
                    className="px-2 py-2.5 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : sm.market.id);
                    }}
                    title={isExpanded ? 'Hide pillar breakdown' : 'Show pillar breakdown'}
                  >
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform hover:text-primary',
                        isExpanded && 'rotate-90 text-primary'
                      )}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{sm.rank}</td>
                  <td className="px-2 py-2.5 text-center">
                    <RankMovement currentRank={sm.rank} previousRank={prevRank} />
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-foreground">{sm.market.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{sm.market.region}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={tier.variant}>{tier.label}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {(() => {
                      const c = computeCompleteness(sm.market);
                      return <CompletenessBadge filled={c.filled} total={c.total} />;
                    })()}
                  </td>
                  <td className="px-3 py-2.5">
                    <PillarSparkline pillarScores={sm.pillarScores} />
                  </td>
                  <td className="px-4 py-2.5">
                    <CompositeBar score={sm.totalScore} />
                  </td>
                  {PILLARS.map((p) => pillarCell(sm.pillarScores[p.name], `${sm.market.id}-${p.name}`))}
                  <td className="px-3 py-2.5 text-center">
                    <RAGBadge rag={sm.rag} />
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => window.open(`/market/${sm.market.id}/print`, '_blank')}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Open printable one-pager"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/edit/${sm.market.id}`)}
                        className="rounded p-1 text-primary hover:bg-accent"
                        title="Edit market"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {onDelete && !sm.market.id.startsWith('sample-') && (
                        <button
                          onClick={() => onDelete(sm.market.id)}
                          className="rounded p-1 text-danger hover:bg-danger/10"
                          title="Delete market"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-muted/30">
                    <td colSpan={colCount} className="border-t px-6 py-4">
                      <PillarBreakdown market={sm} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pillar breakdown drill-down (per-pillar BarList) ────────────────────────

function PillarBreakdown({ market }: { market: ScoredMarket }) {
  return (
    <div>
      {/* per-pillar score bars (BarList style) */}
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-3">
        {PILLARS.map((p) => {
          const score = market.pillarScores[p.name]?.score ?? 0;
          const accent = PILLAR_ACCENT[p.name] || '#7D5A7D';
          return (
            <div key={p.name} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate text-muted-foreground" title={p.name}>
                {p.name}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(score / 5) * 100}%`, background: accent }} />
              </div>
              <span className="w-8 text-right font-mono font-semibold tabular-nums">{score.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      {/* detailed metric tables */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <PillarMetricList key={p.name} market={market} pillarName={p.name} accent={PILLAR_ACCENT[p.name] || '#7D5A7D'} />
        ))}
      </div>
    </div>
  );
}

function PillarMetricList({ market, pillarName, accent }: { market: ScoredMarket; pillarName: Pillar; accent: string }) {
  const ps = market.pillarScores[pillarName];
  const pillarMetrics = METRICS.filter((m) => m.pillar === pillarName);
  const rows = pillarMetrics.map((m) => ({ metric: m, value: market.market.values[m.id], score: ps?.metricScores[m.id] ?? 0 }));
  const scored = rows.filter((r) => r.score > 0);
  const avg = scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : 0;

  const scoreClass = (s: number) =>
    s === 0 ? 'text-muted-foreground/40' : s >= 4 ? 'text-success' : s >= 3 ? 'text-warning' : 'text-danger';

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-white" style={{ background: accent }}>
        <span>{pillarName}</span>
        <span className="font-mono tabular-nums">
          {scored.length ? avg.toFixed(2) : '—'}
          <span className="ml-1 text-[10px] opacity-70">/ 5</span>
        </span>
      </div>
      <table className="w-full">
        <tbody>
          {rows.map(({ metric, value, score }) => {
            const hasData = value !== null && value !== undefined;
            return (
              <tr key={metric.id} className="border-b last:border-0">
                <td className="w-9 px-2 py-1 font-mono text-[11px] text-muted-foreground">M{metric.id}</td>
                <td className="truncate px-1 py-1 text-[11px] text-foreground/80" title={metric.name}>
                  {metric.name}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground" title={metric.unit}>
                  {hasData ? formatCompact(value, metric.unit) : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className={cn('w-8 px-2 py-1 text-right text-xs font-bold tabular-nums', scoreClass(score))}>
                  {score > 0 ? score : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
