# Event Soft Delete Retention Tasks

## Compact Guard

- This file is the human-readable task source of truth for
  `specs/event-soft-delete-retention/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`,
  this file, and `status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer
  subagents, including docs, code, rules, Functions, tests, and config.
- A task can become `completed` only after `review_passed` and coordinator
  state sync.
- Command evidence is one command per entry. Do not combine commands with
  shell chain operators.
- Final summaries must not imply deployed Firestore rules, deployed Firebase
  Functions, or deployed product behavior unless deploy evidence is recorded.

## Team And Parallelism

- Default: one Engineer and one Reviewer pair at a time in the shared worktree.
- T002, T003, and T004 may run in parallel only if the coordinator creates
  separate worktrees and confirms owned files remain disjoint.
- Shared helpers, `firestore.rules`, Functions entrypoints, indexes, package
  metadata, and workflow-state writes must serialize.

## Planner Output

- Dependency graph:
  - T001 -> T002
  - T001 -> T003
  - T001 -> T004
  - T002 -> T005
  - T003 -> T005
  - T004 -> T005
  - T005 -> T006
- Parallel waves:
  - `wave-1`: T001
  - `wave-2`: T002, T003, T004 only in separate worktrees; otherwise sequential.
  - `wave-3`: T005
  - `wave-4`: T006
- Final integration gate:
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `npm run workflow:check`: exit 0.
  - `git diff --check`: exit 0.

## Tasks

### T001 - Shared Soft-Delete Helpers And Event Typedefs

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: plan or implementation phase commit after Reviewer PASS and coordinator approval.
- **Last verified commit**: `d8c2578f027f4d9fe11f6b21c31e5c16d61757f6`
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: none

Scope:

- Create shared soft-delete retention helpers for 90-day retention.
- Preserve post helper behavior and exports.
- Add event and event-comment retention typedef fields.

Non-scope:

- Do not change event delete behavior, comment delete behavior, rules, purge,
  notifications, favorites, member surfaces, or UI rendering.
- Do not introduce restore UI or restore API behavior.
- Do not rename existing post helper imports unless this task also owns every
  affected post-service import update.

Owned files:

- `src/repo/soft-delete-retention.js`
- `src/repo/post-soft-delete.js`
- `src/service/event-service.js`
- `src/service/event-comment-service.js`
- `specs/event-soft-delete-retention/tests/unit/service/event-soft-delete-helpers.test.js`

Read-only context:

- `specs/event-soft-delete-retention/spec.md`
- `src/repo/post-soft-delete.js`
- `src/service/post-service.js`
- `specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js`

Dependencies:

- none

Browser evidence:

- Not applicable.

Engineer instructions:

- Add a shared retention constant set to 90 days.
- Add a helper that builds `deletedAt`, `deletedByUid`, and `deletedPurgeAt`.
- Add active/deleted predicates based on own property `deletedAt`.
- Keep legacy active records without `deletedAt` active.
- Keep existing post soft-delete imports working through `src/repo/post-soft-delete.js`.
- Extend event and event-comment JSDoc typedefs with optional retention fields.
- Add focused helper tests for 90-day math, legacy active records, and
  timestamp-sentinel deleted records.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: Shared helper calculates `deletedPurgeAt` exactly 90 days after
  delete time.
- AC-T001.2: Existing post helper exports remain compatible.
- AC-T001.3: Event and event-comment typedefs include optional
  `deletedAt`, `deletedByUid`, and `deletedPurgeAt`.
- AC-T001.4: Active predicate treats records without `deletedAt` as active and
  records with `deletedAt` as deleted.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-soft-delete-helpers.test.js` | Exit 0, helper tests pass. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js` | Exit 0, existing post helper regression tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Existing post helper exports remain available.
- Helper names, retention fields, and 90-day math match the spec.
- No product behavior changes are introduced outside helper and typedef scope.

Reviewer REJECT criteria:

- Diff touches non-owned files without coordinator approval.
- Post helper compatibility breaks.
- Tests or type checks are missing, stale, or failing.
- Helper semantics drift from the approved field names or 90-day retention.

Evidence:

- Engineer report: DONE. Added shared retention helpers, preserved post helper
  exports, added event/event-comment retention typedef fields, and added
  helper tests.
- Reviewer report: spec compliance review `review_passed`; code-quality review
  `review_passed`; no blocking findings.
- Command output summary:
  - `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-soft-delete-helpers.test.js`: RED exit 1 before helper existed, failed to resolve `@/repo/soft-delete-retention`.
  - `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-soft-delete-helpers.test.js`: GREEN exit 0, 5 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js`: exit 0, 4 tests passed.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0, no changed-file type errors.
