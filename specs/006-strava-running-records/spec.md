# Feature Specification: Strava 跑步紀錄串接

**Feature Branch**: `006-strava-running-records`
**Created**: 2026-04-05
**Status**: Draft
**Input**: 串接 Strava API，讓使用者在平台上瀏覽個人跑步紀錄（距離、配速、時間、路線地圖）

## Clarifications

### Session 2026-04-05

- Q: 同步方式？ → A: 手動同步按鈕，使用者主動點擊才打 Strava API，平常只讀 Firestore
- Q: 同步冷卻時間？ → A: 1 小時，按完同步後按鈕 disable 直到冷卻結束
- Q: Webhook 自動同步？ → A: MVP 不做，維持純前端架構，Webhook 列為未來考量

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Strava 帳號連結 (Priority: P1)

身為跑者，我可以在「跑步」頁面透過 OAuth 授權連結我的 Strava 帳號，連結後看到已連結狀態與帳號名稱，作為瀏覽跑步紀錄的前提。

**Why this priority**: 這是整個功能的基礎。沒有完成 Strava 授權，後續所有跑步紀錄功能都無法使用。

**Independent Test**: 可透過點擊「連結 Strava」按鈕，完成 OAuth 授權流程後，確認頁面顯示已連結狀態與 Strava 帳號名稱來驗證。

**Acceptance Scenarios**:

1. **Given** 已登入但尚未連結 Strava 的使用者，**When** 點擊「連結 Strava」按鈕，**Then** 跳轉至 Strava 授權頁面
2. **Given** 使用者在 Strava 授權頁面同意授權，**When** Strava 回傳授權結果，**Then** 自動跳轉回「跑步」頁面，顯示已連結狀態與 Strava 帳號名稱
3. **Given** 使用者在 Strava 授權頁面拒絕授權，**When** Strava 回傳拒絕結果，**Then** 跳轉回「跑步」頁面，維持未連結狀態並顯示適當提示
4. **Given** 使用者的 Strava 授權已過期，**When** 系統偵測到 token 失效，**Then** 自動更新授權，使用者無需重新手動授權

---

### User Story 2 - 跑步紀錄瀏覽 (Priority: P1)

身為已連結 Strava 的跑者，我可以在「跑步」頁面看到從 Strava 同步過來的跑步紀錄列表，每筆紀錄顯示活動名稱、距離、配速、時間，若有路線資料則顯示路線地圖。紀錄按日期由新到舊排列。

**Why this priority**: 這是功能的核心價值 — 讓使用者在平台上直接看到自己的跑步數據，不用切到 Strava App。

**Independent Test**: 連結 Strava 後，確認頁面顯示跑步紀錄列表，每筆紀錄包含活動名稱、距離(km)、配速(min/km)、時間三項指標橫排，有路線資料的紀錄顯示路線地圖。

**版面規格**:

```
┌──────────────────────────────┐
│  LSKD San Diego 5K            │
│  距離        配速        時間   │
│  5.2 km    5'29"/km    28:30  │
│  ┌─────────────────────────┐  │
│  │     [路線地圖]            │  │
│  └─────────────────────────┘  │
│                               │
│  河濱慢跑                      │
│  距離        配速        時間   │
│  10.1 km   5'46"/km    58:12  │
│  ┌─────────────────────────┐  │
│  │     [路線地圖]            │  │
│  └─────────────────────────┘  │
│  ...                          │
└──────────────────────────────┘
```

**Acceptance Scenarios**:

1. **Given** 已連結 Strava 且有跑步紀錄的使用者，**When** 進入「跑步」頁面，**Then** 看到跑步紀錄列表，按日期由新到舊排列
2. **Given** 一筆跑步紀錄，**When** 顯示在列表中，**Then** 卡片上方為活動名稱，下方橫排顯示距離(km)、配速(min/km)、總時間三項指標
3. **Given** 一筆有路線 GPS 資料的跑步紀錄，**When** 顯示在列表中，**Then** 指標下方顯示路線地圖
4. **Given** 一筆沒有路線資料的跑步紀錄，**When** 顯示在列表中，**Then** 不顯示地圖區塊，僅顯示活動名稱與指標數據
5. **Given** 系統同步跑步紀錄，**When** 篩選活動類型，**Then** 只包含 Run、TrailRun、VirtualRun 三種類型
6. **Given** 使用者首次連結 Strava，**When** 系統開始同步，**Then** 拉取最近 2 個月的歷史紀錄

---

### User Story 3 - 未連結引導畫面 (Priority: P1)

身為尚未連結 Strava 的使用者（已登入或未登入），我在進入「跑步」頁面時會看到清楚的引導畫面，引導我連結 Strava 或先登入。

**Why this priority**: 空狀態的使用者體驗直接影響轉換率，必須在 MVP 就有完善的引導流程。

**Independent Test**: 以未連結 Strava 的帳號及未登入狀態分別進入「跑步」頁面，確認各自看到對應的引導畫面。

**版面規格**:

```
┌──────────────────────────────┐
│                               │
│  連結你的 Strava 帳號          │
│  追蹤你的跑步紀錄              │
│                               │
│     [ 連結 Strava ]            │
│                               │
└──────────────────────────────┘
```

**Acceptance Scenarios**:

1. **Given** 已登入但未連結 Strava 的使用者，**When** 進入「跑步」頁面，**Then** 看到引導畫面，包含標題「連結你的 Strava 帳號」、副標「追蹤你的跑步紀錄」及「連結 Strava」按鈕
2. **Given** 未登入的使用者，**When** 進入「跑步」頁面，**Then** 看到引導登入的畫面
3. **Given** 已連結 Strava 的使用者，**When** 進入「跑步」頁面，**Then** 直接看到跑步紀錄列表，不顯示引導畫面

