# 026 — S1 align config defaults — Tasks

## Goal

對齊 4 個 config 檔的預設值，解決 audit report 的 **P2-1 / P2-3 / P2-5**（規則 R3 + R4 + R5）。

S1 是 audit report §12 的第一個 commit，無依賴；S1 通過後才能進 S2-S10。

## References

- Audit report 來源：[`project-health/2026-04-29-tests-audit-report.md`](../../project-health/2026-04-29-tests-audit-report.md)
  - L324-360 — P2-1 / P2-3 / P2-5 完整描述
  - L586-592 — S1 章節（執行序列第 1 個 commit）
- Audit IDs：P2-1（vitest defaultProject）、P2-3（Firebase project ID 統一）、P2-5（Playwright timeout 對稱）
- Rules：R3（npm test default project）、R4（Firebase project ID 統一）、R5（Playwright timeout）

## Execution Rule

**主 agent 不下手任何實作**。所有改檔、跑驗證命令、git add/commit 都由 subagent 完成。

每個 task 配對 1 engineer subagent + 1 reviewer subagent：

1. Engineer 完成改動 → 在 `handoff.md` §3 填 evidence（git diff + 命令輸出摘要）
2. Reviewer 必須 Read engineer 改的檔案、實際重跑至少 1 個驗證命令、在 §3 填 reviewer 簽名 + 命令輸出
3. Reviewer reject → 主 agent 重派同 task engineer（attach reviewer feedback），retry ≤ 3
4. 第 3 次仍 reject → 主 agent 標 escalated，回報用戶

## Concurrency

```
Wave 1 (4 並行):  T01-eng | T02-eng | T03-eng | T04-eng
                       ↓ each 完成後立即觸發 reviewer ↓
Wave 2 (≤4 並行): T01-rev | T02-rev | T03-rev | T04-rev
                       ↓ 全部 verified-pass ↓
Wave 3 (序列):    T05-eng → T05-rev
```

- Max concurrent subagent: **4**
- Total subagent invocations (no retry case): **10**（T01-T04 各 2 + T05 各 2）
- T01-T04 互不相依；T05 等 T01-T04 全 verified-pass

## Status Legend

- `[ ]` pending
- `[~]` in progress
- `[x]` completed (engineer 完成且 reviewer pass)
- `[!]` escalated (3 次 reject 仍未通過)

---

## Tasks

### T01 — vitest 預設 project（package.json script 路線）

- **Status**: `[ ]`
- **File**: `package.json`
- **Audit**: P2-1 / Rule R3
- **Change**: `L13: "test": "vitest" → "test": "vitest --project=browser"`
- **不可動**: `vitest.config.mjs`（不加 `defaultProject` — vitest 4.1.4 不存在此 key）

> **Scope change 2026-04-29**: 1st attempt 發現 vitest 4.1.4 無 defaultProject，用戶批准改走 package.json 路線。

**Acceptance Criteria**：

- **AC-T01.1**: `git diff package.json` 只新增 `--project=browser`（最小 diff）；ESLint pass
- **AC-T01.2**: `npm test`（不帶 args）只跑 browser project，stdout 無 server project 啟動跡象、無 emulator missing error。執行命令：

  ```bash
  npm test 2>&1 | head -30
  ```

- **AC-T01.3**: `npm test -- --project=server` 顯式選 server project 仍能正確啟動（不破壞既有顯式選擇）
- **AC-T01.4**: pre-commit gate 全綠（`.husky/pre-commit` 自動執行：lint --max-warnings 0 / type-check / depcruise / spellcheck / vitest browser）

**Engineer Evidence**（貼到 `handoff.md` §3）：

- `git diff package.json` 完整輸出
- AC-T01.2 stdout 前 30 行

**Reviewer 驗證**：

- 重跑 AC-T01.2、貼新 stdout
- Read `package.json` 確認 L13 為 `"test": "vitest --project=browser"`
- 在 §3 reviewer 欄填名稱 + 時間戳 + 命令輸出摘要

---

