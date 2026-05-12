# Gap C Semantic Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic contracted Markdown table scanner to doc gardening so path, membership, and status drift in explicitly registered governance tables becomes visible and blocking.

**Architecture:** Keep the scanner inside `scripts/doc-gardening-check.mjs`, but separate the registry, Markdown table parsing, path normalization, table scanning, and report shaping into testable exported functions. The first real contract is a narrow source-of-truth registry table in `docs/automation/doc-gardening-sot.md`; AGENTS is not registered until it contains a matching path/status table. Soft semantic drift remains a human Reviewer checklist item in `.codex/references/review-standards.md`.

**Tech Stack:** Node.js ESM scripts, Vitest browser project unit tests under `tests/unit/scripts`, Markdown governance docs, npm workflow scripts, Superpowers Engineer/Reviewer workflow, GitHub PR closeout.

---

## Profile And Execution Boundary

- Profile: P3. Complexity is C3 because this changes a shared script, executable tests, report shape, and workflow review docs. Risk is R3 because it affects shared documentation governance and recurring automation behavior.
- Isolation: use the assigned worktree or create a feature worktree before implementation. Never edit directly on `main`.
- Authorization boundary for future execution: Engineer subagents may edit only task-owned files. Reviewer subagents must review every non-read-only slice. Main agent coordinates, stages explicit paths, commits after Reviewer PASS, pushes, opens PR, waits for required checks, merges on GitHub, then fast-forwards local `main` only when authorized.
- Current plan creation is docs-only. Future implementation is out of scope for this file.

## Owned File Map

Implementation-owned files:

- `tests/unit/scripts/doc-gardening-check.test.mjs`: all contracted-table unit and CLI behavior tests.
- `scripts/doc-gardening-check.mjs`: scanner registry, parser, validation, report payload fields, CLI wiring.
- `docs/automation/doc-gardening-sot.md`: first registered governance table that the scanner validates.
- `.codex/references/review-standards.md`: Reviewer checklist language for semantic claims outside registered table contracts.

Read-only context for future agents:

- `docs/superpowers/specs/2026-05-12-gap-c-semantic-drift-design.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `.codex/references/quality-gates.md`
- `.codex/rules/sensors.md`
- `.codex/rules/testing-standards.md`
- `.codex/references/testing-handbook.md`, section "4. Unit Tests 指南" only if unit-test style is unclear.
- `package.json`, scripts only.

Non-scope:

- No broad semantic checker, LLM review, source-code reality inference, architecture proof, or prose-vs-implementation assertion.
- No scan of unregistered Markdown tables.
- No automatic rewrite of contracted table rows, statuses, or semantic content.
- No changes to runtime product behavior, Firebase, dependencies, CI config, schema, security rules, or E2E specs.
- No package-lock changes.
- No AGENTS table contract until AGENTS contains a path/status table matching the scanner contract shape.

## Dependency Graph And Waves

All tasks that touch `scripts/doc-gardening-check.mjs` or `tests/unit/scripts/doc-gardening-check.test.mjs` are serial.

- Wave 1: Task 1.
- Wave 2: Task 2 depends on Task 1.
- Wave 3: Task 3 depends on Task 2.
- Wave 4: Task 4 depends on Task 3. Task 5 may run in parallel with Task 4 because its owned file is disjoint.
- Wave 5: Task 6 depends on Tasks 4 and 5.

Same-wave owned-file rule:

- Task 4 owns `docs/automation/doc-gardening-sot.md`, `scripts/doc-gardening-check.mjs`, and `tests/unit/scripts/doc-gardening-check.test.mjs`.
- Task 5 owns `.codex/references/review-standards.md`.
- These write sets do not overlap; each lane still needs its own Reviewer.

## Task 1: Contracted Table Scanner RED Tests

**Files:**

- Modify: `tests/unit/scripts/doc-gardening-check.test.mjs`

**Owned files:** `tests/unit/scripts/doc-gardening-check.test.mjs`

**Non-scope:** no edits to implementation or docs in this task.

- [ ] **Step 1: Engineer reads focused context**

Read:

```bash
sed -n '1,260p' tests/unit/scripts/doc-gardening-check.test.mjs
sed -n '1,220p' scripts/doc-gardening-check.mjs
sed -n '85,160p' .codex/references/testing-handbook.md
```

Expected signal:

- Existing tests use Vitest, direct script imports, fake timers where needed, and injected dependencies instead of internal-layer mocks.

- [ ] **Step 2: Write failing scanner tests**

Append new `describe` blocks with these exact test names:

```js
describe('parseMarkdownTables', () => {
  it('parses markdown tables with source lines and trimmed cells', () => {});
  it('ignores prose and non-table rows', () => {});
});

