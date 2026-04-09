# Research: 全域 Toast 通知系統

**Branch**: `009-global-toast` | **Date**: 2026-04-08

## R1: Toast State Management — Context + useReducer vs useState

**Decision**: `useReducer` 搭配 `ToastContext`

**Rationale**:

- Toast 佇列涉及多種 action（ADD、REMOVE、CLEAR_ALL），`useReducer` 比多個 `useState` 更清晰
- 既有 `AuthContext` 使用 `useState`，但 Auth 只有 set/get；Toast 佇列有陣列操作（push、filter、splice），reducer 更適合
- 不需要外部 state library（Zustand、Redux）——一個 Context 就夠

**Alternatives Considered**:

- `useState` + helper functions：可行但 action 語意不明確
- Zustand / Jotai：過度設計，引入額外相依

## R2: Toast 動畫方案

**Decision**: CSS Modules + CSS `transition` + class toggle

**Rationale**:

- Constitution V 規定以 CSS Modules 為主
- Spec assumption 明確不引入動畫庫
- 既有 codebase 已用 `transition: 0.2s ~ 0.4s` 做 hover/focus 動畫
- 進入：`transform: translateY(100%) → translateY(0)` + `opacity: 0 → 1`
- 離開：加上 `.exiting` class，transition 完成後 remove DOM

**Alternatives Considered**:

- `@keyframes`：適合 spinner 等無限迴圈，Toast 是一次性過渡用 transition 更合適
- Framer Motion / react-spring：過度設計，且增加 bundle size
- `<dialog>` / Popover API：語意不合，Toast 不是對話框

## R3: Toast 定位與堆疊

**Decision**: `position: fixed; bottom: 24px; right: 24px` (desktop), `bottom: 16px; left: 16px; right: 16px` (mobile)

**Rationale**:

- Spec 指定底部，靠近使用者視覺焦點
- Desktop 右下角是業界慣例（Google, GitHub, Slack），不遮擋左側內容
- Mobile 全寬 - 32px margin，確保不遮擋底部導覽
- 堆疊方向：`flex-direction: column-reverse`，新 Toast 在最下方（最靠近觸發點）
- `z-index` 需高於 nav（目前 codebase 最高值 1000），建議 `1100`

**Alternatives Considered**:

- 底部置中：Desktop 上可能遮擋中央內容
- 頂部：遠離操作觸發區域，需要移動視線

## R4: 路由變更偵測

**Decision**: `usePathname()` + `useEffect` 監聽 pathname 變化時 dispatch `CLEAR_ALL`

**Rationale**:

- Next.js App Router 提供 `usePathname()` hook
- 比 `useRouter` 的 `events` 更簡潔（App Router 沒有 router.events）
- FR-011 使用 SHOULD（非 MUST），實作簡單且使用者預期行為

**Alternatives Considered**:

- `useRouter` events：Pages Router API，App Router 不支援
- 不清除：Toast 可能殘留到無關頁面，使用者困惑

## R5: Toast ID 生成

**Decision**: `crypto.randomUUID()`

**Rationale**:

- 瀏覽器原生 API，零相依
- 保證唯一性，避免 `Date.now()` 在同一 ms 內重複
- 既有 codebase 中沒有 UUID 工具，不需要引入 `uuid` 套件

**Alternatives Considered**:

- `Date.now().toString()`：同毫秒觸發多個 Toast 時可能衝突
- 遞增 counter：需額外管理，useReducer 裡不方便

## R6: 現有頁面遷移影響分析

| 頁面                                | 目前模式                                                  | 需移除                                 | 需新增                                   |
| ----------------------------------- | --------------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| `events/page.jsx`                   | `actionMessage` state + `.errorCard` / `.successCard` CSS | state, JSX 區塊, CSS classes           | `useToast()` + `showToast()` calls       |
| `events/[id]/eventDetailClient.jsx` | `actionMessage` state + inline style success              | state, JSX 區塊, inline styles         | `useToast()` + `showToast()` calls       |
| `posts/[id]/PostDetailClient.jsx`   | `window.alert('刪除失敗')`                                | `window.alert` + `eslint-disable` 註解 | `useToast()` + `showToast()`             |
| `signout/SignOutButton.jsx`         | `window.alert(error)`                                     | `window.alert` + `eslint-disable` 註解 | `useToast()` + `showToast()`             |
| `runs/page.jsx`                     | `disconnectError` state + `.syncError` CSS                | state, JSX 區塊                        | `useToast()` + `showToast()`             |
| `member/page.jsx`                   | `console.error(err)` 靜默                                 | 無需移除                               | catch 內加 `showToast(message, 'error')` |

