# Harness 六層架構導入計畫（per-domain + Providers）

## Context

`dive-into-run` 目前是 flat 結構（113 檔 src、80+ 檔 specs），有 10+ 檔 UI/Context 直接 import Repo 層、`firebase-notifications.js:17` 有 Repo→Repo 隱性違規、Service 層 0 個檔案（helpers 誤放 `src/lib/`）。用戶正在做 harness engineering 投資（memory：`project_harness_mock_audit`、`project_harness_lint_followup`），這是下一步。

目標架構來自 OpenAI harness engineering 文章（Ryan Lopopolo）：每個 business domain 內部固定六層 Types → Config → Repo → Service → Runtime → UI，嚴格 forward-only 依賴；橫切關注點走 Providers；跨 domain 工具走 Utils。規則用 ESLint 機械攔截，錯誤訊息給 agent 修復指引。

用戶決策：
1. Scope = 7 domain（events, posts, comments, weather, members, strava, notifications）+ 3 providers（auth, firebase-connector, toast）+ utils
2. Service 層建立並從 helpers 搬
3. PR 策略：barrel re-export 過渡 → 最後 codemod 掃除
4. 最終狀態一次到位，不留雙軌；可分多個 atomic PR

---

## 最終目錄結構

```
src/
├── domains/                    # 7 個業務主題
│   ├── events/{types,config,repo,service,runtime,ui}/
│   │   └── index.js            # public API barrel（只暴露 service/runtime/ui + types）
│   ├── posts/    ... 同上
│   ├── comments/ ... 同上
│   ├── weather/  ... 同上
│   ├── members/  ... 同上
│   ├── strava/   ... 同上
│   └── notifications/ ... 同上
├── providers/                  # 橫切關注點
│   ├── auth/                   # AuthContext + firebase-auth-helpers
│   ├── firebase-connector/     # firebase-client + firebase-admin + firestore-types
│   └── toast/                  # ToastContext + Toast UI
├── utils/                      # 跨 domain 純工具
│   ├── og.js                   # ex src/lib/og-helpers.js
│   ├── taiwan-locations.js     # ex src/lib/taiwan-locations.js
│   ├── types/                  # 跨 domain 共享 typedef（Actor 等）
│   └── ui/icons/               # ex src/components/icons/
└── app/                        # Next.js 路由（薄 wrapper）
    └── events/page.jsx         # import EventsPageClient + render
```

---

## 分層定義（每層允許 import 的範圍）

| 層 | 可 import | 禁止 |
|---|---|---|
| **utils** | 只自己 | 任何 domain、provider |
| **provider** | utils、另一個 provider | 任何 domain（不反向依賴） |
| **domain types** | 同 domain types + utils | 其他 domain、任何 runtime 值 |
| **domain config** | 同 domain types/config + utils | 其他 domain、Repo、SDK |
| **domain repo** | 同 domain types/config + provider + utils | 其他 domain repo（★修掉現況違規）、React、Next |
| **domain service** | 同 domain 內一切 + 其他 domain 的 public index + provider + utils | 其他 domain internal（只走 index） |
| **domain runtime** | 同 domain 內一切 + 其他 domain 的 public index + provider + utils + React 生態 | 其他 domain internal |
| **domain ui** | 同 domain types/config/service/runtime/ui + public index + provider + utils | **Repo 絕對禁止** |
| **app (Next.js)** | domain public index + domain ui + provider + utils | — |

### 歸屬細節

- **Types 跨 domain 共享** → 升到 `src/utils/types/`（如 `Actor` 被 notifications/comments/posts 共用）
- **Config vs Utils**：單一 domain 用 = config；跨 domain = utils
- **Runtime 層涵蓋**：custom hook、domain context（如 `NotificationContext`）、route handler 內部邏輯、`'use server'` action
- **Next.js page/layout/route 檔案留在 `src/app/`**（Next 硬要路徑）但**不用 re-export**，用 `import ClientComponent + render` pattern（避免破壞 `'use client'` 邊界）

---

## PR 分批（13 個 atomic PR）

