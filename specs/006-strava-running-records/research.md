# Research: Strava 跑步紀錄串接

**Branch**: `006-strava-running-records` | **Date**: 2026-04-06

---

## R-001: Strava OAuth 2.0 — 純前端可行性

**Decision**: 不可行。必須用 Next.js Route Handlers 當 server-side proxy。

**Rationale**: Strava OAuth token exchange 和 refresh 都要求 `client_secret`。此 secret 不能暴露在前端 JS 中（任何人可用 DevTools 看到）。Next.js Route Handlers 跑在 server side，可用 `process.env`（不帶 `NEXT_PUBLIC_` 前綴）安全存取。

**Alternatives considered**:

- Firebase Cloud Functions：`functions/` 目錄已存在且有 `firebase-admin`，但需要獨立部署、CORS 設定、開發迭代較慢
- 最小 Route Handler（無 Admin SDK）：token 存在 client-readable Firestore，安全性較低
- **選擇 Route Handlers + Admin SDK**：部署跟前端一起，開發體驗最好，token 完全不暴露

---

## R-002: Strava API 端點與限制

**Decision**: 使用 `GET /api/v3/athlete/activities` + `activity:read_all` scope

**Rationale**:

- Activities endpoint 支援 `before`/`after`（epoch）、`page`/`per_page` 參數
- `activity:read_all` 含私人活動，確保使用者看到全部跑步紀錄
- Rate limits：100 read req/15min、1000 read req/day（足夠 MVP 規模）

**Key API details**:

- Authorization: `GET https://www.strava.com/oauth/authorize`
- Token exchange: `POST https://www.strava.com/api/v3/oauth/token`
- Access token 6 小時過期，refresh token 每次輪換
- Token response 含 `athlete` object（id, firstname, lastname, profile）
- Activity response fields: `id`, `name`, `type`, `sport_type`, `distance`(m), `moving_time`(s), `average_speed`(m/s), `start_date_local`, `map.summary_polyline`

---

## R-003: 路線地圖 — Polyline 解碼

**Decision**: 使用已安裝的 `@mapbox/polyline`（^1.2.1）

**Rationale**: 專案 `package.json` 已有此套件，`EventMap.jsx` 已在使用。Strava 的 `summary_polyline` 採用 Google Polyline Algorithm 編碼，`@mapbox/polyline.decode()` 可直接解碼為 `[[lat, lng], ...]` 陣列供 Leaflet 渲染。

**Alternatives considered**:

- `polyline-encoded`: 功能類似但需新增依賴
- 自行實作解碼：不必要，現有套件穩定

---

## R-004: Firestore Token 儲存安全

**Decision**: 獨立 `stravaTokens/{uid}` collection，Firestore rule `allow read, write: if false`，僅 Admin SDK 可存取。

**Rationale**: 現有 `users/{uid}` rule 為 `allow read, write: if isSignedIn() && request.auth.uid == userId`，若 token 嵌入此文件，前端 JS 可讀取 Strava token。獨立 collection 無 client rules = 只有 server code 能碰。

**Alternatives considered**:

- 嵌入 `users/{uid}` 文件：安全性不足
- 加密後存 Firestore：過度工程
- Server memory / session：Next.js Route Handlers 無狀態，不適用

---

## R-005: 活動資料 Collection 結構

**Decision**: Top-level `stravaActivities/{stravaActivityId}` with `uid` field

**Rationale**: Spec 要求「資料儲存架構應支援未來 aggregate 查詢（如月跑量、排行榜）」。Top-level collection 查詢跨使用者資料更直覺。Document ID 用 Strava activity ID 字串，`setDoc(merge: true)` 自動 dedup。

**Alternatives considered**:

- `users/{uid}/stravaActivities/{id}` subcollection：需 `collectionGroup` 做跨使用者查詢，功能上也可行但稍不直覺
