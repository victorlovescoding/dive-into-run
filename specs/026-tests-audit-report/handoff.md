# Handoff — 026 S1 (done) + S2 PR template (pending)

> **Live handoff**：T01-T05（S1）已完成；T06-T09（S2）進行中時 engineer + reviewer 共寫此檔；§0/§1/§3 隨進度更新。
> **Update rule**：本檔只放當前狀態 + 重要踩坑 + final evidence。長篇歷史日誌不放這裡。
> **S1 ≠ S2**：S1 evidence（T01-T05 + Evidence Detail）已凍結為歷史記錄，S2 任何 subagent **不可改 S1 evidence 區**；S2 只在 §0/§1/§3 T06-T09 列、§2 S2 子表、§3 T06-T09 Evidence Detail、§4 / §5 / §6 進行擴充。

## §0 Current State

| Field                            | Value                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Branch                           | `026-tests-audit-report`                                                                                                 |
| Worktree                         | `/Users/chentzuyu/Desktop/dive-into-run-026-tests-audit-report`                                                          |
| **S1** scope                     | **done — commit `97e78d2`**                                                                                              |
| T01 vitest 預設 project          | done (2nd attempt — package.json 路線，AC-T01.1/2/3 全 PASS)                                                             |
| T02 run-all-e2e.sh project ID    | done                                                                                                                     |
| T03 playwright.config timeout    | done                                                                                                                     |
| T04 playwright.emulator expect   | done                                                                                                                     |
| T05 verify + commit              | done                                                                                                                     |
| Last commit (S1)                 | `97e78d2` chore(config): align test config defaults (P2-1, P2-3, P2-5)（evidence 內早期 hash `a7b10f5` 為 amend 前快照） |
| **S2** scope                     | **pending — `.github/pull_request_template.md` (R11)**                                                                   |
| T06 spike: PR template 設計      | `pending`                                                                                                                |
| T07 PR template 草稿撰寫         | `pending`                                                                                                                |
| T08 spellcheck / pre-commit gate | `pending`                                                                                                                |
| T09 commit + handoff sync        | `pending`                                                                                                                |
| Last commit (S2)                 | (待 T09 填)                                                                                                              |

## §1 Next Session Checklist

> S1（T01-T05）已完成，commit `97e78d2`。S2（T06-T09）pending — 純文件 PR，新增 `.github/pull_request_template.md`。

**S2 進行中工作**（subagent 動，主 agent 不下手）：

- [ ] T06 Spike：`.github/` 現況 + 5 類 audit checkbox 草案 + skeleton 大綱（填 §3 T06 row，**不**動 `.github/`）
- [ ] T07 撰寫 `.github/pull_request_template.md`（≤ 200 行，5 個 H3 子節 ≥ 10 個 `- [ ]` checkbox）
- [ ] T08 spellcheck / lint / type-check / depcruise / vitest browser 全綠（必要時補 `cspell.json`，**禁** inline `cspell:disable`）
- [ ] T09 整合驗證 + commit `chore(github): add PR template with audit checklist (R11)` + handoff sync

**S1+S2 合併後（人類動作，不在 subagent scope）**：

- [ ] 開 PR：`026-tests-audit-report` → `main`，PR body 引用 §3 T01-T05 + T06-T09 evidence + audit L324-360（S1） + L594-598（S2）
- [ ] 等 GitHub protected-branch status checks（lint / test）綠 → merge → 刪 branch
- [ ] **S3 啟動**（新 spec 目錄 `specs/027-coverage-baseline/` 或同類命名）：依 audit L600-606 推進 coverage include + baseline (P0-4 / R1)，複用本 handoff pattern（§0/§1/§3/§5 live 共寫）

## §2 Must-Read Risks（已知踩坑 + subagent 增補）

### S1 Risks（保留 — 凍結為歷史）

