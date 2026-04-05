# Implementation Plan: Strava 跑步���錄串接

**Branch**: `006-strava-running-records` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-strava-running-records/spec.md`

## Summary

串接 Strava API 讓使用者在平台上瀏覽個人跑步紀錄。採用 Next.js Route Handlers 作為 server-side proxy 處理 OAuth token exchange（Strava 要求 `client_secret`），活動資料同步至 Firestore，前端讀 Firestore 顯示。OAuth scope: `activity:read_all`。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore), Firebase Admin SDK (Route Handlers), Leaflet, `@mapbox/polyline`
**Storage**: Firestore — `stravaTokens/{uid}` (server-only), `stravaConnections/{uid}` (client-read), `stravaActivities/{id}` (client-read, top-level)
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web (Next.js on Vercel or similar)
**Project Type**: Web application (frontend + minimal server-side Route Handlers)
**Constraints**: Strava rate limit 100 read req/15min, 1000/day; 1h sync cooldown

## Constitution Check

_GATE: All principles PASS._

| Principle                | Status | Notes                                                  |
| ------------------------ | ------ | ------------------------------------------------------ |
| I. SDD/TDD               | PASS   | Spec 完成，實作前先寫 RED tests                        |
| II. Strict Service Layer | PASS   | Firebase 邏輯全在 `src/lib/`                           |
| III. UX 一致性           | PASS   | 正體中文、IntersectionObserver、Leaflet dynamic import |
| IV. 效能/併發            | PASS   | `serverTimestamp()`、polyline 原樣存                   |
| V-VI. 程式碼品質         | PASS   | JS only、CSS Modules、JSDoc、Airbnb style              |
| VII. 安全                | PASS   | client_secret server-only、token 不暴露                |
| VIII-IX. Agent/鐵律      | PASS   | 修改前確認、no logic in JSX                            |

## Project Structure

### Documentation (this feature)

```text
specs/006-strava-running-records/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output — Strava API research
├── data-model.md        # Phase 1 output — Firestore entities
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/strava/
│   │   ├── callback/route.js    # OAuth token exchange
│   │   ├── sync/route.js        # 活動同步
│   │   └── disconnect/route.js  # (P2) 斷開連結
│   └── runs/
���       ├── page.jsx             # 'use client' 主頁面
│       ├── runs.module.css
│       └── callback/
│           └── page.jsx         # 'use client' OAuth callback
├── components/
│   ├── RunsLoginGuide.jsx + .module.css
│   ├── RunsConnectGuide.jsx + .module.css
│   ├── RunsActivityList.jsx + .module.css
│   ├── RunsActivityCard.jsx + .module.css
│   └── RunsRouteMap.jsx + .module.css
├── hooks/
│   ├── useStravaConnection.js
│   ├── useStravaActivities.js
│   └── useStravaSync.js
└── lib/
    ├── firebase-admin.js        # Admin SDK init + verifyAuthToken + syncStravaActivities
    ├── firebase-strava.js       # Client Firestore service layer
    └── strava-helpers.js        # Pure utility functions

specs/006-strava-running-records/tests/
├── unit/
│   ├── strava-helpers.test.js
│   ├── firebase-strava.test.js
│   └── route-handlers.test.js
└── integration/
    ├── RunsPage.test.jsx
    └── RunsActivityCard.test.jsx
```

**Structure Decision**: 遵循現有 Next.js App Router 結構。Route Handlers 放在 `src/app/api/strava/`，service layer 放 `src/lib/`，components 和 hooks 各自歸位。

## Complexity Tracking

| Deviation                         | Why Needed                                                           | Simpler Alternative Rejected Because |
| --------------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| 新增 Route Handlers (server code) | Strava OAuth 需要 client_secret                                      | 純前端無法安全存取 secret            |
| 新增 firebase-admin dependency    | Route Handler 需驗證 Firebase ID token + 寫入 server-only collection | 不驗證身份 = 任何人可打 API          |
