# AI Evals Control Tower

A release-readiness system for AI products. Evaluates baseline vs candidate model behavior across quality, safety, latency, and cost — then outputs a clear **GO**, **CONDITIONAL GO**, or **NO-GO** decision.

**Live dashboard:** [nitishprasad.com/evals](https://www.nitishprasad.com/evals/)
**Project page:** [nitishprasad.com/ai-eval-control-tower](https://www.nitishprasad.com/ai-eval-control-tower.html)

---

## What It Does

| Capability | Detail |
|---|---|
| Eval runner | Runs model A vs model B on any dataset via CLI |
| LLM-as-judge | Scores responses on 5 dimensions (1–10) + `policy_violation` flag |
| Release gate | GO / CONDITIONAL GO / NO-GO with reason codes |
| Drift timeline | Distribution-shift and behaviour-shift events over 30 days |
| CI gate (v1.1a) | GitHub Actions smoke eval blocks PRs on regression |
| Dashboard | React + Recharts — Overview, Accuracy, Latency, Cost, A/B, Release Readiness |

---

## Quick Start

```bash
# Install
npm install

# Copy and populate API keys
cp .env.example .env

# Run smoke suite (24 prompts, ~5 min)
npm run eval -- --suite smoke

# Check release gate verdict
npm run gate

# Start dashboard dev server
npm run dev
```

---

## Eval Runner CLI

```bash
node eval/eval-runner.js \
  --model-a claude-sonnet-4-6 \
  --model-b deepseek-chat \
  --dataset datasets/seller-intelligence-v2.json \
  --suite smoke \
  --output output/eval-results.json
```

| Flag | Default | Description |
|---|---|---|
| `--model-a` | from `config/settings.json` | Baseline model ID |
| `--model-b` | from `config/settings.json` | Candidate model ID |
| `--dataset` | from `config/settings.json` | Path to dataset JSON |
| `--suite` | `full` | `smoke` (24 prompts) or `full` (50 prompts) |
| `--output` | `output/eval-results.json` | Output path |

---

## Datasets

| File | Prompts | Categories | Domain |
|---|---|---|---|
| `datasets/seller-intelligence-v2.json` | 50 | 12 | AM call prep, risk triage, pricing strategy |
| `datasets/seller-support-v2.json` | 50 | 12 | Policy guidance, account health, appeals |

Each prompt includes `context_blocks` — structured snapshots of seller data, ASIN performance, financials, and event logs — injected at runtime. Source profiles: `datasets/seller-profiles.json`.

Difficulty split: ~28% easy / 48% medium / 24% hard per dataset.

---

## Rubric and Weights

Five scored dimensions, weights differ by dataset to measure *fit-for-purpose* quality rather than raw model capability.

| Dimension | Seller Intelligence | Seller Support |
|---|---|---|
| Accuracy | 25% | 20% |
| Actionability | 25% | 10% |
| Relevance | 20% | 20% |
| Coherence | 20% | 25% |
| Conciseness | 10% | 25% |

Safety (`policy_violation`) is a gate-only flag — not weighted into the quality score but triggers automatic NO-GO if true. Full rubric: `config/judge-rubric.json`.

---

## Release Gate Policy

Defined in `config/settings.json` and enforced by `eval/check-gate.js`.

**Hard NO-GO** (any one triggers):
- Any `policy_violation: true` in candidate output
- Aggregate weighted quality drops > 5% vs baseline
- Safety aggregate < 8.0/10 on any mandatory workflow
- Mandatory workflow pass rate < 85%

**Conditional GO:** Quality neutral/improved but latency or cost regress within soft bounds. Owner must document mitigation before merge.

**GO:** No hard conditions triggered. Quality at or above baseline.

---

## File Structure

```
ai-evals-control-tower/
├── config/
│   ├── models.json           # Model registry: names, endpoints, token pricing
│   ├── judge-rubric.json     # 5 rubric dimensions, per-dataset weights
│   └── settings.json         # Gate thresholds, hard floors, default model/dataset
│
├── datasets/
│   ├── seller-intelligence-v2.json
│   ├── seller-support-v2.json
│   └── seller-profiles.json  # 12 mock seller profiles with full data snapshots
│
├── eval/
│   ├── eval-runner.js        # CLI runner: orchestrates model calls + judging
│   ├── judge.js              # LLM-as-judge via Claude; scores + policy_violation
│   ├── check-gate.js         # Reads results JSON, exits 0 (pass) or 1 (fail)
│   └── generate-history.js   # Extends a real run to a 30-day time series
│
├── output/
│   └── eval-results.json     # Baked results the dashboard reads by default
│
├── src/                      # React + TypeScript dashboard (Vite)
│   ├── components/
│   ├── views/                # Overview, Accuracy, Latency, Cost, ABComparison, ReleaseReadiness
│   └── data/
│
└── .github/
    └── workflows/
        └── eval-gate.yml     # CI: smoke eval on every PR to main
```

---

## Results Schema

The dashboard reads any `eval-results.json` conforming to this schema — not just the baked-in file. Drag-and-drop upload is supported on the dashboard.

```json
{
  "meta": {
    "generated_at": "ISO-8601 timestamp",
    "dataset": "seller-intelligence-v2",
    "suite": "smoke | full",
    "judge_model": "claude-sonnet-4-6",
    "run_id": "run_YYYYMMDD_XXXX"
  },
  "model_a": { "name": "...", "provider": "...", "version": "..." },
  "model_b": { "name": "...", "provider": "...", "version": "..." },
  "daily": [
    {
      "date": "YYYY-MM-DD",
      "model_a": { "quality_score": 93.0, "latency_p50": 1100, "latency_p95": 2200, "cost_per_inference": 0.003 },
      "model_b": { "quality_score": 81.0, "latency_p50": 600, "latency_p95": 1200, "cost_per_inference": 0.0003 }
    }
  ],
  "events": [],
  "prompts": [
    {
      "id": "si-001",
      "category": "portfolio_risk_triage",
      "difficulty": "easy",
      "model_a_scores": { "relevance": 9, "accuracy": 9, "actionability": 9, "coherence": 9, "conciseness": 8 },
      "model_b_scores": { "relevance": 8, "accuracy": 8, "actionability": 8, "coherence": 8, "conciseness": 9 },
      "policy_violation": false
    }
  ]
}
```

Full schema spec: see Section 14 of `PRD_AI_Eval_Control_Tower_v3.md`.

---

## CI Gate

Every PR to `main` triggers a smoke eval via `.github/workflows/eval-gate.yml`. The gate blocks merge on NO-GO.

Required GitHub Actions secrets: `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`.

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=   # Claude judge + Model A calls
DEEPSEEK_API_KEY=    # Model B (DeepSeek-V3) calls
```

---

## PRD

Full product requirements, architecture decisions, rubric rationale, gate policy, and delivery plan: [`PRD_AI_Eval_Control_Tower_v3.md`](./PRD_AI_Eval_Control_Tower_v3.md)
