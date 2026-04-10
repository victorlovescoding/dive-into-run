# Tasks: 使用者公開檔案頁面 (Public Profile)

**Input**: Design documents from `/specs/012-public-profile/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/firebase-profile-api.md, research.md, quickstart.md

> **TDD 流程備注**：在 `/speckit.implement` 階段，每個 task 開始前須先寫失敗測試（RED），實作通過（GREEN），重構（REFACTOR）。三階段通過後才可將該 task 標記為 `[x]`，然後才進入下一個 task 的 TDD 循環。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational — Service Layer

**Purpose**: 建立 `firebase-profile.js` 服務層，封裝所有公開檔案相關 Firestore 查詢。所有 UI task 都依賴此階段完成。

**Contract**: `specs/012-public-profile/contracts/firebase-profile-api.md`

- [ ] T000 Verify Firestore Security Rules — 確認 `users/{uid}` 允許 public read（FR-007）且 bio write 含 `size() <= 150` 驗證（FR-006）。對照 data-model.md 建議規則與現行 rules 合併。**驗證流程**：(1) 更新 `firestore.rules` (2) 啟動 emulator `firebase emulators:start --only auth,firestore` (3) 跑既有 E2E `npm run test:e2e:emulator` 確保無 regression (4) 通過後再部署到正式環境
- [ ] T001 Create `src/lib/firebase-profile.js` — JSDoc typedefs (`PublicProfile`, `ProfileStats`, `HostedEventsPage`) + implement `getUserProfile(uid)` per contract
- [ ] T001a Create `src/lib/firebase-profile-server.js` — export `getUserProfileServer(uid)` using `adminDb` from `firebase-admin.js`. 專供 Server Component (`page.jsx` generateMetadata) 使用，回傳 `PublicProfile | null`。JSDoc typedef 複用 `firebase-profile.js` 中的 `PublicProfile` (via `import('@/lib/firebase-profile').PublicProfile`)
- [ ] T002 Add `getProfileStats(uid)` to `src/lib/firebase-profile.js` — `Promise.all` parallel queries: hostedCount (`events`), joinedCount (`collectionGroup('participants')`), totalDistanceKm (`stravaConnections` check + `getAggregateFromServer` sum)
- [ ] T003 Add `getHostedEvents(uid, options?)` to `src/lib/firebase-profile.js` — Firestore cursor-based pagination, `limit(pageSize + 1)` for hasMore detection, normalize to `EventData`。**Index 處理**：查詢 `events` where `hostUid == uid` orderBy `time desc` 需要 composite index `(hostUid asc, time desc)`。若首次執行 SDK 報錯，點 console 連結一鍵建立，建立完成後更新 `firestore.indexes.json` 以便版控

**Checkpoint**: Service layer complete — 3 client-side query functions (`firebase-profile.js`) + 1 server-side function (`firebase-profile-server.js`) available for UI consumption

---

## Phase 2: User Story 1 — 瀏覽主揪的公開檔案 (Priority: P1) MVP

**Goal**: 建立 `/users/[uid]` 公開檔案頁面，顯示跑者的頭像、名稱、簡介、加入日期、統計數據和主辦活動列表。未登入訪客也可瀏覽。

**Independent Test**: 直接輸入某使用者的公開檔案 URL，驗證可以看到頭像、名稱、簡介、加入日期、統計數據、主辦活動列表。造訪不存在的 UID 顯示友善提示。

> **Note**: T004/T005/T006 標記 [P] 表示彼此無邏輯相依，但三者共用 `PublicProfile.module.css`（各自 append class）。TDD 循序執行不衝突。

- [ ] T004 [P] [US1] Create `src/app/users/[uid]/ProfileHeader.jsx` — 頭像（含 fallback）、名稱、簡介（有才顯示，bio 為空則隱藏區塊）、加入日期格式化 + styles in `PublicProfile.module.css`
- [ ] T005 [P] [US1] Create `src/app/users/[uid]/ProfileStats.jsx` — 開團數 / 參團數 / 累計公里數（`totalDistanceKm === null` 時隱藏公里數欄位，`=== 0` 時顯示 `0 km`）+ styles in `PublicProfile.module.css`
- [ ] T006 [P] [US1] Create `src/app/users/[uid]/ProfileEventList.jsx` — IntersectionObserver + sentinel 觸發 `getHostedEvents` 分頁載入，空狀態顯示「尚無主辦活動」。複用 `src/components/DashboardEventCard.jsx` 渲染每筆活動（傳入 `isHost={true}`）+ styles in `PublicProfile.module.css`
- [ ] T007 [US1] Create `src/app/users/[uid]/ProfileClient.jsx` — `'use client'` orchestrator，接收 `user` prop（from page.jsx 的 server-side fetch）+ 呼叫 `getProfileStats` / `getHostedEvents`，compose ProfileHeader + ProfileStats + ProfileEventList，管理 loading / error state
- [ ] T008 [US1] Create `src/app/users/[uid]/page.jsx` — Server Component with `generateMetadata`（og:title / og:description / og:image），呼叫 `getUserProfileServer(uid)` (from `firebase-profile-server.js`) 取 user data 並以 prop 傳給 `<ProfileClient>`，不存在時 `notFound()`（FR-008）

**Checkpoint**: 公開檔案頁面可獨立運作，支援 SEO、not-found、未登入瀏覽

---

## Phase 3: User Story 2 — 全站使用者連結 (Priority: P1)

**Goal**: 建立共用 `UserLink` 元件，讓全站所有使用者名稱/頭像可點擊跳轉至公開檔案頁面。

**Independent Test**: 在活動卡片、活動詳情頁主揪/參與者、留言區作者、文章作者位置點擊名稱或頭像，驗證可跳轉至對應使用者的公開檔案。

- [ ] T009 [US2] Create `src/components/UserLink.jsx` + `src/components/UserLink.module.css` — props: uid, name, photoURL, size, showAvatar, showName, className；含頭像 fallback、a11y（aria-label）、Next.js Link
- [ ] T010 [P] [US2] Replace author name/avatar with `<UserLink>` in `src/components/CommentCard.jsx`
- [ ] T011 [P] [US2] Replace host name/avatar + participant names with `<UserLink>` in `src/app/events/[id]/eventDetailClient.jsx`
- [ ] T012 [P] [US2] Replace author display with `<UserLink>` in `src/app/posts/[id]/PostDetailClient.jsx`
- [ ] T013 [P] [US2] Replace host name with `<UserLink>` in `src/app/events/page.jsx` (EventCard area)
- [ ] T014 [P] [US2] Replace author name with `<UserLink>` in `src/app/posts/page.jsx` (PostCard area)

**Checkpoint**: 全站使用者名稱/頭像可點擊跳轉至公開檔案

---

## Phase 4: User Story 3 — 編輯個人簡介 (Priority: P2)

**Goal**: 讓已登入使用者在會員頁面新增或編輯 Bio，儲存後公開檔案顯示新內容。

**Independent Test**: 登入後進入會員頁面，輸入/修改簡介文字，儲存後造訪自己的公開檔案頁面，驗證簡介正確顯示。超過 150 字時無法儲存。

- [ ] T015 [US3] Add `updateUserBio(uid, bio)` to `src/lib/firebase-profile.js` — client-side `bio.length <= 150` validation + `setDoc(merge: true)` + throw Error if exceeded
- [ ] T016 [US3] Add Bio editor section to `src/app/member/page.jsx` — textarea + live char counter (X/150) + save button + success/error feedback，讀取現有 bio 從 AuthContext user data

**Checkpoint**: Bio 編輯完整流程可獨立運作

---

## Phase 5: User Story 4 — 查看自己的公開檔案 (Priority: P3)

**Goal**: 讓已登入使用者可預覽自己的公開檔案，並在頁面上看到「這是你的公開檔案」提示和編輯連結。

**Independent Test**: 登入後造訪自己的 UID 公開檔案 URL，驗證顯示「這是你的公開檔案」提示和編輯連結。會員頁面有「查看我的公開檔案」連結。

- [ ] T017 [US4] Add self-profile banner in `src/app/users/[uid]/ProfileClient.jsx` — 比對 AuthContext currentUser.uid 與頁面 uid，相符時顯示「這是你的公開檔案」提示 + 「編輯個人資料」連結（導向 `/member`）
- [ ] T018 [US4] Add "查看我的公開檔案" link in `src/app/member/page.jsx` — 使用 AuthContext currentUser.uid 組成 `/users/{uid}` 連結

**Checkpoint**: 自我預覽流程完整

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全面品質檢查

- [ ] T019 Run `npm run lint` + `npm run type-check` and fix all issues across new/modified files
- [ ] T020 Run quickstart.md validation — verify all acceptance scenarios from spec.md。額外驗證：(1) FR-007 未登入狀態可正常瀏覽（無權限錯誤）(2) FR-009 Bio 含特殊字元 `<script>` 時正確轉義顯示 (3) SC-001 效能驗證：Chrome DevTools → Performance → 錄製首次載入 `/users/[uid]`，確認 LCP (Largest Contentful Paint) < 2s（在一般網路條件下，非 throttled slow 3G）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS all user stories
- **US1 (Phase 2)**: Depends on Phase 1 (service layer)
- **US2 (Phase 3)**: Depends on Phase 1 (service layer) + functionally depends on US1 (page must exist for links to work)
- **US3 (Phase 4)**: Depends on Phase 1 (service layer). Independent of US1/US2
- **US4 (Phase 5)**: Depends on US1 (modifies `ProfileClient.jsx`). Depends on US3 (member page Bio editor should exist for edit link to be meaningful)
- **Polish (Phase 6)**: Depends on all user stories

### Within Each User Story

- T001a depends on T001 (shared typedef from firebase-profile.js)
- T004/T005/T006 are [P] — no mutual dependencies, can execute in any order
- T007 depends on T004-T006 (imports sub-components)
- T008 depends on T007 (renders ProfileClient) + T001a (calls getUserProfileServer)
- T009 must complete before T010-T014 (UserLink component must exist)
- T010-T014 are [P] — no mutual dependencies
- T015 must complete before T016 (service function before UI)

### Parallel Opportunities

```bash
# Phase 2: Sub-components can be built in parallel
Task: T004 "ProfileHeader.jsx"
Task: T005 "ProfileStats.jsx"
Task: T006 "ProfileEventList.jsx"

# Phase 3: Site-wide UserLink replacements in parallel
Task: T010 "CommentCard.jsx"
Task: T011 "eventDetailClient.jsx"
Task: T012 "PostDetailClient.jsx"
Task: T013 "events/page.jsx"
Task: T014 "posts/page.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Service Layer (T001-T003)
2. Complete Phase 2: US1 公開檔案頁面 (T004-T008)
3. **STOP and VALIDATE**: `/users/[uid]` 頁面可獨立瀏覽
4. 可部署 MVP

### Incremental Delivery

1. Phase 1 → Service layer ready
2. Phase 2 (US1) → 公開檔案頁面上線 (MVP!)
3. Phase 3 (US2) → 全站連結可點擊
4. Phase 4 (US3) → Bio 編輯功能
5. Phase 5 (US4) → 自我預覽 + 編輯導引
6. Phase 6 → 品質驗收

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