### 基礎建設（3 PR）
| PR | 內容 | 檔數 |
|---|---|---|
| **PR 1** | 建空 `src/domains/`、`src/providers/`、`src/utils/` + 裝 `eslint-plugin-boundaries` + 設 `boundaries/elements` 但規則全 `off` | ~3 |
| **PR 2** | Providers: firebase-connector（搬 `firebase-client.js` + `firebase-admin.js` + `firestore-types.js`，舊位置留 barrel） | 6 |
| **PR 3** | Providers: auth + toast（搬 `AuthContext` + `firebase-auth-helpers` + `ToastContext` + `Toast*.jsx`） | 12 |
| **PR 4** | Utils: `og-helpers` → `utils/og.js`、`taiwan-locations.js` → `utils/` | 4 |

### 各 domain 搬遷（7 PR，耦合度由低到高）
| PR | Domain | 關鍵動作 |
|---|---|---|
| **PR 5** | weather | 自成一體最低耦合；包含 `weather-api.js` 的 route handler 邏輯搬 runtime |
| **PR 6** | strava | 含 `useStrava*`、`useRunCalendar`、4 個 `app/api/strava/*/route.js` 的內部邏輯 |
| **PR 7** | posts | 相對獨立 |
| **PR 8** | comments | 依賴 posts/events/notifications，barrel 擋住 |
| **PR 9** | events | **體積最大**，`src/app/events/page.jsx`（1500+ 行）要拆到 `domains/events/ui/EventsPageClient.jsx`，保留 `app/events/page.jsx` 當 server component薄 wrapper |
| **PR 10** | notifications | **最複雜**，修掉 `firebase-notifications.js:17` Repo→Repo 違規：`fetchParticipants` 呼叫移到 `notifications/service/`，透過 `@/domains/events` public index |
| **PR 11** | members | Navbar + Dashboard + Profile 交織，拆 `firebase-profile.js`（client）+ `firebase-profile-server.js`（server）為 `members-repo.js` + `members-server-repo.js` |

每個 domain PR 的標準步驟：
1. 建六層子目錄 + `index.js` public API barrel
2. 搬檔，舊位置留 barrel（`export * from '@/domains/<d>/...'`）
3. 該 domain 的消費端 import **不改**（全走舊 barrel）
4. 只對 `src/domains/<d>/**` 打開 boundaries 規則
5. 跑 domain 相關 test + 全量 lint + tsc

### 收尾（2 PR）
| PR | 內容 |
|---|---|
| **PR 12** | 全域開啟 boundaries `"error"` + 修跨 domain 殘留違規（預估 5–15 檔 import 調整） |
| **PR 13** | Codemod cleanup：寫 `scripts/harness-codemod.mjs`（jscodeshift）一次改 137 處 `vi.mock('@/lib/firebase-*')` + 所有剩餘 `from '@/lib/...'`；刪 `src/lib/`、`src/hooks/`、`src/contexts/`、`src/components/` 裡的 barrel 殘留 |

**PR 大小上限**：單 PR ≤ 20 檔（理想）/ ≤ 40 檔（硬上限）。超過就拆。

---

## ESLint 規則（eslint-plugin-boundaries + no-restricted-imports 分工）

**分工**：
- `boundaries/dependencies`：管「誰能依賴誰」的拓撲
- `no-restricted-imports`（現有）：繼續管「這個 package 不能出現在這裡」的黑名單

### 關鍵 settings（寫在 `eslint.config.mjs`）

```javascript
settings: {
  'boundaries/elements': [
    { type: 'provider', pattern: 'src/providers/*', mode: 'folder', capture: ['name'] },
    { type: 'util', pattern: 'src/utils/**/*', mode: 'file' },
    { type: 'domain-types',   pattern: 'src/domains/*/types/**/*',   capture: ['domain'] },
    { type: 'domain-config',  pattern: 'src/domains/*/config/**/*',  capture: ['domain'] },
    { type: 'domain-repo',    pattern: 'src/domains/*/repo/**/*',    capture: ['domain'] },
    { type: 'domain-service', pattern: 'src/domains/*/service/**/*', capture: ['domain'] },
    { type: 'domain-runtime', pattern: 'src/domains/*/runtime/**/*', capture: ['domain'] },
    { type: 'domain-ui',      pattern: 'src/domains/*/ui/**/*',      capture: ['domain'] },
    { type: 'domain-index',   pattern: 'src/domains/*/index.js',     capture: ['domain'] },
    { type: 'app',            pattern: 'src/app/**/*',               mode: 'file' },
  ],
},
```

### 關鍵規則重點

