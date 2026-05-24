# Risk-Based Workflow Profiles

> Last-Verified: 2026-05-11

This document routes work into the lightest Superpowers workflow profile that
still preserves branch isolation, owned-file discipline, fresh verification,
Engineer-first edits, Reviewer-default checks for repo changes, and PR/CI
closeout.

Use this before execution for bugfix, maintenance, refactor, docs, and feature
work. If classification is unclear, choose the higher profile or stop and ask.
Chinese requests such as 開發, 實作, 修, 修正, 修 bug, 重構, 補測試, 改文件,
and 更新文件 count as repo-changing intent when they target this repo. Intent
detection only routes the workflow; it is not edit authorization.

## Classification

Classify every task on two axes:

- Complexity: how broad the implementation surface is.
- Risk: how costly the failure mode is.

Profile selection is `max(Complexity, Risk)`.

Any R4 task escalates directly to P4 even when implementation complexity looks
small.

## Complexity

| Level | Meaning |
| ----- | ------- |
| C0 | Read-only inspection, no repo change. |
| C1 | Single-file change or one small function/component. |
| C2 | Same domain or same layer, usually 2-5 files. |
| C3 | Cross-layer change, shared helper/config/test architecture, or multiple domains. |
| C4 | New feature, long-running work, multi-session work, or multi-task program. |

## Risk

| Level | Meaning |
| ----- | ------- |
| R0 | No runtime risk: docs-only, read-only, formatting with no behavior change. |
| R1 | Low-risk UI, copy, style, or non-core behavior. |
| R2 | Normal product behavior: hook, service, repo logic, or regression coverage needed. |
| R3 | Auth, Firebase, server behavior, E2E flow, race condition, flaky test, shared infra, or data-flow change. |
| R4 | Schema, security rules, migration, data deletion, permissions, secrets, new dependency, or irreversible operation. |

## Profiles

| Profile | Name | Default workflow |
| ------- | ---- | ---------------- |
| P0 | Read-only | Inspect, answer, or report. No edits; read-only subagent is allowed and usually needs no Reviewer. |
| P1 | Quick Fix | Narrow Engineer edit, focused verification, compact Reviewer check, concise final evidence. |
| P2 | Standard Bugfix/Maintenance | Focused plan in conversation or task brief, Engineer-owned edit, targeted test/verification, Reviewer check. |
| P3 | High-risk Fix/Refactor | Explicit task contract, owned files, targeted Engineer/Reviewer pass, compact durable artifact only when work crosses sessions. |
| P4 | Full Feature/Program | Full Superpowers feature workflow and durable five-file artifact set under `specs/<feature>/`. |

P1 and P2 do not create the full `spec.md`, `plan.md`, `tasks.md`,
`handoff.md`, and `status.json` set by default. They still need clear scope,
owned files, Engineer-first edits, Reviewer check for non-read-only repo
changes, and fresh verification evidence.

When a P1/P2 task is a single clear slice, the main agent may keep a minimum
task brief inline in the conversation, PR body, or durable handoff if the work
crosses sessions. If P1/P2 scope is unclear or has multiple slices, dispatch
Planner. P3/P4 require Planner before Engineer dispatch. Minimum task brief
schema:

- Profile: P1/P2/P3 classification with Complexity/Risk reason.
- Branch/worktree decision: current branch or worktree path and why it is
  sufficient.
- Scope: exact allowed change.
- Non-scope: explicit exclusions and forbidden expansion.
- Owned files: exact write set for Engineer.
- Read-only context: exact files or commands Engineer may inspect.
- Acceptance criteria: observable outcome or doc rule that must hold.
- Verification command and expected signal: one command per entry.
- Engineer/Reviewer: named roles or subagent assignments.
- Authorization boundary: whether automation may `edit`, `commit`, `push`,
  create a PR (`pullRequest`), watch CI (`ciWatch`), `merge`, sync local
  `main` (`localMainSync`), and deploy Firestore/storage rules
  (`deployFirestoreRules`).

P3 should keep durable artifacts compact. Create or update a durable handoff,
task note, or status artifact only when the task spans sessions, needs
dispatcher continuity, or would otherwise depend on transcript memory.

P4 uses the complete feature workflow and the required five-file artifact set.

## Workflow Routing Decision Table

Use this table after the C/R classification. The table chooses the lightest
workflow that still preserves branch isolation, owned-file boundaries,
Engineer-first edits, Reviewer checks for repo changes, fresh verification, and
PR/CI closeout.

