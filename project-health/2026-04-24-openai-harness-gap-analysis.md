# OpenAI Harness Engineering Gap Analysis

> 日期：2026-04-24
> 來源：[Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) — Ryan Lopopolo
> 目的：比對 OpenAI 文章中的具體 harness 實踐，找出本 repo 尚未實作但有價值的 gap

---

## Part 1: 已對齊的實踐（不需要動）

以下是 OpenAI 文章中描述的實踐，本 repo 已經有對應建設：

| #   | OpenAI 實踐                                            | 本 repo 對應                                                                                         | 品質 |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---- |
| 1   | AGENTS.md 當目錄不當百科全書（progressive disclosure） | CLAUDE.md ~100 行 → `.claude/rules/`（5 支 path-scoped 自動載入）→ `.claude/references/`（按需查閱） | A+   |
| 2   | 分層 domain 架構 + 機械式 forward-only dependency 強制 | 6 層（Types→Config→Repo→Service→Runtime→UI）+ dependency-cruiser `.dependency-cruiser.mjs`           | A+   |
| 3   | Custom linter + error messages 設計成 agent 修正指引   | ESLint sections 13-14（src/lib 隔離、UI Firebase ban）+ depcruise `comment` 帶修正建議               | A    |
| 4   | 核心原則 / 不可協商鐵律                                | Constitution v1.8.0（9 Iron Laws）`.specify/memory/constitution.md`                                  | A+   |
| 5   | Agent code review                                      | codereview-roasted skill（Linus Torvalds 風格）                                                      | A    |
| 6   | 嚴格 CI quality gates                                  | ESLint `--max-warnings 0` + type-check + depcruise + spellcheck + vitest coverage + Playwright E2E   | A+   |
| 7   | Pre-commit hooks                                       | Husky：lint → type-check → spellcheck → vitest                                                       | A    |
| 8   | 開發流程 lifecycle                                     | 8 階段：需求→規格→技術規劃→任務拆分→品質審核→TDD 實作→Code Review→Merge                              | A    |

**結論**：這些都很紮實，不需要額外投資。

---

## Part 2: Gap 清單（有價值但尚未做的）

### Gap A: Quality Score 活文件

**優先級：HIGH**

#### OpenAI 怎麼做

維護一份 `QUALITY_SCORE.md`，為每個 product domain 和架構 layer 打分數，追蹤各面向的 gap。Agent 開工前讀這份文件，立即知道「哪裡弱、該優先做什麼」。背景 Codex 任務定期更新分數。

原文：

> A quality document grades each product domain and architectural layer, tracking gaps over time.

#### 我們現在的狀態

有兩份 **snapshot-in-time** 的 audit 報告：

- `project-health/2026-04-07-code-quality-report.md` — 已過期 17 天
- `project-health/2026-04-20-mock-audit-report.md` — 只覆蓋 `src/lib/` 的 coverage

問題：

1. **沒有活的文件** — agent 每次開 session 都對 repo 弱點一無所知
2. **分數沒有跨時間追蹤** — 無法看到品質趨勢（改善 or 退化）
3. **沒有 per-domain 粒度** — 不知道是 repo 層弱還是 runtime 層弱

#### 具體做法

建立 `docs/QUALITY_SCORE.md`，格式如下：

```markdown
# Quality Score Matrix

> Last Updated: 2026-04-24

| Layer         | Coverage % | Type-Check | Lint  | JSDoc   | Test Distribution | Grade |
| ------------- | ---------- | ---------- | ----- | ------- | ----------------- | ----- |
| types/        | N/A        | Clean      | Clean | Full    | N/A               | A     |
| config/       | 85%        | 2 errors   | Clean | Partial | 0 unit            | B     |
| repo/         | 92%        | Clean      | Clean | Full    | 8 unit + 3 integ  | A     |
| service/      | ...        | ...        | ...   | ...     | ...               | ...   |
| runtime/      | ...        | ...        | ...   | ...     | ...               | ...   |
| ui/           | ...        | ...        | ...   | ...     | ...               | ...   |
| lib/ (facade) | 97%        | Clean      | Clean | Full    | 15 unit           | A     |
| components/   | ...        | ...        | ...   | ...     | ...               | ...   |

## Score History

| Date       | Overall | Notes           |
| ---------- | ------- | --------------- |
| 2026-04-24 | B+      | Initial grading |
```

