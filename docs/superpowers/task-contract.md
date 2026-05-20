# Superpowers Task Contract

> Last-Verified: 2026-05-11

This is the canonical contract for one independently deliverable task slice in
`specs/<feature>/tasks.md` and `specs/<feature>/status.json`.

## Roles

- Main agent: control plane only. It owns dispatch, status updates,
  user-facing summaries, authorization-boundary tracking, and stop-condition
  enforcement.
- Planner: slices repo-changing work before dispatch. It owns dependency graph,
  parallel waves, owned files, read-only context, acceptance criteria,
  verification plan, and final integration gate.
- Engineer: implements exactly one task attempt inside the owned write set.
- Reviewer: checks the task-local diff, reruns relevant verification, and
  records `review_passed`, `review_rejected`, or `blocked`.

The main agent must not edit production code, executable tests, docs, workflow
docs, ADRs, `.codex/**`, scripts, config, or other repo-changing files for
implementation tasks. It may edit workflow state only to record dispatch,
`review_passed`, `review_rejected`, a real blocker, or closeout evidence.
It also must not self-slice repo-changing work; it validates Planner output and
dispatches from that contract.

## Planner Output

Planner output for repo-changing work must include:

- Dependency graph and required execution order.
- Parallel waves with a recommended maximum of two to three same-worktree lanes.
- Owned files for each task, completely disjoint within the same wave.
- Read-only context for each task.
- Acceptance criteria for each task.
- Verification plan, including any UI browser evidence requirement.
- Wave-level final integration gate.

Shared helper, config, lockfile, and workflow state writes must serialize or
become prerequisite tasks. The main agent validates this output before dispatch
and stops if same-wave owned files overlap or dependencies are unclear.

## Required Fields

Each task must record:

- State: `todo`, `ready`, `in_progress`, `engineer_done`, `review_passed`,
  `review_rejected`, `completed`, or `blocked`.
- Attempt: integer starting at `1`, incremented after each Reviewer REJECT.
- Wave: string or number identifying the serial or parallel execution wave.
- Scope: what this task is allowed to change.
- Non-scope: explicit exclusions.
- Owned files: write set for the Engineer.
- Read-only context: files the Engineer may inspect but not modify.
- Dependencies: task IDs or external decisions required first.
- Engineer instructions: concrete implementation instructions.
- Acceptance criteria: behavior or doc outcomes required for completion.
- Verification commands with expected signal: exact commands and the success
  signal to look for.
- Browser evidence requirement for UI slices, or `not applicable` for non-UI
  work.
- Authorization boundary: whether automation may `edit`, `commit`, `push`,
  create a PR (`pullRequest`), watch CI (`ciWatch`), `merge`, sync local
  `main` (`localMainSync`), and deploy Firestore/storage rules
  (`deployFirestoreRules`); P1/P2/P3 without approved `spec.md` must record
  this explicitly.
- Reviewer PASS criteria: checks required before `review_passed`.
- Reviewer REJECT criteria: defects that force `review_rejected`.
- Evidence: Engineer report, Reviewer report, command output summary, and
  changed files summary.

## Status Schema Version 3

New `status.json` files use `schemaVersion: 3` and must match
`docs/superpowers/status.schema.json`.

Required v3 release-state fields:

- `authorizationBoundary.deployFirestoreRules`: boolean. This is separate from
  `edit`, `commit`, `push`, `pullRequest`, `ciWatch`, `merge`, and
  `localMainSync` authorization.
- `currentHead`: `null`, a non-empty string, or a lightweight snapshot object
  for the local branch/head when status is captured.
- `remoteHead`: `null`, a non-empty string, or a lightweight snapshot object
  for the tracking remote when status is captured.
- `lastVerifiedCommit`: `null` or the commit/ref covered by the latest fresh
  verification evidence.
- `phaseCommits`: array of non-empty refs or objects that include at least one
  commit reference field (`ref`, `commit`, `commitRef`, or `sha`) plus optional
  `phase`, `summary`, and `committedAt`.
- `rulesDeployStatus`: object with `state`, `required`, `changed`,
  `evidence`, and `deployedCommit`.
- `incidents`: array of `{ id, state, summary, openedAt?, closedAt? }` entries
  for workflow or release incidents.

