import type { MarketInput } from '../../types';
import { PILLARS } from '../../data/metrics';

export type QuickFilter = 'all' | 'missing' | 'review_needed';

interface Props {
  markets: MarketInput[];
  selectedMarketId: string;
  onMarketChange: (id: string) => void;
  pillarFilter: string;
  onPillarChange: (name: string) => void;
  quickFilter: QuickFilter;
  onQuickFilterChange: (f: QuickFilter) => void;
}

export default function DataEntryFilters({
  markets,
  selectedMarketId,
  onMarketChange,
  pillarFilter,
  onPillarChange,
  quickFilter,
  onQuickFilterChange,
}: Props) {
  // Group markets by region for the dropdown
  const byRegion = new Map<string, MarketInput[]>();
  for (const m of markets) {
    const list = byRegion.get(m.region) || [];
    list.push(m);
    byRegion.set(m.region, list);
  }
  const regionsSorted = [...byRegion.keys()].sort();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Market selector */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Market</label>
        <select
          value={selectedMarketId}
          onChange={e => onMarketChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white min-w-[220px]"
        >
          {regionsSorted.map(region => (
            <optgroup key={region} label={region}>
              {byRegion.get(region)!.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Pillar filter */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Pillar</label>
        <select
          value={pillarFilter}
          onChange={e => onPillarChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white min-w-[160px]"
        >
          <option value="All">All pillars</option>
          {PILLARS.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Show</label>
        <div className="flex gap-1.5">
          {([
            { key: 'all' as QuickFilter, label: 'All metrics' },
            { key: 'missing' as QuickFilter, label: 'Missing only' },
            { key: 'review_needed' as QuickFilter, label: 'Review needed' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => onQuickFilterChange(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                quickFilter === f.key
                  ? 'bg-purple-50 text-purple-700 border-purple-300'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
