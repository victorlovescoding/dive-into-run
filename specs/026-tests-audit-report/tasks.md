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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

- **Status**: `[x]`
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

# S4 — pre-commit grep gate (warn-only)

> S1（T01-T05）已 commit `97e78d2`、S2（T06-T09）已 commit `818e249`、S3（T10-T15）已 commit `5f09820`。S4 從 T16 開始追加，沿用本檔同一份 Reviewer 認證標準 / Retry & Escalation / Subagent 配對表（下方擴充）/ 通用須知。
> **主 agent 完全不下手**——所有 task（含後續修改、retry、commit）都由 subagent 完成。

## S4 Goal

把 audit P0-1 / P1-4 / P1-5 的「防新增」訊號補上，但**不擋 commit**：

1. **`scripts/audit-mock-boundary.sh`**（新檔）— grep `tests/integration/**` 中違反 mock-boundary 的 `vi.mock('@/{repo,service,runtime}/...')`，列出 file:line + 計數
2. **`scripts/audit-flaky-patterns.sh`**（新檔）— grep `tests/**/*.test.*` 中 `toHaveBeenCalledTimes` 與 `setTimeout+Promise` 兩 anti-pattern
3. **`.husky/pre-commit`** — 末尾 append 兩個 script（`exit 0` 不擋 commit、只警示）
4. **凍結 baseline 起始數字**（commit message 紀錄）— 為 S6 ESLint `ignores` baseline 與 S8 觸發型升級提供起點

S4 是 audit report §12 的第 4 個 commit，**規模 ~100 行**（兩 script ~30-50 行各 + husky 4 行 diff + handoff/tasks.md sync）。

## S4 References

- Audit report：[`project-health/2026-04-29-tests-audit-report.md`](../../project-health/2026-04-29-tests-audit-report.md)
  - **L77-111** — P0-1 完整描述（233 處 mock 樣本 + 修補步驟，第 1 條短期防新增即 S4）
  - **L293-318** — P1-4 / P1-5（`toHaveBeenCalledTimes` 109 處 + setTimeout+Promise）
  - **L607-612** — S4 章節（執行序列第 4 個 commit）
  - **L538-544** — Husky 強制機制 R8 規則
  - **L626-633** — S6 baseline 生成命令範本（**S4 與 S6 grep pattern 必須一致**）
  - **L658-664** — S8 觸發型升級規格（warn → error / exit 0 → exit 1，不在本 S4 scope）
- Audit IDs：P0-1 / P1-4 / P1-5
- Rules：R8（pre-commit grep gate，warn-only）

## S4 核心設計決策（必讀）

| 決策                                                  | 內容                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Warn-only：兩 script 必須 `exit 0`**                | 即使有違規也 exit 0，pre-commit chain 不被打斷。**例外**：script 自己有 syntax/IO error（grep 命令 typo、檔案讀不到）時容許 exit ≠ 0；違規 finding 一律 0。S8 觸發型升級時改 exit 1（**不在本 S4 scope**）                                                                                |
| **不擋既有 baseline**                                 | 跑 audit 應列出 ~233 mock + ~109 flaky 違規（這些在 P0-1 / P1-4 中清算過），但不能讓任何 PR 因此擋下；測試方式：T21 在 dummy stage 上跑 hook 必須 exit 0                                                                                                                                  |
| **Grep pattern 與 S6 完全對齊**                       | audit L626-633 已給出 S6 baseline 生成命令；S4 script 必須用**相同** grep pattern（不可微調），這樣 S4 列出的數字 = S6 baseline list 數字。Mock-boundary：`vi\.mock\(['"]@/(repo\|service\|runtime)/`；Flaky：`toHaveBeenCalledTimes` + `new Promise.*setTimeout` / `setTimeout.*Promise` |
| **全 codebase grep（不做 staged-only）**              | S4 是 baseline 訊號版（warn-only），用全 codebase grep 簡單、與 S6 baseline 對得上；staged-only 邏輯留給 S8 升級時設計（exit 1 才需要避免擋既有 baseline 違規）                                                                                                                           |
| **Husky 順序：lint/type/spell/vitest 之後 append**    | 兩 audit script 在現有五項之後 append，不打斷主品質防線；理由：（a）現有五項是 `--max-warnings 0` / exit ≠ 0 fail-fast 風格，append 在最後不影響它們；（b）若未來改 staged-only，append 在最後拿到的是現有 hook 跑完後的 staged 狀態，不會誤抓 hook 中 auto-fix 的暫態                    |
| **Output 格式**：人讀友善 + grep-able                 | stdout 結構固定：`AUDIT <CATEGORY>: <N> findings`（首行）+ `<file>:<line>:<匹配行 trim>` 列表（每筆一行）+ `(warn-only; exit 0)` 結尾。N 可被 `head -1 \| awk '{print $3}'` 抽出，方便 commit message 自動填數字                                                                          |
| **Script 必須 portable（macOS bash 3.2 + BSD grep）** | 不用 `mapfile` / `declare -A` / `read -ra` / `[[ =~ ]]`；不用 `grep -P` PCRE；用 `grep -rEn` (ERE) 或 `grep -rn` (BRE)；script header `#!/usr/bin/env bash`；`set -e` 不開（保 exit 0 紀律）                                                                                              |
| **Chmod +x 紀律**                                     | 兩 script 必須 `chmod +x`，commit 後 `git ls-files --stage scripts/audit-*.sh` mode 必為 `100755`（git index 看權限）                                                                                                                                                                     |
| **不 touch 現有 husky 五行**                          | T20 對 `.husky/pre-commit` **只 append 不刪改**：`git diff .husky/pre-commit` 必須 `^-[^-]` count = 0；reviewer 重驗                                                                                                                                                                      |
| **不動 §3 T01-T15 evidence**                          | S1/S2/S3 紀錄已凍結；S4 任何 subagent 不可改 §3 既有 row、Evidence Detail、§2 既有 risk 表                                                                                                                                                                                                |
| **Baseline 數字寫進 commit message**                  | T22 commit message 必含 `Baseline (S4 grep): mock-boundary: <N>, flaky-pattern: <M>`，N/M 從 T21 smoke test 取得；S6 將以此作為 ESLint baseline list 起點。**T22 engineer 直接 copy T21 evidence**，不口算                                                                                |
| **主 agent 不下手**                                   | S4 任何 Edit/Write/Bash 修改/驗證/commit 都派 subagent；主 agent 只 spawn + retry orchestration；主 agent 可 commit `docs(spec): ...` 類型的 tasks.md 變動（本次產出），**不可** commit `chore(precommit): ...` 類型的 S4 實作                                                            |

## S4 Concurrency

```
Wave 1 (2 並行):  T16-eng (mock-boundary spike)  |  T17-eng (flaky + husky 整合 spike)
                       ↓ 各自完成 → reviewer ↓
Wave 2 (≤2 並行): T16-rev | T17-rev
                       ↓ 全部 verified-pass ↓
Wave 3 (2 並行):  T18-eng (寫 audit-mock-boundary.sh)  |  T19-eng (寫 audit-flaky-patterns.sh)
                       ↓ 各自完成 → reviewer ↓
Wave 4 (≤2 並行): T18-rev | T19-rev
                       ↓ 全部 verified-pass ↓
Wave 5 (序列):    T20-eng → T20-rev   (改 .husky/pre-commit append 兩行)
Wave 6 (序列):    T21-eng → T21-rev   (整合 smoke test + 取 baseline N/M)
Wave 7 (序列):    T22-eng → T22-rev   (commit + handoff sync)
```

| 項目                            | 值                                              |
| ------------------------------- | ----------------------------------------------- |
| Max concurrent subagent (S4)    | **2**（Wave 1/2/3/4 各 2 並行；T20-T22 純序列） |
| Total subagent invocations (S4) | **14**（7 task × 2，no retry case）             |

> 為什麼 T18/T19 可平行：兩 script 完全獨立檔（無 import/source 關係），grep pattern 在 spike 階段已凍結；engineer 各自寫各自的 script，0 衝突。為什麼 T20 之後不平行：T20 改 husky 後須驗 chain 仍綠；T21 要拿 husky 改完後跑 smoke + 抽 baseline；T22 要 T21 數字寫 commit message — 每步輸入都是上步輸出。

## S4 Risks（subagent 必讀，補充進 handoff.md §2 S4 子表）

