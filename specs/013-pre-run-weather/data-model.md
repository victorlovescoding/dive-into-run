# Data Model: 跑步前天氣頁面

**Branch**: `013-pre-run-weather` | **Date**: 2026-04-12

---

## Entity 1: MapLocation（地圖地點）

前端 only，不持久化。定義地圖上可互動的地理單位。

### 1a. County（縣市）

```js
/**
 * 縣市資料（來自 GeoJSON properties + 靜態對照表）。
 * @typedef {object} County
 * @property {string} code - 縣市代碼，e.g. "63000"（COUNTYCODE from GeoJSON）。
 * @property {string} name - 縣市全名，e.g. "臺北市"。
 * @property {string} nameShort - 手機版縮寫，e.g. "臺北"（去除縣/市後綴）。
 * @property {string} engName - 英文名，e.g. "Taipei City"（COUNTYENG from GeoJSON）。
 * @property {string} forecastId - CWA F-D0047 per-county dataset ID，e.g. "F-D0047-061"。
 */
```

**資料來源**: `counties-10t.json` (GeoJSON properties) + `weather-helpers.js` 靜態對照表 (forecastId mapping)

### 1b. Township（鄉鎮區）

```js
/**
 * 鄉鎮區資料（來自 GeoJSON properties）。
 * @typedef {object} Township
 * @property {string} code - 鄉鎮代碼，e.g. "63000060"（TOWNCODE from GeoJSON）。
 * @property {string} name - 鄉鎮全名，e.g. "大安區"。
 * @property {string} nameShort - 手機版縮寫，e.g. "大安"（去除區/鄉/鎮/市後綴）。
 * @property {string} countyCode - 所屬縣市代碼，e.g. "63000"。
 * @property {string} countyName - 所屬縣市名，e.g. "臺北市"。
 */
```

**資料來源**: `towns-10t.json` (GeoJSON properties)

### 1c. IslandMarker（小離島標示）

```js
/**
 * 小離島標示資料（硬編碼常數）。
 * @typedef {object} IslandMarker
 * @property {string} id - 唯一識別，e.g. "lanyu"。
 * @property {string} displayName - 地圖上顯示名，e.g. "蘭嶼"。
 * @property {number} lat - 緯度。
 * @property {number} lng - 經度。
 * @property {string} targetCounty - 路由目標縣市名，e.g. "臺東縣"。
 * @property {string} targetTownship - 路由目標鄉鎮名，e.g. "蘭嶼鄉"。
 * @property {string} [displaySuffix] - 特殊顯示後綴，e.g. "（含龜山島）"（僅龜山島有）。
 */
```

**資料來源**: `weather-helpers.js` 硬編碼常數 `ISLAND_MARKERS`

### 1d. SelectedLocation（已選地點 — 頁面狀態）

```js
/**
 * 使用者當前選中的地點（頁面狀態）。
 * @typedef {object} SelectedLocation
 * @property {string} countyCode - 當前縣市代碼。
 * @property {string} countyName - 當前縣市名。
 * @property {string | null} townshipCode - 當前鄉鎮代碼（null = 僅選縣市）。
 * @property {string | null} townshipName - 當前鄉鎮名（null = 僅選縣市）。
 * @property {string | null} displaySuffix - 龜山島後綴或 null。
 */
```

**狀態管理**: `useState` in WeatherPage，同步到 URL query params (`history.replaceState`) 和 localStorage。

---

## Entity 2: WeatherInfo（天氣資訊）

前端 only，由 API Route 回傳、正規化後使用。

```js
/**
 * 天氣資訊（API Route 回傳的正規化格式）。
 * @typedef {object} WeatherInfo
 * @property {string} locationName - 地點全名，e.g. "臺東縣 · 蘭嶼鄉"。
 * @property {string} locationNameShort - 手機版縮寫，e.g. "臺東 · 蘭嶼"。
 * @property {TodayWeather} today - 今日天氣。
 * @property {TomorrowWeather} tomorrow - 明日天氣。
 */

/**
 * 今日完整天氣。
 * @typedef {object} TodayWeather
 * @property {number} currentTemp - 當前氣溫（最近時段預報值）。
 * @property {string} weatherDesc - 天氣狀況文字，e.g. "晴時多雲"。
 * @property {string} weatherCode - 天氣代碼（用於選擇天氣圖示）。
 * @property {number} morningTemp - 早上氣溫（白天時段 MaxT 或 Temperature）。
 * @property {number} eveningTemp - 晚上氣溫（夜間時段 MinT 或 Temperature）。
 * @property {number} rainProb - 降雨機率 (0-100)。
 * @property {number} humidity - 相對濕度 (0-100)。
 * @property {UvInfo | null} uv - 紫外線指數（觀測站資料，可能 null）。
 * @property {AqiInfo | null} aqi - 空氣品質（EPA 資料，可能 null）。
 */

/**
 * 明日天氣摘要。
 * @typedef {object} TomorrowWeather
 * @property {string} weatherDesc - 天氣狀況文字。
 * @property {string} weatherCode - 天氣代碼。
 * @property {number} morningTemp - 早上氣溫。
 * @property {number} eveningTemp - 晚上氣溫。
 * @property {number} rainProb - 降雨機率。
 * @property {number} humidity - 相對濕度。
 * @property {UvInfo | null} uv - 紫外線指數（可能無預報資料為 null）。
 */

/**
 * 紫外線指數。
 * @typedef {object} UvInfo
 * @property {number} value - UV 指數數值。
 * @property {string} level - 等級文字，e.g. "中量級"、"過量級"。
 */

/**
 * 空氣品質。
 * @typedef {object} AqiInfo
 * @property {number} value - AQI 數值。
 * @property {string} status - 等級文字，e.g. "良好"、"普通"、"對敏感族群不健康"。
 */
```

