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

---

# Phase 1 Tasks: Unit Tests 遷移（~60 檔）

> **狀態**：規劃中（2026-04-27 加入），**尚未實作**。
> **前提（gate）**：Phase 0 PR 已 merge + main 跑滿 24h 無 CI 紅。Phase 0 commit 目前**尚未 push**（見 [`./phase-0-handoff.md`](./phase-0-handoff.md)），Phase 1 不可在 push 前啟動。本檔不寫死 Phase 0 sha — 落筆時為 `88d3b94`，後續 amend 可能讓 sha 變動，user rollback 時用 `git log --grep='phase 0 quality-gate prep' --pretty='%H' | head -1` 取最新值。
> **Spec folder**：`specs/023-tests-directory-migration/`（同 Phase 0）
> **Branch**：`023-tests-directory-migration`（沿用，不另開 sub-branch；commit 接在 Phase 0 head 之後）
> **預估工期**：1-2 天
> **總任務數**：14（T101-T114；Wave 6 拆兩 commit）
> **參考**：parent 藍圖 [`./plan.md`](./plan.md) Phase 1 段（Step 1.1-1.7）；Phase 0 handoff [`./phase-0-handoff.md`](./phase-0-handoff.md)（subagent permission 阻塞警告）

---

## 並行策略總覽（Phase 1）

### 同時最多 3 對 worker-reviewer（瞬時 6 active subagents）

沿用 Phase 0 上限。為何 3 對：

- 3 個 layer 並行 git mv 不會撞（檔案不同、sub-folder 不同）
- 主 agent context 同時管 3 對 worker-reviewer 是合理上限
- mv 操作互不依賴（除 KNOWN_S015 必須等所有 mv 完才動 → Wave 4 才啟動）

### 主 Agent 角色邊界（Non-Negotiable，**重申**）

主 agent 從頭到尾**純粹 orchestrator**，包含後續修改循環。

| 動作                                                         | 主 Agent                     | 備註                                   |
| ------------------------------------------------------------ | ---------------------------- | -------------------------------------- |
| `Agent` 派 sub-agents                                        | ✅                           | 唯一執行手段                           |
| `SendMessage` 帶 reviewer feedback 重派 worker               | ✅                           | 失敗循環關鍵                           |
| `Read` 讀檔（含 inventory.md）                               | ✅                           | 只讀                                   |
| `TaskCreate` / `TaskUpdate`                                  | ✅                           | 不影響 repo                            |
| 與 user 對話、escalate                                       | ✅                           |                                        |
| `Edit` / `Write` 動檔                                        | ❌                           | **絕對禁止** — 派 engineer subagent 做 |
| `Bash` 跑 `git mv` / `npm` / `node` / `mkdir` 等 mutate 命令 | ❌                           | **絕對禁止** — 派 subagent 做          |
| `Bash` 跑純 query 命令（`git status` / `find`）              | ⚠️ 可，但**優先派 Reviewer** | 罕用                                   |

**Phase 0 handoff 阻塞紀錄重點**（[`./phase-0-handoff.md`](./phase-0-handoff.md)）：

- ✅ Phase 1 **不 touch `.claude/`** — Phase 0 「subagent 對 `.claude/**` 寫入結構性 deny」與本 Phase 無關
- ⚠️ subagent Bash (`node -e` / `npm run *` / `vitest`) 可能仍被 deny — 啟動 Wave 1 前先派一個小 subagent 試 hot-reload；若仍擋，**verify 集中到 Wave 5 smoke 一次跑**（沿用 Phase 0 策略），各 wave reviewer 改用 source review (Read + grep)，不要每 wave 重複試 runtime verify
- 重試上限：reviewer 持續 FAIL ≥ 3 次 → 主 agent 立即 STOP + escalate user

### Engineer / Reviewer 配對機制

- **Engineer subagent**：`general-purpose`（Edit / Write / Bash 完整工具）
- **Reviewer subagent**：`Explore`（Read + Bash query；read-only，無 Edit/Write）
- 配對：每 task 派完 engineer 後、立即派配對 reviewer 驗收。reviewer FAIL → 主 agent 透過 SendMessage 把 reviewer 的具體 feedback 傳給原 engineer，命其修正 → 重派 reviewer → 至 PASS

---

## 依賴圖（Phase 1）

```
Wave 0 (gate, 1 reviewer):
  └─ Reviewer-Bootstrap: T101                    (前置條件確認)
                                                  │
Wave 1 (2 並行 worker-reviewer):                  │
  ├─ Agent-Inventory:    T102                    (60 檔 source/target 對照表)
  └─ Agent-Vitest:       T103                    (vitest.config.mjs coverage)
                                                  │
Wave 2 (3 並行 worker-reviewer):                  │
  ├─ Agent-Service:      T104                    (service layer mv)
  ├─ Agent-Repo:         T105                    (repo layer mv)
  └─ Agent-Runtime:      T106                    (runtime layer mv)
                                                  │
Wave 3 (剩餘 layer，最多 3 並行 — 視 inventory):   │
  ├─ Agent-Lib:          T107                    (lib layer mv)
  ├─ Agent-Api:          T108                    (api layer mv，若 inventory 列出)
  └─ Agent-Other:        T109                    (config/components/其他，若有)
                                                  │
Wave 4 (1 worker-reviewer):                       │
  └─ Agent-S015:         T110                    (policy.js KNOWN_S015 8 條 filePath)
                                                  │
Wave 5 (1 worker-reviewer):                       │
  └─ Agent-Smoke:        T111                    (5 quality gate + Phase 1 specific 驗證)
                                                  │
Wave 6a (1 worker-reviewer):                      │
  └─ Agent-Commit-Mv:    T112                    (commit 1: 60 mv + KNOWN_S015)
                                                  │
Wave 6b (1 worker-reviewer):                      │
  └─ Agent-Commit-Cfg:   T113                    (commit 2: vitest.config + inventory + 新 .gitkeep)
                                                  │
Wave 7 (manual):                                  │
  └─ User:               T114                    (push + open PR + 24h 觀察)
```

---

## Phase 1 Wave 0 — 前置確認（gate only，不動工）

### T101 [Reviewer-Bootstrap] 前置條件確認

**Files**：純讀取，不動

**Description**：Phase 1 開工的硬性 gate。Phase 0 PR 必須已 merge 才能啟動，否則直接 mv 會撞「Phase 0 已並存 bucket 但 main 還沒看到 → CI 對 main 仍以舊 bucket 跑 → 新位置失明」。

**Reviewer Prompt** (派 Reviewer-Bootstrap, `Explore`):

