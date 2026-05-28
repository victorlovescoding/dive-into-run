# Post And Comment Soft Delete Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement soft delete for posts and post comments, remove deleted
comments from follow-up notification eligibility, and purge expired retained
data through Firebase scheduled functions.

**Architecture:** Client-facing post/comment delete flows mark records with
`deletedAt`, `deletedByUid`, and `deletedPurgeAt`. Runtime/service reads hide
soft-deleted posts and comments while preserving legacy records that do not yet
carry soft-delete fields. Firebase Functions owns hard purge because deployment
hosting for the Next app is undecided.

**Tech Stack:** Next.js 15 App Router, React 19, JavaScript with JSDoc
`checkJs`, Firebase Web SDK, Firebase Admin SDK, Firebase Functions v2 scheduler,
Vitest, Firestore rules.

---

## Scope Check

This is one feature with three coupled parts: soft delete write semantics,
reader/notification eligibility, and retention purge. They must land in the
same PR because the notification change depends on the comment soft-delete
state, and the retention requirement depends on the purge worker.

The work is P4 because it changes schema shape, Firestore rules, deletion
behavior, and Firebase Functions release boundaries.

## Architecture

- Soft delete fields exist only after deletion. Legacy active documents that do
  not contain `deletedAt` remain active.
- Active checks use `!('deletedAt' in data)` or equivalent helper logic. The
  plan intentionally avoids a backfill migration.
- User-facing post/comment surfaces filter soft-deleted records after reading.
  This preserves legacy data compatibility without requiring a query migration.
- Firestore rules block comment access and comment creation when the parent post
  has been soft deleted.
- Post soft delete is a single post document update. Child comments and likes
  are retained until the scheduled purge deletes the whole tree.
- Comment soft delete updates the comment document and decrements
  `commentsCount` exactly once inside a transaction.
- Purge logic is implemented inside the `functions/` deploy boundary, with a
  small injectable core so root Vitest can test batching and idempotency without
  importing the root `@/` alias into Firebase Functions.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/service/post-service.js` | Modify | Define retention constants, soft-delete helpers, active-record filters, and post/comment typedef fields. |
| `src/repo/client/firebase-posts-repo.js` | Modify | Replace hard delete calls with soft-delete transactions and guard comment create/update flows against deleted parent posts. |
| `src/runtime/client/use-cases/post-use-cases.js` | Modify | Expose soft-delete behavior through existing post/comment use cases and hide deleted detail reads. |
| `src/runtime/hooks/usePostComments.js` | Modify | Preserve current optimistic UI while relying on idempotent comment delete semantics. |
| `src/repo/client/firebase-notifications-repo.js` | Modify | Discover post comment authors from active comments only. |
| `src/repo/client/firebase-member-repo.js` | Modify | Preserve raw Firestore cursors for dashboard post/comment pagination. |
| `src/runtime/client/use-cases/member-dashboard-use-cases.js` | Modify | Fetch through deleted dashboard records so pages can still fill with active records. |
| `src/service/member-dashboard-service.js` | Modify | Hide soft-deleted posts and comments from member dashboard surfaces. |
| `src/service/content-favorite-service.js` | Modify | Treat soft-deleted post favorite targets as missing. |
| `firestore.rules` | Modify | Block comment read/write operations under soft-deleted posts and preserve ownership boundaries. |
| `eslint.config.mjs` | Modify | Allow root server rules tests through type-aware changed-file linting. |
| `functions/index.js` | Modify | Register the Firebase scheduled purge function. |
| `functions/post-retention-purge.js` | Create | Implement deploy-contained purge core for expired posts/comments. |
| `specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js` | Create | Verify retention field building and active filters. |
| `specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js` | Create | Verify post/comment soft-delete use-case behavior with Firebase SDK mocks. |
| `specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js` | Create | Verify dashboard filtering of deleted posts/comments. |
| `specs/post-comment-soft-delete-retention/tests/unit/service/content-favorite-soft-delete.test.js` | Create | Verify deleted post favorites render as missing targets. |
| `specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js` | Create | Verify dashboard pagination advances past deleted raw pages. |
| `specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js` | Create | Verify reply notification recipient discovery excludes deleted comments. |
| `tests/server/firestore/post-soft-delete-rules.test.js` | Create | Verify rules for comments under active versus deleted posts. |
| `specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js` | Create | Verify purge batching and idempotency with a fake Firestore adapter. |
| `specs/post-comment-soft-delete-retention/tasks.md` | Modify | Track task state and review evidence. |
| `specs/post-comment-soft-delete-retention/handoff.md` | Modify | Keep resume context and latest verification evidence. |
| `specs/post-comment-soft-delete-retention/status.json` | Modify | Keep schema v3 machine-readable workflow state. |

## Data Contracts

Soft-deleted post:

```js
{
  deletedAt: serverTimestamp(),
  deletedByUid: authorUid,
  deletedPurgeAt: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
}
```

Soft-deleted post comment:

```js
{
  deletedAt: serverTimestamp(),
  deletedByUid: actorUid,
  deletedPurgeAt: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
}
```

Active predicate:

```js
export function isSoftDeletedRecord(record) {
  return !!record && Object.prototype.hasOwnProperty.call(record, 'deletedAt');
}

