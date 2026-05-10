import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreResponse } from '../eval/judge.js';

/**
 * Fake OpenRouter client — matches the OpenAI SDK surface we use.
 * Records calls and returns whatever the provided responder produces.
 */
function fakeClient(responder) {
  const calls = [];
  return {
    chat: {
      completions: {
        create: async (payload) => {
          calls.push(payload);
          const response = typeof responder === 'function' ? responder(payload, calls.length) : responder;
          return response;
        },
      },
    },
    _calls: calls,
  };
}

function makeReply(obj, usage = { prompt_tokens: 500, completion_tokens: 120 }) {
  return {
    choices: [{ message: { content: JSON.stringify(obj) } }],
    usage,
  };
}

test('judge scores a seller-intelligence response on 5 core dimensions', async () => {
  const client = fakeClient(makeReply({
    relevance: 8, accuracy: 9, actionability: 7, coherence: 8, conciseness: 6,
    policy_violation: false, reasoning: 'Solid answer with minor padding.',
  }));

  const out = await scoreResponse({
    prompt: 'Assess this seller',
    response: 'A detailed assessment...',
    dataset: 'seller-intelligence-v2',
    client,
  });

  assert.equal(out.relevance, 8);
  assert.equal(out.accuracy, 9);
  assert.equal(out.policy_violation, false);
  assert.ok(out.quality_score > 0 && out.quality_score <= 100);
  // Judge should have been called exactly once (no retries needed)
  assert.equal(client._calls.length, 1);
});

test('judge scores sproutroute with safety and logistical_feasibility', async () => {
  const client = fakeClient(makeReply({
    relevance: 9, accuracy: 8, actionability: 7, coherence: 8, conciseness: 7,
    safety: 9, logistical_feasibility: 8,
    policy_violation: false, reasoning: 'Good trip plan.',
  }));

  const out = await scoreResponse({
    prompt: 'Plan a trip',
    response: 'Day 1...',
    dataset: 'sproutroute-v2',
    client,
  });

  assert.equal(out.safety, 9);
  assert.equal(out.logistical_feasibility, 8);
  // Safety carries the highest weight (25%) so quality_score should be heavily influenced
  assert.ok(out.quality_score >= 75 && out.quality_score <= 100);
});

test('judge scores sproutmath authoring on child-content dimensions', async () => {
  const client = fakeClient(makeReply({
    answer_validity: 10,
    grade_fit: 9,
    hint_quality: 8,
    accessibility_language: 8,
    child_safety: 10,
    policy_violation: false,
    reasoning: 'Valid item with appropriate grade fit and safe language.',
  }));

  const out = await scoreResponse({
    prompt: 'Create a grade 2 subtraction item',
    response: 'A JSON math item...',
    dataset: 'sproutmath-authoring-v1',
    client,
  });

  assert.equal(out.answer_validity, 10);
  assert.equal(out.child_safety, 10);
  assert.equal(out.relevance, undefined);
  assert.ok(out.quality_score >= 85 && out.quality_score <= 100);
});

test('judge retries on malformed JSON and eventually succeeds', async () => {
  let attempt = 0;
  const client = fakeClient(() => {
    attempt++;
    if (attempt < 3) {
      return { choices: [{ message: { content: 'not json here' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
    }
    return makeReply({
      relevance: 7, accuracy: 7, actionability: 7, coherence: 7, conciseness: 7,
      policy_violation: false, reasoning: 'ok',
    });
  });

  const out = await scoreResponse({
    prompt: 'q', response: 'a', dataset: 'seller-intelligence-v2', client, retries: 3,
  });

  assert.equal(attempt, 3, 'should retry twice before succeeding on third attempt');
  assert.equal(out.relevance, 7);
});

test('judge returns sentinel scores after all retries exhaust', async () => {
  const client = fakeClient(makeReply({ bad: 'shape' })); // missing required fields

  const out = await scoreResponse({
    prompt: 'q', response: 'a', dataset: 'seller-intelligence-v2', client, retries: 2,
  });

  assert.equal(out.relevance, 0);
  assert.equal(out.accuracy, 0);
  assert.equal(out.quality_score, 0);
  assert.match(out.reasoning, /ERROR/);
});

test('judge strips markdown code fences from reply', async () => {
  const client = fakeClient({
    choices: [{
      message: {
        content: '```json\n' + JSON.stringify({
          relevance: 6, accuracy: 6, actionability: 6, coherence: 6, conciseness: 6,
          policy_violation: false, reasoning: 'mid',
        }) + '\n```',
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
  });

  const out = await scoreResponse({
    prompt: 'q', response: 'a', dataset: 'seller-intelligence-v2', client,
  });

  assert.equal(out.relevance, 6);
  assert.equal(out.quality_score, 60);
});

test('judge propagates policy_violation flag', async () => {
  const client = fakeClient(makeReply({
    relevance: 5, accuracy: 3, actionability: 5, coherence: 5, conciseness: 5,
    policy_violation: true, reasoning: 'Factually wrong safety guidance.',
  }));

  const out = await scoreResponse({
    prompt: 'q', response: 'a', dataset: 'seller-support-v2', client,
  });

  assert.equal(out.policy_violation, true);
});
