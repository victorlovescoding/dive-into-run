# Tasks: Strava 跑步紀錄串接

**Input**: Design documents from `/specs/006-strava-running-records/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: Not explicitly requested — test tasks excluded.

**Organization**: Tasks grouped by user story. P1 stories (US1, US2, US3) can execute **in parallel** after Phase 2 — see Dependencies section for maximum subagent concurrency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create pure utility modules, update navigation

- [x] T001 Install dependencies via `npm install firebase-admin @mapbox/polyline`
- [x] T002 [P] Create pure utility module in `src/lib/strava-helpers.js` — export functions: `formatDistance(meters)` → `"5.2 km"`, `formatPace(movingTimeSec, distanceMeters)` → `"5'29\"/km"`, `formatDuration(seconds)` → `"28:30"` or `"1:02:30"`, `decodePolyline(encoded)` → `[[lat, lng], ...]` via `@mapbox/polyline`. All with JSDoc types. No project imports — pure functions only
- [x] T003 [P] Create Admin SDK singleton in `src/lib/firebase-admin.js` — init Firebase Admin with env vars（優先使用 `GOOGLE_APPLICATION_CREDENTIALS` service account JSON 路徑，或 `FIREBASE_ADMIN_PROJECT_ID` + Application Default Credentials）, export `adminDb` (Firestore instance) and `verifyAuthToken(request)` helper that extracts Bearer token from Authorization header, verifies via `admin.auth().verifyIdToken()`, returns decoded uid. Include JSDoc, and export `syncStravaActivities({ uid, accessToken, afterEpoch })` — shared server-side helper: fetch `GET /api/v3/athlete/activities?after={afterEpoch}&per_page=100`, filter type in ['Run','TrailRun','VirtualRun'], batch `setDoc(merge:true)` to `stravaActivities/{stravaId}` per data-model.md, update `lastSyncAt=serverTimestamp()` on both `stravaTokens/{uid}` and `stravaConnections/{uid}`, return synced count. Used by both T006 and T007 to avoid duplication
- [x] T004 [P] Add "跑步" nav link (`<Link href="/runs">跑步</Link>`) after "揪團頁面" link in `src/app/layout.jsx`

**Note**: T001 must complete before T003. T002 and T004 can start immediately (zero project deps).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Client Firestore service layer, server Route Handlers, and security rules — ALL user stories depend on these

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Create client Firestore service layer in `src/lib/firebase-strava.js` — export: `listenStravaConnection(uid, callback)` (realtime `onSnapshot` on `stravaConnections/{uid}`), `getStravaActivities(uid, pageSize, lastDoc?)` (query `stravaActivities` where `uid==uid`, orderBy `startDate desc`, limit `pageSize`, optional `startAfter`). Follow patterns from existing `src/lib/firebase-events.js`. All with JSDoc types per data-model.md entities
- [x] T006 [P] Create OAuth callback Route Handler in `src/app/api/strava/callback/route.js` — `export async function POST(request)`: (1) verify Firebase ID token via `verifyAuthToken(request)`, (2) extract `{ code }` from request body, (3) POST to `https://www.strava.com/api/v3/oauth/token` with `client_id`, `client_secret`, `code`, `grant_type=authorization_code`, (4) write `stravaTokens/{uid}` (accessToken, refreshToken, expiresAt, athleteId, connectedAt=serverTimestamp) — 注意：不設 lastSyncAt，等首次同步完成才寫入, (5) write `stravaConnections/{uid}` (connected=true, athleteId, athleteName from `athlete.firstname + ' ' + athlete.lastname`, connectedAt) — 注意：不設 lastSyncAt, (6) 呼叫 syncStravaActivities({ uid, accessToken, afterEpoch: twoMonthsAgoEpoch }) 觸發首次同步（邏輯已封裝在 firebase-admin.js 的 shared helper）, (7) return `NextResponse.json({ success: true, athleteName, syncedCount })`. Handle errors: invalid code → 400, syncStravaActivities 失敗 → 仍回 success 但 syncedCount=0
- [x] T007 [P] Create activity sync Route Handler in `src/app/api/strava/sync/route.js` — `export async function POST(request)`: (1) verify auth + get uid, (2) read `stravaTokens/{uid}`, check 1h cooldown from `lastSyncAt`（若 `lastSyncAt` 不存在則跳過 cooldown，視為首次同步）, (3) if `expiresAt < now`: refresh token via Strava `POST /api/v3/oauth/token` with `grant_type=refresh_token`, update `stravaTokens/{uid}`, (4) 呼叫 syncStravaActivities({ uid, accessToken, afterEpoch: lastSyncAt 或 twoMonthsAgoEpoch })（邏輯含 fetch → filter → batch write → update lastSyncAt，已封裝在 firebase-admin.js）, (5) return { success: true, count: syncedCount }. Handle: cooldown not met (return 429), token refresh failure (return 401), syncStravaActivities 失敗 (return 500)
- [x] T008 [P] Update Firestore security rules in `firestore.rules` — add three new collection rules after existing rules: (1) `stravaTokens/{uid}`: `allow read, write: if false` (server-only), (2) `stravaConnections/{uid}`: `allow read: if isSignedIn() && request.auth.uid == uid; allow write: if false`, (3) `stravaActivities/{id}`: `allow read: if isSignedIn() && request.auth.uid == resource.data.uid; allow write: if false`