1. **Domain 內 UI/Runtime/Service/Repo 只能同 domain** — 用 `captured: { domain: '{{from.captured.domain}}' }` 鎖住
2. **跨 domain 只能走 `domain-index`** — 強制走 public API
3. **`domain-repo` 只能 import 同 domain types/config + provider + utils**（擋 Repo→Repo 違規）
4. **`domain-ui` 禁止 import `domain-repo`**（擋 UI→Repo 直連）
5. **`provider` 不能 import `domain-*`**（橫切不反向依賴業務）
6. **`app` 是特殊 type**，可 import domain public index + domain ui + provider + utils（Next.js 路由自由度）

### 錯誤訊息範例（給 agent 的 remediation）

**UI → Repo 直連**：
> UI {{from.captured.domain}} 嘗試 import domain-repo {{dependency.source}}。UI 層不能直接觸碰 Repo — Firestore CRUD 應該封裝在 Service 或 Runtime（hook）後才暴露。修復方法：1) 資料讀取寫 useX hook 放 runtime/；2) 寫入/跨 collection 寫 service/；3) UI 只 import hook 或 service 函式。

**Repo → 另一個 Repo**（修掉現況 `firebase-notifications.js:17`）：
> Repo {{from.captured.domain}} 不能 import Repo {{to.captured.domain}}。Repo 層是 collection-level wrapper，跨 collection 的寫入流程應該放在 service/。請把 `fetchParticipants` 的呼叫移到 `domains/notifications/service/notifications-service.js` 的 `notifyNewComment` 裡，並透過 `@/domains/events` public index 呼叫。

**跨 domain 進 internal**：
> UI {{from.captured.domain}} 嘗試 import domain-ui `{{dependency.source}}`。跨 domain 只能透過 public index（`@/domains/<d>`）。修復方法：1) 確認該元件要不要從 index 暴露；2) 若是共用 UI primitive，升到 `src/utils/ui/`。

### Barrel 過渡期豁免（PR 5–11 期間）

```javascript
{ files: ['src/lib/**', 'src/hooks/**', 'src/contexts/**', 'src/components/**'],
  rules: { 'boundaries/dependencies': 'off' } }
```
PR 13 codemod 完成後刪除此 block。

---

## Barrel Re-export 模板

```javascript
// src/lib/firebase-events.js
// TRANSITIONAL BARREL (harness migration). Remove in PR 13 codemod.
// eslint-disable-next-line boundaries/dependencies
export * from '@/domains/events/repo/events-repo';
export * from '@/domains/events/types/event-types';
```

**重點**：
- 用 `export *` 而非 named re-export（named re-export 某些情況不帶 typedef）
- 同時 re-export repo + types，避免 JSDoc `import('@/lib/firebase-events').EventData` 失效
- 每個 barrel 一定要 line-level eslint-disable，標明 transitional

**Server-only 檔的 barrel**（`firebase-admin`、`firebase-profile-server` 等）：
```javascript
import 'server-only';
// eslint-disable-next-line boundaries/dependencies
export * from '@/providers/firebase-connector/firebase-admin';
```
必須 mirror 原檔的 `server-only` / `'use server'` directive，否則 client bundle 防護失效。

---

## 測試影響面（實測數字）

- **137 處** `vi.mock('@/lib/firebase-*', ...)` 分散在 **79 個測試檔**
- **38 個** src 非測試檔有 `from '@/lib/firebase-*'`
- 預估 PR 13 codemod 要動 **150–170 檔 test file**

**過渡期 vi.mock 不用改**（barrel forward 生效），例外：
- `importActual + override`（partial mock）在 ESM 下部分 getter 可能 readonly，要直接指向 canonical path
- Emulator server 測試若用 `await import('@/lib/firebase-events')` 動態 load 可能觸發 firebase-admin lazy init 順序問題（memory `feedback_firebase_emulator_vitest` 坑之一）—— PR 9 合入前全量跑 `npm run test:server`

**Service 層必寫 unit test**（防 coverage 黑洞）：
- 每個 domain PR 同時產出 `specs/harness-<domain>-service/tests/unit/<domain>-service.test.js`
- Service test 用 `vi.mock('@/domains/<other>', ...)` mock 其他 domain 的 public index
- PR 13 後新增 CI check：`src/domains/*/service/**` line coverage ≥ 60%

**Specs 目錄結構不動**（按 feature branch 分），只改內部 import 字串。

---

## Top 5 風險 + 緩解

