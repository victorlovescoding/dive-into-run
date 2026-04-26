# Phase 0 Tasks: Quality Gate 整備

> **Spec folder**：`specs/023-tests-directory-migration/`（git tracked）
> **Parent 藍圖**：[`./plan.md`](./plan.md)（同 spec folder，4 階段總藍圖）
> **Plan (user-level)**：`~/.claude/plans/2026-04-26-tests-directory-migration-md-gleaming-flamingo.md`（patch 級實作細節，跨 session 不變）
> **Branch**：`023-tests-directory-migration`（已開 worktree 在 `dive-into-run-023-tests-directory-migration/`，Phase 0 直接在此 branch 動工，不另開 sub-branch）
> **預估工期**：0.5-1 天
> **總任務數**：13（11 engineer + 1 verify + 1 PR）

---

## 並行策略總覽

### 同時最多 3 個 worker agent（配對 3 個 reviewer，瞬時 active 上限 6 agents）

**為何 3 個**：

- 3 個並行檔案編輯不會打架（檔案各自獨立）
- 主 agent context 同時管 3 對 worker-reviewer 配對是合理上限（再多 reviewer 來不及細緻檢查）
- 4 個以上會讓 wave 同步點變多，整體效率反降

### 主 Agent 角色邊界（Non-Negotiable）

主 agent **從頭到尾純粹是 orchestrator**，不做任何實作。

| 動作                                                                      | 主 Agent             | 備註                                   |
| ------------------------------------------------------------------------- | -------------------- | -------------------------------------- |
| `Agent` 派 sub-agents                                                     | ✅                   | 唯一執行手段                           |
| `SendMessage` 給已派出的 agent 追加指令 / 帶 reviewer feedback 重派       | ✅                   | 失敗循環的關鍵工具                     |
| `Read` 純讀檔了解狀態                                                     | ✅                   | 只讀不寫                               |
| `TaskCreate` / `TaskUpdate` 追蹤進度                                      | ✅                   | 不影響 repo                            |
| 與 user 對話、通報進度、escalate                                          | ✅                   |                                        |
| `Edit` / `Write` 動檔                                                     | ❌                   | **絕對禁止** — 派 engineer subagent 做 |
| `Bash` 跑 npm / node / git / mkdir / mv 等 mutate 命令                    | ❌                   | **絕對禁止** — 派 subagent 做          |
| `Bash` 跑純 query 命令（`ls` / `git status` / `cat`，**不修改任何狀態**） | ⚠️ 可，但優先用 Read | 罕用，能不用就不用                     |

**這條規則涵蓋**：

- ✅ 初始 Wave 1-5 的所有任務 → 派 subagent
- ✅ Reviewer FAIL 後的修改循環 → 派同類型 subagent 帶 feedback 重做
- ✅ Wave 4 smoke test → 派 subagent 跑（**不是主 agent 跑**）
- ✅ Step 1 開 branch、Step 7 commit → 派 subagent 跑
- ✅ 失敗回滾命令 → escalate 給 user 親跑（destructive，不派 subagent）

### Engineer / Reviewer 配對機制

```
┌─────────────────────────────────────────────────────┐
│ 主 Agent (orchestrator only)                         │
│ - Agent / SendMessage / Read / TaskCreate            │
│ - 絕不自己 Edit / Write / Bash 動檔                   │
└──────────────┬──────────────────────────────────────┘
               │ 派
       ┌───────┴───────┐
       ▼               ▼
┌─────────────┐  做完 ┌─────────────┐  pass ┌──────┐
│ Engineer    │ ────→│ Reviewer    │ ────→│ DONE │
│ subagent    │      │ subagent    │       └──────┘
│ (general-   │ ←──  │ (Explore,   │
│  purpose)   │ fail │  read-only  │
└─────────────┘      │  + Bash)    │
   ↑                 └─────────────┘
   │ 主 agent 透過 SendMessage 派回去帶 reviewer feedback 修
   └──────────────────────────────────────
```

- **Engineer subagent**：`general-purpose`（Edit / Write / Bash 完整工具）
- **Reviewer subagent**：`Explore`（read-only + Bash，可跑 verify 命令但不能 edit）
- **重試上限**：reviewer 持續 FAIL ≥ 3 次 → 主 agent 立即 stop + escalate 給 user，**不再自己嘗試修**

---

## 依賴圖

```
Wave 1 (3 並行):
  ├─ Agent-A: T001 → T002 → T003 → T004 → T005 → T006  (policy.js 串行)
  ├─ Agent-B: T008                                       (package.json)
  └─ Agent-C: T009                                       (tests/ 空目錄)
                                              │
Wave 2 (T005 done 觸發):                      │
  └─ Agent-D: T007                                       (test-bucket-policy.test.js)
                                              │
Wave 3 (Wave 1 全完 + Wave 2 完):             │
  ├─ Agent-E: T010                                       (testing-standards.md)
  └─ Agent-F: T011                                       (SKILL.md)
                                              │
Wave 4 (Wave 3 完):                           │
  └─ Agent-G: T012                                       (smoke test)
                                              │
Wave 5 (manual):                              │
  └─ User: T013                                          (PR)
```

