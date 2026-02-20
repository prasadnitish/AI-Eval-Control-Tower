# AI Evals Control Tower — Implementation Plan

**Version:** 1.0
**Date:** February 2026
**PRD Reference:** PRD_AI_Eval_Control_Tower_v3_codex.md (v3.1)

---

## Directory: `/Users/nitish/VS Code Projects/tpm-portfolio/AI Eval Control Tower/`

---

## Phase Overview

| Phase | What | Est. effort |
|---|---|---|
| 0 | Scaffold — folder structure, package.json, config files | 30 min |
| 1 | Datasets — 100 prompts, 10 seller profiles | 2–3 hrs |
| 2 | Eval runner — CLI, judge, output schema | 2–3 hrs |
| 3 | Calibration — 20-prompt human review, rubric tune | 1 hr |
| 4 | History generation — 30-day series, 2 drift events | 1 hr |
| 5 | Dashboard — React + TypeScript, 6 views | 4–6 hrs |
| 6 | CI gate — check-gate.js + eval-gate.yml | 1 hr |
| 7 | Deploy + portfolio — Cloudflare Pages, card update | 30 min |

---

## Phase 0: Scaffold

### Tasks
- [ ] Create full directory tree
- [ ] `package.json` at root (workspace or split: eval CLI vs dashboard)
- [ ] `config/models.json` — model IDs, providers, endpoints, token pricing
- [ ] `config/judge-rubric.json` — 5 dimensions, weights per dataset
- [ ] `config/settings.json` — release gate thresholds, hard floor values
- [ ] `.gitignore` — exclude `.env`, `node_modules`, `output/ci-results.json`
- [ ] `.env.example` — ANTHROPIC_API_KEY, DEEPSEEK_API_KEY

### Directory tree target
```
ai-evals-control-tower/
├── config/
│   ├── models.json
│   ├── judge-rubric.json
│   └── settings.json
├── datasets/
│   ├── seller-intelligence-v1.json
│   ├── seller-support-v1.json
│   └── seller-profiles.json
├── eval/
│   ├── eval-runner.js
│   ├── judge.js
│   ├── check-gate.js
│   └── generate-history.js
├── output/
│   └── eval-results.json
├── src/                          (Vite React app)
│   ├── components/
│   ├── views/
│   ├── data/
│   └── schema/
├── .github/
│   └── workflows/
│       └── eval-gate.yml
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Phase 1: Datasets

### Tasks
- [ ] `datasets/seller-profiles.json` — 10 profiles (2 each: healthy, high-growth, stalling, at-risk, distressed)
- [ ] `datasets/seller-intelligence-v1.json` — 50 prompts (5 categories × 10, 3 easy / 4 medium / 3 hard each)
- [ ] `datasets/seller-support-v1.json` — 50 prompts (5 categories × 10, same difficulty split)

### Schema per prompt
```json
{
  "id": "si-001",
  "category": "performance-summary",
  "difficulty": "easy",
  "seller_profile_id": "seller-a",
  "prompt": "..."
}
```

### Validation check
- 50 prompts per file ✓
- 5 categories × 10 each ✓
- Difficulty: 3/4/3 per category ✓
- All seller_profile_ids resolve to an entry in seller-profiles.json ✓

---

## Phase 2: Eval Runner

### Tasks
- [ ] `eval/judge.js` — calls Claude Sonnet 4.5 with rubric, returns 5 dimension scores + policy_violation flag
- [ ] `eval/eval-runner.js` — CLI with flags: --model-a, --model-b, --dataset, --suite, --output, --judge
- [ ] Smoke suite: first 10 prompts of dataset (or first 2 per category for balance)
- [ ] Output: conforms to schema in PRD Section 14
- [ ] Token cost tracking per run logged to stdout

### CLI usage
```bash
node eval/eval-runner.js \
  --model-a claude-sonnet-4-5 \
  --model-b deepseek-chat \
  --dataset datasets/seller-intelligence-v1.json \
  --suite full \
  --output output/eval-results.json
