# Contract: Notification Service Layer

**File**: `src/lib/firebase-notifications.js`

---

## Types

```js
/**
 * @typedef {object} NotificationData
 * @property {string} recipientUid - 通知接收者 UID。
 * @property {'event_modified'|'event_cancelled'|'post_new_comment'} type - 通知類型。
 * @property {string} actorUid - 觸發者 UID。
 * @property {string} actorName - 觸發者顯示名稱。
 * @property {string} actorPhotoURL - 觸發者頭像 URL。
 * @property {'event'|'post'} entityType - 關聯實體類型。
 * @property {string} entityId - 關聯實體 ID。
 * @property {string} entityTitle - 關聯實體標題。
 * @property {string|null} commentId - 留言 ID（僅 post_new_comment）。
 * @property {string} message - 完整通知訊息文字。
 * @property {boolean} read - 是否已讀。
 * @property {import('firebase/firestore').Timestamp} [createdAt] - 建立時間。
 */

/**
 * @typedef {object} NotificationItem
 * @property {string} id - Firestore document ID。
 * @property {string} recipientUid - 通知接收者 UID。
 * @property {'event_modified'|'event_cancelled'|'post_new_comment'} type - 通知類型。
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
 * @typedef {object} Actor
 * @property {string} uid - 觸發者 UID。
 * @property {string} name - 觸發者顯示名稱。
 * @property {string} photoURL - 觸發者頭像 URL。
 */
```

---

## Write Functions（通知建立）

### `notifyEventModified(eventId, eventTitle, actor)`

在活動成功更新後呼叫。讀取參加者名單，建立 batch 通知。

```js
/**
 * 建立「活動被修改」通知給所有參加者（排除觸發者）。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {Actor} actor - 修改活動的使用者。
 * @returns {Promise<void>}
 */
export async function notifyEventModified(eventId, eventTitle, actor) {}
```

**行為**：

1. `fetchParticipants(eventId)` 取得參加者
2. 過濾 `actor.uid`（不通知自己）
3. `writeBatch`：為每位參加者建立 notification doc
4. Message: `你所參加的『${eventTitle}』活動資訊有更動`

---

### `notifyEventCancelled(eventId, eventTitle, participants, actor)`

在活動刪除前呼叫。接收已擷取的參加者名單（因刪除後無法讀取）。

```js
/**
 * 建立「活動被取消」通知給所有參加者（排除觸發者）。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {Array<{uid: string}>} participants - 參加者列表（刪除前擷取）。
 * @param {Actor} actor - 取消活動的使用者。
 * @returns {Promise<void>}
 */
export async function notifyEventCancelled(eventId, eventTitle, participants, actor) {}
```

**行為**：

1. 過濾 `actor.uid`
2. `writeBatch`：為每位參加者建立 notification doc
3. Message: `你所參加的『${eventTitle}』已取消`

**呼叫順序**（由 UI 層編排）：

```
fetchParticipants → notifyEventCancelled → deleteEvent
```

---

### `notifyPostNewComment(postId, postTitle, postAuthorUid, commentId, actor)`

在文章留言成功後呼叫。

```js
/**
 * 建立「文章新留言」通知給文章作者。
 * @param {string} postId - 文章 ID。
 * @param {string} postTitle - 文章標題。
 * @param {string} postAuthorUid - 文章作者 UID。
 * @param {string} commentId - 新留言的 ID。
 * @param {Actor} actor - 留言者。
 * @returns {Promise<void>}
 */
export async function notifyPostNewComment(postId, postTitle, postAuthorUid, commentId, actor) {}
```

**行為**：

1. 若 `actor.uid === postAuthorUid`：直接 return（不通知自己）
2. 單一 `addDoc`：建立 notification doc
3. Message: `你的文章『${postTitle}』有一則新的留言`

---

## Read Functions（通知查詢）

### `watchNotifications(uid, onNext, onError, onNew)`

建立最新通知的即時監聽器（Listener 2）。

```js
/**
 * 監聽使用者最新通知（即時更新）。
 * @param {string} uid - 使用者 UID。
 * @param {(notifications: NotificationItem[]) => void} onNext - 完整列表回呼。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @param {(newNotifications: NotificationItem[]) => void} [onNew] - 新增通知回呼（排除首次載入）。
 * @returns {() => void} 退訂函式。
 */
export function watchNotifications(uid, onNext, onError, onNew) {}
```

