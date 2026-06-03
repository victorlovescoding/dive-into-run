# Event Soft Delete Retention Plan

> **For agentic workers:** Implement task-by-task through Engineer and Reviewer
> subagents. Main remains coordinator/state owner.

## Summary

Add event and event-comment soft delete with the same retention fields used by
posts: `deletedAt`, `deletedByUid`, and `deletedPurgeAt`. User-action deletes
mark only the target event or event comment; Firebase scheduled purge later
hard-deletes expired event trees or standalone event comments.

## Architecture

- Event delete is O(1): update `events/{eventId}` only and leave
  participants, comments, and comment history retained until event tree purge.
- Event comment delete updates only
  `events/{eventId}/comments/{commentId}` and leaves comment history retained
  until standalone comment purge or parent event tree purge.
- Reads treat records with `deletedAt` as inactive. Legacy records without
  `deletedAt` remain active.
- Event comment pagination backfills after filtering soft-deleted raw records
  so visible pages do not under-fill while active records remain available.
- Firestore rules reject client hard deletes and allow only authorized
  soft-delete field updates. Actual rules deploy is a later release boundary.
- Firebase Functions owns hard purge. Actual Functions deploy is a later
  release boundary.
- Firestore indexes are not added preemptively. `firestore.indexes.json` is
  modified only if implementation verification proves a required index.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/repo/soft-delete-retention.js` | Create | Shared 90-day retention constants, payload builders, and active/deleted predicates. |
| `src/repo/post-soft-delete.js` | Modify | Preserve existing post exports while delegating to shared helpers if needed. |
| `src/service/event-service.js` | Modify | Event typedef retention fields and active event filtering helpers. |
| `src/service/event-comment-service.js` | Modify | Event comment typedef retention fields and active comment filtering helpers. |
| `src/repo/client/firebase-events-repo.js` | Modify | Soft-delete event document only; stop hard-deleting event children at user action time. |
| `src/runtime/client/use-cases/event-use-cases.js` | Modify | Hide soft-deleted events from list/detail reads and keep delete idempotent. |
| `src/runtime/hooks/useEventsPageRuntime.js` | Modify | Keep event list runtime aligned with filtered use-case results. |
| `src/runtime/hooks/useEventDetailRuntime.js` | Modify | Treat soft-deleted event detail as missing and avoid loading participants/comments. |
| `src/runtime/hooks/useEventDetailMutations.js` | Modify | Keep existing delete UI contract while calling soft-delete use case. |
| `src/repo/client/firebase-event-comments-repo.js` | Modify | Soft-delete event comment document only; retain history. |
| `src/runtime/client/use-cases/event-comment-use-cases.js` | Modify | Hide deleted comments and backfill event comment pagination. |
| `src/repo/client/firebase-member-repo.js` | Modify | Exclude soft-deleted events from member event surfaces. |
| `src/repo/client/firebase-content-favorites-repo.js` | Modify | Keep event favorite hydration compatible with deleted target filtering. |
| `src/repo/client/firebase-notifications-repo.js` | Modify | Ignore soft-deleted event comments in notification recipient discovery. |
| `src/runtime/client/use-cases/member-dashboard-use-cases.js` | Modify | Keep member event pagination filled after deleted events are skipped. |
| `src/runtime/client/use-cases/content-favorite-use-cases.js` | Modify | Treat deleted event favorite targets as missing. |
| `src/runtime/client/use-cases/notification-use-cases.js` | Modify | Skip notification-linked deleted event/comment records. |
| `src/service/member-dashboard-service.js` | Modify | Filter deleted events from member surfaces. |
| `src/service/content-favorite-service.js` | Modify | Hide deleted event favorite targets. |
| `src/service/notification-service.js` | Modify | Keep notification target shaping from exposing deleted event content. |
| `firestore.rules` | Modify | Reject client hard deletes and forged event/event-comment soft-delete updates. |
| `tests/server/firestore/event-soft-delete-rules.test.js` | Create | Emulator coverage for rules authorization and forged update rejection. |
| `functions/index.js` | Modify | Register event retention scheduled function. |
| `functions/event-retention-purge.js` | Create | Deploy-contained purge core for expired event trees and event comments. |
| `firestore.indexes.json` | Modify only if proven | Add required event purge index only after verification proves it is needed. |
| `specs/event-soft-delete-retention/tests/unit/service/event-soft-delete-helpers.test.js` | Create | Helper math and active predicate tests. |
| `specs/event-soft-delete-retention/tests/unit/service/event-service-soft-delete.test.js` | Create | Event read filtering tests. |
| `specs/event-soft-delete-retention/tests/unit/runtime/event-soft-delete-use-cases.test.js` | Create | Event delete and detail/list use-case tests. |
| `specs/event-soft-delete-retention/tests/unit/service/event-comment-service-soft-delete.test.js` | Create | Event comment active filtering tests. |
| `specs/event-soft-delete-retention/tests/unit/runtime/event-comment-soft-delete-use-cases.test.js` | Create | Event comment soft-delete and pagination backfill tests. |
| `specs/event-soft-delete-retention/tests/unit/service/event-secondary-surfaces-soft-delete.test.js` | Create | Member and favorite deleted-event filtering tests. |
| `specs/event-soft-delete-retention/tests/unit/runtime/event-notification-soft-delete.test.js` | Create | Notification recipient and notification-linked read tests. |
| `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge.test.js` | Create | Purge batching, idempotency, tree delete, and standalone comment tests. |
| `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge-schedule.test.js` | Create | Scheduled wrapper registration and purge-core delegation tests. |
| `specs/event-soft-delete-retention/tasks.md` | Modify | Human-readable task state and evidence. |
| `specs/event-soft-delete-retention/handoff.md` | Modify | Resume brief and release boundary notes. |
| `specs/event-soft-delete-retention/status.json` | Modify | Schema v3 machine-readable state. |

## Data Contract

Soft-deleted event and event-comment records use:

- `deletedAt`: Firestore server timestamp at delete time.
- `deletedByUid`: deleting actor uid.
- `deletedPurgeAt`: Firestore timestamp exactly 90 days after delete time.

Active predicate:

- active when the record exists and does not have own property `deletedAt`.
- deleted when the record has own property `deletedAt`, including server
  timestamp sentinel values.

## Dependency Graph

- T001 -> T002
- T001 -> T003
- T001 -> T004
- T002 -> T005
- T003 -> T005
- T004 -> T005
- T005 -> T006

## Execution Model

- Default execution is sequential in the shared worktree.
- T002, T003, and T004 may run in parallel only if the coordinator creates
  separate worktrees and confirms owned files stay disjoint.
- Shared helpers, Firestore rules, Functions entrypoints, indexes, lockfiles,
  and workflow-state updates serialize.
- Each implementation task requires Engineer work, Reviewer PASS, and
  coordinator state sync before the next dependent task is dispatched.

## Task Slices

- T001: Shared Soft-Delete Helpers And Event Typedefs
- T002: Event Delete Writes And Event Read Filtering
- T003: Event Comment Delete Writes And Pagination Filtering
- T004: Secondary Surfaces And Notifications
- T005: Firestore Rules For Event Retention
- T006: Firebase Event Retention Purge And Integration Gates

## Verification Strategy

- Focused browser-project Vitest files cover helpers, event reads, event comment
  pagination, secondary surfaces, notifications, and purge core.
- Firestore emulator tests cover security rules because client mocks cannot
  prove rule behavior.
- Functions syntax is checked with `node --check functions/index.js` and
  `node --check functions/event-retention-purge.js`.
- `npm run lint:changed` and `npm run type-check:changed` run after each JS
  implementation task.
- Final integration runs `npm run workflow:check` and `git diff --check`.
- Release summaries must say rules and Functions deploy remain pending unless
  separate deploy evidence is recorded.

## Workflow State

- Status schema: v3.
- Current head snapshot: branch `085-event-soft-delete-retention`, commit
  `13347d19506c1c4e721ab3322ed40f92a4a1c92a`, captured
  `2026-06-02T00:44:58+08:00` after rebase onto current `origin/main`.
- Remote head snapshot: `origin/main`, commit
  `19434854fd36911879a36406efda80d1b5056dc1`, captured
  `2026-06-02T00:44:58+08:00`.
- Phase commit checkpoints: `spec`, then later `plan`,
  `implementation`, and `verification` if those commits are actually created.
- `lastVerifiedCommit` remains `null` until fresh verification covers a commit.
- `rulesDeployStatus.state` starts `required`; `changed` remains `false` until
  rules are edited.
- Open incidents block dispatch or closeout until resolved or explicitly
  carried forward.

## Release Boundary

- `authorizationBoundary.edit=true`.
- `authorizationBoundary.commit=true`.
- `authorizationBoundary.push=false`.
- `authorizationBoundary.pullRequest=false`.
- `authorizationBoundary.ciWatch=false`.
- `authorizationBoundary.merge=false`.
- `authorizationBoundary.localMainSync=false`.
- `authorizationBoundary.deployFirestoreRules=false`.
- Firebase Functions deploy is also not authorized in this phase.
- Do not deploy Firestore rules, deploy Functions, push, open a PR, watch CI,
  merge, or sync local `main` without later explicit authorization.

## Risk And Stop Conditions

- Stop if implementation requires Strava, runs, imported activities, activity
  webhooks, or disconnect cleanup changes.
- Stop if event delete cannot remain an event-document-only update.
- Stop if event comment delete requires deleting history at user action time.
- Stop if standalone deleted event comments under a soft-deleted parent would
  be purged before the parent event tree purge.
- Stop if implementation introduces restore UI or restore API behavior.
- Stop before adding a Firestore index unless verification shows the exact
  missing index requirement.
- Stop if a deployed rules, deployed Functions, or deployed product-behavior
  claim would be needed before deploy authorization and evidence exist.
