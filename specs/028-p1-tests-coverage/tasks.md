# 028 — P1 Tests Coverage（Tasks）

> Generated: 2026-04-30
> Audit source: `specs/028-p1-tests-coverage/2026-04-29-tests-audit-report.md`（§3 P1-1 ~ P1-3 + §6「不要怎麼做」）
> Mode: 人類派工程師 + reviewer 接力，**所有實作派 subagent**，主 agent 只跑流程
> Scope: 補測 P1-1（24 hooks）+ P1-2（auth-service / AuthProvider）+ P1-3（Strava OAuth callback route + E2E）

---

## 0. Header / 全局資訊

### 0.1 Worktree & Branch

| Item                    | Value                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree absolute path  | `/Users/chentzuyu/Desktop/dive-into-run/.claude/worktrees/028-p1-tests-coverage`                                                              |
| Branch                  | `worktree-028-p1-tests-coverage`                                                                                                              |
| Base                    | `main` HEAD（撰寫時：`4dd07fe`）                                                                                                              |
| Audit report (relative) | `specs/028-p1-tests-coverage/2026-04-29-tests-audit-report.md`                                                                                |
| Audit report (absolute) | `/Users/chentzuyu/Desktop/dive-into-run/.claude/worktrees/028-p1-tests-coverage/specs/028-p1-tests-coverage/2026-04-29-tests-audit-report.md` |
| Tasks file (this file)  | `specs/028-p1-tests-coverage/tasks.md`                                                                                                        |

### 0.2 Worktree-only 紀律（非妥協）

- 所有檔案操作**只能**發生在 `/Users/chentzuyu/Desktop/dive-into-run/.claude/worktrees/028-p1-tests-coverage` 內。
- **絕對不可**動主 repo `/Users/chentzuyu/Desktop/dive-into-run/`（包括 `specs/`、`src/`、`tests/`）。
- 讀規範檔（`CLAUDE.md` / `.claude/rules/` / `.claude/references/`）走 worktree 路徑（已透過 `git worktree` share）。
- 主 agent 開的每個 subagent prompt 都必須開頭加上 `worktree-only` 提醒（見 §10）。

### 0.3 Repo Coding Rules（測試檔同樣適用，但有兩條 testing-only 補充）

來源：`.claude/rules/coding-rules.md`、`.claude/rules/code-style.md`、`.claude/rules/testing-standards.md`、`.claude/references/testing-handbook.md`、`.claude/references/quality-gates.md`。

**Non-Negotiable（6 條）**：

1. 沒有 `@ts-ignore`（必要時 `@ts-expect-error` + 註解）
2. 沒有 JSX 內邏輯（測試檔本身較少觸發）
3. 沒有 `eslint-disable` for a11y
4. JSDoc 完整（exported / shared helper 都要 `@param` 描述、`@returns`、`@typedef` 用 lowercase `{object}` 並有 `@property` 描述）
5. Forward-only import（測試也要遵守 dependency-cruiser bucket policy）
6. 300 行檔案上限

**Testing 補充（audit P0-1 / P1-4 / P1-5 衍生）**：

- **Mock 邊界**：邊界外（`firebase/firestore`、`firebase/auth`、`firebase-admin`、`fetch`、`next/navigation`、`@/config/client/firebase-client`）OK；邊界內（`@/repo/**`、`@/service/**`、`@/runtime/**` 自家模組）禁。違規必須在註解寫具體理由。
- **禁 flaky pattern**：
  - 不用 `toHaveBeenCalledTimes(N)`，改 `toHaveBeenCalled()` / `toHaveBeenCalledOnce()` / `toHaveBeenLastCalledWith(...)` / `toHaveBeenNthCalledWith(n, ...)`
  - 不用 `await new Promise(r => setTimeout(r, ms))` 硬等，改 `waitFor(() => expect(...))` 或 `vi.useFakeTimers()` + `vi.runAllTimersAsync()`
- **userEvent 強制**：integration / RTL 測試必須 `userEvent.setup()`，禁 `fireEvent`、禁 `container.querySelector`。
- **`waitFor` 內只放單一斷言**（memory `feedback_test_writing_gotchas.md`）。
- **`Mock` typed alias**：`vi.mock(...)` 後立刻為每個被 mock 的 function 加 `/** @type {import('vitest').Mock} */` alias，否則 `.mockResolvedValueOnce` 會觸發 TS2339。

### 0.4 路徑慣例

- Hook unit test → `tests/unit/runtime/<HookName>.test.jsx`
- Service unit test → `tests/unit/service/<service-name>.test.js`
- Provider RTL test → `tests/integration/auth/<ProviderName>.test.jsx`
- Server route 整合測試（不 mock 自家 use-case）→ `tests/unit/api/<route-name>.test.js`（沿用既有命名）
- Strava callback E2E → `tests/e2e/strava-oauth-flow.spec.js`
- 共用 helper / fixture → `tests/_helpers/`

### 0.5 Commit Message 格式（不加 Co-Authored-By）

```
test(<scope>): <短描述>

- <bullet 1>
- <bullet 2>

Refs: specs/028-p1-tests-coverage/tasks.md (T-P1-X-NN, T-P1-X-MM)
```

`<scope>` 建議：`runtime-hooks` / `auth` / `strava-callback` / `helpers`。