export function isActiveRecord(record) {
  return !isSoftDeletedRecord(record);
}
```

## Dependency Graph

- T001 -> T002, T003
- T002 -> T004
- T003 -> T004
- T004 -> T006
- T005 -> T006
- T006 has no dependents and is the final integration gate.

## Parallel Waves

- `wave-1`: T001
- `wave-2`: T002, T003, T005 can run after T001 only if assigned disjoint
  worktrees or sequentially in this shared worktree.
- `wave-3`: T004 after T002 and T003.
- `wave-4`: T006 final integration.

Because this repo currently has one shared working directory and several tasks
touch shared behavior, default execution should be sequential unless the
coordinator creates isolated worktrees.

## Task Slices

### T001 - Soft Delete Domain Helpers

Add post-service helpers for 90-day purge timestamp calculation, soft-delete
payload construction, and active/deleted filtering.

Acceptance:

- `buildSoftDeletePayload({ actorUid, deletedAtDate })` returns the three
  fields with `deletedPurgeAt` exactly 90 days after `deletedAtDate`.
- Active helpers treat legacy records without `deletedAt` as active.
- Active helpers treat records with `deletedAt` as deleted even if the value is
  a server timestamp sentinel.

Verification:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js` | Exit 0, soft-delete service tests pass. |
| `npm run lint:changed` | Exit 0, changed JS files lint clean. |
| `npm run type-check:changed` | Exit 0, changed JS files have no reported type errors. |

### T002 - Post And Comment Soft Delete Writes

Update post/comment delete use cases to write soft-delete fields instead of
hard deleting. Keep post delete as O(1). Make comment delete transactional and
idempotent.

Acceptance:

- `deletePost(postId)` marks only the post document deleted and keeps the return
  contract `{ ok: true }`.
- `deleteComment(postId, commentId, actorUid)` marks the comment deleted and
  decrements `commentsCount` only if the comment was active.
- Adding a comment under a deleted post throws a domain error and does not
  increment `commentsCount`.
- `getPostDetail()` returns `null` for a soft-deleted post.
- `getLatestComments()` and `getMoreComments()` return active comments only.

Verification:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js` | Exit 0, post/comment soft-delete use-case tests pass. |
| `npm run lint:changed` | Exit 0, changed JS files lint clean. |
| `npm run type-check:changed` | Exit 0, changed JS files have no reported type errors. |

### T003 - Secondary Surfaces And Notifications

Hide soft-deleted posts/comments from member dashboard and favorites, and
exclude soft-deleted comments from `post_comment_reply` recipient discovery.

Acceptance:

- Member "my posts" excludes soft-deleted posts.
- Member "my comments" excludes soft-deleted post comments.
- Member dashboard pagination can advance past raw pages containing deleted
  posts/comments so later active records remain reachable.
- Favorite post targets whose post is soft-deleted are returned as
  `missing: true`.
- `fetchDistinctPostCommentAuthors(postId)` ignores comments with `deletedAt`.
- `notifyPostCommentReply()` does not notify a user whose only comment on the
  post is soft-deleted, but still notifies a user with another active comment.

Verification:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js` | Exit 0, member dashboard soft-delete tests pass. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/content-favorite-soft-delete.test.js` | Exit 0, favorite target soft-delete tests pass. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js` | Exit 0, member dashboard soft-delete pagination tests pass. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js` | Exit 0, notification recipient tests pass. |
| `npm run lint:changed` | Exit 0, changed JS files lint clean. |
| `npm run type-check:changed` | Exit 0, changed JS files have no reported type errors. |

### T004 - Firestore Rules For Deleted Posts

Update Firestore rules so client comment operations under a soft-deleted post
are blocked while existing ownership rules remain intact for active posts.

Acceptance:

- Anonymous and signed-in users cannot read comments under a soft-deleted post.
- Signed-in users cannot create comments under a soft-deleted post.
- Comment author can soft-delete their own comment under an active post.
- Post author can soft-delete a comment under their active post.
- Non-author cannot soft-delete another user's comment under an active post.
- Post author can soft-delete their own post.
- Non-author cannot soft-delete another user's post.

Verification:

| Command | Expected signal |
| ------- | --------------- |
| `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"` | Exit 0, rules tests pass against emulator. |
| `npm run lint:changed` | Exit 0, changed JS files lint clean. |
| `npm run type-check:changed` | Exit 0, changed JS files have no reported type errors. |

