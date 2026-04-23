---
description: 'Session task list for 021-layered-dependency-architecture'
---

# Tasks: Layered Dependency Architecture

**Input**: `specs/021-layered-dependency-architecture/plan.md`
**Prerequisites**: `plan.md`, `handoff.md`

**Execution Rule**: 一個 session 只做一個 task。每個 task 都必須由 worker + reviewer 平行執行，session 結束前更新 `handoff.md` 並 commit。

## Format: `[ID] [Status] Description`

- `Status` 僅使用 `[ ]`、`[~]`、`[x]`
- 每個 task 完成後，由該 session 勾選並在 `handoff.md` 記錄證據與踩坑

## Phase 1: Docs Bootstrap

- [x] S001 建立 `specs/021-layered-dependency-architecture/{plan.md,tasks.md,handoff.md}`，固化六層矩陣、測試四桶、已知坑、session queue、reviewer checklist、handoff 流程。

## Phase 2: Foundation Leaf Extraction

- [x] S002 建立 `src/types/**` 與 `src/config/**` 初始結構；搬移 `weather-types`、`firebase-client`、geo cache、location data；移除 `src/lib/firestore-types.js` 並修正所有受影響 JSDoc / value imports。

## Phase 3: Server-only Split

- [x] S003 拆 `src/lib/firebase-admin.js` 成 `src/config/server/**`、`src/repo/server/**`、`src/runtime/server/use-cases/**`；同步整理 Strava route handlers 的依賴方向。
- [x] S004 將 `src/lib/firebase-profile-server.js` 改為明確的 server repo + shared service mapper，建立可驗證的 server-only 邊界。

## Phase 4: Repo / Service Extraction

- [x] S005 拆 `firebase-events.js` / `firebase-comments.js` / `firebase-member.js` 的 repo vs service vs use-case 責任。
- [x] S006 拆 `firebase-posts.js` / `firebase-notifications.js` / `firebase-profile.js` 的 repo vs service vs use-case 責任。
- [x] S007 拆 `weather-helpers.js` 與 `firebase-storage-helpers.js` 的 runtime/service/repo 混層問題。

## Phase 5: Runtime Formalization

- [x] S008 將 `AuthContext`、`NotificationContext`、`ToastContext` 正式遷入 `src/runtime/providers/**`，provider 僅依賴 runtime/service，不直接依賴 repo。
- [x] S009 將通用 hooks 正式遷入 `src/runtime/hooks/**`，收斂 runtime orchestration。

## Phase 6: UI / Entry Separation

- [x] S010 拆 `src/app/events/page.jsx` 為 thin entry + runtime + ui。
- [x] S011 拆 `src/app/events/[id]/eventDetailClient.jsx` 為 thin entry + runtime + ui。
- [x] S012 拆 `src/app/posts/[id]/PostDetailClient.jsx` 為 thin entry + runtime + ui。
- [x] S013 拆 `src/components/weather/WeatherPage.jsx` 與 `DashboardTabs.jsx`，清掉 UI/runtime/service 回流。

## Phase 7: Test Realignment

- [x] S014 建立 canonical `test-bucket-policy.js` 四桶 tests bucket policy artifact 與真實 repo import 圖譜 Vitest 驗證，供 S016 直接接線。
- [x] S015 清理目前已知 4 個真衝突測試：`toast-context.test.jsx`、`isActivePath.test.js`、`PostCard.test.jsx`、`PostCardSkeleton.test.jsx`。

## Phase 8: Enforcement Rollout

- [x] S016 加入 `dependency-cruiser` package、config、scripts，完成 ESLint / dep-cruise 分工。
- [x] S017 接線 CI / repo checks，確認首次正式 gate 即 `0 violation`，完成最終全量驗證與 PR 準備。

## Test Retarget 策略（Phase 9-11 共用規則）

> **背景**：`test-bucket-policy.js` 的 `extractModuleSpecifiers()` 會把 `vi.mock(...)` 字串也當作 module specifier 掃描（`policy.js:667-677`），因此 `vi.mock` path 同樣受 test-bucket surface allow/deny 約束。

| 動作                                                 | Unit bucket | Integration bucket |
| ---------------------------------------------------- | ----------- | ------------------ |
| import / vi.mock `src/repo/**`                       | ✅ 允許     | ❌ 禁止            |
| import / vi.mock `src/service/**`                    | ✅ 允許     | ❌ 禁止            |
| import / vi.mock `src/lib/**`                        | ✅ 允許     | ✅ 允許            |
| import / vi.mock `src/runtime/**`（excl. providers） | ✅ 允許     | ✅ 允許            |

**規則**：

1. **Unit test**（直接測模組邏輯）→ import / mock 改指向 canonical path（e.g. `@/repo/client/firebase-strava-repo`）
2. **Integration test**（測 hook/component/page，用 `vi.mock` stub 依賴）→ mock path 必須是 integration bucket 允許的 surface：
   - ✅ 可 mock `@/lib/*`（facade）、`@/runtime/hooks/*`、`@/runtime/client/use-cases/*`
   - ❌ 不可 mock `@/repo/*`、`@/service/*`
3. **衝突處理**：如果 integration test 直接測 runtime hook 且需要 mock repo/service 依賴 → **改分類為 unit test**（搬到 `tests/unit/`），因為那是在隔離測試 hook 邏輯
4. **vi.mock path 必須與被測模組的 actual import path 一致**——production code import 改了，test 的 mock 不改就攔不到

