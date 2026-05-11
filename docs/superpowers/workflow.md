# Superpowers Workflow

> Last-Verified: 2026-05-11

This repo uses Superpowers as the workflow language and `specs/<feature>/...` as the durable state backend.

## Goals

- Keep the main agent thin: dispatcher, status owner, and user-facing coordinator.
- Put feature state on disk so compacted or fresh sessions can resume from files, not transcript memory.
- Require Engineer + Reviewer pairing for every independently deliverable task slice.
- Preserve repo conventions: `AGENTS.md` is the entry map, `specs/` stores planning artifacts, and executable tests live under `tests/`.

## Required Feature Artifacts

Every feature that uses this workflow must keep this five-file set under `specs/<feature>/`:

| File | Purpose |
| ---- | ------- |
| `spec.md` | Product intent, user scenarios, requirements, success criteria. No implementation details unless needed to avoid ambiguity. |
| `plan.md` | Technical approach, file responsibilities, data flow, testing strategy, risk analysis. |
| `tasks.md` | Human-readable task board with Engineer/Reviewer pairs, dependencies, acceptance criteria, verification commands, and commit checkpoints. |
| `handoff.md` | Live brief for the next session: current state, next read order, latest verification, blockers, and pitfalls. |
| `status.json` | Machine-readable dispatcher state matching `docs/superpowers/status.schema.json`. |

Use the templates in `docs/superpowers/templates/` when creating a new feature.
Task shape and task state transitions are defined by
`docs/superpowers/task-contract.md`; this document is the process overview.

Historical `specs/**` entries may predate this workflow or contain stricter
session-local rules. Treat them as evidence for that feature, not as defaults
for new Superpowers work. For new work, this document and the templates are the
workflow source of truth unless the user explicitly narrows authority for a
specific feature.

## Skill Chain

1. `using-git-worktrees`
   - Detect existing isolation before creating anything.
   - Never modify or commit directly on `main`.
2. `brainstorming`
   - Clarify intent with the user.
   - Produce and validate `specs/<feature>/spec.md`.
   - User approval of the spec plus explicit start authorization unlocks the automated phases below.
3. `writing-plans`
   - Produce `specs/<feature>/plan.md` and seed task slices.
   - Plans must be decision-complete: exact paths, commands, testing expectations, and stop conditions.
   - Cross-feature architecture or workflow decisions must check `docs/decisions/INDEX.md` and the relevant ADRs first.
   - New long-term cross-feature decisions should create or update an ADR.
4. `subagent-driven-development`
   - Main agent dispatches fresh task-local subagents.
   - Engineer owns implementation for one task slice.
   - Reviewer verifies the same slice before the task can be marked complete.
5. `verification-before-completion`
   - No completion, commit, push, PR, merge, or local sync claim without fresh evidence.
6. `finishing-a-development-branch`
   - Push feature branch, open PR, wait for CI, merge on GitHub, then fast-forward local `main` when authorized by this workflow.

## Main Agent Authority

The main agent may:

- Read routing/state artifacts: `AGENTS.md`, this workflow, `spec.md`, `plan.md`, `tasks.md`, `handoff.md`, `status.json`.
- Dispatch Engineer, Reviewer, debugging, and read-only research subagents.
- Update `tasks.md`, `handoff.md`, and `status.json` after `review_passed`,
  `review_rejected`, or a real blocker.
- Run or request verification needed to validate workflow state.
- Push, open PR, watch CI, merge, and sync local `main` when the user has granted the one-time start authorization.
- Edit workflow state files only when recording dispatch, `review_passed`,
  `review_rejected`, a blocker, or closeout evidence.

The main agent must not:

- Directly edit production code or executable tests during implementation tasks.
- Expand an Engineer write set after dispatch without an explicit plan update.
- Mark a task `completed` before `review_passed`.
- Treat subagent reports as proof without checking diff and verification evidence.
- Continue past a stop condition by guessing.
- Rewrite unrelated files or revert user changes.

Engineer boundary:

