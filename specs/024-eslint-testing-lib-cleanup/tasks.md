# Session 1 Tasks — Phase 1：ESLint Sensors 基礎建設

> **Source**: `specs/024-eslint-testing-lib-cleanup/plan.md` §5 Phase 1 + §8.2 Session 1
> **Goal**: 30 min — 安裝 plugin、加 sensor config、sanity check、baseline audit
> **執行模式**：所有任務一律由 subagent 執行；主 agent 只做派遣、彙整、驗收回饋。
> **Branch**：`024-eslint-testing-lib-cleanup`（worktree 路徑：`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`）

---

## Parallelism — 同時最多開 1 個 subagent

| 階段                       | 並行度   | 原因                                                                                                                                                               |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Engineer 執行              | **1**    | T1→T2→T3→T4 嚴格 sequential：T2 需要 T1 安裝完才有 plugin；T3 需要 T2 改完 config 才能觸發；T4 需要 T3 確認 sensor 真的會 fire 才有意義 audit。中途 fork 會 race。 |
| Reviewer 驗收              | **1**    | Reviewer 需 Engineer 寫完才能跑，不能同步進行。                                                                                                                    |
| Engineer + Reviewer 同時跑 | **不行** | 同一檔同時讀寫會撞。Engineer 先寫完 → 交付 → Reviewer 才開始驗。                                                                                                   |

> **總 subagent 數估算**（first-pass 全綠）：4 task × 2 (engineer + reviewer) = 8 次 Agent 呼叫；若有 task 需要修正，每多一輪 +2。

---

## Task 拆分

### T1：安裝 eslint-plugin-testing-library

**Engineer prompt 要點**：

- cd 到 worktree 根 (`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`)
- 執行 `npm i -D eslint-plugin-testing-library`
- 不可附加任何其他 dep
- 完成後回報 `package.json` 中該套件的實際版本字串
- **不要 commit**（Phase 1 結束才一起 commit）

**Acceptance Criteria（Reviewer 必驗）**：

1. `package.json` 的 `devDependencies` 出現 `"eslint-plugin-testing-library": "^7.x.x"`（major = 7）
2. `package-lock.json` 同步更新（`grep eslint-plugin-testing-library package-lock.json` 至少 1 行）
3. `node_modules/eslint-plugin-testing-library/package.json` 存在
4. `git diff package.json` 只有「新增 devDependency」這一塊變動（沒有意外動到其他欄位）
5. **無其他檔案被改**：`git status` 應該只看到 `package.json` + `package-lock.json` 修改

**Reviewer 驗收指令**：

```bash
grep '"eslint-plugin-testing-library"' package.json
test -f node_modules/eslint-plugin-testing-library/package.json && echo OK
git status --short      # 預期只有 M package.json + M package-lock.json
git diff package.json
```

**Failure recovery**：若任一條失敗，把失敗點寫進 reviewer 回報，主 agent 重派 Engineer 修。

---

### T2：修改 eslint.config.mjs（3 處）

**Engineer prompt 要點**：

按 plan §4.2 做三處修改（行號以實測為準，已驗）：

1. **Change 1**：Line 17 之前（`__filename` 宣告之前）插入 import：

   ```js
   import testingLibrary from 'eslint-plugin-testing-library';
   ```

   建議插在 line 14 (`import globals from 'globals';`) 之後、`import confusingGlobals` 之前的 plugin import 區塊末尾。

2. **Change 2**：Line 256（§9 type-aware section）`'@typescript-eslint/no-deprecated': 'error',` 之後加：

   ```js
   '@typescript-eslint/ban-ts-comment': [
     'error',
     {
       'ts-ignore': true,
       'ts-expect-error': 'allow-with-description',
       'ts-nocheck': true,
       'ts-check': false,
       minimumDescriptionLength: 10,
     },
   ],
   ```

