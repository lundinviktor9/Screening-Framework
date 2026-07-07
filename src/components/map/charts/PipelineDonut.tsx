import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  appliedPct: number;
  consentedPct: number;
  underConstructionPct: number;
  totalSqft?: number;
  monthsOfSupply?: number;
}

const COLOURS = {
  applied:      '#fbbf24',  // amber — planning applied
  consented:    '#0ea5e9',  // sky — planning consented
  constructing: '#059669',  // green — under construction
};

export default function PipelineDonut({
  appliedPct, consentedPct, underConstructionPct, totalSqft, monthsOfSupply,
}: Props) {
  const segments = [
    { name: 'Under construction', value: underConstructionPct, fill: COLOURS.constructing },
    { name: 'Planning consented',  value: consentedPct,        fill: COLOURS.consented   },
    { name: 'Planning applied',    value: appliedPct,          fill: COLOURS.applied     },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-4">
        <div style={{ width: 160, height: 160, position: 'relative', flexShrink: 0 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                innerRadius={48}
                outerRadius={75}
                paddingAngle={2}
                stroke="none"
              >
                {segments.map((s) => <Cell key={s.name} fill={s.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          {totalSqft !== undefined && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Total</div>
              <div className="text-sm font-bold text-gray-900 tabular-nums">
                {(totalSqft / 1_000_000).toFixed(1)}m
              </div>
              <div className="text-[9px] text-gray-500">sqft</div>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          {segments.map(s => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.fill }} />
                <span className="text-gray-700">{s.name}</span>
              </span>
              <span className="font-mono font-semibold tabular-nums">{s.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {monthsOfSupply !== undefined && (
        <div className="mt-3 text-center">
          <div className="inline-block px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200">
            <span className="text-lg font-bold text-purple-900 tabular-nums">{monthsOfSupply.toFixed(1)}</span>
            <span className="text-xs text-purple-700 ml-1">months of supply at current take-up rate</span>
          </div>
        </div>
      )}
    </div>
  );
}
