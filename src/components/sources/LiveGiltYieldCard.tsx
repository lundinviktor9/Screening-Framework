import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/sonner';

interface GiltCache {
  yield_pct: number | null;
  fetch_date: string;
  source: string;
  tenor: string;
  cache_age_days: number;
  is_cached_fallback: boolean;
  bootstrap_note?: string;
  error?: string;
}

const STALE_DAYS = 7;

export default function LiveGiltYieldCard() {
  const [data, setData] = useState<GiltCache | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/data/gilt_yield_cache.json', { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // The cache file is in scrapers/config/, not public/data/ — so the fetch
  // above will usually 404. We also try the copy that's sometimes synced to
  // public/data/gilt_yield_cache.json (the user can add a build-time copy).
  // For the "Refresh" button we inform the user to run the CLI.

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-purple-100 shadow-sm px-4 py-3">
        <div className="text-xs text-gray-400">Loading gilt yield…</div>
      </div>
    );
  }
  if (!data || data.yield_pct === null) {
    return (
      <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">
          UK 10-year gilt yield — unavailable
        </div>
        <div className="text-xs text-amber-800">
          No cached value. Run <code className="bg-white/70 px-1.5 py-0.5 rounded text-[11px]">python scrapers/gilt_yield_fetcher.py</code> then
          copy the result to <code>public/data/gilt_yield_cache.json</code>.
        </div>
      </div>
    );
  }

  const stale = data.cache_age_days > STALE_DAYS || data.is_cached_fallback;
  const bg    = stale ? '#fffbeb' : '#f0fdf4';
  const border = stale ? '#fde68a' : '#bbf7d0';
  const textColour = stale ? '#b45309' : '#15803d';

  return (
    <div className="rounded-xl shadow-sm px-4 py-3 border" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textColour }}>
          UK 10-year gilt yield (live feed)
        </div>
        {stale && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/80" style={{ color: textColour }}>
            {data.is_cached_fallback ? 'CACHED FALLBACK' : `STALE (>${STALE_DAYS}d)`}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums" style={{ color: textColour }}>
          {data.yield_pct.toFixed(3)}%
        </span>
        <div className="text-xs text-gray-600 leading-tight">
          <div>{data.source}</div>
          <div className="text-[10px] text-gray-400">
            Fetched {data.fetch_date} · age {data.cache_age_days}d · {data.tenor}
          </div>
        </div>
      </div>
      <button
        onClick={() => {
          toast('Refresh the gilt yield from a terminal', {
            description: 'Run: python scrapers/gilt_yield_fetcher.py — then copy scrapers/config/gilt_yield_cache.json to public/data/ (or re-run the build).',
            duration: 10000,
          });
        }}
        className="mt-2 text-[10px] font-semibold px-2 py-1 rounded border bg-white hover:bg-gray-50"
        style={{ borderColor: border, color: textColour }}
      >
        Refresh gilt yield
      </button>
      {data.bootstrap_note && (
        <div className="mt-2 text-[10px] text-gray-500 italic">{data.bootstrap_note}</div>
      )}
    </div>
  );
}