---

### User Story 4 - 取消 Strava 連結 (Priority: P2)

身為已連結 Strava 的跑者，我可以隨時取消連結，系統會清除我的所有 Strava 相關資料。

**Why this priority**: 使用者控制自己資料的權利很重要，但不影響核心使用流程，可在 MVP 後實作。

**Independent Test**: 已連結的使用者點擊取消連結，確認連結狀態重置且相關資料已清除。

**Acceptance Scenarios**:

1. **Given** 已連結 Strava 的使用者，**When** 點擊「取消連結」，**Then** 系統顯示確認提示
2. **Given** 使用者確認取消連結，**When** 系統處理完成，**Then** 刪除該使用者的所有 Strava 相關資料（token、活動紀錄），頁面回到未連結引導畫面

---

### User Story 5 - 分頁載入更多紀錄 (Priority: P2)

身為跑者，我可以透過無限滾動載入更多歷史跑步紀錄，不需要一次載入全部資料。每次載入 10 筆。

**Why this priority**: 改善大量紀錄時的載入效能與體驗，但初始版本顯示有限筆數已可使用。

**Independent Test**: 捲動至列表底部附近，確認自動載入下一批 10 筆紀錄。

**Acceptance Scenarios**:

1. **Given** 使用者進入「跑步」頁面，**When** 頁面載入完成，**Then** 顯示最新 10 筆跑步紀錄
2. **Given** 使用者有超過 10 筆跑步紀錄，**When** 捲動接近列表底部，**Then** 自動載入下一批 10 筆紀錄
3. **Given** 所有紀錄已載入完畢，**When** 捲動至底部，**Then** 顯示「已載入全部紀錄」提示

---

### Edge Cases

- 使用者連結 Strava 後在 Strava 端撤銷授權：系統偵測到 token 無效且無法自動更新時，提示使用者重新連結
- Strava API 暫時無法連線：顯示已快取的紀錄（若有），並提示使用者稍後再試
- 使用者最近 2 個月內沒有任何跑步紀錄：顯示空狀態提示，例如「目前沒有跑步紀錄，去跑一趟吧！」
- 使用者的跑步活動沒有 GPS 路線資料（如室內跑步機）：正常顯示指標數據，不顯示地圖

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統必須支援透過 Strava OAuth 2.0 授權流程連結使用者的 Strava 帳號
- **FR-002**: 系統必須在授權成功後顯示已連結狀態與 Strava 帳號名稱
- **FR-003**: 系統必須在 Strava 授權 token 過期時自動更新，不需使用者介入
- **FR-004**: 系統必須同步使用者最近 2 個月的跑步紀錄（活動類型：Run、TrailRun、VirtualRun）
- **FR-005**: 頁面預設從 Firestore 已同步資料讀取紀錄。提供「同步」按鈕讓使用者手動觸發從 Strava 拉取最新資料，按鈕冷卻時間 1 小時（按完後 disable 直到冷卻結束）
- **FR-006**: 每筆跑步紀錄必須顯示：活動名稱、距離(km)、配速(min/km)、總時間，三項指標橫排呈現
- **FR-007**: 若跑步紀錄含有路線 GPS 資料，系統必須在卡片內顯示路線地圖
- **FR-008**: 跑步紀錄必須按日期由新到舊排列
- **FR-009**: 未登入使用者進入「跑步」頁面時，必須看到引導登入畫面
- **FR-010**: 已登入但未連結 Strava 的使用者進入「跑步」頁面時，必須看到引導連結畫面
- **FR-011**: 導覽列必須新增「跑步」連結，位於「揪團」之後
- **FR-012**: 所有跑步紀錄與 Strava 連結狀態僅限本人可見
- **FR-013**: （P2）使用者必須能取消 Strava 連結，系統應刪除該使用者的所有 Strava 相關資料
- **FR-014**: （P2）跑步紀錄列表必須支援捲動分頁載入

### Key Entities

- **Strava 連結（Strava Connection）**：代表使用者與 Strava 帳號的授權關係，包含授權憑證、Strava 帳號識別資訊、連結狀態
- **跑步紀錄（Running Activity）**：一次跑步活動的摘要資訊，包含活動名稱、距離、配速、時間、活動類型、日期、路線座標（選填），隸屬於某位使用者

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 使用者能在 30 秒內完成 Strava 帳號連結流程（從點擊按鈕到看到已連結狀態）
- **SC-002**: 首次連結後，使用者在 10 秒內看到跑步紀錄列表開始載入
- **SC-003**: 已連結使用者回訪「跑步」頁面時，2 秒內顯示紀錄列表
- **SC-004**: 授權 token 自動更新對使用者完全透明，0 次需要手動重新授權的情況
- **SC-005**: 90% 以上有 GPS 路線資料的活動能成功顯示路線地圖

## Assumptions

- 使用者已有 Strava 帳號並曾在 Strava 上記錄跑步活動
- 平台已具備使用者登入/驗證機制
- Strava API Client ID / Secret 已取得並設定於環境變數
- Strava API rate limit（讀取：100 次/15 分鐘、1,000 次/日）在目前用戶規模下足以應付
- 日常使用時使用者透過手動同步按鈕觸發資料更新（增量同步最近一次同步後的新活動），平常只讀本地儲存
- 資料儲存架構應支援未來 aggregate 查詢（如月跑量、排行榜）