### 風險 1：`firebase-admin` 洩漏進 client bundle
- `providers/firebase-connector/firebase-admin.js` 第一行 `import 'server-only';`（Next.js 15 原生）
- Providers public index 只 export client symbol；admin 強制走完整路徑便於 grep
- 新增 no-restricted-imports：非 `src/app/api/**` 或 server repo/runtime 的檔案禁 import `firebase-admin`

### 風險 2：Next.js `'use client'` 邊界在薄 wrapper 失效
- **絕對不用 `export { default } from` 做 page wrapper**
- 標準 pattern：`page.jsx` 是 server component，`import EventsPageClient + render`，`EventsPageClient.jsx` 自標 `'use client'`
- `generateMetadata` 留在 `page.jsx` 或從 `@/domains/<d>/ui/<d>-metadata.js`（server helper）import

### 風險 3：JSDoc typedef 跨檔 import 在 tsc 下壞掉
- Barrel 一律 `export *` 同時 re-export repo + types
- 每個 domain PR 跑 `tsc --noEmit` 針對 `src/domains/<d>/**`
- 備案：PR 1 就建立關鍵 types 檔（`event-types.js` 等）空殼，讓 import 路徑提前穩定

### 風險 4：server-only barrel 沒 mirror directive
- 寫死在 barrel 模板（見上節）
- PR 11（members）特別注意 `firebase-profile-server.js` 這個 hack 要正名為 `members-server-repo.js`

### 風險 5：husky pre-commit 中途狀態卡住
- PR 內中間 WIP commit 允許 `--no-verify`（僅本地 rebase 前）
- **最後一個 commit 必須綠**（barrel 齊、lint 過、tsc 過、test 過）
- PR 13 codemod 絕對不能 bypass，codemod 完一次跑 `npm run lint && type-check && test`

---

## 驗證（每階段 gate）

### 每個 PR 完成
- [ ] `npm run lint` 全綠
- [ ] `npm run type-check` 全綠
- [ ] `npm run test` 全綠
- [ ] husky pre-commit 最後一 commit 沒 bypass
- [ ] barrel 齊全，任何舊 `@/lib/*` import 仍 resolve
- [ ] Reviewer agent 對照 plan 逐項核對 → 合格（見下「執行工作流程」）

### PR 5–11（各 domain）
- [ ] 該 domain 所有 test 檔執行通過（unit + integration）
- [ ] `tsc --noEmit` 針對 `src/domains/<d>/**` 無錯
- [ ] 該 domain 的 boundaries 規則打開後無 violation
- [ ] Service 層至少 smoke test 覆蓋

### PR 9（events，最大）特別
- [ ] `src/app/events/page.jsx` 搬完後仍是 server component（`generateMetadata` 執行正常）
- [ ] `'use client'` 邊界在 bundle analyzer 下正確（client chunk 不含 server 邏輯）

### PR 10（notifications）特別
- [ ] `firebase-notifications.js:17` Repo→Repo 違規消失
- [ ] boundaries 規則能抓到還原測試（故意加一行 Repo→Repo 要被擋）

### PR 12（全域開規則）
- [ ] `npm run lint` 在 `src/domains/`、`src/providers/`、`src/utils/` 上無 violation
- [ ] Barrel 區域 豁免 block 仍存在，舊 path 能 resolve

### PR 13（codemod cleanup）
- [ ] `src/lib/`、`src/hooks/`、`src/contexts/`、`src/components/` 除 `icons/` 外清空或刪除
- [ ] 0 個 `@/lib/firebase-*` import 或 `vi.mock('@/lib/*')` 殘留（grep 驗證）
- [ ] 全量 test 綠（含 emulator `test:server`）
- [ ] Bundle size 不變或下降（barrel 移除後）
- [ ] 新增 CI check：`src/domains/*/service/**` coverage ≥ 60%

---

## 關鍵檔案

### 必讀（啟動前）
- `/Users/chentzuyu/Desktop/dive-into-run/eslint.config.mjs` — 現有 flat config + no-restricted-imports
- `/Users/chentzuyu/Desktop/dive-into-run/src/lib/firebase-notifications.js` — Repo→Repo 違規樣本
- `/Users/chentzuyu/Desktop/dive-into-run/src/lib/firebase-events.js` — 最大 Repo
- `/Users/chentzuyu/Desktop/dive-into-run/src/app/events/page.jsx` — 最大 UI 檔（PR 9 的核心）
- `/Users/chentzuyu/Desktop/dive-into-run/src/app/layout.jsx` — Providers 掛載點
- `/Users/chentzuyu/Desktop/dive-into-run/tsconfig.json` — `@/*` alias、`checkJs`

