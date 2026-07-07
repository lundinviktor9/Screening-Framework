import { useMemo, useState } from 'react';
import type { ScoredMarket, Pillar } from '../../types';
import { PILLARS } from '../../data/metrics';

type SortKey = 'total' | Pillar;

interface Props {
  markets: ScoredMarket[];
}

/**
 * 6 × N quartile heatmap showing all markets across all pillars.
 * Colour intensity reflects the market's position in the distribution
 * for that specific pillar (quartile colouring).
 * Total column is coloured by absolute tier (≥80 / 60-79 / <60).
 */
export default function AllMarketsHeatmap({ markets }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [regionFilter, setRegionFilter] = useState<string>('All');

  // Compute quartile thresholds per pillar across the full (pre-filter) set
  const quartiles = useMemo(() => {
    const result: Record<Pillar, { q1: number; q2: number; q3: number }> = {} as any;
    for (const p of PILLARS) {
      const vals = markets
        .map(m => m.pillarScores[p.name]?.score ?? 0)
        .filter(v => v > 0)
        .sort((a, b) => a - b);
      if (vals.length === 0) {
        result[p.name] = { q1: 0, q2: 0, q3: 0 };
      } else {
        result[p.name] = {
          q1: vals[Math.floor(vals.length * 0.25)],
          q2: vals[Math.floor(vals.length * 0.50)],
          q3: vals[Math.floor(vals.length * 0.75)],
        };
      }
    }
    return result;
  }, [markets]);

  const regions = useMemo(() => {
    return ['All', ...Array.from(new Set(markets.map(m => m.market.region))).sort()];
  }, [markets]);

  const filteredSorted = useMemo(() => {
    let filtered = regionFilter === 'All' ? markets : markets.filter(m => m.market.region === regionFilter);
    return [...filtered].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === 'total') {
        av = a.totalScore;
        bv = b.totalScore;
      } else {
        av = a.pillarScores[sortKey]?.score ?? 0;
        bv = b.pillarScores[sortKey]?.score ?? 0;
      }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [markets, sortKey, sortDir, regionFilter]);

  function quartileClass(pillar: Pillar, score: number, count: number): { bg: string; text: string } {
    if (count === 0 || score === 0) return { bg: '#f3f4f6', text: '#9ca3af' };
    const q = quartiles[pillar];
    if (score >= q.q3) return { bg: '#15803d', text: '#ffffff' };      // top quartile — deep green
    if (score >= q.q2) return { bg: '#86efac', text: '#14532d' };      // 3rd quartile — light green
    if (score >= q.q1) return { bg: '#fde68a', text: '#78350f' };      // 2nd quartile — amber
    return { bg: '#fecaca', text: '#7f1d1d' };                          // bottom quartile — red
  }

  function totalScoreClass(score: number): { bg: string; text: string } {
    if (score >= 80) return { bg: '#15803d', text: '#ffffff' };
    if (score >= 60) return { bg: '#b45309', text: '#ffffff' };
    return { bg: '#b91c1c', text: '#ffffff' };
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIcon(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' ▼' : ' ▲';
  }

  return (
    <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">All-market heatmap</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredSorted.length} markets · quartile colours per pillar · click a header to sort
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-400 bg-white"
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Quartile legend */}
          <div className="flex items-center gap-1 text-[10px] font-medium">
            <span className="text-gray-400 mr-1">Pillar quartiles:</span>
            <div className="flex h-4 rounded overflow-hidden border border-gray-200">
              <div className="w-5" style={{ background: '#fecaca' }} title="Bottom quartile" />
              <div className="w-5" style={{ background: '#fde68a' }} title="2nd quartile" />
              <div className="w-5" style={{ background: '#86efac' }} title="3rd quartile" />
              <div className="w-5" style={{ background: '#15803d' }} title="Top quartile" />
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap table */}
      <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white z-10 shadow-sm">
            <tr className="border-b border-gray-200">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 bg-white w-10">#</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 bg-white min-w-[160px]">Market</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 bg-white">Region</th>
              <th
                onClick={() => handleSort('total')}
                className="text-center px-3 py-2 text-xs font-semibold text-gray-500 bg-white cursor-pointer hover:bg-gray-50 select-none w-20"
              >
                Total{sortIcon('total')}
              </th>
              {PILLARS.map(p => (
                <th
                  key={p.name}
                  onClick={() => handleSort(p.name)}
                  className="text-center px-3 py-2 text-xs font-semibold bg-white cursor-pointer hover:bg-gray-50 select-none whitespace-nowrap"
                  style={{ color: p.colour, minWidth: '90px' }}
                >
                  {p.name.split(' ')[0]}{sortIcon(p.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((sm, i) => {
              const totalStyle = totalScoreClass(sm.totalScore);
              return (
                <tr key={sm.market.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="px-3 py-1.5 text-xs text-gray-400 font-mono">{sm.rank}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-900 text-xs">{sm.market.name}</td>
                  <td className="px-3 py-1.5 text-xs text-gray-500">{sm.market.region}</td>
                  <td
                    className="text-center font-bold text-xs"
                    style={{ background: totalStyle.bg, color: totalStyle.text }}
                  >
                    {sm.totalScore.toFixed(1)}
                  </td>
                  {PILLARS.map(p => {
                    const ps = sm.pillarScores[p.name];
                    const score = ps?.score ?? 0;
                    const count = ps?.scoredCount ?? 0;
                    const { bg, text } = quartileClass(p.name, score, count);
                    return (
                      <td
                        key={p.name}
                        className="text-center text-xs font-medium"
                        style={{ background: bg, color: text, minWidth: '60px' }}
                        title={`${p.name}: ${count > 0 ? score.toFixed(2) : 'no data'} (${count}/${ps?.totalCount ?? 0} metrics)`}
                      >
                        {count > 0 ? score.toFixed(1) : '–'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
