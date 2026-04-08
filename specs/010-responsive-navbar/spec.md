# Feature Specification: 響應式導覽列 (RWD Navbar)

**Feature Branch**: `010-responsive-navbar`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "F-002 RWD Navbar — 重構導覽列為手機友善的元件，含漢堡選單和使用者頭像下拉"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 手機使用者瀏覽導覽列 (Priority: P1)

身為手機使用者，我在小螢幕上打開網站時，導覽列不應擠在一起或溢出畫面。我應該看到一個漢堡按鈕，點擊後展開一個滑出式面板，讓我可以正常點選所有頁面連結。

**Why this priority**: 跑者是重度手機使用族群，目前導覽列在手機上 5 個導覽連結加上內聯的登入/登出按鈕會溢出或擠在一起，嚴重影響基本使用體驗。這是最核心的問題。

**Independent Test**: 在手機尺寸（<768px）載入任意頁面，驗證漢堡選單可開啟/關閉，所有導覽連結可正常點擊並跳轉。

**Acceptance Scenarios**:

1. **Given** 使用者在手機裝置上瀏覽網站, **When** 頁面載入, **Then** 導覽列只顯示 Logo/站名和漢堡按鈕，不顯示完整連結列
2. **Given** 使用者在手機上看到漢堡按鈕, **When** 點擊漢堡按鈕, **Then** 滑出式面板展開，顯示所有導覽連結和登入/登出選項
3. **Given** 滑出式面板已展開, **When** 使用者點擊任一導覽連結, **Then** 面板自動關閉並導航至該頁面
4. **Given** 滑出式面板已展開, **When** 使用者點擊面板外部區域或關閉按鈕, **Then** 面板關閉

---

### User Story 2 - 桌面使用者的導覽體驗 (Priority: P1)

身為桌面使用者，我希望導覽列以水平排列的方式顯示所有連結，且有清楚的 active 狀態標示告訴我目前所在頁面。已登入時，我希望看到我的頭像，點擊可展開下拉選單。

**Why this priority**: 桌面體驗同為 P1 因為桌面和手機是同一個元件的兩種表現形式，且 active link highlight 是基本導覽體驗。

**Independent Test**: 在桌面尺寸（>=768px）載入頁面，驗證水平連結列、active highlight、使用者頭像下拉選單均正常運作。

**Acceptance Scenarios**:

1. **Given** 使用者在桌面瀏覽器上瀏覽網站, **When** 頁面載入, **Then** 導覽列以水平方式顯示所有連結
2. **Given** 使用者已登入且在桌面瀏覽, **When** 查看導覽列, **Then** 顯示使用者頭像（或預設頭像），點擊展開下拉選單（僅含「登出」選項）
3. **Given** 使用者在 `/events` 頁面, **When** 查看導覽列, **Then** 「揪團頁面」連結有明顯的 active 樣式標示
4. **Given** 使用者未登入且在桌面瀏覽, **When** 查看導覽列, **Then** 顯示「登入」按鈕取代頭像

---

### User Story 3 - 導覽列從 layout 中獨立為元件 (Priority: P2)

身為開發團隊，我們需要將導覽列從 `layout.jsx` 中抽出為獨立的 client component，使其可獨立維護、測試和擴展。

**Why this priority**: 這是架構改善，確保後續功能（如通知 badge、搜尋列）可以輕鬆加入導覽列，但對使用者來說是透明的。

**Independent Test**: 驗證導覽列元件存在且被 layout 引用，導覽功能與重構前完全一致。

**Acceptance Scenarios**:

1. **Given** 開發者查看 layout 檔案, **When** 檢查導覽列實作, **Then** 導覽列由獨立的 client component 提供，layout 中不再包含內聯導覽邏輯
2. **Given** 導覽列元件已抽出, **When** 在不同頁面測試導覽, **Then** 所有導覽功能與重構前行為一致

---

### User Story 4 - 網站基本 metadata 修正 (Priority: P2)

身為搜尋引擎爬蟲或台灣使用者的瀏覽器，我需要正確的語言屬性和頁面標題，以便正確識別網站語言和顯示正確的標題。

**Why this priority**: 這是小但重要的修正，影響 SEO 和無障礙體驗，且改動極小。

**Independent Test**: 檢查頁面原始碼，驗證語言屬性和標題值正確。

**Acceptance Scenarios**:

1. **Given** 使用者打開網站, **When** 檢查頁面原始碼, **Then** 語言屬性標示為繁體中文
2. **Given** 使用者打開網站, **When** 查看瀏覽器分頁標題, **Then** 顯示「Dive Into Run」而非預設的樣板標題

