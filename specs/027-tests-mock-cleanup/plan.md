# 027 — tests mock cleanup（P0-1 全 4 批 — Wave 3 整批清）

> **Branch**: `027-tests-mock-cleanup`
> **Audit source**: `project-health/2026-04-29-tests-audit-report.md` §2 P0-1（L77-111）
> **Predecessor**: spec 026（PR #25/#26/#27 merged）— 規則上線、`eslint.config.mjs` block 18.6 留下 47 檔 ignores baseline（僅攔 `tests/integration/**`，selector `@/(repo|service|runtime)/`）
> **Successor trigger**: 本 spec 完成 → §12.7 S8 升級觸發（baseline mock-boundary 部分全空 → 規則對全 codebase 生效；`audit-*.sh` `exit 0` → `exit 1`）

---

## 1. TL;DR

把 audit P0-1 的「邊界內違規 mock」**全 4 批一次清完，並修正 spec 026 留下的 selector 設計缺陷**：

**真實違規範圍**（嚴格按 mock-discipline）：

| 邊界內 src 層                   | mock 處數 |
| ------------------------------- | --------: |
| `@/lib/*`                       |        27 |
| `@/repo/*`                      |        11 |
| `@/service/*`                   |         8 |
| `@/runtime/*` 扣 providers (60) |        60 |
| **合計違規**                    |   **106** |

按測試目錄分批：

- **第一批**: `tests/integration/**` mock `@/(lib\|repo\|service\|runtime)/` 扣 providers — **44 檔 / 78 violations**
- **第二批**: `tests/unit/runtime/**` 同上 — 5 檔 / 7 violations
- **第三批**: `tests/unit/lib/**` 同上 — 5 檔 / 11 violations
- **第四批**: `tests/unit/api/**` 同上 — 6 檔 / 6 violations
- **散落**: `tests/unit/{service,repo}/**` 同上 — 3 檔 / 4 violations

**合計：63 檔 / 106 violations**。

切成 **8 個 session / 8 個 PR**（S0 前置 + S1-S5 第一批 + S6 第三批 + S7 第二+四+散落）。

| 量化                                    | 值         | 來源                                                                           |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| 全 codebase `vi.mock('@/...')` 總計     | 233        | audit L23                                                                      |
| **邊界外保留**（不清）                  | **81 處**  | `@/config/*` 47 + `@/data/*` 6 + `@/contexts/*` 6 + `@/runtime/providers/*` 22 |
| **邊界內違規**（本 spec 清）            | **106 處** | 4 批 + 散落                                                                    |
| **灰色 components/app**（本 spec 不清） | 46 處      | `@/components/*` 43 + `@/app/*` 3                                              |
| 違規檔數                                | **63 檔**  | 4 批 + 散落合計                                                                |

> **「233 全清」字面不可行**：
>
> 1. 47 處 `@/config/client/firebase-client` 是 SDK init 邊界，移除測試會試圖打真 Firebase（jsdom 無 emulator）→ 全炸。audit L94 明示保留。
> 2. 22 處 `@/runtime/providers/*` 是 React Provider 邊界，audit L94 認可保留。
> 3. 6 處 `@/contexts/*` + 6 處 `@/data/*` 同理屬邊界外。
> 4. 46 處 `@/components/*` + `@/app/*` 是測試風格選擇（重 component mock 合理），個案決策不適合 batch cleanup。

---

## 2. Why this plan exists（兩個動機）

### 2.1 Spec 026 S6 規則的 selector bug

spec 026 S6 block 18.6 規則 selector 是 `^@\/(repo|service|runtime)\/`，有兩個 bug：

1. **漏 `@/lib`**：23 處 `tests/integration/**` mock `@/lib/*` 規則完全沒攔（如 `Navbar.test.jsx` mock `@/lib/firebase-auth-helpers`、notification 系列 mock `@/lib/notification-helpers`）— 這些違反 memory `feedback_mock_discipline.md`「自家 @/lib 被 mock 是黑洞」原則
2. **誤殺 providers**：`@/runtime/providers/*` 22 處是 React 邊界（audit L94 認可），但 selector regex `@/runtime/` match 整個 runtime tree → 規則 fire 把 providers mock 也算違規（被 baseline 47 檔豁免暫時掩蓋）