> 你是 Phase 1 開工 gate 檢查 reviewer。依序跑下列 5 步，**全 PASS** 才回報「APPROVE — Phase 1 可開工」。任一 FAIL → 列出原因 escalate，**不嘗試修**。
>
> ```bash
> cd /Users/chentzuyu/Desktop/dive-into-run-023-tests-directory-migration
>
> # 1. worktree clean check
> git status --porcelain
> # 期望：empty 或只剩 untracked `project-health/`、`specs/023-tests-directory-migration/phase-0-handoff.md`
> # FAIL 條件：有 modified（M）/ added（A）/ renamed（R）標記的 tracked 檔
>
> # 2. branch
> git branch --show-current
> # 期望：023-tests-directory-migration
>
> # 3. Phase 0 commit 已 push
> git log -1 --pretty='%h %s'
> # 期望：含 'phase 0 quality-gate prep'
> git ls-remote origin 023-tests-directory-migration 2>&1 | head -3
> # 期望：remote 有此 branch（已 push）
>
> # 4. PR merged + main CI 24h
> gh pr list --base main --head 023-tests-directory-migration --state merged --json number,title,mergedAt
> # 期望：JSON 含 1 個 entry，mergedAt 距今 ≥ 24h
> gh run list --branch main --limit 10 --json conclusion,createdAt,name | head -50
> # 期望：近 24h 內 main CI 全 success
>
> # 5. tests/ 目前無真實測試檔（除 _placeholder.js）
> find tests -type f -not -name '.gitkeep' -not -name '_placeholder.js' | wc -l
> # 期望：0
> ```
>
> 全部 PASS 才 APPROVE。任一 FAIL：回報具體哪步、實際 output、推測原因（push 沒做 / PR 還在 open / CI 紅 / 意外動到 tests/），**stop**。

**Acceptance Criteria**:

- [ ] worktree 無 modified tracked 檔
- [ ] branch = `023-tests-directory-migration`
- [ ] Phase 0 commit 已 push 且 PR merged
- [ ] main CI 24h 無紅
- [ ] tests/ 不含真實測試檔（只 `_placeholder.js` + 9 個 `.gitkeep`）

**失敗處理**：任一步 FAIL → 主 agent **不啟 Wave 1**，escalate user 補：

