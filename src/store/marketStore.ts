import { create } from 'zustand';
import type { MarketInput, MetricSource, MetricStatusFlag, PipelineStatus, Scenario, Pillar } from '../types';
import { UK_MARKETS } from '../data/ukMarkets';
import { rankMarkets } from '../utils/scoring';
import type { ScoredMarket } from '../types';
import { mergeMasterData, type MasterData } from '../utils/dataMerger';
import { PILLARS, METRICS } from '../data/metrics';

// ─── Sensitivity scenarios ────────────────────────────────────────────────────
const SCENARIOS_KEY = 'sf_scenarios_v2';
const DEFAULT_PILLAR_WEIGHTS = [17, 17, 17, 17, 16, 16];

function createDefaultScenario(): Scenario {
  const metricWeights: Record<number, number> = {};
  const pillarWeights: Record<Pillar, number> = {} as Record<Pillar, number>;

  // Initialize pillar weights from PILLARS config
  PILLARS.forEach((p, i) => {
    pillarWeights[p.name as Pillar] = DEFAULT_PILLAR_WEIGHTS[i];
  });

  // Initialize metric weights: even distribution within each pillar (with proper rounding)
  for (const pillar of PILLARS) {
    const pillarMetrics = METRICS.filter(m => m.pillar === pillar.name);
    const metricIds = pillarMetrics.map(m => m.id);
    const weights = distributeWeightsEvenly(metricIds);
    Object.assign(metricWeights, weights);
  }

  return {
    id: 'default',
    name: 'Default',
    createdAt: new Date().toISOString(),
    pillarWeights,
    metricWeights,
  };
}

function readScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    return raw ? JSON.parse(raw) : [createDefaultScenario()];
  } catch { return [createDefaultScenario()]; }
}

function writeScenarios(s: Scenario[]) {
  localStorage.setItem(SCENARIOS_KEY, JSON.stringify(s));
}

function scenarioEqual(a: Scenario, b: Scenario): boolean {
  return JSON.stringify(a.pillarWeights) === JSON.stringify(b.pillarWeights) &&
         JSON.stringify(a.metricWeights) === JSON.stringify(b.metricWeights);
}

/** Distribute 100% among n metrics with proper rounding (ensures exactly 100% total).
 *  Uses floor(100/n) for each metric, distributes remainder to first k metrics. */
function distributeWeightsEvenly(metricIds: number[]): Record<number, number> {
  const n = metricIds.length;
  if (n === 0) return {};

  const weights: Record<number, number> = {};
  const baseWeight = Math.floor(100 / n);
  const remainder = 100 - (baseWeight * n);

  for (let i = 0; i < n; i++) {
    weights[metricIds[i]] = baseWeight + (i < remainder ? 1 : 0);
  }

  return weights;
}

// ─── Rank history (for "vs last refresh" indicator) ───────────────────────────
const RANK_HISTORY_KEY = 'sf_rank_history';
export interface RankHistory {
  snapshotDate: string;       // when the snapshot was taken
  masterDataDate: string | null;
  ranks: Record<string, number>; // marketId -> rank at snapshot
}
function readRankHistory(): RankHistory | null {
  try {
    const raw = localStorage.getItem(RANK_HISTORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeRankHistory(h: RankHistory) {
  localStorage.setItem(RANK_HISTORY_KEY, JSON.stringify(h));
}

// ─── Portfolio assets ─────────────────────────────────────────────────────────
const PORTFOLIO_KEY = 'sf_portfolio_assets';
export interface PortfolioAsset {
  id: string;
  name: string;
  lat: number;
  lng: number;
  marketId?: string;     // nearest market (auto-linked)
  assetType?: string;    // e.g. "Warehouse", "Logistics park"
  sizeSqft?: number;
  notes?: string;
  addedAt: string;
}
function readPortfolio(): PortfolioAsset[] {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writePortfolio(a: PortfolioAsset[]) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(a));
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sf_markets_v2';
const VERSION_KEY = 'sf_data_version';
const CURRENT_VERSION = 5; // v5: M41/M42 redefined £psf (Newmark) + M65-M72 added

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFromStorage(): MarketInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...UK_MARKETS];
    const parsed: MarketInput[] = JSON.parse(raw);
    return parsed.length > 0 ? parsed : [...UK_MARKETS];
  } catch {
    return [...UK_MARKETS];
  }
}

function writeToStorage(markets: MarketInput[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(markets));
}

