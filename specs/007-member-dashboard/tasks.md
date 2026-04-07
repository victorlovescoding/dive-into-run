# Tasks: Member Activity Dashboard

**Input**: Design documents from `/specs/007-member-dashboard/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md

**Tests**: Not included (not requested in spec).

**Organization**: Tasks organized by user story with maximum parallelism for subagent execution. Each batch of `[P]` tasks can launch simultaneously.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same batch)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Firestore 設定變更，啟用 collectionGroup 查詢所需的 rules 和 indexes

- [ ] T001 [P] Update `firestore.rules` — add collectionGroup('comments') wildcard read rule: `match /{path=**}/comments/{commentId} { allow read: if true; }`. Refer to plan.md "Firestore Changes > Security Rules" section. This does not expand existing permissions, only enables collectionGroup query path
- [ ] T002 [P] Update `firestore.indexes.json` — add 3 composite indexes: (1) `participants` COLLECTION_GROUP `uid ASC`, (2) `comments` COLLECTION_GROUP `authorUid ASC, createdAt DESC`, (3) `posts` COLLECTION `authorUid ASC, postAt DESC`. Refer to plan.md "Composite Indexes" section for exact JSON

**Checkpoint**: Firestore 設定完成，可開始實作 service layer

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service layer + 通用 hook — 所有 User Story 的底層基礎設施

**CRITICAL**: No user story UI work can begin until this phase is complete

- [ ] T003 [P] Create `src/lib/firebase-member.js` — implement 4 service functions with full JSDoc typedefs. (1) `fetchMyEventIds(uid)`: two parallel queries — `collectionGroup('participants').where('uid','==',uid)` for eventIds + `collection('events').where('hostUid','==',uid)` for hosted IDs, return `{ participantIds, hostedIds }`. (2) `fetchMyEvents(uid, options)`: on first call use `fetchMyEventIds` to get all IDs → batch `getDoc()` → sort by `time` desc → array offset pagination with `cursor` (number) and `pageSize` (default 5), return `{ items: MyEventItem[], nextCursor, hostedIds: Set<string> }`. (3) `fetchMyPosts(uid, options)`: standard Firestore cursor pagination — `collection('posts').where('authorUid','==',uid).orderBy('postAt','desc').limit(pageSize)`, use `startAfter(afterDoc)` for next page, return `{ items, lastDoc }`. (4) `fetchMyComments(uid, options)`: `collectionGroup('comments').where('authorUid','==',uid).orderBy('createdAt','desc').limit(pageSize)` — determine source via `doc.ref.parent.parent.parent.id` ('posts' or 'events'), normalize text field (post=`comment`, event=`content`), extract parentId from `doc.ref.parent.parent.id`, batch `getDoc()` parent docs for title (use `titleCache` Map to skip already-fetched), return `{ items: MyCommentItem[], lastDoc }`. **IMPORTANT**: `MyCommentItem` typedef must use `source: 'post' | 'event'`, `parentId`, `parentTitle`, `text` (normalized) per plan.md — NOT the older data-model.md typedef which only has `postId`/`postTitle`. Refer to plan.md "Service Layer" section for full signatures and strategies
- [ ] T004 [P] Create `src/hooks/useDashboardTab.js` — generic paginated tab hook implementing IntersectionObserver infinite scroll. Params: `uid` (string|null), `fetchFn` (service layer function), `pageSize` (number, default 5), `isActive` (boolean). Returns: `{ items, isLoading, isLoadingMore, hasMore, error, retry, loadMoreError, retryLoadMore, sentinelRef }`. Key behaviors: (1) lazy init — only fetch on first `isActive=true`, (2) IntersectionObserver with `rootMargin: '0px 0px 300px 0px'` only connected when `isActive && hasMore && !isLoadingMore`, (3) `cancelled` flag pattern to prevent stale updates (reference `src/hooks/useComments.js`), (4) cursor type is flexible — hook stores and passes through without interpreting (number for events, DocumentSnapshot for posts/comments), (5) separate `error` (initial load) and `loadMoreError` (load more) with independent retry. Refer to plan.md "Custom Hook" section for full typedef and design notes

**Checkpoint**: Foundation ready — card components can now begin in parallel

---

## Phase 3: User Story 1 — 查看我參加的活動 (Priority: P1)

**Goal**: 會員可以看到自己參加的活動列表，含「主辦」與「即將到來/已結束」狀態標籤

**Independent Test**: 登入 → 會員頁面 → 「我的活動」Tab → 確認列表正確顯示活動、badge、連結

### Implementation for User Story 1

- [ ] T005 [P] [US1] Create `src/components/DashboardEventCard.jsx` + `src/components/DashboardEventCard.module.css` — Props: `{ event, isHost }` where event is `MyEventItem`. Display: title as `<Link>` to `/events/{id}`, datetime (use `formatDateTime` from `src/lib/event-helpers.js`), location, `participantsCount/maxParticipants`. Badges: `isHost` → pill 「主辦」, `event.time > now` → 「即將到來」 / else 「已結束」. CSS: white card + rounded corners (8-12px) + subtle shadow, text colors `#202124`/`#5f6368`, border `#e0e3e7`, badge as small pill shape, responsive `@media (max-width: 767px)`. Refer to plan.md "DashboardEventCard" section

