import type { PillarScore, Pillar } from '../../types';
import { PILLARS } from '../../data/metrics';

interface Props {
  pillarScores: Record<Pillar, PillarScore>;
}

/**
 * 6-bar micro-bar chart showing pillar balance at a glance.
 * Each bar height = pillar score / 5, coloured by pillar.
 */
export default function PillarSparkline({ pillarScores }: Props) {
  return (
    <div className="flex items-end gap-0.5 h-6" title="Pillar scores: Supply / Demand / Connectivity / Labour / Rents&Yields / Strategic">
      {PILLARS.map(p => {
        const ps = pillarScores[p.name];
        const score = ps?.scoredCount ? ps.score : 0;
        const h = Math.max(2, (score / 5) * 24);
        const faded = !ps || ps.scoredCount === 0;
        return (
          <div
            key={p.name}
            className="w-2 rounded-sm"
            style={{
              height: `${h}px`,
              background: faded ? '#e5e7eb' : p.colour,
              opacity: faded ? 0.4 : 1,
            }}
          />
        );
      })}
    </div>
  );
}