---

## Phase 9: `src/lib/**` 實作遷移

> S001-S017 已把大部分業務邏輯從 `src/lib/**` 拆到 canonical layers，但 `src/lib/` 仍有 8 個 IMPLEMENTATION 檔含真實業務邏輯（非 facade），加上 3 個 UTILITY 檔（`notification-helpers`、`strava-helpers`、`firebase-firestore-timestamp`）中有函式被 canonical layers runtime-import。dep-cruise 的 `CANONICAL_LAYER_PATTERNS` 不含 `lib`，所以這些違規完全不被攔截。Phase 9 的目標是把剩餘實作與被 canonical layers 依賴的 utility 函式搬到正確 canonical layer，讓 canonical layers 對 `src/lib/**` 的 runtime import 歸零。

- [x] S018 Repo-tier 遷移：把 `src/lib/` 中屬於 repo 層的 3 個 IMPLEMENTATION 檔遷移到 `src/repo/client/`，原檔收斂為 facade re-export。
  - `firebase-strava.js`（131L）→ `src/repo/client/firebase-strava-repo.js`：realtime listener + paginated/monthly Firestore query
  - `firebase-users.js`（102L）→ `src/repo/client/firebase-users-repo.js`：login check + user CRUD + realtime listener
  - `firebase-weather-favorites.js`（110L）→ `src/repo/client/firebase-weather-favorites-repo.js`：favorites CRUD + dedup
  - **Write Scope**: 上述 3 對（新檔 + 原檔 facade 化）、所有 canonical layer callers retarget（runtime hooks、use-cases）、受影響 tests（見下方清單）、handoff.md
  - **受影響 Tests**:
    - Unit（import 改指 canonical path）:
      - `specs/006-strava-running-records/tests/unit/firebase-strava.test.js` → `@/repo/client/firebase-strava-repo`
      - `specs/mock-audit-c-firebase-users/tests/unit/firebase-users.test.js` → `@/repo/client/firebase-users-repo`
      - `specs/013-pre-run-weather/tests/unit/firebase-weather-favorites.test.js` → `@/repo/client/firebase-weather-favorites-repo`
    - Integration → Unit **改分類**（直接測 hook + mock repo）:
      - `specs/006-strava-running-records/tests/integration/useStravaActivities.test.jsx` → 搬到 `tests/unit/`，mock 改 `@/repo/client/firebase-strava-repo`
      - `specs/006-strava-running-records/tests/integration/useStravaConnection.test.jsx` → 搬到 `tests/unit/`，mock 改 `@/repo/client/firebase-strava-repo`
    - Integration（維持 facade path，被測模組仍透過 facade import）:
      - `specs/006-strava-running-records/tests/integration/RunsPage.test.jsx` — mock `@/lib/firebase-users` ✅（page 未拆）
      - `specs/006-strava-running-records/tests/integration/runs-page-sync-error.test.jsx` — 同上 ✅
      - `specs/009-global-toast/tests/integration/crud-toast.test.jsx` — mock `@/lib/firebase-users` ✅
      - `specs/013-pre-run-weather/tests/integration/favorites.test.jsx` — 實際改為 mock `@/runtime/hooks/useWeatherPageRuntime`，因為 thin-entry `WeatherPage` 已直接吃 runtime hook
      - `specs/014-notification-system/tests/integration/notification-error.test.jsx` — mock `@/lib/firebase-users` ✅
      - `specs/014-notification-system/tests/integration/NotificationToast.test.jsx` — mock `@/lib/firebase-users` ✅
  - **驗收標準**:
    1. 三個新 repo 檔只依賴 `src/config/**`、external packages、`src/types/**`
    2. 三個原檔只剩 re-export，無 Firestore SDK import
    3. Unit tests import 指向 canonical path（不透過 facade）
    4. 需改分類的 integration tests 已搬到 `tests/unit/` 並改用 canonical mock path
    5. 維持 facade path 的 integration tests 確認 `vi.mock` 仍能正確攔截（被測模組仍透過 facade import）
    6. `npm run depcruise` 仍為 0 violation
    7. `npm run type-check:changed` 通過
    8. `npm run test` 全部通過
  - **Dependencies**: 無（可獨立開始）

