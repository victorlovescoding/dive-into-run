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

### T01 — vitest defaultProject

- **Status**: `[ ]`
- **File**: `vitest.config.mjs`
- **Audit**: P2-1 / Rule R3
- **Change**: 在 config object 頂層加 `defaultProject: 'browser'`
- **不可動**: `package.json:13` 的 `"test": "vitest"`（S1 章節指定走 vitest config 路線，不是 script 路線）

**Acceptance Criteria**：

- **AC-T01.1**: `git diff vitest.config.mjs` 只新增 `defaultProject: 'browser'` 一行（或同等最小 diff）；ESLint pass
- **AC-T01.2**: `npm test`（不帶 args）只跑 browser project，stdout 無 server project 啟動跡象、無 emulator missing error。執行命令：

  ```bash
  npm test 2>&1 | head -30
  ```

- **AC-T01.3**: `npm test -- --project=server` 顯式選 server project 仍能正確啟動（不破壞既有顯式選擇）
- **AC-T01.4**: pre-commit gate 全綠（`.husky/pre-commit` 自動執行：lint --max-warnings 0 / type-check / depcruise / spellcheck / vitest browser）

**Engineer Evidence**（貼到 `handoff.md` §3）：

- `git diff vitest.config.mjs` 完整輸出
- AC-T01.2 stdout 前 30 行

**Reviewer 驗證**：

- 重跑 AC-T01.2、貼新 stdout
- Read `vitest.config.mjs` 確認 `defaultProject: 'browser'` 在正確位置（config object 頂層，不在 projects 陣列裡）
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

| Task | Engineer subagent_type | Reviewer subagent_type | Wave | Concurrent peers |
| ---- | ---------------------- | ---------------------- | ---- | ---------------- |
| T01  | general-purpose        | general-purpose        | 1/2  | T02, T03, T04    |
| T02  | general-purpose        | general-purpose        | 1/2  | T01, T03, T04    |
| T03  | general-purpose        | general-purpose        | 1/2  | T01, T02, T04    |
| T04  | general-purpose        | general-purpose        | 1/2  | T01, T02, T03    |
| T05  | general-purpose        | general-purpose        | 3    | (none)           |

## Subagent 通用須知

- **必看檔案**（spawn 時 attach 路徑）：
  - 本檔 `specs/026-tests-audit-report/tasks.md`
  - `specs/026-tests-audit-report/handoff.md`（特別是 §2 Must-Read Risks）
  - `project-health/2026-04-29-tests-audit-report.md` L324-360 + L586-592
  - 對應的 config 檔本身

- **必要工具**：Read、Edit、Bash（跑驗證）、Write（只 engineer 為了補檔；reviewer 不該 Write 任何 config）

- **禁區**：
  - Reviewer 不能 Edit/Write config 檔（只能 Read + Bash 驗證）
  - Engineer 不能改 task scope 外的檔案（e.g. T01 engineer 不能動 playwright config）
  - 任何 subagent 不能 push remote、不能開 PR
  - commit 只能 T05 engineer 做（其他 task engineer 只改檔，不 commit）

- **Pre-commit hook 注意**：
  - `.husky/pre-commit` 會跑：lint --max-warnings 0、type-check、depcruise、spellcheck、vitest browser
  - T05 engineer 在 `git commit` 前先手動跑一次完整 gate，避免 hook 失敗
  - hook 失敗時：fix issue → re-stage → 新 commit（不要 `--amend`）

- **回報格式**（spawn 結束時的 result）：
  - Engineer：填 `handoff.md` §3 對應 task 的 engineer 欄；result 訊息列出 evidence 路徑（handoff §3）
  - Reviewer：填 `handoff.md` §3 對應 task 的 reviewer 欄；result 訊息明確說「PASS」或「REJECT (AC-XXX failed: ...)」

---

## 後續 commit（不在 S1 scope）

S1 是 audit report §12 的第 1 個 commit。後續：

| Commit | Goal                                     | Spec  |
| ------ | ---------------------------------------- | ----- |
| S2     | PR template + audit checkbox             | (TBD) |
| S3     | coverage include + baseline              | (TBD) |
| S4     | pre-commit grep gate (warn-only)         | (TBD) |
| S5     | firestore rules infra + 5 critical specs | (TBD) |
| S6     | ESLint mock-boundary + flaky rules       | (TBD) |
| S7-S10 | (見 audit report §12)                    | (TBD) |
