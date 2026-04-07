# Data Model: Member Activity Dashboard

**Branch**: `007-member-dashboard` | **Date**: 2026-04-07

## Existing Entities (Read-Only)

本功能不新增 Firestore collections，僅讀取以下現有資料。

### Event (`events/{eventId}`)

| Field             | Type      | Description             |
| ----------------- | --------- | ----------------------- |
| id                | string    | Firestore doc ID        |
| title             | string    | 活動標題                |
| time              | Timestamp | 活動舉辦時間 (排序依據) |
| location          | string    | 活動地點                |
| city              | string    | 縣市                    |
| district          | string    | 行政區                  |
| hostUid           | string    | 主辦者 UID              |
| hostName          | string    | 主辦者名稱              |
| participantsCount | number    | 目前報名人數            |
| maxParticipants   | number    | 人數上限                |
| remainingSeats    | number    | 剩餘名額                |

**查詢路徑**: `where('hostUid', '==', uid)` — 使用者主辦的活動

### Participant (`events/{eventId}/participants/{uid}`)

| Field    | Type      | Description |
| -------- | --------- | ----------- |
| uid      | string    | 參加者 UID  |
| name     | string    | 參加者名稱  |
| photoURL | string    | 參加者頭像  |
| eventId  | string    | 所屬活動 ID |
| joinedAt | Timestamp | 報名時間    |

**查詢路徑**: `collectionGroup('participants').where('uid', '==', uid)` — 使用者參加的活動 IDs

### Post (`posts/{postId}`)

| Field         | Type      | Description         |
| ------------- | --------- | ------------------- |
| id            | string    | Firestore doc ID    |
| authorUid     | string    | 作者 UID            |
| title         | string    | 文章標題            |
| content       | string    | 文章內容            |
| postAt        | Timestamp | 發文時間 (排序依據) |
| likesCount    | number    | 按讚數              |
| commentsCount | number    | 留言數              |

**查詢路徑**: `where('authorUid', '==', uid).orderBy('postAt', 'desc')` — 使用者發表的文章

### Post Comment (`posts/{postId}/comments/{commentId}`)

| Field        | Type      | Description                                        |
| ------------ | --------- | -------------------------------------------------- |
| id           | string    | Firestore doc ID                                   |
| authorUid    | string    | 留言者 UID                                         |
| authorName   | string    | 留言者名稱                                         |
| authorImgURL | string    | 留言者頭像                                         |
| comment      | string    | 留言內容 (注意：欄位名是 `comment` 不是 `content`) |
| createdAt    | Timestamp | 留言時間 (排序依據)                                |

**查詢路徑**: `collectionGroup('comments').where('authorUid', '==', uid).orderBy('createdAt', 'desc')` — 使用者的留言 (需過濾 parent collection = `posts`)

## Application-Level Types (JSDoc)

以下型別定義於 `src/lib/firebase-member.js`，僅存在 JS runtime，不對應 Firestore document。

### MyEventItem

```js
/**
 * @typedef {object} MyEventItem
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {import('firebase/firestore').Timestamp} time - 活動舉辦時間。
 * @property {string} location - 活動地點。
 * @property {string} city - 縣市。
 * @property {number} participantsCount - 目前報名人數。
 * @property {number} maxParticipants - 人數上限。
 * @property {string} hostUid - 主辦者 UID。
 * @property {boolean} isHost - 是否為主辦者。
 * @property {boolean} isUpcoming - 是否即將到來。
 */
```

### MyCommentItem

```js
/**
 * @typedef {object} MyCommentItem
 * @property {string} id - 留言 ID。
 * @property {string} postId - 所屬文章 ID。
 * @property {string} postTitle - 所屬文章標題。
 * @property {string} comment - 留言內容。
 * @property {import('firebase/firestore').Timestamp} createdAt - 留言時間。
 */
```

## Relationships

```
User (uid)
  ├── 1:N → events (hostUid = uid)           → Tab 1 "我的活動" (hosted)
  ├── 1:N → participants (uid = uid)          → Tab 1 "我的活動" (joined)
  ├── 1:N → posts (authorUid = uid)           → Tab 2 "我的文章"
  └── 1:N → post comments (authorUid = uid)   → Tab 3 "我的留言"
```

## Required Firestore Indexes

| Collection   | Scope            | Fields                        | Purpose              |
| ------------ | ---------------- | ----------------------------- | -------------------- |
| participants | COLLECTION_GROUP | uid ASC                       | 查詢使用者參加的活動 |
| comments     | COLLECTION_GROUP | authorUid ASC, createdAt DESC | 查詢使用者的留言     |
| posts        | COLLECTION       | authorUid ASC, postAt DESC    | 查詢使用者的文章     |
