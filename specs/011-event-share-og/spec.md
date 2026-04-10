# Feature Specification: 活動分享 + Open Graph

**Feature Branch**: `011-event-share-og`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "F-004: 活動分享 + Open Graph — 活動/文章詳情頁加分享按鈕和 OG metadata，讓分享到 LINE/FB/Instagram/Threads 時有漂亮的預覽卡片"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 手機分享活動到社群平台 (Priority: P1)

身為跑者，我在活動詳情頁看到一個有趣的揪團活動，想分享給跑友。我按下分享按鈕，手機跳出系統分享面板，我選擇要分享的 app（LINE、FB、Instagram、Threads、X 等任何已安裝的 app）送出。朋友在社群平台或通訊軟體中看到一張預覽卡片，上面有活動標題、日期、地點資訊和品牌圖片，點擊卡片就能直接進入活動頁面。

**Why this priority**: 分享揪團活動是本功能的核心場景，直接影響平台的使用者獲取（Acquisition）。預覽卡片的品質決定了接收者是否會點擊。所有支援 OG metadata 的社群平台（LINE、FB、X、Threads 等）都會顯示預覽卡片。

**Independent Test**: 在手機瀏覽器開啟任一活動詳情頁，按下分享按鈕，透過任一社群平台分享，確認預覽卡片顯示正確的標題、日期、地點和品牌圖片，點擊可導向正確活動頁。

**Acceptance Scenarios**:

1. **Given** 使用者在手機瀏覽器開啟活動詳情頁，**When** 按下分享按鈕，**Then** 系統跳出原生分享面板，列出手機上已安裝的 app 供選擇
2. **Given** 活動連結被分享到任一支援 OG 的社群平台（LINE、FB、X、Threads 等），**When** 接收者看到訊息，**Then** 顯示預覽卡片，包含活動標題、活動日期、活動地點和品牌圖片
3. **Given** 接收者點擊預覽卡片，**When** 瀏覽器開啟，**Then** 導向該活動的詳情頁面

---

### User Story 2 - 桌面複製活動連結 (Priority: P1)

身為跑者，我在桌面電腦瀏覽活動詳情頁，想把連結分享到 FB 社團。我按下分享按鈕，連結被複製到剪貼簿，畫面顯示「已複製連結」的提示。我貼到 FB 社團，FB 自動抓取 OG metadata 顯示預覽。

**Why this priority**: 桌面使用者同樣需要分享功能，複製連結是桌面環境最直覺的分享方式。與 P1-1 互補，確保所有裝置都能分享。

**Independent Test**: 在桌面瀏覽器開啟活動詳情頁，按下分享按鈕，確認剪貼簿中有正確的活動 URL，並顯示成功提示。

**Acceptance Scenarios**:

1. **Given** 使用者在桌面瀏覽器開啟活動詳情頁，**When** 按下分享按鈕，**Then** 活動頁面 URL 被複製到剪貼簿，且顯示「已複製連結」提示訊息
2. **Given** 使用者將複製的連結貼到社群平台（FB、X、Threads 等），**When** 平台抓取 metadata，**Then** 顯示含活動標題、日期、地點的預覽卡片

---

### User Story 3 - 分享文章到社群 (Priority: P2)

身為跑者，我在文章詳情頁看到一篇好文，想分享到 FB 跑步社團或 LINE 群組。分享行為和活動頁一致：手機用原生分享、桌面用複製連結。朋友看到的預覽卡片包含文章標題和品牌圖片。

**Why this priority**: 文章分享是活動分享的延伸，邏輯相同，增加平台內容的擴散力。優先級略低於活動，因為活動有時效性和社交屬性，分享的急迫性更高。

**Independent Test**: 在文章詳情頁按下分享按鈕，透過 LINE 分享，確認預覽卡片顯示文章標題和品牌圖片。

**Acceptance Scenarios**:

1. **Given** 使用者在文章詳情頁，**When** 按下分享按鈕，**Then** 行為與活動頁一致（手機原生分享 / 桌面複製連結）
2. **Given** 文章連結被分享到社群平台，**When** 平台抓取 metadata，**Then** 顯示文章標題和品牌預設圖片的預覽卡片

---

### Edge Cases

- 手機瀏覽器不支援原生分享面板時，應 fallback 為複製連結 + 顯示「已複製連結」提示（與桌面行為一致）
- 活動已被刪除或不存在時，分享連結應顯示合理的 fallback metadata（平台名稱 + 預設描述）
- 活動標題或地點含特殊字元（引號、emoji）時，OG metadata 不應壞掉
- 使用者在離線狀態或分享 API 失敗時，按分享按鈕應透過 toast 顯示「分享失敗」錯誤提示
- 同一頁面的 OG metadata 不應與全站預設 metadata 衝突

## Clarifications

### Session 2026-04-09

