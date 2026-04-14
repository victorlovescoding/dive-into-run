# Feature Specification: deletePost Subcollection Cleanup

**Feature Branch**: `017-delete-post-cleanup`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "開發 A2: deletePost subcollection cleanup — 刪除文章時一併清除 likes/comments subcollection，避免孤兒資料殘留 Firestore"

## User Scenarios & Testing _(mandatory)_

### User Story 1 — 刪除文章時一併清除子資料 (Priority: P1)

使用者刪除一篇文章後，該文章底下的按讚紀錄和留言也應一併被移除，不再殘留在資料庫中產生儲存費用。使用者的操作體驗不變。

**Why this priority**: 這是 A2 的唯一目的——解決 deletePost 只刪 parent doc 導致 subcollection 孤兒化的問題。

**Independent Test**: 建立一篇文章、為它按讚和留言，然後刪除該文章。驗證文章本體、按讚紀錄和留言全部被移除。

**Acceptance Scenarios**:

1. **Given** 一篇文章有按讚和留言，**When** 作者刪除該文章，**Then** 文章、按讚紀錄、留言全部從資料庫中移除
2. **Given** 一篇文章沒有任何按讚和留言，**When** 作者刪除該文章，**Then** 刪除操作正常完成，文章從資料庫中移除

### Edge Cases

- 刪除過程中失敗時，現有的錯誤提示機制應正常運作

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統 MUST 在刪除文章時，一併刪除該文章下的所有按讚子資料
- **FR-002**: 系統 MUST 在刪除文章時，一併刪除該文章下的所有留言子資料
- **FR-003**: 系統 MUST 完整對齊 `deleteEvent` 的行為模式——包含存在性檢查（文章不存在時拋出錯誤）、batch 清理 subcollection、以及回傳 `{ ok: true }`
- **FR-004**: 系統 MUST 維持現有的使用者體驗不變（確認對話框、成功提示、錯誤提示、頁面行為）

### Key Entities

- **Post（文章）**: 文章主體文件
- **Like（按讚）**: 文章的子資料，記錄使用者按讚
- **Comment（留言）**: 文章的子資料，記錄留言內容

## Clarifications

### Session 2026-04-15

- Q: FR-003「參考 deleteEvent」的範圍？ → A: 完整對齊所有行為（存在性檢查 + batch 清理 + 回傳 `{ ok: true }`）
- Q: 單篇文章 likes + comments 合計是否可能超過 Firestore writeBatch 500 筆上限？ → A: 不會，沿用 single-batch，加 NOTE 註記即可
- Q: 「僅改動 service 層，UI 不需修改」假設是否成立？ → A: 成立。已驗證 page.jsx:272 和 PostDetailClient.jsx:237 兩處呼叫端皆有 try-catch + toast 錯誤提示，新增的 throw 會被現有 catch 接住

## Assumptions

- Post 的子資料集合僅有 `likes` 和 `comments`
- 僅改動後端 service 層的刪除邏輯，UI 不需修改
- 單篇文章的 likes + comments 合計不預期超過 Firestore writeBatch 500 筆上限，採用 single-batch 模式（同 deleteEvent），程式碼加 NOTE 註記未來若超過需改用分批 commit
- 部分失敗處理、效能影響等實作議題留給 plan 階段決定

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 刪除文章後，該文章的所有按讚和留言資料在資料庫中為零筆
- **SC-002**: 刪除操作的使用者體驗與現行完全一致
