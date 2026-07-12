#!/usr/bin/env node
/**
 * eval-runner.js — CLI evaluation runner for AI Evals Control Tower
 *
 * Usage:
 *   node eval/eval-runner.js \
 *     --model-a claude-sonnet-4-5 \
 *     --model-b deepseek-chat \
 *     --dataset datasets/seller-intelligence-v2.json \
 *     --suite full \
 *     --output output/eval-results.json
 *
 * Flags:
 *   --model-a     Model A identifier (from config/models.json)
 *   --model-b     Model B identifier
 *   --dataset     Path to prompt dataset JSON
 *   --suite       'smoke' (2 per category = ~10 prompts) or 'full' (all 50) [default: full]
 *   --output      Output path [default: output/eval-results.json]
 *   --judge       Judge model ID [default: claude-sonnet-4-5]
 *
 * Dataset v2 format uses context_blocks for structured prompt injection.
 * Dataset v1 format uses {{seller-id}} template substitution (still supported).
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { scoreResponse } from './judge.js';
import { createSpanLogger } from './span-logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Parse CLI args ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] || true;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const MODEL_A_ID = args['model-a'] || 'claude-sonnet-4-5';
const MODEL_B_ID = args['model-b'] || 'deepseek-chat';
const DATASET_PATH = args['dataset'] || 'datasets/seller-intelligence-v2.json';
const SUITE = args['suite'] || 'full';
const OUTPUT_PATH = args['output'] || 'output/eval-results.json';

// ── Load config ───────────────────────────────────────────────────────────────
const modelsConfig = JSON.parse(readFileSync(join(ROOT, 'config/models.json'), 'utf-8'));
const settings = JSON.parse(readFileSync(join(ROOT, 'config/settings.json'), 'utf-8'));

function getModelConfig(id) {
  const cfg = modelsConfig.models[id];
  if (!cfg) throw new Error(`Model '${id}' not found in config/models.json`);
  return cfg;
}

const modelA = getModelConfig(MODEL_A_ID);
const modelB = getModelConfig(MODEL_B_ID);

// ── Load dataset ──────────────────────────────────────────────────────────────
const datasetRaw = JSON.parse(readFileSync(resolve(ROOT, DATASET_PATH), 'utf-8'));

// Load seller profiles for v1 backward-compat lookup (keyed by seller_id)
let profileMap = {};
try {
  const sellerProfiles = JSON.parse(readFileSync(join(ROOT, 'datasets/seller-profiles.json'), 'utf-8'));
  for (const p of sellerProfiles.profiles) {
    profileMap[p.seller_id || p.id] = p;
  }
} catch (_) { /* profiles optional for v2 */ }

// Apply suite filter: smoke = first N prompts per category
function selectPrompts(allPrompts, suite) {
  if (suite === 'full') return allPrompts;
  const suiteConfig = settings.suites[suite];
  if (!suiteConfig) throw new Error(`Unknown suite: ${suite}`);
  const perCategory = suiteConfig.prompts_per_category;
  const categoryCount = {};
  const selected = [];
  for (const p of allPrompts) {
    const count = categoryCount[p.category] || 0;
    if (count < perCategory) {
      selected.push(p);
      categoryCount[p.category] = count + 1;
    }
  }
  return selected;
}

const allPrompts = datasetRaw.prompts;
const selectedPrompts = selectPrompts(allPrompts, SUITE);

// ── Build prompt string from context_blocks (v2) or template sub (v1) ─────────
const SYSTEM_PROMPT = `You are an expert Amazon marketplace advisor. Answer the question using only the context provided. Be specific, actionable, and concise.`;

