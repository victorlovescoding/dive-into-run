# Implementation Plan: 全域 Toast 通知系統

**Branch**: `009-global-toast` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-global-toast/spec.md`

## Summary

建立全域 Toast Context + Toast 元件，提供 `showToast(message, type)` API。取代散落在 6 處頁面的 `actionMessage` state、`window.alert()`、`disconnectError` inline 提示與 `console.error` 靜默錯誤。Toast 支援 success / error / info 三種等級，success/info 3 秒自動消失，error 需手動關閉。最多同時 5 個堆疊。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19
**Storage**: N/A（純 client-side state，無持久化）
**Testing**: Vitest (unit + integration, jsdom), Playwright (E2E)
**Target Platform**: Web (Desktop + Mobile responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Toast 出現延遲 < 16ms（一個 render cycle），動畫 60fps
**Constraints**: 純 CSS transition 動畫，不引入第三方動畫庫；CSS Modules 樣式
**Scale/Scope**: 6 個頁面需遷移，1 個新 Context + 1 個新 Component + 1 個 CSS Module

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Notes                                                        |
| ----------------------------- | ------ | ------------------------------------------------------------ |
| I. SDD/TDD                    | PASS   | Spec 完成，plan 制定中，實作前會先寫失敗測試                 |
| II. Strict Service Layer      | PASS   | Toast 是純 UI 層（Context + Component），不涉及 Firebase SDK |
| III. UX & Consistency         | PASS   | 統一取代散落的回饋機制，語言正體中文                         |
| IV. Performance & Concurrency | PASS   | 純 client-side state，無共享資源併發問題                     |
| V. Code Quality               | PASS   | CSS Modules、JSDoc 必備、MVP 不過度設計                      |
| VI. Modern Standards          | PASS   | const 優先、解構、JSDoc、no import React                     |
| VII. Security & Secrets       | PASS   | 不涉及機密資料                                               |
| VIII. Agent Protocol          | PASS   | 修改前確認                                                   |
| IX. Strict Coding Rules       | PASS   | No logic in JSX — Toast 渲染邏輯抽出；JSDoc 完整             |

**Gate Result**: ALL PASS — 可進入 Phase 0。

## Project Structure

### Documentation (this feature)

```text
specs/009-global-toast/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── contexts/
│   ├── AuthContext.jsx          # 既有 — 參考 Provider 模式
│   └── ToastContext.jsx         # 新增 — Toast state + showToast API
├── components/
│   ├── Toast.jsx                # 新增 — 單一 Toast 元件
│   ├── Toast.module.css         # 新增 — Toast 樣式 + 動畫
│   ├── ToastContainer.jsx       # 新增 — Toast 列表容器（position fixed）
│   └── ToastContainer.module.css # 新增 — 容器定位 + 堆疊佈局
├── app/
│   ├── layout.jsx               # 修改 — 加入 ToastProvider + ToastContainer
│   ├── events/
│   │   ├── page.jsx             # 修改 — 移除 actionMessage，改用 useToast
│   │   └── [id]/
│   │       └── eventDetailClient.jsx  # 修改 — 同上
│   ├── posts/
│   │   └── [id]/
│   │       └── PostDetailClient.jsx   # 修改 — 移除 window.alert，改用 useToast
│   ├── runs/
│   │   └── page.jsx             # 修改 — 移除 disconnectError，改用 useToast
│   ├── member/
│   │   └── page.jsx             # 修改 — catch 區塊加入 showToast error
│   └── signout/
│       └── SignOutButton.jsx    # 修改 — 移除 window.alert，改用 useToast
└── app/events/
    ├── events.module.css        # 修改 — 移除 .errorCard .successCard
    └── [id]/
        └── eventDetail.module.css # 修改 — 移除 .errorCard

specs/009-global-toast/tests/
├── unit/
│   └── toast-context.test.jsx   # ToastContext 邏輯測試
├── integration/
│   └── toast-ui.test.jsx        # Toast 元件渲染 + 互動測試
└── e2e/
    └── toast-feedback.spec.js   # 跨頁面 Toast 行為 E2E
```

**Structure Decision**: 遵循既有 Next.js App Router 結構。新增 `ToastContext.jsx` 在 `src/contexts/`（與 `AuthContext.jsx` 並列），新增 `Toast.jsx` + `ToastContainer.jsx` 在 `src/components/`（共用元件層）。不建立新的目錄層級。

## Design Decisions

### D1: Context + useReducer 管理 Toast 佇列

遵循既有 AuthContext 模式，建立 `ToastContext` 提供 `showToast` 函式。使用 `useReducer` 管理 Toast 陣列（ADD / REMOVE actions），比多個 `useState` 更適合佇列操作。

### D2: ToastContainer 負責定位，Toast 負責單項渲染

分離關注點：

- `ToastContainer`：`position: fixed`、`bottom: 0`、z-index、堆疊方向（flex-column-reverse）
- `Toast`：單一 Toast 的樣式（顏色、圖示、關閉按鈕、動畫）

### D3: CSS Modules + CSS transition 動畫

符合 constitution V（CSS Modules 為主）和 spec assumption（不引入動畫庫）。使用 `transform: translateY()` 滑入 + `opacity` 淡出，搭配 class toggle 控制進出動畫。

### D4: 路由監聽清除 Toast

在 `ToastContext` 內使用 Next.js 的 `usePathname()` 監聽路由變更，變更時 dispatch CLEAR_ALL action。

### D5: 遷移策略 — 逐頁替換

每個頁面獨立遷移，不做 big bang：

1. 移除舊的 state（`actionMessage`、`disconnectError` 等）
2. 引入 `useToast()` hook
3. 將 `setActionMessage(...)` / `window.alert(...)` / `console.error(...)` 替換為 `showToast(message, type)`
4. 移除對應的 CSS class（`.errorCard`、`.successCard`、`.syncError`）

### D6: useToast custom hook

匯出 `useToast()` hook 封裝 `useContext(ToastContext)`，提供便捷 API：

- `showToast(message, type)` — 通用
- 回傳 `{ showToast }` 即可

## Component Signatures

### ToastContext.jsx

```js
/**
 * @typedef {'success' | 'error' | 'info'} ToastType
 */

/**
 * @typedef {object} ToastItem
 * @property {string} id - 唯一識別碼。
 * @property {string} message - 顯示訊息。
 * @property {ToastType} type - Toast 類型。
 * @property {number} createdAt - 建立時間戳。
 */

/**
 * @typedef {object} ToastContextValue
 * @property {ToastItem[]} toasts - 目前所有 Toast。
 * @property {(message: string, type?: ToastType) => void} showToast - 顯示新 Toast。
 * @property {(id: string) => void} removeToast - 移除指定 Toast。
 */

// Provider wraps layout.jsx children
// useToast() hook for consumers
```

### Toast.jsx

```js
/**
 * 單一 Toast 通知元件。
 * @param {object} props
 * @param {ToastItem} props.toast - Toast 資料。
 * @param {(id: string) => void} props.onClose - 關閉回呼。
 */
function Toast({ toast, onClose }) {}
```

### ToastContainer.jsx

```js
/**
 * Toast 列表容器，fixed 定位於畫面底部。
 * 從 ToastContext 取得 toasts 陣列並渲染。
 */
function ToastContainer() {}
```