**Checkpoint**: Foundation ready — all P1 user stories can now begin **in parallel**

---

## Phase 3: US1 — Strava 帳號連結 (Priority: P1)

**Goal**: 使用者透過 OAuth 連結 Strava 帳號，連結後看到已連結狀態與帳號名稱

**Independent Test**: 點擊「連結 Strava」→ 完成 OAuth → 頁面顯示已連結狀態與 Strava 帳號名稱

> ⚡ Phase 3, 4, 5 的所有 [P] 任務可同時開啟 subagent（共 **8 個並行任務**）

- [x] T009 [P] [US1] Create `src/hooks/useStravaConnection.js` — hook takes no args, uses `AuthContext` for uid. Returns `{ connection, isLoading, error }`. Internally calls `listenStravaConnection(uid, callback)` from firebase-strava.js, cleans up listener on unmount. `connection` shape matches `StravaConnection` entity from data-model.md. Handle: user not logged in (return null connection), listener error. Follow hook patterns from existing `src/hooks/useComments.js`
- [x] T010 [P] [US1] Create `src/app/runs/callback/page.jsx` + `src/app/runs/callback/callback.module.css` — 'use client' page. On mount: read `code` and `error` from `useSearchParams()`. If `error` or no `code`: show error message + link back to `/runs`. If `code`: call `POST /api/strava/callback` with `{ code }` and `Authorization: Bearer <idToken>` (透過 AuthContext 取得 user，call `user.getIdToken()` — 不直接 import `firebase/auth`), show loading spinner during request, on success `router.replace('/runs')`, on failure show error + retry link. CSS: centered layout with status message

**Checkpoint**: OAuth flow works end-to-end

---

## Phase 4: US2 — 跑步紀錄瀏覽 (Priority: P1)

**Goal**: 已連結使用者看到跑步紀錄列表 — 活動名稱、距離、配速、時間、路線地圖

**Independent Test**: 連結 Strava 後，頁面顯示跑步紀錄列表，每筆含指標，有 GPS 的顯示路線地圖

- [x] T011 [P] [US2] Create `src/hooks/useStravaActivities.js` — hook takes no args, uses `AuthContext` for uid. Returns `{ activities, isLoading, error }`. On mount: call `getStravaActivities(uid, 10)` from firebase-strava.js. `activities` is array of `StravaActivity` objects per data-model.md. Handle: user not connected (return empty array), query error. Follow patterns from existing hooks
- [x] T012 [P] [US2] Create `src/hooks/useStravaSync.js` — hook takes `lastSyncAt` (Timestamp or null). Returns `{ sync, isSyncing, cooldownRemaining, error }`. `sync()` calls `POST /api/strava/sync` with Firebase ID token. `cooldownRemaining` is seconds until cooldown ends (1h from lastSyncAt), decrements via `setInterval` every second, 0 when ready. Handle: sync failure, already syncing guard. Cleanup interval on unmount
- [x] T013 [P] [US2] Create `src/components/RunsRouteMap.jsx` + `src/components/RunsRouteMap.module.css` — use `next/dynamic` with `{ ssr: false }` to lazy-load map. Props: `{ summaryPolyline }` (encoded string). Decode via `decodePolyline()` from strava-helpers.js, render `MapContainer` > `TileLayer` (OpenStreetMap) > `Polyline` (decoded coords). Auto-fit bounds to polyline. Fixed height container. Follow SSR-disable pattern from existing `src/components/EventMap.jsx`
- [x] T014 [P] [US2] Create `src/components/RunsActivityCard.jsx` + `src/components/RunsActivityCard.module.css` — Props: `{ activity }` (StravaActivity object). Layout per spec wireframe: (1) 活動名稱 at top，右側或下方顯示活動日期（用 startDateLocal）, (2) 三欄橫排: 距離 label + `formatDistance()`, 配速 label + `formatPace()`, 時間 label + `formatDuration()`, (3) if `activity.summaryPolyline`: render `<RunsRouteMap summaryPolyline={...} />`. Use strava-helpers.js for all formatting. CSS Modules for card styling
- [x] T015 [US2] Create `src/components/RunsActivityList.jsx` + `src/components/RunsActivityList.module.css` — Props: `{ activities, isLoading, error }`. Render: if `isLoading` → loading skeleton; if `error` → error message with retry; if `activities.length === 0` → empty state "目前沒有跑步紀錄，去跑一趟吧！"; else → map activities to `<RunsActivityCard>`. Depends on T014 (RunsActivityCard component)

