# Event Reminder Email Spec

## Status / Scope / Authorization Boundary

Status: approved spec-stage product and technical boundary for the P4
`event-reminder-email` feature.

This document defines the expected product behavior and the technical
constraints needed to remove ambiguity before planning. It is not an
implementation plan and does not split work into tasks.

Authorization boundary for this stage:

- Allowed: create and commit this spec file.
- Not allowed: production implementation, UI changes, plan/task/handoff/status
  artifacts, dependency installation or updates, secret values, push, PR,
  merge, deploy, or scheduler/provider setup in live infrastructure.

## Problem

Users who host or join an event currently need to remember upcoming runs on
their own. Dive Into Run should send one platform reminder email around 24
hours before an event starts, using existing event and user data without adding
new UI fields.

## Goals

- Send an email reminder around 24 hours before an event starts.
- Include both the host and the current participants at send time.
- Keep email addresses out of event and participant documents.
- Use a fixed platform sender identity, not the host's email address.
- Make delivery retryable without resending recipients already marked `sent`.
- Mark an event's reminder work complete once all eligible recipients are in a
  terminal delivery state.
- Keep implementation testable with mocked Firestore and Resend boundaries.

## Non-Goals

- No production code in the spec phase.
- No UI changes.
- No new event note/reminder-specific field.
- No replacement for the existing event description field.
- No host-controlled sender address and no exposure of the host's email.
- No reminder backfill management console.
- No manual resend tooling.
- No dependency installation or lockfile update in the spec phase.
- No push, PR, merge, deploy, or secret value configuration in the spec phase.

## User Scenarios

1. A participant joined an event before the reminder run. Around 24 hours
   before the event starts, they receive an email with event details and a link
   to the event detail page.
2. A host created an event but is not represented in the event participants
   subcollection. Around 24 hours before the event starts, the host still
   receives the reminder.
3. A participant account has no usable email at send time. The reminder system
   records a skipped terminal delivery state for that recipient and continues
   processing the rest of the event.
4. A transient Resend or network failure occurs for one recipient. That
   recipient can be retried until the max-attempt rule is reached, while
   already sent recipients are not resent.

## Requirements

- Provider: Resend.
- Scheduler: Firebase Functions v2 `onSchedule`.
- Schedule cadence: every 15 or 30 minutes.
- The scheduled job scans a rolling window for events that start approximately
  24 hours after the scan time.
- The scan window must tolerate scheduler delay and overlapping runs. Duplicate
  sends are prevented by deterministic delivery state, not by assuming the
  scheduler fires exactly on time.
- The reminder uses the recipient set at send time. It does not promise
  reminders for users who join after the event has already reached a reminder
  complete state.
- Recipient set is `hostUid` plus participant `uid`s, deduped by UID.
- The host must be added from the event document independently and must not
  depend on the participants subcollection.
- Event and participant documents must not store email addresses for this
  feature.
- Recipient email is read from `users/{uid}.email` at send time.
- Missing or invalid recipient email is skipped and recorded as terminal.
- The detail link uses `{PUBLIC_APP_BASE_URL}/events/{eventId}`. The base URL
  is configured through Functions environment or secret-backed configuration,
  never hardcoded in source.
- The sender is a fixed verified platform identity, displayed as Dive Into Run
  and backed by a no-reply address on an owned domain. It must not use or expose
  the host's email address.

## Data Sources and Recipient Rules

The reminder source event is the existing event document. Required fields for
email content and scheduling come from current event data:

- `time` determines eligibility and reminder timing.
- `city`, `district`, and `meetPlace` describe where the event happens.
- `description` is the existing note/detail text used in the email body.
- `hostUid` identifies the host recipient.

Current repo evidence:

- Event data already includes `city`, `district`, `time`, `meetPlace`,
  `hostUid`, and `description` in `src/service/event-service.js:59`,
  `src/service/event-service.js:60`, `src/service/event-service.js:61`,
  `src/service/event-service.js:63`, `src/service/event-service.js:73`, and
  `src/service/event-service.js:78`.
- Event creation stores host identity fields but not host email in
  `src/runtime/hooks/useEventsPageRuntime.js:211` through
  `src/runtime/hooks/useEventsPageRuntime.js:213`.
- Participant creation stores `uid`, `name`, `photoURL`, `eventId`, and
  `joinedAt`, but not email, in `src/service/event-service.js:428`.
- Participant documents live under
  `events/{eventId}/participants/{uid}` in
  `src/repo/client/firebase-events-repo.js:186`.
- User profile documents contain `email` in
  `src/repo/client/firebase-auth-repo.js:60`; the auth runtime user shape also
  includes `email` in `src/runtime/providers/AuthProvider.jsx:8`.

Recipient resolution:

1. Load the eligible event.
2. Read `event.hostUid` and add it to the recipient UID set when present.
3. Read participant documents for the event and add each participant `uid`.
4. Deduplicate by UID.
5. Resolve `users/{uid}.email` for each UID immediately before delivery.
6. Skip UIDs with missing users, missing email, or invalid email.

## Email Content

The email must be recognizable as a Dive Into Run platform notification.

Minimum content:

- Event start time.
- Event location using available `city`, `district`, and `meetPlace`.
- Existing event `description` when present.
- Event detail link at `{PUBLIC_APP_BASE_URL}/events/{eventId}`.