`rulesDeployStatus.state` values:

- `not_applicable`: no Firestore/storage rules surface is involved.
- `not_required`: rules surface was considered and no deploy is required.
- `required`: rules changes or release conditions require a deploy later.
- `pending`: deploy is authorized or planned but not yet evidenced.
- `blocked`: deploy is required but cannot proceed.
- `deployed`: deploy completed with evidence recorded.

Rules deployment is a release boundary. Do not treat `edit`, `commit`, `push`,
`pullRequest`, `ciWatch`, `merge`, or `localMainSync` as deploy evidence.
Final summaries must not imply deployed rules or deployed product behavior unless
`rulesDeployStatus.state === "deployed"` and `rulesDeployStatus.evidence`
contains deploy evidence.

PR creation (`pullRequest`), CI watching (`ciWatch`), and `merge` may proceed
with `rulesDeployStatus.state` of `required`, `pending`, or `blocked` when the
release risk is explicit and no deployed-rules or rules-backed product behavior
claim is made. Missing `authorizationBoundary.deployFirestoreRules` blocks the
actual deploy command and deployed-rules claims, not ordinary `edit`, `commit`,
`push`, `pullRequest`, `ciWatch`, `merge`, or `localMainSync` boundaries that
have their own authorization.

## State Rules

- `todo`: task is unstarted.
- `ready`: dependencies are satisfied and the task can be dispatched.
- `in_progress`: Engineer is actively working.
- `engineer_done`: Engineer reported implementation and evidence.
- `review_passed`: Reviewer approved the task-local diff and evidence.
- `review_rejected`: Reviewer rejected the task-local diff or evidence.
- `completed`: coordinator synced `tasks.md`, `status.json`, and `handoff.md`
  after `review_passed`.
- `blocked`: a stop condition or missing decision prevents progress.

Canonical lifecycle:

```text
todo -> ready -> in_progress -> engineer_done -> review_passed -> completed
```

Reviewer rejection path:

```text
engineer_done -> review_rejected -> ready
```

`review_passed` and `review_rejected` are Reviewer outcomes. `completed` is the
coordinator-synced final task state. A failed command or missing evidence cannot
be overridden by the main agent.

## State Transition Table

| From | To | Actor | Required evidence / condition | Notes |
| ---- | -- | ----- | ----------------------------- | ----- |
| `todo` | `ready` | Main agent | Dependencies satisfied, owned files and non-scope recorded | Do not dispatch if state files drift. |
| `ready` | `in_progress` | Main agent | Engineer dispatch includes scope, owned files, non-scope, verification, and stop conditions | Engineer may write only owned files. |
| `in_progress` | `engineer_done` | Engineer | Changed files, commands, exit codes, expected/actual signal, risks | Missing verification keeps the task in progress or blocked. |
| `engineer_done` | `review_passed` | Reviewer | Diff checked, owned-file boundary verified, commands rerun or validated, PASS reason | Main agent still must sync state before `completed`. |
| `engineer_done` | `review_rejected` | Reviewer | Concrete REJECT reason, affected files/commands, fix expectation | Increment attempt and return to `ready` for the same Engineer unless the plan/context is flawed. |
| `review_rejected` | `ready` | Main agent | Re-dispatch brief names rejection, expected fix, unchanged owned files or approved update | Do not silently expand scope. |
| `engineer_done` | `blocked` | Reviewer or Main agent | Stop condition, missing decision, permission, secret, migration, or plan flaw | Ask the user before continuing. |
| `review_passed` | `completed` | Main agent | `tasks.md`, `status.json`, and `handoff.md` synced; final evidence recorded | Never complete directly from `engineer_done`. |
| Any state | `blocked` | Main agent | Contradictory docs, forbidden scope, destructive operation, or second unresolved rejection | Stop rather than guessing. |

After the first `review_rejected`, increment `attempt` and return the task to
`ready` with the same Engineer by default. After a second `review_rejected`,
stop unless the Reviewer identified a narrow, mechanical fix inside the same
owned files and verification path. Stop immediately when the rejection points to
a flawed plan, missing context, scope expansion, blocked dependency, or
pre-existing failure outside the task.

## Dispatch Minimum Format

