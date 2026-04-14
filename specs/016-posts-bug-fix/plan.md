# Implementation Plan: Posts 頁面 Bug 修復 (A1 + A3 + A4)

**Branch**: `016-posts-bug-fix` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-posts-bug-fix/spec.md`

## Summary

修復 posts 頁面三個 bug：A1（編輯已刪除文章時 null crash）、A3（PostDetailClient 的 dead state `isCommentEditing`）、A4（按讚失敗 revert 用 re-toggle 而非 capture-and-restore）。三個修復皆為 UI 層，不涉及 service layer 變更，改動量小且彼此不衝突。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc type checking (`checkJs: true`)
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+
**Storage**: Firestore (不涉及 schema 變更)
**Testing**: 手動測試 + `type-check` + `lint`（SC-005 明確豁免自動化測試）
**Target Platform**: Web (browser)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: N/A（bug fix，不得引入效能退化）
**Constraints**: 不改變任何既有正常流程行為（FR-006）；不要求自動化測試
**Scale/Scope**: 2 files, 3 bugs, ~20 LOC 變動

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle             | Status        | Notes                                                                                                                              |
| --------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| I. SDD/TDD            | ⚠️ 有條件通過 | Spec 存在 ✅。TDD 豁免：SC-005 明確聲明此 branch 不要求自動化測試，驗證以 type-check、lint、手動測試為準。見 Complexity Tracking。 |
| II. Service Layer     | ✅ 通過       | 三個 bug 皆為 UI 層修復，不涉及 `src/lib/` 變更                                                                                    |
| III. UX & Consistency | ✅ 通過       | Toast 訊息使用正體中文（「文章不存在，無法編輯」）                                                                                 |
| V. Code Quality       | ✅ 通過       | MVP 思維：移除 dead code、修正邏輯錯誤，不過度設計                                                                                 |
| VI. Modern Standards  | ✅ 通過       | 修改的函式維持既有 JSDoc，不新增不必要的文件                                                                                       |
| VIII. Agent Protocol  | ✅ 通過       | 修改前取得使用者確認                                                                                                               |
| IX. Coding Iron Rules | ✅ 通過       | 無 JSX 內邏輯、無 eslint-disable、JSDoc 有意義                                                                                     |

## Project Structure

### Documentation (this feature)

```text
specs/016-posts-bug-fix/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal - bug fix)
└── quickstart.md        # Phase 1 output
```

### Source Code (affected files)

```text
src/
├── app/
│   └── posts/
│       ├── page.jsx                    # A1 (null guard) + A4 (like revert)
│       └── [id]/
│           └── PostDetailClient.jsx    # A3 (dead state removal)
└── contexts/
    └── ToastContext.jsx                # 既有 toast 系統（僅使用，不修改）
```

## Complexity Tracking

| Violation              | Why Needed                                                                                | Simpler Alternative Rejected Because       |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| TDD 豁免：無自動化測試 | SC-005 明確決議：此次僅手動驗證 + type-check/lint，自動化回歸測試留給 redesign 後統一補齊 | N/A — 這是 spec 層級的刻意決策，非技術妥協 |

## Fix Details

### Fix 1: A1 — Null Guard on Edit (FR-001, FR-002)

**File**: `src/app/posts/page.jsx`
**Function**: `composeButtonHandler` (L163-182)
**Root Cause**: L168 的 guard clause `if (!p) return;` 被註解掉，導致 `posts.find()` 回傳 `undefined` 時存取 `p.title` crash。

**修復方案**:

1. 取消註解 guard clause
2. 在 guard 內加 `showToast('文章不存在，無法編輯', 'error')` 提示使用者
3. `showToast` 已透過 `useToast()` 在 L29 引入，不需額外 import

**變更範圍**:

```
L168: // if (!p) return; // 安全檢查
→
L168-171: if (!p) {
            showToast('文章不存在，無法編輯', 'error');
            return;
          }
```

### Fix 2: A4 — Like Revert Capture-and-Restore (FR-003, FR-004)

**File**: `src/app/posts/page.jsx`
**Function**: `pressLikeButton` (L224-256)
**Root Cause**: 失敗時的 revert 邏輯（L244-254）是「再 toggle 一次」，而非還原到操作前的值。在 React batching 或快速連點下會導致 count 錯位。

**修復方案**（參考 `PostDetailClient.jsx:371-390` 的正確實作）:

1. 在 optimistic update 之前，先 capture 該文章的 `prevLiked` 和 `prevCount`
2. 失敗時用 captured values 直接還原，不再讀取 current state

**變更範圍**:

```
// Before: 在 setPosts callback 內才讀 prevLiked/prevCount（已被 optimistic update 改過）
// After:  在 setPosts 之前就 capture，失敗時直接 restore

const target = posts.find((p) => p.id === postId);
if (!target) return;
const prevLiked = !!target.liked;
const prevCount = Number(target.likesCount ?? 0);

// optimistic update (不變)
setPosts((prev) => prev.map((p) => { ... }));

const result = await toggleLikePost(postId, user.uid);
if (result === 'fail') {
  // 直接還原到 captured values
  setPosts((prev) =>
    prev.map((p) =>
      p.id === postId ? { ...p, liked: prevLiked, likesCount: prevCount } : p
    ),
  );
}
```

### Fix 3: A3 — Remove Dead State (FR-005)

**File**: `src/app/posts/[id]/PostDetailClient.jsx`
**Root Cause**: `useState(false)` 的 value 被丟棄（`const [, setIsCommentEditing]`），setter 在 3 處被呼叫但 value 從未被讀取。實際邏輯使用 `commentEditing !== null` 判斷。

**修復方案**:

1. 刪除 L38: `const [, setIsCommentEditing] = useState(false);`
2. 刪除 L257: `setIsCommentEditing(true);`
3. 刪除 L274: `setIsCommentEditing(false);`
4. 刪除 L359: `setIsCommentEditing(false);`

**影響**: 減少每次 setter 呼叫觸發的不必要 re-render，消除 dead code 混淆。

## Verification Plan

1. `npm run type-check` — 零新增錯誤
2. `npm run lint` — 零新增錯誤
3. IDE `getDiagnostics` — 無 Warning/Error
4. 手動測試：
   - 建立文章 → 編輯 → 確認正常
   - 模擬文章不存在情境 → 確認不 crash + toast 提示
   - 按讚 → 確認 UI 更新正確
   - 留言 → 建立 / 編輯 / 取消 → 確認正常運作