S0 階段一次修兩個 bug：selector 改 `^@\/(lib|repo|service|runtime)\/` 並對 providers mock 加白名單（不算違規）。

### 2.2 Baseline drain 必須先擴規則覆蓋

spec 026 S6 block 18.6 只攔 `tests/integration/**`，其他 3 批違規（unit/runtime + unit/lib + unit/api + 散落）規則完全不擋。

不擴規則直接清 → 改完沒護欄、新 contributor 加新違規不會被攔。
規則先擴、再 drain → 每批都有「lint 規則 + ignores baseline + drain commit」可驗證迴圈。

完成後：

- `eslint.config.mjs` 4 個 mock-boundary baseline block 對應 mock 部分全空（block 18.6 仍保留 ~14 flaky-only overlap）
- `audit-mock-boundary.sh` SEARCH_PATH 從 `tests/integration` 擴到 `tests`，仍能 `exit 0`
- audit P0-1 全 4 批完整對齊 → S8 觸發條件達成

---

## 3. Scope

### 3.1 In scope（63 檔 / 106 violations）

| 批次     | 範圍                           |     檔 | violations | session |
| -------- | ------------------------------ | -----: | ---------: | ------- |
| 第一批   | `tests/integration/**`         |     44 |         78 | S1-S5   |
| 第二批   | `tests/unit/runtime/**`        |      5 |          7 | S7      |
| 第三批   | `tests/unit/lib/**`            |      5 |         11 | S6      |
| 第四批   | `tests/unit/api/**`            |      6 |          6 | S7      |
| 散落     | `tests/unit/{service,repo}/**` |      3 |          4 | S7      |
| **合計** | —                              | **63** |    **106** | —       |

> Selector 統一：`^@\/(lib|repo|service|runtime)\/`，扣 `@/runtime/providers/*`。

**第一批 44 檔對比 spec 026 S6 baseline 47 檔**：

- **33 檔**：原 mock-boundary baseline 違規檔（spec 026 S6 算的）
- **3 檔**：原為 flaky-only overlap，selector 擴大後新增 mock-boundary 違規 — `NavbarMobile.test.jsx`、`NavbarDesktop.test.jsx`、`BioEditor.test.jsx`
- **8 檔**：完全新加（不在 spec 026 baseline 47），S0 規則擴 selector 後 fire → 必須加進 18.6 baseline：
  1. `tests/integration/posts/PostCard.test.jsx`
  2. `tests/integration/dashboard/DashboardCommentCard.test.jsx`
  3. `tests/integration/dashboard/DashboardEventCard.test.jsx`
  4. `tests/integration/dashboard/DashboardPostCard.test.jsx`
  5. `tests/integration/navbar/Navbar.test.jsx`
  6. `tests/integration/navbar/isActivePath.test.js`
  7. `tests/integration/strava/RunsRouteMap.test.jsx`
  8. `tests/integration/strava/RunsActivityCard.test.jsx`

**S0 baseline 起始狀態（S0 完成後）**：

- block 18.6（integration）: 47 + 8 = **55 檔**（涵蓋 mock-boundary 44 + flaky-only overlap 11）
- block 18.7（unit/runtime + api + service + repo）: **14 檔**（new）
- block 18.8（unit/lib）: **5 檔**（new）

### 3.2 Out of scope

| 項目                                           | 預估規模                                       | 為何不做                                                                 |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| **81 處邊界外 mock**                           | 81 處                                          | audit L94-96 明示為合規邊界外保留                                        |
| **46 處灰色 components/app**                   | 46 處                                          | `@/components/*` 43 + `@/app/*` 3 — 測試風格選擇；audit 沒明列；個案決策 |
| **flaky-pattern baseline drain**（block 18.5） | 109 處 toHaveBeenCalledTimes + N 處 setTimeout | 屬 P1-4/P1-5；本 spec 只順手清「同檔」flaky                              |
| **P1-1 26 hooks 補測**                         | 24 hooks × 1-3 hr                              | P1-1 補測新案非清舊                                                      |
| **重設 jsdom + Firestore emulator 整合**       | 1 sprint                                       | P1-3；本 spec Option B 避免                                              |

