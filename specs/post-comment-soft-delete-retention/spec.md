# Post And Comment Soft Delete Retention Spec

## Summary

Add soft delete behavior for posts and post comments, retain deleted data for
90 days, and hard purge expired data through a Firebase scheduled function.

This feature also clarifies article follow-up notification eligibility: a user
who deletes their last active comment on a post no longer receives future
`post_comment_reply` notifications for that post.

## User Scenarios

- A post author deletes their post. The post disappears from the article list,
  search results, author profile surfaces, and detail page, while the post,
  comments, and likes remain in Firestore until the post purge window expires.
- A comment author deletes a comment. The comment disappears from the post
  detail page, the post `commentsCount` decreases once, and the comment remains
  in Firestore until its own purge window expires.
- User A comments on Post X, then deletes their only active comment on Post X.
  When User B later adds a comment to Post X, User A does not receive a
  `post_comment_reply` notification.
- User A comments twice on Post X, then deletes one comment. When User B later
  adds a comment to Post X, User A still receives a `post_comment_reply`
  notification because one active comment remains.
- A notification points to a comment that is later deleted. Opening the
  notification still loads the post when the post is active, but no deleted
  comment is shown or highlighted.
- The daily purge job finds expired soft-deleted posts and comments. It hard
  deletes expired post trees and expired standalone deleted comments without
  requiring the Next app to be deployed on a specific hosting platform.

## Requirements

- FR-001: Deleting a post MUST update only the `posts/{postId}` document with
  `deletedAt`, `deletedByUid`, and `deletedPurgeAt`.
- FR-002: Deleting a post MUST NOT update every child comment or like at delete
  time.
- FR-003: A soft-deleted post MUST be hidden from post list, search, author
  profile, favorite target hydration, and post detail reads.
- FR-004: A soft-deleted post detail route MUST behave like a missing post and
  use the existing deleted/missing post user-facing state.
- FR-005: A soft-deleted post's comments and likes MUST remain in Firestore
  until the post tree is hard purged.
- FR-006: Firestore rules MUST prevent reading, creating, updating, or deleting
  comments under a soft-deleted post from client code.
- FR-007: Deleting a post MUST be allowed only for the post author.
- FR-008: Deleting a comment MUST update only that comment with `deletedAt`,
  `deletedByUid`, and `deletedPurgeAt`.
- FR-009: Deleting a comment MUST decrement the parent post `commentsCount`
  exactly once and never below zero.
- FR-010: Repeating delete on an already soft-deleted comment MUST be idempotent
  and MUST NOT decrement `commentsCount` again.
- FR-011: A soft-deleted comment MUST be hidden from post detail comment pages,
  infinite scroll, member comment surfaces, and notification highlight targets.
- FR-012: Deleting a comment MUST be allowed for the comment author and the post
  author, matching the existing ownership intent.
- FR-013: New comments MUST NOT be created under a soft-deleted post.
- FR-014: `notifyPostCommentReply()` MUST compute recipients from active
  comments only; comments with `deletedAt` set MUST NOT count as follow-up
  notification eligibility.
- FR-015: A user with no active comments left on a post MUST NOT receive future
  `post_comment_reply` notifications for that post.
- FR-016: A user with at least one active comment left on a post MUST remain
  eligible for future `post_comment_reply` notifications, excluding the actor
  and post author as before.
- FR-017: Soft delete retention MUST be 90 days from delete time.
- FR-018: The system MUST NOT expose a restore UI or restore API in this
  feature.
- FR-019: A Firebase scheduled function MUST run the automatic purge job so
  cleanup is not tied to Vercel or another undecided Next hosting platform.
- FR-020: The purge job MUST hard delete expired soft-deleted post trees,
  including the post document and its `comments` and `likes` subcollections.
- FR-021: The purge job MUST hard delete expired soft-deleted standalone
  comments whose parent post is still active or not yet expired.
- FR-022: The purge job MUST be idempotent. Missing documents and already
  purged children MUST be treated as successful no-ops.
