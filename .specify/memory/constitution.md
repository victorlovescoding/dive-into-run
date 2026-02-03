<!-- 
SYNC IMPACT REPORT
Version: 1.0.0 -> 1.1.0
- Added Principle VI: Modern Development Standards (Airbnb & JSDoc)
- Detailed ESLint 9 + FlatCompat + Airbnb + JSDoc strategy
- Added specific rules for React 19 (no import React)
- Governance updated to reflect new tooling standards
-->
# Dive into Run 專案憲法 (Constitution)

## 核心原則 (Core Principles)

### I. 規格與測試驅動紀律 (SDD/TDD)
**不可協商**: 在沒有明確的書面規格 (SDD) 和失敗的測試 (TDD) 之前，不得開始任何實作。
- **文件即法律 (Documentation as Law)**: **嚴格禁止偏離文件開發**。任何實作細節若與規格書、計畫文件或本憲法不符，將被視為重大缺失。沒有「我覺得這樣比較好」的模糊空間，除非先修改文件並獲得核准。
- **規格優先 (Spec First)**: 程式碼結構必須遵循規格中定義的架構規劃與資料模型。
- **GWT 場景**: 每個使用者故事 (User Story) 必須包含明確的 **Given-When-Then (GWT)** 驗收場景，以定義精確的 UI/UX 互動與結果。
- **邊界情況 (Edge Cases)**: 規格書必須包含明確的邊界情況處理邏輯，以確保系統在極端或錯誤輸入下（如無輸入、非法數值、網路失敗）的穩定性。
- **測試優先 (Test First)**: 你必須在撰寫任何實作程式碼**之前**先撰寫會失敗的測試。
- **零容忍**: **嚴格禁止未經測試的程式碼**。任何邏輯代碼若無對應的測試覆蓋，不得提交或視為「完成」。
- **循環**: 嚴格遵守 紅-綠-重構 (Red-Green-Refactor) 循環。

### II. 嚴格的服務層架構 (Strict Service Layer)
**不可協商**: UI 層與業務邏輯層必須完全分離。
- **隔離 (Isolation)**: 所有 Firebase 邏輯 (Firestore, Auth, Storage) 必須封裝在 `src/lib/` 中。
- **UI 限制**: UI 元件 (Pages/Components) **不得**直接匯入 Firebase SDK (例如 `getDoc`, `runTransaction`)。它們只能呼叫從 `src/lib/` 匯出的非同步函式。
- **資料正規化**: 資料驗證與正規化必須在服務層 (Service Layer) 處理，而非 UI 層。

### III. 使用者體驗與一致性 (UX & Consistency)
**不可協商**: 互動模式與語言的一致性。
- **語言**: 應用程式與所有開發回應必須使用 **正體中文 (Traditional Chinese)**。
- **互動**: 無限捲動必須使用 `IntersectionObserver` 搭配 Firestore 游標 (cursors)。
- **地圖**: 地圖元件必須透過 `next/dynamic` 並設定 `{ ssr: false }` 載入，以確保客戶端穩定性。

### IV. 效能與併發 (Performance & Concurrency)
**不可協商**: 資料處理的安全與效率。
- **併發**: 涉及共享資源限制的操作 (例如：參加活動) 必須使用 `runTransaction`。
- **資料效率**: 配速 (`paceSec`) 應以秒數/公里 (Number) 儲存；路線應儲存為 encoded polylines (`@mapbox/polyline`)。
- **時間戳記**: 所有建立/更新時間必須使用 `serverTimestamp()` 以確保一致性。

### V. 程式碼品質與慣例 (Code Quality & Conventions)
**不可協商**: 可維護性、可讀性與務實主義。
- **MVP 思維**: 嚴格專注於最小可行性產品 (MVP)。不要為了「以後可能需要」而預先建立功能 (YAGNI)。
- **拒絕過度設計 (No Overdesign)**: 保持架構簡單。除非問題複雜度有明確需求，否則拒絕引入複雜模式 (如 Repository Pattern, Clean Architecture Layers)。
- **語言**: 僅使用 **JavaScript** (不使用 TypeScript)。
- **樣式**: 以 **CSS Modules** (`*.module.css`) 為主要樣式方法。
- **Hook 順序**: State -> Context -> Refs -> Effects -> Handlers。
- **註解**: 專注於解釋「為什麼」(意圖)，而非「做什麼」(語法)。

