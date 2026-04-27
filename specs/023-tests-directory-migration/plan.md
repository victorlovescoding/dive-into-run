# 測試目錄重組計畫（對齊 speckit 官方，4 階段）

> **狀態**：規劃中，**尚未實作**。本文件為 self-contained 計畫書，未來 session 直接讀本檔即可 resume。
> **建立**：2026-04-26（Phase 0 於 2026-04-26 補入）
> **規劃者**：Tech Lead（chentzuyu）+ Claude
> **預估工期**：1.5 週（Phase 0 + 3 階段）
> **PR 策略**：Phase 0 獨立 PR → main 觀察 24h → Phase 1 PR → … 每階段獨立 PR

---

## TL;DR（30 秒）

**現況**：135 個測試檔放在 `specs/<NNN-feature>/tests/{unit,integration,e2e}/`，22 個 numbered feature 累積。

**問題**：你以為這是照 spec-kit 做的，**實際上 spec-kit 官方 plan-template Option 1 (DEFAULT) 推的是頂層 `src/` + `tests/` 分離**。當前結構是「漏掉頂層 tests/ 的半套 speckit」。

**痛點**：(1) 改 src/ 時對應 unit test 難找；(2) 跨 feature 改動要翻多個 spec folder（例 notifications 散在 014/015）；(3) 沒長期維護過測試，擔心功能演化讓 spec snapshot 結構磨壞。

**結論**：對齊 spec-kit + Playwright 官方推薦結構 — 全部測試移到頂層 `tests/{unit,integration,e2e,_helpers}/`，specs/<NNN>/ 只剩 spec artifacts。

**選定方向**：方案 A 頂層 tests/，**非** Hybrid colocate（用戶比較完優缺點後選定）。

**4 階段架構**：Phase 0（quality gate 整備，~250 行 diff）→ Phase 1（unit 68 檔 mv）→ Phase 2（integration 52 檔 mv）→ Phase 3（E2E 15 檔 + helpers + cleanup）。Phase 0 是 2026-04-26 補入的關鍵前置整備 — 沒做這步直接 mv 會撞 6 個 hidden cost 中的 3 個。

---

## Session 討論軌跡（給 future session 補 context）

本計畫經過數輪修正，記錄關鍵決策點：

1. **第一輪推薦**：Claude 誤以為用戶堅持 spec-driven snapshot 結構，推「混合 colocate-only-unit」。
   → 用戶 reject：「我沒說一定要放 specs/，主要想知道業界普遍怎麼做」。
2. **第二輪推薦**：Claude 改推「分階段對齊業界」（Phase 1 colocate + Phase 2 拆 spec/tests），靠的是 Claude 的「業界印象」。
   → 用戶 reject：「不要靠你印象，依官方推薦或官方示範的位置」。
3. **第三輪查證**：Claude 用 Context7 + WebFetch 查 spec-kit / Playwright / Vitest / Next.js 四家官方。發現 spec-kit `templates/plan-template.md` Option 1 default 明文示範頂層 `tests/{contract,integration,unit}`，Playwright `npm init` 預設也是頂層 tests/，**用戶當初照 speckit 做但實際上沒對齊到 speckit**。
   → 用戶質疑：「四個官方都一樣？」
4. **第四輪精準化**：Claude 校正回答 — speckit + Playwright **強推**頂層 tests/，Vitest + Next.js **中性**（接受 colocate 也接受頂層）。但四家都跟頂層 tests/ 相容，只有 Vitest + Next.js 也允許 colocate。
5. **第五輪選方案**：用戶看「頂層 tests/ vs Hybrid colocate」優缺點對比後選方案 A 頂層 tests/。
6. **第六輪本文件初版**：用戶要求只產出 md 不實作，留給未來 session 快速 resume。Hidden Cost 列 3 個（policy.js / SKILL.md / testing-standards.md）。
7. **第七輪 Phase 0 補入（2026-04-26 本次）**：用戶要求協助詳細規劃「三階段前的 Hidden Cost」。重新精準盤點後發現 3 個遺漏：
   - `test-bucket-policy.test.js:124` 的 `.toEqual` 4-bucket 斷言（policy.js 加新 bucket 必紅）
   - `package.json` 4 個 script（lint/depcruise/depcruise:json/spellcheck）只掃 `src specs`，新 tests/ 失明
   - SKILL.md 不只 line 60-62，總共 9 處寫死路徑
     另外釐清 `.dependency-cruiser.mjs` 真正引用的是 `test-bucket-policy.js`（59 行 re-export shim），SoT 在 `test-buckets/policy.js`。決策：Phase 0 獨立 PR、補入本計畫書變 4 階段。

**Future session 啟動時優先讀**：

- 本文件「終局結構」+「Hidden Cost」+「Phase 0」三段（5 分鐘進入狀況）
- `~/.claude/plans/2026-04-26-tests-directory-migration-md-gleaming-flamingo.md`（Phase 0 完整實作 patch，含 policy.js 7 處 patch、smoke test、Risk Register）
- `~/.claude/plans/repo-specs-test-specs-peppy-key.md`（更早的版本，本檔已涵蓋更精準內容）

---

## 官方查證（4 個來源 — 精準版）

**不是四家都「強推」同一件事**：

