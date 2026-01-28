<!-- 
SYNC IMPACT REPORT
Version: 0.0.0 -> 1.0.0
- Defined Principle I: Specification & Test-Driven Discipline (SDD/TDD)
- Defined Principle II: Strict Service Layer Architecture
- Defined Principle III: User Experience & Consistency
- Defined Principle IV: Performance & Concurrency
- Defined Principle V: Code Quality & Conventions
- Filled Section 2: Technology Constraints
- Filled Section 3: Workflow & Quality Gates
- Updated Governance dates
- Templates requiring updates: ✅ None (Templates align with new principles)
-->
# Dive into Run 專案憲法 (Constitution)

## 核心原則 (Core Principles)

### I. 規格與測試驅動紀律 (SDD/TDD)
**不可協商**: 在沒有明確的書面規格 (SDD) 和失敗的測試 (TDD) 之前，不得開始任何實作。
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

## 技術約束 (Technology Constraints)

- **框架**: Next.js 15 (App Router)
- **程式庫**: React 19
- **資料庫**: Firebase v9+ (Firestore, Auth, Storage)
- **地圖**: Leaflet, React-Leaflet, Leaflet-Draw
- **Linting**: 每次提交前必須通過 ESLint 檢查。

## 工作流程與品質閘門 (Workflow & Quality Gates)

1.  **規劃 (Plan)**: 定義規格與架構。
2.  **測試 (Test)**: 為定義的行為撰寫會失敗的測試。
3.  **實作 (Implement)**: 撰寫能通過測試的最少程式碼。
4.  **重構 (Refactor)**: 在保持測試通過的前提下清理代碼。
5.  **驗證 (Verify)**: 確保所有新邏輯都有覆蓋率且通過 Linting。

## 治理 (Governance)

本憲法凌駕於所有其他慣例之上。修正案需要文件記錄、批准與遷移計畫。

**規則**:
- 所有 Pull Requests 必須根據這些原則進行驗證。
- 程式碼的複雜度必須在規格中說明理由。
- 使用 `.gemini/GEMINI.md` 獲取具體的執行時開發指引。

**Version**: 1.0.0 | **Ratified**: 2026-01-27 | **Last Amended**: 2026-01-27
