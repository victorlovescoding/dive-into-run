# 021 Layered Dependency Architecture Handoff

> 這份文件是後續所有新 session 的唯一交接簿。任何 session 開始前先讀這份，結束前必更新這份。

## Session Protocol

1. 讀 `plan.md`、`tasks.md`、本檔。
2. 從 `tasks.md` 挑一個且只做一個尚未完成的 session task。
3. 指派 worker 與 reviewer，同步告知：
   - task goal
   - write scope
   - reviewer checklist
   - 驗證標準
4. reviewer 在施工中即時糾偏。
5. 主 agent 最後整合、審核、更新本檔、commit。

## Global Invariants

- 終態分層：`Types -> Config -> Repo -> Service -> Runtime -> UI`
- `Providers` 正式屬於 `Runtime.Provider`
- `dependency-cruiser` 首次正式接線就要 `0 violation`
- 不使用 baseline、grandfathered violations、或先排除舊檔
- `specs/**/tests` 必須拆成 `unit / integration / e2e / specs-test-utils`
- production code 不得 import `specs/**`
- `src/app/**` 最終只保留 Next entry files

## Current State

**Current Session**: S011 completed
**Next Recommended Session**: S012
**Current Branch**: `021-layered-dependency-architecture`

**What exists now**

- `src/types/weather-types.js`、`src/config/client/firebase-client.js`、`src/config/geo/{weather-geo-cache.js,taiwan-locations.js}` 已建立
- `src/lib/firestore-types.js` 已移除，UI/runtime 層若要建立 Firestore `Timestamp` 必須走 `src/lib/firebase-firestore-timestamp.js`
- 受影響的 production callers 與測試 mocks 已改用新的 `@/types/**` / `@/config/**` 路徑
- `src/config/server/{firebase-admin-app.js,strava-server-config.js}`、`src/repo/server/{firebase-auth-admin-repo.js,strava-api-repo.js,strava-server-repo.js}`、`src/runtime/server/use-cases/strava-server-use-cases.js` 已建立
- `src/app/api/strava/{callback,sync,disconnect,webhook}/route.js` 已收斂成 thin entry，僅保留 request parsing / auth guard / JSON forwarding
- `src/lib/firebase-admin.js` 已移除；原本直接依賴它的 server caller / tests 已改指向分層後入口
- `src/repo/server/firebase-profile-server-repo.js` 已建立，`users/{uid}` 的 Admin SDK 讀取責任已下沉到 repo 層
- `src/lib/firebase-profile-mapper.js` 已建立，client/server profile service 現在共用同一個 `PublicProfile` normalization
- `src/lib/firebase-profile-server.js` 已改為透過 server repo + shared mapper 組裝，不再直接碰 `adminDb`
- `src/repo/client/{firebase-events-repo,firebase-event-comments-repo,firebase-member-repo}.js`、`src/service/{event-service,event-comment-service,member-dashboard-service}.js`、`src/runtime/client/use-cases/{event-use-cases,event-comment-use-cases,member-dashboard-use-cases}.js` 已建立
- `src/lib/firebase-{events,comments,member}.js` 已收斂為 compatibility facade；混合的 Firestore/query/validation/cache orchestration 已移出 `src/lib/**`
- `src/lib/firebase-{posts,notifications,profile}.js` 也已收斂為 compatibility facade；posts/notifications/profile 的 query、transaction、batch write、notification fan-out orchestration 已下沉到 `src/repo/**`、`src/service/**`、`src/runtime/**`
- `src/service/weather-location-service.js`、`src/repo/client/weather-location-storage-repo.js`、`src/runtime/client/use-cases/weather-location-use-cases.js` 已建立；weather metadata 與 browser URL/localStorage persistence 已拆開
- `src/service/avatar-upload-service.js`、`src/repo/client/firebase-storage-repo.js`、`src/runtime/client/use-cases/avatar-upload-use-cases.js` 已建立；browser image resize/canvas 與 Firebase Storage adapter 已拆層
- `src/lib/weather-helpers.js`、`src/lib/firebase-storage-helpers.js` 已收斂為 facade-only compatibility entry
- `src/components/weather/{FavoritesBar,WeatherCard,TaiwanMap,WeatherPage}.jsx` 與 `src/app/member/page.jsx` 已改指向 runtime entry；`src/app/api/weather/route.js` 改直連 service 純函式，維持 thin entry
- `WeatherPage` 已補 `hasHydratedInitialLocationRef`，避免 mount 時先清 URL query 再做 restore，導致初始 URL state 失效
- `src/repo/client/firebase-events-repo.js` 已補 `fetchParticipantUids()`，notifications runtime 只拿 participant uid / author uid 清單做 orchestration，不再自己拼 Firestore ref
- `src/runtime/hooks/{useComments,useCommentMutations,useDashboardTab,useRunCalendar,useStravaConnection,useStravaActivities,useStravaSync}.js` 已成為 canonical hooks 實作；`src/hooks/**` 現在只保留 thin re-export facade 與 type-only alias
- `src/app/events/page.jsx` 已收斂成 pure thin entry，只保留 `Suspense + EventsPageScreen`
- `src/repo/client/taiwan-location-repo.js` 與 `src/service/taiwan-location-service.js` 已建立，events page 的縣市/行政區選項不再由 runtime 直接 import config
- `src/runtime/hooks/useEventsPageRuntime.js` 已成為 events 列表頁的 canonical runtime boundary，承接 router/searchParams/toast/pagination/create/edit/delete/join/leave orchestration
- `src/ui/events/{EventsPageScreen.jsx,EventsPageScreen.module.css}` 已建立；events 列表頁 UI 不再直接 import `@/lib/firebase-events` 或 `@/contexts/**`
- `src/app/events/[id]/eventDetailClient.jsx` 已收斂成 thin client entry，只保留 `useEventDetailRuntime + EventDetailScreen`
- `src/runtime/hooks/useEventDetailRuntime.js` 已成為活動詳情頁的 canonical runtime boundary，承接 detail fetch、participants、isJoined、body scroll lock、overlay listeners、edit/delete、join/leave、comment notification、router push、toast 與 share URL orchestration
- `src/ui/events/{EventDetailScreen.jsx,EventDetailScreen.module.css}` 已建立；活動詳情頁 UI 不再直接 import `@/lib/firebase-events`、`@/lib/firebase-notifications`、或 `@/contexts/**`
- `specs/fix/event-detail-deleted-guard/tests/integration/EventDetailClient-delete-race.test.jsx`、`specs/014-notification-system/tests/integration/{notification-triggers,notification-error}.test.jsx` 已同步 retarget 到 runtime providers + runtime use-cases
- `specs/015-comment-notifications/tests/integration/event-detail-comment-runtime.test.jsx` 已補 detail runtime comment wiring coverage，`specs/015-comment-notifications/tests/integration/event-comment-notification.test.jsx` 也已改用 `@/runtime/providers/AuthProvider`，避免只靠舊 `@/contexts/**` 路徑當證據
- `src/components/{CommentSection,DashboardTabs,RunCalendarDialog}.jsx` 與 `src/app/runs/page.jsx` 已改為直接 import `@/runtime/hooks/**`，不再把 runtime orchestration 掛在 compatibility hooks namespace
- `specs/003-strict-type-fixes/app-events-page/tests/integration/EventsPage.test.jsx` 與 `specs/009-global-toast/tests/integration/crud-toast.test.jsx` 已同步 retarget 到 `@/runtime/client/use-cases/event-use-cases` / runtime providers，避免 page-level tests 與 production import target 脫鉤
- `specs/006-strava-running-records/tests/unit/*route*.test.js` 與 `sync-token-revocation.test.js` 已改為 mock `@/runtime/server/use-cases/strava-server-use-cases`，不再直接驗 route 內部 Firestore/fetch 細節
- `specs/006-strava-running-records/tests/unit/firebase-admin-helpers.test.js`、`sync-strava-activities.test.js`、`specs/g8-server-coverage/tests/unit/firebase-admin.test.js` 已改為直接驗 split 後的 config/repo/runtime 模組
- `specs/012-public-profile/tests/unit/firebase-profile-server.test.js` 已改為 mock server repo；`specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js` 也已補 repo split coverage
- repo 尚未安裝 `dependency-cruiser`
- 目前 enforcement 仍主要靠 ESLint 的局部結構限制
- `src/lib` 其餘混層檔案仍待後續 session 繼續拆分