---

### Edge Cases

- 使用者在滑出面板展開時旋轉手機（portrait <-> landscape），面板應正確適應或自動關閉
- 使用者在滑出面板展開時按瀏覽器返回鍵，面板應關閉而非導航離開
- 導覽列在各頁面（包含地圖頁面、長表單頁面）的層級應高於其他元素，不被遮擋
- 使用者快速連續點擊漢堡按鈕，面板不應出現開關狀態不一致
- 頭像下拉選單展開時點擊其他區域，選單應正確關閉

## Clarifications

### Session 2026-04-08

- Q: 導覽列定位方式（sticky/static/auto-hide）？ → A: Sticky — 固定在視窗頂部，滾動時不消失
- Q: 手機版滑出面板從哪一側滑入？ → A: 右側滑入
- Q: 認證狀態載入中導覽列右側顯示什麼？ → A: Skeleton 圓形骨架動畫佔位，確認後替換為頭像或登入按鈕
- Q: 桌面版頭像下拉選單包含哪些項目？ → A: 僅「登出」一個選項
- Q: 手機版滑出面板展開時是否鎖定背景滾動？ → A: 鎖定（body scroll lock）

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統必須將導覽列抽出為獨立的 client component，從 layout 中移除內聯導覽邏輯
- **FR-002**: 在小螢幕（<768px）上，導覽列必須顯示漢堡按鈕，點擊後展開滑出式面板顯示所有導覽連結
- **FR-003**: 在大螢幕（>=768px）上，導覽列必須以水平方式顯示所有導覽連結
- **FR-004**: 導覽列必須標示目前所在頁面的 active 狀態
- **FR-005**: 已登入使用者在桌面版必須看到使用者頭像，點擊展開下拉選單（含「登出」選項）
- **FR-006**: 未登入使用者必須看到「登入」按鈕
- **FR-006a**: 認證狀態載入期間，桌面版導覽列右側必須顯示圓形骨架動畫（skeleton）佔位，避免 layout shift 和 UI 閃爍。手機版滑出面板為使用者主動開啟，開啟時 auth 狀態通常已 resolved，不需要 skeleton
- **FR-007**: 手機版滑出面板必須在使用者點選連結後自動關閉
- **FR-008**: 手機版滑出面板必須可透過點擊面板外部區域或關閉按鈕來關閉
- **FR-008a**: 手機版滑出面板展開時，必須鎖定背景頁面滾動（body scroll lock），面板關閉後恢復
- **FR-009**: 網站標題必須從預設樣板值更正為「Dive Into Run」
- **FR-010**: 頁面語言屬性必須從英文更正為正體中文（zh-Hant-TW）
- **FR-011**: 導覽列必須符合 WCAG 2.1 Level AA 無障礙標準（語義化 HTML、鍵盤導覽、ARIA 標籤）
- **FR-012**: 導覽列必須以 sticky 方式固定在視窗頂部，使用者滾動頁面時導覽列保持可見

### Key Entities

- **NavBar**: 獨立的導覽列元件，負責根據螢幕尺寸切換桌面/手機版顯示模式，管理選單開關狀態
- **User Session**: 來自現有認證系統的使用者資訊（登入狀態、頭像、顯示名稱），用於決定顯示頭像下拉或登入按鈕

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 手機使用者可在 2 次點擊內（漢堡 -> 連結）到達任何頁面
- **SC-002**: 導覽列在 320px 至 1920px 的所有常見螢幕寬度下正確顯示，無溢出或重疊
- **SC-003**: 使用者可在任何頁面的導覽列上辨識目前所在位置（active link 視覺提示）
- **SC-004**: 鍵盤使用者可透過 Tab 鍵依序遍歷所有導覽項目，並用 Enter/Space 觸發
- **SC-005**: 網站標題正確顯示為「Dive Into Run」，頁面語言屬性為繁體中文
- **SC-006**: 漢堡選單開啟/關閉動畫流暢（目標 60fps、transition ≤ 300ms），無閃爍或跳動

## Assumptions

- Breakpoint 768px 作為手機/桌面切換點，符合常見 RWD 中間斷點
- 使用者頭像來自現有認證系統的個人資料照片，若無則使用預設 avatar
- 導覽連結項目與目前一致：首頁、會員頁面、文章、揪團頁面、跑步
- 滑出面板從螢幕右側滑入，具有半透明背景遮罩
- 不需要巢狀子選單，所有連結為單層結構
