# Feature Specification: 模組化內容檢舉系統

**Feature Branch**: `104-content-report-module`
**Created**: 2026-06-16
**Status**: Draft
**Input**: User description: "建立一個可重用的 content report module，第一版只收檢舉資料；Phase 1 API/schema 支援 post、postComment、event、eventComment，但 UI 只接文章與文章留言。"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 檢舉文章內容 (Priority: P1)

登入使用者在文章列表、文章搜尋結果或文章詳細頁看到他人文章時，可以從三點更多選單開啟檢舉 modal，確認被檢舉文章預覽、選擇理由、補充細節並送出。送出成功後，內容仍保留在頁面上，使用者看到成功提示。

**Why this priority**: 文章是 Phase 1 最主要的公開內容；沒有文章檢舉，檢舉模組無法提供最基本的社群安全入口。

**Independent Test**: 可以只接文章 target，分別在 `/posts`、`/posts/search`、`/posts/[id]` 驗證非作者登入使用者看得到 `檢舉文章`、能完成送出、成功後內容不被隱藏，且作者本人與未登入使用者看不到該入口。

**Acceptance Scenarios**:

1. **Given** 登入使用者位於 `/posts` 且文章作者不是自己，**When** 使用者打開該文章三點更多選單，**Then** 選單顯示 `檢舉文章`。
2. **Given** 登入使用者位於 `/posts/search` 且搜尋結果文章作者不是自己，**When** 使用者打開該文章三點更多選單，**Then** 選單顯示 `檢舉文章`。
3. **Given** 登入使用者位於 `/posts/[id]` 且文章作者不是自己，**When** 使用者打開文章卡三點更多選單，**Then** 選單顯示 `檢舉文章`。
4. **Given** 使用者點擊 `檢舉文章`，**When** modal 開啟，**Then** modal title 顯示 `檢舉這篇文章`，並顯示被檢舉文章的簡短預覽供確認。
5. **Given** 使用者在文章檢舉 modal 選擇有效理由並送出，**When** 檢舉建立成功，**Then** 系統顯示 `已收到你的檢舉，我們會進行審查。`，且原文章仍顯示在頁面上。

---

### User Story 2 - 檢舉文章留言 (Priority: P1)

登入使用者在文章詳細頁看到他人留言時，可以從留言卡片的三點更多選單開啟檢舉 modal。Phase 1 必須涵蓋一般留言列表，以及 notification `?commentId=` deep-link 顯示的「通知中的留言」目標留言區塊；這不是人工置頂留言功能。

**Why this priority**: 留言是互動內容中最容易產生騷擾或違規內容的入口；若 notification deep-link 目標留言不能檢舉，使用者從通知抵達問題留言時會失去回報能力。

**Independent Test**: 可以在 `/posts/[id]` 準備一般留言與 notification `?commentId=` 目標留言，驗證非作者登入使用者皆看得到 `檢舉留言`、送出流程一致，且不新增任何人工置頂留言行為。

**Acceptance Scenarios**:

1. **Given** 登入使用者位於 `/posts/[id]` 且一般留言列表中某則留言作者不是自己，**When** 使用者打開該留言三點更多選單，**Then** 選單顯示 `檢舉留言`。
2. **Given** 登入使用者透過 `/posts/[id]?commentId={commentId}` 抵達通知目標留言區塊，且該留言作者不是自己，**When** 使用者打開該留言三點更多選單，**Then** 選單顯示 `檢舉留言`。
3. **Given** 使用者點擊 `檢舉留言`，**When** modal 開啟，**Then** modal title 顯示 `檢舉這則留言`，並顯示被檢舉留言的簡短預覽供確認。
4. **Given** 使用者成功檢舉一則留言，**When** 系統回到文章詳情頁，**Then** 被檢舉留言仍依原本可見性規則顯示，不因檢舉被隱藏或置頂。

---

### User Story 3 - 以一致表單提交檢舉理由 (Priority: P1)

登入使用者開啟任一檢舉 modal 後，可以從固定理由清單選擇檢舉原因，必要時輸入補充說明。表單在送出前進行明確驗證，避免空理由、過長說明或 `其他` 無說明的檢舉被送出。