---

## Wave 1 — 啟動（並行 3 agents）

### T001 [Agent-A 第 1 棒] policy.js Patch A: TEST_BUCKET_FILE_PATTERNS

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（line 11-16）

**Description**：在 `TEST_BUCKET_FILE_PATTERNS` 物件加 4 個新 bucket entry，舊 4 個保持不動。

**Engineer Prompt**:

> 編輯 `specs/021-layered-dependency-architecture/test-buckets/policy.js` line 11-16 的 `TEST_BUCKET_FILE_PATTERNS` 物件。在現有 4 個 entry 後追加 4 個：`'unit-tests-root'`, `'integration-tests-root'`, `'e2e-tests-root'`, `'tests-helpers'`，pattern 改成 `^tests/{unit|integration|e2e}/.+${TEST_FILE_PATTERN}$` 與 `^tests/_helpers/.+${TEST_FILE_PATTERN}$`。完整 patch 見 `~/.claude/plans/2026-04-26-tests-directory-migration-md-gleaming-flamingo.md` Patch A 區塊。

**Acceptance Criteria**:

- [ ] line 11-16 區塊有恰好 8 個 entry
- [ ] 新 entry key 名稱完全等於：`unit-tests-root` / `integration-tests-root` / `e2e-tests-root` / `tests-helpers`
- [ ] 新 entry pattern 用 backtick template literal 含 `${TEST_FILE_PATTERN}`（不可寫死副檔名）
- [ ] 整檔 `Object.freeze` 結構完整、無 syntax error

**Verify Command** (Reviewer 跑):

```bash
node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => {
  const ids = Object.keys(m.testBucketPolicy.bucketMatchers);
  const expected = ['unit','integration','e2e','specs-test-utils','unit-tests-root','integration-tests-root','e2e-tests-root','tests-helpers'];
  if (ids.length !== 8) { console.error('FAIL: expected 8, got', ids.length); process.exit(1); }
  for (const id of expected) if (!ids.includes(id)) { console.error('FAIL: missing', id); process.exit(1); }
  console.log('PASS');
});"
```

**期望**：印出 `PASS`。

---

### T002 [Agent-A 第 2 棒] policy.js Patch B: DEPCRUISE_DENY_PATTERNS

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（line 18-33）

**Description**：在 `DEPCRUISE_DENY_PATTERNS` 物件加 4 個新 entry，分別複製對應舊 bucket 的 deny rules。

**Engineer Prompt**:

> 編輯 policy.js line 18-33 的 `DEPCRUISE_DENY_PATTERNS`。在現有 4 個 entry 後追加 4 個 frozen array：
>
> - `'unit-tests-root'` 複製 `unit` 的 5 條 deny pattern
> - `'integration-tests-root'` 複製 `integration` 的 3 條
> - `'e2e-tests-root'` 與 `'tests-helpers'` 都用 `['^src/']`
>   完整 patch 見 plan 檔 Patch B 區塊。

**Acceptance Criteria**:

- [ ] 4 個新 entry 用 `Object.freeze([...])` 包
- [ ] `unit-tests-root` 的 deny array 與 `unit` 內容完全一致（5 條）
- [ ] `integration-tests-root` 的 deny array 與 `integration` 完全一致（3 條）
- [ ] `e2e-tests-root` 與 `tests-helpers` 都是 `['^src/']`

**Verify Command**:

```bash
node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => {
  // 此時 DEPCRUISE_DENY_PATTERNS 不直接 export，靠 depCruiseTestBucketRules 透出
  const r = m.depCruiseTestBucketRules;
  const newKeys = ['unit-tests-root','integration-tests-root','e2e-tests-root','tests-helpers'];
  for (const k of newKeys) {
    if (!r[k]) { console.error('FAIL: missing', k); process.exit(1); }
  }
  if (JSON.stringify(r['unit-tests-root'].deniedPathPatterns) !== JSON.stringify(r.unit.deniedPathPatterns)) {
    console.error('FAIL: unit-tests-root deny mismatch'); process.exit(1);
  }
  console.log('PASS');
});"
```

**期望**：`PASS`。**注意**：此 verify 只在 T004 完成後才能跑（depCruiseTestBucketRules 才有新 entry）。T002 階段 reviewer 改用 grep:

```bash
grep -A 6 "'unit-tests-root': Object.freeze\(\[" specs/021-layered-dependency-architecture/test-buckets/policy.js | grep -c "src/"
# 期望 ≥ 5
```

---

### T003 [Agent-A 第 3 棒] policy.js Patch C: 提升 ALLOWED_SURFACES 為 module const + TEST_BUCKET_RULES

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（line 122-175 + 新增 module-level const）

**Description**：