資料來源（全部已有，只需聚合）：

- `npm run test -- --coverage` → coverage per directory
- `npm run type-check 2>&1 | grep "error TS"` → type errors per file
- `npx eslint src --format json` → lint issues per directory
- 手動掃一輪 JSDoc completeness

**CLAUDE.md 更新**：在 Reference Docs 表格加入 `docs/QUALITY_SCORE.md` 指標。

#### 為什麼值得做

這是 **ROI 最高的 gap**。資料全部已經存在（coverage reports、lint output、type-check output），差的只是聚合和持久化。一次建立，每個 session 的 agent 都受益。

---

### Gap B: Tech-Debt Tracker

**優先級：HIGH**

#### OpenAI 怎麼做

維護 `docs/exec-plans/tech-debt-tracker.md` — 版控、集中、可被 agent 發現。列出每個 debt item 的 severity、來源（哪個 PR/review 識別的）、狀態。背景 agent 定期掃描新增 debt，agent 修復後更新狀態。

原文：

> Active plans, completed plans, and known technical debt are all versioned and co-located, allowing agents to operate without relying on external context.

#### 我們現在的狀態

技術債散落在至少 5 個地方：

1. `specs/*/code-review.md` 的 deferred items（至少 9 份 review 有提到待改善項目）
2. `project-health/2026-04-07-code-quality-report.md` 的 action items
3. `project-health/2026-04-20-mock-audit-report.md` 的 Session E（optional）
4. Memory files（`project_harness_lint_followup.md` 的 Option 1-3）
5. Conversation history（不持久化）

Agent 完全無法「順手」在 refactor 階段處理已知債務，因為**它根本不知道有哪些**。

#### 具體做法

建立 `docs/TECH_DEBT.md`：

```markdown
# Tech Debt Tracker

> Last Updated: 2026-04-24

## Open Items

| ID     | Severity | Domain | Description                                                           | Origin                         | Status                                     |
| ------ | -------- | ------ | --------------------------------------------------------------------- | ------------------------------ | ------------------------------------------ |
| TD-001 | Medium   | lib    | firebase-strava.js coverage 不到 90%                                  | mock-audit 2026-04-20          | Open                                       |
| TD-002 | Low      | lint   | Option 1: 升級 Section 13/14 error messages 為 agent-fixable 格式     | harness-lint-followup          | Deferred (trigger: agent confusion signal) |
| TD-003 | Low      | lint   | Option 2: 寫 common-lint-rationale.md                                 | harness-lint-followup          | Deferred (trigger: 3+ same-rule disables)  |
| TD-004 | Medium   | docs   | constitution Principle II 仍指向 src/lib/ 但架構已有 canonical layers | doc-drift 2026-04-24           | Open                                       |
| TD-005 | Low      | docs   | review-standards.md 仍為「🔜 待建」                                   | CLAUDE.md reference docs table | Open                                       |
| ...    | ...      | ...    | ...                                                                   | ...                            | ...                                        |

## Resolved Items

| ID  | Description | Resolved In | Date |
| --- | ----------- | ----------- | ---- |
```

Seeding 方式：從現有 code-review.md 和 project-health reports 提取 actionable items。

**慣例**：codereview-roasted 結束後，reviewer 將 acceptable-but-not-ideal patterns 新增到 `TECH_DEBT.md`。

---

### Gap C: Doc-Gardening / 文件新鮮度驗證

**優先級：HIGH**

#### OpenAI 怎麼做

1. **定期 doc-gardening agent** 掃描過時文件 → 開 fix-up PR
2. **CI lint** 驗證知識庫結構：交叉引用存在、index 正確、referenced files 存在