**資料來源**: `GET /api/weather` 回傳。由 `weather-api.js` 呼叫並轉換。

### 狀態轉換

```
idle → loading → success | error
       ↕ (切換地區時可從 success/error 回到 loading)
```

- `idle`: 未選擇地區（空狀態 FR-020）
- `loading`: 已選地區，天氣資料載入中（骨架 FR-021）
- `success`: 天氣資料載入完成
- `error`: 載入失敗（錯誤提示 + 重試 FR-022）

---

## Entity 3: FavoriteLocation（收藏地點）

持久化至 Firestore，需登入。

```js
/**
 * 收藏地點（Firestore 文件）。
 * @typedef {object} FavoriteLocation
 * @property {string} id - Firestore 文件 ID（auto-generated）。
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼（null = 縣市級收藏）。
 * @property {string | null} townshipName - 鄉鎮名（null = 縣市級收藏）。
 * @property {string | null} displaySuffix - 龜山島後綴或 null。
 * @property {import('firebase/firestore').Timestamp} createdAt - 收藏時間（serverTimestamp）。
 */
```

### Firestore 路徑

```
users/{uid}/weatherFavorites/{autoId}
```

- 每個使用者的收藏存於自己的子集合
- 用 `serverTimestamp()` 確保排序一致性（FR-058: 按收藏時間倒序）
- 查詢: `orderBy('createdAt', 'desc')`
- 唯一性: 收藏前檢查 `countyCode` + `townshipCode` 組合是否已存在（query `where`）

### Firestore 安全規則

```
match /users/{uid}/weatherFavorites/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

### 驗證規則

- `countyCode`: 必填，必須是合法縣市代碼（22 縣市之一）
- `countyName`: 必填
- `townshipCode`: 可選（null 代表縣市級收藏）
- `townshipName`: 與 townshipCode 同步（有/無）
- 不設收藏數量上限（FR spec）

---

## Entity 4: WeatherSummary（收藏區塊天氣摘要）

前端 only，收藏區塊每項顯示的簡要天氣資訊。

```js
/**
 * 收藏區塊天氣摘要（進頁面時批次載入）。
 * @typedef {object} WeatherSummary
 * @property {string} weatherCode - 天氣代碼（選天氣圖示用）。
 * @property {number | null} currentTemp - 當前氣溫（載入失敗時 null）。
 */
```

**資料來源**: 進頁面時針對所有 FavoriteLocation 批次呼叫 `/api/weather`，取子集欄位。

---

## Entity 5: LastViewedLocation（上次查看地點）

localStorage 持久化，不需登入。

```js
/**
 * 上次查看地點（localStorage）。
 * @typedef {object} LastViewedLocation
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼。
 * @property {string | null} townshipName - 鄉鎮名。
 * @property {string | null} displaySuffix - 龜山島後綴或 null。
 */
```

**localStorage key**: `dive-weather-last-location`
**序列化**: `JSON.stringify` / `JSON.parse`

---

## Relationships

```
IslandMarker ──(routes to)──→ County + Township
SelectedLocation ──(weather query)──→ WeatherInfo
SelectedLocation ──(persists to)──→ LastViewedLocation (localStorage)
FavoriteLocation ──(weather summary)──→ WeatherSummary
FavoriteLocation ──(click navigates)──→ SelectedLocation
```

---

## 新增依賴總覽

| 依賴              | 用途                            | 類型                              |
| ----------------- | ------------------------------- | --------------------------------- |
| `topojson-client` | TopoJSON → GeoJSON runtime 轉換 | production                        |
| `taiwan-atlas`    | 台灣行政區 TopoJSON 靜態資料    | dev/build (複製 JSON 到 public/)  |
| (Fraunces font)   | Display serif 字型              | 透過 `next/font/google`，無需 npm |
