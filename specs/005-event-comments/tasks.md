# Tasks: 活動留言功能

**Input**: Design documents from `/specs/005-event-comments/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md
**Tests**: RED phase 已完成，不需額外撰寫測試。每個 task 的完成條件對應到應通過的測試案例。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational + Standalone Components

**Purpose**: Service layer、helpers、以及所有獨立 UI 元件 — 全部互不相依（不同檔案），可 **8 agents 完全平行**

- [ ] T001 [P] Implement `formatCommentTime` + `formatCommentTimeFull` in `src/lib/event-helpers.js`
  - 已有 stub（L226-239），需實作為回傳正確格式的函式
  - `formatCommentTime(timestamp)` → `"4/2 14:30"`（月/日 HH:MM，月日不補零，時分補零）
  - `formatCommentTimeFull(timestamp)` → `"2026年4月2日 14:30"`（含年份完整格式）
  - null/undefined 回傳空字串
  - 參考既有 `formatDateTime`（L156-170）的 JSDoc 模式
  - ✅ **通過測試（6）**:
    - `Unit: formatCommentTime > should format Firestore Timestamp to month/day hour:minute in 24hr`
    - `Unit: formatCommentTime > should pad minutes but not pad month or day`
    - `Unit: formatCommentTime > should handle midnight as 00:00`
    - `Unit: formatCommentTime > should return empty string for null or undefined`
    - `Unit: formatCommentTimeFull > should format to YYYY年M月D日 HH:MM`
    - `Unit: formatCommentTimeFull > should return empty string for null or undefined`

- [ ] T002 [P] Create `src/lib/firebase-comments.js` — typedefs + all 7 service functions
  - 新建檔案，import `firebase/firestore`（doc, collection, query, getDocs, getDoc, addDoc, orderBy, limit, startAfter, serverTimestamp, runTransaction, writeBatch）+ `@/lib/firebase-client`（db）
  - 定義 `@typedef CommentData`（id, authorUid, authorName, authorPhotoURL, content, createdAt, updatedAt, isEdited）
  - 定義 `@typedef FetchCommentsResult`（comments: CommentData[], lastDoc: QueryDocumentSnapshot | null）
  - 定義 `@typedef CommentHistoryEntry`（id, content, editedAt）
  - **fetchComments(eventId, limitCount=15)** → cursor-based, `orderBy('createdAt', 'desc')`, `limit(limitCount)`，回傳 `{comments[], lastDoc}`
  - **fetchMoreComments(eventId, afterDoc, limitCount=15)** → 同上 + `startAfter(afterDoc)`
  - **getCommentById(eventId, commentId)** → `getDoc` 單筆查詢，不存在回 null；eventId/commentId 空字串回 null
  - **addComment(eventId, user, content)** → 直接 `addDoc`（不需 transaction，不維護 count）；trim content → 空字串/超 500 字 throw；user null/缺 uid throw；payload: `{ authorUid, authorName, authorPhotoURL, content: trimmed, createdAt: serverTimestamp(), updatedAt: null, isEdited: false }`；回傳 `{ id }`
  - **updateComment(eventId, commentId, newContent, oldContent)** → `runTransaction(db, ...)`；Transaction 內: (1) `tx.get` → 不存在 throw (2) `tx.set` history `{ content: oldContent, editedAt: serverTimestamp() }` (3) `tx.update` comment `{ content: trimmed, updatedAt: serverTimestamp(), isEdited: true }`；trim newContent → 空/超 500/與 oldContent 相同 → throw
  - **deleteComment(eventId, commentId)** → `writeBatch(db)`；先 getDocs 查 history 子集合 → batch.delete 每筆 + comment 主文件 → commit；eventId/commentId 空 throw
  - **fetchCommentHistory(eventId, commentId)** → `orderBy('editedAt', 'asc')`，不分頁；回傳 `CommentHistoryEntry[]`；eventId/commentId 空 throw
  - 所有 eventId 空字串一律 throw（fetchComments/fetchMoreComments/addComment/updateComment/deleteComment）
  - 參考 `firebase-events.js` 的 JSDoc 模式（完整 @param @returns @throws）
  - 參考 `firebase-posts.js` L268-284 的 transaction pattern
  - 參考 `firebase-events.js` L569-589 的 batch delete cascade pattern
  - ✅ **通過測試（32）**:
    - `Unit: fetchComments` 全部 5 個測試
    - `Unit: fetchMoreComments` 全部 3 個測試
    - `Unit: getCommentById` 全部 3 個測試
    - `Unit: addComment` 全部 7 個測試
    - `Unit: updateComment` 全部 7 個測試
    - `Unit: deleteComment` 全部 4 個測試
    - `Unit: fetchCommentHistory` 全部 3 個測試

- [ ] T003 [P] [US1] Create `src/components/CommentCard.jsx` + `src/components/CommentCard.module.css`
  - Display-only 版本：avatar（36px 圓形，無 photoURL 則 fallback 首字紫色背景 rgba(103,58,183,0.12)）、名稱（0.9rem, fw 700）、`<time dateTime="ISO">` 時間（用 `formatCommentTime`，title 用 `formatCommentTimeFull`）、內容（0.95rem, padding-left 48px）
  - Props: `comment`（CommentData）、`isOwner`（boolean，暫不用）、`isHighlighted`（boolean）、callbacks 預留（`onEdit`, `onDelete`, `onViewHistory`）
  - 高亮動畫：`isHighlighted` 時 CSS `@keyframes commentHighlight` rgba(103,58,183,0.12) → #fff, 2s
  - RWD: mobile avatar 32px / padding-left 44px / 內容 0.9rem，tablet+ avatar 36px / padding-left 48px / 內容 0.95rem（§4.2/§4.9）
  - 不含三點選單、已編輯 badge（T009 加）
  - 參考既有 Card 元件的 JSDoc props pattern
  - ⏳ 此 task 完成後尚無測試可獨立通過（需 T010 CommentSection 一起 render）

- [ ] T004 [P] [US2] Create `src/components/CommentInput.jsx` + `src/components/CommentInput.module.css`
  - **一次到位的完整版**（非 shell）：`position: fixed; bottom: 0; left: 0; right: 0`，z-index 100
  - textbox（pill shape, border-radius 20px, bg #f8f9fa, focus border #673ab7）+ 送出按鈕（pill, bg #673ab7, disabled bg #e5e7eb）
  - Props: `onSubmit(content)`、`isSubmitting`（boolean）、`submitError`（string | null）
  - Disabled 邏輯：`content.trim() === '' || content.length > 500 || isSubmitting`
  - 字數顯示：450+ 才顯示（`${content.length}/500`），500+ 紅色 #d32f2f + 按鈕 disabled
  - Loading 狀態：`isSubmitting` 時按鈕 disabled
  - Ctrl/Cmd + Enter 送出：`onKeyDown` handler，呼叫 `onSubmit`
  - iOS safe area: `padding-bottom: max(8px, env(safe-area-inset-bottom))`
  - border-top 1px solid #e0e3e7, box-shadow 0 -2px 8px rgba(0,0,0,0.08)
  - RWD §4.3/§4.9：mobile input 36px / radius 18px / btn 48px / padding 8px 12px，tablet+ input 40px / radius 20px / btn 56px / padding 12px 16px
  - ⏳ 此 task 完成後尚無測試可獨立通過（需 T010 CommentSection 一起 render）

- [ ] T005 [P] [US3] Create `src/components/CommentCardMenu.jsx` + `src/components/CommentCardMenu.module.css`
  - 三點按鈕（28x28px）`aria-label="更多操作"` + dropdown（`role="menu"`）
  - 兩個選項：「編輯留言」+「刪除留言」（`role="menuitem"`）
  - Click-outside 關閉：參考 `EventCardMenu.jsx` L25-95 的 useEffect + mousedown pattern
  - `aria-expanded` on trigger button
  - Props: `onEdit`, `onDelete`
  - z-index: wrapper 10, dropdown 50
  - ⏳ 此 task 完成後尚無測試可獨立通過（需 T009 整合進 CommentCard）

- [ ] T006 [P] [US3] Create `src/components/CommentEditModal.jsx` + `src/components/CommentEditModal.module.css`
  - `role="dialog" aria-modal="true"` overlay（z-200, rgba(0,0,0,0.5)）
  - Textarea 預填原文，min-height 120px, resize vertical
  - 「完成編輯」按鈕：`content.trim() === originalContent` 時 disabled
  - 「取消編輯」按鈕
  - Loading 狀態（isUpdating prop → 按鈕 disabled + spinner）
  - 入場動畫 `modalFadeIn` 0.2s scale(0.95)+translateY(10px) → normal
  - RWD §4.4/§4.9：mobile buttons column-reverse（完成在上）/ padding 20px / textarea 100px，tablet+ row（取消左、完成右）/ padding 28px / textarea 120px
  - Escape 鍵關閉
  - Props: `comment`（editingComment）、`isUpdating`（boolean）、`onSave(newContent)`、`onCancel`
  - ⏳ 此 task 完成後尚無測試可獨立通過（需 T011 wire handler）

- [ ] T007 [P] [US3] Create `src/components/CommentHistoryModal.jsx` + `src/components/CommentHistoryModal.module.css`
  - `role="dialog" aria-modal="true"` overlay（z-200）
  - Header + scrollable body，32px 圓形關閉按鈕
  - 由新到舊排列：最新標 `"目前版本"`（紫色 badge #673ab7）、最舊標 `"原始版本"`（灰色 badge）
  - 時間用 `formatCommentTimeFull`
  - `<ul>` + `<li>` 語義列表（E2E test 用 `getByRole('listitem')` 查詢版本數）
  - Escape 鍵關閉
  - Props: `comment`（含 current content）、`history`（CommentHistoryEntry[]）、`onClose`
  - RWD §4.6/§4.9：mobile padding 16px / 版本 12px / 時間 0.7rem，tablet+ padding 24px / 版本 16px / 時間 0.75rem / max-width 520px
  - ⏳ 此 task 完成後尚無測試可獨立通過（需 T011 wire handler）

- [ ] T008 [P] [US4] Create `src/components/CommentDeleteConfirm.jsx` + `src/components/CommentDeleteConfirm.module.css`
  - `role="dialog" aria-modal="true"` overlay（z-200）
  - 文案 `"確定刪除留言？"`
  - 「確定刪除」按鈕（紅 #d32f2f）+ 「取消刪除」按鈕（紫 outline #673ab7）
  - Loading 狀態：`isDeleting` prop → 兩按鈕 disabled，確定按鈕文字變「刪除中…」
  - 錯誤：`deleteError` prop → `role="alert"` 顯示 `"刪除失敗，請再試一次"`
  - width 90vw, max-width 380px，按鈕 flex gap 16px
  - Escape 鍵關閉
  - 參考 `EventDeleteConfirm.jsx` L32-67 的 dialog pattern
  - Props: `onConfirm`、`onCancel`、`isDeleting`（boolean）、`deleteError`（string | null）
  - ⏳ 此 task 完成後尚無測試可獨立通過（需 T011 wire handler）

**Checkpoint**: `npx vitest run specs/005-event-comments/tests/unit/` — 全部 38 個 unit tests 應通過（T001 + T002）

---

## Phase 2: Component Integration (Wave 2)

**Purpose**: 把 Phase 1 的獨立元件組裝起來 — **2 agents 平行**（不同檔案）

- [ ] T009 [P] [US3] Integrate `CommentCardMenu` + edited badge into `src/components/CommentCard.jsx`
  - 條件 render `<CommentCardMenu>`: 僅 `isOwner === true` 時顯示（卡片右上角）
  - 新增「已編輯」badge：`isEdited === true` 時在時間旁顯示 `<button aria-label="查看編輯記錄">已編輯</button>`（0.75rem #5f6368，hover 紫色底線）
  - badge 點擊呼叫 `onViewHistory(comment)` callback
  - 更新 CommentCard props: 確認 `onEdit`, `onDelete`, `onViewHistory` callbacks 接線到 CommentCardMenu
  - **依賴**: T003（CommentCard 已建立）、T005（CommentCardMenu 已建立）
  - ⏳ 此 task 完成後尚無測試可獨立通過（需 T010/T011 CommentSection render）

- [ ] T010 [P] [US1] Create `src/components/CommentSection.jsx` + `src/components/CommentSection.module.css` — US1 瀏覽 + US2 送出
  - Container 元件：`role="region" aria-label="留言區"`
  - 用 `useContext(AuthContext)` 取得 user
  - **US1 State**: `comments[]`, `cursor`（lastDoc）, `hasMore`, `isLoading`, `isLoadingMore`
  - **US2 State**: `isSubmitting`, `submitError`, `highlightId`
  - useEffect 初始化: 呼叫 `fetchComments(eventId)` → 設定 comments + cursor + hasMore
  - Render: loading spinner（`role="status"`）→ empty state（`"還沒有人留言"`）→ `<ul>` + `<CommentCard>` × N
  - IntersectionObserver sentinel: rootMargin `0px 0px 300px 0px`，觸發 `fetchMoreComments` → append。參考 `events/page.jsx` L249-264
  - End hint: `"已顯示所有留言"`（dashed border）
  - 條件 render `<CommentInput>`: 僅 user !== null 時顯示
  - Comment list `padding-bottom: 80px`（僅登入時，為 floating input 留空間）
  - **Submit handler**: `handleSubmit(content)` → `addComment(eventId, user, content)` → `getCommentById` 取完整資料（含 serverTimestamp）→ prepend 到 comments[] → 清空 input → 設 highlightId（2s setTimeout 後清除）
  - 失敗：設 submitError → `role="alert"` 顯示 `"送出失敗，請再試一次"`，input 內容保留（不清空）
  - 將 `isSubmitting`, `submitError`, `handleSubmit` 傳給 CommentInput props
  - 將 `isHighlighted={comment.id === highlightId}` 傳給 CommentCard
  - 傳遞 `isOwner={user?.uid === comment.authorUid}` 給 CommentCard
  - 預留 callbacks（`onEdit`, `onDelete`, `onViewHistory`）先傳空函式或 noop，T011 會接上
  - **依賴**: T002（service layer）、T003（CommentCard）、T004（CommentInput）
  - ✅ **通過測試（16）**:
    - `Integration: US1 瀏覽留言` 全部 7 個測試
    - `Integration: US2 發表留言` 全部 6 個測試
    - `Integration: Accessibility > should have region role with aria-label on comment section`
    - `Integration: Accessibility > should render comment list as semantic ul/li`
    - `Integration: Accessibility > should use time element with dateTime attribute`

**Checkpoint**: `npx vitest run specs/005-event-comments/tests/integration/` — US1 + US2 + Accessibility 共 16 個 integration tests 應通過

---

## Phase 3: US3 + US4 Handler Wiring (Wave 3)

**Purpose**: 把編輯/歷史/刪除的 modal handlers 接入 CommentSection — **1 agent**（CommentSection.jsx 瓶頸）

- [ ] T011 [US3] Wire edit / history / delete handlers into `src/components/CommentSection.jsx`
  - **US3 新增 state**: `editingComment`（CommentData | null）、`isUpdating`（boolean）、`historyComment`（CommentData | null）、`historyEntries`（CommentHistoryEntry[]）
  - **US4 新增 state**: `deletingCommentId`（string | null）、`isDeleting`（boolean）、`deleteError`（string | null）
  - **Edit handlers**:
    - `handleEdit(comment)` → 設 editingComment，開啟 CommentEditModal
    - `handleSaveEdit(newContent)` → 呼叫 `updateComment(eventId, commentId, newContent, oldContent)` → 更新 comments[] 中對應項（content=newContent, isEdited=true）→ 關閉 modal（清 editingComment）
    - `handleCancelEdit()` → 清 editingComment，關閉 modal
  - **History handler**:
    - `handleViewHistory(comment)` → 設 historyComment → 呼叫 `fetchCommentHistory(eventId, commentId)` → 設 historyEntries → 開啟 CommentHistoryModal
  - **Delete handlers**:
    - `handleDelete(comment)` → 設 deletingCommentId
    - `handleConfirmDelete()` → 呼叫 `deleteComment(eventId, deletingCommentId)` → 從 comments[] 移除 → 關閉 dialog。失敗：設 deleteError
    - `handleCancelDelete()` → 清空 delete state
  - **Render**: 條件 render `<CommentEditModal>`、`<CommentHistoryModal>`、`<CommentDeleteConfirm>`
  - **傳遞 callbacks** 到 CommentCard: `onEdit={handleEdit}`, `onDelete={handleDelete}`, `onViewHistory={handleViewHistory}`（替換 Phase 2 的 noop）
  - **依賴**: T006（EditModal）、T007（HistoryModal）、T008（DeleteConfirm）、T009（CommentCard 已有 menu + badge）、T010（CommentSection 已有 US1+US2）
  - ✅ **通過測試（15）**:
    - `Integration: US3 > should show three-dot menu only on author own comments`
    - `Integration: US3 > should show edit and delete options in three-dot menu`
    - `Integration: US3 > should show edited badge on edited comments`
    - `Integration: US3 > should open edit modal with prefilled content`
    - `Integration: US3 > should disable finish button when content is same as original`
    - `Integration: US3 > should enable finish button when content differs`
    - `Integration: US3 > should call updateComment and close modal on finish`
    - `Integration: US3 > should close edit modal without changes on cancel`
    - `Integration: US3 > should open history modal with all versions on edited badge click`
    - `Integration: US4 > should open delete confirm dialog`
    - `Integration: US4 > should delete comment and remove from list on confirm`
    - `Integration: US4 > should show loading state while deleting`
    - `Integration: US4 > should show error on delete failure`
    - `Integration: US4 > should close dialog without deleting on cancel`
    - `Integration: Accessibility > should have aria-modal on modal dialogs`

**Checkpoint**: `npx vitest run specs/005-event-comments/tests/integration/` — 全部 31 個 integration tests 應通過

---

## Phase 4: Polish & Cross-Cutting Concerns (Wave 4)

**Purpose**: 頁面整合、級聯刪除 — **2 agents 平行**（不同檔案）

- [ ] T012 [P] Integrate `<CommentSection>` into `src/app/events/[id]/eventDetailClient.jsx`
  - Import CommentSection（不需 dynamic import，非地圖元件）
  - 在路線 card（EventMap，約 L712）之後 render `<CommentSection eventId={id} />`
  - CommentSection 內部自行 `useContext(AuthContext)` 取 user，不需額外傳 props
  - ✅ **通過測試（E2E 全部 11 個）**:
    - `US1 > should display existing comments on event detail page`
    - `US1 > should hide comment input for unauthenticated user`
    - `US2 > should post a new comment and see it at top of list`
    - `US2 > should disable submit button when input is empty`
    - `US3 > author should see three-dot menu on own comment`
    - `US3 > non-author should NOT see three-dot menu`
    - `US3 > full edit flow: open modal → modify → save → see edited badge`
    - `US3 > cancel edit should not change comment`
    - `US3 > clicking edited badge should show edit history modal`
    - `US4 > delete flow: confirm → comment removed`
    - `US4 > cancel delete should keep comment intact`

- [ ] T013 [P] Add cascade delete for comments in `src/lib/firebase-events.js` `deleteEvent`
  - 在 deleteEvent 的 writeBatch 中加入：查詢 `events/{eventId}/comments` → 對每則留言查詢 `history` 子集合 → batch.delete 全部
  - 注意 batch 500 ops 上限（參考 data-model.md §Cascade Delete）
  - 參考既有 deleteEvent L569-589 的 batch pattern

- [ ] T014 Run `npm run type-check` and `npm run lint` — fix all errors
  - 新增的 cSpell 詞彙加入 `cspell.json`（如有需要）
  - 確認無 `@ts-ignore`、無 `eslint-disable` for a11y

---

## Dependencies & Execution Order

### Wave Execution Plan

```
Wave 1 ─── 8 parallel agents ──────────────────────────────────
  T001 [P] event-helpers.js
  T002 [P] firebase-comments.js (all 7 functions)
  T003 [P] CommentCard.jsx + CSS
  T004 [P] CommentInput.jsx + CSS (full version)
  T005 [P] CommentCardMenu.jsx + CSS
  T006 [P] CommentEditModal.jsx + CSS
  T007 [P] CommentHistoryModal.jsx + CSS
  T008 [P] CommentDeleteConfirm.jsx + CSS

