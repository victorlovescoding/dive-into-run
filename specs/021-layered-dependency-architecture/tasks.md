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

## Global Reviewer Checklist

每個 session 的 reviewer 都必查：

1. 是否只改該 task 的 write scope。
2. 是否把 `Providers` 當正式 runtime 邊界，而不是灰區。
3. 是否避免用 baseline / 排除舊檔來換取綠燈。
4. 是否真的拆責任，而非只搬資料夾。
5. 是否更新 `handoff.md` 的狀態、證據、踩坑與下一棒說明。
6. 是否留下最小必要驗證證據。