1. 在 module 頂部（`TEST_BUCKET_FILE_PATTERNS` 附近）新增兩個 frozen const：
   - `UNIT_ALLOWED_SURFACES`（10 個 surface ID，從現有 `TEST_BUCKET_RULES.unit.allowedSurfaceIds` 提升）
   - `INTEGRATION_ALLOWED_SURFACES`（12 個）
2. 把 `TEST_BUCKET_RULES.unit` / `.integration` 的 `allowedSurfaceIds` 改為引用該 const
3. 在 `TEST_BUCKET_RULES` 後追加 4 個新 entry，引用同一 const

**為何要提升**：避免 self-reference（`TEST_BUCKET_RULES.unit.allowedSurfaceIds` 在物件建構中讀不到）→ Risk R6。

**Engineer Prompt**:

> 詳見 plan 檔 Patch C 區塊。**Critical**：兩個 const 必須在 `TEST_BUCKET_RULES` 之前 declare。新 entry 的 `allowedSurfaceIds` 只能引用 const，不能直接寫 `TEST_BUCKET_RULES.unit.allowedSurfaceIds`。

**Acceptance Criteria**:

- [ ] 檔案頂部新增 `UNIT_ALLOWED_SURFACES` 與 `INTEGRATION_ALLOWED_SURFACES` 兩個 module-level frozen const
- [ ] 兩個 const declare 位置在 `TEST_BUCKET_RULES` 之前
- [ ] 原有 `TEST_BUCKET_RULES.unit.allowedSurfaceIds` 改成引用 `UNIT_ALLOWED_SURFACES`
- [ ] 原有 `TEST_BUCKET_RULES.integration.allowedSurfaceIds` 改成引用 `INTEGRATION_ALLOWED_SURFACES`
- [ ] 新加 4 個 entry 都有 `filePattern` / `description` / `allowedSurfaceIds` / `relativePolicy` 4 個欄位
- [ ] `unit-tests-root` 與 `integration-tests-root` 各自引用對應 const（不複製 array）

**Verify Command**:

```bash
node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => {
  const r = m.testBucketPolicy.buckets;
  // 1. 新 bucket 存在
  if (!r['unit-tests-root'] || !r['integration-tests-root']) { console.error('FAIL'); process.exit(1); }
  // 2. allowedSurfaceIds 共享引用（用 === 確認）
  if (r['unit-tests-root'].allowedSurfaceIds !== r.unit.allowedSurfaceIds) {
    console.error('FAIL: unit-tests-root not sharing UNIT_ALLOWED_SURFACES'); process.exit(1);
  }
  if (r['integration-tests-root'].allowedSurfaceIds !== r.integration.allowedSurfaceIds) {
    console.error('FAIL: integration-tests-root not sharing INTEGRATION_ALLOWED_SURFACES'); process.exit(1);
  }
  console.log('PASS');
});"
```

**期望**：`PASS`。

---

### T004 [Agent-A 第 4 棒] policy.js Patch D: depCruiseTestBucketRules

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（line 222-265）

**Description**：在 `depCruiseTestBucketRules` 物件追加 4 個新 entry，每個含 `sourcePattern` / `allowedKinds` / `allowedPathPatterns` / `deniedPathPatterns`（+ e2e/helpers 加 `relativePolicy`）。

**Engineer Prompt**:

> 詳見 plan 檔 Patch D 區塊。`allowedPathPatterns`：
>
> - `unit-tests-root` 複製 `unit` 的 6 條
> - `integration-tests-root` 複製 `integration` 的 8 條
> - `e2e-tests-root` 與 `tests-helpers` 都用 `Object.freeze([])`
>
> 同樣注意 self-reference issue：可改成提升 `UNIT_ALLOWED_PATH_PATTERNS` / `INTEGRATION_ALLOWED_PATH_PATTERNS` 兩個 module const（或直接 inline 複製）。

**Acceptance Criteria**:

- [ ] 4 個新 entry 完整出現在 `depCruiseTestBucketRules`
- [ ] `e2e-tests-root` 含 `relativePolicy: 'same-feature-e2e-or-shared-helper'`
- [ ] `tests-helpers` 含 `relativePolicy: 'inside-tests-helpers-only'`
- [ ] `sourcePattern` 引用 `TEST_BUCKET_FILE_PATTERNS['<bucket>']`，不重複定義 regex 字串

**Verify Command**:

```bash
node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => {
  const r = m.depCruiseTestBucketRules;
  const newKeys = ['unit-tests-root','integration-tests-root','e2e-tests-root','tests-helpers'];
  for (const k of newKeys) {
    if (!r[k]) { console.error('FAIL: missing', k); process.exit(1); }
    if (!r[k].sourcePattern) { console.error('FAIL: no sourcePattern for', k); process.exit(1); }
  }
  if (r['e2e-tests-root'].relativePolicy !== 'same-feature-e2e-or-shared-helper') {
    console.error('FAIL: e2e-tests-root wrong relativePolicy'); process.exit(1);
  }
  console.log('PASS');
});"
```