原文：

> Dedicated linters and CI jobs validate that the knowledge base is up to date, cross-linked, and structured correctly. A recurring "doc-gardening" agent scans for stale or obsolete documentation that does not reflect the real code behavior and opens fix-up pull requests.

#### 我們現在的狀態

**零機制**。已知的 drift 案例：

1. **Constitution Principle II drift**（嚴重）：
   - 憲法寫：「所有 Firebase 邏輯必須封裝在 `src/lib/` 中」
   - 實際：架構已遷移到 canonical layers（`src/repo/`、`src/service/`），`src/lib/` 現在是 compatibility facade
   - 影響：agent 讀了憲法後可能把新 Firebase 邏輯放到 `src/lib/` 而不是 `src/repo/`

2. **CLAUDE.md reference 空指向**：
   - `review-standards.md` 列為「🔜 待建」已超過一週，仍未建立
   - 4/7 code-quality report 描述的 `src/` 結構不含 `repo/service/runtime/ui/config` 目錄

3. **coding-standards.md vs eslint.config.mjs**：
   - 兩份文件描述相同的規則但可能無聲 diverge
   - 沒有機械式檢查它們是否一致

#### 具體做法

**Phase 1（立即，零工具）**：

- 每份關鍵文件加 `Last-Verified` 日期欄位
- 關鍵文件清單：CLAUDE.md、AGENTS.md、constitution.md、coding-standards.md、testing-handbook.md
- **立即修復 Constitution Principle II**：將「封裝在 `src/lib/`」改為反映 canonical layers 的現實

**Phase 2（機械式驗證）**：
建立 `scripts/doc-freshness-check.sh`，CI 跑：

1. 掃描 CLAUDE.md 和 AGENTS.md 中引用的所有檔案路徑 → 驗證存在
2. 檢查 `Last-Verified` 日期 → 超過 45 天的報錯
3. 比對 `coding-rules.md` 的 4 條 Non-Negotiable 和 `eslint.config.mjs` 的 rules → 確認每條都有對應 lint rule

**Phase 3（自動化）**：
Claude Code scheduled routine（月頻），讀每份 doc 比對 code 結構 → 開 fix PR。

#### 為什麼值得做

Agent-first 中 **docs = ground truth**。文件 drift = agent 寫出指向錯誤路徑的 code。Constitution Principle II 的 drift 是活的 bug，不是理論風險。

---

### Gap D: Non-Negotiable 升級為機械式強制

**優先級：HIGH**

#### OpenAI 怎麼做

每個 taste invariant 都有 custom lint 機械式強制。Error message 本身就是 agent context injection — 告訴 agent 怎麼修。

原文：

> We statically enforce structured logging, naming conventions for schemas and types, file size limits, and platform-specific reliability requirements with custom lints. Because the lints are custom, we write the error messages to inject remediation instructions into agent context.

另外：

> When documentation falls short, we promote the rule into code.

#### 我們現在的狀態

`coding-rules.md` 有 4 條 Non-Negotiable，但**只有 1 條**是完全機械式強制的：

| #   | Rule                         | 機械式強制？ | 說明                                                                     |
| --- | ---------------------------- | ------------ | ------------------------------------------------------------------------ |
| 1   | No `@ts-ignore`              | ✅ 是        | `grep` 指令 + type-check 捕捉                                            |
| 2   | No logic in JSX              | ❌ 否        | 只靠 manual review，沒有 lint rule                                       |
| 3   | No `eslint-disable` for a11y | ❌ 否        | 只靠 manual review，沒有 lint rule                                       |
| 4   | Meaningful JSDoc             | ⚠️ 部分      | `jsdoc/require-jsdoc` 是 `warn` 不是 `error`；「meaningful」無法自動判斷 |

此外，OpenAI 強制但我們沒有的：

- **File size limits** — 沒有 `max-lines` rule
- **Naming conventions** — 沒有 schema/type 命名規範的 lint

#### 具體做法

按優先序實作，全部改 `eslint.config.mjs`：

