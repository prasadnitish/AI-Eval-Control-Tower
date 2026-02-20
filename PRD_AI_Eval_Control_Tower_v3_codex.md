# Product Requirements Document (PRD) v3.1
## AI Evals Control Tower

Document Version: v3.1
Date: February 20, 2026
Owner: Nitish Prasad
Prepared by: Codex + Claude
Changes from v3.0: Dataset detail expanded (category tables, difficulty tiers, seller profiles, weight rationale). Architecture v1.1 updated from FastAPI/Redis/Postgres to v1.1a CI gate via GitHub Actions.

---

## 1. Executive Summary
AI Evals Control Tower is a release-readiness system for AI products. It evaluates baseline versus candidate behavior across quality, safety, latency, and cost, then produces a clear `GO`, `CONDITIONAL GO`, or `NO-GO` decision.

This PRD combines portfolio storytelling with production-grade governance. The product launches as a fast, static, demo-ready control tower (v1), then adds a GitHub Actions CI gate (v1.1a) that blocks PRs when quality regresses — no new infrastructure required.

---

## 2. Why This Product Exists
### 2.1 Core Problem
AI teams can ship model updates quickly but cannot reliably answer: "Is this change safe to release?"

Without a control tower, teams experience:
1. Silent regressions discovered after production release.
2. Subjective launch decisions due to fragmented metrics.
3. Slow iteration because confidence is low.
4. Weak auditability of why a model version was approved.

### 2.2 Product Hypothesis
A reusable evaluation framework with standardized datasets, scoring, regression detection, and release gates will reduce post-release quality incidents while increasing release velocity.

### 2.3 Strategic Outcome
This project demonstrates complete AI product leadership:
- Product framing and quality governance
- Technical implementation and architecture
- Operational decision-making and release discipline

---

## 3. Vision, Goals, and Non-Goals
### 3.1 Vision
Enable every AI model, prompt, or retrieval change to be released with measurable confidence.

### 3.2 North-Star Goal
100% of in-scope releases must include a baseline-vs-candidate gate report before production rollout.

### 3.3 90-Day Goals
1. Deliver v1 control tower with two realistic domains and complete release-readiness workflow.
2. Catch regressions pre-release for quality, safety, latency, and cost.
3. Reduce post-release quality incidents by at least 30%.
4. Publish a clear case study with architecture, metrics, and decision examples.

### 3.4 Non-Goals (v1)
- Multi-tenant SaaS platform features
- Real-time online gating on production traffic
- Automated deployment rollback
- Backend API server or managed database

---

## 4. Product Principles
### 4.1 Reusability Principle
The system must be clearly reusable and not hardcoded to one demo scenario.

The architecture is split into four layers:
1. Runner: executes evals for any two models and any valid dataset.
2. Data: versioned datasets conforming to documented schema.
3. Config: model metadata, pricing, rubric, and gate thresholds externalized.
4. Viewer: dashboard reads any conforming `eval-results.json`.

### 4.2 Decision-First UX Principle
Every screen should move the user toward one decision: release readiness.

### 4.3 Evidence-over-Opinion Principle
All gate outcomes must include reason codes and supporting metric deltas.

---

## 5. Users and Jobs-To-Be-Done
### 5.1 Primary Users
- AI Product Manager
- Applied AI/ML Engineer
- QA / Trust and Safety reviewer

### 5.2 Secondary Users
- Engineering Manager
- Data Scientist
- Leadership stakeholders reviewing release recommendations

### 5.3 Jobs-To-Be-Done
1. Decide if a candidate change is safe to release.
2. Understand exactly why a candidate failed.
3. Balance quality, latency, and cost tradeoffs in one view.
4. Present a defensible release recommendation to stakeholders.

---

## 6. Scope
### 6.1 In Scope (v1)
- Dataset registry with versioned prompt packs
- Weighted rubric scoring
- Baseline-vs-candidate comparisons
- Regression detection and severity tags
- Release gate engine with hard floors and soft bounds
- Drift event timeline and trend analysis
- File upload and schema validation
- Exportable release summary and JSON report

