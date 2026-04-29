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

# S3 — coverage include + baseline

> S1（T01-T05）已 commit `97e78d2`、S2（T06-T09）已 commit `818e249`。S3 從 T10 開始追加，沿用本檔同一份 Reviewer 認證標準 / Retry & Escalation / Subagent 配對表（下方擴充）/ 通用須知。
> **主 agent 完全不下手**——所有 task（含後續修改、retry、commit）都由 subagent 完成。

## S3 Goal

把 audit P0-4 的 coverage instrumentation 缺口補上：

1. **`vitest.config.mjs:22`** — `include` 加入 `ui` / `components` / `app` 三層（從 5 層擴成 8 層）
2. **`docs/QUALITY_SCORE.md`** — V8 Cov 欄補上三層的真實 baseline 數字（line / statement / branch / function），並加 Score History 一行紀錄變化
3. **凍結 baseline** — 純記錄不設新 threshold；S9 才針對 ui/components/app 設 per-directory threshold（觸發型）

S3 是 audit report §12 的第 3 個 commit，**規模 ~50 行**（vitest.config.mjs ~3 行 diff + QUALITY_SCORE.md ~30-50 行 + handoff/tasks.md sync）。

## S3 References

- Audit report：[`project-health/2026-04-29-tests-audit-report.md`](../../project-health/2026-04-29-tests-audit-report.md)
  - **L170-208** — P0-4 完整描述（現象 + 修補步驟 + 預期數字）
  - **L600-606** — S3 章節（執行序列第 3 個 commit）
  - **L437-443** — `npm run test:coverage` baseline 跑法
  - **L665-668** — S9 觸發型 per-directory threshold（**S3 不做**）
- Audit IDs：P0-4
- Rules：R1（vitest coverage include 涵蓋 src/{ui,components,app}）

## S3 核心設計決策（必讀）

| 決策                                                     | 內容                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Threshold 維持 `lines: 70` 不動（audit 主張）**        | 不在 S3 設 per-directory threshold（屬 S9）；不調降 70 → 60。**唯一例外**：若加 include 後實測 line% 跌破 70，導致 `npm run test:coverage` exit ≠ 0，**engineer 不得自行降 threshold**，必須 escalate（標 `[!]`）回報用戶決議                                                                                          |
| **不加新 exclude**（除非該層已存在類似排除模式）         | 三層的非 logic 檔（`*.module.css.d.ts`、純 re-export、`favicon.ico` 之類非 JS）vitest 本來就不 instrument；不要在 S3 補新 exclude 模式（屬 S9 範圍）。**唯一例外**：若 instrumentation 對某 generated/types-only 檔報 parsing error 中斷 coverage run，engineer 在 §3 evidence 註明後可加最小 exclude（reviewer 必審） |
| **Baseline 數字來源 = `coverage/coverage-summary.json`** | 不從 `text-summary` stdout 讀（精度低、易誤抄）；engineer 必須 `cat coverage/coverage-summary.json \| jq` 抽 lines/statements/branches/functions 四 metric 的 pct（總體 + 分層）；3 位有效位數寫進 QUALITY_SCORE.md                                                                                                    |
| **emulator 走 `firebase emulators:exec` 包裝**           | `npm run test:coverage` 已封裝（package.json L21 / L22）；engineer 直接跑此 npm script 即可，不用手動起 emulator                                                                                                                                                                                                       |
| **Pre-state vs post-state 兩次量測**                     | T10 量 5 層原狀（baseline-current），T13 量 8 層（baseline-new）。兩次都是 `npm run test:coverage`。差值（新增 3 層的 line%）才是 audit 要記錄的真值                                                                                                                                                                   |
| **不動 §3 T01-T09 evidence**                             | S1/S2 紀錄已凍結；S3 任何 subagent 不可改 §3 既有 row、Evidence Detail、§2 既有 risk 表                                                                                                                                                                                                                                |

## S3 Concurrency

```
Wave 1 (2 並行):  T10-eng (capture current baseline)  |  T11-eng (design QUALITY_SCORE.md 更新)
                       ↓ 各自完成 → 觸發對應 reviewer ↓
Wave 2 (≤2 並行): T10-rev | T11-rev
                       ↓ 全部 verified-pass ↓
Wave 3 (序列):    T12-eng → T12-rev   (改 vitest.config.mjs:22)
Wave 4 (序列):    T13-eng → T13-rev   (跑 coverage 取 post-baseline)
Wave 5 (序列):    T14-eng → T14-rev   (依 T11 設計 + T13 數字寫 QUALITY_SCORE.md)
Wave 6 (序列):    T15-eng → T15-rev   (整合驗證 + commit + handoff sync)
```

| 項目                            | 值                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Max concurrent subagent (S3)    | **2**（Wave 1/2，T10/T11 完全獨立可並行；T12-T15 因依賴 coverage artifact + 設計，純序列） |
| Total subagent invocations (S3) | **12**（6 task × 2，no retry case）                                                        |

> 為什麼 T12 之後不平行：T13 要拿 T12 改後的 vitest.config.mjs 跑 coverage；T14 要 T13 的 baseline numbers + T11 的設計才能寫 QUALITY_SCORE.md；T15 要 T14 commit 完整內容。每步輸入都是上步輸出。

