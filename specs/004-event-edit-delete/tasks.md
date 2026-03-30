# Tasks: Event Edit & Delete Actions

**Input**: Design documents from `/specs/004-event-edit-delete/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/service-layer.md, research.md, quickstart.md
**Tests**: TDD — RED phase 測試已撰寫，所有實作任務需讓對應測試從 RED → GREEN

**Organization**: Tasks 依 user story 分組，每個 story 可獨立實作與測試。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無相依性）
- **[Story]**: 對應 spec.md 的 user story（US1, US2, US3）
- 每個任務包含確切檔案路徑

---

## Phase 1: Service Layer — updateEvent / deleteEvent (Unit Tests → GREEN)

**Purpose**: 實作 `updateEvent()` 和 `deleteEvent()` 服務函式，這是所有 UI 元件和頁面整合的前置條件

**Tests**: `specs/004-event-edit-delete/tests/unit/firebase-events-edit-delete.test.js`

- [ ] T001 實作 `updateEvent(eventId, updatedFields)` in `src/lib/firebase-events.js` — 移除 stub throw，實作完整邏輯：輸入驗證（空 eventId / 無效 updatedFields → throw）、`runTransaction` 讀取 event doc → 驗證存在 → 若有 `maxParticipants` 變更則驗證 >= `participantsCount`（否則 throw /人數上限/）→ 更新欄位 + 重算 `remainingSeats` → 回傳 `{ ok: true }`
- [ ] T002 實作 `deleteEvent(eventId)` in `src/lib/firebase-events.js` — 移除 stub throw，實作完整邏輯：輸入驗證（空 eventId → throw）、讀取 event doc → 驗證存在 → `getDocs` 取得 `participants` 子集合 → 逐一 `deleteDoc` → 刪除 event 主文件 → 回傳 `{ ok: true }`
- [ ] T003 執行 unit tests 驗證 GREEN：`npx vitest run specs/004-event-edit-delete/tests/unit/firebase-events-edit-delete.test.js`，將結果存入 `specs/004-event-edit-delete/test-results/unit/`

**Checkpoint**: `updateEvent` 和 `deleteEvent` unit tests 全綠。Service layer 可供 UI 元件使用。

---

## Phase 2: User Story 1 — 活動創建人編輯自己的活動 (Priority: P1) 🎯 MVP

**Goal**: 活動創建人可透過三點選單開啟編輯表單、預填資料、修改欄位後送出更新

**Independent Test**: 登入為活動創建人，在活動列表點擊三個點 > 編輯活動，確認表單預填正確資料，修改任一欄位後點擊「編輯完成」，驗證活動資料已更新

**Tests**:
- `specs/004-event-edit-delete/tests/integration/EventCardMenu.test.jsx`
- `specs/004-event-edit-delete/tests/integration/EventEditForm.test.jsx`

### 2A: EventCardMenu 元件

- [ ] T004 [P] [US1] 實作 `EventCardMenu` in `src/components/EventCardMenu.jsx` — 權限判斷（`currentUserUid !== event.hostUid` → return null）、三點按鈕（`aria-label="更多操作"`）、dropdown（`role="menu"` + `role="menuitem"`: 「編輯活動」/「刪除活動」）、click outside 關閉（`useRef` + `mousedown` listener）、toggle 關閉、點擊 menuitem → callback + close
- [ ] T005 [US1] 執行 EventCardMenu integration tests 驗證 GREEN：`npx vitest run specs/004-event-edit-delete/tests/integration/EventCardMenu.test.jsx`，將結果存入 `specs/004-event-edit-delete/test-results/integration/`

### 2B: EventEditForm 元件

- [ ] T006 [P] [US1] 實作 `EventEditForm` in `src/components/EventEditForm.jsx` — 預填所有欄位（title, time, registrationDeadline, meetPlace, distanceKm, maxParticipants, paceSec → 分/秒 select, description, city, district, runType）、按鈕「取消編輯」/「編輯完成」、dirty detection（snapshot 原始值 → onChange 逐欄位比較）、`maxParticipants` input `min` = `Math.max(event.participantsCount, 2)`、submit 收集變更欄位 → `onSubmit(data)` 含 id、`isSubmitting` → disabled + loading 文字
- [ ] T007 [US1] 執行 EventEditForm integration tests 驗證 GREEN：`npx vitest run specs/004-event-edit-delete/tests/integration/EventEditForm.test.jsx`，將結果存入 `specs/004-event-edit-delete/test-results/integration/`

> **注意**: T004、T006、T011 可三者平行執行（不同檔案、無相依），但 T005 依賴 T004、T007 依賴 T006、T012 依賴 T011。

### 2C: 頁面整合（編輯流程）

- [ ] T008 [US1] 在 `src/app/events/page.jsx` 整合 EventCardMenu — 在每張 eventCard 內加入 `<EventCardMenu>`，props: `event`, `currentUserUid={user?.uid}`, `onEdit`, `onDelete`；新增 state: `editingEvent`（正在編輯的活動物件，null = 無）、`deletingEventId`（正在刪除的活動 ID，null = 無）；`onEdit` → `setEditingEvent(event)`、`onDelete` → `setDeletingEventId(event.id)`
- [ ] T009 [US1] 在 `src/app/events/page.jsx` 整合 EventEditForm — `editingEvent` 有值時 render `<EventEditForm>`；`onSubmit` → 呼叫 `updateEvent(event.id, changedFields)` → 成功後更新 `events` state + 關閉表單；`onCancel` → `setEditingEvent(null)`；新增 state: `isUpdating`
- [ ] T010 [US1] 在 `src/app/events/events.module.css` 新增編輯相關樣式 — `.eventCardMenuWrapper`（卡片右上角定位）、`.editFormOverlay`（編輯表單 overlay）

**Checkpoint**: US1 完成 — 活動創建人可從三點選單開啟編輯表單、預填資料、修改後送出更新。EventCardMenu 和 EventEditForm integration tests 全綠。

---

## Phase 3: User Story 2 — 活動創建人刪除自己的活動 (Priority: P2)

**Goal**: 活動創建人可透過三點選單觸發刪除確認，確認後從資料庫刪除活動及其參與者

**Independent Test**: 登入為活動創建人，點擊三個點 > 刪除活動，確認彈出確認視窗，選擇「是」後驗證活動已從列表和資料庫中移除

**Tests**:
- `specs/004-event-edit-delete/tests/integration/EventDeleteConfirm.test.jsx`

### 3A: EventDeleteConfirm 元件

- [ ] T011 [P] [US2] 實作 `EventDeleteConfirm` in `src/components/EventDeleteConfirm.jsx` — `<div role="dialog" aria-modal="true">`、文字「確定要刪除活動？」、「是」按鈕 → `onConfirm(eventId)`、「否」按鈕 → `onCancel()`、`isDeleting` → 雙按鈕 disabled、`deleteError` → `<div role="alert">`
- [ ] T012 [US2] 執行 EventDeleteConfirm integration tests 驗證 GREEN：`npx vitest run specs/004-event-edit-delete/tests/integration/EventDeleteConfirm.test.jsx`，將結果存入 `specs/004-event-edit-delete/test-results/integration/`

### 3B: 頁面整合（刪除流程）

- [ ] T013 [US2] 在 `src/app/events/page.jsx` 整合 EventDeleteConfirm — `deletingEventId` 有值時 render `<EventDeleteConfirm>`；`onConfirm` → 呼叫 `deleteEvent(id)` → 成功後從 `events` 移除 + 顯示「刪除成功」+ 關閉；`onCancel` → `setDeletingEventId(null)`；失敗 → `setDeleteError('發生錯誤，請再試一次')`；新增 state: `isDeletingEvent`, `deleteError`（`deletingEventId` 已在 T008 建立）
- [ ] T014 [US2] 在 `src/app/events/events.module.css` 新增刪除相關樣式 — `.deleteConfirmOverlay`（刪除確認 overlay）

**Checkpoint**: US2 完成 — 活動創建人可從三點選單觸發刪除確認，確認後活動從列表消失。EventDeleteConfirm integration tests 全綠。

---

## Phase 4: User Story 3 — 編輯表單的按鈕行為與視覺回饋 (Priority: P3)

**Goal**: 編輯表單的按鈕名稱區別於建立表單、dirty detection 控制按鈕可用狀態

**Independent Test**: 開啟編輯表單，確認按鈕名稱正確，未修改時「編輯完成」不可按，修改任一欄位後按鈕變為可按狀態

> **注意**: US3 的核心行為（按鈕名稱、dirty detection）已在 T006 的 `EventEditForm` 實作中涵蓋（FR-005, FR-006, FR-007）。此 phase 聚焦在視覺層面的強化。

- [ ] T015 [US3] 在 `src/app/events/events.module.css` 確認並強化「編輯完成」按鈕的視覺回饋 — disabled 狀態以淡化顏色呈現、enabled 狀態以醒目顏色呈現，確保視覺上清楚區分（FR-006, FR-007）

**Checkpoint**: US3 完成 — 按鈕名稱與建立表單有所區別，dirty detection 控制按鈕視覺狀態。

---

## Phase 5: E2E 驗證 & Quality Gates

**Purpose**: 端對端測試驗證完整用戶流程 + lint/type-check 品質閘門

- [ ] T016 執行 E2E tests 驗證 GREEN：`npx playwright test specs/004-event-edit-delete/tests/e2e/event-edit-delete.spec.js`，將結果存入 `specs/004-event-edit-delete/test-results/e2e/`
- [ ] T017 [P] 執行 `npm run lint` 確認無 lint 錯誤
- [ ] T018 [P] 執行 `npm run type-check` 確認無型別錯誤
- [ ] T019 更新 CLAUDE.md Recent Changes 區塊，反映 004-event-edit-delete 功能完成狀態

**Checkpoint**: 所有測試全綠、lint/type-check 通過、文件已更新。

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Service Layer)
  ├─ T001 updateEvent ──┐
  └─ T002 deleteEvent ──┤ (同一檔案，建議序列)
                         └─ T003 驗證 unit tests

Phase 2 (US1: 編輯) + US2 元件  ← depends on Phase 1
  ├─ T004 EventCardMenu ──┐
  ├─ T006 EventEditForm ──┤ (T004, T006, T011 可三者平行 — 不同檔案、無相依)
  ├─ T011 EventDeleteConfirm ─┘
  ├─ T005 驗證 EventCardMenu tests   ← depends on T004
  ├─ T007 驗證 EventEditForm tests   ← depends on T006
  ├─ T012 驗證 DeleteConfirm tests   ← depends on T011
  ├─ T008 頁面整合 Menu + states     ← depends on T004
  ├─ T009 頁面整合 EditForm          ← depends on T006, T008 (同檔案 page.jsx)
  └─ T010 CSS 樣式(編輯)             ← depends on T008

Phase 3 (US2: 刪除頁面整合)  ← depends on T008 + T011 + Phase 1(deleteEvent)
  ├─ T013 頁面整合 DeleteConfirm     ← depends on T011, T008, T002
  └─ T014 CSS 樣式(刪除)             ← depends on T013

Phase 4 (US3: 視覺回饋)  ← depends on T006
  └─ T015 CSS 強化

Phase 5 (E2E & QA)  ← depends on Phase 2 + Phase 3 + Phase 4
  ├─ T016 E2E tests
  ├─ T017 lint       ─┐ (可平行)
  ├─ T018 type-check ─┘
  └─ T019 更新文件
```

