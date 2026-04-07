# Implementation Plan: Run Calendar

**Branch**: `008-run-calendar` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-run-calendar/spec.md`

## Summary

在 runs 頁面 header 新增月曆按鈕，點擊後以 native `<dialog>` 開啟月曆視圖。月曆以 7 欄網格顯示當月日曆，有跑步紀錄的日期以淡綠底色標示並搭配三種自製 SVG 圖示（戶外跑步、室內跑步、越野跑）+ 公里數。底部顯示當月總里程與各類型小計。支援月份切換。資料透過 Firestore 月份範圍 query 取得，Client-side 聚合。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore)
**Storage**: Firestore — `stravaActivities` collection（既有，不修改 schema）
**Testing**: Vitest (Unit/Integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web (Desktop + Mobile responsive)
**Project Type**: Web application (Next.js)
**Performance Goals**: 月曆資料載入 < 2 秒（SC-003/SC-004）
**Constraints**: 不引入外部 icon library（FR-014）、不引入 date library
**Scale/Scope**: 單一使用者月視圖，月資料量 < 100 筆活動

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Phase 0 Check

| Principle                     | Status  | Notes                                                                                          |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| I. SDD/TDD                    | ✅ PASS | spec.md 已完成，TDD 流程將在 tasks 階段執行                                                    |
| II. Strict Service Layer      | ✅ PASS | 新增 `getStravaActivitiesByMonth()` 在 `src/lib/firebase-strava.js`，UI 不直接 import Firebase |
| III. UX & Consistency         | ✅ PASS | 正體中文、CSS Modules、native `<dialog>`                                                       |
| IV. Performance & Concurrency | ✅ PASS | 月份範圍 query 使用既有 composite index，單月資料量小                                          |
| V. Code Quality               | ✅ PASS | JSDoc 完整、MVP 思維（不引入 date library）                                                    |
| VI. Modern Standards          | ✅ PASS | const 優先、解構、JSDoc 嚴格、CSS Modules                                                      |
| VII. Security                 | ✅ PASS | 無新增 API、資料查詢受 uid 限制                                                                |
| VIII. Agent Protocol          | ✅ PASS | 所有修改需使用者確認                                                                           |
| IX. Strict Coding Rules       | ✅ PASS | No logic in JSX、No eslint-disable a11y、Meaningful JSDoc                                      |

### Post-Phase 1 Re-check

| Principle                     | Status  | Notes                                                                  |
| ----------------------------- | ------- | ---------------------------------------------------------------------- |
| I. SDD/TDD                    | ✅ PASS | data-model.md + contracts 完成，測試策略明確                           |
| II. Strict Service Layer      | ✅ PASS | `getStravaActivitiesByMonth()` 封裝在 service layer，hook 呼叫 service |
| III. UX & Consistency         | ✅ PASS | Dialog pattern 延續 CommentEditModal、mobile 全螢幕                    |
| IV. Performance & Concurrency | ✅ PASS | 共用既有 index，不需 `runTransaction`                                  |
| V. Code Quality               | ✅ PASS | 純函式 helper（buildCalendarGrid, groupActivitiesByDay）易於測試       |
| VI. Modern Standards          | ✅ PASS | 所有新函式/元件含完整 JSDoc                                            |
| VII. Security                 | ✅ PASS | 查詢以 uid 為 scope                                                    |
| VIII. Agent Protocol          | ✅ PASS | —                                                                      |
| IX. Strict Coding Rules       | ✅ PASS | 日曆邏輯抽離至 helper/hook，JSX 僅負責 view                            |

## Project Structure

### Documentation (this feature)

```text
specs/008-run-calendar/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── components.md    # Phase 1 output — component interfaces
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/runs/
│   ├── page.jsx                    # [修改] 新增月曆按鈕 + dialog state
│   └── runs.module.css             # [修改] 新增月曆按鈕樣式
├── components/
│   ├── RunCalendarDialog.jsx       # [新增] 月曆 dialog 主元件
│   ├── RunCalendarDialog.module.css# [新增] 月曆樣式（含 RWD）
│   └── icons/
│       ├── CalendarIcon.jsx        # [新增] 月曆按鈕圖示
│       ├── RunOutdoorIcon.jsx      # [新增] 戶外跑步圖示
│       ├── RunIndoorIcon.jsx       # [新增] 室內跑步圖示
│       └── RunTrailIcon.jsx        # [新增] 越野跑圖示
├── hooks/
│   └── useRunCalendar.js           # [新增] 月曆資料 hook
└── lib/
    ├── firebase-strava.js          # [修改] 新增 getStravaActivitiesByMonth
    └── strava-helpers.js           # [修改] 新增 helper functions

specs/008-run-calendar/tests/
├── unit/
│   ├── buildCalendarGrid.test.js
│   ├── groupActivitiesByDay.test.js
│   └── calcMonthSummary.test.js
├── integration/
│   └── RunCalendarDialog.test.jsx
└── e2e/
    └── run-calendar.spec.js
```

**Structure Decision**: 延續既有 Next.js App Router + components + hooks + lib 分層架構。SVG icons 獨立放在 `components/icons/` 子目錄（新建），因為是本功能引入的全新 pattern。

## Complexity Tracking

> 無 Constitution 違規，此區段不適用。