### 0.6 Status 圖例

| 圖示                              | 意義                                        |
| --------------------------------- | ------------------------------------------- |
| ⏳ Not started                    | 尚未派工                                    |
| 🔄 In progress (engineer: <name>) | 工程師施工中                                |
| 🔍 Review (reviewer: <name>)      | 工程師回報，reviewer 審查中                 |
| ❌ Rejected (round N)             | reviewer 退回，理由與修正建議寫在 task 註腳 |
| X ✅ Done                        | reviewer 通過 + lint/type-check/vitest 全綠，已完成並註記 X |

### 0.7 Verification 指令（每個 task 工程師 + reviewer 都要跑）

```bash
# 在 worktree 根目錄
npx vitest run tests/unit/runtime/<HookName>.test.jsx        # 該檔測試全綠
npm run lint:changed                                          # 0 problems
npm run type-check:changed                                    # 0 errors
```

**E2E task 額外**：`E2E_FEATURE=028 npm run test:e2e:emulator`（或 `tests/e2e/strava-oauth-flow.spec.js` 直跑）。

---

## 1. 團隊配置

| Team               | 負責範圍                                           | Tasks                 | 預估工時 |
| ------------------ | -------------------------------------------------- | --------------------- | -------- |
| `team-p1-1-hooks`  | P1-1：24 hooks 補 hook-level 測試                  | T-P1-1-01 ~ T-P1-1-24 | 36-72 h  |
| `team-p1-2-auth`   | P1-2：auth-service unit + AuthProvider RTL         | T-P1-2-01 ~ T-P1-2-02 | 6-10 h   |
| `team-p1-3-strava` | P1-3：Strava callback 重寫整合測試 + fixture + E2E | T-P1-3-01 ~ T-P1-3-04 | 14-20 h  |

**全部 30 個 task，三組可完全平行**（hooks 之間互不依賴，auth / strava 也各自獨立）。組內依賴在「Dep」欄標。

---

## 2. P1-1 — Runtime Hooks 補測（24 個 task，team-p1-1-hooks）

### 2.1 通用驗收標準（每個 hook task 都要套）

- [ ] 測試檔位於 `tests/unit/runtime/<HookName>.test.jsx`，使用 `renderHook` from `@testing-library/react`
- [ ] 沒有 `vi.mock('@/{repo,service,runtime}/...')`（除非具體理由寫在頂端註解；audit P0-1 邊界內禁止）
- [ ] Mock 邊界設在 `firebase/firestore`、`firebase/auth`、`@/config/client/firebase-client`、`fetch`、`next/navigation` 等真正外部
- [ ] 沒有 `toHaveBeenCalledTimes(N)`（用 `toHaveBeenCalled()` / `toHaveBeenLastCalledWith` / `toHaveBeenNthCalledWith`）
- [ ] 沒有 `setTimeout` 配 `Promise` 硬等（用 `waitFor` 或 `vi.useFakeTimers()`）
- [ ] `waitFor` 回呼裡只放單一 `expect(...)`
- [ ] 沒有 `eslint-disable`、沒有 `@ts-ignore`，JSDoc 完整（typedef 用 lowercase `{object}`，每個 `@property` 有描述）
- [ ] 不違反 forward-only import（test buckets 規則：unit 不可 import providers/components/contexts）
- [ ] 測試檔長度 ≤ 300 行（超過要拆 helper 檔到 `tests/_helpers/`）
- [ ] 至少涵蓋：(a) happy path、(b) 未登入 / 缺前置條件、(c) 失敗 / error 邊界、(d) cleanup / unsubscribe（若 hook 有 listener）
- [ ] `npx vitest run tests/unit/runtime/<HookName>.test.jsx` 全綠
- [ ] `npm run lint:changed` 與 `npm run type-check:changed` 全綠

### 2.2 範本參考（**有條件**參考）

- ✅ **可學**：`tests/unit/runtime/useStravaActivities.test.jsx` — `vi.hoisted` mock pattern、`renderHook` + `waitFor`、`loadHook()` 動態載入避免 module cache 汙染。
- ⚠️ **要避免**：`tests/unit/runtime/useStravaConnection.test.jsx:75-96` 的 `await new Promise(r => setTimeout(r, 10))`（audit P1-5）。改用 `waitFor` 或 fake timers。
- ⚠️ **要避免**：`tests/unit/runtime/useStravaActivities.test.jsx:268` 的 `toHaveBeenCalledTimes(N)`（audit P1-4，舊測試是 baseline，不要複製）。

### 2.3 Hook Task 表（24 個）

> 「Boundary mocks」欄列**該 hook 只能 mock 的外部邊界**。所有 `@/runtime/client/use-cases/*`、`@/service/*`、`@/repo/*`、`@/runtime/providers/*` 一律用真實實作。
> AuthContext 的 user / loading 一律用 mock `useContext`（react SDK 邊界）或包 wrapper 提供（不 mock provider 模組）。