- Q: 分享按鈕的位置與呈現方式？ → A: 頁面標題區旁邊（標題右側或下方），靜態定位
- Q: 是否需要 Twitter Card meta tags？ → A: 需要，加上 `twitter:card=summary_large_image` 及對應 title/description/image tags
- Q: 「已複製連結」的回饋方式？ → A: 使用現有的 global toast 系統（009-global-toast）
- Q: 活動 og:description 的格式模板？ → A: `「{日期} · {縣市}{區域}」`，例如「2026/04/15 · 台北市大安區」
- Q: 明確的 Out-of-Scope 範圍？ → A: 排除全部：動態 OG 圖片生成（per-event）、分享次數追蹤/顯示、分享 Analytics、LINE LIFF 整合

### Session 2026-04-10

- Q: 文章 og:description 的產生規則？ → A: 格式為 `「{文章標題} — {前80字純文字}…」`，去除 HTML/Markdown 標記，超過 80 字加 `…`
- Q: 品牌預設 OG 圖片來源？ → A: 先用 repo 現有 logo 頂替，之後再換正式品牌圖（1200×630px）
- Q: 分享按鈕的視覺設計？ → A: 純 icon button（分享 icon），無文字，hover 顯示 tooltip「分享」
- Q: Web Share API 的 text 參數？ → A: 不帶 text，只傳 title + url
- Q: 文章不存在時的 fallback？ → A: 比照活動（FR-008），顯示 fallback metadata（平台名稱 + 通用描述）

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 活動詳情頁 MUST 提供 Open Graph metadata，包含：`og:title`（活動標題）、`og:description`（格式：`「{日期} · {縣市}{區域}」`，如「2026/04/15 · 台北市大安區」）、`og:image`（品牌預設圖片）、`og:url`（活動頁面網址）；同時 MUST 提供 Twitter Card metadata（`twitter:card=summary_large_image`、`twitter:title`、`twitter:description`、`twitter:image`）
- **FR-002**: 文章詳情頁 MUST 提供 Open Graph metadata，包含：`og:title`（文章標題）、`og:description`（格式：`「{文章標題} — {前80字純文字}…」`，去除 HTML/Markdown 標記，超過 80 字加 `…`）、`og:image`（品牌預設圖片）、`og:url`（文章頁面網址）；同時 MUST 提供 Twitter Card metadata（`twitter:card=summary_large_image`、`twitter:title`、`twitter:description`、`twitter:image`）
- **FR-003**: 活動詳情頁與文章詳情頁 MUST 各有一個分享按鈕（純 icon button，hover 顯示 tooltip「分享」），位於頁面標題區旁邊（標題右側或下方），靜態定位
- **FR-004**: 分享按鈕 MUST 在支援原生分享的環境自動使用系統分享面板，僅傳遞 title + url（不帶 text 參數）
- **FR-005**: 分享按鈕 MUST 在不支援原生分享的環境 fallback 為「複製連結到剪貼簿」
- **FR-006**: 複製連結成功後 MUST 透過全域 toast 系統顯示「已複製連結」提示
- **FR-007**: OG metadata MUST 使用固定的品牌預設圖片作為 `og:image`（初期使用 repo 現有 logo，後續替換為正式品牌圖 1200×630px）
- **FR-008**: 活動不存在時，頁面 MUST 顯示 fallback metadata（平台名稱 + 通用描述）
- **FR-010**: 文章不存在時，頁面 MUST 比照 FR-008 顯示 fallback metadata（平台名稱 + 通用描述）
- **FR-009**: OG metadata MUST 正確處理特殊字元（引號、HTML entities、emoji），不產生 broken markup

### Key Entities

- **活動（Event）**: 標題、日期時間、地點（縣市 + 區域）、說明 — 用於產生 OG metadata
- **文章（Post）**: 標題、內容 — 用於產生 OG metadata
- **品牌預設圖片**: 固定的 OG image，所有分享共用

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 活動頁面分享到 LINE 時，100% 顯示含標題、日期、地點的預覽卡片（非空白或純連結）
- **SC-002**: 活動頁面分享到 Facebook 時，100% 顯示含標題與描述的預覽卡片
- **SC-003**: 使用者從按下分享按鈕到完成分享動作（或看到「已複製連結」提示），不超過 2 秒
- **SC-004**: 分享按鈕在行動裝置與桌面環境皆可正常使用，無裝置限制

## Out of Scope

- 動態 OG 圖片生成（per-event 或 per-post 的客製化圖片）
- 分享次數追蹤與顯示
- 分享行為 Analytics（點擊追蹤、轉換率等）
- LINE LIFF 整合

## Assumptions

- 品牌預設圖片已準備好或會在開發過程中建立，尺寸符合社群平台建議（1200×630px）
- 使用者的瀏覽器在行動裝置上普遍支援 Web Share API（iOS Safari、Android Chrome 皆支援）
- 剪貼簿 API 在主流桌面瀏覽器皆可用（Chrome、Firefox、Safari、Edge）
- 活動與文章資料可在伺服器端取得，用於產生動態 metadata
