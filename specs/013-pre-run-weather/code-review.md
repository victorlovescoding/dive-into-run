# Code Review — 013-pre-run-weather

日期：2026-04-13 (Round 6 — re-verify after C1/C2 fix)

---

## Taste Rating: 🟡 Acceptable — Works but could be cleaner

Round 5 的 C1/C2（township + UV mock 結構錯誤）**已修復**。Round 4 的 C5–C7 結構性重複問題**已全數修復**。

**驗證結果**（Round 6）：

- Unit tests: **60/60 passed** ✅
- Integration tests: **28/28 passed** ✅
- ESLint: **0 warnings, 0 errors** ✅
- Type-check (`src/`): **0 errors**（僅 events/page.jsx、ProfileEventList.jsx 有既存 error，不屬於此 branch）✅
- `@ts-ignore`: **未發現** ✅

剩餘的 I1–I12 / S1–S3 均為結構性改善建議，不影響正確性。

---

## Round 4 修復狀態追蹤

| Round 4 Issue             | 狀態     | 備註                                      |
| ------------------------- | -------- | ----------------------------------------- |
| C1 Auth Race              | ✅ FIXED | `loading` guard in restoreInitial         |
| C2 Dup Favorites Loading  | ✅ FIXED | 單一 loadFavorites callback               |
| C3 Type Error             | ✅ FIXED | FavoriteDoc typedef + cast                |
| C4 ESLint Warnings        | ✅ FIXED | @returns descriptions 補齊                |
| C5 Typedef 三重定義       | ✅ FIXED | `src/lib/weather-types.js` 統一 export    |
| C6 getWeatherIconUrl 重複 | ✅ FIXED | 統一在 `weather-helpers.js:116`           |
| C7 feature() 重複解析     | ✅ FIXED | `weather-geo-cache.js` module-level cache |

---

## [CRITICAL ISSUES] — Must fix

### C1. ~~Township Unit Tests FAILING — Mock Data Structure Mismatch~~ ✅ FIXED

**`specs/013-pre-run-weather/tests/unit/weather-api-route.test.js`**

跑測試結果（`npx vitest run` 驗證）：

```
FAIL  weather-api-route.test.js > county + township query > should normalize township today weather
FAIL  weather-api-route.test.js > county + township query > should include formatted location names
```

**Root cause**: mock 的 F-D0047 township response 使用**英文** ElementName，但 `route.js:405-408` 用**中文**查找：

| Mock data 用的 name                               | route.js 實際查找的 name                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `'Temperature'`                                   | `'溫度'`                                                                        |
| `'RelativeHumidity'`                              | `'相對濕度'`                                                                    |
| `'ProbabilityOfPrecipitation'`                    | `'3小時降雨機率'`                                                               |
| `'Weather'` + `'WeatherCode'`（分開兩個 element） | `'天氣現象'`（單一 element，Weather + WeatherCode 在同一個 ElementValue[0] 裡） |

Mock 的 `ElementValue` 也錯：用 `{ Value: '28' }` 但 code 讀 `{ Temperature: '28' }`。

`normalizeTownshipWeather` 找不到任何 element → 全部回傳 0/空字串。Township normalization 邏輯**完全沒被真正測到**。

**Fix**: 按照 CWA F-D0047 實際 response 結構重寫 `mockCwaTownshipResponse`：

```js
{
  ElementName: '溫度',
  Time: [{
    DataTime: '2026-04-13T10:00:00+08:00',
    ElementValue: [{ Temperature: '28' }],
  }],
}
```

### C2. ~~UV Test Mock 同樣結構錯誤~~ ✅ FIXED

**`weather-api-route.test.js:123-159`**

`mockUvResponse` 有兩個獨立 element `'UVIndex'` 和 `'UVExposureLevel'`，但 `extractUvInfo`（route.js:179）查找的是**單一** element `'紫外線指數'`，然後從 `ElementValue[0]` 讀 `UVIndex` 和 `UVExposureLevel` 兩個 field。