| ID        | Hook File                                           | LOC | Boundary mocks（建議）                                                                                                                 | Coverage focus（驗收最少 4 條 + 通用 SOP）                                                                   | Dep                               | Status         |
| --------- | --------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------- |
| T-P1-1-01 | `useCommentMutations.js`                            | 205 | `firebase/firestore`、`@/config/client/firebase-client`、`@/config/client/firebase-timestamp`                                          | submit / delete / edit happy + 失敗 + auth 缺失 + race guard                                                 | —                                 | X ✅ Done      |
| T-P1-1-02 | `useComments.js`                                    | 137 | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | initial fetch + pagination + listener cleanup + error                                                        | —                                 | X ✅ Done      |
| T-P1-1-03 | `useDashboardTab.js`                                | 150 | 外部 `fetchFn` + `IntersectionObserver`                                                                                                | initial load + inactive/無 uid guard + load more + concurrent guard + retry + observer cleanup              | —                                 | X ✅ Done      |
| T-P1-1-04 | `useDashboardTabsRuntime.js`                        | 95  | 透過 `useDashboardTab` 真實實作（source 目前無 `next/navigation` mock 邊界）                                                            | tabs orchestration + 預設 tab + 切換副作用                                                                   | T-P1-1-03（同 team 順序，非阻塞） | X ✅ Done      |
| T-P1-1-05 | `useEventDetailMutations.js`                        | 252 | `firebase/firestore`、`@/config/client/firebase-client`、`@/config/client/firebase-timestamp`                                          | edit-event happy + validation/failure + delete-event happy/failure + auth 缺失 + already-deleted race guard + comment-added notification | —                                 | X ✅ Done      |
| T-P1-1-06 | `useEventDetailParticipation.js`                    | 306 | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | seat 計算 + deadline + listener cleanup + cross-user 隔離；**source 已拆 helper 回到規範內**                  | —                                 | X ✅ Done      |
| T-P1-1-07 | `useEventDetailRuntime.js`                          | 214 | `firebase/firestore`、`@/config/client/firebase-client`、`next/navigation`                                                             | route param 解析 + 整合 detail + participation + mutations 三 hook 真實組合 + redirect 行為                  | T-P1-1-05、T-P1-1-06              | X ✅ Done      |
| T-P1-1-08 | `useEventEditForm.js`                               | 243 | （純前端 form state，幾乎不用外部 mock；可 mock `@/service/event-service` 中的 `buildRoutePayload`？**否**，service 是邊界內，用真實） | 表單初值 + dirty tracking + invalid input + submit payload 對齊 service 規約                                 | —                                 | X ✅ Done      |
| T-P1-1-09 | `useEventMutations.js`                              | 279 | `firebase/firestore`、`@/config/client/firebase-client`、`@/config/client/firebase-timestamp`                                          | create / update / delete happy + validation guard + race guard + 失敗 toast 路徑                             | —                                 | X ✅ Done      |
| T-P1-1-10 | `useEventParticipation.js`                          | 263 | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | join / leave + chunk batch + remaining seats + 容量爭奪                                                      | —                                 | X ✅ Done      |
| T-P1-1-11 | `useEventsFilter.js`                                | 191 | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | filter combination + city/district + query rebuild + reset                                                   | —                                 | X ✅ Done      |
| T-P1-1-12 | `useEventsPageRuntime.js`                           | 306 | `firebase/firestore`、`@/config/client/firebase-client`、`next/navigation`                                                             | events page orchestration + filter/mutations 真實組合 + initial load + load more；**source 已拆 helper 回到規範內** | T-P1-1-09、T-P1-1-11              | X ✅ Done      |
| T-P1-1-13 | `useMemberPageRuntime.js`                           | 95  | `firebase/firestore`、`firebase/storage`、`@/config/client/firebase-client`                                                            | name / photo update happy + upload 失敗 + auth 缺失                                                          | —                                 | X ✅ Done      |
| T-P1-1-14 | `usePostComments.js`                                | 370 | `firebase/firestore`、`@/config/client/firebase-client`、`next/navigation`、`@/config/client/firebase-timestamp`                       | initial load + add / delete + reply tree + scroll-to-comment + listener cleanup；**source 已拆 effect helper 回到規範內** | —                                 | X ✅ Done      |
| T-P1-1-15 | `usePostDetailRuntime.js`                           | 287 | `firebase/firestore`、`@/config/client/firebase-client`、`next/navigation`                                                             | post fetch + integrate `usePostComments` 真實組合 + missing post error state（不 redirect） + delete success redirect | T-P1-1-14                         | X ✅ Done      |
| T-P1-1-16 | `usePostsPageRuntime.js`                            | 369 | `firebase/firestore`、`@/config/client/firebase-client`、`next/navigation`                                                             | feed initial + pagination + create + delete + auth gating；**source 已拆 helper 回到規範內**                 | —                                 | X ✅ Done      |
| T-P1-1-17 | `useProfileEventsRuntime.js`                        | 155 | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | hosted events fetch + load more + empty + error                                                              | —                                 | X ✅ Done      |
| T-P1-1-18 | `useProfileRuntime.js`                              | 94  | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | stats fetch happy + auth 缺失 + 失敗                                                                         | —                                 | X ✅ Done      |
| T-P1-1-19 | `useRunCalendar.js`                                 | 77  | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | month load + summary 計算（用真實 service） + 失敗；注意 hook 還用 legacy `@/contexts/AuthContext` 別 mock   | —                                 | X ✅ Done      |
| T-P1-1-20 | `useRunsPageRuntime.js`                             | 98  | `firebase/firestore`、`@/config/client/firebase-client`                                                                                | 整合 strava activities / connection / sync 三 hook 真實組合 + auth 切換                                      | —                                 | X ✅ Done      |
| T-P1-1-21 | `useStravaCallbackRuntime.js` ⭐ critical auth path | 106 | `next/navigation`（`useRouter`、`useSearchParams`）+ `fetch`                                                                           | hasError / 缺 code / 未登入 / loading / fetch ok redirect / fetch fail / network error / cancel guard        | —                                 | X ✅ Done      |
| T-P1-1-22 | `useStravaSync.js`                                  | 85  | `fetch`、`firebase/firestore`、`@/config/client/firebase-client`                                                                       | sync ok + cooldown + 失敗 + auth 缺失                                                                        | —                                 | X ✅ Done      |
| T-P1-1-23 | `useWeatherFavorites.js` ⭐ 大檔 + 0%               | 284 | `fetch`、`firebase/firestore`、`@/config/client/firebase-client`                                                                       | add / remove favorite + fetchWeather 整合 + concurrent guard + auth 缺失；**LOC 將近上限，已在規範內完成**   | —                                 | X ✅ Done      |
| T-P1-1-24 | `useWeatherPageRuntime.js` ⭐ 113 行 + 0%           | 337 | `fetch`、`firebase/firestore`、`@/config/client/firebase-client`                                                                       | initial load + favorite 整合 + city / district 篩選 + 失敗；**source 已拆 helper 回到規範內**                | T-P1-1-23                         | X ✅ Done      |