---

## Phase 2 追加研究 (2026-04-09) — CRUD Toast 整合 (FR-011–FR-014, SC-001)

> 以下研究針對 spec Session 2026-04-09 新增的六個 QA、User Story 1b、FR-011–FR-014、以及 SC-001 補充。

## R7: 活動頁面 CRUD 回饋 Gap Analysis（詳細）

### 活動列表頁 (`src/app/events/page.jsx`)

| 操作      | 成功回饋                   | 錯誤回饋                                 | 需變更                                       |
| --------- | -------------------------- | ---------------------------------------- | -------------------------------------------- |
| 建立活動  | 待確認（需讀 handler）     | `setCreateError()` inline 紅字           | 確認/加 success toast、error 改 toast        |
| 編輯活動  | 無（靜默）                 | `showToast('更新活動失敗…', 'error')` ✅ | 加 success toast、統一 error 訊息格式        |
| 刪除活動  | `showToast('刪除成功')` ✅ | `setDeleteError()` inline in modal       | error 改 toast、success 訊息改「活動已刪除」 |
| 報名/取消 | ✅                         | ✅                                       | 不在本次範圍                                 |

**需清理的 state**: `createError` / `setCreateError`、`deleteError` / `setDeleteError` → 移除 state + inline JSX

### 活動詳情頁 (`src/app/events/[id]/eventDetailClient.jsx`)

| 操作     | 成功回饋                           | 錯誤回饋                                 | 需變更                                      |
| -------- | ---------------------------------- | ---------------------------------------- | ------------------------------------------- |
| 編輯活動 | 無（靜默）                         | `showToast('更新活動失敗…', 'error')` ✅ | 加 success toast、統一 error 格式           |
| 刪除活動 | `router.push('/events')`（無回饋） | `setDeleteError()` inline in modal       | success: 導航帶 toast param、error 改 toast |

**需清理的 state**: `deleteError` / `setDeleteError` → 移除 state + modal 內 error 顯示

## R8: 文章頁面 CRUD 回饋 Gap Analysis（詳細）

### 文章列表頁 (`src/app/posts/page.jsx`)

| 操作     | 成功 | 錯誤 | Try-Catch | 需變更                      |
| -------- | ---- | ---- | --------- | --------------------------- |
| 建立文章 | 無   | 無   | ❌        | 全新 try-catch + 雙向 toast |
| 編輯文章 | 無   | 無   | ❌        | 全新 try-catch + 雙向 toast |
| 刪除文章 | 無   | 無   | ❌        | 全新 try-catch + 雙向 toast |

**注意**: 目前未 import `useToast()`，需新增。

### 文章詳情頁 (`src/app/posts/[id]/PostDetailClient.jsx`)

| 操作     | 成功                    | 錯誤 | Try-Catch | 需變更                                       |
| -------- | ----------------------- | ---- | --------- | -------------------------------------------- |
| 編輯文章 | 無                      | 無   | ❌        | 全新 try-catch + 雙向 toast                  |
| 刪除文章 | 無（且無 router 導航!） | 無   | ❌        | try-catch + 導航帶 toast param + error toast |

**Critical Bug**: 文章詳情頁刪除後未 `router.push('/posts')`，使用者停留在已刪除文章的頁面。

## R9: 導航後 Toast 觸發方案

**Decision**: URL Search Params `?toast=message`
**Rationale**: 最簡單、最可測試、無副作用、符合憲法 MVP 思維。

### 方案比較

