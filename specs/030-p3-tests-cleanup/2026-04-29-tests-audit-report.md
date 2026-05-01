# tests/ 整體健檢報告

**日期**：2026-04-29
**執行 commit base**：`8782728`（main 最新，含 spec 024 testing-library cleanup merged）
**研究方法**：3 個 Explore agent 平行掃描 + 關鍵指標 grep 驗證 + Vitest/Playwright config 直讀
**範圍**：頂層 `tests/` 134 支測試（unit/integration/server/e2e）+ 配置層（Vitest / Playwright / Husky / ESLint testing-lib）+ 6 層架構的測試對位
**狀態**：**Audit-only**，本次不修補任何 src/ 或 tests/。修補在用戶逐條核可後分批 PR。

> 與既有 3 份報告的關係：
>
> - `2026-04-20-mock-audit-report.md` 只盤 `src/lib/`（已完成 Phase 1，lib coverage 升至 83.35%）
> - `2026-04-26-tests-directory-migration.md` 是頂層 `tests/` 目錄重組計畫
> - `2026-04-28-eslint-testing-library-cleanup-plan.md` 是 spec 024 lint 清理（PR #23 已 merged）
> - **本報告**：跨 6 層的 tests/ 整體健檢，把上述三份的「下游」風險用具體 file:line 點出來，含 Firestore Rules 0 測試、coverage include 漏 3 層、runtime hooks 測試對位 7.7%、233 處邊界內 mock 等。

---

## TL;DR — 30 秒版

**最痛的兩件事**：

1. **「測試通過但 coverage 不存在」** — `vitest.config.mjs:22` 的 coverage `include` 只含 `{service,repo,runtime,lib,config}`，**漏掉 `app` / `components` / `ui` 三層**。等於 87 個檔案（55 components + 17 ui + 15 app）的測試品質完全沒被 coverage gate 監控，`docs/QUALITY_SCORE.md` 顯示的 70.6% 不包含這三層。
2. **「測試通過但實際沒測」** — `tests/` 下有 **233 處 `vi.mock('@/...')`**，大量發生在 integration 與 unit/runtime 測試，把自家 service / repo / runtime 當邊界 mock 掉。Integration 測試 mock 自家 use-case，整合價值歸零。

**最危險的兩件事**：

3. **Firestore Rules 0 個 unit test** — `firestore.rules` 260 行的安全規則沒有 `@firebase/rules-unit-testing` 測試。`tests/server/` 只有 2 支 admin/profile 測試，**collectionGroup query、cascade delete、`recipientUid` spoofing 全沒驗**。
4. **Server test include 硬編碼吞測試** — `vitest.config.mjs:63` 寫死 `'tests/server/g8-server-coverage/**/*.test.js'`，未來放在 `tests/server/rules/` / `api/` / `functions/` 的測試會被靜默忽略，CI 不會報錯。

## TL;DR — 3 分鐘版

| 級別            | 數量 | 主題                                                                                                                                      |
| --------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 Critical** | 4    | Mock 紀律、Firestore Rules 0 測試、server include 硬編碼、coverage include 漏 3 層                                                        |
| **P1 High**     | 5    | runtime hooks 7.7% 測試對位、auth-service 0 測、Strava OAuth callback 0 測、109 處 `toHaveBeenCalledTimes`、硬置 `setTimeout`             |
| **P2 Medium**   | 5    | `npm test` 沒 default project、pre-commit 不跑 server、Firebase project ID 不一致、threshold 70 暫降值無時間表、Playwright timeout 不對稱 |
| **P3 Low**      | 4    | data-testid 過量、spy 手動 restore、mock factory 分散、024 PR push 收尾                                                                   |

**建議第一刀**（最小 PR 換最大訊號）：修 P0-3（1 行：把 server include 改成 `tests/server/**/*.test.js`），讓 P0-2 firestore rules 測試骨架放進去能被執行。

---

## 1. 統計快照

| 指標                                                      |                           實測值 | 數據來源                                                   |
| --------------------------------------------------------- | -------------------------------: | ---------------------------------------------------------- |
| 測試檔總數（`*.test.*` + `*.spec.*`）                     |                          **134** | `find tests -name "*.test.*" -o -name "*.spec.*" \| wc -l` |
| 用 `vi.mock(...)` 的測試檔                                |                           **97** | `grep -l "vi.mock"`                                        |
| **內部模組 mock `vi.mock('@/...')` 出現次數**             |                          **233** | `grep -c "vi.mock(['\"]@/"`                                |
| `toHaveBeenCalledTimes` 出現次數                          |                          **109** | `grep -c`                                                  |
| `data-testid` 在測試檔中出現次數                          |                           **50** | agent 報告                                                 |
| `tests/server/` 子目錄                                    | **1**（僅 `g8-server-coverage`） | `ls tests/server/`                                         |
| Firestore Rules 測試（用 `@firebase/rules-unit-testing`） |                            **0** | `grep -r "rules-unit-testing" tests` 無結果                |
| Coverage `lines` threshold                                |  **70**（標註為 phase 1 暫降值） | `vitest.config.mjs:36`                                     |
| Coverage `include` 涵蓋層數                               |    **5**（漏 app/components/ui） | `vitest.config.mjs:22`                                     |

`src/` 各層檔案數（驗證 agent 報告 vs 實測）：