| Task type / boundary case | Typical C/R -> Profile | Branch / worktree | Specs artifact | Engineer | Reviewer | Verification | Closeout |
| ------------------------- | ---------------------- | ----------------- | -------------- | -------- | -------- | ------------ | -------- |
| Read-only analysis, triage, or explanation | C0/R0 -> P0 | None | None | Optional read-only research subagent | Not required | Evidence from inspected files, commands, or links | Answer only; no commit |
| Docs-only typo, wording, or small reference fix | C1/R0 -> P1 | Branch; worktree if current workspace is occupied | No `specs/`; conversation/task brief evidence | Required for repo-changing edit | Required compact check | `git diff --check` plus focused docs/link check when relevant | Commit/PR/CI if tracked repo change |
| Docs-only workflow policy or durable process doc | C2-C3/R1-R3 -> P2/P3 | Branch for P2, worktree for P3 | P2 no `specs/`; P3 compact task contract only when session continuity needs it | Required | Required | Changed docs matrix, local link/workflow checks if workflow-critical | Commit/PR/CI; do not skip because it is "just docs" |
| Test-only change | C1-C3/R1-R3 -> P1-P3 | Branch or worktree by profile; worktree for E2E/emulator or flaky cleanup | No `specs/` for P1/P2; compact P3 artifact if multi-agent | Required | Required | Target test, `lint:changed`, `type-check:changed`, relevant audits | Commit/PR/CI |
| CI-only or workflow automation script | C2-C3/R2-R3 -> P2/P3 | Branch or worktree by profile; worktree when it can block other work | No full five-file set unless multi-session program | Required | Required | Script self-check, affected workflow command, `lint:changed`, `type-check:changed` | Commit/PR/CI; watch required checks |
| Dependency metadata or package script change, no install | C1-C2/R2 | Branch; worktree if shared workspace | No `specs/` by default | Required | Required | `npm run <changed-script>`, `lint:changed`, `type-check:changed`; stop if lockfile changes unexpectedly | Commit/PR/CI |
| New dependency, lockfile update, security-sensitive package change | Any/R4 -> P4 | Worktree | Full five-file set | Required | Required | Install/build/test gates from plan plus dependency/security rationale | Commit/PR/CI; ask before broad dependency change |
| Review-comment fix on an existing PR | Usually C1-C2/R1-R3 -> P1-P3 | Existing PR branch/worktree; create worktree if dirty or parallel work exists | No new `specs/` unless the PR already uses them | Required | Required | Reproduce reviewer concern and rerun affected gate | Push PR branch; wait for required checks |
| Hotfix | Usually C1-C3/R2-R4 | Fresh branch/worktree from updated `main`; never direct-to-`main` | P1/P2 no `specs/`; R4 uses P4 | Required | Required | Minimal reproduction plus the smallest high-signal regression gate | PR/CI/merge; ask before bypassing normal closeout |
| New product feature or multi-session program | C4 or feature default -> P4 | Worktree | Full `specs/<feature>/` five-file set | Required per task slice | Required per task slice | Plan-defined gates, integration gate after waves | Commit phases, PR, required GitHub checks, GitHub merge |

## Specs Artifact Policy

`specs/` is durable workflow state, not a notebook for every bugfix. Small
fixes, regular bugfixes, and docs cleanup should not pollute `specs/`.

docs/superpowers/specs/ and docs/superpowers/plans/ were old Superpowers
plugin default paths and are no longer used. If a plugin skill still
hard-codes those paths, repo policy overrides the plugin default. Migrated
outputs under `specs/_legacy/superpowers/**` are lookup/provenance only and
are not active workflow state.

| Profile | Specs artifact rule |
| ------- | ------------------- |
| P0 | No `specs/` docs. |
| P1 | No `specs/` docs; evidence lives in the conversation and PR body. |
| P2 | No `specs/` docs by default; evidence lives in the conversation, task brief, and PR body for root cause, scope, and verification. Create durable repo docs only when the user explicitly asks for a long-term repo doc. |
| P3 | No full five-file set. Create compact durable artifacts only for cross-session work, multi-task work, dispatcher continuity, or when transcript memory is not enough. |
| P4 | Always create the full `specs/<feature>/` five-file set: `spec.md`, `plan.md`, `tasks.md`, `handoff.md`, and `status.json`. |

P3 minimum rules:

- Single-session high-risk fix: no `specs/` artifact.
- Cross-session work: create `specs/<topic>/handoff.md` with current state,
  next action, latest verification, and blockers.
- Multi-task or multi-agent work: add `tasks.md`.
- Add `status.json` only when machine-readable dispatcher state is needed.
- If full product intent plus technical plan is needed, escalate to P4 and use
  the full five-file set.

