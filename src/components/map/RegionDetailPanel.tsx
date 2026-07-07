/**
 * Slide-in panel shown when the user clicks a regional zone polygon on the map.
 * Summarises Newmark Q3 2025 regional data and renders 4 Recharts components:
 *   1. Occupier mix (horizontal grouped bar)
 *   2. Unit size distribution (1-2 donuts)
 *   3. Development pipeline (donut + months-of-supply stat)
 *   4. Prime rent growth forecast vs UK average
 */

import UnitSizeDonut from './charts/UnitSizeDonut';
import PipelineDonut from './charts/PipelineDonut';
import RentGrowthBar from './charts/RentGrowthBar';
import OccupierMixChart, { type OccupierMixEntry } from './charts/OccupierMixChart';

export interface RegionSummary {
  name: string;                  // Newmark region name
  primeRentRange?: [number, number];  // £psf min, max
  equivalentYield?: number;       // %
  vacancyRate?: number;           // %
  allGradesErv?: number;          // £psf
  reversionPct?: number;          // %
  rentalGrowthForecast?: number;  // % pa
  ukAvgGrowth?: number;           // % pa

  // Pipeline
  pipelineTotalSqft?: number;
  pipelineAppliedPct?: number;
  pipelineConsentedPct?: number;
  pipelineUnderConstructionPct?: number;
  monthsOfSupply?: number;

  // Occupier + unit size — optional
  occupierMix?: OccupierMixEntry[];
  subRegionALabel?: string;
  subRegionBLabel?: string;

  unitSizeA?: { micro: number; smallBox: number; midBox: number };
  unitSizeB?: { micro: number; smallBox: number; midBox: number };
  unitSizeALabel?: string;
  unitSizeBLabel?: string;
}

interface Props {
  summary: RegionSummary;
  onClose: () => void;
}

export default function RegionDetailPanel({ summary, onClose }: Props) {
  return (
    <div
      className="absolute top-0 right-0 bottom-0 z-[1001] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto"
      style={{ width: 420 }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100" style={{ background: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)' }}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-purple-600">
              Newmark Q3 2025 · Regional profile
            </div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{summary.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <HeaderStat label="Equivalent yield" value={summary.equivalentYield !== undefined ? `${summary.equivalentYield.toFixed(2)}%` : '—'} />
          <HeaderStat label="MLI vacancy" value={summary.vacancyRate !== undefined ? `${summary.vacancyRate.toFixed(1)}%` : '—'} tilde />
          <HeaderStat label="All-grades ERV" value={summary.allGradesErv !== undefined ? `£${summary.allGradesErv.toFixed(2)} psf` : '—'} />
          <HeaderStat
            label="Prime rent"
            value={summary.primeRentRange
              ? `£${summary.primeRentRange[0].toFixed(2)} – £${summary.primeRentRange[1].toFixed(2)}`
              : '—'}
            subLabel="psf"
          />
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* Chart 1 — Occupier mix */}
        <Section title="Occupier mix">
          <OccupierMixChart
            data={summary.occupierMix ?? []}
            subRegionALabel={summary.subRegionALabel ?? summary.name}
            subRegionBLabel={summary.subRegionBLabel}
          />
        </Section>

        {/* Chart 2 — Unit size distribution */}
        <Section title="Unit size distribution">
          <div className={`grid ${summary.unitSizeB ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            {summary.unitSizeA && (
              <UnitSizeDonut
                title={summary.unitSizeALabel ?? summary.name}
                segments={[
                  { name: 'Micro', value: summary.unitSizeA.micro },
                  { name: 'Small box', value: summary.unitSizeA.smallBox },
                  { name: 'Mid box', value: summary.unitSizeA.midBox },
                ]}
              />
            )}
            {summary.unitSizeB && (
              <UnitSizeDonut
                title={summary.unitSizeBLabel ?? 'Sub-region B'}
                segments={[
                  { name: 'Micro', value: summary.unitSizeB.micro },
                  { name: 'Small box', value: summary.unitSizeB.smallBox },
                  { name: 'Mid box', value: summary.unitSizeB.midBox },
                ]}
              />
            )}
            {!summary.unitSizeA && !summary.unitSizeB && (
              <div className="text-xs text-gray-400 text-center py-6">
                Unit size data not available.
              </div>
            )}
          </div>
        </Section>

        {/* Chart 3 — Development pipeline */}
        <Section title="Development pipeline">
          {summary.pipelineAppliedPct !== undefined
            && summary.pipelineConsentedPct !== undefined
            && summary.pipelineUnderConstructionPct !== undefined
            ? (
              <PipelineDonut
                appliedPct={summary.pipelineAppliedPct}
                consentedPct={summary.pipelineConsentedPct}
                underConstructionPct={summary.pipelineUnderConstructionPct}
                totalSqft={summary.pipelineTotalSqft}
                monthsOfSupply={summary.monthsOfSupply}
              />
            )
            : <div className="text-xs text-gray-400 py-4 text-center">Pipeline data not available.</div>}
        </Section>

        {/* Chart 4 — Rental growth forecast */}
        <Section title="Rental growth forecast">
          {summary.rentalGrowthForecast !== undefined && summary.ukAvgGrowth !== undefined ? (
            <RentGrowthBar
              regionName={summary.name}
              regionGrowth={summary.rentalGrowthForecast}
              ukAverage={summary.ukAvgGrowth}
            />
          ) : (
            <div className="text-xs text-gray-400 py-4 text-center">Growth forecast not available.</div>
          )}
        </Section>

        {/* Reversion */}
        {summary.reversionPct !== undefined && (
          <Section title="Rental reversion">
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-xs text-gray-600">ERV − passing rent spread</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">~{summary.reversionPct.toFixed(1)}%</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1 italic">
              Chart-approximated from Newmark page 13 (±2 pp).
            </div>
          </Section>
        )}

        <div className="pt-4 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
          Source: Newmark Multi-let Winter Bulletin, Winter 2025. Chart-approximated
          values carry ±2-5 pp. For precise underlying data contact Newmark research:
          Steve.Sharman@nmrk.com.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 pb-1 border-b border-gray-100">
        {title}
      </h3>
      {children}
    </div>
  );
}

function HeaderStat({
  label, value, subLabel, tilde,
}: { label: string; value: string; subLabel?: string; tilde?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-purple-100 px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-bold text-gray-900 tabular-nums">
        {tilde ? `~${value}` : value}
        {subLabel && <span className="text-[10px] text-gray-400 font-normal ml-1">{subLabel}</span>}
      </div>
    </div>
  );
}