| Risk                                                                    | Why it matters                                                                                                                                                                                                                                                                 | Action                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/run-all-e2e.sh` 改不只 L167                                    | L235-236 URL 也用 `dive-into-run`（audit P2-3 已確認）；只改 L167 殘留不一致，emulator UI 對不到正確 project                                                                                                                                                                   | T02 必須跑 `grep -n "dive-into-run" scripts/run-all-e2e.sh` 確認 0 hits                                                                                                                                                             |
| Playwright `expect.timeout` 統一 10_000，emulator `timeout` 60_000 不變 | audit 建議 `expect: { timeout: 10_000 }` 對齊；emulator 整體 test timeout 60_000 是 emulator 啟動時間考量，不能動                                                                                                                                                              | T03/T04 只動 `expect`，不動 `timeout`（emulator 的 60_000 必須保留）                                                                                                                                                                |
| vitest 預設 project 路線（已切換為 package.json script）                | audit P2-1 給兩條路徑：(a) 改 `package.json:13` `"test": "vitest --project=browser"` 或 (b) vitest config 加 `defaultProject`。**1st attempt 走 (b) 失敗**：vitest 4.1.4 無 `defaultProject` key（grep node_modules 0 hits、Context7 docs 無）；用戶 2026-04-29 批准切換為 (a) | T01 走 path (a)：只改 `package.json:13`，`vitest.config.mjs` 不動                                                                                                                                                                   |
| pre-commit hook 會擋 commit                                             | T05 commit 觸發 lint+type-check+depcruise+spellcheck+vitest browser；任一紅都擋                                                                                                                                                                                                | T05 在 `git commit` 前先本機跑一次 `npm run lint && npm run type-check && npm run depcruise && npm run spellcheck && npx vitest run --project=browser`，全綠才下 commit；hook 失敗時 fix → re-stage → **新 commit**（不 `--amend`） |
| zsh `status` 是 read-only                                               | shell script 中用 `status=$?` 會 read-only error，static expression 看不到                                                                                                                                                                                                     | reviewer 用 `eslint_status` / `vitest_status` 之類具體名稱接 `$?`                                                                                                                                                                   |
| `grep -c` 0 matches exits 1                                             | 看起來像命令掛掉，pipeline 中會吃 exit code                                                                                                                                                                                                                                    | 用 `grep -c ... \|\| true` 或 `grep ... \|\| echo "0 hits"` 包起來                                                                                                                                                                  |
| handoff.md 與 config 一起 commit                                        | T05 commit 必須 stage `specs/026-tests-audit-report/handoff.md` 跟 4 個 config 與 `tasks.md` 一起進                                                                                                                                                                            | T05 engineer `git status` 確認檔案清單後 `git add` 明確列出 6 檔，**不要用 `git add -A`**                                                                                                                                           |
| 主 agent 不能下手                                                       | 任何 Edit/Bash 修改/驗證/commit 都派 subagent；主 agent 違規 = 繞過 user 規則                                                                                                                                                                                                  | 主 agent 只 spawn subagent + 寫 tasks.md/handoff.md skeleton + 收 result                                                                                                                                                            |
| Reviewer 必須實際跑命令                                                 | 只看 engineer evidence 字串會錯失「engineer 貼舊輸出 / 改後沒重跑」的 bug                                                                                                                                                                                                      | Reviewer 在自己的 subagent session 內 Bash 跑 AC 命令，貼新輸出到 §3                                                                                                                                                                |
| Engineer commit 前先手動跑 gate                                         | pre-commit hook 失敗時 commit 沒進 git，但 staged 狀態還在；多次失敗會混淆                                                                                                                                                                                                     | 先手動跑完整 gate → 全綠 → `git commit` 一次過                                                                                                                                                                                      |

### S2 Risks（新增 — T06-T09 須讀）

| Risk                                                        | Why it matters                                                                                                                                                                            | Action                                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR template **不會**自動套用到本 PR                         | GitHub 先讀 base branch (main) 的 `.github/pull_request_template.md`；本 PR 的 template 在 main 還不存在，本 PR description 必須**手寫**                                                  | T09 commit message body 提醒；S2 PR description 也要手寫含 audit checklist（手動 paste），不要期待 GitHub auto-fill                                   |
| 檔名大小寫錯會 silently 失效                                | GitHub 接受 `pull_request_template.md`（小寫）與 `PULL_REQUEST_TEMPLATE.md`（全大寫），但**不認** `pr_template.md` / `PR_template.md` 等變體                                              | 一律用 `.github/pull_request_template.md`（小寫）；T06 spike 必須在 §3 註明此決議                                                                     |
| `vi.mock` / `toHaveBeenCalledTimes` 等技術詞可能觸發 cSpell | PR template 引用 audit 中的 anti-pattern symbol，cSpell 字典若未收錄會 fail spellcheck；inline `cspell:disable` 違反 sensors.md / coding-rules.md                                         | T08 跑 spellcheck 失敗時：domain term 加進 `cspell.json` / typo 改 template；**禁止** inline `cspell:disable`，違者 reviewer 必 reject                |
| Markdown checkbox `- [ ]` 必須有空格                        | `- [ ]`（含空格）才是 GitHub 認可的 unchecked；`-[ ]` / `- []` / `* [ ]` 不會 render 成 checkbox                                                                                          | T07 用 `grep -c "^- \[ \]"` 計數 ≥ 10 驗證格式；reviewer 必須重跑此 grep                                                                              |
| Audit IDs 必須對應到 audit report 真實行號                  | T06 設計時若引用錯 audit ID（例 P0-3 vs P0-4），後續 reviewer 對照失敗、checkbox 變廢                                                                                                     | T06 engineer 在 §3 T06 evidence 標出 file:line（例 `L77-95`）；reviewer 必須 Read audit report 對應行確認                                             |
| S2 commit 不能擾動 S1 evidence                              | §3 T01-T05 row + Evidence Detail 已凍結為 S1 歷史；T09 commit 動到這些區會造成 S1 與 S2 紀錄混淆                                                                                          | T09 engineer 只動 §0 / §1 / §3 T06-T09 row + Detail / §5 / §6；不可改 §3 T01-T05 任何字元                                                             |
| GitHub PR template 行尾不可有 trailing whitespace           | trailing whitespace 在 GitHub UI 雖不影響顯示，但會被部分 markdown linter 標 warn；本專案 ESLint 不檢 markdown trailing whitespace，但仍建議乾淨                                          | T07 engineer 用 `grep -nE " +$" .github/pull_request_template.md` 自查 0 hits（非強制 AC，預警用）                                                    |
| 主 agent commit 邊界                                        | 「主 agent 不下手任何實作」適用於 S2 task 內容（改 `.github/`、跑 npm script、加 cspell 詞）；但「分配任務本身」（更新 tasks.md / handoff.md skeleton 並 commit docs）屬主 agent 合法工作 | 主 agent 可以 commit `docs(spec): ...` 類型的 spec/handoff 變動；**不可** commit `chore(github): ...` 類型的 S2 實作，後者由 T09 engineer subagent 做 |

> Engineer 完成 task → 填 engineer 欄 + Eng evidence；Reviewer 驗收 → 填 reviewer 欄 + Rev evidence。
> Status: `pending` / `eng-done` / `rev-pass` / `rev-reject (Nth attempt)` / `escalated`

| Task | Status                 | Engineer            | Eng evidence (excerpt)                                                                                                                                                                                                         | Reviewer                                   | Rev evidence (excerpt)                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01  | rev-pass (2nd attempt) | T01-engineer-opus47 | 2nd attempt: package.json L13 `vitest` → `vitest --project=browser`；vitest.config.mjs reverted；AC-T01.1/2/3 全 PASS（121 files / 1108 tests browser-only；server explicit 仍可啟動）                                         | T01-reviewer-opus47 / 2026-04-29T16:03 CST | git diff vitest.config.mjs 空；package.json diff 僅 L13；npm test → 121 files / 1108 tests browser-only（無 \|server\| 標籤、無 emulator missing）；npm test -- --project=server 把 server project 加入並命中 emulator guard（預期），AC-T01.1/2/3 全 PASS                                                                                                                                                                |
| T02  | rev-pass               | T02-engineer        | L167 `--project=demo-test` + L235-236 URL `demo-test`; grep 0 hits; `bash -n` syntax OK                                                                                                                                        | T02-reviewer / 2026-04-29T00:00:00Z        | grep 0 hits; `bash -n` syntax OK; git diff 僅 3 行 (L167/L235/L236)；L167 採等號形式                                                                                                                                                                                                                                                                                                                                      |
| T03  | rev-pass               | T03-engineer        | timeout:30000 / expect.timeout:10000 確認；playwright list 56 tests OK                                                                                                                                                         | T03-reviewer-opus47 / 2026-04-29           | AC-T03.1/2 重跑均 PASS；config 頂層含 `timeout: 30_000` + `expect: { timeout: 10_000 }`（不在 projects 陣列內）；diff 僅 +2 行                                                                                                                                                                                                                                                                                            |
| T04  | rev-pass               | T04-engineer        | 加 `expect: { timeout: 10_000 }` L64；timeout: 60000 保留；node import → `{"t":60000,"e":{"timeout":10000}}`；playwright --list 56 tests                                                                                       | T04-reviewer / 2026-04-29                  | git diff 僅 +1 行 (L64 `expect: { timeout: 10_000 }`)；timeout: 60000 完整保留；AC-T04.1 `{"t":60000,"e":{"timeout":10000}}`；AC-T04.2 `Total: 56 tests in 11 files`                                                                                                                                                                                                                                                      |
| T05  | rev-pass               | T05-engineer-opus47 | AC-T05.2 全 PASS (npm test 121f/1108t；grep 0 hits；playwright `{t:30000,e:{timeout:10000}}`；emulator `{t:60000,e:{timeout:10000}}`)；pre-commit gate 預跑全綠（lint / type-check / depcruise / spellcheck / vitest browser） | T05-reviewer / 2026-04-29T16:14 CST        | Re-ran AC-T05.2 全部命令獨立驗證：npm test 121 files / 1108 tests browser-only；`grep -rn "dive-into-run" scripts/` → 0 hits；playwright.config → `{"t":30000,"e":{"timeout":10000}}`；playwright.emulator → `{"t":60000,"e":{"timeout":10000}}`。`git show a7b10f5 --stat` 6 檔；commit message body `grep -ic Co-Authored-By` → 0；`origin/026-tests-audit-report` 不存在（未 push，符合 AC-T05.4）。§0/§1/§3/§5 完整。 |
| T06  | `pending`              | (待填)              | (待填)                                                                                                                                                                                                                         | (待填)                                     | (待填)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| T07  | `pending`              | (待填)              | (待填)                                                                                                                                                                                                                         | (待填)                                     | (待填)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| T08  | `pending`              | (待填)              | (待填)                                                                                                                                                                                                                         | (待填)                                     | (待填)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| T09  | `pending`              | (待填)              | (待填)                                                                                                                                                                                                                         | (待填)                                     | (待填)                                                                                                                                                                                                                                                                                                                                                                                                                    |

### T01 Evidence Detail

> Engineer/Reviewer 在此貼完整 git diff、命令 stdout、時間戳。

#### 1st attempt 結論摘要（已 superseded）

**Engineer**: T01-engineer-opus47 / **Timestamp**: 2026-04-29 15:46:39 CST / **Status**: BLOCKED → superseded

走 task spec 原本指定的 config 路線（`vitest.config.mjs` 加 `defaultProject: 'browser'`），AC-T01.2 失敗：vitest 4.1.4 silently ignore 此 key，server project 仍被 default run。獨立 subagent 交叉驗證確認 vitest 4.1.4 / @vitest/\* 的 source 與官方 docs 都無 `defaultProject`（`grep -rn defaultProject node_modules/vitest node_modules/@vitest` 0 hits、Context7 `/vitest-dev/vitest` 查無）。用戶 2026-04-29 批准切換為 audit P2-1 path (a)：改 `package.json:13`。

#### 2nd attempt（current — eng-done）

**Engineer**: T01-engineer-opus47 (2nd attempt) / **Timestamp**: 2026-04-29 15:58–15:59 CST / **Status**: **eng-done — AC-T01.1/2/3 全 PASS**

#### 1. `git diff vitest.config.mjs` (revert verification)

空 diff — 1st attempt 的 `defaultProject` 已用 Edit 工具還原（hook 阻擋 `git checkout --` / `git restore`，改用手動 Edit 移除該行）。

#### 2. `git diff package.json` (AC-T01.1)

```diff
diff --git a/package.json b/package.json
index d195ee8..29b9fab 100644
--- a/package.json
+++ b/package.json
@@ -10,7 +10,7 @@
     "lint:changed": "bash scripts/lint-changed.sh",
     "depcruise": "depcruise --config .dependency-cruiser.mjs --output-type err-long src specs tests",
     "depcruise:json": "depcruise --config .dependency-cruiser.mjs --output-type json src specs tests",