- push 沒做 → 提醒 user 跑 [`./tasks.md` T013](#t013-user-開-pr--24h-觀察) 範本
- PR 還在 open → 等 review + merge
- CI 紅 → 派 Engineer-Phase0-Fix 對應的 Phase 0 task 重做（T001-T011）
- 意外動到 tests/ → user 親跑 `git restore tests/`

---

## Phase 1 Wave 1 — Inventory + 配置（並行 2 agents）

### T102 [Engineer-Inventory] 60 個 unit test source/target 對照表

**Files**：新建 `specs/023-tests-directory-migration/phase-1-mv-inventory.md`

**Description**：產出每個 unit test 的「source path → target path → 主要 import 證據 → 推導 layer」對照，作為 Wave 2-3 的執行依據。Engineer **不動任何測試檔**（不 git mv、不 edit），只產出 markdown table。

**Layer 對應規則（嚴格）**：

| 主要被測 import 來源                                            | Target sub-folder                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `@/service/<X>` 或檔名含 `*-service` / `*-helpers`（業務邏輯）  | `tests/unit/service/`                                         |
| `@/repo/<X>` 或檔名 `firebase-<X>` （非 helper）                | `tests/unit/repo/`                                            |
| `@/runtime/<X>` 或 hook (`useXxx.test.jsx`) 或 provider/context | `tests/unit/runtime/`                                         |
| `@/lib/<X>` 或 lint rule / policy / config-shaped               | `tests/unit/lib/`                                             |
| `@/config/<X>`                                                  | `tests/unit/config/`                                          |
| Next.js API route handler (`*-route.test.js`)                   | `tests/unit/api/`（**新增 sub-folder**，需 mkdir + .gitkeep） |
| `@/components/<X>`                                              | `tests/unit/components/`（**新增 sub-folder**）               |

**特殊 case**：

- `specs/021-.../tests/unit/test-bucket-policy.test.js` → `tests/unit/lib/test-bucket-policy.test.js`（Phase 0 已斷言 8-bucket）
- `specs/g8-server-coverage/tests/unit/*.test.js`（2 檔）→ **不搬**，標 Notes: `KEEP IN PLACE — server project (vitest.config.mjs:59 hardcoded)`
- `specs/mock-audit-*/tests/unit/*` → 仍依 import 搬（archive 紀錄不影響 layer 歸屬）
- `specs/fix/<X>/tests/unit/*` → 依 import 搬

**Engineer Prompt**:

> 你是 Phase 1 inventory engineer。產出 `specs/023-tests-directory-migration/phase-1-mv-inventory.md`，markdown table 結構：
>
> ```markdown
> # Phase 1 MV Inventory
>
> | #   | Source Path                                                  | Layer | Target Path                             | Main Import Evidence                                    | Notes |
> | --- | ------------------------------------------------------------ | ----- | --------------------------------------- | ------------------------------------------------------- | ----- |
> | 1   | specs/001-event-filtering/tests/unit/firebase-events.test.js | repo  | tests/unit/repo/firebase-events.test.js | `import { ... } from '@/repo/firebase-events'` (line 7) |       |
> | ... | ...                                                          | ...   | ...                                     | ...                                                     | ...   |
>
> ## Summary
>
> Total: 60 | service: a | repo: b | runtime: c | lib: d | config: e | api: f | components: g | KEEP: 2
> ```
>
> 執行步驟：
>
> 1. `find specs -path '*/tests/unit/*.test.*' -type f | sort` 列全部
> 2. 對每個檔 `head -30 <file>` 抓 import；找出**主要被測** import：
>    - 通常是配 `vi.mock('@/<layer>/<X>')` 的那個
>    - 或是直接 `import { funcUnderTest } from '@/<layer>/<X>'`（非 helper / 非 testing-library）
> 3. 套「Layer 對應規則」決定 target sub-folder
> 4. **重名衝突**：若不同 source 對應同 target name（例：002 與 003 都有 `firebase-events.test.js`）：
>    - 比對內容差異 (`diff` 或 head)。完全相同 → 保留**最新的 spec 編號**那個（target = 原檔名），舊的標 Notes: `DUP_DELETE — content identical to <newer-source>，待主 agent 確認後 git rm`
>    - 內容不同 → 舊的 target = `<X>-<NNN-tag>.test.js`（例 `firebase-events-002-jsdoc.test.js`），標 Notes 說明
> 5. **不要**動任何檔（不 git mv、不 edit、不 rm）
>
> 完成後跑：
>
> ```bash
> # 自我驗證 row 數
> rows=$(grep -c '^| [0-9]' specs/023-tests-directory-migration/phase-1-mv-inventory.md)
> total=$(find specs -path '*/tests/unit/*.test.*' -type f | wc -l | tr -d ' ')
> echo "rows=$rows total=$total"   # 期望：rows == total
> ```
>
> 回報「N rows produced, k DUP_DELETE flagged, j KEEP flagged」+ 完整 Summary 行。

**Acceptance Criteria**:

- [ ] inventory.md 存在於 `specs/023-tests-directory-migration/`
- [ ] row 數 = `find specs -path '*/tests/unit/*.test.*' -type f | wc -l`
- [ ] 每筆 target path 以 `tests/unit/` 開頭（除 KEEP 標記）
- [ ] 同一 layer 內 target name 全 unique
- [ ] 每筆 Main Import Evidence 含具體 import 字串（非空、含 `@/` 或具體模組名）
- [ ] Summary 行各 layer 加總 + KEEP = total
- [ ] g8-server-coverage 兩檔標 KEEP

**Verify Command** (Reviewer-Inventory, `Explore` 跑):

```bash
INV=specs/023-tests-directory-migration/phase-1-mv-inventory.md
[ -f "$INV" ] || { echo "FAIL: inventory missing"; exit 1; }

# 1. row 數對齊 find
expected=$(find specs -path '*/tests/unit/*.test.*' -type f | wc -l | tr -d ' ')
rows=$(grep -c '^| [0-9]' "$INV")
[ "$rows" -eq "$expected" ] || { echo "FAIL: rows=$rows expected=$expected"; exit 1; }

# 2. target unique（排除 KEEP）
dup=$(grep -oE '\| tests/unit/[a-z]+/[A-Za-z0-9._-]+\.test\.[a-z]+' "$INV" | sort | uniq -d)
[ -z "$dup" ] || { echo "FAIL: duplicate targets:"; echo "$dup"; exit 1; }

# 3. g8 兩檔標 KEEP
keep_g8=$(grep -E 'specs/g8-server-coverage' "$INV" | grep -c 'KEEP')
[ "$keep_g8" -eq 2 ] || { echo "FAIL: g8 KEEP count=$keep_g8 expected=2"; exit 1; }

# 4. 每筆有 import 證據（粗略：欄位數）
weak=$(awk -F'|' 'NR>2 && /\.test\./ && (NF<6 || $5 ~ /^ *$/) {print NR}' "$INV")
[ -z "$weak" ] || { echo "FAIL: rows missing import evidence: $weak"; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

### T103 [Engineer-Vitest] vitest.config.mjs coverage scope 擴張

**Files**：`vitest.config.mjs`（line 18-34）

**Description**：擴大 coverage 涵蓋的 src 子目錄；防 colocate 測試誤入 coverage；暫降 thresholds 觀察新 scope 表現。

**Engineer Prompt**:

> 編輯 `vitest.config.mjs` line 18-34（`coverage` block）：
>
> 1. line 22 `include: ['src/lib/**']` → `include: ['src/{service,repo,runtime,lib,config}/**']`
> 2. line 23-30 `exclude` array 改成（保留原有 4 個 lib 排除 + 新增 colocate 防範 + 拓寬 `__tests__`）：
>    ```js
>    exclude: [
>      'src/lib/taiwan-locations.js',
>      'src/lib/weather-types.js',
>      'src/lib/firebase-client.js',
>      'src/lib/firestore-types.js',
>      'src/**/*.test.{js,jsx}',     // 新增：colocate 防範
>      'src/**/__tests__/**',         // 從 src/lib/**/__tests__/** 拓寬
>    ],
>    ```
> 3. line 31-33 `thresholds.lines: 95` → `thresholds.lines: 80`（暫降）並在上方加註：
>    ```js
>    thresholds: {
>      // TODO: Phase 1 觀察 1-2 週後分階段提回 95
>      lines: 80,
>    },
>    ```
>
> **不動** `projects` array（browser / server）的 include / exclude。
>
> 完成後跑：
>
> ```bash
> node -e "import('./vitest.config.mjs').then(m => { const c=m.default.test.coverage; console.log({include:c.include, exclude:c.exclude, lines:c.thresholds.lines}); })"
> ```
>
> 期望輸出含新 include + 6 個 exclude + lines:80。

**Acceptance Criteria**:

- [ ] `coverage.include` = `['src/{service,repo,runtime,lib,config}/**']`
- [ ] `coverage.exclude` 包含：
  - 原 4 個 lib 檔
  - `'src/**/*.test.{js,jsx}'`（colocate 防範）
  - `'src/**/__tests__/**'`（取代原 `src/lib/**/__tests__/**`）
- [ ] `coverage.thresholds.lines` = 80
- [ ] 含 `// TODO:` 註解標記提回 95
- [ ] `projects` array 內 browser / server 的 include / exclude 沒動
- [ ] vitest config 仍 importable（無 syntax error）

**Verify Command** (Reviewer-Vitest, `Explore` 跑):

```bash
node -e "
import('./vitest.config.mjs').then(m => {
  const c = m.default.test.coverage;
  if (!c.include.some(p => p.includes('service,repo,runtime'))) { console.error('FAIL: include not expanded'); process.exit(1); }
  if (!c.exclude.includes('src/**/*.test.{js,jsx}')) { console.error('FAIL: colocate exclude missing'); process.exit(1); }
  if (!c.exclude.includes('src/**/__tests__/**')) { console.error('FAIL: __tests__ exclude missing'); process.exit(1); }
  if (c.thresholds.lines !== 80) { console.error('FAIL: thresholds.lines=', c.thresholds.lines); process.exit(1); }
  if (m.default.test.projects.length !== 2) { console.error('FAIL: projects array touched'); process.exit(1); }
  console.log('PASS');
});
"
```

**期望**：`PASS`。

> ⚠️ Phase 0 handoff 警告：subagent 跑 `node -e` 可能被 deny。若 reviewer FAIL with permission error → 改用 source review：grep `'src/{service,repo,runtime,lib,config}/\*\*'` vitest.config.mjs，加 grep `'src/\*\*/\*.test.{js,jsx}'`，加 grep `lines: 80`。三個 grep 都命中視為 PASS。

---

## Phase 1 Wave 2 — git mv 第一批（並行 3 agents）

> **啟動條件**：T102 + T103 雙 PASS。主 agent **讀**（Read）`phase-1-mv-inventory.md` 確認 service / repo / runtime 三 layer 都有 row。
>
> **共通規則（T104-T109 全適用）**：
>
> 1. Engineer **只跑 `git mv` 與必要 `mkdir` + `git add .gitkeep`**，**不 edit 測試檔內容**
> 2. mv 後該 layer sub-folder 的 `.gitkeep` 不可刪
> 3. 不 commit（commit 留 Wave 6a/6b）
> 4. 若 inventory 標 `DUP_DELETE` → engineer 不 rm，**回報主 agent 決策**（destructive 動作）
> 5. 若某筆 source 不存在（已被別 wave engineer 搬走 / 或 inventory 過時）→ 立即 STOP 回報，不創新檔

### T104 [Engineer-Service] service layer git mv

**Files**：`tests/unit/service/<X>.test.js`（依 inventory `Layer == service` 行）

**Description**：把 inventory 標為 `service` 的所有檔搬到 `tests/unit/service/`。

**Engineer Prompt**:

> 你是 Phase 1 service layer mv engineer。
>
> 1. `cat specs/023-tests-directory-migration/phase-1-mv-inventory.md | grep '| service |'` 取得待搬清單
> 2. 對每筆 row：parse Source Path / Target Path 兩欄，跑 `git mv <source> <target>`
> 3. 全部完成後跑：
>    ```bash
>    git status -s | grep '^R.*-> tests/unit/service/' | wc -l
>    ls tests/unit/service/ | grep -v '\.gitkeep' | wc -l
>    git status -s | grep '^.M' | wc -l   # 期望 0（沒有 modified）
>    ```
> 4. 回報三個數字 + service layer inventory row 數，四者必須相等（前三）/相符（最後一）
>
> **嚴格**：不動其他 layer、不 commit、不 edit 檔案內容、不刪 `.gitkeep`。

**Acceptance Criteria**:

- [ ] `tests/unit/service/.gitkeep` 仍存在
- [ ] `tests/unit/service/` 內 `.test.{js,jsx}` 數 = inventory `service` row 數
- [ ] `git status -s | grep -c '^R.*-> tests/unit/service/'` = inventory `service` row 數
- [ ] 所有 service source 已不存在於原 specs 路徑
- [ ] 沒有 `M`（modified）標記，只有 `R`（renamed）

**Verify Command** (Reviewer-Service, `Explore` 跑):

```bash
INV=specs/023-tests-directory-migration/phase-1-mv-inventory.md
expected=$(grep -c '| service |' "$INV")
moved=$(git status -s | grep -c '^R.*-> tests/unit/service/' || echo 0)
[ "$moved" -eq "$expected" ] || { echo "FAIL: moved=$moved expected=$expected"; exit 1; }
[ -f tests/unit/service/.gitkeep ] || { echo "FAIL: .gitkeep removed"; exit 1; }
mod=$(git status -s | grep '^.M' | wc -l | tr -d ' ')
[ "$mod" -eq 0 ] || { echo "FAIL: $mod modified files (mv should not edit)"; exit 1; }
# 反向：所有 service source 不存在
for src in $(grep '| service |' "$INV" | awk -F'|' '{print $3}' | tr -d ' '); do
  [ -e "$src" ] && { echo "FAIL: source still exists: $src"; exit 1; } || true
