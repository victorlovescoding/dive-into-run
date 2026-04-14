# Data Model: Posts 頁面 Bug 修復 (A1 + A3 + A4)

**Branch**: `016-posts-bug-fix` | **Date**: 2026-04-14

## Overview

此 bug fix 不涉及 Firestore schema 或資料模型變更。以下僅記錄修復涉及的 client-side state 結構。

## Affected Client State

### Post Object (in `posts` state array — `page.jsx`)

| Field        | Type      | Description          |
| ------------ | --------- | -------------------- |
| `id`         | `string`  | 文章唯一識別碼       |
| `title`      | `string`  | 文章標題             |
| `content`    | `string`  | 文章內容             |
| `liked`      | `boolean` | 當前使用者是否已按讚 |
| `likesCount` | `number`  | 總讚數               |
| `isAuthor`   | `boolean` | 當前使用者是否為作者 |

**A1 影響**: `posts.find()` 可能回傳 `undefined`，需 guard。
**A4 影響**: `liked` 和 `likesCount` 在 optimistic update 失敗時需還原至操作前的值。

### PostDetailClient State (affected by A3)

| State              | Before Fix                       | After Fix |
| ------------------ | -------------------------------- | --------- |
| `commentEditing`   | ✅ 保留 — 存放正在編輯的留言物件 | 不變      |
| `isCommentEditing` | ❌ 移除 — value 從未被讀取       | 刪除      |
| `isComposeEditing` | ✅ 保留 — 控制文章編輯模式       | 不變      |

## No Schema Changes

- 不新增/修改 Firestore collections 或 documents
- 不變更任何 service layer function signatures
- 不影響 API contracts
