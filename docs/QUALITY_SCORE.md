# Quality Score Matrix

> Last Updated: 2026-05-12
> Next Review: 2026-06-12
> Last-Verified: 2026-05-12

Agent 開工前讀此文件，立即知道哪裡弱、該優先投資什麼。

---

## Per-Layer Quality

本次更新依 2026-05-12 fresh `npm run test:coverage` 與 read-only classifier。Coverage stdout：166 test files / 1440 tests passed；total Lines 92.97% (4395/4727)、Statements 90.85% (4729/5205)、Branches 79.80% (2592/3248)、Functions 92.73% (1199/1293)。主要差異仍在 direct test ratio 和 JSDoc 完整度。

| Layer       | Files | Test Ratio | JSDoc Density | V8 Cov | Grade |
| ----------- | ----- | ---------- | ------------- | ------ | ----- |
| types/      | 2     | 0.00 (0)   | 1.67 Good     | —      | B+ †  |
| config/     | 6     | 0.17 (1)   | 1.88 Good     | 82.35% | B     |
| repo/       | 19    | 0.32 (6)   | 3.90 Full     | 95.22% | A-    |
| service/    | 15    | 0.73 (11)  | 5.39 Full     | 93.42% | A     |
| runtime/    | 46    | 0.74 (34)  | 5.15 Full     | 92.18% | A     |
| ui/         | 17    | 0.12 (2)   | 5.37 Full     | 97.56% | A-    |
| lib/        | 20    | 1.45 (29)  | 2.17 Good     | 95.49% | A     |
| components/ | 55    | 1.27 (70)  | 7.20 Full     | 92.76% | A+    |
| app/        | 24    | 0.46 (11)  | 3.00 Full     | 96.03% | A     |

> **Test Ratio** = test files targeting this layer / source files。括號內為 test file 絕對數。
> **JSDoc Density** = `@param`/`@returns`/`@type`/`@typedef` annotations / exports。Full ≥ 3.0、Good ≥ 1.5、Partial < 1.5。
> **V8 Cov** = vitest V8 coverage。S9 已對 `src/{service,repo,runtime,lib,config,ui,components,app}/**` 啟用 per-directory threshold gate。
> **†** types/ 適用純宣告例外（≤ 3 files、無邏輯），test ratio 0 不降至 C。

### Layer-Level Known Gaps

1. **ui/ direct screen test ratio 仍低（Grade A-）** — read-only classifier 目前只找到 2 個 direct ui tests；V8 lines 97.56% 很高，但 screen-level regression surface 還是偏薄。
2. **S9 per-directory threshold gate 已啟用** — `vitest.config.mjs` 現在分層 gate：service 80、repo 75、runtime 60、lib 80、config 70、ui 94.43、components 91.64、app 95.07。ui / components / app 以 Wave 3 baseline +5 起跳，下一次 review 依實測逐步 ramp，避免回到單一 global `lines: 70`。
3. **config/ 測試稀疏** — 6 files 只有 1 個 test file。Firebase config 難以 unit test，但 geo data helpers（`taiwan-locations.js`、`weather-geo-cache.js`）可測。
4. **lib/ JSDoc 最弱** — 42 exports 只有 91 annotations（2.2/export），其他層都在 3.9 以上。作為 facade 層，JSDoc 是下游 consumer 的主要文檔。

---

## Per-Domain Quality

定性評估每個 product domain 的測試覆蓋率和已知問題。

| Domain          | Source Files | Test Files | Est. Cases | Grade | Top Gaps                                                            |
| --------------- | ------------ | ---------- | ---------- | ----- | ------------------------------------------------------------------- |
| Runs (Strava)   | 31           | 23         | 80+        | A     | route map 視覺化深度、OAuth unhappy-path 深度                       |
| Posts           | 29           | 25         | 65+        | A     | reaction / notification edge cases                                  |
| Events          | 37           | 33         | 70+        | A     | 進階篩選、participant management edge cases                         |
| Users / Profile | 16           | 11         | 45+        | B+    | avatar upload E2E、public profile unhappy paths                     |
| Weather         | 30           | 12         | 45+        | B+    | TaiwanMap direct test、weather-geo-cache cache behavior、alert 閾值 |
| Dashboard       | 14           | 10         | 40+        | B     | 無 E2E、activity feed cross-tab regressions                         |
| Auth            | 5            | 4          | 20+        | B-    | Google login / token refresh E2E                                    |

### Domain-Level Known Gaps

1. **Dashboard（B）** — 仍無 E2E，activity feed cross-tab regressions 是主要缺口；pagination / loadMore / empty / error 已有 coverage，不再列為完全缺失。
2. **Auth（B-）** — `tests/integration/auth/AuthProvider.test.jsx` 已補上 AuthProvider direct integration；目前缺口集中在 Google login 與 token refresh E2E。
3. **Weather（B+）** — TaiwanMap direct test、weather-geo-cache cache behavior、alert thresholds 仍是主要補強點。

