---
description: 'Task list for 020-post-edit-dirty-check'
---

# Tasks: Post Edit Dirty Check

**Input**: Design documents from `/specs/020-post-edit-dirty-check/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 本專案採嚴格 TDD（CLAUDE.md 規定），所有 test tasks MUST 在對應 implementation 之前完成並確認 FAIL（RED）。

**Organization**: Tasks 按 user story 分組；US1 為 MVP，US2 為 sanity check。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行（不同檔案、無相依關係）
- **[Story]**: 對應 spec.md 的 user story 編號（US1 / US2）
- 檔案路徑以 repo root 為基準

## Path Conventions

- Production code: `src/` at repository root
- Tests: `specs/020-post-edit-dirty-check/tests/{unit,integration,e2e}/`
- Test results: `specs/020-post-edit-dirty-check/test-results/{unit,integration,e2e}/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立測試目錄結構

- [x] T001 建立 test 目錄：`specs/020-post-edit-dirty-check/tests/unit/`、`specs/020-post-edit-dirty-check/tests/integration/`。e2e 目錄不建（見 T006 skip 決策）。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 本 feature 無跨 story 共享的 foundational 工作（兩個 story 共用 `ComposeModal`，但 ComposeModal 的修改直接屬於 US1 實作範圍，不抽離為 foundational）。

**Checkpoint**: 直接進入 User Story 1。

---

## Phase 3: User Story 1 - 阻擋無變更的文章編輯送出 (Priority: P1) 🎯 MVP

**Goal**: 編輯文章對話框在未變更時停用「更新」按鈕；按下後進入「更新中…」狀態；`updatePost` 寫入前 trim title/content，確保按鈕狀態與實際寫入值一致。

**Independent Test**:

1. 登入後進 `/posts`，點擊自己文章的「編輯」，不修改任何欄位 → 「更新」按鈕停用、無法觸發。
2. 進 `/posts/[id]`，重複同樣操作 → 行為一致。
3. 修改 → 改回原樣 → 按鈕回到停用。
4. DevTools Network：無寫入請求。

### Tests for User Story 1 (RED phase — 必須先寫且失敗) ⚠️

- [x] T002 [P] [US1] 撰寫 unit test `specs/020-post-edit-dirty-check/tests/unit/update-post-trim.test.js`：mock Firestore `updateDoc`，驗證 `updatePost(id, { title: '  t  ', content: '  c  ' })` 實際呼叫 `updateDoc` 時的 payload 為 `{ title: 't', content: 'c' }`；同時驗證中間空白（e.g. `'hello  world'`）保留不變。
- [x] T003 [P] [US1] 撰寫 integration test `specs/020-post-edit-dirty-check/tests/integration/compose-modal-dirty.test.jsx`：以 `userEvent.setup()` 渲染 `ComposeModal`，涵蓋
  - isEditing=true、title/content 與 original 相同 → submit button `disabled=true`
  - isEditing=true、修改 title → `disabled=false`
  - isEditing=true、修改後改回原樣 → `disabled=true`
  - isEditing=true、僅加前後空白 → `disabled=true`（trim 比對）
  - isEditing=true、改成純空白 → `disabled=false`（dirty 成立）
  - isEditing=true、isSubmitting=true → `disabled=true` 且按鈕文字為「更新中…」
  - isEditing=true、isSubmitting=false → 按鈕文字為「更新」
  - isEditing=true、re-render 時 `originalTitle` / `originalContent` prop 從 post A 切換為 post B → `isDirty` 以新 original 為基準重新計算（驗證 ComposeModal 不殘留舊 snapshot，對應 data-model.md Invariant I1 的跨開啟生命週期重置）