done
echo "PASS"
```

**期望**：`PASS`。

---

### T105 [Engineer-Repo] repo layer git mv

**Files**：`tests/unit/repo/<X>.test.js`

**Description / Prompt / Acceptance / Verify**：**同 T104 結構**，把所有出現的 `service` 字串改為 `repo`（target sub-folder、grep filter、acceptance assertion 全換）。預估 row 數最多（~20 個 firebase-\* 檔）。

---

### T106 [Engineer-Runtime] runtime layer git mv

**Files**：`tests/unit/runtime/<X>.test.{js,jsx}`

**Description / Prompt / Acceptance / Verify**：**同 T104 結構**，service → runtime。注意 `.test.jsx`（hook with React，例 `useStravaActivities.test.jsx`）也算 runtime layer。

---

## Phase 1 Wave 3 — git mv 剩餘批（最多 3 並行）

> **啟動條件**：Wave 2 (T104+T105+T106) 全 PASS。
>
> **動態 dispatch**：主 agent 讀 inventory 確認 lib / api / 其他 layer 的 row 數量。若某 layer row 數 = 0 → 跳過該 task。

### T107 [Engineer-Lib] lib layer git mv

**Files**：`tests/unit/lib/<X>.test.{js,jsx}`

**Description / Prompt / Acceptance / Verify**：**同 T104 結構**，service → lib。注意 inventory 標的 `specs/021-.../test-bucket-policy.test.js` 也應該在這批（target = `tests/unit/lib/test-bucket-policy.test.js`）。

---

### T108 [Engineer-Api] api layer git mv（含建 sub-folder）

**Files**：`tests/unit/api/<X>.test.js`（**新建 sub-folder**）

**Description**：API route handler 測試（檔名 `*-route.test.js`）建議獨立 sub-folder。Phase 0 沒預先建，Wave 3 補。

**Engineer Prompt**:

> 你是 Phase 1 api layer mv engineer。
>
> 1. 先建 sub-folder：
>    ```bash
>    mkdir -p tests/unit/api
>    touch tests/unit/api/.gitkeep
>    git add tests/unit/api/.gitkeep
>    ```
> 2. `grep '| api |' specs/023-tests-directory-migration/phase-1-mv-inventory.md` 取清單
> 3. 對每筆 `git mv <source> <target>`
> 4. 驗證：
>    ```bash
>    [ -f tests/unit/api/.gitkeep ]
>    git status -s | grep -c '^R.*-> tests/unit/api/'
>    ```
>
> 若 inventory `api` row 數 = 0 → 不建 sub-folder，回報「api layer empty, skipped」。

**Acceptance Criteria**:

- [ ] 若 row 數 > 0：`tests/unit/api/.gitkeep` 已 git add（status A）
- [ ] mv 數 = inventory api row 數
- [ ] 若 row 數 = 0：跳過（回報 skipped），無新建 sub-folder

**Verify Command** (Reviewer-Api):

```bash
INV=specs/023-tests-directory-migration/phase-1-mv-inventory.md
expected=$(grep -c '| api |' "$INV")
if [ "$expected" -eq 0 ]; then
  [ -d tests/unit/api ] && echo "WARN: empty api/ created" || echo "PASS (skipped)"
  exit 0
fi
[ -f tests/unit/api/.gitkeep ] || { echo "FAIL: .gitkeep missing"; exit 1; }
moved=$(git status -s | grep -c '^R.*-> tests/unit/api/' || echo 0)
[ "$moved" -eq "$expected" ] || { echo "FAIL: moved=$moved expected=$expected"; exit 1; }
echo "PASS"
```

---

### T109 [Engineer-Other] config / components / 其他 layer git mv

**Files**：`tests/unit/{config,components,...}/`（依 inventory）

**Description**：Phase 0 已建 `tests/unit/config/`，但 inventory 若列出 `components` layer → 建新 sub-folder（同 T108 模式）。其他 layer 同理。

**Engineer Prompt**:

> 你是 Phase 1 misc layer mv engineer。處理 inventory 中**非 service / repo / runtime / lib / api** 的剩餘 row（通常是 components / config / 其他 ad-hoc layer）。
>
> 對每個非預建 layer：
>
> 1. 若 sub-folder 不存在 → `mkdir -p tests/unit/<layer> && touch tests/unit/<layer>/.gitkeep && git add tests/unit/<layer>/.gitkeep`
> 2. `grep '| <layer> |' phase-1-mv-inventory.md` 取清單
> 3. `git mv` 每筆
>
> 完成回報每個 layer 處理數與是否新建 sub-folder。
>
> 若 inventory 全部 row 都已被 T104-T108 涵蓋 → 回報「no misc layer, skipped」。

**Acceptance Criteria**:

- [ ] 若 row 數 > 0：對應 sub-folder 存在 + `.gitkeep` 已 git add
- [ ] mv 數 = inventory 對應 layer row 數
- [ ] 若 inventory row 全被 T104-T108 涵蓋：跳過，無誤建 sub-folder

**Verify Command**: 同 T108 模式，逐個 misc layer 跑。

---

## Phase 1 Wave 4 — KNOWN_S015 update（1 agent）

### T110 [Engineer-S015] policy.js KNOWN_S015 8 條 filePath 更新

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（line 177-218）

**Dependency**：T104-T109 全完成（target path 必須已實際存在於新位置才能改 filePath 對齊）

**Description**：plan.md Step 1.7。policy.js 有 8 條 KNOWN_S015 豁免，filePath 寫死舊 `specs/<NNN>/tests/unit/X.test.{js,jsx}`，Wave 2-3 mv 完後必須同步改。對照表（plan.md 已給）：

| 舊位置                                                             | 新位置（依 import 來源）                          | 共用條目數                 |
| ------------------------------------------------------------------ | ------------------------------------------------- | -------------------------- |
| `specs/009-global-toast/tests/unit/toast-context.test.jsx`         | `tests/unit/runtime/toast-context.test.jsx`       | 1                          |
| `specs/010-responsive-navbar/tests/unit/isActivePath.test.js`      | `tests/unit/lib/isActivePath.test.js`             | 4（同檔被 4 條 rule 引用） |
| `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`         | `tests/unit/components/PostCard.test.jsx`         | 2                          |
| `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx` | `tests/unit/components/PostCardSkeleton.test.jsx` | 1                          |

**Engineer Prompt**:

> 你是 Phase 1 KNOWN_S015 update engineer。
>
> 1. 讀 `specs/023-tests-directory-migration/phase-1-mv-inventory.md` 確認上述 3 個 .jsx + 1 個 .js 的實際 target path。**若 inventory target 與本 task 預設對照表不符 → 用 inventory 的，並回報差異**（可能 layer 判斷有差，例如 components 與 runtime 邊界）
> 2. 編輯 `specs/021-layered-dependency-architecture/test-buckets/policy.js` line 177-218 的 `KNOWN_S015_CONFLICTS` array
> 3. **只改 `filePath` 屬性**：8 個 entry 的 filePath 從 `'specs/.../tests/unit/X.test.jsx'` 改成對應 `'tests/unit/<layer>/X.test.jsx'`
> 4. **不動** `blockedSpecifier` / `expectedSurfaceId` / `reason` 欄位
> 5. **不動** entry 數量（仍維持 8）
> 6. **不動** bucket key（plan.md Step 1.7 註明：仍掛在 `unit` bucket key 下，**不改成** `unit-tests-root`，除非後續 Wave 5 smoke 驗證確認新路徑下豁免仍適用）
>
> 完成後跑：
>
> ```bash
> POLICY=specs/021-layered-dependency-architecture/test-buckets/policy.js
> grep -c "filePath: 'tests/unit" "$POLICY"
> # 期望：8
> grep -E "filePath: 'specs/.+/tests/unit" "$POLICY" | wc -l | tr -d ' '
> # 期望：0
> grep -c "filePath:" "$POLICY"
> # 期望：8（總 entry 數沒變）
> node -e "import('./$POLICY').then(()=>console.log('IMPORTABLE')).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
> # 期望：IMPORTABLE
> ```
>
> 回報四個 grep 數字 + IMPORTABLE 是否印出。

**Acceptance Criteria**:

- [ ] `grep -c "filePath: 'tests/unit"` = 8
- [ ] `grep -E "filePath: 'specs/.+/tests/unit"` 無命中
- [ ] 總 `filePath:` entry 數仍 = 8
- [ ] `blockedSpecifier` / `expectedSurfaceId` / `reason` 欄位 diff = 0（git diff 確認只改 filePath line）
- [ ] policy.js 仍 importable（node 動態 import 不報錯）

**Verify Command** (Reviewer-S015, `Explore` 跑):

```bash
POLICY=specs/021-layered-dependency-architecture/test-buckets/policy.js
new_count=$(grep -c "filePath: 'tests/unit" "$POLICY")
[ "$new_count" -eq 8 ] || { echo "FAIL: new filePath count=$new_count expected=8"; exit 1; }
old_count=$(grep -E "filePath: 'specs/.+/tests/unit" "$POLICY" | wc -l | tr -d ' ')
[ "$old_count" -eq 0 ] || { echo "FAIL: $old_count old filePath remain"; exit 1; }
total=$(grep -c "filePath:" "$POLICY")
[ "$total" -eq 8 ] || { echo "FAIL: total entries=$total expected=8"; exit 1; }