| Risk                                                       | Why it matters                                                                                                        | Action                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Husky chain 被 `set -e` / 子 shell 干擾                    | 若 `.husky/pre-commit` 開頭有 `set -e` 或某行 fail 後 short-circuit，append 的 audit script 不會跑或被當失敗          | T17 spike 必須先 `cat .husky/pre-commit` 確認沒 set -e；append 行必加 `\|\| true` 雙保險（即使 script 自己 exit 1 也不擋 chain）；evidence 附 cat 結果                                                                             |
| macOS bash 3.2 不支援 bash 4 syntax                        | engineer 用 `mapfile` / `declare -A` / `[[ =~ ]]` → reviewer macOS 機跑會 syntax error                                | T18/T19 engineer 寫完用 `bash --version` 紀錄環境；所有迴圈用 `while read` / `for ... in`；不用關聯陣列；`shellcheck` 若安裝先跑                                                                                                   |
| `grep -P` PCRE 在 macOS 預設 BSD grep 不支援               | engineer 用 `-P` → reviewer 跑會 unrecognized option                                                                  | T18/T19 一律用 `grep -rEn` (ERE) 或 `grep -rn` (BRE)；S6 baseline 命令 (audit L629-630) 用 ERE — pattern 必須能在 BSD grep 跑；AC-T18.10/T19.10 自查                                                                               |
| audit pattern 與 S6 baseline 命令對不上                    | S4 列 220 處、S6 baseline 列 233 處 → 不一致，下游 ESLint baseline 起點數字錯                                         | T16/T17 spike 必須**逐字**比對 audit L629-630 的 grep 命令；T21 smoke 跑 S4 script 後再獨立跑 audit L629-630 命令，N/M 差距須 ≤ ±2 / ±5；任何差距須在 evidence 解釋（grep -rln file count vs grep -rEn line count 不同屬合理差距） |
| Pattern false positive：`vi.mock('@/config/...')` 應排除   | audit L94-95 註明「`@/config/client/firebase-client` 是邊界外可保留」；script 若不排除 config，會把合理 mock 算成違規 | T16 spike 確認 mock-boundary script 只抓 `@/(repo\|service\|runtime)/`（明確 3 層），**不**抓 `@/config/` / `@/lib/` / `@/types/`；AC-T18.9 grep 自查；reviewer 必驗                                                               |
| Pattern false negative：括號內換行 / 雙引號變體            | `vi.mock(\n  '@/repo/foo'\n, ...)` 多行寫法 grep 抓不到；單雙引號要同時抓                                             | T16 spike 接受此局限（grep 是行式工具，多行 import 抓不到屬已知缺口；S6 ESLint AST 規則會補完）；evidence 寫進 §2 S4 risk row                                                                                                      |
| Pre-commit hook 失敗 → S4 自身 commit 被擋                 | T22 engineer 跑 hook commit 時，若 audit script 因 syntax error exit ≠ 0，整 chain 失敗 → S4 commit 被擋              | T18/T19 engineer 寫完先 `bash scripts/audit-X.sh; echo "exit: $?"` 必為 0；T20 改 husky 後 T21 用 dummy stage 跑 `bash .husky/pre-commit` 驗整 chain exit 0；hook 失敗時 fix issue → re-stage → 新 commit（**不要** `--amend`）    |
| `chmod +x` 沒設 → script 不可執行                          | git `core.fileMode` 預設 true，新增 .sh 檔須 chmod +x 才會被 git 紀錄為 100755                                        | T18/T19 engineer 寫完跑 `chmod +x scripts/audit-*.sh`；T22 commit 後 `git ls-files --stage` 必為 100755（AC-T22.7）                                                                                                                |
| Husky chain 順序變動造成既有測試 race                      | T20 engineer 誤把 audit 行插在 vitest 之前 → audit 大量 grep 用了 ≥ 1s 拖慢；或順序改變 hook 行為                     | T17 spike 凍結「audit 兩行追加在 vitest 之後」；T20 嚴格 append（diff 只有 + 行）；AC-T20.1 / T20.4 自查；reviewer `git diff .husky/pre-commit` 確認                                                                               |
| S4 commit message Baseline 數字錯抄                        | T21 smoke 跑出 N=233、M=109，T22 抄成 N=234 等 → S6 baseline 起點錯                                                   | T22 engineer 從 T21 evidence 直接 copy（**禁口算**）；reviewer 重跑 audit script 驗證 commit message 中 N/M 數字 ±0（AC-T22.8）                                                                                                    |
| Smoke test temp 檔殘留                                     | T21 故意建 temp test 檔驗 audit 抓得到，若忘了刪 → commit 會誤帶；最壞情況：temp 檔 vitest 跑時 fail 整個 hook        | T21 必跑 `rm tests/integration/_s4-smoke.test.jsx` + `git status --short \| grep "_s4-smoke"` 必 0 hit；T22 commit 前 `git status` 再驗一次（AC-T22.5 file count = 5）                                                             |
| `chore(precommit): ...` commit message 不加 Co-Authored-By | user memory `feedback_no_coauthor`                                                                                    | T22 engineer commit 後 `git log -1 --format=%B \| grep -ic "Co-Authored-By"` 必為 0（AC-T22.6）；reviewer 重跑驗                                                                                                                   |
| 主 agent 不下手                                            | S4 task 任何 Edit/Write/Bash 修改/驗證/commit 都派 subagent；主 agent 違規 = 繞過 user 規則                           | 主 agent 只 spawn subagent + 收 result + retry orchestration；主 agent 可 commit `docs(spec): ...` 類型的 tasks.md 變動（本次產出），**不可** commit `chore(precommit): ...` 類型的 S4 實作                                        |

## S4 Tasks

### T16 — Spike: audit-mock-boundary.sh design

- **Status**: `[x]`
- **Files Read**: `.husky/pre-commit`、audit L77-111 / L607-612 / L626-633、`tests/integration/` 抽樣 5 檔（含 audit L83 列的 `notification-error.test.jsx`）
- **Files Written**: 只動 `specs/026-tests-audit-report/handoff.md` §3 T16 row + §2 S4 子表（補風險），**不**寫 script 本身
- **Audit**: P0-1 / Rule R8
- **Dependencies**: 無

**Engineer Action**：在 `handoff.md` §3 T16 evidence 寫五節：

1. **Pattern 凍結**：明確寫出 grep pattern（必須抓什麼、必須排除什麼）
   - 抓：`vi\.mock\(['"]@/(repo|service|runtime)/`（ERE，BSD grep 兼容）
   - 不抓：`@/config/...`（邊界外，audit L94-95 列為合理 mock）
   - 不抓：`@/lib/...`（compatibility facade，邊界依個案；不在 S4 scope）
   - 不抓：`@/types/...`（純型別）
2. **搜尋路徑 + include**：`tests/integration` 全層 + `--include='*.test.*'`
3. **與 S6 命令對齊驗證**：跑 audit L629 命令
   ```bash
   grep -rln "vi.mock(['\"]@/\(repo\|service\|runtime\)/" tests/integration/ --include="*.test.*" | sort | wc -l
   ```
   取得 baseline N（純整數），記錄在 evidence
4. **輸出格式設計**（與 T17 對齊）：
   ```
   AUDIT MOCK-BOUNDARY: <N> findings
   <file>:<line>:<匹配行 trim 至 ≤ 80 字>
   ...
   (warn-only; exit 0)
   ```
   首行 `<N>` 是純數字，可用 `head -1 | awk '{print $3}'` 抽出
5. **已知 false negative 清單**：多行 `vi.mock(\n '@/repo/foo'\n, ...)`（grep 行式工具的局限）。Evidence 註明 S6 ESLint AST 規則會補完

**Acceptance Criteria**：

- **AC-T16.1**: §3 T16 evidence 五節齊全；pattern 字串完整列出（含轉義）
- **AC-T16.2**: 跑 audit L629 命令取得 mock-boundary baseline N（純數字），evidence 列出實測結果 + 命令完整字串
- **AC-T16.3**: Pattern 排除清單明確列 `@/config`、`@/lib`、`@/types` 三層（理由各 1 句）
- **AC-T16.4**: 輸出格式範本完整（首行 + finding 行 + 結尾），首行可用 `head -1 | awk '{print $3}'` 抽出純數字
- **AC-T16.5**: §2 S4 子表至少補 1 條 mock-boundary 相關 risk（若無新增則明確聲明「無新增 risk」）

**Engineer Evidence**（貼到 `handoff.md` §3 T16 row）：

- Pattern 字串完整版（含轉義）
- audit L629 命令完整字串 + 實測輸出（含 N 數字）
- 輸出格式範本（5-10 行示例）
- false negative / false positive 清單

**Reviewer 驗證**：

- 獨立重跑 audit L629 命令，比對 engineer N（容忍 ±0；不一致即 reject）
- Read 抽樣 3 個 `tests/integration/**/*.test.*` 檔（建議含 audit L83 範例 `notification-error.test.jsx`、L84 範例 `PostFeed.test.jsx`），確認 engineer pattern 能抓到典型違規
- 確認排除清單合理（@/config / @/lib / @/types 不被誤抓）
- 在 §3 T16 reviewer 欄填名稱 + 時間戳 + ≥ 4 行驗證結論
- Reviewer **不能** Edit script / handoff engineer 區

---

### T17 — Spike: audit-flaky-patterns.sh + .husky/pre-commit 整合 design

- **Status**: `[x]`
- **Files Read**: `.husky/pre-commit`、audit L293-318 / L607-612 / L630、`tests/unit/runtime/useStravaConnection.test.jsx`（audit L311 範例）
- **Files Written**: 只動 `specs/026-tests-audit-report/handoff.md` §3 T17 row + §2 S4 子表，**不**寫 script / 不改 husky
- **Audit**: P1-4 / P1-5 / Rule R8
- **Dependencies**: 無（與 T16 平行）

**Engineer Action**：在 `handoff.md` §3 T17 evidence 寫六節：

1. **Flaky pattern 凍結**：合一 ERE，三選一（`|` 交替）
   - 子 pattern A：`toHaveBeenCalledTimes`（audit P1-4 109 處）
   - 子 pattern B：`new Promise.*setTimeout`（audit L630 字串）
   - 子 pattern C：`setTimeout.*Promise`（audit L315 順序變體）
   - 合併：`toHaveBeenCalledTimes|new Promise.*setTimeout|setTimeout.*Promise`（ERE）
2. **搜尋路徑 + include**：`tests` 全層 + `--include='*.test.*'`
3. **與 S6 命令對齊驗證**：跑 audit L630 命令
   ```bash
   grep -rln "toHaveBeenCalledTimes\|new Promise.*setTimeout" tests --include="*.test.*" | sort | wc -l
   ```
   取得 baseline M（純整數）。注意：S4 多包了 `setTimeout.*Promise` 順序變體 → S4 跑 script 抽出的 M 可能略 ≥ audit L630 結果（容忍 ±5；evidence 解釋）
4. **輸出格式**（與 T16 對齊）：
   ```
   AUDIT FLAKY-PATTERN: <M> findings
   <file>:<line>:<匹配行 trim 至 ≤ 80 字>
   ...
   (warn-only; exit 0)
   ```
5. **`.husky/pre-commit` 整合設計**：
   - `cat .husky/pre-commit` 結果（evidence 必貼，含 line count）
   - 確認**沒有** `set -e`（grep `^set -e` count 必 0）
   - Append 區塊位置：vitest 後（最末）
   - Append 內容（草稿，T20 直接套用）：
     ```bash
     # S4 (warn-only): audit gates for mock-boundary + flaky patterns
     # Refs: specs/026-tests-audit-report/tasks.md S4 / audit L607-612
     bash scripts/audit-mock-boundary.sh || true
     bash scripts/audit-flaky-patterns.sh || true
     ```
     `|| true` 雙保險：即使 script 自己 exit ≠ 0（理論上不會發生）也不擋 chain
6. **Husky chain exit 0 風險評估**：列出至少 2 種失敗模式（script syntax error、script 不存在、chmod 沒設）+ 對應 mitigation（`|| true` + script 自己 exit 0 雙保險）

**Acceptance Criteria**：

- **AC-T17.1**: §3 T17 evidence 六節齊全
- **AC-T17.2**: 跑 audit L630 命令取得 flaky baseline M（純數字），evidence 列出實測 + 命令完整字串
- **AC-T17.3**: `.husky/pre-commit` 完整 cat 結果貼 evidence（含 wc -l），明確判斷有無 `set -e`
- **AC-T17.4**: Append 區塊草稿用 `|| true` 雙保險（即使 script 自己 exit ≠ 0 也不擋）
- **AC-T17.5**: 輸出格式範本（首行 + finding 行 + 結尾）— 與 T16 樣板對齊（同樣的 `AUDIT <CATEGORY>: <N> findings` 結構）
- **AC-T17.6**: §2 S4 子表至少補 1 條 flaky-pattern 或 husky 整合相關 risk

**Engineer Evidence**：

- 合一 pattern 字串（ERE）+ 三子 pattern 各別說明
- audit L630 命令完整字串 + 實測輸出（含 M 數字）
- `.husky/pre-commit` 完整 cat 結果 + `wc -l`
- Append 區塊草稿（含 `|| true`）
- 輸出格式範本

**Reviewer 驗證**：

- 獨立重跑 audit L630 命令，比對 engineer M（容忍 ±0 — 因為跑的是 audit 原命令，不是 S4 擴充版）
- Read `.husky/pre-commit` 確認 engineer cat 結果屬實
- 確認 append 設計有雙保險（`|| true`）
- 在 §3 T17 reviewer 欄填名稱 + 時間戳 + ≥ 4 行驗證結論
- Reviewer **不能** Edit script / husky / handoff engineer 區（spike 階段不寫稿）