describe('scanContractedTables', () => {
  it('returns no findings for a valid contracted source table', async () => {});
  it('emits table-contract-missing-file for a missing contract file', async () => {});
  it('emits table-contract-missing-table for a missing selected table', async () => {});
  it('emits table-contract-missing-column for missing required columns', async () => {});
  it('emits table-path-mismatch for invalid and duplicate path rows', async () => {});
  it('emits table-index-mismatch when a required path is absent', async () => {});
  it('emits table-path-mismatch when an existing-path row points at a missing repo path', async () => {});
  it('emits table-status-mismatch for invalid and unexpected statuses', async () => {});
  it('ignores unregistered markdown tables', async () => {});
});
```

Use temp repository fixtures with `mkdtempSync`, `mkdirSync`, and `writeFileSync`. Use contract objects shaped like this:

```js
const contract = {
  id: 'doc-governance-source',
  file: 'docs/automation/doc-gardening-sot.md',
  table: { heading: 'Source Of Truth Contract', ordinal: 1 },
  requiredColumns: ['Path', 'Status'],
  pathColumn: 'Path',
  statusColumn: 'Status',
  allowedStatuses: ['active', 'retired'],
  requiredPaths: ['AGENTS.md', '.codex/references/review-standards.md'],
  expectedStatuses: {
    'AGENTS.md': 'active',
    '.codex/references/review-standards.md': 'active',
  },
  requiresExistingPath: true,
  kind: 'reference',
};
```

Expected finding assertions:

```js
expect(findings).toContainEqual(
  expect.objectContaining({
    code: 'table-index-mismatch',
    severity: 'blocking',
    blocking: true,
    contractId: 'doc-governance-source',
    path: 'docs/automation/doc-gardening-sot.md',
  })
);
```

- [ ] **Step 3: Run the RED test**

Run:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Exit code is non-zero.
- Failure mentions missing export such as `parseMarkdownTables` or `scanContractedTables`.
- Existing pre-scan tests still run before the new missing-export failure.

- [ ] **Step 4: Engineer report**

Report:

- Changed file: `tests/unit/scripts/doc-gardening-check.test.mjs`.
- Command: `npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs`.
- Exit code: non-zero.
- RED reason: missing scanner exports or equivalent unimplemented behavior.
- Risk: tests only; implementation intentionally absent.

- [ ] **Step 5: Reviewer checks RED validity**

Reviewer PASS criteria:

- Tests fail for missing scanner behavior, not malformed fixtures or syntax errors.
- Tests assert exact codes, contract id, path, line where relevant, `severity: 'blocking'`, and `blocking: true`.
- Tests do not use internal-layer mocks, sleeps, focused tests, disabled tests, or exact call counts.

Reviewer REJECT criteria:

- New tests can pass against current implementation.
- Tests assert only broad report totals without validating scanner-specific evidence.
- Fixtures rely on current repository files instead of isolated temp fixtures for scanner edge cases.

- [ ] **Step 6: Commit checkpoint after Reviewer PASS**

Stage:

```bash
git add tests/unit/scripts/doc-gardening-check.test.mjs
```

Commit:

```bash
git commit -m "test: cover contracted doc table scanning"
```

Expected signal:

- Commit succeeds only after Reviewer PASS and explicit staging.

## Task 2: Minimal Parser And Scanner GREEN Implementation

**Files:**

- Modify: `scripts/doc-gardening-check.mjs`

**Owned files:** `scripts/doc-gardening-check.mjs`

**Non-scope:** no CLI behavior changes beyond exported scanner functions; no real registry activation yet; no docs changes.

- [ ] **Step 1: Engineer reads focused context**

Read:

```bash
sed -n '1,260p' scripts/doc-gardening-check.mjs
sed -n '1,340p' tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Current script already has `normalizeRelativePath`, source-of-truth safeguards, `buildReport`, and `runDocGardening`.

