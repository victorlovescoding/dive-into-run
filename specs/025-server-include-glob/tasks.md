# 025 — Server Include Glob + Smoke Test 驗證

> **Source**: `project-health/2026-04-29-tests-audit-report.md` §2 P0-3
> **Goal**: 30 min — 改 1 行 vitest config + smoke 驗 cardinality + 刪 smoke
> **執行模式**：所有任務一律由 subagent 執行；主 agent 只做派遣、彙整、驗收回饋
> **Branch**：`025-server-include-glob`（worktree：`/Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob`）
> **用戶決議（2026-04-29）**：smoke test 驗完即刪；reviewer 退回上限 3 輪

## Parallelism — 同時最多開 1 個 subagent

| 階段                       | 並行度   | 原因                                                                                                                   |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Engineer 執行              | **1**    | T1→T2→T3→T4 嚴格 sequential：T2 需要 T1 改完 glob 才能驗 cardinality；T3 需要 T2 確認 3 支才知道刪了會回 2；T4 需要 T3 |
| Reviewer 驗收              | **1**    | Reviewer 須對 Engineer 完成的 working tree 跑指令；同時跑會 race                                                       |
| Engineer + Reviewer 同時跑 | **不行** | 同一檔同時讀寫會撞                                                                                                     |
| **退回上限**               | **3 輪** | 同一 task 第 3 次 reviewer 仍 fail → 升級回主 agent + AskUserQuestion                                                  |

**總 subagent 數估算**：

- First-pass 全綠：4 task × 2 (engineer + reviewer) = 8 次 Agent 呼叫
- 典型有 1 次修正：10 次
- 悲觀（T2 cspell + T4 lint 各退一輪）：12 次

## 依賴 Graph

```
T1 (改 vitest.config.mjs:63 glob)
  │ unblocks
  ▼
T2 (建 dummy smoke + 驗 cardinality 2→3)   ← 核心驗收訊號
  │ unblocks
  ▼
T3 (刪 dummy smoke + 驗 cardinality 回 2)
  │ unblocks
  ▼
T4 (full pre-commit gate：lint + type-check + spellcheck + vitest)
```

T1 同時 unblock 報告 §2 P0-2（rules unit test 骨架），但 P0-2 不在本 spec 範圍。

---

## T1 — 改 `vitest.config.mjs:63` glob

### Engineer prompt 要點

- cd 到 worktree：`/Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob`
- 用 Edit tool 把 `vitest.config.mjs` 第 63 行：
  - 舊：`          include: ['tests/server/g8-server-coverage/**/*.test.js'],`
  - 新：`          include: ['tests/server/**/*.test.js'],`
- 不動其他行（不動 exclude / setupFiles / fileParallelism / 任何欄位）
- 不要 commit
- 完成後回報 `git diff vitest.config.mjs` 的完整輸出

### Acceptance Criteria（Reviewer 必驗）

1. `grep -n "tests/server" vitest.config.mjs` 第 63 行附近顯示 `'tests/server/**/*.test.js'`
2. `vitest.config.mjs` 內 include 欄位**不再含** `g8-server-coverage` 字串
3. `git diff --stat vitest.config.mjs` 顯示 `1 file changed, 1 insertion(+), 1 deletion(-)`
4. `git diff vitest.config.mjs` 只有 1 行 `-` / 1 行 `+`，且就是 line 63
5. `git status --short` 只顯示 `M vitest.config.mjs`（無其他檔案被改）
6. `npm run test:server` exit 0，輸出含 `Tests  2 passed (2)` ——確認沒打破現狀

### Reviewer 驗收指令

```bash
cd /Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob
grep -n "tests/server" vitest.config.mjs
grep -n "g8-server-coverage" vitest.config.mjs   # 預期：第 63 行不應出現
git diff --stat vitest.config.mjs
git diff vitest.config.mjs
git status --short
npm run test:server 2>&1 | tail -30
```

### Failure recovery

- grep 顯示舊字串 → Engineer 重做 Edit
- diff > 1+/1- → Engineer 用 Edit 還原偏離行（**禁用** `git checkout --` destructive）
- vitest cardinality ≠ 2 → glob 寫錯（多打/少打 `_/`），Engineer 修正
- **退回 3 輪仍 fail → 升級主 agent**

