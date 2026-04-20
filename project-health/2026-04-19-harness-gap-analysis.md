# Harness Engineering 差距分析報告

> 日期：2026-04-19
> 方法：對照 5 篇 harness engineering 文章（Martin Fowler、OpenAI Codex、Anthropic、Datadog、Stripe Minions）深度掃描 repo 全部配置

---

## 做得好的地方（9 項）

| #   | 實踐                           | 對應文章           | 說明                                                                                       |
| --- | ------------------------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| S1  | Guides/Sensors 分層架構        | Martin Fowler      | CLAUDE.md 直接用這組術語命名章節，三層速度分明（快速計算型→中速推理型→慢速人工）           |
| S2  | Constitution as Code           | OpenAI / Stripe    | 版控 8 大原則 v1.7.0，帶 SYNC IMPACT REPORT，凌駕一切規則                                  |
| S3  | Spec-Driven Development 全流程 | Stripe / Anthropic | SpecKit 5 步驟（specify→plan→tasks→analyze→implement），23 個 spec.md                      |
| S4  | Contracts Before Code          | Datadog            | 10 個 feature 有 contracts/ 子目錄，data-model.md 定義 invariants                          |
| S5  | 多層自動化閘門                 | Datadog            | pre-commit（lint+type+spell+vitest）+ pre-push（E2E）+ CI 三層                             |
| S6  | Narrow Scope Design            | Stripe             | tasks.md 有編號 T001-T012、平行標記 [P]、依賴關係、Phase 分組                              |
| S7  | TDD Iron Law + Verification    | Anthropic / Fowler | TDD skill 強制 RED-GREEN-REFACTOR，verification-before-completion 禁止「沒驗證就宣稱完成」 |
| S8  | Safety Hooks                   | Stripe / OpenAI    | block-dangerous-commands.js 攔截危險指令 + notify-permission.sh 語音通知                   |
| S9  | G/E 分離（部分）               | Anthropic          | speckit.implement 生產程式碼，codereview-roasted 獨立評審                                  |

---

## 差距分析（12 項）

### P0 — 立即

#### G3. 文件新鮮度無自動檢查

- **來源**：OpenAI Codex — 專用 linter 驗證文件新鮮度、交叉連結
- **現況**：CLAUDE.md 引用 `testing-handbook.md` 和 `review-standards.md` 但兩者都不存在。agent 每次開 session 都會浪費 context 嘗試讀取不存在的檔案。
- **建議**：
  1. 建 `scripts/check-doc-freshness.sh` 檢查所有引用檔案是否存在
  2. 加入 CI step 執行
- **複雜度**：Low

#### G12. 待建文件未完成

- **來源**：OpenAI Codex — docs/ 是真相
- **現況**：`testing-handbook.md`（🔜）和 `review-standards.md`（🔜）兩份文件被 CLAUDE.md 引用但不存在
- **建議**：
  1. `testing-handbook.md` — 整合 TDD skill 中的 4 份 reference（coding-style、jsdoc-cheatsheet、boilerplate、testing-anti-patterns）
  2. `review-standards.md` — 整合 codereview-roasted SKILL.md 的 review framework 和 checklist
- **複雜度**：Low（內容已存在於各 skill 中，只需整合）

---

### P1 — 短期

#### G1. 缺 Steering Loop 追蹤機制

- **來源**：Martin Fowler — 追蹤重複失敗 → 改進 Guide/Sensor
- **現況**：沒有「重複出現的同類失敗」的結構化追蹤。project-health/ 有 5 份一次性報告（2026-04-07），但非持續性回饋迴路。
- **建議**：
  1. 建 `.claude/references/steering-log.md`，格式：日期 | 失敗類型 | 根因 | 改進的 Guide/Sensor | 狀態
  2. codereview-roasted 末尾新增一步：若問題曾在 steering-log 出現，標記 REPEAT，建議 Guide/Sensor 強化
  3. 每月 agent 掃描 REPEAT 項目產出 Harness Health Report
- **複雜度**：Low