- [x] S019 Service-tier 遷移：把 `src/lib/` 中屬於 service 層的 3 個 IMPLEMENTATION 檔遷移到 canonical layers，原檔收斂為 facade re-export。
  - `firebase-profile-mapper.js`（37L）→ `src/service/profile-mapper.js`：`toPublicProfile` normalization，client/server 共用
  - `firebase-profile-server.js`（36L）→ `src/service/profile-server-service.js`：server profile fetch + mapping
  - `weather-api.js`（26L）→ `src/repo/client/weather-api-repo.js`：HTTP fetch to `/api/weather`
  - **Write Scope**: 上述 3 對（新檔 + 原檔 facade 化）、`src/service/profile-service.js` 改 import `@/service/profile-mapper`、受影響 callers / tests（見下方清單）、handoff.md
  - **受影響 Tests**:
    - Unit（import 改指 canonical path）:
      - `specs/012-public-profile/tests/unit/firebase-profile.test.js` → 改指對應 canonical path
      - `specs/mock-audit-b-weather-api/tests/unit/weather-api.test.js` → `@/repo/client/weather-api-repo`
    - Integration（維持 facade path）:
      - `specs/012-public-profile/tests/integration/ProfileClient.test.jsx` — mock `@/lib/firebase-profile` ✅
      - `specs/012-public-profile/tests/integration/ProfileEventList.test.jsx` — 同上 ✅
      - `specs/012-public-profile/tests/integration/BioEditor.test.jsx` — 同上 ✅
      - `specs/013-pre-run-weather/tests/integration/weather-page.test.jsx` — 維持 mock `@/runtime/hooks/useWeatherPageRuntime`，因為這才是 `WeatherPage` 的實際 production surface ✅
      - `specs/013-pre-run-weather/tests/integration/township-drilldown.test.jsx` — 同上，維持 runtime hook mock ✅
  - **驗收標準**:
    1. `profile-mapper` 不依賴 repo/runtime/ui
    2. `profile-server-service` 只依賴 `src/repo/server/**` + `src/service/profile-mapper`
    3. `weather-api-repo` 只依賴 external packages（fetch）
    4. Unit tests import 指向 canonical path
    5. Integration tests 的 `vi.mock` path 與被測模組的 actual import 一致
    6. `npm run depcruise` 仍為 0 violation
    7. 原檔只剩 re-export
    8. `npm run test` 全部通過
  - **Dependencies**: 無（可與 S018 平行）

- [x] S020 拆分 `event-helpers.js`（280L）+ 遷移 `firebase-firestore-timestamp.js`（18L）：event 業務規則遷入 service 層，Firestore timestamp wrapper 遷入 config 層。
  - **event-helpers 拆分**:
    - 業務規則 → 併入 `src/service/event-service.js`：`getRemainingSeats()`、`isDeadlinePassed()`、`buildUserPayload()`、`buildRoutePayload()`、`normalizeRoutePolylines()`
    - 純格式化 → 留在 `src/lib/event-helpers.js`：`formatDateTime()`、`formatPace()`、`formatCommentTime()`、`formatCommentTimeFull()`、`chunkArray()`、`toNumber()`、`toMs()`、`countTotalPoints()`
    - 原檔保留所有 export（facade re-export 已遷函式 + 直接 export 未遷函式）
  - **firestore-timestamp 遷移**（必要，S025 會封住 canonical → lib import）:
    - `firebase-firestore-timestamp.js`（18L）→ `src/config/client/firebase-timestamp.js`
    - 原檔收斂為 facade re-export
    - Retarget 4 個 runtime hooks：`useEventsPageRuntime`、`useEventDetailRuntime`、`usePostDetailRuntime`、`useCommentMutations`
  - **Write Scope**: `src/lib/event-helpers.js`、`src/service/event-service.js`、`src/lib/firebase-firestore-timestamp.js` → `src/config/client/firebase-timestamp.js`、4 個 runtime hooks retarget、受影響 tests、handoff.md
  - **受影響 Tests**:
    - `specs/003-strict-type-fixes/app-events-page/tests/unit/event-helpers.test.js` — 同時測業務規則 + 格式化 → **需拆分**：
      - 業務規則測試（`getRemainingSeats`、`buildRoutePayload` 等）→ 新建 `specs/021-layered-dependency-architecture/tests/unit/event-service-rules.test.js`，import `@/service/event-service`
      - 格式化測試（`formatPace`、`toNumber` 等）→ 留在原檔，import `@/lib/event-helpers`（未遷函式仍在此）
    - Integration（維持 facade path）:
      - `specs/007-member-dashboard/tests/integration/DashboardEventCard.test.jsx` — mock `@/lib/event-helpers` ✅
      - `specs/009-global-toast/tests/integration/crud-toast.test.jsx` — mock `@/lib/event-helpers` ✅
      - `specs/014-notification-system/tests/integration/notification-triggers.test.jsx` — mock `@/lib/event-helpers` ✅
  - **驗收標準**:
    1. `src/service/event-service.js` 新增的函式不依賴 UI/runtime/repo
    2. `src/lib/event-helpers.js` 不含任何 event 業務判斷邏輯（deadline/seats/payload）
    3. `src/config/client/firebase-timestamp.js` 只依賴 `firebase/firestore`
    4. 4 個 runtime hooks 改 import `@/config/client/firebase-timestamp` + `@/service/event-service`
    5. 業務規則 unit test 獨立存在於 `specs/021-*/tests/unit/`，import canonical path
    6. `npm run depcruise` 仍為 0 violation
    7. `npm run test` 全部通過
  - **Dependencies**: S018 完成後較佳（避免同時改太多 runtime hook import）

