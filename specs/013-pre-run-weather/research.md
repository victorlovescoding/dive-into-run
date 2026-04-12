# Research: 跑步前天氣頁面

**Date**: 2026-04-12 | **Branch**: `013-pre-run-weather`

---

## R1: 天氣資料來源 — CWA Open Data API

### Decision: 使用中央氣象署 (CWA) Open Data API

**Base URL**: `https://opendata.cwa.gov.tw/api/v1/rest/datastore/{DatasetID}`

### 授權與限制

- **Auth**: Query param `Authorization={API_KEY}`
- **註冊**: https://opendata.cwa.gov.tw 免費註冊，即時取得授權碼
- **Rate Limit**: 官方未明確公告具體數字，無 `X-RateLimit-*` header。建議 server-side 短期快取 (10 分鐘) 降低呼叫頻率
- **CORS**: Response 含 `Access-Control-Allow-Origin: *`，但本專案走 API Route proxy 不需前端直打

### 端點規劃

| 用途         | Dataset ID                   | 說明                 | 回傳粒度                                    |
| ------------ | ---------------------------- | -------------------- | ------------------------------------------- |
| 縣市天氣預報 | **F-C0032-001**              | 今明 36 小時天氣預報 | 縣市級，含 Wx/PoP/MinT/MaxT/CI              |
| 鄉鎮天氣預報 | **F-D0047-0XX** (per-county) | 未來 3 天逐 3 小時   | 鄉鎮級，含 Temperature/Humidity/PoP/Wx/Wind |
| 紫外線觀測   | **O-A0005-001**              | 每日紫外線指數最大值 | 觀測站級                                    |

#### 縣市端點 F-C0032-001 回傳欄位

| elementName | 說明       | 範例                                                          |
| ----------- | ---------- | ------------------------------------------------------------- |
| `Wx`        | 天氣現象   | `parameterName: "晴時多雲"`, `parameterValue: "2"` (天氣代碼) |
| `PoP`       | 降雨機率   | `parameterName: "0"`, `parameterUnit: "百分比"`               |
| `MinT`      | 最低溫度   | `parameterName: "22"`, `parameterUnit: "C"`                   |
| `MaxT`      | 最高溫度   | `parameterName: "31"`, `parameterUnit: "C"`                   |
| `CI`        | 舒適度指數 | `parameterName: "舒適至悶熱"`                                 |

Query: `?Authorization={key}&locationName=臺北市`

#### 鄉鎮端點 F-D0047-0XX per-county ID 對照

| 3 天 ID     | 1 週 ID     | 縣市   |
| ----------- | ----------- | ------ |
| F-D0047-061 | F-D0047-063 | 臺北市 |
| F-D0047-069 | F-D0047-071 | 新北市 |
| F-D0047-049 | F-D0047-051 | 基隆市 |
| F-D0047-005 | F-D0047-007 | 桃園市 |
| F-D0047-009 | F-D0047-011 | 新竹縣 |
| F-D0047-053 | F-D0047-055 | 新竹市 |
| F-D0047-013 | F-D0047-015 | 苗栗縣 |
| F-D0047-073 | F-D0047-075 | 臺中市 |
| F-D0047-017 | F-D0047-019 | 彰化縣 |
| F-D0047-021 | F-D0047-023 | 南投縣 |
| F-D0047-025 | F-D0047-027 | 雲林縣 |
| F-D0047-029 | F-D0047-031 | 嘉義縣 |
| F-D0047-057 | F-D0047-059 | 嘉義市 |
| F-D0047-077 | F-D0047-079 | 臺南市 |
| F-D0047-065 | F-D0047-067 | 高雄市 |
| F-D0047-033 | F-D0047-035 | 屏東縣 |
| F-D0047-001 | F-D0047-003 | 宜蘭縣 |
| F-D0047-041 | F-D0047-043 | 花蓮縣 |
| F-D0047-037 | F-D0047-039 | 臺東縣 |
| F-D0047-045 | F-D0047-047 | 澎湖縣 |
| F-D0047-085 | F-D0047-087 | 金門縣 |
| F-D0047-081 | F-D0047-083 | 連江縣 |

