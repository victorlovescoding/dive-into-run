# Code Review — 013-pre-run-weather

日期：2026-04-13 (Round 3)

---

## Taste Rating: 🟡 Acceptable — Works but could be cleaner

整體架構合理：API route 做 server-side proxy + normalization、前端 client component 管狀態、Leaflet 純互動地圖。分層清晰。但 WeatherPage.jsx 承擔了太多職責（God Component），加上大量重複的 typedef/function 和一個 confirmed race condition，拉低了整體品味。

---

## [CRITICAL ISSUES] — Must fix

### C1. Auth Race Condition — restoreInitial 雙重執行（已確認 Bug）

**`src/components/weather/WeatherPage.jsx:453`**

```js
useEffect(() => {
  async function restoreInitial() {
    if (user) {
      const favs = await getFavorites(user.uid);
      // ...
    }
    // fallthrough to localStorage
  }
  restoreInitial();
}, [user, restoreLocation]); // ← user 從 null→object 會觸發兩次
```

App mount 時 `user === null`（Firebase Auth 尚未解析），effect 第一次跑空（走 localStorage/empty），auth 完成後 `user` 變物件觸發第二次才讀收藏。結果：畫面先閃 empty/localStorage state，再跳到收藏地點。

**Fix**: AuthContext 應提供 `loading` 狀態，restoreInitial 在 `loading === true` 時 return early，等 auth 確定後再執行。

### C2. Duplicated Favorites Loading Logic

**`src/components/weather/WeatherPage.jsx:288-317` vs `397-437`**

`loadFavorites` callback 和下面的 `useEffect(() => { ... }, [user])` 幾乎是 copy-paste 的同一段邏輯（getFavorites → map fetchWeather → setFavSummaries）。

- 維護兩份一樣的 code = 改一邊忘另一邊
- `loadFavorites` 沒有 `cancelled` guard，effect 版有 — 行為不一致

**Fix**: effect 直接呼叫 `loadFavorites()`，或把共用邏輯抽成一個 function。

### C3. Type Error — getFavorites return type mismatch

**`src/lib/firebase-weather-favorites.js:76`**

```js
return snapshot.docs.map((d) => ({
  id: d.id,
  ...d.data(), // ← d.data() 回傳 DocumentData，TS 不知道有 countyCode 等欄位
}));
```

`type-check` 報錯：回傳 `{ id: string }[]` 不符合 JSDoc 宣告的完整型別。需要 `@type` cast。

### C4. ESLint Warnings — Missing @returns description

**`src/lib/firebase-weather-favorites.js:69,87`**

`getFavorites` 和 `isFavorited` 的 JSDoc `@returns` 缺 description。專案規範要求 0 warnings。

---

## [IMPROVEMENT OPPORTUNITIES] — Should fix

### I1. Typedef 四重定義 — UvInfo / AqiInfo / TodayWeather / TomorrowWeather

同一組 typedef 出現在 **3 個地方**：

| 檔案                   | typedef 數量          |
| ---------------------- | --------------------- |
| `route.js:5-47`        | 5 個 (含 WeatherInfo) |
| `weather-api.js:2-43`  | 5 個                  |
| `WeatherCard.jsx:5-39` | 4 個                  |

（`FavoriteButton.jsx:10-16` 的 `FavoriteLocation` 是獨立 typedef，與上述四組無重疊。）

改一個型別要同步改 3 份。

**Fix**: 放在 `src/lib/weather-types.js` 統一 export，其他檔案用 `@typedef {import(...)}`。

### I2. `getWeatherIconUrl` 重複定義

**`src/components/weather/WeatherCard.jsx:49` vs `FavoritesBar.jsx:28`**

兩份幾乎相同的 function（差異只有 FavoritesBar 版本自己判斷 day/night）。

**Fix**: 抽到 `weather-helpers.js`。

### I3. TopoJSON `feature()` 重複解析大型 JSON

`feature(townsData, townsData.objects.towns)` 被呼叫 **3 次**：

- `WeatherPage.jsx:91`（buildTownshipLookupByCode，module-level）
- `TaiwanMap.jsx:146`（townsGeoJson memo）
- `TaiwanMap.jsx:156`（islandGeoJson memo）

`feature(countiesData, ...)` 也被呼叫 **3 次**（WeatherPage 2 次 + TaiwanMap 1 次）。

