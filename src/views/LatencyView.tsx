import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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

// ─── Prop types ───────────────────────────────────────────────────────────────
interface Props {
  results: EvalResults;
  daily: DailyEntry[];
  dateRange: DateRange;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMs(ms: number): string {
  return `${Math.round(ms).toLocaleString()}ms`;
}

function pctDelta(a: number, b: number): string {
  if (b === 0) return '—';
  const pct = ((a - b) / b) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function pctDeltaNum(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
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
          {p.name}: <strong>{Math.round(p.value).toLocaleString()}ms</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LatencyView({ results, daily }: Props) {
  const { summary, model_a, model_b } = results;

  // Use last daily entry for the bar chart; fall back to summary if daily is empty
  const lastEntry = daily.length > 0 ? daily[daily.length - 1] : null;

  const p50A = lastEntry ? lastEntry.model_a.latency_p50 : summary.model_a_p50_latency_ms;
  const p95A = lastEntry ? lastEntry.model_a.latency_p95 : summary.model_a_p95_latency_ms;
  const p99A = lastEntry ? lastEntry.model_a.latency_p99 : summary.model_a_p99_latency_ms;
  const p50B = lastEntry ? lastEntry.model_b.latency_p50 : summary.model_b_p50_latency_ms;
  const p95B = lastEntry ? lastEntry.model_b.latency_p95 : summary.model_b_p95_latency_ms;
  const p99B = lastEntry ? lastEntry.model_b.latency_p99 : summary.model_b_p99_latency_ms;

  // Bar chart data — grouped by percentile
  const barData = [
    { percentile: 'P50', [model_a.name]: p50A, [model_b.name]: p50B },
    { percentile: 'P95', [model_a.name]: p95A, [model_b.name]: p95B },
    { percentile: 'P99', [model_a.name]: p99A, [model_b.name]: p99B },
  ];

  // Long-tail risk annotation
  const p99Delta = pctDeltaNum(p99B, p99A);
  const exceedPct = ((p99B / (p99A || 1)) * 1).toFixed(0); // rough proxy
  // Requests exceeding 4000ms: approximate fraction based on p99 > 4000
  const inferPerDay = 10000;
  const exceedThreshold = 4000;
  // If B P99 > 4s, roughly 1% of requests exceed threshold (by definition of p99)
  // We compute how many that is per day
  const exceedsPerDay = p99B > exceedThreshold ? Math.round(inferPerDay * 0.01) : 0;
  const exceedsPct = p99B > exceedThreshold ? 1 : 0;

  // Table rows
  const rows: Array<{
    label: string;
    valA: number;
    valB: number;
  }> = [
    { label: 'P50', valA: p50A, valB: p50B },
    { label: 'P95', valA: p95A, valB: p95B },
    { label: 'P99', valA: p99A, valB: p99B },
  ];

  return (
    <div>
      {/* ── 1. Grouped Bar Chart ── */}
      <div className="chart-card">
        <div className="chart-title">
          Latency Distribution — P50 / P95 / P99
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={barData}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} vertical={false} />
            <XAxis
              dataKey="percentile"
              tick={{ fill: COLOR_MUTED, fontSize: 12 }}
              axisLine={{ stroke: COLOR_GRID }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
              tick={{ fill: COLOR_MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
              label={{
                value: 'ms',
                angle: -90,
                position: 'insideLeft',
                fill: COLOR_MUTED,
                fontSize: 11,
                dx: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: COLOR_MUTED, paddingTop: 8 }}
            />
            <Bar
              dataKey={model_a.name}
              fill={COLOR_A}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={model_b.name}
              fill={COLOR_B}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 2. Long-tail Risk Callout ── */}
      <div className="card mt-16">
        <div className="section-title">Long-tail Risk</div>
        <p style={{ fontSize: 13, color: COLOR_MUTED, lineHeight: 1.7 }}>
          {model_b.name} P99 latency is{' '}
          <span className="text-amber">
            {Math.abs(p99Delta).toFixed(1)}% {p99Delta > 0 ? 'higher' : 'lower'}
          </span>{' '}
          than {model_a.name}&apos;s P99 (
          <span className="text-amber">{fmtMs(p99B)}</span> vs{' '}
          <span className="text-a">{fmtMs(p99A)}</span>).{' '}
          At {inferPerDay.toLocaleString()} inferences/day, approximately{' '}
          <span className="text-amber">{exceedsPct}%</span> of requests will
          exceed {fmtMs(exceedThreshold)}
          {exceedsPerDay > 0 ? ` (~${exceedsPerDay.toLocaleString()} requests/day)` : ''}.
          {p99B > exceedThreshold
            ? ' Recommended to set a 4s timeout with graceful fallback.'
            : ` ${model_b.name} P99 is within the 4s threshold — no timeout risk detected.`}
        </p>
      </div>

      {/* ── 3. Summary Metric Table ── */}
      <div className="card mt-16">
        <div className="section-title">Latency Summary</div>
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
            {rows.map(({ label, valA, valB }) => {
              const d = pctDelta(valB, valA); // positive = B is worse (slower)
              const bIsWorse = valB > valA;
              const deltaCls = bIsWorse ? 'text-amber' : 'text-green';
              const winnerName = valA <= valB ? model_a.name : model_b.name;
              const winnerCls = valA <= valB ? 'winner-a' : 'winner-b';
              return (
                <tr key={label}>
                  <td style={{ color: '#e8eaf0', fontWeight: 500 }}>{label}</td>
                  <td className="mono text-a">{fmtMs(valA)}</td>
                  <td className="mono text-b">{fmtMs(valB)}</td>
                  <td className={`mono ${deltaCls}`}>{d}</td>
                  <td className={winnerCls}>{winnerName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
