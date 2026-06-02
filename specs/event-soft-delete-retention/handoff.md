# Event Soft Delete Retention Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-085-event-soft-delete-retention`
- Branch: `085-event-soft-delete-retention`
- Current head: `f5f4ebfac5616bc25488e968b2659993b186c15c`
- Remote head: `origin/main` at `f641655b6b7f5fe48058ad43d59a5cdc147cdebf`
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
- Current phase: implementation
- Active task: none
- Active wave: none
- Latest reviewer decision: T007 reviewer `review_passed`; no Critical,
  Important, or Minor findings after filtering missing and soft-deleted event
  parents from member comments.
- Last verified commit: `f5f4ebfac5616bc25488e968b2659993b186c15c`
- Phase commits:
  - spec: `8c3d5e797935186d8db27af6e80e042b9508ae3c`
  - plan: `13347d19506c1c4e721ab3322ed40f92a4a1c92a`
  - T001: `d8c2578f027f4d9fe11f6b21c31e5c16d61757f6`
  - T002: `46e8cbf9b1c7959285a2534090a48b8bef87dab3`
  - T003: `2b746382a1f9958f056a1c950a1d10bcf29231f2`
  - T004: `1ebfcb472f65c7d9621287692dda9855b9157f12`
  - workflow-check-fix: `cb0176d0764158f15ecfbda0799ebec438924dca`
  - T005: `d139cba324b4aa6cb668b40e265ad56203868aa6`
  - T006: `f90480248370b91718105d59376ed32e67bf86dc`
  - T006-state: `f5f4ebfac5616bc25488e968b2659993b186c15c`
- Rules deploy status: required, required=true, changed=true, deployedCommit=null
- Incidents: T002 stale active detail cancellation notification carry-forward is
  mitigated and documented.
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

Coordinator runs workflow gates, commits the reviewed T007 member-comments fix
and synchronized workflow state, then records the resulting T007 commit SHA in
a follow-up workflow-state commit. Do not push, open a PR, watch CI, merge,
sync local `main`, deploy Firestore rules, or deploy Firebase Functions without
separate explicit authorization.

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
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-secondary-surfaces-soft-delete.test.js` | 0 | 1 file, 3 tests passed. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js` | 0 | 1 file, 2 tests passed. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js` | 0 | 1 file, 10 tests passed. |
| `npm run lint:changed` | 0 | Passed with existing React version warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `npm run workflow:check` | 0 | 15 status files valid and synced, including `event-soft-delete-retention/status.json`. |
| `git diff --check` | 0 | No whitespace errors. |

T006 implementation is reviewed and verified in the working tree. Firestore
rules changed locally in T005 but have not been deployed. Firebase Functions
changed locally in T006 but have not been deployed.

Final feature review requested changes after T006 because member comments could
expose active event comments when the parent event was soft-deleted or missing.
T007 fixed this by filtering missing and soft-deleted event parents from member
comments while preserving active event parents.

## Closeout Checklist

- [x] `tasks.md` task states match `status.json`.
- [x] Active task and active wave match `status.json`.
- [x] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [x] `lastVerification` has one entry per command.
- [x] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits`
      reflect the latest verified state.
- [x] `authorizationBoundary.deployFirestoreRules` is recorded and treated as
      separate from edit, commit, push, PR, CI watch, merge, and local main sync.
- [x] Firebase Functions deploy remains separate and unauthorized until the user
      explicitly authorizes it.
- [x] `rulesDeployStatus` matches the rules release state.
- [x] Final summary does not imply deployed rules, deployed Functions, or
      deployed product behavior without deploy evidence.
- [ ] PR, CI, and merge notes carry release risk if rules or Functions are not
      deployed.
- [ ] Open incidents are resolved, mitigated with explicit carry-forward, or
      block closeout.
- [x] Changed files are intentionally in scope.
- [x] Blockers are resolved or explicitly carried forward.

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
- T002 expanded its owned files to include `src/runtime/hooks/useEventMutations.js`
  because event-list deletion must pass the actor contract through the existing
  list-page mutation hook.
- T002 carry-forward: a stale active event detail can still fetch participants
  and send the existing cancellation notification before the repo transaction
  returns `already_deleted` if another session soft-deleted the event first.
  T002 preserves notification sequencing because notification behavior is
  non-scope; revisit this with notification ownership.
- Existing Firestore rules still need T005 before release; T002 may preserve
  product-path actor semantics, but rules-level soft-delete authorization is not
  complete until T005 passes.
- Do not add Firestore indexes unless implementation verification proves the
  exact requirement.
