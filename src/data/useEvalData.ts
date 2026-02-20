import { useState, useCallback } from 'react';
import { EvalResults, DateRange } from '../schema/types';

// Validate that an uploaded file conforms to the expected schema
export function validateSchema(data: unknown): data is EvalResults {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!d.meta || !d.model_a || !d.model_b) return false;
  if (!Array.isArray(d.daily) || d.daily.length === 0) return false;
  if (!Array.isArray(d.events)) return false;
  if (!Array.isArray(d.prompts)) return false;
  const day = (d.daily as Record<string, unknown>[])[0];
  if (!day.model_a || !day.model_b) return false;
  return true;
}

export function filterByDateRange(daily: EvalResults['daily'], range: DateRange) {
  const days = range === '7d' ? 7 : range === '14d' ? 14 : 30;
  return daily.slice(-days);
}

export function useEvalData(initial: EvalResults) {
  const [results, setResults] = useState<EvalResults>(initial);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadFile = useCallback((file: File) => {
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!validateSchema(parsed)) {
          setUploadError('Invalid schema: file must include meta, model_a, model_b, daily[], events[], and prompts[].');
          return;
        }
        setResults(parsed as EvalResults);
        setCustomLabel(file.name);
      } catch {
        setUploadError('Failed to parse JSON. Make sure the file is valid JSON.');
      }
    };
    reader.readAsText(file);
  }, []);

  const reset = useCallback((original: EvalResults) => {
    setResults(original);
    setCustomLabel(null);
    setUploadError(null);
  }, []);

  return { results, customLabel, uploadError, loadFile, reset };
}
