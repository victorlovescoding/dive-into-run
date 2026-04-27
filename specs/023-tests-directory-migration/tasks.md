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

**Files**：新建 `specs/023-tests-directory-migration/migration-inventory.md`

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

> 你是 Phase 1 inventory engineer。產出 `specs/023-tests-directory-migration/migration-inventory.md`，markdown table 結構：
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
> rows=$(grep -c '^| [0-9]' specs/023-tests-directory-migration/migration-inventory.md)
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
INV=specs/023-tests-directory-migration/migration-inventory.md
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

> **啟動條件**：T102 + T103 雙 PASS。主 agent **讀**（Read）`migration-inventory.md` 確認 service / repo / runtime 三 layer 都有 row。
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
> 1. `cat specs/023-tests-directory-migration/migration-inventory.md | grep '| service |'` 取得待搬清單
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
INV=specs/023-tests-directory-migration/migration-inventory.md
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
> 2. `grep '| api |' specs/023-tests-directory-migration/migration-inventory.md` 取清單
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
INV=specs/023-tests-directory-migration/migration-inventory.md
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
> 2. `grep '| <layer> |' migration-inventory.md` 取清單
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
> 1. 讀 `specs/023-tests-directory-migration/migration-inventory.md` 確認上述 3 個 .jsx + 1 個 .js 的實際 target path。**若 inventory target 與本 task 預設對照表不符 → 用 inventory 的，並回報差異**（可能 layer 判斷有差，例如 components 與 runtime 邊界）
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
>    - `A  specs/023-tests-directory-migration/migration-inventory.md`（Commit 2）
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
forbidden=$(git show --name-only HEAD | grep -E '(vitest\.config\.mjs|migration-inventory\.md|tests/unit/.+/\.gitkeep)' || true)
[ -z "$forbidden" ] || { echo "FAIL: Commit 1 should not include: $forbidden"; exit 1; }

# 6. Commit 1 該含 policy.js
git show --name-only HEAD | grep -q 'specs/021-.*test-buckets/policy.js' || { echo "FAIL: policy.js not in commit"; exit 1; }

# 7. status 仍有待 stage 的（vitest.config + inventory + 可能新 .gitkeep）
remaining=$(git status -s | grep -E '(vitest\.config\.mjs|migration-inventory\.md|tests/unit/.+/\.gitkeep)' | wc -l | tr -d ' ')
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
>    - `A  specs/023-tests-directory-migration/migration-inventory.md`（已被 T102 創建）
>    - 可能 `A  tests/unit/api/.gitkeep` / `A  tests/unit/components/.gitkeep`（若 Wave 3 新建 sub-folder）
>    - 不該有：60 個 R（已被 Commit 1 帶走）、policy.js M（已被 Commit 1 帶走）
> 2. 逐項 add（**不要 git add -A**，會撈到 untracked `project-health/`）：
>    ```bash
>    git add vitest.config.mjs
>    git add specs/023-tests-directory-migration/migration-inventory.md
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
>    - 新增 specs/023-tests-directory-migration/migration-inventory.md（60 檔 mv 對照表，作為審計紀錄）
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
git show --name-only HEAD | grep -q 'migration-inventory\.md$' || { echo "FAIL: inventory missing"; exit 1; }

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
- inventory: specs/023-tests-directory-migration/migration-inventory.md

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
  "執行 T102（產出 migration-inventory.md）。完成後跑 row count + total 自我驗證。"

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

T102 + T103 雙 PASS 後，主 agent **Read** `migration-inventory.md` 確認 service / repo / runtime row 數都 > 0，然後 **單一 message** 派：

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

- [ ] T101-T113 全 PASS（含 Wave 6 拆 T112 + T113 兩 commit；T114 user manual cancel）
- [ ] PR opened + merged + main 24h 無 CI 紅
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) Verification Checklist「Phase 1 完成」全部 `[x]`：
  - [ ] `npm run depcruise` 全綠 — `unit-tests-root` bucket 啟動，src/service/X.test.js 試 import src/components/Y.jsx 應 fail
  - [ ] `npm run test` 全綠
  - [ ] coverage 報告涵蓋 `src/{service,repo,runtime,lib,config}/**`
  - [ ] VS Code 開 src/service/event-service.js cmd+T 找到 tests/unit/service/event-service-rules.test.js
  - [ ] `git log tests/unit/service/event-service-rules.test.js --follow` 看到原 specs/021 路徑歷史
- [ ] tests/\_placeholder.js 仍保留（Phase 2-3 完才移除，per Phase 0 handoff §「給下個 session 的 Phase 1-3 注意事項」第 2 條）

---

# Phase 2 Tasks: Integration Tests 遷移（~65 檔）

> **狀態**：規劃中（2026-04-27 加入），**尚未實作**。
> **前提（gate）**：Phase 1 commit 已落地（per [`./migration-handoff.md`](./migration-handoff.md)）。Phase 0/1 commit 目前 user 選擇不 push，Phase 2 接續同 branch、sha 不寫死，gate check 用 `git log --grep` 動態抓最新 head。
> **Spec folder**：`specs/023-tests-directory-migration/`（同 Phase 0/1）
> **Branch**：`023-tests-directory-migration`（沿用，不另開 sub-branch；commit 接在 Phase 1 head 之後）
> **預估工期**：2-3 天（含 domain 分組決策）
> **總任務數**：14（T201-T214；Wave 6 拆 Commit 1 + Commit 2）
> **參考**：parent 藍圖 [`./plan.md`](./plan.md) Phase 2 段（Step 2.1-2.4）；[`./migration-handoff.md`](./migration-handoff.md) Phase 0/1 archive；[`./migration-inventory.md`](./migration-inventory.md) Phase 1 Inventory + Handoff Highlights（Phase 2 Inventory 為 placeholder，T202 / T213 填入）

---

## 並行策略總覽（Phase 2）

### 同時最多 3 對 worker-reviewer（瞬時 6 active subagents）

沿用 Phase 0/1 上限。為何 3 對：

- 3 個 domain 並行 git mv 不會撞（domain sub-folder 各自獨立、檔案無交集）
- 主 agent context 同時管 3 對 worker-reviewer 是合理上限
- mv 操作互不依賴（除 inventory 必須先決定 domain 分組 → Wave 1 完才啟 Wave 2）

### 主 Agent 角色邊界（Non-Negotiable，**重申**）

主 agent 從頭到尾**純粹 orchestrator**，包含後續修改循環。

| 動作                                                         | 主 Agent                     | 備註                                   |
| ------------------------------------------------------------ | ---------------------------- | -------------------------------------- |
| `Agent` 派 sub-agents                                        | ✅                           | 唯一執行手段                           |
| `SendMessage` 帶 reviewer feedback 重派 worker               | ✅                           | 失敗循環關鍵                           |
| `Read` 讀檔（含 inventory）                                  | ✅                           | 只讀                                   |
| `TaskCreate` / `TaskUpdate`                                  | ✅                           | 不影響 repo                            |
| 與 user 對話、escalate                                       | ✅                           |                                        |
| `Edit` / `Write` 動檔                                        | ❌                           | **絕對禁止** — 派 engineer subagent 做 |
| `Bash` 跑 `git mv` / `npm` / `node` / `mkdir` 等 mutate 命令 | ❌                           | **絕對禁止** — 派 subagent 做          |
| `Bash` 跑純 query 命令（`git status` / `find`）              | ⚠️ 可，但**優先派 Reviewer** | 罕用                                   |

**Phase 0/1 經驗繼承**（[`./migration-handoff.md`](./migration-handoff.md)）：

- ✅ Phase 1 已驗證 subagent Bash (`node -e` / `npm run *` / `git mv` / `vitest`) **不再被 deny**（Phase 0 阻塞已自然解除）。Phase 2 各 wave 可放心派 reviewer 跑 runtime verify，不需集中到 Wave 5
- ⚠️ T203（handbook 在 `.claude/references/`）有可能踩到 Phase 0 那條「subagent 對 `.claude/**` 寫入結構性 deny」。先派 engineer 試一次小 Edit 驗證 hot-reload；若仍擋，escalate user 走 C 路徑（user 親跑或主 agent 一次例外）
- ⚠️ Phase 1 踩坑：`git mv` 不改檔內 import path，type-check 是早期警報；Wave 5 smoke 一定排 type-check 在最前面
- ⚠️ Phase 1 踩坑：staged 檔被後續 edit 不會自動 re-stage，commit subagent prompt 要 require「stage 後 + commit 前再跑一次 `git add`」
- 重試上限：reviewer 持續 FAIL ≥ 3 次 → 主 agent 立即 STOP + escalate user

### Engineer / Reviewer 配對機制

- **Engineer subagent**：`general-purpose`（Edit / Write / Bash 完整工具）
- **Reviewer subagent**：`Explore`（Read + Bash query；read-only，無 Edit/Write）
- 配對：每 task 派完 engineer 後、立即派配對 reviewer 驗收。reviewer FAIL → 主 agent 透過 SendMessage 把具體 feedback 傳給原 engineer，命其修正 → 重派 reviewer → 至 PASS

---

## 依賴圖（Phase 2）

```
Wave 0 (gate, 1 reviewer):
  └─ Reviewer-Bootstrap-P2: T201            (前置條件確認)
                                             │
Wave 1 (2 並行 worker-reviewer):             │
  ├─ Engineer-Inventory-P2: T202            (~65 檔 source/domain 對照表)
  └─ Engineer-Handbook-P2:  T203            (testing-handbook.md domain 補述)
                                             │
Wave 2 (3 並行 worker-reviewer):             │
  ├─ Engineer-Events-P2:        T204        (events domain mv)
  ├─ Engineer-Posts-P2:         T205        (posts domain mv)
  └─ Engineer-Notifications-P2: T206        (notifications domain mv)
                                             │
Wave 3 (3 並行 worker-reviewer):             │
  ├─ Engineer-Strava-P2:  T207              (strava domain mv)
  ├─ Engineer-Profile-P2: T208              (profile domain mv)
  └─ Engineer-Weather-P2: T209              (weather domain mv)
                                             │
Wave 4 (≤3 並行，動態 dispatch):             │
  └─ Engineer-Misc-P2:    T210              (dashboard / navbar / toast / comments / fix / share / map)
                                             │
Wave 5 (1 worker-reviewer):                  │
  └─ Engineer-Smoke-P2:   T211              (5 quality gate + Phase 2 specific 驗證)
                                             │
Wave 6a (1 worker-reviewer):                 │
  └─ Engineer-Commit-Mv-P2:  T212           (commit 1: ~65 mv + handbook)
                                             │
Wave 6b (1 worker-reviewer):                 │
  └─ Engineer-Commit-Cfg-P2: T213           (commit 2: inventory Phase 2 段填入 + handoff highlights + 新 .gitkeep)
                                             │
Wave 7 (manual):                             │
  └─ User: T214                             (push + open PR + 24h 觀察)
```

---

## Phase 2 Wave 0 — 前置確認（gate only，不動工）

### T201 [Reviewer-Bootstrap-P2] 前置條件確認

**Files**：純讀取，不動

**Description**：Phase 2 開工硬性 gate。Phase 1 commit 必須已存在於 branch head；worktree 必須 clean；`tests/integration/` 必須仍是空殼（除 `.gitkeep` / `_placeholder.js`）。

**Engineer Prompt**: 無（reviewer-only task）

**Reviewer Prompt** (派 Reviewer-Bootstrap-P2, `Explore`):

> 你是 Phase 2 開工 gate 檢查 reviewer。依序跑下列 5 步，**全 PASS** 才回報「APPROVE — Phase 2 可開工」。任一 FAIL → 列出原因 escalate user，**不嘗試修**。
>
> ```bash
> cd /Users/chentzuyu/Desktop/dive-into-run-023-tests-directory-migration
>
> # 1. worktree clean check
> git status --porcelain
> # 期望：empty 或只剩 untracked `project-health/` / `.claude/scheduled_tasks.lock`
> # FAIL 條件：有 modified（M）/ added（A）/ renamed（R）標記的 tracked 檔
>
> # 2. branch
> git branch --show-current
> # 期望：023-tests-directory-migration
>
> # 3. Phase 1 head 存在
> PHASE1_HEAD=$(git log --grep='Phase 1 part 2' --pretty='%H' | head -1)
> [ -n "$PHASE1_HEAD" ] || { echo "FAIL 3: no Phase 1 commit found"; exit 1; }
> echo "Phase 1 head: $PHASE1_HEAD"
>
> # 4. migration-inventory.md 已 rename（舊檔不存在、新檔存在）
> [ ! -f specs/023-tests-directory-migration/phase-1-mv-inventory.md ] || { echo "FAIL 4: old inventory file still exists"; exit 1; }
> [ -f specs/023-tests-directory-migration/migration-inventory.md ] || { echo "FAIL 4: migration-inventory.md missing"; exit 1; }
>
> # 5. tests/integration/ 仍空（除 .gitkeep / placeholder）
> integration_files=$(find tests/integration -type f -not -name '.gitkeep' -not -name '_placeholder.js' 2>/dev/null | wc -l | tr -d ' ')
> [ "$integration_files" -eq 0 ] || { echo "FAIL 5: tests/integration already has $integration_files real files"; exit 1; }
> ```
>
> 全部 PASS 才 APPROVE。任一 FAIL：回報具體哪步、實際 output、推測原因（Phase 1 沒 commit / inventory 沒 rename / tests/integration 已被別人動過），**stop**。

**Acceptance Criteria**:

- [ ] worktree 無 modified tracked 檔
- [ ] branch = `023-tests-directory-migration`
- [ ] Phase 1 commit (subject 含 'Phase 1 part 2') 存在於 git log
- [ ] `specs/023-tests-directory-migration/migration-inventory.md` 存在；舊 `phase-1-mv-inventory.md` 不存在
- [ ] `tests/integration/` 不含真實測試檔

**失敗處理**：任一步 FAIL → 主 agent **不啟 Wave 1**，escalate user：

- worktree dirty → user 親跑 `git status` 確認、決定 stash / commit / restore
- Phase 1 commit 缺 → 跳回 Phase 1 確認落地（檢查 Phase 1 是否已 commit）
- inventory 沒 rename → 補跑 Phase 2 規劃 commit 的 rename step
- tests/integration 已動過 → user 確認來源、決定 git restore 或併入

---

## Phase 2 Wave 1 — Inventory + Handbook（並行 2 agents）

### T202 [Engineer-Inventory-P2] ~65 個 integration test source/domain 對照表

**Files**：`specs/023-tests-directory-migration/migration-inventory.md`（**Phase 2 Inventory 段**，現為 placeholder block quote — 改寫為實際 inventory table）

**Description**：產出每個 integration test 的「source path → domain → target path → 主要被測 import 證據」對照，作為 Wave 2-4 的執行依據。Engineer **不動任何測試檔**（不 git mv、不 edit），只填 migration-inventory.md Phase 2 Inventory 段 markdown table。

**Domain 對應規則（嚴格）**：

| 主要被測 import 來源 / 檔名特徵                                                          | Target sub-folder                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------- |
| `@/components/Event*` / 檔名 `Event*` / `EventActionButtons` / `EventsPage`              | `tests/integration/events/`        |
| `@/components/Post*` / 檔名 `Post*` / `Compose*` / `*post*`                              | `tests/integration/posts/`         |
| `@/components/*Comment*` / 檔名 `*Comment*` / `comment*` / `scroll-to-comment`           | `tests/integration/comments/`      |
| `@/components/Notification*` / 檔名 `Notification*` / `notification*` / `*-notification` | `tests/integration/notifications/` |
| `@/components/Runs*` / 檔名 `Runs*` / `Callback*` / `useStravaSync` / `useStrava*`       | `tests/integration/strava/`        |
| `@/components/Dashboard*` / 檔名 `Dashboard*` / `useDashboardTab`                        | `tests/integration/dashboard/`     |
| `@/components/Toast*` / 檔名 `toast-*`                                                   | `tests/integration/toast/`         |
| `@/components/Navbar*` / 檔名 `Navbar*` / `isActivePath`                                 | `tests/integration/navbar/`        |
| `@/components/Profile*` / 檔名 `Profile*` / `Bio*` / `UserLink`                          | `tests/integration/profile/`       |
| `@/runtime/...weather...` / 檔名 `weather*` / `favorites` / `township-drilldown`         | `tests/integration/weather/`       |

**邊界曖昧 case 處理**：

- 主要被測 component import 來源**優先於**檔名前綴（例：`scroll-to-comment.test.jsx` 在 014 spec 但 import `@/components/notifications/X` → notifications）
- 邊界仍曖昧 → engineer 標 Notes 說明選了哪邊與**為何選**，**不主動跨 domain split**（保持 1 row 1 target）
- `placeholder.test.jsx`（003/lib-firebase-events）→ 若是空檔/僅 smoke → 標 Notes `placeholder, may DUP_DELETE`，target 暫掛 `events`
- `RunCalendarDialog.test.jsx`（008 run-calendar）→ 主要 import `@/components/Runs*` 或 `@/components/Calendar*` → 依實際 import 決定 strava 或 events
- `ShareButton.test.jsx`（011 event-share-og）→ import `@/components/Event*` 或 `@/components/Share*` → 依實際 import 決定 events 或新建 `share` domain

**特殊 case**：

- 不存在「KEEP IN PLACE」的 integration test（不像 Phase 1 g8-server-coverage）— 全部 65 檔都搬
- 003 的 3 個 sub-folder source 路徑（`003-strict-type-fixes/app-events-page/` / `lib-firebase-events/` / `refactor-events-page/`）→ flatten 到 `tests/integration/<domain>/<filename>.test.jsx`，重名衝突按 Phase 1 體例處理（spec 編號 tag）

**Engineer Prompt**:

> 你是 Phase 2 inventory engineer。在 `specs/023-tests-directory-migration/migration-inventory.md` 的「Phase 2 Inventory（integration tests）」段（現為 placeholder block quote），改寫為實際 markdown table。
>
> Table schema：
>
> ```markdown
> | #   | Source Path                                                                       | Domain | Target Path                                  | Main Import Evidence                               | Notes |
> | --- | --------------------------------------------------------------------------------- | ------ | -------------------------------------------- | -------------------------------------------------- | ----- |
> | 1   | specs/003-strict-type-fixes/app-events-page/tests/integration/EventsPage.test.jsx | events | tests/integration/events/EventsPage.test.jsx | `import { ... } from '@/app/events/page'` (line N) |       |
> | ... | ...                                                                               | ...    | ...                                          | ...                                                | ...   |
>
> ## Summary
>
> Total: ~65 | events: a | posts: b | comments: c | notifications: d | strava: e | dashboard: f | toast: g | navbar: h | profile: i | weather: j | misc: k
> ```
>
> 執行步驟：
>
> 1. `find specs -path '*/tests/integration/*.test.*' -type f | sort` 列全部
> 2. 對每個檔 `head -30 <file>` 抓 import；找出**主要被測** import：
>    - 通常是配 `vi.mock('@/components/<X>')` 的那個（integration test 通常 mock service/runtime 並渲染真實 component）
>    - 或是 `import <Component> from '@/components/<X>'`（非 helper / 非 testing-library）
> 3. 套「Domain 對應規則」決定 target sub-folder
> 4. **重名衝突**：若不同 source 對應同 target name（例：009 與 014 都有 `NotificationToast.test.jsx`?）：
>    - 比對內容差異 (`diff` 或 head)。完全相同 → 保留**最新的 spec 編號**那個（target = 原檔名），舊的標 Notes: `DUP_DELETE — content identical to <newer-source>，待主 agent 確認後 git rm`
>    - 內容不同 → 舊的 target = `<X>-<NNN-tag>.test.jsx`（例 `NotificationToast-014.test.jsx`），標 Notes 說明
> 5. **不要**動任何測試檔（不 git mv、不 edit、不 rm）；只動 `migration-inventory.md` Phase 2 Inventory 段
>
> 完成後跑：
>
> ```bash
> # 自我驗證 row 數
> rows=$(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' specs/023-tests-directory-migration/migration-inventory.md | grep -c '^| [0-9]')
> total=$(find specs -path '*/tests/integration/*.test.*' -type f | wc -l | tr -d ' ')
> echo "rows=$rows total=$total"   # 期望：rows == total
> ```
>
> 回報「N rows produced, k DUP_DELETE flagged, j ambiguous-domain notes」+ 完整 Summary 行。

**Acceptance Criteria**:

- [ ] migration-inventory.md「Phase 2 Inventory」段不再是 placeholder（含 markdown table）
- [ ] row 數 = `find specs -path '*/tests/integration/*.test.*' -type f | wc -l`（預估 65）
- [ ] 每筆 target path 以 `tests/integration/` 開頭
- [ ] 同一 domain 內 target name 全 unique
- [ ] 每筆 Main Import Evidence 含具體 import 字串（非空、含 `@/` 或具體模組名）
- [ ] Summary 行各 domain 加總 = total

**Verify Command** (Reviewer-Inventory-P2, `Explore` 跑):

```bash
INV=specs/023-tests-directory-migration/migration-inventory.md
[ -f "$INV" ] || { echo "FAIL: inventory missing"; exit 1; }

# 1. Phase 2 Inventory 段不再是 placeholder
grep -A 2 '^## Phase 2 Inventory' "$INV" | grep -q '_待 Phase 2 Wave 1' && { echo "FAIL: Phase 2 Inventory still placeholder"; exit 1; }

# 2. row 數對齊 find
expected=$(find specs -path '*/tests/integration/*.test.*' -type f | wc -l | tr -d ' ')
rows=$(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' "$INV" | grep -c '^| [0-9]')
[ "$rows" -eq "$expected" ] || { echo "FAIL: rows=$rows expected=$expected"; exit 1; }

# 3. target unique
dup=$(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' "$INV" | grep -oE '\| tests/integration/[a-z-]+/[A-Za-z0-9._-]+\.test\.[a-z]+' | sort | uniq -d)
[ -z "$dup" ] || { echo "FAIL: duplicate targets:"; echo "$dup"; exit 1; }

# 4. 每筆有 import 證據
weak=$(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' "$INV" | awk -F'|' 'NR>2 && /\.test\./ && (NF<6 || $5 ~ /^ *$/) {print NR}')
[ -z "$weak" ] || { echo "FAIL: rows missing import evidence: $weak"; exit 1; }

# 5. Summary 行存在
grep -E '^Total: [0-9]+ \| events:' "$INV" || { echo "FAIL: no Summary line"; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

### T203 [Engineer-Handbook-P2] testing-handbook.md domain section 補述

**Files**：`.claude/references/testing-handbook.md`（line 46-59 / 103 / 185 / 204 / 263 / 498 範例路徑；具體 line 範圍由 engineer 跑 `grep -n 'specs/.*tests/integration' .claude/references/testing-handbook.md` 取得實際命中行）

**Description**：parent plan.md Step 2.3。把 testing-handbook 的 integration test 範例路徑從 `specs/<feature>/tests/integration/` 改成 `tests/integration/<domain>/`，並加註 Phase 2 並存期說明（與 Phase 0 testing-standards.md 並存期描述體例一致）。

**Engineer Prompt**:

> 你是 Phase 2 handbook engineer。
>
> 1. 先確認 subagent 對 `.claude/**` 寫入是否仍 deny（Phase 0 handoff 警告）：
>    ```bash
>    echo "test" > /tmp/handbook-write-check.tmp && rm /tmp/handbook-write-check.tmp
>    # 真正 test：對 .claude/references/testing-handbook.md 跑一個 trivial Edit（加空白 + 立刻撤銷），看是否被 deny
>    ```
>    如被 deny → 立刻 STOP 回報「subagent .claude/\*\* Edit 仍 deny，需 user 走 C 路徑（用戶親跑或主 agent 一次例外）」
> 2. 若可寫，跑 `grep -n -E 'specs/.+/tests/integration' .claude/references/testing-handbook.md` 列出所有命中行（plan.md 估 line 46-59 / 103 / 185 / 204 / 263 / 498，實際以 grep 為準）
> 3. 對每個命中行用 Edit 改：
>    - `specs/<feature>/tests/integration/X.test.jsx` → `tests/integration/<domain>/X.test.jsx`
>    - 範例若有具體 spec 編號（例 `specs/014-notification-system/`）→ 改成對應 domain（例 `notifications`）
> 4. 在「目錄慣例」段（line 46-59 附近）開頭加並存期說明（一個 block quote）：
>    ```markdown
>    > **並存期說明**（Phase 2 進行中 → 完成後移除）：
>    > 新增 integration test 一律放 `tests/integration/<domain>/`；Phase 2 完成後 `specs/<feature>/tests/integration/` 已清空，僅 git history 保留追溯。
>    ```
> 5. **不動** unit / e2e 段落（unit 已 Phase 1 完成、e2e 留 Phase 3）
>
> 完成後跑：
>
> ```bash
> # 殘留舊路徑引用 = 0
> remain=$(grep -c -E 'specs/.+/tests/integration' .claude/references/testing-handbook.md)
> [ "$remain" -eq 0 ] || { echo "FAIL: $remain old refs remain"; grep -n -E 'specs/.+/tests/integration' .claude/references/testing-handbook.md; exit 1; }
> # 新路徑引用 ≥ 6
> new=$(grep -c -E 'tests/integration/[a-z-]+/' .claude/references/testing-handbook.md)
> [ "$new" -ge 6 ] || { echo "FAIL: only $new new refs"; exit 1; }
> # 並存期說明存在
> grep -q '並存期說明' .claude/references/testing-handbook.md || { echo "FAIL: no 並存期 description"; exit 1; }
> echo "PASS"
> ```

**Acceptance Criteria**:

- [ ] `.claude/references/testing-handbook.md` 內 `specs/<feature>/tests/integration/` 字串 0 命中
- [ ] `tests/integration/<domain>/` 範例路徑 ≥ 6 處
- [ ] 加入「並存期說明」block quote
- [ ] **不動** unit / e2e 段落（diff 確認）
- [ ] 不 commit

**Verify Command** (Reviewer-Handbook-P2, `Explore` 跑):

```bash
HBK=.claude/references/testing-handbook.md
remain=$(grep -c -E 'specs/.+/tests/integration' "$HBK")
[ "$remain" -eq 0 ] || { echo "FAIL: $remain old refs"; grep -n -E 'specs/.+/tests/integration' "$HBK"; exit 1; }
new=$(grep -c -E 'tests/integration/[a-z-]+/' "$HBK")
[ "$new" -ge 6 ] || { echo "FAIL: only $new new refs"; exit 1; }
grep -q '並存期說明' "$HBK" || { echo "FAIL: no 並存期"; exit 1; }
# 確認 unit / e2e 段沒被誤動
git diff "$HBK" | grep -E '^[+-]' | grep -E 'tests/unit|tests/e2e' && { echo "FAIL: unit/e2e sections touched"; exit 1; } || true
echo "PASS"
```

**期望**：`PASS`。

⚠️ **Phase 0 handoff 警告**：subagent 對 `.claude/**` Edit 在 Phase 0 被結構性 deny（settings.local.json hot-reload 無效）。Phase 1 沒 touch `.claude/` 所以未驗證；Phase 2 T203 是第一次再試。若 engineer 確認仍 deny → 主 agent escalate user 走 C 路徑（user 親跑或主 agent 一次例外，**只此一檔**）。

---

## Phase 2 Wave 2 — git mv 第一批（並行 3 agents）

> **啟動條件**：T202 + T203 雙 PASS。主 agent **Read** `migration-inventory.md` Phase 2 Inventory 段確認 events / posts / notifications 三 domain 都有 row。
>
> **共通規則（T204-T210 全適用）**：
>
> 1. Engineer **只跑 `git mv` 與必要 `mkdir` + `git add .gitkeep`**，**不 edit 測試檔內容**
> 2. mv 前先 `mkdir -p tests/integration/<domain>` + `touch tests/integration/<domain>/.gitkeep` + `git add tests/integration/<domain>/.gitkeep`（domain sub-folder Phase 0 沒預建，Wave 2-4 各 engineer 自行 mkdir）
> 3. 不 commit（commit 留 Wave 6a/6b）
> 4. 若 inventory 標 `DUP_DELETE` → engineer 不 rm，**回報主 agent 決策**（destructive 動作）
> 5. 若某筆 source 不存在（已被別 wave engineer 搬走 / 或 inventory 過時）→ 立即 STOP 回報，不創新檔

### T204 [Engineer-Events-P2] events domain git mv

**Files**：`tests/integration/events/<X>.test.{js,jsx}`（依 inventory `Domain == events` 行；預估 5-7 row）

**Description**：把 inventory 標為 `events` 的所有檔搬到 `tests/integration/events/`。

**Engineer Prompt**:

> 你是 Phase 2 events domain mv engineer。
>
> 1. 建 sub-folder：
>    ```bash
>    mkdir -p tests/integration/events
>    touch tests/integration/events/.gitkeep
>    git add tests/integration/events/.gitkeep
>    ```
> 2. `awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' specs/023-tests-directory-migration/migration-inventory.md | grep '| events  *|'` 取待搬清單
> 3. 對每筆 row：parse Source Path / Target Path 兩欄，跑 `git mv <source> <target>`
> 4. 全部完成後跑：
>    ```bash
>    git status -s | grep '^R.*-> tests/integration/events/' | wc -l
>    ls tests/integration/events/ | grep -v '\.gitkeep' | wc -l
>    git status -s | grep '^.M' | wc -l   # 期望 0（沒有 modified）
>    ```
> 5. 回報三個數字 + events domain inventory row 數，前三個必須相等、第四個 = 0
>
> **嚴格**：不動其他 domain、不 commit、不 edit 檔案內容、不刪 `.gitkeep`。

**Acceptance Criteria**:

- [ ] `tests/integration/events/.gitkeep` 已 git add（status A）
- [ ] `tests/integration/events/` 內 `.test.{js,jsx}` 數 = inventory `events` row 數
- [ ] `git status -s | grep -c '^R.*-> tests/integration/events/'` = inventory `events` row 數
- [ ] 所有 events source 已不存在於原 specs 路徑
- [ ] 沒有 `M`（modified）標記，只有 `R`（renamed）+ `A`（gitkeep）

**Verify Command** (Reviewer-Events-P2, `Explore` 跑):

```bash
INV=specs/023-tests-directory-migration/migration-inventory.md
expected=$(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' "$INV" | grep -c '| events  *|')
moved=$(git status -s | grep -c '^R.*-> tests/integration/events/' || echo 0)
[ "$moved" -eq "$expected" ] || { echo "FAIL: moved=$moved expected=$expected"; exit 1; }
[ -f tests/integration/events/.gitkeep ] || { echo "FAIL: .gitkeep missing"; exit 1; }
mod=$(git status -s | grep '^.M' | wc -l | tr -d ' ')
[ "$mod" -eq 0 ] || { echo "FAIL: $mod modified files (mv should not edit)"; exit 1; }
# 反向：所有 events source 不存在
for src in $(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' "$INV" | grep '| events  *|' | awk -F'|' '{print $3}' | tr -d ' '); do
  [ -e "$src" ] && { echo "FAIL: source still exists: $src"; exit 1; } || true
done
echo "PASS"
```

**期望**：`PASS`。

---

### T205 [Engineer-Posts-P2] posts domain git mv

**Files**：`tests/integration/posts/<X>.test.jsx`（預估 ~11 row，最大 domain 之一）

**Description / Prompt / Acceptance / Verify**：**同 T204 結構**，所有 `events` 字串改成 `posts`（target sub-folder、grep filter、acceptance assertion 全換）。

---

### T206 [Engineer-Notifications-P2] notifications domain git mv

**Files**：`tests/integration/notifications/<X>.test.jsx`（預估 ~10 row，最大 domain）

**Description / Prompt / Acceptance / Verify**：**同 T204 結構**，所有 `events` 改成 `notifications`。

> **跨 feature 檢驗點**：完成後 user 隨機抽看 `tests/integration/notifications/` 應同時含 014 + 015 spec 來源的檔（驗證 plan.md 痛點 (2) 解掉的指標）。

---

## Phase 2 Wave 3 — git mv 第二批（並行 3 agents）

> **啟動條件**：Wave 2 (T204+T205+T206) 全 PASS。

### T207 [Engineer-Strava-P2] strava domain git mv

**Files**：`tests/integration/strava/<X>.test.jsx`（預估 ~9 row）

**Description / Prompt / Acceptance / Verify**：**同 T204 結構**，`events` → `strava`。

---

### T208 [Engineer-Profile-P2] profile domain git mv

**Files**：`tests/integration/profile/<X>.test.jsx`（預估 ~6 row）

**Description / Prompt / Acceptance / Verify**：**同 T204 結構**，`events` → `profile`。

---

### T209 [Engineer-Weather-P2] weather domain git mv

**Files**：`tests/integration/weather/<X>.test.jsx`（預估 ~3 row）

**Description / Prompt / Acceptance / Verify**：**同 T204 結構**，`events` → `weather`。

---

## Phase 2 Wave 4 — misc domain（最多 3 並行，動態 dispatch）

> **啟動條件**：Wave 3 (T207+T208+T209) 全 PASS。
>
> **動態 dispatch**：主 agent 讀 inventory 確認 dashboard / navbar / toast / comments / fix-\* / share / map / 其他 domain 的 row 數。每 domain row 數 > 0 → 派一個 worker；row 數 = 0 → 跳過。同時並行上限 3。

### T210 [Engineer-Misc-P2] dashboard / navbar / toast / comments / share / map / 其他 domain git mv

**Files**：`tests/integration/{dashboard,navbar,toast,comments,share,...}/<X>.test.jsx`

**Description**：剩餘 misc domain 一次處理。每 domain 各自一個 sub-folder。預估總計 ~15-20 row（5+4+4+4+1+1...）。

**Engineer Prompt**:

> 你是 Phase 2 misc domain mv engineer。處理 inventory 中**非 events / posts / notifications / strava / profile / weather** 的剩餘 row。
>
> 對每個 misc domain：
>
> 1. 若 sub-folder 不存在 → `mkdir -p tests/integration/<domain> && touch tests/integration/<domain>/.gitkeep && git add tests/integration/<domain>/.gitkeep`
> 2. `awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' specs/023-tests-directory-migration/migration-inventory.md | grep '| <domain>  *|'` 取清單
> 3. `git mv` 每筆
> 4. 對每個 domain 各自跑 verify 三數對齊（mv count / sub-folder count / no modified）
>
> 完成回報每個 domain 處理數與是否新建 sub-folder。
>
> 若 inventory 全部 row 都已被 T204-T209 涵蓋 → 回報「no misc domain, skipped」。
>
> **若 misc domain 數 > 3** → 主 agent 拆 T210a / T210b / T210c 三個並行 worker 派發，每 worker 處理 1-3 個 domain；engineer 收到的 prompt 會明確列出責任 domain 清單。

**Acceptance Criteria**:

- [ ] 若 misc row 數 > 0：對應 sub-folder 存在 + `.gitkeep` 已 git add（status A）
- [ ] 各 domain mv 數 = inventory 對應 domain row 數
- [ ] 若 inventory row 全被 T204-T209 涵蓋：跳過，無誤建 sub-folder

**Verify Command** (Reviewer-Misc-P2, `Explore` 跑): 同 T204 模式，逐個 misc domain 跑：

```bash
INV=specs/023-tests-directory-migration/migration-inventory.md
for domain in dashboard navbar toast comments share map; do
  expected=$(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' "$INV" | grep -c "| $domain  *|" || echo 0)
  if [ "$expected" -eq 0 ]; then
    [ -d "tests/integration/$domain" ] && echo "WARN: empty $domain/ created" || echo "OK $domain (skipped)"
    continue
  fi
  [ -f "tests/integration/$domain/.gitkeep" ] || { echo "FAIL: $domain/.gitkeep missing"; exit 1; }
  moved=$(git status -s | grep -c "^R.*-> tests/integration/$domain/" || echo 0)
  [ "$moved" -eq "$expected" ] || { echo "FAIL $domain: moved=$moved expected=$expected"; exit 1; }
done
echo "PASS"
```

---

## Phase 2 Wave 5 — Smoke test（1 agent）

### T211 [Engineer-Smoke-P2] 完整 quality gate smoke + Phase 2 specific 驗證

**Dependency**：T201-T210 全完成（worktree 含 ~65 個 R 標記 + handbook M + 多個 .gitkeep A 標記 + migration-inventory.md M）

**Description**：跟 Phase 0 T012 / Phase 1 T111 同設計，分區塊驗證。**主 agent 派 Engineer-Smoke-P2 跑，主 agent 不自己跑**。

**Engineer Prompt** (派 Engineer-Smoke-P2, `general-purpose`):

> 你是 Phase 2 Wave 5 smoke test engineer。依序跑下列 6 + 4 區塊。**任一失敗 → 不要嘗試修，回報具體哪步、stderr 摘要、推測對應 source task**。
>
> ```bash
> # ---------- Quality Gate 5 連跑（type-check 排首位 — 早期警報 mv 後 import 壞掉，per Phase 1 經驗）----------
> # 1. type-check（最早抓 import path 壞）
> npm run type-check
>
> # 2. depcruise — `integration-tests-root` bucket 啟動
> npm run depcruise
>
> # 3. lint
> npm run lint -- --max-warnings 0
>
> # 4. spellcheck
> npm run spellcheck
>
> # 5. vitest browser project（避開 g8 server emulator throw）
> npx vitest run --project=browser
>
> # 6. coverage 報告（confirm Phase 1 設定仍生效）
> npx vitest run --project=browser --coverage 2>&1 | tail -50
>
> # ---------- Phase 2 Specific 驗證 ----------
> # A. tests/integration/ 真實檔數 ≈ inventory total
> find tests/integration -type f -name '*.test.*' | wc -l
> # 期望：≈ 65（依 inventory total 為準）
>
> # B. 跨 domain 集中度抽樣（隨機 notifications + posts 兩 domain 看是否 1 folder 完整）
> ls tests/integration/notifications/ | grep -c '\.test\.'   # 期望 ≥ 9（014 + 015 都進來）
> ls tests/integration/posts/ | grep -c '\.test\.'           # 期望 ≥ 10（018 + 019 + 020 + fix）
>
> # C. git log --follow 抽樣（隨機抓 1 個 events / 1 個 strava）
> git log --follow tests/integration/events/$(ls tests/integration/events/*.test.* | head -1 | xargs basename) --oneline | wc -l
> git log --follow tests/integration/strava/$(ls tests/integration/strava/*.test.* | head -1 | xargs basename) --oneline | wc -l
> # 期望：兩個都 ≥ 2（看到 mv 前的 commit）— 注意 commit 前跑這個會看不到歷史（per Phase 1 坑 4），實際得在 Wave 6a commit 後才有意義
>
> # D. 舊 specs/<NNN>/tests/integration/ 已清空
> find specs -path '*/tests/integration/*.test.*' -type f | wc -l
> # 期望：0
> ```
>
> 6 個 quality gate + 4 個 Phase 2 specific 全綠才回報「PASS」。任一 FAIL → 回報具體哪步 + stderr 摘要 + 推測 source task：
>
> | 失敗類型                                                       | 推測 source task                                                                                                       |
> | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
> | type-check 報相對 import not found                             | T204-T210 mv 後相對 import 壞（多 / 少 `..`），對應 domain engineer 修檔內 import（**唯一允許 edit 測試檔**的場景）    |
> | type-check 報 `path.resolve(..., '../../../../')` runtime fail | 雖然 type-check 抓不到，但 vitest 跑會炸；fix-imports engineer 後 grep `path.resolve.*\.\.` / `path.join.*\.\.` 找回來 |
> | depcruise 報 `integration-tests-root` violation                | T204-T210 mv 搬錯 domain，或 source path import 跨層越界                                                               |
> | depcruise 報 `integration` 舊 bucket violation                 | inventory 漏標某檔 / mv 沒搬完                                                                                         |
> | vitest 報 import error / module not found                      | mv 後相對 import 壞                                                                                                    |
> | lint 報 colocate test in src/                                  | 不應該（Phase 1 已防），若觸發 → 看具體位置                                                                            |
> | spellcheck 新單字                                              | 加到 cspell.json（不要 inline disable）                                                                                |
> | git log --follow 看不到歷史                                    | commit 前 git rename detection 還沒觸發（Phase 1 坑 4），Wave 6a commit 後重驗                                         |

**Acceptance Criteria**:

- [ ] 5 個 quality gate（type-check / depcruise / lint / spellcheck / vitest）全綠
- [ ] coverage 報告涵蓋 `src/{service,repo,runtime,lib,config}/**`（Phase 1 既有設定）
- [ ] `tests/integration/**/*.test.*` 數 ≈ inventory total（~65）
- [ ] 跨 spec 集中度抽樣：notifications ≥ 9、posts ≥ 10
- [ ] `specs/<NNN>/tests/integration/*.test.*` 0 命中
- [ ] `git log --follow` 抽樣（commit 後重驗 — 本 wave 跑 commit 前可能看不到，T211 reviewer 標記為 deferred check）

**Verify Command**: 主 agent 派 Reviewer-Smoke-P2 (`Explore`) 重跑上述 10 個 check 區塊，逐個確認。

**失敗處理**（主 agent dispatch，**主 agent 不自己診斷修復**）：

| 失敗                                         | Dispatch 對象                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| type-check / vitest import error             | 對應 domain engineer (T204-T210) 看具體檔，**允許 edit 測試檔內 import path**（mv 帶來的合理改動）。**fix 後重 stage 檔案** |
| depcruise `integration-tests-root` violation | 對應 domain engineer 重 mv（搬錯 domain）；或 inventory 標記錯誤 → T202 engineer 修 inventory 後重 mv                       |
| depcruise 舊 `integration` bucket violation  | inventory 漏標 → T202 engineer 補 inventory，再派對應 domain engineer mv                                                    |
| lint / spellcheck                            | 對應 domain engineer / Engineer-Cspell 加詞                                                                                 |
| coverage 沒涵蓋                              | Phase 1 T103 既有設定，理論不應壞；若壞 → user escalate                                                                     |

⚠️ **import path 修正規則**：mv 後測試檔內**相對** import (`./helper` / `../mocks/x`) 通常需要重算 `..` 層數。Engineer 修法：

1. 從新位置 `tests/integration/<domain>/X.test.jsx` 算到原 import target 的相對路徑
2. 同時 grep `path.resolve.*\.\.` / `path.join.*\.\.` / `fileURLToPath` 找這類 runtime path arithmetic（type-check 抓不到、vitest 才會炸；Phase 1 踩過）
3. 改完 `git add` 重 stage（Phase 1 坑 3：staged 後 edit 不會自動 re-stage）

---

## Phase 2 Wave 6a — Commit 1: mv + handbook（1 agent）

> **拆 commit 設計理由**（user 確認）：
>
> - **mv 與 handbook 強相關**（handbook 引用新路徑，必須跟 mv 同步、否則 PR 上看到 handbook 寫新路徑但實際檔還在舊位置會錯亂）→ 必須同 commit
> - **migration-inventory.md Phase 2 段填入 + Phase 2 Handoff Highlights 寫入 + 新 .gitkeep** 是「審計紀錄 + 觀察期紀錄」，與 mv 解耦 → 拆到 Commit 2
> - 兩個 commit 各自 pre-commit 全綠，PR review 較容易（Commit 1 純看 mv + 規範同步、Commit 2 純看審計與 handoff）

### T212 [Engineer-Commit-Mv-P2] Commit 1: mv + handbook

**Dependency**：T211 全綠（type-check / depcruise / vitest 都過）

**Engineer Prompt** (派 Engineer-Commit-Mv-P2, `general-purpose`):

> 你是 Phase 2 Commit 1 engineer。**只 commit「mv + handbook」一組**，不動 migration-inventory.md / 新 .gitkeep（留給 Commit 2）。
>
> 1. `git status -s` 確認改動範圍。**Commit 1 該包**：
>    - ~65 個 `R  specs/<NNN>/tests/integration/X.test.jsx -> tests/integration/<domain>/X.test.jsx` 標記
>    - `M  .claude/references/testing-handbook.md`（T203 改 6+ 處範例路徑 + 並存期說明）
>    - 可能 `M  tests/integration/<domain>/X.test.jsx`（T211 fix-imports 修的相對 import — 跟 mv 同 commit，因為是 mv 帶來的合理改動）
>
>    **Commit 1 不該包**：
>    - `M  specs/023-tests-directory-migration/migration-inventory.md`（Commit 2，Phase 2 段填入 + Handoff Highlights）
>    - `A  tests/integration/<domain>/.gitkeep`（Commit 2，新 sub-folder 全部）
>    - 任何 untracked（`project-health/` / `.claude/scheduled_tasks.lock`）
>
> 2. **僅 add 該 commit 的內容**（其他改動暫不 stage，留給 Commit 2）：
>
>    ```bash
>    # ~65 個 git mv 已自動 stage（git mv = add new + remove old），驗證一下：
>    git diff --cached --name-status -M | grep '^R' | wc -l   # 期望：65
>
>    # handbook 加進來：
>    git add .claude/references/testing-handbook.md
>
>    # fix-imports 修的測試檔（若有）也 add：
>    git add tests/integration/   # 注意：這個會把 .gitkeep 也撈進來，要排除
>    git restore --staged tests/integration/*/\.gitkeep   # 把 .gitkeep 退回 unstaged
>    # 或更精準：
>    # git add $(git status -s | grep '^.M' | awk '{print $2}' | grep '^tests/integration/')
>
>    # 確認沒誤 stage 別的：
>    git diff --cached --name-status -M | grep -v '^R' | grep -v 'testing-handbook.md' | grep -v 'tests/integration/.*\.test\.'
>    # 期望：empty output
>    ```
>
> 3. commit 用 heredoc：
>
>    ```bash
>    git commit -m "$(cat <<'EOF'
>    refactor(tests): mv ~65 integration tests to top-level tests/integration (Phase 2 part 1)
>
>    - ~65 個 integration test 從 specs/<NNN>/tests/integration/ 搬到 tests/integration/<domain>/
>    - 對照原則依測試主要被測 component import 來源決定 domain (events/posts/notifications/strava/profile/weather/dashboard/navbar/toast/comments/share/map)
>    - 跨 spec 集中：notifications/ 含 014 + 015 來源；posts/ 含 018 + 019 + 020 + fix；解掉 plan.md 痛點 (2)
>    - testing-handbook.md domain 範例路徑同步更新 + 並存期說明
>    - 配置/觀察期改動（migration-inventory.md Phase 2 段填入 + Phase 2 Handoff Highlights + 新 sub-folder .gitkeep）拆到下一個 commit
>    EOF
>    )"
>    ```
>
>    **不加** `Co-Authored-By`。
>
> 4. `git log -1 --stat | tail -15` + `git status -s` 回報。`git status` 應仍顯示 migration-inventory.md (M)、新 .gitkeep (??/A) 等待下個 commit。
>
> **不要** push、不 amend Phase 0/1 commit、不 --no-verify。

**Acceptance Criteria**:

- [ ] Commit 1 成功（pre-commit hook 全綠 — type-check / depcruise / lint / spellcheck / vitest）
- [ ] Commit message subject 含 `Phase 2 part 1` 與 `mv ~65 integration tests`
- [ ] **不含** `Co-Authored-By`
- [ ] `git log -1 --shortstat` 顯示 ≥ 66 個檔案變動（~65 R + 1 M handbook，可能 + 若干 M 修 import）
- [ ] R 標記數 ≈ inventory total（per find）
- [ ] `git status -s` 仍顯示 migration-inventory.md / 新 .gitkeep 為待 stage（確認沒誤包進 Commit 1）

**Verify Command** (Reviewer-Commit-Mv-P2, `Explore` 跑):

```bash
# 1. message subject
git log -1 --pretty='%s' | grep -qE 'Phase 2 part 1' || { echo "FAIL: subject"; exit 1; }
git log -1 --pretty='%s' | grep -qE 'mv ~65 integration tests' || { echo "FAIL: subject mv ~65"; exit 1; }

