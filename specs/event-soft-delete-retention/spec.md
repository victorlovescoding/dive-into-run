# Event Soft Delete Retention Spec

## Metadata

- Feature slug: `event-soft-delete-retention`
- Branch: `085-event-soft-delete-retention`
- Worktree:
  `/Users/chentzuyu/Desktop/dive-into-run-085-event-soft-delete-retention`
- Date: 2026-06-01 Asia/Taipei
- Profile: P4 new product feature

## Summary

Add soft delete behavior for events and event comments, retain deleted data for
90 days, and hard purge expired data through Firebase scheduled cleanup.

This feature intentionally follows the existing post/comment retention model:
deleted records stay in Firestore with `deletedAt`, `deletedByUid`, and
`deletedPurgeAt`, normal user-facing reads hide them, and cleanup hard-deletes
only after the retention window expires.

## User Scenarios

- An event host deletes an event. The event disappears from event lists, event
  detail, member/favorite surfaces, and notification-linked reads, while the
  event, participants, comments, and comment history remain in Firestore until
  the event purge window expires.
- A user opens a link to a soft-deleted event. The app behaves as if the event
  is missing or deleted and does not render participants or comments.
- A user who is allowed to delete an event comment deletes that comment. The
  comment disappears from the event detail comments list while the comment
  document and history remain in Firestore until the comment purge window
  expires.
- A user deletes an event comment, then another participant comments later.
  Notification recipient discovery does not treat the deleted comment as an
  active prior comment.
- The scheduled purge finds expired event and event-comment records. It hard
  deletes expired event trees and expired standalone event comments whose
  parent event is active, without relying on the Next app hosting environment.

## Requirements

- FR-001: Deleting an event MUST update only the `events/{eventId}` document
  with `deletedAt`, `deletedByUid`, and `deletedPurgeAt`.
- FR-002: Deleting an event MUST NOT update or delete `participants`,
  `comments`, or comment `history` at user-action time.
- FR-003: A soft-deleted event MUST be hidden from event list, event detail,
  member, favorite target hydration, and notification-linked read surfaces.
- FR-004: A soft-deleted event detail route MUST behave like a missing or
  deleted event and MUST NOT render participants or comments.
- FR-005: A soft-deleted event's participants, comments, and comment history
  MUST remain in Firestore until the event tree is hard purged.
- FR-006: Deleting an event MUST be allowed only for the same actor set that
  can delete events today, preserving host ownership intent.
- FR-007: Repeating delete on an already soft-deleted event MUST be idempotent
  and MUST NOT mutate child collections.
- FR-008: Deleting an event comment MUST update only that comment with
  `deletedAt`, `deletedByUid`, and `deletedPurgeAt`.
- FR-009: Deleting an event comment MUST NOT delete its `history` subcollection
  at user-action time.
- FR-010: Repeating delete on an already soft-deleted event comment MUST be
  idempotent.
- FR-011: A soft-deleted event comment MUST be hidden from event detail comment
  pages, infinite scroll, and notification recipient discovery.
- FR-012: Event comment pagination MUST backfill around soft-deleted comments
  so visible pages do not under-fill merely because raw query results contain
  deleted records.
- FR-013: New comments, participant mutations, or event child writes from client
  code MUST NOT be allowed under a soft-deleted event.
- FR-014: Soft delete retention MUST be 90 days from delete time.
- FR-015: The system MUST NOT expose a restore UI or restore API in this
  feature.
- FR-016: Firestore rules MUST reject client hard deletes for events and event
  comments.
- FR-017: Firestore rules MUST allow valid event/event-comment soft-delete
  updates only when the actor is authorized, `deletedByUid` matches the actor,
  retention timestamp fields are valid, and the update changes only the allowed
  retention fields.
- FR-018: Firestore rules MUST reject forged soft-delete updates, including
  wrong `deletedByUid`, missing retention fields, invalid timestamp types, or
  unrelated data changes.
- FR-019: A Firebase scheduled function MUST run the automatic purge job so
  cleanup is not tied to Vercel or another Next hosting platform.
- FR-020: The purge job MUST hard delete expired soft-deleted event trees,
  including the event document and its `participants`, `comments`, and comment
  `history` subcollections.