**Why this priority**: 檢舉資料需要可分析且穩定的理由 key；表單驗證能減少無效資料並讓使用者知道缺少什麼。

**Independent Test**: 可以對任一支援 target 開啟 modal，逐一驗證所有理由、details 長度限制、`other` 的必填規則、送出中的 disabled 行為與防連點 guard。

**Acceptance Scenarios**:

1. **Given** 檢舉 modal 已開啟，**When** 使用者尚未選擇 reason 就送出，**Then** 系統阻止送出並提示 reason 必填。
2. **Given** 使用者選擇 `other`，**When** details trim 後為空並送出，**Then** 系統阻止送出並提示需填寫補充說明。
3. **Given** 使用者選擇非 `other` 的理由，**When** details 留白並送出，**Then** 系統允許送出。
4. **Given** 使用者輸入超過 500 字 details，**When** 表單驗證，**Then** 系統阻止送出並提示 details 最多 500 字。
5. **Given** 檢舉正在送出，**When** 使用者再次點擊送出按鈕，**Then** 系統只允許一次送出請求；送出按鈕 disabled，但 modal 仍可關閉。

---

### User Story 4 - 阻擋未授權、重複與無效檢舉 (Priority: P1)

系統只接受登入使用者對公開可見且未 soft-deleted 的他人內容建立檢舉。使用者不能檢舉自己的內容；同一位 reporter 對同一個 target 只能檢舉一次；第二次送出時才提示重複，不提供預查或個人檢舉列表。

**Why this priority**: 這是檢舉資料的安全邊界；若 client 能自行建立或查詢檢舉，會造成濫用、隱私洩漏或重複資料污染。

**Independent Test**: 可以透過 server entry 驗證未登入、target 不存在、target 不公開、target 已 soft-deleted、自檢舉、重複檢舉與有效檢舉的結果碼與使用者文案。

**Acceptance Scenarios**:

1. **Given** 未登入使用者看到支援檢舉的內容，**When** 使用者打開三點更多選單，**Then** 系統不顯示任何檢舉選項。
2. **Given** 登入使用者是 target 作者，**When** 使用者打開該 target 三點更多選單，**Then** 系統不顯示檢舉選項。
3. **Given** 登入使用者檢舉自己文章或自己留言，**When** server 驗證 target author 是 reporter，**Then** 系統拒絕並對使用者顯示 `不能檢舉自己的內容。`。
4. **Given** 登入使用者已經檢舉過同一 target，**When** 使用者再次送出同一 target 的檢舉，**Then** 系統拒絕並對使用者顯示 `你已經檢舉過這則內容。`。
5. **Given** 登入使用者想知道自己是否已檢舉某 target，**When** target 顯示或 modal 開啟，**Then** 系統不提供預查狀態；只有第二次送出時才揭露重複結果。

---

### User Story 5 - 建立可重用且分階段 rollout 的檢舉能力 (Priority: P2)

產品與工程團隊需要一個可重用的 content report module，讓 Phase 1 先支援文章與文章留言 UI，同時讓底層資料與安全契約能接收 `post`、`postComment`、`event`、`eventComment` 四種 target。Phase 2 再把活動與活動留言接到 UI。

**Why this priority**: 若底層契約不先模組化，後續活動與活動留言會重複實作或產生不一致的權限與資料格式。

**Independent Test**: 可以不接活動 UI，只驗證底層 contract 對四種 targetType 的驗證規則、target identity、snapshot 欄位與重複檢舉策略一致；同時驗證 Phase 1 頁面沒有活動檢舉入口。

**Acceptance Scenarios**:

1. **Given** Phase 1 已完成，**When** 使用者瀏覽活動或活動留言 UI，**Then** 系統不顯示活動或活動留言檢舉入口。
2. **Given** 後續 Phase 2 準備接活動留言 UI，**When** 實作前規劃開始，**Then** 團隊必須先確認活動留言是否已有 notification/deep-link target comment render path，不得沿用 Phase 1 文章留言假設。
3. **Given** 任何支援 targetType 的有效檢舉被建立，**When** 系統保存資料，**Then** report 文件包含一致的 target identity、targetKey、reporter、reason、details、status、createdAt、sourcePath 與 server 產生的最小 targetSnapshot。