# diff 確認只動 filePath line
git diff "$POLICY" | grep -E '^[+-]' | grep -vE '^(---|\+\+\+|.*filePath)' | grep -v '^$' && {
  echo "FAIL: diff touched non-filePath lines"; git diff "$POLICY"; exit 1;
} || true

# importable
node -e "import('./$POLICY').then(()=>console.log('PASS')).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

**期望**：`PASS`。

> ⚠️ Bash deny fallback：若 `node -e` 被擋，reviewer 改用 source review — 確認 `import` 語句結構未被破壞、`Object.freeze` 與 array 結構閉合，視為 IMPORTABLE 等價驗證。

---

## Phase 1 Wave 5 — Smoke test（1 agent）

### T111 [Engineer-Smoke] 完整 quality gate smoke + Phase 1 specific 驗證

**Dependency**：T101-T110 全完成（worktree 含 60 個 R 標記 + vitest.config / policy.js / inventory.md 三個 M 標記 + 可能新 .gitkeep A 標記）

**Description**：跟 Phase 0 T012 同設計，分 6 區塊驗證。**主 agent 派 Engineer-Smoke 跑，主 agent 不自己跑**。

**Engineer Prompt** (派 Engineer-Smoke, `general-purpose`):

> 你是 Phase 1 Wave 5 smoke test engineer。依序跑下列 6 區塊。**任一失敗 → 不要嘗試修，回報具體哪步、stderr 摘要、推測對應 source task**。
>
> ```bash
> # ---------- Quality Gate 5 連跑 ----------
> # 1. depcruise — `unit-tests-root` bucket 啟動，KNOWN_S015 在新路徑生效
> npm run depcruise
>
> # 2. lint
> npm run lint -- --max-warnings 0
>
> # 3. type-check
> npm run type-check
>
> # 4. spellcheck
> npm run spellcheck
>
> # 5. vitest browser project（避開 g8 server emulator throw）
> npx vitest run --project=browser
>
> # 6. coverage 報告涵蓋新 src layer
> npx vitest run --project=browser --coverage 2>&1 | tail -50
> # 期望：報告 含 src/service/, src/repo/, src/runtime/, src/lib/, src/config/ 的 file 行
>
> # ---------- Phase 1 Specific 驗證 ----------
> # A. tests/unit/ 真實檔數 ≈ inventory total - KEEP（g8=2）
> find tests/unit -type f -name '*.test.*' | wc -l
> # 期望：~58
>
> # B. git log --follow 抽樣（隨機抓 1 個 service / 1 個 repo）
> git log --follow tests/unit/service/$(ls tests/unit/service/*.test.* | head -1 | xargs basename) --oneline | wc -l
> git log --follow tests/unit/repo/$(ls tests/unit/repo/*.test.* | head -1 | xargs basename) --oneline | wc -l
> # 期望：兩個都 ≥ 2（看到 mv 前的 commit）
>
> # C. 舊 specs/<NNN>/tests/unit/ 已清空（除 g8）
> find specs -path '*/tests/unit/*' -type f -not -path '*g8-server-coverage*' | wc -l
> # 期望：0
>
> # D. 8-bucket policy.js test 仍綠（Phase 0 T007 守護）
> npx vitest run tests/unit/lib/test-bucket-policy.test.js 2>&1 | tail -10
> # 期望：4 passed（4 個 it block）
> ```
>
> 6 個 quality gate + 4 個 Phase 1 specific 全綠才回報「PASS」。任一 FAIL → 回報具體哪步 + stderr 摘要 + 推測 source task：
>
> | 失敗類型                                       | 推測 source task                                               |
> | ---------------------------------------------- | -------------------------------------------------------------- |
> | depcruise 報 `unit-tests-root` violation       | T104-T109 mv 搬錯 layer，或 T110 KNOWN_S015 沒同步到           |
> | depcruise 報 `unit` bucket violation（舊位置） | inventory 漏標某檔 / mv 沒搬完                                 |
> | vitest 報 import error / module not found      | mv 後相對路徑 import 壞掉（測試檔內 `import './helper'` 之類） |
> | lint 報 colocate test in src/                  | T103 colocate exclude 沒生效                                   |
> | spellcheck 新單字                              | 加到 cspell.json，**不要 inline disable**                      |
> | coverage 沒涵蓋某 layer                        | T103 include 寫錯，或 vitest browser exclude 撞到              |
> | git log --follow 看不到歷史                    | git mv 沒被 git 識別為 rename（罕見，通常 -M 預設啟用）        |

