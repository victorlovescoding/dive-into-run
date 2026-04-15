# Code Review — 019-posts-ui-refactor

日期：2026-04-15

---

## Taste Rating

🟡 **Acceptable** - Component decomposition is clean and the stretched-link pattern shows good taste. But the missing expand animation is a straight-up spec violation, the dead CSS shows incomplete cleanup, and the test suite has a real mock gap that silently hides a `TypeError`.

---

## Linus's Three Questions

1. **Is this solving a real problem?** Yes — dev-style blue/red borders to social-style cards is a legitimate upgrade. The component extraction (PostCard, ComposeModal, etc.) is well-motivated by cross-page reuse.
2. **Is there a simpler way?** The decomposition is reasonable. Four new components for four distinct concerns. Not over-engineered.
3. **What will this break?** Type-check is failing. Missing animation violates FR-007. Test mock gap will cause silent failures on comment submission paths.

---

## [CRITICAL ISSUES]

### C1. FR-007 違反 — 展開動畫完全缺失

**[src/components/PostCard.jsx, Lines 245-297]**

Plan D3 和 Research R1 明確設計了 `max-height` + `scrollHeight` 量測 + `transitionend` 清除的展開動畫方案。Spec FR-007 要求「平滑過渡動畫（高度漸變，約 200-300ms）」。

實際實作只有 `useState` 切換，零動畫：

```jsx
const [isExpanded, setIsExpanded] = useState(false);
// ...
<button onClick={() => setIsExpanded(true)}>查看更多</button>;
```

PostCard.module.css 也沒有任何 `transition`、`max-height`、`@keyframes` 相關的 CSS。點擊「查看更多」後內容直接跳出，沒有高度漸變。

**修正方向**：按 D3 設計，加入 `contentRef`、展開時設 `maxHeight = scrollHeight + 'px'`、`transitionend` 後移除 `maxHeight` 限制。CSS 加 `overflow: hidden; transition: max-height 250ms ease`。

---

### C2. Type-check 錯誤 — test fixture 類型不匹配（27 errors）

**[specs/019-posts-ui-refactor/tests/]**

~~原先判定為 `key` prop 不在元件 typedef 中，經 `npm run type-check` 實測驗證後確認 **不存在此問題**。React 在 `checkJs: true` 模式下會自動處理 `key` 作為 reserved prop，不會報錯。~~

實際的 27 個 type errors 全部來自 test files，分三類：

1. **Vitest mock 方法不被 tsc 認識**（`mockResolvedValue`、`mockResolvedValueOnce` 等）：
   ```
   PostDetail.test.jsx(136,19): error TS2339: Property 'mockResolvedValue'
     does not exist on type '(id: string) => Promise<Post>'.
   ```
2. **`EnrichedPost` type mismatch** — test fixture 的 `postAt: { toDate: () => Date }` 不符合 `import('firebase/firestore').Timestamp` 類型：
   ```
   PostCard.test.jsx(46,24): error TS2322: Type '{ id: string; ... postAt:
     { toDate: () => Date; }; ... }' is not assignable to type 'EnrichedPost'.
   ```
3. **`IntersectionObserver` type assignment**：
   ```
   PostFeed.test.jsx(102,3): error TS2322: Type 'typeof IntersectionObserver'
     is not assignable to type '{ new (...): IntersectionObserver; ... }'.
   ```

**修正方向**：

- Mock 方法：在 test files 頂部加 `/** @type {import('vitest').Mock} */` cast，或改用 `vi.mocked()` wrapper。
- Timestamp：在 test fixture 用 `/** @type {any} */` cast `postAt` 欄位，或建立共用的 `createMockTimestamp` helper。
- IntersectionObserver：cast mock class 為 `any` 再賦值。

---

### C3. PostDetail.test.jsx — `notifyPostCommentReply` 未 mock

**[specs/019-posts-ui-refactor/tests/integration/PostDetail.test.jsx, Lines 75-77]**

Mock factory 只 mock 了 `notifyPostNewComment`：

```js
vi.mock('@/lib/firebase-notifications', () => ({
  notifyPostNewComment: vi.fn(),
}));
```

但 `PostDetailClient.jsx:22` 也 import 了 `notifyPostCommentReply`。Vitest 的 factory mock 只 export 你定義的東西，所以 `notifyPostCommentReply` 會是 `undefined`。

當 `submitCommentHandler` 執行到：

```js
notifyPostCommentReply(postId, ...).catch(...)
```

會拋 `TypeError: notifyPostCommentReply is not a function`。這不是 Promise rejection，所以 `.catch()` 無法攔截。

**修正**：加入 `notifyPostCommentReply: vi.fn()` 到 mock factory。

---

### C4. postDetail.module.css — 30 行死 CSS