### T02 — run-all-e2e.sh project ID

- **Status**: `[ ]`
- **File**: `scripts/run-all-e2e.sh`
- **Audit**: P2-3 / Rule R4
- **Change**:
  - **L167**: `--project dive-into-run` → `--project=demo-test`（注意：原本無等號，新版用等號形式對齊 `package.json:15-17`）
  - **L235-236**: URL 內 `dive-into-run` → `demo-test`（與 emulator UI URL 對齊，audit P2-3 已確認此處也用錯 ID）

**Acceptance Criteria**：

- **AC-T02.1**: `grep -n "dive-into-run" scripts/run-all-e2e.sh` 結果 0 hits

  ```bash
  grep -n "dive-into-run" scripts/run-all-e2e.sh || echo "0 hits (expected)"
  ```

- **AC-T02.2**: L167 改用等號形式 `--project=demo-test`（與 `package.json:15-17` 統一）
- **AC-T02.3**: shell 語法檢查通過

  ```bash
  bash -n scripts/run-all-e2e.sh && echo "syntax OK"
  ```

- **AC-T02.4**: pre-commit gate 全綠

**Engineer Evidence**：

- `git diff scripts/run-all-e2e.sh` 完整輸出
- AC-T02.1 grep 結果（含 0 hits 確認）
- AC-T02.3 `bash -n` 結果

**Reviewer 驗證**：

- 重跑 AC-T02.1 grep
- 重跑 AC-T02.3 `bash -n`
- Read `scripts/run-all-e2e.sh` 確認 L167、L235-236 三處都改對
- 在 §3 簽名 + 命令輸出

---

### T03 — playwright.config.mjs timeout + expect.timeout

- **Status**: `[ ]`
- **File**: `playwright.config.mjs`
- **Audit**: P2-5 / Rule R5
- **Change**: 加兩個欄位
  - `timeout: 30_000`（顯式設預設值，避免漂移）
  - `expect: { timeout: 10_000 }`（audit 建議統一值）

**Acceptance Criteria**：

- **AC-T03.1**: 動態 import 確認兩個欄位值

  ```bash
  node -e "import('./playwright.config.mjs').then(m=>console.log(JSON.stringify({t:m.default.timeout,e:m.default.expect})))"
  ```

  輸出必須包含 `"t":30000` 且 `"timeout":10000`

- **AC-T03.2**: Playwright 載入 config 不報錯

  ```bash
  npx playwright test --list 2>&1 | tail -5
  ```

  無 error / SyntaxError / config validation 錯誤

- **AC-T03.3**: pre-commit gate 全綠

**Engineer Evidence**：

- `git diff playwright.config.mjs` 完整輸出
- AC-T03.1 node import 輸出
- AC-T03.2 playwright list 結果

**Reviewer 驗證**：

- 重跑 AC-T03.1 node import
- 重跑 AC-T03.2 playwright list
- Read `playwright.config.mjs` 確認 `timeout` 與 `expect.timeout` 在 config object 頂層
- 在 §3 簽名 + 命令輸出

---

### T04 — playwright.emulator.config.mjs expect.timeout

- **Status**: `[ ]`
- **File**: `playwright.emulator.config.mjs`
- **Audit**: P2-5 / Rule R5
- **Change**: 補 `expect: { timeout: 10_000 }`
- **不可動**: `timeout: 60_000`（已存在於 L63，audit 建議只補 expect 不動 timeout）

**Acceptance Criteria**：

- **AC-T04.1**: 動態 import 確認兩個欄位值

  ```bash
  node -e "import('./playwright.emulator.config.mjs').then(m=>console.log(JSON.stringify({t:m.default.timeout,e:m.default.expect})))"
  ```

  輸出必須包含 `"t":60000`（保留原值）且 `"timeout":10000`（新加 expect.timeout）

- **AC-T04.2**: Playwright 載入 config 不報錯

  ```bash
  npx playwright test --config playwright.emulator.config.mjs --list 2>&1 | tail -5
  ```

