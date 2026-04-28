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

---

# Session 2 Tasks — Phase 2：機械批次違規清理（4 條 rule）

> **Source**: `plan.md` §5 Phase 2 + §8.2 Session 2
> **Goal**: **2.5–3.5 hr**（plan 原估 1-2 hr，因 §5 line 272 autofix 假設失效調高）— 把 4 條純機械 rule 違規清光：`prefer-screen-queries` 187 → 0、`render-result-naming-convention` 10 → 0、`no-container` 9 → 0、`no-unnecessary-act` 1 → 0
> **執行模式**：所有任務一律由 subagent 執行；主 agent 只做派遣、彙整、驗收回饋。從頭到尾包含後續修改都交 subagent。
> **Branch**：`024-eslint-testing-lib-cleanup`（worktree 路徑：`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`）
> **承接狀態**：Session 1 完成 + Session 2 規劃完成（含 escalation 處理）；working tree 應該有 6 個 M（Session 1 累積 4 個 + cspell.json [callsite 補詞] + tasks.md [本檔修訂]），baseline = 303 violations
> **本 session 開工前必讀**：
>
> - `handoff.md` §0 + §2.8（plan §5 line 272 假設錯誤的 escalation note）
> - 本檔 T5 + T6 spec（已從「autofix → 漏網」改為「destructured query → scoped query」拆分）
> - 本檔下方「主 agent 派遣 SOP」

---

## Parallelism — 同時最多開 1 個 subagent

| 階段                       | 並行度   | 原因                                                                                                                                                                                  |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engineer 執行              | **1**    | 6 個 task 嚴格 sequential：T5 全手工修 destructured query 會大規模改 tests/，T6 收尾依賴 T5 後狀態 verify，T7-T9 各 rule 修法可能改同檔（同檔不同行），並行有撞檔/race-condition 風險 |
| Reviewer 驗收              | **1**    | Reviewer 需 Engineer 寫完才能跑 ESLint count + vitest（同檔讀寫衝突）                                                                                                                 |
| Engineer + Reviewer 同時跑 | **不行** | 同一檔同時讀寫會撞                                                                                                                                                                    |

> **總 subagent 數估算**（first-pass 全綠）：6 task × 2 (engineer + reviewer) = **12 次 Agent 呼叫**；若 task 需要修正，每多一輪 +2。
>
> **進階並行（不採用）**：T9（`no-unnecessary-act` 1 處，已知檔案 `NotificationPaginationStateful.test.jsx`）跟 T8（`no-container` 9 處，分布在 7 檔不含 NotificationPaginationStateful）不會撞檔，理論可並行；但 vitest 並行跑會搶 emulator port、輸出混雜，且省下時間有限（T9 只 10 min）。**保險起見全 sequential**。

---

## Task 拆分

### T5：`prefer-screen-queries` 全手工修復 — destructured query pattern（187 → ≤ 50）

> ⚠️ **Plan §5 line 272 假設錯誤**（已記入 handoff §2.8）：`prefer-screen-queries` **不是 fixable rule**，autofix 改 0 處（Session 2 嘗試實測 `fixable: 0, unfixable: 187`）。整條 rule 必須全手工修。
>
> ⚠️ **分批策略**：187 處跨多檔，單個 subagent 可能 OOC（context 用完）。Engineer 可以分批修，每批處理一部分檔，回報「已修 N 檔，殘留 M」；main agent 視情況 SendMessage 接續同一個 Engineer 或派新 Engineer 接續。**不需要一個 subagent 在一輪內修完 187 處**。
>
> **T5 範圍**：destructured query pattern（最大宗，估計 ~150-180 處）。剩下的 scoped query pattern (`getByX(container, ...)`) 與最後殘留交給 T6 處理。

**Engineer prompt 要點**：

1. cd 到 worktree 根 (`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`)
2. 確認 working tree 狀態：`git status --short`（預期 4-6 個 M：Session 1 累積 4 個 + cspell.json + tasks.md，無其他 dirty）
3. 找出所有有 destructured query 的檔：
   ```bash
   grep -rln 'const \{ [^}]*By' tests/ > /tmp/t5-destructure-files.txt
   wc -l /tmp/t5-destructure-files.txt
   ```
4. 列出 prefer-screen-queries 違規檔（含行號，做為實作清單）：
   ```bash
   npx eslint src specs tests 2>&1 | grep -B1 "prefer-screen-queries" \
     | grep -E '\.test\.|\.spec\.' | sort -u > /tmp/t5-violation-files.txt
   wc -l /tmp/t5-violation-files.txt
   ```
5. 逐檔修復（Read → Edit）：
   - **destructured query pattern**（focus 範圍）：

     ```jsx
     // before
     const { getByText, getByRole } = render(<Foo />);
     const text = getByText('hello');
     // after
     render(<Foo />);
     const text = screen.getByText('hello');
     ```

     - 把解構整段移除（保留 render call）
     - 若解構同時包含 non-query property 如 `container` / `rerender` / `unmount` / `asFragment`，**保留它們**：
       ```jsx
       // before
       const { container, getByText, rerender } = render(<Foo />);
       // after
       const { container, rerender } = render(<Foo />);
       ```
     - 把後續 `getByX(...)` callsite 全改成 `screen.getByX(...)`
     - 確保檔頂 `import { screen } from '@testing-library/react'` 已存在；若沒，加上

   - **scoped query pattern**（看到先記下、不在本 task 修）：
     - `getByText(container, ...)` 形式留給 T6 處理

6. 每修完 5-10 檔跑 quick verify:
   ```bash
   npx eslint src specs tests 2>&1 | grep -c "prefer-screen-queries"
   ```
   數字應遞減。
7. 修到殘留 ≤ 50 即可停（餘下交 T6）；或修完所有 destructured query 檔後跑：
   ```bash
   npm run test:browser 2>&1 | tail -30
   ```
8. 回報：
   - 已修檔案清單（每檔幾處）
   - 殘留 prefer-screen-queries 數
   - vitest 是否全綠（若沒跑請說明原因）
   - 若有檔還沒修（context 不夠），明確列出未修檔給 main agent 接續

**禁止行為**：

- ❌ 不可 commit / push / git add
- ❌ 不可改 src/ / specs/ / eslint.config.mjs / package\*.json / cspell.json
- ❌ 不可改其他 testing-library rule 違規（focus 只在 prefer-screen-queries destructure 形式）
- ❌ 不可建新檔
- ❌ 不可機械替換（盲改 `getByX(container, ...)` → `screen.getByX(...)` 會改錯 scope）

**Acceptance Criteria（Reviewer 必驗）**：

1. `npx eslint src specs tests 2>&1 | grep -c "prefer-screen-queries"` ≤ **50**（剩下交給 T6 收尾）
2. 其他 testing-library rule 數量沒爆增（容差 ±2）：
   - no-node-access 89 ± 2
   - no-container 9 ± 2（可能下降，因為移除部分 container 解構）
   - render-result-naming-convention 10 ± 2
3. `npm run test:browser` 全綠
4. `git diff --name-only` 顯示只動 `tests/` 下檔案
5. 沒有任何 git untracked 新檔
6. **抽查 3 處改動**：
   - destructure 移除後，所有 callsite 都正確改成 `screen.X`（沒漏改變數名稱）
   - 若有 non-query property 仍要保留，沒被誤刪
   - `import { screen } from '@testing-library/react'` 在改動的檔都已存在

**Reviewer 驗收指令**：

```bash
echo "=== prefer-screen-queries 殘留（必須 ≤ 50）==="
npx eslint src specs tests 2>&1 | grep -c "prefer-screen-queries"

echo "=== 其他 testing-library rule（容差 ±2）==="
npx eslint src specs tests 2>&1 | grep -oE 'testing-library/[a-z-]+' | sort | uniq -c | sort -rn

echo "=== test:browser ==="
npm run test:browser 2>&1 | tail -20

echo "=== diff scope ==="
git diff --stat tests/ | tail -5
git diff --name-only src/ specs/ eslint.config.mjs cspell.json   # 預期空（已 modified 不算）

echo "=== 抽查改動 context ==="
git diff tests/ | head -300
```

**Failure recovery**：

- 若殘留 > 50 → SendMessage 同一個 Engineer 接續修，prompt 帶剩餘檔清單
- 若 vitest 紅 → 找哪檔改壞，revert + 重派該檔修法（典型錯誤：destructure 移除但漏改 callsite，導致 ReferenceError）
- 若改錯 scope（destructured query 改 screen 但同檔有多個同 role 元素 → ambiguous query）→ revert 那幾處 + 重派改用 within

---

### T6：`prefer-screen-queries` 收尾 — scoped query pattern + 漏網（殘留 → 0）

> **T6 範圍**：T5 後殘留的 prefer-screen-queries（兩種來源）：
>
> - **scoped query pattern**：`getByX(container, ...)` 形式（plan §5 Task 2.1 grep 形式 1）
> - **T5 漏網**：T5 因 token 不夠或判斷困難跳過的 destructured query 殘留
>
> Target：全 repo `prefer-screen-queries` 違規 = 0。

**Engineer prompt 要點**：

1. cd 到 worktree 根 (`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`)
2. 列出所有殘留違規（含行號）：
   ```bash
   npx eslint src specs tests 2>&1 | grep -B1 "prefer-screen-queries" > /tmp/t6-residual.txt
   cat /tmp/t6-residual.txt
   ```
3. Grep 兩種 pattern 對齊 ESLint 抓到的點：

   ```bash
   # 形式 1：getByX(container, ...) — scoped query
   grep -rEn '(get|find|query)(All)?By(Text|Role|LabelText|TestId|PlaceholderText|AltText|Title|DisplayValue)\(\s*[a-zA-Z_]' tests/ \
     | grep -v "screen\." | grep -v "within(" | grep -v "page\." > /tmp/t6-pattern1.txt
   wc -l /tmp/t6-pattern1.txt

   # 形式 2：destructured query（T5 漏網）
   grep -rEn 'const\s+\{[^}]*(get|find|query)(All)?By' tests/ > /tmp/t6-pattern2.txt
   wc -l /tmp/t6-pattern2.txt
   ```

4. 對每處決定改法（**重要：要看 context 不能機械替換**）：
   - `getByText(container, name)`，後續還用 container 做 scoping → `within(container).getByText(name)`
   - `getByText(container, name)`，後續沒再用 container → 移除解構，改 `screen.getByText(name)`
   - `const { getByText } = render(...)`（T5 漏網）→ `render(...)` + 改用 `screen.getByText`
5. 用 Edit 工具逐處修
6. 跑 ESLint 確認殘留 = 0：
   ```bash
   npx eslint src specs tests 2>&1 | grep -c "prefer-screen-queries"
   ```
7. 跑 vitest browser 確認沒改壞：
   ```bash
   npm run test:browser 2>&1 | tail -20
   ```
8. 回報修了幾處 + 涉及檔案清單 + scope 改法（within vs screen）的決策邏輯

**禁止行為**：

- ❌ 不可 commit / push / git add
- ❌ 不可改 src/ / specs/ / eslint.config.mjs / package\*.json / cspell.json
- ❌ 不可改其他 testing-library rule 違規
- ❌ 不可建新檔

**Acceptance Criteria（Reviewer 必驗）**：

1. `prefer-screen-queries` 殘留 = **0**
2. `npm run test:browser` 全綠
3. 修改範圍只動 `tests/`
4. **抽查 3 處改動 context 合理**：
   - `within(scope).getByX(...)` 用在原本就需要 scope 的場合
   - `screen.getByX(...)` 用在不再需要 scope 的場合
   - 沒有把 within 誤改成 screen 失去 scope（會導致 ambiguous query）

**Reviewer 驗收指令**：

```bash
echo "=== prefer-screen-queries 殘留（必須 = 0）==="
npx eslint src specs tests 2>&1 | grep -c "prefer-screen-queries"

echo "=== test:browser ==="
npm run test:browser 2>&1 | tail -20

echo "=== diff scope ==="
git diff --name-only tests/

echo "=== 抽查 3 處 within vs screen 改法（看 context）==="
git diff tests/ | head -200
```

**Failure recovery**：

- 殘留 > 0 → 列出殘留檔，重派 Engineer 補修
- vitest 紅 → 找出哪檔改壞，revert + 重派
- within → screen 改錯導致 query scope 錯（如同檔多 element 同 role）→ revert + 重派

---

### T7：`render-result-naming-convention`（10 → 0）

**Engineer prompt 要點**：

1. 跑 ESLint 列出 10 處違規檔案 + 行號：
   ```bash
   npx eslint src specs tests 2>&1 | grep -B1 "render-result-naming-convention" > /tmp/t7-violations.txt
   cat /tmp/t7-violations.txt
   ```
2. v7 rule 接受的 render result 命名：
   - 接受：`view` / `result` / `_result` / 解構（`const { container } = render(...)`）
   - 不接受：自訂變數名如 `wrapper`、`rendered`、`r` 等 → 必須改名
3. 用 Edit 工具逐處改：
   - 改變數宣告處（`const wrapper = render(...)` → `const view = render(...)`）
   - **必須同步改後續用法**（`wrapper.container` → `view.container`、`wrapper.rerender(...)` → `view.rerender(...)`）
4. 跑 ESLint 確認 0：
   ```bash
   npx eslint src specs tests 2>&1 | grep -c "render-result-naming-convention"
   ```
5. 跑 vitest browser 確認沒改壞
6. 回報改了哪幾檔
7. **不要 commit**

**Acceptance Criteria（Reviewer 必驗）**：

1. `render-result-naming-convention` 殘留 = **0**
2. `npm run test:browser` 全綠
3. 修改範圍只動 `tests/`
4. **變數名 rename 一致**（不能改宣告但忘了改 callsite）：
   - 用 grep 抽查改過的檔，舊名不該還出現

**Reviewer 驗收指令**：

```bash
echo "=== render-result-naming-convention（必須 = 0）==="
npx eslint src specs tests 2>&1 | grep -c "render-result-naming-convention"

echo "=== test:browser ==="
npm run test:browser 2>&1 | tail -20

echo "=== diff scope ==="
git diff --name-only tests/

echo "=== 抽查改動 ==="
git diff tests/ | head -120
```

**Failure recovery**：殘留 > 0 → 重派；vitest 紅 → revert + 重派；變數 rename 不一致 → 重派 Engineer 補完。

---

### T8：`no-container`（9 → 0）

**Engineer prompt 要點**：

1. 跑 ESLint 列出 9 處：
   ```bash
   npx eslint src specs tests 2>&1 | grep -B2 "no-container" > /tmp/t8-violations.txt
   cat /tmp/t8-violations.txt
   ```
2. 違規分三種改法：
   - **A. 不再用 container**：移除 `container` 解構，後續改 `screen.X` 或 `within(scope).X`
   - **B. 改用 within**：`const { container } = render(...)` 後續 `container.querySelector(...)` → 重思路用 `screen.getByRole(...)` 或 `within(...)`
   - **C. 該行同時被 no-node-access 抓**：留待 Phase 4 處理 no-node-access；本 task 仍要消 no-container（用 within() 包就消 no-container 但 no-node-access 可能還在 → 那是 Phase 4 的事）
3. **重要**：本 task 只負責消 `no-container`，不負責消 `no-node-access`。即使該行同時被兩條 rule 抓，本 task 完成後 no-node-access 數字不變或減少都 OK，但**不可增加**（Reviewer 會驗）
4. 用 Edit 工具逐處改
5. 跑 ESLint 確認 0：
   ```bash
   npx eslint src specs tests 2>&1 | grep -c "no-container"
   ```
6. 跑 vitest browser
7. 回報修了哪幾檔 + 哪幾處走 A/B/C
8. **不要 commit**

**Acceptance Criteria（Reviewer 必驗）**：

1. `no-container` 殘留 = **0**
2. `no-node-access` 殘留**不可比 Session 1 baseline (89) 增加**（Phase 4 預定數量）
3. `npm run test:browser` 全綠
4. 修改範圍只動 `tests/`
5. **抽查 3 處改動 scope 合理**：沒有為了消 no-container 而改錯測試範圍（如把 `within(container)` 換成 `screen` 但同檔有多個同 role element）

**Reviewer 驗收指令**：

```bash
echo "=== no-container（必須 = 0）==="
npx eslint src specs tests 2>&1 | grep -c "no-container"

echo "=== no-node-access（必須 ≤ 89，避免回退）==="
npx eslint src specs tests 2>&1 | grep -c "no-node-access"

echo "=== test:browser ==="
npm run test:browser 2>&1 | tail -20

echo "=== diff scope ==="
git diff --name-only tests/
git diff tests/ | head -150
```

**Failure recovery**：殘留 > 0 → 重派；no-node-access 上升 → revert + 重派（改法錯了）；vitest 紅 → revert + 重派。

---

### T9：`no-unnecessary-act`（1 → 0）

**Engineer prompt 要點**：

1. 已知違規位於 `tests/integration/notifications/NotificationPaginationStateful.test.jsx` line 416 附近（plan §2.6 紀錄）。先確認：
   ```bash
   npx eslint tests/integration/notifications/NotificationPaginationStateful.test.jsx 2>&1 | grep -B1 "no-unnecessary-act"
   ```
2. 觀察該行附近結構，判斷修法：
   - 若 `act(() => { fireEvent.X(...) })` → 拆 wrapper + `fireEvent.X` 改 `await user.X`（同時消 prefer-user-event line 419 那 1 處 = bonus）
   - 若 `act(() => { 同步 code })` 純同步 → 直接拆 wrapper
   - 若 `act(async () => { ... })` → v9 後 `userEvent.X` 自動包 act，可移除外層 act
3. 用 Edit 工具改
4. 跑 ESLint 確認該檔 0 違規（`no-unnecessary-act` 必清，`prefer-user-event` line 419 若同時消是 bonus）：
   ```bash
   npx eslint tests/integration/notifications/NotificationPaginationStateful.test.jsx 2>&1 | tail -20
   ```
5. 跑 vitest 該檔：
   ```bash
   npx vitest run tests/integration/notifications/NotificationPaginationStateful.test.jsx 2>&1 | tail -30
   ```
6. 回報：
   - 修法是 A/B/C 哪種
   - prefer-user-event line 419 是否同時消（bonus）
7. **不要 commit**

**Acceptance Criteria（Reviewer 必驗）**：

1. `no-unnecessary-act` 殘留 = **0**（全 repo）
2. NotificationPaginationStateful 該檔 vitest 全綠
3. 修改只動 `NotificationPaginationStateful.test.jsx`（不應動其他檔）
4. **觀察項（非阻塞）**：prefer-user-event 全 repo 數量 = 7 或 6（若 6 表示同時消了 line 419，handoff 標 bonus）

**Reviewer 驗收指令**：

```bash
echo "=== no-unnecessary-act 全 repo（必須 = 0）==="
npx eslint src specs tests 2>&1 | grep -c "no-unnecessary-act"

echo "=== prefer-user-event 全 repo（觀察是否從 7 降到 6）==="
npx eslint src specs tests 2>&1 | grep -c "prefer-user-event"

echo "=== prefer-user-event 在 NotificationPaginationStateful（觀察是否一併消）==="
npx eslint tests/integration/notifications/NotificationPaginationStateful.test.jsx 2>&1 | grep "prefer-user-event"

echo "=== vitest 該檔 ==="
npx vitest run tests/integration/notifications/NotificationPaginationStateful.test.jsx 2>&1 | tail -20

echo "=== diff 範圍 ==="
git diff --name-only tests/ | grep -v NotificationPaginationStateful | head    # 應該空
git diff tests/integration/notifications/NotificationPaginationStateful.test.jsx | head -60
```

**Failure recovery**：殘留 > 0 → 重派；vitest 紅 → revert + 重派；改到其他檔 → revert + 重派限縮範圍。

---

### T10：Session 2 收尾驗證 + handoff 更新

**Engineer prompt 要點**：

1. 跑全 repo audit：
   ```bash
   npx eslint src specs tests 2>&1 | tee /tmp/t10-audit.txt
   ```
2. 統計 7 條 rule 殘留：
   ```bash
   echo "=== Session 2 後 per-rule counts ==="
   grep -oE 'testing-library/[a-z-]+' /tmp/t10-audit.txt | sort | uniq -c | sort -rn
   echo "=== ban-ts-comment ==="
   grep -c "@typescript-eslint/ban-ts-comment" /tmp/t10-audit.txt
   echo "=== total ==="
   tail -3 /tmp/t10-audit.txt
   ```
3. 對照預期：
   - prefer-screen-queries: **0**
   - render-result-naming-convention: **0**
   - no-container: **0**
   - no-unnecessary-act: **0**
   - prefer-user-event: ≤ 7（T9 若同時消 → 6）
   - no-node-access: ~89（不變，Phase 4 處理）
   - ban-ts-comment: 0（不變）
   - 總 violation 數預期：~96（89 no-node-access + 7 prefer-user-event）或 ~95（若 T9 帶消）
4. 跑 vitest 雙 project（確認累積改動沒打壞）：
   ```bash
   npm run test:browser 2>&1 | tail -30
   npm run test:server 2>&1 | tail -20
   ```
5. **更新 `specs/024-eslint-testing-lib-cleanup/handoff.md`**（用 Edit 工具）：
   - **§0 入門 30 秒**：
     - 「目前 Session」改為 `Session 2 完成（T5-T10 全綠）— 待 Session 3 接手 Phase 3`
     - 「Repo lint state」改為 Session 2 後實際數字（例：`~96 violations（no-node-access 89 + prefer-user-event 7，Phase 2 4 條全清光）`）
     - 「Working tree」改為 `乾淨（除 Session 1 4 個 modified + Session 2 多個 tests/ modified + specs/024.../*.md 三檔 untracked）`
   - **§4 Session 完成紀錄** 新增「Session 2（Phase 2）— 完成」段：
     - Started 日期
     - 完成的 task 清單 + 各 task 違規從 N → 0
     - 主要踩坑（若有）
     - subagent 用量（first-pass 12 次 / 實際 N 次）
     - commit 狀態：未 commit
   - **若有新踩坑** → 在 §2 新增 §2.8 / §2.9 等，標明發生在 Session 2 哪個 task
   - **§5 下個 Session 開工 checklist** 不用改（內容仍適用 Session 3）
6. 回報：
   - 4 條目標 rule 殘留數（必須全 0）
   - 其他 rule 殘留數
   - vitest browser/server 結果
   - handoff.md 更新區段摘要
7. **不要 commit**

**Acceptance Criteria（Reviewer 必驗）**：

1. 4 條目標 rule 殘留全 = **0**：
   - prefer-screen-queries: 0
   - render-result-naming-convention: 0
   - no-container: 0
   - no-unnecessary-act: 0
2. 其他 rule 殘留正常（不可大幅變動）：
   - prefer-user-event: 6 或 7
   - no-node-access: 87–91（容差 ±2）
   - ban-ts-comment: 0
3. `npm run test:browser` 全綠
4. `npm run test:server` 全綠
5. `handoff.md` 已更新：
   - §0 「目前 Session」反映 Session 2 完成
   - §0 「Repo lint state」反映新 violation 數
   - §4 新增 Session 2 完成紀錄
   - 若 Session 2 有新坑 → §2 有新增項
