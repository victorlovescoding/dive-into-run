# 027 — tests mock cleanup tasks queue

> Source: `specs/027-tests-mock-cleanup/plan.md`
> Handoff: `specs/027-tests-mock-cleanup/handoff.md`
> Scope: planning queue only. Execution sessions will modify tests / lint baselines, but this file only records the ordered work plan.

---

## 0. Execution contract

### 0.1 Session order

Sessions are merged in this exact order because the baseline counts in `eslint.config.mjs` are serialized:

`S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7`

Workers may inspect later-session files early, but later sessions must not land baseline edits before their turn. If multiple worktrees are used, keep `eslint.config.mjs`, PR template, and `handoff.md` consolidation edits owned by the active session only.

### 0.2 Engineer + Reviewer gate

Every task below uses this gate. A task is not done until the Reviewer signs off.

1. Engineer writes a short task mini-plan: files, current illegal `vi.mock('@/...')` calls, intended SDK boundary mock, expected baseline block, verification commands, and any Option A risk.
2. Reviewer checks the split before edits: dependency order, whether files can run in parallel, whether the task would touch shared files, whether it violates no-`src/` and no-inline-disable constraints.
3. If Reviewer rejects the split, Engineer revises the mini-plan before implementation.
4. Engineer implements only the approved task scope.
5. Reviewer checks diff + verification evidence: no illegal boundary mock remains for the task files, baseline removal matches the block, no unrelated files changed, and `handoff.md` was updated when a reusable pattern or risk was found.
6. If Reviewer finds an issue, task returns to Engineer until accepted.

### 0.3 Parallelism rules

- `Sequential` means the task must finish before the next task starts.
- `Parallel batch` means listed Engineer/Reviewer pairs can work at the same time after the session preflight gate passes.
- Baseline removal is always a final sequential consolidation task inside each session to avoid multiple pairs editing the same `eslint.config.mjs` block.
- If a file is flagged Option A, stop that file, record it in `handoff.md` §6, and continue only with unaffected files.

### 0.4 Common per-file checklist

- Inventory all `vi.mock('@/...')` calls and classify illegal vs allowed boundary mocks.
- Move behavior control from internal module mocks to SDK / external boundary mocks.
- Keep allowed mocks: `@/config/*`, `@/runtime/providers/*`, `@/contexts/*`, `@/data/*`, Next.js, Firebase SDK/Admin SDK, Leaflet, browser APIs, external fetch.
- Run `npx vitest run <file>` and `npx eslint <file>`.
- After the file passes, record the pending baseline removal for the session consolidation owner; parallel batch workers must not edit `eslint.config.mjs`.
- If same-file flaky violations remain, either fix them in scope or record the pending flaky-baseline move for consolidation according to `plan.md` §6.

---

## 1. Session queue overview

| Session | Dependency | Pair count | Parallel plan | Baseline target |
| ------- | ---------- | ---------- | ------------- | --------------- |
| S0 | none | 1 pair | Sequential only | 18.6: 47 -> 55 / 18.7: 0 -> 14 / 18.8: 0 -> 5 |
| S1 | S0 | 1 pair | Sequential pilot | 18.6: 55 -> 50 |
| S2 | S1 | 4 pairs | Parallel file batches, sequential consolidation | 18.6: 50 -> 36 |
| S3 | S2 | 4 pairs | Parallel notification batches after shared preflight | 18.6: 36 -> 27 |
| S4 | S3 | 2 pairs | Events and profile parallel, sequential consolidation | 18.6: 27 -> 21 |
| S5 | S4 | 3 pairs | Toast, weather, Strava parallel, sequential consolidation | 18.6: 21 -> 11 |
| S6 | S5 | 2 pairs | Unit/lib notification batches parallel, sequential consolidation | 18.8: 5 -> 0 |
| S7 | S6 | 3 pairs | Runtime, API, service/repo parallel, sequential consolidation | 18.7: 14 -> 0 |

---

## 2. S0 — ESLint rule expansion + baseline collection

**Dependency**: none.
**Pairing**: 1 Engineer + 1 Reviewer.
**Parallelism**: Sequential only. This touches shared lint rules and defines the baseline for every later session.

