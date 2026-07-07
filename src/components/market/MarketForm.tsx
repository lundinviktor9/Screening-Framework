import { useState } from 'react';
import type { MarketInput, MetricSource } from '../../types';
import { METRICS, PILLARS } from '../../data/metrics';
import { scoreMetric } from '../../utils/scoring';
import SourceInput from './SourceInput';

const EMPTY_SOURCE: MetricSource = { sourceName: '', sourceUrl: '', dataDate: '' };

function scoreColour(score: number) {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-amber-600';
  return 'text-red-500';
}

interface Props {
  initial?: MarketInput;
  onSave: (market: Omit<MarketInput, 'id' | 'createdAt'> & { id?: string }) => void;
  onCancel: () => void;
}

export default function MarketForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [values, setValues] = useState<Record<number, number | null>>(initial?.values ?? {});
  const [sources, setSources] = useState<Record<number, MetricSource>>(initial?.sources ?? {});
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});
  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>({
    Supply: true, Demand: false, Connectivity: false, Labour: false, 'Rents & Yields': false, 'Strategic / Risk': false,
  });

  function setValue(id: number, raw: string) {
    const num = raw === '' ? null : parseFloat(raw);
    setValues(v => ({ ...v, [id]: isNaN(num as number) ? null : num }));
  }

  function setSource(id: number, s: MetricSource) {
    setSources(src => ({ ...src, [id]: s }));
  }

  function togglePillar(name: string) {
    setExpandedPillars(p => ({ ...p, [name]: !p[name] }));
  }

  // Live score preview
  const pillarPreviews = PILLARS.map(p => {
    const metrics = METRICS.filter(m => m.pillar === p.name);
    const scored = metrics
      .filter(m => values[m.id] !== null && values[m.id] !== undefined)
      .map(m => scoreMetric(m.id, values[m.id]));
    const avg = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
    return { ...p, avg, scoredCount: scored.length, totalCount: metrics.length };
  });
  const activePillars = pillarPreviews.filter(p => p.scoredCount > 0);
  const activeWeightSum = activePillars.reduce((s, p) => s + p.totalWeight, 0);
  const totalScore = activeWeightSum > 0
    ? activePillars.reduce((sum, p) => sum + (p.avg / 5) * (p.totalWeight / activeWeightSum) * 100, 0)
    : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ id: initial?.id, name, region, notes, values, sources, updatedAt: new Date().toISOString() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-6">
      {/* ── Left: input panels ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Market identity */}
        <div className="bg-white rounded-xl border border-purple-100 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Market Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Market Name *</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Greater Manchester"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Region / Country</label>
              <input
                value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder="e.g. North West"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>
        </div>

        {/* Pillar sections */}
        {PILLARS.map(pillarDef => {
          const pillarMetrics = METRICS.filter(m => m.pillar === pillarDef.name);
          const isOpen = expandedPillars[pillarDef.name];
          const preview = pillarPreviews.find(p => p.name === pillarDef.name);

          return (
            <div key={pillarDef.name} className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
              {/* Pillar header */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-purple-50 transition-colors"
                onClick={() => togglePillar(pillarDef.name)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: pillarDef.colour }}
                  />
                  <span className="font-semibold text-gray-800">{pillarDef.name}</span>
                  <span className="text-xs text-gray-400">{pillarMetrics.length} metrics · {pillarDef.totalWeight} pts</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${scoreColour(preview?.avg ?? 0)}`}>
                    {(preview?.avg ?? 0).toFixed(2)} / 5.0
                  </span>
                  <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-purple-50 divide-y divide-gray-50">
                  {pillarMetrics.map(metric => {
                    const val = values[metric.id];
                    const score = scoreMetric(metric.id, val);
                    const srcShown = showSources[metric.id];
                    const src = sources[metric.id] ?? EMPTY_SOURCE;

                    return (
                      <div key={metric.id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-gray-400 font-mono w-6">{metric.id}</span>
                              <span className="text-sm font-medium text-gray-800">{metric.name}</span>
                            </div>
                            <div className="text-xs text-gray-400 ml-8">{metric.unit}</div>
                            <div className="text-xs text-gray-400 italic ml-8 mt-0.5">{metric.inputGuidance}</div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {metric.ruleType === 'Direct' ? (
                              <select
                                value={val ?? ''}
                                onChange={e => setValue(metric.id, e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-20 focus:outline-none focus:border-purple-400"
                              >
                                <option value="">–</option>
                                {[1, 2, 3, 4, 5].map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                value={val ?? ''}
                                onChange={e => setValue(metric.id, e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-28 text-right focus:outline-none focus:border-purple-400"
                                placeholder="—"
                              />
                            )}
                            <div className={`text-sm font-bold w-8 text-right ${val !== null && val !== undefined ? scoreColour(score) : 'text-gray-300'}`}>
                              {val !== null && val !== undefined ? score : '–'}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowSources(s => ({ ...s, [metric.id]: !s[metric.id] }))}
                              className="text-xs text-purple-400 hover:text-purple-600 px-1.5 py-1 rounded hover:bg-purple-50"
                              title="Toggle source"
                            >
                              {srcShown ? '▲' : '🔗'}
                            </button>
                          </div>
                        </div>
                        {srcShown && (
                          <div className="ml-8 mt-1">
                            <SourceInput value={src} onChange={s => setSource(metric.id, s)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: '#3B1F6B' }}
          >
            {initial ? 'Save Changes' : 'Add Market'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ── Right: live score preview ── */}
      <div className="w-60 shrink-0">
        <div className="sticky top-6 bg-white rounded-xl border border-purple-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 text-sm">Live Score Preview</h3>

          <div className="text-center mb-5">
            <div
              className="text-4xl font-bold"
              style={{ color: totalScore >= 80 ? '#15803d' : totalScore >= 60 ? '#b45309' : '#b91c1c' }}
            >
              {totalScore.toFixed(1)}
            </div>
            <div className="text-xs text-gray-400 mt-1">out of 100</div>
            <div className={`text-xs font-semibold mt-1 ${totalScore >= 80 ? 'text-green-600' : totalScore >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
              {totalScore >= 80 ? 'Green' : totalScore >= 60 ? 'Amber' : 'Red'}
            </div>
          </div>

          <div className="space-y-2">
            {pillarPreviews.map(p => (
              <div key={p.name}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs text-gray-600 truncate">{p.name}</span>
                  <span className={`text-xs font-semibold ${scoreColour(p.avg)}`}>{p.avg.toFixed(1)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(p.avg / 5) * 100}%`,
                      background: p.colour,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              Score thresholds:<br />
              🟢 Green ≥ 80 · 🟡 Amber ≥ 60<br />
              🔴 Red &lt; 60
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
