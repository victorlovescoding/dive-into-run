# Data Model: 全域 Toast 通知系統

**Branch**: `009-global-toast` | **Date**: 2026-04-08

> Toast 系統為純 client-side state，無 Firestore / 後端儲存。

## Entities

### ToastItem

代表一則 Toast 通知。

| Field       | Type                             | Required | Description                                  |
| ----------- | -------------------------------- | -------- | -------------------------------------------- |
| `id`        | `string`                         | Yes      | 唯一識別碼（`crypto.randomUUID()`）          |
| `message`   | `string`                         | Yes      | 顯示給使用者的訊息文字                       |
| `type`      | `'success' \| 'error' \| 'info'` | Yes      | Toast 等級，決定視覺樣式與 ARIA role         |
| `createdAt` | `number`                         | Yes      | 建立時間戳（`Date.now()`），用於計算自動消失 |

**Validation Rules**:

- `message` 不可為空字串
- `type` 必須是三個值之一

**Lifecycle**:

```
Created → Visible (entering animation)
       → Active (idle / timer running for success+info)
       → Exiting (exit animation triggered by timeout or manual close)
       → Removed (from state)
```

### ToastState (Reducer State)

管理 Toast 佇列的 reducer state。

| Field    | Type          | Description                  |
| -------- | ------------- | ---------------------------- |
| `toasts` | `ToastItem[]` | 目前所有 Toast，最新的在最後 |

**Capacity Rule**: `toasts.length` 最多 5 個。ADD action 超過上限時，先移除 `toasts[0]`（最舊的）。

## Reducer Actions

| Action      | Payload                                | Effect                                         |
| ----------- | -------------------------------------- | ---------------------------------------------- |
| `ADD`       | `{ message: string, type: ToastType }` | 建立 ToastItem 加入陣列尾端；超過 5 個移除最舊 |
| `REMOVE`    | `{ id: string }`                       | 從陣列移除指定 id 的 Toast                     |
| `CLEAR_ALL` | (none)                                 | 清空整個陣列（路由變更時觸發）                 |

## Context API

| Export          | Type                               | Description                        |
| --------------- | ---------------------------------- | ---------------------------------- |
| `ToastContext`  | `React.Context<ToastContextValue>` | Context 物件                       |
| `ToastProvider` | `React.FC<{ children }>`           | Provider 元件，包裹於 `layout.jsx` |
| `useToast`      | `() => { showToast, removeToast }` | Custom hook，消費者端使用          |

### showToast Signature

```
showToast(message: string, type?: ToastType) → void
```

- `type` 預設為 `'success'`
- 內部 dispatch ADD action

### removeToast Signature

```
removeToast(id: string) → void
```

- 內部 dispatch REMOVE action
- 由 Toast 元件的關閉按鈕或 auto-dismiss timer 呼叫

---

## 追加 (2026-04-09) — CRUD Toast 整合所需的 State 變更

### 移除的 Inline Error State

以下 state 將被移除（改用 Toast）：

#### 活動列表頁 (`src/app/events/page.jsx`)

| 移除項目                         | 型別             | 替代方式                  |
| -------------------------------- | ---------------- | ------------------------- |
| `createError` / `setCreateError` | `useState(null)` | `showToast(msg, 'error')` |
| `deleteError` / `setDeleteError` | `useState('')`   | `showToast(msg, 'error')` |

#### 活動詳情頁 (`src/app/events/[id]/eventDetailClient.jsx`)

| 移除項目                         | 型別           | 替代方式                  |
| -------------------------------- | -------------- | ------------------------- |
| `deleteError` / `setDeleteError` | `useState('')` | `showToast(msg, 'error')` |

### 元件 Props 變更

| 元件                 | 移除 Prop     | 原因                               |
| -------------------- | ------------- | ---------------------------------- |
| `EventDeleteConfirm` | `deleteError` | Error 改走 Toast，不再 inline 顯示 |

### 新增 import (文章頁面)

| 檔案                      | 新增                                      | 原因                 |
| ------------------------- | ----------------------------------------- | -------------------- |
| `src/app/posts/page.jsx`  | `useToast` from `@/contexts/ToastContext` | 目前未使用 Toast     |
| `src/app/posts/page.jsx`  | `useSearchParams` from `next/navigation`  | 讀取導航 toast param |
| `src/app/events/page.jsx` | `useSearchParams` from `next/navigation`  | 讀取導航 toast param |

### 無 Firestore 變更

本功能為純 client-side state，不涉及任何 Firestore collection 或 schema 修改。