**Acceptance Criteria**:

- [ ] 5 個 quality gate（depcruise / lint / type-check / spellcheck / vitest）全綠
- [ ] coverage 報告涵蓋 `src/{service,repo,runtime,lib,config}/**`
- [ ] `tests/unit/**/*.test.*` 數 ≈ 58（總 60 - g8 KEEP 2）
- [ ] `git log --follow` 抽樣顯示遷移前歷史
- [ ] `specs/<NNN>/tests/unit/` 已清空（g8 除外）
- [ ] `tests/unit/lib/test-bucket-policy.test.js` 4 passed（8-bucket 斷言仍綠）

**Verify Command**: 主 agent 派 Reviewer-Smoke (`Explore`) 重跑上述 10 個 check 區塊，逐個確認。

**失敗處理**（主 agent dispatch，**主 agent 不自己診斷修復**）：

| 失敗                                  | Dispatch 對象                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| depcruise `unit-tests-root` violation | Engineer-S015 (T110) 補豁免 / 對應 layer engineer (T104-T109) 重 mv                                     |
| vitest 失敗（import error）           | 對應 layer engineer，看具體檔，可能要 edit 測試檔內的相對 import（這是 mv 帶來的合理改動，可破例 edit） |
| lint / type-check 失敗                | 對應 layer engineer 看具體 rule                                                                         |
| spellcheck 新字                       | Engineer-Smoke (本身或新派 Engineer-Cspell) 加到 `cspell.json`                                          |
| coverage 沒涵蓋                       | Engineer-Vitest (T103) 重做                                                                             |
| 8-bucket test fail                    | Engineer-S015 (T110) 重做                                                                               |

---

## Phase 1 Wave 6a — Commit 1: mv + KNOWN_S015（1 agent）

> **拆 commit 設計理由**（用戶確認）：
>
> - **mv 與 KNOWN_S015 強相關**（filePath 必須跟 mv 同步，否則 commit 1 pre-commit 的 depcruise 會 fail），所以這對組合**必須同 commit**
> - **vitest.config + inventory + 新 .gitkeep** 是「coverage 觀察期」與「審計紀錄」，與 mv 解耦 → 拆到 Commit 2
> - 兩個 commit 各自 pre-commit 全綠，PR review 較容易（Commit 1 純看 mv + 豁免、Commit 2 純看 config 與紀錄）

### T112 [Engineer-Commit-Mv] Commit 1: mv + KNOWN_S015

**Dependency**：T111 全綠

**Engineer Prompt** (派 Engineer-Commit-Mv, `general-purpose`):

> 你是 Phase 1 Commit 1 engineer。**只 commit「mv + KNOWN_S015」一組**，不動 vitest.config / inventory / 新 .gitkeep（留給 Commit 2）。
>
> 1. `git status -s` 確認改動範圍。**Commit 1 該包**：
>    - 60 個 `R  specs/<NNN>/tests/unit/X.test.{js,jsx} -> tests/unit/<layer>/X.test.{js,jsx}` 標記
>    - `M  specs/021-layered-dependency-architecture/test-buckets/policy.js`（KNOWN_S015 8 條 filePath）
>
>    **Commit 1 不該包**：
>    - `M  vitest.config.mjs`（Commit 2）
>    - `A  specs/023-tests-directory-migration/phase-1-mv-inventory.md`（Commit 2）
>    - `A  tests/unit/api/.gitkeep` / `tests/unit/components/.gitkeep`（Commit 2，若 Wave 3 新建）
>    - 任何 untracked（`project-health/` / `phase-0-handoff.md` 已在 Phase 0 amend 進去）
>
> 2. **僅 add 該 commit 的內容**（其他改動暫不 stage，留給 Commit 2）：
>
>    ```bash
>    # 60 個 git mv 已自動 stage（git mv = add new + remove old），驗證一下：
>    git diff --cached --name-status -M | grep '^R' | wc -l   # 期望：60
>
>    # KNOWN_S015 加進來：
>    git add specs/021-layered-dependency-architecture/test-buckets/policy.js
>
>    # 確認沒誤 stage 別的：
>    git diff --cached --name-status -M | grep -v '^R' | grep -v 'policy.js'
>    # 期望：empty output（除 R 與 policy.js 之外不該有別的）
>    ```
>
> 3. commit 用 heredoc：
>
>    ```bash
>    git commit -m "$(cat <<'EOF'
>    refactor(tests): mv ~60 unit tests to top-level tests/unit (Phase 1 part 1)
>
>    - 60 個 unit test 從 specs/<NNN>/tests/unit/ 搬到 tests/unit/<layer>/
>    - 對照原則依測試 import 來源決定 layer (service/repo/runtime/lib/config/api/components)
>    - policy.js KNOWN_S015_CONFLICTS 8 條 filePath 同步新 tests/unit/ 位置（與 mv 同 commit 確保 depcruise 不 fail）
>    - 配置/觀察期改動（vitest.config coverage scope、inventory、新 sub-folder .gitkeep）拆到下一個 commit
>    EOF
>    )"
>    ```
>
>    **不加** `Co-Authored-By`。
>
> 4. `git log -1 --stat | tail -15` + `git status -s` 回報。`git status` 應仍顯示 vitest.config.mjs (M)、inventory.md (??)、新 .gitkeep (??) 等待下個 commit。
>
> **不要** push、不 amend Phase 0 commit、不 --no-verify。

**Acceptance Criteria**:

- [ ] Commit 1 成功（pre-commit hook 全綠）
- [ ] Commit message subject 含 `Phase 1 part 1` 與 `mv ~60 unit tests`
- [ ] **不含** `Co-Authored-By`
- [ ] `git log -1 --shortstat` 顯示 **61 個檔案變動**（60 R + 1 M policy.js）
- [ ] `git status -s` 仍顯示 vitest.config.mjs / inventory.md / 新 .gitkeep 為待 stage（確認沒誤包進 Commit 1）

**Verify Command** (Reviewer-Commit-Mv, `Explore` 跑):