### 3.3 Risk-out

- **不**清 81 處邊界外 mock — audit 認可邊界
- **不**清 46 處灰色 components/app mock — 個案發現是真錯 → flag 028+ spec
- **不**透過「換規則 mute」假裝清完 — baseline 移檔的條件是該檔對該規則 lint pass
- **不**用 `eslint-disable` inline 豁免
- **selector 動法限制**：S0 階段擴 selector 含 `@/lib` 並排除 providers（修 spec 026 S6 bug）；S1-S7 階段**不**動 selector
- **不**在本 spec 動 `src/` 任何 production code

---

## 4. Strategy（Option B 為主，Option A 個案）

### 4.1 Option B — 把「mock 自家內部模組」改為「mock 邊界外 SDK」

**做法**：

```js
// 改寫前（違規 — 含 @/lib）
vi.mock('@/runtime/client/use-cases/post-use-cases', () => ({
  getPostDetail: vi.fn(),
}));
vi.mock('@/lib/notification-helpers', () => ({
  pickFirstAuthor: vi.fn(),
}));

// 改寫後（合規 — 邊界外 SDK 層 mock）
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  // ...
}));

// 測試 setup：
import { getDoc } from 'firebase/firestore';
beforeEach(() => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ id: 'p1', title: 'Test' }) });
});
```

**為何 Option B 合規**：audit L94-96 明示「`vi.mock('firebase/firestore', ...)` 是 SDK 層 mock — 邊界外可保留」。改寫後 use-case → service → lib facade → repo 鏈會「真實執行」。

**Option B 適用情境**（≥ 90% 案例）：

- ✅ component / use-case 測試走 use-case → repo → SDK 「讀」鏈
- ✅ component / use-case 測試走 use-case → SDK 「寫」鏈
- ✅ component / hook 需要 toast/router/AuthContext 等 React 邊界外 mock（保留為合規）
- ✅ unit/lib 測試 lib facade 時 mock 它的下游 lib/repo → 改為 mock SDK
- ✅ unit/api route 測試走 route handler → server use-case → server repo → 改為 mock `firebase-admin/firestore`

**Option B 不適用情境**：

- ❌ 測試需驗證 Firestore transaction 真實 atomic 行為 → 改用 server project + emulator
- ❌ 測試需驗證 collectionGroup query 真實 cross-user 行為 → 同上
- ❌ 測試涉及 fetch 邊界（Strava OAuth callback / webhook）→ Option A（nock + emulator）或拆 server-side route 測試

### 4.2 Option A — 真 integration（emulator）— 個案

僅在 Option B 確實失真時才用。本 spec **不**新建 jsdom + emulator 整合 setup。pilot 發現某檔屬 Option A → flag 移交給 028+ spec。

### 4.3 改寫流程的最小可行步驟（per 檔）

1. **盤點**：列出該檔所有 `vi.mock('@/...')` 呼叫，標記違規（規則 fire 對象）vs 合規（`@/config/*`、第三方 SDK、context/provider）
2. **追溯**：grep 違規 mock 對應的 `vi.fn()` exports 在測試裡如何被 `mockResolvedValue` / `mockReturnValue`
3. **改寫**：拿掉違規 `vi.mock`，改 mock `firebase/firestore` 或 `firebase-admin/firestore`（依 client/server）
4. **跑單檔測試**：`npx vitest run <file>`
5. **跑單檔 lint**：`npx eslint <file>`
6. **從 baseline 拿掉檔**：對應 ESLint block ignores 拿掉該行
7. **再跑全 lint**：`npm run lint`
8. **commit message** 加 `Baseline change: <block>: X → X-1 (removed: <file>)`

---

## 5. Session 切分（8 sessions / 8 PRs）