- FR-023: The purge job MUST process documents in bounded batches to avoid
  Firestore batch write limits.
- FR-024: The purge job MUST log counts for purged posts, comments, likes, and
  skipped/no-op records.
- FR-025: Firestore TTL MUST NOT be the primary purge mechanism for this
  feature because post cleanup requires explicit child collection handling.

## Success Criteria

- Deleting a post removes it from all user-visible post surfaces without
  immediately deleting its Firestore document, comments, or likes.
- Deleting a comment removes it from the post detail page and decrements
  `commentsCount` once.
- Deleting the same comment twice does not double-decrement `commentsCount`.
- Users who deleted their last active comment on a post no longer receive
  follow-up comment notifications for that post.
- Users with remaining active comments still receive follow-up comment
  notifications.
- Security rules block client reads and writes for comments under soft-deleted
  posts.
- The scheduled purge can hard delete an expired post tree and an expired
  standalone deleted comment.
- The purge can safely run multiple times with the same expired records.
- Existing post not-found/deleted UX remains stable.

## Out Of Scope

- Restore/recycle-bin UI.
- Restore API.
- Admin moderation dashboard for retained deleted content.
- Changing event delete or event comment delete behavior.
- Notification retention changes.
- Firestore TTL policy setup as the primary cleanup path.
- Public deleted-content audit views.
- Deployment to Vercel, Firebase Hosting, or another hosting provider.

## Design Decisions

- Article follow-up notification eligibility is based on active comments only.
  Soft-deleted comments do not count.
- Post delete is O(1) at user action time: only the post document is marked
  deleted. The later purge job owns hard deleting the tree.
- Comment delete marks the individual comment deleted immediately because
  comments can be deleted independently while the parent post remains active.
- The 90-day retention window is retention only, not a restore promise.
- Firebase scheduled functions are the automatic cleanup mechanism because the
  production hosting target for the Next app is not decided, while Firestore is
  already the fixed data boundary.
- The purge implementation must live inside the Firebase Functions deploy
  boundary, or in an explicitly shared module that the `functions/` package
  includes during deploy. It must not assume the root Next app `@/` alias is
  available in the Functions runtime.

## Error Handling

- Post detail reads for soft-deleted posts return the same user-facing state as
  missing posts.
- Notification links to deleted comments do not throw; they load the active
  parent post and skip scroll/highlight when the comment is not rendered.
- Delete requests for already soft-deleted comments are no-ops and do not
  mutate counters.
- Purge failures are logged and retried on the next scheduled run.
- Partial purge progress is acceptable when later scheduled runs can complete
  the remaining expired records.

## Verification Requirements

- Unit/service verification for 90-day `deletedPurgeAt` calculation.
- Repository/use-case verification that comment delete soft deletes and
  decrements `commentsCount` once.
- Notification verification that `notifyPostCommentReply()` excludes deleted
  comments from recipient discovery.
- Query/filter verification for post list, search, detail, and comment pages.
- Firestore rules verification for deleted post comment read/create/update/delete
  behavior and ownership boundaries.
- Purge core verification for expired post tree hard delete, expired standalone
  comment hard delete, batching, and idempotency.
- Scheduled function wrapper verification that it delegates to purge core.
- Firebase Functions syntax/import verification for the deploy-included purge
  module.
- Fresh repo gates before completion: `npm run lint:changed` and
  `npm run type-check:changed`.

## User Authorization

- Brainstorming/design approved by: user, 2026-05-28.
- Repo doc persistence: long-term repo doc approved by user, 2026-05-28.
- One-time automated execution authorization: no.
- Authorization boundary:
  - edit: spec document only.
  - commit: no.
  - push: no.
  - pullRequest: no.
  - ciWatch: no.
  - merge: no.
  - localMainSync: no.
  - deployFirestoreRules: no.

## Release Notes

- Firestore rules deploy required: yes.
- Firebase Functions deploy required: yes.
- Final summaries must not imply deployed rules, deployed functions, or
  deployed product behavior unless deployment evidence is recorded.