```bash
# 1. message subject
git log -1 --pretty='%s' | grep -qE 'Phase 1 part 1' || { echo "FAIL: subject"; exit 1; }
git log -1 --pretty='%s' | grep -qE 'mv ~60 unit tests' || { echo "FAIL: subject mv ~60"; exit 1; }

# 2. 不含 Co-Author
git log -1 --pretty='%b' | grep -qi 'co-authored-by' && { echo "FAIL: Co-Authored-By"; exit 1; } || true

# 3. 變動檔數 = 61（60 R + 1 M policy.js）
files_changed=$(git log -1 --pretty=format: --shortstat | grep -oE '[0-9]+ files? changed' | grep -oE '^[0-9]+')
[ "$files_changed" -eq 61 ] || { echo "FAIL: files_changed=$files_changed expected=61 (60 R + 1 M policy.js)"; exit 1; }

# 4. R 標記 = 60
renames=$(git show --name-status HEAD | grep -c '^R' || echo 0)
[ "$renames" -eq 60 ] || { echo "FAIL: renames=$renames expected=60"; exit 1; }

# 5. Commit 1 不該包到 vitest.config / inventory / 新 .gitkeep
forbidden=$(git show --name-only HEAD | grep -E '(vitest\.config\.mjs|phase-1-mv-inventory\.md|tests/unit/.+/\.gitkeep)' || true)
[ -z "$forbidden" ] || { echo "FAIL: Commit 1 should not include: $forbidden"; exit 1; }

# 6. Commit 1 該含 policy.js
git show --name-only HEAD | grep -q 'specs/021-.*test-buckets/policy.js' || { echo "FAIL: policy.js not in commit"; exit 1; }

# 7. status 仍有待 stage 的（vitest.config + inventory + 可能新 .gitkeep）
remaining=$(git status -s | grep -E '(vitest\.config\.mjs|phase-1-mv-inventory\.md|tests/unit/.+/\.gitkeep)' | wc -l | tr -d ' ')
[ "$remaining" -ge 2 ] || { echo "FAIL: Commit 2 內容沒留下，remaining=$remaining"; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

## Phase 1 Wave 6b — Commit 2: vitest.config + inventory + 新 .gitkeep（1 agent）

### T113 [Engineer-Commit-Cfg] Commit 2: 配置 + 審計紀錄

**Dependency**：T112（Commit 1）已成功

**Engineer Prompt** (派 Engineer-Commit-Cfg, `general-purpose`):

> 你是 Phase 1 Commit 2 engineer。把剩下的「配置 + 觀察期 + 審計」改動 commit。
>
> 1. `git status -s` 確認剩下：
>    - `M  vitest.config.mjs`（coverage scope 擴張、thresholds 暫降 80）
>    - `A  specs/023-tests-directory-migration/phase-1-mv-inventory.md`（已被 T102 創建）
>    - 可能 `A  tests/unit/api/.gitkeep` / `A  tests/unit/components/.gitkeep`（若 Wave 3 新建 sub-folder）
>    - 不該有：60 個 R（已被 Commit 1 帶走）、policy.js M（已被 Commit 1 帶走）
> 2. 逐項 add（**不要 git add -A**，會撈到 untracked `project-health/`）：
>    ```bash
>    git add vitest.config.mjs
>    git add specs/023-tests-directory-migration/phase-1-mv-inventory.md
>    # 新 sub-folder 的 .gitkeep（若 Wave 3 創建）：
>    [ -f tests/unit/api/.gitkeep ] && git add tests/unit/api/.gitkeep
>    [ -f tests/unit/components/.gitkeep ] && git add tests/unit/components/.gitkeep
>    ```
> 3. commit 用 heredoc：
>
>    ```bash
>    git commit -m "$(cat <<'EOF'
>    chore(tests): vitest coverage scope + Phase 1 mv inventory (Phase 1 part 2)
>
>    - vitest.config.mjs coverage.include 從 src/lib/** 擴成 src/{service,repo,runtime,lib,config}/**
>    - vitest.config.mjs coverage.exclude 加 src/**/*.test.{js,jsx} 與 src/**/__tests__/**（防 colocate 誤入）
>    - vitest.config.mjs thresholds.lines 從 95 暫降 80（觀察 1-2 週後分階段提回，TODO 已標）
>    - 新增 tests/unit/api/.gitkeep / tests/unit/components/.gitkeep（若 Wave 3 創建）
>    - 新增 specs/023-tests-directory-migration/phase-1-mv-inventory.md（60 檔 mv 對照表，作為審計紀錄）
>    - tests/_placeholder.js 保留（Phase 2-3 完才移除）
>    EOF
>    )"
>    ```
>
>    **不加** `Co-Authored-By`。
>
> 4. `git log -1 --stat | tail -10` + `git log --oneline -3` 回報（看到 part 1 + part 2 兩個 commit）。`git status` 應 clean（除 untracked `project-health/`）。
>
> **不要** push。

**Acceptance Criteria**:

- [ ] Commit 2 成功（pre-commit hook 全綠）
- [ ] Commit message subject 含 `Phase 1 part 2`
- [ ] **不含** `Co-Authored-By`
- [ ] `git log -1` 顯示 vitest.config.mjs / inventory.md（最少 2 檔，最多 2-4 檔含新 .gitkeep）
- [ ] `git log --oneline -3` 顯示 part 2 / part 1 / Phase 0 三個 commit 順序
- [ ] `git status -s` clean（除 untracked `project-health/`）

**Verify Command** (Reviewer-Commit-Cfg, `Explore` 跑):

```bash
# 1. message subject
git log -1 --pretty='%s' | grep -qE 'Phase 1 part 2' || { echo "FAIL: subject"; exit 1; }

# 2. 不含 Co-Author
git log -1 --pretty='%b' | grep -qi 'co-authored-by' && { echo "FAIL: Co-Authored-By"; exit 1; } || true

# 3. Commit 2 該含 vitest.config 與 inventory，**不該含** mv 或 policy.js
git show --name-only HEAD | grep -q '^vitest\.config\.mjs$' || { echo "FAIL: vitest.config missing"; exit 1; }
git show --name-only HEAD | grep -q 'phase-1-mv-inventory\.md$' || { echo "FAIL: inventory missing"; exit 1; }

forbidden=$(git show --name-only HEAD | grep -E '(test-buckets/policy\.js|tests/unit/[a-z]+/[A-Za-z].+\.test\.)' || true)
[ -z "$forbidden" ] || { echo "FAIL: Commit 2 should not include: $forbidden"; exit 1; }

# 4. log --oneline 順序
git log --oneline -3 | head -1 | grep -qE 'Phase 1 part 2' || { echo "FAIL: HEAD~0 not part 2"; exit 1; }
git log --oneline -3 | sed -n '2p' | grep -qE 'Phase 1 part 1' || { echo "FAIL: HEAD~1 not part 1"; exit 1; }
git log --oneline -3 | sed -n '3p' | grep -qE 'phase 0 quality-gate prep' || { echo "FAIL: HEAD~2 not Phase 0"; exit 1; }

# 5. status clean
remaining=$(git status -s | grep -v '^?? project-health/' | wc -l | tr -d ' ')
[ "$remaining" -eq 0 ] || { echo "FAIL: dirty working tree, remaining=$remaining"; git status -s; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

## Phase 1 Wave 7 — User PR（manual）

### T114 [User] push + open PR + 24h 觀察

**Description**：T112 + T113 兩 commit 完後 user 親跑（涉及 push 到 remote — destructive 程度需 user confirm）。兩 commit 同一個 PR（Phase 1 是邏輯整體，不分 PR）。

```bash
git push origin 023-tests-directory-migration
gh pr create --title "refactor(tests): Phase 1 migrate unit tests" --body "$(cat <<'EOF'
## Summary
- 60 個 unit test 從 specs/<NNN>/tests/unit/ 搬到 tests/unit/<layer>/
- vitest.config.mjs coverage scope 擴大、thresholds.lines 暫降 80（觀察期）
- policy.js KNOWN_S015_CONFLICTS 8 條 filePath 同步
- inventory: specs/023-tests-directory-migration/phase-1-mv-inventory.md

## Test plan
- [x] depcruise / lint / type-check / spellcheck / vitest --project=browser 全綠
- [x] coverage 涵蓋 src/{service,repo,runtime,lib,config}/**
- [x] git log --follow 看到搬遷前歷史
- [x] specs/<NNN>/tests/unit/ 已清空（g8 server 除外）
- [x] tests/unit/lib/test-bucket-policy.test.js 8-bucket 斷言仍綠
- [ ] main merge 後 24h 無 CI 紅
EOF
)"
```

**Acceptance**:

- [ ] PR 通過 review
- [ ] CI 全綠
- [ ] merge 後 main 觀察 24h 無 regression
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) Verification Checklist「Phase 1 完成」全部 `[x]`

---

## Phase 1 執行 SOP

### Step 0：Wave 0 gate check（派 Reviewer）

主 agent **派 Reviewer-Bootstrap**（`Explore`）跑 T101 五個檢查。**FAIL → STOP，escalate user**。PASS 才進 Step 1。

### Step 1：Wave 1（並行 2 agents）

主 agent **單一 message** 派：

```
Agent-Inventory (general-purpose):
  "執行 T102（產出 phase-1-mv-inventory.md）。完成後跑 row count + total 自我驗證。"

Agent-Vitest (general-purpose):
  "執行 T103（vitest.config.mjs coverage 擴張）。完成後跑 import smoke 自我驗證。"
```

完成後 **單一 message** 派：

```
Reviewer-Inventory (Explore): "驗 T102 verify command。"
Reviewer-Vitest (Explore): "驗 T103 verify command。Bash deny → fallback grep source review。"
```

任一 FAIL → 主 agent 透過 SendMessage 把 reviewer feedback 傳回原 engineer 修正 → 重派 reviewer。重試上限 3。

### Step 2：Wave 2（並行 3 agents）

T102 + T103 雙 PASS 後，主 agent **Read** `phase-1-mv-inventory.md` 確認 service / repo / runtime row 數都 > 0，然後 **單一 message** 派：

```
Agent-Service (general-purpose):  "T104 service layer mv ..."
Agent-Repo    (general-purpose):  "T105 repo layer mv ..."
Agent-Runtime (general-purpose):  "T106 runtime layer mv ..."
```

完成後配對 3 個 Reviewers（Explore）。FAIL 處理同 Step 1。

### Step 3：Wave 3（最多 3 並行，依 inventory 而定）

主 agent 讀 inventory 確認 lib / api / 其他 layer row 數：

- 若 lib > 0 → 派 Agent-Lib (T107)
- 若 api > 0 → 派 Agent-Api (T108)
- 若有其他 layer (components / config / 其他) → 派 Agent-Other (T109)

最多 3 個並行。row 數 = 0 的 task 直接 skip（不派）。配對 reviewers。

### Step 4：Wave 4 KNOWN_S015（1 agent）

主 agent 派 Agent-S015 跑 T110，配對 Reviewer-S015。

### Step 5：Wave 5 smoke（1 agent，集中 verify 點）

主 agent 派 Engineer-Smoke 跑 T111 的 10 個 check。配對 Reviewer-Smoke 重跑。

任一失敗 → 依 T111 失敗處理表 dispatch 對應 wave engineer 修，**主 agent 不自己診斷**。修完重跑 Wave 5。

### Step 6a：Wave 6a Commit 1（1 agent）

主 agent 派 Engineer-Commit-Mv 跑 T112（mv + KNOWN_S015）。配對 Reviewer-Commit-Mv 跑 7 個 verify check。**Reviewer FAIL → 主 agent 透過 SendMessage 把具體 feedback 傳回 Engineer-Commit-Mv 修**。修完再驗，重試上限 3 次。

### Step 6b：Wave 6b Commit 2（1 agent）

T112 PASS 後立即派 Engineer-Commit-Cfg 跑 T113（vitest.config + inventory + 新 .gitkeep）。配對 Reviewer-Commit-Cfg 跑 5 個 verify check。注意：T113 dependency 是 T112 已成功（git log 看到 part 1）；若 T112 失敗 / 還未 PASS → 不啟動 T113。

### Step 7：Wave 7 PR（user manual）

主 agent 通報「Phase 1 commit 完成（part 1 sha: <X>, part 2 sha: <Y>），可開 PR」+ 提供 T114 範本給 user 複製貼上。**主 agent 不自己跑 push / gh**。

### 主 agent 全程紀律

從頭到尾**不跑** `npm` / `node` / `git mv` / `git add` / `git commit` / `git push` / `mkdir` / `gh` 命令。`Read` 純讀檔（含 inventory）允許；`git status` / `find` 等 query Bash 「優先派 Reviewer」。

---

## Phase 1 失敗回滾

任一 wave 完成度低於 100%（reviewer 持續 FAIL ≥ 3 次）→ 主 agent **立即 STOP + escalate user**，不派 subagent 跑回滾命令（涉及 destructive 操作）。

回滾命令給 user 親跑（依失敗時點）：

### Wave 2-3 中途失敗（mv 已開始，commit 尚未下）

```bash
# user 親跑（worktree at dive-into-run-023-tests-directory-migration/）
git restore --staged .                                    # unstage 所有 git mv
git restore .                                              # 把 mv 過的檔還原（git mv = del+add，需 restore 才回復）
# 確認新建 sub-folder 是否要砍：
git clean -nfd tests/unit/api tests/unit/components 2>/dev/null   # dry-run 看會刪什麼
git clean -fd tests/unit/api tests/unit/components 2>/dev/null    # 實際刪（destructive，user confirm）
# 確認回到 Phase 0 head
git log -1 --pretty='%h %s'   # 期望：commit message 含 'phase 0 quality-gate prep'（sha 因 amend 可能變動，不寫死）
git status -s                  # 期望：empty + untracked project-health/
```

### Wave 6a Commit 1 後失敗（part 1 已下，part 2 尚未 commit）

```bash
# 退 commit 1 但保留改動
git reset --soft HEAD~1
# 此時所有 mv 與 policy.js 變動回到 staged，可重新跑 T112 修問題後重 commit
```

### Wave 6b Commit 2 後失敗（part 1+2 都已下，push 未做）

```bash
# 退兩個 commit 但保留改動
git reset --soft HEAD~2
# 或全砍回 Phase 0 head（destructive，user confirm）
PHASE0_HEAD=$(git log --grep='phase 0 quality-gate prep' --pretty='%H' | head -1)
git reset --hard "$PHASE0_HEAD"
```

### Wave 7 push 後失敗（PR 已開，CI 紅）

```bash
# fix-forward 優先：派 Engineer 修問題 + 新 commit + push
# 若必須撤銷：用 git revert（不要 force push）
git revert HEAD
git push origin 023-tests-directory-migration
```

**force push 一律 destructive — user 必須親跑且明確 confirm。**

---

## Phase 1 完成判準（總體）

- [ ] T101-T114 全 PASS（含 Wave 6 拆 T112 + T113 兩 commit）
- [ ] PR opened + merged + main 24h 無 CI 紅
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) Verification Checklist「Phase 1 完成」全部 `[x]`：
  - [ ] `npm run depcruise` 全綠 — `unit-tests-root` bucket 啟動，src/service/X.test.js 試 import src/components/Y.jsx 應 fail
  - [ ] `npm run test` 全綠
  - [ ] coverage 報告涵蓋 `src/{service,repo,runtime,lib,config}/**`
  - [ ] VS Code 開 src/service/event-service.js cmd+T 找到 tests/unit/service/event-service-rules.test.js
  - [ ] `git log tests/unit/service/event-service-rules.test.js --follow` 看到原 specs/021 路徑歷史
- [ ] tests/\_placeholder.js 仍保留（Phase 2-3 完才移除，per Phase 0 handoff §「給下個 session 的 Phase 1-3 注意事項」第 2 條）