- FR-021: The purge job MUST hard delete expired soft-deleted standalone event
  comments and their `history` subcollections only when the parent event is
  still active.
- FR-022: Expired soft-deleted event comments under a soft-deleted parent event
  MUST remain retained until the parent event tree is hard purged.
- FR-023: The purge job MUST keep existing post/comment purge behavior stable.
- FR-024: The purge job MUST be idempotent. Missing documents and already
  purged children MUST be treated as successful no-ops.
- FR-025: The purge job MUST process documents in bounded batches to avoid
  Firestore batch write limits.
- FR-026: The purge job MUST log counts for purged events, event comments,
  participants, history records, and skipped/no-op records.
- FR-027: Firestore TTL MUST NOT be the primary purge mechanism for this
  feature because event cleanup requires explicit child collection handling.
- FR-028: Strava `stravaActivities`, runs, and activity-import deletion flows
  MUST remain out of scope.

## Success Criteria

- Deleting an event removes it from all user-visible event surfaces without
  immediately deleting its Firestore document or child collections.
- Deleting the same event twice does not delete child collections or throw a
  user-visible error.
- Deleting an event comment removes it from the event detail page without
  immediately deleting its Firestore document or history.
- Event comment pagination continues to return full visible pages when enough
  active comments exist after deleted raw records are skipped.
- Event notification recipient lookup ignores soft-deleted event comments.
- Firestore rules block client hard deletes for events and event comments.
- Firestore rules allow only valid authorized soft-delete updates for events
  and event comments.
- The scheduled purge can hard delete an expired event tree and an expired
  standalone event comment with history when the parent event is active.
- The scheduled purge leaves expired deleted comments under a soft-deleted
  parent event for the later parent event tree purge.
- The purge can safely run multiple times with the same expired records.
- Existing post/comment soft-delete retention behavior remains unchanged.

## Out Of Scope

- Restore/recycle-bin UI.
- Restore API.
- Admin moderation dashboard for retained deleted content.
- Changing post/comment retention behavior except for narrowly shared helpers
  that preserve existing post semantics.
- Strava `stravaActivities`, runs, imported activity records, webhook deletion,
  or disconnect cleanup.
- Firestore TTL policy setup as the primary cleanup path.
- Public deleted-content audit views.
- Deploying Firestore rules or Firebase Functions during spec creation.

## Design Decisions

- Event delete is O(1) at user action time: only the event document is marked
  deleted. The later purge job owns hard deleting the event tree.
- Event comment delete marks the individual comment deleted because comments
  can be deleted independently while the parent event remains active.
- Child records under a soft-deleted event are retained because retention is
  about preserving the data tree, not showing partial deleted content in the UI.
- The 90-day retention window is retention only, not a restore promise.
- Event/comment retention fields match the existing article implementation:
  `deletedAt`, `deletedByUid`, and `deletedPurgeAt`.
- Shared code should stay small: extract reusable soft-delete payload and active
  record predicates only where it reduces duplication without turning post and
  event purge into an over-general framework.
- Post and event purge logic may share low-level helpers, but each content type
  should keep clear tree-specific purge code.
- Firebase scheduled functions are the cleanup mechanism because the existing
  post retention feature already uses that boundary and event tree cleanup
  requires explicit child collection handling.
- The implementation must not add Firestore indexes preemptively. Add or update
  `firestore.indexes.json` only if the implemented purge query requires an
  index. The existing collection-group `comments.deletedPurgeAt` index is
  expected to cover event comments unless verification proves otherwise.

## Current Evidence

- Existing post/comment soft-delete fields and retention helper:
  `src/repo/post-soft-delete.js:1`.
- Post comment soft-delete transaction:
  `src/repo/client/firebase-posts-repo.js:287`.
- Post soft-delete transaction:
  `src/repo/client/firebase-posts-repo.js:351`.
- Post active-record filtering:
  `src/service/post-service.js:52` and
  `src/runtime/client/use-cases/post-use-cases.js:47`.
- Existing post retention scheduled function:
  `functions/index.js:469` and `functions/post-retention-purge.js:241`.
- Existing collection-group comment purge index:
  `firestore.indexes.json:89`.
- Current event delete hard-deletes participants, comments, comment history, and
  event document:
  `src/repo/client/firebase-events-repo.js:263`.
