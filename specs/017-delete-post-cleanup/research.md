# Research: deletePost Subcollection Cleanup

**Branch**: `017-delete-post-cleanup` | **Date**: 2026-04-15

## Research Tasks

### R1: deleteEvent 參考模式分析

**Decision**: 完整對齊 `deleteEvent`（`src/lib/firebase-events.js:572-617`）的 writeBatch 模式。

**Rationale**:

- `deleteEvent` 是專案內已驗證的 subcollection cleanup 模式
- 使用 `writeBatch` 確保原子性——要嘛全刪、要嘛全不刪
- 包含存在性檢查（`getDoc` + `exists()`）、batch 清理、回傳 `{ ok: true }`
- spec FR-003 明確要求對齊

**Alternatives considered**:

- `runTransaction`：不需要讀取-修改-寫入語義，`writeBatch` 更適合純刪除場景
- 逐一 `deleteDoc`：沒有原子性保證，中途失敗會留下不一致狀態
- Cloud Functions `onDelete` trigger：需額外部署基礎設施，超出 MVP 範圍

### R2: Posts 的 Subcollection 結構

**Decision**: Posts 有兩個 subcollection 需要清理：`likes` 和 `comments`。

**Rationale**:

- `posts/{postId}/likes/{uid}` — 按讚紀錄，document ID 就是 uid
- `posts/{postId}/comments/{commentId}` — 留言紀錄，auto-generated ID
- 與 events 不同的是，posts comments **沒有** 巢狀 `history` subcollection
- 因此比 deleteEvent 更簡單——不需要遞迴查詢巢狀子集合

**Alternatives considered**: N/A — 結構由 Firestore rules 和現有程式碼決定。

### R3: writeBatch 500 筆上限

**Decision**: 使用 single-batch，在程式碼加 NOTE 註記上限。

**Rationale**:

- spec 明確確認「單篇文章的 likes + comments 合計不預期超過 500 筆」
- `deleteEvent` 也用相同策略，加上 NOTE 註記
- 未來若超過，改用分批 commit（但目前不需要）

**Alternatives considered**:

- 分批 commit（chunked batches）：目前不需要，屬過度設計
- 用 `BulkWriter`：Admin SDK only，client-side 不可用

### R4: 現有 import 狀態

**Decision**: 需新增 `writeBatch` import。

**Rationale**:

- `firebase-posts.js` 現有 imports：`addDoc`, `updateDoc`, `collection`, `serverTimestamp`, `limit`, `query`, `orderBy`, `doc`, `getDoc`, `getDocs`, `runTransaction`, `increment`, `collectionGroup`, `where`, `deleteDoc`, `startAfter`, `documentId`
- 已有 `getDoc`、`getDocs`、`collection`、`doc`（存在性檢查和 subcollection 查詢所需）
- 缺少 `writeBatch`，需加入 import
- `deleteDoc` 在新實作中不再被 `deletePost` 直接使用，但其他函式仍使用（如 `deleteComment`），保留

### R5: UI 呼叫端錯誤處理驗證

**Decision**: UI 不需修改，現有 try-catch 可以接住新增的 throw。

**Rationale**:

- `src/app/posts/page.jsx:269-281`：try-catch + `showToast('刪除文章失敗，請稍後再試', 'error')`
- `src/app/posts/[id]/PostDetailClient.jsx:234-244`：同樣有 try-catch + toast
- 新版 `deletePost` 加入 `throw new Error('文章不存在')` 後，會被這兩處 catch 接住並顯示 toast
- 符合 spec FR-004「維持現有使用者體驗不變」

**Alternatives considered**: N/A — 已驗證。

### R6: Firestore Security Rules — cascade delete 權限

**Decision**: 必須修改 `firestore.rules`，為 `likes` 和 `comments` subcollection 加上「文章作者可刪」的條件。

**Rationale**:

- 現行 `likes/{uid}` delete rule 只允許按讚者本人刪除（`request.auth.uid == uid`）
- 現行 `comments/{commentId}` delete rule 只允許留言者本人刪除（`request.auth.uid == resource.data.authorUid`）
- client-side `writeBatch` 刪除其他使用者的 likes/comments 會被 security rules 擋掉
- `deleteEvent` 的 rules 已經有此模式：participants 和 comments 都加了 `|| hostUid == request.auth.uid` 條件

**Changes needed**:

1. `likes/{uid}`（第 55-58 行 nested match）：`allow delete` 加上 `|| request.auth.uid == get(.../posts/$(postId)).data.authorUid`
2. `comments/{commentId}`（第 72-82 行）：`allow delete` 加上同樣的文章作者條件
3. collectionGroup `likes` rule（第 67-70 行）：維持不變——cascade delete 走 nested match 路徑，不經過 collectionGroup 全域規則

**Alternatives considered**:

- Cloud Functions（server-side Admin SDK 繞過 rules）：需額外基礎設施，超出 MVP
- 不改 rules 只改 code：client-side batch delete 會被 rules 擋，不可行
