# Implementation Plan: Layered Dependency Architecture

**Branch**: `021-layered-dependency-architecture` | **Date**: 2026-04-22 | **Spec**: external brief (`Harness engineering: leveraging Codex in an agent-first world`)
**Input**: user brief + OpenAI Harness Engineering article + repo-local architecture audit + `dependency-cruiser` enforcement goal

## Summary

本工作要把目前以 `src/lib` / `src/components` / `src/contexts` / `src/app` 為主的鬆散結構，重構成可被機械驗證的 forward-only 架構：

`Types -> Config -> Repo -> Service -> Runtime -> UI`

同時把 `Providers` 正式納入 `Runtime.Provider`，不再留灰區；`src/app/**` 回到 thin entry files（`page/layout/route`），其餘業務邏輯移到 `src/runtime/**` 與 `src/ui/**`。最終以 `dependency-cruiser` 做 resolved graph 驗證，且第一次正式接線就必須 `0 violation`，不接受 baseline、grandfathered violations、或先排除舊檔。

## Technical Context

**Language/Version**: JavaScript (ES modules) + JSDoc + `checkJs: true`  
**Primary Dependencies**: Next.js 15、React 19、Firebase v9、Vitest、Playwright、ESLint 9  
**Storage**: Firestore / Firebase Auth / Firebase Storage  
**Testing**: Vitest (unit + integration)、Playwright (e2e)、ESLint、TypeScript JSDoc checking  
**Target Platform**: Web (Next.js App Router; browser + server route handlers)  
**Project Type**: Single Next.js application  
**Constraints**:

- `dependency-cruiser` 首次正式接線必須 `0 violation`
- `Providers` 必須入模
- `specs/**/tests` 不可整包排除，需拆成四桶規則
- 每個實作 session 只做一個任務，做完更新 handoff 並 commit
- 保持 repo 既有 `specs/<feature>/tests/...` 慣例

## Constitution Check

| 原則             | 狀態    | 備註                                                             |
| ---------------- | ------- | ---------------------------------------------------------------- |
| I. SDD/TDD       | ✅ PASS | 重構分 session 進行，測試調整在專屬 session 處理                 |
| II. 嚴格服務層   | ✅ PASS | 本計畫的核心就是把 service/repo/runtime/ui 邊界機械化            |
| III. UX 一致性   | ✅ PASS | Session 1 僅建立 docs/guardrails，未更動產品 UX                  |
| IV. 效能與併發   | ✅ PASS | 先做架構與邊界拆分，避免大檔混層持續擴大                         |
| V. 程式碼品質    | ✅ PASS | 以責任拆分 + mechanical enforcement 為主，不做表面搬目錄         |
| VI. 現代化標準   | ✅ PASS | 依既有 JSDoc / React / ESLint 慣例進行                           |
| VII. 安全與機密  | ✅ PASS | server-only 邊界將在後續 session 正式入模                        |
| VIII. 代理人互動 | ✅ PASS | 每個 task 一個 session，worker + reviewer 平行，handoff 作為真相 |
| IX. 絕對編碼鐵律 | ✅ PASS | 先固定 write scopes 與 review checklist，避免大範圍混改          |

## Target Structure

```text
src/
├── app/                    # Next entry files only: page / layout / route
├── types/                  # domain types / shared declarations
├── config/
│   ├── client/
│   ├── server/
│   └── geo/
├── repo/
│   ├── client/
│   └── server/
├── service/
├── runtime/
│   ├── providers/
│   ├── hooks/
│   ├── client/
│   └── server/
└── ui/

specs/021-layered-dependency-architecture/
├── plan.md
├── tasks.md
└── handoff.md
```

**Structure Decision**: 不再對整包 `src/lib/**` 打單一層標籤，而是按責任拆進 `types/config/repo/service/runtime`。`src/app/**` 只保留 entry；純 UI 元件進 `src/ui/**`；provider/context/hook 與 controller/use-case 進 `src/runtime/**`。

## Layer Matrix

### Canonical dependency directions

```text
types   -> types
config  -> types
repo    -> config | types
service -> repo | types
runtime -> service | types
ui      -> runtime | types
```

### Role constraints

- `provider = src/runtime/providers/**`
- `entry = src/app/**/(page|layout|route).{js,jsx}`
- `server-only = src/{config,repo,runtime}/server/**` or `*.server.*`
- `adapter = src/repo/**`
- `use-case = src/runtime/**/use-cases/**`
- `infra = src/config/**`

Additional rules:

- `Providers` 正式屬於 `runtime + provider`，不得直接 import `repo`
- `entry` 不得直接 import `config` 或 `repo`
- `server-only` 不得被 client/runtime/ui import
- production code 不得 import `specs/**`

## Enforcement Model

### dependency-cruiser responsibilities

- 驗證六層 resolved import graph
- 驗證 `provider-no-repo`
- 驗證 `entry-no-config/repo-direct-import`
- 驗證 `server-only-no-client-import`
- 驗證 production code 不可回邊 import `specs/**`
- 驗證 `specs/**/tests` 四桶規則

### ESLint responsibilities

- 保留既有快速字面量限制：UI 不得直連 `firebase/*`
- 保留 `src/lib` 既有禁 React/Next 類規則，直到對應 session 完成搬遷
- 補 server-only / route-handler 類字面量 import 禁令時，以 ESLint 作 fast feedback

