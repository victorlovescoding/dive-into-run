# Data Model: 005-event-comments

## Entities

### Comment（留言）

**Collection path**: `events/{eventId}/comments/{commentId}`

| Field            | Type              | Required | Default           | Description                      |
| ---------------- | ----------------- | -------- | ----------------- | -------------------------------- |
| `authorUid`      | string            | YES      | —                 | 留言者 UID。                     |
| `authorName`     | string            | YES      | —                 | 留言者名稱（寫入時快照）。       |
| `authorPhotoURL` | string            | YES      | `''`              | 留言者大頭貼 URL（寫入時快照）。 |
| `content`        | string            | YES      | —                 | 留言文字內容，上限 500 字。      |
| `createdAt`      | Timestamp         | YES      | serverTimestamp() | 建立時間。                       |
| `updatedAt`      | Timestamp \| null | YES      | null              | 最後編輯時間，未編輯為 null。    |
| `isEdited`       | boolean           | YES      | false             | 是否曾被編輯。                   |

**Validation rules**:

- `content.trim().length > 0 && content.length <= 500`
- `authorUid` 必須等於 auth.uid（Firestore security rule）
- `createdAt` 必須使用 serverTimestamp()

**Query patterns**:

- 列表（最新在前）: `orderBy('createdAt', 'desc'), limit(15)`
- 分頁: `orderBy('createdAt', 'desc'), startAfter(cursor), limit(15)`
- 單筆: `getDoc(doc(db, 'events', eventId, 'comments', commentId))`

**Indexes**:

- `createdAt DESC`（可能需手動建 composite index）

---

### CommentHistory（編輯記錄）

**Collection path**: `events/{eventId}/comments/{commentId}/history/{historyId}`

| Field      | Type      | Required | Default           | Description                        |
| ---------- | --------- | -------- | ----------------- | ---------------------------------- |
| `content`  | string    | YES      | —                 | 該版本的留言內容（編輯前的快照）。 |
| `editedAt` | Timestamp | YES      | serverTimestamp() | 該版本被取代的時間。               |

**Validation rules**:

- `content` 不可為空
- `editedAt` 必須使用 serverTimestamp()

**Query patterns**:

- 完整歷史: `orderBy('editedAt', 'asc')`（不分頁）

---

## Relationships

```
Event (既有)
  └─ has many → Comment
                  └─ has many → CommentHistory
```

- Event 1:N Comment（透過 subcollection）
- Comment 1:N CommentHistory（透過 subcollection）

## State Transitions

### Comment Lifecycle

```
[Created]
  ↓ addComment()
[Active] ──── isEdited: false, updatedAt: null
  ↓ updateComment()
[Edited] ──── isEdited: true, updatedAt: Timestamp
  ↓ updateComment() (可多次)
[Edited] ──── isEdited: true, updatedAt: updated Timestamp
  ↓ deleteComment()
[Deleted] ──── document removed + all history removed
```

### Cascade Delete

刪除活動時（`deleteEvent`）需要 cascade：

1. 查詢 `events/{eventId}/comments` 所有留言
2. 對每則留言查詢 `history` 子集合
3. writeBatch 全部刪除（留意 batch 500 ops 上限）