- [x] T004 [P] [US1] 撰寫 integration test `specs/020-post-edit-dirty-check/tests/integration/posts-page-edit-dirty.test.jsx`：mock `getPosts`、`updatePost`、`AuthContext`，渲染 `src/app/posts/page.jsx`，以 `userEvent` 執行「點擊編輯 → 不改 → 按鈕停用」、「改後改回 → 停用」、「修改後送出 → `updatePost` 被以 trim 後值呼叫」、「打開編輯 post A → 改動 title → 按取消/ESC 關閉 → 重新打開 post A 編輯 → title/content 為 A 的原始值且按鈕 disabled」、「編輯 post A 關閉後改編輯 post B → originalTitle/originalContent 基準為 B」完整流程。
- [x] T005 [P] [US1] 撰寫 integration test `specs/020-post-edit-dirty-check/tests/integration/post-detail-edit-dirty.test.jsx`：mock `getPostById`、`updatePost`、`AuthContext`，渲染 `src/app/posts/[id]/PostDetailClient.jsx`，同 T004 的互動驗證（列表頁與詳情頁行為一致）；另覆蓋「打開編輯 → 改動後關閉（不送出）→ 重新打開 → title/content 回到原始值、按鈕 disabled」確保詳情頁單一 post 的 re-open lifecycle 正確。
- [~] T006 [P] [US1] **SKIPPED** — 撰寫 E2E test `specs/020-post-edit-dirty-check/tests/e2e/post-edit-dirty.spec.js`。
  - **Skip 理由**：本 repo 目前無 emulator-based E2E auth fixture（現有 `specs/019-posts-ui-refactor/tests/e2e/` 只做 anonymous smoke test，碰不到「點編輯」這層）。光為此 feature 從零搭 login fixture 不划算。
  - **覆蓋充分性**：dirty 偵測、trim 語意、re-open 重置基準等真正會 regress 的行為均由 T003/T004/T005 integration test 覆蓋；quickstart.md Scenario A–G 為 happy path 人工驗收。
  - **後續計畫**：待專案引入 emulator-based E2E auth fixture 再補。`npm run test:e2e:branch` 在無 e2e 目錄時自動 skip，不擋 Phase 5 完成條件。

**Checkpoint**: 執行 `npx vitest run specs/020-post-edit-dirty-check/tests` 與 `npx playwright test specs/020-post-edit-dirty-check/tests/e2e` 確認所有測試 FAIL（RED phase 確立）。

### Implementation for User Story 1 (GREEN phase)

- [x] T007 [P] [US1] 修改 `src/lib/firebase-posts.js` 的 `updatePost(id, { title, content })`：寫入 Firestore 前對 `title`、`content` 呼叫 `String.prototype.trim()`；JSDoc 補註明「前後空白會被 trim 後寫入，中間空白保留」。確認 `createPost` 不動（scope 外）。
- [x] T008 [US1] 修改 `src/components/ComposeModal.jsx`：
  - 新增 props `originalTitle?: string`、`originalContent?: string`、`isSubmitting?: boolean`（JSDoc 更新 `@typedef` 與 `@param`）
  - 在 component body 內 computed `isDirty`：`isEditing ? (title.trim() !== (originalTitle ?? '').trim() || content.trim() !== (originalContent ?? '').trim()) : true`
  - Computed `submitDisabled = (isEditing && !isDirty) || !!isSubmitting`
  - Computed `submitText = isEditing ? (isSubmitting ? '更新中…' : '更新') : '發布'`
  - Submit button 套用 `disabled={submitDisabled}` 與 `{submitText}`
  - 注意：derived value 寫在 function body，**不得**在 JSX 內用 IIFE 或巢狀 ternary（constitution 原則 IX）
- [x] T009 [P] [US1] 修改 `src/app/posts/page.jsx`：
  - 新增 `useState` 保存 `originalTitle` / `originalContent` / `isSubmitting`
  - 「編輯 post X」處理器中：`setOriginalTitle(post.title); setOriginalContent(post.content)` 與現有 `setTitle` / `setContent` 同步設定
  - `handleSubmitPost` 包 `try { setIsSubmitting(true); await updatePost(...); } finally { setIsSubmitting(false); }`
  - `<ComposeModal>` 傳入 `originalTitle`、`originalContent`、`isSubmitting` 三個 prop
  - 關閉 dialog / 成功送出後 reset 這些 state 為 `''` / `false`
  - 依賴：T008 的 ComposeModal 新 props signature
- [x] T010 [P] [US1] 修改 `src/app/posts/[id]/PostDetailClient.jsx`：與 T009 同步驟，確保列表頁與詳情頁 state 管理模式一致（research.md Decision 1/3）。依賴：T008。

**Checkpoint**: 重跑 T002–T006 全部測試 → PASS（GREEN phase 完成）。此時 User Story 1 完整可獨立驗收，達成 MVP。