Wave 2 ─── 2 parallel agents ──────────────────────────────────
  T009 [P] CommentCard ← integrate menu + badge  (needs T003, T005)
  T010 [P] CommentSection ← US1 + US2            (needs T002, T003, T004)

Wave 3 ─── 1 agent (CommentSection bottleneck) ────────────────
  T011    CommentSection ← US3 + US4 handlers    (needs T006–T010)

Wave 4 ─── 2 parallel agents ──────────────────────────────────
  T012 [P] eventDetailClient.jsx integration
  T013 [P] firebase-events.js cascade delete

Wave 5 ─── 1 agent ────────────────────────────────────────────
  T014    type-check + lint
```

### Task Dependency Graph

```
T001 ─────────────────────────────────────────────────── (standalone)
T002 ──────────────────────────────────┐
T003 ──────────────┬───────────────────┤
T004 ──────────────│───────────────────┼─→ T010 ──┐
T005 ──────┬───────┘                   │          │
           └─→ T009 ──────────────────────────────┼─→ T011 ──→ T012
T006 ─────────────────────────────────────────────┤          ─→ T013
T007 ─────────────────────────────────────────────┤
T008 ─────────────────────────────────────────────┘          ─→ T014
```

### Key Insight: 為何 UI 元件可與 Service Layer 平行

CommentCard、CommentInput、CommentCardMenu、CommentEditModal、CommentHistoryModal、CommentDeleteConfirm **都不 import `firebase-comments.js`**。它們透過 props 接收資料和 callbacks。只有 CommentSection（T010/T011）import service layer functions。因此 T003-T008 可與 T002 完全平行。

### Incremental Test Progression

| Wave | 完成 Tasks | 新增通過測試                  | 累計通過 |
| ---- | ---------- | ----------------------------- | -------- |
| 1    | T001-T008  | 38 unit                       | 38       |
| 2    | T009-T010  | 16 integration (US1+US2+a11y) | 54       |
| 3    | T011       | 15 integration (US3+US4+a11y) | 69       |
| 4    | T012-T013  | 11 E2E                        | 80       |
| 5    | T014       | (verification)                | 80       |

### Verification Commands

```bash
# Wave 1 checkpoint (unit tests)
npx vitest run specs/005-event-comments/tests/unit/

# Wave 2 checkpoint (US1 + US2 integration)
npx vitest run specs/005-event-comments/tests/integration/

# Wave 3 checkpoint (all integration)
npx vitest run specs/005-event-comments/tests/integration/

# Wave 4 checkpoint (E2E)
npx playwright test specs/005-event-comments/tests/e2e/

# Final verification
npm run type-check
npm run lint
```

---

## Notes

- [P] tasks = different files, no actual data/import dependencies
- [Story] label maps task to specific user story for traceability
- 每個 task 的「✅ 通過測試」列出該 task 完成後應新增通過的測試案例
- 標「⏳」的 task 表示該 component 需搭配後續整合 task 才有測試可驗證
- **CommentSection.jsx 是唯一瓶頸**（T010 → T011 必須序列），其餘皆可平行
- Commit after each wave