### 2.4 P1-1 Commit Cadence

- 建議 cadence：每 4-6 個 hook task 全 ✅ 後 commit 一次（避免單 commit 千行）
- Commit message 範例：

  ```
  test(runtime-hooks): cover events + posts hook batch (6 hooks)

  - useEventsFilter / useEventsPageRuntime / useEventMutations
  - usePostsPageRuntime / usePostDetailRuntime / usePostComments
  - 邊界 mock 限定 firebase/firestore + next/navigation
  - 移除舊範本的 setTimeout/Promise + toHaveBeenCalledTimes 反模式

  Refs: specs/028-p1-tests-coverage/tasks.md (T-P1-1-09, T-P1-1-11, T-P1-1-12, T-P1-1-14, T-P1-1-15, T-P1-1-16)
  ```

- 由主 agent 統一執行 git commit。

---

## 3. P1-2 — auth-service + AuthProvider（2 個 task，team-p1-2-auth）

### T-P1-2-01 — `auth-service.js` Unit Test

- **目標檔案（新）**：`tests/unit/service/auth-service.test.js`
- **驗收標準（最少 7 條 + 通用 SOP）**：
  - [ ] 測試 `createAuthUser(fbUser, profileData)`：
    - happy path：profile data 正常 → 回 `{ uid, name, email, photoURL, bio, getIdToken }` 對齊
    - profileData 為 `null` → 對應欄位都為 `null`
    - profileData 缺欄位（部分 undefined）→ 對應 fallback 為 `null`
    - `getIdToken` 是 thunk，呼叫後正確 forward 至 `fbUser.getIdToken`
  - [ ] 測試 re-export：驗證 `ensureUserProfileDocument` / `subscribeToAuthChanges` / `watchUserProfileDocument` 三個 named export 從 `@/repo/client/firebase-auth-repo` 透出（驗證方式需同時符合 repo lint policy；不要把 literal/template `vi.mock('@/repo/...')` 當成硬性要求）
  - [ ] 沒有 `toHaveBeenCalledTimes(N)`、無 `setTimeout/Promise`
  - [ ] JSDoc 完整、typed alias on mocks
  - [ ] 不 mock `firebase/auth` SDK（service 不直接依賴 SDK）
  - [ ] `npx vitest run tests/unit/service/auth-service.test.js` 全綠
  - [ ] `npm run lint:changed` + `type-check:changed` 全綠
- **依賴**：無
- **預估工時**：2-3 h
- **Team**：`team-p1-2-auth`
- **Commit checkpoint**：是（單獨 commit 或與 T-P1-2-02 合併 commit）
- **Status**：X ✅ Done

### T-P1-2-02 — `AuthProvider` RTL Integration Test

- **目標檔案（新）**：`tests/integration/auth/AuthProvider.test.jsx`
- **驗收標準（最少 8 條 + 通用 SOP）**：
  - [ ] 用 `@testing-library/react` 的 `render` + `renderHook`（with custom wrapper）測 `<AuthContext.Consumer>` 取得的值
  - [ ] Mock 邊界設在 `firebase/auth`（`onAuthStateChanged` / `signOut`）+ `firebase/firestore`（profile doc snapshot）+ `@/config/client/firebase-client`；**不 mock** `@/runtime/client/use-cases/auth-use-cases` 或 `@/service/auth-service`（avoid P0-1）
  - [ ] 涵蓋場景：
    - 未登入 → `user === null`、`loading === false`（auth state 確定後）
    - 登入完成 + profile doc 存在 → context 收到 `createAuthUser` mapper 結果（`uid` / `name` / `email` 對齊）
    - profile doc 不存在 → `ensureUserProfileDocument` 行為被觸發（觀察 firestore mock 收到 set）
    - profile listener 後續 update（snapshot 多次觸發）→ user 更新
    - 登出 → `user` 回 `null`、cleanup 取消 profile listener（驗 unsubscribe 被呼叫）
  - [ ] `<AuthProvider>` unmount 時取消所有 listener（驗 unsubscribeAuth + unsubscribeProfile 都被呼叫）
  - [ ] 沒有 `fireEvent`、沒有 `container.querySelector`
  - [ ] 沒有 `toHaveBeenCalledTimes(N)`、無 `setTimeout/Promise`
  - [ ] JSDoc 完整
  - [ ] `npx vitest run tests/integration/auth/AuthProvider.test.jsx` 全綠
  - [ ] `npm run lint:changed` + `type-check:changed` 全綠
