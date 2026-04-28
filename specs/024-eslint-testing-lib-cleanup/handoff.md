# Handoff Notes — 024 ESLint Testing-Library Cleanup

> **目的**：跨 session / 跨 implementer 的接力簿。記錄已驗事實、踩過的坑、下一步該注意什麼。
> **更新規則**：每個 session 結束前必加一段；不刪舊紀錄（會變得難 trace）；只在事實過時時改原段落並標 `~~舊事實~~ → 新事實 (YYYY-MM-DD)`。

---

## 0. 入門 30 秒（最新狀態給下個接手者讀）

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| Branch          | `024-eslint-testing-lib-cleanup`                                                         |
| Worktree path   | `/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`                  |
| 目前 Session    | Session 1（Phase 1 基礎建設）— planning 完、待主 agent 派遣 Engineer subagent            |
| Working tree    | 乾淨（除 `specs/024-eslint-testing-lib-cleanup/` untracked，含 plan/tasks/handoff 三檔） |
| ESLint plugin   | **未裝**（Session 1 T1 即將安裝）                                                        |
| Sensors         | 三條 sensor (`ban-ts-comment` / `prefer-user-event` / `no-node-access`) **未啟用**       |
| Repo lint state | 目前綠（plugin 未裝、sensor 未啟用）；T2 完成後 repo-wide ~303 violations                |
| Commit 計畫     | **不在 Session 1–8 中途 commit/push**；Session 9 (Phase 5) 才一次 commit + push          |

接手前必讀：

1. 本檔 §1 已驗事實（ESLint config 行號、§18 邊界）
2. 本檔 §2 三大坑（plan §5 已記但容易漏）
3. `tasks.md` 對應本 session 的 task 拆分

---

## 1. 已驗事實（避免重做 verify 工作）

### 1.1 `eslint.config.mjs` 結構（2026-04-28 實測）

| 內容                                                                                   | 行號         |
| -------------------------------------------------------------------------------------- | ------------ |
| 檔案總行數                                                                             | 411          |
| Import 區塊                                                                            | line 1–17    |
| `__filename = fileURLToPath(...)` 宣告                                                 | line 19      |
| §9 type-aware linting block 開頭 (`// 9. Type-aware linting...`)                       | line 242     |
| §9 `plugins: { '@typescript-eslint': tsPlugin }` 行                                    | line 254     |
| §9 `'@typescript-eslint/no-deprecated': 'error'` 行（**T2 插入點之上**）               | line 256     |
| §9 block 結尾 `},`                                                                     | line 258     |
| §17 (no-restricted-disable) block                                                      | line 358–367 |
| §18 (測試檔嚴格規範) 開頭 (`// 18. 針對測試檔案的嚴格規範`) **T2 Change 3 插入點之前** | line 369     |
| §19 (file size limits)                                                                 | line 403     |

> Plan §4.2 寫的「line 254-257」「line 369 前」**全部與實測一致**。Engineer 不需要再 verify。

### 1.2 套件安裝狀態（2026-04-28 實測）

| 套件                               | 狀態                            |
| ---------------------------------- | ------------------------------- |
| `eslint-plugin-testing-library`    | **未裝**                        |
| `@testing-library/user-event`      | 已裝 (^14.6.1, devDep)          |
| `@testing-library/react`           | 已裝（用作 testing 主庫）       |
| `@typescript-eslint/eslint-plugin` | 已裝（line 11 import 已 wired） |

### 1.3 NavbarMobile 重大 hotspot（plan Appendix A）

```bash
grep -c "document.getElementById('mobile-drawer')" tests/integration/navbar/NavbarMobile.test.jsx
# 預期 ≥ 17
```

T4 audit 完後在 §3 baseline audit 章節記錄實際數字。如果 < 17 → Appendix A grep regex 漏抓，更新 plan。

---

## 2. 三大坑（從 plan §5 + §6 萃取，先警告再執行）

### 2.1 ⚠️ 坑 1：T2 commit 後 `npm run lint` 會 fail repo-wide

- **原因**：T2 改完 config，`eslint-plugin-testing-library` rule 全開，立刻會抓 ~303 處先存在違規。
- **症狀**：之後在 worktree 內任何 `git commit` 都會被 husky pre-commit gate 擋下（lint step fail）。
- **對策**：
  - **Session 1–8 全部不 commit**。所有改動累積在 working tree，Session 9 才 commit。
  - 若中途必須切 branch / 暫離 → `git stash push -m "WIP: 024 cleanup after S<N>"`，回來 `git stash pop`。
  - 若**真的**必須中途 commit（例如機器要重開）→ 用 `git commit --no-verify -m "WIP, hooks bypassed intentionally during Phase X"`，但 push 前要 squash 或補完 cleanup。

### 2.2 ⚠️ 坑 2：T3 sanity 檔 不能漏刪

- **原因**：sanity 檔故意違反全部三條 rule 給 ESLint 抓，**不能 commit、不能進 git**。
- **症狀**：忘記刪 → 之後任何 lint 都會抓到這檔的 4 條 violation，混淆 baseline audit (T4) 數字、且 git status 會看到。
- **對策**：T3 Engineer 完成後**自己** `rm`；T3 Reviewer **再驗** `ls tests/_sanity-eslint.test.jsx` 不存在。雙保險。

### 2.3 ⚠️ 坑 3：T4 audit 數字「過低」也是警訊

- **原因**：plan §5 Task 1.4 對齊基準寫得從嚴：
  - 實測 < grep snapshot → grep regex 有錯（不阻塞）
  - 實測 > §3.1 估算 +20% → escalate 給用戶
  - **漏掉的情境**：實測 ≪ §3.1 估算（差 50% 以上） → 可能 sensor 沒真的 fire（T2 順序錯 / config block 沒進到第 18 條之前 / spread 寫錯）