| 層                               |   實測 | agent 報告 | 落差                                   |
| -------------------------------- | -----: | ---------: | -------------------------------------- |
| `src/types/`                     |      2 |          2 | ✅                                     |
| `src/config/`                    |      6 |          6 | ✅                                     |
| `src/repo/`                      |     19 |         19 | ✅                                     |
| `src/service/`                   |     15 |         15 | ✅                                     |
| `src/runtime/` 全部              |     41 |         42 | ⚠️ 接近                                |
| `src/runtime/hooks/` 細分        | **26** |         42 | ❌ agent 把「runtime 全部」當「hooks」 |
| `src/components/`                | **55** |         90 | ❌ agent 高估近兩倍                    |
| `src/ui/`                        | **17** |         21 | ⚠️ 接近                                |
| `src/app/` (page.jsx + route.js) |     15 |         15 | ✅                                     |

**註**：agent 對 components / runtime hooks 的數字有誤差，**修補時請用實測值**。本報告其餘地方一律以實測為準。

---

## 2. P0 — Critical（必修，blocker）

### P0-1. Mock 紀律失守：integration 測試 mock 掉 use-case 層

**現象**：233 處 `vi.mock('@/...')`。代表性樣本（用 grep head 40 的真實輸出，非估計）：

| 類型                                           | 樣本（file:line）                                                   | 風險                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| integration 測試 mock 自家 use-case            | `tests/integration/notifications/notification-error.test.jsx:73-89` | 4 個 use-case 全 mock，整合價值歸零                                                         |
| integration 測試 mock components 旁的 use-case | `tests/integration/posts/PostFeed.test.jsx`（3 處 `@/`）            | components → use-cases 合約沒驗                                                             |
| unit/runtime 跨層 mock                         | `tests/unit/runtime/useStravaConnection.test.jsx:16, 27, 32`        | 同時 mock `firebase-client` + `firebase-users` + `firebase-strava-repo`                     |
| unit/runtime mock 自家 service                 | `tests/unit/runtime/profile-events-runtime.test.js:25`              | service 層被當邊界                                                                          |
| unit/runtime mock 自家 repo                    | `tests/unit/runtime/notification-use-cases.test.js:13, 25`          | repo 層被當邊界                                                                             |
| unit/runtime mock 自家 repo                    | `tests/unit/runtime/post-use-cases.test.js:21`                      | repo 層被當邊界                                                                             |
| server route 測試 mock 自家 use-case           | `tests/unit/api/strava-callback-route.test.js:8`                    | route → use-case 合約沒驗                                                                   |
| lib 測試 mock 自家 service                     | `tests/unit/lib/notify-post-comment-reply.test.js:26-27`            | `@/lib/firebase-events` + `@/service/notification-service` 被 mock                          |
| lib 測試 mock 自家 service + repo              | `tests/unit/lib/notify-event-new-comment.test.js:25-39`             | `firebase-events-repo` + `firebase-notifications-repo` + `notification-service` 三條全 mock |
| api 測試 mock 自家 server use-case             | `tests/unit/api/sync-token-revocation.test.js:16`                   | `strava-server-use-cases` 被 mock                                                           |

**比較合理的 mock**（邊界外，可保留）：

- `vi.mock('@/config/client/firebase-client', ...)` — Firebase SDK init，是邊界外。約 50%+ 的 233 處屬此類。
- `vi.mock('firebase/firestore', ...)` — 不在 233 計數內，是 SDK 層 mock。

**根因**：memory `feedback_mock_discipline.md` 已記錄此原則，但**沒有 ESLint rule 或 lint script 在 PR 階段攔截**。spec 024 已上 testing-library 規則，但沒上 mock-boundary 規則。

**修補步驟**：

1. **短期防新增**：寫一條 ESLint custom rule 或 `scripts/audit-internal-mocks.sh`，在 PR 階段 ban：
   - `tests/integration/**` 中 `vi.mock('@/{repo,service,runtime}/...')`
   - `tests/unit/api/**` 中 `vi.mock('@/runtime/server/...')`
2. **中期清舊**：把 233 處分類成（a）邊界外 OK、（b）邊界內可重構、（c）TBD，逐層改寫。建議順序：
   - 第一批：integration 測試（最違反 spirit），預估 30-50 處
   - 第二批：unit/runtime 中 `mock @/service` + `mock @/repo`（破壞 contract test）
   - 第三批：unit/lib 內 cross-lib mock（如 `firebase-events` 被 `notify-*` 系列 mock）
3. **驗證**：每批 PR 跑 `npm run test:coverage`，確認 coverage 數字**不下降**（因為移除 mock 後實際執行真實程式碼，coverage 應該升或持平）。

**估時**：第一批 1 個 sprint，整體 3-4 個 sprint。

---

### P0-2. Firestore Rules 完全沒有 unit test

**現象**：`firestore.rules` 共 260 行，定義 6 大集合（users / posts / comments / events / notifications / strava）+ subcollection 的存取控制。`grep -r "rules-unit-testing" tests` **無任何結果**。

唯一沾邊的 `tests/unit/service/event-service-rules.test.js` 只測 service 層的業務邏輯（deadline、seat count），完全不驗 Firestore Rules 本身。

**高風險未驗證規則**（agent 報告，已驗證 `firestore.rules` 行號存在）：

| 規則範圍                                           | 行號    | 風險                                               |
| -------------------------------------------------- | ------- | -------------------------------------------------- |
| `posts/{postId}/likes/{uid}` collectionGroup query | 80-84   | collectionGroup 規則出錯會洩漏其他用戶的 like 紀錄 |
| Strava tokens / connections read-only              | 113-123 | OAuth tokens 寫入規則錯誤 → 帳號被劫持             |
| event `maxParticipants` + `remainingSeats` 一致性  | 151-166 | 競賽超賣                                           |
| events participants cascade delete                 | 180-183 | 殘留 participants 造成資料不一致                   |
| notification `recipientUid` 驗證                   | 248-254 | 惡意用戶可偽造 recipientUid 推送通知               |

**修補步驟**：