- [ ] **S0.1 Rule selector fix**
  - Engineer: update block 18.6 selector from `@/(repo|service|runtime)/` to include `@/lib`, and exclude `@/runtime/providers/*` from illegal mock targeting.
  - Reviewer: verify selector behavior is real, providers are not treated as violations, and no unrelated lint rule semantics changed.

- [ ] **S0.2 Integration baseline expansion**
  - Engineer: add the 8 newly exposed integration files to block 18.6 ignores:
    - `tests/integration/posts/PostCard.test.jsx`
    - `tests/integration/dashboard/DashboardCommentCard.test.jsx`
    - `tests/integration/dashboard/DashboardEventCard.test.jsx`
    - `tests/integration/dashboard/DashboardPostCard.test.jsx`
    - `tests/integration/navbar/Navbar.test.jsx`
    - `tests/integration/navbar/isActivePath.test.js`
    - `tests/integration/strava/RunsRouteMap.test.jsx`
    - `tests/integration/strava/RunsActivityCard.test.jsx`
  - Reviewer: confirm block 18.6 becomes 55 files and still represents `tests/integration/**` only.

- [ ] **S0.3 Add unit baseline blocks**
  - Engineer: add block 18.7 for `tests/unit/{runtime,api,service,repo}/**` with 14 baseline files, and block 18.8 for `tests/unit/lib/**` with 5 baseline files.
  - Reviewer: confirm files globs do not overlap incorrectly and the rule message points to the mock-boundary cleanup.

- [ ] **S0.4 Audit script and PR template**
  - Engineer: update `scripts/audit-mock-boundary.sh` from `tests/integration` to full `tests`, and update PR template baseline tracking text for blocks 18.6/18.7/18.8.
  - Reviewer: confirm audit still excludes allowed providers and tracks all four batches plus scattered unit service/repo files.

- [ ] **S0.5 Verification and handoff**
  - Engineer: run `npm run lint` and a safe smoke probe that proves a baseline-outside illegal mock is blocked, then revert the probe.
  - Reviewer: verify smoke probe was reverted, baseline counts match plan, and `handoff.md` has any selector/baseline gotchas.

---

## 3. S1 — posts heavy pilot

**Dependency**: S0 complete.
**Pairing**: 1 Engineer + 1 Reviewer.
**Parallelism**: Sequential pilot. Later sessions depend on the setup pattern this session records.
**Baseline**: block 18.6 `55 -> 50`.

- [ ] **S1.1 Pilot mini-plan and risk review**
  - Files:
    - `tests/integration/posts/PostDetail.test.jsx`
    - `tests/integration/posts/PostDetailClient-delete-race.test.jsx`
    - `tests/integration/posts/post-edit-validation.test.jsx`
    - `tests/integration/posts/post-detail-edit-dirty.test.jsx`
    - `tests/integration/posts/post-comment-reply.test.jsx`
  - Engineer: inventory all 10 violations and identify whether `PostDetailClient-delete-race` can use SDK stubs or must be flagged Option A.
  - Reviewer: approve the order. If the race file needs Option A, split it out before edits.

- [ ] **S1.2 Implement pilot files**
  - Engineer: convert the approved files from internal mocks to Firebase SDK boundary mocks.
  - Reviewer: check each file’s real use-case/service/repo path now executes instead of being mocked.

- [ ] **S1.3 Pilot verification and baseline consolidation**
  - Engineer: run single-file Vitest + ESLint for all S1 files, remove successful files from block 18.6, then run session-level lint/type/test commands required by `handoff.md`.
  - Reviewer: verify block 18.6 count is `50` unless an Option A file was moved out with explicit handoff notes.

- [ ] **S1.4 Setup pattern handoff**
  - Engineer: fill `handoff.md` §2 with reusable `firebase/firestore` mock export list, document stubs, transaction/batch stubs, and Option A criteria discovered during pilot.
  - Reviewer: confirm S2-S7 can reuse the pattern without rereading S1 diffs.

---

## 4. S2 — posts rest + comments + dashboard + navbar

**Dependency**: S1 complete and `handoff.md` §2 has a usable setup pattern.
**Pairing**: 4 Engineer/Reviewer pairs.
**Parallelism**: Parallel batches S2.A-S2.D; baseline consolidation sequential.
**Baseline**: block 18.6 `50 -> 36`.

- [ ] **S2.0 Session preflight gate**
  - Engineer lead: confirm S1 pattern applies and no S2 file is already changed by another worktree.
  - Reviewer lead: approve the four-way split and confirm only consolidation edits shared files.