**期望**：`PASS`。

---

### T005 [Agent-A 第 5 棒] policy.js Patch E: TEST_BUCKET_DEPCRUISE_ARTIFACTS

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（line 267-308）

**Description**：在 `TEST_BUCKET_DEPCRUISE_ARTIFACTS` array push 4 個新 entry。**最關鍵**：`.dependency-cruiser.mjs:102-143` iterate 的就是這個 array，漏 push → bucket 不啟動。

**Engineer Prompt**:

> 詳見 plan 檔 Patch E 區塊。每個新 entry 結構：
>
> ```js
> Object.freeze({
>   bucket: '<bucket-id>',
>   allow: Object.freeze({
>     kinds: depCruiseTestBucketRules['<bucket-id>'].allowedKinds,
>     resolvedPathPatterns: depCruiseTestBucketRules['<bucket-id>'].allowedPathPatterns,
>   }),
>   deny: Object.freeze({
>     resolvedPathPatterns: depCruiseTestBucketRules['<bucket-id>'].deniedPathPatterns,
>   }),
> });
> ```
>
> 4 個 bucket 全 push，順序依 unit → integration → e2e → helpers。

**Acceptance Criteria**:

- [ ] `TEST_BUCKET_DEPCRUISE_ARTIFACTS` 從 4 個 element 變成 8 個
- [ ] 4 個新 element 的 `bucket` 字串對應正確
- [ ] 每個 element 有 `allow.kinds` / `allow.resolvedPathPatterns` / `deny.resolvedPathPatterns`
- [ ] 全部 `Object.freeze` 包

**Verify Command**:

```bash
node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => {
  const a = m.TEST_BUCKET_DEPCRUISE_ARTIFACTS;
  if (a.length !== 8) { console.error('FAIL: expected 8 artifacts, got', a.length); process.exit(1); }
  const buckets = a.map(x => x.bucket);
  const expected = ['unit','integration','e2e','specs-test-utils','unit-tests-root','integration-tests-root','e2e-tests-root','tests-helpers'];
  for (const b of expected) if (!buckets.includes(b)) { console.error('FAIL: missing artifact for', b); process.exit(1); }
  console.log('PASS');
});"
```

**期望**：`PASS`。

**Wave 2 trigger 點**：T005 通過後 → 啟動 Agent-D 跑 T007（test-bucket-policy.test.js 改 .toEqual 8-bucket 斷言）。

---

### T006 [Agent-A 第 6 棒] policy.js Patch F: isAllowedRelativeDependency

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（line 455-486）

**Description**：擴張 `isAllowedRelativeDependency`：

1. line 456 早返加 `unit-tests-root` / `integration-tests-root`
2. 新增 `tests-helpers` 分支（在 `specs-test-utils` 後）
3. e2e 分支正則擴張支援 `tests/e2e/` feature root + `tests/_helpers/e2e-helpers.js`

**Engineer Prompt**:

> 詳見 plan 檔 Patch F 區塊。三個改動點都要動：
>
> 1. early-return 從 `bucketId === 'unit' || bucketId === 'integration'` 擴成 4 個 OR
> 2. 加 `if (bucketId === 'tests-helpers') { ... }` 分支
> 3. `if (bucketId === 'e2e' || bucketId === 'e2e-tests-root')` + 正則改 `^(specs\/.+\/tests\/e2e|tests\/e2e(?:\/[^/]+)?)(?:\/|$)` + 加 tests/\_helpers/e2e-helpers.js 認可

**Acceptance Criteria**:

- [ ] early-return condition 含 4 個 bucketId（unit / integration / unit-tests-root / integration-tests-root）
- [ ] 新增 `tests-helpers` 分支：reference.resolvedPath 必須以 `tests/_helpers` 開頭
- [ ] e2e 分支正則同時 match 舊 `specs/.../tests/e2e` 與新 `tests/e2e`
- [ ] e2e 分支認 `tests/_helpers/e2e-helpers.js` 為合法 helper

**Verify Command**:

```bash
node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => {
  // 1. unit-tests-root 接受任何 relative
  const r1 = m.evaluateTestDependency('tests/unit/service/foo.test.js', './bar.js');
  if (!r1.allowed) { console.error('FAIL: unit-tests-root relative denied'); process.exit(1); }
  // 2. tests-helpers 接受 inside-tests-helpers
  const r2 = m.evaluateTestDependency('tests/_helpers/foo.js', './bar.js');
  if (!r2.allowed) { console.error('FAIL: tests-helpers relative denied'); process.exit(1); }
  // 3. e2e-tests-root 接受 same-feature relative
  const r3 = m.evaluateTestDependency('tests/e2e/posts/foo.spec.js', './bar.js');
  if (!r3.allowed) { console.error('FAIL: e2e-tests-root same-feature relative denied'); process.exit(1); }
  console.log('PASS');
});"
```

