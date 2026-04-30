# 027 — tests mock cleanup（P0-1 Wave 3 — Mock-boundary baseline drain）

> **Branch**: `027-tests-mock-cleanup`
> **Audit source**: `project-health/2026-04-29-tests-audit-report.md` §2 P0-1（L77-111）
> **Predecessor**: spec 026（PR #25/#26/#27 merged）— 規則上線、`eslint.config.mjs` block 18.6 留下 47 檔 mock-boundary `ignores` baseline
> **Successor trigger**: 本 spec 完成 → §12.7 S8 升級觸發（baseline 全空 → 規則對全 codebase 生效；grep gate `exit 0` → `exit 1`）

---

## 1. TL;DR

把 `eslint.config.mjs` block 18.6（line 513-586）的 mock-boundary `ignores` baseline 從 47 檔縮成 14 檔（剩下 14 檔是 flaky-only overlap，不在本次範圍）。每處理完一檔就：

1. 改寫該檔測試（拿掉 `vi.mock('@/{repo,service,runtime}/...')`）
2. 確認 `npm run lint` 對該檔 pass
3. 從 18.6 ignores list 拿掉該檔（同步更新 commit message `Baseline change: mock-boundary: 33 → 33-N (removed: ...)` per PR template）

切成 **5 個 session / 5 個 PR**。

| 量化                                                  | 值        | 來源                                                                           |
| ----------------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| S6 mock-boundary baseline 總大小                      | 47 檔     | `eslint.config.mjs:515-562`                                                    |
| 真有 `vi.mock('@/(repo\|service\|runtime)/...')` 違規 | **33 檔** | `grep -rEln "vi\.mock\(['\"]@/(repo\|service\|runtime)/" tests/integration`    |
| 違規總處數                                            | **77 處** | `grep -rEn ... \| wc -l`                                                       |
| 全 codebase 內部 mock 計數（context）                 | 233       | audit L23                                                                      |
| 233 vs 77 落差                                        | 156       | 落在 lib/runtime hook test/api test 等，不在本 spec 範圍（屬 §6 Out of Scope） |

> **關鍵概念釐清**：audit report 全文使用「P0-1 233 處」是 codebase 整體統計；S6 baseline 只攔 `tests/integration/**` 中的 `@/(repo\|service\|runtime)/` mock，故本 spec 實際範圍是 **77/233**。剩餘 156 處屬 §6 Out of Scope。

---

## 2. Why this plan exists

S6（PR #25）已上線 ESLint mock-boundary 規則，但採「`error` + `ignores` baseline」策略豁免了既有 47 檔。Baseline 不主動清就會：

- **永久豁免** — 變成「規則上線了但實質沒擋」
- **被默默膨脹** — 新檔可能被加進 list 取代修復（PR template R11 checkbox 是文化提醒，不是機械擋線）
- **S8 / S9 觸發條件無法達成** — audit §12.7 設定 S8（warn → error 升級）以「baseline 清空」為前提

本 spec 是把 baseline 從 47 → 14 的實際清理工作。完成後：

- block 18.6 ignores 只剩 14 檔（flaky-only overlap），不再 mute mock-boundary 規則
- 對於 mock-boundary 規則而言，整個 `tests/integration/**` 已對齊 audit 期望
- S8 觸發條件「mock-boundary 部分」就緒（flaky 部分仍待另案）

---

## 3. Scope

### 3.1 In scope（33 檔 / 77 violations）

按 mock 違規數從重到輕：

| 違規數/檔 |   檔數 |                                                                累計違規 |
| --------: | -----: | ----------------------------------------------------------------------: |
|         4 |      9 |                                                                      36 |
|         3 |      4 |                                                                      12 |
|         2 |      8 |                                                                      16 |
|         1 |     12 |                                                                      12 |
|  **合計** | **33** | **76** ← grep 為 77，1 處差異為單行多 mock 共現，逐檔逐 occurrence 為準 |

完整檔案 list 見 §5 Session 切分（每 session 列舉）。

### 3.2 Out of scope（明示排除，避免 PR 漂移）