- **依賴**：無（與 T-P1-2-01 平行）
- **預估工時**：4-7 h
- **Team**：`team-p1-2-auth`
- **Commit checkpoint**：是（兩個 task 一起 commit）
- **Status**：X ✅ Done

### P1-2 Commit Message 範本

```
test(auth): cover auth-service mapper + AuthProvider lifecycle

- service-level mapper unit + repo re-export facade verification
- provider RTL covers unauthenticated / authed / profile snapshot / sign-out
- 邊界 mock 限定 firebase/auth + firebase/firestore + firebase-client
- 不 mock 自家 use-case / service（避免 audit P0-1）

Refs: specs/028-p1-tests-coverage/tasks.md (T-P1-2-01, T-P1-2-02)
```

---

## 4. P1-3 — Strava OAuth Callback（4 個 task，team-p1-3-strava）

### T-P1-3-01 — Strava Token Endpoint Fixture / fetch Stub Helper

- **目標檔案（新）**：`tests/_helpers/strava-fixtures.js`
- **驗收標準（最少 6 條 + 通用 SOP）**：
  - [ ] export `createStravaTokenExchangeResponse({ overrides })`、`createStravaActivitiesResponse({ activities })`、`createStravaErrorResponse(status, body)`
  - [ ] export `createStravaCallbackRequest({ code, idToken })`（Request mock，`Content-Type: application/json` + Bearer header）
  - [ ] 提供典型 athlete payload + 三種 activity（Run / Ride / TrailRun）對齊 P1-3 audit 提到的 supported types 過濾
  - [ ] 純資料 helper，**不 import** `@/repo/**` / `@/runtime/**`（避免 forward-only 違規）
  - [ ] JSDoc 每個 function 都有 `@param` 描述 + `@returns`
  - [ ] 檔案 ≤ 200 行
  - [ ] `npx vitest run` 不會因為 helper 被誤抓（檔名不含 `.test.`）
  - [ ] `npm run lint:changed` + `type-check:changed` 全綠
- **依賴**：無
- **預估工時**：2-3 h
- **Team**：`team-p1-3-strava`
- **Commit checkpoint**：可與 T-P1-3-02 合併 commit
- **Status**：X ✅ Done

### T-P1-3-02 — Strava Callback Route 整合測試（重寫，不 mock 自家 use-case）

- **目標檔案（覆寫）**：`tests/unit/api/strava-callback-route.test.js`
- **背景**：audit P0-1 把現有 `tests/unit/api/strava-callback-route.test.js` 列為「mock 自家 use-case」反例。實際讀檔後現有測試 mock 的是 `firebase-admin`（邊界外）+ `globalThis.fetch`（邊界外），**不是** mock 自家 use-case。但 audit P1-3 仍要求重寫成不靠 firebase-admin in-memory mock 的整合測試（用 Firebase Emulator）。本 task 兩個方向採其一，由工程師依下面決策樹選：
  - **Option A（推薦，less infra）**：保留 `firebase-admin` 邊界 mock，但把測試**搬到 server project**（`tests/server/strava/callback.test.js`）配合 emulator 真實寫入 Firestore，捨棄 in-memory `docStore`。需修改 `vitest.config.mjs` 確認 server include glob 已涵蓋（**P0-3 已 merge，目前是 `tests/server/**/\*.test.js`\*\*，可直接放）。
  - **Option B（more isolation）**：保留 unit project，沿用現有 `firebase-admin` mock + `fetch` mock，但**改名為 `strava-callback-route.test.js` 並補強**：補 happy / 401 / 400-missing-code / 400-invalid-code / 200-but-sync-fails 五情境的 contract 對齊（現有 5 個 it case 已有，**補 Bearer header 缺失 / Authorization malformed / fetch network error / 已 connected 重複 callback 四個 edge case**）。
- **驗收標準（最少 9 條 + 通用 SOP）**：
  - [ ] 不 mock `@/runtime/server/use-cases/strava-server-use-cases`（這就是 audit P1-3 要求）
  - [ ] 不 mock `@/repo/server/**`（讓 use-case 真實呼叫 repo，repo 真實打 firebase-admin / fetch — 邊界）
  - [ ] 邊界 mock 設在 `firebase-admin`（**或 emulator 真實連線**，視 Option A/B）+ `globalThis.fetch`
  - [ ] 涵蓋場景：401 invalid token / 400 missing code / 400 Strava reject / 200 happy + 過濾 Run/TrailRun + 排除 Ride / 200 sync fail still success / Bearer header malformed / network error during token exchange / network error during activity sync
  - [ ] 沒有 `toHaveBeenCalledTimes(N)`（現有測試有，重寫時清掉）
  - [ ] 用 `toHaveBeenLastCalledWith` / `toHaveBeenNthCalledWith` 替代
  - [ ] 在檔案頂端寫一段 docstring 註明 mock 邊界、Option A/B 選擇、與 audit P1-3 連動
  - [ ] `npx vitest run tests/unit/api/strava-callback-route.test.js`（或 server 路徑）全綠
  - [ ] `npm run lint:changed` + `type-check:changed` 全綠