---

### T18 — Implement: scripts/audit-mock-boundary.sh

- **Status**: `[x]`
- **Files Written**: `scripts/audit-mock-boundary.sh`（新檔）
- **Files Read**: T16 evidence（pattern + 輸出格式）
- **Audit**: P0-1 / Rule R8
- **Dependencies**: T16 `[x]`

**Engineer Action**：

1. **Write 新檔** `scripts/audit-mock-boundary.sh`（建議內容）：

   ```bash
   #!/usr/bin/env bash
   # S4 audit gate: warn (don't block) on integration tests that mock @/{repo,service,runtime}/.
   # Refs: project-health/2026-04-29-tests-audit-report.md L77-111 (P0-1), L607-612 (S4)
   # exit 0 (warn-only). S8 trigger: change to exit 1 after Wave 3 mock cleanup.

   set +e

   PATTERN='vi\.mock\(['\''"]@/(repo|service|runtime)/'
   SEARCH_PATH='tests/integration'

   if [ ! -d "$SEARCH_PATH" ]; then
     echo "AUDIT MOCK-BOUNDARY: 0 findings (skipped: no $SEARCH_PATH)"
     echo "(warn-only; exit 0)"
     exit 0
   fi

   findings=$(grep -rEn "$PATTERN" "$SEARCH_PATH" --include='*.test.*' 2>/dev/null || true)
   if [ -z "$findings" ]; then
     count=0
   else
     count=$(printf '%s\n' "$findings" | grep -c .)
   fi

   echo "AUDIT MOCK-BOUNDARY: $count findings"
   if [ "$count" -gt 0 ]; then
     printf '%s\n' "$findings" | head -50
     if [ "$count" -gt 50 ]; then
       echo "... ($((count - 50)) more; run \`grep -rEn \"$PATTERN\" $SEARCH_PATH --include='*.test.*'\` for full list)"
     fi
   fi
   echo "(warn-only; exit 0)"
   exit 0
   ```

2. **Chmod**：`chmod +x scripts/audit-mock-boundary.sh`
3. **本機 sanity**：
   ```bash
   bash --version | head -1   # 紀錄 bash 版本
   bash scripts/audit-mock-boundary.sh > /tmp/s4-t18-sanity.log 2>&1
   echo "exit: $?"            # 期望 exit: 0
   head -1 /tmp/s4-t18-sanity.log   # 期望 AUDIT MOCK-BOUNDARY: <N> findings
   ```
4. **與 audit L629 對齊**：取 script `head -1` 的 N vs `grep -rln "vi.mock(['\"]@/\(repo\|service\|runtime\)/" tests/integration/ --include="*.test.*" | sort | wc -l`，差距 ≤ ±2（容忍：grep -rln 是 file count，script grep -rEn 是 line count；理論可能多 line 來自同檔多 mock）

**Acceptance Criteria**：

- **AC-T18.1**: 檔存在 `scripts/audit-mock-boundary.sh`，第一行為 shebang `#!/usr/bin/env bash`
  ```bash
  head -1 scripts/audit-mock-boundary.sh   # 期望 #!/usr/bin/env bash
  ```
- **AC-T18.2**: chmod +x 已設
  ```bash
  ls -l scripts/audit-mock-boundary.sh | awk '{print $1}'   # 期望 -rwxr-xr-x 或含 x
  ```
- **AC-T18.3**: 不開 `set -e`（不能因任何 grep 0-match 而 exit ≠ 0）
  ```bash
  grep -c "^set -e" scripts/audit-mock-boundary.sh   # 期望 0
  ```
- **AC-T18.4**: 末行 `exit 0`
  ```bash
  tail -1 scripts/audit-mock-boundary.sh | grep -c "^exit 0"   # 期望 1
  ```
- **AC-T18.5**: 跑 script 不爆 + exit 0
  ```bash
  bash scripts/audit-mock-boundary.sh > /tmp/s4-mock.log; echo "exit: $?"   # 期望 exit: 0
  ```
- **AC-T18.6**: stdout 首行符合 `AUDIT MOCK-BOUNDARY: <N> findings` 樣板（N 為純整數）
  ```bash
  head -1 /tmp/s4-mock.log | grep -E "^AUDIT MOCK-BOUNDARY: [0-9]+ findings"   # 期望 1 hit
  ```
- **AC-T18.7**: stdout 末行為 `(warn-only; exit 0)`
  ```bash
  tail -1 /tmp/s4-mock.log | grep -c "^(warn-only; exit 0)$"   # 期望 1
  ```
- **AC-T18.8**: N 數字與 audit L629 命令結果差距 ≤ ±2（記錄差距 + 理由）
- **AC-T18.9**: pattern 不抓 `@/config` / `@/lib` / `@/types`
  ```bash
  bash scripts/audit-mock-boundary.sh | grep -E "@/config|@/lib|@/types" | wc -l   # 期望 0
  ```
- **AC-T18.10**: macOS BSD grep 兼容（不可用 `-P` PCRE）
  ```bash
  grep -cE "grep .*-P[ \"]|grep .*--perl-regexp" scripts/audit-mock-boundary.sh   # 期望 0
  ```

**Engineer Evidence**（貼到 `handoff.md` §3 T18 row）：

- `cat scripts/audit-mock-boundary.sh`（完整內容）
- `bash --version` 第一行
- AC-T18.5 / T18.6 / T18.7 命令輸出
- AC-T18.8 對齊驗證（兩個數字 + 差距理由）
- AC-T18.9 / T18.10 grep 結果

**Reviewer 驗證**：

- Read `scripts/audit-mock-boundary.sh` 全檔
- 重跑 AC-T18.2 ~ T18.10 全部命令
- 抽樣 3 個被抓的 finding（如 audit L83 範例 `tests/integration/notifications/notification-error.test.jsx`），確認真的是違規（不是 false positive）
- 在 §3 T18 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論
- Reviewer **不能** Edit script

---

### T19 — Implement: scripts/audit-flaky-patterns.sh

- **Status**: `[x]`
- **Files Written**: `scripts/audit-flaky-patterns.sh`（新檔）
- **Files Read**: T17 evidence（pattern + 輸出格式 + husky 設計）
- **Audit**: P1-4 / P1-5 / Rule R8
- **Dependencies**: T17 `[x]`（與 T18 平行）

**Engineer Action**：

1. **Write 新檔** `scripts/audit-flaky-patterns.sh`（建議內容）：

   ```bash
   #!/usr/bin/env bash
   # S4 audit gate: warn (don't block) on flaky patterns.
   # Refs: project-health/2026-04-29-tests-audit-report.md L293-318 (P1-4/P1-5), L607-612 (S4)
   # P1-4: toHaveBeenCalledTimes(N) — non-deterministic call-count assertion
   # P1-5: hard-coded setTimeout-based wait (any of: `new Promise...setTimeout`, `setTimeout...Promise`)
   # exit 0 (warn-only). S8 trigger: change to exit 1 after Wave 3 flaky cleanup.

   set +e

   PATTERN='toHaveBeenCalledTimes|new Promise.*setTimeout|setTimeout.*Promise'
   SEARCH_PATH='tests'

   if [ ! -d "$SEARCH_PATH" ]; then
     echo "AUDIT FLAKY-PATTERN: 0 findings (skipped: no $SEARCH_PATH)"
     echo "(warn-only; exit 0)"
     exit 0
   fi

   findings=$(grep -rEn "$PATTERN" "$SEARCH_PATH" --include='*.test.*' 2>/dev/null || true)
   if [ -z "$findings" ]; then
     count=0
   else
     count=$(printf '%s\n' "$findings" | grep -c .)
   fi

   echo "AUDIT FLAKY-PATTERN: $count findings"
   if [ "$count" -gt 0 ]; then
     printf '%s\n' "$findings" | head -50
     if [ "$count" -gt 50 ]; then
       echo "... ($((count - 50)) more; run \`grep -rEn \"$PATTERN\" $SEARCH_PATH --include='*.test.*'\` for full list)"
     fi
   fi
   echo "(warn-only; exit 0)"
   exit 0
   ```

2. **Chmod**：`chmod +x scripts/audit-flaky-patterns.sh`
3. **本機 sanity**：同 T18 結構，但 log 寫到 `/tmp/s4-t19-sanity.log`
4. **與 audit L630 對齊**：取 script `head -1` 的 M vs `grep -rln "toHaveBeenCalledTimes\|new Promise.*setTimeout" tests --include="*.test.*" | sort | wc -l`，差距 ≤ ±5（容忍：S4 多包了 `setTimeout.*Promise` 順序變體 + line count vs file count）

**Acceptance Criteria**：

- **AC-T19.1**: shebang 為 `#!/usr/bin/env bash`（同 AC-T18.1）
- **AC-T19.2**: chmod +x 已設（同 AC-T18.2）
- **AC-T19.3**: 不開 `set -e`（同 AC-T18.3）
- **AC-T19.4**: 末行 `exit 0`（同 AC-T18.4）
- **AC-T19.5**: 跑 script 不爆 + exit 0
  ```bash
  bash scripts/audit-flaky-patterns.sh > /tmp/s4-flaky.log; echo "exit: $?"   # exit: 0
  ```
- **AC-T19.6**: stdout 首行符合 `AUDIT FLAKY-PATTERN: <M> findings`
  ```bash
  head -1 /tmp/s4-flaky.log | grep -E "^AUDIT FLAKY-PATTERN: [0-9]+ findings"   # 1 hit
  ```
- **AC-T19.7**: stdout 末行為 `(warn-only; exit 0)`（同 AC-T18.7）
- **AC-T19.8**: M 數字與 audit L630 命令結果差距 ≤ ±5（記錄差距 + 理由）
- **AC-T19.9**: pattern 涵蓋兩個 anti-pattern：`toHaveBeenCalledTimes` 與 `setTimeout`
  ```bash
  grep -c "toHaveBeenCalledTimes" scripts/audit-flaky-patterns.sh   # ≥ 1
  grep -c "setTimeout" scripts/audit-flaky-patterns.sh   # ≥ 1
  ```
- **AC-T19.10**: macOS BSD grep 兼容（同 AC-T18.10）

**Engineer Evidence**：

- `cat scripts/audit-flaky-patterns.sh`（完整內容）
- AC-T19.5 / T19.6 / T19.7 命令輸出
- AC-T19.8 對齊驗證（兩個數字 + 差距理由）
- AC-T19.9 / T19.10 grep 結果
- 抽樣 1 個 finding（建議 audit L311 範例 `useStravaConnection.test.jsx`），確認 script 抓到的 line 是真的 anti-pattern

**Reviewer 驗證**：

- Read `scripts/audit-flaky-patterns.sh` 全檔
- 重跑 AC-T19.2 ~ T19.10
- 抽樣 3 個 finding（建議含 audit L295 範例 `useStravaActivities.test.jsx:268`、L311 `useStravaConnection.test.jsx:75-96`），確認真的是 anti-pattern
- 在 §3 T19 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論
- Reviewer **不能** Edit script

---

