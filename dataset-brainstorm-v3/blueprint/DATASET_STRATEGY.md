# AI Evals Control Tower - Detailed Dataset Strategy (Brainstorm)

## 1) Design Goal
Create a synthetic dataset that feels operationally real for an Amazon-like marketplace.
The data should support two evaluation tracks:
- **Seller Support**: policy/helpdesk/appeals operations, including fraud, abuse, and payment disputes.
- **Seller Intelligence**: AM and business strategy workflows (growth, risk, remediation, margin, pricing, inventory).

## 2) Data Model Mental Framework
Use a layered model so prompts can reference realistic context.

1. **Seller Layer**
- Business identity, tenure, legal/compliance flags, account health, payment posture.

2. **Catalog Layer (ASIN/SKU)**
- Product metadata, variation families, listing quality, content completeness, compliance restrictions.

3. **Commercial Layer**
- Price history, Buy Box share, promotions, ad spend, conversion and elasticity signals.

4. **Operations Layer**
- Inventory on hand, inbound, reserved, stranded, aged units, FC receiving discrepancies.

5. **Trust & Safety Layer**
- ODR, A-to-Z claims, chargebacks, suspected counterfeit, review abuse, IP complaints.

6. **Financial Layer**
- Settlement statements, reserve holds, fee disputes, reimbursement claims, SAFE-T claims.

7. **Interaction Layer**
- Support cases and AM action plans linking to seller + ASIN context.

## 3) Join Keys and Referential Integrity
Mandatory keys:
- `seller_id`
- `asin`
- `sku`
- `marketplace_id`
- `week_start`
- `case_id`

Reference rules:
- Every support/intelligence case should map to at least one `seller_id`.
- At least 70% of cases should map to one or more concrete ASINs.
- Payment/fraud cases should include transaction-level or settlement-level references.

## 4) Seller Coverage Blueprint
Recommended baseline for v2:
- 24 sellers total
- Health tiers: 5 healthy, 5 high-growth, 5 stalling, 5 at-risk, 4 distressed
- Fulfillment mix diversity: FBA-heavy, hybrid, FBM-heavy
- Category diversity: electronics, home, beauty, consumables, apparel, toys

Seller profile attributes (must-have):
- Business profile: legal name, launch date, seller type (3P reseller/private label)
- Commercial metrics: GMV, units, session trend, CVR, Buy Box share
- Customer metrics: rating, returns, NCX/negative feedback, cancellation rate
- Account health: ODR, valid tracking rate, late shipment rate, policy strikes
- Financial posture: reserve %, payout delay days, chargeback count, fee dispute trend
- Risk tags: counterfeit risk, listing abuse risk, fraud exposure risk

## 5) ASIN and Catalog Detail Requirements
Each ASIN record should include:
- Core: `asin`, `parent_asin`, `sku`, title, brand, category, subcategory
- Compliance: hazmat class, restricted product flag, required documentation status
- Listing quality: title quality score, bullet completeness, A+ content, image count
- Quality signals: defect return reasons, star rating trend, NCX reasons
- Commercial signals: price, landed cost, gross margin %, Buy Box %, ad ACOS/ROAS
- Inventory signals: on-hand, inbound, reserved, unhealthy inventory days, stockout days
- Abuse signals: hijack attempts, suspected fake reviews, duplicate listing collisions

## 6) Support Dataset - Top Marketplace Case Taxonomy
Use realistic mix based on typical marketplace operations.

| Domain | Category | Suggested Share | Severity | Why it matters |
|---|---|---:|---|---|
| Account Health | ODR / late shipment / tracking defects | 12% | High | Immediate suspension risk |
| Policy & Compliance | Listing suppression / restricted products | 10% | High | Revenue loss + enforcement |
| Payments | Reserve holds / payout delays | 9% | High | Seller cash flow stress |
| Payments | Fee disputes / charge adjustments | 7% | Medium | Profitability erosion |
| Fraud & Abuse | Counterfeit claims | 7% | Critical | Legal + account risk |
| Fraud & Abuse | Listing hijacking / buy box abuse | 7% | High | Sales diversion |
| Fraud & Abuse | Review manipulation / black-hat attacks | 5% | Medium | Ranking + trust distortion |
| Orders & Claims | A-to-Z claims / chargebacks | 8% | High | ODR and financial impact |
| FBA Ops | Missing inbound / reimbursement disputes | 8% | Medium | Inventory + finance impact |
| Inventory | Stranded inventory / removals | 6% | Medium | Working capital lockup |
| Catalog | Variation abuse / attribute mismatch | 5% | Medium | Suppression and conversion loss |
| IP & Brand | Trademark/copyright complaints | 6% | High | Listing takedown risk |
| Tax & Regulatory | Marketplace tax document issues | 3% | Medium | Account/payment blocks |
| Advertising | Invalid click/fraud complaints | 3% | Low | Cost efficiency concerns |
| Other | Tooling/integration issues | 4% | Low | Operational friction |

