# 033 S9 Coverage Gap Handoff

## Current Status

- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-033-s9-coverage-gap`
- Branch: `033-s9-coverage-gap`
- Base: latest `main` at worktree creation
- Main agent role: process coordinator only
- Implementation rule: every repo write must be done by an Engineer subagent and accepted by a paired Reviewer subagent
- Current phase: Wave A implementation in progress; T010/T011 accepted and committed, T012/T013 accepted and committed, other Wave A task files remain uncommitted by other task owners.
- T001 Setup Engineer evidence:
  - `pwd` => `/Users/chentzuyu/Desktop/dive-into-run-033-s9-coverage-gap`
  - `git branch --show-current` => `033-s9-coverage-gap`
  - `git rev-parse HEAD main origin/main` => all `a8c7ad900b3fc9a074ddfd7b63d7656d165c730f`
  - `git log --oneline -1 --decorate` => `a8c7ad9 (HEAD -> 033-s9-coverage-gap, origin/main, main) test(coverage): add wave3 ui app evidence`
  - `test -f specs/033-s9-coverage-gap/tasks.md && test -f specs/033-s9-coverage-gap/handoff.md` => `033 docs exist`
  - Forbidden files check for `specs/026-tests-audit-report/tasks.md`, `specs/026-tests-audit-report/handoff.md`, `docs/QUALITY_SCORE.md`, and `.github/pull_request_template.md` returned no status or diff output.

## Coverage Baseline

- Baseline command: `npm run test:coverage`
- Baseline timestamp: `2026-05-02 21:02:04 Asia/Taipei` (`coverage/coverage-summary.json` mtime)
- Baseline exit code: `0`
- Baseline summary source: fresh `coverage/coverage-summary.json`
- Layer metric: statement coverage, aggregate `statements.covered / statements.total` from the fresh JSON summary. No existing helper script was found for a different per-layer metric.
- `src/types/**`: N/A (`0 / 0` statements, 0 files in summary)
- `src/config/**`: `82.35%` (`28 / 34` statements, 6 files)
- `src/repo/**`: `94.78%` (`436 / 460` statements, 19 files)
- `src/service/**`: `92.78%` (`514 / 554` statements, 15 files)
- `src/runtime/**`: `88.81%` (`2436 / 2743` statements, 46 files)
- `src/ui/**`: `85.07%` (`114 / 134` statements, 21 files) — below target `>= 94.43`
- `src/components/**`: `85.84%` (`794 / 925` statements, 90 files) — below target `>= 91.64`
- `src/app/**`: `88.96%` (`137 / 154` statements, 33 files) — below target `>= 95.07`
- Notes:
  - First attempt at `2026-05-02 21:00 Asia/Taipei` exited `127` because this worktree had no installed `vitest` binary (`/bin/sh: vitest: command not found`).
  - Ran `npm install` to bootstrap this worktree, then reran `npm run test:coverage` successfully.
  - Fresh run output: 160 test files passed, 1403 tests passed, V8 total statements `89.27%` (`4602 / 5155`).
  - Baseline numbers above were recalculated from the fresh JSON summary, not copied from old reports or stdout.

## Coverage Gap Candidates

T003 parsed the fresh `coverage/coverage-summary.json` generated at `2026-05-02 21:02:04 Asia/Taipei`. The inventory below ignores CSS/assets with `0 / 0` statements because they cannot move statement coverage and would encourage non-behavior tests.

Target math from the fresh baseline:

- `src/ui/**`: `114 / 134` (`85.07%`), needs at least `127 / 134`; gap is `+13` covered statements.
- `src/components/**`: `794 / 925` (`85.84%`), needs at least `848 / 925`; gap is `+54` covered statements.
- `src/app/**`: `137 / 154` (`88.96%`), needs at least `147 / 154`; gap is `+10` covered statements.

### Low / Uncovered Files By Layer

`src/ui/**` files below 100% statement coverage:

- `src/ui/posts/PostDetailScreen.jsx`: `4 / 6` (`66.66%`)
- `src/ui/member/DashboardTabsScreen.jsx`: `17 / 24` (`70.83%`)
- `src/ui/events/event-formatters.js`: `23 / 31` (`74.19%`)
- `src/ui/events/EventDetailScreen.jsx`: `3 / 4` (`75%`)
- `src/ui/events/EventCreateForm.jsx`: `6 / 7` (`85.71%`)
- `src/ui/weather/WeatherPageScreen.jsx`: `10 / 11` (`90.9%`)

`src/components/**` files below 100% statement coverage:

- `src/components/RunsRouteMap.jsx`: `0 / 2` (`0%`)
- `src/components/icons/RunIndoorIcon.jsx`: `0 / 1` (`0%`)
- `src/components/CommentSection.jsx`: `11 / 26` (`42.3%`)
- `src/components/CommentCardMenu.jsx`: `24 / 46` (`52.17%`)
- `src/components/EventEditForm.jsx`: `11 / 21` (`52.38%`)
- `src/components/Notifications/NotificationPanel.jsx`: `53 / 74` (`71.62%`)
- `src/components/weather/TaiwanMap.jsx`: `65 / 90` (`72.22%`)
- `src/components/CommentDeleteConfirm.jsx`: `6 / 8` (`75%`)
- `src/components/CommentHistoryModal.jsx`: `10 / 12` (`83.33%`)
- `src/components/CommentEditModal.jsx`: `11 / 13` (`84.61%`)
- `src/components/RunCalendarDialog.jsx`: `41 / 48` (`85.41%`)
- `src/components/PostCard.jsx`: `33 / 38` (`86.84%`)
- `src/components/weather/FavoritesBar.jsx`: `9 / 10` (`90%`)
- `src/components/ComposeModal.jsx`: `28 / 31` (`90.32%`)
- `src/components/Navbar/useMobileDrawer.js`: `66 / 72` (`91.66%`)
- `src/components/EventRouteEditor.jsx`: `14 / 15` (`93.33%`)
- `src/components/weather/WeatherCard.jsx`: `14 / 15` (`93.33%`)
- `src/components/EventActionButtons.jsx`: `16 / 17` (`94.11%`)
- `src/components/weather/WeatherPage.jsx`: `23 / 24` (`95.83%`)
- `src/components/ShareButton.jsx`: `28 / 29` (`96.55%`)
- `src/components/EventMap.jsx`: `91 / 93` (`97.84%`)

`src/app/**` files below 100% statement coverage:

- `src/app/layout.jsx`: `0 / 4` (`0%`)
- `src/app/weather/layout.jsx`: `0 / 3` (`0%`)
- `src/app/weather/page.jsx`: `0 / 3` (`0%`)
- `src/app/page.jsx`: `0 / 1` (`0%`)
- `src/app/member/BioEditor.jsx`: `23 / 28` (`82.14%`)
- `src/app/users/[uid]/ProfileHeader.jsx`: `13 / 14` (`92.85%`)

### Recommended UI Candidates

1. `src/ui/events/event-formatters.js` — best first UI slice.
   - Current coverage: statements `23 / 31` (`74.19%`), functions `3 / 3` (`100%`), branches `20 / 30` (`66.66%`).
   - Uncovered lines/branches from LCOV: lines `9`, `23`, `45`, `46`; branch gaps around null date, fallback date coercion, empty/invalid pace fallback, and route label fallback.
   - Likely behavior to test: `formatDateTime(null)`, plain string `T` replacement, Timestamp-like `toDate()`, non-Date object fallback, `formatPace` blank/null/invalid fallback, `renderRouteLabel` from route coordinates and legacy `route.pointsCount`.
   - Likely test location/type: `tests/unit/ui/event-formatters.test.js`.
   - Existing nearby tests: no direct `event-formatters` test found by `rg`; behavior is only indirectly touched by event detail rendering.
   - Canonical-layer mocks: can run real formatter code and real `countTotalPoints`; no canonical mocks needed.
   - Rationale: up to 8 statement points, pure behavior, low flake risk.

2. `src/ui/member/DashboardTabsScreen.jsx` — second UI slice.
   - Current coverage: statements `17 / 24` (`70.83%`), functions `7 / 9` (`77.77%`), branches `19 / 25` (`76%`).
   - Uncovered lines/functions from LCOV: lines `33-38`, `47`, `49`, `52`; uncovered anonymous functions are the post/comment `map` branches in `ItemList`.
   - Likely behavior to test: render active tab panel from a supplied runtime object for posts and comments, empty/error states, `loadMoreError` retry, `isLoadingMore`, and end hint.
   - Likely test location/type: `tests/integration/dashboard/DashboardTabsScreen.test.jsx` or a focused extension near `tests/integration/dashboard/DashboardTabs.test.jsx`.
   - Existing nearby tests: `tests/integration/dashboard/DashboardTabs.test.jsx` covers the runtime wrapper but mocks dashboard card components; it does not directly lock the render-only screen branches.
   - Canonical-layer mocks: can pass a literal runtime object and render real dashboard cards; no `@/repo`, `@/service`, `@/runtime`, `@/ui`, `@/components`, or `@/app` mocks needed.
   - Rationale: up to 7 statement points and directly validates UI branching.

3. `src/ui/posts/PostDetailScreen.jsx` — small UI filler after the first two.
   - Current coverage: statements `4 / 6` (`66.66%`), functions `3 / 5` (`60%`), branches `15 / 18` (`83.33%`).
   - Uncovered lines/functions from LCOV: lines `117`, `120`; edit/delete callbacks passed into `CommentCard`.
   - Likely behavior to test: rendered comments map post-detail runtime comment shape into `CommentCard`, and comment edit/delete actions call runtime handlers with the comment ID.
   - Likely test location/type: `tests/integration/posts/PostDetailScreen.test.jsx`.
   - Existing nearby tests: `tests/integration/posts/PostDetail.test.jsx` covers `PostDetailClient` with real runtime flow but does not directly cover the screen callback adapters.
   - Canonical-layer mocks: can render screen with literal runtime props; only external `next/link` / `next/image` safety mocks may be needed.
   - Rationale: small but clean, helps UI cross the `+13` target when paired with candidates 1 and 2.

Lower-priority UI fillers if a primary slice under-delivers: `src/ui/events/EventDetailScreen.jsx` (`3 / 4`, route/participation branches), `src/ui/events/EventCreateForm.jsx` (`6 / 7`, draft defaults / map branch), and `src/ui/weather/WeatherPageScreen.jsx` (`10 / 11`, null weather success branch). These are behavior-testable with literal runtime props and external map/Next mocks only.

### Recommended Components Candidates

1. `src/components/CommentCardMenu.jsx` — best first components slice.
   - Current coverage: statements `24 / 46` (`52.17%`), functions `11 / 12` (`91.66%`), branches `11 / 22` (`50%`).
   - Uncovered lines/functions from LCOV: outside-click close at `27-28`, keyboard navigation at `48-77`, dropdown item refs/clicks at `113-132`.
   - Likely behavior to test: open menu, focus first item, ArrowDown/ArrowUp/Home/End focus movement, Escape closes and returns focus, outside click closes, Edit/Delete invoke callbacks and close.
   - Likely test location/type: `tests/integration/comments/CommentCardMenu.test.jsx`.
   - Existing nearby tests: `CommentCard` tests indirectly touch owner controls, but no direct `CommentCardMenu` test was found by `rg`.
   - Canonical-layer mocks: self-contained component; no canonical mocks needed.
   - Rationale: up to 22 statement points, real accessibility behavior, low setup cost.

2. `src/components/Notifications/NotificationPanel.jsx` — second components slice.
   - Current coverage: statements `53 / 74` (`71.62%`), functions `14 / 16` (`87.5%`), branches `42 / 59` (`71.18%`).
   - Uncovered lines/functions from LCOV: focus/early-return branch at `38`, outside-click bell exception at `57`, keyboard Escape/Tab trap at `75-97`, IntersectionObserver load-more callback at `113-115`, and some load-more rendering branches.
   - Likely behavior to test: Escape calls `closePanel`, Tab/Shift+Tab traps focus inside the panel, clicking the bell control does not close, `showLoadMoreButton` calls `loadMore`, sentinel observer calls `loadMore`, clicking a notification marks read, pushes route, and closes panel.
   - Likely test location/type: extend `tests/integration/notifications/NotificationPanel.test.jsx` and/or pagination tests.
   - Existing nearby tests: `NotificationPanel.test.jsx`, `NotificationPagination.test.jsx`, `NotificationPaginationStateful.test.jsx`, `NotificationTabs.test.jsx`, and `notification-click.test.jsx`.
   - Canonical-layer mocks: current tests use real `NotificationContext.Provider` values and mock external Firebase/Next boundaries; new tests can keep that boundary without mocking canonical layers.
   - Rationale: up to 21 statement points and meaningful keyboard/infinite-scroll behavior.

3. `src/components/CommentSection.jsx` — third components slice if the first two are not enough alone.
   - Current coverage: statements `11 / 26` (`42.3%`), functions `4 / 7` (`57.14%`), branches `32 / 39` (`82.05%`).
   - Uncovered lines/functions from LCOV: scroll-to-comment effect at `71-92`, including interval attempts, `scrollIntoView`, highlight class add/remove, max-attempt cleanup, and effect cleanup.
   - Likely behavior to test: when `useSearchParams()` returns `commentId`, the component polls for the matching comment element, scrolls it into view, adds `commentHighlight`, removes it on `animationend`, and clears timer when the element never appears.
   - Likely test location/type: extend `tests/integration/comments/CommentSection.test.jsx` using fake timers.
   - Existing nearby tests: large `tests/integration/comments/CommentSection.test.jsx` plus `event-comment-notification.test.jsx`.
   - Canonical-layer mocks: existing tests execute real `CommentSection`, `useComments`, and `useCommentMutations` against mocked Firebase SDK and `next/navigation`; no canonical `@/runtime` hook mocks are required.
   - Rationale: up to 15 statement points; paired with candidates 1 and 2 can close the `+54` components gap.

4. `src/components/EventEditForm.jsx` — fallback components slice.
   - Current coverage: statements `11 / 21` (`52.38%`), functions `9 / 18` (`50%`), branches `8 / 9` (`88.88%`).
   - Uncovered lines/functions from LCOV: individual field change handlers around `115`, `127`, `141-142`, `160`, `183`, `195`, `235`, `252`, `285`, plus submit handler line `26` mapping artifact.
   - Likely behavior to test: changing time/deadline/city resets district, district/runType/meetPlace/pace/maxParticipants updates, submit sends only changed values.
   - Likely test location/type: extend `tests/integration/events/EventEditForm.test.jsx`.
   - Existing nearby tests: `tests/integration/events/EventEditForm.test.jsx` already renders the real component and real `useEventEditForm`.
   - Canonical-layer mocks: no canonical mocks needed; it can execute the real runtime hook with literal event data.
   - Rationale: good fallback if reviewer wants less timer/focus work, but smaller value than the first three.

Rejected/deprioritized components candidates:

- `src/components/RunsRouteMap.jsx` (`0 / 2`) is only a `next/dynamic` wrapper; a direct test is likely import-only/render-wrapper-only and low behavior value. Existing `tests/integration/strava/RunsRouteMap.test.jsx` already covers real `RunsRouteMapInner` decoding/rendering.
- `src/components/icons/RunIndoorIcon.jsx` (`0 / 1`) is static SVG output; adding a test would be render-only and does not validate user behavior.
- `src/components/weather/TaiwanMap.jsx` (`65 / 90`) has high theoretical upside, but most gaps are Leaflet event/style branches and `ResizeObserver`/`requestAnimationFrame` plumbing. Keep it as Wave B only if components coverage still misses after the lower-risk accessibility/comment slices.

### Recommended App Candidates

1. `src/app/layout.jsx` — first app thin-entry slice.
   - Current coverage: statements `0 / 4` (`0%`), functions `0 / 1` (`0%`), branches `0 / 2` (`0%`).
   - Uncovered lines/functions from LCOV: font setup lines `11`, `16`, metadata line `21`, `RootLayout` render at `38`, and `NEXT_PUBLIC_SITE_URL` fallback branch at `22`.
   - Likely behavior to test: metadata uses configured/fallback site URL, root layout sets `lang="zh-Hant-TW"`, applies font variables, and includes children inside the provider/nav/toast shell.
   - Likely test location/type: `tests/integration/app/root-layout.test.jsx`.
   - Existing nearby tests: `tests/integration/app/app-thin-entries.test.jsx` covers dynamic route app entries, not root layout.
   - Canonical-layer mocks: should avoid mocking `@/runtime/providers` or `@/components`; mock only external Next font and Firebase SDK boundaries if real providers require jsdom-safe setup.
   - Rationale: up to 4 statement points and validates actual app shell contract.

2. `src/app/weather/layout.jsx` — second app thin-entry slice.
   - Current coverage: statements `0 / 3` (`0%`), functions `0 / 1` (`0%`), branches `0 / 0` (`100%`).
   - Uncovered lines/functions from LCOV: Fraunces setup at `3`, metadata at `10`, `WeatherLayout` render at `22`.
   - Likely behavior to test: weather metadata is exported and children render inside the Fraunces variable wrapper.
   - Likely test location/type: `tests/integration/app/weather-layout.test.jsx` or grouped app thin-entry test.
   - Existing nearby tests: no direct weather layout test found.
   - Canonical-layer mocks: external `next/font/google` mock only.
   - Rationale: 3 easy statement points without production or policy edits.

3. `src/app/weather/page.jsx` — app thin-entry candidate if tested through real weather component import.
   - Current coverage: statements `0 / 3` (`0%`), functions `0 / 2` (`0%`), branches `0 / 0` (`100%`).
   - Uncovered lines/functions from LCOV: dynamic import at `5` and `Weather` render at `12`.
   - Likely behavior to test: weather page entry delegates to the client weather page through `next/dynamic({ ssr: false })`; prefer rendering with existing weather-page external mocks so the real `WeatherPage` module loads, not a mocked `@/components/weather/WeatherPage`.
   - Likely test location/type: extend `tests/integration/weather/weather-page.test.jsx` or add an app thin-entry test.
   - Existing nearby tests: `tests/integration/weather/weather-page.test.jsx`, `favorites.test.jsx`, and `township-drilldown.test.jsx` cover the real weather component, not this `src/app/weather/page.jsx` wrapper.
   - Canonical-layer mocks: acceptable only if mocks stay at `next/dynamic`, Leaflet, topology, Firebase SDK, fetch, and image boundaries; do not mock `@/components/weather/WeatherPage`.
   - Rationale: 3 statement points; useful if implemented as a real entry-to-component behavior test.

4. `src/app/member/BioEditor.jsx` — fallback app candidate.
   - Current coverage: statements `23 / 28` (`82.14%`), functions `5 / 5` (`100%`), branches `16 / 19` (`84.21%`).
   - Uncovered lines/branches from LCOV: success/error reset in `onBioChange` at `71-73`, over-limit save guard at `80-82`, and one branch around save button text.
   - Likely behavior to test: after a successful save or failed save, editing the textarea clears the status/error back to idle; over-limit text remains blocked without writing to Firestore.
   - Likely test location/type: extend `tests/integration/profile/BioEditor.test.jsx`.
   - Existing nearby tests: `tests/integration/profile/BioEditor.test.jsx` already runs real `updateUserBio -> updateUserBioDocument -> setDoc` with Firebase SDK/config mocks only.
   - Canonical-layer mocks: no canonical mocks needed.
   - Rationale: useful fallback if app thin-entry dynamic tests are judged too wrapper-heavy.

5. `src/app/users/[uid]/ProfileHeader.jsx` — tiny app filler.
   - Current coverage: statements `13 / 14` (`92.85%`), functions `3 / 3` (`100%`), branches `11 / 12` (`91.66%`).
   - Uncovered line/branch from LCOV: empty/non-string name fallback in `getAvatarInitial` at `40`.
   - Likely behavior to test: when `photoURL` is empty and name is empty, fallback avatar renders with empty text and does not call `next/image`.
   - Likely test location/type: extend `tests/integration/profile/ProfileHeader.test.jsx`.
   - Existing nearby tests: direct `ProfileHeader` test file exists.
   - Canonical-layer mocks: only external `next/image` safety mock is needed.
   - Rationale: 1 statement point, useful to finish the app gap after layout/page slices.

Rejected/deprioritized app candidates:

- `src/app/page.jsx` (`0 / 1`) is a static heading-only home page. It can be covered by an app thin-entry smoke test, but it is low behavior value and should not displace layout/weather/BioEditor/ProfileHeader work.
- Any app candidate that requires mocking `@/runtime`, `@/components`, or `@/app` should be rejected for T003/T004 planning. Thin-entry tests should either execute the real downstream module with external/jsdom boundary mocks, or be skipped.

## T004 Implementation Slicing Summary

T004 Planning Engineer converted the T003 reviewed candidates into concrete implementation slices without starting tests or touching production code. Planning Reviewer accepted the section and `tasks.md` diff on 2026-05-02.

### Wave A Slice Map

- T010 UI A: `src/ui/events/event-formatters.js`
  - Expected test file: `tests/unit/ui/event-formatters.test.js`
  - Focused command: `npx vitest run --project=browser tests/unit/ui/event-formatters.test.js`
  - Acceptance focus: real formatter behavior for date, pace, and route-label fallbacks; no canonical-layer mocks; no shared helper edits.
- T012 UI B: `src/ui/member/DashboardTabsScreen.jsx`
  - Expected test file: `tests/integration/dashboard/DashboardTabsScreen.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/dashboard/DashboardTabsScreen.test.jsx`
  - Acceptance focus: literal runtime props covering posts/comments item lists, empty/error/loading-more/end states, and retry behavior; no canonical-layer mocks.
- T020 Components A: `src/components/CommentCardMenu.jsx`
  - Expected test file: `tests/integration/comments/CommentCardMenu.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/comments/CommentCardMenu.test.jsx`
  - Acceptance focus: keyboard navigation, outside-click close, Escape focus return, and Edit/Delete callbacks through accessible interactions.
- T022 Components B: `src/components/Notifications/NotificationPanel.jsx`
  - Expected test file: `tests/integration/notifications/NotificationPanel.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/notifications/NotificationPanel.test.jsx`
  - Acceptance focus: Escape close, focus trap, bell exception, load-more button/sentinel, and notification click mark-read/push/close behavior through real `NotificationContext.Provider` values.
- T030 App A: `src/app/layout.jsx`
  - Expected test file: `tests/integration/app/root-layout.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/app/root-layout.test.jsx`
  - Acceptance focus: metadata configured/fallback URL and observable root shell contract without app/runtime/component internal mocks.
- T032 App B: `src/app/weather/layout.jsx` and `src/app/weather/page.jsx`
  - Expected test files: `tests/integration/app/weather-layout.test.jsx`, `tests/integration/app/weather-page-entry.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/app/weather-layout.test.jsx tests/integration/app/weather-page-entry.test.jsx`
  - Acceptance focus: weather layout metadata/Fraunces wrapper and weather page dynamic delegation while loading the real weather component path.

### Wave B Fallback Pools

- T041 UI fallback pool:
  - Primary: `src/ui/posts/PostDetailScreen.jsx` -> `tests/integration/posts/PostDetailScreen.test.jsx`
  - Secondary candidates require complete metadata in this handoff plus Reviewer acceptance before implementation: `src/ui/events/EventDetailScreen.jsx`, `src/ui/events/EventCreateForm.jsx`, `src/ui/weather/WeatherPageScreen.jsx`
- T042 Components fallback pool:
  - Primary: `src/components/CommentSection.jsx` -> `tests/integration/comments/CommentSection.test.jsx`
  - Fallback: `src/components/EventEditForm.jsx` -> `tests/integration/events/EventEditForm.test.jsx`
  - Tertiary candidate requires complete metadata in this handoff plus Reviewer acceptance before implementation: `src/components/weather/TaiwanMap.jsx`
- T043 App fallback pool:
  - First finish any unimplemented or under-covered T030/T032 app surface.
  - Primary fallback: `src/app/member/BioEditor.jsx` -> `tests/integration/profile/BioEditor.test.jsx`
  - One-point filler: `src/app/users/[uid]/ProfileHeader.jsx` -> `tests/integration/profile/ProfileHeader.test.jsx`
  - `src/app/page.jsx` remains rejected/deprioritized unless complete metadata is added and Reviewer accepts a behavior-bearing test plan.

### Conflict Notes

- Wave A is parallel-safe only if no shared helper/test file is introduced.
- T010, T012, T020, T030, and T032 should create or use separate focused test files.
- T022 owns `tests/integration/notifications/NotificationPanel.test.jsx`; no concurrent slice should edit that file.
- T030 and T032 both may need `next/font/google` or `next/dynamic` boundary handling. Keep mocks local to separate test files; if a shared app helper becomes necessary, serialize the app slices through T031/T033 before committing.
- T041 primary should use a new `tests/integration/posts/PostDetailScreen.test.jsx` file to avoid touching existing `PostDetail.test.jsx` during another posts task.
- T042 primary extends the large `CommentSection.test.jsx` and may use fake timers; do not run it concurrently with any other comment-section helper/test edit.
- T042 fallback extends `EventEditForm.test.jsx`; do not pair it with another event form edit in the same wave.
- T043 fallbacks extend profile tests only; avoid touching shared profile fixtures unless Reviewer agrees to serialize the profile slices.

## T006 Blocker-Fix Handoff

T010/T012 are blocked at depcruise because the test bucket policy does not model `src/ui/**` as an allowed test surface. Diagnosis Engineer and Reviewer approved the fix as precise policy modeling, not a threshold or policy workaround. T006 must be implemented and reviewed as an independent blocker-fix before T010/T012 commits, and should land before any Wave A commit because depcruise runs as a repo-wide commit gate.

T006 scope:

- Add precise `src-ui` surface `^src/ui(?:/|$)` in `specs/021-layered-dependency-architecture/test-buckets/policy.js`.
- Allow only unit and integration buckets to import `src-ui` via explicit allowed surfaces/path patterns.
- Keep e2e and tests-helper buckets denied from importing `src/ui`.
- Do not add `src-other`, change deny rules, change thresholds, alter coverage include/exclude, add baseline ignore, or add suppression.
- Update `tests/unit/lib/test-bucket-policy.test.js` to prove unit/integration allow and e2e/helper deny behavior.
- Required evidence: `npm run depcruise` and `npx vitest run --project=browser tests/unit/lib/test-bucket-policy.test.js`.

T006 Engineer evidence, 2026-05-02 22:17:38 CST:

- Changed only T006 policy surfaces/tests plus this evidence note.
- Added precise `src-ui` surface matcher `^src/ui(?:/|$)`.
- Added `src-ui` only to unit and integration allowed surfaces/path patterns.
- Kept e2e/tests-helper allowed path patterns empty and deny rules unchanged.
- Focused policy Vitest: `npx vitest run --project=browser tests/unit/lib/test-bucket-policy.test.js` -> passed, 1 file / 4 tests.
- Depcruise: `npm run depcruise` -> passed, no dependency violations found across 1463 modules / 3712 dependencies.

## T010/T011 UI Slice Handoff

T010 UI Engineer A added pure behavior coverage for `src/ui/events/event-formatters.js` in `tests/unit/ui/event-formatters.test.js`.

T010/T011 review evidence, 2026-05-02 22:26:13 CST:

- Touched T010 slice file: `tests/unit/ui/event-formatters.test.js`.
- Production files touched: none.
- Shared helpers touched: none.
- Tests execute the real `@/ui/events/event-formatters` module and real `countTotalPoints` through the production import chain.
- Behavior coverage includes null/missing date fallback, plain datetime string `T` replacement, Timestamp-like `toDate()`, non-Date object fallback, numeric and numeric-string pace formatting, blank/null/invalid/negative pace fallback text, route coordinate point counting, legacy `route.pointsCount`, and unset route label.
- Reviewer scan found no snapshot-only, import-only, render-only, or empty tests.
- Reviewer scan found no canonical-layer mocks and no `@ts-ignore`, `eslint-disable`, or `cspell-disable`.
- Fresh lint: `npx eslint tests/unit/ui/event-formatters.test.js` -> passed; only existing React version settings warning.
- Fresh focused Vitest: `npx vitest run --project=browser tests/unit/ui/event-formatters.test.js` -> passed, 1 file / 12 tests.
- Fresh type-check: `npm run type-check` -> passed.
- Fresh depcruise: `npm run depcruise` -> passed, no dependency violations found across 1463 modules / 3712 dependencies.
- Forbidden files check: `git diff --name-only` listed only `tests/integration/notifications/NotificationPanel.test.jsx` before this doc update; untracked non-T010 Wave A files were present but were not staged for T010/T011.

## T012/T013 UI Slice Handoff

T012 UI Engineer B added behavior coverage for `src/ui/member/DashboardTabsScreen.jsx` in `tests/integration/dashboard/DashboardTabsScreen.test.jsx`.

T012/T013 review evidence, 2026-05-02 22:31:13 CST:

- Touched T012 slice file: `tests/integration/dashboard/DashboardTabsScreen.test.jsx`.
- Production files touched: none.
- Shared helpers touched: none.
- Tests render the real `DashboardTabsScreen` with literal runtime props and real dashboard card components.
- Only external framework boundary mock added: `next/link` test anchor replacement.
- Behavior coverage includes tab selection changing the visible panel, posts item-list link rendering, comments item-list link rendering, posts loading-more state, comments end hint, initial error retry, and load-more error retry.
- Reviewer scan found no snapshot-only, import-only, render-only, or empty tests.
- Reviewer scan found no canonical-layer mocks and no `@ts-ignore`, `eslint-disable`, or `cspell-disable`.
- Fresh lint: `npx eslint tests/integration/dashboard/DashboardTabsScreen.test.jsx` -> passed; only existing React version settings warning.
- Fresh focused Vitest: `npx vitest run --project=browser tests/integration/dashboard/DashboardTabsScreen.test.jsx` -> passed, 1 file / 3 tests.
- Fresh type-check: `npm run type-check` -> passed.
- Fresh depcruise: `npm run depcruise` -> passed, no dependency violations found across 1463 modules / 3712 dependencies.
- Forbidden files check before this doc update: `git status --short` listed only another task tracked file and untracked Wave A files; no forbidden files were listed, and only T012 files were staged for this commit.

## Coverage After

- Final command: pending
- Final summary source: pending
- `src/types/**`: pending
- `src/config/**`: pending
- `src/repo/**`: pending
- `src/service/**`: pending
- `src/runtime/**`: pending
- `src/ui/**`: pending, target `>= 94.43`
- `src/components/**`: pending, target `>= 91.64`
- `src/app/**`: pending, target `>= 95.07`

## Touched Files

### Planning Docs

- `specs/033-s9-coverage-gap/tasks.md`
- `specs/033-s9-coverage-gap/handoff.md`

### Tests

- `tests/unit/ui/event-formatters.test.js`
- `tests/integration/dashboard/DashboardTabsScreen.test.jsx`

### Production

- None
- Production files may be touched only for testability after Reviewer approval and must be explained here.

## Pitfalls

- Do not modify `specs/026-tests-audit-report/tasks.md`.
- Do not modify `specs/026-tests-audit-report/handoff.md`.
- Do not modify `docs/QUALITY_SCORE.md`.
- Do not modify `.github/pull_request_template.md`.
- Do not reduce coverage thresholds or coverage scope.
- Do not add baseline ignore/suppression.
- Do not mock own canonical layers such as `@/repo`, `@/service`, `@/runtime`, `@/ui`, `@/components`, or `@/app`.
- Do not accept snapshot-only, import-only, render-only, or empty tests as coverage work.
- Do not make checkbox-only commits after CI has already passed.

## Reviewer Notes

- Setup Reviewer: accepted 2026-05-02. Verified branch/path/base commit, 033 docs presence, forbidden 026/quality/template files untouched, status limited to 033 planning docs, and no baseline or implementation work started.
- Baseline Reviewer: accepted 2026-05-02. Verified T001 was already checked, `coverage/coverage-summary.json` mtime was `2026-05-02 21:02:04 +0800`, T002 used statement coverage from the fresh JSON summary, all 8 tracked source groups were independently recalculated, `src/ui/**`, `src/components/**`, and `src/app/**` were recorded against targets, `package-lock.json` had no diff, forbidden files were untouched, and no implementation or test edits had started.
- Analysis Reviewer: accepted 2026-05-02. Verified T001/T002 are checked, `coverage/coverage-summary.json` mtime is `2026-05-02 21:02:04 +0800`, layer and file-level statement coverage for `src/ui/**`, `src/components/**`, and `src/app/**` recalculates from the fresh summary, recommended candidates include behavior target, test type/location, nearby-test status, and canonical-layer mock feasibility, bad wrapper/static candidates are rejected or deprioritized, no tests or production files are modified, and forbidden files are untouched. T004 should promote only the fully documented recommended/fallback candidates into implementation slices; compact lower-priority filler notes must be expanded before use.
- T004 Planning Engineer: submitted for review. Prepared concrete Wave A implementation slices, Wave B fallback pools, focused commands, acceptance criteria, and conflict notes. Did not add tests, modify production code, touch 026 docs, or mark T004 checked before Reviewer acceptance.
- Planning Reviewer: accepted 2026-05-02. Verified T003 was checked and T004 was unchecked before review; Wave A slices T010/T012/T020/T022/T030/T032 have concrete source files, test paths, focused commands, and behavior acceptance criteria; Wave B T041/T042/T043 pools are based on T003 and block metadata-incomplete filler candidates; conflict notes cover helper/test overlap; T032 weather layout/page pairing is small enough because both app entries are tiny and use separate focused tests; status is limited to 033 planning docs.
- T005 Setup Reviewer: accepted 2026-05-02. Verified commit `723845fa48276df68b636df914101d34f699fac0` exists on branch `033-s9-coverage-gap`, commit scope is only `specs/033-s9-coverage-gap/tasks.md` and `specs/033-s9-coverage-gap/handoff.md`, no `src/**`, `tests/**`, coverage artifacts, `package-lock.json`, or forbidden files were included, T001-T004 were checked while T005 remained unchecked before review, working tree had no tracked/untracked changes before this sign-off, and the successful commit means any pre-commit caveat warnings were non-blocking with no hook failure.
- T006 Blocker-Fix: accepted 2026-05-02. Diagnosis Engineer and Reviewer approved adding a precise `src-ui` test bucket surface as policy modeling. Policy Modeling Reviewer accepted the implemented policy/test/doc diff and committed it as its own task before Wave A commits.
- T006 Docs Reviewer: accepted 2026-05-02. Verified T006 is inserted after T005 and before Wave A, has an Engineer/Reviewer pair, depends on T005, is not parallel-safe, makes T010/T012 depend on T006, and records that T006 should land before any Wave A commit. Acceptance is narrow to precise `src-ui` policy modeling, unit/integration allow behavior, e2e/tests-helper deny behavior, no `src-other`, no deny/threshold/include/exclude/baseline-ignore/suppression changes, policy-test update, `npm run depcruise`, and the focused policy Vitest command. This docs review did not mark T006 done and touched only this handoff sign-off.
- T006 Policy Modeling Reviewer: accepted 2026-05-02 22:20:38 CST. Verified `src-ui` is modeled as `^src/ui(?:/|$)`, only unit/integration buckets allow `src-ui` surfaces/path patterns, e2e/tests-helper still deny `src/**` with empty allowed path patterns, no `src-other` allow was added, deny rules were not weakened, and no coverage threshold/include/exclude/baseline-ignore/suppression files changed. Fresh evidence: `npx vitest run --project=browser tests/unit/lib/test-bucket-policy.test.js` passed 1 file / 4 tests; `npm run depcruise` passed with no dependency violations across 1463 modules / 3712 dependencies.
- T012/T013 UI Reviewer B + Flow Reviewer: accepted 2026-05-02 22:31:13 CST. Verified `tests/integration/dashboard/DashboardTabsScreen.test.jsx` covers real `DashboardTabsScreen` behavior with literal runtime props, uses only a minimal external `next/link` mock, avoids canonical-layer mocks and suppression comments, and passes fresh lint, focused browser Vitest, type-check, and depcruise gates.
- Implementation Reviewers: T010/T011 and T012/T013 accepted 2026-05-02; remaining implementation reviewers pending.
- Gate Reviewer: pending

## Remaining Risk

- T006 policy modeling is reviewed and committed; T010/T011 and T012/T013 are accepted. Other Wave A task files remain uncommitted and must be reviewed/staged by their own task owners.
- Parallel implementation must avoid touching the same test helper or test file without coordination.
- Wave B secondary/tertiary candidates that only had compact T003 notes must not start until handoff has complete metadata and a Reviewer accepts the metadata.
