# Event Reminder Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development, or superpowers:executing-plans only if the coordinator explicitly chooses inline execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send one Dive Into Run platform email reminder to each event host and current participant around 24 hours before the event starts.

**Architecture:** Add a Firebase Functions v2 scheduled wrapper that delegates to a testable CommonJS reminder core. Store event-level reminder state and per-recipient delivery state in a server-only top-level Firestore collection, resolve recipient email from `users/{uid}.email` at send time, and call the Resend HTTP API with Node 22 global `fetch` so no new package or lockfile change is needed.

**Tech Stack:** Firebase Functions v2, firebase-admin Firestore, Resend HTTP API, Node 22 global `fetch`, Vitest browser project for spec-local Functions unit tests, JavaScript with JSDoc checkJs.

---

## Pre-Implementation Gate

The worktree is `/Users/chentzuyu/Desktop/dive-into-run-093-event-reminder-email` on branch `093-event-reminder-email`. At plan time, HEAD is the approved spec commit `08827b45d3383c7ca6a4f3b98f37ecf613a89379` (`Add event reminder email spec`). The branch is ahead of `origin/main` by one commit and behind `origin/main` by one commit.

Before dispatching any Engineer with production source, test, config, package, rules, or workflow-state owned files, the coordinator must run:

```bash
git status --short --branch --untracked-files=all
```

Expected signal before implementation dispatch: the branch must not report behind `origin/main`, and there must be no dirty files outside intentional workflow-state dispatch edits. If the branch still reports behind `origin/main`, implementation dispatch is blocked until the coordinator reconciles with the latest `origin/main` using an explicitly authorized method and refreshes `status.json` head snapshots.

Current authorization allows this plan-stage artifact edit and a planning commit only. Implementation edits, dependency installation, push, pull request, CI watch, merge, local main sync, deploy, and secret configuration are not authorized in this stage.

## Scope

In scope for the future implementation phase:

- Register one Firebase Functions v2 `onSchedule` reminder job.
- Use a 15-minute cadence and scan events whose `time` falls around `now + 24h`.
- Resolve recipient UIDs at send time from `event.hostUid` plus `events/{eventId}/participants/{uid}` documents, deduped by UID.
- Resolve recipient email from `users/{uid}.email` immediately before delivery.
- Send through Resend from one fixed platform sender configured for Functions, never from or through the host email.
- Store deterministic per-event/per-UID delivery state so `sent` is terminal, `failed` is retryable, `skipped` is terminal, and `final_failed` is terminal.
- Retry failed recipients up to three attempts.
- Mark an event reminder complete when every eligible send-time recipient is terminal.
- Add focused unit tests for window selection, recipient construction, email content, delivery decisions, Resend request shape, state completion, and scheduled wrapper registration.

Out of scope:

- UI changes, new event fields for author-entered notes, admin resend UI, manual resend tooling, provider dashboards, backfill console, and host-controlled sender address.
- New dependency installation or changes to `functions/package.json`, `functions/package-lock.json`, root `package.json`, or root `package-lock.json`.
- Firestore or storage rules changes, Firestore indexes, migrations, data deletion, or deploy commands.
- Push, pull request, CI watch, merge, local main sync, Functions deploy, Firestore rules deploy, or secret setup.

## Data Model

Use a server-only top-level collection so client Firestore rules do not need to change and hosts cannot mutate reminder state through the broad event-host update rule.

```text
eventReminderStates/{eventId}
eventReminderStates/{eventId}/deliveries/{uid}
```

`eventReminderStates/{eventId}` fields:

```js
{
  eventId: 'event-1',
  state: 'pending' | 'complete',
  eventTime: Timestamp,
  recipientUids: ['host-1', 'runner-1'],
  terminalCounts: {
    sent: 1,
    skipped: 0,
    finalFailed: 0,
  },
  completedAt: Timestamp | null,
  lastRunId: '2026-06-04T03:00:00.000Z',
  updatedAt: Timestamp,
}
```

