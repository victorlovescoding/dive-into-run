# 天氣頁 UV/AQI 等級標準 UI Spec

> Last-Verified: 2026-05-30

## Problem / Goal

目前天氣頁既有 spec 要求今日 AQI/UV 顯示「數字與等級文字」，但既有 UI 只顯示今日 value。跑者因此能看到數字，卻不一定能立刻理解「這個 UV 或 AQI 落在哪個官方級距」以及今天出門跑步需要採取什麼保守行動。

本設計目標是在不讓天氣頁變成百科頁的前提下，補齊今日「紫外線」與「AQI」的等級標準理解：

- 今日四項指標中，只有今日 UV 與今日 AQI 加強顯示。
- 每個加強指標顯示：數值、官方等級/status、一句保守行動建議、各自的 `i` 說明入口。
- `i` 說明內容只呈現該指標完整級距，並高亮目前所在級距。
- 設計語氣以跑步決策優先，幫使用者快速判斷「今天是否需要調整時間或留意體感」，不做醫療判斷。

## Non-goals

- 不新增跑步適合度評分、綜合風險分數、紅黃綠燈總評。
- 不提供訓練強度、配速、心率區間、課表調整建議。
- 不做醫療建議；不判定使用者是否能跑、是否應停止運動。
- 不把天氣頁改成 UV/AQI 百科頁；說明只放完整官方級距，不延伸污染物濃度細節、計算公式或防曬醫學內容。
- 不改 API、資料型別或資料來源；本 spec 只定義 UI 與內容模型。
- 不改明日摘要的資訊架構：明日仍顯示 UV 數值與等級，不新增 `i`；明日不顯示 AQI。
- 不在每一個級距塞跑者建議；行動建議只顯示在今日指標卡上，且只是一句保守提醒。

## User Experience Requirements

### 今日指標呈現

- 今日天氣區塊的「紫外線」與「AQI」必須從單純 value 升級為：
  - 指標 label：`紫外線` / `AQI`
  - 數值：例如 `8`、`67`
  - 官方等級/status：例如 `過量級`、`普通`
  - 一句保守行動建議
  - `i` 說明入口
- 今日其他指標維持現狀，不因本設計增加說明入口。
- UI 必須保持掃描性：加強後的 UV/AQI 不應壓過當前氣溫、天氣狀況與今日早晚氣溫。
- 若今日 UV 或今日 AQI 為 `null`：
  - 數值顯示 `—`
  - 不顯示官方等級/status
  - 不顯示行動建議
  - 不顯示 `i`

### 明日摘要

- 明日摘要維持現狀：
  - 顯示 UV 數值與等級。
  - 不顯示 UV 的 `i`。
  - 不顯示 AQI。
- 明日 UV 若為 `null`，顯示 `—`，不需要額外空狀態文案。

### 行動建議語氣

- 建議必須短、保守、可快速掃描。
- 建議只描述一般跑步情境的低風險行動，不推論個人健康狀態。
- 可接受範例：
  - UV 高時：`改清晨/傍晚，縮短曝曬`
  - AQI 普通時：`可正常跑，敏感者留意體感`
- 避免文案：
  - `今天不適合跑步`
  - `建議改跑 Zone 2`
  - `心肺功能差者避免運動`
  - `此狀態安全`

## Interaction Model Desktop/Mobile

### Desktop

- 使用者點擊今日 UV 或今日 AQI 旁的 `i` button 時，開啟小型 popover。
- Popover 必須錨定在對應的 `i` button 附近，不遮住主要天氣資訊。
- 同一時間最多只開一個 UV/AQI 說明 popover。
- 點擊另一個指標的 `i` 時，關閉目前 popover 並開啟新的 popover。
- Popover 內容只顯示該指標完整級距，並高亮目前所在級距。
- Popover 必須可透過以下方式關閉：
  - 再次點擊同一個 `i`
  - 點擊外部
  - `Escape`
  - 明確的關閉按鈕或等價可存取關閉操作

### Mobile

