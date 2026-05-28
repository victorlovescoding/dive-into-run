# Post And Comment Soft Delete Retention Tasks

## Compact Guard

- This file is the human-readable task source of truth for
  `specs/post-comment-soft-delete-retention/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`,
  this file, and `status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer
  subagents, including code, docs, workflow docs, ADRs, `.codex/**`, scripts,
  and config.
- A task can become `completed` only after `review_passed` and coordinator
  state sync.
- Command evidence is one command per entry. Do not combine commands with
  shell chain operators.
- New state uses `status.json` schemaVersion 3.
- Final summaries must not imply deployed Firestore rules, deployed Firebase
  Functions, or deployed product behavior unless deploy evidence is recorded.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Same-wave work requires disjoint owned files and isolated worktrees.
- Shared helpers, `firestore.rules`, Functions runtime, and workflow-state
  writes must serialize.
- Recommended execution: sequential tasks in a fresh worktree, unless the
  coordinator creates additional worktrees for T003 and T005 after T001.

## Planner Output

- Dependency graph:
  - T001 -> T002
  - T001 -> T003
  - T002 -> T004
  - T003 -> T004
  - T004 -> T006
  - T005 -> T006
- Parallel waves:
  - `wave-1`: T001
  - `wave-2`: T002, T003, T005 when assigned disjoint worktrees; otherwise run
    sequentially.
  - `wave-3`: T004
  - `wave-4`: T006
- Final integration gate:
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `npm run workflow:check`: exit 0.
  - `git diff --check`: exit 0.

## Tasks

### T001 - Soft Delete Domain Helpers

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: none
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: attempt 1 root `tests/unit/**` path failed `lint:changed`;
  resolved by moving the browser test under this spec directory.

Scope:

- Add post-service soft-delete helpers and tests.

Non-scope:

- Do not touch Firebase repo files, runtime hooks, Firestore rules, or Functions.

Owned files:

- `src/service/post-service.js`
- `specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js`

Read-only context:

- `specs/post-comment-soft-delete-retention/spec.md`
- `src/runtime/client/use-cases/post-use-cases.js`

Dependencies:

- User authorization for implementation edits.

Browser evidence:

- Not applicable.

Engineer instructions:

- Add a `POST_DELETE_RETENTION_DAYS` constant set to `90`.
- Add helpers equivalent to:

```js
export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function buildSoftDeletePayload({ actorUid, deletedAtValue, purgeAtValue }) {
  if (!actorUid) throw new Error('softDelete: actorUid is required');
  return { deletedAt: deletedAtValue, deletedByUid: actorUid, deletedPurgeAt: purgeAtValue };
}

export function isSoftDeletedRecord(record) {
  return !!record && Object.prototype.hasOwnProperty.call(record, 'deletedAt');
}

export function isActiveRecord(record) {
  return !isSoftDeletedRecord(record);
}
```

- Extend the `Post` and `Comment` typedefs with optional `deletedAt`,
  `deletedByUid`, and `deletedPurgeAt`.
- Add tests for 90-day math, missing `deletedAt` active records, and present
  `deletedAt` deleted records.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: Retention helper calculates exactly 90 days after delete time.
- AC-T001.2: Legacy records without `deletedAt` are active.
- AC-T001.3: Records with `deletedAt` are deleted.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js` | Exit 0, soft-delete service tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Tests fail before implementation or the Engineer provides valid RED evidence.
- Helper names and payload fields match the spec.
- No product behavior changes outside service helpers.

Evidence:

- Engineer RED: root-path test failed before helper exports existed.
- Engineer GREEN: `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js`
  exit 0, 1 file / 4 tests passed.
- Engineer verification: `npm run lint:changed` exit 0; `npm run
  type-check:changed` exit 0.
- Spec review: `review_passed` on 2026-05-27T18:47:45Z, no spec-compliance
  issues found.
- Code quality review: `review_passed` on 2026-05-27T18:47:45Z, no
  code-quality issues found.

### T002 - Post And Comment Soft Delete Writes

- **State**: `completed`
- **Attempt**: 4
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: code-quality review rejected attempts for pagination cursor
  handling, deleted comment lookup, nullable actor guard, repeated post delete
  idempotency, stale JSDoc, and cursor assertion gaps; all resolved.

Scope:

- Convert post and post-comment delete behavior from hard delete to soft delete.
- Hide soft-deleted posts/comments in post use cases.

Non-scope:

- Do not change notifications, member dashboard, favorites, rules, or Functions.

Owned files:

- `src/repo/client/firebase-posts-repo.js`
- `src/runtime/client/use-cases/post-use-cases.js`
- `src/runtime/hooks/usePostComments.js`
- `specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js`

Read-only context:

- `src/service/post-service.js`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/ui/posts/PostDetailScreen.jsx`

Dependencies:

- T001.

Browser evidence:

- Not required for this task; final implementation may add Browser QA if UI
  behavior changes beyond existing delete flows.

Engineer instructions:

- Use `serverTimestamp()` for `deletedAt`.
- Use a Firestore `Timestamp.fromDate(...)` or existing timestamp factory for
  `deletedPurgeAt`.
- `deletePostTree(postId)` must become a post document soft-delete update and
  retain `{ ok: true }`.
- `deleteCommentDocument(postId, commentId, actorUid)` must run a transaction:
  read comment, return if missing or already deleted, update comment with
  soft-delete fields, decrement parent `commentsCount` with lower-bound
  protection.
- `addCommentDocument()` must read the parent post and throw if the post is
  missing or soft-deleted.
- `getPostDetail()` must return `null` for a soft-deleted post.
- `getLatestComments()` and `getMoreComments()` must return active comments
  only.
- Pass the actor UID from `deleteComment()` callers.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: Post delete updates only the post document with soft-delete fields.
- AC-T002.2: Comment delete is idempotent and decrements once.
- AC-T002.3: Deleted post detail reads return `null`.
- AC-T002.4: Deleted comments are not returned to the post detail UI.
- AC-T002.5: New comments under deleted posts are rejected.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js` | Exit 0, post/comment soft-delete tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Comment delete cannot double-decrement `commentsCount`.
- Post delete does not hard delete comments or likes.
- Existing UI delete handlers still receive successful results and error paths.

Evidence:

- Engineer RED: focused test failed before soft-delete behavior; later RED
  regressions caught pagination behind deleted raw pages, deleted comment
  lookup, missing actor delete work, and repeated post delete audit rewrites.
- Engineer GREEN: `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js`
  exit 0, 12 tests passed.
- Engineer verification: `npm run lint:changed` exit 0; `npm run
  type-check:changed` exit 0.
- Coordinator verification: focused T002 Vitest command exit 0 at
  2026-05-28 06:26 CST; `git diff --check --` T002 files exit 0.
- Spec review: `review_passed`, no spec-compliance issues found.
- Code quality review: final `review_passed`, no code-quality issues found.

### T003 - Secondary Surfaces And Notifications

- **State**: `completed`
- **Attempt**: 2
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: quality review rejected attempt 1 for sparse dashboard pages,
  repo-to-service dependency direction, and invalid notification author UIDs;
  resolved in attempt 2.

Scope:

- Hide deleted post/comment records from dashboard/favorites surfaces.
- Exclude deleted comments from post reply notification recipients.

Non-scope:

- Do not change post delete write behavior, Firestore rules, or Functions.

Owned files:

- `src/repo/client/firebase-member-repo.js`
- `src/repo/client/firebase-notifications-repo.js`
- `src/runtime/client/use-cases/member-dashboard-use-cases.js`
- `src/service/member-dashboard-service.js`
- `src/service/content-favorite-service.js`
- `specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js`
- `specs/post-comment-soft-delete-retention/tests/unit/service/content-favorite-soft-delete.test.js`
- `specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js`
- `specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js`

Read-only context:

- `src/runtime/client/use-cases/notification-use-cases.js`
- `src/runtime/client/use-cases/member-dashboard-use-cases.js`
- `src/runtime/client/use-cases/content-favorite-use-cases.js`
- `src/lib/notification-helpers.js`

Dependencies:

- T001.

Browser evidence:

- Not applicable.

Engineer instructions:

- Update distinct post comment author discovery so docs with `deletedAt` do not
  contribute an author UID.
- Keep actor and post-author exclusion inside `notifyPostCommentReply()`.
- Filter `buildMyPostsPage()` results to active posts.
- Filter `buildRawMyCommentItems()` results to active comments.
- Make `buildFavoriteTargetItem()` return `missing: true` for soft-deleted post
  targets; event favorites remain unchanged.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: A user whose only post comment is deleted is not notified.
- AC-T003.2: A user with another active post comment is still notified.
- AC-T003.3: Member dashboard posts/comments omit deleted records.
- AC-T003.4: Favorite rows treat deleted posts as missing targets.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/content-favorite-soft-delete.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js` | Exit 0. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Notification tests cover deleted-only and mixed active/deleted commenters.
- Favorites behavior is limited to post targets.

Evidence:

- Engineer RED: dashboard service tests failed for deleted post/comment
  inclusion; favorite test failed for deleted post target not missing;
  notification test failed for deleted-only commenter still notified.
- Engineer RED attempt 2: dashboard runtime tests failed because deleted raw
  records hid later active records; notification test failed because invalid
  `authorUid` values produced notification payloads.
- Engineer GREEN and Reviewer verification: four focused T003 Vitest files
  passed, 9 tests total.
- Engineer/Reviewer verification: `npm run lint:changed` exit 0; `npm run
  type-check:changed` exit 0.
- Spec review: `review_passed`, no spec-compliance issues found.
- Code quality review: `review_passed`, no code-quality issues found.

### T004 - Firestore Rules For Deleted Posts

- **State**: `completed`
- **Attempt**: 5
- **Wave**: `wave-3`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: previous rules-only blocker resolved by server-boundary
  redesign. Firestore rules now reject broad client
  `collectionGroup('comments')` reads; member dashboard comments load through
  `/api/member/comments` with Admin SDK filtering. Review rejected attempt 4
  because the server cursor accepted raw paths and the server scan had no raw
  read budget; attempt 5 validates same-user comment cursors and caps raw
  comment scans per request.

Scope:

- Move member dashboard "my comments" off direct client
  `collectionGroup('comments')`.
- Add `/api/member/comments` server route with Firebase ID token bearer auth.
- Query own comments through Admin SDK and filter deleted comments plus comments
  under missing/deleted post parents.
- Update Firestore rules so direct post comments obey active parent checks while
  broad client comments collection-group reads are rejected.

Non-scope:

- Do not deploy rules.
- Do not change event direct comment behavior.
- Do not backfill comments or copy parent delete state to children.
- Do not change post delete O(1) behavior.

Owned files:

- `firestore.rules`
- `tests/server/firestore/post-soft-delete-rules.test.js`
- `src/app/api/member/comments/route.js`
- `src/runtime/server/use-cases/member-comments-server-use-cases.js`
- `src/repo/server/firebase-member-comments-server-repo.js`
- `src/repo/client/firebase-member-repo.js`
- `src/runtime/client/use-cases/member-dashboard-use-cases.js`
- `src/service/member-dashboard-service.js`
- `specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js`
- `specs/post-comment-soft-delete-retention/tasks.md`
- `specs/post-comment-soft-delete-retention/handoff.md`
- `specs/post-comment-soft-delete-retention/status.json`

Read-only context:

- `src/runtime/server/use-cases/follow-server-use-cases.js`
- `src/app/api/follows/[targetUid]/route.js`
- `src/config/server/firebase-admin-app.js`
- `firestore.indexes.json`

Dependencies:

- T002.
- T003.

Browser evidence:

- Not applicable.

Engineer instructions:

- Keep direct `posts/{postId}/comments/{commentId}` rules tied to active parent
  post state.
- Reject broad client `collectionGroup('comments')` reads.
- Preserve direct event comment reads.
- Add server/API boundary for dashboard comments using `Authorization: Bearer`
  Firebase ID token verification.
- Server/Admin SDK may use `collectionGroup('comments')` for `authorUid == uid`
  and `createdAt desc` pagination.
- Exclude comments with `deletedAt`; for post comments exclude missing or
  soft-deleted parent posts; keep existing event comment behavior.
- Validate any cursor before Admin SDK reads: accepted cursor paths must be
  exactly `posts/{postId}/comments/{commentId}` or
  `events/{eventId}/comments/{commentId}`, and the cursor document must belong
  to the authenticated uid. Invalid cursors return 400.
- Bound each server request with a raw comment scan budget and return a
  continuation cursor when the budget is spent before the visible page fills.
- Modify only the owned files above.

Acceptance criteria:

- AC-T004.1: Direct read/create/update/delete under soft-deleted post comments
  fail.
- AC-T004.2: Direct active post comment owner/post-author soft-delete behavior
  still passes; non-owners fail.
- AC-T004.3: Client `collectionGroup('comments')` dashboard-style query is no
  longer allowed.
- AC-T004.4: Dashboard comments load through server API and exclude deleted
  comments plus comments under deleted posts.
- AC-T004.5: Event direct comment reads remain allowed.
- AC-T004.6: Workflow state records T004 as review-ready without any deployed
  rules claim; T006 is no longer blocked by the prior architecture flaw.
- AC-T004.7: Invalid, non-comment, missing, or cross-user cursors cannot drive
  arbitrary Admin SDK reads and return a sane 400.
- AC-T004.8: Server pagination has a per-request raw scan budget and returns a
  continuation cursor without skipping or duplicating later active comments.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"` | Exit 0, rules tests pass. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js` | Exit 0, dashboard/API/server filtering tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Rules tests use emulator and fail for forbidden access.
- Client dashboard comments no longer directly query `collectionGroup('comments')`.
- Server route requires bearer token auth and repo filters deleted comments and
  deleted post parents.
- Cursor validation blocks arbitrary Admin SDK document reads and cross-user
  continuation.
- Raw scan budget prevents unbounded deleted/missing-parent comment scans in a
  single server request.
- No deployed-rules claim is made.

Evidence:

- Review rejection: attempt 4 rejected because cursor accepted raw Firestore
  paths and `adminDb.doc(afterCursor).get()` could read arbitrary paths; server
  pagination also recursively scanned without a raw read budget.
- Root cause: Firestore rules-only design cannot bind a recursive parent path
  for broad `collectionGroup('comments')` list queries, so it cannot safely read
  parent post `deletedAt` while keeping parent-only post soft delete.
- Chosen fix: move member dashboard comments to `/api/member/comments`; Admin
  SDK performs own-user collection-group query and server-side parent filtering.
  Firestore rules reject broad client comments collection-group reads while
  preserving direct post/event comment rules.
- RED: runtime test failed before `src/repo/server/firebase-member-comments-server-repo.js`
  existed.
- RED attempt 5: cursor-security and raw-budget tests failed because
  `fetchVisibleMemberCommentDocumentsPage()` did not exist.
- Fix attempt 5: added allowed comment cursor path validation, same-user cursor
  author verification, 400 mapping for invalid cursor, and bounded raw scan
  pagination with continuation cursor.
- GREEN: `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js`
  exit 0, 10 tests passed.
- Rules verification: `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"`
  exit 0, 10 tests passed.
- Repo gates: `npm run lint:changed` exit 0, existing React version warning
  only; `npm run type-check:changed` exit 0.
- Spec compliance review: `review_passed`, no findings.
- Code-quality/security re-review after attempt 5 rejection fix:
  `review_passed`, no blocking findings.
- No Firestore rules, Firebase Functions, indexes, app, commit, push, PR, CI
  watch, merge, or local main sync was run.

### T005 - Firebase Scheduled Purge

- **State**: `completed`
- **Attempt**: 5
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: code-quality reviews rejected earlier attempts for unsupported
  Node 24 Functions runtime, non-post `comments` collection-group rows being
  eligible for purge, missing `deletedAt` hard-delete guards, concurrent batch
  commits that could delete a parent post before child batches were committed,
  and a missing `comments.deletedPurgeAt` collection-group index. All T005
  findings are resolved.

Scope:

- Add Firebase scheduled purge function and deploy-contained purge core.

Non-scope:

- Do not deploy Functions.
- Do not import root `src/**` modules from `functions/`.

Owned files:

- `eslint.config.mjs`
- `firestore.indexes.json`
- `functions/index.js`
- `functions/package-lock.json`
- `functions/package.json`
- `functions/post-retention-purge.js`
- `specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js`

Read-only context:

- `functions/package.json`
- `firebase.json`
- `src/config/server/firebase-admin-app.js`

Dependencies:

- T001.

Browser evidence:

- Not applicable.

Engineer instructions:

- Use `firebase-functions/v2/scheduler` for the scheduled wrapper.
- Keep purge logic in `functions/post-retention-purge.js`.
- Implement purge with dependency injection for Firestore and logger so tests
  can use a fake adapter.
- Query expired posts by `deletedPurgeAt <= now`.
- For each expired post, delete child comments, child likes, and then the post.
- Query expired comments by collection group `comments` and
  `deletedPurgeAt <= now`.
- Only standalone comments under `posts/{postId}/comments/{commentId}` are in
  scope. Skip non-post `comments` collection-group rows such as event comments.
- Require `deletedAt` on expired post and standalone comment snapshots before
  hard-deleting. Post-tree children may be hard-deleted through an expired
  soft-deleted parent post.
- Skip standalone comment purge when the parent post is already being purged in
  the same run.
- Keep each commit batch under 500 writes.
- Log returned counts.
- If `lint:changed` rejects `functions/*.js` because they are outside the
  ESLint project-service scope, add only a narrow `functions/*.js`
  `allowDefaultProject` entry while preserving existing allowlist entries.
- Use a Firebase-supported Functions Node runtime. As of the checked Firebase
  docs, supported runtimes are Node.js 22, Node.js 20, and deprecated Node.js
  18; do not leave the Functions package on Node.js 24.
- Modify only the owned files above.

Acceptance criteria:

- AC-T005.1: Expired post tree purge deletes comments, likes, and post.
- AC-T005.2: Expired standalone comment purge deletes the comment.
- AC-T005.3: Re-running purge with missing docs is a no-op success.
- AC-T005.4: Functions entry validates with `node --check`.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js` | Exit 0. |
| `node --check functions/index.js` | Exit 0. |
| `node --check functions/post-retention-purge.js` | Exit 0. |
| `npm run lint:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- ESLint project-service config change is limited to `functions/*.js` and
  preserves existing allowlist entries.
- No root `@/` alias import appears under `functions/`.
- Purge tests cover batching and idempotency.
- Purge tests cover skipping expired event comments and stale `deletedPurgeAt`
  records that lack `deletedAt`.
- Functions package runtime is set to a Firebase-supported Node.js version and
  lockfile metadata stays synced.
- Firestore indexes include a collection-group single-field index for
  `comments.deletedPurgeAt` so the scheduled purge query can run after index
  deployment.
- No deployed-functions claim is made.

Evidence:

- Engineer RED: focused purge test failed before `functions/post-retention-purge.js`
  existed.
- Engineer RED: `npm run lint:changed` failed because `functions/index.js` was
  outside ESLint project-service scope; resolved with a narrow `functions/*.js`
  allowlist entry.
- Engineer RED regressions caught unsupported Node 24 runtime, event comments
  being deleted by the post purge, stale `deletedPurgeAt` records without
  `deletedAt` being purged, later parent-post batch committing after an earlier
  child batch failed, and missing `comments.deletedPurgeAt` collection-group
  index.
- Engineer GREEN and Reviewer verification:
  `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js`
  exit 0, 1 file / 9 tests passed.
- Engineer/Reviewer verification: `node --check functions/index.js` exit 0;
  `node --check functions/post-retention-purge.js` exit 0; `npm run
  lint:changed` exit 0; `npm run type-check:changed` exit 0.
- Import-boundary check: `rg "@/|src/|\\.\\./src" functions/*.js` exit 1, no
  root source or alias imports.
- Spec review: `review_passed`, no spec-compliance issues found.
- Code quality/security review: final `review_passed`, no blocking findings.
- No Firebase Functions, Firestore rules, or Firestore index deploy was run.

### T006 - Integration Gate And Workflow State

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Verifier
- **Reviewer**: Reviewer
- **Commit checkpoint**: verification
- **Last verified commit**: none
- **Authorization boundary**: edit=yes for workflow state only, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: prior T004 architecture blocker resolved by server-boundary
  redesign. T006 local verification and Reviewer review passed; do not claim
  deployed rules/functions/indexes.

Scope:

- Run final verification and sync workflow state.

Non-scope:

- Do not change product behavior except workflow evidence corrections.
- Do not commit, push, open PR, watch CI, merge, sync `main`, deploy rules, or
  deploy Functions without explicit user authorization.

Owned files:

- `specs/post-comment-soft-delete-retention/tasks.md`
- `specs/post-comment-soft-delete-retention/handoff.md`
- `specs/post-comment-soft-delete-retention/status.json`

Read-only context:

- All changed files from T001 through T005.
- `docs/superpowers/status.schema.json`
- `docs/superpowers/task-contract.md`

Dependencies:

- T001.
- T002.
- T003.
- T004.
- T005.

Browser evidence:

- Not required unless UI behavior changes beyond existing delete flows. If a
  Browser pass is added, verify `/posts` and `/posts/{id}` on desktop 1280x800
  and mobile 390x844 without claiming deployed behavior.

Engineer instructions:

- Re-run every task-specific command that is relevant to changed files.
- Run final gates listed below.
- Update evidence in this file, `handoff.md`, and `status.json`.
- Leave `rulesDeployStatus.state` as `required` or `pending` until deploy is
  separately authorized and evidenced.
- Modify only the owned files above unless a verification correction is
  explicitly approved by the coordinator.

Acceptance criteria:

- AC-T006.1: Final local verification evidence is fresh.
- AC-T006.2: Workflow state is valid and synced.
- AC-T006.3: No release/deploy claim is made.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/content-favorite-soft-delete.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js` | Exit 0. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js` | Exit 0. |
| `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"` | Exit 0. |
| `node --check functions/index.js` | Exit 0. |
| `node --check functions/post-retention-purge.js` | Exit 0. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |
| `npm run workflow:check` | Exit 0. |
| `git diff --check` | Exit 0. |

Reviewer PASS criteria:

- Evidence is fresh and tied to the current commit or working tree.
- Workflow files agree.
- No unauthorized release boundary is crossed.

Evidence:

- T004 synced to completed after spec compliance review and code-quality/security
  re-review both reported `review_passed`.
- Fresh local verification on 2026-05-28T06:01:40Z:
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js`:
    exit 0, 1 file / 4 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js`:
    exit 0, 1 file / 12 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js`:
    exit 0, 1 file / 2 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/content-favorite-soft-delete.test.js`:
    exit 0, 1 file / 2 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js`:
    exit 0, 1 file / 10 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js`:
    exit 0, 1 file / 3 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js`:
    exit 0, 1 file / 9 tests passed.
  - `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"`:
    exit 0, 1 file / 10 tests passed.
  - `node --check functions/index.js`: exit 0.
  - `node --check functions/post-retention-purge.js`: exit 0.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0, no type errors in changed files.
  - `npm run workflow:check`: exit 0, 9 status files valid and synced.
  - `git diff --check`: exit 0.
- T006 Reviewer review: `review_passed` on 2026-05-28T06:09:10Z. Reviewer
  reran `npm run workflow:check` exit 0 and `git diff --check` exit 0; confirmed
  workflow state is synced, evidence is dirty-working-tree scoped, and no
  unauthorized release boundary was crossed.
- `lastVerifiedCommit` remains none because verification covered the dirty local
  working tree, not a committed implementation.
- `rulesDeployStatus.state` remains `required`; no deploy evidence, deployed
  commit, commit, push, PR, CI watch, merge, local main sync, Firestore rules
  deploy, or Firebase Functions deploy was performed.
