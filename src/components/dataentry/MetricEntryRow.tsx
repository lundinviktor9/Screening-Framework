import { useState, useMemo } from 'react';
import type { MetricDef, MetricSource, MetricStatusFlag, GeographicLevel, Confidence } from '../../types';
import { scoreMetric } from '../../utils/scoring';
import { validateMetricValue, deriveStatusForEntry } from '../../utils/validation';
import { formatCompact } from '../../utils/formatting';
import { METRIC_VALIDATION } from '../../config/metricValidation';
import StatusBadge from './StatusBadge';
import { toast } from '@/components/ui/sonner';
import { confirmDialog } from '@/components/ui/confirm';

function scoreColour(score: number) {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-amber-600';
  return 'text-red-500';
}

interface Props {
  metric: MetricDef;
  value: number | null;
  source: MetricSource | undefined;
  onSave: (value: number | null, source: MetricSource) => void;
  onCascade: (value: number | null, source: Omit<MetricSource, 'status' | 'geographicLevel' | 'confidence' | 'regionalSourceMarketId'>) => void;
  regionMarketCount: number;
  regionName: string;
}

const EMPTY_SOURCE: MetricSource = {
  sourceName: '',
  sourceUrl: '',
  dataDate: '',
  geographicLevel: 'market',
  confidence: 'estimated',
};

