import type { EvalResults, PerModelSummary } from '../schema/types';
import sproutrouteFull from './sproutroute-full.json';
import sellerV3 from './seller-intelligence-v3.json';

export type DecisionTone = 'go' | 'watch' | 'nogo';
export type ScenarioId = 'seller-growth' | 'sproutmath-authoring' | 'sproutroute-travel';

export interface Candidate {
  id: string;
  name: string;
  provider: string;
  role: string;
  verdict: DecisionTone;
  verdictLabel: string;
  quality: number;
  trust: number;
  latencyMs: number;
  cost: number;
  why: string;
  constraint: string;
}

export interface Dimension {
  name: string;
  score: number;
  floor?: number;
  note: string;
}

export interface FailureMode {
  title: string;
  severity: 'Launch blocker' | 'Needs review' | 'Monitor';
  evidence: string;
  ownerAction: string;
}

export interface RolloutStep {
  stage: string;
  owner: string;
  action: string;
  exit: string;
}

export interface ReproCommand {
  label: string;
  command: string;
  detail: string;
}

export interface EvidencePack {
  datasetName: string;
  datasetFile: string;
  promptCount: string;
  checkedData: string[];
  judgeModel: string;
  judgeRole: string;
  scoreMethod: string[];
  confidenceChecks: string[];
  knownLimits: string[];
  runCommands: ReproCommand[];
  artifacts: string[];
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  shortTitle: string;
  domain: string;
  stakeholder: string;
  workflow: string;
  decisionQuestion: string;
  decision: DecisionTone;
  decisionLabel: string;
  recommendation: string;
  narrative: string;
  datasetLabel: string;
  sourceNote: string;
  highlightedPair: string;
  primaryMetric: string;
  primaryMetricLabel: string;
  hardFloor: string;
  hardFloorStatus: string;
  operatingMetric: string;
  operatingMetricLabel: string;
  candidates: Candidate[];
  dimensions: Dimension[];
  failureModes: FailureMode[];
  rollout: RolloutStep[];
  pmQuestions: string[];
  evidence: EvidencePack;
}

const sproutRoute = sproutrouteFull as unknown as EvalResults;
const seller = sellerV3 as unknown as EvalResults;

function perModel(results: EvalResults): Record<string, PerModelSummary> {
  return results.per_model || results.summary.per_model || {};
}

function candidateFromSummary(
  id: string,
  pm: PerModelSummary,
  role: string,
  verdict: DecisionTone,
  verdictLabel: string,
  why: string,
  constraint: string,
  trustDimension = 'safety',
): Candidate {
  const trust = pm.dimension_averages?.[trustDimension]
    ?? pm.dimension_averages?.accuracy
    ?? pm.avg_quality / 10;

  return {
    id,
    name: pm.name,
    provider: pm.provider,
    role,
    verdict,
    verdictLabel,
    quality: pm.avg_quality,
    trust,
    latencyMs: pm.p95_latency_ms,
    cost: pm.avg_cost_per_inference,
    why,
    constraint,
  };
}

const sproutRouteModels = perModel(sproutRoute);
const sellerModels = perModel(seller);

