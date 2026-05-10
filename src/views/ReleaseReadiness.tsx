import { useState } from 'react';
import { EvalResults, DailyEntry, DateRange, Verdict } from '../schema/types';

// ─── Color constants ──────────────────────────────────────────────────────────
const COLOR_MUTED = '#7b82a0';
const COLOR_GREEN = '#4caf7d';
const COLOR_RED   = '#e74c3c';
const COLOR_AMBER = '#f5a623';

// ─── Prop types ───────────────────────────────────────────────────────────────
interface Props {
  results: EvalResults;
  daily: DailyEntry[];
  dateRange: DateRange;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtQuality(v: number): string {
  return v.toFixed(1);
}

function fmtLatency(ms: number): string {
  return `${Math.round(ms).toLocaleString()}ms`;
}

function fmtCostFull(v: number): string {
  return `$${v.toFixed(5)}`;
}

function getSafetyScore(results: EvalResults): number | null {
  const perModel = results.per_model || results.summary?.per_model;
  const baselineSlug = results.meta?.baseline || results.model_a?.version;
  const baseline = baselineSlug ? perModel?.[baselineSlug] : undefined;
  const score = baseline?.dimension_averages?.safety;
  return typeof score === 'number' ? score : null;
}

// ─── Verdict computation ──────────────────────────────────────────────────────
function computeVerdict(
  avgQualityA: number,
  p95LatencyA: number,
  costA: number,
  violations: number,
  safetyScore: number | null,
  hasUnresolvedEvents: boolean,
  accuracyMin: number,
  latencyMax: number,
  costMax: number,
  allowDrift: boolean,
): { verdict: Verdict; verdictKey: 'go' | 'conditional' | 'nogo'; reason: string } {
  // Hard NO-GO conditions
  if (safetyScore !== null && safetyScore < 8) {
    return {
      verdict: 'NO-GO',
      verdictKey: 'nogo',
      reason: `Safety score ${safetyScore.toFixed(2)} is below the 8.0 hard floor. Model not ready for production release.`,
    };
  }
  if (safetyScore === null && violations > 0) {
    return {
      verdict: 'NO-GO',
      verdictKey: 'nogo',
      reason: `Safety hard floor triggered: ${violations} policy violation(s) detected. NO-GO regardless of other criteria.`,
    };
  }
  if (avgQualityA < accuracyMin * 1.0 && avgQualityA < accuracyMin) {
    // Hard failure: quality is below minimum (not within 20% tolerance)
    const hardFail = avgQualityA < accuracyMin * 0.8;
    if (hardFail) {
      return {
        verdict: 'NO-GO',
        verdictKey: 'nogo',
        reason: `Quality score ${fmtQuality(avgQualityA)} is critically below the minimum threshold of ${fmtQuality(accuracyMin)} (>${((accuracyMin - avgQualityA) / accuracyMin * 100).toFixed(1)}% gap). Model not ready for production.`,
      };
    }
  }
  if (p95LatencyA > latencyMax * 1.2) {
    return {
      verdict: 'NO-GO',
      verdictKey: 'nogo',
      reason: `P95 latency ${fmtLatency(p95LatencyA)} exceeds the hard ceiling of ${fmtLatency(Math.round(latencyMax * 1.2))} (120% of ${fmtLatency(latencyMax)} threshold). Unacceptable tail latency.`,
    };
  }
  if (costA > costMax * 1.3) {
    return {
      verdict: 'NO-GO',
      verdictKey: 'nogo',
      reason: `Cost/inference ${fmtCostFull(costA)} exceeds hard ceiling of ${fmtCostFull(costMax * 1.3)} (130% of ${fmtCostFull(costMax)} threshold). Economics do not support release.`,
    };
  }
  if (!allowDrift && hasUnresolvedEvents) {
    return {
      verdict: 'NO-GO',
      verdictKey: 'nogo',
      reason: `Unresolved drift events detected and drift tolerance is disabled. Resolve all drift events or enable drift tolerance to proceed.`,
    };
  }

  // Soft CONDITIONAL GO conditions
  const softIssues: string[] = [];
  if (avgQualityA < accuracyMin) {
    softIssues.push(`quality score ${fmtQuality(avgQualityA)} is below target ${fmtQuality(accuracyMin)}`);
  }
  if (p95LatencyA > latencyMax) {
    softIssues.push(`P95 latency ${fmtLatency(p95LatencyA)} exceeds ${fmtLatency(latencyMax)}`);
  }
  if (costA > costMax) {
    softIssues.push(`cost/inference ${fmtCostFull(costA)} exceeds ${fmtCostFull(costMax)}`);
  }
  if (!allowDrift && hasUnresolvedEvents) {
    softIssues.push('unresolved drift events exist');
  }

  if (softIssues.length > 0) {
    return {
      verdict: 'CONDITIONAL GO',
      verdictKey: 'conditional',
      reason: `Soft gate failures: ${softIssues.join('; ')}. Release with monitoring and defined rollback criteria.`,
    };
  }

  return {
    verdict: 'GO',
    verdictKey: 'go',
    reason: `All gate criteria passed. Quality, latency, cost, and drift status are within acceptable thresholds. Model is ready for production release.`,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReleaseReadiness({ results }: Props) {
  const { summary, model_a, events } = results;

  const avgQualityA  = summary.model_a_avg_quality;
  const p95LatencyA  = summary.model_a_p95_latency_ms;
  const costA        = summary.model_a_avg_cost_per_inference;
  const violations   = summary.policy_violations;
  const safetyScore  = getSafetyScore(results);
  const hasSafetyFloor = safetyScore !== null;

  const unresolvedEvents = events.filter((e) => !e.resolved);
  const hasUnresolvedEvents = unresolvedEvents.length > 0;

  // SproutRoute runs use a 15s trip-planning p95 ceiling and a safety hard floor.
  const [accuracyMin, setAccuracyMin]   = useState(80);
  const [latencyMax, setLatencyMax]     = useState(hasSafetyFloor ? 15000 : 3000);
  const [costMax, setCostMax]           = useState(hasSafetyFloor ? 0.0065 : 0.005);
  const [allowDrift, setAllowDrift]     = useState(false);

  // ── Compute verdict ───────────────────────────────────────────────────────
  const { verdict, verdictKey, reason } = computeVerdict(
    avgQualityA,
    p95LatencyA,
    costA,
    violations,
    safetyScore,
    hasUnresolvedEvents,
    accuracyMin,
    latencyMax,
    costMax,
    allowDrift,
  );

  // ── Checklist items ───────────────────────────────────────────────────────
  const qualityPass = avgQualityA >= accuracyMin;
  const qualityDelta = (avgQualityA - accuracyMin).toFixed(1);

  const latencyPass = p95LatencyA <= latencyMax;
  const latencyDeltaMs = Math.round(p95LatencyA - latencyMax);

  const costPass = costA <= costMax;
  const costDeltaVal = (costA - costMax).toFixed(5);

  const violationsPass = violations === 0;
  const safetyPass = safetyScore === null || safetyScore >= 8;

  const driftPass = allowDrift || !hasUnresolvedEvents;

  return (
    <div>
      {/* ── 1. Interactive Sliders ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Gate Thresholds</div>

        {/* Quality / Accuracy Minimum */}
        <div className="slider-row">
          <span className="slider-label">Min Quality Score</span>
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={accuracyMin}
            onChange={(e) => setAccuracyMin(Number(e.target.value))}
          />
          <span className="slider-value">{accuracyMin} / 100</span>
        </div>

        {/* P95 Latency Max */}
        <div className="slider-row">
          <span className="slider-label">Max P95 Latency</span>
          <input
            type="range"
            min={1000}
            max={hasSafetyFloor ? 60000 : 6000}
            step={100}
            value={latencyMax}
            onChange={(e) => setLatencyMax(Number(e.target.value))}
          />
          <span className="slider-value">{latencyMax.toLocaleString()}ms</span>
        </div>

        {/* Cost Ceiling */}
        <div className="slider-row">
          <span className="slider-label">Max Cost / Inference</span>
          <input
            type="range"
            min={0.001}
            max={0.01}
            step={0.0001}
            value={costMax}
            onChange={(e) => setCostMax(Number(e.target.value))}
          />
          <span className="slider-value">${costMax.toFixed(4)}</span>
        </div>

        {/* Allow Drift Toggle */}
        <div className="slider-row">
          <span className="slider-label">Active Drift Events</span>
          <div style={{ flex: 1 }}>
            <button
              className={`badge-btn${allowDrift ? ' active' : ''}`}
              onClick={() => setAllowDrift((v) => !v)}
            >
              {allowDrift ? 'Drift Tolerated' : 'Drift Blocked'}
            </button>
            {hasUnresolvedEvents && (
              <span style={{ marginLeft: 10, fontSize: 12, color: COLOR_AMBER }}>
                {unresolvedEvents.length} unresolved
              </span>
            )}
            {!hasUnresolvedEvents && (
              <span style={{ marginLeft: 10, fontSize: 12, color: COLOR_GREEN }}>
                No active drift
              </span>
            )}
          </div>
          <span className="slider-value" style={{ color: allowDrift ? COLOR_GREEN : COLOR_MUTED }}>
            {allowDrift ? 'Allow' : 'Block'}
          </span>
        </div>
      </div>

      {/* ── 2. Real-time Verdict ── */}
      <div className={`verdict-card ${verdictKey}`}>
        <div style={{ minWidth: 180 }}>
          <div className={`verdict-badge ${verdictKey}`}>{verdict}</div>
          <div style={{ fontSize: 11, color: COLOR_MUTED, marginTop: 4 }}>
            {model_a.name}
          </div>
        </div>
        <div className="verdict-desc">{reason}</div>
      </div>

      {/* ── 3. Pass/Fail Checklist ── */}
      <div className="card mt-16">
        <div className="section-title">Gate Criteria</div>
        <ul className="checklist">

          {/* Quality Score */}
          <li className="check-item">
            <span className={`check-icon ${qualityPass ? 'text-green' : 'text-red'}`}>
              {qualityPass ? '✓' : '✗'}
            </span>
            <span>
              <span style={{ color: '#e8eaf0' }}>Quality Score: </span>
              <span className="mono" style={{ color: qualityPass ? COLOR_GREEN : COLOR_RED }}>
                {fmtQuality(avgQualityA)}
              </span>
              <span className="text-muted"> / min {fmtQuality(accuracyMin)}</span>
              {!qualityPass && (
                <span style={{ color: COLOR_RED, marginLeft: 8, fontSize: 12 }}>
                  Delta to pass: +{Math.abs(parseFloat(qualityDelta)).toFixed(1)} pts needed
                </span>
              )}
            </span>
          </li>

          {/* P95 Latency */}
          <li className="check-item">
            <span className={`check-icon ${latencyPass ? 'text-green' : 'text-red'}`}>
              {latencyPass ? '✓' : '✗'}
            </span>
            <span>
              <span style={{ color: '#e8eaf0' }}>P95 Latency: </span>
              <span className="mono" style={{ color: latencyPass ? COLOR_GREEN : COLOR_RED }}>
                {fmtLatency(p95LatencyA)}
              </span>
              <span className="text-muted"> / max {fmtLatency(latencyMax)}</span>
              {!latencyPass && (
                <span style={{ color: COLOR_RED, marginLeft: 8, fontSize: 12 }}>
                  Delta to pass: reduce by {fmtLatency(Math.abs(latencyDeltaMs))}
                </span>
              )}
            </span>
          </li>

          {/* Cost per Inference */}
          <li className="check-item">
            <span className={`check-icon ${costPass ? 'text-green' : 'text-red'}`}>
              {costPass ? '✓' : '✗'}
            </span>
            <span>
              <span style={{ color: '#e8eaf0' }}>Cost / Inference: </span>
              <span className="mono" style={{ color: costPass ? COLOR_GREEN : COLOR_RED }}>
                {fmtCostFull(costA)}
              </span>
              <span className="text-muted"> / max {fmtCostFull(costMax)}</span>
              {!costPass && (
                <span style={{ color: COLOR_RED, marginLeft: 8, fontSize: 12 }}>
                  Delta to pass: reduce by ${Math.abs(parseFloat(costDeltaVal)).toFixed(5)}
                </span>
              )}
            </span>
          </li>

          {/* Safety / Policy hard floor */}
          <li className="check-item">
            <span className={`check-icon ${hasSafetyFloor ? safetyPass ? 'text-green' : 'text-red' : violationsPass ? 'text-green' : 'text-red'}`}>
              {hasSafetyFloor ? safetyPass ? '✓' : '✗' : violationsPass ? '✓' : '✗'}
            </span>
            {hasSafetyFloor ? (
              <span>
                <span style={{ color: '#e8eaf0' }}>Safety Score: </span>
                <span className="mono" style={{ color: safetyPass ? COLOR_GREEN : COLOR_RED }}>
                  {safetyScore.toFixed(2)}
                </span>
                <span className="text-muted"> / min 8.00</span>
                {!safetyPass && (
                  <span style={{ color: COLOR_RED, marginLeft: 8, fontSize: 12 }}>
                    Delta to pass: +{(8 - safetyScore).toFixed(2)} pts needed
                  </span>
                )}
              </span>
            ) : (
              <span>
                <span style={{ color: '#e8eaf0' }}>Policy Violations: </span>
                <span className="mono" style={{ color: violationsPass ? COLOR_GREEN : COLOR_RED }}>
                  {violations}
                </span>
                <span className="text-muted"> / max 0</span>
                {!violationsPass && (
                <span style={{ color: COLOR_RED, marginLeft: 8, fontSize: 12 }}>
                  Safety hard floor — must be 0 to proceed
                </span>
                )}
              </span>
            )}
          </li>

          {/* Drift Status */}
          <li className="check-item">
            <span className={`check-icon ${driftPass ? 'text-green' : 'text-red'}`}>
              {driftPass ? '✓' : '✗'}
            </span>
            <span>
              <span style={{ color: '#e8eaf0' }}>Drift Status: </span>
              <span
                className="mono"
                style={{ color: driftPass ? COLOR_GREEN : COLOR_RED }}
              >
                {unresolvedEvents.length} unresolved / {events.length} total
              </span>
              {!driftPass && (
                <span style={{ color: COLOR_RED, marginLeft: 8, fontSize: 12 }}>
                  Delta to pass: resolve {unresolvedEvents.length} event(s) or enable drift tolerance
                </span>
              )}
              {driftPass && hasUnresolvedEvents && allowDrift && (
                <span style={{ color: COLOR_AMBER, marginLeft: 8, fontSize: 12 }}>
                  Drift tolerated — monitor closely
                </span>
              )}
            </span>
          </li>

        </ul>
      </div>

      {/* ── 4. Safety Hard Floor Note ── */}
      <div className="card mt-16">
        {hasSafetyFloor && !safetyPass ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, color: COLOR_RED, flexShrink: 0 }}>✗</span>
            <div>
              <div style={{ fontWeight: 600, color: COLOR_RED, fontSize: 13, marginBottom: 4 }}>
                Safety Hard Floor Active
              </div>
              <p style={{ fontSize: 13, color: COLOR_RED, lineHeight: 1.6 }}>
                Safety score {safetyScore.toFixed(2)} is below the 8.0 hard floor.
                This model should not continue serving SproutRoute traffic until the safety failure is resolved or a safer candidate is promoted.
              </p>
            </div>
          </div>
        ) : !hasSafetyFloor && violations > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, color: COLOR_RED, flexShrink: 0 }}>✗</span>
            <div>
              <div style={{ fontWeight: 600, color: COLOR_RED, fontSize: 13, marginBottom: 4 }}>
                Safety Hard Floor Active
              </div>
              <p style={{ fontSize: 13, color: COLOR_RED, lineHeight: 1.6 }}>
                {violations} policy violation(s) detected. NO-GO regardless of other criteria.
                All policy violations must be resolved before this model can proceed to production.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: COLOR_GREEN }}>✓</span>
            <p style={{ fontSize: 13, color: COLOR_GREEN }}>
              Safety floor: Hard floor constraint satisfied.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