**D1: Ban `eslint-disable` for a11y rules**（最快，1 行 config）

方式：用 `eslint-plugin-eslint-comments` 的 `no-restricted-disable`，或直接用 `no-restricted-syntax` 掃描 `eslint-disable.*jsx-a11y` pattern。

推薦做法：在 `eslint.config.mjs` 加一個新 section：

```javascript
// 15. Ban eslint-disable for a11y rules
{
  files: ['src/**/*.{js,jsx}'],
  plugins: { 'eslint-comments': eslintComments },
  rules: {
    'eslint-comments/no-restricted-disable': [
      'error',
      'jsx-a11y/*',
    ],
  },
},
```

需安裝：`npm install -D @eslint-community/eslint-plugin-eslint-comments`

Error message 自動帶 agent 修正指引：「Fix the HTML structure (add roles, labels, key handlers) instead of disabling a11y rules.」

**D2: File size limits**（built-in rule，零依賴）

```javascript
// 16. File size limits (agent legibility)
{
  files: ['src/**/*.{js,jsx}'],
  rules: {
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
  },
},
```

注意用 `warn` 不是 `error` — 這是 soft limit，超過時提醒 agent 拆檔。

**D3: JSDoc severity 升級**（改兩個字）

```javascript
// 在 section 8 的 rules 中
'jsdoc/require-jsdoc': 'error',        // was 'warn'
'jsdoc/require-param-description': 'error',  // was 'warn'
```

注意：改之前先跑 `npx eslint src --rule '{"jsdoc/require-jsdoc":"error"}' --format json | jq '.[] | select(.errorCount>0) | .filePath'` 確認不會爆出太多 error。如果超過 20 個檔案，可能要分階段，先只升級 `require-param-description`。

**D4: No logic in JSX**（最複雜，可延後）

選項：

- A）`react/jsx-no-leaked-render` — 抓 `{condition && <Component/>}` 漏洞（React 已有）
- B）Custom rule 或 `complexity` threshold on render functions 作為 proxy
- C）`max-lines-per-function` 設在 render 函式上

建議先做 A（zero effort），B/C 視 code review 反饋再決定。

#### 為什麼值得做

OpenAI 原文核心觀點：**「When documentation falls short, we promote the rule into code.」** Non-Negotiable 但不強制 = 形同虛設。Agent 不會主動查 coding-rules.md 自我審查。D1 和 D2 是 10 分鐘的改動，立即生效。

---

### Gap E: Design Docs / ADR 系統

**優先級：MEDIUM-HIGH**

#### OpenAI 怎麼做

`docs/design-docs/` 含 `index.md`、`core-beliefs.md`、每個決定有 verification status。

原文：

> Design documentation is catalogued and indexed, including verification status and a set of core beliefs that define agent-first operating principles.

#### 我們現在的狀態

有 per-feature `spec.md`/`plan.md`（in `specs/`，共 21 個 feature 目錄），但**跨功能的架構決策**沒有記錄：

- 為什麼選 JSDoc + checkJs 不選 TypeScript？
- 為什麼 6 層 forward-only 架構？
- 為什麼 CSS Modules + Tailwind 4 雙軌策略？
- 為什麼 `src/lib/` 要當 compatibility facade 而不是直接刪掉？
- 為什麼 speckit 開發流程？

這些決策的 WHY 只存在於 conversation history（不持久化）。

#### 具體做法

建立 `docs/decisions/`：

```
docs/decisions/
├── INDEX.md
├── ADR-001-jsdoc-over-typescript.md
├── ADR-002-six-layer-forward-only-architecture.md
├── ADR-003-css-modules-plus-tailwind.md
├── ADR-004-lib-compatibility-facade.md
└── ADR-005-speckit-development-lifecycle.md
```

每份 ADR 用輕量模板：

```markdown
# ADR-001: JSDoc + checkJs over TypeScript

**Status**: Accepted
**Date**: 2026-02-03

## Context

[為什麼需要做這個決定]

## Decision

[做了什麼決定]

## Consequences

[好處和壞處]
```