## Session Queue Snapshot

> completion 真相來源以 `tasks.md` checkbox 為準；本表是方便新 session 快速閱讀的鏡像摘要。

| Session | Status | Goal |
| --- | --- | --- |
| S001 | done | docs bootstrap |
| S002 | done | foundation leaf extraction + remove `firestore-types` |
| S003 | done | split `firebase-admin` + Strava server flow |
| S004 | done | split `firebase-profile-server` |
| S005 | done | repo/service extraction A |
| S006 | done | repo/service extraction B |
| S007 | done | weather/storage mixed runtime split |
| S008 | done | formalize providers |
| S009 | done | formalize runtime hooks |
| S010 | done | split `events/page.jsx` |
| S011 | done | split `eventDetailClient.jsx` |
| S012 | todo | split `PostDetailClient.jsx` |
| S013 | todo | split weather/dashboard UI-runtime mixed files |
| S014 | todo | tests four-bucket rules |
| S015 | todo | clean the 4 real test conflicts |
| S016 | todo | add dep-cruise package/config/scripts |
| S017 | todo | CI wiring + final 0-violation verification |

## Known Pitfalls

### Architecture blockers

1. `src/lib/firebase-profile-mapper.js` 目前先留在 `src/lib/**` compatibility namespace，真正把 profile mapper 納入終態 `src/service/**` 的遷移要配合後續更大範圍 profile split 一起做。
2. `WeatherPage` 雖已把 URL/localStorage persistence 收斂到 `runtime/client/use-cases/weather-location-use-cases.js`，但頁面本身仍同時承擔 fetch orchestration / favorites / map interaction，多層責任尚未完全拆乾淨。
3. `src/contexts/AuthContext.jsx`、`NotificationContext.jsx`、`ToastContext.jsx` 已收斂成 thin compatibility facades；真正 provider 實作現在在 `src/runtime/providers/**`。
4. `PostDetailClient.jsx` 與 `components/weather/WeatherPage.jsx` 仍是多層混檔；`eventDetailClient.jsx` 已在 S011 拆成 thin entry + runtime + ui。
5. `src/repo/client/firebase-auth-repo.js` 已建立，`src/lib/firebase-auth-helpers.js` 現在只是 re-export facade。
6. `server-only` 目前先靠 `src/config/server/**` / `src/repo/server/**` / `src/runtime/server/**` 路徑邊界與測試隔離維持；真正的機械 enforcement 仍待後續 dep-cruise / lint 規則接線。
7. UI integration layers 仍受 ESLint `no-restricted-imports` 保護，不能直接 import `firebase/*`；若 local state 需要 Firestore `Timestamp`，必須經由 `src/lib/firebase-*.js` helper。
8. `src/runtime/client/use-cases/notification-use-cases.js` 現在依賴 repo client primitives（`fetchParticipantUids` / `fetchDistinctPostCommentAuthors` / `fetchDistinctEventCommentAuthors`）；後續若再調整 notification flow，請維持 side effects 留在 runtime/use-case，不要把 participant / recipient lookup 再塞回 repo 寫入函式內。
9. `member-dashboard` 的 `titleCache` 仍只以 `parentId` 當 key，這是為了保留既有行為；若未來 post/event 出現相同 id，cache 仍可能互撞，這筆債要在後續 dashboard/profile 整理時一起處理。

