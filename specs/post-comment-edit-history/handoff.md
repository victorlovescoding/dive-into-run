# Post Comment Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Profile: P4, because this is a new product feature and Firestore rules are in scope.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-088-post-comment-edit-history`
- Branch: `088-post-comment-edit-history`
- Current head: `c3c3d7c4b92c2588ea673298f5fbcc3bd0359863`
- Remote head: `origin/main` at `7beac6ba38d04867fa73337bf3b4601dce7789af`
- Authorization boundary:
  - edit: true. User authorized implementation on 2026-06-03 after approving the design and durable repo docs.
  - commit: true. User said "該commit就commit" on 2026-06-03.
  - push: true. User explicitly requested closeout on 2026-06-03: "push pr ci merge 本地同步，請subagent完成".
  - pullRequest: true. User explicitly requested closeout on 2026-06-03.
  - ciWatch: true. User explicitly requested closeout on 2026-06-03.
  - merge: true. User explicitly requested closeout on 2026-06-03.
  - localMainSync: true. User explicitly requested closeout on 2026-06-03.
  - deployFirestoreRules: true. User explicitly requested Firestore rules deploy on 2026-06-03 after feature verification.
- Current phase: `closeout_authorized`
- Active task: none
- Active wave: none
- Latest reviewer decision: final review `review_passed` by Sagan on 2026-06-03 after worker fixes for runtime forwarding, repo no-op handling, and rules/history binding.
- Last verified commit: `c3c3d7c4b92c2588ea673298f5fbcc3bd0359863`
- Phase commits:
  - `specs`: `35fee2d6037d83df0a5caf417b5d878e28f1670d` (`Add post comment history spec`)
  - `service`: `e0a54ed2941822d964ec2a798d0d87e9406da493` (`Add shared comment edit history service`)
  - `post-data-flow`: `b7c1b72d71364792eda4d152adf3073e08592d12` (`Add post comment history data flow`)
  - `runtime`: `c7bec764301e890143cde8576a1350dd766cc4ab` (`Wire post comment history runtime`)
  - `ui`: `5893c785584a4f5db2dbb332876178b0465d53de` (`Wire post comment history UI`)
  - `rules`: `7375402afdb36e99c9934b6583359652b995b612` (`Add post comment history rules`)
  - `review-fixes`: `73fd4e04eeae582fd71af814a6aa384b705c7e41` (`Fix post history review gaps`)
- Rules deploy status: `deployed`, `changed=true`, deployed to project `dive-into-run` from commit `c3c3d7c4b92c2588ea673298f5fbcc3bd0359863`.
- Incidents: none
- Blocked: no
- Blocked reason: none.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `specs/post-comment-edit-history/handoff.md`
4. `specs/post-comment-edit-history/tasks.md`
5. `specs/post-comment-edit-history/status.json`
6. `specs/post-comment-edit-history/spec.md` and `specs/post-comment-edit-history/plan.md` as needed for scope or acceptance details

## Next Action

Closeout worker should push the rebased branch, open a ready PR, watch CI, merge after required checks are green, and fast-forward local main. Product code edits remain forbidden during closeout. Browser visual evidence is limited: HTTP page load passed, but Playwright/browser modal click evidence was blocked by local browser permissions and public data did not provide edited comments to click.

## Latest Evidence

- Branch/worktree evidence:
  - `git status --short --branch` at planning start showed `## 088-post-comment-edit-history...origin/main` with no changed files.
  - `git rev-parse --verify HEAD` returned `f3ca150ece7f9ba182fcde80cae95d6c0da18305`.
  - `git rev-parse --verify origin/main` returned `f3ca150ece7f9ba182fcde80cae95d6c0da18305`.
- Existing event flow evidence:
  - `src/service/event-comment-service.js:114` builds event update/history payload using `content`.
  - `src/runtime/client/use-cases/event-comment-use-cases.js:130` calls event comment update flow with old content.
  - `src/repo/client/firebase-event-comments-repo.js:89` through `src/repo/client/firebase-event-comments-repo.js:109` writes event comment history in a transaction.
  - `firestore.rules:409` through `firestore.rules:421` defines event comment history rules.
- Existing post gap evidence:
  - `src/service/post-service.js:156` through `src/service/post-service.js:176` already has an unused post comment update/history payload helper. The plan accounts for this by extracting shared helper logic instead of assuming no post payload code exists.
  - `src/runtime/client/use-cases/post-use-cases.js:317` through `src/runtime/client/use-cases/post-use-cases.js:318` only calls `updateCommentDocument(postId, commentId, { comment })`.
  - `src/repo/client/firebase-posts-repo.js:280` through `src/repo/client/firebase-posts-repo.js:281` only uses `updateDoc` for post comment updates.
  - `src/runtime/hooks/usePostComments.js:136` through `src/runtime/hooks/usePostComments.js:165` updates only local `comment` text and calls update without previous text/history metadata.
  - `src/ui/posts/PostDetailScreen.jsx:189` through `src/ui/posts/PostDetailScreen.jsx:199` maps post comments to `CommentCard` with `updatedAt: null` and `isEdited: false`.
  - `src/ui/posts/PostDetailScreen.jsx:346` through `src/ui/posts/PostDetailScreen.jsx:358` renders `CommentCard` without `onViewHistory`.
  - `firestore.rules:250` through `firestore.rules:281` defines post comment rules without a nested history match.
