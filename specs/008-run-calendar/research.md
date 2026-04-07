# Research: Run Calendar

**Feature Branch**: `008-run-calendar`
**Date**: 2026-04-07

## Research Tasks

### R1: Firestore 月份範圍查詢策略

**Context**: FR-012 要求「透過 Firestore 月份範圍 query 取得」，需確認現有 index 是否支援。

**Findings**:

- 現有 composite index: `stravaActivities` → `uid ASC, startDate DESC`
- 此 index 支援 `where('uid', '==', uid)` + `where('startDate', '>=', monthStart)` + `where('startDate', '<', nextMonthStart)` + `orderBy('startDate', 'desc')` 組合查詢
- **不需要新增 Firestore index**

**Decision**: 在 `src/lib/firebase-strava.js` 新增 `getStravaActivitiesByMonth(uid, year, month)` 函式，使用 `Timestamp.fromDate()` 建構月初/下月初邊界，搭配現有 index 進行範圍查詢。

**Rationale**: 與現有 `getStravaActivities` 共用同一 collection 和 index，零額外基礎建設成本。

**Alternatives Considered**:

- Client-side 從既有 paginated data 過濾 → 拒絕：可能無法取得完整月份資料（依賴分頁深度）
- 用 `startDateLocal` string 做 range query → 拒絕：string 比較不如 Timestamp 可靠，且 `startDateLocal` 無 index

---

### R2: Strava 活動類型對應

**Context**: 需將 Strava API 的 `type` 欄位映射為三種跑步類型圖示。

**Findings**:

- Strava API `type` 值（跑步相關）：
  - `"Run"` → 戶外跑步
  - `"VirtualRun"` → 室內跑步（跑步機）
  - `"TrailRun"` → 越野跑
- 現有 `StravaActivity.type` 已直接儲存 Strava 原始 type 值
- 同步 API (`/api/strava/sync`) 已過濾僅同步跑步類型

**Decision**: 建立 `RUN_TYPE` 常數映射：

```js
const RUN_TYPE = {
  OUTDOOR: 'Run',
  INDOOR: 'VirtualRun',
  TRAIL: 'TrailRun',
};
```

在 `strava-helpers.js` 新增 helper 處理類型→圖示的映射。

**Rationale**: 直接使用 Strava 原始值作為 key，避免額外轉換層。

**Alternatives Considered**:

- 建立獨立的 enum/mapping 模組 → 拒絕：過度設計，常數定義在 helper 即可

---

### R3: Dialog 模式 — Native `<dialog>` 全螢幕 Mobile

**Context**: FR-002 要求 Desktop 為置中 modal，mobile 為全螢幕（100vw × 100vh）。

**Findings**:

- 現有 `CommentEditModal` 使用 native `<dialog>` + `showModal()` + `useRef`
- Native `<dialog>` 的 `::backdrop` pseudo-element 提供遮罩
- Mobile 全螢幕可透過 CSS `@media (max-width: 767px)` 設定 `width: 100vw; height: 100vh; max-width: none; max-height: none; border-radius: 0; margin: 0;`
- `<dialog>` 的 `onCancel` 處理 Escape 鍵關閉

**Decision**: 延續現有 native `<dialog>` pattern，CSS Modules 處理 responsive。Desktop 為置中 modal（max-width ~420px），mobile 為全螢幕。

**Rationale**: 遵循現有 codebase pattern（Constitution V: MVP 思維），無需引入新 library。

**Alternatives Considered**:

- 自建 overlay div + portal → 拒絕：native dialog 已有 backdrop、focus trap、a11y 支援
- 引入 headless UI library (Radix/Headless UI) → 拒絕：過度設計

---

### R4: SVG 圖示設計方案

**Context**: FR-005/FR-014 要求三種自製 inline SVG component，不引入外部 icon library。

**Findings**:

- 現有 codebase 無 SVG icon component 先例（僅用 Unicode 字元）
- 需要 3 個 SVG icon components：
  1. `RunOutdoorIcon` — 跑者剪影
  2. `RunIndoorIcon` — 跑步機
  3. `RunTrailIcon` — 人在山林中跑步
- 每個 icon 接受 `size` 和 `className` props，預設 16×16

**Decision**: 在 `src/components/icons/` 建立 3 個 SVG icon component，使用 inline SVG path，遵循 JSDoc + props 規範。另建 `CalendarIcon` 供月曆按鈕使用。

**Rationale**: inline SVG 可控性高、無外部依賴、支援 CSS 著色。

**Alternatives Considered**:

- SVG sprite file → 拒絕：僅 3-4 個 icon，sprite 過度
- Unicode/emoji → 拒絕：無法精確表達跑步類型差異

---

### R5: 月曆日期格資料聚合策略

**Context**: 同一天可能有多筆紀錄、同類型多筆需加總、不同類型需分行。

**Findings**:

- `startDateLocal` 格式為 ISO string（如 `"2026-04-07T06:30:00Z"`），可擷取 `YYYY-MM-DD` 作為 date key
- 聚合邏輯：
  1. 按 `startDateLocal` 的日期部分 group by
  2. 在每天內按 `type` group by
  3. 同 type 的 `distanceMeters` 加總

**Decision**: 在 `strava-helpers.js` 新增 `groupActivitiesByDay(activities)` 函式，回傳 `Map<string, DayActivities>` 結構。聚合在 client-side 進行（單月資料量小，通常 < 50 筆）。

**Rationale**: Client-side 聚合避免增加 server 複雜度，月份資料量有限不影響效能。

**Alternatives Considered**:

- Server-side aggregation API → 拒絕：過度設計，月資料量不大
- Firestore aggregation queries → 拒絕：Firestore 原生聚合不支援 group by

---

### R6: 月曆網格排列邏輯

**Context**: FR-003 要求 7 欄網格（日～六），正確對齊月首日星期。

**Findings**:

- JavaScript `new Date(year, month, 1).getDay()` 回傳 0(日)~6(六)
- 月曆需前補空格至月首日對齊
- `new Date(year, month + 1, 0).getDate()` 取得該月天數
- 標準實作：產生 `[null, null, ..., 1, 2, ..., 28/29/30/31]` 陣列

**Decision**: 在 `strava-helpers.js` 新增 `buildCalendarGrid(year, month)` 函式，回傳 `(number|null)[]` 陣列，null 為前置空格。

**Rationale**: 純計算函式，易於單元測試。

**Alternatives Considered**:

- 使用 date-fns 或 dayjs → 拒絕：此計算用原生 Date API 即可，不引入新依賴
