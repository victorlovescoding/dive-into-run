# Event Host Join Notification Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Feature slug: `event-host-join-notification`.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-078-event-host-join-notification`.
- Branch: `078-event-host-join-notification`.
- Current HEAD: `04b4067e99d980bbce8bec1502582be96e6bebeb` (`Allow event host join notifications`).
- Remote head: `a9ec0d5a2c839764823f274723b0b806123b3965` from local `origin/main`.
- Captured at: `2026-05-29T19:26:37Z`.
- Current branch state before T5 state commit: `078-event-host-join-notification...origin/main [ahead 13]`; divergence `13 0` (ahead 13, behind 0).
- Current dirty reviewed scope: workflow state files only after T5 sync.
- Profile: P4 new product feature.
- Current phase: final verification complete; ready for coordinator T5 state commit, then authorized Firestore rules deploy.
- Active task: none; T5 is completed.
- Active wave: none.
- Latest reviewer decision: T5 `review_passed` by T5 Final Verification / Workflow State Engineer.
- Last verified commit: `04b4067e99d980bbce8bec1502582be96e6bebeb`.
- Phase commits: spec commit `45d25c055f34828db904ffd1ec205873eb47004a`; plan commit `472bebc3fa05b8deaceee4388afe30304816401a`; post-second-rebase state commit `44c11ca0d033203d8afbbca969b70fdeae438371`; implementation authorization commit `866aac79599098916ba9359c4a50da06e5797b97`; T1 dispatch commit `759c4780b8a9d4234d094b9655be7f55f226b53f`; T1 implementation commit `468d9bd57846f00fa3bec966e88b4be1001375f1`; T2 dispatch commit `e1a15b05797b77e97200531eb1f8678ae352253a`; T2 implementation commit `98a54b38a0a3de78e0a9594a8a143a21fc0b632a`; T3 dispatch commit `01e803132f2374c41df4efa51ba8c700d0810055`; T3 implementation commit `0b66da0088417d3bb6becdefeab76ef7c06c1fae`; T4 dispatch commit `e6ad1b4295c98a86eab7324a682dbca7fb75e941`; T4 implementation commit `04b4067e99d980bbce8bec1502582be96e6bebeb`.
- Rules deploy status: required and changed by T4; not deployed; deployed commit is null and evidence is empty; deploy authorized for the planned rules deploy step/release boundary.
- Incidents: none.
- Blocked: no.
- Blocked reason: none.

## Authorization Boundary

- edit: yes, implementation edits are authorized within dispatched task owned files.
- commit: yes, after Reviewer PASS and fresh verification; main agent will commit, not the Engineer.
- push: no.
- pullRequest: no.
- ciWatch: no.
- merge: no.
- localMainSync: no.
- deployFirestoreRules: yes, for the planned rules deploy step/release boundary after rules work is reviewed and verified.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `docs/superpowers/task-contract.md`
5. `.codex/references/subagent-roles.md`
6. `specs/event-host-join-notification/handoff.md`
7. `specs/event-host-join-notification/status.json`
8. `specs/event-host-join-notification/tasks.md`
9. `specs/event-host-join-notification/plan.md`
10. `specs/event-host-join-notification/spec.md`

## Next Action

Coordinator commits T5 workflow state, then runs the authorized Firestore rules deploy step and records deploy evidence.

T1 is committed as `468d9bd57846f00fa3bec966e88b4be1001375f1`. T2 is committed as `98a54b38a0a3de78e0a9594a8a143a21fc0b632a`. T3 is committed as `0b66da0088417d3bb6becdefeab76ef7c06c1fae`. T4 is committed as `04b4067e99d980bbce8bec1502582be96e6bebeb`. T5 is completed in workflow state but not yet committed. Push, pull request, CI watch, merge, and local main sync remain unauthorized. Firestore rules deploy is authorized as a separate next step but has not been run.

## Latest Verification

