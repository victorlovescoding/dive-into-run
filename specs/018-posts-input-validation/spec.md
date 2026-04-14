# Feature Specification: Posts Input Validation

**Feature Branch**: `018-posts-input-validation`
**Created**: 2026-04-15
**Status**: Draft
**Input**: User description: "依據 posts-bug-analysis.md A5 — 文章沒有 input validation"

## Clarifications

### Session 2026-04-15

- Q: 多重驗證錯誤時的顯示策略？ → A: 只顯示第一個錯誤（依 title → content 順序），使用者修完再看下一個

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 空白文章無法送出 (Priority: P1)

使用者在建立或編輯文章時，若標題或內容為空白（含純空格），系統阻止送出並給予明確提示。

**Why this priority**: 這是最基本的資料完整性保護。空白文章進入資料庫毫無意義，且現行系統允許這種操作，是最急需修復的缺口。

**Independent Test**: 在建立文章表單中只輸入空格後按送出，驗證系統拒絕送出並顯示提示訊息。

**Acceptance Scenarios**:

1. **Given** 使用者開啟建立文章表單, **When** 標題為空白且按下送出, **Then** 系統不送出、顯示「請輸入標題」提示
2. **Given** 使用者開啟建立文章表單, **When** 內容為空白且按下送出, **Then** 系統不送出、顯示「請輸入內容」提示
3. **Given** 使用者開啟建立文章表單, **When** 標題和內容都只有空格, **Then** 系統不送出、顯示「請輸入標題和內容」提示
4. **Given** 使用者編輯既有文章, **When** 把標題清空後送出, **Then** 系統不送出、顯示「請輸入標題」提示

---

### User Story 2 - 超過字數上限時提示使用者 (Priority: P2)

使用者在撰寫文章時，若標題或內容超過字數上限，系統阻止送出並提供字數回饋，讓使用者知道需要縮減。

**Why this priority**: 防止異常長度的資料進入資料庫，保護儲存空間與顯示品質。但優先順序低於 P1，因為日常使用中超長文章的情境較少。

**Independent Test**: 在標題欄輸入超過上限的文字後按送出，驗證系統拒絕並顯示字數提示。

**Acceptance Scenarios**:

1. **Given** 使用者撰寫文章, **When** 標題超過 50 字, **Then** 系統不送出、顯示「標題不可超過 50 字」提示
2. **Given** 使用者撰寫文章, **When** 內容超過 10,000 字, **Then** 系統不送出、顯示「內容不可超過 10,000 字」提示
3. **Given** 使用者撰寫文章, **When** 標題和內容皆超過上限, **Then** 系統只顯示第一個錯誤（依 title → content 順序），使用者修正後再顯示下一個

---

### User Story 3 - Service 層獨立驗證（Defense-in-Depth）(Priority: P3)

即使繞過 UI（例如直接呼叫 API 或未來新增的其他介面），service 層仍能攔截不合規的資料，確保資料庫中不會出現不合法的文章。

**Why this priority**: Defense-in-depth 是良好的架構原則，但在現有架構下（純前端呼叫 Firebase），被繞過 UI 的風險較低。主要價值在於 redesign 時無論 UI 怎麼改，service 層的防線始終存在。

**Independent Test**: 在單元測試中直接呼叫 `createPost({ title: '', content: '', user })` ，驗證 function 拋出錯誤而非寫入 Firestore。

**Acceptance Scenarios**:

1. **Given** 外部程式碼直接呼叫 `createPost`, **When** title 為空（trim 後）, **Then** function 拋出描述性錯誤、不寫入 Firestore
2. **Given** 外部程式碼直接呼叫 `updatePost`, **When** content 超過字數上限, **Then** function 拋出描述性錯誤、不更新 Firestore
3. **Given** UI 層與 service 層, **When** 同時套用驗證規則, **Then** 兩層的規則邏輯一致（同樣的上限值、同樣的 trim 行為）

---

### Edge Cases

- 使用者貼上大量文字（例如整篇文章從別處複製）——本次只在送出時檢查，不做即時字數回饋（即時 counter 留待 UI redesign）
- 標題含有表情符號或特殊 Unicode 字元——字數計算以 JavaScript `string.length` 為準（與 event comments 一致）
- 使用者在標題/內容前後輸入大量空格——trim 後再計算長度
- 網路請求失敗時的錯誤提示——已由現行 try-catch + toast 處理，validation 發生在請求之前，不影響現有錯誤處理流程

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統 MUST 在送出文章前驗證標題 trim 後不為空
- **FR-002**: 系統 MUST 在送出文章前驗證內容 trim 後不為空
- **FR-003**: 系統 MUST 在送出文章前驗證標題不超過 50 字
- **FR-004**: 系統 MUST 在送出文章前驗證內容不超過 10,000 字
- **FR-005**: 驗證失敗時，系統 MUST 顯示 toast 提示訊息，說明具體哪個欄位不合規
- **FR-006**: 驗證失敗時，系統 MUST NOT 發送任何 Firestore 寫入請求
- **FR-007**: Service 層（`createPost` / `updatePost`）MUST 獨立於 UI 執行相同的驗證規則，驗證失敗時拋出描述性 Error
- **FR-008**: 驗證規則 MUST 同時適用於建立（create）和更新（update）流程
- **FR-009**: 驗證邏輯 MUST 在 trim 後的值上運作（前後空格不計入）
- **FR-010**: UI 層和 service 層的驗證常數（上限值）MUST 來自同一來源，確保一致性

### Key Entities

- **Post**: 文章實體。關鍵驗證屬性為 `title`（標題）與 `content`（內容），兩者皆為必填字串，有各自的字數上限。
- **Validation Rule**: 描述一組欄位的驗證條件（非空、最大長度），UI 層與 service 層共用。

## Assumptions

- 字數計算方式沿用 JavaScript `string.length`，與 event comments 的 500 字限制一致（不使用 `Intl.Segmenter` 或其他 grapheme-based 計數）
- 錯誤提示沿用現有的 `showToast` 機制，不新增其他 UI 元素（如 inline error message），因為 UI redesign 即將進行
- 不在此次加入即時字數顯示（typing 時的 counter），原因是 UI redesign 會重建表單元件。本次只做送出時的驗證
- Post comments 的驗證不在此 feature 範圍內（已有基本 trim + empty check，字數限制歸類為獨立 feature task）

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 空白標題或空白內容的文章，在任何流程下都無法被寫入資料庫
- **SC-002**: 超過字數上限的文章，在任何流程下都無法被寫入資料庫
- **SC-003**: 使用者在送出不合規文章後 1 秒內看到明確的錯誤提示
- **SC-004**: 所有驗證規則通過自動化測試覆蓋（service 層 unit test + UI 層 integration test）
- **SC-005**: 驗證邏輯不破壞現有的建立/編輯/更新文章的正常流程（既有功能的 regression test 通過）