**Checkpoint**: Event card component ready

---

## Phase 4: User Story 2 — 查看我發表的文章 (Priority: P1)

**Goal**: 會員可以看到自己發表的所有文章列表

**Independent Test**: 登入 → 會員頁面 → 「我的文章」Tab → 確認列表正確顯示文章、連結

### Implementation for User Story 2

- [ ] T006 [P] [US2] Create `src/components/DashboardPostCard.jsx` + `src/components/DashboardPostCard.module.css` — Props: `{ post }` (Post type from data-model.md). Display: title as `<Link>` to `/posts/{id}`, `postAt` formatted date, `likesCount`, `commentsCount`. CSS: same card style as DashboardEventCard (white + rounded + shadow). Refer to plan.md "DashboardPostCard" section

**Checkpoint**: Post card component ready

---

## Phase 5: User Story 3 — 查看我的留言 (Priority: P1)

**Goal**: 會員可以看到自己在文章與活動下的所有留言，含來源 badge

**Independent Test**: 登入 → 會員頁面 → 「我的留言」Tab → 確認列表含來源 badge + parent title 連結

### Implementation for User Story 3

- [ ] T007 [P] [US3] Create `src/components/DashboardCommentCard.jsx` + `src/components/DashboardCommentCard.module.css` — Props: `{ comment }` where comment is `MyCommentItem` (has `source`, `parentId`, `parentTitle`, `text`, `createdAt`). Display: source badge pill 「文章」or「活動」, `parentTitle` as `<Link>` to `/posts/{parentId}` or `/events/{parentId}` based on `source`, comment text with CSS `line-clamp: 2` (webkit), `createdAt` formatted date. CSS: same card style pattern. Refer to plan.md "DashboardCommentCard" section

**Checkpoint**: Comment card component ready

---

## Phase 6: User Story 4 — Tab Container + Infinite Scroll Integration (Priority: P2)

**Goal**: 三 Tab 容器整合所有 card components + hook + service layer，實現 tab 切換與 infinite scroll

**Independent Test**: 登入 → 會員頁面 → 三 Tab 切換正常 → 各 Tab 含 loading/empty/error/end states → 超過 5 筆時滾動自動載入

### Implementation for User Story 4

- [ ] T008 [US4] Create `src/components/DashboardTabs.jsx` + `src/components/DashboardTabs.module.css` — Props: `{ uid }`. Manage `activeTab` state (0, 1, 2). Create 3 `useDashboardTab` hook instances with `fetchMyEvents`/`fetchMyPosts`/`fetchMyComments` from `firebase-member.js`. Tab bar: `role="tablist"`, each tab button `role="tab"` + `aria-selected` + `aria-controls`. Three panels: `role="tabpanel"` + `aria-labelledby`, all 3 mount simultaneously, non-active hidden via CSS `display: none`. Each panel renders: (1) loading spinner when `isLoading`, (2) error message (`#fce8e6` bg + `#c5221f` text) with retry button when `error`, (2b) load-more error at list bottom with retryLoadMore button when `loadMoreError`, (3) empty state centered grey text when no items (「尚未參加任何活動」/「尚未發表任何文章」/「尚未留過任何言」), (4) item list mapping to respective card components, (5) sentinel `<div ref={sentinelRef}>` for IntersectionObserver, (6) "loading more" indicator when `isLoadingMore`, (7) end hint (「已顯示全部」dashed border) when `!hasMore && items.length > 0`. **Note for events tab**: pass `hostedIds` Set from hook to determine `isHost` prop per event. Refer to plan.md "DashboardTabs" + "Tab 切換策略" + "CSS 風格" sections
- [ ] T009 [US4] Modify `src/app/member/page.jsx` — import and mount `<DashboardTabs uid={user.uid} />` below the existing profile info section. Only render when user is logged in (existing auth guard should handle this). Read the current page.jsx first to understand existing structure