- **對策**：T4 Reviewer 收到「異常低」也要 escalate，不能只看「異常高」。下界線：
  - `prefer-screen-queries` ≥ 100（187 的 ~50%）
  - `no-node-access` ≥ 43（Appendix A 下限）
  - `prefer-user-event` 必須 = 8（grep 已 100% 確認）

### 2.4 ⚠️ 坑 4：testing-library config 必須在 §18 **之前**（plan §4.2 註解）

- **原因**：§18 已 override `jsdoc/require-jsdoc`、`no-console` 等規則。若 testing-library config 放在 §18 **之後**，會反向覆蓋 §18 的設定，把測試檔的既有 override 弄掉。
- **症狀**：測試檔的 `no-console` / `jsdoc` 行為突然改變、或測試 lint 突然多一堆無關 violation。
- **對策**：T2 Change 3 必須插在 line 369 (`// 18.`) 之前；T2 Reviewer 用 `grep -n` 對照行號順序。

---

## 3. Baseline Audit (Phase 1 Task 1.4)

> Session 1 T4 完成時填入。下面是空 template。

### 3.1 Run metadata

- 執行時間：`<待填，Session 1 T4>`
- 命令：`npx eslint src specs tests 2>&1 | tee /tmp/eslint-baseline.txt`

### 3.2 Per-rule violation counts

| Rule                                              | 預期 (plan §3.1 / Appendix A 下限) | 實測 | Status |
| ------------------------------------------------- | ---------------------------------- | ---- | ------ |
| `testing-library/prefer-screen-queries`           | ~187 (容差 ≤ 225, ≥ 100)           | TBD  | TBD    |
| `testing-library/no-node-access`                  | ~89 (容差 ≤ 107, ≥ 43)             | TBD  | TBD    |
| `testing-library/render-result-naming-convention` | ~10 (容差 ≤ 12)                    | TBD  | TBD    |
| `testing-library/no-container`                    | ~9 (容差 ≤ 11, ≥ 7)                | TBD  | TBD    |
| `testing-library/prefer-user-event`               | 8 (必 = 8)                         | TBD  | TBD    |
| `testing-library/no-unnecessary-act`              | 1 (容差 ≤ 2)                       | TBD  | TBD    |
| `@typescript-eslint/ban-ts-comment`               | 0                                  | TBD  | TBD    |

### 3.3 重大 hotspot 確認

| Hotspot                                                               | 預期數 | 實測 | Status |
| --------------------------------------------------------------------- | ------ | ---- | ------ |
| `tests/integration/navbar/NavbarMobile.test.jsx` mobile-drawer        | ≥ 17   | TBD  | TBD    |
| `tests/integration/posts/PostCard.test.jsx` fireEvent.click           | 5      | TBD  | TBD    |
| `tests/integration/notifications/NotificationToast.test.jsx` line 141 | 1      | TBD  | TBD    |

### 3.4 與 plan §3.1 差距摘要

`<待填：每條 rule 一行，例如「prefer-screen-queries 實測 187 / 預期 187 / ✅ in tolerance」>`

---

## 4. Session 完成紀錄

> 每個 session 結束時 append 一個小節。

### Session 1（Phase 1）— 進行中

- **Started**: 2026-04-28
- **狀態**: 規劃完成，主 agent 即將派遣 T1 Engineer subagent
- **預期完成 deliverables**:
  - [x] `tasks.md` 寫完
  - [x] `handoff.md` 寫完
  - [ ] T1: plugin 安裝 + lockfile 同步
  - [ ] T2: eslint.config.mjs 三處改動完成
  - [ ] T3: sanity check 4 條 rule 全 fire
  - [ ] T4: baseline audit 填入 §3
- **未完成 / blocker**: TBD

---

## 5. 下個 Session 開工 checklist

進 Session 2 之前：

- [ ] 讀本檔 §0、§2、§4 最新一段
- [ ] 跑 `git status` 確認 working tree 跟 §0 描述一致（package\*.json + eslint.config.mjs + handoff.md 是 modified）
- [ ] 跑 `npx eslint src specs tests 2>&1 | tail -5` 確認 ~303 violations 還在（沒被誤刪）
- [ ] 確認 plugin 還在：`ls node_modules/eslint-plugin-testing-library/package.json`
- [ ] 讀 `tasks.md` 該 session 的 task 拆分（Session 2 會由本 session 寫好的 template 接續產出）

---

## 6. 環境細節（debug 用）

- **Node 版本**：`<待填：node -v>`
- **npm 版本**：`<待填：npm -v>`
- **OS**：darwin 24.3.0
- **Husky 版本**：見 package.json devDependencies
- **ESLint 版本**：見 package.json（flat config 表示 ≥ v9）

---

## 7. Glossary（避免術語誤會）

| 詞                  | 意思                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| sensor              | ESLint rule 在 pre-commit gate 觸發時的「自動防線」。Plan 用此詞代指我們新加的三條 rule。 |
| Path A              | 一次清光所有 violation，rule 直接 `'error'`。本 PR 採取此路。                             |
| Path B              | 過渡期把暫時無法修的設成 `'warn'` + escape hatch。**本 PR 明確不退到 Path B**。           |
| `flat/react` config | `eslint-plugin-testing-library` v7 提供的 flat-config 預設 ruleset。                      |
| sanity check        | 故意寫違規 code 確認 rule 真的會 fire 的最小驗證流程（T3）。                              |
| escalate            | 主 agent 不自行決策，把問題狀況回報用戶、暫停。                                           |
