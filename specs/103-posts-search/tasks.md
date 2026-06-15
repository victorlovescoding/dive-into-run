# Tasks: 文章搜尋

**Input**: Design documents from `/specs/103-posts-search/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/posts-search-ui-contract.md`, `quickstart.md`
**Scope/Risk**: P4 Spec Kit task artifact; implementation work is P2/P3 product code and still needs separate authorization before edits.
**Tests**: Required by constitution and `quickstart.md`; write failing tests before implementation tasks.
**Branch Note**: Generated on `103-posts-search`; local branch is ahead of `origin/main` by 2 commits. `handoff.md` and `status.json` do not exist for this feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete work.
- **[Story]**: User story label from `spec.md` (`US1`, `US2`, `US3`, `US4`).
- Every task names the exact file path(s) it owns.
- Do not run two subagents against the same file at the same time, even if both tasks are in the same phase.

## Phase 1: Setup (Shared Test Infrastructure)

**Purpose**: Create shared fixtures/mocks so later TDD tasks can run in parallel without each subagent inventing incompatible post data.

- [ ] T001 Create shared post search fixture builders in `tests/_helpers/posts-search-fixtures.js`
- [ ] T002 [P] Create shared router/searchParams/user-event mocks for posts search tests in `tests/_helpers/posts-search-runtime-mocks.jsx`

**Checkpoint**: Shared test inputs are ready; foundational test tasks can start in parallel.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the search data contract, candidate scanning, visibility filtering, hydration, and dedupe rules that all user stories depend on.

**Critical**: No user story implementation should start until T006-T009 are complete and T010 passes.

### Tests First

- [ ] T003 [P] Add failing unit tests for keyword trim/case-fold, public active visibility exclusion, title/content matching, hit tier sorting, snippet, and highlight metadata in `tests/unit/service/post-service.test.js`
- [ ] T004 [P] Add failing unit tests for candidate pagination scan, active filter page fill, cursor advancement, `hasMore`, and `scannedCount` in `tests/unit/runtime/post-use-cases.test.js`
- [ ] T005 [P] Add failing unit tests for hydration, id-based dedupe, favorite/liked flags, and result removal helpers in `tests/unit/runtime/usePostsPageRuntimeHelpers.test.js`

### Implementation