- [ ] **Step 2: Export the scanner API**

Add these exported functions and constants:

```js
export const tableContracts = [];

export function parseMarkdownTables(content) {}

export function normalizeContractPath(value) {}

export async function scanContractedTables({
  repoRoot = process.cwd(),
  contracts = tableContracts,
  readFile = defaultReadFile,
  pathExists = defaultPathExists,
} = {}) {}
```

Implementation rules:

- `parseMarkdownTables` returns `{ heading, ordinal, startLine, headers, rows }` entries.
- A row is `{ line, cellsByHeader, cells }`.
- Header names are trimmed but not lowercased in output.
- Table separator rows must match Markdown separator cells made from `-` and optional `:`.
- Pipe parsing must support escaped `\|` inside cell text.
- `normalizeContractPath` rejects empty strings, absolute paths, `.` paths, `..` escapes, and values normalizing outside the repo.
- `scanContractedTables` emits only registered contract findings.
- Missing file, missing table, missing columns, invalid paths, duplicate normalized paths, missing required paths, missing existing repo paths, invalid status, and expected status mismatches all emit blocking findings.

Finding shape:

```js
{
  code: 'table-status-mismatch',
  severity: 'blocking',
  blocking: true,
  contractId: contract.id,
  path: contract.file,
  line,
  message,
}
```

- [ ] **Step 3: Run scanner unit tests**

Run:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Exit code is zero.
- All existing classification/source-of-truth/fix tests still pass.
- New parser and scanner tests pass.

- [ ] **Step 4: Run changed-file quality gates**

Run:

```bash
npm run lint:changed
```

Expected signal:

- Exit code is zero.
- No ESLint warnings.

Run:

```bash
npm run type-check:changed
```

Expected signal:

- Exit code is zero.
- No JSDoc type errors.

- [ ] **Step 5: Engineer report**

Report:

- Changed file: `scripts/doc-gardening-check.mjs`.
- Verification commands and exit codes for the focused Vitest command, `npm run lint:changed`, and `npm run type-check:changed`.
- Evidence lines for exported functions and finding shape.
- Residual risk: parser intentionally handles Markdown tables only, not arbitrary Markdown semantics.

- [ ] **Step 6: Reviewer checks implementation**

Reviewer PASS criteria:

- Scanner reads only contracted files.
- Unregistered tables cannot produce findings.
- Paths are normalized as repo-relative POSIX paths and escapes are rejected.
- Blocking findings include stable code, contract id, path, line when available, severity, and message.
- No new dependency is added.

Reviewer REJECT criteria:

- Scanner performs broad Markdown scans.
- Scanner rewrites table content.
- Path validation accepts absolute paths, empty paths, or parent-directory escapes.
- Report-only semantic classes are reclassified as auto-fixable.

- [ ] **Step 7: Commit checkpoint after Reviewer PASS**

Stage:

```bash
git add scripts/doc-gardening-check.mjs
```

Commit:

```bash
git commit -m "feat: add contracted doc table scanner"
```

Expected signal:

- Commit succeeds only after Reviewer PASS and explicit staging.

## Task 3: CLI And Report Integration

**Files:**

- Modify: `tests/unit/scripts/doc-gardening-check.test.mjs`
- Modify: `scripts/doc-gardening-check.mjs`

**Owned files:** `tests/unit/scripts/doc-gardening-check.test.mjs`, `scripts/doc-gardening-check.mjs`

**Non-scope:** no real table contract activation yet; no docs changes.

- [ ] **Step 1: Write failing CLI/report tests**

Add these exact test names under `describe('runDocGardening')` or a new adjacent describe:

```js
it('runs contracted table scanning when findings are not injected', async () => {});
it('preserves injected findings without running the scanner', async () => {});
it('includes contract id line severity and blocking fields in reports', () => {});
it('does not write contracted table findings in fix mode', async () => {});
```

Use dependency injection:

```js
const scanContractedTables = vi.fn(async () => [
  {
    code: 'table-status-mismatch',
    severity: 'blocking',
    blocking: true,
    contractId: 'doc-governance-source',
    path: 'docs/automation/doc-gardening-sot.md',
    line: 12,
    message: 'Expected status active for AGENTS.md.',
  },
]);
```