3. **Change 3**：Line 369（`// 18. 針對測試檔案的嚴格規範`）**之前**插入新 block：
   ```js
   // 17.5 testing-library 規則（Constitution: testing-standards.md）
   //      Rationale: integration tests must use userEvent (not fireEvent),
   //      query by role/label (not container.querySelector). Mechanical guard
   //      so reviewers don't have to enforce manually.
   {
     files: ['tests/**/*.{js,jsx,mjs}', '**/*.test.{js,jsx,mjs}', '**/*.spec.{js,jsx,mjs}'],
     ...testingLibrary.configs['flat/react'],
     rules: {
       ...testingLibrary.configs['flat/react'].rules,
       // v7 預設 config 未啟用，手動補
       'testing-library/prefer-user-event': 'error',
     },
   },
   ```

完成後跑：

```bash
node -e "import('./eslint.config.mjs').then(() => console.log('OK')).catch(e => { console.error(e); process.exit(1) })"
```

預期 print `OK`。**不要 commit**。

**Acceptance Criteria（Reviewer 必驗）**：

1. 頂部 import 區塊有 `import testingLibrary from 'eslint-plugin-testing-library';`
2. Type-aware section（§9, line ~256-269）的 rules 物件包含 `ban-ts-comment`，且 options 完全比對：
   - `'ts-ignore': true`
   - `'ts-expect-error': 'allow-with-description'`
   - `'ts-nocheck': true`
   - `'ts-check': false`
   - `minimumDescriptionLength: 10`
3. testing-library block **位於 §18 之前**（grep 順序：先看到 `testing-library/prefer-user-event` 行號，再看到 `// 18.`）
4. testing-library block 用 `flat/react` config spread + 手動加 `'testing-library/prefer-user-event': 'error'`
5. `node -e "import('./eslint.config.mjs')..."` 印 `OK`，no error
6. `git diff` 只動到 `eslint.config.mjs`，無其他檔被改
7. 改動範圍合理（不應動到無關行）

**Reviewer 驗收指令**：

```bash
grep -n "import testingLibrary" eslint.config.mjs
grep -n "ban-ts-comment\|minimumDescriptionLength: 10" eslint.config.mjs
grep -n "testing-library/prefer-user-event\|flat/react\|// 18\." eslint.config.mjs
node -e "import('./eslint.config.mjs').then(() => console.log('OK')).catch(e => { console.error(e); process.exit(1) })"
git status --short
git diff eslint.config.mjs
```

**Failure recovery**：列出未通過的條目（具體哪行、缺什麼），重派 Engineer 修。

---

### T3：Sanity check（三條 rule 都觸發）

**Engineer prompt 要點**：

1. 在 worktree 建立 throwaway 檔 `tests/_sanity-eslint.test.jsx`，內容**完全比對** plan §5 Task 1.3：

   ```jsx
   // @ts-ignore
   import { fireEvent } from '@testing-library/react';

   describe('sanity', () => {
     it('should trigger all three sensors', () => {
       const container = document.createElement('div');
       const x = container.querySelector('.foo');
       fireEvent.click(x);
     });
   });
   ```

2. 執行：

   ```bash
   npx eslint tests/_sanity-eslint.test.jsx 2>&1 | tee /tmp/sanity-eslint.txt
   ```

3. 檢查預期 4 條 rule 都出現在輸出：
   - `@typescript-eslint/ban-ts-comment`（line 1）
   - `testing-library/no-node-access`（line 6）
   - `testing-library/no-container`（line 6）
   - `testing-library/prefer-user-event`（line 7）

4. 全部出現後 `rm tests/_sanity-eslint.test.jsx`，並把 `/tmp/sanity-eslint.txt` 內容貼回 reviewer report 給 reviewer 對照。

5. **不要 commit**。

**Acceptance Criteria（Reviewer 必驗）**：