---

## T2 — 建 dummy smoke test 驗 cardinality 2→3

### Engineer prompt 要點

- 用 Write tool 建立 `/Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob/tests/server/_smoke/sanity.test.js`，內容：

  ```js
  /**
   * @file Smoke test for vitest server include glob.
   *
   * Temporary verification — to be deleted in T3 once cardinality
   * change (2 → 3 → 2) is confirmed. See specs/025-server-include-glob.
   */

  import { describe, it, expect } from 'vitest';

  describe('server include glob smoke', () => {
    it('is collected by tests/server/**/*.test.js', () => {
      expect(1).toBe(1);
    });
  });
  ```

- 不 import 任何 `src/` / `firebase-admin` / emulator-bound 內容
- 檔案 ≤ 30 行
- 跑 `npx eslint tests/server/_smoke/sanity.test.js`，若 fail 修到綠
- 跑 `npx cspell tests/server/_smoke/sanity.test.js`，若 fail **改 `cspell.json` 加詞**（禁用 inline `// cSpell:disable`）
- 跑 `npm run test:server`，確認輸出含 `Tests  3 passed (3)`
- 不要 commit
- 回報：`git status --short`、`wc -l tests/server/_smoke/sanity.test.js`、`npm run test:server` 結尾 30 行

### Acceptance Criteria（Reviewer 必驗）

1. `tests/server/_smoke/sanity.test.js` 存在
2. 檔頭含 JSDoc `@file` block（CLAUDE.md non-negotiable 第 4 條）
3. 無 `import` from `@/...` 或 `src/...`（只能 import `vitest`）
4. `wc -l` ≤ 30 行
5. `npm run test:server` 輸出 **`Tests  3 passed (3)`** —— 核心驗收訊號
6. `npx eslint tests/server/_smoke/sanity.test.js` exit 0
7. `npx cspell tests/server/_smoke/sanity.test.js` exit 0
8. `grep "cSpell:disable" tests/server/_smoke/sanity.test.js` 無輸出
9. `git status --short` 只顯示 T1 既有 `M vitest.config.mjs` + 新 `?? tests/server/_smoke/sanity.test.js`（+ 可能 `M cspell.json`）

### Reviewer 驗收指令

```bash
cd /Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob
test -f tests/server/_smoke/sanity.test.js && echo FILE_OK
head -20 tests/server/_smoke/sanity.test.js
wc -l tests/server/_smoke/sanity.test.js
grep -E "^import" tests/server/_smoke/sanity.test.js
grep "cSpell:disable" tests/server/_smoke/sanity.test.js   # 預期空
npm run test:server 2>&1 | tee /tmp/p03-t2.log | tail -40
grep -E "Test Files|Tests " /tmp/p03-t2.log               # 預期 3 passed (3)
npx eslint tests/server/_smoke/sanity.test.js && echo ESLINT_OK
npx cspell tests/server/_smoke/sanity.test.js && echo CSPELL_OK
git status --short
```

### Failure recovery

- vitest 顯示 2 而非 3 → 命名/路徑錯，必須是 `*.test.js` 且在 `tests/server/**`
- vitest 3 但 1 fail → setup file emulator throw 影響？確認 dummy 沒 import emulator-bound 內容
- cspell fail → Engineer 改 `cspell.json`（**禁用** inline disable）
- eslint fail → 修語法
- **退回 3 輪仍 fail → 升級主 agent**

---

## T3 — 刪 smoke test 驗 cardinality 回 2

### Engineer prompt 要點

- 用 Bash tool 執行：`rm tests/server/_smoke/sanity.test.js && rmdir tests/server/_smoke`
  - **如果** T2 改過 `cspell.json` 加詞且這些詞**只**為了 smoke test 加：用 Edit tool 還原 `cspell.json`（避免遺留無用詞典條目）
  - 若加的詞日後仍可能用到（`smoke` / `sanity` / `regression` 等通用詞），保留進 `cspell.json`
- 跑 `npm run test:server`，確認輸出含 `Tests  2 passed (2)`
- 不要 commit
- 回報：`git status --short`、`ls tests/server/`、`npm run test:server` 結尾 30 行

### Acceptance Criteria（Reviewer 必驗）

