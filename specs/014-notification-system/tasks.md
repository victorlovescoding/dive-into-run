# Tasks: 通知系統 (Notification System)

**Input**: Design documents from `/specs/014-notification-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## ⚠️ TDD 工作流程（嚴格遵守）

每個功能必須按照 **RED → GREEN → REFACTOR** 循環開發：

1. **RED**：先寫測試，確認測試失敗（`npx vitest run <test-file>` 應全部 FAIL）
2. **GREEN**：寫最少量的程式碼讓測試通過
3. **REFACTOR**：重構程式碼，確保測試仍然通過

**鐵律**：每個 `[GREEN]` task 結束時須包含 REFACTOR 步驟。REFACTOR 通過後，才能開始下一個 TDD 循環的 `[RED]` 階段。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- **[RED]**: TDD 紅燈 — 寫失敗測試
- **[GREEN]**: TDD 綠燈 — 實作讓測試通過 + 重構

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Firestore security rules + composite indexes 設定

- [ ] T001 Update firestore.rules — 新增 `match /notifications/{notificationId}` 區塊：create（登入+recipientUid!=self+type白名單+read==false+createdAt==request.time）、read（recipientUid==self）、update（recipientUid==self+只改read）、delete(false)，per data-model.md at firestore.rules
- [ ] T002 [P] Update firestore.indexes.json — 新增 2 組 composite indexes：(1) recipientUid ASC + createdAt DESC（全部查詢）、(2) recipientUid ASC + read ASC + createdAt DESC（未讀查詢）at firestore.indexes.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 純函式 + Service Layer — 所有 UI 元件的資料基礎

**⚠️ CRITICAL**: 所有 User Story 的 UI 元件依賴此 phase 完成

### TDD Cycle 1: notification-helpers.js

- [ ] T003 [RED] Write unit tests for `formatRelativeTime`（≤1min→'剛剛', ≤1hr→'N 分鐘前', ≤1day→'N 小時前', ≤1wk→'N 天前', >1wk→'M/D'）, `buildNotificationMessage`（event_modified/event_cancelled/post_new_comment → 對應中文訊息）, `getNotificationLink`（event→/events/{id}, post→/posts/{id}?commentId={cid}）in specs/014-notification-system/tests/unit/notification-helpers.test.js
- [ ] T004 [GREEN] Implement formatRelativeTime, buildNotificationMessage, getNotificationLink as pure functions in src/lib/notification-helpers.js — pass T003 tests, add JSDoc per contracts/notification-service.md, then refactor

### TDD Cycle 2: firebase-notifications.js — Write Functions

- [ ] T005 [RED] Write unit tests (mock Firestore writeBatch/addDoc/fetchParticipants) for `notifyEventModified`（batch create for all participants excluding actor, correct message）, `notifyEventCancelled`（same pattern, pre-fetched participants）, `notifyPostNewComment`（single addDoc, skip if actor===author）in specs/014-notification-system/tests/unit/firebase-notifications-write.test.js
- [ ] T006 [GREEN] Implement 3 write functions in src/lib/firebase-notifications.js — writeBatch for event notifications, addDoc for comment notification, import buildNotificationMessage from helpers, serverTimestamp for createdAt, pass T005 tests then refactor

### TDD Cycle 3: firebase-notifications.js — Read Functions + Update

- [ ] T007 [RED] Write unit tests (mock Firestore onSnapshot/getDocs/updateDoc) for `watchNotifications`（onSnapshot with recipientUid+orderBy createdAt desc+limit 5, returns unsubscribe, onNew callback：首次 snapshot 不觸發 onNew，後續 snapshot 中 docChanges type 'added' 的項目透過 onNew 回傳）, `watchUnreadNotifications`（+where read==false+limit 100）, `fetchMoreNotifications`（getDocs with startAfter cursor）, `fetchMoreUnreadNotifications`, `markNotificationAsRead`（updateDoc read:true）in specs/014-notification-system/tests/unit/firebase-notifications-read.test.js
- [ ] T008 [GREEN] Implement 4 read functions + markNotificationAsRead in src/lib/firebase-notifications.js — onSnapshot listeners return unsubscribe, getDocs with startAfter returns {notifications, lastDoc}; watchNotifications 新增第 4 參數 onNew — 內部 isInitialLoad flag，首次 snapshot 只呼叫 onNext，後續 snapshot 呼叫 onNext 後再從 docChanges 過濾 added items 呼叫 onNew（若未傳入 onNew 則跳過）, pass T007 tests then refactor

**Checkpoint**: Foundation ready — helpers + service layer 100% tested. User Story UI 開發可開始。

---

## Phase 3: User Story 1 — 通知鈴鐺與未讀計數徽章 (Priority: P1) 🎯 MVP

**Goal**: Nav 上顯示鈴鐺圖示 + 未讀數量紅色徽章，即時更新

**Independent Test**: 確認鈴鐺在 Nav 正確顯示、未讀數量正確（0/N/99+）、即時更新、未登入時隱藏

### Tests for US1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [RED] [US1] Write integration tests (mock service layer) for NotificationContext（unreadCount from listener, isPanelOpen toggle）+ NotificationBell（badge hidden when 0, shows count when >0, shows '99+' when >99, outlined/filled icon toggle, hidden when user=null）+ Navbar render 驗證（Bell 出現在 desktopLinks 和 UserMenu 之間；mobile Bell 出現在 hamburger 旁；未登入時 Navbar 不顯示 Bell）in specs/014-notification-system/tests/integration/NotificationBell.test.jsx

### Implementation for US1

- [ ] T010 [GREEN] [US1] Implement NotificationContext.jsx in src/contexts/NotificationContext.jsx — createContext, NotificationProvider (depends on AuthContext user.uid), setup watchUnreadNotifications + watchNotifications on login, cleanup on logout, expose unreadCount/isPanelOpen/togglePanel/closePanel, pass T009 tests then refactor
- [ ] T011 [GREEN] [US1] Implement NotificationBell.jsx + NotificationBell.module.css in src/components/Notifications/ — button with aria-label="通知" (or "通知，N 則未讀"), aria-expanded, outlined SVG bell (panel closed) / filled SVG bell (panel open), red circular badge with count / '99+', pass T009 tests then refactor
- [ ] T012 [US1] Add NotificationProvider to src/app/layout.jsx — wrap inside ToastProvider (after UserDataHandler, before Navbar + children), per contracts/notification-components.md Provider 層級
- [ ] T013 [US1] Add NotificationBell to src/components/Navbar/Navbar.jsx — desktop: between desktopLinks `</ul>` and `<UserMenu>`; mobile: after hamburger button; conditional on `user` login state + update Navbar.module.css for bell positioning

**Checkpoint**: Bell + badge visible on Nav. Unread count real-time. 99+ cap. Hidden when logged out. US1 independently testable.

---

## Phase 4: User Story 2 — 開啟通知面板並瀏覽通知列表 (Priority: P1)

**Goal**: 鈴鐺下方 Facebook 風格下拉面板，顯示最新 5 則通知（頭像+訊息+時間+未讀圓點）

**Independent Test**: 點開鈴鐺 → 面板顯示 → 通知列正確排列 → 已讀/未讀樣式差異 → 空狀態 → 外部點擊關閉

### Tests for US2

- [ ] T014 [RED] [US2] Write integration tests for NotificationPanel（opens when isPanelOpen, shows up to 5 notifications, empty state「目前沒有通知」, closes on outside click）+ NotificationItem（circular avatar, message text, relative time via formatRelativeTime, blue dot for unread / no dot for read, clickable element）in specs/014-notification-system/tests/integration/NotificationPanel.test.jsx

### Implementation for US2

- [ ] T015 [GREEN] [US2] Implement NotificationItem.jsx + NotificationItem.module.css in src/components/Notifications/ — layout: [avatar] [message + time] [blue dot], `notification` + `onClick` props, circular avatar (img), message text, formatRelativeTime(createdAt), conditional blue dot (read===false), accessible clickable element, pass T014 tests then refactor
- [ ] T016 [GREEN] [US2] Implement NotificationPanel.jsx + NotificationPanel.module.css in src/components/Notifications/ — id="notification-panel", role="region", aria-label="通知面板", header with title「通知」, NotificationItem list from Context notifications, empty state, max-height 70vh + overflow-y auto, outside click close (useRef + mousedown event), mobile width ~100vw, pass T014 tests then refactor

**Checkpoint**: Panel opens/closes. Shows latest 5 notifications. Read/unread distinction. Empty state. Outside click close. US2 independently testable.

---

## Phase 5: User Story 3 — 點擊通知導航至相關內容 (Priority: P1)

**Goal**: 點擊通知 → markAsRead + 導航至活動詳文頁或文章留言處 + 面板關閉

**Independent Test**: 分別點擊 event_modified / event_cancelled / post_new_comment 通知，驗證導航 URL、已讀狀態更新、面板關閉

### Tests for US3

- [ ] T017 [RED] [US3] Write integration tests for notification click behavior — click event_modified notification → markAsRead(id) called + router.push('/events/{entityId}') + closePanel(); click post_new_comment → router.push('/posts/{entityId}?commentId={cid}'); badge count decrements after markAsRead; 點擊後 blue dot 立即消失（樂觀更新，不等 onSnapshot 回寫）in specs/014-notification-system/tests/integration/notification-click.test.jsx

### Implementation for US3

- [ ] T018 [GREEN] [US3] Implement click handler composition in NotificationPanel — for each NotificationItem, compose onClick: () => { markAsRead(notification.id); router.push(getNotificationLink(notification)); closePanel(); }, add markAsRead to NotificationContext exports; markAsRead 除了呼叫 service layer，Context 需本地立即更新 notification.read = true（樂觀更新），不等 onSnapshot 回寫，確保「未讀」tab 中該通知立即消失、badge 數字立即減少, pass T017 tests then refactor

**Checkpoint**: All 3 notification types clickable. Correct navigation per type. Panel closes. Badge updates. US3 independently testable.

---

## Phase 6: User Story 4 — 全部/未讀分頁篩選 (Priority: P2)

**Goal**: 面板頂部「全部」/「未讀」分頁標籤，篩選通知列表

**Independent Test**: 切換分頁 → 列表正確篩選 → 「未讀」空狀態

### Tests for US4

- [ ] T019 [RED] [US4] Write integration tests for tab switching — default tab「全部」shows all notifications, click「未讀」shows only unread, empty state「沒有未讀通知」when all read, marking notification as read removes it from「未讀」view in specs/014-notification-system/tests/integration/NotificationTabs.test.jsx

### Implementation for US4

- [ ] T020 [GREEN] [US4] Implement activeTab('all'|'unread') + setActiveTab in NotificationContext, add tab UI to NotificationPanel header — role="tablist" container, two role="tab" buttons with aria-selected,「全部」displays Listener 2 data,「未讀」displays Listener 1 data (first 5 sliced), pass T019 tests then refactor

**Checkpoint**: Tab switching works.「全部」/「未讀」correctly filter.「未讀」empty state. US4 independently testable.

---

## Phase 7: User Story 5 — 分頁載入與無限滾動 (Priority: P2)

**Goal**: 初始 5 則 →「查看先前通知」按鈕 → IntersectionObserver 無限滾動

**Independent Test**: >5 則通知 → 按鈕出現 → 點擊載入更多 → 後續自動滾動載入 → 全部載入後停止

### Tests for US5

- [ ] T021 [RED] [US5] Write integration tests for pagination — initial 5 with「查看先前通知」button visible, button hidden when total ≤5, click button loads next 5, after first loadMore button disappears and infinite scroll activates, scroll to bottom triggers loadMore, stops loading when all notifications loaded (hasMore=false);「未讀」tab 超過 100 則時 → Listener 1 cache 用完後呼叫 fetchMoreUnreadNotifications 繼續載入 in specs/014-notification-system/tests/integration/NotificationPagination.test.jsx

### Implementation for US5

- [ ] T022 [GREEN] [US5] Implement loadMore/hasMore/isLoadingMore/hasLoadedMore in NotificationContext — 「全部」tab: loadMore calls fetchMoreNotifications with lastDoc cursor, appends results;「未讀」tab: 先從 Listener 1 資料 client-side slice（每次 5 則），Listener 1 資料用盡（≥ 100 則）後 fallback 呼叫 fetchMoreUnreadNotifications(uid, lastDoc) 繼續分頁; updates hasMore based on returned count vs PAGE_SIZE; add「查看先前通知」button to NotificationPanel bottom (hidden when !hasMore || total ≤5), pass T021 tests then refactor
- [ ] T023 [GREEN] [US5] Implement IntersectionObserver infinite scroll in NotificationPanel — sentinel div at list bottom, IntersectionObserver watches sentinel, triggers loadMore on intersection when hasLoadedMore===true && hasMore && !isLoadingMore, cleanup observer on unmount, pass T021 tests then refactor

**Checkpoint**: Initial 5 → button → infinite scroll. Stops at end. Works for both「全部」and「未讀」tabs. US5 independently testable.

---

## Phase 8: User Story 7 — 新通知 Toast 即時提示 (Priority: P2)

**Goal**: 新通知到達 → toast 短暫提示 → 5 秒自動消失 → 排隊顯示

**Independent Test**: 新通知 → toast 出現 → 5 秒消失 → 面板開啟時不顯示 → 初始載入不觸發 → 多則排隊

### Tests for US7

- [ ] T024 [RED] [US7] Write integration tests for toast — new notification (docChanges type 'added' after initial load) triggers toast with message text, toast auto-disappears after ~5s, no toast when isPanelOpen===true, no toast for initial snapshot load, multiple notifications queue sequentially (one at a time) in specs/014-notification-system/tests/integration/NotificationToast.test.jsx

### Implementation for US7

- [ ] T025 [GREEN] [US7] Implement toast queue in NotificationContext — 使用 watchNotifications 的 onNew callback 接收新通知（service layer 已處理 isInitialLoad + docChanges），enqueueToast(message) when panel closed, dequeue with 5s setTimeout, expose currentToast + dismissToast, pass T024 tests then refactor
- [ ] T026 [GREEN] [US7] Implement NotificationToast.jsx + NotificationToast.module.css in src/components/Notifications/ — role="status", aria-live="polite", displays currentToast.message, fade-in/fade-out CSS animation, not clickable (no onClick/pointer-events), render in src/app/layout.jsx inside NotificationProvider, pass T024 tests then refactor

**Checkpoint**: New notification → toast appears. 5s auto-dismiss. No stacking. Panel suppression. Initial load skipped. US7 independently testable.

---

## Phase 9: User Story 6 — 導航至留言處並高亮提示 (Priority: P3)

**Goal**: 文章通知點擊 → 滾動至目標留言 + 3 秒背景色高亮淡出

**Independent Test**: 從 /posts/{id}?commentId=xxx 進入 → 滾動至留言 → 高亮 3 秒淡出

### Tests for US6

- [ ] T027 [RED] [US6] Write integration tests for scroll-to-comment — when URL has ?commentId=xxx: getElementById called, scrollIntoView({ behavior: 'smooth', block: 'center' }) triggered, highlight CSS class applied to target element, highlight fades after ~3s; when commentId absent or element not found: no scroll/highlight in specs/014-notification-system/tests/integration/scroll-to-comment.test.jsx

### Implementation for US6

- [ ] T028 [GREEN] [US6] Implement scroll-to-comment in src/app/posts/[id]/PostDetailClient.jsx — useSearchParams() to get commentId, useEffect to getElementById(commentId) + scrollIntoView + add highlight class, CSS @keyframes highlightFade (3s ease-out, background-color transition) in PostDetailClient CSS module or new shared module, cleanup: remove class after animation ends, pass T027 tests then refactor

**Checkpoint**: Click post_new_comment notification → navigate + scroll to comment + 3s highlight fade. Graceful no-op when element missing. US6 independently testable.

---

## Phase 10: Notification Triggers — Cross-Cutting Integration

**Purpose**: 將通知建立邏輯整合至活動/文章頁面，完成「事件發生 → 通知產生 → 使用者接收」完整迴圈

### Tests for Triggers

- [ ] T029 [RED] Write integration tests for notification creation triggers — eventDetailClient: (1) edit submit → notifyEventModified(eventId, title, actor) called after updateEvent, (2) delete → fetchParticipants then notifyEventCancelled then deleteEvent (ordered), PostDetailClient: (3) add comment → notifyPostNewComment(postId, title, authorUid, commentId, actor) called after addComment, (4) self-action: commenter===author → notifyPostNewComment not called in specs/014-notification-system/tests/integration/notification-triggers.test.jsx

### Implementation for Triggers

- [ ] T030 [GREEN] Integrate notification creation into src/app/events/[id]/eventDetailClient.jsx — after successful updateEvent: call notifyEventModified(eventId, eventTitle, { uid, name, photoURL }); before deleteEvent: fetchParticipants → notifyEventCancelled → deleteEvent (sequential), pass T029 event tests then refactor
- [ ] T031 [GREEN] [P] Integrate notification creation into src/app/posts/[id]/PostDetailClient.jsx — after successful addComment: if commenter.uid !== post.authorUid, call notifyPostNewComment(postId, postTitle, postAuthorUid, newCommentId, { uid, name, photoURL }), pass T029 post tests then refactor

**Checkpoint**: Complete notification loop — event edit/delete + post comment produce notifications visible in bell + panel.

---

## Phase 11: Error Handling

**Purpose**: NotificationContext 的 onError 處理 + write function 失敗處理

- [ ] T034 [RED] Write integration tests for error handling — watchNotifications/watchUnreadNotifications onError fires → Context 透過既有 ToastContext 顯示「通知載入失敗」; notifyEventModified/notifyPostNewComment 失敗 → 呼叫端顯示錯誤 toast in specs/014-notification-system/tests/integration/notification-error.test.jsx
- [ ] T035 [GREEN] Implement error handling in NotificationContext onError callbacks → import useToast from ToastContext, show error toast; wrap trigger calls (T030/T031) in try-catch with error toast, pass T034 tests then refactor

**Checkpoint**: onError 路徑有錯誤 toast 提示。write function 失敗不靜默。

---

## Phase 12: E2E Validation

**Purpose**: Playwright E2E happy path 驗證完整通知迴圈，需 Firebase Emulator

- [ ] T036 [RED] Write Playwright E2E test for happy path 1 — 活動編輯 → 其他使用者鈴鐺顯示未讀 → 開面板看到通知 → 點擊導航至活動頁 in specs/014-notification-system/tests/e2e/notification-flow.spec.js
- [ ] T037 [RED] [P] Write Playwright E2E test for happy path 2 — 文章留言 → 作者收到通知 → 點擊導航至文章頁 → 滾動至留言並高亮 in specs/014-notification-system/tests/e2e/comment-notification-flow.spec.js

**Run**: `firebase emulators:exec --only auth,firestore "npm run test:e2e:emulator"`

**Checkpoint**: 2 個 E2E happy path 通過，完整通知迴圈在 emulator 環境下驗證。

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: 全面驗證、lint、type-check、IDE diagnostics

- [ ] T032 Run quickstart.md validation — 逐項對照 quickstart.md 檔案清單與實作建議順序，確認所有檔案已建立、所有修改已完成、所有依賴正確
- [ ] T033 [P] Run `npm run lint` + `npm run type-check` + `getDiagnostics` (via MCP) — fix all warnings/errors/hints, add unknown words to cspell.json

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: No dependency on Phase 1（rules 只影響部署，不影響 unit test）
- **US1 (Phase 3)**: Depends on Phase 2（需要 service layer 函式）
- **US2 (Phase 4)**: Depends on Phase 3（需要 NotificationContext + Bell 建立）
- **US3 (Phase 5)**: Depends on Phase 4（需要 Panel + Item 可點擊）
- **US4 (Phase 6)**: Depends on Phase 4（擴展 Panel 加入 tab UI）
- **US5 (Phase 7)**: Depends on Phase 4（擴展 Panel 加入分頁載入）
- **US7 (Phase 8)**: Depends on Phase 3（需要 Context listener 偵測新通知）
- **US6 (Phase 9)**: Depends on Phase 5（需要 click navigation 已完成）
- **Triggers (Phase 10)**: Depends on Phase 2（需要 write functions 已實作）
- **Error Handling (Phase 11)**: Depends on Phase 3（需要 NotificationContext 已建立）+ Phase 10（需要 trigger calls 已整合）
- **E2E (Phase 12)**: Depends on Phase 10（需要完整通知迴圈）+ Phase 11（error handling 完成）
- **Polish (Phase 13)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: After Foundational — MVP entry point, no dependency on other stories
- **US2 (P1)**: After US1 — builds on Bell + Context
- **US3 (P1)**: After US2 — adds click behavior to existing Panel + Item
- **US4 (P2)**: After US2 — extends Panel with tabs（independent of US3）
- **US5 (P2)**: After US2 — extends Panel with pagination（independent of US3, US4）
- **US7 (P2)**: After US1 — extends Context with toast（independent of US2+）
- **US6 (P3)**: After US3 — extends click navigation with highlight effect

### Parallel Opportunities

- Phase 1: T001 / T002 可平行
- **US4 (Phase 6)、US5 (Phase 7)、US7 (Phase 8) 可在 US2 完成後平行開發**（修改不同檔案區段）
- Phase 10 (Triggers) 可與 US4/US5/US6/US7 平行（修改完全不同的檔案）
- Phase 12 (E2E): T036 / T037 可平行（不同 spec 檔案）
- T030 / T031 可平行（不同檔案）
- 但嚴格 TDD 下建議依 priority 順序逐一完成每個 cycle

### Within Each TDD Cycle

1. `[RED]` 寫測試 → `npx vitest run <test-file>` 確認全部 FAIL
2. `[GREEN]` 寫最少程式碼讓測試通過
3. REFACTOR — 重構，再跑測試確認全部 PASS
4. `npm run type-check` + `npm run lint` 確認無錯誤
5. 確認通過後，才開始下一個 `[RED]`

---

## Parallel Example: After US2 Completion

```
# 以下 3 條線可平行推進（各自獨立 TDD cycle）：

