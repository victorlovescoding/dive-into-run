# Doc Gardening Automation Design

Status: Approved design artifact for future implementation planning
Date: 2026-05-12

## Context

The repo already has a minimal doc-gardening foundation:

- `scripts/doc-freshness-check.sh` checks a hard-coded key-doc set for exactly
  one `> Last-Verified: YYYY-MM-DD` line, validates the date, and fails when it
  is older than 45 days.
- `specs/036-gap-c-doc-gardening/` records the original MVP scope: visible
  freshness metadata, a deterministic shell checker, and local/CI exposure.
- `docs/decisions/INDEX.md` records long-lived architecture and workflow
  decisions, and explicitly says ADRs are for durable cross-feature decisions,
  not session state or tech debt tracking.
- `docs/QUALITY_SCORE.md` is a manually maintained quality snapshot; its own
  update protocol names commands and sources, but it is not generated.
- `docs/TECH_DEBT.md` tracks TD-010: `QUALITY_SCORE` still has no generation or
  recurring scan that recomputes matrix inputs.

That means the repo has mechanical doc checks, but not a recurring maintainer
loop that reviews the docs system as a whole. The gap is not just stale
`Last-Verified` metadata. It also includes semantic drift, ADR/design-doc
coverage, quality-score reconciliation, tech-debt reconciliation, and broken
index/link references. Only some of those are safe to fix mechanically.

The missing historical `project-health/2026-04-24-openai-harness-gap-analysis.md`
was intended as motivation, but it is not present in this worktree. Future
implementation must not treat that missing file as editable source of truth or
infer requirements from it.

## Goals

- Define a repo-tracked source of truth for recurring documentation gardening.
- Run the recurring job weekly on Monday at 09:00 Asia/Taipei through a Codex
  cron runner.
- Always produce a full report, even when no auto-fix PR is opened.
- Allow auto-fix PRs only for low-risk, mechanically verifiable documentation
  problems.
- Keep semantic, judgment-heavy, or quality-score work report-only.
- Keep future implementation Engineer-first, Reviewer-checked, and closed out
  through the repo's branch, PR, CI, merge, and local main sync workflow.

## Non-Goals

- No automation implementation in this design artifact.
- No scripts, package scripts, CI, Codex automation, dependencies, or runtime
  behavior changes in this design artifact.
- No automatic semantic rewriting of docs.
- No automatic `QUALITY_SCORE` scoring, grade changes, or tech-debt closure.
- No automatic ADR creation, ADR acceptance, or design decision changes.
- No direct edits to historical `project-health/` reports.

## Proposed Approach

Choose approach C: repo-tracked source of truth plus Codex cron actual recurring
runner.

The repo source of truth defines what to inspect, which findings can be
auto-fixed, which findings are forbidden from auto-fix, the branch and PR rules,
verification commands, and stop conditions. The Codex cron prompt stays thin:
it references the repo source of truth and the weekly cadence instead of
duplicating policy. This keeps rules reviewable in git and avoids policy drift
between a local doc and a scheduler prompt.

The scheduled runner always creates a report. If it finds only low-risk
mechanically verifiable mismatches, it may also create a branch and draft or
ready PR according to the repo source of truth. If it finds semantic or
judgment-heavy problems, it records them in the report and stops without
editing those areas.

## Alternatives Considered

### A. Report-Only Cron

This is safest, but leaves obvious metadata and index mismatch cleanup to manual
work every week. It would repeat the same low-risk fixes without improving repo
health.

### B. Repo Script Only

A script is reviewable and easy to run locally, but it does not solve recurring
execution. Someone still has to remember to run it and interpret the output.

### C. Repo Source Of Truth Plus Codex Cron

This wins because the durable policy lives in the repo while execution happens
on a schedule. It separates governance from the scheduler prompt and supports
both full reporting and narrow auto-fix PRs.

### D. Fully Autonomous Doc Maintainer

This is too broad for the repo's safety model. It would blur mechanical fixes
with semantic editing, quality scoring, ADR acceptance, and tech-debt judgment.
Those areas require human or Reviewer judgment and must remain report-only.

## Architecture And Components

### Repo Source Of Truth Contract

The future source-of-truth document should define:

- Check inventory: freshness metadata, doc links, index membership, ADR/design
  coverage signals, `TECH_DEBT` references, and `QUALITY_SCORE` review signals.
- Allowed auto-fixes: only metadata, link, and index mismatches that are
  mechanically verifiable.
- Forbidden auto-fixes: semantic drift, `QUALITY_SCORE` grades or score history,
  `TECH_DEBT` item status, ADR acceptance or decision text, design-doc coverage
  conclusions, and any change requiring product or architecture judgment.
- Branch and PR rules: use a feature branch/worktree, never edit `main`
  directly, stage explicit files only, and open a PR for any repo change.
- Verification commands: at minimum `git diff --check`, existing doc freshness
  checks, focused link/index checks introduced by the implementation, and any
  source-of-truth validation command added later.
- Stop conditions: unclear scope, dirty unrelated changes in owned files,
  missing required context, failing verification without a mechanical fix, any
  proposed forbidden auto-fix, or need for secrets, dependencies, CI changes, or
  product behavior changes.

### Recurring Codex Cron Runner