const SCENARIO_DEFINITIONS: Scenario[] = [
  {
    id: 'seller-growth',
    title: '3P Seller Growth Recommendations',
    shortTitle: 'Seller Growth',
    domain: 'Ecommerce account management',
    stakeholder: 'Account managers advising third-party sellers',
    workflow: 'Model drafts recommendation, evidence, and next-best-action for seller growth conversations.',
    decisionQuestion: 'Can this model produce account-manager-ready recommendations at lower cost without losing advisory quality?',
    decision: 'go',
    decisionLabel: 'Promote GPT-5 Mini for the default AM recommendation path',
    recommendation: 'Use GPT-5 Mini as the default recommendation engine. Keep Sonnet as an escalation path for strategic accounts where nuance is worth the slower, higher-cost run.',
    narrative: 'This is not a “which model is smartest?” review. It is a workflow economics review: the candidate must preserve recommendation quality, stay actionable for an AM, and reduce the cost of repeated seller-advice generation.',
    datasetLabel: '24 hard-eval prompts across seller advisory scenarios',
    sourceNote: 'Backed by the seller-intelligence-v3 baked eval result in this demo.',
    highlightedPair: 'Claude Sonnet 4.6 baseline vs GPT-5 Mini candidate',
    primaryMetric: '90.4',
    primaryMetricLabel: 'Candidate quality',
    hardFloor: 'Accuracy >= 8.5 and actionability >= 9.0',
    hardFloorStatus: 'Candidate clears both floors',
    operatingMetric: '$0.00286',
    operatingMetricLabel: 'Cost per recommendation',
    candidates: [
      candidateFromSummary(
        'gpt-5-mini',
        sellerModels['gpt-5-mini'],
        'Default AM recommendation engine',
        'go',
        'GO',
        'Higher average quality than Sonnet with stronger accuracy and actionability at roughly one-fifth the cost.',
        'Conciseness is weaker; templates should enforce tighter AM-ready output.',
        'accuracy',
      ),
      candidateFromSummary(
        'claude-sonnet-4.6',
        sellerModels['claude-sonnet-4.6'],
        'Strategic-account escalation model',
        'watch',
        'ESCALATE',
        'Excellent quality and actionability, but the unit economics are harder to justify for high-volume seller workflows.',
        'Use when account complexity warrants the latency and cost.',
        'accuracy',
      ),
    ],
    dimensions: [
      { name: 'Recommendation quality', score: 9.04, floor: 8.8, note: 'Candidate is strong enough for AM draft review.' },
      { name: 'Accuracy', score: 8.63, floor: 8.5, note: 'Clears the trust floor for seller guidance.' },
      { name: 'Actionability', score: 9.63, floor: 9.0, note: 'Strong next-step framing for account teams.' },
      { name: 'Conciseness', score: 7.17, floor: 7.0, note: 'Passes, but should be controlled with templates.' },
    ],
    failureModes: [
      {
        title: 'Overlong recommendation drafts',
        severity: 'Needs review',
        evidence: 'Candidate conciseness trails the quality and actionability dimensions.',
        ownerAction: 'Add response shape constraints and AM-facing summary templates.',
      },
      {
        title: 'Strategic seller nuance',
        severity: 'Monitor',
        evidence: 'Sonnet remains useful for edge cases where long-context synthesis matters more than cost.',
        ownerAction: 'Route only high-complexity accounts to the escalation model.',
      },
      {
        title: 'Workflow adoption risk',
        severity: 'Monitor',
        evidence: 'AMs need evidence and next action, not a generic AI answer.',
        ownerAction: 'Instrument accepted, edited, and rejected recommendation drafts.',
      },
    ],
    rollout: [
      { stage: 'Design review', owner: 'PM + AM lead', action: 'Lock AM recommendation template and escalation criteria.', exit: 'AM lead approves output shape.' },
      { stage: 'Pilot', owner: 'Seller success ops', action: 'Run candidate for a small seller cohort with human review.', exit: '>=80% drafts accepted or lightly edited.' },
      { stage: 'Scale', owner: 'Product analytics', action: 'Track accepted recommendations, seller follow-through, and cost per completed action.', exit: 'Cost and adoption stay inside operating envelope.' },
      { stage: 'Monitor', owner: 'Model ops', action: 'Watch quality drift and route failures to Sonnet escalation.', exit: 'No sustained drop in accuracy/actionability.' },
    ],
    pmQuestions: [
      'Would an AM trust this recommendation enough to send it after light review?',
      'What account complexity should trigger escalation?',
      'Does the cheaper model improve the workflow or only the margin?',
    ],
    evidence: {
      datasetName: 'seller-intelligence-v3',
      datasetFile: 'datasets/seller-intelligence-v3.json',
      promptCount: '24 prompts across 12 hard-eval seller advisory categories',
      checkedData: [
        'Seller account health, ODR, reserve holds, Buy Box pressure, return rates, suppression history, chargebacks, and margin snapshots.',
        'Account-manager tasks such as portfolio risk triage, price corridors, promo ROI, replenishment, and fee leakage diagnosis.',
        'Structured context_blocks are injected into every model call so the answer can be judged against the same evidence packet.',
      ],
      judgeModel: 'Claude Sonnet 4.6 via OpenRouter',
      judgeRole: 'LLM-as-judge scoring every model response with the same rubric and returning strict JSON.',
      scoreMethod: [
        'Dimensions: accuracy, actionability, relevance, coherence, and conciseness.',
        'Weighted quality score is calculated from config/judge-rubric.json; the release gate is enforced by eval/check-gate.js.',
        'The runner keeps per-prompt response text, per-dimension scores, judge reasoning, latency, tokens, and cost in output/local-results.json.',
      ],
      confidenceChecks: [
        'Same prompt, context, judge model, and rubric are applied to every candidate in the run.',
        'Dry-run estimates cost before spending; the real run writes an auditable JSON artifact.',
        'Use the baked results for portfolio demo, then rerun locally with your own OpenRouter key before trusting a new model decision.',
      ],
      knownLimits: [
        'LLM-as-judge is directional evidence, not a statistically certified benchmark.',
        'Production adoption should add human AM calibration examples and measure edited/accepted recommendations.',
      ],
      runCommands: [
        {
          label: 'Cost preview',
          command: 'npm run eval:dry -- --dataset seller-intelligence-v3 --suite smoke --models claude-sonnet-4.6,gpt-5-mini,gemini-2.5-flash',
          detail: 'Checks prompt count and estimated spend without calling any model.',
        },
        {
          label: 'Run seller eval',
          command: 'npm run eval:seller:v3',
          detail: 'Runs the hard-eval seller advisory smoke suite with your local OPENROUTER_API_KEY.',
        },
        {
          label: 'Apply gate',
          command: 'npm run gate -- output/local-results.json --baseline output/eval-results.json',
          detail: 'Turns the run artifact into a GO, CONDITIONAL GO, or NO-GO release decision.',
        },
      ],
      artifacts: [
        'config/models.json',
        'config/judge-rubric.json',
        'config/settings.json',
        'output/local-results.json',
      ],
    },
  },
  {
    id: 'sproutmath-authoring',
    title: 'SproutMath Question Generation Gate',
    shortTitle: 'SproutMath',
    domain: 'K-5 math content authoring',
    stakeholder: 'Curriculum owner reviewing AI-generated practice content before it enters a deterministic kids app',
    workflow: 'Model proposes grade-band questions, hints, distractors, and spoken forms; deterministic validators decide whether content can enter the bundled app.',
    decisionQuestion: 'Can AI speed up content authoring without weakening grade fit, answer validity, accessibility, or child safety?',
    decision: 'watch',
    decisionLabel: 'Use AI as an authoring assistant, not as runtime tutoring',
    recommendation: 'Adopt GPT-5 Mini for draft generation behind an offline validation pipeline. Keep the shipped app deterministic: no live model calls, no accounts, no child data leaving device.',
    narrative: 'This scenario is deliberately different from a live AI product. The PM decision is where to allow generation: upstream in content production, then lock the final questions into deterministic app content.',
    datasetLabel: 'Showcase authoring-gate dataset for K-5 question, hint, and distractor quality',
    sourceNote: 'Grounded in the Sprout Math repo posture: offline-first app, deterministic hint engine, content pack validation, local persistence, and release-prep QA.',
    highlightedPair: 'GPT-5 Mini draft generator vs deterministic content validator',
    primaryMetric: '94%',
    primaryMetricLabel: 'Auto-validated drafts',
    hardFloor: 'Answer validity, grade fit, and child-safety floors must all pass',
    hardFloorStatus: 'Authoring gate passes with review on accessibility language',
    operatingMetric: '0',
    operatingMetricLabel: 'Runtime model calls',
    candidates: [
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        provider: 'OpenAI',
        role: 'Default question draft generator',
        verdict: 'go',
        verdictLabel: 'AUTHOR',
        quality: 91.2,
        trust: 9.4,
        latencyMs: 8200,
        cost: 0.0019,
        why: 'Best balance of grade fit, valid answer structure, and cost for content-authoring batches.',
        constraint: 'Must remain behind validators; no runtime tutoring path.',
      },
      {
        id: 'claude-sonnet-4.6',
        name: 'Claude Sonnet 4.6',
        provider: 'Anthropic',
        role: 'Curriculum rewrite and explanation pass',
        verdict: 'watch',
        verdictLabel: 'REVIEW',
        quality: 92.4,
        trust: 9.5,
        latencyMs: 18500,
        cost: 0.0138,
        why: 'Strongest explanations, useful for rewriting difficult hints or parent-facing copy.',
        constraint: 'Too costly for broad generation when deterministic validators can catch structure issues.',
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        role: 'Low-latency brainstorm model',
        verdict: 'watch',
        verdictLabel: 'BRAINSTORM',
        quality: 86.9,
        trust: 8.8,
        latencyMs: 6400,
        cost: 0.0011,
        why: 'Fast and cheap for idea generation.',
        constraint: 'More review needed for grade-band precision and distractor quality.',
      },
    ],
    dimensions: [
      { name: 'Answer validity', score: 9.7, floor: 9.5, note: 'Every accepted item needs one deterministic answer.' },
      { name: 'Grade fit', score: 9.2, floor: 9.0, note: 'K-5 difficulty must match the unit and grade band.' },
      { name: 'Hint usefulness', score: 8.8, floor: 8.5, note: 'Hints should scaffold, not reveal the answer.' },
      { name: 'Accessibility language', score: 8.3, floor: 8.0, note: 'Spoken form and visual supports need human review.' },
      { name: 'Child safety', score: 9.6, floor: 9.5, note: 'No unsafe, adult, or data-collecting content.' },
    ],
    failureModes: [
      {
        title: 'Ambiguous answer key',
        severity: 'Launch blocker',
        evidence: 'Any generated item with multiple valid answers breaks deterministic scoring.',
        ownerAction: 'Reject automatically unless the validator can prove a single answer.',
      },
      {
        title: 'Grade-band drift',
        severity: 'Launch blocker',
        evidence: 'A K-1 spatial prompt cannot quietly become a multi-step reasoning question.',
        ownerAction: 'Gate by unit, grade band, operation type, and vocabulary complexity.',
      },
      {
        title: 'Runtime AI temptation',
        severity: 'Needs review',
        evidence: 'The app’s trust story depends on offline-first deterministic behavior.',
        ownerAction: 'Keep AI in the content pipeline only; ship bundled reviewed content.',
      },
    ],
    rollout: [
      { stage: 'Draft', owner: 'Curriculum PM', action: 'Generate candidate questions, hints, choices, and spoken forms.', exit: 'Draft batch maps cleanly to unit schema.' },
      { stage: 'Validate', owner: 'Content pipeline', action: 'Run deterministic answer, grade-fit, duplicate, and accessibility checks.', exit: 'No launch-blocking content issues.' },
      { stage: 'Review', owner: 'Parent/teacher reviewer', action: 'Spot-check confusing prompts and child-facing tone.', exit: 'Review notes closed or rejected.' },
      { stage: 'Bundle', owner: 'App release owner', action: 'Ship accepted content as local deterministic JSON.', exit: 'No runtime AI dependency added.' },
    ],
    pmQuestions: [
      'Which part of content creation benefits from generation without changing the child experience?',
      'What gets auto-rejected before a human ever sees it?',
      'Can the app preserve its privacy promise while using AI upstream?',
    ],
    evidence: {
      datasetName: 'sproutmath-authoring-v1',
      datasetFile: 'datasets/sproutmath-authoring-v1.json',
      promptCount: '10 prompts across answer validity, grade fit, hint scaffolding, accessibility, and child safety',
      checkedData: [
        'Generated question text, answer choices, answer key, hint, explanation, spoken form, and validation notes.',
        'Grade-band constraints for K-5 math skills such as counting, subtraction, multiplication, fractions, area, and shape language.',
        'Child-safety constraints: no personal data requests, no adult themes, no shame framing, and no runtime AI dependency in the app.',
      ],
      judgeModel: 'Claude Sonnet 4.6 via OpenRouter',
      judgeRole: 'Curriculum-quality judge evaluating generated content before it enters the deterministic app content bundle.',
      scoreMethod: [
        'Dimensions: answer_validity, grade_fit, hint_quality, accessibility_language, and child_safety.',
        'Hard floors apply to answer validity, grade fit, and child safety; a high average score cannot hide a failed launch-blocking dimension.',
        'The shipped app remains deterministic: accepted content becomes local JSON, not live model output shown to children.',
      ],
      confidenceChecks: [
        'The judge uses a child-content-specific rubric rather than the ecommerce or travel rubric.',
        'Every item is judged against its requested grade band, skill, constraints, and expected_quality context block.',
        'The eval artifact can be reviewed by curriculum owners before content is promoted into the app.',
      ],
      knownLimits: [
        'The current dataset is a showcase authoring gate, not a complete curriculum benchmark.',
        'Before production-scale use, add human-reviewed gold items and deterministic validators for answer-key proof, duplicates, and schema shape.',
      ],
      runCommands: [
        {
          label: 'Cost preview',
          command: 'npm run eval:dry -- --dataset sproutmath-authoring-v1 --suite smoke --models gpt-5-mini,claude-sonnet-4.6,gemini-2.5-flash',
          detail: 'Estimates the authoring-gate run before any API calls.',
        },
        {
          label: 'Run SproutMath authoring gate',
          command: 'npm run eval:sproutmath',
          detail: 'Runs the K-5 content-authoring eval with your local OPENROUTER_API_KEY.',
        },
        {
          label: 'Apply gate',
          command: 'npm run gate -- output/local-results.json --baseline output/eval-results.json',
          detail: 'Fails the release if answer validity, grade fit, or child safety drops below the floor.',
        },
      ],
      artifacts: [
        'datasets/sproutmath-authoring-v1.json',
        'config/judge-rubric.json',
        'eval/judge.js',
        'output/local-results.json',
      ],
    },
  },
  {
    id: 'sproutroute-travel',
    title: 'SproutRoute Itinerary + Safety Tips',
    shortTitle: 'SproutRoute',
    domain: 'Family travel planning',
    stakeholder: 'Parent using AI-generated itinerary guidance with safety-sensitive constraints',
    workflow: 'Model generates itinerary and family-safety guidance; gates check factuality, route feasibility, child-safety advice, latency, and cost.',
    decisionQuestion: 'Should the current production model keep serving family travel plans, or should the product promote a safer candidate?',
    decision: 'nogo',
    decisionLabel: 'Block current production path; promote Gemini or document exception',
    recommendation: 'Do not keep Haiku 4.5 as the default production path. Gemini 2.5 Flash is the practical promotion candidate because it clears safety while improving latency and cost.',
    narrative: 'This is the showcase example for why model choice is a PM decision. The quality delta alone looks small; the safety floor changes the launch decision.',
    datasetLabel: '7 models, 25 family-trip-planning prompts',
    sourceNote: 'Backed by the SproutRoute full baked eval result in this demo.',
    highlightedPair: 'Claude Haiku 4.5 current baseline vs Gemini 2.5 Flash candidate',
    primaryMetric: '7.64',
    primaryMetricLabel: 'Current safety score',
    hardFloor: 'Safety >= 8.0',
    hardFloorStatus: 'Current model fails; Gemini passes at 8.16',
    operatingMetric: '9.8s',
    operatingMetricLabel: 'Gemini p95 latency',
    candidates: [
      candidateFromSummary(
        'gemini-2.5-flash',
        sproutRouteModels['gemini-2.5-flash'],
        'Practical promotion candidate',
        'go',
        'GO',
        'Clears the safety floor while beating the current model on latency and cost.',
        'Quality is not the field leader; monitor itinerary richness.',
      ),
      candidateFromSummary(
        'claude-haiku-4.5',
        sproutRouteModels['claude-haiku-4.5'],
        'Current production baseline',
        'nogo',
        'NO-GO',
        'Current default fails the 8.0 safety hard floor.',
        'Must not remain default without remediation or exception.',
      ),
      candidateFromSummary(
        'claude-sonnet-4.6',
        sproutRouteModels['claude-sonnet-4.6'],
        'Quality leader',
        'watch',
        'REVIEW',
        'Best raw quality and strong safety.',
        'Latency and cost make it an escalation model, not the default.',
      ),
      candidateFromSummary(
        'gpt-5-mini',
        sproutRouteModels['gpt-5-mini'],
        'High-quality alternative',
        'watch',
        'REVIEW',
        'Strong quality and safety.',
        'P95 latency is too high for default trip generation.',
      ),
      candidateFromSummary(
        'grok-4-fast',
        sproutRouteModels['grok-4-fast'],
        'Low-cost candidate',
        'nogo',
        'NO-GO',
        'Cheap, but fails the safety floor.',
        'Cost cannot override family-safety gates.',
      ),
      candidateFromSummary(
        'gpt-5-nano',
        sproutRouteModels['gpt-5-nano'],
        'Low-cost fallback',
        'watch',
        'REVIEW',
        'Very low cost with a passing safety score.',
        'Latency and quality do not beat Gemini for the default path.',
      ),
      candidateFromSummary(
        'deepseek-v3.2',
        sproutRouteModels['deepseek-v3.2'],
        'Experimental comparator',
        'watch',
        'REVIEW',
        'Passes safety and has decent quality.',
        'P95 latency is far outside the interactive travel-planning envelope.',
      ),
    ],
    dimensions: [
      { name: 'Safety', score: 8.16, floor: 8.0, note: 'Gemini clears the hard floor; Haiku does not.' },
      { name: 'Accuracy', score: 7.4, floor: 7.0, note: 'Needs deterministic checks for facts and routes.' },
      { name: 'Actionability', score: 8.2, floor: 8.0, note: 'Enough practical guidance for parent planning.' },
      { name: 'Logistical feasibility', score: 7.1, floor: 7.0, note: 'Passes, but route validation should stay deterministic.' },
      { name: 'Conciseness', score: 6.3, floor: 6.0, note: 'Verbose outputs need UI summarization.' },
    ],
    failureModes: [
      {
        title: 'Family-safety misinformation',
        severity: 'Launch blocker',
        evidence: 'Haiku scored 7.64 on safety against an 8.0 hard floor.',
        ownerAction: 'Block current model until safety failures are fixed or route traffic to Gemini.',
      },
      {
        title: 'Closed or impossible itinerary recommendation',
        severity: 'Launch blocker',
        evidence: 'The eval captured errors such as stale attraction recommendations and infeasible routing.',
        ownerAction: 'Keep places, routing, weather, and rules behind deterministic verification.',
      },
      {
        title: 'Rich but expensive itinerary generation',
        severity: 'Needs review',
        evidence: 'Sonnet leads quality but carries materially higher cost and latency.',
        ownerAction: 'Use Sonnet only for premium or retry/escalation paths.',
      },
    ],
    rollout: [
      { stage: 'Immediate gate', owner: 'PM + engineering', action: 'Stop treating current Haiku path as automatically shippable.', exit: 'Release gate says NO-GO until model route changes.' },
      { stage: 'Candidate switch', owner: 'Backend owner', action: 'Route default itinerary generation to Gemini behind a feature flag.', exit: 'Safety floor and latency envelope pass on canary traffic.' },
      { stage: 'Deterministic guardrails', owner: 'Platform owner', action: 'Validate places, weather, train/car-seat claims, and safety rules outside the model.', exit: 'Known factual-error classes have non-model checks.' },
      { stage: 'Monitor', owner: 'Product analytics', action: 'Track safety regressions, parent edits, reruns, and trip-plan completion.', exit: 'No sustained safety or completion regression.' },
    ],
    pmQuestions: [
      'Which failures are unacceptable even if average quality is acceptable?',
      'Which checks should never be delegated to the model?',
      'Is the best model the default model, or the escalation model?',
    ],
    evidence: {
      datasetName: 'sproutroute-v2',
      datasetFile: 'datasets/sproutroute-v2.json',
      promptCount: '25 prompts across 7 family travel-planning categories',
      checkedData: [
        'Trip request, family profile, age and accessibility constraints, weather forecast, regulatory context, dietary needs, and activity preferences.',
        'Travel tasks including itinerary generation, packing lists, car-seat safety, allergy plans, weather changes, dietary accommodations, theme parks, and international travel.',
        'Family personas from datasets/sproutroute-profiles.json are injected where prompts reference reusable profile IDs.',
      ],
      judgeModel: 'Claude Sonnet 4.6 via OpenRouter',
      judgeRole: 'Safety-sensitive travel judge scoring every candidate response against the same family-travel rubric.',
      scoreMethod: [
        'Dimensions: relevance, accuracy, actionability, coherence, conciseness, safety, and logistical_feasibility.',
        'Safety is a hard floor at 8.0; the release gate blocks any model that drops below it even if total quality looks acceptable.',
        'The runner records per-model responses, judge reasoning, per-dimension averages, p50/p95/p99 latency, token usage, and cost.',
      ],
      confidenceChecks: [
        'The same prompt pack and judge prompt are used across all seven candidate models.',
        'Policy violations and safety hard-floor failures are separated from weighted average quality.',
        'Results are reproducible locally through OpenRouter; new teams can swap model slugs in config/models.json.',
      ],
      knownLimits: [
        'The judge can identify likely safety/logistics failures, but real launch still needs deterministic checks for places, hours, weather, and regulations.',
        'The 25-prompt full suite is enough for a portfolio model-choice demo, not for final production certification.',
      ],
      runCommands: [
        {
          label: 'Cost preview',
          command: 'npm run eval:dry -- --dataset sproutroute-v2 --suite full --models claude-haiku-4.5,claude-sonnet-4.6,gpt-5-mini,gpt-5-nano,grok-4-fast,gemini-2.5-flash,deepseek-v3.2',
          detail: 'Shows estimated spend for the full seven-model travel eval.',
        },
        {
          label: 'Run full SproutRoute lab',
          command: 'npm run eval:sproutroute:full',
          detail: 'Runs 7 models across all 25 prompts with your local OPENROUTER_API_KEY.',
        },
        {
          label: 'Apply gate',
          command: 'npm run gate -- output/local-results.json --baseline output/eval-results.json',
          detail: 'Blocks models that miss the safety floor or exceed launch thresholds.',
        },
      ],
      artifacts: [
        'datasets/sproutroute-v2.json',
        'datasets/sproutroute-profiles.json',
        'src/data/sproutroute-full.json',
        'output/local-results.json',
      ],
    },
  },
];

const SCENARIO_ORDER: ScenarioId[] = [
  'sproutroute-travel',
  'seller-growth',
  'sproutmath-authoring',
];

export const SCENARIOS: Scenario[] = SCENARIO_ORDER.map((id) => {
  const scenario = SCENARIO_DEFINITIONS.find((item) => item.id === id);

  if (!scenario) {
    throw new Error(`Missing scenario definition for ${id}`);
  }

  return scenario;
});

export function getScenario(id: ScenarioId): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) || SCENARIOS[0];
}
