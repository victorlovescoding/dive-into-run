# Superpowers Workflow

> Last-Verified: 2026-05-11

This repo uses Superpowers as the workflow language and `specs/<feature>/...` as the durable state backend.

## Goals

- Keep the main agent thin: dispatcher, status owner, and user-facing coordinator.
- Put feature state on disk so compacted or fresh sessions can resume from files, not transcript memory.
- Require Engineer + Reviewer pairing for every independently deliverable task slice.
- Route repo-changing edits through Engineer subagents first, including development, bugfix, refactor, testing, and docs work.
- Preserve repo conventions: `AGENTS.md` is the entry map, `specs/` stores planning artifacts, and executable tests live under `tests/`.

## Task Profile Routing

Before execution, classify the task with
`docs/superpowers/task-profiles.md`.

Use Complexity C0-C4 and Risk R0-R4, then select Profile P0-P4 by the higher
score. Any R4 task escalates directly to P4. If classification is unclear,
choose the higher profile or stop and ask.

Bugfix, maintenance, refactor, testing, docs, and other repo-changing work do
not automatically use the full feature five-file set. P1/P2 work uses the
smallest explicit scope and fresh verification that proves the change. P3 work
uses an explicit task contract; keep durable artifacts compact unless the task
crosses sessions or needs dispatcher continuity.

Use the Specs Artifact Policy in `docs/superpowers/task-profiles.md` to decide
whether workflow state belongs under `specs/`. P1/P2 default to no `specs/`
artifacts; P3 uses compact durable artifacts only when transcript memory is not
enough; P4 always uses the full five-file set.

Use the Branch And Worktree Policy in
`docs/superpowers/task-profiles.md` to choose isolation. P1/P2 default to a
branch but upgrade to a worktree when the workspace is occupied, verification
is long-running, work spans sessions, or multiple agents need independent
working directories. P3 defaults to a worktree. P4 always uses a worktree.

P1/P2/P3 are lighter in artifacts and ceremony, not in ownership. For any
non-read-only repo-changing work, the main agent defaults to
dispatcher/coordinator, sends actual edits first to an Engineer subagent, and
uses a Reviewer subagent check before completion. Pure read-only exploration may
use a read-only research subagent and usually needs no Reviewer.

New features default to P4. P4 work uses this document's Required Feature
Artifacts and full feature lifecycle.

Task profiles only route workflow weight. They do not weaken branch isolation,
owned-file/non-scope boundaries, Engineer-first editing, Reviewer-default
checks, fresh verification, PR/CI expectations, or stop conditions.

## Required Feature Artifacts

Every new P4 Superpowers feature must keep this five-file set under
`specs/<feature>/`:

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
session-local rules. Do not retrofit them for compliance unless the user asks.
Treat them as evidence for that feature, not as defaults for new Superpowers
work. For new work, this document and the templates are the workflow source of
truth unless the user explicitly narrows authority for a specific feature.

## Artifact Persistence Policy

Planning, analysis, progress, and review Markdown files default to scratchpad
artifacts unless the user says they should become long-term repo docs.

Ask before creating ambiguous Markdown artifacts:

- long-term repo doc: tracked, maintained, and appropriate for future agents.
- scratchpad: temporary coordination or explanation; do not stage or commit by
  default.

Approved Superpowers feature artifacts under `specs/<feature>/` are different:
`spec.md`, `plan.md`, `tasks.md`, `handoff.md`, and `status.json` are durable
repo workflow docs once the active workflow approves the feature. Historical
legacy artifacts remain provenance, not current global rules.

## Skill Chain

1. `using-git-worktrees`
   - Detect existing isolation before creating anything.
   - Never modify or commit directly on `main`.
2. Task profile routing
   - Classify work with `docs/superpowers/task-profiles.md` before execution.
   - New feature work defaults to P4.
   - Bugfix, maintenance, refactor, and docs work first choose P0-P4 by
     Complexity and Risk instead of mechanically creating the feature five-file set.
