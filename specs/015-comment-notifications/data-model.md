# Data Model: Comment Notifications

**Feature Branch**: `015-comment-notifications`
**Date**: 2026-04-14

---

## Existing Entities (Modified)

### Notification Document (`notifications/{notificationId}`)

**變更**: `type` 欄位新增四個值。其餘欄位結構不變。

```
notifications/{notificationId}
├── recipientUid: string          // 接收者 UID
├── type: string                  // 新增四種 ↓
│   ├── 'post_new_comment'           (既有)
│   ├── 'event_modified'             (既有)
│   ├── 'event_cancelled'            (既有)
│   ├── 'post_comment_reply'         (新增 — 文章跟帖)
│   ├── 'event_host_comment'         (新增 — 活動主揪人)
│   ├── 'event_participant_comment'  (新增 — 活動參加者)
│   └── 'event_comment_reply'        (新增 — 活動跟帖)
├── actorUid: string              // 觸發者 UID
├── actorName: string             // 觸發者名稱
├── actorPhotoURL: string         // 觸發者頭像
├── entityType: 'event' | 'post'  // 關聯實體類型
├── entityId: string              // 關聯實體 ID
├── entityTitle: string           // 關聯實體標題
├── commentId: string | null      // 留言 ID（所有新類型都有值）
├── message: string               // 完整通知訊息
├── read: boolean                 // 是否已讀 (default: false)
└── createdAt: Timestamp          // serverTimestamp()
```

### NotificationItem Typedef 更新

```js
/**
 * @typedef {object} NotificationItem
 * @property {string} id - Firestore document ID。
 * @property {string} recipientUid - 通知接收者 UID。
 * @property {NotificationType} type - 通知類型。
 * @property {string} actorUid - 觸發者 UID。
 * @property {string} actorName - 觸發者顯示名稱。
 * @property {string} actorPhotoURL - 觸發者頭像 URL。
 * @property {'event'|'post'} entityType - 關聯實體類型。
 * @property {string} entityId - 關聯實體 ID。
 * @property {string} entityTitle - 關聯實體標題。
 * @property {string|null} commentId - 留言 ID。
 * @property {string} message - 完整通知訊息文字。
 * @property {boolean} read - 是否已讀。
 * @property {import('firebase/firestore').Timestamp} createdAt - 建立時間。
 */

/**
 * @typedef {'event_modified'|'event_cancelled'|'post_new_comment'|'post_comment_reply'|'event_host_comment'|'event_participant_comment'|'event_comment_reply'} NotificationType
 */
```

---

## Existing Entities (Read Only — Not Modified)

### Post Comment (`posts/{postId}/comments/{commentId}`)

讀取 `authorUid` 用於判定文章跟帖者集合。

```
posts/{postId}/comments/{commentId}
├── authorUid: string       // ← 用於去重
├── authorName: string
├── authorImgURL: string
├── comment: string
└── createdAt: Timestamp
```

### Event Comment (`events/{eventId}/comments/{commentId}`)

讀取 `authorUid` 用於判定活動跟帖者集合。

```
events/{eventId}/comments/{commentId}
├── id: string
├── authorUid: string       // ← 用於去重
├── authorName: string
├── authorPhotoURL: string
├── content: string
├── createdAt: Timestamp
├── updatedAt: Timestamp | null
└── isEdited: boolean
```

### Event Participant (`events/{eventId}/participants/{uid}`)

讀取 participant UIDs 用於活動參加者通知。

```
events/{eventId}/participants/{uid}
├── uid: string             // ← 用於通知接收者
├── name: string
├── photoURL: string
├── eventId: string
└── joinedAt: Timestamp
```

### Event Document (`events/{eventId}`)

讀取 `hostUid` 用於主揪人通知。

```
events/{eventId}
├── hostUid: string         // ← 主揪人 UID
├── hostName: string
├── hostPhotoURL: string
├── title: string           // ← 通知訊息中的活動標題
└── ... (其他欄位略)
```

### Post Document (`posts/{postId}`)

讀取 `authorUid` 用於排除文章作者（已有 `post_new_comment`）。

```
posts/{postId}
├── authorUid: string       // ← 排除對象
├── title: string           // ← 通知訊息中的文章標題
└── ... (其他欄位略)
```

---

## New Entities

無新增 collection 或 document 結構。所有新通知使用既有 `notifications` collection schema。

---

## Message Templates

| Type                        | entityType | message                                    |
| --------------------------- | ---------- | ------------------------------------------ |
| `post_comment_reply`        | `post`     | `你留言過的文章『${title}』有一則新的留言` |
| `event_host_comment`        | `event`    | `你主辦的活動『${title}』有一則新的留言`   |
| `event_participant_comment` | `event`    | `你參加的活動『${title}』有一則新的留言`   |
| `event_comment_reply`       | `event`    | `你留言過的活動『${title}』有一則新的留言` |

---

## De-duplication Priority Matrix

同一則留言事件中，一位使用者可能同時符合多種身份。以下矩陣定義最終收到的通知類型：

| 身份組合                      | 最終通知類型                | 說明             |
| ----------------------------- | --------------------------- | ---------------- |
| Post author                   | `post_new_comment`(既有)    | 最高優先         |
| Post author + commenter       | `post_new_comment`          | author 優先      |
| Event host                    | `event_host_comment`        | host 優先        |
| Event host + commenter        | `event_host_comment`        | host 優先        |
| Event participant             | `event_participant_comment` | participant 優先 |
| Event participant + commenter | `event_participant_comment` | participant 優先 |
| Commenter only (post)         | `post_comment_reply`        | 跟帖             |
| Commenter only (event)        | `event_comment_reply`       | 跟帖             |
| Self (留言者本人)             | (none)                      | 不通知自己       |

---

## Navigation URLs

| Type                        | URL                                        |
| --------------------------- | ------------------------------------------ |
| `post_new_comment` (既有)   | `/posts/{entityId}?commentId={commentId}`  |
| `post_comment_reply`        | `/posts/{entityId}?commentId={commentId}`  |
| `event_host_comment`        | `/events/{entityId}?commentId={commentId}` |
| `event_participant_comment` | `/events/{entityId}?commentId={commentId}` |
| `event_comment_reply`       | `/events/{entityId}?commentId={commentId}` |
| `event_modified` (既有)     | `/events/{entityId}`                       |
| `event_cancelled` (既有)    | `/events/{entityId}`                       |