### T20 — Implement: .husky/pre-commit append two audit gates

- **Status**: `[x]`
- **Files Written**: `.husky/pre-commit`（修改，**只 append，不改既有 5 行**）
- **Files Read**: T17 evidence（append 區塊草稿）、T18/T19 evidence（確認兩 script 已存在 + 可執行）
- **Audit**: P0-1 / P1-4 / P1-5 / Rule R8
- **Dependencies**: T18 `[x]` + T19 `[x]`

**Engineer Action**：

1. **Edit** `.husky/pre-commit`，末尾追加（保留所有既有行）：
   ```bash
   # S4 (warn-only): audit gates for mock-boundary + flaky patterns
   # Refs: specs/026-tests-audit-report/tasks.md S4 / audit L607-612
   bash scripts/audit-mock-boundary.sh || true
   bash scripts/audit-flaky-patterns.sh || true
   ```
2. **驗證 append-only**：
   ```bash
   git diff .husky/pre-commit | grep -c "^-[^-]"   # 期望 0（- 開頭但不是 ---）
   git diff .husky/pre-commit | grep -c "^+[^+]"   # 期望 ≥ 4
   ```
3. **Manual chain dry-run**（直接跑 hook 腳本驗證 chain 仍綠 — **注意：dry-run 會跑 lint/type-check/depcruise/spellcheck/vitest，需數分鐘**）：
   ```bash
   bash .husky/pre-commit > /tmp/s4-hook-dryrun.log 2>&1; echo "exit: $?"
   ```
   exit 0；stdout 末段必含兩 `AUDIT *: <N> findings` 行
4. **不**動其他 husky 檔（`.husky/pre-push` 不變）

**Acceptance Criteria**：

- **AC-T20.1**: `.husky/pre-commit` 只 append，0 刪改
  ```bash
  git diff .husky/pre-commit | grep -c "^-[^-]"   # 期望 0
  ```
- **AC-T20.2**: append 區塊含兩個 `bash scripts/audit-*.sh || true`
  ```bash
  grep -c "audit-mock-boundary.sh" .husky/pre-commit   # 期望 1
  grep -c "audit-flaky-patterns.sh" .husky/pre-commit   # 期望 1
  grep -cE "\|\| true" .husky/pre-commit   # 期望 ≥ 2
  ```
- **AC-T20.3**: 既有 5 行（lint / type-check / depcruise / spellcheck / vitest）0 改動
  ```bash
  for cmd in "lint -- --max-warnings 0" "type-check" "depcruise" "spellcheck" "vitest run --project=browser"; do
    grep -qF "$cmd" .husky/pre-commit && echo "$cmd OK" || echo "$cmd MISSING"
  done
  ```
  五行皆 OK
- **AC-T20.4**: 順序：兩 audit 行在 vitest 之後
  ```bash
  awk '/vitest/{found=1} found && /audit-mock-boundary/{print "OK"; exit}' .husky/pre-commit   # 期望 OK
  ```
- **AC-T20.5**: Manual chain dry-run exit 0
  ```bash
  bash .husky/pre-commit > /tmp/s4-hook-dryrun.log 2>&1; echo "exit: $?"   # exit: 0
  ```
- **AC-T20.6**: dry-run stdout 含兩個 audit 結尾標記
  ```bash
  grep -c "^AUDIT MOCK-BOUNDARY:" /tmp/s4-hook-dryrun.log   # 期望 1
  grep -c "^AUDIT FLAKY-PATTERN:" /tmp/s4-hook-dryrun.log   # 期望 1
  ```
- **AC-T20.7**: 沒誤動 `.husky/pre-push`
  ```bash
  git diff .husky/pre-push | wc -l   # 期望 0
  ```

**Engineer Evidence**：

- 完整 `git diff .husky/pre-commit`（必須只有 + 行）
- AC-T20.3 五行自查迴圈輸出
- AC-T20.5 dry-run exit code + log 末 30 行
- AC-T20.6 兩個 audit 標記行（從 dry-run log 抽出）

**Reviewer 驗證**：

- Read `.husky/pre-commit` 全檔
- 重跑 AC-T20.1 ~ T20.7
- 親自跑一次 `bash .husky/pre-commit`（reviewer 環境也須跑通；接受跑 5-10 分鐘）
- 確認 dry-run 輸出順序：lint → type-check → depcruise → spellcheck → vitest → audit-mock-boundary → audit-flaky-patterns
- 在 §3 T20 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論

---

### T21 — Integration smoke test: stage dummy + run hook + capture baseline

- **Status**: `[x]`
- **Files Written**: 0（純跑 + 紀錄 evidence；任何 stash/temp 檔必須 cleanup）
- **Files Read**: T18/T19/T20 改動成果
- **Audit**: P0-1 / P1-4 / P1-5 / Rule R8
- **Dependencies**: T20 `[x]`

**Engineer Action**：

1. **環境清理 + 自查**：
   ```bash
   git status --short      # 必須 clean 或只有 handoff/tasks.md modified
   git stash list | wc -l  # 紀錄當前 stash 數，T21 結束須相同
   ```
2. **跑兩 audit script 取 baseline 數字**（warn-only mode）：
   ```bash
   bash scripts/audit-mock-boundary.sh > /tmp/s4-mock-baseline.log 2>&1
   bash scripts/audit-flaky-patterns.sh > /tmp/s4-flaky-baseline.log 2>&1
   N=$(head -1 /tmp/s4-mock-baseline.log | awk '{print $3}')
   M=$(head -1 /tmp/s4-flaky-baseline.log | awk '{print $3}')
   echo "mock-boundary baseline: N=$N"
   echo "flaky-pattern baseline: M=$M"
   ```
3. **跑完整 husky chain dry-run**（不 commit）：
   ```bash
   bash .husky/pre-commit > /tmp/s4-hook-full.log 2>&1
   echo "hook exit: $?"   # 期望 0
   tail -20 /tmp/s4-hook-full.log
   ```
4. **Smoke test：故意製造違規**（驗證 audit 抓得到新增 + 仍不擋 commit）：
   - 建立 temp test 檔 `tests/integration/_s4-smoke.test.jsx`：
     ```jsx
     import { vi, test, expect } from 'vitest';
     vi.mock('@/repo/event-repo', () => ({}));
     test('s4 smoke', () => {
       const fn = vi.fn();
       expect(fn).toHaveBeenCalledTimes(0);
     });
     ```
   - 跑 audit：
     ```bash
     bash scripts/audit-mock-boundary.sh | head -1   # N 應 = baseline + 1
     bash scripts/audit-flaky-patterns.sh | head -1  # M 應 = baseline + 1
     bash scripts/audit-mock-boundary.sh; echo "exit: $?"   # 期望 exit: 0（仍 warn-only）
     ```
   - **必刪 temp 檔**：
     ```bash
     rm tests/integration/_s4-smoke.test.jsx
     git status --short | grep "_s4-smoke" | wc -l   # 期望 0
     ```
5. **同步 baseline 數字到 handoff §3 T21 evidence + §0 / §1**（T22 commit message 從 T21 evidence copy）

**Acceptance Criteria**：

- **AC-T21.1**: baseline N（mock-boundary）抽出，純整數 ≥ 0
- **AC-T21.2**: baseline M（flaky-pattern）抽出，純整數 ≥ 0
- **AC-T21.3**: husky chain full dry-run exit 0；末段含兩個 `AUDIT *: <N> findings` 標記
- **AC-T21.4**: smoke test：加 temp 檔後 N+1 / M+1（兩 audit 都偵測到新增違規）
- **AC-T21.5**: 即使 temp 檔在場，audit script 仍 exit 0（warn-only 紀律驗證）
- **AC-T21.6**: temp 檔已刪除；`git status --short | grep "_s4-smoke" | wc -l` = 0；`git stash list | wc -l` 數量 vs T21 開始時相同
- **AC-T21.7**: Baseline N/M 數字與 audit L629/L630 命令結果差距 ≤ ±2 / ±5（與 T18/T19 已驗的差距一致；若 T21 重抽不一致 → reject）

**Engineer Evidence**（貼到 `handoff.md` §3 T21 row）：

- 環境自查（git status / stash list 起點）
- baseline N、M（純數字 + log 後 5 行佐證）
- husky chain full dry-run log 末 20 行
- smoke test：temp 檔內容 + 加溫前後 N/M 差距、cleanup 後 git status
- 結束時 git status / stash list（vs 起點完全相同）

**Reviewer 驗證**：

- 獨立跑 baseline 兩 script，比對 engineer N/M（容忍 ±0；不一致即 reject）
- 親跑 `bash .husky/pre-commit` 驗 dry-run exit 0（接受 5-10 分鐘）
- Read engineer smoke test 步驟 → 評估 temp 檔是否合理（不能誤建在 src/ 或實際 spec 路徑；檔名 `_` 開頭表示暫用）
- 確認 cleanup：`git status --short`、`tests/integration/` 無 `_s4-smoke` 殘檔
- 在 §3 T21 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論

---

### T22 — Commit + handoff sync (S4)

- **Status**: `[x]`
- **Files Written**:
  - `specs/026-tests-audit-report/handoff.md` §0 / §1 / §3（T22 self-evidence）/ §5 完整更新
  - `specs/026-tests-audit-report/tasks.md`（T16-T22 status `[ ]` → `[x]`）
- **Files committed**: `scripts/audit-mock-boundary.sh` + `scripts/audit-flaky-patterns.sh` + `.husky/pre-commit` + `specs/026-tests-audit-report/handoff.md` + `specs/026-tests-audit-report/tasks.md`
- **Dependencies**: T16-T21 全部 `[x]`

**Engineer Action**：

1. 確認 §3 T16-T21 evidence + reviewer signature 完整
2. 一次性重跑全 acceptance（見 AC-T22.2）
3. 更新 `handoff.md`：
   - §0：T16-T22 全填 `done`、Last commit (S4) 留待 commit 後填
   - §1：指向 S5（`firestore rules infra + 5 critical paths`，audit L614-620）
   - §2：S4 子表所有 risk row 留存（不刪），補 T18-T21 實際遭遇紀錄（若有）
   - §3 T22 row engineer evidence 填寫
   - §5：補 bash 版本（T18/T19 已記錄）
4. 更新 `tasks.md`：T16-T22 Status `[ ]` → `[x]`
5. **Commit 前 mandatory**：手動跑完整 pre-commit gate：
   ```bash
   npm run lint -- --max-warnings 0 \
     && npm run type-check \
     && npm run depcruise \
     && npm run spellcheck \
     && npx vitest run --project=browser \
     && bash scripts/audit-mock-boundary.sh \
     && bash scripts/audit-flaky-patterns.sh
   ```
   全綠才繼續（注意：兩 audit script 是 warn-only exit 0，永遠不會擋；只是順便驗 stdout 格式）
6. **明確列檔** stage（**禁** `git add -A`）：
   ```bash
   git add scripts/audit-mock-boundary.sh \
           scripts/audit-flaky-patterns.sh \
           .husky/pre-commit \
           specs/026-tests-audit-report/handoff.md \
           specs/026-tests-audit-report/tasks.md
   ```
