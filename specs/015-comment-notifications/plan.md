# Implementation Plan: 留言通知擴充 (Comment Notifications)

**Branch**: `015-comment-notifications` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-comment-notifications/spec.md`

## Summary

在既有通知系統上新增四種留言通知類型（文章跟帖、活動主揪人、活動參加者、活動跟帖），實現跨身份去重，並在活動頁面新增 scroll-to-comment + highlight。不新增 Firestore collection、不新增 UI 元件，僅擴充 service layer 函式與修改觸發點。

## Technical Context

**Language/Version**: JavaScript (ES6+) with JSDoc + `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore)
**Storage**: Firestore — `notifications` collection (既有)、`comments` subcollection (既有)、`participants` subcollection (既有)
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web application
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 通知建立不阻塞留言 UI（fire-and-forget）；50 人活動留言通知 < 2s
**Constraints**: Firestore batch limit 500 ops；無 Cloud Functions（client-side notification creation）；Firestore client SDK 無 `select()` projection
**Scale/Scope**: 活動最多 50 位參加者；留言數量通常 < 100；7 種 notification types

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle             | Status | Notes                                                                            |
| --------------------- | ------ | -------------------------------------------------------------------------------- |
| I. SDD/TDD            | ✅     | Spec 已完成，plan 進行中，tasks 後續生成。TDD Red-Green-Refactor                 |
| II. Service Layer     | ✅     | 所有通知邏輯在 `src/lib/firebase-notifications.js`，UI 層僅呼叫 service function |
| III. UX & Consistency | ✅     | 正體中文訊息、複用既有通知 UI（鈴鐺、面板、toast、highlight）                    |
| IV. Performance       | ✅     | Batch write for multi-recipient；fire-and-forget 不阻塞 UI                       |
| V. Code Quality       | ✅     | JSDoc 完整、const 優先、CSS Modules 沿用                                         |
| VI. Modern Standards  | ✅     | JSDoc typedef、解構、no var、Airbnb formatting                                   |
| VII. Security         | ✅     | Firestore rules 驗證新 type、recipientUid ≠ actorUid                             |
| VIII. Agent Protocol  | ✅     | 修改前確認、不臆測                                                               |
| IX. Coding Iron Rules | ✅     | No logic in JSX、no eslint-disable、meaningful JSDoc                             |

**Post-Phase 1 Re-check**: ✅ 無違規。所有設計決策符合 constitution。

## Project Structure

### Documentation (this feature)

```text
specs/015-comment-notifications/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions & rationale
├── data-model.md        # Phase 1 output — entity changes & dedup matrix
├── quickstart.md        # Phase 1 output — implementation guide
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── notification-helpers.js   # ← MODIFY: typedef, MESSAGE_BUILDERS, getNotificationLink
│   ├── firebase-notifications.js # ← MODIFY: +notifyPostCommentReply, +notifyEventNewComment, +fetchDistinctCommentAuthors
│   └── firebase-comments.js      # (read only — addComment 回傳 commentId)
├── components/
│   └── CommentSection.jsx        # ← MODIFY: +onCommentAdded callback, +scroll-to-comment
├── app/
│   ├── posts/[id]/
│   │   └── PostDetailClient.jsx  # ← MODIFY: +notifyPostCommentReply 呼叫
│   └── events/[id]/
│       └── eventDetailClient.jsx # ← MODIFY: +onCommentAdded callback → notifyEventNewComment

firestore.rules                   # ← MODIFY: type whitelist 新增 4 值

specs/015-comment-notifications/tests/
├── unit/                         # notification-helpers, firebase-notifications (mocked)
├── integration/                  # CommentSection + callback, PostDetailClient trigger
└── e2e/                          # Full flow: comment → notification → click → scroll
```

**Structure Decision**: 純粹擴充既有檔案，不新增 source 檔案。測試按 testing trophy 分三層。

## Design Decisions

### D-001: 四種獨立 notification type（非單一 type + role 欄位）

每種通知類型對應獨立的 `MESSAGE_BUILDERS` key 和訊息文案。Firestore rules 直接以 `type in [...]` 驗證，無需額外欄位驗證。

### D-002: 單一 `notifyEventNewComment()` 處理三種活動通知

host/participant/commenter 三種接收者的去重必須跨組進行。集中在一個函式中用 `Set` 追蹤已分配 UID，按優先級順序分配，避免重複通知。

### D-003: CommentSection `onCommentAdded` callback 傳遞通知觸發

`useCommentMutations` hook 保持通用（只管 CRUD），通知觸發責任由 parent page 透過 callback 承擔。`eventDetailClient.jsx` 持有完整 event data（title、hostUid），可直接呼叫 service function。

### D-004: Thread participants 即時 query（非 denormalized array）

每次留言時 query comments subcollection 取得不重複 authorUid。MVP 思維，避免維護 denormalized 欄位的寫入複雜度。適用於預期的 comment 規模（< 100）。

### D-005: Scroll-to-comment 邏輯放在 CommentSection

Event 頁面的 scroll-to-comment 功能加在 `CommentSection` 元件（讀取 URL `?commentId=` param），使其可被任何包含 `CommentSection` 的頁面複用。CSS animation 已存在於 `globals.css`。

### D-006: `getNotificationLink` 統一以 commentId 區分導航行為

所有含 `commentId` 的通知類型（7 種中的 5 種）都產生 `?commentId=xxx` URL param。`event_modified` 和 `event_cancelled` 維持原樣（無 commentId）。

## Service Layer API

### New Functions (`firebase-notifications.js`)

```js
/**
 * 查詢 comments subcollection 中所有不重複的 authorUid。
 * @param {import('firebase/firestore').CollectionReference} commentsRef - comments collection reference。
 * @returns {Promise<string[]>} 不重複的 authorUid 陣列。
 */
async function fetchDistinctCommentAuthors(commentsRef) {}

/**
 * 文章跟帖通知：通知曾在該文章留言的使用者（排除留言者本人與文章作者）。
 * @param {string} postId - 文章 ID。
 * @param {string} postTitle - 文章標題。
 * @param {string} postAuthorUid - 文章作者 UID（排除對象）。
 * @param {string} commentId - 新留言 ID。
 * @param {Actor} actor - 留言者。
 * @returns {Promise<void>}
 */
async function notifyPostCommentReply(postId, postTitle, postAuthorUid, commentId, actor) {}

/**
 * 活動留言通知：一次處理主揪人/參加者/跟帖者三種通知，含去重。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {string} hostUid - 主揪人 UID。
 * @param {string} commentId - 新留言 ID。
 * @param {Actor} actor - 留言者。
 * @returns {Promise<void>}
 */
async function notifyEventNewComment(eventId, eventTitle, hostUid, commentId, actor) {}
```

### Updated Functions (`notification-helpers.js`)

```js
// MESSAGE_BUILDERS 新增 4 entry
// NotificationType typedef 新增 4 值
// getNotificationLink() 更新：event comment types 加上 ?commentId=
```

### Updated Props (`CommentSection.jsx`)

```js
/**
 * @param {object} props
 * @param {string} props.eventId - 活動 ID。
 * @param {((commentId: string) => void)} [props.onCommentAdded] - 新留言建立後的回呼。
 */
```

## Complexity Tracking

> 無 Constitution 違規需要 justify。

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | —          | —                                    |