`eventReminderStates/{eventId}/deliveries/{uid}` fields:

```js
{
  eventId: 'event-1',
  uid: 'runner-1',
  state: 'sent' | 'skipped' | 'failed' | 'final_failed',
  attempts: 1,
  leaseOwner: '2026-06-04T03:00:00.000Z',
  leaseExpiresAt: Timestamp,
  lastAttemptAt: Timestamp,
  providerMessageId: 'resend-message-id',
  reason: 'missing_email' | 'invalid_email' | 'provider_error' | 'max_attempts',
  sentAt: Timestamp,
  skippedAt: Timestamp,
  finalFailedAt: Timestamp,
  updatedAt: Timestamp,
}
```

Do not store email addresses, API keys, message bodies, or host contact details in event documents, participant documents, reminder state, or logs.

## Scheduling Semantics

Use a 15-minute cadence:

```js
exports.sendEventReminderEmails = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Taipei',
    secrets: [resendApiKey],
  },
  runScheduledEventReminderEmails,
);
```

The scanner window is deterministic:

```js
const REMINDER_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const REMINDER_WINDOW_AFTER_MS = 45 * 60 * 1000;

function getReminderWindow(nowDate) {
  const targetMs = nowDate.getTime() + REMINDER_LOOKAHEAD_MS;
  return {
    start: new Date(targetMs - REMINDER_WINDOW_BEFORE_MS),
    end: new Date(targetMs + REMINDER_WINDOW_AFTER_MS),
  };
}
```

For `now = 2026-06-04T00:00:00.000Z`, the window is:

- start: `2026-06-04T23:30:00.000Z`
- end: `2026-06-05T00:45:00.000Z`

The window overlaps across 15-minute runs so transient failures can retry before the event leaves the reminder band. Duplicate sends are controlled by the per-recipient delivery document and a short Firestore lease, not by exact scheduler timing.

## Data Flow

1. Scheduled wrapper runs every 15 minutes and builds a run ID from the current timestamp.
2. Wrapper reads Functions config:
   - `RESEND_API_KEY` from a Firebase Functions secret.
   - `REMINDER_EMAIL_FROM` from a Functions string parameter. This must be one verified platform sender displayed as Dive Into Run and backed by a no-reply address on an owned domain.
   - `PUBLIC_APP_BASE_URL` from a Functions string parameter.
3. Wrapper calls `sendEventReminderEmails` in `functions/event-reminder-email.js` with `firestore`, `logger`, `now`, `runId`, and config values.
4. Core queries `events` where `time >= window.start` and `time < window.end`.
5. Core skips soft-deleted events and events whose `eventReminderStates/{eventId}.state` is `complete`.
6. Core builds recipient UIDs from `event.hostUid` and participant document IDs or `uid` fields, deduped by UID. Host inclusion never depends on the participants subcollection.
7. For each UID, core reads `users/{uid}.email`.
8. Missing user, missing email, or invalid email records `skipped` as terminal.
9. For usable email, core reserves a delivery attempt in a Firestore transaction on `eventReminderStates/{eventId}/deliveries/{uid}`:
   - `sent`, `skipped`, and `final_failed` return `skip`.
   - `failed` with `attempts >= 3` transitions to `final_failed`.
   - A non-expired `leaseExpiresAt` for another run returns `skip`.
   - Otherwise the transaction writes `state: 'failed'`, increments `attempts`, records `leaseOwner`, and returns `send`.
10. Core calls Resend with the platform sender, recipient email, subject, text body, and HTML body.
11. Resend accepted response transitions the delivery document to `sent` with `providerMessageId` and `sentAt`.
12. Resend or network failure leaves the delivery document `failed` when attempts remain, or transitions it to `final_failed` on attempt 3.
13. After processing the send-time recipient set, core reads their delivery states. If all are terminal, it writes `eventReminderStates/{eventId}.state = 'complete'` with the recipient UID snapshot and terminal counts.