---

## Phase 4: User Story 2 - 新增文章不受此規則影響 (Priority: P2)

**Goal**: 確認新增文章流程（`isEditing=false`）未因 US1 的 dirty gate 改動而受影響。

**Independent Test**: 點擊 `/posts` 頁「發表文章」→ 對話框開啟 → 輸入合法內容 → 「發布」按鈕可正常點擊並送出（不被 dirty gate 卡住）。

### Tests for User Story 2 (RED phase) ⚠️

- [x] T011 [P] [US2] 於 `specs/020-post-edit-dirty-check/tests/integration/compose-modal-dirty.test.jsx` 新增測試區塊「isEditing=false（新增模式）」涵蓋：
  - title 與 content 皆為空 → submit button `disabled=false`（新增模式不套 dirty gate）
  - isSubmitting=true → `disabled=true`（避免重複送出；research.md Decision 4）
  - 按鈕文字固定為「發布」（不切換為「更新中…」；research.md Decision 4）
- [x] T012 [P] [US2] 於 `specs/020-post-edit-dirty-check/tests/integration/posts-page-edit-dirty.test.jsx` 新增 sanity case「點擊『發表文章』→ 對話框開啟且按鈕不被 dirty gate 阻擋 → 輸入合法標題/內文 → 成功送出 `createPost`」確認 US1 改動未 regress 新增流程。

### Implementation for User Story 2

> 無獨立 implementation 任務：T008 ComposeModal 的 `submitDisabled` 公式已自然涵蓋 `isEditing=false` 分支（`(isEditing && !isDirty)` 退化為 `false`），research.md Decision 4 明確規範此設計。

**Checkpoint**: T011 與 T012 新增的測試 PASS → US2 驗收完成；同時重跑 T003 與 T004 確認 US1 既有測試未 regress。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 品質驗收與文件同步

- [x] T013 執行 `npm run type-check:branch`，修復所有 JSDoc 型別錯誤。
  - **執行狀態**：以 `npm run type-check:changed`（未 commit 狀態）驗證，`✓ No type errors in changed files`。
  - **修復記錄**：PostCardProps、CommentCardProps typedef 加入 `@property {import('react').Key} [key]`，解決 pre-existing repo-wide 的「React `key` prop 不在 JSDoc @typedef 中」誤報。T008 遺留的 `no-nested-ternary` 也在同一 REFACTOR 週期抽為 `getSubmitText` helper 修復。
- [x] T014 執行 `npm run lint:branch`，修復所有 ESLint warning / error。
  - **執行狀態**：以 `npm run lint:changed` 驗證，無輸出（clean）。
- [x] T015 執行 `npm run test:branch`，確認 Vitest unit + integration 全綠。
  - **執行狀態**：`Test Files  4 passed (4) | Tests  26 passed (26)`。
- [x] T016 執行 `npm run test:e2e:branch`。
  - **執行狀態**：`No E2E test directory found at specs/020-post-edit-dirty-check/tests/e2e — skipping.`（符合 T006 SKIPPED 決策，無 e2e 目錄自動跳過）。
- [x] T017 執行 IDE MCP `getDiagnostics`，修正所有 severity=Error/Warning/Hint 的診斷。
  - **執行狀態**：對 10 個 changed files（6 production + 4 test）各別呼叫，全部 `diagnostics: []`。無 error / warning / hint。
- [x] T018 依 `specs/020-post-edit-dirty-check/quickstart.md` 逐一人工驗證 Scenario A–I，在文件末段的 Pass Criteria checkbox 打勾。
  - **執行狀態**：使用者人工驗證通過，Scenario A–I 全部符合 Pass Criteria。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**：無前置；可立即開始。
- **Phase 2 (Foundational)**：本 feature 未使用，直接進入 Phase 3。
- **Phase 3 (US1)**：依賴 Phase 1 完成。內部：T002–T006（tests）→ T007–T010（impl）。
- **Phase 4 (US2)**：依賴 Phase 3 完成（因 US2 test 重用 US1 建立的 `compose-modal-dirty.test.jsx`）。
- **Phase 5 (Polish)**：依賴 Phase 3 + Phase 4 完成。

### User Story Dependencies