- [ ] **S2.A Parallel batch — posts rest**
  - Files:
    - `tests/integration/posts/PostFeed.test.jsx`
    - `tests/integration/posts/posts-page-edit-dirty.test.jsx`
    - `tests/integration/posts/post-form-validation.test.jsx`
    - `tests/integration/posts/PostCard.test.jsx`
  - Scope: 4 files / 4 violations.
  - Reviewer focus: PostCard is a newly exposed baseline file from S0.

- [ ] **S2.B Parallel batch — comments**
  - Files:
    - `tests/integration/comments/event-comment-notification.test.jsx`
    - `tests/integration/comments/CommentSection.test.jsx`
  - Scope: 2 files / 3 violations.
  - Reviewer focus: notification side effects do not get replaced with internal helper mocks.

- [ ] **S2.C Parallel batch — dashboard**
  - Files:
    - `tests/integration/dashboard/DashboardTabs.test.jsx`
    - `tests/integration/dashboard/DashboardCommentCard.test.jsx`
    - `tests/integration/dashboard/DashboardEventCard.test.jsx`
    - `tests/integration/dashboard/DashboardPostCard.test.jsx`
  - Scope: 4 files / 4 violations.
  - Reviewer focus: the three card files are S0 newly exposed baseline files.

- [ ] **S2.D Parallel batch — navbar**
  - Files:
    - `tests/integration/navbar/Navbar.test.jsx`
    - `tests/integration/navbar/NavbarMobile.test.jsx`
    - `tests/integration/navbar/NavbarDesktop.test.jsx`
    - `tests/integration/navbar/isActivePath.test.js`
  - Scope: 4 files / 4 violations.
  - Reviewer focus: `NavbarMobile` / `NavbarDesktop` may also overlap flaky baseline behavior.

- [ ] **S2.E Sequential consolidation**
  - Engineer lead: remove the 14 successful files from block 18.6 and run session verification.
  - Reviewer lead: confirm block 18.6 count is `36`, no S2 worker edited shared baselines directly, and handoff records any reusable dashboard/navbar/comment patterns.

---

## 5. S3 — notifications integration batch

**Dependency**: S2 complete.
**Pairing**: 4 Engineer/Reviewer pairs.
**Parallelism**: Shared preflight first, then parallel batches S3.A-S3.D; baseline consolidation sequential.
**Baseline**: block 18.6 `36 -> 27`.

- [ ] **S3.0 Session preflight gate**
  - Engineer lead: map common notification SDK calls, pagination calls, and toast/provider boundaries across all 9 files.
  - Reviewer lead: approve the common mock surface before parallel edits start.

- [ ] **S3.A Parallel batch — error path**
  - Files:
    - `tests/integration/notifications/notification-error.test.jsx`
  - Scope: 1 file / 6 violations.
  - Reviewer focus: this file mocks multiple layers; reject partial conversions that still mock internal notification helpers.

- [ ] **S3.B Parallel batch — triggers and click**
  - Files:
    - `tests/integration/notifications/notification-triggers.test.jsx`
    - `tests/integration/notifications/notification-click.test.jsx`
  - Scope: 2 files / 8 violations.
  - Reviewer focus: trigger behavior must be controlled at SDK/external boundary, not service/runtime mocks.

- [ ] **S3.C Parallel batch — UI panel/toast/tabs**
  - Files:
    - `tests/integration/notifications/NotificationToast.test.jsx`
    - `tests/integration/notifications/NotificationTabs.test.jsx`
    - `tests/integration/notifications/NotificationPanel.test.jsx`
  - Scope: 3 files / 9 violations.
  - Reviewer focus: React provider mocks remain allowed, notification internals do not.

- [ ] **S3.D Parallel batch — pagination and bell**
  - Files:
    - `tests/integration/notifications/NotificationPaginationStateful.test.jsx`
    - `tests/integration/notifications/NotificationPagination.test.jsx`
    - `tests/integration/notifications/NotificationBell.test.jsx`
  - Scope: 3 files / 9 violations.
  - Reviewer focus: `startAfter` and query ordering stubs must match real Firestore call shape.

- [ ] **S3.E Sequential consolidation**
  - Engineer lead: remove 9 files from block 18.6 and run session verification.
  - Reviewer lead: confirm block 18.6 count is `27`, and copy notification-specific reusable patterns into `handoff.md` for S6.