| Command | Exit | Signal |
| --- | ---: | --- |
| `npx vitest run --project browser src/service/notification-service.test.js src/lib/notification-helpers.test.js src/runtime/client/use-cases/notification-use-cases.test.js src/runtime/hooks/useEventDetailParticipation.test.jsx src/runtime/hooks/useEventParticipation.test.jsx` | 0 | Final browser Vitest integration suite passed: 5 files, 29 tests. |
| `firebase emulators:exec --only auth,firestore --project demo-test "npx vitest run --project server tests/server/firestore/notification-rules.test.js"` | 0 | Final auth+firestore emulator rules suite passed: 1 file, 5 tests. |
| `npm run lint:changed` | 0 | Changed-file lint exited 0; no changed JS files to lint. |
| `npm run type-check:changed` | 0 | Changed-file type check exited 0; no changed JS files to check. |
| `npm run depcruise` | 0 | No dependency violations found across 1293 modules and 3029 dependencies; existing `MODULE_TYPELESS_PACKAGE_JSON` warning emitted. |
| `node scripts/validate-workflow-state.js specs/event-host-join-notification/status.json` | 0 | `status.json` validated successfully. |
| `node scripts/check-superpowers-state.js specs/event-host-join-notification/status.json` | 0 | Workflow companion files are synced. |
| `git diff --check` | 0 | No whitespace errors. |
| `git status --short --branch --untracked-files=all` | 0 | Branch `078-event-host-join-notification...origin/main [ahead 13]`; only workflow state files modified after T5 sync. |

## Closeout Checklist

- [x] `plan.md` defines technical approach, files, data flow, testing, risks, stop conditions, release boundary, and final gates.
- [x] `tasks.md` defines serialized task slices with dependency graph, owned files, read-only context, acceptance criteria, verification commands, browser evidence fields, Reviewer criteria, and authorization boundary.
- [x] `status.json` is schemaVersion 3 and records implementation-authorized state.
- [x] `authorizationBoundary.deployFirestoreRules` is true and separate from other boundaries.
- [x] `rulesDeployStatus.state` is `required`, `required` is true, `changed` is true after T4, `deployedCommit` is null, and deploy evidence is empty.
- [x] Reviewer reviews the plan-ready workflow files.
- [x] User authorizes implementation.
- [x] Coordinator reconciled branch with latest `origin/main`; branch gate is satisfied as of the `2026-05-29T17:29:29Z` post-second-rebase check.
- [x] Coordinator runs a fresh clean-state check and join-entrypoint search before T1 dispatch.
- [x] T1 Engineer and Reviewers completed T1.
- [x] T2 Engineer and Reviewers completed T2.
- [x] T3 Engineer and Reviewers completed T3.
- [x] T4 Security Rules Engineer completes implementation and Reviewer PASS.
- [x] Engineer and Reviewer pairs execute T5.
- [x] Verifier runs final integration gates.
- [ ] Coordinator commits T5 state if still authorized after Reviewer PASS and fresh verification.
- [x] Push, pull request, CI watch, merge, and local main sync remain blocked unless separately authorized.

## T2 Completion Evidence

- Engineer changed only `src/runtime/client/use-cases/notification-use-cases.js` and `src/runtime/client/use-cases/notification-use-cases.test.js`.
- Added `notifyEventHostJoined` runtime use case.
- Behavior: trims host uid and actor uid; missing or blank host or actor uid skips no-write; normalized host/actor uid self-check skips self-notification; writes normalized `actorUid`; writes via `addNotificationDocument(buildNotificationDoc(...))`; uses `serverTimestamp()`.
- No hook integration, Firestore rules, participant reads, UI/package/workflow changes by Engineer.
- TDD RED: focused Vitest failed because `notifyEventHostJoined` was missing; after reviewer fix, new actor UID skip tests failed because blank UID wrote and empty/null/undefined UID threw.
- GREEN: `npx vitest run --project browser src/runtime/client/use-cases/notification-use-cases.test.js` exit 0, 1 file, 10 tests passed; `npm run lint:changed` exit 0 with only existing React version warning; `npm run type-check:changed` exit 0 with no changed-file type errors.
- Spec Reviewer decision: `review_passed`, no findings. Verified single `event_host_joined` host notification via existing helpers, actor fields, `entityType: event`, `commentId: null`, read false, skip self/missing host/blank actor uid, no T3/T4 scope creep.
- Code Quality Reviewer decision: `review_passed`, no blocking findings. Previous rejected issues fixed: blank actor uid no longer writes and JSDoc host uid contract permits null/undefined. Residual risk: blank actor name still fail-fast via T1 service helper, matching existing service tests and not a T2 blocker.

## T3 Completion Evidence

