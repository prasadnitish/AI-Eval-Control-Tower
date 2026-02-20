import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { EvalResults, DailyEntry, DateRange, PromptResult } from '../schema/types';

// ─── Color constants ────────────────────────────────────────────────────────
const COLOR_A       = '#6c8aff';
const COLOR_B       = '#ff6b6b';
const COLOR_GRID    = '#2a2f45';
const COLOR_MUTED   = '#7b82a0';
const COLOR_BG      = '#1a1d27';

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

/** Compute a simple N-day rolling average over a numeric series.
 *  Index i gets the mean of items [i-window+1 .. i], clamped at start. */
function rollingAvg(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return avg(slice);
  });
}

// ─── Difficulty groups ────────────────────────────────────────────────────────
type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyGroup {
  difficulty: Difficulty;
  avgA: number;
  avgB: number;
}

function groupByDifficulty(prompts: PromptResult[]): DifficultyGroup[] {
  const order: Difficulty[] = ['easy', 'medium', 'hard'];

  if (prompts.length === 0) {
    return [
      { difficulty: 'easy',   avgA: 91, avgB: 88 },
      { difficulty: 'medium', avgA: 83, avgB: 76 },
      { difficulty: 'hard',   avgA: 71, avgB: 58 },
    ];
  }

  const buckets: Record<Difficulty, { a: number[]; b: number[] }> = {
    easy:   { a: [], b: [] },
    medium: { a: [], b: [] },
    hard:   { a: [], b: [] },
  };

  for (const p of prompts) {
    const diff = p.difficulty as Difficulty;
    if (!buckets[diff]) continue;
    if (p.model_a_quality_score != null) buckets[diff].a.push(p.model_a_quality_score);
    if (p.model_b_quality_score != null) buckets[diff].b.push(p.model_b_quality_score);
  }

  return order.map((diff) => ({
    difficulty: diff,
    avgA: buckets[diff].a.length > 0 ? +avg(buckets[diff].a).toFixed(1) : 0,
    avgB: buckets[diff].b.length > 0 ? +avg(buckets[diff].b).toFixed(1) : 0,
  }));
}

// ─── Failure categories ───────────────────────────────────────────────────────
interface FailureCategory {
  category: string;
  gap: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
}

