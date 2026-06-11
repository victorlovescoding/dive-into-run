# Tasks: Comment Identity Hint Consistency

**Input**: Design documents from `specs/099-comment-identity-hint/`
**Prerequisites**: `specs/099-comment-identity-hint/plan.md`, `specs/099-comment-identity-hint/spec.md`, `specs/099-comment-identity-hint/research.md`, `specs/099-comment-identity-hint/data-model.md`, `specs/099-comment-identity-hint/contracts/comment-composer-ui.md`, `specs/099-comment-identity-hint/quickstart.md`
**Tests**: Included because `specs/099-comment-identity-hint/plan.md`, `specs/099-comment-identity-hint/quickstart.md`, and `.specify/memory/constitution.md` require focused failing tests before implementation.
**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an independent increment while respecting shared-file conflicts.

## Task Counts Summary

- Total tasks: 43
- Setup tasks: 3
- Foundation tasks: 2
- User Story 1 tasks: 8
- User Story 2 tasks: 5
- User Story 3 tasks: 4
- User Story 4 tasks: 9
- Polish tasks: 12

## Format: `- [ ] TNNN [P?] [US?] Description with exact file path`

- **[P]**: Can run in parallel with other currently available tasks because it uses different files and does not depend on incomplete work
- **[Story]**: User story label, required only in user story phases
- Every task includes exact repo-relative file paths

## Path Conventions

- Source files live under `src/`
- Executable tests live under `tests/`
- Spec artifacts live under `specs/099-comment-identity-hint/`
- No Firestore schema, rules, migration, environment, dependency, staging, commit, push, or PR work is in scope for this feature

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the bounded implementation surface and required evidence before source changes.

- [Ｘ] T001 Review implementation scope, non-goals, and verification commands in `specs/099-comment-identity-hint/plan.md`
- [Ｘ] T002 [P] Review UI rendering, avatar, validation, and submit contract requirements in `specs/099-comment-identity-hint/contracts/comment-composer-ui.md`
- [Ｘ] T003 [P] Verify the default avatar fallback asset exists and is usable at `public/default-avatar.png`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Identify shared component/runtime entry points that block all user story implementation.

**Critical**: No user story source edit should begin until this phase is complete.

- [Ｘ] T004 [P] Inspect the shared composer API and local draft behavior in `src/components/CommentInput.jsx` and `src/components/useCommentComposerInput.js`
- [Ｘ] T005 [P] Inspect post and event composer integration points in `src/ui/posts/PostDetailScreen.jsx` and `src/components/CommentSection.jsx`

**Checkpoint**: Shared composer entry points are known, and implementation can proceed without changing Firestore schema, rules, collections, or environment files.

---

## Phase 3: User Story 1 - Authenticated User Confirms Comment Identity (Priority: P1)

**Goal**: Authenticated users see their current account avatar beside the bottom composer on both post detail and event detail pages, with the same avatar/input/submit layout.

**Independent Test**: Sign in with a user that has `photoURL`, open a post detail page and an event detail page, and verify the bottom composer shows the same current-user avatar, accepts typing, and keeps the avatar display-only.

### Tests for User Story 1

- [Ｘ] T006 [P] [US1] Add failing authenticated current-user avatar and display-only assertions for shared composer in `tests/unit/components/CommentInput.test.jsx`
- [Ｘ] T007 [P] [US1] Add failing authenticated event composer identity pass-through assertions in `tests/unit/components/CommentSection.test.jsx`
- [Ｘ] T008 [P] [US1] Add failing authenticated post composer shared-component assertions in `tests/unit/ui/posts/PostDetailScreen.test.jsx`

### Implementation for User Story 1

