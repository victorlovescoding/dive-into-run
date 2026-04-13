# Data Model: 通知系統 (Notification System)

**Branch**: `014-notification-system` | **Date**: 2026-04-13

---

## Entities

### Notification（通知）

**Collection**: `notifications/{notificationId}`

| Field           | Type             | Required | Description                                                                 |
| --------------- | ---------------- | -------- | --------------------------------------------------------------------------- |
| `recipientUid`  | `string`         | ✅       | 通知接收者的 UID                                                            |
| `type`          | `string`         | ✅       | 通知類型：`'event_modified'` \| `'event_cancelled'` \| `'post_new_comment'` |
| `actorUid`      | `string`         | ✅       | 觸發者 UID（修改活動的主揪或留言者）                                        |
| `actorName`     | `string`         | ✅       | 觸發者顯示名稱（建立時快照）                                                |
| `actorPhotoURL` | `string`         | ✅       | 觸發者頭像 URL（建立時快照）                                                |
| `entityType`    | `string`         | ✅       | 關聯實體類型：`'event'` \| `'post'`                                         |
| `entityId`      | `string`         | ✅       | 關聯實體 ID（活動或文章的 Firestore doc ID）                                |
| `entityTitle`   | `string`         | ✅       | 關聯實體標題（建立時快照，用於通知訊息）                                    |
| `commentId`     | `string \| null` | ❌       | 留言 ID（僅 `post_new_comment` 類型，用於 scroll-to-comment）               |
| `message`       | `string`         | ✅       | 預建的完整通知訊息文字                                                      |
| `read`          | `boolean`        | ✅       | 是否已讀（建立時 `false`）                                                  |
| `createdAt`     | `Timestamp`      | ✅       | 建立時間（`serverTimestamp()`）                                             |

### 訊息模板

| type               | message 格式                                |
| ------------------ | ------------------------------------------- |
| `event_modified`   | `你所參加的『{entityTitle}』活動資訊有更動` |
| `event_cancelled`  | `你所參加的『{entityTitle}』已取消`         |
| `post_new_comment` | `你的文章『{entityTitle}』有一則新的留言`   |

### 設計備註

- **快照欄位**：`actorName`、`actorPhotoURL`、`entityTitle` 在建立時快照，不隨來源實體變更。通知反映的是「事件發生當下」的狀態。
- **`message` 預建**：通知訊息在建立時組合完成，渲染端直接顯示。避免 client-side 重組邏輯。
- **`commentId`**：僅 `post_new_comment` 使用，其他類型為 `null`。用於點擊通知後 scroll-to-comment。
- **不存 `recipientName`**：通知只需知道「給誰」（UID），不需顯示收件者名稱。

---

## 導航行為對照

| type               | 點擊導航目標        | URL                                       |
| ------------------ | ------------------- | ----------------------------------------- |
| `event_modified`   | 活動詳文頁          | `/events/{entityId}`                      |
| `event_cancelled`  | 活動詳文頁          | `/events/{entityId}`                      |
| `post_new_comment` | 文章頁 + 滾動至留言 | `/posts/{entityId}?commentId={commentId}` |

---

## 現有 Entity 影響

### User (`users/{uid}`)

**無需修改**。未讀計數由 `onSnapshot` 監聽器即時計算，不在 user doc 上反正規化。

### Event (`events/{eventId}`)

**無需修改**。通知建立時從 event doc 讀取 `title`，從 participants 子集合讀取收件者名單。

### Post (`posts/{postId}`)

**無需修改**。通知建立時從 post doc 讀取 `title` 和 `authorUid`。

---

## Firestore Security Rules

新增至 `firestore.rules`：

```javascript
match /notifications/{notificationId} {
  // 任何登入者可建立通知（recipientUid 不能是自己）
  allow create: if isSignedIn()
    && request.resource.data.recipientUid is string
    && request.resource.data.recipientUid != request.auth.uid
    && request.resource.data.type in ['event_modified', 'event_cancelled', 'post_new_comment']
    && request.resource.data.read == false
    && request.resource.data.createdAt == request.time;

  // 只有接收者可讀取自己的通知
  allow read: if isSignedIn()
    && resource.data.recipientUid == request.auth.uid;

  // 只有接收者可更新（僅 read 欄位）
  allow update: if isSignedIn()
    && resource.data.recipientUid == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);

  // 不允許刪除
  allow delete: if false;
}
```

### Rules 設計說明

| 規則                               | 目的                                       |
| ---------------------------------- | ------------------------------------------ |
| `recipientUid != request.auth.uid` | 防止自己給自己建通知                       |
| `type in [...]`                    | 限制合法通知類型                           |
| `read == false` on create          | 新通知必須是未讀                           |
| `createdAt == request.time`        | 強制使用 `serverTimestamp()`，防止偽造時間 |
| `affectedKeys().hasOnly(['read'])` | 更新只能改 read，防止竄改通知內容          |

---

## Firestore Indexes

新增至 `firestore.indexes.json`：

### Composite Index 1 — 「全部」分頁查詢

```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "recipientUid", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**：`where('recipientUid', '==', uid) + orderBy('createdAt', 'desc')`

### Composite Index 2 — 「未讀」查詢

```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "recipientUid", "order": "ASCENDING" },
    { "fieldPath": "read", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**：`where('recipientUid', '==', uid) + where('read', '==', false) + orderBy('createdAt', 'desc')`

---

## 狀態轉換

```
Notification 生命週期：

  [建立] ──→ read: false ──→ [使用者點擊] ──→ read: true
                                                   │
                                                   ↓
                                              (不可逆)
```

- 通知只有一次狀態轉換：`read: false → true`
- 無「刪除」操作（保留 90 天後由背景清理）
- 無「回復未讀」操作（MVP 不需要）

---

## 資料量估算

| 情境                        | 通知數量            |
| --------------------------- | ------------------- |
| 單次活動編輯（50 名參加者） | 49 則（排除修改者） |
| 單次活動取消（50 名參加者） | 49 則               |
| 單篇文章新留言              | 1 則（通知作者）    |
| Firestore batch 上限        | 500 operations      |

以 `writeBatch` 建立：每則通知 = 1 set operation。50 名參加者 = 49 operations，遠低於 500 上限。
