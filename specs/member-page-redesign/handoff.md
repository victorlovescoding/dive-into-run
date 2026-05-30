# Member Page Redesign Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-082-member-page-redesign`
- Branch: `082-member-page-redesign`
- Current head: `cf4a65e75dce300a032763cd3b5fe1873578923c` (`plan artifacts committed before implementation dispatch`)
- Remote head: `origin/main` at `4c5b45b1fbf5b62ded2da57dd178133532a90b9f`
- Authorization boundary:
  - edit: true for product implementation tasks through Engineer/Reviewer subagents
  - commit: true for authorized workflow/product implementation commits when appropriate
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false
- Current phase: `implementation`
- Active task: `T001`
- Active wave: `wave-1`
- Latest reviewer decision: none
- Last verified commit: none
- Phase commits: plan commit `cf4a65e75dce300a032763cd3b5fe1873578923c`
- Rules deploy status: `not_applicable`, required=false, changed=false
- Incidents: none
- Blocked: no
- Blocked reason: none

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `docs/superpowers/task-contract.md`
5. `specs/member-page-redesign/handoff.md`
6. `specs/member-page-redesign/tasks.md`
7. `specs/member-page-redesign/status.json`
8. `specs/member-page-redesign/spec.md`
9. `specs/member-page-redesign/plan.md`

## Next Action

Dispatch an Engineer subagent for T001 using the owned files, read-only context, acceptance criteria, verification commands, and stop conditions from `tasks.md`.

Do not dispatch any product task outside the T001 owned files. Push, PR creation, CI watch, merge, local `main` sync, and Firestore/storage rules deploy remain unauthorized.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `node scripts/validate-workflow-state.js specs/member-page-redesign/status.json` | 0 | `specs/member-page-redesign/status.json: ok`; `WORKFLOW STATE: 1 status file(s) valid`. |
| `node scripts/check-superpowers-state.js specs/member-page-redesign/status.json` | 0 | `specs/member-page-redesign/status.json: sync ok`; `SUPERPOWERS CHECK: 1 status file(s) synced`. |
| `git diff --check -- specs/member-page-redesign/tasks.md specs/member-page-redesign/handoff.md specs/member-page-redesign/status.json` | 0 | No whitespace errors. |

## Closeout Checklist

- [x] Product-code implementation authorization is obtained before T001 dispatch.
- [x] `tasks.md` task states match `status.json`.
- [x] Active task and active wave match `status.json`.
- [ ] Latest reviewer decision is recorded in `tasks.md` and `status.json` after each review.
- [x] `lastVerification` has one entry per command.
- [ ] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits` reflect the latest verified state.
- [ ] `authorizationBoundary.deployFirestoreRules` is recorded and treated as separate from `edit`, `commit`, `push`, `pullRequest`, `ciWatch`, `merge`, and `localMainSync`.
- [ ] `rulesDeployStatus` remains `not_applicable` unless rules unexpectedly enter scope, which is a stop condition.
- [ ] Final summary does not imply deployed rules, deployed functions, or production product behavior.
- [ ] Open incidents are resolved, mitigated with an explicit carry-forward, or block closeout.
- [ ] Changed files are intentionally in scope and reviewed.
- [ ] Browser evidence covers `/member` desktop and mobile after implementation.
- [ ] Required local gates pass after implementation.

## Blockers

- None.

## Pitfalls

- `edit=true` and `commit=true` now cover product implementation only through Engineer/Reviewer subagents; they still do not authorize push, PR creation, CI watch, merge, local `main` sync, or rules deploy.
- `/member/favorites` stays as-is; only the exact `我的收藏` link is in scope.
- Removing `這是會員頁面` must not introduce a replacement page title.
- Nav is outside page scope and must not be added inside `MemberPageScreen`.
- Do not duplicate Danger Zone markup for responsive ordering; use one instance and CSS/grid ordering.
- Avatar upload can regress if the hidden input/ref/click relationship changes.
- Dashboard tabs can regress if roles, IDs, `aria-*`, active `tabIndex`, keyboard handler, or sentinel placement changes.
- Bio emoji/counting mismatch is out of scope unless a touched UI state proves a new gap and the coordinator approves expansion.
- Account deletion is critical; do not confirm deletion during browser QA.