- [Ｘ] T009 [US1] Update `src/components/CommentInput.jsx` to render a circular non-clickable current-user avatar on the left, text input in the middle, and submit button on the right
- [Ｘ] T010 [US1] Update `src/components/CommentInput.module.css` to make the shared composer bottom-fixed, circular-avatar aligned, and non-overlapping on mobile and desktop widths
- [Ｘ] T011 [US1] Update `src/components/CommentSection.jsx` to pass authenticated `AuthContext.user` identity into `src/components/CommentInput.jsx` for event comments
- [Ｘ] T012 [US1] Update `src/ui/posts/PostDetailScreen.jsx` to replace the post inline composer with `src/components/CommentInput.jsx` for authenticated users
- [Ｘ] T013 [US1] Update `src/ui/posts/PostDetailScreen.module.css` to remove or neutralize old inline composer layout styles that conflict with the shared bottom composer

**Checkpoint**: User Story 1 is functional and independently testable for authenticated users with a real avatar on post and event pages.

---

## Phase 4: User Story 2 - Fallback Avatar Still Identifies Comment Entry (Priority: P2)

**Goal**: Authenticated users without a usable avatar see `public/default-avatar.png` in the same composer position on both post and event pages, without missing images or blank placeholders.

**Independent Test**: Sign in with a user whose `photoURL` is missing or empty, open a post detail page and an event detail page, and verify the bottom composer displays the default avatar and still allows input and submit.

### Tests for User Story 2

- [Ｘ] T014 [P] [US2] Add failing default-avatar fallback assertions for missing and empty `photoURL` in `tests/unit/components/CommentInput.test.jsx`
- [Ｘ] T015 [P] [US2] Add failing event composer fallback-avatar assertions in `tests/unit/components/CommentSection.test.jsx`
- [Ｘ] T016 [P] [US2] Add failing post composer fallback-avatar assertions in `tests/unit/ui/posts/PostDetailScreen.test.jsx`

### Implementation for User Story 2

- [Ｘ] T017 [US2] Update `src/components/CommentInput.jsx` to use `/default-avatar.png` when the authenticated user has no usable `photoURL`
- [Ｘ] T018 [US2] Update `src/components/CommentInput.module.css` so fallback avatar images stay circular, visible, and aligned in the shared composer

**Checkpoint**: User Story 2 is functional and independently testable for authenticated users without a real avatar on post and event pages.

---

## Phase 5: User Story 3 - Anonymous Users Do Not See Comment Fields (Priority: P2)

**Goal**: Anonymous users see no composer, avatar, input, submit button, login prompt, or login CTA on post detail or event detail pages.

**Independent Test**: Sign out, open a post detail page and an event detail page, and verify there is no bottom composer and no new login prompt or login routing UI.

### Tests for User Story 3

- [Ｘ] T019 [P] [US3] Add failing anonymous hidden-composer and no-login-CTA assertions for events in `tests/unit/components/CommentSection.test.jsx`
- [Ｘ] T020 [P] [US3] Add failing anonymous hidden-composer and no-login-CTA assertions for posts in `tests/unit/ui/posts/PostDetailScreen.test.jsx`

### Implementation for User Story 3

- [Ｘ] T021 [P] [US3] Update `src/components/CommentSection.jsx` to render no `src/components/CommentInput.jsx` and no login prompt when `AuthContext.user` is absent
- [Ｘ] T022 [P] [US3] Update `src/ui/posts/PostDetailScreen.jsx` to render no shared composer and no login prompt when the post viewer is anonymous

**Checkpoint**: User Story 3 is functional and independently testable for anonymous users on post and event pages.

---

## Phase 6: User Story 4 - Submit State Is Consistent And Prevents Mistakes (Priority: P3)

**Goal**: Post and event composers share validation behavior: empty, whitespace-only, and over-500-character drafts cannot submit; successful submit clears the draft; pending submit blocks duplicates.

**Independent Test**: On post and event pages, try empty content, whitespace-only content, over-500-character content, valid content, and repeated submit while pending; verify button state, submit calls, clear-on-success, and duplicate prevention match.

### Tests for User Story 4