### Test blockers

tests 不可整包排除。已知真衝突 unit 檔：

- `specs/009-global-toast/tests/unit/toast-context.test.jsx`
- `specs/010-responsive-navbar/tests/unit/isActivePath.test.js`
- `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`
- `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`

不應被當作 production-bound 覆蓋證據的測試：

- `specs/003-strict-type-fixes/lib-firebase-events/tests/integration/placeholder.test.jsx`
- `specs/014-notification-system/tests/integration/scroll-to-comment.test.jsx`

## Reviewer Checklist Template

每個 session 的 reviewer 至少檢查：

1. 實作是否真的限制在本 session 的 write scope。
2. 是否符合六層與 role 規則，而不是只做目錄搬移。
3. 是否把 `Providers` 正式當成 runtime 邊界。
4. 是否避免用 baseline / 排除 / 例外白名單掩蓋舊問題。
5. 是否把新發現的坑、決策、殘留風險記錄到本檔。
6. 是否有最小必要驗證證據。

## Session Log

### S001

- **Goal**: 建立 Session 追蹤與交接機制，讓後續新 session 可低 context 接手。
- **Write Scope**: `specs/021-layered-dependency-architecture/**`
- **Completed**: yes
- **Evidence**:
  - created `plan.md`
  - created `tasks.md`
  - created `handoff.md`
- **Pitfalls recorded**:
  - 不可把目前的 `src/lib` / `src/app` 命名直接視為層級真相
  - `dependency-cruiser` 未接線前，不可假設 resolved graph 已被驗證
  - tests bucket 規則要一起設計，不能等最後才補
- **Next Session Brief**:
  - 做 S002
  - write scope 以 `src/types/**`、`src/config/**`、受影響 import callers、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 必須完成 `src/lib/firestore-types.js` 移除與替代方案
  - reviewer 要特別盯 value/type leak 是否真的消失

### S002

