# PRD: AI Evals Control Tower
**Author:** Nitish Prasad · **Version:** 2.1 · **Date:** February 2026 · **Status:** Approved for Development

> v2.1 note: Incorporates ideas from a parallel Codex-authored PRD — specifically the three-tier release verdict, safety hard floor, Release Report artifact, smoke/full suite tiering, failure analysis, and risks section.

---

## Problem Statement

AI teams routinely ship model updates without a structured way to compare performance across quality, speed, and cost dimensions simultaneously. The result is either risk-averse teams that never upgrade models, or reckless teams that discover degradation only after users complain. Neither is acceptable at production scale.

This problem is lived experience: on Amplify, the hardest ongoing challenge after launch was not building the model — it was knowing with confidence when a model update was safe to ship, and whether the cost of a better model was justified by its quality gain. No off-the-shelf tool answered this in a PM-legible way.

The AI Evals Control Tower is a purpose-built framework that makes model comparison decisions visible, repeatable, and defensible — framed for product and business stakeholders, not data scientists. It is not a one-off dashboard for a single comparison. It is a reusable evaluation framework with a standard data schema, configurable models and rubrics, and a viewer that works for any conforming dataset.

---

## Goals

**Primary goal:** Demonstrate, through a working live product, that I can design and build the observability and governance layer for an AI system — not just the AI feature itself.

**Secondary goal:** Produce a genuinely reusable evaluation framework — runner, schema, and viewer — that could be applied to any LLM product decision, not just the specific comparison used to seed the demo.

**Non-goal:** Build a general-purpose SaaS evaluation platform. This is a focused, portfolio-grade tool. The architecture must be reusable; the scale does not need to be enterprise.

---

## The Reusability Principle

The tool must not look like it was built to show a pre-determined result. A genuinely reusable tool has clear separation between four layers:

- **Runner** — the eval script that accepts any two models and any prompt dataset as CLI arguments
- **Data** — prompt sets as versioned, loadable JSON files conforming to a documented schema
- **Config** — model names, API endpoints, token pricing, and judge rubrics in config files, never hardcoded
- **Viewer** — the dashboard reads any conforming `eval-results.json`; it has no embedded knowledge of specific models

**Live proof of reusability:** The dashboard includes a drag-and-drop file upload. Any conforming `eval-results.json` can be loaded and the dashboard rerenders in real time — a live, in-interview demonstration that this is a framework, not a demo.

**Two datasets ship with the project** — meaningfully different domains, not more of the same:
1. `seller-intelligence-v1.json` — 50 prompts, AM-facing, proactive, strategic
2. `seller-support-v1.json` — 50 prompts, seller-facing, reactive, resolution-oriented

The README includes a complete worked example of swapping in a new dataset end-to-end, from prompt file to rendered dashboard.

---

## Models for Initial Evaluation

| Model | Role | Provider | Approx. cost / 1M tokens |
|---|---|---|---|
| Claude Sonnet 4.5 | Quality benchmark — closed, commercial | Anthropic | ~$3.00 |
| DeepSeek-V3 | Cost-competitive open-source challenger | DeepSeek | ~$0.27 |

**Why this pairing:** The ~10× cost gap makes the cost chart immediately striking. Quality differences are real but nuanced — DeepSeek matches Claude on structured, formulaic tasks (Seller Support) and falls behind on complex synthesis (Seller Intelligence). The result is non-obvious: not a clean winner. That is more credible and more interesting in an interview than a landslide.

**The product decision this enables:** *"DeepSeek is viable for tier-1 support deflection but not for strategic AM workflows. At 10,000 inferences/day, migrating support to DeepSeek saves $X/month while keeping AM prep on Claude maintains the quality floor."*

---

## Dataset Design

### Shared structure across both datasets

- **50 prompts per dataset**
- **5 categories × 10 prompts each**
- **Difficulty tiers per category: 3 easy / 4 medium / 3 hard**
- **10 mock seller profiles** provide the context data embedded in each prompt (see Seller Profiles section)

Difficulty tiers create natural, believable variance: both models score similarly on easy prompts and diverge on hard ones. This is a real, credible pattern — not noise.

---

### Dataset 1: Seller Intelligence (50 prompts)

