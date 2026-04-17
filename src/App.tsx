import { useState, useRef } from 'react';
import { EvalResults, DateRange } from './schema/types';
import { useEvalData, filterByDateRange } from './data/useEvalData';
import Overview from './views/Overview';
import AccuracyView from './views/AccuracyView';
import LatencyView from './views/LatencyView';
import CostView from './views/CostView';
import ABComparison from './views/ABComparison';
import ReleaseReadiness from './views/ReleaseReadiness';
import MultiModelMatrix from './views/MultiModelMatrix';

// Placeholder — replaced by baked data after running eval + history
import placeholderData from './data/placeholder.json';

type View = 'overview' | 'accuracy' | 'latency' | 'cost' | 'ab' | 'matrix' | 'release';

const NAV = [
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'accuracy', label: 'Accuracy', icon: '◎' },
  { id: 'latency', label: 'Latency', icon: '⊙' },
  { id: 'cost', label: 'Cost', icon: '◇' },
  { id: 'ab', label: 'A/B Comparison', icon: '⊞' },
  { id: 'matrix', label: 'Model Matrix', icon: '⊟' },
  { id: 'release', label: 'Release Readiness', icon: '◉' },
] as const;

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const originalData = placeholderData as unknown as EvalResults;
  const { results, customLabel, uploadError, loadFile, reset } = useEvalData(originalData);

  const filteredDaily = filterByDateRange(results.daily, dateRange);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const viewProps = { results, daily: filteredDaily, dateRange };

  return (
    <div
      className="app"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleFileDrop}
    >
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h1>AI Evals Control Tower</h1>
          <p>Release Readiness Dashboard</p>
        </div>

        <div className="sidebar-section">Analysis</div>
        {NAV.map(n => (
          <div
            key={n.id}
            className={`nav-item${view === n.id ? ' active' : ''}`}
            onClick={() => setView(n.id as View)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Dataset / file info */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          {customLabel ? (
            <div>
              <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>
                Custom eval loaded
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, wordBreak: 'break-all' }}>
                {customLabel}
              </div>
              <button
                onClick={() => reset(originalData)}
                style={{ fontSize: 11, color: 'var(--accent-a)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                ← Reset to default
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                Dataset: <span style={{ color: 'var(--text)' }}>{results.meta?.dataset || '—'}</span>
              </div>
              <div
                style={{ fontSize: 11, color: 'var(--accent-a)', cursor: 'pointer' }}
                onClick={() => fileRef.current?.click()}
              >
                + Load custom results
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>
          )}
          {uploadError && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>
              {uploadError}
            </div>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="main">
        {/* Drop overlay */}
        {dragOver && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(108,138,255,0.1)',
            border: '2px dashed var(--accent-a)', borderRadius: 'var(--radius-lg)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--accent-a)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⊕</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Drop eval-results.json to load</div>
            </div>
          </div>
        )}

        {/* Top controls */}
        <div className="controls-bar">
          <h2>{NAV.find(n => n.id === view)?.label}</h2>

          <div className="model-legend">
            <span><span className="model-dot dot-a" />{results.model_a?.name || 'Model A'}</span>
            <span><span className="model-dot dot-b" />{results.model_b?.name || 'Model B'}</span>
          </div>

          {['7d','14d','30d'].map(r => (
            <button
              key={r}
              className={`badge-btn${dateRange === r ? ' active' : ''}`}
              onClick={() => setDateRange(r as DateRange)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Views */}
        {view === 'overview' && <Overview {...viewProps} />}
        {view === 'accuracy' && <AccuracyView {...viewProps} />}
        {view === 'latency' && <LatencyView {...viewProps} />}
        {view === 'cost' && <CostView {...viewProps} />}
        {view === 'ab' && <ABComparison {...viewProps} />}
        {view === 'matrix' && <MultiModelMatrix results={results} />}
        {view === 'release' && <ReleaseReadiness {...viewProps} />}
      </main>
    </div>
  );
}
