# Article Post Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history`
- Branch: `092-post-edit-history`
- Current head: `3f83371be5cf7ef3c59aee463c006a4930a4f5e2` (`3f83371 Record final integration verification`)
- Remote head: `origin/main` at `14515eee2d730d25c7f73fa8eb5c1315504787e8`; current branch reports ahead 10 and behind 0 relative to `origin/main`
- Authorization boundary:
  - edit: true
  - commit: false (this deploy-state update must not be staged or committed; Release Manager handles commit later)
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: true (executed Firestore-only rules deploy; no additional deploy authorized)
- Current phase: `integration`
- Active task: `T004`
- Active wave: `wave-4`
- Latest reviewer decision: `review_passed` for `T003`; findings none. T004 is `engineer_done` and awaits Integration Reviewer.
- Last verified commit: `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; T004 final integration verification was committed before the authorized Firestore rules deploy.
- Phase commits:
  - `spec_approved` -> `0278717e7b30808d3f69580b4b571c502c82b182`
  - `post_rebase_state` -> `173b68393fad51b6d0fa7a47c96171a9342baac2`
  - `plan_and_tasks` -> `f9aec2f4cae314b79bea64e4b947541885be295d`
  - `shared_core` -> `7621e962038c7d4f7caff638e96e51efd63b5e7e`
  - `shared_core_test_layout` -> `6b06f1d7c9ce29d8f7b050ef3276157a18d0149a`
  - `article_history_persistence_rules` -> `4f8763f9f43a8df261011be1a2f336dc21884cc2`
  - `browser_test_lint_config` -> `776413e67872f214bb94f90d649dc6c623649f65`
  - `article_history_ui` -> `4d80d098a4f2e2cb65387f55db8c9f1d4a4cc296`
  - `integration_gate` -> `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`
- Pending workflow-state review: deploy record is synced here for Reviewer check; do not stage or commit this deploy-state update.
- Rules deploy status: `deployed`; required=true, changed=true, deployedCommit=`3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; evidence records project `dive-into-run`, command `firebase deploy --only firestore:rules`, target `cloud.firestore/firestore.rules`.
- Incidents: none
- Blocked: no
- Blocked reason: null
- Latest deploy-state sync: Firestore rules deploy was recorded after authorized deploy. Only Firestore rules were deployed; hosting, functions, storage, and indexes were not deployed. Push/PR/CI watch/merge/local main sync remain unauthorized.

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

Send T004 to Integration Reviewer. Do not mark T004 or the feature completed until Reviewer PASS and the workflow files are synced after review.

Next dispatchable task:

- `T004 Integration Reviewer` review of the workflow-only diff and final verification evidence

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
| `git status --short --branch` | 0 | On `092-post-edit-history`; ahead 10 and behind 0 relative to `origin/main`; dirty files are only workflow state/docs files: `handoff.md`, `plan.md`, `status.json`, `tasks.md`. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run lint:changed` | 0 | No changed JS files to lint. |
| `npm run type-check:changed` | 0 | No changed JS files to check. |
| `npm run workflow:check` | 0 | 18 status files valid and synced; `specs/post-edit-history/status.json` ok and sync ok. |
| `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 4 files / 11 tests passed. |
| `npx vitest run tests/browser/runtime/hooks/useEditHistoryModal.test.jsx tests/browser/components/EditHistoryModal.test.jsx tests/browser/components/CommentHistoryModal.test.jsx tests/browser/service/post-service.test.js tests/browser/runtime/client/use-cases/post-use-cases.test.js tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 9 files / 27 tests passed. |
| `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | 1 file / 37 tests passed; auth/firestore emulators started and stopped successfully. |
| `node /private/tmp/t003-article-history-ui/verify-article-history.mjs` | 0 | Fresh browser rerun PASS against `demo-test` emulators and `http://localhost:3002/posts`; modal showed current/original title and content; networkIssues empty; console warnings were emulator connection messages only. |

Browser screenshots/result: `/private/tmp/t003-article-history-ui/playwright-article-edited-button-desktop.png`, `/private/tmp/t003-article-history-ui/playwright-article-history-modal-desktop.png`, `/private/tmp/t003-article-history-ui/playwright-article-edited-button-mobile.png`, and `/private/tmp/t003-article-history-ui/result.json`.

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
- Firestore rules release boundary: deploy is now evidenced as Firestore-only for project `dive-into-run`, command `firebase deploy --only firestore:rules`, target `cloud.firestore/firestore.rules`, deployedCommit=`3f83371be5cf7ef3c59aee463c006a4930a4f5e2`. Hosting, functions, storage, and indexes were not deployed.

## Latest Review State

- T004 Engineer state: `engineer_done`; Integration Reviewer PASS is pending.
- Reviewer returned `review_passed` for `T003`; findings none. T003A parser/project-service blocker and the later T003 lint/browser blocker are resolved.
- T004 final gates passed. The expected pre-sync `workflow:check` stale-commit failure was corrected by this workflow-state sync; post-sync `git diff --check`, `npm run workflow:check`, and `git status --short --branch` were rerun.
- Browser evidence was rerun fresh via Playwright/emulator using project `demo-test`, Auth 9099, Firestore 8080, Storage 9199, and Next on `localhost:3002` with emulator env/fake config; screenshots are under `/private/tmp/t003-article-history-ui/`; modal showed the old title/content plus current/original labels and new title/content. Setup-only reruns failed until the local emulator Auth/profile test avatar was set to `/default-avatar.png`; no repo files changed for that setup.
- User approved the spec and authorized implementation start after Planner task contracts.
- Planner contracts are available in `tasks.md`.
- Commit is authorized when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches, but this T004 Engineer sync did not commit.
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
- Do not run another deploy. `deployFirestoreRules=true` records the already executed Firestore-only rules deploy; no additional deploy boundary is authorized.
- Do not mark the feature complete before T004 final integration verification passes.
- Do not add deterministic seed/fixture data inside T003; that requires a separate task.
- Firestore rules deploy may be claimed only with the recorded deploy evidence; do not claim hosting/functions/storage/indexes deploy or broader deployed product behavior.
- Do not push, create PR, watch CI, merge, or sync local `main` under the current authorization boundary.
- Stop if package-lock or unrelated files become dirty.
