<!--
SYNC IMPACT REPORT
Version: 1.3.0 -> 1.4.0
- Updated Principle I: Test structure migrated from tests/ to specs/<feature>/tests/ and specs/<feature>/test-results/
- Updated Principle I: Added <feature> = git branch name convention
- Updated Quality Gates: Added lint:changed and type-check:changed scoped commands
- Updated grep path: src tests → src specs
- Templates updated: plan-template.md (✅), tasks-template.md (✅)
- No deferred TODOs.
-->
# Dive into Run 專案憲法 (Constitution)

## 核心原則 (Core Principles)

### I. 規格與測試驅動紀律 (SDD/TDD)
**不可協商**: 在沒有明確的書面規格 (SDD) 和失敗的測試 (TDD) 之前，不得開始任何實作。
- **文件即法律**: **嚴格禁止偏離文件開發**。任何實作細節若與規格書不符，視為重大缺失。
- **測試結構**: `specs/<feature>/tests/[unit|integration|e2e]/`
- **測試結果**: `specs/<feature>/test-results/[unit|integration|e2e]/`
    - `<feature>` 對應 git 分支名稱（e.g. `003-strict-type-fixes`）
- **測試策略 (Testing Trophy)**: 遵循 Kent C. Dodds 的測試獎盃模型。
    - **整合測試 (Integration, 60%)**: 重點測試元件行為與服務層整合 (The Three Musketeers: `dom`, `react`, `user-event`)。
    - **單元測試 (Unit, 20%)**: 專注於關鍵業務邏輯與 Helper。**必須 100% 隔離** (使用 `vi.mock`，不連線 Firebase/Emulator)。
    - **E2E 測試 (20%)**: 專注於關鍵使用者旅程 (Happy Paths)。
- **Mocking 規範**:
    - **單元測試**: 嚴格禁止使用真實 Firebase SDK 或模擬器，必須使用 Factory Mocks。
    - **整合測試**: 優先 Mock 服務層 (`src/lib/`) 以加速測試。
- **零容忍**: 嚴格遵守 紅-綠-重構 (Red-Green-Refactor) 循環。

### II. 嚴格的服務層架構 (Strict Service Layer)
**不可協商**: UI 層與業務邏輯層必須完全分離。
- **隔離 (Isolation)**: 所有 Firebase 邏輯 (Firestore, Auth, Storage) 必須封裝在 `src/lib/` 中。
- **UI 限制**: UI 元件 (Pages/Components) **不得**直接匯入 Firebase SDK。它們只能呼叫 `src/lib/` 匯出的非同步函式。
- **資料正規化**: 資料驗證與正規化必須在服務層處理。

### III. 使用者體驗與一致性 (UX & Consistency)
**不可協商**: 互動模式與語言的一致性。
- **語言**: 應用程式與所有開發回應必須使用 **正體中文 (Traditional Chinese)**。
- **互動**: 無限捲動必須使用 `IntersectionObserver` 搭配 Firestore 游標。
- **地圖**: 必須透過 `next/dynamic` (SSR: false) 載入 Leaflet 相關元件。

### IV. 效能與併發 (Performance & Concurrency)
**不可協商**: 資料處理的安全與效率。
- **併發**: 共享資源操作必須使用 `runTransaction`。
- **資料效率**: 使用 `serverTimestamp()` 確保時間一致性；路線儲存為 encoded polylines。

### V. 程式碼品質與慣例 (Code Quality & Conventions)
**不可協商**: 可維護性、可讀性與務實主義。
- **MVP 思維**: 拒絕過度設計 (No Overdesign)，專注於最小可行性。
- **語言**: 僅使用 **JavaScript** (ES6+)。
- **樣式**: 以 **CSS Modules** 為主。
- **Hook 順序**: State -> Context -> Refs -> Effects -> Handlers。

