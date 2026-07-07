import type { ScoredMarket } from '../../types';
import { METRICS, PILLARS } from '../../data/metrics';

function scoreColour(score: number): string {
  if (score === 0) return '#f3f4f6';
  if (score >= 4.5) return '#166534';
  if (score >= 4)   return '#15803d';
  if (score >= 3.5) return '#16a34a';
  if (score >= 3)   return '#ca8a04';
  if (score >= 2)   return '#dc2626';
  return '#991b1b';
}

function scoreBg(score: number): string {
  if (score === 0) return '#f9fafb';
  if (score >= 4.5) return '#dcfce7';
  if (score >= 4)   return '#bbf7d0';
  if (score >= 3.5) return '#d1fae5';
  if (score >= 3)   return '#fef9c3';
  if (score >= 2)   return '#fee2e2';
  return '#fecaca';
}

interface Props {
  markets: ScoredMarket[];
}

export default function HeatmapTable({ markets }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 bg-gray-50 border border-gray-200 min-w-48 sticky left-0">
              Metric
            </th>
            {markets.map(sm => (
              <th
                key={sm.market.id}
                className="px-2 py-2 text-center font-semibold text-gray-700 bg-gray-50 border border-gray-200 min-w-24"
              >
                {sm.market.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PILLARS.map(pillar => (
            <>
              <tr key={`h-${pillar.name}`}>
                <td
                  colSpan={markets.length + 1}
                  className="px-3 py-1.5 font-bold text-white text-xs"
                  style={{ background: pillar.colour }}
                >
                  {pillar.name} ({pillar.totalWeight} pts)
                </td>
              </tr>
              {METRICS.filter(m => m.pillar === pillar.name).map(metric => (
                <tr key={metric.id} className="hover:bg-purple-50/20">
                  <td className="px-3 py-1.5 border border-gray-100 bg-white sticky left-0 text-gray-700">
                    <span className="text-gray-400 font-mono mr-1.5">{metric.id}</span>
                    {metric.name}
                  </td>
                  {markets.map(sm => {
                    const score = sm.pillarScores[pillar.name]?.metricScores[metric.id] ?? 0;
                    return (
                      <td
                        key={sm.market.id}
                        className="px-2 py-1.5 border border-gray-100 text-center font-bold"
                        style={{ background: scoreBg(score), color: scoreColour(score) }}
                      >
                        {score > 0 ? score : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
