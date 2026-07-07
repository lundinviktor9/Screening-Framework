import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { ScoredMarket } from '../../types';
import { PILLARS } from '../../data/metrics';

const COLOURS = ['#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777'];

interface Props {
  markets: ScoredMarket[];
}

export default function MarketRadar({ markets }: Props) {
  const data = PILLARS.map(p => {
    const entry: Record<string, string | number> = { pillar: p.name.split(' ')[0] };
    for (const sm of markets) {
      entry[sm.market.name] = parseFloat((sm.pillarScores[p.name]?.score ?? 0).toFixed(2));
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e9e6f5" />
        <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <Tooltip
          formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e9e6f5' }}
        />
        {markets.map((sm, i) => (
          <Radar
            key={sm.market.id}
            name={sm.market.name}
            dataKey={sm.market.name}
            stroke={COLOURS[i % COLOURS.length]}
            fill={COLOURS[i % COLOURS.length]}
            fillOpacity={0.08}
            strokeWidth={2}
          />
        ))}
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
