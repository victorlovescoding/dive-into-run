# Tasks: Posts Input Validation

**Input**: Design documents from `/specs/018-posts-input-validation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/validate-post-input.md, quickstart.md

**Tests**: TDD approach — 每個 implementation task 前皆有對應的 test task（RED → GREEN）。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 本 feature 不需要 setup — 既有專案，不新增依賴或結構變更。

（無 task）

---

## Phase 2: Foundational — validatePostInput 純函式 + 常數

**Purpose**: 建立所有 user story 共用的驗證純函式與常數。

**⚠️ CRITICAL**: US1、US2、US3 的 implementation 全部依賴此階段完成。

### Test (RED)

- [x] T001 Write unit test for validatePostInput covering empty checks (US1) and length checks (US2) per contract behavior table + spec edge cases (emoji, leading/trailing spaces, both-empty merge) in `specs/018-posts-input-validation/tests/unit/validate-post-input.test.js`

### Implementation (GREEN)

- [x] T002 Implement validatePostInput + export POST_TITLE_MAX_LENGTH (50) + POST_CONTENT_MAX_LENGTH (10000) in `src/lib/firebase-posts.js`

**Checkpoint**: validatePostInput 純函式通過所有 unit tests，常數已 export。

---

## Phase 3: US1 — 空白文章無法送出 + US2 — 超過字數上限時提示 (P1+P2) 🎯 MVP

**Goal**: 使用者在建立或編輯文章時，若標題/內容為空白或超過字數上限，系統阻止送出並顯示 toast 提示。

**Independent Test**: 在建立文章表單中只輸入空格後按送出，驗證系統拒絕送出並顯示提示訊息。

> **Note**: US1（空白驗證）和 US2（字數上限）共用相同的 `validatePostInput` 呼叫，無法拆分為獨立 task。合併於此 phase。

### Tests (RED) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [P] [US1+US2] Write integration test for page.jsx create/edit form validation (including valid-input happy path) in `specs/018-posts-input-validation/tests/integration/post-form-validation.test.jsx`
- [x] T004 [P] [US1+US2] Write integration test for PostDetailClient.jsx edit form validation (including valid-input happy path) in `specs/018-posts-input-validation/tests/integration/post-edit-validation.test.jsx`

### Implementation (GREEN)

- [x] T005 [P] [US1+US2] Add validatePostInput + showToast + early return to handleSubmitPost in `src/app/posts/page.jsx`
- [x] T006 [P] [US1+US2] Add validatePostInput + showToast + early return to handleSubmitPost in `src/app/posts/[id]/PostDetailClient.jsx`

**Checkpoint**: US1+US2 fully functional — 空白/超長文章在 UI 層被攔截，toast 正確顯示。Integration tests 全數通過。

---

## Phase 4: US3 — Service 層獨立驗證（Defense-in-Depth）(P3)

**Goal**: `createPost` / `updatePost` 獨立執行 validatePostInput，確保繞過 UI 時仍攔截不合規資料。

**Independent Test**: 在 unit test 中直接呼叫 `createPost({ title: '', content: '', user })`，驗證 function 拋出錯誤而非寫入 Firestore。

⚡ **可與 Phase 3 平行執行**（修改不同檔案：Phase 3 修改 page.jsx / PostDetailClient.jsx，Phase 4 修改 firebase-posts.js）

### Tests (RED) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US3] Write unit test for createPost validation guard (mock Firestore) in `specs/018-posts-input-validation/tests/unit/create-post-validation.test.js`
- [x] T008 [P] [US3] Write unit test for updatePost validation guard (mock Firestore) in `specs/018-posts-input-validation/tests/unit/update-post-validation.test.js`

### Implementation (GREEN)

- [x] T009 [US3] Add validatePostInput guard + throw Error to createPost in `src/lib/firebase-posts.js`
- [x] T010 [US3] Add validatePostInput guard + throw Error to updatePost in `src/lib/firebase-posts.js`

**Checkpoint**: Service 層 defense-in-depth 完成 — 不合規資料在 service 層被攔截，拋出描述性 Error（`createPost: 請輸入標題`）。Unit tests 全數通過。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 最終品質驗證

- [x] T011 Run `npm run type-check` + `npm run lint` + getDiagnostics + quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 2 (Foundational)
    │
    ├──▶ Phase 3 (US1+US2: UI validation)  ─┐
    │                                         ├──▶ Phase 5 (Polish)
    └──▶ Phase 4 (US3: Service guards)  ─────┘
```

- **Phase 2**: No dependencies — start immediately. **BLOCKS all user stories**
- **Phase 3**: Depends on Phase 2 completion
- **Phase 4**: Depends on Phase 2 completion. ⚡ Can run in parallel with Phase 3
- **Phase 5**: Depends on Phase 3 + Phase 4 completion

### TDD Flow Within Each Phase

```text
Tests (RED) ──▶ Implementation (GREEN)
```

- Tests MUST be written and FAIL before implementation
- [P] test tasks can run in parallel (different files)
- [P] implementation tasks can run in parallel (different files)
- Test → Implementation for the same feature: **sequential**

### User Story Dependencies

- **US1+US2 (P1+P2)**: Depends on Phase 2. No dependencies on US3.
- **US3 (P3)**: Depends on Phase 2. No dependencies on US1+US2.

### Parallel Opportunities

**Phase 3** (US1+US2):

- T003 ‖ T004（integration tests — different files）
- T005 ‖ T006（implementations — different files）

**Phase 4** (US3):

- T007 ‖ T008（unit tests — different files）
- T009 → T010（implementations — **same file** `firebase-posts.js`，must be sequential）

**Cross-Phase**:

- Phase 3 ‖ Phase 4（different source files）

---

## Parallel Example

```bash
# After Phase 2 completes, launch Phase 3 + Phase 4 tests in parallel:
Task: T003 "Integration test for page.jsx form validation"
Task: T004 "Integration test for PostDetailClient.jsx edit validation"
Task: T007 "Unit test for createPost validation guard"
Task: T008 "Unit test for updatePost validation guard"

# Then launch implementations in parallel (where possible):
Task: T005 "page.jsx handleSubmitPost validation"
Task: T006 "PostDetailClient handleSubmitPost validation"
Task: T009 "createPost guard in firebase-posts.js"
# T010 waits for T009 (same file)
```

---

## Implementation Strategy

### MVP First (Phase 2 + Phase 3)

1. Complete Phase 2: validatePostInput + constants
2. Complete Phase 3: UI validation (page.jsx + PostDetailClient.jsx)
3. **STOP and VALIDATE**: 空白/超長文章已被 UI 攔截
4. 此時 US1+US2 已可 demo

### Full Delivery (+ Phase 4)

5. Complete Phase 4: Service layer guards
6. Complete Phase 5: Final validation
7. Defense-in-depth 完成，所有層級驗證一致

---

## Notes

- US1 和 US2 共用 `validatePostInput` 呼叫，無法拆分為獨立 task
- T009 / T010 修改同一檔案 `firebase-posts.js`，不可平行
- 每個 task 完成後須通過 `npm run type-check` + `npm run lint`
- 驗證邏輯不得新增 UI 元素（只用既有 `showToast`）
- 不做即時字數 counter（留給 UI redesign）