1. **依賴 P0-3 修好**（不修 server include glob，新測試會被靜默忽略）。
2. 安裝 `@firebase/rules-unit-testing`（`npm i -D @firebase/rules-unit-testing`）。
3. 在 `tests/server/rules/`（用戶已決議的位置）建第一支 spec，先驗 auth gate + 跨用戶 deny path：
   - `posts.rules.test.js`：未登入 read 應拒、登入但非作者 update 應拒
   - `strava-tokens.rules.test.js`：write client 應拒（read-only）
   - `notifications.rules.test.js`：偽造 `recipientUid` 應拒
4. 後續每改一條 rules → 強制補一支 negative path 測試（建立 PR template checkbox）。

**估時**：infra 起步 0.5 day（裝 lib + 寫第一支 spec 證明 emulator chain 通），完整 6 大集合的 happy + negative paths 約 1 週。

---

### P0-3. Server test include 硬編碼，新測試會被「靜默忽略」

**現象**：`vitest.config.mjs:63`

```js
include: ['tests/server/g8-server-coverage/**/*.test.js'],
```

放在 `tests/server/rules/` / `api/` / `functions/` 的新測試**完全不會被執行**，CI 不會報錯。`tests/server/` 目前只有 `g8-server-coverage` 子目錄是巧合，不是設計。

**修補步驟**：

1 行修：

```diff
- include: ['tests/server/g8-server-coverage/**/*.test.js'],
+ include: ['tests/server/**/*.test.js'],
```

**驗證**：在 `tests/server/_smoke/sanity.test.js` 新增 1 支 dummy `expect(1).toBe(1)`，跑 `npm run test:server`，確認 vitest 抓到 3 支（原 2 支 g8 + 1 支 dummy），刪掉 dummy 後 PR。

**估時**：30 分鐘（含一支 sanity test 的 PR cycle）。**建議當第一刀。**

---

### P0-4. Coverage `include` 漏了 `src/app/**`、`src/components/**`、`src/ui/**`

**現象**：`vitest.config.mjs:22`

```js
include: ['src/{service,repo,runtime,lib,config}/**'],
```

代表（用實測檔案數）：

- **55 個** `src/components/**` 檔案 → coverage 報告**不顯示**（不是 0%，是不存在）
- **17 個** `src/ui/**` screen components → 同上
- **15 個** `src/app/**` pages/routes → 同上

`docs/QUALITY_SCORE.md` 顯示的 70.6% line coverage **不包含**這三層。

**修補步驟**（分階段，避免一次性 gate 失守）：

1. 先把 `src/ui/` 加進 include（17 檔，最少），跑 baseline 看實際數字（預期極低，因為只有少量 RTL 整合測試會跑到）。
2. 把 threshold 從單一 `lines: 70` 拆成 per-directory：

   ```js
   thresholds: {
     'src/service/**': { lines: 80 },
     'src/repo/**':    { lines: 75 },
     'src/runtime/**': { lines: 60 },
     'src/lib/**':     { lines: 80 },  // 已在 P1 達 83%
     'src/config/**':  { lines: 70 },
     'src/ui/**':      { lines: 30 },  // 起步值
     'src/components/**': { lines: 30 },
     'src/app/**':     { lines: 20 },  // 多數靠 E2E，不靠 unit coverage
   },
   ```

3. 每個 sprint 把 `ui` / `components` / `app` 的 threshold 各 +5 直到 60-70。
4. **不要把 `src/app/**` 強拉到 70+\*\*：app pages 多數是薄殼，由 E2E 覆蓋更合理。

**估時**：1 個 PR 改 config（含 baseline 跑一次），threshold 慢慢往上是長期工。

---

## 3. P1 — High（這個 sprint 內）

### P1-1. Runtime hooks 測試對位 7.7%（26 hooks 中 2 個有專屬測試）

**現象**：`src/runtime/hooks/` 共 **26 支 hook 檔**（實測），但 `tests/unit/runtime/` 只有 2 支對應到單一 hook 名稱：

- `useStravaActivities.test.jsx`
- `useStravaConnection.test.jsx`

其他 24 支 hook 大部分**沒有 hook-level 單元測試**，只能透過 page-level integration 測試間接觸到（覆蓋面有限）。

**26 hooks 完整清單**（已驗證）：

```
useCommentMutations.js
useComments.js
useDashboardTab.js
useDashboardTabsRuntime.js
useEventDetailMutations.js
useEventDetailParticipation.js
useEventDetailRuntime.js
useEventEditForm.js
useEventMutations.js
useEventParticipation.js
useEventsFilter.js
useEventsPageRuntime.js
useMemberPageRuntime.js          ← agent 標 0%
usePostComments.js
usePostDetailRuntime.js
usePostsPageRuntime.js
useProfileEventsRuntime.js
useProfileRuntime.js              ← agent 標 0%
useRunCalendar.js                 ← agent 標 0%
useRunsPageRuntime.js             ← agent 標 0%
useStravaActivities.js            ← 有測試
useStravaCallbackRuntime.js       ← agent 標 0%（critical auth flow）
useStravaConnection.js            ← 有測試
useStravaSync.js
useWeatherFavorites.js            ← agent 標 0%
useWeatherPageRuntime.js          ← agent 標 0%（最大檔，113 行）
```

**修補步驟**：

1. 用 `@testing-library/react` 的 `renderHook` 補測。
2. **邊界 mock 設在 firebase/firestore + fetch 層**（OK），**不要 mock 自家 service**（避免重蹈 P0-1）。
3. 優先順序：
   - `useStravaCallbackRuntime` — auth 路徑，與 P1-3 連動
   - `useWeatherPageRuntime` + `useWeatherFavorites` — 大檔且都 0%
   - `useEventDetailParticipation` — 有 41% 覆蓋但 edge case 缺
   - 其他依 page 重要性排