**User:** Account Manager or internal analyst
**Input:** Structured seller performance data from mock profiles
**Task:** Insight generation, preparation, strategic recommendation
**Stakes:** High — these outputs inform real AM conversations and business decisions
**Connection to portfolio:** Directly mirrors the Amplify use case

| Category | Easy | Medium | Hard |
|---|---|---|---|
| **Performance summary** | Summarise Q4 GMV for one seller | Compare two sellers across 5 metrics | Identify anomaly in 12-month trend with conflicting signals |
| **Root cause analysis** | Why did sessions drop 10%? | Buy Box loss with 3 plausible causes | Fee impact analysis across a product mix change |
| **AM call prep** | Generate 3 talking points | Prepare for a difficult conversation about returns | Coach an AM on a seller threatening to leave |
| **Risk identification** | Flag a seller with 0 reviews | Identify 2 sellers at churn risk from data | Score a portfolio of 8 sellers by risk level |
| **Recommendation engine** | Suggest one improvement action | Top 3 actions with priorities | Full 90-day roadmap for an underperforming seller |

**Dimension weights (Seller Intelligence):**

| Dimension | Weight | Rationale |
|---|---|---|
| Accuracy | 25% | High-stakes decisions — wrong facts cause real harm |
| Actionability | 25% | AM needs something to do, not just insight |
| Relevance | 20% | Must address the specific seller situation |
| Coherence | 20% | AM is reading fast — must follow instantly |
| Conciseness | 10% | Depth valued over brevity in this context |

---

### Dataset 2: Seller Support (50 prompts)

**User:** Seller or support agent
**Input:** Seller complaint, policy question, or account issue
**Task:** Clear explanation, resolution guidance, empathetic communication
**Stakes:** Medium — customer-facing; tone and clarity matter as much as correctness
**Strategic purpose:** Proves the tool works across domains; will show DeepSeek performing comparatively better here

| Category | Easy | Medium | Hard |
|---|---|---|---|
| **Policy explanation** | What is Amazon's return policy for electronics? | Explain why a listing was suppressed | Walk through the full appeal process for a suspended account |
| **Issue resolution** | How do I fix a missing order? | Seller fee dispute with partial data | Resolve a Buy Box loss caused by policy and pricing combined |
| **Communication drafting** | Write a response to a 1-star review | Draft an apology email for a late shipment | Craft an escalation letter to Amazon Seller Performance |
| **Account health** | What does my Account Health score mean? | Identify why my ODR is at 1.2% | Full diagnostic of an account at risk of deactivation |
| **Shipping & fulfilment** | How do I create a removal order? | Investigate a stranded inventory issue | Design a fulfilment strategy for peak season with FBA limits |

**Dimension weights (Seller Support):**

| Dimension | Weight | Rationale |
|---|---|---|
| Coherence | 25% | Seller-facing — must be instantly followable |
| Conciseness | 25% | Sellers want resolution, not essays |
| Relevance | 20% | Must address the specific issue raised |
| Accuracy | 20% | Policy accuracy matters, but tone carries more weight here |
| Actionability | 10% | Resolution is often implicit in a good explanation |

---

### Mock Seller Profiles

10 profiles are defined once in `datasets/seller-profiles.json` and embedded as context data in prompts. Profiles span the full health spectrum — healthy, growing, stalling, at-risk, and distressed — ensuring models must handle a range of situations.

**Example profiles:**

```
Seller A: Outdoor Gear Co
GMV (Q4): $1.84M (+12% YoY) | Sessions: 284,000 (-8% QoQ)
Buy Box %: 61% (was 82% in Q3) | Reviews: 4.2★ (847, 23 negative last 60d)
Return rate: 7.2% (cat avg: 4.1%) | 3 ASINs suppressed for policy violation
Fulfilment: FBA 92% / FBM 8%
Status: AT-RISK

Seller B: Home Essentials Plus
GMV (Q4): $412K (+34% YoY) | Sessions: 98,000 (+21% QoQ)
Buy Box %: 94% | Reviews: 4.7★ (312, 2 negative last 60d)
Return rate: 2.1% (cat avg: 3.8%) | 0 policy violations
Fulfilment: FBA 100%
Status: HEALTHY / HIGH GROWTH

Seller C: Tech Accessories World
GMV (Q4): $2.1M (-18% YoY) | Sessions: 510,000 (-22% QoQ)
Buy Box %: 43% | Reviews: 3.6★ (2,841, 187 negative last 60d)
Return rate: 12.4% (cat avg: 5.2%) | 7 ASINs suppressed, 1 ASIN with A-to-Z claims
Fulfilment: FBA 61% / FBM 39%
Status: DISTRESSED
```