3. `brainstorming`
   - Clarify intent with the user.
   - Produce and validate `specs/<feature>/spec.md`.
   - User approval of the spec plus explicit start authorization unlocks the automated phases below.
4. `writing-plans`
   - Produce `specs/<feature>/plan.md` and seed task slices.
   - Plans must be decision-complete: exact paths, commands, testing expectations, and stop conditions.
   - Cross-feature architecture or workflow decisions must check `docs/decisions/INDEX.md` and the relevant ADRs first.
   - New long-term cross-feature decisions should create or update an ADR.
5. `subagent-driven-development`
   - Main agent dispatches fresh task-local subagents.
   - Engineer owns implementation for one task slice, including docs-only and
     test-only repo changes.
   - Reviewer verifies the same non-read-only repo-changing slice before the
     task can be marked complete.
6. `verification-before-completion`
   - No completion, commit, push, PR, merge, or local sync claim without fresh evidence.
7. `finishing-a-development-branch`
   - Push feature branch, open PR, wait for CI, merge on GitHub, then fast-forward local `main` when authorized by this workflow.

## Main Agent Authority

The main agent is control plane only. It coordinates state, dispatch, user
communication, and closeout. It does not become the implementation,
investigation, debugging, or review agent for repo-changing work.

The main agent may:

- Read control-plane context: `AGENTS.md`, this workflow, active
  `handoff.md`, `tasks.md`, `status.json`, and `git status --short --branch`.
- Read task-local diff and changed-file lists after Engineer work.
- Read exact evidence cited by Engineer or Reviewer: file/line references,
  command summaries, and the precise nearby lines needed to verify the claim.
- Dispatch Engineer, Reviewer, debugging, and read-only research subagents.
- Update `tasks.md`, `handoff.md`, and `status.json` after `review_passed`,
  `review_rejected`, or a real blocker.
- Run or request verification needed to validate workflow state.
- Stage, commit, push, open PR, watch CI, merge, and sync local `main` only
  when the authorization boundary permits that specific step and the diff has
  already passed Reviewer.
- Edit workflow state files only when recording dispatch, `review_passed`,
  `review_rejected`, a blocker, or closeout evidence.

The main agent must not:

- Do domain or codebase broad exploration itself.
- Read source broadly to design a fix.
- Read `spec.md` or `plan.md` for implementation details as part of normal
  control-plane operation.
- Replace Engineer or Reviewer investigation with its own investigation.
- Directly implement, review, debug, or refactor repo-changing work.
- Directly edit production code, executable tests, docs, workflow docs, ADRs,
  `.codex/**`, scripts, config, or other repo files during repo-changing tasks;
  actual edits go first to an Engineer subagent. Workflow state updates listed
  above are the narrow exception.
- Expand an Engineer write set after dispatch without an explicit plan update.
- Mark a task `completed` before `review_passed`.
- Treat subagent narrative as proof without raw command summary, file:line
  evidence, or checked task-local diff.
- Continue past a stop condition by guessing.
- Rewrite unrelated files or revert user changes.

Exploration rule:

- Pure exploration goes to a read-only Explorer subagent, not the main agent.
- Explorer dispatch must include a bounded question, allowed read-only context,
  forbidden writes, and expected evidence format.
- If `spec.md` or `plan.md` content is needed, dispatch a bounded Explorer,
  Engineer, or Reviewer to extract the required control-plane fact; otherwise
  read only the precise line cited as evidence by that subagent.
- Explorer results must include file/line, command output summary, and explicit
  uncertainty. Narrative without evidence is only a hint.

Repo-changing gray-area rule:

- Docs-only changes, workflow docs, ADRs, `.codex/**`, scripts, config, and
  generated workflow templates are repo-changing work.
- These changes default to Engineer-owned edits plus Reviewer check.
- Main-agent direct edits are limited to workflow state exception files
  (`tasks.md`, `status.json`, `handoff.md`) when recording dispatch, review
  result, blocker, or closeout evidence.

Authorization boundary:

- P1/P2/P3 tasks without approved `spec.md` must record exactly how far the
  user authorized automation: edit, commit, push, PR creation, merge, and local
  `main` sync are separate boundaries.
- "Start fixing", "go implement", or equivalent wording authorizes the edit
  phase only unless the user explicitly grants later closeout steps.
- Do not interpret implementation approval as merge or local sync approval.

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
3. Reviewer inspects the task-local diff and reruns the relevant verification
   for non-read-only repo-changing work.
4. Reviewer records `review_passed` or `review_rejected`.
5. Main agent updates task state to `completed` only after `review_passed` and
   state sync.

`review_rejected` returns the task to the same Engineer unless the root cause is missing context, insufficient model capability, or a flawed plan.

State drift rule:

- `tasks.md`, `status.json`, and `handoff.md` must agree before dispatch,
  commit, push, PR creation, merge, or local `main` sync.
- If they disagree, stop and reconcile the workflow state or report `blocked`.
- Reviewer PASS cannot be replaced by main-agent self-check.

Evidence rule:

- `lastVerification` and command evidence use one object or row per command.
- Do not record shell chains with `&&` or `;` as one command entry. Split them
  into separate verification entries with separate summaries and exit codes.
- Subagent narrative is only a hint until backed by raw command summary,
  file:line evidence, or reviewed diff.

## Parallelism

Default execution is one Engineer + Reviewer pair at a time.

Parallel execution is allowed only when all are true:

- Owned files are disjoint.
- No task writes shared helpers, config, lockfiles, or workflow state concurrently.
- Each lane has a paired Reviewer.
- A final integration gate runs after the wave.

Recommended maximum in a shared worktree is two to three Engineer/Reviewer pairs. If in doubt, serialize.

## Testing And Debugging Rules

- Before writing tests or fixing bugs, Engineer must read the blocking rules and
  the relevant routed section of `.codex/references/testing-handbook.md`; do
  not eager-load the whole handbook when the task only needs one test type.
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

1. Work from an isolated branch/worktree, never direct-to-`main`.
2. Verify fresh local gates.
3. Commit reviewed changes.
4. Push the feature branch.
5. Open PR.
6. Wait for required `ci` and `e2e` checks to complete successfully.
7. Merge PR on GitHub when green.
8. Fast-forward local `main` to `origin/main`.

Do not create checkbox-only commits after CI if doing so would invalidate the head SHA that CI validated. Record delivery evidence in the PR and final report instead.

Closeout and staging rules:

- The main agent may stage, commit, push, open PR, watch CI, merge, and sync
  local `main` only after Reviewer has checked the diff and the authorization
  boundary includes that step.
- Staging must list concrete paths, for example:
  `git add AGENTS.md docs/superpowers/workflow.md`.
- Do not recommend or run `git add .`, `git add -A`, or `git add --all`.
- Commit, push, PR, merge, and local sync remain stop points when authorization
  is absent, workflow state drift exists, verification is stale, or Reviewer
  PASS is missing.

## Resume Protocol

Any compacted, resumed, or fresh session must start with:

1. Read `AGENTS.md`.
2. Read `docs/superpowers/workflow.md`.
3. Read `specs/<feature>/handoff.md`.
4. Read `specs/<feature>/tasks.md`.
5. Read `specs/<feature>/status.json`.
6. Do not read `specs/<feature>/spec.md` or `specs/<feature>/plan.md` broadly
   during resume. If state files need a fact from those docs, dispatch a
   bounded Explorer, Engineer, or Reviewer to extract it, or read only a
   precise line referenced as subagent evidence.
7. Confirm `git status --short --branch`.
8. Continue from the first incomplete unblocked task.

Default resume scope is the active `specs/<feature>/` directory. Do not scan all
of `specs/**` during startup. Historical specs, old `handoff-archive.md`,
oversized `tasks.md`, reports, and large reference payloads are lookup material:
open them only when the active feature explicitly points there or the current
question requires provenance.

If these files disagree, treat it as a stop condition and reconcile before dispatching more work.