- 使用者點擊今日 UV 或今日 AQI 旁的 `i` button 時，開啟 bottom sheet。
- Sheet 標題必須清楚對應單一指標，例如 `紫外線等級` 或 `AQI 等級`。
- Sheet 內容只顯示該指標完整級距，並高亮目前所在級距。
- 同一時間最多只開一個 UV/AQI sheet。
- 新 UV/AQI sheet 不得與既有天氣資訊 bottom sheet 疊層或收合狀態打架；可驗收行為是：
  - 開啟 UV/AQI 說明時，畫面上只呈現該說明 sheet，不同時呈現既有 weather sheet。
  - 關閉 UV/AQI 說明後，不得意外重新展開或改變原本的 weather sheet 狀態。
  - 不限制實作必須採用關閉、替換、共用容器或其他特定 state 管理方式，只要上述行為成立。
- Sheet 必須可透過以下方式關閉：
  - 關閉按鈕
  - `Escape`（有鍵盤時）
  - 點擊遮罩或向下收合（若既有 sheet pattern 支援）

## Content Model and Standards Source

### 官方標準來源

- UV：中央氣象署開放資料「氣象領域資料標準」PDF，`UVIndex` 欄位與紫外線指數分級。官方 URL：https://opendata.cwa.gov.tw/opendatadoc/insrtuction/CWA_Data_Standard.pdf
- AQI：環境部空氣品質監測網「新版空氣品質指標」頁，114 年 1 月 1 日起新版門檻。官方 URL：https://airtw.moenv.gov.tw/CHT/Information/Standard/AirQualityIndicatorNew.aspx

官方來源採用 `Last-Verified` 日期當天可查到的標準。若後續官方頁更新，實作前需重新核對本節表格，不得從舊截圖或非官方整理表更新。

### UV 級距

| 數值 | 官方等級 |
| --- | --- |
| 0-2 | 低量級 |
| 3-5 | 中量級 |
| 6-7 | 高量級 |
| 8-10 | 過量級 |
| 11+ | 危險級 |

### AQI 級距

| 數值 | 官方 status |
| --- | --- |
| 0-50 | 良好 |
| 51-100 | 普通 |
| 101-150 | 對敏感族群不健康 |
| 151-200 | 對所有族群不健康 |
| 201-300 | 非常不健康 |
| 301-400 | 危害 |
| 401-500 | 危害 |

環境部新版頁的 `AQI 指標` 表列將 `危害` 拆成 `301-400` 與 `401-500` 兩列；同頁 `健康影響及活動建議` 表列則將 `301-500` 合併為同一個 `危害` status。天氣頁說明表為了呈現完整官方 AQI 指標級距，應顯示兩列 `危害`；行動建議仍只使用今日指標卡上的一句保守提醒，不依 301-400 或 401-500 再細分。若後續實作需要檢核污染物濃度門檻，必須回到官方頁面，不在本 UI 展示。

### 說明內容格式

- Popover/sheet 只包含：
  - 指標名稱
  - 官方來源短註記與連結
  - 完整級距表
  - 目前級距高亮
- 不包含：
  - 每一級的跑者建議
  - 長段落健康影響
  - AQI 各污染物濃度門檻表
  - UV 防曬百科內容

### 高亮規則

- 若目前值落在某個級距，該列必須有明顯但不刺眼的高亮狀態。
- AQI `301-400` 與 `401-500` 都顯示 `危害`，但高亮必須依目前 AQI 數值落點標示其中一列。
- 高亮不得只靠顏色辨識；至少還要有文字或圖示輔助，例如 `目前` 標記。
- 若 value 為 `null`，不顯示 `i`，因此不會有高亮狀態。

## Accessibility Requirements

- `i` 必須是真正的 `button`，不可用 `div` 或純 icon 代替。
- 手機與觸控裝置上的 `i` button touch target 必須至少 44px。
- `i` button 必須有 accessible name：
  - UV：`查看紫外線等級說明`
  - AQI：`查看 AQI 等級說明`
- `i` button 必須維護 `aria-expanded`。
- `i` button 必須透過 `aria-controls` 指向目前 popover/sheet 的內容容器。
- Popover/sheet 開啟後，焦點管理必須符合互動型 overlay：
  - 鍵盤使用者能進入內容與關閉控制。
  - `Escape` 可關閉。
  - 關閉後 focus 回到原本觸發的 `i` button。
