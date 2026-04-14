# Research: Posts 頁面 Bug 修復 (A1 + A3 + A4)

**Branch**: `016-posts-bug-fix` | **Date**: 2026-04-14

## Research Task 1: Toast 系統使用方式

**Decision**: 使用既有 `useToast()` hook 的 `showToast(message, type)` API。

**Rationale**:

- `src/contexts/ToastContext.jsx` 提供 `useToast()` hook
- `showToast(msg)` 預設為 success，`showToast(msg, 'error')` 為錯誤提示
- `page.jsx:29` 已引入 `const { showToast } = useToast()`，不需額外 import
- 同檔案已有多處使用範例（L196, L207, L211, L282, L285）

**Alternatives considered**: 無 — 既有機制完整，不需引入新方案。

## Research Task 2: Like Revert 正確模式

**Decision**: 採用 capture-and-restore 模式，參考 `PostDetailClient.jsx:371-390`。

**Rationale**:

- `PostDetailClient.jsx` 的 `handleToggleLike()` 已正確實作：
  1. Optimistic update 前先 capture `prevLiked` 和 `prevCount`
  2. 失敗時直接用 captured values 還原
- `page.jsx` 的 `pressLikeButton()` 使用 re-toggle（再 toggle 一次）模式，在以下情境會失敗：
  - React state batching 導致 revert 時讀到的 state 不是預期的 toggled state
  - 快速連點時 closure 捕獲的 state 已過時
- Capture-and-restore 不依賴 current state，天然防 race condition

**Alternatives considered**:

- Re-fetch from server：正確但延遲高，不適合 optimistic UI 場景
- Re-toggle（現有做法）：已證實在 batching/快速連點下不可靠

## Research Task 3: Dead State 移除安全性

**Decision**: 直接刪除 `isCommentEditing` state 宣告及 3 處 setter 呼叫。

**Rationale**:

- `const [, setIsCommentEditing] = useState(false)` — value 被解構丟棄
- Setter 在 L257、L274、L359 被呼叫，但 value 從未被任何邏輯讀取
- 實際的「是否在編輯留言」邏輯使用 `commentEditing !== null` 判斷（`commentEditing` 是另一個 state，存放正在編輯的留言物件）
- 移除後不影響任何可觀察行為，僅減少無效 re-render

**Alternatives considered**:

- 保留但加註 TODO：增加維護混淆，且 spec FR-005 明確要求移除
