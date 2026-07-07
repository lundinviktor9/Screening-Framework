import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';

export interface OccupierMixEntry {
  type: string;
  subRegionA: number;
  subRegionB?: number;
}

interface Props {
  data: OccupierMixEntry[];
  subRegionALabel: string;
  subRegionBLabel?: string;
}

const COLOUR_A = '#3B1F6B';
const COLOUR_B = '#14b8a6';

export default function OccupierMixChart({ data, subRegionALabel, subRegionBLabel }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-center text-xs text-gray-400 py-8">
        Occupier mix data not available for this region.
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: Math.max(220, data.length * 26) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 110, right: 30, top: 5, bottom: 15 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" domain={[0, 30]} unit="%" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} width={100} />
          <Tooltip formatter={(v: number) => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="subRegionA" name={subRegionALabel} fill={COLOUR_A} radius={[0, 3, 3, 0]} />
          {subRegionBLabel && (
            <Bar dataKey="subRegionB" name={subRegionBLabel} fill={COLOUR_B} radius={[0, 3, 3, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
