# Article Post Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history`
- Branch: `092-post-edit-history`
- Current head: `dcda33b5237509cb8eac9949a9776b6cfd47366f` (`Move shared core tests`)
- Remote head: `origin/main` at `4145241dd5f21e17812dad3d7448be2bb74c090e` (`Remove colocated src tests (#134)`)
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
- Active task: `T003`
- Active wave: `wave-3`
- Latest reviewer decision: `review_passed` for `T002` article post history persistence, strict rules, and cleanup
- Last verified commit: `dcda33b5237509cb8eac9949a9776b6cfd47366f`; T002 implementation is verified in the current dirty working tree and pending commit
- Phase commits:
  - `spec_approved` -> `891da4a415da652dc32688f9d738afd958adc5c6`
  - `post_rebase_state` -> `b97f8a0db6e8fe62ba10c23593cbec133ece5eec`
  - `shared_core` -> `3cd1d970a7a42a8dc9c1b8a35ca843b1edc367cf`
- Pending phase commit: `article_history_persistence_rules`; do not commit from this state sync
- Rules deploy status: `required`; changed=true because `firestore.rules` changed, deployedCommit=null, no deploy evidence
- Incidents: none
- Blocked: no
- Blocked reason: none
- Latest T002 sync: 2026-06-04T08:40:47Z; `T002` completed with Reviewer `review_passed`, current status reports branch ahead 6 of `origin/main` with no behind state, and dirty files are T002 implementation plus workflow state files. Rules deploy remains required and unauthorized; do not claim deploy.

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

Dispatch `T003` for article post list/detail UI wiring and browser evidence. Leave `T003` as `todo` until dispatch.

Next dispatchable task after that gate:

- `T003 - Article Post List/Detail UI Wiring And Browser Evidence`

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
| `npx vitest run tests/browser/runtime/hooks/useEditHistoryModal.test.jsx tests/browser/components/EditHistoryModal.test.jsx tests/browser/components/CommentHistoryModal.test.jsx` | 0 | 3 files / 11 tests passed. |
| `npx vitest run tests/browser/service/post-service.test.js tests/browser/runtime/client/use-cases/post-use-cases.test.js` | 0 | 2 files / 5 tests passed. |
| `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | 1 file / 37 tests passed. |
| `git diff -- firestore.rules` | 0 | No event-comment rules hunks changed. |
| `npm run type-check` | 0 | `tsc --noEmit` completed without errors. |
| `npm run lint -- --max-warnings 0` | 0 | `eslint src specs --max-warnings 0` completed; existing React-version settings warning only. |
| `npm run workflow:check` | 0 | 17 status file(s) valid and synced; `specs/post-edit-history/status.json` ok and sync ok. |
| `git diff --check` | 0 | No whitespace errors. |
| `git status --short --branch` | 0 | On `092-post-edit-history`; branch ahead 6 of `origin/main`; dirty files are T002 implementation plus workflow state files; no staged changes. |

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
- Carry-forward gate before `T003`: commit for T002 remains pending; current status has no branch-behind state. Do not dispatch if workflow state drifts.

## Latest Review State

- Reviewer returned `review_passed` for `T002`.
- User approved the spec and authorized implementation start after Planner task contracts.
- Planner contracts are now available in `tasks.md`.
- Commit is authorized when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches, but this state sync did not commit.
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
