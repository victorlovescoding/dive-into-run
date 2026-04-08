# Tasks: 全域 Toast 通知系統

**Input**: Design documents from `/specs/009-global-toast/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Created via TDD workflow during each task implementation (per constitution I — Red/Green/Refactor)

**Organization**: Tasks grouped by user story (US1–US4) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)

---

## Phase 1: Foundational (Core Toast Infrastructure)

**Purpose**: Build the reusable Toast system (Context + Components + CSS) that ALL user stories depend on

**CRITICAL**: No page migration can begin until this phase is complete

- [ ] T001 [P] Create ToastContext with useReducer (ADD/REMOVE/CLEAR_ALL), ToastProvider, useToast hook, and route-change clear via usePathname in src/contexts/ToastContext.jsx
- [ ] T002 [P] Create Toast component with type-based styles (success/error/info), close button, ARIA roles (status/alert), enter/exit CSS transition animations, and long-text overflow handling (word-break/overflow-wrap) in src/components/Toast.jsx + src/components/Toast.module.css
- [ ] T003 Create ToastContainer with fixed positioning (bottom-right desktop, full-width mobile), flex-column-reverse stack layout, z-index 1100, and context consumption in src/components/ToastContainer.jsx + src/components/ToastContainer.module.css
- [ ] T004 Integrate ToastProvider and ToastContainer into src/app/layout.jsx

**Checkpoint**: Toast infrastructure ready — `showToast('test')` / `showToast('test', 'error')` / `showToast('test', 'info')` all work from any client component

---

## Phase 2: User Story 1 — 操作成功時看到即時回饋 (Priority: P1) MVP

**Goal**: 在活動頁面觸發成功操作後出現 Toast，取代 actionMessage inline 提示

**Independent Test**: 在活動頁面報名/取消報名，確認成功 Toast 出現、3 秒自動消失、可手動提前關閉

### Implementation for User Story 1

- [ ] T005 [P] [US1] Migrate src/app/events/page.jsx — remove actionMessage state + JSX block, replace setActionMessage calls with showToast via useToast
- [ ] T006 [P] [US1] Migrate src/app/events/[id]/eventDetailClient.jsx — remove actionMessage state + JSX block, replace setActionMessage calls with showToast via useToast
- [ ] T007 [US1] Remove unused CSS classes (.errorCard, .successCard) from src/app/events/events.module.css (both pages import this single file; eventDetail.module.css does not exist)

**Checkpoint**: 活動列表頁和詳情頁的操作回饋已由 Toast 接管，無殘留 actionMessage

---

## Phase 3: User Story 2 — 操作失敗時看到清楚的錯誤提示 (Priority: P1)

**Goal**: 取代 window.alert 和 console.error 靜默錯誤，改用 error Toast

**Independent Test**: 在文章頁面模擬刪除失敗，確認 error Toast 出現、不自動消失、可手動關閉

### Implementation for User Story 2

- [ ] T008 [P] [US2] Migrate src/app/posts/[id]/PostDetailClient.jsx — replace window.alert with showToast error, remove eslint-disable comments
- [ ] T009 [P] [US2] Migrate src/app/signout/SignOutButton.jsx — replace window.alert with showToast error, remove eslint-disable comments
- [ ] T010 [P] [US2] Migrate src/app/member/page.jsx — add showToast error in catch blocks where currently only console.error exists

**Checkpoint**: 專案內無 window.alert 做操作回饋，member 頁面不再有靜默失敗

---

## Phase 4: User Story 3 — 顯示資訊性提示 (Priority: P2)

**Goal**: 用 info Toast 取代 runs 頁面的 disconnectError inline 提示

**Independent Test**: 在跑步頁面觸發 Strava 斷開情境，確認 info Toast 出現、樣式與 success/error 有視覺區分、3 秒自動消失

### Implementation for User Story 3

- [ ] T011 [US3] Migrate src/app/runs/page.jsx — remove disconnectError state + JSX block, replace with showToast info via useToast, and remove unused .syncError class from src/app/runs/runs.module.css

**Checkpoint**: runs 頁面的 inline error 提示已由 info Toast 取代

---

## Phase 5: User Story 4 — 多個 Toast 不互相覆蓋 (Priority: P2)

**Goal**: 確保快速連續觸發多次操作時，Toast 以堆疊方式排列、各自獨立消失、超過 5 個時移除最舊

**Independent Test**: 快速連續觸發 3+ 次操作，確認所有 Toast 同時可見、堆疊排列、各自獨立超時消失

> Core stacking logic (reducer MAX_TOASTS, flex-column-reverse) is built in Phase 1. This phase is verification.

- [ ] T012 [US4] Verify multi-toast stacking — trigger 6+ toasts rapidly, confirm oldest removed when exceeding 5, confirm each toast dismisses independently

**Checkpoint**: 多 Toast 堆疊、上限 5 個、獨立消失全部正常

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全功能驗證、型別檢查、lint 通過

- [ ] T013 Run npm run type-check and npm run lint across all modified files, fix all errors
- [ ] T014 Verify a11y — success/info Toast uses role="status", error Toast uses role="alert", close button has accessible label
- [ ] T015 Verify mobile responsiveness — Toast positioning on 375px viewport does not block navigation or action buttons

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories
- **US1 (Phase 2)**: Depends on Phase 1 completion
- **US2 (Phase 3)**: Depends on Phase 1 completion — can run in parallel with US1
- **US3 (Phase 4)**: Depends on Phase 1 completion — can run in parallel with US1/US2
- **US4 (Phase 5)**: Depends on Phase 1 completion — verification only
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent. Migrates events pages (success + error paths via actionMessage)
- **US2 (P1)**: Independent. Migrates posts, signout, member pages (error-only paths)
- **US3 (P2)**: Independent. Migrates runs page (info path)
- **US4 (P2)**: Independent. Verification of foundational stacking behavior

### Parallel Opportunities

Within Phase 1:

- T001 (ToastContext) and T002 (Toast component) can run in parallel
- T003 (ToastContainer) depends on T001 + T002
- T004 (layout integration) depends on T001 + T003

Within Phase 2 (US1):

- T005 (events/page.jsx) and T006 (eventDetailClient.jsx) can run in parallel
- T007 (CSS cleanup) depends on T005 + T006

Within Phase 3 (US2):

- T008, T009, T010 can ALL run in parallel (different files, no dependencies)

Across Phases:

- Phase 2, 3, 4, 5 can all start in parallel after Phase 1 completes

---

## Parallel Example: After Phase 1 Completes

```bash
# All user stories can start simultaneously:
US1: T005 (events/page.jsx) + T006 (eventDetailClient.jsx) — parallel
US2: T008 (PostDetailClient) + T009 (SignOutButton) + T010 (member/page) — parallel
US3: T011 (runs/page.jsx)
US4: T012 (verification)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001–T004)
2. Complete Phase 2: US1 (T005–T007)
3. **STOP and VALIDATE**: 活動頁面的 Toast 回饋完整運作
4. 此時已可 demo MVP 價值

### Incremental Delivery

1. Phase 1 → Toast 基礎建設就緒
2. Phase 2 (US1) → 活動頁面遷移完成 — **MVP!**
3. Phase 3 (US2) → 錯誤回饋全面升級
4. Phase 4 (US3) → 資訊提示遷移完成
5. Phase 5 (US4) → 多 Toast 堆疊驗證
6. Phase 6 → 收尾驗證

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
