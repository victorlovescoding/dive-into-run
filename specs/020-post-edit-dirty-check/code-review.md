# Code Review — 020-post-edit-dirty-check

日期：2026-04-16

**Base**: `main` (764fe4bc)
**Head**: `24ab68a4`
**Reviewer Persona**: Linus-style

---

## Taste Rating

🟡 **Acceptable** — 工程品質紮實、測試覆蓋率真實（不是 mock 自演）、spec 執行完整度高。但有一個**重複的 editor state cluster**在兩個 page component 各複製一份，這是 future tech debt 的種子。不嚴重到要打回票，但下次碰 edit flow 時就別再假裝沒看到。

---

## Linus's Three Questions

1. **Is this solving a real problem?** ✅ 是。現狀 UI 允許使用者對沒改過的文章按「更新」，造成無意義的 Firestore write。且和同站「活動編輯」頁行為不一致。這是真問題。
2. **Is there a simpler way?** 🟡 演算法本身（`title.trim() !== original.trim()`）已經夠簡單。但**狀態分佈**可以更好 — 見下面 [IMPROVEMENT OPPORTUNITIES] #1。
3. **What will this break?** 無。`updatePost` 簽名不變、新增文章流程（`isEditing=false`）有 sanity test 保護、現有 26 個測試全綠。

---

## [CRITICAL ISSUES]

None. 這個 branch 沒有違反 fundamental principle 的東西。

---

## [IMPROVEMENT OPPORTUNITIES]

### 1. **Data Structure / 重複的 editor state cluster**

**位置**: `src/app/posts/page.jsx:29-34` 與 `src/app/posts/[id]/PostDetailClient.jsx:66-72`

兩個 page 現在各自管理**同一組** 6 個 state：

```js
const [title, setTitle] = useState('');
const [content, setContent] = useState('');
const [originalTitle, setOriginalTitle] = useState('');
const [originalContent, setOriginalContent] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);
const [editingPostId, setEditingPostId] = useState(null);
```

加上 open editor 的設值、handleSubmitPost 的 try/finally、關閉時的 reset — 每個 page 都複製一份**同樣邏輯**約 20 行。

**這是教科書等級的 "extract to custom hook" 情境**：

```js
// src/components/usePostEditor.js  (建議)
export function usePostEditor({ onUpdate, onCreate }) {
  const [state, setState] = useState({
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    editingPostId: null,
    isSubmitting: false,
  });
  const openEdit = useCallback((post) => {
    /* 一次 setState */
  }, []);
  const openCreate = useCallback(() => {
    /* 一次 setState */
  }, []);
  const submit = useCallback(async (e) => {
    /* try/finally */
  }, []);
  const close = useCallback(() => {
    /* reset */
  }, []);
  return { ...state, openEdit, openCreate, submit, close };
}
```

**為什麼現在不做**：

- 不是本 spec 的 scope（020 只負責 dirty gate）
- 重複本來就存在（title/content/editingPostId 三者之前就兩份）
- 020 只是讓它**更嚴重**（從 3 變 6）

**建議行動**：開 follow-up task `021-extract-post-editor-hook`，或在 backlog 登一筆。**不要**在 020 branch 裡追加，會搞亂 scope。

---

### 2. **Scope creep — PostCard / CommentCard typedef 改動**

**位置**:

- `src/components/PostCard.jsx` line 217-219
- `src/components/CommentCard.jsx` line 14-15

Diff 加了一段 JSDoc workaround：

```js
* @property {import('react').Key} [key] - React reconciler 專用 key；非元件內部使用的 prop，
*   但為了讓 JSDoc-based `checkJs` 不誤報 "Property 'key' does not exist on type 'PostCardProps'"，
*   需明確列出。後續若改用 `React.ComponentProps` / `React.PropsWithChildren` 可移除。
```

兩個問題：

**(a) 範圍問題**：這是 **pre-existing tsc 誤報**的 workaround，跟文章 dirty check 完全無關。tasks.md T013 說「修復所有 JSDoc 型別錯誤」，被這樣一包就全塞進 020 branch。Linus 會翻白眼：「這是 chore/fix-typedef-key 的工作，不是 feat/post-dirty-check 的。」

