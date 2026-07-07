import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { METRICS, PILLARS } from '../../data/metrics';
import { formatCompact } from '../../utils/formatting';
import type { MetricDef } from '../../types';

export default function MethodologySection() {
  const [activePillar, setActivePillar] = useState<string>(PILLARS[0].name);
  const anchorRef = useRef<HTMLDivElement>(null);

  // If the page was opened with #thresholds hash, scroll to the table on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#thresholds') {
      setTimeout(() => anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, []);

  const pillarMetrics = METRICS.filter(m => m.pillar === activePillar);

  return (
    <section
      ref={anchorRef}
      id="thresholds"
      className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden mb-6 scroll-mt-6"
    >
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: '#3B1F6B', color: 'white' }}>
                Methodology
              </span>
              <h2 className="text-base font-bold text-gray-900">Per-metric quantitative thresholds</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Every metric's 1–5 score band, with the exact boundary values used to classify each market.
            </p>
          </div>
          <Link
            to="/"
            className="text-xs font-medium text-purple-700 hover:text-purple-900 underline whitespace-nowrap"
          >
            ← Scoring approach & source priority
          </Link>
        </div>
      </div>

      <div className="px-5 py-5">
        {/* Per-metric thresholds (pillar tabs) */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">
              Quantitative thresholds per metric
            </h3>
            <div className="text-[10px] text-gray-400">
              Score 5 = best-in-class · Score 1 = weakest · boundaries shown below
            </div>
          </div>

            {/* Pillar tabs */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PILLARS.map(p => (
                <button
                  key={p.name}
                  onClick={() => setActivePillar(p.name)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    activePillar === p.name ? 'text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                  style={activePillar === p.name ? { background: p.colour } : {}}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Thresholds table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Metric</th>
                    <th className="px-3 py-2 text-left font-semibold w-16">Rule</th>
                    <ThresholdHeader score={5} label="Score 5" colour="#15803d" />
                    <ThresholdHeader score={4} label="Score 4" colour="#16a34a" />
                    <ThresholdHeader score={3} label="Score 3" colour="#ca8a04" />
                    <ThresholdHeader score={2} label="Score 2" colour="#dc2626" />
                    <ThresholdHeader score={1} label="Score 1" colour="#991b1b" />
                  </tr>
                </thead>
                <tbody>
                  {pillarMetrics.map((m, i) => (
                    <ThresholdRow key={m.id} metric={m} zebra={i % 2 === 1} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 italic">
              For "Higher is better" metrics, boundary values mean "score ≥ X earns that tier".
              For "Lower is better" metrics, it means "score ≤ X earns that tier".
              "Direct" metrics are already on a 1–5 expert-judgment scale.
            </p>
        </div>
      </div>
    </section>
  );
}

function ThresholdHeader({ score, label, colour }: { score: number; label: string; colour: string }) {
  return (
    <th className="px-2 py-2 text-center font-semibold w-24">
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colour }}>
        {label}
      </div>
      <div className="text-[9px] text-gray-400 font-normal normal-case">= {score}/5</div>
    </th>
  );
}

function ThresholdRow({ metric, zebra }: { metric: MetricDef; zebra: boolean }) {
  const { t5, t4, t3, t2, ruleType, unit, name, id } = metric;
  const isDirect = ruleType === 'Direct';

  function cell(boundary: number | null, scoreIfBetter: number) {
    if (boundary === null) return '—';
    return formatCompact(boundary, unit);
  }

  // For Higher: score 5 = ≥ t5, score 4 = [t4, t5), score 3 = [t3, t4), score 2 = [t2, t3), score 1 = < t2
  // For Lower:  score 5 = ≤ t5, score 4 = (t5, t4], score 3 = (t4, t3], score 2 = (t3, t2], score 1 = > t2

  const prefix5 = isDirect ? '5' : (ruleType === 'Higher' ? '≥' : '≤');
  const prefix1 = isDirect ? '1' : (ruleType === 'Higher' ? '<' : '>');

  return (
    <tr className={`border-b border-gray-50 last:border-0 ${zebra ? 'bg-gray-50/40' : 'bg-white'}`}>
      <td className="px-3 py-1.5 text-[10px] text-gray-400 font-mono">M{id}</td>
      <td className="px-3 py-1.5">
        <div className="text-[11px] font-medium text-gray-800">{name}</div>
        <div className="text-[9px] text-gray-400">{unit}</div>
      </td>
      <td className="px-3 py-1.5">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{
                background: ruleType === 'Higher' ? '#f0fdf4' : ruleType === 'Lower' ? '#fef2f2' : '#f3f4f6',
                color:      ruleType === 'Higher' ? '#15803d' : ruleType === 'Lower' ? '#b91c1c' : '#6b7280',
              }}>
          {ruleType}
        </span>
      </td>
      {isDirect ? (
        <>
          <td colSpan={5} className="px-3 py-1.5 text-center text-[10px] text-gray-500 italic">
            Expert judgment score (1–5). No numeric boundaries.
          </td>
        </>
      ) : (
        <>
          <td className="px-2 py-1.5 text-center text-[10px] font-mono tabular-nums whitespace-nowrap">
            <span className="text-gray-400 mr-0.5">{prefix5}</span>{cell(t5, 5)}
          </td>
          <td className="px-2 py-1.5 text-center text-[10px] font-mono tabular-nums whitespace-nowrap text-gray-600">
            {cell(t4, 4)}
          </td>
          <td className="px-2 py-1.5 text-center text-[10px] font-mono tabular-nums whitespace-nowrap text-gray-600">
            {cell(t3, 3)}
          </td>
          <td className="px-2 py-1.5 text-center text-[10px] font-mono tabular-nums whitespace-nowrap text-gray-600">
            {cell(t2, 2)}
          </td>
          <td className="px-2 py-1.5 text-center text-[10px] font-mono tabular-nums whitespace-nowrap">
            <span className="text-gray-400 mr-0.5">{prefix1}</span>{cell(t2, 1)}
          </td>
        </>
      )}
    </tr>
  );
}
