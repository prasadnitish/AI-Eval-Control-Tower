import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GATE_SCRIPT = join(ROOT, 'eval/check-gate.js');

function makeResults(overrides = {}) {
  return {
    meta: { dataset: 'sproutroute-v2', suite: 'smoke', prompt_count: 14, generated_at: '2026-04-17', run_id: 'r', judge_model: 'j', runner_version: '2.0.0', dataset_version: '2.0' },
    model_a: { name: 'Model A', provider: 'A', version: 'a' },
    model_b: { name: 'Model B', provider: 'B', version: 'b' },
    summary: {
      model_a_avg_quality: 79,
      model_b_avg_quality: 80,
      model_a_p50_latency_ms: 4000,
      model_a_p95_latency_ms: 10000,
      model_a_p99_latency_ms: 12000,
      model_b_p50_latency_ms: 3000,
      model_b_p95_latency_ms: 8000,
      model_b_p99_latency_ms: 10000,
      model_a_total_cost_usd: 0.05,
      model_b_total_cost_usd: 0.03,
      model_a_avg_cost_per_inference: 0.001,
      model_b_avg_cost_per_inference: 0.0008,
      policy_violations: 0,
    },
    per_model: {
      'model-a': {
        name: 'Model A', provider: 'A', id: 'a',
        avg_quality: 79, p50_latency_ms: 4000, p95_latency_ms: 10000, p99_latency_ms: 12000,
        total_cost_usd: 0.05, avg_cost_per_inference: 0.001, policy_violations: 0,
        dimension_averages: { safety: 9.0, relevance: 8.5 },
      },
      'model-b': {
        name: 'Model B', provider: 'B', id: 'b',
        avg_quality: 80, p50_latency_ms: 3000, p95_latency_ms: 8000, p99_latency_ms: 10000,
        total_cost_usd: 0.03, avg_cost_per_inference: 0.0008, policy_violations: 0,
        dimension_averages: { safety: 9.2, relevance: 8.7 },
      },
    },
    daily: [{ date: '2026-04-17', model_a: { quality_score: 79 }, model_b: { quality_score: 80 } }],
    events: [],
    prompts: [],
    ...overrides,
  };
}

function runGate(results) {
  const tmp = mkdtempSync(join(tmpdir(), 'gate-test-'));
  const file = join(tmp, 'r.json');
  writeFileSync(file, JSON.stringify(results));
  const out = spawnSync('node', [GATE_SCRIPT, file], { encoding: 'utf-8', cwd: ROOT });
  rmSync(tmp, { recursive: true, force: true });
  return { code: out.status, stdout: out.stdout, stderr: out.stderr };
}

test('gate returns GO when all checks pass', () => {
  const r = makeResults({
    summary: {
      ...makeResults().summary,
      model_a_p95_latency_ms: 2000, // under 3000 ceiling
      model_b_p95_latency_ms: 2000,
      model_a_avg_cost_per_inference: 0.001, // under 0.005 ceiling
    },
    per_model: {
      'model-a': { ...makeResults().per_model['model-a'], p95_latency_ms: 2000 },
      'model-b': { ...makeResults().per_model['model-b'], p95_latency_ms: 2000 },
    },
  });
  const { code, stdout } = runGate(r);
  assert.equal(code, 0);
  assert.match(stdout, /Verdict: GO/);
});

test('gate returns NO-GO on policy violation', () => {
  const r = makeResults({
    summary: { ...makeResults().summary, policy_violations: 2 },
  });
  const { code, stdout } = runGate(r);
  assert.equal(code, 1);
  assert.match(stdout, /Verdict: NO-GO/);
  assert.match(stdout, /Policy violations: 2/);
});

test('gate returns NO-GO when sproutroute safety drops below 8.0', () => {
  const r = makeResults({
    per_model: {
      'model-a': {
        ...makeResults().per_model['model-a'],
        dimension_averages: { safety: 7.5, relevance: 8.0 },
      },
      'model-b': makeResults().per_model['model-b'],
    },
  });
  const { code, stdout } = runGate(r);
  assert.equal(code, 1);
  assert.match(stdout, /safety score: 7\.5.*below hard floor 8/);
});

test('gate returns NO-GO when sproutmath answer validity drops below authoring floor', () => {
  const r = makeResults({
    meta: { ...makeResults().meta, dataset: 'sproutmath-authoring-v1' },
    per_model: {
      'model-a': {
        ...makeResults().per_model['model-a'],
        dimension_averages: {
          answer_validity: 8.2,
          grade_fit: 9.0,
          child_safety: 9.5,
        },
      },
      'model-b': {
        ...makeResults().per_model['model-b'],
        dimension_averages: {
          answer_validity: 9.4,
          grade_fit: 9.1,
          child_safety: 9.7,
        },
      },
    },
  });

  const { code, stdout } = runGate(r);
  assert.equal(code, 1);
  assert.match(stdout, /answer_validity score: 8\.2.*below hard floor 8\.5/);
});

test('gate returns CONDITIONAL GO on latency within soft limit', () => {
  // Use seller-intelligence-v2 dataset — it keeps the base 3000ms ceiling
  const r = makeResults({
    meta: { ...makeResults().meta, dataset: 'seller-intelligence-v2' },
    summary: {
      ...makeResults().summary,
      model_a_p95_latency_ms: 3300, // 10% over 3000 ceiling, within 20% soft
      model_b_p95_latency_ms: 2900,
    },
  });
  const { code, stdout } = runGate(r);
  assert.equal(code, 0, 'conditional-go still exits 0');
  assert.match(stdout, /Verdict: CONDITIONAL GO/);
});

test('gate returns NO-GO when latency exceeds soft limit', () => {
  const r = makeResults({
    meta: { ...makeResults().meta, dataset: 'seller-intelligence-v2' },
    summary: {
      ...makeResults().summary,
      model_a_p95_latency_ms: 4000, // 33% over 3000, exceeds 20% soft
      model_b_p95_latency_ms: 2900,
    },
  });
  const { code, stdout } = runGate(r);
  assert.equal(code, 1);
  assert.match(stdout, /exceeds soft ceiling.*\(limit: 20%\)/);
});

test('gate uses per-dataset latency override for sproutroute-v2', () => {
  // SproutRoute override raises ceiling to 15000ms — 10000ms should pass
  const r = makeResults({
    summary: {
      ...makeResults().summary,
      model_a_p95_latency_ms: 10000,
      model_b_p95_latency_ms: 8000,
    },
  });
  const { code, stdout } = runGate(r);
  assert.equal(code, 0);
  assert.match(stdout, /Verdict: GO/);
});

test('gate respects quality delta floor when baseline present', () => {
  const results = makeResults({ summary: { ...makeResults().summary, model_a_avg_quality: 70 } });
  const baseline = makeResults({
    daily: [{ date: '2026-04-10', model_a: { quality_score: 80 }, model_b: { quality_score: 80 } }],
  });
  const tmp = mkdtempSync(join(tmpdir(), 'gate-test-'));
  const rf = join(tmp, 'r.json');
  const bf = join(tmp, 'b.json');
  writeFileSync(rf, JSON.stringify(results));
  writeFileSync(bf, JSON.stringify(baseline));
  const out = spawnSync('node', [GATE_SCRIPT, rf, '--baseline', bf], { encoding: 'utf-8', cwd: ROOT });
  rmSync(tmp, { recursive: true, force: true });
  assert.equal(out.status, 1);
  // 70 vs 80 = -12.5% drop, exceeds -5% floor
  assert.match(out.stdout, /Model A quality delta: -12\.5%.*exceeds hard floor/);
});
