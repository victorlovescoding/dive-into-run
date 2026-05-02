# Quality Score Matrix

> Last Updated: 2026-05-03
> Next Review: 2026-06-03

Agent 開工前讀此文件，立即知道哪裡弱、該優先投資什麼。

---

## Per-Layer Quality

靜態分析（type-check + lint）全層 0 errors / 0 warnings。主要差異在 test coverage 和 JSDoc 完整度。

| Layer       | Files | Static | Test Ratio | JSDoc Density | V8 Cov | Grade |
| ----------- | ----- | ------ | ---------- | ------------- | ------ | ----- |
| types/      | 2     | Clean  | 0.00 (0)   | 1.67 Good     | —      | B+ †  |
| config/     | 6     | Clean  | 0.17 (1)   | 1.88 Good     | 82.35% | B     |
| repo/       | 19    | Clean  | 0.47 (9)   | 3.90 Full     | 95.22% | A-    |
| service/    | 14    | Clean  | 0.79 (11)  | 5.41 Full     | 93.42% | A-    |
| runtime/    | 32    | Clean  | 2.09 (67)  | 5.33 Full     | 92.12% | A+    |
| ui/         | 12    | Clean  | 0.00 (0)   | 6.07 Full     | 97.56% | C     |
| lib/        | 20    | Clean  | 1.30 (26)  | 2.17 Good     | 95.49% | A     |
| components/ | 54    | Clean  | 0.74 (40)  | 7.45 Full     | 92.73% | A-    |
| app/        | 15    | Clean  | TBD        | TBD           | 96.03% | TBD   |

> **Static** = type-check + lint 合併（目前全 clean）。
> **Test Ratio** = test files targeting this layer / source files。括號內為 test file 絕對數。
> **JSDoc Density** = `@param`/`@returns`/`@type`/`@typedef` annotations / exports。Full ≥ 3.0、Good ≥ 1.5、Partial < 1.5。
> **V8 Cov** = vitest V8 coverage。S9 已對 `src/{service,repo,runtime,lib,config,ui,components,app}/**` 啟用 per-directory threshold gate。
> **†** types/ 適用純宣告例外（≤ 3 files、無邏輯），test ratio 0 不降至 C。

### Layer-Level Known Gaps

1. **ui/ 零直接測試（Grade C）** — 12 個 screen components 沒有任何 render/snapshot/integration tests。這是最大的品質缺口。
2. **S9 per-directory threshold gate 已啟用** — `vitest.config.mjs` 現在分層 gate：service 80、repo 75、runtime 60、lib 80、config 70、ui 94.43、components 91.64、app 95.07。ui / components / app 以 Wave 3 baseline +5 起跳，下一次 review 依實測逐步 ramp，避免回到單一 global `lines: 70`。
3. **config/ 測試稀疏** — 6 files 只有 1 個 test file。Firebase config 難以 unit test，但 geo data helpers（`taiwan-locations.js`、`weather-geo-cache.js`）可測。
4. **lib/ JSDoc 最弱** — 42 exports 只有 91 annotations（2.2/export），其他層都在 3.9 以上。作為 facade 層，JSDoc 是下游 consumer 的主要文檔。

---

## Per-Domain Quality

定性評估每個 product domain 的測試覆蓋率和已知問題。

| Domain          | Source Files | Test Files | Est. Cases | Grade | Top Gaps                                      |
| --------------- | ------------ | ---------- | ---------- | ----- | --------------------------------------------- |
| Runs (Strava)   | 20           | 25         | 80+        | A+    | route map 視覺化深度有限                      |
| Posts           | 12           | 22         | 60+        | A     | like/reaction 深度測試不足                    |
| Events          | 17           | 18         | 50+        | A-    | 進階篩選場景、參加者管理                      |
| Users / Profile | 13           | 12         | 45+        | B+    | avatar upload 未測、E2E 缺乏                  |
| Weather         | 13           | 8          | 40+        | B     | TaiwanMap 元件未測、cache 行為、alert 閾值    |
| Dashboard       | 10           | 6          | 30+        | B-    | 無 E2E、pagination 未測、empty/error 狀態缺失 |
| Auth            | 9            | 6          | 25+        | B-    | AuthContext/Provider 未測、logout flow 缺失   |

### Domain-Level Known Gaps

1. **Dashboard（B-）** — 最薄弱的 domain。6 個 test files、無 E2E 測試、tab 切換的 persistence 和 activity feed pagination 都沒覆蓋。
2. **Auth（B-）** — AuthContext 和 AuthProvider 這兩個 cross-cutting 核心元件沒有任何直接測試。session persistence 和 token refresh 也未覆蓋。
3. **Weather（B）** — TaiwanMap 是最大的視覺元件（304 行），沒有測試。weather-geo-cache 的 cache 行為也未驗證。

---

## Score History

| Date       | Overall | Layer Avg | Domain Avg | Changes                                                                                                |
| ---------- | ------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 2026-04-24 | B+      | A-        | B+         | Initial grading + rubric 量化（service ↓A-, runtime ↑A+, lib ↑A, components ↓A-）。                    |
| 2026-04-29 | B+      | A-        | B+         | Coverage include 擴至 8 層 (S3); ui/components/app 首度有 V8 cov baseline (62.52% / 52.43% / 47.92%)。 |
| 2026-05-03 | B+      | A-        | B+         | S9 啟用 per-directory coverage thresholds：service/repo/runtime/lib/config = 80/75/60/80/70，ui/components/app = 94.43/91.64/95.07；下一次 review 依 coverage delta 調整 ramp。 |

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

**主軸 — Test File Count**（specs/ 中覆蓋該 domain 的 test files）：

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

此文件的數據來自以下指令（全部已在 repo 內可執行）：

```bash
npm run type-check                          # → 0 errors = Clean
npx eslint src --format json                # → per-layer error/warning count
npm run test:coverage                       # → coverage/coverage-summary.json (需 Firebase Emulator)
find specs -name "*.test.*" | ...           # → per-layer test file count
grep -c "@param|@returns|@type" src/...     # → JSDoc annotation count
```

## Update Protocol

1. 每次 merge 到 main 後，agent 可用上述指令驗證分數是否仍然正確
2. 新增 feature 或重構後，更新對應 layer/domain 的 Grade 和 Known Gaps
3. 每次更新時在 Score History 加一行，記錄變化