### PR 13 要產出
- `/Users/chentzuyu/Desktop/dive-into-run/scripts/harness-codemod.mjs` — jscodeshift 腳本

### 可重用的既有工具
- `scripts/lint-changed.sh`、`type-check-branch.sh`、`test:branch` — 每 PR 跑 branch-level check
- `.husky/pre-commit` — 維持跑 lint + type-check + spellcheck + vitest

---

## 執行工作流程（Teammate 模式）

### 角色分工

| 角色 | 身份 | 主要職責 | 工具權限 |
|---|---|---|---|
| **Tech Lead** | 主對話 Claude（我） | 分派任務、轉遞 feedback、追蹤 13 PR 進度、處理卡關 | 全部 |
| **Executor**（subagent A）| `general-purpose` agent，name: `executor` | 按照當前 PR 規格施工（搬檔、改 import、寫 barrel、寫 Service test、跑 lint/tsc/test 自測） | Write / Edit / Bash / Read / Grep / Glob |
| **Reviewer**（subagent B）| `Explore` agent（read-only 取向），name: `reviewer` | 對照 plan 逐項核對 Executor 產出；發現偏離立即回報具體違規點 + 修復指引；**不允許改 code** | Read / Grep / Glob / Bash（只讀） |

### 每個 PR 的標準循環（Checkpoint-Based Review）

**核心原則**：Reviewer **常駐監督**，不是完工才審。Executor 把 PR 拆成 N 個 checkpoint（CP），每個 CP 完成就暫停回報，Reviewer 當場審，合格才繼續下一 CP。**不可以一口氣做完整個 PR 才第一次 review**。

```
Tech Lead：先 async spawn Reviewer（idle 等命令）
     ↓
Tech Lead：spawn Executor，明示「拆 N 個 checkpoint，每個做完暫停回報」
     ↓
Executor 做 CP1 → 回報 diff + 執行紀錄 → 暫停等 Tech Lead 指令
     ↓
Tech Lead：SendMessage Reviewer 「審 CP1，規格見 plan X 段」+ 附 diff
     ↓
Reviewer ── ✅ 合格 ─→ Tech Lead：SendMessage Executor「CP1 過，做 CP2」
             ↓
          ❌ 不合格：列具體違規（檔案:行 + 為何違規 + 修復指引）
             ↓
Tech Lead：SendMessage Executor「CP1 修：[Reviewer feedback]」
             ↓
Executor 修 → 回報 → Reviewer 再審 → 通過為止
     ↓
（repeat 到 CP-N）
     ↓
最後 CP = commit + PR 開啟；Reviewer 在 PR diff 上做 PR-level 總 audit
```

**為什麼這個 pattern 關鍵**：
- 早期 CP 出錯（例如 ESLint 規則寫錯）若累積到最後才發現，修改面積大
- 配置類 CP（裝套件、改 config）風險最高，要第一時間審
- 「完工才審」實際上等於 agent-to-agent 的 YOLO，違反 Reviewer 存在的意義

**CP 切法原則**（Executor 自行拆分，Reviewer 審 CP 切法是否合理）：
- 1 CP 約 5-15 分鐘 agent 時間
- 按**類別**切（配置、新建檔案、重構、驗證），不按行數
- 高風險類別（配置、server-only、跨層依賴）一定獨立成 CP
- CP 之間要能獨立 revert（Executor 用多 commit 而非 amend）

### 關鍵原則（非協商項）

1. **不等 PR 全部做完才 review**：每個 PR 都要 Reviewer 當輪過關才進下一個。
2. **Reviewer 發現偏離立即糾正**：不累積、不打包到最後。
3. **糾正是 Executor 的工作**：Reviewer 只指出 + 給指引，不動手改。
4. **連續兩輪審不過**：Tech Lead 介入評估是否 plan 本身要調整（例如該 PR 需要拆更小）。
5. **Reviewer 無權限寫 code**：防止 Reviewer 偷偷「順手修好」而讓規則繞過。
6. **Executor 自測不是 Review 的代替品**：Executor 過 lint/test 只是入場券，不等於合規 — Reviewer 才判斷是否按 plan。
7. **踩坑要寫進 memory**：遇到 plan 沒涵蓋的坑（非單純決策，而是「下次不該這樣做」的教訓），立刻寫進 auto memory（`~/.claude/projects/-Users-chentzuyu-Desktop-dive-into-run/memory/`）做成 feedback 類型記憶，避免後續 agent 或新 session 繼續踩。詳見下節「Pitfall → Memory 流程」。