4. 節奏：每週 2-3 hooks 補測，6-8 週清光。

**估時**：每支 hook 1-3 hours。

---

### P1-2. `auth-service` 0% 覆蓋

**現象**：`src/service/auth-service.js`（login/logout 核心）+ `src/runtime/providers/AuthProvider.jsx` 都沒有直接測試。Auth 是所有 feature 的入口。

**修補步驟**：寫 service-level 單元測試（用 firebase emulator 或 minimal mock），加 `AuthProvider` 的 RTL 測試覆蓋 sign-in / sign-out / 持久化。

**估時**：1-2 day。

---

### P1-3. Strava OAuth callback 完全沒測

**現象**：

- `src/app/runs/callback/page.jsx` — **0 E2E**
- `src/app/api/strava/callback/route.js` — 唯一測試 `tests/unit/api/strava-callback-route.test.js` **mock 了自家 use-case**（見 P0-1 樣本第 7 條），等於沒測 route。

OAuth callback 是 token 進來的關鍵路徑，錯誤等於外洩。

**修補步驟**：

1. 補一支不 mock use-case 的 route 整合測試（Firebase emulator + nock 或 fetch stub 模擬 Strava token endpoint）。
2. 補一支 E2E：模擬使用者點 connect → mock Strava OAuth → 驗 token 入庫 → 驗 UI 切換。

**估時**：3 day（含 nock fixture）。

---

### P1-4. `toHaveBeenCalledTimes(N)` 109 處 — flaky 風險

**現象**：109 處 `toHaveBeenCalledTimes(N)`，例如 `tests/unit/runtime/useStravaActivities.test.jsx:268`。memory `feedback_test_writing_gotchas.md` 已記錄此 anti-pattern：非同步時序改變易 flaky。

**修補步驟**：

1. **新增 ban**：寫 ESLint rule 或 grep gate 警告新增使用。
2. **舊有清理**：grep 全列表後分批改：
   - 改 `toHaveBeenCalled()`（只驗呼叫過）
   - 改 `toHaveBeenLastCalledWith(...)`（驗最後一次參數）
   - 改 `toHaveBeenNthCalledWith(n, ...)`（驗特定第 n 次）

**估時**：ESLint rule 0.5 day，全清舊有 1-2 sprint。

---

### P1-5. 硬置 `setTimeout` 等待

**現象**：`tests/unit/runtime/useStravaConnection.test.jsx:75-96` 用 `await new Promise(r => setTimeout(r, 10))` 配 `act()`。CI 機器慢時必 flaky。

**修補步驟**：

1. `grep -rn "setTimeout.*Promise\|new Promise.*setTimeout" tests --include="*.test.*"` 找全部。
2. 改用 `waitFor(() => expect(...))` 或 `vi.useFakeTimers()` + `vi.runAllTimersAsync()`。

**估時**：grep + 評估 1 hour，全改 1-2 day。

---

## 4. P2 — Medium（下次碰到時順手修）

### P2-1. `npm run test` 沒有 default project

`package.json:13`：`"test": "vitest"` 沒指定 `--project`。Vitest 看到兩個 project（browser + server）但 `defaultProject` 未設。本地直接 `npm test` 會嘗試跑 server，缺 Firebase Emulator 必錯。

**修補**：`"test": "vitest --project=browser"` 或 vitest config 加 `defaultProject: 'browser'`。

### P2-2. Pre-commit 不跑 server test

`.husky/pre-commit` 只 `vitest --project=browser`，server 變更只能等 CI 攔。設計合理（本地拉 emulator 成本高）。

**已驗證 `.github/workflows/ci.yml`（2026-04-29）**：只有兩個 job——`ci` 和 `e2e`。`ci` job 的 step `Unit & integration tests (with coverage)` 跑 `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --coverage"`，會同時執行 browser + server 兩個 project，**所以 server tests 在 CI 是有跑的**。

**但**：vitest server include 仍是 `tests/server/g8-server-coverage/**/*.test.js`（P0-3）—— CI 跑了，但 vitest 把放在其他 server 子目錄的新測試靜默濾掉。CI 不會報錯。這是 P0-3 的延伸，不是 P2-2 自己的問題。

**Framing 修正**：GitHub branch protection 的 required check 只能綁 **job 名**（無法綁 step），所以「`test:server` 是不是 required check」這個問題不成立。要設 required 的單位是 `ci` job 而非 `test:server` step。

**TODO**：去 GitHub branch protection 設定確認 `ci` 為 required check（5 min UI 操作）。

### P2-3. Firebase project ID 命名不一致（待 verify）

agent 報告：

- `package.json:15-17` `--project=demo-test`
- `scripts/run-all-e2e.sh:167` `--project dive-into-run`（無 `=`）
- `scripts/test-e2e-branch.sh:271` `--project=demo-test`

風險：emulator 環境隔離可能失效。建議統一為 `demo-test`。**✅ 已驗證 agent 數字正確（2026-04-29）**：`scripts/run-all-e2e.sh:167` 確為 `--project dive-into-run`（且 L235-236 URL 也用 `dive-into-run`），`package.json:15-17` 與 `scripts/test-e2e-branch.sh:271` 為 `demo-test`，project ID 確實混用。

### P2-4. Coverage threshold 70 是「Phase 1 暫降」沒有時間表

`vitest.config.mjs:33-37` 註解說會分階段提到 80→90→95，但無 milestone。建議寫進 issue 並設定 review cadence（每月 +5）。**P0-4 拆 per-directory threshold 後，這條自動消解一半**。

### P2-5. Playwright timeout 不對稱