- [x] S020a Utility canonical-readiness：把 `notification-helpers` 和 `strava-helpers` 中被 canonical layers runtime-import 的函式遷入正確 canonical layer，確保 S025 硬化規則不會產生 violation。
  - **notification-helpers.js**（107L）— canonical caller：`src/runtime/client/use-cases/notification-use-cases.js:2`
    - `buildNotificationMessage` → 併入 `src/service/notification-service.js`
    - 其餘函式（`formatRelativeTime`、`getNotificationLink`、typedefs）留在 `src/lib/notification-helpers.js`（僅被 `src/components/**` 使用，non-canonical surface）
    - 原檔保留所有 export（facade re-export `buildNotificationMessage` + 直接 export 未遷函式）
    - Retarget `notification-use-cases.js` import → `@/service/notification-service`
  - **strava-helpers.js**（175L）— canonical caller：`src/runtime/hooks/useRunCalendar.js:6`
    - `groupActivitiesByDay` + `calcMonthSummary` → 新建 `src/service/strava-data-service.js`
    - 其餘函式（`formatDistance`、`formatPace`、`formatDuration`、`decodePolyline`、`buildCalendarGrid`）留在 `src/lib/strava-helpers.js`（僅被 `src/components/**` 使用）
    - 原檔保留所有 export（facade re-export 遷移函式 + 直接 export 未遷函式）
    - Retarget `useRunCalendar.js` import → `@/service/strava-data-service`
  - **Write Scope**: 上述函式遷移 + 原檔調整、2 個 canonical callers retarget、受影響 tests、handoff.md
  - **受影響 Tests**:
    - Unit（改指 canonical path）:
      - `specs/008-run-calendar/tests/unit/groupActivitiesByDay.test.js` → `@/service/strava-data-service`
      - `specs/008-run-calendar/tests/unit/calcMonthSummary.test.js` → `@/service/strava-data-service`
    - Unit（需拆分或 retarget）:
      - `specs/015-comment-notifications/tests/unit/notification-helpers.test.js` — 若有測 `buildNotificationMessage` → 該斷言改 import `@/service/notification-service`
      - `specs/014-notification-system/tests/unit/notification-helpers.test.js` — 同上
    - Unit（維持 lib path，函式未遷移）:
      - `specs/006-strava-running-records/tests/unit/strava-helpers.test.js` — 測 `formatDistance` 等，維持 ✅
      - `specs/008-run-calendar/tests/unit/buildCalendarGrid.test.js` — 維持 ✅
    - Integration（維持 facade path）:
      - 所有 `vi.mock('@/lib/notification-helpers')` 的 integration tests → 維持 ✅（被測 component 仍透過 facade import）
      - 所有 `vi.mock('@/lib/strava-helpers')` 的 integration tests → 維持 ✅
  - **驗收標準**:
    1. `src/runtime/**` 和 `src/service/**` 不再有 `from '@/lib/notification-helpers'` 或 `from '@/lib/strava-helpers'` 的 runtime import
    2. 遷移的函式在新位置有對應 unit test（canonical path import）
    3. `src/lib/notification-helpers.js` 和 `src/lib/strava-helpers.js` 保留未遷函式 + facade re-export 遷移函式
    4. `npm run depcruise` 仍為 0 violation
    5. `npm run test` 全部通過
  - **Verification note**: 此 task 的 session evidence已達成 targeted verification 綠、canonical import 清零、`depcruise` 綠；但 emulator 下全量 `npm run test` 目前被既有 repo-level aggregate/isolation 問題阻擋，唯一 failing suite 是 `specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js`，其 isolation run 會通過，因此 `[x]` 不代表 repo-wide full test green。
  - **Dependencies**: 無（可與 S018-S020 平行）；必須在 S025 之前完成

## Phase 10: 剩餘 Thick Entry 拆分

> S010-S013 已把 events list、event detail、post detail、weather、dashboard 拆成 thin entry + runtime + ui。但仍有 6 個 thick entry 未拆：posts list（371L）、runs（165L）、runs callback（131L）、member（130L）、ProfileClient（147L）、api/weather route（590L）。Phase 10 沿用同樣模式拆分。
>
> **Test 策略**：thin-entry split 後，integration test 應 mock runtime hook（`@/runtime/hooks/*` 是 integration bucket 允許的 surface），不再直接 mock `@/lib/*` facade 的 repo/service 函式。如果既有 integration test 直接 render thick page + mock `@/lib/*`，拆分後需改為 render Screen + mock runtime hook，或改分類為 unit test。

- [x] S021 Thin-entry `src/app/posts/page.jsx`（371L）：拆成 thin entry + runtime hook + UI screen。
  - 新建 `src/runtime/hooks/usePostsPageRuntime.js`：承接 posts fetch/pagination（IntersectionObserver）/CRUD/optimistic like/edit/search params/toast orchestration
  - 新建 `src/ui/posts/PostsPageScreen.jsx`：render-only，消費 runtime state/handlers
  - `src/app/posts/page.jsx` → thin entry（Suspense + PostsPageScreen）
  - **Write Scope**: `src/app/posts/page.jsx`、新建 runtime/ui 檔、受影響 tests retarget、handoff.md
  - **受影響 Tests**:
    - `specs/019-posts-ui-refactor/tests/integration/PostFeed.test.jsx`、`specs/018-posts-input-validation/tests/integration/post-form-validation.test.jsx`、`specs/020-post-edit-dirty-check/tests/integration/posts-page-edit-dirty.test.jsx`、`specs/009-global-toast/tests/integration/crud-toast.test.jsx` — legacy `@/lib/firebase-posts` / `@/contexts/**` mocks 已 retarget 到 runtime providers + `@/runtime/client/use-cases/post-use-cases`
    - `specs/019-posts-ui-refactor/tests/integration/PostCard.test.jsx` — mock `@/lib/notification-helpers` → component 層級不變，維持 ✅
  - **驗收標準**:
    1. `src/app/posts/page.jsx` ≤ 20 行，只有 Suspense + Screen
    2. `PostsPageScreen.jsx` 不 import `@/lib/**`、`@/contexts/**`、`@/runtime/client/use-cases/**`
    3. 所有業務邏輯（IntersectionObserver、optimistic like、CRUD handlers）在 runtime hook
    4. `npm run depcruise` 仍為 0 violation
    5. `npm run test` 全部通過（含受影響 integration tests）
  - **Dependencies**: 無（可獨立開始）