**期望**：`PASS`。

---

### T008 [Agent-B 獨立] package.json 4 個 script 加 tests

**Files**：`package.json`（line 9, 11-12, 18）

**Description**：4 個 npm script 的掃描範圍從 `src specs` 擴成 `src specs tests`（spellcheck 加 `"tests/**/*.{js,jsx}"`）。

**Engineer Prompt**:

> 編輯 `package.json`。改動：
>
> - line 9 `"lint": "eslint src specs"` → `"eslint src specs tests"`
> - line 11 `"depcruise": "depcruise --config .dependency-cruiser.mjs --output-type err-long src specs"` → 結尾加 `tests`
> - line 12 `"depcruise:json": "..."` → 同樣加 `tests`
> - line 18 `"spellcheck": "cspell lint \"src/**/*.{js,jsx}\" \"specs/**/*.{js,jsx}\""` → 結尾加 `\"tests/**/*.{js,jsx}\"`
>   不動其他 script。

**Acceptance Criteria**:

- [ ] 4 個 script 都有 `tests` token
- [ ] 不動其他 script 內容
- [ ] JSON 仍 valid（`node -e "require('./package.json')"` 不報錯）

**Verify Command**:

```bash
# 4 個 script 都有 tests
count=$(grep -E '"(lint|depcruise|depcruise:json|spellcheck)":' package.json | grep -c tests)
if [ "$count" -lt 4 ]; then echo "FAIL: only $count scripts contain tests"; exit 1; fi
# JSON valid
node -e "require('./package.json')" || { echo "FAIL: invalid JSON"; exit 1; }
echo "PASS"
```

**期望**：`PASS`。

---

### T009 [Agent-C 獨立] 建 tests/ 空目錄結構 + .gitkeep

**Files**：新建 9 個 `.gitkeep`

**Description**：建立未來 mv 目標目錄結構。

**Engineer Prompt**:

> 在 repo root 執行：
>
> ```bash
> mkdir -p tests/unit/{service,repo,runtime,lib,config} tests/integration tests/e2e/_setup tests/_helpers
> touch tests/unit/{service,repo,runtime,lib,config}/.gitkeep
> touch tests/integration/.gitkeep tests/_helpers/.gitkeep tests/e2e/_setup/.gitkeep
> ```
>
> 不要在這些目錄放任何 `.js` / `.test.js` 檔（Phase 1-3 才填）。

**Acceptance Criteria**:

- [ ] `tests/unit/` 含 5 個子目錄 (service/repo/runtime/lib/config)
- [ ] 9 個 `.gitkeep` 全部存在
- [ ] 沒有任何 `.js` / `.test.js` 檔在 tests/ 下

**Verify Command**:

```bash
expected_paths=(
  tests/unit/service/.gitkeep
  tests/unit/repo/.gitkeep
  tests/unit/runtime/.gitkeep
  tests/unit/lib/.gitkeep
  tests/unit/config/.gitkeep
  tests/integration/.gitkeep
  tests/e2e/_setup/.gitkeep
  tests/_helpers/.gitkeep
)
for p in "${expected_paths[@]}"; do
  [ -f "$p" ] || { echo "FAIL: missing $p"; exit 1; }
done
# 確認沒有意外 .js 檔
js_count=$(find tests -name "*.js" -o -name "*.jsx" | wc -l)
if [ "$js_count" -gt 0 ]; then echo "FAIL: unexpected .js files in tests/"; exit 1; fi
echo "PASS"
```

**期望**：`PASS`。

---

## Wave 2 — T005 觸發後（並行 1 agent）

### T007 [Agent-D] test-bucket-policy.test.js Patch G: .toEqual 8-bucket

**Files**：`specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js`（line 124）

**Dependency**：T005 完成（`TEST_BUCKET_DEPCRUISE_ARTIFACTS` 才有 8 個 entry）

**Description**：把 `.toEqual` 從 4-bucket array 改成 8-bucket array。

**Engineer Prompt**:

> 編輯 `specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js` line 124 附近。把 `expect(TEST_BUCKET_DEPCRUISE_ARTIFACTS.map(...)).toEqual(['unit','integration','e2e','specs-test-utils'])` 改成 8-bucket array：append `'unit-tests-root','integration-tests-root','e2e-tests-root','tests-helpers'`。其他斷言不動（特別是 0 violations 那條保留）。

**Acceptance Criteria**:

- [ ] line 124 附近的 `.toEqual` 含 8 個 bucket name
- [ ] 順序：舊 4 個（unit/integration/e2e/specs-test-utils）在前，新 4 個在後
- [ ] 其他測試斷言完全沒動

**Verify Command**:

```bash
npx vitest run specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js 2>&1 | tail -20
# 期望：所有 it/test 全綠，無 fail
```

**Critical**：T001-T007 必須在 git working copy 上**全部完成**才 commit（同一 commit 鐵律 — Risk R1）。

---