7. **`git status` 確認沒誤 stage temp 檔**（T21 smoke 已 cleanup，但仍須驗）：
   ```bash
   git status --short | grep -iE "_s4-smoke|/tmp/s4-" | wc -l   # 期望 0
   ```
8. `git commit`（不 push）；hook 會跑既有 5 項 + 兩個 audit warn

**Acceptance Criteria**：

- **AC-T22.1**: §3 T16-T21 六 row 都 `rev-pass` + 雙簽名；`tasks.md` T16-T22 全 `[x]`
- **AC-T22.2**: 一次性重跑：
  ```bash
  # 兩 script 存在 + 可執行
  ls -l scripts/audit-mock-boundary.sh scripts/audit-flaky-patterns.sh
  # husky 已含兩行 audit
  grep -cE "audit-mock-boundary|audit-flaky-patterns" .husky/pre-commit   # ≥ 2
  # Quality gate
  npm run lint -- --max-warnings 0 2>&1 | tail -5
  npm run type-check 2>&1 | tail -5
  npm run depcruise 2>&1 | tail -3
  npm run spellcheck 2>&1 | tail -5
  npx vitest run --project=browser 2>&1 | tail -5
  # Audit warn-only sanity
  bash scripts/audit-mock-boundary.sh; echo "exit: $?"   # exit: 0
  bash scripts/audit-flaky-patterns.sh; echo "exit: $?"   # exit: 0
  ```
  全部 exit 0 + grep 全有 hit
- **AC-T22.3**: commit message 格式：

  ```
  chore(precommit): mock-boundary + flaky grep gates (warn-only)

  - scripts/audit-mock-boundary.sh: warn on tests/integration/** that vi.mock('@/{repo,service,runtime}/...')
  - scripts/audit-flaky-patterns.sh: warn on toHaveBeenCalledTimes / setTimeout+Promise patterns
  - .husky/pre-commit: append both scripts (exit 0; warn-only — does not block commit)
  - 對應 audit P0-1 / P1-4 / P1-5（防新增訊號，不擋 baseline）

  Baseline (S4 grep): mock-boundary: <N>, flaky-pattern: <M>
  → S6 ESLint ignores baseline 將以此為起點；S8 觸發型升級時改 exit 1 真擋

  Refs: project-health/2026-04-29-tests-audit-report.md L77-111, L293-318, L607-612
  ```

  - Conventional commits `chore(precommit):`
  - **N / M 數字必須與 T21 evidence 一致**（直接 copy；不口算）
  - **不加 `Co-Authored-By`**

- **AC-T22.4**:
  - branch = `026-tests-audit-report`
  - **不 push** 到遠端
  - pre-commit hook 全綠（含兩個 audit warn 行 exit 0）
- **AC-T22.5**: `git show <hash> --stat` 顯示 **5 個檔**：
  - `scripts/audit-mock-boundary.sh`（new file mode 100755）
  - `scripts/audit-flaky-patterns.sh`（new file mode 100755）
  - `.husky/pre-commit`
  - `specs/026-tests-audit-report/handoff.md`
  - `specs/026-tests-audit-report/tasks.md`
  - **不**含 `tests/integration/_s4-smoke*` / `/tmp/*` / log 檔
- **AC-T22.6**: `git log -1 --format=%B | grep -ic "Co-Authored-By"` = 0
- **AC-T22.7**: 兩 script 在 git index 為 100755（chmod +x 已紀錄）
  ```bash
  git ls-files --stage scripts/audit-mock-boundary.sh scripts/audit-flaky-patterns.sh | awk '{print $1}'
  # 期望兩行皆為 100755
  ```
- **AC-T22.8**: commit message 中 N/M 數字與 T21 evidence 完全一致
  ```bash
  N_in_msg=$(git log -1 --format=%B | grep -oE "mock-boundary: [0-9]+" | head -1 | awk '{print $2}')
  M_in_msg=$(git log -1 --format=%B | grep -oE "flaky-pattern: [0-9]+" | head -1 | awk '{print $2}')
  echo "msg N=$N_in_msg, msg M=$M_in_msg"
  # 須與 handoff §3 T21 evidence 中 N、M 完全相等
  ```

**Engineer Evidence**：

- AC-T22.2 全部命令輸出
- `git log -1 --format=fuller`
- `git show <hash> --stat`
- AC-T22.6 / T22.7 / T22.8 命令結果
- 自評 T16-T21 全部 AC 逐條對應 commit 內容

**Reviewer 驗證**：

- 重跑 AC-T22.2 全部命令
- `git show <hash> --stat` 確認 5 檔 + 模式（含兩個 100755）
- `git show <hash>` 看完整 commit message + diff
- AC-T22.6 / T22.7 / T22.8 grep 與 N/M 對齊
- `git log origin/026-tests-audit-report..HEAD 2>&1` 應顯示 ≥ 1 commit ahead（**未** push）
- Read `handoff.md` 確認 §0 / §1 / §2 S4 子表 / §3 T16-T22 / §5 完整
- Read `tasks.md` 確認 T16-T22 全 `[x]`
- 親跑 `bash .husky/pre-commit` 驗 hook 仍綠（接受 5-10 分鐘）
- 在 §3 T22 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論

---

> S5 從 T23 開始追加。**主 agent 不准做 T23-T31 任務的任何實作、驗證、修復或 commit**；主 agent 只負責派 subagent、收斂 reviewer feedback、必要時回報 escalation。本段是任務規格，不是 S5 開工。

## S5 Goal

補上 Firestore Rules unit test infra、5 條 audit 標記的 critical paths，並新增 GitHub Actions paths-filter gate。

S5 是 audit report §12 的第 5 個 commit，對應 P0-2 / R9。S5 **只補測試與 CI gate**；除非使用者另行批准，**不修改 `firestore.rules` 行為**。如果 emulator 測試證明 audit 期待與現行規則衝突，subagent 必須在 `handoff.md` 記錄衝突並 escalate，不可自行改 rules 讓測試過。

## S5 References

- Audit report：[`project-health/2026-04-29-tests-audit-report.md`](../../project-health/2026-04-29-tests-audit-report.md)
  - **L113-141** — P0-2 Firestore Rules 沒有 unit test + 5 條高風險規則
  - **L121-129** — 5 條 critical path 清單
  - **L131-139** — 修補步驟（安裝 `@firebase/rules-unit-testing`、新增 `tests/server/rules/`）
  - **L538-544** — R9：Firestore Rules paths-filter workflow
  - **L614-620** — S5 章節
- 真實 rules 行號（以目前 worktree `firestore.rules` 為準）：
  - `posts/{postId}/likes/{uid}` collectionGroup：L80-L84
  - Strava tokens / connections / activities：L108-L123
  - Event seat consistency：L150-L166
  - Event participants cascade delete：L168-L185
  - Notification create/read/update/delete：L233-L257
- 現有 server test infra：
  - `vitest.config.mjs` server project include 已是 `tests/server/**/*.test.js`（P0-3 已不再是 S5 blocker）
  - `vitest.setup.server.js` 會要求 Auth + Firestore emulator，並固定 `demo-test`
  - `npm run test:server -- <path>` 可跑單一 server/rules spec

## S5 核心設計決策（必讀）

| 決策 | 內容 |
| ---- | ---- |
| **只測現行 rules，不改 rules** | S5 目標是補 emulator-driven unit tests 與 CI gate。若發現現行 rules 太寬（例：notification 可送任意非自己的 `recipientUid`），先寫入 `handoff.md` 並 escalate，不准在 S5 偷改 `firestore.rules`。 |
| **每個 spec 都載入真實 `firestore.rules`** | 禁止在 test 中複製 rules 字串或寫 simplified rules；helper 必須從 repo root 讀 `firestore.rules`。 |
| **Rules tests 用 client SDK + `@firebase/rules-unit-testing`** | 測 allow/deny 必須走 Firestore Rules emulator：`initializeTestEnvironment`、`authenticatedContext` / `unauthenticatedContext`、`withSecurityRulesDisabled` seed、`assertSucceeds` / `assertFails`。 |
| **一個 domain 一個 spec** | S5 產出 5 個 spec：`users.rules.test.js`、`posts.rules.test.js`、`strava.rules.test.js`、`events.rules.test.js`、`notifications.rules.test.js`。Events spec 同時負責 seat consistency + participants cascade 兩條 critical path。 |
| **Users spec 是 infra proof** | `users.rules.test.js` 不在 5 條 critical path 內，但用來證明 helper、public read、owner write、bio length、weatherFavorites owner gate 都能在 emulator 跑。 |
| **Posts likes 依真實規則，不照 audit 猜測** | 目前 L81-L83 允許任何 signed-in user 讀 collectionGroup likes；S5 測試應鎖定「未登入 denied、登入 allowed、create/delete 只能 doc id 本人、post author 可 cascade delete」。若產品期待更嚴，另案改 rules。 |
| **Notification `recipientUid` 有語意衝突** | 目前 L235-L245 允許 actor 建立通知給任意非自己的 recipient；S5 測 actorUid/type/read/createdAt/self-recipient/read/update/delete deny。若要「偽造 recipientUid 一律 deny」，必須先拿使用者決策。 |
| **CI gate 用原生 `paths` filter** | `.github/workflows/firestore-rules-gate.yml` 用 GitHub Actions `on.<event>.paths` 觸發，範圍限 `firestore.rules`、`tests/server/rules/**`、package lock、workflow 本身。 |
| **Reviewer 逐條 AC 驗證** | 每個 engineer 完成後，paired reviewer 必須重跑該 task 指定 command。Reviewer reject 時，主 agent 重派 engineer，直到 pass 或第 3 次 escalated。 |
| **所有坑寫進 handoff** | Engineer 必須把重要發現 / 規則語意衝突 / emulator 坑寫到 `handoff.md` §2 S5 risk 子表或 §3 task evidence；Reviewer 必須確認 engineer 記錄是否正確。 |

## S5 Concurrency

```
Wave 1 (序列):    T23-eng → T23-rev   (rules semantics spike，不寫 code)
Wave 2 (序列):    T24-eng → T24-rev   (install rules-unit-testing)
Wave 3 (序列):    T25-eng → T25-rev   (shared helper + users infra proof)
Wave 4 (5 並行):  T26-eng | T27-eng | T28-eng | T29-eng | T30-eng
                       ↓ each 完成後立即觸發 paired reviewer ↓
Wave 5 (≤5 並行): T26-rev | T27-rev | T28-rev | T29-rev | T30-rev
                       ↓ 全部 verified-pass ↓
Wave 6 (序列):    T31-eng → T31-rev   (整合驗證 + commit)
```

| 項目                            | 值 |
| ------------------------------- | -- |
| Max concurrent subagent (S5)    | **5**（Wave 4/5；T23-T25、T31 序列） |
| Total subagent invocations (S5) | **18**（9 task × 2，no retry case） |