- **US1 (P1)**：MVP，可獨立完成並交付。
- **US2 (P2)**：technically 依賴 US1 實作成果（因 ComposeModal 的 `isEditing=false` 分支行為由 T008 定義），但測試本身獨立可驗收。

### Within User Story 1

- T002–T006 全部為不同檔案 → 可平行撰寫（皆 [P]）
- T007 為獨立檔 → 可與 T008 平行（皆 [P]）
- T009 與 T010 都依賴 T008（新 prop signature）
- T009 與 T010 彼此獨立 → 皆標 `[P]`，兩者在 T008 完成後可平行執行

### Parallel Opportunities

- T002、T003、T004、T005、T006 可由 5 位開發者同時撰寫（不同檔案）。
- T007 與 T008 可同時進行（不同檔案）。
- T008 完成後，T009 與 T010 可同時進行。
- T011 與 T012 可同時撰寫（不同測試檔案）。

---

## Parallel Example: User Story 1 測試階段

```bash
# 同時啟動所有 US1 測試撰寫任務（5 個不同檔案）：
Task: "撰寫 unit test specs/020-post-edit-dirty-check/tests/unit/update-post-trim.test.js"
Task: "撰寫 integration test specs/020-post-edit-dirty-check/tests/integration/compose-modal-dirty.test.jsx"
Task: "撰寫 integration test specs/020-post-edit-dirty-check/tests/integration/posts-page-edit-dirty.test.jsx"
Task: "撰寫 integration test specs/020-post-edit-dirty-check/tests/integration/post-detail-edit-dirty.test.jsx"
Task: "撰寫 E2E test specs/020-post-edit-dirty-check/tests/e2e/post-edit-dirty.spec.js"
```

## Parallel Example: User Story 1 實作階段

```bash
# T007 與 T008 可同時（不同檔案）：
Task: "trim in updatePost — src/lib/firebase-posts.js"
Task: "dirty gate 在 ComposeModal — src/components/ComposeModal.jsx"

# T008 完成後，T009 與 T010 可同時：
Task: "wire parent state — src/app/posts/page.jsx"
Task: "wire parent state — src/app/posts/[id]/PostDetailClient.jsx"
```

## Parallel Example: User Story 2 測試階段

```bash
# T011 與 T012 可同時（不同檔案）：
Task: "compose-modal-dirty.test.jsx 新增 isEditing=false 區塊"
Task: "posts-page-edit-dirty.test.jsx 新增『發表文章』sanity case"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 Setup（T001）
2. 完成 Phase 3 的 tests（T002–T006）— 確認全部 FAIL（RED）
3. 完成 Phase 3 的 implementation（T007–T010）— 確認測試全部 PASS（GREEN）
4. **STOP & VALIDATE**：依 quickstart.md 的 Scenario A / B / C / D / E / F / G 人工抽查 US1 行為
5. 此時已達 MVP，可單獨交付或繼續 US2

### Incremental Delivery

1. Setup → US1 → Validate → 交付 MVP（核心 dirty gate 已能上線）
2. 追加 US2（T011/T012）→ 確認新增流程未 regress
3. Polish（T013–T018）→ 過所有 CI / lint / type-check / e2e / quickstart

### 單人開發路線（本 feature 預期情境）

順序執行：T001 → T002/T003/T004/T005/T006（可平行）→ T007/T008（可平行）→ T009/T010（可平行）→ T011/T012（可平行）→ T013–T018。

---

## Notes

- `[P]` 代表不同檔案、無相依 — 可平行
- `[US1]` / `[US2]` 標籤對應 spec.md 的 user story
- 嚴格 TDD：每個 implementation task 對應的 test MUST 先 FAIL 才開始實作
- 每個 task 或每組邏輯完成後 commit（Conventional Commits 格式）
- T008 完成後先本地驗證 ComposeModal 行為再動 parent（T009/T010）
- 避免在本 feature 範圍內改動 `createPost` 或 `validatePostInput`（research.md Decision 2 已界定 scope）
- US2 的測試（T011/T012）本質為 US1 impl 完成後的 **regression / sanity 驗證**（因 `isEditing=false` 行為由 T008 實作一併交付）；雖放在 RED phase 區塊，執行時允許在 T008–T010 完成後才補寫，非違反嚴格 TDD（`/speckit.analyze` I2 finding 的澄清）
