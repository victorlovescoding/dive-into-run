# Research: Post Edit Dirty Check

**Feature**: 020-post-edit-dirty-check | **Date**: 2026-04-16

> spec 已於 Session 2026-04-16 解決所有 `NEEDS CLARIFICATION`（按鈕停用文字、trim 全空白情境）。此文件記錄**設計決策**而非未知問題研究。

---

## Decision 1 — Dirty State Ownership（原始值快照放哪）

**決定**：由 parent（`posts/page.jsx` 與 `PostDetailClient.jsx`）持有 `originalTitle` / `originalContent`，以 props 傳入 `ComposeModal`。

**理由**：

- `ComposeModal` 是 controlled component（title/content 已由 parent 傳入），把原始值也交給 parent 保持資料流一致。
- parent 本來就會在「點擊編輯 `X` 文章」時 `setEditingPostId(post.id)` + `setTitle(post.title)`；多兩行 `setOriginalTitle(post.title)` 零成本。
- 每次開新 modal 時 parent 自動覆寫 state → 自動滿足 spec Edge Case「多次開關編輯對話框，基準點以當下資料庫為準」。
- 新增模式（`isEditing=false`）時 parent 不傳 `originalTitle`/`originalContent`，ComposeModal 判斷 `isEditing ? computeDirty() : true`，自然 bypass。

**替代方案**：

- ❌ `ComposeModal` 內部 `useMemo` 記原始值（學 `EventEditForm`）：但 EventEditForm 是 **mount-on-open**（`editingEvent` 切換時整個 component 重 mount），而 `ComposeModal` 是常駐 `<dialog>` + `dialog.showModal()`。若 ComposeModal 內用 `useMemo` 依賴 `title`/`content` props，初次傳入的 "原始值" 會被後續 keystroke 覆蓋；若依賴 `editingPostId` 則需要把 `editingPostId` 也 pass 進來但 ComposeModal 現在並不認識這個值。越界 refactor 得不償失。
- ❌ 用 `React.useRef` 在 ComposeModal 內記第一次 render 的 title/content：Ref 不會在切換編輯目標時重設（除非加 `key` prop 強制 remount），徒增複雜度。

---

## Decision 2 — Trim 的落點（UI vs Service）

**決定**：

- **Service layer (`updatePost`)**：負責「**實際寫入**前 trim」。
- **UI layer (`ComposeModal`)**：負責「**dirty 比較**前 trim」（`title.trim() !== originalTitle.trim()`）。
- 兩處各自 trim；語意上「單一事實」由 spec FR-010 保證（trim 後的值同時為 dirty 判定基準與資料庫實際值）。

**理由**：

- Service trim = 所有 caller（未來若有）都受保護，不會漏 trim 造成髒資料。
- UI trim 無法避免：每個 keystroke 都要即時判斷按鈕狀態，不可能 call 到 service layer；加上 originalTitle 來自 Firestore 的舊資料可能本就帶空白。
- `createPost` 維持**不 trim**（scope 外；spec FR-005 只規範 dirty gate 不影響新增，未規範 trim）。若後續要統一，開另一個 feature。

**替代方案**：

- ❌ UI 先 trim 再傳入 service：違反 CLAUDE.md「Firebase 邏輯必須封裝在 src/lib/」的架構原則（資料正規化應在服務層）。
- ❌ 只 service trim，UI 直接字串比較：會出現「按鈕顯示可送出，但實際送出後資料庫內容與 original 相同 → 無意義寫入」→ 違反 spec FR-010「按鈕狀態與真正寫入資料庫的值永遠一致」。

---

## Decision 3 — isSubmitting 狀態來源

**決定**：parent 持有 `isSubmitting` state（`useState(false)`），在 `handleSubmitPost` 內 `try { setIsSubmitting(true); await updatePost(...); } finally { setIsSubmitting(false); }`，透過 prop 傳入 ComposeModal。

**理由**：

- 與 `EventEditForm` 慣例一致（由 parent 傳 `isSubmitting` 進來）。
- 送出的 try/catch 本來就在 parent 的 `handleSubmitPost`，同層 set state 最直接。
- ComposeModal 本身不持有非同步邏輯，保持 stateless 單純。

