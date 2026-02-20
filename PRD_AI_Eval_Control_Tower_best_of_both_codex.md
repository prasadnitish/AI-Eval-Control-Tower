# Product Requirements Document (Best of Both)
## AI Evals Control Tower

Document Version: v2.1 (Merged)  
Date: February 20, 2026  
Owner: Nitish Prasad  
Source Inputs: `PRD_AI_Eval_Control_Tower_claude.md` + `PRD_AI_Eval_Control_Tower_codex.md`  
Prepared by: Codex

---

## 1. Executive Summary
AI Evals Control Tower is a release-readiness system for AI products. It helps teams compare baseline vs candidate model behavior across quality, safety, latency, and cost, then produce a defensible `GO / CONDITIONAL GO / NO-GO` decision.

This merged PRD intentionally combines:
- Claude PRD strengths: concrete datasets, realistic scenario design, reusable viewer architecture, and compelling interview/demo narrative.
- Codex PRD strengths: governance rigor, phased rollout, functional/non-functional requirements, calibration discipline, risk controls, and measurable success criteria.

The result is a plan that is both portfolio-strong and execution-ready.

---

## 2. Product Thesis
### 2.1 Problem Statement
AI teams frequently lack a repeatable release gate for model/prompt/retrieval changes. That leads to either:
1. Risk-averse teams that avoid upgrades.
2. Aggressive teams that discover regressions after users complain.

### 2.2 Product Thesis
Evaluation must be treated like a product capability, not a one-off experiment. A credible control tower must separate concerns clearly:
- Runner: compare any two models on any valid dataset.
- Data: versioned datasets with explicit schema and ownership.
- Config: model pricing, thresholds, and rubric weights externalized.
- Viewer: model-agnostic dashboard that reads any valid results file.

### 2.3 Strategic Value
- Enables faster but safer release velocity.
- Provides PM-legible decision evidence.
- Demonstrates end-to-end AI product leadership: strategy + architecture + governance.

---

## 3. Goals, Non-Goals, and North Star
### 3.1 Primary Goal
Build a working AI release-evaluation product that can be demonstrated live and adopted in real release workflows.

### 3.2 Secondary Goal
Prove framework reusability using multiple domains and custom result-file ingestion.

### 3.3 North-Star Goal
100% of in-scope AI releases have a baseline-vs-candidate report and explicit gate outcome before production rollout.

### 3.4 Non-Goals (v1)
- Enterprise SaaS multi-tenancy, SSO administration, broad RBAC features.
- Real-time online eval loops with live production feedback.
- Fully automated rollback orchestration.

---

## 4. Users and Jobs-To-Be-Done
### 4.1 Primary Users
- AI Product Manager
- Applied AI/ML Engineer
- QA / Trust & Safety reviewer

### 4.2 JTBD
1. Decide release readiness with measurable confidence.
2. Diagnose why candidate performance regressed.
3. Enforce quality/safety floors while balancing latency and cost.
4. Communicate release rationale clearly to leadership.

---

## 5. Scope and Product Strategy
## 5.1 Product Strategy: Two-Layer Delivery (Best-of-Both Decision)
To maximize speed and credibility, execute in two layers:

1. **Layer A (Portfolio-grade MVP, fast ship)**
- Static dashboard + local eval runner + baked JSON output + custom file upload.
- Mirrors Claude PRD's rapid, high-signal demo approach.

2. **Layer B (Operationalization, production-like)**
- Service-backed runs, CI gates, audit trail, and calibration workflow.
- Mirrors Codex PRD's governance and real-release integration.

This sequencing avoids overbuilding too early while preserving a clear path to operational maturity.

### 5.2 In Scope (v1)
- Dataset registry and versioning
- Structured test cases with categories and difficulty tiers
- Weighted rubric scoring
- Baseline-vs-candidate comparison
- Regression detection with severity
- Release gate policy and decision output
- Trend visualizations and drift event timeline
- Downloadable release report
- Drag-and-drop custom results ingestion