- Changed files summary:
  - `src/repo/soft-delete-retention.js`: created shared soft-delete retention helpers.
  - `src/repo/post-soft-delete.js`: preserved post helper exports through shared helper re-exports.
  - `src/service/event-service.js`: added optional event retention typedef fields.
  - `src/service/event-comment-service.js`: added optional event comment retention typedef fields.
  - `specs/event-soft-delete-retention/tests/unit/service/event-soft-delete-helpers.test.js`: added helper and post compatibility coverage.

### T002 - Event Delete Writes And Event Read Filtering

- **State**: `in_progress`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: none

Scope:

- Convert event delete from hard delete to event-document soft delete.
- Hide soft-deleted events from event list and event detail reads.
- Make event detail behave as missing and skip participant/comment loading
  when the event is soft-deleted.

Non-scope:

- Do not change event comment delete behavior.
- Do not change member, favorites, notification, rules, purge, or indexes.
- Do not mutate event child collections during user-action event delete.
- Do not introduce restore UI or restore API behavior.

Owned files:

- `src/repo/client/firebase-events-repo.js`
- `src/runtime/client/use-cases/event-use-cases.js`
- `src/runtime/hooks/useEventsPageRuntime.js`
- `src/runtime/hooks/useEventDetailRuntime.js`
- `src/runtime/hooks/useEventDetailMutations.js`
- `src/service/event-service.js`
- `specs/event-soft-delete-retention/tests/unit/service/event-service-soft-delete.test.js`
- `specs/event-soft-delete-retention/tests/unit/runtime/event-soft-delete-use-cases.test.js`

Read-only context:

- `specs/event-soft-delete-retention/spec.md`
- `src/repo/soft-delete-retention.js`
- `src/runtime/events/event-detail-participation-runtime-helpers.js`
- `src/ui/events/EventDetailScreen.jsx`
- `src/ui/events/EventsListSection.jsx`

Dependencies:

- T001

Browser evidence:

- Not required unless JSX or visible UI state is changed. If JSX changes, verify
  `/events` and an event detail route at desktop 1280x800 and mobile 390x844.

Engineer instructions:

- Replace event hard delete with an update to `events/{eventId}` only.
- Write `deletedAt`, `deletedByUid`, and `deletedPurgeAt` with the shared helper.
- Preserve the existing actor authorization path for event delete.
- Return success for repeated delete of an already soft-deleted event.
- Filter soft-deleted events out of event list results.
- Return the same missing/deleted detail state for a soft-deleted event.
- Prevent participant and comment loading after a soft-deleted event detail read.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: Event delete updates only `events/{eventId}`.
- AC-T002.2: Participants, comments, and comment history are untouched at
  event delete time.
- AC-T002.3: Repeated event delete is idempotent.
- AC-T002.4: Event list and event detail hide soft-deleted events.
- AC-T002.5: Soft-deleted event detail does not render or load participants or
  comments.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-service-soft-delete.test.js` | Exit 0, event filtering tests pass. |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/runtime/event-soft-delete-use-cases.test.js` | Exit 0, event delete and read tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Event delete has no child collection writes.
- Existing host/authorized actor semantics are preserved.
- Detail route cannot load participant or comment data after a deleted event
  result.

Reviewer REJECT criteria:

- Event delete hard-deletes or mutates child collections.
- Repeated delete can throw a user-visible error for an already deleted event.
- Event list/detail filtering is missing or untested.
- Verification is missing, stale, failed, or not the required command.

Evidence:

- Engineer report: none yet.
- Reviewer report: none yet.
- Command output summary: none yet.
- Changed files summary: none yet.

### T003 - Event Comment Delete Writes And Pagination Filtering

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: none

Scope:

- Convert event comment delete from hard delete to comment-document soft delete.
- Hide deleted event comments from event detail comment pages.
- Backfill event comment pagination around deleted raw records.

Non-scope:

- Do not change event delete behavior.
- Do not change notification recipient discovery, member/favorite surfaces,
  rules, purge, or indexes.
- Do not delete or mutate event comment history at user-action delete time.
- Do not introduce restore UI or restore API behavior.

Owned files:

- `src/repo/client/firebase-event-comments-repo.js`
- `src/runtime/client/use-cases/event-comment-use-cases.js`
- `src/service/event-comment-service.js`
- `specs/event-soft-delete-retention/tests/unit/service/event-comment-service-soft-delete.test.js`
- `specs/event-soft-delete-retention/tests/unit/runtime/event-comment-soft-delete-use-cases.test.js`

Read-only context:

- `specs/event-soft-delete-retention/spec.md`
- `src/repo/soft-delete-retention.js`
- `src/runtime/hooks/useEventDetailRuntime.js`
- `src/ui/events/EventDetailScreen.jsx`

Dependencies:

- T001

Browser evidence:

- Not required unless JSX or visible UI state is changed. If JSX changes, verify
  event detail comments at desktop 1280x800 and mobile 390x844.

Engineer instructions:

- Replace event comment hard delete with an update to
  `events/{eventId}/comments/{commentId}` only.
- Write `deletedAt`, `deletedByUid`, and `deletedPurgeAt` with the shared helper.
- Preserve the existing actor authorization path for event comment delete.
- Return success for repeated delete of an already soft-deleted comment.
- Leave the comment `history` subcollection untouched.
- Filter deleted comments from latest and more-comments results.
- Backfill pagination by fetching additional raw pages until the visible page
  fills, the raw cursor ends, or the existing page limit contract is satisfied.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: Event comment delete updates only the comment document.
- AC-T003.2: Event comment history is retained at delete time.
- AC-T003.3: Repeated comment delete is idempotent.
- AC-T003.4: Deleted comments are hidden from event detail comments.
- AC-T003.5: Pagination returns full visible pages when enough active comments
  exist after deleted raw records are skipped.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-comment-service-soft-delete.test.js` | Exit 0, event comment filtering tests pass. |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/runtime/event-comment-soft-delete-use-cases.test.js` | Exit 0, event comment delete and pagination tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Event comment delete has no history writes or deletes.
- Pagination test proves backfill past deleted raw records.
- Repeated delete cannot create duplicate retention mutation side effects.

Reviewer REJECT criteria:

- Event comment delete hard-deletes a comment or history record.
- Pagination only filters the current raw page and can under-fill despite later
  active comments.
- Authorization semantics drift from existing event comment delete behavior.
- Verification is missing, stale, failed, or not the required command.

Evidence:

- Engineer report: none yet.
- Reviewer report: none yet.
- Command output summary: none yet.
- Changed files summary: none yet.

### T004 - Secondary Surfaces And Notifications

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: none

Scope:

- Hide soft-deleted events from member event surfaces and favorite target
  hydration.
- Hide soft-deleted event/comment targets from notification-linked reads.
- Exclude deleted event comments from event comment notification recipient
  discovery.

Non-scope:

- Do not change event delete writes, event comment delete writes, rules, purge,
  or indexes.
- Do not change post/comment retention behavior.
- Do not introduce restore UI or restore API behavior.

Owned files:

- `src/repo/client/firebase-member-repo.js`
- `src/repo/client/firebase-content-favorites-repo.js`
- `src/repo/client/firebase-notifications-repo.js`
- `src/runtime/client/use-cases/member-dashboard-use-cases.js`
- `src/runtime/client/use-cases/content-favorite-use-cases.js`
- `src/runtime/client/use-cases/notification-use-cases.js`
- `src/service/member-dashboard-service.js`
- `src/service/content-favorite-service.js`
- `src/service/notification-service.js`
- `specs/event-soft-delete-retention/tests/unit/service/event-secondary-surfaces-soft-delete.test.js`
- `specs/event-soft-delete-retention/tests/unit/runtime/event-notification-soft-delete.test.js`

Read-only context:

- `specs/event-soft-delete-retention/spec.md`
- `src/service/event-service.js`
- `src/service/event-comment-service.js`
- `src/lib/notification-helpers.js`
- `specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js`

Dependencies:

- T001

Browser evidence:

- Not required unless JSX or visible UI state is changed. If JSX changes, verify
  member and favorites pages at desktop 1280x800 and mobile 390x844.

Engineer instructions:

- Filter deleted events from member event surfaces.
- Backfill member pagination if deleted raw event records would otherwise hide
  later active events.
- Treat favorite rows whose event target is soft-deleted as missing.
- Skip notification-linked event reads when the event is soft-deleted.
- Skip notification-linked event comment reads when the comment is soft-deleted.
- Ignore soft-deleted event comments while discovering prior commenters for
  event comment notifications.
- Modify only the owned files above.

Acceptance criteria:

- AC-T004.1: Member surfaces do not show soft-deleted events.
- AC-T004.2: Event favorite target hydration treats deleted events as missing.
- AC-T004.3: Notification-linked reads do not expose deleted events or deleted
  event comments.