### 6.2 In Scope (v1.1a)
- CI gate via GitHub Actions: smoke eval runs on every PR to main
- `check-gate.js` script enforces gate policy and exits 0 (pass) or 1 (fail)
- PR check status visible in GitHub alongside standard test checks

### 6.3 In Scope (v1.1b — future)
- Judge-human calibration workflow
- Segment-level reporting by workflow and risk tier
- Persistent run history and audit metadata

### 6.4 Out of Scope (v1 and v1.1a)
- Live online policy enforcement
- Enterprise IAM and full RBAC administration
- Automatic remediation actions
- Backend API server, worker queue, or managed database

---

## 7. Finalized Decisions
### 7.1 MVP Workflows (Mandatory)
The first three workflows that must pass gate criteria:
1. Seller Intelligence: AM call preparation
2. Seller Intelligence: root cause analysis
3. Seller Support: issue resolution and policy guidance

### 7.2 Safety Floor for Automatic NO-GO
Automatic `NO-GO` when either condition is true:
1. Safety score < 8.0/10 on any mandatory workflow aggregate.
2. Any critical policy violation count > 0 in candidate output sample.

### 7.3 Required Model Pair for v1
- Baseline: Claude Sonnet 4.5
- Candidate: DeepSeek-V3

v1.1b extension model pair:
- Baseline: Claude Sonnet 4.5
- Candidate: GPT-4.1-mini (or equivalent available low-cost strong model)

### 7.4 Monthly Eval Budget
- Hard budget cap: USD 50/month
- Target operational budget: USD 35/month
- Alert when projected month-to-date spend exceeds USD 40
- CI gate (smoke suite) costs approximately USD 0.15–0.20 per PR run

### 7.5 Ownership Model
- Dataset governance owner: Nitish Prasad
- Weekly judge calibration review: Nitish Prasad (every Friday)
- Monthly threshold review: Nitish Prasad + one peer reviewer

---

## 8. Data and Evaluation Design
### 8.1 Initial Datasets

**Dataset 1: `seller-intelligence-v1.json` (50 prompts)**

User: Account Manager or internal analyst
Input: Structured seller performance data from mock profiles
Task: Insight generation, AM preparation, strategic recommendation
Stakes: High — outputs inform real AM conversations and business decisions

| Category | Easy | Medium | Hard |
|---|---|---|---|
| Performance summary | Summarise Q4 GMV for one seller | Compare two sellers across 5 metrics | Identify anomaly in 12-month trend with conflicting signals |
| Root cause analysis | Why did sessions drop 10%? | Buy Box loss with 3 plausible causes | Fee impact analysis across a product mix change |
| AM call prep | Generate 3 talking points | Prepare for a difficult conversation about returns | Coach an AM on a seller threatening to leave |
| Risk identification | Flag a seller with 0 reviews | Identify 2 sellers at churn risk from data | Score a portfolio of 8 sellers by risk level |
| Recommendation engine | Suggest one improvement action | Top 3 actions with priorities | Full 90-day roadmap for an underperforming seller |

Difficulty distribution per category: 3 easy / 4 medium / 3 hard
Context injected from: `seller-profiles.json` (10 mock seller profiles)

---

**Dataset 2: `seller-support-v1.json` (50 prompts)**

User: Seller or support agent
Input: Seller complaint, policy question, or account issue
Task: Clear explanation, resolution guidance, empathetic communication
Stakes: Medium — customer-facing; tone and clarity matter as much as correctness

| Category | Easy | Medium | Hard |
|---|---|---|---|
| Policy explanation | What is Amazon's return policy for electronics? | Explain why a listing was suppressed | Walk through the full appeal process for a suspended account |
| Issue resolution | How do I fix a missing order? | Seller fee dispute with partial data | Resolve a Buy Box loss caused by policy and pricing combined |
| Communication drafting | Write a response to a 1-star review | Draft an apology email for a late shipment | Craft an escalation letter to Amazon Seller Performance |
| Account health | What does my Account Health score mean? | Identify why my ODR is at 1.2% | Full diagnostic of an account at risk of deactivation |
| Shipping and fulfilment | How do I create a removal order? | Investigate a stranded inventory issue | Design a fulfilment strategy for peak season with FBA limits |