-    "test": "vitest",
+    "test": "vitest --project=browser",
     "test:browser": "vitest --project=browser",
```

**✅ AC-T01.1 PASS** — 最小 diff，只新增 `--project=browser`。

#### 3. `npm test 2>&1 | head -40` (AC-T01.2)

```
> dive-into-run@0.1.0 test
> vitest --project=browser


 RUN  v4.1.4 /Users/chentzuyu/Desktop/dive-into-run-026-tests-audit-report

Not implemented: Window's scrollTo() method

 Test Files  121 passed (121)
      Tests  1108 passed (1108)
   Start at  15:58:28
   Duration  30.07s (transform 6.08s, setup 16.62s, import 31.88s, tests 66.47s, environment 123.16s)
```

**✅ AC-T01.2 PASS** — stdout 完全沒有 `|server|` 標籤、無 emulator missing error；只跑 121 browser test files / 1108 tests。

#### 4. `npx vitest --project=server --run` (AC-T01.3)

```
 RUN  v4.1.4 /Users/chentzuyu/Desktop/dive-into-run-026-tests-audit-report

 ❯ |server| tests/server/g8-server-coverage/unit/firebase-admin.test.js (0 test)
 ❯ |server| tests/server/g8-server-coverage/unit/firebase-profile-server.test.js (0 test)