> 為什麼最多 5：T26-T30 寫入範圍互斥（posts / strava / events / notifications / workflow）。T25 先建立 helper 與 users proof，後面 5 個 task 才能平行。T31 必須等全部 reviewer-pass，因為 commit message 與 handoff sync 要整合所有 evidence。

## S5 Risks（subagent 必讀，補充進 handoff.md §2 S5 子表）

| Risk | Why it matters | Action |
| ---- | -------------- | ------ |
| `@firebase/rules-unit-testing` 需要 emulator | 直接 `npx vitest run --project=server tests/server/rules/...` 會被 `vitest.setup.server.js` 擋，或連不到 emulator | 一律用 `npm run test:server -- tests/server/rules/<file>`；CI workflow 也用同一條路徑。 |
| Server include 已修好，不要重改 config | `vitest.config.mjs` 已 include `tests/server/**/*.test.js`；S5 再改 include 會製造無關 diff | T23 reviewer 驗證 config 現況；S5 禁改 `vitest.config.mjs`，除非 emulator test 被實證漏抓且使用者批准。 |
| Rules 語意與 audit wording 衝突 | audit 修補範例提到「未登入 read 應拒」「偽造 recipientUid 應拒」，但現行 rules 對 posts read / notification create 不完全如此 | 先 test 現行 rules；衝突寫 handoff + escalate，不准自行改 rules。 |
| 多個 parallel task 都寫 `handoff.md` | T26-T30 平行時容易覆蓋彼此 evidence | 每個 engineer 只改自己 task row / S5 risk row；寫前重讀最新檔，若衝突只 merge 自己區塊。Reviewer 只能補 reviewer 欄。 |
| `createdAt == request.time` 很容易寫錯 | Notification create 若用固定 `Timestamp.now()` 會 fail；client 需用 server timestamp transform | T29 必須包含 valid create success + fixed timestamp fail，並在 evidence 寫清楚用法。 |
| `withSecurityRulesDisabled` seed 不等於 pass | seed 是準備測試資料，不代表 client rules allow | 所有 allow/deny 都要用 authenticated/unauthenticated client context + `assertSucceeds` / `assertFails` 驗證。 |
| CollectionGroup query path 容易只測 doc get | P0-2 指的是 `collectionGroup('likes')` 風險；只 `getDoc(posts/p1/likes/u1)` 不夠 | T26 必須至少有一個 `collectionGroup(db, 'likes')` query 的 unauth denied + signed-in allowed。 |
| Workflow paths 太寬或太窄 | 太寬會浪費 CI，太窄會讓 rules 改動漏跑 | T30 AC 明列 paths；reviewer 逐項 grep。 |

## S5 Tasks

### T23 — Spike: Firestore rules semantics + test matrix

- **Status**: `[ ]`
- **Files Written**: `specs/026-tests-audit-report/handoff.md` §2 S5 risk 子表 + §3 T23 row，**不**改 code/test/workflow
- **Files Read**: `firestore.rules`、audit L113-141 / L538-544 / L614-620、`vitest.config.mjs`、`vitest.setup.server.js`、`package.json`
- **Audit**: P0-2 / R9
- **Dependencies**: 無

**Engineer Action**：

1. 在 `handoff.md` §3 T23 evidence 寫出 5 條 critical path 的「現行 rules 行號 + expected allow/deny matrix」。
2. 明確記錄兩個 audit wording 衝突：
   - `posts` 本體 read 是 public；S5 不寫「未登入 post read deny」測試。
   - notification create 目前允許 actor 寫給任意非自己的 recipient；S5 不把「任意 recipientUid」當 deny，除非使用者批准改 rules。
3. 驗證 server include 現況：`vitest.config.mjs` server project include 已涵蓋 `tests/server/**/*.test.js`。
4. 在 §2 S5 risk 子表補實際發現（至少 3 條；若與上方已重複，仍要寫本輪確認結果）。

**Acceptance Criteria**：

- **AC-T23.1**: §3 T23 evidence 有 5 條 critical path matrix，每條都含 rules 行號、allow cases、deny cases。
- **AC-T23.2**: Evidence 明確寫出「S5 不修改 `firestore.rules`」與「若 expected security 與現行 rules 衝突則 escalate」。
- **AC-T23.3**: Evidence 附 `vitest.config.mjs` server include 現況，確認 `tests/server/**/*.test.js` 會抓到 `tests/server/rules/*.rules.test.js`。
- **AC-T23.4**: §2 S5 risk 子表至少 3 條實際風險 / 踩坑。
- **AC-T23.5**: `git diff --name-only` 只包含 `specs/026-tests-audit-report/handoff.md`。

**Reviewer 驗證**：

- Read `firestore.rules:80-257`，逐條比對 engineer matrix。
- Read `vitest.config.mjs` server project include，確認 AC-T23.3 屬實。
- `git diff --name-only` 確認沒有 code/test/workflow/package 改動。
- 在 §3 T23 reviewer 欄填 PASS/REJECT + 至少 5 行驗證結論。

---

### T24 — Install: @firebase/rules-unit-testing dev dependency

- **Status**: `[ ]`
- **Files Written**: `package.json`、`package-lock.json`、`specs/026-tests-audit-report/handoff.md` §3 T24 row
- **Files Read**: `package.json`、`package-lock.json`
- **Audit**: P0-2 / R9
- **Dependencies**: T23 `[x]`

**Engineer Action**：

1. 安裝 dev dependency：
   ```bash
   npm install -D @firebase/rules-unit-testing
   ```
2. 禁止順手跑 `npm audit fix`、禁止升級其他套件。
3. 驗證 package 可 import：
   ```bash
   npm ls @firebase/rules-unit-testing
   node -e "import('@firebase/rules-unit-testing').then(m=>console.log(['initializeTestEnvironment','assertSucceeds','assertFails'].every(k=>k in m)))"
   ```

**Acceptance Criteria**：

- **AC-T24.1**: `package.json` devDependencies 含 `@firebase/rules-unit-testing`。
- **AC-T24.2**: `package-lock.json` 有對應 lock entry；沒有無關 dependency upgrade。
- **AC-T24.3**: `npm ls @firebase/rules-unit-testing` exit 0。
- **AC-T24.4**: node import command 輸出 `true`。
- **AC-T24.5**: `git diff --name-only` 只新增/修改 `package.json`、`package-lock.json`、`handoff.md`。

**Engineer Evidence**：

- `git diff package.json package-lock.json --stat`
- `npm ls @firebase/rules-unit-testing` 輸出
- node import command 輸出

**Reviewer 驗證**：

- 重跑 AC-T24.3 / AC-T24.4。
- Read `git diff package.json package-lock.json`，確認沒有 `npm audit fix` 式大範圍升級。
- 在 §3 T24 reviewer 欄簽名 + 命令輸出。

---

### T25 — Infra proof: shared rules helper + users.rules.test.js

- **Status**: `[ ]`
- **Files Written**:
  - `tests/server/rules/_helpers/rules-test-env.js`
  - `tests/server/rules/users.rules.test.js`
  - `specs/026-tests-audit-report/handoff.md` §3 T25 row
- **Audit**: P0-2 infra proof（users 不是 5 critical path，但證明 rules emulator chain）
- **Dependencies**: T24 `[x]`

**Engineer Action**：

1. 建 shared helper，至少提供：
   - 從 repo root 讀取真實 `firestore.rules`
   - `initializeTestEnvironment({ projectId: 'demo-test', firestore: { rules } })`
   - `withSecurityRulesDisabled` seed helper
   - authenticated / unauthenticated Firestore client helper
   - `clearFirestore()` / `cleanup()` lifecycle
2. 寫 `users.rules.test.js`，覆蓋：
   - public user profile read：unauthenticated `getDoc(users/u1)` succeeds
   - create only self：`auth.uid === userId` succeeds；cross-user fails
   - update only self：owner non-bio update succeeds；cross-user fails
   - bio validation：150 chars succeeds；151 chars fails
   - delete denied
   - `users/{userId}/weatherFavorites/{docId}` owner read/write succeeds；non-owner fails

**Acceptance Criteria**：

- **AC-T25.1**: Helper 讀的是 repo `firestore.rules`，test 內沒有複製 rules string。
- **AC-T25.2**: Helper 用 `demo-test` project id，並支援 disabled seed + authed/anon clients。
- **AC-T25.3**: `users.rules.test.js` 至少 7 個 `it(...)`，且每組 allow/deny 用 `assertSucceeds` / `assertFails`。
- **AC-T25.4**: Targeted server test pass：
  ```bash
  npm run test:server -- tests/server/rules/users.rules.test.js
  ```
- **AC-T25.5**: Targeted lint pass：
  ```bash
  npx eslint tests/server/rules/_helpers/rules-test-env.js tests/server/rules/users.rules.test.js
  ```
- **AC-T25.6**: `git diff --name-only` 不含 `firestore.rules` / `vitest.config.mjs`。

**Engineer Evidence**：

- `git diff -- tests/server/rules/_helpers/rules-test-env.js tests/server/rules/users.rules.test.js`
- AC-T25.4 / AC-T25.5 輸出
- lifecycle 設計摘要：何時 clear、何時 cleanup、如何 seed

**Reviewer 驗證**：

- Read helper + users spec 全檔。
- 重跑 AC-T25.4 / AC-T25.5。
- 確認 helper 沒 mock / 沒複製 rules / 沒碰 `firestore.rules`。
- 在 §3 T25 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論。

---

### T26 — Critical path: posts likes collectionGroup rules

- **Status**: `[ ]`
- **Files Written**: `tests/server/rules/posts.rules.test.js`、`handoff.md` §3 T26 row
- **Audit**: P0-2 critical path 1 / rules L80-L84
- **Dependencies**: T25 `[x]`
- **Parallel**: 可與 T27 / T28 / T29 / T30 平行

**Engineer Action**：

覆蓋 `posts/{postId}/likes/{uid}` 與 collectionGroup likes：

- unauthenticated `collectionGroup(db, 'likes')` read fails
- signed-in `collectionGroup(db, 'likes')` read succeeds（依現行 L82）
- authenticated user can create own like doc id
- authenticated user cannot create/delete another uid's like doc
- like owner can delete own like
- post author can cascade delete another user's like under own post
- unrelated signed-in user cannot delete another user's like

**Acceptance Criteria**：

- **AC-T26.1**: Spec 至少包含 7 個 cases，且有 `collectionGroup(db, 'likes')` query。
- **AC-T26.2**: 測試 expectation 對齊現行 rules：signed-in collectionGroup read 是 allowed，不是 denied。
- **AC-T26.3**: Targeted test pass：
  ```bash
  npm run test:server -- tests/server/rules/posts.rules.test.js
  ```
- **AC-T26.4**: Targeted lint pass：
  ```bash
  npx eslint tests/server/rules/posts.rules.test.js
  ```
- **AC-T26.5**: 不改 `firestore.rules`、不改 helper API（若需要 helper 改動，先回 T25/T23 escalate）。

**Reviewer 驗證**：

- Read posts spec，確認真的測 collectionGroup，不只是 `getDoc(posts/.../likes/...)`。
- 重跑 AC-T26.3 / AC-T26.4。
- 對照 `firestore.rules:80-84` + nested likes rule，確認 expectations 正確。
- 在 §3 T26 reviewer 欄簽名 + 命令輸出。

