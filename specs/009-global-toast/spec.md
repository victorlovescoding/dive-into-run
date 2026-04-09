# Feature Specification: 全域 Toast 通知系統

**Feature Branch**: `009-global-toast`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "取代各頁面分散的 actionMessage / alert，建立統一的 Toast feedback 機制"
**Updated**: 2026-04-09 — 追加 8 處缺漏的 Toast 覆蓋需求（活動 CRUD、文章 CRUD）

## Clarifications

### Session 2026-04-08

- Q: Error Toast 是否也 3 秒自動消失？ → A: Error 停留到手動關閉，success / info 維持 3 秒自動消失

### Session 2026-04-09

- Q: 活動詳情頁刪除活動成功後會 router.push('/events')，Toast 何時顯示？ → A: 導航到 /events 後再顯示「活動已刪除」Toast，不需跨頁保留機制
- Q: FR-012 列出的所有操作，其失敗路徑是否也要統一用 error Toast？ → A: 是，全面覆蓋——FR-012 列出的所有操作失敗時一律用 error Toast
- Q: FR-014 涵蓋範圍是否包含文章詳情頁？ → A: 是，擴展為文章列表頁 + 文章詳情頁，與 User Story 1b 一致
- Q: FR-012 未列出「刪除活動成功」的 success Toast，是否應補入？ → A: 補入——FR-012 success 清單應與 FR-013 error 清單對稱
- Q: 文章詳情頁刪除文章成功後是否有導航行為？Toast 在哪顯示？ → A: 刪除成功後 router.push('/posts')，Toast 在文章列表頁顯示（比照活動刪除）
- Q: FR-013 文章 error Toast 的訊息格式？ → A: 通用格式「{操作}失敗，請稍後再試」，不附帶技術錯誤原因

## User Scenarios & Testing _(mandatory)_

### User Story 1 — 操作成功時看到即時回饋 (Priority: P1)

身為使用者，我在完成操作（例如：報名活動、取消報名、刪除留言、更新個人資料）後，希望畫面上立即出現一個簡短的成功提示，讓我確信操作已完成，不需要額外猜測。

**Why this priority**: 成功回饋是所有 Toast 場景中最基本、頻率最高的使用情境。如果只做一件事，這是 MVP 的核心價值——讓使用者對每個操作都有信心。

**Independent Test**: 在任一頁面觸發一個成功操作，確認 Toast 出現、顯示正確訊息、3 秒後自動消失。可獨立驗證不需其他 Toast 類型存在。

**Acceptance Scenarios**:

1. **Given** 使用者在活動頁面，**When** 成功報名一個活動，**Then** 畫面出現成功 Toast，顯示報名成功訊息
2. **Given** 成功 Toast 已顯示，**When** 經過 3 秒，**Then** Toast 自動消失並帶有淡出動畫
3. **Given** 成功 Toast 已顯示，**When** 使用者點擊關閉按鈕，**Then** Toast 立即消失

---

### User Story 1b — 所有 CRUD 操作成功都有即時回饋 (Priority: P1)

身為使用者，我在建立活動、編輯活動、刪除活動、建立文章、編輯文章、刪除文章後，希望看到成功 Toast 回饋，而非操作後畫面毫無反應。

**Why this priority**: 這些是應用中最頻繁的寫入操作，目前成功路徑完全靜默——使用者無法確認操作是否已生效。與 User Story 1 同屬 P1 核心場景。

**Independent Test**: 依序執行建立活動、編輯活動、刪除活動、建立文章、編輯文章、刪除文章，確認每個操作成功後都出現對應的成功 Toast。

**Acceptance Scenarios**:

1. **Given** 使用者在活動列表頁填好表單，**When** 成功建立一個活動，**Then** 出現「建立活動成功」的成功 Toast
2. **Given** 使用者在活動列表頁編輯活動，**When** 成功儲存變更，**Then** 出現「更新活動成功」的成功 Toast
3. **Given** 使用者在活動詳情頁編輯活動，**When** 成功儲存變更，**Then** 出現「更新活動成功」的成功 Toast
4. **Given** 使用者在文章列表頁填好表單，**When** 成功建立一篇文章，**Then** 出現「發佈文章成功」的成功 Toast
5. **Given** 使用者在文章列表頁編輯文章，**When** 成功儲存變更，**Then** 出現「更新文章成功」的成功 Toast
6. **Given** 使用者在文章列表頁刪除文章，**When** 刪除完成，**Then** 出現「文章已刪除」的成功 Toast
7. **Given** 使用者在文章詳情頁編輯文章，**When** 成功儲存變更，**Then** 出現「更新文章成功」的成功 Toast
8. **Given** 使用者在文章詳情頁刪除文章，**When** 刪除完成並導航至 /posts，**Then** 出現「文章已刪除」的成功 Toast
9. **Given** 使用者在活動列表頁刪除活動，**When** 刪除完成，**Then** 出現「活動已刪除」的成功 Toast
10. **Given** 使用者在活動詳情頁刪除活動，**When** 刪除完成並導航至 /events，**Then** 出現「活動已刪除」的成功 Toast

