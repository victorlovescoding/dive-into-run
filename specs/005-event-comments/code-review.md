# Code Review — 005-event-comments

日期：2026-04-02

---

## Taste Rating: 🟡 Acceptable — Works but could be cleaner

整體架構可用，service layer 乾淨，但 UI 層有一個 God Component 問題、幾個真實 bug、以及一個 Firestore Rules 安全漏洞。

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Event comments is a real feature users need.
2. **Is there a simpler way?** — The service layer is appropriately simple. The UI layer (`CommentSection.jsx`) is over-consolidated — 15 state variables in one component is a design smell.
3. **What will this break?** — Nothing existing. New feature, additive only. `eventDetailClient.jsx` change is 2 lines.

---

## [CRITICAL ISSUES]

### 🔴 C1 — Firestore Rules: History `create` 允許任何登入用戶寫入

**[firestore.rules, Line 137]**

```
allow create: if isSignedIn();
```

任何已登入用戶都能對 **任何留言** 的 `history` 子集合寫入任意文件。攻擊者可以偽造編輯記錄。應該驗證 `request.auth.uid == get(/databases/$(database)/documents/events/$(eventId)/comments/$(commentId)).data.authorUid`（只有留言作者在 transaction 裡才會寫 history）。

**Severity: Security — 必須修復**

---

### 🔴 C2 — ESLint Error: `setState` inside `useEffect`（CommentInput.jsx:20）

**[src/components/CommentInput.jsx, Line 18-23]**

```js
useEffect(() => {
  if (prevSubmittingRef.current && !isSubmitting && !submitError) {
    setContent(''); // ← ESLint error: react-hooks/set-state-in-effect
  }
  prevSubmittingRef.current = isSubmitting;
}, [isSubmitting, submitError]);
```

違反 `react-hooks/set-state-in-effect` 規則。這會觸發 cascading render。更好的做法是讓 parent 通過 callback return value 或 key reset 來清空 input：

**Fix 建議**：parent `handleSubmit` 成功後，透過傳入的 `onSubmitSuccess` callback 通知 CommentInput 清空，或直接用 controlled value + parent state。

---

### 🔴 C3 — Fake Timestamp 混入 State（CommentSection.jsx:164）

**[src/components/CommentSection.jsx, Line 162-165]**

```js
updatedAt: { toDate: () => new Date() },
```

編輯成功後，用一個假的 Timestamp 物件更新 local state。這個物件缺少 `.seconds`、`.nanoseconds`、`.isEqual()` 等 Firestore Timestamp API。如果任何下游 code 存取這些屬性，會 crash。

**Fix 建議**：使用 `Timestamp.now()` 或直接 re-fetch comment。

---

## [IMPROVEMENT OPPORTUNITIES]

### 🟡 I1 — God Component: CommentSection 有 15 個 state 變數

**[src/components/CommentSection.jsx]**

299 行、15 個 `useState` — `isLoading`, `isLoadingMore`, `isSubmitting`, `submitError`, `highlightId`, `editingComment`, `isUpdating`, `deletingComment`, `isDeleting`, `deleteError`, `historyComment`, `historyEntries`, `comments`, `cursor`, `hasMore`。

這個 component 同時處理：初始載入、分頁、新增留言、編輯留言、刪除留言、查看歷史記錄。把這些全部放在一個 component 裡嚴重違反 Single Responsibility。

**建議**：抽出 `useComments` custom hook 管理 fetch/pagination state，`useCommentMutations` 管理 CRUD state。至少把 modal state management 分離。

---

### 🟡 I2 — `fetchComments` 和 `fetchMoreComments` 幾乎完全重複

**[src/lib/firebase-comments.js, Lines 55-86]**

兩個函式只差一個 `startAfter(afterDoc)` query constraint。可以合併成一個函式，用 optional cursor 參數區分：

```js
export async function fetchComments(eventId, { afterDoc, limitCount = 15 } = {}) {
  const constraints = [orderBy('createdAt', 'desc'), limit(limitCount)];
  if (afterDoc) constraints.push(startAfter(afterDoc));
  // ...
}
```

---

### 🟡 I3 — 多餘的 Firestore Read: `addComment` 後立即 `getCommentById`

**[src/components/CommentSection.jsx, Lines 130-132]**

```js
const { id } = await addComment(eventId, user, content);
const newComment = await getCommentById(eventId, id);
setComments((prev) => [newComment, ...prev]);
```

`addComment` 寫入後，你已經知道所有欄位值（authorUid, authorName, content, etc.）。多一次 `getCommentById` Firestore read 完全不必要。在 `addComment` 裡直接 return 完整的 comment 物件即可。唯一需要 server 的是 `createdAt`（serverTimestamp），但 UI 顯示可以先用 local Date，跟 C3 一樣用 Timestamp.now()。

---

### 🟡 I4 — setTimeout 未 cleanup（CommentSection.jsx:134）

**[src/components/CommentSection.jsx, Line 134]**

```js
setTimeout(() => setHighlightId(null), 2000);
```

如果 component 在 2 秒內 unmount，會觸發 "setState on unmounted component"。應該用 `useEffect` cleanup 或 `useRef` 來存 timeout ID。

---

### 🟡 I5 — CommentInput 用 `<input type="text">`，CommentEditModal 用 `<textarea>`

**[src/components/CommentInput.jsx, Line 45]** vs **[src/components/CommentEditModal.jsx, Line 33]**

