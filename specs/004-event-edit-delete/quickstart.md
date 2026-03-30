# Quickstart: Event Edit & Delete Actions

**Branch**: `004-event-edit-delete` | **Date**: 2026-03-30

## Prerequisites

```bash
git checkout 004-event-edit-delete
npm install
```

## Run Tests (TDD RED Phase — all should fail)

```bash
# Unit tests
npx vitest run specs/004-event-edit-delete/tests/unit/firebase-events-edit-delete.test.js

# Integration tests
npx vitest run specs/004-event-edit-delete/tests/integration/

# E2E tests (requires dev server running)
npm run dev &
npx playwright test specs/004-event-edit-delete/tests/e2e/event-edit-delete.spec.js
```

## Implementation Order

### Step 1: Service Layer (`src/lib/firebase-events.js`)

實作 `updateEvent()` 和 `deleteEvent()` 函式。

**驗證**: Unit tests 全綠
```bash
npx vitest run specs/004-event-edit-delete/tests/unit/firebase-events-edit-delete.test.js
```

### Step 2: EventCardMenu (`src/components/EventCardMenu.jsx`)

實作三點選單：權限判斷、dropdown toggle、click outside 關閉。

**驗證**: Integration tests — EventCardMenu 全綠
```bash
npx vitest run specs/004-event-edit-delete/tests/integration/EventCardMenu.test.jsx
```

### Step 3: EventDeleteConfirm (`src/components/EventDeleteConfirm.jsx`)

實作自訂刪除確認對話框。

**驗證**: Integration tests — EventDeleteConfirm 全綠
```bash
npx vitest run specs/004-event-edit-delete/tests/integration/EventDeleteConfirm.test.jsx
```

### Step 4: EventEditForm (`src/components/EventEditForm.jsx`)

實作編輯表單：預填、dirty detection、按鈕狀態。

**驗證**: Integration tests — EventEditForm 全綠
```bash
npx vitest run specs/004-event-edit-delete/tests/integration/EventEditForm.test.jsx
```

### Step 5: Page Integration (`src/app/events/page.jsx`)

將三個元件整合進活動列表頁：
- EventCardMenu 置於每張卡片
- 處理 onEdit / onDelete callback 的 state 管理
- 呼叫 `updateEvent()` / `deleteEvent()` 並處理結果

**驗證**: E2E tests 全綠
```bash
npx playwright test specs/004-event-edit-delete/tests/e2e/event-edit-delete.spec.js
```

### Step 6: Quality Gates

```bash
npm run lint
npm run type-check
```

## Key Files

| File | Purpose |
|---|---|
| `src/lib/firebase-events.js` | `updateEvent()`, `deleteEvent()` 實作 |
| `src/components/EventCardMenu.jsx` | 三點選單元件 |
| `src/components/EventEditForm.jsx` | 編輯表單元件 |
| `src/components/EventDeleteConfirm.jsx` | 刪除確認對話框 |
| `src/app/events/page.jsx` | 整合所有元件到活動列表頁 |
