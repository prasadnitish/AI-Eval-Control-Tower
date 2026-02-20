# Coverage Matrix for v2 Dataset Build

## Seller Support v2 Target (120 Cases)

| Category | Target Cases | Easy | Medium | Hard | Notes |
|---|---:|---:|---:|---:|---|
| Account health ODR/deactivation | 14 | 2 | 5 | 7 | Include warning + suspension states |
| Listing suppression/restricted products | 12 | 2 | 5 | 5 | Multi-cause suppression mix |
| Payment reserves/disbursement delays | 10 | 1 | 5 | 4 | Cash-flow and timeline realism |
| Fee disputes/charge adjustments | 8 | 1 | 5 | 2 | Include dimension/category remapping |
| Counterfeit/IP complaints | 12 | 1 | 4 | 7 | Include rights-owner evidence patterns |
| Hijack/Buy Box abuse | 9 | 1 | 5 | 3 | Include overlap with review abuse |
| Review abuse/manipulation | 7 | 1 | 4 | 2 | Include false positives |
| A-to-Z claims/chargebacks | 14 | 2 | 6 | 6 | Include representment tradeoffs |
| FBA missing inventory/reimbursements | 10 | 1 | 6 | 3 | FC discrepancy and claim windows |
| Stranded inventory/removals | 8 | 2 | 4 | 2 | Variation/linking failure scenarios |
| Communications/POA drafting | 8 | 1 | 3 | 4 | Include escalation narrative quality |
| Other operational support | 8 | 2 | 4 | 2 | Tax docs, account settings, tooling |

Difficulty mix goal: `30% easy`, `45% medium`, `25% hard`

## Seller Intelligence v2 Target (120 Cases)

| Category | Target Cases | Easy | Medium | Hard | Notes |
|---|---:|---:|---:|---:|---|
| Portfolio risk triage | 12 | 1 | 5 | 6 | Multi-seller prioritization |
| Buy Box and pricing strategy | 12 | 2 | 5 | 5 | Margin guardrails mandatory |
| Inventory/replenishment planning | 14 | 2 | 7 | 5 | Seasonal + lead-time uncertainty |
| Margin bridge and fee leakage | 12 | 1 | 5 | 6 | Quant-heavy cases |
| Promotion ROI and cannibalization | 10 | 2 | 5 | 3 | Deal quality vs contribution |
| Returns/NCX root cause | 12 | 1 | 6 | 5 | Symptom vs cause separation |
| Ads efficiency allocation | 10 | 2 | 5 | 3 | Supply-aware spend logic |
| Catalog/compliance optimization | 10 | 1 | 5 | 4 | Suppression prevention focus |
| Working capital strategy | 9 | 1 | 4 | 4 | Reserve and reimbursement effects |
| Seller churn prevention | 8 | 1 | 4 | 3 | Relationship + economics |
| Executive QBR narratives | 6 | 1 | 3 | 2 | Communication quality scoring |
| What-if scenario planning | 5 | 0 | 2 | 3 | Assumption transparency |

Difficulty mix goal: `25% easy`, `50% medium`, `25% hard`

## Hard-Case Minimums
- At least 20 hard support cases must include `fraud`, `counterfeit`, `chargeback`, or `suspension` context.
- At least 20 hard intelligence cases must require explicit tradeoffs between at least two of: `quality`, `latency`, `cost`, `policy risk`, `cash flow`.

## Calibration Holdout Set (40 Cases)
- 20 support + 20 intelligence
- No overlap with training/evaluation production set
- Include 10 adversarial prompts with ambiguous seller narratives