Query: `?Authorization={key}&LocationName=板橋區` (注意大寫 `L`)

#### 鄉鎮端點回傳欄位

| ElementName                | 時間粒度                   | 說明                |
| -------------------------- | -------------------------- | ------------------- |
| Temperature                | 逐時 (DataTime)            | 攝氏溫度            |
| RelativeHumidity           | 逐時                       | 百分比              |
| ApparentTemperature        | 逐時                       | 體感溫度            |
| ProbabilityOfPrecipitation | 逐 3hr (StartTime~EndTime) | 降雨機率            |
| Weather + WeatherCode      | 逐 3hr                     | 天氣現象文字 + 代碼 |
| WeatherDescription         | 逐 3hr                     | 完整中文描述        |
| WindSpeed + WindDirection  | 逐時                       | 風速 (m/s) + 風向   |
| ComfortIndex               | 逐時                       | 舒適度數值 + 文字   |
| DewPoint                   | 逐時                       | 露點溫度            |

### ⚠️ 重要 Gotcha

1. **Param casing 不一致**: F-C0032 用 `locationName` (小寫 l)，F-D0047 用 `LocationName` (大寫 L)。搞混不報錯但會回傳全部資料
2. **JSON 結構不同**: F-C0032 用 `records.location[].weatherElement[]`；F-D0047 用 `records.Locations[].Location[].WeatherElement[]`（注意大小寫）
3. **F-D0047-089 (全台鄉鎮) payload 極大**，應使用 per-county 端點或加 `LocationName` filter

### Rationale

CWA 是台灣氣象資料唯一權威來源，免費、資料完整、回應穩定。

### Alternatives Considered

- **第三方天氣 API (OpenWeatherMap, WeatherAPI)**: 台灣鄉鎮粒度不足，且免費額度有限
- **氣象局網頁爬蟲**: 違反使用條款，不穩定

---

## R2: 空氣品質 (AQI) 資料來源 — 環境部 EPA API

### Decision: 使用環境部 (MOENV) AQI 即時資料 API

CWA **不提供** AQI 資料，須另外串接環境部。

**Base URL**: `https://data.moenv.gov.tw/api/v2/aqx_p_432`
**Auth**: `api_key` query parameter
**註冊**: https://data.moenv.gov.tw 免費註冊，email 收 key（一年效期，需定期更新）
**Rate Limit**: 未註冊 300 次/日，已註冊 **5,000 次/日** (per dataset)

**回傳欄位**: SiteName, County, AQI, Pollutant, Status, PM2.5, PM10, O3, SO2, CO, NO2 等

**用法**: 以 `County` 欄位 match 縣市名稱，取該縣市所有測站 AQI，以最近測站或平均值呈現。

### Rationale

環境部是台灣空氣品質唯一官方資料源。只取今日即時 AQI（FR-025 明確排除明日 AQI）。

### Alternatives Considered

- **AQICN API**: 第三方封裝，台灣資料實際來自同一 EPA 來源，多一層依賴無意義

---

## R3: 紫外線 (UV) 指數策略

### Decision: 今日 + 明日 UV 均從 F-D0047 偶數 ID（逐 12hr / 1 週預報）取得