- [ ] T006 Implement exported search keyword normalization, post matching, result sorting, snippet, and highlight metadata helpers in `src/service/post-service.js`
- [ ] T007 [P] Add candidate post page repository APIs ordered by `postAt desc` and `documentId desc` in `src/repo/client/firebase-posts-repo.js`
- [ ] T008 Implement `searchPublicActivePosts` candidate scanning, active filtering, page fill, cursor, `hasMore`, and `scannedCount` in `src/runtime/client/use-cases/post-use-cases.js`
- [ ] T009 Implement reusable hydration, dedupe, favorite/liked, and remove-by-id helpers for posts/search results in `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
- [ ] T010 Run foundational Vitest targets for `tests/unit/service/post-service.test.js`, `tests/unit/runtime/post-use-cases.test.js`, and `tests/unit/runtime/usePostsPageRuntimeHelpers.test.js`

**Checkpoint**: Search use-case returns public active, deduped, sorted `PostSearchMatch` results with stable cursor semantics.

---

## Phase 3: User Story 1 - 從文章河道搜尋公開文章 (Priority: P1) MVP

**Goal**: `/posts` exposes a search entry; valid submit navigates to `/posts/search?q={keyword}`; blank submit stays put with a prompt; the search page restores keyword/results from URL and clearing the form returns to `/posts`.

**Independent Test**: From `/posts`, submit a valid keyword by Enter/button and confirm navigation to `/posts/search?q={keyword}` with retained keyword/results; submit blank text and confirm no navigation; refresh `/posts/search?q={keyword}` and confirm results reload without replacing `/posts` feed state.

### Tests First

- [ ] T011 [P] [US1] Add failing search form tests for blank submit prompt, Enter submit, button submit, trim, and URL encoding in `tests/unit/ui/posts/PostSearchForm.test.jsx`
- [ ] T012 [P] [US1] Add failing `/posts` screen tests for search form placement after `h1`, no main feed mutation, and existing compose prompt behavior in `tests/unit/ui/posts/PostsPageScreen.test.jsx`
- [ ] T013 [P] [US1] Add failing search runtime tests for missing/blank `q` redirect, valid `q` initial load, search input hydration, submit navigation, and clear-to-`/posts` behavior in `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`

### Implementation

- [ ] T014 [US1] Implement reusable search form behavior and accessibility in `src/ui/posts/PostSearchForm.jsx`
- [ ] T015 [P] [US1] Add search form CSS module styles in `src/ui/posts/PostSearchForm.module.css`
- [ ] T016 [US1] Insert `PostSearchForm` after the `h1` and before `ComposePrompt` in `src/ui/posts/PostsPageScreen.jsx`
- [ ] T017 [US1] Implement URL validation, keyword state, initial search load, submit navigation, and clear-to-`/posts` behavior in `src/runtime/hooks/usePostsSearchPageRuntime.js`
- [ ] T018 [US1] Implement initial search result page composition with retained search form and basic result list in `src/ui/posts/PostsSearchPageScreen.jsx`
- [ ] T019 [US1] Add thin App Router entry for `/posts/search` in `src/app/posts/search/page.jsx`
- [ ] T020 [US1] Run US1 targets for `tests/unit/ui/posts/PostSearchForm.test.jsx`, `tests/unit/ui/posts/PostsPageScreen.test.jsx`, and `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`

**Checkpoint**: MVP route and search entry are functional and independently testable.

---

## Phase 4: User Story 2 - 以可理解的結果找到命中文章 (Priority: P2)

**Goal**: Search results include title/content matches for public active posts, rank title hits before content-only hits, sort each tier by `postAt desc` then id desc, and show snippet/highlight metadata that explains why each result matched.

**Independent Test**: Use title-hit, content-only-hit, title+content-hit, equal-time, soft-deleted, and account-hidden fixtures to verify inclusion, exclusion, stable ordering, content-hit snippet, and highlight rendering.

### Tests First

- [ ] T021 [P] [US2] Extend failing service tests for title hit priority, content-only hit, title+content tiering, same-`postAt` id desc tie-break, case-insensitive English, literal Chinese contains, content snippet, and highlight ranges in `tests/unit/service/post-service.test.js`
- [ ] T022 [P] [US2] Add failing result screen tests for highlighted title/snippet rendering, content-hit snippet display, and no unsafe HTML rendering in `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`
- [ ] T023 [P] [US2] Add failing component tests for optional search snippet/highlight props on result cards in `tests/unit/components/PostCard.test.jsx`

### Implementation

- [ ] T024 [US2] Complete stable comparator, first-match snippet, and highlight range generation in `src/service/post-service.js`
- [ ] T025 [US2] Propagate `PostSearchMatch` metadata from `searchPublicActivePosts` in `src/runtime/client/use-cases/post-use-cases.js`
- [ ] T026 [US2] Add optional search snippet/highlight rendering props to `PostCard` without changing default feed rendering in `src/components/PostCard.jsx`
- [ ] T027 [P] [US2] Add highlight and search snippet styles in `src/components/PostCard.module.css`
- [ ] T028 [US2] Map search match metadata into result cards in `src/ui/posts/PostsSearchPageScreen.jsx`
- [ ] T029 [US2] Run US2 targets for `tests/unit/service/post-service.test.js`, `tests/unit/runtime/post-use-cases.test.js`, `tests/unit/components/PostCard.test.jsx`, and `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`

**Checkpoint**: Results are explainable, sorted by contract, and highlighted without HTML injection.

---

## Phase 5: User Story 3 - 在搜尋結果中延續文章河道互動 (Priority: P2)

**Goal**: Search result cards preserve post feed mental model: anonymous users can search/read but cannot perform login-required interactions; logged-in users see liked/favorite state; authors see owner actions; title/comment navigation reaches the detail page.

**Independent Test**: Run the same result fixtures as anonymous, logged-in non-author, and author; verify card state, disabled/login-required interactions, owner menu, like/favorite optimistic state, delete removal, history modal, and detail navigation.

### Tests First

- [ ] T030 [P] [US3] Add failing search runtime tests for anonymous interaction guard, liked/favorite hydration, optimistic rollback, owner menu, delete removal, history modal, and detail/comment navigation handlers in `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`
- [ ] T031 [P] [US3] Add failing `PostCard` compatibility tests for search result like, favorite, owner menu, delete, title navigation, comment count navigation, and history callbacks in `tests/unit/components/PostCard.test.jsx`

### Implementation

- [ ] T032 [US3] Reuse post like, favorite, delete, owner menu, and history handlers with optimistic rollback in `src/runtime/hooks/usePostsSearchPageRuntime.js`
- [ ] T033 [US3] Wire search result cards to detail, comment count, like, favorite, owner menu, delete, and history handlers in `src/ui/posts/PostsSearchPageScreen.jsx`
- [ ] T034 [US3] Preserve anonymous login-required behavior and default feed behavior while supporting search result props in `src/components/PostCard.jsx`
- [ ] T035 [US3] Run US3 targets for `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`, `tests/unit/components/PostCard.test.jsx`, and `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`

**Checkpoint**: Search cards behave like feed cards without exposing authenticated interactions to anonymous users.

---

## Phase 6: User Story 4 - 處理大量結果、空結果與錯誤狀態 (Priority: P3)

**Goal**: The search page supports infinite scroll, load-more dedupe, loading states, empty state, recoverable initial/load-more failures, retry with retained keyword, and candidate scan measurement for the 2-second first-result target.

**Independent Test**: Use many-result, zero-result, duplicate-page, initial-failure, and load-more-failure fixtures to verify loading, append, dedupe, empty copy, error copy, retry, and retained keyword.

### Tests First

- [ ] T036 [P] [US4] Add failing use-case tests for load-more dedupe, exhausted cursor, empty result after exhausted candidates, initial operational failure, and load-more operational failure in `tests/unit/runtime/post-use-cases.test.js`
- [ ] T037 [P] [US4] Add failing search runtime tests for `IntersectionObserver` load more, retry, load-more failure preserving existing items, invalid `q` redirect, and retained keyword after error in `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`
- [ ] T038 [P] [US4] Add failing result screen tests for initial loading, empty copy, error block, retry button, loading-more state, terminal no-more state, and no compose prompt in `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`

### Implementation

- [ ] T039 [US4] Implement search runtime status machine, retry, load-more, `bottomRef` observer, and failure handling in `src/runtime/hooks/usePostsSearchPageRuntime.js`
- [ ] T040 [US4] Ensure load-more append dedupes by post id and deleted/hidden result removal stays reusable in `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
- [ ] T041 [US4] Render loading, empty, error, retry, loading-more, terminal `hasMore`, and no-compose states in `src/ui/posts/PostsSearchPageScreen.jsx`
- [ ] T042 [P] [US4] Add search result screen CSS module styles for state blocks, retry actions, and sentinel layout in `src/ui/posts/PostsSearchPageScreen.module.css`
- [ ] T043 [US4] Add `scannedCount` and elapsed-time measurement around search candidate scans in `src/runtime/client/use-cases/post-use-cases.js`
- [ ] T044 [US4] Run US4 targets for `tests/unit/runtime/post-use-cases.test.js`, `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`, and `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`

