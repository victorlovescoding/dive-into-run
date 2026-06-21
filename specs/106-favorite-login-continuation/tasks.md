# Tasks: 未登入使用者的收藏登入接續流程

**Input**: Design documents from `specs/106-favorite-login-continuation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/favorite-login-continuation.md`, `quickstart.md`
**Tests**: Required by repo constitution SDD/TDD. Test tasks must be written before implementation tasks and must fail before production code changes.
**Authorization Boundary**: This task plan authorizes future implementation planning only. Staging, commit, push, PR, merge, and local `main` sync each require separate explicit authorization.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it writes different files and does not depend on incomplete tasks.
- **[Story]**: Required only for user story phase tasks.
- **Exact paths**: Every task lists the file path(s) it reads, creates, or edits.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm scoped entry points and prepare shared test support before feature tests.

- [X] T001 Verify the supported favorite branches and excluded surfaces before implementation in `src/runtime/hooks/useEventsPageRuntime.js`, `src/runtime/hooks/useEventDetailRuntime.js`, `src/runtime/hooks/usePostsPageRuntime.js`, `src/runtime/hooks/usePostsSearchPageRuntime.js`, `src/runtime/hooks/usePostDetailRuntime.js`, `src/components/PostCard.jsx`, `src/runtime/hooks/useWeatherFavorites.js`, `src/runtime/hooks/useWeatherPageRuntime.js`, `src/ui/weather/WeatherPageScreen.jsx`, `src/components/weather/FavoriteButton.jsx`, `src/components/weather/FavoritesBar.jsx`, `src/runtime/hooks/useMemberFavoritesRuntime.js`, `src/ui/member/MemberFavoritesScreen.jsx`, `src/runtime/hooks/usePostComments.js`, `src/runtime/hooks/usePostCommentsHelpers.js`, `src/components/CommentCard.jsx`, `src/components/CommentSection.jsx`, `src/components/reports/ReportMenuItem.jsx`, `src/runtime/hooks/useReportDialogRuntime.js`, `src/runtime/hooks/useEventDetailParticipation.js`, `src/runtime/hooks/useEventParticipation.js`, `src/app/runs/page.jsx`, `src/runtime/hooks/useRunsPageRuntime.js`, `src/ui/runs/RunsPageScreen.jsx`, `src/runtime/server/use-cases/strava-server-use-cases.js`, and `src/repo/client/post-composer-draft-storage-repo.js`
- [X] T002 [P] Add shared favorite continuation test factories for intents, auth results, toast spies, and callbacks in `tests/_helpers/favorite-login-continuation-helpers.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared continuation helper, use-case, hook, and dialog required by all stories.

**Critical**: No user story implementation should begin until this phase is complete.

- [X] T003 [P] Write failing tests for copy selection, target normalization, state transitions, single-intent guard, and no persistence in `tests/unit/runtime/favorite-login-continuation-helpers.test.js`
- [X] T004 [P] Write failing tests for Google sign-in success through `signInWithGoogle` only, no full login page redirect, no email/password auth helper import or call, popup cancel/close/failure, add-only favorite success, idempotent already-favorited success, and add failure mapping in `tests/unit/runtime/favorite-login-continuation-use-cases.test.js`
- [X] T005 Implement favorite continuation constants, copy selection, target normalization, state transition helpers, and single-intent guard in `src/runtime/favorites/favorite-login-continuation-helpers.js`
- [X] T006 Implement add-only Google sign-in continuation use-case with `signInWithGoogle` and `addContentFavorite` in `src/runtime/client/use-cases/favorite-login-continuation-use-cases.js`
- [X] T007 Write failing hook tests for open, confirm, retry, cancel, close, success callback, failure callback, submitting state, and no second pending flow in `tests/unit/runtime/useFavoriteLoginContinuation.test.jsx`
- [X] T008 Implement `useFavoriteLoginContinuation` render state and handlers in `src/runtime/hooks/useFavoriteLoginContinuation.js`
- [X] T009 [P] Write failing dialog integration tests for exact copy, accessible role/name, no target title/name/id, primary click, secondary click, close click, and pending state in `tests/integration/favorites/FavoriteLoginContinuationDialog.test.jsx`
- [X] T010 Implement reusable favorite login continuation dialog markup in `src/components/FavoriteLoginContinuationDialog.jsx`
- [X] T011 Implement reusable favorite login continuation dialog styling in `src/components/FavoriteLoginContinuationDialog.module.css`

**Checkpoint**: Shared continuation contract is ready for page-level wiring.

---

## Phase 3: User Story 1 - 未登入者收藏活動後可接續登入 (Priority: P1) MVP

**Goal**: Unauthenticated users on `/events` and `/events/[id]` see the event dialog, start Google login only from the primary button, and after success only the clicked event is marked favorited with `登入成功，已加入收藏`.

**Independent Test**: In an unauthenticated event list or event detail runtime/UI test, clicking an event favorite opens a dialog with `登入後即可收藏` and `登入後會自動將這個活動加入收藏。`; confirming signs in, calls add favorite for the original event id, patches only that page item to favorited, and shows the success toast.

### Tests for User Story 1

- [X] T012 [P] [US1] Extend failing event list runtime tests for unauthenticated continuation open and local success patch in `tests/unit/runtime/useEventsPageRuntime.test.jsx`
- [X] T013 [P] [US1] Add failing event detail runtime tests for unauthenticated continuation open and detail success patch in `tests/unit/runtime/useEventDetailRuntime.test.jsx`
- [X] T014 [P] [US1] Add failing event list screen dialog wiring tests for runtime dialog state and handlers in `tests/unit/ui/events/EventsPageScreen.test.jsx`
- [X] T015 [P] [US1] Extend failing event detail screen dialog wiring tests for runtime dialog state and handlers in `tests/unit/ui/events/EventDetailScreen.test.jsx`

### Implementation for User Story 1

- [X] T016 [P] [US1] Replace the unauthenticated `/events` favorite toast branch with `openContinuation({ contentType: 'event', targetId })` and keep the clicked-event success patch local in `src/runtime/hooks/useEventsPageRuntime.js`
- [X] T017 [P] [US1] Replace the unauthenticated `/events/[id]` favorite toast branch with `openContinuation({ contentType: 'event', targetId })` and keep the detail success patch local in `src/runtime/hooks/useEventDetailRuntime.js`
- [X] T018 [P] [US1] Render `FavoriteLoginContinuationDialog` and pass the event list continuation contract through the screen boundary in `src/ui/events/EventsPageScreen.jsx`
- [X] T019 [P] [US1] Render `FavoriteLoginContinuationDialog` and pass the event detail continuation contract through the screen boundary in `src/ui/events/EventDetailScreen.jsx`

**Checkpoint**: Event continuation is independently testable and can be released as MVP after focused verification.

---

## Phase 4: User Story 2 - 未登入者收藏文章後可接續登入 (Priority: P1)

**Goal**: Unauthenticated users on `/posts`, `/posts/search`, and `/posts/[id]` see the post dialog, start Google login only from the primary button, and after success only the clicked post is marked favorited with `登入成功，已加入收藏`.

**Independent Test**: In unauthenticated post list, search, and detail runtime/UI tests, clicking a post favorite opens a dialog with `登入後即可收藏` and `登入後會自動將這篇文章加入收藏。`; confirming signs in, calls add favorite for the original post id, patches only that page item to favorited, and shows the success toast.

### Tests for User Story 2

- [X] T020 [P] [US2] Add failing posts list runtime tests for unauthenticated continuation open and clicked post success patch in `tests/unit/runtime/usePostsPageRuntime.test.jsx`
- [X] T021 [P] [US2] Extend failing posts search runtime tests for unauthenticated continuation open and nested result success patch in `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`
- [X] T022 [P] [US2] Extend failing post detail runtime tests for unauthenticated continuation open and detail success patch in `tests/unit/runtime/usePostDetailRuntime.test.jsx`
- [X] T023 [P] [US2] Extend failing post card favorite delegation tests to preserve click-to-handler behavior in `tests/unit/components/PostCard.test.jsx`
- [X] T024 [P] [US2] Extend failing posts page screen dialog wiring tests for runtime dialog state and handlers in `tests/unit/ui/posts/PostsPageScreen.test.jsx`
- [X] T025 [P] [US2] Extend failing posts search screen dialog wiring tests for runtime dialog state and handlers in `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`
- [X] T026 [P] [US2] Extend failing post detail screen dialog wiring tests for runtime dialog state and handlers in `tests/unit/ui/posts/PostDetailScreen.test.jsx`

### Implementation for User Story 2

- [X] T027 [P] [US2] Replace the unauthenticated `/posts` favorite toast branch with `openContinuation({ contentType: 'post', targetId })` and keep the clicked-post success patch local in `src/runtime/hooks/usePostsPageRuntime.js`
- [X] T028 [P] [US2] Replace the unauthenticated `/posts/search` favorite toast branch with `openContinuation({ contentType: 'post', targetId })` and keep the nested result success patch local in `src/runtime/hooks/usePostsSearchPageRuntime.js`
- [X] T029 [P] [US2] Replace the unauthenticated `/posts/[id]` favorite toast branch with `openContinuation({ contentType: 'post', targetId })` and keep the detail success patch local in `src/runtime/hooks/usePostDetailRuntime.js`
- [X] T030 [P] [US2] Render `FavoriteLoginContinuationDialog` and pass the posts list continuation contract through the screen boundary in `src/ui/posts/PostsPageScreen.jsx`
- [X] T031 [P] [US2] Render `FavoriteLoginContinuationDialog` and pass the posts search continuation contract through the screen boundary in `src/ui/posts/PostsSearchPageScreen.jsx`
- [X] T032 [P] [US2] Render `FavoriteLoginContinuationDialog` and pass the post detail continuation contract through the screen boundary in `src/ui/posts/PostDetailScreen.jsx`

**Checkpoint**: Post continuation is independently testable without event-page dependencies beyond the shared foundation.

---

## Phase 5: User Story 3 - 使用者可取消、關閉或重試登入 (Priority: P2)

**Goal**: Cancel, close, popup cancel/close, auth failure, and add failure never silently favorite the item; auth failures keep the dialog retryable, while add failure closes the dialog, clears intent, leaves state unfavorited, and shows `收藏失敗，請稍後再試`.

**Independent Test**: From an open continuation dialog, `稍後再說` and close clear the intent without toast; auth rejection keeps the dialog open without calling `addContentFavorite`; add rejection closes the dialog, keeps the item unfavorited, and shows only the failure toast.

### Tests for User Story 3

- [X] T033 [P] [US3] Add failing retry, cancel, close, single-intent, add-success, and add-failure regression tests in `tests/unit/runtime/useFavoriteLoginContinuation.test.jsx`
- [X] T034 [P] [US3] Add failing auth cancel, popup close, auth failure, no-uid, no-add, no full login page fallback, no email/password fallback, and add-failure normalization tests in `tests/unit/runtime/favorite-login-continuation-use-cases.test.js`
- [X] T035 [P] [US3] Add failing dialog pending, disabled primary, secondary cancel, and close button tests in `tests/integration/favorites/FavoriteLoginContinuationDialog.test.jsx`

### Implementation for User Story 3

- [X] T036 [US3] Implement retryable auth failure, no-add-on-auth-failure, add-only success, and add-failure result mapping in `src/runtime/client/use-cases/favorite-login-continuation-use-cases.js`
- [X] T037 [US3] Implement single-intent guard, cancel/close clearing, retryable auth failure state, success callback, failure callback, and toast side effects in `src/runtime/hooks/useFavoriteLoginContinuation.js`
- [X] T038 [US3] Implement pending disabled state, primary submit, secondary cancel, and close handlers in `src/components/FavoriteLoginContinuationDialog.jsx`

**Checkpoint**: Failure and retry behavior is independently verified against the runtime/UI contract.

---

## Phase 6: User Story 4 - 已登入使用者維持既有收藏行為 (Priority: P2)

**Goal**: Signed-in users on all applicable pages keep the current add/remove toggle behavior and existing success/failure messages, and never see the continuation dialog.

**Independent Test**: With a signed-in uid in each applicable runtime test, clicking unfavorited and favorited event/post items follows the existing add/remove path, preserves existing toast messages, and does not call `openContinuation`.

### Tests for User Story 4

- [X] T039 [P] [US4] Add signed-in event list add/remove no-dialog regression tests in `tests/unit/runtime/useEventsPageRuntime.test.jsx`
- [X] T040 [P] [US4] Add signed-in event detail add/remove no-dialog regression tests in `tests/unit/runtime/useEventDetailRuntime.test.jsx`
- [X] T041 [P] [US4] Add signed-in posts list add/remove no-dialog regression tests in `tests/unit/runtime/usePostsPageRuntime.test.jsx`
- [X] T042 [P] [US4] Add signed-in posts search add/remove no-dialog regression tests in `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`
- [X] T043 [P] [US4] Add signed-in post detail add/remove no-dialog regression tests in `tests/unit/runtime/usePostDetailRuntime.test.jsx`

### Implementation for User Story 4

- [X] T044 [P] [US4] Preserve signed-in event list add/remove favorite branches and existing toast messages while integrating continuation in `src/runtime/hooks/useEventsPageRuntime.js`
- [X] T045 [P] [US4] Preserve signed-in event detail add/remove favorite branch and existing toast messages while integrating continuation in `src/runtime/hooks/useEventDetailRuntime.js`
- [X] T046 [P] [US4] Preserve signed-in posts list add/remove favorite branches and existing toast messages while integrating continuation in `src/runtime/hooks/usePostsPageRuntime.js`
- [X] T047 [P] [US4] Preserve signed-in posts search add/remove favorite branches and existing toast messages while integrating continuation in `src/runtime/hooks/usePostsSearchPageRuntime.js`
- [X] T048 [P] [US4] Preserve signed-in post detail add/remove favorite branch and existing toast messages while integrating continuation in `src/runtime/hooks/usePostDetailRuntime.js`

**Checkpoint**: Signed-in favorite behavior remains unchanged across all applicable pages.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Add browser-level coverage, run focused validation, and complete repo workflow evidence.

- [X] T049 [P] Add Playwright coverage for dialog opening, no popup before primary click, primary click uses Google continuation without login page navigation or email/password form rendering, reload clearing pending intent, signed-in no-dialog behavior, weather favorites, member favorites, likes, comments, report menus, event participation, post composer, running records, and all non-listed routes in `tests/e2e/favorite-login-continuation.spec.js`
- [X] T050 [P] Add source-level scope guard tests proving only supported event/post favorite entry points import or render the continuation flow, excluded auth paths never import or call email/password auth helpers or full login page routing, and excluded weather favorites, member favorites, likes, comments, report menus, event participation, post composer, running records in `src/app/runs/page.jsx`, `src/runtime/hooks/useRunsPageRuntime.js`, `src/ui/runs/RunsPageScreen.jsx`, `src/runtime/server/use-cases/strava-server-use-cases.js`, and non-listed routes do not, in `tests/unit/runtime/favorite-login-continuation-scope.test.js`
- [X] T051 Run focused helper, use-case, hook, and dialog validation and fix failures in `tests/unit/runtime/favorite-login-continuation-helpers.test.js`, `tests/unit/runtime/favorite-login-continuation-use-cases.test.js`, `tests/unit/runtime/useFavoriteLoginContinuation.test.jsx`, and `tests/integration/favorites/FavoriteLoginContinuationDialog.test.jsx`
- [X] T052 Run focused event validation and fix failures in `tests/unit/runtime/useEventsPageRuntime.test.jsx`, `tests/unit/runtime/useEventDetailRuntime.test.jsx`, `tests/unit/ui/events/EventsPageScreen.test.jsx`, and `tests/unit/ui/events/EventDetailScreen.test.jsx`
- [X] T053 Run focused post validation and fix failures in `tests/unit/runtime/usePostsPageRuntime.test.jsx`, `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`, `tests/unit/runtime/usePostDetailRuntime.test.jsx`, `tests/unit/ui/posts/PostsPageScreen.test.jsx`, `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`, `tests/unit/ui/posts/PostDetailScreen.test.jsx`, and `tests/unit/components/PostCard.test.jsx`
- [X] T054 Run branch quality gates from `specs/106-favorite-login-continuation/quickstart.md` and record command exit codes in `specs/106-favorite-login-continuation/tasks.md` — Evidence: `npm run lint:branch` exit 0 (`No JS files changed on this branch.`); `npm run type-check:branch` exit 0 (`No JS files changed on this branch.`); `npm run test:branch` exit 0 (`Test gate disabled for testless reset`); `npm run test:e2e:branch` exit 0 (`Test gate disabled for testless reset`). Working-tree supplemental gates: `npm run lint:changed` exit 0 (0 errors, 18 JSDoc warnings in Playwright e2e); `npm run type-check:changed` exit 0; `npm run spellcheck` exit 0; focused `npx vitest run ...` exit 0 (16 files, 162 tests); race-runtime `npx vitest run ...` exit 0 (5 files, 50 tests); `PORT=3106 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 CI=1 firebase emulators:exec --only auth,firestore,storage --project dive-into-run "npx playwright test tests/e2e/favorite-login-continuation.spec.js"` exit 0 (5 passed).
- [X] T055 Request Reviewer check for the task-local diff and record PASS/REJECT evidence in `specs/106-favorite-login-continuation/tasks.md` — Reviewer Hooke PASS: no blocking findings. Reviewer verification: shared continuation tests exit 0 (3 files, 32 tests), race runtime tests exit 0 (5 files, 50 tests), `git diff --check origin/main` exit 0. Residual non-blocking risks recorded by reviewer: route-change unmount does not abort pending continuation, and Playwright auth popup uses bounded retry for emulator flake.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundation**: Depends on Phase 1 and blocks all user stories.
- **US1 Event continuation**: Depends on Phase 2. This is the MVP path.
- **US2 Post continuation**: Depends on Phase 2 and can run parallel with US1 after shared files settle.
- **US3 Cancel/retry/failure**: Depends on Phase 2; should be completed before closeout because it hardens the shared continuation contract used by US1 and US2.
- **US4 Signed-in regression**: Depends on US1 and US2 runtime wiring because it validates the touched signed-in branches.
- **Phase 7 Polish**: Depends on the desired user stories being implemented and reviewed.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories after Foundation.
- **US2 (P1)**: No dependency on US1 after Foundation, but shares the same hook/dialog contract.
- **US3 (P2)**: Depends on shared Foundation; validates and hardens behavior used by US1/US2.
- **US4 (P2)**: Depends on US1/US2 changes to verify signed-in behavior did not regress.

### Within Each User Story

- Write failing tests first.
- Implement only the minimum production code needed to pass those tests.
- Keep Firebase/Auth/Favorite writes in `src/runtime/client/use-cases/` and existing repo/service layers.
- Keep runtime state and side effects in `src/runtime/hooks/`.
- Keep UI screens render-only and pass dialog state/handlers through props.
- Run focused tests before moving to the next story checkpoint.

---

## Parallel Opportunities

- T003 and T004 can run in parallel because they write different foundational test files.
- T012, T013, T014, and T015 can run in parallel because event runtime and UI test files are separate.
- T016 and T017 can run in parallel after US1 tests exist because event list and event detail runtimes are separate files.
- T020 through T026 can run in parallel because each post test target is a different file.
- T027 through T032 can run in parallel after US2 tests exist because each post runtime/screen target is a different file.
- T039 through T043 can run in parallel because each signed-in regression target is a different test file.

### Parallel Example: US1

```text
Task: T012 Extend `tests/unit/runtime/useEventsPageRuntime.test.jsx`
Task: T013 Add `tests/unit/runtime/useEventDetailRuntime.test.jsx`
Task: T014 Add `tests/unit/ui/events/EventsPageScreen.test.jsx`
Task: T015 Extend `tests/unit/ui/events/EventDetailScreen.test.jsx`
```

### Parallel Example: US2

```text
Task: T020 Add `tests/unit/runtime/usePostsPageRuntime.test.jsx`
Task: T021 Extend `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`
Task: T022 Extend `tests/unit/runtime/usePostDetailRuntime.test.jsx`
Task: T024 Extend `tests/unit/ui/posts/PostsPageScreen.test.jsx`
Task: T025 Extend `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`
Task: T026 Extend `tests/unit/ui/posts/PostDetailScreen.test.jsx`
```

### Parallel Example: US4

```text
Task: T039 Add `tests/unit/runtime/useEventsPageRuntime.test.jsx` signed-in regression
Task: T041 Add `tests/unit/runtime/usePostsPageRuntime.test.jsx` signed-in regression
Task: T042 Add `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx` signed-in regression
Task: T043 Add `tests/unit/runtime/usePostDetailRuntime.test.jsx` signed-in regression
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Run focused event validation from `specs/106-favorite-login-continuation/quickstart.md`.
4. Stop for review/demo if the goal is the smallest useful increment.