Expected report finding fields:

```js
expect(result.report.findings[0]).toMatchObject({
  code: 'table-status-mismatch',
  mode: 'report-only',
  severity: 'blocking',
  blocking: true,
  contractId: 'doc-governance-source',
  path: 'docs/automation/doc-gardening-sot.md',
  line: 12,
});
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Exit code is non-zero.
- Failure shows `runDocGardening` does not yet call the scanner or report scanner fields.

- [ ] **Step 3: Implement minimal CLI/report wiring**

Change function signatures to:

```js
export function buildReport({ findings = [] } = {}) {}

export async function runDocGardening({
  args = [],
  findings,
  repoRoot = process.cwd(),
  contracts = tableContracts,
  readFile = defaultReadFile,
  pathExists = defaultPathExists,
  writeFile = defaultWriteFile,
  scanTables = scanContractedTables,
} = {}) {}
```

Implementation rules:

- If `findings` is an array, use it and do not call `scanTables`.
- If `findings` is omitted, call `scanTables({ repoRoot, contracts, readFile, pathExists })`.
- `buildReport` preserves existing `code`, `mode`, `path`, `message`, and `hasFixedContent`.
- `buildReport` adds scanner fields when present: `severity`, `blocking`, `contractId`, and `line`.
- Table mismatch codes remain report-only for fix classification, but their `blocking` flag remains true.
- `--fix` writes only existing auto-fix classes with `fixedContent` and source-of-truth paths; contracted table findings are never written automatically.
- CLI `main` passes no injected findings so the real scanner runs.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Exit code is zero.
- The new CLI/report tests pass.

Run:

```bash
npm run doc:gardening:report
```

Expected signal:

- Exit code is zero while `tableContracts` is still empty.
- Stdout is JSON with `status: "clean"` and `summary.total: 0`.

Run:

```bash
npm run doc:gardening:fix
```

Expected signal:

- Exit code is zero while `tableContracts` is still empty.
- No tracked file changes are created.

- [ ] **Step 5: Engineer report**

Report changed files, commands, exit codes, JSON report signal, and whether `git status --short` shows only task-owned files.

- [ ] **Step 6: Reviewer checks CLI/report behavior**

Reviewer PASS criteria:

- CLI uses real scanner by default.
- Tests can inject findings without hitting the filesystem.
- Contracted table findings are visible in JSON and never auto-written by fix mode.
- Existing auto-fix source-of-truth safeguards still pass.

Reviewer REJECT criteria:

- Fix mode writes contracted table findings.
- Scanner fields are dropped from report JSON.
- CLI report command returns clean without actually invoking the scanner default path.

- [ ] **Step 7: Commit checkpoint after Reviewer PASS**

Stage:

```bash
git add tests/unit/scripts/doc-gardening-check.test.mjs scripts/doc-gardening-check.mjs
```

Commit:

```bash
git commit -m "feat: wire contracted table findings into doc gardening"
```

Expected signal:

- Commit succeeds only after Reviewer PASS and explicit staging.

## Task 4: Activate First Real Contract

**Files:**

- Modify: `docs/automation/doc-gardening-sot.md`
- Modify: `scripts/doc-gardening-check.mjs`
- Modify: `tests/unit/scripts/doc-gardening-check.test.mjs`

**Owned files:** `docs/automation/doc-gardening-sot.md`, `scripts/doc-gardening-check.mjs`, `tests/unit/scripts/doc-gardening-check.test.mjs`

**Non-scope:** no AGENTS contract registration; no automatic fixes for this table; no broad doc hierarchy rewrite.

- [ ] **Step 1: Write failing registry tests**

Add these exact test names:

```js
describe('tableContracts', () => {
  it('registers the doc gardening source-of-truth contract table', () => {});
  it('keeps the checked-in source-of-truth table clean', async () => {});
});
```

Expected assertions:

```js
expect(tableContracts).toContainEqual(
  expect.objectContaining({
    id: 'doc-governance-source',
    file: 'docs/automation/doc-gardening-sot.md',
    pathColumn: 'Path',
    statusColumn: 'Status',
    allowedStatuses: ['active', 'retired'],
    requiresExistingPath: true,
    kind: 'reference',
  })
);
```

Clean checked-in table assertion:

```js
const findings = await scanContractedTables({ repoRoot: process.cwd() });
expect(findings).toEqual([]);
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Exit code is non-zero.
- Failure shows the real contract table or registry entry is absent.

