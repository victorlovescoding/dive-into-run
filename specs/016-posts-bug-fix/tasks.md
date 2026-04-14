# Tasks: Posts 頁面 Bug 修復 (A1 + A3 + A4)

**Input**: Design documents from `/specs/016-posts-bug-fix/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 不包含自動化測試任務（SC-005 明確豁免，驗證以 type-check、lint、手動測試為準）

**Organization**: 每個 User Story 獨立成一個 Phase，可個別實作與驗證。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Source code**: `src/` at repository root
- **Specs**: `specs/016-posts-bug-fix/`

---

## Phase 1: User Story 1 - 編輯已被刪除的文章不應 crash (Priority: P1) :dart: MVP

**Goal**: `posts.find()` 回傳 `undefined` 時安全中止編輯操作，顯示 toast 提示使用者

**Independent Test**: 在文章列表中模擬文章不存在情境下點擊編輯，頁面不 crash 且顯示「文章不存在，無法編輯」toast

- [x] T001 [US1] 在 `composeButtonHandler` 中取消註解 null guard 並加入 `showToast('文章不存在，無法編輯', 'error')` in `src/app/posts/page.jsx`

**Checkpoint**: 文章不存在時點擊編輯 → 頁面不 crash + toast 提示。既有編輯流程不受影響。

---

## Phase 2: User Story 2 - 按讚失敗時正確還原狀態 (Priority: P1)

**Goal**: 按讚失敗的 revert 改為 capture-and-restore 模式，杜絕 re-toggle 在 batching/快速連點下的 count 錯位

**Independent Test**: 模擬按讚 API 失敗，UI 的 liked 和 likesCount 100% 還原至操作前的值

- [x] T002 [US2] 重構 `pressLikeButton` 為 capture-and-restore 模式（optimistic update 前 capture `prevLiked`/`prevCount`，失敗時直接 restore）in `src/app/posts/page.jsx`

**Checkpoint**: 按讚失敗 → liked/likesCount 精確還原。正常按讚流程不受影響。

---

## Phase 3: User Story 3 - 移除留言區冗餘 isCommentEditing state (Priority: P2)

**Goal**: 刪除未被消費的 `isCommentEditing` state 及所有 setter 呼叫，消除 dead code 和多餘 re-render

**Independent Test**: 移除後留言的建立、編輯、取消流程皆正常運作

- [x] T003 [P] [US3] 刪除 `isCommentEditing` state 宣告（L38）及 3 處 `setIsCommentEditing` 呼叫（L257, L274, L359）in `src/app/posts/[id]/PostDetailClient.jsx`

**Checkpoint**: 留言建立/編輯/取消全部正常。`commentEditing !== null` 邏輯不受影響。

---

## Phase 4: Polish & Verification

**Purpose**: 跨 User Story 驗證，確認零退化

- [x] T004 執行 `npm run type-check` 確認零新增錯誤
- [x] T005 執行 `npm run lint` 確認零新增錯誤
- [x] T006 執行 IDE `getDiagnostics` 並修復所有 Warning/Error（cSpell Information 可忽略但未知單字需加入 `cspell.json`）
- [ ] T007 依 quickstart.md 手動驗證：建立文章 → 編輯 → 按讚 → 留言建立/編輯/取消

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 無前置依賴 — 可立即開始
- **Phase 2 (US2)**: 與 Phase 1 同檔案（`page.jsx`）不同函式 — 建議循序執行避免 merge conflict
- **Phase 3 (US3)**: 不同檔案（`PostDetailClient.jsx`）— 可與 Phase 1 或 Phase 2 平行
- **Phase 4 (Polish)**: 依賴所有 User Story 完成

### User Story Dependencies

- **US1 (P1)**: 獨立，不依賴其他 story
- **US2 (P1)**: 獨立，不依賴其他 story（同檔案但不同函式）
- **US3 (P2)**: 完全獨立（不同檔案）

### Parallel Opportunities

- T003 (US3) 可與 T001 (US1) 或 T002 (US2) 平行執行（不同檔案）
- T004 和 T005 可平行執行

---

## Parallel Example

```bash
# Strategy A: 最快完成（平行 US3 + 循序 US1/US2）
Worker 1: T001 (US1) → T002 (US2)
Worker 2: T003 (US3)
Then:     T004 + T005 (parallel) → T006 → T007

# Strategy B: 循序執行（單人）
T001 → T002 → T003 → T004/T005 → T006 → T007
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 (US1: null guard + toast)
2. **STOP and VALIDATE**: type-check + lint + 手動測試編輯流程
3. 此時已修復最嚴重的 crash bug

### Incremental Delivery

1. T001 (US1) → 驗證 → 頁面不再 crash（MVP）
2. T002 (US2) → 驗證 → 按讚 revert 正確
3. T003 (US3) → 驗證 → dead code 清除
4. T004-T007 → 全面驗證 → 完成

---

## Notes

- 此 branch 不含自動化測試（SC-005）
- 總改動量約 20 LOC，涉及 2 個檔案
- 不修改 service layer（`src/lib/`）
- 不修改 Firestore schema
- 不處理 A2（deletePost subcollection）、A5（validation）、A6（migration）