Error: Server tests require Firebase Emulator. Run via `npm run test:server` or `npm run test:coverage` ...
```

**✅ AC-T01.3 PASS** — 顯式選 server project 仍能正常 resolve & boot；後續 emulator missing 是預期 guard（本機沒開 emulator），不是 config 解析問題。

#### 5. Notes

- `vitest.config.mjs` 已 revert 到 main（0 diff）。
- 唯一 production-affecting diff：`package.json:13`。
- **未 commit、未 push**。等待 reviewer 驗證。

#### Reviewer 驗收（rev-pass）

**Reviewer**: T01-reviewer-opus47
**Timestamp**: 2026-04-29 16:03 CST
**Status**: rev-pass

**Read 檔案結構驗證**：

- `package.json:13` = `"test": "vitest --project=browser"` ✅
- `vitest.config.mjs` 無 `defaultProject` key（已從 1st attempt revert）✅

**`git diff vitest.config.mjs` 重跑**：空（0 行 diff）— revert 完整。

**`git diff package.json` 重跑**：

```diff
@@ -10,7 +10,7 @@
-    "test": "vitest",
+    "test": "vitest --project=browser",
```

最小 diff，僅 L13。

**AC-T01.2 重跑** — `npm test 2>&1 | head -30`：

```
> dive-into-run@0.1.0 test
> vitest --project=browser

 RUN  v4.1.4 /Users/chentzuyu/Desktop/dive-into-run-026-tests-audit-report

 Test Files  121 passed (121)
      Tests  1108 passed (1108)
   Duration  34.86s
```

stdout 無 `|server|` 標籤、無 `Server tests require Firebase Emulator`，**PASS**。

**AC-T01.3 重跑** — `npm test -- --project=server 2>&1 | head -10`：

```
> vitest --project=browser --project=server
 RUN  v4.1.4 ...
 ❯ |server| tests/server/g8-server-coverage/unit/firebase-admin.test.js (0 test)
 ❯ |server| tests/server/g8-server-coverage/unit/firebase-profile-server.test.js (0 test)
Error: Server tests require Firebase Emulator. Run via `npm run test:server` ...
```

CLI flag append（browser + server 同跑），server project resolve 與 boot 正常；後續 emulator missing 是 `vitest.setup.server.js:13` 的預期 guard，不是 config 解析問題。本機未開 emulator 屬正常結果，**PASS**（顯式選 server 仍能啟動，不破壞既有顯式選擇之 AC 意圖）。

**結論**：T01 AC-T01.1 / AC-T01.2 / AC-T01.3 全 PASS，rev-pass。AC-T01.4 pre-commit gate 由 T05 統一驗證。

### T02 Evidence Detail

**Engineer**: T02-engineer
**Timestamp (UTC)**: 2026-04-29T07:47:35Z
**Status**: eng-done

**git diff scripts/run-all-e2e.sh**:

```diff
diff --git a/scripts/run-all-e2e.sh b/scripts/run-all-e2e.sh
index 99b95df..674be16 100755
--- a/scripts/run-all-e2e.sh
+++ b/scripts/run-all-e2e.sh
@@ -164,7 +164,7 @@ validate_plan
 # ---------------------------------------------------------------------------
 # 1. Start Firebase Emulator
 # ---------------------------------------------------------------------------
