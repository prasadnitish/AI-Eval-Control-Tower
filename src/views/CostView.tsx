import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
function fmtCost(v: number): string {
  return `$${v.toFixed(5)}`;
}

function fmtMoney(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          {p.name}: <strong>${p.value.toFixed(5)}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CostView({ results, daily }: Props) {
  const { summary, model_a, model_b } = results;

  const [inferencesPerDay, setInferencesPerDay] = useState(10000);

  // ── Area chart data ────────────────────────────────────────────────────────
  const areaData = daily.map((d) => ({
    date: fmtDate(d.date),
    [model_a.name]: d.model_a.cost_per_inference,
    [model_b.name]: d.model_b.cost_per_inference,
  }));

  // ── Savings calculator ────────────────────────────────────────────────────
  const costA = summary.model_a_avg_cost_per_inference;
  const costB = summary.model_b_avg_cost_per_inference;

  const monthlyA = costA * inferencesPerDay * 30;
  const monthlyB = costB * inferencesPerDay * 30;
  const saving = monthlyA - monthlyB;
  const savingPct = monthlyA > 0 ? ((saving / monthlyA) * 100).toFixed(1) : '0.0';

  // ── Break-even callout ────────────────────────────────────────────────────
  const costRatio = costB > 0 ? costA / costB : 0;
  const qualityA = summary.model_a_avg_quality;
  const qualityB = summary.model_b_avg_quality;
  const qualityGap = qualityA - qualityB;
  const qualityGapPct = qualityB > 0 ? ((qualityGap / qualityB) * 100).toFixed(1) : '0.0';
  const breakEvenThreshold = (qualityA - qualityGap / 2).toFixed(1);

  return (
    <div>
      {/* ── 1. Area Chart ── */}
      <div className="chart-card">
        <div className="chart-title">Cost per Inference — Daily</div>
        {daily.length === 0 ? (
          <div className="empty-state">No daily data available for the selected range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={areaData}
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR_A} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLOR_A} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR_B} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLOR_B} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: COLOR_MUTED, fontSize: 11 }}
                axisLine={{ stroke: COLOR_GRID }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                tick={{ fill: COLOR_MUTED, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={58}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={model_a.name}
                stroke={COLOR_A}
                strokeWidth={2}
                fill="url(#fillA)"
                dot={false}
                activeDot={{ r: 4, fill: COLOR_A }}
              />
              <Area
                type="monotone"
                dataKey={model_b.name}
                stroke={COLOR_B}
                strokeWidth={2}
                fill="url(#fillB)"
                dot={false}
                activeDot={{ r: 4, fill: COLOR_B }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 2. Savings Calculator ── */}
      <div className="card mt-16">
        <div className="section-title">Monthly Savings Calculator</div>

        <div className="slider-row">
          <span className="slider-label">Inferences per day</span>
          <input
            type="range"
            min={1000}
            max={100000}
            step={1000}
            value={inferencesPerDay}
            onChange={(e) => setInferencesPerDay(Number(e.target.value))}
          />
          <span className="slider-value">{inferencesPerDay.toLocaleString()}</span>
        </div>

        <p style={{ fontSize: 12, color: COLOR_MUTED, marginBottom: 16 }}>
          At <strong style={{ color: '#e8eaf0' }}>{inferencesPerDay.toLocaleString()}</strong> inferences/day:
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="kpi-label">{model_a.name} / month</div>
            <div className="kpi-value text-a" style={{ fontSize: 22 }}>
              {fmtMoney(monthlyA)}
            </div>
            <div className="kpi-winner">{fmtCost(costA)} per inference</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="kpi-label">{model_b.name} / month</div>
            <div className="kpi-value text-b" style={{ fontSize: 22 }}>
              {fmtMoney(monthlyB)}
            </div>
            <div className="kpi-winner">{fmtCost(costB)} per inference</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <div className="kpi-label">Monthly saving ({model_a.name} vs {model_b.name})</div>
            <div style={{ fontSize: 22, fontWeight: 700 }} className="text-green">
              {fmtMoney(saving)}
            </div>
          </div>
          <div>
            <div className="kpi-label">Saving %</div>
            <div style={{ fontSize: 22, fontWeight: 700 }} className="text-green">
              {savingPct}%
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Break-even Callout ── */}
      <div className="card mt-16">
        <div className="section-title">Quality Break-even</div>
        <p style={{ fontSize: 13, color: COLOR_MUTED, lineHeight: 1.7 }}>
          <span className="text-a">{model_a.name}</span> costs{' '}
          <strong style={{ color: '#e8eaf0' }}>{costRatio.toFixed(1)}x</strong> more
          per inference than <span className="text-b">{model_b.name}</span>.
          The quality premium is{' '}
          <strong style={{ color: '#e8eaf0' }}>{qualityGap.toFixed(1)} points</strong>{' '}
          ({qualityGapPct}%).{' '}
          Break-even: if your use case requires quality above{' '}
          <strong style={{ color: '#e8eaf0' }}>{breakEvenThreshold}</strong>,{' '}
          <span className="text-a">{model_a.name}</span> is justified.
          Below that threshold, <span className="text-b">{model_b.name}</span> delivers
          acceptable quality at a fraction of the cost.
        </p>
      </div>
    </div>
  );
}
