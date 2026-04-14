# Posts 頁面 Bug 與程式碼品質分析

## Context

準備對文章頁面做 UI/UX 重新設計，先釐清功能面的 bug 和程式碼品質問題。以下分析將問題分為三類：**現在修**（redesign 前）、**redesign 時一起處理**、**獨立任務**。

---

## A. 現在修（redesign 前）

這些是邏輯層 / 資料層的 bug，不會因為 UI 改版而被覆蓋，先修可以避免 redesign 繼承壞基礎。

### A1. `composeButtonHandler` null crash — page.jsx:167

```js
const p = posts.find((x) => x.id === postId);
// if (!p) return; // ← 被註解掉了！
setTitle(p.title); // p 可能是 undefined → TypeError
```

**問題**：如果文章被另一個 tab 刪除，點「編輯」直接 crash。
**修法**：取消註解 guard + 加 toast 提示。

### A2. `deletePost()` 不清 subcollection — firebase-posts.js:418

```js
export async function deletePost(postId) {
  await deleteDoc(doc(db, 'posts', postId)); // likes/ comments/ 全部孤兒化
}
```

**問題**：只刪 parent doc，`likes` 和 `comments` subcollection 永久殘留 Firestore，持續產生儲存費用。對比 `deleteEvent` 有用 `writeBatch` 清理所有 subcollection。
**修法**：參考 `firebase-events.js` 的 `deleteEvent` 模式，用 batch 刪除 likes + comments subcollection 後再刪 post doc。

### A3. 死掉的 state — PostDetailClient.jsx:38

```js
const [, setIsCommentEditing] = useState(false); // getter 被丟掉，setter 被呼叫但 value 沒人讀
```

**問題**：`setIsCommentEditing` 在三處被呼叫（L257, L275, L359）但 value 從未被消費。實際用 `commentEditing !== null` 判斷。Dead code 造成多餘 re-render + 混淆。
**修法**：移除 useState 宣告 + 三處 setter call。

### A4. Like revert 邏輯脆弱 — page.jsx:244-254

```js
// 失敗時再 toggle 一次 — 假設 state 剛好是 toggled 狀態
if (result === 'fail') {
  setPosts((prev) => prev.map((p) => {
    const nextLiked = !prevLiked; // 用的是 closure 裡 prev 的再次 toggle
```

**問題**：revert 是「再 toggle 一次」而非「還原到先前值」。快速連點或 React batching 可能導致 count 錯位。PostDetailClient.jsx:371-390 的做法正確（先 capture prevLiked/prevCount，失敗時直接還原）。
**修法**：改為 capture-and-restore 模式，跟 PostDetailClient 一致。

### A5. 文章沒有 input validation

**問題**：

- 空標題 + 空內容可以送出（page.jsx:187, PostDetailClient.jsx:199）
- firebase-posts.js 的 `createPost` / `updatePost` 也不驗證
- 對比 `addComment` 有 trim + empty check，event comments 有 500 字限制

**修法**：

1. Service 層（firebase-posts.js）加 trim + empty + max length 驗證（defense-in-depth，redesign 不影響）
2. UI 層加 early return + toast 提示

### A6. Migration script 清理既有孤兒資料

寫一次性 Node.js script，掃描 Firestore 中所有 `posts/{postId}/likes` 和 `posts/{postId}/comments` 的 subcollection docs，如果 parent post doc 已不存在就批次刪除。放在 `scripts/` 目錄。

---

## B. Redesign 時一起處理

這些跟元件結構深度耦合，現在修了 redesign 會重做。

| 問題                               | 位置                               | 說明                                                                                       |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| IntersectionObserver deps 過寬     | page.jsx:157, PostDetailClient:148 | 應抽 `useInfiniteScroll` hook，但 redesign 會重構元件                                      |
| Scroll-to-comment 300ms setTimeout | PostDetailClient:156               | 慢網路下 silently fail，需改用 MutationObserver，但生命週期會隨 redesign 改變              |
| page.jsx 400+ 行 monolith          | page.jsx 全檔                      | 應拆 hooks（參考 events 的 useComments / useCommentMutations），這就是 redesign 本身的工作 |
| Magic numbers 散落各處             | 多檔                               | `limit(10)`, `300px`, `300ms` 應抽常數，redesign 時統一處理                                |

---

## C. 獨立任務

| 問題                      | 說明                                                                                            | 建議                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Search case sensitivity   | `getPostsBySearch` 存在但 **UI 沒有呼叫**（沒有搜尋 UI），且 Firestore range query 對大小寫敏感 | 等搜尋功能上線時再處理                                                 |
| Post/Event 留言系統不一致 | Event comments 有 history / isEdited / 500字限制；Post comments 全沒有                          | 獨立 feature task，需 Firestore schema 改動                            |
| 零測試覆蓋                | firebase-posts.js 20+ 函式無測試，頁面元件無整合測試                                            | service 層測試可先寫（不受 redesign 影響），元件測試等 redesign 後再補 |

---

## 修改檔案

- `src/lib/firebase-posts.js` — A2 (deletePost subcollection cleanup), A5 (validation)
- `src/app/posts/page.jsx` — A1 (null guard), A4 (like revert)
- `src/app/posts/[id]/PostDetailClient.jsx` — A3 (dead state), A5 (UI validation)
- `scripts/` — A6 (migration script)

## 執行策略（2026-04-14 決議）

經驗證所有 A 類問題確實存在後，決定**分批處理**而非一次全做，理由如下：

- A1/A3/A4 是純 code bug，改動小、風險低、彼此不衝突
- A2 表面像「照抄 deleteEvent」，但涉及 batch 上限 500 筆、部分失敗處理、刪除流程變慢等需獨立思考的問題
- A5 不是 bug fix 而是 feature — 加 validation 會改變使用者可見行為，需要 UX 決策（最大長度、錯誤文案等）
- A6 是 ops 工作，且應等 A2 上線穩定後再執行

### Branch 017-posts-bug-fix（本次）：A1 + A3 + A4

1. A1 — null guard
2. A3 — 移除 dead state
3. A4 — like revert 改 capture-and-restore

**驗證方式**：

1. `npm run type-check` + `npm run lint` 通過
2. IDE diagnostics（getDiagnostics）無 Warning/Error
3. 手動測試：建立文章 → 編輯 → 按讚 → 確認無 crash

### 後續獨立處理

| 項目                                  | 處理方式                          | 前置條件    |
| ------------------------------------- | --------------------------------- | ----------- |
| A2 — deletePost subcollection cleanup | 獨立 branch                       | 無          |
| A5 — input validation                 | 開 feature ticket，先確認 UX 規格 | UX 決策     |
| A6 — migration script                 | 獨立 ops task                     | A2 上線穩定 |
