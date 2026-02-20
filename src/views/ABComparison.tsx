import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { EvalResults, DailyEntry, DateRange } from '../schema/types';

// ─── Color constants ──────────────────────────────────────────────────────────
const COLOR_A    = '#6c8aff';
const COLOR_B    = '#ff6b6b';
const COLOR_GRID = '#2a2f45';
const COLOR_MUTED = '#7b82a0';
const COLOR_BG   = '#1a1d27';
const COLOR_GREEN = '#4caf7d';

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

function fmtCostInference(v: number): string {
  return `$${v.toFixed(5)}`;
}

function pctDelta(a: number, b: number): string {
  if (b === 0) return '—';
  const pct = ((a - b) / b) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Custom Radar Tooltip ─────────────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function RadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: COLOR_BG,
        border: `1px solid ${COLOR_GRID}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <div style={{ color: COLOR_MUTED, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Verdict logic ────────────────────────────────────────────────────────────
function computeVerdict(
  qualityA: number,
  qualityB: number,
  latA: number,
  latB: number,
  costA: number,
  costB: number,
  violations: number,
): 'go' | 'conditional' | 'nogo' {
  if (violations > 0) return 'nogo';
  // Model A clearly better on quality
  const qualityWin = qualityA > qualityB;
  // A is faster (lower latency = better)
  const latencyWin = latA <= latB;
  // B is cheaper (expected)
  if (qualityWin && latencyWin) return 'go';
  if (qualityWin) return 'conditional';
  return 'nogo';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ABComparison({ results, daily }: Props) {
  const { summary, model_a, model_b, meta } = results;

  // Use last daily entry for dimension scores; fall back to summary averages
  const lastEntry = daily.length > 0 ? daily[daily.length - 1] : null;

  const scoresA = lastEntry
    ? lastEntry.model_a.scores
    : { relevance: 0, accuracy: 0, actionability: 0, coherence: 0, conciseness: 0 };
  const scoresB = lastEntry
    ? lastEntry.model_b.scores
    : { relevance: 0, accuracy: 0, actionability: 0, coherence: 0, conciseness: 0 };

  // Radar data
  const radarData = [
    { dimension: 'Relevance',     [model_a.name]: scoresA.relevance,     [model_b.name]: scoresB.relevance },
    { dimension: 'Accuracy',      [model_a.name]: scoresA.accuracy,      [model_b.name]: scoresB.accuracy },
    { dimension: 'Actionability', [model_a.name]: scoresA.actionability, [model_b.name]: scoresB.actionability },
    { dimension: 'Coherence',     [model_a.name]: scoresA.coherence,     [model_b.name]: scoresB.coherence },
    { dimension: 'Conciseness',   [model_a.name]: scoresA.conciseness,   [model_b.name]: scoresB.conciseness },
  ];

  // Summary values
  const qualityA  = summary.model_a_avg_quality;
  const qualityB  = summary.model_b_avg_quality;
  const p50A      = summary.model_a_p50_latency_ms;
  const p95A      = summary.model_a_p95_latency_ms;
  const p50B      = summary.model_b_p50_latency_ms;
  const p95B      = summary.model_b_p95_latency_ms;
  const costA     = summary.model_a_avg_cost_per_inference;
  const costB     = summary.model_b_avg_cost_per_inference;
  const violations = summary.policy_violations;

  // Head-to-head table rows
  type Row = {
    label: string;
    valAStr: string;
    valBStr: string;
    deltaStr: string;
    aWins: boolean; // true = A wins (lower for latency/cost, higher for quality)
  };

  const tableRows: Row[] = [
    {
      label: 'Avg Quality',
      valAStr: fmtQuality(qualityA),
      valBStr: fmtQuality(qualityB),
      deltaStr: pctDelta(qualityA, qualityB),
      aWins: qualityA >= qualityB,
    },
    {
      label: 'P50 Latency',
      valAStr: fmtLatency(p50A),
      valBStr: fmtLatency(p50B),
      deltaStr: pctDelta(p50B, p50A), // positive = B is worse
      aWins: p50A <= p50B,
    },
    {
      label: 'P95 Latency',
      valAStr: fmtLatency(p95A),
      valBStr: fmtLatency(p95B),
      deltaStr: pctDelta(p95B, p95A),
      aWins: p95A <= p95B,
    },
    {
      label: 'Cost / Inference',
      valAStr: fmtCostInference(costA),
      valBStr: fmtCostInference(costB),
      deltaStr: pctDelta(costA, costB),
      aWins: costA <= costB,
    },
    {
      label: 'Policy Violations',
      valAStr: String(violations),
      valBStr: '—',
      deltaStr: '—',
      aWins: violations === 0,
    },
  ];

  // Verdict
  const verdictKey = computeVerdict(qualityA, qualityB, p95A, p95B, costA, costB, violations);

  const qualityDiff = (qualityA - qualityB).toFixed(1);
  const costRatio = costB > 0 ? (costA / costB).toFixed(1) : '∞';
  const latencyWinner = p95A <= p95B ? model_a.name : model_b.name;

  const verdictLabel =
    verdictKey === 'go'
      ? 'GO'
      : verdictKey === 'conditional'
      ? 'CONDITIONAL GO'
      : 'NO-GO';

  const verdictDesc =
    verdictKey === 'nogo' && violations > 0
      ? `${model_a.name} triggered ${violations} policy violation(s). NO-GO regardless of other metrics. Resolve violations before release.`
      : `${model_a.name} leads on quality (+${qualityDiff} pts) and ${latencyWinner === model_a.name ? 'latency' : 'quality'}. ${model_b.name} is ${costRatio}x cheaper per inference. Recommendation: use ${model_a.name} for complex strategic tasks (Seller Intelligence), ${model_b.name} for high-volume structured tasks (Seller Support).`;

  const dataset = meta?.dataset || 'Dataset';

  return (
    <div>
      {/* ── Verdict Banner ── */}
      <div className={`verdict-card ${verdictKey}`}>
        <div>
          <div className={`verdict-badge ${verdictKey}`}>{verdictLabel}</div>
        </div>
        <div className="verdict-desc">{verdictDesc}</div>
      </div>

      {/* ── 1. Radar Chart ── */}
      <div className="chart-card">
        <div className="chart-title">
          Dimension Comparison — {dataset}
        </div>
        {!lastEntry ? (
          <div className="empty-state">No daily data available for radar chart.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
              <PolarGrid stroke={COLOR_GRID} />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: COLOR_MUTED, fontSize: 12 }}
              />
              <PolarRadiusAxis
                domain={[0, 10]}
                tick={{ fill: COLOR_MUTED, fontSize: 10 }}
                axisLine={false}
                tickCount={4}
              />
              <Tooltip content={<RadarTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: COLOR_MUTED, paddingTop: 8 }}
              />
              <Radar
                name={model_a.name}
                dataKey={model_a.name}
                stroke={COLOR_A}
                fill={COLOR_A}
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Radar
                name={model_b.name}
                dataKey={model_b.name}
                stroke={COLOR_B}
                fill={COLOR_B}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 2. Head-to-Head Metric Table ── */}
      <div className="card mt-16">
        <div className="section-title">Head-to-Head Metrics</div>
        <table className="metric-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{model_a.name}</th>
              <th>{model_b.name}</th>
              <th>Delta</th>
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const winnerName = row.aWins ? model_a.name : model_b.name;
              const winnerCls  = row.aWins ? 'winner-a' : 'winner-b';
              // For delta coloring: quality — positive delta is good for A; latency/cost — positive is bad for A
              const isQuality = row.label === 'Avg Quality';
              const deltaNum = parseFloat(row.deltaStr);
              let deltaCls = 'text-muted';
              if (!isNaN(deltaNum)) {
                if (isQuality) {
                  deltaCls = deltaNum > 0 ? 'text-green' : 'text-red';
                } else {
                  deltaCls = deltaNum > 0 ? 'text-amber' : 'text-green';
                }
              }
              return (
                <tr key={row.label}>
                  <td style={{ color: '#e8eaf0', fontWeight: 500 }}>{row.label}</td>
                  <td className="mono text-a">{row.valAStr}</td>
                  <td className="mono text-b">{row.valBStr}</td>
                  <td className={`mono ${deltaCls}`}>{row.deltaStr}</td>
                  <td className={winnerCls}>{winnerName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Drift status note ── */}
      {results.events.length > 0 && (
        <div className="card mt-16">
          <div className="section-title">Drift Events</div>
          <div className="event-strip">
            <span className="event-strip-label">Events</span>
            {results.events.map((ev, i) => (
              <div key={i} className={`event-chip ${ev.resolved ? 'resolved' : 'open'}`}>
                {ev.resolved ? '✓' : '!'} {ev.label}
              </div>
            ))}
          </div>
          {results.events.filter(e => !e.resolved).length > 0 && (
            <p style={{ fontSize: 12, color: COLOR_MUTED, marginTop: 8 }}>
              <span className="text-amber">
                {results.events.filter(e => !e.resolved).length} unresolved
              </span>{' '}
              drift event(s) detected. Review before release.
            </p>
          )}
          {results.events.filter(e => !e.resolved).length === 0 && (
            <p style={{ fontSize: 12, color: COLOR_GREEN, marginTop: 8 }}>
              All drift events resolved.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