- **Goal**: 建立第一批 `types/config` leaf，完成 foundation leaf extraction，並清掉 `firestore-types` 的 value leak。
- **Write Scope**:
  - `src/types/**`
  - `src/config/**`
  - 所有直接依賴 `src/lib/firestore-types.js`、`firebase-client.js`、`weather-types.js`、`weather-geo-cache.js`、`taiwan-locations.js` 的 production callers 與測試 mocks
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/config/client/firebase-client.js`
  - created `src/config/geo/weather-geo-cache.js`
  - created `src/config/geo/taiwan-locations.js`
  - created `src/types/weather-types.js`
  - created `src/lib/firebase-firestore-timestamp.js` to keep Firestore `Timestamp` creation inside allowed `src/lib/firebase-*.js` boundary
  - removed `src/lib/firebase-client.js`, `src/lib/firestore-types.js`, `src/lib/weather-types.js`, `src/lib/weather-geo-cache.js`, `src/lib/taiwan-locations.js`
  - retargeted affected `src/**` imports and `specs/**` test mocks to new `@/config/**` / `@/types/**` paths
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/003-strict-type-fixes/app-events-page/tests/integration/EventsPage.test.jsx specs/fix/event-detail-deleted-guard/tests/integration/EventDetailClient-delete-race.test.jsx specs/005-event-comments/tests/integration/CommentSection.test.jsx`
- **Pitfalls recorded**:
  - 單純把 UI 層 `Timestamp` 使用改成 direct `firebase/firestore` import 會被 ESLint structural rule 擋下；要改成 `src/lib/firebase-*.js` helper。
  - 刪除 `src/lib/firebase-client.js` 代表所有依賴它的測試 mock path 也必須同步搬到 `@/config/client/firebase-client`。
  - S002 雖然是 leaf extraction，但如果移除 compatibility path，就不能只改 production callers，測試邊界也要一起收斂。
- **Next Session Brief**:
  - 做 S003
  - write scope 以 `src/config/server/**`、`src/repo/server/**`、`src/runtime/server/use-cases/**`、`src/lib/firebase-admin.js`、Strava server callers、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - `firebase-admin.js` 必須拆掉 config / repo / use-case 混檔狀態
  - reviewer 要特別盯 `server-only` 邊界與 Strava route handler 的依賴方向

### S003

- **Goal**: 拆掉 `firebase-admin` 混檔，建立 `config/server -> repo/server -> runtime/server/use-cases` 的 Strava server flow，並把 `src/app/api/strava/**` 收斂成 thin entry。
- **Write Scope**:
  - `src/config/server/**`
  - `src/repo/server/**`
  - `src/runtime/server/use-cases/**`
  - `src/lib/firebase-admin.js`
  - `src/app/api/strava/**`
  - `src/lib/firebase-profile-server.js`
  - `specs/006-strava-running-records/tests/unit/**`
  - `specs/012-public-profile/tests/unit/firebase-profile-server.test.js`
  - `specs/g8-server-coverage/tests/unit/{firebase-admin,firebase-profile-server}.test.js`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/config/server/firebase-admin-app.js`
  - created `src/config/server/strava-server-config.js`
  - created `src/repo/server/firebase-auth-admin-repo.js`
  - created `src/repo/server/strava-api-repo.js`
  - created `src/repo/server/strava-server-repo.js`
  - created `src/runtime/server/use-cases/strava-server-use-cases.js`
  - updated `src/app/api/strava/{callback,sync,disconnect,webhook}/route.js` to thin entry files that only delegate to runtime use-cases
  - deleted `src/lib/firebase-admin.js`
  - retargeted `src/lib/firebase-profile-server.js` to `@/config/server/firebase-admin-app`
  - retargeted affected route tests to mock runtime use-cases rather than route-internal Firestore/fetch details
  - retargeted low-level Strava server tests and profile-server tests to the new config/repo/runtime entry points
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/006-strava-running-records/tests/unit/strava-callback-route.test.js specs/006-strava-running-records/tests/unit/strava-sync-route.test.js specs/006-strava-running-records/tests/unit/strava-disconnect-route.test.js specs/006-strava-running-records/tests/unit/strava-webhook-route.test.js specs/006-strava-running-records/tests/unit/sync-token-revocation.test.js specs/006-strava-running-records/tests/unit/firebase-admin-helpers.test.js specs/006-strava-running-records/tests/unit/sync-strava-activities.test.js specs/012-public-profile/tests/unit/firebase-profile-server.test.js`
- **Pitfalls recorded**:
  - 這個 repo 目前的 browser Vitest 無法直接載入 bare `server-only` import；S003 先以 `src/config/server/**` / `src/repo/server/**` / `src/runtime/server/**` 路徑邊界與 route-level mocking 維持隔離，真正的 mechanical enforcement 留待後續 dep-cruise / lint rule session。
  - thin-entry 後的 route tests 應只驗 request parsing、auth guard、use-case delegation、以及 `status/body` forwarding；Firestore batch、fetch payload、token refresh 細節要落在 runtime/repo 層測試。
  - `firebase-profile-server.js` 雖已改成直接吃 `config/server`，但 service mapper / server repo 邊界仍未拆完，下一棒 S004 需要補完整。
- **Next Session Brief**:
  - 做 S004
  - write scope 以 `src/lib/firebase-profile-server.js`、新的 `src/repo/server/**` / shared service mapper、受影響的 profile server tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
- 目標是把 `firebase-profile-server.js` 變成明確的 server repo + shared mapper，而不是停留在直接操作 `adminDb` 的 server-only adapter
- reviewer 要特別盯 profile mapper 是否與 client `firebase-profile.js` 共享 shape、以及是否只改 S004 的 write scope

### S004

- **Goal**: 把 `firebase-profile-server.js` 收斂成薄 service，建立 `repo/server -> shared mapper -> server service` 的 public profile server flow。
- **Write Scope**:
  - `src/repo/server/firebase-profile-server-repo.js`
  - `src/lib/firebase-profile-{mapper,server}.js`
  - `src/lib/firebase-profile.js`
  - `specs/012-public-profile/tests/unit/{firebase-profile,firebase-profile-server}.test.js`
  - `specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/repo/server/firebase-profile-server-repo.js`
  - created `src/lib/firebase-profile-mapper.js`
  - updated `src/lib/firebase-profile-server.js` to delegate Admin reads to the server repo and use the shared mapper
  - updated `src/lib/firebase-profile.js` to reuse the shared mapper so client/server `PublicProfile` shape stays aligned
- updated `specs/012-public-profile/tests/unit/firebase-profile-server.test.js` to mock the server repo instead of `adminDb`
- updated `specs/012-public-profile/tests/unit/firebase-profile.test.js` to pin the shared mapper behavior
- updated `specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js` to cover the split repo entry point with emulator-backed execution
- verified with `npm run type-check:changed`
- verified with `npm run lint:changed`
- verified with `npx vitest run specs/012-public-profile/tests/unit/firebase-profile.test.js specs/012-public-profile/tests/unit/firebase-profile-server.test.js`
- verified with `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js"`
- **Pitfalls recorded**:
  - `import/prefer-default-export` 會卡住只有單一 export 的 repo 檔；S004 直接改成 default export，避免留下 lint exception。
  - `firebase-profile-server` 的 unit tests 不能再把 `adminDb.collection(...).doc(...).get()` 當 service contract；repo call 與 raw payload 應在 repo 層測。
  - shared mapper 先放在 `src/lib/firebase-profile-mapper.js` compatibility namespace，避免在 S004 同步開 profile 全量 service-dir 遷移，這個 namespace debt 要留給後續 profile split session 一起收。
- **Next Session Brief**:
  - 做 S005
  - write scope 以 `src/lib/firebase-events.js`、`src/lib/firebase-comments.js`、`src/lib/firebase-member.js`、新的 `src/repo/**` / `src/service/**` / `src/runtime/**` 拆分入口、受影響測試與 `specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是拆掉 events/comments/member 的 repo vs service vs use-case 混檔責任
  - reviewer 要特別盯是否真的從 `src/lib/**` 抽出責任邊界，而不是只搬檔名

### S005

- **Goal**: 拆掉 `firebase-events.js` / `firebase-comments.js` / `firebase-member.js` 的 repo / service / runtime(use-case) 混檔責任，讓 `src/lib/**` 回到 compatibility facade。
- **Write Scope**:
  - `src/lib/firebase-{events,comments,member}.js`
  - `src/repo/client/**`
  - `src/service/**`
  - `src/runtime/client/use-cases/**`
  - `src/hooks/{useComments,useCommentMutations}.js`
  - `src/components/DashboardTabs.jsx`
  - 受影響的 events/comments/member 測試
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/repo/client/firebase-events-repo.js`
  - created `src/repo/client/firebase-event-comments-repo.js`
  - created `src/repo/client/firebase-member-repo.js`
  - created `src/service/event-service.js`
  - created `src/service/event-comment-service.js`
  - created `src/service/member-dashboard-service.js`
  - created `src/runtime/client/use-cases/event-use-cases.js`
  - created `src/runtime/client/use-cases/event-comment-use-cases.js`
  - created `src/runtime/client/use-cases/member-dashboard-use-cases.js`
  - updated `src/lib/firebase-{events,comments,member}.js` to compatibility facades that only re-export the new layered entry points
  - updated `src/hooks/{useComments,useCommentMutations}.js` and `src/components/DashboardTabs.jsx` to depend on runtime use-cases instead of the old mixed `src/lib/**` implementations
  - reviewer 明確卡住了「facade 不可再藏 query/transaction/cache logic」這條驗收線；worker 先完成 `firebase-member` 這條拆分，主 agent 再整合 events/comments 與全量驗證
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/003-strict-type-fixes/lib-firebase-events/tests/unit/firebase-events.test.js specs/004-event-edit-delete/tests/unit/firebase-events-edit-delete.test.js specs/fix/event-detail-deleted-guard/tests/unit/EVENT_NOT_FOUND_MESSAGE.test.js specs/fix/event-detail-deleted-guard/tests/integration/EventDetailClient-delete-race.test.jsx specs/005-event-comments/tests/unit/firebase-comments.test.js specs/005-event-comments/tests/integration/CommentSection.test.jsx specs/007-member-dashboard/tests/unit/firebase-member.test.js specs/007-member-dashboard/tests/integration/DashboardTabs.test.jsx`
- **Pitfalls recorded**:
  - `deleteField()` 這種 Firestore sentinel 不可在 runtime 無條件取值，否則會把既有 unit mocks 弄壞；只有真的要刪 `route` 欄位時才可建立 sentinel。
  - `normalizeEventPayload` 若改成 `const rest = { ...raw }` 這類做法，記得同步刪 `paceMinutes/paceSeconds`，否則會把 UI-only 欄位漏回 Firestore payload。
  - compatibility facade 可以保留，但 reviewer 的檢查標準要很硬：`src/lib/**` 只要還含 query/transaction/writeBatch/validation/cache orchestration，就不算完成拆層。
- **Next Session Brief**:
  - 做 S006
  - write scope 以 `src/lib/firebase-posts.js`、`src/lib/firebase-notifications.js`、`src/lib/firebase-profile.js`、新的 `src/repo/**` / `src/service/**` / `src/runtime/**` 拆分入口、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是延續 S005 的做法，把 posts/notifications/profile 的 repo vs service vs runtime 責任拆乾淨，同時注意 notification flow 的跨 aggregate orchestration 不可下沉回 repo
- reviewer 要特別盯 `firebase-notifications.js` 的通知流程是否被拆成「repo 寫入」與「runtime orchestration」，避免把 fetch participants / recipient filtering / side-effect sequencing 又塞成下一個 God file

### S006

- **Goal**: 拆 `firebase-posts.js` / `firebase-notifications.js` / `firebase-profile.js` 的 repo / service / runtime(use-case) 混檔責任，讓 `src/lib/**` 回到 compatibility facade。
- **Write Scope**:
  - `src/lib/firebase-posts.js`
  - `src/lib/firebase-notifications.js`
  - `src/lib/firebase-profile.js`
  - `src/repo/client/**`
  - `src/service/**`
  - `src/runtime/client/use-cases/**`
  - 受影響 callers / tests
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/repo/client/firebase-posts-repo.js`
  - created `src/repo/client/firebase-notifications-repo.js`
  - created `src/repo/client/firebase-profile-repo.js`
  - created `src/service/post-service.js`
  - created `src/service/notification-service.js`
  - created `src/service/profile-service.js`
  - created `src/runtime/client/use-cases/post-use-cases.js`
  - created `src/runtime/client/use-cases/notification-use-cases.js`
  - updated `src/lib/firebase-{posts,notifications,profile}.js` to compatibility facades only
  - moved notification participant / comment-author lookup into repo primitives (`fetchParticipantUids`, `fetchDistinctPostCommentAuthors`, `fetchDistinctEventCommentAuthors`); runtime only orchestrates the returned UID lists
  - preserved `PostDetailClient`, `PostPage`, `ProfileClient`, `ProfileEventList`, `BioEditor`, and `src/app/posts/[id]/page.jsx` `getPostDetail` contracts
  - restored `buildAddCommentPayload()` anonymous fallback to `匿名使用者`
  - restored `createPost()` missing `photoURL` behavior to `authorImgURL: undefined`
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/021-layered-dependency-architecture/tests/unit/post-use-cases.test.js specs/021-layered-dependency-architecture/tests/unit/notification-use-cases.test.js specs/021-layered-dependency-architecture/tests/unit/profile-service.test.js specs/mock-audit-d1-firebase-posts/tests/unit/firebase-posts-crud.test.js specs/014-notification-system/tests/unit/firebase-notifications-write.test.js specs/012-public-profile/tests/unit/firebase-profile.test.js specs/012-public-profile/tests/integration/ProfileClient.test.jsx specs/012-public-profile/tests/integration/ProfileEventList.test.jsx specs/012-public-profile/tests/integration/BioEditor.test.jsx`
- **Pitfalls recorded**:
  - notifications runtime must not import another runtime use-case; participant lookup now lives in repo primitives and tests need to mock repo layer, not `event-use-cases`.
  - `notifyPostNewComment()` stays single-document `addDoc`, while fan-out cases (`notifyEventModified`, `notifyEventCancelled`, `notifyPostCommentReply`, `notifyEventNewComment`) use batch writes.
  - `buildAddCommentPayload()` must keep the legacy `"匿名使用者"` fallback; `createPost()` must keep missing `photoURL` as `undefined` to satisfy posts mock-audit coverage.
- **Next Session Brief**:
  - 做 S007
  - write scope 以 `src/lib/weather-helpers.js`、`src/lib/firebase-storage-helpers.js`、相關 runtime/service/repo 拆分入口、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
- 目標是清掉 weather/storage 的混層問題，延續 `Types -> Config -> Repo -> Service -> Runtime -> UI`
- reviewer 要特別盯 browser runtime 與 storage repo 是否被拆開，以及是否還有混在 `src/lib/**` 的業務 orchestration

### S007

- **Goal**: 拆掉 `weather-helpers.js` 與 `firebase-storage-helpers.js` 的 runtime / service / repo 混層，讓 browser persistence、image runtime、storage adapter 回到正確層級。
- **Write Scope**:
  - `src/lib/weather-helpers.js`
  - `src/lib/firebase-storage-helpers.js`
  - 新的 `src/repo/**` / `src/service/**` / `src/runtime/**` 入口
  - 受影響的 callers / tests
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/service/weather-location-service.js`
  - created `src/repo/client/weather-location-storage-repo.js`
  - created `src/runtime/client/use-cases/weather-location-use-cases.js`
  - created `src/service/avatar-upload-service.js`
  - created `src/repo/client/firebase-storage-repo.js`
  - created `src/runtime/client/use-cases/avatar-upload-use-cases.js`
  - updated `src/lib/weather-helpers.js` and `src/lib/firebase-storage-helpers.js` to facade-only compatibility exports
  - retargeted `src/components/weather/{FavoritesBar,WeatherCard,TaiwanMap,WeatherPage}.jsx` to runtime weather entry and `src/app/member/page.jsx` to runtime avatar upload entry
  - retargeted `src/app/api/weather/route.js` to pure `@/service/weather-location-service` helpers so route stays thin
  - added `WeatherPage` initial-hydration guard to stop URL-sync effect from clearing query params before browser restore runs
  - retargeted weather/storage unit tests to the new layered modules and added browser-persistence coverage in `specs/013-pre-run-weather/tests/integration/weather-page.test.jsx`
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/013-pre-run-weather/tests/unit/weather-helpers.test.js specs/013-pre-run-weather/tests/unit/weather-api-route.test.js specs/g10-storage-helper/tests/unit/firebase-storage-helpers.test.js specs/013-pre-run-weather/tests/integration/weather-page.test.jsx`
- **Pitfalls recorded**:
  - weather 的 URL query encode/decode 雖然是純字串轉換，但 reviewer 明確把它視為 browser persistence；S007 已把這段從 pure service 移到 runtime，避免再和 forecast/icon/formatter 混在同層。
  - `WeatherPage` 原本的 effect 順序會先清 `window.location.search`，再做 URL restore；若未設 hydrate guard，初始 `?county=...` 會被自己抹掉，integration test 也抓得出來。
  - browser Vitest project 的 `localStorage` 在這個 repo 不是完整 Web Storage；integration tests 需要自建可控 storage stub，否則 `clear()` 不存在會讓測試誤炸。
- **Next Session Brief**:
  - 做 S008
  - write scope 以 `src/contexts/{AuthContext,NotificationContext}.jsx`、新的 `src/runtime/providers/**`、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是把 providers 正式收進 runtime 邊界，禁止 provider 直接碰 repo
  - reviewer 要特別盯 provider 是否只依賴 runtime/service，而不是把 repo import 換個路徑繼續保留
### S008

- **Goal**: 把 `AuthContext`、`NotificationContext`、`ToastContext` 正式遷入 `src/runtime/providers/**`，讓 provider 只依賴 runtime/service，`src/contexts/**` 僅保留 compatibility facade。
- **Write Scope**:
  - `src/contexts/{AuthContext,NotificationContext,ToastContext}.jsx`
  - `src/runtime/providers/**`
  - `src/runtime/providers/ToastProvider.d.ts`
  - `src/service/auth-service.js`
  - `src/runtime/client/use-cases/auth-use-cases.js`
  - `src/repo/client/firebase-auth-repo.js`
  - `src/lib/firebase-auth-helpers.js`
  - `src/contexts/ToastContext.d.ts`
  - 受影響的 callers / tests
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/runtime/providers/{AuthProvider,NotificationProvider,ToastProvider}.jsx` and `src/runtime/providers/index.js`
  - added type-only facades `src/runtime/providers/ToastProvider.d.ts` and `src/contexts/ToastContext.d.ts` so legacy ToastItem imports keep type-checking
  - created `src/repo/client/firebase-auth-repo.js` and converted `src/lib/firebase-auth-helpers.js` into a re-export facade
  - moved auth/profile orchestration into `src/service/auth-service.js` and `src/runtime/client/use-cases/auth-use-cases.js`
  - kept `src/contexts/{AuthContext,NotificationContext,ToastContext}.jsx` as thin re-export facades only
  - updated `src/app/layout.jsx` to keep `Auth -> Toast -> Notification` ordering while importing from `@/runtime/providers`
  - retargeted provider-focused tests to runtime providers/use-cases and fixed `notification-triggers` to wrap both `AuthContext.Provider` and `ToastProvider`
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/009-global-toast/tests/unit/toast-context.test.jsx specs/014-notification-system/tests/integration/NotificationBell.test.jsx specs/014-notification-system/tests/integration/NotificationToast.test.jsx specs/014-notification-system/tests/integration/NotificationPanel.test.jsx specs/014-notification-system/tests/integration/NotificationPagination.test.jsx specs/014-notification-system/tests/integration/NotificationPaginationStateful.test.jsx specs/014-notification-system/tests/integration/NotificationTabs.test.jsx specs/014-notification-system/tests/integration/notification-click.test.jsx specs/014-notification-system/tests/integration/notification-error.test.jsx specs/014-notification-system/tests/integration/notification-triggers.test.jsx`
- **Pitfalls recorded**:
  - auth IO must live in `src/repo/client/firebase-auth-repo.js`; leaving it in `src/service/auth-service.js` looks like a layer rename and triggers the same reviewer concern.
  - notification provider tests must mock `@/runtime/client/use-cases/notification-use-cases`; leaving them on `@/lib/firebase-notifications` will reintroduce real Firebase init.
  - `notification-triggers` needs both `AuthContext.Provider` and `ToastProvider`; without auth context the detail clients never expose the actions under test.
  - `src/contexts/**` must stay thin compatibility only; any provider logic left there would violate the runtime boundary and likely get rejected in review.
- **Next Session Brief**:
  - 做 S009
  - write scope 以 `src/runtime/hooks/**`、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是把通用 hooks 正式收進 runtime/hooks，避免 orchestration 再回流到 components/pages
  - reviewer 要特別盯 hooks 是否真的只依賴 runtime boundary，而不是把 provider orchestration 原封不動搬過去

### S009

- **Goal**: 把通用 hooks 正式收斂到 `src/runtime/hooks/**`，清掉 `src/hooks/**` 的重複實作，並讓實際 caller / tests 跟著改用 runtime hooks 作為真實入口。
- **Write Scope**:
  - `src/runtime/hooks/**`
  - `src/hooks/**`
  - `src/components/{CommentSection,DashboardTabs,RunCalendarDialog}.jsx`
  - `src/app/runs/page.jsx`
  - 受影響的 hooks / caller integration tests
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - kept `src/runtime/hooks/{useComments,useCommentMutations,useDashboardTab,useRunCalendar,useStravaConnection,useStravaActivities,useStravaSync}.js` as canonical runtime implementations
  - converted `src/hooks/{useComments,useCommentMutations,useDashboardTab,useRunCalendar,useStravaConnection,useStravaActivities,useStravaSync}.js` to thin re-export facades only
  - preserved type-only compatibility in `src/hooks/**` by aliasing runtime typedefs, so legacy `import('@/hooks/...').TypeName` references do not regress during the transition
  - retargeted `src/components/CommentSection.jsx`, `src/components/DashboardTabs.jsx`, `src/components/RunCalendarDialog.jsx`, and `src/app/runs/page.jsx` to import `@/runtime/hooks/**`
  - retargeted direct hook tests and component-level hook mocks to `@/runtime/hooks/**`, including Strava hooks, dashboard tab hook, run calendar hook, and event comment notification coverage
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/005-event-comments/tests/integration/CommentSection.test.jsx specs/007-member-dashboard/tests/integration/useDashboardTab.test.jsx specs/007-member-dashboard/tests/integration/DashboardTabs.test.jsx specs/006-strava-running-records/tests/integration/useStravaConnection.test.jsx specs/006-strava-running-records/tests/integration/useStravaActivities.test.jsx specs/006-strava-running-records/tests/integration/useStravaSync.test.jsx specs/006-strava-running-records/tests/integration/RunsPage.test.jsx specs/006-strava-running-records/tests/integration/runs-page-sync-error.test.jsx specs/008-run-calendar/tests/integration/RunCalendarDialog.test.jsx specs/015-comment-notifications/tests/integration/event-comment-notification.test.jsx`
- **Serious problems encountered and handling**:
  - session start inherited a partial untracked `src/runtime/hooks/**` tree while the tracked `src/hooks/**` files still contained full logic. This created a real dual-source-of-truth hazard: editing only one side would leave production imports, tests, and future sessions disagreeing on which hook was authoritative. The fix was to freeze `src/runtime/hooks/**` as canonical immediately, then collapse every tracked `src/hooks/**` file to facade-only instead of trying to keep two synchronized implementations.
  - once production callers moved to `@/runtime/hooks/**`, any tests that still mocked `@/hooks/**` would silently stop intercepting the code path under test. This was not theoretical; `RunsPage`, `RunCalendarDialog`, and the notification-focused `CommentSection` test all depended on hook mocks. The fix was to retarget every direct import/mock that exercised these callers, not just the direct hook tests.
  - a facade-only conversion can break JSDoc type imports such as `import('@/hooks/useDashboardTab').UseDashboardTabReturn` even if runtime behavior stays correct. To avoid an unnecessary cross-session typing regression, the facades keep type-only typedef aliases that point at the runtime modules while exporting no runtime logic of their own.
- **Pitfalls recorded**:
  - if a future session changes a component/page import from `@/hooks/**` to `@/runtime/hooks/**`, its tests must be updated in the same session; otherwise mocks will keep passing compile-time resolution but stop matching runtime behavior.
  - `src/hooks/**` is now compatibility-only. Any new state/orchestration added there would recreate the exact split-brain problem S009 just removed.
  - `src/runtime/hooks/**` entered this session as untracked copies, so future large refactors should verify `git status` before assuming all runtime boundary work is already versioned.
- **Next Session Brief**:
  - 做 S010
  - write scope 以 `src/app/events/page.jsx`、新的 runtime/ui entry points、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是把 `events/page.jsx` 拆成 thin entry + runtime + ui，同時維持 S009 建立的「page/component 直接吃 runtime 邊界，不回流 compatibility facade」原則
  - reviewer 要特別盯 page-level tests 是否跟著 production import target 同步更新，避免再出現 mock target 與真實依賴脫鉤

### S010

- **Goal**: 把 `src/app/events/page.jsx` 拆成 thin entry + runtime hook + UI screen，並同步把 page-level tests 的 mock target 收斂到 production 真實依賴。
- **Write Scope**:
  - `src/app/events/page.jsx`
  - `src/runtime/hooks/useEventsPageRuntime.js`
  - `src/ui/events/**`
  - `specs/003-strict-type-fixes/app-events-page/tests/integration/EventsPage.test.jsx`
  - `specs/009-global-toast/tests/integration/crud-toast.test.jsx`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - reduced `src/app/events/page.jsx` to pure thin entry that only renders `Suspense + EventsPageScreen`
  - created `src/repo/client/taiwan-location-repo.js` and `src/service/taiwan-location-service.js` so location options flow through `Config -> Repo -> Service -> Runtime`
  - created `src/runtime/hooks/useEventsPageRuntime.js` and moved router/searchParams/toast/pagination/membership/create/edit/delete/join/leave orchestration there
  - created `src/ui/events/{EventsPageScreen.jsx,EventsPageScreen.module.css}` so the events list page UI only consumes runtime state/handlers
  - retargeted `EventsPage.test.jsx` and `crud-toast.test.jsx` to mock `@/runtime/client/use-cases/event-use-cases`, matching the new production import target
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/003-strict-type-fixes/app-events-page/tests/integration/EventsPage.test.jsx specs/009-global-toast/tests/integration/crud-toast.test.jsx`
- **Pitfalls recorded**:
  - once `events/page.jsx` delegates through `useEventsPageRuntime`, page-level tests that still mock `@/lib/firebase-events` stop intercepting the real code path; the runtime use-case mock retarget is mandatory in the same session.
  - `useEventsPageRuntime` must keep mounted-state guards around async page-load flows; dropping the old cancellation behavior causes unmount-time state updates during initial fetch.
  - `taiwan-locations` is a config leaf, so runtime cannot import it directly. Static option data still has to travel through `repo -> service` even when there is no network IO.
  - `src/app/events/events.module.css` was left untouched in S010 because detail page still depended on it at the time; after S011 the detail page no longer imports it, but deleting the legacy file is a separate cleanup task.
  - `src/ui/events/EventsPageScreen.jsx` must stay render-only. Reintroducing router/searchParams/toast/CRUD side effects there would immediately violate S010’s boundary split.
- **Next Session Brief**:
  - 做 S012
  - write scope 以 `src/app/posts/[id]/PostDetailClient.jsx`、新的 runtime/ui entry points、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是把 post detail page 拆成 thin entry + runtime + ui，並沿用 S011 的「page-level tests/mock target 要跟 production import target 同步」原則
  - reviewer 要特別盯 post detail 的 like/comment/edit/delete/scroll-to-comment 行為是否真的下沉到 runtime，而不是只把 JSX 挪進 `src/ui/**`

### S011

- **Goal**: 把 `src/app/events/[id]/eventDetailClient.jsx` 拆成 thin client entry + runtime hook + UI screen，並確保 detail page 的 edit/delete/comment/highlight/join-leave orchestration 真正下沉到 runtime。
- **Write Scope**:
  - `src/app/events/[id]/eventDetailClient.jsx`
  - `src/runtime/hooks/useEventDetailRuntime.js`
  - `src/ui/events/{EventDetailScreen.jsx,EventDetailScreen.module.css}`
  - `specs/fix/event-detail-deleted-guard/tests/integration/EventDetailClient-delete-race.test.jsx`
  - `specs/014-notification-system/tests/integration/{notification-triggers,notification-error}.test.jsx`
  - `specs/015-comment-notifications/tests/integration/{event-detail-comment-runtime,event-comment-notification}.test.jsx`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - reduced `src/app/events/[id]/eventDetailClient.jsx` to pure thin client entry that only binds `id -> useEventDetailRuntime -> EventDetailScreen`
  - created `src/runtime/hooks/useEventDetailRuntime.js` and moved detail fetch/participants/isJoined/body scroll lock/overlay listeners/edit/delete/join/leave/comment notification/router push/toast/share URL orchestration there
  - created `src/ui/events/{EventDetailScreen.jsx,EventDetailScreen.module.css}` so detail page UI only consumes runtime state/handlers and no longer imports `useEventDetailRuntime`, runtime providers, or event/notification use-cases directly
  - kept `EventDetailClient-delete-race.test.jsx`, `notification-triggers.test.jsx`, and `notification-error.test.jsx` aligned on `@/runtime/providers/**` and `@/runtime/client/use-cases/**`, and additionally retargeted `event-comment-notification.test.jsx` from `@/contexts/AuthContext` to `@/runtime/providers/AuthProvider`
  - added `specs/015-comment-notifications/tests/integration/event-detail-comment-runtime.test.jsx` to verify `CommentSection` callback is wired through the detail runtime hook to `notifyEventNewComment`
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed` (passes with existing eslint-plugin-react settings warning)
  - verified with `npx vitest run specs/fix/event-detail-deleted-guard/tests/integration/EventDetailClient-delete-race.test.jsx specs/014-notification-system/tests/integration/notification-triggers.test.jsx specs/014-notification-system/tests/integration/notification-error.test.jsx specs/015-comment-notifications/tests/integration/event-detail-comment-runtime.test.jsx specs/015-comment-notifications/tests/integration/event-comment-notification.test.jsx`
- **Pitfalls recorded**:
  - once detail page orchestration moves into `useEventDetailRuntime`, EventDetailClient integration tests that still mock `@/lib/firebase-events` or old `@/contexts/**` paths no longer intercept the real code path; retargeting to runtime providers/use-cases must happen in the same session
  - `EventDetailScreen.jsx` must stay render-only. Re-importing `useEventDetailRuntime`, router, toast, or runtime providers there would collapse the split back into a mixed UI/runtime file even if the entry stays thin.
  - `specs/015-comment-notifications/tests/integration/event-comment-notification.test.jsx` only proves `CommentSection` emits the callback; it is not sufficient proof that the detail page runtime actually calls `notifyEventNewComment`, so a dedicated wiring test is required
  - `fetchEventById()` currently exposes the narrower service typedef while the detail runtime still needs route/meetPlace/host fields for UI orchestration; keep that cast localized inside the runtime hook for now instead of widening repo/service/use-case contracts inside S011
- **Next Session Brief**:
  - 做 S012
  - write scope 以 `src/app/posts/[id]/PostDetailClient.jsx`、新的 runtime/ui entry points、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是把 post detail page 拆成 thin entry + runtime + ui，並比照 S011 把通知/留言/scroll-to-comment 行為的測試 mock target 一起收斂到 runtime 真實依賴
  - reviewer 要特別盯 post detail 的 comment/highlight/edit/delete/like 行為是否真的下沉到 runtime，而不是只把 JSX 挪進 `src/ui/**`