- Current event comment delete hard-deletes comment history and the comment
  document:
  `src/repo/client/firebase-event-comments-repo.js:99`.
- Event/event-comment visibility currently checks account-deletion hidden state
  but not `deletedAt`:
  `src/service/event-service.js:219` and
  `src/service/event-comment-service.js:147`.
- Event comments pagination currently filters only the current raw page:
  `src/runtime/client/use-cases/event-comment-use-cases.js:32`.
- Firestore rules currently allow client hard deletes for events and event
  comments:
  `firestore.rules:299` and `firestore.rules:362`.
- Event notification recipient lookup currently does not exclude soft-deleted
  event comments:
  `src/repo/client/firebase-notifications-repo.js:99`.
- Favorites currently hide soft-deleted posts but not events:
  `src/service/content-favorite-service.js:159`.

## Architecture Constraints

- Preserve the forward-only dependency direction:
  Types -> Config -> Repo -> Service -> Runtime -> UI.
- Keep Firebase access inside canonical `src/repo/` and `src/service/`
  boundaries.
- Keep App Router files thin; event page state and use cases stay outside
  `src/app/`.
- Firebase Functions purge code must live inside the deploy-included Functions
  boundary, or in an explicitly shared module that the `functions/` package can
  import without relying on the root Next app `@/` alias.
- Firestore rules and purge behavior are release boundaries. Product summaries
  must not imply deployed rules, deployed functions, or deployed product
  behavior without deployment evidence.

## Error Handling

- Event detail reads for soft-deleted events return the same user-facing state
  as missing/deleted events.
- Event comment delete requests for already soft-deleted comments are no-ops.
- Event delete requests for already soft-deleted events are no-ops.
- Notification-linked reads involving deleted event comments do not throw; they
  load the active parent event when available and skip deleted comments.
- Purge failures are logged and retried on the next scheduled run.
- Partial purge progress is acceptable when later scheduled runs can complete
  the remaining expired records.

## Verification Requirements

- Unit/service verification for 90-day `deletedPurgeAt` calculation and active
  record predicates.
- Repository/use-case verification that event delete soft-deletes only the event
  document and leaves children retained until purge.
- Repository/use-case verification that event comment delete soft-deletes only
  the comment document and leaves history retained until purge.
- Query/filter verification for event list, event detail, member/favorite
  surfaces, and event comment pages.
- Pagination verification that event comments backfill after deleted raw
  records are skipped.
- Notification verification that event comment recipient discovery excludes
  deleted comments.
- Firestore rules verification that event and event-comment hard deletes are
  rejected from client code.
- Firestore rules verification that valid authorized soft-delete updates are
  allowed and forged updates are rejected.
- Purge core verification for expired event tree hard delete, expired standalone
  event comment hard delete under an active parent event, skipped standalone
  comments under a soft-deleted parent event, batching, idempotency, and
  non-expired skips.
- Scheduled function wrapper verification that it delegates to purge core.
- Regression verification that existing post/comment retention tests still pass
  or are updated only to reflect shared helper names with unchanged behavior.
- Firebase Functions syntax/import verification for deploy-included purge
  modules.
- Fresh repo gates before completion: `npm run lint:changed`,
  `npm run type-check:changed`, and focused Firestore/function/unit tests
  selected in the implementation plan.

## User Authorization

- Brainstorming/design approved by: user, 2026-06-01 Asia/Taipei.
- Repo doc persistence: long-term workflow spec approved by user,
  2026-06-01 Asia/Taipei.
- One-time automated execution authorization: yes, for spec artifact creation
  and commit.
- Authorization boundary:
  - edit: yes, for `specs/event-soft-delete-retention/spec.md`.
  - commit: yes, for the spec artifact commit when the staged diff contains
    only this spec.
  - push: no.
  - pullRequest: no.
  - ciWatch: no.
  - merge: no.
  - localMainSync: no.
  - deployFirestoreRules: no.
  - deployFirebaseFunctions: no.

## Release Notes

- Firestore rules deploy required: yes.
- Firebase Functions deploy required: yes.
- Final summaries must not imply deployed rules, deployed functions, or
  deployed product behavior unless deployment evidence is recorded.