*(10 profiles total — 2 healthy, 2 high-growth, 2 stalling, 2 at-risk, 2 distressed)*

---

## Judge Rubric

**Judge model:** Claude Sonnet 4.5
*(Using the stronger commercial model as judge is standard practice — OpenAI, Anthropic, and Google all use this pattern. Noted explicitly in the methodology panel.)*

**5 dimensions, scored 1–10:**

| Dimension | Definition | 1 = | 10 = |
|---|---|---|---|
| **Relevance** | Does the response directly address what was asked, without going off-topic? | Completely off-topic | Precisely on-target |
| **Accuracy** | Are facts, figures, and reasoning grounded in the provided data? No hallucinations. | Fabricated / contradicts data | Fully grounded, verifiable |
| **Actionability** | Does the response give a clear next step — not just insight, but something executable? | No direction given | Specific, immediately executable |
| **Coherence** | Is the response logically structured and easy to follow for a non-expert? | Disorganised, hard to parse | Flows clearly, instantly readable |
| **Conciseness** | Does it say what needs saying, without padding or excessive brevity? | Bloated or too thin | Right-sized for the task |

Rubric, weights, and scale are stored in `config/judge-rubric.json`. Weights are loaded per dataset — Seller Intelligence and Seller Support use different weights as documented above.

### Safety Hard Floor

For the Seller Support dataset, **policy accuracy acts as a safety hard floor**: any response that contains factually incorrect policy guidance (e.g., wrong return window, incorrect fee structure) is flagged with a `policy_violation: true` field in the judge output. In the Release Readiness view, any run containing policy violations automatically generates a **NO-GO** recommendation regardless of other scores.

This mirrors real production AI governance: some failure modes are not negotiable, and no aggregate score improvement overrides them.

### Judge Calibration Methodology

Before the final data bake, a calibration pass is run on a 20-prompt subset (10 from each dataset):
1. Generate judge scores using the LLM-as-judge.
2. Manually score the same 20 prompts by human review.
3. Compare agreement per dimension — target ≥0.75 correlation.
4. If any dimension is below threshold, adjust the rubric prompt wording and re-run.

This calibration process is documented in the Methodology panel and in the README. It is the difference between an eval tool that looks scientific and one that actually is.

---

## Drift Event Design

Two events in the 30-day synthetic history. Different types of drift — not two identical incidents.

**Event 1 — Input distribution shift (Days 10–18, recovery Day 22)**
- **Cause:** Prompt mix gradually shifts toward harder categories over 8 days. Accuracy degrades slowly across both models.
- **Detection:** Day 18 — quality score crosses the configured alert threshold.
- **Resolution:** Day 22 — prompt category rebalancing. Scores recover to baseline.
- **Visual:** Slow downward slope, sharp recovery line. Event strip below chart: *"Distribution shift — prompt difficulty skew detected. Resolved via rebalancing."*

**Event 2 — Model behaviour shift (Days 26–28, unresolved)**
- **Cause:** Sharp, sudden quality drop on root-cause-analysis category specifically. Not distribution-related — a prompt pattern that DeepSeek handles differently emerged in the rotation.
- **Detection:** Day 28 — caught in 2 days vs 8 days for Event 1. Faster detection because alert thresholds were recalibrated after Event 1.
- **Resolution:** Ongoing — chart ends with this event unresolved.
- **Visual:** Sharp cliff on chart. Event strip: *"Model behaviour shift — root cause analysis category. Status: Under investigation."*

**The narrative this creates:** *"We caught the first drift and recovered. A second, different type of drift emerged. We detected it in 2 days instead of 8 — because our thresholds were better calibrated from the first incident. It's still open, which is what real production AI systems look like."*

---

## Drift Visualisation: Event Timeline Row

Drift events are displayed as a dedicated event timeline strip directly below the chart — not as inline markers on the line. Rationale: in a live demo or interview, pointing at a distinct visual strip is clearer than explaining a marker on a trend line. The strip shows event type, date range, and current status (Resolved / Under Investigation) as colour-coded chips.

