# Quickstart: Run Calendar

**Feature Branch**: `008-run-calendar`
**Date**: 2026-04-07

## 功能概述

在 runs 頁面新增月曆按鈕，點擊後開啟月曆 dialog，以三種 SVG 圖示標示戶外跑步、室內跑步、越野跑的紀錄及公里數，底部顯示當月總里程。

## 新增檔案

| 檔案                                          | 用途                     |
| --------------------------------------------- | ------------------------ |
| `src/components/RunCalendarDialog.jsx`        | 月曆 dialog 主元件       |
| `src/components/RunCalendarDialog.module.css` | 月曆樣式（含 RWD）       |
| `src/components/icons/CalendarIcon.jsx`       | 月曆按鈕圖示             |
| `src/components/icons/RunOutdoorIcon.jsx`     | 戶外跑步 SVG 圖示        |
| `src/components/icons/RunIndoorIcon.jsx`      | 室內跑步 SVG 圖示        |
| `src/components/icons/RunTrailIcon.jsx`       | 越野跑 SVG 圖示          |
| `src/hooks/useRunCalendar.js`                 | 月曆資料查詢 + 聚合 hook |

## 修改檔案

| 檔案                           | 修改                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `src/app/runs/page.jsx`        | 新增月曆按鈕 + dialog 狀態管理                                                                |
| `src/app/runs/runs.module.css` | 新增月曆按鈕樣式                                                                              |
| `src/lib/firebase-strava.js`   | 新增 `getStravaActivitiesByMonth()`                                                           |
| `src/lib/strava-helpers.js`    | 新增 `groupActivitiesByDay()`、`calcMonthSummary()`、`buildCalendarGrid()`、`RUN_TYPE_LABELS` |

## 不修改

- Firestore indexes（現有 `uid ASC, startDate DESC` 已足夠）
- 後端 API routes
- 現有元件（RunsActivityList、RunsActivityCard 等）

## 技術決策摘要

| 決策     | 選擇                     | 原因                     |
| -------- | ------------------------ | ------------------------ |
| Dialog   | Native `<dialog>`        | 延續現有 pattern         |
| 資料查詢 | Firestore 月份範圍 query | 共用現有 index           |
| 聚合     | Client-side              | 月資料量小，避免過度設計 |
| SVG      | Inline SVG components    | 可控、無外部依賴         |
| 日期計算 | Native Date API          | 不需引入 date library    |

## 開發順序建議

1. Helper functions（`buildCalendarGrid`、`groupActivitiesByDay`、`calcMonthSummary`）— 純邏輯，可先寫測試
2. `getStravaActivitiesByMonth` service function
3. SVG icon components（4 個）
4. `useRunCalendar` hook
5. `RunCalendarDialog` 元件 + CSS
6. 整合至 `RunsPage`（按鈕 + dialog 狀態）
7. E2E 測試