**(b) Workaround 品質問題**：你在 production JSDoc 裡寫 "後續若改用 X 可移除" — 意思是**你自己都知道這是 hack**。3 行說明比 1 行 fix 還長，這通常代表方向錯了。真正乾淨的做法：在 React typedef 裡本來就不該把 `key` 當成 consumer prop，因為 React 在傳入 child 之前就把 `key` 抽走了。你元件內永遠不會讀到 `.key`。正解要嘛用 `React.ComponentProps`，要嘛**不要 typedef `key`**（讓 tsc 的 React types 自己處理）。

**建議**：接受現狀（畢竟跑得過 type-check 就算數），但下次遇到這類 pre-existing 誤報，開獨立 chore branch。

---

### 3. **ComposeModal 小重複**

**位置**: `src/components/ComposeModal.jsx:106-110`

```js
const isDirty = isEditing
  ? title.trim() !== (originalTitle ?? '').trim() ||
    content.trim() !== (originalContent ?? '').trim()
  : true;
```

`(originalTitle ?? '').trim()` 寫了兩次風格的 fallback，其實就 2 個，可以先各自求值：

```js
const origT = (originalTitle ?? '').trim();
const origC = (originalContent ?? '').trim();
const isDirty = isEditing ? title.trim() !== origT || content.trim() !== origC : true;
```

微小的可讀性改善，**不是問題**。列出僅供參考。

---

## [STYLE NOTES]

### CSS patch 對齊活動頁（好）

`src/components/ComposeModal.module.css:90-101`（新增）的 disabled 樣式色票與 `src/components/EventActionButtons.module.css:40-55` 完全一致（`#e5e7eb` / `#9ca3af` / `cursor: not-allowed`）。整站視覺一致性維持住了，好品味 ✅。

### `getSubmitText` helper 拆得對

**位置**: `src/components/ComposeModal.jsx:24-27`

避開了 nested ternary（Constitution IX），JSDoc 也說明了理由。這是**教科書範例的 good taste**：不要為了短而把邏輯塞在 JSX，也不要為了技巧性用 IIFE 或 `?:`套娃。

### `updatePost` 的 trim 對齊 `validatePostInput`

**位置**: `src/lib/firebase-posts.js:110-111`

之前 `validatePostInput` 會 trim 後驗證（line 36-37），但 `updatePost` 寫入時不 trim — 這是個**真的 bug**。現在修好了。這不是「imagined problem」，是個已經存在的資料一致性漏洞。

---

## [TESTING GAPS]

### ✅ 測試品質高，非 mock-assertion-theater

`compose-modal-dirty.test.jsx` 渲染真實 `ComposeModal`、用 `rerender` 模擬 parent state 變化、assertion 針對 `toBeDisabled()` 和 `toHaveTextContent()` — 這是真正能 catch regression 的測試，不是「斷言 mock 被呼叫」那種膚淺測試。👍

`compose-modal-dirty.test.jsx:235-263` 的 "cross-lifecycle re-render" 特別值得稱讚 — 它精準捕捉了「parent 切換 editingPost 但 title/content 還沒同步 reset 的瞬間」這個真實的 state transition bug。這個測試寫進去的人懂這份 codebase。

### ⚠️ 小 gap — 重複提交沒有直接測試

**位置**: 無對應測試

`isSubmitting` 的設計目的之一是防止使用者在網路慢時連點兩下。現有測試只驗證「`isSubmitting=true` 時 button disabled」，但沒有直接驗證「慢網路下連按兩次，`updatePost` 只被呼叫一次」。

**是否該補**：邊界情境，優先級不高。若要補就加在 `posts-page-edit-dirty.test.jsx` 或用 E2E 測（實際 race condition 用 jsdom 模擬不太真實）。**不是 blocker**。

### ⚠️ CSS 視覺狀態無自動化測試