#### G2. Evaluator 未驗證 Live 頁面

- **來源**：Anthropic — Evaluator 透過 Playwright MCP 與 live page 互動後才評分
- **現況**：Chrome DevTools MCP 已安裝啟用，但 codereview-roasted 只做靜態 diff 分析，沒整合截圖/互動驗證。
- **建議**：
  1. roasted SKILL.md 加 Step 2.5「Visual Verification」：UI 變更時用 Chrome DevTools MCP 截圖 before/after
  2. 對缺少 E2E 的 feature 補做 live 互動驗證
  3. speckit.implement Phase 5 加上「UI 變更必須截圖驗證」
- **複雜度**：Medium

#### G4. 無 File Size Limits

- **來源**：OpenAI Codex — File Size Limits & Structural Tests
- **現況**：`events/page.jsx` 1526 行、`eventDetailClient.jsx` 866 行、`firebase-events.js` 643 行，無任何自動警告。
- **建議**：
  1. 建 `scripts/check-file-size.sh`：>400 行 warn、>600 行 error
  2. 加入 CI 作為非阻擋警告（先不阻擋 build）
  3. 結構測試：確認 src/lib/ 不 import react、src/components/ 不 import firebase/firestore
- **複雜度**：Low
- **2026-04-20 執行決策**：
  - ✅ **結構測試**已實作：`eslint.config.mjs` Section 13（lib 禁 react/next/react-leaflet）+ Section 14（components 禁 firebase/firestore），0 違規、嚴格 block（pre-commit + CI）。完整擴大到 `src/app/` + `firebase/auth` 的 follow-up 記於 memory `project_harness_g4_followup.md`
  - ❌ **行數限制**（script + CI 非阻擋警告）**主動擱置**。原因：400/600 雙門檻的語意分工、是否設逃生閥門（例外白名單 / 註解 opt-out / 類型排除）、專案成長後的適用性等問題尚未想清楚，不做半套。若未來要恢復，查 `chore/harness-engineering-v1` 分支歷史 commit 可找到 `scripts/check-file-size.sh` 原始實作

#### G8. 無 Code Coverage

- **來源**：OpenAI Codex — Composable Utilities with 100% Coverage
- **現況**：vitest.config 沒有 coverage 設定，無法量化 src/lib/ 的測試覆蓋率。
- **建議**：
  1. vitest.config 加 `coverage: { provider: 'v8', include: ['src/lib/**'], thresholds: { lines: 60 } }`
  2. CI 加 coverage 報告（PR comment 或 Codecov）
  3. 先從 src/lib/ 開始，不急著要求 100%
- **複雜度**：Low

#### G9. 無結構化 Handoff

- **來源**：Anthropic — Context Reset Strategy + File-based Handoffs
- **現況**：跨 session 只靠 tasks.md 的 `[x]` checkbox 追蹤，長 feature 缺少「做到哪、下次從哪開始」的狀態。
- **建議**：
  1. 定義 `specs/<feature>/handoff.md` 模板：Last Completed Task | Current State | Open Questions | Next Steps | Known Issues
  2. speckit.implement 每完成一個 Phase 自動更新 handoff.md
  3. 新 session 先讀 handoff.md 恢復上下文
- **複雜度**：Medium

#### G10. 架構分層無自動強制

- **來源**：OpenAI Codex — 剛性分層架構強制
- **現況**：Constitution Principle II 說「UI 不得直接匯入 Firebase SDK」，但只是文字規範，沒有 ESLint 攔截。
- **建議**：
  1. eslint.config.mjs 加 `import/no-restricted-paths`：src/app/ 和 src/components/ 禁止 import firebase/\*
  2. 或用 `eslint-plugin-boundaries` 定義 ui → lib 單向依賴
  3. CI 作為 blocking check
- **複雜度**：Low

---

### P2 — 中期

#### G5. 無 Observability Metrics