- **AC-T04.3**: pre-commit gate 全綠

**Engineer Evidence**：

- `git diff playwright.emulator.config.mjs` 完整輸出
- AC-T04.1 node import 輸出
- AC-T04.2 playwright list 結果

**Reviewer 驗證**：

- 重跑 AC-T04.1 node import（特別確認 `t:60000` 沒被誤改）
- 重跑 AC-T04.2 playwright list
- Read 確認原 `timeout: 60000` 完整保留
- 在 §3 簽名 + 命令輸出

---

### T05 — Integration verification + commit

- **Status**: `[ ]`
- **Files**: 不改 config；只跑驗證 + commit + 更新 handoff.md
- **Dependencies**: T01-T04 全部 `[x]`

**Action 流程**：

1. 確認 `handoff.md` §3 的 T01-T04 evidence + reviewer signature 完整
2. 一次性重跑全 acceptance（見 AC-T05.2）
3. 更新 `handoff.md` §0 Current State（status 全填 `done`）、§1 Next Session Checklist（指向 S2 PR template）、§3 自身 evidence、§5 Environment（填 node/vitest/playwright 版本）
4. `git add` 4 個 config 檔 + `specs/026-tests-audit-report/handoff.md` + `specs/026-tests-audit-report/tasks.md`（如 T01-T04 有勾 status）
5. `git commit`（不 push）

**Acceptance Criteria**：

- **AC-T05.1**: `handoff.md` §3 Final Evidence T01-T04 全填、engineer + reviewer 雙簽名（reviewer 欄不為空）
- **AC-T05.2**: 一次性重跑全 acceptance：

  ```bash
  npm test 2>&1 | head -30                                                   # 只跑 browser
  grep -rn "dive-into-run" scripts/ || echo "0 hits (expected)"             # 0 hits
  node -e "import('./playwright.config.mjs').then(m=>console.log(JSON.stringify({t:m.default.timeout,e:m.default.expect})))"
  node -e "import('./playwright.emulator.config.mjs').then(m=>console.log(JSON.stringify({t:m.default.timeout,e:m.default.expect})))"
  ```

  輸出符合各 task AC

- **AC-T05.3**: `git commit` message 格式：

  ```
  chore(config): align test config defaults (P2-1, P2-3, P2-5)

  - vitest.config.mjs: add defaultProject 'browser'
  - scripts/run-all-e2e.sh: dive-into-run → demo-test (L167, L235-236)
  - playwright.config.mjs: add timeout 30_000 + expect.timeout 10_000
  - playwright.emulator.config.mjs: add expect.timeout 10_000

  Refs: project-health/2026-04-29-tests-audit-report.md L324-360, L586-592
  ```

  - Conventional commits 格式
  - **不加 `Co-Authored-By`**（user memory `feedback_no_coauthor`）

- **AC-T05.4**:
  - branch = `026-tests-audit-report`
  - **不 push** 到遠端（用戶沒明說推遠端）
  - pre-commit hook 全綠通過（commit 才會成功）

- **AC-T05.5**: `git show <hash> --stat` 顯示 6 個檔案（4 config + 2 spec markdown）

**Engineer Evidence**：

- AC-T05.2 全部命令輸出
- `git log -1 --format=fuller` 輸出（確認 commit message + 無 Co-Authored-By）
- `git show <hash> --stat`

**Reviewer 驗證**：

- 重跑 AC-T05.2 全部命令
- `git show <hash> --stat` 確認 6 檔
- `git show <hash>` 確認 commit message 格式正確、**無 `Co-Authored-By` 行**
- Read `handoff.md` 確認 §0 §1 §3 §5 完整
- 在 §3 T05 reviewer 欄簽名

---

# S2 — PR template

> S1（T01-T05）已於 commit `97e78d2` 完成（branch `026-tests-audit-report` 上）。S2 從 T06 開始追加，沿用本檔同一份 Reviewer 認證標準 / Retry & Escalation / Subagent 配對表（下方擴充）/ 通用須知。

## S2 Goal

