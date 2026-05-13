# Knip Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triage the current Knip findings, publish a formal report at docs/quality/2026-05-12-knip-triage.md, and make only proven low-risk config, script, or dependency metadata cleanup while keeping the full Knip report report-only.

**Architecture:** This is Option A from `specs/_legacy/superpowers/designs/2026-05-12-knip-triage-design.md`: run current Knip commands after dependencies are installed, classify findings, document the result, and apply minimal cleanup only when the classification proves the change is narrow and behavior-preserving. Implementation is performed by Engineer subagents with disjoint owned files where possible, and each repo-changing slice receives Reviewer subagent review before completion; the main agent coordinates only and does not implement or self-review source changes.

**Tech Stack:** Next.js 15 / React 19 repository, npm scripts, Knip, Node.js ES modules, Vitest for the focused Knip gate script test only when `scripts/check-knip-production-unlisted-deps.mjs` changes, changed-file lint/type-check gates.

---

## Profile And Authorization

- Profile: P2.
- Classification: C2/R2 because the task spans quality docs, npm/Knip commands, and possible package metadata or script cleanup, but must not change product runtime behavior.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-053-knip-triage`.
- Branch: `053-knip-triage`.
- Authorization boundary: this plan authorizes only the future implementation edit phase by Engineer subagents after coordinator dispatch. It does not authorize staging, committing, pushing, opening a PR, merging, or syncing local `main`.
- Current staged file to preserve: `specs/_legacy/superpowers/designs/2026-05-12-knip-triage-design.md`. Do not unstage it during implementation or review.
- Current blocker for normal commit: the pre-commit browser Vitest lane is known to time out in this workstream. Do not debug that timeout inside the Knip implementation task unless the coordinator receives explicit user authorization.

## Expected Files And Ownership

- Create: docs/quality/2026-05-12-knip-triage.md
  - Owner: Knip Triage Engineer.
  - Responsibility: formal triage report with command evidence, finding classification, minimal cleanup rationale, deferred follow-up list, stop-condition status, and report-only gate stance.
- Modify only when a finding is proven low-risk and metadata-only: `package.json`
  - Owner: Minimal Cleanup Engineer.
  - Responsibility: package script or dependency metadata correction that does not add a dependency, remove a runtime dependency without proof, or hard-gate full Knip.
- Modify only when a finding is proven low-risk and metadata-only: `package-lock.json`
  - Owner: Minimal Cleanup Engineer.
  - Responsibility: npm lockfile consistency for a non-material metadata correction. Any material lockfile update is a stop condition.
- Modify only when preserving intended report-only behavior requires it: `scripts/run-knip-report.mjs`
  - Owner: Minimal Cleanup Engineer.
  - Responsibility: keep `npm run knip:report` report-only and deterministic enough for triage evidence. Do not make full Knip blocking.
- Modify only when preserving the existing production unlisted-deps gate requires it: `scripts/check-knip-production-unlisted-deps.mjs`
  - Owner: Minimal Cleanup Engineer.
  - Responsibility: maintain fail-closed behavior for production unlisted dependency findings without expanding the gate to full Knip.
- Modify only if `scripts/check-knip-production-unlisted-deps.mjs` changes: `tests/unit/scripts/knip-production-unlisted-deps.test.js`
  - Owner: Minimal Cleanup Engineer.
  - Responsibility: focused browser Vitest coverage for the changed gate behavior.

## Global Non-Scope And Stop Conditions

Stop and return to the coordinator before editing further if any condition below appears:

- A new dependency is required.
- `package-lock.json` needs a material update.
- Cleanup requires broad source deletion, export deletion, or API surface deletion.
- Full Knip would become a hard gate.
- Any file under `project-health/**` would be read as an output target or changed.
- A Knip finding is unclear, might be a false positive, or needs ownership judgment outside config, script, or dependency metadata.
- A Knip finding suggests architecture, dependency-boundary, Firebase, auth, data-flow, or build-system work outside Option A.
- The implementation would touch files outside the expected file list above.

## Required Classification Buckets

The triage report must classify each current Knip category into exactly one bucket:

- `actionable-cleanup`: proven low-risk metadata, script, or dependency metadata cleanup completed in this task.
- `intentional-usage`: Knip reports an item that is intentionally kept because the repo uses it indirectly, externally, or by documented convention.
- `false-positive`: Knip reports an item that current configuration or generated/runtime behavior makes invalid to remove.
- `deferred-follow-up`: valid-looking cleanup that is too broad, behavior-affecting, or ownership-sensitive for Option A.
- `blocked-unclear`: any finding whose classification cannot be proven from current commands and narrow file inspection; this bucket triggers stop before cleanup.

## Task 1: Knip Triage Report

**Files:**

- Create: docs/quality/2026-05-12-knip-triage.md
- Read-only context: `specs/_legacy/superpowers/designs/2026-05-12-knip-triage-design.md`, `package.json`, `knip.json`, `scripts/run-knip-report.mjs`, `scripts/check-knip-production-unlisted-deps.mjs`
- Forbidden writes: `project-health/**`, `src/**`, `tests/**`, `package.json`, `package-lock.json`, `scripts/**`

- [ ] **Step 1: Confirm branch, staged design doc, and task boundary**

Run:

```bash
git status --short --branch
```

Expected: branch is `053-knip-triage`; `specs/_legacy/superpowers/designs/2026-05-12-knip-triage-design.md` remains staged; no implementation file is staged by the Engineer.

- [ ] **Step 2: Install current dependencies before running Knip**

Run:

```bash
npm install
```

Expected: exits 0. If this creates a material `package-lock.json` change unrelated to current package metadata, stop and report the lockfile change as an escalation blocker.

- [ ] **Step 3: Run full report-only Knip command**

Run:

```bash
npm run knip:report
```

Expected: exits 0 because `knip:report` is report-only. Output may list Knip findings. `knip-report.json` may be generated as an untracked local report artifact, but the Engineer must not stage it.

- [ ] **Step 4: Run production dependency report command**

Run:

```bash
npm run knip:production-deps
```

Expected: exits 0 because the script passes `--no-exit-code`. Output may list production dependency or unlisted dependency findings for triage.

- [ ] **Step 5: Run production unlisted dependency gate**

Run:

```bash
npm run knip:production-unlisted-deps
```

Expected: exits 0 only when no production unlisted dependencies are found. If it exits 1 with production unlisted dependency findings, document the findings and stop before cleanup unless each finding is proven to be metadata-only.

- [ ] **Step 6: Write formal triage report**

Create docs/quality/2026-05-12-knip-triage.md with this structure:

```markdown
# Knip Triage

Date: 2026-05-12
Branch: `053-knip-triage`
Mode: Option A - triage plus minimal cleanup

## Summary

- Full Knip report remains report-only through `npm run knip:report`.
- Production unlisted dependency checking remains limited to `npm run knip:production-unlisted-deps`.
- No `project-health/**` output is used.
- No broad source, export, or runtime cleanup is part of this task.

## Commands

| Command | Exit | Signal |
| --- | ---: | --- |

The report must contain one row for each command run in Task 1. Each row must
include the observed numeric exit code and a short concrete signal copied from
the command result, such as `exited 0 and wrote knip-report.json` or `exited 1
with production unlisted dependency findings`.

## Classification

| Bucket | Finding | Evidence | Decision |
| --- | --- | --- | --- |

The report must contain one row for each Knip finding category observed in
Task 1. If a bucket has no findings, write one row with `none observed` in
`Finding`, the command that proved absence in `Evidence`, and `no action` in
`Decision`.

## Minimal Cleanup Rationale

- Cleanup is limited to config, script, or dependency metadata.
- Runtime source and export deletion are excluded.
- Full Knip remains report-only.

## Stop Condition Review

| Stop condition | Status |
| --- | --- |
| New dependency required | `no` |
| Material `package-lock.json` update required | `no` |
| Broad source or export deletion required | `no` |
| Full Knip hard-gate required | `no` |
| `project-health/**` touched | `no` |
| Unclear Knip false positive | `no` |

## Verification

Verification must be filled after implementation and Reviewer review.
```

Expected: the final report contains no placeholder text. If any row cannot be filled from evidence, classify it under `blocked-unclear` and stop before cleanup.

- [ ] **Step 7: Report Engineer evidence**

Return:

- changed file list containing only docs/quality/2026-05-12-knip-triage.md.
- command exit codes for `npm install`, `npm run knip:report`, `npm run knip:production-deps`, and `npm run knip:production-unlisted-deps`.
- statement that `project-health/**` was not touched.
- uncertainty list, including every `blocked-unclear` row.

## Task 2: Minimal Cleanup

**Files:**

- Modify only if justified by Task 1: `package.json`
- Modify only if justified by Task 1 and non-material: `package-lock.json`
- Modify only if justified by Task 1: `scripts/run-knip-report.mjs`
- Modify only if justified by Task 1: `scripts/check-knip-production-unlisted-deps.mjs`
- Modify only if `scripts/check-knip-production-unlisted-deps.mjs` changes: `tests/unit/scripts/knip-production-unlisted-deps.test.js`
- Modify: docs/quality/2026-05-12-knip-triage.md
- Forbidden writes: `project-health/**`, `src/**`, broad test suites, generated `knip-report.json`

- [ ] **Step 1: Confirm Task 1 permits cleanup**

Read docs/quality/2026-05-12-knip-triage.md.

Expected: at least one finding is classified as `actionable-cleanup`; zero findings are classified as `blocked-unclear`. If there is no `actionable-cleanup` finding, skip Task 2 and return to the coordinator.

- [ ] **Step 2: Apply only metadata or script cleanup proven by triage**

Permitted edits are limited to these patterns:

```text
package.json
- remove or correct package metadata only when the triage proves the package is unused by production, scripts, tests, and tooling.
- keep `knip:report` report-only.
- keep `knip:production-deps` report-only.
- keep `knip:production-unlisted-deps` scoped to production unlisted dependency failure.

scripts/run-knip-report.mjs
- preserve exit code 0.
- preserve compact stdout output.
- preserve JSON artifact writing for local report inspection.

scripts/check-knip-production-unlisted-deps.mjs
- preserve fail-closed behavior on malformed Knip JSON.
- preserve failure on production unlisted dependency findings.
- do not fail on unrelated full Knip findings.
```

Expected: no app runtime file changes; no broad export/source deletion; no full Knip hard gate.

- [ ] **Step 3: Update triage report with cleanup result**

Modify docs/quality/2026-05-12-knip-triage.md.

Expected: each completed cleanup has command evidence, file evidence, and a reason it stays inside Option A. Any deferred cleanup remains in `deferred-follow-up`.

- [ ] **Step 4: Run focused test only if the gate script changed**

Run this command only when `scripts/check-knip-production-unlisted-deps.mjs` changed:

```bash
npx vitest run --project=browser tests/unit/scripts/knip-production-unlisted-deps.test.js
```

Expected: exits 0. If it times out because of the known browser Vitest pre-commit blocker, report the timeout and stop; do not debug that timeout without explicit authorization.

- [ ] **Step 5: Report Engineer evidence**

Return:

- changed file list limited to the Task 2 owned files.
- exact cleanup classification rows that justified each edit.
- command exit code for the focused Vitest command when it ran.
- statement that no dependency was added, full Knip was not hard-gated, `project-health/**` was not touched, and no broad source/export deletion was performed.

## Task 3: Reviewer Check

**Files:**

- Review: docs/quality/2026-05-12-knip-triage.md
- Review if changed: `package.json`
- Review if changed: `package-lock.json`
- Review if changed: `scripts/run-knip-report.mjs`
- Review if changed: `scripts/check-knip-production-unlisted-deps.mjs`
- Review if changed: `tests/unit/scripts/knip-production-unlisted-deps.test.js`
- Forbidden writes: all files

- [ ] **Step 1: Inspect changed files**

Run:

```bash
git diff --name-only
```

Expected: changed files are limited to the review file list. `project-health/**`, `src/**`, and generated `knip-report.json` are absent.

- [ ] **Step 2: Verify no staged implementation files were added by subagents**

Run:

```bash
git diff --cached --name-only
```

Expected: staged files are unchanged from the coordinator baseline unless the coordinator explicitly staged later. The staged design doc must not be unstaged by the implementation task.

- [ ] **Step 3: Review Knip gate stance**

Inspect `package.json`, `scripts/run-knip-report.mjs`, and `scripts/check-knip-production-unlisted-deps.mjs` when changed.

Expected:

- `npm run knip:report` remains report-only.
- Full Knip is not hard-gated.
- `npm run knip:production-unlisted-deps` remains the narrow production unlisted dependency gate.
- No new dependency is introduced.

- [ ] **Step 4: Review triage classification**

Inspect docs/quality/2026-05-12-knip-triage.md.

Expected:

- every Knip category has one classification bucket.
- `blocked-unclear` is empty before cleanup is accepted.
- deferred findings are not implemented in this task.
- stop condition review is evidence-backed.

- [ ] **Step 5: Return Reviewer decision**

Return:

- `review_passed` or `review_rejected`.
- file/line references for any rejected finding.
- command evidence inspected.
- uncertainty list. If no uncertainty remains, state `none`.

## Task 4: Final Verification

**Files:**

- Read-only verification over current worktree.
- Forbidden writes: all files except tool-generated transient local reports that must remain unstaged.

- [ ] **Step 1: Run full report-only Knip command**

Run:

```bash
npm run knip:report
```

Expected: exits 0. Full Knip remains report-only; findings may remain documented in docs/quality/2026-05-12-knip-triage.md.

- [ ] **Step 2: Run production dependency report command**

Run:

```bash
npm run knip:production-deps
```

Expected: exits 0 because the command is report-only through `--no-exit-code`; remaining findings are documented or deferred.

- [ ] **Step 3: Run production unlisted dependency gate**

Run:

```bash
npm run knip:production-unlisted-deps
```

Expected: exits 0. If it exits non-zero, the report must classify the findings and the coordinator must decide whether to stop or revise scope.

- [ ] **Step 4: Run focused browser Vitest only if the gate script changed**

Run this command only when `scripts/check-knip-production-unlisted-deps.mjs` changed:

```bash
npx vitest run --project=browser tests/unit/scripts/knip-production-unlisted-deps.test.js
```

Expected: exits 0. Known pre-commit browser Vitest timeout remains a blocker for normal commit; do not debug that timeout inside this task without explicit authorization.

- [ ] **Step 5: Run changed-file lint**

Run:

```bash
npm run lint:changed
```

Expected: exits 0, or reports only the known pre-commit browser Vitest timeout if the repo hook invokes that lane. Do not debug the timeout without explicit authorization.

- [ ] **Step 6: Run changed-file type check**

Run:

```bash
npm run type-check:changed
```

Expected: exits 0.

- [ ] **Step 7: Run whitespace diff check**

Run:

```bash
git diff --check
```

Expected: exits 0 with no whitespace errors.

- [ ] **Step 8: Report final verification evidence**

Return:

- command exit code for each command in Steps 1-7.
- changed files.
- generated but unstaged local report artifacts, including `knip-report.json` if present.
- remaining uncertainties.
- explicit statement that no staging and no commit were performed.