function buildContextPrompt(p) {
  // v2 format: context_blocks present
  if (p.context_blocks && typeof p.context_blocks === 'object') {
    const sections = [];
    if (p.context_blocks.seller_snapshot) {
      sections.push(`--- SELLER SNAPSHOT ---\n${p.context_blocks.seller_snapshot}`);
    }
    if (p.context_blocks.asin_snapshot) {
      sections.push(`--- ASIN SNAPSHOT ---\n${p.context_blocks.asin_snapshot}`);
    }
    if (p.context_blocks.event_log) {
      sections.push(`--- EVENT LOG ---\n${p.context_blocks.event_log}`);
    }
    if (p.context_blocks.financial_snapshot) {
      sections.push(`--- FINANCIAL SNAPSHOT ---\n${p.context_blocks.financial_snapshot}`);
    }
    return `${sections.join('\n\n')}\n\n--- QUESTION ---\n${p.prompt}`;
  }

  // v1 format: {{seller_profile_id}} template substitution
  if (p.seller_profile_id && profileMap[p.seller_profile_id]) {
    const profile = profileMap[p.seller_profile_id];
    const profileStr = [
      profile.display_name ? `Seller: ${profile.display_name}` : '',
      profile.health_tier ? `Health Tier: ${profile.health_tier}` : '',
      profile.performance ? `Performance: ${JSON.stringify(profile.performance)}` : '',
      profile.account_health ? `Account Health: ${JSON.stringify(profile.account_health)}` : '',
    ].filter(Boolean).join('\n');
    return p.prompt.replace(`{{${p.seller_profile_id}}}`, profileStr);
  }

  // Fallback: return prompt as-is
  return p.prompt;
}