Engineer dispatch must include:

- task id, profile, current state, attempt, wave, branch/worktree, and working
  directory.
- scope, non-scope, owned files, and read-only context.
- authorization boundary, including `edit`, `commit`, `push`, `pullRequest`,
  `ciWatch`, `merge`, `localMainSync`, and `deployFirestoreRules`.
- dependencies and any same-wave parallel lanes.
- implementation instructions and acceptance criteria.
- exact verification commands with expected signal.
- browser evidence fields for UI work, including target URL, journey,
  viewport, tool used, screenshot artifact, expected vs actual UI signal, and
  console/network findings.
- stop conditions, including owned-file overflow, new dependency, migration,
  secrets, permissions, rules deploy boundary, destructive operation, or
  unrelated failing gate.
- required final report fields: status, changed files, commands with exit
  codes, expected/actual signal, rules deploy status when relevant, risks, and
  unverified items.

Reviewer dispatch must include:

- task id, profile, attempt, branch/worktree, working directory, and the
  Engineer report.
- owned files and non-scope to compare against the diff.
- exact commands the Reviewer must rerun or validate, with expected signal.
- PASS criteria and REJECT/BLOCKED criteria.
- required report fields: one decision (`review_passed`,
  `review_rejected`, or `blocked`), diff checked, commands, exit codes, reason,
  and residual risk.

## State Sync Rules

- `tasks.md`, `status.json`, and `handoff.md` must describe the same current
  state before dispatch.
- Drift between those files is a stop condition.
- The coordinator must reconcile drift before dispatching an Engineer or
  Reviewer, committing, pushing, opening a PR, merging, or syncing local
  `main`.
- `handoff.md` must name the active task, active wave, latest reviewer decision,
  and blocker state from `status.json`.
- `tasks.md` remains the human-readable task board; `status.json` mirrors the
  active machine state; `handoff.md` carries the next-session summary.
- Reviewer PASS cannot be replaced by main-agent self-check.

## Boundaries

Engineer may:

- Modify only owned files.
- Read read-only context.
- Run task verification commands.
- Report risks and uncertainty.

Engineer must stop when:

- Required changes exceed owned files.
- Scope conflicts with `spec.md`, `plan.md`, or this task block.
- A command failure reveals a plan flaw or unrelated repository problem.
- A dependency, secret, permission, migration, data deletion, or new package is
  required.

Reviewer may:

- Inspect task-local diff and relevant context.
- Rerun verification.
- Return `review_passed`, `review_rejected`, or `blocked` with concrete
  evidence.

Reviewer must reject when:

- The diff touches files outside owned files without prior authorization.
- Acceptance criteria are unmet.
- Verification is missing, stale, or has the wrong expected signal.
- Behavior or docs drift outside task scope.
- Evidence cannot support the claimed state.

## Parallel Dispatch

- Default dispatch is one Engineer + Reviewer pair at a time.
- Parallel dispatch is allowed only when owned files are completely disjoint.
- Planner must account for task dependencies and execution order before any
  parallel wave starts.
- Shared helpers, config, lockfiles, and workflow state cannot be parallel
  writes.
- Every parallel lane must have its own Reviewer.
- A final integration gate must run after the wave before any closeout claim.
- Tasks that need a shared file must serialize, or split the shared-file change
  into a prerequisite shared-helper task.

## Evidence Standard

Reports must be concise but auditable:

- Engineer report: files changed, commands run, exit codes, risks, and final
  task state.
- Reviewer report: `review_passed`, `review_rejected`, or `blocked`, diff
  checked, commands run, exit codes, and reason.
- Command output summary: one entry per command; do not merge multiple commands
  into one result.
- Changed files summary: exact paths and the reason each file changed.
- Final summary: describe rules/product release state only as far as
  `rulesDeployStatus` and deploy evidence prove. If deploy is not recorded as
  `deployed`, say deploy is pending, blocked, not required, or not applicable.

`status.json.lastVerification` remains command-oriented: one object per command.
Do not record shell chains with `&&` or `;` as one command entry. Split them
into separate entries with their own exit codes and summaries. Subagent
narrative is only a hint unless backed by raw command summary, file:line
evidence, or reviewed diff.
