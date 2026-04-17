/**
 * openrouterClient.js — thin wrapper over OpenAI SDK pointed at OpenRouter.
 *
 * OpenRouter is OpenAI-compatible, so one SDK handles Claude, GPT, Grok,
 * Gemini, DeepSeek, etc. under a single API key.
 *
 * Returns a shape compatible with the eval-runner's existing call sites:
 *   { text, latency_ms, input_tokens, output_tokens, cost }
 */

import OpenAI from 'openai';

const APP_REFERRER = 'https://www.nitishprasad.com/ai-eval-control-tower';
const APP_TITLE = 'AI Eval Control Tower';

let _client = null;

export function getClient(baseUrl = 'https://openrouter.ai/api/v1') {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not set. Get a key at https://openrouter.ai/settings/keys');
    }
    _client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      defaultHeaders: {
        'HTTP-Referer': APP_REFERRER,
        'X-Title': APP_TITLE,
      },
    });
  }
  return _client;
}

/**
 * Call a model through OpenRouter using the chat/completions API.
 * @param {object} params
 * @param {object} params.modelConfig - Entry from config/models.json (must include id, cost_per_1m_input_tokens, cost_per_1m_output_tokens)
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {number} [params.maxTokens]
 * @param {object} [params.client] - Injected client for tests
 * @returns {Promise<{text: string, latency_ms: number, input_tokens: number, output_tokens: number, cost: number}>}
 */
export async function callModel({ modelConfig, systemPrompt, userPrompt, maxTokens, client }) {
  const c = client || getClient();
  const start = Date.now();

  const payload = {
    model: modelConfig.id,
    max_tokens: maxTokens || modelConfig.max_tokens || 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
  // Reasoning-model controls (OpenRouter passes these through to OpenAI/Anthropic/xAI).
  // Without this, GPT-5-* burn the entire max_tokens budget on hidden chain-of-thought.
  if (modelConfig.reasoning_effort) {
    payload.reasoning_effort = modelConfig.reasoning_effort;
  }

  const response = await c.chat.completions.create(payload);

  const latency_ms = Date.now() - start;
  const input_tokens = response.usage?.prompt_tokens || 0;
  const output_tokens = response.usage?.completion_tokens || 0;
  const cost =
    (input_tokens / 1_000_000) * (modelConfig.cost_per_1m_input_tokens || 0) +
    (output_tokens / 1_000_000) * (modelConfig.cost_per_1m_output_tokens || 0);

  const text = response.choices?.[0]?.message?.content || '';
  if (!text) {
    throw new Error(`Empty response from ${modelConfig.id}`);
  }

  return {
    text,
    latency_ms,
    input_tokens,
    output_tokens,
    cost: Math.round(cost * 100000) / 100000,
  };
}

/**
 * Pre-flight check: confirm the configured model IDs are reachable.
 * Calls the OpenRouter models endpoint and validates each id exists.
 * @param {string[]} modelIds
 * @returns {Promise<{ok: string[], missing: string[]}>}
 */
export async function validateModelIds(modelIds) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`OpenRouter models endpoint returned ${res.status}`);
  }
  const body = await res.json();
  const available = new Set((body.data || []).map(m => m.id));
  const ok = [];
  const missing = [];
  for (const id of modelIds) {
    if (available.has(id)) ok.push(id);
    else missing.push(id);
  }
  return { ok, missing };
}