- AC-T004.4: Notification recipient discovery ignores deleted event comments.
- AC-T004.5: Existing post/comment notification retention behavior remains
  unchanged.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/service/event-secondary-surfaces-soft-delete.test.js` | Exit 0, member and favorite filtering tests pass. |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/runtime/event-notification-soft-delete.test.js` | Exit 0, notification soft-delete tests pass. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js` | Exit 0, post notification regression tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Event secondary surface filtering is covered by tests.
- Notification tests cover deleted-only and mixed active/deleted event
  commenters.
- Post notification behavior remains covered by regression verification.

Reviewer REJECT criteria:

- Deleted event targets remain visible through member, favorites, or
  notification-linked reads.
- Notification recipient discovery counts deleted event comments.
- Post/comment notification behavior changes without explicit spec approval.
- Verification is missing, stale, failed, or not the required command.

Evidence:

- Engineer report: none yet.
- Reviewer report: none yet.
- Command output summary: none yet.
- Changed files summary: none yet.

### T005 - Firestore Rules For Event Retention

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: none

Scope:

- Reject client hard deletes for events and event comments.
- Allow only authorized event and event-comment soft-delete updates.
- Block client child writes under a soft-deleted event.

Non-scope:

- Do not deploy Firestore rules.
- Do not change Functions purge behavior.
- Do not change post/comment rules except for shared helper naming required by
  the event rules implementation.
- Do not add Firestore indexes in this task.
- Do not introduce restore UI or restore API behavior.

Owned files:

- `firestore.rules`
- `tests/server/firestore/event-soft-delete-rules.test.js`

Read-only context:

- `specs/event-soft-delete-retention/spec.md`
- `tests/server/firestore/post-soft-delete-rules.test.js`
- `tests/server/firestore/notification-rules.test.js`
- `firestore.indexes.json`

Dependencies:

- T002
- T003
- T004

Browser evidence:

- Not applicable.

Engineer instructions:

- Reject `delete` requests on `events/{eventId}`.
- Reject `delete` requests on
  `events/{eventId}/comments/{commentId}`.
- Allow event soft-delete updates only for the same actor set that can delete
  events today.
- Allow event comment soft-delete updates only for the same actor set that can
  delete event comments today.
- Require `deletedByUid` to match `request.auth.uid`.
- Require `deletedAt` and `deletedPurgeAt` to be timestamp values.
- Require the update to change only `deletedAt`, `deletedByUid`, and
  `deletedPurgeAt`.
- Reject missing retention fields, wrong actor uid, invalid timestamp types, and
  unrelated data changes.
- Reject new comments, participant mutations, and other client child writes
  under a soft-deleted event.
- Modify only the owned files above.

Acceptance criteria:

- AC-T005.1: Client hard delete of an event is rejected.
- AC-T005.2: Client hard delete of an event comment is rejected.
- AC-T005.3: Authorized valid event soft delete is allowed.
- AC-T005.4: Authorized valid event comment soft delete is allowed.
- AC-T005.5: Forged soft-delete updates are rejected.
- AC-T005.6: Client child writes under a soft-deleted event are rejected.
- AC-T005.7: No rules deploy is performed or claimed.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/event-soft-delete-rules.test.js"` | Exit 0, event soft-delete rules tests pass. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Emulator tests prove hard-delete rejection and valid soft-delete allowance.
- Forged update tests cover wrong actor, missing fields, invalid timestamp
  values, and unrelated field changes.
- No deployed-rules claim is made.

Reviewer REJECT criteria:

- Client hard delete remains possible for events or event comments.
- Rules allow mutation outside the three retention fields.
- Rules block legitimate authorized soft delete under the approved actor set.
- Verification is missing, stale, failed, or not the required command.

Evidence:

- Engineer report: none yet.
- Reviewer report: none yet.
- Command output summary: none yet.
- Changed files summary: none yet.

### T006 - Firebase Event Retention Purge And Integration Gates

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Engineer for Functions purge; Coordinator for workflow-state final sync after Reviewer PASS.
- **Reviewer**: Reviewer
- **Commit checkpoint**: implementation or verification
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required
- **Incidents**: none

Scope:

- Add Firebase scheduled purge core and wrapper for event retention.
- Hard-delete expired soft-deleted event trees.
- Hard-delete expired standalone event comments only when the parent event is
  active.
- Run final integration gates and let the coordinator sync workflow state after
  Reviewer PASS.

Non-scope:

- Do not deploy Firebase Functions.
- Do not deploy Firestore rules.
- Do not change Strava, runs, imported activity, or post/comment purge behavior
  except shared low-level helpers that preserve existing post semantics.
- Do not add indexes unless verification proves the exact requirement.
- Do not push, open a PR, watch CI, merge, or sync local `main`.
- Do not introduce restore UI or restore API behavior.

Owned files:

- `functions/index.js`
- `functions/event-retention-purge.js`
- `firestore.indexes.json`
- `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge.test.js`
- `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge-schedule.test.js`
- `specs/event-soft-delete-retention/tasks.md`
- `specs/event-soft-delete-retention/handoff.md`
- `specs/event-soft-delete-retention/status.json`

Read-only context:

- `specs/event-soft-delete-retention/spec.md`
- `functions/post-retention-purge.js`
- `functions/index.js`
- `functions/package.json`
- `firestore.indexes.json`
- `docs/superpowers/status.schema.json`
- `docs/superpowers/task-contract.md`
- `specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js`

Dependencies:

- T005

Browser evidence:

- Not applicable.

Engineer instructions:

- Keep purge logic deploy-contained under `functions/`; do not import root
  `src/` modules or the root alias.
- Use the existing scheduled Functions pattern from `functions/index.js`.
- Register a scheduled event-retention wrapper and keep it delegating to the
  event purge core.
- Query expired soft-deleted events by `deletedPurgeAt` at or before the run
  time.
- For each expired event, hard-delete participants, comments, each comment
  history subcollection, and the event document in bounded batches.
- Query expired event comments by collection group or parent-scoped query as
  supported by the implementation.
- For standalone expired event comments, hard-delete the comment and history
  only when the parent event is active.
- If the parent event is soft-deleted, skip the standalone comment so the later
  event tree purge owns it.
- Treat missing documents and already-purged children as no-op success.
- Log counts for purged events, event comments, participants, history records,
  and skipped records.
- Keep existing post/comment purge tests passing.
- Modify `firestore.indexes.json` only when verification reports a required
  index, and record the evidence.
- Engineer modifies only Functions, index, and purge test files; coordinator
  updates workflow-state files after Reviewer PASS and final gate evidence.

Acceptance criteria:

- AC-T006.1: Expired soft-deleted event tree purge deletes the event,
  participants, comments, and comment history.
- AC-T006.2: Expired standalone deleted event comment under an active parent is
  purged with history.
- AC-T006.3: Expired standalone deleted event comment under a soft-deleted
  parent is skipped.
- AC-T006.4: Purge is idempotent and bounded below Firestore batch write
  limits.
- AC-T006.5: Existing post/comment purge behavior remains stable.
- AC-T006.6: Scheduled function wrapper is registered and delegates to the
  event purge core.
- AC-T006.7: Purge result/logging exposes counts for purged events, event
  comments, participants, history records, and skipped or no-op records.
- AC-T006.8: Functions syntax checks pass.
- AC-T006.9: Final workflow state sync records evidence without deploy claims.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge.test.js` | Exit 0, event purge tests pass. |
| `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js` | Exit 0, existing post purge regression tests pass. |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge-schedule.test.js` | Exit 0, scheduled wrapper registration and delegation tests pass. |
| `node --check functions/index.js` | Exit 0. |
| `node --check functions/event-retention-purge.js` | Exit 0. |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |
| `npm run workflow:check` | Exit 0, workflow state valid and synced. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Functions code stays inside the deploy-included `functions/` boundary.
- Purge tests cover event tree purge, standalone active-parent comment purge,
  soft-deleted-parent skip, batching, and idempotency.
- Scheduled wrapper registration and delegation are covered by verification.
- Purge count logging covers purged events, event comments, participants,
  history records, and skipped or no-op records.
- Existing post purge regression passes.
- Index changes, if any, include evidence that verification required them.
- Workflow files agree after coordinator sync.
- No deployed-rules, deployed-functions, pushed, PR, CI, merge, or local
  `main` sync claim is made.

Reviewer REJECT criteria:

- Event purge can delete standalone comments under a soft-deleted parent before
  parent tree purge.
- Purge imports root `src/` modules or relies on the root alias.
- Batch writes can exceed Firestore limits.
- Existing post purge behavior regresses.
- Workflow state drifts or verification is missing, stale, failed, or not the
  required command.

Evidence:

- Engineer report: none yet.
- Reviewer report: none yet.
- Command output summary: none yet.
- Changed files summary: none yet.

## Final Integration

Run after T006 Reviewer PASS and coordinator state sync. These are release
readiness gates, not deploy authorization.

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0. |
| `npm run type-check:changed` | Exit 0. |
| `npm run workflow:check` | Exit 0, workflow state valid and synced. |
| `git diff --check` | Exit 0, no whitespace errors. |

Closeout remains blocked at push, PR, CI watch, merge, local `main` sync,
Firestore rules deploy, and Firebase Functions deploy until the user explicitly
authorizes those boundaries.