# 2. 不含 Co-Author
git log -1 --pretty='%b' | grep -qi 'co-authored-by' && { echo "FAIL: Co-Authored-By"; exit 1; } || true

# 3. 變動檔數
files_changed=$(git log -1 --pretty=format: --shortstat | grep -oE '[0-9]+ files? changed' | grep -oE '^[0-9]+')
[ "$files_changed" -ge 66 ] || { echo "FAIL: files_changed=$files_changed expected ≥ 66"; exit 1; }

# 4. R 標記數對齊 inventory total
INV=specs/023-tests-directory-migration/migration-inventory.md
expected=$(awk '/^## Phase 2 Inventory/,/^## Phase 2 Handoff/' "$INV" | grep -c '^| [0-9]')
renames=$(git show --name-status HEAD | grep -c '^R' || echo 0)
[ "$renames" -eq "$expected" ] || { echo "FAIL: renames=$renames expected=$expected"; exit 1; }

# 5. Commit 1 不該包到 migration-inventory / 新 .gitkeep
forbidden=$(git show --name-only HEAD | grep -E '(migration-inventory\.md|tests/integration/.+/\.gitkeep)' || true)
[ -z "$forbidden" ] || { echo "FAIL: Commit 1 should not include: $forbidden"; exit 1; }

# 6. Commit 1 該含 handbook
git show --name-only HEAD | grep -q 'testing-handbook.md' || { echo "FAIL: handbook not in commit"; exit 1; }