### Reviewer 每 PR 核對清單（對照 plan 的「驗證」section）

**共通項**（每 PR 都查）：
- [ ] 檔案搬動範圍 = plan 該 PR 指定範圍（不多搬、不少搬）
- [ ] Barrel 格式符合模板（`export *`、`// eslint-disable-next-line`、`TRANSITIONAL BARREL` 標記）
- [ ] Server-only 檔的 barrel 有 mirror `import 'server-only'`
- [ ] 新增的 ESLint 規則符合 plan 定義（`boundaries/elements`、allow list、錯誤訊息含 remediation）
- [ ] 舊 import path 全部仍 resolve（grep `from '@/lib/<移動的檔名>'`，回應都指向 barrel）
- [ ] `npm run lint && type-check && test` 執行紀錄附上且全綠
- [ ] 無意外的 a11y `eslint-disable`、無 `@ts-ignore`、JSDoc 規範符合（`{object}` 小寫、`@property` 有描述）

**PR 特定項**：Reviewer 打開 plan 相應 section（如 PR 9 特別項、PR 10 特別項）逐條核對。

### Final Audit（全 13 PR 完成後）

Reviewer 做一次完整 audit，不限 PR 範圍：
- [ ] `src/lib/`、`src/hooks/`、`src/contexts/`、`src/components/`（除 `icons/`）已空或刪除
- [ ] `grep -r "@/lib/firebase-" src specs` 結果為 0
- [ ] `grep -r "vi.mock('@/lib/" specs` 結果為 0
- [ ] `src/domains/` 每個 domain 六層目錄齊全
- [ ] `src/providers/` 3 個 provider 齊全，`firebase-admin.js` 有 `import 'server-only'`
- [ ] ESLint `boundaries/dependencies` 為 `error` 無 violation；故意加一行 `repo → repo` 測試能被擋
- [ ] `firebase-notifications.js:17` 的 Repo→Repo 違規確實修掉（notifications service 改組合呼叫）
- [ ] 每個 domain 的 service 層有對應 `specs/harness-<domain>-service/tests/unit/` 測試，coverage ≥ 60%
- [ ] Bundle size 不升高（與 PR 1 前比較）
- [ ] 全量 `test` + `test:server`（emulator）綠

Final audit 報告格式：每項附執行的具體指令 + 輸出證據（通過）或違規清單（未通過）。

### Agent spawn 細節（供 Tech Lead 執行時參考）

- Executor 用 `isolation: "worktree"` 隔離工作（PR 9 這種大搬家特別需要），降低中途狀態汙染主 tree 的風險
- Executor 每次回報必須包含：本輪動了哪些檔、執行了哪些指令、指令輸出摘要、遇到的決策點
- Reviewer 每次審查必須引用 plan file 的具體段落 + 對應 Executor 的檔案:行
- Tech Lead 每 PR 完成後更新 TaskList 進度（用 TaskCreate / TaskUpdate 追 13 項）**且同步更新 repo 內 tracker 文件**（見下節）

---

## Repo 內進度追蹤文件（Session-Durable Tracker）

**問題**：本 plan file 在 `~/.claude/plans/`，只主 session 看得到。新 session 開啟時 CLAUDE.md 是 always-loaded，但它沒有 migration 狀態；其他 agent（Executor/Reviewer）不一定會讀這個 plan。

**解法**：把 plan 的 canonical 副本 + 進度追蹤落到 repo 內，讓任何 session、任何 agent 都能 read。

### 檔案結構

```
docs/harness-migration/
├── PLAN.md          # 本計畫的完整副本（immutable，PR 1 開始時 copy 過去）
├── PROGRESS.md      # 進度追蹤 + 當前狀態 + handoff notes（每 PR 更新）
└── DECISIONS.md     # 實作過程中遇到的決策 log（append-only）
```

### `PROGRESS.md` 內容骨架