| 項目                                                                                | 預估規模                                       | 為何不做                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **156 處 codebase 其他 mock**（lib test、unit/runtime hook test、api test 內 mock） | 156 處                                         | 不在 S6 baseline，即使被 mock 規則也不擋（規則只 fire `tests/integration/**`）；屬 audit §2 P0-1 修補步驟「第二批 / 第三批」，待另開 spec 028+                          |
| **flaky-pattern baseline drain**（block 18.5 line 446-505 共 45 檔）                | 109 處 toHaveBeenCalledTimes + N 處 setTimeout | 屬 audit P1-4/P1-5；本 spec 只順手清「同檔 + 同改寫一起發生」的 flaky violations（避免該檔離開 mock-boundary baseline 後 flaky 規則 fire），不主動清外部單獨 flaky 違規 |
| **P1-1 26 hooks 補測**（`renderHook` 直測 hook）                                    | 24 hooks × 1-3 hr                              | 屬 audit P1-1，補測新案而非清舊；本 spec focus 是「改寫既有測試使其不違規」                                                                                             |
| **P0-2 firestore rules 5 critical paths**                                           | 已於 S5 完成                                   | spec 026 PR #25 已 merged                                                                                                                                               |
| **`@/lib/**`、`@/components/**`、`@/contexts/AuthContext`、`@/data/**` 的 mock\*\*  | grep 顯示這些是 233 中的非小頭                 | 不在 S6 規則 selector（`@/(repo\|service\|runtime)/` only），規則本身不擋；後續 spec 若要擴大，先擴規則 selector 再清 baseline                                          |
| **重設 jsdom + Firestore emulator 整合**                                            | 1 sprint                                       | 屬 P1-3 Strava callback / P1-2 auth-service 「真 integration」需求；本 spec 採 §4 Strategy Option B 避免此重構                                                          |

### 3.3 Risk-out（明示不接受的捷徑）

- **不**透過「把整檔加進 18.5 flaky baseline 換 18.6 移除」假裝清完 — baseline 移檔的條件是該檔「對該規則 lint pass」，不是「換條規則繼續 mute」
- **不**用 `eslint-disable` inline 豁免 — 規則本身要 fire 才知道改對了
- **不**改 ESLint selector（如把 `@/(repo|service|runtime)/` 縮成 `@/(repo|service)/`）來縮小違規數 — 等於降規則強度
- **不**在本 spec 動 src/ 任何 production code（如「為了測好寫所以拆 use-case 拆 service」）— 違反 audit「不修補 src/」精神

---

## 4. Strategy（Option B 為主，Option A 個案）

### 4.1 Option B — 把「mock 自家 use-case」改為「mock 邊界外 SDK」

**做法**：

```js
// 改寫前（違規）
vi.mock('@/runtime/client/use-cases/post-use-cases', () => ({
  getPostDetail: vi.fn(),
  toggleLikePost: vi.fn(),
  ...
}));

// 改寫後（合規 — 邊界外 SDK 層 mock）
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  ...
}));

// 測試 setup：
import { getDoc } from 'firebase/firestore';
beforeEach(() => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ id: 'p1', title: 'Test' }) });
});
```

**為何 Option B 合規**：audit L94-96 明示「`vi.mock('firebase/firestore', ...)` 不在 233 計數內，是 SDK 層 mock」— 這是邊界外可保留 mock。改寫後 use-case → service → repo 鏈會「真實執行」，contract 才算被測到。

**Option B 適用情境**（≥ 90% 案例）：

- ✅ component 測試只走 use-case → repo → SDK 「讀」鏈（getDoc/getDocs/onSnapshot）
- ✅ component 測試走 use-case → SDK 「寫」鏈（addDoc/updateDoc/deleteDoc）
- ✅ component 測試需要 toast/router/AuthContext 等 React 邊界外 mock（這些保留為合規 mock）

**Option B 不適用情境**（個案）：

- ❌ 測試需驗證 Firestore transaction 真實 atomic 行為（runTransaction stub 回 `{ get, set }` callback 容易失真）→ 改用 server project + emulator 重寫，或拆出邏輯到純函數測
- ❌ 測試需驗證 collectionGroup query 真實 cross-user 行為 → 同上
- ❌ 測試涉及 fetch 邊界（Strava OAuth callback）→ 改 Option A 部分（nock + emulator）或拆 server-side route 測試另案

### 4.2 Option A — 真 integration（emulator）— 個案

僅在 Option B 確實失真時才用。本 spec **不**新建 jsdom + emulator 整合 setup（屬 P1-3 範圍）。若 pilot 發現某檔屬 Option A 個案，**flag 起來移交給 028+ spec**，不在本 spec 改寫。

### 4.3 改寫流程的最小可行步驟（per 檔）