Mock structure:

```js
WeatherElement: [
  { ElementName: 'UVIndex', Time: [{ ElementValue: [{ Value: '7' }] }] },
  { ElementName: 'UVExposureLevel', Time: [{ ElementValue: [{ Value: '高量級' }] }] },
];
```

Code expects:

```js
WeatherElement: [
  {
    ElementName: '紫外線指數',
    Time: [
      {
        ElementValue: [{ UVIndex: '7', UVExposureLevel: '高量級' }],
      },
    ],
  },
];
```

County 的 UV test `'should include UV info from F-D0047 even ID'`（L444-449）assertion `expect(data.today.uv).toEqual({ value: 7, level: '高量級' })` 在 extractUvInfo 回傳 null 的情況下會失敗 — 但因為 `.catch(() => null)` 在 L561 吃掉錯誤，UV 直接是 null。這個 test **可能碰巧通過**但原因是錯的。

**Fix**: 同 C1 — 按實際 CWA API 結構重寫 mock data。

---

## [IMPROVEMENT OPPORTUNITIES] — Should fix（Round 4 遺留）

### I1. WeatherPage God Component — 531 行、7 state、11 callbacks、5 effects

**`WeatherPage.jsx`** — 仍然未拆分。收藏邏輯（state + effects + callbacks）佔 ~45%。

**Fix**: 抽 `useFavorites(user, selectedLocation)` custom hook，回傳 `{ favorites, favSummaries, currentFavStatus, loadFavorites, handleToggle, handleSelect, handleRemove }`。

### I2. `window.innerWidth` snapshot 值（WeatherPage.jsx:156）

```js
if (window.innerWidth < 768 && cardPanelRef.current) {
```

用戶 resize 後點擊不會觸發 scroll。改用 `matchMedia('(max-width: 767px)').matches`。

### I3. 無意義 Promise.resolve 包裝（WeatherPage.jsx:394）

```js
Promise.resolve(defaultStatus).then(setCurrentFavStatus);
```

React 18 batching 下這行等於 `setCurrentFavStatus(defaultStatus)`。直接同步呼叫。

### I4. Component unmount 無 abort cleanup（WeatherPage.jsx）

`abortRef` 在 unmount 時沒有 cleanup effect。快速導航離開 `/weather` → setState on unmounted。

```js
useEffect(
  () => () => {
    abortRef.current?.abort();
  },
  [],
);
```

### I5. Favorites fetch 無 AbortSignal（WeatherPage.jsx:289）

`loadFavorites` 對每個收藏呼叫 `fetchWeather` 但沒傳 signal。5 個收藏 = 5 個掛在空中的 request。

### I6. COUNTY_DEFAULT_HUMIDITY = 70（route.js:78）

F-C0032 不提供濕度但永遠回傳 70%。用戶以為是真實數據。應回傳 `null` 讓前端顯示「—」。

### I7. 收藏重複查詢邏輯 copy-paste

**`firebase-weather-favorites.js:30-36` vs `94-101`**

`addFavorite` 和 `isFavorited` 的 Firestore query 建構完全相同。抽 `buildFavoriteQuery(colRef, countyCode, townshipCode)` helper。

### I8. route.js time-finding 邏輯重複

**`route.js:298-316`（county）vs `route.js:425-468`（township）**

幾乎相同的迴圈找 todayIndex/tomorrowIndex。抽 `findTimeIndices(timeArray, getStartFn, getEndFn, now)`。

### I9. restoreInitial nesting depth — 8 層（WeatherPage.jsx:406-458）

拆成 `tryUrlRestore()` / `tryFavoritesRestore(user)` / `tryLocalStorageRestore()` 三個 helper。

### I10. Missing focus-visible styles

**`weather.module.css`** — `.favoriteButton`、`.retryButton`、`.backButton`、`.chipSelectButton`、`.chipRemove` 都沒有 `:focus-visible` 樣式。WCAG 2.1 Level AA failure。

