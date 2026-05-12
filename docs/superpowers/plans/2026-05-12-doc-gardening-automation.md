# Doc Gardening Automation Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Build the repo-tracked source-of-truth contract, mechanical doc-gardening checker/reporting lane, and weekly Codex cron setup for recurring documentation gardening.
**Architecture:** Keep policy in a repo source-of-truth markdown file, implement mechanical checks in focused Node scripts, expose them through npm scripts, and create the Codex cron runner only after repo behavior is reviewed and merged. The automation reports every run, auto-fixes only metadata/link/index mismatches, and keeps semantic drift, QUALITY_SCORE, TECH_DEBT, and ADR coverage report-only.
**Tech Stack:** Node.js scripts, npm scripts, Markdown docs, Codex automation tool, GitHub PR/CI closeout.
---
## File Structure
Future files to create:
```text
docs/automation/doc-gardening-sot.md
scripts/doc-gardening-check.mjs
tests/unit/scripts/doc-gardening-check.test.mjs
```
- Modify `package.json`
- Create Codex automation using tool after repo PR merges, not as tracked file
## Hard Constraints
- Auto-fix only metadata/link/index mismatch.
- Semantic drift, `QUALITY_SCORE`, `TECH_DEBT`, ADR/design-doc coverage are report-only.
- No project-health report as source of truth.
- Main agent coordinates only; Engineer edits; Reviewer reviews.
- One command per evidence item; no chained verification commands.
- Explicit staging paths only.
- Final closeout: push PR, wait for `ci` and `e2e`, GitHub merge, local main `pull --ff-only`, final branch main.
- Weekly Codex automation is created after merge, not as tracked repo state.
## Concrete Snippets
Markdown outline for future file docs/automation/doc-gardening-sot.md:
```markdown
# Doc Gardening Source of Truth
> Last-Verified: 2026-05-12
## Purpose
Defines the repo-tracked contract for recurring documentation gardening.
## Source of Truth Hierarchy
1. `AGENTS.md`
2. `.codex/rules/**`
3. `.codex/references/**`
4. `docs/decisions/INDEX.md`
5. Active `specs/<feature>/handoff.md`, `tasks.md`, and `status.json`
`project-health/**` files are observation reports only.
## Auto-Fix Classes
- metadata mismatch
- link mismatch
- index mismatch
## Report-Only Classes
- semantic drift
- `QUALITY_SCORE`
- `TECH_DEBT`
- ADR coverage
- design-doc coverage
```
JS test snippet for classification, source hierarchy, report shape, fix refusal, and CLI write behavior:
```js
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReport,
  classifyFinding,
  isSourceOfTruthPath,
  runDocGardening,
} from "../../../scripts/doc-gardening-check.mjs";

const semanticFinding = {
  type: "semantic-drift",
  path: ".codex/references/quality-gates.md",
  message: "Human review required",
};

describe("doc gardening checker contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T00:00:00.000Z"));
  });

  it("allows only mechanical mismatch classes to be fixed", () => {
    expect(classifyFinding({ type: "metadata-mismatch" }).mode).toBe("auto-fix");
    expect(classifyFinding({ type: "link-mismatch" }).mode).toBe("auto-fix");
    expect(classifyFinding({ type: "index-mismatch" }).mode).toBe("auto-fix");
  });
  it("keeps semantic and coverage findings report-only", () => {
    expect(classifyFinding({ type: "semantic-drift" }).mode).toBe("report-only");
    expect(classifyFinding({ type: "quality-score" }).mode).toBe("report-only");
    expect(classifyFinding({ type: "tech-debt" }).mode).toBe("report-only");
    expect(classifyFinding({ type: "adr-coverage" }).mode).toBe("report-only");
    expect(classifyFinding({ type: "design-doc-coverage" }).mode).toBe("report-only");
  });

  it("never treats project-health reports as source of truth", () => {
    expect(isSourceOfTruthPath("AGENTS.md")).toBe(true);
    expect(isSourceOfTruthPath(".codex/rules/testing-standards.md")).toBe(true);
    expect(isSourceOfTruthPath("project-health/2026-05-12/report.md")).toBe(false);
    expect(isSourceOfTruthPath("project-health/current/status.json")).toBe(false);
  });

  it("builds a stable JSON report shape", () => {
    const report = buildReport({
      mode: "report",
      findings: [
        { type: "metadata-mismatch", path: "AGENTS.md", message: "Last-Verified metadata differs" },
        semanticFinding,
      ],
      fixedPaths: [],
    });

    expect(report).toEqual({
      generatedAt: "2026-05-12T00:00:00.000Z",
      sourceOfTruth: "docs/automation/doc-gardening-sot.md",
      mode: "report",
      summary: { total: 2, autoFixable: 1, reportOnly: 1, fixed: 0 },
      findings: [
        {
          type: "metadata-mismatch",
          mode: "auto-fix",
          path: "AGENTS.md",
          message: "Last-Verified metadata differs",
        },
        {
          type: "semantic-drift",
          mode: "report-only",
          path: ".codex/references/quality-gates.md",
          message: "Human review required",
        },
      ],
    });
  });

  it("refuses to write files for report-only findings in fix mode", async () => {
    const writeFile = vi.fn();

    const report = await runDocGardening({
      argv: ["--fix"],
      findings: [semanticFinding],
      writeFile,
    });

    expect(report.summary).toEqual({ total: 1, autoFixable: 0, reportOnly: 1, fixed: 0 });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("writes only in fix mode and only for auto-fix findings", async () => {
    const writeFile = vi.fn();
    const finding = {
      type: "metadata-mismatch",
      path: "AGENTS.md",
      message: "Last-Verified metadata differs",
      fixedContent: "# AGENTS.md\n> Last-Verified: 2026-05-12\n",
    };

    await runDocGardening({ argv: [], findings: [finding], writeFile });
    await runDocGardening({ argv: ["--report"], findings: [finding], writeFile });
    expect(writeFile).not.toHaveBeenCalled();

    await runDocGardening({ argv: ["--fix"], findings: [finding], writeFile });
    expect(writeFile).toHaveBeenCalledWith("AGENTS.md", finding.fixedContent);
  });
});
```
JS implementation snippet for source hierarchy, reports, fix refusal, and CLI modes:
```js
const AUTO_FIX_TYPES = new Map([
  ["metadata-mismatch", "metadata mismatch"],
  ["link-mismatch", "link mismatch"],
  ["index-mismatch", "index mismatch"],
]);
const REPORT_ONLY_TYPES = new Map([
  ["semantic-drift", "semantic drift"],
  ["quality-score", "QUALITY_SCORE"],
  ["tech-debt", "TECH_DEBT"],
  ["adr-coverage", "ADR coverage"],
  ["design-doc-coverage", "design-doc coverage"],
]);

const SOURCE_OF_TRUTH_PATHS = [
  "AGENTS.md",
  "docs/decisions/INDEX.md",
];

const SOURCE_OF_TRUTH_PREFIXES = [
  ".codex/rules/",
  ".codex/references/",
  "specs/",
];

export function classifyFinding(finding) {
  const fixReason = AUTO_FIX_TYPES.get(finding.type);
  if (fixReason) return { mode: "auto-fix", reason: fixReason };
  return { mode: "report-only", reason: REPORT_ONLY_TYPES.get(finding.type) ?? "unclassified finding" };
}

export function isSourceOfTruthPath(path) {
  if (path.startsWith("project-health/")) return false;
  if (SOURCE_OF_TRUTH_PATHS.includes(path)) return true;
  if (!SOURCE_OF_TRUTH_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  if (!path.startsWith("specs/")) return true;
  return /\/(handoff\.md|tasks\.md|status\.json)$/.test(path);
}

export function buildReport({ mode, findings, fixedPaths = [] }) {
  const normalized = findings.map((finding) => ({
    ...finding,
    mode: classifyFinding(finding).mode,
  }));

  return {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: "docs/automation/doc-gardening-sot.md",
    mode,
    summary: {
      total: normalized.length,
      autoFixable: normalized.filter((finding) => finding.mode === "auto-fix").length,
      reportOnly: normalized.filter((finding) => finding.mode === "report-only").length,
      fixed: fixedPaths.length,
    },
    findings: normalized,
  };
}

export async function runDocGardening({ argv, findings, writeFile }) {
  const mode = argv.includes("--fix") ? "fix" : argv.includes("--report") ? "report" : "check";
  const fixedPaths = [];

  if (mode === "fix") {
    for (const finding of findings) {
      if (classifyFinding(finding).mode !== "auto-fix") continue;
      if (typeof finding.fixedContent !== "string") continue;
      await writeFile(finding.path, finding.fixedContent);
      fixedPaths.push(finding.path);
    }
  }

  return buildReport({ mode, findings, fixedPaths });
}
```
JSON report shape:
```json
{
  "generatedAt": "2026-05-12T00:00:00.000Z",
  "sourceOfTruth": "docs/automation/doc-gardening-sot.md",
  "mode": "report",
  "summary": { "total": 3, "autoFixable": 1, "reportOnly": 2, "fixed": 0 },
  "findings": [
    { "type": "metadata-mismatch", "mode": "auto-fix", "path": "AGENTS.md", "message": "Last-Verified metadata differs" },
    { "type": "semantic-drift", "mode": "report-only", "path": ".codex/references/quality-gates.md", "message": "Human review required" }
  ]
}
```
`package.json` script names:
```json
{
  "scripts": {
    "doc:gardening": "node scripts/doc-gardening-check.mjs",
    "doc:gardening:report": "node scripts/doc-gardening-check.mjs --report",
    "doc:gardening:fix": "node scripts/doc-gardening-check.mjs --fix"
  }
}
```
## Implementation Tasks
### Task 1 Repo SoT Contract Markdown
**Files list**
```text
docs/automation/doc-gardening-sot.md
```
**Steps**
- [ ] Engineer creates the SoT markdown file from the outline above.
- [ ] Encode source hierarchy, project-health exclusion, auto-fix classes, and report-only classes.
- [ ] Define report/check/fix modes and human review expectations.
- [ ] Reviewer confirms policy is narrow and enforceable.
**Commands with expected signal**
- [ ] Run:
```bash
rg -n "project-health|Auto-Fix|Report-Only" docs/automation/doc-gardening-sot.md
```
  - Expected signal: required policy anchors are present.
- [ ] Run:
```bash
git diff -- docs/automation/doc-gardening-sot.md
```
  - Expected signal: only the SoT file changed.
**Commit checkpoint**
- Commit candidate: `docs: add doc gardening source contract`
- Stage explicitly:
```bash
git add docs/automation/doc-gardening-sot.md
```
**Engineer/Reviewer requirement**
- Engineer writes; Reviewer verifies no report-only class is auto-fixable.
### Task 2 Failing Tests and Fixtures
**Files list**
```text
tests/unit/scripts/doc-gardening-check.test.mjs
```
**Steps**
- [ ] Engineer creates focused Vitest coverage using the concrete test snippet above.
- [ ] Test allowed auto-fix classification and report-only classification with `classifyFinding()`.
- [ ] Test `project-health/**` is never source of truth with `isSourceOfTruthPath("project-health/2026-05-12/report.md")`.
- [ ] Test JSON report shape with `buildReport({ mode: "report", findings, fixedPaths: [] })`.
- [ ] Test `--fix` refusal for report-only findings by injecting `writeFile = vi.fn()` and asserting it is not called.
- [ ] Test CLI write behavior by running `runDocGardening()` with `[]`, `["--report"]`, and `["--fix"]`; only `["--fix"]` may call `writeFile`, and only for auto-fix findings.
- [ ] Run targeted test and keep the expected missing-module failure.
- [ ] Reviewer confirms tests encode the SoT contract.
**Commands with expected signal**
- [ ] Run:
```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```
  - Expected signal: fails because checker module is absent.
- [ ] Run:
```bash
git diff -- tests/unit/scripts/doc-gardening-check.test.mjs
```
  - Expected signal: only tests and fixtures changed.
**Commit checkpoint**
- Commit candidate: `test: cover doc gardening classification`
- Stage explicitly:
```bash
git add tests/unit/scripts/doc-gardening-check.test.mjs
```
**Engineer/Reviewer requirement**
- Engineer writes failing tests; Reviewer checks failure reason and coverage.
### Task 3 Node Checker/Report Implementation
**Files list**
```text
scripts/doc-gardening-check.mjs
tests/unit/scripts/doc-gardening-check.test.mjs
```
**Steps**
- [ ] Engineer creates the checker module from the implementation snippet above and exports `classifyFinding()`, `isSourceOfTruthPath()`, `buildReport()`, and `runDocGardening()`.
- [ ] Implement default check mode plus `--report` and `--fix` by deriving `mode` from `argv.includes("--fix")` and `argv.includes("--report")`.
- [ ] Keep filesystem writes behind the injected `writeFile(path, content)` function so tests prove write behavior without touching disk.
- [ ] Ensure report-only findings never edit files by continuing the fix loop unless `classifyFinding(finding).mode === "auto-fix"`.
- [ ] Ensure `project-health/**` can be scanned as evidence but `isSourceOfTruthPath()` always returns `false` for it.
- [ ] Run targeted tests until green.
- [ ] Reviewer verifies SoT compliance.
**Commands with expected signal**
- [ ] Run:
```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```
  - Expected signal: tests pass.
- [ ] Run:
```bash
node scripts/doc-gardening-check.mjs --report
```
  - Expected signal: valid JSON report prints.
- [ ] Run:
```bash
node scripts/doc-gardening-check.mjs --fix
```
  - Expected signal: only allowed mechanical fixes apply.
- [ ] Run:
```bash
git diff -- scripts/doc-gardening-check.mjs tests/unit/scripts/doc-gardening-check.test.mjs
```
  - Expected signal: scoped checker/test diff.
**Commit checkpoint**
- Commit candidate: `feat: add doc gardening checker`
- Stage explicitly:
```bash
git add scripts/doc-gardening-check.mjs tests/unit/scripts/doc-gardening-check.test.mjs
```
**Engineer/Reviewer requirement**
- Engineer implements; Reviewer verifies `--fix` cannot alter report-only findings.
### Task 4 Npm Scripts and Local Verification
**Files list**
- `package.json`
```text
scripts/doc-gardening-check.mjs
tests/unit/scripts/doc-gardening-check.test.mjs
```
**Steps**
- [ ] Engineer adds `doc:gardening`, `doc:gardening:report`, and `doc:gardening:fix`.
- [ ] Wire default, report, and fix modes directly to the Node script.
- [ ] Run targeted tests and each npm script separately.
- [ ] Confirm no report-only edits appear after fix mode.
- [ ] Reviewer checks script names and command shape.
**Commands with expected signal**
- [ ] Run:
```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```
  - Expected signal: targeted tests pass.
- [ ] `npm run doc:gardening`
  - Expected signal: check-mode status reflects findings.
- [ ] `npm run doc:gardening:report`
  - Expected signal: report output is emitted.
- [ ] `npm run doc:gardening:fix`
  - Expected signal: only metadata/link/index mismatches are fixed.
**Commit checkpoint**
- Commit candidate: `chore: expose doc gardening scripts`
- Stage explicitly:
```bash
git add package.json scripts/doc-gardening-check.mjs tests/unit/scripts/doc-gardening-check.test.mjs
```
**Engineer/Reviewer requirement**
- Engineer wires scripts; Reviewer verifies no chained npm scripts or safeguard bypass.
### Task 5 Codex Weekly Automation Setup After Merge
**Files list**
- No tracked file for the automation.
- Codex automation created using tool after repo PR merges.
**Steps**
- [ ] Main agent confirms PR merged through GitHub and switches to `main`.
- [ ] Main agent runs local `main` fast-forward sync and confirms final branch is `main`.
- [ ] Main agent creates weekly Codex automation using the tool on the approved schedule: weekly Monday 09:00 Asia/Taipei.
- [ ] Automation runs `npm run doc:gardening:report`, reports every run, and never auto-commits.
- [ ] Automation suggests fixes only after explicit approval.
- [ ] Reviewer or user confirms the weekly Monday 09:00 Asia/Taipei schedule and prompt before enabling.
**Commands with expected signal**
- [ ] `git status --short --branch`
  - Expected signal: branch is `main` and worktree is clean.
- [ ] `npm run doc:gardening:report`
  - Expected signal: report output is available from merged `main`.
**Commit checkpoint**
- No commit; automation is external runtime state.
**Engineer/Reviewer requirement**
- Main agent coordinates; Reviewer or user confirms before enabling.
### Task 6 Integration Closeout
**Files list**
- `package.json`
```text
docs/automation/doc-gardening-sot.md
scripts/doc-gardening-check.mjs
tests/unit/scripts/doc-gardening-check.test.mjs
```
**Steps**
- [ ] Engineer confirms changed files are expected.
- [ ] Engineer runs targeted tests, report command, and changed-file lint or branch gate.
- [ ] Reviewer reviews full diff.
- [ ] Main agent stages explicit paths only.
- [ ] Main agent commits, pushes, opens PR, and waits for `ci` and `e2e`.
- [ ] Main agent merges through GitHub, syncs local `main`, confirms final branch main, and creates automation.
**Commands with expected signal**
- [ ] `git status --short --branch`
  - Expected signal: feature branch, only planned files changed.
- [ ] Run:
```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
```
  - Expected signal: targeted tests pass.
- [ ] `npm run doc:gardening:report`
  - Expected signal: deterministic report summary emits.
- [ ] `npm run doc:freshness`
  - Expected signal: existing doc freshness gate passes.
- [ ] `npm run lint:changed`
  - Expected signal: changed-file lint passes.
- [ ] `git diff --check`
  - Expected signal: no whitespace errors.
- [ ] Run:
```bash
git add docs/automation/doc-gardening-sot.md scripts/doc-gardening-check.mjs tests/unit/scripts/doc-gardening-check.test.mjs package.json
```
- [ ] `git status --short --branch`
- [ ] `git commit`
- [ ] `git push`
- [ ] `git pull --ff-only`
**Commit checkpoint**
- Final commit candidate: `feat: add doc gardening automation checks`
- Stage explicitly:
```bash
git add docs/automation/doc-gardening-sot.md scripts/doc-gardening-check.mjs tests/unit/scripts/doc-gardening-check.test.mjs package.json
```
**Engineer/Reviewer requirement**
- Engineer owns implementation evidence; Reviewer approves before completion; Main agent handles closeout only within authorization.