新增 `.github/pull_request_template.md`，內含 audit-driven checkbox（mock-boundary / flaky pattern / firestore rules / coverage / baseline 變化），對應 audit report **R11**。

S2 是 audit report §12 的第 2 個 commit，純文件 PR（單一新檔 + handoff/tasks 更新），不動程式碼、不動 config，**規模 < 200 行 markdown**。

PR template 的特性：merge 進 `main` 後，**下一個** PR（不含本 PR 自身）才會自動套用，所以本 S2 的 PR description 仍須手寫。

## S2 References

- Audit report 來源：[`project-health/2026-04-29-tests-audit-report.md`](../../project-health/2026-04-29-tests-audit-report.md)
  - **L594-598** — S2 章節（執行序列第 2 個 commit）
  - **L545-551** — R11 規則（PR template 含 audit checkbox）
  - **L641-657** — Baseline 追蹤機制（PR template 三道防線之一）
  - **L77-95** — P0-1 mock-boundary 違規類型
  - **L294-318** — P1-4 / P1-5 flaky pattern
  - **L113-141** — P0-2 firestore rules 5 條 critical paths
  - **L168-208** — P0-4 coverage 三層 (ui/components/app)
- Audit IDs：P0-1 / P0-2 / P0-4 / P1-4 / P1-5
- Rule：R11
- GitHub spec：PR template 檔名統一用 `.github/pull_request_template.md`（小寫）

## S2 Concurrency

S2 為純序列任務鏈（T06 spike → T07 寫稿 → T08 驗證 → T09 commit）：

```
Wave 1 (序列): T06-eng → T06-rev   (規格確認，必先做)
Wave 2 (序列): T07-eng → T07-rev   (寫 template body，依賴 T06)
Wave 3 (序列): T08-eng → T08-rev   (跑 spellcheck/lint 驗證，依賴 T07)
Wave 4 (序列): T09-eng → T09-rev   (整合 + commit + handoff sync，依賴 T08)
```

| 項目                            | 值                                     |
| ------------------------------- | -------------------------------------- |
| Max concurrent subagent (S2)    | **1**（純序列，eng/rev 不同時 active） |
| Total subagent invocations (S2) | **8**（4 eng + 4 rev，no retry case）  |

> 為什麼不並行：S2 唯一改動檔是 `.github/pull_request_template.md`（新檔），多 engineer 同改會 conflict；驗證類 task 必須等 content 完成才有東西可驗。

## S2 Tasks

### T06 — Spike: PR template 設計與規格確認

- **Status**: `[x]`
- **Files Read**:
  - `.github/`（確認目錄結構、檢查現有 template / workflows）
  - `project-health/2026-04-29-tests-audit-report.md` L77-95 / L113-141 / L168-208 / L294-318 / L545-551 / L594-598 / L641-657
  - `cspell.json`（盤點現有字典）
- **Files Written**: 只動 `specs/026-tests-audit-report/handoff.md` §3 T06 row（**不**動 `.github/`）
- **Audit**: P0-1 / P0-2 / P0-4 / P1-4 / P1-5 / R11

**Engineer Action**：在 `handoff.md` §3 T06 row Eng evidence 欄填三節：

1. **`.github/` 現況快照** — `ls -la .github/` + `find .github -type f` 輸出，確認**無**現有 PR template，記錄最終建議檔名（**小寫**）
2. **5 類 audit checkbox 內容草案**（design draft） — 每類 ≥ 2 條 checkbox，標註對應 audit ID + audit report 行號（≥ 1 file:line 引用）：
   - Mock boundary（P0-1，L77-95）
   - Flaky pattern（P1-4 / P1-5，L294-318）
   - Firestore rules（P0-2，L113-141）
   - Coverage（P0-4，L168-208）
   - Baseline tracking（L641-657，含 commit message `Baseline change: <type>: N → M (...)` 格式範例）
3. **Template skeleton 大綱** — 列出章節（≥ Summary / Audit Checklist 兩節）+ 各章節用途

