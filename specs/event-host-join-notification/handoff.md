# Event Host Join Notification Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Feature slug: `event-host-join-notification`.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-078-event-host-join-notification`.
- Branch: `078-event-host-join-notification`.
- Current head before T3 implementation commit: `01e803132f2374c41df4efa51ba8c700d0810055` (`Record notification T3 dispatch`).
- Remote head: `a9ec0d5a2c839764823f274723b0b806123b3965` from local `origin/main`.
- Captured at: `2026-05-29T19:00:38Z`.
- Current branch state before T3 implementation commit: ahead 10 and behind `origin/main` by 0.
- Current dirty reviewed scope: modified `src/runtime/hooks/useEventDetailParticipation.js` and `src/runtime/hooks/useEventParticipation.js`; untracked `src/runtime/hooks/useEventDetailParticipation.test.jsx` and `src/runtime/hooks/useEventParticipation.test.jsx`.
- Profile: P4 new product feature.
- Current phase: implementation; T1, T2, and T3 completed, T3 reviewed PASS, and T3 implementation is ready for coordinator commit.
- Active task: T4.
- Active wave: 4.
- Latest reviewer decision: T3 `review_passed` by T3 Spec Reviewer and T3 Code Quality Reviewer.
- Last verified commit: `01e803132f2374c41df4efa51ba8c700d0810055`.
- Phase commits: spec commit `45d25c055f34828db904ffd1ec205873eb47004a`; plan commit `472bebc3fa05b8deaceee4388afe30304816401a`; post-second-rebase state commit `44c11ca0d033203d8afbbca969b70fdeae438371`; implementation authorization commit `866aac79599098916ba9359c4a50da06e5797b97`; T1 dispatch commit `759c4780b8a9d4234d094b9655be7f55f226b53f`; T1 implementation commit `468d9bd57846f00fa3bec966e88b4be1001375f1`; T2 dispatch commit `e1a15b05797b77e97200531eb1f8678ae352253a`; T2 implementation commit `98a54b38a0a3de78e0a9594a8a143a21fc0b632a`; T3 dispatch commit `01e803132f2374c41df4efa51ba8c700d0810055`.
- Rules deploy status: required later; not changed in Planner stage, not deployed, deploy authorized for the planned rules deploy step/release boundary.
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

Dispatch T4 Firestore Rules Allowlist and Rules Tests Engineer after coordinator pre-dispatch checks and T3 commit.

T1 is committed as `468d9bd57846f00fa3bec966e88b4be1001375f1`. T2 is committed as `98a54b38a0a3de78e0a9594a8a143a21fc0b632a`. T3 completed after Runtime Join Engineer plus T3 Spec Reviewer and T3 Code Quality Reviewer PASS, and is ready for coordinator commit. T4/T5 are not completed. Push, pull request, CI watch, merge, and local main sync remain unauthorized.

## Latest Verification

| Command | Exit | Signal |
| --- | ---: | --- |
| `npx vitest run --project browser src/runtime/hooks/useEventDetailParticipation.test.jsx src/runtime/hooks/useEventParticipation.test.jsx` | 0 | T3 focused browser Vitest passed: 2 files, 14 tests. |
| `npm run lint:changed` | 0 | Changed-file lint passed with only the existing React version warning. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `git status --short --branch --untracked-files=all` | 0 | Branch ahead 10 and behind 0; modified `src/runtime/hooks/useEventDetailParticipation.js` and `src/runtime/hooks/useEventParticipation.js`; untracked `src/runtime/hooks/useEventDetailParticipation.test.jsx` and `src/runtime/hooks/useEventParticipation.test.jsx`. |

## Closeout Checklist

- [x] `plan.md` defines technical approach, files, data flow, testing, risks, stop conditions, release boundary, and final gates.
- [x] `tasks.md` defines serialized task slices with dependency graph, owned files, read-only context, acceptance criteria, verification commands, browser evidence fields, Reviewer criteria, and authorization boundary.
- [x] `status.json` is schemaVersion 3 and records implementation-authorized state.
- [x] `authorizationBoundary.deployFirestoreRules` is true and separate from other boundaries.
- [x] `rulesDeployStatus.state` is `required`, `required` is true, and `changed` is false in Planner stage.
- [x] Reviewer reviews the plan-ready workflow files.
- [x] User authorizes implementation.
- [x] Coordinator reconciled branch with latest `origin/main`; branch gate is satisfied as of the `2026-05-29T17:29:29Z` post-second-rebase check.
- [x] Coordinator runs a fresh clean-state check and join-entrypoint search before T1 dispatch.
- [x] T1 Engineer and Reviewers completed T1.
- [x] T2 Engineer and Reviewers completed T2.
- [x] T3 Engineer and Reviewers completed T3.
- [ ] Engineer and Reviewer pairs execute T4 through T5.
- [ ] Verifier runs final integration gates.
- [ ] Coordinator commits only if still authorized after Reviewer PASS and fresh verification.
- [ ] Push, pull request, CI watch, merge, and local main sync remain blocked unless separately authorized.

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

## Blockers

- No current workflow-state blocker.
- T1 and T2 are committed. T3 is complete and ready for coordinator commit. T4 is next after coordinator pre-dispatch checks and T3 commit.

## Pitfalls

- Do not notify on `already_joined`, full, failed join, leave, or any result that is not a newly created participant.
- Do not notify when the actor uid equals the event `hostUid`.
- Do not let notification failure roll back a successful join or show a failure toast to the joining user.
- Do not place canonical implementation in `src/lib`.
- Do not claim Firestore rules or product behavior are deployed until `rulesDeployStatus.state` is `deployed` with evidence.
- Do not dispatch source-edit Engineers if the fresh pre-dispatch check shows the branch behind `origin/main`; reconcile before dispatch.