### VI. 現代化開發標準 (Modern Development Standards)
**不可協商**: 遵循 Airbnb 風格精華與 JSDoc 嚴謹性。
- **Airbnb Spirit**: `const` 優先、嚴禁 `var`、強制解構賦值、結尾逗號。
- **Formatting 鐵律**:
    - **分號**: 必須加。
    - **引號**: JS 用單引號 `'`，JSX 屬性用雙引號 `"`。
    - **縮排**: 2 spaces。
    - **結尾逗號**: ES5 格式（objects, arrays, params）。
- **React 19**: 不使用 `import React` (除非 Hooks 需要)，嚴守 Hooks 規則。
- **JSDoc 紀律**:
    - **強制文件**: 導出函式必須有完整 JSDoc。
    - **型別檢查**: 專案啟用 `checkJs: true`，必須透過 `@param` 與 `@returns` 定義型別以通過檢查。
    - **目標**: 致力於消除所有 ESLint/Type 警告。

### VII. 安全與機密 (Security & Secrets)
**不可協商**: 零信任與機密隔離。
- **機密隔離**: **絕對禁止**將 API Keys、Tokens 或任何機密提交至 Git。
- **環境變數**: 所有敏感資訊必須存放於 `.env`，並確保 `.env` 在 `.gitignore` 中。
- **引用方式**: 在 `settings.json` 或程式碼中僅能透過變數名稱引用 (如 `$API_KEY`)。

### VIII. 代理人互動協議 (Agent Interaction Protocol)
**不可協商**: 確保開發者的絕對控制權與資訊準確性。
- **修改確認**: 在修改任何檔案程式碼前，**必須**先取得使用者的明確確認。禁止擅自決策。
- **資訊誠實**: 不確定的資訊必須回答「無法回答」，禁止臆測。
- **思辨夥伴**: 代理人應挑戰假設、提供反方觀點，而非盲目附和。
- **實務導向**: 回答必須包含實際程式碼或具體解釋，拒絕空泛的高層次建議。

## 技術約束 (Technology Constraints)

- **框架**: Next.js 15 (App Router)
- **程式庫**: React 19
- **資料庫**: Firebase v9+ (Firestore, Auth, Storage)
- **測試**: Vitest (Unit/Integration), Playwright (E2E)
- **Linting**: ESLint 9 (Airbnb + JSDoc + Flat Config)

## 工作流程與品質閘門 (Workflow & Quality Gates)

1.  **規劃 (Plan)**: 定義規格與架構。
2.  **測試 (Test)**: 撰寫失敗的測試 (Red)。
3.  **實作 (Implement)**: 撰寫通過測試的最少代碼 (Green)。
4.  **驗證 (Verify)**: ESLint 通過且無 Type 警告。
    - 重構進行中可用 `npm run lint:changed` / `npm run type-check:changed` 僅檢查當次改動。
5.  **重構 (Refactor)**: 優化代碼結構。
6.  **審查 (Review)**: 確認符合所有憲法原則。

### IX. 絕對編碼鐵律 (Strict Coding Iron Rules)
**不可協商**: 違反下列規則視為重大違規。
- **No Logic in JSX**: **嚴格禁止**在 JSX 內撰寫複雜邏輯 (IIFE, heavy conditionals)。必須抽離成 Component 或 Helper。JSX 僅負責 View。
- **No ESLint Abuse**: **嚴格禁止**使用 `eslint-disable` 規避 A11y 規則 (如 `click-events-have-key-events`)。必須修復 HTML 結構 (加入 roles, labels, handlers)。
- **Meaningful JSDoc**: **嚴格禁止**撰寫空泛/樣板 JSDoc。文件必須解釋 *意圖* 與 *參數*，不僅是為了滿足 Linter。

## 治理 (Governance)

本憲法凌駕於所有其他慣例之上。

**Version**: 1.4.0 | **Ratified**: 2026-02-03 | **Last Amended**: 2026-03-25