---

## Score History

| Date       | Overall | Layer Avg | Domain Avg | Changes                                                                                                |
| ---------- | ------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 2026-04-24 | B+      | A-        | B+         | Initial grading + rubric 量化（service ↓A-, runtime ↑A+, lib ↑A, components ↓A-）。                    |
| 2026-04-29 | B+      | A-        | B+         | Coverage include 擴至 8 層 (S3); ui/components/app 首度有 V8 cov baseline (62.52% / 52.43% / 47.92%)。 |
| 2026-05-03 | B+      | A-        | B+         | S9 啟用 per-directory coverage thresholds：service/repo/runtime/lib/config = 80/75/60/80/70，ui/components/app = 94.43/91.64/95.07；下一次 review 依 coverage delta 調整 ramp。 |
| 2026-05-12 | A-      | A-        | B+         | Fresh coverage 通過：166 test files / 1440 tests，total lines 92.97%。更新 per-layer classifier、domain classifier、stale gaps，並移除 ui 零測試、AuthProvider 無直接測試、Dashboard pagination/empty/error 完全缺失等過期敘述。 |

---

## Grading Rubric

### 前提 Gate

靜態分析（type-check + lint）必須 0 errors。任何 error → 自動 **D**。

### Layer Rubric（量化）

**主軸 — Test Ratio**（test files targeting this layer / source files）：

| Test Ratio | Base Grade |
| ---------- | ---------- |
| ≥ 2.0      | A          |
| ≥ 1.0      | A-         |
| ≥ 0.4      | B+         |
| > 0        | B          |
| = 0        | C          |

**修正因子 — JSDoc Density**（annotations / exports）：

| JSDoc Density   | Modifier |
| --------------- | -------- |
| ≥ 3.0 (Full)    | +1 level |
| ≥ 1.5 (Good)    | +0       |
| < 1.5 (Partial) | -1 level |

**修正因子 — V8 Coverage**（需 instrumentation）：

| V8 Coverage | Modifier |
| ----------- | -------- |
| ≥ 90%       | +1 level |

**硬規則**：

- Test ratio = 0 是 **hard C** — JSDoc 修正因子無法將 C 拉升至 B-。零測試 = 零驗證。
- 只有 V8 coverage ≥ 90% 或**純宣告例外**（≤ 3 files、無邏輯）可以脫離 C。

Grade ladder: C → B- → B → B+ → A- → A → A+

### Domain Rubric（半量化）

**主軸 — Test File Count**（`tests/` 中覆蓋該 domain 的 test files）：

| Test Files | Base Grade |
| ---------- | ---------- |
| ≥ 20       | A          |
| ≥ 10       | B+         |
| ≥ 5        | B          |
| < 5        | C          |

**修正因子 — Gap Severity**：

| Gap Severity                                 | Modifier |
| -------------------------------------------- | -------- |
| 無 critical path gap                         | +1 level |
| 僅 edge case / 非核心 gap                    | +0       |
| Critical path 未測（核心用戶旅程無任何測試） | -1 level |

> Critical path = 該 domain 的核心用戶旅程。例：Auth 的 login/logout/session、Events 的 CRUD、Dashboard 的 tab 切換 + 資料載入。

---

## Data Sources

此文件可用以下 gate/source 更新與驗證；本次 fresh evidence 是 `npm run test:coverage` 和 read-only classifier。

```bash
npm run type-check                          # → type gate
npm run lint                                # → eslint src specs tests
npm run lint -- --format json               # → per-layer error/warning count
npm run test:coverage                       # → coverage/coverage-summary.json (需 Firebase Emulator)
npm run depcruise                           # → forward-only layer dependency gate
npm run spellcheck                          # → src + specs + tests spelling gate
npm run audit:use-effect-data-fetching      # → UI/component effect data-fetch boundary audit
npm run audit:playwright-official-only      # → Playwright official API audit
find tests \( -name "*.test.*" -o -name "*.spec.*" \) | ... # → per-layer/domain test file count
grep -c "@param|@returns|@type|@typedef" src/... # → JSDoc annotation count
```

其他 gate / workflow 來源：`.github/workflows/ci.yml`（repo workflow jobs include `ci` and `e2e`; branch protection live required checks 不由 repo files 證明）、`.husky/pre-commit`、`.codex/rules/sensors.md`、doc:freshness、mock-boundary audit、flaky-pattern audit。

此矩陣仍是人工維護的品質快照，不是自動產生的 dashboard。若分數或資料來源開始 stale，追蹤項目見 `docs/TECH_DEBT.md` 的 TD-010。

## Update Protocol

1. 每次 merge 到 main 後，agent 可用上述指令驗證分數是否仍然正確
2. 新增 feature 或重構後，更新對應 layer/domain 的 Grade 和 Known Gaps
3. 每次更新時在 Score History 加一行，記錄變化
