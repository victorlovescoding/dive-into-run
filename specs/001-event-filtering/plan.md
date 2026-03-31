# 實作計畫：活動篩選 (MVP)

> **⚠️ 嚴格執行規範 (Strict Execution Mandate)**
>
> 為了確保專案的穩定性與可維護性，本計畫後續的所有任務執行**必須嚴格遵守本文件定義的範疇與步驟**。
>
> 1.  **禁止發散 (No Deviation)**: 不得隨意添加計畫外的新功能、重構或非必要的代碼更動。
> 2.  **變更控制 (Change Control)**: 若發現必須偏離計畫的情況（如技術瓶頸），必須先更新本計畫文件 (`plan.md`) 並獲得確認後，方可繼續執行。
> 3.  **專注目標 (Stay Focused)**: 優先完成 MVP 定義的核心篩選功能，將優化與擴充留待後續迭代。

**分支**: `001-event-filtering` | **日期**: 2026-01-27 | **規格書**: [specs/001-event-filtering/spec.md](specs/001-event-filtering/spec.md)
**輸入**: 功能規格書、現有程式碼、以及失敗的測試案例 (TDD)。

## 摘要

在 `src/lib/firebase-events.js` 中實作混合式活動篩選系統，並將其整合至 `src/app/events/page.js`。篩選邏輯使用 Firestore 進行高效的地點/時間查詢，並在記憶體中進行距離 (含 ±0.5km 寬容度) 與名額狀況的過濾。UI 將支援縣市區域連動、多條件篩選、自動關閉行為，並確保篩選結果可點擊導向詳情頁 (FR-007)。

## 技術背景 (Technical Context)

**語言/版本**: JavaScript (ES6+)
**主要依賴**: Next.js 15, React 19, Firebase v9+ (Firestore)
**儲存**: Firestore (集合名稱: `events`)
**測試**: Vitest (單元/整合), Playwright (E2E)
**目標平台**: Web (響應式)
**專案類型**: Next.js App Router
**效能目標**: MVP 規模下 (<1000 個活動) 查詢時間 < 1 秒
**約束**: Firestore 單一範圍查詢限制 (透過混合式篩選解決)

## 憲法檢查 (Constitution Check)

_門檻：必須在 Phase 0 研究前通過。在 Phase 1 設計後重新檢查。_

- [x] **規格優先 (Spec First)**: `spec.md` 已存在並核准，且包含 GWT 場景。
- [x] **測試優先 (Test First)**: 已建立失敗的單元測試與 E2E 測試 (`tests/001-event-filtering/`)。
- [x] **服務層 (Service Layer)**: 邏輯封裝在 `src/lib/firebase-events.js` 中。
- [x] **禁止 UI 直接呼叫 SDK**: UI 元件將呼叫服務函式，而非 Firestore SDK。
- [x] **MVP 思維**: 功能範圍限制在核心篩選條件。
- [x] **拒絕過度設計**: 針對次要條件使用簡單的陣列過濾。

## 專案結構

### 文件 (此功能相關)

```text
specs/001-event-filtering/
├── plan.md              # 此檔案
├── research.md          # (略過：架構為標準型)
├── data-model.md        # 唯讀篩選無需更動 Schema
├── quickstart.md        # (略過：標準功能)
├── contracts/           # API 定義
│   └── filtering-service.md
└── tasks.md             # 執行步驟
```

### 原始碼 (專案根目錄)

```text
src/
├── app/
│   └── events/
│       ├── page.js          # UI 整合 (篩選狀態與呼叫)
│       └── events.module.css # 現有樣式 (重用)
└── lib/
    └── firebase-events.js   # 核心邏輯 (queryEvents)

tests/
└── 001-event-filtering/     # TDD 測試 (已建立)
    ├── unit/
    │   └── firebase-events.test.js
    └── e2e/
        └── event-filtering.spec.js
```

**結構決策**: 擴充現有檔案 (`page.js`, `firebase-events.js`) 而非建立新檔案，以維持代碼庫的簡潔性與內聚力。

## 複雜度追蹤 (Complexity Tracking)

| 違反原則之處 | 為什麼需要             | 拒絕更簡單方案的理由                              |
| ------------ | ---------------------- | ------------------------------------------------- |
| 混合式篩選   | Firestore 範圍查詢限制 | 為每一種排列組合建立複合索引對 MVP 來說難以維護。 |