1. `tests/server/_smoke/` 目錄不存在
2. `find tests/server -name "*.test.js" -type f | wc -l` 等於 2
3. `npm run test:server` 輸出 **`Tests  2 passed (2)`**
4. `git status --short` 只顯示 `M vitest.config.mjs`（+ 可能 `M cspell.json` 若保留通用詞）
5. **無** `?? tests/server/_smoke/` 殘留

### Reviewer 驗收指令

```bash
cd /Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob
test ! -d tests/server/_smoke && echo CLEAN_OK
find tests/server -name "*.test.js" -type f
find tests/server -name "*.test.js" -type f | wc -l   # 預期 2
npm run test:server 2>&1 | tail -30
git status --short
ls tests/server/
```

### Failure recovery

- `_smoke/` 目錄殘留 → Engineer 補 `rmdir`
- cardinality ≠ 2 → 沒刪乾淨或誤刪 g8 測試
- **退回 3 輪仍 fail → 升級主 agent**

---

## T4 — Full pre-commit gate

### Engineer prompt 要點

- 在 worktree root 依序跑：
  1. `npm run lint` （ESLint，含 testing-library + JSDoc + 6 條 non-negotiable）
  2. `npm run type-check` （tsc --noEmit）
  3. `npm run spellcheck` （cspell src + specs + tests）
  4. `npm run test:browser` + `npm run test:server` 分開跑（package.json:13 的 `npm test` 無 default project，會試跑 server 失敗；改用拆兩個確保兩 project 都綠）
- 任何 fail 修到全綠
- 不 commit
- 回報每個指令的 exit code 和結尾 20 行

### Acceptance Criteria（Reviewer 必驗）

1. `npm run lint` exit 0
2. `npm run type-check` exit 0
3. `npm run spellcheck` exit 0
4. `npm run test:browser` exit 0
5. `npm run test:server` exit 0 且 cardinality = 2
6. `git status --short` 只顯示 `M vitest.config.mjs`（+ 可能 `M cspell.json`）+ `?? specs/025-server-include-glob/tasks.md`（本 tasks.md 自身）
7. `git diff --stat` 預期極簡

### Reviewer 驗收指令

```bash
cd /Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob
npm run lint && echo LINT_OK
npm run type-check && echo TYPE_OK
npm run spellcheck && echo SPELL_OK
npm run test:browser 2>&1 | tail -20
npm run test:server 2>&1 | tail -20
git status --short
git diff --stat
git diff vitest.config.mjs
```

### Failure recovery

- 任何 sensor fail → Engineer 依 fail 訊息修;不放過 warning-as-error
- **退回 3 輪仍 fail → 升級主 agent**

---

## 完工驗證（主 agent read-only）

T4 全綠後主 agent 派最後一個 Reviewer subagent 做收尾彙整：

```bash
cd /Users/chentzuyu/Desktop/dive-into-run-025-server-include-glob

# 1. git diff 預期長相
git diff --stat
# 預期：vitest.config.mjs | 2 +- (+ 可能 cspell.json)

# 2. vitest cardinality
npm run test:server 2>&1 | grep -E "Test Files|Tests "
# 預期：Tests  2 passed (2)

# 3. glob 字串確認
grep -n "tests/server" vitest.config.mjs
# 預期：63:    include: ['tests/server/**/*.test.js'],

grep -n "g8-server-coverage" vitest.config.mjs
# 預期：空（include 欄位無此字串）

# 4. 反向驗證：tests/server/ 目錄狀態
find tests/server -name "*.test.js" -type f
# 預期：只有 g8-server-coverage/unit/ 下的 2 支
```

通過全部 = P0-3 完成，unblock P0-2。

---

## 關鍵檔案清單

| 檔案                                     | 角色                     | 改動                        |
| ---------------------------------------- | ------------------------ | --------------------------- |
| `vitest.config.mjs`                      | server include glob 設定 | line 63：1 字串改寫         |
| `tests/server/_smoke/sanity.test.js`     | T2 暫時建立、T3 刪除     | 新建後刪除（PR diff 為 0）  |
| `cspell.json`                            | spellcheck 詞典          | 視 T2 是否觸發 unknown word |
| `specs/025-server-include-glob/tasks.md` | 本檔                     | 新建（spec 自身）           |
