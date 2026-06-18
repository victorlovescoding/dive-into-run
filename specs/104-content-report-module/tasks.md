# Tasks: 模組化內容檢舉系統

**Input**: Design documents from `specs/104-content-report-module/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/reports-api.md`, `quickstart.md`
**Tests**: Required. `plan.md` and the project constitution require failing tests under `tests/**` before implementation.

**Organization**: Tasks are grouped by independently testable user story. P1 stories are ordered by implementation dependency to maximize safe subagent parallelism: shared server safety and form runtime first, then post/comment UI wiring.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its listed prerequisites because it touches different files or only reads/verifies.
- **[Story]**: Required only for user story phases.
- Each task includes exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the feature workspace, directory shape, and shared fixtures without implementing story behavior.

- [X] T001 Review repo workflow, branch isolation, and feature scope in `AGENTS.md` and `specs/104-content-report-module/plan.md`
- [X] T002 Create missing report source and test directories at `src/app/api/reports/`, `src/components/reports/`, `tests/unit/api/`, `tests/integration/reports/`, and `tests/e2e/`
- [X] T003 [P] Create shared report domain fixtures for target ids, reasons, server-owned fields, and expected snapshots in `tests/_helpers/report-fixtures.js`
- [X] T004 [P] Create shared report UI test helpers for authenticated reporter, anonymous user, target author, and non-author states in `tests/_helpers/report-ui-mocks.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define stable constants and JSDoc types that every server, runtime, and UI task imports.

**Critical**: No user story implementation should start until this phase is complete.

- [X] T005 Define report target types, reason keys/labels, status values, limits, and user-facing messages in `src/constants/report-constants.js`
- [X] T006 [P] Define JSDoc typedefs for `ReportTargetType`, `TargetIdentity`, `ReportRequestPayload`, `ReportTargetSnapshot`, `ReportDocument`, and route results in `src/types/report-types.js`

**Checkpoint**: Constants and types are ready; red tests for independent story slices can now be drafted in parallel.

---

## Phase 3: User Story 4 - 阻擋未授權、重複與無效檢舉 (Priority: P1)

**Goal**: Only authenticated users can report public, active content they do not own; invalid, unavailable, self-report, duplicate, and unexpected paths return stable status/message contracts.

**Independent Test**: Call the server entry for unauthenticated, target unavailable, soft-deleted, self-report, duplicate, validation, unexpected error, and valid report scenarios; verify status codes and messages without any UI.

### Tests for User Story 4

- [X] T007 [P] [US4] Add request validation, target id trim/non-empty/slash/control-char/protocol/script/markup rejection with 400 mapping, deterministic `targetKey`, hashed report id, sourcePath fallback, and server-owned field rejection tests in `tests/unit/service/report-service.test.js`
- [X] T008 [P] [US4] Add post/postComment target resolver tests for existence, parent visibility, soft-delete, self-report, and forbidden snapshot fields in `tests/unit/service/report-target-resolver.test.js`
- [X] T009 [P] [US4] Add bearer auth, success, self-report, target unavailable, duplicate, and generic 500 mapping tests in `tests/unit/runtime/report-server-use-cases.test.js`
- [X] T010 [P] [US4] Add thin API route tests for POST delegation, malformed JSON 400, returned `{ status, body }`, and generic catch in `tests/unit/api/reports-route.test.js`
- [X] T011 [P] [US4] Add Firestore rules emulator tests denying unauthenticated, reporter, and non-reporter get/list/create/update/delete access to `reports` in `tests/server/firestore/report-rules.test.js`

### Implementation for User Story 4

- [X] T012 [US4] Implement report request validation, target identity normalization that trims ids and rejects empty ids, `/`, control characters, URL/protocol, script, and markup payloads, deterministic targetKey/reportId generation, sourcePath sanitization, and document shaping in `src/service/report-service.js`
- [X] T013 [US4] Implement Admin reads for post and postComment targets in `src/repo/server/firebase-report-target-server-repo.js`
- [X] T014 [US4] Implement Admin create/no-overwrite report writes and duplicate error mapping in `src/repo/server/firebase-report-server-repo.js`
- [X] T015 [US4] Implement post/postComment target resolution, parent active checks, self-report checks, and server snapshot mapping in `src/service/report-target-resolver.js`
- [X] T016 [US4] Implement bearer-token auth, resolver/repo orchestration, and status/body mapping in `src/runtime/server/use-cases/report-server-use-cases.js`
- [X] T017 [US4] Implement the thin `POST /api/reports` App Router adapter and generic JSON error handling in `src/app/api/reports/route.js`
- [X] T018 [US4] Add a deny-all client access block for `reports/{reportId}` in `firestore.rules`

**Checkpoint**: Server-side report creation is independently testable without UI. Client Firestore access to `reports` is denied.

---

## Phase 4: User Story 3 - 以一致表單提交檢舉理由 (Priority: P1)

**Goal**: Any supported target can use one report dialog/runtime for reason selection, details validation, pending guard, success/error copy, and modal close behavior.

**Independent Test**: Open the dialog for one supported target and verify required reason, `other` details requirement, optional non-`other` details, 500-character cap, submit disabled while pending, close while pending, and single-submit guard.

### Tests for User Story 3

- [X] T019 [P] [US3] Add client report fetch success/error mapping and duplicate/self/generic message tests in `tests/unit/runtime/report-use-cases.test.js`
- [X] T020 [P] [US3] Add dialog runtime tests for reason/details validation, pending guard, close behavior, and one-submit-only behavior in `tests/unit/runtime/useReportDialogRuntime.test.js`
- [X] T021 [P] [US3] Add dialog interaction tests for titles, preview display, reason labels, validation messages, pending disabled submit, and closable modal in `tests/integration/reports/ReportDialog.test.jsx`

### Implementation for User Story 3

- [X] T022 [US3] Implement the client `POST /api/reports` fetch use-case and response message mapping in `src/runtime/client/use-cases/report-use-cases.js`
- [X] T023 [US3] Implement reusable dialog state, validation, pending guard, and result handling in `src/runtime/hooks/useReportDialogRuntime.js`
- [X] T024 [P] [US3] Implement report dialog layout, validation, pending, and preview styles in `src/components/reports/ReportDialog.module.css`
- [X] T025 [US3] Implement the accessible reusable report modal form in `src/components/reports/ReportDialog.jsx`
- [X] T026 [US3] Implement reusable report menu item labels and target metadata adapter in `src/components/reports/ReportMenuItem.jsx`

**Checkpoint**: The report form can be tested independently from page wiring.

---

## Phase 5: User Story 5 - 建立可重用且分階段 rollout 的檢舉能力 (Priority: P2)

**Goal**: The server contract supports `post`, `postComment`, `event`, and `eventComment`, while Phase 1 UI exposes only post and postComment report entry points.

**Independent Test**: Verify all four targetType variants through service/resolver/server contracts, and verify event/eventComment UI entry points are absent in Phase 1.

### Tests for User Story 5

- [X] T027 [US5] Add four-target identity, targetKey, targetPath, payload variant, deterministic reportId, no-overwrite create, and 409 duplicate strategy tests for `post`, `postComment`, `event`, and `eventComment` in `tests/unit/service/report-service.test.js`
- [X] T028 [US5] Add event/eventComment resolver tests for parent visibility, self-report by target author, and snapshot mapping in `tests/unit/service/report-target-resolver.test.js`
- [X] T029 [P] [US5] Add Phase 1 absence tests for event and eventComment report entries in `tests/integration/reports/event-report-absence.test.jsx`

### Implementation for User Story 5

- [X] T030 [US5] Implement event and eventComment identity, targetPath, and targetKey support in `src/service/report-service.js`
- [X] T031 [US5] Implement event and eventComment Admin reads plus resolver snapshot mapping in `src/repo/server/firebase-report-target-server-repo.js` and `src/service/report-target-resolver.js`
- [X] T032 [US5] Verify no event/eventComment report props, menu items, or dialog wiring are added to `src/ui/events/EventsPageScreen.jsx` and `src/ui/events/EventDetailScreen.jsx`

**Checkpoint**: The reusable server module is Phase 2 ready, and Phase 1 event UI remains untouched.

---

## Phase 6: User Story 1 - 檢舉文章內容 (Priority: P1)

**Goal**: Authenticated non-authors can report posts from `/posts`, `/posts/search`, and `/posts/[id]`; authors and anonymous users do not see report actions.

**Independent Test**: With only `post` UI wired, verify `檢舉文章` appears in the three-dot menu for non-authors on all three post surfaces, opens `檢舉這篇文章`, submits successfully, shows success copy, and leaves the post visible.

### Tests for User Story 1

- [X] T033 [P] [US1] Add post report menu integration tests for `/posts`, `/posts/search`, and `/posts/[id]` in `tests/integration/reports/post-report-menu.test.jsx`
- [X] T034 [P] [US1] Add existing-screen unit assertions for main feed post report visibility and submit wiring in `tests/unit/ui/posts/PostsPageScreen.test.jsx`
- [X] T035 [P] [US1] Add existing-screen unit assertions for search and detail post report visibility in `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx` and `tests/unit/ui/posts/PostDetailScreen.test.jsx`

### Implementation for User Story 1

- [X] T036 [US1] Refactor the post three-dot menu so authenticated non-authors can see report actions outside the owner-only edit/delete branch in `src/components/PostCard.jsx`
- [X] T037 [P] [US1] Wire post report dialog/runtime props for main feed cards in `src/ui/posts/PostsPageScreen.jsx`
- [X] T038 [P] [US1] Wire post report dialog/runtime props for search result cards in `src/ui/posts/PostsSearchPageScreen.jsx`
- [X] T039 [US1] Wire post report dialog/runtime props for the detail page post card in `src/ui/posts/PostDetailScreen.jsx`

**Checkpoint**: Article reports work end-to-end on Phase 1 post surfaces.

---

## Phase 7: User Story 2 - 檢舉文章留言 (Priority: P1)

**Goal**: Authenticated non-authors can report normal post comments and notification `?commentId=` target comments from `/posts/[id]` without changing existing visibility or target-comment behavior.

**Independent Test**: Prepare a normal comment and notification target comment; verify `檢舉留言` appears only for authenticated non-authors, opens `檢舉這則留言`, submits successfully, keeps the comment visible, and does not introduce artificial pinned-comment behavior.

### Tests for User Story 2

- [X] T040 [P] [US2] Add post comment report menu integration tests for normal comments and `?commentId=` target comments in `tests/integration/reports/post-comment-report-menu.test.jsx`
- [X] T041 [P] [US2] Add post detail unit assertions for normal comment and notification target comment report actions in `tests/unit/ui/posts/PostDetailScreen.test.jsx`

### Implementation for User Story 2

- [X] T042 [US2] Refactor the comment three-dot menu to accept edit, delete, and report menu items with keyboard navigation in `src/components/CommentCardMenu.jsx`
- [X] T043 [US2] Update comment cards so authenticated non-owners can see report actions without owner edit/delete actions in `src/components/CommentCard.jsx`
- [X] T044 [US2] Wire normal and notification target comment report flows in `src/ui/posts/PostDetailScreen.jsx`
- [X] T045 [US2] Preserve existing notification target comment derivation and comment list behavior in `src/runtime/hooks/usePostNotificationTargetComment.js` and `src/runtime/hooks/usePostComments.js`

**Checkpoint**: Comment reports work end-to-end without changing the current target-comment UX.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Prove the feature satisfies the spec, repository gates, and Phase 1 scope limits.

- [X] T046 [P] Run `npx vitest run tests/unit/service/report-service.test.js tests/unit/service/report-target-resolver.test.js` for service and resolver coverage
- [X] T047 [P] Run `npx vitest run tests/unit/runtime/report-server-use-cases.test.js tests/unit/runtime/report-use-cases.test.js tests/unit/runtime/useReportDialogRuntime.test.js tests/unit/api/reports-route.test.js` for runtime and API coverage
- [X] T048 [P] Run `npx vitest run tests/integration/reports/ReportDialog.test.jsx tests/integration/reports/post-report-menu.test.jsx tests/integration/reports/post-comment-report-menu.test.jsx tests/integration/reports/event-report-absence.test.jsx` for UI coverage
- [X] T049 Run `firebase emulators:exec --only firestore --project dive-into-run "npx vitest run tests/server/firestore/report-rules.test.js"` for `reports` rules denial
- [X] T050 [P] Run `npm run lint:changed` for changed files under `src/`, `tests/`, and `specs/`
- [X] T051 [P] Run `npm run type-check:changed` for changed files under `src/` and `tests/`
- [X] T052 [P] Run `npm run depcruise` for dependency direction across `src/` and `specs/`
- [X] T053 [P] Run `npm run spellcheck` for changed Traditional Chinese copy in `src/` and `specs/`
- [X] T054 Verify no Firestore composite index was added for reports in `firestore.indexes.json`
- [X] T055 Perform browser visual verification from `specs/104-content-report-module/quickstart.md` with `npm run dev`; do not assume Playwright automation unless a project Playwright config is added in a separate approved task

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependency.
- **Foundational (Phase 2)**: Depends on Setup; blocks all source and test imports.
- **US4 server safety (Phase 3)**: Depends on constants/types; blocks real submissions and all UI end-to-end flows.
- **US3 form/runtime (Phase 4)**: Depends on constants/types and can run mostly in parallel with US4 tests, but final fetch integration depends on the US4 response contract.
- **US5 reusable contract (Phase 5)**: Depends on US4 service/resolver files; event/eventComment UI absence tests can run after UI test helpers exist.
- **US1 post UI (Phase 6)**: Depends on US3 dialog/runtime and US4 server API; `PostCard.jsx` refactor must complete before page wiring.
- **US2 comment UI (Phase 7)**: Depends on US3 dialog/runtime and US4 server API; should run after US1 detail wiring because both touch `src/ui/posts/PostDetailScreen.jsx`.
- **Polish (Phase 8)**: Depends on all desired story phases.

### User Story Dependencies

- **US4 (P1)**: First implementation slice; no dependency after Foundation.
- **US3 (P1)**: Can begin after Foundation; full submit behavior depends on US4 response mapping.
- **US5 (P2)**: Server contract can follow US4 and can overlap with early US3 UI work if subagents avoid shared service/resolver files.
- **US1 (P1)**: Depends on US3 and US4; page wiring can split by `PostsPageScreen.jsx`, `PostsSearchPageScreen.jsx`, and `PostDetailScreen.jsx`.
- **US2 (P1)**: Depends on US3 and US4; should follow US1 `PostDetailScreen.jsx` edits to avoid same-file conflicts.

### Within Each Story

- Write tests first and confirm they fail before implementation.
- Implement shared service/repo/runtime before App Router/page/UI wiring.
- Avoid same-file parallel edits even when tasks are adjacent.
- Mark a task complete only after its relevant tests and changed-file gates pass.

---

## Parallel Execution Examples

### After Phase 2

```text
Task: T007 report-service red tests in tests/unit/service/report-service.test.js
Task: T008 resolver red tests in tests/unit/service/report-target-resolver.test.js
Task: T009 server use-case red tests in tests/unit/runtime/report-server-use-cases.test.js
Task: T010 API route red tests in tests/unit/api/reports-route.test.js
Task: T011 Firestore rules red tests in tests/server/firestore/report-rules.test.js
Task: T019 client use-case red tests in tests/unit/runtime/report-use-cases.test.js
Task: T020 dialog runtime red tests in tests/unit/runtime/useReportDialogRuntime.test.js
Task: T021 dialog UI red tests in tests/integration/reports/ReportDialog.test.jsx
```

### Post UI Wiring After T036

```text
Task: T037 main feed wiring in src/ui/posts/PostsPageScreen.jsx
Task: T038 search page wiring in src/ui/posts/PostsSearchPageScreen.jsx
Task: T039 detail post wiring in src/ui/posts/PostDetailScreen.jsx
```

Do not run US2 `PostDetailScreen.jsx` wiring at the same time as T039.

### Final Verification

```text
Task: T046 service/resolver Vitest
Task: T047 runtime/API Vitest
Task: T048 UI Vitest
Task: T050 lint changed
Task: T051 type-check changed
Task: T052 dependency cruiser
Task: T053 spellcheck
```

Run T049 Firestore emulator separately because it owns the emulator process. Run T055 with an actual browser because this repo currently should not assume Playwright automation is configured.

---

## Implementation Strategy

### MVP First

The practical MVP is not US1 alone. Complete Phase 1, Phase 2, US4, US3, and US1 to deliver article reporting safely:

1. Complete Setup and Foundation.
2. Complete US4 server safety and report creation.
3. Complete US3 shared dialog/runtime.
4. Complete US1 post UI wiring.
5. Stop and validate post reports independently before comment UI.

### Incremental Delivery

1. Server-only safety: US4.
2. Reusable form/runtime: US3.
3. Phase 2-ready server contract: US5.
4. Article UI: US1.
5. Comment UI: US2.
6. Full verification: Phase 8.

### Parallel Team Strategy

After T005-T006, split subagents by files:

- Server service subagent: `src/service/report-service.js` and `tests/unit/service/report-service.test.js`.
- Target resolver subagent: `src/service/report-target-resolver.js`, `src/repo/server/firebase-report-target-server-repo.js`, and `tests/unit/service/report-target-resolver.test.js`.
- Server route subagent: `src/runtime/server/use-cases/report-server-use-cases.js`, `src/app/api/reports/route.js`, and related runtime/API tests.
- Rules subagent: `firestore.rules` and `tests/server/firestore/report-rules.test.js`.
- Dialog subagent: `src/runtime/hooks/useReportDialogRuntime.js`, `src/components/reports/*`, and dialog tests.
- Post UI subagents after `PostCard.jsx` stabilizes: one for `/posts`, one for `/posts/search`, and one for `/posts/[id]`.

---

## Notes

- Phase 1 must not add admin review lists, moderation actions, notifications, reporter history, media snapshots, or Firestore composite indexes.
- Client code must not import Firestore to read or write `reports`; all creation goes through `POST /api/reports`.
- Report actions must not be hidden inside owner-only menus. Non-authenticated users and target authors should not see report actions.
- Event and eventComment server support is required in Phase 1, but event/eventComment UI entry points are explicitly out of scope.
