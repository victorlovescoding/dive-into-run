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

**Current Session**: S021 completed（posts thin-entry + runtime/ui/test retarget done）
**Next Recommended Session**: S022（runs thin-entry）或 S025（canonical no-import-lib rule）
**Current Branch**: `021-layered-dependency-architecture`

**What exists now**

- `src/types/weather-types.js`、`src/config/client/firebase-client.js`、`src/config/geo/{weather-geo-cache.js,taiwan-locations.js}` 已建立
- `src/lib/firestore-types.js` 已移除；canonical runtime / client-facing 層若要建立 Firestore `Timestamp`，正式路徑是 `src/config/client/firebase-timestamp.js`；`src/lib/firebase-firestore-timestamp.js` 現在只保留 legacy compatibility facade
- 受影響的 production callers 與測試 mocks 已改用新的 `@/types/**` / `@/config/**` 路徑
- `src/config/server/{firebase-admin-app.js,strava-server-config.js}`、`src/repo/server/{firebase-auth-admin-repo.js,strava-api-repo.js,strava-server-repo.js}`、`src/runtime/server/use-cases/strava-server-use-cases.js` 已建立
- `src/app/api/strava/{callback,sync,disconnect,webhook}/route.js` 已收斂成 thin entry，僅保留 request parsing / auth guard / JSON forwarding
- `src/lib/firebase-admin.js` 已移除；原本直接依賴它的 server caller / tests 已改指向分層後入口
- `src/repo/server/firebase-profile-server-repo.js` 已建立，`users/{uid}` 的 Admin SDK 讀取責任已下沉到 repo 層
- `src/service/profile-mapper.js` 已建立，client/server profile service 現在共用同一個 `PublicProfile` normalization
- `src/service/profile-server-service.js` 已建立，server profile fetch + mapping 已正式落在 canonical service 層
- `src/repo/client/weather-api-repo.js` 已建立，`/api/weather` HTTP fetch 不再留在 `src/lib/**` implementation
- `src/lib/{firebase-profile-mapper,firebase-profile-server,weather-api}.js` 已收斂為 facade-only compatibility entry
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
- `src/service/event-service.js` 已承接 `event-helpers` 拆出的 event 規則：`getRemainingSeats`、`isDeadlinePassed`、`buildUserPayload`、`buildRoutePayload`、`normalizeRoutePolylines`
- `src/lib/event-helpers.js` 現在只保留 formatting / pure utilities，migrated event 規則已退回 facade re-export，不再持有 implementation
- `src/service/notification-service.js` 已承接 `buildNotificationMessage`；`src/runtime/client/use-cases/notification-use-cases.js` 不再 runtime import `@/lib/notification-helpers`
- `src/service/strava-data-service.js` 已建立，承接 `groupActivitiesByDay` / `calcMonthSummary`；`src/runtime/hooks/useRunCalendar.js` 不再 runtime import `@/lib/strava-helpers`
- `src/lib/{notification-helpers,strava-helpers}.js` 現在只保留未遷移的 UI-facing helper 實作，加上 migrated function 的 facade re-export；沒有雙實作殘留
- `specs/008-run-calendar/tests/unit/{groupActivitiesByDay,calcMonthSummary}.test.js` 已 retarget 到 canonical `@/service/strava-data-service`，其中月份摘要測試只驗 observable label 結果，沒有為了測常數把 `RUN_TYPE_LABELS` 擴成 canonical surface
- `specs/014-notification-system/tests/unit/notification-helpers.test.js` 與 `specs/015-comment-notifications/tests/unit/notification-helpers.test.js` 已改為直接驗 canonical `@/service/notification-service` 的 `buildNotificationMessage`；留在 `@/lib/notification-helpers` 的 `formatRelativeTime` / `getNotificationLink` 仍各自留在原 surface
- 受影響的 notification unit tests (`firebase-notifications-{read,write}`、`notify-{post-comment-reply,event-new-comment}`、`fetch-distinct-comment-authors`) 已把 mock target 從 `@/lib/notification-helpers` 收斂到 `@/service/notification-service`，避免 production import path 與 test mock 脫鉤
- `src/runtime/hooks/{useEventsPageRuntime,useEventDetailRuntime}.js` 已直接 import `@/service/event-service`；`src/runtime/hooks/{useEventsPageRuntime,useEventDetailRuntime,usePostDetailRuntime,useCommentMutations}.js` 已直接 import `@/config/client/firebase-timestamp`
- `src/ui/events/{EventsPageScreen.jsx,EventsPageScreen.module.css}` 已建立；events 列表頁 UI 不再直接 import `@/lib/firebase-events` 或 `@/contexts/**`
- `src/app/events/[id]/eventDetailClient.jsx` 已收斂成 thin client entry，只保留 `useEventDetailRuntime + EventDetailScreen`
- `src/runtime/hooks/useEventDetailRuntime.js` 已成為活動詳情頁的 canonical runtime boundary，承接 detail fetch、participants、isJoined、body scroll lock、overlay listeners、edit/delete、join/leave、comment notification、router push、toast 與 share URL orchestration
- `src/ui/events/{EventDetailScreen.jsx,EventDetailScreen.module.css}` 已建立；活動詳情頁 UI 不再直接 import `@/lib/firebase-events`、`@/lib/firebase-notifications`、或 `@/contexts/**`
- `src/app/posts/[id]/PostDetailClient.jsx` 已收斂成 thin client entry，只保留 `usePostDetailRuntime + PostDetailScreen`
- `src/runtime/hooks/usePostDetailRuntime.js` 已成為文章詳情頁的 canonical runtime boundary，承接 detail load/hydration、comment infinite scroll + dedupe、scroll-to-comment/highlight、edit/update validation、delete race handling、optimistic like rollback、comment CRUD、notification fan-out、dialog/menu state、router/toast/auth interaction 與 share URL
- `src/ui/posts/{PostDetailScreen.jsx,PostDetailScreen.module.css}` 已建立；文章詳情頁 UI 不再依賴 `src/app/posts/**` 樣式，也不直接 import runtime providers、router、或 post/notification use-cases
- `src/components/weather/WeatherPage.jsx` 已收斂成 thin client entry，只保留 geo lookup wiring + `useWeatherPageRuntime + WeatherPageScreen`
- `src/runtime/hooks/useWeatherPageRuntime.js` 已成為 weather page 的 canonical runtime boundary，承接選點、fetch/abort、hydration、URL/localStorage、favorites、toast/auth orchestration
- `src/ui/weather/WeatherPageScreen.jsx` 已建立；weather page UI 只消費 runtime state/handlers，`FavoriteButton` 也已改成 dumb UI props 驅動
- `src/components/DashboardTabs.jsx` 已收斂成 thin client entry，只保留 `useDashboardTabsRuntime + DashboardTabsScreen`
- `src/runtime/hooks/useDashboardTabsRuntime.js` 已成為 dashboard tabs 的 page-level runtime boundary，承接 activeTab、keyboard nav、tab config，並在內部組合既有 `useDashboardTab`
- `src/ui/member/DashboardTabsScreen.jsx` 已建立；dashboard tab UI 不再直接 import runtime hooks 或 member-dashboard use-cases
- `src/app/posts/page.jsx` 已收斂成 thin client entry（`Suspense + usePostsPageRuntime + PostsPageScreen`）
- `src/runtime/hooks/usePostsPageRuntime.js` 已成為 posts list 的 canonical runtime boundary，承接最新貼文 hydrate、searchParams toast、IntersectionObserver 分頁、create/edit/delete、optimistic like、modal state 與 auth/toast/router orchestration
- `src/ui/posts/PostsPageScreen.jsx` 已建立；posts list UI 只消費 runtime state/handlers，不直接 import `@/lib/**`、`@/contexts/**`、`@/runtime/client/use-cases/**`、`next/navigation`
- `specs/019-posts-ui-refactor/tests/integration/PostFeed.test.jsx`、`specs/018-posts-input-validation/tests/integration/post-form-validation.test.jsx`、`specs/020-post-edit-dirty-check/tests/integration/posts-page-edit-dirty.test.jsx` 與 `specs/009-global-toast/tests/integration/crud-toast.test.jsx` 的 posts page mock surfaces 已 retarget 到 runtime providers + `@/runtime/client/use-cases/post-use-cases`
- `specs/fix/post-detail-deleted-guard/tests/integration/PostDetailClient-delete-race.test.jsx`、`specs/014-notification-system/tests/integration/{notification-triggers,notification-error}.test.jsx`、`specs/015-comment-notifications/tests/integration/post-comment-reply.test.jsx`、`specs/018-posts-input-validation/tests/integration/post-edit-validation.test.jsx`、`specs/019-posts-ui-refactor/tests/integration/PostDetail.test.jsx`、`specs/020-post-edit-dirty-check/tests/integration/post-detail-edit-dirty.test.jsx` 已同步 retarget 到 runtime providers + runtime use-cases
- `specs/fix/event-detail-deleted-guard/tests/integration/EventDetailClient-delete-race.test.jsx`、`specs/014-notification-system/tests/integration/{notification-triggers,notification-error}.test.jsx` 已同步 retarget 到 runtime providers + runtime use-cases
- `specs/015-comment-notifications/tests/integration/event-detail-comment-runtime.test.jsx` 已補 detail runtime comment wiring coverage，`specs/015-comment-notifications/tests/integration/event-comment-notification.test.jsx` 也已改用 `@/runtime/providers/AuthProvider`，避免只靠舊 `@/contexts/**` 路徑當證據
- `src/components/{CommentSection,DashboardTabs,RunCalendarDialog}.jsx` 與 `src/app/runs/page.jsx` 已改為直接 import `@/runtime/hooks/**`，不再把 runtime orchestration 掛在 compatibility hooks namespace
- `specs/003-strict-type-fixes/app-events-page/tests/integration/EventsPage.test.jsx` 與 `specs/009-global-toast/tests/integration/crud-toast.test.jsx` 已同步 retarget 到 `@/runtime/client/use-cases/event-use-cases` / runtime providers，避免 page-level tests 與 production import target 脫鉤
- `specs/006-strava-running-records/tests/unit/*route*.test.js` 與 `sync-token-revocation.test.js` 已改為 mock `@/runtime/server/use-cases/strava-server-use-cases`，不再直接驗 route 內部 Firestore/fetch 細節
- `specs/006-strava-running-records/tests/unit/firebase-admin-helpers.test.js`、`sync-strava-activities.test.js`、`specs/g8-server-coverage/tests/unit/firebase-admin.test.js` 已改為直接驗 split 後的 config/repo/runtime 模組
- `specs/012-public-profile/tests/unit/firebase-profile-server.test.js` 已改為 mock server repo；`specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js` 也已補 repo split coverage
- `specs/021-layered-dependency-architecture/test-bucket-policy.js` 已成為 S014 的唯一 canonical artifact path；`test-buckets/policy.js` 僅保留 compatibility re-export
- `specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js` 已固定驗四類契約：canonical artifact path、bucket classify、representative allow/deny、repo-wide scan
- S015 已把 `toast-context.test.jsx`、`isActivePath.test.js`、`PostCard.test.jsx`、`PostCardSkeleton.test.jsx` 全部移到對應 feature 的 `tests/integration/`
- repo-wide scan 目前固定為 `unit=0 files`、`integration=0 files`、`e2e=0 files`、`specs-test-utils=0 files`
- `dependency-cruiser` 已安裝，`package.json` 新增 `depcruise` / `depcruise:json` scripts，repo check wiring 目前集中在 `.dependency-cruiser.mjs`
- `.dependency-cruiser.mjs` 已直接 consume canonical artifact `specs/021-layered-dependency-architecture/test-bucket-policy.js`；沒有回退去讀 `test-buckets/policy.js`
- production enforcement 已落地為 canonical layer reverse-dependency 禁令、`provider-no-repo`、`src/app/**` 不得直連 `config/repo`、`server-only-no-client-import`、`production-no-specs-import`
- `src/types/not-found-messages.js` 已建立，只承接 `EVENT_NOT_FOUND_MESSAGE` / `POST_NOT_FOUND_MESSAGE` 這兩個 domain sentinel，目的是清掉 `src/repo/client/firebase-{events,posts}-repo.js` 原本對 `src/service/**` 的兩條真違規，同時保留 service 層的既有 re-export surface
- `.husky/pre-commit` 現在會在 `lint` 與 `type-check` 之後直接跑 `npm run depcruise`，讓 dependency-cruiser 正式進入本地 blocking gate
- `.github/workflows/ci.yml` 的 `ci` job 已新增 `Dependency cruiser` step，讓 required status check 直接驗證 `npm run depcruise`
- `npm run lint:changed` 目前仍會被 pre-existing untracked `.agents/skills/test-driven-development/references/boilerplate.js` 與 `.codex/hooks/block-dangerous-commands.js` 拖進 changed set；S016 本身新增/修改檔已用 scoped `npx eslint ...` 驗證為 0 error
- `src/lib` 其餘混層檔案仍待後續 session 繼續拆分

