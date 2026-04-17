import type { EvalResults } from '../schema/types';

import sproutrouteFull from './sproutroute-full.json';
import sellerV3 from './seller-intelligence-v3.json';
import placeholder from './placeholder.json';

export interface BakedResult {
  key: string;
  label: string;
  dataset: string;
  description: string;
  data: EvalResults;
}

// Registry of pre-baked eval results the user can browse without uploading a file.
// Order = UI order; first item is the default view.
export const BAKED_RESULTS: BakedResult[] = [
  {
    key: 'sproutroute-full',
    label: 'SproutRoute — 7 models, 25 prompts',
    dataset: 'sproutroute-v2',
    description: 'Full family-trip-planning suite across Claude Sonnet 4.6, Claude Haiku 4.5, GPT-5 Mini, GPT-5 Nano, Grok 4 Fast, Gemini 2.5 Flash, and DeepSeek-V3.2. Caught Haiku 4.5 (current production) below the 8.0 safety floor.',
    data: sproutrouteFull as unknown as EvalResults,
  },
  {
    key: 'seller-intelligence-v3',
    label: 'Seller Intelligence v3 — hard-eval, 2 models',
    dataset: 'seller-intelligence-v3',
    description: '24-prompt AM advisory hard-eval with medium/hard cases from the dataset-brainstorm-v3 seed bank. Claude Sonnet 4.6 vs GPT-5 Mini — Mini edged Sonnet on quality at 1/5 the cost.',
    data: sellerV3 as unknown as EvalResults,
  },
  {
    key: 'legacy-demo',
    label: 'Legacy demo (Feb 2026)',
    dataset: 'seller-intelligence-v1',
    description: 'Original 2-model pairwise demo (Claude Sonnet 4.6 vs DeepSeek-V3). Kept for reference to show the v1 shape of the tool.',
    data: placeholder as unknown as EvalResults,
  },
];

export function getDefault(): BakedResult {
  return BAKED_RESULTS[0];
}

export function findByKey(key: string): BakedResult | undefined {
  return BAKED_RESULTS.find(r => r.key === key);
}