每個違規檔的處理流程：

1. **盤點**：列出該檔所有 `vi.mock('@/...')` 呼叫，標記哪幾個是違規（`@/{repo,service,runtime}/`）、哪幾個是合規（`@/config/client/firebase-client`、第三方 SDK、context/provider）
2. **追溯**：grep 違規 mock 對應的 `vi.fn()` exports，看測試裡哪些 spec 在 `mockResolvedValue` / `mockReturnValue` — 這就是要保留的「行為控制點」
3. **改寫**：把違規 mock 拿掉，改 mock `firebase/firestore`（已有 import 通常已 mock）。把原本「直接控制 use-case 回傳」改成「控制 SDK function 回傳對應 Firestore document」
4. **跑單檔測試**：`npx vitest run tests/integration/.../X.test.jsx` 確認綠
5. **跑單檔 lint**：`npx eslint tests/integration/.../X.test.jsx` 確認該檔已 pass mock-boundary 規則
6. **從 baseline 拿掉檔**：`eslint.config.mjs` block 18.6 ignores 拿掉該行；若該檔 flaky 違規未清完則保留在 18.5 ignores，否則一併拿掉
7. **再跑一次 lint**：確認 mock-boundary 規則對該檔 fire 但 0 violations
8. **commit message** 加 `Baseline change: mock-boundary: X → X-1 (removed: tests/integration/.../X.test.jsx)`（本 PR 累計總額）

---

## 5. Session 切分（5 sessions / 5 PRs）

> 每 session 對應一個 branch / 一個 PR / 一份 `tasks.md`（用戶後續展開）。
> Branch 命名建議：`027-mock-cleanup-S{N}-<short-slug>`，與 spec 026 對齊。

### S1: posts/ 重型 5 檔（pilot）

**目標**：pilot — 在 5 檔上把 §4 Option B 改寫流程跑通，建立可複用的 setup pattern。

**範圍**（5 檔 / 20 violations）：

| 違規數 | 檔                                                              |
| -----: | --------------------------------------------------------------- |
|      4 | `tests/integration/posts/PostDetail.test.jsx`                   |
|      4 | `tests/integration/posts/PostDetailClient-delete-race.test.jsx` |
|      4 | `tests/integration/posts/post-edit-validation.test.jsx`         |
|      4 | `tests/integration/posts/post-detail-edit-dirty.test.jsx`       |
|      4 | `tests/integration/posts/post-comment-reply.test.jsx`           |