## Session Queue Snapshot

> completion 真相來源以 `tasks.md` checkbox 為準；本表是方便新 session 快速閱讀的鏡像摘要。

| Session | Status | Goal                                                  |
| ------- | ------ | ----------------------------------------------------- |
| S001    | done   | docs bootstrap                                        |
| S002    | done   | foundation leaf extraction + remove `firestore-types` |
| S003    | done   | split `firebase-admin` + Strava server flow           |
| S004    | done   | split `firebase-profile-server`                       |
| S005    | done   | repo/service extraction A                             |
| S006    | done   | repo/service extraction B                             |
| S007    | done   | weather/storage mixed runtime split                   |
| S008    | done   | formalize providers                                   |
| S009    | done   | formalize runtime hooks                               |
| S010    | done   | split `events/page.jsx`                               |
| S011    | done   | split `eventDetailClient.jsx`                         |
| S012    | done   | split `PostDetailClient.jsx`                          |
| S013    | done   | split weather/dashboard UI-runtime mixed files        |
| S014    | done   | tests four-bucket rules                               |
| S015    | done   | clean the 4 real test conflicts                       |
| S016    | done   | add dep-cruise package/config/scripts                 |
| S017    | done   | CI wiring + final 0-violation verification            |
| S018    | done   | repo-tier: strava/users/weather-favorites → repo      |
| S019    | done   | svc-tier: profile-mapper/server/weather-api → svc     |
| S020    | done   | split event-helpers: biz rules → svc, formatters stay |
| S020a   | done   | utility canonical-readiness                           |
| S021    | done   | thin-entry `posts/page.jsx`                           |
| S022    | todo   | thin-entry `runs/page.jsx` + callback                 |
| S023    | todo   | thin-entry `member/page.jsx` + ProfileClient          |
| S024    | todo   | thin-entry `api/weather/route.js` (590L)              |
| S025    | todo   | dep-cruise: canonical no-import-lib rule              |

## Known Pitfalls

### 文章對照分析結論（2026-04-23）

對照 OpenAI Codex「Harness engineering」文章的分層架構模型，S001-S017 判定為「**部分符合**」：

- ✅ 六層分層方向、forward-only dependency、dep-cruise enforcement、CI+pre-commit gate 全部到位
- ⚠️ `src/lib/**` 不在 `CANONICAL_LAYER_PATTERNS`，dep-cruise 對所有涉及 `src/lib/**` 的邊完全不攔（11 條 canonical → lib 的 runtime import 未被偵測）
- ⚠️ 6 個 thick entry 未拆（posts list 371L、runs 165L、callback 131L、member 130L、ProfileClient 147L、api/weather 590L）
- ✅ Phase 9（S018-S020a）已完成：canonical runtime/service 對 `src/lib/**` 的實際 runtime import 已歸零；接下來若要機械化封住這條規則，直接做 S025，不要再回頭把 utility 常數或 UI formatter 搬進 canonical surface

Phase 9-11（S018-S025）即為補完這三類缺口的任務。

### Architecture blockers

