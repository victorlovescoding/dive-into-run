# Article Post Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history`
- Branch: `092-post-edit-history`
- Current head: `9025466aa75b19f3b24737acad5dd5c62126474e` (`Record post history rebase state`)
- Remote head: `origin/main` at `b1cdaee96618983d333d1b6da2a78c0312e3b7ba` (`Align event comment input behavior`)
- Authorization boundary:
  - edit: true
  - commit: true after Engineer + Reviewer + fresh verification for reviewed implementation batches
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false
- Current phase: `implementation_ready`
- Active task: `T002`
- Active wave: `wave-2`
- Latest reviewer decision: `review_passed` for `T001` shared edit-history core and comment compatibility
- Last verified commit: `9025466aa75b19f3b24737acad5dd5c62126474e`
- Phase commits:
  - `spec_approved` -> `d5568aea71f9b146ead4c460a42b62d25b4040e3`
  - `post_rebase_state` -> `9025466aa75b19f3b24737acad5dd5c62126474e`
- Pending phase commit: `shared_core` for completed `T001`
- Rules deploy status: `required`; required later, changed=false, deployedCommit=null
- Incidents: none
- Blocked: no
- Blocked reason: none
- Latest T001 sync: 2026-06-04T07:28:10Z; `T001` completed after Engineer implementation, Reviewer `review_passed`, and required verification. Current status reports branch ahead 4 and behind 1 of `origin/main`; do not rebase until after the `shared_core` checkpoint commit unless a fresh status changes that decision.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-contract.md`
4. `specs/post-edit-history/handoff.md`
5. `specs/post-edit-history/tasks.md`
6. `specs/post-edit-history/status.json`
7. `specs/post-edit-history/spec.md`
8. `specs/post-edit-history/plan.md`

## Next Action

Commit the reviewed `T001` shared-core checkpoint as `shared_core`, then run a fresh `git status --short --branch`.

If branch still reports behind `origin/main`, handle the rebase before dispatching `T002`. Do not mark `T002` in progress until the checkpoint commit and branch-behind handling are complete.

Next dispatchable task after that gate:

- `T002 - Article Post History Persistence, Strict Rules, And Cleanup`

## Task Graph Summary

```text
T001 shared core
  -> T002 article persistence/rules/cleanup
      -> T003 post list/detail UI wiring
          -> T004 final integration gate/workflow state
```

- Execution is explicitly serialized.
- Shared core is prerequisite to persistence/UI adapters.
- `firestore.rules` and account-deletion cleanup are isolated in T002.
- Browser evidence is required in T003 and validated again in T004.
- T004 owns only workflow state and final integration verification.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `npx vitest run src/runtime/hooks/useEditHistoryModal.test.jsx src/components/EditHistoryModal.test.jsx src/components/CommentHistoryModal.test.jsx` | 0 | 3 files / 11 tests passed. |
| `npx vitest run src/runtime/hooks/usePostComments.test.jsx src/ui/posts/PostDetailScreen.test.jsx` | 0 | 2 files / 14 tests passed. |
| `npx vitest run src/runtime/hooks/useCommentMutations.test.jsx` | 0 | 1 file / 4 tests passed. |
| `git status --short --branch` | 0 | On `092-post-edit-history`; branch ahead 4 and behind 1 of `origin/main`; dirty files are T001 owned files plus workflow state files. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run workflow:check` | 0 | 17 status file(s) valid and 17 status file(s) synced; `specs/post-edit-history/status.json` ok and sync ok. |

## Closeout Checklist

- [ ] `tasks.md` task states match `status.json`.
- [ ] Active task and active wave match `status.json`.
- [ ] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [ ] `lastVerification` has one entry per command.
- [ ] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits` reflect the latest verified state.
- [ ] `authorizationBoundary.deployFirestoreRules` is recorded and treated as separate from `edit`, `commit`, `push`, `pullRequest`, `ciWatch`, `merge`, and `localMainSync`.
- [ ] `rulesDeployStatus` matches the rules release state.
- [ ] Final summary does not imply deployed rules/product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
- [ ] PR/CI/merge notes explicitly carry release risk if rules are in a non-deployed state such as `required`, `pending`, or `blocked`.
- [ ] Open `incidents` are resolved, mitigated with an explicit carry-forward, or block closeout.
- [ ] Changed files are intentionally in scope.
- [ ] Blockers are resolved or explicitly carried forward.

## Blockers

- None.
- Carry-forward gate before `T002`: create the `shared_core` commit checkpoint, then re-check and handle branch behind `origin/main` if still present.

## Latest Review State

- Reviewer returned `review_passed` for `T001`.
- User approved the spec and authorized implementation start after Planner task contracts.
- Planner contracts are now available in `tasks.md`.
- Commit is authorized when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches.
- Push, PR, CI watch, merge, local `main` sync, and rules deploy remain unauthorized.

## Reviewer Attention

- Treat article post history path as fixed: `/posts/{postId}/history/{historyId}`.
- Treat article post history read policy as fixed: same read visibility as the active article post; history is unavailable when the parent post is soft-deleted or otherwise inaccessible.
- Enforce strict post-comment style validation for article posts: parent post update and history create cross-validate pre-edit `title` + `content`, timestamp, and parent `lastEditHistoryId` / `historyId` coupling.
- T002 must not harden event-comment Firestore rules.
- T003 must account for origin/main event comment input behavior if it ever touches comment mutation surfaces; current plan avoids those files.

## Pitfalls

- Do not implement production code from the Planner role.
- Do not broaden T001 into article post persistence or UI wiring.
- Do not run a rules deploy; `deployFirestoreRules=false`.
- Do not claim deployed rules or deployed product behavior without deploy evidence.
- Do not push, create PR, watch CI, merge, or sync local `main` under the current authorization boundary.
- Stop if package-lock or unrelated files become dirty.