---

### T27 — Critical path: Strava tokens / connections / activities read-only

- **Status**: `[ ]`
- **Files Written**: `tests/server/rules/strava.rules.test.js`、`handoff.md` §3 T27 row
- **Audit**: P0-2 critical path 2 / rules L108-L123
- **Dependencies**: T25 `[x]`
- **Parallel**: 可與 T26 / T28 / T29 / T30 平行

**Engineer Action**：

覆蓋 Strava 三組 collection：

- `stravaTokens/{uid}`：owner / other / unauth read all fail；client create/update/delete all fail
- `stravaConnections/{uid}`：owner read succeeds；other / unauth read fails；client write fails
- `stravaActivities/{id}`：owner read succeeds when `resource.data.uid === auth.uid`；other / unauth read fails；client write fails

**Acceptance Criteria**：

- **AC-T27.1**: Spec 至少 9 個 cases，三個 collection 都有 allow/deny coverage。
- **AC-T27.2**: `stravaTokens` 沒有任何 client allow path。
- **AC-T27.3**: `stravaConnections` 與 `stravaActivities` 都驗 owner vs non-owner read。
- **AC-T27.4**: Targeted test pass：
  ```bash
  npm run test:server -- tests/server/rules/strava.rules.test.js
  ```
- **AC-T27.5**: Targeted lint pass：
  ```bash
  npx eslint tests/server/rules/strava.rules.test.js
  ```
- **AC-T27.6**: 不改 `firestore.rules`。

**Reviewer 驗證**：

- Read strava spec，確認 `stravaTokens` client read/write 都是 deny。
- 重跑 AC-T27.4 / AC-T27.5。
- 對照 `firestore.rules:108-123`，確認 expectations 正確。
- 在 §3 T27 reviewer 欄簽名 + 命令輸出。

---

### T28 — Critical paths: events seat consistency + participants cascade

- **Status**: `[ ]`
- **Files Written**: `tests/server/rules/events.rules.test.js`、`handoff.md` §3 T28 row
- **Audit**: P0-2 critical paths 3-4 / rules L150-L185
- **Dependencies**: T25 `[x]`
- **Parallel**: 可與 T26 / T27 / T29 / T30 平行

**Engineer Action**：

覆蓋 events 兩條 critical path：

- seat consistency：
  - non-host update only `remainingSeats` + `participantsCount` with non-negative numbers and sum == `maxParticipants` succeeds
  - oversell / negative count / sum mismatch fails
  - non-host updating title or unrelated fields fails
  - host lowering `maxParticipants` below current `participantsCount` fails
  - host setting `maxParticipants >= participantsCount` succeeds
- participants cascade：
  - participant can create own participant doc with matching uid/eventId/name/photoURL
  - forged participant uid fails
  - participant can delete self
  - host can delete any participant under own event
  - unrelated user cannot delete participant
  - participant update always fails

**Acceptance Criteria**：

- **AC-T28.1**: Spec 至少 12 個 cases，seat consistency 與 participants cascade 都有 allow + deny。
- **AC-T28.2**: Seat update tests 明確驗 `remainingSeats + participantsCount == maxParticipants`。
- **AC-T28.3**: Participants delete tests 同時覆蓋 self delete、host cascade delete、unrelated deny。
- **AC-T28.4**: Targeted test pass：
  ```bash
  npm run test:server -- tests/server/rules/events.rules.test.js
  ```
- **AC-T28.5**: Targeted lint pass：
  ```bash
  npx eslint tests/server/rules/events.rules.test.js
  ```
- **AC-T28.6**: 不改 `firestore.rules`。

**Reviewer 驗證**：

- Read events spec，確認兩條 critical path 都不是只測 happy path。
- 重跑 AC-T28.4 / AC-T28.5。
- 對照 `firestore.rules:150-185`，確認 expectations 正確。
- 在 §3 T28 reviewer 欄簽名 + 命令輸出。

---

### T29 — Critical path: notification recipient / read / update rules

- **Status**: `[ ]`
- **Files Written**: `tests/server/rules/notifications.rules.test.js`、`handoff.md` §3 T29 row
- **Audit**: P0-2 critical path 5 / rules L233-L257
- **Dependencies**: T25 `[x]`
- **Parallel**: 可與 T26 / T27 / T28 / T30 平行

**Engineer Action**：

覆蓋 notifications：

- create succeeds when signed-in actor sets `actorUid === auth.uid`, `recipientUid` is another user, allowed `type`, `read: false`, `createdAt: serverTimestamp()`
- create fails when unauthenticated
- create fails when `recipientUid === auth.uid`
- create fails when `actorUid !== auth.uid`
- create fails when `type` is not allowlisted
- create fails when `read !== false`
- create fails when `createdAt` is a fixed timestamp instead of request time
- recipient can read own notification; actor / unrelated / unauth cannot read
- recipient can update only `read`; recipient cannot mutate `recipientUid` / `type` / `actorUid`
- actor / unrelated cannot update; delete always fails

**Acceptance Criteria**：

- **AC-T29.1**: Spec 至少 12 個 cases，create/read/update/delete 都有 coverage。
- **AC-T29.2**: Valid create 使用 Firestore client `serverTimestamp()` 或等效 request-time transform；fixed timestamp 必須有 deny case。
- **AC-T29.3**: Evidence 明確記錄：現行 rules 允許 actor 對任意非自己的 recipient 建通知；若 reviewer/engineer 認為這是安全問題，標為 follow-up，不在 S5 改 rules。
- **AC-T29.4**: Targeted test pass：
  ```bash
  npm run test:server -- tests/server/rules/notifications.rules.test.js
  ```
- **AC-T29.5**: Targeted lint pass：
  ```bash
  npx eslint tests/server/rules/notifications.rules.test.js
  ```
- **AC-T29.6**: 不改 `firestore.rules`。

**Reviewer 驗證**：

- Read notifications spec，確認 actorUid / recipientUid / type / read / createdAt 都有 deny path。
- 重跑 AC-T29.4 / AC-T29.5。
- 對照 `firestore.rules:233-257`，確認沒有把 audit wording 當成未經確認的 expected behavior。
- 在 §3 T29 reviewer 欄簽名 + 命令輸出。

---

### T30 — Workflow: firestore-rules-gate.yml paths-filter

- **Status**: `[ ]`
- **Files Written**: `.github/workflows/firestore-rules-gate.yml`、`handoff.md` §3 T30 row
- **Audit**: R9 / audit L538-L544 / L614-L620
- **Dependencies**: T24 `[x]`
- **Parallel**: 可與 T26 / T27 / T28 / T29 平行

**Engineer Action**：

新增 workflow：

- name：`Firestore Rules Gate`
- events：`pull_request` to `main` + `push` to `main`
- paths：
  - `firestore.rules`
  - `tests/server/rules/**`
  - `package.json`
  - `package-lock.json`
  - `.github/workflows/firestore-rules-gate.yml`
- job id：`firestore-rules-gate`
- steps：checkout、setup-java 21、setup-node `.nvmrc` + npm cache、`npm ci`、install firebase-tools、run rules tests
- test command：
  ```bash
  npm run test:server -- tests/server/rules
  ```
- 不需要 secrets；使用 `demo-test` emulator project。

**Acceptance Criteria**：

- **AC-T30.1**: Workflow file exists at `.github/workflows/firestore-rules-gate.yml`。
- **AC-T30.2**: `on.pull_request.paths` 與 `on.push.paths` 都包含 5 個指定 path pattern。
- **AC-T30.3**: Job 使用 Java 21 + Node `.nvmrc` + `npm ci` + firebase-tools。
- **AC-T30.4**: Job command 是 `npm run test:server -- tests/server/rules`，不是 full browser test。
- **AC-T30.5**: Workflow 不引用 repo secrets / production Firebase project。
- **AC-T30.6**: YAML 無 tab、無明顯 syntax typo；若 local 有 `actionlint`，必跑：
  ```bash
  if command -v actionlint >/dev/null; then actionlint .github/workflows/firestore-rules-gate.yml; else echo "actionlint unavailable"; fi
  ```
- **AC-T30.7**: 不改 `.github/workflows/ci.yml`（S5 新增獨立 gate，不重寫既有 CI）。

**Reviewer 驗證**：

- Read workflow 全檔。
- `grep -n` 逐項確認 paths、job id、setup-java、setup-node、firebase-tools、test command。
- 若有 `actionlint`，重跑 AC-T30.6；沒有則在 reviewer evidence 寫明 unavailable。
- 確認 `git diff .github/workflows/ci.yml` 為空。
- 在 §3 T30 reviewer 欄簽名 + 命令輸出。

---

### T31 — S5 integration verification + commit

- **Status**: `[ ]`
- **Files Written**:
  - `specs/026-tests-audit-report/handoff.md` §0 / §1 / §2 S5 risk / §3 T31 evidence / §5
  - `specs/026-tests-audit-report/tasks.md`（T23-T31 status `[ ]` → `[x]`）
- **Files committed**:
  - `package.json`
  - `package-lock.json`
  - `tests/server/rules/_helpers/rules-test-env.js`
  - `tests/server/rules/users.rules.test.js`
  - `tests/server/rules/posts.rules.test.js`
  - `tests/server/rules/strava.rules.test.js`
  - `tests/server/rules/events.rules.test.js`
  - `tests/server/rules/notifications.rules.test.js`
  - `.github/workflows/firestore-rules-gate.yml`
  - `specs/026-tests-audit-report/handoff.md`
  - `specs/026-tests-audit-report/tasks.md`
- **Dependencies**: T23-T30 全部 `[x]`

**Engineer Action**：

1. 確認 §3 T23-T30 全部 `rev-pass` + engineer/reviewer 雙簽。
2. 更新 `handoff.md`：
   - §0：S5 scope / T23-T31 狀態 / Last commit (S5) 留待 commit 後填
   - §1：S5 已完成工作 + 下一步指向 S6
   - §2：S5 risk 子表保留實際踩坑
   - §3：T31 evidence
   - §5：補 node/npm/firebase-tools/rules-unit-testing 版本
3. 更新 `tasks.md`：T23-T31 status `[ ]` → `[x]`。
4. 一次性重跑 S5 + repo gate（見 AC-T31.2）。
5. 明確列檔 stage（禁 `git add -A`）。
6. Commit（不 push）。

**Acceptance Criteria**：

- **AC-T31.1**: §3 T23-T30 全 `rev-pass`，`tasks.md` T23-T31 全 `[x]`。
- **AC-T31.2**: 一次性重跑：
  ```bash
  npm run test:server -- tests/server/rules
  npm run test:server
  npm run lint -- --max-warnings 0
  npm run type-check
  npm run depcruise
  npm run spellcheck
  npx vitest run --project=browser
  ```
  全部 exit 0；若 `npm run test:server` 因 emulator/tooling 失敗，必須根因修完，不可跳過。