---

## Core Use Cases

| # | User action | What they see |
|---|---|---|
| UC-1 | Opens dashboard | Overview: both models side-by-side across all key metrics, 30-day default, Seller Intelligence loaded |
| UC-2 | Switches dataset | Charts reload with Seller Support data; weighted scores and verdict update accordingly |
| UC-3 | Changes date range | All charts update (7d / 14d / 30d) |
| UC-4 | Opens Accuracy view | Time-series with two drift events in the event timeline strip; performance-by-difficulty breakdown; top failure categories |
| UC-5 | Opens Latency view | P50 / P95 / P99 bars per model; DeepSeek long-tail latency annotated with recommendation |
| UC-6 | Opens Cost view | Per-inference cost chart; cumulative calculator; break-even analysis |
| UC-7 | Opens A/B Comparison | Radar chart; weighted scoring by loaded dataset; structured verdict |
| UC-8 | Opens Release Readiness | Sliders default to borderline-Go; drag any slider to flip verdict; three-tier verdict (GO / CONDITIONAL GO / NO-GO) |
| UC-9 | Drags own results file | Dashboard validates schema, rerenders with new data, labelled "Custom eval loaded" |
| UC-10 | Downloads Release Report | Exports Markdown + JSON summary of current view — scores, verdict, and run metadata |

---

## Product Requirements

### P0 — Must ship

**Dashboard shell**
- React + TypeScript, Vite build, no auth, < 1 second to first meaningful render
- Dataset selector (Seller Intelligence / Seller Support / Custom), model labels from results JSON, date range picker (7d / 14d / 30d)
- Six views: Overview · Accuracy · Latency · Cost · A/B Comparison · Release Readiness
- Drag-and-drop file upload: validates schema, rerenders, labels as "Custom eval loaded"

**Overview tab**
- Four KPI cards: avg accuracy score, P95 latency, cost per inference, drift status
- Each card: current value, delta vs prior period, winner indicator (green / amber / neutral)
- **Top failure categories callout:** the 2 categories with the largest gap between models, shown beneath KPI row
- Summary verdict: one-sentence recommendation beneath the KPI row

**Accuracy tab**
- Line chart: daily weighted quality score (0–100) for both models
- Performance-by-difficulty strip: easy / medium / hard grouped bar for each model
- Rolling 7-day average overlay
- Event timeline row below chart: two drift events with type, date range, status chips
- **Failure analysis panel:** ranked list of top 3 failure drivers by category and difficulty tier

**Latency tab**
- Grouped bar chart: P50, P95, P99 per model
- Annotation callout: DeepSeek long-tail risk quantified with recommendation

**Cost tab**
- Area chart: cost per inference over selected date range
- Cumulative cost calculator: slider for inferences/day → projected monthly saving
- Break-even callout: quality delta required to justify cost premium

**A/B Comparison view**
- Radar chart: Relevance, Accuracy, Actionability, Coherence, Conciseness — weighted per loaded dataset
- Head-to-head metric table with delta column
- Structured verdict: *"[Model] wins on [dimensions]. [Model] preferred for [use case]."*

**Release Readiness view**
- Per-metric sliders: Accuracy threshold, P95 latency ceiling, cost per inference ceiling, drift status
- Sliders default to borderline-Go — small adjustment flips verdict
- **Three-tier verdict card** updates in real time as sliders move:
  - **GO** — all hard floors pass and weighted score meets or exceeds baseline
  - **CONDITIONAL GO** — quality improves but latency or cost regress within soft limits (flagged with conditions to monitor)
  - **NO-GO** — any hard floor violated, or aggregate weighted score drops >5% vs baseline
- **Safety hard floor indicator:** if policy violations present in loaded dataset, NO-GO is shown regardless of slider positions — with explanation
- Checklist: passed criteria (green), failed criteria (red), delta required to flip each failure

**File upload**
- Drag-and-drop or file picker
- Schema validation with clear error message on rejection
- Dashboard rerenders fully on valid upload
- Label: "Custom eval loaded — [filename]" persists until page reload