| 工具                      | 立場                                             | 引用 / 證據                                                                                                                                                                                                                | 來源                                                                                                                               |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **spec-kit**              | **強推**頂層 `tests/{contract,integration,unit}` | 「This separation maintains a clear distinction between specification artifacts and executable test code.」plan-template Option 1 (Single project) DEFAULT                                                                 | [github.com/github/spec-kit `templates/plan-template.md`](https://github.com/github/spec-kit/blob/main/templates/plan-template.md) |
| **Playwright**            | **強推**頂層 `tests/`                            | `npm init playwright@latest` 預設建立 `tests/example.spec.ts`；testDir 範例 `./tests` 或 `./tests/playwright`                                                                                                              | playwright.dev `intro-js`、`class-testconfig`                                                                                      |
| **Vitest**                | **中性**                                         | 「There's no single 'right' way to organize your test files. Some teams prefer placing tests right next to the source code they test, while others keep them in a dedicated directory. Vitest will find them either way.」 | vitest.dev `guide/learn/writing-tests`                                                                                             |
| **Next.js (with-vitest)** | **中性**                                         | with-vitest example 沒明寫 file tree，跟 Vitest 預設相容                                                                                                                                                                   | nextjs.org `guides/testing/vitest`                                                                                                 |

**頂層 tests/ 的合理性**：四家全相容；speckit + Playwright 強推；Vitest example config 也用 `./test/unit/` + `./test/e2e/`。

---

## 推薦終局結構

```
src/                                    # 100% 生產碼，無測試夾雜
├── types/        config/        repo/
├── service/      runtime/       ui/
└── lib/

specs/<NNN-feature>/                    # 純 spec artifacts
├── spec.md
├── plan.md
├── tasks.md
├── checklists/
└── contracts/
    （speckit 範本還有 research.md / data-model.md / quickstart.md，本專案目前沒用，不影響）

tests/                                  # 全部測試集中
├── unit/                               # mirror src/<layer>/
│   ├── service/event-service.test.js
│   ├── repo/firebase-posts.test.js
│   ├── runtime/use-something.test.js
│   └── lib/...
├── integration/                        # 按 domain
│   ├── posts/
│   ├── notifications/
│   ├── auth/
│   ├── events/
│   ├── weather/
│   ├── profile/
│   ├── strava/
│   └── map/
├── e2e/                                # Playwright 預設位置
│   ├── posts.spec.js
│   ├── notifications.spec.js
│   └── _setup/
│       └── global-setup.js
└── _helpers/                           # 從 specs/test-utils/ 搬來
    ├── e2e-helpers.js
    └── mock-helpers.js
```

**解決的痛點**：

- 痛點 (1) ✅ 100% — IDE 用名稱對應 `src/service/X.js` ↔ `tests/unit/service/X.test.js`
- 痛點 (2) ✅ 100% — notifications 跨 feature 邏輯集中 `tests/integration/notifications/`
- 隱憂 (3) ✅ 80% — 測試演化跟 src/ 同步，不再凍結 spec snapshot

---

## ⚠️ Hidden Cost（任何 mv 動作之前必先處理的依賴點）

**完整盤點 = 6 個**（2026-04-26 第七輪精準化發現原列 3 個只覆蓋 50%）。任一漏處理直接 mv 會破壞 quality gate 防線、靜默失效、CI block 或路徑漂移。

### Phase 0 處理（5 個，必須先於任何 mv）

#### 1. `specs/021-layered-dependency-architecture/test-buckets/policy.js`（**SoT，5 處 patch**）

**SoT vs Shim 釐清**：

```
.dependency-cruiser.mjs:5
    └─ import './specs/021-.../test-bucket-policy.js'   ← 59 行 shim（被引用）
                                                            │
                                                            ▼ re-export 全部
                            './test-buckets/policy.js'      ← 825 行 SoT（真正改這裡）
```

改 SoT → shim 自動傳遞 → depcruise 看到新 bucket。**shim 不必動**（line 6-31 已 import 所有外部 named export，新 bucket 是物件鍵值不算新 export）。

**5 處 patch（同一 commit）**：

| Patch | line    | 改動                                                                                                                                                                                |
| ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | 11-16   | `TEST_BUCKET_FILE_PATTERNS` 加 4 個新 bucket：`unit-tests-root` / `integration-tests-root` / `e2e-tests-root` / `tests-helpers`，舊 4 個並存                                        |
| B     | 18-33   | `DEPCRUISE_DENY_PATTERNS` 同步加 4 個 entry（複製對應舊 bucket 的 deny 規則）                                                                                                       |
| C     | 122-175 | `TEST_BUCKET_RULES` append 4 entries。**注意 self-ref**：`allowedSurfaceIds` 必須提升為 module-level frozen const (`UNIT_ALLOWED_SURFACES`/`INTEGRATION_ALLOWED_SURFACES`) 共享引用 |
| D     | 222-265 | `depCruiseTestBucketRules` append 4 entries                                                                                                                                         |
| E     | 267-308 | **`TEST_BUCKET_DEPCRUISE_ARTIFACTS` push 4 entries**（最關鍵：`.dependency-cruiser.mjs:102-143` iterate 的是這個 array，漏 push → bucket 不啟動）                                   |
| F     | 455-486 | `isAllowedRelativeDependency` 早返擴張 `unit-tests-root`/`integration-tests-root`、新增 `tests-helpers` 分支、e2e 分支正則擴張支援 `tests/e2e/` 與 `tests/_helpers/e2e-helpers.js`  |

`KNOWN_S015_CONFLICTS`（policy.js:177-218 的 8 條豁免）Phase 0 不動，路徑在 Phase 1 mv unit 後同步更新。

#### 2. `specs/021-.../tests/unit/test-bucket-policy.test.js:124`（**原計畫書遺漏**）

```js
expect(TEST_BUCKET_DEPCRUISE_ARTIFACTS.map((a) => a.bucket)).toEqual([
  'unit',
  'integration',
  'e2e',
  'specs-test-utils', // 舊
  'unit-tests-root',
  'integration-tests-root',
  'e2e-tests-root',
  'tests-helpers', // 新
]);
```

policy.js 加 4 個 bucket 但測試斷言固定在 4-bucket → 測試紅 → CI block。**必須與 Patch A-F 同 commit**，永不分開。

#### 3. `package.json` 4 個 script（**原計畫書遺漏**）

| line | 現狀                                                 | Phase 0 後                   |
| ---- | ---------------------------------------------------- | ---------------------------- |
| 9    | `"lint": "eslint src specs"`                         | 加 `tests`                   |
| 11   | `"depcruise": "... src specs"`                       | 加 `tests`                   |
| 12   | `"depcruise:json": "... src specs"`                  | 加 `tests`                   |
| 18   | `"spellcheck": "cspell ... \"src/**\" \"specs/**\""` | 加 `\"tests/**/*.{js,jsx}\"` |

否則 mv 後新 tests/ 目錄不在 quality gate 掃描範圍內，eslint / depcruise / spellcheck 對新位置失明。

#### 4. `.claude/skills/test-driven-development/SKILL.md`（**原計畫書只列 line 60-62，實際 9 處**）

| Line        | 動作                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 34, 36, 37  | 保留 — `specs/<branch>/` 仍是 spec artifacts (`spec.md`/`plan.md`/`tasks.md`) 路徑                                               |
| 60-62       | `mkdir -p specs/$BRANCH/tests/{...}` → `mkdir -p tests/{unit,integration,e2e}`，移除 `test-results`                              |
| 84          | Glob `specs/*/tests/unit/*.test.js` → `tests/unit/**/*.test.js`                                                                  |
| 88, 96, 108 | `Path: $TEST_PATH/{unit\|integration\|e2e}/` → 直接寫 `tests/{unit/<layer>\|integration/<domain>\|e2e}/`，移除 `$TEST_PATH` 變數 |
| 118         | `e.g. specs/$BRANCH/tests/unit/login.test.jsx` → `tests/unit/<layer>/login.test.jsx`                                             |
| 142-144     | `npx vitest run $TEST_PATH/unit ...` → `npx vitest run tests/unit/<layer>/<file> ...`                                            |
| 146         | `specs/<branch-name>/test-results/` → `tests/test-results/`                                                                      |

並存說明：在 Step 2.5 開頭加註「若分支已有 `specs/<branch>/tests/`，新檔仍可放舊位置直到該 spec 進入 Phase 1-3 遷移」。

#### 5. `.claude/rules/testing-standards.md:13-14`

```diff
- - Test structure: `specs/<feature>/tests/[unit|integration|e2e]/`
- - Test results: `specs/<feature>/test-results/[unit|integration|e2e]/`
+ - Test location（Phase 1-3 並存期）:
+   - 新增測試: `tests/{unit/<layer>,integration/<domain>,e2e}/<name>.test.js`
+   - 既有測試: `specs/<feature>/tests/[unit|integration|e2e]/` 仍接受，由 Phase 1-3 統一遷出
+ - Test results: `tests/test-results/[unit|integration|e2e]/`（legacy: `specs/<feature>/test-results/`）
```

### Phase 3 處理（1 個 — 動態路徑 + branch scripts）

#### 6. 動態路徑與 branch scripts（5 個檔案，整批 Phase 3 改）

| 檔案                             | line    | 依賴                                                         |
| -------------------------------- | ------- | ------------------------------------------------------------ |
| `playwright.emulator.config.mjs` | 25-46   | `E2E_FEATURE` env var 三向綁定 `specs/${feature}/tests/e2e/` |
| `playwright.config.mjs`          | 7-8     | `testDir` 預設指向 specs/                                    |
| `scripts/test-branch.sh`         | 6-7     | `SPEC_DIR="specs/$BRANCH/tests"`                             |
| `scripts/test-e2e-branch.sh`     | 7,15-18 | 同上 pattern                                                 |
| `scripts/run-all-e2e.sh`         | 58      | `for e2e_dir in specs/*/tests/e2e` glob 迴圈                 |

Phase 3 一次重寫，獨立 PR（playwright.emulator.config.mjs 重寫風險最高，建議跟 e2e mv 分開 PR）。

### 不擋路的（已 ready，原計畫書已 ack）

- **`eslint.config.mjs:372`** 已 allow `tests/**/*.{js,jsx,mjs}`
- **`vitest.config.mjs`** test pattern 自動發現 `tests/**` 不需動；`coverage.include` 跟 spec 021 layered architecture 脫節，重組時順手擴大到 `src/{service,repo,runtime,lib,config}/**`

---

## Migration 4 階段

每階段獨立 PR，**main 觀察穩定後才進下一階段**。可連著做（共 1.5 週），也可分散做。

### Phase 0：Quality Gate 整備（半天～1 天）

**動 quality gate 路徑、補規範、建空目錄；不動任何測試檔。獨立 PR，main 觀察 24h 才開 Phase 1。**

> 完整實作 patch（policy.js 7 處 patch、smoke test、Risk Register、Rollback plan）→ `~/.claude/plans/2026-04-26-tests-directory-migration-md-gleaming-flamingo.md`
>
> 為何獨立階段：上方 Hidden Cost 6 個中有 5 個必須在 mv 之前處理（policy.js / test-bucket-policy.test.js / package.json / SKILL.md / testing-standards.md）。任一漏處理直接 mv → quality gate 靜默失效或 CI block。

#### 6 步 checklist

| #   | 動作                                                                                                | 檔案                                                                                               | 必先於   |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| 0.1 | policy.js Patch A-F + test-bucket-policy.test.js `.toEqual` 8-bucket（**同一 commit**）             | `specs/021-.../test-buckets/policy.js` + `specs/021-.../tests/unit/test-bucket-policy.test.js:124` | 所有後續 |
| 0.2 | 4 個 script 加 `tests`                                                                              | `package.json` (lint / depcruise / depcruise:json / spellcheck)                                    | Step 0.3 |
| 0.3 | 建 `tests/{unit/{service,repo,runtime,lib,config},integration,e2e/_setup,_helpers}/.gitkeep` 空目錄 | 新建                                                                                               | Step 0.6 |
| 0.4 | 重寫並存期規範                                                                                      | `.claude/rules/testing-standards.md:13-14`                                                         | PR       |
| 0.5 | 重寫 9 處寫死路徑                                                                                   | `.claude/skills/test-driven-development/SKILL.md`                                                  | PR       |
| 0.6 | smoke test 全綠 → 開 PR                                                                             | —                                                                                                  | merge    |

#### Smoke Test

```bash
npm run depcruise && npm run lint && npm run type-check && npm run spellcheck && npm run test
```

並存驗證（4 個 node 一行確認舊 `specs/<NNN>/tests/` 仍 classify 為舊 bucket、新 `tests/` 被新 bucket 認得）→ 詳見 plan 檔 V1-V4。

#### Phase 0 完成判準

- 8 buckets 註冊（舊 4 + 新 4）
- 舊 135 檔仍 0 violations（並存模式）
- 5 個 quality gate 全綠
- main merge 後跑滿 24h 無 CI 紅

#### 主要 Risk（完整 6 條 → plan 檔 Risk Register）

| #   | 場景                                                                          | 預防                                                                          |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| R1  | `test-bucket-policy.test.js:124` `.toEqual` 4-bucket 沒同步改 → CI block      | Patch A-F 與 G **同一 commit**，永不分開                                      |
| R2  | `isAllowedRelativeDependency` 早返沒擴張 → 新 bucket 走進 e2e 分支誤判        | Patch F 早返擴張**先寫**，補單測                                              |
| R6  | Patch C/D 寫 `TEST_BUCKET_RULES.unit.allowedSurfaceIds` self-ref → 物件建構中 | 提升為 module-level frozen const (UNIT/INTEGRATION_ALLOWED_SURFACES) 共享引用 |

---

### Phase 1：unit tests 移走（1-2 天）

**移最大批（68 檔 unit），痛點 (1) 解掉**

> ⚠️ Phase 0 已完成 quality gate 整備，本階段 Step 1.1 / 1.3 / 1.5 自動跳過，從 Step 1.2 (vitest coverage) + Step 1.4 (mv) 開始。新增 Step 1.7：mv 後同步更新 `KNOWN_S015_UNIT_CONFLICTS` 8 條豁免路徑。

#### Step 1.1：~~重寫 policy.js bucket~~ → ✅ 已在 Phase 0 完成

跳過。Phase 0 PR 已將並存 bucket 啟動（舊 `specs/.+/tests/{unit,integration,e2e}` + 新 `tests/{unit,integration,e2e,_helpers}` 共 8 個 bucket）。下方原始 patch 內容保留作為歷史參考：

編輯 `specs/021-layered-dependency-architecture/test-buckets/policy.js`：

```js
// 加新 bucket
const TEST_BUCKET_FILE_PATTERNS = Object.freeze({
  // 舊的暫保留（Phase 2/3 才移除）
  unit: `^specs/.+/tests/unit/.+${TEST_FILE_PATTERN}$`,
  integration: `^specs/.+/tests/integration/.+${TEST_FILE_PATTERN}$`,
  e2e: `^specs/.+/tests/e2e/.+${TEST_FILE_PATTERN}$`,
  'specs-test-utils': '^specs/test-utils/.+\\.js$',
  // 新加（migration 期間並存）
  'unit-tests-root': `^tests/unit/.+${TEST_FILE_PATTERN}$`,
  'integration-tests-root': `^tests/integration/.+${TEST_FILE_PATTERN}$`,
  'e2e-tests-root': `^tests/e2e/.+${TEST_FILE_PATTERN}$`,
  'tests-helpers': '^tests/_helpers/.+\\.js$',
});

const DEPCRUISE_DENY_PATTERNS = Object.freeze({
  unit: Object.freeze([...]),  // 不動
  integration: Object.freeze([...]),  // 不動
  e2e: Object.freeze([...]),  // 不動
  'specs-test-utils': Object.freeze([...]),  // 不動
  // 複製 unit/integration/e2e 的 deny pattern 給新 bucket
  'unit-tests-root': Object.freeze([
    '^src/runtime/providers(?:/|$)',
    '^src/components(?:/|$)',
    '^src/contexts(?:/|$)',
    '^src/hooks(?:/|$)',
    '^src/app/(?!api(?:/|$))',
  ]),
  'integration-tests-root': Object.freeze([
    '^src/repo(?:/|$)',
    '^src/service(?:/|$)',
    '^src/config/server(?:/|$)',
  ]),
  'e2e-tests-root': Object.freeze(['^src/']),
  'tests-helpers': Object.freeze(['^src/']),
});
```

**驗證**：`npm run depcruise` 必須 pass。沒過 → 停手不要 mv 任何檔案。

#### Step 1.2：擴大 vitest coverage scope

編輯 `vitest.config.mjs:22-30`：

```js
coverage: {
  provider: 'v8',
  include: ['src/{service,repo,runtime,lib,config}/**'],  // 從 src/lib/** 擴大
  exclude: [
    'src/lib/taiwan-locations.js',
    'src/lib/weather-types.js',
    'src/lib/firebase-client.js',
    'src/lib/firestore-types.js',
    'src/**/*.test.{js,jsx}',  // 新加：排除 colocate test（防萬一）
    'src/lib/**/__tests__/**',
  ],
  thresholds: {
    lines: 80,  // 暫降，觀察新 scope 後再分階段提回 95
  },
},
```

#### Step 1.3：~~建立 tests/ 目錄結構~~ → ✅ 已在 Phase 0 完成

跳過。Phase 0 已建好下列空目錄含 `.gitkeep`：

```bash
tests/unit/{service,repo,runtime,lib,config}/
tests/integration/
tests/e2e/_setup/
tests/_helpers/
```

#### Step 1.4：`git mv` 68 個 unit 測試

對照原則：依 import 來源決定 layer。

- `import ... from '@/service/event-service'` → `tests/unit/service/event-service.test.js`
- `import ... from '@/repo/firebase-posts'` → `tests/unit/repo/firebase-posts.test.js`

每個 mv 都用 `git mv` 保留 history（之後 `git log --follow` 可看歷史）。

```bash
# 範例
git mv specs/006-strava-running-records/tests/unit/strava-service.test.js tests/unit/service/strava-service.test.js
```

#### Step 1.5：~~改 rules + skill 部分相關段落~~ → ✅ 已在 Phase 0 完成

跳過。Phase 0 已重寫 `.claude/rules/testing-standards.md:13-14` + `.claude/skills/test-driven-development/SKILL.md` 全部 9 處（Hidden Cost #4 / #5）。

#### Step 1.7：mv 後同步更新 `KNOWN_S015_UNIT_CONFLICTS`（**Phase 0 不動，Phase 1 隨 mv 同步**）

`policy.js:177-218` 的 8 條豁免路徑寫死在 `specs/<NNN>/tests/unit/X.test.jsx`。Step 1.4 mv 完後，這 8 條 `filePath` 全部要改成新位置：

```js
// 範例：
{
  filePath: 'tests/unit/components/PostCard.test.jsx',  // 從 specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx 改
  blockedSpecifier: '@/components/PostCard',
  expectedSurfaceId: 'src-components',
},
```

8 條對照（mv 前 → mv 後路徑）：

| 舊位置                                                                        | 新位置（依 import 來源）                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `specs/009-global-toast/tests/unit/toast-context.test.jsx`                    | `tests/unit/runtime/toast-context.test.jsx`       |
| `specs/010-responsive-navbar/tests/unit/isActivePath.test.js`（4 條共用此檔） | `tests/unit/lib/isActivePath.test.js`             |
| `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`（2 條共用此檔）    | `tests/unit/components/PostCard.test.jsx`         |
| `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`            | `tests/unit/components/PostCardSkeleton.test.jsx` |

**注意**：`unit-tests-root` bucket 的 `KNOWN_*_CONFLICTS` 機制 Phase 0 不動，因為 Phase 0 沒有任何測試檔在 `tests/unit/`，沒有要豁免的對象。Phase 1 mv 完才需要。

#### Step 1.6：驗證

```bash
npm run depcruise         # 必過 — `unit-tests-root` bucket 規則啟動，KNOWN_S015 豁免新位置生效
npm run test              # 必過 — Vitest 自動發現 tests/unit/**
npm run lint              # 必過
npm run type-check        # 必過
```

---

### Phase 2：integration tests 移走（2-3 天，含 domain 分組思考）

**跨 feature 痛點 (2) 解掉。Domain 分組是新工作，需要思考時間**

#### Step 2.1：規劃 domain 分組

列出 22 個 numbered feature → 歸類到 domain：

| Feature                    | 推測 domain（待確認）   |
| -------------------------- | ----------------------- |
| 001-event-filtering        | events                  |
| 002-event-creation         | events                  |
| 003-strict-type-fixes      | （多 domain，個別判斷） |
| 004-event-edit-delete      | events                  |
| 005-event-comments         | events / posts          |
| 006-strava-running-records | strava                  |
| 007-...                    | ...                     |
| ...                        | ...                     |
| 014-notification-system    | notifications           |
| 015-comment-notifications  | notifications           |
| 022-file-size-limits       | （依檔案而定）          |

**動作**：列完表 → 每支 integration 測試決定屬於哪個 domain → mv。

#### Step 2.2：`git mv` 52 個 integration 測試

```bash
# 範例
git mv specs/014-notification-system/tests/integration/NotificationToast.test.jsx \
       tests/integration/notifications/NotificationToast.test.jsx
git mv specs/015-comment-notifications/tests/integration/CommentReply.test.jsx \
       tests/integration/notifications/CommentReply.test.jsx
```

#### Step 2.3：改 testing-handbook + skill

- `.claude/references/testing-handbook.md` — line 46-59 等目錄慣例段、line 103/185/204/263/498 範例路徑
- `.claude/skills/test-driven-development/SKILL.md` — Step 2.5 integration 部分

#### Step 2.4：驗證

- `npm run test` 全綠
- 隨機抓 3 個 domain（例 posts、notifications、auth），確認該 domain 跨 feature 邏輯改動只動單一 folder

---

### Phase 3：E2E + helpers + cleanup（2 天）

**對齊 Playwright 官方 testDir 預設，speckit-flavored 結構徹底拆完**

#### Step 3.1：`git mv` 15 個 e2e 測試

```bash
git mv specs/<NNN>/tests/e2e/<X>.spec.js tests/e2e/<X>.spec.js
```

15 檔不多，可平鋪在 `tests/e2e/` 不分 domain；如果想分 domain 也可（看 e2e 是否大量擴張）。

#### Step 3.2：`git mv` test-utils

```bash
git mv specs/test-utils/ tests/_helpers/
```

#### Step 3.3：改 playwright.config.mjs

```js
// 編輯 playwright.config.mjs:7-8
testDir: './tests/e2e',
testMatch: '**/*.spec.js',
```

#### Step 3.4：改 playwright.emulator.config.mjs

拋棄 `E2E_FEATURE` ↔ spec folder 三向綁定（line 35,43,46 動態組 path）。改用 domain 概念或全跑 `tests/e2e/`。`global-setup.js` 移到 `tests/e2e/_setup/`。

#### Step 3.5：重寫 4 個 branch scripts

- `scripts/test-branch.sh:7,15-16` — 用 `git diff main...HEAD --name-only` 抓改動的 `tests/**/*.{test,spec}.*`
- `scripts/test-e2e-branch.sh:7-8,15-18`
- `scripts/run-all-e2e.sh:58,60`

#### Step 3.6：改 `.claude/rules/e2e-commands.md:3-4`

`paths` frontmatter 改成 `tests/e2e/**`、`**/*.spec.js`。

#### Step 3.7：移除舊 bucket（policy.js）

舊的 `unit` / `integration` / `e2e` / `specs-test-utils` bucket 已沒測試對應 → 移除。`KNOWN_S015_CONFLICTS`（policy.js:179-219）的 9 個豁免路徑：先確認新位置仍違規再決定保留/刪除。

#### Step 3.8：改 root docs

- `CLAUDE.md` — Architecture 段落、Commands 段落
- `AGENTS.md`、`GEMINI.md` — 同步更新

#### Step 3.9：驗證

```bash
npx playwright test       # 從 tests/e2e/ 跑起，全綠
npm run test:e2e:branch   # branch script 改完仍可運作
npm run depcruise         # 全綠
```

---

### Phase 4：文件收斂 + 後續維護拆分

**Phase 0+1+2+3 已完成主要測試目錄遷移**：browser unit/integration/e2e/helper 已從 `specs/<feature>/tests/` 收斂到 repo-root `tests/`，policy bucket 也已拆成 4 個 root bucket。Phase 4 不再做大批 `git mv`；它分成「本 session 文件收斂」與「後續工具/結構修正候選」兩類。

#### Phase 4A：文件收斂（本 session 負責）

本 session 只負責文件與 agent 指引收斂，目標是避免後續 Codex/Claude/Gemini session 再被舊路徑導回 `specs/$BRANCH/tests`。

| Task   | 範圍                 | 具體問題                                                                                                                                                                                                   | 驗收                                                                                                                                                                                                                                                       |
| ------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| P4-D01 | Codex-native rules   | `.codex/rules/testing-standards.md` 仍寫 `specs/<feature>/tests/[unit                                                                                                                                      | integration                                                                                                                                                                                                                                                | e2e]`；`.codex/rules/e2e-commands.md`仍寫`specs/**/e2e/**`與`npx playwright test specs/...` | Codex rules 改成 `tests/{unit,integration,e2e,_helpers}`，只把 `specs/g8-server-coverage/tests/unit/**` 標為 server-project exception |
| P4-D02 | Codex TDD skill      | `.codex/skills/test-driven-development/SKILL.md` 仍建立 `specs/$BRANCH/tests` 與 `specs/$BRANCH/test-results`，會把新測試寫回舊位置                                                                        | 新測試一律導向 `tests/unit/<layer>/`、`tests/integration/<domain>/`、`tests/e2e/`、`tests/test-results/`                                                                                                                                                   |
| P4-D03 | Testing handbooks    | `.codex/references/testing-handbook.md` 還以舊 `specs/<feature>/tests` tree 為主；`.claude/references/testing-handbook.md` 仍有「Phase 2 進行中」、`specs/test-utils/`、`specs/<feature>/tests/e2e` 過渡語 | Codex/Claude handbook 都描述 Phase 3 後終局：spec artifacts 在 `specs/`，可執行測試在 `tests/`，helpers 在 `tests/_helpers/`                                                                                                                               |
| P4-D04 | Root onboarding      | `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` 仍有 `specs = feature specs + tests`、單檔 Vitest 舊範例、spellcheck 掃描範圍舊描述；`GEMINI.md` 還寫 Playwright `testDir: ./specs`                                | 三份 root onboarding 與 `package.json` / Playwright / Vitest 目前設定一致                                                                                                                                                                                  |
| P4-D05 | 文件驗證             | 歷史 plan / inventory 會保留舊路徑，不能用全 repo grep 當唯一判斷                                                                                                                                          | `rg` active docs 時不得再出現會指導新工作寫到 `specs/<feature>/tests` 的內容；`specs/023-*` 內歷史記錄可保留                                                                                                                                               |
| P4-D06 | Specify constitution | `.specify/memory/constitution.md` 仍寫 `specs/<feature>/tests/[unit\|integration\|e2e]/` 與 `specs/<feature>/test-results/[unit\|integration\|e2e]/`                                                       | Constitution 改成可執行測試在 `tests/{unit/<layer>,integration/<domain>,e2e,_helpers}/`，spec artifacts 在 `specs/<feature>/`，server Vitest 例外為 `specs/g8-server-coverage/tests/unit/`，test results 在 `tests/test-results/[unit\|integration\|e2e]/` |

**本 session 不負責**：改 Playwright script 行為、搬 g8 server tests、拉高 coverage threshold、刪 `.gitkeep`、拆 helper/domain、移除 policy dead export。這些列在 Phase 4B。

#### Phase 4B：工具 / 結構後續候選（需另開 session）

> **2026-04-27 subagent 研究結論**：下表候選項多數不值得現在做。真正短期要排的是 P0 E2E tooling 語意修正；六個補充候選中，只有 branch script fallback 值得排在 P0 之後，其餘維持「觸發型延後債」。

| 優先級 | 項目                                                                 | 觸發條件 / 證據                                                                                                                                                                            | 建議                                                                                                                                                 |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0     | `playwright.emulator.config.mjs` + `scripts/run-all-e2e.sh` 語意修正 | 實測 `E2E_FEATURE=004-event-edit-delete npx playwright test --config playwright.emulator.config.mjs --list` 會列出全部 56 tests / 11 files；目前 `E2E_FEATURE` 只選 globalSetup，不選 spec | 另開工具修正 session：讓 feature setup 對應 feature spec，或改成全域 seed；修前後都用 `--list` 驗證                                                  |
| P0     | `scripts/test-e2e-branch.sh` changed-only 可信度                     | 沒有 `E2E_FEATURE` 時會用 vanilla config 跑 changed specs，無法自動對應需要 emulator/globalSetup 的 spec                                                                                   | 另開工具修正 session：依 changed spec 推導 setup，或明確 fallback 到 `run-all-e2e.sh`                                                                |
| P1     | branch scripts `git diff main...HEAD` fallback                       | 目前 `main...HEAD` 可抓到檔，觸發條件未成立；但只改未 commit test、feature-on-feature、或 local `main`/merge-base 異常時會 false skip                                                      | 值得做但排在 E2E P0 之後：讓 base 可參數化，`main...HEAD` 失敗時明確 warning，並補 staged/unstaged diff fallback                                     |
| P1     | g8 server tests 長期位置                                             | tracked `specs/**/tests/**` 只剩 `specs/g8-server-coverage/tests/unit/{firebase-admin,firebase-profile-server}.test.js`；目前是 server vitest project exception                            | 不搬到 `tests/unit/`；若要收斂，設計 `tests/server/` 並同步改 `vitest.config.mjs` server include + docs                                              |
| P1     | `npm test` / server project 易誤用                                   | `npm test` 是裸 `vitest`，server project 沒 emulator env 會 fail；正確入口是 `npm run test:server` / `test:coverage`                                                                       | 可新增 `test:browser` 並文件化「server/full coverage 需 emulator」                                                                                   |
| P1     | `.gitkeep` 過渡檔                                                    | Phase 0 為空 `tests/` 建 `.gitkeep`；Phase 1-3 已有大量真測試檔                                                                                                                            | 可另開 cleanup：刪 tracked `tests/**/.gitkeep` 後跑 lint/depcruise/spellcheck                                                                        |
| P2     | coverage threshold ratchet                                           | `vitest.config.mjs` 目前 `lines: 70`，coverage summary 實測約 70.55%；拉到 75 需多約 158 covered lines，80 需多約 335，95 需多約 867                                                       | 延後。main 穩定且實測高於下一階至少約 2% 後，採 70 → 75 → 80；不要做 80 → 95，也不要一次跳 95                                                        |
| P2     | `tests/e2e/` domain 分組                                             | 目前 11 個 `.spec.js` 平鋪，未達 30+；較明顯壓力是 `comment-notifications.spec.js` 單檔偏大，分 domain 目錄不會解決單檔過長                                                                | 不做。30+ spec、同 domain 明顯膨脹，或先完成 E2E tooling P0 後才考慮；短期若要改善，優先拆大 spec 而非搬目錄                                         |
| P2     | `tests/_helpers/` 拆子目錄                                           | 目前只有 `e2e-helpers.js`（約 202 行）與 `mock-helpers.js`（約 10 行）；沒有第三類 helper，且 policy / fixture 有精確路徑假設                                                              | 不做。第三類 helper 出現、`e2e-helpers.js` > 300 行，或 helper 職責真的混雜時，再設計 `tests/_helpers/e2e/` / `tests/_helpers/unit/` 並同步改 policy |
| P2     | `window.d.ts` 多型別整合                                             | 目前只剩 `tests/e2e/_setup/window.d.ts` 1 檔 11 行，只宣告 `window.testFirebaseHelpers`；4 份舊宣告已於 Phase 3 zero-diff 合併                                                             | 不做。等新 E2E helper 引入第二個 `window.*` global、`window.d.ts` 出現 feature-specific 分歧，或 type-check 對新 global 報錯再處理                   |
| P2     | policy dead export cleanup                                           | `KNOWN_S015_UNIT_CONFLICTS` 已是 empty export shape                                                                                                                                        | 下次碰 `test-buckets/policy.js` 時再收斂；非行為風險                                                                                                 |

#### Phase 4 Retro 參考

下個 session 啟動 Phase 4 / 後續維護期前必讀：[`./migration-inventory.md`](./migration-inventory.md) **「## Phase 3 Handoff Highlights」段（8 條 bullet）**。該段保留 Phase 3 實作踩坑與實際決策；本節只放 Phase 4 的行動拆分。

---

## Critical Files（總覽）

### Phase 0 必改（quality gate 整備，獨立 PR）

- `/Users/chentzuyu/Desktop/dive-into-run/specs/021-layered-dependency-architecture/test-buckets/policy.js`（**SoT**，Patch A-F 6 處）
- `/Users/chentzuyu/Desktop/dive-into-run/specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`（line 124 `.toEqual` 8-bucket，**與 policy.js 同 commit**）
- `/Users/chentzuyu/Desktop/dive-into-run/package.json`（lint / depcruise / depcruise:json / spellcheck 4 個 script 加 `tests`）
- `/Users/chentzuyu/Desktop/dive-into-run/.claude/rules/testing-standards.md`（line 13-14 並存期說明）
- `/Users/chentzuyu/Desktop/dive-into-run/.claude/skills/test-driven-development/SKILL.md`（9 處寫死路徑）
- 新建 `/Users/chentzuyu/Desktop/dive-into-run/tests/{unit/{service,repo,runtime,lib,config},integration,e2e/_setup,_helpers}/.gitkeep`

**唯讀引用（不動）**：

- `/Users/chentzuyu/Desktop/dive-into-run/specs/021-layered-dependency-architecture/test-bucket-policy.js`（59 行 re-export shim）
- `/Users/chentzuyu/Desktop/dive-into-run/.dependency-cruiser.mjs`（透過 shim 自動讀到新 bucket）

### Phase 1 必改

- `/Users/chentzuyu/Desktop/dive-into-run/specs/021-layered-dependency-architecture/test-buckets/policy.js`（**僅 Step 1.7：mv 後同步更新 `KNOWN_S015_UNIT_CONFLICTS` 8 條豁免路徑**；Phase 0 已完成 bucket pattern 部分）
- `/Users/chentzuyu/Desktop/dive-into-run/vitest.config.mjs`（Step 1.2 coverage scope，與 Phase 0 解耦）
- 68 個 unit 測試檔（git mv）

### Phase 2 必改

- `/Users/chentzuyu/Desktop/dive-into-run/.claude/references/testing-handbook.md`

### Phase 3 必改

- `/Users/chentzuyu/Desktop/dive-into-run/playwright.config.mjs`
- `/Users/chentzuyu/Desktop/dive-into-run/playwright.emulator.config.mjs`
- `/Users/chentzuyu/Desktop/dive-into-run/scripts/test-branch.sh`
- `/Users/chentzuyu/Desktop/dive-into-run/scripts/test-e2e-branch.sh`
- `/Users/chentzuyu/Desktop/dive-into-run/scripts/run-all-e2e.sh`
- `/Users/chentzuyu/Desktop/dive-into-run/.claude/rules/e2e-commands.md`
- `/Users/chentzuyu/Desktop/dive-into-run/CLAUDE.md`
- `/Users/chentzuyu/Desktop/dive-into-run/AGENTS.md`
- `/Users/chentzuyu/Desktop/dive-into-run/GEMINI.md`

### 已 ready 不需動

- `/Users/chentzuyu/Desktop/dive-into-run/eslint.config.mjs`（line 372 已 allow `tests/**`）

---

## Verification Checklist（每階段完成後跑）

### Phase 0 完成

- [ ] 8 buckets 註冊：`node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => console.log(Object.keys(m.testBucketPolicy.buckets).length))"` 輸出 `8`
- [ ] 並存 classify：舊 `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx` 仍 → `unit`，新 `tests/unit/service/foo.test.js` → `unit-tests-root`
- [ ] 舊 135 檔 0 violations：`scanRepoTestImportGraph()` 對舊 4 個 bucket 全 0 violations
- [ ] `npm run depcruise && npm run lint && npm run type-check && npm run spellcheck && npm run test` 5 個全綠
- [ ] `package.json` 4 個 script 都含 `tests`：`grep -E '\"(lint\|depcruise\|spellcheck)\":' package.json | grep -c tests` ≥ 4
- [ ] `tests/{unit/{service,repo,runtime,lib,config},integration,e2e/_setup,_helpers}/.gitkeep` 全部存在
- [ ] PR merge 後 main CI 跑滿 24h 無紅

### Phase 1 完成

- [ ] `npm run depcruise` 全綠 — `unit-tests-root` bucket 啟動，src/service/X.test.js 試 import src/components/Y.jsx 應 fail
- [ ] `npm run test` 全綠
- [ ] Coverage 報告 涵蓋 `src/{service,repo,runtime,lib,config}/**`
- [ ] VS Code 開 `src/service/event-service.js`，cmd+T 找到 `tests/unit/service/event-service.test.js`
- [ ] `git log tests/unit/service/event-service.test.js --follow` 看到原 specs/ 路徑歷史

### Phase 2 完成

- [ ] 跨 feature 改 notifications 邏輯，只動 `tests/integration/notifications/`
- [ ] `tests/integration/<domain>/` 分組合理（每 domain 4-15 檔，不超過 30）
- [ ] domain 對應表存檔（例如本檔 Step 2.1 表格）

### Phase 3 完成

- [ ] `npx playwright test` 從 `tests/e2e/` 跑起，全綠（**pending**：需 emulator + dev server，本 session 未實跑；T312 smoke 已用 dry import 驗 config 正確）
- [x] `ls specs/<NNN>/` 不再含 `tests/` 子目錄，只剩 spec artifacts（除 `specs/g8-server-coverage/tests/unit/` 2 檔 KEEP — design intent）
- [x] 開新 feature branch 用 TDD skill 跑 Step 2.5，新測試直接落 `tests/{unit,integration,e2e}/`（SKILL.md 已在 Phase 0 改成新路徑）
- [x] 全 repo 找不到 `specs/<feature>/tests/` 的引用（grep `specs/.+/tests/` 無命中）（除 g8 KEEP / 文件 archive 引用）

---

## Trade-off Summary

| 維度                             | 現狀 | Phase 0 完               | Phase 0+1 完      | Phase 0+1+2 完        | 全做完  |
| -------------------------------- | ---- | ------------------------ | ----------------- | --------------------- | ------- |
| 對齊 spec-kit 官方 plan-template | ❌   | ❌（quality gate ready） | ⚠️ 30%（unit OK） | ⚠️ 70%                | ✅ 100% |
| 對齊 Playwright 預設 testDir     | ❌   | ❌                       | ❌                | ❌                    | ✅      |
| 找對應 unit 測試                 | ❌   | ❌                       | ✅                | ✅                    | ✅      |
| 跨 feature 改動                  | ❌   | ❌                       | ⚠️ unit 集中      | ✅                    | ✅      |
| Spec.md 仍可保留                 | ✅   | ✅                       | ✅                | ✅                    | ✅      |
| Quality gate 雙軌（舊+新）       | N/A  | ✅                       | ✅                | ✅                    | N/A     |
| 重組成本（人天）                 | 0    | 0.5-1                    | + 1-2             | + 2-3                 | + 2     |
| 可逆性                           | N/A  | 高（pure additive）      | 高                | 中                    | 中      |
| Risk                             | 0    | 低（patch 集中、可測）   | 低                | 中（domain 分組決策） | 中      |

---

## 為什麼選 A（頂層 tests/）而非 B（Hybrid colocate）— 用戶決策軌跡

兩方案差別僅在 unit tests 擺哪裡（integration / e2e 都頂層 tests/）。用戶看完優缺點對比後選 A：

| 維度                  | A：頂層 tests/             | B：Hybrid colocate                                   |
| --------------------- | -------------------------- | ---------------------------------------------------- |
| 找對應 unit 測試      | ⭐⭐⭐⭐ IDE 名稱對應      | ⭐⭐⭐⭐⭐ 同層立刻看到                              |
| 對齊 spec-kit 官方    | ✅                         | ❌ 範本沒這樣示範                                    |
| 對齊 Playwright       | ✅                         | 不衝突                                               |
| 對齊 Vitest example   | ✅（用 `./test/unit/`）    | ✅（colocate 也接受）                                |
| src/ 純度             | ⭐⭐⭐⭐⭐ 100% 生產碼     | ⭐⭐⭐ 一半夾雜測試                                  |
| Coverage 配置         | 簡單 `include: ['src/**']` | 複雜，要 exclude `src/**/*.test.*`                   |
| Bundler 配置          | 不用管                     | Vite/Next.js 要排除                                  |
| policy.js bucket 維護 | 1 個 bucket                | 多 1 個 unit-colocated bucket                        |
| Sub-folder 一致性     | 鏡射就是鏡射               | `src/service/strava/X.test.js` 還是拉到 tests/？模糊 |

**用戶的選 A 理由（隱含）**：對齊 spec-driven 工具（spec-kit）勝過微小的 IDE 體驗差距；src/ 純度 + 配置簡單是長期摩擦低。

---

## 未來 Session Resume 提示

### 啟動下個 session 時

1. **快速進入狀況**：讀本檔「TL;DR」+「終局結構」+「Hidden Cost」+「Phase 0」四段（5-7 分鐘）
2. **檢查進度**：看本檔 Verification Checklist 哪些 `[x]` 已勾。優先確認 Phase 0 是否已 merge 進 main（沒有的話一律從 Phase 0 起手）
3. **要不要動手**：跟用戶確認 Phase 順序（連著做 vs 分散做？先做 Phase 0 觀察？）
4. **Phase 0 第一步永遠是 policy.js + test-bucket-policy.test.js（同 commit）**：Patch G 沒同步改絕不 commit Patch A-F，不然測試紅 → CI block

### Phase 0 啟動前的 prep work

- **必讀**：`~/.claude/plans/2026-04-26-tests-directory-migration-md-gleaming-flamingo.md`（含 7 個 patch 完整 code、smoke test、Risk Register、Rollback plan）
- **必驗**：第一件事跑 `node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => console.log(Object.keys(m.testBucketPolicy.buckets).length))"`，確認當前 bucket 數量。若已 ≥ 8 → Phase 0 已部分完成或已 merge，跳過再做沒意義
- **同 commit 鐵律**：policy.js Patch A-F + test-bucket-policy.test.js Patch G **必須同一 commit**，永不分開（避免中間狀態 CI 紅）

### 開始實作 Phase 0 時的 git workflow

```bash
git checkout main && git pull
git checkout -b refactor/tests-directory-migration-phase0
# ... 動 policy.js A-F + test-bucket-policy.test.js G + package.json + 建 .gitkeep + 改 rules + 改 SKILL.md ...
npm run depcruise && npm run lint && npm run type-check && npm run spellcheck && npm run test
git commit -m "refactor(tests): phase 0 quality-gate prep for tests/ directory migration"
# 開 PR → merge → main 觀察 24h → 開 Phase 1 PR
```

### 開始實作 Phase 1 時的 git workflow（Phase 0 merge 24h 後）

```bash
git checkout main && git pull   # 拉 Phase 0 已 merge 的 main
git checkout -b refactor/tests-directory-migration-phase1
# ... vitest.config coverage scope + git mv 68 unit tests + 同步 KNOWN_S015_UNIT_CONFLICTS 8 條路徑 ...
npm run depcruise && npm run test && npm run lint && npm run type-check
git commit -m "refactor(tests): migrate 68 unit tests to top-level tests/unit (Phase 1)"
```

### Phase 2 啟動前的 prep work

- **必先做**：列出 22 個 numbered feature → domain 對應表（手寫 in plan）
- **討論點**：domain 邊界曖昧的 feature（例 003-strict-type-fixes 跨多 domain）怎麼分？建議按主要功能歸類 + 重複的測試擇一即可

### Phase 3 啟動前的 prep work

- **playwright.emulator.config.mjs 重寫**是 Phase 3 最大風險點 — `E2E_FEATURE` 環境變數整個 model 要重新設計。建議**獨立 PR**，不跟 e2e mv 同 PR
- **branch scripts 4 個 + e2e-commands.md** 一次改完跑 smoke test

### 跨 session 注意事項

- 本檔位置 `specs/023-tests-directory-migration/plan.md`（**git tracked**，跟 tasks.md 一起進 PR）
- 計畫如有變更（例 domain 分組決定後），編輯本檔保持 single source of truth
- Phase 完成後在本檔 Verification Checklist 打 `[x]` 勾，下個 session 看勾就知道進度
- Phase 1/2/3 各自開新 branch（例 `024-tests-phase1`）會有對應的 `specs/024-tests-phase1/{plan,tasks}.md`，本 plan.md 是 4 階段總藍圖、tasks.md 只覆蓋 Phase 0

---

## 附錄：相關 reference 文件

- `~/.claude/plans/2026-04-26-tests-directory-migration-md-gleaming-flamingo.md`（**Phase 0 完整實作 patch**，含 policy.js 7 處 patch、smoke test、Risk Register、Rollback plan — Phase 0 啟動時必讀）
- `~/.claude/plans/repo-specs-test-specs-peppy-key.md`（Plan mode 留下的更早版本 plan file，本檔已涵蓋更精準內容）
- `.claude/references/testing-handbook.md`（現行測試手冊，Phase 2 要重寫）
- `.claude/rules/testing-standards.md`（現行規範，Phase 0 要重寫 line 13-14）
- `.claude/rules/coding-rules.md`（layered architecture rule，不用改但要看 § 5 forward-only imports）
- `.claude/skills/test-driven-development/SKILL.md`（現行 TDD skill，Phase 0 要重寫 9 處）
- `specs/021-layered-dependency-architecture/`（layered architecture 完整 context）
- `specs/021-layered-dependency-architecture/test-buckets/policy.js`（**SoT** — Phase 0 改這裡）
- `specs/021-layered-dependency-architecture/test-bucket-policy.js`（**Shim** — 純 re-export，不動）