### T005 - Firebase Scheduled Purge

Create the Functions purge core and scheduled wrapper. The wrapper must not
import root `src/**` modules or rely on the root `@/` alias.

Acceptance:

- Scheduled function runs daily in `Asia/Taipei`.
- Purge query finds expired posts with `deletedPurgeAt <= now`.
- Expired post purge deletes all comments, all likes, and the post document.
- Purge query finds expired standalone deleted comments with
  `deletedPurgeAt <= now`.
- Standalone comment purge skips comments whose parent post is already expired
  and scheduled for tree purge.
- Purge batches stay below Firestore's 500-write batch limit.
- Missing documents are counted as no-op skips, not failures.
- Purge logs counts for posts, comments, likes, and skips.

Verification:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js` | Exit 0, purge core tests pass. |
| `node --check functions/index.js` | Exit 0, Functions entry syntax is valid. |
| `node --check functions/post-retention-purge.js` | Exit 0, purge module syntax is valid. |
| `npm run lint:changed` | Exit 0, changed JS files lint clean. |

### T006 - Integration Gate And Workflow State

Run final focused gates, sync workflow artifacts, and record evidence without
claiming deployed rules or deployed functions.

Acceptance:

- All task-specific test commands from T001 through T005 pass from a clean
  working tree except allowed workflow-state updates.
- `npm run lint:changed` passes.
- `npm run type-check:changed` passes.
- `npm run workflow:check` passes after task/status/handoff sync.
- `status.json.rulesDeployStatus.state` remains `required` or `pending` until
  an explicit rules deploy is authorized and evidenced.
- Final summary does not imply deployed product behavior.

Verification:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0, changed JS files lint clean. |
| `npm run type-check:changed` | Exit 0, changed JS files have no reported type errors. |
| `npm run workflow:check` | Exit 0, workflow state valid and synced. |
| `git diff --check` | Exit 0, no whitespace errors. |

## Verification Strategy

- Unit tests cover helper math, filtering semantics, notification eligibility,
  and purge idempotency.
- Firestore emulator tests cover security rules because rules cannot be
  proven by unit mocks.
- `lint:changed` and `type-check:changed` are required after every task that
  touches JS.
- `workflow:check` is required after workflow state changes.
- Deployed rules/functions behavior must not be claimed unless the release
  boundary is explicitly authorized and deploy evidence is recorded.

## Workflow State

- Status schema: v3.
- Current head snapshot: captured from local branch
  `codex/post-comment-soft-delete-retention-spec` at the rebased
  implementation commit `5f311c30e12088db9361745a345bccb414d3da49`.
- Remote head snapshot: captured from `origin/main` at
  `08cc3b402c6b9d2c68d4c4986ae9c079a31592a0`.
- Last verified commit policy: update `lastVerifiedCommit` only after the final
  integration gate passes for the current commit.
- Phase commit checkpoints: `spec`, `implementation`, `verification`.
- Rules deploy status: `required`; rules and Functions deploy are separate
  release boundaries and are not authorized by planning.
- Incident handling: open incidents block closeout until resolved or explicitly
  carried forward with user approval.

## Release Boundary

- Firestore/storage rules deploy authorization:
  `authorizationBoundary.deployFirestoreRules=false`.
- Firebase Functions deploy authorization:
  not authorized in this plan; a future release step must request it explicitly.
- Rules deploy is separate from edit, commit, push, PR, CI, merge, and local
  `main` sync.
- Final summaries must not imply deployed rules, deployed functions, or deployed
  product behavior without deploy evidence.

## Risk And Stop Conditions

- Stop if implementation requires a data backfill migration for legacy posts or
  comments; the approved design avoids backfill.
- Stop if Firestore rules require adding query constraints that would hide
  legacy active documents.
- Stop if Functions code cannot be deployed from `functions/` without importing
  root `src/**` modules.
- Stop if comment delete idempotency cannot be proven without changing
  `commentsCount` semantics.
- Stop before deploy, push, PR, merge, CI watch, local main sync, or Functions
  deployment unless the user explicitly authorizes that boundary.