**對齊**：`EventEditForm.jsx:527` 的 `{isSubmitting ? '編輯中…' : '編輯完成'}` 模式 → ComposeModal 對應為 `{isEditing && isSubmitting ? '更新中…' : submitText}`（新增模式不顯示「更新中…」因為 spec 未規範新增的送出文字，維持現行「發布」即可，但若 isSubmitting 也要 gate 新增按鈕避免重複送出，可擴充至 `(isEditing && isSubmitting) || (!isEditing && isSubmitting)` — 見 Decision 4）。

---

## Decision 4 — 新增模式下 isSubmitting 的處理

**決定**：新增模式也 `disabled={isSubmitting}`（僅在送出進行中停用，避免重複送出），但**按鈕文字不變**（維持「發布」）。

**理由**：

- 防重複送出是常識性行為，不屬於「本 feature scope 擴張」，且幾乎零成本。
- 但**文字切換**（「發布中…」）未被 spec 規範，不自行新增；保持最小變更原則。
- 換句話說，ComposeModal 的 `disabled` 計算如下：

```js
// isEditing=true:  disabled = !isDirty || isSubmitting
// isEditing=false: disabled = isSubmitting（沿用現況：新增不 gate on dirty）
const submitDisabled = (isEditing && !isDirty) || isSubmitting;
```

**替代方案**：

- ❌ 新增模式完全忽略 isSubmitting：若使用者在慢網速下連點送出按鈕會觸發多次 `createPost`，產生重複文章。不可接受。
- ❌ 新增模式也加文字切換：scope 擴張，等有人 report 再改。

---

## Decision 5 — 測試分層策略

**決定**：

- **Integration（3 個檔，主力）**：ComposeModal 單獨測（shallow mount + 各 prop 組合）、posts/page.jsx 完整互動、PostDetailClient.jsx 完整互動。涵蓋 spec 的所有 Acceptance Scenarios 與 Edge Cases。
- **Unit（1 個檔）**：`updatePost` service trim 行為（mock Firestore `updateDoc`，驗證呼叫 payload 為 trim 後的值）。
- **E2E（1 個檔）**：Happy path — 打開編輯 → 不改 → 驗證按鈕 disabled；打字後 disabled 解除；改回原樣後又 disabled。

**理由**：

- 符合 Kent C. Dodds testing trophy 60/20/20。
- dirty gate 的核心是 UI 互動，Integration 層最划算（user-event 能模擬 keystroke 變化）。
- Unit 限定在純邏輯（trim），避免 integration test 重複驗證。
- E2E 只跑 happy path 防呆，不覆蓋 edge case（避免 E2E 變慢）。

**替代方案**：

- ❌ 純 unit 測：dirty 判定是 component-bound derived value，拆出 helper 再測會破壞封裝。
- ❌ 全 E2E 覆蓋：違反 testing trophy，E2E 跑慢成本高。

---

## Decision 6 — 不新增 Custom Hook

**決定**：不為 dirty check 抽 `usePostDirtyCheck` hook。

**理由**：

- 此邏輯**只在 ComposeModal 內**使用；無跨元件重用需求。
- 抽 hook 會增加一個檔案 + JSDoc + test，違反 Principle V「MVP 思維」。
- 若未來第三個入口出現（或有 Comment 編輯需要同樣邏輯），再抽不遲。

**替代方案**：

- ❌ 抽 `useDirtyCheck(current, original)` 通用 hook：YAGNI。

---

## 參考檔案（實作時對照）

- `src/components/EventEditForm.jsx:95-142`（useMemo 固化原始值 + 逐欄位 dirty compare pattern）
- `src/components/EventEditForm.jsx:526-527`（`disabled={!isDirty || !!isSubmitting}` + 「編輯中…」文字切換）
- `src/components/ComposeModal.jsx:28-122`（現行 props 簽名與 JSX 結構）
- `src/lib/firebase-posts.js:103-111`（現行 `updatePost`，trim 尚未介入）
- `src/lib/firebase-posts.js:35-46`（`validatePostInput`，確認 trim 驗證行為不需改）
