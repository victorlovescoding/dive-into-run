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

## Phase 9: `src/lib/**` 實作遷移

> S001-S017 已把大部分業務邏輯從 `src/lib/**` 拆到 canonical layers，但 `src/lib/` 仍有 8 個 IMPLEMENTATION 檔含真實業務邏輯（非 facade）。dep-cruise 的 `CANONICAL_LAYER_PATTERNS` 不含 `lib`，所以這些違規完全不被攔截。Phase 9 的目標是把剩餘實作搬到正確 canonical layer，讓 `src/lib/**` 只剩 facade + utility。

- [ ] S018 Repo-tier 遷移：把 `src/lib/` 中屬於 repo 層的 3 個 IMPLEMENTATION 檔遷移到 `src/repo/client/`，原檔收斂為 facade re-export。
  - `firebase-strava.js`（131L）→ `src/repo/client/firebase-strava-repo.js`：realtime listener + paginated/monthly Firestore query
  - `firebase-users.js`（102L）→ `src/repo/client/firebase-users-repo.js`：login check + user CRUD + realtime listener
  - `firebase-weather-favorites.js`（110L）→ `src/repo/client/firebase-weather-favorites-repo.js`：favorites CRUD + dedup
  - **Write Scope**: 上述 3 對（新檔 + 原檔 facade 化）、所有 canonical layer callers retarget（runtime hooks、use-cases）、受影響 tests mock path retarget、handoff.md
  - **驗收標準**:
    1. 三個新 repo 檔只依賴 `src/config/**`、external packages、`src/types/**`
    2. 三個原檔只剩 re-export，無 Firestore SDK import
    3. `npm run depcruise` 仍為 0 violation
    4. `npm run type-check:changed` 通過
    5. 受影響 vitest 通過
  - **Dependencies**: 無（可獨立開始）

- [ ] S019 Service-tier 遷移：把 `src/lib/` 中屬於 service 層的 3 個 IMPLEMENTATION 檔遷移到 canonical layers，原檔收斂為 facade re-export。
  - `firebase-profile-mapper.js`（37L）→ `src/service/profile-mapper.js`：`toPublicProfile` normalization，client/server 共用
  - `firebase-profile-server.js`（36L）→ `src/service/profile-server-service.js`：server profile fetch + mapping
  - `weather-api.js`（26L）→ `src/repo/client/weather-api-repo.js`：HTTP fetch to `/api/weather`
  - **Write Scope**: 上述 3 對（新檔 + 原檔 facade 化）、`src/service/profile-service.js` 改 import `@/service/profile-mapper`、受影響 callers / tests retarget、handoff.md
  - **驗收標準**:
    1. `profile-mapper` 不依賴 repo/runtime/ui
    2. `profile-server-service` 只依賴 `src/repo/server/**` + `src/service/profile-mapper`
    3. `weather-api-repo` 只依賴 external packages（fetch）
    4. `npm run depcruise` 仍為 0 violation
    5. 原檔只剩 re-export
  - **Dependencies**: 無（可與 S018 平行）

- [ ] S020 拆分 `event-helpers.js`（280L）：event 業務規則遷入 service 層，純格式化工具留在 utility 位置。
  - 業務規則 → 併入 `src/service/event-service.js`：`getRemainingSeats()`、`isDeadlinePassed()`、`buildUserPayload()`、`buildRoutePayload()`、`normalizeRoutePolylines()`
  - 純格式化 → 留在 `src/lib/event-helpers.js`（或改名 `event-formatters.js`）：`formatDateTime()`、`formatPace()`、`formatCommentTime()`、`formatCommentTimeFull()`、`chunkArray()`、`toNumber()`、`toMs()`、`countTotalPoints()`
  - 一併處理 `firebase-firestore-timestamp.js`（18L）：遷入 `src/config/client/firebase-timestamp.js` 或保留
  - **Write Scope**: `src/lib/event-helpers.js`、`src/service/event-service.js`、`src/lib/firebase-firestore-timestamp.js`（可選）、所有 runtime hooks retarget、受影響 tests、handoff.md
  - **驗收標準**:
    1. `src/service/event-service.js` 新增的函式不依賴 UI/runtime
    2. 純工具函式無 Firestore/Firebase import
    3. Runtime hooks 改 import service 層的業務函式
    4. `npm run depcruise` 仍為 0 violation
    5. `src/lib/event-helpers.js` 不含任何 event 業務判斷邏輯（deadline/seats/payload）
  - **Dependencies**: S018 完成後較佳（避免同時改太多 runtime hook import）

## Phase 10: 剩餘 Thick Entry 拆分

> S010-S013 已把 events list、event detail、post detail、weather、dashboard 拆成 thin entry + runtime + ui。但仍有 6 個 thick entry 未拆：posts list（371L）、runs（165L）、runs callback（131L）、member（130L）、ProfileClient（147L）、api/weather route（590L）。Phase 10 沿用同樣模式拆分。

- [ ] S021 Thin-entry `src/app/posts/page.jsx`（371L）：拆成 thin entry + runtime hook + UI screen。
  - 新建 `src/runtime/hooks/usePostsPageRuntime.js`：承接 posts fetch/pagination（IntersectionObserver）/CRUD/optimistic like/edit/search params toast orchestration
  - 新建 `src/ui/posts/PostsPageScreen.jsx`：render-only，消費 runtime state/handlers
  - `src/app/posts/page.jsx` → thin entry（Suspense + PostsPageScreen）
  - **Write Scope**: `src/app/posts/page.jsx`、新建 runtime/ui 檔、受影響 page-level tests retarget mock 到 runtime use-cases、handoff.md
  - **驗收標準**:
    1. `src/app/posts/page.jsx` ≤ 20 行，只有 Suspense + Screen
    2. `PostsPageScreen.jsx` 不 import `@/lib/**`、`@/contexts/**`、`@/runtime/client/use-cases/**`
    3. 所有業務邏輯（IntersectionObserver、optimistic like、CRUD handlers）在 runtime hook
    4. `npm run depcruise` 仍為 0 violation
    5. Page-level integration tests 通過
  - **Dependencies**: 無（可獨立開始）