### 5.3 In Scope (v1.1)
- CI-triggered eval runs (smoke/full)
- Judge-human calibration loop
- Segment/risk-tier analysis
- Alerting and richer failure root-cause diagnostics

### 5.4 Out of Scope (v1)
- Full enterprise control-plane features
- Real-time production traffic gating
- Auto-remediation and rollback pipelines

---

## 6. Data and Evaluation Design
### 6.1 Initial Datasets (Adopt from Claude PRD)
Ship with two materially different datasets:
1. `seller-intelligence-v1.json` (50 prompts)
- AM-facing, proactive strategy and synthesis
- Higher-stakes decision support

2. `seller-support-v1.json` (50 prompts)
- Seller-facing support and resolution
- Clarity/tone weighted more heavily

Shared structure:
- 5 categories x 10 prompts
- Difficulty mix: 3 easy / 4 medium / 3 hard per category
- 10 reusable mock seller profiles providing contextual realism

### 6.2 Rubric Dimensions (Common)
- Relevance
- Accuracy
- Actionability
- Coherence
- Conciseness

### 6.3 Dataset-Specific Weighting (Adopt from Claude PRD)
Seller Intelligence weighting:
- Accuracy 25%
- Actionability 25%
- Relevance 20%
- Coherence 20%
- Conciseness 10%

Seller Support weighting:
- Coherence 25%
- Conciseness 25%
- Relevance 20%
- Accuracy 20%
- Actionability 10%

### 6.4 Cross-Cutting Release Scorecard (Adopt from Codex PRD)
In addition to rubric quality score, every gate decision includes:
- Safety/Policy score floor (hard gate)
- Latency thresholds (P50/P95/P99)
- Cost-per-inference threshold

Gate policy dimensions:
- Quality
- Safety
- Latency
- Cost

---

## 7. Functional Requirements
### FR-001 Dataset Registry
Version and store datasets with metadata: use case, risk tier, owner, freshness date.

### FR-002 Test Case Schema
Support structured prompt + context + expected constraints + tags.

### FR-003 Eval Runner
CLI/service runner accepts model A, model B, dataset, and config.

### FR-004 Judge Scoring
Compute per-case, per-dimension scores using rubric config.

### FR-005 Baseline Comparison
Provide aggregate/category/case-level comparisons.

### FR-006 Regression Detection
Flag statistically meaningful or threshold-based regressions.

### FR-007 Drift Tracking
Render drift events (distribution shift and behavior shift) in timeline strip.

### FR-008 Release Gate Engine
Output `GO`, `CONDITIONAL GO`, `NO-GO` with reason codes.

### FR-009 Release Readiness View
Interactive thresholds with real-time verdict updates.

### FR-010 File Upload Reusability Demo
Validate schema and re-render dashboard for custom eval file.

### FR-011 Reporting
Generate stakeholder-friendly summary + JSON export.

### FR-012 Audit Trail (v1.1)
Persist run config, timestamps, versions, and decision history.

### FR-013 CI Integration (v1.1)
Trigger evaluation in CI and enforce gate outcomes for release branches.

---

## 8. Non-Functional Requirements
- Performance: Full suite <=15 min; smoke suite <=5 min.
- Reliability: >=99% successful run completion (excluding provider outages).
- Observability: run logs, token usage, timing, and error diagnostics.
- Security: mask sensitive test content; protect config and results.
- Maintainability: thresholds and rubrics configurable outside code.
- Reproducibility: deterministic run metadata with traceable variance bounds.

---

## 9. Product Experience (MVP UI)
Adopt the six-view framework from Claude PRD, with Codex governance overlays.

### 9.1 Views
1. Overview
- KPI cards: quality, P95 latency, cost/inference, drift status
- Delta vs prior period and summary recommendation

2. Accuracy
- Daily weighted quality lines
- Difficulty-band comparison
- Drift event timeline strip

3. Latency
- P50/P95/P99 comparison and long-tail risk annotation

4. Cost
- Cost trends, cumulative calculator, break-even insight

5. A/B Comparison
- Radar chart + metric table + structured verdict

