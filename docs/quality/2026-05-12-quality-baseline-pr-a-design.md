# PR A Quality Baseline Collection / Summary Polish Design

Status: Approved design direction for future implementation. No code, config,
or project-health changes are made by this document.

## Scope

PR A collects recent main-branch Quality Budgets workflow evidence and publishes
a reviewed baseline summary in two forms:

- normalized JSON under `config/` for future quality gate input.
- Markdown evidence under `docs/quality/` for reviewer and SOP use.

The baseline is report-only. It records observed values from 3-5 successful
main-branch Quality Budgets workflow artifacts, including traceable workflow
run and head metadata.

## Non-scope

- Gap C semantic drift analysis or enforcement.
- Hard thresholds, pass/fail budgets, or CI blocking behavior.
- Committing raw reports, downloaded artifacts, or generated `reports/**`
  payloads.
- Updating `project-health/**`, including backlog checkboxes or status text.
- Changing application code or ignored artifact policy.
- Treating tests as a standalone deliverable; focused tests may be updated only
  when summarizer behavior changes.
- Changing workflows or package scripts by default; touch them only if the
  existing collection or summary entrypoint blocks PR A.

## Deliverables

- `config/quality-baseline-summary.json`
  - committed normalized baseline input for future gates.
  - includes source run metadata, observed metrics, and report-only status.
- `docs/quality/2026-05-12-quality-baseline-pr-a.md`
  - committed human-readable evidence summary.
  - explains what was collected, from which runs, and what the observed median,
    max, and report-only limitations imply.
- Optional implementation notes in PR body only.
  - do not create temporary planning files unless explicitly authorized.

## Proposed Files / Ownership

Future Engineer subagents should own only the files assigned to their slice.
Suggested write ownership:

- Slice 1: `config/quality-baseline-summary.json`
- Slice 2: `docs/quality/2026-05-12-quality-baseline-pr-a.md`
- Slice 3, only if needed: `scripts/summarize-quality-baselines.mjs`

`project-health/**`, raw `reports/**` artifacts, and app code remain forbidden.
Tests are not a standalone deliverable, but a future Engineer may update
focused tests when `scripts/summarize-quality-baselines.mjs` behavior changes.
Workflow and package script touchups are out by default and require a clear
blocker in the existing collection or summary entrypoint.

## Data Shape Expectations For Normalized JSON

The JSON should be deterministic, stable enough for later gate consumers, and
free of raw artifact bodies. Recommended top-level shape:

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

Each `runs[]` entry should include traceability:

- `runId`
- `runAttempt` when available
- `runUrl`
- `headSha`
- `headBranch`
- `createdAt` or `completedAt`
- artifact names or IDs used for the summary

Each metric entry should include observed values only:

- `samples`: numeric values with their source `runId`.
- `median`: observed median across collected samples.
- `max`: observed maximum across collected samples.
- `unit`: count, bytes, score, route count, warning count, or another concrete
  unit.
- `notes`: short explanation when parsing is partial or a metric is absent.

PR A does not evaluate statistical outliers. The schema signal is the top-level
`outlierEvaluation: "not_evaluated"` field, not per-metric `outliers` lists.
Future PRs must define an explicit outlier rule before adding outlier lists,
thresholds, or gate behavior.

The current summarizer names these raw sources: Knip, bundle budget, strict
type-check, and Lighthouse. PR A may normalize those same domains, but should
not freeze thresholds from them yet.

## Markdown Evidence Expectations

The Markdown evidence should be reviewer-oriented and short enough to audit in
a PR. It should include:

- Collection window and number of main-branch workflow runs.
- Source table with run ID, head SHA, date, artifact name or ID, and run URL.
- Metric table showing sample count, median, max, and notes.
- Explicit statement that raw artifacts remain ignored and are not committed.
- Explicit statement that the baseline is report-only and defines no hard
  thresholds.
- Explicit statement that `outlierEvaluation` is `not_evaluated` because PR A
  does not evaluate statistical outliers.
- Known limitations, especially missing artifacts, partial parsing, or
  low sample count.
- Future gate handoff: how `config/quality-baseline-summary.json` should be
  consumed by later PRs.

Avoid duplicating raw artifact JSON in the Markdown. Link or identify workflow
runs instead.

## Implementation Slices For Future Engineer Subagents

1. Baseline collector
   - Read 3-5 successful main-branch Quality Budgets workflow artifacts.
   - Extract run/head metadata and normalized metric samples.
   - Write only `config/quality-baseline-summary.json`.
   - Stop if fewer than 3 usable main-branch runs are available.

2. Evidence writer
   - Read the normalized JSON and source run metadata.
   - Write only `docs/quality/2026-05-12-quality-baseline-pr-a.md`.
   - Keep the report audit-focused; do not update `project-health/**`.

3. Summarizer polish, if required
   - Touch `scripts/summarize-quality-baselines.mjs` only if the existing script
     blocks deterministic JSON generation or metadata capture.
   - Preserve report-only behavior and ignored raw artifact output.
   - Do not add thresholds.

Each slice needs its own Engineer result and Reviewer check. The main agent
coordinates only: dispatch, evidence collection, PR closeout, and status
reporting.

## Verification Plan

Run fresh verification, one command per evidence item:

- `git status --short --branch`
  - confirms branch/worktree isolation and changed-file set.
- `git diff --check`
  - confirms no whitespace errors in committed docs/config changes.
- JSON parse check for `config/quality-baseline-summary.json`
  - confirms the normalized summary is valid JSON.
- Markdown review by Reviewer subagent
  - confirms traceability, report-only wording, no raw artifacts, and no
    `project-health/**` edits.

If `scripts/summarize-quality-baselines.mjs` changes, add its focused test or
the smallest available command that exercises the changed behavior.

## Stop Conditions

Stop and return blocked status if:

- The collected source set has fewer than 3 usable successful main-branch runs.
- Run metadata cannot identify source workflow run and head SHA.
- A future implementation requires changing `project-health/**`, app code,
  dependencies, or raw artifact ignore policy.
- Workflow or package script changes are proposed without proving the existing
  collection or summary entrypoint blocks PR A.
- Test changes expand beyond focused coverage for summarizer behavior changes.
- Any proposed JSON field would encode a hard threshold or CI gate result.
- Raw reports must be committed to make the PR understandable.
- Existing worktree changes outside the assigned owned files appear relevant
  and cannot be safely ignored.

## Closeout Path

PR A closeout should follow the repo default:

1. Engineer subagent implements owned slices in the isolated worktree.
2. Reviewer subagent checks the task-local diff and fresh verification.
3. Main agent stages only the concrete PR A files after Reviewer pass.
4. Commit on `050-quality-baseline-pr-a` with no `Co-Authored-By`.
5. Push the branch and open a PR.
6. Wait for required `ci` and `e2e` checks to pass.
7. Merge on GitHub, then fast-forward local `main` only when authorized.

Do not mark the project-health backlog item complete in PR A.