**CLAUDE.md 更新**：Reference Docs 表格加入 `docs/decisions/INDEX.md`。

#### 為什麼值得做

沒有 ADR，agent 可能在不知情下重新辯論已定案的決策。例如一個 session 建議「我們應該遷移到 TypeScript」，但完全不知道這個選擇背後的 trade-off 已經被考慮過。

---

### Gap F: Core Beliefs / Agent 操作哲學

**優先級：MEDIUM**

#### OpenAI 怎麼做

`core-beliefs.md` 定義 agent-first 操作原則 — 不是 coding standards（WHAT），而是 decision framework（HOW to think about trade-offs）。

原文範例思維：

- Boring tech preferred（composable、API stable、training set coverage 好）
- 有時自建子集功能 > 引入不透明的第三方套件
- 修正便宜，等待昂貴
- 文件不夠時將規則提升為 code

#### 我們現在的狀態

Constitution 定義 9 個 WHAT（規則），不是 HOW（操作哲學）。Cross-synthesis 識別了 8 個業界共識 pattern，但框架為觀察而非指令。

#### 具體做法

建立 `.claude/references/core-beliefs.md`：

```markdown
# Core Beliefs (Agent Operating Principles)

本文件定義 agent 在本 repo 工作時的「決策框架」— 不是具體規則（那是 Constitution），
而是遇到 trade-off 時的思考方式。

## 1. Boring Tech Preferred

偏好 composable、API 穩定、LLM 訓練集覆蓋好的技術。
新套件引入前問：agent 能否僅從 repo 內 context 推理這個套件的行為？

## 2. Mechanical Enforcement Over Documentation

規則重要到需要寫進 coding-rules.md → 就重要到該有 lint rule。
「When documentation falls short, promote the rule into code.」

## 3. MVP First, No Overdesign

拒絕 hypothetical future requirements。三行重複好過 premature abstraction。

## 4. Corrections Are Cheap, Waiting Is Expensive

Test flake → follow-up task，不無限期 block。
PR 生命週期短，小錯快修。

## 5. Agent Context Is Scarce

文件短、用 progressive disclosure。不要把 1000 行指令塞進 context。

## 6. Every Finding Becomes Code or Debt

Review 發現 → 要嘛變 lint rule，要嘛進 TECH_DEBT.md。
絕不是「只留個 comment 然後淡忘」。

## 7. Reuse > Rewrite > Import Opaque

共用 utility > 各自手寫 > 引入不透明第三方。
集中 invariants，避免 agent 複製次優 pattern。
```

#### 為什麼值得做

Constitution 告訴 agent「不能做什麼」，core beliefs 告訴 agent「遇到灰色地帶時怎麼想」。當多個 agent runtime（Claude/Codex/Gemini）在 repo 裡工作時，統一的決策框架減少 drift。但因為 constitution 已經很強，這個 gap 不如 A-D 急迫。

---

### Gap G: Specs Index

**優先級：MEDIUM**

#### OpenAI 怎麼做

所有 plans 有 index，區分 active/completed，agent 可快速找到相關歷史決策。

#### 我們現在的狀態

`specs/` 有 28 個目錄（21 feature + 7 harness/utility），沒有 index。Agent 必須 `ls specs/` 然後逐一讀才能知道哪些相關。

```
specs/
├── 001-event-filtering/
├── 002-jsdoc-refactor/
├── ...
├── 021-layered-dependency-architecture/
├── fix/
├── g8-server-coverage/
├── g10-storage-helper/
├── mock-audit-b-weather-api/
├── mock-audit-c-firebase-users/
├── mock-audit-d1-firebase-posts/
├── mock-audit-d2-firebase-posts-comments-likes/
└── test-utils/
```

#### 具體做法

建立 `specs/INDEX.md`：

