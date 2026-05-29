# Event Host Join Notification Plan

## Planning State

Detailed implementation planning is pending user review of the spec artifacts.
The implementation plan and task slices must be produced by the
`superpowers:writing-plans` stage after that review. This file intentionally
does not define implementation task slices.

## Approved Architecture Summary

- Join transactions remain focused on participant and event counter writes.
- Notification behavior is added through the notification layers as a new
  notification type, message builder, and use case.
- Runtime join handlers call the notification use case only after a join result
  confirms a newly-created participant.
- Notification creation is best-effort after join success. Failure to create
  the notification must be logged or ignored without rolling back the join or
  showing a failure toast to the joining user.
- Notification writes target the event `hostUid` and are skipped when the actor
  uid equals `hostUid`.
- Notification links point to `/events/{eventId}`.
- Firestore rules must later allowlist the new notification type and keep
  rejecting self-notification, wrong actor, wrong timestamp, and invalid read
  state.
- Implementation must follow the six-layer forward-only architecture and keep
  canonical behavior outside `src/lib` compatibility facades.

## Known Entry Points And Surfaces

- Event detail join handler:
  `src/runtime/hooks/useEventDetailParticipation.js:142`.
- Event detail join use case:
  `src/runtime/client/use-cases/event-use-cases.js:114`.
- Event service join transaction boundary:
  `src/service/event-service.js:402`.
- Firebase events participant write path:
  `src/repo/client/firebase-events-repo.js:162`.
- List page join handler:
  `src/runtime/hooks/useEventParticipation.js:215`.
- Notification model and types:
  `src/service/notification-service.js:26`.
- Notification payload builder:
  `src/service/notification-service.js:65`.
- Notification writes and reads:
  `src/repo/client/firebase-notifications-repo.js:46`.
- Notification UI surfaces:
  `src/runtime/providers/NotificationProvider.jsx:97`,
  `src/components/Notifications/NotificationPanel.jsx:130`, and
  `src/lib/notification-helpers.js:71`.
- Firestore notification allowlist:
  `firestore.rules:392`.
- Architecture decisions:
  `docs/decisions/ADR-001-six-layer-forward-only-architecture.md` and
  `docs/decisions/ADR-002-lib-compatibility-facade.md`.

## Verification Strategy To Carry Into Planning

- Validate notification type, message, and `/events/{eventId}` link support.
- Validate the notification use case writes to the event host and excludes
  host self-notification.
- Validate all join entrypoints trigger only after a newly-created participant
  result.
- Validate no notifications are emitted for `already_joined`, full, failed,
  leave, or any non-new-participant outcome.
- Validate Firestore rules allow the new notification type and reject invalid
  actor, self-notification, timestamp, and read-state cases.
- Run changed lint and type-check gates.
- Run focused unit and rules tests.
- Run `npm run depcruise` if layer or dependency surfaces change.

## Workflow State

- Status schema: v3.
- Current head snapshot: captured from local branch
  `078-event-host-join-notification` at
  `cc2c4874cc5c1af78167a8d6fb1f590194491461`.
- Remote head snapshot: captured from `origin/main` at
  `cc2c4874cc5c1af78167a8d6fb1f590194491461`.
- Last verified commit policy: set only after fresh verification covers a
  concrete commit.
- Phase commit checkpoints: spec, plan, implementation, review, closeout.
- Rules deploy status: required later, not changed, not deployed.
- Incident handling: open incidents block closeout unless explicitly resolved,
  mitigated, or carried forward.

## Release Boundary

- Firestore rules deploy authorization:
  `authorizationBoundary.deployFirestoreRules=false`.
- Rules deploy is separate from edit, commit, push, pull request, CI watch,
  merge, and local `main` sync.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Stop Conditions

- Stop if detailed implementation planning is requested before the user reviews
  these spec artifacts.
- Stop if any implementation requires files outside a future approved Planner
  write set.
- Stop if the implementation plan would require email, push, FCM, Cloud
  Functions, schema migration, data deletion, new dependency, or rules deploy.
- Stop if an actual Firestore rules deploy or deployed-rules claim is needed
  while `deployFirestoreRules` remains false.
