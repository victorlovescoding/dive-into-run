# Code Review — 005-event-comments

日期：2026-04-02

---

## Taste Rating: 🟢 Good taste — Clean hooks architecture, proper data ownership, thin view layer

前兩輪 review 的所有 Critical + Improvement issues 已全部修復。架構從初版的 God Component 進化到 `useComments` + `useCommentMutations` 的 clean hooks 分離，CommentSection 是純粹的 view layer。Service layer（`firebase-comments.js`）薄而正確，Transaction 保護寫入一致性。Error handling 已補齊到每個 async path。

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Event comments 是真實社群需求。CRUD + 編輯歷史 + 分頁 + 錯誤處理全部到位。
2. **Is there a simpler way?** — 很難更簡單了。兩個 hooks 各管其職（data fetching vs mutations），CommentSection 145 行純 JSX。Service layer 只做 Firestore 操作，不混 UI state。
3. **What will this break?** — Nothing. 對 `eventDetailClient.jsx` 只加 1 行 import + 2 行 JSX（`<CommentSection eventId={id} />`）。對 `AuthContext.jsx` 的改動（JSDoc 修正 + useMemo context value）修復了既有 lint error，不改變行為。

---

## [CRITICAL ISSUES]

無。

---

## [IMPROVEMENT OPPORTUNITIES]

### 🟡 I1 — `retryLoad` 與 initial useEffect 邏輯重複

**[src/hooks/useComments.js, Lines 44-60 vs 104-119]**

`retryLoad` callback 和 useEffect 內的 `load()` 做的事一模一樣（fetchComments → setComments/setCursor/setHasMore → catch setLoadError → finally setIsLoading），但用了完全不同的寫法（一個 async/await 一個 promise chain）。

```js
// useEffect 內: async/await + cancelled flag
async function load() { ... }

// retryLoad: .then/.catch/.finally, 無 cancelled flag
const retryLoad = useCallback(() => {
  fetchComments(eventId).then(...).catch(...).finally(...);
}, [eventId]);
```

問題：

- 兩處邏輯維護成本雙倍 — 改一邊忘改另一邊就 drift
- retryLoad 沒有 cancelled flag，理論上 unmount 後 retry 會 setState on unmounted component（React 19 不 warn 了，但仍是 smell）

**Fix 建議**：抽出共用的 `loadComments` function，或讓 retryLoad 觸發 eventId 的 re-key 來重跑 useEffect。最簡單的做法：加一個 `retryCounter` state，retryLoad 只做 `setRetryCounter(c => c + 1)`，把 retryCounter 加到 useEffect deps。

---

### 🟡 I2 — `loadError` 和 `isLoading` 同時為 true 的短暫不一致

**[src/hooks/useComments.js, Lines 45-46]**

```js
setIsLoading(true);
setLoadError(null);
```

在 `load()` 開頭先設 `isLoading = true`，再清 `loadError`。React 18+ batching 確保這兩個 setState 在同一個 render，但語義上 loadError 應該在 isLoading 之前清掉（先清錯誤，再標記載入中）。順序應該反過來，或用 useReducer 一次切換。不是 bug，是 code smell。

---

### 🟡 I3 — `deleteComment` 的 batch delete 沒有分頁保護

**[src/lib/firebase-comments.js, Lines 177-188]**

```js
const historySnap = await getDocs(historyRef);
const batch = writeBatch(db);
historySnap.docs.forEach((d) => batch.delete(d.ref));
batch.delete(commentRef);
await batch.commit();
```

Firestore writeBatch 限制 500 operations/batch。如果一則留言的 history 超過 499 筆（極端但理論可能），batch.commit() 會炸。現階段 500 字留言被編輯 499 次幾乎不可能，但 Linus 會說：好的 data structure 不應該有隱藏的上限。

**Fix 建議**：加個 guard comment 標明限制，或用 `chunks of 499` pattern。不 block merge。

---

### 🟡 I4 — `.errorAlert` CSS 重複三份

**[CommentDeleteConfirm.module.css:28-35, CommentEditModal.module.css:100-107, CommentHistoryModal.module.css:119-128]**

```css
.errorAlert {
  background: #fdecea;
  color: #d32f2f;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
}
```

三個 CSS Module 檔案有幾乎一模一樣的 `.errorAlert`，只差 margin 方向。用 CSS Modules 時無法共用 class，但可以考慮抽成 Tailwind utility 或共用 CSS Module（`ErrorAlert.module.css`）被多個元件 import。不 block merge，但 3 份一樣的 CSS 是 maintenance burden。

---

## [STYLE NOTES]

### S1 — `@ts-expect-error` 用來壓 React `key` prop

**[src/components/CommentSection.jsx, Line 114]**

```js
// @ts-expect-error — key 是 React 特殊 prop，不在 CommentInput JSDoc 型別中但為合法用法
<CommentInput key={submitKey} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
```

