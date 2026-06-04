# Event Reminder Email Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Feature slug: `event-reminder-email`.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-093-event-reminder-email`.
- Branch: `093-event-reminder-email`.
- Current head: `08827b45d3383c7ca6a4f3b98f37ecf613a89379` (`Add event reminder email spec`).
- Remote head: `b1cdaee96618983d333d1b6da2a78c0312e3b7ba` from local `origin/main`.
- Captured at: `2026-06-04T03:39:59Z`.
- Branch divergence at plan time: ahead 1, behind 1.
- Authorization boundary:
  - edit: no for implementation; yes only for this planning artifact edit.
  - commit: yes for planning artifacts only.
  - push: no.
  - pullRequest: no.
  - ciWatch: no.
  - merge: no.
  - localMainSync: no.
  - deployFirestoreRules: no.
- Current phase: plan artifacts drafted for planning commit.
- Active task: none.
- Active wave: none.
- Latest reviewer decision: none.
- Last verified commit: none for plan artifacts before the planning commit.
- Phase commits:
  - spec: `08827b45d3383c7ca6a4f3b98f37ecf613a89379` - approved spec.
  - plan: `093-event-reminder-email` - branch ref resolves to the planning checkpoint after the planning commit; final SHA is reported by the Planner.
- Rules deploy status: `not_applicable`; no rules change is planned.
- Incidents: none.
- Blocked: no for planning commit; implementation dispatch is blocked by missing implementation authorization and branch divergence until G0 is resolved.
- Blocked reason: implementation needs explicit edit authorization and branch reconciliation before T001 dispatch.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `docs/superpowers/task-contract.md`
5. `.codex/references/subagent-roles.md`
6. `specs/event-reminder-email/handoff.md`
7. `specs/event-reminder-email/status.json`
8. `specs/event-reminder-email/tasks.md`
9. `specs/event-reminder-email/plan.md`
10. `specs/event-reminder-email/spec.md`

## Next Action

Planner self-review and validation are required before staging the four planning files. After the planning commit, the coordinator should not dispatch implementation until the user explicitly authorizes implementation edits and the branch no longer reports behind `origin/main`.

## Latest Verification

Plan-stage verification recorded before staging:

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git status --short --branch --untracked-files=all` | 0 | Branch `093-event-reminder-email...origin/main [ahead 1, behind 1]`; only the four planning files are untracked. |
| `rg -n "TB[D]|TO[D]O|PLACEHOLD[E]R|FILL[_]ME" specs/event-reminder-email/plan.md specs/event-reminder-email/tasks.md specs/event-reminder-email/handoff.md specs/event-reminder-email/status.json` | 1 | No template markers were found. Exit 1 is the expected no-match signal for this command. |
| `node scripts/validate-workflow-state.js specs/event-reminder-email/status.json` | 0 | `status.json: ok`; one status file valid. |
| `node scripts/check-superpowers-state.js specs/event-reminder-email/status.json` | 0 | Workflow state valid and synced. |
| `git diff --check` | 0 | No whitespace errors. |

## Closeout Checklist

- [x] `plan.md` defines technical approach, exact files, data flow, retry/idempotency design, Resend config, tests, boundaries, risks, and stop conditions.
- [x] `tasks.md` defines serialized Engineer/Reviewer task contracts with states, attempts, waves, owned files, read-only context, dependencies, acceptance criteria, verification, Reviewer criteria, and evidence fields.
- [x] `status.json` is schemaVersion 3 and records the plan-stage authorization boundary.
- [x] `authorizationBoundary.deployFirestoreRules` is false and separate from other boundaries.
- [x] `rulesDeployStatus.state` is `not_applicable`.
- [x] Template-marker scan is clean.
- [x] Workflow state validation passes.
- [x] Workflow companion check passes.
- [x] `git diff --check` passes.
- [ ] Planning files are staged by concrete path only.
- [ ] Planning commit is created with message `Add event reminder email plan`.
- [ ] Push, pull request, CI watch, merge, local main sync, deploy, dependency install, package edits, and secret setup remain unauthorized and not done.

## Blockers

- Implementation dispatch is blocked until the coordinator obtains explicit implementation edit authorization.
- Implementation dispatch is blocked until branch divergence is reconciled and `git status --short --branch --untracked-files=all` no longer reports behind `origin/main`.
- Secret values and live Functions configuration are not authorized in this stage.
- Functions deploy is not authorized in this stage.

## Pitfalls

- Do not store reminder state on `events/{eventId}` unless a separate Security/Rules plan updates rules; current event-host update rules are too broad for server-owned reminder fields.
- Do not add the Resend SDK or modify any package/lockfile unless the user authorizes a dependency boundary.
- Do not log email addresses, API keys, message bodies, or host contact details.
- Do not read email from event or participant documents; only `users/{uid}.email` is allowed.
- Do not use host email as sender; sender must be fixed platform config.
- Do not dispatch source edits while the branch is behind `origin/main`.
- Do not imply deployed Functions, configured secrets, deployed rules, push, pull request, CI watch, merge, or local main sync without evidence and explicit authorization.