```

---

## Phase 3: Calibration

### Tasks
- [ ] Run smoke suite on both datasets
- [ ] Manually review 20 prompt responses (10 per dataset) and score each dimension
- [ ] Compare human scores vs judge scores — target ≥0.75 correlation per dimension
- [ ] Adjust `judge-rubric.json` prompt wording if any dimension below threshold
- [ ] Re-run and confirm agreement

### Log calibration results in this doc (Section: Calibration Results)

---

## Phase 4: History Generation

### Tasks
- [ ] `eval/generate-history.js` — takes a real eval-results.json and extends to 30-day daily series
- [ ] Event 1: distribution shift, Days 10–18, resolved Day 22 (slow degradation + recovery)
- [ ] Event 2: model behaviour shift, Days 26–28, unresolved (sharp cliff, root-cause-analysis category)
- [ ] Log-normal latency distribution with realistic variance per day
- [ ] Write final `output/eval-results.json`

---

## Phase 5: Dashboard

### Tasks
- [ ] Vite + React + TypeScript scaffold in `src/`
- [ ] TypeScript schema types matching results JSON
- [ ] Dataset selector (Seller Intelligence / Seller Support / Custom)
- [ ] Date range picker (7d / 14d / 30d)
- [ ] View 1: Overview — 4 KPI cards, top failure callout, verdict sentence
- [ ] View 2: Accuracy — line chart, difficulty bars, drift event strip, failure analysis panel
- [ ] View 3: Latency — P50/P95/P99 grouped bars, annotation
- [ ] View 4: Cost — area chart, cumulative calculator slider, break-even callout
- [ ] View 5: A/B Comparison — radar chart, metric table, structured verdict
- [ ] View 6: Release Readiness — sliders, real-time 3-tier verdict, safety floor indicator, checklist
- [ ] File upload — drag-and-drop, schema validation, rerender, "Custom eval loaded" label
- [ ] Release Report download (Markdown + JSON)

### Chart library
Recharts (lightweight, composable, good for time series + radar)

---

## Phase 6: CI Gate

### Tasks
- [ ] `eval/check-gate.js` — reads output JSON, applies gate policy, exits 0 or 1
- [ ] `.github/workflows/eval-gate.yml` — smoke eval on every PR to main
- [ ] Add ANTHROPIC_API_KEY and DEEPSEEK_API_KEY as GitHub Actions secrets
- [ ] Test: open a PR with passing config → confirm green check
- [ ] Test: intentionally degrade quality threshold in settings.json → confirm red block
- [ ] Screenshot red block for portfolio

---

## Phase 7: Deploy + Portfolio

### Tasks
- [ ] `npm run build` produces `dist/` — confirm Cloudflare Pages compatible
- [ ] Deploy to Cloudflare Pages (connect GitHub repo or manual upload)
- [ ] Update `nitishprasad-website/index.html` — add AI Evals Control Tower card, status Live
- [ ] Update `nitishprasad-website/project-ai-eval.html` — full case study page
- [ ] `wrangler deploy` from tpm-portfolio/

---

## Calibration Results
*(Populated during Phase 3)*

| Dimension | Human avg | Judge avg | Correlation | Status |
|---|---|---|---|---|
| Relevance | — | — | — | Pending |
| Accuracy | — | — | — | Pending |
| Actionability | — | — | — | Pending |
| Coherence | — | — | — | Pending |
| Conciseness | — | — | — | Pending |

---

## Lessons Learned
*(Logged as failures or surprises are encountered during build)*

| # | Phase | What happened | Fix applied |
|---|---|---|---|
| 1 | 0/2 | `@anthropic-ai/sdk` not listed in `package.json` — eval runner imports failed on first smoke test | Added `@anthropic-ai/sdk` to dependencies, ran `npm install` |
| 2 | 5 | macOS `sleep` does not accept multi-command chaining with `&&` in a single Bash string — caused false errors when starting dev server for verification | Used a subagent (separate shell) to run background server + curl check |

---

## Build Log
*(Running notes during implementation)*

| Timestamp | Phase | Status | Notes |
|---|---|---|---|
| Feb 2026 | 0 | ✅ Complete | Scaffold, config, .gitignore, .env.example, package.json all created |
| Feb 2026 | 1 | ✅ Complete | 10 seller profiles (all health tiers), 50 SI prompts, 50 SS prompts — counts validated |
| Feb 2026 | 2 | ✅ Complete | eval-runner.js, judge.js, generate-history.js, check-gate.js all written |
| Feb 2026 | 2a | ✅ Complete | .github/workflows/eval-gate.yml written — CI gate ready |
| Feb 2026 | 5 | ✅ Complete | All 6 views built: Overview, AccuracyView, LatencyView, CostView, ABComparison, ReleaseReadiness. Zero TS errors, prod build clean (947ms). |
| Feb 2026 | 3 | ⏳ Pending | Awaiting .env with ANTHROPIC_API_KEY + DEEPSEEK_API_KEY to run calibration smoke suite |
| Feb 2026 | 4 | ⏳ Pending | Run generate-history.js after Phase 3 to replace placeholder with real 30-day data |
| Feb 2026 | 6 | ✅ Complete | check-gate.js + eval-gate.yml written and wired |
| Feb 2026 | 7 | ⏳ Pending | Deploy to Cloudflare Pages, update portfolio card |
| Feb 2026 | 1v2 | ✅ Complete | Dataset upgrade: 12 seller profiles (v2, seller-us-001–012), 24 ASINs (asin-catalog.json), seller-intelligence-v2.json (50 prompts, 12 categories, 14/24/12 easy/med/hard), seller-support-v2.json (50 prompts, 12 categories, 14/23/13). eval-runner.js updated to inject context_blocks, added SYSTEM_PROMPT, backward-compatible with v1. config/settings.json baseline updated to seller-intelligence-v2. |