新增留言用單行 `<input>`，編輯留言用多行 `<textarea>`。這個不一致很奇怪 — 用戶新增時打的長留言不能換行，但編輯時可以？統一用 `<textarea>` 比較合理。

---

### 🟡 I6 — CommentEditModal 沒有字數限制顯示

**[src/components/CommentEditModal.jsx]**

CommentInput 在 450 字以上會顯示字數計數器，但 CommentEditModal 完全沒有。用戶可能在編輯時超過 500 字，然後送出時被 server 端拒絕，UX 不佳。

---

### 🟡 I7 — Modal 沒有 Focus Trap

**[src/components/CommentEditModal.jsx, CommentDeleteConfirm.jsx, CommentHistoryModal.jsx]**

三個 Modal 都只有 `aria-modal="true"` 和 Escape 鍵關閉，但沒有 focus trap。用戶可以 Tab 到 modal 後面的內容。這對 a11y 是問題。至少應該用 `<dialog>` element 或一個 focus-trap library。

---

### 🟡 I8 — CommentCardMenu 缺少鍵盤導航

**[src/components/CommentCardMenu.jsx]**

dropdown menu 有正確的 `role="menu"` 和 `role="menuitem"`，但沒有 Arrow Up/Down 鍵盤導航，也沒有 focus management（開啟時應聚焦第一個 menuitem）。這違反 WAI-ARIA menu pattern。

---

### 🟡 I9 — `loadMore` error 被完全吞掉

**[src/components/CommentSection.jsx, Lines 100-101]**

```js
} catch {
  // silently fail
}
```

用戶捲到底部，load more 失敗 — 什麼反饋都沒有。至少顯示 "載入更多失敗，點擊重試" 之類的 UI。

---

## [STYLE NOTES]

### S1 — 多個子元件 JSDoc 缺少 `@returns` 和 `@param` description

**[CommentCardMenu.jsx, CommentDeleteConfirm.jsx, CommentEditModal.jsx, CommentHistoryModal.jsx, CommentInput.jsx]**

共 18 個 ESLint warnings — 所有子元件的 JSDoc 缺少 `@returns` 宣告和 `@param` 的 description。按 CLAUDE.md 規定，所有 export 函數必須有完整 JSDoc。

---

### S2 — `<img>` 應改用 `next/image`

**[src/components/CommentCard.jsx, Line 43]**

```jsx
<img src={comment.authorPhotoURL} alt="" className={styles.avatar} />
```

Next.js 專案應用 `<Image>` component 以優化 LCP。ESLint 已警告。

---

### S3 — `firebase-comments.js` JSDoc `@param` default 值

**[src/lib/firebase-comments.js, Lines 52, 72]**

`@param {number} [limitCount=15]` 觸發 `jsdoc/no-defaults` warning。改用 JSDoc description 內描述預設值。

---

## [TESTING GAPS]

### T1 — Unit Tests 過度依賴 Mock 斷言

**[specs/005-event-comments/tests/unit/firebase-comments.test.js]**

大部分 unit test 的 pattern 是：mock Firebase → call function → assert mock was called with correct args。例如 `fetchComments` 的測試只驗證 `mockCollection` 和 `mockOrderBy` 被正確呼叫 — 這是在測試**實作細節**，不是**行為**。

好的部分：`addComment` 的 validation tests（空 content、超過 500 字、null user）是真正的行為測試 ✅。`formatCommentTime` / `formatCommentTimeFull` 的 pure function 測試很完美 ✅。

**建議**：對 service functions，與其斷言 mock 被呼叫，不如斷言 return value 的結構和內容（你已經在做了，但 assertion 順序應該 output-first）。

---

### T2 — Integration Tests 有一處用了 `container.querySelector`

**[specs/005-event-comments/tests/integration/CommentSection.test.jsx, Line 1231]**

```js
const timeElement = container.querySelector('time[dateTime]');
```

違反 Testing Library best practices — 應避免 `container.querySelector`。改用 `screen.getByRole` 或其他 accessible query。`<time>` 沒有 implicit ARIA role，但可以用 text content 或 custom test id 查詢。

---

### T3 — Integration Tests mock 了整個 firebase-comments module

這些是 integration tests，但 firebase-comments 完全被 mock 掉了。也就是說，「新增留言 → 驗證留言出現在列表上」這個 flow 並沒有測試 CommentSection + firebase-comments 的整合，只測試了 CommentSection 自己和 mocked responses 的互動。

這在 component-level integration testing 中是可接受的做法（因為不可能在 jsdom 裡跑 Firestore），但要清楚這不是 **真正的** service integration test。E2E tests 才是覆蓋這一層的。

---

## VERDICT

❌ **Needs rework** — 3 個 Critical Issues 必須先處理：

1. **C1 — Firestore Rules 安全漏洞**（history create 允許任意用戶寫入）
2. **C2 — ESLint Error 未通過**（CommentInput.jsx set-state-in-effect）
3. **C3 — Fake Timestamp**（CommentSection.jsx:164）

修復這三個後，code quality 可以 pass。I1-I9 是「should fix」等級，建議在 merge 前至少處理 I4（setTimeout leak）和 I7（focus trap）。

---

## KEY INSIGHT

**CommentSection.jsx 是一個 300 行、15 state 的 God Component，把 CRUD + pagination + modal management 全塞在一起** — 它能 work，但 data structure（state shape）的選擇讓每加一個功能都要往這個 component 裡再加 state，complexity 會線性成長。這正是 Linus 說的「bad data structures make for bad code」。