towns.json 是 53,000+ 行。每次 `feature()` call 都在做 TopoJSON → GeoJSON 轉換。

**Fix**: 在 module-level shared util 做一次轉換，export 給所有消費者。

### I4. WeatherPage God Component — 7 state + 2 refs + 12 callbacks

`WeatherPage.jsx` 576 行，管理：

- `selectedLocation`, `mapLayer`, `weatherState`, `weatherData`, `favorites`, `favSummaries`, `currentFavStatus`（7 個 useState）
- `abortRef`, `cardPanelRef`（2 個 useRef）
- 4 個 useEffect
- 8+ 個 useCallback

收藏邏輯（state + effects + callbacks）佔了 ~50% 的行數，可以抽成 `useFavorites` hook，順便解決 C1/C2。

### I5. `window.innerWidth` 寫死響應式判斷

**`src/components/weather/WeatherPage.jsx:167`**

```js
if (window.innerWidth < 768 && cardPanelRef.current) {
  cardPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

`window.innerWidth` 是 snapshot 值，不會隨 resize 更新。用戶在桌面版縮小視窗後點擊不會觸發 scroll。

**Fix**: 用 `matchMedia('(max-width: 767px)').matches`。

### I6. 無意義的 Promise.resolve 包裝

**`src/components/weather/WeatherPage.jsx:443`**

```js
Promise.resolve(defaultStatus).then(setCurrentFavStatus);
```

同步值沒必要包 Promise。直接 `setCurrentFavStatus(defaultStatus)` 即可。

### I7. Component unmount 時無 abort cleanup

**`src/components/weather/WeatherPage.jsx:136-176`**

`fetchLocationWeather` 建立 AbortController 存在 `abortRef`，但 component unmount 時沒有 cleanup effect 去 abort pending request。快速導航離開頁面 → setState on unmounted component → React warning。

### I8. Favorites fetch 無 AbortSignal

**`src/components/weather/WeatherPage.jsx:300-309`**

loadFavorites 對每個收藏呼叫 `fetchWeather` 但沒傳 signal。快速切帳號或 unmount 時無法取消。

### I9. COUNTY_DEFAULT_HUMIDITY = 70 語意不清

**`src/app/api/weather/route.js:116`**

縣市級 F-C0032 不提供濕度，永遠回傳 70%。使用者看到「濕度 70%」以為是真實數據。應改回傳 `null` 讓前端顯示 "—"（跟 UV/AQI 的 null handling 一致），或至少在 UI 標註為估計值。

---

## [STYLE NOTES]

### S1. `#region` / `#endregion` 過度使用

route.js 有 8 組、WeatherPage 有 10 組。如果每個檔案都需要大量 region 折疊，真正的問題是檔案太大。

---

## [TESTING GAPS]

### TG1. restoreInitial auth transition 無測試覆蓋

mount effect 的 URL → 收藏 → localStorage 優先順序邏輯沒有測試 `user: null → user: object` 的 transition。現有測試 mock user 為固定值（已登入或 null），不覆蓋 C1 的 race condition。

### TG2. Component unmount 時 pending request 無測試

快速導航離開 `/weather` 時，fetchLocationWeather 的 pending request 行為未驗證。

---

## [TASK GAPS]

對照 `specs/013-pre-run-weather/tasks.md`，所有 T001–T033 均標記 `[x]`：

- **所有 task 皆有對應 code in diff** — 沒有空標記
- **無明顯 scope creep**

**遺漏面**：

- **T032 (Accessibility audit)** 標記完成，但 GeoJSON polygons 沒有鍵盤互動支援（`onEachCounty`/`onEachTownship` 只綁 mouseover/mouseout/click，無 keydown/focus）。Leaflet GeoJSON 層預設不 focusable。T032 描述的「鍵盤導航 for counties/townships」嚴格來說未完成。

---

## VERDICT

❌ **Needs rework** — C1 (auth race condition) 是確認的 production bug，C2 (重複邏輯) 增加維護風險，C3/C4 是 type-check/lint 不通過。建議：先修 C1-C4，Improvement items 可分批處理。

---

## KEY INSIGHT

**WeatherPage.jsx 是一個 576 行的 God Component，把地圖互動、天氣載入、收藏 CRUD、URL sync、localStorage 全塞在一起。** 收藏邏輯抽成 `useFavorites` hook 可以同時解決 C1（auth race）、C2（重複邏輯）、I4（God Component），是 ROI 最高的重構。
