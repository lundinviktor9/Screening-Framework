import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Segment { name: string; value: number; }
interface Props {
  title: string;
  segments: Segment[];
}

const COLOURS = ['#3B1F6B', '#7C3AED', '#a78bfa'];

export default function UnitSizeDonut({ title, segments }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{title}</div>
        <div className="text-xs text-gray-400 py-8">No data</div>
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{title}</div>
      <div style={{ width: '100%', height: 140 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={2}
              stroke="none"
            >
              {segments.map((_, i) => <Cell key={i} fill={COLOURS[i % COLOURS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-0.5 mt-1">
        {segments.map((s, i) => (
          <div key={s.name} className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOURS[i % COLOURS.length] }} />
              <span className="text-gray-700">{s.name}</span>
            </span>
            <span className="font-mono font-semibold tabular-nums">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