- Popover/sheet 內的關閉控制必須有明確 accessible name，例如 `關閉紫外線等級說明`。
- 目前級距高亮不得只依賴色彩；需提供 `目前` 文字或螢幕閱讀器可讀的同等資訊。
- 若使用 `dialog`/sheet pattern，必須避免背景內容仍被螢幕閱讀器當作 active overlay 內容的一部分。

## Data Compatibility

- 既有資料型別已足夠，不需要改 API 或型別：
  - `TodayWeather.uv: UvInfo | null`
  - `TodayWeather.aqi: AqiInfo | null`
  - `TomorrowWeather.uv: UvInfo | null`
  - `UvInfo.value`
  - `UvInfo.level`
  - `AqiInfo.value`
  - `AqiInfo.status`
- 今日 UI 必須使用既有 `uv.level` 與 `aqi.status` 作為官方等級/status 顯示來源。
- 說明 overlay 可用目前數值決定級距表的高亮列，但不得用前端推導結果取代今日指標卡上的 `uv.level` 或 `aqi.status` 顯示。
- 前端只可將官方級距表作為說明 overlay 的靜態展示資料與高亮依據。
- 若 value 與 level/status 明顯不一致，第一版不在 UI 報錯；後續 plan 可決定是否加測試或資料層 guard。

## Acceptance Criteria

1. 今日 UV 有資料時，天氣頁顯示 UV 數值、`uv.level`、一句保守行動建議與 `i` button。
2. 今日 AQI 有資料時，天氣頁顯示 AQI 數值、`aqi.status`、一句保守行動建議與 `i` button。
3. 今日 UV 為 `null` 時，該指標顯示 `—`，不顯示 `i`、等級或建議。
4. 今日 AQI 為 `null` 時，該指標顯示 `—`，不顯示 `i`、status 或建議。
5. 明日摘要仍顯示 UV 數值與等級；不顯示 UV `i`。
6. 明日摘要不顯示 AQI。
7. 桌面點 UV `i` 時開啟 UV popover；內容顯示 UV 完整級距並高亮目前級距。
8. 桌面點 AQI `i` 時開啟 AQI popover；內容顯示 AQI 完整級距並高亮目前級距。
9. 手機點 UV/AQI `i` 時開啟對應 bottom sheet，而不是桌面 popover。
10. UV/AQI sheet 不會與既有 weather sheet 同時堆疊，且關閉後不造成既有 weather sheet 狀態錯亂。
11. Popover/sheet 中不出現每一級跑者建議、醫療判斷、跑步適合度評分或訓練強度建議。
12. `i` button 是可聚焦的 button，具備 accessible name、`aria-expanded`、`aria-controls`、Escape 關閉與 focus return。
13. 目前級距高亮有非顏色辨識方式，例如 `目前` 標記。
14. AQI 說明表顯示 `301-400 危害` 與 `401-500 危害` 兩列，並在目前 AQI 落入其中一段時只高亮對應列。
15. 官方來源 URL 出現在說明內容或可存取的來源連結中，且只引用中央氣象署與環境部官方頁。

## Implementation Constraints for Later Plan

- 後續 plan 只能改天氣頁 UI/互動與必要的 UI-local helper；不得要求改 API、Firestore schema、weather types 或資料來源。
- 新增的 UV/AQI 說明 overlay 應優先沿用既有天氣頁 overlay/sheet pattern；若既有 pattern 無法直接滿足手機互斥行為，後續 plan 需提出能通過本 spec 驗收的最小調整，但不得把某一種 state 管理設計寫成唯一解。
- 不新增第三方 UI dependency。
- 不新增 legacy `docs/superpowers/specs` 或 `docs/superpowers/plans`。
- 不改 `specs/013-pre-run-weather/spec.md`；本 spec 是針對 UV/AQI 標準 UI 的補充設計。
- 後續實作必須保留天氣頁主要資訊階層：當前天氣與今日摘要優先，UV/AQI 說明為輔助入口。
- 後續測試至少覆蓋：有值、`null`、桌面 popover、手機 sheet、Escape 關閉、focus return、明日不顯示 `i` 與 AQI。