**為何先做 posts/**：

- 違規最密（5 檔全部 4 violations）→ 一次驗 4 種 use-case mock 模式（getDoc / addDoc / updateDoc / runTransaction）的改寫
- post-use-cases 是 audit 最常出現的違規 use-case 之一（11 處）
- 改寫成功後 pattern 可直接套用到 S2-S5

**Pilot deliverable**：handoff.md 補一段「Setup pattern reference（confirmed working）」，包含 vi.hoisted 結構、firebase/firestore mock shape、beforeEach setup 樣板。

**預估**：2-3 day（pilot 含 pattern 探索 + 5 檔改寫）。

**Baseline drain after S1**：mock-boundary 33 → 28。

**Risk flags**：

- 若 PostDetail 系列某檔走 runTransaction 邏輯 stub 不出來，flag 為 Option A 個案（移交 028+），handoff.md 紀錄
- 若改寫後 vitest 全綠但 coverage 數字下降，**stop** — 代表 Option B 改寫漏了 setup（review 必擋）

---

### S2: posts/ 收尾 3 檔 + comments/ 2 檔 + dashboard/ 1 檔

**目標**：套用 S1 pattern，清掉 posts/ 剩餘 + 鄰近輕量領域。

**範圍**（6 檔 / 13 violations）：

| 違規數 | 檔                                                               |
| -----: | ---------------------------------------------------------------- |
|      3 | `tests/integration/posts/PostFeed.test.jsx`                      |
|      3 | `tests/integration/posts/posts-page-edit-dirty.test.jsx`         |
|      3 | `tests/integration/posts/post-form-validation.test.jsx`          |
|      2 | `tests/integration/comments/event-comment-notification.test.jsx` |
|      1 | `tests/integration/comments/CommentSection.test.jsx`             |
|      1 | `tests/integration/dashboard/DashboardTabs.test.jsx`             |

**預估**：1-1.5 day。

**Baseline drain after S2**：28 → 22。

---

### S3: notifications/ 整批 9 檔

**目標**：notifications 自成 use-case 體系（notification-use-cases 16 處 mock），整批清。

**範圍**（9 檔 / 22 violations）：

| 違規數 | 檔                                                                        |
| -----: | ------------------------------------------------------------------------- |
|      4 | `tests/integration/notifications/notification-triggers.test.jsx`          |
|      4 | `tests/integration/notifications/notification-error.test.jsx`             |
|      2 | `tests/integration/notifications/notification-click.test.jsx`             |
|      2 | `tests/integration/notifications/NotificationToast.test.jsx`              |
|      2 | `tests/integration/notifications/NotificationTabs.test.jsx`               |
|      2 | `tests/integration/notifications/NotificationPanel.test.jsx`              |
|      2 | `tests/integration/notifications/NotificationPaginationStateful.test.jsx` |
|      2 | `tests/integration/notifications/NotificationPagination.test.jsx`         |
|      2 | `tests/integration/notifications/NotificationBell.test.jsx`               |

**預估**：2 day（mock 模式相似但量大）。

**Baseline drain after S3**：22 → 13。

**Risk flags**：

- notification-error.test.jsx 同時 mock notification-use-cases + event-use-cases（4 處）— pattern 較複雜，留意 setup 不要過度大爆炸
- pagination 系列要驗 `startAfter` cursor 行為，stub Firestore SDK 的 `startAfter`/`limit` 要對齊真實行為

---

### S4: events/ 3 檔 + profile/ 2 檔

**範圍**（5 檔 / 11 violations）：

| 違規數 | 檔                                                                |
| -----: | ----------------------------------------------------------------- |
|      4 | `tests/integration/events/event-detail-comment-runtime.test.jsx`  |
|      4 | `tests/integration/events/EventDetailClient-delete-race.test.jsx` |
|      1 | `tests/integration/events/EventsPage.test.jsx`                    |
|      1 | `tests/integration/profile/ProfileEventList.test.jsx`             |
|      1 | `tests/integration/profile/ProfileClient.test.jsx`                |

**預估**：1-1.5 day。

**Baseline drain after S4**：13 → 8。

**Risk flags**：

- EventDetailClient-delete-race 若涉及 `runTransaction` 跨 collection cascade delete → 評估 Option A 移交（不在本 spec 改寫）
- audit P0-2 已驗 events seat consistency 在 firestore.rules，這裡不重做，僅驗 component 對 use-case 結果反應

---

### S5: strava/ 4 檔 + weather/ 3 檔 + toast/ 1 檔

**範圍**（8 檔 / 11 violations）：

| 違規數 | 檔                                                       |
| -----: | -------------------------------------------------------- |
|      3 | `tests/integration/toast/crud-toast.test.jsx`            |
|      2 | `tests/integration/weather/favorites.test.jsx`           |
|      1 | `tests/integration/weather/weather-page.test.jsx`        |
|      1 | `tests/integration/weather/township-drilldown.test.jsx`  |
|      1 | `tests/integration/strava/runs-page-sync-error.test.jsx` |
|      1 | `tests/integration/strava/RunsPage.test.jsx`             |
|      1 | `tests/integration/strava/RunCalendarDialog.test.jsx`    |
|      1 | `tests/integration/strava/CallbackPage.test.jsx`         |

**預估**：1-1.5 day。

**Baseline drain after S5**：8 → 0（即 mock-boundary 部分 baseline 清空，S8 升級條件達成 mock-boundary 部分）。

> Baseline 數字 8 代表「block 18.6 ignores 中仍有 mock-boundary 違規的檔」歸零；list 內保留的 14 檔（block 18.6 第 47-33 名）是 flaky-only overlap，不影響 mock-boundary 規則行為。

**Risk flags**：

- **Strava CallbackPage.test.jsx** 涉及 OAuth callback fetch 邊界 → 高機率屬 Option A 個案。若是，handoff 移交給 P1-3 spec
- weather-page / township-drilldown 走 use-case → 第三方天氣 API（fetch）→ fetch 層 stub 屬合規邊界外 mock

---

### Session 規模對照表

| S        | 領域                               |     檔 |   違規 | baseline 變化                        | 預估         |
| -------- | ---------------------------------- | -----: | -----: | ------------------------------------ | ------------ |
| S1       | posts/ heavy                       |      5 |     20 | 33 → 28                              | 2-3 day      |
| S2       | posts/ rest + comments + dashboard |      6 |     13 | 28 → 22                              | 1-1.5 day    |
| S3       | notifications/                     |      9 |     22 | 22 → 13                              | 2 day        |
| S4       | events/ + profile/                 |      5 |     11 | 13 → 8                               | 1-1.5 day    |
| S5       | strava/ + weather/ + toast/        |      8 |     11 | 8 → 0 (mock-boundary)                | 1-1.5 day    |
| **合計** | —                                  | **33** | **77** | **47 → 14**（剩 flaky-only overlap） | **8-10 day** |

---

## 6. 共通約束（Non-Negotiable across all sessions）

1. **不動 `src/`** — 任何「為了測好寫所以改 src」的傾向 → 立刻 stop，flag 為 Option A 個案
2. **不擴規則 selector / 不縮 selector** — `eslint.config.mjs` 規則本體不動，只動 ignores list
3. **不用 `eslint-disable` inline** — 改寫成功才能拿掉 baseline；改不掉就保留在 baseline + handoff 移交
4. **每 session 一個 PR** — review 負擔均勻；不混 session 範圍
5. **PR template「Baseline tracking」必勾**（含 commit message `Baseline change: ...` 紀錄）
6. **coverage 不下降** — `npm run test:coverage` 完整跑一次，比較 base/HEAD coverage 數字（理論上應升或持平，因為移除 mock 後實際執行真實程式碼）；若下降代表 Option B 改寫漏了行為驗證
7. **保留合規 mock**（不要過度清）：
   - `@/config/client/firebase-client`（46 處，邊界外）
   - `@/runtime/providers/AuthProvider`、`@/runtime/providers/ToastProvider`（React context 邊界）
   - `next/navigation`、`next/link`（Next.js 邊界）
   - `firebase/firestore`、`firebase/auth`、`firebase/app`（SDK 邊界）
   - `leaflet`、`react-leaflet`（jsdom 不支援的第三方）
8. **flaky 違規處理規則**：
   - 改寫該檔時順手清掉同檔的 `toHaveBeenCalledTimes` → 改 `toHaveBeenLastCalledWith` / `toHaveBeenNthCalledWith` / `waitFor`
   - `setTimeout-Promise` 改 `waitFor(() => expect(...))` 或 `vi.useFakeTimers` + `vi.runAllTimersAsync`
   - 若該檔仍有 flaky 違規未清 → 從 18.6 ignores 移除後**必須**在 18.5 ignores 加入（否則 lint 會報），並在 PR description 註明
9. **不混入 P1/P2/P3 工作** — 順手清 flaky（同檔）OK，跨檔 flaky 不做、補測不做、scriptz 變動不做
10. **memory 對齊**：
    - `feedback_mock_discipline.md` — 邊界內 mock 是陷阱，本 spec 即在還這筆債
    - `feedback_test_writing_gotchas.md` — toHaveBeenCalledTimes 易 flaky；改寫時順手清
    - `feedback_audit_deliverable_only.md` — 本 spec 即把 audit P0-1 的 deliverable（報告）轉成行動，但不擴張至 P1+

---

## 7. 驗證指令

### Per-檔（最常跑）

```bash
# 改寫後跑單檔測試
npx vitest run tests/integration/posts/PostDetail.test.jsx

# 改寫後跑單檔 lint（mock-boundary + flaky 兩規則）
npx eslint tests/integration/posts/PostDetail.test.jsx

# 確認該檔 mock 違規歸零
grep -cE "vi\.mock\(['\"]@/(repo|service|runtime)/" tests/integration/posts/PostDetail.test.jsx
# Expected: 0
```

### Per-session（PR 前）

```bash
# 整 session branch 範圍
npm run test:branch       # 只跑 changed file 的 vitest
npm run lint:branch       # 只 lint changed
npm run type-check:branch # 只 type-check changed

# coverage 對比（baseline vs HEAD）
git -C /path/to/main worktree
npm run test:coverage  # base coverage
git checkout 027-mock-cleanup-SX
npm run test:coverage  # HEAD coverage，比較數字

# baseline 大小（per PR 應遞減）
sed -n '513,563p' eslint.config.mjs | grep -cE "^\s*'tests/integration/"
```

### 全 spec 進度

```bash
# 剩餘 mock-boundary 違規檔數
grep -rEln "vi\.mock\(['\"]@/(repo|service|runtime)/" tests/integration --include="*.test.*" | wc -l
# Expected progression: 33 → 28 → 22 → 13 → 8 → 0

# 剩餘 mock-boundary 違規處數
grep -rEn "vi\.mock\(['\"]@/(repo|service|runtime)/" tests/integration --include="*.test.*" | wc -l
# Expected progression: 77 → 57 → 44 → 22 → 11 → 0
```

---

## 8. Cross-session pattern reference（S1 pilot 後填）

> S1 pilot 完成後，把成功的 setup pattern 寫進 handoff.md（不寫 plan.md，因為 pattern 是 evolving）。
> S2-S5 開工前 read handoff.md「Setup pattern reference」段。

預期會記錄到 handoff 的內容：

- 用 `vi.hoisted()` 抽 mockShowToast / mockPush / mockAuthContext 的標準骨架
- `firebase/firestore` 應該 mock 哪些 export 才算完整（`getDoc, getDocs, addDoc, updateDoc, deleteDoc, runTransaction, query, where, orderBy, limit, startAfter, collection, collectionGroup, doc, serverTimestamp, increment, writeBatch, onSnapshot, ...`）
- mockResolvedValue 控制 Firestore document 結構（`{ id, exists, data: () => ({...}) }`）的範例
- runTransaction stub 寫法（`runTransaction.mockImplementation(async (db, callback) => callback({ get, set, update, delete }))`）
- 哪些 case 真的失真 → flag 為 Option A 個案

---

## 9. Out of scope 細節（避免 PR 漂移）

下列項目本 spec **明示不做**，留給後續 spec：

| 項目                                                | 屬 audit 哪段 | 預期後續 spec              |
| --------------------------------------------------- | ------------- | -------------------------- |
| `tests/unit/lib/**` 的 cross-lib mock 清理          | P0-1 第三批   | 028 或 030                 |
| `tests/unit/runtime/**` 的 service/repo mock 清理   | P0-1 第二批   | 029                        |
| `tests/unit/api/**` 的 use-case mock 清理           | P0-1 + P1-3   | 待 P1-3 整合測試補上       |
| 26 hooks 補測（renderHook）                         | P1-1          | 多 sprint，獨立 spec       |
| auth-service / AuthProvider 直測                    | P1-2          | 獨立 spec                  |
| Strava OAuth callback 真 integration / E2E          | P1-3          | 獨立 spec（含 nock）       |
| 109 處 toHaveBeenCalledTimes 跨檔批次清             | P1-4          | flaky cleanup spec         |
| setTimeout-Promise 跨檔批次清                       | P1-5          | 同上                       |
| 規則 selector 從 `@/(repo\|service\|runtime)/` 擴大 | audit §12 R6  | 觸發型，本 spec 完成後評估 |
| S8 / S9 升級（warn → error / per-dir threshold）    | audit §12.7   | 本 spec 完成後觸發         |

---

## 10. Done definition

本 spec 整體完成的判定條件：

- [ ] 5 個 PR 全部 merged
- [ ] `eslint.config.mjs` block 18.6 ignores list 從 47 → 14（只剩 flaky-only overlap 14 檔）
- [ ] `grep -rEn "vi\.mock\(['\"]@/(repo|service|runtime)/" tests/integration --include="*.test.*" | wc -l` 回 0
- [ ] `npm run test:coverage` 整體覆蓋率 ≥ S6 baseline（不下降）
- [ ] handoff.md 內「Setup pattern reference」段有可複用樣板（≥ pilot 後）
- [ ] 任何 flag 為 Option A 個案的檔 → handoff.md 列舉並指向後續 spec 編號

---

## 11. 與 audit / 026 spec 的銜接

```
audit P0-1 (L77-111)
    │
    ├── 規則建立  → spec 026 S6 (PR #25 merged)
    │              eslint.config.mjs:513-586 block 18.6（ignores baseline 47）
    │
    ├── 規則 enforce 機制 → spec 026 S7（GitHub UI required check 已勾，PR #27）
    │
    └── baseline drain → spec 027（本 spec）
                         33 檔 / 77 violations 改寫
                         baseline 47 → 14
                         │
                         └── S8 觸發（warn → error 升級 mock-boundary 部分）
                             ESLint rule 對全 codebase 生效（baseline ignore 已歸零）
                             audit-mock-boundary.sh exit 0 → exit 1
                             (flaky 部分仍待後續 spec)
```