### S0: ESLint 規則擴展 + 新 baseline 收集（前置）

**目標**：擴 selector 涵蓋全 4 批 + 散落，修 spec 026 S6 bug，收集 ignores baseline。

**改檔**：

1. `eslint.config.mjs`：
   - **block 18.6 修正**（既有，`tests/integration/**`）：
     - selector 第一條 regex：`^@\\/(repo|service|runtime)\\/` → `^@\\/(lib|repo|service|runtime)\\/`
     - selector 第二條 template literal：同步擴
     - **加 providers exclusion**：再加一條 selector 把 `@/runtime/providers/` 排除（兩層 selector：擴大 fire + 排除 providers）。實作：在 selector message 加註明，或多增加一條 `selector` 配 `not include providers` 的 AST condition
     - 實際 esquery 不支援 negative，最務實做法：保留現有 selector + ignores 加 `tests/integration/**/*.test.{js,jsx,mjs}` 中 mock providers 的位置（但 mock providers 不該 fire）→ 改用「兩條 positive selector」：`^@\/(lib|repo|service)\/` + `^@\/runtime\/(?!providers)` （需測 esquery 支援）→ 若不支援則 fallback：規則 message 註明「providers mock 視為合規，PR review 攔截」+ 不在 ignores 列 providers-only 檔
     - **ignores 新加 8 檔**：PostCard / Dashboard\*Card 3 / Navbar / isActivePath / RunsRouteMap / RunsActivityCard
   - **新增 block 18.7**（`tests/unit/runtime/**` + `api/**` + `service/**` + `repo/**`）：error + ignores baseline 14 檔
   - **新增 block 18.8**（`tests/unit/lib/**`）：error + ignores baseline 5 檔
2. `scripts/audit-mock-boundary.sh`：SEARCH_PATH `tests/integration` → `tests`、PATTERN 含 4 批
3. PR template：「Baseline tracking」checkbox 文字含 4 個 block 名

**Baseline 起始**（S0 commit 後）：

- block 18.6: **55 檔**（47 原 + 8 新；含 mock-boundary 44 + flaky-only overlap 11）
- block 18.7: **14 檔**（5 unit/runtime + 6 api + 2 service + 1 repo）
- block 18.8: **5 檔**

**驗證**：

```bash
npm run lint  # 全綠（baseline 完整 mute）
# Smoke test：在 baseline 外的 unit test 暫時加 vi.mock('@/repo/foo') → npm run lint 應 error → 撤銷
```

**預估**：1 day（含規則設計 trial-and-error + baseline 收集）。

**Commit message**：`chore(eslint): expand mock-boundary rule + fix selector bugs (P0-1)`

**Risk flags**：

- esquery 對 negative lookahead `(?!providers)` 支援未驗 → 若失敗，fallback 為「兩條 positive selector」+ 在 message 提醒 reviewer providers mock 是合規
- block 18.7 涵蓋多目錄 → 用單一 block + `files: ['tests/unit/{runtime,api,service,repo}/**/*.test.{js,jsx,mjs}']`

---

### S1: posts/ 重型 5 檔（pilot — 第一批）

**範圍**（5 檔 / 10 violations，每檔 2）：

| violations | 檔                                                              |
| ---------: | --------------------------------------------------------------- |
|          2 | `tests/integration/posts/PostDetail.test.jsx`                   |
|          2 | `tests/integration/posts/PostDetailClient-delete-race.test.jsx` |
|          2 | `tests/integration/posts/post-edit-validation.test.jsx`         |
|          2 | `tests/integration/posts/post-detail-edit-dirty.test.jsx`       |
|          2 | `tests/integration/posts/post-comment-reply.test.jsx`           |

**Pilot deliverable**：handoff.md 補「Setup pattern reference」段。

**預估**：2-3 day。

**Risk flags**：PostDetailClient-delete-race 涉及 transaction race → 評估 Option A。

---

### S2: posts/ 收尾 + comments + dashboard + navbar（第一批）

**範圍**（14 檔 / 15 violations，多數每檔 1）：

