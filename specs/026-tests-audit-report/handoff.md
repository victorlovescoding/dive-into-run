# Handoff — 026 S1 align config defaults

> **Live handoff**：T01-T05 進行中時 engineer + reviewer 共寫此檔；§0/§1/§3 隨進度更新。
> **Update rule**：本檔只放當前狀態 + 重要踩坑 + final evidence。長篇歷史日誌不放這裡。

## §0 Current State

| Field                          | Value                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| Branch                         | `026-tests-audit-report`                                        |
| Worktree                       | `/Users/chentzuyu/Desktop/dive-into-run-026-tests-audit-report` |
| T01 vitest defaultProject      | _pending_                                                       |
| T02 run-all-e2e.sh project ID  | _pending_                                                       |
| T03 playwright.config timeout  | _pending_                                                       |
| T04 playwright.emulator expect | _pending_                                                       |
| T05 verify + commit            | _pending_                                                       |
| Last commit (S1)               | _filled by T05_                                                 |

## §1 Next Session Checklist

> T05 engineer 完成後填寫此節，指向後續 S2-S10 中下一個要做的 commit。

- [ ] _filled by T05_
- [ ] _filled by T05_

## §2 Must-Read Risks（已知踩坑 + subagent 增補）

| Risk                                                                    | Why it matters                                                                                                                                   | Action                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/run-all-e2e.sh` 改不只 L167                                    | L235-236 URL 也用 `dive-into-run`（audit P2-3 已確認）；只改 L167 殘留不一致，emulator UI 對不到正確 project                                     | T02 必須跑 `grep -n "dive-into-run" scripts/run-all-e2e.sh` 確認 0 hits                                                                                                                                                             |
| Playwright `expect.timeout` 統一 10_000，emulator `timeout` 60_000 不變 | audit 建議 `expect: { timeout: 10_000 }` 對齊；emulator 整體 test timeout 60_000 是 emulator 啟動時間考量，不能動                                | T03/T04 只動 `expect`，不動 `timeout`（emulator 的 60_000 必須保留）                                                                                                                                                                |
| vitest defaultProject 路線（不要走 package.json script）                | audit P2-1 給兩條路徑：(a) 改 `package.json:13` `"test": "vitest --project=browser"` 或 (b) vitest config 加 `defaultProject`；S1 章節指定走 (b) | T01 不改 `package.json:13`；只改 `vitest.config.mjs`                                                                                                                                                                                |
| pre-commit hook 會擋 commit                                             | T05 commit 觸發 lint+type-check+depcruise+spellcheck+vitest browser；任一紅都擋                                                                  | T05 在 `git commit` 前先本機跑一次 `npm run lint && npm run type-check && npm run depcruise && npm run spellcheck && npx vitest run --project=browser`，全綠才下 commit；hook 失敗時 fix → re-stage → **新 commit**（不 `--amend`） |
| zsh `status` 是 read-only                                               | shell script 中用 `status=$?` 會 read-only error，static expression 看不到                                                                       | reviewer 用 `eslint_status` / `vitest_status` 之類具體名稱接 `$?`                                                                                                                                                                   |
| `grep -c` 0 matches exits 1                                             | 看起來像命令掛掉，pipeline 中會吃 exit code                                                                                                      | 用 `grep -c ... \|\| true` 或 `grep ... \|\| echo "0 hits"` 包起來                                                                                                                                                                  |
| handoff.md 與 config 一起 commit                                        | T05 commit 必須 stage `specs/026-tests-audit-report/handoff.md` 跟 4 個 config 與 `tasks.md` 一起進                                              | T05 engineer `git status` 確認檔案清單後 `git add` 明確列出 6 檔，**不要用 `git add -A`**                                                                                                                                           |
| 主 agent 不能下手                                                       | 任何 Edit/Bash 修改/驗證/commit 都派 subagent；主 agent 違規 = 繞過 user 規則                                                                    | 主 agent 只 spawn subagent + 寫 tasks.md/handoff.md skeleton + 收 result                                                                                                                                                            |
| Reviewer 必須實際跑命令                                                 | 只看 engineer evidence 字串會錯失「engineer 貼舊輸出 / 改後沒重跑」的 bug                                                                        | Reviewer 在自己的 subagent session 內 Bash 跑 AC 命令，貼新輸出到 §3                                                                                                                                                                |
| Engineer commit 前先手動跑 gate                                         | pre-commit hook 失敗時 commit 沒進 git，但 staged 狀態還在；多次失敗會混淆                                                                       | 先手動跑完整 gate → 全綠 → `git commit` 一次過                                                                                                                                                                                      |

## §3 Final Evidence

> Engineer 完成 task → 填 engineer 欄 + Eng evidence；Reviewer 驗收 → 填 reviewer 欄 + Rev evidence。
> Status: `pending` / `eng-done` / `rev-pass` / `rev-reject (Nth attempt)` / `escalated`

| Task | Status  | Engineer | Eng evidence (excerpt) | Reviewer | Rev evidence (excerpt) |
| ---- | ------- | -------- | ---------------------- | -------- | ---------------------- |
| T01  | pending | \_       | \_                     | \_       | \_                     |
| T02  | pending | \_       | \_                     | \_       | \_                     |
| T03  | pending | \_       | \_                     | \_       | \_                     |
| T04  | pending | \_       | \_                     | \_       | \_                     |
| T05  | pending | \_       | \_                     | \_       | \_                     |

### T01 Evidence Detail

> Engineer/Reviewer 在此貼完整 git diff、命令 stdout、時間戳。

_pending_

### T02 Evidence Detail

_pending_

### T03 Evidence Detail

_pending_

### T04 Evidence Detail

_pending_

### T05 Evidence Detail

_pending_

## §4 Pattern Index

> Subagent 在實作中發現的可重用 pattern（one-liner、技巧）填於此節，供後續 S2-S10 重用。

- _filled by subagent_

## §5 Environment

> T05 engineer 在做整合驗證時，跑下列命令並把版本號填入：
>
> ```bash
> node --version
> npx vitest --version
> npx playwright --version
> ```

| Tool       | Version         |
| ---------- | --------------- |
| OS         | darwin (macOS)  |
| Node       | _filled by T05_ |
| Vitest     | _filled by T05_ |
| Playwright | _filled by T05_ |

## §6 References

- [tasks.md](./tasks.md) — 完整任務分解 + AC + reviewer 配對
- [audit report](../../project-health/2026-04-29-tests-audit-report.md) — L324-360 (P2-1/3/5) + L586-592 (S1)
- [Plan file](~/.claude/plans/2026-04-29-tests-audit-report-md-s1-ali-distributed-wren.md) — 主 agent 的 implementation orchestration plan
