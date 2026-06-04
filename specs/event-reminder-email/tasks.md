# Event Reminder Email Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/event-reminder-email/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `docs/superpowers/task-profiles.md`, `docs/superpowers/task-contract.md`, this file, `handoff.md`, and `status.json` before dispatching implementation.
- Main agent is control plane only. Source, tests, rules, docs, workflow docs, scripts, config, package, and deployment edits go Engineer-first unless the main-agent workflow-state exception applies.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, pull request, CI watch, merge, local main sync, or deploy.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Verification evidence is one command per entry. Do not combine commands with shell chain operators.
- Firestore rules deploy and Functions deploy are separate release boundaries.
- Final summaries must not imply deployed Functions, configured secrets, deployed Firestore/storage rules, or deployed product behavior without explicit authorization and evidence.

## Current State

- Feature slug: `event-reminder-email`.
- Branch: `093-event-reminder-email`.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-093-event-reminder-email`.
- Profile: P4 new feature.
- Current phase: plan artifacts committed; reviewer state-fix pass is pending.
- Active task: none.
- Active wave: none.
- Current branch ref: `093-event-reminder-email`; reviewed planning checkpoint: `6ed0af5967b452c87ab1ab026f4181569a1e51d3` (`Add event reminder email plan`).
- Remote head: `b1cdaee96618983d333d1b6da2a78c0312e3b7ba` from local `origin/main`.
- Branch divergence at plan time: ahead 1, behind 1.
- Authorization boundary: edit=no for implementation, commit=yes for planning artifacts only, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.
- Rules deploy status: `not_applicable`.
- Incidents: none.

## Planner Output

Dependency graph:

- G0 branch reconciliation and implementation authorization -> T001.
- T001 -> T002.
- T002 -> T003.
- T001 + T002 + T003 -> T004.

Parallel waves:

- `wave-0`: G0 coordinator gate, no source edits.
- `wave-1`: T001 only.
- `wave-2`: T002 only.
- `wave-3`: T003 only.
- `wave-4`: T004 only.

Final integration gate:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js` | Exit 0, all reminder Functions tests pass. |
| `npm run lint:changed` | Exit 0, no lint errors in changed files. |
| `npm run type-check:changed` | Exit 0 or `No type errors in changed files.` |
| `npm run depcruise` | Exit 0, no dependency violations. |
| `node scripts/validate-workflow-state.js specs/event-reminder-email/status.json` | Exit 0, status schema is valid. |
| `node scripts/check-superpowers-state.js specs/event-reminder-email/status.json` | Exit 0, workflow companion files are synced. |
| `git diff --check` | Exit 0, no whitespace errors. |

Shared helper, config, lockfile, rules, and workflow-state writes are serialized. No same-wave tasks write shared files.

## Gate G0 - Branch Reconciliation And Implementation Authorization

- **State**: blocked for implementation until the coordinator resolves it.
- **Owner**: Coordinator.
- **Wave**: `wave-0`.
- **Scope**: Confirm implementation edit authorization and reconcile branch divergence before source dispatch.
- **Non-scope**: No source, test, package, rules, config, secret, deploy, push, pull request, CI watch, merge, or local main sync action is authorized by this planning task.
- **Required command**: `git status --short --branch --untracked-files=all`.
- **Expected signal**: Branch `093-event-reminder-email` does not report behind `origin/main`; dirty files are absent or limited to approved workflow-state dispatch edits.
- **Stop condition**: If the branch still reports behind `origin/main`, do not dispatch T001.

## Tasks

### T001 - Reminder Core Helpers And Email Content

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Functions Core Engineer
- **Reviewer**: Functions Core Reviewer
- **Commit checkpoint**: implementation commit after Reviewer PASS and coordinator authorization.
- **Last verified commit**: none for this task.
- **Authorization boundary**: edit=no until implementation is explicitly authorized, commit=no for Engineer, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: `not_applicable`
- **Incidents**: none

Scope:

- Create the reminder core module with pure helpers for scheduler window calculation, event time normalization, recipient UID dedupe, email validation, event detail URL building, and email content construction.
- Create focused unit tests for those helpers.
- Use existing event `description` as the email 注意事項 content.
- Keep the module CommonJS to match existing `functions/*.js` files.

