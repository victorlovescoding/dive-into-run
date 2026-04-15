# Data Model: Posts 頁面 UI 重新設計

**Branch**: `019-posts-ui-refactor` | **Date**: 2026-04-15

> 此文件記錄 UI 層使用的資料結構，供元件設計參考。

## Firestore Schema

### Collection: `posts/{postId}`

| Field           | Type      | Description                  | 備註                              |
| --------------- | --------- | ---------------------------- | --------------------------------- |
| `title`         | string    | 文章標題（max 50 chars）     |                                   |
| `content`       | string    | 文章內容（max 10,000 chars） |                                   |
| `authorUid`     | string    | 作者 UID                     |                                   |
| `authorImgURL`  | string?   | 作者頭像 URL                 |                                   |
| `authorName`    | string    | 作者顯示名稱                 | **本次補存**（`createPost` 遺漏） |
| `postAt`        | Timestamp | 發文時間（serverTimestamp）  |                                   |
| `likesCount`    | number    | 按讚數（default 0）          |                                   |
| `commentsCount` | number    | 留言數（default 0）          |                                   |

### Subcollection: `posts/{postId}/likes/{uid}`

| Field       | Type      | Description |
| ----------- | --------- | ----------- |
| `createdAt` | Timestamp | 按讚時間    |

### Subcollection: `posts/{postId}/comments/{commentId}`

| Field          | Type      | Description      |
| -------------- | --------- | ---------------- |
| `authorUid`    | string    | 留言作者 UID     |
| `authorName`   | string?   | 留言作者顯示名稱 |
| `authorImgURL` | string?   | 留言作者頭像 URL |
| `comment`      | string    | 留言內容         |
| `createdAt`    | Timestamp | 留言時間         |

## UI-Layer Enriched Types

以下為前端 state 中使用的 enriched 資料型別，在 Firestore 原始資料上加入 UI flags。

### EnrichedPost（列表頁 state）

```js
/**
 * @typedef {object} EnrichedPost
 * @property {string} id - 文章 ID。
 * @property {string} title - 文章標題。
 * @property {string} content - 文章完整內容。
 * @property {string} authorUid - 作者 UID。
 * @property {string} [authorImgURL] - 作者頭像 URL。
 * @property {string} [authorName] - 作者顯示名稱。
 * @property {import('firebase/firestore').Timestamp} [postAt] - 發文時間。
 * @property {number} likesCount - 按讚數。
 * @property {number} commentsCount - 留言數。
 * @property {boolean} liked - 當前使用者是否已按讚（UI flag）。
 * @property {boolean} isAuthor - 當前使用者是否為作者（UI flag）。
 */
```

### EnrichedComment（詳文頁 state）

```js
/**
 * @typedef {object} EnrichedComment
 * @property {string} id - 留言 ID。
 * @property {string} authorUid - 留言作者 UID。
 * @property {string} [authorName] - 留言作者顯示名稱。
 * @property {string} [authorImgURL] - 留言作者頭像 URL。
 * @property {string} comment - 留言內容。
 * @property {import('firebase/firestore').Timestamp} [createdAt] - 留言時間。
 * @property {boolean} isAuthor - 當前使用者是否為留言作者（UI flag）。
 */
```

## `authorName` 補存方案

`createPost` 原本遺漏 `authorName`（`addComment` 和 `createEvent` 都有存）。本次一併修正。

### 修正內容

1. **`createPost` 補存**: `authorName: user.name || '匿名使用者'`（比照 `addComment`）
2. **Migration script**: 用 `authorUid` 查 `users` collection 回填既有文章的 `authorName`
3. **PostCard fallback**: `post.authorName ?? '跑者'`（防禦性）
