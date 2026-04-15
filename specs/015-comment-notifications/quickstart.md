# Quickstart: Comment Notifications

**Feature Branch**: `015-comment-notifications`
**Date**: 2026-04-14

---

## Overview

在既有通知系統上擴充四種留言通知：文章跟帖、活動主揪人、活動參加者、活動跟帖。不新增 collection 或 UI 元件，僅擴充 service layer 函式、更新 helpers、修改觸發點與 Firestore rules。

---

## Modified Files

| File                                        | Changes                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/lib/notification-helpers.js`           | 新增 4 個 MESSAGE_BUILDERS、更新 NotificationType typedef、更新 `getNotificationLink()`                 |
| `src/lib/firebase-notifications.js`         | 新增 `notifyPostCommentReply()`、`notifyEventNewComment()`、共用 helper `fetchDistinctCommentAuthors()` |
| `src/app/posts/[id]/PostDetailClient.jsx`   | 在 comment submit 後新增 `notifyPostCommentReply()` 呼叫                                                |
| `src/components/CommentSection.jsx`         | 新增 `onCommentAdded` callback prop、scroll-to-comment 邏輯                                             |
| `src/app/events/[id]/eventDetailClient.jsx` | 提供 `onCommentAdded` callback 呼叫 `notifyEventNewComment()`、傳遞 `commentId` URL param               |
| `firestore.rules`                           | `type in [...]` 新增 4 個允許值                                                                         |

## New Files

無新增檔案。

---

## Key Patterns

### 1. Service Layer Functions

```js
// firebase-notifications.js

// 文章跟帖通知 — 通知曾留言者（排除 actor + author）
notifyPostCommentReply(postId, postTitle, postAuthorUid, commentId, actor);

// 活動留言通知 — 一次處理 host/participant/commenter 三種去重
notifyEventNewComment(eventId, eventTitle, hostUid, commentId, actor);

// 共用 helper — query comments subcollection 取得不重複 authorUid
fetchDistinctCommentAuthors(commentsCollectionRef);
```

### 2. Trigger Pattern (Fire-and-Forget)

```js
// PostDetailClient.jsx — 與既有 notifyPostNewComment 並行
notifyPostCommentReply(postId, title, authorUid, commentId, actor).catch((err) =>
  console.error('跟帖通知失敗:', err),
);

// eventDetailClient.jsx — 透過 CommentSection callback
const handleCommentAdded = (commentId) => {
  notifyEventNewComment(eventId, event.title, event.hostUid, commentId, actor).catch((err) =>
    console.error('活動留言通知失敗:', err),
  );
};
```

### 3. De-duplication (in notifyEventNewComment)

```js
const notifiedSet = new Set([actor.uid]); // 排除自己

// Priority 1: Host
if (!notifiedSet.has(hostUid)) {
  /* event_host_comment */ notifiedSet.add(hostUid);
}

// Priority 2: Participants
participants
  .filter((p) => !notifiedSet.has(p.uid))
  .forEach((p) => {
    /* event_participant_comment */ notifiedSet.add(p.uid);
  });

// Priority 3: Commenters
commentAuthors
  .filter((uid) => !notifiedSet.has(uid))
  .forEach((uid) => {
    /* event_comment_reply */ notifiedSet.add(uid);
  });
```

### 4. Scroll-to-Comment (Event Page)

```js
// CommentSection.jsx — 讀取 URL ?commentId= param
// 複製 PostDetailClient 的 scrollIntoView + commentHighlight 模式
// CSS animation 已存在於 globals.css（highlightFade）
```

---

## Testing Strategy

| 層級        | 範圍                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `notifyPostCommentReply`、`notifyEventNewComment` 去重邏輯、`buildNotificationMessage` 新類型、`getNotificationLink` 新類型 |
| Integration | CommentSection + onCommentAdded callback、PostDetailClient comment submit 觸發兩種通知                                      |
| E2E         | 完整流程：留言 → 通知出現 → 點擊導航 → scroll + highlight                                                                   |

---

## Firestore Rules Change

```diff
- && request.resource.data.type in ['event_modified', 'event_cancelled', 'post_new_comment']
+ && request.resource.data.type in [
+   'event_modified', 'event_cancelled', 'post_new_comment',
+   'post_comment_reply', 'event_host_comment',
+   'event_participant_comment', 'event_comment_reply'
+ ]
```