| violations | 檔                                                                 |
| ---------: | ------------------------------------------------------------------ |
|          1 | `tests/integration/posts/PostFeed.test.jsx`                        |
|          1 | `tests/integration/posts/posts-page-edit-dirty.test.jsx`           |
|          1 | `tests/integration/posts/post-form-validation.test.jsx`            |
|          1 | `tests/integration/posts/PostCard.test.jsx` (新加)                 |
|          2 | `tests/integration/comments/event-comment-notification.test.jsx`   |
|          1 | `tests/integration/comments/CommentSection.test.jsx`               |
|          1 | `tests/integration/dashboard/DashboardTabs.test.jsx`               |
|          1 | `tests/integration/dashboard/DashboardCommentCard.test.jsx` (新加) |
|          1 | `tests/integration/dashboard/DashboardEventCard.test.jsx` (新加)   |
|          1 | `tests/integration/dashboard/DashboardPostCard.test.jsx` (新加)    |
|          1 | `tests/integration/navbar/Navbar.test.jsx` (新加)                  |
|          1 | `tests/integration/navbar/NavbarMobile.test.jsx`                   |
|          1 | `tests/integration/navbar/NavbarDesktop.test.jsx`                  |
|          1 | `tests/integration/navbar/isActivePath.test.js` (新加)             |

**預估**：1.5-2 day（檔多但每檔 violations 少）。

---

### S3: notifications/ 9 檔（第一批）

**範圍**（9 檔 / 32 violations）：

| violations | 檔                                                                        |
| ---------: | ------------------------------------------------------------------------- |
|          6 | `tests/integration/notifications/notification-error.test.jsx`             |
|          5 | `tests/integration/notifications/notification-triggers.test.jsx`          |
|          3 | `tests/integration/notifications/notification-click.test.jsx`             |
|          3 | `tests/integration/notifications/NotificationToast.test.jsx`              |
|          3 | `tests/integration/notifications/NotificationTabs.test.jsx`               |
|          3 | `tests/integration/notifications/NotificationPanel.test.jsx`              |
|          3 | `tests/integration/notifications/NotificationPaginationStateful.test.jsx` |
|          3 | `tests/integration/notifications/NotificationPagination.test.jsx`         |
|          3 | `tests/integration/notifications/NotificationBell.test.jsx`               |

**預估**：2.5 day（violations 32 最多）。

**Risk flags**：notification-error 同時 mock 多層；pagination 對齊 `startAfter` 真實行為。

---

### S4: events/ + profile/（第一批）

**範圍**（6 檔 / 8 violations）：

| violations | 檔                                                                |
| ---------: | ----------------------------------------------------------------- |
|          2 | `tests/integration/events/event-detail-comment-runtime.test.jsx`  |
|          2 | `tests/integration/events/EventDetailClient-delete-race.test.jsx` |
|          1 | `tests/integration/events/EventsPage.test.jsx`                    |
|          1 | `tests/integration/profile/ProfileEventList.test.jsx`             |
|          1 | `tests/integration/profile/ProfileClient.test.jsx`                |
|          1 | `tests/integration/profile/BioEditor.test.jsx`                    |

**預估**：1-1.5 day。

**Risk flags**：EventDetailClient-delete-race 跨 collection cascade delete → 評估 Option A。

---

### S5: strava/ + weather/ + toast/（第一批收尾）

**範圍**（10 檔 / 13 violations）：

| violations | 檔                                                          |
| ---------: | ----------------------------------------------------------- |
|          4 | `tests/integration/toast/crud-toast.test.jsx`               |
|          1 | `tests/integration/weather/favorites.test.jsx`              |
|          1 | `tests/integration/weather/weather-page.test.jsx`           |
|          1 | `tests/integration/weather/township-drilldown.test.jsx`     |
|          1 | `tests/integration/strava/runs-page-sync-error.test.jsx`    |
|          1 | `tests/integration/strava/RunsPage.test.jsx`                |
|          1 | `tests/integration/strava/RunCalendarDialog.test.jsx`       |
|          1 | `tests/integration/strava/CallbackPage.test.jsx`            |
|          1 | `tests/integration/strava/RunsRouteMap.test.jsx` (新加)     |
|          1 | `tests/integration/strava/RunsActivityCard.test.jsx` (新加) |

