# Tasks: Posts 頁面 UI 重新設計

**Input**: Design documents from `/specs/019-posts-ui-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md

**Tests**: Included (TDD workflow: RED → GREEN → REFACTOR)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Data prerequisite — 修正 `createPost` 遺漏的 `authorName` 欄位 + 回填既有資料

- [x] T001 補存 `authorName` 欄位到 `createPost` 函式，加入 `authorName: user.name || '匿名使用者'` in `src/lib/firebase-posts.js`
- [x] T002 [P] 建立一次性 migration script，讀取所有 posts 的 `authorUid` 查詢 `users` collection 回填 `authorName`（約 20 筆）in `scripts/backfill-post-author-name.mjs`

---

## Phase 2: User Story 1 — Post Feed 卡片重新設計 (Priority: P1) 🎯 MVP

**Goal**: 列表頁卡片從開發樣式（藍色邊框）升級為社群風格的平坦分線風格，包含作者頭像、顯示名稱、相對時間、標題、內容、按讚數與留言數

**Independent Test**: 開啟 Posts 列表頁，確認每張卡片都以新的社群風格呈現，包含所有必要資訊欄位，且現有的編輯/刪除功能正常運作

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [P] [US1] Write PostCard unit test — 渲染作者資訊、標題、meta（按讚/留言數）、作者操作選單、edge cases（無內容文章、無頭像作者）in `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`
- [x] T004 [P] [US1] Write PostFeed integration test — feed layout、卡片列表渲染、無限滾動保持正常 in `specs/019-posts-ui-refactor/tests/integration/PostFeed.test.jsx`

### Implementation for User Story 1

- [x] T005 [P] [US1] Create PostCard component + CSS Module（社群風格卡片：圓角 8px、底部分隔線、作者區域 UserLink + formatRelativeTime、按讚/留言 meta bar、作者選單）in `src/components/PostCard.jsx` + `src/components/PostCard.module.css`
- [x] T006 [P] [US1] Rewrite list page CSS Module — 移除藍色邊框 dev style、建立 feed 窄欄佈局（max-width 680px 置中）in `src/app/posts/posts.module.css`
- [x] T007 [US1] Refactor list page JSX — 以 PostCard 取代 inline 卡片渲染、套用新 feed layout、移除固定右下角 FAB 按鈕、列表無文章時顯示空狀態提示 in `src/app/posts/page.jsx`

**Checkpoint**: 列表頁以社群風格卡片呈現，所有必要資訊可見，無限滾動 + 編輯/刪除功能正常。此時尚未實作截斷/展開

---

## Phase 3: User Story 2 — 內容展開式摘要 (Priority: P2)

**Goal**: 超過 150 字的文章內容截斷顯示「......」+「查看更多」，點擊就地展開，展開後不提供收起

**Independent Test**: 建立一篇超過 150 字與一篇未超過 150 字的文章，確認截斷、展開行為符合預期

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [US2] Add truncation/expand test cases to PostCard unit test — >150 字截斷 + 「查看更多」、<=150 字完整顯示、點擊展開、無「收起」按鈕 in `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`

### Implementation for User Story 2

- [x] T009 [US2] Implement content truncation/expand logic + max-height transition animation（250ms ease、transitionend 後移除 max-height 限制）in `src/components/PostCard.jsx` + `src/components/PostCard.module.css`

**Checkpoint**: 長文章正確截斷，點擊「查看更多」以平滑動畫展開，短文章直接完整顯示

---

## Phase 4: User Story 3 — Feed 頂部發文入口與 Modal (Priority: P3)

**Goal**: 登入使用者在 feed 頂部看到假輸入框，點擊開啟 `<dialog>` Modal 完成發文，發布後新文章出現在 feed 最上方

**Independent Test**: 以登入/未登入身分各開啟一次列表頁，確認假輸入框顯示/隱藏，完成一次從點擊到發布的完整流程

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T010 [US3] Write ComposeModal integration test — Modal 開關、表單填寫、送出、關閉保護（有內容時 Escape/backdrop 不關閉）、ComposePrompt auth-gated visibility（登入顯示/未登入隱藏）in `specs/019-posts-ui-refactor/tests/integration/ComposeModal.test.jsx`

### Implementation for User Story 3

- [x] T011 [P] [US3] Create ComposePrompt component + CSS Module（使用者頭像 + placeholder「分享你的跑步故事...」、整塊可點擊、背景 #f8f9fa）in `src/components/ComposePrompt.jsx` + `src/components/ComposePrompt.module.css`
- [x] T012 [P] [US3] Create ComposeModal component + CSS Module（`<dialog>` + showModal、標題 input + 內容 textarea + 發布按鈕、cancel event 攔截、backdrop click 保護、isEditing 模式切換）in `src/components/ComposeModal.jsx` + `src/components/ComposeModal.module.css`
- [x] T013 [US3] Integrate ComposePrompt + ComposeModal into list page — 以 ComposePrompt 取代 FAB、以 ComposeModal 取代 inline form、登入判斷控制顯示 in `src/app/posts/page.jsx`

**Checkpoint**: 登入使用者可透過假輸入框 → Modal 完成發文，未登入者不見假輸入框，表單有內容時受關閉保護

---

## Phase 5: User Story 4 — Post 詳文頁與留言卡片 (Priority: P4)

**Goal**: 詳文頁文章區域使用 PostCard（truncate=false）呈現，留言以獨立 CommentCard 卡片包裝，視覺風格與列表頁一致

**Independent Test**: 開啟任一文章的詳文頁，確認視覺風格一致、留言以獨立卡片呈現、所有互動功能（按讚、分享、留言 CRUD、留言高亮、無限滾動）正常

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T014 [US4] Write PostDetail integration test — 文章區域視覺一致性、CommentCard 渲染、按讚/分享/留言功能、留言無限滾動 in `specs/019-posts-ui-refactor/tests/integration/PostDetail.test.jsx`

### Implementation for User Story 4

- [x] T015 [P] [US4] Update CommentCard visual style — 配合新設計的間距/配色/頭像呈現 in `src/components/CommentCard.jsx` + `src/components/CommentCard.module.css`
- [x] T016 [P] [US4] Rewrite detail page CSS Module — 移除紅色邊框 dev style、建立社群風格佈局 in `src/app/posts/[id]/postDetail.module.css`
- [x] T017 [US4] Refactor PostDetailClient — 以 PostCard（truncate=false）取代 inline 文章渲染、以 CommentCard 取代 inline 留言渲染、以 ComposeModal（isEditing）取代 inline 編輯表單、留言輸入區配合新風格 in `src/app/posts/[id]/PostDetailClient.jsx`

**Checkpoint**: 詳文頁與列表頁視覺一致，留言以獨立卡片呈現，所有既有互動功能（FR-023）正常運作

---

## Phase 6: User Story 5 — 骨架屏載入狀態 (Priority: P5)

**Goal**: 頁面載入中顯示模擬卡片結構的灰色骨架屏 shimmer 動畫，替代空白或 spinner

**Independent Test**: 在網路限速條件下開啟列表頁或詳文頁，確認骨架屏正確顯示並在內容載入後消失

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T018 [US5] Write PostCardSkeleton unit test — renders correct count、shimmer CSS class applied、具備 aria-busy attribute in `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`

### Implementation for User Story 5

- [x] T019 [P] [US5] Create PostCardSkeleton component + CSS Module（shimmer 動畫：linear-gradient + background-size 200% + @keyframes、count prop 控制數量、結構鏡像 PostCard）in `src/components/PostCardSkeleton.jsx` + `src/components/PostCardSkeleton.module.css`
- [x] T020 [US5] Integrate PostCardSkeleton into list page — 初始載入 isLoading 狀態顯示 skeleton count=3、無限滾動 isLoadingNext 顯示 skeleton count=1 in `src/app/posts/page.jsx`
- [x] T021 [US5] Integrate skeleton loading into detail page — 文章區域 + 留言區域的載入佔位 in `src/app/posts/[id]/PostDetailClient.jsx`

**Checkpoint**: 頁面載入中顯示骨架屏，內容載入完成後骨架屏被實際內容取代

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E 驗證、響應式確認、最終品質關卡

- [x] T022 Write E2E test — 列表頁卡片呈現、內容展開、發文流程（假輸入框→Modal→發布）、詳文頁互動、骨架屏載入 in `specs/019-posts-ui-refactor/tests/e2e/posts-ui.spec.js`
- [x] T023 [P] Responsive verification — 375px / 680px / 1280px 三個斷點視覺驗證，確認無破版或資訊遺漏
- [x] T024 Run quickstart.md validation + final quality gate（`npm run type-check` + `npm run lint` + `getDiagnostics`）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (T001 + T002 parallel)
- **US1 (Phase 2)**: Depends on Setup (T001 provides authorName data) — creates PostCard, the core visual unit
- **US2 (Phase 3)**: Depends on US1 (extends PostCard with truncation/expand)
- **US3 (Phase 4)**: Depends on US1 (modifies page.jsx already refactored in T007)
- **US4 (Phase 5)**: Depends on US1 (uses PostCard in detail page) + US3 (uses ComposeModal for editing)
- **US5 (Phase 6)**: Depends on US1 (integrates into page.jsx from T007)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Blocks US2, US3, US4, US5 — PostCard + page.jsx base
- **US2 (P2)**: Only depends on US1. Independent of US3/US4/US5
- **US3 (P3)**: Only depends on US1. Independent of US2/US4/US5. Can parallel with US2
- **US4 (P4)**: Depends on US1 + US3 (ComposeModal for editing). Sequential after US3
- **US5 (P5)**: Only depends on US1. Can parallel with US2/US3

### Within Each User Story

1. Tests (RED) MUST be written and FAIL before implementation
2. Component creation before page integration
3. CSS Module can parallel with component creation (different files)
4. Page integration depends on all components being ready

### Parallel Opportunities

- T001 + T002 (Setup: firebase-posts.js vs migration script)
- T003 + T004 (US1 tests: different test files)
- T005 + T006 (US1 impl: PostCard vs posts.module.css)
- T011 + T012 (US3 impl: ComposePrompt vs ComposeModal)
- T015 + T016 (US4 impl: CommentCard vs postDetail.module.css)
- US2 + US3 + US5 can parallel after US1 (if team capacity allows)

---

## Parallel Example: User Story 1

```text
# Step 1: Launch tests in parallel (RED)
Task T003: "Write PostCard unit test in specs/.../tests/unit/PostCard.test.jsx"
Task T004: "Write PostFeed integration test in specs/.../tests/integration/PostFeed.test.jsx"