- [ ] **Step 3: Add the contracted table to the source-of-truth doc**

Add this section to `docs/automation/doc-gardening-sot.md`:

```markdown
## Source Of Truth Contract

| Path | Status | Contract |
| --- | --- | --- |
| AGENTS.md | active | doc-governance-source |
| docs/automation/doc-gardening-sot.md | active | doc-governance-source |
| docs/decisions/INDEX.md | active | doc-governance-source |
| docs/superpowers/workflow.md | active | doc-governance-source |
| docs/superpowers/task-profiles.md | active | doc-governance-source |
| .codex/rules/sensors.md | active | doc-governance-source |
| .codex/references/quality-gates.md | active | doc-governance-source |
| .codex/references/review-standards.md | active | doc-governance-source |
```

This table is intentionally narrow. It checks the governance sources that this Gap C implementation directly relies on and can expand only through a future reviewed contract change.

- [ ] **Step 4: Register the contract in the script**

Replace the empty `tableContracts` export with:

```js
export const tableContracts = [
  {
    id: 'doc-governance-source',
    file: 'docs/automation/doc-gardening-sot.md',
    table: { heading: 'Source Of Truth Contract', ordinal: 1 },
    requiredColumns: ['Path', 'Status', 'Contract'],
    pathColumn: 'Path',
    statusColumn: 'Status',
    allowedStatuses: ['active', 'retired'],
    requiredPaths: [
      'AGENTS.md',
      'docs/automation/doc-gardening-sot.md',
      'docs/decisions/INDEX.md',
      'docs/superpowers/workflow.md',
      'docs/superpowers/task-profiles.md',
      '.codex/rules/sensors.md',
      '.codex/references/quality-gates.md',
      '.codex/references/review-standards.md',
    ],
    expectedStatuses: {
      'AGENTS.md': 'active',
      'docs/automation/doc-gardening-sot.md': 'active',
      'docs/decisions/INDEX.md': 'active',
      'docs/superpowers/workflow.md': 'active',
      'docs/superpowers/task-profiles.md': 'active',
      '.codex/rules/sensors.md': 'active',
      '.codex/references/quality-gates.md': 'active',
      '.codex/references/review-standards.md': 'active',
    },
    requiresExistingPath: true,
    kind: 'reference',
  },
];
```

- [ ] **Step 5: Run focused verification**

Run:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Exit code is zero.
- The checked-in table scan returns an empty findings array.

Run:

```bash
npm run doc:gardening:report
```

Expected signal:

- Exit code is zero.
- Stdout JSON has `status: "clean"` and `summary.total: 0`.

Run:

```bash
npm run doc:gardening:fix
```

Expected signal:

- Exit code is zero.
- No tracked table row is rewritten.

Run:

```bash
npm run workflow:links
```

Expected signal:

- Exit code is zero.
- No broken repo-local references in workflow-critical docs.

- [ ] **Step 6: Engineer report**

Report:

- Changed files.
- Exact contract id and table heading added.
- Verification commands and exit codes.
- Evidence that `doc:gardening:fix` made no tracked changes outside task-owned files.

- [ ] **Step 7: Reviewer checks contract activation**

Reviewer PASS criteria:

- The real table contains only existing repo paths.
- The registry required paths exactly match table rows.
- `doc:gardening:report` is clean on the checked-in repo.
- `doc:gardening:fix` does not rewrite semantic or contracted-table findings.
- AGENTS is referenced as a path but not registered as a table contract.

Reviewer REJECT criteria:

- Contract includes paths not present in the repo.
- Registry and Markdown table drift from each other.
- Fix mode modifies the contracted table.
- The contract expands to broad glob scanning.

- [ ] **Step 8: Commit checkpoint after Reviewer PASS**

Stage:

```bash
git add docs/automation/doc-gardening-sot.md scripts/doc-gardening-check.mjs tests/unit/scripts/doc-gardening-check.test.mjs
```

Commit:

```bash
git commit -m "feat: register doc governance source contract"
```

