# Superpowers Task Contract

> Last-Verified: 2026-05-11

This is the canonical contract for one independently deliverable task slice in
`specs/<feature>/tasks.md` and `specs/<feature>/status.json`.

## Roles

- Main agent: coordinator only. It owns dispatch, status updates, user-facing
  summaries, and stop-condition enforcement.
- Engineer: implements exactly one task attempt inside the owned write set.
- Reviewer: checks the task-local diff, reruns relevant verification, and
  records `review_passed`, `review_rejected`, or `blocked`.

The main agent must not edit production code or executable tests for
implementation tasks. It may edit workflow state after `review_passed`,
`review_rejected`, or a real blocker.

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
- Reviewer PASS criteria: checks required before `review_passed`.
- Reviewer REJECT criteria: defects that force `review_rejected`.
- Evidence: Engineer report, Reviewer report, command output summary, and
  changed files summary.

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

## State Sync Rules

- `tasks.md`, `status.json`, and `handoff.md` must describe the same current
  state before dispatch.
- Drift between those files is a stop condition.
- The coordinator must reconcile drift before dispatching an Engineer or
  Reviewer.
- `handoff.md` must name the active task, active wave, latest reviewer decision,
  and blocker state from `status.json`.
- `tasks.md` remains the human-readable task board; `status.json` mirrors the
  active machine state; `handoff.md` carries the next-session summary.

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

`status.json.lastVerification` remains command-oriented: one object per command.
