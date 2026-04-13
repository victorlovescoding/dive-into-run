# Tasks: 跑步前天氣頁面 (Pre-Run Weather Page)

**Input**: Design documents from `/specs/013-pre-run-weather/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — TDD approach (RED → GREEN → REFACTOR)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create project structure, configure environment

- [x] T001 Install `topojson-client` (production) and `taiwan-atlas` (devDependency), copy `counties-10t.json` → `src/data/geo/counties.json` and `towns-10t.json` → `src/data/geo/towns.json`
- [x] T002 [P] Create weather layout with Fraunces variable font (SOFT/WONK/opsz axes) via `next/font/google` in `src/app/weather/layout.jsx`
- [x] T003 [P] Create weather page Server Component shell — `next/dynamic` import WeatherPage with `{ ssr: false }` in `src/app/weather/page.jsx`
- [x] T004 [P] Add `CWA_API_KEY` and `EPA_API_KEY` to `.env`, add weather-related terms to `cspell.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service layer and shared utilities — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Implement weather-helpers.js — 22 縣市 forecastId 對照表 (奇數 3hr + 偶數 12hr ID)、ISLAND_MARKERS 常數 (蘭嶼/綠島/小琉球/龜山島 座標+路由目標)、地點名稱格式化 (countyShort/townshipShort 去後綴)、URL param encode/decode 工具 in `src/lib/weather-helpers.js`
- [x] T006 [P] Implement Weather API Route — 解析 county/township query params，平行呼叫 CWA F-C0032-001 (縣市) 或 F-D0047 奇數 (鄉鎮 3hr) + F-D0047 偶數 (UV 12hr) + EPA aqx_p_432 (AQI)，正規化為 WeatherInfo 格式回傳，設定 `Cache-Control: s-maxage=600, stale-while-revalidate=300` in `src/app/api/weather/route.js`
- [x] T007 [P] Implement weather-api.js — 前端 `fetch('/api/weather')` 封裝，接受 county/township/signal 參數，AbortController 支援快速切換取消前次請求 in `src/lib/weather-api.js`
- [x] T008 [P] Create weather.module.css — Soft Sky 主題基底樣式：色彩變數 (#EAF8FC/#A4C3E4)、GeoJSON polygon 預設/hover/selected 樣式、天氣卡片容器、shimmer 骨架動畫、鄉鎮浮起效果 (box-shadow + transform)、響應式斷點 (≥1024px 並排 / <768px 上下) in `src/components/weather/weather.module.css`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — 選地點查天氣 (Priority: P1) 🎯 MVP

**Goal**: 全台地圖選地點 → 即時查看今日/明日天氣。涵蓋 25 縣市 + 4 小離島，小離島一鍵直達天氣。

**Independent Test**: 進入 `/weather`，地圖呈現全台 29 個可互動單位。點擊本島縣市 → 天氣卡顯示縣市天氣。點擊小離島標示 → 地圖 drill-down + 天氣卡直接顯示該鄉鎮天氣。

### Tests for US1 ⚠️ RED phase — 寫完確認 FAIL 再開始實作

- [x] T009 [P] [US1] Unit tests for weather-helpers.js — county ↔ forecastId 對照、ISLAND_MARKERS 路由目標、地點名稱格式化 (long/short)、URL param encode/decode in `specs/013-pre-run-weather/tests/unit/weather-helpers.test.js`
- [x] T010 [P] [US1] Unit tests for Weather API Route — CWA/EPA response 正規化為 WeatherInfo、county-only vs township query 分流、error 回傳 400/502、cache headers in `specs/013-pre-run-weather/tests/unit/weather-api-route.test.js`
- [x] T011 [P] [US1] Integration test for WeatherPage — 地圖渲染 29 個單位、點擊縣市 → 天氣卡顯示縣市天氣 (loading→success)、點擊蘭嶼 → drill-down + 蘭嶼鄉天氣、載入失敗 → 錯誤狀態 + 重試、快速切換棄舊請求 (mock Leaflet for jsdom) in `specs/013-pre-run-weather/tests/integration/weather-page.test.jsx`

### Implementation for US1

- [x] T012 [US1] Implement WeatherPage.jsx — Client Component 主容器：selectedLocation / mapLayer (overview|county) / weatherData 狀態管理，county/island 點擊回調 → weather-api.js fetch → state 更新 (idle→loading→success|error)，AbortController 快速切換取消，響應式版面 (桌面天氣卡左+地圖右並排 / 手機地圖上+天氣卡下) in `src/components/weather/WeatherPage.jsx`
- [x] T013 [US1] Implement TaiwanMap.jsx — Leaflet MapContainer (zoomControl:false, dragging:false)，全台總覽層 GeoJSON counties 圖層 (TopoJSON → feature 轉換) + 4 小離島 CircleMarker + permanent Tooltip，hover 漸變 (#EAF8FC → #A4C3E4)，點擊縣市 → drill-down 渲染鄉鎮 GeoJSON，島嶼智能路由 → drill-down + 自動選中目標鄉鎮 (浮起 + highlight) in `src/components/weather/TaiwanMap.jsx`
- [x] T014 [P] [US1] Implement WeatherCardEmpty.jsx — 空狀態：Soft Sky 風格插畫 + 「請先在地圖上選擇想查詢的地區」引導文字 in `src/components/weather/WeatherCardEmpty.jsx`
- [x] T015 [P] [US1] Implement WeatherCardSkeleton.jsx — 與實際卡片尺寸一致的骨架佔位 + shimmer 動畫，避免 layout shift in `src/components/weather/WeatherCardSkeleton.jsx`
- [x] T016 [P] [US1] Implement WeatherCardError.jsx — 「無法取得天氣，請稍後再試」錯誤提示 + 重試按鈕，不用 toast in `src/components/weather/WeatherCardError.jsx`
- [x] T017 [US1] Implement WeatherCard.jsx — 今日區塊 (地點名稱、大氣溫 Fraunces serif、天氣狀況 + CWA 官方 SVG 天氣圖示（見 research.md R9）、早晚氣溫、降雨/濕度/UV/AQI 四指標) + 明日摘要 (早晚氣溫、降雨、濕度、UV，無 AQI)，UV/AQI 為 null 時顯示「—」，視覺層級依 FR-026 in `src/components/weather/WeatherCard.jsx`

**Checkpoint**: US1 fully functional — select county/island → view weather, no login required

---

## Phase 4: User Story 2 — 下鑽鄉鎮看更精確的天氣 (Priority: P2)

**Goal**: 在縣市鄉鎮地圖上點選個別鄉鎮查看精確天氣，可回退到全台總覽重新選。URL 和 localStorage 持久化頁面狀態。

**Independent Test**: 從全台總覽點擊新北市 → 鄉鎮地圖 + 「全台總覽」按鈕出現 + 天氣卡顯示新北市整體天氣。點擊板橋區 → 浮起 + 天氣卡更新為板橋天氣。點擊「全台總覽」→ 回到全台地圖 + 狀態清空。

### Tests for US2 ⚠️ RED phase

- [x] T018 [P] [US2] Integration test for drill-down — 縣市鄉鎮層渲染 + hover 漸變、點擊鄉鎮 → 浮起 + 天氣更新、切換鄉鎮、未選鄉鎮顯示縣市天氣、BackToOverview 回全台、URL params 同步、localStorage 儲存/還原 in `specs/013-pre-run-weather/tests/integration/township-drilldown.test.jsx`

### Implementation for US2

- [x] T019 [US2] Extend TaiwanMap.jsx — 鄉鎮層互動：hover 漸變 (#EAF8FC → #A4C3E4)、點擊鄉鎮 → 選中浮起 (box-shadow + translate)、切換鄉鎮取消前一個浮起、re-click 已選鄉鎮 no-op (FR-015) in `src/components/weather/TaiwanMap.jsx`
- [x] T020 [P] [US2] Implement BackToOverviewButton.jsx — 台灣輪廓 SVG icon (上層) + 「全台總覽」文字 (下層)，僅縣市鄉鎮層顯示 (FR-017~FR-019) in `src/components/weather/BackToOverviewButton.jsx`
- [x] T021 [US2] Wire township selection in WeatherPage — 鄉鎮點擊 → fetch 鄉鎮天氣 → WeatherCard 更新、未選鄉鎮時顯示縣市整體天氣 (FR-016)、手機版 smooth scroll 到天氣卡 (FR-042)、BackToOverview 清空狀態回全台 in `src/components/weather/WeatherPage.jsx`
- [x] T022 [US2] Implement URL state sync + localStorage — replaceState 同步 county/township 到 URL query params (FR-059)、從 URL params 解析初始狀態 (FR-060)、BackToOverview 清 params (FR-061)、localStorage 儲存上次查看地點 (FR-063) + 無收藏時從 localStorage 還原 (FR-064a) in `src/lib/weather-helpers.js` + `src/components/weather/WeatherPage.jsx`

**Checkpoint**: US1 + US2 fully functional — county drill-down, township weather, URL shareable, state persisted

---

## Phase 5: User Story 3 — 收藏常查的地點並快速切換 (Priority: P3)

**Goal**: 已登入使用者收藏常用地點，收藏區塊一鍵切換天氣。Firestore 持久化，樂觀更新。

**Independent Test**: 登入 → 選地點 → 點收藏 → 收藏區塊出現含天氣概要 → 點收藏項切換地點 → 點 ✕ 移除收藏。未登入點收藏 → toast 提示。

### Tests for US3 ⚠️ RED phase

- [x] T023 [P] [US3] Unit tests for firebase-weather-favorites.js — addFavorite (含重複檢查 no-op)、removeFavorite、getFavorites (orderBy createdAt desc)、isFavorited、mock Firestore in `specs/013-pre-run-weather/tests/unit/firebase-weather-favorites.test.js`
- [x] T024 [P] [US3] Integration test for favorites — 未登入點收藏 → toast「請先登入才能收藏」、已登入收藏 → icon 填滿 + toast + 區塊新增、取消收藏 → icon 空心 + toast + 區塊移除、點收藏項 → 地圖切換 + 天氣更新、✕ 移除 → 天氣卡收藏按鈕同步、樂觀更新失敗回滾 in `specs/013-pre-run-weather/tests/integration/favorites.test.jsx`

### Implementation for US3

- [x] T025 [US3] Implement firebase-weather-favorites.js — Firestore `users/{uid}/weatherFavorites` CRUD：addFavorite (countyCode+townshipCode 重複查詢 → no-op)、removeFavorite、getFavorites (orderBy createdAt desc)、isFavorited，serverTimestamp + 更新 Firestore security rules in `src/lib/firebase-weather-favorites.js`
- [x] T026 [US3] Implement FavoriteButton.jsx — 天氣卡右上角書籤 icon (空心/實心 toggle)、未登入 → toast「請先登入才能收藏」、已登入 → 樂觀更新 UI + Firestore 寫入、失敗回滾 + toast「操作失敗，請稍後再試」(FR-028~FR-036) in `src/components/weather/FavoriteButton.jsx`
- [x] T027 [US3] Implement FavoritesBar.jsx — 桌面版天氣卡上方縱向列表 / 手機版地圖上方橫向可捲動 chips (FR-049~FR-058)、每項顯示地點名稱 + weatherCode 圖示 + 氣溫 + ✕ 按鈕 (觸控 ≥44×44px)、進頁面批次載入收藏天氣概要 (WeatherSummary)、按 createdAt 倒序排列 in `src/components/weather/FavoritesBar.jsx`
- [x] T028 [US3] Wire favorites into WeatherPage — FavoriteButton + FavoritesBar 雙向同步、收藏/取消 → 區塊即時更新、點擊收藏項 → 地圖切換到該地點 + 天氣卡更新 + 手機版 smooth scroll (FR-042)、✕ 移除 → 若為當前地點則收藏按鈕同步、無收藏時區塊不顯示 in `src/components/weather/WeatherPage.jsx`
- [x] T029 [US3] Implement favorites-aware initial location restore — 已登入有收藏時：localStorage 上次地點若命中收藏則還原該地點，否則顯示第一個收藏（最新）(FR-064)；優先順序 URL params > 收藏比對 > localStorage > 空狀態 (FR-066) in `src/components/weather/WeatherPage.jsx`

**Checkpoint**: All user stories functional — complete weather page with map, drill-down, favorites

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E 驗證、全尺寸驗收、無障礙

- [x] T030 [P] E2E test — 完整使用者旅程：進入 /weather → 選縣市查天氣 → drill-down 選鄉鎮 → 收藏 → 從收藏區塊切換地點 → 取消收藏 → BackToOverview in `specs/013-pre-run-weather/tests/e2e/weather-page.spec.js`
- [x] T031 [P] Responsive final pass — 桌面 (≥1024px)、平板 (768–1023px)、手機 (<768px) 三尺寸 visual 驗收，觸控目標 ≥ 44×44px (FR-043/FR-055)、手機版名稱縮寫 (FR-041)、Soft Sky 風格一致性 (FR-044~FR-048) in `src/components/weather/weather.module.css`
- [x] T032 [P] Accessibility audit — 地圖區域 ARIA labels、鍵盤導航 (tab order for counties/townships/favorites)、focus 可見性、screen reader 天氣卡朗讀順序
- [x] T033 Run quickstart.md validation — 依 `specs/013-pre-run-weather/quickstart.md` 完整走一遍：安裝依賴、.env 設定、dev server 啟動、所有測試套件通過 (`npm run test` + `npx playwright test`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 completion; T006/T007/T008 [P] after T005
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - Recommended: sequential P1 → P2 → P3 (single developer)
  - Possible: parallel after Foundational (multi-developer)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories
- **US2 (P2)**: After Foundational — extends TaiwanMap/WeatherPage from US1, but independently testable at township interaction level
- **US3 (P3)**: After Foundational — extends WeatherPage from US1, integrates FavoritesBar; independently testable at favorites CRUD level

### Within Each User Story

- Tests MUST be written and FAIL before implementation (RED phase)
- Utility/service before component
- Component variants ([P] Empty/Skeleton/Error) before main component
- Main component before wiring/integration
- `npm run lint` + `npm run type-check` must pass after each task

---

## Parallel Example: User Story 1

```bash
# Launch tests in parallel (RED phase):
T009: "Unit tests for weather-helpers.js"
T010: "Unit tests for Weather API Route"
T011: "Integration test for WeatherPage"

# Launch card variants in parallel:
T014: "WeatherCardEmpty.jsx"
T015: "WeatherCardSkeleton.jsx"
T016: "WeatherCardError.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently — map + weather works
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → 全台地圖選地點查天氣 (MVP!)
3. US2 → 鄉鎮 drill-down + URL/localStorage 持久化
4. US3 → 收藏功能 + 初始地點智慧還原
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to spec.md user story for traceability
- UV 使用 F-D0047 偶數 ID（見 research.md R3，contract 已同步更新）
- Leaflet 整合測試需 mock for jsdom（Leaflet requires real DOM sizing）
- Commit after each task or logical group