Difficulty distribution per category: 3 easy / 4 medium / 3 hard
Context injected from: `seller-profiles.json`

---

### 8.2 Mock Seller Profiles

10 profiles defined once in `datasets/seller-profiles.json` and embedded as context in prompts. Profiles span the full health spectrum to ensure models handle a range of seller situations — not just ideal cases.

Profile distribution: 2 healthy / 2 high-growth / 2 stalling / 2 at-risk / 2 distressed

**Example profiles:**

```
Seller A: Outdoor Gear Co
GMV (Q4): $1.84M (+12% YoY) | Sessions: 284,000 (-8% QoQ)
Buy Box %: 61% (was 82% in Q3) | Reviews: 4.2★ (847, 23 negative last 60d)
Return rate: 7.2% (cat avg: 4.1%) | 3 ASINs suppressed for policy violation
Fulfilment: FBA 92% / FBM 8% | Status: AT-RISK

Seller B: Home Essentials Plus
GMV (Q4): $412K (+34% YoY) | Sessions: 98,000 (+21% QoQ)
Buy Box %: 94% | Reviews: 4.7★ (312, 2 negative last 60d)
Return rate: 2.1% (cat avg: 3.8%) | 0 policy violations
Fulfilment: FBA 100% | Status: HEALTHY / HIGH GROWTH

Seller C: Tech Accessories World
GMV (Q4): $2.1M (-18% YoY) | Sessions: 510,000 (-22% QoQ)
Buy Box %: 43% | Reviews: 3.6★ (2,841, 187 negative last 60d)
Return rate: 12.4% (cat avg: 5.2%) | 7 ASINs suppressed, 1 ASIN with A-to-Z claims
Fulfilment: FBA 61% / FBM 39% | Status: DISTRESSED
```

---

### 8.3 Rubric Dimensions

Five scored dimensions (1–10 scale), plus a safety gate-only flag:

| Dimension | Definition |
|---|---|
| Relevance | Does the response directly address what was asked, without going off-topic? |
| Accuracy | Are facts, figures, and reasoning grounded in the provided data? No hallucinations. |
| Actionability | Does the response give a clear next step — not just insight, but something executable? |
| Coherence | Is the response logically structured and easy to follow for a non-expert? |
| Conciseness | Does it say what needs saying, without padding or excessive brevity? |
| Safety (gate-only) | Does the response contain factually incorrect policy guidance? Flagged as `policy_violation: true/false` — not weighted into quality score but triggers hard NO-GO if true. |

**Judge model:** Claude Sonnet 4.5. Using the stronger commercial model as judge is standard practice (OpenAI, Anthropic, and Google all use this pattern). Documented in the methodology panel.

---

### 8.4 Dataset-Specific Weights

Weights are loaded per dataset from `config/judge-rubric.json` — not hardcoded.

**Seller Intelligence:**

| Dimension | Weight | Rationale |
|---|---|---|
| Accuracy | 25% | High-stakes decisions — wrong facts cause real harm |
| Actionability | 25% | AM needs something to do, not just insight |
| Relevance | 20% | Must address the specific seller situation |
| Coherence | 20% | AM is reading fast — must follow instantly |
| Conciseness | 10% | Depth valued over brevity in this context |

**Seller Support:**

| Dimension | Weight | Rationale |
|---|---|---|
| Coherence | 25% | Seller-facing — must be instantly followable |
| Conciseness | 25% | Sellers want resolution, not essays |
| Relevance | 20% | Must address the specific issue raised |
| Accuracy | 20% | Policy accuracy matters, but tone carries more weight here |
| Actionability | 10% | Resolution is often implicit in a good explanation |

The differing weights between datasets are intentional and non-trivial: the same model can score very differently across the two use cases, which demonstrates the tool is measuring fit-for-purpose, not just raw model capability.

---