- [x] S022 Thin-entry `src/app/runs/page.jsx`（165L）+ `runs/callback/page.jsx`（131L）：拆成 thin entry + runtime + ui。
  - `runs/page.jsx`：新建 `src/runtime/hooks/useRunsPageRuntime.js`（sync/disconnect/auto-refresh/auth-state）+ `src/ui/runs/RunsPageScreen.jsx`
  - `runs/callback/page.jsx`：新建 `src/runtime/hooks/useStravaCallbackRuntime.js`（OAuth code exchange/error handling）+ `src/ui/runs/StravaCallbackScreen.jsx`
  - **Write Scope**: 兩個 page entry、4 個新建 runtime/ui 檔、受影響 tests、handoff.md
  - **受影響 Tests**:
    - `specs/006-strava-running-records/tests/integration/RunsPage.test.jsx` — 目前 mock `@/lib/firebase-strava` + `@/lib/firebase-users` → 拆分後改為 mock `@/runtime/hooks/useRunsPageRuntime`
    - `specs/006-strava-running-records/tests/integration/runs-page-sync-error.test.jsx` — 同上
  - **驗收標準**:
    1. 兩個 page entry 各 ≤ 20 行
    2. Screen 不 import `@/contexts/**`、不含 fetch/async 邏輯
    3. Runtime hooks import canonical paths（`@/repo/client/*`），不透過 `@/lib/` facade
    4. `npm run depcruise` 仍為 0 violation
    5. `npm run test` 全部通過
  - **Dependencies**: S018 完成後較佳（runtime hooks 需 import `@/repo/client/firebase-strava-repo` + `firebase-users-repo`）

- [x] S023 Thin-entry `src/app/member/page.jsx`（130L）+ `src/app/users/[uid]/ProfileClient.jsx`（147L）：拆成 thin entry + runtime + ui。
  - `member/page.jsx`：新建 `src/runtime/hooks/useMemberPageRuntime.js`（avatar upload/name update/auth）+ `src/ui/member/MemberPageScreen.jsx`
  - `ProfileClient.jsx`：新建 `src/runtime/hooks/useProfileRuntime.js`（stats fetch/profile data/own-profile check）+ `src/ui/users/ProfileScreen.jsx`
  - **Write Scope**: 兩個 entry、4 個新建 runtime/ui 檔、受影響 tests、handoff.md
  - **受影響 Tests**:
    - `specs/012-public-profile/tests/integration/ProfileClient.test.jsx` — 拆分後改為 mock `@/runtime/hooks/useProfileRuntime` + render thin entry `ProfileClient`
    - `specs/012-public-profile/tests/integration/BioEditor.test.jsx` — 評估是否需改 mock target
  - **驗收標準**:
    1. 兩個 entry 各 ≤ 20 行
    2. Screen 不 import service/repo/contexts
    3. Runtime hooks import canonical paths，不透過 `@/lib/` facade
    4. `npm run depcruise` 仍為 0 violation
    5. `npm run test` 全部通過
  - **Dependencies**: S018 + S019 完成後較佳（`firebase-users-repo` 在 S018、`profile-mapper` 在 S019）

- [x] S024 Thin-entry `src/app/api/weather/route.js`（590L）：業務邏輯下沉到 service 層，route 只保留 request parsing + response forwarding。
  - 新建 `src/service/weather-forecast-service.js`：CWA/EPA API fetch chain、UV/AQI extraction、county/township normalization、response 組裝
  - 可能需要 `src/repo/server/weather-api-repo.js`：封裝 CWA/EPA 原始 HTTP 呼叫
  - `route.js` → thin route
  - 介面契約以 `getWeatherForecast()` / `getWeatherForecastErrorStatus()` 為唯一準則；route、service、tests 必須同步對齊，不能各自漂移命名
  - **Write Scope**: `src/app/api/weather/route.js`、新建 service/repo 檔、受影響 tests、handoff.md
  - **受影響 Tests**:
    - `specs/013-pre-run-weather/tests/unit/weather-api-route.test.js` — 改為 mock `@/service/weather-forecast-service`，只驗 route contract / status / body / cache header
    - 新建 `specs/021-layered-dependency-architecture/tests/unit/weather-forecast-service.test.js`：service 層可獨立 unit test（不需 NextRequest mock）
  - **驗收標準**:
    1. `route.js` ≤ 30 行，只有 request → service → NextResponse
    2. Service 函式可獨立 unit test（不需 NextRequest mock）
    3. CWA/EPA API key 從 env 讀取的邏輯在 config 或 service，不在 route
    4. 缺少 API key 時要在組 upstream URL 前 fail-fast，不能送出空 key / undefined query
    5. mandatory upstream rejection 與 normalization throw 都要被 service 包成 public error contract
    6. `npm run depcruise` 仍為 0 violation
    7. `npm run test` 全部通過
  - **Dependencies**: S019（weather-api.js 已遷）

## Phase 11: Enforcement 收斂

> Phase 9 完成後（含 S020a），canonical layers 對 `src/lib/**` 的 runtime import 應已歸零。`src/lib/` 只剩 facade re-exports + non-canonical-only utilities（僅被 `src/app/**`、`src/components/**` 等使用的格式化函式）。Phase 11 用 dep-cruise 規則機械化封住 canonical layers → `src/lib/**` 的 runtime import。