- `playwright.config.mjs` 無 `timeout` 欄位（用預設 30s）
- `playwright.emulator.config.mjs:63` `timeout: 60000`，但無 `expect: { timeout }`

建議：把 timeout 抽到 shared config，或補 `expect: { timeout: 10_000 }` 對齊。

---

## 5. P3 — Low（清乾淨用的）

- **`data-testid` 過量** 50 處。代表案例：`tests/unit/runtime/useStravaActivities.test.jsx:43-44, 150, 165, 225`。部分可改 `getByRole`、`getByLabelText`。
- **`vi.spyOn(console, 'error')` 手動 restore**：`tests/unit/lib/firebase-posts-comments-likes.test.js:480, 495, 708` 散在三處，應集中到 beforeEach/afterEach。
- **Mock factory 分散**：每個測試檔自己 `makeEvents()`、`makeUser()`、`makePost()`。可提取到 `tests/_helpers/factories.js`。
- **spec 024 已 merged**：根據 git log `8782728 Merge pull request #23 from victorlovescoding/024-eslint-testing-lib-cleanup`，testing-library 規則已上線。但 `specs/024-*/handoff.md` / `tasks.md` 還顯示為 modified（uncommitted），代表 handoff 文件 post-merge sync 沒收尾。**這條從 P3 升 P2 也合理**。

---

## 6. 修補的「不要怎麼做」

- **不要一次性把 233 處 `vi.mock('@/...')` 全改掉**。會是上千行 diff，review 不可能仔細，反而引入 regression。要分批：先 integration 層 → 再 service mock → 最後 repo mock；每批一個 PR。
- **不要為了拉高 coverage 數字而補 snapshot test**。UI 層補 RTL 行為測試比補 snapshot 更值得。snapshot 只證明 render 沒當掉，不證明邏輯對。
- **不要在 P0 完成前修 P3**。P3 是清潔工作，P0 不修等於房子漏水。
- **不要把 mock-boundary ESLint rule 設為 `error` 直接擋 main**。先 `warn` 跑兩週看 false positive，再升 `error`（spec 024 testing-library 走過這流程）。
- **不要用 coverage 數字當唯一品質指標**。覆蓋率 100% 但全 mock 內部模組 = 假象。

---

## 7. 建議的執行順序

| 階段 | 工作                                                                                          | 規模       | 連動                 |
| ---- | --------------------------------------------------------------------------------------------- | ---------- | -------------------- |
| 1    | **P0-3**（server include glob 1 行）+ smoke test 驗證                                         | 30 min     | unblock P0-2         |
| 2    | **P2-1**（test default project）+ **P2-3**（project ID 統一）+ **P2-5**（Playwright timeout） | 1 day      | quality of life      |
| 3    | **P0-4**（coverage include 加 ui/components/app + per-dir threshold）                         | 1 PR       | 數字才會誠實         |
| 4    | **P0-2** firestore rules 測試骨架（infra + 第一支 spec）                                      | 0.5 day    | security 防線起步    |
| 5    | **P0-1** 寫 mock-boundary lint rule（先 warn 擋新增）+ audit 腳本分類 233 處                  | 2-3 day    | 防新增、清舊有節奏化 |
| 6    | **P1-2**（auth-service）+ **P1-3**（Strava callback 整合測試 + E2E）                          | 1 sprint   | critical path        |
| 7    | **P1-1** runtime hooks 補測（每週 2-3 個）                                                    | 6-8 週     | 持續                 |
| 8    | **P1-4** + **P1-5**（flaky pattern 批次清）                                                   | 1-2 sprint | 持續                 |
| 9    | **P0-1** 中期清舊（按層分批）                                                                 | 3-4 sprint | 收尾                 |
| 10   | **P3** 清潔工作（`data-testid` / spy / factory）                                              | 順手做     | 不阻塞               |

---

## 8. 驗證指令

### 復現本報告的核心數字

```bash
cd /Users/chentzuyu/Desktop/dive-into-run

# 134 個測試檔
find tests -name "*.test.*" -o -name "*.spec.*" | wc -l

# 233 個內部模組 mock
grep -rn "vi.mock(['\"]@/" tests --include="*.test.*" | wc -l

# 109 處 toHaveBeenCalledTimes
grep -rn "toHaveBeenCalledTimes" tests --include="*.test.*" | wc -l

# 26 hooks
ls src/runtime/hooks/ | wc -l

# Firestore rules 0 測試
grep -rn "rules-unit-testing\|firestore.rules" tests
# Expected: 無輸出

# server include 硬編碼
sed -n '63p' vitest.config.mjs
# Expected: include: ['tests/server/g8-server-coverage/**/*.test.js'],

# coverage include 範圍
sed -n '22p' vitest.config.mjs
# Expected: include: ['src/{service,repo,runtime,lib,config}/**'],

# 233 處按模組路徑分佈（找最值得清的目標）
grep -rn "vi.mock(['\"]@/" tests --include="*.test.*" \
  | awk -F'@/' '{print $2}' | awk -F"['\"]" '{print $1}' \
  | sort | uniq -c | sort -rn | head -30
```

### 跑 baseline coverage（會跑 emulator）

```bash
npm run test:coverage
# 確認 lines: 70+ 通過、html report 與 docs/QUALITY_SCORE.md 對得起來
# 然後改 vitest.config.mjs:22 加 src/ui/，再跑一次看 ui 真實覆蓋率（預期極低）
```

---

## 9. 關鍵檔案（修補時的進入點）