- **依賴**：T-P1-3-01（fixture）
- **預估工時**：4-6 h
- **Team**：`team-p1-3-strava`
- **Commit checkpoint**：是
- **Status**：X ✅ Done

### T-P1-3-03 — `useStravaCallbackRuntime` Hook Unit Test（與 T-P1-1-21 同任務，雙列確認）

- 即 T-P1-1-21。**重複登錄是為了確認此 hook 在 P1-3 流程的關鍵性**，實作只做一份檔。Reviewer 在 review T-P1-1-21 時要求**同時驗** P1-3 audit 列出的 9 個 critical paths：
  - hasError query param → error message
  - 缺 code 也視為 error
  - 未登入（user `null` 且 `authLoading === false`）→ login required message
  - `authLoading === true` 期間不打 fetch
  - happy redirect to `/runs`
  - fetch 回 `ok: false` → server error message
  - fetch throw → network error message
  - `requestKey` change（user 重登）後重新嘗試
  - cancellation: unmount 後不要 setState
- **依賴**：無（hook 內無共享 helper）
- **預估工時**：2-3 h（已含在 T-P1-1-21）
- **Team**：`team-p1-1-hooks`（執行）+ `team-p1-3-strava`（review 時 cross-check）
- **Status**：X ✅ Done（與 T-P1-1-21 同步）

### T-P1-3-04 — Strava OAuth E2E Flow

- **目標檔案（新）**：`tests/e2e/strava-oauth-flow.spec.js`
- **驗收標準（最少 8 條 + 通用 SOP）**：
  - [ ] 用 Playwright + Firebase Emulator（`E2E_FEATURE=028 npm run test:e2e:emulator`）
  - [ ] **Mock Strava OAuth endpoint**（用 page route interception 或 emulator-side proxy；不真打 Strava API）
  - [ ] 涵蓋兩條 critical paths：
    - 已登入使用者點 connect → 接住 OAuth callback → 看到「成功」UI 提示 → 驗 Firestore `stravaConnections/{uid}` `connected: true` + `athleteName` 寫入（透過 `tests/_helpers/e2e-helpers.js` 的 firestore REST 讀回）
    - OAuth callback `?error=access_denied` → 看到對應 error message（對齊 `useStravaCallbackRuntime` 的 `MISSING_CODE_MESSAGE`）
  - [ ] **無** `page.waitForTimeout()`（用 `await expect(...).toBeVisible({ timeout })`）
  - [ ] Locator 用 `getByRole` / `getByText`，不用 raw CSS selector
  - [ ] beforeAll 清 emulator + seed marker（避免 onSnapshot initial load race；參考 `tests/e2e/comment-notifications.spec.js` Scenario 4）
  - [ ] 無 mock 自家 src（E2E bucket 規則：禁所有 `src/` import）
  - [ ] 測試 ≤ 300 行
  - [ ] `npm run test:e2e:branch` 在當前 branch 抓得到並全綠
  - [ ] `npm run lint:changed` + `type-check:changed` 全綠
- **依賴**：T-P1-3-02 通過（route 行為確定）+ T-P1-1-21 通過（runtime hook 行為確定）
- **預估工時**：6-8 h（最大宗，含 emulator 設置 + Strava OAuth mock）
- **Team**：`team-p1-3-strava`
- **Commit checkpoint**：是（最後一刀）
- **Status**：X ✅ Done

### P1-3 Commit Message 範本

```
test(strava-callback): rewrite route integration + add E2E for OAuth

- 移除 in-memory firebase-admin mock，改 emulator 真實寫入（Option A）
- 補 Bearer header malformed / network error / sync-fail 四 edge case
- 新 tests/_helpers/strava-fixtures.js 收斂 token / activity payload
- E2E 走 Playwright + emulator + Strava endpoint route interception

Refs: specs/028-p1-tests-coverage/tasks.md (T-P1-3-01, T-P1-3-02, T-P1-3-04)
```

---

## 5. 依賴圖

```
team-p1-1-hooks（24 hooks，互不阻塞，主流可平行）
  ├─ T-P1-1-03 → T-P1-1-04（後者 import 前者）
  ├─ T-P1-1-05, T-P1-1-06 → T-P1-1-07
  ├─ T-P1-1-09, T-P1-1-11 → T-P1-1-12
  ├─ T-P1-1-14 → T-P1-1-15
  └─ T-P1-1-23 → T-P1-1-24

team-p1-2-auth（兩 task 平行）
  └─ T-P1-2-01, T-P1-2-02 平行

team-p1-3-strava
  ├─ T-P1-3-01 → T-P1-3-02
  ├─ T-P1-1-21（= T-P1-3-03，由 team-p1-1-hooks 做）→ T-P1-3-04
  └─ T-P1-3-02 → T-P1-3-04
```

跨團隊**無**阻塞，三組可同時開工。組內阻塞已在「Dep」欄標注，主 agent 派工時依此判斷可平行任務。

---

