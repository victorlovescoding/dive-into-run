# Implementation Plan: 跑步前天氣頁面 (Pre-Run Weather Page)

**Branch**: `013-pre-run-weather` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-pre-run-weather/spec.md`

## Summary

在 Dive Into Run 站內新增 `/weather` 頁面，使用者透過互動式台灣地圖（全台總覽 → 縣市鄉鎮兩層下鑽）選擇跑步地點，即時查看今日/明日天氣資訊。支援收藏常用地點（需登入）、URL 狀態同步、localStorage 上次查看地點還原。地圖以 Leaflet GeoJSON 圖層渲染行政區邊界，天氣資料透過 Next.js API Route 代理中央氣象署 Open Data API 取得，收藏持久化至 Firestore。

## Technical Context

**Language/Version**: JavaScript (ES6+), Node.js (Next.js 15 runtime)
**Primary Dependencies**: Next.js 15 (App Router), React 19, Leaflet 1.9.4, React-Leaflet 5.0.0, Firebase v9+ (Firestore, Auth)
**Storage**: Firestore（收藏）、localStorage（上次查看地點）、靜態 GeoJSON 檔案（行政區邊界）
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web（桌面 ≥1024px、平板 768–1023px、手機 <768px）
**Project Type**: Web application（Next.js App Router 新增頁面）
**Performance Goals**: 天氣卡 2 秒內載入完成 (SC-002)；小離島 1 次點擊直達天氣 (SC-001)
**Constraints**: 無 TypeScript（JSDoc + checkJs）、CSS Modules + Tailwind、Leaflet 必須 `next/dynamic` SSR:false 載入
**Scale/Scope**: 單頁 `/weather`；29 個全台可互動單位 + 各縣市鄉鎮層；收藏無上限

### 研究結論（Phase 0 已解決，詳見 research.md）

- ✅ **天氣 API**: CWA F-C0032-001（縣市）+ F-D0047 奇數（鄉鎮 3hr）+ F-D0047 偶數（UV 12hr）
- ✅ **AQI**: 環境部 EPA API (aqx_p_432)，CWA 不提供 AQI
- ✅ **UV 預報**: F-D0047 偶數 ID（逐 12hr）含 `UVIndex` + `UVExposureLevel`，今日明日皆有
- ✅ **GeoJSON**: `dkaoster/taiwan-atlas` TopoJSON (MIT)，counties 140KB + towns 500KB
- ✅ **小離島**: Leaflet CircleMarker + Tooltip，零額外依賴
- ✅ **字型**: Fraunces (variable, SOFT axis)，next/font/google self-host

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原則             | 狀態    | 備註                                                                                                                                |
| ---------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| I. SDD/TDD       | ✅ PASS | spec.md 已完成，tests 將在 implement 階段先行撰寫                                                                                   |
| II. 嚴格服務層   | ✅ PASS | 天氣 API 呼叫封裝至 `src/lib/weather-api.js`；收藏操作封裝至 `src/lib/firebase-weather-favorites.js`；UI 不直接 import Firebase SDK |
| III. UX 一致性   | ✅ PASS | 正體中文；Leaflet 透過 `next/dynamic` (SSR: false) 載入                                                                             |
| IV. 效能 & 併發  | ✅ PASS | 快速切換地區時取消前次請求（AbortController）；收藏寫入不涉及共享計數器，無需 `runTransaction`（單一使用者文件操作）                |
| V. 程式碼品質    | ✅ PASS | MVP 思維、JavaScript only、CSS Modules                                                                                              |
| VI. 現代化標準   | ✅ PASS | JSDoc 完整標注、Airbnb 風格、const 優先                                                                                             |
| VII. 安全        | ✅ PASS | CWA API key 存 `.env`，透過 Next.js API Route 代理，前端不暴露                                                                      |
| VIII. 代理人協議 | ✅ PASS | 修改前確認、不臆測                                                                                                                  |
| IX. 編碼鐵律     | ✅ PASS | 地圖互動邏輯抽至 helper/hook、JSX 僅負責 view                                                                                       |

**Gate Result**: ✅ ALL PASS — 無違規，可進入 Phase 0

### Post-Design Re-Check (Phase 1 完成後)

| 原則            | 狀態    | 驗證                                                                                                                          |
| --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| II. 嚴格服務層  | ✅ PASS | data-model.md 明確定義 `weather-api.js` 和 `firebase-weather-favorites.js` 在 `src/lib/`；contracts/ 確認 UI 只透過服務層存取 |
| IV. 效能 & 併發 | ✅ PASS | contracts/weather-api.md 定義 server-side cache (s-maxage=600)；收藏為 user subcollection 操作，不涉及共享狀態                |
| VII. 安全       | ✅ PASS | CWA_API_KEY / EPA_API_KEY 在 .env，API Route 代理不暴露前端；Firestore rules 限定 `auth.uid == uid`                           |
| IX. 編碼鐵律    | ✅ PASS | data-model.md 所有 typedef 含 @property 描述；JSDoc patterns 符合 coding-standards.md                                         |

**Post-Design Gate**: ✅ ALL PASS

## Project Structure

### Documentation (this feature)

```text
specs/013-pre-run-weather/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── weather/
│   │   └── page.jsx                    # /weather 頁面入口（Server Component 殼）
│   └── api/
│       └── weather/
│           └── route.js                # CWA API proxy（隱藏 API key）
├── components/
│   └── weather/
│       ├── WeatherPage.jsx             # Client Component 主容器（next/dynamic 載入）
│       ├── TaiwanMap.jsx               # 台灣地圖（GeoJSON 互動層）
│       ├── WeatherCard.jsx             # 天氣資訊卡（今日 + 明日）
│       ├── WeatherCardSkeleton.jsx     # 骨架佔位
│       ├── WeatherCardEmpty.jsx        # 空狀態
│       ├── WeatherCardError.jsx        # 錯誤狀態 + 重試
│       ├── FavoriteButton.jsx          # 收藏按鈕
│       ├── FavoritesBar.jsx            # 收藏區塊（桌面 + 手機）
│       ├── BackToOverviewButton.jsx    # 「全台總覽」回退按鈕
│       └── weather.module.css          # CSS Modules
├── lib/
│   ├── weather-api.js                  # CWA API 呼叫封裝（fetch + 資料轉換）
│   ├── firebase-weather-favorites.js   # Firestore 收藏 CRUD
│   └── weather-helpers.js              # 地點名稱格式化、離島路由對照表、URL params 工具
└── data/
    └── geo/
        ├── counties.json               # 全台縣市 TopoJSON（靜態，140 KB）
        └── towns.json                  # 全台鄉鎮 TopoJSON（靜態，500 KB，client-side filter）

specs/013-pre-run-weather/tests/
├── unit/                               # weather-helpers, weather-api 單元測試
├── integration/                        # WeatherPage, TaiwanMap, WeatherCard 整合測試
└── e2e/                                # 完整使用者旅程 E2E
```

**Structure Decision**: 採用現有 Next.js App Router 結構，新增 `src/app/weather/` 路由、`src/components/weather/` 元件群組、`src/lib/` 服務層檔案。GeoJSON 靜態資料放 `src/data/geo/`，鄉鎮資料按縣市拆分以支援按需載入。

## Complexity Tracking

> 無憲法違規，本節留空。