### Edge Cases

- 未登入使用者不顯示檢舉選項；若直接呼叫建立檢舉入口，系統以 unauthenticated 拒絕。
- 作者本人不顯示檢舉選項；server 仍必須阻擋自檢舉。
- 自檢舉判斷只看 target author；使用者可以檢舉別人在自己文章或活動下的留言。
- target 不存在、非公開可見、或已 soft-deleted 時，系統不得建立 report。
- client 顯示的 target preview 只供使用者確認；實際保存的 snapshot 必須由 server 讀取 target 產生。
- 使用者送出中關閉 modal 時，不應造成第二次送出或 UI 卡死；已送出的請求仍依結果顯示成功或失敗提示。
- sourcePath 由 client 傳目前 route，但保存前必須 sanitize，避免保存任意外部 URL、script 或不可信 payload。
- details 以 trim 後內容判斷 `other` 是否有效；保存時不得超過 500 字。
- 重複檢舉不得透過讀取既有 report 列表或預查狀態揭露，只能在第二次建立時回應 duplicate。
- Phase 1 不建立 admin 審核列表、moderation action、通知、email/push、reporter history、media snapshot 或 Firestore composite index。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統 MUST 提供一個可重用的 content report module，讓不同頁面以同一套檢舉入口、表單驗證、送出流程、錯誤處理與成功提示提交檢舉。
- **FR-002**: Phase 1 底層 contract MUST 支援 `post`、`postComment`、`event`、`eventComment` 四種 targetType。
- **FR-003**: Phase 1 UI MUST only 接上 `post` 與 `postComment` target；MUST NOT 在活動或活動留言 UI 顯示檢舉入口。
- **FR-004**: Phase 2 接活動與活動留言 UI 前，MUST 先確認活動留言是否已有 notification/deep-link target comment render path；Phase 1 MUST NOT 猜測或新增該路徑需求。
- **FR-005**: 文章檢舉入口 MUST 出現在 `/posts`、`/posts/search`、`/posts/[id]` 的文章卡三點更多選單中。
- **FR-006**: 文章留言檢舉入口 MUST 出現在 `/posts/[id]` 目前可見的 `posts/{postId}/comments/{commentId}` 留言卡片三點更多選單中。
- **FR-007**: 文章留言檢舉入口 MUST 涵蓋一般留言列表與 notification `?commentId=` deep-link 顯示的「通知中的留言」目標留言區塊。
- **FR-008**: 系統 MUST NOT 因檢舉需求新增人工置頂留言功能。
- **FR-009**: 未登入使用者 MUST NOT 在三點更多選單看到任何檢舉選項。
- **FR-010**: 對於已接上 UI 的 target，已登入且不是 target 作者的使用者 MUST 在三點更多選單看到對應檢舉選項：`post` 顯示 `檢舉文章`，`postComment` 與 `eventComment` 顯示 `檢舉留言`，`event` 顯示 `檢舉活動`；Phase 1 MUST only expose `post` and `postComment` entries。
- **FR-011**: target 作者本人 MUST NOT 在該 target 三點更多選單看到檢舉選項。
- **FR-012**: 使用者點擊檢舉選項後，系統 MUST 開啟 modal 表單；MUST NOT 在選單內填寫檢舉表單。
- **FR-013**: 文章檢舉 modal title MUST be `檢舉這篇文章`。
- **FR-014**: 留言檢舉 modal title MUST be `檢舉這則留言`。
- **FR-015**: 活動檢舉 modal title MUST be `檢舉這個活動`。
- **FR-016**: 檢舉 modal MUST 顯示被檢舉內容的簡短預覽，讓使用者確認 target。
- **FR-017**: 系統 MUST treat client preview as untrusted; report 的 targetSnapshot MUST 由 server 讀取 target 後產生。
- **FR-018**: 檢舉 reason MUST 以穩定 key 保存，UI MUST 顯示中文 label。
- **FR-019**: reason key `spam` MUST 顯示為 `垃圾訊息`。
- **FR-020**: reason key `harassment` MUST 顯示為 `騷擾或霸凌`。
- **FR-021**: reason key `hate` MUST 顯示為 `仇恨或歧視`。
- **FR-022**: reason key `sexual` MUST 顯示為 `色情內容`。
- **FR-023**: reason key `violence` MUST 顯示為 `暴力或危險行為`。
- **FR-024**: reason key `illegal` MUST 顯示為 `違法內容`。
- **FR-025**: reason key `misinformation` MUST 顯示為 `不實或誤導`。
- **FR-026**: reason key `other` MUST 顯示為 `其他`。
- **FR-027**: reason MUST be required。
- **FR-028**: details MUST be limited to 500 characters。
- **FR-029**: 當 reason 是 `other` 時，details trim 後 MUST NOT be empty。
- **FR-030**: 當 reason 不是 `other` 時，details MAY be empty。
- **FR-031**: 送出中系統 MUST only disable 送出按鈕；modal MUST remain closable。
- **FR-032**: 送出流程 MUST include pending guard，防止使用者連點造成重複請求。
- **FR-033**: 檢舉成功後，系統 MUST NOT 隱藏被檢舉內容。
- **FR-034**: 檢舉成功後，系統 MUST 顯示 `已收到你的檢舉，我們會進行審查。`。
- **FR-035**: 第一版建立 report MUST only go through `POST /api/reports`。
- **FR-036**: client MUST NOT directly create、read、list、update、delete `reports`。
- **FR-037**: 建立 report 時，server MUST 檢查使用者已登入。
- **FR-038**: 建立 report 時，server MUST 檢查 target 存在。
- **FR-039**: 建立 report 時，server MUST 檢查 target 公開可見且未 soft-deleted。
- **FR-040**: 建立 report 時，server MUST 阻擋自檢舉。
- **FR-041**: 自檢舉判斷 MUST only compare reporter 與 target author；使用者 MAY 檢舉別人在自己文章或活動下的留言。
- **FR-042**: 同一 reporter 對同一 target MUST only be able to create one report。
- **FR-043**: duplicate policy MUST use deterministic hashed doc id，第二次建立同一 reporter-target report MUST return duplicate。
- **FR-044**: reporter MUST NOT be able to query their report history。
- **FR-045**: reporter MUST NOT be able to query whether a target has already been reported by them。
- **FR-046**: 系統 MUST only reveal duplicate state after the second submit attempt。
- **FR-047**: report 文件 MUST be saved in `reports` collection。
- **FR-048**: report 文件 MUST include `targetType`。
- **FR-049**: report 文件 MUST include target identifiers，例如 postId、commentId、eventId。
- **FR-050**: report 文件 MUST include deterministic `targetKey`。
- **FR-051**: report 文件 MUST include `reporterUid`。
- **FR-052**: report 文件 MUST include `reason`。
- **FR-053**: report 文件 MUST include `details`。
- **FR-054**: report 文件 MUST include `status: "open"`。
- **FR-055**: report 文件 MUST include `createdAt`。
- **FR-056**: report 文件 MUST include sanitized `sourcePath` from the current route。
- **FR-057**: report 文件 MUST include server-generated minimal `targetSnapshot`。
- **FR-058**: `targetSnapshot` MUST include `authorUid`。
- **FR-059**: `targetSnapshot` MUST include `authorDisplayName`。
- **FR-060**: `targetSnapshot` MUST preserve full title when the target has a title。
- **FR-061**: `targetSnapshot` MUST include body/comment excerpt limited to 500 characters。
- **FR-062**: `targetSnapshot` MUST include `targetPath`。
- **FR-063**: `targetSnapshot` MUST include target `createdAt`。
- **FR-064**: `targetSnapshot` MUST NOT save image or media URLs。
- **FR-065**: `targetSnapshot` MUST NOT save full author profile。
- **FR-066**: report MUST NOT save reporter display name or reporter profile。
- **FR-067**: validation failures MUST map to 400。
- **FR-068**: unauthenticated requests MUST map to 401。
- **FR-069**: self-report failures MUST map to 403。
- **FR-070**: target not found, non-visible, or soft-deleted failures MUST map to 404。
- **FR-071**: duplicate report failures MUST map to 409。
- **FR-072**: unexpected failures MUST map to 500 generic。
- **FR-073**: duplicate user-facing message MUST be `你已經檢舉過這則內容。`。
- **FR-074**: self-report user-facing message MUST be `不能檢舉自己的內容。`。
- **FR-075**: generic failure user-facing message MUST be `檢舉送出失敗，請稍後再試。`。
- **FR-076**: Phase 1 MUST NOT include admin review list。
- **FR-077**: Phase 1 MUST NOT include moderation action or soft-delete action。
- **FR-078**: Phase 1 MUST NOT write admin notification, email, or push notification。
- **FR-079**: Phase 1 MUST NOT create Firestore composite indexes。
- **FR-080**: Phase 1 MUST NOT include reporter report history。
- **FR-081**: Phase 1 MUST NOT save media snapshot。