/** One-time migration: assign status flags to legacy sources that lack them,
 *  and drop removed markets (uk-76 Belfast in v4). */
function migrateStatuses(markets: MarketInput[]): MarketInput[] {
  const version = Number(localStorage.getItem(VERSION_KEY) || '0');
  if (version >= CURRENT_VERSION) return markets;

  let migrated = markets.map(m => {
    const sources = { ...m.sources };
    for (const key of Object.keys(sources)) {
      const id = Number(key);
      const src = sources[id];
      if (src && !src.status) {
        sources[id] = {
          ...src,
          status: m.isPreFilled ? 'VERIFIED' as MetricStatusFlag : 'ESTIMATED' as MetricStatusFlag,
          geographicLevel: src.geographicLevel ?? 'market',
          confidence: m.isPreFilled ? 'primary_source' : 'estimated',
        };
      }
    }
    return { ...m, sources };
  });

  // v4: Belfast dropped from the matrix (VOA + NOMIS BRES gaps make it unreliable)
  migrated = migrated.filter(m => m.id !== 'uk-76');

  // v5: M41/M42 redefined (index → £psf, Newmark source). Clear legacy index
  // values so the new Newmark-sourced values flow in cleanly via master_data.json.
  if (version < 5) {
    migrated = migrated.map(m => {
      const values = { ...m.values };
      const sources = { ...m.sources };
      for (const id of [41, 42]) {
        const v = values[id];
        // Only clear if the legacy index value (50-250 range); preserve real £psf values
        if (typeof v === 'number' && v > 30) {
          values[id] = null;
          delete sources[id];
        }
      }
      return { ...m, values, sources };
    });
  }

  localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
  writeToStorage(migrated);
  return migrated;
}

