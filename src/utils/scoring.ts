import { METRICS, CONFIG, PILLARS } from '../data/metrics';
import type { MarketInput, ScoredMarket, PillarScore, Pillar, RAG, Scenario } from '../types';

export function scoreMetric(metricId: number, value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const def = METRICS.find(m => m.id === metricId);
  if (!def) return 0;

  if (def.ruleType === 'Direct') {
    // Direct expert score: clamp to 1–5
    return Math.max(1, Math.min(5, Math.round(value)));
  }

  const { t5, t4, t3, t2 } = def;
  if (t5 === null || t4 === null || t3 === null || t2 === null) return 0;

  if (def.ruleType === 'Lower') {
    if (value <= t5) return 5;
    if (value <= t4) return 4;
    if (value <= t3) return 3;
    if (value <= t2) return 2;
    return 1;
  } else {
    // Higher
    if (value >= t5) return 5;
    if (value >= t4) return 4;
    if (value >= t3) return 3;
    if (value >= t2) return 2;
    return 1;
  }
}

function getRAG(score: number): RAG {
  if (score >= CONFIG.totalGreen) return 'Green';
  if (score >= CONFIG.totalAmber) return 'Amber';
  return 'Red';
}

export function scoreMarket(market: MarketInput, scenario?: Scenario): Omit<ScoredMarket, 'rank'> {
  const pillarScores: Record<Pillar, PillarScore> = {} as Record<Pillar, PillarScore>;

  for (const pillarDef of PILLARS) {
    const pillarMetrics = METRICS.filter(m => m.pillar === pillarDef.name);
    const metricScores: Record<number, number> = {};

    for (const metric of pillarMetrics) {
      const raw = market.values[metric.id];
      if (raw !== null && raw !== undefined) {
        metricScores[metric.id] = scoreMetric(metric.id, raw);
      }
    }

    let avg = 0;
    if (Object.keys(metricScores).length > 0) {
      if (scenario) {
        // Weighted average using scenario metric weights
        const metricIds = Object.keys(metricScores).map(Number);
        const totalWeight = metricIds.reduce((sum, id) => sum + (scenario.metricWeights[id] || 0), 0);
        avg = totalWeight > 0
          ? metricIds.reduce((sum, id) => sum + metricScores[id] * (scenario.metricWeights[id] || 0), 0) / totalWeight
          : 0;
      } else {
        // Simple average (current behaviour)
        const scored = Object.values(metricScores);
        avg = scored.reduce((a, b) => a + b, 0) / scored.length;
      }
    }

    const scored = Object.values(metricScores);
    pillarScores[pillarDef.name] = {
      pillar: pillarDef.name,
      score: avg,
      scoredCount: scored.length,
      totalCount: pillarMetrics.length,
      metricScores,
    };
  }

  // Total score: Σ (pillarAvg × pillarWeight), excluding pillars with no data.
  // Weight from empty pillars is redistributed proportionally to pillars that have data.
  const activePillars = PILLARS.filter(p => (pillarScores[p.name]?.scoredCount ?? 0) > 0);

  const getPillarWeight = (p: typeof PILLARS[number]) =>
    scenario?.pillarWeights[p.name as Pillar] ?? p.totalWeight;

  const activeWeightSum = activePillars.reduce((s, p) => s + getPillarWeight(p), 0);

  const totalScore = activeWeightSum > 0
    ? activePillars.reduce((sum, p) => {
        const avg = pillarScores[p.name]?.score ?? 0;
        // Redistribute: scale each pillar's weight so active weights sum to 100
        const adjustedWeight = (getPillarWeight(p) / activeWeightSum) * 100;
        return sum + (avg / 5) * adjustedWeight;
      }, 0)
    : 0;

  return {
    market,
    pillarScores,
    totalScore: Math.round(totalScore * 10) / 10,
    rag: getRAG(totalScore),
  };
}

export function rankMarkets(markets: MarketInput[], scenario?: Scenario): ScoredMarket[] {
  const scored = markets.map(m => scoreMarket(m, scenario));
  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}
