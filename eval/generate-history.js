#!/usr/bin/env node
/**
 * generate-history.js — Extends a real eval run to a 30-day daily time series.
 * Adds two drift events with realistic variance and recoveries.
 *
 * Usage:
 *   node eval/generate-history.js \
 *     --input output/eval-results.json \
 *     --output output/eval-results.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
const INPUT_PATH = args['input'] || 'output/eval-results.json';
const OUTPUT_PATH = args['output'] || 'output/eval-results.json';

const base = JSON.parse(readFileSync(resolve(ROOT, INPUT_PATH), 'utf-8'));

// Pull baseline values from the real run (day 0)
const baseA = base.daily[0].model_a;
const baseB = base.daily[0].model_b;

/**
 * Log-normal noise: multiplicative perturbation centred near 1.0
 * sigma controls spread; positive mu shifts slightly up.
 */
function lognormal(mu = 0, sigma = 0.04) {
  // Box-Muller transform
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function round2(v) { return Math.round(v * 100) / 100; }
function round0(v) { return Math.round(v); }

/**
 * Drift event design (from PRD):
 *
 * Event 1 — Distribution shift (Days 10-18, resolved Day 22)
 *   Quality degrades slowly as harder prompts dominate the daily sample.
 *   Both models affected. Resolved by rebalancing — sharp recovery.
 *
 * Event 2 — Model behaviour shift (Days 26-28, UNRESOLVED)
 *   Sharp cliff on DeepSeek (model_b) root-cause-analysis category.
 *   Model A less affected. No recovery — chart ends with this open.
 */
function qualityMultiplier(dayIndex, model) {
  // Day 10-18: slow drift down (distribution shift)
  if (dayIndex >= 10 && dayIndex <= 17) {
    const depth = (dayIndex - 9) / 8; // 0→1 over 8 days
    const drop = model === 'a' ? 0.06 : 0.09; // B drops more
    return 1 - depth * drop;
  }
  // Day 18-21: partial recovery
  if (dayIndex >= 18 && dayIndex <= 21) {
    const recovery = (dayIndex - 17) / 4; // 0→1 over 4 days
    const prevDrop = model === 'a' ? 0.06 : 0.09;
    return (1 - prevDrop) + recovery * prevDrop;
  }
  // Day 22+: back to near-baseline until event 2
  // Day 25-29: sharp model B cliff (behaviour shift)
  if (dayIndex >= 25 && model === 'b') {
    const depth = Math.min((dayIndex - 24) / 3, 1); // 0→1 over 3 days
    return 1 - depth * 0.14; // 14% drop on B, unresolved
  }
  if (dayIndex >= 25 && model === 'a') {
    const depth = Math.min((dayIndex - 24) / 3, 1);
    return 1 - depth * 0.03; // A slightly affected
  }
  return 1;
}

function latencyMultiplier(dayIndex, model) {
  // Latency degrades during event 1 (higher difficulty = longer responses)
  if (dayIndex >= 10 && dayIndex <= 17) {
    const depth = (dayIndex - 9) / 8;
    return 1 + depth * 0.15;
  }
  if (dayIndex >= 18 && dayIndex <= 21) {
    const recovery = (dayIndex - 17) / 4;
    return 1.15 - recovery * 0.15;
  }
  return 1;
}

// Generate 30 daily entries
const startDate = new Date('2026-01-21');
const dailyEntries = [];

for (let day = 0; day < 30; day++) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + day);
  const dateStr = date.toISOString().split('T')[0];

  const qMultA = qualityMultiplier(day, 'a');
  const qMultB = qualityMultiplier(day, 'b');
  const lMult = latencyMultiplier(day, 'a');

  // Model A daily values
  const qaRaw = baseA.quality_score * qMultA * lognormal(0, 0.025);
  const qaScore = clamp(round2(qaRaw), 40, 100);
  const latA_p50 = round0(baseA.latency_p50 * lMult * lognormal(0, 0.06));
  const latA_p95 = round0(baseA.latency_p95 * lMult * lognormal(0, 0.08));
  const latA_p99 = round0(baseA.latency_p99 * lMult * lognormal(0, 0.10));

  // Model B daily values (DeepSeek has higher latency variance)
  const qbRaw = baseB.quality_score * qMultB * lognormal(0, 0.035);
  const qbScore = clamp(round2(qbRaw), 40, 100);
  const latB_p50 = round0(baseB.latency_p50 * latencyMultiplier(day, 'b') * lognormal(0, 0.09));
  const latB_p95 = round0(baseB.latency_p95 * latencyMultiplier(day, 'b') * lognormal(0, 0.12));
  const latB_p99 = round0(baseB.latency_p99 * latencyMultiplier(day, 'b') * lognormal(0, 0.15));

  // Dimension scores (jittered around day's quality level)
  const dimJitter = () => lognormal(0, 0.04);
  const scaleDim = (base, qualityFactor) => clamp(round2(base * qualityFactor * dimJitter()), 1, 10);

  dailyEntries.push({
    date: dateStr,
    model_a: {
      quality_score: qaScore,
      latency_p50: Math.max(200, latA_p50),
      latency_p95: Math.max(300, latA_p95),
      latency_p99: Math.max(400, latA_p99),
      cost_per_inference: round2(baseA.cost_per_inference * lognormal(0, 0.02) * 1000) / 1000,
      scores: {
        relevance: scaleDim(baseA.scores.relevance, qMultA),
        accuracy: scaleDim(baseA.scores.accuracy, qMultA),
        actionability: scaleDim(baseA.scores.actionability, qMultA),
        coherence: scaleDim(baseA.scores.coherence, qMultA),
        conciseness: scaleDim(baseA.scores.conciseness, qMultA),
      },
    },
    model_b: {
      quality_score: qbScore,
      latency_p50: Math.max(200, latB_p50),
      latency_p95: Math.max(300, latB_p95),
      latency_p99: Math.max(400, latB_p99),
      cost_per_inference: round2(baseB.cost_per_inference * lognormal(0, 0.02) * 1000) / 1000,
      scores: {
        relevance: scaleDim(baseB.scores.relevance, qMultB),
        accuracy: scaleDim(baseB.scores.accuracy, qMultB),
        actionability: scaleDim(baseB.scores.actionability, qMultB),
        coherence: scaleDim(baseB.scores.coherence, qMultB),
        conciseness: scaleDim(baseB.scores.conciseness, qMultB),
      },
    },
  });
}