---

## 6. S4 — events + profile

**Dependency**: S3 complete.
**Pairing**: 2 Engineer/Reviewer pairs.
**Parallelism**: S4.A and S4.B can run in parallel; baseline consolidation sequential.
**Baseline**: block 18.6 `27 -> 21`.

- [ ] **S4.0 Session preflight gate**
  - Engineer lead: identify whether event delete-race needs Option A before parallel work starts.
  - Reviewer lead: approve the event/profile split and confirm no shared helper file is introduced.

- [ ] **S4.A Parallel batch — events**
  - Files:
    - `tests/integration/events/event-detail-comment-runtime.test.jsx`
    - `tests/integration/events/EventDetailClient-delete-race.test.jsx`
    - `tests/integration/events/EventsPage.test.jsx`
  - Scope: 3 files / 5 violations.
  - Reviewer focus: `EventDetailClient-delete-race` may require Option A because of cascade delete / transaction race behavior.

- [ ] **S4.B Parallel batch — profile**
  - Files:
    - `tests/integration/profile/ProfileEventList.test.jsx`
    - `tests/integration/profile/ProfileClient.test.jsx`
    - `tests/integration/profile/BioEditor.test.jsx`
  - Scope: 3 files / 3 violations.
  - Reviewer focus: `BioEditor` changed from flaky-only overlap to mock-boundary after S0 selector expansion.

- [ ] **S4.C Sequential consolidation**
  - Engineer lead: remove successful files from block 18.6 and run session verification.
  - Reviewer lead: confirm block 18.6 count is `21` unless Option A files are explicitly moved out and documented.

---

## 7. S5 — strava + weather + toast

**Dependency**: S4 complete.
**Pairing**: 3 Engineer/Reviewer pairs.
**Parallelism**: S5.A-S5.C can run in parallel; baseline consolidation sequential.
**Baseline**: block 18.6 `21 -> 11`.

- [ ] **S5.0 Session preflight gate**
  - Engineer lead: classify Strava fetch/OAuth cases before edits.
  - Reviewer lead: confirm fetch-boundary tests stay allowed and only internal mocks are removed.

- [ ] **S5.A Parallel batch — toast**
  - Files:
    - `tests/integration/toast/crud-toast.test.jsx`
  - Scope: 1 file / 4 violations.
  - Reviewer focus: toast provider boundary mocks are allowed, but internal use-case/service mocks are not.

- [ ] **S5.B Parallel batch — weather**
  - Files:
    - `tests/integration/weather/favorites.test.jsx`
    - `tests/integration/weather/weather-page.test.jsx`
    - `tests/integration/weather/township-drilldown.test.jsx`
  - Scope: 3 files / 3 violations.
  - Reviewer focus: weather external fetch/data boundary stays mocked; repo/service internals do not.

- [ ] **S5.C Parallel batch — Strava**
  - Files:
    - `tests/integration/strava/runs-page-sync-error.test.jsx`
    - `tests/integration/strava/RunsPage.test.jsx`
    - `tests/integration/strava/RunCalendarDialog.test.jsx`
    - `tests/integration/strava/CallbackPage.test.jsx`
    - `tests/integration/strava/RunsRouteMap.test.jsx`
    - `tests/integration/strava/RunsActivityCard.test.jsx`
  - Scope: 6 files / 6 violations.
  - Reviewer focus: `CallbackPage` is high-risk Option A because of OAuth fetch behavior; route map/activity card are S0 newly exposed files.

- [ ] **S5.D Sequential consolidation**
  - Engineer lead: remove successful files from block 18.6 and run session verification.
  - Reviewer lead: confirm first-batch mock-boundary drain is complete and block 18.6 count is `11` flaky-only overlap files.

---

## 8. S6 — unit/lib notification batch

**Dependency**: S5 complete. S6 should also reuse S3 notification patterns from `handoff.md`.
**Pairing**: 2 Engineer/Reviewer pairs.
**Parallelism**: S6.A and S6.B can run in parallel after notification preflight; baseline consolidation sequential.
**Baseline**: block 18.8 `5 -> 0`.

- [ ] **S6.0 Session preflight gate**
  - Engineer lead: compare S3 notification integration patterns with unit/lib facade needs.
  - Reviewer lead: approve split and confirm no production `src/` changes are needed to make facade tests pass.

