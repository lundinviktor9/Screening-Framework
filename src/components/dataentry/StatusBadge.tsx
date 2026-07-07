import type { MetricStatusFlag } from '../../types';

const STYLES: Record<MetricStatusFlag, { label: string; bg: string; text: string; border: string }> = {
  VERIFIED:       { label: 'Verified',       bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  ESTIMATED:      { label: 'Estimated',      bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  REGIONAL_PROXY: { label: 'R',              bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  REVIEW_NEEDED:  { label: 'Review needed',  bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
};

interface Props {
  status?: MetricStatusFlag;
  compact?: boolean;
}

export default function StatusBadge({ status, compact }: Props) {
  if (!status) {
    return (
      <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200">
        {compact ? '–' : 'No status'}
      </span>
    );
  }

  const s = STYLES[status];
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {compact && status !== 'REGIONAL_PROXY' ? s.label.charAt(0) : s.label}
    </span>
  );
}
