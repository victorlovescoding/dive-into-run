# Quality Baseline PR A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect 3-5 recent successful `main` branch Quality Budgets workflow artifacts, normalize their report-only signals into `config/quality-baseline-summary.json`, and publish reviewer/SOP evidence in `docs/quality/2026-05-12-quality-baseline-pr-a.md`.

**Architecture:** PR A is a P3 report-only baseline collection task, not a P4 feature-state workflow. Keep implementation in isolated Engineer-owned slices: JSON baseline collection first, Markdown evidence second, summarizer polish only when deterministic committed JSON or metadata capture is blocked, then integration review and PR body preparation. No app behavior, CI enforcement, threshold policy, raw report persistence, or `project-health/**` update belongs in this plan.

**Tech Stack:** Next.js 15 / React 19 repository, JavaScript ES modules, GitHub Actions `Quality Budgets` workflow, GitHub CLI/API metadata inspection, Node.js JSON tooling, Vitest for the focused summarizer test when needed.

---

## Profile And Authorization

- Profile: P3.
- Classification: C3 because this crosses GitHub Actions artifacts, committed config, docs evidence, and possibly one shared summary script; R3 because the output will become future quality-gate input even though PR A remains report-only.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-050-quality-baseline-pr-a`.
- Branch: `050-quality-baseline-pr-a`.
- Automation boundary: Engineers may edit only their assigned owned files. Do not commit, push, open a PR, merge, or sync `main` unless the main agent later receives explicit authorization.
- Required roles: each repo-changing slice needs an Engineer result and a Reviewer decision before the next dependent slice is treated as complete.

## Global Non-Scope

- `project-health/**` is forbidden.
- Raw report files, downloaded artifact archives, and generated `reports/**` payloads are forbidden as committed output.
- Hard thresholds, budgets, pass/fail gates, CI blocking behavior, and semantic drift enforcement are forbidden.
- App code under `src/**` is out of scope.
- Workflow, package script, dependency, lockfile, and ignore-policy changes are out of scope unless the existing collection or summary entrypoint blocks PR A and the main agent approves a revised owned-file contract.
- Tests are not a standalone deliverable. Touch `tests/unit/scripts/quality-baseline-summary.test.js` only when `scripts/summarize-quality-baselines.mjs` changes.

## Files And Ownership

- Create: `config/quality-baseline-summary.json`
  - Owner: Baseline Collector Engineer.
  - Responsibility: committed normalized baseline input for future gates, including run metadata, observed metric samples, median, max, units, notes, top-level outlier evaluation status, and report-only status.
- Create: `docs/quality/2026-05-12-quality-baseline-pr-a.md`
  - Owner: Evidence Writer Engineer.
  - Responsibility: reviewer/SOP evidence with source run traceability, metric summary, limitations, and future-gate handoff.
- Modify only if blocked: `scripts/summarize-quality-baselines.mjs`
  - Owner: Summarizer Polish Engineer.
  - Responsibility: deterministic JSON generation or metadata capture needed for PR A.
- Modify only if script changes: `tests/unit/scripts/quality-baseline-summary.test.js`
  - Owner: Summarizer Polish Engineer.
  - Responsibility: focused coverage for the changed summarizer behavior.

## Collection Procedure

Use GitHub metadata to identify candidate runs before reading artifact contents. The implementation Engineer may inspect recent successful `main` Quality Budgets runs and artifact metadata with read-only `gh` commands, for example:

```bash
gh run list --workflow "Quality Budgets" --branch main --status success --limit 10
```

```bash
gh api repos/victorlovescoding/dive-into-run/actions/runs/<run-id>
```

```bash
gh api repos/victorlovescoding/dive-into-run/actions/runs/<run-id>/artifacts
```

Artifact payload extraction must not leave raw reports in the repository. If the Engineer cannot inspect artifact contents without creating repo-local raw reports, stop and report blocked status. If a temporary extraction outside the repo is explicitly approved by the dispatcher for the implementation phase, extract only long enough to compute normalized values, then remove the temporary payload before review evidence is collected.

Candidate run requirements:

- Workflow name is `Quality Budgets`.
- Branch is `main`.
- Run conclusion is successful.
- Run has usable `quality-budget-reports` artifact metadata or equivalent Quality Budgets artifact metadata.
- Run metadata identifies `runId`, `runAttempt` when available, `runUrl`, `headSha`, `headBranch`, and `createdAt` or `completedAt`.
- Minimum usable source set is 3 runs; maximum committed sample set is 5 runs.

Stop before writing baselines if fewer than 3 usable successful `main` runs are available, if a source run cannot be traced to a workflow run and head SHA, or if collection would require committing raw artifacts.

## Task 1: Baseline Collector

**Files:**

- Create: `config/quality-baseline-summary.json`
- Read-only context: `docs/quality/2026-05-12-quality-baseline-pr-a-design.md`, `.github/workflows/quality-budgets.yml`, `scripts/summarize-quality-baselines.mjs`, `package.json`
- Forbidden: `project-health/**`, `reports/**`, app code, tests, workflows, package metadata

- [ ] **Step 1: Confirm branch and clean task boundary**

Run:

```bash
git status --short --branch
```

Expected: branch is `050-quality-baseline-pr-a`; no relevant unowned changes block writing `config/quality-baseline-summary.json`.

- [ ] **Step 2: Identify 3-5 candidate successful `main` Quality Budgets runs**

Run:

```bash
gh run list --workflow "Quality Budgets" --branch main --status success --limit 10
```

Expected: at least 3 candidate successful runs are visible. Record only run IDs, dates, head SHAs, attempts when available, and URLs needed for traceability.

- [ ] **Step 3: Inspect artifact metadata for each candidate run**

Run once per candidate run:

```bash
gh api repos/victorlovescoding/dive-into-run/actions/runs/<run-id>/artifacts
```

Expected: each selected run has a Quality Budgets artifact such as `quality-budget-reports`. If fewer than 3 selected runs have usable artifacts, stop with blocked status.

- [ ] **Step 4: Normalize observed metrics without committing raw reports**

Extract only the metric values needed for the normalized JSON. Preserve these metric domains when present in the source artifacts:

- Knip: unused file count, issue file count, unused production dependency count, unlisted dependency count, unused export count.
- Bundle budget: route count, warning count, finding count, largest first-load route when available.
- Strict type-check: exit code and report path signal.
- Lighthouse: run count, representative run count, representative URLs, minimum representative performance score.

Expected: each normalized metric sample is tied to a `runId`. Missing or partially parsed metrics are represented with `notes`, not invented values.

- [ ] **Step 5: Write deterministic committed JSON**

Create `config/quality-baseline-summary.json` with this stable top-level contract:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-12T00:00:00.000Z",
  "status": "report-only",
  "outlierEvaluation": "not_evaluated",
  "source": {
    "workflowName": "Quality Budgets",
    "branch": "main",
    "artifactCount": 3
  },
  "runs": [],
  "metrics": {}
}
```

Expected:

- `generatedAt` is deterministic for the committed baseline.
- `status` is exactly `report-only`.
- `outlierEvaluation` is exactly `not_evaluated`.
- `source.artifactCount` matches the number of selected usable artifacts.
- `runs[]` contains only traceability metadata and artifact names or IDs.
- `metrics` contains observed samples, median, max, unit, and notes.
- PR A does not evaluate statistical outliers; do not add per-metric `outliers`
  lists. Future PRs must define an explicit outlier rule before adding outlier
  lists, thresholds, or gate behavior.
- No field encodes a threshold, limit, budget, pass/fail gate, or CI enforcement decision.

- [ ] **Step 6: Verify JSON syntax**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('config/quality-baseline-summary.json', 'utf8')); console.log('json ok')"
```

Expected: exits 0 and prints `json ok`.

- [ ] **Step 7: Report Engineer evidence**

Return:

- selected run IDs, head SHAs, and artifact names or IDs.
- changed file list containing only `config/quality-baseline-summary.json`.
- verification command output summary with exit code.
- explicit statement that no raw reports, `reports/**`, `project-health/**`, thresholds, or app code were written.

## Task 2: Evidence Writer

**Files:**

- Create: `docs/quality/2026-05-12-quality-baseline-pr-a.md`
- Read-only context: `config/quality-baseline-summary.json`, `docs/quality/2026-05-12-quality-baseline-pr-a-design.md`
- Forbidden: `project-health/**`, `reports/**`, app code, tests, workflows, package metadata

- [ ] **Step 1: Confirm baseline JSON exists and is parseable**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('config/quality-baseline-summary.json', 'utf8')); console.log('json ok')"
```

Expected: exits 0 and prints `json ok`.

- [ ] **Step 2: Write reviewer/SOP evidence Markdown**

Create `docs/quality/2026-05-12-quality-baseline-pr-a.md` with these sections:

- `# PR A Quality Baseline Collection`
- `## Summary`
- `## Source Runs`
- `## Observed Metrics`
- `## Limitations`
- `## Future Gate Handoff`
- `## Verification`

Required content:

- collection window and number of selected successful `main` workflow runs.
- source table with run ID, head SHA, date, artifact name or ID, and run URL.
- metric table with sample count, median, max, and notes.
- statement that raw artifacts and `reports/**` payloads remain uncommitted.
- statement that the baseline is report-only and defines no hard thresholds.
- statement that `outlierEvaluation` is `not_evaluated` because PR A does not
  evaluate statistical outliers.
- limitations for missing artifacts, partial parsing, or low sample count when applicable.
- future handoff explaining that later PRs may consume `config/quality-baseline-summary.json` as input, but PR A does not enforce gates.

Expected: Markdown summarizes normalized values from the committed JSON and does not duplicate raw artifact JSON.

- [ ] **Step 3: Verify forbidden wording and files**

Run:

```bash
git status --short --branch
```

Expected: changed files are limited to the baseline JSON plus `docs/quality/2026-05-12-quality-baseline-pr-a.md`, unless Task 3 was separately authorized.

- [ ] **Step 4: Report Engineer evidence**

Return:

- changed file list containing only the owned Markdown file for this task.
- source run table row count.
- explicit report-only and no-hard-threshold wording location.
- explicit statement that `project-health/**`, raw reports, `reports/**`, and app code were not written.

## Task 3: Summarizer Polish Only If Blocked

**Files:**

- Modify only if blocked: `scripts/summarize-quality-baselines.mjs`
- Modify only if script changes: `tests/unit/scripts/quality-baseline-summary.test.js`
- Read-only context: `docs/quality/2026-05-12-quality-baseline-pr-a-design.md`, `.github/workflows/quality-budgets.yml`, `package.json`
- Forbidden: `project-health/**`, `reports/**` committed output, app code, workflows, package metadata

Enter this task only when Task 1 cannot produce deterministic committed JSON or required run metadata with the existing summarizer. Do not enter this task for style cleanup or broader reporting improvements.

- [ ] **Step 1: State the blocker before editing**

Engineer report must name the exact blocker, for example:

- existing summary writes only ignored `reports/quality-baselines/summary.json`.
- existing summary lacks workflow run metadata needed by `runs[]`.
- existing summary lacks deterministic output controls needed for committed JSON.

Expected: blocker maps directly to the approved design doc deliverable.

- [ ] **Step 2: Add focused failing coverage**

Modify `tests/unit/scripts/quality-baseline-summary.test.js` only for the blocked behavior. The focused assertion must prove deterministic committed JSON generation or metadata capture, and it must keep report-only behavior.

Run:

```bash
npx vitest run --project=browser tests/unit/scripts/quality-baseline-summary.test.js
```

Expected before implementation: fails for the new blocked behavior and existing tests still describe current report-only artifact summaries.

- [ ] **Step 3: Implement the smallest summarizer change**

Modify `scripts/summarize-quality-baselines.mjs` only enough to unblock Task 1. Preserve:

- `status: "report-only"`.
- ignored raw artifact summary behavior.
- no thresholds.
- no CI enforcement.
- no workflow or package script dependency.

Expected: the script can generate or support deterministic normalized JSON and capture required metadata without committing raw artifact bodies.

- [ ] **Step 4: Run focused summarizer test**

Run:

```bash
npx vitest run --project=browser tests/unit/scripts/quality-baseline-summary.test.js
```

Expected: exits 0 and all tests in `tests/unit/scripts/quality-baseline-summary.test.js` pass.

- [ ] **Step 5: Report Engineer evidence**

Return:

- blocker statement.
- changed files limited to `scripts/summarize-quality-baselines.mjs` and `tests/unit/scripts/quality-baseline-summary.test.js`.
- focused test command output summary with exit code.
- explicit statement that no threshold, workflow, package script, app code, raw report, or `project-health/**` change was made.

## Task 4: Integration, Reviewer Gate, And PR Body Prep

**Files:**

- Read-only diff: task-owned files changed by Tasks 1-3.
- No new writes unless the Reviewer rejects a specific slice and the main agent dispatches a revised Engineer contract.

- [ ] **Step 1: Inspect final changed-file set**

Run:

```bash
git status --short --branch
```

Expected: changed files are limited to:

- `config/quality-baseline-summary.json`
- `docs/quality/2026-05-12-quality-baseline-pr-a.md`
- `scripts/summarize-quality-baselines.mjs` only if Task 3 was entered
- `tests/unit/scripts/quality-baseline-summary.test.js` only if Task 3 was entered

- [ ] **Step 2: Run whitespace verification**

Run:

```bash
git diff --check
```

Expected: exits 0 with no whitespace errors.

- [ ] **Step 3: Run JSON parse verification**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('config/quality-baseline-summary.json', 'utf8')); console.log('json ok')"
```

Expected: exits 0 and prints `json ok`.

- [ ] **Step 4: Run focused test when Task 3 changed script behavior**

Run only if `scripts/summarize-quality-baselines.mjs` or `tests/unit/scripts/quality-baseline-summary.test.js` changed:

```bash
npx vitest run --project=browser tests/unit/scripts/quality-baseline-summary.test.js
```

Expected: exits 0.

- [ ] **Step 5: Reviewer checks each slice**

Reviewer PASS requires:

- JSON includes 3-5 usable successful `main` source runs and traceable run/head metadata.
- JSON status is report-only and contains no hard thresholds or gate decisions.
- Markdown source table and metric table agree with the JSON.
- Markdown states raw artifacts remain uncommitted and PR A defines no hard thresholds.
- No `project-health/**`, raw reports, `reports/**`, app code, workflow, package script, dependency, lockfile, or ignore-policy edits are present.
- Each verification command is fresh and recorded as one command per evidence item.

Reviewer REJECT requires a concrete file/line or command-evidence reason and returns the affected slice to an Engineer.

- [ ] **Step 6: Prepare PR body after Reviewer pass**

Use this PR body shape:

```markdown
## Summary
- Collects 3-5 successful main-branch Quality Budgets artifacts into a report-only normalized baseline JSON.
- Adds reviewer/SOP Markdown evidence for the PR A baseline collection.
- Keeps raw artifacts uncommitted and defines no hard thresholds.

## Non-Scope
- No project-health updates.
- No app code changes.
- No CI gate or threshold enforcement.

## Verification
- `git diff --check`
- `node -e "JSON.parse(require('node:fs').readFileSync('config/quality-baseline-summary.json', 'utf8')); console.log('json ok')"`
```

If Task 3 ran, add the focused Vitest command to the PR body verification list.

Expected: PR body is ready for main-agent closeout after explicit authorization to commit, push, and open a PR.

## Stop Conditions

Stop and return blocked status if any of these occur:

- fewer than 3 usable successful `main` Quality Budgets runs are available.
- source run metadata cannot identify workflow run ID and head SHA.
- artifact inspection requires committing raw report files or repo-local `reports/**` payloads.
- implementation would require editing `project-health/**`, app code, dependencies, lockfile, ignore policy, workflow files, or package scripts without a revised authorization boundary.
- test changes expand beyond focused summarizer behavior coverage.
- any JSON or Markdown field would encode a hard threshold, pass/fail budget, CI gate, or enforcement decision.
- raw artifact bodies must be duplicated into Markdown to make the PR understandable.
- existing worktree changes outside assigned owned files are relevant and cannot be safely ignored.

## Verification Matrix

- `git status --short --branch`
  - Expected signal: branch is `050-quality-baseline-pr-a`; changed files stay inside the approved PR A write set.
- `git diff --check`
  - Expected signal: exits 0 with no whitespace errors.
- `node -e "JSON.parse(require('node:fs').readFileSync('config/quality-baseline-summary.json', 'utf8')); console.log('json ok')"`
  - Expected signal: exits 0 and prints `json ok`.
- `npx vitest run --project=browser tests/unit/scripts/quality-baseline-summary.test.js`
  - Expected signal: exits 0 when Task 3 changes summarizer behavior.
- Reviewer subagent check
  - Expected signal: `review_passed` only after traceability, report-only wording, forbidden-file exclusions, and verification evidence all match this plan.

## Self-Review Against Approved Design

- Scope coverage: Task 1 creates `config/quality-baseline-summary.json`; Task 2 creates `docs/quality/2026-05-12-quality-baseline-pr-a.md`; Task 3 covers conditional summarizer and focused test updates; Task 4 covers integration, Reviewer gate, verification, and PR body preparation.
- Non-scope coverage: plan explicitly forbids `project-health/**`, raw reports, `reports/**` committed payloads, hard thresholds, app code, workflow/package/dependency changes by default, and broad test work.
- Data uncertainty: plan defines the collection procedure and stop conditions, but does not invent baseline values before artifacts are inspected.
- Verification coverage: plan uses one command per evidence item and includes expected signals for status, whitespace, JSON parse, focused Vitest when needed, and Reviewer pass.