Expected signal:

- Commit succeeds only after Reviewer PASS and explicit staging.

## Task 5: Reviewer Checklist For Soft Semantic Drift

**Files:**

- Modify: `.codex/references/review-standards.md`

**Owned files:** `.codex/references/review-standards.md`

**Non-scope:** no scanner implementation; no change to quality gates; no new workflow state files.

- [ ] **Step 1: Engineer reads checklist context**

Read:

```bash
sed -n '1,140p' .codex/references/review-standards.md
sed -n '140,156p' docs/superpowers/specs/2026-05-12-gap-c-semantic-drift-design.md
```

Expected signal:

- Review standards have Reviewer Scope, PASS/REJECT evidence, and Minimum Checklist sections.

- [ ] **Step 2: Add semantic-drift checklist language**

Add a concise bullet to `## Minimum Checklist`:

```markdown
- When a task touches `AGENTS.md`, `docs/automation/**`, `docs/decisions/**`, `.codex/rules/**`, `.codex/references/**`, or `docs/superpowers/**`, semantic claims outside registered contracted tables were checked by a human Reviewer. Confirm new governance or index tables are either registered as contracts or explicitly excluded in the task scope, and confirm scanner findings were not downgraded to hide blocking table drift.
```

Add a sentence near Reviewer Scope:

```markdown
The doc-gardening contracted table scanner proves only registered table contracts; it does not prove prose, architecture claims, or implementation reality assertions.
```

- [ ] **Step 3: Run docs verification**

Run:

```bash
npm run workflow:links
```

Expected signal:

- Exit code is zero.
- No broken local references from the review standards edit.

Run:

```bash
git diff --check
```

Expected signal:

- Exit code is zero.
- No whitespace errors.

- [ ] **Step 4: Engineer report**

Report changed file, command exit codes, and the exact checklist sentence added.

- [ ] **Step 5: Reviewer checks checklist update**

Reviewer PASS criteria:

- Checklist clearly keeps soft semantic drift as a human review duty.
- Checklist names the doc families where this matters.
- Text does not imply the scanner handles arbitrary prose semantics.
- No unrelated review policy changes.

Reviewer REJECT criteria:

- Text claims scanner coverage beyond registered table contracts.
- Text makes all docs changes require broad source exploration.
- Text weakens PASS evidence or REJECT evidence requirements.

- [ ] **Step 6: Commit checkpoint after Reviewer PASS**

Stage:

```bash
git add .codex/references/review-standards.md
```

Commit:

```bash
git commit -m "docs: add semantic drift reviewer check"
```

Expected signal:

- Commit succeeds only after Reviewer PASS and explicit staging.

## Task 6: Full Integration Gate And Closeout

**Files:**

- Read/verify changed files only.
- No implementation edits unless Reviewer finds a blocking defect and the main agent dispatches a bounded fix task with explicit owned files.

**Owned files:** none for implementation; main agent may stage explicit reviewed paths during closeout after all Reviewer PASS decisions.

**Non-scope:** no new behavior, broad refactor, dependency change, local `main` merge fallback, or unreviewed fix.

- [ ] **Step 1: Confirm task state and branch**

Run:

```bash
git status --short --branch
```

Expected signal:

- Current branch is the feature branch.
- Dirty paths are limited to reviewed task-owned files or the tree is clean after commits.

- [ ] **Step 2: Run final local verification**

Run each command separately:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```

Expected signal:

- Exit code is zero.
- Contracted table scanner tests pass.

```bash
npm run doc:gardening:report
```

Expected signal:

- Exit code is zero.
- Report JSON is clean for checked-in contracts.

```bash
npm run doc:gardening:fix
```

Expected signal:

- Exit code is zero.
- No tracked file changes are created by fix mode on a clean contract table.

```bash
npm run lint:changed
```

Expected signal:

- Exit code is zero.
- No warnings.

```bash
npm run type-check:changed
```

Expected signal:

- Exit code is zero.
- No JSDoc type errors.

```bash
npm run workflow:links
```

Expected signal:

- Exit code is zero.
- Workflow-critical local links are valid.

```bash
git diff --check
```

Expected signal:

- Exit code is zero.
- No whitespace errors.

- [ ] **Step 3: Reviewer full-diff gate**

Dispatch a Reviewer subagent with:

- Files to inspect: `scripts/doc-gardening-check.mjs`, `tests/unit/scripts/doc-gardening-check.test.mjs`, `docs/automation/doc-gardening-sot.md`, `.codex/references/review-standards.md`.
- Commands to rerun or validate: focused Vitest, doc gardening report, doc gardening fix, changed lint, changed type-check, workflow links, diff check.
- Required decision: exactly one of `review_passed`, `review_rejected`, or `blocked`.

Reviewer PASS criteria:

- All task acceptance criteria are met.
- Final diff is limited to owned files.
- TDD evidence exists for RED and GREEN phases.
- Scanner behavior is deterministic and registered-table only.
- Soft semantic drift is present in Reviewer checklist.
- Verification commands have fresh exit-code evidence.

Reviewer REJECT criteria:

- Any blocking scanner behavior is missing or under-tested.
- Real contract table and registry disagree.
- Contracted findings can be auto-written by fix mode.
- Reviewer checklist omits soft semantic drift.
- Unrelated files or behavior changes are present.

- [ ] **Step 4: Commit any reviewed uncommitted final docs if needed**

If Task 4 or Task 5 left reviewed changes uncommitted, stage exact paths only:

```bash
git add docs/automation/doc-gardening-sot.md .codex/references/review-standards.md
```

Commit:

```bash
git commit -m "docs: finalize semantic drift governance"
```

Expected signal:

- Commit is created only if there are reviewed uncommitted changes.
- No checkbox-only evidence commit is created after CI would otherwise validate a previous head SHA.

- [ ] **Step 5: Push feature branch**

Run:

```bash
git push -u origin HEAD
```

Expected signal:

- Push succeeds.
- Remote branch points at the reviewed head commit.

- [ ] **Step 6: Open PR**

Use GitHub tooling to open a PR from the feature branch to `main`.

PR body must include:

- Summary of contracted table scanner behavior.
- Tests and verification commands with exit codes.
- Reviewer PASS decision summary.
- Note that soft semantic drift remains a human review checklist duty.

Expected signal:

- PR URL is available.
- PR includes no unreviewed files.

- [ ] **Step 7: Wait for required GitHub checks**

Required checks:

- `ci`
- `e2e`

Expected signal:

- Both checks complete successfully on the PR head SHA.
- If either check fails for a non-flaky reason, stop and dispatch a bounded debugging task instead of merging.

- [ ] **Step 8: Merge PR on GitHub**

Expected signal:

- PR is merged on GitHub after required checks are green.
- Merge method follows repository defaults.

- [ ] **Step 9: Fast-forward local main and switch to main**

Run:

```bash
git fetch origin main
```

Expected signal:

- Fetch succeeds.

Run:

```bash
git checkout main
```

Expected signal:

- Local branch is `main`.

Run:

```bash
git merge --ff-only origin/main
```

Expected signal:

- Local `main` fast-forwards to the merged remote commit.

Run:

```bash
git status --short --branch
```

Expected signal:

- Branch is `main`.
- Working tree is clean.

## Final Acceptance Criteria

- `scripts/doc-gardening-check.mjs` exports and uses a deterministic contracted table scanner.
- Scanner findings include stable code, blocking severity, contract id, path, line when available, and message.
- Default `doc:gardening` and report behavior run the scanner.
- Fix mode never rewrites contracted table semantic findings.
- `docs/automation/doc-gardening-sot.md` contains the first real registered path/status contract table.
- `.codex/references/review-standards.md` explicitly assigns soft semantic drift outside registered tables to human Reviewer checks.
- All implementation slices have Engineer evidence and Reviewer PASS.
- Final closeout follows feature branch push, PR, required `ci` and `e2e` green, GitHub merge, and local `main` fast-forward.

## Stop Conditions

- Any task needs a new dependency, package-lock change, CI config change, security rule change, Firebase change, or product runtime change.
- Existing docs contradict this plan or the approved design.
- The real source-of-truth contract table cannot be clean without changing files outside the owned set.
- A Reviewer rejects the same task twice without a narrow fix path.
- Verification fails for a reason outside the task-owned files.
- Main-agent authorization does not include commit, push, PR creation, merge, or local `main` sync for the requested closeout step.