## 6. PR / Merge 流程

### 6.1 全部 task ✅ 後

```bash
# 在 worktree 內
git push -u origin worktree-028-p1-tests-coverage
```

### 6.2 開 PR

```bash
gh pr create --title "test(p1): runtime hooks + auth-service + Strava callback coverage" --body "$(cat <<'EOF'
## Summary

- P1-1: 24 runtime hooks 全部補 hook-level unit test（renderHook + boundary mocks）
- P1-2: auth-service mapper unit + AuthProvider RTL（lifecycle / unsubscribe / cross-snapshot）
- P1-3: Strava callback route 整合測試重寫（移除自家 use-case mock）+ OAuth E2E

對應 audit report: `specs/028-p1-tests-coverage/2026-04-29-tests-audit-report.md`
- §3 P1-1（runtime hooks 7.7% → 100% 對位）
- §3 P1-2（auth-service / AuthProvider 0% → covered）
- §3 P1-3（Strava OAuth callback critical path covered）

## Test plan

- [ ] `npx vitest run tests/unit/runtime/` 全綠
- [ ] `npx vitest run tests/unit/service/auth-service.test.js` + `tests/integration/auth/AuthProvider.test.jsx` 全綠
- [ ] `npx vitest run tests/unit/api/strava-callback-route.test.js` 全綠
- [ ] `npm run test:e2e:branch` 含 strava-oauth-flow.spec.js 全綠
- [ ] CI `ci` job 通過
- [ ] CI `e2e` job 通過

## Audit constraints honored

- 沒有新 `vi.mock('@/{repo,service,runtime}/...')`（mock 邊界外）
- 沒有新 `toHaveBeenCalledTimes(N)`（用 `toHaveBeenCalled` / `toHaveBeenLastCalledWith` / `toHaveBeenNthCalledWith`）
- 沒有 `setTimeout` 配 `Promise`（用 `waitFor` / fake timers）

EOF
)"
```

### 6.3 等 CI 通過 → GitHub UI merge

- main 是 protected branch，必須走 PR + 2 status check（`ci` + `e2e`）
- merge 後刪除 worktree branch

---

## 7. 與 audit report 對應的覆蓋率追蹤

| Audit item                                            | Tasks                      | Status check |
| ----------------------------------------------------- | -------------------------- | ------------ |
| P1-1 useStravaCallbackRuntime                         | T-P1-1-21 + T-P1-3-03 (同) | ✅           |
| P1-1 useWeatherPageRuntime                            | T-P1-1-24                  | ✅           |
| P1-1 useWeatherFavorites                              | T-P1-1-23                  | ✅           |
| P1-1 useEventDetailParticipation edge cases           | T-P1-1-06                  | ✅           |
| P1-1 其他 20 hooks                                    | T-P1-1-01 ~ T-P1-1-22      | ✅           |
| P1-2 auth-service                                     | T-P1-2-01                  | ✅           |
| P1-2 AuthProvider                                     | T-P1-2-02                  | ✅           |
| P1-3 callback route 整合測試（不 mock 自家 use-case） | T-P1-3-02                  | ✅           |
| P1-3 callback route fixture                           | T-P1-3-01                  | ✅           |
| P1-3 callback E2E                                     | T-P1-3-04                  | ✅           |

> P1-4（109 處 `toHaveBeenCalledTimes`）/ P1-5（`setTimeout` 等待）**不在本 spec 範圍**，但本 spec 寫的所有新測試**禁止新增**這兩種 anti-pattern（已在通用驗收標準納入）。

---

## 8. 不要怎麼做（audit §6 摘要 + 本 spec 補充）

- 不要一次性把 233 處舊 `vi.mock('@/...')` 全改掉 — 本 spec 只管「**新寫的測試**不違反」
- 不要為了拉高 coverage 補 snapshot test
- 不要在新測試引入 `setTimeout/Promise` 硬等
- 不要把 hook test 寫成「mock 整個 use-case」（會跟 P0-1 一樣失去 contract 驗證價值）
- 不要碰主 repo 的任何檔案（worktree-only）
- 不要跳過 PR + 2 status check（main protected branch）
- 不要在 commit message 加 `Co-Authored-By`

---

## 9. SOP 索引

### 9.1 工程師 SOP（每個 task）

1. 讀 task：「目標檔案 + 驗收標準 + Boundary mocks」
2. 讀目標 hook / service 原始碼，列其依賴邊界
3. 開測試檔（`renderHook` for hooks / `render` + custom wrapper for provider）
4. 從通用驗收標準開始寫骨架，再依「Coverage focus」補場景
5. **不 mock 邊界內模組**（自家 `@/repo/**`、`@/service/**`、`@/runtime/**`）
6. 若需要切換 AuthContext 值：mock `react.useContext` 或包 `<AuthContext.Provider value=...>` wrapper
7. 跑驗證指令（§0.7）
8. 把測試檔位置 + 驗收 checklist 對照貼在回報訊息，移交 reviewer

### 9.2 Reviewer SOP（每個 task）

1. 對照「驗收標準」逐條打勾
2. 跑驗證指令確認綠
3. **特別 cross-check**：
   - `grep -E "vi.mock\(['\"]@/(repo|service|runtime)/" <test-file>` → 應為空
   - `grep -E "toHaveBeenCalledTimes\(" <test-file>` → 應為空
   - `grep -E "new Promise.*setTimeout|setTimeout.*resolve" <test-file>` → 應為空
   - `wc -l <test-file>` → ≤ 300