24ab68a commit 新增的 `:disabled` CSS 樣式在目前測試框架下無法驗證（jsdom 不跑真實 layout / computed style）。這是 repo-level 的限制（沒有 visual regression 工具），不是這個 branch 的問題。依賴 T018 的人工驗證。

---

## [TASK GAPS]

對照 `specs/020-post-edit-dirty-check/tasks.md`：

| Task                             | 狀態          | Diff 中對應                                                |
| -------------------------------- | ------------- | ---------------------------------------------------------- |
| T001 建立 test 目錄              | `[x]`         | ✅ `tests/unit/`、`tests/integration/` 存在                |
| T002 unit trim test              | `[x]`         | ✅ `update-post-trim.test.js`                              |
| T003 compose-modal-dirty test    | `[x]`         | ✅ 12 tests，涵蓋 Invariant I1                             |
| T004 posts-page-edit-dirty test  | `[x]`         | ✅ 6 tests                                                 |
| T005 post-detail-edit-dirty test | `[x]`         | ✅ 5 tests                                                 |
| T006 E2E                         | `[~]` SKIPPED | ✅ 理由文件化在 tasks.md                                   |
| T007 updatePost trim             | `[x]`         | ✅ `firebase-posts.js:110-111`                             |
| T008 ComposeModal dirty gate     | `[x]`         | ✅ `ComposeModal.jsx:106-111`                              |
| T009 posts/page.jsx wire         | `[x]`         | ✅ `page.jsx:29-34`, `276,282`, `298-307`                  |
| T010 PostDetailClient wire       | `[x]`         | ✅ `PostDetailClient.jsx:66-72, 262-263, 287, 292-298`     |
| T011 US2 sanity (compose)        | `[x]`         | ✅ `compose-modal-dirty.test.jsx:269-305`                  |
| T012 US2 sanity (page)           | `[x]`         | 需確認 `posts-page-edit-dirty.test.jsx` 有「發表文章」case |
| T013-T017 Polish                 | `[x]`         | ✅ type-check / lint 皆綠                                  |
| T018 quickstart 人工驗證         | `[ ]`         | ⏳ **待人工執行**（tasks.md 已註明）                       |

**(N/A) Scope Creep**: `src/components/PostCard.jsx`、`src/components/CommentCard.jsx` 的 typedef 改動沒有對應任何具體 task，被籠統包在 T013「修復所有 JSDoc 型別錯誤」底下。不算違規，但下次這類 repo-wide fix 該獨立成 chore。

**(N/A) Scope Creep**: 剛加的 commit 24ab68a（disabled CSS 樣式）**不在原 tasks.md 列表**。這是使用者要求的補充，屬於 UX polish，合理延伸，但嚴格來說 tasks.md 並未追加 task 記錄此工作。

---

## VERDICT

✅ **Worth merging**

- 核心邏輯乾淨、測試品質真實、spec 執行完整
- 沒有 breaking change、沒有安全風險、沒有資料結構災難
- 僅剩的 **blocker**：T018 人工 quickstart 驗證（tasks.md 已標明 `[ ]`）

**合併前**：完成 T018 人工驗證（逐一跑 `specs/020-post-edit-dirty-check/quickstart.md` 的 Scenario A–I）

**合併後 / Follow-up**：

1. 開 issue/task：抽 `usePostEditor` 自訂 hook 消除 `posts/page.jsx` 與 `PostDetailClient.jsx` 的狀態雲複製（見 [IMPROVEMENT OPPORTUNITIES] #1）
2. 開 chore branch：修 React typedef 的 `key` 誤報 — 把 `PostCard.jsx` / `CommentCard.jsx` 那段 workaround JSDoc 換成正解（見 [IMPROVEMENT OPPORTUNITIES] #2）

---

## KEY INSIGHT

**這個 feature 的演算法核心（trim-compare dirty check）只有 4 行，但正確配置它需要 6 個 state × 2 個 page 共 12 處 useState — 這個比例就是「editor state 該被抽 hook」的市場訊號。** 020 把既有的重複從「討厭」推到「明顯」，下個碰 post editor 的 feature 應該先處理這個技術債再動新功能。
