import type { MetricSource } from '../../types';

interface Props {
  value: MetricSource;
  onChange: (s: MetricSource) => void;
}

export default function SourceInput({ value, onChange }: Props) {
  return (
    <div className="mt-1.5 grid grid-cols-3 gap-2">
      <input
        type="text"
        placeholder="Source name (e.g. CoStar)"
        value={value.sourceName}
        onChange={e => onChange({ ...value, sourceName: e.target.value })}
        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400 bg-white"
      />
      <input
        type="url"
        placeholder="URL (optional)"
        value={value.sourceUrl}
        onChange={e => onChange({ ...value, sourceUrl: e.target.value })}
        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400 bg-white"
      />
      <input
        type="text"
        placeholder="Data date (e.g. Q1 2025)"
        value={value.dataDate}
        onChange={e => onChange({ ...value, dataDate: e.target.value })}
        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400 bg-white"
      />
    </div>
  );
}
