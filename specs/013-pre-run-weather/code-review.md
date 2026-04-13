# Code Review — 013-pre-run-weather

日期：2026-04-13 (Round 4)

---

## Taste Rating: 🟡 Acceptable — Works but could be cleaner

分層合理：API route 做 server-side proxy + normalization、前端 client component 管狀態、Leaflet 純互動地圖。Round 3 的 C1–C4 在 working tree 已修復（auth race condition、重複 favorites loading、type error、ESLint warnings）。但核心結構問題依然存在：**typedef 三重定義**是正在倒數的維護炸彈、**`getWeatherIconUrl` 重複定義**是 copy-paste 工程、**`feature()` 對 53,000 行 TopoJSON 重複解析 6 次**是不必要的計算浪費、**WeatherPage 576 行 God Component** 把地圖互動 / 天氣載入 / 收藏 CRUD / URL sync / localStorage 全塞在一起。這些不是理論問題 — 是真正會在下次改需求時咬你一口的東西。

---

## [CRITICAL ISSUES] — Must fix

### C1. ~~Auth Race Condition~~ ✅ FIXED (working tree)

~~`WeatherPage.jsx:453` — `restoreInitial` 在 `user: null→object` 時雙重觸發。~~

**修復**：destructure `loading` from AuthContext，`restoreInitial` 開頭加 `if (loading) return;`，dependency array 加 `loading`。

### C2. ~~Duplicated Favorites Loading Logic~~ ✅ FIXED (working tree)

~~`WeatherPage.jsx:288-317` vs `397-437` — copy-paste 的同一段邏輯。~~

**修復**：effect 改為 `(async () => { await loadFavorites(); })();`，dependency 改 `[loadFavorites]`。

### C3. ~~Type Error — getFavorites return type mismatch~~ ✅ FIXED (working tree)

~~`firebase-weather-favorites.js:76` — `d.data()` 回傳 `DocumentData`。~~

**修復**：新增 `FavoriteDoc` typedef + `@type` cast。

### C4. ~~ESLint Warnings — Missing @returns description~~ ✅ FIXED (working tree)

~~`firebase-weather-favorites.js:69,87` — `@returns` 缺 description。~~

**修復**：`getFavorites` → 「使用者的收藏地點列表。」、`isFavorited` → 「收藏狀態與文件 ID。」

### C5. Typedef 三重定義 — UvInfo / AqiInfo / TodayWeather / TomorrowWeather / WeatherInfo

同一組 typedef 出現在 **3 個檔案**：

| 檔案                   | typedef 數量          |
| ---------------------- | --------------------- |
| `route.js:5-47`        | 5 個 (含 WeatherInfo) |
| `weather-api.js:2-43`  | 5 個                  |
| `WeatherCard.jsx:5-39` | 4 個                  |

改一個型別要同步改 3 份。這不是「有空再改」— 這是你第一次忘記改其中一份就會出 type mismatch bug 的定時炸彈。

**Fix**: 放在 `src/lib/weather-types.js` 統一 export，其他檔案用 `@typedef {import(...)}`。

### C6. `getWeatherIconUrl` 重複定義

**`WeatherCard.jsx:49` vs `FavoritesBar.jsx:28`**

兩份幾乎相同的 function。WeatherCard 版接受 `(weatherCode, period)` 兩個參數，FavoritesBar 版只接受 `(weatherCode)` 並自己判斷 day/night。行為不一致但名字相同。

**Fix**: 抽到 `src/lib/weather-helpers.js`，統一 signature：

```js
export function getWeatherIconUrl(weatherCode, period) {
  if (!period) {
    const hour = new Date().getHours();
    period = hour >= 6 && hour < 18 ? 'day' : 'night';
  }
  const code = String(weatherCode).padStart(2, '0');
  return `https://www.cwa.gov.tw/V8/assets/img/weather_icons/weathers/svg_icon/${period}/${code}.svg`;
}
```

### C7. `feature()` 重複解析大型 TopoJSON — 6 次呼叫

`feature(townsData, townsData.objects.towns)` 被呼叫 **3 次**：

- `WeatherPage.jsx:91`（buildTownshipLookupByCode，module-level）
- `TaiwanMap.jsx:146`（townsGeoJson useMemo）
- `TaiwanMap.jsx:156`（islandGeoJson useMemo）

`feature(countiesData, countiesData.objects.counties)` 被呼叫 **3 次**：

- `WeatherPage.jsx:49`（buildCountyCodeLookup，module-level）
- `WeatherPage.jsx:73`（buildCountyNameByCode，module-level）
- `TaiwanMap.jsx:138`（countiesGeoJson useMemo）

towns.json 是 53,000+ 行。每次 `feature()` call 都在做 TopoJSON → GeoJSON 完整轉換。module-level 的 3 次無法避免（app 啟動時跑一次），但 TaiwanMap 的 3 次是 per-component-mount 且可以用 shared module-level cache 消除。

**Fix**: 在 shared module-level 做一次轉換，export 給所有消費者：

```js
// src/lib/weather-geo-cache.js
import { feature } from 'topojson-client';
import countiesData from '@/data/geo/counties.json';
import townsData from '@/data/geo/towns.json';