- [ ] **S6.A Parallel batch — notification writes**
  - Files:
    - `tests/unit/lib/notify-event-new-comment.test.js`
    - `tests/unit/lib/notify-post-comment-reply.test.js`
    - `tests/unit/lib/firebase-notifications-write.test.js`
  - Scope: 3 files / 7 violations.
  - Reviewer focus: internal lib/repo mocks become Firebase SDK boundary mocks; timestamp/write stubs match real call shape.

- [ ] **S6.B Parallel batch — notification reads/authors**
  - Files:
    - `tests/unit/lib/firebase-notifications-read.test.js`
    - `tests/unit/lib/fetch-distinct-comment-authors.test.js`
  - Scope: 2 files / 4 violations.
  - Reviewer focus: query/getDocs stubs cover distinct author behavior without mocking internal helpers.

- [ ] **S6.C Sequential consolidation**
  - Engineer lead: remove all 5 files from block 18.8 and run session verification.
  - Reviewer lead: confirm block 18.8 is empty and `handoff.md` has any unit/lib-specific SDK stub notes.

---

## 9. S7 — unit/runtime + unit/api + scattered service/repo

**Dependency**: S6 complete.
**Pairing**: 3 Engineer/Reviewer pairs.
**Parallelism**: S7.A-S7.C can run in parallel after preflight; baseline consolidation sequential.
**Baseline**: block 18.7 `14 -> 0`.

- [ ] **S7.0 Session preflight gate**
  - Engineer lead: separate client SDK, Admin SDK, and external fetch boundaries before parallel edits.
  - Reviewer lead: approve split and flag Strava/webhook route files that require Option A / nock instead of fake internal mocks.

- [ ] **S7.A Parallel batch — unit/runtime**
  - Files:
    - `tests/unit/runtime/notification-use-cases.test.js`
    - `tests/unit/runtime/useStravaConnection.test.jsx`
    - `tests/unit/runtime/useStravaActivities.test.jsx`
    - `tests/unit/runtime/profile-events-runtime.test.js`
    - `tests/unit/runtime/post-use-cases.test.js`
  - Scope: 5 files / 7 violations.
  - Reviewer focus: `useStravaConnection` has one `@/lib` mock and same-file `setTimeout` cleanup is in scope.

- [ ] **S7.B Parallel batch — unit/api routes**
  - Files:
    - `tests/unit/api/weather-api-route.test.js`
    - `tests/unit/api/sync-token-revocation.test.js`
    - `tests/unit/api/strava-webhook-route.test.js`
    - `tests/unit/api/strava-sync-route.test.js`
    - `tests/unit/api/strava-disconnect-route.test.js`
    - `tests/unit/api/strava-callback-route.test.js`
  - Scope: 6 files / 6 violations.
  - Reviewer focus: API routes usually need `firebase-admin/firestore` or fetch boundary mocks; `strava-callback-route` and `strava-webhook-route` are high-risk Option A candidates.

- [ ] **S7.C Parallel batch — scattered service/repo**
  - Files:
    - `tests/unit/service/weather-forecast-service.test.js`
    - `tests/unit/service/profile-service.test.js`
    - `tests/unit/repo/firebase-profile-server.test.js`
  - Scope: 3 files / 4 violations.
  - Reviewer focus: service tests mock external data/API boundaries, repo server test mocks Admin SDK boundary, not internal repo/service modules.

- [ ] **S7.D Sequential consolidation**
  - Engineer lead: remove all 14 files from block 18.7 and run session verification.
  - Reviewer lead: confirm block 18.7 is empty, all five progress grep counts are zero, Option A migrations are recorded, and S8 trigger criteria are ready.

---

## 10. Final spec completion gate

- [ ] S0-S7 are merged in order.
- [ ] Block 18.6 mock-boundary portion is drained; only planned flaky-only overlap remains.
- [ ] Block 18.7 is empty.
- [ ] Block 18.8 is empty.
- [ ] `handoff.md` §2 contains reusable SDK mock patterns from S1/S3/S6/S7.
- [ ] `handoff.md` §6 lists every Option A file moved out of this spec.
- [ ] Full progress grep from `plan.md` §7 returns `0 / 0 / 0 / 0 / 0`.
- [ ] Coverage did not regress against S0 baseline.
