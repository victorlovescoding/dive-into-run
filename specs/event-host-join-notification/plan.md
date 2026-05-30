# Event Host Join Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development, or superpowers:executing-plans only if the coordinator explicitly chooses inline execution. Steps use checkbox syntax for tracking.

**Goal:** Notify an event host through the existing in-app Firestore notification system whenever a non-host user successfully creates a new participant record for the host's event.

**Architecture:** Keep the event join transaction unchanged and focused on participant plus event counter writes. Add host notification construction in the notification service/runtime layers, then call it best-effort from the two runtime join entrypoints only after `joinEvent` returns the newly joined status. Firestore rules gain a new allowlisted notification type, while deploy remains a separate release boundary.

**Tech Stack:** Next.js 15, React 19 hooks, JavaScript with JSDoc checkJs, Firebase v9 client SDK, Firestore rules-unit-testing, Vitest browser and server projects.

---

## Pre-Implementation Gate

The 078 worktree is currently on branch `078-event-host-join-notification` at `7de82865957fe600d0fa84b98709615eb4ea19f0`. It is ahead of the tracked baseline by one commit and behind `origin/main` at `0d974c3bc783f9785305c3e14a8886b720c0a52f` by two commits.

Before dispatching any Engineer with source, test, or rules owned files, the coordinator must run:

```bash
git status --short --branch --untracked-files=all
```

If that output still reports the branch as behind `origin/main`, source-edit dispatch is blocked. The coordinator must reconcile the branch with the latest `origin/main` using an explicitly authorized method, update `status.json` head snapshots, rerun the workflow state checks, and only then dispatch Task T1. This Planner did not rebase, merge, or otherwise reconcile the branch.

## Scope

In scope:

- Add one notification type named `event_host_joined`.
- Build the exact host-facing message `Actor Name 報名了你的活動「Event Title」`.
- Create a runtime notification use case that writes one notification to the event `hostUid`.
- Trigger the use case from both current join entrypoints after a newly created participant result.
- Preserve join success if notification creation fails.
- Add focused unit, hook, and Firestore rules tests.
- Track Firestore rules deploy as required later, not deployed in this implementation stage.

Out of scope:

- Email, push notifications, FCM, Cloud Functions, leave notifications, failed joins, full joins, already-joined joins, and rollback of a successful join.
- New dependencies, data migrations, new collections, notification delivery preferences, and UI redesign.
- Firestore rules deployment. The rules file may change in implementation, but deployment needs explicit later authorization and evidence.

## File Responsibilities

### Notification primitives

- Modify `src/service/notification-service.js`.
  - Extend `NotificationType` with `event_host_joined`.
  - Allow `buildNotificationMessage` to accept an optional `Actor` for actor-aware messages.
  - Add the `event_host_joined` message builder. It must use the actor display name when present and fall back to `有人` only when the actor name is empty.
  - Keep `buildNotificationDoc` shape unchanged.
- Modify `src/lib/notification-helpers.js`.
  - Extend only the facade typedef union with `event_host_joined`.
  - Keep canonical message implementation in `src/service/notification-service.js`.
  - Keep `getNotificationLink` behavior returning `/events/{entityId}` for this type.
- Create `src/service/notification-service.test.js`.
  - Cover the new message type and existing message compatibility.
- Create `src/lib/notification-helpers.test.js`.
  - Cover the host-join event link.

### Notification use case

- Modify `src/runtime/client/use-cases/notification-use-cases.js`.
  - Add `notifyEventHostJoined(eventId, eventTitle, hostUid, actor)`.
  - Skip when `hostUid` is empty.
  - Skip when `actor.uid` equals `hostUid`.
  - Throw only for missing actor uid, matching existing use-case guard style.
  - Use `addNotificationDocument`, `buildNotificationDoc`, `buildNotificationMessage`, and `serverTimestamp`.
  - Do not read event documents or participants from this use case.
- Create `src/runtime/client/use-cases/notification-use-cases.test.js`.
  - Mock the repo write and `serverTimestamp`.
  - Verify recipient, type, entity fields, actor fields, message, read state, and self-notification skip.

### Join entrypoints

- Modify `src/runtime/hooks/useEventDetailParticipation.js`.
  - Import `notifyEventHostJoined`.
  - After `joinEvent` returns `{ ok: true, status: 'joined' }`, call `notifyEventHostJoined(String(id), event.title || '', event.hostUid, payload)` without awaiting it.
  - Attach a `.catch` that logs `建立主揪報名通知失敗:` and does not show an error toast.
  - Do not call the notifier for `already_joined`, `full`, failed, leave, self-host, missing user, or missing payload paths.
- Modify `src/runtime/hooks/useEventParticipation.js`.
  - Apply the same behavior for list-page join flow with `eventId`, `event.title || ''`, `event.hostUid`, and the built payload.