### P1 — Ship if time allows
- **Release Report download:** Export current dashboard state as a Markdown summary + raw JSON — includes scores, three-tier verdict, run metadata, and failure drivers. Designed as a shareable artifact for stakeholder sign-off (mirrors the exportable release report pattern used in real AI governance workflows).
- Prompt-level drill-down: click any data point to see the prompt, both model responses, per-dimension scores from judge
- Methodology panel: explains judge model, rubric, weighting rationale, calibration process, statistical approach

### P1 — Ship if time allows
- **CI gate (GitHub Actions):** Run smoke suite eval on every PR to the main branch. Fail the PR check if the gate returns NO-GO. Uses the existing CLI — no new infrastructure required. See CI Gate section below.
- **Release Report download:** Export current dashboard state as a Markdown summary + raw JSON — includes scores, three-tier verdict, run metadata, and failure drivers. Designed as a shareable artifact for stakeholder sign-off (mirrors the exportable release report pattern used in real AI governance workflows).
- Prompt-level drill-down: click any data point to see the prompt, both model responses, per-dimension scores from judge
- Methodology panel: explains judge model, rubric, weighting rationale, calibration process, statistical approach

### P2 — Out of scope
- Real-time API calls from the dashboard (data always pre-baked)
- User accounts or saved comparison state
- Mobile layout optimisation

---

## Eval Runner Design

```bash
# Full suite — all 50 prompts per dataset
node eval/eval-runner.js --model-a claude-sonnet-4-5 --model-b deepseek-chat \
  --dataset datasets/seller-intelligence-v1.json --output output/eval-results.json

# Smoke suite — first 10 prompts (fast iteration, ~5 min)
node eval/eval-runner.js --model-a claude-sonnet-4-5 --model-b deepseek-chat \
  --dataset datasets/seller-intelligence-v1.json --suite smoke --output output/eval-results-smoke.json

# Custom dataset
node eval/eval-runner.js --model-a claude-sonnet-4-5 --model-b deepseek-chat \
  --dataset datasets/my-custom-dataset.json --output output/custom-results.json
```

**CLI flags:**

| Flag | Default | Description |
|---|---|---|
| `--model-a` | required | Model A identifier (matched to `config/models.json`) |
| `--model-b` | required | Model B identifier |
| `--dataset` | required | Path to prompt dataset JSON |
| `--suite` | `full` | `smoke` (10 prompts) or `full` (all prompts) |
| `--output` | `output/eval-results.json` | Output path |
| `--judge` | `claude-sonnet-4-5` | Judge model identifier |

The smoke suite enables fast iteration during rubric calibration without spending the full API budget on every test run.

---

## CI Gate (v1.1a)

The CI gate runs a smoke eval on every PR and blocks merge if the gate returns NO-GO. It uses the existing `eval-runner.js` CLI — no new infrastructure, no server, no cost beyond the API calls for the smoke run.

### How it works

```
PR opened/updated
      ↓
GitHub Actions: run smoke suite (10 prompts, ~5 min)
      ↓
check-gate.js parses results
      ↓
GO or CONDITIONAL GO → PR check passes (green)
NO-GO               → PR check fails (red), merge blocked
```

### Workflow file

```yaml
# .github/workflows/eval-gate.yml
name: Eval Gate

on:
  pull_request:
    branches: [main]

jobs:
  eval-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run smoke eval
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
        run: |
          node eval/eval-runner.js \
            --model-a claude-sonnet-4-5 \
            --model-b deepseek-chat \
            --dataset datasets/seller-intelligence-v1.json \
            --suite smoke \
            --output output/ci-results.json

      - name: Check gate verdict
        run: node eval/check-gate.js output/ci-results.json

      - name: Upload results artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-results-${{ github.sha }}
          path: output/ci-results.json
```

### check-gate.js

`eval/check-gate.js` reads the results file, applies the gate policy, and exits with code 0 (pass) or 1 (fail). It prints a human-readable summary that appears in the GitHub Actions log.

**Gate policy applied by check-gate.js:**
- `NO-GO` if any `policy_violation: true` in results → exit 1
- `NO-GO` if aggregate weighted quality score drops >5% vs baked baseline → exit 1
- `CONDITIONAL GO` if quality is neutral/improved but latency or cost regress within soft bounds → exit 0, with warning annotation
- `GO` if all conditions pass → exit 0

**Example CI log output:**