| 檔案                                                       | 角色                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `vitest.config.mjs:22, 36, 63`                             | coverage include / threshold / server include                   |
| `package.json:13-17`                                       | test scripts                                                    |
| `.husky/pre-commit`                                        | pre-commit gate                                                 |
| `firestore.rules`                                          | 260 行的安全規則，需要 rules-unit-testing                       |
| `tests/server/g8-server-coverage/`                         | server 測試現址，未來擴成 `tests/server/{rules,api,functions}/` |
| `tests/_helpers/`                                          | mock factory 提取目的地                                         |
| `eslint.config.mjs`                                        | testing-library 規則（spec 024）+ 待加 mock-boundary 規則       |
| `docs/QUALITY_SCORE.md`                                    | per-layer 矩陣，是覆蓋率討論的真值來源                          |
| `playwright.config.mjs` / `playwright.emulator.config.mjs` | E2E 配置不對稱                                                  |

---

## 10. 開放問題（用戶決議追蹤）

| #   | 問題                                                                                                              | 狀態                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | 想先動 P0 哪一條？                                                                                                | ✅ 用戶 2026-04-29 選「先讀報告再決定」                                                        |
| 2   | P0-2 firestore rules 測試放哪？                                                                                   | ✅ `tests/server/rules/`（沿用 server 命名空間）                                               |
| 3   | P0-1 mock 重構走「ESLint ban 擋新增」還是「腳本批次掃描既有」？                                                   | ❓ 未決，建議**兩個並行**（rule 擋新增 + 腳本分類舊有）                                        |
| 4   | 報告需不需要追加實測 grep（per-module mock 分佈、setTimeout 用量）？                                              | ❓ 用戶 2026-04-29 指示「產報告就好不要動工」，本次不追加                                      |
| 5   | P0-4 per-directory threshold 的數字（service 80 / repo 75 / runtime 60 / ui 30 / components 30 / app 20）合用嗎？ | ❓ 待用戶確認後寫進 vitest.config.mjs                                                          |
| 6   | P2-3 Firebase project ID 不一致是否真的有 `--project dive-into-run`？                                             | ✅ 已驗證（2026-04-29）：`scripts/run-all-e2e.sh:167` 確認 `--project dive-into-run`，混用屬實 |
| 7   | spec 024 handoff/tasks.md 有 uncommitted 修改，是否要先收尾？                                                     | ❓ 未決                                                                                        |

---

## 11. 與既有 3 份 project-health/ 報告的銜接

```
2026-04-20-mock-audit-report.md          (Phase 1: src/lib/ mock 黑洞)
                ↓
                ↓ Phase 1 完成 → src/lib/ coverage 83.35%
                ↓ 但只覆蓋一層
                ↓
2026-04-26-tests-directory-migration.md  (測試目錄結構統一)
                ↓
                ↓ tests/ 移到頂層完成
                ↓
2026-04-28-eslint-testing-library-cleanup-plan.md  (PR #23 merged)
                ↓
                ↓ testing-library lint 規則上線
                ↓ 但 mock-boundary 規則仍缺
                ↓
2026-04-29-tests-audit-report.md  ← 本檔
                ↓
                跨 6 層健檢，列出 P0-1 ~ P3
                下一步：用戶決定先動哪一條
```

**自我提醒**：本報告完成後**不主動動工**。每條 P0/P1 的修補都需要新一輪對話 + 新 PR。

---

## 12. 執行序列：1 PR / 6 commits（Session S1-S6） — 2026-04-29 修訂

> Section 7 是「概念順序」（按 P0/P1/P2 聚類）；本節是「執行單位」(commit-level)，
> 對應 1 個 PR（branch `026-tests-audit-rules-bundle`）/ 6 個 commits。
> 完整 step-by-step 任務在 plan file `~/.claude/plans/2026-04-29-tests-audit-report-md-pr-squishy-mist.md`。

### 12.1 修訂理由（vs 原 §12 的 6 PR 多 worktree 設計）

原 §12（commit `8782728` 撰寫）規劃 Wave 1+2 = 6 PR / 5 worktree 平行。2026-04-29 修訂為 **1 PR / 6 commits**，原因：

- **原 §12 PR #1（server glob）已完成**：PR #24（commit `89827b2`）已 merged，`vitest.config.mjs:63` 從硬編碼改為 `tests/server/**/*.test.js`，§12 PR #1 不需做
- **用戶決議 1 PR 簡化 review**：6 次 review cycle vs 1 次 — 用戶選後者（單一 review、單一 merge）
- **規則 B 類強制力升級為 `error + ignores baseline`**：原 §12 設計是「先 warn 跑兩週後升 error」，修訂為「規則直接 error，違規檔進 ESLint `ignores` baseline 暫時 mute，Wave 3 從 list 拿掉檔再處理」— 強制力更強（新增違規必擋）、不擋既有 233 處
- **S5 範圍擴大**：原 §12 PR #4 只 placeholder spec（infra-only），修訂為直接補 P0-2 列的 5 條 critical paths（OAuth tokens / maxParticipants / cascade / collectionGroup / recipientUid）

### 12.2 規則總覽（11 條，按強制力分級）

#### A 類：Config（最強 — vitest threshold / CI fail-fast）

| #   | 規則                                                         | 強制機制                 | Session      |
| --- | ------------------------------------------------------------ | ------------------------ | ------------ |
| R1  | Coverage include 涵蓋全 6 層（加 `src/{ui,components,app}`） | `vitest run --coverage`  | S3           |
| R2  | Per-directory threshold（**延後 S9**）                       | vitest threshold gate    | S9（觸發型） |
| R3  | `npm test` default project = browser                         | vitest defaultProject    | S1           |
| R4  | Firebase project ID 統一 `demo-test`                         | emulator project ID 一致 | S1           |
| R5  | Playwright timeout 對稱                                      | E2E timeout 一致         | S1           |

#### B 類：ESLint（PR-time，error + ignores baseline）