## Wave 3 — Wave 1+2 全完後（並行 2 agents）

### T010 [Agent-E 獨立] testing-standards.md line 13-14 重寫

**Files**：`.claude/rules/testing-standards.md`（line 13-14）

**Description**：把舊「Test structure」+「Test results」兩行改成並存期說明。

**Engineer Prompt**:

> 詳見 plan 檔「具體 Patch（testing-standards.md line 13-14）」區塊。原文：
>
> ```
> - Test structure: `specs/<feature>/tests/[unit|integration|e2e]/`
> - Test results: `specs/<feature>/test-results/[unit|integration|e2e]/`
> ```
>
> 改成：
>
> ```
> - Test location（Phase 1-3 並存期）:
>   - 新增測試: `tests/{unit/<layer>,integration/<domain>,e2e}/<name>.test.js`
>   - 既有測試: `specs/<feature>/tests/[unit|integration|e2e]/` 仍接受，由 Phase 1-3 統一遷出
> - Test results: `tests/test-results/[unit|integration|e2e]/`（legacy: `specs/<feature>/test-results/`）
> ```
>
> 不動其他段落。

**Acceptance Criteria**:

- [ ] line 13 含「Test location（Phase 1-3 並存期）」字樣
- [ ] 含「新增測試」「既有測試」兩條 sub-bullet
- [ ] 含 `tests/{unit/<layer>,integration/<domain>,e2e}/` 字面量
- [ ] 其他 line 完全沒動

**Verify Command**:

```bash
grep -q "並存期" .claude/rules/testing-standards.md || { echo "FAIL: no 並存期"; exit 1; }
grep -q "tests/{unit/<layer>" .claude/rules/testing-standards.md || { echo "FAIL: no new path"; exit 1; }
echo "PASS"
```

---

### T011 [Agent-F 獨立] SKILL.md 9 處寫死路徑重寫

**Files**：`.claude/skills/test-driven-development/SKILL.md`（line 34/36/37/60-62/84/88/96/108/118/142-144/146）

**Description**：對照 parent 計畫書 Hidden Cost #4 的 9 處對照表逐處改。Spec artifacts (specs/<branch>/spec.md/plan.md/tasks.md) 路徑保留，測試檔路徑全切到 `tests/`。

**Engineer Prompt**:

> 編輯 `.claude/skills/test-driven-development/SKILL.md`。9 處對照：
> | Line | 舊 → 新 |
> |---|---|
> | 34, 36, 37 | 保留（spec artifacts） |
> | 60-62 | `mkdir -p specs/$BRANCH/tests/{...}` → `mkdir -p tests/{unit,integration,e2e}`，移除 test-results mkdir |
> | 84 | Glob `specs/*/tests/unit/*.test.js` → `tests/unit/**/*.test.js` |
> | 88, 96, 108 | `Path: $TEST_PATH/{unit\|integration\|e2e}/` → 直接寫 `tests/{unit/<layer>\|integration/<domain>\|e2e}/`，移除 $TEST_PATH 變數 |
> | 118 | `specs/$BRANCH/tests/unit/login.test.jsx`→`tests/unit/<layer>/login.test.jsx`|
| 142-144 |`npx vitest run $TEST_PATH/unit ...`→`npx vitest run tests/unit/<layer>/<file> ...`|
| 146 |`specs/<branch-name>/test-results/`→`tests/test-results/` |
>
> Step 2.5 開頭加註並存說明：「若分支已有 `specs/<branch>/tests/`，新檔仍可放舊位置直到該 spec 進入 Phase 1-3 遷移」。

**Acceptance Criteria**:

- [ ] line 60-62 不再含 `mkdir -p specs/$BRANCH/tests`
- [ ] line 84 改成 `tests/unit/**/*.test.js`
- [ ] 全檔 grep `specs/\$BRANCH/tests` 應只在「並存說明」段落 1 處出現（或完全消失）
- [ ] 全檔 grep `\$TEST_PATH` 應 0 命中
- [ ] line 146 含 `tests/test-results/`
- [ ] Step 2.5 開頭新增「並存」說明文字

**Verify Command**:

```bash
SKILL=.claude/skills/test-driven-development/SKILL.md
# $TEST_PATH 應 0 命中
if grep -c '\$TEST_PATH' "$SKILL" | grep -qv '^0$'; then echo "FAIL: \$TEST_PATH still present"; exit 1; fi
# $BRANCH/tests 應 ≤ 1（只在並存說明）
count=$(grep -c '\$BRANCH/tests' "$SKILL")
if [ "$count" -gt 1 ]; then echo "FAIL: \$BRANCH/tests appears $count times (max 1)"; exit 1; fi
# 含並存說明
grep -q "並存" "$SKILL" || { echo "FAIL: no 並存 description"; exit 1; }
echo "PASS"
```

---

## Wave 4 — Smoke Test（serial, 1 agent）

### T012 [Agent-G] 完整 smoke test

**Dependency**：T001-T011 全完成

