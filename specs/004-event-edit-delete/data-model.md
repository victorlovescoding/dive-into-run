# Data Model: Event Edit & Delete Actions

**Branch**: `004-event-edit-delete` | **Date**: 2026-03-30

## Entities

### Event (既有 — 編輯操作修改)

**Collection**: `events`

| Field                  | Type      | Editable | Notes                                       |
| ---------------------- | --------- | -------- | ------------------------------------------- |
| `id`                   | string    | No       | Firestore document ID                       |
| `title`                | string    | Yes      | 活動名稱                                    |
| `time`                 | Timestamp | Yes      | 活動時間                                    |
| `registrationDeadline` | Timestamp | Yes      | 報名截止時間                                |
| `city`                 | string    | Yes      | 縣市                                        |
| `district`             | string    | Yes      | 區域                                        |
| `meetPlace`            | string    | Yes      | 集合地點                                    |
| `runType`              | string    | Yes      | 跑步類型                                    |
| `distanceKm`           | number    | Yes      | 距離（公里）                                |
| `paceSec`              | number    | Yes      | 配速秒數                                    |
| `maxParticipants`      | number    | Yes      | 人數上限（min = max(participantsCount, 2)） |
| `description`          | string    | Yes      | 活動說明                                    |
| `route`                | object    | No       | 路線資料（編輯時保留原值）                  |
| `hostUid`              | string    | No       | 主揪 UID                                    |
| `hostName`             | string    | No       | 主揪名稱                                    |
| `hostPhotoURL`         | string    | No       | 主揪頭像                                    |
| `participantsCount`    | number    | No       | 目前參加人數（系統管理）                    |
| `remainingSeats`       | number    | Derived  | maxParticipants - participantsCount         |
| `createdAt`            | Timestamp | No       | 建立時間                                    |

### Participant (既有 — 刪除操作一併清除)

**Collection**: `events/{eventId}/participants`

| Field      | Type      | Notes                     |
| ---------- | --------- | ------------------------- |
| `uid`      | string    | 參與者 UID（document ID） |
| `name`     | string    | 參與者名稱                |
| `photoURL` | string    | 參與者頭像                |
| `joinedAt` | Timestamp | 報名時間                  |

## Validation Rules

### updateEvent

1. `eventId` 必須存在且不為空
2. `updatedFields` 必須為非空物件
3. 若更新 `maxParticipants`：新值 >= 目前 `participantsCount`（FR-015）
4. 若更新 `maxParticipants`：同時重算 `remainingSeats = maxParticipants - participantsCount`
5. 目標 event document 必須存在（否則 throw）

### deleteEvent

1. `eventId` 必須存在且不為空
2. 目標 event document 必須存在（否則 throw）
3. 先刪除 `participants` 子集合的所有文件
4. 最後刪除 event 主文件

## State Transitions

### Event Lifecycle (本次新增部分)

```
[Created] → [Edited] → [Edited]...
[Created/Edited] → [Deleted]
```

- **Created → Edited**: 創建人透過編輯表單修改欄位，`updateEvent()` 寫入 Firestore
- **Any → Deleted**: 創建人確認刪除，`deleteEvent()` 移除 event + participants
