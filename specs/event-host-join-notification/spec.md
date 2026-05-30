# Event Host Join Notification Spec

## Metadata

- Feature slug: `event-host-join-notification`
- Branch: `078-event-host-join-notification`
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-078-event-host-join-notification`
- Date: 2026-05-30 Asia/Taipei / 2026-05-29 UTC
- Profile: P4 new product feature

## Summary

When a user successfully signs up for an event, notify the event host in the
existing in-app Firestore-backed notification bell and toast system. The
joining user's success flow remains primary; notification creation is
best-effort after the participant is newly created.

## User Scenarios

- As an event host, I receive an in-app notification when another user newly
  signs up for my event.
- As an event host, I can open the notification and land on the event detail
  page at `/events/{eventId}`.
- As a joining user, my successful signup is not rolled back or shown as failed
  if the host notification write fails after the join succeeds.
- As a host joining my own event, I do not receive a notification about my own
  signup.

## Requirements

- Cover every successful new signup entrypoint, including event detail and list
  page join flows.
- Send notifications only through the existing in-app Firestore-backed
  notification bell and toast system.
- Notify only after the join use case reports a newly-created participant.
- Do not notify when the actor uid equals the event `hostUid`.
- Do not notify for `already_joined`, full events, failed joins, leave actions,
  or any result that is not a newly-created participant.
- Notification target user must be the event host.
- Notification link must be `/events/{eventId}`.
- Suggested notification message:
  `{actorName} 報名了你的活動「{eventTitle}」`.
- If notification creation fails after a successful join, log or ignore the
  notification failure without rolling back the join or showing a failure toast
  to the joining user.
- Keep the join transaction focused on participant and event counter writes.
- Add the new notification type, message, and use case in the notification
  layers.
- Runtime join handlers call the notification use case only after the join
  returns a newly joined status.
- Firestore rules must later allowlist the new notification type while
  preserving validation against self-notification, wrong actor, wrong
  timestamp, and invalid read state.
- Implementation must follow the forward-only layer architecture.

## Success Criteria

- A newly-created participant from any join entrypoint creates one host
  notification when the actor is not the host.
- Notification payload supports the new type, message, and `/events/{eventId}`
  link.
- Host self-join and non-new-join outcomes create no notification.
- Notification write failure after join success is non-blocking for the joining
  user.
- Firestore rules changes are planned and verified before release, but no rules
  deploy is implied until explicitly authorized and evidenced.
- Focused unit and rules tests cover the notification behavior and rejection
  cases listed in this spec.

## Out Of Scope

- Email notifications.
- Push notifications.
- FCM.
- Cloud Function triggers.
- Notifications for leave actions.
- Notifications for failed, full, or already-joined outcomes.
- Rolling back a successful join because notification creation failed.
- Deploying Firestore rules in this spec artifact creation stage.
- Implementing the feature in this spec artifact creation stage.

## Current Evidence

- Event detail join handler: `src/runtime/hooks/useEventDetailParticipation.js:142`.
- Event detail join use case: `src/runtime/client/use-cases/event-use-cases.js:114`.
- Event service join transaction boundary: `src/service/event-service.js:402`.
- Firebase events participant write path:
  `src/repo/client/firebase-events-repo.js:162`.
- List page join handler: `src/runtime/hooks/useEventParticipation.js:215`.
- Notification model and types: `src/service/notification-service.js:26`.
- Notification payload builder: `src/service/notification-service.js:65`.
- Notification writes and reads:
  `src/repo/client/firebase-notifications-repo.js:46`.
- Notification provider UI path:
  `src/runtime/providers/NotificationProvider.jsx:97`.
- Notification panel UI path:
  `src/components/Notifications/NotificationPanel.jsx:130`.
- Notification helper path: `src/lib/notification-helpers.js:71`.
- Firestore notification allowlist: `firestore.rules:392`.
- Architecture decisions:
  `docs/decisions/ADR-001-six-layer-forward-only-architecture.md` and
  `docs/decisions/ADR-002-lib-compatibility-facade.md`.

## Architecture Constraints

- Keep canonical implementation in `src/repo/`, `src/service/`,
  `src/runtime/`, and UI layers according to the existing forward-only
  dependency direction.
- Do not copy old `src/lib` specs or compatibility facades as the
  implementation home.
- Preserve App Router thinness and keep state/use-case behavior outside
  `src/app/`.

## Testing Requirements

- Notification type, message, and link support.
- Notification use case writes to `hostUid`.
- Notification use case excludes self-notification when actor uid equals
  `hostUid`.
- Join handlers trigger notification only for newly-created participant
  results.
- No notification for `already_joined`, full, failed join, leave, or any
  non-new-participant result.
- Firestore rules allow the new notification type.
- Firestore rules still reject self-notification, wrong actor, wrong
  timestamp, and invalid read state.
- Run changed lint and type-check gates.
- Run focused unit tests for notification and join handler behavior.
- Run focused Firestore rules tests.
- Run `npm run depcruise` if the implementation changes layer or dependency
  surfaces.

## User Authorization

- Spec approved by: user, 2026-05-30 Asia/Taipei / 2026-05-29 UTC.
- One-time automated execution authorization: yes, for this spec artifact
  creation task only.
- Authorization boundary:
  - edit: yes, for the owned spec workflow files only.
  - commit: yes, after Reviewer PASS and coordinator verification; main agent
    will commit, not the Engineer.
  - push: no.
  - pullRequest: no.
  - ciWatch: no.
  - merge: no.
  - localMainSync: no.
  - deployFirestoreRules: no.

## Release Notes

- This feature will require a Firestore rules allowlist update before product
  release.
- Firestore rules deploy is required later but is not authorized or deployed in
  this stage.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