**Acceptance Criteria**：

- **AC-T06.1**: §3 T06 row Eng evidence 含三節（現況快照 / checkbox 草案 / skeleton 大綱），每節有具體內容（非空）
- **AC-T06.2**: 5 類 audit checkbox 草案皆含**至少 2 條**，且每條註明 audit ID + audit report 行號（**至少 1 個 file:line 引用**）
- **AC-T06.3**: 確認最終檔名為 `.github/pull_request_template.md`（lowercase），並在 handoff §3 註明此決議
- **AC-T06.4**: skeleton 大綱**至少包含** Summary / Audit Checklist 兩節

**Engineer Evidence**：上述三節完整內容 + 命名決議的引用（指 audit L595 / GitHub spec）

**Reviewer 驗證**：

- Read `.github/` 與 `cspell.json` 確認 engineer 描述屬實
- Read audit report 對應行號區間，核對 audit ID + 行號正確
- 在 §3 T06 reviewer 欄填名稱 + 時間戳 + 不少於 4 行驗證結論
- Reviewer **不能** Edit `.github/`、不能寫 template content（spike 階段不寫稿）

---

### T07 — PR template 草稿撰寫

- **Status**: `[x]`
- **Files Written**: `.github/pull_request_template.md`（新檔）
- **Files Read**: T06 在 handoff §3 留下的 design draft、audit report 對應行號
- **Audit**: R11
- **Dependencies**: T06 必須 `[x]`

**Engineer Action**：根據 T06 設計建立 `.github/pull_request_template.md`，必含：

1. `## Summary` — 1-3 bullets 範例 + filler 註解
2. `## Test Plan` — bulleted checklist 範例 + filler 註解
3. `## Audit Checklist` — 5 個 H3 子節（Mock boundary / Flaky pattern / Firestore rules / Coverage / Baseline tracking），每子節 ≥ 2 個 `- [ ]` checkbox，每 checkbox 後附 audit ID 標籤（如 `[P0-1]`）
4. `## Related` — 連結 audit report placeholder

**Constraints**：

- 全檔 ≤ 200 行
- 不寫 emoji（除非 audit 原文用 emoji）
- 章節 title 統一英文（與 GitHub PR UI 一致）
- 用 markdown checkbox `- [ ]`（含空格），不用其他符號

**Acceptance Criteria**：

- **AC-T07.1**: 新檔存在且行數 ≤ 200

  ```bash
  test -f .github/pull_request_template.md && wc -l .github/pull_request_template.md
  ```

- **AC-T07.2**: 含 5 個 H3 子節

  ```bash
  grep -c "^### " .github/pull_request_template.md
  ```

  ≥ 5

- **AC-T07.3**: checkbox 數量 ≥ 10

  ```bash
  grep -c "^- \[ \]" .github/pull_request_template.md
  ```

  ≥ 10

- **AC-T07.4**: 含 `Baseline change:` 字串範例

  ```bash
  grep -c "Baseline change:" .github/pull_request_template.md
  ```

  ≥ 1

- **AC-T07.5**: UTF-8、無 BOM

  ```bash
  file .github/pull_request_template.md
  ```

  含 `UTF-8`、不含 `BOM`

**Engineer Evidence**：

- AC-T07.1-T07.5 命令輸出
- `git diff --stat .github/pull_request_template.md`
- 完整檔案內容（用 `~~~~` 四 tilde fence 外層包裝）貼到 §3 T07 row

**Reviewer 驗證**：

- Read `.github/pull_request_template.md` 完整檔
- 重跑 AC-T07.1-T07.4 全部命令，貼新輸出
- 對照 §3 T06 design draft 確認 5 類 checkbox 都實際寫進 template
- 確認 markdown 結構合法（headings 階層、`- [ ]` 含空格）
- 在 §3 T07 reviewer 欄簽名 + 命令輸出 + ≥ 3 行驗證結論

---

### T08 — Spellcheck / Pre-commit gate 預跑驗證

