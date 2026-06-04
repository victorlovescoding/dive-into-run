# Article Post Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history`
- Branch: `092-post-edit-history`
- Current head: `6821d3c5f92d6e8adc768aa610d27e7cba87be70` (`Fix browser test lint config`)
- Remote head: `origin/main` at `14515eee2d730d25c7f73fa8eb5c1315504787e8`; current branch reports ahead 8 and behind 6 relative to `origin/main`
- Authorization boundary:
  - edit: true
  - commit: true after Engineer + Reviewer + fresh verification for reviewed implementation batches
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false
- Current phase: `integration`
- Active task: `T004`
- Active wave: `wave-4`
- Latest reviewer decision: `review_passed` for `T003`; findings none
- Last verified commit: `6a61283c02c6334f9062f10b26e44e0c4a9910c3`; T001 and T002 are committed, while T003 UI/runtime implementation is reviewed in the dirty working tree and awaits its authorized checkpoint commit
- Phase commits:
  - `spec_approved` -> `891da4a415da652dc32688f9d738afd958adc5c6`
  - `post_rebase_state` -> `b97f8a0db6e8fe62ba10c23593cbec133ece5eec`
  - `shared_core` -> `3cd1d970a7a42a8dc9c1b8a35ca843b1edc367cf`
  - `article_history_persistence_rules` -> `6a61283c02c6334f9062f10b26e44e0c4a9910c3`
- Pending phase commit: `article_history_ui`; do not commit from this state sync
- Rules deploy status: `required`; changed=true because `firestore.rules` changed, deployedCommit=null, no deploy evidence
- Incidents: none
- Blocked: no
- Blocked reason: null
- Latest blocker sync: 2026-06-04T13:10:53Z; old T003 lint/browser blocker is resolved. T003 Reviewer returned `review_passed` with no findings. Rules deploy remains required and unauthorized; do not claim deploy.

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

Dispatch `T004` final integration verification and workflow-state sync. Do not mark the feature complete until T004 passes.

Next dispatchable task:

- `T004 - Final Integration Verification And Workflow State`

## Task Graph Summary

```text
T001 shared core
  -> T002 article persistence/rules/cleanup
      -> T003A browser test lint configuration
          -> T003 post list/detail UI wiring review completion
              -> T004 final integration gate/workflow state
```

- Execution is explicitly serialized.
- Shared core is prerequisite to persistence/UI adapters.
- `firestore.rules` and account-deletion cleanup are isolated in T002.
- T003A is completed; browser tests remain linted under the updated ESLint project-service config.
- T003 is completed; browser evidence is available and validated again in T004.
- T004 owns only workflow state and final integration verification.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git status --short --branch` | 0 | On `092-post-edit-history`; branch ahead 8 and behind 6 relative to `origin/main`; workflow docs dirty plus reviewed T003 implementation files and untracked T003 browser tests; no staged changes. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run workflow:check` | 0 | 17 status file(s) valid and synced; `specs/post-edit-history/status.json` ok and sync ok. |

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

- None active.
- Carry-forward gate before feature completion: run T004 final integration verification and keep Firestore rules deploy state explicit as required/changed/not deployed. Do not dispatch if workflow state drifts.

## Latest Review State

- Reviewer returned `review_passed` for `T003`; findings none. T003A parser/project-service blocker and the later T003 lint/browser blocker are resolved.
- T003 evidence:
  - Code review: `PostCard` shows article-level `已編輯` only when `post.isEdited && onViewArticleHistory`, calls the article handler, list/detail runtimes use shared `useEditHistoryModal` plus T002 `fetchPostHistory`, local edit sets `isEdited: true`, detail comment history wiring remains intact, and tests cover list/detail article history plus detail comment regression without `toHaveBeenCalledTimes(N)`.
  - Verification: `npx vitest run tests/browser/ui/posts/PostDetailScreen.test.jsx` passed 1 file / 4 tests; focused T003 runtime/UI suite passed 4 files / 11 tests; `npm run lint:changed` passed with only the existing React version warning; `npm run type-check:changed` passed; `git diff --check` passed.
  - Browser: PASS via Playwright/emulator using project `demo-test`, Auth 9099, Firestore 8080, Storage 9199, and Next on `localhost:3002` with emulator env/fake config; screenshots are under `/private/tmp/t003-article-history-ui/`; modal showed the old title/content plus current/original labels and new title/content.
- User approved the spec and authorized implementation start after Planner task contracts.
- Planner contracts are now available in `tasks.md`.
- Commit is authorized when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches, but this state sync did not commit.
- Push, PR, CI watch, merge, local `main` sync, and rules deploy remain unauthorized.

## Reviewer Attention

- Treat article post history path as fixed: `/posts/{postId}/history/{historyId}`.
- Treat article post history read policy as fixed: same read visibility as the active article post; history is unavailable when the parent post is soft-deleted or otherwise inaccessible.
- Enforce strict post-comment style validation for article posts: parent post update and history create cross-validate pre-edit `title` + `content`, timestamp, and parent `lastEditHistoryId` / `historyId` coupling.
- T002 must not harden event-comment Firestore rules.
- T003A must keep `tests/browser/**` linted; do not exclude browser tests from `lint:changed`.
- T003 accounted for article list/detail history without touching comment mutation surfaces; detail comment history wiring remains intact.

## Pitfalls

- Do not implement production code from the Planner role.
- Do not broaden T001 into article post persistence or UI wiring.
- Do not run a rules deploy; `deployFirestoreRules=false`.
- Do not mark the feature complete before T004 final integration verification passes.
- Do not add deterministic seed/fixture data inside T003; that requires a separate task.
- Do not claim deployed rules or deployed product behavior without deploy evidence.
- Do not push, create PR, watch CI, merge, or sync local `main` under the current authorization boundary.
- Stop if package-lock or unrelated files become dirty.
