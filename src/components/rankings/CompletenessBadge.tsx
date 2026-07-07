interface Props {
  filled: number;
  total: number;
}

export default function CompletenessBadge({ filled, total }: Props) {
  const pct = Math.round((filled / total) * 100);
  const isLow = pct < 40;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        <span
          className={`text-xs font-semibold tabular-nums ${isLow ? 'text-red-600' : 'text-gray-600'}`}
        >
          {filled}/{total}
        </span>
        {isLow && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"
            title="Less than 40% data completeness — score may not be reliable"
          >
            Low data
          </span>
        )}
      </div>
      <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: isLow ? '#dc2626' : pct >= 70 ? '#15803d' : '#b45309',
          }}
        />
      </div>
    </div>
  );
}
