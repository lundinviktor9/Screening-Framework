import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
  regionName: string;
  regionGrowth: number;  // % pa
  ukAverage: number;     // % pa
}

export default function RentGrowthBar({ regionName, regionGrowth, ukAverage }: Props) {
  const data = [
    { name: regionName, value: regionGrowth },
    { name: 'UK average', value: ukAverage },
  ];
  const aboveAverage = regionGrowth > ukAverage;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Prime rent growth forecast 2024-29
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            aboveAverage ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {aboveAverage ? 'Above UK avg' : 'Below UK avg'}
        </span>
      </div>
      <div style={{ width: '100%', height: 100 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 60, right: 30, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 10 }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
            <ReferenceLine x={ukAverage} stroke="#6b7280" strokeDasharray="2 2" />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? (aboveAverage ? '#15803d' : '#b45309') : '#9ca3af'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-gray-500 text-center mt-1 font-mono">
        {regionName}: <strong>{regionGrowth.toFixed(1)}% pa</strong> · UK: {ukAverage.toFixed(1)}% pa
      </div>
    </div>
  );
}