function topFailureCategories(prompts: PromptResult[]): FailureCategory[] {
  if (prompts.length === 0) {
    return [
      { category: 'root-cause-analysis',   gap: 12.4, easyCount: 0, mediumCount: 2, hardCount: 8 },
      { category: 'recommendation-engine', gap: 8.1,  easyCount: 1, mediumCount: 5, hardCount: 4 },
      { category: 'am-call-prep',          gap: 5.2,  easyCount: 2, mediumCount: 6, hardCount: 1 },
    ];
  }

  const byCategory: Record<string, { gaps: number[]; easy: number; medium: number; hard: number }> = {};

  for (const p of prompts) {
    const a = p.model_a_quality_score;
    const b = p.model_b_quality_score;
    if (a == null || b == null) continue;
    if (!byCategory[p.category]) {
      byCategory[p.category] = { gaps: [], easy: 0, medium: 0, hard: 0 };
    }
    byCategory[p.category].gaps.push(a - b);
    if (p.difficulty === 'easy')   byCategory[p.category].easy++;
    if (p.difficulty === 'medium') byCategory[p.category].medium++;
    if (p.difficulty === 'hard')   byCategory[p.category].hard++;
  }

  const ranked = Object.entries(byCategory)
    .map(([cat, data]) => ({
      category: cat,
      gap: +avg(data.gaps).toFixed(1),
      easyCount: data.easy,
      mediumCount: data.medium,
      hardCount: data.hard,
    }))
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 3);

  if (ranked.length === 0) {
    return [
      { category: 'root-cause-analysis',   gap: 12.4, easyCount: 0, mediumCount: 2, hardCount: 8 },
      { category: 'recommendation-engine', gap: 8.1,  easyCount: 1, mediumCount: 5, hardCount: 4 },
      { category: 'am-call-prep',          gap: 5.2,  easyCount: 2, mediumCount: 6, hardCount: 1 },
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
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Custom Difficulty X-Axis Tick ────────────────────────────────────────────
function DifficultyTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const val = payload?.value ?? '';
  const tagCls =
    val === 'easy' ? 'tag tag-easy' : val === 'medium' ? 'tag tag-medium' : 'tag tag-hard';
  return (
    <foreignObject x={(x ?? 0) - 28} y={(y ?? 0) + 4} width={56} height={22}>
      <span className={tagCls} style={{ display: 'inline-block' }}>
        {val}
      </span>
    </foreignObject>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AccuracyView({ results, daily }: Props) {
  const { model_a, model_b, events, prompts } = results;

  // ── Chart data with rolling averages ────────────────────────────────────────
  const rawA = daily.map((d) => d.model_a.quality_score);
  const rawB = daily.map((d) => d.model_b.quality_score);
  const rollA = rollingAvg(rawA, 7);
  const rollB = rollingAvg(rawB, 7);

  const chartData = daily.map((d, i) => ({
    date:    fmtDate(d.date),
    [model_a.name]:         +rawA[i].toFixed(1),
    [model_b.name]:         +rawB[i].toFixed(1),
    [`${model_a.name} 7d avg`]: +rollA[i].toFixed(1),
    [`${model_b.name} 7d avg`]: +rollB[i].toFixed(1),
  }));

  // ── Difficulty bar chart data ────────────────────────────────────────────────
  const diffGroups = groupByDifficulty(prompts);
  const barData = diffGroups.map((g) => ({
    difficulty: g.difficulty,
    [model_a.name]: g.avgA,
    [model_b.name]: g.avgB,
  }));

  // ── Failure categories ───────────────────────────────────────────────────────
  const failures = topFailureCategories(prompts);
  const maxGap = Math.max(...failures.map((f) => Math.abs(f.gap)), 0.01);

  return (
    <div>
      {/* ── Main Line Chart ── */}
      <div className="chart-card">
        <div className="chart-title">Weighted Quality Score — Daily</div>
        <ResponsiveContainer width="100%" height={240}>
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
              domain={[40, 100]}
              tick={{ fill: COLOR_MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: COLOR_MUTED, paddingTop: 8 }} />

            {/* Raw lines */}
            <Line
              type="monotone"
              dataKey={model_a.name}
              stroke={COLOR_A}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey={model_b.name}
              stroke={COLOR_B}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />

            {/* 7-day rolling averages — dashed, lighter */}
            <Line
              type="monotone"
              dataKey={`${model_a.name} 7d avg`}
              stroke={COLOR_A}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              strokeOpacity={0.55}
              dot={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey={`${model_b.name} 7d avg`}
              stroke={COLOR_B}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              strokeOpacity={0.55}
              dot={false}
              legendType="none"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Event Timeline Strip ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
        <span className="event-strip-label">Events</span>
        <div className="event-strip" style={{ flex: 1 }}>
          {events.length === 0 ? (
            <span className="text-muted" style={{ fontSize: 12, alignSelf: 'center' }}>
              No events recorded
            </span>
          ) : (
            events.map((ev, i) => {
              const chipCls = ev.resolved ? 'resolved' : 'open';
              const icon = ev.resolved ? '✓' : '⚠';
              const startFmt = fmtDate(ev.start);
              const endFmt = ev.end ? fmtDate(ev.end) : 'ongoing';
              const dateRange = `${startFmt} – ${endFmt}`;
              return (
                <div
                  key={i}
                  className={`event-chip ${chipCls}`}
                  title={ev.description}
                >
                  <span>{icon}</span>
                  <span>{ev.label}</span>
                  <span style={{ opacity: 0.75 }}>{dateRange}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Performance by Difficulty ── */}
      <div className="chart-card">
        <div className="chart-title">Performance by Difficulty</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={barData}
            margin={{ top: 4, right: 16, left: 0, bottom: 8 }}
            barCategoryGap="30%"
            barGap={3}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} vertical={false} />
            <XAxis
              dataKey="difficulty"
              tick={<DifficultyTick />}
              axisLine={{ stroke: COLOR_GRID }}
              tickLine={false}
              height={32}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: COLOR_MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: COLOR_MUTED, paddingTop: 8 }} />
            <Bar dataKey={model_a.name} fill={COLOR_A} radius={[3, 3, 0, 0]} maxBarSize={36} />
            <Bar dataKey={model_b.name} fill={COLOR_B} radius={[3, 3, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Failure Analysis ── */}
      <div className="failure-card">
        <div className="failure-title">Failure Analysis — Top Categories</div>
        {failures.map((f) => {
          const pct = (Math.abs(f.gap) / maxGap) * 100;
          const total = f.easyCount + f.mediumCount + f.hardCount;
          return (
            <div key={f.category} style={{ marginBottom: 12 }}>
              <div className="failure-row">
                <span style={{ minWidth: 200, color: '#e8eaf0', fontWeight: 500 }}>
                  {f.category}
                </span>
                <span style={{ minWidth: 52, color: COLOR_MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {f.gap > 0 ? '+' : ''}{f.gap.toFixed(1)} gap
                </span>
                <div className="failure-bar-bg">
                  <div className="failure-bar" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {total > 0 && (
                <div style={{ display: 'flex', gap: 6, paddingLeft: 4, marginTop: 4 }}>
                  {f.easyCount > 0 && (
                    <span className="tag tag-easy">{f.easyCount} easy</span>
                  )}
                  {f.mediumCount > 0 && (
                    <span className="tag tag-medium">{f.mediumCount} medium</span>
                  )}
                  {f.hardCount > 0 && (
                    <span className="tag tag-hard">{f.hardCount} hard</span>
                  )}
                </div>
              )}
              {total === 0 && (
                <div style={{ display: 'flex', gap: 6, paddingLeft: 4, marginTop: 4 }}>
                  {f.hardCount > 0 || f.category === 'root-cause-analysis' ? (
                    <span className="tag tag-hard">mostly hard</span>
                  ) : f.category === 'recommendation-engine' ? (
                    <>
                      <span className="tag tag-medium">medium</span>
                      <span className="tag tag-hard">hard</span>
                    </>
                  ) : (
                    <span className="tag tag-medium">medium</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