```
=== AI Evals Gate ===
Dataset: seller-intelligence-v1 (smoke, 10 prompts)
Model A: Claude Sonnet 4.5  →  avg quality: 83.4
Model B: DeepSeek-V3        →  avg quality: 78.1
Baseline quality: 82.9

Policy violations: 0
Quality delta vs baseline: +0.5% (Model A), -5.8% (Model B)

Model B quality delta exceeds -5% threshold.
Verdict: CONDITIONAL GO — Model A passes. Model B flagged.
PR check: PASS (with annotation)
```

### Cost per CI run

Each smoke run (10 prompts × 2 models + judge scoring) costs approximately **$0.15–0.20** per PR. At 5 PRs/week, that's ~$3–4/month in API costs — well within budget.

### What this demonstrates

The CI gate is the portfolio piece that makes this feel like a real production governance tool:

- *"Every PR that touches model config, prompts, or retrieval runs an automated eval before merge."*
- *"Here's a PR where Model B's quality dropped 6% — the gate flagged it before it reached main."*
- The GitHub Actions check status is visible directly in the PR — reviewers see a green or red eval gate alongside tests.

---

## Data Architecture & File Structure

```
ai-evals-control-tower/
├── config/
│   ├── models.json                   # names, providers, endpoints, token pricing
│   ├── judge-rubric.json             # 5 dimensions, weights per dataset, 1-10 scale
│   └── settings.json                 # release readiness default thresholds, hard floor config
│
├── datasets/
│   ├── seller-intelligence-v1.json   # 50 prompts, AM-facing
│   ├── seller-support-v1.json        # 50 prompts, seller-facing
│   └── seller-profiles.json          # 10 mock seller data profiles
│
├── eval/
│   ├── eval-runner.js                # CLI: --model-a --model-b --dataset --suite --output
│   ├── judge.js                      # LLM-as-judge, returns per-dimension scores + policy_violation flag
│   ├── check-gate.js                 # CI gate: reads results JSON, exits 0 (pass) or 1 (fail)
│   └── generate-history.js          # extends real run to 30-day time series with drift events
│
├── output/
│   ├── eval-results.json             # default baked-in results the dashboard reads
│   └── ci-results.json               # written by CI gate run (gitignored)
│
├── .github/
│   └── workflows/
│       └── eval-gate.yml             # GitHub Actions: runs smoke eval on every PR to main
│
├── src/                              # React dashboard
│   ├── components/
│   ├── views/
│   ├── data/
│   └── schema/                       # TypeScript types matching results schema (documented)
│
└── README.md                         # schema docs, CLI usage, worked example: new dataset → dashboard
```

**The results schema is model-agnostic.** The dashboard reads `model_a` and `model_b` with properties `name`, `provider`, `version` — not Claude or DeepSeek specifically. Any two models producing conforming results will render correctly.

---

## Results Schema (abridged)

```json
{
  "meta": {
    "generated_at": "2026-02-20T00:00:00Z",
    "dataset": "seller-intelligence-v1",
    "dataset_version": "1.0",
    "suite": "full",
    "judge_model": "claude-sonnet-4-5",
    "runner_version": "1.0.0",
    "date_range": { "start": "2026-01-21", "end": "2026-02-20" }
  },
  "model_a": { "name": "Claude Sonnet 4.5", "provider": "Anthropic", "version": "claude-sonnet-4-5" },
  "model_b": { "name": "DeepSeek-V3", "provider": "DeepSeek", "version": "deepseek-chat" },
  "daily": [
    {
      "date": "2026-01-21",
      "model_a": {
        "accuracy": 84.2,
        "latency_p50": 1120, "latency_p95": 2340, "latency_p99": 3810,
        "cost_per_inference": 0.0031,
        "scores": { "relevance": 8.4, "accuracy": 8.6, "actionability": 7.9, "coherence": 8.8, "conciseness": 7.2 }
      },
      "model_b": { ... }
    }
  ],
  "events": [
    { "type": "distribution_shift", "start": "2026-01-31", "end": "2026-02-07", "resolved": true, "resolved_at": "2026-02-11", "description": "..." },
    { "type": "behaviour_shift", "start": "2026-02-15", "end": null, "resolved": false, "description": "..." }
  ],
  "prompts": [
    {
      "id": "si-001", "category": "performance-summary", "difficulty": "easy",
      "model_a_response": "...", "model_b_response": "...",
      "model_a_scores": { "relevance": 9, "accuracy": 9, "actionability": 8, "coherence": 9, "conciseness": 7 },
      "model_b_scores": { ... },
      "model_a_latency_ms": 1084, "model_b_latency_ms": 2310,
      "model_a_cost": 0.0029, "model_b_cost": 0.00024,
      "policy_violation": false
    }
  ]
}
```

