# Event Host Join Notification Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/event-host-join-notification/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, this file, `status.json`, `handoff.md`, `spec.md`, and `plan.md` before dispatching implementation.
- Main agent is control plane only. Source, tests, rules, docs, workflow docs, scripts, and config edits go Engineer-first unless the main-agent workflow-state exception applies.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, pull request, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Verification evidence is one command per entry. Do not combine commands with shell chain operators.
- Firestore rules deploy is separate from edit, commit, push, pull request, CI watch, merge, and local main sync.
- Final summaries must not imply deployed Firestore rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Current State

- Feature slug: `event-host-join-notification`.
- Branch: `078-event-host-join-notification`.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-078-event-host-join-notification`.
- Profile: P4 new product feature.
- Current phase: implementation; T1 committed and T2 dispatched/in progress.
- Active task: T2.
- Active wave: 2.
- Current head: `468d9bd57846f00fa3bec966e88b4be1001375f1`.
- Remote head: `a9ec0d5a2c839764823f274723b0b806123b3965` from local `origin/main`.
- Captured at: `2026-05-29T18:09:21Z`.
- Current branch state: ahead 7 and behind `origin/main` by 0; branch was clean after the T1 commit and before this workflow-state sync.
- Phase commits: spec commit `45d25c055f34828db904ffd1ec205873eb47004a`; plan commit `472bebc3fa05b8deaceee4388afe30304816401a`; post-second-rebase state commit `44c11ca0d033203d8afbbca969b70fdeae438371`; implementation authorization commit `866aac79599098916ba9359c4a50da06e5797b97`; T1 dispatch commit `759c4780b8a9d4234d094b9655be7f55f226b53f`; T1 implementation commit `468d9bd57846f00fa3bec966e88b4be1001375f1`.
- Latest reviewer decision: T1 `review_passed` by T1 Spec and Code Quality Reviewers; T2 is dispatched and in progress.
- Latest branch-state sync: post-T1 commit sync used the fresh coordinator evidence below; active task is T2.
- Next action: wait for T2 Engineer report.

## Plan Review Evidence

- Decision: `review_passed`
- Reviewer: Plan Reviewer
- Decided at: `2026-05-29T16:45:00Z`
- Summary: Plan matches approved spec, uses serialized Engineer/Reviewer slices, includes branch reconciliation gate, and has no findings.
- Verification evidence: historical plan-review evidence has been superseded by the current post-second-rebase workflow sync evidence in `status.json.lastVerification` and `handoff.md` latest verification.

## Post-Second-Rebase Workflow State Sync Evidence

| Command | Exit | Signal |
| --- | ---: | --- |
| `git fetch origin main` | 0 | Fetched `origin/main` before the second rebase. |
| `git rebase origin/main` | 0 | Rebase onto `origin/main` succeeded. |
| `git status --short --branch --untracked-files=all` | 0 | Branch ahead 4 and behind 0; only workflow state files are modified after sync. |
| `git rev-list --left-right --count HEAD...origin/main` | 0 | `4 0`. |
| `git log --oneline --decorate --max-count=6 HEAD` | 0 | Top commits are `866aac7`, `44c11ca`, `472bebc`, `45d25c0`, then `origin/main` `a9ec0d5`. |
| `node scripts/validate-workflow-state.js specs/event-host-join-notification/status.json` | 0 | status valid. |
| `node scripts/check-superpowers-state.js specs/event-host-join-notification/status.json` | 0 | Workflow state synced. |
| `git diff --check` | 0 | No whitespace errors. |

## Authorization Boundary

- edit: yes, implementation edits are authorized within dispatched task owned files.
- commit: yes, after Reviewer PASS and fresh verification; main agent will commit, not the Engineer.
- push: no.
- pullRequest: no.
- ciWatch: no.
- merge: no.
- localMainSync: no.
- deployFirestoreRules: yes, for the planned rules deploy step/release boundary after rules work is reviewed and verified.

## Rules Release State

- Firestore rules work is required later for this feature.
- Current Planner stage has not changed `firestore.rules`.
- `rulesDeployStatus.state` remains `required`.
- `rulesDeployStatus.required` remains `true`.
- `rulesDeployStatus.changed` remains `false` until an implementation task actually changes `firestore.rules`.
- Firestore rules deploy is authorized for the planned rules deploy step/release boundary, but rules have not been changed or deployed yet.

## Pre-Implementation Gate G0

Before dispatching Task T1 or any task with source, test, or rules owned files, coordinator must run:

```bash
git status --short --branch --untracked-files=all
```

Expected signal before source dispatch: output must not report the branch as behind `origin/main` and must not show unreviewed non-workflow changes.

As of the `2026-05-29T17:38:51Z` pre-T1 dispatch check, the branch gate is satisfied: the branch is ahead 5 and behind `origin/main` by 0.

The required fresh clean-state check and join-entrypoint search were completed before T1 dispatch.

## Dependency Graph and Waves

- Wave 0: Gate G0, coordinator-owned, no source edits; branch gate satisfied as of `2026-05-29T17:38:51Z`, and the fresh clean-state check and join-entrypoint search completed before T1 dispatch.
- Wave 1: T1 notification type, message, and link primitives. Completed after Engineer plus spec and code-quality Reviewer PASS.
- Wave 2: T2 host-join notification use case.
- Wave 3: T3 join-entrypoint integration.
- Wave 4: T4 Firestore rules allowlist and rules tests.
- Wave 5: T5 final integration verification and workflow state sync.

All waves are serialized. T1 is foundational. T2 depends on T1. T3 depends on T2. T4 depends on T1. T5 depends on T2, T3, and T4 Reviewer PASS.

## Task T1: Notification Type, Message, and Link Primitives

- State: `completed`
- Attempt: 1
- Wave: 1
- Engineer: Notification Service Engineer
- Reviewer: Notification Service Reviewer
- Dependencies: Gate G0 branch state is satisfied as of `2026-05-29T17:38:51Z`; the fresh clean-state check and join-entrypoint search completed before dispatch.

### Dispatch Evidence

- `git status --short --branch --untracked-files=all` exit 0: branch `078-event-host-join-notification...origin/main [ahead 5]`, no modified files.
- `git rev-list --left-right --count HEAD...origin/main` exit 0: `5 0`.
- `rg -n "joinEvent\\(" src --glob '*.{js,jsx}'` exit 0: join entrypoints remain `src/runtime/client/use-cases/event-use-cases.js:114`, `src/runtime/hooks/useEventParticipation.js:236`, and `src/runtime/hooks/useEventDetailParticipation.js:155`.
- `node scripts/check-superpowers-state.js specs/event-host-join-notification/status.json` exit 0: workflow state synced before dispatch.

### Owned Files

- `src/service/notification-service.js`
- `src/lib/notification-helpers.js`
- `src/service/notification-service.test.js`
- `src/lib/notification-helpers.test.js`

### Read-Only Context

- `specs/event-host-join-notification/spec.md`
- `specs/event-host-join-notification/plan.md`
- `docs/decisions/ADR-001-six-layer-forward-only-architecture.md`
- `docs/decisions/ADR-002-lib-compatibility-facade.md`
- `src/runtime/client/use-cases/notification-use-cases.js`
- `src/components/Notifications/NotificationPanel.jsx`

### Scope

- Add `event_host_joined` to the canonical notification type union.
- Extend `buildNotificationMessage` with an optional actor argument.
- Build the exact host-join message with actor display name and event title.
- Keep all existing notification messages compatible.
- Extend the `src/lib/notification-helpers.js` typedef union.
- Add focused tests for message and event link behavior.

### Non-Scope

- No notification writes.
- No hook integration.
- No Firestore rules changes.
- No UI rendering changes.
- No `src/lib` canonical implementation.

### Engineer Steps

- [x] Write `src/service/notification-service.test.js` with these assertions:

```js
import { describe, expect, test } from 'vitest';
import { buildNotificationMessage } from './notification-service';

