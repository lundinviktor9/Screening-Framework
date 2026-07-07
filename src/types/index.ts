export type Pillar =
  | 'Supply'
  | 'Demand'
  | 'Connectivity'
  | 'Labour'
  | 'Rents & Yields'
  | 'Strategic / Risk';

export type RuleType = 'Higher' | 'Lower' | 'Direct';

export type RAG = 'Green' | 'Amber' | 'Red';

export type GeographicLevel = 'market' | 'regional';
export type Confidence = 'primary_source' | 'estimated' | 'regional_proxy';
export type MetricStatusFlag = 'VERIFIED' | 'ESTIMATED' | 'REGIONAL_PROXY' | 'REVIEW_NEEDED';

export interface MetricDef {
  id: number;           // 1–60
  pillar: Pillar;
  name: string;
  unit: string;
  ruleType: RuleType;
  weight: number;       // points contributed to 100-pt total
  // Thresholds: score 5 → score 2 boundary values
  t5: number | null;    // null for Direct metrics
  t4: number | null;
  t3: number | null;
  t2: number | null;
  inputGuidance: string;
}

export interface MetricSource {
  sourceName: string;
  sourceUrl: string;
  dataDate: string;
  geographicLevel?: GeographicLevel;
  confidence?: Confidence;
  status?: MetricStatusFlag;
  justificationNote?: string;
  regionalSourceMarketId?: string; // ID of market where regional value was entered
}

export type PipelineStatus = 'untracked' | 'watchlist' | 'active' | 'passed' | 'invested';

export interface MarketInput {
  id: string;            // uuid
  name: string;
  region: string;
  notes: string;
  lat: number;           // centroid latitude
  lng: number;           // centroid longitude
  aliases: string[];     // alternative names for location matching
  isPreFilled?: boolean; // true = seeded from public data sources
  // metricId → raw value (number) or direct score (1–5)
  values: Record<number, number | null>;
  // metricId → source info
  sources: Record<number, MetricSource>;
  // Investment pipeline tracking
  pipelineStatus?: PipelineStatus;
  internalNotes?: string;
  pipelineUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PillarScore {
  pillar: Pillar;
  score: number;        // avg of metric scores in pillar (1–5 scale)
  scoredCount: number;  // how many metrics had data
  totalCount: number;   // total metrics in this pillar
  metricScores: Record<number, number>; // metricId → 1–5
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  pillarWeights: Record<Pillar, number>;
  metricWeights: Record<number, number>; // metricId → percentage (sums to 100 within each pillar)
}

export interface ScoredMarket {
  market: MarketInput;
  pillarScores: Record<Pillar, PillarScore>;
  totalScore: number;   // 0–100
  rank: number;
  rag: RAG;
}
