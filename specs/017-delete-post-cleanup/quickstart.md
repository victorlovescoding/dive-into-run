# Quickstart: deletePost Subcollection Cleanup

**Branch**: `017-delete-post-cleanup` | **Date**: 2026-04-15

## What Changed

`deletePost` 從只刪除 parent document 升級為完整 cascade delete——一併清除 `likes` 和 `comments` subcollection，對齊 `deleteEvent` 的行為模式。

## Modified Files

1. **`src/lib/firebase-posts.js`** — `deletePost` 函式（service 邏輯）
2. **`firestore.rules`** — `likes`/`comments` subcollection 加上文章作者 cascade delete 權限

### firestore.rules Changes

`likes/{uid}` 和 `comments/{commentId}` 的 `allow delete` 條件加上 `|| request.auth.uid == post.authorUid`，對齊 `deleteEvent` 中 participants/comments 的 cascade delete 模式。詳見 [data-model.md](./data-model.md#firestore-rules-changes)。

## firebase-posts.js Changes

### Before

```js
export async function deletePost(postId) {
  await deleteDoc(doc(db, 'posts', postId));
}
```

### After（預期實作方向）

```js
export async function deletePost(postId) {
  if (!postId) throw new Error('deletePost: postId is required');

  const pid = String(postId);
  const postRef = doc(db, 'posts', pid);

  const snap = await getDoc(postRef);
  if (!snap.exists()) throw new Error('文章不存在');

  // --- 取得 likes 子集合所有文件 ---
  const likesSnap = await getDocs(collection(db, 'posts', pid, 'likes'));
  // --- 取得 comments 子集合所有文件 ---
  const commentsSnap = await getDocs(collection(db, 'posts', pid, 'comments'));

  // NOTE: Firestore writeBatch 上限 500 筆操作。
  // 目前單篇文章不預期超過此限制，若未來超過需改用分批 commit。
  const batch = writeBatch(db);

  likesSnap.docs.forEach((d) => batch.delete(d.ref));
  commentsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(postRef);

  await batch.commit();
  return { ok: true };
}
```

## API Change

| Aspect                 | Before          | After                                           |
| ---------------------- | --------------- | ----------------------------------------------- |
| Return type            | `Promise<void>` | `Promise<{ok: boolean}>`                        |
| Throws on missing post | No              | Yes (`Error('文章不存在')`)                     |
| Throws on empty postId | No              | Yes (`Error('deletePost: postId is required')`) |
| Subcollection cleanup  | None            | Deletes all likes + comments                    |

## UI Impact

**無**。兩個呼叫端（`page.jsx`、`PostDetailClient.jsx`）都有 try-catch + toast，新增的 throw 會被現有 catch 接住。回傳值 `{ ok: true }` 在呼叫端未使用但不影響現有邏輯。

## Testing

```bash
# 跑單元測試
npx vitest run specs/017-delete-post-cleanup/tests/unit/

# Lint + Type check
npm run lint:changed
npm run type-check:changed
```
