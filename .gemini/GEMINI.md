# 專案上下文：Dive into Run (揪團跑步)

## 專案概覽
「Dive into Run」是一個基於 **Next.js 15** 和 **Firebase** 構建的 Web 應用程式，旨在幫助使用者組織和參加跑步活動。核心功能包括建立跑步活動、在地圖上設定路線（使用 Leaflet）、管理參加者以及使用者身分驗證。

## 建置與執行

### 前置條件
- Node.js (建議使用最新 LTS 版本)
- npm

### 核心指令
- **啟動開發伺服器**:
  ```bash
  npm run dev
  ```
  在 `http://localhost:3000` 啟動應用程式，並啟用 Turbopack。

- **生產環境建置**:
  ```bash
  npm run build
  ```

- **代碼檢查 (Linting)**:
  ```bash
  npm run lint
  ```

## 開發規範與技術棧

### 核心技術
- **框架**: Next.js 15 (App Router)
- **程式庫**: React 19
- **語言**: **JavaScript** (.js / .jsx) - **請勿使用 TypeScript**。
- **資料庫**: Firebase v9+ (Firestore, Auth, Storage)
- **地圖**: Leaflet, React-Leaflet, Leaflet-Draw, Mapbox Polyline
- **測試工具**: **Vitest** (搭配 `@testing-library/react` 和 `jsdom`)
- **樣式**: 以 **CSS Modules** (`*.module.css`) 為主要方式。雖然專案已安裝 Tailwind CSS，但除非有特別說明，否則元件特定樣式請優先使用 CSS Modules。

## 開發原則 (不可協商)

### 1. 規格驅動開發 (SDD)
- **規格優先**: 在沒有明確的書面規格或需求定義之前，不得開始任何實作。
- **藍圖**: 程式碼結構必須遵循規格中定義的架構規劃與資料模型。

### 2. 測試驅動開發 (TDD)
- **測試優先**: 在撰寫任何實作程式碼**之前**，你**必須**先撰寫會失敗的測試案例。
- **紅-綠-重構**: 嚴格遵守循環：寫一個會失敗的測試 (紅) -> 讓它通過 (綠) -> 清理代碼 (重構)。
- **零容忍**: **嚴格禁止未經測試的程式碼**。任何邏輯代碼若無對應的測試覆蓋，不得提交或視為「完成」。

## Architecture & Conventions

### 1. Service Layer Pattern (Strict)

- **關注點分離**: 所有 Firebase 邏輯（Firestore 查詢、寫入、Auth、Storage）**必須**封裝在 `src/lib/` 中（例如 `src/lib/firebase-events.js`, `src/lib/firebase-users.js`）。
- **禁止在 UI 直接呼叫 SDK**: UI 元件（Pages/Components）**不得**直接匯入 `getDoc`、`addDoc`、`runTransaction` 等。應呼叫從 `src/lib/` 匯出的非同步函式。
- **資料正規化**: 資料驗證與正規化（例如將日期轉換為 Timestamps、格式化 Firestore 資料）應在 `src/lib/` 的函式中完成，而非在 UI 層。

### 2. 檔案結構
- **頁面 (Pages)**: `src/app/` (遵循 App Router 慣例)。
- **元件 (Components)**: `src/components/` (可複用的 UI 元件)。
- **服務層 (Lib/Service)**: `src/lib/` (業務邏輯、Firebase 交互)。
- **上下文 (Contexts)**: `src/contexts/` (全域狀態，例如 AuthContext)。
- **樣式 (Styles)**: `src/app/**/*.module.css` (與頁面/元件放置在一起)。

## Firebase 最佳實踐
- **併發處理**: 涉及計數器或共享資源限制（如加入/退出活動）的操作，必須使用 `runTransaction`。
- **時間戳記**: 寫入建立/更新時間時，請使用 `serverTimestamp()`。
- **儲存空間 (Storage)**: 使用者大頭貼請遵循路徑慣例 `avatars/{uid}/{filename}`。上傳成功後，務必同步更新 Auth 和 Firestore 中的使用者 `photoURL`。
- **資料型別**:
  - `paceSec`: 在 Firestore 中以**每公里秒數** (Number) 儲存配速。在 UI 中再轉換為 MM:SS 格式。
  - `route`: 使用 `@mapbox/polyline` 儲存壓縮後的 Polyline 字串以節省空間。

## 程式碼風格與工作流程
- **語言偏好**: 回應請使用 **繁體中文 (Traditional Chinese)**。
- **註解**: 務必加上註解解釋**為什麼**存在複雜邏輯（Why），而不僅是解釋「做了什麼」（What）。
- **Hook 順序**: State -> Context -> Refs -> Effects -> Handlers。
- **地圖處理**: 對於 Leaflet 地圖元件，務必配合 `next/dynamic` 使用 `{ ssr: false }`，以避免 window-undefined 錯誤。
- **無限捲動**: 列表顯示優先使用 `IntersectionObserver` 搭配 Firestore cursor (`startAfter`)。

## 互動風格與原則
- **別廢話**：如果我要求修復或解釋，請直接給我實體程式碼或具體解釋！我不需要「你可以這樣做...」這種空洞的高層次廢話。
- **隨意且簡潔**：除非另有說明，否則語氣請隨意一點。發言要簡潔明瞭。
- **主動預測需求**：提出我沒想到的方案——預測我的需求。
- **專家模式**：把我視為專家看待。
- **準確且深入**：內容要準確且徹底。
- **答案先行**：直接給答案。之後如有必要再詳細解釋，或用你的話重申我的問題。
- **論點勝過權威**：重視好的論點勝過權威，來源並不重要。
- **擁抱新技術與非主流想法**：考慮新技術和反直覺的想法，而不僅僅是傳統觀念。
- **允許推測**：你可以進行高度的推測或預測，但請為我標註。
- **拒絕道德說教**：不要進行道德說教。
- **僅討論關鍵安全問題**：僅在安全問題至關重要且不明顯時才討論。
- **政策應對**：如果觸發內容政策，請提供最接近且可接受的回覆，並在事後解釋政策問題。
- **引用方式**：盡可能在結尾引用來源，不要在行內嵌入。
- **無需自報家門**：沒必要提到你的知識截止日期，也沒必要宣告你是 AI。
- **遵守代碼規範**：提供程式碼時請尊重我的 Prettier 設定。
- **分段回覆**：如果一個回覆內容太多，請拆分成多個。
- **精簡程式碼修改**：如果我要求調整程式碼，不要無謂地重複整段代碼。請保持簡短，僅提供修改處前後幾行的上下文。可以使用多個程式碼塊。

## 資訊更新與自主檢索
- **主動檢索**：當遇到不確定、可能過時的技術問題（如 Next.js 或 Firebase 的最新變更），或是不確定 Gemini CLI 的支援功能時，**必須**優先使用 `google_web_search` 或 `delegate_to_agent` (cli_help) 查詢最新資訊，嚴禁憑空猜測。
- **持續同步**：在執行開發任務前，應視需求主動確認當前環境、檔案結構與工具狀態，確保開發流程符合最新的專案規範與 CLI 能力。