| #   | 規則                                                                               | 強制機制                                                     | Session |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| R6  | Mock-boundary：`tests/integration/**` 禁 `vi.mock('@/{repo,service,runtime}/...')` | `no-restricted-syntax` error + ignores baseline（~30-50 檔） | S6      |
| R7  | Flaky pattern：禁 `toHaveBeenCalledTimes(N)` 與 `setTimeout+Promise`               | `no-restricted-syntax` error + ignores baseline（~60-80 檔） | S6      |

#### C 類：Husky / Workflow（自動化閘門）

| #   | 規則                                   | 強制機制                                    | Session |
| --- | -------------------------------------- | ------------------------------------------- | ------- |
| R8  | Pre-commit grep gate（warn-only 訊號） | `.husky/pre-commit` 加 audit script         | S4      |
| R9  | Firestore Rules paths-filter workflow  | GitHub Actions paths-filter；S7 設 required | S5      |

#### D 類：GitHub UI / Process

| #   | 規則                                                                   | 強制機制                 | Session |
| --- | ---------------------------------------------------------------------- | ------------------------ | ------- |
| R10 | Branch protection required checks（`ci`/`e2e`/`firestore-rules-gate`） | GitHub branch protection | S7      |
| R11 | PR template 含 audit checkbox                                          | 弱（review checklist）   | S2      |

**未轉成規則的 audit 項目**（Wave 3 另案，本 PR 後處理）：

- P0-1 233 處舊 mock 清理（從 S6 baseline 拿掉檔處理）
- P1-1 26 hooks 補測 / P1-2 auth-service / P1-3 Strava callback
- P1-4 / P1-5 109 處舊 flaky 清理
- P3 data-testid / spy / factory 清潔

### 12.3 Quick Reference

| 項目              | 值                                                                 |
| ----------------- | ------------------------------------------------------------------ |
| Branch            | `026-tests-audit-rules-bundle`                                     |
| Specs folder      | `specs/026-tests-audit-rules-bundle/`（用戶後續另起 session 建立） |
| Base commit       | main HEAD（撰寫時為 `8fe1eb9`）                                    |
| PR target         | 1 PR（合併 S1-S6）                                                 |
| Estimated PR diff | ~900-1000 行                                                       |

### 12.4 Session Progress Board

| #   | 標題                                                          | Status         | 規模                   | 依賴                     |
| --- | ------------------------------------------------------------- | -------------- | ---------------------- | ------------------------ |
| S1  | `chore(test): align config defaults`                          | ⏳ Not started | <100 行                | 無                       |
| S2  | `chore(github): add PR template`                              | ⏳ Not started | <50 行                 | S1                       |
| S3  | `chore(coverage): include 3 layers + baseline`                | ⏳ Not started | <50 行 + baseline      | S2                       |
| S4  | `chore(precommit): mock-boundary + flaky grep gates`          | ⏳ Not started | ~100 行                | S3                       |
| S5  | `test(rules): firestore rules infra + 5 critical paths`       | ⏳ Not started | ~600 行                | S4                       |
| S6  | `chore(eslint): mock-boundary + flaky rules (error+baseline)` | ⏳ Not started | ~80 行 + baseline list | S5                       |
| S7  | GitHub UI: branch protection required checks                  | ⏸ Post-merge   | 5 min UI               | PR merged                |
| S8  | ESLint warn → error 升級（觸發型）                            | ⏸ Wave 3 後    | TBD                    | Wave 3 mock cleanup 完成 |
| S9  | Per-directory threshold（觸發型）                             | ⏸ Wave 3 後    | TBD                    | Wave 3 補測完成          |

> 每完成一個 session：對應 row Status → ✅ Done、commit hash 加在標題後。

### 12.5 Session 摘要（每 session 一段）

#### S1: align config defaults

- **規則**: R3 + R4 + R5（npm test default project / Firebase project ID 統一 / Playwright timeout）
- **改檔**: `vitest.config.mjs`（加 `defaultProject: 'browser'`）、`scripts/run-all-e2e.sh:167`（`dive-into-run` → `demo-test`）、`playwright.config.mjs`（加 `timeout` + `expect.timeout`）、`playwright.emulator.config.mjs`（補 `expect.timeout`）
- **對應 audit**: P2-1 + P2-3 + P2-5
- **Verification**: `npm test` 應只跑 browser；`bash scripts/run-all-e2e.sh` 應用 demo-test

#### S2: PR template

- **規則**: R11
- **改檔**: `.github/pull_request_template.md`（新）含 audit checkbox（mock-boundary / flaky / firestore rules / coverage / baseline 變化）
- **對應 audit**: P0-2 後續（人類流程）
- **Notes**: PR template 要 PR merge 進 main 後新 PR 才會自動套用

#### S3: coverage include + baseline

- **規則**: R1
- **改檔**: `vitest.config.mjs:22` 加 `ui/components/app` 進 coverage include；`docs/QUALITY_SCORE.md` 紀錄三層 baseline 數字
- **對應 audit**: P0-4
- **Notes**: **不立刻設新 threshold**（threshold 延後 S9 觸發型）；`vitest.config.mjs:36` 的 `lines: 70` 維持不動

#### S4: pre-commit grep gate（warn-only）

- **規則**: R8
- **改檔**: `scripts/audit-mock-boundary.sh`（新）+ `scripts/audit-flaky-patterns.sh`（新）+ `.husky/pre-commit`（加兩 script）
- **對應 audit**: P0-1 + P1-4 + P1-5（補強訊號）
- **設計**: 兩 script `exit 0` 不擋 commit、只警示；S8 觸發型升級時改 `exit 1` 真擋

#### S5: firestore rules infra + 5 critical paths

