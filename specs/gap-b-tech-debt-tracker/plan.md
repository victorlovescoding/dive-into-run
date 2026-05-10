# Gap B Tech-Debt Tracker Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

## Goal

Create a docs-only, versioned technical-debt tracker that converts scattered known findings into a durable repo entry point.

## Architecture

- `docs/TECH_DEBT.md` will be the long-lived tracker.
- `specs/gap-b-tech-debt-tracker/` will remain the workflow backend for this execution: spec, plan, tasks, handoff, and status.
- Evidence sources stay read-only. The tracker records debt; it does not modify the source reports.
- The split is strict:
  - Mechanical rule: lint, test, script, or CI follow-up.
  - Product or architecture debt: `docs/TECH_DEBT.md`.
  - Immediate session state: feature `handoff.md`.
  - Recurring agent pitfall: Codex memory only when explicitly requested by the user.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `docs/TECH_DEBT.md` | Create | Durable tracker with open items, resolved items, update protocol, and source index. |
| `specs/gap-b-tech-debt-tracker/spec.md` | Maintain | Product intent, requirements, success criteria, and non-goals. |
| `specs/gap-b-tech-debt-tracker/plan.md` | Maintain | Technical strategy, source list, task split, verification strategy, risks, and stop conditions. |
| `specs/gap-b-tech-debt-tracker/tasks.md` | Maintain | Human-readable task board with Engineer/Reviewer evidence. |
| `specs/gap-b-tech-debt-tracker/handoff.md` | Maintain | Live next-session brief and latest verification evidence. |
| `specs/gap-b-tech-debt-tracker/status.json` | Maintain | Machine-readable dispatcher state. |

Read-only source files:

| Path | Use |
| ---- | --- |
| `/Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md` | Gap B source of truth; this file is ignored/untracked in the new worktree, so read it by absolute path. |
| `docs/QUALITY_SCORE.md` | Seed layer/domain known gaps. |
| `specs/026-tests-audit-report/handoff.md` | Seed audit, coverage, baseline, and known follow-up items. |
| `specs/027-tests-mock-cleanup/handoff.md` | Seed mock-boundary cleanup residuals and durable pitfalls that are real debt. |
| `specs/033-s9-coverage-gap/handoff.md` | Seed coverage-gap closure evidence and any remaining risk. |
| `specs/*/code-review.md` | Seed review-deferred improvement items. |
| `/Users/chentzuyu/.codex/memories/-Users-chentzuyu-Desktop-dive-into-run/entries/project_harness_lint_followup.md` | Seed deferred lint-harness options with triggers. |
| `/Users/chentzuyu/.codex/memories/-Users-chentzuyu-Desktop-dive-into-run/entries/project_harness_mock_audit.md` | Seed mock-audit optional follow-up if still relevant. |

## Data Model For `docs/TECH_DEBT.md`

Open items table:

| Field | Meaning |
| ----- | ------- |
| ID | Stable `TD-###` identifier. |
| Severity | `High`, `Medium`, or `Low`. |
| Domain | Area such as `quality`, `coverage`, `lint`, `docs`, `tests`, `architecture`, or product domain. |
| Description | Concrete debt statement; not a vague wish. |
| Origin | Source file and short evidence pointer. |
| Status | `Open`, `Deferred`, `In Progress`, or `Resolved`. |
| Next Trigger | When to fix it if not immediately actionable. |

Resolved items table:

| Field | Meaning |
| ----- | ------- |
| ID | Original debt ID. |
| Description | Short resolved item summary. |
| Resolved In | Commit, PR, or spec evidence. |
| Date | Resolution date. |

## Source Classification Rules

- Include a finding when it is actionable, durable, and not already fully resolved by current repo evidence.
- Exclude pure session-log history unless it names an unresolved debt item.
- Exclude advice that should become a mechanical sensor unless the item is explicitly about creating that sensor later.
- Exclude items already solved by current `docs/QUALITY_SCORE.md` or later handoff evidence.
- When evidence conflicts, stop and ask for reconciliation instead of guessing.

## Verification Strategy

Docs-only verification:

```bash
test -f docs/TECH_DEBT.md
node -e "JSON.parse(require('fs').readFileSync('specs/gap-b-tech-debt-tracker/status.json','utf8')); console.log('status.json ok')"
git diff --check -- docs/TECH_DEBT.md specs/gap-b-tech-debt-tracker/spec.md specs/gap-b-tech-debt-tracker/plan.md specs/gap-b-tech-debt-tracker/tasks.md specs/gap-b-tech-debt-tracker/handoff.md specs/gap-b-tech-debt-tracker/status.json
rg -n "PLACEHOLDER_VALUE|REPLACE_ME|FILL_ME" docs/TECH_DEBT.md specs/gap-b-tech-debt-tracker
```

Optional broader docs sanity after tracker creation:

```bash
npm run spellcheck
```

No production-code or executable-test gate is required unless the future implementation changes scope.

## Risk And Stop Conditions

- Stop if the user asks to include production code, executable tests, scripts, CI, hooks, or branch protection in this workflow.
- Stop if source evidence disagrees on whether a debt item is already resolved.
- Stop if the next agent cannot read the absolute Gap B source path from the original checkout.
- Stop if a proposed debt item lacks an origin or cannot be made actionable.
- Stop if `docs/TECH_DEBT.md` already appears from another worker before the implementation task starts; inspect and reconcile instead of overwriting.
- Stop if another worker modifies files under `specs/gap-b-tech-debt-tracker/` during the same task.

## Task Slices

- T001: Inventory and classify source findings.
- T002: Create `docs/TECH_DEBT.md` from the accepted inventory.
- T003: Verify tracker consistency and update workflow state.
- T004: Final reviewer closeout for docs-only scope.