合理的 workaround。React 的 `key` 不是 component prop，TypeScript JSDoc `@param {object} props` 嚴格模式下無法正確表達。用 `@ts-expect-error` + 清楚的中文解釋是正確做法。比 `@ts-ignore` 好，因為如果未來 TypeScript 修了這個問題，`@ts-expect-error` 會反過來報錯提醒你移除。✅

---

### S2 — `CommentCard.jsx` 不需要 `'use client'`

**[src/components/CommentCard.jsx]**

這個元件沒有使用 hooks 或 browser APIs，理論上可以是 Server Component。但因為它被 `CommentSection`（client component）import，Next.js 會自動把它當 client component 處理，所以不加 `'use client'` 也能正常運作。不加反而更正確 — 讓 Next.js 決定 boundary。

---

### S3 — `CommentInput.jsx:12` 的 `@param {object} props` 回到原樣

**[src/components/CommentInput.jsx, Line 8]**

之前嘗試了 `{object & { key?: number }}` 和 `@param {number} [props.key]`，最終回到 `{object}`。這是正確的 — key 是 React 內部機制，不是 component 的 public API，不該出現在 props JSDoc 裡。`@ts-expect-error` 在 call site 已經處理了。✅

---

## [TESTING GAPS]

### T1 — Unit Tests 偏重 mock 斷言（既有，非新增）

**[specs/005-event-comments/tests/unit/firebase-comments.test.js]**

38 個 unit tests。大部分 pattern 是：mock Firebase → call function → assert mock was called with correct args。這不是行為測試，是實作細節測試 — 如果你 refactor Firestore 呼叫順序但行為不變，所有 tests 都會壞。

**好的部分** ✅：

- Validation tests（空 content、超過 500 字、null user）是真正的行為測試 — 輸入不合法 → 拋出正確的 error message
- `formatCommentTime` / `formatCommentTimeFull` 的 pure function 測試是完美的 unit test

**應該改進的部分**：

- `fetchComments` 測試應該 assert 回傳的 data shape，不是 assert `mockOrderBy` 被呼叫
- `updateComment` 測試應該 assert transaction 結束後 comment 被更新，不是 assert `tx.update` 和 `tx.set` 被呼叫

不 block merge — 這是 testing philosophy 的改善，不是缺陷。

---

### T2 — Integration Tests 品質優秀

**[specs/005-event-comments/tests/integration/CommentSection.test.jsx]**

31 個 integration tests 全部通過。覆蓋 US1-US4 完整 user story + Accessibility。

**Compliance check**：

- ✅ `@testing-library/react` + `userEvent.setup()` — 沒有 `fireEvent`
- ✅ `screen.getByRole` / `screen.getByText` — 沒有 `container.querySelector`
- ✅ `within()` 正確用於 scoped queries
- ✅ `waitFor()` 用於 async assertions — 沒有 `waitForTimeout`
- ✅ AAA pattern 清楚標註
- ✅ Helper functions（`createMockComment`, `renderWithAuth`）乾淨且有 JSDoc

唯一的 console warning（`act(...)` on infinite scroll test）是 IntersectionObserver mock 的已知限制，不影響測試正確性。

---

### T3 — E2E Tests 不再被 Vitest 誤抓

**[vitest.config.mjs]**

`exclude: ['**/e2e/**', '**/node_modules/**']` 正確解決了 Playwright-only API（`test.describe.configure`）在 Vitest 下爆炸的問題。E2E spec 本身品質好 — `page.getByRole` locators、無 `waitForTimeout`、完整的 JSDoc。✅

---

### T4 — 新增的 error handling（I1-I3 fix）缺少對應測試

**[未覆蓋]**

本次新增了 3 個 error state（`loadError`, `updateError`, `historyError`）和對應的 UI 顯示，但 integration test 沒有覆蓋這些 path：

- 初始 `fetchComments` reject → 應顯示「載入留言失敗」+ 重試按鈕
- `updateComment` reject → 應在 EditModal 內顯示「更新失敗，請再試一次」
- `fetchCommentHistory` reject → 應在 HistoryModal 內顯示「載入編輯記錄失敗」

建議在下一個 iteration 補上。不 block merge — error path 的邏輯已在 code 中正確實作。

---

## VERDICT

✅ **Worth merging** — 架構乾淨（hooks + thin view），service layer 正確使用 transaction/batch，Firestore rules 安全，前三輪 review 的所有問題都已修復。Error handling 從「全靜默」進化到「每個 async path 都有 error state + UI 回饋」。

I1-I4 是改善建議，不 block merge。T4（error path 測試）建議在下一個 iteration 補。

---

## KEY INSIGHT

**這個 feature 的演化過程 — 從 God Component → hooks 拆分 → error handling 補齊 — 展示了正確的 iterative development。每輪 review 都推動架構往更好的方向走，而不是推翻重來。最終的 data flow（CommentSection 只管 view，useComments 管 fetching，useCommentMutations 管 CRUD）是教科書級的 React hooks 分離。**