/** Return a copy of markets with REVIEW_NEEDED values nullified for scoring. */
function toScorable(markets: MarketInput[]): MarketInput[] {
  return markets.map(m => {
    const values = { ...m.values };
    for (const key of Object.keys(m.sources)) {
      const id = Number(key);
      if (m.sources[id]?.status === 'REVIEW_NEEDED') {
        values[id] = null;
      }
    }
    return { ...m, values };
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface MarketStore {
  markets: MarketInput[];
  masterDataDate: string | null; // generated_at from master_data.json
  _lastTick: number; // forces re-render on mutation

  // Derived (call these, don't subscribe)
  getScoredMarkets: () => ScoredMarket[];

  // Actions
  reload: () => void;
  loadMasterData: () => Promise<void>;
  saveAll: (markets: MarketInput[]) => void;
  addMarket: (market: MarketInput) => void;
  updateMarket: (market: MarketInput) => void;
  deleteMarket: (id: string) => void;
  resetToDefaults: () => void;

  /** Update a single metric value + source metadata for one market. */
  updateMetricValue: (
    marketId: string,
    metricId: number,
    value: number | null,
    source: MetricSource,
  ) => void;

  /** Cascade a regional proxy value to all markets in the same region. */
  cascadeRegionalProxy: (
    originMarketId: string,
    region: string,
    metricId: number,
    value: number | null,
    source: Omit<MetricSource, 'status' | 'geographicLevel' | 'confidence' | 'regionalSourceMarketId'>,
  ) => void;

  /** Set pipeline status + notes for a market */
  setPipelineStatus: (marketId: string, status: PipelineStatus, notes?: string) => void;

  // ─── Sensitivity scenarios (legacy pillar-weight only) ───
  scenarios: Scenario[];
  saveScenario: (name: string, weights: number[]) => void;
  deleteScenario: (name: string) => void;

  // ─── Metric-level scenarios ───
  currentScenario: Scenario;
  hasUnsavedChanges: boolean;
  updateMetricWeight: (metricId: number, newPercentage: number) => void;
  updatePillarWeights: (changedPillar: Pillar, newVal: number) => void;
  loadScenario: (scenarioId: string) => void;
  saveChanges: () => void;
  saveAsNew: (name: string) => void;
  renameScenario: (id: string, newName: string) => void;
  deleteScenario: (id: string) => void;
  resetToDefault: () => void;

  // ─── Rank history ───
  previousRanks: Record<string, number>; // marketId -> previous rank
  snapshotRanks: () => void; // take current ranks → previousRanks

  // ─── Portfolio assets ───
  portfolioAssets: PortfolioAsset[];
  addPortfolioAsset: (a: Omit<PortfolioAsset, 'id' | 'addedAt'>) => void;
  updatePortfolioAsset: (id: string, patch: Partial<PortfolioAsset>) => void;
  deletePortfolioAsset: (id: string) => void;
  clearPortfolio: () => void;
}

export const useMarketStore = create<MarketStore>((set, get) => {
  // Initialise from localStorage with migration
  const initial = migrateStatuses(readFromStorage());

  // Kick off async master_data.json load immediately
  const _initPromise = (async () => {
    try {
      const resp = await fetch('/data/master_data.json');
      if (!resp.ok) return;
      const master: MasterData = await resp.json();
      const merged = mergeMasterData(initial, master);
      writeToStorage(merged);
      // Use set on the store directly (zustand supports this from the create callback)
      useMarketStore.setState({
        markets: merged,
        masterDataDate: master.generated_at || null,
        _lastTick: Date.now(),
      });
    } catch {
      // master_data.json not available — continue with localStorage data only
    }
  })();

  // Load rank history so we can show movement indicators
  const storedHistory = readRankHistory();
  const previousRanksInit = storedHistory?.ranks ?? {};

  // Load scenarios and initialize current scenario
  let loadedScenarios = readScenarios();
  const defaultScenario = createDefaultScenario();

  // Ensure Default scenario exists
  if (!loadedScenarios.find(s => s.id === 'default')) {
    loadedScenarios = [defaultScenario, ...loadedScenarios];
    writeScenarios(loadedScenarios);
  }

  const currentScenarioInit = loadedScenarios.find(s => s.id === 'default') || defaultScenario;

  return {
    markets: initial,
    masterDataDate: null,
    _lastTick: 0,
    scenarios: loadedScenarios,
    currentScenario: currentScenarioInit,
    hasUnsavedChanges: false,
    previousRanks: previousRanksInit,
    portfolioAssets: readPortfolio(),

    getScoredMarkets: () => {
      return rankMarkets(toScorable(get().markets), get().currentScenario);
    },

    reload: () => {
      const markets = migrateStatuses(readFromStorage());
      set({ markets, _lastTick: Date.now() });
    },

    loadMasterData: async () => {
      try {
        const resp = await fetch('/data/master_data.json');
        if (!resp.ok) return;
        const master: MasterData = await resp.json();
        const merged = mergeMasterData(get().markets, master);
        writeToStorage(merged);
        set({ markets: merged, masterDataDate: master.generated_at || null, _lastTick: Date.now() });
      } catch {
        // master_data.json not available
      }
    },

    saveAll: (markets: MarketInput[]) => {
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    addMarket: (market: MarketInput) => {
      const markets = [...get().markets, market];
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    updateMarket: (market: MarketInput) => {
      const markets = get().markets.map(m => m.id === market.id ? market : m);
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    deleteMarket: (id: string) => {
      const markets = get().markets.filter(m => m.id !== id);
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    resetToDefaults: () => {
      const markets = [...UK_MARKETS];
      localStorage.removeItem(VERSION_KEY);
      writeToStorage(markets);
      const migrated = migrateStatuses(readFromStorage());
      set({ markets: migrated, _lastTick: Date.now() });
    },

    updateMetricValue: (marketId, metricId, value, source) => {
      const markets = get().markets.map(m => {
        if (m.id !== marketId) return m;
        return {
          ...m,
          values: { ...m.values, [metricId]: value },
          sources: { ...m.sources, [metricId]: source },
          updatedAt: new Date().toISOString(),
        };
      });
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    cascadeRegionalProxy: (originMarketId, region, metricId, value, source) => {
      const cascadedSource: MetricSource = {
        ...source,
        geographicLevel: 'regional',
        confidence: 'regional_proxy',
        status: 'REGIONAL_PROXY',
        regionalSourceMarketId: originMarketId,
      };
      const originSource: MetricSource = {
        ...source,
        geographicLevel: 'regional',
        confidence: 'regional_proxy',
        status: 'REGIONAL_PROXY',
      };

      const markets = get().markets.map(m => {
        if (m.region !== region) return m;
        const src = m.id === originMarketId ? originSource : cascadedSource;
        return {
          ...m,
          values: { ...m.values, [metricId]: value },
          sources: { ...m.sources, [metricId]: src },
          updatedAt: new Date().toISOString(),
        };
      });
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    setPipelineStatus: (marketId, status, notes) => {
      const now = new Date().toISOString();
      const markets = get().markets.map(m => {
        if (m.id !== marketId) return m;
        return {
          ...m,
          pipelineStatus: status,
          internalNotes: notes !== undefined ? notes : m.internalNotes,
          pipelineUpdatedAt: now,
          updatedAt: now,
        };
      });
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    saveScenario: (name, weights) => {
      const existing = get().scenarios.filter(s => s.name !== name);
      const updated = [...existing, { name, weights: [...weights], savedAt: new Date().toISOString() }];
      writeScenarios(updated);
      set({ scenarios: updated });
    },

    deleteScenario: (name) => {
      const updated = get().scenarios.filter(s => s.name !== name);
      writeScenarios(updated);
      set({ scenarios: updated });
    },

    updateMetricWeight: (metricId, newPercentage) => {
      const current = get().currentScenario;
      const metric = METRICS.find(m => m.id === metricId);
      if (!metric) return;

      const metricWeights = { ...current.metricWeights };
      const oldWeight = metricWeights[metricId] || 0;
      const delta = newPercentage - oldWeight;

      // Get all metrics in the same pillar
      const pillarMetrics = METRICS.filter(m => m.pillar === metric.pillar);
      const otherMetrics = pillarMetrics.filter(m => m.id !== metricId);

      // Clamp new value and update
      metricWeights[metricId] = Math.max(0, Math.min(100, newPercentage));

      // Auto-rebalance: proportionally adjust other metrics in the same pillar
      const otherWeights = otherMetrics.reduce((sum, m) => sum + (metricWeights[m.id] || 0), 0);

      if (otherWeights > 0) {
        otherMetrics.forEach(m => {
          const proportion = (metricWeights[m.id] || 0) / otherWeights;
          metricWeights[m.id] = Math.max(0, (metricWeights[m.id] || 0) - delta * proportion);
        });
      }

      // Normalize to sum to exactly 100 within the pillar using proper rounding
      const pillarMetricIds = pillarMetrics.map(m => m.id).sort((a, b) => {
        // Sort by current weight descending, so we preserve large weights in the main rounding
        return (metricWeights[b] || 0) - (metricWeights[a] || 0);
      });

      // Calculate proportions and scale to 100
      const pillarSum = pillarMetricIds.reduce((sum, id) => sum + (metricWeights[id] || 0), 0);
      const scaledWeights: Record<number, number> = {};

      if (pillarSum > 0) {
        // First pass: calculate scaled proportions
        const proportions = pillarMetricIds.map(id => ({
          id,
          proportion: (metricWeights[id] || 0) / pillarSum,
        }));

        // Calculate base weights (floor) and track remainder
        const baseWeights = proportions.map(p => ({
          ...p,
          baseWeight: Math.floor(p.proportion * 100),
        }));

        const totalBase = baseWeights.reduce((sum, w) => sum + w.baseWeight, 0);
        const remainder = 100 - totalBase;

        // Distribute remainder to metrics with largest fractional parts
        const fractionalParts = baseWeights.map((w, i) => ({
          id: w.id,
          baseWeight: w.baseWeight,
          fractional: (w.proportion * 100) - w.baseWeight,
          index: i,
        }));

        // Sort by fractional part descending
        const sorted = [...fractionalParts].sort((a, b) => b.fractional - a.fractional);

        // Assign base weights first
        for (const item of sorted) {
          scaledWeights[item.id] = item.baseWeight;
        }

        // Add 1 to top remainder items
        for (let i = 0; i < remainder; i++) {
          scaledWeights[sorted[i].id]++;
        }
      } else {
        // If all zero, distribute evenly
        const evenWeights = distributeWeightsEvenly(pillarMetricIds);
        Object.assign(scaledWeights, evenWeights);
      }

      // Apply normalized weights
      pillarMetricIds.forEach(id => {
        metricWeights[id] = scaledWeights[id];
      });

      const updated = { ...current, metricWeights };
      const savedScenario = get().scenarios.find(s => s.id === updated.id);
      const hasChanges = !savedScenario || !scenarioEqual(updated, savedScenario);
      set({ currentScenario: updated, hasUnsavedChanges: hasChanges });
    },

    updatePillarWeights: (changedPillar, newVal) => {
      const current = get().currentScenario;
      const clamped = Math.max(0, Math.min(100, newVal));
      const names = PILLARS.map(p => p.name as Pillar);
      const old = current.pillarWeights;
      const oldVal = old[changedPillar];
      const delta = clamped - oldVal;
      const othersSum = names.reduce((s, n) => n === changedPillar ? s : s + old[n], 0);

      let next = { ...old, [changedPillar]: clamped };
      if (othersSum > 0) {
        names.filter(n => n !== changedPillar).forEach(n => {
          next[n] = Math.max(0, old[n] - delta * (old[n] / othersSum));
        });
      }

      // Normalize to exactly 100
      const sum = names.reduce((s, n) => s + next[n], 0);
      if (sum > 0) names.forEach(n => { next[n] = (next[n] / sum) * 100; });

      const updated = { ...current, pillarWeights: next };
      const savedScenario = get().scenarios.find(s => s.id === updated.id);
      const hasChanges = !savedScenario || !scenarioEqual(updated, savedScenario);
      set({ currentScenario: updated, hasUnsavedChanges: hasChanges });
    },

    loadScenario: (scenarioId) => {
      const scenario = get().scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        set({ currentScenario: scenario, hasUnsavedChanges: false });
      }
    },

    saveChanges: () => {
      const current = get().currentScenario;
      if (current.id === 'default') {
        // Default scenario cannot be overwritten, save as new instead
        get().saveAsNew(`${current.name} (copy)`);
        return;
      }

      const scenarios = get().scenarios.map(s =>
        s.id === current.id ? current : s
      );
      writeScenarios(scenarios);
      set({ scenarios, hasUnsavedChanges: false });
    },

    saveAsNew: (name) => {
      const current = get().currentScenario;
      const newId = `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newScenario: Scenario = {
        ...current,
        id: newId,
        name,
        createdAt: new Date().toISOString(),
      };

      const scenarios = [...get().scenarios, newScenario];
      writeScenarios(scenarios);
      set({ scenarios, currentScenario: newScenario, hasUnsavedChanges: false });
    },

    renameScenario: (id, newName) => {
      if (id === 'default') return; // Cannot rename default

      const scenarios = get().scenarios.map(s =>
        s.id === id ? { ...s, name: newName } : s
      );
      writeScenarios(scenarios);

      const current = get().currentScenario;
      const updated = current.id === id ? { ...current, name: newName } : current;
      set({ scenarios, currentScenario: updated });
    },

    deleteScenario: (id) => {
      if (id === 'default') return; // Cannot delete default

      const scenarios = get().scenarios.filter(s => s.id !== id);
      writeScenarios(scenarios);

      // If deleted scenario was active, switch to default
      const current = get().currentScenario;
      if (current.id === id) {
        const defaultScenario = scenarios.find(s => s.id === 'default') || createDefaultScenario();
        set({ scenarios, currentScenario: defaultScenario, hasUnsavedChanges: false });
      } else {
        set({ scenarios });
      }
    },

    resetToDefault: () => {
      // Create a fresh default scenario (ensures proper rounding)
      const defaultScenario = createDefaultScenario();
      set({ currentScenario: defaultScenario, hasUnsavedChanges: false });
    },

    snapshotRanks: () => {
      const scored = rankMarkets(toScorable(get().markets), get().currentScenario);
      const ranks: Record<string, number> = {};
      scored.forEach(m => { ranks[m.market.id] = m.rank; });
      const history: RankHistory = {
        snapshotDate: new Date().toISOString(),
        masterDataDate: get().masterDataDate,
        ranks,
      };
      writeRankHistory(history);
      set({ previousRanks: ranks });
    },

    addPortfolioAsset: (a) => {
      const next: PortfolioAsset = {
        ...a,
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        addedAt: new Date().toISOString(),
      };
      const updated = [...get().portfolioAssets, next];
      writePortfolio(updated);
      set({ portfolioAssets: updated });
    },

    updatePortfolioAsset: (id, patch) => {
      const updated = get().portfolioAssets.map(a => a.id === id ? { ...a, ...patch } : a);
      writePortfolio(updated);
      set({ portfolioAssets: updated });
    },

    deletePortfolioAsset: (id) => {
      const updated = get().portfolioAssets.filter(a => a.id !== id);
      writePortfolio(updated);
      set({ portfolioAssets: updated });
    },

    clearPortfolio: () => {
      writePortfolio([]);
      set({ portfolioAssets: [] });
    },
  };
});

// ─── Convenience selectors ────────────────────────────────────────────────────

/** Generate a unique market ID. */
export function generateId(): string {
  return `market-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
