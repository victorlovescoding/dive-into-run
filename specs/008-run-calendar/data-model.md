# Data Model: Run Calendar

**Feature Branch**: `008-run-calendar`
**Date**: 2026-04-07

## Entities

### StravaActivity（既有，不修改）

> 來源：`stravaActivities` Firestore collection

| Field             | Type             | Description                         |
| ----------------- | ---------------- | ----------------------------------- |
| `id`              | `string`         | Firestore 文件 ID                   |
| `uid`             | `string`         | 使用者 UID                          |
| `stravaId`        | `number`         | Strava 活動 ID                      |
| `name`            | `string`         | 活動名稱                            |
| `type`            | `string`         | 活動類型（Run/VirtualRun/TrailRun） |
| `distanceMeters`  | `number`         | 距離（公尺）                        |
| `movingTimeSec`   | `number`         | 移動時間（秒）                      |
| `startDate`       | `Timestamp`      | 開始時間（UTC）                     |
| `startDateLocal`  | `string`         | 當地開始時間 ISO string             |
| `summaryPolyline` | `string \| null` | 路線 polyline                       |
| `averageSpeed`    | `number`         | 平均速度（m/s）                     |
| `syncedAt`        | `Timestamp`      | 同步時間                            |

**Indexes Used**:

- Composite: `uid ASC, startDate DESC`（既有，月份範圍查詢共用此 index）

---

### DayActivities（Client-side 聚合結構，新增）

> 由 `groupActivitiesByDay()` helper 產出，不存入 Firestore

```js
/**
 * @typedef {object} DayRunSummary
 * @property {string} type - 活動類型（Run/VirtualRun/TrailRun）。
 * @property {number} totalMeters - 該類型當日總距離（公尺）。
 */

/**
 * @typedef {object} DayActivities
 * @property {string} dateKey - 日期 key（YYYY-MM-DD 格式）。
 * @property {number} day - 日期數字（1-31）。
 * @property {DayRunSummary[]} runs - 各類型跑步摘要（已聚合）。
 * @property {number} totalMeters - 當日全類型總距離（公尺）。
 */
```

**Derivation Rules**:

1. 從 `startDateLocal` 擷取 `YYYY-MM-DD` 作為 `dateKey`
2. 同一 `dateKey` + 同一 `type` 的 `distanceMeters` 加總為 `totalMeters`
3. 僅包含有紀錄的類型（無紀錄的類型不出現在 `runs` 陣列）
4. `runs` 陣列按 type 固定順序排列：Run → VirtualRun → TrailRun

---

### MonthSummary（Client-side 聚合結構，新增）

> 由月曆 hook 計算，不存入 Firestore

```js
/**
 * @typedef {object} MonthTypeSummary
 * @property {string} type - 活動類型。
 * @property {number} totalMeters - 該類型當月總距離（公尺）。
 * @property {string} label - 顯示標籤（如「戶外」「室內」「越野」）。
 */

/**
 * @typedef {object} MonthSummary
 * @property {number} totalMeters - 當月全類型總距離（公尺）。
 * @property {MonthTypeSummary[]} byType - 各類型小計（僅含有紀錄的類型）。
 */
```

**Derivation Rules**:

1. `totalMeters` = 當月所有活動的 `distanceMeters` 加總
2. `byType` 僅列出有紀錄的類型
3. 各類型 `label` 映射：Run→「戶外」、VirtualRun→「室內」、TrailRun→「越野」

---

## Relationships

```
StravaActivity (Firestore)
    │
    │ getStravaActivitiesByMonth(uid, year, month)
    ▼
StravaActivity[] (raw monthly data)
    │
    │ groupActivitiesByDay(activities)
    ▼
Map<string, DayActivities> (per-day aggregation)
    │
    │ calcMonthSummary(dayMap)
    ▼
MonthSummary (monthly totals)
```

## Validation Rules

- `year` 必須為正整數
- `month` 必須為 0-11（JavaScript Date convention）
- `distanceMeters` 為非負數
- 公里數顯示：`(meters / 1000).toFixed(1)`
- 零里程月份：顯示 `0.0 km`

## State Transitions

本功能無複雜狀態機。月曆 dialog 狀態：

```
closed → open (點擊月曆按鈕)
open → loading (切換月份)
loading → loaded (資料返回)
loading → error (載入失敗)
open → closed (點擊背景/關閉按鈕/Escape)
```
