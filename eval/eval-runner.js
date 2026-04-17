#!/usr/bin/env node
/**
 * eval-runner.js — N-way CLI evaluation runner for AI Evals Control Tower
 *
 * Usage:
 *   node eval/eval-runner.js \
 *     --models claude-sonnet-4.6,gpt-5-nano,grok-4-fast,gemini-2.5-flash \
 *     --dataset sproutroute-v2 \
 *     --suite smoke \
 *     --baseline claude-sonnet-4.6 \
 *     --candidate gpt-5-nano \
 *     --output output/eval-results.json
 *
 * Flags:
 *   --models       Comma-separated model slugs from config/models.json (≥2).
 *                  Back-compat: --model-a/--model-b still accepted for exactly 2-way runs.
 *   --dataset      Dataset id ("sproutroute-v2") or path ("datasets/sproutroute-v2.json")
 *   --suite        'smoke' (N per category per suite config) or 'full' [default: full]
 *   --baseline     Model slug to treat as baseline in the gate/dashboard (default: first in --models)
 *   --candidate    Model slug to treat as candidate (default: second in --models)
 *   --output       Output path [default: output/eval-results.json]
 *   --dry-run      Estimate cost + prompts, don't call any models
 *   --skip-validate  Skip OpenRouter pre-flight model-id validation
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { scoreResponse } from './judge.js';
import { callModel, getClient, validateModelIds } from './openrouterClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Parse CLI args ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv);

// ── Load config ───────────────────────────────────────────────────────────────
const modelsConfig = JSON.parse(readFileSync(join(ROOT, 'config/models.json'), 'utf-8'));
const settings = JSON.parse(readFileSync(join(ROOT, 'config/settings.json'), 'utf-8'));

function getModelConfig(slug) {
  const cfg = modelsConfig.models[slug];
  if (!cfg) {
    const available = Object.keys(modelsConfig.models).join(', ');
    throw new Error(`Model '${slug}' not found in config/models.json. Available: ${available}`);
  }
  return { slug, ...cfg };
}

// ── Resolve model list (N-way with back-compat) ───────────────────────────────
let modelSlugs;
if (args.models) {
  modelSlugs = String(args.models).split(',').map(s => s.trim()).filter(Boolean);
} else if (args['model-a'] && args['model-b']) {
  modelSlugs = [args['model-a'], args['model-b']];
} else {
  modelSlugs = ['claude-sonnet-4.6', 'deepseek-v3.2'];
  console.log(`No --models given, defaulting to: ${modelSlugs.join(', ')}`);
}
if (modelSlugs.length < 2) {
  throw new Error('--models needs at least 2 slugs for a meaningful comparison');
}
const modelConfigs = modelSlugs.map(getModelConfig);

// Baseline + candidate (for dashboard legacy fields + gate)
const BASELINE_SLUG = args.baseline || modelSlugs[0];
const CANDIDATE_SLUG = args.candidate || modelSlugs[1] || modelSlugs[0];
if (!modelSlugs.includes(BASELINE_SLUG)) {
  throw new Error(`--baseline '${BASELINE_SLUG}' must be in --models list`);
}
if (!modelSlugs.includes(CANDIDATE_SLUG)) {
  throw new Error(`--candidate '${CANDIDATE_SLUG}' must be in --models list`);
}

// ── Resolve dataset (id or path) ──────────────────────────────────────────────
function resolveDatasetPath(input) {
  if (!input) return 'datasets/seller-intelligence-v2.json';
  // If it looks like a path (contains / or .json), use as-is
  if (input.includes('/') || input.endsWith('.json')) return input;
  return `datasets/${input}.json`;
}
const DATASET_PATH = resolveDatasetPath(args.dataset);
const SUITE = args.suite || 'full';
const OUTPUT_PATH = args.output || 'output/eval-results.json';
const DRY_RUN = Boolean(args['dry-run']);
const SKIP_VALIDATE = Boolean(args['skip-validate']);

const datasetRaw = JSON.parse(readFileSync(resolve(ROOT, DATASET_PATH), 'utf-8'));

// Load profile maps for context injection (seller + sproutroute)
function tryLoadProfiles(path, keyFn) {
  try {
    const raw = JSON.parse(readFileSync(join(ROOT, path), 'utf-8'));
    const list = raw.profiles || [];
    const map = {};
    for (const p of list) map[keyFn(p)] = p;
    return map;
  } catch {
    return {};
  }
}
const sellerProfileMap = {
  ...tryLoadProfiles('datasets/seller-profiles.json', p => p.seller_id || p.id),
  // v3 profiles override matching IDs with richer detail when a v3 dataset is active
  ...tryLoadProfiles('datasets/seller-profiles-v3.json', p => p.seller_id || p.id),
};
const sproutrouteProfileMap = tryLoadProfiles('datasets/sproutroute-profiles.json', p => p.id);

// ── Suite filter ──────────────────────────────────────────────────────────────
function selectPrompts(allPrompts, suite) {
  if (suite === 'full') return allPrompts;
  const suiteConfig = settings.suites[suite];
  if (!suiteConfig) throw new Error(`Unknown suite: ${suite}`);
  const perCategory = suiteConfig.prompts_per_category;
  const count = {};
  const out = [];
  for (const p of allPrompts) {
    const c = count[p.category] || 0;
    if (c < perCategory) {
      out.push(p);
      count[p.category] = c + 1;
    }
  }
  return out;
}
const allPrompts = datasetRaw.prompts;
const selectedPrompts = selectPrompts(allPrompts, SUITE);

// ── Build prompt string ───────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `You are an expert Amazon marketplace advisor. Answer the question using only the context provided. Be specific, actionable, and concise.`;
const SPROUTROUTE_SYSTEM_PROMPT = `You are a family travel planner. Use ONLY the context provided. Prioritise child and pet safety, match ages and regulations, and give actionable suggestions that work in real time and space.`;

function getSystemPrompt(datasetId) {
  if (datasetId && datasetId.startsWith('sproutroute')) return SPROUTROUTE_SYSTEM_PROMPT;
  return DEFAULT_SYSTEM_PROMPT;
}

function buildContextPrompt(p) {
  // v2 structured context_blocks — render keys as section headers
  if (p.context_blocks && typeof p.context_blocks === 'object') {
    const sections = [];
    for (const [key, val] of Object.entries(p.context_blocks)) {
      if (val === null || val === undefined || val === '') continue;
      const header = key.replace(/_/g, ' ').toUpperCase();
      const body = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
      sections.push(`--- ${header} ---\n${body}`);
    }
    // Optional profile injection for v2 prompts that reference a profile id
    if (p.family_profile_id && sproutrouteProfileMap[p.family_profile_id]) {
      sections.unshift(`--- FAMILY PROFILE ---\n${JSON.stringify(sproutrouteProfileMap[p.family_profile_id], null, 2)}`);
    }
    if (p.seller_profile_id && sellerProfileMap[p.seller_profile_id] && !sections.some(s => s.includes('SELLER SNAPSHOT'))) {
      sections.unshift(`--- SELLER PROFILE ---\n${JSON.stringify(sellerProfileMap[p.seller_profile_id], null, 2)}`);
    }
    return `${sections.join('\n\n')}\n\n--- QUESTION ---\n${p.prompt}`;
  }

  // v1 template substitution — seller
  if (p.seller_profile_id && sellerProfileMap[p.seller_profile_id]) {
    const profile = sellerProfileMap[p.seller_profile_id];
    const profileStr = [
      profile.display_name ? `Seller: ${profile.display_name}` : '',
      profile.health_tier ? `Health Tier: ${profile.health_tier}` : '',
      profile.performance ? `Performance: ${JSON.stringify(profile.performance)}` : '',
      profile.account_health ? `Account Health: ${JSON.stringify(profile.account_health)}` : '',
    ].filter(Boolean).join('\n');
    return p.prompt.replace(`{{${p.seller_profile_id}}}`, profileStr);
  }

  return p.prompt;
}

// ── Main run ──────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n=== AI Evals Runner (N-way) ===`);
  console.log(`Dataset:    ${datasetRaw.id} (${SUITE} suite, ${selectedPrompts.length} prompts)`);
  console.log(`Models:     ${modelSlugs.join(', ')}`);
  console.log(`Baseline:   ${BASELINE_SLUG}`);
  console.log(`Candidate:  ${CANDIDATE_SLUG}`);
  console.log(`Judge:      ${modelsConfig.judge.id}`);
  console.log(`Output:     ${OUTPUT_PATH}`);
  console.log(`Started:    ${new Date().toISOString()}\n`);

  if (DRY_RUN) {
    const estInputTokens = 800; // rough avg per prompt with context
    const estOutputTokens = 400;
    let estCost = 0;
    for (const m of modelConfigs) {
      estCost += (estInputTokens / 1e6) * m.cost_per_1m_input_tokens;
      estCost += (estOutputTokens / 1e6) * m.cost_per_1m_output_tokens;
    }
    // Judge cost (once per model per prompt)
    const judge = modelsConfig.judge;
    estCost += modelConfigs.length * ((estInputTokens / 1e6) * judge.cost_per_1m_input_tokens + (estOutputTokens / 1e6) * judge.cost_per_1m_output_tokens);
    const totalEst = estCost * selectedPrompts.length;
    console.log(`DRY RUN: estimated ~$${totalEst.toFixed(3)} total for ${selectedPrompts.length} prompts × ${modelSlugs.length} models (+judge).`);
    console.log(`         per-prompt cost ≈ $${estCost.toFixed(4)}\n`);
    return;
  }

  // Pre-flight: validate OpenRouter model ids exist
  if (!SKIP_VALIDATE) {
    try {
      const ids = modelConfigs.map(m => m.id).concat([modelsConfig.judge.id]);
      const { missing } = await validateModelIds(ids);
      if (missing.length) {
        console.error(`Pre-flight FAILED. These model ids are not available on OpenRouter: ${missing.join(', ')}`);
        console.error(`Check current slugs at https://openrouter.ai/models and update config/models.json.`);
        console.error(`Or re-run with --skip-validate if you want to try anyway.`);
        process.exit(1);
      }
      console.log(`Pre-flight OK (${ids.length} model ids validated)\n`);
    } catch (err) {
      console.error(`Pre-flight check failed: ${err.message}`);
      console.error(`Re-run with --skip-validate to bypass.`);
      process.exit(1);
    }
  }

  const systemPrompt = getSystemPrompt(datasetRaw.id);
  const client = getClient();

  const promptResults = [];
  const costByModel = {};
  for (const m of modelConfigs) costByModel[m.slug] = 0;
  let judgeCost = 0;
  let runErrors = 0;

  for (let i = 0; i < selectedPrompts.length; i++) {
    const p = selectedPrompts[i];
    const injectedPrompt = buildContextPrompt(p);
    process.stdout.write(`[${i + 1}/${selectedPrompts.length}] ${p.id} (${p.category}/${p.difficulty})... `);

    const modelResponses = {};
    let promptError = null;
    let policyViolation = false;

    try {
      // Call all N models in parallel
      const modelResults = await Promise.all(
        modelConfigs.map(mc =>
          callModel({ modelConfig: mc, systemPrompt, userPrompt: injectedPrompt, client })
            .then(r => ({ slug: mc.slug, ok: true, ...r }))
            .catch(err => ({ slug: mc.slug, ok: false, error: err.message }))
        )
      );

      // Judge each response independently
      const judgeResults = await Promise.all(
        modelResults.map(r => {
          if (!r.ok) return Promise.resolve(null);
          return scoreResponse({
            prompt: injectedPrompt,
            response: r.text,
            dataset: datasetRaw.id,
            client,
          });
        })
      );

      for (let j = 0; j < modelConfigs.length; j++) {
        const mr = modelResults[j];
        const jr = judgeResults[j];
        if (!mr.ok) {
          modelResponses[mr.slug] = { error: mr.error };
          continue;
        }
        costByModel[mr.slug] += mr.cost;
        if (jr) judgeCost += jr._judge_cost || 0;
        if (jr?.policy_violation) policyViolation = true;

        // Extract dimensional scores (exclude meta fields)
        const scores = {};
        for (const k of Object.keys(jr || {})) {
          if (!k.startsWith('_') && !['policy_violation', 'reasoning', 'weighted_score', 'quality_score'].includes(k)) {
            scores[k] = jr[k];
          }
        }

        modelResponses[mr.slug] = {
          response: mr.text,
          latency_ms: mr.latency_ms,
          input_tokens: mr.input_tokens,
          output_tokens: mr.output_tokens,
          cost: mr.cost,
          scores,
          quality_score: jr?.quality_score || 0,
          reasoning: jr?.reasoning || '',
        };
      }

      const verdictStrs = modelConfigs.map(mc => {
        const r = modelResponses[mc.slug];
        return `${mc.slug}=${r.quality_score ?? 'ERR'}`;
      });
      console.log(verdictStrs.join(' '));
    } catch (err) {
      runErrors++;
      promptError = err.message;
      console.log(`ERROR: ${err.message}`);
    }

    promptResults.push({
      id: p.id,
      category: p.category,
      difficulty: p.difficulty,
      seller_profile_id: p.seller_profile_id || null,
      family_profile_id: p.family_profile_id || null,
      model_responses: modelResponses,
      policy_violation: policyViolation,
      error: promptError,
    });

    // Small delay to avoid rate limiting
    await sleep(400);
  }

  // ── Build per-model summary ───────────────────────────────────────────────
  const perModel = {};
  for (const mc of modelConfigs) {
    const slug = mc.slug;
    const qualities = [];
    const latencies = [];
    let totalCost = 0;
    let violations = 0;
    const dimSums = {};
    const dimCounts = {};

    for (const pr of promptResults) {
      const r = pr.model_responses[slug];
      if (!r || r.error) continue;
      qualities.push(r.quality_score);
      latencies.push(r.latency_ms);
      totalCost += r.cost;
      if (pr.policy_violation) violations++;
      for (const [d, v] of Object.entries(r.scores || {})) {
        dimSums[d] = (dimSums[d] || 0) + v;
        dimCounts[d] = (dimCounts[d] || 0) + 1;
      }
    }
    latencies.sort((a, b) => a - b);
    const dimAverages = {};
    for (const d of Object.keys(dimSums)) {
      dimAverages[d] = Math.round((dimSums[d] / dimCounts[d]) * 100) / 100;
    }

    perModel[slug] = {
      name: mc.name,
      provider: mc.provider,
      id: mc.id,
      avg_quality: qualities.length ? Math.round(avg(qualities) * 10) / 10 : 0,
      p50_latency_ms: percentile(latencies, 50),
      p95_latency_ms: percentile(latencies, 95),
      p99_latency_ms: percentile(latencies, 99),
      total_cost_usd: Math.round(totalCost * 10000) / 10000,
      avg_cost_per_inference: qualities.length ? Math.round((totalCost / qualities.length) * 100000) / 100000 : 0,
      policy_violations: violations,
      dimension_averages: dimAverages,
    };
  }

  // ── Build legacy model_a/model_b for dashboard back-compat ────────────────
  function legacyModelMeta(slug) {
    const mc = getModelConfig(slug);
    return { name: mc.name, provider: mc.provider, version: mc.version };
  }
  function legacyDayModel(slug) {
    const pm = perModel[slug];
    return {
      quality_score: pm.avg_quality,
      latency_p50: pm.p50_latency_ms,
      latency_p95: pm.p95_latency_ms,
      latency_p99: pm.p99_latency_ms,
      cost_per_inference: pm.avg_cost_per_inference,
      scores: pm.dimension_averages,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const runId = `run_${today.replace(/-/g, '')}_${String(Date.now()).slice(-4)}`;

  // Legacy per-prompt projection (baseline as model_a, candidate as model_b)
  const legacyPromptResults = promptResults.map(pr => {
    const a = pr.model_responses[BASELINE_SLUG] || {};
    const b = pr.model_responses[CANDIDATE_SLUG] || {};
    return {
      id: pr.id,
      category: pr.category,
      difficulty: pr.difficulty,
      seller_profile_id: pr.seller_profile_id,
      family_profile_id: pr.family_profile_id,
      model_a_response: a.response,
      model_b_response: b.response,
      model_a_scores: a.scores,
      model_b_scores: b.scores,
      model_a_quality_score: a.quality_score,
      model_b_quality_score: b.quality_score,
      model_a_latency_ms: a.latency_ms,
      model_b_latency_ms: b.latency_ms,
      model_a_cost: a.cost,
      model_b_cost: b.cost,
      policy_violation: pr.policy_violation,
      model_a_reasoning: a.reasoning,
      model_b_reasoning: b.reasoning,
      model_responses: pr.model_responses,
      error: pr.error,
    };
  });

  const baselinePM = perModel[BASELINE_SLUG];
  const candidatePM = perModel[CANDIDATE_SLUG];

  const output = {
    meta: {
      generated_at: new Date().toISOString(),
      dataset: datasetRaw.id,
      dataset_version: datasetRaw.version,
      suite: SUITE,
      prompt_count: selectedPrompts.length,
      judge_model: modelsConfig.judge.id,
      runner_version: '2.0.0',
      run_id: runId,
      errors: runErrors,
      baseline: BASELINE_SLUG,
      candidate: CANDIDATE_SLUG,
      models: modelSlugs,
      provider: modelsConfig.provider,
    },
    // New N-way fields
    models: Object.fromEntries(modelConfigs.map(mc => [mc.slug, { name: mc.name, provider: mc.provider, id: mc.id, version: mc.version, tier: mc.tier }])),
    per_model: perModel,

    // Legacy fields preserved so existing dashboard views keep working
    model_a: legacyModelMeta(BASELINE_SLUG),
    model_b: legacyModelMeta(CANDIDATE_SLUG),
    summary: {
      model_a_avg_quality: baselinePM.avg_quality,
      model_b_avg_quality: candidatePM.avg_quality,
      model_a_p50_latency_ms: baselinePM.p50_latency_ms,
      model_a_p95_latency_ms: baselinePM.p95_latency_ms,
      model_a_p99_latency_ms: baselinePM.p99_latency_ms,
      model_b_p50_latency_ms: candidatePM.p50_latency_ms,
      model_b_p95_latency_ms: candidatePM.p95_latency_ms,
      model_b_p99_latency_ms: candidatePM.p99_latency_ms,
      model_a_total_cost_usd: baselinePM.total_cost_usd,
      model_b_total_cost_usd: candidatePM.total_cost_usd,
      model_a_avg_cost_per_inference: baselinePM.avg_cost_per_inference,
      model_b_avg_cost_per_inference: candidatePM.avg_cost_per_inference,
      policy_violations: promptResults.filter(r => r.policy_violation).length,
      judge_cost_usd: Math.round(judgeCost * 10000) / 10000,
      per_model: perModel, // duplicate for convenience
    },
    daily: [
      {
        date: today,
        model_a: legacyDayModel(BASELINE_SLUG),
        model_b: legacyDayModel(CANDIDATE_SLUG),
        per_model: Object.fromEntries(modelSlugs.map(s => [s, legacyDayModel(s)])),
      },
    ],
    events: [],
    prompts: legacyPromptResults,
  };

  // Write output
  mkdirSync(resolve(ROOT, OUTPUT_PATH, '..'), { recursive: true });
  writeFileSync(resolve(ROOT, OUTPUT_PATH), JSON.stringify(output, null, 2));

  console.log(`\n=== Run Complete ===`);
  console.log(`Prompts:  ${selectedPrompts.length} (${runErrors} errors)`);
  for (const slug of modelSlugs) {
    const pm = perModel[slug];
    console.log(`  ${slug.padEnd(24)} quality=${pm.avg_quality}  p95=${pm.p95_latency_ms}ms  cost/inf=$${pm.avg_cost_per_inference}  violations=${pm.policy_violations}`);
  }
  console.log(`Judge cost:          $${output.summary.judge_cost_usd}`);
  console.log(`Total model cost:    $${Object.values(perModel).reduce((s, m) => s + m.total_cost_usd, 0).toFixed(4)}`);
  console.log(`Output:              ${OUTPUT_PATH}`);
  console.log(`Run ID:              ${runId}\n`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