```markdown
# Harness Migration Progress

> Plan：見 [PLAN.md](./PLAN.md)。本檔追蹤進度與當前狀態。

## Quick Context（新 session 30 秒上手）
- 在做：per-domain 六層架構遷移（OpenAI harness pattern）
- Scope：7 domain + 3 providers + utils
- 總計 13 atomic PR，barrel re-export 過渡 → 最後 codemod 掃除
- Agent 模式：Tech Lead 發包 → Executor 施工 → Reviewer 監督

## 進度儀表板
| PR | 內容 | 狀態 | Executor | Reviewer | PR Link | Notes |
|---|---|---|---|---|---|---|
| 1 | Scaffold + eslint 骨架 | ⬜ 待開始 | — | — | — | — |
| 2 | Providers: firebase-connector | ⬜ | — | — | — | — |
| 3 | Providers: auth + toast | ⬜ | — | — | — | — |
| 4 | Utils | ⬜ | — | — | — | — |
| 5 | Domain: weather | ⬜ | — | — | — | — |
| 6 | Domain: strava | ⬜ | — | — | — | — |
| 7 | Domain: posts | ⬜ | — | — | — | — |
| 8 | Domain: comments | ⬜ | — | — | — | — |
| 9 | Domain: events（最大）| ⬜ | — | — | — | — |
| 10 | Domain: notifications（修 Repo→Repo）| ⬜ | — | — | — | — |
| 11 | Domain: members | ⬜ | — | — | — | — |
| 12 | ESLint 全開 | ⬜ | — | — | — | — |
| 13 | Codemod cleanup + final audit | ⬜ | — | — | — | — |

狀態圖例：⬜ 待開始 / 🟨 進行中 / 🔄 Review 中 / 🔴 卡關 / 🟢 已合併

## 當前 PR 狀態
（進行中時填，空閒時寫 "無"）

### PR-X 實作紀錄
- Executor 上一輪動作：...
- 產出 diff 摘要：...
- 自測結果：lint/tsc/test 是否全綠

### PR-X Review 紀錄
- Reviewer 上一輪結論：✅ / ❌
- 若 ❌：違規清單 + 修復指引
- 第幾輪 review（超過 2 輪要 Tech Lead 介入）

## Session Handoff Notes
（每次 session 結束由 Tech Lead 寫，下一 session 第一件事讀這裡）

### 最新 handoff（日期 YYYY-MM-DD）
- 上輪結束時狀態：PR X 進到哪一步
- 遇到但未解決的問題：...
- 下 session 該做什麼：...
- 需要使用者決策的事項：...

## 已完成 PR 紀錄（append-only）
（每個 PR 合併後填）
```

### `DECISIONS.md` 內容骨架

```markdown
# Harness Migration: Decision Log

實作過程中遇到的非預期決策點 append 在這。格式：

## YYYY-MM-DD — <決策標題>
- **情境**：遇到什麼問題
- **選項**：A / B / C
- **選擇**：B
- **理由**：...
- **影響的 plan 段落**：PLAN.md 的 X 章節（若需更新 plan 一併記）
```

### 更新責任矩陣

| 檔案 | 誰寫 | 何時寫 |
|---|---|---|
| `PLAN.md` | Tech Lead | PR 1 開始時複製 plan file 進 repo；之後 immutable（若需修改走 DECISIONS.md + 更新 PLAN.md 並註明） |
| `PROGRESS.md` 儀表板 | Tech Lead | 每 PR 開始、完成、卡關時 |
| `PROGRESS.md` 當前狀態 | Tech Lead | 每輪 Executor/Reviewer 回報後 |
| `PROGRESS.md` Handoff | Tech Lead | 每次 session 結束時 |
| `DECISIONS.md` | Tech Lead | 遇到 plan 沒涵蓋的決策點 |
| Executor 實作紀錄 | Executor 產出、Tech Lead 貼入 | 每輪 Executor 完成後 |
| Reviewer 結論 | Reviewer 產出、Tech Lead 貼入 | 每輪 Reviewer 完成後 |

### Pitfall → Memory 流程（避免後續 agent 踩坑）

**三種紀錄分工**（別搞混）：

| 紀錄 | 目的 | 生命週期 |
|---|---|---|
| `PROGRESS.md` | 進度狀態（做到哪） | PR 結束後歸檔 |
| `DECISIONS.md` | 有意決策（為何選 A 不選 B） | 專案 lifetime |
| **memory** | 踩過的坑 + 不要再這樣做的教訓 | **跨 session、跨專案**（feedback type） |

