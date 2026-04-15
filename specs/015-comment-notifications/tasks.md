# Tasks: 留言通知擴充 (Comment Notifications)

**Input**: Design documents from `/specs/015-comment-notifications/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included (TDD Red-Green-Refactor per constitution)

**Organization**: US1 獨立一個 phase；US2/US3/US4 因共用 `notifyEventNewComment()` 去重邏輯，合併為單一 phase。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Firestore security rules 允許新通知類型寫入

- [x] T001 Update `type in [...]` whitelist to add 4 new notification types (`post_comment_reply`, `event_host_comment`, `event_participant_comment`, `event_comment_reply`) in `firestore.rules` line 230

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: notification-helpers 擴充（typedef / MESSAGE_BUILDERS / getNotificationLink）與共用 helper，所有 user story 都依賴此 phase

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests ⚠️ Write FIRST, ensure they FAIL

- [x] T002 [P] Unit test for 4 new `MESSAGE_BUILDERS` entries (`post_comment_reply`, `event_host_comment`, `event_participant_comment`, `event_comment_reply`) and updated `getNotificationLink()` returning `?commentId=` URL for event comment types in `specs/015-comment-notifications/tests/unit/notification-helpers.test.js`
- [x] T003 [P] Unit test for `fetchDistinctCommentAuthors()` — returns distinct authorUid array from comments collection ref, handles empty collection, deduplicates multi-comment authors in `specs/015-comment-notifications/tests/unit/fetch-distinct-comment-authors.test.js`

### Implementation

- [x] T004 Update `NotificationType` typedef to add 4 new values, add 4 `MESSAGE_BUILDERS` entries with correct message templates (spec FR-007~FR-010), and update `getNotificationLink()` to return `/events/{entityId}?commentId={commentId}` for `event_host_comment`/`event_participant_comment`/`event_comment_reply` types and `/posts/{entityId}?commentId={commentId}` for `post_comment_reply` in `src/lib/notification-helpers.js`
- [x] T005 [P] Implement `fetchDistinctCommentAuthors(commentsRef)` — query all docs from given `CollectionReference`, extract `authorUid`, return deduplicated array in `src/lib/firebase-notifications.js`

**Checkpoint**: Foundation ready — `buildNotificationMessage()` / `getNotificationLink()` support all 7 types, `fetchDistinctCommentAuthors()` available

---

## Phase 3: User Story 1 — 文章留言跟帖通知 (Priority: P1) 🎯 MVP

**Goal**: 曾在某篇文章留過言的使用者，在其他人新增留言時收到「你留言過的文章『{title}』有一則新的留言」通知

**Independent Test**: 建立文章 → User A 留言 → User B 留言 → User A 收到 `post_comment_reply` 通知；User A 是 post author 時只收到既有 `post_new_comment`

### Tests ⚠️ Write FIRST, ensure they FAIL

- [x] T006 [P] [US1] Unit test for `notifyPostCommentReply()` — verifies batch notification to past commenters (excluding actor + post author), no notification when no past commenters, no duplicate when commenter is also post author, single notification per unique commenter in `specs/015-comment-notifications/tests/unit/notify-post-comment-reply.test.js`
- [x] T007 [P] [US1] Integration test for `PostDetailClient` — verifies `submitCommentHandler` calls both `notifyPostNewComment()` and `notifyPostCommentReply()` on new comment, passes correct args (postId, title, authorUid, commentId, actor) in `specs/015-comment-notifications/tests/integration/post-comment-reply.test.jsx`

### Implementation

- [x] T008 [US1] Implement `notifyPostCommentReply(postId, postTitle, postAuthorUid, commentId, actor)` in `src/lib/firebase-notifications.js` — call `fetchDistinctCommentAuthors()` on `posts/{postId}/comments`, filter out `actor.uid` and `postAuthorUid`, batch write `post_comment_reply` notifications for remaining UIDs
- [x] T009 [US1] Add `notifyPostCommentReply()` call (fire-and-forget with `.catch()`) after successful new comment in `submitCommentHandler()` at `src/app/posts/[id]/PostDetailClient.jsx` — place **outside** the `if (user.uid !== postDetail.authorUid)` block (after line ~314), so it fires unconditionally for every new comment (the function internally excludes `postAuthorUid` and `actor.uid`)

**Checkpoint**: US1 complete — 文章跟帖通知可獨立測試驗證

---

## Phase 4: US2/US3/US4 — 活動留言通知（主揪人/參加者/跟帖） (Priority: P1)

**Goal**: 活動有新留言時，主揪人收到「你主辦的活動…」、參加者收到「你參加的活動…」、跟帖者收到「你留言過的活動…」通知，含跨身份去重（host > participant > commenter）

**Independent Test**: 建立活動 → 多角色留言 → 驗證主揪人/參加者/跟帖者各收到正確類型通知，且去重正確

**Why combined**: `notifyEventNewComment()` 函式內以 `Set` 一次處理三種接收者去重（plan D-002），拆成三個獨立 phase 無法獨立實作

### Tests ⚠️ Write FIRST, ensure they FAIL

- [x] T010 [P] [US2-4] Unit test for `notifyEventNewComment()` dedup logic in `specs/015-comment-notifications/tests/unit/notify-event-new-comment.test.js` — scenarios: (1) host gets `event_host_comment`, (2) participants get `event_participant_comment`, (3) past commenters (non-host, non-participant) get `event_comment_reply`, (4) host+commenter → only `event_host_comment`, (5) participant+commenter → only `event_participant_comment`, (6) actor excluded from all, (7) empty participants + no past commenters → only host notification, (8) 50-participant batch timing assertion (< 2s, SC-005). Organize into 3 `describe` blocks: (A) Core Delivery — scenarios 1-3, (B) Dedup Logic — scenarios 4-6, (C) Performance — scenarios 7-8
- [x] T011 [P] [US2-4] Integration test for `CommentSection` `onCommentAdded` callback → `eventDetailClient` trigger in `specs/015-comment-notifications/tests/integration/event-comment-notification.test.jsx` — verifies `onCommentAdded` prop is called with commentId after new comment submit, and parent calls `notifyEventNewComment()` with correct args

### Implementation

- [x] T012 [US2-4] Implement `notifyEventNewComment(eventId, eventTitle, hostUid, commentId, actor)` in `src/lib/firebase-notifications.js` — create `notifiedSet = new Set([actor.uid])`, Priority 1: host → `event_host_comment`, Priority 2: `fetchParticipants(eventId)` → `event_participant_comment`, Priority 3: `fetchDistinctCommentAuthors(events/{eventId}/comments)` → `event_comment_reply`, batch write all notifications
- [x] T013 [US2-4] Add `onCommentAdded` callback prop to `CommentSection` in `src/components/CommentSection.jsx` — first modify `src/hooks/useCommentMutations.js` to accept a 4th param `onSuccess` callback `((commentId: string) => void)`, call `onSuccess?.(newComment.id)` after `addComment` succeeds inside the hook. Then in CommentSection, pass `(commentId) => onCommentAdded?.(commentId)` as `onSuccess` to the hook. Update JSDoc props for both files accordingly
- [x] T014 [US2-4] Implement `handleCommentAdded` callback in `src/app/events/[id]/eventDetailClient.jsx` — callback calls `notifyEventNewComment(id, event.title, event.hostUid, commentId, actor)` fire-and-forget, pass as `onCommentAdded` prop to `<CommentSection>`
- [x] T015 [US2-4] Add scroll-to-comment + highlight for event page in `src/components/CommentSection.jsx` — read `?commentId=` from URL (`useSearchParams`), add `id={c.id}` to comment `<li>` elements, `setTimeout(300ms)` then `scrollIntoView({ behavior: 'smooth', block: 'center' })` + `commentHighlight` CSS class (reuse existing `highlightFade` animation from `globals.css`, same pattern as `PostDetailClient.jsx` lines 150-170)

**Checkpoint**: US2/US3/US4 complete — 所有活動留言通知可獨立測試驗證，scroll-to-comment 在活動頁面正常運作

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: E2E 驗證、type-check、lint

- [x] T016 [P] E2E test for full notification flow (comment → notification appears → bell badge unread count update → toast notification appearance → click notification → scroll + highlight) covering both post and event pages (FR-012 integration verification), verify notification appears within 30s (SC-001) in `specs/015-comment-notifications/tests/e2e/comment-notifications.spec.js`
- [x] T017 Run `npm run type-check` and `npm run lint` — fix all errors/warnings, add new words to `cspell.json` if needed, run IDE `getDiagnostics` and resolve all Warning/Hint/Error items

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (rules must allow new types) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (needs `MESSAGE_BUILDERS`, `fetchDistinctCommentAuthors`)
- **US2/US3/US4 (Phase 4)**: Depends on Phase 2 (needs `MESSAGE_BUILDERS`, `fetchDistinctCommentAuthors`, `getNotificationLink`)
- **Polish (Phase 5)**: Depends on Phase 3 + Phase 4

### User Story Dependencies

- **US1 (Phase 3)**: Independent — only touches post notification code
- **US2/US3/US4 (Phase 4)**: Independent from US1 — only touches event notification code
- **US1 and US2/US3/US4 CAN run in parallel** after Phase 2 completes (no shared source files)

### Within Each Phase

- Tests MUST be written and FAIL before implementation (TDD RED phase)
- Implementation makes tests pass (TDD GREEN phase)
- Tasks within same file are sequential; tasks in different files can be parallel

### Parallel Opportunities

- Phase 2: T002 ∥ T003 (test files), then T004 + T005 (different source files)
- Phase 3: T006 ∥ T007 (test files), then T008 → T009
- Phase 4: T010 ∥ T011 (test files), then T012 → T013 → T014 → T015 (T013/T015 same file)
- **Phase 3 ∥ Phase 4**: Can run entirely in parallel after Phase 2

---

## Parallel Example: Phase 3 + Phase 4

```text
# After Phase 2 completes, launch both story phases in parallel:

# Stream A — US1 (Post Comment Reply)
T006: Unit test for notifyPostCommentReply
T007: Integration test for PostDetailClient trigger
T008: Implement notifyPostCommentReply
T009: Add trigger in PostDetailClient

# Stream B — US2/US3/US4 (Event Comment Notifications)
T010: Unit test for notifyEventNewComment dedup
T011: Integration test for CommentSection callback
T012: Implement notifyEventNewComment
T013: Add onCommentAdded to CommentSection
T014: Implement handler in eventDetailClient
T015: Add scroll-to-comment to CommentSection
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Firestore rules
2. Complete Phase 2: notification-helpers + fetchDistinctCommentAuthors
3. Complete Phase 3: US1 — 文章跟帖通知
4. **STOP and VALIDATE**: 文章留言跟帖通知可獨立運作
5. Deploy/demo if ready

### Full Delivery

1. Setup + Foundational → Foundation ready
2. US1 (文章跟帖) → Test independently → MVP
3. US2/US3/US4 (活動留言通知) → Test independently → Full feature
4. Polish → E2E + type-check + lint → Release ready
