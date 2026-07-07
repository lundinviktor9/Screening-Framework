import { RotateCcw } from 'lucide-react';

import { useMarketStore } from '../store/marketStore';
import type { Pillar } from '../types/index';
import { PILLARS } from '../data/metrics';
import { MetricSensitivity } from '../components/sensitivity/MetricSensitivity';
import { BiggestMovers } from '../components/sensitivity/BiggestMovers';
import { ScenarioManager } from '../components/sensitivity/ScenarioManager';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const DEFAULT_WEIGHTS = [17, 17, 17, 17, 16, 16];

const PILLAR_ACCENT: Record<string, string> = {
  Supply: '#7D5A7D',
  Demand: '#5A7D6F',
  Connectivity: '#5A6E7D',
  Labour: '#7D6E5A',
  'Rents & Yields': '#6F5A7D',
  'Strategic / Risk': '#7D5A6E',
};

function PillarSlider({
  name, accent, value, onChange,
}: { name: string; accent: string; value: number; onChange: (val: number) => void }) {
  const pct = Math.round(value * 10) / 10;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
          <span className="truncate text-xs font-medium text-foreground">{name}</span>
        </div>
        <span className="ml-1 shrink-0 text-xs font-bold tabular-nums" style={{ color: accent }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={0.5}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

export default function SensitivityPage() {
  const currentScenario = useMarketStore((s) => s.currentScenario);
  const updatePillarWeights = useMarketStore((s) => s.updatePillarWeights);
  const resetToDefault = useMarketStore((s) => s.resetToDefault);

  const weights = PILLARS.map((p) => currentScenario.pillarWeights[p.name as Pillar] ?? p.totalWeight);
  const isDefault = weights.every((w, i) => Math.abs(w - DEFAULT_WEIGHTS[i]) < 0.01);
  const sum = weights.reduce((a, b) => a + b, 0);
  const sumOk = Math.abs(sum - 100) < 0.5;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Sensitivity</h1>
          <p className="text-xs text-muted-foreground">
            Adjust pillar weights to see how rankings change.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live-sum indicator */}
          <div
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold tabular-nums',
              sumOk ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'
            )}
            title="Pillar weights must sum to 100%"
          >
            Σ {sum.toFixed(1)}% {sumOk ? '✓' : '— must equal 100%'}
          </div>
          <Button variant="outline" size="sm" onClick={resetToDefault} disabled={isDefault}>
            <RotateCcw /> Reset
          </Button>
        </div>
      </div>

      <ScenarioManager />

      {/* Sliders panel */}
      <div className="shrink-0 border-b bg-card px-6 py-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {PILLARS.map((p) => (
            <PillarSlider
              key={p.name}
              name={p.name}
              accent={PILLAR_ACCENT[p.name] || '#7D5A7D'}
              value={weights[PILLARS.indexOf(p)]}
              onChange={(val) => updatePillarWeights(p.name as Pillar, val)}
            />
          ))}
        </div>

        {/* Weight summary chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PILLARS.map((p, i) => {
            const accent = PILLAR_ACCENT[p.name] || '#7D5A7D';
            const delta = weights[i] - DEFAULT_WEIGHTS[i];
            return (
              <div
                key={p.name}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                style={{ color: accent, borderColor: `${accent}40`, background: `${accent}14` }}
              >
                <span>{p.name}</span>
                <span className="font-bold tabular-nums">{Math.round(weights[i] * 10) / 10}%</span>
                {!isDefault && Math.abs(delta) > 0.05 && (
                  <span className="opacity-60">
                    ({delta > 0 ? '+' : ''}
                    {delta.toFixed(1)})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Metric sensitivity + biggest movers */}
      <div className="flex-1 space-y-6 overflow-y-auto bg-background px-6 py-4">
        <MetricSensitivity />
        <BiggestMovers />
      </div>
    </div>
  );
}