The recurring runner is scheduled weekly, Monday 09:00 Asia/Taipei. Its prompt
should be short and stable:

- Read `AGENTS.md`, `docs/superpowers/workflow.md`,
  `docs/superpowers/task-profiles.md`, and the repo source of truth.
- Run the documented checks.
- Produce the full report.
- If and only if findings fall inside the allowed auto-fix scope, dispatch
  Engineer and Reviewer subagents, create a branch/worktree, apply the narrow
  fix, verify, push, and open a PR according to the source-of-truth rules.

The prompt must not duplicate the detailed policy. Duplicated rules would create
two competing sources of truth.

### Reporting

Every scheduled run produces a report containing:

- Run timestamp and timezone.
- Repo branch and commit inspected.
- Check results, including pass/fail/blocked status.
- Auto-fix eligibility classification for each finding.
- Verification commands and exit signals.
- Links to any PR opened by the auto-fix lane.
- Report-only findings that need human review or a future planned task.
- Stop condition, if the run stopped early.

The report is the canonical output even when no changes are made.

### Auto-Fix PR Lane

The auto-fix lane is narrow. It may only fix:

- Missing, malformed, or stale `Last-Verified` metadata when the source file is
  otherwise unchanged and verification can prove the exact metadata contract.
- Obviously nonexistent doc references when the correct mechanical action is to
  remove or update the reference according to the repo source of truth.
- Index entry mismatches where the target file exists and the index contract
  unambiguously defines inclusion or ordering.

Auto-fix PRs must use subagents: Engineer performs the owned-file edit, Reviewer
checks the diff and evidence before completion. The main agent remains
coordinator.

### Report-Only Lane

The report-only lane covers:

- Semantic drift between docs and implementation.
- `QUALITY_SCORE` data, grades, score history, and known-gap updates.
- `TECH_DEBT` item creation, status changes, closure, or priority changes.
- ADR/design-doc coverage judgments.
- Any finding that requires reading broad source context, interpreting product
  behavior, or deciding architecture policy.

The scheduled run may describe these findings and recommend next actions, but
must not edit them automatically.

## Scheduled Run Behavior

1. Start in a clean branch/worktree context. Stop if the selected worktree is
   not safe for the scheduled task.
2. Read the startup and workflow sources required by `AGENTS.md`.
3. Read the repo source of truth for doc gardening automation.
4. Run mechanical checks and collect raw command evidence.
5. Classify each finding as allowed auto-fix, report-only, or blocked.
6. Write the full report.
7. If no allowed auto-fixes exist, stop after the report.
8. If allowed auto-fixes exist, dispatch an Engineer with exact owned files,
   read-only context, acceptance criteria, and verification commands.
9. Dispatch a Reviewer for the same diff.
10. If Reviewer passes, run final verification, push the branch, and open a PR
    within the authorization boundary.
11. Stop before merge unless the future source of truth explicitly authorizes
    the normal closeout sequence for this recurring lane.

## Safety Constraints And Stop Conditions

- Never edit `main` directly.
- Never widen from docs governance into product code, runtime behavior, tests,
  package metadata, CI, dependency changes, Firebase rules, or Codex cron
  implementation unless a later user-approved implementation plan owns that
  scope.
- Never auto-fix semantic drift, `QUALITY_SCORE`, `TECH_DEBT`, ADR decisions, or
  design-doc coverage.
- Stop on untracked or modified unrelated files in the intended owned write set.
- Stop if a mechanically suggested fix conflicts with current repo docs.
- Stop if a required source file is missing and no repo source of truth defines
  how to handle that absence.
- Stop if verification fails after an auto-fix.
- Stop if a PR would include any file outside the allowed owned file set.

## Testing And Verification Plan

Future implementation should verify the source-of-truth document and runner
behavior without relying on broad manual inspection:

- `git diff --check` for markdown whitespace hygiene.
- Existing `bash scripts/doc-freshness-check.sh` or `npm run doc:freshness` for
  the current metadata gate.
- Focused source-of-truth validation checks for required sections: checks,
  allowed auto-fixes, forbidden auto-fixes, branch/PR rules, verification
  commands, and stop conditions.
- Negative-path fixtures or temp-copy checks for missing metadata, stale
  metadata, broken links, and index mismatches.
- A dry-run mode or report-only test path for semantic findings, proving they
  appear in the report but do not create edits.
- Reviewer verification that auto-fix diffs contain only mechanically allowed
  changes.

If implementation adds scripts or package commands, those changes require their
own focused tests and existing changed-file gates. This design does not add
those files.

## Implementation Workflow Constraints

Future implementation must follow the repo workflow:

- Use this worktree/feature-branch model; do not work directly on `main`.
- Use subagents for implementation and review. Main agent coordinates only.
- Engineer owns the exact write set from the implementation task.
- Reviewer checks the task-local diff, evidence, and stop conditions before the
  task is complete.
- Keep auto-fix and report-only behavior separate in both code and docs.
- After reviewed implementation, use explicit staging, commit, push, PR,
  required `ci` and `e2e` green, GitHub merge to `main`, local `main`
  fast-forward, and final branch `main`.

## Open Questions

No remaining design decision is needed for this artifact. Future implementation
still needs to choose the exact repo source-of-truth path and the exact report
storage location, but those are implementation-plan details constrained by this
design rather than unresolved product decisions.
