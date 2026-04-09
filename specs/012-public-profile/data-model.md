# Data Model: 使用者公開檔案頁面 (Public Profile)

**Feature Branch**: `012-public-profile`
**Date**: 2026-04-10

---

## Entities

### 1. User Profile (既有 — 擴充)

**Collection**: `users/{uid}`

| Field            | Type         | Required | Description                        |
| ---------------- | ------------ | -------- | ---------------------------------- |
| `uid`            | `string`     | ✅       | 使用者唯一識別碼（= document ID）  |
| `name`           | `string`     | ✅       | 顯示名稱                           |
| `email`          | `string`     | ✅       | 電子郵件                           |
| `photoURL`       | `string`     | ✅       | 頭像 URL（可為空字串）             |
| `createdAt`      | `Timestamp`  | ✅       | 加入平台日期                       |
| `nameChangedAt`  | `Timestamp`  | ❌       | 上次更名時間                       |
| `photoUpdatedAt` | `Timestamp`  | ❌       | 上次更新頭像時間                   |
| **`bio`**        | **`string`** | **❌**   | **個人簡介（≤ 150 字），新增欄位** |

**Validation Rules**:

- `bio`: 最大 150 字，純文字（無 HTML/Markdown）
- `bio` 欄位不存在或為空字串時，公開檔案不顯示簡介區塊

**State Transitions**: N/A（bio 為 CRUD 文字欄位，無狀態機）

---

### 2. User Statistics (計算值 — 非儲存)

統計數據為即時聚合計算，不持久化為 Firestore document。

| Stat              | Source                            | Query                                                      |
| ----------------- | --------------------------------- | ---------------------------------------------------------- |
| `hostedCount`     | `events` collection               | `where('hostUid', '==', uid)` → count                      |
| `joinedCount`     | `collectionGroup('participants')` | `where('uid', '==', uid)` → count                          |
| `totalDistanceKm` | `stravaActivities` collection     | `where('uid', '==', uid)` → `sum('distanceMeters')` / 1000 |
| `hasStrava`       | `stravaConnections/{uid}`         | `doc.exists() && doc.data().connected === true`            |

**Strava 顯示邏輯**:

- `hasStrava === false` → 完全不顯示累計公里數欄位
- `hasStrava === true && totalDistanceKm === 0` → 顯示 `0 km`

---

### 3. Hosted Events List (既有 — 查詢)

**Collection**: `events`

以 `hostUid` 欄位查詢，結果沿用既有 `EventData` typedef。

| Query Parameter | Value                                    |
| --------------- | ---------------------------------------- |
| `where`         | `hostUid == uid`                         |
| `orderBy`       | `time` desc                              |
| `limit`         | 5 (per page)                             |
| `startAfter`    | 前一頁最後一筆的 `QueryDocumentSnapshot` |

**顯示**: 複用既有 EventCard 元件樣式，可點擊進入活動詳情。

---

## Relationships

```text
users/{uid}
  ├── 1:N → events (via hostUid)          → hostedCount
  ├── 1:N → participants (collectionGroup) → joinedCount
  ├── 1:1 → stravaConnections/{uid}       → hasStrava
  └── 1:N → stravaActivities (via uid)    → totalDistanceKm
```

---

## Firestore Security Rules (建議新增)

```
// 允許任何人讀取 user profile（公開檔案）
match /users/{uid} {
  allow read: if true;
  allow write: if request.auth.uid == uid;

  // bio 欄位驗證
  allow update: if request.auth.uid == uid
    && (!('bio' in request.resource.data) || request.resource.data.bio.size() <= 150);
}
```

> **注意**: 上方為建議規則，實際部署需與現有 rules 合併。目前 users collection 的讀取權限需確認是否已開放。