**[src/app/posts/postDetail.module.css, Lines 70-100]**

```css
.metaBar { ... }
.metaButton { ... }
.metaCount { ... }
.liked { ... }
```

這些 class 在 `PostDetailClient.jsx` 中完全沒被引用。PostCard 元件使用自己的 `PostCard.module.css` 處理 meta bar。這些是重構後殘留的死碼。

**修正**：刪除 `.metaBar`、`.metaButton`、`.metaCount`、`.liked` 這四個 CSS rule。

---

## [IMPROVEMENT OPPORTUNITIES]

### I1. ComposeModal — useEffect 每次 keystroke 都重新註冊 listener

**[src/components/ComposeModal.jsx, Lines 39-58]**

```js
useEffect(() => {
  // ...
  dialog.addEventListener('click', handleBackdropClick);
  return () => dialog.removeEventListener('click', handleBackdropClick);
}, [dialogRef, title, content]); // ← title/content 每個字都變
```

每輸入一個字元，effect 清除再重建 listener。雖然功能正確，但完全沒必要。

**修正**：用 ref 存最新的 `title`/`content`，listener 讀 ref 值，deps 只需 `[dialogRef]`：

```js
const titleRef = useRef(title);
const contentRef = useRef(content);
useEffect(() => {
  titleRef.current = title;
}, [title]);
useEffect(() => {
  contentRef.current = content;
}, [content]);

useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog) return undefined;
  function handleBackdropClick(e) {
    // ...
    if (clickedOutside && !hasContent(titleRef.current, contentRef.current)) {
      dialog.close();
    }
  }
  dialog.addEventListener('click', handleBackdropClick);
  return () => dialog.removeEventListener('click', handleBackdropClick);
}, [dialogRef]);
```

---

### I2. PostCard — `hasContent` 防禦性不足

**[src/components/PostCard.jsx, Line 250]**

```js
const hasContent = post.content !== '';
```

如果 `post.content` 是 `undefined` 或 `null`（資料不一致時），`!== ''` 為 `true`，接著 `shouldShowTruncated` 呼叫 `content.length` 就會 `TypeError`。

雖然 typedef 宣告 `content` 是 `string`，但 Firestore 資料可能不完整。PostCard 已經用 `post.authorName ?? '跑者'` 做防禦，content 也該一致。

**修正**：`const hasContent = !!post.content;` 或 `Boolean(post.content)`。

---

### I3. PostCard — 缺少 focus-visible 樣式

**[src/components/PostCard.module.css]**

所有互動元素（`.metaButton`、`.menuButton`、`.expandButton`、`.metaLink`）都沒有 `:focus-visible` 樣式。鍵盤導航時可能看不到 focus indicator，影響 a11y。

**修正**：為互動元素加 `:focus-visible` outline。

---

### I4. page.jsx — 初始載入的 isAuthor 邏輯在 user 為 null 時遺漏

**[src/app/posts/page.jsx, Lines 53-61]**

```js
if (!user?.uid) {
  setPosts(
    postsData.map((p) => ({
      ...p,
      liked: false,
      // ← isAuthor 沒有設定！
    })),
  );
  return;
}
```

未登入時 `isAuthor` 沒有明確設為 `false`，依賴 Firestore 不回傳 `isAuthor` 欄位。PostCard 裡 `post.isAuthor && onToggleMenu && ...` 會是 `undefined`（falsy），所以功能上正確。但明確設定比隱式 falsy 更清晰。

同樣的問題出現在無限滾動的分支（Lines 108-111）。

---

## [STYLE NOTES]

### S1. ComposePrompt — 冗餘 arrow wrapper

**[src/components/ComposePrompt.jsx, Line 18]**

```jsx
<button onClick={() => onClick()}>
```

`() => onClick()` 等同於 `onClick`，但多了一層不必要的 arrow function allocation。雖然這裡是有意為之（防止 event 物件洩漏，commit 8240681），但可以加個 comment 說明原因，否則看起來像新手寫法。

---

## [TESTING GAPS]

### T1. E2E 骨架屏測試是空測試

**[specs/019-posts-ui-refactor/tests/e2e/posts-ui.spec.js, Lines 26-39]**

```js
const skeletonCount = await skeleton.count();
if (skeletonCount > 0) {
  await expect(skeleton.first()).toBeVisible();
}
```

沒有 hard assertion — 如果載入太快（常見情況），整個 test body 走 if-false 分支，什麼都沒測。一個永遠通過的測試比沒有測試更危險，因為它給你虛假的信心。

**建議**：要嘛用 network throttling 確保骨架屏可見，要嘛改成 `test.skip` 並加 TODO，不要留空殼。

---

