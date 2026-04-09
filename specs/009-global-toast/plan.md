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

---

# 追加 Plan: CRUD Toast 整合 (FR-011–FR-014, SC-001)

**Date**: 2026-04-09
**Input**: Session 2026-04-09 QAs, User Story 1b, FR-011–FR-014, SC-001 補充
**Prerequisite**: Phase 1–6（核心 Toast 基礎設施 + 初始頁面遷移）已全部完成

## Summary

在已完成的 Toast 基礎設施上，全面覆蓋活動與文章的 CRUD 操作回饋。主要工作：

1. **活動頁面**：補齊缺失的 success toast（建立、編輯、刪除）、將 inline error state（`createError`、`deleteError`）改為 error toast
2. **文章頁面**：為所有 CRUD 操作新增 try-catch + success/error toast（目前完全靜默）
3. **導航 Toast**：活動/文章詳情頁刪除後導航至列表頁，透過 URL search param 在目標頁觸發 toast
4. **清理**：移除殘留的 inline error state 和 `EventDeleteConfirm` 的 `deleteError` prop
5. **Bug Fix**: 文章詳情頁刪除後缺�� `router.push('/posts')` 導航

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19
**Storage**: N/A（純 client-side state，無持久化）
**Testing**: Vitest (jsdom) — unit + integration
**Target Platform**: Web (mobile 375px + desktop 1440px)
**Project Type**: web-app (Next.js)
**Performance Goals**: N/A
**Constraints**: 不新增任何 dependency；不修改已測試的 Toast 基礎設施（ToastContext、Toast、ToastContainer）
**Scale/Scope**: 4 頁面檔案 + 1 元件

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | 原則       | 狀態    | 說明                                                                          |
| ---- | ---------- | ------- | ----------------------------------------------------------------------------- |
| I    | SDD/TDD    | ✅ PASS | Spec 已有 FR-011–FR-014 明確需求 + US 1b 驗收場景。TDD 循環執行               |
| II   | 嚴格服務層 | ✅ PASS | 不修改 `src/lib/` 服務層。Toast 呼叫在 UI handler 中，Firebase SDK 不直接匯入 |
| III  | UX 一致性  | ✅ PASS | 統一所有 CRUD 回饋為 Toast。正體中文訊息                                      |
| IV   | 效能併發   | ✅ N/A  | 無共享資源操作                                                                |
| V    | 程式碼品質 | ✅ PASS | MVP 方式：inline useEffect 讀 search param（2 處），不過度抽象                |
| VI   | 現代化標準 | ✅ PASS | const、解構、JSDoc、CSS Modules（不新增 CSS）                                 |
| VII  | 安全機密   | ✅ N/A  | 無機密涉及                                                                    |
| VIII | 代理人協議 | ✅ PASS | Plan 經確認後才實作                                                           |
| IX   | 編碼鐵律   | ✅ PASS | Toast 呼叫在 event handler 中，JSX 無邏輯                                     |

**No violations. Proceed to Phase 0.**

## Source Code (修改目標)

```text
src/
├── app/
│   ├── events/
│   │   ├── page.jsx                  # [FR-012/013] success toast 補齊、inline error → toast、讀 search param
│   │   └── [id]/
│   │       └── eventDetailClient.jsx # [FR-012/013] success toast 補齊、delete 導航帶 param、deleteError 移除
│   └── posts/
│       ├── page.jsx                  # [FR-012/013/014] useToast 新增、全 CRUD try-catch + toast、讀 search param
│       └── [id]/
│           └── PostDetailClient.jsx  # [FR-012/013/014] 全 CRUD try-catch + toast、delete 導航（bug fix）
├── components/
│   └── EventDeleteConfirm.jsx        # [清理] 移除 deleteError prop + inline error JSX
└── contexts/
    └── (不修改)
```

**Structure Decision**: 不新增檔案，僅修改 4 個頁面 + 1 個元件。Toast 基礎設施不動。

---

## Design Decisions

### D-001: 導航後 Toast — URL Search Params

**場景**: 活動/文章詳情頁刪除成功 → 導航至列表頁 → 在列表頁顯示 toast

**方案**: 詳情頁 `router.push('/events?toast=活動已刪除')`，列表頁 `useSearchParams()` 讀取並顯示

**時序安全性**:

1. pathname `/events/[id]` → `/events` → ToastContext CLEAR_ALL 觸發（清空舊 toast）
2. 列表頁 useEffect 讀取 `searchParams.get('toast')` → `showToast()` 新增 toast
3. `router.replace('/events', { scroll: false })` → pathname 不變，不觸發 CLEAR_ALL

**替代方案（已拒絕）**: sessionStorage（不可見但難測試）、修改 ToastContext（過度設計）

> 詳見 [research.md](./research.md) R9

### D-002: Error 訊息格式統一

所有 error toast 統一格式：`{操作}失敗，請稍後再試`

不附帶技術錯誤原因（per QA clarification #6）。`console.error(err)` 保留供開發除錯。

> 詳見 [research.md](./research.md) R10

### D-003: Inline Error State 清除

移除 `createError`、`deleteError` 等 inline error state 及其 JSX 顯示。`EventDeleteConfirm` 元件的 `deleteError` prop 同步移除。

> 詳見 [data-model.md](./data-model.md) 追加章節

### D-004: 文章詳情頁刪除導航 Bug Fix