Specs directory names use the feature/topic slug, not the branch/worktree work
item number. Preserve existing numbered specs as historical artifacts, but name
new durable specs `specs/<slug>` and record the corresponding `NNN-description`
branch or worktree id in `status.json`, `handoff.md`, or `specs/INDEX.md`.

If the user says "make a plan first", ask whether it should be a long-term repo
doc or scratchpad. For P1/P2 PR bodies, include Summary, Root Cause, and
Verification when useful.

## Branch And Worktree Policy

Branch isolates commit history. Worktree isolates the working directory. P1/P2
default to a branch; P3/P4 default to a worktree.

| Profile | Isolation rule |
| ------- | -------------- |
| P0 | No branch, no worktree. |
| P1 | Branch by default; upgrade to worktree if the workspace is dirty or has an active branch/task. |
| P2 | Branch by default; upgrade to worktree for multi-file scope, long tests, dirty workspace, active branch/task, or unmerged PR. |
| P3 | Worktree by default. |
| P4 | Always worktree. |

Upgrade to a worktree for cross-session work, multi-agent work, long
verification, dev server, emulator, E2E, dirty workspace, active feature
branch, running task, unmerged PR, or when `main` must stay clean for lookup,
hotfix, or comparison.

If the current workspace already has another active feature branch, dirty tree,
running task, or unmerged PR, new repo-changing work uses a worktree even if it
would otherwise be P1/P2.

Multi-worktree Git commands use `git -C <absolute-path> ...`.

## Non-Negotiables

Lightweight profiles do not bypass repo safety rules:

- Repo-changing work must stay on a branch/worktree, never direct-to-`main`.
- For P1/P2/P3 repo changes, lightweight means less artifact weight, not
  main-agent self-editing.
- The main agent defaults to dispatcher/coordinator; actual development,
  bugfix, refactor, testing, docs, workflow docs, ADR, `.codex/**`, scripts,
  config, and other repo edits go first to an Engineer subagent.
- The main agent may read only control-plane context, task-local diffs, changed
  file lists, and exact evidence lines. Broad domain or source exploration must
  be delegated to a bounded read-only Explorer subagent.
- Non-read-only repo-changing work defaults to a Reviewer subagent check before
  completion.
- P1/P2/P3 without approved `spec.md` must record an authorization boundary.
  Starting implementation is not authorization to `commit`, `push`,
  `pullRequest` / PR creation, `ciWatch` / CI watch, `merge`,
  `deployFirestoreRules`, or `localMainSync`; each closeout or release step
  must be explicitly inside the authorization boundary before it runs.
- Firestore/storage rules deploy is a separate release boundary. A PR merge,
  green CI, or local `main` sync does not prove deployed rules or deployed
  product behavior.
- PR creation (`pullRequest`), CI watching (`ciWatch`), and `merge` may proceed
  with a non-deployed rules state such as `required`, `pending`, or `blocked`
  when the release risk is explicit and no deployed-rules or rules-backed
  product behavior claim is made.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `status.json.rulesDeployStatus.state` is `deployed` and deploy
  evidence is recorded.
- v3 status state must track local/remote head snapshots, latest verified
  commit, phase commits, rules deploy status, and incidents when `status.json`
  is present.
- Workflow state drift between `tasks.md`, `status.json`, and `handoff.md`
  blocks dispatch and closeout until reconciled.
- Verification evidence is one command per entry. Do not combine commands with
  `&&` or `;`.
- Respect owned files, non-scope, and user changes.
- Keep branch/worktree, commit, push feature branch, PR, required GitHub checks
  green, GitHub merge, and local `main` fast-forward expectations from
  `AGENTS.md`.
- Run fresh verification before claiming completion.
- Stop on unclear scope, contradictory docs, forbidden scope expansion, or
  destructive/irreversible operations.

## Scenario Examples

| Scenario | Classification | Profile | Notes |
| -------- | -------------- | ------- | ----- |
| Fix a typo or update docs wording | C1/R0 | P1 | No full feature artifact set; Engineer edit plus compact Reviewer check; verify with focused search or docs check. |
| Single-file UI display bug | C1/R1 | P1 | Target the component and run the smallest relevant UI/unit check when available. |
| Service regression with coverage | C2/R2 | P2 | Add or update focused regression coverage; no automatic feature five-file set. |
| Firebase listener flaky behavior | C3/R3 | P3 | Needs explicit task contract, Engineer/Reviewer gate, and targeted emulator or E2E evidence. |
| New product feature | C4/R2 or higher | P4 | New features default to full feature workflow and durable artifacts. |

If a task mentions schema, rules, migration, permissions, secrets, dependency
changes, data deletion, or any irreversible operation, classify it R4 and route
to P4 before implementation.