- [Ｘ] T023 [P] [US4] Add failing shared composer validation, clear-on-success, preserve-on-failure, and duplicate-submit assertions in `tests/unit/components/CommentInput.test.jsx`
- [Ｘ] T024 [P] [US4] Add failing event composer submit, validation, clear-on-success, preserve-on-failure, and duplicate-submit assertions in `tests/unit/components/CommentSection.test.jsx`
- [Ｘ] T025 [P] [US4] Add failing post comment runtime submit-result and duplicate-submit assertions in `tests/unit/runtime/usePostComments.test.jsx`
- [Ｘ] T026 [P] [US4] Add failing post detail submit wiring assertions for content argument, `isSubmitting`, and clear-on-success in `tests/unit/ui/posts/PostDetailScreen.test.jsx`

### Implementation for User Story 4

- [Ｘ] T027 [P] [US4] Update `src/components/useCommentComposerInput.js` to compute empty, over-500-character, submitting, and can-submit state and clear only after successful submit
- [Ｘ] T028 [US4] Update `src/components/CommentInput.jsx` to block invalid submits, pass draft content to `onSubmit`, respect `isSubmitting`, and ignore duplicate submits while pending
- [Ｘ] T029 [P] [US4] Update `src/runtime/hooks/usePostComments.js` so post submit accepts content, tracks pending submit state, returns success or failure, and blocks duplicate pending submits
- [Ｘ] T030 [US4] Update `src/ui/posts/PostDetailScreen.jsx` to wire post comment content submission and `isSubmitting` state into `src/components/CommentInput.jsx`
- [Ｘ] T031 [US4] Update `src/components/CommentInput.module.css` to keep disabled, submitting, and validation states visible without avatar/input/button overlap

**Checkpoint**: User Story 4 is functional and independently testable for validation, clear-on-success, and duplicate-submit behavior on both post and event composers.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Run focused verification and check for accidental scope expansion.

- [Ｘ] T032 Run focused jsdom UI tests from `specs/099-comment-identity-hint/quickstart.md` against `tests/unit/components/CommentInput.test.jsx`, `tests/unit/components/CommentSection.test.jsx`, and `tests/unit/ui/posts/PostDetailScreen.test.jsx`
- [Ｘ] T033 Run runtime hook Vitest coverage for post submit behavior in `tests/unit/runtime/usePostComments.test.jsx`
- [Ｘ] T034 Run `npm run lint:changed` for changed files in `src/components/CommentInput.jsx`, `src/components/CommentInput.module.css`, `src/components/CommentSection.jsx`, `src/components/useCommentComposerInput.js`, `src/runtime/hooks/usePostComments.js`, `src/ui/posts/PostDetailScreen.jsx`, `src/ui/posts/PostDetailScreen.module.css`, `tests/unit/components/CommentInput.test.jsx`, `tests/unit/components/CommentSection.test.jsx`, `tests/unit/runtime/usePostComments.test.jsx`, and `tests/unit/ui/posts/PostDetailScreen.test.jsx`
- [Ｘ] T035 Run `npm run type-check:changed` for changed files in `src/components/CommentInput.jsx`, `src/components/CommentInput.module.css`, `src/components/CommentSection.jsx`, `src/components/useCommentComposerInput.js`, `src/runtime/hooks/usePostComments.js`, `src/ui/posts/PostDetailScreen.jsx`, `src/ui/posts/PostDetailScreen.module.css`, `tests/unit/components/CommentInput.test.jsx`, `tests/unit/components/CommentSection.test.jsx`, `tests/unit/runtime/usePostComments.test.jsx`, and `tests/unit/ui/posts/PostDetailScreen.test.jsx`
- [Ｘ] T036 Run `npm run type-check:branch` from repo root as a completion gate required by `.specify/memory/constitution.md`
- [Ｘ] T037 Run `npm run lint:branch` from repo root as a completion gate required by `.specify/memory/constitution.md`
- [Ｘ] T038 Run `npm run spellcheck` from repo root as a completion gate required by `.specify/memory/constitution.md`
- [Ｘ] T039 Run `npm run test:branch` from repo root as a completion gate required by `.specify/memory/constitution.md`
- [Ｘ] T040 Run `npm run test:e2e:branch` from repo root as a completion gate required by `.specify/memory/constitution.md`
- [Ｘ] T041 Run `git diff --check` from repo root after edits described by `specs/099-comment-identity-hint/quickstart.md`
- [Ｘ] T042 Run `npm run build` from repo root after source and test changes described by `specs/099-comment-identity-hint/plan.md`
- [Ｘ] T043 With separate authorization to start the app, run the manual browser checklist in `specs/099-comment-identity-hint/quickstart.md` for post and event pages at mobile and desktop widths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T002 and T003 can run in parallel after T001 is assigned.
- **Foundational (Phase 2)**: Depends on Phase 1; T004 and T005 can run in parallel.
- **User Stories (Phases 3-6)**: Depend on Phase 2. Story behavior is independently testable, but several tasks touch shared files, so execution must avoid same-file conflicts.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 and is the MVP. It creates the shared authenticated composer shape used by later stories.
- **US2 (P2)**: Starts after US1 tasks T009 and T010 because fallback behavior extends the same `src/components/CommentInput.jsx` and `src/components/CommentInput.module.css` avatar surface.
- **US3 (P2)**: Starts after US1 task T009 because anonymous behavior depends on the shared composer contract, but event and post tasks can split between separate workers.
- **US4 (P3)**: Starts after US1 task T009. T027 and T029 can be implemented in parallel because they touch different hook files; T028 and T030 should wait for their hook changes.