- **Status**: `[x]`
- **Files Written**: 可能更動 `cspell.json`（若 PR template 含未收錄詞）
- **Files Read**: T07 寫的 `.github/pull_request_template.md`、`cspell.json`
- **Audit**: 對應 sensors.md cSpell 防線
- **Dependencies**: T07 必須 `[x]`

**Engineer Action**：

1. 跑 `npm run spellcheck`，若 fail：
   - domain term → Edit `cspell.json` 加詞 → 再跑
   - typo → Edit template 改詞 → 再跑
   - **禁止** inline `cspell:disable`（coding-rules.md / sensors.md）
2. 跑 `npm run lint -- --max-warnings 0`（驗 ESLint 對 markdown 不爆）
3. 跑 `npm run type-check`（pre-commit 順帶跑）
4. 跑 `npm run depcruise`（pre-commit 順帶跑）
5. 跑 `npx vitest run --project=browser`（無 regression）
6. **不**跑 `npm run test:server` / `test:coverage`（無需 emulator）

**Acceptance Criteria**：

- **AC-T08.1**: spellcheck 通過

  ```bash
  npm run spellcheck 2>&1 | tail -5
  ```

  含 `Issues found: 0`

- **AC-T08.2**: lint 通過

  ```bash
  npm run lint -- --max-warnings 0 2>&1 | tail -5
  ```

  exit 0

- **AC-T08.3**: type-check 通過

  ```bash
  npm run type-check 2>&1 | tail -5
  ```

  exit 0

- **AC-T08.4**: depcruise 通過

  ```bash
  npm run depcruise 2>&1 | tail -3
  ```

  含 `no dependency violations found`

- **AC-T08.5**: vitest browser 通過

  ```bash
  npx vitest run --project=browser 2>&1 | tail -5
  ```

  `Tests N passed (N)`、無 failed

- **AC-T08.6**: 若 `cspell.json` 改動，貼 diff；否則明確聲明「無改動」

**Engineer Evidence**：AC-T08.1-T08.5 全部輸出 + AC-T08.6 cspell diff（或聲明）+ 加詞理由（domain term vs typo）

**Reviewer 驗證**：

- 重跑 AC-T08.1（spellcheck，最重要）
- 重跑 AC-T08.5（vitest browser，無 regression）
- Read `cspell.json`（若 engineer 聲明改動）對照 git diff
- 在 §3 T08 reviewer 欄簽名 + 命令輸出 + ≥ 3 行驗證結論
- **若 engineer 加 inline `cspell:disable`，必 reject**

---

### T09 — Commit + handoff sync (S2)

- **Status**: `[x]`
- **Files Written**:
  - `specs/026-tests-audit-report/handoff.md` §0 / §1 / §3（T09 self-evidence）/ §5 完整更新
  - `specs/026-tests-audit-report/tasks.md`（T06-T09 status `[ ]` → `[x]`）
- **Files committed**: `.github/pull_request_template.md` + `specs/026-tests-audit-report/handoff.md` + `specs/026-tests-audit-report/tasks.md`（+ `cspell.json` 若 T08 改）
- **Dependencies**: T06-T08 全部 `[x]`

**Engineer Action**：

1. 確認 §3 T06-T08 evidence + reviewer signature 完整
2. 一次性重跑全 acceptance（見 AC-T09.2）
3. 更新 `handoff.md`：
   - §0：T06-T09 全填 `done`、Last commit (S2) 留待 commit 後填
   - §1：指向 S3（`coverage include + baseline`）
   - §3 T09 row engineer evidence 填寫
   - §5：填 node / vitest 版本（cSpell 版本可選）
4. 更新 `tasks.md`：T06-T09 Status `[ ]` → `[x]`
5. 跑完整 pre-commit gate 全綠才 stage
6. **明確列檔** stage（**禁** `git add -A`）：

   ```bash
   git add .github/pull_request_template.md \
           specs/026-tests-audit-report/handoff.md \
           specs/026-tests-audit-report/tasks.md
   # 若 T08 加詞：再 git add cspell.json
   ```