1. `profile-mapper` / `profile-server-service` / `weather-api-repo` 已經 canonicalize 完成；後續若整理 profile/weather 相關頁面，不能把實作再拉回 `src/lib/**` compatibility namespace。剩餘大塊是 **S023** 的 `ProfileClient` thin-entry split 與 **S024** 的 weather route/service 深拆。
2. `WeatherPage` 的 fetch/hydration/favorites 已下沉到 `useWeatherPageRuntime`，但 geo lookup 目前刻意留在 thin entry 注入，避免 runtime 直接 import `@/config/geo/weather-geo-cache`；後續若要再收斂，請沿 `Config -> Repo/Service -> Runtime` 做乾淨流向，不要把 config 直接拉回 runtime。
3. `src/contexts/AuthContext.jsx`、`NotificationContext.jsx`、`ToastContext.jsx` 已收斂成 thin compatibility facades；真正 provider 實作現在在 `src/runtime/providers/**`。
4. S013 已把 `WeatherPage.jsx`、`FavoriteButton.jsx`、`DashboardTabs.jsx` 拆成 thin entry + runtime + ui；後續 reviewer 應改盯 weather/dashboard screen 是否重新拉回 runtime/service 依賴，而不是再把它們當未拆 target。
5. `src/repo/client/firebase-auth-repo.js` 已建立，`src/lib/firebase-auth-helpers.js` 現在只是 re-export facade。
6. `server-only` 目前先靠 `src/config/server/**` / `src/repo/server/**` / `src/runtime/server/**` 路徑邊界與測試隔離維持；真正的機械 enforcement 仍待後續 dep-cruise / lint 規則接線。
7. UI integration layers 仍受 ESLint `no-restricted-imports` 保護，不能直接 import `firebase/*`；若 canonical runtime / client-facing code 需要 Firestore `Timestamp`，正式 helper 路徑是 `src/config/client/firebase-timestamp.js`，`src/lib/firebase-firestore-timestamp.js` 只剩 legacy facade。
8. `src/runtime/client/use-cases/notification-use-cases.js` 現在依賴 repo client primitives（`fetchParticipantUids` / `fetchDistinctPostCommentAuthors` / `fetchDistinctEventCommentAuthors`）；後續若再調整 notification flow，請維持 side effects 留在 runtime/use-case，不要把 participant / recipient lookup 再塞回 repo 寫入函式內。
9. `member-dashboard` 的 `titleCache` 仍只以 `parentId` 當 key，這是為了保留既有行為；若未來 post/event 出現相同 id，cache 仍可能互撞，這筆債要在後續 dashboard/profile 整理時一起處理。
10. posts list page-level tests 若還 mock `@/lib/firebase-posts` 或 legacy `@/contexts/**`，thin-entry 後就會攔不到真正 runtime 路徑；後續新增同類測試要沿用 runtime providers + `@/runtime/client/use-cases/post-use-cases`。

### Test blockers