# 7. status 仍有待 stage 的（migration-inventory 與新 .gitkeep）
remaining=$(git status -s | grep -E '(migration-inventory\.md|tests/integration/.+/\.gitkeep)' | wc -l | tr -d ' ')
[ "$remaining" -ge 2 ] || { echo "FAIL: Commit 2 內容沒留下，remaining=$remaining"; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

## Phase 2 Wave 6b — Commit 2: inventory + handoff + 新 .gitkeep（1 agent）

### T213 [Engineer-Commit-Cfg-P2] Commit 2: migration-inventory.md (Phase 2 Inventory + Handoff Highlights) + 新 .gitkeep

**Dependency**：T212（Commit 1）已成功

**Description**：把 Phase 2 跑下來的觀察、落差、坑、subagent permission 狀態變化、outstanding 整理成 4-7 條 bullet，落筆到 `migration-inventory.md` 的「Phase 2 Handoff Highlights」段（現為 placeholder）。然後 commit migration-inventory.md + 新 .gitkeep。

**Engineer Prompt** (派 Engineer-Commit-Cfg-P2, `general-purpose`):

> 你是 Phase 2 Commit 2 engineer。**先填 handoff，再 commit**。
>
> ### Step 1：填 Phase 2 Handoff Highlights（必須先做）
>
> Edit `specs/023-tests-directory-migration/migration-inventory.md` 的「## Phase 2 Handoff Highlights」段，把現有 placeholder block quote 替換成 4-7 條 bullet。**體例參考 Phase 1 Handoff Highlights 段**（同檔上方），每條格式：
>
> ```markdown
> - **<重點 title>**：<具體內容>。<為何記錄 / 觸發場景>
> ```
>
> 必須涵蓋以下類別（從 Phase 2 Wave 1-6 跑下來的實際觀察整理）：
>
> 1. **inventory row 對 plan 估算的落差**（plan.md 估 52，實際多少？）
> 2. **subagent 對 `.claude/**` 寫入狀態\*\*（T203 是否被 deny？解法是什麼？）
> 3. **mv 後相對 import 壞掉的修正情況**（T211 type-check 抓到幾個檔？是否還有 `path.resolve` 類 runtime path arithmetic？）
> 4. **domain 分組的邊界曖昧 case**（哪些 case 標 ambiguous？最終決策？）
> 5. **跨 spec 集中度驗證**（notifications/ 是否同時含 014 + 015？posts/ 是否同時含 018+019+020+fix？— plan.md 痛點 (2) 是否解掉的指標）
> 6. **commit 落地相關 staging 坑**（Phase 1 坑 3 是否在 Phase 2 重現？fix-imports 後 re-stage 是否平順？）
> 7. **outstanding tech debt**（Phase 3 啟動前要先處理什麼？例：domain folder 命名是否需重檢？某 domain row 數異常多 → 拆 sub-domain？）
>
> 不必每類都列 — 只列**實際在 Phase 2 跑下來有觀察到**的；無觀察的類別跳過。最少 4 條、最多 7 條。
>
> ### Step 2：commit
>
> 1. `git status -s` 確認剩下：
>    - `M  specs/023-tests-directory-migration/migration-inventory.md`（Phase 2 Inventory 段已 T202 填、Phase 2 Handoff Highlights 段剛剛 Step 1 填）
>    - 多個 `A  tests/integration/<domain>/.gitkeep`（Wave 2-4 各 domain engineer 新建）
>    - 不該有：~65 個 R（已被 Commit 1 帶走）、handbook M（已被 Commit 1 帶走）
> 2. 逐項 add（**不要 git add -A**，會撈到 untracked `project-health/` / `.claude/scheduled_tasks.lock`）：
>    ```bash
>    git add specs/023-tests-directory-migration/migration-inventory.md
>    # 新 sub-folder .gitkeep 全部 add：
>    for kp in tests/integration/*/.gitkeep; do
>      [ -f "$kp" ] && git add "$kp"
>    done
>    ```
> 3. commit 用 heredoc：
>
>    ```bash
>    git commit -m "$(cat <<'EOF'
>    chore(tests): Phase 2 inventory + handoff (Phase 2 part 2)
>
>    - migration-inventory.md Phase 2 Inventory 段填入完整 mv 對照表（~65 row）
>    - migration-inventory.md Phase 2 Handoff Highlights 段填入 4-7 條給下個 session 的精煉要點
>    - 新增 tests/integration/<domain>/.gitkeep（events / posts / notifications / strava / profile / weather / dashboard / navbar / toast / comments / share / map / ...）
>    - tests/_placeholder.js 仍保留（Phase 3 完才移除，per Phase 0 handoff）
>    EOF
>    )"
>    ```
>
>    **不加** `Co-Authored-By`。
>
> 4. `git log -1 --stat | tail -10` + `git log --oneline -5` 回報（看到 part 2 / part 1 / Phase 1 part 2 / Phase 1 part 1 / Phase 0 五個 commit）。`git status` 應 clean（除 untracked `project-health/` / `.claude/scheduled_tasks.lock`）。
>
> **不要** push。

**Acceptance Criteria**:

- [ ] Commit 2 成功（pre-commit hook 全綠）
- [ ] Commit message subject 含 `Phase 2 part 2`
- [ ] **不含** `Co-Authored-By`
- [ ] migration-inventory.md「Phase 2 Handoff Highlights」段已從 placeholder 改為 4-7 條 bullet
- [ ] `git log -1` 顯示 migration-inventory.md + 多個 .gitkeep
- [ ] `git log --oneline -5` 顯示 part 2 / part 1 / Phase 1 part 2 / Phase 1 part 1 / Phase 0 五個 commit 順序
- [ ] `git status -s` clean（除 untracked `project-health/` / `.claude/scheduled_tasks.lock`）

**Verify Command** (Reviewer-Commit-Cfg-P2, `Explore` 跑):

```bash
# 1. message subject
git log -1 --pretty='%s' | grep -qE 'Phase 2 part 2' || { echo "FAIL: subject"; exit 1; }

# 2. 不含 Co-Author
git log -1 --pretty='%b' | grep -qi 'co-authored-by' && { echo "FAIL: Co-Authored-By"; exit 1; } || true

# 3. Commit 2 該含 inventory 與 .gitkeep，**不該含** mv 或 handbook
git show --name-only HEAD | grep -q 'migration-inventory\.md$' || { echo "FAIL: inventory missing"; exit 1; }
gk=$(git show --name-only HEAD | grep -c 'tests/integration/.+/\.gitkeep' || echo 0)
[ "$gk" -ge 1 ] || { echo "FAIL: no new .gitkeep added"; exit 1; }

forbidden=$(git show --name-only HEAD | grep -E '(testing-handbook\.md|tests/integration/[a-z-]+/[A-Za-z].+\.test\.)' || true)
[ -z "$forbidden" ] || { echo "FAIL: Commit 2 should not include: $forbidden"; exit 1; }

# 4. Phase 2 Handoff Highlights 不再是 placeholder
INV=specs/023-tests-directory-migration/migration-inventory.md
hf=$(awk '/^## Phase 2 Handoff Highlights/,/^## Phase 3/' "$INV" | grep -c '^- \*\*')
[ "$hf" -ge 4 ] && [ "$hf" -le 7 ] || { echo "FAIL: handoff bullets=$hf (expect 4-7)"; exit 1; }

# 5. log --oneline 順序
git log --oneline -5 | head -1 | grep -qE 'Phase 2 part 2' || { echo "FAIL: HEAD~0 not part 2"; exit 1; }
git log --oneline -5 | sed -n '2p' | grep -qE 'Phase 2 part 1' || { echo "FAIL: HEAD~1 not part 1"; exit 1; }

# 6. status clean（除 untracked）
remaining=$(git status -s | grep -vE '^\?\? (project-health/|\.claude/scheduled_tasks\.lock)' | wc -l | tr -d ' ')
[ "$remaining" -eq 0 ] || { echo "FAIL: dirty working tree, remaining=$remaining"; git status -s; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

## Phase 2 Wave 7 — User PR（manual）

### T214 [User] push + open PR + 24h 觀察

**Description**：T212 + T213 兩 commit 完後 user 親跑（涉及 push 到 remote — destructive 程度需 user confirm）。兩 commit 同一個 PR（Phase 2 是邏輯整體，不分 PR）。

```bash
git push origin 023-tests-directory-migration
gh pr create --title "refactor(tests): Phase 2 migrate integration tests" --body "$(cat <<'EOF'
## Summary
- ~65 個 integration test 從 specs/<NNN>/tests/integration/ 搬到 tests/integration/<domain>/
- 跨 spec 集中：notifications/ 含 014 + 015；posts/ 含 018 + 019 + 020 + fix → 解掉 plan.md 痛點 (2)
- testing-handbook.md domain 範例路徑同步 + 並存期說明
- migration-inventory.md Phase 2 Inventory + Phase 2 Handoff Highlights 段落筆
- Phase 0 / Phase 1 / Phase 2 三波 commit 同 branch 連續累加

## Test plan
- [x] type-check / depcruise / lint / spellcheck / vitest --project=browser 全綠
- [x] coverage 涵蓋 src/{service,repo,runtime,lib,config}/**
- [x] 跨 spec 集中度（notifications/posts）抽樣驗證
- [x] specs/<NNN>/tests/integration/ 已清空
- [x] tests/integration/lib/test-bucket-policy.test.js 8-bucket 斷言仍綠（per Phase 0/1）
- [ ] main merge 後 24h 無 CI 紅
EOF
)"
```

**Acceptance**:

- [ ] PR 通過 review
- [ ] CI 全綠
- [ ] merge 後 main 觀察 24h 無 regression
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) Verification Checklist「Phase 2 完成」全部 `[x]`

---

## Phase 2 執行 SOP

### Step 0：Wave 0 gate check（派 Reviewer）

主 agent **派 Reviewer-Bootstrap-P2**（`Explore`）跑 T201 五個檢查。**FAIL → STOP，escalate user**。PASS 才進 Step 1。

### Step 1：Wave 1（並行 2 agents）

主 agent **單一 message** 派：

```
Engineer-Inventory-P2 (general-purpose):
  "執行 T202（migration-inventory.md Phase 2 Inventory 段填入 ~65 row 對照表）。
   完成後跑 row count + total 自我驗證。"

Engineer-Handbook-P2 (general-purpose):
  "執行 T203（.claude/references/testing-handbook.md domain 範例路徑同步 + 並存期說明）。
   啟動先試小 Edit 驗證 .claude/** 寫入是否 deny；若 deny 立即 STOP escalate user。
   可寫則完成後跑 grep 自我驗證。"
```

完成後 **單一 message** 派：

```
Reviewer-Inventory-P2 (Explore): "驗 T202 verify command 5 個 check。"
Reviewer-Handbook-P2 (Explore): "驗 T203 verify command 3 個 check + diff 確認 unit/e2e 段沒誤動。"
```

任一 FAIL → 主 agent 透過 SendMessage 把 reviewer feedback 傳回原 engineer 修正 → 重派 reviewer。重試上限 3。

### Step 2：Wave 2（並行 3 agents）

T202 + T203 雙 PASS 後，主 agent **Read** `migration-inventory.md` Phase 2 Inventory 段確認 events / posts / notifications row 數都 > 0，然後 **單一 message** 派：

```
Engineer-Events-P2        (general-purpose):  "T204 events domain mv ..."
Engineer-Posts-P2         (general-purpose):  "T205 posts domain mv ..."
Engineer-Notifications-P2 (general-purpose):  "T206 notifications domain mv ..."
```

完成後配對 3 個 Reviewers（Explore）。FAIL 處理同 Step 1。

### Step 3：Wave 3（並行 3 agents）

主 agent 讀 inventory 確認 strava / profile / weather row 數都 > 0，**單一 message** 派 T207-T209。row 數 = 0 的 task 直接 skip。配對 reviewers。

### Step 4：Wave 4 misc domain（≤3 並行，動態）

主 agent 讀 inventory 確認 misc domain（dashboard / navbar / toast / comments / share / map / 其他）row 數。

- 若 misc domain ≤ 3 個 → 派 1 個 Engineer-Misc-P2 處理全部
- 若 misc domain > 3 個 → 拆 T210a / T210b / T210c 並行，每 worker 1-3 個 domain
- row 數 = 0 的 domain 直接 skip

配對 reviewers。

### Step 5：Wave 5 smoke（1 agent，集中 verify 點）

主 agent 派 Engineer-Smoke-P2 跑 T211 的 10 個 check。配對 Reviewer-Smoke-P2 重跑。

任一失敗 → 依 T211 失敗處理表 dispatch 對應 wave engineer 修，**主 agent 不自己診斷**。修完重跑 Wave 5。

### Step 6a：Wave 6a Commit 1（1 agent）

主 agent 派 Engineer-Commit-Mv-P2 跑 T212（mv + handbook + fix-imports）。配對 Reviewer-Commit-Mv-P2 跑 7 個 verify check。**Reviewer FAIL → 主 agent 透過 SendMessage 把具體 feedback 傳回 Engineer-Commit-Mv-P2 修**。修完再驗，重試上限 3 次。

### Step 6b：Wave 6b Commit 2（1 agent）

T212 PASS 後立即派 Engineer-Commit-Cfg-P2 跑 T213（先填 Phase 2 Handoff Highlights 4-7 條 bullet，再 commit migration-inventory + 新 .gitkeep）。配對 Reviewer-Commit-Cfg-P2 跑 6 個 verify check。

注意：T213 dependency 是 T212 已成功（git log 看到 part 1）；若 T212 失敗 / 還未 PASS → 不啟動 T213。

### Step 7：Wave 7 PR（user manual）

主 agent 通報「Phase 2 commit 完成（part 1 sha: <X>, part 2 sha: <Y>），可開 PR」+ 提供 T214 範本給 user 複製貼上。**主 agent 不自己跑 push / gh**。

### 主 agent 全程紀律

從頭到尾**不跑** `npm` / `node` / `git mv` / `git add` / `git commit` / `git push` / `mkdir` / `gh` 命令。`Read` 純讀檔（含 inventory）允許；`git status` / `find` 等 query Bash「優先派 Reviewer」。

---

## Phase 2 失敗回滾

任一 wave 完成度低於 100%（reviewer 持續 FAIL ≥ 3 次）→ 主 agent **立即 STOP + escalate user**，不派 subagent 跑回滾命令（涉及 destructive 操作）。

回滾命令給 user 親跑（依失敗時點）：

### Wave 2-4 中途失敗（mv 已開始，commit 尚未下）

```bash
# user 親跑（worktree at dive-into-run-023-tests-directory-migration/）
git restore --staged .                                    # unstage 所有 git mv
git restore .                                              # 把 mv 過的檔還原（git mv = del+add，需 restore 才回復）
# 確認新建 sub-folder 是否要砍：
git clean -nfd tests/integration/ 2>/dev/null   # dry-run 看會刪什麼
git clean -fd tests/integration/ 2>/dev/null    # 實際刪（destructive，user confirm）
# 確認回到 Phase 1 head
git log -1 --pretty='%h %s'   # 期望：commit message 含 'Phase 1 part 2'（sha 因 amend 可能變動，不寫死）
git status -s                  # 期望：empty + untracked project-health/
```

### Wave 6a Commit 1 後失敗（part 1 已下，part 2 尚未 commit）

```bash
# 退 commit 1 但保留改動
git reset --soft HEAD~1
# 此時所有 mv 與 handbook 變動回到 staged，可重新跑 T212 修問題後重 commit
```

### Wave 6b Commit 2 後失敗（part 1+2 都已下，push 未做）

```bash
# 退兩個 commit 但保留改動
git reset --soft HEAD~2
# 或全砍回 Phase 1 head（destructive，user confirm）
PHASE1_HEAD=$(git log --grep='Phase 1 part 2' --pretty='%H' | head -1)
git reset --hard "$PHASE1_HEAD"
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

## Phase 2 完成判準（總體）

- [ ] T201-T213 全 PASS（含 Wave 6 拆 T212 + T213 兩 commit；T214 user manual）
- [ ] PR opened + merged + main 24h 無 CI 紅
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) Verification Checklist「Phase 2 完成」全部 `[x]`：
  - [ ] 跨 feature 改 notifications 邏輯，只動 `tests/integration/notifications/`
  - [ ] `tests/integration/<domain>/` 分組合理（每 domain 4-15 檔，不超過 30）
  - [ ] domain 對應表存於 [`./migration-inventory.md`](./migration-inventory.md) Phase 2 Inventory 段
- [ ] [`./migration-inventory.md`](./migration-inventory.md) Phase 2 Handoff Highlights 段已填 4-7 條 bullet（給下個 session / Phase 3 開工參考）
- [ ] tests/\_placeholder.js 仍保留（Phase 3 完才移除，per Phase 0 handoff §「給下個 session 的 Phase 1-3 注意事項」第 2 條）

---

# Phase 3 Tasks: E2E + helpers + cleanup

> **Parent 藍圖**：[`./plan.md`](./plan.md) Phase 3 段（Step 3.1-3.9）
> **Branch**：`023-tests-directory-migration`（接 Phase 2 兩 commit 之後直接累加，不另開 sub-branch）
> **預估工期**：1.5-2 天
> **總任務數**：16（13 engineer + 1 reviewer-only gate + 1 smoke + 1 user PR）
> **Phase 3 範圍**：plan.md Step 3.1-3.9 全包，含 e2e mv、test-utils → \_helpers mv、playwright config × 2 重寫、branch scripts × 3 重寫、policy.js 舊 bucket 拆除、`tests/_placeholder.js` 移除、root docs 同步、Phase 3 Inventory + Handoff 落筆

---

## Phase 3 並行策略

**同時最多 3 個 worker agent**（與 Phase 0/1/2 同口徑）。Engineer = `general-purpose`，Reviewer = `Explore`（read-only + Bash query）。重試上限 3 次，超過 → 主 agent STOP escalate user。

主 Agent 角色邊界**完全沿用 Phase 0/1/2 規則**：

- ✅ Agent 派 / SendMessage 帶 reviewer feedback / Read 純讀檔 / TaskCreate
- ❌ **絕對禁止** Edit / Write / 任何 mutate Bash（npm / node / git mv / git add / git commit / mkdir / rm / gh / git push）
- ❌ 從頭到尾包含**後續修改循環**全派 subagent；user 授權的「主 agent 例外」**Phase 3 不啟用**（Phase 1 已驗證 subagent Bash deny 不再重現）

---

## Phase 3 依賴圖

```
Wave 0 (gate, reviewer-only):
  └─ Reviewer-Bootstrap-P3: T301
                           │ PASS
                           ▼
Wave 1 (1 agent):
  └─ Engineer-Inventory-P3: T302  (Phase 3 Inventory 段填入 mv 對照表)
                           │ PASS
                           ▼
Wave 2 (3 並行):
  ├─ Engineer-E2E-Mv-P3:    T303  (.spec.js × 11 + global-setup × 5 + window.d.ts × 4 + README × 1)
  ├─ Engineer-Helpers-P3:   T304  (specs/test-utils/ → tests/_helpers/ + 改用該 helpers 的 import)
  └─ Engineer-PWConfig-P3:  T305  (playwright.config.mjs testDir swap — 與 mv 解耦但路徑後端依賴 mv 結果，issue commit 時刻同 mv)
                           │ ALL PASS
                           ▼
Wave 3 (3 並行 — 配置同步 mv 結果):
  ├─ Engineer-PWEmu-P3:     T306  (playwright.emulator.config.mjs 架構重寫，HIGH RISK)
  ├─ Engineer-Scripts-P3:   T307  (test-branch.sh / test-e2e-branch.sh / run-all-e2e.sh 三個 shell script)
  └─ Engineer-Rules-P3:     T308  (.claude/rules/e2e-commands.md frontmatter paths)
                           │ ALL PASS
                           ▼
Wave 4 (2 並行 — cleanup):
  ├─ Engineer-Policy-P3:    T309  (policy.js 拆除舊 4 bucket：unit/integration/e2e/specs-test-utils)
  └─ Engineer-Docs-P3:      T310  (CLAUDE.md / AGENTS.md / GEMINI.md root docs 同步)
                           │ ALL PASS
                           ▼
Wave 5 (1 agent — placeholder removal，獨立 wave 因為觸發 ESLint 空目錄抱怨的條件變了):
  └─ Engineer-Placeholder-P3: T311  (rm tests/_placeholder.js + tsconfig include `tests` 維持)
                           │ PASS
                           ▼
Wave 6 (1 agent — smoke):
  └─ Engineer-Smoke-P3:     T312
                           │ PASS
                           ▼
Wave 7a (1 agent — Commit 1):
  └─ Engineer-Commit-Mv-P3: T313  ("Phase 3 part 1": mv only — e2e + helpers)
                           │ PASS
                           ▼
Wave 7b (1 agent — Commit 2):
  └─ Engineer-Commit-Cfg-P3: T314 ("Phase 3 part 2": config + cleanup + inventory + handoff)
                           │ PASS
                           ▼
Wave 8 (manual):
  └─ User: T315  (push + open PR + 24h 觀察)
```

---

## Phase 3 Wave 0 — 前置確認（gate only，不動工）

### T301 [Reviewer-Bootstrap-P3] 前置條件確認

**Files**：純讀取，不動

**Description**：Phase 3 開工硬性 gate。Phase 2 兩 commit 必須已存在於 branch head；worktree 必須 clean；`tests/e2e/` 仍是空殼（除 `_setup/.gitkeep`）；`tests/_helpers/` 仍只有 `.gitkeep`；`specs/test-utils/` 仍存在（待 Phase 3 mv）。

**Reviewer Prompt** (派 Reviewer-Bootstrap-P3, `Explore`):

> 你是 Phase 3 開工 gate 檢查 reviewer。依序跑下列 7 步，**全 PASS** 才回報「APPROVE — Phase 3 可開工」。任一 FAIL → 列出原因 escalate user，**不嘗試修**。
>
> ```bash
> cd /Users/chentzuyu/Desktop/dive-into-run-023-tests-directory-migration
>
> # 1. worktree clean
> dirty=$(git status --porcelain | grep -vE '^\?\? (project-health/|\.claude/scheduled_tasks\.lock)' | wc -l | tr -d ' ')
> [ "$dirty" -eq 0 ] || { echo "FAIL 1: worktree dirty"; git status -s; exit 1; }
>
> # 2. branch
> [ "$(git branch --show-current)" = "023-tests-directory-migration" ] || { echo "FAIL 2: wrong branch"; exit 1; }
>
> # 3. Phase 2 part 2 commit 存在於 head
> git log -1 --pretty='%s' | grep -qE 'Phase 2 part 2' || { echo "FAIL 3: HEAD not Phase 2 part 2"; exit 1; }
> git log -2 --pretty='%s' | tail -1 | grep -qE 'Phase 2 part 1' || { echo "FAIL 3: HEAD~1 not Phase 2 part 1"; exit 1; }
>
> # 4. tests/e2e/ 仍空（除 _setup/.gitkeep）
> e2e_files=$(find tests/e2e -type f -not -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')
> [ "$e2e_files" -eq 0 ] || { echo "FAIL 4: tests/e2e already has $e2e_files real files"; find tests/e2e -type f -not -name '.gitkeep'; exit 1; }
>
> # 5. tests/_helpers/ 仍空（只 .gitkeep）
> helpers_files=$(find tests/_helpers -type f -not -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')
> [ "$helpers_files" -eq 0 ] || { echo "FAIL 5: tests/_helpers already has files"; exit 1; }
>
> # 6. specs/test-utils/ 仍存在（Phase 3 來源）
> [ -d specs/test-utils ] || { echo "FAIL 6: specs/test-utils missing — already moved?"; exit 1; }
> [ -f specs/test-utils/e2e-helpers.js ] || { echo "FAIL 6: e2e-helpers.js missing"; exit 1; }
>
> # 7. tests/_placeholder.js 仍存在（Phase 3 Wave 5 才 rm）
> [ -f tests/_placeholder.js ] || { echo "FAIL 7: _placeholder.js already gone"; exit 1; }
> ```
>
> 全部 PASS 才 APPROVE。任一 FAIL：回報具體哪步、實際 output、推測原因（Phase 2 沒 commit / tests 已被別人動過 / test-utils 已被搬走），**stop**。

**Acceptance Criteria**:

- [ ] worktree clean（除 untracked `project-health/` / `.claude/scheduled_tasks.lock`）
- [ ] branch = `023-tests-directory-migration`
- [ ] HEAD = Phase 2 part 2，HEAD~1 = Phase 2 part 1
- [ ] `tests/e2e/` 內無真實測試檔
- [ ] `tests/_helpers/` 內只有 `.gitkeep`
- [ ] `specs/test-utils/` 仍存在含 `e2e-helpers.js`
- [ ] `tests/_placeholder.js` 仍存在

**失敗處理**：任一步 FAIL → 主 agent **不啟 Wave 1**，escalate user。

---

## Phase 3 Wave 1 — Inventory（1 agent）

### T302 [Engineer-Inventory-P3] Phase 3 Inventory 對照表

**Files**：`specs/023-tests-directory-migration/migration-inventory.md`（**Phase 3 Inventory + Handoff 段**，現為 placeholder block quote — 改寫 Inventory 部分；Handoff 留 Wave 7b T314 寫）

**Description**：產出 Phase 3 所有要搬 / 改 / 拆的檔案對照表。e2e 檔不只 `.spec.js`（11 個），還包含支援檔（global-setup × 5、window.d.ts × 4、README × 1，total ~21 e2e 檔）+ test-utils 2 個 helper。Engineer **不動任何測試檔 / 配置 / 規則**，只填 Phase 3 Inventory 段 markdown。

**Engineer Prompt** (派 Engineer-Inventory-P3, `general-purpose`):

> 你是 Phase 3 inventory engineer。在 `specs/023-tests-directory-migration/migration-inventory.md` 的「Phase 3 Inventory + Handoff（E2E + helpers）」段（現為 placeholder），改寫為兩張 markdown table + Decision Log。
>
> ### Table 1：E2E 檔案對照（執行 `find specs -path '*/tests/e2e/*' -type f | sort` 列全部，依下列規則填）
>
> 對照規則：
>
> - `.spec.js` 直接搬到 `tests/e2e/<name>.spec.js`（plan.md Step 3.1：「15 檔不多，可平鋪在 tests/e2e/ 不分 domain」），檔名衝突 → 加 spec 編號 tag（如 `events.spec.js` 與 `events-page.spec.js` 已不衝突；003 兩個 sub-folder 注意衝突）
> - `global-setup.js` 各 spec 內容不同（每個 seed 不同 fixture），搬到 `tests/e2e/_setup/<feature>-global-setup.js`（檔名加 spec 編號避免衝突）
> - `window.d.ts` 多個（004/005/014/015）：先 `diff` 比對是否完全相同；**完全相同** → 保留一個放 `tests/e2e/_setup/window.d.ts`，其他標 `DUP_DELETE`；**不同** → 各自搬到 `tests/e2e/_setup/<feature>-window.d.ts`
> - `README.md`（001 only）：搬到 `tests/e2e/_setup/<feature>-README.md` 或標 `DUP_DELETE` 看內容（純導覽 README 可刪）
>
> Schema：
>
> ```markdown
> | #   | Source Path                                                 | Type         | Target Path                                           | Notes                                                                          |
> | --- | ----------------------------------------------------------- | ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
> | 1   | specs/001-event-filtering/tests/e2e/event-filtering.spec.js | spec         | tests/e2e/event-filtering.spec.js                     | imports `../../../test-utils/e2e-helpers.js` → 改 `../_helpers/e2e-helpers.js` |
> | 2   | specs/001-event-filtering/tests/e2e/global-setup.js         | global-setup | tests/e2e/\_setup/001-event-filtering-global-setup.js | seeds events with city/district variation                                      |
> | 3   | specs/001-event-filtering/tests/e2e/README.md               | README       | (DUP_DELETE) or tests/e2e/\_setup/001-README.md       | content snapshot：`<head -3>`                                                  |
> | ... | ...                                                         | ...          | ...                                                   | ...                                                                            |
> ```
>
> ### Table 2：test-utils 對照（specs/test-utils/ → tests/\_helpers/）
>
> ```markdown
> | #   | Source                           | Target                          | Importers (via grep)                                        |
> | --- | -------------------------------- | ------------------------------- | ----------------------------------------------------------- |
> | 1   | specs/test-utils/e2e-helpers.js  | tests/\_helpers/e2e-helpers.js  | `grep -rn "specs/test-utils\|test-utils/e2e-helpers"` 結果  |
> | 2   | specs/test-utils/mock-helpers.js | tests/\_helpers/mock-helpers.js | `grep -rn "specs/test-utils\|test-utils/mock-helpers"` 結果 |
> ```
>
> ### Decision Log（必填，作為 Wave 2-5 engineer 的 ground truth）
>
> 列下列 4 個決策結果（engineer 一次決定，後續 wave engineer 不再各自決定，避免漂移）：
>
> 1. **window.d.ts 合併或分散**：`diff` 結果（全相同 vs 部分不同）+ 採用方案
> 2. **README 處理**：head 內容看是否值得保留 + 採用方案
> 3. **filename collision**：spec 編號相同的 source（003 / 004 / 005 / 014 / 015）`global-setup.js` 與 `window.d.ts` 都用 `<feature>-` prefix
> 4. **test-utils importer 範圍**：`grep -rn 'specs/test-utils\|\.\./test-utils\|\.\./\.\./test-utils\|\.\./\.\./\.\./test-utils\|test-utils/e2e-helpers\|test-utils/mock-helpers' specs tests scripts playwright*.mjs` 命中的所有檔案路徑 + import 字串（給 T304 import 修正用）
>
> ### 自我驗證
>
> ```bash
> # 1. row 數對齊
> e2e_total=$(find specs -path '*/tests/e2e/*' -type f | wc -l | tr -d ' ')
> rows1=$(awk '/^### Table 1/,/^### Table 2/' specs/023-tests-directory-migration/migration-inventory.md | grep -c '^| [0-9]')
> echo "table1 rows=$rows1 e2e_total=$e2e_total"   # 期望相等
>
> # 2. test-utils row 數
> rows2=$(awk '/^### Table 2/,/^### Decision Log/' specs/023-tests-directory-migration/migration-inventory.md | grep -c '^| [0-9]')
> echo "table2 rows=$rows2"   # 期望 = 2
> ```
>
> 回報「Table 1 N rows, Table 2 2 rows, k DUP_DELETE flagged, decision log 4 條全填」。

**Acceptance Criteria**:

- [ ] migration-inventory.md「Phase 3 Inventory」段不再是 placeholder
- [ ] Table 1 row 數 = `find specs -path '*/tests/e2e/*' -type f | wc -l`（預估 21）
- [ ] Table 2 row 數 = 2
- [ ] 每筆 Table 1 target path 以 `tests/e2e/` 開頭
- [ ] Decision Log 4 條全填（含 importer grep 結果）
- [ ] target name 同 sub-folder 內 unique

**Verify Command** (Reviewer-Inventory-P3, `Explore` 跑):

```bash
INV=specs/023-tests-directory-migration/migration-inventory.md

# 1. 不再是 placeholder
awk '/^## Phase 3 Inventory/,/^---/' "$INV" | grep -q '_待 Phase 3' && { echo "FAIL: still placeholder"; exit 1; }

# 2. Table 1 row 數對齊 find
expected=$(find specs -path '*/tests/e2e/*' -type f | wc -l | tr -d ' ')
rows=$(awk '/^### Table 1/,/^### Table 2/' "$INV" | grep -c '^| [0-9]')
[ "$rows" -eq "$expected" ] || { echo "FAIL: Table1 rows=$rows expected=$expected"; exit 1; }

# 3. Table 2 row 數
rows2=$(awk '/^### Table 2/,/^### Decision Log/' "$INV" | grep -c '^| [0-9]')
[ "$rows2" -eq 2 ] || { echo "FAIL: Table2 rows=$rows2 expected=2"; exit 1; }

# 4. target unique
dup=$(awk '/^### Table 1/,/^### Table 2/' "$INV" | grep -oE '\| tests/e2e/[A-Za-z0-9._/-]+' | sort | uniq -d)
[ -z "$dup" ] || { echo "FAIL: duplicate targets:"; echo "$dup"; exit 1; }

# 5. Decision Log 4 條
dl=$(awk '/^### Decision Log/,/^---|^## /' "$INV" | grep -cE '^[0-9]\.\s+\*\*')
[ "$dl" -ge 4 ] || { echo "FAIL: Decision Log only $dl entries"; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

## Phase 3 Wave 2 — git mv（並行 3 agents）

> **共通規則（T303-T305 全適用）**：
>
> 1. Engineer **只跑 `git mv` + 必要 `mkdir` + `git add .gitkeep` + 必要 `Edit` 修 import path**（mv 後相對 path 必修，per Phase 1 坑 1）
> 2. **不 commit**（commit 留 Wave 7a/7b）
> 3. 若 inventory 標 `DUP_DELETE` → engineer 不 rm，**回報主 agent 決策**（destructive，user confirm）
> 4. 若某筆 source 不存在（已被別 wave engineer 搬走 / 或 inventory 過時）→ 立即 STOP 回報

### T303 [Engineer-E2E-Mv-P3] e2e .spec.js + global-setup + window.d.ts + README mv

**Files**：依 inventory Table 1 全部 row（預估 21 檔；source = `specs/<NNN>/tests/e2e/...`，target = `tests/e2e/...`）

**Description**：plan.md Step 3.1。把所有 e2e 相關檔案搬到頂層 `tests/e2e/`：spec 平鋪、global-setup / window.d.ts / README 集中 `tests/e2e/_setup/`。

**Engineer Prompt** (派 Engineer-E2E-Mv-P3, `general-purpose`):

> 你是 Phase 3 e2e mv engineer。**只跑 mv + 必要 import 修正**，不動 playwright config / scripts / rules（留 Wave 3）。
>
> 1. 確認 sub-folder 已存在（Phase 0 已建 `tests/e2e/_setup/`）：
>    ```bash
>    [ -d tests/e2e/_setup ] || { echo "FATAL: tests/e2e/_setup missing"; exit 1; }
>    ```
> 2. 讀 inventory Table 1：
>    ```bash
>    awk '/^### Table 1/,/^### Table 2/' specs/023-tests-directory-migration/migration-inventory.md
>    ```
> 3. 對 `Type == spec` row 跑 `git mv <source> tests/e2e/<target-basename>`（target 直接平鋪在 `tests/e2e/`）
> 4. 對 `Type == global-setup` 跑 `git mv <source> tests/e2e/_setup/<feature>-global-setup.js`
> 5. 對 `Type == window.d.ts`：
>    - 若 inventory 標「全相同 → 保留一個」：保留 inventory 指定的那個 `git mv` 到 `tests/e2e/_setup/window.d.ts`，其他**列給主 agent** 回報「DUP_DELETE pending user confirm」**不自行 rm**
>    - 若分散：各自 `git mv` 到 `tests/e2e/_setup/<feature>-window.d.ts`
> 6. 對 `Type == README` 同上邏輯（DUP_DELETE 不自行 rm）
> 7. **import 修正**：每搬一個 .spec.js 立刻 grep 它原本的相對 import：
>    ```bash
>    grep -E "from ['\"](\.\.|/)" tests/e2e/<file>.spec.js
>    ```
>    最常見：`'../../../test-utils/e2e-helpers.js'` → 從 `tests/e2e/X.spec.js` 出發要改成 `'../_helpers/e2e-helpers.js'`（注意：T304 同步把 test-utils 搬到 `tests/_helpers/`，所以這裡改成新路徑而非舊路徑）
>    用 Edit 修正每個壞 import；mv 完跑：
>    ```bash
>    grep -rn "specs/test-utils\|\.\./\.\./\.\./test-utils\|\.\./\.\./test-utils\|\.\./test-utils" tests/e2e/
>    # 期望：empty（mv 完所有 e2e import 都已轉向 tests/_helpers/）
>    ```
> 8. global-setup.js 內若有 import test-utils（例 001 引 `../../../test-utils/e2e-helpers.js`），同樣 Edit 修：從 `tests/e2e/_setup/X-global-setup.js` 出發 → `'../../_helpers/e2e-helpers.js'`
> 9. **不 commit**、**不 edit 測試邏輯**（只改 import path）
>
> 完成後跑：
>
> ```bash
> # mv 數對齊 inventory（spec + global-setup + window.d.ts + README，扣除 DUP_DELETE 標記）
> moved=$(git status -s | grep -cE '^R.*-> tests/e2e/')
> echo "moved=$moved"
>
> # 殘留檢查
> remaining=$(find specs -path '*/tests/e2e/*' -type f | wc -l | tr -d ' ')
> echo "remaining_in_specs=$remaining"   # 期望 = DUP_DELETE 待決策數（≥0）
>
> # type-check 早期警報（Phase 1 坑 1：mv 不會改 import；Phase 1 坑 2：path.resolve 字串 type-check 抓不到 — 這裡只算第一道網）
> npm run type-check 2>&1 | tail -20
> ```
>
> 回報三個數字 + DUP_DELETE 待決策清單（含原因）+ type-check exit code。

**Acceptance Criteria**:

- [ ] `git status -s | grep -c '^R.*-> tests/e2e/'` ≈ inventory Table 1 mv 行數（扣除 DUP_DELETE）
- [ ] `tests/e2e/*.spec.js` 數 = inventory `Type == spec` row 數（11）
- [ ] `tests/e2e/_setup/` 下含搬入的 global-setup / window.d.ts / README
- [ ] 所有 mv 過的 e2e 檔內 `specs/test-utils` / `../test-utils` 字串為 0 命中（已轉向 `_helpers`）
- [ ] `npm run type-check` 通過（mv + import 修正後）
- [ ] DUP_DELETE 待決策清單已回報主 agent，**未自行 rm**
- [ ] 不 commit

**Verify Command** (Reviewer-E2E-Mv-P3, `Explore` 跑):

```bash
INV=specs/023-tests-directory-migration/migration-inventory.md
# 1. spec 數對齊
spec_expected=$(awk '/^### Table 1/,/^### Table 2/' "$INV" | grep -E '\| spec ' | grep -vc 'DUP_DELETE')
spec_actual=$(find tests/e2e -maxdepth 1 -name '*.spec.js' | wc -l | tr -d ' ')
[ "$spec_actual" -eq "$spec_expected" ] || { echo "FAIL: specs actual=$spec_actual expected=$spec_expected"; exit 1; }

# 2. R 標記數
moved=$(git status -s | grep -cE '^R.*-> tests/e2e/')
[ "$moved" -ge "$spec_expected" ] || { echo "FAIL: moved=$moved < expected $spec_expected"; exit 1; }

# 3. 沒有 spec_test-utils 引用殘留
leak=$(grep -rE "specs/test-utils|\.\./test-utils" tests/e2e/ 2>/dev/null | wc -l | tr -d ' ')
[ "$leak" -eq 0 ] || { echo "FAIL: $leak test-utils refs leaked"; grep -rnE "specs/test-utils|\.\./test-utils" tests/e2e/; exit 1; }

# 4. type-check
npm run type-check 2>&1 | tail -3 | grep -qE 'error TS|Type-checking failed' && { echo "FAIL: type-check"; exit 1; } || true

# 5. 沒誤動測試邏輯（diff 只應顯示 import path 變化）
git diff tests/e2e/ | grep -E '^[+-][^+-]' | grep -vE "^[+-].*from ['\"]" | grep -vE '^[+-]\s*$' | head -5 && echo "WARN: non-import diff lines found above" || echo "OK: only import diffs"

echo "PASS"
```

**期望**：`PASS`。

---

### T304 [Engineer-Helpers-P3] specs/test-utils/ → tests/\_helpers/ + 改 importer

**Files**：`specs/test-utils/{e2e-helpers,mock-helpers}.js` → `tests/_helpers/{e2e-helpers,mock-helpers}.js` + 所有 importer

**Description**：plan.md Step 3.2。把 test-utils 兩個 helper 搬到 `tests/_helpers/`，並修正所有引用它們的檔案的 import path。

**Engineer Prompt** (派 Engineer-Helpers-P3, `general-purpose`):

> 你是 Phase 3 helpers mv engineer。
>
> 1. 讀 inventory Table 2 + Decision Log 第 4 條（importer 範圍）
> 2. `git mv specs/test-utils/e2e-helpers.js tests/_helpers/e2e-helpers.js`
> 3. `git mv specs/test-utils/mock-helpers.js tests/_helpers/mock-helpers.js`
> 4. `specs/test-utils/` 此時應為空（無其他檔），但**不 rmdir**（git 不追空目錄；下個 commit 自然消失）
> 5. **修 importer**：對 inventory Decision Log 第 4 條列出的所有檔案，逐個用 Edit 把 import path 改成 `tests/_helpers/`。注意路徑深度：
>    - 從 `tests/e2e/X.spec.js` 出發：`../_helpers/e2e-helpers.js`（被 T303 處理）
>    - 從 `tests/e2e/_setup/Y-global-setup.js` 出發：`../../_helpers/e2e-helpers.js`（也被 T303 處理）
>    - 從 `playwright.emulator.config.mjs` 出發：`./tests/_helpers/e2e-helpers.js`（T306 會處理，本 task 確認 grep 命中）
>    - 從 `scripts/run-all-e2e.sh` 出發：bash 字串路徑通常不直接 import，但若有 `node -e "require('./specs/test-utils/...')"` 之類要改
>    - 注意：T303 已修 e2e 內部的 import；T304 只修 e2e **以外** 的 importer（playwright config / scripts / 非 e2e 測試 / 任何 `.js` 引用）。**T303 與 T304 約定**：T304 不動 `tests/e2e/**` 的 import；T303 不動 e2e 以外的 import。**邊界明確**。
> 6. 修完跑全 grep：
>    ```bash
>    grep -rnE "specs/test-utils|\.\./test-utils" specs/ scripts/ playwright*.mjs 2>/dev/null
>    # 期望：empty（除非有 inventory 指出但 T303 範圍的檔）
>    ```
> 7. **不 commit**
>
> 回報修改檔案清單 + 殘留 grep 命中數 + 是否觸發 `tests/_helpers/.gitkeep` 衝突（mv 進去後 .gitkeep 仍在，無妨）。

**Acceptance Criteria**:

- [ ] `tests/_helpers/e2e-helpers.js` + `tests/_helpers/mock-helpers.js` 存在（git status R 標記）
- [ ] `specs/test-utils/e2e-helpers.js` + `specs/test-utils/mock-helpers.js` 不存在
- [ ] `tests/_helpers/.gitkeep` 仍在（不被 mv 影響）
- [ ] e2e 範圍以外的 importer 全已改 import path（per inventory Decision Log 第 4 條）
- [ ] `grep -rnE "specs/test-utils|\.\./test-utils" specs/ scripts/ playwright*.mjs` 為 0 命中
- [ ] `npm run type-check` 通過
- [ ] 不 commit

**Verify Command** (Reviewer-Helpers-P3, `Explore` 跑):

```bash
# 1. mv done
[ -f tests/_helpers/e2e-helpers.js ] || { echo "FAIL: e2e-helpers not at new path"; exit 1; }
[ -f tests/_helpers/mock-helpers.js ] || { echo "FAIL: mock-helpers not at new path"; exit 1; }
[ ! -f specs/test-utils/e2e-helpers.js ] || { echo "FAIL: source still exists"; exit 1; }

# 2. git status R
moved=$(git status -s | grep -c '^R.*-> tests/_helpers/')
[ "$moved" -ge 2 ] || { echo "FAIL: R count=$moved < 2"; exit 1; }

# 3. 沒有 test-utils 殘留 ref（除 e2e 內部由 T303 處理）
leak=$(grep -rnE "specs/test-utils|(\.\./){1,5}test-utils" specs/ scripts/ playwright.config.mjs playwright.emulator.config.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$leak" -eq 0 ] || { echo "FAIL: $leak refs leaked"; grep -rnE "specs/test-utils|(\.\./){1,5}test-utils" specs/ scripts/ playwright*.mjs; exit 1; }

# 4. type-check
npm run type-check 2>&1 | tail -3 | grep -qE 'error TS|Type-checking failed' && { echo "FAIL: type-check"; exit 1; } || true

echo "PASS"
```

**期望**：`PASS`。

---

### T305 [Engineer-PWConfig-P3] playwright.config.mjs testDir swap

**Files**：`playwright.config.mjs`（line 7-8）

**Description**：plan.md Step 3.3。把預設 testDir 從 `./specs` 改成 `./tests/e2e`。低風險、單行改動。

**Engineer Prompt** (派 Engineer-PWConfig-P3, `general-purpose`):

> 你是 Phase 3 playwright.config.mjs engineer。**只動這一檔，不動 emulator config / scripts**（留 Wave 3）。
>
> 1. Read `playwright.config.mjs`
> 2. line 7: `testDir: './specs',` → `testDir: './tests/e2e',`
> 3. line 8 `testMatch: '**/*.spec.js'` 維持（mv 後仍對）
> 4. 其餘不動
> 5. 跑 `npm run type-check` 確認沒爆
>
> **不 commit**。回報 diff 與 type-check 結果。

**Acceptance Criteria**:

- [ ] line 7 改成 `testDir: './tests/e2e',`
- [ ] 其他 line 完全不動（diff 只顯示這一行）
- [ ] `npm run type-check` 通過
- [ ] 不 commit

**Verify Command** (Reviewer-PWConfig-P3, `Explore` 跑):

```bash
grep -q "testDir: './tests/e2e'" playwright.config.mjs || { echo "FAIL: testDir not changed"; exit 1; }
grep -q "testDir: './specs'" playwright.config.mjs && { echo "FAIL: old testDir still present"; exit 1; }
# diff 只有 1 行
diff_lines=$(git diff playwright.config.mjs | grep -E '^[+-][^+-]' | grep -v '^---\|^+++' | wc -l | tr -d ' ')
[ "$diff_lines" -eq 2 ] || { echo "FAIL: diff has $diff_lines changed lines (expect 2: 1 - and 1 +)"; git diff playwright.config.mjs; exit 1; }
echo "PASS"
```

**期望**：`PASS`。

---

## Phase 3 Wave 3 — 配置 / 規則同步（並行 3 agents）

> **啟動條件**：Wave 2 (T303 + T304 + T305) 全 PASS。
>
> **設計理由**：T306 emulator 重寫**最高風險**（plan.md Step 3.4 註明），但與 T307 / T308 動的是不同檔，並行不互相干擾；給每個 reviewer 各自把關。

### T306 [Engineer-PWEmu-P3] playwright.emulator.config.mjs 架構重寫（HIGH RISK）

**Files**：`playwright.emulator.config.mjs`（整檔重寫）

**Description**：plan.md Step 3.4。拋棄 `E2E_FEATURE` env var ↔ spec folder 的三向綁定，改成「全跑 `tests/e2e/`，多 globalSetup 用 Playwright `projects` array 各自綁定」。global-setup.js 改路徑指向 `tests/e2e/_setup/<feature>-global-setup.js`。

**Engineer Prompt** (派 Engineer-PWEmu-P3, `general-purpose`):

> 你是 Phase 3 emulator config 架構重寫 engineer。**HIGH RISK** — 這是 plan.md Step 3.4 標註風險最高的改動。
>
> ### Step A：理解原邏輯
>
> 讀 `playwright.emulator.config.mjs` 全檔。重點：
>
> - line 25-46 用 `E2E_FEATURE` env var 動態組 `featureE2eDir = './specs/${feature}/tests/e2e'`
> - 派生出 `globalSetupPath = ${featureE2eDir}/global-setup.js`
> - `testDir` / `globalSetup` 兩個都吃這個動態路徑
>
> ### Step B：選定新架構（兩擇一）
>
> **方案 1**（推薦）：保留 `E2E_FEATURE` env var 但改成 selector，testDir 固定 `./tests/e2e`，globalSetup 改成 `./tests/e2e/_setup/${feature}-global-setup.js`。`testMatch` 改成 grep `<feature>` 字串的 spec？或維持全 spec？選一致選法。
>
> **方案 2**：完全拋棄 `E2E_FEATURE` — 每個 feature 變成 Playwright `projects` array 一個 entry，各自 `testMatch` + `globalSetup`。一次 `npx playwright test --config playwright.emulator.config.mjs` 就跑全部。
>
> 決策依據：方案 1 變動小（branch script 仍能用 `E2E_FEATURE` 帶 feature 跑），方案 2 對齊 plan.md「拋棄三向綁定」精神但變動大、且每個 spec 一個 project 配置變得繁雜。
>
> **建議方案 1**（變動小、向後相容 branch script），但要在重寫檔頭 JSDoc 註明「globalSetup 從 `./tests/e2e/_setup/${feature}-global-setup.js` 解析；feature 字串為 `<NNN-feature-name>` 對應原 spec folder 名」。
>
> ### Step C：實作（方案 1）
>
> 1. line 25-26：`const featureE2eDir = './specs/${feature}/tests/e2e';` 整段刪除（改成 `const setupDir = './tests/e2e/_setup';`）
> 2. line 28-32 `if (!existsSync(featureE2eDir))` 改成 `const globalSetupPath = \`${setupDir}/${feature}-global-setup.js\`; if (!existsSync(globalSetupPath)) { throw ... }`
> 3. `testDir` 改成 `'./tests/e2e'`（固定，不再吃 feature 變量）
> 4. `globalSetup` 維持 `existsSync(globalSetupPath) ? globalSetupPath : undefined`（path 已換）
> 5. 檔頭 JSDoc 改：
>    - `Resolves testDir and globalSetup dynamically from specs/<feature>/tests/e2e/.` → `testDir is fixed at ./tests/e2e/. globalSetup is resolved from ./tests/e2e/_setup/<feature>-global-setup.js based on E2E_FEATURE env var.`
>    - 範例 usage 不變（`E2E_FEATURE=004-event-edit-delete npx playwright test ...`）
> 6. 報錯文字（line 31-33）同步更新到新路徑
>
> ### Step D：驗證
>
> ```bash
> # 1. type-check（emulator config 是 .mjs，type-check 會掃）
> npm run type-check 2>&1 | tail -10
>
> # 2. dry parse
> node --input-type=module -e "import('./playwright.emulator.config.mjs').catch(e => { console.error(e.message); process.exit(0); })"
> # 期望：無 syntax / import error；E2E_FEATURE 沒設時 throw 預期 error（這是 design）
>
> # 3. 帶 E2E_FEATURE 試 parse（只看 config 載入，不真跑 playwright）
> E2E_FEATURE=004-event-edit-delete node --input-type=module -e "import('./playwright.emulator.config.mjs').then(m => console.log('testDir:', m.default.testDir, 'globalSetup:', m.default.globalSetup))"
> # 期望：testDir: ./tests/e2e, globalSetup: ./tests/e2e/_setup/004-event-edit-delete-global-setup.js
> ```
>
> **不真跑** `npx playwright test`（要 dev server + emulator，留 Wave 6 smoke）。**不 commit**。
>
> 回報：採用方案、diff 摘要、Step D 三個輸出。

**Acceptance Criteria**:

- [ ] `playwright.emulator.config.mjs` 內 `specs/${feature}/tests/e2e` 字串 0 命中
- [ ] testDir 固定為 `'./tests/e2e'`（hard-coded，不再用 feature 變量組成）
- [ ] globalSetup path 改成從 `./tests/e2e/_setup/<feature>-global-setup.js` 解析
- [ ] 檔頭 JSDoc 已同步說明新邏輯
- [ ] `node --input-type=module -e "import('./playwright.emulator.config.mjs')"` 在帶 `E2E_FEATURE` 時可成功 import 並 log 出 testDir / globalSetup 為新路徑
- [ ] `npm run type-check` 通過
- [ ] 不 commit

**Verify Command** (Reviewer-PWEmu-P3, `Explore` 跑):

```bash
F=playwright.emulator.config.mjs
# 1. 舊路徑字串 0 命中
old=$(grep -cE 'specs/\$\{feature\}/tests/e2e|specs/.+/tests/e2e' "$F")
[ "$old" -eq 0 ] || { echo "FAIL: $old old refs"; grep -nE 'specs/\$\{feature\}|specs/.+/tests/e2e' "$F"; exit 1; }

# 2. 新路徑存在
grep -q "tests/e2e/_setup" "$F" || { echo "FAIL: new _setup path missing"; exit 1; }
grep -q "testDir: './tests/e2e'" "$F" || { echo "FAIL: testDir not fixed to ./tests/e2e"; exit 1; }

# 3. dry import 帶 E2E_FEATURE
out=$(E2E_FEATURE=004-event-edit-delete node --input-type=module -e "import('./playwright.emulator.config.mjs').then(m => { console.log('OK', m.default.testDir, m.default.globalSetup); }).catch(e => { console.error('FAIL', e.message); process.exit(1); })" 2>&1)
echo "$out" | grep -q "^OK ./tests/e2e .*tests/e2e/_setup/004-event-edit-delete-global-setup.js" || { echo "FAIL: dry import wrong: $out"; exit 1; }

# 4. type-check
npm run type-check 2>&1 | tail -3 | grep -qE 'error TS' && { echo "FAIL: type-check"; exit 1; } || true
echo "PASS"
```

**期望**：`PASS`。

---

### T307 [Engineer-Scripts-P3] branch scripts 重寫

**Files**：`scripts/test-branch.sh` / `scripts/test-e2e-branch.sh` / `scripts/run-all-e2e.sh`

**Description**：plan.md Step 3.5。三個 shell script 仍用 `specs/<branch>/tests/...` 找測試 — 改成從 `tests/{unit,integration,e2e}/` 找，並用 `git diff main...HEAD --name-only` 抓本 branch 的測試改動。

**Engineer Prompt** (派 Engineer-Scripts-P3, `general-purpose`):

> 你是 Phase 3 branch scripts engineer。動三個 shell script。每個檔的修法：
>
> ### scripts/test-branch.sh（Vitest unit + integration）
>
> 原邏輯：找 `specs/$BRANCH/tests/{unit,integration}/`。改成：
>
> ```bash
> #!/usr/bin/env bash
> # Run Vitest (unit + integration) only for current branch's changed test files
> set -euo pipefail
>
> # Get changed .test.* files under tests/ between current branch and main
> CHANGED_TESTS=$(git diff --name-only main...HEAD -- 'tests/unit/**' 'tests/integration/**' 'tests/_helpers/**' 2>/dev/null | grep -E '\.test\.(js|jsx)$' || true)
>
> if [ -z "$CHANGED_TESTS" ]; then
>   echo "No changed unit/integration tests on this branch — skipping."
>   exit 0
> fi
>
> # Pass changed files to vitest (or fall back to dirs if too many)
> echo "Running vitest on:"
> echo "$CHANGED_TESTS"
> # shellcheck disable=SC2086
> npx vitest run --project=browser $CHANGED_TESTS
> ```
>
> ### scripts/test-e2e-branch.sh（Playwright）
>
> 原邏輯：找 `specs/$BRANCH/tests/e2e/`。改成：
>
> ```bash
> #!/usr/bin/env bash
> # Run Playwright E2E for current branch's changed spec files
> set -euo pipefail
>
> CHANGED_SPECS=$(git diff --name-only main...HEAD -- 'tests/e2e/**' 2>/dev/null | grep -E '\.spec\.(js|jsx)$' || true)
>
> if [ -z "$CHANGED_SPECS" ]; then
>   echo "No changed E2E specs on this branch — skipping."
>   exit 0
> fi
>
> # E2E_FEATURE 仍可用：若有設，跑 emulator config + 該 feature 的 globalSetup
> if [ -n "${E2E_FEATURE:-}" ]; then
>   # shellcheck disable=SC2086
>   npx playwright test --config playwright.emulator.config.mjs $CHANGED_SPECS
> else
>   # shellcheck disable=SC2086
>   npx playwright test --config playwright.config.mjs $CHANGED_SPECS
> fi
> ```
>
> ### scripts/run-all-e2e.sh（CI 全跑）
>
> 原邏輯：`for e2e_dir in specs/*/tests/e2e`。改成：每個 globalSetup 對應一個 feature → loop globalSetup files，對每個 feature 個別跑 emulator config（保留每 feature 之間 reset emulator state 的邏輯）。
>
> ```bash
> # ... emulator + dev server 啟動段不動 ...
>
> # 從 tests/e2e/_setup/*-global-setup.js 列出所有 feature
> for setup in tests/e2e/_setup/*-global-setup.js; do
>   feature=$(basename "$setup" -global-setup.js)
>   echo "Running E2E for feature: $feature"
>
>   # Reset emulator state（不動）
>   curl -s -o /dev/null -X DELETE "http://localhost:9099/emulator/v1/projects/dive-into-run/accounts" || true
>   curl -s -o /dev/null -X DELETE "http://localhost:8080/emulator/v1/projects/dive-into-run/databases/(default)/documents" || true
>   sleep 1
>
>   if E2E_FEATURE="$feature" npx playwright test --config playwright.emulator.config.mjs; then
>     PASSED=$((PASSED + 1))
>   else
>     FAILED_FEATURES+=("$feature")
>   fi
> done
>
> # 再加一次跑「無 globalSetup 的 spec」（不需 emulator 的 vanilla e2e）
> if find tests/e2e -maxdepth 1 -name '*.spec.js' | head -1 > /dev/null; then
>   echo "Running E2E specs without globalSetup..."
>   npx playwright test --config playwright.config.mjs || FAILED_FEATURES+=("vanilla")
> fi
> ```
>
> ### 共通檢查
>
> ```bash
> bash -n scripts/test-branch.sh
> bash -n scripts/test-e2e-branch.sh
> bash -n scripts/run-all-e2e.sh
> shellcheck scripts/test-branch.sh scripts/test-e2e-branch.sh scripts/run-all-e2e.sh 2>/dev/null || echo "(shellcheck not installed, skip)"
> ```
>
> **不真跑 vitest / playwright**（留 Wave 6 smoke）。**不 commit**。
>
> 回報三個檔的 diff 摘要 + bash -n 結果。

**Acceptance Criteria**:

- [ ] `scripts/test-branch.sh` 不再含 `specs/$BRANCH/tests`、改成 `git diff main...HEAD -- tests/**`
- [ ] `scripts/test-e2e-branch.sh` 同上
- [ ] `scripts/run-all-e2e.sh` 不再含 `specs/*/tests/e2e`、改成從 `tests/e2e/_setup/*-global-setup.js` 列 feature
- [ ] 三個 script `bash -n` 全綠
- [ ] 不 commit

**Verify Command** (Reviewer-Scripts-P3, `Explore` 跑):

```bash
for f in scripts/test-branch.sh scripts/test-e2e-branch.sh scripts/run-all-e2e.sh; do
  bash -n "$f" || { echo "FAIL: $f bash -n"; exit 1; }
  grep -qE "specs/.+/tests/(unit|integration|e2e)|specs/\\\$BRANCH/tests|specs/\\*/tests" "$f" && { echo "FAIL: $f still has specs/.../tests refs"; exit 1; } || true
  grep -q "tests/" "$f" || { echo "FAIL: $f doesn't reference new tests/ path"; exit 1; }
done
echo "PASS"
```

**期望**：`PASS`。

---

### T308 [Engineer-Rules-P3] .claude/rules/e2e-commands.md frontmatter

**Files**：`.claude/rules/e2e-commands.md`（frontmatter line 2-4 + 內容範例）

**Description**：plan.md Step 3.6。`paths` frontmatter 從 `specs/**/e2e/**` 改成 `tests/e2e/**`，內容範例同步。

**Engineer Prompt** (派 Engineer-Rules-P3, `general-purpose`):

> 你是 Phase 3 e2e-commands rule engineer。
>
> 1. 啟動先試小 Edit 驗證 `.claude/**` 寫入是否仍 deny（Phase 0 警告，Phase 2 T203 已驗證可寫但仍小心）：
>    ```bash
>    # 試加空白並撤銷
>    head -1 .claude/rules/e2e-commands.md
>    ```
>    若 Edit deny → 立即 STOP escalate user。
> 2. Edit `.claude/rules/e2e-commands.md` frontmatter line 2-4：
>    ```yaml
>    paths:
>      - 'specs/**/e2e/**' # 刪
>      - '**/*.spec.js' # 維持
>      - 'scripts/run-all-e2e.sh' # 維持
>    ```
>    改成：
>    ```yaml
>    paths:
>      - 'tests/e2e/**'
>      - '**/*.spec.js'
>      - 'scripts/run-all-e2e.sh'
>    ```
> 3. 內容段（# E2E Commands 下方）若有寫死路徑範例（例 `npx playwright test specs/path/to/file.spec.js`）→ 改成 `tests/e2e/path/to/file.spec.js`
> 4. **不 commit**
>
> 完成跑：
>
> ```bash
> grep -c "specs/.*e2e" .claude/rules/e2e-commands.md   # 期望 0
> grep -c "tests/e2e" .claude/rules/e2e-commands.md     # 期望 ≥ 1
> ```

**Acceptance Criteria**:

- [ ] frontmatter `paths` 不再含 `specs/**/e2e/**`
- [ ] 含 `tests/e2e/**`
- [ ] 內容段範例路徑同步（無 `specs/.../e2e/` 殘留）
- [ ] 不 commit

**Verify Command** (Reviewer-Rules-P3, `Explore` 跑):

```bash
F=.claude/rules/e2e-commands.md
old=$(grep -c "specs/.*e2e" "$F")
[ "$old" -eq 0 ] || { echo "FAIL: $old old refs"; grep -n "specs/.*e2e" "$F"; exit 1; }
new=$(grep -c "tests/e2e" "$F")
[ "$new" -ge 1 ] || { echo "FAIL: no new refs"; exit 1; }
echo "PASS"
```

**期望**：`PASS`。

---

## Phase 3 Wave 4 — cleanup（並行 2 agents）

> **啟動條件**：Wave 3 (T306 + T307 + T308) 全 PASS。

### T309 [Engineer-Policy-P3] policy.js 拆除舊 4 bucket

**Files**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`（多區塊 patch）+ 同一 commit 改 `specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js:124`（已被 Phase 1 mv 到 `tests/unit/lib/test-bucket-policy.test.js`）

**Description**：plan.md Step 3.7。Phase 0 留下的「並存期 8 bucket」拆回 4 bucket — 移除舊 `unit` / `integration` / `e2e` / `specs-test-utils`，保留新 `unit-tests-root` / `integration-tests-root` / `e2e-tests-root` / `tests-helpers`。`KNOWN_S015_UNIT_CONFLICTS` 已被 Phase 1 改成 `Object.freeze([])` 不動。

**Engineer Prompt** (派 Engineer-Policy-P3, `general-purpose`):

> 你是 Phase 3 policy.js 拆除 engineer。**HIGH SCOPE** — 觸碰 6 個區塊（Phase 0 patch A-F 對稱拆除）。
>
> ### Step A：先確認舊 bucket 已無 source match
>
> ```bash
> # 舊 unit bucket：specs/.+/tests/unit/.+.test.{js,jsx}
> find specs -path '*/tests/unit/*' \( -name '*.test.js' -o -name '*.test.jsx' \) | wc -l
> # 期望 0（Phase 1 全 mv 完）；若 >0 → STOP 回報殘留檔，不能拆 bucket
>
> # 舊 integration
> find specs -path '*/tests/integration/*' \( -name '*.test.js' -o -name '*.test.jsx' \) | wc -l
> # 期望 0（Phase 2 全 mv 完）
>
> # 舊 e2e
> find specs -path '*/tests/e2e/*' \( -name '*.spec.js' -o -name '*.spec.jsx' \) | wc -l
> # 期望 0（Phase 3 Wave 2 T303 mv 完，扣除 DUP_DELETE 的 README/window.d.ts，這條只算 .spec.*）
>
> # 舊 specs-test-utils
> [ -d specs/test-utils ] && find specs/test-utils -name '*.js' | wc -l || echo 0
> # 期望 0（T304 mv 完）
> ```
>
> 任一 > 0 → 立即 STOP 回報殘留路徑，**不繼續拆 bucket**。
>
> ### Step B：拆除舊 bucket（policy.js 6 個對稱區塊）
>
> 對下列每個區塊：找出 `unit:` / `integration:` / `e2e:` / `'specs-test-utils':` 4 條 entry，刪除（保留新加的 `*-tests-root` / `tests-helpers`）。
>
> 1. **TEST_BUCKET_FILE_PATTERNS**（line 11-20）：刪 4 條
> 2. **DEPCRUISE_DENY_PATTERNS**（line 22-51 附近）：刪 4 條
> 3. **TEST_BUCKET_RULES**（Phase 0 加的對應區塊）：刪 4 條
> 4. **depCruiseTestBucketRules**：刪 4 條
> 5. **TEST_BUCKET_DEPCRUISE_ARTIFACTS**：刪 4 條
> 6. **`isAllowedRelativeDependency`** 早返分支：原本 unit/integration/e2e/specs-test-utils 各自分支 — 全刪（新 4 個分支保留）
>
> ### Step C：同步改 test-bucket-policy.test.js `.toEqual` 從 8-bucket 改回 4-bucket
>
> Edit `tests/unit/lib/test-bucket-policy.test.js`（Phase 1 已從 `specs/021-.../tests/unit/test-bucket-policy.test.js` mv 過來）。找到 `.toEqual([` 後 8 個字串 array：
>
> ```js
> .toEqual([
>   'unit',                    // 刪
>   'integration',             // 刪
>   'e2e',                     // 刪
>   'specs-test-utils',        // 刪
>   'unit-tests-root',
>   'integration-tests-root',
>   'e2e-tests-root',
>   'tests-helpers',
> ]);
> ```
>
> 改成：
>
> ```js
> .toEqual([
>   'unit-tests-root',
>   'integration-tests-root',
>   'e2e-tests-root',
>   'tests-helpers',
> ]);
> ```
>
> ### Step D：驗證
>
> ```bash
> # 1. bucket count = 4
> node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => console.log('buckets:', Object.keys(m.testBucketPolicy.bucketMatchers).length))"
> # 期望：buckets: 4
>
> # 2. depcruise 全綠（新 bucket 仍 catch tests/ 下的測試）
> npm run depcruise 2>&1 | tail -10
>
> # 3. 全 quality gate
> npm run lint -- --max-warnings 0 2>&1 | tail -5
> npm run type-check 2>&1 | tail -5
> npx vitest run --project=browser tests/unit/lib/test-bucket-policy.test.js 2>&1 | tail -10
> # 期望：8-bucket .toEqual 改 4-bucket 後 test 仍綠
> ```
>
> **不 commit**。policy.js + test-bucket-policy.test.js 兩個改動會在 Wave 7b T314 一起 commit。
>
> 回報：6 個區塊 diff line 數 + Step A 4 個 find 結果 + Step D 驗證輸出。

**Acceptance Criteria**:

- [ ] Step A 4 個 find 全 = 0（無殘留 source）
- [ ] policy.js 內 6 個對稱區塊各刪 4 條舊 entry，保留 4 條新 entry
- [ ] `node -e "import().then(m => Object.keys(m.testBucketPolicy.bucketMatchers).length)"` = 4
- [ ] `tests/unit/lib/test-bucket-policy.test.js` `.toEqual` array 從 8 elements 改回 4 elements（只保留 `*-tests-root` + `tests-helpers`）
- [ ] `npm run depcruise && npm run lint && npm run type-check && npx vitest run --project=browser tests/unit/lib/test-bucket-policy.test.js` 全綠
- [ ] 不 commit

**Verify Command** (Reviewer-Policy-P3, `Explore` 跑):

```bash
P=specs/021-layered-dependency-architecture/test-buckets/policy.js
T=tests/unit/lib/test-bucket-policy.test.js

# 1. policy.js bucket 數
buckets=$(node -e "import('./$P').then(m => console.log(Object.keys(m.testBucketPolicy.bucketMatchers).length)).catch(e => { console.error(e.message); process.exit(1); })" 2>&1)
[ "$buckets" -eq 4 ] || { echo "FAIL: buckets=$buckets expect 4"; exit 1; }

# 2. 舊 bucket key 全清除
for old in "'unit'" "'integration'" "'e2e'" "'specs-test-utils'"; do
  grep -E "^\s+$old:" "$P" && { echo "FAIL: old bucket $old still in policy.js"; exit 1; } || true
done

# 3. test 檔 .toEqual array 從 8 變 4
arrlen=$(awk '/\.toEqual\(\[/,/\]\);/' "$T" | grep -c "^\s*'")
[ "$arrlen" -eq 4 ] || { echo "FAIL: .toEqual has $arrlen elements expect 4"; exit 1; }

# 4. depcruise / lint / type-check / vitest 全綠
npm run depcruise 2>&1 | tail -3 | grep -qiE 'error|fail' && { echo "FAIL: depcruise"; exit 1; } || true
npm run type-check 2>&1 | tail -3 | grep -qiE 'error TS' && { echo "FAIL: type-check"; exit 1; } || true
npx vitest run --project=browser "$T" 2>&1 | tail -3 | grep -qE 'failed|FAIL' && { echo "FAIL: vitest"; exit 1; } || true
echo "PASS"
```

**期望**：`PASS`。

---

### T310 [Engineer-Docs-P3] root docs 同步（CLAUDE.md / AGENTS.md / GEMINI.md）

**Files**：`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`（grep 命中行）

**Description**：plan.md Step 3.8。三個 root doc 仍寫舊 `specs/<feature>/tests/...` 範例 — 同步到新 `tests/{unit,integration,e2e}/`。

**Engineer Prompt** (派 Engineer-Docs-P3, `general-purpose`):

> 你是 Phase 3 root docs engineer。
>
> 1. `grep -nE 'specs/<.+>/tests|specs/\$BRANCH/tests|specs/\*/tests|specs/.+/test-results' CLAUDE.md AGENTS.md GEMINI.md` 列所有命中行
> 2. 對每個命中：
>    - `specs/<feature>/tests/[unit|integration|e2e]/` → `tests/[unit|integration|e2e]/`
>    - `specs/<feature>/test-results/` → `tests/test-results/`（per Phase 0 testing-standards.md 並存期描述體例）
>    - 若行內含「並存期」說明（Phase 0 加過）→ 改成「Phase 3 完成，舊 specs/<feature>/tests/ 已清空，僅 git history 保留」
> 3. **不動** `.claude/rules/coding-rules.md` / `.claude/rules/testing-standards.md`（前者只是 lint hint paths，後者 Phase 0 已改）
> 4. **不動** `.claude/rules/e2e-commands.md`（T308 已改）
> 5. **不 commit**
>
> 完成跑：
>
> ```bash
> grep -cnE 'specs/.+/tests' CLAUDE.md AGENTS.md GEMINI.md
> # 期望全 0（除非是 git history / archive 用語的引用，例外要在 Notes 說明）
> ```

**Acceptance Criteria**:

- [ ] CLAUDE.md / AGENTS.md / GEMINI.md 不含 `specs/<feature>/tests/` / `specs/$BRANCH/tests/` / `specs/*/tests/` 字串
- [ ] 三檔內 `tests/{unit,integration,e2e}` 字串至少各 1 處（用新路徑）
- [ ] 不 commit

**Verify Command** (Reviewer-Docs-P3, `Explore` 跑):

```bash
for f in CLAUDE.md AGENTS.md GEMINI.md; do
  old=$(grep -cE 'specs/[^/]+/tests/(unit|integration|e2e)|specs/\$BRANCH/tests|specs/\*/tests/(unit|integration|e2e)' "$f")
  [ "$old" -eq 0 ] || { echo "FAIL: $f has $old old refs"; grep -nE 'specs/[^/]+/tests' "$f"; exit 1; }
done
echo "PASS"
```

**期望**：`PASS`。

---

## Phase 3 Wave 5 — placeholder removal（1 agent）

> **啟動條件**：Wave 4 (T309 + T310) 全 PASS。
>
> **獨立 wave 設計理由**：`tests/_placeholder.js` 是 Phase 0 為「ESLint 9 對空 `tests/` 抱怨」加的補丁；Phase 1-3 把真實測試搬進來後失去存在意義（per Phase 0 handoff §「給下個 session 的 Phase 1-3 注意事項」第 2 條）。但 rm 它要先確認 `tests/` 內已有真實測試 — 順序上必須在 Wave 2-4 之後。獨立 wave 也方便 reviewer 專心驗。

### T311 [Engineer-Placeholder-P3] rm tests/\_placeholder.js + 維持 tsconfig include

**Files**：`tests/_placeholder.js`（刪除）

**Description**：plan.md 隱含（per Phase 0 handoff）。Phase 1-3 完成後 `tests/` 已有大量真實 .js / .jsx 測試 — 三道 quality gate（depcruise / ESLint / spellcheck）對「空 tests/」的抱怨自動消失，placeholder 可拆。

**Engineer Prompt** (派 Engineer-Placeholder-P3, `general-purpose`):

> 你是 Phase 3 placeholder removal engineer。
>
> 1. 確認 `tests/` 內已有真實測試（>10 個 .test 檔）：
>    ```bash
>    test_count=$(find tests -type f \( -name '*.test.js' -o -name '*.test.jsx' -o -name '*.spec.js' \) | wc -l | tr -d ' ')
>    echo "real test files: $test_count"
>    [ "$test_count" -ge 10 ] || { echo "ABORT: too few real tests, do not remove _placeholder yet"; exit 1; }
>    ```
> 2. `git rm tests/_placeholder.js`
> 3. 跑 quality gate 全套確認 `_placeholder.js` 沒了之後仍綠：
>    ```bash
>    npm run depcruise 2>&1 | tail -5
>    npm run lint -- --max-warnings 0 2>&1 | tail -5
>    npm run type-check 2>&1 | tail -5
>    npm run spellcheck 2>&1 | tail -5
>    ```
> 4. **不動** `tsconfig.json` 的 `include: ["tests"]`（Phase 0 加進去的；現在 tests/ 有大量真實檔，更需要保留 include）
> 5. **不 commit**
>
> 回報：刪除確認 + 4 個 gate 結果。

**Acceptance Criteria**:

- [ ] `tests/_placeholder.js` 不存在（`git status` 顯示 D）
- [ ] `tsconfig.json` 仍含 `"tests"` 在 include array
- [ ] depcruise / lint / type-check / spellcheck 全綠
- [ ] 不 commit

**Verify Command** (Reviewer-Placeholder-P3, `Explore` 跑):

```bash
[ ! -f tests/_placeholder.js ] || { echo "FAIL: still exists"; exit 1; }
git status -s | grep -q '^D.*tests/_placeholder.js' || { echo "FAIL: not staged for delete"; git status -s | head; exit 1; }
grep -q '"tests"' tsconfig.json || { echo "FAIL: tsconfig include lost tests"; exit 1; }
for cmd in 'depcruise' 'lint -- --max-warnings 0' 'type-check' 'spellcheck'; do
  npm run $cmd 2>&1 | tail -3 | grep -qiE 'error|fail' && { echo "FAIL: npm run $cmd"; exit 1; } || true
done
echo "PASS"
```

**期望**：`PASS`。

---

## Phase 3 Wave 6 — Smoke test（1 agent）

### T312 [Engineer-Smoke-P3] 完整 quality gate smoke + Phase 3 specific 驗證

**Dependency**：T301-T311 全完成

**Description**：跟 Phase 0 T012 / Phase 1 T111 / Phase 2 T211 同設計，分區塊驗證。**主 agent 派 Engineer-Smoke-P3 跑，主 agent 不自己跑**。

**Engineer Prompt** (派 Engineer-Smoke-P3, `general-purpose`):

> 你是 Phase 3 Wave 6 smoke test engineer。依序跑下列 5 + 5 區塊。**任一失敗 → 不要嘗試修，回報具體哪步、stderr 摘要、推測對應 source task**。
>
> ```bash
> # ---------- Quality Gate 5 連跑（type-check 排首位 — Phase 1/2 經驗）----------
> # 1. type-check
> npm run type-check
>
> # 2. depcruise — 4 bucket pattern 啟動（舊已拆，新 4 bucket 對 tests/ 全 source 0 violations）
> npm run depcruise
>
> # 3. lint
> npm run lint -- --max-warnings 0
>
> # 4. spellcheck
> npm run spellcheck
>
> # 5. vitest browser project（避 g8 server emulator throw）
> npx vitest run --project=browser
>
> # ---------- Phase 3 specific 5 區塊 ----------
> # 6. bucket count = 4（舊 4 已拆）
> node -e "import('./specs/021-layered-dependency-architecture/test-buckets/policy.js').then(m => { const n = Object.keys(m.testBucketPolicy.bucketMatchers).length; console.log('bucket_count=', n); process.exit(n === 4 ? 0 : 1); })"
>
> # 7. tests/_placeholder.js 已刪
> [ ! -f tests/_placeholder.js ] && echo "OK: placeholder gone" || { echo "FAIL: placeholder still"; exit 1; }
>
> # 8. specs/<NNN>/tests/{unit,integration,e2e}/ 全清空
> find specs -path '*/tests/unit/*' -type f | wc -l   # 期望 0（除 g8 KEEP 2 檔）
> find specs -path '*/tests/integration/*' -type f | wc -l   # 期望 0
> find specs -path '*/tests/e2e/*' -type f | wc -l   # 期望 0 (扣除 DUP_DELETE 後)
> find specs/test-utils -type f 2>/dev/null | wc -l   # 期望 0
> # g8 兩檔例外：
> find specs/g8-server-coverage/tests -type f | wc -l   # 期望 2 (KEEP)
>
> # 9. tests/e2e/ 結構（spec 平鋪 + _setup 集中）
> ls tests/e2e/ | head
> spec_count=$(find tests/e2e -maxdepth 1 -name '*.spec.js' | wc -l | tr -d ' ')
> echo "tests/e2e spec count: $spec_count"   # 期望 ≥ 11（扣 DUP_DELETE）
> setup_count=$(find tests/e2e/_setup -maxdepth 1 -name '*-global-setup.js' | wc -l | tr -d ' ')
> echo "global-setup count: $setup_count"   # 期望 5
>
> # 10. playwright config dry import
> node --input-type=module -e "import('./playwright.config.mjs').then(m => console.log('default config testDir:', m.default.testDir))"
> # 期望：testDir: ./tests/e2e
> E2E_FEATURE=004-event-edit-delete node --input-type=module -e "import('./playwright.emulator.config.mjs').then(m => console.log('emu testDir:', m.default.testDir, 'globalSetup:', m.default.globalSetup))"
> # 期望：./tests/e2e + tests/e2e/_setup/004-event-edit-delete-global-setup.js
> ```
>
> ### 失敗處理表（給主 agent dispatch 修）
>
> | 失敗區塊                        | 對應 source task | 修法                                                                          |
> | ------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
> | 1 type-check                    | T303 / T304      | mv 後 import 沒修；派回對應 engineer grep 殘留 import 修                      |
> | 2 depcruise                     | T309             | 舊 bucket 沒拆乾淨 / 新 bucket pattern 沒 catch；派回 T309 engineer 看 6 區塊 |
> | 3 lint                          | T303-T310        | mv 帶來的 ESLint warning（未用 import）；派回對應 engineer 修                 |
> | 5 vitest                        | T303 / T304      | mv 後 path arithmetic 錯（Phase 1 坑 2）；派回對應 engineer grep 修           |
> | 6 bucket count                  | T309             | policy.js 6 區塊沒拆完整；派回 T309                                           |
> | 7 placeholder                   | T311             | 沒刪；派回 T311                                                               |
> | 8 specs 殘留                    | T303 / T304      | mv 沒搬完；派回對應 engineer                                                  |
> | 9 e2e 結構                      | T303             | spec 平鋪 / setup 集中沒做對；派回 T303                                       |
> | 10 playwright config dry import | T305 / T306      | config 沒改對；派回對應 engineer                                              |
>
> 不嘗試修 — 回報具體哪步 + 推測 source task。

**Acceptance Criteria**:

- [ ] 區塊 1-5（quality gate 5 連跑）全綠
- [ ] 區塊 6 bucket count = 4
- [ ] 區塊 7 placeholder 已刪
- [ ] 區塊 8 `specs/<NNN>/tests/` 全空（除 g8 KEEP 2 檔）；`specs/test-utils/` 空
- [ ] 區塊 9 `tests/e2e/*.spec.js` ≥ 11、`tests/e2e/_setup/*-global-setup.js` = 5
- [ ] 區塊 10 兩個 playwright config dry import 都印出新路徑

---

## Phase 3 Wave 7a — Commit 1: mv（1 agent）

> **拆 commit 設計理由**（沿用 Phase 2 體例）：
>
> - **mv 與 mv 帶來的 import 修正同 commit**（Wave 2 T303-T305 改動）→ Commit 1 純粹 mv + import 同步
> - **config 重寫 / cleanup / inventory + handoff 與 mv 解耦**（Wave 3-5 + inventory）→ Commit 2
> - 兩 commit 各自 pre-commit 全綠，PR review 較容易（Commit 1 看 mv，Commit 2 看 config rewrite + cleanup）

### T313 [Engineer-Commit-Mv-P3] Commit 1: mv only

**Dependency**：T312 全綠

**Engineer Prompt** (派 Engineer-Commit-Mv-P3, `general-purpose`):

> 你是 Phase 3 Commit 1 engineer。**只 commit「mv + mv 帶來的 import 修正」一組**。
>
> ### Commit 1 該包
>
> - `R  specs/<NNN>/tests/e2e/X.spec.js -> tests/e2e/X.spec.js`（11 個 spec）
> - `R  specs/<NNN>/tests/e2e/global-setup.js -> tests/e2e/_setup/<NNN>-global-setup.js`（5 個）
> - `R  specs/<NNN>/tests/e2e/window.d.ts -> tests/e2e/_setup/...` 或 DUP_DELETE 走 D
> - `R  specs/<NNN>/tests/e2e/README.md -> tests/e2e/_setup/...` 或 DUP_DELETE 走 D
> - `R  specs/test-utils/e2e-helpers.js -> tests/_helpers/e2e-helpers.js`
> - `R  specs/test-utils/mock-helpers.js -> tests/_helpers/mock-helpers.js`
> - `M  tests/e2e/**/*.spec.js`（T303 修的相對 import）
> - `M  tests/e2e/_setup/*-global-setup.js`（T303 修的相對 import）
> - `M  其他 importer`（T304 改的非 e2e importer，例如可能的 playwright config 內字串引用 — 但 playwright config 重寫留 Commit 2，這裡只該有 helpers import 修正命中的非 config 檔）
>
> ### Commit 1 不該包
>
> - `M  playwright.config.mjs`（T305，留 Commit 2）
> - `M  playwright.emulator.config.mjs`（T306）
> - `M  scripts/test-branch.sh / test-e2e-branch.sh / run-all-e2e.sh`（T307）
> - `M  .claude/rules/e2e-commands.md`（T308）
> - `M  policy.js / test-bucket-policy.test.js`（T309）
> - `M  CLAUDE.md / AGENTS.md / GEMINI.md`（T310）
> - `D  tests/_placeholder.js`（T311，留 Commit 2）
> - `M  migration-inventory.md`（T302 + T314 handoff，留 Commit 2）
>
> ### Step 1：精準 stage
>
> ```bash
> # 確認 R 標記數
> git status -s | grep -c '^R.*-> tests/e2e/'   # 期望：spec 11 + global-setup 5 + window.d.ts ? + README ? = ≥ 16（扣 DUP_DELETE）
> git status -s | grep -c '^R.*-> tests/_helpers/'   # 期望：2
>
> # git mv 已自動 stage 所有 R；只需要把 fix-imports 的 M 加進來：
> git add tests/e2e/ tests/_helpers/   # 注意會把 .gitkeep 也撈進來，要排除
> # 用 git reset HEAD 退回不該 stage 的 .gitkeep（per Phase 2 經驗，git restore --staged 被 block-dangerous-commands.js 攔，改用 git reset HEAD）
> git reset HEAD tests/e2e/_setup/.gitkeep tests/_helpers/.gitkeep 2>/dev/null || true
>
> # 驗證 staged 清單
> git diff --cached --name-status -M | head -30
> # 期望：只有 R + M(*.spec.js / *-global-setup.js)，無 playwright config / scripts / rules / docs / policy.js
> ```
>
> ### Step 2：DUP_DELETE 處理
>
> 如有 `D  specs/<NNN>/tests/e2e/window.d.ts` 或 `D  README.md`（T303 引導 user 確認後若批准刪除）— 也加進 Commit 1（mv 邏輯同源）。**未 user 批准的 DUP_DELETE 不刪**。
>
> ### Step 3：commit
>
> ```bash
> git commit -m "$(cat <<'EOF'
> refactor(tests): mv e2e + helpers to top-level tests/ (Phase 3 part 1)
>
> - 11 個 e2e spec 從 specs/<NNN>/tests/e2e/ 搬到 tests/e2e/（平鋪不分 domain，per plan.md Step 3.1）
> - 5 個 global-setup.js 集中到 tests/e2e/_setup/<feature>-global-setup.js（emulator config rewrite 配套）
> - window.d.ts / README 集中（依 inventory Decision Log，重複者 DUP_DELETE）
> - specs/test-utils/ → tests/_helpers/（e2e-helpers + mock-helpers）+ 所有 importer 同步改 import path
> - 對齊 Playwright 官方 testDir 預設 + spec-kit 頂層 tests/ 結構
> - 配置/cleanup（playwright config × 2 / scripts × 3 / rules / root docs / policy.js bucket 拆 / placeholder 移除 / inventory 落筆）拆到下一個 commit
> EOF
> )"
> ```
>
> **不加** `Co-Authored-By`（per Phase 0/1/2）。
>
> ### Step 4：回報
>
> `git log -1 --stat | tail -20` + `git status -s` — 應仍顯示大量 M（playwright config / scripts / rules / docs / policy.js / test-bucket-policy.test.js / migration-inventory.md）+ D（\_placeholder.js）等 Commit 2 內容。

**Acceptance Criteria**:

- [ ] Commit 1 成功（pre-commit hook 全綠）
- [ ] subject 含 `Phase 3 part 1` 與 `mv e2e + helpers`
- [ ] **不含** `Co-Authored-By`
- [ ] R 標記 ≥ 18（11 spec + 5 setup + 2 helpers，扣除 DUP_DELETE 補回）
- [ ] **不含** playwright config / scripts / rules / root docs / policy.js / test-bucket-policy.test.js / migration-inventory.md / `D _placeholder.js`（這些留 Commit 2）

**Verify Command** (Reviewer-Commit-Mv-P3, `Explore` 跑):

```bash
git log -1 --pretty='%s' | grep -qE 'Phase 3 part 1' || { echo "FAIL: subject"; exit 1; }
git log -1 --pretty='%s' | grep -qE 'mv e2e' || { echo "FAIL: subject mv e2e"; exit 1; }
git log -1 --pretty='%b' | grep -qi 'co-authored-by' && { echo "FAIL: Co-Author"; exit 1; } || true

# R 標記 ≥ 13
renames=$(git show --name-status HEAD | grep -c '^R')
[ "$renames" -ge 13 ] || { echo "FAIL: renames=$renames < 13"; exit 1; }

# 不該包進 Commit 1 的檔
forbidden=$(git show --name-only HEAD | grep -E '(playwright\.config\.mjs|playwright\.emulator\.config\.mjs|scripts/(test-branch|test-e2e-branch|run-all-e2e)\.sh|\.claude/rules/e2e-commands\.md|test-buckets/policy\.js|test-bucket-policy\.test\.js|CLAUDE\.md|AGENTS\.md|GEMINI\.md|migration-inventory\.md|_placeholder\.js)' || true)
[ -z "$forbidden" ] || { echo "FAIL: Commit 1 should not include: $forbidden"; exit 1; }

# Commit 1 該含的至少有 1 個 .spec.js R
git show --name-only HEAD | grep -qE 'tests/e2e/.+\.spec\.js' || { echo "FAIL: no spec mv"; exit 1; }

# status 仍有待 stage 的（Commit 2 內容）
remaining=$(git status -s | grep -E '(playwright|scripts/.+\.sh|policy\.js|migration-inventory|_placeholder)' | wc -l | tr -d ' ')
[ "$remaining" -ge 5 ] || { echo "FAIL: Commit 2 內容不足 remaining=$remaining"; exit 1; }
echo "PASS"
```

**期望**：`PASS`。

---

## Phase 3 Wave 7b — Commit 2: config + cleanup + inventory + handoff（1 agent）

### T314 [Engineer-Commit-Cfg-P3] Commit 2: config rewrite + cleanup + Phase 3 Handoff Highlights

**Dependency**：T313（Commit 1）已成功

**Description**：把 Wave 3-5 的所有改動 + Phase 3 Handoff Highlights 一次 commit。

**Engineer Prompt** (派 Engineer-Commit-Cfg-P3, `general-purpose`):

> 你是 Phase 3 Commit 2 engineer。**先填 Phase 3 Handoff Highlights，再 commit**。
>
> ### Step 1：填 Phase 3 Handoff Highlights（必須先做）
>
> Edit `specs/023-tests-directory-migration/migration-inventory.md` 的「## Phase 3 Inventory + Handoff（E2E + helpers）」段（T302 已填 Inventory + Decision Log，本步補 Handoff Highlights）。**體例參考 Phase 1 / Phase 2 Handoff Highlights 段**，新增 sub-heading「### Phase 3 Handoff Highlights」並列 5-8 條 bullet。
>
> 必須涵蓋（從 Phase 3 Wave 1-7a 跑下來的實際觀察整理 — 給下個 session 啟動「Phase 4 / 後續維護期」時必看）：
>
> 1. **e2e 數對 plan 估算的落差**（plan.md 估 15，實際 11 specs + 5 global-setup + 4 window.d.ts + 1 README，扣除 DUP_DELETE 後最終 mv 多少）
> 2. **playwright.emulator.config.mjs 重寫採用方案**（方案 1 vs 方案 2、實際 diff line 數、E2E_FEATURE 仍保留 vs 廢除）— 因為這檔是 plan.md 註明 Phase 3 最高風險點
> 3. **window.d.ts 合併或分散**（diff 結果 + 最終決策；如有 type 衝突坑要記）
> 4. **DUP_DELETE 走 git rm 還是保留決策**（README / 多餘 window.d.ts；user 簽核流程紀錄）
> 5. **policy.js 舊 4 bucket 拆除過程**：6 個對稱區塊各動了多少 line、`isAllowedRelativeDependency` 早返分支拆掉是否觸發新坑、`KNOWN_S015_UNIT_CONFLICTS` 是否仍是 frozen empty
> 6. **branch scripts 重寫採用 `git diff main...HEAD` 抓改動的策略**：與舊 `specs/$BRANCH/tests/` 邏輯的差異、是否需要 fallback（branch base 不是 main 時）
> 7. **subagent permission 狀態**（Phase 1/2 已驗證 OK；Phase 3 是否 regress？特別 `.claude/rules/e2e-commands.md` Edit 是否再次 deny）
> 8. **outstanding tech debt**（vitest threshold.lines 70 → 80 → 95 路線圖、`tests/_placeholder.js` 已移除後 ESLint 9 / depcruise 是否真的不再抱怨、`tests/e2e/` 是否需後續分 domain、`tests/_helpers/` 是否該拆 e2e/unit 兩套 helper）
>
> 不必每類都列 — 只列**實際在 Phase 3 跑下來有觀察到**的；最少 5 條、最多 8 條。
>
> 格式範例（與 Phase 2 同）：
>
> ```markdown
> ### Phase 3 Handoff Highlights
>
> > 完整紀錄請翻 Phase 3 各 Wave commit message 與本檔上方 Inventory Table。本節只列下個 session 啟動「Phase 4 / 後續維護」前必須記住的 5-8 條。
>
> - **<重點 title>**：<具體內容>。<為何記錄 / 觸發場景>
> ```
>
> ### Step 2：commit
>
> 1. `git status -s` 確認剩下：
>    - `M  playwright.config.mjs`（T305）
>    - `M  playwright.emulator.config.mjs`（T306）
>    - `M  scripts/test-branch.sh / test-e2e-branch.sh / run-all-e2e.sh`（T307）
>    - `M  .claude/rules/e2e-commands.md`（T308）
>    - `M  specs/021-layered-dependency-architecture/test-buckets/policy.js`（T309）
>    - `M  tests/unit/lib/test-bucket-policy.test.js`（T309 同步改）
>    - `M  CLAUDE.md / AGENTS.md / GEMINI.md`（T310）
>    - `D  tests/_placeholder.js`（T311）
>    - `M  specs/023-tests-directory-migration/migration-inventory.md`（T302 + Step 1 剛填）
>    - 不該有：上述以外的（已被 Commit 1 帶走）、untracked（project-health/ / scheduled_tasks.lock 不 add）
> 2. 逐項 add：
>    ```bash
>    git add playwright.config.mjs playwright.emulator.config.mjs
>    git add scripts/test-branch.sh scripts/test-e2e-branch.sh scripts/run-all-e2e.sh
>    git add .claude/rules/e2e-commands.md
>    git add specs/021-layered-dependency-architecture/test-buckets/policy.js
>    git add tests/unit/lib/test-bucket-policy.test.js
>    git add CLAUDE.md AGENTS.md GEMINI.md
>    git add tests/_placeholder.js   # add D
>    git add specs/023-tests-directory-migration/migration-inventory.md
>    ```
> 3. commit:
>
>    ```bash
>    git commit -m "$(cat <<'EOF'
>    chore(tests): Phase 3 config rewrite + bucket cleanup + handoff (Phase 3 part 2)
>
>    - playwright.config.mjs testDir → ./tests/e2e
>    - playwright.emulator.config.mjs 架構重寫：testDir 固定 ./tests/e2e；globalSetup 從 ./tests/e2e/_setup/<feature>-global-setup.js 解析（拋棄 specs/<feature>/tests/e2e/ 三向綁定）
>    - branch scripts × 3 (test-branch.sh / test-e2e-branch.sh / run-all-e2e.sh) 重寫，改從 git diff main...HEAD + tests/ glob 抓改動
>    - .claude/rules/e2e-commands.md frontmatter paths → tests/e2e/**
>    - policy.js 拆除舊 4 bucket（unit/integration/e2e/specs-test-utils），保留新 4 bucket（*-tests-root + tests-helpers）；test-bucket-policy.test.js .toEqual 8→4
>    - CLAUDE.md / AGENTS.md / GEMINI.md root docs 同步新路徑
>    - tests/_placeholder.js 移除（Phase 1-3 已搬入大量真實測試 → ESLint 9 / depcruise 對空目錄抱怨自動消失）
>    - migration-inventory.md Phase 3 Inventory + Decision Log + Handoff Highlights 段落筆
>    - Phase 0 / Phase 1 / Phase 2 / Phase 3 四波 commit 同 branch 連續累加，spec-kit + Playwright 對齊完成
>    EOF
>    )"
>    ```
>
>    **不加** `Co-Authored-By`。
>
> 4. 回報：`git log -1 --stat | tail -20` + `git log --oneline -7`（看到 Phase 3 part 2 / Phase 3 part 1 / Phase 2 part 2 / Phase 2 part 1 / Phase 1 part 2 / Phase 1 part 1 / Phase 0 共 7 個 commit）+ `git status -s` 應 clean（除 untracked）。
>
> **不要** push。

**Acceptance Criteria**:

- [ ] Commit 2 成功（pre-commit hook 全綠）
- [ ] subject 含 `Phase 3 part 2` 與 `config rewrite + bucket cleanup + handoff`
- [ ] **不含** `Co-Authored-By`
- [ ] migration-inventory.md「Phase 3 Handoff Highlights」段已填 5-8 條 bullet（涵蓋至少 5 個 plan-mandated 類別）
- [ ] `git log -1` 顯示所有 Commit 2 該包的檔（playwright × 2 / scripts × 3 / rules / policy.js / test-bucket-policy.test.js / 3 root docs / inventory + D placeholder）
- [ ] `git log --oneline -7` 顯示 7 個 commit 順序：part 2 / part 1（Phase 3）→ part 2 / part 1（Phase 2）→ part 2 / part 1（Phase 1）→ Phase 0
- [ ] `git status -s` clean（除 untracked `project-health/` / `.claude/scheduled_tasks.lock`）

**Verify Command** (Reviewer-Commit-Cfg-P3, `Explore` 跑):

```bash
# 1. subject
git log -1 --pretty='%s' | grep -qE 'Phase 3 part 2' || { echo "FAIL: subject"; exit 1; }
git log -1 --pretty='%b' | grep -qi 'co-authored-by' && { echo "FAIL: Co-Author"; exit 1; } || true

# 2. Commit 2 該含
for f in playwright.config.mjs playwright.emulator.config.mjs \
         scripts/test-branch.sh scripts/test-e2e-branch.sh scripts/run-all-e2e.sh \
         .claude/rules/e2e-commands.md \
         specs/021-layered-dependency-architecture/test-buckets/policy.js \
         tests/unit/lib/test-bucket-policy.test.js \
         CLAUDE.md AGENTS.md GEMINI.md \
         specs/023-tests-directory-migration/migration-inventory.md; do
  git show --name-only HEAD | grep -qF "$f" || { echo "FAIL: missing $f in commit"; exit 1; }
done

# 3. _placeholder.js 是 D
git show --name-status HEAD | grep -q '^D.*tests/_placeholder.js' || { echo "FAIL: placeholder not D"; exit 1; }

# 4. Commit 2 不該含（mv 已被 Commit 1 帶走）
forbidden=$(git show --name-status HEAD | grep -E '^R' || true)
[ -z "$forbidden" ] || { echo "FAIL: Commit 2 should not include R: $forbidden"; exit 1; }

# 5. Phase 3 Handoff Highlights 填了 5-8 條
INV=specs/023-tests-directory-migration/migration-inventory.md
hf=$(awk '/^### Phase 3 Handoff Highlights/,0' "$INV" | grep -c '^- \*\*')
[ "$hf" -ge 5 ] && [ "$hf" -le 8 ] || { echo "FAIL: handoff bullets=$hf (expect 5-8)"; exit 1; }

# 6. log --oneline 7 個 commit
git log --oneline -7 | head -1 | grep -qE 'Phase 3 part 2' || { echo "FAIL: HEAD~0"; exit 1; }
git log --oneline -7 | sed -n '2p' | grep -qE 'Phase 3 part 1' || { echo "FAIL: HEAD~1"; exit 1; }
git log --oneline -7 | sed -n '3p' | grep -qE 'Phase 2 part 2' || { echo "FAIL: HEAD~2"; exit 1; }

# 7. status clean
remaining=$(git status -s | grep -vE '^\?\? (project-health/|\.claude/scheduled_tasks\.lock)' | wc -l | tr -d ' ')
[ "$remaining" -eq 0 ] || { echo "FAIL: dirty"; git status -s; exit 1; }

echo "PASS"
```

**期望**：`PASS`。

---

## Phase 3 Wave 8 — User PR（manual）

### T315 [User] push + open PR + 24h 觀察

**Description**：T313 + T314 兩 commit 完後 user 親跑（涉及 push 到 remote — destructive 程度需 user confirm）。Phase 0/1/2/3 全部累積在同一 branch 一個 PR（user 之前確認 Phase 1-3 共一條 branch 連續累加；若 user 改主意要拆 Phase 3 獨立 PR，主 agent 配合改 PR target branch）。

```bash
git push origin 023-tests-directory-migration
gh pr create --title "refactor(tests): Phase 3 e2e + helpers + cleanup" --body "$(cat <<'EOF'
## Summary
- 11 個 e2e spec 從 specs/<NNN>/tests/e2e/ 搬到 tests/e2e/（平鋪不分 domain，per Playwright 官方 testDir 預設）
- 5 個 global-setup.js 集中到 tests/e2e/_setup/<feature>-global-setup.js
- specs/test-utils/ → tests/_helpers/（e2e-helpers / mock-helpers）+ 所有 importer 同步
- playwright.emulator.config.mjs 架構重寫：拋棄 E2E_FEATURE ↔ spec folder 三向綁定，改從 _setup/ 解析 globalSetup
- branch scripts × 3 重寫成 `git diff main...HEAD` 邏輯
- policy.js 舊 4 bucket（unit/integration/e2e/specs-test-utils）拆除，剩 4 bucket（*-tests-root + tests-helpers）
- tests/_placeholder.js 移除
- root docs (CLAUDE / AGENTS / GEMINI) 同步
- migration-inventory.md Phase 3 Inventory + Decision Log + Handoff Highlights 落筆
- spec-kit 官方頂層 tests/ + Playwright 預設 testDir 對齊完成（plan.md Trade-off Summary「全做完」）

## Test plan
- [x] type-check / depcruise / lint / spellcheck / vitest --project=browser 全綠
- [x] bucket count = 4
- [x] tests/_placeholder.js 已刪
- [x] specs/<NNN>/tests/{unit,integration,e2e}/ 全空（除 g8 KEEP 2 檔）
- [x] tests/e2e/*.spec.js ≥ 11；tests/e2e/_setup/*-global-setup.js = 5
- [x] playwright config dry import 印出新路徑
- [ ] main merge 後 24h 無 CI 紅 + `npx playwright test` 從 tests/e2e/ 跑起全綠（由 user 在 main 觀察）
EOF
)"
```

**Acceptance**:

- [ ] PR 通過 review
- [ ] CI 全綠
- [ ] merge 後 main 觀察 24h 無 regression
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) Verification Checklist「Phase 3 完成」全部 `[x]`

---

## Phase 3 執行 SOP

### Step 0：Wave 0 gate check（派 Reviewer）

主 agent 派 Reviewer-Bootstrap-P3（`Explore`）跑 T301 七個檢查。**FAIL → STOP，escalate user**。PASS 才進 Step 1。

### Step 1：Wave 1（1 agent）

主 agent 派 Engineer-Inventory-P3（`general-purpose`）跑 T302。完成後派 Reviewer-Inventory-P3 驗。FAIL → SendMessage 帶 feedback 重派 engineer，重試上限 3。

### Step 2：Wave 2（並行 3 agents）

T302 PASS 後，主 agent **Read** migration-inventory.md Phase 3 Inventory 確認 Table 1 / Table 2 / Decision Log 完整，然後 **單一 message** 派：

```
Engineer-E2E-Mv-P3   (general-purpose):  "T303 e2e mv（spec + global-setup + window.d.ts + README + 修 import）"
Engineer-Helpers-P3  (general-purpose):  "T304 specs/test-utils → tests/_helpers + 改 importer（不動 e2e 內部 import，T303 範圍）"
Engineer-PWConfig-P3 (general-purpose):  "T305 playwright.config.mjs testDir 改 ./tests/e2e（單行）"
```

完成後 **單一 message** 派 3 個 Reviewers（Explore）。FAIL 處理同 Phase 2 SOP。

### Step 3：Wave 3（並行 3 agents）

Wave 2 全 PASS 後派：

```
Engineer-PWEmu-P3    (general-purpose):  "T306 playwright.emulator.config.mjs 架構重寫（HIGH RISK，方案 1 推薦）"
Engineer-Scripts-P3  (general-purpose):  "T307 三個 branch script 重寫（git diff main...HEAD 邏輯）"
Engineer-Rules-P3    (general-purpose):  "T308 .claude/rules/e2e-commands.md frontmatter（先試 Edit 驗證 .claude/** 寫入是否仍 deny）"
```

配對 reviewers。**T306 失敗時主 agent 不主動代修** — 透過 SendMessage 把 reviewer feedback 送回 engineer 修；超過重試上限直接 escalate user。

### Step 4：Wave 4（並行 2 agents）

Wave 3 全 PASS 後派：

```
Engineer-Policy-P3   (general-purpose):  "T309 policy.js 拆 6 個對稱區塊舊 4 bucket + test-bucket-policy.test.js .toEqual 改 4-element"
Engineer-Docs-P3     (general-purpose):  "T310 root docs (CLAUDE/AGENTS/GEMINI) 同步新路徑"
```

配對 reviewers。**T309 是 Phase 3 第二大風險點**（多區塊對稱 patch 易漏） — reviewer 跑滿 6 個 verify check。

### Step 5：Wave 5（1 agent）

Wave 4 PASS 後派 Engineer-Placeholder-P3 跑 T311。配對 reviewer。

### Step 6：Wave 6 smoke（1 agent，集中 verify 點）

主 agent 派 Engineer-Smoke-P3 跑 T312 的 10 個 check。配對 Reviewer-Smoke-P3 重跑。

任一失敗 → 依 T312 失敗處理表 dispatch 對應 wave engineer 修，**主 agent 不自己診斷**。修完重跑 Wave 6。

### Step 7a：Wave 7a Commit 1（1 agent）

主 agent 派 Engineer-Commit-Mv-P3 跑 T313（純 mv + import 同步 commit）。配對 Reviewer-Commit-Mv-P3 跑 verify。**Reviewer FAIL → 主 agent 透過 SendMessage 把具體 feedback 傳回 Engineer-Commit-Mv-P3 修**。修完再驗，重試上限 3 次。

### Step 7b：Wave 7b Commit 2（1 agent）

T313 PASS 後立即派 Engineer-Commit-Cfg-P3 跑 T314（先填 Phase 3 Handoff Highlights 5-8 條 bullet，再 commit config + cleanup）。配對 Reviewer-Commit-Cfg-P3 跑 7 個 verify check。

注意：T314 dependency 是 T313 已成功（git log 看到 Phase 3 part 1）；若 T313 失敗 / 還未 PASS → 不啟動 T314。

### Step 8：Wave 8 PR（user manual）

主 agent 通報「Phase 3 commit 完成（part 1 sha: <X>, part 2 sha: <Y>），可開 PR」+ 提供 T315 範本給 user 複製貼上。**主 agent 不自己跑 push / gh**。

### 主 agent 全程紀律

從頭到尾**不跑** `npm` / `node` / `git mv` / `git add` / `git commit` / `git push` / `mkdir` / `rm` / `gh` 命令。`Read` 純讀檔（含 inventory）允許；`git status` / `find` 等 query Bash「優先派 Reviewer」。

**Phase 0 user 授權的「主 agent 一次例外」 — Phase 3 不啟用**。

---

## Phase 3 失敗回滾

任一 wave 完成度低於 100%（reviewer 持續 FAIL ≥ 3 次）→ 主 agent **立即 STOP + escalate user**，不派 subagent 跑回滾命令（涉及 destructive 操作）。

回滾命令給 user 親跑（依失敗時點，沿用 Phase 1/2 體例）：

### Wave 2-5 中途失敗（mv / config 已開始，commit 尚未下）

```bash
# user 親跑
git reset HEAD .                                          # unstage 所有改動（per Phase 2 用 reset HEAD 而非 restore --staged）
git restore .                                             # 把改動還原到 working tree（包含 git mv 反向）
git clean -nfd tests/e2e/ tests/_helpers/ 2>/dev/null     # dry-run 看會刪什麼新建檔
git clean -fd tests/e2e/ tests/_helpers/ 2>/dev/null      # 實際刪（destructive，user confirm）
git log -1 --pretty='%h %s'                               # 期望含 'Phase 2 part 2'
git status -s                                              # 期望 empty + untracked project-health/
```

### Wave 7a Commit 1 後失敗（part 1 已下，part 2 尚未）

```bash
git reset --soft HEAD~1                                   # 退 commit 1 但保留改動回 staged
# 重跑 T313 修問題後重 commit
```

### Wave 7b Commit 2 後失敗（part 1+2 都已下，push 未做）

```bash
git reset --soft HEAD~2                                   # 退兩個 commit 但保留改動
# 或全砍回 Phase 2 head（destructive，user confirm）
PHASE2_HEAD=$(git log --grep='Phase 2 part 2' --pretty='%H' | head -1)
git reset --hard "$PHASE2_HEAD"
```

### Wave 8 push 後失敗（PR 已開，CI 紅）

```bash
# fix-forward 優先：派 Engineer 修問題 + 新 commit + push
# 若必須撤銷：用 git revert（不要 force push）
git revert HEAD~1..HEAD                                   # revert 最近 2 commit
git push origin 023-tests-directory-migration
```

**force push 一律 destructive — user 必須親跑且明確 confirm。**

---

## Phase 3 完成判準（總體）

- [ ] T301-T314 全 PASS（含 Wave 7 拆 T313 + T314 兩 commit；T315 user manual）
- [ ] PR opened + merged + main 24h 無 CI 紅
- [ ] parent 藍圖 ([`./plan.md`](./plan.md)) Verification Checklist「Phase 3 完成」全部 `[x]`：
  - [ ] `npx playwright test` 從 `tests/e2e/` 跑起，全綠
  - [ ] `ls specs/<NNN>/` 不再含 `tests/` 子目錄，只剩 spec artifacts
  - [ ] 開新 feature branch 用 TDD skill 跑 Step 2.5，新測試直接落 `tests/{unit,integration,e2e}/`
  - [ ] 全 repo 找不到 `specs/<feature>/tests/` 的引用（grep `specs/.+/tests/` 無命中）
- [ ] [`./migration-inventory.md`](./migration-inventory.md) Phase 3 Handoff Highlights 段已填 5-8 條 bullet（給下個 session / Phase 4 / 後續維護期參考）
- [ ] tests/\_placeholder.js 已移除（Phase 0 handoff §「Phase 1-3 注意事項」第 2 條條件達成 — `tests/` 已有大量真實測試）
- [ ] policy.js bucket count = 4（舊 4 拆完）
- [ ] 4 階段全部完成 — plan.md Trade-off Summary「全做完」一欄全 ✅

---

# Phase 4 Tasks: 文件收斂 + 後續維護拆分

> **Parent 藍圖**：[`./plan.md`](./plan.md) Phase 4A / 4B
> **Handoff 必讀**：[`./migration-inventory.md`](./migration-inventory.md)「Phase 3 Handoff Highlights」與「Phase 3 → Phase 4 Supplemental Handoff」
> **工作性質**：Phase 4A 是 active docs 收斂；Phase 4B 是另開 session 的工具/結構候選，不在 Phase 4A 混做
> **主 agent 邊界**：Phase 4 從頭到尾主 agent 只做 orchestrator，不做任何 Edit / Write / Bash mutate。包含 reviewer FAIL 後的修正，也一律交回 engineer subagent。

## Phase 4A 並行策略總覽

### 同時最多 3 個 engineer subagent + 3 個 reviewer subagent

**上限：3 對，瞬時 active 6 agents。**

- Wave 1 有 3 組互不重疊文件：Codex rules、Codex TDD skill、root onboarding，可並行
- Wave 2 有 2 組文件：testing handbooks、Specify constitution，可並行
- Wave 3 是全域驗證與 commit，必須串行
- Reviewer 必須在對應 engineer 完成後立即跑 acceptance，不等整個 wave 結束才審

### 主 Agent 角色邊界（Phase 4A Non-Negotiable）

| 動作                                                | 主 Agent | 備註                                |
| --------------------------------------------------- | -------- | ----------------------------------- |
| 派 engineer / reviewer subagent                     | ✅       | 唯一執行手段                        |
| `SendMessage` 把 reviewer feedback 交回 engineer    | ✅       | reviewer FAIL 後也不能主 agent 自修 |
| Read plan/tasks/inventory active docs               | ✅       | 純讀允許                            |
| Edit / Write `tasks.md` 以外的 Phase 4A target docs | ❌       | 必須交 engineer subagent            |
| Bash 跑 `rg` / `npm` / `git add` / `git commit`     | ❌       | verify 與 commit 也交 subagent      |
| Reviewer FAIL ≥ 3 次                                | STOP     | 回報 user，不啟用主 agent 例外      |

### Engineer / Reviewer 配對規則

- **Engineer subagent**：負責修改指定 file set；不可碰任務外文件
- **Reviewer subagent**：read-only + verify command；不可修檔
- **重試循環**：Reviewer FAIL → 主 agent 把具體 feedback 原文轉給同一 engineer 修 → reviewer 重驗；最多 3 輪
- **文件標準**：所有 active docs 必須導向 `tests/{unit,integration,e2e,_helpers}`；唯一保留的 `specs/**/tests/**` 是 `specs/g8-server-coverage/tests/unit/**` server Vitest project exception

## Phase 4A 依賴圖

```
Wave 0:
  T401 Bootstrap / active-docs drift audit（reviewer only）

Wave 1 (最多 3 並行):
  T402 Codex rules
  T403 Codex TDD skill
  T404 Root onboarding

Wave 2 (最多 2 並行):
  T405 Testing handbooks
  T406 Specify constitution

Wave 3 (串行):
  T407 Active-docs semantic grep
  T408 Quality sanity
  T409 Phase 4A commit

Wave 4 (manual):
  T410 User push / PR / main observation
```

---

## Phase 4A Wave 0 — Bootstrap Gate

### T401 [Reviewer-Bootstrap-P4A] Phase 3 完成狀態 + active docs drift audit

**Files**：read-only

**Description**：確認 Phase 4A 可開工；只盤點，不修。若 Phase 3 未完成或 target docs 不存在，STOP。

**Reviewer Prompt**:

> 你是 Phase 4A bootstrap reviewer。不要改檔。請確認：
>
> 1. `plan.md` Phase 4A / 4B 存在
> 2. `migration-inventory.md` 有 Phase 3 Handoff Highlights
> 3. `specs/**/tests/**` 只剩 `specs/g8-server-coverage/tests/unit/{firebase-admin,firebase-profile-server}.test.js`
> 4. active docs 仍有哪些舊路徑要收斂，輸出檔案與行號
> 5. worktree 狀態，若已有 unrelated dirty files，列出並 STOP 等 user 決定

**Verify Command**:

```bash
set -e
test -f specs/023-tests-directory-migration/plan.md
test -f specs/023-tests-directory-migration/migration-inventory.md
rg -n '^#### Phase 4A|^#### Phase 4B' specs/023-tests-directory-migration/plan.md
rg -n '^## Phase 3 Handoff Highlights' specs/023-tests-directory-migration/migration-inventory.md

remaining=$(find specs -path '*/tests/*' -type f | sort)
printf '%s\n' "$remaining"
printf '%s\n' "$remaining" | grep -vE '^specs/g8-server-coverage/tests/unit/(firebase-admin|firebase-profile-server)\.test\.js$' && {
  echo "FAIL: non-g8 specs tests remain"; exit 1;
} || true

rg -n "specs/(<feature>|\\$BRANCH)/tests|specs/\\*\\*/e2e|npx playwright test specs|specs/test-utils|testDir: ./specs|Feature specs \\+ tests" \
  AGENTS.md CLAUDE.md GEMINI.md \
  .codex/rules/testing-standards.md .codex/rules/e2e-commands.md \
  .codex/skills/test-driven-development/SKILL.md \
  .codex/references/testing-handbook.md .claude/references/testing-handbook.md \
  .specify/memory/constitution.md || true

git status -s
```

**Acceptance Criteria**:

- [ ] Phase 4A / 4B plan section exists
- [ ] Phase 3 Handoff Highlights exists
- [ ] `specs/**/tests/**` remaining files are exactly the 2 g8 server project exceptions
- [ ] active docs drift list is captured for Wave 1/2 engineers
- [ ] No unrelated dirty files block the session

---

## Phase 4A Wave 1 — Active 指引文件第一批（最多 3 並行）

### T402 [Engineer-Codex-Rules-P4A] Codex rules 路徑收斂

**Files**：

- `.codex/rules/testing-standards.md`
- `.codex/rules/e2e-commands.md`

**Description**：把 Codex-native rules 從舊 `specs/<feature>/tests` / `specs/**/e2e/**` 改成 Phase 3 後終局路徑。

**Engineer Prompt**:

> 你是 Phase 4A Codex rules engineer。只改 `.codex/rules/testing-standards.md` 與 `.codex/rules/e2e-commands.md`。
>
> 目標：
>
> - 新增測試一律導向 `tests/unit/<layer>/`、`tests/integration/<domain>/`、`tests/e2e/`
> - 共用 helper 一律導向 `tests/_helpers/`
> - test results 一律導向 `tests/test-results/[unit|integration|e2e]/`
> - E2E 指令示例改成 `npx playwright test tests/e2e/<file>.spec.js`
> - 唯一舊路徑例外：`specs/g8-server-coverage/tests/unit/**` 是 server Vitest project，不屬於 browser unit bucket
> - 不要改 `.claude/**`、root docs、handbook、constitution

**Acceptance Criteria**:

- [ ] `.codex/rules/testing-standards.md` 不再指導新測試放 `specs/<feature>/tests/[unit|integration|e2e]/`
- [ ] `.codex/rules/e2e-commands.md` frontmatter / globs / command examples 改為 `tests/e2e/**`
- [ ] 文件清楚標示 g8 server Vitest exception
- [ ] 沒有新增與 Phase 4B tooling 行為不一致的指令

**Reviewer Verify Command**:

```bash
set -e
rg -n "specs/<feature>/tests|specs/\\*\\*/e2e|npx playwright test specs|testDir: ./specs" \
  .codex/rules/testing-standards.md .codex/rules/e2e-commands.md && exit 1 || true
rg -n "tests/unit|tests/integration|tests/e2e|tests/_helpers|specs/g8-server-coverage/tests/unit" \
  .codex/rules/testing-standards.md .codex/rules/e2e-commands.md
```

---

### T403 [Engineer-Codex-TDD-Skill-P4A] Codex TDD skill 新測試落點收斂

**Files**：`.codex/skills/test-driven-development/SKILL.md`

**Description**：修正 TDD skill Step 2.5 仍建立 `specs/$BRANCH/tests` / `specs/$BRANCH/test-results` 的問題。

**Engineer Prompt**:

> 你是 Phase 4A Codex TDD skill engineer。只改 `.codex/skills/test-driven-development/SKILL.md`。
>
> 必改：
>
> - `TEST_PATH` 不再是 `specs/$BRANCH/tests`
> - 新測試位置改成：
>   - unit: `tests/unit/<layer>/<name>.test.js[x]`
>   - integration: `tests/integration/<domain>/<name>.test.jsx`
>   - e2e: `tests/e2e/<name>.spec.js`
> - result path 改成 `tests/test-results/[unit|integration|e2e]/`
> - pattern reference glob 改成 `tests/unit/**/*.test.js[x]`、`tests/integration/**/*.test.jsx`、`tests/e2e/**/*.spec.js`
> - spec folder `specs/$BRANCH/` 只保留為 `spec.md` / `plan.md` / `tasks.md` artifact 定位，不再當測試根目錄
> - g8 server tests 是既有 server-project exception，不是新 TDD test default

**Acceptance Criteria**:

- [ ] skill 不再建立 `specs/$BRANCH/tests`
- [ ] skill 不再建立 `specs/$BRANCH/test-results`
- [ ] examples / globs / verify commands 全部指向 repo-root `tests/`
- [ ] skill 仍要求先定位 `specs/$BRANCH/` 作為 spec artifact 來源

**Reviewer Verify Command**:

```bash
set -e
rg -n "specs/\\$BRANCH/tests|specs/\\$BRANCH/test-results|specs/\\*/tests/unit|specs/<branch-name>/test-results|\\$TEST_PATH" \
  .codex/skills/test-driven-development/SKILL.md && exit 1 || true
rg -n "tests/unit/<layer>|tests/integration/<domain>|tests/e2e|tests/test-results|specs/\\$BRANCH/" \
  .codex/skills/test-driven-development/SKILL.md
```

---

### T404 [Engineer-Root-Onboarding-P4A] Root onboarding 三份文件收斂

**Files**：

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`

**Description**：把 root onboarding 仍寫 `specs = feature specs + tests`、E2E 舊 glob、Playwright `testDir: ./specs` 等內容改成 Phase 3 後現況。

**Engineer Prompt**:

> 你是 Phase 4A root onboarding engineer。只改 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md`。
>
> 必改：
>
> - `specs/` 描述改成 feature specs / planning artifacts，不再說 tests
> - `tests/` 描述補上 unit/integration/e2e/\_helpers
> - E2E guide 觸發時機改 `tests/e2e/**`
> - 單檔 Vitest / Playwright 範例改用 `tests/...`
> - `GEMINI.md` 的 Playwright `testDir: ./specs` 改成 `./tests/e2e`
> - 內容要與 `package.json` scripts、`playwright.config.mjs`、`vitest.config.mjs` 現況一致

**Acceptance Criteria**:

- [ ] 三份 root docs 都不再描述 `specs/` 包含 executable tests
- [ ] 三份 root docs 都有 repo-root `tests/` 的終局描述
- [ ] `GEMINI.md` 不再寫 Playwright `testDir: ./specs`
- [ ] `AGENTS.md` 保持 Codex source of truth 語意，不被 Claude/Gemini wording 覆蓋

**Reviewer Verify Command**:

```bash
set -e
rg -n "Feature specs \\+ tests|testDir: ./specs|specs/\\*\\*/e2e|specs/<feature>/tests" \
  AGENTS.md CLAUDE.md GEMINI.md && exit 1 || true
rg -n "tests/|tests/e2e|tests/_helpers|Feature specs|spec artifacts" AGENTS.md CLAUDE.md GEMINI.md
```

---

## Phase 4A Wave 2 — Active 指引文件第二批（最多 2 並行）

### T405 [Engineer-Handbooks-P4A] Codex / Claude testing handbook 終局化

**Files**：

- `.codex/references/testing-handbook.md`
- `.claude/references/testing-handbook.md`

**Description**：兩份 handbook 目前仍有 `specs/test-utils/`、`specs/<feature>/tests/e2e`、Phase 2 過渡語與舊單檔 command。改成 Phase 3 後終局。

**Engineer Prompt**:

> 你是 Phase 4A testing handbook engineer。只改 `.codex/references/testing-handbook.md` 與 `.claude/references/testing-handbook.md`。
>
> 必改：
>
> - helper path: `specs/test-utils/` → `tests/_helpers/`
> - single-file Vitest command: `npx vitest run tests/unit/...` 或 `tests/integration/...`
> - E2E examples: `tests/e2e/<file>.spec.js`
> - Phase 2/Phase 3 過渡語改成完成後終局
> - 舊 source path 若作為歷史來源引用，必須標示 `legacy source before migration`，不得像新工作指引
> - 保留測試撰寫原則、AAA、userEvent、mock discipline，不做內容重寫

**Acceptance Criteria**:

- [ ] 兩份 handbook 不再把 `specs/test-utils/` 當現行 helper 位置
- [ ] 兩份 handbook 不再把 `specs/<feature>/tests/**` 當新增測試位置
- [ ] 歷史來源引用若保留，語意上清楚是 migration 前來源，不是新檔路徑
- [ ] Codex / Claude 兩份內容一致或差異只在 agent-specific wording

**Reviewer Verify Command**:

```bash
set -e
rg -n "共用 helper 放 `specs/test-utils|抽到 `specs/test-utils|npx vitest run specs/<feature>/tests|E2E 共用 helper  \\| `specs/test-utils|Mock helper      \\| `specs/test-utils" \
  .codex/references/testing-handbook.md .claude/references/testing-handbook.md && exit 1 || true
rg -n "tests/_helpers|tests/unit|tests/integration|tests/e2e|legacy source before migration" \
  .codex/references/testing-handbook.md .claude/references/testing-handbook.md
```

---

### T406 [Engineer-Constitution-P4A] Specify constitution 測試結構收斂

**Files**：`.specify/memory/constitution.md`

**Description**：constitution 仍把測試結構定義為 `specs/<feature>/tests/[unit|integration|e2e]/`。改成 repo-root `tests/` 終局，並保留 spec artifacts 定義。

**Engineer Prompt**:

> 你是 Phase 4A Specify constitution engineer。只改 `.specify/memory/constitution.md`。
>
> 必改：
>
> - executable tests: `tests/{unit/<layer>,integration/<domain>,e2e,_helpers}/`
> - spec artifacts: `specs/<feature>/`
> - server Vitest exception: `specs/g8-server-coverage/tests/unit/**`
> - test results: `tests/test-results/[unit|integration|e2e]/`
> - 不要新增 implementation 細節或改 constitution 其他原則

**Acceptance Criteria**:

- [ ] constitution 不再把一般測試結構定義成 `specs/<feature>/tests/[unit|integration|e2e]/`
- [ ] constitution 明確分開 spec artifacts 與 executable tests
- [ ] g8 server project exception 有被寫入
- [ ] test results 位置更新

**Reviewer Verify Command**:

```bash
set -e
rg -n "specs/<feature>/tests/\\[unit\\|integration\\|e2e\\]|specs/<feature>/test-results" \
  .specify/memory/constitution.md && exit 1 || true
rg -n "tests/\\{unit/<layer>,integration/<domain>,e2e,_helpers\\}|specs/<feature>/|specs/g8-server-coverage/tests/unit|tests/test-results" \
  .specify/memory/constitution.md
```

---

## Phase 4A Wave 3 — 全域驗證與 commit（串行）

### T407 [Engineer-Active-Docs-Verify-P4A] Active docs semantic grep

**Files**：read-only

**Description**：跑 active docs grep，確認沒有會指導新工作寫回舊測試路徑的內容。歷史 plan / inventory / migration-handoff 可以保留舊路徑，不納入此 gate。

**Engineer Prompt**:

> 你是 Phase 4A active-docs verify engineer。不要改檔。只檢查 active docs。若有 FAIL，回報哪個前序 task 應修，不要自己修。

**Verify Command**:

```bash
set -e
ACTIVE_DOCS="
AGENTS.md
CLAUDE.md
GEMINI.md
.codex/rules/testing-standards.md
.codex/rules/e2e-commands.md
.codex/skills/test-driven-development/SKILL.md
.codex/references/testing-handbook.md
.claude/references/testing-handbook.md
.specify/memory/constitution.md
"

rg -n "specs/(<feature>|\\$BRANCH)/tests|specs/\\*\\*/e2e|npx playwright test specs|testDir: ./specs|Feature specs \\+ tests" $ACTIVE_DOCS && {
  echo "FAIL: active docs still contain executable-test old-path guidance"; exit 1;
} || true

rg -n "specs/test-utils" .codex/references/testing-handbook.md .claude/references/testing-handbook.md && {
  echo "FAIL: handbooks still treat specs/test-utils as current helper path"; exit 1;
} || true

rg -n "specs/g8-server-coverage/tests/unit" $ACTIVE_DOCS
rg -n "tests/unit|tests/integration|tests/e2e|tests/_helpers|tests/test-results" $ACTIVE_DOCS
echo "PASS"
```

**Acceptance Criteria**:

- [ ] Command prints `PASS`
- [ ] Any remaining `specs/**/tests/**` in active docs is only the g8 server project exception
- [ ] `specs/023-*` historical docs are intentionally excluded from this gate

---

### T408 [Engineer-Quality-Sanity-P4A] Phase 4A quality sanity

**Files**：read-only

**Description**：Phase 4A 是 docs-only，但仍需跑低成本 sanity，確保 markdown edit 沒破壞 lint/spellcheck 的 file coverage expectation。若 full gate 太慢，至少跑 changed-file focused checks。

**Engineer Prompt**:

> 你是 Phase 4A quality sanity engineer。不要修檔。依序跑下列命令，任一失敗回報 stderr 摘要與可能對應 task。

**Verify Command**:

```bash
set -e
npm run lint:changed
npm run spellcheck
git diff --check
git status -s
```

**Acceptance Criteria**:

- [ ] `npm run lint:changed` passes
- [ ] `npm run spellcheck` passes
- [ ] `git diff --check` passes
- [ ] Dirty files only include intended Phase 4A docs

---

### T409 [Engineer-Commit-P4A] Commit Phase 4A docs

**Files**：Phase 4A docs only

**Description**：只 commit Phase 4A 文件收斂，不含 Phase 4B tool/code changes。

**Engineer Prompt**:

> 你是 Phase 4A commit engineer。只 stage Phase 4A docs：
>
> - `AGENTS.md`
> - `CLAUDE.md`
> - `GEMINI.md`
> - `.codex/rules/testing-standards.md`
> - `.codex/rules/e2e-commands.md`
> - `.codex/skills/test-driven-development/SKILL.md`
> - `.codex/references/testing-handbook.md`
> - `.claude/references/testing-handbook.md`
> - `.specify/memory/constitution.md`
>
> 不 stage `specs/023-tests-directory-migration/tasks.md` / `migration-inventory.md`，除非 user 明確要把 Phase 4 planning docs 一起入 commit。commit message 不加 Co-Authored-By。

**Commit Message**:

```text
docs(tests): align active guides with top-level tests

- update Codex rules and TDD skill to create tests under repo-root tests/
- align root onboarding and testing handbooks with Phase 3 final layout
- update Specify constitution with g8 server-project exception
```

**Reviewer Verify Command**:

```bash
set -e
git log -1 --pretty='%s' | grep -q '^docs(tests): align active guides with top-level tests$'
git log -1 --pretty='%b' | grep -qi 'co-authored-by' && { echo "FAIL: Co-Author"; exit 1; } || true

for f in AGENTS.md CLAUDE.md GEMINI.md \
  .codex/rules/testing-standards.md .codex/rules/e2e-commands.md \
  .codex/skills/test-driven-development/SKILL.md \
  .codex/references/testing-handbook.md .claude/references/testing-handbook.md \
  .specify/memory/constitution.md; do
  git show --name-only HEAD | grep -qF "$f" || { echo "FAIL: missing $f"; exit 1; }
done

git show --name-only HEAD | grep -qE '^(playwright|scripts/|src/|tests/.*\.js)' && {
  echo "FAIL: Phase 4A commit contains tool/code/test changes"; exit 1;
} || true

echo "PASS"
```

---

## Phase 4A Wave 4 — User PR（manual）

### T410 [User] push + open PR + main 觀察

**Description**：Phase 4A docs commit 完後由 user 決定 push / PR。若 user 要把 Phase 4A planning docs (`tasks.md` / `migration-inventory.md`) 也入 PR，另開 docs commit，避免混進 active guides commit。

```bash
git push origin 023-tests-directory-migration
gh pr create --title "docs(tests): align active guides with top-level tests" --body "$(cat <<'EOF'
## Summary
- Codex rules / TDD skill 改成 Phase 3 後終局 tests/ 路徑
- Root onboarding (AGENTS / CLAUDE / GEMINI) 與 Playwright/Vitest 現況對齊
- Codex + Claude testing handbooks 改用 tests/_helpers 與 repo-root tests/
- Specify constitution 更新測試結構與 g8 server Vitest exception

## Test plan
- [x] active docs grep 無 `specs/<feature>/tests` 新工作指引
- [x] g8 server project exception 保留
- [x] npm run lint:changed
- [x] npm run spellcheck
- [x] git diff --check
EOF
)"
```

---

## Phase 4B Backlog — 另開 session 的工具 / 結構候選

> Phase 4B 不跟 Phase 4A 混做。每個候選都要另開 session、另派 engineer+reviewer；主 agent 同樣只做 orchestrator。P0/P1/P2 是排程優先級，不是同一 session 的 wave。

### Phase 4B 並行規則

- P0 E2E tooling 兩項共享 `playwright.emulator.config.mjs` / e2e scripts，**不可並行**
- P1 branch-script fallback 可在 P0 完成後做；最多 1 engineer + 1 reviewer
- P1 `npm test` entrypoint docs/script 與 `.gitkeep` cleanup 可並行，最多 2 對
- P1 `tests/server/` 設計不可與 `npm test` entrypoint 並行，兩者都會碰 `vitest.config.mjs` / docs
- P2 全部觸發型延後債，不主動做；只有觸發條件成立才開 session

### B001 [P0] `E2E_FEATURE` selector 語意修正

**Scope**：`playwright.emulator.config.mjs`、必要時 `tests/e2e/_setup/*-global-setup.js`、相關 docs

**問題**：`E2E_FEATURE=004-event-edit-delete npx playwright test --config playwright.emulator.config.mjs --list` 會列出全部 tests；目前 `E2E_FEATURE` 只選 globalSetup，不選 spec。

**Acceptance**:

- [ ] `E2E_FEATURE=<feature>` 同時選到該 feature 的 setup 與 spec subset，或文件明確改成全域 seed 模式並廢除 selector 語意
- [ ] 無 `E2E_FEATURE` 時仍可跑全量 e2e
- [ ] 不破壞 vanilla `playwright.config.mjs`

**Verify Direction**:

```bash
E2E_FEATURE=004-event-edit-delete npx playwright test --config playwright.emulator.config.mjs --list
E2E_FEATURE=014-notification-system npx playwright test --config playwright.emulator.config.mjs --list
npx playwright test --config playwright.emulator.config.mjs --list
```

### B002 [P0] `scripts/test-e2e-branch.sh` changed-only + setup 對應

**Scope**：`scripts/test-e2e-branch.sh`、必要時 `scripts/run-all-e2e.sh`

**問題**：changed-only e2e 若沒自動帶對應 globalSetup，會用 vanilla config 跑需要 emulator seed 的 spec。

**Acceptance**:

- [ ] changed e2e spec 可推導是否需要 feature setup
- [ ] 不能推導時明確 fallback 到 `run-all-e2e.sh` 或 STOP with actionable message，不 silent pass
- [ ] script dry-run / list 模式能顯示將跑哪些 spec 與 setup

**Verify Direction**:

```bash
bash scripts/test-e2e-branch.sh --dry-run
bash scripts/run-all-e2e.sh --list
```

### B003 [P1] branch scripts diff base fallback

**Scope**：`scripts/test-branch.sh`、`scripts/test-e2e-branch.sh`、`scripts/run-all-e2e.sh`

**問題**：`git diff main...HEAD` 對未 commit changes、feature-on-feature、local main stale、merge-base 異常可能 false skip。

**Acceptance**:

- [ ] base 可用 env override
- [ ] `main...HEAD` 失敗時有 warning
- [ ] staged / unstaged changed tests 也會被偵測
- [ ] 沒有 changed tests 時輸出明確 skip reason

**Verify Direction**:

```bash
TEST_BASE_REF=main bash scripts/test-branch.sh --dry-run
git diff --name-only
git diff --cached --name-only
```

### B004 [P1] `npm test` / browser-server entrypoint 收斂

**Scope**：`package.json`、testing docs

**問題**：裸 `npm test` 可能觸發 server project emulator guard；正確入口是 browser project 或 `npm run test:server`。

**Acceptance**:

- [ ] 新增或文件化 `npm run test:browser`
- [ ] `npm test` 語意清楚：若保留 full Vitest，文件必須說 server project 需要 emulator
- [ ] `test:server` / `test:coverage` emulator wrapper 不被破壞

**Verify Direction**:

```bash
npm run test:browser -- --run
npm run test:server -- --run
```

### B005 [P1] g8 server tests 長期位置決策

**Scope**：`vitest.config.mjs`、`specs/g8-server-coverage/**`、可能新 `tests/server/**`

**問題**：tracked `specs/**/tests/**` 只剩 g8 server tests；目前是合理 exception，但長期若要收斂需設計 `tests/server/`，不能搬到 browser `tests/unit/`。

**Acceptance**:

- [ ] 若不搬，docs 明確標示 exception
- [ ] 若搬，server project include 改到 `tests/server/**`，且 browser project 不吃 server tests
- [ ] emulator test 仍只能透過 server wrapper 跑

**Verify Direction**:

```bash
npx vitest list --project=browser
npx vitest list --project=server
npm run test:server
```

### B006 [P1] `.gitkeep` 過渡檔 cleanup

**Scope**：`tests/**/.gitkeep`

**問題**：Phase 0 空目錄需求已消失，`tests/` 內已有大量真實檔案。

**Acceptance**:

- [ ] 刪除 tracked `tests/**/.gitkeep`
- [ ] 不刪任何真實 test/helper/setup file
- [ ] lint / depcruise / spellcheck 不因空目錄失敗

**Verify Direction**:

```bash
find tests -name '.gitkeep' -print
npm run lint:changed
npm run depcruise
npm run spellcheck
```

### B007 [P2] coverage threshold ratchet

**Trigger**：coverage summary 實測穩定高於下一階至少約 2%。

**Acceptance**：只做 70 → 75 → 80 的小步 ratchet；不一次跳 95。

**Verify Direction**：`npm run test:coverage` + 讀 `coverage/coverage-summary.json`。

### B008 [P2] E2E spec 拆分，而非目錄分組

**Trigger**：`tests/e2e/*.spec.js` 達 30+ 或單檔明顯過長；短期優先拆大 spec，不急著改目錄。

**Acceptance**：拆分後 `--list` 與 setup mapping 正確；不引入 domain folder 前先完成 P0 tooling。

### B009 [P2] `tests/_helpers/` 拆子目錄

**Trigger**：第三類 helper 出現、`e2e-helpers.js` > 300 行，或 helper 職責真的混雜。

**Acceptance**：先改 policy / imports / docs，再搬 helper；不要只做目錄美化。

### B010 [P2] `window.d.ts` 多型別整合

**Trigger**：新的 E2E helper 引入第二個 `window.*` global、`window.d.ts` 出現 feature-specific 分歧，或 type-check 對新 global 報錯。

**Acceptance**：新增型別與 setup 實作同 commit；`npm run type-check` 必過。

### B011 [P2] policy dead export cleanup

**Scope**：`specs/021-layered-dependency-architecture/test-buckets/policy.js`

**問題**：`KNOWN_S015_UNIT_CONFLICTS` 已是 empty export shape。非行為風險，下次碰 policy.js 再順手收斂。

**Acceptance**：先 grep zero consumer，再移除 export/function/test fixture；`npm run depcruise` + `npx vitest run tests/unit/lib/test-bucket-policy.test.js` 必過。

## Phase 4C Tasks: remove specs test directories

**新增要求**：刪除 `specs/` 底下所有 `test` / `tests` 目錄。原 B005 的 g8 server exception 不能再保留，所有 g8 server tests 必須搬到 `tests/server/g8-server-coverage/`，並同步更新 Vitest config、active docs、migration inventory、handoff 與 PR guidance。

**並行 / 委派規則**：

- 主 agent 從頭到尾只做 orchestration：拆派任務、整理順序、彙整 subagent 回報、確認 reviewer 是否完成，不直接做工程實作、review、修改、驗證或 commit。
- 所有工程實作、code review、修正、驗證、commit 都交給 subagent。每個 engineer subagent 必須配一個 reviewer subagent，reviewer 需獨立查檔與跑 verify command，不可只讀 engineer 回報。
- 保守建議最多同時 2 組 `engineer + reviewer`。C001 可單獨先跑；C002 與 C003 有強依賴，必須同一組或串行完成；C004 可在 C002/C003 初稿後並行；C005 必須等 C002/C004 完成後再做；C006 必須最後全域驗證；C007 必須在 C006 後寫入最新踩坑與結論；C008 必須最後整理 commit/PR guidance。
- 可並行：C001 bootstrap audit 與 C004 docs drift 掃描可平行蒐證；C004 active docs 更新可和 C002/C003 的實作 reviewer 初審重疊，但合併前要等 server test 位置確定。
- 不可並行：C002 server tests 搬移、C003 Vitest include/exclude、C005 刪除 specs 空 test 目錄、C006 全域驗證、C007 inventory handoff、C008 commit/PR guidance 必須依序收斂。

### C001 [P0] bootstrap audit for specs test directories

**Scope**：`specs/**`、`vitest.config.mjs`、`package.json`、`specs/023-tests-directory-migration/migration-inventory.md`、active testing docs

**Description**：盤點目前所有 `specs/` 底下 `test` / `tests` 目錄、g8 server test 檔、Vitest project include/exclude、文件中仍提到 `specs/<feature>/tests` 或 g8 exception 的位置。此任務只做稽核與回報，不修改檔案。

**Engineer Prompt**：

```text
You are the engineer subagent for C001. Do not edit files. Audit all specs test/test directories and every active reference to specs/<feature>/tests or the g8 server exception. Report exact paths, owning docs/configs, and migration order risks. Include command output summaries for find/rg/vitest list probes.
```

**Acceptance Criteria**：

- [ ] 列出 `find specs -type d \( -name test -o -name tests \)` 的完整結果。
- [ ] 列出 `find specs -path '*/tests/*' -type f` 的完整結果，特別標出 g8 server tests。
- [ ] 找到所有 active docs / templates / config 中的 `specs/<feature>/tests`、`specs/**/tests`、`g8 server exception`、`g8-server-coverage` 相關 references。
- [ ] 確認目前 `npx vitest list --project=server` 是否列出 `specs/` 底下 test 檔。
- [ ] 確認目前 `npx vitest list --project=browser` 是否錯吃 server tests。
- [ ] 產出 C002-C005 的建議執行順序與風險，不做任何修改。

**Reviewer Verify Command**：

```bash
find specs -type d \( -name test -o -name tests \) -print
find specs -path '*/tests/*' -type f -print
rg -n "specs/.*/tests|specs/<feature>/tests|g8 server|g8-server-coverage|tests directory|test directory" specs .codex vitest.config.mjs package.json
npx vitest list --project=server
npx vitest list --project=browser
git diff -- specs vitest.config.mjs package.json .codex
```

### C002 [P0] move g8 server tests to `tests/server/g8-server-coverage/`

**Scope**：`specs/g8-server-coverage/**/tests/**` 或 C001 找到的 g8 server test files、`tests/server/g8-server-coverage/**`

**Description**：把所有 g8 server tests 從 `specs/` 搬到 `tests/server/g8-server-coverage/`，保留測試意圖與分組命名，更新 imports、relative paths、fixtures/helper paths。不得把 server tests 搬到 browser-oriented `tests/unit/` 或 `tests/integration/`。

**Engineer Prompt**：

```text
You are the engineer subagent for C002. Move all g8 server tests out of specs and into tests/server/g8-server-coverage/. Update imports and relative paths without changing test behavior. Do not edit Vitest config unless C003 is assigned to you in the same work packet. Do not delete empty specs test directories yet; leave that for C005.
```

**Acceptance Criteria**：

- [ ] g8 server test files 全部位於 `tests/server/g8-server-coverage/`。
- [ ] `specs/g8-server-coverage/**/test/**` 與 `specs/g8-server-coverage/**/tests/**` 下沒有殘留 test files。
- [ ] 所有搬移後 test imports、fixture paths、helper paths 正確，沒有用硬編碼工作目錄繞過。
- [ ] 搬移只改測試位置與必要路徑，不改 production behavior。
- [ ] 暫時允許空目錄留到 C005，但不得新增新的 `specs/**/test*` 檔案。

**Reviewer Verify Command**：

```bash
find tests/server/g8-server-coverage -type f -print
find specs -path '*/test/*' -type f -print
find specs -path '*/tests/*' -type f -print
rg -n "from ['\"]\\.\\./|from ['\"]\\.\\./\\.\\./|require\\(['\"]\\.\\./" tests/server/g8-server-coverage
npx vitest list --project=server
git diff -- tests/server specs
```

### C003 [P0] update Vitest server include and browser exclude

**Scope**：`vitest.config.mjs`

**Description**：更新 Vitest projects：server project 必須 include `tests/server/**`，並排除 browser project 吃到 `tests/server/**`。移除對 `specs/**/tests/**` 的 server exception，確保 server tests 只能透過 server project / emulator wrapper 跑。

**Engineer Prompt**：

```text
You are the engineer subagent for C003. Update vitest.config.mjs so server tests are discovered from tests/server/** and specs/**/test(s) is no longer a server exception. Ensure browser project does not list tests/server. Keep config style consistent with the current file and do not broaden includes unnecessarily.
```

**Acceptance Criteria**：

- [ ] `vitest.config.mjs` server project include 會列出 `tests/server/g8-server-coverage/**` 或合理的 `tests/server/**` pattern。
- [ ] `vitest.config.mjs` 不再依賴 `specs/**/tests/**` 或 g8-specific specs exception。
- [ ] Browser project exclude 明確排除 `tests/server/**`，或既有 include pattern 已經保證不會吃到 server tests 且 reviewer 有證據。
- [ ] `npx vitest list --project=server` 只列 `tests/server` 底下 server tests，不列 `specs/`。
- [ ] `npx vitest list --project=browser` 不列 `tests/server`。
- [ ] `npm run test:server` 通過。

**Reviewer Verify Command**：

```bash
rg -n "tests/server|specs/.*/tests|g8-server-coverage|exclude|include" vitest.config.mjs
npx vitest list --project=server
npx vitest list --project=browser
npm run test:server
git diff -- vitest.config.mjs
```

### C004 [P0] update active docs and remove template drift

**Scope**：active docs/templates only: `.specify/templates/tasks-template.md`, `.codex/**` active testing docs, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and any C001-confirmed active guidance. Do not treat `specs/023-tests-directory-migration/**` as active guidance for this cleanup.

**Description**：移除所有 active docs/templates 中「g8 server exception 可留在 specs」的說法，改成 server tests 位於 `tests/server/...`。修正 `.specify/templates/tasks-template.md` 仍暗示 `specs/<feature>/tests` 的 drift，避免未來新 feature 繼續建立 specs test directories。`specs/023-tests-directory-migration/**` 是 migration history，舊路徑可保留歷史語境；C007 負責補 Phase 4C handoff，不需要 C004 清掉全部歷史引用。

**Engineer Prompt**：

```text
You are the engineer subagent for C004. Update active docs and templates to state that specs/ is for planning artifacts only and must not contain test/test directories. Remove the g8 exception. Fix .specify/templates/tasks-template.md drift away from specs/<feature>/tests. Do not edit legacy docs unless C001 identified them as active guidance.
```

**Acceptance Criteria**：

- [ ] Active docs 不再保留「g8 server tests 可留在 specs」或等價 exception。
- [ ] `.specify/templates/tasks-template.md` 不再要求或示範 `specs/<feature>/tests`。
- [ ] Docs 明確說 server tests 應放 `tests/server/...`，g8 server tests 放 `tests/server/g8-server-coverage/`。
- [ ] Docs 明確說 `specs/` 只放 planning artifacts，不放 executable tests。
- [ ] 文件更新後沒有 stale references 會引導後續 agent 建立 `specs/**/test` 或 `specs/**/tests`。
- [ ] Active docs/templates 不再引導建立 `specs/**/test` 或 `specs/**/tests`；migration history references are allowed if clearly historical.

**Reviewer Verify Command**：

```bash
ACTIVE_DOCS="$(for path in .specify/templates/tasks-template.md AGENTS.md CLAUDE.md GEMINI.md; do [ -e "$path" ] && printf '%s\n' "$path"; done)"
ACTIVE_DOCS="$ACTIVE_DOCS"$'\n'"$([ -d .codex ] && find .codex -type f \( -name '*.md' -o -name '*.json' \) -print)"
rg -n "specs/.*/tests|specs/<feature>/tests|g8 server exception|g8.*exception|tests/server/g8-server-coverage|planning artifacts" $ACTIVE_DOCS
git diff -- .specify/templates/tasks-template.md .codex AGENTS.md CLAUDE.md GEMINI.md
```

### C005 [P0] delete all empty `specs` test directories

**Scope**：`specs/**/test/`、`specs/**/tests/`

**Description**：在 C002-C004 完成後，刪除 `specs/` 底下所有空的 `test` / `tests` 目錄。不得刪除 specs planning artifacts，不得刪除 `tests/` 正式測試目錄。

**Engineer Prompt**：

```text
You are the engineer subagent for C005. Delete every empty specs/**/test and specs/**/tests directory after confirming no files remain inside them. Do not delete planning artifacts or any tests/ directory outside specs. If a specs test directory still contains files, stop and report the blocker instead of deleting data.
```

**Acceptance Criteria**：

- [ ] `find specs -type d \( -name test -o -name tests \)` 輸出為 0。
- [ ] `find specs -path '*/tests/*' -type f` 輸出為 0。
- [ ] `find specs -path '*/test/*' -type f` 輸出為 0。
- [ ] 沒有刪除 specs planning artifacts。
- [ ] 沒有刪除 `tests/` 正式測試檔或 helpers。

**Reviewer Verify Command**：

```bash
find specs -type d \( -name test -o -name tests \) -print
find specs -path '*/tests/*' -type f -print
find specs -path '*/test/*' -type f -print
git diff --stat -- specs tests
git diff --name-status -- specs tests
```

### C006 [P0] global verification gate

**Scope**：full changed set from C002-C005

**Description**：完成移動、config、docs、目錄刪除後，跑完整驗證並保存結果摘要。任何失敗都必須回到對應 engineer subagent 修正，再由 reviewer 重跑。

**Engineer Prompt**：

```text
You are the engineer subagent for C006. Run the global verification gate after C002-C005 are complete. Do not patch around failures without assigning the fix back to the owning task. Record exact pass/fail commands and the shortest useful failure excerpt.
```

**Acceptance Criteria**：

- [ ] `find specs -type d \( -name test -o -name tests \)` 輸出為 0。
- [ ] `find specs -path '*/tests/*' -type f` 輸出為 0。
- [ ] `find specs -path '*/test/*' -type f` 輸出為 0。
- [ ] `npx vitest list --project=server` 只列 `tests/server`，不列 `specs/`。
- [ ] `npx vitest list --project=browser` 不列 `tests/server`。
- [ ] `npm run test:server` 通過。
- [ ] `npm run lint:changed` 通過。
- [ ] `npm run depcruise` 通過。
- [ ] `npm run spellcheck` 通過。
- [ ] `git diff --check` 通過。

**Reviewer Verify Command**：

```bash
find specs -type d \( -name test -o -name tests \) -print
find specs -path '*/tests/*' -type f -print
find specs -path '*/test/*' -type f -print
npx vitest list --project=server
npx vitest list --project=browser
npm run test:server
npm run lint:changed
npm run depcruise
npm run spellcheck
git diff --check
```

### C007 [P0] update migration inventory handoff

**Scope**：`specs/023-tests-directory-migration/migration-inventory.md`

**Description**：把本次 Phase 4C 的重要資訊、搬移結果、驗證結果、踩坑、後續注意事項寫入 migration inventory。Reviewer 必須檢查真的有新增內容，不能只接受口頭回報。

**Engineer Prompt**：

```text
You are the engineer subagent for C007. Update specs/023-tests-directory-migration/migration-inventory.md with Phase 4C outcomes: where g8 server tests moved, what Vitest config changed, exact verification status, any pitfalls, and what future agents must not reintroduce. Keep it concise but actionable.
```

**Acceptance Criteria**：

- [ ] `migration-inventory.md` 新增 Phase 4C handoff 或等價區塊。
- [ ] 明確記錄 g8 server tests 已搬到 `tests/server/g8-server-coverage/`。
- [ ] 明確記錄 `specs/` 不可再有 `test` / `tests` 目錄。
- [ ] 明確記錄 C006 每個驗證 command 的結果摘要。
- [ ] 明確記錄踩坑，例如 Vitest browser/server discovery、relative import path、docs/template drift、empty directory cleanup。
- [ ] Reviewer 用 diff 確認 `migration-inventory.md` 真的有新增，而不是只看 engineer 回報。

**Reviewer Verify Command**：

```bash
git diff -- specs/023-tests-directory-migration/migration-inventory.md
rg -n "Phase 4C|tests/server/g8-server-coverage|specs.*test|vitest list|test:server|lint:changed|depcruise|spellcheck|diff --check|pitfall|踩坑" specs/023-tests-directory-migration/migration-inventory.md
```

### C008 [P0] commit and PR guidance

**Scope**：final changed set, commit message, PR body guidance

**Description**：整理 commit / PR guidance。Commit 必須在 C006 全通、C007 handoff 更新且 reviewer 確認後才可做。PR body 需明確說明 specs test directories 已移除、g8 server tests 新位置、Vitest project discovery 證據、全域驗證結果。

**Engineer Prompt**：

```text
You are the engineer subagent for C008. Prepare commit and PR guidance only after C006 and C007 are reviewer-approved. Ensure the commit is atomic for Phase 4C and the PR notes include verification evidence. Do not commit if specs still contains test/test directories or migration-inventory.md was not updated.
```

**Acceptance Criteria**：

- [ ] Commit 前 `git status --short` 只包含 Phase 4C 相關改動。
- [ ] Commit 前 C006 全部 commands 通過。
- [ ] Commit 前 C007 reviewer 確認 `migration-inventory.md` 有新增重要資訊與踩坑。
- [ ] Commit message 清楚描述 remove specs test directories / move g8 server tests。
- [ ] PR guidance 包含：`find specs` zero results、server/browser Vitest list 證據、`npm run test:server`、`npm run lint:changed`、`npm run depcruise`、`npm run spellcheck`、`git diff --check`。
- [ ] PR guidance 明確提醒 reviewers 檢查 `.specify/templates/tasks-template.md` 不再引導 `specs/<feature>/tests`。

**Reviewer Verify Command**：

```bash
git status --short
find specs -type d \( -name test -o -name tests \) -print
find specs -path '*/tests/*' -type f -print
npx vitest list --project=server
npx vitest list --project=browser
npm run test:server
npm run lint:changed
npm run depcruise
npm run spellcheck
git diff --check
git diff -- specs/023-tests-directory-migration/migration-inventory.md .specify/templates/tasks-template.md vitest.config.mjs tests/server specs
```
