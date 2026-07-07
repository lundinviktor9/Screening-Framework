interface Props {
  currentRank: number;
  previousRank?: number;
}

/**
 * Shows ▲N (up) / ▼N (down) / ● (unchanged) / — (no history).
 * "Up" means improved rank (lower number, e.g. 12 → 5 is ▲7).
 */
export default function RankMovement({ currentRank, previousRank }: Props) {
  if (previousRank === undefined || previousRank === null) {
    return <span className="text-gray-300 text-xs">—</span>;
  }
  const change = previousRank - currentRank; // positive = moved up
  if (change === 0) {
    return <span className="text-gray-400 text-xs" title="No change since last refresh">●</span>;
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 font-semibold text-xs tabular-nums"
            title={`Up ${change} places since last refresh`}>
        ▲{change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-red-500 font-semibold text-xs tabular-nums"
          title={`Down ${Math.abs(change)} places since last refresh`}>
      ▼{Math.abs(change)}
    </span>
  );
}
