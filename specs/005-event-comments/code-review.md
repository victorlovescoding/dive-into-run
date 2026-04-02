# Code Review — 005-event-comments

日期：2026-04-02

---

## Taste Rating: 🟢 Good taste — Clean architecture with proper separation of concerns

上次 review 的 3 個 Critical Issues 全部修復。God Component 拆解成 hooks，Firestore Rules 安全漏洞已堵，假 Timestamp 已換成 `Timestamp.now()`。架構乾淨，service layer 薄而精確，UI 層只管 view。

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Event comments 是真實需求，且修復了前次 review 的安全漏洞和架構問題。
2. **Is there a simpler way?** — 拆出 `useComments` + `useCommentMutations` 後，CommentSection 從 300 行降到 118 行。Hooks 各司其職。已經夠簡潔了。
3. **What will this break?** — Nothing. Additive feature，對 `eventDetailClient.jsx` 只加了 1 行 import + 1 行 JSX。

---

## 前次 Critical Issues 修復狀態

| Issue                                              | Status   | Detail                                                                                                 |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| C1 — Firestore Rules history `create` 允許任意用戶 | ✅ FIXED | `firestore.rules:138-139` 現在驗證 `request.auth.uid == get(.../comments/$(commentId)).data.authorUid` |
| C2 — ESLint Error: setState in useEffect           | ✅ FIXED | 改用 `key` reset pattern（`submitKey` state + `<CommentInput key={submitKey}>`）                       |
| C3 — Fake Timestamp 混入 State                     | ✅ FIXED | `useCommentMutations.js:117` 使用 `Timestamp.now()`                                                    |

## 前次 Improvement Opportunities 修復狀態

| Issue                                     | Status   | Detail                                                                                       |
| ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| I1 — God Component 15 state               | ✅ FIXED | 拆成 `useComments` (7 state) + `useCommentMutations` (9 state)，CommentSection 118 行純 view |
| I2 — fetchComments/fetchMoreComments 重複 | ✅ FIXED | 合併成單一 `fetchComments(eventId, options?)`                                                |
| I3 — addComment 後多餘 getCommentById     | ✅ FIXED | `addComment` 直接 return 建構的 CommentData，用 `Timestamp.now()` 代替 serverTimestamp       |
| I4 — setTimeout 未 cleanup                | ✅ FIXED | `useCommentMutations.js:52` 用 ref 存 timeout，`useEffect` return cleanup                    |
| I5 — input vs textarea 不一致             | ✅ FIXED | CommentInput 改用 `<textarea>`                                                               |
| I6 — EditModal 沒字數限制                 | ✅ FIXED | `CommentEditModal.jsx:42-46` 加了 450+ 字數計數器                                            |
| I7 — Modal 沒有 Focus Trap                | ✅ FIXED | 三個 Modal 全改用 `<dialog>` + `showModal()`，原生 focus trap                                |
| I8 — CardMenu 缺鍵盤導航                  | ✅ FIXED | `CommentCardMenu.jsx:47-79` 完整 Arrow Up/Down/Home/End/Escape 導航                          |
| I9 — loadMore error 被吞掉                | ✅ FIXED | `useComments.js:72` catch 設定 `loadMoreError`，UI 顯示錯誤 + 重試按鈕                       |

---

## [CRITICAL ISSUES]

### 🔴 C1 — Type Error: CommentInput `key` prop 不在 JSDoc 定義中

**[src/components/CommentSection.jsx, Line 92]**

```
error TS2322: Type '{ key: number; onSubmit: ...; isSubmitting: boolean; }'
is not assignable to type '{ onSubmit: ...; isSubmitting: boolean; }'.
Property 'key' does not exist on type '{ onSubmit: ...; isSubmitting: boolean; }'.
```

`npm run type-check` 報錯。React 的 `key` 是特殊 prop，不需要在 JSDoc 裡宣告，但 TypeScript `checkJs` 模式下會把它當成多餘的 prop。

**Fix 建議**：在 `CommentInput.jsx` 的 JSDoc `@param` 加上 `@param {number} [props.key]` — 或者更乾淨的做法：改用 `/** @param {object & { key?: number }} props */` 或直接用 `@type {import('react').FC<...>}` pattern。

**Severity: 違反 CLAUDE.md 規則 5（type-check 必須 pass）**

---

## [IMPROVEMENT OPPORTUNITIES]

