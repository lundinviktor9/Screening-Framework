#!/usr/bin/env node
/**
 * Build pre-computed scored markets JSON for both React and Python.
 *
 * Reads UK_MARKETS + master_data.json, runs scoring, outputs scored_markets.json
 * Format: [{ id, name, pillarScores: { Supply, Demand, ... }, compositeScore }, ...]
 */

const fs = require('fs');
const path = require('path');

// ─── Metric thresholds and configuration (from src/data/metrics.ts) ───

const METRICS = require('../src/data/metrics.json').METRICS || [];
const CONFIG = { totalGreen: 70, totalAmber: 50 };
const PILLARS = [
  { name: 'Supply', totalWeight: 17 },
  { name: 'Demand', totalWeight: 17 },
  { name: 'Connectivity', totalWeight: 17 },
  { name: 'Labour', totalWeight: 17 },
  { name: 'Rents & Yields', totalWeight: 16 },
  { name: 'Strategic / Risk', totalWeight: 16 },
];

// ─── Scoring logic (mirrors src/utils/scoring.ts) ───

function scoreMetric(metricId, value) {
  if (value === null || value === undefined) return 0;
  const def = METRICS.find(m => m.id === metricId);
  if (!def) return 0;

  if (def.ruleType === 'Direct') {
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

function scoreMarket(market) {
  const pillarScores = {};

  for (const pillarDef of PILLARS) {
    const pillarMetrics = METRICS.filter(m => m.pillar === pillarDef.name);
    const metricScores = {};

    for (const metric of pillarMetrics) {
      // Look up metric value in market.metrics[id] and extract the .value property
      const metricData = market.metrics && market.metrics[metric.id];
      const raw = metricData && metricData.value;

      if (raw !== null && raw !== undefined) {
        metricScores[metric.id] = scoreMetric(metric.id, raw);
      }
    }

    const scored = Object.values(metricScores);
    const avg = scored.length > 0
      ? scored.reduce((a, b) => a + b, 0) / scored.length
      : 0;

    // Convert 1-5 scale to 0-100 scale: (score - 1) / 4 * 100
    const score100 = avg > 0 ? (avg - 1) / 4 * 100 : 0;

    pillarScores[pillarDef.name] = score100;
  }

  // Composite score: weighted average (same logic as React totalScore)
  const activePillars = PILLARS.filter(p => pillarScores[p.name] > 0);
  const activeWeightSum = activePillars.reduce((s, p) => s + p.totalWeight, 0);

  const compositeScore = activeWeightSum > 0
    ? activePillars.reduce((sum, p) => {
        const score = pillarScores[p.name];
        const adjustedWeight = (p.totalWeight / activeWeightSum) * 100;
        return sum + (score / 100) * adjustedWeight;
      }, 0)
    : 0;

  return {
    pillarScores: Object.fromEntries(
      Object.entries(pillarScores).map(([k, v]) => [k, Math.round(v * 10) / 10])
    ),
    compositeScore: Math.round(compositeScore * 10) / 10,
  };
}

// ─── Load data ───

const marketsFile = path.join(__dirname, '../src/data/ukMarkets.ts');
const masterDataFile = path.join(__dirname, '../public/data/master_data.json');

// Read markets from ukMarkets.ts by parsing the export statement
const marketsContent = fs.readFileSync(marketsFile, 'utf-8');
const marketListMatch = marketsContent.match(/export const UK_MARKETS: MarketInput\[\] = \[([\s\S]*?)\];/);
if (!marketListMatch) {
  console.error('❌ Could not parse UK_MARKETS from ukMarkets.ts');
  process.exit(1);
}

// For simplicity, manually construct market objects from a simpler approach:
// Load master_data.json which has all metric values for all markets
let masterData = {};
try {
  masterData = JSON.parse(fs.readFileSync(masterDataFile, 'utf-8'));
} catch (e) {
  console.warn('⚠️  master_data.json not found or invalid; will use placeholder values');
  masterData = { markets: {} };
}

// Build market list with values from master_data
const marketEntries = Object.entries(masterData.markets || {});
if (marketEntries.length === 0) {
  console.error('❌ No markets found in master_data.json');
  process.exit(1);
}

const scoredMarkets = marketEntries.map(([id, marketData]) => {
  const market = {
    id,
    name: marketData.name,
    region: marketData.region,
    metrics: marketData.metrics || {},
  };

  const scored = scoreMarket(market);

  return {
    id,
    name: marketData.name,
    region: marketData.region,
    pillarScores: scored.pillarScores,
    compositeScore: scored.compositeScore,
  };
});

// Sort by composite score descending
scoredMarkets.sort((a, b) => b.compositeScore - a.compositeScore);

// Write output
const outputFile = path.join(__dirname, '../public/data/scored_markets.json');
fs.writeFileSync(outputFile, JSON.stringify(scoredMarkets, null, 2));

console.log(`✅ Generated scored_markets.json with ${scoredMarkets.length} markets`);
console.log(`📁 File: ${outputFile}`);
console.log(`\n📊 Top 5 markets:`);
scoredMarkets.slice(0, 5).forEach((m, i) => {
  console.log(`  ${i + 1}. ${m.name} (${m.id}) - Score: ${m.compositeScore}`);
});