- [ ] S022 Thin-entry `src/app/runs/page.jsx`（165L）+ `runs/callback/page.jsx`（131L）：拆成 thin entry + runtime + ui。
  - `runs/page.jsx`：新建 `src/runtime/hooks/useRunsPageRuntime.js`（sync/disconnect/auto-refresh/auth-state）+ `src/ui/runs/RunsPageScreen.jsx`
  - `runs/callback/page.jsx`：新建 `src/runtime/hooks/useStravaCallbackRuntime.js`（OAuth code exchange/error handling）+ `src/ui/runs/StravaCallbackScreen.jsx`
  - **Write Scope**: 兩個 page entry、4 個新建 runtime/ui 檔、受影響 tests、handoff.md
  - **驗收標準**:
    1. 兩個 page entry 各 ≤ 20 行
    2. Screen 不 import `@/contexts/**`、不含 fetch/async 邏輯
    3. `npm run depcruise` 仍為 0 violation
    4. Runs page / callback integration tests 通過
  - **Dependencies**: 無

- [ ] S023 Thin-entry `src/app/member/page.jsx`（130L）+ `src/app/users/[uid]/ProfileClient.jsx`（147L）：拆成 thin entry + runtime + ui。
  - `member/page.jsx`：新建 `src/runtime/hooks/useMemberPageRuntime.js`（avatar upload/name update/auth）+ `src/ui/member/MemberPageScreen.jsx`
  - `ProfileClient.jsx`：新建 `src/runtime/hooks/useProfileRuntime.js`（stats fetch/profile data/own-profile check）+ `src/ui/users/ProfileScreen.jsx`
  - **Write Scope**: 兩個 entry、4 個新建 runtime/ui 檔、受影響 tests、handoff.md
  - **驗收標準**:
    1. 兩個 entry 各 ≤ 20 行
    2. Screen 不 import service/repo/contexts
    3. `npm run depcruise` 仍為 0 violation
    4. Member/profile integration tests 通過
  - **Dependencies**: S019 完成後較佳（profile-mapper 已遷入 service）

- [ ] S024 Thin-entry `src/app/api/weather/route.js`（590L）：業務邏輯下沉到 service 層，route 只保留 request parsing + response forwarding。
  - 新建 `src/service/weather-forecast-service.js`：CWA/EPA API fetch chain、UV/AQI extraction、county/township normalization、response 組裝
  - 可能需要 `src/repo/server/weather-api-repo.js`：封裝 CWA/EPA 原始 HTTP 呼叫
  - `route.js` → thin route
  - **Write Scope**: `src/app/api/weather/route.js`、新建 service/repo 檔、受影響 tests、handoff.md
  - **驗收標準**:
    1. `route.js` ≤ 30 行，只有 request → service → NextResponse
    2. Service 函式可獨立 unit test（不需 NextRequest mock）
    3. CWA/EPA API key 從 env 讀取的邏輯在 config 或 service，不在 route
    4. `npm run depcruise` 仍為 0 violation
    5. Weather API route tests 通過
  - **Dependencies**: S019（weather-api.js 已遷）

## Phase 11: Enforcement 收斂

> Phase 9 完成後，`src/lib/**` 理應只剩 9 個 facade + 3 個 utility（notification-helpers、og-helpers、strava-helpers）。Phase 11 用 dep-cruise 規則機械化封住 canonical layers → `src/lib/**` 的 runtime import，讓 0 violation 真正覆蓋所有邊。

- [ ] S025 dep-cruise 規則硬化：canonical layers 禁止 runtime-import `src/lib/**`。
  - `.dependency-cruiser.mjs` 新增規則：`src/{types,config,repo,service,runtime,ui}/**` 不可 runtime-import `src/lib/**`
  - 清理殘留的 canonical → `src/lib/**` JSDoc type-only 指向（改指向 `src/types/**` 或 `src/service/**`）
  - **Write Scope**: `.dependency-cruiser.mjs`、殘留 JSDoc import retarget、handoff.md
  - **驗收標準**:
    1. 新規則下 `npm run depcruise` 仍為 0 violation
    2. Type-only imports（JSDoc）已同步遷移或確認豁免
    3. FACADE 與 UTILITY 仍可被 `src/app/**`、`src/components/**`、`src/contexts/**`、`src/hooks/**` import（non-canonical surfaces）
    4. `npm run type-check:changed` 通過
  - **Dependencies**: S018 + S019 + S020 全部完成

## Phase 9-11 依賴圖

```
S018 (repo-tier) ──┐
S019 (svc-tier) ───┼─→ S020 (event-helpers split) ─→ S025 (enforcement)
                   │
S021 (posts) ──────┤   (可獨立平行)
S022 (runs) ───────┤   (可獨立平行)
S023 (member) ─────┘─→ depends on S019
S024 (weather API) ──→ depends on S019
```

## Global Reviewer Checklist

每個 session 的 reviewer 都必查：

1. 是否只改該 task 的 write scope。
2. 是否把 `Providers` 當正式 runtime 邊界，而不是灰區。
3. 是否避免用 baseline / 排除舊檔來換取綠燈。
4. 是否真的拆責任，而非只搬資料夾。
5. 是否更新 `handoff.md` 的狀態、證據、踩坑與下一棒說明。
6. 是否留下最小必要驗證證據。
