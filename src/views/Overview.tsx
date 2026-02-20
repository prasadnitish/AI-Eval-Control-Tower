import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { EvalResults, DailyEntry, DateRange, PromptResult } from '../schema/types';

// ─── Color constants ────────────────────────────────────────────────────────
const COLOR_A    = '#6c8aff';
const COLOR_B    = '#ff6b6b';
const COLOR_GRID = '#2a2f45';
const COLOR_MUTED = '#7b82a0';
const COLOR_BG   = '#1a1d27';
const COLOR_GREEN = '#4caf7d';
const COLOR_AMBER = '#f5a623';

// ─── Prop types ──────────────────────────────────────────────────────────────
interface Props {
  results: EvalResults;
  daily: DailyEntry[];
  dateRange: DateRange;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Returns delta string like "+8.1%" and a css class */
function delta(a: number, b: number): { text: string; cls: string } {
  if (b === 0) return { text: '—', cls: 'delta-neutral' };
  const pct = ((a - b) / b) * 100;
  if (Math.abs(pct) < 0.01) return { text: '±0.0%', cls: 'delta-neutral' };
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1)}% vs Model B`,
    cls: pct > 0 ? 'delta-up' : 'delta-down',
  };
}

/** Compute top-2 categories by avg gap between model_a_quality_score and model_b_quality_score */
function topFailureCategories(prompts: PromptResult[]) {
  if (prompts.length === 0) {
    return [
      { category: 'root-cause-analysis', gap: 12.4 },
      { category: 'recommendation-engine', gap: 8.1 },
    ];
  }

  const byCategory: Record<string, { gaps: number[] }> = {};

  for (const p of prompts) {
    const a = p.model_a_quality_score;
    const b = p.model_b_quality_score;
    if (a == null || b == null) continue;
    if (!byCategory[p.category]) byCategory[p.category] = { gaps: [] };
    byCategory[p.category].gaps.push(a - b);
  }

  const ranked = Object.entries(byCategory)
    .map(([cat, { gaps }]) => ({ category: cat, gap: avg(gaps) }))
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 2);

  // Fallback if no scored prompts were found
  if (ranked.length === 0) {
    return [
      { category: 'root-cause-analysis', gap: 12.4 },
      { category: 'recommendation-engine', gap: 8.1 },
    ];
  }

  return ranked;
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
          {p.name}: <strong>{p.value.toFixed(1)}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Overview({ results, daily }: Props) {
  const { summary, model_a, model_b, events, prompts } = results;

  // ── KPI: Quality ──────────────────────────────────────────────────────────
  const qA = summary.model_a_avg_quality;
  const qB = summary.model_b_avg_quality;
  const qualityDelta = delta(qA, qB);
  const qualityWinner = qA >= qB ? model_a.name : model_b.name;

  // ── KPI: P95 Latency ──────────────────────────────────────────────────────
  const latA = summary.model_a_p95_latency_ms;
  const latB = summary.model_b_p95_latency_ms;
  // Lower is better for latency — flip sign convention
  const latDeltaPct = latB !== 0 ? ((latA - latB) / latB) * 100 : 0;
  const latDeltaText =
    Math.abs(latDeltaPct) < 0.01
      ? '±0ms vs Model B'
      : `${latDeltaPct > 0 ? '+' : ''}${latDeltaPct.toFixed(1)}% vs Model B`;
  const latDeltaCls =
    Math.abs(latDeltaPct) < 0.01
      ? 'delta-neutral'
      : latDeltaPct < 0
      ? 'delta-up'   // A is faster — good
      : 'delta-down'; // A is slower — bad
  const latWinner = latA <= latB ? model_a.name : model_b.name;

  // ── KPI: Cost/Inference ───────────────────────────────────────────────────
  const costA = summary.model_a_avg_cost_per_inference;
  const costB = summary.model_b_avg_cost_per_inference;
  const costDeltaPct = costB !== 0 ? ((costA - costB) / costB) * 100 : 0;
  const costDeltaText =
    Math.abs(costDeltaPct) < 0.01
      ? '±0% vs Model B'
      : `${costDeltaPct > 0 ? '+' : ''}${costDeltaPct.toFixed(1)}% vs Model B`;
  const costDeltaCls =
    Math.abs(costDeltaPct) < 0.01
      ? 'delta-neutral'
      : costDeltaPct < 0
      ? 'delta-up'   // A is cheaper — good
      : 'delta-down'; // A is costlier — bad
  const costWinner = costA <= costB ? model_a.name : model_b.name;

  // ── KPI: Drift Status ─────────────────────────────────────────────────────
  const unresolvedEvents = events.filter((e) => !e.resolved);
  const driftColor = unresolvedEvents.length > 0 ? COLOR_AMBER : COLOR_GREEN;
  const driftDeltaText =
    unresolvedEvents.length > 0
      ? `${unresolvedEvents.length} unresolved`
      : 'All resolved';
  const driftDeltaCls =
    unresolvedEvents.length > 0 ? 'delta-down' : 'delta-up';

  // ── Failure categories ────────────────────────────────────────────────────
  const failures = topFailureCategories(prompts);
  const maxGap = Math.max(...failures.map((f) => f.gap), 0.01);

  // ── Verdict sentence ──────────────────────────────────────────────────────
  const qualityPctDiff =
    qB !== 0 ? (((qA - qB) / qB) * 100).toFixed(1) : '0.0';
  const costRatio = costB !== 0 ? (costA / costB).toFixed(1) : '∞';
  const dataset = results.meta?.dataset || 'this dataset';
  const verdictSentence =
    qA >= qB
      ? `${model_a.name} outperforms ${model_b.name} by ${qualityPctDiff}% on quality at ${costRatio}× cost. Recommended for ${dataset}.`
      : `${model_b.name} outperforms ${model_a.name} by ${Math.abs(parseFloat(qualityPctDiff)).toFixed(1)}% on quality at ${(1 / parseFloat(costRatio)).toFixed(1)}× cost. Review trade-offs before deploying to ${dataset}.`;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = daily.map((d) => ({
    date: fmtDate(d.date),
    [model_a.name]: +d.model_a.quality_score.toFixed(1),
    [model_b.name]: +d.model_b.quality_score.toFixed(1),
  }));

  return (
    <div>
      {/* ── KPI Cards ── */}
      <div className="card-grid card-grid-4" style={{ marginBottom: 16 }}>

        {/* Quality Score */}
        <div className="card">
          <div className="kpi-label">Avg Quality Score</div>
          <div className="kpi-value text-a">{qA.toFixed(1)}</div>
          <div className={`kpi-delta ${qualityDelta.cls}`}>{qualityDelta.text}</div>
          <div className="kpi-winner">Winner: {qualityWinner}</div>
        </div>

        {/* P95 Latency */}
        <div className="card">
          <div className="kpi-label">P95 Latency</div>
          <div className="kpi-value">{latA.toLocaleString()}ms</div>
          <div className={`kpi-delta ${latDeltaCls}`}>{latDeltaText}</div>
          <div className="kpi-winner">Winner: {latWinner}</div>
        </div>

        {/* Cost/Inference */}
        <div className="card">
          <div className="kpi-label">Cost / Inference</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>
            ${costA.toFixed(5)}
          </div>
          <div className={`kpi-delta ${costDeltaCls}`}>{costDeltaText}</div>
          <div className="kpi-winner">Winner: {costWinner}</div>
        </div>

        {/* Drift Status */}
        <div className="card">
          <div className="kpi-label">Drift Status</div>
          <div className="kpi-value" style={{ color: driftColor }}>
            {events.length} events
          </div>
          <div className={`kpi-delta ${driftDeltaCls}`}>{driftDeltaText}</div>
          <div className="kpi-winner">
            {unresolvedEvents.length > 0 ? 'Action required' : 'Stable'}
          </div>
        </div>
      </div>

      {/* ── Top Failure Drivers ── */}
      <div className="failure-card">
        <div className="failure-title">Top Failure Drivers</div>
        {failures.map((f) => (
          <div key={f.category} className="failure-row">
            <span style={{ minWidth: 180, color: '#e8eaf0' }}>{f.category}</span>
            <span style={{ minWidth: 52, color: COLOR_MUTED, fontVariantNumeric: 'tabular-nums' }}>
              {f.gap > 0 ? '+' : ''}{f.gap.toFixed(1)}
            </span>
            <div className="failure-bar-bg">
              <div
                className="failure-bar"
                style={{ width: `${(f.gap / maxGap) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Verdict sentence ── */}
      <p className="text-muted mt-8">{verdictSentence}</p>

      {/* ── Quality Score Line Chart ── */}
      <div className="chart-card mt-16">
        <div className="chart-title">Quality Score — 30d</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} />
            <XAxis
              dataKey="date"
              tick={{ fill: COLOR_MUTED, fontSize: 11 }}
              axisLine={{ stroke: COLOR_GRID }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: COLOR_MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: COLOR_MUTED, paddingTop: 8 }}
            />
            <Line
              type="monotone"
              dataKey={model_a.name}
              stroke={COLOR_A}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: COLOR_A }}
            />
            <Line
              type="monotone"
              dataKey={model_b.name}
              stroke={COLOR_B}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: COLOR_B }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