### User Story Dependencies

- **US1 (P1)**: depends on Phase 1 — 可在 Service Layer 完成後立即開始
- **US2 (P2)**: T011（元件）無外部依賴，可與 T004/T006 平行；T013（頁面整合）depends on T008 + T011 + Phase 1 的 `deleteEvent`
- **US3 (P3)**: depends on T006（EventEditForm 已實作）— 僅為視覺強化

### Parallel Opportunities

```bash
# Phase 1 內部：T001 和 T002 在同一檔案，建議序列執行
# Phase 2 內部：T004 (EventCardMenu)、T006 (EventEditForm)、T011 (EventDeleteConfirm) 可三者平行
# Phase 5 內部：T017 (lint) 和 T018 (type-check) 可平行
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Service Layer (T001 → T002 → T003)
2. Complete Phase 2: US1 編輯功能 (T004/T006/T011 → T005/T007/T012 → T008 → T009 → T010)
3. **STOP and VALIDATE**: 執行 EventCardMenu + EventEditForm integration tests

### Incremental Delivery

1. Phase 1 → Service Layer ready
2. Phase 2 → 編輯功能 ready → MVP!
3. Phase 3 → 刪除功能 ready
4. Phase 4 → 視覺回饋 ready
5. Phase 5 → 全部測試通過、品質閘門通過

---

## Notes

- 所有 stub 檔案已存在（TDD RED phase 建立），實作時修改既有檔案而非新建
- `firebase-events.js` 已 import 所需的 Firestore 函式（`runTransaction`, `deleteDoc`, `getDocs` 等）
- EventEditForm 需參考 `src/app/events/page.jsx` 中既有建立表單的欄位結構
- paceSec 需轉換為 分/秒 兩個 select（參考 quickstart.md 和建立表單）
- dirty detection 使用 shallow compare（參考 research.md R-003）