### Support-case realism requirements
- Include long seller messages with partial facts and emotional tone.
- Include conflicting evidence (seller says X, logs indicate Y).
- Include clear policy boundaries to test hallucination resistance.
- Include time-critical cases ("48 hours to appeal", reserve release date, etc.).

## 7) Intelligence Dataset - Top AM/Business Taxonomy

| Domain | Category | Suggested Share | Complexity | Key Decision |
|---|---|---:|---|---|
| Portfolio Health | Seller risk triage | 12% | Medium | Which sellers need intervention now |
| Growth | Selection expansion strategy | 10% | Medium | Which ASINs to launch next |
| Profitability | Margin bridge and fee leakage | 12% | High | GMV vs contribution tradeoff |
| Pricing | Elasticity and buy box strategy | 10% | High | Price move guardrails |
| Inventory | Replenishment and stockout prevention | 12% | High | PO timing and unit depth |
| CX Quality | Returns/NCX root causes | 10% | Medium | Product/listing fixes |
| Promotion | Promo ROI and cannibalization | 8% | Medium | Deal calendar choices |
| Advertising | TACOS/ACOS efficiency | 8% | Medium | Spend reallocation |
| Risk | Compliance and deactivation early warning | 10% | High | Preventive action plan |
| Executive | QBR narrative and commitments | 8% | Medium | Leadership-ready story |

### Intelligence-case realism requirements
- Include 4-8 linked metrics and at least one contradictory signal.
- Force prioritization under constraints (budget, capacity, timeline).
- Include explicit requested output format (90-day plan, ranked actions, what-if table).
- Include confidence/risk language expectations in good answers.

## 8) Difficulty Construction Rules
Apply difficulty in both support and intelligence sets.

- **Easy**: single issue, clear evidence, one policy/process path.
- **Medium**: two interacting issues, partial data, trade-off discussion.
- **Hard**: multi-causal, contradictory indicators, urgent timeline, high business risk.

Recommended split:
- 30% easy
- 45% medium
- 25% hard

## 9) Golden Answer and Failure Trap Design
For each case include:
- `expected_good_response`: concise checklist of required content.
- `failure_traps`: likely model failures to detect.

Common failure traps:
- Invented policy thresholds
- Overconfident legal language
- Ignoring timeline urgency
- Missing evidence requests
- Not separating immediate actions from long-term prevention

## 10) Synthetic Data Realism Enhancers
Use controlled "messiness":
- Metric lag and delayed updates (e.g., ODR reflects prior 60 days)
- Weekend/holiday inventory anomalies
- Price-war events where Buy Box drops despite low price due to seller metrics
- Promotion cannibalization (high units, low margin)
- Appeals with prior rejection history

## 11) Scenario Packs To Build
Create bundles for repeatable evals.

### Pack A: Fraud and Abuse Escalations
- Counterfeit complaints
- Hijack and unauthorized seller incidents
- Review abuse and rating attacks
- Brand registry evidence pack quality

### Pack B: Payment Dispute and Cash Flow Stress
- Reserve holds and disbursement delays
- Fee reclassification disputes
- Chargeback spikes and SAFE-T recovery
- Reimbursement claim denials

### Pack C: High-Risk Account Health Recovery
- ODR above threshold
- A-to-Z claim cluster
- Late shipment surge due to hybrid fulfillment breakdown

### Pack D: AM Strategy and Portfolio Governance
- Seller segmentation and intervention queue
- Margin and promotion optimization
- Inventory health with seasonal demand shifts

## 12) Field-Level Minimums for Prompt Context Payload
Each generated prompt context should include:
- Seller summary block (10-15 core metrics)
- Relevant ASIN snippets (2-5 products)
- Time-series mini table (last 8-12 weeks)
- Event log (violations, claims, suppressions, fee events)
- Optional support thread snippets

## 13) Evaluation-Specific Metadata
Every case should have:
- `case_weight` (frequency realism)
- `business_impact` (`low|medium|high|critical`)
- `policy_risk` (`none|moderate|high|critical`)
- `expected_tone` (`supportive|firm|urgent|executive`)
- `response_sla_target_hours`
- `requires_disclaimer` (true for legal/policy sensitive cases)

## 14) Suggested Dataset Sizes
- Seller Support v2: 120 cases
- Seller Intelligence v2: 120 cases
- Calibration holdout set: 40 cross-domain cases
- Stress test mini-set: 25 hard-only edge cases

## 15) Build Sequence
1. Lock schemas.
2. Expand seller + ASIN master data.
3. Build support and intelligence case banks with metadata.
4. Generate v2 prompt files by weighted sampling.
5. Create holdout and stress test sets.
6. Run rubric calibration and refresh case weights.

## 16) Quality Bar Checklist Before Use
- No broken references (`seller_id`, `asin`, `case_id`).
- Each case includes both expected answer requirements and failure traps.
- Fraud/payment domain has at least 20% of support dataset by weight.
- Distressed seller scenarios appear in both support and intelligence datasets.
- At least 30% of intelligence cases include explicit margin math or tradeoff analysis.

