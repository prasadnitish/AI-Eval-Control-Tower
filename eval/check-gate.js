#!/usr/bin/env node
/**
 * check-gate.js — CI gate for AI Evals Control Tower
 *
 * Reads an eval-results.json, applies the release gate policy, and exits:
 *   0 — GO or CONDITIONAL GO (PR check passes)
 *   1 — NO-GO (PR check fails, merge blocked)
 *
 * Usage:
 *   node eval/check-gate.js output/ci-results.json
 *   node eval/check-gate.js output/ci-results.json --baseline output/eval-results.json
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function parseArgs(argv) {
  const args = { positional: [] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] || true;
      i++;
    } else {
      args.positional.push(argv[i]);
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const RESULTS_PATH = args.positional[0];
const BASELINE_PATH = args['baseline'] || 'output/eval-results.json';

if (!RESULTS_PATH) {
  console.error('Usage: node eval/check-gate.js <results-file> [--baseline <baseline-file>]');
  process.exit(1);
}

const settings = JSON.parse(readFileSync(join(ROOT, 'config/settings.json'), 'utf-8'));
const gate = settings.release_gate;
const conditional = settings.conditional_go;

let results, baseline;
try {
  results = JSON.parse(readFileSync(resolve(ROOT, RESULTS_PATH), 'utf-8'));
} catch (err) {
  console.error(`Cannot read results file: ${RESULTS_PATH}\n${err.message}`);
  process.exit(1);
}

try {
  baseline = JSON.parse(readFileSync(resolve(ROOT, BASELINE_PATH), 'utf-8'));
} catch {
  baseline = null;
}

// ── Pull metrics from results ─────────────────────────────────────────────────
const summary = results.summary;
const dataset = results.meta?.dataset || 'unknown';
const suite = results.meta?.suite || 'unknown';
const promptCount = results.meta?.prompt_count || (results.prompts?.length || 0);

const avgQualityA = summary?.model_a_avg_quality || 0;
const avgQualityB = summary?.model_b_avg_quality || 0;
const policyViolations = summary?.policy_violations || 0;
const p95LatA = summary?.model_a_p95_latency_ms || 0;
const p95LatB = summary?.model_b_p95_latency_ms || 0;
const costPerInfA = summary?.model_a_avg_cost_per_inference || 0;
const costPerInfB = summary?.model_b_avg_cost_per_inference || 0;

// Get baseline quality from baked results (first day)
let baselineQualityA = null, baselineQualityB = null;
if (baseline?.daily?.length) {
  baselineQualityA = baseline.daily[0].model_a?.quality_score || null;
  baselineQualityB = baseline.daily[0].model_b?.quality_score || null;
}

// ── Apply gate policy ─────────────────────────────────────────────────────────
const failures = [];
const warnings = [];
const passes = [];

// Hard floor: policy violations
if (policyViolations > 0) {
  failures.push(`Policy violations: ${policyViolations} prompt(s) flagged — hard NO-GO regardless of other scores`);
} else {
  passes.push(`Policy violations: 0 ✓`);
}

// Hard floor: quality delta vs baseline
if (baselineQualityA !== null) {
  const deltaA = ((avgQualityA - baselineQualityA) / baselineQualityA) * 100;
  const deltaB = baselineQualityB !== null
    ? ((avgQualityB - baselineQualityB) / baselineQualityB) * 100
    : null;

  if (deltaA < -gate.quality_drop_threshold_pct) {
    failures.push(`Model A quality delta: ${deltaA.toFixed(1)}% (threshold: -${gate.quality_drop_threshold_pct}%) — exceeds hard floor`);
  } else {
    passes.push(`Model A quality delta: ${deltaA.toFixed(1)}% (baseline: ${baselineQualityA}) ✓`);
  }

  if (deltaB !== null && deltaB < -gate.quality_drop_threshold_pct) {
    failures.push(`Model B quality delta: ${deltaB.toFixed(1)}% (threshold: -${gate.quality_drop_threshold_pct}%) — exceeds hard floor`);
  } else if (deltaB !== null) {
    passes.push(`Model B quality delta: ${deltaB.toFixed(1)}% (baseline: ${baselineQualityB}) ✓`);
  }
} else {
  // No baseline available — check absolute scores
  if (avgQualityA < 50) {
    failures.push(`Model A quality score critically low: ${avgQualityA} (no baseline to compare)`);
  } else {
    passes.push(`Model A quality: ${avgQualityA} (no baseline) ✓`);
  }
}

// Safety floor: latency (soft limit — triggers CONDITIONAL GO, not hard NO-GO)
if (p95LatA > gate.latency_p95_ceiling_ms) {
  const overPct = (((p95LatA - gate.latency_p95_ceiling_ms) / gate.latency_p95_ceiling_ms) * 100).toFixed(1);
  if (parseFloat(overPct) > conditional.latency_soft_limit_pct) {
    failures.push(`Model A P95 latency: ${p95LatA}ms — exceeds soft ceiling ${gate.latency_p95_ceiling_ms}ms by ${overPct}% (limit: ${conditional.latency_soft_limit_pct}%)`);
  } else {
    warnings.push(`Model A P95 latency: ${p95LatA}ms — above ceiling ${gate.latency_p95_ceiling_ms}ms by ${overPct}% (within soft limit)`);
  }
} else {
  passes.push(`Model A P95 latency: ${p95LatA}ms ✓`);
}

if (p95LatB > gate.latency_p95_ceiling_ms) {
  const overPct = (((p95LatB - gate.latency_p95_ceiling_ms) / gate.latency_p95_ceiling_ms) * 100).toFixed(1);
  if (parseFloat(overPct) > conditional.latency_soft_limit_pct) {
    failures.push(`Model B P95 latency: ${p95LatB}ms — exceeds soft ceiling ${gate.latency_p95_ceiling_ms}ms by ${overPct}%`);
  } else {
    warnings.push(`Model B P95 latency: ${p95LatB}ms — above ceiling by ${overPct}% (within soft limit)`);
  }
} else {
  passes.push(`Model B P95 latency: ${p95LatB}ms ✓`);
}

// Cost ceiling (soft limit)
if (costPerInfA > gate.cost_per_inference_ceiling_usd) {
  const overPct = (((costPerInfA - gate.cost_per_inference_ceiling_usd) / gate.cost_per_inference_ceiling_usd) * 100).toFixed(1);
  if (parseFloat(overPct) > conditional.cost_soft_limit_pct) {
    failures.push(`Model A cost/inference: $${costPerInfA} — exceeds ceiling $${gate.cost_per_inference_ceiling_usd} by ${overPct}%`);
  } else {
    warnings.push(`Model A cost/inference: $${costPerInfA} — above ceiling by ${overPct}% (within soft limit)`);
  }
} else {
  passes.push(`Model A cost/inference: $${costPerInfA} ✓`);
}

// ── Determine verdict ─────────────────────────────────────────────────────────
let verdict, exitCode;
if (failures.length > 0) {
  verdict = 'NO-GO';
  exitCode = 1;
} else if (warnings.length > 0) {
  verdict = 'CONDITIONAL GO';
  exitCode = 0;
} else {
  verdict = 'GO';
  exitCode = 0;
}

// ── Print summary ─────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`AI Evals Gate`);
console.log(`${'='.repeat(50)}`);
console.log(`Dataset:  ${dataset} (${suite} suite, ${promptCount} prompts)`);
console.log(`Model A:  ${results.model_a?.name || 'unknown'}  →  avg quality: ${avgQualityA}`);
console.log(`Model B:  ${results.model_b?.name || 'unknown'}  →  avg quality: ${avgQualityB}`);
if (baselineQualityA) console.log(`Baseline: ${baselineQualityA} (Model A) / ${baselineQualityB || '—'} (Model B)`);
console.log('');

if (passes.length) {
  console.log('PASSED:');
  for (const p of passes) console.log(`  ✓ ${p}`);
}
if (warnings.length) {
  console.log('\nWARNINGS (CONDITIONAL GO):');
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
if (failures.length) {
  console.log('\nFAILED:');
  for (const f of failures) console.log(`  ✗ ${f}`);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Verdict: ${verdict}`);
console.log(`PR check: ${exitCode === 0 ? 'PASS' : 'FAIL'}`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(exitCode);
