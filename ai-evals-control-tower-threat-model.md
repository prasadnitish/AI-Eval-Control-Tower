# AI Evals Control Tower Threat Model

Date: 2026-05-10

Scope: public demo at `https://www.nitishprasad.com/evals/`, project page at `https://www.nitishprasad.com/ai-eval-control-tower`, and the local CLI in this repository.

## Executive Summary

The setup is safe for public demo and GitHub distribution if it stays within the confirmed assumption that the committed datasets and baked result files are synthetic demo data.

The browser demo does not need or receive API keys. The runnable eval system is a local Node CLI that reads `OPENROUTER_API_KEY` from `.env` or GitHub Actions secrets and sends candidate prompts, model responses, and judge requests to OpenRouter. The main privacy risk is not credential leakage; it is users accidentally placing private seller, student, family, customer, or credential-bearing data into datasets or generated eval artifacts and then committing or uploading those artifacts.

Changes made during review:

- Patched dependency lockfile to clear `npm audit` findings.
- Changed local eval output default to ignored `output/local-results.json`.
- Ignored generated `output/*.json` artifacts by default while preserving the synthetic demo baselines.
- Disabled automatic live OpenRouter evals on pull requests.
- Moved live GitHub Actions evals to manual `workflow_dispatch`.
- Kept PR checks secret-free: install, unit tests, and dashboard build only.
- Made GitHub artifact upload double opt-in: manual workflow input plus `UPLOAD_EVAL_ARTIFACTS=true`.
- Updated README and public demo copy to explain the data, judge, output artifacts, and privacy constraints.

Current posture: acceptable for public portfolio demo and local clone-and-run usage with synthetic or approved data. Not sufficient for real production, regulated, or customer-confidential datasets without additional data handling controls, provider review, and artifact retention policy.

## Scope And Assumptions

In scope:

- Static Vite/React demo served under `/evals/`.
- Static project page explaining setup and run path.
- Local CLI files under `eval/`.
- Config files under `config/`.
- Synthetic datasets and synthetic baked output JSON files.
- GitHub Actions workflow for secret-free PR checks and manual live evals.

Out of scope:

- LinkedIn posts and public-writing content.
- Broader portfolio pages not needed for this tool.
- OpenRouter/provider internal data retention guarantees.
- Production deployment of a hosted multi-user eval service.
- Real seller, customer, student, child, or family data handling.

Validated assumptions:

- The committed datasets and baked outputs are synthetic.
- The intended public posture is public demo plus local CLI.
- Live OpenRouter evals should not run automatically on every PR.
- Users should clone the repo and run with their own API keys locally.

## System Model

Actors:

- Public viewer: opens the static demo or project page in a browser.
- Local evaluator: clones the repo, creates `.env`, adds `OPENROUTER_API_KEY`, runs CLI commands.
- Repository maintainer: reviews PRs, runs tests, triggers manual live evals when needed.
- GitHub Actions runner: performs secret-free PR checks and optional manual live evals.
- OpenRouter and model providers: receive prompts, candidate responses, and judge requests during real eval runs.
- Cloudflare Worker/static assets: serves portfolio pages and the static demo.

Data flows:

1. Public browser requests `/evals/`.
2. Cloudflare serves static HTML, CSS, and JS.
3. Browser renders baked synthetic evidence and run instructions.
4. Local evaluator runs `node eval/eval-runner.js`.
5. CLI reads `.env` and loads `OPENROUTER_API_KEY`.
6. CLI injects dataset `context_blocks` into prompts.
7. CLI sends candidate model calls through OpenRouter.
8. CLI sends original prompts and candidate responses to the configured LLM judge through OpenRouter.
9. CLI writes result artifacts containing responses, scores, judge reasoning, latency, tokens, and cost.
10. Gate script reads a result artifact and returns GO, CONDITIONAL GO, or NO-GO.

Trust boundaries:

- Browser static demo boundary: no API key should cross into the browser.
- Local machine boundary: `.env` and generated outputs remain local by default.
- Third-party AI boundary: prompt context and model responses leave the local machine during live evals.
- GitHub Actions boundary: PR checks must not receive secrets; manual live evals may receive `OPENROUTER_API_KEY`.
- Cloudflare boundary: only intended static assets should be deployed.

## Assets

High-value assets:

- `OPENROUTER_API_KEY`.
- GitHub repository secrets.
- User-provided datasets.
- Generated eval artifacts under `output/`.
- Model responses and judge reasoning.
- Baked demo results if they ever stop being synthetic.
- GitHub Actions logs and artifacts.
- Cloudflare deployment credentials and published static assets.

Integrity-critical assets:

- `config/models.json`.
- `config/judge-rubric.json`.
- `config/settings.json`.
- `eval/eval-runner.js`.
- `eval/judge.js`.
- `eval/check-gate.js`.
- `.github/workflows/eval-gate.yml`.
- README/public run instructions.

## Attacker Model

Considered attackers:

- Drive-by public viewer looking for secrets in static assets.
- GitHub user opening a PR against the public repo.
- Malicious same-repo contributor attempting to modify CI or runner code.
- User who accidentally pastes private data or credentials into datasets.
- Dependency/supply-chain attacker through npm packages.
- Cost-abuse actor attempting to trigger expensive model runs.

Not considered in depth:

- Compromised maintainer laptop.
- Compromised GitHub, Cloudflare, OpenRouter, or model provider account.
- Browser zero-days.
- Multi-tenant server-side attacks, because this is not a hosted eval API.

## Entry Points

- Public pages: `/evals/`, `/ai-eval-control-tower`.
- Static JS/CSS assets under `/evals/assets/`.
- Local CLI arguments: `--dataset`, `--models`, `--baseline`, `--candidate`, `--suite`, `--output`.
- Local `.env`.
- JSON datasets under `datasets/`.
- JSON outputs under `output/`.
- GitHub Actions manual workflow inputs.
- GitHub Actions repository secret `OPENROUTER_API_KEY`.
- `package-lock.json` and npm dependency install.

## Top Abuse Paths

1. Secret pasted into repo files.
   A user or contributor pastes an API key into README, config, dataset, source, or output. Mitigations: `.env*` ignored, `.env.example` only has a placeholder, local output ignored, current source/history/live scans found no real secret-pattern matches.

2. Malicious PR exfiltrates CI secret.
   A PR modifies workflow or runner code to print or send `OPENROUTER_API_KEY`. Mitigation: pull-request checks no longer run live evals and do not receive `OPENROUTER_API_KEY`.

3. Private data committed through eval artifacts.
   A user evaluates real seller/family/student data and commits `output/*.json`, which contains prompt context, responses, and judge reasoning. Mitigations: generated output is ignored by default, local output defaults to `output/local-results.json`, README warns about artifact contents.

4. Private data uploaded as GitHub artifact.
   CI uploads `output/ci-results.json` containing prompts/responses. Mitigation: artifact upload requires both manual workflow input and repository variable `UPLOAD_EVAL_ARTIFACTS=true`.

5. Provider data transfer surprise.
   A user assumes local evals stay local, but live candidate/judge calls send data through OpenRouter and model providers. Mitigation: README now states this explicitly.

6. Cost abuse through automated evals.
   Repeated PRs trigger model calls and spend API credits. Mitigation: live evals are manual only.

7. Dependency vulnerability.
   Vulnerable npm dependency leads to local dev/build compromise. Mitigation: lockfile updated; `npm audit` reports zero vulnerabilities at review time.

8. Static demo exposes hidden files.
   Cloudflare deployment accidentally publishes `.git`, local docs, or ignored files. Mitigation: `.assetsignore` excludes repository/control files; live static scan found no secret-pattern matches in relevant public pages/assets.

## Threat Table

| Threat | Impact | Likelihood | Current risk | Controls | Residual risk |
|---|---:|---:|---:|---|---|
| API key committed in source | High | Low | Low | `.env*` ignored, placeholder-only `.env.example`, secret scans | Future manual mistake |
| API key exposed in browser bundle | High | Low | Low | Browser never reads `.env`, live bundle scan zero matches | Future code change could regress |
| PR exfiltrates GitHub secret | High | Medium | Low | PR workflow is secret-free; live eval is manual only | Same-repo trusted contributors still matter |
| Eval artifact exposes private data | High | Medium | Medium | Local output ignored, artifact upload opt-in, docs warn | User can override and share manually |
| Synthetic demo outputs mistaken for production proof | Medium | Medium | Medium | README says synthetic/demo and LLM judge is directional | Public readers may over-trust scores |
| Third-party provider receives sensitive data | High | Medium | Medium | Docs warn; local CLI requires user key/action | Needs policy review for real data |
| Model spend abuse | Medium | Low | Low | Manual live eval only, dry-run cost estimator | Maintainer can still trigger costly full runs |
| Dependency vulnerability | Medium | Medium | Low | Lockfile patched, audit zero at review time | New advisories can appear |
| Local path misuse in CLI | Low | Low | Low | CLI is operator-controlled local tool | Not safe to expose as hosted API without validation |
| XSS in static demo | Medium | Low | Low | Static React app, no secret in browser, no source `dangerouslySetInnerHTML` usage | Future upload/custom-data UI would change risk |

## Criticality Calibration

High severity:

- Any real API key in source, history, static assets, logs, or artifacts.
- Any real customer/seller/student/family data published in baked outputs or GitHub artifacts.
- Any PR path that can access `OPENROUTER_API_KEY`.

Medium severity:

- Live evals running automatically and spending credits.
- Users misunderstanding that local live evals send data to OpenRouter/providers.
- Public demo implying production-grade statistical certification rather than directional evidence.
- Dependency vulnerabilities in the local development/build chain.

Low severity:

- Local operator-controlled path arguments.
- Synthetic demo outputs being public.
- Static demo serving only baked content with no credentials.

## Focus Paths

### Path 1: Public Viewer Opens Demo

Expected behavior:

- Viewer receives static HTML/CSS/JS from Cloudflare.
- No API key is requested, embedded, or transmitted.
- Viewer sees synthetic baked evidence and local-run instructions.

Review result:

- Live `/evals/` and `/ai-eval-control-tower` returned HTTP 200.
- Live HTML/JS/CSS secret-pattern scan found zero matches.
- Demo bundle references `output/local-results.json` for local generated output guidance.

Residual concern:

- Public demo still includes synthetic model outputs. This is acceptable because data is confirmed synthetic.

### Path 2: User Clones And Runs Local CLI

Expected behavior:

- User creates `.env` from `.env.example`.
- CLI loads `OPENROUTER_API_KEY` locally.
- CLI sends prompt context and responses through OpenRouter.
- CLI writes ignored `output/local-results.json`.

Review result:

- `.env`, `.env.local`, and `.env.*` are ignored.
- Default output path is ignored.
- README now describes third-party data transfer and artifact contents.

Residual concern:

- If user evaluates private data, provider approval and local retention policy are still their responsibility.

### Path 3: PR Against GitHub Repo

Expected behavior:

- PR runs `npm ci`, `npm test`, and `npm run build`.
- PR does not receive `OPENROUTER_API_KEY`.
- PR does not run live model calls.

Review result:

- Workflow changed so `eval-gate` runs only on `workflow_dispatch`.
- PR path is now secret-free.

Residual concern:

- Maintainers still need normal code review for workflow and runner changes before merging.

### Path 4: Maintainer Manually Runs Live Eval

Expected behavior:

- Maintainer triggers GitHub Actions manually.
- Maintainer chooses dataset, suite, models, baseline, and candidate.
- Workflow requires `OPENROUTER_API_KEY`.
- Artifact upload requires explicit manual input plus repository variable.

Review result:

- Manual workflow inputs added.
- Secret presence is checked before live eval.
- Artifact upload is double opt-in.

Residual concern:

- Manual full-suite evals can still spend credits and send all selected prompt data to providers.

## Verification Evidence

Commands run during review:

- `git grep` and `rg` secret-pattern scans across source, Git history, website bundle, and live URLs.
- `npm audit --json`.
- `npm ci`.
- `npm test`.
- `npm run build`.
- `node eval/eval-runner.js --dry-run ...`.
- `npx wrangler deploy`.
- Live fetch scan of `/evals/`, `/evals/assets/...`, and `/ai-eval-control-tower`.

Key observed results:

- Current source secret-pattern scan found only `.env.example` placeholder.
- Git history secret-pattern scan found only `.env.example` placeholder in the reviewed branch history.
- Live public pages/assets scanned with zero secret-pattern matches.
- `npm audit` reported zero vulnerabilities after lockfile refresh.
- Unit tests passed: 15 passing, 0 failing.
- Build passed with Vite 6.4.2.
- Dry run showed output path `output/local-results.json`.
- Cloudflare deployed refreshed static demo, version `782a3e19-4da1-483c-ace2-da5fb253c857`.

## Recommendations

Done:

- Keep PR checks secret-free.
- Make live OpenRouter evals manual-only.
- Ignore generated eval artifacts by default.
- Keep CI artifact upload disabled by default.
- Document that live evals send data to OpenRouter/providers.
- Document that generated outputs include full prompts, responses, and judge reasoning.
- Patch dependencies and verify audit.

Recommended before using real data:

- Add a scrubber or redaction mode for result artifacts.
- Add dataset schema validation that flags likely secrets, emails, phone numbers, and account identifiers.
- Add a `SECURITY.md` with vulnerability reporting and key-rotation guidance.
- Add a short "data classification" section to README for teams adapting this repo.
- Require human-reviewed calibration sets before treating judge scores as launch certification.
- Review OpenRouter and provider data-retention terms for the specific data class being evaluated.

## Final Assessment

Approved for public demo and open-source/local CLI use with synthetic data.

Do not treat the repository as approved for confidential production datasets until redaction, provider approval, artifact retention rules, and calibration controls are added.
