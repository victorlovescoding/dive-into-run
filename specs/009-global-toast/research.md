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