# Step 2: Launch component + CSS in parallel (GREEN)
Task T005: "Create PostCard component in src/components/PostCard.jsx + PostCard.module.css"
Task T006: "Rewrite list page CSS in src/app/posts/posts.module.css"

# Step 3: Page integration (depends on T005 + T006)
Task T007: "Refactor list page JSX in src/app/posts/page.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001 + T002)
2. Complete Phase 2: User Story 1 (T003-T007)
3. **STOP and VALIDATE**: 列表頁以社群風格卡片正確呈現
4. Deploy/demo if ready — 此時已有最核心的視覺升級

### Incremental Delivery

1. Setup → US1 → **MVP! 社群風格 feed 上線**
2. - US2 → 內容截斷/展開，feed 可瀏覽性大幅提升
3. - US3 → 新發文入口，完整社群互動體驗
4. - US4 → 詳文頁視覺統一
5. - US5 → 骨架屏，感知效能提升
6. Polish → E2E + 響應式驗證 + 品質關卡

### Parallel Team Strategy

US1 完成後，可同時進行：

- Developer A: US2（截斷/展開 — 修改 PostCard）
- Developer B: US3（ComposePrompt + ComposeModal — 全新元件）
- Developer C: US5（PostCardSkeleton — 全新元件）
- US4 需等 US3 完成（ComposeModal for editing）後再進行

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 每個 User Story 可獨立完成並測試
- 所有 export 函式/元件必須有 JSDoc（CLAUDE.md Rule 4）
- 每個 task 完成前：`npm run type-check` + `npm run lint`（CLAUDE.md Rule 5）
- CSS Modules 命名：camelCase class names
- PostCard fallback: `post.authorName ?? '跑者'`（防禦性，防 migration 遺漏）