### T2. PostDetail 按讚測試只驗 mock call，不驗 UI 狀態

**[specs/019-posts-ui-refactor/tests/integration/PostDetail.test.jsx, Lines 168-178]**

```js
await user.click(likeButton);
expect(toggleLikePost).toHaveBeenCalledWith('post-1', 'user-1');
```

只驗證 mock 被呼叫。沒有驗證樂觀更新後 likesCount 從 5 變成 6、按鈕樣式變更。如果 `setPosts` 的 mapping 邏輯壞了，這個測試不會抓到。

---

### T3. E2E 覆蓋率過低

E2E 只有 6 個測試，遺漏了核心使用者路徑：

- 內容截斷 / 展開（FR-005~FR-008）
- 發文流程（假輸入框 → Modal → 發布 → feed 更新）
- 詳文頁留言互動
- 響應式斷點驗證

列表頁卡片呈現和詳文頁導航有測，但最有價值的跨元件互動沒有 E2E 覆蓋。

---

## [TASK GAPS]

### 所有 tasks [x] — 對照 diff 驗證

| Task | 狀態            | 備註                                                                                |
| ---- | --------------- | ----------------------------------------------------------------------------------- |
| T001 | ✅ 已實作       | `authorName: user.name \|\| '匿名使用者'` in firebase-posts.js                      |
| T002 | ✅ 已實作       | `scripts/backfill-post-author-name.mjs`（diff 中存在）                              |
| T003 | ✅ 已實作       | PostCard.test.jsx 存在                                                              |
| T004 | ✅ 已實作       | PostFeed.test.jsx 存在                                                              |
| T005 | ✅ 已實作       | PostCard.jsx + PostCard.module.css                                                  |
| T006 | ✅ 已實作       | posts.module.css 重寫                                                               |
| T007 | ✅ 已實作       | page.jsx 重構                                                                       |
| T008 | ✅ 已實作       | 截斷測試案例在 PostCard.test.jsx                                                    |
| T009 | ⚠️ **部分缺失** | 截斷邏輯有，但 **max-height transition 動畫完全未實作**（FR-007 violation）         |
| T010 | ✅ 已實作       | ComposeModal.test.jsx                                                               |
| T011 | ✅ 已實作       | ComposePrompt.jsx + CSS                                                             |
| T012 | ✅ 已實作       | ComposeModal.jsx + CSS                                                              |
| T013 | ✅ 已實作       | page.jsx 整合                                                                       |
| T014 | ✅ 已實作       | PostDetail.test.jsx                                                                 |
| T015 | ✅ 已實作       | CommentCard.module.css 加 border-bottom                                             |
| T016 | ✅ 已實作       | postDetail.module.css 重寫（但有死 CSS）                                            |
| T017 | ✅ 已實作       | PostDetailClient.jsx 重構                                                           |
| T018 | ✅ 已實作       | PostCardSkeleton.test.jsx                                                           |
| T019 | ✅ 已實作       | PostCardSkeleton.jsx + CSS                                                          |
| T020 | ✅ 已實作       | 列表頁骨架屏整合                                                                    |
| T021 | ✅ 已實作       | 詳文頁骨架屏整合                                                                    |
| T022 | ✅ 已實作       | E2E 測試（但覆蓋率偏低）                                                            |
| T023 | ✅ 已實作       | 響應式驗證（假設已目視確認）                                                        |
| T024 | ⚠️ **未通過**   | type-check 有 27 errors（Vitest mock 類型 + test Timestamp + IntersectionObserver） |

**T009 是最大的 gap** — task 明確要求「max-height transition animation（250ms ease、transitionend 後移除 max-height 限制）」，但實作只有 state toggle，沒有任何動畫。

---

## VERDICT

❌ **Needs rework** — 三個問題必須先修：

1. **C1**: 加入展開動畫（FR-007 是 spec 的 MUST 要求）
2. **C2**: 修復 type-check 錯誤（CLAUDE.md Rule 5 要求通過）
3. **C3**: 補齊 test mock（`notifyPostCommentReply`）
4. **C4**: 刪除死 CSS

C1 是最重要的 — 你花了 plan D3 和 research R1 設計一個精確的動畫方案，然後完全沒實作。這不是「可以晚點做」的 polish，是 spec 的核心 acceptance criteria。

---

## KEY INSIGHT

元件分解做得很好 — PostCard 的 stretched-link pattern、ComposeModal 的 `<dialog>` + cancel 攔截、PostCardSkeleton 的結構鏡像都展現了正確的工程判斷。問題不在架構設計，而在最後一哩路：設計好的動畫沒實作、type-check 沒跑乾淨、重構後的殘留物沒清理。這是「90% 完成」的常見陷阱 — 剩下的 10% 決定了作品和習作的差距。