- **來源**：Stripe Minions — merge rate、review cycle time、test pass rate、revert rate
- **現況**：沒有自動化的開發流程指標追蹤。project-health/ 的報告是一次性的。
- **建議**：
  1. 建 `scripts/harness-metrics.sh`：用 git log + specs/ 結構計算每個 feature 的 commit 數、時間跨度、review 迭代次數、測試比率
  2. 產出 `project-health/harness-metrics.md`，merge 到 main 後更新
  3. CI 中 test pass rate < 95% 時在 PR comment 警告
- **複雜度**：Medium

#### G6. CLAUDE.md 非 Index Pattern

- **來源**：OpenAI Codex — AGENTS.md as Index Pattern（~100 行目錄 → docs/ 是真相）
- **現況**：CLAUDE.md 204 行，既有索引也有行內規則，跟 Constitution 內容重複。
- **建議**：
  1. 瘦身為 ~100 行索引：Commands、Architecture 概覽、指向各 reference doc 的連結
  2. 具體規則移到 `.claude/references/` 下的獨立文件
  3. 避免 CLAUDE.md 和 constitution.md 之間的規則重複
- **複雜度**：Low

#### G7. Lint Errors 缺修復指引

- **來源**：OpenAI Codex — Style Enforcement via Linter Errors as Context
- **現況**：ESLint 用標準錯誤訊息，agent 修 lint 需多次來回。
- **建議**：
  1. 建 `.claude/references/common-lint-fixes.md`：列 top 10 最常見的 lint 錯誤 + 修復範例
  2. TDD skill Quality Gate 中引用此文件
- **複雜度**：Low

#### G11. 無定期 GC Agent 掃描

- **來源**：OpenAI Codex — Golden Principles as Code + 定期 GC agent 掃描偏差
- **現況**：Constitution 原則沒有自動偏差偵測。
- **建議**：
  1. Claude Code schedule 每週掃描：非 lib/ 目錄的 firebase import、>400 行新增檔案、@ts-ignore、eslint-disable a11y
  2. 產出 `project-health/weekly-constitution-audit.md`
  3. 發現違規時自動建立 GitHub Issue
- **複雜度**：Medium

---

## 不適用的實踐（5 項）

| 實踐                     | 來源    | 不適用原因                                                                         |
| ------------------------ | ------- | ---------------------------------------------------------------------------------- |
| TLA+ / Formal Methods    | Datadog | 跑步社群 web app 不需要 formal specification，Firebase `runTransaction` 已覆蓋併發 |
| BUGGIFY + DST            | Datadog | 後端完全託管 Firebase，故障處理由 SDK 負責                                         |
| 本地 Observability Stack | OpenAI  | 無自有 backend，Firebase Console 已提供足夠 metrics                                |
| Scalability Inversion    | Datadog | 專案規模不需要 formal methods 自動化                                               |
| 完整 Sandboxed Execution | Stripe  | Firebase Emulator + block-dangerous-commands.js 已足夠                             |

---

## 建議執行順序

### Phase 1（P0 — 消除懸掛引用）

1. 完成 testing-handbook.md 和 review-standards.md
2. 建 check-doc-freshness.sh

### Phase 2（P1 — 自動化強制 + 量化）

3. eslint import/no-restricted-paths 強制架構分層
4. vitest coverage 設定
5. file size check 腳本
6. steering-log.md + roasted REPEAT 標記
7. handoff.md 模板
8. roasted Visual Verification 步驟

### Phase 3（P2 — 持續改善循環）

9. CLAUDE.md Index Pattern 瘦身
10. common-lint-fixes.md
11. harness-metrics.sh
12. 定期 GC Agent 排程

---

## 關鍵檔案

| 用途              | 檔案路徑                                     |
| ----------------- | -------------------------------------------- |
| 主要 Guide        | `CLAUDE.md`                                  |
| ESLint 配置       | `eslint.config.mjs`                          |
| Code Review Skill | `.claude/skills/codereview-roasted/SKILL.md` |
| Vitest 配置       | `vitest.config.mjs`                          |
| CI 工作流         | `.github/workflows/ci.yml`                   |
| 參考文件目錄      | `.claude/references/`                        |