**Description**：跑完整 quality gate 確認並存模式生效。**主 agent 派 Engineer subagent 跑，主 agent 不自己跑任何命令**。

**Engineer Prompt** (派 Agent-G `general-purpose`):

> 你是 Phase 0 Wave 4 smoke test engineer。依序跑下列 4 區塊命令，全綠才算通過。任一失敗 → 回報具體哪個區塊、stderr 摘要、以及推測對應的 source task（T001-T011 哪個寫錯）。**不要自己嘗試修**，回報給主 agent 決定下一步。
>
> ```bash
> # 1. 8 buckets 註冊
> node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => console.log('buckets:', Object.keys(m.testBucketPolicy.buckets).length))"
> # 期望：buckets: 8
>
> # 2. 並存 classify
> node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => console.log({legacy: m.classifyTestBucket('specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx'), root: m.classifyTestBucket('tests/unit/service/foo.test.js')}))"
> # 期望：{ legacy: 'unit', root: 'unit-tests-root' }
>
> # 3. 舊 135 檔 0 violations
> node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => {
>   const g = m.scanRepoTestImportGraph();
>   for (const b of ['unit','integration','e2e','specs-test-utils']) {
>     const s = m.summarizeBucketViolations(g, b);
>     if (s.fileCount !== 0) { console.error('FAIL', b, s); process.exit(1); }
>   }
>   console.log('PASS, total files:', g.files.length);
> })"
>
> # 4. quality gate 5 連跑
> npm run depcruise && npm run lint && npm run type-check && npm run spellcheck && npm run test
> ```

**Acceptance Criteria**:

- [ ] 5 個 quality gate 命令全綠（exit 0）
- [ ] 並存 classify 雙軌都正確
- [ ] 舊 135 檔 0 violations
- [ ] `test-bucket-policy.test.js` 8-bucket .toEqual 斷言通過

**Verify Command**: 主 agent 派 Reviewer-G (`Explore`) 重跑上述 4 區塊命令，逐個確認 `PASS` / 全綠並可重現。**主 agent 不自己跑**。

**失敗處理**（主 agent dispatch 給對應 wave 的 engineer subagent）：

- depcruise 失敗 → 派 Agent-A 帶 reviewer feedback 重做 T001-T006 對應 patch
- vitest 失敗 → 派 Agent-D 重做 T007 (.toEqual 沒同步)
- lint/spellcheck 失敗 → 派 Agent-B 重做 T008 (script 沒加 tests) 或 Agent-C 重做 T009 (目錄結構)
- 觸及 R4（depcruise 對空目錄報 no modules）→ 派 Agent-C 補 `tests/.depcruise-placeholder.js` (`export {};`)

---

## Wave 5 — Manual

### T013 [User] 開 PR + 24h 觀察

**Description**：

```bash
git add -A   # 確認只含 Phase 0 改動
git status   # 人工 review 一次
git commit -m "refactor(tests): phase 0 quality-gate prep for tests/ directory migration"
git push -u origin 023-tests-directory-migration
gh pr create --title "refactor(tests): Phase 0 quality-gate prep" --body "$(cat <<'EOF'
## Summary
- policy.js 加 4 個並存 bucket（unit-tests-root / integration-tests-root / e2e-tests-root / tests-helpers）
- test-bucket-policy.test.js 同步斷言 8 bucket
- package.json 4 個 script 加 tests 掃描範圍
- 建 tests/{unit/{service,repo,runtime,lib,config},integration,e2e/_setup,_helpers}/ 空目錄
- 重寫 testing-standards.md 並存期說明 + SKILL.md 9 處寫死路徑

## Test plan
- [x] npm run depcruise / lint / type-check / spellcheck / test 全綠
- [x] 8 buckets 註冊
- [x] 舊 135 檔 0 violations（並存模式）
- [ ] main merge 後跑滿 24h 無 CI 紅
EOF
)"
```

**Acceptance**：

- [ ] PR 通過 review
- [ ] CI 全綠
- [ ] merge 後 main 觀察 24h 無 regression

---

## 執行 SOP（給主 agent 跑流程的指南）

### Step 1：~~開 branch~~ → ✅ 已完成（worktree 已開）

跳過。當前已在 `023-tests-directory-migration` branch 的 worktree (`/Users/chentzuyu/Desktop/dive-into-run-023-tests-directory-migration/`) 內，Phase 0 直接在此 branch 動工，不另開 sub-branch。

**前置確認**：主 agent 派 Reviewer-Bootstrap (`Explore`) 跑 `git status && git branch --show-current` 確認當前 branch 名 = `023-tests-directory-migration` 且 working copy 已知（具體 untracked file 清單回報給主 agent，主 agent 確認跟預期一致才往下推）。**主 agent 不自己跑 git 命令**。

### Step 2：Wave 1 啟動（並行 3 agents）

主 agent 在**單一 message** 內派 3 個 agents：

