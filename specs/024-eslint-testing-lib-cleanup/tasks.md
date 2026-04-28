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