### Same-File Conflict Rules

- Do not run tasks that edit `src/components/CommentInput.jsx` in parallel: T009, T017, T028.
- Do not run tasks that edit `src/components/CommentInput.module.css` in parallel: T010, T018, T031.
- Do not run tasks that edit `src/components/CommentSection.jsx` in parallel: T011, T021.
- Do not run tasks that edit `src/ui/posts/PostDetailScreen.jsx` in parallel: T012, T022, T030.
- Do not run tasks that edit `tests/unit/components/CommentInput.test.jsx` in parallel: T006, T014, T023.
- Do not run tasks that edit `tests/unit/components/CommentSection.test.jsx` in parallel: T007, T015, T019, T024.
- Do not run tasks that edit `tests/unit/ui/posts/PostDetailScreen.test.jsx` in parallel: T008, T016, T020, T026.
- `tests/unit/runtime/usePostComments.test.jsx` has only T025 in this plan, so T025 can run in parallel with other US4 test tasks.

### Test-First Order

- For each user story, complete that story's test tasks and confirm they fail before source implementation tasks.
- Implement the minimum source changes to pass the story's focused tests.
- Run the story's focused tests before moving to the next story or parallel merge point.

---

## Parallel Examples

### Maximum Safe Setup/Foundation Fan-Out

```bash
# Setup phase: after T001 is assigned, up to 2 read-only workers can run T002/T003 together.
Task: "Review UI rendering, avatar, validation, and submit contract requirements in specs/099-comment-identity-hint/contracts/comment-composer-ui.md"
Task: "Verify the default avatar fallback asset exists and is usable at public/default-avatar.png"
```

```bash
# Foundation phase: after Phase 1 is complete, up to 2 read-only workers can run T004/T005 together.
Task: "Inspect the shared composer API and local draft behavior in src/components/CommentInput.jsx and src/components/useCommentComposerInput.js"
Task: "Inspect post and event composer integration points in src/ui/posts/PostDetailScreen.jsx and src/components/CommentSection.jsx"
```

### User Story 1 Parallel Tests

```bash
# Up to 3 test-first workers can run together because each task edits a different test file:
Task: "Add failing authenticated current-user avatar and display-only assertions for shared composer in tests/unit/components/CommentInput.test.jsx"
Task: "Add failing authenticated event composer identity pass-through assertions in tests/unit/components/CommentSection.test.jsx"
Task: "Add failing authenticated post composer shared-component assertions in tests/unit/ui/posts/PostDetailScreen.test.jsx"
```

### User Story 2 Parallel Tests