The accepted duplicate tradeoff remains: if Resend accepts a message and the process crashes before `sent` state is persisted, a later retry can send that recipient one duplicate reminder. The plan intentionally does not add an outbox table, provider-level idempotency abstraction, or manual resend UI for this phase.

## Resend Boundary

Use Resend's HTTP API through Node 22 global `fetch` instead of adding the Resend SDK dependency.

Target adapter shape:

```js
function createResendEmailClient({ apiKey, fetchImpl = fetch }) {
  return {
    async sendEmail(message) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`resend_error:${response.status}:${payload.name || 'unknown'}`);
      }

      return { id: String(payload.id || '') };
    },
  };
}
```

The message passed to Resend must use:

- `from`: the fixed `REMINDER_EMAIL_FROM` platform sender.
- `to`: one resolved user email.
- `subject`: a Dive Into Run reminder subject including event title or location.
- `text` and `html`: event start time, location from `city`, `district`, `meetPlace`, existing `description` when present, and `{PUBLIC_APP_BASE_URL}/events/{eventId}`.

If implementation proves the SDK is required, the Engineer must stop. Adding `resend` to `functions/package.json` or changing any lockfile needs a new dependency authorization boundary.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `functions/event-reminder-email.js` | Create | Pure reminder core, Firestore state transitions, recipient resolution, email content builder, Resend HTTP adapter, structured logs. |
| `functions/index.js` | Modify | Thin scheduled wrapper, Functions v2 params/secrets, `onSchedule` registration, delegation to reminder core. |
| `specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js` | Create | Unit coverage for window selection, recipients, content, skip/retry/final states, completion, Resend request shape, and no-email logging. |
| `specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js` | Create | Unit coverage for scheduled wrapper registration, config wiring, and delegation. |
| `specs/event-reminder-email/tasks.md` | Modify later by coordinator only | Dispatch, review, completion, and verification evidence state. |
| `specs/event-reminder-email/handoff.md` | Modify later by coordinator only | Resume state, latest evidence, blockers, and release boundary reminders. |
| `specs/event-reminder-email/status.json` | Modify later by coordinator only | Machine-readable state, task states, head snapshots, phase commits, verification evidence, and incidents. |

No planned implementation task owns `functions/package.json`, `functions/package-lock.json`, `firestore.rules`, `firestore.indexes.json`, root `package.json`, root `package-lock.json`, or any `src/**` file.

## Verification Strategy

Focused implementation gates:

```bash
npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js
```

```bash
npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js
```

Final integration gate after all implementation tasks pass Reviewer:

```bash
npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js
```

```bash
npm run lint:changed
```

```bash
npm run type-check:changed
```

```bash
npm run depcruise
```

```bash
node scripts/validate-workflow-state.js specs/event-reminder-email/status.json
```

```bash
node scripts/check-superpowers-state.js specs/event-reminder-email/status.json
```

```bash
git diff --check
```

Expected signals:

- Vitest focused suites exit 0 and report the reminder core and schedule tests passing.
- `npm run lint:changed` exits 0 for changed `functions/**` and `specs/**` JavaScript files.
- `npm run type-check:changed` exits 0 or reports no type errors in changed files. Functions code is CommonJS and test-covered; TypeScript project coverage is limited to `src`, `specs`, and `.next/types`.
- `npm run depcruise` exits 0 with no dependency violations.
- Workflow validation/check commands exit 0.
- `git diff --check` exits 0.

Browser evidence is not required because this feature has no UI surface. If an implementation task needs to touch UI, app routes, runtime hooks, or components, stop and request a plan update with browser evidence.

## Dependency, Rules, And Deploy Boundaries