4. 若有違規 → ❌ Rejected (round N)，註明具體行號 + 修正建議；主 agent 用 SendMessage 把 feedback 傳回原工程師
5. 全綠 → ✅ Done，主 agent 同步 task status 至 TaskList 工具與 tasks.md（雙寫）

### 9.3 退回流程

```
Reviewer 退回（❌ Rejected (round N)，列具體 line:col + 修正點）
  → 主 agent SendMessage feedback 給原工程師
  → 工程師修 → 跑驗證 → 回報 reviewer（status 改回 🔍 Review (reviewer: <name>)）
  → reviewer 再審
  → 通過 → ✅ Done
```

---

## 10. For Future Agents (compact-safe)

> ⚠️ Context 被 compact 後接手者**先讀本節**。

### 10.1 主 agent 角色

- **只管流程**，所有實作派 subagent
- 每個 task 派 1 個工程師 + 1 個 reviewer（subagent）
- Reviewer 不通過要退回原工程師（用 SendMessage feedback）
- **所有 subagent prompt 必須開頭加上**：
  > Worktree-only 紀律：所有檔案操作只能發生在 `/Users/chentzuyu/Desktop/dive-into-run/.claude/worktrees/028-p1-tests-coverage` 內，絕不可動主 repo `/Users/chentzuyu/Desktop/dive-into-run/`。讀規範檔走 worktree 路徑（已 share）。

### 10.2 找不到狀態時

重讀 `specs/028-p1-tests-coverage/tasks.md`（本檔）的 §2 / §3 / §4 表格。

### 10.2.1 2026-04-30 現況

- 已 reviewer 通過且 gate 全綠，`tasks.md` 已打 `X`：`T-P1-1-01`、`T-P1-1-02`、`T-P1-1-03`、`T-P1-1-04`、`T-P1-1-05`、`T-P1-1-06`、`T-P1-1-07`、`T-P1-1-08`、`T-P1-1-09`、`T-P1-1-10`、`T-P1-1-11`、`T-P1-1-12`、`T-P1-1-13`、`T-P1-1-14`、`T-P1-1-15`、`T-P1-1-16`、`T-P1-1-17`、`T-P1-1-18`、`T-P1-1-19`、`T-P1-1-20`、`T-P1-1-21`、`T-P1-1-22`、`T-P1-1-23`、`T-P1-1-24`、`T-P1-2-01`、`T-P1-2-02`、`T-P1-3-01`、`T-P1-3-02`、`T-P1-3-03`、`T-P1-3-04`
- `T-P1-1-22`：這次不是單純補測，它先挖出 `useStravaSync` 缺 cooldown guard 的真 bug，已補 source fix 後再通過 reviewer。
- `T-P1-3-04`：原本卡在 Playwright emulator webServer 缺 `NEXT_PUBLIC_FIREBASE_*` client env；補 `E2E_FEATURE=028` mapping 與 env fallback 後，最小真跑已通過。
- `T-P1-1-15`：task 文案原本寫 `redirect on missing`，但真實 source 是 missing post 時設 not-found error state；已按 source-of-truth 修正文案後通過 reviewer。
- `T-P1-1-16`：先被 reviewer 擋在 source `369` 行，後續拆 `usePostsPageRuntimeHelpers.js` 回到 `294` 行後通過 reviewer。
- 目前 task scope 已全數完成；下一階段是統一驗證、commit、push、PR、CI、merge。

### 10.3 Status 雙寫

主 agent 同步 task status 至：

- TaskList 工具
- 本檔 §2 / §3 / §4 表格的 `Status` 欄

### 10.4 關鍵路徑速查

| Item                         | Value                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Worktree                     | `/Users/chentzuyu/Desktop/dive-into-run/.claude/worktrees/028-p1-tests-coverage` |
| Branch                       | `worktree-028-p1-tests-coverage`                                                 |
| Tasks file                   | `specs/028-p1-tests-coverage/tasks.md`                                           |
| Audit report                 | `specs/028-p1-tests-coverage/2026-04-29-tests-audit-report.md`                   |
| Hook test 範本（學）         | `tests/unit/runtime/useStravaActivities.test.jsx`                                |
| Hook test 反例（避）         | `tests/unit/runtime/useStravaConnection.test.jsx:75-96`                          |
| Strava callback 反例（重寫） | `tests/unit/api/strava-callback-route.test.js`                                   |

### 10.5 Commit Cadence

| Team               | 何時 commit                                       |
| ------------------ | ------------------------------------------------- |
| `team-p1-1-hooks`  | 每 4-6 個 hook task 全 ✅ 後 commit               |
| `team-p1-2-auth`   | T-P1-2-01 + T-P1-2-02 都 ✅ 後合併 commit         |
| `team-p1-3-strava` | 三 task 各自 ✅ 後 commit（fixture 可與 02 合併） |

由主 agent 統一執行 git commit，commit message 格式見 §0.5。

### 10.6 PR & Merge

全 30 task ✅ → push → 開 PR（§6.2 指令）→ 等 `ci` + `e2e` 兩 status check → GitHub UI merge → 完成。

---

**End of tasks.md**
