export interface DimensionScores {
  relevance: number;
  accuracy: number;
  actionability: number;
  coherence: number;
  conciseness: number;
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

export interface PromptResult {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  seller_profile_id: string | null;
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
  error?: string;
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
}

export interface ModelMeta {
  name: string;
  provider: string;
  version: string;
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
}

export interface EvalResults {
  meta: RunMeta;
  model_a: ModelMeta;
  model_b: ModelMeta;
  summary: EvalSummary;
  daily: DailyEntry[];
  events: DriftEvent[];
  prompts: PromptResult[];
}

export type DateRange = '7d' | '14d' | '30d';
export type DatasetId = 'seller-intelligence-v1' | 'seller-support-v1' | 'custom';
export type Verdict = 'GO' | 'CONDITIONAL GO' | 'NO-GO';

export interface GateThresholds {
  accuracyMin: number;
  p95LatencyMax: number;
  costPerInferenceMax: number;
  allowDrift: boolean;
}

export type SpanStatus = 'ok' | 'error' | 'fallback' | 'skipped';
export interface TraceSpan { span_id:string; label:string; parent_span_id:string|null; start_ms:number; end_ms:number; status:SpanStatus; cost:number|null; detail:Record<string,unknown>|null; }
export interface Trace { meta:{run_id:string;tenant_id:string;service_id:string;environment:string;started_at:string;total_cost:number;source:'eval-runner'|'orchestrator';offsets_reconstructed?:boolean};spans:TraceSpan[]; }