-firebase emulators:start --only auth,firestore,storage --project dive-into-run &
+firebase emulators:start --only auth,firestore,storage --project=demo-test &
 EMULATOR_PID=$!

 echo "Waiting for Firebase Emulator..."
@@ -232,8 +232,8 @@ EOF

   # Reset emulator state before each feature (wait for completion)
   echo "Resetting emulator state..."
-  auth_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:9099/emulator/v1/projects/dive-into-run/accounts")
-  fs_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:8080/emulator/v1/projects/dive-into-run/databases/(default)/documents")
+  auth_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:9099/emulator/v1/projects/demo-test/accounts")
+  fs_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:8080/emulator/v1/projects/demo-test/databases/(default)/documents")
   if [ "$auth_status" != "200" ]; then echo "  Warning: Auth cleanup returned $auth_status"; fi
   if [ "$fs_status" != "200" ]; then echo "  Warning: Firestore cleanup returned $fs_status"; fi
   sleep 1  # Let emulator finish internal cleanup
```

**AC-T02.1** — `grep -n "dive-into-run" scripts/run-all-e2e.sh || echo "0 hits (expected)"`:

```
0 hits (expected)
```

PASS — 檔案中已無 `dive-into-run`。

**AC-T02.2** — L167 採用等號形式 `--project=demo-test`，與 `package.json:15-17` (`test:server` / `test:coverage`) 寫法統一。git diff 已可見。

**AC-T02.3** — `bash -n scripts/run-all-e2e.sh && echo "syntax OK"`:

```
syntax OK
```

PASS — shell 語法檢查通過。

**AC-T02.4** — pre-commit gate 由 T05 整合驗證階段統一執行，本 task scope 不 commit。

---

**Reviewer**: T02-reviewer
**Timestamp**: 2026-04-29T00:00:00Z
**Status**: rev-pass

**Re-run AC-T02.1** — `grep -n "dive-into-run" scripts/run-all-e2e.sh || echo "0 hits (expected)"`:

```
0 hits (expected)
```

PASS。

**Re-run AC-T02.3** — `bash -n scripts/run-all-e2e.sh && echo "syntax OK"`:

```
syntax OK
```

PASS。

**git diff scripts/run-all-e2e.sh** — 確認只動 3 行 (L167 emulator start + L235/L236 reset URL)，全部從 `dive-into-run` 改成 `demo-test`，L167 採等號形式 `--project=demo-test` 與 `package.json` `test:server` / `test:coverage` 寫法一致。

**AC-T02.2** — L167 等號形式已驗證，PASS。
**AC-T02.4** — out of scope（T05 整合）。

結論：T02 全部 AC PASS，rev-pass。

### T03 Evidence Detail

**Engineer**: T03-engineer
**Timestamp**: 2026-04-29
**Status**: eng-done

**git diff playwright.config.mjs**:

```diff
diff --git a/playwright.config.mjs b/playwright.config.mjs
index a5315dc..af03d0c 100644
--- a/playwright.config.mjs
+++ b/playwright.config.mjs
@@ -6,6 +6,8 @@ dotenv.config();
 export default defineConfig({
   testDir: './tests/e2e',
   testMatch: '**/*.spec.js',
+  timeout: 30_000,
+  expect: { timeout: 10_000 },
   fullyParallel: true,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
```

**AC-T03.1** — `node -e "import('./playwright.config.mjs')..."`:

```
[dotenv@17.3.1] injecting env (15) from .env -- tip: ⚙️  suppress all logs with { quiet: true }
{"t":30000,"e":{"timeout":10000}}
```

含 `"t":30000` 與 `"timeout":10000`，PASS。

**AC-T03.2** — `npx playwright test --list 2>&1 | tail -5`:

```
  [chromium] › weather-page.spec.js:54:7 › Weather Page E2E › should display weather after clicking a county on the map
  [chromium] › weather-page.spec.js:61:7 › Weather Page E2E › should show BackToOverview button after drill-down
  [chromium] › weather-page.spec.js:68:7 › Weather Page E2E › should return to overview when clicking BackToOverview
  [chromium] › weather-page.spec.js:79:7 › Weather Page E2E › should update URL params on location selection
Total: 56 tests in 11 files
```

無 error / SyntaxError / config validation 錯誤，PASS。

#### Reviewer 驗收（rev-pass）

**Reviewer**: T03-reviewer-opus47
**Timestamp**: 2026-04-29 CST
**Status**: rev-pass

**Read `playwright.config.mjs` 結構驗證**：`timeout: 30_000` (L9) 與 `expect: { timeout: 10_000 }` (L10) 位於 `defineConfig({...})` 頂層，**不在** `projects` 陣列 (L20-25) 內 — 結構正確。

**AC-T03.1 重跑**：

```
[dotenv@17.3.1] injecting env (15) from .env -- tip: ⚙️  enable debug logging with { debug: true }
{"t":30000,"e":{"timeout":10000}}
```

含 `"t":30000` 與 `"timeout":10000`，**PASS**。

**AC-T03.2 重跑**：

```
  [chromium] › weather-page.spec.js:54:7 › Weather Page E2E › should display weather after clicking a county on the map
  [chromium] › weather-page.spec.js:61:7 › Weather Page E2E › should show BackToOverview button after drill-down
  [chromium] › weather-page.spec.js:68:7 › Weather Page E2E › should return to overview when clicking BackToOverview
  [chromium] › weather-page.spec.js:79:7 › Weather Page E2E › should update URL params on location selection
Total: 56 tests in 11 files
```

無 error / SyntaxError / config validation 錯誤，**PASS**。

**git diff playwright.config.mjs（reviewer 重抓）**：

```diff
diff --git a/playwright.config.mjs b/playwright.config.mjs
index a5315dc..af03d0c 100644
--- a/playwright.config.mjs
+++ b/playwright.config.mjs
@@ -6,6 +6,8 @@ dotenv.config();
 export default defineConfig({
   testDir: './tests/e2e',
   testMatch: '**/*.spec.js',
+  timeout: 30_000,
+  expect: { timeout: 10_000 },
   fullyParallel: true,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
```

最小 diff（+2 行），無其他附帶改動。AC-T03.3 pre-commit gate 由 T05 統一執行。

### T04 Evidence Detail

**Engineer**: T04-engineer
**Timestamp**: 2026-04-29
**Status**: eng-done

**git diff playwright.emulator.config.mjs**:

```diff
diff --git a/playwright.emulator.config.mjs b/playwright.emulator.config.mjs
index ad4b816..8b1b111 100644
--- a/playwright.emulator.config.mjs
+++ b/playwright.emulator.config.mjs
@@ -61,6 +61,7 @@ export default defineConfig({
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 1 : 0,
   timeout: 60000,
+  expect: { timeout: 10_000 },
   reporter: 'html',
   globalSetup: globalSetupPath,
   use: {
```

L63 `timeout: 60000` 完整保留（emulator 啟動時間考量，不可動）。

**AC-T04.1** — `node -e "import('./playwright.emulator.config.mjs').then(m=>console.log(JSON.stringify({t:m.default.timeout,e:m.default.expect})))"`:

```
[dotenv@17.3.1] injecting env (15) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }
{"t":60000,"e":{"timeout":10000}}
```

含 `"t":60000`（保留原值）與 `"timeout":10000`（新加 expect.timeout），PASS。

**AC-T04.2** — `npx playwright test --config playwright.emulator.config.mjs --list 2>&1 | tail -5`:

```
  [chromium] › weather-page.spec.js:54:7 › Weather Page E2E › should display weather after clicking a county on the map
  [chromium] › weather-page.spec.js:61:7 › Weather Page E2E › should show BackToOverview button after drill-down
  [chromium] › weather-page.spec.js:68:7 › Weather Page E2E › should return to overview when clicking BackToOverview
  [chromium] › weather-page.spec.js:79:7 › Weather Page E2E › should update URL params on location selection
Total: 56 tests in 11 files
```

config 載入無錯，PASS。

**AC-T04.3** pre-commit gate：留待 T05 整合驗證。

---

**Reviewer**: T04-reviewer
**Timestamp**: 2026-04-29
**Status**: rev-pass

**1. config 檢查 (Read playwright.emulator.config.mjs L60-65)**:

```
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 10_000 },
  reporter: 'html',
```

L63 `timeout: 60000` 完整保留，L64 新加 `expect: { timeout: 10_000 }`。

**2. AC-T04.1 重跑 stdout**:

```
[dotenv@17.3.1] injecting env (15) from .env -- tip: 🤖 agentic secret storage: https://dotenvx.com/as2
{"t":60000,"e":{"timeout":10000}}
```

含 `"t":60000` 與 `"timeout":10000`，**PASS**。

**3. AC-T04.2 重跑 stdout (tail -5)**:

```
  [chromium] › weather-page.spec.js:54:7 › Weather Page E2E › should display weather after clicking a county on the map
  [chromium] › weather-page.spec.js:61:7 › Weather Page E2E › should show BackToOverview button after drill-down
  [chromium] › weather-page.spec.js:68:7 › Weather Page E2E › should return to overview when clicking BackToOverview
  [chromium] › weather-page.spec.js:79:7 › Weather Page E2E › should update URL params on location selection
Total: 56 tests in 11 files
```

config 載入無錯、test list 正常，**PASS**。

**4. `git diff playwright.emulator.config.mjs`**:

```diff
diff --git a/playwright.emulator.config.mjs b/playwright.emulator.config.mjs
index ad4b816..8b1b111 100644
--- a/playwright.emulator.config.mjs
+++ b/playwright.emulator.config.mjs
@@ -61,6 +61,7 @@ export default defineConfig({
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 1 : 0,
   timeout: 60000,
+  expect: { timeout: 10_000 },
   reporter: 'html',
   globalSetup: globalSetupPath,
   use: {
```

僅 +1 行純 additive，timeout: 60000 未動，符合 §2 risk「emulator 60_000 不能動」要求。

**結論**: AC-T04.1 / AC-T04.2 全 PASS，T04 rev-pass。

### T05 Evidence Detail

**Engineer**: T05-engineer-opus47
**Timestamp**: 2026-04-29 CST
**Status**: eng-done

#### AC-T05.2 — 一次性重跑全 acceptance

**1. `npm test 2>&1 | head -30`**

```
> dive-into-run@0.1.0 test
> vitest --project=browser

 RUN  v4.1.4 /Users/chentzuyu/Desktop/dive-into-run-026-tests-audit-report

Not implemented: Window's scrollTo() method

 Test Files  121 passed (121)
      Tests  1108 passed (1108)
   Start at  16:07:20
   Duration  32.10s (transform 6.73s, setup 18.04s, import 35.21s, tests 70.59s, environment 131.51s)
```

只跑 121 browser test files / 1108 tests，無 `|server|` 標籤、無 emulator missing。**PASS**

**2. `grep -rn "dive-into-run" scripts/ || echo "0 hits (expected)"`**

```
0 hits (expected)
```

**PASS**

**3. `node -e "import('./playwright.config.mjs')..."`**

```
{"t":30000,"e":{"timeout":10000}}
```

**PASS**

**4. `node -e "import('./playwright.emulator.config.mjs')..."`**

```
{"t":60000,"e":{"timeout":10000}}
```

`t:60000` 保留、`expect.timeout:10000` 新加。**PASS**

#### Pre-commit Gate 預跑（避免 hook 失敗）

| 命令                               | 結果                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `npm run lint -- --max-warnings 0` | 0 errors / 0 warnings                                                        |
| `npm run type-check`               | 0 errors                                                                     |
| `npm run depcruise`                | `✔ no dependency violations found (1379 modules, 3403 dependencies cruised)` |
| `npm run spellcheck`               | `CSpell: Files checked: 353, Issues found: 0 in 0 files.`                    |
| `npx vitest run --project=browser` | 121 files / 1108 tests pass（已包含於 AC-T05.2 step 1）                      |

#### Commit 後驗證

**Commit hash**: `a7b10f5ba81ccddf09bbe7ba0ac2c7345a763e35`

**`git log -1 --format=fuller`**:

```
commit a7b10f5ba81ccddf09bbe7ba0ac2c7345a763e35
Author:     victorlovescoding <rifrigerator3204367@gmail.com>
AuthorDate: Wed Apr 29 16:11:03 2026 +0800
Commit:     victorlovescoding <rifrigerator3204367@gmail.com>
CommitDate: Wed Apr 29 16:11:03 2026 +0800

    chore(config): align test config defaults (P2-1, P2-3, P2-5)

    - package.json: scripts.test add --project=browser (vitest 4.1.4 has no defaultProject)
    - scripts/run-all-e2e.sh: dive-into-run → demo-test (L167, L235-236)
    - playwright.config.mjs: add timeout 30_000 + expect.timeout 10_000
    - playwright.emulator.config.mjs: add expect.timeout 10_000

    Refs: project-health/2026-04-29-tests-audit-report.md L324-360, L586-592
```

**`git show HEAD --stat`** (AC-T05.5 — 6 檔):

```
 package.json                            |   2 +-
 playwright.config.mjs                   |   2 +
 playwright.emulator.config.mjs          |   1 +
 scripts/run-all-e2e.sh                  |   6 +-
 specs/026-tests-audit-report/handoff.md | 538 +++++++++++++++++++++++++++++---
 specs/026-tests-audit-report/tasks.md   |  16 +-
 6 files changed, 514 insertions(+), 51 deletions(-)
```

**Co-Authored-By 檢查** — `git log -1 --format=%B | grep -i "co-authored"`:

```
0 hits in commit message body (expected)
```

無 Co-Authored-By 行（符合 user memory `feedback_no_coauthor`）。

**未 push**（branch 仍只在本機，符合 AC-T05.4）。

---

**Reviewer**: T05-reviewer
**Timestamp**: 2026-04-29T16:14 CST
**Status**: rev-pass

**1. Commit metadata 重驗**

```
commit a7b10f5ba81ccddf09bbe7ba0ac2c7345a763e35
AuthorDate: Wed Apr 29 16:11:03 2026 +0800

 package.json                            |   2 +-
 playwright.config.mjs                   |   2 +
 playwright.emulator.config.mjs          |   1 +
 scripts/run-all-e2e.sh                  |   6 +-
 specs/026-tests-audit-report/handoff.md | 538 +++++++++++++++++++++++++++++---
 specs/026-tests-audit-report/tasks.md   |  16 +-
 6 files changed, 514 insertions(+), 51 deletions(-)
```

6 檔符合 spec；`git log -1 --format=%B | grep -ic "Co-Authored-By"` → `0`（commit body 無 trailer，先前 grep 1 hit 是 handoff diff 內的字串）。

**2. AC-T05.2 reviewer 重跑 stdout 摘要**

- `npm test 2>&1 | head -40` → `Test Files 121 passed (121) / Tests 1108 passed (1108)`，browser-only，無 server/emulator 標籤。
- `grep -rn "dive-into-run" scripts/` → `0 hits (expected)`。
- `node -e "import('./playwright.config.mjs')..."` → `{"t":30000,"e":{"timeout":10000}}`。
- `node -e "import('./playwright.emulator.config.mjs')..."` → `{"t":60000,"e":{"timeout":10000}}`。

**3. Push 狀態**

`git remote -v` 顯示 `origin https://github.com/victorlovescoding/dive-into-run.git`；`git log origin/026-tests-audit-report..HEAD` → `fatal: ambiguous argument 'origin/026-tests-audit-report..HEAD'`，遠端無此 branch，符合 AC-T05.4「不 push」。

**4. handoff.md 完整性**

§0 T01-T05 全 done + Last commit hash `a7b10f5`；§1 Next Session Checklist 指向 S2；§3 T05 engineer 欄已填；§5 Environment 含 OS/Node/Vitest/Playwright 版本。

**結論**: AC-T05.1/2/3/4/5 全 PASS，T05 rev-pass。本次 reviewer 對 handoff.md 的修改未 commit（保留 uncommitted 由用戶決定是否 follow-up commit）。

### T06 Evidence Detail

> Engineer 貼三節：(1) `.github/` 現況快照（含 `ls -la .github/` + `find .github -type f` 輸出）、(2) 5 類 audit checkbox 草案（每類 ≥ 2 條 + 對應 audit ID + audit report file:line）、(3) Template skeleton 大綱（≥ Summary / Audit Checklist 兩節）。
> Reviewer 貼：Read audit report 對應行核對結果、檔名小寫決議確認、結論 ≥ 4 行。

(待 T06 engineer + reviewer 填寫)

### T07 Evidence Detail

> Engineer 貼：完整檔案內容（用 `~~~~` 四 tilde fence 外層包裝避免 markdown nested 衝突）、`git diff --stat` 輸出、AC-T07.1-T07.5 命令輸出。
> Reviewer 貼：重跑 AC-T07.1-T07.4 新輸出、對照 §3 T06 design draft 的核對結果、結論 ≥ 3 行。

(待 T07 engineer + reviewer 填寫)

### T08 Evidence Detail

> Engineer 貼：AC-T08.1-T08.5 全部命令輸出、cspell.json diff（若改動）或聲明無改動、若加詞列出加詞理由（domain term vs typo 的判斷）。
> Reviewer 貼：重跑 AC-T08.1（spellcheck）+ AC-T08.5（vitest browser）新輸出、cspell.json 對照結果、結論 ≥ 3 行。
> **Reject 條件**：engineer 加 inline `cspell:disable` 必 reject。

(待 T08 engineer + reviewer 填寫)

### T09 Evidence Detail

> Engineer 貼：AC-T09.2 全部命令輸出、`git log -1 --format=fuller`、`git show <hash> --stat`、AC-T09.6 grep 結果。
> Reviewer 貼：重跑 AC-T09.2、`git show <hash> --stat` 確認 3-4 檔、AC-T09.6 grep = 0、確認未 push、Read handoff §0/§1/§3/§5 完整、Read tasks.md 確認 T06-T09 全 `[x]`、結論 ≥ 5 行。

(待 T09 engineer + reviewer 填寫)

## §4 Pattern Index

> Subagent 在實作中發現的可重用 pattern（one-liner、技巧）填於此節，供後續 S3-S10 重用。

### S1 收集（已凍結，仍適用）

- **Vitest 4.1.4 無 `defaultProject` config key** — 想設「default 跑哪個 project」只能走 CLI flag (`vitest --project=browser`) 或 package.json script。Config 路線無效（silently ignored）。`grep -rn defaultProject node_modules/vitest node_modules/@vitest` 0 hits 可即時驗證。
- **`git checkout --` / `git restore` 被 pre-tool hook 攔** — `.claude/hooks/block-dangerous-commands.js` 把這兩個 destructive git pattern 標為高風險。Revert 單檔改用 Read + Edit 手動拆 +/- 行；或 `git stash` (尚未驗證是否被擋)。

### S2 新增（T06-T09 進行中由 subagent 填）

- (待 subagent 在 T06-T09 中填入新發現)

## §5 Environment

> T05 engineer 在做整合驗證時，跑下列命令並把版本號填入：
>
> ```bash
> node --version
> npx vitest --version
> npx playwright --version
> ```

| Tool       | Version        |
| ---------- | -------------- |
| OS         | darwin (macOS) |
| Node       | v22.22.0       |
| Vitest     | 4.1.4          |
| Playwright | 1.58.0         |

## §6 References

- [tasks.md](./tasks.md) — 完整任務分解 + AC + reviewer 配對（S1: T01-T05、S2: T06-T09）
- [audit report](../../project-health/2026-04-29-tests-audit-report.md)：
  - **S1 用**：L324-360（P2-1/3/5） + L586-592（S1 章節）
  - **S2 用**：L77-95（P0-1） + L113-141（P0-2） + L168-208（P0-4） + L294-318（P1-4/P1-5） + L545-551（R11） + L594-598（S2 章節） + L641-657（Baseline tracking）
- [S1 plan file](~/.claude/plans/2026-04-29-tests-audit-report-md-s1-ali-distributed-wren.md) — S1 implementation orchestration plan