- [x] S025 dep-cruise 規則硬化：canonical layers 禁止 runtime-import `src/lib/**`。
  - `.dependency-cruiser.mjs` 新增 forbidden rule：`src/{types,config,repo,service,runtime,ui}/**` 不可 runtime-import `src/lib/**`
  - 清理殘留的 canonical → `src/lib/**` JSDoc type-only 指向（改指向 `src/types/**`、`src/service/**`、`src/repo/**`）
  - **Pre-flight check**（開始前必須驗證）:
    ```bash
    grep -rn "from '@/lib/" src/{types,config,repo,service,runtime,ui}/ --include="*.js" --include="*.jsx"
    ```
    session pre-flight 實測只有兩條真實 value import：
    - `src/runtime/hooks/useEventsPageRuntime.js` → `@/lib/event-helpers`
    - `src/runtime/hooks/useEventDetailRuntime.js` → `@/lib/event-helpers`
      其餘命中皆為 canonical JSDoc type-only imports。
  - **Write Scope**: `.dependency-cruiser.mjs`、最小 canonical source retarget、殘留 JSDoc import retarget、S025 專屬 Vitest、`tasks.md`、`handoff.md`
  - **本 session 刻意加嚴的 repo contract**:
    - mechanical rule 只禁止 canonical runtime edges 指向 `src/lib/**`
    - 但本 session 也把 canonical JSDoc/type-only imports 一併 retarget，讓 canonical layers 額外收斂成 `0 textual @/lib/ refs`
  - **驗收標準**:
    1. 新規則下 `npm run depcruise` 仍為 0 violation
    2. Type-only imports（JSDoc）已同步遷移，不保留 canonical `@/lib/**` textual refs
    3. FACADE 與 UTILITY 仍可被 non-canonical surfaces（`src/app/**`、`src/components/**`、`src/contexts/**`、`src/hooks/**`）import — 必須保留證據確認未誤擋
    4. `npm run type-check:changed` 通過
    5. `npm run lint:changed` 通過；若被 changed-set 噪音污染，需改用 scoped eslint 並在 handoff 明講
    6. `npx vitest run specs/021-layered-dependency-architecture/tests/unit/canonical-no-import-lib.test.js` 通過
    7. test-bucket-policy 不需更新（tests 在 `specs/` 不受 canonical layer 規則約束，`src-lib` surface 對 unit/integration bucket 仍為允許）
    8. **Facade 定位聲明**：`src/lib/` 的 facade 和 utility 為**永久相容層**（permanent compatibility layer），供 non-canonical surfaces 和 `specs/` tests 使用，不計畫移除
  - **Dependencies**: S018 + S019 + S020 + S020a 全部完成

## Phase 12: Harness Engineering Hardening

> 對照 OpenAI「Harness engineering: leveraging Codex in an agent-first world」文章，S001-S025 已達「高度符合」。Phase 12 針對文章明確要求但 codebase 尚未落實的三個面向做 hardening：(A) remediation error messages、(B) server-only 漏標封堵、(C) provider cross-cutting 隔離。另追加 (D) 最後一個 thick-ish entry 的 scope debt 清理。
>
> 所有 tasks 可獨立實施、互不依賴。

- [ ] S026 dep-cruise comment 加入 remediation 指引：把每條 forbidden rule 的 `comment` 從描述性改為 agent-actionable remediation 指引。
  - **文章依據**: _"we write the error messages to inject remediation instructions into agent context"_
  - **要改的檔案**: `.dependency-cruiser.mjs`
  - **做法**: 每條 rule 的 `comment` 改為結構化 remediation 格式：violation 描述 + 修復步驟 + 具體範例。涵蓋：
    - 5 條 layer direction rules（`createLayerDirectionRules()` 的 comment template）
    - `canonical-no-import-lib`
    - `provider-no-repo`
    - `entry-no-config-repo-direct-import`
    - `server-only-no-client-import`
    - `production-no-specs-import`
    - test bucket rules（`createTestBucketRules()` 的 comment template）
  - **範例 — layer direction**:
    ```
    現在: "config may not depend on canonical layers above it in the forward-only architecture."
    改成: "config layer imports a higher layer (repo/service/runtime/ui). Move the needed
           function down to src/config/ or src/types/, or accept the value as a parameter
           from a higher-layer caller. If this is a type-only reference, switch to a JSDoc
           @typedef import which is exempt from this rule."
    ```
  - **範例 — canonical-no-import-lib**:
    ```
    現在: "Canonical layers may not runtime-import src/lib/**; lib remains the compatibility
           layer for non-canonical surfaces and specs."
    改成: "Canonical layer runtime-imports src/lib/**. Import from the canonical home instead
           (e.g. @/lib/firebase-events → @/repo/client/firebase-events-repo). Type-only
           imports via JSDoc are exempt. To find the canonical target: grep the src/lib/
           facade file for its re-export source."
    ```
  - **Write Scope**: `.dependency-cruiser.mjs`（只改 `comment` 字串）
  - **受影響 Tests**: ✅ 無。已確認 `canonical-no-import-lib.test.js` 和 `test-bucket-policy.test.js` 都不 assert `comment` 欄位內容。
  - **驗收標準**:
    1. 所有 forbidden rules 的 `comment` 包含：(a) 明確的 violation 描述、(b) 至少一個修復步驟、(c) 具體路徑範例或指令
    2. `npm run depcruise` 仍為 0 violation
    3. `npm run test` 全部通過（comment 改動不影響 rule 行為）
    4. `npx depcruise --config .dependency-cruiser.mjs --output-type err-long src specs 2>&1 | head -5` 確認 output format 正確
  - **Dependencies**: 無