### 8.5 Gate Scorecard (Cross-Cutting)

All release decisions include:
- Weighted quality score (per dataset weights above)
- Safety floor checks (`policy_violation` flag + 8.0/10 safety aggregate)
- Latency thresholds (P50, P95, P99)
- Cost-per-inference threshold

---

### 8.6 Judge Calibration Methodology

Before the final data bake, a calibration pass runs on a 20-prompt subset (10 from each dataset):
1. Generate judge scores via LLM-as-judge.
2. Manually score the same 20 prompts by human review.
3. Compare agreement per dimension — target ≥0.75 correlation.
4. If any dimension falls below threshold, adjust rubric prompt wording and re-run.

Calibration results are documented in the methodology panel. This is the difference between an eval tool that looks scientific and one that actually is. Post-launch, calibration runs weekly (every Friday) per the ownership model in Section 7.5.

---

## 9. Functional Requirements
### FR-001 Dataset Registry
Store and version datasets with metadata: owner, risk tier, freshness date, workflow mapping.

### FR-002 Schema Validation
Validate all dataset and result files against schema before run or view.

### FR-003 Eval Runner
Run model A versus model B on selected dataset through CLI interface. Supports `--suite smoke` (10 prompts, ~5 min) and `--suite full` (all 50 prompts, ~15 min).

### FR-004 Judge Scoring
Generate per-dimension scores (1–10), aggregate weighted quality score, and `policy_violation` flag per prompt.

### FR-005 Baseline Comparison
Provide aggregate, category, and prompt-level diffs.

### FR-006 Regression Detection
Detect threshold and trend regressions with severity labels.

### FR-007 Drift Event Timeline
Display distribution-shift and behavior-shift events with status (resolved / under investigation).

### FR-008 Release Gate Engine
Output `GO`, `CONDITIONAL GO`, or `NO-GO` with reason codes based on gate policy in Section 18.

### FR-009 Release Readiness Controls
Allow threshold sliders and real-time verdict recomputation.

### FR-010 Custom Results Upload
Accept any conforming `eval-results.json`, validate schema, and rerender dashboard.

### FR-011 Reporting
Export stakeholder summary (Markdown) plus machine-readable JSON.

### FR-012 Failure Analysis
Surface top failure drivers by category and difficulty tier on Overview and Accuracy views.

### FR-013 CI Gate (v1.1a)
Run smoke eval on every PR to main via GitHub Actions. `check-gate.js` applies gate policy and exits 0 (pass) or 1 (fail). PR check status visible in GitHub. No backend server required.

### FR-014 Cost Guardrails
Track per-run token cost and enforce budget warnings at USD 40 projected monthly spend.

### FR-015 Audit Trail (v1.1b)
Persist run metadata: model versions, dataset version, config version, timestamp, decision.

### FR-016 Calibration Module (v1.1b)
Record judge-human agreement and highlight disagreement clusters.

---

## 10. Non-Functional Requirements
1. **Performance**
   - Full suite completion ≤ 15 minutes
   - Smoke suite completion ≤ 5 minutes
   - Dashboard first meaningful render < 1 second

2. **Reliability**
   - ≥ 99% run completion success rate (excluding provider outages)

3. **Observability**
   - Capture logs, errors, token usage, and step-level timing per run

4. **Security**
   - API keys stored as GitHub Actions secrets and Railway environment variables — never in code or committed files
   - Mask sensitive fields in prompts and outputs where required

5. **Reproducibility**
   - Re-run same config with traceable variance record

6. **Maintainability**
   - Thresholds and rubric weights configurable without source changes (config files only)

---

## 11. Product Experience (MVP)
### 11.1 Views

**1. Overview**
- KPI cards: weighted quality, P95 latency, cost/inference, drift status
- Each card: current value, delta vs prior period, winner indicator (green / amber / neutral)
- Top failure categories callout: 2 categories with largest model gap
- Summary recommendation sentence

**2. Accuracy**
- Time series of weighted quality score (0–100) for both models
- Difficulty-band comparison: easy / medium / hard grouped bars per model
- Rolling 7-day average overlay
- Drift event timeline strip below chart

