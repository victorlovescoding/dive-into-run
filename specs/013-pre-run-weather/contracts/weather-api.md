# API Contract: Weather API Route

**Endpoint**: `GET /api/weather`
**File**: `src/app/api/weather/route.js`

---

## Request

### Query Parameters

| Param      | Type   | Required | Description                                   |
| ---------- | ------ | -------- | --------------------------------------------- |
| `county`   | string | ✅       | 縣市全名，e.g. `臺北市`                       |
| `township` | string | ❌       | 鄉鎮全名，e.g. `板橋區`。省略時回傳縣市級天氣 |

### Example Requests

```
GET /api/weather?county=臺北市
GET /api/weather?county=新北市&township=板橋區
GET /api/weather?county=臺東縣&township=蘭嶼鄉
```

---

## Response

### Success (200)

```json
{
  "ok": true,
  "data": {
    "locationName": "新��市 · 板橋區",
    "locationNameShort": "新北 · 板橋",
    "today": {
      "currentTemp": 28,
      "weatherDesc": "晴時多雲",
      "weatherCode": "2",
      "morningTemp": 30,
      "eveningTemp": 24,
      "rainProb": 10,
      "humidity": 72,
      "uv": { "value": 7, "level": "高量級" },
      "aqi": { "value": 45, "status": "良好" }
    },
    "tomorrow": {
      "weatherDesc": "多雲時陰",
      "weatherCode": "5",
      "morningTemp": 29,
      "eveningTemp": 23,
      "rainProb": 30,
      "humidity": 78,
      "uv": null
    }
  }
}
```

### Field Notes

- `currentTemp`: 最接近當前時間的預報溫度（F-D0047 逐時 Temperature，或 F-C0032 當前時段 MinT~MaxT 中間值）
- `morningTemp` / `eveningTemp`: 白天/夜間時段溫度（依 CWA 原生時段劃分）
- `weatherCode`: CWA 天氣代碼，前端用此選擇天���圖示
- `uv`: 可能為 `null`（觀測站未覆蓋或夜間無資��）
- `aqi`: 可能為 `null`（EPA 測站未覆蓋或 API 不可用）；明日天氣 **不含** aqi 欄位
- `uv` in tomorrow: 可能為 `null`（CWA 未提供 UV 預報）

### Error (400)

```json
{
  "ok": false,
  "error": "Missing required parameter: county"
}
```

### Error (502)

```json
{
  "ok": false,
  "error": "Failed to fetch weather data"
}
```

上游 API (CWA/EPA) 不可用時回傳 502。

---

## Caching

```
Cache-Control: s-maxage=600, stale-while-revalidate=300
```

- 10 分鐘 server cache + 5 分鐘 stale-while-revalidate
- 由 Next.js / Vercel 邊緣快取處理

---

## Backend Flow

```
1. Parse & validate query params
2. Determine API endpoints:
   - township provided? → F-D0047-{county_id} + LocationName filter
   - county only? → F-C0032-001 + locationName filter
3. Parallel fetch:
   a. CWA weather forecast (F-C0032-001 or F-D0047 odd ID, 3hr)
   b. CWA UV forecast (F-D0047 even ID, 12hr — UVIndex + UVExposureLevel)
   c. EPA AQI (aqx_p_432, filter by county)
4. Normalize into WeatherInfo shape
5. Return JSON with cache headers
```
