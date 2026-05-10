import { useMemo, useState } from 'react';
import { Candidate, DecisionTone, SCENARIOS, Scenario, ScenarioId } from './data/scenarios';

type ViewId = 'memo' | 'evidence' | 'candidates' | 'rubric' | 'economics' | 'rollout' | 'runbook';

const VIEWS: Array<{ id: ViewId; label: string; summary: string }> = [
  { id: 'memo', label: 'Decision Memo', summary: 'What should a PM decide?' },
  { id: 'evidence', label: 'Evidence Chain', summary: 'What data and judge?' },
  { id: 'candidates', label: 'Candidate Board', summary: 'Which model belongs where?' },
  { id: 'rubric', label: 'Rubric + Failure Modes', summary: 'What blocks launch?' },
  { id: 'economics', label: 'Operating Envelope', summary: 'What happens at scale?' },
  { id: 'rollout', label: 'Rollout Plan', summary: 'How does this become production?' },
  { id: 'runbook', label: 'Run Locally', summary: 'Clone, add keys, rerun.' },
];

const toneLabel: Record<DecisionTone, string> = {
  go: 'GO',
  watch: 'REVIEW',
  nogo: 'NO-GO',
};

function fmtLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s`;
  return `${ms}ms`;
}

function fmtCost(v: number): string {
  if (v === 0) return '$0';
  return `$${v.toFixed(v < 0.01 ? 5 : 4)}`;
}

function toneClass(tone: DecisionTone): string {
  return `tone-${tone}`;
}

function sortedCandidates(scenario: Scenario): Candidate[] {
  const rank: Record<DecisionTone, number> = { go: 0, watch: 1, nogo: 2 };
  return [...scenario.candidates].sort((a, b) => {
    const verdict = rank[a.verdict] - rank[b.verdict];
    if (verdict !== 0) return verdict;
    return b.quality - a.quality;
  });
}

function ScenarioRail({
  scenario,
  setScenarioId,
}: {
  scenario: Scenario;
  setScenarioId: (id: ScenarioId) => void;
}) {
  return (
    <aside className="rail">
      <div className="brand-block">
        <div className="brand-mark">AE</div>
        <div>
          <h1>AI Eval Control Tower</h1>
          <p>Product launch review system</p>
        </div>
      </div>

      <div className="rail-section">Use Case</div>
      <div className="scenario-list">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            className={`scenario-button${item.id === scenario.id ? ' active' : ''}`}
            onClick={() => setScenarioId(item.id)}
            type="button"
          >
            <span>{item.shortTitle}</span>
            <small>{item.domain}</small>
          </button>
        ))}
      </div>

      <div className="rail-card">
        <span className="mini-label">Current stakeholder</span>
        <strong>{scenario.stakeholder}</strong>
      </div>

      <div className="rail-note">
        Built for a Principal PM review: clear decision, inspectable evidence, hard floor, operating tradeoff, and a local run path.
      </div>
    </aside>
  );
}

function ViewNav({ activeView, setActiveView }: { activeView: ViewId; setActiveView: (id: ViewId) => void }) {
  return (
    <nav className="view-nav" aria-label="Dashboard sections">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`view-tab${activeView === view.id ? ' active' : ''}`}
          onClick={() => setActiveView(view.id)}
        >
          <span>{view.label}</span>
          <small>{view.summary}</small>
        </button>
      ))}
    </nav>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-card">
      <span className="mini-label">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function DecisionMemo({ scenario }: { scenario: Scenario }) {
  const bestCandidate = sortedCandidates(scenario)[0];

  return (
    <section className="view-stack">
      <div className={`decision-hero ${toneClass(scenario.decision)}`}>
        <div>
          <span className="mini-label">PM launch decision</span>
          <h2>{scenario.decisionLabel}</h2>
          <p>{scenario.recommendation}</p>
        </div>
        <div className="decision-stamp">
          <span>{toneLabel[scenario.decision]}</span>
        </div>
      </div>

      <div className="memo-grid">
        <article className="memo-panel span-2">
          <span className="mini-label">Decision question</span>
          <h3>{scenario.decisionQuestion}</h3>
          <p>{scenario.narrative}</p>
        </article>
        <article className="memo-panel">
          <span className="mini-label">Highlighted pair</span>
          <h3>{scenario.highlightedPair}</h3>
          <p>{scenario.datasetLabel}</p>
        </article>
      </div>

      <div className="metric-grid">
        <MetricCard label={scenario.primaryMetricLabel} value={scenario.primaryMetric} detail={scenario.sourceNote} />
        <MetricCard label="Hard floor" value={scenario.hardFloor} detail={scenario.hardFloorStatus} />
        <MetricCard label={scenario.operatingMetricLabel} value={scenario.operatingMetric} detail={`Recommended path: ${bestCandidate.name}`} />
      </div>

      <article className="storyline">
        <div className="story-step">
          <span>1</span>
          <strong>Model enters workflow</strong>
          <p>{scenario.workflow}</p>
        </div>
        <div className="story-step">
          <span>2</span>
          <strong>Gate checks launch risk</strong>
          <p>{scenario.hardFloor}</p>
        </div>
        <div className="story-step">
          <span>3</span>
          <strong>PM chooses motion</strong>
          <p>{scenario.recommendation}</p>
        </div>
      </article>
    </section>
  );
}

function EvidenceView({ scenario }: { scenario: Scenario }) {
  const evidence = scenario.evidence;

  return (
    <section className="view-stack">
      <div className="section-heading evidence-heading">
        <div>
          <span className="mini-label">Evidence Chain</span>
          <h2>Scores only matter when the data, judge, and limits are visible.</h2>
        </div>
        <p>This view answers the questions a skeptical PM, engineer, or applied-science partner will ask before trusting the recommendation.</p>
      </div>

      <div className="evidence-topline">
        <MetricCard label="Dataset" value={evidence.datasetName} detail={evidence.datasetFile} />
        <MetricCard label="Coverage" value={evidence.promptCount.split(' across ')[0]} detail={evidence.promptCount} />
        <MetricCard label="Judge" value={evidence.judgeModel} detail={evidence.judgeRole} />
      </div>

      <div className="evidence-grid">
        <article className="panel evidence-panel">
          <span className="mini-label">What data is checked</span>
          <ul className="evidence-list">
            {evidence.checkedData.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel evidence-panel">
          <span className="mini-label">How the score is produced</span>
          <ul className="evidence-list">
            {evidence.scoreMethod.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel evidence-panel">
          <span className="mini-label">Why the score is usable</span>
          <ul className="evidence-list">
            {evidence.confidenceChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel evidence-panel">
          <span className="mini-label">What the score does not prove</span>
          <ul className="evidence-list">
            {evidence.knownLimits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function CandidateBoard({ scenario }: { scenario: Scenario }) {
  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="mini-label">Candidate Board</span>
          <h2>Each model has a job, not just a score.</h2>
        </div>
        <p>Principal-level model selection separates default paths, escalation paths, blocked paths, and monitoring paths.</p>
      </div>

      <div className="candidate-table-wrap">
        <table className="candidate-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Role</th>
              <th>Quality</th>
              <th>Trust</th>
              <th>P95 latency</th>
              <th>Cost</th>
              <th>Ship fit</th>
            </tr>
          </thead>
          <tbody>
            {sortedCandidates(scenario).map((candidate) => (
              <tr key={candidate.id}>
                <td>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.provider}</span>
                </td>
                <td>{candidate.role}</td>
                <td>{candidate.quality.toFixed(1)}</td>
                <td>{candidate.trust.toFixed(1)}</td>
                <td>{fmtLatency(candidate.latencyMs)}</td>
                <td>{fmtCost(candidate.cost)}</td>
                <td>
                  <span className={`fit-pill ${toneClass(candidate.verdict)}`}>{candidate.verdictLabel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="candidate-cards">
        {sortedCandidates(scenario).slice(0, 3).map((candidate) => (
          <article key={candidate.id} className="candidate-card">
            <div className="candidate-card-header">
              <span className={`fit-pill ${toneClass(candidate.verdict)}`}>{candidate.verdictLabel}</span>
              <strong>{candidate.name}</strong>
            </div>
            <p>{candidate.why}</p>
            <small>{candidate.constraint}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScoreBar({ label, score, floor, note }: { label: string; score: number; floor?: number; note: string }) {
  const pct = Math.max(0, Math.min(100, score * 10));
  const passes = floor == null || score >= floor;

  return (
    <div className="score-row">
      <div className="score-row-copy">
        <strong>{label}</strong>
        <span>{note}</span>
      </div>
      <div className="score-meter">
        <div className="score-track">
          <div className={`score-fill${passes ? '' : ' risk'}`} style={{ width: `${pct}%` }} />
          {floor != null && <i style={{ left: `${floor * 10}%` }} />}
        </div>
        <b>{score.toFixed(1)}</b>
      </div>
    </div>
  );
}

function RubricView({ scenario }: { scenario: Scenario }) {
  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="mini-label">Rubric + Failure Modes</span>
          <h2>Average quality is not enough to ship.</h2>
        </div>
        <p>Hard floors are explicit because some failures should block launch even when the total score looks healthy.</p>
      </div>

      <div className="rubric-grid">
        <article className="panel">
          <span className="mini-label">Rubric dimensions</span>
          <div className="score-list">
            {scenario.dimensions.map((dimension) => (
              <ScoreBar
                key={dimension.name}
                label={dimension.name}
                score={dimension.score}
                floor={dimension.floor}
                note={dimension.note}
              />
            ))}
          </div>
        </article>

        <article className="panel failure-panel">
          <span className="mini-label">Failure modes that matter</span>
          <div className="failure-list">
            {scenario.failureModes.map((failure) => (
              <div key={failure.title} className="failure-item">
                <div>
                  <strong>{failure.title}</strong>
                  <span>{failure.severity}</span>
                </div>
                <p>{failure.evidence}</p>
                <small>{failure.ownerAction}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function EconomicsView({ scenario }: { scenario: Scenario }) {
  const maxCost = Math.max(...scenario.candidates.map((candidate) => candidate.cost), 0.001);
  const maxLatency = Math.max(...scenario.candidates.map((candidate) => candidate.latencyMs), 1);

  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="mini-label">Operating Envelope</span>
          <h2>The adoption decision lives between quality, trust, speed, and cost.</h2>
        </div>
        <p>A model can be impressive and still be wrong for the default production path.</p>
      </div>

      <div className="economics-grid">
        <article className="panel">
          <span className="mini-label">Cost and latency by candidate</span>
          <div className="bubble-chart" aria-label="Candidate cost and latency comparison">
            {scenario.candidates.map((candidate) => {
              const left = Math.max(6, Math.min(90, (candidate.cost / maxCost) * 84));
              const bottom = Math.max(8, Math.min(86, (candidate.latencyMs / maxLatency) * 78));
              return (
                <div
                  key={candidate.id}
                  className={`bubble ${toneClass(candidate.verdict)}`}
                  style={{ left: `${left}%`, bottom: `${bottom}%` }}
                  title={`${candidate.name}: ${fmtCost(candidate.cost)}, ${fmtLatency(candidate.latencyMs)}`}
                >
                  {candidate.name.split(' ')[0]}
                </div>
              );
            })}
            <span className="axis-label x">Cost per inference</span>
            <span className="axis-label y">P95 latency</span>
          </div>
        </article>

        <article className="panel">
          <span className="mini-label">PM interpretation</span>
          <div className="principle-list">
            {scenario.pmQuestions.map((question) => (
              <div key={question} className="principle-item">
                <span>?</span>
                <p>{question}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function RolloutView({ scenario }: { scenario: Scenario }) {
  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="mini-label">Rollout Plan</span>
          <h2>A launch review should end with ownership.</h2>
        </div>
        <p>The dashboard should make the next meeting shorter: who owns the risk, what changes, and what proves it worked.</p>
      </div>

      <div className="rollout-list">
        {scenario.rollout.map((step, index) => (
          <article key={step.stage} className="rollout-step">
            <span>{index + 1}</span>
            <div>
              <strong>{step.stage}</strong>
              <p>{step.action}</p>
              <small>Owner: {step.owner}</small>
            </div>
            <em>{step.exit}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function RunbookView({ scenario }: { scenario: Scenario }) {
  const evidence = scenario.evidence;

  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="mini-label">Run Locally</span>
          <h2>Clone the repo, add your API key, and rerun the decision.</h2>
        </div>
        <p>The public dashboard uses baked results. The repo is the executable version: teams can bring their own OpenRouter key and swap datasets, models, and rubrics.</p>
      </div>

      <div className="runbook-grid">
        <article className="panel">
          <span className="mini-label">Setup</span>
          <div className="command-stack">
            <div className="command-block">
              <strong>Clone</strong>
              <code>git clone https://github.com/prasadnitish/AI-Eval-Control-Tower.git</code>
            </div>
            <div className="command-block">
              <strong>Install</strong>
              <code>cd AI-Eval-Control-Tower && npm install</code>
            </div>
            <div className="command-block">
              <strong>Add key</strong>
              <code>cp .env.example .env</code>
              <small>Paste OPENROUTER_API_KEY in .env. The browser dashboard never receives this key.</small>
            </div>
          </div>
        </article>

        <article className="panel">
          <span className="mini-label">Scenario run</span>
          <div className="command-stack">
            {evidence.runCommands.map((step) => (
              <div className="command-block" key={step.label}>
                <strong>{step.label}</strong>
                <code>{step.command}</code>
                <small>{step.detail}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="panel artifact-panel">
        <span className="mini-label">Files a team should inspect or change</span>
        <div className="artifact-grid">
          {evidence.artifacts.map((artifact) => (
            <code key={artifact}>{artifact}</code>
          ))}
        </div>
      </article>
    </section>
  );
}

function ActiveView({ view, scenario }: { view: ViewId; scenario: Scenario }) {
  if (view === 'evidence') return <EvidenceView scenario={scenario} />;
  if (view === 'candidates') return <CandidateBoard scenario={scenario} />;
  if (view === 'rubric') return <RubricView scenario={scenario} />;
  if (view === 'economics') return <EconomicsView scenario={scenario} />;
  if (view === 'rollout') return <RolloutView scenario={scenario} />;
  if (view === 'runbook') return <RunbookView scenario={scenario} />;
  return <DecisionMemo scenario={scenario} />;
}

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('sproutroute-travel');
  const [activeView, setActiveView] = useState<ViewId>('memo');
  const scenario = useMemo(
    () => SCENARIOS.find((item) => item.id === scenarioId) || SCENARIOS[0],
    [scenarioId],
  );

  return (
    <div className="app-shell">
      <ScenarioRail
        scenario={scenario}
        setScenarioId={(id) => {
          setScenarioId(id);
          setActiveView('memo');
        }}
      />
      <main className="workspace">
        <header className="workspace-header">
          <div>
            <span className="mini-label">Launch Review</span>
            <h2>{scenario.title}</h2>
            <p>{scenario.workflow}</p>
          </div>
          <div className={`header-verdict ${toneClass(scenario.decision)}`}>
            {scenario.decisionLabel}
          </div>
        </header>

        <ViewNav activeView={activeView} setActiveView={setActiveView} />
        <ActiveView view={activeView} scenario={scenario} />
      </main>
    </div>
  );
}
