# Article Post Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history`
- Branch: `092-post-edit-history`
- Current head: `2ded9f33aa71010ced6e037001c5e2b93487f24d` (`2ded9f3 Move post edited badge to time row`)
- Remote head: `origin/main` at `50972d7694cdd52096f3e857226fcb60e14de536`; current branch reports ahead 12 and behind 0 relative to `origin/main`.
- Authorization boundary:
  - edit: true
  - commit: false for this verifier update; downstream commit can proceed only after Reviewer PASS and explicit release handling
  - push: true, authorized for downstream closeout only
  - pullRequest: true, authorized for downstream closeout only
  - ciWatch: true, authorized for downstream closeout only
  - merge: true, authorized for downstream closeout only
  - localMainSync: true, authorized for downstream closeout only
  - deployFirestoreRules: true only as a record of the already executed Firestore-only rules deploy; no additional deploy authorized
- Current phase: `integration`
- Active task: `T004`
- Active wave: `wave-4`
- Latest reviewer decision: `review_passed` for `T003`; findings none. T004 is `engineer_done` and awaits Integration Reviewer.
- Last verified commit: `2ded9f33aa71010ced6e037001c5e2b93487f24d`; verification covers the rebase-local UI placement commit.
- Phase commits:
  - `spec_created` -> `4b87ce41d02ca821c93de114e545b948c400f16c`
  - `spec_approved` -> `4798096195563e57977a79934b007b057ab07e51`
  - `post_rebase_state` -> `9e8052e3fd121eb7c17bc66446bb58099260bdac`
  - `plan_and_tasks` -> `35257d036d568293bc7cee923c9be0ffd3693256`
  - `shared_core` -> `29b7d9c24d358431e9739c2e6ffb9dd396c666de`
  - `shared_core_test_layout` -> `066ba10ea1639755601dbf3aea0155e9adab6a98`
  - `article_history_persistence_rules` -> `c9b2714939ba5dffbbac0f3ff8731a985bc61657`
  - `browser_test_lint_config` -> `3e6f35b06f6fe28291e7bf05adbe8a8c51ef91d7`
  - `article_history_ui` -> `363b229b484d517da99d72d9c6a86b647ca9b51d`
  - `integration_gate` -> `1f6e1d329cf82a9463e5506f12108e0974277f13`
  - `rules_deploy_record` -> `754e8d2dfb1958a4de98a8106d83ec2c1a236d63`
  - `post_edited_badge_time_row` -> `2ded9f33aa71010ced6e037001c5e2b93487f24d`
- Pending workflow-state review: this rebase-local state sync is ready for Integration Reviewer; do not stage/commit before review.
- Rules deploy status: `deployed` for Firestore rules content only. Actual deploy source commit was pre-rebase `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; current HEAD `2ded9f33aa71010ced6e037001c5e2b93487f24d` was not redeployed. Verified `firestore.rules` content equivalence with `git diff --exit-code 3f83371be5cf7ef3c59aee463c006a4930a4f5e2 HEAD -- firestore.rules` exit 0.
- Incidents: none
- Blocked: no
- Blocked reason: null

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

Send T004 to Integration Reviewer. Do not mark T004 or the feature completed until Reviewer PASS and workflow files are synced after review.

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
- T003 is completed; UI placement follow-up commit `2ded9f3` is covered by final verification.
- T004 owns only workflow state and final integration verification.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git status --short --branch` | 0 | On `092-post-edit-history`; ahead 12 and behind 0 relative to `origin/main`; worktree clean before workflow state sync. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run lint:changed` | 0 | No changed JS files to lint. |
| `npm run type-check:changed` | 0 | No changed JS files to check. |
| `npm run workflow:check` | 0 | 18 status files valid and synced; specs/post-edit-history/status.json ok and sync ok after rebase-local workflow-state sync. |
| `npx vitest run tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 2 files / 7 tests passed; covers post edited badge placement on list/detail screens. |
| `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 4 files / 11 tests passed. |
| `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | 1 file / 37 tests passed; auth/firestore emulators started and stopped successfully. |
| `git diff --exit-code 3f83371be5cf7ef3c59aee463c006a4930a4f5e2 HEAD -- firestore.rules` | 0 | No `firestore.rules` content diff between the pre-rebase deployed source commit and current HEAD; content-equivalence evidence only, not a redeploy. |

## Closeout Checklist

- [x] `tasks.md` task states match `status.json`.
- [x] Active task and active wave match `status.json`.
- [x] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [x] `lastVerification` has one entry per command.
- [x] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits` reflect the latest verified state.
- [x] `authorizationBoundary.deployFirestoreRules` is recorded and treated as separate from closeout actions.
- [x] `rulesDeployStatus` records actual pre-rebase deploy source and current content-equivalence without claiming HEAD was redeployed.
- [x] Open incidents are resolved or absent.
- [x] Changed files are intentionally in scope.

## Blockers

- None active.
- Firestore rules release boundary: already deployed Firestore-only rules came from pre-rebase source commit `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`. Current HEAD `2ded9f33aa71010ced6e037001c5e2b93487f24d` was not redeployed; `firestore.rules` content is equivalent by diff. Hosting, functions, storage, and indexes were not deployed.

## Latest Review State

- T004 Engineer state: `engineer_done`; Integration Reviewer PASS is pending.
- T004 final gates were rerun after rebase. Pre-sync `workflow:check` failed only because state still referenced pre-rebase commits; this sync updates those refs.
- Push, PR, CI watch, merge, and local `main` sync are authorized for downstream closeout but were not performed here.
- Commit was not staged or created by this verifier task.

## Reviewer Attention

- Treat article post history path as fixed: `/posts/{postId}/history/{historyId}`.
- Treat article post history read policy as fixed: same read visibility as the active article post.
- T002 must not harden event-comment Firestore rules.
- T003A must keep `tests/browser/**` linted.
- Verify the rules deploy wording: current HEAD is content-equivalent, not redeployed.

## Pitfalls

- Do not run another deploy.
- Do not claim `2ded9f33aa71010ced6e037001c5e2b93487f24d` was deployed.
- Do not claim hosting/functions/storage/indexes deploy or broader deployed product behavior.
- Do not push, create PR, watch CI, merge, or sync local `main` from this verifier state unless a downstream release task is explicitly executing that step.
- Stop if package-lock or unrelated files become dirty.