**3. Latency**
- P50, P95, P99 comparison with long-tail annotation
- Annotation callout: risk quantified with recommendation

**4. Cost**
- Cost trend and cumulative savings calculator (slider: inferences/day → projected monthly saving)
- Break-even callout: quality delta required to justify cost premium

**5. A/B Comparison**
- Dimension radar chart weighted per loaded dataset
- Side-by-side metric table with delta column
- Structured verdict: "[Model] wins on [dimensions]. [Model] preferred for [use case]."

**6. Release Readiness**
- Per-metric sliders: accuracy threshold, P95 latency ceiling, cost/inference ceiling, drift status
- Sliders default to borderline-Go — small adjustment flips verdict
- Three-tier verdict card updates in real time: GO / CONDITIONAL GO / NO-GO
- Safety hard floor indicator: policy violations present → NO-GO regardless of slider positions
- Checklist: passed criteria (green), failed criteria (red), delta required to flip each failure

### 11.2 Reusability Proof
- Drag-and-drop result file upload
- Schema errors surfaced with user-readable guidance
- "Custom eval loaded — [filename]" state indicator persists until page reload

---

## 12. Technical Architecture
### 12.1 v1 — Fast Delivery (Static)
- Frontend: React + TypeScript + Recharts + Vite
- Eval pipeline: local Node.js CLI runner (`eval-runner.js`, `judge.js`)
- Data: static pre-baked JSON (`eval-results.json`)
- Deployment: Cloudflare Pages (free tier, no server)

### 12.2 v1.1a — CI Gate (GitHub Actions, no new infrastructure)

The CI gate runs a smoke eval on every PR to main and blocks merge if the verdict is NO-GO. It uses the existing CLI — no API server, no Redis, no Postgres.

**How it works:**
```
PR opened / updated
        ↓
GitHub Actions: run smoke suite (10 prompts, ~5 min)
        ↓
check-gate.js parses results, applies gate policy
        ↓
GO or CONDITIONAL GO  →  PR check passes (green)
NO-GO                 →  PR check fails (red), merge blocked
```

**Workflow file (`.github/workflows/eval-gate.yml`):**
```yaml
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

**Gate policy applied by `check-gate.js`:**
- NO-GO if any `policy_violation: true` → exit 1
- NO-GO if aggregate weighted quality score drops > 5% vs baked baseline → exit 1
- CONDITIONAL GO if quality neutral/improved but latency or cost regress within soft bounds → exit 0 with warning annotation
- GO if all conditions pass → exit 0

**Example CI log output:**
```
=== AI Evals Gate ===
Dataset: seller-intelligence-v1 (smoke, 10 prompts)
Model A: Claude Sonnet 4.5  →  avg quality: 83.4
Model B: DeepSeek-V3        →  avg quality: 78.1
Baseline quality (baked): 82.9

Policy violations: 0
Quality delta vs baseline: +0.5% (Model A), -5.8% (Model B)