6. `git status --short` 顯示符合 DOD（package*.json + eslint.config.mjs + handoff.md + 多個 tests/ 修改 + specs/024.../*.md 三 untracked）

**Reviewer 驗收指令**：

```bash
echo "=== 4 條目標 rule 殘留（必須 0）==="
for rule in prefer-screen-queries render-result-naming-convention no-container no-unnecessary-act; do
  count=$(npx eslint src specs tests 2>&1 | grep -c "testing-library/$rule")
  echo "$rule: $count"
done

echo "=== 其他 rule 殘留（變動觀察）==="
for rule in prefer-user-event no-node-access; do
  count=$(npx eslint src specs tests 2>&1 | grep -c "testing-library/$rule")
  echo "$rule: $count"
done

echo "=== ban-ts-comment（必須 0）==="
npx eslint src specs tests 2>&1 | grep -c "@typescript-eslint/ban-ts-comment"

echo "=== 總 violation 數 ==="
npx eslint src specs tests 2>&1 | tail -3

echo "=== test:browser ==="
npm run test:browser 2>&1 | tail -20

echo "=== test:server ==="
npm run test:server 2>&1 | tail -20

echo "=== handoff.md 更新（§0 + §4）==="
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md | head -25
echo "---"
sed -n '/Session 2/,/^### Session 3\|^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md | head -50

echo "=== git status ==="
git status --short
```

**Failure recovery**：

- 4 條 rule 任一條 ≠ 0 → 回頭重派該 task 的 Engineer
- vitest 紅 → 找出哪 task 後變紅，revert 該 task 改動 + 重派
- handoff 沒更新或更新不完整 → 重派 Engineer 補

---

## Session 2 結束狀態（DOD）

六個 task 全綠後，working tree 應該長這樣：

```text
M  package.json                                     ← Session 1 累積
M  package-lock.json                                ← Session 1 累積
M  eslint.config.mjs                                ← Session 1 累積
M  cspell.json                                      ← Session 2 規劃補詞 (callsite)
M  specs/024-eslint-testing-lib-cleanup/handoff.md  ← Session 1 + Session 2 累積（§2.8 escalation note + §4 Session 2 紀錄）
M  tests/...（多個檔，T5-T9 改動）                    ← Session 2 實作改動
?? specs/024-eslint-testing-lib-cleanup/tasks.md    ← 本檔（先就先 untracked）
?? specs/024-eslint-testing-lib-cleanup/plan.md     ← 同上
```

**ESLint state**：

- 4 條目標 rule 全 = 0
- 其他殘留：~96（no-node-access 89 + prefer-user-event 7，等 Phase 3/4 處理）
- 總 violation 從 303 降到 ~96（**下降 ~68%**，符合 plan §8.1 Phase 2 Checkpoint）

**不**做 Phase 2 commit。Session 2 結束時保持 staged/unstaged 狀態，等 Session 3 接手 Phase 3（prefer-user-event 7 處）。

Commit 時機 → Session 9（Phase 5 Task 5.5）一次處理完整 PR。

---

## 主 agent 派遣 SOP（與 Session 1 相同模式）

```text
for task in [T5, T6, T7, T8, T9, T10]:
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
    4. T10 完成後 update handoff.md「Session 2 Done」section + 更新 §0
```

> 主 agent **不**自己跑 autofix、不自己改測試檔、不自己改 handoff.md。所有有副作用的指令都派 subagent 跑。

---

# Session 3 Tasks — Phase 3：Event API 遷移（prefer-user-event + fireEvent 清零）

> **Source**: `specs/024-eslint-testing-lib-cleanup/plan.md` §5 Phase 3 + §8.2 S3 + §8.4 + §9
> **Goal**: 清掉 Phase 3 event API 遷移：`prefer-user-event` 實際 6 errors → 0，並把 `tests/integration/` 內 8 個可執行 `fireEvent` 用法清到 raw grep 0 references。
> **執行模式**：主 agent 不下場改測試或 config，所有後續修改交 subagent。主 agent 只做派遣、彙整、驗收回饋與最後交接文件更新。
> **Branch**：`024-eslint-testing-lib-cleanup`（worktree 路徑：`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`）
> **承接狀態**：Session 2 已完成並提交在 `a74ca72`；2026-04-28 已先把 `testing-library/prefer-user-event` 恢復 `error`，讓 Session 3 問題在 lint gate 直接可見；`no-node-access` 仍暫時 `off`。

開工前必讀：

1. `plan.md` §5 Phase 3、§8.2、§8.4、§9
2. `handoff.md` §0、§2.9-§2.14、§4 Session 2、§5 checklist
3. 本章 T11-T16，尤其 `prefer-user-event` 6 errors vs `fireEvent` 8 references 的差異

## Parallelism — 共享 worktree 最多同時 2 個 Engineer subagents

| 階段                                     | 並行度        | 原因                                                                                     |
| ---------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| Engineer 執行 T12-T15                    | **2**         | 四個 task 分別碰不同測試檔，可保守平行；同時超過 2 個容易讓 review / git diff 歸因混亂。 |
| 每個 Engineer task 對應 Reviewer task    | **1:1**       | 每個 Engineer 完成後才派該 task Reviewer 驗收；Reviewer 不與同 task Engineer 並行。      |
| T11 Preflight audit                      | **1**         | 只讀現況，必須先完成，避免後續 task 基於錯的 baseline 動手。                             |
| T16 Rule verification + session closeout | **1**         | Repo-wide verification、config 狀態確認、handoff 收尾必須獨占，不與任何 writer 並行。    |
| 主 agent                                 | **0 writers** | 主 agent 不改測試或 config；若 reviewer fail，主 agent只重派 Engineer 修，不直接下場。   |

建議批次：

1. T11 獨占完成。
2. 第一批：T12 + T13 最多 2 個 Engineer 並行；各自完成後派各自 Reviewer。
3. 第二批：T14 + T15 最多 2 個 Engineer 並行；各自完成後派各自 Reviewer。
4. T16 獨占完成。

---

## T11：Preflight audit（只讀確認，不改檔）

**Engineer prompt 要點**：

1. 確認 worktree：
   ```bash
   git status --short
   ```
   預期 clean；若不是 clean，回報所有 dirty path，不要修。
2. 確認 config 暫態：
   ```bash
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   ```
   預期 `prefer-user-event: error`、`no-node-access: off`。`prefer-user-event` 已為 Session 3 打開，`no-node-access` 留給 Phase 4。
3. 確認 `fireEvent` 現況：
   ```bash
   grep -rn "fireEvent" tests/integration/
   ```
   預期 8 個可執行用法：PostCard 5 click、NotificationToast 1 click、ComposeModal 1 generic `fireEvent(dialog, cancelEvent)`、NotificationPanel 1 `fireEvent.error(img)`。注意 raw grep 也會列出 import/comment；實作目標仍是最後 raw grep 0。
   2026-04-28 文件規劃時另看到多個非目標檔的 comment-only hits（例如 `NEVER fireEvent` 測試準則註解）。這些不是 event migration callsite；T11 必須列出它們，交主 agent 決定 T16 raw grep 0 是否包含 comment cleanup，不能讓 Engineer 直接偷改未授權檔。
4. 確認 rule-reported errors 只剩 6：
   ```bash
   npx eslint tests/integration/posts/PostCard.test.jsx tests/integration/notifications/NotificationToast.test.jsx tests/integration/posts/ComposeModal.test.jsx tests/integration/notifications/NotificationPanel.test.jsx --rule '{"testing-library/prefer-user-event":"error"}' 2>&1 | tee /tmp/session3-prefer-user-event.txt
   grep -c "testing-library/prefer-user-event" /tmp/session3-prefer-user-event.txt
   ```
   預期 6：PostCard 5、NotificationToast 1。ComposeModal / NotificationPanel 是 hygiene + plan 目標，不是 rule-reported error。
5. 回報實測數字，不改任何檔。

**禁止行為**：

- 不修改任何檔案。
- 不用 `git add` / commit / push。
- 不把 `prefer-user-event` 的 6 errors 誤寫成 fireEvent 只有 6 references。

**Acceptance Criteria（Reviewer 必驗）**：

1. `git status --short` clean。
2. config 仍為 `prefer-user-event: error`、`no-node-access: off`。
3. `grep -rn "fireEvent" tests/integration/` 實測包含 8 個可執行用法，且分布符合本章 Goal；raw grep 額外 import/comment 行不可誤算成需要更多 event migration。
4. 若 raw grep 顯示四個目標檔以外的 comment-only hits，Reviewer 要列出 path，標成 scope decision；不得自行清掉。
5. `prefer-user-event` rule 強制開啟後實測 6 errors，分布為 PostCard 5 + NotificationToast 1。
6. Engineer 未改任何檔。

**Reviewer 驗收指令**：

```bash
git status --short
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
grep -rn "fireEvent" tests/integration/
npx eslint tests/integration/posts/PostCard.test.jsx tests/integration/notifications/NotificationToast.test.jsx tests/integration/posts/ComposeModal.test.jsx tests/integration/notifications/NotificationPanel.test.jsx --rule '{"testing-library/prefer-user-event":"error"}' 2>&1 | tee /tmp/session3-prefer-user-event-review.txt
grep -c "testing-library/prefer-user-event" /tmp/session3-prefer-user-event-review.txt
git status --short
```

**Failure recovery**：

- Dirty tree → 停止，回報主 agent；不要自行 revert。
- 數字不符或 raw grep 有非目標 comment-only hits → 回報實際分布，主 agent 更新派工前先重新判斷。

---

## T12：PostCard 5x click migration

**Engineer prompt 要點**：

1. 只改 `tests/integration/posts/PostCard.test.jsx`。
2. 將 5 個 `fireEvent.click(...)` 改為 `await user.click(...)`。
3. 每個受影響的 `it` 改成 `async`。
4. 每個受影響的 `it` 自己建立 `const user = userEvent.setup();`，不要跨 test 共用。
5. 移除 `fireEvent` import；保留/新增 `userEvent` import 時沿用檔案既有 import style。
6. 跑：
   ```bash
   npx vitest run tests/integration/posts/PostCard.test.jsx
   npx eslint tests/integration/posts/PostCard.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
   ```
7. 回報改了哪 5 處、vitest / eslint 結果。

**禁止行為**：

- 不改其他檔案。
- 不用 `fireEvent`、不加 eslint disable、不中途改 config。
- 不把 `userEvent.setup()` 放到 `describe` / `beforeEach` 共用。
- 不 commit。

**Acceptance Criteria（Reviewer 必驗）**：

1. `PostCard.test.jsx` 無 `fireEvent` import / reference。
2. 5 個 click 都是 `await user.click(...)`。
3. 受影響 `it` 都是 async，且各自有 `userEvent.setup()`。
4. 該檔 `prefer-user-event` errors = 0。
5. 該檔 Vitest pass。
6. diff 只動 `tests/integration/posts/PostCard.test.jsx`。

**Reviewer 驗收指令**：

```bash
rg -n "fireEvent|userEvent.setup|await user.click|\\bit\\(" tests/integration/posts/PostCard.test.jsx
npx eslint tests/integration/posts/PostCard.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
npx vitest run tests/integration/posts/PostCard.test.jsx
git diff --name-only
git diff tests/integration/posts/PostCard.test.jsx
```

**Failure recovery**：

- ESLint 還有 `prefer-user-event` → 回報殘留行號，重派 Engineer。
- Vitest 紅 → 回報 failing test name + error，重派 Engineer 修 timing/query。
- 改到其他檔 → 回報 off-scope path，主 agent 決定是否重派限縮；Reviewer 不自行 revert。

---

## T13：NotificationToast fake-timer click migration

**Engineer prompt 要點**：

1. 只改 `tests/integration/notifications/NotificationToast.test.jsx`。
2. 將 `fireEvent.click(screen.getByRole('button', { name: /通知/ }))` 改為 `await user.click(...)`。
3. 該 `it` 改成 `async`。
4. 因本檔使用 fake timers，`userEvent.setup()` 必須使用：
   ```js
   const user = userEvent.setup({
     advanceTimers: vi.advanceTimersByTime,
   });
   ```
5. 移除 `fireEvent` import。
6. 跑：
   ```bash
   npx vitest run tests/integration/notifications/NotificationToast.test.jsx
   npx eslint tests/integration/notifications/NotificationToast.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
   ```

**禁止行為**：

- 不改 fake timer 全域策略，除非 Reviewer 回報死鎖且主 agent 重派時明確授權。
- 不退回 `fireEvent`。
- 不加 eslint disable。
- 不改其他檔案、不 commit。

**Acceptance Criteria（Reviewer 必驗）**：

1. `NotificationToast.test.jsx` 無 `fireEvent` import / reference。
2. 該 click 使用 `await user.click(...)`。
3. `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` 存在。
4. 該檔 `prefer-user-event` errors = 0。
5. 該檔 Vitest pass，沒有 fake timer deadlock / timeout。
6. diff 只動 `tests/integration/notifications/NotificationToast.test.jsx`。

**Reviewer 驗收指令**：

```bash
rg -n "fireEvent|userEvent.setup|advanceTimers|await user.click" tests/integration/notifications/NotificationToast.test.jsx
npx eslint tests/integration/notifications/NotificationToast.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
npx vitest run tests/integration/notifications/NotificationToast.test.jsx
git diff --name-only
git diff tests/integration/notifications/NotificationToast.test.jsx
```

**Failure recovery**：

- Vitest timeout / deadlock → 回報 timeout test name；重派 Engineer 優先檢查 `advanceTimers` 是否傳入，必要時才評估單一 `it` 的 timer 切換。
- ESLint 殘留 → 回報行號，重派。
- off-scope diff → 回報 path，不自行 revert。

---

## T14：ComposeModal `<dialog>` cancel event 改 native dispatchEvent

**Engineer prompt 要點**：

1. 只改 `tests/integration/posts/ComposeModal.test.jsx`。
2. 將 generic `fireEvent(dialog, cancelEvent)` 改成：
   ```js
   dialog.dispatchEvent(cancelEvent);
   ```
3. 不用 `userEvent.keyboard('{Escape}')`，因 jsdom 不會自動實作 `<dialog>` ESC → cancel event。
4. 移除 `fireEvent` import。
5. 跑：
   ```bash
   npx vitest run tests/integration/posts/ComposeModal.test.jsx
   npx eslint tests/integration/posts/ComposeModal.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
   ```

**禁止行為**：

- 不改 production component。
- 不把 cancel event 改成 `userEvent.keyboard`。
- 不加 eslint disable。
- 不改其他檔案、不 commit。

**Acceptance Criteria（Reviewer 必驗）**：

1. `ComposeModal.test.jsx` 無 `fireEvent` import / reference。
2. cancel event 使用 `dialog.dispatchEvent(cancelEvent)`。
3. `cancelEvent.defaultPrevented` 既有 assertion 保留。
4. 該檔 Vitest pass。
5. diff 只動 `tests/integration/posts/ComposeModal.test.jsx`。

**Reviewer 驗收指令**：

```bash
rg -n "fireEvent|dispatchEvent|cancelEvent|userEvent.keyboard" tests/integration/posts/ComposeModal.test.jsx
npx eslint tests/integration/posts/ComposeModal.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
npx vitest run tests/integration/posts/ComposeModal.test.jsx
git diff --name-only
git diff tests/integration/posts/ComposeModal.test.jsx
```

**Failure recovery**：

- Vitest 紅 → 回報 failing assertion；重派 Engineer 保留 native cancel event 路線修。
- 出現 `userEvent.keyboard` 或 eslint disable → 回報違反禁止行為，重派。
- off-scope diff → 回報 path，不自行 revert。

---

## T15：NotificationPanel img error 改 native dispatchEvent

**Engineer prompt 要點**：

1. 只改 `tests/integration/notifications/NotificationPanel.test.jsx`。
2. 將 `fireEvent.error(img)` 改成：
   ```js
   img.dispatchEvent(new Event('error'));
   ```
3. 移除 `fireEvent` import。
4. 若 React state update 未 flush，將該 `it` 改成 `async` 並用 `waitFor` 包 fallback assertion：
   ```js
   await waitFor(() => {
     expect(screen.queryByRole('img', { name: 'Test Actor 的頭像' })).not.toBeInTheDocument();
   });
   ```
   只在測試實際需要時新增 `waitFor` import。
5. 跑：
   ```bash
   npx vitest run tests/integration/notifications/NotificationPanel.test.jsx
   npx eslint tests/integration/notifications/NotificationPanel.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
   ```

**禁止行為**：

- 不退回 `fireEvent.error`。
- 不改 production component。
- 不加 eslint disable。
- 不改其他檔案、不 commit。

**Acceptance Criteria（Reviewer 必驗）**：

1. `NotificationPanel.test.jsx` 無 `fireEvent` import / reference（comment 也要清掉或改寫）。
2. img error 使用 `img.dispatchEvent(new Event('error'))`。
3. 若同步 assertion 不穩，使用 `async` + `waitFor`，而不是退回 fireEvent。
4. 該檔 Vitest pass。
5. diff 只動 `tests/integration/notifications/NotificationPanel.test.jsx`。

**Reviewer 驗收指令**：

```bash
rg -n "fireEvent|dispatchEvent|waitFor|new Event\\('error'\\)" tests/integration/notifications/NotificationPanel.test.jsx
npx eslint tests/integration/notifications/NotificationPanel.test.jsx --rule '{"testing-library/prefer-user-event":"error"}'
npx vitest run tests/integration/notifications/NotificationPanel.test.jsx
git diff --name-only
git diff tests/integration/notifications/NotificationPanel.test.jsx
```

**Failure recovery**：

- Vitest 紅且 img 還存在 → 重派 Engineer 改 `async` + `waitFor`。
- comment/import 還殘留 `fireEvent` → 重派 Engineer 清掉。
- off-scope diff → 回報 path，不自行 revert。

---

## T16：Rule verification + session closeout

**Engineer prompt 要點**：

1. 獨占執行；確認 T12-T15 reviewers 都 PASS 後才開始。
2. 只允許改：
   - `eslint.config.mjs`：只確認 `'testing-library/prefer-user-event': 'error'` 且 `'testing-library/no-node-access': 'off'`；若 `prefer-user-event` 被誤關才改回 `error`
   - `specs/024-eslint-testing-lib-cleanup/handoff.md`：更新 Session 3 完成狀態與驗證結果
3. 驗證 `fireEvent` 清零：
   ```bash
   grep -rn "fireEvent" tests/integration/
   ```
   預期無輸出，exit 1 可接受。
4. 驗證 repo-wide lint：
   ```bash
   npx eslint src specs tests 2>&1 | tee /tmp/session3-final-lint.txt
   grep -oE 'testing-library/[a-z-]+' /tmp/session3-final-lint.txt | sort | uniq -c | sort -rn
   tail -3 /tmp/session3-final-lint.txt
   ```
   預期只剩 `testing-library/no-node-access` 83 errors；`prefer-user-event` 0。
5. 跑 browser/server：
   ```bash
   npm run test:browser
   npm run test:server
   ```
   若 server 在 sandbox 內因 Firebase emulator port `EPERM` 失敗，回報主 agent 申請 sandbox 外重跑，不自行改測試。
6. 更新 `handoff.md`：
   - §0 目前 Session → `Session 3 完成；待 Session 4 接手 Phase 4 no-node-access`
   - §5 checklist → 下一 session 聚焦 Phase 4，並保留 Session 3 驗證結果
   - §4 append `Session 3（Phase 3）— 完成`，記錄 T11-T16、subagent 並行、lint/test/grep 結果
7. 不 commit / 不 git add / 不 push。

**禁止行為**：

- 不把 `testing-library/no-node-access` 打回 error；Phase 4 才做。
- 不改 package / tests 以外新增檔；T16 自己不改測試。
- 不用 `git add` / commit / push。
- 不在 repo-wide verification 跑的同時讓其他 writer 繼續改檔。

**Acceptance Criteria（Reviewer 必驗）**：

1. `eslint.config.mjs` 中 `prefer-user-event: error`、`no-node-access: off`。
2. `grep -rn "fireEvent" tests/integration/` 無輸出。
3. repo-wide lint 只剩 `testing-library/no-node-access` 83 errors；`prefer-user-event` 0。
4. `npm run test:browser` pass。
5. `npm run test:server` pass（必要時 sandbox 外重跑）。
6. `handoff.md` §0、§4、§5 已更新，且紀錄 Session 3 實測。
7. 未 staged、未 commit、未 push。

**Reviewer 驗收指令**：

```bash
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
grep -rn "fireEvent" tests/integration/
npx eslint src specs tests 2>&1 | tee /tmp/session3-final-lint-review.txt
grep -c "testing-library/prefer-user-event" /tmp/session3-final-lint-review.txt
grep -c "testing-library/no-node-access" /tmp/session3-final-lint-review.txt
tail -3 /tmp/session3-final-lint-review.txt
npm run test:browser
npm run test:server
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/Session 3/,/^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
git status --short
```

**Failure recovery**：

- `fireEvent` 有殘留 → 回報檔案/行號，重派對應 T12-T15 Engineer。
- `prefer-user-event` 仍報錯 → 回報行號，重派對應 Engineer；不要關 rule。
- lint 不只 `no-node-access` → 回報 rule 分布，主 agent 判斷是否 regression。
- browser/server fail → 回報 failing suite/test；主 agent 重派對應 Engineer 或申請 sandbox 外 server run。
- handoff 未更新 → 重派 T16 Engineer 補文件，不改測試。

---

## Session 3 結束狀態（DOD）

- `testing-library/prefer-user-event`: 保持 `error`，且 repo-wide 0 errors。
- `testing-library/no-node-access`: 保持 `off`，Phase 4 才恢復。
- `grep -rn "fireEvent" tests/integration/`: raw grep 0 references。
- `PostCard` 5x click、`NotificationToast` 1x fake-timer click、`ComposeModal` cancel、`NotificationPanel` img error 全改完。
- browser/server tests pass。
- `handoff.md` 記錄 Session 3 完成 evidence。
- 不 commit、不 stage、不 push。

---

# Session 4 Tasks — Phase 4.1：NavbarMobile no-node-access cleanup

> **Source**: `specs/024-eslint-testing-lib-cleanup/plan.md` §8.2 Session 4, adjusted by current preflight facts.
> **Goal**: 只清 `tests/integration/navbar/NavbarMobile.test.jsx` 的 `testing-library/no-node-access`，必要時只補 Navbar mobile affordance。
> **執行模式**：主 agent 只派工、彙整、驗收回饋；所有實作與後續修正都由 Engineer subagent 做，Reviewer subagent 依標準驗收。
> **Allowed files**：`tests/integration/navbar/NavbarMobile.test.jsx`，以及必要 affordance 的 `src/components/Navbar/Navbar.jsx` / `src/components/Navbar/MobileDrawer.jsx`。
> **Forbidden files**：不要改 `eslint.config.mjs`、不要碰 NavbarDesktop / notifications / posts / profile / weather / toast / strava、不要改非上述 allowed files。

## Session 4 Parallelism — 同時最多 2 個 subagents

| 階段                     | 並行度        | 原因                                                                                                           |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------- |
| Writer Engineer          | **1**         | 主要修改集中在同一個 `NavbarMobile.test.jsx`；同時兩個 Engineer 寫同一檔會互相覆蓋或造成 line/range 判讀失真。 |
| Reviewer                 | **1**         | Reviewer 必須在 Engineer 交付後依目標 range 驗收。                                                             |
| Engineer + Reviewer 配對 | **最多 2 個** | 允許「1 Engineer + 1 Reviewer」形成驗收配對；不得同時開兩個 Engineer 寫同一檔。                                |
| T17 / T23                | **1**         | preflight / closeout 是獨占任務，不能與任何 writer 並行。                                                      |

**Reviewer FAIL 規則**：Reviewer 一旦 FAIL，主 agent 只能把 FAIL report 轉交並重派 Engineer/subagent 修正；主 agent 不可自己修改測試、component、config 或文件來補洞。

**Session 4 已驗事實（要沿用，不要倒退）**：

- `testing-library/no-node-access` 已由前置 Engineer 改成 `error`，Reviewer PASS；Session 4 不要把 rule 關回 `off`。
- `MobileDrawer.jsx` 目前已有 `role="dialog"`、`aria-modal="true"`、`aria-label="導覽選單"`；Session 4 不應盲目要求「加 dialog」。
- `npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish` 目前 exit 1，raw 42 `testing-library/no-node-access` errors；實際是 22 個 unique line/column sites，因 rule 會對同一 callsite 重複報同 loc。
- 進度判斷用 unique `line:column` / task target range，不只看 raw problem count。
- Session 4 scope 只做 `NavbarMobile.test.jsx` 和必要 affordance 的 `Navbar.jsx` / `MobileDrawer.jsx`；S5 的 NavbarDesktop / notifications，以及 S6-S8 domain 不得混進來。
- S4 完成後 repo-wide lint 預期仍可能因 S5-S8 domain fail；closeout 只要求 `NavbarMobile.test.jsx` 0 `no-node-access`，並在 handoff 記錄剩餘 domain 交給 S5+。

---

## T17：Session 4 preflight audit（只讀）

**Engineer prompt 要點**：

1. 只讀 audit，不改任何檔案。
2. 確認 rule 狀態：
   ```bash
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   ```
   預期 `prefer-user-event: error`、`no-node-access: error`。
3. 確認 git 狀態：
   ```bash
   git status --short
   git diff --name-only
   ```
   只回報，不清理、不 revert。
4. 跑 target lint 並產出 raw + unique report：
   ```bash
   npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-navbar-mobile-preflight.txt
   rg -n "^[[:space:]]+[0-9]+:[0-9]+.*testing-library/no-node-access" /tmp/s4-navbar-mobile-preflight.txt
   rg -o "^[[:space:]]+[0-9]+:[0-9]+" /tmp/s4-navbar-mobile-preflight.txt | sort -u
   ```
5. 讀取 mobile drawer affordance 現況：
   ```bash
   rg -n "role=\"dialog\"|aria-modal|aria-label=\"導覽選單\"|data-testid|hamburgerLine|overlay|mobile-drawer" src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx tests/integration/navbar/NavbarMobile.test.jsx
   ```
6. 產出分組報告，至少包含：
   - config rule 狀態
   - dirty / changed files
   - raw errors = 42，unique line:col = 22（若 drift，要列實測）
   - `MobileDrawer` dialog a11y 是否已存在
   - 建議 target range 分組：T19 drawer panel、T20 auth section、T21 state management、T22 accessibility/focus

**禁止行為**：

- 不改檔、不執行 formatter、不 git add/commit/push。
- 不把 `no-node-access` 關回 `off`。
- 不把 raw 42 直接當成 42 個獨立修點；必須 dedupe unique `line:col`。

**Acceptance Criteria（Reviewer 必驗）**：

1. Engineer report 有 `eslint.config.mjs` rule 狀態，且 `no-node-access` 是 `error`。
2. 有 `git status --short` / `git diff --name-only` 原樣摘要。
3. 有 `/tmp/s4-navbar-mobile-preflight.txt` raw output，並列 raw count + unique `line:col` count。
4. 有確認 `MobileDrawer.jsx` 已有 dialog role/modal/label。
5. 有明確 T19-T22 target range 分組，後續 reviewer 可照 range 驗收。
6. 無任何檔案被 T17 修改。

**Reviewer 驗收指令**：

```bash
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
git status --short
git diff --name-only
test -s /tmp/s4-navbar-mobile-preflight.txt && echo OK
rg -n "testing-library/no-node-access" /tmp/s4-navbar-mobile-preflight.txt | wc -l
rg -o "^[[:space:]]+[0-9]+:[0-9]+" /tmp/s4-navbar-mobile-preflight.txt | sort -u | wc -l
rg -n "role=\"dialog\"|aria-modal=\"true\"|aria-label=\"導覽選單\"" src/components/Navbar/MobileDrawer.jsx
git diff -- specs/024-eslint-testing-lib-cleanup/tasks.md specs/024-eslint-testing-lib-cleanup/handoff.md src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx tests/integration/navbar/NavbarMobile.test.jsx
```

**Failure recovery**：

- 若 T17 改了檔案：Reviewer 回報 path；主 agent 重派 Engineer 釐清並請 user 決定是否保留，不自行 revert。
- 若 unique count / grouping 不清楚：重派 T17 Engineer 補報告。
- 若 rule 不是 `error`：停止 S4 實作，回報主 agent；不得自行改 config。

---

## T18：Minimal component affordances

**Engineer prompt 要點**：

1. 只允許改 `src/components/Navbar/Navbar.jsx` / `src/components/Navbar/MobileDrawer.jsx`；不要改 test。
2. 先讀 T17 report。若 `MobileDrawer` 已有 `role="dialog"`、`aria-modal="true"`、`aria-label="導覽選單"`，不要重複加或改 label。
3. 建議最小 affordance：
   - `Navbar.jsx` 的三個 hamburger line `<span className={styles.hamburgerLine} />` 補：
     ```jsx
     aria-hidden="true"
     data-testid="hamburger-line"
     ```
   - `MobileDrawer.jsx` overlay 補：
     ```jsx
     data-testid="mobile-drawer-overlay"
     ```
4. 不要改 drawer role / label，除非 T17 實測發現缺失；若缺失，要在 report 說明為何與本文件已驗事實 drift。
5. 跑：
   ```bash
   npx eslint src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx
   npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
   ```

**禁止行為**：

- 不改 `tests/integration/navbar/NavbarMobile.test.jsx`。
- 不改 `eslint.config.mjs`。
- 不新增可見文字、不改 CSS class、不改 drawer open/close 行為。
- 不把 hamburger line 改成可聚焦或可讀出的 a11y 內容；它們是 decorative lines。
- 不改 NavbarDesktop / UserMenu / notifications。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只包含 `src/components/Navbar/Navbar.jsx` / `src/components/Navbar/MobileDrawer.jsx`。
2. `MobileDrawer` 仍有 `role="dialog"`、`aria-modal="true"`、`aria-label="導覽選單"`，且 label 沒被改掉。
3. Hamburger line spans 有穩定 `data-testid="hamburger-line"`，且 `aria-hidden="true"`。
4. Overlay 有 `data-testid="mobile-drawer-overlay"`。
5. Component lint pass。
6. `NavbarMobile.test.jsx` targeted Vitest pass。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx
rg -n "data-testid=\"hamburger-line\"|aria-hidden=\"true\"|data-testid=\"mobile-drawer-overlay\"|role=\"dialog\"|aria-modal=\"true\"|aria-label=\"導覽選單\"" src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx
npx eslint src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx
npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
```

**Failure recovery**：

- Off-scope diff → Reviewer 回報 path；主 agent 重派 Engineer 限縮，不自行 revert。
- Drawer role/label 被誤改 → Reviewer FAIL，重派 Engineer 恢復語意並保留必要 affordance。
- Vitest 紅 → Reviewer 回報 failing test name + error，重派 Engineer 修 component affordance，不碰 test。

---

## T19：`NavbarMobile.test.jsx` T005/T006 drawer panel cleanup

**Engineer prompt 要點**：

1. 只改 `tests/integration/navbar/NavbarMobile.test.jsx` 的 T005/T006 drawer panel + overlay target range；不要碰 auth/state/focus blocks。
2. 用 role query 取代 `document.getElementById('mobile-drawer')`：
   ```js
   const drawer = screen.getByRole('dialog', { name: '導覽選單' });
   ```
3. 用 `screen.getAllByTestId('hamburger-line')` 取代 hamburger line 的 DOM selector / `.children` 類檢查。
4. 用 `within(drawer)` 查 drawer 內部 link/button/text；不要從 drawer node 讀 `.querySelector`、`.children`、`.className`。
5. Overlay 若需要互動，用 T18 的 `screen.getByTestId('mobile-drawer-overlay')`。
6. 用 jest-dom matcher 取代 DOM property/class reads，例如 `toHaveAttribute`、`toHaveClass`、`toBeVisible`、`not.toHaveClass`。
7. 跑：
   ```bash
   npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t19-navbar-mobile.txt
   npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
   ```

**禁止行為**：

- 不改 component；若發現缺 affordance，停止並回報主 agent 要補 T18，不要在 T19 偷改。
- 不改 T20-T22 target blocks。
- 不用 `document.*`、`Element.querySelector*`、`.children`、`.parentElement`、`.className`。
- 不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `NavbarMobile.test.jsx`。
2. T005/T006 target range 不再有 `testing-library/no-node-access` unique line:col。
3. T005/T006 使用 `screen.getByRole('dialog', { name: '導覽選單' })` 或 helper 包裝後等價呼叫。
4. Hamburger lines 使用 `screen.getAllByTestId('hamburger-line')`。
5. Drawer 內查詢使用 `within(drawer)`。
6. Targeted Vitest pass。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/navbar/NavbarMobile.test.jsx
rg -n "document\\.|querySelector|children|parentElement|className|getByRole\\('dialog'|getAllByTestId\\('hamburger-line'|within\\(" tests/integration/navbar/NavbarMobile.test.jsx
npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t19-review.txt
rg -n "testing-library/no-node-access" /tmp/s4-t19-review.txt
npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
```

**Failure recovery**：

- T005/T006 target range 還有 no-node-access → Reviewer 回報 line:col 和 test name，主 agent 重派 Engineer 修同 range。
- Diff 碰到非 target blocks → Reviewer FAIL，主 agent 重派 Engineer 拆回正確 scope；主 agent 不自行改。
- Vitest 紅 → 回報 failing test/error，重派 Engineer 修 query/timing。

---

## T20：`NavbarMobile.test.jsx` auth section cleanup

**Engineer prompt 要點**：

1. 只改 `NavbarMobile.test.jsx` auth describe block；沿用 T19 建立的 helper（例如 `getDrawer()`）可接受。
2. Drawer 查詢統一走：
   ```js
   const drawer = screen.getByRole('dialog', { name: '導覽選單' });
   const drawerScope = within(drawer);
   ```
3. Auth section 內所有 assertions 改用 `within(drawer)` / `screen` / jest-dom matcher。
4. 不讀 `document.getElementById('mobile-drawer')`、`.querySelector`、`.children`、`.className`。
5. 跑：
   ```bash
   npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t20-navbar-mobile.txt
   npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
   ```

**禁止行為**：

- 不改 component。
- 不改 T21/T22 target blocks。
- 不加 eslint disable。
- 不用 DOM node traversal 或 raw class string 檢查。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `NavbarMobile.test.jsx`。
2. Auth target range 不再有 `testing-library/no-node-access` unique line:col。
3. Auth assertions 使用 `within(drawer)` / semantic queries。
4. 沒新增 `document.*` / `querySelector*` / `.children` / `.className`。
5. Targeted Vitest pass。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/navbar/NavbarMobile.test.jsx
rg -n "describe\\(|document\\.|querySelector|children|parentElement|className|getByRole\\('dialog'|within\\(" tests/integration/navbar/NavbarMobile.test.jsx
npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t20-review.txt
rg -n "testing-library/no-node-access" /tmp/s4-t20-review.txt
npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
```

**Failure recovery**：

- Auth target range 還有 no-node-access → Reviewer 回報 line:col/test name，重派 Engineer 修 auth block。
- Helper 改壞前面 T19 → Reviewer 回報 regression range，重派 Engineer 修 helper。
- Vitest 紅 → 回報 failing test/error，重派 Engineer。

---

## T21：`NavbarMobile.test.jsx` state management cleanup

**Engineer prompt 要點**：

1. 只改 `NavbarMobile.test.jsx` state management target range。
2. Hamburger button 用 role query，不用 selector：
   ```js
   screen.getByRole('button', { name: /開啟導覽選單|關閉導覽選單/ });
   ```
   若 Testing Library 支援且語意清楚，可用 `{ expanded: true }` / `{ expanded: false }`，但不得碰 DOM selector。
3. Overlay 用 `screen.getByTestId('mobile-drawer-overlay')`。
4. Drawer state 用 matcher：
   - `expect(drawer).toHaveClass(...)`
   - `expect(drawer).toHaveAttribute('aria-modal', 'true')`
   - `expect(button).toHaveAttribute('aria-expanded', 'true')`
     不讀 `.className`。
5. 跑：
   ```bash
   npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t21-navbar-mobile.txt
   npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
   ```

**禁止行為**：

- 不改 component，除非 T18 已明確缺 affordance 且主 agent 重新派工。
- 不用 `document.querySelector('[aria-controls="mobile-drawer"]')`。
- 不讀 `.className` / `.parentElement` / `.children`。
- 不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. State management target range 不再有 `testing-library/no-node-access` unique line:col。
2. Hamburger 查詢使用 role query。
3. Overlay 查詢使用 `mobile-drawer-overlay` test id。
4. Drawer open/closed state 不讀 `.className`，改用 matcher。
5. Targeted Vitest pass。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/navbar/NavbarMobile.test.jsx
rg -n "aria-controls=\\\"mobile-drawer\\\"|document\\.|querySelector|children|parentElement|className|getByTestId\\('mobile-drawer-overlay'|getByRole\\('button'|toHaveAttribute\\('aria-expanded'|toHaveClass" tests/integration/navbar/NavbarMobile.test.jsx
npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t21-review.txt
rg -n "testing-library/no-node-access" /tmp/s4-t21-review.txt
npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
```

**Failure recovery**：

- State target range 還有 no-node-access → Reviewer 回報 line:col/test name，重派 Engineer。
- Overlay test id 缺失導致無法查詢 → 回 T18 補 affordance，不在 T21 偷改 component。
- Vitest 紅 → 回報 failing test/error，重派 Engineer。

---

## T22：`NavbarMobile.test.jsx` accessibility/focus cleanup

**Engineer prompt 要點**：

1. 只改 `NavbarMobile.test.jsx` accessibility / focus target range。
2. 用 `toHaveFocus()` 取代 `document.activeElement`：
   ```js
   expect(closeButton).toHaveFocus();
   ```
3. Drawer 一律用 `screen.getByRole('dialog', { name: '導覽選單' })` 或既有 `getDrawer()` helper。
4. Focus / keyboard assertions 使用 user-level queries + jest-dom matcher，不讀 raw DOM traversal。
5. 跑：
   ```bash
   npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t22-navbar-mobile.txt
   npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
   ```

**禁止行為**：

- 不改 component。
- 不用 `document.activeElement`、`document.getElementById`、`querySelector*`、`.children`、`.className`。
- 不加 eslint disable。
- 不擴 scope 到 NavbarDesktop 或其他 domain。

**Acceptance Criteria（Reviewer 必驗）**：

1. Accessibility/focus target range 不再有 `testing-library/no-node-access` unique line:col。
2. `document.activeElement` 已改成 `toHaveFocus()` matcher。
3. Drawer 用 role query。
4. 全檔 `NavbarMobile.test.jsx` 的 `testing-library/no-node-access` = 0。
5. Targeted Vitest pass。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/navbar/NavbarMobile.test.jsx
rg -n "activeElement|document\\.|querySelector|children|parentElement|className|toHaveFocus|getByRole\\('dialog'" tests/integration/navbar/NavbarMobile.test.jsx
npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish 2>&1 | tee /tmp/s4-t22-review.txt
rg -n "testing-library/no-node-access" /tmp/s4-t22-review.txt
npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
```

**Failure recovery**：

- 全檔仍有 no-node-access → Reviewer 回報 remaining unique line:col；主 agent 只重派 Engineer/subagent 補修，不自行改。
- Focus test flaky → 回報 failing test/error；重派 Engineer 改 user interaction / focus target，不退回 DOM read。
- Off-scope diff → Reviewer FAIL，重派 Engineer 限縮。

---

## T23：Session 4 closeout + handoff update

**Engineer prompt 要點**：

1. 獨占執行；確認 T17-T22 reviewers 都 PASS 後才開始。
2. 只允許改 `specs/024-eslint-testing-lib-cleanup/handoff.md`；不得改 test/component/config。
3. 驗證：
   ```bash
   npx eslint tests/integration/navbar/NavbarMobile.test.jsx
   npx eslint src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx tests/integration/navbar/NavbarMobile.test.jsx
   npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
   ```
4. 視需要加跑 navbar related vitest：
   ```bash
   npx vitest run tests/integration/navbar
   ```
5. 更新 `handoff.md`：
   - §0 最新狀態：Session 4 完成或執行完成待下一 session；`no-node-access` 維持 `error`。
   - §2 pitfalls：保留本輪三個坑與任何新踩坑。
   - §4 append `Session 4（Phase 4.1 NavbarMobile）— 完成`，記錄 T17-T23、raw/unique count、驗證指令結果、剩餘 domain 交 S5+。
   - §5 下一 session checklist：S5 只接 NavbarDesktop + notifications，不回頭改 S4 scope。
6. 不 git add / commit / push。

**禁止行為**：

- 不改 `eslint.config.mjs`。
- 不改 `src/**` / `tests/**`。
- 不為了 repo-wide lint 全綠去修 S5-S8 domain。
- 不加 eslint disable，不關 rule。
- 不 git add / commit / push。

**Acceptance Criteria（Reviewer 必驗）**：

1. `NavbarMobile.test.jsx` ESLint exit 0，且 `testing-library/no-node-access` = 0。
2. Component + target test lint exit 0。
3. Targeted Vitest pass。
4. 若跑 `tests/integration/navbar`，結果已寫進 handoff。
5. `handoff.md` §0、§2、§4、§5 已更新。
6. `eslint.config.mjs` 未被 T23 修改；`no-node-access` 仍是 `error`。
7. 未 staged、未 commit、未 push。

**Reviewer 驗收指令**：

```bash
npx eslint tests/integration/navbar/NavbarMobile.test.jsx
npx eslint src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx tests/integration/navbar/NavbarMobile.test.jsx
npx vitest run tests/integration/navbar/NavbarMobile.test.jsx
rg -n "'testing-library/no-node-access': 'error'" eslint.config.mjs
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/Session 4/,/^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/^## 5\./,/^## 6\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
git status --short
git diff --name-only
```

**Failure recovery**：

- `NavbarMobile.test.jsx` lint still fails → Reviewer 回報 rule + line:col；主 agent 重派對應 T19-T22 Engineer。
- Component lint / Vitest fail → 回報 failing command/test；重派對應 Engineer。
- `handoff.md` 未更新或寫成 repo-wide 已全綠 → 重派 T23 Engineer 修文件。
- 發現 `eslint.config.mjs` 被改或 rule 被關 → Reviewer FAIL；主 agent 不自行修，重派 Engineer 並要求保留前置 Reviewer PASS 的 config 狀態。

## Session 4 結束狀態（DOD）

- `testing-library/no-node-access`: 維持 `error`。
- `tests/integration/navbar/NavbarMobile.test.jsx`: 0 `testing-library/no-node-access` errors。
- 必要 component affordance 僅限 `Navbar.jsx` / `MobileDrawer.jsx`。
- repo-wide lint 仍可能因 S5-S8 domain fail；不要把剩餘 domain 混進 S4。
- `handoff.md` 記錄 Session 4 evidence 與 S5 checklist。
- 不 commit、不 stage、不 push。

# Session 5 Tasks — Phase 4.1/4.3：NavbarDesktop + NotificationBell SVG no-node-access cleanup

> **Source**: `specs/024-eslint-testing-lib-cleanup/plan.md` §8.2 S5, adjusted by fresh read-only audits from 2026-04-28.
> **Goal**: 只清 S5 scope：`NavbarDesktop.test.jsx` + `NotificationBell.test.jsx` 的 `testing-library/no-node-access`。`NotificationPanel.test.jsx` 的 unreadDot 是 S6，不混進本 session。
> **Allowed files**:
>
> - `src/components/Navbar/UserMenu.jsx`
> - `tests/integration/navbar/NavbarDesktop.test.jsx`
> - `src/components/Notifications/NotificationBell.jsx`
> - `tests/integration/notifications/NotificationBell.test.jsx`
> - `specs/024-eslint-testing-lib-cleanup/handoff.md`（T29 closeout only）
>   **Forbidden files**：不要改 `eslint.config.mjs`、NavbarMobile / `Navbar.jsx` / `MobileDrawer.jsx`、`NotificationPanel.test.jsx`、`NotificationItem.jsx`、S6-S8 domain、package files。

---

## Session 5 Fresh Audit 摘要（planning evidence）

NavbarDesktop fresh lint:

```text
npx eslint tests/integration/navbar/NavbarDesktop.test.jsx --format stylish

159:36  testing-library/no-node-access
159:36  testing-library/no-node-access
210:29  testing-library/no-node-access
210:29  testing-library/no-node-access
327:23  testing-library/no-node-access
342:23  testing-library/no-node-access
357:23  testing-library/no-node-access
```

- Raw count = 7
- Unique line:col = 5
- 修法分類：
  - `159:36` skeleton：component 加最小 `data-testid`
  - `210:29` fallback avatar SVG：component SVG 改 `role="img" aria-label="預設使用者頭像"`
  - `327:23`, `342:23`, `357:23` focus：`document.activeElement` 改 `toHaveFocus()`

Notifications fresh lint:

```text
npx eslint tests/integration/notifications/NotificationBell.test.jsx tests/integration/notifications/NotificationPanel.test.jsx --format stylish

NotificationBell.test.jsx
  276:22  testing-library/no-node-access
  276:22  testing-library/no-node-access

NotificationPanel.test.jsx
  235:29  testing-library/no-node-access
  235:29  testing-library/no-node-access
  245:29  testing-library/no-node-access
  245:29  testing-library/no-node-access
```

- NotificationBell raw count = 2, unique line:col = 1
- NotificationPanel unreadDot raw count = 4, unique line:col = 2
- **S5/S6 邊界**：`NotificationBell` SVG 是 S5；`NotificationPanel` unreadDot 是 S6。Plan §8.2 寫「NotificationPanel SVG」已不符合 current code/lint，不要硬塞進 S5。

---

## Parallelism — 同時最多開 4 個 subagents（2 Engineer + 2 Reviewer）

| 類型            | 上限                        | 規則                                                                                                                   |
| --------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Engineer writer | **2**                       | NavbarDesktop track 與 NotificationBell track 檔案不重疊，可同時做。不得兩個 Engineer 寫同一檔。                       |
| Reviewer        | **2**                       | 每個 Engineer task 完成後，配一個 Reviewer 依 acceptance criteria 驗收；Reviewer 可與另一個 disjoint Engineer 同時跑。 |
| Closeout        | **1 Engineer + 1 Reviewer** | T29 handoff/update/verification 獨占，不與任何 writer 並行。                                                           |

> 實務排程：T24 先獨占 preflight；T25→T26→T27 是 NavbarDesktop track sequential；T28 可與 NavbarDesktop track 並行；每個 Engineer 完成後立刻派對應 Reviewer。Reviewer FAIL 時，主 agent 只重派 Engineer/subagent 修，不自行改。

---

## T24：Session 5 preflight audit + scope reconciliation

**Engineer prompt 要點**：

1. 只讀，不改檔。
2. 確認目前 config：
   ```bash
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   ```
   預期兩條都是 `error`。注意 `no-node-access` 目前實際在 line ~396；不要死背舊 line 395。
3. 跑 fresh lint：
   ```bash
   npx eslint tests/integration/navbar/NavbarDesktop.test.jsx --format stylish 2>&1 | tee /tmp/s5-navbar-desktop-preflight.txt
   npx eslint tests/integration/notifications/NotificationBell.test.jsx tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s5-notifications-preflight.txt
   ```
4. 回報 raw count + unique line:col + test names。
5. 明確標出：`NotificationPanel.test.jsx` unreadDot 屬 S6，本 session 不修。

**禁止行為**：

- 不改任何檔案。
- 不重寫 tasks/handoff。
- 不關 ESLint rule、不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. Engineer report 有 config rule 狀態，且 `no-node-access` 是 `error`。
2. `NavbarDesktop.test.jsx` fresh lint 有 raw/unique count 與 test name 對照。
3. Notification fresh lint 把 `NotificationBell` 與 `NotificationPanel` 分開列。
4. 明確宣告 `NotificationPanel` deferred to S6。
5. `git status --short` 沒有因 T24 增加新的 dirty files。

**Reviewer 驗收指令**：

```bash
git status --short
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
npx eslint tests/integration/navbar/NavbarDesktop.test.jsx --format stylish 2>&1 | tee /tmp/s5-t24-navbar-review.txt
npx eslint tests/integration/notifications/NotificationBell.test.jsx tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s5-t24-notifications-review.txt
rg -n "testing-library/no-node-access" /tmp/s5-t24-navbar-review.txt /tmp/s5-t24-notifications-review.txt
```

**Failure recovery**：

- Config 不是 `error` → 停下回報；不得自行關/開 rule。
- Fresh lint 與 planning evidence 差很多 → 更新 task 範圍前先回報主 agent。
- T24 造成 dirty files → Reviewer FAIL，重派 Engineer 清理自己造成的暫存檔或誤改。

---

## T25：UserMenu minimal affordance for NavbarDesktop

**Engineer prompt 要點**：

1. 只改 `src/components/Navbar/UserMenu.jsx`。
2. Skeleton loading placeholder 加最小 test hook：
   ```jsx
   <div className={styles.skeleton} data-testid="user-menu-skeleton" />
   ```
   若同時加 `aria-hidden="true"`，需在 report 說明不改 loading 語意。
3. Fallback avatar SVG 從 `aria-hidden="true"` 改為可由 role query 找到：
   ```jsx
   role="img"
   aria-label="預設使用者頭像"
   ```
4. 不改登入、登出、dropdown、focus、Firebase auth 行為。
5. 跑：
   ```bash
   npx eslint src/components/Navbar/UserMenu.jsx
   ```

**禁止行為**：

- 不改 `NavbarDesktop.test.jsx`（留給 T26/T27）。
- 不改 `Navbar.jsx` / `MobileDrawer.jsx` / notifications。
- 不加 eslint disable。
- 不用 role/name 包裝 skeleton；skeleton 是視覺 placeholder，不是互動或狀態訊息。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `src/components/Navbar/UserMenu.jsx`。
2. Skeleton 有 `data-testid="user-menu-skeleton"`。
3. Fallback SVG 有 `role="img"` 與 `aria-label="預設使用者頭像"`，且不再是 `aria-hidden="true"`。
4. 登入按鈕、avatar button、menu roles、sign-out handler 沒被改。
5. `npx eslint src/components/Navbar/UserMenu.jsx` exit 0。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/components/Navbar/UserMenu.jsx
rg -n "user-menu-skeleton|role=\"img\"|aria-label=\"預設使用者頭像\"|aria-hidden=\"true\"|signInWithGoogle|role=\"menu\"|role=\"menuitem\"" src/components/Navbar/UserMenu.jsx
npx eslint src/components/Navbar/UserMenu.jsx
```

**Failure recovery**：

- SVG 仍 `aria-hidden` → 重派 Engineer 修。
- 改到登入/dropdown 邏輯 → Reviewer FAIL，重派 Engineer 限縮 diff。
- Component lint fail → 回報錯誤，重派 Engineer。

---

## T26：NavbarDesktop auth UI no-node-access cleanup

**Engineer prompt 要點**：

1. 只改 `tests/integration/navbar/NavbarDesktop.test.jsx` 的 `T010: Auth UI section`。
2. Skeleton assertion 改用 T25 affordance：
   ```js
   expect(screen.getByTestId('user-menu-skeleton')).toBeInTheDocument();
   ```
3. Fallback SVG assertion 改用 role query：
   ```js
   const fallbackAvatar = within(avatarBtn).getByRole('img', { name: '預設使用者頭像' });
   expect(fallbackAvatar).toBeInTheDocument();
   ```
4. 移除 `baseElement` 解構與 `avatarBtn.querySelector('svg')`。
5. 跑：
   ```bash
   npx eslint tests/integration/navbar/NavbarDesktop.test.jsx --format stylish 2>&1 | tee /tmp/s5-t26-navbar-desktop.txt
   npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx
   ```

**禁止行為**：

- 不改 component（若 T25 未完成，先回報 blocker）。
- 不碰 focus tests（T27）。
- 不用 `querySelector` / `.children` / `.className` / `document.activeElement` 新增替代。
- 不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `NavbarDesktop.test.jsx`。
2. T010 不再有 `baseElement.querySelector` 或 `avatarBtn.querySelector('svg')`。
3. T010 使用 `screen.getByTestId('user-menu-skeleton')` 與 `within(avatarBtn).getByRole('img', { name: '預設使用者頭像' })`。
4. T010 target sites `159:36`、`210:29` 已清掉；若 full-file lint 仍 fail，只能剩 T27 focus lines。
5. Targeted Vitest pass。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/navbar/NavbarDesktop.test.jsx
rg -n "baseElement|querySelector|user-menu-skeleton|預設使用者頭像|document\\.activeElement|toHaveFocus" tests/integration/navbar/NavbarDesktop.test.jsx
npx eslint tests/integration/navbar/NavbarDesktop.test.jsx --format stylish 2>&1 | tee /tmp/s5-t26-review.txt
rg -n "testing-library/no-node-access" /tmp/s5-t26-review.txt
npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx
```

**Failure recovery**：

- T010 還有 no-node-access → Reviewer 回報 line:col/test name，重派 Engineer。
- Focus lines 還在 → 不算 T26 fail，交 T27。
- Vitest fail → 回報 failing test/error，重派 Engineer 修 T010。

---

## T27：NavbarDesktop dropdown focus no-node-access cleanup

**Engineer prompt 要點**：

1. 只改 `tests/integration/navbar/NavbarDesktop.test.jsx` 的 dropdown focus tests：
   - `Escape closes dropdown and focuses avatar button`
   - `focus moves to first menuitem when dropdown opens`
   - `focus returns to avatar button when dropdown closes`
2. 把 `expect(document.activeElement).toBe(...)` 改成 jest-dom focus matcher：
   ```js
   expect(avatarBtn).toHaveFocus();
   expect(signOutButton).toHaveFocus();
   ```
3. 不改 dropdown open/close behavior，不重寫測試流程。
4. 跑：
   ```bash
   npx eslint tests/integration/navbar/NavbarDesktop.test.jsx
   npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx
   ```

**禁止行為**：

- 不改 component。
- 不碰 Auth UI section（T26 已做）。
- 不用 `document.activeElement`、`querySelector`、`.className` 新增替代。
- 不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. `document.activeElement` 在 `NavbarDesktop.test.jsx` 內不再出現。
2. Focus assertions 使用 `toHaveFocus()`。
3. `npx eslint tests/integration/navbar/NavbarDesktop.test.jsx` exit 0。
4. `npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx` pass。
5. Diff 只動 `NavbarDesktop.test.jsx`。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/navbar/NavbarDesktop.test.jsx
rg -n "document\\.activeElement|toHaveFocus|querySelector|baseElement" tests/integration/navbar/NavbarDesktop.test.jsx
npx eslint tests/integration/navbar/NavbarDesktop.test.jsx
npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx
```

**Failure recovery**：

- Lint still fails → Reviewer 回報 remaining unique line:col，重派 Engineer。
- Focus test flaky/fail → 重派 Engineer 調整 user interaction / focus target，不退回 DOM read。
- Off-scope diff → Reviewer FAIL，重派 Engineer 限縮。

---

## T28：NotificationBell SVG a11y no-node-access cleanup

**Engineer prompt 要點**：

1. 只改：
   - `src/components/Notifications/NotificationBell.jsx`
   - `tests/integration/notifications/NotificationBell.test.jsx`
2. `NotificationBell.jsx` 的 SVG 從 `aria-hidden="true"` 改成可被 role query 找到：
   ```jsx
   role="img"
   aria-label="通知鈴鐺圖示"
   ```
   保留 `data-filled={String(isPanelOpen)}`，測試仍可驗 outlined/filled state。
3. Test 內把 `bell.querySelector('svg')` 改成：
   ```js
   const icon = within(bell).getByRole('img', { name: '通知鈴鐺圖示' });
   ```
4. 不碰 `NotificationPanel.test.jsx` / `NotificationItem.jsx`；unreadDot 留給 S6。
5. 跑：
   ```bash
   npx eslint src/components/Notifications/NotificationBell.jsx tests/integration/notifications/NotificationBell.test.jsx
   npx vitest run tests/integration/notifications/NotificationBell.test.jsx
   ```

**禁止行為**：

- 不改 `NotificationPanel.test.jsx` 的 unreadDot。
- 不改 NotificationContext 行為。
- 不把 `data-filled` 移到 button，除非先回報並重寫測試意圖。
- 不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `NotificationBell.jsx` + `NotificationBell.test.jsx`。
2. Bell SVG 有 `role="img"` + `aria-label="通知鈴鐺圖示"`，不再 `aria-hidden="true"`。
3. Test 用 `within(bell).getByRole('img', { name: '通知鈴鐺圖示' })`。
4. `NotificationBell.test.jsx` 的 `testing-library/no-node-access` = 0。
5. `NotificationPanel.test.jsx` unreadDot 殘留不算 S5 fail，但不得被本 task 修改。
6. Targeted lint + Vitest pass。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/components/Notifications/NotificationBell.jsx tests/integration/notifications/NotificationBell.test.jsx
rg -n "role=\"img\"|通知鈴鐺圖示|aria-hidden=\"true\"|querySelector|within\\(bell\\)" src/components/Notifications/NotificationBell.jsx tests/integration/notifications/NotificationBell.test.jsx
npx eslint src/components/Notifications/NotificationBell.jsx tests/integration/notifications/NotificationBell.test.jsx
npx vitest run tests/integration/notifications/NotificationBell.test.jsx
npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s5-t28-panel-boundary.txt
rg -n "testing-library/no-node-access" /tmp/s5-t28-panel-boundary.txt
```

**Failure recovery**：

- Bell lint still fails → Reviewer 回報 line:col，重派 Engineer。
- Diff 碰到 Panel/Item → Reviewer FAIL，重派 Engineer 拆回正確 scope。
- Vitest fail → 回報 failing test/error，重派 Engineer。

---

## T29：Session 5 closeout + handoff update

**Engineer prompt 要點**：

1. 獨占執行；確認 T24-T28 reviewers 都 PASS 後才開始。
2. 只允許改 `specs/024-eslint-testing-lib-cleanup/handoff.md`；不得改 test/component/config。
3. 驗證：
   ```bash
   npx eslint tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx
   npx eslint src/components/Navbar/UserMenu.jsx src/components/Notifications/NotificationBell.jsx tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx
   npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx
   npx vitest run tests/integration/navbar tests/integration/notifications/NotificationBell.test.jsx
   ```
4. Boundary check：確認 `NotificationPanel.test.jsx` unreadDot 仍留給 S6，不要寫成 notifications domain 全清：
   ```bash
   npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s5-panel-boundary.txt
   ```
5. 更新 `handoff.md`：
   - §0 最新狀態：Session 5 完成；下一 session 接 S6（NotificationPanel unreadDot + notification-click + scroll-to-comment）。
   - §2 pitfalls：補 S5 實際踩坑（若有）。
   - §4 append `Session 5（NavbarDesktop + NotificationBell SVG）— 完成`，記錄 raw/unique count、驗證指令結果、S6 剩餘範圍。
   - §5 下一 session checklist 改成 S6 checklist。
6. 不 git add / commit / push。

**禁止行為**：

- 不改 `eslint.config.mjs`。
- 不改 `src/**` / `tests/**`。
- 不為了 repo-wide lint 全綠去修 S6-S8 domain。
- 不加 eslint disable，不關 rule。
- 不 git add / commit / push。

**Acceptance Criteria（Reviewer 必驗）**：

1. `NavbarDesktop.test.jsx` ESLint exit 0。
2. `NotificationBell.test.jsx` ESLint exit 0。
3. Component + target lint exit 0。
4. Targeted Vitest pass。
5. Navbar suite + NotificationBell suite pass（若跑失敗，handoff 必須記實際 failure，不可寫全綠）。
6. `NotificationPanel.test.jsx` unreadDot 若仍 fail，要明確記為 S6 remaining，不可算 S5 fail。
7. `handoff.md` §0、§2、§4、§5 已更新。
8. `eslint.config.mjs` 未被 T29 修改；`no-node-access` 仍是 `error`。
9. 未 staged、未 commit、未 push。

**Reviewer 驗收指令**：

```bash
npx eslint tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx
npx eslint src/components/Navbar/UserMenu.jsx src/components/Notifications/NotificationBell.jsx tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx
npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx
npx vitest run tests/integration/navbar tests/integration/notifications/NotificationBell.test.jsx
npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s5-t29-panel-boundary-review.txt
rg -n "'testing-library/no-node-access': 'error'" eslint.config.mjs
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/Session 5/,/^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/^## 5\./,/^## 6\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
git status --short
git diff --name-only
```

**Failure recovery**：

- NavbarDesktop or NotificationBell lint still fails → Reviewer 回報 rule + line:col；主 agent 重派對應 T26/T27/T28 Engineer。
- Component lint / Vitest fail → 回報 failing command/test；重派對應 Engineer。
- `handoff.md` 寫成 notifications 全清或 repo-wide 全綠 → 重派 T29 Engineer 修文件。
- 發現 `eslint.config.mjs` 被改或 rule 被關 → Reviewer FAIL；主 agent 不自行修，重派 Engineer 並要求恢復前置 config。

## Session 5 結束狀態（DOD）

- `testing-library/no-node-access`: 維持 `error`。
- `tests/integration/navbar/NavbarDesktop.test.jsx`: 0 `testing-library/no-node-access` errors。
- `tests/integration/notifications/NotificationBell.test.jsx`: 0 `testing-library/no-node-access` errors。
- 必要 component affordance 僅限 `UserMenu.jsx` / `NotificationBell.jsx`。
- `NotificationPanel.test.jsx` unreadDot、`notification-click.test.jsx` unreadDot、`scroll-to-comment.test.jsx` 留給 S6。
- repo-wide lint 仍可能因 S6-S8 domain fail；不要把剩餘 domain 混進 S5。
- `handoff.md` 記錄 Session 5 evidence 與 S6 checklist。
- 不 commit、不 stage、不 push。

---

# Session 6 — Notifications domain 收尾（unreadDot + scroll-to-comment）

> Plan §8.2 S6：「Phase 4.3 notifications 剩餘（unreadDot, scroll-to-comment, notification-click）」。Plan 原描述為 “🔖 notifications domain testid 補完”，但 S6 fresh audit 發現 `scroll-to-comment.test.jsx` line 34 是 **test-internal mock component (`ScrollTestComponent`) 內的 `useEffect` `getElementById`**，不是測試端 query — 因此 S6 修法分為兩類：
>
> 1. **unreadDot**（NotificationPanel + notification-click）：修法 C — `NotificationItem.jsx` 加 `data-testid` + `aria-hidden="true"`，測試改用 `screen.queryByTestId` / `within(panel).queryByTestId`
> 2. **scroll-to-comment**：把 mock component 抽到 `tests/_helpers/notifications/scroll-to-comment-mock.jsx`，並在 `eslint.config.mjs` §17.5 testing-library block 的 `ignores` array 加上該 helper 路徑（`tests/_helpers/e2e-helpers.js` 已是先例）
>
> S6 不破壞 plan §2「`no-node-access` 不退到 Path B」原則：rule level 維持 `error`，scroll helper ignore 是檔案層級 scope 而非 rule level escape hatch。

## Session 6 Fresh Audit 摘要（planning evidence, 2026-04-28）

ESLint config 狀態：

```text
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
395  'testing-library/prefer-user-event': 'error'
396  'testing-library/no-node-access': 'error'
```

> 用戶 prompt 寫 `eslint.config.mjs:395：testing-library/no-node-access` — 實際 line 395 是 `prefer-user-event`，line 396 才是 `no-node-access`（line drift, 詳 handoff §2.37）。本 session 規劃 commit bridge 暫關的是 line 396 的 `no-node-access`。

### NotificationPanel.test.jsx fresh lint

```text
npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish

235:29  testing-library/no-node-access  (raw 2)
245:29  testing-library/no-node-access  (raw 2)
```

- Raw count = 4
- Unique line:col = 2
- 對應 test：
  - `235:29`：`should show blue dot for unread notification (read=false)` — `const { baseElement } = render(...)` + `baseElement.querySelector('[class*="unreadDot"]')` 在場
  - `245:29`：`should NOT show blue dot for read notification (read=true)` — 同 pattern，斷言不在場

### notification-click.test.jsx fresh lint

```text
npx eslint tests/integration/notifications/notification-click.test.jsx --format stylish

240:18  testing-library/no-node-access
250:26  testing-library/no-node-access
```

- Raw count = 2
- Unique line:col = 2
- 同一 test（`should immediately hide blue dot after click (optimistic update)`）：
  - `240:18`：`expect(panel.querySelector('[class*="unreadDot"]')).toBeInTheDocument();`
  - `250:26`：`expect(reopenedPanel.querySelector('[class*="unreadDot"]')).not.toBeInTheDocument();`
- panel / reopenedPanel 由 `screen.getByRole('region', { name: '通知面板' })` 取得，再 `querySelector` unreadDot

### scroll-to-comment.test.jsx fresh lint

```text
npx eslint tests/integration/notifications/scroll-to-comment.test.jsx --format stylish

34:27  testing-library/no-node-access  (raw 2 — 同 line 被 2 個 it block 共用 mock component)
```

- Raw count = 2
- Unique line:col = 1
- 違規 code：`const el = document.getElementById(commentId);`
- 位置：**test-internal `ScrollTestComponent` mock 內的 `useEffect`**（line 21–55），不是測試斷言端
- 模擬對象：`src/components/CommentSection.jsx` line 75 的 production scroll-to-comment 行為（production code 本身不受 testing-library plugin lint）
- 修法分析：
  - 修法 A（改 component）→ 不適用：違規在 test-internal mock 內
  - 修法 B（within）→ 不適用：違規不是 query 而是 effect 內 DOM lookup
  - 修法 C（data-testid）→ 不適用：違規是 effect 內 `getElementById`，不是測試端 query
  - **正確修法**：抽 `ScrollTestComponent` 到 `tests/_helpers/notifications/scroll-to-comment-mock.jsx`，並在 `eslint.config.mjs` §17.5 testing-library block 的 `ignores` array 加 helper 路徑

### Component source 摘要

`src/components/Notifications/NotificationItem.jsx` line 48：

```jsx
{
  !read && <span className={styles.unreadDot} />;
}
```

- 純視覺 indicator，對 a11y tree 應透明
- 無 `data-testid` / `id` / `role` / `aria-label`
- 修法 C：加 `data-testid="notification-unread-dot"` + `aria-hidden="true"`（雙重屬性是刻意設計，testid 是測試 hook、aria-hidden 是 a11y 抑制 — 兩條軸不衝突）

### Notifications domain 邊界

| 檔案                                      | no-node-access 狀態       |
| ----------------------------------------- | ------------------------- |
| `NotificationBell.test.jsx`               | ✅ S5 已清                |
| `NotificationPagination.test.jsx`         | ✅ baseline 已乾淨        |
| `NotificationPaginationStateful.test.jsx` | ✅ baseline 已乾淨        |
| `NotificationPanel.test.jsx`              | 🔧 S6 接（unreadDot × 2） |
| `NotificationTabs.test.jsx`               | ✅ baseline 已乾淨        |
| `NotificationToast.test.jsx`              | ✅ S3 已清                |
| `notification-click.test.jsx`             | 🔧 S6 接（unreadDot × 2） |
| `notification-error.test.jsx`             | ✅ baseline 已乾淨        |
| `notification-triggers.test.jsx`          | ✅ baseline 已乾淨        |
| `scroll-to-comment.test.jsx`              | 🔧 S6 接（mock × 1）      |

→ S6 完成後 notifications domain `no-node-access` 應該全清。

---

## Parallelism — 共享 worktree 同時最多 4 個 subagents（2 Engineer + 2 Reviewer）

| 類型            | 上限                        | 規則                                                                                                                                                                                                                          |
| --------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engineer writer | **2**                       | T32 / T33 / T34 三個 task 檔案不重疊；可同時做最多 2 個 Engineer。不得兩個 Engineer 寫同一檔。T31 是 affordance gate，必先 PASS 才開 T32 / T33。T34 不依賴 T31，但仍與 T32 / T33 共享 worktree，總並行數不得超過 2 Engineer。 |
| Reviewer        | **2**                       | 每個 Engineer task 完成後配一個 Reviewer 依 acceptance criteria 驗收；Reviewer 可與另一個 disjoint Engineer 同時跑。Reviewer FAIL → 主 agent 重派 Engineer 修，**主 agent 不自行修**。                                        |
| Closeout        | **1 Engineer + 1 Reviewer** | T35 handoff/verification 獨占，不與任何 writer 並行。                                                                                                                                                                         |

> 實務排程：T30 preflight 獨占 → T31 component affordance 獨占（T32 / T33 依賴）→ T32 + T33 並行（依賴 T31）；T34 可與 T32 / T33 任一個並行（不依賴 T31）→ T35 closeout 獨占。
> Reviewer FAIL 時，主 agent 只重派 Engineer/subagent 修，不自行改測試 / component / config。

---

## T30：Session 6 preflight audit（read-only, sequential）

**Engineer prompt 要點**：

1. 只讀，不改檔。
2. 確認 ESLint config rule level：
   ```bash
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   ```
   預期兩條都是 `error`；若 `no-node-access` 是 `off` → 停下回報，**不得自行打開**，等主 agent 介入（commit bridge 應已恢復 error，否則代表 bridge 失敗）。
3. 跑三個目標檔的 fresh lint：
   ```bash
   npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s6-panel-preflight.txt
   npx eslint tests/integration/notifications/notification-click.test.jsx --format stylish 2>&1 | tee /tmp/s6-click-preflight.txt
   npx eslint tests/integration/notifications/scroll-to-comment.test.jsx --format stylish 2>&1 | tee /tmp/s6-scroll-preflight.txt
   ```
4. 回報每檔 raw count + unique line:col + test name + 違規 code 一行。
5. 跑 notifications domain 邊界（boundary check，避免動到不該碰的）：
   ```bash
   npx eslint tests/integration/notifications/ 2>&1 | rg "no-node-access|✖" | tee /tmp/s6-notifications-domain.txt
   ```
   只列違規分布，不需逐行 dump。
6. 跑：
   ```bash
   git status --short
   git log --oneline -3
   ```
   回報 working tree 與最近 commit；S6 規劃 commit 應已存在，working tree 應清空（或只剩 commit bridge 後恢復的 `eslint.config.mjs`）。

**禁止行為**：

- 不改任何檔案。
- 不重寫 tasks/handoff。
- 不關 ESLint rule、不加 eslint disable、不啟動 vitest 等其他 long-running 命令。

**Acceptance Criteria（Reviewer 必驗）**：

1. Engineer report 有 config rule 狀態，且 `no-node-access` 是 `error`。
2. NotificationPanel / notification-click / scroll-to-comment 三檔 fresh lint 各自有 raw / unique count、line:col、test name、違規 code 對照。
3. notifications domain 邊界：明確列出哪些檔已乾淨、哪些 S6 要修。
4. Working tree 沒有因 T30 增加新 dirty files。

**Reviewer 驗收指令**：

```bash
git status --short
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s6-t30-panel-review.txt
npx eslint tests/integration/notifications/notification-click.test.jsx --format stylish 2>&1 | tee /tmp/s6-t30-click-review.txt
npx eslint tests/integration/notifications/scroll-to-comment.test.jsx --format stylish 2>&1 | tee /tmp/s6-t30-scroll-review.txt
rg -n "testing-library/no-node-access" /tmp/s6-t30-panel-review.txt /tmp/s6-t30-click-review.txt /tmp/s6-t30-scroll-review.txt
```

**Failure recovery**：

- Config 不是 `error` → 停下回報；不得自行關 / 開 rule，主 agent 介入。
- Fresh lint 與 planning evidence 差很多（line drift > 5 行 / unique count 偏離）→ 更新 task 範圍前先回報主 agent。
- T30 造成 dirty files → Reviewer FAIL，重派 Engineer 清理。

---

## T31：NotificationItem unreadDot affordance（sequential gate, T32/T33 依賴）

**Engineer prompt 要點**：

1. 只改 `src/components/Notifications/NotificationItem.jsx`。
2. line 48 的 unreadDot 加最小 test hook + a11y noise 抑制：

   ```jsx
   {
     !read && (
       <span
         className={styles.unreadDot}
         data-testid="notification-unread-dot"
         aria-hidden="true"
       />
     );
   }
   ```

   - 為何同時加 `aria-hidden="true"`：unreadDot 是純視覺 indicator，對 screen reader 應透明。`data-testid` 是測試 hook、`aria-hidden` 是 a11y 抑制，兩條軸不衝突。詳 handoff §2.32。

3. 不改 onClick / handleAvatarError / 顯示邏輯 / className / `NotificationItem.module.css` / 其他 component。
4. 跑：

   ```bash
   npx eslint src/components/Notifications/NotificationItem.jsx
   npx vitest run tests/integration/notifications/NotificationPanel.test.jsx tests/integration/notifications/notification-click.test.jsx
   ```

   - 注意：Vitest 此時可能仍 fail（測試還沒改用 testid），這是預期；確認沒被 component 改動意外炸壞「avatar、message、time、onClick、img alt、Image src」等不相關 assertion。
   - 若 Vitest 看到「unreadDot 還是用 querySelector」之類 assertion fail，這屬 T32/T33 範圍，不算 T31 fail。

**禁止行為**：

- 不改 `tests/integration/notifications/*.test.jsx`（留給 T32 / T33）。
- 不改 `NotificationItem.module.css` / 其他 component。
- 不加 eslint disable。
- 不改 unreadDot 的 className / 顯示條件 (`!read`)。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `src/components/Notifications/NotificationItem.jsx`。
2. unreadDot span 同時有 `data-testid="notification-unread-dot"` + `aria-hidden="true"`，並保留 `className={styles.unreadDot}` 與 `!read &&` 顯示條件。
3. avatar / button / message / time / onClick 邏輯沒被改。
4. `npx eslint src/components/Notifications/NotificationItem.jsx` exit 0。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/components/Notifications/NotificationItem.jsx
rg -n "notification-unread-dot|aria-hidden|unreadDot|onClick|handleAvatarError|!read" src/components/Notifications/NotificationItem.jsx
npx eslint src/components/Notifications/NotificationItem.jsx
```

**Failure recovery**：

- testid 拼錯 / aria-hidden 缺 → 重派 Engineer 修。
- 改到 onClick / 顯示邏輯 / CSS module → Reviewer FAIL，重派 Engineer 限縮 diff。
- Component lint fail → 回報錯誤，重派 Engineer。

---

## T32：NotificationPanel.test.jsx unreadDot cleanup（並行 with T33 / T34）

**Engineer prompt 要點**：

1. 只改 `tests/integration/notifications/NotificationPanel.test.jsx`。
2. T31 PASS 後才開工；若 affordance 未到位，停下回報。
3. 兩個 it block 改寫：
   - `should show blue dot for unread notification (read=false)`（line ~228–237）：
     ```js
     // 改前
     const { baseElement } = render(
       <NotificationItem notification={notification} onClick={vi.fn()} />,
     );
     const dot = baseElement.querySelector('[class*="unreadDot"]');
     expect(dot).toBeInTheDocument();
     // 改後
     render(<NotificationItem notification={notification} onClick={vi.fn()} />);
     expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument();
     ```
   - `should NOT show blue dot for read notification (read=true)`（line ~239–247）：
     ```js
     // 改前
     const { baseElement } = render(
       <NotificationItem notification={notification} onClick={vi.fn()} />,
     );
     const dot = baseElement.querySelector('[class*="unreadDot"]');
     expect(dot).not.toBeInTheDocument();
     // 改後
     render(<NotificationItem notification={notification} onClick={vi.fn()} />);
     expect(screen.queryByTestId('notification-unread-dot')).not.toBeInTheDocument();
     ```
4. 兩個 it 移除 `const { baseElement } = render(...)` 解構（順手消潛在 `no-container` 風險），測試其他部分（`getByRole('img')`、`getByText`）保持不變。
5. **「在場」測試用 `getByTestId`（找不到 throw）；「不在場」測試用 `queryByTestId`（找不到回 `null`）**，不能寫反。
6. 跑：
   ```bash
   npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s6-t32-panel.txt
   npx vitest run tests/integration/notifications/NotificationPanel.test.jsx
   ```

**禁止行為**：

- 不改 `NotificationItem.jsx`（T31 已做）。
- 不改 `notification-click.test.jsx`（T33）。
- 不改 `scroll-to-comment.test.jsx`（T34）。
- 不用 `querySelector` / `.children` / `baseElement.X` 新增替代。
- 不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `tests/integration/notifications/NotificationPanel.test.jsx`。
2. 兩個 unreadDot it block 不再有 `baseElement.querySelector('[class*="unreadDot"]')`。
3. 「在場」測試用 `screen.getByTestId('notification-unread-dot')`；「不在場」測試用 `screen.queryByTestId(...)`。
4. `const { baseElement } = render(...)` 解構已移除（兩 it 都改成 `render(...)` 不解構）。
5. 該檔 `testing-library/no-node-access` = 0；`testing-library/no-container` = 0。
6. Vitest 該檔 PASS。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/notifications/NotificationPanel.test.jsx
rg -n "baseElement|querySelector|getByTestId|queryByTestId|notification-unread-dot" tests/integration/notifications/NotificationPanel.test.jsx
npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s6-t32-review.txt
rg -n "testing-library/(no-node-access|no-container)" /tmp/s6-t32-review.txt
npx vitest run tests/integration/notifications/NotificationPanel.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → Reviewer 回報 line:col / test name，重派 Engineer。
- 「不在場」測試用 `getByTestId` → Reviewer FAIL（會 throw），重派 Engineer 改 `queryByTestId`。
- Vitest fail → 回報 failing test/error，重派 Engineer 修 query 寫法。
- Diff 碰到非 panel 檔 → Reviewer FAIL，重派 Engineer 限縮。

---

## T33：notification-click.test.jsx unreadDot cleanup（並行 with T32 / T34）

**Engineer prompt 要點**：

1. 只改 `tests/integration/notifications/notification-click.test.jsx`。
2. T31 PASS 後才開工；若 affordance 未到位，停下回報。
3. 兩處改寫（在同一個 `should immediately hide blue dot after click (optimistic update)` test 內）：
   - line ~240：
     ```js
     // 改前
     const panel = screen.getByRole('region', { name: '通知面板' });
     expect(panel.querySelector('[class*="unreadDot"]')).toBeInTheDocument();
     // 改後
     const panel = screen.getByRole('region', { name: '通知面板' });
     expect(within(panel).getByTestId('notification-unread-dot')).toBeInTheDocument();
     ```
   - line ~250：
     ```js
     // 改前
     const reopenedPanel = screen.getByRole('region', { name: '通知面板' });
     expect(reopenedPanel.querySelector('[class*="unreadDot"]')).not.toBeInTheDocument();
     // 改後
     const reopenedPanel = screen.getByRole('region', { name: '通知面板' });
     expect(within(reopenedPanel).queryByTestId('notification-unread-dot')).not.toBeInTheDocument();
     ```
4. 確認 import：`within` 是否已從 `@testing-library/react` import；若無，補上（`import { ..., within } from '@testing-library/react';`）。
5. 不改 `user.click(...)` 流程、optimistic update 行為、provider mocks、`renderWithProviders` 設定。
6. 跑：
   ```bash
   npx eslint tests/integration/notifications/notification-click.test.jsx --format stylish 2>&1 | tee /tmp/s6-t33-click.txt
   npx vitest run tests/integration/notifications/notification-click.test.jsx
   ```

**禁止行為**：

- 不改 `NotificationItem.jsx`（T31 已做）。
- 不改 `NotificationPanel.test.jsx`（T32）。
- 不改 `scroll-to-comment.test.jsx`（T34）。
- 不用 `querySelector` / `.children` / `panel.X` 新增替代。
- 不加 eslint disable。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `tests/integration/notifications/notification-click.test.jsx`。
2. 兩處 unreadDot 斷言不再有 `querySelector('[class*="unreadDot"]')`。
3. 「在場」斷言用 `within(panel).getByTestId(...)`；「不在場」斷言用 `within(reopenedPanel).queryByTestId(...)`。
4. `within` 已從 `@testing-library/react` import。
5. 該檔 `testing-library/no-node-access` = 0。
6. Vitest 該檔 PASS（包含 optimistic update flow）。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/notifications/notification-click.test.jsx
rg -n "querySelector|within\\(|notification-unread-dot|getByTestId|queryByTestId" tests/integration/notifications/notification-click.test.jsx
rg -n "^import.*within" tests/integration/notifications/notification-click.test.jsx
npx eslint tests/integration/notifications/notification-click.test.jsx --format stylish 2>&1 | tee /tmp/s6-t33-review.txt
rg -n "testing-library/no-node-access" /tmp/s6-t33-review.txt
npx vitest run tests/integration/notifications/notification-click.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → Reviewer 回報 line:col / test name，重派 Engineer。
- Optimistic update flow timing fail（panel close / reopen 時序）→ **不可退回 fireEvent / direct DOM read**；重派 Engineer 用 `await user.click(...)` + `within` 重新對齊 timing。
- Vitest fail → 回報 failing test/error，重派 Engineer。
- Diff 碰到非 click 檔 → Reviewer FAIL，重派 Engineer 限縮。

---

## T34：scroll-to-comment mock helper extraction（並行 with T32 / T33）

**Engineer prompt 要點**：

1. 改三處：
   - **新檔** `tests/_helpers/notifications/scroll-to-comment-mock.jsx`：把現有 `tests/integration/notifications/scroll-to-comment.test.jsx` line 21–55 的 `ScrollTestComponent` 整段抽過來（含 JSDoc、`useEffect` 邏輯、`useSearchParams` 的 import）。注意：
     - `useSearchParams` 從 `next/navigation` import — helper 內也要 import
     - Helper 默認 export `ScrollTestComponent`
     - JSDoc 要完整（`@returns` + 元件目的；參考 `tests/_helpers/e2e-helpers.js` 的 doc 風格）
     - 此 helper 在 `eslint.config.mjs` §17.5 testing-library block 的 `ignores` 內，不被 testing-library lint，但仍受 `js.configs.recommended` / a11y / jsdoc / import / type-aware 等其他 rule 覆蓋；helper 必須過全 `npx eslint tests/_helpers/notifications/scroll-to-comment-mock.jsx`
   - **改 test 檔** `tests/integration/notifications/scroll-to-comment.test.jsx`：
     - 移除 line 21–55 的 `ScrollTestComponent` 定義
     - 移除 `import { useEffect } from 'react';`（helper 內才需要）
     - 在頂部 import block 加 `import ScrollTestComponent from '<path>/scroll-to-comment-mock';`（路徑用 repo 既有 alias 慣例 — `@/` 是 src alias，tests helper 用相對路徑即可，例如 `'../../_helpers/notifications/scroll-to-comment-mock';`，與 e2e-helpers 既有 import 風格對齊）
     - 確認 `vi.mock('next/navigation', ...)` 仍在 test 檔頂部（**不可搬到 helper**，`vi.mock` 必須在使用 component 的 test 檔）
     - 4 個 it block 行為與斷言不變
   - **改** `eslint.config.mjs`：在 §17.5 testing-library block 的 `ignores: ['tests/e2e/**', 'tests/_helpers/e2e-helpers.js']` array 加入 `'tests/_helpers/notifications/scroll-to-comment-mock.jsx'`，**只加這一個精確路徑**：
     ```js
     ignores: [
       'tests/e2e/**',
       'tests/_helpers/e2e-helpers.js',
       'tests/_helpers/notifications/scroll-to-comment-mock.jsx',
     ],
     ```
     不可加 `'tests/_helpers/**'` 或 `'tests/_helpers/notifications/**'` 等更廣 glob。
2. **不改** production code (`src/components/CommentSection.jsx`)。
3. **不改** `'testing-library/no-node-access'` rule level（line 396 必須仍是 `'error'`）。
4. **不改**其他 ignores（`'tests/e2e/**'`、`'tests/_helpers/e2e-helpers.js'` 不動）。
5. Helper 檔內仍可使用 `document.getElementById`，因為已被 ignored — 這是設計目的。
6. 跑：

   ```bash
   npx eslint eslint.config.mjs tests/_helpers/notifications/scroll-to-comment-mock.jsx tests/integration/notifications/scroll-to-comment.test.jsx --format stylish 2>&1 | tee /tmp/s6-t34-scroll.txt
   npx vitest run tests/integration/notifications/scroll-to-comment.test.jsx
   ```

   - Helper 自身應 exit 0（被 ignored 不會炸 `no-node-access`，但 jsdoc / import / a11y 等其他 rule 仍適用）。
   - Test 檔自身應 exit 0 並 0 `no-node-access`。
   - 4 個 it block 全 PASS。

**禁止行為**：

- 不改 `'testing-library/no-node-access': 'error'` → `'off'`。
- 不在 ignores 加 `tests/_helpers/**` 之類 broad glob。
- 不改 `tests/_helpers/e2e-helpers.js` 已有的 ignore entry。
- 不改 `src/components/CommentSection.jsx` 或其他 production code。
- 不改 test 行為（4 個 it block 應該全部仍通過、斷言文字不變）。
- 不加 eslint disable。
- 不改 `vi.mock('next/navigation', ...)` 位置（必須留在 test 檔）。

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 含三處：新檔 `tests/_helpers/notifications/scroll-to-comment-mock.jsx`、改 `tests/integration/notifications/scroll-to-comment.test.jsx`、改 `eslint.config.mjs` ignores 一個路徑。
2. `eslint.config.mjs` line 396 仍是 `'testing-library/no-node-access': 'error'`（未被改成 `off`）。
3. `eslint.config.mjs` §17.5 ignores array 增加 `'tests/_helpers/notifications/scroll-to-comment-mock.jsx'`，且原本 `'tests/e2e/**'`、`'tests/_helpers/e2e-helpers.js'` 仍在；**沒有更廣 glob**。
4. Helper 檔 default export `ScrollTestComponent`，內部仍用 `document.getElementById`；JSDoc 完整。
5. Test 檔不再有 `ScrollTestComponent` 定義；`useEffect` import 已移除；改為 import helper；`vi.mock('next/navigation', ...)` 仍在 test 檔。
6. `npx eslint eslint.config.mjs tests/_helpers/notifications/scroll-to-comment-mock.jsx tests/integration/notifications/scroll-to-comment.test.jsx` exit 0；test 檔 0 `no-node-access`；helper 0 `no-node-access`（因 ignored）。
7. `npx vitest run tests/integration/notifications/scroll-to-comment.test.jsx` exit 0；4 個 it block 全 PASS。

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff eslint.config.mjs tests/integration/notifications/scroll-to-comment.test.jsx
ls -la tests/_helpers/notifications/scroll-to-comment-mock.jsx
cat tests/_helpers/notifications/scroll-to-comment-mock.jsx
rg -n "'testing-library/no-node-access':" eslint.config.mjs
rg -n "scroll-to-comment-mock|tests/_helpers/e2e-helpers|tests/e2e" eslint.config.mjs
rg -n "ScrollTestComponent|document\\.getElementById|useEffect|vi\\.mock\\('next/navigation'" tests/integration/notifications/scroll-to-comment.test.jsx
npx eslint eslint.config.mjs tests/_helpers/notifications/scroll-to-comment-mock.jsx tests/integration/notifications/scroll-to-comment.test.jsx --format stylish 2>&1 | tee /tmp/s6-t34-review.txt
rg -n "testing-library/no-node-access" /tmp/s6-t34-review.txt
npx vitest run tests/integration/notifications/scroll-to-comment.test.jsx
```

**Failure recovery**：

- `'testing-library/no-node-access': 'error'` 被改成 `off` → Reviewer FAIL；重派 Engineer 恢復 error，並只在 ignores 加路徑。
- ignores 加了 broad glob（`tests/_helpers/**`）→ FAIL；重派 Engineer 收斂到精確 helper 路徑。
- Helper 檔自身 lint fail（非 testing-library rule）→ 重派 Engineer 補 JSDoc / import 順序 / a11y。
- Vitest fail → 回報 failing test / error；可能 mock module path 沒接好 / `vi.mock('next/navigation')` 沒留在 test 檔，重派 Engineer 修。
- Production code 被改 → FAIL，重派 Engineer revert。

---

## T35：Session 6 closeout + handoff update（獨占）

**Engineer prompt 要點**：

1. 獨占執行；確認 T30-T34 reviewers 都 PASS 後才開始。
2. 只允許改 `specs/024-eslint-testing-lib-cleanup/handoff.md`；不得改 test / component / config。
3. 驗證：
   ```bash
   npx eslint tests/integration/notifications/NotificationPanel.test.jsx tests/integration/notifications/notification-click.test.jsx tests/integration/notifications/scroll-to-comment.test.jsx
   npx eslint tests/integration/notifications/
   npx eslint src/components/Notifications/NotificationItem.jsx tests/_helpers/notifications/scroll-to-comment-mock.jsx
   npx vitest run tests/integration/notifications/NotificationPanel.test.jsx tests/integration/notifications/notification-click.test.jsx tests/integration/notifications/scroll-to-comment.test.jsx
   npx vitest run tests/integration/notifications
   ```
4. 確認 ESLint config rule level：
   ```bash
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   ```
   兩條都應仍是 `error`（commit bridge 已恢復）。
5. Boundary check（用 `pipefail` 或 raw command 防 `tee` exit code 誤導，handoff §2.29 已記）：
   ```bash
   zsh -o pipefail -c 'npx eslint src specs tests 2>&1 | tee /tmp/s6-repo-wide.txt'
   echo "exit=$?"
   rg -c "testing-library/no-node-access" /tmp/s6-repo-wide.txt
   rg "✖" /tmp/s6-repo-wide.txt
   ```
   把實際殘留 domain（profile / weather / posts / toast / strava 等）列在 handoff（S7-S8 範圍）。
6. 更新 `handoff.md`：
   - **§0** 最新狀態：Session 6 完成；下一 session 接 S7（plan §8.2 S7 — profile 3 處 + weather 2 處 純測試重構）。
   - **§2** pitfalls：補 S6 實際踩坑（若有；若無新坑，仍在「Session 6 完成」段下記錄已驗事實）。
   - **§4** append `Session 6（NotificationPanel + notification-click + scroll-to-comment 收尾）— 完成`，記錄：
     - T30-T34 各 task 結果（raw / unique 收斂數字、Reviewer PASS evidence）
     - 驗證指令 fresh run 結果
     - helper extraction 結果（新檔路徑、ignores 修改）
     - notifications domain `no-node-access` 全清確認
     - S7-S8 剩餘範圍（明確列 domain + 大致數量）
   - **§5** 下一 session checklist 改成 S7 checklist：scope = `tests/integration/profile/`（3 處） + `tests/integration/weather/`（2 處），plan §8.2 S7「🧹 純測試重構」。
7. 不 git add / commit / push。

**禁止行為**：

- 不改 `eslint.config.mjs`（T34 已加 ignores 後，T35 不再動）。
- 不改 `src/**` / `tests/**`。
- 不為了 repo-wide lint 全綠去修 S7-S8 domain。
- 不加 eslint disable，不關 rule。
- 不 git add / commit / push。

**Acceptance Criteria（Reviewer 必驗）**：

1. `NotificationPanel.test.jsx` ESLint exit 0。
2. `notification-click.test.jsx` ESLint exit 0。
3. `scroll-to-comment.test.jsx` ESLint exit 0。
4. notifications domain target lint exit 0；`no-node-access` 在 notifications domain = 0。
5. 三 target file 的 Vitest pass；notifications suite 整體 pass（若任何檔 fail，handoff 必須記實際 failure，不可寫全綠）。
6. `eslint.config.mjs` `no-node-access` 仍是 `error`、`prefer-user-event` 仍是 `error`。
7. `handoff.md` §0、§2、§4、§5 已更新。
8. Repo-wide lint 結果有被記在 handoff，殘留 domain 明確列出（profile / weather / posts / toast / strava，視實測）。
9. 未 staged、未 commit、未 push。

**Reviewer 驗收指令**：

```bash
npx eslint tests/integration/notifications/NotificationPanel.test.jsx tests/integration/notifications/notification-click.test.jsx tests/integration/notifications/scroll-to-comment.test.jsx
npx eslint tests/integration/notifications/
npx eslint src/components/Notifications/NotificationItem.jsx tests/_helpers/notifications/scroll-to-comment-mock.jsx
npx vitest run tests/integration/notifications/NotificationPanel.test.jsx tests/integration/notifications/notification-click.test.jsx tests/integration/notifications/scroll-to-comment.test.jsx
npx vitest run tests/integration/notifications
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
zsh -o pipefail -c 'npx eslint src specs tests 2>&1 | tee /tmp/s6-t35-repo-wide-review.txt' || true
rg -c "testing-library/no-node-access" /tmp/s6-t35-repo-wide-review.txt
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/Session 6/,/^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/^## 5\./,/^## 6\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
git status --short
git diff --name-only
```

**Failure recovery**：

- Notifications target lint still fails → Reviewer 回報 rule + line:col；主 agent 重派對應 T31 / T32 / T33 / T34 Engineer。
- Vitest fail → 回報 failing command / test；重派對應 Engineer。
- `handoff.md` 寫成 repo-wide 全綠 → 重派 T35 Engineer 修文件。
- 發現 `eslint.config.mjs` rule level 被改 / ignores 多了 broad glob → Reviewer FAIL；主 agent 不自行修，重派 Engineer 收斂。

---

## Session 6 結束狀態（DOD）

- `testing-library/no-node-access`: 維持 `error`。
- `testing-library/prefer-user-event`: 維持 `error`。
- `tests/integration/notifications/NotificationPanel.test.jsx`: 0 `testing-library/no-node-access` errors。
- `tests/integration/notifications/notification-click.test.jsx`: 0 `testing-library/no-node-access` errors。
- `tests/integration/notifications/scroll-to-comment.test.jsx`: 0 `testing-library/no-node-access` errors（透過 helper extraction + ignores entry 達成）。
- 必要 component affordance 僅限 `src/components/Notifications/NotificationItem.jsx`（unreadDot 加 `data-testid` + `aria-hidden="true"`）。
- 新增 helper：`tests/_helpers/notifications/scroll-to-comment-mock.jsx`，並在 `eslint.config.mjs` §17.5 ignores 增加該精確路徑（不加 broad glob）。
- 整個 notifications domain `no-node-access` 全清。
- `tests/integration/profile/`、`tests/integration/weather/`、`tests/integration/posts/`、`tests/integration/toast/`、`tests/integration/strava/` 仍可能 fail；不要把剩餘 domain 混進 S6。
- `handoff.md` 記錄 Session 6 evidence 與 S7 checklist。
- 不 commit、不 stage、不 push。

---

# Session 7 Tasks — Phase 4.4 profile + Phase 4.5 weather（純測試重構）

> **Source**: `plan.md` §5 Phase 4.4 / 4.5 + §8.2 S7 + Appendix A（profile 3 處 + weather 2 處）
> **Goal**: 1.5–2 hr — 把 profile + weather domain 的 `testing-library/no-node-access` 5 unique sites 全清為 0；不影響 S5/S6 已綠檔；不動 S8 scope（posts / toast / strava）
> **執行模式**：所有任務一律由 subagent 執行；主 agent 只做派遣、彙整、驗收回饋；reviewer FAIL 一律重派 Engineer。
> **Branch**：`024-eslint-testing-lib-cleanup`（worktree 路徑：`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`）
> **承接狀態**：Session 6 已完成（commit `7e74893`）；Session 7 規劃 commit 將包含 `tasks.md` / `handoff.md` 與 commit bridge 的 `eslint.config.mjs`（commit 後恢復 `error`）。下一 session 接手前以 fresh `git status` 為準。
> **本 session 開工前必讀**：
>
> - `handoff.md` §0、§2.32–§2.43（含 S7 audit 新坑）、§4 Session 6/7 規劃段、§5 S7 開工 checklist
> - 本檔 T36–T41 全文（每個 task 的 Engineer prompt 要點 + Acceptance Criteria + Reviewer 驗收指令）

---

## Parallelism — 同時最多 4 個 subagents（2 Engineer + 2 Reviewer 配對；Engineer 改不同檔不撞）

| 階段                       | 並行度   | 原因                                                                                                        |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| T36 preflight              | **1**    | Read-only Explore，不寫檔；獨占執行                                                                         |
| T37–T40 Engineer 寫檔      | **2**    | 4 個 task 各動不同檔；保守限制 2 並行避免 dirty file list 混雜難 review。Wave 1 = T37+T38；Wave 2 = T39+T40 |
| T37–T40 Reviewer 驗收      | **2**    | Reviewer 跑 ESLint + 單檔 vitest；不同檔不撞。Wave 1 完才接 Wave 2                                          |
| Engineer + Reviewer 同時跑 | **不行** | 同一檔同時讀寫會撞 — 同 task 的 Engineer 要先 PASS 完整 acceptance check 後才派 Reviewer                    |
| T41 closeout               | **1**    | 獨占；只允許改 `handoff.md`；跑 repo-wide ESLint / vitest 確認 S5/S6 不退、S8 不被誤改                      |

> **總 subagent 數估算**（first-pass 全綠）：T36×1 read-only + T37–T40 各 2（Engineer + Reviewer）= 9 次 Agent 呼叫 + T41×1 = **10 次**。每多一輪 reviewer FAIL +2。

---

## Task 拆分

### T36：Session 7 preflight audit（read-only, sequential gate）

**Engineer prompt 要點**（read-only Explore subagent）：

1. cd 到 worktree 根 (`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`)。
2. 執行 fresh audit（**不要用 `tee`** — 避免 pipefail 議題；用 raw command 即可）：
   ```bash
   npx eslint tests/integration/profile/ tests/integration/weather/ --format stylish
   ```
   並記下 raw count + unique line:col + 違規 source line（**逐字 quote 自檔案**，不要 paraphrase）。
3. 對每處違規，Read 周邊 5–15 行 context，記錄：
   - 所在 it / describe block name（逐字 string）
   - 查詢 pattern（如 `baseElement.querySelector('[aria-hidden="true"]')`）
   - 該斷言要驗的事（一句話）
   - 是否有 `const { container | baseElement } = render(...)` 解構
   - 對應 production component 路徑與目前 affordance（grep `data-testid` / `role` / `aria-label` / `aria-hidden`）
4. 對每處決定建議修法（plan §5 Phase 4 A/B/C）：
   - **B 優先**：用 `within(scope)` / `screen.getByRole` / `screen.getByLabelText` / 既有 `data-testid`
   - **C fallback**：production component 加最小 `data-testid`（與 S6 unreadDot 同 pattern）
   - **A 禁止**：本 session 不改 a11y 結構（不加 role / 換 element type）；若工程師判斷需要 A，必須 escalate
5. 邊界檢查（不要 fix，只報結果）：
   ```bash
   npx eslint tests/integration/notifications/NotificationPanel.test.jsx tests/integration/notifications/notification-click.test.jsx tests/integration/notifications/scroll-to-comment.test.jsx tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/navbar/NavbarMobile.test.jsx
   # 預期 exit 0
   npx eslint tests/integration/posts/ tests/integration/toast/ tests/integration/strava/
   # 預期 exit 1，每檔 raw / unique no-node-access count 列出（S8 scope）
   ```
6. ESLint config 健全度：
   ```bash
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   ```
   兩條應仍是 `error`；若 `no-node-access` 是 `off`，**停下回報 main agent**（commit bridge 沒恢復）。
7. 整份報告以結構化呈現：(A) per-violation table、(B) 邊界檢查、(C) ESLint config 健全度、(D) 風險/scope changer。

**禁止行為**：

- 不寫任何檔（read-only）
- 不跑 vitest
- 不下任何 `git` 寫入指令
- 不 paraphrase / 修飾違規 source line（必須逐字 quote）

**Acceptance Criteria（Reviewer 必驗 — T36 由 main agent 直接驗收，不另派 Reviewer subagent）**：

1. 報告涵蓋全部 5 unique sites（profile 3 + weather 2）含 line:col 與 verbatim source line
2. 每處違規有指定建議 A/B/C；任何指 A 的處有 escalation 標記
3. S5/S6 邊界 (`NotificationPanel` / `notification-click` / `scroll-to-comment` / `NavbarDesktop` / `NavbarMobile`) 全 exit 0
4. S8 scope (`posts` / `toast` / `strava`) raw/unique count 有列；總 unique site 約 7 處（Phase 4 §5 line 542 估算）
5. ESLint config `no-node-access` 仍是 `error`；ignores array 仍是 3 entry（`tests/e2e/**` / `tests/_helpers/e2e-helpers.js` / `tests/_helpers/notifications/scroll-to-comment-mock.jsx`）

**Failure recovery**：

- 若報告 paraphrase 違規 line（hallucinate；§2.38）→ 重派 Explore subagent，明確要求 verbatim Read
- 若 S5/S6 邊界出現新 violation → 標 escalation；先停 T37 開工，主 agent 與用戶討論
- 若 ESLint config 不對 → 主 agent 自行修 commit bridge（恢復 `error`），再重派 T36

---

### T37：ProfileEventList sentinel cleanup（Wave 1 並行 with T38）

**前置**：T36 PASS，且 audit 確認 sentinel 沒有任何 stable affordance（無 testid / role / label，僅 `aria-hidden="true"` + ref）。

**Engineer prompt 要點**：

1. cd 到 worktree 根 (`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`)。
2. 改兩個檔：
   - **Production**: `src/ui/users/ProfileEventListScreen.jsx` line ~58 sentinel `<div>`：

     ```jsx
     // 改前
     {
       hasMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />;
     }
     // 改後
     {
       hasMore && (
         <div
           ref={sentinelRef}
           className={styles.sentinel}
           aria-hidden="true"
           data-testid="profile-event-list-sentinel"
         />
       );
     }
     ```

     - 只加 `data-testid`，**不**改 className / aria-hidden / ref / 條件 render 邏輯
     - 這是 plan §5 修法 C（minimal data-testid，與 S6 NotificationItem unreadDot 同 pattern；§2.32 / §2.42）

   - **Test**: `tests/integration/profile/ProfileEventList.test.jsx` 兩個 it block：
     - `renders sentinel when hasMore is true`（line ~230–243）：
       ```js
       // 改前
       const { baseElement } = render(<ProfileEventList uid={TEST_UID} />);
       const sentinel = baseElement.querySelector('[aria-hidden="true"]');
       expect(sentinel).toBeInTheDocument();
       // 改後
       render(<ProfileEventList uid={TEST_UID} />);
       expect(screen.getByTestId('profile-event-list-sentinel')).toBeInTheDocument();
       ```
     - `does not render sentinel when hasMore is false`（line ~246–259）：
       ```js
       // 改前
       const { baseElement } = render(<ProfileEventList uid={TEST_UID} />);
       const sentinel = baseElement.querySelector('[aria-hidden="true"]');
       expect(sentinel).not.toBeInTheDocument();
       // 改後
       render(<ProfileEventList uid={TEST_UID} />);
       expect(screen.queryByTestId('profile-event-list-sentinel')).not.toBeInTheDocument();
       ```
     - **「在場」用 `getByTestId`（找不到 throw）；「不在場」用 `queryByTestId`（找不到回 null）**，不能寫反（§2.32）
     - 移除 `const { baseElement } = render(...)` 解構（§2.34）
     - 不改其他 it block；不改 import；不改 mock 設定

3. 跑：
   ```bash
   npx eslint src/ui/users/ProfileEventListScreen.jsx tests/integration/profile/ProfileEventList.test.jsx --format stylish
   npx vitest run tests/integration/profile/ProfileEventList.test.jsx
   ```
   兩者皆需 exit 0；vitest 該檔全 PASS（含未動的其他 it block）。
4. 不 git add / commit / push。

**禁止行為**：

- 不改 className / aria-hidden / ref / sentinel 條件邏輯
- 不改 `ProfileEventListScreen` 其他 element / structure
- 不改 test 檔其他 it block / mock / import 排序
- 不在 ignores 加 helper 路徑（不需要）
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 `tests/integration/profile/ProfileHeader.test.jsx` 或 weather domain 任何檔

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動兩檔：`src/ui/users/ProfileEventListScreen.jsx`（加 `data-testid` 一行屬性）+ `tests/integration/profile/ProfileEventList.test.jsx`（兩 it block）
2. `ProfileEventListScreen.jsx` sentinel `<div>` 維持 `ref` / `className` / `aria-hidden="true"`，多了 `data-testid="profile-event-list-sentinel"`
3. Test 檔兩 it block：「在場」用 `screen.getByTestId(...)`、「不在場」用 `screen.queryByTestId(...)`
4. Test 檔 `const { baseElement } = render(...)` 解構在這兩 it 已移除（其他 it 不必動）
5. `npx eslint src/ui/users/ProfileEventListScreen.jsx tests/integration/profile/ProfileEventList.test.jsx` exit 0；該 test 檔 `testing-library/no-node-access` = 0
6. `npx vitest run tests/integration/profile/ProfileEventList.test.jsx` 全 PASS（測試件數與 S6 audit 一致，沒有少跑或新增）
7. **沒有**動 ProfileHeader.test.jsx / favorites.test.jsx / weather-page.test.jsx / 其他 src

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/ui/users/ProfileEventListScreen.jsx tests/integration/profile/ProfileEventList.test.jsx
rg -n "data-testid|aria-hidden|className=\\{styles\\.sentinel\\}" src/ui/users/ProfileEventListScreen.jsx
rg -n "baseElement|getByTestId|queryByTestId|profile-event-list-sentinel" tests/integration/profile/ProfileEventList.test.jsx
npx eslint src/ui/users/ProfileEventListScreen.jsx tests/integration/profile/ProfileEventList.test.jsx --format stylish 2>&1 | tee /tmp/s7-t37-review.txt
rg -n "testing-library/no-node-access" /tmp/s7-t37-review.txt
npx vitest run tests/integration/profile/ProfileEventList.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access`（query 寫錯 / 解構未移除）→ 重派 Engineer 修
- 「不在場」用 `getByTestId` 會 throw → Reviewer FAIL，重派 Engineer 改 `queryByTestId`
- Vitest 該檔 fail → 回報 failing test name + error，重派 Engineer
- Diff 動到非 ProfileEventList 範圍 → 重派 Engineer 限縮（revert 越界改動，重做精確 diff）
- 若 Engineer 主張「不應加 testid，純測試重構」並 escalate → 主 agent 與用戶討論：(a) 接受加 testid（推薦，§2.42）；(b) 改測 IntersectionObserver 行為（高成本，須拆 task）

---

### T38：ProfileHeader XSS test scope cleanup（Wave 1 並行 with T37）

**前置**：T36 PASS。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 只改 `tests/integration/profile/ProfileHeader.test.jsx` line ~170–184 的 `escapes <script> in bio content to prevent XSS` it block：
   - **Production component 已有 affordance**：`src/app/users/[uid]/ProfileHeader.jsx:79` `<p data-testid="profile-bio">`，**不需動 component**。
   - 修法（B — 用既有 testid scope，不再做 global document scan）：

     ```js
     // 改前（line 178–184）
     render(<ProfileHeader user={profile} />);

     // Assert — 原始字串應該被當文字 render，而不是 script tag
     expect(screen.getByText(maliciousBio)).toBeInTheDocument();
     // 確認 jsdom 不會真的產生 script element
     expect(document.querySelectorAll('script').length).toBe(0);

     // 改後
     render(<ProfileHeader user={profile} />);

     // Assert — 原始字串應該被當文字 render，而不是 script tag
     const bio = screen.getByTestId('profile-bio');
     expect(bio).toHaveTextContent(maliciousBio);
     // 確認 React escape 後 bio 元素本身是 <p>，沒有真的產生 script element
     expect(bio.tagName).toBe('P');
     ```

   - **`expect(bio).toHaveTextContent(maliciousBio)`**: jest-dom matcher，斷言 element 的可見文字 = `maliciousBio` 原始字串（不是被 parse 成 element）— 證明 React escape 成功。
   - **`expect(bio.tagName).toBe('P')`**: 補強斷言，確認 bio 自己仍是 `<p>` 而非被 hijack 成其他 tag。`tagName` 是 Element property、非 DOM navigation API（`querySelector` / `parentElement` / `children` 才是 testing-library `no-node-access` 抓的對象；驗證請見 [v7 docs](https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/no-node-access.md)）。
   - 安全測試論述：line 181 (`getByText(maliciousBio)`) + 改後 (`toHaveTextContent` + `tagName === 'P'`) 已等價驗證 React escape：若 React 沒 escape，`<script>alert("xss")</script>Hi there` 會被 parse 成 `<script>` element + 文字 "Hi there"，`getByText(maliciousBio)` 找不到完整原始字串、`toHaveTextContent(maliciousBio)` 也會 fail。

3. 不改 import / mock / fixtures / `createProfile` helper。
4. 跑：
   ```bash
   npx eslint tests/integration/profile/ProfileHeader.test.jsx --format stylish
   npx vitest run tests/integration/profile/ProfileHeader.test.jsx
   ```
5. 不 git add / commit / push。

**禁止行為**：

- 不改 `src/app/users/[uid]/ProfileHeader.jsx`（component 已有所需 affordance）
- 不刪 it block / 改 testname
- 不用 `document.querySelectorAll` / `document.querySelector` / `bio.children` / `bio.querySelectorAll` 任何 DOM navigation
- 不加 wrapper container 包 `render`（過度工程，現有 testid 已足夠）
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 ProfileEventList / favorites / weather-page

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `tests/integration/profile/ProfileHeader.test.jsx`
2. `escapes <script> in bio content to prevent XSS` it block 已移除 `document.querySelectorAll('script')` 整行
3. 改後同 it block 仍有 ≥ 2 個有效斷言（`toHaveTextContent(maliciousBio)` + `tagName === 'P'` 或等價組合）來驗證 React escape
4. 沒有 `document.queryX` / `bio.children` / `bio.querySelectorX` / `bio.parentElement` 等 DOM navigation
5. `npx eslint tests/integration/profile/ProfileHeader.test.jsx` exit 0；該檔 `testing-library/no-node-access` = 0
6. `npx vitest run tests/integration/profile/ProfileHeader.test.jsx` 全 PASS（測試件數不變）

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/profile/ProfileHeader.test.jsx
rg -n "querySelector|querySelectorAll|parentElement|children\\b|document\\." tests/integration/profile/ProfileHeader.test.jsx
rg -n "toHaveTextContent|getByTestId|tagName|maliciousBio" tests/integration/profile/ProfileHeader.test.jsx
npx eslint tests/integration/profile/ProfileHeader.test.jsx --format stylish 2>&1 | tee /tmp/s7-t38-review.txt
rg -n "testing-library/no-node-access" /tmp/s7-t38-review.txt
npx vitest run tests/integration/profile/ProfileHeader.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → 重派 Engineer 修
- 安全斷言被弱化（如只剩 `getByText` 而沒驗 React escape）→ Reviewer FAIL，重派 Engineer 補等價斷言
- 動 `ProfileHeader.jsx` production code → Reviewer FAIL，重派 Engineer revert
- Vitest 該 it fail（`toHaveTextContent` matcher 不 match） → 主 agent 與 Engineer 確認原始 string；可能需要 trim or normalise，但不可改回 `document.querySelectorAll`

---

### T39：favorites chip cleanup（Wave 2 並行 with T40）

**前置**：T36 PASS（T37 / T38 不必先完成；T39 改檔不重疊）。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 只改 `tests/integration/weather/favorites.test.jsx` line ~487–510 的 `should remove chip and call removeFavorite on click` it block：
   - **Production affordance**：`src/components/weather/FavoritesBar.jsx` 已有 chip `<div role="listitem">` + remove button `aria-label="移除${name}收藏"`；**不需動 component**。
   - 修法（B — 用 `screen.getByRole('button', { name: /移除.../ })` 直接拿 remove button，跳過 chip container 查詢）：
     ```js
     // 改前（line 499–504）
     const chip = await screen.findByText(/板橋/);
     const chipContainer =
       chip.closest('[class*="Chip"]') || chip.closest('[class*="chip"]') || chip.parentElement;
     const removeBtn = within(/** @type {HTMLElement} */ (chipContainer)).getByRole('button', {
       name: /移除/i,
     });
     // 改後
     // chip 文字仍可 await 讓 chip render 完成，再用語意 query 找 remove button
     await screen.findByText(/板橋/);
     const removeBtn = await screen.findByRole('button', { name: /移除.*板橋.*收藏/ });
     ```
   - 確認 fixture 中 `fav-2` 的 `formatLocationNameShort` 結果（看 mockFavorites + 實際 button label）：button aria-label 是 `移除${name}收藏`；regex `/移除.*板橋.*收藏/` 能 match 即可。若實際 label 不含「板橋」字樣（例如只剩縣名），engineer 改 regex 對齊實際 label，**不要**降級回 `closest()` chain。
   - 移除不再需要的 import：若改後不再用 `within`，從 `@testing-library/react` import 移除（檢查檔內其他位置是否仍用 `within`，若無才移除；若有保留）
3. 不改其他 it block / mock / fixtures。
4. 跑：
   ```bash
   npx eslint tests/integration/weather/favorites.test.jsx --format stylish
   npx vitest run tests/integration/weather/favorites.test.jsx
   ```
5. 不 git add / commit / push。

**禁止行為**：

- 不動 `src/components/weather/FavoritesBar.jsx`
- 不用 `closest()` / `parentElement` / `querySelector` 任何形式
- 不加 `data-testid`（既有 `aria-label` 已足夠 — B 修法優先）
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 weather-page / profile / S5/S6/S8 任何檔

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `tests/integration/weather/favorites.test.jsx`
2. `should remove chip and call removeFavorite on click` it block 已移除 `chip.closest(...)` chain 與 `chip.parentElement`
3. removeBtn 透過 `screen.findByRole('button', { name: /.../ })` 取得；regex 能 match 實際 fixture 下 chip 對應 button 的 aria-label
4. 沒有 `chip.closest` / `chip.parentElement` / `container.querySelector` / `chipContainer` 變數
5. `within` import 處理一致：若檔內其他 it block 仍用 `within`，保留 import；若已無使用，從 import 移除
6. `npx eslint tests/integration/weather/favorites.test.jsx` exit 0；該檔 `testing-library/no-node-access` = 0
7. `npx vitest run tests/integration/weather/favorites.test.jsx` 全 PASS（測試件數不變，含 `should remove chip` 仍 PASS）

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/weather/favorites.test.jsx
rg -n "closest\\(|parentElement|chipContainer|querySelector" tests/integration/weather/favorites.test.jsx
rg -n "findByRole|移除|within\\b" tests/integration/weather/favorites.test.jsx
npx eslint tests/integration/weather/favorites.test.jsx --format stylish 2>&1 | tee /tmp/s7-t39-review.txt
rg -n "testing-library/no-node-access" /tmp/s7-t39-review.txt
npx vitest run tests/integration/weather/favorites.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → 重派 Engineer 修
- vitest fail（regex 不 match）→ Engineer 用實際 fixture 觀察 button aria-label，調整 regex，**不要**降級用 `closest()`
- Diff 動到非 favorites.test.jsx → 重派 Engineer 限縮
- Engineer 想用 `data-testid` → Reviewer FAIL，要求改 B（`getByRole` + aria-label）

---

### T40：weather-page skeleton cleanup（Wave 2 並行 with T39）

**前置**：T36 PASS（與 T39 不撞檔）。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 只改 `tests/integration/weather/weather-page.test.jsx` line ~393–397 的 `renders loading skeleton when runtime state is loading` it block 內的 line 396：
   - **Production affordance**：`src/components/weather/WeatherCardSkeleton.jsx:9` `<div className={styles.weatherCard} aria-busy="true" aria-label="天氣資料載入中">`；**不需動 component**。
   - 修法（B — 用既有 `aria-label`）：
     ```js
     // 改前（line 396）
     expect(document.querySelector('[class*="skeleton"]')).toBeTruthy();
     // 改後
     expect(screen.getByLabelText('天氣資料載入中')).toBeInTheDocument();
     ```
   - 不改其他斷言 / it block；不改 mock / fixtures。
3. 確認 import：`screen` / `getByLabelText` 透過 `import { screen } from '@testing-library/react'` 已存在（檔內其他 it block 預期已用 `screen`）。
4. 跑：
   ```bash
   npx eslint tests/integration/weather/weather-page.test.jsx --format stylish
   npx vitest run tests/integration/weather/weather-page.test.jsx
   ```
5. 不 git add / commit / push。

**禁止行為**：

- 不動 `src/components/weather/WeatherCardSkeleton.jsx` 或其他 production code
- 不改其他 it block 斷言
- 不用 `document.queryX` / `container.queryX` / `closest()` / `parentElement`
- 不加新 testid（既有 aria-label 已足夠）
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 favorites.test.jsx / profile domain / S5/S6/S8 任何檔

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `tests/integration/weather/weather-page.test.jsx` 一行（line 396 替換）
2. 改後使用 `screen.getByLabelText('天氣資料載入中')` 或等價 `screen.getByLabelText(/天氣資料載入中/)` regex
3. 沒有 `document.querySelector` / `document.querySelectorAll` 在該 it block
4. `npx eslint tests/integration/weather/weather-page.test.jsx` exit 0；該檔 `testing-library/no-node-access` = 0
5. `npx vitest run tests/integration/weather/weather-page.test.jsx` 全 PASS（測試件數不變）

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/weather/weather-page.test.jsx
rg -n "getByLabelText|querySelector|skeleton|天氣資料載入中" tests/integration/weather/weather-page.test.jsx
npx eslint tests/integration/weather/weather-page.test.jsx --format stylish 2>&1 | tee /tmp/s7-t40-review.txt
rg -n "testing-library/no-node-access" /tmp/s7-t40-review.txt
npx vitest run tests/integration/weather/weather-page.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → 重派 Engineer 修（多半是改錯行）
- vitest fail（label not found）→ Engineer 確認實際 jsdom 下 skeleton render 是否真的有 `aria-label`；若 component 有條件 render 路徑，調整 fixture / regex；不可降級回 `document.querySelector`
- Diff 動到非 line 396 範圍 → 重派 Engineer 限縮

---

### T41：Session 7 closeout + handoff update（獨占）

**前置**：T37–T40 reviewer 全 PASS。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 確認 working tree：
   ```bash
   git status --short
   git diff --name-only
   ```
   預期 dirty：`eslint.config.mjs`（commit bridge 後恢復 `error` 留下的修改）+ T37/T38/T39/T40 寫過的 test 檔 + `src/ui/users/ProfileEventListScreen.jsx`（T37 加 testid）+ `specs/024-eslint-testing-lib-cleanup/handoff.md`。
3. 跑 fresh verifications：
   ```bash
   # S7 target 全綠
   npx eslint tests/integration/profile/ tests/integration/weather/ --format stylish
   npx vitest run tests/integration/profile/ProfileEventList.test.jsx tests/integration/profile/ProfileHeader.test.jsx tests/integration/weather/favorites.test.jsx tests/integration/weather/weather-page.test.jsx
   # ESLint config 仍 error
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   # S5/S6 邊界仍 0 errors
   npx eslint tests/integration/notifications/ tests/integration/navbar/
   # repo-wide 殘留 = S8 scope
   npx eslint src specs tests > /tmp/s7-t41-repo-wide.txt 2>&1
   echo "exit=$?"
   rg -c "testing-library/no-node-access" /tmp/s7-t41-repo-wide.txt
   ```
4. 更新 `specs/024-eslint-testing-lib-cleanup/handoff.md`：
   - **§0 入門 30 秒**：Session 7 完成；下一 session 接 S8（plan §8.2 S8 — `tests/integration/posts/`、`tests/integration/toast/`、`tests/integration/strava/`，repo-wide audit 估計 7 unique sites / 12 raw messages）。Repo lint state 改寫實際殘留分布。
   - **§2 坑清單**：append S7 實際踩坑（如：sentinel 無 affordance 必須加 testid；ProfileHeader XSS 測試論述；`bio.tagName` 不算 DOM navigation；favorites 用 `getByRole('button', { name: /移除.../ })` 跳過 chip container 查詢；其他 surprise）
   - **§4 Session 完成紀錄**：新增 `Session 7（profile + weather）— 完成` 段，記錄：
     - T36–T41 各 task 結果（raw / unique 收斂數字、Reviewer PASS evidence）
     - 4 個 target 檔 ESLint exit code、vitest pass 件數
     - 動到的 production component（只有 `src/ui/users/ProfileEventListScreen.jsx` 加 testid）
     - profile + weather domain `no-node-access` 全清確認
     - S8 剩餘範圍（明確列 domain + 實測 unique sites）
   - **§5 下個 session 開工 checklist**：改成 S8 checklist：scope = `tests/integration/posts/`（PostDetail / PostFeed）+ `tests/integration/toast/`（crud-toast / toast-container）+ `tests/integration/strava/`（RunsRouteMap），plan §8.2 S8「🧺 小量收尾雜項」。
5. 不 git add / commit / push。

**禁止行為**：

- 不改 `eslint.config.mjs` / `src/**` / `tests/**`（T37 已加 testid，T41 不再動 production；commit bridge 由主 agent 處理）
- 不為了 repo-wide lint 全綠去修 S8 domain
- 不加 eslint disable / 關 rule / 加 broad ignores glob
- 不 git add / commit / push

**Acceptance Criteria（Reviewer 必驗）**：

1. `npx eslint tests/integration/profile/ tests/integration/weather/` exit 0
2. `npx vitest run` 4 個 target 檔全 PASS（測試件數記錄到 handoff）
3. `npx eslint tests/integration/notifications/ tests/integration/navbar/` exit 0（S5/S6 不退）
4. `eslint.config.mjs` line 399/400 仍是 `prefer-user-event: error` / `no-node-access: error`
5. Repo-wide lint 殘留全部來自 S8 scope（`posts` / `toast` / `strava`）；profile / weather / notifications / navbar 全 0
6. `handoff.md` §0 / §2 / §4 / §5 已按上述要求更新；§4 Session 7 段含 raw / unique / PASS evidence
7. Working tree 未 staged、未 commit、未 push

**Reviewer 驗收指令**：

```bash
npx eslint tests/integration/profile/ tests/integration/weather/ --format stylish
npx vitest run tests/integration/profile/ProfileEventList.test.jsx tests/integration/profile/ProfileHeader.test.jsx tests/integration/weather/favorites.test.jsx tests/integration/weather/weather-page.test.jsx
npx eslint tests/integration/notifications/ tests/integration/navbar/ --format stylish
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
npx eslint src specs tests > /tmp/s7-t41-review-repo-wide.txt 2>&1 || true
rg -c "testing-library/no-node-access" /tmp/s7-t41-review-repo-wide.txt
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/Session 7/,/^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/^## 5\./,/^## 6\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
git status --short
git diff --name-only
```

**Failure recovery**：

- S7 target lint 仍 fail → Reviewer 回報 rule + line:col；主 agent 重派對應 T37/T38/T39/T40 Engineer
- Vitest fail → 回報 failing command / test；重派對應 Engineer
- S5/S6 邊界 regression → 嚴重，主 agent 立刻停 closeout、用 git diff 找哪 task 的改動越界，重派該 Engineer revert + redo
- Repo-wide lint 殘留出現非 S8 domain → 重派對應 task Engineer 修
- handoff 寫成 repo-wide 全綠 / S8 已清 → 重派 T41 Engineer 修文件
- 發現 `eslint.config.mjs` rule level 被 task Engineer 改 → Reviewer FAIL；主 agent 不自行修，重派該 task Engineer revert

---

## Session 7 結束狀態（DOD）

- `testing-library/no-node-access`: 維持 `error`（line 400）
- `testing-library/prefer-user-event`: 維持 `error`（line 399）
- `tests/integration/profile/ProfileEventList.test.jsx`: 0 `testing-library/no-node-access` errors
- `tests/integration/profile/ProfileHeader.test.jsx`: 0 `testing-library/no-node-access` errors
- `tests/integration/weather/favorites.test.jsx`: 0 `testing-library/no-node-access` errors
- `tests/integration/weather/weather-page.test.jsx`: 0 `testing-library/no-node-access` errors
- 必要 component affordance 僅限 `src/ui/users/ProfileEventListScreen.jsx`（sentinel `<div>` 加 `data-testid="profile-event-list-sentinel"`）
- 整個 profile + weather domain `no-node-access` 全清
- `tests/integration/posts/`、`tests/integration/toast/`、`tests/integration/strava/` 仍可能 fail（S8 scope）；不要把 S8 domain 混進 S7
- `eslint.config.mjs` `ignores` array 維持 3 entries（不加新 helper、不加 broad glob）
- `handoff.md` 記錄 Session 7 evidence 與 S8 開工 checklist
- 不 commit、不 stage、不 push（commit 由主 agent 在規劃 commit / 收尾 commit 統一處理）

---

## 主 agent 派遣 SOP（給未來 session 參考）

```text
0. 主 agent 自行 commit bridge：暫關 'testing-library/no-node-access' error → off，commit 規劃文件，立刻恢復 error
1. 派 T36 Explore（read-only）→ 主 agent 直接驗收（不另派 reviewer）
2. Wave 1 並行：T37 Engineer + T38 Engineer 同時派；各自寫完回報後,並行派 T37 Reviewer + T38 Reviewer
3. Wave 1 PASS 後，Wave 2 並行：T39 Engineer + T40 Engineer；同上接 reviewer
4. T37–T40 全 PASS 後，T41 closeout + handoff update（獨占）；T41 也派 Reviewer 驗收
5. 全綠 → main agent 在規劃 commit 之外不自行 commit；下個 session 接手時 working tree 仍 dirty（除主 agent 規劃 commit 帶走的部分）
6. 任一 reviewer FAIL → 重派該 task Engineer 修；不主 agent 自己改檔
```

> 主 agent **不**自己跑 `npx eslint ... --fix`、不自己改 test / component / config（除 commit bridge 一行）。所有有副作用的指令都派 subagent 跑。

---

# Session 9 Tasks — Phase 5：repo-wide verification + PR

> **Source**: `plan.md` §5 Phase 5 Task 5.1–5.6 + §8.2 S9（✅ 驗證收尾）
> **Goal**: fresh repo-wide verification → commit → push → PR → post-merge sync SOP。
> **執行模式**：Session 9 從 T49 到 T57 **全程不准主 agent 做**。主 agent 只派 Engineer/Reviewer、彙整回報、決定下一個派遣；不跑驗證指令、不改檔、不修 code/test、不 git add/commit/push。
> **Branch**：`024-eslint-testing-lib-cleanup`（worktree 路徑：`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`）
> **承接狀態**：最近 commit 應為 `3e987f9 Finish testing-library DOM cleanup`；`git status --short` 在本規劃時為乾淨。`handoff.md` 舊的「dirty 11 檔」是 T48 當時狀態，Session 9 必須 fresh 驗證。

---

## Parallelism — 同時最多 4 個 subagents（2 Engineer + 2 Reviewer）

| 階段                          | 並行度      | 原因                                                                                 |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| T49 preflight                 | **1**       | Read-only scope audit；先確認 branch / commit / clean tree / Phase 5 是否可開工      |
| T50–T53 verification Engineer | **最多 2**  | 只適用於互不寫檔的驗證 wave；ESLint / browser / server / static gates 可分批並行     |
| T50–T53 Reviewer              | **最多 2**  | Reviewer 必須在同任務 Engineer 完成後跑；不和同任務 Engineer 同時跑                 |
| T54 commit                    | **1**       | git add/commit/pre-commit gate 會改 index/history，必須獨占                           |
| T55 push + PR                 | **1**       | push / PR 建立有外部副作用，必須獨占                                                  |
| T56 post-merge sync SOP       | **1**       | merge 後 worktree sync / rebase / npm install 必須逐一處理，不能跟其他任務並行        |
| T57 closeout                  | **1**       | 只更新交接文件；要彙整 T49–T56 evidence，避免和 verification/git 操作交錯             |

**硬規則**：

- 每個 Engineer 完成後都必須配 Reviewer；Reviewer 不通過就把修正交回同 Engineer 或 dedicated fix Engineer，直到 Reviewer PASS。
- 主 agent 不跑指令、不改檔；遇到 failure 只彙整 failing command/log/檔案與重派。
- 涉及 code/test behavior 的修正，主 agent 必須先停止並回報用戶，取得確認後才派 dedicated Engineer + Reviewer。
- T54–T56（commit / push / PR / post-merge sync）獨占，不和任何其他 subagent 並行。
- 不准 `--no-verify`；pre-commit 失敗就回到對應 task 或 fix Engineer。

---

## T49：fresh preflight / scope audit（read-only, sequential）

**Engineer prompt 要點**：

1. cd 到 `/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`。
2. 只讀確認：
   ```bash
   git branch --show-current
   git log -1 --oneline
   git status --short
   git diff --name-only
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   sed -n '1,120p' .husky/pre-commit
   sed -n '1,220p' .codex/rules/sensors.md
   ```
3. 確認 `tasks.md` 有 Session 9 T49–T57，`handoff.md` §0 指向 Session 9。
4. 回報是否可以進 T50–T53 verification wave；若 worktree 不乾淨，列出 dirty files 與是否只限 docs。

**Acceptance Criteria**：

1. Branch 是 `024-eslint-testing-lib-cleanup`。
2. 最近 commit 是 `3e987f9 Finish testing-library DOM cleanup`，或 Engineer 明確回報 current commit drift。
3. `git status --short` 乾淨；若不乾淨，列完整 dirty list 並停止。
4. `prefer-user-event` / `no-node-access` 都維持 `error`。
5. `.husky/pre-commit` 實際包含：`npm run lint -- --max-warnings 0`、`npm run type-check`、`npm run depcruise`、`npm run spellcheck`、`npx vitest run --project=browser`。

**Reviewer 驗收指令**：

```bash
git branch --show-current
git log -1 --oneline
git status --short
git diff --name-only
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
sed -n '1,120p' .husky/pre-commit
```

**Failure recovery**：

- Branch / commit 不符 → Reviewer 回報 current branch + commit；主 agent 停下詢問是否仍在此 worktree 繼續。
- Worktree dirty → 不進 T50；若 dirty 是 docs 以外，主 agent 不 revert，先回報用戶。
- Rule level 非 `error` → 不由主 agent 修；派 dedicated config Engineer 前先回報用戶確認。

---

## T50：repo-wide ESLint 0（read-only verification）

**Engineer prompt 要點**：

1. 前置：T49 PASS。
2. 跑 repo-wide ESLint：
   ```bash
   npx eslint src specs tests > /tmp/s9-t50-eslint.txt 2>&1
   eslint_status=$?
   echo "exit=$eslint_status"
   grep -c "testing-library/no-node-access" /tmp/s9-t50-eslint.txt || true
   grep -c "testing-library/" /tmp/s9-t50-eslint.txt || true
   exit $eslint_status
   ```
3. 回報 exit code、是否有 output、testing-library count。不要用 `status=$?`（zsh read-only 變數坑）。

**Acceptance Criteria**：

1. `npx eslint src specs tests` exit 0。
2. `testing-library/no-node-access` count = 0。
3. `testing-library/` count = 0。
4. 沒有修改任何檔案；沒有 git add/commit/push。

**Reviewer 驗收指令**：

```bash
npx eslint src specs tests > /tmp/s9-t50-review-eslint.txt 2>&1
eslint_status=$?
echo "exit=$eslint_status"
grep -c "testing-library/no-node-access" /tmp/s9-t50-review-eslint.txt || true
grep -c "testing-library/" /tmp/s9-t50-review-eslint.txt || true
git status --short
exit $eslint_status
```

**Failure recovery**：

- ESLint fail → Reviewer attach `/tmp/s9-t50-review-eslint.txt` relevant lines + failing rule/file/line。主 agent 不修，依檔案派 dedicated fix Engineer。
- 若 failure 涉及 code/test behavior → 主 agent 先回報用戶取得確認，再派 fix Engineer + Reviewer。
- 若只有 docs lint/spell issue → 仍由 docs fix Engineer 處理，不由主 agent 直接改。

---

## T51：full browser Vitest（read-only verification）

**Engineer prompt 要點**：

1. 前置：T49 PASS；可與 T50/T52/T53 不寫檔驗證 wave 並行，但同任務 Reviewer 必須等 Engineer 完成。
2. 跑完整 browser/jsdom suite：
   ```bash
   npm run test:browser
   ```
3. 回報 exit code、Test Files / Tests pass count、任何 skipped/failing test。

**Acceptance Criteria**：

1. `npm run test:browser` exit 0。
2. 回報完整 pass count。
3. 沒有修改任何檔案；沒有 git add/commit/push。

**Reviewer 驗收指令**：

```bash
npm run test:browser
git status --short
```

**Failure recovery**：

- Browser Vitest fail → Reviewer 回報 failing test name、檔案、錯誤摘要。主 agent 不修，派 dedicated test fix Engineer。
- 若 fix 會改 production/test behavior → 先停下回報用戶，取得確認後才派 Engineer + Reviewer。
- Flaky/timeout → Reviewer 重跑一次前先回報是否同檔同錯；不得自行調 timeout 或 skip test。

---

## T52：server Vitest（Firebase emulator verification）

**Engineer prompt 要點**：

1. 前置：T49 PASS。
2. 跑 server suite：
   ```bash
   npm run test:server
   ```
3. 若因 emulator / port / credential / environment 問題 fail，回報原始錯誤，不自行改設定。
4. 回報 exit code、Test Files / Tests pass count、emulator 啟動狀態。

**Acceptance Criteria**：

1. `npm run test:server` exit 0，或明確判定為環境 blocker 並附完整 failing command/error。
2. 沒有修改任何檔案；沒有 git add/commit/push。

**Reviewer 驗收指令**：

```bash
npm run test:server
git status --short
```

**Failure recovery**：

- Test assertion fail → 主 agent 不修；先回報用戶，取得確認後派 server fix Engineer + Reviewer。
- Emulator/environment fail → Reviewer 記錄 command、port、錯誤訊息；主 agent 不改 package/firebase 設定，先回報 blocker。
- 不得把 server failure 從 PR evidence 移除；PR description 要如實標示 blocker 或修復後 evidence。

---

## T53：type-check + depcruise + spellcheck（read-only verification）

**Engineer prompt 要點**：

1. 前置：T49 PASS。
2. 跑 static gates：
   ```bash
   npm run type-check
   npm run depcruise
   npm run spellcheck
   ```
3. 分別回報三個 exit code；不要把三條 command 串成一個模糊結果。

**Acceptance Criteria**：

1. `npm run type-check` exit 0。
2. `npm run depcruise` exit 0。
3. `npm run spellcheck` exit 0。
4. 沒有修改任何檔案；沒有 git add/commit/push。

**Reviewer 驗收指令**：

```bash
npm run type-check
npm run depcruise
npm run spellcheck
git status --short
```

**Failure recovery**：

- Type/depcruise/spell fail → Reviewer 回報 failing command + exact output。主 agent 不修。
- cSpell 只需要文件詞彙時，派 docs fix Engineer；若會改 `cspell.json`，先回報用戶確認是否允許超出 Session 9 原始 dirty scope。
- depcruise fail 代表架構違規，不得用 ignore 繞過；先回報用戶再派 dedicated Engineer。

---

## T54：pre-commit gate + commit（exclusive）

**Engineer prompt 要點**：

1. 前置：T50、T51、T52、T53 Reviewer 全 PASS，且主 agent 已彙整 evidence。
2. 獨占執行；不和任何 subagent 並行。
3. 確認 scope：
   ```bash
   git status --short
   git diff --stat
   git diff --name-only
   ```
4. 若 scope 符合 024 cleanup，執行 commit：
   ```bash
   git add <allowed files from cleanup>
   git commit -m "Finish testing-library cleanup"
   ```
   Commit 會觸發 `.husky/pre-commit`：`npm run lint -- --max-warnings 0` → `npm run type-check` → `npm run depcruise` → `npm run spellcheck` → `npx vitest run --project=browser`。
5. 若 pre-commit 失敗，不准 `--no-verify`；保留 output，回報 failing command。

**Acceptance Criteria**：

1. Commit 前 scope 已列出並符合 cleanup PR。
2. Pre-commit gate 全部通過。
3. 產生一個 commit，回報 commit hash。
4. Commit 後 `git status --short` 乾淨。
5. 沒有使用 `--no-verify`。

**Reviewer 驗收指令**：

```bash
git log -1 --oneline
git status --short
git show --stat --oneline --name-only HEAD
```

**Failure recovery**：

- Pre-commit fail → 不可 bypass；Reviewer 回報 failing step/log。主 agent 回到 T50–T53 對應 task 或派 dedicated fix Engineer。
- Scope 含非 cleanup 檔案 → 不 commit；主 agent 不 revert，先回報用戶決定是否排除或保留。
- Commit message 需調整 → 派 git Engineer 修正；主 agent 不自行 amend。

---

## T55：push + PR（exclusive）

**Engineer prompt 要點**：

1. 前置：T54 Reviewer PASS 且 worktree clean。
2. 獨占執行：
   ```bash
   git status --short
   git push -u origin 024-eslint-testing-lib-cleanup
   ```
3. 開 PR。PR description 必含：
   - baseline / cleanup summary（testing-library violations 收斂，尤其 `no-node-access` → 0）
   - repo-wide ESLint 0 evidence
   - browser/server/type-check/depcruise/spellcheck/pre-commit evidence
   - post-merge `npm install` / worktree sync SOP
   - 已知取捨或注意事項（例如 server test 若有環境 blocker，必須如實寫）
4. 不 merge PR；不改 branch protection；不改 package/git 設定。

**Acceptance Criteria**：

1. Branch pushed successfully。
2. PR created，回報 PR URL。
3. PR description 包含 T50–T54 evidence 與 post-merge SOP。
4. Worktree 仍 clean。

**Reviewer 驗收指令**：

```bash
git status --short
git branch --show-current
git log -1 --oneline
gh pr view --json url,title,body,headRefName,baseRefName
```

**Failure recovery**：

- Push fail → Reviewer 回報 remote/error；主 agent 不改 remote 設定，先回報用戶。
- PR create fail → Reviewer 回報 `gh` auth/error；主 agent 不改 token/credential。
- PR body 缺 evidence → 派 PR docs Engineer 更新 PR description；不得假造未跑過的 evidence。

---

## T56：post-merge worktree sync SOP（exclusive, only after PR merge）

**Engineer prompt 要點**：

1. 前置：PR 已 merge。若尚未 merge，只回報「T56 blocked until merge」，不要執行。
2. 獨占執行 main/worktree sync SOP：
   ```bash
   git worktree list
   ```
3. 對 main worktree：checkout/pull main，跑 `npm install`，再跑必要 sanity（至少 `npm run lint` 或依 reviewer 指示）。
4. 對每個非 main worktree：先回報清單；逐一 rebase main。若 worktree dirty 或 rebase conflict，立即停止回報，不自動覆蓋。
5. 不刪 worktree，不 reset，不強推。

**Acceptance Criteria**：

1. T56 只在 PR merge 後執行。
2. main worktree 已 pull merged commit 並 `npm install`。
3. 所有非 main worktree sync 狀態有清單；dirty/conflict 有明確 blocker。
4. 沒有 destructive git command。

**Reviewer 驗收指令**：

```bash
git worktree list
git -C <main-worktree-path> status --short
git -C <main-worktree-path> log -1 --oneline
```

**Failure recovery**：

- PR 未 merge → 不做任何 sync；回報 blocked。
- `npm install` fail → Reviewer 回報 error；主 agent 不改 package/lockfile，先回報用戶。
- Rebase conflict/dirty worktree → 停止該 worktree，回報 path + conflict；不得自動 stash/drop/reset。

---

## T57：closeout + handoff update（exclusive docs）

**Engineer prompt 要點**：

1. 前置：T55 PR created；若 T56 尚未執行，明確記錄「post-merge sync pending」。
2. 只允許修改：
   - `specs/024-eslint-testing-lib-cleanup/handoff.md`
   - 必要時 `specs/024-eslint-testing-lib-cleanup/tasks.md` 的 Session 9 status note
3. 更新 `handoff.md`：
   - §0：Session 9 執行結果（PR URL、commit hash、目前狀態）
   - §2：append Phase 5 新坑（若有）
   - §4：append `Session 9（repo-wide verification + PR）— 完成`
   - §5：改成 post-merge / follow-up checklist，或標示全部完成
4. 不改 src/tests/eslint/package/git 設定；不 git add/commit/push，除非使用者另行要求。

**Acceptance Criteria**：

1. Closeout 記錄包含 T49–T56 evidence 摘要、commit hash、PR URL。
2. 若 server test 或 post-merge sync 有 blocker，handoff 明確寫 blocker 與下一步。
3. §5 指向下一步，不再指向已完成的 T49–T57。
4. `git status --short` 只顯示允許的 docs 變更。

**Reviewer 驗收指令**：

```bash
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/Session 9/,/^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/^## 5\./,/^## 6\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
git status --short
git diff -- specs/024-eslint-testing-lib-cleanup/tasks.md specs/024-eslint-testing-lib-cleanup/handoff.md
```

**Failure recovery**：

- handoff 寫成未跑的 gate 已 PASS → Reviewer FAIL，派 docs Engineer 修正。
- closeout 動到非 docs → Reviewer FAIL；主 agent 不 revert，回報用戶並派 docs Engineer 限縮。
- PR URL / commit hash 缺漏 → 派 docs Engineer 補齊。

---

## Session 9 主 agent 派遣 SOP

```text
0. 派 T49 Engineer → T49 Reviewer；不通過就停。
1. T49 PASS 後，最多同時派 2 個 read-only verification Engineer（T50–T53），各自完成後再派對應 Reviewer；同一任務 Engineer/Reviewer 不可同時跑。
2. T50–T53 全部 Reviewer PASS 後，獨占派 T54 Engineer commit；T54 Reviewer 驗 commit + clean tree。
3. T54 PASS 後，獨占派 T55 Engineer push + PR；T55 Reviewer 驗 PR body/evidence。
4. PR merge 後才派 T56 Engineer；未 merge 就標 blocked。
5. 派 T57 Engineer 更新 handoff；T57 Reviewer 驗 docs。
6. 任一 Reviewer FAIL → 回到該 task Engineer 或 dedicated fix Engineer；主 agent 不修。
7. 涉及 code/test behavior 的 fix → 先問用戶，確認後才派 Engineer + Reviewer。
```

---

# Session 8 Tasks — Phase 4 收尾（posts + toast + strava）

> **Source**: `plan.md` §5 Phase 4.2 / 4.6 / 4.7 + §8.2 S8（🧺 小量收尾雜項 — form a11y、container.firstChild 改 matcher）
> **Goal**: 1.5–2 hr — 把 S8 7 unique sites / 12 raw `testing-library/no-node-access` errors 全清為 0；最後一個 cleanup session，目標讓 `npx eslint src specs tests` exit 0（首次 repo-wide 全綠）
> **執行模式**：所有任務一律由 subagent 執行；主 agent 只做派遣、彙整、驗收回饋。從頭到尾包含後續修改都交 subagent。
> **Branch**：`024-eslint-testing-lib-cleanup`（worktree 路徑：`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`）
> **承接狀態**：Session 7 完成 commit `07182d4`（profile + weather 5 unique sites 全清）；本 session 開工前 working tree 應僅 `M eslint.config.mjs`（commit bridge 後恢復 `error`）。
> **本 session 開工前必讀**：
>
> - `handoff.md` §0、§2.49–§2.55（S8 audit 新觀察與 5 個修法決策）、§4「Session 8 規劃 — 完成」段
> - 本檔 T42–T48 spec
> - 本檔下方「主 agent 派遣 SOP」

---

## Session 8 Fresh Audit 摘要（planning evidence, 2026-04-28）

> 由主 agent 在規劃時跑（**規劃時可以**；正式執行階段仍由 T42 read-only Explore 重新驗收）。實際 line:col 與 raw / unique 數字以 T42 結果為準（`tee` exit code 議題見 handoff §2.29）。

### S8 scope per-file violation count

| 檔案                                               | Line:Col        | Raw → Unique | 違規 code（verbatim）                                                                         |
| -------------------------------------------------- | --------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `tests/integration/posts/PostDetail.test.jsx`      | 186:20          | 2 → 1        | `(btn) => btn.querySelector('svg') && btn.textContent.includes('5')`                          |
| `tests/integration/posts/PostFeed.test.jsx`        | 224:39          | 2 → 1        | `const feedContainer = baseElement.querySelector('[class*="feed"]');`                         |
| `tests/integration/strava/RunsRouteMap.test.jsx`   | 59:22 + 68:22   | 2 → 2        | `expect(container.firstChild).toBeNull();` ×2（兩個 null-render it block 各一處）             |
| `tests/integration/toast/crud-toast.test.jsx`      | 265:27 + 287:27 | 4 → 2        | `const form = document.querySelector('form');` ×2（create-event success + error 兩 it block） |
| `tests/integration/toast/toast-container.test.jsx` | 65:56           | 2 → 1        | `const container = screen.getByTestId('toast-id-1').parentElement;`                           |
| **總計**                                           |                 | **12 → 7**   |                                                                                               |

### Production component affordance summary

| 檔案                                   | Line    | 現有 affordance                                                                  | T?? 修法（A/B/C）                                                                                                                         |
| -------------------------------------- | ------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/PostCard.jsx`          | 315     | like button：無 aria-label / role override；HeartIcon 內含 svg + text            | T44 改法 A：加 `aria-label="按讚"` + `aria-pressed={post.liked}`                                                                          |
| `src/ui/posts/PostsPageScreen.jsx`     | 82      | feed wrapper `<div className={styles.feed}>` 無 testid / role / label            | T43 改法 C：加 `data-testid="post-feed"`（同 §2.32 / §2.44 pattern）                                                                      |
| `src/components/RunsRouteMapInner.jsx` | 36–38   | early return null when coords empty；map mock 已有 `data-testid="map-container"` | T45 純測試：不動 component                                                                                                                |
| `src/ui/events/EventCreateForm.jsx`    | 72 + 76 | `<form>` 無 aria-label；`<h2>揪團表單</h2>` 無 id                                | T46 改法 A：加 `aria-labelledby="event-create-form-title"` + h2 `id`，重用既有 visible text                                               |
| `src/components/ToastContainer.jsx`    | 18      | outer `<div>` 已有 `aria-live="polite"` + `aria-relevant`；無 role / aria-label  | T47 改法 A：加 `role="region"` + `aria-label="通知列表"`（landmark；不採 `role="status"`，因 individual Toast mock 也用 `role="status"`） |

### 邊界檢查

```
npx eslint tests/integration/notifications/ tests/integration/navbar/ tests/integration/profile/ tests/integration/weather/  →  exit 0（S5/S6/S7 不退）
npx eslint tests/integration/posts/ tests/integration/toast/ tests/integration/strava/                                       →  exit 1（7 unique sites）
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs                                              →  line 399 'error' / line 400 'error'
```

> 用戶 prompt `eslint.config.mjs:395` 是 line drift（§2.37 + §2.49）；當前實際 line 400 是 `'testing-library/no-node-access'`。Commit bridge 操作目標為 line 400，不是 line 395。

### 風險 / scope changer

- **T44 PostCard like button aria-label override accessible name**：加 `aria-label="按讚"` 後 button 的 accessible name 不再含可見 count "5"；視覺用戶仍看得到，screen reader 用戶聽不到 count。若用戶要保留 count 給 a11y 用戶，可改 `aria-label={\`按讚（${post.likesCount} 個讚）\`}`。本 plan 採 simpler 版本（與 PostCard 既有 menu button `aria-label="更多選項"` pattern 一致）。
- **T46 form implicit role 'form' 啟用條件**：`<form>` element 必須有 accessible name（aria-label / aria-labelledby）才有 implicit role 'form'（§2.54）；若漏加 `aria-labelledby` 或 h2 漏 id → `screen.getByRole('form', { name: ... })` throw。
- **T47 ToastContainer role 選擇**：`role="status"` 與 individual Toast mock `role="status"` collide，會造成 multi-status query 混亂 → 採 `role="region"` 避開 collision。

---

## Parallelism — 同時最多 4 個 subagents（2 Engineer + 2 Reviewer 配對；Engineer 改不同檔不撞）

| 階段                       | 並行度   | 原因                                                                                                                                        |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| T42 preflight              | **1**    | Read-only Explore，不寫檔；獨占執行                                                                                                         |
| T43–T47 Engineer 寫檔      | **2**    | 5 個 task 各動不同檔；保守限制 2 並行避免 dirty file list 混雜難 review。Wave 1 = T43 + T44；Wave 2 = T45 + T46；Wave 3 = T47（toast 獨占） |
| T43–T47 Reviewer 驗收      | **2**    | Reviewer 跑 ESLint + 單檔 vitest；不同檔不撞。每 wave Engineer 全 PASS 後才接 Reviewer                                                      |
| Engineer + Reviewer 同時跑 | **不行** | 同一檔同時讀寫會撞 — 同 task 的 Engineer 要先 PASS 完整 acceptance check 後才派 Reviewer                                                    |
| T48 closeout               | **1**    | 獨占；只允許改 `handoff.md`；跑 repo-wide ESLint / vitest 確認 0 violation 與 S5–S7 不退                                                    |

> **總 subagent 數估算**（first-pass 全綠）：T42×1 read-only + T43–T47 各 2（Engineer + Reviewer）= 11 次 + T48×2（Engineer + Reviewer）= **13 次 Agent 呼叫**。每多一輪 reviewer FAIL +2。

---

## Task 拆分

### T42：Session 8 preflight audit（read-only, sequential gate）

**Engineer prompt 要點**（read-only Explore subagent）：

1. cd 到 worktree 根 (`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`)。
2. 執行 fresh audit（**不要用 `tee`** — 避免 pipefail 議題；用 raw command 或 `zsh -o pipefail -c '...'`）：
   ```bash
   npx eslint tests/integration/posts/ tests/integration/toast/ tests/integration/strava/ --format stylish
   ```
   並記下 raw count + unique line:col + 違規 source line（**逐字 quote 自檔案**，不要 paraphrase；§2.38 hallucination 教訓）。
3. 對每處違規，Read 周邊 5–15 行 context，記錄：
   - 所在 it / describe block name（逐字 string）
   - 查詢 pattern（如 `baseElement.querySelector('[class*="feed"]')`）
   - 該斷言要驗的事（一句話）
   - 是否有 `const { container | baseElement } = render(...)` 解構
   - 對應 production component 路徑與目前 affordance（grep `data-testid` / `role` / `aria-label` / `aria-hidden` / `aria-labelledby`）
4. 對每處決定建議修法（plan §5 Phase 4 A/B/C，本 session 已預決於 §Session 8 Fresh Audit 摘要）：
   - **A**：T44 PostCard like button + T46 EventCreateForm form + T47 ToastContainer outer wrapper（皆加 a11y attr）
   - **C**：T43 PostFeed feed wrapper（加 testid，無 a11y semantic）
   - **純測試（不動 component）**：T45 RunsRouteMap（刪 container 解構 + 移除等價 firstChild 斷言）
   - 若工程師判斷需要改其他 A 變體（如改 `<form>` 為其他 element），必須 escalate 給 main agent
5. 邊界檢查（不要 fix，只報結果）：
   ```bash
   npx eslint tests/integration/notifications/ tests/integration/navbar/ tests/integration/profile/ tests/integration/weather/
   # 預期 exit 0（S5/S6/S7 不退）
   ```
6. ESLint config 健全度：
   ```bash
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
   ```
   兩條應仍是 `error`；若 `no-node-access` 是 `off`，**停下回報 main agent**（commit bridge 沒恢復；§2.26）。
7. 整份報告以結構化呈現：(A) per-violation table 配 verbatim source line + it block name、(B) 邊界檢查、(C) ESLint config 健全度、(D) 風險/scope changer。

**禁止行為**：

- 不寫任何檔（read-only）
- 不跑 vitest（T43–T47 Engineer 才跑）
- 不下任何 `git` 寫入指令
- 不 paraphrase / 修飾違規 source line（必須逐字 quote）
- 不改 `eslint.config.mjs` / `src/**` / `tests/**` 任何檔

**Acceptance Criteria（Reviewer 必驗 — T42 由 main agent 直接驗收，不另派 Reviewer subagent）**：

1. 報告涵蓋全部 7 unique sites（posts 2 + toast 3 + strava 2）含 line:col + verbatim source line
2. 每處違規有對應 T43–T47 task 編號 + 建議 A/B/C/「純測試」分類
3. S5/S6/S7 邊界 (`notifications` / `navbar` / `profile` / `weather`) 全 exit 0
4. ESLint config `no-node-access` 仍是 `error`（line 400）；ignores array 仍是 3 entry（`tests/e2e/**` / `tests/_helpers/e2e-helpers.js` / `tests/_helpers/notifications/scroll-to-comment-mock.jsx`）
5. Production component affordance 摘要與 §Session 8 Fresh Audit 摘要對齊；若 audit 結果與規劃 evidence 不一致 → 報告標 ⚠️，main agent 重新評估

**Failure recovery**：

- 若報告 paraphrase 違規 line（hallucinate；§2.38）→ 重派 Explore subagent，明確要求 verbatim Read
- 若 S5/S6/S7 邊界出現新 violation → 標 escalation；先停 T43 開工，主 agent 與用戶討論
- 若 ESLint config 不對 → 主 agent 自行修 commit bridge（恢復 `error`），再重派 T42
- 若 audit 數字 ≠ 規劃 evidence（例如多/少 unique sites）→ 報告標 ⚠️；main agent 與用戶討論是否 scope 變動

---

### T43：PostFeed feed wrapper testid + cleanup（Wave 1 並行 with T44）

**前置**：T42 PASS。

**Engineer prompt 要點**：

1. cd 到 worktree 根 (`/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`)。
2. 改兩個檔：
   - **Production**: `src/ui/posts/PostsPageScreen.jsx` line 82 feed wrapper：

     ```jsx
     // 改前
     <div className={styles.feed}>
     // 改後
     <div className={styles.feed} data-testid="post-feed">
     ```

     - 只加 `data-testid="post-feed"`，**不**改 className / 其他屬性 / 子元素
     - 這是 plan §5 修法 C（minimal data-testid，與 §2.32 unreadDot / §2.44 sentinel 同 pattern）

   - **Test**: `tests/integration/posts/PostFeed.test.jsx` line 211–226 it block (`wraps the feed in a container with the "feed" CSS class for max-width`)：

     ```jsx
     // 改前（line 214–225）
     const { baseElement } = render(
       <AuthWrapper>
         <PostPage />
       </AuthWrapper>,
     );
     await waitFor(() => {
       expect(mockedGetLatestPosts).toHaveBeenCalled();
     });

     // feed wrapper 是 layout-only div，沒語意 role，僅能透過 class 驗證
     const feedContainer = baseElement.querySelector('[class*="feed"]');
     expect(feedContainer).toBeInTheDocument();

     // 改後
     render(
       <AuthWrapper>
         <PostPage />
       </AuthWrapper>,
     );
     await waitFor(() => {
       expect(mockedGetLatestPosts).toHaveBeenCalled();
     });

     // feed wrapper 是 layout-only div，沒語意 role；加 data-testid 後直接 query；保留 className 驗證原意圖
     const feedContainer = screen.getByTestId('post-feed');
     expect(feedContainer).toBeInTheDocument();
     expect(feedContainer.className).toMatch(/feed/);
     ```

     - 移除 `const { baseElement } = render(...)` 解構（§2.34 / §2.56）
     - 保留 `className` 驗證原意圖（驗 layout class 含 'feed' substring）— `.className` 是 Element property、非 navigation API（§2.43）
     - 不改 it block 名稱、不改 `mockedGetLatestPosts` waitFor、不改 `AuthWrapper` 用法
     - 不改其他 it block / mock / fixture / import

3. 跑：
   ```bash
   npx eslint src/ui/posts/PostsPageScreen.jsx tests/integration/posts/PostFeed.test.jsx --format stylish
   npx vitest run tests/integration/posts/PostFeed.test.jsx
   ```
   兩者皆需 exit 0；vitest 該檔全 PASS（含未動的其他 it block）。
4. 不 git add / commit / push。

**禁止行為**：

- 不改 `<div className={styles.feed}>` 的其他屬性 / 子元素
- 不改 `PostsPageScreen.jsx` 其他 element / structure / JSDoc
- 不改 test 檔其他 it block / mock / import 排序
- 不在 ignores 加路徑（不需要）
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 PostDetail.test.jsx / PostCard.jsx / 其他 domain

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動兩檔：`src/ui/posts/PostsPageScreen.jsx`（加 `data-testid` 一行屬性）+ `tests/integration/posts/PostFeed.test.jsx`（一個 it block）
2. `PostsPageScreen.jsx` line 82 維持 `className={styles.feed}`，多了 `data-testid="post-feed"`
3. Test 檔該 it block：用 `screen.getByTestId('post-feed')`、移除 `baseElement` 解構、保留 `className.toMatch(/feed/)` 驗證
4. `npx eslint src/ui/posts/PostsPageScreen.jsx tests/integration/posts/PostFeed.test.jsx` exit 0；該 test 檔 `testing-library/no-node-access` = 0
5. `npx vitest run tests/integration/posts/PostFeed.test.jsx` 全 PASS（測試件數不變）
6. **沒有**動 PostDetail.test.jsx / RunsRouteMap.test.jsx / crud-toast.test.jsx / toast-container.test.jsx / 其他 src

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/ui/posts/PostsPageScreen.jsx tests/integration/posts/PostFeed.test.jsx
rg -n 'data-testid|className=\{styles\.feed\}' src/ui/posts/PostsPageScreen.jsx
rg -n 'baseElement|getByTestId|post-feed|className' tests/integration/posts/PostFeed.test.jsx
npx eslint src/ui/posts/PostsPageScreen.jsx tests/integration/posts/PostFeed.test.jsx --format stylish 2>&1 | tee /tmp/s8-t43-review.txt
rg -n "testing-library/no-node-access" /tmp/s8-t43-review.txt
npx vitest run tests/integration/posts/PostFeed.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access`（query 寫錯 / 解構未移除）→ 重派 Engineer 修
- Vitest fail（feed wrapper 沒拿到，或 className 不含 'feed'）→ 確認 `styles.feed` CSS module hash 是否仍含 'feed' substring；若失效，回報 main agent
- Diff 動到非 PostFeed 範圍 → 重派 Engineer 限縮（revert 越界改動）
- 若 Engineer escalate「想用 `<main>` 或 `role`」→ main agent 拒絕（layout.jsx 已有 main；§2.51）

---

### T44：PostCard like button aria-label + PostDetail.test cleanup（Wave 1 並行 with T43）

**前置**：T42 PASS。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 改兩個檔：
   - **Production**: `src/components/PostCard.jsx` line 315–318 like button：

     ```jsx
     // 改前
     <button type="button" className={likeClassName} onClick={() => onLike?.(post.id)}>
       <HeartIcon filled={post.liked} />
       <span className={styles.metaCount}>{post.likesCount}</span>
     </button>

     // 改後
     <button
       type="button"
       className={likeClassName}
       onClick={() => onLike?.(post.id)}
       aria-label="按讚"
       aria-pressed={post.liked}
     >
       <HeartIcon filled={post.liked} />
       <span className={styles.metaCount}>{post.likesCount}</span>
     </button>
     ```

     - 加 `aria-label="按讚"` + `aria-pressed={post.liked}`（toggle button pattern）；**不**改 className / onClick / 子元素
     - 這是 plan §5 修法 A（a11y improvement，與 PostCard 既有 menu button line 172 `aria-label="更多選項"` pattern 一致）
     - **取捨記錄**：accessible name = `按讚`（aria-label override visible count "5"）；視覺用戶仍看得到 count，screen reader 用戶聽到 "按讚 toggle (pressed/not pressed)"；若 reviewer 要求保留 count 給 a11y 用戶 → escalate（不自行加 count regex）

   - **Test**: `tests/integration/posts/PostDetail.test.jsx` line 180–191 it block (`按讚按鈕可點擊`)：

     ```jsx
     // 改前（line 180–191）
     it('按讚按鈕可點擊', async () => {
       const user = userEvent.setup();
       render(<PostDetailClient postId="post-1" />);
       await screen.findByText('晨跑日記');
       const likeButtons = screen.getAllByRole('button');
       const likeButton = likeButtons.find(
         (btn) => btn.querySelector('svg') && btn.textContent.includes('5'),
       );
       expect(likeButton).toBeDefined();
       await user.click(likeButton);
       expect(toggleLikePost).toHaveBeenCalledWith('post-1', 'user-1');
     });

     // 改後
     it('按讚按鈕可點擊', async () => {
       const user = userEvent.setup();
       render(<PostDetailClient postId="post-1" />);
       await screen.findByText('晨跑日記');
       const likeButton = screen.getByRole('button', { name: '按讚' });
       await user.click(likeButton);
       expect(toggleLikePost).toHaveBeenCalledWith('post-1', 'user-1');
     });
     ```

     - 用 `screen.getByRole('button', { name: '按讚' })`（accessible name = aria-label）
     - 移除 `screen.getAllByRole('button')` + `find()` + `btn.querySelector('svg')` + `btn.textContent.includes('5')` 整段
     - 不改其他 it block / mock / fixture / `mockPost` 的 `likesCount: 5`

3. 跑：
   ```bash
   npx eslint src/components/PostCard.jsx tests/integration/posts/PostDetail.test.jsx --format stylish
   npx vitest run tests/integration/posts/PostDetail.test.jsx tests/integration/posts/PostCard.test.jsx
   ```
   兩者皆需 exit 0；vitest 兩檔皆全 PASS（PostCard.test.jsx 也跑因為動 PostCard.jsx 可能影響）。
4. 不 git add / commit / push。

**禁止行為**：

- 不改 `PostCard.jsx` 其他 button / element / structure / JSDoc
- 不改 `aria-label` 為其他文字（如「按讚 5 次」）— escalation only（§2.50）
- 不改 PostDetail.test 其他 it block / mock / fixture
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 PostFeed.test.jsx / RunsRouteMap.test.jsx / 其他 domain

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動兩檔：`src/components/PostCard.jsx`（line 315–318 like button 加 2 屬性）+ `tests/integration/posts/PostDetail.test.jsx`（一個 it block）
2. `PostCard.jsx` like button 維持 `type="button"` / `className` / `onClick`，多了 `aria-label="按讚"` + `aria-pressed={post.liked}`
3. Test 檔該 it block：用 `screen.getByRole('button', { name: '按讚' })`，移除 `getAllByRole('button')` + `find` + `querySelector('svg')` + `textContent.includes('5')`
4. `npx eslint src/components/PostCard.jsx tests/integration/posts/PostDetail.test.jsx` exit 0；該 test 檔 `testing-library/no-node-access` = 0
5. `npx vitest run tests/integration/posts/PostDetail.test.jsx` 全 PASS（測試件數不變）
6. `npx vitest run tests/integration/posts/PostCard.test.jsx` 全 PASS（PostCard.jsx 動了，回歸驗證）
7. **沒有**動 PostFeed.test.jsx / 其他

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/components/PostCard.jsx tests/integration/posts/PostDetail.test.jsx
rg -n 'aria-label="按讚"|aria-pressed=' src/components/PostCard.jsx
rg -n 'getAllByRole|getByRole|querySelector|textContent\.includes' tests/integration/posts/PostDetail.test.jsx
npx eslint src/components/PostCard.jsx tests/integration/posts/PostDetail.test.jsx --format stylish 2>&1 | tee /tmp/s8-t44-review.txt
rg -n "testing-library/no-node-access" /tmp/s8-t44-review.txt
npx vitest run tests/integration/posts/PostDetail.test.jsx tests/integration/posts/PostCard.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → 重派 Engineer 修
- Vitest PostDetail fail（`getByRole('button', { name: '按讚' })` 找不到）→ 確認 PostCard.jsx aria-label 是否實際 render（mock 結構問題？）
- Vitest PostCard.test.jsx 回歸 fail → 主 agent 看回歸點是否來自 aria-label 或 aria-pressed；若 PostCard.test.jsx 既有 query 抓 like button 用其他方式（例如 textContent），可能要同步調整 PostCard.test.jsx — escalation
- Diff 動到非 PostCard like button 範圍 → 重派 Engineer 限縮
- Engineer escalate「保留 count 給 a11y」→ main agent 與用戶討論：(a) 用 `aria-label={\`按讚（${post.likesCount} 個讚）\`}`；(b) 保留 simple `aria-label="按讚"`（推薦）

---

### T45：RunsRouteMap container/firstChild cleanup — pure test（Wave 2 並行 with T46）

**前置**：T42 PASS（T43 / T44 不必先完成；T45 改檔不重疊）。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 只改 `tests/integration/strava/RunsRouteMap.test.jsx` 兩個 null-render it block：
   - **Line 54–60** (`renders nothing meaningful when summaryPolyline is null`)：

     ```jsx
     // 改前
     it('renders nothing meaningful when summaryPolyline is null', () => {
       mockedDecode.mockReturnValue([]);

       const { container } = render(<RunsRouteMapInner summaryPolyline={null} />);

       expect(container.firstChild).toBeNull();
       expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
     });

     // 改後
     it('renders nothing meaningful when summaryPolyline is null', () => {
       mockedDecode.mockReturnValue([]);

       render(<RunsRouteMapInner summaryPolyline={null} />);

       expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
       expect(screen.queryByTestId('polyline')).not.toBeInTheDocument();
     });
     ```

   - **Line 63–69** (`renders nothing meaningful when summaryPolyline is empty string`)：同 pattern：

     ```jsx
     // 改前
     it('renders nothing meaningful when summaryPolyline is empty string', () => {
       mockedDecode.mockReturnValue([]);

       const { container } = render(<RunsRouteMapInner summaryPolyline="" />);

       expect(container.firstChild).toBeNull();
       expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
     });

     // 改後
     it('renders nothing meaningful when summaryPolyline is empty string', () => {
       mockedDecode.mockReturnValue([]);

       render(<RunsRouteMapInner summaryPolyline="" />);

       expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
       expect(screen.queryByTestId('polyline')).not.toBeInTheDocument();
     });
     ```

   - **修法理由**（§2.52）：`RunsRouteMapInner` 在 coords 為空時 `return null`（src line 36–38）→ DOM 樹完全沒有 map-container 也沒有 polyline。原本的 `container.firstChild === null` 與 `queryByTestId('map-container') === null` 等價。新版用 `queryByTestId('map-container')` + `queryByTestId('polyline')` 兩個負面斷言補回原來「子樹完全空」的強度。
   - **不可改用 `expect(container).toBeEmptyDOMElement()`** — 仍踩 `no-container` rule（v7 plugin 仍會抓解構）。
   - 不改其他 it block（line 37–52 兩個 positive case 不動）；不改 import / mock / fixtures。

3. 跑：
   ```bash
   npx eslint tests/integration/strava/RunsRouteMap.test.jsx --format stylish
   npx vitest run tests/integration/strava/RunsRouteMap.test.jsx
   ```
4. 不 git add / commit / push。

**禁止行為**：

- 不改 `src/components/RunsRouteMapInner.jsx`（component 已有 early return null；不需動）
- 不改其他 it block（positive case）
- 不用 `toBeEmptyDOMElement()` / `container.children` / 任何 navigation API
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 PostFeed.test.jsx / PostDetail.test.jsx / crud-toast.test.jsx / toast-container.test.jsx

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動 `tests/integration/strava/RunsRouteMap.test.jsx`（兩個 null-render it block）
2. 兩個 it block：移除 `const { container } = render(...)` 解構、移除 `expect(container.firstChild).toBeNull()` 行、補 `expect(screen.queryByTestId('polyline')).not.toBeInTheDocument()` 斷言
3. 兩個 it block：保留 `expect(screen.queryByTestId('map-container')).not.toBeInTheDocument()` 斷言
4. 沒有 `container.X` / `baseElement.X` / `document.queryX` / 任何 DOM navigation API
5. `npx eslint tests/integration/strava/RunsRouteMap.test.jsx` exit 0；`testing-library/no-node-access` = 0；`testing-library/no-container` = 0
6. `npx vitest run tests/integration/strava/RunsRouteMap.test.jsx` 全 PASS（測試件數不變，4 個 it 全綠）

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff tests/integration/strava/RunsRouteMap.test.jsx
rg -n 'container|baseElement|firstChild|queryByTestId' tests/integration/strava/RunsRouteMap.test.jsx
npx eslint tests/integration/strava/RunsRouteMap.test.jsx --format stylish 2>&1 | tee /tmp/s8-t45-review.txt
rg -n "testing-library/(no-node-access|no-container)" /tmp/s8-t45-review.txt
npx vitest run tests/integration/strava/RunsRouteMap.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` / `no-container` → 重派 Engineer 修
- Vitest fail（`queryByTestId('polyline')` 找不到）→ 確認 `react-leaflet` mock 是否仍 render `data-testid="polyline"`（line 13–15）；若 mock 結構不變，可能是 component 在 empty case 仍 render 空 wrapper → escalate
- 動 `RunsRouteMapInner.jsx` → Reviewer FAIL，重派 Engineer revert
- Diff 動到非 null-render it block → 重派 Engineer 限縮

---

### T46：crud-toast EventCreateForm aria-labelledby + cleanup（Wave 2 並行 with T45）

**前置**：T42 PASS。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 改兩個檔：
   - **Production**: `src/ui/events/EventCreateForm.jsx` line 72 + 76：

     ```jsx
     // 改前（line 72）
     <form className={styles.googleFormCard} onSubmit={onSubmit}>

     // 改後（line 72）
     <form
       className={styles.googleFormCard}
       aria-labelledby="event-create-form-title"
       onSubmit={onSubmit}
     >

     // 改前（line 76）
     <h2>揪團表單</h2>

     // 改後（line 76）
     <h2 id="event-create-form-title">揪團表單</h2>
     ```

     - 只加 `aria-labelledby` 到 form + `id` 到 h2；**不**改 className / onSubmit / 其他屬性 / 子元素
     - 修法 A（a11y improvement，§2.53 / §2.54）：form element 有 accessible name → 啟用 implicit role 'form'，可被 `getByRole('form', { name: '揪團表單' })` 抓到
     - **EventEditForm 不需動**：crud-toast.test.jsx line 296 `update event` it block 沒實際 dispatchEvent submit，line 328 `expect(updateEvent).not.toHaveBeenCalled()` 只驗 mock wiring

   - **Test**: `tests/integration/toast/crud-toast.test.jsx` 兩個 it block：
     - **Line 250–272** (`shows success toast after creating an event`)：

       ```jsx
       // 改前（line 264–267）
       // The form should now be open; submit it
       const form = document.querySelector('form');
       expect(form).not.toBeNull();
       form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

       // 改後
       // The form should now be open; submit it（繞 native validation；§2.53）
       const form = screen.getByRole('form', { name: '揪團表單' });
       form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
       ```

     - **Line 274–294** (`shows error toast when creating an event fails`)：同 pattern：

       ```jsx
       // 改前（line 287–289）
       const form = document.querySelector('form');
       expect(form).not.toBeNull();
       form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

       // 改後
       const form = screen.getByRole('form', { name: '揪團表單' });
       form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
       ```

     - 移除 `expect(form).not.toBeNull()` 行（`getByRole` 找不到會 throw，不需要 null check）
     - 保留 `form.dispatchEvent(new Event('submit', ...))` — native DOM API，不踩 `prefer-user-event` 也不踩 `no-node-access`（§2.16 同精神）
     - 不改其他 it block / mock / fixture / `userEvent.setup` / `await user.click(createButton)`

3. 跑：
   ```bash
   npx eslint src/ui/events/EventCreateForm.jsx tests/integration/toast/crud-toast.test.jsx --format stylish
   npx vitest run tests/integration/toast/crud-toast.test.jsx
   ```
4. 不 git add / commit / push。

**禁止行為**：

- 不動 `src/components/EventEditForm.jsx`（不必要；§2.53）
- 不改 EventCreateForm 其他 element / structure / JSDoc / handler 名稱
- 不改 `aria-labelledby` 為 `aria-label`（重用 h2 visible text 是 a11y 最佳實踐）
- 不改 crud-toast.test 其他 it block / mock / fixture / `mockSearchParams` / `mockShowToast`
- 不換 `dispatchEvent` 為 `userEvent.click(submit button)`（會被 native validation 擋；§2.53）
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 toast-container.test.jsx / 其他 domain

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動兩檔：`src/ui/events/EventCreateForm.jsx`（form `aria-labelledby` + h2 `id`）+ `tests/integration/toast/crud-toast.test.jsx`（兩個 create-event it block）
2. `EventCreateForm.jsx` form line 72 維持 `className` / `onSubmit`，多了 `aria-labelledby="event-create-form-title"`；h2 line 76 維持 `揪團表單` 文字，多了 `id="event-create-form-title"`
3. Test 檔兩個 create-event it block：用 `screen.getByRole('form', { name: '揪團表單' })`，移除 `document.querySelector('form')` 與 `expect(form).not.toBeNull()`
4. 兩個 it block 仍用 `form.dispatchEvent(new Event('submit', ...))` 觸發 submit
5. `npx eslint src/ui/events/EventCreateForm.jsx tests/integration/toast/crud-toast.test.jsx` exit 0；該 test 檔 `testing-library/no-node-access` = 0
6. `npx vitest run tests/integration/toast/crud-toast.test.jsx` 全 PASS（測試件數不變）
7. **沒有**動 EventEditForm.jsx / toast-container.test.jsx / RunTogetherPage 等

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/ui/events/EventCreateForm.jsx tests/integration/toast/crud-toast.test.jsx
rg -n 'aria-labelledby|id="event-create-form-title"|揪團表單' src/ui/events/EventCreateForm.jsx
rg -n 'document\.querySelector|getByRole.*form|揪團表單|dispatchEvent' tests/integration/toast/crud-toast.test.jsx
npx eslint src/ui/events/EventCreateForm.jsx tests/integration/toast/crud-toast.test.jsx --format stylish 2>&1 | tee /tmp/s8-t46-review.txt
rg -n "testing-library/(no-node-access|prefer-user-event)" /tmp/s8-t46-review.txt
npx vitest run tests/integration/toast/crud-toast.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → 重派 Engineer 修（特別是其他 it block 還有 `document.querySelector('form')`）
- Vitest fail（`getByRole('form', { name: '揪團表單' })` 找不到）→ 確認 EventCreateForm h2 id 與 form `aria-labelledby` 是否拼字一致；若 collision（多個 form 都 named `揪團表單`）→ escalate
- Vitest fail（form.dispatchEvent 沒觸發 React onSubmit）→ 確認 EventCreateForm wrap 在 RunTogetherPage 後是否只 render 一次（mock 順序問題）
- 動 `EventEditForm.jsx` → Reviewer FAIL，重派 Engineer revert
- Diff 動到非 EventCreateForm + crud-toast.test 兩個 it block → 重派 Engineer 限縮

---

### T47：ToastContainer role + aria-label + cleanup（Wave 3 獨占）

**前置**：T42 PASS（T43–T46 不必先完成；T47 改檔不重疊但獨占以保持 dirty 控管簡單）。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 改兩個檔：
   - **Production**: `src/components/ToastContainer.jsx` line 17–22 outer wrapper：

     ```jsx
     // 改前（line 17–22）
     return (
       <div className={styles.container} aria-live="polite" aria-relevant="additions removals">
         {toasts.map((toast) => (
           <Toast key={toast.id} toast={toast} onClose={removeToast} />
         ))}
       </div>
     );

     // 改後
     return (
       <div
         className={styles.container}
         role="region"
         aria-label="通知列表"
         aria-live="polite"
         aria-relevant="additions removals"
       >
         {toasts.map((toast) => (
           <Toast key={toast.id} toast={toast} onClose={removeToast} />
         ))}
       </div>
     );
     ```

     - 加 `role="region"` + `aria-label="通知列表"`（landmark，§2.55）；保留既有 `aria-live="polite"` + `aria-relevant`
     - **不採 `role="status"`**：individual `<Toast>` 也用 `role="status"`（mock line 15），會 collide multi-status query
     - 不改 className / Toast iteration / props 傳遞

   - **Test**: `tests/integration/toast/toast-container.test.jsx` line 60–67 it block (`has aria-live="polite" on the container`)：

     ```jsx
     // 改前（line 60–67）
     it('has aria-live="polite" on the container', () => {
       mockUseToast.mockReturnValue({ toasts: mockToasts, removeToast });

       render(<ToastContainer />);

       const container = screen.getByTestId('toast-id-1').parentElement;
       expect(container).toHaveAttribute('aria-live', 'polite');
     });

     // 改後
     it('has aria-live="polite" on the container', () => {
       mockUseToast.mockReturnValue({ toasts: mockToasts, removeToast });

       render(<ToastContainer />);

       const container = screen.getByRole('region', { name: '通知列表' });
       expect(container).toHaveAttribute('aria-live', 'polite');
     });
     ```

     - 用 `screen.getByRole('region', { name: '通知列表' })` 直接拿 container（無需 `parentElement` navigation）
     - 保留 `expect(container).toHaveAttribute('aria-live', 'polite')` 斷言（保留測試本意）
     - 不改其他 it block / mock / fixture / `mockToasts` / `mockUseToast.mockReturnValue`

3. 跑：
   ```bash
   npx eslint src/components/ToastContainer.jsx tests/integration/toast/toast-container.test.jsx --format stylish
   npx vitest run tests/integration/toast/toast-container.test.jsx
   ```
4. 不 git add / commit / push。

**禁止行為**：

- 不改 `ToastContainer.jsx` 其他 element / structure / Toast iteration / JSDoc
- 不刪 `aria-live="polite"` / `aria-relevant`（保留 — 不 redundant，因 `role="region"` 不 implicitly aria-live）
- 不改 `role="region"` 為其他 role（特別是不採 `status`，§2.55）
- 不改 toast-container.test 其他 it block / mock / fixture
- 不關 ESLint rule
- 不 git add / commit / push
- 不動 crud-toast.test.jsx / 其他 domain

**Acceptance Criteria（Reviewer 必驗）**：

1. Diff 只動兩檔：`src/components/ToastContainer.jsx`（outer wrapper 加 2 屬性）+ `tests/integration/toast/toast-container.test.jsx`（一個 it block）
2. `ToastContainer.jsx` outer `<div>` 維持 `className` / `aria-live="polite"` / `aria-relevant`，多了 `role="region"` + `aria-label="通知列表"`
3. Test 檔該 it block：用 `screen.getByRole('region', { name: '通知列表' })`，移除 `screen.getByTestId('toast-id-1').parentElement`
4. 仍有 `expect(container).toHaveAttribute('aria-live', 'polite')` 斷言（保留測試本意）
5. `npx eslint src/components/ToastContainer.jsx tests/integration/toast/toast-container.test.jsx` exit 0；該 test 檔 `testing-library/no-node-access` = 0
6. `npx vitest run tests/integration/toast/toast-container.test.jsx` 全 PASS（測試件數不變，4 個 it 全綠）
7. **沒有**動 crud-toast.test.jsx / Toast.jsx / 其他 domain

**Reviewer 驗收指令**：

```bash
git diff --name-only
git diff src/components/ToastContainer.jsx tests/integration/toast/toast-container.test.jsx
rg -n 'role="region"|aria-label="通知列表"|aria-live' src/components/ToastContainer.jsx
rg -n 'parentElement|getByRole.*region|通知列表' tests/integration/toast/toast-container.test.jsx
npx eslint src/components/ToastContainer.jsx tests/integration/toast/toast-container.test.jsx --format stylish 2>&1 | tee /tmp/s8-t47-review.txt
rg -n "testing-library/no-node-access" /tmp/s8-t47-review.txt
npx vitest run tests/integration/toast/toast-container.test.jsx
```

**Failure recovery**：

- 仍有 `no-node-access` → 重派 Engineer 修
- Vitest fail（`getByRole('region', { name: '通知列表' })` 找不到）→ 確認 ToastContainer.jsx 是否實際 render 該 outer wrapper（toasts.length === 0 時 return null，line 15）；fixture 有 `mockToasts` 三筆，應 render
- Engineer 自作主張改 `role="status"` → Reviewer FAIL，重派 Engineer 改回 `region`（§2.55）
- 動 individual `Toast` mock / Toast.jsx → Reviewer FAIL，重派 Engineer revert
- Diff 動到非 ToastContainer 1 it block 範圍 → 重派 Engineer 限縮

---

### T48：Session 8 closeout + handoff update（獨占）

**前置**：T43–T47 reviewer 全 PASS。

**Engineer prompt 要點**：

1. cd 到 worktree 根。
2. 確認 working tree：
   ```bash
   git status --short
   git diff --name-only
   ```
   預期 dirty：`eslint.config.mjs`（commit bridge 後恢復 `error` 留下）+ T43/T44/T46/T47 動的 4 個 production component + T43/T44/T45/T46/T47 動的 5 個 test 檔 + `specs/024-eslint-testing-lib-cleanup/handoff.md`（T48 本次更新）。預估 **11 個 dirty 檔**（§2.48 同精神）。
3. 跑 fresh verifications（**先驗 S8 target 全綠，再驗 repo-wide exit 0**）：

   ```bash
   # S8 target 全綠
   npx eslint tests/integration/posts/ tests/integration/toast/ tests/integration/strava/ --format stylish

   # S5/S6/S7 邊界仍 0 errors
   npx eslint tests/integration/notifications/ tests/integration/navbar/ tests/integration/profile/ tests/integration/weather/

   # ESLint config 仍 error
   rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs

   # ⭐ Repo-wide 全綠（首次達成 exit 0；§2.57）
   npx eslint src specs tests > /tmp/s8-t48-repo-wide.txt 2>&1
   echo "exit=$?"
   rg -c "testing-library/no-node-access" /tmp/s8-t48-repo-wide.txt

   # 全 vitest browser 跑一次（5 個動到的 test 檔 + 動到 src 的回歸）
   npx vitest run tests/integration/posts/PostFeed.test.jsx tests/integration/posts/PostDetail.test.jsx tests/integration/posts/PostCard.test.jsx tests/integration/strava/RunsRouteMap.test.jsx tests/integration/toast/crud-toast.test.jsx tests/integration/toast/toast-container.test.jsx
   ```

4. 更新 `specs/024-eslint-testing-lib-cleanup/handoff.md`：
   - **§0 入門 30 秒**：Session 8 完成；**Phase 4 全清；repo-wide `npx eslint src specs tests` exit 0 首次達成**；下一 session 接 Phase 5（plan §5 Phase 5 — Task 5.1 ESLint 0 violation ✅、Task 5.2 vitest 全綠、Task 5.3 type-check、Task 5.4 pre-commit gate full run、Task 5.5 push & PR、Task 5.6 post-merge worktree 同步 SOP）。Repo lint state 改寫 0 violation。
   - **§2 坑清單**：append S8 實際踩坑（如：PostCard aria-label override accessible name；CSS module hash 對 `.feed` substring；EventCreateForm aria-labelledby 順序；ToastContainer role 與 individual Toast `role="status"` collision；其他 surprise）。坑編號從 §2.49 後續編。
   - **§4 Session 完成紀錄**：新增 `Session 8（posts + toast + strava）— 完成` 段，記錄：
     - T42–T48 各 task 結果（raw / unique 收斂數字、Reviewer PASS evidence）
     - 5 個 target 檔 ESLint exit code、vitest pass 件數
     - 動到的 production component（4 個：PostsPageScreen、PostCard、EventCreateForm、ToastContainer）
     - posts + toast + strava domain `no-node-access` 全清確認
     - **Repo-wide exit 0 首次達成**（記錄具體 violation count = 0）
     - Phase 5 開工建議（commit / push 策略、PR description draft）
   - **§5 下個 session 開工 checklist**：改成 Phase 5 checklist：scope = repo-wide verification + PR；plan §5 Phase 5 Task 5.1–5.6。
5. 不 git add / commit / push。

**禁止行為**：

- 不改 `eslint.config.mjs` / `src/**` / `tests/**`（T43–T47 已完成；T48 不再動 production / test；commit bridge 由主 agent 處理）
- 不為了 repo-wide lint exit 0 去修任何剩餘 rule（如果有非 `no-node-access` 殘留，escalate）
- 不加 eslint disable / 關 rule / 加 broad ignores glob
- 不 git add / commit / push

**Acceptance Criteria（Reviewer 必驗）**：

1. `npx eslint tests/integration/posts/ tests/integration/toast/ tests/integration/strava/` exit 0
2. `npx eslint tests/integration/notifications/ tests/integration/navbar/ tests/integration/profile/ tests/integration/weather/` exit 0（S5–S7 不退）
3. `eslint.config.mjs` line 399/400 仍是 `prefer-user-event: error` / `no-node-access: error`
4. ⭐ `npx eslint src specs tests` exit 0（首次 repo-wide 全綠；§2.57）；`testing-library/no-node-access` count = 0；任何殘留必為非 testing-library rule
5. `npx vitest run` 5 個 target test 檔 + PostCard.test.jsx 全 PASS（測試件數記錄到 handoff）
6. `handoff.md` §0 / §2 / §4 / §5 已按上述要求更新；§4 Session 8 段含 raw / unique / PASS evidence + repo-wide exit 0 milestone
7. Working tree 未 staged、未 commit、未 push

**Reviewer 驗收指令**：

```bash
npx eslint tests/integration/posts/ tests/integration/toast/ tests/integration/strava/ --format stylish
npx eslint tests/integration/notifications/ tests/integration/navbar/ tests/integration/profile/ tests/integration/weather/ --format stylish
rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs
npx eslint src specs tests > /tmp/s8-t48-review-repo-wide.txt 2>&1 || true
echo "exit=$?"
rg -c "testing-library/no-node-access" /tmp/s8-t48-review-repo-wide.txt
npx vitest run tests/integration/posts/PostFeed.test.jsx tests/integration/posts/PostDetail.test.jsx tests/integration/posts/PostCard.test.jsx tests/integration/strava/RunsRouteMap.test.jsx tests/integration/toast/crud-toast.test.jsx tests/integration/toast/toast-container.test.jsx
sed -n '/^## 0\./,/^## 1\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/Session 8/,/^## 5\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
sed -n '/^## 5\./,/^## 6\./p' specs/024-eslint-testing-lib-cleanup/handoff.md
git status --short
git diff --name-only
```

**Failure recovery**：

- S8 target lint 仍 fail → Reviewer 回報 rule + line:col；主 agent 重派對應 T43/T44/T45/T46/T47 Engineer
- Vitest fail → 回報 failing command / test；重派對應 Engineer
- S5/S6/S7 邊界 regression → 嚴重，主 agent 立刻停 closeout、用 git diff 找哪 task 的改動越界，重派該 Engineer revert + redo
- Repo-wide lint 殘留 `no-node-access` → 主 agent 找出殘留檔，重派對應 task Engineer 修
- Repo-wide lint 殘留非 `no-node-access` rule → escalation：主 agent 與用戶討論是否本 PR 處理，可能延後到 Phase 5
- handoff 寫成 Phase 5 已執行 / repo-wide 沒驗 / Session 8 漏記 evidence → 重派 T48 Engineer 修文件
- 發現 `eslint.config.mjs` rule level 被 task Engineer 改 → Reviewer FAIL；主 agent 不自行修，重派該 task Engineer revert

---

## Session 8 結束狀態（DOD）

- `testing-library/no-node-access`: 維持 `error`（line 400）
- `testing-library/prefer-user-event`: 維持 `error`（line 399）
- `tests/integration/posts/PostFeed.test.jsx`: 0 `testing-library/no-node-access` errors
- `tests/integration/posts/PostDetail.test.jsx`: 0 `testing-library/no-node-access` errors
- `tests/integration/strava/RunsRouteMap.test.jsx`: 0 `testing-library/no-node-access` errors
- `tests/integration/toast/crud-toast.test.jsx`: 0 `testing-library/no-node-access` errors
- `tests/integration/toast/toast-container.test.jsx`: 0 `testing-library/no-node-access` errors
- 必要 component affordance：`src/ui/posts/PostsPageScreen.jsx`（feed wrapper testid）+ `src/components/PostCard.jsx`（like button aria-label / aria-pressed）+ `src/ui/events/EventCreateForm.jsx`（form aria-labelledby + h2 id）+ `src/components/ToastContainer.jsx`（role region + aria-label）
- ⭐ **Repo-wide `npx eslint src specs tests` exit 0**（首次達成）
- 整個 posts + toast + strava domain `no-node-access` 全清；S5/S6/S7 不退
- `eslint.config.mjs` `ignores` array 維持 3 entries（不加新 helper、不加 broad glob）
- `handoff.md` 記錄 Session 8 evidence + Phase 5 開工 checklist
- 不 commit、不 stage、不 push（commit 由主 agent 在規劃 commit / 收尾 commit 統一處理）

---

## 主 agent 派遣 SOP（給未來 session 參考）

```text
0. 主 agent 自行 commit bridge：暫關 'testing-library/no-node-access' error → off，commit 規劃文件，立刻恢復 error
1. 派 T42 Explore（read-only）→ 主 agent 直接驗收（不另派 reviewer）
2. Wave 1 並行：T43 Engineer + T44 Engineer 同時派；各自寫完回報後，並行派 T43 Reviewer + T44 Reviewer
3. Wave 1 PASS 後，Wave 2 並行：T45 Engineer + T46 Engineer；同上接 reviewer
4. Wave 2 PASS 後，Wave 3：T47 Engineer 獨佔，PASS 後派 T47 Reviewer
5. T43–T47 全 PASS 後，T48 closeout + handoff update（獨占）；T48 也派 Reviewer 驗收
6. 全綠 → main agent 在規劃 commit 之外不自行 commit；下個 session 接手時 working tree 仍 dirty（除主 agent 規劃 commit 帶走的部分）
7. 任一 reviewer FAIL → 重派該 task Engineer 修；不主 agent 自己改檔
```

> 主 agent **不**自己跑 `npx eslint ... --fix`、不自己改 test / component / config（除 commit bridge 一行）。所有有副作用的指令都派 subagent 跑。