describe('notification service host join messages', () => {
  test('builds event_host_joined message with actor name and event title', () => {
    expect(
      buildNotificationMessage('event_host_joined', '週末晨跑', {
        uid: 'runner-1',
        name: '小明',
        photoURL: '',
      }),
    ).toBe('小明 報名了你的活動「週末晨跑」');
  });

  test('keeps existing event modified message compatible without actor', () => {
    expect(buildNotificationMessage('event_modified', '週末晨跑')).toBe(
      '你所參加的『週末晨跑』活動資訊有更動',
    );
  });
});
```

- [x] Write `src/lib/notification-helpers.test.js` with this assertion:

```js
import { describe, expect, test } from 'vitest';
import { getNotificationLink } from './notification-helpers';

describe('notification helper links', () => {
  test('links event_host_joined notifications to event detail', () => {
    expect(
      getNotificationLink({
        type: 'event_host_joined',
        entityId: 'event-1',
        commentId: null,
      }),
    ).toBe('/events/event-1');
  });
});
```

- [x] Run the focused tests and confirm the service test fails before implementation.
- [x] Update `src/service/notification-service.js`:
  - Add `event_host_joined` to the `NotificationType` typedef.
  - Change `MESSAGE_BUILDERS` type to accept optional actor.
  - Add `event_host_joined: (title, actor) => ...`.
  - Change `buildNotificationMessage(type, entityTitle, actor)` to pass actor to the selected builder.
- [x] Update `src/lib/notification-helpers.js` typedef union with `event_host_joined`.
- [x] Rerun focused tests until they pass.
- [x] Run changed lint and type-check.

### Verification

- `npx vitest run --project browser src/service/notification-service.test.js src/lib/notification-helpers.test.js`
  - Expected before implementation: fails because `event_host_joined` has no message builder.
  - Expected after implementation: pass.
- `npm run lint:changed`
  - Expected after implementation: pass with no lint errors in changed files.
- `npm run type-check:changed`
  - Expected after implementation: pass or report no changed-file type errors.

### Browser Evidence

Not applicable. No UI rendering changes are allowed in this task.

### Completion Evidence

- Engineer report: Notification Service Engineer completed T1 inside owned files, adding `event_host_joined` notification primitives, optional actor message support, helper typedef/link coverage, and focused tests while preserving existing message compatibility.
- Spec review: PASS after fix.
- Code-quality review: initial rejection for fail-fast actor handling; Engineer fix accepted; re-review PASS.

| Command | Exit | Signal |
| --- | ---: | --- |
| `npx vitest run --project browser src/service/notification-service.test.js src/lib/notification-helpers.test.js` | 0 | T1 focused browser Vitest passed: 2 files, 5 tests. |
| `npm run lint:changed` | 0 | Changed-file lint passed with only the existing React version warning. |
| `npm run type-check:changed` | 0 | `No type errors in changed files.` |
| `git status --short --branch --untracked-files=all` | 0 | Branch `078-event-host-join-notification...origin/main [ahead 6]`; only T1 owned source/test files were changed or untracked before workflow-state sync. |
| `git diff --name-status` | 0 | Tracked diff contained only modified `src/lib/notification-helpers.js` and `src/service/notification-service.js`; T1 tests were untracked. |
| `git ls-files --others --exclude-standard` | 0 | Untracked files were `src/lib/notification-helpers.test.js` and `src/service/notification-service.test.js`. |

Changed files summary:

- Modified `src/service/notification-service.js`.
- Modified `src/lib/notification-helpers.js`.
- Added untracked `src/service/notification-service.test.js`.
- Added untracked `src/lib/notification-helpers.test.js`.
- No source or test files outside the T1 owned file set were reported by fresh coordinator status.

Residual risk: T1 only provides notification type, message, link primitives, and focused tests. Runtime notification write integration, join entrypoint integration, and Firestore rules coverage remain in T2 through T4.

### Reviewer PASS Criteria

- Diff touches only owned files.
- `event_host_joined` is canonical in `src/service/notification-service.js`.
- Existing notification messages still work without an actor parameter.
- `src/lib/notification-helpers.js` remains a facade/helper and does not own canonical message logic.
- Verification commands have fresh exit code 0 evidence.

### Reviewer REJECT Criteria

- Existing message formats change.
- Actor name is omitted from the new message when provided.
- The implementation moves canonical logic into `src/lib`.
- Verification is missing, stale, or run against the wrong files.

## Task T2: Host-Join Notification Runtime Use Case

- State: `in_progress`
- Attempt: 1
- Wave: 2
- Engineer: Notification Runtime Engineer
- Reviewer: Notification Runtime Reviewer
- Dependencies: T1 `review_passed`.

### Dispatch Evidence

- `git status --short --branch --untracked-files=all` exit 0: branch `078-event-host-join-notification...origin/main [ahead 7]`, no modified or untracked files after the T1 commit and before this workflow-state sync.
- `git rev-list --left-right --count HEAD...origin/main` exit 0: `7 0`.
- `node scripts/check-superpowers-state.js specs/event-host-join-notification/status.json` exit 0: workflow state synced before this T2 dispatch-state update.
- Dependency satisfied: T1 is completed, committed as `468d9bd57846f00fa3bec966e88b4be1001375f1`, and remains `review_passed`.

### Owned Files

- `src/runtime/client/use-cases/notification-use-cases.js`
- `src/runtime/client/use-cases/notification-use-cases.test.js`

### Read-Only Context

- `src/service/notification-service.js`
- `src/repo/client/firebase-notifications-repo.js`
- `src/runtime/client/use-cases/event-use-cases.js`
- `specs/event-host-join-notification/spec.md`
- `specs/event-host-join-notification/plan.md`

### Scope

- Add `notifyEventHostJoined(eventId, eventTitle, hostUid, actor)`.
- Write one notification to the host.
- Skip host self-notification.
- Use `serverTimestamp` for createdAt.
- Keep notification creation independent from event join transactions.

### Non-Scope

- No hook integration.
- No Firestore rules changes.
- No participant reads.
- No batch writes.
- No UI changes.

### Engineer Steps

- [ ] Write `src/runtime/client/use-cases/notification-use-cases.test.js` that mocks `@/repo/client/firebase-notifications-repo`, `firebase/firestore`, and imports `notifyEventHostJoined`.
- [ ] Include this write test:

```js
test('writes one event_host_joined notification to the event host', async () => {
  await notifyEventHostJoined('event-1', '週末晨跑', 'host-1', {
    uid: 'runner-1',
    name: '小明',
    photoURL: 'avatar.png',
  });

  expect(addNotificationDocumentMock).toHaveBeenCalledWith({
    recipientUid: 'host-1',
    type: 'event_host_joined',
    actorUid: 'runner-1',
    actorName: '小明',
    actorPhotoURL: 'avatar.png',
    entityType: 'event',
    entityId: 'event-1',
    entityTitle: '週末晨跑',
    commentId: null,
    message: '小明 報名了你的活動「週末晨跑」',
    read: false,
    createdAt: serverTimestampValue,
  });
});
```

- [ ] Include self-notification and missing host skip tests.
- [ ] Run the focused test and confirm it fails before implementation because the export is missing.
- [ ] Implement `notifyEventHostJoined` in `src/runtime/client/use-cases/notification-use-cases.js`.
- [ ] Rerun focused tests until they pass.
- [ ] Run changed lint and type-check.

### Verification

- `npx vitest run --project browser src/runtime/client/use-cases/notification-use-cases.test.js`
  - Expected before implementation: fails because `notifyEventHostJoined` is not exported.
  - Expected after implementation: pass.
- `npm run lint:changed`
  - Expected after implementation: pass with no lint errors in changed files.
- `npm run type-check:changed`
  - Expected after implementation: pass or report no changed-file type errors.

### Browser Evidence

Not applicable. No UI rendering changes are allowed in this task.

### Reviewer PASS Criteria

- Diff touches only owned files.
- Use case writes through `addNotificationDocument`.
- Use case skips actor uid equal to host uid.
- Use case does not fetch participants or event data.
- Verification commands have fresh exit code 0 evidence.

### Reviewer REJECT Criteria

- Notification write is placed inside event join transaction code.
- Self-notification can be written.
- Created timestamp is client time instead of `serverTimestamp`.
- Missing host uid creates an invalid notification.

## Task T3: Join Entrypoint Integration

- State: `todo`
- Attempt: 1
- Wave: 3
- Engineer: Runtime Join Engineer
- Reviewer: Runtime Join Reviewer
- Dependencies: T2 `review_passed`.

### Owned Files

- `src/runtime/hooks/useEventDetailParticipation.js`
- `src/runtime/hooks/useEventParticipation.js`
- `src/runtime/hooks/useEventDetailParticipation.test.jsx`
- `src/runtime/hooks/useEventParticipation.test.jsx`

### Read-Only Context

- `src/runtime/client/use-cases/event-use-cases.js`
- `src/runtime/client/use-cases/notification-use-cases.js`
- `src/service/event-service.js`
- `src/ui/events/EventDetailScreen.jsx`
- `src/ui/events/EventsPageScreen.jsx`
- `specs/event-host-join-notification/spec.md`
- `specs/event-host-join-notification/plan.md`

### Scope

- Trigger host notification only after `joinEvent` returns `ok: true` and `status: 'joined'`.
- Cover event detail and events list join handlers.
- Keep notification failure non-blocking and invisible to the joining user.
- Preserve all existing join, already joined, full, failed, and leave behavior.

### Non-Scope

- No service transaction changes.
- No repo changes.
- No notification use-case changes.
- No Firestore rules changes.
- No UI component changes.

### Engineer Steps

- [ ] Write `src/runtime/hooks/useEventDetailParticipation.test.jsx` with mocked event use cases and notification use case.
- [ ] Include a detail success test that calls `handleJoin` and expects:
  - `joinEvent` called with event id and user payload.
  - `notifyEventHostJoined` called once with event id, title, host uid, and actor payload.
  - `showToast` called with `報名成功`.
- [ ] Include detail negative tests for `already_joined`, `full`, failed result, host self-join, and rejected notification promise.
- [ ] Write `src/runtime/hooks/useEventParticipation.test.jsx` with the same outcome matrix for `handleJoinClick`.
- [ ] Run the focused hook tests and confirm they fail before implementation because notifier calls are missing.
- [ ] Import `notifyEventHostJoined` in both hooks.
- [ ] In each `status === 'joined'` branch, call the notifier without awaiting it and attach `.catch`.
- [ ] Confirm `already_joined` still sets joined state and success toast without notifying.
- [ ] Confirm rejected notification write logs to `console.error` and does not create an error toast.
- [ ] Rerun focused hook tests until they pass.
- [ ] Run changed lint and type-check.

### Verification

- `npx vitest run --project browser src/runtime/hooks/useEventDetailParticipation.test.jsx src/runtime/hooks/useEventParticipation.test.jsx`
  - Expected before implementation: fails because joined paths do not call `notifyEventHostJoined`.
  - Expected after implementation: pass.
- `npm run lint:changed`
  - Expected after implementation: pass with no lint errors in changed files.
- `npm run type-check:changed`
  - Expected after implementation: pass or report no changed-file type errors.

### Browser Evidence

Not applicable. Hook behavior is covered by Vitest. If an Engineer modifies UI files, stop and request a plan update with Browser evidence.

### Reviewer PASS Criteria

- Diff touches only owned files.
- Both current join entrypoints notify only for newly created participants.
- Notification promise rejection cannot change join success state or toast.
- No leave, full, already-joined, self-host, or failed path notifies.
- Verification commands have fresh exit code 0 evidence.

### Reviewer REJECT Criteria

- Notification is awaited in a way that delays or blocks join success.
- Notification failure shows a user-facing error toast to the joining user.
- A non-new join outcome notifies the host.
- Existing local participant or counter updates regress.

## Task T4: Firestore Rules Allowlist and Rules Tests

- State: `todo`
- Attempt: 1
- Wave: 4
- Engineer: Security Rules Engineer
- Reviewer: Security Rules Reviewer
- Dependencies: T1 `review_passed`.

### Owned Files

- `firestore.rules`
- `tests/server/firestore/notification-rules.test.js`

### Read-Only Context

- `tests/server/firestore/post-soft-delete-rules.test.js`
- `firestore.indexes.json`
- `src/runtime/client/use-cases/notification-use-cases.js`
- `specs/014-notification-system/data-model.md`
- `specs/015-comment-notifications/data-model.md`
- `specs/event-host-join-notification/spec.md`
- `specs/event-host-join-notification/plan.md`

### Scope

- Add `event_host_joined` to the notification create type allowlist.
- Prove allowed create for actor-to-host.
- Prove rejection for self-notification, wrong actor uid, wrong timestamp, and invalid read state.

### Non-Scope

- No source code changes.
- No index changes.
- No rules deploy.
- No broad notification schema rewrite.

### Engineer Steps

- [ ] Create `tests/server/firestore/notification-rules.test.js` using the existing rules test environment style.
- [ ] Add a valid payload helper:

```js
function hostJoinNotificationPayload(overrides = {}) {
  return {
    recipientUid: 'host-1',
    type: 'event_host_joined',
    actorUid: 'runner-1',
    actorName: '小明',
    actorPhotoURL: '',
    entityType: 'event',
    entityId: 'event-1',
    entityTitle: '週末晨跑',
    commentId: null,
    message: '小明 報名了你的活動「週末晨跑」',
    read: false,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}
```

- [ ] Add tests with `assertSucceeds` and `assertFails` for the required cases.
- [ ] Run the rules test and confirm it fails before implementation because `event_host_joined` is not allowlisted.
- [ ] Modify only the notification type allowlist in `firestore.rules`.
- [ ] Rerun the rules test through the Firestore emulator until it passes.
- [ ] Run changed lint and type-check.

### Verification

- `firebase emulators:exec --only firestore --project demo-test "npx vitest run --project server tests/server/firestore/notification-rules.test.js"`
  - Expected before implementation: valid host join notification create is rejected by type allowlist.
  - Expected after implementation: pass.
- `npm run lint:changed`
  - Expected after implementation: pass with no lint errors in changed files.
- `npm run type-check:changed`
  - Expected after implementation: pass or report no changed-file type errors.

### Browser Evidence

Not applicable. This is a rules-only task.

### Reviewer PASS Criteria

- Diff touches only owned files.
- Only the new notification type is added to the allowlist.
- Existing self-notification, actor uid, timestamp, and read-state constraints remain enforced.
- No rules deploy command was run.
- Verification commands have fresh exit code 0 evidence.

### Reviewer REJECT Criteria

- Rules broaden read, update, or delete access.
- Tests do not cover all required rejection cases.
- The implementation edits `firestore.indexes.json` without a proven query need.
- The task claims rules are deployed.

## Task T5: Final Integration Verification and Workflow State Sync

- State: `todo`
- Attempt: 1
- Wave: 5
- Engineer: Workflow State Engineer
- Reviewer: Workflow State Reviewer
- Dependencies: T2 `review_passed`, T3 `review_passed`, and T4 `review_passed`.

### Owned Files

- `specs/event-host-join-notification/tasks.md`
- `specs/event-host-join-notification/handoff.md`
- `specs/event-host-join-notification/status.json`

### Read-Only Context

- Task-local diffs from T1, T2, T3, and T4.
- Exact Engineer and Reviewer reports from T1, T2, T3, and T4.
- `docs/superpowers/task-contract.md`
- `docs/superpowers/status.schema.json`
- `.codex/references/subagent-roles.md`

### Scope

- Record completed task evidence after Reviewer PASS.
- Record fresh final verification evidence.
- Set `rulesDeployStatus.changed` to `true` if `firestore.rules` changed.
- Keep `rulesDeployStatus.state` as `required`.
- Keep deploy authorization recorded as true, without deploying Firestore rules in T5.
- Prepare coordinator for an authorized commit and the planned rules deploy boundary.

### Non-Scope

- No source changes.
- No rules changes.
- No commit by Engineer.
- No push, pull request, CI watch, merge, local main sync, or Firestore rules deploy.

### Engineer Steps

- [ ] Confirm T1 through T4 are `review_passed`.
- [ ] Run every final verification command listed below.
- [ ] Update workflow state files with exact command, exit code, and expected signal summaries.
- [ ] Update `rulesDeployStatus.changed` to match whether `firestore.rules` is in the reviewed diff.
- [ ] Keep `authorizationBoundary.deployFirestoreRules` true while leaving `rulesDeployStatus.state` as `required` until deployment evidence exists.
- [ ] Keep next action as coordinator review, user review, and commit boundary if still authorized.

### Verification

- `npx vitest run --project browser src/service/notification-service.test.js src/lib/notification-helpers.test.js src/runtime/client/use-cases/notification-use-cases.test.js src/runtime/hooks/useEventDetailParticipation.test.jsx src/runtime/hooks/useEventParticipation.test.jsx`
  - Expected: pass.
- `firebase emulators:exec --only firestore --project demo-test "npx vitest run --project server tests/server/firestore/notification-rules.test.js"`
  - Expected: pass.
- `npm run lint:changed`
  - Expected: pass with no lint errors in changed files.
- `npm run type-check:changed`
  - Expected: pass or report no changed-file type errors.
- `npm run depcruise`
  - Expected: pass with no forbidden layer dependency.
- `node scripts/validate-workflow-state.js specs/event-host-join-notification/status.json`
  - Expected: validates schemaVersion 3.
- `node scripts/check-superpowers-state.js specs/event-host-join-notification/status.json`
  - Expected: workflow companion files are synced.
- `git diff --check`
  - Expected: no whitespace errors.
- `git status --short --branch --untracked-files=all`
  - Expected: branch state and changed files match the reviewed scope.

### Browser Evidence

Not applicable unless UI files were modified after an approved plan update.

### Reviewer PASS Criteria

- Workflow state matches reviewed task outcomes.
- Rules deploy state is explicit and does not claim deployed rules.
- Final verification evidence is fresh and one command per entry.
- No unauthorized release boundary was crossed.

### Reviewer REJECT Criteria

- Workflow files drift from status.
- Rules deploy status claims deployed without evidence.
- Final verification is incomplete.
- Changed files include unreviewed or non-owned files.

## Final Closeout Boundary

After T5 Reviewer PASS and coordinator verification, the current authorization permits commit and the planned Firestore rules deploy step. It does not permit push, pull request creation, CI watch, merge, or local main sync.