---

### User Story 1c — 建立活動失敗使用 Toast 而非 inline 錯誤 (Priority: P1)

身為使用者，我在建立活動失敗時，希望看到統一的 error Toast，而不是頁面上的 inline 錯誤訊息，以維持一致的回饋體驗。

**Why this priority**: 建立活動的 error path 目前使用 `setCreateError` 設定 inline 錯誤狀態，與其他已改用 `showToast` 的 error 回饋不一致。統一後使用者體驗更一致。

**Independent Test**: 模擬建立活動失敗（例如斷網），確認出現 error Toast 而非 inline 錯誤訊息。

**Acceptance Scenarios**:

1. **Given** 使用者在活動列表頁填好表單，**When** 建立活動失敗（如網路錯誤），**Then** 出現 error Toast 顯示錯誤訊息，而非 inline 紅字
2. **Given** 建立活動失敗顯示 error Toast，**When** 使用者未手動關閉，**Then** Toast 持續顯示直到手動關閉

---

### User Story 2 — 操作失敗時看到清楚的錯誤提示 (Priority: P1)

身為使用者，我在操作失敗時（例如：網路錯誤、權限不足、上傳失敗），希望看到一個明確的錯誤提示，而不是毫無反應或跳出瀏覽器 alert。

**Why this priority**: 與成功回饋同等重要。目前多處使用 `window.alert()` 或只有 `console.error()`，使用者體驗極差。這是驅動本功能的核心痛點之一。

**Independent Test**: 在會員頁面模擬一次頭像上傳失敗，確認錯誤 Toast 出現、訊息清楚、可手動關閉。

**Acceptance Scenarios**:

1. **Given** 使用者在會員頁面，**When** 更新名稱失敗（如網路錯誤），**Then** 畫面出現錯誤 Toast，顯示人類可讀的錯誤訊息
2. **Given** 錯誤 Toast 已顯示，**When** 使用者未手動關閉，**Then** Toast 持續顯示直到使用者點擊關閉按鈕
3. **Given** 使用者在文章頁面，**When** 刪除貼文失敗，**Then** 顯示錯誤 Toast 而非瀏覽器 alert

---

### User Story 3 — 顯示資訊性提示 (Priority: P2)

身為使用者，我希望系統能在需要時顯示資訊性提示（例如：Strava 帳號已斷開連結），讓我了解系統狀態變化，而不是用醜陋的 inline 錯誤條。

**Why this priority**: 資訊提示覆蓋 success/error 以外的場景，例如目前 runs 頁面的 `disconnectError` inline 提示。優先度較低是因為使用頻率低於前兩者。

**Independent Test**: 在跑步頁面觸發 Strava 斷開情境，確認 info Toast 出現、樣式與 success/error 有區分。

**Acceptance Scenarios**:

1. **Given** 使用者在跑步頁面，**When** 系統偵測到 Strava 連線已斷開，**Then** 出現 info Toast 告知狀態
2. **Given** info Toast 已顯示，**When** 經過 3 秒，**Then** Toast 自動消失

---

### User Story 4 — 多個 Toast 不互相覆蓋 (Priority: P2)

身為使用者，我在短時間內觸發多次操作時，希望每個提示都能被看到，而不是後面的覆蓋掉前面的。

**Why this priority**: 多 Toast 堆疊是完整體驗的一部分，但 MVP 階段即使只顯示最新一筆也可接受。

**Independent Test**: 快速連續觸發 3 次操作，確認所有 Toast 都可見或以佇列方式依序顯示。

**Acceptance Scenarios**:

1. **Given** 畫面上已有一個 Toast，**When** 使用者觸發另一個操作，**Then** 新的 Toast 不會覆蓋舊的，兩者同時可見或佇列顯示
2. **Given** 畫面上有多個 Toast，**When** 各自超時，**Then** 各自獨立消失，不影響其他 Toast

---

### Edge Cases