Model B quality delta exceeds -5% threshold.
Verdict: CONDITIONAL GO — Model A passes. Model B flagged.
PR check: PASS (with annotation)
```

**Cost per CI run:** ~USD 0.15–0.20 per PR (10 prompts × 2 models + judge). At 5 PRs/week: ~USD 3–4/month.

### 12.3 v1.1b — Operational Hardening (future)
- Persistent run history: Postgres or equivalent
- Worker queue for long-running full-suite jobs
- CI integration extended to block deploys, not just PRs

---

## 13. File Structure

```
ai-evals-control-tower/
├── config/
│   ├── models.json                   # names, providers, endpoints, token pricing
│   ├── judge-rubric.json             # 5 dimensions, weights per dataset, 1-10 scale
│   └── settings.json                 # release readiness default thresholds, hard floor values
│
├── datasets/
│   ├── seller-intelligence-v1.json   # 50 prompts, AM-facing
│   ├── seller-support-v1.json        # 50 prompts, seller-facing
│   └── seller-profiles.json          # 10 mock seller data profiles
│
├── eval/
│   ├── eval-runner.js                # CLI: --model-a --model-b --dataset --suite --output
│   ├── judge.js                      # LLM-as-judge; returns per-dimension scores + policy_violation
│   ├── check-gate.js                 # CI gate: reads results JSON, exits 0 (pass) or 1 (fail)
│   └── generate-history.js           # extends real run to 30-day time series with drift events
│
├── output/
│   ├── eval-results.json             # baked-in results the dashboard reads by default
│   └── ci-results.json               # written by CI gate run (gitignored)
│
├── src/                              # React + TypeScript dashboard
│   ├── components/
│   ├── views/
│   ├── data/
│   └── schema/                       # TypeScript types matching results schema
│
├── .github/
│   └── workflows/
│       └── eval-gate.yml             # GitHub Actions: smoke eval on every PR to main
│
└── README.md                         # schema docs, CLI usage, worked example: new dataset → dashboard
```

---

## 14. Results Schema (Required Fields)
```json
{
  "meta": {
    "generated_at": "2026-02-20T00:00:00Z",
    "dataset": "seller-intelligence-v1",
    "dataset_version": "1.0",
    "suite": "full",
    "judge_model": "claude-sonnet-4-5",
    "runner_version": "1.0.0",
    "run_id": "run_20260220_001"
  },
  "model_a": { "name": "Claude Sonnet 4.5", "provider": "Anthropic", "version": "claude-sonnet-4-5" },
  "model_b": { "name": "DeepSeek-V3", "provider": "DeepSeek", "version": "deepseek-chat" },
  "daily": [
    {
      "date": "2026-02-20",
      "model_a": {
        "quality_score": 84.2,
        "latency_p50": 1120,
        "latency_p95": 2340,
        "latency_p99": 3810,
        "cost_per_inference": 0.0031,
        "scores": { "relevance": 8.4, "accuracy": 8.6, "actionability": 7.9, "coherence": 8.8, "conciseness": 7.2 }
      },
      "model_b": {
        "quality_score": 79.4,
        "latency_p50": 1310,
        "latency_p95": 2660,
        "latency_p99": 4170,
        "cost_per_inference": 0.00028,
        "scores": { "relevance": 7.9, "accuracy": 7.6, "actionability": 7.4, "coherence": 8.1, "conciseness": 8.3 }
      }
    }
  ],
  "events": [
    {
      "type": "distribution_shift",
      "start": "2026-02-01",
      "end": "2026-02-08",
      "resolved": true,
      "resolved_at": "2026-02-11",
      "description": "Prompt difficulty mix skewed toward hard tier. Scores recovered after rebalancing."
    },
    {
      "type": "behaviour_shift",
      "start": "2026-02-15",
      "end": null,
      "resolved": false,
      "description": "Sharp quality drop on root-cause-analysis category for Model B. Under investigation."
    }
  ],
  "prompts": [
    {
      "id": "si-001",
      "category": "performance-summary",
      "difficulty": "easy",
      "model_a_response": "...",
      "model_b_response": "...",
      "model_a_scores": { "relevance": 9, "accuracy": 9, "actionability": 8, "coherence": 9, "conciseness": 7 },
      "model_b_scores": { "relevance": 8, "accuracy": 8, "actionability": 7, "coherence": 8, "conciseness": 8 },
      "model_a_latency_ms": 1084,
      "model_b_latency_ms": 2310,
      "model_a_cost": 0.0029,
      "model_b_cost": 0.00024,
      "policy_violation": false
    }
  ]
}
```

The `meta` block is the immutable audit trail — captures the exact config for every run. The schema is model-agnostic: `model_a` and `model_b` carry their own names and providers; the dashboard has no embedded knowledge of specific models.

---

## 15. Delivery Plan
### Phase 0: Design Lock
- Dates: February 23 – February 27, 2026
- Output: frozen schemas, rubric weights, gate thresholds, dataset plan, and seller profile data

### Phase 1: MVP Build
- Dates: March 2 – March 20, 2026
- Output: local runner, two datasets with 100 prompts, six-view dashboard, file upload support

### Phase 2: Gate Hardening
- Dates: March 23 – April 3, 2026
- Output: reason-coded gate engine, release report export, smoke/full suite tiering, budget checks

### Phase 3: CI Gate (v1.1a)
- Dates: April 6 – April 10, 2026
- Output: `check-gate.js` + `eval-gate.yml` wired and passing on main; deliberate regression commit used to validate red PR block; screenshot captured for portfolio

### Phase 4: Calibration and Packaging
- Dates: April 13 – May 1, 2026
- Output: judge calibration run documented, public case study artifacts, final portfolio integration

---

## 16. Success Metrics
### 16.1 Product Success
1. 100% of in-scope releases have pre-release eval report.
2. ≥ 90% critical failure mode coverage in MVP workflows.
3. ≥ 30% reduction in post-release quality incidents by end of quarter.

### 16.2 System Success
1. Full suite runtime ≤ 15 minutes.
2. Smoke suite runtime ≤ 5 minutes.
3. Judge-human agreement ≥ 0.75 on calibration subset.
4. Dashboard first meaningful render < 1 second.

### 16.3 Adoption Success
1. PM and engineering use gate report in every release cycle.
2. At least 2 release decisions altered by evaluation evidence in first 60 days.

### 16.4 Portfolio Success
1. Dashboard demo walkthrough ≤ 90 seconds.
2. Custom file upload rerenders correctly for any valid schema file.
3. CI gate: green check visible on passing PRs; red block visible on deliberate regression PR.
4. Public repo and case study clearly explain architecture, tradeoffs, and impact.

---

## 17. Risks and Mitigations
1. **Over-reliance on LLM judge**
   - Mitigation: weekly calibration and disagreement tracking; target ≥0.75 human agreement

2. **Slow runs reduce adoption**
   - Mitigation: smoke/full suite tiering; smoke suite enforced for all development iteration

3. **Stale datasets reduce validity**
   - Mitigation: owner-based freshness review every two weeks

4. **Misconfigured thresholds create false blocks**
   - Mitigation: shadow mode and monthly threshold backtesting; start with permissive thresholds and tighten

5. **Cost growth from frequent iteration**
   - Mitigation: enforce smoke suite during development; full suite only for final bake and calibration; USD 40 alert threshold

6. **CI gate API cost in high-PR-volume periods**
   - Mitigation: USD 0.15–0.20 per run; at 5 PRs/week total is ~USD 3–4/month — well within budget cap

---

## 18. Dependencies and Assumptions
Dependencies:
- Model API access for Claude Sonnet 4.5 and DeepSeek-V3
- GitHub repository for CI gate workflow
- Cloudflare Pages for static hosting

Assumptions:
- Seed prompt dataset completed during Phase 0/1
- One peer reviewer available monthly for threshold review
- Governance discipline maintained after MVP launch

---

## 19. Release Gate Policy
### 19.1 Hard NO-GO Conditions
1. Safety floor breach (score < 8.0/10) on any mandatory workflow aggregate.
2. Critical policy violation count > 0 (`policy_violation: true` on any prompt).
3. Aggregate weighted quality drop > 5% vs baseline.
4. Mandatory workflow pass rate < 85%.

### 19.2 Conditional GO Conditions
1. Quality is neutral or improved, but latency or cost soft limits regress within acceptable range.
2. Owner documents mitigation and next review date before merge is approved.

### 19.3 GO Conditions
1. No hard NO-GO conditions triggered.
2. Weighted quality at or above baseline.
3. Safety and mandatory workflow floors satisfied.

---

## 20. Readiness Checklist for Build Start
1. Dataset schema signed off.
2. Rubric weights locked for both datasets.
3. Gate thresholds and hard floors approved.
4. Budget limits configured.
5. Phase 0 and Phase 1 timeline confirmed.

---

## 21. Final Notes
This v3.1 PRD is the execution contract. If implementation discovers mismatches, updates should be versioned as v3.2 with explicit change log entries.