7. `git commit`（不 push）

**Acceptance Criteria**：

- **AC-T09.1**: §3 T06-T08 三 row 都 `rev-pass` + 雙簽名；`tasks.md` T06-T09 全 `[x]`

- **AC-T09.2**: 一次性重跑

  ```bash
  test -f .github/pull_request_template.md && wc -l .github/pull_request_template.md
  grep -c "^### " .github/pull_request_template.md
  grep -c "^- \[ \]" .github/pull_request_template.md
  grep -c "Baseline change:" .github/pull_request_template.md
  npm run spellcheck 2>&1 | tail -5
  npm run lint -- --max-warnings 0 2>&1 | tail -5
  npm run type-check 2>&1 | tail -5
  npm run depcruise 2>&1 | tail -3
  ```

  全部符合 T07-T08 各自 AC

- **AC-T09.3**: commit message 格式：

  ```
  chore(github): add PR template with audit checklist (R11)

  - .github/pull_request_template.md: new file containing Summary / Test Plan
    / Audit Checklist (mock-boundary [P0-1], flaky pattern [P1-4/P1-5],
    firestore rules [P0-2], coverage [P0-4], baseline tracking) / Related
  - <若 T08 改 cspell：cspell.json: add N domain terms (<list>)>

  PR template merge 進 main 後對下一個 PR 自動套用，本 PR description 仍須手寫。

  Refs: project-health/2026-04-29-tests-audit-report.md L594-598, L641-657
  ```

  - Conventional commits `chore(github):`
  - **不加 `Co-Authored-By`**

- **AC-T09.4**:
  - branch = `026-tests-audit-report`
  - **不 push** 到遠端
  - pre-commit hook 全綠

- **AC-T09.5**: `git show <hash> --stat` 顯示 **3-4 個檔**：
  - `.github/pull_request_template.md`（新檔）
  - `specs/026-tests-audit-report/handoff.md`
  - `specs/026-tests-audit-report/tasks.md`
  - 若 T08 加詞：`cspell.json`

- **AC-T09.6**: `git log -1 --format=%B | grep -ic "Co-Authored-By"` = 0

**Engineer Evidence**：

- AC-T09.2 全部命令輸出
- `git log -1 --format=fuller`
- `git show <hash> --stat`
- AC-T09.6 grep 結果

**Reviewer 驗證**：

- 重跑 AC-T09.2 全部命令
- `git show <hash> --stat` 確認檔案數量 + 檔名
- `git show <hash>` 看完整 commit message + diff
- AC-T09.6 grep = 0
- `git log origin/026-tests-audit-report..HEAD 2>&1` 應錯誤或顯示 1 commit ahead（**未** push）
- Read `handoff.md` 確認 §0 / §1 / §3 / §5 完整
- Read `tasks.md` 確認 T06-T09 全 `[x]`
- 在 §3 T09 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論

---

## Reviewer 認證標準（適用所有 task）

| 必做                                                                 | 不能只做                         |
| -------------------------------------------------------------------- | -------------------------------- |
| Read engineer 改的檔案                                               | 只看 engineer 貼的 evidence 字串 |
| 實際執行至少 1 個 AC 命令                                            | 「看起來對」就 pass              |
| 在 `handoff.md` §3 reviewer 欄填：name + 時間戳 + 命令輸出摘要       | 留空或只寫「pass」               |
| Reject 時：寫 reason + 失敗的 AC 編號（e.g. `AC-T01.2 failed: ...`） | 含糊批評                         |

## Retry & Escalation

| 階段                | 動作                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| 1st reviewer reject | 主 agent 重派同 task engineer 2nd attempt（attach reviewer feedback） |
| 2nd reviewer reject | 主 agent 重派 engineer 3rd attempt                                    |
| 3rd reviewer reject | 主 agent 把 task 標 `[!]`，handoff.md 寫 escalation reason，回報用戶  |

## Subagent 配對表