- 當 Toast 訊息文字很長時，應截斷或換行，不能撐破版面
- 當使用者快速連續觸發超過 5 個 Toast 時，系統應移除最舊的 Toast 以避免畫面堆滿
- 當頁面切換（路由變更）時，殘留的 Toast 應自動清除
- 在行動裝置上，Toast 不能遮擋主要操作按鈕或導覽列
- 螢幕閱讀器使用者應能聽到 Toast 內容（無障礙）

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統 MUST 提供統一的 Toast 通知機制，支援三種等級：success、error、info
- **FR-002**: Success 和 info Toast MUST 在顯示 3 秒後自動消失；error Toast MUST 持續顯示直到使用者手動關閉
- **FR-003**: 每個 Toast MUST 提供手動關閉按鈕，使用者可提前關閉
- **FR-004**: Toast MUST 以動畫方式進入和離開畫面（滑入 / 淡出）
- **FR-005**: 多個 Toast 同時存在時，MUST 以堆疊方式排列，不互相覆蓋
- **FR-006**: 同時顯示的 Toast 數量 MUST 有上限（最多 5 個），超過時移除最舊的
- **FR-007**: 三種等級的 Toast MUST 有視覺區分（不同顏色或圖示）
- **FR-008**: Toast MUST 取代目前以下散落的回饋方式：
  - 活動詳情頁的 `actionMessage` inline 提示
  - 活動列表頁的 `actionMessage` inline 提示
  - 文章詳情頁的 `window.alert()`
  - 登出頁面的 `window.alert()`
  - 跑步頁面的 `disconnectError` inline 提示
  - 會員頁面目前缺失的錯誤回饋（只有 `console.error`）
- **FR-009**: Toast MUST 對螢幕閱讀器可存取——成功與資訊提示使用 `status` role，錯誤提示使用 `alert` role
- **FR-010**: Toast 在行動裝置上 MUST 不遮擋主要導覽列或頁面操作按鈕
- **FR-011**: 路由切換時，殘留的 Toast SHOULD 自動清除（註：涉及導航的操作如活動詳情頁刪除→/events、文章詳情頁刪除→/posts，Toast 在導航目標頁觸發，不需跨頁保留）
- **FR-012**: 以下操作的成功路徑 MUST 顯示 success Toast：
  - 活動列表頁：建立活動成功
  - 活動列表頁：編輯活動成功
  - 活動詳情頁：編輯活動成功
  - 活動列表頁：刪除活動成功
  - 活動詳情頁：刪除活動成功
  - 文章列表頁：建立文章成功
  - 文章列表頁：編輯文章成功
  - 文章列表頁：刪除文章成功
  - 文章詳情頁：編輯文章成功
  - 文章詳情頁：刪除文章成功
- **FR-013**: 以下操作的失敗路徑 MUST 統一使用 error Toast 回饋（活動編輯的列表頁與詳情頁已有 error Toast，不需變更）。錯誤訊息格式統一為「{操作}失敗，請稍後再試」，不附帶技術錯誤原因：
  - 活動列表頁：建立活動失敗（取代 `setCreateError` inline 錯誤）
  - 活動列表頁：刪除活動失敗（取代 `setDeleteError` inline 錯誤）
  - 活動詳情頁：刪除活動失敗（取代 `setDeleteError` inline 錯誤）
  - 文章列表頁：建立文章失敗（目前無 try-catch，需新增）
  - 文章列表頁：編輯文章失敗（目前無 try-catch，需新增）
  - 文章列表頁：刪除文章失敗（目前無 try-catch，需新增）
  - 文章詳情頁：編輯文章失敗（目前無 try-catch，需新增）
  - 文章詳情頁：刪除文章失敗（目前無 try-catch，需新增）
- **FR-014**: 文章列表頁與文章詳情頁 MUST 整合 Toast 通知，使兩頁面的建立、編輯、刪除操作均透過 Toast 提供回饋

### Key Entities

- **Toast 訊息**: 代表一則使用者回饋通知。屬性包含：訊息文字、等級（success / error / info）、建立時間、唯一識別碼
- **Toast 佇列**: 管理目前畫面上所有 Toast 的集合，負責新增、移除、數量限制

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 使用者的每個關鍵操作（建立活動、編輯活動、報名、取消報名、建立文章、編輯文章、刪除文章等）不論成功或失敗都會產生可見的 Toast 回饋，0 個寫入操作處於「靜默完成」狀態
- **SC-002**: 專案內不再使用 `window.alert()` 做操作回饋，所有回饋統一透過 Toast 呈現
- **SC-003**: Success / info Toast 在 3 秒內自動消失；error Toast 持續顯示直到手動關閉，確保使用者不會錯過錯誤訊息
- **SC-004**: Toast 通知在行動裝置（375px 寬）和桌面裝置（1440px 寬）上都能正常顯示且不遮擋關鍵 UI
- **SC-005**: 螢幕閱讀器能正確播報 Toast 內容，error 類型以 alert role 播報

## Assumptions

- Toast 顯示位置預設為畫面底部（靠近使用者視覺焦點），堆疊方向為由下往上
- Success / info 的自動消失時間為 3 秒；error 不自動消失，需手動關閉
- Toast 僅為即時的一次性通知，不需要持久化或歷史記錄
- 動畫效果以 CSS transition 為主，不需要引入額外的動畫函式庫