**Checkpoint**: Feature fully integrated — all 4 user stories functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 驗證 + 修正

- [ ] T010 Run `npm run type-check` and `npm run lint` — fix all errors and warnings. Ensure all new JSDoc typedefs use lowercase `{object}`, all `@property` and `@param` have descriptions, no `@ts-ignore`, no `eslint-disable` for a11y. Add any new words to `cspell.json` if needed

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────── T001, T002 (parallel, 2 subagents)
    │
    v
Phase 2: Foundational ──── T003, T004 (parallel, 2 subagents)
    │
    v
Phase 3+4+5: Cards ──────── T005, T006, T007 (parallel, 3 subagents)
    │
    v
Phase 6: Integration ────── T008 → T009 (sequential, 1 subagent)
    │
    v
Phase 7: Polish ──────────── T010 (1 subagent)
```

### Subagent Parallelism Summary

| Batch | Tasks            | Subagents | Blocking?      |
| ----- | ---------------- | --------- | -------------- |
| 1     | T001, T002       | 2         | Blocks Batch 2 |
| 2     | T003, T004       | 2         | Blocks Batch 3 |
| 3     | T005, T006, T007 | 3         | Blocks Batch 4 |
| 4     | T008 → T009      | 1         | Blocks Batch 5 |
| 5     | T010             | 1         | —              |

**Max concurrent subagents**: 3 (Batch 3)
**Total sequential batches**: 5

### Within Each Batch

- **Batch 1**: T001 and T002 touch different files (firestore.rules vs firestore.indexes.json) — fully parallel
- **Batch 2**: T003 and T004 touch different files (firebase-member.js vs useDashboardTab.js) — fully parallel. T004 does NOT import T003; it receives fetchFn as a param
- **Batch 3**: T005, T006, T007 touch different files (3 separate card components) — fully parallel. Each card only depends on its item typedef from T003
- **Batch 4**: T008 imports outputs of T003 + T004 + T005/T006/T007 — must wait for Batch 3. T009 modifies page.jsx to mount T008's component — must wait for T008

### User Story Dependencies

- **US1 (P1)**: Foundational → T005 → integrated in T008
- **US2 (P1)**: Foundational → T006 → integrated in T008
- **US3 (P1)**: Foundational → T007 → integrated in T008
- **US4 (P2)**: Logic in T004 (hook) + UI in T008 (container) — cross-cutting

---

## Parallel Example: Batch 3 (Peak Parallelism)

```bash
# Launch 3 subagents simultaneously after Phase 2 completes:
Subagent 1: "T005 [US1] Create DashboardEventCard.jsx + CSS Module"
Subagent 2: "T006 [US2] Create DashboardPostCard.jsx + CSS Module"
Subagent 3: "T007 [US3] Create DashboardCommentCard.jsx + CSS Module"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (firestore rules + indexes)
2. Complete Phase 2: Foundational (service layer + hook)
3. Complete Phase 3: US1 event card
4. Complete Phase 6: Integration (DashboardTabs + page mount)
5. **STOP and VALIDATE**: Tab 1 「我的活動」independently functional

### Full Delivery (All Stories)

1. Phase 1 → Phase 2 (sequential foundation)
2. Phase 3 + 4 + 5 simultaneously (3 subagents for 3 card types)
3. Phase 6 integration (wire everything together)
4. Phase 7 polish (type-check + lint)

### Key Design Decisions (from research.md)

- Events: upfront ID collection + client-side sort (research Task 1)
- Comments: collectionGroup with client-side path filtering for source detection (research Task 2)
- Titles: extract parentId from doc path + batch getDoc with titleCache (research Task 3)
- Tab switching: CSS `display: none` toggle, all 3 panels always mounted (research Task 5)