```markdown
# Specs Index

| #   | Spec                            | Domain       | Status    | Summary                   |
| --- | ------------------------------- | ------------ | --------- | ------------------------- |
| 001 | event-filtering                 | Events       | Completed | 活動篩選功能              |
| 002 | jsdoc-refactor                  | DX           | Completed | JSDoc 規範化              |
| ... | ...                             | ...          | ...       | ...                       |
| 021 | layered-dependency-architecture | Architecture | Completed | 6 層 forward-only 架構    |
| —   | mock-audit-\*                   | Quality      | Completed | Coverage 黑洞修復         |
| —   | g8-server-coverage              | Quality      | Completed | Server-side test coverage |
```

輕量一次性工作，之後每建新 spec 加一行。

---

## Part 3: 不適用 / 跳過的

| OpenAI 實踐                                                                    | 為什麼跳過                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **Ephemeral observability stack**（Victoria Logs/Metrics/Traces per worktree） | 百萬行 + 7 人團隊的需求。個人專案 console.warn/error 足夠                 |
| **Agent-to-Agent review loop**（Ralph Wiggum Loop）                            | 需要 cloud agent infra。codereview-roasted 已是 single-agent review，夠用 |
| **Agent auto-merge PR**                                                        | main 是 protected branch + PR required，且人類 review 是有意的約束        |
| **6+ 小時持續 agent run**                                                      | 不是當前 workflow — session-based 互動為主                                |
| **Product dashboard definition files**                                         | 不適用 — 沒有 production dashboard                                        |
| **References as llms.txt files**                                               | context7 MCP 提供即時 library docs，比 static files 更好                  |

---

## Part 4: 執行排程建議

### Session 1（Quick Wins — ~1 小時）

- [ ] **Gap D1**: Ban `eslint-disable` for a11y（安裝 plugin + 1 個 ESLint section）
- [ ] **Gap D2**: File size limits `max-lines`（1 個 ESLint section）
- [ ] **Gap D3**: JSDoc severity 升級（改 2 個 `warn` → `error`，先驗證影響範圍）

### Session 2（Living Documents — ~1-2 小時）

- [ ] **Gap B**: 建立 `docs/TECH_DEBT.md`（從現有 code-review 和 audit reports 提取）
- [ ] **Gap A**: 建立 `docs/QUALITY_SCORE.md`（跑 coverage + lint + type-check 聚合分數）

### Session 3（Doc Health — ~1 小時）

- [ ] **Gap C Phase 1**: 修復 Constitution Principle II drift（src/lib/ → canonical layers）
- [ ] **Gap C Phase 1**: 加 `Last-Verified` 欄位到關鍵文件
- [ ] **Gap C Phase 1**: 決定 review-standards.md 是要建還是從 Reference Docs 表格移除

### Session 4（Structural — ~2 小時）

- [ ] **Gap E**: 建立 `docs/decisions/` + seed 3-5 ADRs
- [ ] **Gap G**: 建立 `specs/INDEX.md`
- [ ] **Gap F**: 建立 `.claude/references/core-beliefs.md`

### Session 5（Automation — optional）

- [ ] **Gap C Phase 2**: 建立 `scripts/doc-freshness-check.sh` + 加入 CI
- [ ] **Gap D4**: No logic in JSX lint rule（視 code review 反饋決定方案）
- [ ] **Gap A automation**: `scripts/update-quality-score.js` 或 scheduled routine

---

## Part 5: 文章原文的關鍵金句（供未來 session 參考）

> "When something failed, the fix was almost never 'try harder.' ... human engineers always stepped into the task and asked: 'what capability is missing, and how do we make it both legible and enforceable for the agent?'"

> "Give Codex a map, not a 1,000-page instruction manual."

> "When documentation falls short, we promote the rule into code."

> "Enforce boundaries centrally, allow autonomy locally."

> "The resulting code does not always match human stylistic preferences, and that's okay. As long as the output is correct, maintainable, and legible to future agent runs, it meets the bar."

> "Human taste is captured once, then enforced continuously on every line of code."

> "Technical debt is like a high-interest loan: it's almost always better to pay it down continuously in small increments than to let it compound."