**Checkpoint**: Activity display components ready

---

## Phase 5: US3 — 未連結引導畫面 (Priority: P1)

**Goal**: 未登入/未連結使用者看到對應引導畫面

**Independent Test**: 以未連結帳號及未登入狀態進入「跑步」頁面，確認各自看到對應引導

- [x] T016 [P] [US3] Create `src/components/RunsLoginGuide.jsx` + `src/components/RunsLoginGuide.module.css` — 引導未登入使用者畫面。顯示標題提示使用者先登入、登入按鈕或連結。CSS: 置中排版，清楚的 CTA
- [x] T017 [P] [US3] Create `src/components/RunsConnectGuide.jsx` + `src/components/RunsConnectGuide.module.css` — 引導已登入但未連結 Strava 的畫面。標題「連結你的 Strava 帳號」、副標「追蹤你的跑步紀錄」、「連結 Strava」按鈕。按鈕 onClick 構建 Strava OAuth URL: `https://www.strava.com/oauth/authorize?client_id=${NEXT_PUBLIC_STRAVA_CLIENT_ID}&redirect_uri=${origin}/runs/callback&response_type=code&scope=activity:read_all` 並 `window.location.href` 跳轉。CSS: 置中排版

**Checkpoint**: Guide components ready

---

## Phase 6: Integration — Main Page

**Purpose**: Assemble all hooks and components into the main runs page

- [x] T018 Create `src/app/runs/page.jsx` + `src/app/runs/runs.module.css` — 'use client' orchestrator. Imports: `AuthContext`, `useStravaConnection`, `useStravaActivities`, `useStravaSync`, `RunsLoginGuide`, `RunsConnectGuide`, `RunsActivityList`. Render logic: (1) if auth `loading` → page skeleton, (2) if `!user` → `<RunsLoginGuide />`, (3) if `!connection?.connected` → `<RunsConnectGuide />`, (4) else → header area with Strava athlete name + sync button (disabled if `cooldownRemaining > 0`, show countdown) + `<RunsActivityList activities={activities} isLoading={activitiesLoading} error={activitiesError} />`. Follow page layout patterns from `src/app/events/page.jsx`. CSS Modules for page layout

**Checkpoint**: All P1 stories (US1 + US2 + US3) fully functional and testable

---

## Phase 7: US4 — 取消 Strava 連結 (Priority: P2)

**Goal**: 已連結使用者可取消連結，系統清除所有 Strava 相關資料

**Independent Test**: 已連結使用者點擊取消連結 → 確認 → 連結狀態重置，資料清除

- [x] T019 [P] [US4] Create `src/app/api/strava/disconnect/route.js` — `export async function POST(request)`: (1) verify auth, (2) batch: delete `stravaTokens/{uid}`, update `stravaConnections/{uid}` to `{ connected: false }` (keep doc for state tracking), query + batch delete all `stravaActivities` where `uid == userId`（若超過 500 筆，用 while loop 分批查詢+刪除，每批 <=500）, (3) return `{ success: true }`. Handle: user not connected (return 400), batch delete pagination (Firestore batch limit 500)
- [x] T020 [US4] Add disconnect UI in `src/app/runs/page.jsx` — 在已連結狀態的 header 區域加「取消連結」文字按鈕，點擊後顯示確認 dialog（`window.confirm` 或簡易 modal），確認後呼叫 `POST /api/strava/disconnect` with Bearer token，成功後 connection listener 自動更新 UI 回到未連結狀態

**Checkpoint**: Disconnect flow works

---

## Phase 8: US5 — 分頁載入更多紀錄 (Priority: P2)

**Goal**: 無限滾動載入更多歷史跑步紀錄，每次 10 筆

**Independent Test**: 捲動至列表底部附近，確認自動載入下一批紀錄

- [x] T021 [US5] Update `src/hooks/useStravaActivities.js` — add cursor-based pagination: track `lastDoc` (last Firestore DocumentSnapshot), export additional `loadMore()` function, `hasMore` boolean, `isLoadingMore` boolean. `loadMore()` calls `getStravaActivities(uid, 10, lastDoc)`, appends results, updates `lastDoc`. Set `hasMore = false` when results < pageSize. Follow infinite scroll pattern from `src/hooks/useComments.js` (`sentinelRef` + IntersectionObserver approach)
- [x] T022 [US5] Update `src/components/RunsActivityList.jsx` — accept additional props `{ loadMore, hasMore, isLoadingMore }`. Add sentinel `<div ref={sentinelRef}>` at list bottom, use IntersectionObserver to trigger `loadMore()` when visible. Show "載入中..." spinner when `isLoadingMore`, show "已載入全部紀錄" when `!hasMore && activities.length > 0`. Follow sentinel pattern from `src/hooks/useComments.js`