tests 不可整包排除。S015 已把先前 4 個真衝突測試改放到正確的 integration bucket，repo-wide scan 目前四桶皆為 `0 violation`。後續若數字再次上升，代表有新違規流入或有人把 component/provider/page-level test 放回 unit bucket，必須同步更新 handoff 與 task 狀態。

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
  - created `src/lib/firebase-firestore-timestamp.js` to keep Firestore `Timestamp` creation inside the then-available allowed helper boundary（later superseded by S020 canonical path `src/config/client/firebase-timestamp.js`）
  - removed `src/lib/firebase-client.js`, `src/lib/firestore-types.js`, `src/lib/weather-types.js`, `src/lib/weather-geo-cache.js`, `src/lib/taiwan-locations.js`
  - retargeted affected `src/**` imports and `specs/**` test mocks to new `@/config/**` / `@/types/**` paths
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed`
  - verified with `npx vitest run specs/003-strict-type-fixes/app-events-page/tests/integration/EventsPage.test.jsx specs/fix/event-detail-deleted-guard/tests/integration/EventDetailClient-delete-race.test.jsx specs/005-event-comments/tests/integration/CommentSection.test.jsx`
- **Pitfalls recorded**:
  - 在 S002 當下，單純把 UI 層 `Timestamp` 使用改成 direct `firebase/firestore` import 會被 ESLint structural rule 擋下，所以先走 `src/lib/firebase-firestore-timestamp.js`；此約束在 S020 已收斂為 canonical path `src/config/client/firebase-timestamp.js` + legacy lib facade。
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

### S012

- **Goal**: 把 `src/app/posts/[id]/PostDetailClient.jsx` 拆成 thin client entry + runtime hook + UI screen，並確保文章詳情頁的 load/hydration、comment scroll/highlight、like/edit/delete/comment orchestration 真正下沉到 runtime。
- **Write Scope**:
  - `src/app/posts/[id]/PostDetailClient.jsx`
  - `src/runtime/hooks/usePostDetailRuntime.js`
  - `src/ui/posts/{PostDetailScreen.jsx,PostDetailScreen.module.css}`
  - `specs/fix/post-detail-deleted-guard/tests/integration/PostDetailClient-delete-race.test.jsx`
  - `specs/014-notification-system/tests/integration/{notification-triggers,notification-error}.test.jsx`
  - `specs/015-comment-notifications/tests/integration/post-comment-reply.test.jsx`
  - `specs/018-posts-input-validation/tests/integration/post-edit-validation.test.jsx`
  - `specs/019-posts-ui-refactor/tests/integration/PostDetail.test.jsx`
  - `specs/020-post-edit-dirty-check/tests/integration/post-detail-edit-dirty.test.jsx`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - reduced `src/app/posts/[id]/PostDetailClient.jsx` to a pure thin client entry that only binds `postId -> usePostDetailRuntime -> PostDetailScreen`
  - created `src/runtime/hooks/usePostDetailRuntime.js` and moved detail load/hydration, comment infinite scroll + dedupe, scroll-to-comment/highlight, edit/update validation, delete race handling, optimistic like rollback, comment CRUD, notification fan-out, dialog/menu state, router/toast/auth/share URL orchestration there
  - created `src/ui/posts/{PostDetailScreen.jsx,PostDetailScreen.module.css}` so post detail UI only consumes runtime state/handlers and no longer depends on `src/app/posts/postDetail.module.css` or runtime/provider/use-case modules directly
  - retargeted `PostDetail.test.jsx`, `post-detail-edit-dirty.test.jsx`, `PostDetailClient-delete-race.test.jsx`, `notification-triggers.test.jsx`, `notification-error.test.jsx`, `post-comment-reply.test.jsx`, and `post-edit-validation.test.jsx` from legacy `@/lib/firebase-posts` / `@/lib/firebase-notifications` / `@/contexts/**` imports to runtime use-cases and runtime providers
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed` (passes with existing eslint-plugin-react settings warning)
  - verified with `npx vitest run specs/fix/post-detail-deleted-guard/tests/integration/PostDetailClient-delete-race.test.jsx specs/014-notification-system/tests/integration/notification-triggers.test.jsx specs/014-notification-system/tests/integration/notification-error.test.jsx specs/015-comment-notifications/tests/integration/post-comment-reply.test.jsx specs/018-posts-input-validation/tests/integration/post-edit-validation.test.jsx specs/019-posts-ui-refactor/tests/integration/PostDetail.test.jsx specs/020-post-edit-dirty-check/tests/integration/post-detail-edit-dirty.test.jsx`
- **Pitfalls recorded**:
  - once `PostDetailClient` moves to `@/runtime/client/use-cases/post-use-cases` and runtime providers, entry-level tests that keep mocking `@/lib/firebase-posts`, `@/lib/firebase-notifications`, or `@/contexts/**` stop intercepting the real code path; production import targets and test mock targets must move in the same session
  - `PostDetailScreen.jsx` must stay render-only. Pulling router, auth, toast, notification use-cases, or app-scoped styles back into the screen would collapse the split back into a mixed UI/runtime file
  - the runtime fallback path for newly-added comments needs a Firestore `Timestamp` shape, not a plain `Date`; use `createFirestoreTimestamp()` inside runtime rather than letting UI/comment-card type assumptions leak
- **Next Session Brief**:
  - 做 S013
  - write scope 以 `src/components/weather/WeatherPage.jsx`、`src/components/DashboardTabs.jsx`、新的 runtime/ui entry points、受影響 callers/tests、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 目標是把 weather/dashboard 的 mixed-layer UI 與 orchestration 拆成 thin entry + runtime + ui，並比照 S010-S012 保持 production import targets 與 entry-level tests/mock targets 對齊
  - reviewer 要特別盯 UI screen 是否仍回頭 import `src/app/**` 樣式或 runtime/service 依賴

### S013

- **Goal**: 把 `src/components/weather/WeatherPage.jsx`、`FavoriteButton.jsx`、`DashboardTabs.jsx` 拆成 thin entry + runtime hook + UI screen，並確保 weather/dashboard 的 page-level orchestration 真正下沉到 runtime。
- **Write Scope**:
  - `src/components/weather/{WeatherPage,FavoriteButton}.jsx`
  - `src/components/DashboardTabs.jsx`
  - `src/runtime/hooks/{useWeatherPageRuntime,useDashboardTabsRuntime}.js`
  - `src/ui/weather/WeatherPageScreen.jsx`
  - `src/ui/member/DashboardTabsScreen.jsx`
  - `specs/013-pre-run-weather/tests/integration/{weather-page,township-drilldown,favorites}.test.jsx`
  - `specs/007-member-dashboard/tests/integration/DashboardTabs.test.jsx`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - reduced `src/components/weather/WeatherPage.jsx` to a thin client entry that only keeps geo lookup wiring and binds `useWeatherPageRuntime -> WeatherPageScreen`
  - created `src/runtime/hooks/useWeatherPageRuntime.js` and moved weather selection, fetch/abort, hydration, URL/localStorage sync, favorites, toast/auth orchestration there
  - created `src/ui/weather/WeatherPageScreen.jsx` so weather page UI only consumes runtime state/handlers and no longer imports auth/service modules directly
  - converted `src/components/weather/FavoriteButton.jsx` into dumb UI props，收藏 mutation / toast / auth 全部回到 weather runtime
  - reduced `src/components/DashboardTabs.jsx` to a thin client entry that only binds `useDashboardTabsRuntime -> DashboardTabsScreen`
  - created `src/runtime/hooks/useDashboardTabsRuntime.js` and moved active tab state, keyboard navigation, tab configs into the page-level runtime while composing the existing `useDashboardTab`
  - created `src/ui/member/DashboardTabsScreen.jsx` so dashboard tabs UI only consumes runtime state/handlers and card components
  - retargeted weather integration tests from legacy `@/contexts/**` mocks to `@/runtime/providers/**`, keeping production import targets and test mock targets aligned with the new runtime boundary
  - verified with `npm run type-check:changed`
  - verified with `npm run lint:changed` (passes with existing eslint-plugin-react settings warning)
  - verified with `npx vitest run specs/013-pre-run-weather/tests/integration/weather-page.test.jsx specs/013-pre-run-weather/tests/integration/township-drilldown.test.jsx specs/013-pre-run-weather/tests/integration/favorites.test.jsx specs/007-member-dashboard/tests/integration/DashboardTabs.test.jsx`
- **Pitfalls recorded**:
  - `FavoriteButton` 必須跟 `WeatherPage` 同棒處理；如果把收藏 mutation / toast / auth 留在按鈕內，weather split 只會是表面搬檔，reviewer 也不會接受
  - weather runtime 需要 county/township lookup 才能從 URL/localStorage restore 名稱，但 reviewer 明確要求 runtime 不可直接 import `@/config/geo/weather-geo-cache`；S013 的做法是把 lookup 留在 thin entry 注入 runtime
  - `DashboardTabs.test.jsx` 目前仍直接 mock `@/runtime/client/use-cases/member-dashboard-use-cases`，這是合理的，因為新的 `useDashboardTabsRuntime` 仍透過 `useDashboardTab` 組合這些 use-cases；不需要為了「有新 runtime hook」硬把 test 改去 mock hook 本身
  - `src/ui/weather/WeatherPageScreen.jsx` 與 `src/ui/member/DashboardTabsScreen.jsx` 必須保持 render-only；一旦重新拉入 auth、toast、service/use-case import，就會把 S013 拆層直接打回 mixed file
- **Next Session Brief**:
  - 做 S014
  - write scope 以 `dependency-cruiser` 的 tests bucket 規則與相關 `specs/**/tests` import policy 為主，並同步更新 `specs/021-layered-dependency-architecture/handoff.md`
  - 目標是在 tests 引入 `unit / integration / e2e / specs-test-utils` 四桶規則，開始把目前已經拆好的 runtime/ui 邊界轉成可被 dep-cruise 機械驗證的 graph
  - reviewer 要特別盯新規則是否真的反映 production/runtime/ui 的終態依賴方向，而不是靠例外白名單把舊問題蓋過去

### S014

- **Goal**: 把 tests 的 `unit / integration / e2e / specs-test-utils` 四桶規則做成可被 Vitest 驗證的 feature-local policy artifact，保留 S015 的 4 個真衝突為 violation，但不碰 `dependency-cruiser` 安裝或正式接線。
- **Write Scope**:
  - `specs/021-layered-dependency-architecture/test-bucket-policy.js`
  - `specs/021-layered-dependency-architecture/test-buckets/policy.js`
  - `specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`
  - `specs/021-layered-dependency-architecture/{plan.md,tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `specs/021-layered-dependency-architecture/test-buckets/policy.js` as the full implementation, and created `specs/021-layered-dependency-architecture/test-bucket-policy.js` as the canonical entry re-export that S016 should wire to
  - created `specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js` to validate canonical artifact path, bucket classify, representative allow/deny cases, and full-repo import graph scan
  - encoded unit allowlist as `src/lib/**`、`src/config/**`、`src/repo/**`、`src/service/**`、`src/runtime/**`、`src/app/api/**` plus external/relative, while explicitly denying `src/components/**`、`src/contexts/**`、`src/hooks/**`、`src/app/**` non-api、`src/runtime/providers/**`
  - encoded integration allowlist as `src/app/**`、`src/components/**`、`src/contexts/**`、`src/hooks/**`、`src/runtime/**`、`src/lib/**`、client-facing `src/config/{client,geo}/**`、`src/data/**`, while explicitly denying `src/repo/**`、`src/service/**`、`src/config/server/**`
  - kept `e2e` limited to external + same-feature relative imports + `specs/test-utils/e2e-helpers.js`, and kept `specs-test-utils` limited to external + internal relative imports that stay inside `specs/test-utils/**`
  - verified that the repo-wide scan currently reports exactly `unit=4 files` and `integration=0 files`、`e2e=0 files`、`specs-test-utils=0 files`; raw edge count is tracked separately by the scan helper
  - updated `plan.md`、`tasks.md`、and this handoff so path and count wording matches the actual canonical policy implementation
  - intentionally did not add `dependency-cruiser` package/config/scripts or CI wiring
- **Pitfalls recorded**:
  - S016 必須直接 wire `specs/021-layered-dependency-architecture/test-bucket-policy.js`，不要再把 `test-buckets/policy.js` 當主檔
  - repo-wide scan 現在只看真實 import graph；如果未來要把 `vi.mock(...)` 也納入政策檢查，必須另開明確規則，不可混進目前的 S014 scan contract
  - unit bucket 雖然允許 `src/runtime/**`，但不能粗暴放行 `src/runtime/providers/**`；否則 `toast-context.test.jsx` 會被錯誤洗成合法
  - S014 只能交付 rule definition + Vitest verification；一旦新增 package、scripts、dep-cruise config、或 CI wiring，就已越界到 S016/S017
- **Next Session Brief**:
  - 做 S015
  - write scope 以 4 個已知衝突測試為主：`specs/009-global-toast/tests/unit/toast-context.test.jsx`、`specs/010-responsive-navbar/tests/unit/isActivePath.test.js`、`specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`、`specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`
  - 目標是把這 4 個檔案移到正確 bucket 或改成正確測試邊界，讓 S014 policy scan 變成 `0 violation`
  - 不要在 S015 透過放寬 S014 policy 解題；應修測試本身，讓 `test-bucket-policy.test.js` 自然轉綠

### S015

- **Goal**: 清掉 S014 留下的 4 個真衝突測試，讓 tests bucket repo-wide scan 回到四桶 `0 violation`，且不靠放寬 policy、baseline、排除或白名單解題。
- **Write Scope**:
  - `specs/009-global-toast/tests/{unit,integration}/toast-context.test.jsx`
  - `specs/010-responsive-navbar/tests/{unit,integration}/isActivePath.test.js`
  - `specs/019-posts-ui-refactor/tests/{unit,integration}/{PostCard.test.jsx,PostCardSkeleton.test.jsx}`
  - `specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - moved `specs/009-global-toast/tests/unit/toast-context.test.jsx` to `specs/009-global-toast/tests/integration/toast-context.test.jsx`
  - moved `specs/010-responsive-navbar/tests/unit/isActivePath.test.js` to `specs/010-responsive-navbar/tests/integration/isActivePath.test.js`
  - moved `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx` to `specs/019-posts-ui-refactor/tests/integration/PostCard.test.jsx`
  - moved `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx` to `specs/019-posts-ui-refactor/tests/integration/PostCardSkeleton.test.jsx`
  - updated `specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js` so the repo-wide scan now asserts `0 violation` across `unit / integration / e2e / specs-test-utils`
  - verified with `npm run type-check:changed`
  - attempted `npm run lint:changed`; current failure is caused by pre-existing untracked `.codex/hooks/block-dangerous-commands.js` and `.codex/skills/test-driven-development/references/boilerplate.js`, not by the S015 patch
  - verified with `npx eslint specs/009-global-toast/tests/integration/toast-context.test.jsx specs/010-responsive-navbar/tests/integration/isActivePath.test.js specs/019-posts-ui-refactor/tests/integration/PostCard.test.jsx specs/019-posts-ui-refactor/tests/integration/PostCardSkeleton.test.jsx specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`
  - verified with `npx vitest run specs/009-global-toast/tests/integration/toast-context.test.jsx specs/010-responsive-navbar/tests/integration/isActivePath.test.js specs/019-posts-ui-refactor/tests/integration/PostCard.test.jsx specs/019-posts-ui-refactor/tests/integration/PostCardSkeleton.test.jsx specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`
  - verified with `npx vitest run specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`
- **Pitfalls recorded**:
  - reviewer 已明確否決把 `isActivePath.test.js` 改成直接打 `@/components/Navbar/nav-constants.js` 的作法，因為 resolved path 仍是 `src/components/**`，unit bucket 一樣違規；S015 因此改採「直接搬 integration」而不是偷換 import target
  - S015 的修法必須是修測試 bucket 歸位，不是修改 `test-bucket-policy.js` 規則；policy artifact 本身維持不動
  - `test-bucket-policy.test.js` 雖然屬於 S014 驗證，但 S015 完成後必須同步改成 `0 violation` 期望，否則 repo graph 已修正但契約測試仍會卡在舊基線
  - `npm run lint:changed` 在這個 worktree 目前會被未納管的 `.codex/**` 檔案拖進 changed set 而失敗；S015 驗證因此改用受影響測試檔的 scoped `npx eslint ...` 作為可重現證據，直到後續 session 清理該噪音來源
- **Next Session Brief**:
  - 做 S016
  - write scope 以 `dependency-cruiser` package / config / scripts 與對應 repo check wiring 為主，並同步更新 `specs/021-layered-dependency-architecture/handoff.md`
  - 目標是把 S014/S015 已經在 Vitest 驗證過的 tests bucket policy 正式接到 dep-cruise resolved graph enforcement
  - reviewer 要特別盯首次正式接線就必須 `0 violation`，不可引入 baseline、排除或 grandfathered 規則

### S016

- **Goal**: 加入 `dependency-cruiser` package、單一 config 與 repo scripts，直接接 canonical tests bucket artifact，並把 production 規則正式接到 resolved-graph enforcement，首次接線即 `0 violation`。
- **Write Scope**:
  - `package.json`
  - `package-lock.json`
  - `.dependency-cruiser.mjs`
  - `specs/021-layered-dependency-architecture/test-bucket-policy.js`
  - `src/types/not-found-messages.js`
  - `src/service/{event-service.js,post-service.js}`
  - `src/repo/client/{firebase-events-repo.js,firebase-posts-repo.js}`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - installed `dependency-cruiser@^17.3.10` and added `depcruise` / `depcruise:json` scripts to `package.json`
  - created `.dependency-cruiser.mjs` as the single dep-cruise config and wired it directly to `specs/021-layered-dependency-architecture/test-bucket-policy.js`
  - materialized tests bucket enforcement from the canonical artifact via `depCruiseTestBucketRules` / `TEST_BUCKET_DEPCRUISE_ARTIFACTS`, without reading `test-buckets/policy.js` directly from the dep-cruise config
  - landed production resolved-graph rules for canonical layer reverse imports, `provider-no-repo`, `src/app/**` direct `config/repo` imports, `server-only-no-client-import`, and `production-no-specs-import`
  - created `src/types/not-found-messages.js` and moved only `EVENT_NOT_FOUND_MESSAGE` / `POST_NOT_FOUND_MESSAGE` there so the two repo adapters stop importing `src/service/**`, while `src/service/{event-service,post-service}.js` keep re-exporting the same public constants
  - verified with `npm run type-check:changed`
  - attempted `npm run lint:changed`; current failure is caused by pre-existing untracked `.agents/skills/test-driven-development/references/boilerplate.js` and `.codex/hooks/block-dangerous-commands.js`, not by the S016 patch
  - verified S016-owned files with `npx eslint .dependency-cruiser.mjs specs/021-layered-dependency-architecture/test-bucket-policy.js src/types/not-found-messages.js src/service/event-service.js src/service/post-service.js src/repo/client/firebase-events-repo.js src/repo/client/firebase-posts-repo.js`
  - verified with `npx vitest run specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`
  - verified with `npm run depcruise` -> `✔ no dependency violations found (1334 modules, 3307 dependencies cruised)`
- **Pitfalls recorded**:
  - `plan.md` 的 layer matrix 寫的是 `runtime -> service | types`，但這個 branch 的 `src/runtime/*/use-cases/**` 目前是 orchestration layer，真實上會直接 import `repo + service`；S016 因此用「canonical layer 不可回頭 import 更高層」來落地六層規則，而不是硬砍 `runtime -> repo`
  - `entry-no-config-repo-direct-import` 原本想只打 thin entry file regex，但 dependency-cruiser 對該 regex 報 unsafe regular expression；S016 改採更保守且可證明的 `^src/app(?:/|$)` 禁令，不放寬規則，也不引入 partial scan
  - canonical artifact 不需要額外的 default export surface；最後保留的是 explicit import + explicit named export，讓 `.dependency-cruiser.mjs` 可以直接 consume canonical artifact，同時避免留下多餘 export
- `npm run depcruise` 目前會印出 `MODULE_TYPELESS_PACKAGE_JSON` warning，原因是 repo `package.json` 沒有 `"type": "module"`；S016 不處理這個 packaging 警告，因為它不影響 enforcement 結果，而且超出本 task write scope
- `server-only-no-client-import` 不能只靠 `src/app/*Client.*` 這種命名 matcher；repo 內已有多個 `'use client'` page entry（如 `src/app/weather/page.jsx`、`src/app/runs/page.jsx`、`src/app/member/page.jsx`），S016 最後因此把 `src/app/**` 非 API route 整體視為 client-sensitive surface，避免 app-router client entries 漏網
- **Next Session Brief**:
  - 做 S017
  - write scope 以 CI / repo checks wiring、最終全量驗證與 PR readiness 為主，避免回頭改 S016 的 policy artifact 或 dep-cruise 規則
  - 目標是把已經在本地驗證為 `0 violation` 的 dep-cruise gate 正式接到 CI / repo checks
  - reviewer 要特別盯不可把 S017 變成重新協商 baseline / exclude / grandfathered rule 的 session

### S017

- **Goal**: 把既有 `npm run depcruise` 正式接到 `ci` job 與本地 blocking gate，維持首次正式 gate 即 `0 violation`，並補齊 rollout 所需的最終全量驗證。
- **Write Scope**:
  - `.github/workflows/ci.yml`
  - `.husky/pre-commit`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - added `Dependency cruiser` step to `.github/workflows/ci.yml` `ci` job, directly running `npm run depcruise`
  - inserted `npm run depcruise` into `.husky/pre-commit`, so CI `ci` job and local pre-commit blocking gate now both run `npm run depcruise`
  - verified with `npm run type-check` -> exit 0
  - verified with `npm run lint -- --max-warnings 0` -> exit 0 (only existing React-version warning from eslint-plugin-react settings)
  - verified with `npm run spellcheck` -> `CSpell: Files checked: 307, Issues found: 0 in 0 files.`
  - verified with `npm run depcruise` -> `✔ no dependency violations found (1334 modules, 3307 dependencies cruised)`
  - verified with `npm run test:branch` -> `Test Files 4 passed (4)`, `Tests 15 passed (15)`
  - verified local hook parity with `bash .husky/pre-commit` -> `Test Files 116 passed (116)`, `Tests 1105 passed (1105)`, while the dep-cruise step still reported `0 violation`
- **Pitfalls recorded**:
  - reviewer boundary for S017 was tightened to minimal wiring only; `pre-push` was intentionally left unchanged because its existing job remains the E2E gate, and no extra repo-check script or `package.json` wiring was kept
- `MODULE_TYPELESS_PACKAGE_JSON` from Node is an existing non-blocking warning because repo `package.json` is not `"type": "module"`; S017 does not change or fix that packaging warning
- browser Vitest still prints jsdom's `Not implemented: Window's scrollTo() method` during `bash .husky/pre-commit`; this is also an existing non-blocking warning, and the hook still exits `0` with `116 passed`

### S018

- **Goal**: 把 `firebase-strava`、`firebase-users`、`firebase-weather-favorites` 從 `src/lib/**` repo-tier implementation 遷到 `src/repo/client/**`，讓原 `src/lib/*.js` 退回 facade-only，並把 S018 受影響 runtime callers / tests 對齊 actual import path 與 test-bucket policy。
- **Write Scope**:
  - `src/repo/client/{firebase-strava-repo.js,firebase-users-repo.js,firebase-weather-favorites-repo.js}`
  - `src/lib/{firebase-strava.js,firebase-users.js,firebase-weather-favorites.js}`
  - `src/runtime/hooks/{useStravaConnection.js,useStravaActivities.js,useRunCalendar.js,useWeatherPageRuntime.js}`
  - `specs/006-strava-running-records/tests/{unit/firebase-strava.test.js,unit/useStravaActivities.test.jsx,unit/useStravaConnection.test.jsx,integration/RunsActivityCard.test.jsx}`
  - `specs/mock-audit-c-firebase-users/tests/unit/firebase-users.test.js`
  - `specs/013-pre-run-weather/tests/{unit/firebase-weather-favorites.test.js,integration/weather-page.test.jsx,integration/favorites.test.jsx,integration/township-drilldown.test.jsx}`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/repo/client/firebase-strava-repo.js`
  - created `src/repo/client/firebase-users-repo.js`
  - created `src/repo/client/firebase-weather-favorites-repo.js`
  - updated `src/lib/{firebase-strava,firebase-users,firebase-weather-favorites}.js` to facade-only re-exports with no Firestore SDK imports
  - retargeted canonical runtime callers `useStravaConnection` / `useStravaActivities` / `useRunCalendar` / `useWeatherPageRuntime` to the new repo entry points
  - retargeted Strava runtime JSDoc type imports and the affected `RunsActivityCard` test type references to `@/repo/client/firebase-strava-repo`
  - retargeted unit tests `specs/006-strava-running-records/tests/unit/firebase-strava.test.js`, `specs/mock-audit-c-firebase-users/tests/unit/firebase-users.test.js`, and `specs/013-pre-run-weather/tests/unit/firebase-weather-favorites.test.js` to canonical repo paths
  - moved `specs/006-strava-running-records/tests/integration/useStravaActivities.test.jsx` and `useStravaConnection.test.jsx` into `tests/unit/` and aligned them to canonical repo mocks while removing direct `src/contexts/**` imports so unit bucket stays clean
  - kept `src/app/member/page.jsx` untouched because it is a thick entry outside S018 scope
  - page-level WeatherPage integration tests now mock `@/runtime/hooks/useWeatherPageRuntime` instead of repo/facade internals, matching the actual thin-entry import surface of `src/components/weather/WeatherPage.jsx`
  - verified with `npx vitest run specs/013-pre-run-weather/tests/integration/weather-page.test.jsx`
  - verified with `npx vitest run specs/013-pre-run-weather/tests/integration/township-drilldown.test.jsx`
  - verified with `npx vitest run specs/013-pre-run-weather/tests/integration/favorites.test.jsx`
  - verified with `npm run depcruise` -> `✔ no dependency violations found (1337 modules, 3307 dependencies cruised)`
  - verified with `npm run type-check:changed` -> `✓ No type errors in changed files.`
  - verified full suite with `firebase emulators:exec --only auth,firestore --project=demo-test "npm run test"` -> `Test Files 118 passed (118)` / `Tests 1118 passed (1118)`
- **Pitfalls recorded**:
  - `tasks.md` 原本把 `specs/013-pre-run-weather/tests/integration/favorites.test.jsx` 列成 facade mock path，但實際 import graph 已是 `WeatherPage -> useWeatherPageRuntime`；若沿用 `@/lib/firebase-weather-favorites` mock，runtime retarget 後不會攔截到真正被測 surface
  - S018 對 WeatherPage 類 page integration tests 的最終策略是 mock `@/runtime/hooks/useWeatherPageRuntime`，而不是在 integration bucket 直接 mock `@/repo/**`
  - Weather page tests 的第一個真正 root cause 不是 jsdom `scrollTo` warning，而是 runtime retarget 後若沒有攔住實際 import surface，測試會在 module-load 階段進到真 `@/config/client/firebase-client`，先撞 `auth/invalid-api-key`
  - repo 目前的 raw `npm run test` 仍會先帶到 server project；在沒有 emulator env 的情況下，會先撞既有 `Server tests require Firebase Emulator`。S018 的全量驗證因此如實採用 `firebase emulators:exec --only auth,firestore --project=demo-test "npm run test"` 作為 pass evidence，而沒有改 repo-wide script contract
  - WeatherPage runtime-hook mock tests 仍會印 jsdom 的 `Not implemented: Window's scrollTo() method` warning，但這是既有非 blocking warning，不影響 pass/fail
- **Next Session Brief**:
  - 做 S019 或 S021
  - 若做 S019，write scope 以 `firebase-profile-mapper`、`firebase-profile-server`、`weather-api` 的 service-tier 遷移與受影響 tests 為主
  - 若做 S021，write scope 以 `src/app/posts/page.jsx` 的 thin-entry split 與對應 runtime/ui/test retarget 為主
  - reviewer 要特別盯兩件事：一是不要再把 page-level integration tests退回 facade/repo mock；二是如果後續 session 需要引用「全量測試通過」，要明確說明 server project 依賴 emulator 的前提

### S019

- **Goal**: 把 `firebase-profile-mapper`、`firebase-profile-server`、`weather-api` 從 `src/lib/**` implementation 遷到 canonical service/repo 層，讓舊 `src/lib/*.js` 退回 facade-only，並把真正直連它們的 caller / unit test 對齊 canonical path。
- **Write Scope**:
  - `src/service/{profile-mapper.js,profile-server-service.js}`
  - `src/repo/client/weather-api-repo.js`
  - `src/lib/{firebase-profile-mapper.js,firebase-profile-server.js,weather-api.js}`
  - `src/service/profile-service.js`
  - `src/lib/firebase-profile.js`
  - `src/app/users/[uid]/page.jsx`
  - `src/runtime/hooks/useWeatherPageRuntime.js`
  - `src/ui/weather/WeatherPageScreen.jsx`
  - `specs/012-public-profile/tests/unit/{firebase-profile.test.js,firebase-profile-server.test.js}`
  - `specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js`
  - `specs/mock-audit-b-weather-api/tests/unit/weather-api.test.js`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/service/profile-mapper.js`
  - created `src/service/profile-server-service.js`
  - created `src/repo/client/weather-api-repo.js`
  - updated `src/lib/{firebase-profile-mapper,firebase-profile-server,weather-api}.js` to facade-only re-exports with no remaining implementation logic
  - retargeted canonical callers `src/service/profile-service.js`, `src/app/users/[uid]/page.jsx`, and `src/runtime/hooks/useWeatherPageRuntime.js` to the new canonical paths
  - simplified Weather page type imports to `@/types/weather-types`, avoiding a UI/runtime type dependency on repo or facade surfaces
  - retargeted unit tests `specs/012-public-profile/tests/unit/firebase-profile.test.js`, `specs/012-public-profile/tests/unit/firebase-profile-server.test.js`, `specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js`, and `specs/mock-audit-b-weather-api/tests/unit/weather-api.test.js` to canonical paths
  - kept `specs/013-pre-run-weather/tests/integration/{weather-page,township-drilldown}.test.jsx` on runtime-hook mocking because the actual production surface is `WeatherPage -> useWeatherPageRuntime`, not `@/lib/weather-api`
  - verified with `npm run type-check:changed` -> `✓ No type errors in changed files.`
  - verified with `npm run lint:changed` -> exit `0`; only printed the existing `eslint-plugin-react` version warning, no lint errors
  - verified with `npx vitest run specs/012-public-profile/tests/unit/firebase-profile.test.js specs/012-public-profile/tests/unit/firebase-profile-server.test.js specs/mock-audit-b-weather-api/tests/unit/weather-api.test.js` -> `Test Files 3 passed (3)` / `Tests 37 passed (37)`
  - verified with `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js"` -> `Test Files 1 passed (1)` / `Tests 6 passed (6)`; this server-env suite requires Firebase Emulator precondition
  - verified with `npm run depcruise` -> `✔ no dependency violations found (1340 modules, 3310 dependencies cruised)`
- **Pitfalls recorded**:
  - `tasks.md` 內對 weather integration tests 的 facade mock 提示已過時；S013 之後的真實 import graph 是 `WeatherPage -> @/runtime/hooks/useWeatherPageRuntime`，若硬改回 `@/lib/weather-api` mock 反而會跟 production surface 脫鉤
  - facade-only 的要求不等於把 JSDoc compatibility typedef 一起刪掉；`src/lib/*` 仍可保留 type alias，但不得再保留任何實作或實體依賴組裝
  - `src/ui/**` 與 `src/runtime/**` 若只需要 `WeatherInfo` type，應直接指向 `@/types/weather-types`，不要為了型別去綁 repo/facade path
- **Next Session Brief**:
  - 做 S020 或 S021
  - 若做 S020，write scope 以 `event-helpers` 的業務規則/service split 與受影響 runtime hook / unit test 為主
  - 若做 S021，write scope 以 `src/app/posts/page.jsx` 的 thin-entry split 與對應 runtime/ui/test retarget 為主
  - reviewer 要特別盯兩件事：一是不要把 facade-only `src/lib/**` 重新長回 implementation；二是 integration test 必須持續對齊「實際 production import surface」，不是對齊舊 task 描述

### S020

- **Goal**: 把 `event-helpers` 中的 event 業務規則遷到 canonical service 層，讓 `src/lib/event-helpers.js` 退回 formatting / pure utility + facade re-export；同時把 Firestore timestamp wrapper 遷到 `src/config/client/firebase-timestamp.js`，讓 4 個 runtime hooks 不再從 `src/lib/**` 取 timestamp helper。
- **Write Scope**:
  - `src/lib/event-helpers.js`
  - `src/service/event-service.js`
  - `src/lib/firebase-firestore-timestamp.js`
  - `src/config/client/firebase-timestamp.js`
  - `src/runtime/hooks/{useEventsPageRuntime,useEventDetailRuntime,usePostDetailRuntime,useCommentMutations}.js`
  - `specs/003-strict-type-fixes/app-events-page/tests/unit/event-helpers.test.js`
  - `specs/021-layered-dependency-architecture/tests/unit/event-service-rules.test.js`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - created `src/config/client/firebase-timestamp.js`
  - updated `src/lib/firebase-firestore-timestamp.js` to facade-only re-export
  - moved `getRemainingSeats`、`isDeadlinePassed`、`buildUserPayload`、`buildRoutePayload`、`normalizeRoutePolylines` into `src/service/event-service.js`
  - updated `src/lib/event-helpers.js` to keep only formatting / utility implementations plus facade re-exports for the migrated business rules
  - retargeted `src/runtime/hooks/useEventsPageRuntime.js` and `src/runtime/hooks/useEventDetailRuntime.js` to import migrated event rules from `@/service/event-service`
  - removed duplicated local helper implementations from `src/runtime/hooks/useEventDetailRuntime.js`, so event detail runtime no longer keeps a second copy of seats/pace/date logic
  - retargeted `src/runtime/hooks/{useEventsPageRuntime,useEventDetailRuntime,usePostDetailRuntime,useCommentMutations}.js` to `@/config/client/firebase-timestamp`
  - split `specs/003-strict-type-fixes/app-events-page/tests/unit/event-helpers.test.js` so it now only covers formatting / utility behavior
  - created `specs/021-layered-dependency-architecture/tests/unit/event-service-rules.test.js` to cover the migrated event business rules via `@/service/event-service`
  - verified with `npx vitest run specs/003-strict-type-fixes/app-events-page/tests/unit/event-helpers.test.js specs/021-layered-dependency-architecture/tests/unit/event-service-rules.test.js` -> `Test Files 2 passed (2)` / `Tests 21 passed (21)`
  - verified with `npm run type-check:changed` -> `✓ No type errors in changed files.`
  - verified with `npm run lint:changed` -> exit `0`; only printed the existing `eslint-plugin-react` version warning, no lint errors
  - verified with `npm run depcruise` -> `✔ no dependency violations found (1342 modules, 3316 dependencies cruised)`
  - verified with `npx vitest run specs/009-global-toast/tests/integration/crud-toast.test.jsx specs/014-notification-system/tests/integration/notification-triggers.test.jsx` -> `Test Files 2 passed (2)` / `Tests 21 passed (21)`
- **Pitfalls recorded**:
  - `useEventDetailRuntime.js` 原本自己複製了一份 `formatDateTime` / `formatPace` / `toNumber` / `getRemainingSeats`；如果先搬 service 再不清掉，S020 會留下第二份 event 規則邏輯，等於 facade-only 只是表面成立
  - integration bucket 不能升級 mock target 到 `@/service/**`；S020 實際驗證顯示 `crud-toast.test.jsx`、`notification-triggers.test.jsx`、`notification-error.test.jsx` 內殘留的 `@/lib/event-helpers` mock 在現況下屬於 non-blocking dead residue / cleanup debt：它們已不再攔截這次 retarget 後的真正 production path，但目前也沒有造成 fail，因此這輪不擴 scope 清理
  - `src/lib/event-helpers.js` 與 `src/lib/firebase-firestore-timestamp.js` 必須真的只剩 facade；不能為了相容保留 migrated implementation，否則 S025 無法機械化封住 canonical -> lib import
- **Next Session Brief**:
  - 做 S020a 或 S021
  - 若做 S020a，write scope 以 `notification-helpers` / `strava-helpers` 被 canonical layers runtime-import 的函式遷移為主，先把 S025 的最後前置條件補齊
  - 若做 S021，write scope 以 `src/app/posts/page.jsx` 的 thin-entry split 與對應 runtime/ui/test retarget 為主
  - reviewer 要特別盯兩件事：一是 canonical runtime 是否還有任何新的 `src/lib/**` runtime import 回流；二是 integration tests 若還保留 facade mock，必須確認那只是無害兼容，不是錯誤地以為自己攔到真正 production surface

### S020a

- **Goal**: 把 `notification-helpers` / `strava-helpers` 中被 canonical layers runtime-import 的函式遷到正確 canonical service，讓 `src/lib/**` 只剩 UI-facing helper + facade re-export，並把受影響 unit tests 全部對齊新的 production import surface。
- **Write Scope**:
  - `src/service/notification-service.js`
  - `src/service/strava-data-service.js`
  - `src/lib/{notification-helpers,strava-helpers}.js`
  - `src/runtime/client/use-cases/notification-use-cases.js`
  - `src/runtime/hooks/useRunCalendar.js`
  - `specs/008-run-calendar/tests/unit/{groupActivitiesByDay,calcMonthSummary}.test.js`
  - `specs/014-notification-system/tests/unit/{notification-helpers,firebase-notifications-write,firebase-notifications-read}.test.js`
  - `specs/015-comment-notifications/tests/unit/{notification-helpers,notify-post-comment-reply,notify-event-new-comment,fetch-distinct-comment-authors}.test.js`
  - `specs/021-layered-dependency-architecture/tests/unit/notification-use-cases.test.js`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - updated `src/service/notification-service.js` to own `buildNotificationMessage` and its message builders
  - created `src/service/strava-data-service.js` to own `groupActivitiesByDay` and `calcMonthSummary`
  - updated `src/lib/notification-helpers.js` to re-export `buildNotificationMessage` from `@/service/notification-service` while keeping `formatRelativeTime` / `getNotificationLink` in place
  - updated `src/lib/strava-helpers.js` to re-export `groupActivitiesByDay` / `calcMonthSummary` from `@/service/strava-data-service` while keeping `formatDistance` / `formatPace` / `formatDuration` / `decodePolyline` / `buildCalendarGrid` / `RUN_TYPE_LABELS` in place
  - retargeted canonical callers `src/runtime/client/use-cases/notification-use-cases.js` and `src/runtime/hooks/useRunCalendar.js` to the new service paths
  - retargeted moved-function unit tests to canonical imports: `specs/008-run-calendar/tests/unit/{groupActivitiesByDay,calcMonthSummary}.test.js`, `specs/014-notification-system/tests/unit/notification-helpers.test.js`, `specs/015-comment-notifications/tests/unit/notification-helpers.test.js`
  - kept integration tests on facade surfaces untouched; only updated unit-test mock targets that would otherwise miss the new runtime import path
  - updated affected notification unit tests to mock `@/service/notification-service` instead of `@/lib/notification-helpers`, so they still intercept the real runtime/use-case import path
  - verified with `rg -n "from '@/lib/notification-helpers'|from '@/lib/strava-helpers'" src/runtime src/service` -> no runtime import matches
  - verified with `npm run type-check:changed` -> `✓ No type errors in changed files.`
  - verified with `npm run lint:changed` -> exit `0`; only printed the existing `eslint-plugin-react` version warning, no lint errors
  - verified with `npx vitest run specs/008-run-calendar/tests/unit/groupActivitiesByDay.test.js specs/008-run-calendar/tests/unit/calcMonthSummary.test.js specs/014-notification-system/tests/unit/notification-helpers.test.js specs/014-notification-system/tests/unit/firebase-notifications-write.test.js specs/014-notification-system/tests/unit/firebase-notifications-read.test.js specs/015-comment-notifications/tests/unit/notification-helpers.test.js specs/015-comment-notifications/tests/unit/notify-post-comment-reply.test.js specs/015-comment-notifications/tests/unit/notify-event-new-comment.test.js specs/015-comment-notifications/tests/unit/fetch-distinct-comment-authors.test.js specs/021-layered-dependency-architecture/tests/unit/notification-use-cases.test.js` -> `Test Files 10 passed (10)` / `Tests 86 passed (86)`
  - verified with `npm run depcruise` -> `✔ no dependency violations found (1343 modules, 3319 dependencies cruised)`
  - verified with `firebase emulators:exec --only auth,firestore --project=demo-test "npm run test"` -> exit `1`; only failing suite was `specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js`
  - verified with `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js"` -> exit `0`; `Test Files 1 passed (1)` / `Tests 6 passed (6)`
- **Pitfalls recorded**:
  - `RUN_TYPE_LABELS` 屬於 UI-facing helper 常數，不值得為了 canonical test 把它搬進 service surface；S020a 的正確做法是讓 canonical test 只驗 `calcMonthSummary()` 的 observable label 結果
  - `src/lib/**` facade migration 之後，最容易漏的是 unit test mock target：如果 production import 已改到 `@/service/**`，test 還 mock `@/lib/**` 就會變成攔不到真正路徑的假綠或脫鉤測試
  - facade-only 的要求是「migrated function 不留第二份實作」，不是把所有同檔 helper 一起搬走；`formatRelativeTime`、`getNotificationLink`、`formatDistance`、`buildCalendarGrid` 這些 non-canonical/UI-facing helper 在本 task 應維持原位
  - emulator 下的 full-suite failure 目前呈現 aggregate fail / isolation pass：同一個 failing suite `specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js` 在獨立 emulator run 會通過，因此這看起來是 repo-level order-dependent / shared-state 問題，不在 S020a write scope；S020a 不能宣稱 repo-wide test green
- **Next Session Brief**:
  - 做 S021 或 S025
  - 若做 S021，write scope 以 `src/app/posts/page.jsx` 的 thin-entry split 與對應 runtime/ui/test retarget 為主
  - 若做 S025，直接把 canonical layer `no-import-lib` 規則機械化，先以 `rg` / dep-cruise 驗證 Phase 9 的前置條件，再補 rule 與對應測試
  - reviewer 要特別盯兩件事：一是新的禁止規則不能把 JSDoc type-only import 誤判成 runtime violation；二是不要為了 rule 漂亮把 UI-facing helper 反向搬進 canonical surface

### S021

- **Goal**: 把 `src/app/posts/page.jsx` 拆成 thin entry + `usePostsPageRuntime` + `PostsPageScreen`，並把所有直接 render posts page 的 integration tests retarget 到新的 runtime chain。
- **Write Scope**:
  - `src/app/posts/page.jsx`
  - `src/runtime/hooks/usePostsPageRuntime.js`
  - `src/ui/posts/PostsPageScreen.jsx`
  - `specs/019-posts-ui-refactor/tests/integration/PostFeed.test.jsx`
  - `specs/018-posts-input-validation/tests/integration/post-form-validation.test.jsx`
  - `specs/020-post-edit-dirty-check/tests/integration/posts-page-edit-dirty.test.jsx`
  - `specs/009-global-toast/tests/integration/crud-toast.test.jsx`
  - `specs/021-layered-dependency-architecture/{tasks.md,handoff.md}`
- **Completed**: yes
- **Evidence**:
  - updated `src/app/posts/page.jsx` to a thin client entry under 20 lines, leaving only `Suspense` + the minimal runtime-to-screen wiring
  - created `src/runtime/hooks/usePostsPageRuntime.js` to own posts fetch/hydration, searchParams toast, IntersectionObserver pagination, create/edit/delete, optimistic like, modal state, and auth/toast/router orchestration
  - created `src/ui/posts/PostsPageScreen.jsx` as render-only UI consuming runtime state/handlers; it does not import `@/lib/**`, `@/contexts/**`, `@/runtime/client/use-cases/**`, or `next/navigation`
  - retargeted page-level integration tests `PostFeed.test.jsx`, `post-form-validation.test.jsx`, `posts-page-edit-dirty.test.jsx`, and the posts section of `crud-toast.test.jsx` from legacy `@/lib/firebase-posts` / `@/contexts/**` mocks to runtime providers + `@/runtime/client/use-cases/post-use-cases`
  - `post-form-validation.test.jsx` and the posts section of `crud-toast.test.jsx` are in-scope S021 tests, not scope creep, because both directly render `@/app/posts/page` and assert page-owned behavior that moved into `usePostsPageRuntime` during the thin-entry split: form validation / submit orchestration in the former, searchParams toast handling and posts CRUD toast flow in the latter
  - verified remaining surface with `rg -n "import PostPage from '@/app/posts/page'|from '@/app/posts/page'" specs --glob 'specs/**/tests/integration/*.jsx' --glob 'specs/**/tests/integration/*.js'` -> only 4 matches (`PostFeed.test.jsx`, `post-form-validation.test.jsx`, `posts-page-edit-dirty.test.jsx`, `crud-toast.test.jsx`), and those 4 files no longer contain `@/lib/firebase-posts` or legacy `@/contexts/**` mock targets
  - verified with `npm run type-check:changed` -> `✓ No type errors in changed files.`
  - verified with `npm run lint:changed` -> exit `0`; only printed the existing `eslint-plugin-react` version warning, no lint errors
  - verified with `npm run depcruise` -> `✔ no dependency violations found (1345 modules, 3322 dependencies cruised)`
  - verified with `npx vitest run specs/019-posts-ui-refactor/tests/integration/PostFeed.test.jsx specs/018-posts-input-validation/tests/integration/post-form-validation.test.jsx specs/020-post-edit-dirty-check/tests/integration/posts-page-edit-dirty.test.jsx specs/009-global-toast/tests/integration/crud-toast.test.jsx` -> `Test Files 4 passed (4)` / `Tests 38 passed (38)`
- **Pitfalls recorded**:
  - posts list page-level tests 若繼續 mock `@/lib/firebase-posts`，在 thin-entry 後不一定會再攔到真正 runtime 路徑；S021 的正確攔截點是 runtime providers + `@/runtime/client/use-cases/post-use-cases`
  - `post-form-validation.test.jsx` / `crud-toast.test.jsx` 雖然 spec 名稱不是「posts-ui-refactor」，但只要它們 render 的 still 是 `@/app/posts/page`，就必須跟著 thin-entry session 一起 retarget；否則會留下「render 同一個 page、卻 mock 舊 surface」的假綠測試
  - `PostsPageScreen.jsx` 必須維持 render-only；一旦把 `next/navigation`、provider、或 use-case import 拉回 screen，S021 的 boundary 就會立刻失真
  - `page.jsx` 需要同時滿足 `useSearchParams` 的 Suspense 邊界與 thin-entry 約束；S021 的做法是把 `usePostsPageRuntime()` 留在 Suspense 內層的最小 wrapper，不把任何業務邏輯留在 entry
- **Next Session Brief**:
  - 做 S022 或 S025
  - 若做 S022，write scope 以 `src/app/runs/page.jsx` / `src/app/runs/callback/page.jsx` 的 thin-entry split 與對應 runtime/ui/test retarget 為主
  - 若做 S025，直接把 canonical layer `no-import-lib` 規則機械化，並優先確認不會誤傷 JSDoc type-only imports
  - reviewer 要特別盯兩件事：一是 runs/page 級整合測試不要再殘留 legacy facade mock；二是新的 no-import-lib 規則不能只做靜態樣子貨