export default function MetricEntryRow({
  metric,
  value,
  source,
  onSave,
  onCascade,
  regionMarketCount,
  regionName,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // Local editing state (only used when expanded)
  const [editValue, setEditValue] = useState<string>(value !== null && value !== undefined ? String(value) : '');
  const [editSource, setEditSource] = useState<MetricSource>(source ?? { ...EMPTY_SOURCE });
  const [overrideValidation, setOverrideValidation] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState('');

  const score = scoreMetric(metric.id, value);
  const hasValue = value !== null && value !== undefined;
  const status = source?.status;
  const isRegionalProxy = status === 'REGIONAL_PROXY';
  const isReviewNeeded = status === 'REVIEW_NEEDED';

  // Live validation of the currently-typed value
  const editNumVal = editValue === '' || isNaN(parseFloat(editValue)) ? null : parseFloat(editValue);
  const validation = useMemo(() => validateMetricValue(metric.id, editNumVal), [metric.id, editNumVal]);
  const rule = METRIC_VALIDATION[metric.id];

  function handleExpand() {
    // Reset local state to current values when expanding
    setEditValue(value !== null && value !== undefined ? String(value) : '');
    setEditSource(source ?? { ...EMPTY_SOURCE });
    setOverrideValidation(false);
    setOverrideJustification(source?.justificationNote ?? '');
    setExpanded(!expanded);
  }

  async function handleSaveClick() {
    const numVal = editValue === '' ? null : parseFloat(editValue);
    const finalValue = numVal !== null && isNaN(numVal) ? null : numVal;

    // Block save if value is out of range and user hasn't overridden with a justification
    const valResult = validateMetricValue(metric.id, finalValue);
    if (!valResult.valid && !overrideValidation) {
      toast.error(valResult.message, {
        description: 'Click "Override" to save anyway with a justification note, or adjust the value.',
      });
      return;
    }
    if (!valResult.valid && overrideValidation && overrideJustification.trim().length < 5) {
      toast.error('Please enter a justification note (at least 5 characters) to override the validation warning.');
      return;
    }

    const geoLevel = editSource.geographicLevel || 'market';
    const confidence = editSource.confidence || 'estimated';

    if (geoLevel === 'regional') {
      const count = regionMarketCount;
      const ok = await confirmDialog({
        title: 'Apply to all markets in region?',
        description: `This will apply the value to all ${count} markets in ${regionName}.`,
        confirmText: 'Apply to region',
      });
      if (!ok) return;
      const { status: _s, geographicLevel: _g, confidence: _c, regionalSourceMarketId: _r,
              justificationNote: _jn, ...baseSrc } = editSource;
      onCascade(finalValue, baseSrc);
    } else {
      // Derive status based on validation result
      const derivedStatus: MetricStatusFlag = deriveStatusForEntry(
        metric.id, finalValue, confidence, overrideValidation,
      );

      onSave(finalValue, {
        ...editSource,
        status: derivedStatus,
        geographicLevel: 'market',
        justificationNote: overrideValidation ? overrideJustification.trim() : undefined,
      });
    }

    setExpanded(false);
  }

  return (
    <div className={`border-b border-gray-50 ${isRegionalProxy ? 'bg-gray-50/50' : ''}`}>
      {/* Collapsed row */}
      <button
        type="button"
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-purple-50/30 transition-colors"
      >
        {/* Metric ID */}
        <span className="text-xs text-gray-400 font-mono w-7 shrink-0">M{metric.id}</span>

        {/* Name + unit */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{metric.name}</div>
          <div className="text-[11px] text-gray-400">{metric.unit}</div>
        </div>

        {/* Status badge */}
        <StatusBadge status={status} compact />

        {/* Current value */}
        <div className="text-sm font-mono w-40 text-right shrink-0">
          {hasValue ? (
            <span className="text-gray-800">{formatCompact(value, metric.unit)}</span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>

        {/* Score */}
        <div className={`text-sm font-bold w-8 text-right shrink-0 ${hasValue ? scoreColour(score) : 'text-gray-300'}`}>
          {hasValue ? score : '–'}
        </div>

        {/* Expand arrow */}
        <span className="text-gray-400 text-xs w-4 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 ml-7 space-y-3 border-l-2 border-purple-200">
          {/* Guidance */}
          <div className="text-xs text-gray-400 italic">{metric.inputGuidance}</div>

          {/* Value input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Value</label>
              {metric.ruleType === 'Direct' ? (
                <select
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                >
                  <option value="">– Not set –</option>
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  step="any"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="Enter value"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                    !validation.valid
                      ? 'border-red-300 focus:border-red-500 bg-red-50'
                      : 'border-gray-200 focus:border-purple-400'
                  }`}
                />
              )}
              {rule && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                  Expected: {rule.min} to {rule.max} {rule.unit}
                  {rule.hint && <span className="italic"> — {rule.hint}</span>}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Date of data</label>
              <input
                type="date"
                value={editSource.dataDate}
                onChange={e => setEditSource(s => ({ ...s, dataDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Source (URL or report name)</label>
            <input
              type="text"
              value={editSource.sourceName}
              onChange={e => setEditSource(s => ({ ...s, sourceName: e.target.value }))}
              placeholder='e.g. "CoStar Q1 2026" or paste URL'
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* Geographic level + Confidence */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Geographic level</label>
              <div className="flex gap-2">
                {(['market', 'regional'] as GeographicLevel[]).map(level => (
                  <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`geo-${metric.id}`}
                      checked={(editSource.geographicLevel || 'market') === level}
                      onChange={() => setEditSource(s => ({ ...s, geographicLevel: level }))}
                      className="accent-purple-600"
                    />
                    <span className="text-xs text-gray-700">
                      {level === 'market' ? 'Market-specific' : 'Regional proxy'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Confidence</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { key: 'primary_source' as Confidence, label: 'Primary source' },
                  { key: 'estimated' as Confidence, label: 'Estimated' },
                ]).map(opt => (
                  <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`conf-${metric.id}`}
                      checked={(editSource.confidence || 'estimated') === opt.key}
                      onChange={() => setEditSource(s => ({ ...s, confidence: opt.key }))}
                      className="accent-purple-600"
                    />
                    <span className="text-xs text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Regional proxy info */}
          {editSource.geographicLevel === 'regional' && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              This value will be applied to all <strong>{regionMarketCount}</strong> markets in <strong>{regionName}</strong> as a regional proxy.
            </div>
          )}

          {/* Validation warning + Override */}
          {!validation.valid && editNumVal !== null && (
            <div className="text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-red-500 font-bold">⚠</span>
                <div className="flex-1">
                  <div className="font-semibold text-red-700">Validation warning</div>
                  <div className="text-red-600">{validation.message}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id={`override-${metric.id}`}
                  checked={overrideValidation}
                  onChange={e => setOverrideValidation(e.target.checked)}
                  className="accent-red-600"
                />
                <label htmlFor={`override-${metric.id}`} className="text-xs text-red-700 font-medium cursor-pointer">
                  Override — I confirm this value is correct despite being unusual
                </label>
              </div>
              {overrideValidation && (
                <div>
                  <label className="block text-[10px] font-semibold text-red-700 uppercase mb-1">
                    Justification (required, min 5 chars)
                  </label>
                  <input
                    type="text"
                    value={overrideJustification}
                    onChange={e => setOverrideJustification(e.target.value)}
                    placeholder="e.g. Verified by CoStar Q1 2026 — market has unusual supply dynamics"
                    className="w-full border border-red-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-500 bg-white"
                  />
                </div>
              )}
              {!overrideValidation && (
                <div className="text-[10px] text-red-500 italic">
                  Without override, this value will be saved with status REVIEW_NEEDED and excluded from scoring until justified.
                </div>
              )}
            </div>
          )}

          {/* Existing REVIEW_NEEDED note (if loaded with existing justification) */}
          {isReviewNeeded && source?.justificationNote && !overrideValidation && (
            <div className="text-xs bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
              <span className="font-semibold text-gray-600">Previous override note:</span>{' '}
              <span className="text-gray-700 italic">{source.justificationNote}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveClick}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: '#3B1F6B' }}
            >
              Save
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {hasValue && (
              <button
                onClick={() => {
                  onSave(null, { sourceName: '', sourceUrl: '', dataDate: '' });
                  setExpanded(false);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors ml-auto"
              >
                Clear value
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