6. Release Readiness
- Threshold sliders
- Real-time gate decision and pass/fail checklist

### 9.2 Reusability Proof
- Drag-and-drop `eval-results.json`
- Schema validation with clear error feedback
- Persistent custom-data loaded state

---

## 10. Architecture (Merged Recommendation)
### 10.1 v1 Architecture (Fast + Convincing)
- Frontend: React + TypeScript + Recharts + Vite
- Data: static JSON output from runner
- Eval scripts: local CLI (Node or Python)
- Hosting: static deployment (Cloudflare Pages)

### 10.2 v1.1 Architecture (Operational)
- Backend API: FastAPI
- Worker queue: Redis-backed jobs
- Storage: Postgres for run history and metadata
- CI integration: GitHub Actions gates

This layered architecture keeps initial build velocity high while preserving migration path.

---

## 11. Delivery Plan
### Phase 0 (Week 1): Design Lock
- Freeze schema, rubric policy, gate thresholds, and initial datasets.

### Phase 1 (Weeks 2-4): MVP Build
- Build datasets, runner, scoring, and static dashboard.
- Implement six views and custom upload.
- Output: live demo-quality product.

### Phase 2 (Weeks 5-6): Gate Hardening
- Add release readiness logic, reason codes, and report exports.
- Add smoke/full suite variants.

### Phase 3 (Weeks 7-9): Operationalization
- Add calibration workflow, CI enforcement, and run audit trail.
- Add trend analytics and post-run summaries.

---

## 12. Success Metrics
### 12.1 Product Outcomes
- 100% in-scope releases evaluated before launch.
- >=90% critical failure mode coverage.
- >=30% reduction in post-release AI quality incidents.

### 12.2 System Outcomes
- Full suite runtime <=15 min.
- Gate false-positive/false-negative rate tracked and improved monthly.
- Judge-human agreement >=0.75 on calibration subset.

### 12.3 Demo/Portfolio Outcomes
- First meaningful render <1 second for dashboard.
- Upload any conforming results file and re-render reliably.
- Complete demo narrative in <=90 seconds.

---

## 13. Risks and Mitigations
1. Over-trust in LLM judge
- Mitigation: calibration set, disagreement dashboard, human spot checks.

2. Low adoption due to long runs
- Mitigation: smoke/full suite strategy and caching.

3. Stale datasets
- Mitigation: dataset ownership, freshness SLA, periodic review.

4. Threshold mis-tuning
- Mitigation: shadow mode and historical backtesting before hard enforcement.

5. Cost overrun
- Mitigation: run budget caps, adaptive sampling, and token tracking.

---

## 14. Dependencies and Assumptions
Dependencies:
- Model API access and pricing data
- Stable baseline configuration references
- CI pipeline integration environment

Assumptions:
- Team agrees on release governance policy
- Seed cases and historical failure examples are available
- Owners are assigned for dataset and threshold maintenance

---

## 15. Release Gate Policy (Draft)
Hard Fail (`NO-GO`) if any occurs:
- Safety floor breach
- Aggregate weighted quality drop >5% vs baseline
- Critical workflow pass rate below minimum threshold

`CONDITIONAL GO` if:
- Quality improves or is neutral, but latency/cost soft thresholds regress within bounded range
- Mitigation owner and follow-up review date are attached

`GO` if:
- No hard-fail conditions
- Weighted score at/above baseline
- All mandatory workflow floors pass

---

## 16. Open Questions to Resolve Before Build Start
1. Which 2-3 workflows are mandatory for MVP gate decisions?
2. What exact safety floor constitutes automatic `NO-GO`?
3. Which model/provider pairs must be supported in first release?
4. What is the monthly token budget for iterative evaluation runs?
5. Who owns weekly calibration and monthly threshold review?

---

## 17. Final Recommendation
Use this merged PRD as the build contract. It keeps Claude PRD's concrete, credible demo mechanics and Codex PRD's operational governance discipline. This gives you both interview strength and real-world readiness without unnecessary initial complexity.

---

codex