### VI. 現代化開發標準 (Modern Development Standards)
**不可協商**: 遵循 Airbnb 風格精華與 JSDoc 嚴謹性。
- **Airbnb Spirit**: 遵循 Airbnb JavaScript Style Guide 的核心精神。
    - **變數宣告**: 一律使用 `const`，僅在必須重新賦值時使用 `let`。**嚴禁使用 `var`**。
    - **不可變性 (Immutability)**: 優先使用陣列/物件方法（`map`, `filter`, `spread operator`）取代迴圈與變異操作（`push`, `splice`），以符合 React 狀態更新原則。
    - **物件解構**: 強制使用解構賦值 (Destructuring) 來存取物件屬性與陣列元素。
    - **命名慣例**: 變數與函式使用 `camelCase`，React 元件使用 `PascalCase`，常數使用 `UPPER_SNAKE_CASE`。
    - **結尾逗號**: 多行物件與陣列定義必須使用結尾逗號 (Trailing Commas)。
- **React 19 慣例**:
    - **No Import React**: 不需要在檔案頂部寫 `import React from 'react'`，除非使用 Hooks。
    - **Hooks 規則**: 嚴格遵守 `rules-of-hooks`。
- **JSDoc 紀律**:
    - **強制文件**: 每個導出 (exported) 的函式與元件都必須包含完整的 JSDoc 註解。
    - **型別定義**: 必須使用 `@param` 與 `@returns` 定義參數與回傳值的型別，以彌補缺少 TypeScript 的型別檢查。
    - **執法過渡期**: 目前 ESLint 設定為 `warn` 以容許快速迭代，但任何進入 `main` 分支的代碼最終目標應為零警告 (Zero Warnings)。

## 技術約束 (Technology Constraints)

- **框架**: Next.js 15 (App Router)
- **程式庫**: React 19
- **資料庫**: Firebase v9+ (Firestore, Auth, Storage)
- **地圖**: Leaflet, React-Leaflet, Leaflet-Draw
- **測試**: 
    - **Vitest**: 搭配 `jsdom` 與 `@testing-library/react` (用於單元與元件測試)。
    - **Playwright**: 用於端對端 (E2E) 測試。
- **Linting**: 
    - **引擎**: ESLint 9 (Flat Config)。
    - **規範**: 結合 `eslint-config-airbnb` (via FlatCompat) 與 `eslint-plugin-jsdoc`。
    - **閘門**: 每次提交前必須通過 ESLint 檢查（目前設定為 `warn`，未來將升級為 `error`）。

## 工作流程與品質閘門 (Workflow & Quality Gates)

1.  **規劃 (Plan)**: 定義規格與架構。
2.  **測試 (Test)**: 為定義的行為撰寫會失敗的測試。
3.  **實作 (Implement)**: 撰寫能通過測試的最少程式碼，並同時遵守 Airbnb 風格與 JSDoc 要求。
4.  **驗證 (Verify)**: 確保所有新邏輯都有覆蓋率，且 `npm run lint` 無任何錯誤或警告。
5.  **重構 (Refactor)**: 在保持測試通過的前提下清理代碼。

## 治理 (Governance)

本憲法凌駕於所有其他慣例之上。修正案需要文件記錄、批准與遷移計畫。

**規則**:
- 所有 Pull Requests 必須根據這些原則進行驗證。
- 程式碼的複雜度必須在規格中說明理由。
- 使用 `.gemini/GEMINI.md` 獲取具體的執行時開發指引。

**Version**: 1.1.1 | **Ratified**: 2026-02-03 | **Last Amended**: 2026-02-03