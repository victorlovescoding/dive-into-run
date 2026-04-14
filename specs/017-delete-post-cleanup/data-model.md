# Data Model: deletePost Subcollection Cleanup

**Branch**: `017-delete-post-cleanup` | **Date**: 2026-04-15

## Entities

### Post（文章主體）

**Collection**: `posts/{postId}`

| Field           | Type        | Description             |
| --------------- | ----------- | ----------------------- |
| `authorUid`     | `string`    | 作者 UID                |
| `title`         | `string`    | 文章標題（≤120 chars）  |
| `content`       | `string`    | 文章內容（≤5000 chars） |
| `authorImgURL`  | `string?`   | 作者大頭貼 URL          |
| `postAt`        | `Timestamp` | 發文時間                |
| `likesCount`    | `number`    | 按讚數                  |
| `commentsCount` | `number`    | 留言數                  |

### Like（按讚紀錄）

**Collection**: `posts/{postId}/likes/{uid}`

| Field       | Type        | Description |
| ----------- | ----------- | ----------- |
| `uid`       | `string`    | 按讚者 UID  |
| `postId`    | `string`    | 所屬文章 ID |
| `createdAt` | `Timestamp` | 按讚時間    |

**Note**: Document ID 就是 `uid`，一個使用者對一篇文章只能有一筆 like。

### Comment（留言）

**Collection**: `posts/{postId}/comments/{commentId}`

| Field          | Type        | Description            |
| -------------- | ----------- | ---------------------- |
| `authorUid`    | `string`    | 留言者 UID             |
| `authorName`   | `string`    | 留言者名稱             |
| `authorImgURL` | `string`    | 留言者大頭貼 URL       |
| `comment`      | `string`    | 留言內容（≤500 chars） |
| `createdAt`    | `Timestamp` | 留言時間               |

## Firestore Rules Changes

### `likes/{uid}` — 加上文章作者 cascade delete 權限

```diff
  match /likes/{uid} {
    allow read: if isSignedIn();
-   allow create, delete: if isSignedIn() && request.auth.uid == uid;
+   allow create: if isSignedIn() && request.auth.uid == uid;
+   // 本人可刪自己的 like，或文章作者 deletePost cascade
+   allow delete: if isSignedIn() && (
+     request.auth.uid == uid
+     || request.auth.uid == get(/databases/$(database)/documents/posts/$(postId)).data.authorUid
+   );
  }
```

### `comments/{commentId}` — 加上文章作者 cascade delete 權限

```diff
  // 留言作者刪自己留言，或文章作者 deletePost cascade
- allow update, delete: if isSignedIn()
-   && request.auth.uid == resource.data.authorUid;
+ allow update: if isSignedIn()
+   && request.auth.uid == resource.data.authorUid;
+ allow delete: if isSignedIn() && (
+   request.auth.uid == resource.data.authorUid
+   || request.auth.uid == get(/databases/$(database)/documents/posts/$(postId)).data.authorUid
+ );
```

### collectionGroup `likes` rule — 不變

collectionGroup 全域規則（第 67-70 行）維持不變。cascade delete 走 nested match 路徑（`posts/{postId}/likes/{uid}`），不經過 collectionGroup 規則。

## Deletion Cascade

```
deletePost(postId)
  │
  ├─ 1. getDoc(posts/{postId}) → 存在性檢查
  │
  ├─ 2. getDocs(posts/{postId}/likes) → fetch 所有 like docs
  │
  ├─ 3. getDocs(posts/{postId}/comments) → fetch 所有 comment docs
  │
  ├─ 4. writeBatch:
  │     ├─ batch.delete(每個 like doc ref)
  │     ├─ batch.delete(每個 comment doc ref)
  │     └─ batch.delete(post doc ref)
  │
  └─ 5. batch.commit() → 原子性刪除
```

**Batch 上限**: 500 筆。目前 likes + comments + 1 (post 本身) 不預期超過此限制。若未來超過需改用分批 commit。

## State Transitions

| 狀態                          | 觸發                      | 結果                                                  |
| ----------------------------- | ------------------------- | ----------------------------------------------------- |
| Post 存在 + 有 likes/comments | `deletePost(postId)` 成功 | Post、所有 likes、所有 comments 全部從 Firestore 移除 |
| Post 存在 + 無 likes/comments | `deletePost(postId)` 成功 | 僅 Post 被移除（subcollection 查詢回空陣列）          |
| Post 不存在                   | `deletePost(postId)`      | 拋出 `Error('文章不存在')`                            |
| `postId` 為空                 | `deletePost(postId)`      | 拋出 `Error('deletePost: postId is required')`        |
