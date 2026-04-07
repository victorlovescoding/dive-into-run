# Component Contracts: Run Calendar

**Feature Branch**: `008-run-calendar`
**Date**: 2026-04-07

## Component Hierarchy

```
RunsPage (既有)
├── [月曆按鈕] ← 新增於 header
└── RunCalendarDialog (新增)
    ├── CalendarHeader
    │   ├── 上月按鈕 (‹)
    │   ├── 月份標題 (YYYY年M月)
    │   └── 下月按鈕 (›)
    ├── CalendarGrid
    │   ├── WeekdayHeaders (日～六)
    │   └── DayCells × 28-42
    │       └── DayRunEntries (圖示 + 公里數)
    ├── MonthSummaryFooter
    │   ├── 總里程
    │   └── 各類型小計
    └── 關閉按鈕 (✕)
```

---

## RunCalendarDialog

> 月曆 dialog 主元件。Desktop 為置中 modal，mobile 為全螢幕。

**File**: `src/components/RunCalendarDialog.jsx`
**CSS**: `src/components/RunCalendarDialog.module.css`

### Props

```js
/**
 * 跑步月曆 dialog 元件。
 * @param {object} props
 * @param {boolean} props.open - 是否開啟 dialog。
 * @param {() => void} props.onClose - 關閉 dialog 的回呼。
 */
```

### Behavior

- `open` 為 true 時呼叫 `dialogRef.current.showModal()`
- `open` 為 false 時呼叫 `dialogRef.current.close()`
- 內部管理 `currentYear` / `currentMonth` state（預設為今天）
- 透過 `useRunCalendar(currentYear, currentMonth)` hook 取得資料
- 點擊 `::backdrop` 或關閉按鈕 → 呼叫 `onClose`
- Escape 鍵 → `onCancel` handler 呼叫 `onClose`

### Accessibility

- `role="dialog"`（native `<dialog>` 自帶）
- `aria-label="跑步月曆"`
- 關閉按鈕 `aria-label="關閉月曆"`
- 月份切換按鈕 `aria-label="上一個月"` / `aria-label="下一個月"`

---

## useRunCalendar Hook

> 封裝月份資料查詢與聚合邏輯。

**File**: `src/hooks/useRunCalendar.js`

### Signature

```js
/**
 * 取得指定月份的跑步月曆資料。
 * @param {number} year - 年份。
 * @param {number} month - 月份（0-11）。
 * @returns {UseRunCalendarResult} 月曆資料與狀態。
 */

/**
 * @typedef {object} UseRunCalendarResult
 * @property {Map<number, DayActivities>} dayMap - 以日期數字為 key 的每日聚合資料。
 * @property {MonthSummary} monthSummary - 當月總結。
 * @property {boolean} isLoading - 是否載入中。
 * @property {string|null} error - 錯誤訊息。
 */
```

### Behavior

- 依賴 `AuthContext` 取得 `user.uid`
- `user` 為 null 時不觸發 query，返回空 Map + 零值 MonthSummary + `isLoading: false`
- `year` / `month` 變更時觸發 `getStravaActivitiesByMonth(uid, year, month)`
- 查詢結果透過 `groupActivitiesByDay()` 和 `calcMonthSummary()` 聚合
- Loading / error state 管理
- error 發生時保留前次有效的 `dayMap` 和 `monthSummary`（不清空），讓 UI 可同時顯示舊資料 + error 訊息

---

## SVG Icon Components

> 4 個 inline SVG icon component。

**Directory**: `src/components/icons/`

### 共用 Props Interface

```js
/**
 * @param {object} props
 * @param {number} [props.size=16] - 圖示尺寸（寬高相同）。
 * @param {string} [props.className] - 額外 CSS class。
 */
```

### Components

| Component        | File                 | Description              |
| ---------------- | -------------------- | ------------------------ |
| `CalendarIcon`   | `CalendarIcon.jsx`   | 月曆按鈕圖示             |
| `RunOutdoorIcon` | `RunOutdoorIcon.jsx` | 戶外跑步（跑者）         |
| `RunIndoorIcon`  | `RunIndoorIcon.jsx`  | 室內跑步（跑步機）       |
| `RunTrailIcon`   | `RunTrailIcon.jsx`   | 越野跑（人在山林中跑步） |

---

## Service Layer

### getStravaActivitiesByMonth

**File**: `src/lib/firebase-strava.js`

```js
/**
 * 查詢指定月份的 Strava 跑步活動。
 * @param {string} uid - 使用者 UID。
 * @param {number} year - 年份。
 * @param {number} month - 月份（0-11）。
 * @returns {Promise<StravaActivity[]>} 該月份的活動列表。
 */
export async function getStravaActivitiesByMonth(uid, year, month) {}
```

**Query**: `where('uid', '==', uid)` + `where('startDate', '>=', monthStart)` + `where('startDate', '<', nextMonthStart)` + `orderBy('startDate', 'desc')`

---

## Helper Functions

### strava-helpers.js 新增

**File**: `src/lib/strava-helpers.js`

```js
/**
 * 將活動列表按日期分組並聚合同類型距離。
 * @param {import('./firebase-strava').StravaActivity[]} activities - 活動列表。
 * @returns {Map<number, DayActivities>} 以日期數字為 key 的聚合 map。
 */
export function groupActivitiesByDay(activities) {}

/**
 * 計算月份跑步總結。
 * @param {Map<number, DayActivities>} dayMap - 每日聚合資料。
 * @returns {MonthSummary} 月份總結。
 */
export function calcMonthSummary(dayMap) {}

/**
 * 產生月曆網格陣列。
 * @param {number} year - 年份。
 * @param {number} month - 月份（0-11）。
 * @returns {(number|null)[]} 日期陣列，null 為前置空格。
 */
export function buildCalendarGrid(year, month) {}

/** @type {Record<string, string>} 活動類型對應的中文標籤。 */
export const RUN_TYPE_LABELS = {
  Run: '戶外',
  VirtualRun: '室內',
  TrailRun: '越野',
};
```
