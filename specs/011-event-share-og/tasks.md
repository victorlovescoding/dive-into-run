# Tasks: 活動分享 + Open Graph

**Input**: Design documents from `/specs/011-event-share-og/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/og-metadata.md ✅, quickstart.md ✅

**Tests**: 包含測試任務（TDD RED-GREEN-REFACTOR）

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **⚠️ TDD 工作流程（`/speckit.implement` 階段適用）**
>
> 在 `/speckit.implement` 執行每個 task 時，**必須**遵循 TDD RED → GREEN → REFACTOR 流程：
>
> 1. **RED** — 先寫測試，確認測試**失敗**
> 2. **GREEN** — 撰寫最少量的實作讓測試**通過**
> 3. **REFACTOR** — 重構程式碼，確認測試仍然通過
> 4. 通過後才可以將該 task 標記為 `[x]`
> 5. 再進行下一個 task 的 TDD 循環
>
> 沒有測試的 task（如 Setup、Polish）直接實作後驗證即可。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立分享功能所需的靜態資源和環境設定

- [ ] T001 Create brand placeholder OG image (1200×630px PNG) at `public/og-default.png`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立所有 User Story 共用的 metadata 基礎設施

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Modify `src/app/layout.jsx` — add `metadataBase` (from `NEXT_PUBLIC_SITE_URL` env) and site-wide OG defaults (`og:site_name`, `og:type`); add `NEXT_PUBLIC_SITE_URL` to `.env.example`

**Checkpoint**: Foundation ready — metadata 基礎已建立，user story 可以開始實作

---

## Phase 3: US1+US2 — 活動分享：手機原生分享 + 桌面複製連結 (Priority: P1) 🎯 MVP

**Goal**: 活動詳情頁加入 OG/Twitter Card metadata 和分享按鈕，手機自動使用系統原生分享面板，桌面 fallback 為複製連結 + toast 提示

**Independent Test**: 在手機瀏覽器開啟活動詳情頁按分享按鈕跳出系統分享面板；在桌面瀏覽器按分享按鈕顯示「已複製連結」toast；分享連結到 LINE/FB 顯示含標題、日期、地點的預覽卡片

### Tests for US1+US2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (RED phase)**

- [ ] T003 [P] [US1] Write unit tests for `buildEventOgDescription`, `stripMarkup`, `truncate` in `specs/011-event-share-og/tests/unit/og-helpers.test.js` — 含特殊字元（emoji、引號、HTML entities）edge cases，以及 event=null 時回傳 fallback metadata 的測試案例
- [ ] T004 [P] [US1] Write integration tests for ShareButton (Web Share API mock + clipboard fallback + toast feedback + navigator.share reject 時顯示錯誤 toast) in `specs/011-event-share-og/tests/integration/ShareButton.test.jsx`

### Implementation for US1+US2

- [ ] T005 [P] [US1] Create `src/lib/og-helpers.js` — implement `stripMarkup()`, `truncate()`, `buildEventOgDescription()` with JSDoc (GREEN for T003)
- [ ] T006 [P] [US1] Create `src/components/ShareButton.jsx` + `src/components/ShareButton.module.css` — icon button, Web Share API + clipboard fallback, `useToast()` integration, `aria-label="分享"` (GREEN for T004)
- [ ] T007 [US1] Add `generateMetadata()` to `src/app/events/[id]/page.jsx` — call `fetchEventById()` from `src/lib/firebase-events.js`, use `buildEventOgDescription()`, include OG + Twitter Card tags, implement fallback metadata for non-existent events
- [ ] T008 [US1] Embed ShareButton in `src/app/events/[id]/eventDetailClient.jsx` — 標題右側，傳入 `title` + `url` props

**Checkpoint**: 活動分享功能完整可用（手機 + 桌面），US1 + US2 的 Acceptance Scenarios 全部通過

---

## Phase 4: US3 — 分享文章到社群 (Priority: P2)

**Goal**: 文章詳情頁加入 OG/Twitter Card metadata 和分享按鈕，行為與活動頁一致，預覽卡片顯示文章標題和品牌圖片

**Independent Test**: 在文章詳情頁按分享按鈕，行為與活動頁一致；分享到 LINE 顯示文章標題 + 品牌圖片的預覽卡片

### Tests for US3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (RED phase)**

- [ ] T009 [US3] Add unit tests for `buildPostOgDescription` (HTML/Markdown stripping, 80-char truncation, edge cases) to `specs/011-event-share-og/tests/unit/og-helpers.test.js`

### Implementation for US3

- [ ] T010 [US3] Add `buildPostOgDescription()` to `src/lib/og-helpers.js` — strip HTML/Markdown, truncate to 80 chars, format as `「{title} — {excerpt}…」` (GREEN for T009)
- [ ] T011 [US3] Add `generateMetadata()` to `src/app/posts/[id]/page.jsx` — call `getPostDetail()` from `src/lib/firebase-posts.js`, use `buildPostOgDescription()`, include OG + Twitter Card tags, implement fallback metadata for non-existent posts
- [ ] T012 [US3] Embed ShareButton in `src/app/posts/[id]/PostDetailClient.jsx` — 標題右側，傳入 `title` + `url` props

**Checkpoint**: 文章分享功能完整可用，US3 的 Acceptance Scenarios 全部通過

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 品質驗證和跨功能檢查

- [ ] T013 Run `npm run type-check` + `npm run lint` — fix all errors and warnings
- [ ] T014 Run quickstart.md validation — verify OG tags via `curl` + check test suite passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1+US2 (Phase 3)**: Depends on Phase 2 completion
- **US3 (Phase 4)**: Depends on Phase 2 completion; can technically start after Phase 2 but reuses ShareButton from Phase 3
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **US1+US2 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US3 (P2)**: Reuses `ShareButton` from US1; recommend sequential after Phase 3

### Within Each User Story

- Tests MUST be written and FAIL before implementation (RED phase)
- Implementation makes tests pass (GREEN phase)
- Refactor after green, verify tests still pass
- Mark task `[x]` only after full TDD cycle

### Parallel Opportunities

- T003 + T004: different test files, no dependencies
- T005 + T006: different source files, no dependencies

---

## Parallel Example: US1+US2

```bash
# RED phase — launch test tasks in parallel:
Task: T003 "Unit tests for og-helpers" in specs/011-event-share-og/tests/unit/og-helpers.test.js
Task: T004 "Integration tests for ShareButton" in specs/011-event-share-og/tests/integration/ShareButton.test.jsx

# GREEN phase — launch implementation in parallel:
Task: T005 "Create og-helpers.js" in src/lib/og-helpers.js
Task: T006 "Create ShareButton" in src/components/ShareButton.jsx
```

---

## Implementation Strategy

### MVP First (US1+US2 Only)

1. Complete Phase 1: Setup (og-default.png)
2. Complete Phase 2: Foundational (layout.jsx metadataBase)
3. Complete Phase 3: US1+US2 (活動分享 — TDD cycle per task)
4. **STOP and VALIDATE**: Test US1+US2 independently — 活動頁 OG tags + 分享按鈕
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1+US2 → Test independently → Deploy/Demo (**MVP!**)
3. US3 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1（手機原生分享）與 US2（桌面複製連結）合併於 Phase 3 — 同一個 ShareButton 元件涵蓋兩個場景
- OG metadata 不增加 client bundle（server-side only via `generateMetadata()`）
- 使用既有 service layer：`fetchEventById()`（firebase-events.js:287）、`getPostDetail()`（firebase-posts.js:183）
- 使用既有 toast 系統（009-global-toast 的 `useToast()` hook）