### Incremental Delivery

1. Foundation: helper, use-case, hook, dialog.
2. US1: event continuation MVP.
3. US2: post continuation parity.
4. US3: cancellation, retry, and failure hardening.
5. US4: signed-in regression lock.
6. Phase 7: Playwright/manual validation, branch gates, Reviewer.

### Parallel Team Strategy

1. One engineer owns Foundation shared files until T011 completes.
2. After Foundation, split event runtime/UI, post runtime/UI, and failure-regression tests across separate agents.
3. Avoid parallel edits to the same runtime hook or test file; merge one story's changes before another story touches the same file.
4. Reviewer checks the final task-local diff before completion claims.

---

## Notes

- The continuation path is add-only: it calls `addContentFavorite` and must never call `removeContentFavorite`.
- Pending intent is memory-only and must not use localStorage, sessionStorage, URL params, cookies, IndexedDB, Firestore, or a global provider.
- The dialog must never render target title, target name, target id, author, host, or favorite-state details.
- Auth cancel, popup close, auth failure, and no uid keep the dialog open and do not show favorite failure toast.
- Favorite add failure closes the dialog, clears intent, leaves the clicked item unfavorited/unchanged, and shows `收藏失敗，請稍後再試`.
- The continuation path must call `signInWithGoogle` directly; it must not navigate to a full login page, render an email/password form, or import/call email/password auth helpers.
- Weather favorites, member favorites, running records (`src/app/runs/page.jsx`, `src/runtime/hooks/useRunsPageRuntime.js`, `src/ui/runs/RunsPageScreen.jsx`, `src/runtime/server/use-cases/strava-server-use-cases.js`), comments, likes, report menus, event participation, post composer, and non-listed routes must not open this flow.
- Do not stage, commit, push, open PRs, merge, or sync local `main` without separate explicit authorization.