- **AC-T31.3**: Workflow command dry-check：
  ```bash
  grep -n "npm run test:server -- tests/server/rules" .github/workflows/firestore-rules-gate.yml
  ```
- **AC-T31.4**: `git diff --name-only --cached` 僅包含 S5 files + `handoff.md` + `tasks.md`，不含 `firestore.rules`、`vitest.config.mjs`、`.github/workflows/ci.yml`。
- **AC-T31.5**: commit message 格式：
  ```text
  test(rules): add firestore rules gate and critical specs

  - install @firebase/rules-unit-testing
  - add rules emulator specs for users/posts/strava/events/notifications
  - cover five P0-2 critical paths with allow + deny cases
  - add firestore-rules-gate workflow with paths filter

  Refs: project-health/2026-04-29-tests-audit-report.md L113-141, L538-544, L614-620
  ```
  不加 `Co-Authored-By`。
- **AC-T31.6**: `git show HEAD --stat` 顯示 S5 預期檔案；`git show HEAD --name-only` 不含禁區檔。
- **AC-T31.7**: `git log -1 --format=%B | grep -ic "Co-Authored-By"` = 0。
- **AC-T31.8**: branch = `026-tests-audit-report`；不 push。

**Reviewer 驗證**：

- 重跑 AC-T31.2（接受耗時；這是 S5 final gate）。
- `git show HEAD --stat` + `git show HEAD --name-only` 確認檔案範圍。
- Read commit message，確認 refs + no co-author。
- Read `handoff.md` §0 / §1 / §2 S5 / §3 T23-T31 / §5。
- Read `tasks.md` 確認 T23-T31 全 `[x]`。
- `git log origin/026-tests-audit-report..HEAD 2>&1` 應顯示 ≥ 1 commit ahead（未 push）。
- 在 §3 T31 reviewer 欄簽名 + 命令輸出 + ≥ 5 行驗證結論。

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
| T16  | S4    | general-purpose        | general-purpose        | S4-1 | T17              |
| T17  | S4    | general-purpose        | general-purpose        | S4-1 | T16              |
| T18  | S4    | general-purpose        | general-purpose        | S4-2 | T19              |
| T19  | S4    | general-purpose        | general-purpose        | S4-2 | T18              |
| T20  | S4    | general-purpose        | general-purpose        | S4-3 | (none, 序列)     |
| T21  | S4    | general-purpose        | general-purpose        | S4-4 | (none, 序列)     |
| T22  | S4    | general-purpose        | general-purpose        | S4-5 | (none, 序列)     |
| T23  | S5    | general-purpose        | general-purpose        | S5-1 | (none, 序列)     |
| T24  | S5    | general-purpose        | general-purpose        | S5-2 | (none, 序列)     |
| T25  | S5    | general-purpose        | general-purpose        | S5-3 | (none, 序列)     |
| T26  | S5    | general-purpose        | general-purpose        | S5-4 | T27, T28, T29, T30 |
| T27  | S5    | general-purpose        | general-purpose        | S5-4 | T26, T28, T29, T30 |
| T28  | S5    | general-purpose        | general-purpose        | S5-4 | T26, T27, T29, T30 |
| T29  | S5    | general-purpose        | general-purpose        | S5-4 | T26, T27, T28, T30 |
| T30  | S5    | general-purpose        | general-purpose        | S5-4 | T26, T27, T28, T29 |
| T31  | S5    | general-purpose        | general-purpose        | S5-5 | (none, 序列)     |

## Subagent 通用須知

- **必看檔案**（spawn 時 attach 路徑）：
  - 本檔 `specs/026-tests-audit-report/tasks.md`
  - `specs/026-tests-audit-report/handoff.md`（特別是 §2 Must-Read Risks，含 S1 / S2 / S3 / S4 / S5 子表）
  - `project-health/2026-04-29-tests-audit-report.md`：
    - **S1 (T01-T05)**：L324-360 + L586-592
    - **S2 (T06-T09)**：L77-95 / L113-141 / L168-208 / L294-318 / L545-551 / L594-598 / L641-657
    - **S3 (T10-T15)**：L170-208 + L437-443 + L600-606 + L665-668
    - **S4 (T16-T22)**：L77-111 + L293-318 + L538-544 + L607-612 + L626-633 + L658-664
    - **S5 (T23-T31)**：L113-141 + L538-544 + L614-620
  - 對應的目標檔本身：
    - S1: 4 個 config 檔
    - S2: `.github/pull_request_template.md` + 必要時 `cspell.json`
    - S3: `vitest.config.mjs` + `docs/QUALITY_SCORE.md` + 必要時 `cspell.json`
    - S4: `scripts/audit-mock-boundary.sh`（新）+ `scripts/audit-flaky-patterns.sh`（新）+ `.husky/pre-commit`
    - S5: `firestore.rules`（Read-only）、`package.json`、`package-lock.json`、`tests/server/rules/**`、`.github/workflows/firestore-rules-gate.yml`

- **必要工具**：Read、Edit、Bash（跑驗證）、Write（engineer 建新檔用，reviewer 不該 Write 任何受審檔）

- **禁區**：
  - Reviewer 不能 Edit/Write 受審檔（S1: config 檔；S2: `.github/`、`cspell.json`；S3: `vitest.config.mjs`、`docs/QUALITY_SCORE.md`、`cspell.json`、`handoff.md` engineer evidence 區；S4: `scripts/audit-*.sh`、`.husky/pre-commit`、`handoff.md` engineer evidence 區；S5: `package*.json`、`tests/server/rules/**`、`.github/workflows/firestore-rules-gate.yml`、`handoff.md` engineer evidence 區）
  - Engineer 不能改 task scope 外的檔案（例：T01 不能動 playwright config；T07 不能動 cspell.json，加詞屬於 T08 範圍；T12 不能動 threshold；T14 不能改 service/repo/runtime/lib/config 既有 V8 Cov 數字；T16/T17 spike 不能寫 script 或改 husky；T18/T19 不能動 husky；T20 不能改 script；T20 對 husky 必須只 append、不刪改既有 5 行；T23 不能改 code/test/package；T26-T30 不能改 helper API；S5 全程不能改 `firestore.rules` / `vitest.config.mjs` / `.github/workflows/ci.yml`）
  - 任何 subagent 不能 push remote、不能開 PR、不能改 git config
  - **Commit-only task**：S1 只有 T05 engineer 可 commit；S2 只有 T09 engineer 可 commit；S3 只有 T15 engineer 可 commit；S4 只有 T22 engineer 可 commit；S5 只有 T31 engineer 可 commit；其他 task engineer 只改檔不 commit
  - **Threshold 紀律（S3 專屬）**：T13 發現 70 threshold 跌破時**禁止**自行降 threshold，必須 escalate（標 `[!]`）；T12-T14 任何 task **禁止**設 per-directory threshold（屬 S9 觸發型）
  - **Coverage artifact 紀律（S3 專屬）**：`coverage/` 為 gitignored，T15 commit 必須 `git status` 確認該目錄為 untracked，**禁** `git add -A` / `git add coverage`
  - **Warn-only 紀律（S4 專屬）**：T18/T19 script 末行必須 `exit 0`，**禁止**設 `exit 1` / `exit ${count}` 等真擋邏輯；T20 husky append 行必加 `|| true` 雙保險；T21 smoke test 即使 temp 檔在場 audit script 仍須 exit 0；S8 升級到 exit 1 屬觸發型，不在本 S4 scope
  - **Pattern 對齊紀律（S4 專屬）**：S4 兩 script 的 grep pattern 必須與 audit L626-633 / L629-630 給定的 S6 baseline 命令對齊，**禁止**「優化」pattern（含改 ERE/BRE、加排除、調語意）；對齊驗證在 T16/T17 spike 階段凍結，T18-T22 不可重新設計
  - **Smoke temp 檔紀律（S4 專屬）**：T21 故意建的 `tests/integration/_s4-smoke.test.jsx`（或同等 temp 檔）**必須在 T21 內 cleanup**；T22 commit 前再次驗 `git status --short | grep "_s4-smoke" | wc -l = 0`；commit 含 5 檔（不含任何 temp / log）
  - **Rules 行為紀律（S5 專屬）**：S5 是「測現行 rules + 補 CI gate」，不是修安全邏輯；遇到現行 rules 與 audit 期待衝突時，先在 `handoff.md` 記錄並 escalate，不准偷改 `firestore.rules`。
  - **Rules emulator 紀律（S5 專屬）**：rules tests 必須透過 `npm run test:server -- tests/server/rules/...` 跑 emulator；禁止用 mock 取代 emulator，禁止把 rules string 複製到 test。

- **Pre-commit hook 注意**：
  - `.husky/pre-commit` 會跑：lint --max-warnings 0、type-check、depcruise、spellcheck、vitest browser（**不**跑 coverage）
  - **S4 後**（T20 commit 起）：append 兩 audit warn 行（mock-boundary + flaky-pattern），warn-only `|| true`，不擋 chain
  - T05（S1）/ T09（S2）/ T15（S3）/ T22（S4）engineer 在 `git commit` 前先手動跑一次完整 gate，避免 hook 失敗
  - **S3 額外**：T15 commit 前還要手動跑 `npm run test:coverage`（hook 不跑，但 CI 會跑；先確認本地通過）
  - **S4 額外**：T22 commit 前手動跑兩 audit script + 確認 stdout 首行符合 `AUDIT <CATEGORY>: <N> findings` 樣板
  - **S5 額外**：T31 commit 前必跑 `npm run test:server -- tests/server/rules` + `npm run test:server`；這兩條不是 pre-commit hook 內容，但 rules gate/CI 會依賴。
  - hook 失敗時：fix issue → re-stage → 新 commit（**不要** `--amend`）

- **回報格式**（spawn 結束時的 result）：
  - Engineer：填 `handoff.md` §3 對應 task 的 engineer 欄；result 訊息列出 evidence 路徑（handoff §3 T0X row）
  - Reviewer：填 `handoff.md` §3 對應 task 的 reviewer 欄；result 訊息明確說「PASS」或「REJECT (AC-XXX failed: ...)」

---

## 後續 commit（不在本檔 scope）

本檔涵蓋 S1（T01-T05，已 commit `97e78d2`）、S2（T06-T09，已 commit `818e249`）、S3（T10-T15，已 commit `5f09820`）、S4（T16-T22，已 commit `a55fa76`）、S5（T23-T31，planned）。後續：

| Commit | Goal                                     | Spec            |
| ------ | ---------------------------------------- | --------------- |
| S1     | align test config defaults               | ✅ 本檔 T01-T05 |
| S2     | PR template + audit checkbox             | ✅ 本檔 T06-T09 |
| S3     | coverage include + baseline              | ✅ 本檔 T10-T15 |
| S4     | pre-commit grep gate (warn-only)         | ✅ 本檔 T16-T22 |
| S5     | firestore rules infra + 5 critical specs | ✅ 本檔 T23-T31 |
| S6     | ESLint mock-boundary + flaky rules       | (TBD)           |
| S7-S10 | (見 audit report §12)                    | (TBD)           |
