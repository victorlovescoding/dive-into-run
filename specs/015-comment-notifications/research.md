# Research: Comment Notifications

**Feature Branch**: `015-comment-notifications`
**Date**: 2026-04-14

---

## R-001: Notification Type Naming Convention

**Decision**: 新增四種通知類型，遵循 `entity_role_action` 命名模式：

| Type                        | 訊息模板                                | 接收者     |
| --------------------------- | --------------------------------------- | ---------- |
| `post_comment_reply`        | 你留言過的文章『{title}』有一則新的留言 | 文章跟帖者 |
| `event_host_comment`        | 你主辦的活動『{title}』有一則新的留言   | 活動主揪人 |
| `event_participant_comment` | 你參加的活動『{title}』有一則新的留言   | 活動參加者 |
| `event_comment_reply`       | 你留言過的活動『{title}』有一則新的留言 | 活動跟帖者 |

**Rationale**: 每種類型對應一個去重優先級和一則獨立訊息，型別名稱可直接對應 `MESSAGE_BUILDERS` key，與既有 `post_new_comment`、`event_modified`、`event_cancelled` 格式一致。

**Alternatives considered**:

- 單一 `comment_notification` type + `role` 欄位 → 拒絕：增加 query 複雜度，不利 Firestore 索引
- `event_new_comment` 統一型別 → 拒絕：無法在 `MESSAGE_BUILDERS` 中區分訊息文案

---

## R-002: Thread Participants (留言跟帖者) 查詢策略

**Decision**: 在 service layer 中 query comments subcollection，client-side 去重 `authorUid`。

**Rationale**:

- Firestore client SDK 不支援 `select()` projection 或 `DISTINCT`
- 每則 comment doc 很小（< 500 bytes），即使 100 則留言也僅 ~50KB
- Spec 的 scale 預估（50 人活動）表示留言數量合理
- MVP 思維：避免維護 denormalized `commentAuthors` array

**Alternatives considered**:

- 在 post/event document 上維護 `commentAuthors: string[]` → 拒絕：每次新增/刪除留言都要 atomic update parent，增加寫入複雜度且需回填既有資料
- Cloud Functions 背景觸發 → 拒絕：目前架構無 Cloud Functions，不在 scope 內

**Implementation**: 新增 `fetchDistinctCommentAuthors(collectionPath)` 共用 helper。

---

## R-003: De-duplication (去重) 策略

**Decision**: 在 notification creation function 內以 Set 追蹤已分配接收者，按優先級順序分配：

```
Priority Order:
1. post_new_comment (既有，post author) — 不在此次新增範圍
2. event_host_comment (host)
3. event_participant_comment (participant)
4. post_comment_reply / event_comment_reply (commenter)
```

**Rationale**:

- Post 跟帖：排除 actor.uid + postAuthorUid（已有 `post_new_comment`）
- Event 通知：單一函式 `notifyEventNewComment` 內依序分配 host → participants → commenters，每分配一組就將 UIDs 加入 `notifiedSet`
- 保證每位使用者對同一則留言最多收到一則通知

**Alternatives considered**:

- 分開呼叫三個獨立函式 → 拒絕：去重需要跨函式狀態，不如集中處理
- Firestore 唯一約束防重複 → Firestore 無 unique constraint

---

## R-004: Notification Trigger 時機與位置

**Decision**:

| 場景       | 觸發位置                                                | 呼叫函式                   |
| ---------- | ------------------------------------------------------- | -------------------------- |
| Post 跟帖  | `PostDetailClient.jsx`（既有位置）                      | `notifyPostCommentReply()` |
| Event 留言 | `CommentSection.jsx` callback → `eventDetailClient.jsx` | `notifyEventNewComment()`  |

**Rationale**:

- Post：`PostDetailClient.jsx` 已在 comment submit 後呼叫 `notifyPostNewComment()`，新增一行 `notifyPostCommentReply()` 即可
- Event：`CommentSection` 目前只接收 `eventId`，不持有 event data。新增 `onCommentAdded(commentId)` callback prop，由 `eventDetailClient.jsx`（持有完整 event data）提供 callback 呼叫 notification service
- 保持 fire-and-forget 模式（`.catch()` 不阻塞 UI）

**Alternatives considered**:

- 在 `useCommentMutations` 內直接呼叫 → 拒絕：hook 需要 event title/hostUid，破壞 hook 通用性
- 在 `firebase-comments.js addComment()` 內觸發 → 拒絕：違反 service layer 單一職責（comment CRUD vs notification）

---

## R-005: Event Detail Scroll-to-Comment + Highlight

**Decision**: 複製 `PostDetailClient.jsx` 的 scroll-to-comment 模式到 event 頁面。

**Existing pattern** (`PostDetailClient.jsx`):

1. 從 URL 讀取 `?commentId=xxx`
2. `setTimeout(300ms)` 等待 DOM 載入
3. `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`
4. 加上 `commentHighlight` CSS class（`globals.css` 已定義 `highlightFade` animation）

**Implementation**:

- `getNotificationLink()` 更新：所有含 `commentId` 的新類型都產生 `?commentId=xxx` URL param
- `CommentSection` 或 `eventDetailClient.jsx` 讀取 `commentId` param 並執行 scroll + highlight
- 需確認 `CommentCard` 是否有 `id` 屬性（可能需新增 `id={comment.id}` 到外層元素）

**Rationale**: 不需新增任何 CSS（globals.css 已有 `highlightFade` animation），只需在 event 頁面複製 JS 邏輯。

---

## R-006: Firestore Security Rules 更新

**Decision**: 在 `firestore.rules` line 219 的 `type in [...]` 中新增四個類型。

**Current rule**:

```
request.resource.data.type in ['event_modified', 'event_cancelled', 'post_new_comment']
```

**Updated rule**:

```
request.resource.data.type in [
  'event_modified', 'event_cancelled', 'post_new_comment',
  'post_comment_reply', 'event_host_comment',
  'event_participant_comment', 'event_comment_reply'
]
```

**Rationale**: Client-side notification creation 需要 security rules 允許新類型，否則 `addDoc`/`batch.set` 會被 Firestore 拒絕。

---

## R-007: Batch Write 大小限制

**Decision**: 使用 `writeBatch`，單一 batch 上限 500 operations。

**Rationale**:

- Spec 預估最大場景：50 位參加者 + 若干跟帖者 ≈ < 100 notifications
- 遠低於 500 上限，無需 chunk 處理
- 與既有 `notifyEventModified` 使用相同 batch 模式

**Alternatives considered**:

- 個別 `addDoc` 呼叫 → 拒絕：非 atomic，且 N 次 write 比 1 次 batch 慢
- `Promise.all` + `addDoc` → 拒絕：不 atomic 且併發 write 可能觸發 rate limit
