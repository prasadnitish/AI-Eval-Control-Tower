import { useState } from 'react';
import { EvalResults, PerModelSummary } from '../schema/types';

interface Props {
  results: EvalResults;
}

type SortKey = 'name' | 'avg_quality' | 'p95_latency_ms' | 'avg_cost_per_inference' | 'policy_violations' | 'cost_efficiency';
type SortDir = 'asc' | 'desc';

// Verdict inference per-model — for portfolio/lab decisions we show a simple label.
function inferVerdict(pm: PerModelSummary, baselineQuality: number): { label: string; tone: 'go' | 'cond' | 'nogo' } {
  if (pm.policy_violations > 0) return { label: 'NO-GO', tone: 'nogo' };
  const deltaPct = baselineQuality ? ((pm.avg_quality - baselineQuality) / baselineQuality) * 100 : 0;
  if (deltaPct < -5) return { label: 'NO-GO', tone: 'nogo' };
  if (pm.p95_latency_ms > 3600 || pm.avg_cost_per_inference > 0.0065) return { label: 'CONDITIONAL', tone: 'cond' };
  return { label: 'GO', tone: 'go' };
}

export default function MultiModelMatrix({ results }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('avg_quality');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const perModel = results.per_model || results.summary?.per_model;

  if (!perModel || Object.keys(perModel).length === 0) {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>N-way matrix not available</div>
        <div>
          This view requires a results file with a <code>per_model</code> section (runner v2+).
          Run <code>npm run eval:sproutroute</code> to produce one.
        </div>
      </div>
    );
  }

  const baselineSlug = results.meta?.baseline || Object.keys(perModel)[0];
  const baselineQuality = perModel[baselineSlug]?.avg_quality || 0;

  // Build rows
  const rows = Object.entries(perModel).map(([slug, pm]) => {
    const verdict = inferVerdict(pm, baselineQuality);
    // Cost efficiency: quality-per-cent-per-inference. Higher is better.
    const costEff = pm.avg_cost_per_inference > 0
      ? pm.avg_quality / (pm.avg_cost_per_inference * 1000) // quality per $0.001 per inference
      : 0;
    const isBaseline = slug === baselineSlug;
    return { slug, pm, verdict, costEff, isBaseline };
  });

  // Sort
  rows.sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortKey === 'name') { av = a.pm.name; bv = b.pm.name; }
    else if (sortKey === 'cost_efficiency') { av = a.costEff; bv = b.costEff; }
    else { av = (a.pm[sortKey as keyof PerModelSummary] as number) || 0; bv = (b.pm[sortKey as keyof PerModelSummary] as number) || 0; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
  };

  const header = (label: string, k: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      onClick={() => toggleSort(k)}
      style={{ cursor: 'pointer', textAlign: align, userSelect: 'none' }}
    >
      {label}{sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const toneColor = {
    go: 'var(--green)',
    cond: 'var(--amber)',
    nogo: 'var(--red)',
  };

  // Find category winners — per-model dimension_averages aren't per-category, but overall quality leader
  const qualityLeader = [...rows].sort((a, b) => b.pm.avg_quality - a.pm.avg_quality)[0];
  const costLeader = [...rows].filter(r => r.pm.avg_cost_per_inference > 0).sort((a, b) => a.pm.avg_cost_per_inference - b.pm.avg_cost_per_inference)[0];
  const latencyLeader = [...rows].filter(r => r.pm.p95_latency_ms > 0).sort((a, b) => a.pm.p95_latency_ms - b.pm.p95_latency_ms)[0];
  const efficiencyLeader = [...rows].sort((a, b) => b.costEff - a.costEff)[0];

  return (
    <div>
      {/* Leader cards */}
      <div className="card-grid card-grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Quality leader</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{qualityLeader.pm.name}</div>
          <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 2 }}>{qualityLeader.pm.avg_quality}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Cheapest</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{costLeader?.pm.name || '—'}</div>
          <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 2 }}>${costLeader?.pm.avg_cost_per_inference.toFixed(5) || '—'}/inf</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Fastest (P95)</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{latencyLeader?.pm.name || '—'}</div>
          <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 2 }}>{latencyLeader?.pm.p95_latency_ms || '—'}ms</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Best value</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{efficiencyLeader.pm.name}</div>
          <div style={{ fontSize: 13, color: 'var(--accent-a)', marginTop: 2 }}>quality/$ leader</div>
        </div>
      </div>

      {/* Matrix table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Model Matrix</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              All {rows.length} models on {results.meta?.dataset} ({results.meta?.suite} suite, {results.meta?.prompt_count} prompts). Click a column to sort.
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Baseline: <span style={{ color: 'var(--text)' }}>{perModel[baselineSlug]?.name}</span>
          </div>
        </div>
        <table className="metric-table">
          <thead>
            <tr>
              {header('Model', 'name', 'left')}
              <th style={{ textAlign: 'left' }}>Provider</th>
              {header('Quality', 'avg_quality', 'right')}
              <th style={{ textAlign: 'right' }}>Δ vs baseline</th>
              {header('P95 latency', 'p95_latency_ms', 'right')}
              {header('Cost / inf', 'avg_cost_per_inference', 'right')}
              {header('Violations', 'policy_violations', 'right')}
              {header('Quality / $', 'cost_efficiency', 'right')}
              <th style={{ textAlign: 'center' }}>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ slug, pm, verdict, costEff, isBaseline }) => {
              const deltaPct = baselineQuality ? ((pm.avg_quality - baselineQuality) / baselineQuality) * 100 : 0;
              const deltaColor = Math.abs(deltaPct) < 0.05 ? 'var(--text-muted)' : deltaPct > 0 ? 'var(--green)' : 'var(--red)';
              return (
                <tr key={slug}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{pm.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{slug}{isBaseline ? ' · baseline' : ''}</div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{pm.provider}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{pm.avg_quality.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', color: deltaColor }}>{isBaseline ? '—' : `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}</td>
                  <td style={{ textAlign: 'right' }}>{pm.p95_latency_ms}ms</td>
                  <td style={{ textAlign: 'right' }}>${pm.avg_cost_per_inference.toFixed(5)}</td>
                  <td style={{ textAlign: 'right', color: pm.policy_violations > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{pm.policy_violations}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{costEff.toFixed(1)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${toneColor[verdict.tone]}22`,
                      color: toneColor[verdict.tone],
                    }}>
                      {verdict.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dimension breakdown */}
      {rows.length > 0 && Object.keys(rows[0].pm.dimension_averages || {}).length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Dimension scores (1-10)</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Per-model average on each rubric dimension. Hard-floor dimensions (e.g. <code>safety</code>) must clear 8.0.
          </div>
          <table className="metric-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Model</th>
                {Object.keys(rows[0].pm.dimension_averages).map(d => (
                  <th key={d} style={{ textAlign: 'right', textTransform: 'capitalize' }}>{d.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ slug, pm }) => (
                <tr key={slug}>
                  <td style={{ fontWeight: 600 }}>{pm.name}</td>
                  {Object.entries(pm.dimension_averages).map(([d, v]) => (
                    <td key={d} style={{ textAlign: 'right', color: v < 8 && (d === 'safety' || d === 'logistical_feasibility') ? 'var(--amber)' : 'var(--text)' }}>
                      {v.toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
