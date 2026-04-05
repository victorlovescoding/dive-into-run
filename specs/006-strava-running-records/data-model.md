# Data Model: Strava 跑步紀錄串接

**Branch**: `006-strava-running-records` | **Date**: 2026-04-06

---

## Entities

### 1. StravaToken（Strava 授權憑證）

**Collection**: `stravaTokens/{uid}`
**Access**: Server-only（Admin SDK）
**Firestore Rule**: `allow read, write: if false`

| Field          | Type      | Required | Description                                      |
| -------------- | --------- | -------- | ------------------------------------------------ |
| `accessToken`  | string    | YES      | Strava API access token（6h 過期）               |
| `refreshToken` | string    | YES      | Strava API refresh token（每次 refresh 輪換）    |
| `expiresAt`    | number    | YES      | Access token 到期 Unix epoch seconds             |
| `athleteId`    | number    | YES      | Strava athlete 數字 ID                           |
| `connectedAt`  | Timestamp | YES      | 首次連結時間（serverTimestamp）                  |
| `lastSyncAt`   | Timestamp | NO       | 最後同步時間（冷卻判斷用，首次同步完成後才寫入） |

**Validation**:

- `accessToken` 和 `refreshToken` 不可為空字串
- `expiresAt` 必須為正整數
- `athleteId` 必須為正整數

---

### 2. StravaConnection（Strava 連結狀態）

**Collection**: `stravaConnections/{uid}`
**Access**: Client-readable（owner only）
**Firestore Rule**: `allow read: if isSignedIn() && request.auth.uid == uid`

| Field         | Type      | Required | Description                                              |
| ------------- | --------- | -------- | -------------------------------------------------------- |
| `connected`   | boolean   | YES      | 是否已連結 Strava                                        |
| `athleteId`   | number    | YES      | Strava athlete 數字 ID                                   |
| `athleteName` | string    | YES      | Strava 顯示名稱（firstname + lastname）                  |
| `connectedAt` | Timestamp | YES      | 連結時間                                                 |
| `lastSyncAt`  | Timestamp | NO       | 最後同步時間（前端冷卻倒數顯示用，首次同步完成後才寫入） |

**State Transitions**:

- **未連結 → 已連結**: OAuth callback 成功 → 建立文件 `{ connected: true, ... }`
- **已連結 → 未連結**: 取消連結（P2）或 Strava 端撤銷 → `{ connected: false }`

---

### 3. StravaActivity（跑步紀錄）

**Collection**: `stravaActivities/{stravaActivityId}`
**Access**: Client-readable（owner only）, Server-writable only
**Firestore Rule**: `allow read: if isSignedIn() && request.auth.uid == resource.data.uid`
**Document ID**: Strava activity ID 轉為 string（自動 dedup）

| Field             | Type      | Required | Description                                                            |
| ----------------- | --------- | -------- | ---------------------------------------------------------------------- |
| `uid`             | string    | YES      | Owner Firebase UID                                                     |
| `stravaId`        | number    | YES      | Strava activity 數字 ID                                                |
| `name`            | string    | YES      | 活動名稱（來自 Strava）                                                |
| `type`            | string    | YES      | 活動類型：`Run` / `TrailRun` / `VirtualRun`                            |
| `distanceMeters`  | number    | YES      | 距離（公尺，保留 Strava 原始精度）                                     |
| `movingTimeSec`   | number    | YES      | 移動時間（秒）                                                         |
| `startDate`       | Timestamp | YES      | 活動開始時間（Firestore Timestamp，排序/查詢用）                       |
| `startDateLocal`  | string    | YES      | 當地時間 ISO string（顯示用）                                          |
| `summaryPolyline` | string    | NO       | Encoded polyline 路線（null = 無 GPS，如跑步機）                       |
| `averageSpeed`    | number    | YES      | 平均速度 m/s（來自 Strava，目前無 UI 使用，保留供未來 aggregate 查詢） |
| `syncedAt`        | Timestamp | YES      | 同步時間（serverTimestamp）                                            |

**Validation**:

- `type` 限 `Run`、`TrailRun`、`VirtualRun`
- `distanceMeters` >= 0
- `movingTimeSec` >= 0

---

## Relationships

```
users/{uid} (existing)
  │
  ├── stravaTokens/{uid}      1:1  server-only 授權憑證
  ├── stravaConnections/{uid}  1:1  client-readable 連結狀態
  └── stravaActivities/*       1:N  uid field 關聯（top-level collection）
```

---

## Indexes

### Composite Index

```json
{
  "collectionGroup": "stravaActivities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "uid", "order": "ASCENDING" },
    { "fieldPath": "startDate", "order": "DESCENDING" }
  ]
}
```

**Used by**: 活動列表查詢 `where('uid', '==', uid), orderBy('startDate', 'desc'), limit(10)`

---

## Display Conversions（View Layer）

| Raw Field                          | Display       | Formula                                             |
| ---------------------------------- | ------------- | --------------------------------------------------- |
| `distanceMeters`                   | `"5.2 km"`    | `(meters / 1000).toFixed(1)`                        |
| `movingTimeSec` + `distanceMeters` | `"5'29\"/km"` | `(movingTimeSec / (distanceMeters / 1000)) → mm:ss` |
| `movingTimeSec`                    | `"28:30"`     | `mm:ss` or `h:mm:ss`                                |

轉換邏輯在 `src/lib/strava-helpers.js`，不存入 Firestore。