The `meta` block serves as an **immutable audit trail** — it captures the exact config used for a run, enabling any result file to be fully reproduced or compared against a different run. Dataset version, suite type, judge model, and runner version are all recorded.

---

## API Cost Budget

| Item | Estimated cost |
|---|---|
| Development / iteration runs — smoke suite (~10 runs × 10 prompts) | ~$3.00 |
| Rubric calibration — 20-prompt human comparison subset | ~$2.00 |
| Full eval run (100 prompts × 2 models + judge) | ~$1.58 |
| Buffer | ~$8.00 |
| **Total estimated** | **~$15 of $30–50 budget** |

Using the smoke suite for iteration (10 prompts instead of 50) cuts iteration cost by ~80% and reduces the budget needed before the final bake.

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **LLM judge scores are not calibrated** — judge produces inflated or biased scores that don't reflect real quality | Medium | Run 20-prompt human calibration subset before final bake; target ≥0.75 agreement; adjust rubric prompts if below threshold |
| **DeepSeek API is slow or unreliable** — long-tail latency makes eval runs unpredictable | Medium | Run smoke suite first to validate; add retry logic with exponential backoff; budget extra time for final bake |
| **Dataset prompts are too easy** — both models score ≥90 on everything, making comparison uninteresting | Medium | Include hard difficulty tier (3 per category) specifically designed to expose model weaknesses; validate during calibration |
| **Policy violation false positives** — judge incorrectly flags valid responses as policy violations | Low | Manual review of all flagged cases in final output; policy violation field is inspectable in schema |
| **Cost overrun on iteration** — spending budget on full-suite runs during development | Low | Enforce smoke suite (`--suite smoke`) for all development runs; only run full suite for final bake and calibration |

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Type safety for schema validation; industry standard |
| Charts | Recharts | Lightweight, composable, good axis control |
| Build | Vite | Fast, consistent with StrollerScout |
| Data | Static JSON + file upload | No backend; always live; reusability proved in real time |
| Deploy | Cloudflare Pages | Free, instant, no server to maintain |
| Eval script | Node.js CLI | Runs once locally; not deployed |

---

## Build Phases

| Phase | Deliverable | Input required |
|---|---|---|
| **1. Prompt datasets** | `seller-intelligence-v1.json`, `seller-support-v1.json`, `seller-profiles.json` | None |
| **2. Eval script** | `eval-runner.js`, `judge.js` with CLI flags including `--suite` | Anthropic + DeepSeek API keys |
| **3. Calibration** | 20-prompt human review, rubric adjusted to ≥0.75 agreement | Phase 2 output |
| **4. Data bake** | `eval-results.json` (final, checked in) | Phase 3 output |
| **5. History generation** | 30-day time series with 2 drift events | Phase 4 output |
| **6. Dashboard** | All 6 views wired to data, three-tier verdict, failure analysis, file upload | Phase 5 output |
| **7. CI gate** | `check-gate.js` + `eval-gate.yml`; smoke run passes on main branch; test a deliberate regression to prove the block | Phase 6 output |
| **8. Deploy + portfolio** | Cloudflare Pages live, portfolio card updated to ✅ Live | Phase 7 output |

---

## Success Metrics

| Metric | Target |
|---|---|
| Time to first meaningful render | < 1 second |
| Live URL uptime | 100% (static, no server) |
| Reusability demo | File upload rerenders cleanly with any valid results file |
| Interview narration | Full dashboard walkthrough in < 90 seconds |
| GitHub repo | Public, documented schema, CLI with flags, worked example in README |
| Portfolio card | Updated to ✅ Live with demo link |
| Judge calibration | ≥0.75 human agreement on 20-prompt calibration set |
| CI gate | Green check visible on passing PRs; deliberate regression commit produces a red block |
| Interview story | *"Here is how I think about AI governance — and here is the tool I built to operationalise it"* |
