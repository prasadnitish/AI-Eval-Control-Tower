export interface DimensionScores {
  relevance: number;
  accuracy: number;
  actionability: number;
  coherence: number;
  conciseness: number;
  // Optional dimensions present on SproutRoute-family datasets
  safety?: number;
  logistical_feasibility?: number;
}

export interface DayModel {
  quality_score: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  cost_per_inference: number;
  scores: DimensionScores;
}

export interface DailyEntry {
  date: string;
  model_a: DayModel;
  model_b: DayModel;
  per_model?: Record<string, DayModel>;
}

export interface DriftEvent {
  type: 'distribution_shift' | 'behaviour_shift';
  label: string;
  start: string;
  end: string | null;
  resolved: boolean;
  resolved_at: string | null;
  status: string;
  description: string;
}

export interface ModelPromptResult {
  response?: string;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost?: number;
  scores?: DimensionScores;
  quality_score?: number;
  reasoning?: string;
  error?: string;
}

export interface PromptResult {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  seller_profile_id: string | null;
  family_profile_id?: string | null;
  model_a_response?: string;
  model_b_response?: string;
  model_a_scores?: DimensionScores;
  model_b_scores?: DimensionScores;
  model_a_quality_score?: number;
  model_b_quality_score?: number;
  model_a_latency_ms?: number;
  model_b_latency_ms?: number;
  model_a_cost?: number;
  model_b_cost?: number;
  policy_violation?: boolean;
  model_a_reasoning?: string;
  model_b_reasoning?: string;
  model_responses?: Record<string, ModelPromptResult>;
  error?: string | null;
}

export interface PerModelSummary {
  name: string;
  provider: string;
  id: string;
  avg_quality: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  total_cost_usd: number;
  avg_cost_per_inference: number;
  policy_violations: number;
  dimension_averages: Record<string, number>;
}

export interface EvalSummary {
  model_a_avg_quality: number;
  model_b_avg_quality: number;
  model_a_p50_latency_ms: number;
  model_a_p95_latency_ms: number;
  model_a_p99_latency_ms: number;
  model_b_p50_latency_ms: number;
  model_b_p95_latency_ms: number;
  model_b_p99_latency_ms: number;
  model_a_total_cost_usd: number;
  model_b_total_cost_usd: number;
  model_a_avg_cost_per_inference: number;
  model_b_avg_cost_per_inference: number;
  policy_violations: number;
  judge_cost_usd?: number;
  per_model?: Record<string, PerModelSummary>;
}

export interface ModelMeta {
  name: string;
  provider: string;
  version: string;
  id?: string;
  tier?: string;
}

export interface RunMeta {
  generated_at: string;
  dataset: string;
  dataset_version: string;
  suite: string;
  prompt_count: number;
  judge_model: string;
  runner_version: string;
  run_id: string;
  errors?: number;
  baseline?: string;
  candidate?: string;
  models?: string[];
  provider?: string;
}

export interface EvalResults {
  meta: RunMeta;
  model_a: ModelMeta;
  model_b: ModelMeta;
  models?: Record<string, ModelMeta>;
  per_model?: Record<string, PerModelSummary>;
  summary: EvalSummary;
  daily: DailyEntry[];
  events: DriftEvent[];
  prompts: PromptResult[];
}

export type DateRange = '7d' | '14d' | '30d';
export type DatasetId = 'seller-intelligence-v1' | 'seller-intelligence-v2' | 'seller-support-v1' | 'seller-support-v2' | 'sproutroute-v1' | 'sproutroute-v2' | 'custom';
export type Verdict = 'GO' | 'CONDITIONAL GO' | 'NO-GO';

export interface GateThresholds {
  accuracyMin: number;
  p95LatencyMax: number;
  costPerInferenceMax: number;
  allowDrift: boolean;
}