- [ ] S027 Server-only 漏標封堵：加 dep-cruise rule 確保 import `firebase-admin` 的檔案必須在 server path。
  - **Gap**: `server-only-no-client-import` 防止 client→server 匯入，但不防止 server-only code 放在非 server path。如果有人把 `firebase-admin` import 放在 `src/service/foo.js`，dep-cruise 不會攔。
  - **要改的檔案**: `.dependency-cruiser.mjs`
  - **做法**: 在 `forbidden` 陣列新增一條 `server-deps-require-server-path` rule：
    ```js
    {
      name: 'server-deps-require-server-path',
      comment: 'Files importing firebase-admin must be in a server path (src/*/server/ or '
             + '*.server.js). Move this file to src/{layer}/server/ or rename to *.server.js. '
             + 'If you only need a type, use a JSDoc @typedef import instead.',
      severity: 'error',
      from: {
        pathNot: SERVER_ONLY_PATTERN,
      },
      to: withDependencyTypeFilter({
        path: '^(?:node_modules/firebase-admin|src/config/server/firebase-admin-app)',
      }),
    }
    ```
  - **Pre-flight check**: 開始前必須驗證現有 code 沒有漏標：
    ```bash
    grep -rn "from 'firebase-admin" src/ --include="*.js" --include="*.jsx"
    grep -rn "from '@/config/server/firebase-admin-app'" src/ --include="*.js" --include="*.jsx"
    ```
    確認所有命中都在 `src/*/server/` 或 `.server.js` 內。
  - **Write Scope**: `.dependency-cruiser.mjs`、新增 `specs/021-layered-dependency-architecture/tests/unit/server-only-enforcement.test.js`
  - **受影響 Tests**: ⚠️ 新增測試檔。
  - **新增測試** `server-only-enforcement.test.js`：
    1. 從 `.dependency-cruiser.mjs` import config，驗證 `server-deps-require-server-path` rule 存在
    2. 驗證 severity = `'error'`
    3. 驗證 `from.pathNot` 包含 `SERVER_ONLY_PATTERN` 的等效內容
    4. 驗證 `to.path` 匹配 `firebase-admin` 和 `firebase-admin-app`
    5. 跑 `npm run depcruise` 確認 0 violation
  - **驗收標準**:
    1. 新規則下 `npm run depcruise` 仍為 0 violation
    2. 新 Vitest 測試通過
    3. 非 server path 的檔案如果 import `firebase-admin`，dep-cruise 會報 error（可手動建一個違規檔驗證後刪除）
    4. `npm run test` 全部通過
  - **Dependencies**: 無

- [ ] S028 `provider-no-service` cross-cutting 隔離規則：加 dep-cruise rule 確保 Providers 不直接 import Service 層。
  - **文章依據**: Image #5 顯示 Providers 與 Service→Runtime→UI 鏈平行，是獨立的 cross-cutting 注入通道，不應參與業務邏輯鏈。
  - **前置確認**: ✅ 已驗證現有 3 個 Providers 的 runtime imports：
    - `AuthProvider.jsx` → `@/runtime/client/use-cases/auth-use-cases`（同層 Runtime，不碰 Service）
    - `NotificationProvider.jsx` → `./AuthProvider`, `./ToastProvider`（同目錄）+ JSDoc type-only from `@/service/notification-service`（被 `withDependencyTypeFilter` 排除）
    - `ToastProvider.jsx` → React + `next/navigation`（外部）
    - **結論**: 規則加上去會直接 0 violation，不需重構現有 code。
  - **要改的檔案**: `.dependency-cruiser.mjs`
  - **做法**: 在 `forbidden` 陣列新增 `provider-no-service` rule（放在 `provider-no-repo` 之後）：
    ```js
    {
      name: 'provider-no-service',
      comment: 'Providers inject cross-cutting context only (auth, notifications, toast). '
             + 'Business logic belongs in use-cases under src/runtime/client/use-cases/. '
             + 'If a provider needs service-layer data, route it through a use-case.',
      severity: 'error',
      from: {
        path: '^src/runtime/providers(?:/|$)',
      },
      to: withDependencyTypeFilter({
        path: '^src/service(?:/|$)',
      }),
    }
    ```
  - **Write Scope**: `.dependency-cruiser.mjs`、新增或追加 test
  - **受影響 Tests**: ⚠️ 需新增 test case。
  - **新增測試**（在 `specs/021-layered-dependency-architecture/tests/unit/` 新建 `provider-cross-cutting.test.js` 或追加到 `canonical-no-import-lib.test.js`）：
    1. 驗證 `provider-no-service` rule 存在於 dep-cruise config
    2. 驗證 severity = `'error'`
    3. 驗證 `from.path` 匹配 `src/runtime/providers/`
    4. 驗證 `to.path` 匹配 `src/service/`
    5. 驗證 `to.dependencyTypesNot` 包含 `NON_RUNTIME_DEPENDENCY_TYPES`（JSDoc type-only 豁免）
  - **驗收標準**:
    1. 新規則下 `npm run depcruise` 仍為 0 violation
    2. Vitest 測試通過
    3. 如果未來有人在 Provider 中 `import { foo } from '@/service/bar'`，dep-cruise 會報 error
    4. JSDoc type-only imports（如 `@typedef {import('@/service/notification-service').NotificationItem}`）仍被允許
    5. `npm run test` 全部通過
  - **Dependencies**: 無

