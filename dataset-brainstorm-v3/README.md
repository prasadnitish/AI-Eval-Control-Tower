# Dataset Brainstorm Pack (v3)

This folder contains a **net-new dataset design workspace** for AI Evals Control Tower.
No existing project files were modified.

## Purpose
Build realistic, high-fidelity synthetic data that mimics seller performance on a large e-commerce marketplace, with emphasis on:
- Seller + ASIN-level business performance
- Inventory, pricing, promotions, catalog quality
- Seller support scenarios including fraud/abuse and payment disputes
- Seller intelligence scenarios for AM decision support

## Folder Structure
- `blueprint/DATASET_STRATEGY.md`: end-to-end design and coverage strategy
- `schemas/seller_profile.schema.json`: seller-level canonical schema
- `schemas/asin_catalog_item.schema.json`: ASIN-level schema
- `schemas/eval_case.schema.json`: unified eval-case schema (support + intelligence)
- `seed/seller_profiles_detailed_v2.json`: rich seller master records
- `seed/asin_catalog_detailed_v2.json`: detailed ASIN/product records
- `seed/seller_support_case_bank_v2.json`: realistic support case bank
- `seed/seller_intelligence_case_bank_v2.json`: realistic intelligence case bank

## How To Use This Pack
1. Use seller + ASIN files as canonical context entities.
2. Build prompt datasets by referencing `seller_id`, `asin`, and case IDs from case banks.
3. Use `case_weight` and `priority` fields to sample cases with realistic frequency distribution.
4. Keep `expected_good_response` and `failure_traps` to score model outputs consistently.
5. Extend with additional marketplaces (`US`, `CA`, `EU`) by preserving key fields and thresholds.

## Recommended Next Step
Create `datasets/seller-support-v2.json` and `datasets/seller-intelligence-v2.json` by selecting:
- 120 support cases (weighted by frequency and severity)
- 120 intelligence cases (weighted by business impact and complexity)

This gives a 240-case v2 eval suite that is more production-like than the current v1 prompt sets.

