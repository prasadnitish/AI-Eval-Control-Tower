/**
 * judge.js — LLM-as-judge for AI Evals Control Tower
 *
 * Uses the judge model defined in config/models.json (default: Claude Sonnet 4.6
 * via OpenRouter) to score a single model response on the rubric's dimensions.
 *
 * Dimensions scored depend on the dataset. Core 5 always scored:
 *   relevance, accuracy, actionability, coherence, conciseness
 * SproutRoute also scores:
 *   safety (age/pet appropriateness), logistical_feasibility
 *
 * Returns per-dimension scores (1-10) + policy_violation flag + reasoning.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getClient, callModel } from './openrouterClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rubric = JSON.parse(readFileSync(join(__dirname, '../config/judge-rubric.json'), 'utf-8'));
const modelsConfig = JSON.parse(readFileSync(join(__dirname, '../config/models.json'), 'utf-8'));

const CORE_DIMENSIONS = ['relevance', 'accuracy', 'actionability', 'coherence', 'conciseness'];

function getDimensionsForDataset(dataset) {
  // Dataset families that include safety / logistical_feasibility
  if (dataset && dataset.startsWith('sproutroute')) {
    return [...CORE_DIMENSIONS, 'safety', 'logistical_feasibility'];
  }
  return CORE_DIMENSIONS;
}

function buildJudgePrompt(dataset) {
  const dims = getDimensionsForDataset(dataset);
  const dimDocs = dims.map((d, i) => {
    const def = rubric.dimensions[d];
    return `${i + 1}. ${def.label} (1=${def.scale_low}, 10=${def.scale_high}) — ${def.definition}`;
  }).join('\n');

  const jsonFields = dims.map(d => `  "${d}": <1-10>`).join(',\n');

  const domain = dataset?.startsWith('sproutroute')
    ? 'family trip planning'
    : 'e-commerce seller management';

  return `You are an expert evaluator assessing AI model responses for quality in a ${domain} context.

Score the response on these ${dims.length} dimensions, each 1-10:
${dimDocs}

Also flag policy_violation as true if the response gives factually incorrect guidance that could cause real-world harm (wrong car seat law, unsafe age-recommendation, policy misinformation).

Return ONLY valid JSON in this exact format — no prose, no markdown fences:
{
${jsonFields},
  "policy_violation": <true|false>,
  "reasoning": "<one sentence summary of key strengths and weaknesses>"
}`;
}

function resolveWeights(dataset) {
  // Try exact match first, then family prefix fallback
  if (rubric.weights[dataset]) return rubric.weights[dataset];
  const prefix = dataset?.split('-v')[0]; // e.g. "seller-intelligence"
  for (const key of Object.keys(rubric.weights)) {
    if (key.startsWith(prefix)) return rubric.weights[key];
  }
  return rubric.weights['seller-intelligence-v2'] || rubric.weights['seller-intelligence-v1'];
}

/**
 * Score a single model response.
 * @param {object} params
 * @param {string} params.prompt - The original prompt sent to the model
 * @param {string} params.response - The model's response to evaluate
 * @param {string} params.dataset - Dataset ID (for weight + dimension lookup)
 * @param {number} [params.retries=3] - Retries on parse failure
 * @param {object} [params.client] - Injected OpenRouter client (for tests)
 * @returns {Promise<object>}
 */
export async function scoreResponse({ prompt, response, dataset, retries = 3, client }) {
  const dims = getDimensionsForDataset(dataset);
  const systemPrompt = buildJudgePrompt(dataset);
  const userMessage = `ORIGINAL PROMPT:\n${prompt}\n\nMODEL RESPONSE TO EVALUATE:\n${response}\n\nScore on all ${dims.length} dimensions and return only valid JSON.`;

  const judgeConfig = modelsConfig.judge;
  const c = client || getClient();

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await callModel({
        modelConfig: judgeConfig,
        systemPrompt,
        userPrompt: userMessage,
        maxTokens: 512,
        client: c,
      });

      const raw = res.text.trim();
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
      const scores = JSON.parse(cleaned);

      // Validate expected fields
      for (const field of [...dims, 'policy_violation']) {
        if (scores[field] === undefined) throw new Error(`Missing field: ${field}`);
      }

      // Compute weighted score using per-dataset weights
      const weights = resolveWeights(dataset);
      let weighted_score = 0;
      let total_weight = 0;
      for (const d of dims) {
        const w = weights[d] || 0;
        weighted_score += (scores[d] || 0) * w;
        total_weight += w;
      }
      // If rubric weights don't cover all scored dims (shouldn't happen but defensive),
      // renormalise by total_weight so the quality_score stays in 0-100.
      const normalised = total_weight > 0 ? weighted_score / total_weight : 0;
      const quality_score = Math.round((normalised / 10) * 100 * 10) / 10;

      const out = {
        policy_violation: Boolean(scores.policy_violation),
        reasoning: scores.reasoning || '',
        weighted_score: Math.round(weighted_score * 100) / 100,
        quality_score,
        _judge_cost: res.cost,
        _judge_latency_ms: res.latency_ms,
      };
      for (const d of dims) out[d] = scores[d];
      return out;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(1000 * attempt);
      }
    }
  }

  console.error(`Judge scoring failed after ${retries} attempts:`, lastError?.message);
  const out = {
    policy_violation: false,
    reasoning: `ERROR: ${lastError?.message || 'unknown'}`,
    weighted_score: 0,
    quality_score: 0,
    _judge_cost: 0,
    _judge_latency_ms: 0,
  };
  for (const d of dims) out[d] = 0;
  return out;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