- **規則**: R9 + 5 條 critical specs
- **改檔**: `package.json`（加 devDep `@firebase/rules-unit-testing`）+ `tests/server/rules/{users,posts,strava,events,notifications}.rules.test.js`（5 個新 spec）+ `.github/workflows/firestore-rules-gate.yml`（新 paths-filter workflow）
- **對應 audit**: P0-2
- **規模**: ~600 行（本 PR 最大宗）
- **Notes**: 寫測試前先 read `firestore.rules:80-254` 各條規則的真實 logic（不是 audit 報告假設的行為）；用 emulator 確認測試會抓到 deny path

#### S6: ESLint mock-boundary + flaky rules（error + ignores baseline）

- **規則**: R6 + R7
- **改檔**: `eslint.config.mjs` 加新區塊（仿 line 380-402 testing-library override 模式）— `no-restricted-syntax: error` + ignores baseline list（mock-boundary ~30-50 檔、flaky ~60-80 檔）
- **對應 audit**: P0-1 + P1-4 + P1-5
- **Baseline 生成**:
  ```bash
  grep -rln "vi.mock(['\"]@/\(repo\|service\|runtime\)/" tests/integration/ --include="*.test.*" | sort > /tmp/mock-boundary-baseline.txt
  grep -rln "toHaveBeenCalledTimes\|new Promise.*setTimeout" tests --include="*.test.*" | sort > /tmp/flaky-baseline.txt
  ```
- **Smoke test 規則生效**：在 baseline list 外的 integration 檔暫時加 `vi.mock('@/repo/foo')` → `npm run lint` 應 error → 撤銷
- **Commit message 紀錄 baseline 起始數字**（為 baseline 追蹤機制提供起點）

#### S7: GitHub UI（PR merged 後）

- **規則**: R10
- **動作**: Settings → Branches → main → 勾選 required checks `ci` / `e2e` / `firestore-rules-gate / rules`
- **Notes**: `firestore-rules-gate` 在 paths-filter trigger 過後才會出現在選項中

### 12.6 Baseline 追蹤機制（避免變廢的關鍵）

S6 的 `ignores` baseline 列出 233+109 處違規檔。沒追蹤機制 → list 默默膨脹（新檔被加進去取代清理） → baseline 變永久豁免、規則失去意義。

**三道防線**：

1. **Commit message 強制紀錄**
   - S6 commit message 紀錄 baseline 起始（mock-boundary: N 檔、flaky-pattern: M 檔）
   - Wave 3 任何動 baseline 的 PR 必須在 commit message 寫 `Baseline change: mock-boundary: N → N-3 (removed: file1, file2, file3)`

2. **PR template checkbox**（S2 已含）

   > [ ] 從 ESLint `ignores` baseline 拿掉某檔時，已處理該檔的 mock-boundary / flaky 違規，並更新 commit message 紀錄 baseline 變化

3. **CI 自動偵測（可選，S8 觸發前 reconsider）**
   - 比較 PR vs base branch 的 `eslint.config.mjs`
   - baseline 增加 → 留評論警示；baseline 減少 → 確認該檔 ESLint pass

### 12.7 觸發型延後 Sessions

#### S8: ESLint warn → error 升級

- **觸發條件**: Wave 3 mock cleanup 完成（baseline 清空）
- **動作**: ESLint mock-boundary 的 `ignores` baseline 全空 → 規則對全 codebase 生效；`scripts/audit-*.sh` 的 `exit 0` 改 `exit 1`，pre-commit gate 真擋；從 PR template 拿掉 baseline 變化 checkbox

#### S9: Per-directory threshold

- **觸發條件**: S3 baseline 已收集 + Wave 3 補測完成
- **動作**: `vitest.config.mjs` 設 per-directory threshold（service 80 / repo 75 / runtime 60 / lib 80 / config 70 / ui `<baseline+5>` / components `<baseline+5>` / app `<baseline+5>`）+ 每月 +5 milestone 註解直到 ui/components/app 升至 60-70

### 12.8 「先規則 vs 先改舊」的判斷（保留原 §12.8 結論）

**選 A（規則先）但分階段強度** — 與用戶 Q2 決議的「error + ignores baseline」變體本質一致：

- **規則先 + ignores baseline 等同「分階段」**：規則直接 error（強制力最強），但 baseline ignores 對舊有 mute（不擋本 PR）；Wave 3 逐檔處理拿掉 list = 漸進升級
- **為什麼不選 B（改先再規則）**：233 mock + 109 flaky 要 3-4 sprint 才清得完，這期間沒防線，新 PR 會繼續新增同類債 — 邊還邊欠
- **為什麼不選「規則一刀切無 baseline」**：233+109 全部變 error 會擋一切 PR，本 PR 無法 merge

### 12.9 與既有 audit 報告章節的銜接

```
§1-§11（P0-P3 + 統計 + 驗證指令）保持原樣
                ↓
§12（本節）執行序列：1 PR / 6 commits
                ↓
本 PR (026-tests-audit-rules-bundle) merged 後
                ↓
                ├─→ S7 GitHub UI 設 required（branch protection 完成）
                ├─→ Wave 3 另案（清舊有 233/26/109）
                └─→ S8 + S9 觸發型升級
```

### 12.10 完整 step-by-step 在 plan file

每個 session 的逐步任務（T1.1, T1.2, ...）、verification 指令、commit message 範本，都在用戶 plan file：

```
~/.claude/plans/2026-04-29-tests-audit-report-md-pr-squishy-mist.md
```

未來 agent 接手某個 session 寫 `specs/026-tests-audit-rules-bundle/tasks.md` 時，從 plan file 對應 session 區塊抽取 Tasks 列點即可。

---

**End of Report**