### Key Entities

- **Report**: A single user-submitted allegation that one content target violates community expectations; identified deterministically by reporter and target, starts with status `open`, and stores only minimal reporter, target, reason, source, and snapshot data.
- **Report Target**: The content object being reported. Supported target types are `post`, `postComment`, `event`, and `eventComment`; Phase 1 UI exposes only `post` and `postComment`.
- **Target Identity**: The stable identifiers needed to find the target and enforce uniqueness, such as postId, commentId, eventId, plus a deterministic targetKey.
- **Reporter**: The authenticated user submitting the report. The report stores reporterUid only and does not store reporter display name or profile.
- **Reason**: A stable enum key selected by the reporter and displayed through a Traditional Chinese label.
- **Details**: Optional reporter-entered text up to 500 characters, required only when reason is `other`.
- **Target Snapshot**: A server-generated minimal snapshot that preserves enough context for later review: target author UID/display name, title if present, short content excerpt, target path, and target creation time.
- **Source Path**: The sanitized route where the reporter initiated the report, used as contextual metadata and not as proof of target state.

### Assumptions

- 「公開可見且未 soft-deleted」 follows each target domain's existing public visibility rules at implementation time.
- For comment targets, target author means the comment author, not the parent post or event author.
- For event targets, `檢舉活動` and `檢舉這個活動` are specified for Phase 2 UI readiness, but Phase 1 must not surface them.
- Phase 2 event-comment UI scope remains blocked until the implementation team confirms whether event comments have a notification/deep-link target comment render path.
- The same success/error copy can be delivered by the app's existing toast or equivalent user-facing feedback pattern; the spec only requires the user-visible message.

