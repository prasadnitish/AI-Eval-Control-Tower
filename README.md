# AI Evals Control Tower

A release-readiness system for AI products. Evaluates baseline vs candidate model behavior across quality, safety, latency, and cost — then outputs a clear **GO**, **CONDITIONAL GO**, or **NO-GO** decision.

As of v2.0, runs **N-way** (any number of models) through a single OpenRouter API key, and doubles as the **SproutRoute model lab**.

**Live dashboard:** [nitishprasad.com/evals](https://www.nitishprasad.com/evals/)
**Project page:** [nitishprasad.com/ai-eval-control-tower](https://www.nitishprasad.com/ai-eval-control-tower.html)

---

## What It Does

| Capability | Detail |
|---|---|
| N-way eval runner | Runs 2+ models through OpenRouter on any dataset via CLI |
| LLM-as-judge | Scores responses on 5–7 dimensions (1–10) + `policy_violation` flag |
| Release gate | GO / CONDITIONAL GO / NO-GO with reason codes and safety hard floors |
| Drift timeline | Distribution-shift and behaviour-shift events over 30 days |
| CI gate | GitHub Actions smoke eval blocks PRs on regression |
| Dashboard | React + Recharts — Overview, Accuracy, Latency, Cost, A/B, Model Matrix, Release Readiness |
| SproutRoute lab | Benchmarks cheap+fast models (GPT-5 nano, Grok, Gemini) for trip planning on safety and logistical feasibility |

---

## Quick Start

```bash
# Install
npm install

# Copy and populate API key (one key, many models)
cp .env.example .env
# then edit .env and paste your OPENROUTER_API_KEY (https://openrouter.ai/settings/keys)

# Estimate cost before spending (no API calls made)
npm run eval:dry -- --dataset sproutroute-v2 --suite smoke --models claude-haiku-4.5,gpt-5-nano

# Run SproutRoute smoke suite (4 models, ~14 prompts)
npm run eval:sproutroute

# Check release gate verdict
npm run gate -- output/eval-results.json

# Start dashboard dev server
npm run dev
```

---

## Providers and Models

All model calls (candidates **and** the judge) route through **OpenRouter** — one API key gives you Claude, GPT, Grok, Gemini, DeepSeek, and more. Pricing pass-through plus a small OpenRouter markup.

Current registry (`config/models.json`):

| Slug | Name | Tier | $/M in | $/M out |
|---|---|---|---|---|
| `claude-sonnet-4.6` | Claude Sonnet 4.6 | flagship | $3.00 | $15.00 |
| `claude-haiku-4.5` | Claude Haiku 4.5 | fast | $1.00 | $5.00 |
| `gpt-5-mini` | GPT-5 Mini | mid | $0.25 | $2.00 |
| `gpt-5-nano` | GPT-5 Nano | cheap | $0.05 | $0.40 |
| `grok-4-fast` | Grok 4 Fast | cheap | $0.20 | $0.50 |
| `gemini-2.5-flash` | Gemini 2.5 Flash | mid | $0.30 | $2.50 |
| `deepseek-v3.2` | DeepSeek-V3.2 | cheap | $0.27 | $1.10 |

Add a new model by appending to `config/models.json` — the runner discovers it automatically. Verify the exact OpenRouter slug at [openrouter.ai/models](https://openrouter.ai/models) before committing.

---

## Eval Runner CLI

```bash
node eval/eval-runner.js \
  --models claude-sonnet-4.6,gpt-5-nano,grok-4-fast,gemini-2.5-flash \
  --dataset sproutroute-v2 \
  --suite smoke \
  --baseline claude-sonnet-4.6 \
  --candidate gpt-5-nano \
  --output output/eval-results.json
```

| Flag | Default | Description |
|---|---|---|
| `--models` | `claude-sonnet-4.6,deepseek-v3.2` | Comma-separated model slugs from `config/models.json` (≥2) |
| `--baseline` | first in `--models` | Slot `model_a` in the dashboard / gate |
| `--candidate` | second in `--models` | Slot `model_b` in the dashboard / gate |
| `--dataset` | `seller-intelligence-v2` | Dataset id or path to JSON |
| `--suite` | `full` | `smoke` (N per category) or `full` |
| `--output` | `output/eval-results.json` | Output path |
| `--dry-run` | | Print cost estimate, no API calls |
| `--skip-validate` | | Skip OpenRouter pre-flight model-id check |
| `--model-a` / `--model-b` | | Back-compat aliases for a 2-way run |

---

## Using This as a SproutRoute Model Lab

Purpose: pick the best model for the [SproutRoute](https://sproutroute-production.up.railway.app) trip-planning backend on quality, cost, latency, and **safety** (child/pet appropriateness, car seat law accuracy, allergen flags).

```bash
# Smoke — 4 cheap/fast models, ~14 prompts (~$0.30)
npm run eval:sproutroute

# Full — all 7 models × 25 prompts (~$1.50–2.00)
npm run eval:sproutroute:full
```

Then open the dashboard (`npm run dev`) and go to **Model Matrix** — it ranks all models on quality, cost, latency, and surfaces per-dimension scores including **safety** and **logistical_feasibility** (the two dimensions unique to SproutRoute). Any model with safety <8.0 gets flagged as NO-GO automatically.

**SproutRoute weights** (`config/judge-rubric.json`):

| Dimension | Weight |
|---|---|
| Safety (hard floor ≥8.0) | 25% |
| Accuracy | 20% |
| Actionability | 15% |
| Logistical feasibility | 15% |
| Relevance | 10% |
| Coherence | 10% |
| Conciseness | 5% |

Family personas live in [`datasets/sproutroute-profiles.json`](datasets/sproutroute-profiles.json) — 12 reusable archetypes spanning toddlers, ADHD, wheelchair access, severe allergies, kosher, sensory needs, and pet travel.

---

## Datasets

| File | Prompts | Categories | Difficulty | Domain |
|---|---|---|---|---|
| `datasets/seller-intelligence-v2.json` | 50 | 12 | easy/medium/hard mix | AM call prep, risk triage, pricing strategy |
| `datasets/seller-intelligence-v3.json` | 24 | 12 | medium/hard only (hard-eval) | AM advisory with richer context_blocks |
| `datasets/seller-support-v2.json` | 50 | 12 | easy/medium/hard mix | Policy guidance, account health, appeals |
| `datasets/seller-support-v3.json` | 24 | 12 | medium/hard only (hard-eval) | Suspensions, IP appeals, counterfeit, POA |
| `datasets/sproutroute-v2.json` | 25 | 7 | easy/medium/hard mix | Itinerary, packing, safety, weather, diet, theme park, international |

All v2/v3 datasets use structured `context_blocks` for prompt injection. SproutRoute v2 references `family_profile_id` → `datasets/sproutroute-profiles.json`. Seller v3 references `seller_profile_id` → `datasets/seller-profiles-v3.json` and `asin-catalog-v3.json` (though context_blocks carry the needed snapshots inline, so profile lookup is mostly redundant).

**v3 positioning:** Hard-eval datasets derived from the `dataset-brainstorm-v3/` seed banks. Skewed toward high-severity, policy-dense cases where the cheap/fast models are likely to fail. Use v2 for broad coverage; use v3 to stress-test candidates.

---

## NPM Scripts

```bash
npm run eval:sproutroute           # 4 cheap models, 14 prompts, ~$0.30
npm run eval:sproutroute:full      # 7 models, 25 prompts, ~$1.85
npm run eval:seller                # v2 seller intel, 2 models smoke
npm run eval:seller:v3             # v3 seller intel, 4 models, ~$1.25
npm run eval:support:v3            # v3 seller support, 4 models, ~$1.25
npm run eval:dry                   # Cost estimator (no API calls)
npm run gate                       # Apply release gate to a results file
npm run history                    # Synthesize 30-day time series from a real run
npm test                           # Unit tests for judge + gate
```

---

## Rubric and Dimensions

Core dimensions (all datasets):
- **Relevance**, **Accuracy**, **Actionability**, **Coherence**, **Conciseness**

SproutRoute datasets add:
- **Safety** — age appropriateness, pet safety, car seat law accuracy, allergen flags (hard floor ≥8.0)
- **Logistical feasibility** — travel times, hours, seasonal availability, weather fit

Weights per dataset live in `config/judge-rubric.json`. Judge model is Claude Sonnet 4.6 by default (configurable in `config/models.json`).

---

## Release Gate Policy

Defined in `config/settings.json` + `config/judge-rubric.json`, enforced by `eval/check-gate.js`.

**Hard NO-GO** (any one triggers):
- Any `policy_violation: true`
- Aggregate weighted quality drop >5% vs baseline
- **Safety** score <8.0 on any hard-floor dimension (e.g. SproutRoute `safety`)
- Mandatory workflow pass rate <85%

**Conditional GO:** Quality neutral/improved; latency or cost regress within soft bounds (20% latency, 30% cost). Owner documents mitigation before merge.

**GO:** No hard conditions triggered. Quality at or above baseline.

---

## Dashboard

Seven views, all consuming a single `EvalResults` JSON (drag-drop upload supported):

1. **Overview** — KPI cards, top failure categories, summary verdict
2. **Accuracy** — Quality time series, difficulty-band comparison, drift timeline
3. **Latency** — P50/P95/P99 comparison
4. **Cost** — Cost trend + cumulative savings calculator
5. **A/B Comparison** — Radar chart, side-by-side metric table, structured verdict
6. **Model Matrix** — N-way ranking table with per-dimension scores, quality/$ leader
7. **Release Readiness** — Interactive gate sliders, real-time verdict

The Model Matrix view is new in v2.0 and only populates when the results file has a `per_model` section (produced by the N-way runner).

---

## File Structure

```
ai-evals-control-tower/
├── config/
│   ├── models.json           # OpenRouter model registry
│   ├── judge-rubric.json     # Dimensions, weights, hard-floor rules
│   └── settings.json         # Gate thresholds, suite config, defaults
│
├── datasets/
│   ├── seller-intelligence-v2.json
│   ├── seller-support-v2.json
│   ├── seller-profiles.json
│   ├── sproutroute-v2.json
│   └── sproutroute-profiles.json
│
├── eval/
│   ├── openrouterClient.js   # OpenAI-compatible client pointed at OpenRouter
│   ├── eval-runner.js        # N-way CLI runner
│   ├── judge.js              # Single-model LLM-as-judge
│   ├── check-gate.js         # Results → GO / CONDITIONAL GO / NO-GO
│   └── generate-history.js   # Extends a real run to a 30-day time series
│
├── src/                      # React + TypeScript dashboard (Vite)
│   ├── views/
│   │   ├── Overview.tsx
│   │   ├── AccuracyView.tsx
│   │   ├── LatencyView.tsx
│   │   ├── CostView.tsx
│   │   ├── ABComparison.tsx
│   │   ├── MultiModelMatrix.tsx
│   │   └── ReleaseReadiness.tsx
│   ├── schema/types.ts       # EvalResults + PerModelSummary types
│   └── data/useEvalData.ts   # Upload, validation, date filtering
│
└── .github/
    └── workflows/
        └── eval-gate.yml     # CI: smoke eval on every PR to main
```

---

## Environment Variables

```bash
# Required — one key, routes to all providers
OPENROUTER_API_KEY=sk-or-v1-...
```

Get a key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys). $5 of credit gets you dozens of full-suite runs.

---

## PRD

Full product requirements, architecture decisions, rubric rationale, gate policy, and delivery plan: [`PRD_AI_Eval_Control_Tower_v3.md`](./PRD_AI_Eval_Control_Tower_v3.md)