1. Engineer 提交的 ESLint 輸出（`/tmp/sanity-eslint.txt`）包含全部 4 條 rule 名稱
2. 該 4 條 rule 對應的行號正確（ban-ts-comment 在 line 1、no-node-access/no-container 在 line 6、prefer-user-event 在 line 7）
3. `tests/_sanity-eslint.test.jsx` 已被刪除：`ls tests/_sanity-eslint.test.jsx` 返回 `No such file or directory`
4. `git status` 不應出現 `tests/_sanity-eslint.test.jsx`（既未 staged 也未 untracked）
5. **獨立驗證**：Reviewer 自己重建一次 sanity 檔、跑 ESLint、確認 4 條 rule 仍然全 fire、再刪掉

**Reviewer 驗收指令**：

```bash
ls tests/_sanity-eslint.test.jsx 2>&1   # 必須是 No such file
git status --short tests/                # 不該看到 sanity 檔

# 獨立驗證
cat > tests/_sanity-eslint.test.jsx <<'EOF'
// @ts-ignore
import { fireEvent } from '@testing-library/react';

describe('sanity', () => {
  it('should trigger all three sensors', () => {
    const container = document.createElement('div');
    const x = container.querySelector('.foo');
    fireEvent.click(x);
  });
});
EOF
npx eslint tests/_sanity-eslint.test.jsx 2>&1 | tee /tmp/sanity-eslint-reviewer.txt
grep -E "(ban-ts-comment|no-node-access|no-container|prefer-user-event)" /tmp/sanity-eslint-reviewer.txt | wc -l
# 預期 ≥ 4
rm tests/_sanity-eslint.test.jsx
git status --short tests/   # 必須乾淨
```

**Failure recovery**：

- 若有 rule 沒 fire → 病在 T2 config（位置/順序錯、import 漏、options 寫錯）→ **重派 T2 Engineer**，T3 重做。
- 若 sanity 檔殘留 → 重派 T3 Engineer 刪掉。

---

### T4：Baseline audit（全 repo）

**Engineer prompt 要點**：

1. 執行全 repo audit：

   ```bash
   npx eslint src specs tests 2>&1 | tee /tmp/eslint-baseline.txt
   ```

2. 計算每條 testing-library / ts-comment rule 的實際 violation 數：

   ```bash
   grep -oE 'testing-library/[a-z-]+' /tmp/eslint-baseline.txt | sort | uniq -c | sort -rn
   grep -c '@typescript-eslint/ban-ts-comment' /tmp/eslint-baseline.txt
   grep -c '\bproblem\b' /tmp/eslint-baseline.txt    # 總 violation 估算
   ```

3. 對照 plan §3.1 預期：
   - `prefer-screen-queries` ≈ 187（容差 ≤ 225 = 187 +20%）
   - `no-node-access` ≈ 89（容差 ≤ 107 = 89 +20%；下限 ≥ 43 per Appendix A grep snapshot）
   - `prefer-user-event` ≈ 8（下限 ≥ 8）
   - `render-result-naming-convention` ≈ 10（容差 ≤ 12）
   - `no-container` ≈ 9（容差 ≤ 11；下限 ≥ 7 per A.2）
   - `no-unnecessary-act` ≈ 1（容差 ≤ 2）
   - `ban-ts-comment` = 0（grep 已確認）

4. 確認 NavbarMobile 17 處 `document.getElementById('mobile-drawer')`：

   ```bash
   grep -c "document.getElementById('mobile-drawer')" tests/integration/navbar/NavbarMobile.test.jsx
   # 預期 ≥ 17
   ```

5. 把以下三段內容**append** 到 `specs/024-eslint-testing-lib-cleanup/handoff.md` 的「Baseline Audit (Phase 1 Task 1.4)」section：
   - 執行時間（`date -Iseconds`）
   - Per-rule violation count 表
   - 與 plan §3.1 估算的差距摘要（每條 rule 一行：實測 N 處 / 預期 ~M / status: ✅ in tolerance | ⚠️ over | 🚨 escalate）
   - 重大 hotspot 確認（NavbarMobile 17 處 mobile-drawer 是否確認）

6. **不要 commit**。

**Acceptance Criteria（Reviewer 必驗）**：

