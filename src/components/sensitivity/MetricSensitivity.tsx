import { useState, useMemo } from 'react';
import { useMarketStore } from '../../store/marketStore';
import { PILLARS, METRICS } from '../../data/metrics';
import type { Pillar, MarketInput, MetricSource } from '../../types';

function isStaleDate(dataDate: string): boolean {
  const yearFromString = (s: string): number | null => {
    const m = s.match(/\b(19|20)\d{2}\b/g);
    if (!m || m.length === 0) return null;
    return Math.max(...m.map(y => parseInt(y, 10)));
  };
  const year = yearFromString(dataDate);
  if (year === null) return false;
  const now = new Date();
  if (year >= now.getFullYear()) return false;
  const yearsBack = now.getFullYear() - year;
  return yearsBack >= 2;
}

interface MetricRowProps {
  metric: { id: number; name: string; unit: string };
  markets: MarketInput[];
  currentWeight: number;
  totalMarkets: number;
  onChange: (metricId: number, newWeight: number) => void;
  colour: string;
}

function MetricRow({ metric, markets, currentWeight, totalMarkets, onChange, colour }: MetricRowProps) {
  const pct = Math.round(currentWeight * 10) / 10;
  const isOff = pct === 0;

  // Calculate coverage and source data
  const { marketsWithData, primary } = useMemo(() => {
    let count = 0;
    let primarySrc: MetricSource | null = null;

    for (const market of markets) {
      const value = market.values[metric.id];
      if (value !== null && value !== undefined) {
        count++;
        if (!primarySrc && market.sources[metric.id]) {
          primarySrc = market.sources[metric.id];
        }
      }
    }

    return { marketsWithData: count, primary: primarySrc };
  }, [metric.id, markets]);

  const coveragePct = Math.round((marketsWithData / totalMarkets) * 100);
  const hasData = marketsWithData > 0;
  const stale = primary?.dataDate && isStaleDate(primary.dataDate);

  const getCoverageColor = () => {
    if (coveragePct >= 80) return '#15803d';
    if (coveragePct >= 40) return '#b45309';
    if (coveragePct > 0) return '#dc2626';
    return '#d1d5db';
  };

  const getStatusColor = () => {
    if (!primary) return 'bg-gray-50 text-gray-400 border-gray-200';
    if (primary.status === 'VERIFIED') return 'bg-green-50 text-green-700 border-green-200';
    if (primary.status === 'REGIONAL_PROXY') return 'bg-gray-50 text-gray-600 border-gray-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const getStatusText = () => {
    if (!primary) return 'Missing';
    if (primary.status === 'VERIFIED') return 'Verified';
    if (primary.status === 'REGIONAL_PROXY') return 'Regional';
    return 'Estimated';
  };

  return (
    <div className={`border-b border-gray-100 px-4 py-3 flex items-start gap-3 ${hasData ? '' : 'opacity-60'}`}>
      {/* Metric ID */}
      <div className="w-8 flex-shrink-0 text-xs text-gray-400 font-mono pt-0.5">
        M{metric.id}
      </div>

      {/* Metric name + unit */}
      <div className="w-32 flex-shrink-0">
        <div className="font-medium text-gray-800 text-sm">{metric.name}</div>
        <div className="text-[11px] text-gray-400">{metric.unit}</div>
      </div>

      {/* Source */}
      <div className="w-40 flex-shrink-0">
        {primary ? (
          <div>
            {primary.sourceUrl ? (
              <a
                href={primary.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-800 hover:underline font-medium text-xs"
              >
                {primary.sourceName}
              </a>
            ) : (
              <span className="text-xs font-medium text-gray-700">{primary.sourceName}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">No source — manual entry needed</span>
        )}
      </div>

      {/* Data date + stale badge */}
      <div className="w-28 flex-shrink-0">
        {primary?.dataDate ? (
          <div className="flex flex-col gap-0.5">
            <span className={`text-xs ${stale ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
              {primary.dataDate}
            </span>
            {stale && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                ⚠ Stale
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </div>

      {/* Status pill */}
      <div className="w-20 flex-shrink-0 pt-0.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Coverage bar + number */}
      <div className="w-28 flex-shrink-0 flex items-center justify-end gap-1.5 pt-0.5">
        <span className={`text-xs font-semibold tabular-nums ${
          coveragePct >= 80 ? 'text-green-600' :
          coveragePct >= 40 ? 'text-amber-600' :
          coveragePct > 0 ? 'text-red-600' : 'text-gray-300'
        }`}>
          {marketsWithData}/{totalMarkets}
        </span>
        <div className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${coveragePct}%`, background: getCoverageColor() }}
          />
        </div>
      </div>

      {/* Weight slider */}
      <div className="flex-1 flex items-center gap-2 pt-0.5">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={currentWeight}
          onChange={e => onChange(metric.id, Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            accentColor: isOff ? '#d1d5db' : colour,
            background: `linear-gradient(to right, ${isOff ? '#d1d5db' : colour} ${pct}%, #e5e7eb ${pct}%)`,
            opacity: isOff ? 0.5 : 1,
          }}
        />
        <span className={`text-sm font-semibold tabular-nums w-12 text-right flex-shrink-0 ${isOff ? 'text-gray-300' : 'text-gray-700'}`}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

interface PillarAccordionProps {
  pillar: Pillar;
  colour: string;
  metricWeights: Record<number, number>;
  markets: MarketInput[];
  totalMarkets: number;
  onMetricWeightChange: (metricId: number, newWeight: number) => void;
}

function PillarAccordion({ pillar, colour, metricWeights, markets, totalMarkets, onMetricWeightChange }: PillarAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pillarMetrics = METRICS.filter(m => m.pillar === pillar);
  const weightedCount = pillarMetrics.filter(m => (metricWeights[m.id] || 0) > 0).length;
  const totalWeight = pillarMetrics.reduce((sum, m) => sum + (metricWeights[m.id] || 0), 0);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: colour }}
            />
            <span className="font-semibold text-gray-900">{pillar}</span>
            <span className="text-xs text-gray-500">
              {pillarMetrics.length} metric{pillarMetrics.length !== 1 ? 's' : ''} ({weightedCount} weighted &gt; 0%)
            </span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="bg-gray-50 border-t border-gray-100">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-1">ID</div>
            <div className="col-span-2">Metric</div>
            <div className="col-span-2">Source</div>
            <div className="col-span-1.5">Date</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1.5">Coverage</div>
            <div className="col-span-3">Weight</div>
          </div>

          {/* Metric rows */}
          {pillarMetrics.map(m => (
            <MetricRow
              key={m.id}
              metric={m}
              markets={markets}
              currentWeight={metricWeights[m.id] || 0}
              totalMarkets={totalMarkets}
              onChange={onMetricWeightChange}
              colour={colour}
            />
          ))}

          {/* Total indicator */}
          <div className="mt-2 pt-2 px-4 pb-3 border-t border-gray-200 flex justify-end">
            <div className="text-xs font-semibold text-gray-600">
              Total: {Math.round(totalWeight * 10) / 10}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MetricSensitivity() {
  const markets = useMarketStore(s => s.markets);
  const currentScenario = useMarketStore(s => s.currentScenario);
  const updateMetricWeight = useMarketStore(s => s.updateMetricWeight);

  const totalMarkets = markets.length;

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Metric Sensitivity</h2>
        <p className="text-xs text-gray-500 mt-1">
          Adjust metric weights within each pillar · weights are automatically balanced
        </p>
      </div>

      {/* Accordion sections */}
      <div className="space-y-2">
        {PILLARS.map(p => (
          <PillarAccordion
            key={p.name}
            pillar={p.name as Pillar}
            colour={p.colour}
            metricWeights={currentScenario.metricWeights}
            markets={markets}
            totalMarkets={totalMarkets}
            onMetricWeightChange={updateMetricWeight}
          />
        ))}
      </div>
    </div>
  );
}