// Events
const events = [
  {
    type: 'distribution_shift',
    label: 'Distribution Shift',
    start: '2026-01-31',
    end: '2026-02-08',
    resolved: true,
    resolved_at: '2026-02-11',
    status: 'Resolved',
    description: 'Prompt difficulty mix skewed toward hard tier. Quality scores degraded across both models over 8 days. Resolved via prompt category rebalancing.',
  },
  {
    type: 'behaviour_shift',
    label: 'Model Behaviour Shift',
    start: '2026-02-15',
    end: null,
    resolved: false,
    resolved_at: null,
    status: 'Under Investigation',
    description: 'Sharp quality drop on root-cause-analysis prompts for DeepSeek-V3. Detected in 2 days vs 8 days for Event 1 — improved threshold calibration after Event 1. Status: under investigation.',
  },
];

// Update and write
base.daily = dailyEntries;
base.events = events;
base.meta.history_generated_at = new Date().toISOString();
base.meta.history_days = 30;

writeFileSync(resolve(ROOT, OUTPUT_PATH), JSON.stringify(base, null, 2));

console.log(`History generation complete.`);
console.log(`Days:     30 (${dailyEntries[0].date} → ${dailyEntries[29].date})`);
console.log(`Events:   ${events.length} (1 resolved, 1 unresolved)`);
console.log(`Output:   ${OUTPUT_PATH}`);
