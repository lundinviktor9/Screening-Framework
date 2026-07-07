import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, RotateCcw, GitCompare } from 'lucide-react';
import { useMarketStore } from '../store/marketStore';
import { confirmDialog } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportToCSV, parseImportedCSV } from '../utils/csvImportExport';
import RankingsTable from '../components/rankings/RankingsTable';
import type { ScoredMarket, PipelineStatus } from '../types';

type TierFilter = 'all' | 't1' | 't2' | 't3';
type ThesisFilter = 'none' | 'supply_constrained' | 'strong_labour' | 'rental_growth' | 'large_catchment' | 'low_unemployment';
type PipelineFilter = 'all' | 'tracked' | Exclude<PipelineStatus, 'untracked'>;

const PIPELINE_CHIPS: { key: PipelineFilter; label: string; icon?: string; bg: string; text: string }[] = [
  { key: 'all',       label: 'All',       bg: 'transparent', text: '#4b5563' },
  { key: 'tracked',   label: 'Tracked',   bg: '#ede9fe',      text: '#6d28d9' },
  { key: 'active',    label: 'Active',    icon: '🔵', bg: '#eff6ff', text: '#1d4ed8' },
  { key: 'watchlist', label: 'Watchlist', icon: '👁️', bg: '#fef3c7', text: '#b45309' },
  { key: 'invested',  label: 'Invested',  icon: '✓',  bg: '#f0fdf4', text: '#15803d' },
  { key: 'passed',    label: 'Passed',    icon: '✕',  bg: '#f3f4f6', text: '#6b7280' },
];

interface ThesisConfig {
  label: string;
  sub: string;
  predicate: (m: ScoredMarket) => boolean;
  sortMetricId?: number;      // metric to sort by when this filter is active
  sortDir?: 'asc' | 'desc';   // defaults to 'desc'
  sortLabel?: string;         // human-readable sort dimension
}

const THESIS_FILTERS: Record<ThesisFilter, ThesisConfig> = {
  none: { label: 'All markets', sub: '', predicate: () => true },
  supply_constrained: {
    label: 'High MLI supply constraint',
    sub: 'Concentration >65%',
    predicate: m => {
      const v = m.market.values[63];
      return v !== null && v !== undefined && v >= 65;
    },
    sortMetricId: 63,
    sortDir: 'desc',
    sortLabel: 'MLI concentration',
  },
  strong_labour: {
    label: 'Strong labour pool',
    sub: '60-min pop ≥3M',
    predicate: m => {
      const v = m.market.values[32];
      return v !== null && v !== undefined && v >= 3_000_000;
    },
    sortMetricId: 32,
    sortDir: 'desc',
    sortLabel: '60-min catchment',
  },
  low_unemployment: {
    label: 'Tight labour market',
    sub: 'Unemployment <4%',
    predicate: m => {
      const v = m.market.values[36];
      return v !== null && v !== undefined && v < 4;
    },
    sortMetricId: 36,
    sortDir: 'asc',
    sortLabel: 'unemployment rate',
  },
  rental_growth: {
    label: 'Household growth markets',
    sub: '5yr growth >5%',
    predicate: m => {
      const v = m.market.values[34];
      return v !== null && v !== undefined && v >= 5;
    },
    sortMetricId: 34,
    sortDir: 'desc',
    sortLabel: 'household growth',
  },
  large_catchment: {
    label: 'Large 30-min catchment',
    sub: '≥1.5M people',
    predicate: m => {
      const v = m.market.values[31];
      return v !== null && v !== undefined && v >= 1_500_000;
    },
    sortMetricId: 31,
    sortDir: 'desc',
    sortLabel: '30-min catchment',
  },
};

