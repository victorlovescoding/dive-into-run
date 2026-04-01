# Implementation Plan: Event Edit & Delete Actions

**Branch**: `004-event-edit-delete` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-event-edit-delete/spec.md`

## Summary

在活動列表頁為活動創建人提供編輯與刪除功能：三點選單觸發、編輯表單（復用建立表單結構並預填）、自訂刪除確認對話框。Service layer 新增 `updateEvent()` (transaction-based) 和 `deleteEvent()` (含子集合清除)。

## Technical Context

**Language/Version**: JavaScript (ES6+) — JSDoc + `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore)
**Storage**: Firestore — `events` collection + `events/{id}/participants` subcollection
**Testing**: Vitest (Unit/Integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web (Desktop/Mobile browser)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 編輯完成按鈕狀態切換 < 1 秒 (SC-003)，刪除操作 < 3 秒 (SC-004)
**Constraints**: 純 JavaScript（無 TypeScript）、CSS Modules + Tailwind CSS 4
**Scale/Scope**: MVP — 單一活動列表頁面，活動數量有限（分頁 10 筆/次）

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                                                   |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------- |
| I. SDD/TDD                    | ✅ PASS | spec.md 完成、RED phase 測試已撰寫（unit/integration/e2e）                              |
| II. Strict Service Layer      | ✅ PASS | `updateEvent`/`deleteEvent` 在 `src/lib/firebase-events.js`；元件不直接 import Firebase |
| III. UX & Consistency         | ✅ PASS | 正體中文 UI 文字、自訂 dialog（非原生 confirm）                                         |
| IV. Performance & Concurrency | ✅ PASS | `updateEvent` 使用 `runTransaction` 保證 maxParticipants 驗證一致性                     |
| V. Code Quality               | ✅ PASS | MVP 思維、獨立元件、CSS Modules                                                         |
| VI. Modern Standards          | ✅ PASS | `const` 優先、JSDoc 完整、React 19 Hooks                                                |
| VII. Security                 | ✅ PASS | 前端 `hostUid` 比對 + Firestore Security Rules                                          |
| VIII. Agent Protocol          | ✅ PASS | 修改前確認、資訊誠實                                                                    |
| IX. Coding Iron Rules         | ✅ PASS | 無 JSX 內邏輯、無 eslint-disable a11y、有意義 JSDoc                                     |

**Post-Design Re-Check**: ✅ 所有原則維持通過。`EventCardMenu` click-outside 使用標準 `useRef` + event listener，不違反任何原則。

## Project Structure

### Documentation (this feature)

```text
specs/004-event-edit-delete/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — research findings
├── data-model.md        # Phase 1 — entity model
├── quickstart.md        # Phase 1 — implementation guide
├── contracts/
│   └── service-layer.md # Phase 1 — API contracts
├── checklists/
│   └── requirements.md  # Pre-plan quality check
├── tests/
│   ├── unit/
│   │   └── firebase-events-edit-delete.test.js
│   ├── integration/
│   │   ├── EventCardMenu.test.jsx
│   │   ├── EventDeleteConfirm.test.jsx
│   │   └── EventEditForm.test.jsx
│   └── e2e/
│       └── event-edit-delete.spec.js
└── test-results/
    ├── unit/
    ├── integration/
    └── e2e/
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── firebase-events.js       # 修改: 實作 updateEvent(), deleteEvent()
├── components/
│   ├── EventCardMenu.jsx        # 修改: 實作三點選單元件
│   ├── EventEditForm.jsx        # 修改: 實作編輯表單元件
│   └── EventDeleteConfirm.jsx   # 修改: 實作刪除確認對話框
└── app/
    └── events/
        ├── page.jsx             # 修改: 整合三個元件到活動列表
        └── events.module.css    # 修改: 新增相關樣式
```

**Structure Decision**: 所有新增功能皆在既有目錄結構內，不新增任何資料夾。三個 UI 元件已有 stub 檔案（TDD RED phase 建立），service layer 函式已有 stub（throw not implemented）。

## Implementation Phases

### Phase 1: Service Layer (Unit Tests → GREEN)

**Target**: `src/lib/firebase-events.js`
**Tests**: `specs/004-event-edit-delete/tests/unit/firebase-events-edit-delete.test.js`

1. **`updateEvent(eventId, updatedFields)`**
   - 輸入驗證：空 eventId / 無效 updatedFields → throw
   - `runTransaction`: 讀取 event doc → 驗證存在 → 若有 maxParticipants 變更則驗證 >= participantsCount → 更新欄位 + 重算 remainingSeats → 回傳 `{ ok: true }`
   - 失敗時直接 throw（讓 caller 處理）

2. **`deleteEvent(eventId)`**
   - 輸入驗證：空 eventId → throw
   - 讀取 event doc → 驗證存在
   - 取得 `participants` 子集合 → 逐一 `deleteDoc`
   - 刪除 event 主文件 → 回傳 `{ ok: true }`
   - 無參與者時仍成功

### Phase 2: UI Components (Integration Tests → GREEN)

**2A: EventCardMenu** (`src/components/EventCardMenu.jsx`)

- Tests: `EventCardMenu.test.jsx`
- 權限判斷：`currentUserUid !== event.hostUid` → return null
- 三點按鈕：`<button aria-label="更多操作">`
- Dropdown: `<div role="menu">` + `<button role="menuitem">`
- Click outside: `useRef` + `mousedown` listener
- Toggle: 再點一次關閉
- 點擊 menuitem → callback + close

**2B: EventDeleteConfirm** (`src/components/EventDeleteConfirm.jsx`)

- Tests: `EventDeleteConfirm.test.jsx`
- `<div role="dialog" aria-modal="true">`
- 文字「確定要刪除活動？」
- 「是」按鈕 → `onConfirm(eventId)`
- 「否」按鈕 → `onCancel()`
- `isDeleting` → 雙按鈕 disabled
- `deleteError` → `<div role="alert">`

**2C: EventEditForm** (`src/components/EventEditForm.jsx`)

- Tests: `EventEditForm.test.jsx`
- 預填所有欄位（title, time, deadline, meetPlace, distanceKm, maxParticipants, paceSec → 分/秒, description, city, district, runType）
- 按鈕：「取消編輯」/「編輯完成」
- Dirty detection: snapshot 原始值 → onChange 逐欄位比較
- `maxParticipants` input `min` = `Math.max(event.participantsCount, 2)`
- Submit: 收集變更欄位 → `onSubmit(data)` (含 id)
- `isSubmitting` → disabled + loading 文字

### Phase 3: Page Integration (E2E Tests → GREEN)

**Target**: `src/app/events/page.jsx`

1. **State 新增**:
   - `editingEvent` — 正在編輯的活動物件 (null = 無)
   - `deletingEventId` — 正在刪除的活動 ID (null = 無)
   - `isUpdating` — 編輯送出中
   - `isDeletingEvent` — 刪除進行中
   - `deleteError` — 刪除錯誤訊息

2. **EventCardMenu 整合**:
   - 在每張 eventCard 內加入 `<EventCardMenu>`
   - Props: `event`, `currentUserUid={user?.uid}`, `onEdit`, `onDelete`
   - `onEdit` → `setEditingEvent(event)`
   - `onDelete` → `setDeletingEventId(event.id)` 顯示確認對話框

3. **EventEditForm 整合**:
   - `editingEvent` 有值時 render `<EventEditForm>`
   - `onSubmit` → 呼叫 `updateEvent(event.id, changedFields)` → 成功後更新 `events` state + 關閉表單
   - `onCancel` → `setEditingEvent(null)`

4. **EventDeleteConfirm 整合**:
   - `deletingEventId` 有值時 render `<EventDeleteConfirm>`
   - `onConfirm` → 呼叫 `deleteEvent(id)` → 成功後從 `events` 移除 + 顯示「刪除成功」 + 關閉
   - `onCancel` → `setDeletingEventId(null)`
   - 失敗 → `setDeleteError('發生錯誤，請再試一次')`

5. **CSS 新增**:
   - `.eventCardMenuWrapper` — 三點按鈕定位（卡片右上角）
   - `.editFormOverlay` — 編輯表單 overlay
   - `.deleteConfirmOverlay` — 刪除確認 overlay

## Complexity Tracking

> No constitution violations. No complexity justifications needed.

## Dependency Graph

```
Phase 1 (Service Layer)
  └─ updateEvent(), deleteEvent()

Phase 2A (EventCardMenu) ──┐
Phase 2B (EventDeleteConfirm) ──┤ (可並行)
Phase 2C (EventEditForm) ──┘

Phase 3 (Page Integration)
  └─ depends on Phase 1 + Phase 2
```

## Risk Assessment

| Risk                           | Likelihood | Mitigation                                        |
| ------------------------------ | ---------- | ------------------------------------------------- |
| 編輯表單欄位與建立表單不一致   | Low        | 對照 `normalizeEventPayload` + 建立表單 name 屬性 |
| 刪除子集合遺漏                 | Low        | Unit test 驗證 deleteDoc 呼叫次數                 |
| Dirty detection 對數字型別誤判 | Medium     | 統一轉為 string 比較或使用 `==`                   |
| Click outside 與 Link 點擊衝突 | Medium     | `stopPropagation` on menu click + 正確的 ref 範圍 |