```
Agent-A (general-purpose): "依序執行 T001 → T002 → T003 → T004 → T005 → T006 六個 patch on policy.js。每完成一個 patch，立即跑該 task 的 verify command 自我驗證。全部完成後回報結果。完整 patch code 見 ~/.claude/plans/2026-04-26-tests-directory-migration-md-gleaming-flamingo.md。"

Agent-B (general-purpose): "執行 T008（package.json 4 個 script 加 tests）。完成後跑 verify command 自我驗證。"

Agent-C (general-purpose): "執行 T009（建 tests/ 空目錄結構）。完成後跑 verify command 自我驗證。"
```

### Step 3：Wave 1 配對 reviewers

每個 worker 完成回報後，**單一 message** 派 3 個 Reviewer agents（Explore type，read-only）：

```
Reviewer-A (Explore): "驗證 T001-T006 完成度。對 policy.js 跑 6 個 task 的 verify commands，逐一確認 PASS。任何 FAIL 回報具體哪個 patch 出錯。"

Reviewer-B (Explore): "驗證 T008 完成度。跑 verify command。"

Reviewer-C (Explore): "驗證 T009 完成度。跑 verify command。"
```

**任一 reviewer 報 FAIL** → 主 agent 重新派該 task 的 worker agent 帶 reviewer feedback 修正 → 重派 reviewer → 至 PASS（重試上限 3 次）。

### Step 4：Wave 2（T005 done 觸發）

T005 通過後立即派 Agent-D：

```
Agent-D (general-purpose): "執行 T007（test-bucket-policy.test.js .toEqual 8-bucket）。完成後跑 vitest 自我驗證。"
```

配對 Reviewer-D 確認。

### Step 5：Wave 3（並行 2 agents）

Wave 1+2 全 PASS 後：

```
Agent-E (general-purpose): "執行 T010（testing-standards.md line 13-14 重寫）。"
Agent-F (general-purpose): "執行 T011（SKILL.md 9 處重寫）。"
```

配對 Reviewer-E / Reviewer-F。

### Step 6：Wave 4 smoke test（派 subagent）

主 agent **派 Agent-G (`general-purpose`)** 跑 T012 的 4 區塊命令。配對 Reviewer-G (`Explore`) 重跑驗證。

任一失敗 → 主 agent **不自己診斷修復**，依 T012 「失敗處理」表 dispatch 給對應 wave 的 engineer subagent → 該 wave 重做 → 完成後重跑 Wave 4。

**主 agent 從頭到尾不跑任何 npm / node / git 命令。**

### Step 7：commit + PR（派 subagent）

主 agent **派 Agent-Commit (`general-purpose`)** 跑：

```
Agent-Commit 提示詞：
"執行 commit 流程：
  1. git status 確認所有改動範圍
  2. git diff 看內容（檢查無 .env / secrets / unrelated 改動）
  3. git add 對應檔案（policy.js / test-bucket-policy.test.js / package.json / tests/ 目錄 / testing-standards.md / SKILL.md / specs/023-tests-directory-migration/）
  4. git commit -m 'refactor(tests): phase 0 quality-gate prep for tests/ directory migration'
  5. 跑 git log -1 + git status 回報結果
不要 push（user 自己 push + 開 PR）。"
```

派 Reviewer-Commit (`Explore`) 跑 `git log -1 --stat + git diff HEAD~1 --stat` 確認 commit 範圍與內容正確、commit message 符合 conventional commits 格式。

PR 開立 (T013) 由 user manual 跑 `git push` + `gh pr create`（涉及 push 到 remote，destructive 程度需 user confirm）。主 agent 只負責通報「Phase 0 commit 完成、可開 PR」+ 提供 PR 描述模板（T013 區塊已有）。

---

## 失敗回滾

任一 wave 完成度低於 100%（reviewer 持續報 FAIL ≥ 3 次）→ 主 agent **立即停手 + escalate 給 user**，不繼續推進，避免後續 wave 在錯誤基礎上累積。

主 agent **不派 subagent 跑回滾命令**（涉及 `git restore` / `git branch -D` 等 destructive 操作 — 必須 user 親自 confirm 並執行）。回滾命令模板給 user 複製貼上：

```bash
# user 親跑（複製貼上後逐行確認）
# worktree 已開且 branch = 023-tests-directory-migration，回滾不刪 branch（branch 是 worktree 的主人）
git restore .                                              # 丟棄所有未 commit 改動
git clean -fd tests/                                       # 移除新建空目錄含 .gitkeep
# 若連已 commit 的 Phase 0 規劃文件都要回退（specs/023-tests-directory-migration/{plan,tasks}.md）：
# git reset --hard <Phase-0 commit 之前的 sha>
```

---

## 完成判準（總體）

- [ ] T001-T013 全 PASS
- [ ] PR opened, CI 全綠
- [ ] main merge, 24h 無 regression
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) 的 Verification Checklist「Phase 0 完成」全部 `[x]`