- Engineer changed only T3 owned files: `src/runtime/hooks/useEventDetailParticipation.js`, `src/runtime/hooks/useEventParticipation.js`, `src/runtime/hooks/useEventDetailParticipation.test.jsx`, and `src/runtime/hooks/useEventParticipation.test.jsx`.
- Behavior: detail and list join handlers call `notifyEventHostJoined(eventId, event.title || '', event.hostUid, payload)` only after `joinEvent` returns `ok: true` and `status: 'joined'`; no notify for `already_joined`, `full`, failed result, leave path, or host self-join; notification rejection is caught/logged with `console.error('建立主揪報名通知失敗:', error)` and remains non-blocking/invisible; local joined state/counters remain updated.
- RED: initial focused T3 test run failed with 4 failures because notifier calls and rejection log were missing. After the code-quality rejection fix, a new state assertion initially failed in the list rejection test because the test helper awaited membership lookup; the test helper was fixed, with product code unchanged in that fix.
- GREEN: `npx vitest run --project browser src/runtime/hooks/useEventDetailParticipation.test.jsx src/runtime/hooks/useEventParticipation.test.jsx` exit 0, 2 files, 14 tests passed; `npm run lint:changed` exit 0 with only existing React version warning; `npm run type-check:changed` exit 0 with no changed-file type errors.
- Spec Reviewer decision: `review_passed`, no blocking findings. Verified only hook/test files changed/untracked, notifier imported/called only inside joined branch for both entrypoints, leave paths have no notification call, tests cover success payload/already_joined/full/failed/leave/host self-join/rejection for both entrypoints; focused Vitest 14 passed; lint/type-check passed.
- Code Quality Reviewer decision: `review_passed`. Previous rejection fixed; leave handlers invoked and assert no notification; notification rejection tests assert local joined state remains updated; no remaining T3 quality blockers.

## T4 Completion Evidence

- Engineer changed only `firestore.rules` and `tests/server/firestore/notification-rules.test.js`.
- Behavior: added `event_host_joined` to the notification create type allowlist only; preserved signed-in actor, non-self recipient, `actorUid` auth uid, `read: false`, and `createdAt: request.time`; no read/update/delete broadening; no index/source/workflow/config/docs changes by Engineer; no deploy.
- Tests: valid actor-to-host create succeeds; self-notification rejects; wrong actor uid rejects; client timestamp rejects; `read: true` rejects.
- RED: `firebase emulators:exec --only auth,firestore --project demo-test "npx vitest run --project server tests/server/firestore/notification-rules.test.js"` exit 1; valid create failed `PERMISSION_DENIED` while 4 rejection tests passed.
- GREEN: same command exit 0, 1 file, 5 tests passed.
- `npm run lint:changed` exit 0 with only the existing React version warning.
- `npm run type-check:changed` exit 0 with no changed-file type errors.
- Spec Reviewer decision: `review_passed`, no findings. Verified only allowlist addition at `firestore.rules` around notification create type; full test covers valid create and required rejection cases; auth+firestore emulator command passed; original firestore-only command fails before tests due to harness env requirement; no deploy.
- Security/Code Quality Reviewer decision: `review_passed`, no blocking findings. Rules context keeps existing create constraints and read/update/delete unchanged; notification schema broader fields remain existing repo posture and are not broadened by T4; no deploy.
- Command correction: use `firebase emulators:exec --only auth,firestore --project demo-test "npx vitest run --project server tests/server/firestore/notification-rules.test.js"` for T4/T5. The original `--only firestore` form exits before tests load because the harness requires both `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`; that is not a product or rules failure.

## Blockers

- No current workflow-state blocker.
- T1, T2, T3, and T4 are committed. T5 is completed in workflow state but not yet committed. Firestore rules deploy remains required, authorized as a separate next step, and not yet run.

## Pitfalls

- Do not notify on `already_joined`, full, failed join, leave, or any result that is not a newly created participant.
- Do not notify when the actor uid equals the event `hostUid`.
- Do not let notification failure roll back a successful join or show a failure toast to the joining user.
- Do not place canonical implementation in `src/lib`.
- Do not claim Firestore rules or product behavior are deployed until `rulesDeployStatus.state` is `deployed` with evidence.
- Do not dispatch source-edit Engineers if the fresh pre-dispatch check shows the branch behind `origin/main`; reconcile before dispatch.