export const countiesGeoJson = feature(countiesData, countiesData.objects.counties);
export const townsGeoJson = feature(townsData, townsData.objects.towns);
```

WeatherPage 的 lookup builder 和 TaiwanMap 的 memo 都從這裡 import，全程式只解析一次。

---

## [IMPROVEMENT OPPORTUNITIES] — Should fix

### I1. WeatherPage God Component — 7 state + 2 refs + 11 callbacks + 5 effects

`WeatherPage.jsx` ~540 行（C2 修復後），管理：

- `selectedLocation`, `mapLayer`, `weatherState`, `weatherData`, `favorites`, `favSummaries`, `currentFavStatus`（7 useState）
- `abortRef`, `cardPanelRef`（2 useRef）
- 5 useEffect、9+ useCallback

收藏邏輯（state + effects + callbacks）佔了 ~45% 的行數。抽成 `useFavorites(user)` hook 同時解決集中度問題。

### I2. `window.innerWidth` 寫死響應式判斷

**`WeatherPage.jsx:167`**

```js
if (window.innerWidth < 768 && cardPanelRef.current) {
```

`window.innerWidth` 是 snapshot 值，不會隨 resize 更新。用戶在桌面版縮小視窗後點擊不會觸發 scroll。

**Fix**: `matchMedia('(max-width: 767px)').matches`。

### I3. 無意義的 Promise.resolve 包裝

**`WeatherPage.jsx:407`**

```js
Promise.resolve(defaultStatus).then(setCurrentFavStatus);
```

同步值沒必要包 Promise。直接 `setCurrentFavStatus(defaultStatus)` 即可。這行唯一的「作用」是把 setState 推到 microtask，但 React 18 batching 已經處理了這個問題。

### I4. Component unmount 時無 abort cleanup

**`WeatherPage.jsx:148-176`**

`fetchLocationWeather` 建立 AbortController 存在 `abortRef`，但 component unmount 時沒有 cleanup effect 去 abort pending request。快速導航離開 `/weather` → setState on unmounted component。

**Fix**: 加一個 cleanup effect：

```js
useEffect(() => {
  return () => {
    if (abortRef.current) abortRef.current.abort();
  };
}, []);
```

### I5. Favorites fetch 無 AbortSignal

**`WeatherPage.jsx:300-309`**

`loadFavorites` 對每個收藏呼叫 `fetchWeather` 但沒傳 signal。快速切帳號或 unmount 時無法取消。5 個收藏 = 5 個掛在空中的 request。

### I6. COUNTY_DEFAULT_HUMIDITY = 70 語意不清

**`route.js:116`**

縣市級 F-C0032 不提供濕度，永遠回傳 70%。使用者看到「濕度 70%」以為是真實數據。應回傳 `null` 讓前端顯示 "—"（跟 UV/AQI 的 null handling 一致），或至少在 UI 標註為估計值。

### I7. 收藏重複查詢邏輯 copy-paste

**`firebase-weather-favorites.js:30-36` vs `94-101`**

`addFavorite` 和 `isFavorited` 有完全相同的 Firestore query 建構邏輯（countyCode + townshipCode null handling）。

**Fix**: 抽成 `buildFavoriteQuery(colRef, countyCode, townshipCode)` helper。

### I8. route.js time-finding 邏輯重複

**`route.js:336-358`（county）vs `route.js:463-506`（township）**

兩段幾乎相同的迴圈找 todayIndex/tomorrowIndex，差異只在欄位名（camelCase vs PascalCase — 反映 CWA API 的不一致）。

**Fix**: 抽成 `findTimeIndices(timeArray, getStartFn, getEndFn, now)` 接受欄位存取 function。

### I9. restoreInitial nesting depth — 8 層

**`WeatherPage.jsx:417-469`**

`useEffect → async function → if (loading) → if (fromUrl) → if (user) → try → if (favs.length) → if (match)` — 8 層深。Linus 的規則是 3 層以上就要重構。

**Fix**: 拆成 `tryUrlRestore()` / `tryFavoritesRestore(user)` / `tryLocalStorageRestore()` 三個 helper，restoreInitial 變成三行的 priority chain。

### I10. Missing focus-visible styles on custom buttons

**`weather.module.css`**

`.favoriteButton`、`.retryButton`、`.backButton`、`.chipSelectButton`、`.chipRemove` 都沒有 `:focus-visible` 樣式。鍵盤導航用戶看不到 focus indicator — WCAG 2.1 Level AA failure。

**Fix**: 每個互動元素加 `:focus-visible { outline: 2px solid var(--sky-accent); outline-offset: 2px; }`。

---

## [STYLE NOTES]

### S1. `#region` / `#endregion` 過度使用

route.js 有 8 組、WeatherPage 有 10 組。如果每個檔案都需要大量 region 折疊，真正的問題是檔案太大。Region 是症狀的繃帶，不是治療。

### S2. SelectedLocation 物件建構散落 5 處

`WeatherPage.jsx:196, 214, 233, 251, 335` — 每次都手寫 `{ countyCode, countyName, townshipCode, townshipName, displaySuffix }` 結構。任一處少一個欄位就是 bug。

**Fix**: `createLocation(countyCode, countyName, townshipCode?, townshipName?, displaySuffix?)` factory function。

### S3. currentFavStatus default 重複 4 次

`WeatherPage.jsx:129, 363, 405, 413` — `{ favorited: false, docId: null }` 四處出現。

**Fix**: `const DEFAULT_FAV_STATUS = Object.freeze({ favorited: false, docId: null });`

---

## [TESTING GAPS]

### TG1. restoreInitial auth transition 無測試覆蓋

mount effect 的 URL → 收藏 → localStorage 優先順序邏輯沒有測試 `user: null → user: object` 的 transition。現有測試 mock user 為固定值（已登入或 null），不覆蓋 C1 的 race condition。C1 雖已修復，但沒有迴歸測試保護。

### TG2. Component unmount 時 pending request 無測試

快速導航離開 `/weather` 時，fetchLocationWeather 的 pending request 行為未驗證。

---

## [TASK GAPS]

對照 `specs/013-pre-run-weather/tasks.md`，所有 T001–T033 均標記 `[x]`：

- **所有 task 皆有對應 code in diff** — 沒有空標記
- **無明顯 scope creep**

**遺漏面**：

- **T032 (Accessibility audit)** 標記完成，但：
  - GeoJSON polygons 沒有鍵盤互動支援（`onEachCounty`/`onEachTownship` 只綁 mouseover/mouseout/click，無 keydown/focus）。Leaflet GeoJSON 層預設不 focusable
  - 所有自訂按鈕缺少 `:focus-visible` 樣式（見 I10）
  - T032 描述的「鍵盤導航 for counties/townships」嚴格來說未完成

---

## VERDICT

🟡 **Conditionally merge-ready** — Round 3 的 C1–C4 已在 working tree 修復，type-check 和 lint 均通過。新標記的 C5–C7 是結構性重複問題（typedef 三重定義、function 重複、TopoJSON 重複解析），**不影響正確性但嚴重影響可維護性**。

建議：

1. Commit C1–C4 fixes（已完成）
2. C5–C7 + I7–I8 可作為獨立 refactor PR 處理（extract `weather-types.js`、`weather-geo-cache.js`、shared helpers）
3. I1（God Component → `useFavorites` hook）ROI 最高但改動最大，可排下一個 iteration
4. I10（focus-visible）是 a11y compliance，應盡快修

---

## KEY INSIGHT

**這個 codebase 的核心問題是「有意識的重複」—— typedef 定義 3 次、icon URL helper 定義 2 次、TopoJSON 解析 6 次、favorite query 建構 2 次、time-finding 邏輯 2 次。每一處重複都不是懶惰，而是「當時最快的做法」。但累積起來，下次改 WeatherInfo 結構你要改 3 個檔案、改天氣圖示 URL 你要改 2 個 function、改 GeoJSON 資料來源你要改 6 個 call site。治本之道是一句話：single source of truth。**