**觸發條件**（符合任一就寫 memory）：
- 非預期的工具行為（例：某個 barrel 寫法在 tsc 下壞、某個 ESLint 規則在 flat config 的 regex 坑、Next.js bundler 對 `'use client'` re-export 的 edge case）
- 踩了既有 memory（如 `feedback_firebase_emulator_vitest`）沒涵蓋的新坑
- Agent（包含自己未來的 session）容易再犯的陷阱
- 「為什麼這樣寫？因為那樣會炸，上次炸過」這類**經驗性**教訓

**不觸發**（這些走別的紀錄）：
- 決定 A 而非 B（→ DECISIONS.md）
- PR 進度延誤（→ PROGRESS.md）
- 程式碼層級的 convention（→ `.claude/rules/` 或 CLAUDE.md）

**操作步驟**：

1. 踩坑當下：Tech Lead 停手，先搞清楚根因（不是症狀修完就走）
2. 寫入 memory：到 `~/.claude/projects/-Users-chentzuyu-Desktop-dive-into-run/memory/` 建 `feedback_harness_<topic>.md`
3. 格式（feedback type 標準）：
   ```markdown
   ---
   name: <短標題>
   description: <一行，讓未來 session 決定是否要讀>
   type: feedback
   ---

   <規則 / 教訓一句話>

   **Why:** <為什麼會踩這個坑，具體事件>
   **How to apply:** <下次遇到什麼情境要套用這條>
   ```
4. 加到 `MEMORY.md` index：`- [標題](feedback_harness_<topic>.md) — 一句話 hook`
5. 若這個坑也影響 plan → 同時更新 DECISIONS.md + 修正 PLAN.md 對應段落
6. 若既有 memory 已涵蓋類似主題 → **優先 update 既有檔案**，不要新建重複

**Reviewer 的額外責任**：
- 若 Reviewer 發現 Executor 做的方式和 memory 中既有 feedback 衝突 → 在 review 回報引用具體 memory 檔名 + 段落
- 若發現 Executor 踩的坑已經在 memory，代表 memory 沒被讀到 → 除了修 code，也要 flag「agent 沒讀 memory 的流程問題」

**範例**（假想情境）：

- PR 5 遇到 `eslint-plugin-boundaries` 的 `captured` 變數在 flat config 下用 `{{from.captured.domain}}` 展開失敗（假想）
- → 寫 `memory/feedback_harness_boundaries_capture.md`
- → description: `eslint-plugin-boundaries flat config 的 captured 變數展開坑`
- → body:「在 flat config 用 `captured` 時，`{{from.captured.X}}` 不會跨 rule 傳遞；解法是把 capture 邏輯改用 `importKind` 或 ...」
- → `MEMORY.md` 加：`- [boundaries capture 坑](feedback_harness_boundaries_capture.md) — flat config 下 captured 變數不跨 rule，要用替代寫法`

### 新 session 啟動 SOP

1. 讀 `CLAUDE.md`（自動 loaded，會有 pointer）
2. 讀 `docs/harness-migration/PROGRESS.md` 的「Quick Context」+「進度儀表板」+「最新 handoff」
3. 若要深入細節 → 讀 `PLAN.md`
4. 若要理解某個決策為何 → 讀 `DECISIONS.md`
5. 繼續工作

### CLAUDE.md 要加的 pointer（PR 1 同步加）

在 `CLAUDE.md` 的「Reference Docs」表加一列：

```
| 文件 | 狀態 | 用途 |
| `docs/harness-migration/PROGRESS.md` | 🔄 進行中 | Harness 六層架構遷移進度（13 PR） |
```

---

## 執行順序總覽

```
PR 1 (scaffold + eslint off)
  ↓
PR 2 (firebase-connector) → PR 3 (auth + toast) → PR 4 (utils)
  ↓
PR 5 (weather) → PR 6 (strava) → PR 7 (posts) → PR 8 (comments)
  ↓
PR 9 (events) → PR 10 (notifications) → PR 11 (members)
  ↓
PR 12 (eslint 全開) → PR 13 (codemod cleanup)
```

每 PR 約 0.5–2 天工作量，總計約 3 週（純 harness 工作，不含其他 feature）。PR 9 和 PR 13 是最危險的兩個 checkpoint，需要預留多一天 debug buffer。
