# Tasks: 全域 Toast 通知系統

**Input**: Design documents from `/specs/009-global-toast/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Created via TDD workflow during each task implementation (per constitution I — Red/Green/Refactor)

**Organization**: Tasks grouped by user story (US1–US4 core, US1b/US1c CRUD integration) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US1b, US1c, US2, US3, US4)

---

## Phase 1: Foundational (Core Toast Infrastructure)

**Purpose**: Build the reusable Toast system (Context + Components + CSS) that ALL user stories depend on

**CRITICAL**: No page migration can begin until this phase is complete

- [x] T001 [P] Create ToastContext with useReducer (ADD/REMOVE/CLEAR_ALL), ToastProvider, useToast hook, and route-change clear via usePathname in src/contexts/ToastContext.jsx
- [x] T002 [P] Create Toast component with type-based styles (success/error/info), close button, ARIA roles (status/alert), enter/exit CSS transition animations, and long-text overflow handling (word-break/overflow-wrap) in src/components/Toast.jsx + src/components/Toast.module.css
- [x] T003 Create ToastContainer with fixed positioning (bottom-right desktop, full-width mobile), flex-column-reverse stack layout, z-index 1100, and context consumption in src/components/ToastContainer.jsx + src/components/ToastContainer.module.css
- [x] T004 Integrate ToastProvider and ToastContainer into src/app/layout.jsx

**Checkpoint**: Toast infrastructure ready — `showToast('test')` / `showToast('test', 'error')` / `showToast('test', 'info')` all work from any client component

---

## Phase 2: User Story 1 — 操作成功時看到即時回饋 (Priority: P1) MVP

**Goal**: 在活動頁面觸發成功操作後出現 Toast，取代 actionMessage inline 提示

**Independent Test**: 在活動頁面報名/取消報名，確認成功 Toast 出現、3 秒自動消失、可手動提前關閉

### Implementation for User Story 1

- [x] T005 [P] [US1] Migrate src/app/events/page.jsx — remove actionMessage state + JSX block, replace setActionMessage calls with showToast via useToast
- [x] T006 [P] [US1] Migrate src/app/events/[id]/eventDetailClient.jsx — remove actionMessage state + JSX block, replace setActionMessage calls with showToast via useToast
- [x] T007 [US1] Remove unused CSS class .successCard from src/app/events/events.module.css (.errorCard retained — still used by loadError/createError/participantsError)

**Checkpoint**: 活動列表頁和詳情頁的操作回饋已由 Toast 接管，無殘留 actionMessage

---

## Phase 3: User Story 2 — 操作失敗時看到清楚的錯誤提示 (Priority: P1)

**Goal**: 取代 window.alert 和 console.error 靜默錯誤，改用 error Toast

**Independent Test**: 在文章頁面模擬刪除失敗，確認 error Toast 出現、不自動消失、可手動關閉

### Implementation for User Story 2

- [x] T008 [P] [US2] Migrate src/app/posts/[id]/PostDetailClient.jsx — replace window.alert with showToast error, remove eslint-disable comments
- [x] T009 [P] [US2] Migrate src/app/signout/SignOutButton.jsx — replace window.alert with showToast error, remove eslint-disable comments
- [x] T010 [P] [US2] Migrate src/app/member/page.jsx — add showToast error in catch blocks where currently only console.error exists

**Checkpoint**: 專案內無 window.alert 做操作回饋，member 頁面不再有靜默失敗

---

## Phase 4: User Story 3 — 顯示資訊性提示 (Priority: P2)

**Goal**: 用 info Toast 取代 runs 頁面的 disconnectError inline 提示

**Independent Test**: 在跑步頁面觸發 Strava 斷開情境，確認 info Toast 出現、樣式與 success/error 有視覺區分、3 秒自動消失

### Implementation for User Story 3

- [x] T011 [US3] Migrate src/app/runs/page.jsx — remove disconnectError state + JSX block, replace with showToast error via useToast (.syncError CSS retained — still used by syncError)

**Checkpoint**: runs 頁面的 inline error 提示已由 info Toast 取代

---

## Phase 5: User Story 4 — 多個 Toast 不互相覆蓋 (Priority: P2)

**Goal**: 確保快速連續觸發多次操作時，Toast 以堆疊方式排列、各自獨立消失、超過 5 個時移除最舊

**Independent Test**: 快速連續觸發 3+ 次操作，確認所有 Toast 同時可見、堆疊排列、各自獨立超時消失

> Core stacking logic (reducer MAX_TOASTS, flex-column-reverse) is built in Phase 1. This phase is verification.

- [x] T012 [US4] Verify multi-toast stacking — trigger 6+ toasts rapidly, confirm oldest removed when exceeding 5, confirm each toast dismisses independently

**Checkpoint**: 多 Toast 堆疊、上限 5 個、獨立消失全部正常

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全功能驗證、型別檢查、lint 通過

- [x] T013 Run npm run type-check and npm run lint across all modified files, fix all errors
- [x] T014 Verify a11y — success/info Toast uses role="status", error Toast uses role="alert", close button has accessible label
- [x] T015 Verify mobile responsiveness — Toast positioning on 375px viewport does not block navigation or action buttons

---

## Phase 7: US1b/US1c — CRUD Toast 整合：活動頁面 (Priority: P1)

**Goal**: 補齊活動頁面缺失的 success toast（建立、編輯、刪除），將 inline error state（createError、deleteError）改為 error toast，支援刪除後導航 toast

**Prerequisite**: Phase 1–6 完成

**Independent Test**: 在活動列表頁和詳情頁各執行建立/編輯/刪除操作，確認每個操作成功/失敗後都出現對應 Toast，無殘留 inline error

### Implementation for US1b/US1c — 活動頁面

- [ ] T016 [P] [US1b] Migrate CRUD toast + search params + cleanup in src/app/events/page.jsx — (1) add useSearchParams import + useEffect to read ?toast= param then showToast and router.replace without scroll, (2) confirm/add showToast('建立活動成功') on create success, (3) add showToast('更新活動成功') on edit success, (4) change delete success message from '刪除成功' to '活動已刪除', (5) replace setCreateError with showToast('建立活動失敗，請稍後再試', 'error'), (6) update edit error message to '更新活動失敗，請稍後再試', (7) replace setDeleteError with showToast('刪除活動失敗，請稍後再試', 'error'), (8) remove createError/deleteError useState + inline error JSX, (9) remove deleteError prop from EventDeleteConfirm call
- [ ] T017 [P] [US1b] Migrate CRUD toast + navigation param + cleanup in src/app/events/[id]/eventDetailClient.jsx — (1) add showToast('更新活動成功') on edit success, (2) change delete success from router.push('/events') to router.push('/events?toast=活動已刪除'), (3) update edit error message to '更新活動失敗，請稍後再試', (4) replace setDeleteError with showToast('刪除活動失敗，請稍後再試', 'error'), (5) remove deleteError useState + inline usage, (6) remove deleteError prop from EventDeleteConfirm call
- [ ] T018 [US1b] Clean up EventDeleteConfirm component: remove deleteError prop from JSDoc, destructuring params, and inline error JSX in src/components/EventDeleteConfirm.jsx

**Checkpoint**: 活動列表頁 + 詳情頁所有 CRUD 操作（建立/編輯/刪除）都有 success/error Toast，createError/deleteError inline state 全部移除

---

## Phase 8: US1b — CRUD Toast 整合：文章頁面 (Priority: P1)

**Goal**: 為文章列表頁和詳情頁所有 CRUD 操作新增 try-catch + success/error Toast，修復詳情頁刪除後缺少 router.push 的 bug

**Prerequisite**: Phase 1–6 完成（可與 Phase 7 並行）

**Independent Test**: 在文章列表頁和詳情頁各執行建立/編輯/刪除操作，確認每個操作成功/失敗後都出現 Toast

### Implementation for US1b — 文章頁面

- [ ] T019 [P] [US1b] Migrate all CRUD toast + search params in src/app/posts/page.jsx — (1) add useToast import from @/contexts/ToastContext, (2) add useSearchParams import from next/navigation, (3) wrap create post handler in try-catch: success showToast('發佈文章成功'), error showToast('發佈文章失敗，請稍後再試', 'error') + console.error, (4) wrap edit post handler in try-catch: success showToast('更新文章成功'), error showToast('更新文章失敗，請稍後再試', 'error') + console.error, (5) wrap delete post handler in try-catch: success showToast('文章已刪除'), error showToast('刪除文章失敗，請稍後再試', 'error') + console.error, (6) add useEffect to read ?toast= search param then showToast and router.replace('/posts', { scroll: false })
- [ ] T020 [P] [US1b] Migrate all CRUD toast + delete navigation + bug fix in src/app/posts/[id]/PostDetailClient.jsx — (1) add useToast import if not present, (2) wrap edit post handler in try-catch: success showToast('更新文章成功'), error showToast('更新文章失敗，請稍後再試', 'error') + console.error, (3) wrap delete post handler in try-catch: success router.push('/posts?toast=文章已刪除') (bug fix: 目前缺少 router.push，使用者停留在已刪除文章頁面), error showToast('刪除文章失敗，請稍後再試', 'error') + console.error

**Checkpoint**: 文章列表頁 + 詳情頁所有 CRUD 操作都有 success/error Toast，詳情頁刪除後正確導航至列表頁

---

## Phase 9: CRUD Toast Verification & Polish

**Purpose**: 整合測試 + 全面驗證 SC-001（零靜默操作），型別檢查 + lint 通過

- [ ] T021 [P] Create integration tests for CRUD toast in specs/009-global-toast/tests/integration/crud-toast.test.jsx — test cases: (1) events page shows success toast on create/edit/delete, (2) events page shows error toast on create/edit/delete failure, (3) events page reads ?toast= search param and shows toast, (4) posts page shows success/error toast on create/edit/delete, (5) posts page reads ?toast= search param, (6) EventDeleteConfirm no longer receives deleteError prop
- [ ] T022 Run npm run type-check and npm run lint across all modified files (events/page.jsx, eventDetailClient.jsx, EventDeleteConfirm.jsx, posts/page.jsx, PostDetailClient.jsx), fix all errors
- [ ] T023 Verify SC-001 CRUD coverage: confirm all 10 success + 10 error operations from research.md R10 table produce visible Toast feedback — 0 silent CRUD operations remain (報名/取消報名已於 Phase 2 驗證)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories
- **US1 (Phase 2)**: Depends on Phase 1 completion
- **US2 (Phase 3)**: Depends on Phase 1 completion — can run in parallel with US1
- **US3 (Phase 4)**: Depends on Phase 1 completion — can run in parallel with US1/US2
- **US4 (Phase 5)**: Depends on Phase 1 completion — verification only
- **Polish (Phase 6)**: Depends on all Phase 2–5 user stories complete
- **CRUD 活動 (Phase 7)**: Depends on Phase 1–6 completion
- **CRUD 文章 (Phase 8)**: Depends on Phase 1–6 completion — can run in parallel with Phase 7
- **CRUD Verification (Phase 9)**: Depends on Phase 7 + Phase 8 completion

### User Story Dependencies

- **US1 (P1)**: Independent. Migrates events pages (success + error paths via actionMessage)
- **US2 (P1)**: Independent. Migrates posts, signout, member pages (error-only paths)
- **US3 (P2)**: Independent. Migrates runs page (info path)
- **US4 (P2)**: Independent. Verification of foundational stacking behavior
- **US1b (P1)**: Depends on Phase 1–6. CRUD success/error toast for events + posts
- **US1c (P1)**: Covered within US1b Phase 7 (create event error → toast)

### Within Phase 7 (CRUD 活動)

- T016 (events/page.jsx) and T017 (eventDetailClient.jsx) can run in parallel
- T018 (EventDeleteConfirm cleanup) depends on T016 + T017

### Within Phase 8 (CRUD 文章)

- T019 (posts/page.jsx) and T020 (PostDetailClient.jsx) can run in parallel

### Cross-Phase Parallelism

- Phase 7 and Phase 8 can run in parallel (different file sets)
- Phase 9 depends on both Phase 7 and Phase 8

### Parallel Opportunities (Phase 1–6, completed)

Within Phase 1:

- T001 (ToastContext) and T002 (Toast component) can run in parallel
- T003 (ToastContainer) depends on T001 + T002
- T004 (layout integration) depends on T001 + T003

Within Phase 2 (US1):

- T005 (events/page.jsx) and T006 (eventDetailClient.jsx) can run in parallel
- T007 (CSS cleanup) depends on T005 + T006

Within Phase 3 (US2):

- T008, T009, T010 can ALL run in parallel (different files, no dependencies)

---

## Parallel Example: CRUD Toast Integration (Phase 7 + 8)

```bash
# Phase 7 + 8 can run in parallel:

# Phase 7 — 活動頁面:
Task T016: "events/page.jsx — CRUD toast + search params + cleanup"
Task T017: "eventDetailClient.jsx — CRUD toast + navigation param + cleanup"  # parallel with T016
# T018 (EventDeleteConfirm cleanup) — after T016 + T017

# Phase 8 — 文章頁面 (parallel with Phase 7):
Task T019: "posts/page.jsx — all CRUD try-catch + toast + search params"
Task T020: "PostDetailClient.jsx — all CRUD try-catch + toast + delete navigation"  # parallel with T019

# Phase 9 — after Phase 7 + 8:
Task T021: "integration tests for CRUD toast"  # parallel with T022
Task T022: "type-check + lint"
Task T023: "SC-001 CRUD verification"
```

---

## Implementation Strategy

### Phase 1–6 完成 ✅

Core Toast infrastructure + initial page migration all complete.

### CRUD Toast 整合 (Phase 7–9)

1. **Phase 7 + 8 並行**: 活動頁面和文章頁面互不依賴，可同時進行
2. **Phase 7 內部**: T016 + T017 並行 → T018 收尾清理
3. **Phase 8 內部**: T019 + T020 並行
4. **Phase 9**: integration tests + 全面驗證 SC-001 + type-check + lint
5. **STOP and VALIDATE**: 確認 R10 表格中所有 20 個 toast 操作都有可見回饋

### MVP Delivery Order

1. ~~Phase 1 → Toast 基礎建設就緒~~ ✅
2. ~~Phase 2 (US1) → 活動頁面遷移完成~~ ✅
3. ~~Phase 3 (US2) → 錯誤回饋全面升級~~ ✅
4. ~~Phase 4 (US3) → 資訊提示遷移完成~~ ✅
5. ~~Phase 5 (US4) → 多 Toast 堆疊驗證~~ ✅
6. ~~Phase 6 → 收尾驗證~~ ✅
7. Phase 7 + 8 → CRUD Toast 全面覆蓋
8. Phase 9 → SC-001 最終驗證

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Phase 7–9 追加自 plan.md「追加 Plan: CRUD Toast 整合 (FR-011–FR-014, SC-001)」