Non-scope:

- No scheduled wrapper registration.
- No Resend network call.
- No Firestore writes or transactions.
- No package, lockfile, rules, indexes, `src/**`, UI, deploy, secret setup, or live provider configuration changes.

Owned files:

- `functions/event-reminder-email.js`
- `specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js`

Read-only context:

- `specs/event-reminder-email/spec.md`
- `specs/event-reminder-email/plan.md`
- `functions/event-retention-purge.js`
- `functions/post-retention-purge.js`
- `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge.test.js`
- `specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js`
- `src/service/event-service.js`
- `src/repo/client/firebase-events-repo.js`
- `src/repo/client/firebase-auth-repo.js`
- `src/runtime/providers/AuthProvider.jsx`

Dependencies:

- G0 branch reconciliation and implementation authorization.

Browser evidence:

- Not applicable. No UI change is allowed.

Engineer instructions:

- Use `superpowers:test-driven-development`.
- Write failing tests first in `specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js`.
- Export constants `REMINDER_LOOKAHEAD_MS`, `REMINDER_WINDOW_BEFORE_MS`, `REMINDER_WINDOW_AFTER_MS`, and `MAX_DELIVERY_ATTEMPTS`.
- Implement `getReminderWindow(now)` so `2026-06-04T00:00:00.000Z` maps to start `2026-06-04T23:30:00.000Z` and end `2026-06-05T00:45:00.000Z`.
- Implement `normalizeRecipientUids(eventData, participantDocs)` so it adds `eventData.hostUid` independently, accepts participant doc IDs and participant `uid` fields, trims strings, drops blanks, and dedupes by UID.
- Implement `isUsableEmail(email)` with a conservative non-empty single-address check: one `@`, no whitespace, non-empty local part, non-empty domain, and at least one `.` in the domain.
- Implement `buildEventDetailUrl(publicAppBaseUrl, eventId)` by trimming trailing slashes from the base URL and returning `${base}/events/${encodeURIComponent(eventId)}`.
- Implement `buildReminderEmail({ eventId, eventData, publicAppBaseUrl })` returning `{ subject, text, html }`.
- Include event start time, `city`, `district`, `meetPlace`, existing `description` when present, and the detail URL in both text and HTML bodies.
- Do not introduce a new note field or read email from event or participant documents.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: Reminder window constants produce the exact 75-minute scan band around `now + 24h`.
- AC-T001.2: Recipient UID construction includes host even when the host is absent from participants and dedupes host/participant overlap.
- AC-T001.3: Email content uses existing `description`, never a new note field, and includes the configured event detail URL.
- AC-T001.4: Email validation skips missing, blank, whitespace-containing, missing-domain, and missing-local emails.
- AC-T001.5: No dependency, package, rules, index, `src/**`, or UI file changes are made.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js` | Red before implementation because `functions/event-reminder-email.js` is missing; green after implementation with helper tests passing. |
| `npm run lint:changed` | Exit 0, no lint errors in changed files. |
| `npm run type-check:changed` | Exit 0 or `No type errors in changed files.` |

Reviewer PASS criteria:

- Diff touches only owned files.
- Helper exports and constants match this task contract.
- Tests cover window, recipient dedupe, email validation, detail URL, and description-backed content.
- No package, lockfile, rules, index, `src/**`, UI, deploy, or secret setup change appears in the diff.
- Verification commands are fresh and pass after implementation.

Reviewer REJECT criteria:

- Host inclusion depends on participant docs.
- Email content uses a new field instead of `description`.
- Email address is read from event or participant data.
- The scan window differs from the plan without a plan update.
- Diff touches non-owned files or verification is missing, stale, failed, or run against the wrong files.

Evidence:

- Engineer report: pending until dispatch.
- Reviewer report: pending until review.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: pending until coordinator commit.
- Rules deploy status: `not_applicable`.
- Incidents: none.

### T002 - Delivery State, Retry Orchestration, And Resend HTTP Adapter

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Reminder Delivery Engineer
- **Reviewer**: Reminder Delivery Reviewer
- **Commit checkpoint**: implementation commit after Reviewer PASS and coordinator authorization.
- **Last verified commit**: none for this task.
- **Authorization boundary**: edit=no until implementation is explicitly authorized, commit=no for Engineer, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: `not_applicable`
- **Incidents**: none

Scope:

- Extend the core module with Firestore reminder state, per-recipient delivery state, retry decisions, send-time email resolution, completion marking, Resend HTTP adapter, and structured logs.
- Extend the T001 unit test file with delivery orchestration tests using Firestore and Resend test doubles.

Non-scope:

- No scheduled wrapper registration.
- No package or lockfile changes.
- No Firestore rules or index changes.
- No UI, `src/**`, deploy, secret setup, manual resend tooling, or admin resend UI.

Owned files:

- `functions/event-reminder-email.js`
- `specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js`

Read-only context:

- `specs/event-reminder-email/spec.md`
- `specs/event-reminder-email/plan.md`
- `functions/event-retention-purge.js`
- `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge.test.js`
- `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge-schedule.test.js`
- `firestore.rules`
- `firestore.indexes.json`

Dependencies:

- T001 `review_passed`.

Browser evidence:

- Not applicable. No UI change is allowed.

Engineer instructions:

- Use `superpowers:test-driven-development`.
- Add tests for send-time recipient resolution, skipped missing email, skipped invalid email, sent terminal no-resend, failed retry, attempt 3 transition to `final_failed`, event completion when all recipients are terminal, independent-recipient continuation after one provider failure, Resend request shape, and structured logs without email addresses.
- Implement `createResendEmailClient({ apiKey, fetchImpl })` using `POST https://api.resend.com/emails`.
- Implement `sendEventReminderEmails({ firestore, logger, now, runId, config, emailClient })`.
- Query `events` by `time >= window.start` and `time < window.end`.
- Skip events with `deletedAt`.
- Store reminder state at `eventReminderStates/{eventId}` and delivery state at `eventReminderStates/{eventId}/deliveries/{uid}`.
- Use Firestore transactions to reserve a delivery attempt before calling Resend.
- Use only delivery states `sent`, `skipped`, `failed`, and `final_failed`.
- Use `leaseOwner` and `leaseExpiresAt` fields on `failed` delivery docs to avoid normal duplicate sends from overlapping runs.
- Increment attempts when reserving a provider send. On provider failure, keep `failed` if attempts remain or write `final_failed` on attempt 3.
- Never resend a `sent` recipient.
- Write `skipped` as terminal for missing user, missing email, or invalid email.
- Mark `eventReminderStates/{eventId}.state = 'complete'` only when every send-time recipient is terminal.
- Log scan, event, recipient, state transition, attempt count, reason, and provider message ID when available.
- Do not log email addresses, API keys, full email content, or host contact details.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: `sent` recipients are never resent.
- AC-T002.2: `failed` recipients retry while attempts are below 3.
- AC-T002.3: Attempt 3 provider failure records `final_failed`.
- AC-T002.4: Missing user, missing email, and invalid email record `skipped`.
- AC-T002.5: One recipient failure does not stop independent recipients.
- AC-T002.6: Event reminder state becomes `complete` only after every send-time UID is terminal.
- AC-T002.7: Resend request uses fixed platform sender from config and never host email.
- AC-T002.8: Logs and state do not contain recipient email addresses.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js` | Red before implementation for missing delivery behavior; green after implementation with helper and delivery tests passing. |
| `npm run lint:changed` | Exit 0, no lint errors in changed files. |
| `npm run type-check:changed` | Exit 0 or `No type errors in changed files.` |

Reviewer PASS criteria:

- Diff touches only owned files.
- Delivery state path is `eventReminderStates/{eventId}/deliveries/{uid}`.
- No emails are stored in Firestore reminder state or logs.
- Resend adapter uses HTTP `fetch` and does not add a dependency.
- Retry and terminal state behavior matches spec and tests.
- The accepted duplicate-send crash window is not over-engineered beyond the lease design.
- Verification commands are fresh and pass after implementation.

Reviewer REJECT criteria:

- Sent recipients can be resent.
- Host email is used or exposed as sender.
- Email addresses are copied into event, participant, reminder state, or logs.
- Firestore state is stored under client-writable event fields.
- New dependency, package, lockfile, rules, index, UI, or `src/**` changes appear.
- Verification is missing, stale, failed, or run against the wrong files.

Evidence:

- Engineer report: pending until dispatch.
- Reviewer report: pending until review.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: pending until coordinator commit.
- Rules deploy status: `not_applicable`.
- Incidents: none.

### T003 - Scheduled Wrapper And Functions Config

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Functions Scheduler Engineer
- **Reviewer**: Functions Scheduler Reviewer
- **Commit checkpoint**: implementation commit after Reviewer PASS and coordinator authorization.
- **Last verified commit**: none for this task.
- **Authorization boundary**: edit=no until implementation is explicitly authorized, commit=no for Engineer, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: `not_applicable`
- **Incidents**: none

Scope:

- Wire the scheduled Firebase Functions v2 wrapper in `functions/index.js`.
- Add a schedule wrapper test that mocks Firebase modules and verifies schedule, secrets, params, and delegation.

Non-scope:

- No changes to reminder core behavior except imports required by wrapper wiring.
- No dependency, package, lockfile, rules, index, UI, `src/**`, deploy, or secret value setup.

Owned files:

- `functions/index.js`
- `specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js`

Read-only context:

- `specs/event-reminder-email/spec.md`
- `specs/event-reminder-email/plan.md`
- `functions/event-reminder-email.js`
- `functions/index.js`
- `specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge-schedule.test.js`
- `firebase.json`
- `functions/package.json`

Dependencies:

- T002 `review_passed`.

Browser evidence:

- Not applicable. No UI change is allowed.

Engineer instructions:

- Use `superpowers:test-driven-development`.
- Write `specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js` before modifying `functions/index.js`.
- Mock `firebase-admin/app`, `firebase-admin/auth`, `firebase-admin/firestore`, `firebase-admin/storage`, `firebase-functions`, `firebase-functions/v2/scheduler`, `firebase-functions/params`, and `./event-reminder-email`.
- Add `defineSecret('RESEND_API_KEY')`, `defineString('REMINDER_EMAIL_FROM')`, and `defineString('PUBLIC_APP_BASE_URL')` in `functions/index.js`.
- Register `exports.sendEventReminderEmails` with `onSchedule({ schedule: 'every 15 minutes', timeZone: 'Asia/Taipei', secrets: [resendApiKey] }, handler)`.
- The handler must call the core with `{ firestore: db, logger, now: Timestamp.now(), runId, config }`.
- `config.fromEmail` must come from `REMINDER_EMAIL_FROM.value()`.
- `config.publicAppBaseUrl` must come from `PUBLIC_APP_BASE_URL.value()`.
- `config.resendApiKey` must come from `resendApiKey.value()`.
- Keep the wrapper thin. Business logic stays in `functions/event-reminder-email.js`.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: Scheduled function is exported as `sendEventReminderEmails`.
- AC-T003.2: Schedule is exactly `every 15 minutes` with `Asia/Taipei` timezone.
- AC-T003.3: Resend API key is configured as a Functions secret and passed to the core at runtime.
- AC-T003.4: Sender and public app base URL are read from Functions string params, not hardcoded.
- AC-T003.5: Existing scheduled functions remain exported and their schedule options are unchanged.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js` | Red before wrapper implementation; green after implementation with schedule and delegation tests passing. |
| `npx vitest run --project=browser specs/event-soft-delete-retention/tests/unit/functions/event-retention-purge-schedule.test.js` | Exit 0, existing scheduled retention wrapper tests still pass. |
| `npm run lint:changed` | Exit 0, no lint errors in changed files. |
| `npm run type-check:changed` | Exit 0 or `No type errors in changed files.` |

Reviewer PASS criteria:

- Diff touches only owned files.
- Wrapper remains thin and delegates to the core.
- Schedule, timezone, secret, string params, and config mapping match this contract.
- Existing scheduled exports are preserved.
- No secret values are committed.
- Verification commands are fresh and pass after implementation.

Reviewer REJECT criteria:

- API key, sender, or base URL is hardcoded.
- Host email can influence the sender.
- Business logic is implemented in `functions/index.js`.
- Existing scheduled functions are changed unintentionally.
- Package, lockfile, rules, index, UI, deploy, secret setup, or `src/**` changes appear.
- Verification is missing, stale, failed, or run against the wrong files.

Evidence:

- Engineer report: pending until dispatch.
- Reviewer report: pending until review.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: pending until coordinator commit.
- Rules deploy status: `not_applicable`.
- Incidents: none.

### T004 - Final Integration Verification And Workflow State Sync

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Final Verification / Workflow State Engineer
- **Reviewer**: Final Verification Reviewer
- **Commit checkpoint**: final evidence or implementation closeout commit only if workflow-state files intentionally change and coordinator has commit authorization.
- **Last verified commit**: none for this task.
- **Authorization boundary**: edit=no until implementation workflow-state sync is explicitly authorized, commit=no until coordinator authorizes a closeout commit, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: `not_applicable`
- **Incidents**: none

Scope:

- Run final local gates after T001, T002, and T003 have Reviewer PASS.
- Update `tasks.md`, `handoff.md`, and `status.json` with implementation evidence, task states, phase commits, head snapshots, and verification summaries.

Non-scope:

- No production source changes.
- No tests beyond evidence updates.
- No package, lockfile, rules, index, UI, deploy, secret setup, push, pull request, CI watch, merge, or local main sync.

Owned files:

- `specs/event-reminder-email/tasks.md`
- `specs/event-reminder-email/handoff.md`
- `specs/event-reminder-email/status.json`

Read-only context:

- `specs/event-reminder-email/spec.md`
- `specs/event-reminder-email/plan.md`
- `functions/event-reminder-email.js`
- `functions/index.js`
- `specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js`
- `specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js`
- `docs/superpowers/status.schema.json`
- `docs/superpowers/task-contract.md`
- `.codex/rules/sensors.md`

Dependencies:

- T001 `review_passed`.
- T002 `review_passed`.
- T003 `review_passed`.

Browser evidence:

- Not applicable. No UI change is allowed.

Engineer instructions:

- Confirm `tasks.md`, `handoff.md`, and `status.json` agree before editing workflow state.
- Run each final integration command as a separate command.
- Record command, exit code, concise signal, and timestamp in the workflow state files.
- Set completed task states only after Reviewer PASS is present for each implementation task.
- Keep `rulesDeployStatus.state` as `not_applicable` unless a separately approved rules plan changes `firestore.rules`.
- Keep deploy, push, pullRequest, ciWatch, merge, and localMainSync unauthorized unless the user explicitly expands the boundary.
- Modify only the owned files above.

Acceptance criteria:

- AC-T004.1: Final focused Vitest, lint, type-check, depcruise, workflow validation, workflow check, and whitespace gates have fresh evidence.
- AC-T004.2: Workflow state files agree on active task, active wave, completed tasks, latest reviewer decision, head snapshots, phase commits, last verification, rules deploy status, and incidents.
- AC-T004.3: Final state does not imply deployed Functions, configured secrets, deployed rules, push, pull request, CI watch, merge, or local main sync.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/event-reminder-email/tests/unit/functions/event-reminder-email.test.js specs/event-reminder-email/tests/unit/functions/event-reminder-email-schedule.test.js` | Exit 0, all reminder Functions tests pass. |
| `npm run lint:changed` | Exit 0, no lint errors in changed files. |
| `npm run type-check:changed` | Exit 0 or `No type errors in changed files.` |
| `npm run depcruise` | Exit 0, no dependency violations. |
| `node scripts/validate-workflow-state.js specs/event-reminder-email/status.json` | Exit 0, status schema is valid. |
| `node scripts/check-superpowers-state.js specs/event-reminder-email/status.json` | Exit 0, workflow companion files are synced. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned workflow-state files.
- Final evidence is fresh, command-oriented, and one command per entry.
- Workflow state files agree.
- No deployment or release boundary is crossed or implied.
- Rules deploy status remains accurate.

Reviewer REJECT criteria:

- Workflow state marks tasks completed without Reviewer PASS.
- Evidence is stale, missing, combined into shell chains, or inconsistent.
- Workflow files drift from each other.
- Final summary implies deployment, configured secrets, push, pull request, CI watch, merge, or local main sync without authorization.
- Diff touches non-owned files.

Evidence:

- Engineer report: pending until dispatch.
- Reviewer report: pending until review.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: pending until coordinator commit.
- Rules deploy status: `not_applicable`.
- Incidents: none.