## S3 Risks（subagent 必讀，補充進 handoff.md §2 S3 子表）

| Risk                                                          | Why it matters                                                                                                                                                                                               | Action                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:coverage` 需要 Firebase Auth/Firestore emulator | 沒裝 / 沒拉鏡像 → exec 失敗；多人同時跑 emulator 會 port 衝突                                                                                                                                                | T10 / T13 engineer 跑前先 `firebase --version` 與 `lsof -i :8080,9099` 自查；emulator 起不來時不能 fall back 到「跳過 server tests」，必須 escalate                                                                                       |
| 加 include 後 `lines: 70` 可能跌破 → coverage gate 紅         | ui (12 檔 0 直接測試) / components (54 檔 部分測) / app (15 檔 多薄殼) 多數低覆蓋；加進 instrumentation 會壓低總體 line%                                                                                     | T13 engineer 拿到實測 line% 後比對 70：≥ 70 → 繼續 T14；< 70 → 標 T13 `[!]` escalated，**禁止**自行調降 threshold / 縮減 include / 加新 exclude（除 parsing error 例外）；handoff §2 S3 row 寫清楚 escalation reason + 實測數字           |
| Baseline 從 `text-summary` 讀會誤抄                           | text-summary 只給 2 位精度，跟後續 score history 對不起來                                                                                                                                                    | T13 / T14 一律從 `coverage/coverage-summary.json` 用 `jq` 抽，至少 3 位有效位數寫進 QUALITY_SCORE.md；reviewer 必須重抽 jq 結果比對                                                                                                       |
| `coverage-summary.json` 路徑分組需要 prefix match             | json 是 absolute path key，分層數字要靠 `startsWith('src/ui/')` 等 client filter 算（vitest 不直接給 per-dir aggregate）                                                                                     | T11 設計階段給定 jq filter 範本（見 T11 AC）；T13 engineer 直接套用範本；reviewer 用同範本獨立重算                                                                                                                                        |
| QUALITY_SCORE.md 「V8 Cov」欄目前只有 lib/ 一個數字           | 要新增 3 層數字 + （可選）回填 service/repo/runtime/config 的真實數字（首次有 instrumentation）；scope 蔓延風險                                                                                              | T11 設計只新增 ui/components/app 三 row 的 V8 Cov；service/repo/runtime/config/lib/ 的數字保持原值（lib 94.7% 仍有效，本 PR 若實測值有微幅變化也不更新避免 scope 失控）；T14 嚴格依 T11 design                                            |
| Score History 規格：每次更新加一行                            | QUALITY_SCORE.md L62-66 已有「Score History」表，protocol L144-148 規定「每次更新時在 Score History 加一行」                                                                                                 | T14 必須加 1 行 `2026-04-29` row，Changes 欄寫「coverage include 擴至 8 層；ui/components/app 首度有 V8 cov baseline (X.X% / Y.Y% / Z.Z%)」                                                                                               |
| `Last Updated` / `Next Review` 必須同步更新                   | QUALITY_SCORE.md L3-4                                                                                                                                                                                        | T14 把 `Last Updated: 2026-04-24` → `2026-04-29`；`Next Review: 2026-05-08` 推一週 → `2026-05-13`（or +14d 對齊原 cadence）；engineer 在 §3 evidence 註明選擇                                                                             |
| Pre-commit gate 含 `vitest --project=browser`（非 coverage）  | T15 commit 觸發 pre-commit hook 不會跑 `test:coverage`，所以 hook 本身不會被 70 threshold 擋；但 CI（`.github/workflows/ci.yml` 的 `ci` job 跑 `firebase emulators:exec ... npx vitest run --coverage`）會擋 | T15 engineer commit 前手動跑 `npm run test:coverage` 一次確認 exit 0，避免 PR 開出去 CI 紅；若 CI 預期會紅（T13 已 escalated）則 T15 不能 commit，要等用戶決議                                                                            |
| `coverage/` 目錄不可進 git                                    | `.gitignore` 應已含 `coverage/`，但 T13/T14 跑完 coverage 會留下大量 file；commit 時 stage 不能誤加                                                                                                          | T15 engineer `git status` 確認 `coverage/` 為 untracked；明確列檔 `git add` 只加 `vitest.config.mjs` + `docs/QUALITY_SCORE.md` + `specs/026-tests-audit-report/handoff.md` + `specs/026-tests-audit-report/tasks.md`；**禁** `git add -A` |
| jq 不一定預裝                                                 | macOS 預設無 jq；若 engineer/reviewer 環境沒 jq 必失敗                                                                                                                                                       | T10 engineer 跑前 `which jq` 自查；無 jq 時 `brew install jq`（用戶 macOS）；reviewer 同樣須自查                                                                                                                                          |
| `chore(coverage): ...` commit message 不加 Co-Authored-By     | user memory `feedback_no_coauthor`                                                                                                                                                                           | T15 engineer commit 後 `git log -1 --format=%B \| grep -ic "Co-Authored-By"` 必為 0；reviewer 重跑驗                                                                                                                                      |
| 主 agent 不下手                                               | S3 task 任何 Edit/Bash 修改/Write/驗證/commit 都派 subagent；主 agent 違規 = 繞過 user 規則                                                                                                                  | 主 agent 只 spawn subagent + 收 result + retry orchestration；主 agent 可以 commit `docs(spec): ...` 類型的 tasks.md 變動（本次產出），**不可** commit `chore(coverage): ...` 類型的 S3 實作                                              |

## S3 Tasks

### T10 — Spike: capture current 5-layer baseline + emulator sanity check

- **Status**: `[ ]`
- **Files Read**: `vitest.config.mjs`、`package.json`、`docs/QUALITY_SCORE.md`、`coverage/coverage-summary.json`（產出後）
- **Files Written**: 只動 `specs/026-tests-audit-report/handoff.md` §3 T10 row + §2 S3 子表（補風險），**不**動 `vitest.config.mjs` / `docs/`
- **Audit**: P0-4 / Rule R1
- **Dependencies**: 無

**Engineer Action**：

1. **環境自查**：
   - `firebase --version` → 確認 ≥ 12.x
   - `which jq` → 必須有；若無：`brew install jq`
   - `lsof -i :8080,9099 -nP 2>/dev/null` → 確認 emulator port 未被佔用
2. **跑 baseline-current**（vitest.config.mjs 不改）：
   ```bash
   npm run test:coverage 2>&1 | tee /tmp/s3-baseline-current.log
   ```
3. **抽數字**（用 jq 從 `coverage/coverage-summary.json`）：
   ```bash
   # 總體
   jq '.total | {lines:.lines.pct, statements:.statements.pct, branches:.branches.pct, functions:.functions.pct}' coverage/coverage-summary.json
   # 分層（範本，T11 會補完整版）
   jq -r 'to_entries[] | select(.key|test("^.+/src/lib/")) | .value.lines.pct' coverage/coverage-summary.json | awk '{s+=$1; n++} END{if(n)print "lib lines avg:", s/n, "files:", n}'
   ```
4. **記錄結論到 §3 T10 evidence**：總體 4 metric 數字 + 5 層各自 line% 平均（service/repo/runtime/lib/config）+ 是否 exit 0

**Acceptance Criteria**：

- **AC-T10.1**: 環境自查全綠（firebase ≥ 12.x、jq exists、port 未佔用）；evidence 含三命令輸出
- **AC-T10.2**: `npm run test:coverage` exit 0，stdout 含 `Coverage report from v8`；`/tmp/s3-baseline-current.log` 與 `coverage/coverage-summary.json` 都生成
- **AC-T10.3**: 從 `coverage/coverage-summary.json` 用 jq 抽出總體 4 metric 數字（lines/statements/branches/functions pct，各 ≥ 1 位小數）
- **AC-T10.4**: 分層 line% 抽出 5 層數字（service/repo/runtime/lib/config）；evidence 表格化呈現
- **AC-T10.5**: 確認 `git status` 中 `coverage/` 為 untracked（在 `.gitignore`）；`vitest.config.mjs` 0 diff
- **AC-T10.6**: §2 S3 子表至少補 1 條本次新發現的 risk（若無則明確聲明「無新增 risk」）

**Engineer Evidence**（貼到 `handoff.md` §3 T10 row）：

- 環境自查 3 命令輸出
- `/tmp/s3-baseline-current.log` 後 30 行（含 Coverage report 區塊）
- jq 抽數字輸出（總體 + 分層）
- `git status --short` 輸出（驗證未誤動檔案）

**Reviewer 驗證**：

- 獨立重跑環境自查（firebase / jq / lsof）
- 獨立重跑 `npm run test:coverage`（**重要**：reviewer 必須親自跑，不能只看 engineer log；可平行跑或順序跑都行）
- 獨立重跑 jq 抽數字，比對 engineer 數字（pct 容忍 ±0.5%，超過視為 reviewer reject）
- Read `vitest.config.mjs` 確認 0 diff（reviewer Bash 跑 `git diff vitest.config.mjs` 必空）
- 在 §3 T10 reviewer 欄填名稱 + 時間戳 + ≥ 4 行驗證結論 + 自己重跑的數字

---

### T11 — Spike: QUALITY_SCORE.md 更新設計 + jq 分層 filter 範本

- **Status**: `[ ]`
- **Files Read**: `docs/QUALITY_SCORE.md`（全檔）、audit L170-208
- **Files Written**: 只動 `specs/026-tests-audit-report/handoff.md` §3 T11 row（design 全寫 evidence 區），**不**動 `docs/QUALITY_SCORE.md` 本身
- **Audit**: P0-4 / Rule R1
- **Dependencies**: 無（與 T10 平行）

**Engineer Action**：在 `handoff.md` §3 T11 evidence 寫五節：

1. **現況 inventory** — `wc -l docs/QUALITY_SCORE.md`、§ 結構、目前「V8 Cov」欄狀態（lib 94.7%、其他「—」）
2. **目標 diff 草稿**（不實際 Edit，純 markdown 草稿貼 evidence 區）：
   - 「Per-Layer Quality」表中 ui/components/app 三 row 的 V8 Cov 欄填入 `<TBD by T13>`（T14 替換為實際數字）
   - 「Layer-Level Known Gaps」第 2 條（"Coverage instrumentation 僅限 lib/"）改寫為新狀態：「Coverage instrumentation 已擴至 src/{service,repo,runtime,lib,config,ui,components,app}/\*\*（S3, 2026-04-29）；ui/components/app 首度納入 baseline」
   - 「Score History」表加 1 行（具體格式範本）
   - 「Last Updated: 2026-04-24」→ `2026-04-29`、「Next Review: 2026-05-08」→ `2026-05-13`（推 14 天，與原 cadence 對齊）
3. **jq filter 範本**（T13 / T14 / reviewer 共用）：
   ```bash
   # 總體 4 metric
   jq '.total' coverage/coverage-summary.json
   # 分層 line% 平均（用 path prefix match）
   for layer in service repo runtime lib config ui components app; do
     jq -r --arg L "$layer" '
       to_entries
       | map(select(.key | test("/src/" + $L + "/")))
       | (map(.value.lines.pct) | add / length)
     ' coverage/coverage-summary.json | xargs -I {} printf "%-12s %.2f%%\n" "$layer" "{}"
   done
   ```
4. **scope 限制**（防 scope creep）：
   - **不**回寫 service/repo/runtime/config/lib 的 V8 Cov 數字（lib 94.7% 維持原值，即使 T13 實測有微幅變化）— 理由：本 PR 範圍只新增 3 層 baseline，回填屬於 QUALITY_SCORE 獨立更新工作
   - **不**改 Per-Layer Grade（grade 計算靠 test ratio + JSDoc，非 V8 Cov；S9 評估時再 review grade）
   - **不**改 Domain 表
5. **驗收 checklist**（給 T14 用，列出 T14 必須符合的所有規則）

**Acceptance Criteria**：

- **AC-T11.1**: §3 T11 evidence 含五節（現況 inventory / 目標 diff 草稿 / jq filter 範本 / scope 限制 / T14 驗收 checklist），各節有具體內容
- **AC-T11.2**: 目標 diff 草稿中 Score History 一行格式範本對齊既有表格（4 欄：Date / Overall / Layer Avg / Domain Avg / Changes 共 5 欄）
- **AC-T11.3**: jq filter 範本可獨立執行（reviewer 在 coverage-summary.json 存在的環境下可直接 copy-paste 跑出結果）
- **AC-T11.4**: scope 限制明文寫出「不回寫既有 5 層數字」+ 「不改 grade」+ 「不改 domain 表」三條
- **AC-T11.5**: T14 驗收 checklist ≥ 5 條，至少包含「Last Updated 已更新」「Next Review 已更新」「Score History 已加 1 行」「ui/components/app 三 row V8 Cov 欄已填數字」「scope 限制全部遵守（無回寫、無 grade 改動）」

**Engineer Evidence**：上述五節完整內容

**Reviewer 驗證**：

- Read `docs/QUALITY_SCORE.md` 全檔，比對 engineer 描述「現況 inventory」屬實
- 若 T10 已完成（coverage-summary.json 存在）：reviewer copy-paste jq filter 範本獨立跑一次確認語法正確
- 若 T10 未完成：reviewer 用 `echo '{"total":{"lines":{"pct":75.5}}}' | jq '.total'` 至少驗證 jq 命令語法正確
- 確認 scope 限制 3 條都列出
- 在 §3 T11 reviewer 欄填名稱 + 時間戳 + ≥ 4 行驗證結論
- Reviewer **不能** Edit `docs/QUALITY_SCORE.md`（spike 階段不寫稿）

---

### T12 — Implement: vitest.config.mjs:22 加 ui/components/app

- **Status**: `[ ]`
- **Files Written**: `vitest.config.mjs`
- **Files Read**: T10 / T11 evidence
- **Audit**: P0-4 / Rule R1
- **Dependencies**: T10 `[x]` + T11 `[x]`

**Engineer Action**：

1. Edit `vitest.config.mjs:22`：
   ```diff
   -      include: ['src/{service,repo,runtime,lib,config}/**'],
   +      include: ['src/{service,repo,runtime,lib,config,ui,components,app}/**'],
   ```
2. **不**動 L23-31 exclude block（除 T13 發現 parsing error 例外）
3. **不**動 L36 `lines: 70` threshold
4. **不**動 L39-67 projects block
5. 跑語法 sanity：
   ```bash
   node -e "import('./vitest.config.mjs').then(m=>console.log('OK',Object.keys(m.default.test.coverage)))"
   ```

**Acceptance Criteria**：

- **AC-T12.1**: `git diff vitest.config.mjs` 只有 1 行 + / 1 行 -，且只在 L22；其他行 0 變動
  ```bash
  git diff --stat vitest.config.mjs  # 期望：1 file changed, 1 insertion(+), 1 deletion(-)
  ```
- **AC-T12.2**: include 字串完整為 `'src/{service,repo,runtime,lib,config,ui,components,app}/**'`（順序 = 原 5 層在前 + 新 3 層在後，alphabetical 也可但 reviewer 必驗 8 層全在）
  ```bash
  grep -n "include:" vitest.config.mjs | head -3
  ```
- **AC-T12.3**: 8 層全部存在於 include
  ```bash
  for L in service repo runtime lib config ui components app; do
    grep -c "$L" vitest.config.mjs > /dev/null && echo "$L OK" || echo "$L MISSING"
  done
  ```
- **AC-T12.4**: dynamic import 不爆
  ```bash
  node -e "import('./vitest.config.mjs').then(m=>console.log('OK', m.default.test.coverage.include))"
  ```
  輸出含 `['src/{service,repo,runtime,lib,config,ui,components,app}/**']`
- **AC-T12.5**: 跑 `npm test 2>&1 | tail -10`（不帶 coverage，只驗 vitest 仍能載 config 跑 browser tests）→ exit 0
- **AC-T12.6**: 不 commit；`git status --short` 顯示 `M vitest.config.mjs` + 可能的 handoff.md modified
- **AC-T12.7**: pre-commit gate **不在此 task 跑**（hook 只在 commit 時觸發；T12 不 commit）

**Engineer Evidence**：

- 完整 `git diff vitest.config.mjs`
- AC-T12.2 grep 輸出
- AC-T12.3 8 層自查迴圈輸出
- AC-T12.4 dynamic import 輸出
- AC-T12.5 npm test tail 輸出
- AC-T12.6 git status

**Reviewer 驗證**：

- 重跑 AC-T12.1 / T12.3 / T12.4 / T12.5 全部命令
- Read `vitest.config.mjs` 確認 L22 是 8 層 include、L23-31 exclude block 0 改動、L36 `lines: 70` 0 改動
- 在 §3 T12 reviewer 欄簽名 + ≥ 4 行驗證結論

---

### T13 — Capture post-baseline (8 層 coverage)

- **Status**: `[ ]`
- **Files Written**: 0（純跑 + 記錄 evidence；coverage/ 為 gitignored artifact）
- **Files Read**: `coverage/coverage-summary.json`（T13 跑後生成）
- **Audit**: P0-4 / Rule R1
- **Dependencies**: T12 `[x]`

**Engineer Action**：

1. **跑 coverage with new include**：
   ```bash
   npm run test:coverage 2>&1 | tee /tmp/s3-baseline-new.log
   ```
2. **抽數字**（套 T11 jq filter 範本）：
   - 總體 4 metric
   - 8 層各自 line% 平均（service/repo/runtime/lib/config/ui/components/app）
3. **比對 T10 baseline-current**：
   - 總體 line% delta（預期下降，因為新增 3 層多為低覆蓋）
   - 5 層原有數字 delta（理論上 ±0%，因為 instrumentation 範圍原樣；若有差異需註明）
   - 3 層新數字（首次有 baseline）
4. **threshold 檢查（CRITICAL）**：
   - 看 `npm run test:coverage` exit code
   - 若 exit 0 → 70 threshold 通過 → 繼續記錄
   - 若 exit ≠ 0 因 `Coverage threshold for lines (70%) not met` → **不可** 自行降 threshold；T13 標 `[!]` escalated；handoff §0 / §3 T13 row 寫清楚實測 line% + escalation reason；停止 T14/T15

**Acceptance Criteria**：

- **AC-T13.1**: `npm run test:coverage` 完整跑完（不論 exit code）；`/tmp/s3-baseline-new.log` 與 `coverage/coverage-summary.json` 都生成
- **AC-T13.2**: 抽出總體 4 metric pct 數字（≥ 1 位小數）
- **AC-T13.3**: 抽出 8 層 line% 平均數字（首次包含 ui/components/app）
- **AC-T13.4**: evidence 含 T10 vs T13 的 delta 表（總體 + 5 層原數字 + 3 層新數字）
- **AC-T13.5**: threshold pass/fail 明確標註
  - PASS（exit 0）→ 在 evidence 寫 `THRESHOLD PASS: lines X.X% ≥ 70%`，task 標 `eng-done`
  - FAIL（exit ≠ 0 且因 threshold）→ 在 evidence 寫 `THRESHOLD FAIL: lines X.X% < 70%, escalating per S3 risk row`；task 標 `[!]` escalated
  - FAIL（其他原因，例：emulator 起不來、parsing error）→ engineer 嘗試診斷；若是 parsing error 且為某 generated/types-only 檔，可加最小 exclude 後重跑（同 task 內），evidence 必須註明加了什麼 exclude、為什麼；若診斷失敗 → escalated
- **AC-T13.6**: 若 T13 加了 exclude → `git diff vitest.config.mjs` 顯示 exclude 補丁（reviewer 必須獨立判斷該 exclude 是否合理）

**Engineer Evidence**：

- `/tmp/s3-baseline-new.log` 後 50 行（含 Coverage report 表格 + threshold pass/fail 訊息）
- jq 抽數字輸出（總體 + 8 層）
- T10 vs T13 delta 對比表（markdown 格式）
- exit code（明確寫出 `echo $?`）
- 若加 exclude → `git diff vitest.config.mjs` + 加 exclude 的理由（≥ 3 句解釋）

**Reviewer 驗證**：

- 獨立重跑 `npm run test:coverage`（時間長但**必跑**）
- 獨立重跑 jq filter，比對 engineer 數字（pct 容忍 ±0.5%）
- 比對 T10 evidence 中 5 層原數字 vs T13 中 5 層原數字：差距應 < ±2%（若超過代表 instrumentation 行為異動，必審）
- 確認 exit code 與 engineer evidence 一致
- 若 engineer 標 escalated：reviewer **不能** 強迫 PASS；接受 escalation 並在 §3 reviewer 欄背書 escalation reason（手動 retry engineer 不會解決根本問題）
- 若 engineer 加 exclude：reviewer 必須評估該 exclude 是否合理（generated 檔 / types-only 檔 OK；含 logic 的檔不 OK，必 reject）
- 在 §3 T13 reviewer 欄填名稱 + 時間戳 + ≥ 5 行驗證結論

---

### T14 — Update docs/QUALITY_SCORE.md per T11 design + T13 數字

- **Status**: `[ ]`
- **Files Written**: `docs/QUALITY_SCORE.md`
- **Files Read**: T11 evidence（design + checklist）、T13 evidence（baseline 數字）
- **Audit**: P0-4 / Rule R1
- **Dependencies**: T13 `[x]`（threshold PASS；若 T13 escalated → T14 不執行）

**Engineer Action**：嚴格依 T11 design + T13 數字 Edit `docs/QUALITY_SCORE.md`：

1. **L3 `Last Updated`**: `2026-04-24` → `2026-04-29`
2. **L4 `Next Review`**: `2026-05-08` → `2026-05-13`（or per T11 設計）
3. **Per-Layer Quality 表（L14-23）**：
   - ui/ row 的 V8 Cov 欄：`—` → `<T13 ui line% 平均>%`
   - components/ row 的 V8 Cov 欄：`—` → `<T13 components line% 平均>%`
   - app/ row 的 V8 Cov 欄：新增（如 app 不在當前表中 → 用 T11 design 決定 row 位置）or 套用 T11 design 的處理方式
   - **不**改 service/repo/runtime/lib/config 的 V8 Cov 欄（lib 94.7% 維持）
   - **不**改任何 row 的 Grade
4. **Layer-Level Known Gaps 第 2 條**（L34）：依 T11 design 改寫
5. **Score History 表（L62-66）**：加 1 行
   ```markdown
   | 2026-04-29 | <維持原 Overall> | <維持原 Layer Avg> | <維持原 Domain Avg> | Coverage include 擴至 8 層 (S3); ui/components/app 首度有 V8 cov baseline (X.X% / Y.Y% / Z.Z%) |
   ```
6. **不**改 Per-Domain Quality 表
7. **不**改 Grading Rubric / Data Sources / Update Protocol

**Acceptance Criteria**：

- **AC-T14.1**: T11 驗收 checklist 全綠（≥ 5 條，逐條 evidence 對應）
- **AC-T14.2**: `git diff docs/QUALITY_SCORE.md` 行數 ≤ 30（design 規模 ~10-30 行；超過 30 行視為 scope creep，reviewer 必審）
- **AC-T14.3**: spellcheck pass
  ```bash
  npm run spellcheck 2>&1 | tail -5
  ```
  含 `Issues found: 0`；若新詞 fail → engineer 加進 `cspell.json`（同樣禁 inline `cspell:disable`）並更新 evidence
- **AC-T14.4**: lint pass（markdown 不在 ESLint 規則內，主要驗證沒有副作用）
  ```bash
  npm run lint -- --max-warnings 0 2>&1 | tail -5
  ```
  exit 0
- **AC-T14.5**: 沒有副作用改動
  ```bash
  git status --short
  ```
  顯示僅 `M docs/QUALITY_SCORE.md` + handoff.md 修改 + 可能 cspell.json（若 T14 加詞）
- **AC-T14.6**: 數字一致性 — Score History 那行寫的 X.X% / Y.Y% / Z.Z% 與 Per-Layer Quality 表中 ui/components/app 三 row 的 V8 Cov 數字完全一致
- **AC-T14.7**: 沒回寫禁用區（service/repo/runtime/lib/config V8 Cov 維持原樣；Per-Domain 表 0 改動；Grade 0 改動）
  ```bash
  git diff docs/QUALITY_SCORE.md | grep -E "^[+-].*\b(service|repo|runtime|lib|config)\b.*\bCov\b" | wc -l
  ```
  期望 0；非 0 → reviewer reject

**Engineer Evidence**：

- 完整 `git diff docs/QUALITY_SCORE.md`
- AC-T14.3 spellcheck 輸出
- AC-T14.4 lint 輸出
- AC-T14.5 git status
- AC-T14.6 數字一致性自查（並列 Per-Layer 表的 3 個數字 + Score History 一行的 3 個數字，確認逐字符相同）
- AC-T14.7 grep 結果
- T11 checklist 逐條 ✅/❌ 自評

**Reviewer 驗證**：

- Read `docs/QUALITY_SCORE.md` 全檔
- 重跑 AC-T14.2-T14.7 全部命令
- 對照 T13 evidence 中的 baseline 數字 vs T14 寫進 QUALITY_SCORE.md 的數字（必須完全相同）
- 對照 T11 design 中的 scope 限制 3 條（不回寫、不改 grade、不改 domain 表）— 用 git diff 逐條確認
- 若 engineer 加 cspell 詞：reviewer 必須獨立判斷詞是否為合理 domain term（typo 必 reject）
- 在 §3 T14 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論

---

### T15 — Integration verification + commit (S3)

- **Status**: `[ ]`
- **Files Written**:
  - `specs/026-tests-audit-report/handoff.md` §0 / §1 / §3（T15 self-evidence）/ §5 完整更新
  - `specs/026-tests-audit-report/tasks.md`（T10-T15 status `[ ]` → `[x]`）
- **Files committed**: `vitest.config.mjs` + `docs/QUALITY_SCORE.md` + `specs/026-tests-audit-report/handoff.md` + `specs/026-tests-audit-report/tasks.md`（+ `cspell.json` 若 T14 加詞）
- **Dependencies**: T10-T14 全部 `[x]`

**Engineer Action**：

1. 確認 §3 T10-T14 evidence + reviewer signature 完整
2. 一次性重跑全 acceptance（見 AC-T15.2）
3. 更新 `handoff.md`：
   - §0：T10-T15 全填 `done`、Last commit (S3) 留待 commit 後填
   - §1：指向 S4（`pre-commit grep gate (warn-only)`，audit L607-612）
   - §2：S3 子表所有 risk row 留存（不刪），補 T13/T14 實際遭遇紀錄（若有）
   - §3 T15 row engineer evidence 填寫
   - §5：填 node / vitest / firebase-tools / jq 版本
4. 更新 `tasks.md`：T10-T15 Status `[ ]` → `[x]`
5. **Commit 前 mandatory**：手動跑完整 pre-commit gate + coverage gate：
   ```bash
   npm run lint -- --max-warnings 0 \
     && npm run type-check \
     && npm run depcruise \
     && npm run spellcheck \
     && npx vitest run --project=browser \
     && npm run test:coverage
   ```
   全綠才繼續；任一紅 → fix → 重跑（不要硬 commit 等 hook 擋）
6. **明確列檔** stage（**禁** `git add -A`）：
   ```bash
   git add vitest.config.mjs \
           docs/QUALITY_SCORE.md \
           specs/026-tests-audit-report/handoff.md \
           specs/026-tests-audit-report/tasks.md
   # 若 T14 加詞：再 git add cspell.json
   ```
7. **`git status` 確認 `coverage/` untracked**（critical — 不能誤 stage）
8. `git commit`（不 push）

**Acceptance Criteria**：

- **AC-T15.1**: §3 T10-T14 五 row 都 `rev-pass` + 雙簽名；`tasks.md` T10-T15 全 `[x]`
- **AC-T15.2**: 一次性重跑：
  ```bash
  # vitest.config 8 層 include 仍在
  grep -c "ui,components,app" vitest.config.mjs                        # ≥ 1
  # QUALITY_SCORE.md 三層 V8 Cov 已填
  grep -E "^\| ui/" docs/QUALITY_SCORE.md
  grep -E "^\| components/" docs/QUALITY_SCORE.md
  grep -E "^\| app/" docs/QUALITY_SCORE.md
  # Last Updated 已更新
  grep "Last Updated: 2026-04-29" docs/QUALITY_SCORE.md
  # Score History 加了 1 行
  grep "2026-04-29.*S3" docs/QUALITY_SCORE.md
  # 所有 quality gate
  npm run lint -- --max-warnings 0 2>&1 | tail -5
  npm run type-check 2>&1 | tail -5
  npm run depcruise 2>&1 | tail -3
  npm run spellcheck 2>&1 | tail -5
  npx vitest run --project=browser 2>&1 | tail -5
  npm run test:coverage 2>&1 | tail -10
  ```
  全部 exit 0 + grep 全有 hit
- **AC-T15.3**: commit message 格式：

  ```
  chore(coverage): include 3 layers + baseline (P0-4)

  - vitest.config.mjs:22: coverage include 從 5 層擴至 8 層 (+ ui,components,app)
  - docs/QUALITY_SCORE.md: 三層首度有 V8 cov baseline (ui X.X%, components Y.Y%, app Z.Z%)
    + Score History 加 1 行
  - threshold (lines: 70) 維持不動；per-directory threshold 屬 S9 觸發型 (audit L665-668)
  - <若 T14 改 cspell：cspell.json: add N domain terms (<list>)>

  Refs: project-health/2026-04-29-tests-audit-report.md L170-208, L600-606
  ```

  - Conventional commits `chore(coverage):`
  - **不加 `Co-Authored-By`**

- **AC-T15.4**:
  - branch = `026-tests-audit-report`
  - **不 push** 到遠端
  - pre-commit hook 全綠
  - `coverage/` 目錄未被 stage（git status confirm untracked）
- **AC-T15.5**: `git show <hash> --stat` 顯示 **4-5 個檔**：
  - `vitest.config.mjs`
  - `docs/QUALITY_SCORE.md`
  - `specs/026-tests-audit-report/handoff.md`
  - `specs/026-tests-audit-report/tasks.md`
  - 若 T14 加詞：`cspell.json`
  - **不**含 `coverage/**`
- **AC-T15.6**: `git log -1 --format=%B | grep -ic "Co-Authored-By"` = 0
- **AC-T15.7**: `git show <hash> --stat | grep -c "^ coverage/"` = 0（coverage 目錄絕對沒進 commit）

**Engineer Evidence**：

- AC-T15.2 全部命令輸出
- `git log -1 --format=fuller`
- `git show <hash> --stat`
- AC-T15.6 / T15.7 grep 結果
- 自評 T11 / T13 / T14 驗收 checklist 逐條對應 commit 內容

**Reviewer 驗證**：

- 重跑 AC-T15.2 全部命令
- `git show <hash> --stat` 確認檔案數量 + 檔名 + 無 coverage/
- `git show <hash>` 看完整 commit message + diff
- AC-T15.6 / T15.7 grep = 0
- `git log origin/026-tests-audit-report..HEAD 2>&1` 應錯誤或顯示 ≥ 1 commit ahead（**未** push）
- Read `handoff.md` 確認 §0 / §1 / §2 S3 子表 / §3 T10-T15 / §5 完整
- Read `tasks.md` 確認 T10-T15 全 `[x]`
- 在 §3 T15 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論

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
| T10  | S3    | general-purpose        | general-purpose        | S3-1 | T11              |
| T11  | S3    | general-purpose        | general-purpose        | S3-1 | T10              |
| T12  | S3    | general-purpose        | general-purpose        | S3-2 | (none, 序列)     |
| T13  | S3    | general-purpose        | general-purpose        | S3-3 | (none, 序列)     |
| T14  | S3    | general-purpose        | general-purpose        | S3-4 | (none, 序列)     |
| T15  | S3    | general-purpose        | general-purpose        | S3-5 | (none, 序列)     |

## Subagent 通用須知

- **必看檔案**（spawn 時 attach 路徑）：
  - 本檔 `specs/026-tests-audit-report/tasks.md`
  - `specs/026-tests-audit-report/handoff.md`（特別是 §2 Must-Read Risks，含 S1 / S2 / S3 子表）
  - `project-health/2026-04-29-tests-audit-report.md`：
    - **S1 (T01-T05)**：L324-360 + L586-592
    - **S2 (T06-T09)**：L77-95 / L113-141 / L168-208 / L294-318 / L545-551 / L594-598 / L641-657
    - **S3 (T10-T15)**：L170-208 + L437-443 + L600-606 + L665-668
  - 對應的目標檔本身：
    - S1: 4 個 config 檔
    - S2: `.github/pull_request_template.md` + 必要時 `cspell.json`
    - S3: `vitest.config.mjs` + `docs/QUALITY_SCORE.md` + 必要時 `cspell.json`

- **必要工具**：Read、Edit、Bash（跑驗證）、Write（engineer 建新檔用，reviewer 不該 Write 任何受審檔）

- **禁區**：
  - Reviewer 不能 Edit/Write 受審檔（S1: config 檔；S2: `.github/`、`cspell.json`；S3: `vitest.config.mjs`、`docs/QUALITY_SCORE.md`、`cspell.json`、`handoff.md` engineer evidence 區）
  - Engineer 不能改 task scope 外的檔案（例：T01 不能動 playwright config；T07 不能動 cspell.json，加詞屬於 T08 範圍；T12 不能動 threshold；T14 不能改 service/repo/runtime/lib/config 既有 V8 Cov 數字）
  - 任何 subagent 不能 push remote、不能開 PR、不能改 git config
  - **Commit-only task**：S1 只有 T05 engineer 可 commit；S2 只有 T09 engineer 可 commit；S3 只有 T15 engineer 可 commit；其他 task engineer 只改檔不 commit
  - **Threshold 紀律（S3 專屬）**：T13 發現 70 threshold 跌破時**禁止**自行降 threshold，必須 escalate（標 `[!]`）；T12-T14 任何 task **禁止**設 per-directory threshold（屬 S9 觸發型）
  - **Coverage artifact 紀律（S3 專屬）**：`coverage/` 為 gitignored，T15 commit 必須 `git status` 確認該目錄為 untracked，**禁** `git add -A` / `git add coverage`

- **Pre-commit hook 注意**：
  - `.husky/pre-commit` 會跑：lint --max-warnings 0、type-check、depcruise、spellcheck、vitest browser（**不**跑 coverage）
  - T05（S1）/ T09（S2）/ T15（S3）engineer 在 `git commit` 前先手動跑一次完整 gate，避免 hook 失敗
  - **S3 額外**：T15 commit 前還要手動跑 `npm run test:coverage`（hook 不跑，但 CI 會跑；先確認本地通過）
  - hook 失敗時：fix issue → re-stage → 新 commit（**不要** `--amend`）

- **回報格式**（spawn 結束時的 result）：
  - Engineer：填 `handoff.md` §3 對應 task 的 engineer 欄；result 訊息列出 evidence 路徑（handoff §3 T0X row）
  - Reviewer：填 `handoff.md` §3 對應 task 的 reviewer 欄；result 訊息明確說「PASS」或「REJECT (AC-XXX failed: ...)」

---

## 後續 commit（不在本檔 scope）

本檔涵蓋 S1（T01-T05，已 commit `97e78d2`）、S2（T06-T09，已 commit `818e249`）、S3（T10-T15，pending）。後續：

| Commit | Goal                                     | Spec            |
| ------ | ---------------------------------------- | --------------- |
| S1     | align test config defaults               | ✅ 本檔 T01-T05 |
| S2     | PR template + audit checkbox             | ✅ 本檔 T06-T09 |
| S3     | coverage include + baseline              | ✅ 本檔 T10-T15 |
| S4     | pre-commit grep gate (warn-only)         | (TBD)           |
| S5     | firestore rules infra + 5 critical specs | (TBD)           |
| S6     | ESLint mock-boundary + flaky rules       | (TBD)           |
| S7-S10 | (見 audit report §12)                    | (TBD)           |
