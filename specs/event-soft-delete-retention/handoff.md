# Event Soft Delete Retention Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-085-event-soft-delete-retention`
- Branch: `085-event-soft-delete-retention`
- Current head: `bdce30921dba11c8c4556b98836da32dbe16e1f5`
- Remote head: `origin/main` at `19434854fd36911879a36406efda80d1b5056dc1`
- Authorization boundary:
  - edit: yes
  - commit: yes
  - push: no
  - pullRequest: no
  - ciWatch: no
  - merge: no
  - localMainSync: no
  - deployFirestoreRules: no
- Firebase Functions deploy: not authorized
- Current phase: planning
- Active task: none
- Active wave: none
- Latest reviewer decision: T001 spec compliance and code-quality reviews
  `review_passed` on 2026-06-02T01:04:39+08:00.
- Last verified commit: none
- Phase commits:
  - spec: `8c3d5e797935186d8db27af6e80e042b9508ae3c`
  - plan: `13347d19506c1c4e721ab3322ed40f92a4a1c92a`
- Rules deploy status: required, required=true, changed=false, deployedCommit=null
- Incidents: none
- Blocked: no
- Blocked reason: none

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `specs/event-soft-delete-retention/handoff.md`
4. `specs/event-soft-delete-retention/tasks.md`
5. `specs/event-soft-delete-retention/status.json`
6. `specs/event-soft-delete-retention/plan.md`
7. `specs/event-soft-delete-retention/spec.md` only when a task contract needs
   exact product requirement confirmation.

## Next Action

Coordinator commits T001 implementation and workflow state, then dispatches
T002 `Event Delete Writes And Event Read Filtering`.

## Task Graph

- T001 -> T002
- T001 -> T003
- T001 -> T004
- T002 -> T005
- T003 -> T005
- T004 -> T005
- T005 -> T006

Default execution is sequential. T002, T003, and T004 may run parallel only in
separate coordinator-created worktrees with disjoint owned files.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git diff --check -- specs/event-soft-delete-retention` | 0 | Planning artifacts have no whitespace errors. |
| `npm run workflow:check` | 0 | 15 status files valid and synced, including `event-soft-delete-retention/status.json`. |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-soft-delete-helpers.test.js` | 0 | 5 tests passed. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js` | 0 | 4 tests passed. |
| `npm run lint:changed` | 0 | Passed with existing React version warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |

No implementation verification has run yet.

## Closeout Checklist

- [ ] `tasks.md` task states match `status.json`.
- [ ] Active task and active wave match `status.json`.
- [ ] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [ ] `lastVerification` has one entry per command.
- [ ] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits`
      reflect the latest verified state.
- [ ] `authorizationBoundary.deployFirestoreRules` is recorded and treated as
      separate from edit, commit, push, PR, CI watch, merge, and local main sync.
- [ ] Firebase Functions deploy remains separate and unauthorized until the user
      explicitly authorizes it.
- [ ] `rulesDeployStatus` matches the rules release state.
- [ ] Final summary does not imply deployed rules, deployed Functions, or
      deployed product behavior without deploy evidence.
- [ ] PR, CI, and merge notes carry release risk if rules or Functions are not
      deployed.
- [ ] Open incidents are resolved, mitigated with explicit carry-forward, or
      block closeout.
- [ ] Changed files are intentionally in scope.
- [ ] Blockers are resolved or explicitly carried forward.

## Blockers

- None.

## Pitfalls

- Event delete must not touch participants, comments, or history at user-action
  time.
- Event comment delete must not touch history at user-action time.
- Deleted event comments under a soft-deleted event are retained until the
  parent event tree purge.
- No task may introduce restore UI or restore API behavior.
- T006 must verify scheduled function wrapper registration/delegation and purge
  count logging, not only purge core behavior and syntax.
- Firestore rules and Firebase Functions deploys are release actions and are
  not authorized in the current boundary.
- Do not add Firestore indexes unless implementation verification proves the
  exact requirement.