The reminder must not introduce or depend on a new "note" field. It uses the
existing event description. No UI change is required for authoring reminder
content.

The current app already exposes the detail route and share URL shape:

- `src/app/events/[id]/page.jsx:14` and `src/app/events/[id]/page.jsx:21`
  derive metadata for `/events/{id}`.
- `src/runtime/hooks/useEventDetailRuntime.js:264` through
  `src/runtime/hooks/useEventDetailRuntime.js:266` builds the event share URL.

## Scheduling Semantics

The scheduler is a Firebase Functions v2 scheduled function using
`onSchedule`. Existing scheduled function patterns are present in the repo at
`functions/index.js:7`, `functions/index.js:451`,
`functions/index.js:470`, and `functions/index.js:492`; Functions are wired in
`firebase.json:20` and `firebase.json:27`.

The scanner selects events whose start time falls in the configured reminder
window around 24 hours from the scan time. The implementation must support a
15-minute or 30-minute cadence and choose a window wide enough to tolerate
ordinary scheduler delay. Overlapping scan windows are acceptable because
delivery state is deterministic per event and recipient.

The system should not rely on exact once-only scheduler execution. It should
expect repeated scans, delayed scans, and retry attempts.

## Delivery State and Retry Semantics

Delivery state is recorded at event plus recipient UID granularity. The state
key must be deterministic for `{eventId, uid}` so overlapping scheduler runs
can converge on the same recipient state.

Required recipient states:

- `sent`: Resend accepted the message. This is terminal and must never be
  resent by this feature.
- `skipped`: The recipient is ineligible for delivery, such as missing or
  invalid email. This is terminal.
- `failed`: Delivery failed and may be retried while attempts remain.
- `final_failed`: Delivery failed after the maximum attempt count. This is
  terminal.

Attempts:

- The max attempt count is 3.
- Failed deliveries can be retried until they become `sent`, `skipped`, or
  `final_failed`.
- A recipient with `sent` state is never resent.

Reminder completion:

- An event can be marked reminder complete after all eligible recipients from
  the send-time recipient set are terminal: `sent`, `skipped`, or
  `final_failed`.
- Once complete, the event should not keep being selected for reminder work.
- Completion is scoped to the reminder run's recipient set; this feature does
  not guarantee late-join reminders after completion.

Accepted tradeoff:

- If Resend accepts a message and the function crashes before the delivery
  state is updated to `sent`, a later retry may send the same recipient one
  duplicate reminder. This is an accepted low-probability tradeoff for this
  feature. Do not add a transactional outbox, provider-level idempotency
  abstraction, or overbuilt delivery ledger for this phase solely to eliminate
  that case.

## Error Handling and Logging

The scheduled job must continue processing independent recipients when one
recipient fails.

Structured logs must include enough fields to diagnose scans and delivery
decisions without exposing message bodies or email addresses:

- scheduler run ID or timestamp.
- event ID.
- recipient UID.
- delivery state transition.
- attempt count.
- skip or failure reason.
- Resend response ID or normalized provider error code when available.

Errors that prevent the whole scan from continuing should be logged with the
scan window and failure reason.

## Security / Privacy / Secrets

- Resend API keys and sender configuration are Functions environment or secret
  configuration, not committed source values.
- `PUBLIC_APP_BASE_URL` is Functions runtime configuration and is not hardcoded.
- Email addresses are resolved from `users/{uid}.email` at send time and are
  not copied into event or participant documents.
- Logs must not include email addresses, API keys, full email content, or host
  contact information.
- The sender is a fixed platform identity and does not expose the host email.
- The current app and Functions dependency sets do not already include a mail
  provider dependency in `package.json:55` through `package.json:66` or
  `functions/package.json:15` through `functions/package.json:18`.

## Testing and Verification

Acceptance tests for implementation must cover:

- Unit tests for reminder window selection, including delayed and overlapping
  scheduler windows.
- Unit tests for recipient set construction: host plus participant UIDs,
  independent host inclusion, and UID dedupe.
- Unit tests for email content building from event fields and configured base
  URL.
- Unit tests for delivery decisions: `sent` never resend, `failed` retry,
  max-attempt transition to `final_failed`, and missing or invalid email
  `skipped`.
- Server/Functions tests with mocked Firestore and mocked Resend.
- Emulator integration only if the implementation needs it to prove Firestore
  transaction/query behavior.

Expected static and local verification gates for the implementation phase:

- `npm run lint:changed`
- `npm run type-check:changed`
- `npm run depcruise`
- Functions Vitest gate covering the scheduler and delivery logic.

No UI or browser evidence is required because this feature adds no user-facing
UI surface in this scope.

## Open Questions / Decisions

No open product questions remain for this spec stage. The following decisions
are intentional:

- Use Resend as the email provider.
- Use Firebase Functions v2 `onSchedule` as the scheduler.
- Treat either a 15-minute or 30-minute scheduler cadence as acceptable when
  the scanner window still tolerates ordinary scheduler delay.
- Use send-time recipients rather than event-creation snapshots.
- Keep email source of truth in `users/{uid}.email`.
- Use existing `event.description` for reminder notes and make no UI change.
- Accept the rare duplicate-send crash window after Resend success and before
  state persistence instead of designing a heavier outbox/idempotency system.
- Treat missing or invalid email as skipped terminal delivery.
- Stop scanning an event after all eligible send-time recipients reach terminal
  state.