### Test bucket rules

- S014 的唯一 canonical rules artifact path 是 `specs/021-layered-dependency-architecture/test-bucket-policy.js`；`specs/021-layered-dependency-architecture/test-buckets/policy.js` 僅保留 compatibility re-export，S016 應直接接這份 artifact。
- policy 目前驗證的是真實 tests import graph，包含 `import` / `import()` / `export ... from`；representative allow/deny 則由 Vitest 直接驗 helper，避免把 `vi.mock(...)` 與實際 import graph 混在一起。
- `unit`: `specs/**/tests/unit/**/*.{js,jsx,mjs}`  
  allow external、relative、`src/lib/**`、`src/config/**`、`src/repo/**`、`src/service/**`、`src/runtime/**`、`src/app/api/**`
  deny `src/components/**`、`src/contexts/**`、`src/hooks/**`、`src/app/**` non-api、`src/runtime/providers/**`
- `integration`: `specs/**/tests/integration/**/*.{js,jsx,mjs}`  
  allow external、relative、`src/app/**`、`src/components/**`、`src/contexts/**`、`src/hooks/**`、`src/runtime/**`、`src/lib/**`、client-facing `src/config/{client,geo}/**`、`src/data/**`
  deny direct `src/repo/**`、`src/service/**`、`src/config/server/**`
- `e2e`: `specs/**/tests/e2e/**/*.{js,jsx,mjs}`  
  allow external、same-feature e2e relative imports、`specs/test-utils/e2e-helpers.js`
  deny direct `src/**` imports；目前真實 repo graph 對 `src/**` 為 `0 violation`
- `specs-test-utils`: `specs/test-utils/**/*.js`  
  allow external + internal relative imports that stay inside `specs/test-utils/**`；目前真實 repo graph 對 `src/**` 為 `0 violation`
- 以上 policy 在真實 repo graph 下，目前 `unit` bucket 固定是 4 個 violation files；`integration`、`e2e`、`specs-test-utils` 皆為 `0 violation`
  - `specs/009-global-toast/tests/unit/toast-context.test.jsx`
  - `specs/010-responsive-navbar/tests/unit/isActivePath.test.js`
  - `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`
  - `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`
- 以上 policy 在真實 repo import graph 下，目前 `unit` bucket 正好只剩 4 個真衝突，留待 S015 處理；`integration`、`e2e`、`specs-test-utils` 皆為 0 violation
  - `specs/009-global-toast/tests/unit/toast-context.test.jsx`
  - `specs/010-responsive-navbar/tests/unit/isActivePath.test.js`
  - `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`
  - `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`

## Known Blockers

必須納入後續 session 的高風險點：

1. `src/lib/firestore-types.js` 是 value re-export leak，不可保留。
2. `src/lib/firebase-admin.js` 混合 config / repo / use-case，且 server-only 邊界未被驗證。
3. `src/lib/firebase-profile-server.js` 是 server-only repo adapter，仍藏在 `src/lib`。
4. `src/lib/weather-helpers.js` 混合 service logic、常數、URL encode/decode、`localStorage` runtime。
5. `src/lib/firebase-events.js`、`firebase-posts.js`、`firebase-member.js`、`firebase-notifications.js` 都是 repo/service/use-case 混檔。
6. `src/lib/firebase-storage-helpers.js` 同時使用 browser runtime 與 storage repo。
7. `src/contexts/AuthContext.jsx`、`NotificationContext.jsx` 直接依賴 repo，Providers 尚未正式化。
8. `src/app/events/page.jsx`、`eventDetailClient.jsx`、`PostDetailClient.jsx`、`components/weather/WeatherPage.jsx` 等大檔同時承擔 UI + runtime + service/repo。
9. tests 四桶 policy 已先以 feature-local artifact 落地，但 S016 尚未正式接線 `dependency-cruiser`；目前真衝突的 unit 檔仍為：
   - `specs/009-global-toast/tests/unit/toast-context.test.jsx`
   - `specs/010-responsive-navbar/tests/unit/isActivePath.test.js`
   - `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`
   - `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`

## Session Execution Model

每個後續 session 都要遵守：

1. 只做 `tasks.md` 裡的一個 session task。
2. 開始前先讀 `plan.md`、`tasks.md`、`handoff.md`。
3. 每個 task 必須有 worker 與 reviewer 平行工作。
4. reviewer 在施工中就要糾偏，不得等全部做完。
5. 主 agent 整合 reviewer 結論後，才允許收尾。
6. 結束前必更新 `handoff.md`：狀態、證據、踩坑、下一棒說明。
7. 每個 task 完成且主 agent 審核通過後，先打一個 commit；全部完成後才開 PR。

## Verification Strategy

每個 session 的最小驗證：

- `npm run type-check:changed`
- `npm run lint:changed`
- 該 session 自己影響範圍的最小 Vitest / dep-cruise 驗證

最後 enforcement rollout session 的完整驗證：

- `npm run type-check`
- `npm run lint`
- relevant `vitest` suite(s)
- `dependency-cruiser` 全量驗證

## Session 1 Deliverables

- 建立本檔 `plan.md`
- 建立 `tasks.md`，把後續 session 拆成單一任務工作包
- 建立 `handoff.md` 作為跨 session 真相來源
- 在 `handoff.md` 寫入 Session 1 完成紀錄與 Session 2 啟動說明