| Task | Scope | Engineer subagent_type | Reviewer subagent_type | Wave | Concurrent peers |
| ---- | ----- | ---------------------- | ---------------------- | ---- | ---------------- |
| T01  | S1    | general-purpose        | general-purpose        | S1-1 | T02, T03, T04    |
| T02  | S1    | general-purpose        | general-purpose        | S1-1 | T01, T03, T04    |
| T03  | S1    | general-purpose        | general-purpose        | S1-1 | T01, T02, T04    |
| T04  | S1    | general-purpose        | general-purpose        | S1-1 | T01, T02, T03    |
| T05  | S1    | general-purpose        | general-purpose        | S1-2 | (none)           |
| T06  | S2    | general-purpose        | general-purpose        | S2-1 | (none, 序列)     |
| T07  | S2    | general-purpose        | general-purpose        | S2-2 | (none, 序列)     |
| T08  | S2    | general-purpose        | general-purpose        | S2-3 | (none, 序列)     |
| T09  | S2    | general-purpose        | general-purpose        | S2-4 | (none, 序列)     |

## Subagent 通用須知

- **必看檔案**（spawn 時 attach 路徑）：
  - 本檔 `specs/026-tests-audit-report/tasks.md`
  - `specs/026-tests-audit-report/handoff.md`（特別是 §2 Must-Read Risks）
  - `project-health/2026-04-29-tests-audit-report.md`：
    - **S1 (T01-T05)**：L324-360 + L586-592
    - **S2 (T06-T09)**：L77-95 / L113-141 / L168-208 / L294-318 / L545-551 / L594-598 / L641-657
  - 對應的目標檔本身（S1: 4 個 config 檔；S2: `.github/pull_request_template.md` + 必要時 `cspell.json`）

- **必要工具**：Read、Edit、Bash（跑驗證）、Write（engineer 建新檔用，reviewer 不該 Write 任何受審檔）

- **禁區**：
  - Reviewer 不能 Edit/Write 受審檔（S1: config 檔；S2: `.github/`、`cspell.json`、`handoff.md` engineer evidence 區）
  - Engineer 不能改 task scope 外的檔案（例：T01 不能動 playwright config；T07 不能動 cspell.json，加詞屬於 T08 範圍）
  - 任何 subagent 不能 push remote、不能開 PR、不能改 git config
  - **Commit-only task**：S1 只有 T05 engineer 可 commit；S2 只有 T09 engineer 可 commit；其他 task engineer 只改檔不 commit

- **Pre-commit hook 注意**：
  - `.husky/pre-commit` 會跑：lint --max-warnings 0、type-check、depcruise、spellcheck、vitest browser
  - T05（S1）/ T09（S2）engineer 在 `git commit` 前先手動跑一次完整 gate，避免 hook 失敗
  - hook 失敗時：fix issue → re-stage → 新 commit（**不要** `--amend`）

- **回報格式**（spawn 結束時的 result）：
  - Engineer：填 `handoff.md` §3 對應 task 的 engineer 欄；result 訊息列出 evidence 路徑（handoff §3 T0X row）
  - Reviewer：填 `handoff.md` §3 對應 task 的 reviewer 欄；result 訊息明確說「PASS」或「REJECT (AC-XXX failed: ...)」

---

## 後續 commit（不在本檔 scope）

本檔涵蓋 S1（T01-T05，已 commit `97e78d2`）與 S2（T06-T09，pending）。後續：

| Commit | Goal                                     | Spec                 |
| ------ | ---------------------------------------- | -------------------- |
| S1     | align test config defaults               | ✅ 本檔 T01-T05      |
| S2     | PR template + audit checkbox             | ✅ 本檔 T06-T09      |
| S3     | coverage include + baseline              | (TBD — 新 spec 目錄) |
| S4     | pre-commit grep gate (warn-only)         | (TBD)                |
| S5     | firestore rules infra + 5 critical specs | (TBD)                |
| S6     | ESLint mock-boundary + flaky rules       | (TBD)                |
| S7-S10 | (見 audit report §12)                    | (TBD)                |