export default function RankingsPage() {
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const deleteMarketAction = useMarketStore(s => s.deleteMarket);
  const resetToDefaultsAction = useMarketStore(s => s.resetToDefaults);
  const saveAllAction = useMarketStore(s => s.saveAll);
  const masterDataDate = useMarketStore(s => s.masterDataDate);
  const previousRanks = useMarketStore(s => s.previousRanks);
  const snapshotRanks = useMarketStore(s => s.snapshotRanks);
  const _tick = useMarketStore(s => s._lastTick);

  const ranked = useMemo(() => getScoredMarkets(), [markets, _tick]);

  const [region, setRegion] = useState('All regions');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [thesisFilter, setThesisFilter] = useState<ThesisFilter>('none');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleDelete(id: string) {
    const ok = await confirmDialog({
      title: 'Delete this market?',
      description: 'This removes the market from your dataset.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) deleteMarketAction(id);
  }
  async function handleReset() {
    const ok = await confirmDialog({
      title: 'Reset all markets to defaults?',
      description: 'Resets to the default UK pre-filled dataset. Any manual edits will be lost.',
      confirmText: 'Reset',
      destructive: true,
    });
    if (ok) resetToDefaultsAction();
  }
  function handleExport() { exportToCSV(markets); }
  function handleImportClick() { fileInputRef.current?.click(); }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseImportedCSV(text, markets);
      saveAllAction(result.updatedMarkets);
      const parts = [`Updated ${result.valuesUpdated} values across ${result.marketsUpdated} markets`];
      if (result.valuesFlaggedReview > 0) parts.push(`${result.valuesFlaggedReview} flagged REVIEW_NEEDED (out of range)`);
      if (result.warnings.length > 0) parts.push(`${result.warnings.length} warning(s) — check console`);
      const clean = result.valuesFlaggedReview === 0 && result.warnings.length === 0;
      setImportMsg({ text: parts.join(' · ') + '.', ok: clean });
      if (result.warnings.length > 0) console.warn('CSV import warnings:', result.warnings);
      setTimeout(() => setImportMsg(null), 9000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function toggleCompare(id: string) {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }

  // On first load, if no previous-rank snapshot exists, create one so the UI has
  // a baseline to compare against.
  useEffect(() => {
    if (ranked.length > 0 && Object.keys(previousRanks).length === 0) {
      snapshotRanks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked.length]);

  // Filters (combine region + tier + thesis + pipeline) + thesis-aware sort
  const filtered = useMemo(() => {
    const base = ranked.filter(m => {
      if (region !== 'All regions' && m.market.region !== region) return false;
      if (tierFilter === 't1' && m.totalScore < 80) return false;
      if (tierFilter === 't2' && !(m.totalScore >= 60 && m.totalScore < 80)) return false;
      if (tierFilter === 't3' && m.totalScore >= 60) return false;
      if (thesisFilter !== 'none' && !THESIS_FILTERS[thesisFilter].predicate(m)) return false;
      const ps = m.market.pipelineStatus ?? 'untracked';
      if (pipelineFilter === 'tracked' && ps === 'untracked') return false;
      if (pipelineFilter !== 'all' && pipelineFilter !== 'tracked' && ps !== pipelineFilter) return false;
      return true;
    });

    // When a thesis filter is active, re-sort by the filter's defining metric
    // so the #1 spot reflects the thesis, not the composite total score.
    const cfg = THESIS_FILTERS[thesisFilter];
    if (cfg.sortMetricId !== undefined) {
      const mid = cfg.sortMetricId;
      const dir = cfg.sortDir ?? 'desc';
      base.sort((a, b) => {
        const av = a.market.values[mid];
        const bv = b.market.values[mid];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return dir === 'desc' ? bv - av : av - bv;
      });
    }

    return base;
  }, [ranked, region, tierFilter, thesisFilter, pipelineFilter]);

  // Pipeline status counts for chip badges
  const pipelineCounts = useMemo(() => {
    const c = { active: 0, watchlist: 0, invested: 0, passed: 0, untracked: 0 };
    for (const m of ranked) {
      const s = m.market.pipelineStatus ?? 'untracked';
      c[s]++;
    }
    return c;
  }, [ranked]);

  // Headline tier counts (unfiltered, global)
  const tierCounts = {
    t1: ranked.filter(m => m.totalScore >= 80).length,
    t2: ranked.filter(m => m.totalScore >= 60 && m.totalScore < 80).length,
    t3: ranked.filter(m => m.totalScore < 60).length,
  };
  const meanScore = ranked.length > 0 ? ranked.reduce((s, m) => s + m.totalScore, 0) / ranked.length : 0;
  const uniqueRegions = new Set(ranked.map(m => m.market.region)).size;

  const regions = ['All regions', ...Array.from(new Set(ranked.map(m => m.market.region))).sort()];

  return (
    <div className="p-8">
      {/* Headline stats strip */}
      <div className="mb-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Rankings</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {ranked.length} markets · 6 pillars · 60 metrics
              {masterDataDate && <Badge variant="success">Data updated: {masterDataDate}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={compareMode ? 'default' : 'outline'} onClick={() => setCompareMode((m) => !m)}>
              <GitCompare />
              {compareMode ? `Comparing ${compareIds.size}/5` : 'Compare'}
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              <RotateCcw /> Reset
            </Button>
            <Button variant="outline" onClick={handleExport} title="Download all markets as CSV">
              <Download /> Export CSV
            </Button>
            <Button variant="outline" onClick={handleImportClick} title="Upload a filled CSV to update values">
              <Upload /> Import CSV
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <Button onClick={() => navigate('/add')}>
              <Plus /> Add Market
            </Button>
          </div>
        </div>

        {/* Import result toast */}
        {importMsg && (
          <div
            className={cn(
              'mb-4 rounded-lg border px-4 py-3 text-sm font-medium',
              importMsg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'
            )}
          >
            {importMsg.text}
          </div>
        )}

        {/* Summary numbers */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Markets" value={String(ranked.length)} sub={`across ${uniqueRegions} regions`} tone="brand" />
          <StatCard label="Tier 1 — Core" value={String(tierCounts.t1)} sub="≥ 80" tone="success" active={tierFilter === 't1'} onClick={() => setTierFilter(tierFilter === 't1' ? 'all' : 't1')} />
          <StatCard label="Tier 2 — Value-add" value={String(tierCounts.t2)} sub="60–79" tone="warning" active={tierFilter === 't2'} onClick={() => setTierFilter(tierFilter === 't2' ? 'all' : 't2')} />
          <StatCard label="Tier 3 — Monitor" value={String(tierCounts.t3)} sub="< 60" tone="danger" active={tierFilter === 't3'} onClick={() => setTierFilter(tierFilter === 't3' ? 'all' : 't3')} />
          <StatCard label="Mean score" value={meanScore.toFixed(1)} sub="all markets" tone="muted" />
        </div>
      </div>

      {/* Investment thesis filter chips */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Investment thesis</div>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(THESIS_FILTERS) as [ThesisFilter, typeof THESIS_FILTERS['none']][]).map(([key, cfg]) => {
            const active = thesisFilter === key;
            return (
              <button
                key={key}
                onClick={() => setThesisFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  active ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                style={active ? { background: '#3B1F6B' } : {}}
                title={cfg.sub}
              >
                {cfg.label}
                {cfg.sub && (
                  <span className={`ml-1.5 text-[10px] ${active ? 'opacity-80' : 'text-gray-400'}`}>
                    ({cfg.sub})
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Region:</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400 bg-white"
              style={{ minWidth: 160 }}
            >
              {regions.map(r => (
                <option key={r} value={r}>
                  {r === 'All regions' ? `All (${ranked.length})` : `${r} (${ranked.filter(m => m.market.region === r).length})`}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(thesisFilter !== 'none' || tierFilter !== 'all' || region !== 'All regions' || pipelineFilter !== 'all') && (
          <div className="mt-2 text-xs text-gray-500">
            Showing <strong>{filtered.length}</strong> of {ranked.length} markets
            {THESIS_FILTERS[thesisFilter].sortLabel && (
              <span className="ml-1">
                · sorted by <strong className="text-gray-700">{THESIS_FILTERS[thesisFilter].sortLabel}</strong>
                {THESIS_FILTERS[thesisFilter].sortDir === 'asc' ? ' (low→high)' : ' (high→low)'}
              </span>
            )}
            {(thesisFilter !== 'none' || tierFilter !== 'all' || pipelineFilter !== 'all') && (
              <button
                onClick={() => { setThesisFilter('none'); setTierFilter('all'); setRegion('All regions'); setPipelineFilter('all'); }}
                className="ml-2 text-purple-600 hover:text-purple-800 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pipeline status chips */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pipeline</div>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_CHIPS.map(chip => {
            const active = pipelineFilter === chip.key;
            const count = chip.key === 'all'
              ? ranked.length
              : chip.key === 'tracked'
                ? ranked.length - pipelineCounts.untracked
                : pipelineCounts[chip.key];
            const disabled = count === 0 && chip.key !== 'all';
            return (
              <button
                key={chip.key}
                onClick={() => setPipelineFilter(chip.key)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'text-white border-transparent'
                    : disabled
                      ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                style={active ? { background: chip.key === 'all' ? '#3B1F6B' : chip.text } : {}}
              >
                {chip.icon && <span>{chip.icon}</span>}
                {chip.label}
                <span className={`text-[10px] font-mono tabular-nums ${active ? 'opacity-80' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compare bar */}
      {compareMode && compareIds.size > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-purple-200 bg-purple-50 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-purple-700">Compare:</span>
          {[...compareIds].map(id => {
            const m = ranked.find(x => x.market.id === id);
            if (!m) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1.5 bg-white border border-purple-200 rounded-full px-2 py-0.5 text-xs">
                <span className="font-medium text-gray-800">{m.market.name}</span>
                <span className="text-gray-400 font-mono">{m.totalScore.toFixed(0)}</span>
                <button onClick={() => toggleCompare(id)} className="text-gray-400 hover:text-red-500">×</button>
              </span>
            );
          })}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setCompareIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Clear
            </button>
            <button
              onClick={() => {
                const qs = [...compareIds].join(',');
                navigate(`/compare?markets=${qs}`);
              }}
              disabled={compareIds.size < 2}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#3B1F6B' }}
            >
              Compare {compareIds.size} markets →
            </button>
          </div>
        </div>
      )}

      <RankingsTable
        markets={filtered}
        onDelete={handleDelete}
        compareMode={compareMode}
        compareIds={compareIds}
        onToggleCompare={toggleCompare}
        previousRanks={previousRanks}
      />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  brand: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  muted: 'text-muted-foreground',
};

function StatCard(props: {
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof TONE;
  active?: boolean;
  onClick?: () => void;
}) {
  const isClickable = !!props.onClick;
  return (
    <div
      onClick={props.onClick}
      className={cn(
        'rounded-lg border bg-card px-4 py-3 shadow-sm transition-all',
        isClickable && 'cursor-pointer hover:shadow-md',
        props.active && 'ring-2 ring-primary ring-offset-1'
      )}
    >
      <div className="flex items-baseline gap-2">
        <div className={cn('text-2xl font-bold tabular-nums', TONE[props.tone])}>{props.value}</div>
        <div className="text-xs text-muted-foreground">{props.sub}</div>
      </div>
      <div className="mt-0.5 text-xs font-semibold text-foreground">{props.label}</div>
    </div>
  );
}
