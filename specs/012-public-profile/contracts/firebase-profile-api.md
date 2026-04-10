# Contract: firebase-profile.js Service Layer API

**Feature Branch**: `012-public-profile`
**Date**: 2026-04-10
**File**: `src/lib/firebase-profile.js`

---

## Overview

封裝公開檔案頁面所需的所有 Firestore 查詢。UI 元件只透過此模組存取資料。

---

## Type Definitions

```js
/**
 * @typedef {object} PublicProfile
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介（0-150 字）。
 * @property {import('firebase/firestore').Timestamp} createdAt - 加入日期。
 */

/**
 * @typedef {object} ProfileStats
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量。
 * @property {number | null} totalDistanceKm - 累計跑步公里數（null = 未連結 Strava）。
 */

/**
 * @typedef {object} HostedEventsPage
 * @property {import('@/lib/firebase-events').EventData[]} items - 活動列表。
 * @property {import('firebase/firestore').QueryDocumentSnapshot | null} lastDoc - 分頁游標。
 * @property {boolean} hasMore - 是否還有更多。
 */
```

---

## Functions

### `getUserProfile(uid)`

取得使用者的公開檔案資料。

```js
/**
 * 取得使用者公開檔案資料。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<PublicProfile | null>} 使用者資料，不存在時回傳 null。
 */
export async function getUserProfile(uid) {}
```

**Behavior**:

- 讀取 `users/{uid}` document
- 不存在 → return `null`
- 只回傳公開欄位（排除 email）

---

### `getProfileStats(uid)`

取得使用者的統計數據。

```js
/**
 * 取得使用者的公開檔案統計數據。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<ProfileStats>} 統計數據。
 */
export async function getProfileStats(uid) {}
```

**Behavior**:

- 平行查詢三項數據：
  1. `events` where `hostUid == uid` → `getCountFromServer`
  2. `collectionGroup('participants')` where `uid == uid` → `getCountFromServer`
  3. `stravaConnections/{uid}` → 若 `connected === true`，再查 `stravaActivities` where `uid == uid` → `getAggregateFromServer({ totalDistance: sum('distanceMeters') })`
- `totalDistanceKm`: Strava 未連結 → `null`；已連結 → `sum / 1000`（含 0）

---

### `getHostedEvents(uid, options?)`

分頁取得使用者主辦的活動列表。

```js
/**
 * 分頁取得使用者主辦的活動列表。
 * @param {string} uid - 目標使用者 UID。
 * @param {object} [options] - 分頁選項。
 * @param {import('firebase/firestore').QueryDocumentSnapshot | null} [options.lastDoc] - 分頁游標。
 * @param {number} [options.pageSize] - 每頁筆數，預設 5。
 * @returns {Promise<HostedEventsPage>} 分頁結果。
 */
export async function getHostedEvents(uid, options = {}) {}
```

**Behavior**:

- `events` where `hostUid == uid`, `orderBy('time', 'desc')`, `limit(pageSize + 1)`
- 取 `pageSize + 1` 筆判斷 `hasMore`，回傳只取前 `pageSize` 筆
- 將 Firestore document 正規化為 `EventData` 格式

---

### `getUserProfileServer(uid)` — Server Component only

伺服器端取得使用者公開檔案資料（供 `generateMetadata` 與 Server Component 使用）。

**File**: `src/lib/firebase-profile-server.js`

```js
/**
 * 伺服器端取得使用者公開檔案資料。使用 Firebase Admin SDK，僅供 Server Component / Route Handler 呼叫。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<import('./firebase-profile').PublicProfile | null>} 使用者資料，不存在時回傳 null。
 */
export async function getUserProfileServer(uid) {}
```

**Behavior**:

- 使用 `adminDb` (from `firebase-admin.js`) 讀取 `users/{uid}` document
- 不存在 → return `null`
- 只回傳公開欄位（排除 email）
- 欄位 shape 與 `getUserProfile` 一致

**Why separate from client `getUserProfile`**:

- Server Component 需要 Admin SDK（預先初始化、無 window 依賴）
- Client component 仍用 `getUserProfile` (client SDK) 支援 onSnapshot 監聽

---

### `updateUserBio(uid, bio)`

更新使用者個人簡介。

```js
/**
 * 更新使用者個人簡介。
 * @param {string} uid - 使用者 UID。
 * @param {string} bio - 簡介內容（≤ 150 字）。
 * @returns {Promise<void>}
 * @throws {Error} 字數超過 150 字時拋出錯誤。
 */
export async function updateUserBio(uid, bio) {}
```

**Behavior**:

- 驗證 `bio.length <= 150`，超過 → throw Error
- `setDoc(doc(db, 'users', uid), { bio: bio.trim() }, { merge: true })`
- 不需要 `serverTimestamp()` — bio 不需追蹤更新時間

---

## Error Handling

| Scenario            | Behavior                                             |
| ------------------- | ---------------------------------------------------- |
| `uid` 不存在        | `getUserProfile` → `null`、其他函式回傳預設值        |
| Firestore 離線/錯誤 | 拋出原始 Firestore error，由 UI 層處理               |
| Bio 超過 150 字     | `updateUserBio` throw `Error('簡介不得超過 150 字')` |
| 無效 uid（空字串）  | throw `Error('uid is required')`                     |