- Engineer modifies only the task-owned files.
- Engineer reads only needed context, including read-only context from the task.
- Engineer stops instead of widening scope, adding dependencies, changing data
  contracts, or continuing after unclear verification failure.

Reviewer boundary:

- Reviewer inspects the task-local diff against the task contract.
- Reviewer reruns or validates the required verification commands.
- Reviewer records exactly one decision: `review_passed`, `review_rejected`, or
  `blocked`.
- Reviewer does not fix the task while reviewing it.

## Task Slice Contract

Every task in `tasks.md` must follow
`docs/superpowers/task-contract.md`. The required block includes state,
attempt, wave, scope, non-scope, owned files, read-only context, dependencies,
Engineer instructions, acceptance criteria, verification commands with expected
signal, Reviewer PASS/REJECT criteria, and evidence.

Task completion rule:

1. Engineer implements only the owned scope.
2. Engineer reports files changed, commands run, exit codes, evidence, risks, and status.
3. Reviewer inspects the task-local diff and reruns the relevant verification.
4. Reviewer records `review_passed` or `review_rejected`.
5. Main agent updates task state to `completed` only after `review_passed` and
   state sync.

`review_rejected` returns the task to the same Engineer unless the root cause is missing context, insufficient model capability, or a flawed plan.

## Parallelism

Default execution is one Engineer + Reviewer pair at a time.

Parallel execution is allowed only when all are true:

- Owned files are disjoint.
- No task writes shared helpers, config, lockfiles, or workflow state concurrently.
- Each lane has a paired Reviewer.
- A final integration gate runs after the wave.

Recommended maximum in a shared worktree is two to three Engineer/Reviewer pairs. If in doubt, serialize.

## Testing And Debugging Rules

- Before writing tests or fixing bugs, Engineer must read `.codex/references/testing-handbook.md`.
- Behavior changes follow TDD: RED -> GREEN -> REFACTOR.
- Unit, integration, server, or E2E coverage is selected by behavior and risk; do not add every test type mechanically.
- Test failures and unexpected behavior trigger `systematic-debugging`: reproduce, inspect evidence, find root cause, then fix.
- Do not add flaky patterns, forbidden internal mocks, sleeps, `fireEvent`, `container.querySelector`, inline disables, or `@ts-ignore`.

## Stop Conditions

Stop and ask the user when any of these occurs:

- `spec.md`, `plan.md`, or `tasks.md` contradict each other.
- The work requires behavior outside the approved spec.
- The task requires DB schema, security rules, permissions, data deletion, or migration changes.
- The task requires forbidden scope, a new dependency, or a broad refactor.
- The same task is rejected by Reviewer twice without a clear fix path.
- CI or tests fail for a non-flaky reason that points to a flawed plan or pre-existing system problem.
- PR conflict, remote merge block, or destructive cleanup is required.

## Commit And Closeout Policy

Use phase commits:

1. Spec commit.
2. Plan/tasks/status seed commit.
3. Reviewed implementation batch commits.
4. Final evidence / handoff commit, only when tracked evidence files intentionally changed.

Closeout default after the one-time start authorization:

1. Verify fresh local gates.
2. Push feature branch.
3. Open PR.
4. Wait for required CI checks.
5. Merge PR on GitHub when green.
6. Fast-forward local `main` to `origin/main`.

Do not create checkbox-only commits after CI if doing so would invalidate the head SHA that CI validated. Record delivery evidence in the PR and final report instead.

## Resume Protocol

Any compacted, resumed, or fresh session must start with:

1. Read `AGENTS.md`.
2. Read `docs/superpowers/workflow.md`.
3. Read `specs/<feature>/handoff.md`.
4. Read `specs/<feature>/tasks.md`.
5. Read `specs/<feature>/status.json`.
6. Read `specs/<feature>/spec.md` and `specs/<feature>/plan.md` only as needed
   to resolve scope, acceptance criteria, or implementation details.
7. Confirm `git status --short --branch`.
8. Continue from the first incomplete unblocked task.

If these files disagree, treat it as a stop condition and reconcile before dispatching more work.