```bash
# Up to 3 test-first workers can run together because each task edits a different test file:
Task: "Add failing default-avatar fallback assertions for missing and empty photoURL in tests/unit/components/CommentInput.test.jsx"
Task: "Add failing event composer fallback-avatar assertions in tests/unit/components/CommentSection.test.jsx"
Task: "Add failing post composer fallback-avatar assertions in tests/unit/ui/posts/PostDetailScreen.test.jsx"
```

### User Story 4 Parallel Tests

```bash
# Up to 4 test-first workers can run together because each task edits a different test file:
Task: "Add failing shared composer validation, clear-on-success, preserve-on-failure, and duplicate-submit assertions in tests/unit/components/CommentInput.test.jsx"
Task: "Add failing event composer submit, validation, clear-on-success, preserve-on-failure, and duplicate-submit assertions in tests/unit/components/CommentSection.test.jsx"
Task: "Add failing post comment runtime submit-result and duplicate-submit assertions in tests/unit/runtime/usePostComments.test.jsx"
Task: "Add failing post detail submit wiring assertions for content argument, isSubmitting, and clear-on-success in tests/unit/ui/posts/PostDetailScreen.test.jsx"
```

### User Story 3 Parallel Implementation

```bash
# Up to 2 implementation workers can run together after US1 shared composer contract exists:
Task: "Update src/components/CommentSection.jsx to render no src/components/CommentInput.jsx and no login prompt when AuthContext.user is absent"
Task: "Update src/ui/posts/PostDetailScreen.jsx to render no shared composer and no login prompt when the post viewer is anonymous"
```

### User Story 4 Hook Parallelism

```bash
# Up to 2 hook workers can run together before final component/screen wiring:
Task: "Update src/components/useCommentComposerInput.js to compute empty, over-500-character, submitting, and can-submit state and clear only after successful submit"
Task: "Update src/runtime/hooks/usePostComments.js so post submit accepts content, tracks pending submit state, returns success or failure, and blocks duplicate pending submits"
```

### Full Team Ceiling

The practical maximum is 4 parallel workers during read/test-writing phases and 2 parallel workers during source implementation. The ceiling is lower than the number of user stories because `src/components/CommentInput.jsx`, `src/ui/posts/PostDetailScreen.jsx`, `tests/unit/components/CommentInput.test.jsx`, `tests/unit/components/CommentSection.test.jsx`, and `tests/unit/ui/posts/PostDetailScreen.test.jsx` are shared conflict points.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Write and confirm failing US1 tests T006, T007, and T008.
3. Implement T009 through T013.
4. Run the focused US1 test files and validate authenticated current-user avatar behavior on post and event composers.
5. Stop at the US1 checkpoint if only MVP is authorized.

### Incremental Delivery

1. Deliver US1 for authenticated users with real avatars.
2. Add US2 fallback-avatar behavior without changing the shared composer contract shape.
3. Add US3 anonymous hidden-composer behavior without adding login prompts or login routing.
4. Add US4 validation, clear-on-success, and duplicate-submit parity.
5. Run Phase 7 verification commands after the desired story set is complete.

### Parallel Team Strategy

1. Use parallel workers for Setup/Foundation reads and for separate test files.
2. Assign one worker as the owner of each shared source file when implementation begins.
3. Allow event and post integration workers to proceed in parallel only when they touch separate files.
4. Merge same-file changes sequentially, then run the focused tests before broad verification.
5. Do not stage, commit, push, open PRs, merge, or sync local `main` unless separately authorized.

---

## Notes

- Tests live under `tests/`, not under `specs/099-comment-identity-hint/`.
- The composer avatar must remain display-only and must not be wrapped in `UserLink`.
- Keep `/default-avatar.png` as the fallback avatar source.
- Keep the 500-character limit from `src/components/useCommentComposerInput.js`.
- Do not change comment list styling, sorting, notifications, edit/delete logic, Firestore schema, Firestore rules, login prompts, or login routing.
- If implementation evidence proves Firestore schema or rules changes are required, stop and re-scope before editing those files.