- [ ] S029 ProfileEventList 走 runtime hook：消除最後一個 thick-ish entry component，把 fetch + IntersectionObserver 邏輯搬到 runtime hook。
  - **現況**: `src/app/users/[uid]/ProfileEventList.jsx`（189L）直接 import `@/lib/firebase-profile` 的 `getHostedEvents`，自己管 state（items, loading, hasMore, lastDoc, error）+ IntersectionObserver，是最後一個未走 runtime hook 的 entry-level component。
  - **Integration test 現況**: `specs/012-public-profile/tests/integration/ProfileEventList.test.jsx` mock `@/lib/firebase-profile`、`@/components/DashboardEventCard`、`next/link`，直接 render `ProfileEventList` 並驗 infinite scroll 行為。`ProfileClient.test.jsx` 已 mock 整個 `ProfileEventList` component。
  - **做法**:
    1. 新建 `src/runtime/hooks/useProfileEventsRuntime.js`：承接 `getHostedEvents` fetch 邏輯（首次載入 + loadMore + IntersectionObserver + state），import canonical path `@/service/profile-service` 的 `getHostedEvents`（而非 `@/lib/firebase-profile`）
    2. `ProfileEventList.jsx` 瘦身為 render-only：消費 runtime hook 回傳的 state/handlers，搬到 `src/ui/users/ProfileEventListScreen.jsx`
    3. `src/app/users/[uid]/ProfileEventList.jsx` 變成 thin wrapper：import runtime hook + render Screen
    4. `toDashboardItem()` mapping 函式搬到 `src/service/profile-service.js` 或保留在 Screen（UI 層 display fallback）
  - **Write Scope**: `src/app/users/[uid]/ProfileEventList.jsx`（thin wrapper 化）、新建 `src/runtime/hooks/useProfileEventsRuntime.js`、新建 `src/ui/users/ProfileEventListScreen.jsx`、受影響 tests、handoff.md
  - **受影響 Tests**:
    - `specs/012-public-profile/tests/integration/ProfileEventList.test.jsx` — **需重構**：
      - 現在：mock `@/lib/firebase-profile`（`getHostedEvents`），直接 render `ProfileEventList`
      - 改成：mock `@/runtime/hooks/useProfileEventsRuntime`，render thin wrapper `ProfileEventList` 或直接 render `ProfileEventListScreen`
      - 或者：降級為 unit test（搬到 `tests/unit/`），直接測 `useProfileEventsRuntime` hook + mock `@/service/profile-service`（canonical path）
    - `specs/012-public-profile/tests/integration/ProfileClient.test.jsx` — 已 mock 整個 `ProfileEventList` component，拆分後 **mock path 不變**（`@/app/users/[uid]/ProfileEventList` thin wrapper 仍在同路徑）✅
    - 新增 `specs/021-layered-dependency-architecture/tests/unit/profile-events-runtime.test.js`：
      - Unit test for `useProfileEventsRuntime` hook
      - Mock `@/service/profile-service`（canonical path，不透過 facade）
      - 驗首次載入、loadMore、error handling、hasMore=false 停止
  - **驗收標準**:
    1. `ProfileEventList.jsx` 或其 thin wrapper ≤ 20 行
    2. `ProfileEventListScreen.jsx` 不 import `@/lib/**`、`@/repo/**`、`@/service/**`（render-only）
    3. `useProfileEventsRuntime.js` import canonical path `@/service/profile-service`，不透過 `@/lib/` facade
    4. IntersectionObserver + state management 全在 runtime hook
    5. `npm run depcruise` 仍為 0 violation
    6. `npm run test` 全部通過（含重構後的 integration test + 新增 unit test）
    7. `toDashboardItem()` 若搬到 service 層，不依賴 UI/runtime
  - **Dependencies**: 無（但建議在 S026-S028 之後做，避免同時改太多檔案）

## Phase 9-11 依賴圖

```
S018 (repo-tier) ──┬─→ S020 (event-helpers + timestamp) ──┐
S019 (svc-tier) ───┤                                       ├─→ S025 (enforcement)
                   │   S020a (utility readiness) ──────────┘
S021 (posts) ──────┤   (可獨立平行)
S022 (runs) ───────┤   soft-depends S018
S023 (member) ─────┘   soft-depends S018 + S019
S024 (weather API) ──→ depends S019
```

> `soft-depends`：非 hard block，但完成後 runtime hook 可直接用 canonical path，避免先用 facade 再改。

## Global Reviewer Checklist

每個 session 的 reviewer 都必查：

1. 是否只改該 task 的 write scope。
2. 是否把 `Providers` 當正式 runtime 邊界，而不是灰區。
3. 是否避免用 baseline / 排除舊檔來換取綠燈。
4. 是否真的拆責任，而非只搬資料夾。
5. 是否更新 `handoff.md` 的狀態、證據、踩坑與下一棒說明。
6. 是否留下最小必要驗證證據。
7. **Unit test 是否指向 canonical path**（不透過 facade），integration test 的 `vi.mock` 是否與被測模組 actual import 一致。
8. **需改分類的 tests**（integration → unit）是否已搬到正確 bucket 目錄。
