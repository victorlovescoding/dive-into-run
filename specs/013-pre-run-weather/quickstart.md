# Quickstart: 跑步前天氣頁面

**Branch**: `013-pre-run-weather` | **Date**: 2026-04-12

---

## 環境準備

### 1. API Keys

在 `.env` 新增（不要 commit）：

```env
CWA_API_KEY=your-cwa-api-key-here
EPA_API_KEY=your-epa-api-key-here
```

- **CWA**: https://opendata.cwa.gov.tw 註冊取得授權碼
- **EPA**: https://data.moenv.gov.tw 註冊取得 API key（一年效期）

### 2. 安裝新依賴

```bash
npm install topojson-client
npm install --save-dev taiwan-atlas
```

### 3. 複製 GeoJSON 靜態資料

```bash
mkdir -p src/data/geo
cp node_modules/taiwan-atlas/counties-10t.json src/data/geo/counties.json
cp node_modules/taiwan-atlas/towns-10t.json src/data/geo/towns.json
```

或直接從 CDN/GitHub 下載 JSON 到 `public/geo/`（build 時不需 node_modules）。

---

## 開發流程

### 啟動 dev server

```bash
npm run dev
```

天氣頁面路徑: http://localhost:3000/weather

### 跑測試

```bash
# 單元測試
npx vitest run specs/013-pre-run-weather/tests/unit/

# 整合測試
npx vitest run specs/013-pre-run-weather/tests/integration/

# E2E
npx playwright test specs/013-pre-run-weather/tests/e2e/
```

### Lint + Type check

```bash
npm run lint:changed
npm run type-check:changed
```

---

## 關鍵檔案導覽

| 路徑                                      | 說明                                 |
| ----------------------------------------- | ------------------------------------ |
| `src/app/weather/page.jsx`                | 頁面入口 (Server Component)          |
| `src/app/weather/layout.jsx`              | Weather layout (載入 Fraunces 字型)  |
| `src/app/api/weather/route.js`            | CWA/EPA 代理 API Route               |
| `src/components/weather/WeatherPage.jsx`  | 主 Client Component (`next/dynamic`) |
| `src/components/weather/TaiwanMap.jsx`    | 互動地圖 (Leaflet GeoJSON)           |
| `src/components/weather/WeatherCard.jsx`  | 天氣資訊卡                           |
| `src/components/weather/FavoritesBar.jsx` | 收藏區塊                             |
| `src/lib/weather-api.js`                  | 前端呼叫 /api/weather 封裝           |
| `src/lib/firebase-weather-favorites.js`   | Firestore 收藏 CRUD                  |
| `src/lib/weather-helpers.js`              | 地點名稱格式化、離島對照、URL 工具   |
| `src/data/geo/counties.json`              | 縣市 TopoJSON (140 KB)               |
| `src/data/geo/towns.json`                 | 鄉鎮 TopoJSON (500 KB)               |

---

## 外部 API 快速測試

### CWA 縣市天氣

```bash
curl "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=$CWA_API_KEY&locationName=臺北市"
```

### CWA 鄉鎮天氣（臺北市 3 天預報）

```bash
curl "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-061?Authorization=$CWA_API_KEY&LocationName=大安區"
```

### CWA UV 觀測

```bash
curl "https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0005-001?Authorization=$CWA_API_KEY"
```

### EPA AQI

```bash
curl "https://data.moenv.gov.tw/api/v2/aqx_p_432?api_key=$EPA_API_KEY&format=json&limit=100"
```

---

## 注意事項

- **CWA param casing**: F-C0032 用 `locationName`（小寫 l），F-D0047 用 `LocationName`（大寫 L）
- **Leaflet SSR**: 所有 Leaflet 元件必須透過 `next/dynamic` + `{ ssr: false }` 載入
- **GeoJSON 格式轉換**: `topojson-client` 的 `feature()` 將 TopoJSON 轉為 Leaflet 可用的 GeoJSON
- **收藏功能需登入**: AuthContext 提供 `user` 物件和 `loading` 狀態
- **Toast 系統**: 使用現有 `useToast()` hook 的 `showToast(message, type)`