**Checkpoint**: Infinite scroll works

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T023 Run `npm run lint` and `npm run type-check` — fix all errors across all new/modified files
- [x] T024 Create Firestore composite index for `stravaActivities`: fields `uid ASC, startDate DESC` — add entry to `firestore.indexes.json` (or create file if not exists)
- [x] T025 Handle Strava token revocation edge case — 在 `src/app/api/strava/sync/route.js` 中，當 token refresh 失敗（Strava 回 401/403）時，更新 `stravaConnections/{uid}` 為 `{ connected: false }`，前端 `useStravaConnection` listener 自動偵測到變化，UI 切回未連結引導畫面，提示使用者重新連結
- [x] T026 Handle Strava API unavailable state — 在 `src/hooks/useStravaSync.js` 中，sync 失敗時 set error state。在 `src/app/runs/page.jsx` 中，sync error 時顯示 toast/提示「同步失敗，請稍後再試」，已快取的紀錄（Firestore 資料）照常顯示不受影響

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3, 4, 5 (US1, US2, US3)**: All depend on Phase 2 — **can run in parallel**
- **Phase 6 (Integration)**: Depends on Phase 3, 4, 5 completion
- **Phase 7 (US4)**: Depends on Phase 6 (main page must exist to add UI)
- **Phase 8 (US5)**: Depends on Phase 6 (activity list must exist to add pagination)
- **Phase 9 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no cross-story deps
- **US2 (P1)**: After Phase 2 — T015 depends on T014 within story, rest parallel
- **US3 (P1)**: After Phase 2 — no cross-story deps
- **US4 (P2)**: After Phase 6 — needs main page for disconnect UI
- **US5 (P2)**: After Phase 6 — needs activity list + hook for pagination

### Parallel Execution Waves (Maximum Subagent Concurrency)

| Wave  | Phase(s)        | Parallel Tasks                                     | Count    |
| ----- | --------------- | -------------------------------------------------- | -------- |
| 1     | Phase 1         | T002, T003, T004 (after T001 `npm install`)        | 3        |
| 2     | Phase 2         | T005, T006, T007, T008                             | 4        |
| **3** | **Phase 3+4+5** | **T009, T010, T011, T012, T013, T014, T016, T017** | **8** ⚡ |
| 4     | Phase 4 tail    | T015 (depends on T014)                             | 1        |
| 5     | Phase 6         | T018                                               | 1        |
| 6a    | Phase 7+8       | T019, T021 (parallel — different files)            | 2        |
| 6b    | Phase 7+8       | T020, T022 (after 6a — update existing files)      | 2        |
| 7     | Phase 9         | T023, T024                                         | 2        |

### Parallel Example: Wave 3 (Maximum 8 Subagents)

```bash
# After Phase 2 completes, launch ALL of these simultaneously:
Task: T009 "Create useStravaConnection hook in src/hooks/useStravaConnection.js"
Task: T010 "Create OAuth callback page in src/app/runs/callback/page.jsx"
Task: T011 "Create useStravaActivities hook in src/hooks/useStravaActivities.js"
Task: T012 "Create useStravaSync hook in src/hooks/useStravaSync.js"
Task: T013 "Create RunsRouteMap component in src/components/RunsRouteMap.jsx"
Task: T014 "Create RunsActivityCard component in src/components/RunsActivityCard.jsx"
Task: T016 "Create RunsLoginGuide component in src/components/RunsLoginGuide.jsx"
Task: T017 "Create RunsConnectGuide component in src/components/RunsConnectGuide.jsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1: Setup (T001–T004)
2. Phase 2: Foundational (T005–T008)
3. Phase 3+4+5: All P1 stories in parallel (T009–T017)
4. Phase 6: Integration page (T018)
5. **STOP and VALIDATE**: Test full OAuth → sync → display flow

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Phase 3+4+5 parallel → Phase 6 integration → **MVP complete!**
3. Phase 7: Add disconnect (P2)
4. Phase 8: Add pagination (P2)
5. Phase 9: Polish + lint/type-check

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story
- All env vars must be in `.env` before testing: `NEXT_PUBLIC_STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, Firebase Admin credentials
- Strava developer app callback URL must be set to `{ORIGIN}/runs/callback`
- `firebase-admin` requires service account or Application Default Credentials
- Strava rate limits: 100 read req/15min, 1000/day — sync route must respect these