~~原始研究誤判 F-D0047 不含 UV。~~ 經查 [CWA 官方產品說明文件](https://opendata.cwa.gov.tw/opendatadoc/Forecast/F-D0047-001_093.pdf) 確認：

- **F-D0047 奇數 ID**（逐 3hr，3 天預報）：10 項因子，**不含 UV**
- **F-D0047 偶數 ID**（逐 12hr，1 週預報）：15 項因子，**含 `UVIndex` + `UVExposureLevel`**

因此 API Route 需平行呼叫同一縣市的兩個 dataset：

- 奇數 ID → 溫度、濕度、降雨、天氣等細粒度資料
- 偶數 ID → UV 預報（今日 + 明日皆有）

**不再需要 O-A0005-001 觀測站資料**。

### 端點對照（補充偶數 ID）

例：臺北市 → `F-D0047-061`（3hr）+ `F-D0047-063`（12hr, 含 UV）

完整對照表見 R1 的 per-county ID 表，奇數為 3hr、偶數為 12hr/1 週。

### Rationale

單一來源（CWA F-D0047）統一處理所有天氣 + UV，減少 API 呼叫數量與對照站邏輯。

---

## R4: 台灣行政區 GeoJSON — taiwan-atlas (TopoJSON)

### Decision: 使用 `dkaoster/taiwan-atlas` TopoJSON 資料

**Repo**: https://github.com/dkaoster/taiwan-atlas
**License**: MIT
**原始資料**: 內政部國土測繪中心

| 檔案                | 大小         | 內容                           |
| ------------------- | ------------ | ------------------------------ |
| `counties-10t.json` | **140.5 KB** | 22 縣市 + nation 輪廓          |
| `towns-10t.json`    | **500 KB**   | 368 鄉鎮區 + counties + nation |

**使用方式**:

```js
import { feature } from 'topojson-client'; // ~2KB gzipped
const tw = await fetch('/counties-10t.json').then((r) => r.json());
const geojson = feature(tw, tw.objects.counties);
// 傳給 <GeoJSON data={geojson} />
```

**新增依賴**: `topojson-client` (runtime 轉 TopoJSON → GeoJSON)

**Properties**: COUNTYNAME, COUNTYENG, COUNTYCODE, TOWNNAME, TOWNENG, TOWNCODE

### 鄉鎮載入策略

`towns-10t.json` (500 KB) 包含全台所有鄉鎮。兩種方案：

- **方案 A (推薦)**: 一次載入 `towns-10t.json`，client-side 用 COUNTYCODE filter 取出特定縣市鄉鎮。500 KB gzip 後約 150-200 KB，可接受
- **方案 B**: 用 build script 預先 split 為 per-county 檔案，按需載入。增加 build 複雜度

選擇方案 A：簡單、一次載入後 drill-down 無延遲。

### ⚠️ 龜山島注意

`towns-10t.json` 的 prepublish 流程使用 `mapshaper -filter-slivers`，極小 polygon 可能被移除。龜山島 (~2.84 km²) 需要實測確認是否保留。若被移除，不影響功能（龜山島在全台總覽以 CircleMarker 呈現）。

### Rationale

- 檔案已預先 quantize + simplify，無需自行處理
- MIT license，npm 安裝 (`taiwan-atlas`) 或直接複製 JSON
- WGS84 座標系，Leaflet 直接可用

### Alternatives Considered

- **g0v/twgeojson**: 資料較舊 (1982/2010 boundaries)、多數檔案過大
- **ronnywang/twgeojson**: 多精度版但無 License 標示
- **data.gov.tw 原始 SHP**: 需自行轉換 + 簡化，增加 build 流程

---

## R5: 小離島渲染策略 — CircleMarker + Tooltip

### Decision: 使用 Leaflet CircleMarker + permanent Tooltip

在全台總覽地圖上，蘭嶼/綠島/小琉球/龜山島以 `<CircleMarker>` 呈現而非 polygon，因為在 zoom 7-8（全台）下實際 polygon 太小不可見。

### 座標與路由對照

| 島嶼   | lat   | lng    | 路由目標（縣市 → 鄉鎮） |
| ------ | ----- | ------ | ----------------------- |
| 蘭嶼   | 22.05 | 121.55 | 臺東縣 → 蘭嶼鄉         |
| 綠島   | 22.66 | 121.49 | 臺東縣 → 綠島鄉         |
| 小琉球 | 22.34 | 120.37 | 屏東縣 → 琉球鄉         |
| 龜山島 | 24.84 | 121.95 | 宜蘭縣 → 頭城鎮         |

### 實作概要

```jsx
<CircleMarker
  center={[island.lat, island.lng]}
  radius={8}
  pathOptions={{ fillColor: '#EAF8FC', fillOpacity: 1, color: '#A4C3E4', weight: 2 }}
  eventHandlers={{ click, mouseover, mouseout }}
>
  <Tooltip direction="top" permanent>
    {island.name}
  </Tooltip>
</CircleMarker>
```

- Hover: `fillColor` 漸變至 `#A4C3E4`（CSS transition 不適用 SVG path，需 `setStyle` + requestAnimationFrame 模擬）
- Click: 觸發 drill-down 到對應縣市鄉鎮層，自動選中目標鄉鎮

### Rationale

1. 零額外依賴，React-Leaflet 原生 API
2. 像素固定 radius，不隨 zoom 縮放
3. 可直接套 `#EAF8FC` / `#A4C3E4` 色彩，與 county polygon 一致
4. PRD 說「另外畫成可點擊的標示」— CircleMarker 正是「標示」的語義

### Alternatives Considered

- **Custom icon marker**: 需設計 SVG icon，hover 變色不直觀，跟 polygon 色彩系統不一致
- **放大 GeoJSON polygon**: 座標扭曲 misleading，維護成本高
- **Inset map (小地圖)**: 佔螢幕空間、4 個 MapContainer 同步複雜度過高、手機版塞不下
- **Leaflet.Deflate plugin**: 只為 4 個島引入 plugin 是 overkill

---

## R6: Display Serif 字型 — Fraunces

### Decision: 使用 Fraunces (Google Fonts, variable font)

| 項目            | Fraunces                                 | Playfair Display    | Instrument Serif     |
| --------------- | ---------------------------------------- | ------------------- | -------------------- |
| Variable font   | ✅ 4 axes (wght/opsz/SOFT/WONK)          | ✅ 3 axes           | ❌ 僅 400            |
| 數字設計        | Old-style, playful curves                | 高對比 transitional | Condensed editorial  |
| 中文搭配        | 圓潤 soft serif + PingFang TC → 高度和諧 | 偏正式，對比強烈    | 偏冷，風格落差大     |
| Soft Sky 適合度 | **最高** — SOFT axis 可調圓潤度          | 中等，偏銳利        | 偏低，condensed 冷調 |

### 實作方式

在 `/weather` layout 載入，不影響全站：

```js
// src/app/weather/layout.jsx
import { Fraunces } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
});
```

```css
.temperature {
  font-family: var(--font-fraunces), serif;
  font-weight: 900;
  font-size: 4rem;
  font-variation-settings:
    'SOFT' 100,
    'WONK' 0;
  font-optical-sizing: auto;
}

.locationName {
  font-family: var(--font-fraunces), serif;
  font-weight: 300;
  font-size: 1.5rem;
  font-variation-settings:
    'SOFT' 80,
    'WONK' 0;
}
```

### Rationale

- SOFT axis 是唯一能實現「圓潤 serif」的候選，完美匹配 Soft Sky 風格
- opsz axis 讓大氣溫數字 (48-72px) 與小地名 (18-24px) 各自最佳化
- wght 100-900 連續，一個檔案涵蓋所有用途
- Google Fonts 原生支援 `next/font/google` self-host

### Alternatives Considered

- **Playfair Display**: 經典但偏銳利正式，不夠 airy
- **Instrument Serif**: 好看但非 variable font、condensed 冷調不搭
- **DM Serif Display**: 非 variable font，無 soft 特質

---

## R7: API 整體架構策略

### Decision: Next.js API Route 代理 + 雙源聚合

```
Browser → GET /api/weather?county=臺北市&township=板橋區
           ↓
   Next.js API Route (src/app/api/weather/route.js)
           ↓ 平行發出 3 requests
   ┌───────┼───────┐
   │       │       │
   CWA     CWA     EPA
  3hr     12hr    AQI
  (奇數)  (偶��)   (3)
           ↓
   正規化 → 統一 JSON response → Browser
```

1. **天氣預報 + UV**: CWA F-D0047 奇數 ID（3hr 細粒度：溫度/濕度/降雨/天氣）+ 偶數 ID（12hr：UV 預報）
2. **縣市級**: F-C0032-001（36hr 縣市預報）+ 偶數 ID（UV）
3. **AQI**: EPA aqx_p_432，按 County 欄位匹配（僅今日）

### Server-side 快取

- **Cache-Control**: `s-maxage=600, stale-while-revalidate=300`（10 分鐘 fresh + 5 分鐘 stale）
- 避免相同地區短時間內重複打 CWA/EPA
- 符合 spec：「不做長時間快取」但避免濫用 API

### Client-side 請求管理

- 使用 `AbortController` 取消 in-flight 請求（FR-027: 快速切換時棄舊）
- 收藏區塊進頁面時批次載入多地點天氣概要

---

## R8: 地圖渲染策略 — Leaflet GeoJSON (無 Tile Layer)

### Decision: 純 GeoJSON 圖層，不使用 Tile Layer

地圖不顯示 OpenStreetMap 或任何底圖磚，只渲染行政區 GeoJSON polygon + 小離島 CircleMarker。背景為白色或極淺色。

**理由**:

- PRD 的 Soft Sky 風格要求「天空藍主導、留白大於資料密度」，底圖磚會干擾
- 使用者只需要選地區，不需要街道級資訊
- 減少外部 tile 服務依賴

**Leaflet 設定**:

- `zoomControl: false` — 全台與鄉鎮層各用固定 viewport，無需使用者手動縮放
- `dragging: false`, `scrollWheelZoom: false` — 不允許拖曳/滾輪，切換靠點擊
- `attributionControl: false` — 無 tile provider 不需 attribution（GeoJSON 授權另行標示）

### Alternatives Considered

- **SVG 手繪地圖**: 更輕量但失去地理精度，且已有 Leaflet 基礎設施
- **D3.js projection**: 強大但與現有 React-Leaflet 架構不搭，引入新依賴

---

## R9: 天氣圖示 — CWA 官方 SVG

### Decision: 使用中央氣象署官方天氣圖示

CWA 網站提供與 weatherCode 直接對應的 SVG 天氣圖示，白天/夜晚各一套。

**URL Pattern**:

```
https://www.cwa.gov.tw/V8/assets/img/weather_icons/weathers/svg_icon/day/{code}.svg
https://www.cwa.gov.tw/V8/assets/img/weather_icons/weathers/svg_icon/night/{code}.svg
```

- `{code}` = API 回傳的 `weatherCode`（01~42，零補齊兩位數）
- 白天/夜晚圖示差異：晴天、多雲等圖示有日/月版本

**代碼範圍摘要**:

| 代碼  | 天氣描述           |
| ----- | ------------------ |
| 01    | 晴天               |
| 02    | 晴時多雲           |
| 03    | 多雲時晴           |
| 04    | 多雲               |
| 05-07 | 多雲時陰～陰天     |
| 08-14 | 各類降雨           |
| 15-22 | 雷雨、午後雷陣雨   |
| 23    | 雨或雪             |
| 24-28 | 霧相關             |
| 29-41 | 局部雨、霧雨組合   |
| 42    | 下雪、積冰、暴風雪 |

完整對照表：[WeatherIcon.js](https://www.cwa.gov.tw/Data/js/WeatherIcon.js)

**使用方式**: 建議將 SVG 下載至 `src/data/weather-icons/` 作為靜態資源，避免 runtime 外部依賴。或直接以 `<img>` 引用 CWA URL（需考慮可用性風險）。

### 來源

- [天氣圖示知識頁 — 中央氣象署](https://www.cwa.gov.tw/V8/C/K/Weather_Icon.html)
- [預報產品天氣描述代碼表 (PDF)](https://www.cwa.gov.tw/V8/assets/pdf/Weather_Icon.pdf)
- [WeatherIcon.js — 動態對照表](https://www.cwa.gov.tw/Data/js/WeatherIcon.js)

### Rationale

API 回傳的 weatherCode 與官方圖示 1:1 對應，零額外設計成本。不需要自建 icon set 或第三方天氣圖示庫。