- Shared modal evidence:
  - `src/components/CommentHistoryModal.jsx:30` through `src/components/CommentHistoryModal.jsx:40` renders history entries from `entry.content`.
  - `src/components/CommentHistoryModal.jsx:65` through `src/components/CommentHistoryModal.jsx:69` renders current comment from `comment.content`.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `npm run workflow:check -- specs/post-comment-edit-history/status.json` | 0 | `status.json` valid and synced for this feature. |
| `node scripts/check-superpowers-state.js --owned-files specs/post-comment-edit-history/spec.md specs/post-comment-edit-history/plan.md specs/post-comment-edit-history/tasks.md specs/post-comment-edit-history/handoff.md specs/post-comment-edit-history/status.json --status specs/post-comment-edit-history/status.json` | 0 | Five changed files are within explicit owned specs files; workflow state synced. |
| `git diff --check` | 0 | No whitespace errors. |
| `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js` | 0 | T001 service tests passed: 1 file, 6 tests. |
| `npm run lint:changed` | 0 | No lint errors; existing React version warning only. |
| `npm run type-check:changed` | 0 | No type errors in changed files. |
| `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js` | 0 | T002 use-case tests passed: 1 file, 7 tests. |
| `npx vitest run --project=browser src/runtime/hooks/usePostComments.test.jsx` | 0 | T003 hook tests passed: 1 file, 7 tests. |
| `npx vitest run --project=browser src/ui/posts/PostDetailScreen.test.jsx` | 0 | T004 UI wiring tests passed: 1 file, 6 tests. |
| `firebase emulators:exec --only auth,firestore --project demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | T005 rules tests passed under local emulators: 1 file, 21 tests. |
| `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js src/runtime/hooks/usePostComments.test.jsx src/ui/posts/PostDetailScreen.test.jsx` | 0 | Final browser-project integration tests passed: 4 files, 26 tests. |
| `branch changed JS ESLint via npx eslint --no-warn-ignored` | 0 | All JS/JSX/MJS files changed since `origin/main` lint clean; existing React version warning only. |
| `npx tsc --noEmit` | 0 | Full TypeScript check passed. |
| `npm run depcruise` | 0 | No dependency violations found. |
| Browser iab desktop/mobile public post detail check | 0 | Local post detail page loaded on desktop and mobile; five public posts with comments had zero existing edited comments, so the history modal could not be manually clicked with real data. |
| `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js src/runtime/hooks/usePostComments.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx src/ui/posts/PostDetailScreen.test.jsx` | 0 | Final post comment edit-history tests passed after review fixes: 5 files, 37 tests. |
| `firebase emulators:exec --only auth,firestore --project demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | Final rules tests passed after review fixes: 1 file, 25 tests. |
| `branch changed JS ESLint via npx eslint --no-warn-ignored` | 0 | All JS/JSX/MJS files changed since `origin/main`, plus dirty JS before the review-fixes commit, lint clean; existing React version warning only. |
| `npx tsc --noEmit --incremental false` | 0 | Full type check passed without writing `tsconfig.tsbuildinfo`; plain `npx tsc --noEmit` was blocked by sandbox EPERM writing the incremental build info file. |
| `npm run depcruise` | 0 | No dependency violations found. |
| `npm run workflow:check -- specs/post-comment-edit-history/status.json` | 0 | Workflow status valid and synced. |
| `git diff --check` | 0 | No whitespace errors. |
| `curl -I http://127.0.0.1:3002/posts` | 0 | Local post page returned HTTP 200 through the Next dev server. Browser modal click evidence remains limited by local browser permissions and lack of edited public comments. |
| `firebase deploy --only firestore:rules --project dive-into-run` | 0 | Firestore rules deployed; output included `firestore: released rules firestore.rules to cloud.firestore`. |

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

- No workflow blocker for the specs-only planning task.
- Firestore rules were deployed after explicit user authorization on 2026-06-03.

## Pitfalls

- Do not treat the existing `src/service/post-service.js` update helper as complete feature support; it is not wired to repo transaction, runtime history state, UI, or rules.
- Do not change post comment main document text field from `comment` to `content`.
- Rules-backed behavior may be claimed only with deploy evidence recorded in `rulesDeployStatus`.
- Do not parallelize shared helper or Firestore rules work with dependent tasks.
