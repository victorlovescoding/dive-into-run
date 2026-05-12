# Doc Gardening Source of Truth
> Last-Verified: 2026-05-12

## Purpose

This document defines the repo-tracked source-of-truth contract for recurring
documentation gardening. Checkers and the weekly Codex automation must
reference this document for policy instead of duplicating the policy in runner
prompts, scripts, or reports.

The contract separates mechanically verifiable documentation cleanup from
judgment-heavy documentation review. Mechanical findings may enter the narrow
auto-fix lane only when this document allows it. Semantic, architectural,
quality, debt, or coverage findings stay report-only.

## Source of Truth Hierarchy

When documentation governance sources disagree, resolve conflicts in this
order:

1. `AGENTS.md`
2. `.codex/rules/**`
3. `.codex/references/**`
4. `docs/decisions/INDEX.md`
5. Active `specs/<feature>/handoff.md`, `tasks.md`, and `status.json`

`project-health/**` files are observation reports only and not editable source
of truth. They may provide historical context for a human reader, but the
checker and weekly automation must not treat them as policy sources or modify
them as part of doc gardening.

## Source Of Truth Contract

| Path | Status | Contract |
| --- | --- | --- |
| AGENTS.md | active | doc-governance-source |
| docs/automation/doc-gardening-sot.md | active | doc-governance-source |
| docs/decisions/INDEX.md | active | doc-governance-source |
| docs/superpowers/workflow.md | active | doc-governance-source |
| docs/superpowers/task-profiles.md | active | doc-governance-source |
| .codex/rules/sensors.md | active | doc-governance-source |
| .codex/references/quality-gates.md | active | doc-governance-source |
| .codex/references/review-standards.md | active | doc-governance-source |

## Run Cadence

Doc gardening runs weekly on Monday at 09:00 Asia/Taipei through Codex
automation.

Every run must produce a full report. A clean run, blocked run, report-only
run, or auto-fix run all require the report output.

## Auto-Fix Classes

Only these finding classes are eligible for automatic edits:

- metadata mismatch
- link mismatch
- index mismatch

Auto-fixes must be mechanically verifiable, narrowly scoped, and limited to
documentation governance cleanup. If a finding requires interpretation,
architecture judgment, product knowledge, broad source exploration, or a policy
decision, it is not an auto-fix even if it appears near an allowed class.

## Report-Only Classes

These finding classes must be reported without automatic edits:

- semantic drift
- `QUALITY_SCORE`
- `TECH_DEBT`
- ADR coverage
- design-doc coverage

Report-only findings may include recommended next steps, but the weekly
automation must not rewrite source documents, change scores, close debt, accept
ADRs, or make coverage judgments automatically.

## Runner Rules

The Codex automation prompt must reference this document and must not duplicate
the detailed policy. The prompt may state the schedule, report requirement, and
path to this document, but policy details live here.

The runner must not auto-commit. Any repo change must go through the branch,
review, verification, PR, and merge rules below.

## Subagent Rules

The main agent coordinates recurring doc gardening work. It chooses the task
boundary, records evidence, and manages closeout within the authorized scope.

Engineer edits. Reviewer reviews. Non-read-only repo-changing work requires a
Reviewer check before completion. The main agent must not replace the Reviewer
with self-review for repo changes.

## Branch And PR Rules

Repo-changing doc gardening work must use a worktree or feature branch. It must
not edit `main` directly.

Staging must use explicit paths. Do not use broad staging commands such as
`git add .`, `git add -A`, or `git add --all`.

Any repo change requires a PR. Required `ci` and `e2e` checks must be green
before merge.

## Verification Expectations

Run fresh verification before claiming doc gardening work is complete. Expected
commands include:

- `npm run doc:freshness`
- `npm run workflow:links`
- `git diff --check`
- Focused tests when scripts change

Each verification evidence item must come from its own command invocation.

## Automation Enablement Preconditions

Weekly Codex automation must not be enabled until the implementation provides a
report command and that command passes in verification. Until then, report
generation remains a policy requirement, not a current verification command.

## Stop Conditions

Stop the run instead of editing when any of these conditions apply:

- A proposed fix is outside the allowed Auto-Fix Classes.
- Required context is missing or contradicts the hierarchy above.
- Unrelated dirty or untracked files exist in the owned write set.
- Verification fails and there is no narrow mechanical fix inside the owned
  scope.
- The work requires secrets, dependency changes, schema changes, security
  changes, Firebase rules changes, CI changes, product behavior changes, or
  architecture policy changes.
- A PR would include files outside the authorized owned write set.
