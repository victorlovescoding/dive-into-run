# Feature Specification: Post Detail 刪除時 Race Condition Guard

**Feature Branch**: `fix/post-detail-deleted-guard`
**Created**: 2026-04-16
**Status**: Approved
**Input**: User bug report: "同一篇文章詳文頁在 tab A、tab B 都開著，tab A 成功刪除後 tab B 按刪除會 throw『文章不存在』，使用者看到誤導的『刪除文章失敗，請稍後再試』toast"

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Race condition 時顯示正確的已刪除訊息 (Priority: P1)

使用者在不同瀏覽器 tab 開著同一篇文章詳文頁時，若其中一個 tab 先刪除成功，另一個 tab 再次按刪除時不應出現誤導的「刪除文章失敗」toast，而應直接顯示既有的「找不到這篇文章（可能已被刪除）」紅色卡片，與「載入時文章已刪除」（e358a82 的修復）的畫面一致。

**Why this priority**: 誤導訊息會讓使用者懷疑自己先前刪除操作是否成功，產生資料不一致的疑慮，影響核心刪除流程信任度。

**Independent Test**: 開兩個 tab 指向同一文章詳文頁，在 A tab 刪除成功後，切到 B tab 按刪除並確認 → 驗證 B tab 顯示紅色 errorCard「找不到這篇文章（可能已被刪除）」，且 **不出現**「刪除文章失敗，請稍後再試」toast。

**Acceptance Scenarios**:

1. **Given** 使用者 A tab 已將文章刪除成功，**When** B tab 使用者按刪除並確認，**Then** 頁面顯示「找不到這篇文章（可能已被刪除）」紅色卡片，不 navigate，不顯示任何 error toast
2. **Given** 文章仍然存在，**When** 作者從詳文頁按刪除並確認，**Then** 行為照舊（redirect 到 `/posts` 並顯示「文章已刪除」toast）
3. **Given** 文章仍然存在但刪除過程中 Firestore batch 失敗，**When** 作者按刪除，**Then** 顯示「刪除文章失敗，請稍後再試」toast（原有 fallback 錯誤處理不受影響）

### Edge Cases

- 同時雙 tab 幾乎同步按刪除：先到的 batch 成功，晚到的 batch 對不存在的 doc 執行 `delete()` 為 no-op，仍回 `{ ok: true }`，UX 上兩邊都視為刪除成功
- 非作者使用者但 UI stale（session 過期）→ Firestore rules 拋 `PERMISSION_DENIED`，訊息內容不是「文章不存在」，落入 fallback toast（不在本 scope）

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統 MUST 在 `deletePost` 偵測到文章不存在時，使 UI 層能可靠判別此情境（透過匯出常數 `POST_NOT_FOUND_MESSAGE` 作為 discriminator）
- **FR-002**: 系統 MUST 在 race condition 情境下，於 PostDetailClient 顯示既有的「找不到這篇文章（可能已被刪除）」紅色 errorCard（line 481-485 既有 UI，不新增元件）
- **FR-003**: 系統 MUST NOT 在 race condition 情境下顯示「刪除文章失敗，請稍後再試」toast
- **FR-004**: 系統 MUST 保留其他錯誤（如 Firestore batch 失敗、網路錯誤）原本的 toast fallback 行為
- **FR-005**: 系統 MUST 維持 `deletePost` 既有契約（017 spec FR-003），error 訊息字串內容不變（`'文章不存在'`），僅抽成常數

## Success Criteria

### Measurable Outcomes

- Race path: 紅卡片顯示、toast 未被呼叫、navigation 未發生
- Genuine error path: toast 「刪除文章失敗，請稍後再試」仍呼叫
- Happy path: `router.push('/posts?toast=文章已刪除')` 仍呼叫

## Out of Scope

- events 詳文頁的同類 race condition（`eventDetailClient.jsx` 的 `deleteEvent`）
- Error class 或 i18n sentinel 重構（目前沿用字串常數，待未來 i18n 時再升級）
- E2E 雙 context 測試基礎建設