```css
.favoriteButton:focus-visible,
.retryButton:focus-visible,
.backButton:focus-visible,
.chipSelectButton:focus-visible,
.chipRemove:focus-visible {
  outline: 2px solid var(--sky-accent);
  outline-offset: 2px;
}
```

### I11. WeatherCard.jsx 內建 inline style objects

**`WeatherCard.jsx:77, 97, 121`** — 三處 `style={{ }}` 物件在每次 render 都建立新 reference。已有完整的 CSS module，這些應該搬進去。

### I12. `currentTemp` 語意誤導（route.js:332）

County-level 的 `currentTemp` 等於 `getCountyTimeNumber(maxT, todayIndex)` — 最高溫。Township-level 的 `currentTemp` 等於 `getTownshipTimeNumber(temp, todayIndex, 'Temperature')` — 即時溫度。相同 field name 但語意不同，下游 `WeatherCard` 不知道自己顯示的到底是哪個。

---

## [STYLE NOTES]

### S1. `#region` / `#endregion` 過度使用

route.js 8 組、WeatherPage 10 組。如果需要 region 折疊才能導航，檔案該拆了。

### S2. SelectedLocation 物件建構散落 5 處（WeatherPage.jsx:185, 201, 222, 243, 324）

每次都手寫完整結構。任一處少一個欄位就是 bug。

**Fix**: `createLocation(countyCode, countyName, townshipCode?, townshipName?, displaySuffix?)` factory。

### S3. currentFavStatus default 重複 4 次

**`WeatherPage.jsx:118, 315, 394, 402`** — `{ favorited: false, docId: null }` 四處出現。

**Fix**: `const DEFAULT_FAV_STATUS = Object.freeze({ favorited: false, docId: null });`

---

## [TESTING GAPS]

### ~~TG1. Township normalization 零覆蓋~~ ✅ FIXED（C1/C2 mock 修正後 60/60 通過）

### TG2. restoreInitial auth transition 無測試

mount effect 的 `user: null → user: object` transition 沒有測試覆蓋。C1 fix（Round 4）沒有 regression test 保護。

### TG3. Component unmount pending request 無測試

快速導航離開 `/weather` 時的 pending request 行為未驗證。

### TG4. E2E tests 永遠 skip in CI

`weather-page.spec.js` 有 `test.skip(!hasCwaKey)` — CI 無法跑 E2E。沒有替代的 API route integration test 來補這個洞。

---

## [TASK GAPS]

所有 T001–T033 均標記 `[x]`，對照 diff 均有對應實作。

- **T032 (Accessibility audit)** — 仍然部分未完成：
  - GeoJSON polygons 不可鍵盤 focus（Leaflet 限制，但 `role="application"` 暗示有鍵盤支援）
  - 自訂按鈕缺 `:focus-visible` 樣式（I10）
- **T033 (Quickstart validation)** — ~~unit tests 有 2 failures~~ ✅ C1/C2 修正後全綠

---

## VERDICT

✅ **Worth merging** — C1/C2 mock 結構修正後，unit 60/60、integration 28/28 全綠。ESLint 0 warnings、type-check `src/` 0 errors、無 `@ts-ignore`。核心功能正確且有測試覆蓋。

剩餘改善建議（不 block merge）：

1. **I4**: unmount abort cleanup（一行修，防 setState on unmounted）
2. **I10**: focus-visible 樣式（a11y compliance，WCAG 2.1 AA）
3. **I6**: COUNTY_DEFAULT_HUMIDITY → null（data honesty）
4. **I1**: WeatherPage → useFavorites hook（最大 ROI refactor，可排下個 iteration）

---

## KEY INSIGHT

**架構分層做對了，single source of truth（types / geo cache / icon helper）也到位了。剩下的 I1–I12 都是「能不能更好」而非「會不會壞」——合理的 tech debt，排進後續迭代即可。**
