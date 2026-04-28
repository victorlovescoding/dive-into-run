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
