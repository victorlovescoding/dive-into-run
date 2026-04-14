# Tasks: deletePost Subcollection Cleanup

**Input**: Design documents from `/specs/017-delete-post-cleanup/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md

**Tests**: TDD required (Constitution Check I: SDD/TDD PASS — 實作前需先寫失敗測試)

**Organization**: 單一 User Story，按 TDD RED-GREEN-REFACTOR 流程排列。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Firestore Rules)

**Purpose**: 為 `likes` 和 `comments` subcollection 加上文章作者 cascade delete 權限，使 client-side `writeBatch` 刪除其他使用者的 likes/comments 不被 security rules 擋掉。

- [x] T001 [P] 修改 `firestore.rules` — `likes/{uid}` 的 `allow delete` 加上 `|| request.auth.uid == get(.../posts/$(postId)).data.authorUid` 條件；`comments/{commentId}` 的 `allow delete` 拆分 update/delete 並加上同樣的文章作者條件。參考 data-model.md Firestore Rules Changes 區段的 diff。collectionGroup `likes` rule 不變。

**Checkpoint**: Firestore rules 已允許文章作者 cascade delete subcollection docs。

---

## Phase 2: User Story 1 — 刪除文章時一併清除子資料 (Priority: P1) MVP

**Goal**: `deletePost` 從只刪 parent document 升級為 writeBatch cascade delete——一併清除 `likes` 和 `comments` subcollection，對齊 `deleteEvent` 行為模式。

**Independent Test**: 建立一篇文章、為它按讚和留言，然後刪除該文章。驗證文章本體、按讚紀錄和留言全部被移除。

### TDD RED Phase

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T002 [P] [US1] Write unit tests for `deletePost` cascade delete in `specs/017-delete-post-cleanup/tests/unit/deletePost.test.js` — mock Firebase（`vi.mock`），覆蓋以下場景：(1) 文章有 likes + comments → 全部透過 writeBatch 刪除、回傳 `{ ok: true }` (2) 文章無 likes/comments → 僅刪 post doc、回傳 `{ ok: true }` (3) postId 為空 → throw `Error('deletePost: postId is required')` (4) 文章不存在 → throw `Error('文章不存在')` (5) `batch.commit()` reject → error 正常往上拋（對應 spec edge case「刪除過程中失敗時，現有錯誤提示機制應正常運作」）。參考 `deleteEvent` 的測試模式。確認所有測試 FAIL。

### TDD GREEN Phase

- [x] T003 [US1] Rewrite `deletePost` in `src/lib/firebase-posts.js` — (1) 新增 `writeBatch` import (2) 加入 postId 空值檢查 (3) `getDoc` 存在性檢查 (4) `getDocs` fetch likes + comments subcollection (5) `writeBatch` 一次性刪除所有 subcollection docs + post doc (6) 回傳 `{ ok: true }`。加 NOTE 註記 writeBatch 500 筆上限。對齊 `deleteEvent`（`firebase-events.js:572-617`）模式。確認所有 T002 測試 PASS。

**Checkpoint**: deletePost cascade delete 完成，所有單元測試通過。

---

## Phase 3: Polish & Validation

**Purpose**: 確保程式碼品質通過所有檢查。

- [x] T004 Run `npm run lint:changed` + `npm run type-check:changed`，修復所有問題；Run `getDiagnostics` via MCP 修復 Warning/Hint/Error；確認 cSpell 未知詞已加入 `cspell.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: T002 (tests) 不依賴 Phase 1（mock Firebase）；T003 (implementation) 邏輯上依賴 T001 完成（rules 權限到位才能 runtime 正常運作）
- **Polish (Phase 3)**: Depends on Phase 2 completion

### Within User Story 1

```
T002 (RED: tests FAIL) → T003 (GREEN: tests PASS)
```

### Task Dependencies Graph

```
T001 (firestore.rules) ─────────────────────┐
                                             │
T002 (unit tests - RED) → T003 (deletePost - GREEN) → T004 (polish)
```

T001 和 T002 可平行執行（不同檔案、無依賴），T003 須等 T001 + T002 完成。

### Parallel Opportunities

```bash
# 可同時執行：
Task T001: firestore.rules cascade delete permissions
Task T002: deletePost unit tests (RED phase, mock Firebase)

# 序列執行：
Task T003: deletePost implementation (depends on T001 + T002)
Task T004: polish & validation (depends on T003)
```

---

## Implementation Strategy

### MVP (User Story 1 Only — 本 feature 唯一 story)

1. Complete Phase 1: Firestore Rules (T001)
2. Complete Phase 2: TDD RED (T002) → GREEN (T003)
3. Complete Phase 3: Polish (T004)
4. **VALIDATE**: 所有測試通過、lint/type-check 乾淨、getDiagnostics 無問題

---

## Notes

- 對齊 `deleteEvent`（`src/lib/firebase-events.js:572-617`）的 writeBatch 模式
- Posts 的 subcollection 比 Events 簡單——沒有巢狀 `history` subcollection
- `deleteDoc` 在新實作中不再被 `deletePost` 使用，但其他函式仍使用，保留 import
- UI 不需修改——兩個呼叫端（`page.jsx:269-281`、`PostDetailClient.jsx:234-244`）都有 try-catch + toast