- Create `src/runtime/hooks/useEventDetailParticipation.test.jsx`.
  - Mock `joinEvent`, participant reads, and `notifyEventHostJoined`.
  - Cover joined, already joined, full, failed, host self-join, and notification rejection paths.
- Create `src/runtime/hooks/useEventParticipation.test.jsx`.
  - Mock list membership reads, `joinEvent`, and `notifyEventHostJoined`.
  - Cover joined, already joined, full, failed, host self-join, and notification rejection paths.

### Firestore rules

- Modify `firestore.rules`.
  - Add `event_host_joined` to the notification `type in [...]` allowlist.
  - Preserve the existing create checks for signed-in actor, recipient not equal to actor, `actorUid` equal to auth uid, `read == false`, and `createdAt == request.time`.
  - Do not broaden read, update, or delete rules.
- Create `tests/server/firestore/notification-rules.test.js`.
  - Use `@firebase/rules-unit-testing`.
  - Prove `event_host_joined` creation succeeds for actor-to-host.
  - Prove self-notification, wrong actor uid, client timestamp, and `read: true` are rejected.
- Do not modify `firestore.indexes.json`; no new query shape is introduced.

### Workflow and final state

- Modify `specs/event-host-join-notification/tasks.md`, `handoff.md`, and `status.json` only when recording dispatch, review, verification, or closeout evidence.
- After `firestore.rules` changes, update `rulesDeployStatus.changed` to `true`, keep `rulesDeployStatus.state` as `required`, and keep `authorizationBoundary.deployFirestoreRules` as `false` until the user explicitly authorizes deploy.

## Data Flow

1. User clicks join on the event detail page or events list page.
2. The hook builds the existing user payload through `buildUserPayload`.
3. The hook calls `joinEvent`.
4. `joinEvent` runs `runEventParticipantTransaction` and `buildJoinEventPlan`.
5. `buildJoinEventPlan` returns `status: 'joined'` only when the participant did not already exist and seats remain.
6. The hook updates local joined state and participant counters exactly as it does now.
7. Only for `status: 'joined'`, the hook starts `notifyEventHostJoined` without awaiting it.
8. `notifyEventHostJoined` skips missing host uid and host self-notification.
9. `notifyEventHostJoined` writes one document to the top-level `notifications` collection with:
   - `recipientUid`: event `hostUid`
   - `type`: `event_host_joined`
   - `actorUid`: joining user uid
   - `entityType`: `event`
   - `entityId`: event id
   - `entityTitle`: event title
   - `commentId`: `null`
   - `message`: `Actor Name 報名了你的活動「Event Title」`
   - `read`: `false`
   - `createdAt`: Firestore server timestamp
10. Existing `NotificationProvider` listeners pick up the notification for the host, show the bell count, queue toast when the panel is closed, and route clicks through `getNotificationLink`.

## Implementation Details

### Notification type and message

Use the string `event_host_joined`. Do not reuse comment notification types.

Target service shape:

```js
/**
 * @typedef {'event_modified'|'event_cancelled'|'post_new_comment'|'post_comment_reply'|'event_host_comment'|'event_participant_comment'|'event_comment_reply'|'event_host_joined'} NotificationType
 */

const MESSAGE_BUILDERS = {
  event_host_joined: (title, actor) => `${actor?.name || '有人'} 報名了你的活動「${title}」`,
};

export function buildNotificationMessage(type, entityTitle, actor) {
  const builder = MESSAGE_BUILDERS[type];
  return builder(entityTitle, actor);
}
```

The final implementation must preserve all existing builders in the same object. Its JSDoc should describe `MESSAGE_BUILDERS` as a record keyed by `NotificationType`, with builder functions that receive `title` and optional `actor`. The snippet only shows the new type and signature shape.

### Runtime use case

Target use-case behavior:

```js
export async function notifyEventHostJoined(eventId, eventTitle, hostUid, actor) {
  if (!actor?.uid) {
    throw new Error('notifyEventHostJoined: actor is required');
  }

  if (!hostUid || actor.uid === hostUid) {
    return;
  }

  const message = buildNotificationMessage('event_host_joined', eventTitle, actor);
  await addNotificationDocument(
    buildNotificationDoc({
      recipientUid: hostUid,
      type: 'event_host_joined',
      entityType: 'event',
      entityId: eventId,
      entityTitle: eventTitle,
      commentId: null,
      message,
      actor,
      createdAtValue: serverTimestamp(),
    }),
  );
}
```

Do not put this in `src/lib`. `src/lib` remains a compatibility facade and helper surface.

### Hook integration

Target best-effort call shape:

```js
notifyEventHostJoined(String(id), event.title || '', event.hostUid, payload).catch((notifyError) => {
  console.error('建立主揪報名通知失敗:', notifyError);
});
```

Use `eventId` in the list hook. The call belongs inside the existing `result.status === 'joined'` branch after the join result has been validated. It must not be in `joinEvent`, `buildJoinEventPlan`, or `runEventParticipantTransaction`.

## Task Slices

All implementation slices are serialized. The shared notification type, rules surface, and workflow state make parallelism unnecessary risk for this feature.

```text
Gate G0: Branch reconciliation if still behind origin/main
T1: Notification type, message, and link primitives
T2: Host-join notification runtime use case
T3: Event detail and list join-entrypoint integration
T4: Firestore rules allowlist and rules tests
T5: Final integration verification and workflow state sync
```

Dependencies:

- T1 depends on G0.
- T2 depends on T1.
- T3 depends on T2.
- T4 depends on T1.
- T5 depends on T2, T3, and T4 Reviewer PASS.

## Testing Strategy

Use TDD for each implementation slice:

- Write the focused failing test first.
- Run the focused command and confirm the expected failure signal.
- Implement only the code needed for that slice.
- Rerun the focused command and confirm pass.
- Run changed lint and type-check before Reviewer dispatch.

Focused commands:

```bash
npx vitest run --project browser src/service/notification-service.test.js src/lib/notification-helpers.test.js
npx vitest run --project browser src/runtime/client/use-cases/notification-use-cases.test.js
npx vitest run --project browser src/runtime/hooks/useEventDetailParticipation.test.jsx src/runtime/hooks/useEventParticipation.test.jsx
firebase emulators:exec --only firestore --project demo-test "npx vitest run --project server tests/server/firestore/notification-rules.test.js"
npm run lint:changed
npm run type-check:changed
npm run depcruise
```

Browser evidence is not required because this feature adds no UI rendering or interaction changes. If an Engineer needs to touch UI files, they must stop and request a plan update that includes Browser verification.

## Risk Analysis

- Branch divergence: the branch is behind `origin/main`; source dispatch must wait for reconciliation if still behind.
- Duplicate notification risk: only `status: 'joined'` may notify. A retry after the participant exists should return `already_joined` and must not notify.
- Notification failure risk: the hook must not await the notification write and must not show an error toast for notification failure.
- Message compatibility risk: changing `buildNotificationMessage` must preserve all existing call sites that pass only type and title.
- Rules release risk: after `firestore.rules` changes, product behavior is not deployed until a separate rules deploy is authorized and evidenced.
- Hidden entrypoint risk: `rg -n "joinEvent\\(" src --glob '*.{js,jsx}'` currently shows only the two hooks plus the use-case export. If a new entrypoint appears after branch reconciliation, stop and update the plan before implementation.
- Facade risk: do not move canonical implementation into `src/lib`; only typedef and link helper compatibility belong there.

## Stop Conditions

Stop and return to the coordinator if any of these occurs:

- The branch still reports behind `origin/main` when source-edit dispatch is about to start.
- Implementation needs files outside the task's owned write set.
- A new dependency, schema migration, Cloud Function, email, push, FCM, or deploy step appears necessary.
- Existing join transaction behavior must be changed to make notification creation work.
- Tests require broad rewrites unrelated to join or notification behavior.
- Firestore rules deploy is requested while `authorizationBoundary.deployFirestoreRules` is false.
- Reviewer finds that `tasks.md`, `handoff.md`, and `status.json` disagree.

## Release and Rules Boundary

Changing `firestore.rules` is authorized for implementation only after user implementation authorization. Deploying those rules is not authorized by this plan.

Expected state after rules implementation but before deploy:

- `rulesDeployStatus.state`: `required`
- `rulesDeployStatus.required`: `true`
- `rulesDeployStatus.changed`: `true`
- `rulesDeployStatus.deployedCommit`: `null`
- `authorizationBoundary.deployFirestoreRules`: `false`

Final summaries, PR descriptions, and handoffs must say that rules deploy remains required and not evidenced. They must not claim deployed rules or deployed product behavior.

## Final Integration Gates

After all task Reviewers pass:

1. Verifier reruns focused browser tests for service, helper, use-case, and hooks.
2. Verifier reruns Firestore rules tests through the Firestore emulator.
3. Verifier runs changed lint and changed type-check.
4. Verifier runs `npm run depcruise`.
5. Coordinator runs workflow state validation and sync checks.
6. Coordinator confirms no non-owned files changed for each task lane.
7. Coordinator updates workflow state with exact command evidence.
8. Commit may proceed only because `authorizationBoundary.commit` is true and only after Reviewer PASS plus fresh verification.
9. Push, pull request, CI watch, merge, local main sync, and Firestore rules deploy remain unauthorized.