`PostDetailClient.jsx` 刪除成功後目前缺少 `router.push('/posts')`，使用者停留在已刪除的文章頁面。此 bug 在本次 toast 整合中一併修復。

---

## File-Level Change Specification

### 1. `src/app/events/page.jsx`

| 變更                    | 類型    | 詳情                                                                                      |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------- |
| 建立活動 success toast  | FR-012  | 確認/加 `showToast('建立活動成功')`                                                       |
| 編輯活動 success toast  | FR-012  | 加 `showToast('更新活動成功')`                                                            |
| 刪除活動 success 訊息   | FR-012  | 現有 `'刪除成功'` → `'活動已刪除'`                                                        |
| 建立活動 error          | FR-013  | `setCreateError()` → `showToast('建立活動失敗，請稍後再試', 'error')`                     |
| 編輯活動 error 訊息格式 | FR-013  | `'更新活動失敗，請再試一次'` → `'更新活動失敗，請稍後再試'`                               |
| 刪除活動 error          | FR-013  | `setDeleteError()` → `showToast('刪除活動失敗，請稍後再試', 'error')`                     |
| 讀取導航 toast          | FR-011  | 加 `useSearchParams()` + useEffect 讀 `?toast=` param                                     |
| 清理                    | Cleanup | 移除 `createError`/`deleteError` state + inline JSX + EventDeleteConfirm deleteError prop |

### 2. `src/app/events/[id]/eventDetailClient.jsx`

| 變更                           | 類型    | 詳情                                                                  |
| ------------------------------ | ------- | --------------------------------------------------------------------- |
| 編輯活動 success toast         | FR-012  | 加 `showToast('更新活動成功')`                                        |
| 刪除活動 success toast（導航） | FR-012  | `router.push('/events')` → `router.push('/events?toast=活動已刪除')`  |
| 編輯活動 error 訊息格式        | FR-013  | `'更新活動失敗，請再試一次'` → `'更新活動失敗，請稍後再試'`           |
| 刪除活動 error                 | FR-013  | `setDeleteError()` → `showToast('刪除活動失敗，請稍後再試', 'error')` |
| 清理                           | Cleanup | 移除 `deleteError` state + EventDeleteConfirm deleteError prop        |

### 3. `src/app/posts/page.jsx`

| 變更                       | 類型       | 詳情                                                                                |
| -------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| 新增 import                | FR-014     | `useToast` from `@/contexts/ToastContext`、`useSearchParams` from `next/navigation` |
| 建立文章 try-catch + toast | FR-012/013 | 包 try-catch：success `'發佈文章成功'`、error `'發佈文章失敗，請稍後再試'`          |
| 編輯文章 try-catch + toast | FR-012/013 | 包 try-catch：success `'更新文章成功'`、error `'更新文章失敗，請稍後再試'`          |
| 刪除文章 try-catch + toast | FR-012/013 | 包 try-catch：success `'文章已刪除'`、error `'刪除文章失敗，請稍後再試'`            |
| 讀取導航 toast             | FR-011     | useEffect 讀 `?toast=` param                                                        |

### 4. `src/app/posts/[id]/PostDetailClient.jsx`

| 變更                              | 類型       | 詳情                                                                                               |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| 編輯文章 try-catch + toast        | FR-012/013 | 包 try-catch：success `'更新文章成功'`、error `'更新文章失敗，請稍後再試'`                         |
| 刪除文章 try-catch + toast + 導航 | FR-012/013 | 包 try-catch：success `router.push('/posts?toast=文章已刪除')`、error `'刪除文章失敗，請稍後再試'` |
| Bug fix                           | —          | 新增刪除成功後 `router.push('/posts')`                                                             |

### 5. `src/components/EventDeleteConfirm.jsx`

| 變更                  | 類型    | 詳情                                            |
| --------------------- | ------- | ----------------------------------------------- |
| 移除 deleteError prop | Cleanup | JSDoc、destructuring、inline error JSX 全部移除 |

---

## Post-Design Constitution Re-Check

| #   | 原則       | 狀態 | 變更後驗證                                                |
| --- | ---------- | ---- | --------------------------------------------------------- |
| I   | SDD/TDD    | ✅   | 每個檔案變更有對應 acceptance scenario 可測試             |
| II  | 服務層     | ✅   | `src/lib/` 零修改，UI handler 只加 try-catch + toast 呼叫 |
| III | UX 一致性  | ✅   | 10 個 success + 10 個 error toast 訊息全部正體中文        |
| V   | 程式碼品質 | ✅   | 2 處 useEffect 讀 search param，不抽 custom hook（MVP）   |
| IX  | 編碼鐵律   | ✅   | 所有 toast 呼叫在 async handler 中，JSX 無邏輯            |

---

## Generated Artifacts

| Artifact      | Path                                   | Status                           |
| ------------- | -------------------------------------- | -------------------------------- |
| research.md   | `specs/009-global-toast/research.md`   | ✅ Updated (R7–R11 added)        |
| data-model.md | `specs/009-global-toast/data-model.md` | ✅ Updated (state changes added) |
| quickstart.md | `specs/009-global-toast/quickstart.md` | ✅ Updated (CRUD patterns added) |
| plan.md       | `specs/009-global-toast/plan.md`       | ✅ This file                     |
| contracts/    | —                                      | N/A（無外部介面變更）            |

## Next Step

執行 `/speckit.tasks` 產生具體的 task 清單（Phase 7 tasks），基於本 plan 的 File-Level Change Specification。