// ── Call a model ──────────────────────────────────────────────────────────────
async function callModel(modelConfig, prompt) {
  const start = Date.now();

  if (modelConfig.provider === 'Anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const result = await client.messages.create({
      model: modelConfig.version,
      max_tokens: modelConfig.max_tokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    const latency_ms = Date.now() - start;
    const input_tokens = result.usage.input_tokens;
    const output_tokens = result.usage.output_tokens;
    const cost = (input_tokens / 1_000_000) * modelConfig.cost_per_1m_input_tokens +
                 (output_tokens / 1_000_000) * modelConfig.cost_per_1m_output_tokens;
    return {
      text: result.content[0].text,
      latency_ms,
      input_tokens,
      output_tokens,
      cost: Math.round(cost * 100000) / 100000,
    };
  }

  if (modelConfig.provider === 'DeepSeek') {
    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelConfig.version,
        max_tokens: modelConfig.max_tokens,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${err}`);
    }
    const data = await response.json();
    const latency_ms = Date.now() - start;
    const input_tokens = data.usage?.prompt_tokens || 0;
    const output_tokens = data.usage?.completion_tokens || 0;
    const cost = (input_tokens / 1_000_000) * modelConfig.cost_per_1m_input_tokens +
                 (output_tokens / 1_000_000) * modelConfig.cost_per_1m_output_tokens;
    return {
      text: data.choices[0].message.content,
      latency_ms,
      input_tokens,
      output_tokens,
      cost: Math.round(cost * 100000) / 100000,
    };
  }

  throw new Error(`Unsupported provider: ${modelConfig.provider}`);
}

// ── Main run ──────────────────────────────────────────────────────────────────
async function run() {
  const today = new Date().toISOString().split('T')[0];
  const runId = `run_${today.replace(/-/g, '')}_${String(Date.now()).slice(-4)}`;
  const trace = createSpanLogger(runId, { costTable: modelsConfig.models });
  console.log(`\n=== AI Evals Runner ===`);
  console.log(`Dataset:  ${datasetRaw.id} (${SUITE} suite, ${selectedPrompts.length} prompts)`);
  console.log(`Model A:  ${modelA.name} (${MODEL_A_ID})`);
  console.log(`Model B:  ${modelB.name} (${MODEL_B_ID})`);
  console.log(`Output:   ${OUTPUT_PATH}`);
  console.log(`Started:  ${new Date().toISOString()}\n`);

  const promptResults = [];
  let totalCostA = 0, totalCostB = 0, totalCostJudge = 0;
  let runErrors = 0;

  for (let i = 0; i < selectedPrompts.length; i++) {
    const p = selectedPrompts[i];
    const injectedPrompt = buildContextPrompt(p);

    process.stdout.write(`[${i + 1}/${selectedPrompts.length}] ${p.id} (${p.category}/${p.difficulty})... `);

    try {
      // Run both models in parallel
      const [resultA, resultB] = await Promise.all([
        trace.span(`model_a:${p.id}`, () => callModel(modelA, injectedPrompt), { modelId: MODEL_A_ID, usageFrom: r => ({ inputTokens: r.input_tokens, outputTokens: r.output_tokens }), detail: { model_id: MODEL_A_ID } }),
        trace.span(`model_b:${p.id}`, () => callModel(modelB, injectedPrompt), { modelId: MODEL_B_ID, usageFrom: r => ({ inputTokens: r.input_tokens, outputTokens: r.output_tokens }), detail: { model_id: MODEL_B_ID } }),
      ]);

      // Judge both responses in parallel
      const [scoresA, scoresB] = await Promise.all([
        trace.span(`judge_a:${p.id}`, () => scoreResponse({ prompt: injectedPrompt, response: resultA.text, dataset: datasetRaw.id })),
        trace.span(`judge_b:${p.id}`, () => scoreResponse({ prompt: injectedPrompt, response: resultB.text, dataset: datasetRaw.id })),
      ]);

      totalCostA += resultA.cost;
      totalCostB += resultB.cost;

      promptResults.push({
        id: p.id,
        category: p.category,
        difficulty: p.difficulty,
        seller_profile_id: p.seller_profile_id || null,
        model_a_response: resultA.text,
        model_b_response: resultB.text,
        model_a_scores: {
          relevance: scoresA.relevance,
          accuracy: scoresA.accuracy,
          actionability: scoresA.actionability,
          coherence: scoresA.coherence,
          conciseness: scoresA.conciseness,
        },
        model_b_scores: {
          relevance: scoresB.relevance,
          accuracy: scoresB.accuracy,
          actionability: scoresB.actionability,
          coherence: scoresB.coherence,
          conciseness: scoresB.conciseness,
        },
        model_a_quality_score: scoresA.quality_score,
        model_b_quality_score: scoresB.quality_score,
        model_a_latency_ms: resultA.latency_ms,
        model_b_latency_ms: resultB.latency_ms,
        model_a_cost: resultA.cost,
        model_b_cost: resultB.cost,
        policy_violation: scoresA.policy_violation || scoresB.policy_violation,
        model_a_reasoning: scoresA.reasoning,
        model_b_reasoning: scoresB.reasoning,
      });

      console.log(`A=${scoresA.quality_score} B=${scoresB.quality_score} | A_lat=${resultA.latency_ms}ms B_lat=${resultB.latency_ms}ms`);
    } catch (err) {
      runErrors++;
      console.log(`ERROR: ${err.message}`);
      // Log error prompt but continue
      promptResults.push({
        id: p.id, category: p.category, difficulty: p.difficulty,
        error: err.message,
      });
    }

    // Small delay to avoid rate limiting
    await sleep(500);
  }

  // ── Aggregate daily stats (single-day run) ────────────────────────────────
  const validResults = promptResults.filter(r => !r.error);
  const avgA = avg(validResults.map(r => r.model_a_quality_score));
  const avgB = avg(validResults.map(r => r.model_b_quality_score));
  const latenciesA = validResults.map(r => r.model_a_latency_ms).sort((a, b) => a - b);
  const latenciesB = validResults.map(r => r.model_b_latency_ms).sort((a, b) => a - b);
  const output = {
    meta: {
      generated_at: new Date().toISOString(),
      dataset: datasetRaw.id,
      dataset_version: datasetRaw.version,
      suite: SUITE,
      prompt_count: selectedPrompts.length,
      judge_model: 'claude-sonnet-4-5',
      runner_version: '1.0.0',
      run_id: runId,
      errors: runErrors,
    },
    model_a: {
      name: modelA.name,
      provider: modelA.provider,
      version: modelA.version,
    },
    model_b: {
      name: modelB.name,
      provider: modelB.provider,
      version: modelB.version,
    },
    summary: {
      model_a_avg_quality: Math.round(avgA * 10) / 10,
      model_b_avg_quality: Math.round(avgB * 10) / 10,
      model_a_p50_latency_ms: percentile(latenciesA, 50),
      model_a_p95_latency_ms: percentile(latenciesA, 95),
      model_a_p99_latency_ms: percentile(latenciesA, 99),
      model_b_p50_latency_ms: percentile(latenciesB, 50),
      model_b_p95_latency_ms: percentile(latenciesB, 95),
      model_b_p99_latency_ms: percentile(latenciesB, 99),
      model_a_total_cost_usd: Math.round(totalCostA * 10000) / 10000,
      model_b_total_cost_usd: Math.round(totalCostB * 10000) / 10000,
      model_a_avg_cost_per_inference: Math.round((totalCostA / validResults.length) * 100000) / 100000,
      model_b_avg_cost_per_inference: Math.round((totalCostB / validResults.length) * 100000) / 100000,
      policy_violations: validResults.filter(r => r.policy_violation).length,
    },
    // daily array will be populated by generate-history.js for the full time-series
    daily: [
      {
        date: today,
        model_a: {
          quality_score: Math.round(avgA * 10) / 10,
          latency_p50: percentile(latenciesA, 50),
          latency_p95: percentile(latenciesA, 95),
          latency_p99: percentile(latenciesA, 99),
          cost_per_inference: Math.round((totalCostA / Math.max(validResults.length, 1)) * 100000) / 100000,
          scores: avgDimScores(validResults, 'model_a_scores'),
        },
        model_b: {
          quality_score: Math.round(avgB * 10) / 10,
          latency_p50: percentile(latenciesB, 50),
          latency_p95: percentile(latenciesB, 95),
          latency_p99: percentile(latenciesB, 99),
          cost_per_inference: Math.round((totalCostB / Math.max(validResults.length, 1)) * 100000) / 100000,
          scores: avgDimScores(validResults, 'model_b_scores'),
        },
      }
    ],
    events: [],
    prompts: promptResults,
  };

  // Write output
  mkdirSync(resolve(ROOT, OUTPUT_PATH, '..'), { recursive: true });
  writeFileSync(resolve(ROOT, OUTPUT_PATH), JSON.stringify(output, null, 2));
  const tracePath = resolve(ROOT, 'output', 'traces', `${runId}.json`);
  await trace.flush(tracePath);

  console.log(`\n=== Run Complete ===`);
  console.log(`Prompts:  ${selectedPrompts.length} (${runErrors} errors)`);
  console.log(`Model A avg quality: ${output.summary.model_a_avg_quality}`);
  console.log(`Model B avg quality: ${output.summary.model_b_avg_quality}`);
  console.log(`Policy violations:   ${output.summary.policy_violations}`);
  console.log(`Total cost (A):      $${output.summary.model_a_total_cost_usd}`);
  console.log(`Total cost (B):      $${output.summary.model_b_total_cost_usd}`);
  console.log(`Output:              ${OUTPUT_PATH}`);
  console.log(`Run ID:              ${runId}\n`);
  console.log(`Trace:               ${tracePath}\n`);
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

function avgDimScores(results, key) {
  const dims = ['relevance', 'accuracy', 'actionability', 'coherence', 'conciseness'];
  const out = {};
  for (const d of dims) {
    const vals = results.map(r => r[key]?.[d] || 0).filter(v => v > 0);
    out[d] = vals.length ? Math.round(avg(vals) * 100) / 100 : 0;
  }
  return out;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
