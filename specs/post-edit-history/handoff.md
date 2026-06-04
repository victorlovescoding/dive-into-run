# Article Post Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history`
- Branch: `092-post-edit-history`
- Current head: `6a61283c02c6334f9062f10b26e44e0c4a9910c3` (`Add post edit history persistence`)
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
- Current phase: `implementation_blocked`
- Active task: `T003`
- Active wave: `wave-3b`
- Latest reviewer decision: `review_passed` for `T003A`; `T003` remains task-local `blocked`
- Last verified commit: `6a61283c02c6334f9062f10b26e44e0c4a9910c3`; T001 and T002 are committed, while T003 UI/runtime implementation is dirty and not accepted
- Phase commits:
  - `spec_approved` -> `891da4a415da652dc32688f9d738afd958adc5c6`
  - `post_rebase_state` -> `b97f8a0db6e8fe62ba10c23593cbec133ece5eec`
  - `shared_core` -> `3cd1d970a7a42a8dc9c1b8a35ca843b1edc367cf`
  - `article_history_persistence_rules` -> `6a61283c02c6334f9062f10b26e44e0c4a9910c3`
- Pending phase commit: `browser_test_lint_config`; do not commit from this state sync
- Rules deploy status: `required`; changed=true because `firestore.rules` changed, deployedCommit=null, no deploy evidence
- Incidents: none
- Blocked: no for dispatching `T003` follow-up; `T003` remains task-local `blocked`
- Blocked reason: T003 review cannot complete until `tests/browser/ui/posts/PostDetailScreen.test.jsx:185` no-restricted-syntax (`toHaveBeenCalledTimes`) is fixed and browser evidence is captured against a real edited article post
- Latest blocker sync: 2026-06-04T09:31:38Z; `T003A` Reviewer returned `review_passed` because ESLint parser/project-service coverage for `tests/browser/**` is fixed, and `npm run lint:changed` now fails on the real T003-owned lint violation in `tests/browser/ui/posts/PostDetailScreen.test.jsx:185` rather than ESLint project-service coverage. Treat that non-zero exit as the T003 blocker, not T003A incompletion. Rules deploy remains required and unauthorized; do not claim deploy.

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

Dispatch `T003` follow-up to fix `tests/browser/ui/posts/PostDetailScreen.test.jsx:185` no-restricted-syntax (`toHaveBeenCalledTimes`), rerun lint, and obtain browser article evidence. Do not complete `T003` until Reviewer PASS and workflow state is reconciled.

Next dispatchable task after that gate:

- `T003 - Article Post List/Detail UI Wiring And Browser Evidence`

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
- T003A is completed; browser tests remain linted under the updated ESLint project-service config, and the remaining `lint:changed` non-zero exit is carried by T003.
- Browser evidence is required in T003 and validated again in T004.
- T004 owns only workflow state and final integration verification.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git status --short --branch` | 0 | On `092-post-edit-history`; branch ahead 7 of `origin/main`; workflow docs dirty plus blocked T003 implementation files and untracked T003 browser tests; no staged changes. |
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

- `T003` is task-local blocked. `npm run lint:changed` fails at `tests/browser/ui/posts/PostDetailScreen.test.jsx:185` on no-restricted-syntax (`toHaveBeenCalledTimes`).
- Browser evidence still needs a real edited article post. Browser setup may sign in, create an article post, edit it, and capture that same edited article through app/browser interaction. If deterministic seed/fixture data is required, stop and add a separate fixture task.
- Carry-forward gate before `T003` completion: fix the lint violation, obtain browser evidence, and get Reviewer PASS; current status has no branch-behind state. Do not dispatch if workflow state drifts.

## Latest Review State

- Reviewer returned `review_passed` for `T003A`; its parser/project-service blocker is resolved, while `T003` remains blocked for lint follow-up and browser evidence.
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
- T003 must account for origin/main event comment input behavior if it ever touches comment mutation surfaces; current plan avoids those files.

## Pitfalls

- Do not implement production code from the Planner role.
- Do not broaden T001 into article post persistence or UI wiring.
- Do not run a rules deploy; `deployFirestoreRules=false`.
- Do not complete `T003` before `T003A` passes and browser evidence is captured or explicitly blocked.
- Do not add deterministic seed/fixture data inside T003; that requires a separate task.
- Do not claim deployed rules or deployed product behavior without deploy evidence.
- Do not push, create PR, watch CI, merge, or sync local `main` under the current authorization boundary.
- Stop if package-lock or unrelated files become dirty.
