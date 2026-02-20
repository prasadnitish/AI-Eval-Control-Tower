/**
 * judge.js — LLM-as-judge for AI Evals Control Tower
 * Uses Claude Sonnet 4.5 to score model responses on 5 dimensions.
 * Returns per-dimension scores (1-10) + policy_violation flag + reasoning.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rubric = JSON.parse(readFileSync(join(__dirname, '../config/judge-rubric.json'), 'utf-8'));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Score a single model response.
 * @param {object} params
 * @param {string} params.prompt - The original prompt sent to the model
 * @param {string} params.response - The model's response to evaluate
 * @param {string} params.dataset - Dataset ID (for weight lookup)
 * @param {number} [params.retries=3] - Number of retry attempts on parse failure
 * @returns {object} { relevance, accuracy, actionability, coherence, conciseness, policy_violation, reasoning, weighted_score }
 */
export async function scoreResponse({ prompt, response, dataset, retries = 3 }) {
  const systemPrompt = rubric.judge_prompt_template;

  const userMessage = `ORIGINAL PROMPT:\n${prompt}\n\nMODEL RESPONSE TO EVALUATE:\n${response}\n\nScore this response on all 5 dimensions and check for policy violations. Return only valid JSON.`;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const raw = result.content[0].text.trim();
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const scores = JSON.parse(cleaned);

      // Validate expected fields
      const required = ['relevance', 'accuracy', 'actionability', 'coherence', 'conciseness', 'policy_violation'];
      for (const field of required) {
        if (scores[field] === undefined) throw new Error(`Missing field: ${field}`);
      }

      // Compute weighted score
      const weights = rubric.weights[dataset] || rubric.weights['seller-intelligence-v1'];
      const weighted_score =
        scores.relevance * weights.relevance +
        scores.accuracy * weights.accuracy +
        scores.actionability * weights.actionability +
        scores.coherence * weights.coherence +
        scores.conciseness * weights.conciseness;

      // Normalise to 0-100 (scores are 1-10, so max weighted sum is 10)
      const quality_score = Math.round((weighted_score / 10) * 100 * 10) / 10;

      return {
        relevance: scores.relevance,
        accuracy: scores.accuracy,
        actionability: scores.actionability,
        coherence: scores.coherence,
        conciseness: scores.conciseness,
        policy_violation: Boolean(scores.policy_violation),
        reasoning: scores.reasoning || '',
        weighted_score: Math.round(weighted_score * 100) / 100,
        quality_score,
      };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(1000 * attempt);
      }
    }
  }

  console.error(`Judge scoring failed after ${retries} attempts:`, lastError.message);
  // Return a sentinel value so the run continues
  return {
    relevance: 0, accuracy: 0, actionability: 0, coherence: 0, conciseness: 0,
    policy_violation: false, reasoning: `ERROR: ${lastError.message}`,
    weighted_score: 0, quality_score: 0,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
