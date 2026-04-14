# Feature Specification: Posts 頁面 Bug 修復 (A1 + A3 + A4)

**Feature Branch**: `016-posts-bug-fix`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: 修復 posts-bug-analysis.md 中 A1（null crash）、A3（dead state）、A4（like revert 邏輯錯誤）三個 bug

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 編輯已被刪除的文章不應 crash (Priority: P1)

使用者在文章列表頁點擊「編輯」按鈕，但該文章已被同一使用者在另一個 tab 刪除（僅作者本人有刪除權限）。因本地 state 未即時同步，`posts.find()` 回傳 `undefined`，導致頁面崩潰。系統應安全處理此情況。

**Why this priority**: 這是一個會導致整個頁面白屏的 crash bug，直接影響使用者體驗。guard clause 已存在但被註解掉，風險最高。

**Independent Test**: 在文章列表中，模擬文章不存在的情境下點擊編輯按鈕，驗證頁面不會崩潰且使用者收到提示。

**Acceptance Scenarios**:

1. **Given** 使用者在文章列表頁，**When** 點擊一篇已被刪除文章的「編輯」按鈕，**Then** 頁面不會 crash，並顯示提示訊息告知文章不存在
2. **Given** 使用者在文章列表頁，**When** 點擊一篇正常存在的文章的「編輯」按鈕，**Then** 正常進入編輯模式，行為不受影響

---

### User Story 2 - 按讚失敗時正確還原狀態 (Priority: P1)

使用者在文章列表頁對文章按讚，如果伺服器端操作失敗，前端的按讚狀態（是否已按讚、讚數）應該正確還原到按讚前的狀態，而非透過再次 toggle 來猜測還原。

**Why this priority**: 目前的 revert 邏輯在快速連點或 React batching 情境下會導致讚數錯位，屬於資料一致性問題。與 P1 並列因為雖不 crash 但會產生錯誤資料。

**Independent Test**: 模擬按讚 API 失敗的情境，驗證 UI 狀態正確還原到操作前的值。

**Acceptance Scenarios**:

1. **Given** 使用者尚未對某文章按讚（liked=false, count=5），**When** 按讚後伺服器回傳失敗，**Then** 狀態還原為 liked=false, count=5
2. **Given** 使用者已對某文章按讚（liked=true, count=6），**When** 取消讚後伺服器回傳失敗，**Then** 狀態還原為 liked=true, count=6
3. **Given** 使用者快速連續點擊按讚按鈕，**When** 其中一次操作失敗，**Then** 最終狀態與伺服器端一致，不會出現讚數錯位

---

### User Story 3 - 移除留言區冗餘的 isCommentEditing state (Priority: P2)

文章詳情頁中存在一個未被使用的 state（`setIsCommentEditing` 被呼叫但其值從未被讀取）。此 dead code 應被移除，消除不必要的 re-render 和程式碼混淆。

**Why this priority**: 不影響使用者可見行為，但會造成多餘 re-render 和維護混淆。優先度低於功能性 bug。

**Independent Test**: 移除 dead state 後，留言的建立、編輯、刪除流程皆正常運作。

**Acceptance Scenarios**:

1. **Given** 使用者在文章詳情頁，**When** 新增留言，**Then** 留言正常顯示
2. **Given** 使用者在文章詳情頁，**When** 編輯留言後儲存，**Then** 留言內容正確更新
3. **Given** 使用者在文章詳情頁，**When** 取消編輯留言，**Then** 回到非編輯狀態，留言內容不變

---

### Edge Cases

- 使用者在按讚 API 回應前切換頁面，狀態不應 corrupt
- 多個使用者同時對同一篇文章按讚，各自的 optimistic UI 不互相干擾（此為既有行為，修復不應破壞）

## Clarifications

### Session 2026-04-14

- Q: 此 bug fix branch 的交付物是否應包含自動化回歸測試？ → A: 不包含。此次僅手動驗證 + type-check/lint，自動化測試留給 redesign 後統一補。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 文章列表頁的編輯操作 MUST 在目標文章不存在時安全中止，不得導致頁面錯誤
- **FR-002**: 文章列表頁的編輯操作 MUST 在目標文章不存在時以既有 toast 樣式顯示提示訊息「文章不存在，無法編輯」
- **FR-003**: 文章列表頁的按讚失敗回復 MUST 使用 capture-and-restore 模式，將狀態還原至操作前的確切值
- **FR-004**: 文章列表頁的按讚失敗回復 MUST NOT 使用 re-toggle 方式猜測還原
- **FR-005**: 文章詳情頁 MUST 移除未被消費的 `isCommentEditing` state 及其所有 setter 呼叫
- **FR-006**: 以上修復 MUST NOT 改變任何既有的正常流程行為

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 文章被刪除後點擊編輯，頁面零 crash，使用者看到提示訊息
- **SC-002**: 按讚失敗後，UI 顯示的讚數與按讚狀態 100% 還原至操作前的值
- **SC-003**: 移除 dead state 後，`type-check` 與 `lint` 零新增錯誤
- **SC-004**: 文章詳情頁的留言建立、編輯、取消流程全部正常運作
- **SC-005**: 此 branch 不要求自動化測試；驗證以 type-check、lint、手動測試為準，自動化回歸測試留給 redesign 後統一補齊