**Query**: `where('recipientUid', '==', uid) + orderBy('createdAt', 'desc') + limit(5)`

**onNew 行為**：

- 內部維護 `isInitialLoad` flag
- 首次 snapshot：`isInitialLoad = false`，僅呼叫 `onNext`，不呼叫 `onNew`
- 後續 snapshot：先呼叫 `onNext`，再從 `snapshot.docChanges()` 過濾 `type === 'added'` 項目，透過 `onNew` 回傳
- 若未傳入 `onNew`，跳過 docChanges 處理

---

### `watchUnreadNotifications(uid, onNext, onError)`

建立未讀通知的即時監聽器（Listener 1）。

```js
/**
 * 監聽使用者未讀通知（即時更新），用於未讀計數與「未讀」分頁。
 * @param {string} uid - 使用者 UID。
 * @param {(notifications: NotificationItem[]) => void} onNext - 資料回呼。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @returns {() => void} 退訂函式。
 */
export function watchUnreadNotifications(uid, onNext, onError) {}
```

**Query**: `where('recipientUid', '==', uid) + where('read', '==', false) + orderBy('createdAt', 'desc') + limit(100)`

---

### `fetchMoreNotifications(uid, afterDoc, limitCount)`

分頁載入更多通知。

```js
/**
 * 載入更多通知（分頁查詢）。
 * @param {string} uid - 使用者 UID。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數，預設 5。
 * @returns {Promise<{ notifications: NotificationItem[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null }>}
 */
export async function fetchMoreNotifications(uid, afterDoc, limitCount = 5) {}
```

**Query**: `where('recipientUid', '==', uid) + orderBy('createdAt', 'desc') + startAfter(afterDoc) + limit(limitCount)`

---

### `fetchMoreUnreadNotifications(uid, afterDoc, limitCount)`

分頁載入更多未讀通知。

```js
/**
 * 載入更多未讀通知（分頁查詢）。
 * @param {string} uid - 使用者 UID。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數，預設 5。
 * @returns {Promise<{ notifications: NotificationItem[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null }>}
 */
export async function fetchMoreUnreadNotifications(uid, afterDoc, limitCount = 5) {}
```

---

## Update Functions

### `markNotificationAsRead(notificationId)`

```js
/**
 * 標記單則通知為已讀。
 * @param {string} notificationId - 通知 document ID。
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(notificationId) {}
```

**行為**：`updateDoc(doc(db, 'notifications', notificationId), { read: true })`

---

## Helper Functions（`src/lib/notification-helpers.js`）

### `formatRelativeTime(timestamp)`

```js
/**
 * 將 Firestore Timestamp 格式化為相對時間中文字串。
 * @param {import('firebase/firestore').Timestamp | Date} timestamp - 時間。
 * @returns {string} 相對時間字串（如「剛剛」、「5 分鐘前」、「4/6」）。
 */
export function formatRelativeTime(timestamp) {}
```

**規則**：

| 條件     | 回傳                              |
| -------- | --------------------------------- |
| ≤ 1 分鐘 | `'剛剛'`                          |
| ≤ 1 小時 | `'${minutes} 分鐘前'`             |
| ≤ 1 天   | `'${hours} 小時前'`               |
| ≤ 1 週   | `'${days} 天前'`                  |
| > 1 週   | `'${month}/${day}'`（如 `'4/6'`） |

### `buildNotificationMessage(type, entityTitle)`

```js
/**
 * 根據通知類型與實體標題組合通知訊息。
 * @param {'event_modified'|'event_cancelled'|'post_new_comment'} type - 通知類型。
 * @param {string} entityTitle - 實體標題。
 * @returns {string} 完整通知訊息。
 */
export function buildNotificationMessage(type, entityTitle) {}
```

### `getNotificationLink(notification)`

```js
/**
 * 根據通知資料回傳導航 URL。
 * @param {NotificationItem} notification - 通知資料。
 * @returns {string} 導航目標 URL。
 */
export function getNotificationLink(notification) {}
```

**規則**：

| type               | URL                                         |
| ------------------ | ------------------------------------------- |
| `event_modified`   | `/events/${entityId}`                       |
| `event_cancelled`  | `/events/${entityId}`                       |
| `post_new_comment` | `/posts/${entityId}?commentId=${commentId}` |
