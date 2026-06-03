# Event Soft Delete Retention Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-085-event-soft-delete-retention`
- Branch: `085-event-soft-delete-retention`
- Current head: `e73e98c13e6ad09c2234c51f9c0746136f2deee8`
- Remote head: `origin/main` at `f641655b6b7f5fe48058ad43d59a5cdc147cdebf`
- Authorization boundary:
  - edit: yes
  - commit: yes
  - push: yes
  - pullRequest: yes
  - ciWatch: yes
  - merge: yes
  - localMainSync: yes
  - deployFirestoreRules: yes (record completed deploy only; do not redeploy)
- Firebase Functions deploy: completed before closeout; do not redeploy.
- Current phase: closeout
- Active task: none
- Active wave: none
- Latest reviewer decision: T009 follow-up reviewer `review_passed`; no
  Critical, Important, or Minor findings.
- Last verified commit: `e73e98c13e6ad09c2234c51f9c0746136f2deee8`
- Phase commits:
  - spec: `c711116dd97ee5c13f87b57b622cc8503098a0d5`
  - plan: `b492d5a5576bb8db8a7c1d4ebded845df55af2e3`
  - T001: `847f4950ef1721c30e51e8210b32724c624dee04`
  - T002: `dffaac27c72e6e98ba4e83a340669475b15b5624`
  - T003: `addaca9b90618d0f5ce78b0492d414292681c9c1`
  - T004: `2971d48f0d7ee488a04e6d457eeb5f821cda4d0e`
  - workflow-check-fix: `baecdcb9dea592f6a925d32af8c6f803d6f3b061`
  - T005: `94d7ddcc460aa3e2a02bcc903a91f284458139c4`
  - T006: `5a59d5b5a320b022ccd3ea695194de26ac47fbf8`
  - T006-state: `ab7670e688a532cc93429d8c3f64a459fb24a815`
  - T007-dispatch: `903126ea1378c0e49f4fd8d4059c99ecacc0d9ff`
  - T007: `69367b93df74278ea656e8321c4480e5b0d537c0`
  - T007-state: `dbaa051b2bef4e1d687f8431fc6481e360b65bf9`
  - T008-dispatch: `640d34d79fec121cc274a8f833fa8abc506ab308`
  - T008: `194bb6da448e8cea07ebaacba972a24daac7b3bc`
  - T008-state: `d7e56cee2c456c42b7c8a8e8d2560db1613ca988`
  - T009: `e73e98c13e6ad09c2234c51f9c0746136f2deee8`
- Working tree: clean before this workflow-only closeout metadata update.
- Rebase: branch rebased onto `origin/main` at `f641655b6b7f5fe48058ad43d59a5cdc147cdebf` without conflicts.
- Rules deploy status: deployed to Firebase project `dive-into-run`; deploy output reported `firestore.rules` released to `cloud.firestore`; deployed commit unavailable.
- Incidents: T002 stale active detail cancellation notification carry-forward is
  resolved for this feature as a documented non-scope carry-forward.
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

Push the feature branch, create a PR to `main`, watch required GitHub CI, merge on GitHub when checks pass, then fast-forward local `main`. Do not redeploy Firestore rules or Firebase Functions.

## Task Graph

- T001 -> T002
- T001 -> T003
- T001 -> T004
- T002 -> T005
- T003 -> T005
- T004 -> T005
- T005 -> T006
- T006 -> T007
- T007 -> T008
- T008 -> T009

Default execution is sequential. T002, T003, and T004 may run parallel only in
separate coordinator-created worktrees with disjoint owned files.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/runtime/event-soft-delete-use-cases.test.js` | 0 | 1 file, 18 tests passed. |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/runtime/event-comment-soft-delete-use-cases.test.js` | 0 | 1 file, 8 tests passed. |
| `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/event-soft-delete-rules.test.js tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | 2 files, 27 tests passed. |
| `npm run lint:changed` | 0 | No changed JS files to lint after rebase. |
| `npm run type-check:changed` | 0 | No changed JS files to check after rebase. |
| `npm run workflow:check` | 0 | 15 status files valid and synced, including `event-soft-delete-retention/status.json`. |
| `git diff --check` | 0 | No whitespace errors after rebase. |

T006 implementation is reviewed. Firestore rules and Firebase Functions deploys were completed before closeout to Firebase project `dive-into-run`; do not redeploy.

T009 updated runtime tests to assert concrete `Date` values and exact 90-day purge math. T009 also added explicit future-skew emulator coverage; the test passed against existing rules, so no additional production rules change was needed.

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
- [x] PR, CI, and merge notes record that rules and Functions were already deployed before closeout.
- [x] Open incidents are resolved or explicitly carried forward without blocking closeout.
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
- Firestore rules and Firebase Functions were already deployed before closeout; do not redeploy.
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