| 方案                                  | 優點                   | 缺點                           |
| ------------------------------------- | ---------------------- | ------------------------------ |
| **A: URL Search Params** ✅           | 簡單、可測試、無副作用 | URL 短暫帶 param（立即清除）   |
| B: sessionStorage                     | 無 URL 汙染            | Side effect、較難測試          |
| C: 修改 ToastContext 加 pending queue | 整合方案               | 過度設計、改動已測試的基礎設施 |

### 實作模式

```js
// 詳情頁刪除成功後
router.push('/events?toast=活動已刪除');

// 列表頁讀取 param
const searchParams = useSearchParams();
useEffect(() => {
  const toastMsg = searchParams.get('toast');
  if (toastMsg) {
    showToast(toastMsg);
    router.replace('/events', { scroll: false });
  }
}, [searchParams, showToast, router]);
```

**時序安全性**:

1. `pathname` 從 `/events/[id]` 變為 `/events` → ToastContext CLEAR_ALL 觸發
2. 列表頁 useEffect 讀取 searchParams → `showToast()` 新增 toast（CLEAR_ALL 已完成）
3. `router.replace('/events')` → pathname 不變，CLEAR_ALL 不再觸發

**使用場景**（僅 2 處）:

- 活動詳情頁刪除 → `/events?toast=活動已刪除`
- 文章詳情頁刪除 → `/posts?toast=文章已刪除`

## R10: Toast 訊息文字對照表

### Success (FR-012)

| 操作     | 頁面       | 訊息                     |
| -------- | ---------- | ------------------------ |
| 建立活動 | 活動列表頁 | 建立活動成功             |
| 編輯活動 | 活動列表頁 | 更新活動成功             |
| 編輯活動 | 活動詳情頁 | 更新活動成功             |
| 刪除活動 | 活動列表頁 | 活動已刪除               |
| 刪除活動 | 活動詳情頁 | 活動已刪除（導航後顯示） |
| 建立文章 | 文章列表頁 | 發佈文章成功             |
| 編輯文章 | 文章列表頁 | 更新文章成功             |
| 編輯文章 | 文章詳情頁 | 更新文章成功             |
| 刪除文章 | 文章列表頁 | 文章已刪除               |
| 刪除文章 | 文章詳情頁 | 文章已刪除（導航後顯示） |

### Error (FR-013) — 格式「{操作}失敗，請稍後再試」

| 操作     | 頁面       | 訊息                     | 現況                          |
| -------- | ---------- | ------------------------ | ----------------------------- |
| 建立活動 | 活動列表頁 | 建立活動失敗，請稍後再試 | `setCreateError()` → 改 toast |
| 更新活動 | 活動列表頁 | 更新活動失敗，請稍後再試 | 已有 toast，統一訊息格式      |
| 更新活動 | 活動詳情頁 | 更新活動失敗，請稍後再試 | 已有 toast，統一訊息格式      |
| 刪除活動 | 活動列表頁 | 刪除活動失敗，請稍後再試 | `setDeleteError()` → 改 toast |
| 刪除活動 | 活動詳情頁 | 刪除活動失敗，請稍後再試 | `setDeleteError()` → 改 toast |
| 建立文章 | 文章列表頁 | 發佈文章失敗，請稍後再試 | 無 try-catch → 新增           |
| 更新文章 | 文章列表頁 | 更新文章失敗，請稍後再試 | 無 try-catch → 新增           |
| 更新文章 | 文章詳情頁 | 更新文章失敗，請稍後再試 | 無 try-catch → 新增           |
| 刪除文章 | 文章列表頁 | 刪除文章失敗，請稍後再試 | 無 try-catch → 新增           |
| 刪除文章 | 文章詳情頁 | 刪除文章失敗，請稍後再試 | 無 try-catch → 新增           |

## R11: EventDeleteConfirm 元件影響

`src/components/EventDeleteConfirm.jsx` 目前接收 `deleteError` prop 並在 modal 內顯示 inline error。

**Decision**: 移除 `deleteError` prop 及相關 JSX
**Impact**: 活動列表頁 + 活動詳情頁皆傳入此 prop，兩處均需移除
**Risk**: 低。Error 改走 toast 後，inline display 不再需要
