# AI Evals Control Tower

A release-readiness system for AI products. It evaluates candidate models against real workflow datasets, scores them with a configurable judge rubric, and turns the evidence into a clear **GO**, **CONDITIONAL GO**, or **NO-GO** product decision.

The repo is designed to be cloned and run locally with your own API key. The public dashboard uses baked demo results; the CLI is the executable version.

**Live dashboard:** [nitishprasad.com/evals](https://www.nitishprasad.com/evals/)
**Project page:** [nitishprasad.com/ai-eval-control-tower](https://www.nitishprasad.com/ai-eval-control-tower.html)

---

## What It Does

| Capability | Detail |
|---|---|
| N-way eval runner | Runs 2+ models through OpenRouter on any dataset via CLI |
| Bring-your-own-key execution | Copy `.env.example`, paste `OPENROUTER_API_KEY`, and run local evals without sending keys to the browser |
| LLM-as-judge | Scores responses on dataset-specific dimensions (1–10) + `policy_violation` flag |
| Evidence chain | Shows what data was checked, who judged it, how scores were produced, and what the scores do not prove |
| Release gate | GO / CONDITIONAL GO / NO-GO with reason codes and safety hard floors |
| Drift timeline | Distribution-shift and behaviour-shift events over 30 days |
| CI gate | GitHub Actions smoke eval blocks PRs on regression |
| Dashboard | React + Vite launch-review tool with decision memo, evidence chain, candidate board, rubric/failure modes, operating envelope, rollout plan, and runbook |
| Three product scenarios | Seller-growth AM recommendations, SproutMath content authoring, and SproutRoute family-travel planning |

---

## Quick Start

```bash
# Install
npm install

# Copy and populate API key (one key, many models)
cp .env.example .env
# then edit .env and paste your OPENROUTER_API_KEY
# https://openrouter.ai/settings/keys

# Estimate cost before spending (no API calls made)
npm run eval:dry -- --dataset sproutroute-v2 --suite smoke --models claude-haiku-4.5,gpt-5-nano

# Run SproutRoute smoke suite (4 models, ~14 prompts)
npm run eval:sproutroute

# Check release gate verdict
npm run gate -- output/eval-results.json

# Start dashboard dev server
npm run dev
```

The CLI loads `.env` automatically. API keys stay local to the Node runner and are never required by the browser dashboard.

---

## Evaluation Method

### What data is checked?

Datasets live in [`datasets/`](datasets/) and are plain JSON so teams can inspect or replace them.

| Dataset | What it checks | Primary use case |
|---|---|---|
| `seller-intelligence-v3` | Seller account health, ODR, reserve holds, Buy Box pressure, return rates, suppression history, chargebacks, margins, and AM advisory tasks | Account-manager recommendations to 3P ecommerce sellers |
| `sproutmath-authoring-v1` | Generated question text, answer choices, answer key, hint, explanation, spoken form, grade-band fit, accessibility wording, and child-safety boundaries | SproutMath K-5 content authoring gate |
| `sproutroute-v2` | Family profile, ages, accessibility needs, weather, regulatory context, dietary constraints, activity preferences, itinerary feasibility, and safety advice | SproutRoute itinerary generation and safety tips |

Each prompt contains `context_blocks`. The runner injects those blocks into every candidate model call so each model answers from the same evidence packet.

### Who is the judge?

The default judge is configured in [`config/models.json`](config/models.json):

```json
"judge": {
  "id": "anthropic/claude-sonnet-4.6",
  "name": "Claude Sonnet 4.6"
}
```

All candidate models and the judge route through OpenRouter using `OPENROUTER_API_KEY`. The judge prompt is generated in [`eval/judge.js`](eval/judge.js), and the scoring weights/hard floors live in [`config/judge-rubric.json`](config/judge-rubric.json).

### How should scores be trusted?

The scores are useful because the run is repeatable and inspectable:

- Same dataset, model list, judge model, judge prompt, and rubric are applied to every candidate.
- Each result artifact includes per-prompt model responses, per-dimension scores, judge reasoning, token counts, latency, cost, and policy-violation flags.
- Hard floors are checked separately from average quality so a high aggregate score cannot hide a safety or answer-validity failure.
- `npm run eval:dry` estimates cost before spending; `npm run gate -- output/eval-results.json` applies the launch policy to the run artifact.

The scores are not a substitute for production certification. LLM-as-judge is directional evidence. Before a real launch, add human-reviewed calibration examples, deterministic validators for facts/schema/math answer keys, and production telemetry such as accepted, edited, rejected, retried, or escalated outputs.

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

Then open the dashboard (`npm run dev`) and use **Evidence Chain**, **Candidate Board**, and **Rubric + Failure Modes**. The SproutRoute scenario ranks models on quality, cost, latency, and per-dimension scores including **safety** and **logistical_feasibility**. Any model with safety <8.0 gets flagged as NO-GO automatically.

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
| `datasets/sproutmath-authoring-v1.json` | 10 | 5 | easy/medium/hard mix | K-5 question, hint, answer-key, accessibility, child-safety authoring gate |
| `datasets/sproutroute-v2.json` | 25 | 7 | easy/medium/hard mix | Itinerary, packing, safety, weather, diet, theme park, international |

All v2/v3 datasets use structured `context_blocks` for prompt injection. SproutRoute v2 references `family_profile_id` → `datasets/sproutroute-profiles.json`. Seller v3 references `seller_profile_id` → `datasets/seller-profiles-v3.json` and `asin-catalog-v3.json` (though context_blocks carry the needed snapshots inline, so profile lookup is mostly redundant).

**v3 positioning:** Hard-eval datasets derived from the `dataset-brainstorm-v3/` seed banks. Skewed toward high-severity, policy-dense cases where the cheap/fast models are likely to fail. Use v2 for broad coverage; use v3 to stress-test candidates.

---

## NPM Scripts

```bash
npm run eval:sproutroute           # 4 cheap models, 14 prompts, ~$0.30
npm run eval:sproutroute:full      # 7 models, 25 prompts, ~$1.85
npm run eval:sproutmath            # K-5 authoring gate, 3 models, 10 prompts
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

SproutMath authoring datasets use:
- **Answer validity** — one correct answer, aligned choices, answer key, hint, and explanation
- **Grade fit** — requested grade band, vocabulary, and cognitive load
- **Hint quality** — scaffolds without revealing the answer
- **Accessibility language** — readable aloud and screen-reader friendly
- **Child safety** — age-appropriate, emotionally safe, and privacy-preserving

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

Seven launch-review views in the public demo:

1. **Decision Memo** — the PM-readable recommendation, hard floor, and operating tradeoff
2. **Evidence Chain** — what data was checked, who judged it, why scores are usable, and what remains unproven
3. **Candidate Board** — each model's role, quality, trust, latency, cost, and ship fit
4. **Rubric + Failure Modes** — dimension scores, floors, and launch-blocking failure modes
5. **Operating Envelope** — cost/latency tradeoffs and PM interpretation questions
6. **Rollout Plan** — owners, actions, and exit criteria
7. **Run Locally** — GitHub clone, `.env`, eval command, gate command, and artifact files

The older chart-oriented views still exist in `src/views/` for compatibility with the original `EvalResults` explorer, but the public `/evals/` experience now leads with the launch-review narrative.

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
│   ├── sproutmath-authoring-v1.json
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