**Baseline drain after S5**：第一批 mock-boundary 部分清空。
**預估**：1.5 day。

**Risk flags**：Strava CallbackPage 涉及 OAuth fetch → 高機率 Option A 個案（移交 P1-3）。

---

### S6: unit/lib notification batch 5 檔（第三批）

**範圍**（5 檔 / 11 violations）：

| violations | 檔                                                      |
| ---------: | ------------------------------------------------------- |
|          3 | `tests/unit/lib/notify-event-new-comment.test.js`       |
|          2 | `tests/unit/lib/notify-post-comment-reply.test.js`      |
|          2 | `tests/unit/lib/firebase-notifications-write.test.js`   |
|          2 | `tests/unit/lib/firebase-notifications-read.test.js`    |
|          2 | `tests/unit/lib/fetch-distinct-comment-authors.test.js` |

**Baseline drain after S6**：18.8 5 → 0。
**預估**：1.5 day。

---

### S7: unit/runtime + unit/api + 散落（第二+四+散落）

**範圍**（14 檔 / 17 violations）：

**第二批 unit/runtime/** (5 檔 / 7 violations)：

| violations | 檔                                                                |
| ---------: | ----------------------------------------------------------------- |
|          2 | `tests/unit/runtime/notification-use-cases.test.js`               |
|          2 | `tests/unit/runtime/useStravaConnection.test.jsx` (含 1 處 @/lib) |
|          1 | `tests/unit/runtime/useStravaActivities.test.jsx`                 |
|          1 | `tests/unit/runtime/profile-events-runtime.test.js`               |
|          1 | `tests/unit/runtime/post-use-cases.test.js`                       |

**第四批 unit/api/** (6 檔 / 6 violations)：

| violations | 檔                                               |
| ---------: | ------------------------------------------------ |
|          1 | `tests/unit/api/weather-api-route.test.js`       |
|          1 | `tests/unit/api/sync-token-revocation.test.js`   |
|          1 | `tests/unit/api/strava-webhook-route.test.js`    |
|          1 | `tests/unit/api/strava-sync-route.test.js`       |
|          1 | `tests/unit/api/strava-disconnect-route.test.js` |
|          1 | `tests/unit/api/strava-callback-route.test.js`   |

**散落 unit/{service,repo}/** (3 檔 / 4 violations)：

| violations | 檔                                                    |
| ---------: | ----------------------------------------------------- |
|          2 | `tests/unit/service/weather-forecast-service.test.js` |
|          1 | `tests/unit/service/profile-service.test.js`          |
|          1 | `tests/unit/repo/firebase-profile-server.test.js`     |

**Baseline drain after S7**：18.7 14 → 0。
**預估**：2 day。

**Risk flags**：

- `strava-callback-route` / `strava-webhook-route` 涉及 fetch 邊界 → 高機率 Option A
- `weather-api-route` 走 server route → 第三方天氣 fetch → 邊界外 fetch mock 屬合規
- `useStravaConnection` 順手清同檔 setTimeout（audit P1-5）

---

### Session 規模對照表

| S        | 領域                                              |     檔 | violations | Baseline 動作                                                       | 預估          |
| -------- | ------------------------------------------------- | -----: | ---------: | ------------------------------------------------------------------- | ------------- |
| **S0**   | ESLint 規則擴展 + 修 selector bug + baseline 收集 |      — |          — | 18.6 47→55 / 18.7 0→14 / 18.8 0→5                                   | 1 day         |
| S1       | posts/ heavy（pilot）                             |      5 |         10 | 18.6: 55 → 50                                                       | 2-3 day       |
| S2       | posts rest + comments + dashboard + navbar        |     14 |         15 | 18.6: 50 → 36                                                       | 1.5-2 day     |
| S3       | notifications/                                    |      9 |         32 | 18.6: 36 → 27                                                       | 2.5 day       |
| S4       | events + profile                                  |      6 |          8 | 18.6: 27 → 21                                                       | 1-1.5 day     |
| S5       | strava + weather + toast                          |     10 |         13 | 18.6: 21 → 11                                                       | 1.5 day       |
| **S6**   | unit/lib notification batch                       |      5 |         11 | 18.8: 5 → 0                                                         | 1.5 day       |
| **S7**   | unit/runtime + api + 散落                         |     14 |         17 | 18.7: 14 → 0                                                        | 2 day         |
| **合計** | —                                                 | **63** |    **106** | 三個 block mock-boundary 部分清空（18.6 剩 ~11 flaky-only overlap） | **13-16 day** |

---

## 6. 共通約束（Non-Negotiable across all sessions）

1. **不動 `src/`** — 任何「為了測好寫所以改 src」的傾向 → 立刻 stop，flag Option A
2. **規則 selector 動法**：S0 階段擴 selector 含 `@/lib` 並排除 providers；S1-S7 階段**不**動 selector
3. **不用 `eslint-disable` inline 豁免** — 改寫成功才能拿掉 baseline
4. **每 session 一個 PR** — review 負擔均勻
5. **PR template「Baseline tracking」必勾**（含 commit message `Baseline change: <block>: X → X-1` 紀錄）
6. **coverage 不下降** — `npm run test:coverage` 比 base/HEAD（理論升或持平）
7. **保留合規 mock**：
   - `@/config/client/firebase-client`、`@/config/server/*` 47 處（SDK init）
   - `@/runtime/providers/*` 22 處（React 邊界）
   - `@/contexts/AuthContext` 6 處（同上）
   - `@/data/geo/*` 6 處（純資料）
   - `next/navigation`、`next/link`（Next.js 邊界）
   - `firebase/firestore`、`firebase/auth`、`firebase/app`、`firebase-admin/*`（SDK 邊界）
   - `leaflet`、`react-leaflet`（jsdom 不支援的第三方）
8. **不清灰色 components/app mock**（46 處）— 個案發現是真錯 → flag 028+ spec
9. **flaky 違規處理規則**：
   - 改寫該檔時順手清同檔 `toHaveBeenCalledTimes` → `toHaveBeenLastCalledWith` / `toHaveBeenNthCalledWith` / `waitFor`
   - `setTimeout-Promise` → `waitFor(...)` 或 `vi.useFakeTimers` + `vi.runAllTimersAsync`
   - 該檔仍有 flaky 違規未清 → 從本 spec 對應 block ignores 移除後**必須**在 18.5 ignores 加入
10. **不混入 P1/P2/P3 工作** — 順手清 flaky（同檔）OK，跨檔 flaky 不做、補測不做
11. **memory 對齊**：
    - `feedback_mock_discipline.md` — 邊界內 mock 是陷阱，本 spec 完整還這筆債
    - `feedback_test_writing_gotchas.md` — toHaveBeenCalledTimes 易 flaky；改寫時順手清
    - `feedback_audit_deliverable_only.md` — 本 spec 把 audit P0-1 deliverable 轉成行動，不擴張至 P1+

---

## 7. 驗證指令

### Per-檔（最常跑）

```bash
npx vitest run <file>
npx eslint <file>

# 確認該檔違規歸零（統一 selector）
grep -cE "vi\.mock\(['\"]@/(lib|repo|service|runtime)/" <file> | grep -v "@/runtime/providers/"
# Expected: 0
```

### Per-session（PR 前）

```bash
npm run test:branch
npm run lint:branch
npm run type-check:branch

# coverage 對比
git -C <main-worktree> npm run test:coverage  # base
npm run test:coverage                          # HEAD
```

### 全 spec 進度

```bash
# 4 批 + 散落剩餘違規處數（統一 selector，扣 providers）
total_count() {
  grep -rEn "vi\.mock\(['\"]@/(lib|repo|service|runtime)/" "$1" --include="*.test.*" 2>/dev/null \
    | grep -v "@/runtime/providers/" | wc -l
}
echo "第一批 integration:    $(total_count tests/integration)"
echo "第二批 unit/runtime:   $(total_count tests/unit/runtime)"
echo "第三批 unit/lib:       $(total_count tests/unit/lib)"
echo "第四批 unit/api:       $(total_count tests/unit/api)"
echo "散落:                 $(total_count tests/unit/service && total_count tests/unit/repo)"
# Spec start: 78 / 7 / 11 / 6 / 4
# Spec end:   0  / 0 / 0  / 0 / 0
```

---

## 8. Cross-session pattern reference（S1 pilot 後填）

> S1 pilot 完成後把 setup pattern 寫進 handoff.md。S2-S7 開工前 read。

預期記錄到 handoff：

- `vi.hoisted()` 標準骨架
- `firebase/firestore` 完整 mock export 清單
- `firebase-admin/firestore` mock 清單（S6 / S7 unit/api 用）
- mockResolvedValue Firestore document 結構範例
- runTransaction / writeBatch stub 寫法
- Option A 個案判定條件

---

## 9. Out of scope 細節

| 項目                                             | 屬 audit 哪段 | 預期後續處理                                         |
| ------------------------------------------------ | ------------- | ---------------------------------------------------- |
| 81 處邊界外 mock                                 | audit L94-96  | 永久保留                                             |
| 46 處灰色 components/app mock                    | audit 沒明列  | 028+ 個案決策                                        |
| 26 hooks 補測（renderHook）                      | P1-1          | 多 sprint 獨立 spec                                  |
| auth-service / AuthProvider 直測                 | P1-2          | 獨立 spec                                            |
| Strava OAuth callback 真 integration / E2E       | P1-3          | 獨立 spec（含 nock）；S5 / S7 fetch 邊界 case 移交此 |
| 109 處 toHaveBeenCalledTimes 跨檔批次清          | P1-4          | flaky cleanup spec                                   |
| setTimeout-Promise 跨檔批次清                    | P1-5          | 同上                                                 |
| S8 / S9 升級（warn → error / per-dir threshold） | audit §12.7   | 本 spec 完成後觸發                                   |

---

## 10. Done definition

- [ ] 8 個 PR 全部 merged（S0-S7）
- [ ] `eslint.config.mjs` 三個 block mock-boundary 違規部分清空：
  - block 18.6（integration）: 55 → ~11（剩 flaky-only overlap）
  - block 18.7（unit/runtime + api + service + repo）: 14 → 0
  - block 18.8（unit/lib）: 5 → 0
- [ ] §7「全 spec 進度」5 條 grep 全回 0
- [ ] `npm run test:coverage` 整體覆蓋率 ≥ S0 baseline（不下降）
- [ ] handoff.md 內「Setup pattern reference」有可複用樣板
- [ ] Option A 個案 → handoff.md 列舉並指向 028+ spec

---

## 11. 與 audit / 026 spec 的銜接

```
audit P0-1 (L77-111)  全 4 批（106 處邊界內違規）
    │
    ├── 第一批規則建立 → spec 026 S6 (PR #25)
    │                    selector @/(repo|service|runtime)/，僅 integration
    │                    （selector 漏 @/lib + 誤殺 providers — 設計 bug）
    │
    ├── 規則 enforce 機制 → spec 026 S7 (PR #27)
    │
    └── 全批 baseline drain → spec 027（本 spec）
                              S0: 修 selector bug → @/(lib|repo|service|runtime)/ 扣 providers
                                  擴規則涵蓋全 4 批（new block 18.7 / 18.8）
                                  收集 baseline（18.6 47→55 / 18.7 14 / 18.8 5）
                              S1-S5: 第一批 44 檔 / 78 violations
                              S6: 第三批 5 檔 / 11 violations
                              S7: 第二+四+散落 14 檔 / 17 violations
                              │
                              └── S8 觸發（warn → error 升級）
                                  ESLint rule 對全 4 批生效
                                  audit-mock-boundary.sh exit 0 → exit 1
                                  (灰色 46 + flaky 109 部分仍待後續 spec)
```