### Out of Scope

- Admin review list.
- Moderation action, content removal, or soft-delete action.
- Admin notification, email notification, or push notification.
- Firestore composite index creation.
- Reporter report history or any user-facing list of prior reports.
- Pre-checking whether the current user has already reported a target.
- Saving image/media URLs in report snapshots.
- Saving full author profile or reporter profile in report documents.
- Phase 1 event and event-comment UI integration.
- New artificial pinned-comment behavior.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of Phase 1 article report entry points on `/posts`, `/posts/search`, and `/posts/[id]` are available to authenticated non-authors and hidden from anonymous users and target authors.
- **SC-002**: 100% of currently visible Phase 1 post comment surfaces on `/posts/[id]`, including normal comments and notification `?commentId=` target comment blocks, expose `檢舉留言` only to authenticated non-authors.
- **SC-003**: 100% of accepted reports are created only through the required server entry and contain the required fields, `status: "open"`, sanitized sourcePath, and server-generated targetSnapshot.
- **SC-004**: 100% of self-report, unauthenticated, target-not-found/non-visible/soft-deleted, duplicate, validation, and unexpected-failure scenarios return the specified status class and user-facing message.
- **SC-005**: 100% of duplicate report attempts by the same reporter against the same target are rejected, while the first valid report is accepted.
- **SC-006**: 100% of report snapshots exclude media URLs, full author profiles, reporter display names, and reporter profiles.
- **SC-007**: At least 90% of usability-test participants can submit a valid report from a supported Phase 1 target in under 60 seconds without losing the content they were viewing.
- **SC-008**: Phase 1 release contains zero activity or activity-comment report UI entry points, while preserving a documented path for Phase 2 targetType support.