**Checkpoint**: Large, empty, and failed searches are recoverable and do not duplicate results.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regression coverage, verification, manual quickstart validation, and reviewer handoff.

- [ ] T045 [P] Add final regression tests that `/posts` feed ordering, compose prompt, card interactions, and main infinite scroll remain independent from search state in `tests/unit/ui/posts/PostsPageScreen.test.jsx`
- [ ] T046 [P] Add new project dictionary entries only if spellcheck flags task-introduced identifiers in `cspell.json`
- [ ] T047 Run `git diff --check` for changed paths under `src/`, `tests/`, and `specs/103-posts-search/tasks.md`
- [ ] T048 Run `npm run lint:changed` for changed paths under `src/`, `tests/`, and `specs/103-posts-search/tasks.md`
- [ ] T049 Run `npm run type-check:changed` for changed paths under `src/`, `tests/`, and `specs/103-posts-search/tasks.md`
- [ ] T050 Run targeted Vitest for `tests/unit/service/post-service.test.js`, `tests/unit/runtime/post-use-cases.test.js`, `tests/unit/runtime/usePostsPageRuntime.test.jsx`, `tests/unit/runtime/usePostsPageRuntimeHelpers.test.js`, `tests/unit/ui/posts/PostSearchForm.test.jsx`, `tests/unit/ui/posts/PostsPageScreen.test.jsx`, `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`, and `tests/unit/components/PostCard.test.jsx`
- [ ] T051 Run `npm run lint -- --max-warnings 0` for repository-wide lint verification from `package.json`
- [ ] T052 Run `npm run type-check` for repository-wide type verification from `package.json`
- [ ] T053 Run `npm run depcruise` for layered dependency verification from `package.json`
- [ ] T054 Run `npm run spellcheck` for repository-wide spelling verification from `package.json`
- [ ] T055 Execute manual quickstart validation for `/posts` and `/posts/search` using `specs/103-posts-search/quickstart.md`
- [ ] T056 Request Reviewer check for the task-local diff against `specs/103-posts-search/spec.md`, `specs/103-posts-search/plan.md`, and `specs/103-posts-search/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on T001-T002; blocks all user stories.
- **US1 (Phase 3)**: Depends on T006-T010 because the route/runtime needs the search use-case contract.
- **US2 (Phase 4)**: Depends on T010 and can start after US1 provides the result page shell; US2 owns ranking, snippet, and highlight behavior.
- **US3 (Phase 5)**: Depends on T010 and can start after US1 provides the result page shell; US3 owns personalized card interactions.
- **US4 (Phase 6)**: Depends on US1 and the foundational cursor contract; it can begin once T017-T019 and T008 are complete.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: MVP and first deliverable. Required before a user can reach the search page through the product.
- **US2 (P2)**: Independent from US3 at the service/component level, but final screen integration in `src/ui/posts/PostsSearchPageScreen.jsx` must be coordinated.
- **US3 (P2)**: Independent from US2 at the runtime interaction level, but final `PostCard` and screen wiring must be coordinated with US2.
- **US4 (P3)**: Extends the same runtime/use-case/screen files, so do it after US1 and after any concurrent US2/US3 screen wiring is merged.

### File Ownership Constraints

- `src/service/post-service.js`: T006, T024 only; do not parallelize those two.
- `src/runtime/client/use-cases/post-use-cases.js`: T008, T025, T043 only; do not parallelize those three.
- `src/runtime/hooks/usePostsSearchPageRuntime.js`: T017, T032, T039 only; do not parallelize those three.
- `src/ui/posts/PostsSearchPageScreen.jsx`: T018, T028, T033, T041 only; do not parallelize those four.
- `src/components/PostCard.jsx`: T026, T034 only; do not parallelize those two.
- `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`: T013, T030, T037 only; do not parallelize those three.
- `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`: T022, T038 only; do not parallelize those two.
- `tests/unit/components/PostCard.test.jsx`: T023, T031 only; do not parallelize those two.

---

## Parallel Execution Examples

### Maximum Safe Subagent Waves

1. **Wave A - Setup**: Run T001 and T002 in parallel.
2. **Wave B - Foundational tests**: Run T003, T004, and T005 in parallel.
3. **Wave C - Foundational implementation**: Run T006, T007, and T009 in parallel after their tests exist; then run T008 after T006 and T007.
4. **Wave D - US1 tests**: Run T011, T012, and T013 in parallel; then split T014/T015, T016, T017, and T018/T019 by file ownership.
5. **Wave E - P2 stories**: After US1 shell exists, one subagent can work US2 service/PostCard tasks (T021-T028) while another works US3 runtime interaction tasks (T030-T034). Coordinate before both touch `PostsSearchPageScreen.jsx` or `PostCard.jsx`.
6. **Wave F - US4 tests**: Run T036, T037, and T038 in parallel; then serialize T039, T041, and T043 around shared runtime/use-case/screen files.
7. **Wave G - Polish**: Run T045 and T046 in parallel; run T047-T056 as sequential verification/review evidence.

### Parallel Example: Foundational Tests

```bash
Task: "T003 Add failing post-service search helper tests in tests/unit/service/post-service.test.js"
Task: "T004 Add failing search use-case pagination tests in tests/unit/runtime/post-use-cases.test.js"
Task: "T005 Add failing posts runtime helper tests in tests/unit/runtime/usePostsPageRuntimeHelpers.test.js"
```

### Parallel Example: US1

```bash
Task: "T011 Add PostSearchForm tests in tests/unit/ui/posts/PostSearchForm.test.jsx"
Task: "T012 Add PostsPageScreen placement regression tests in tests/unit/ui/posts/PostsPageScreen.test.jsx"
Task: "T013 Add search runtime URL/initial-load tests in tests/unit/runtime/usePostsSearchPageRuntime.test.jsx"
```

### Parallel Example: P2 Split

```bash
Task: "US2 agent owns service ranking/highlight and PostCard display: T021-T028, but must not edit src/ui/posts/PostsSearchPageScreen.jsx while the US3 agent is editing it."
Task: "US3 agent owns runtime interaction state: T030-T034, but must not edit src/components/PostCard.jsx while the US2 agent is editing it."
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Stop and validate `/posts` submit, `/posts/search?q=`, refresh restore, blank prompt, and clear-to-`/posts`.

### Incremental Delivery

1. Add US2 ranking/snippet/highlight and validate result explainability.
2. Add US3 personalized interactions and validate anonymous/logged-in/author states.
3. Add US4 load-more/empty/error/retry and validate recovery states.
4. Run Polish verification and Reviewer check.

### Verification Notes

- `npm run test`, `npm run test:branch`, and e2e branch scripts are documented as disabled stubs; do not treat them as acceptance evidence.
- Use targeted Vitest commands for the new tests and record exact commands and exit codes.
- Fresh verification evidence must be one command per evidence item.
- Do not mark any task `[x]` until its tests pass and the relevant lint/type/spell checks for that slice pass.