- Dependency boundary: no new dependency is planned. Do not modify `functions/package.json`, `functions/package-lock.json`, root `package.json`, or root `package-lock.json`. Stop if the implementation cannot use Node 22 global `fetch`.
- Firestore rules boundary: no rules change is planned because reminder state lives in a server-only top-level collection and Admin SDK bypasses client rules. Stop if reminder fields move onto `events/{eventId}` or any client-readable/client-writable path.
- Firestore indexes boundary: no index change is planned. The scanner only queries `events.time` range, which uses the standard single-field index. Stop if adding a reminder-state query that requires `firestore.indexes.json`.
- Secrets/config boundary: code may reference `RESEND_API_KEY`, `REMINDER_EMAIL_FROM`, and `PUBLIC_APP_BASE_URL`, but setting values in Firebase or local environments is a separate unauthorized release/configuration action.
- Deploy boundary: Functions deploy and Firestore rules deploy are not authorized by this plan-stage commit. `rulesDeployStatus` remains `not_applicable` unless a future approved plan update changes rules.

## Risks And Mitigations

- Branch divergence: the branch is behind `origin/main` by one commit at plan time. Implementation dispatch must wait for an authorized reconciliation and refreshed status snapshots.
- Host-controlled event update rule: storing reminder fields on event documents would let hosts mutate server state. The plan uses `eventReminderStates` to avoid rules changes and client mutation risk.
- Overlapping scheduled runs: Firestore delivery leases prevent normal duplicate sends. The accepted provider-success/state-crash duplicate remains.
- Retry window: a 15-minute cadence and 75-minute scan band provide multiple retry opportunities before the event leaves the reminder band.
- Email privacy: state and logs use UID, event ID, state, attempts, reason, and provider message ID only. Logs must not include email addresses or message bodies.
- Config failure: missing `RESEND_API_KEY`, `REMINDER_EMAIL_FROM`, or `PUBLIC_APP_BASE_URL` should fail the whole scan with structured config-error logs that do not include secret values.
- Soft-deleted events: core must skip events carrying `deletedAt`.
- Late joiners: completion is scoped to the send-time recipient set. Late joiners after completion do not get reminders in this feature.

## Stop Conditions

Stop and report to the coordinator if any of these occurs:

- The branch still reports behind `origin/main` when implementation dispatch is about to start.
- Implementation requires files outside the task-owned write set.
- Implementation requires a new dependency, lockfile change, package metadata change, Firestore rules change, Firestore index change, migration, destructive operation, data deletion, or secret value setup.
- Implementation requires production code outside `functions/event-reminder-email.js` and `functions/index.js`.
- Implementation needs UI, runtime hook, app route, or `src/**` changes.
- A test or verification failure indicates the plan's data model, scheduler design, or retry design is flawed.
- The approved spec and this plan disagree.
- A task receives two Reviewer rejections without a narrow fix path inside the same owned files.
- Any summary would need to claim deployed Functions, configured secrets, deployed rules, push, PR, CI, merge, or local main sync without explicit authorization and evidence.

## Task Slices

All implementation slices are serialized in one worktree. Shared Functions helper files, scheduled wrapper wiring, workflow state, and final verification must not be parallelized.

Dependency graph:

```text
G0 branch reconciliation and implementation authorization
G0 -> T001
T001 -> T002
T002 -> T003
T001 + T002 + T003 -> T004
```

Parallel waves:

- `wave-0`: G0 coordinator gate, no source edits.
- `wave-1`: T001 reminder core helpers and content.
- `wave-2`: T002 delivery state, retry orchestration, and Resend HTTP adapter.
- `wave-3`: T003 scheduled wrapper and Functions config.
- `wave-4`: T004 final integration verification and workflow state sync.

Task list:

- T001: Reminder core helpers and email content.
- T002: Delivery state, retry orchestration, and Resend HTTP adapter.
- T003: Scheduled wrapper and Functions config.
- T004: Final integration verification and workflow state sync.