Line A (US4): T019 [RED] → T020 [GREEN] → refactor
Line B (US5): T021 [RED] → T022 [GREEN] → T023 [GREEN] → refactor
Line C (US7): T024 [RED] → T025 [GREEN] → T026 [GREEN] → refactor

# 同時 Triggers 也可平行：
Line D (Triggers): T029 [RED] → T030 [GREEN] → T031 [GREEN] → refactor
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup（firestore config）
2. Complete Phase 2: Foundational（helpers + service layer，3 TDD cycles）
3. Complete Phase 3: US1（Bell + badge，1 TDD cycle + 2 wiring tasks）
4. **STOP and VALIDATE**: 手動驗證鈴鐺 + 未讀計數即時更新
5. 可部署為最小可用通知入口

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. **US1 → Bell + badge 可見 (MVP!)**
3. US2 → 面板可開啟、通知可閱讀
4. US3 → 通知可點擊、導航至目標頁
5. US4 → 全部/未讀分頁篩選
6. US5 → 分頁載入 + 無限滾動
7. US7 → Toast 即時提示
8. US6 → 留言高亮效果
9. Triggers → 完整通知迴圈（event/post → notification → user）
10. Error Handling → onError 錯誤提示
11. E2E → Playwright happy path 驗證
12. Polish → 驗證 + lint + type-check

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks
- `[RED]` = 寫失敗測試, `[GREEN]` = 實作通過 + 重構
- 每個 Checkpoint 獨立驗證該 User Story
- Unit tests: mock Firebase SDK (`vi.mock`), AAA pattern, F.I.R.S.T
- Integration tests: `@testing-library/user-event` (`userEvent.setup()`), `screen.getByRole`, mock service layer boundary
- 所有新增/修改的匯出函式需有 meaningful JSDoc
- CSS Modules 檔名: `ComponentName.module.css`
- 完成每個 task 後執行 `npm run type-check` + `npm run lint`