1. `/tmp/eslint-baseline.txt` 存在且非空
2. Per-rule 實測數量在容差範圍內（見 Engineer §3）：
   - 任一條超過 +20% → 必須在 handoff.md 標 `⚠️ over` 並寫原因猜想
   - 任一條超過 +50% → **escalate** 主 agent，主 agent 回報用戶（per plan §5 Task 1.4 alignment criterion）
3. `prefer-user-event` 實測數 ≥ 8
4. `no-node-access` 實測數 ≥ 43（grep snapshot 下限）
5. NavbarMobile mobile-drawer 17 處已驗證
6. `handoff.md` 的「Baseline Audit」section 有更新（時間戳、表格、status 標記）
7. `git status` 顯示只有 `handoff.md` 被改（外加 T1/T2 累積的 package\*.json + eslint.config.mjs）

**Reviewer 驗收指令**：

```bash
test -s /tmp/eslint-baseline.txt && echo "baseline file OK"

echo "=== per-rule counts ==="
grep -oE 'testing-library/[a-z-]+' /tmp/eslint-baseline.txt | sort | uniq -c | sort -rn
grep -c '@typescript-eslint/ban-ts-comment' /tmp/eslint-baseline.txt

echo "=== NavbarMobile mobile-drawer ==="
grep -c "document.getElementById('mobile-drawer')" tests/integration/navbar/NavbarMobile.test.jsx

echo "=== handoff.md Baseline Audit section ==="
sed -n '/^## Baseline Audit/,/^## /p' specs/024-eslint-testing-lib-cleanup/handoff.md
```

**Failure recovery**：

- 若數量爆掉（任一條 +50% 以上）→ Reviewer 回報 escalate；主 agent 把資料整理後**直接回報用戶、停止後續 task**，等決策。
- 若 `handoff.md` 沒更新 → 重派 Engineer 補。
- 若 grep 計數跟 Engineer 報的不一致 → 重派 Engineer 重算。

---

## Session 1 結束狀態（DOD）

四個 task 全綠後，working tree 應該長這樣：

```text
M  package.json                                  ← T1
M  package-lock.json                             ← T1
M  eslint.config.mjs                             ← T2
M  specs/024-eslint-testing-lib-cleanup/handoff.md  ← T4 audit 紀錄
?? specs/024-eslint-testing-lib-cleanup/tasks.md   ← 本檔（先就先 untracked，依用戶決定要不要進 git）
?? specs/024-eslint-testing-lib-cleanup/handoff.md ← 同上
?? specs/024-eslint-testing-lib-cleanup/plan.md    ← 同上
```

**不**做 Phase 1 commit（plan §5 Phase 1 commit 警告：commit 後 `npm run lint` 會 fail ~303 處，pre-commit gate 會擋；且 plan 要求 Phase 1–5 不在中途 push、最後驗證 0 violation 才 push）。Session 1 結束時保持 staged/unstaged 狀態，等 Session 2 接手。

Commit 時機 → Session 9（Phase 5 Task 5.5）一次處理完整 PR。

---

## 主 agent 派遣 SOP（給未來 session 參考）

```text
for task in [T1, T2, T3, T4]:
    1. 派 Engineer subagent（general-purpose）
       - prompt 要包含本 task 的「Engineer prompt 要點」全文
       - 明確說「只負責這個 task、做完回報、不要 commit」
       - 等回傳
    2. 派 Reviewer subagent（general-purpose）
       - prompt 要包含本 task 的「Acceptance Criteria」+「Reviewer 驗收指令」全文
       - 明確說「只跑驗收命令、不改任何檔、回傳 PASS / FAIL + 失敗點」
       - 等回傳
    3. if FAIL:
         重派 Engineer（prompt 帶 reviewer 的失敗點），再回到 step 2
       else:
         記錄通過、繼續下一 task
    4. T4 完成後 update handoff.md「Session 1 Done」section + commit message draft（不 commit）
```

> 主 agent **不**自己跑 npm install、不自己改 eslint.config.mjs、不自己寫測試檔。所有有副作用的指令都派 subagent 跑。