### 🟡 I1 — 初始載入失敗完全靜默

**[src/hooks/useComments.js, Lines 51-53]**

```js
} catch {
  if (!cancelled) setIsLoading(false);
}
```

初始 `fetchComments` 失敗時，只把 `isLoading` 設回 false。用戶看到「還沒有人留言」（空列表），但實際是載入失敗。應該加一個 `loadError` state 顯示「載入失敗，請重試」。

---

### 🟡 I2 — 編輯失敗完全靜默

**[src/hooks/useCommentMutations.js, Lines 123-124]**

```js
} catch {
  // stay in modal on failure
}
```

`updateComment` 拋錯時，Modal 留在原地但完全沒有任何錯誤提示。用戶按完「完成編輯」後什麼都沒發生，無法區分是在更新中還是失敗了。至少加一個 `updateError` state 顯示在 Modal 內。

---

### 🟡 I3 — 歷史記錄載入失敗靜默

**[src/hooks/useCommentMutations.js, Lines 174-175]**

```js
} catch {
  setHistoryEntries([]);
}
```

`fetchCommentHistory` 失敗時，顯示的是空列表。用戶打開「編輯記錄」看到什麼都沒有，無法區分是「沒有編輯記錄」還是「載入失敗」。

---

### 🟡 I4 — `CommentHistoryModal` 每次 render 都 reverse array

**[src/components/CommentHistoryModal.jsx, Line 29]**

```js
const reversedHistory = [...history].reverse();
```

每次 render 都做 spread + reverse。量小時不是問題，但不夠 idiomatic。可以用 `useMemo` 或直接在 hook 層就排好序。

---

## [STYLE NOTES]

### S1 — AuthContext.jsx 有既有的 type error

**[src/contexts/AuthContext.jsx, Line 28]**

```
error TS8032: Qualified name 'root0.children' is not allowed without
a leading '@param {object} root0'.
```

這是既有的 type error，不是本次變更引入的，但在 `npm run type-check` 裡會出現。本 branch 有修改 `AuthContext.jsx`（加了 19 行），如果要順手修可以一併處理。

---

## [TESTING GAPS]

### T1 — E2E spec 被 vitest 抓到會爆炸

**[specs/005-event-comments/tests/e2e/event-comments.spec.js, Line 23]**

```
Error: Playwright Test did not expect test.describe.configure() to be called here.
```

`npx vitest run specs/005-event-comments/tests/` 會把 E2E spec 一起抓進來跑，因為 `test.describe.configure({ mode: 'serial' })` 是 Playwright-only API。Vitest config 應該 exclude `**/e2e/**` 或這個檔案應該有 `.spec.js` 以外的副檔名讓 vitest 跳過。

---

### T2 — Unit Tests 仍然偏重 mock 斷言

**[specs/005-event-comments/tests/unit/firebase-comments.test.js]**

跟前次 review 一樣，大部分 unit test 的 pattern 是 mock Firebase → call function → assert mock was called。好的部分：validation tests（空 content、超過 500 字、null user）是真正的行為測試 ✅。`formatCommentTime` / `formatCommentTimeFull` 的 pure function 測試完美 ✅。

---

### T3 — Integration Tests 覆蓋完整且品質好

**[specs/005-event-comments/tests/integration/CommentSection.test.jsx]**

31 個 integration tests 全部通過。涵蓋 US1-US4 完整 user story + Accessibility。使用 `@testing-library/react` + `userEvent.setup()`，沒有 `fireEvent`。用 `screen.getByRole` 查詢，沒有 `container.querySelector`（前次 T2 已修）。很好。✅

---

## VERDICT

✅ **Worth merging** — 前次 3 個 Critical Issues + 9 個 Improvement Opportunities 全部修復。架構從 God Component 進化成 clean hooks + thin view layer。唯一阻擋 merge 的是 **C1 type error**（`key` prop），修復後即可 merge。

I1-I3（靜默錯誤）建議在 merge 前或下一個 iteration 處理，不 block merge。

---

## KEY INSIGHT

**這次的修復展示了 custom hooks 的正確用法 — `useComments` 管 data fetching + pagination，`useCommentMutations` 管 CRUD + modal state — 讓 CommentSection 變成一個 118 行的純 view layer，state 被分散到語義正確的位置。** 前次 review 指出的「bad data structures make for bad code」問題已經解決。
