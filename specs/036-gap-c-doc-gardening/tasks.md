# Gap C Doc-Gardening MVP Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/036-gap-c-doc-gardening/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `specs/036-gap-c-doc-gardening/handoff.md`, this file, and `specs/036-gap-c-doc-gardening/status.json` before dispatching work. Then read `spec.md` and `plan.md` for feature context.
- Main agent is coordinator only. Code, script, CI, and executable test changes belong to Engineer workers.
- A task can be checked only after Reviewer PASS.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Parallel waves are not recommended for this MVP because T003, T004, and T005 depend on the same key-doc list and shared gate semantics.
- If parallelized anyway, only T002 and T003 may run together after T001, and a final integration gate must run before T004 starts.

## Tasks

### T001 — Planning Seed Verification

- **Status**: `[x]`
- **Scope**: Create the Superpowers workflow artifact set for this feature and verify it does not touch non-spec files.
- **Owned files**:
  - `specs/036-gap-c-doc-gardening/spec.md`
  - `specs/036-gap-c-doc-gardening/plan.md`
  - `specs/036-gap-c-doc-gardening/tasks.md`
  - `specs/036-gap-c-doc-gardening/handoff.md`
  - `specs/036-gap-c-doc-gardening/status.json`
- **Dependencies**: none
- **Engineer**: Engineer worker
- **Reviewer**: Reviewer worker
- **Commit checkpoint**: `chore: seed gap c doc gardening workflow`

Acceptance criteria:

- AC-T001.1: All five required workflow artifacts exist under `specs/036-gap-c-doc-gardening/`.
- AC-T001.2: `spec.md` contains WHAT/WHY, scenarios, requirements, success criteria, out-of-scope, and authorization only.
- AC-T001.3: `plan.md` defines implementation scope, file responsibilities, metadata contract, 45-day stale threshold, testing strategy, risks, and all task slices.
- AC-T001.4: `tasks.md` includes Engineer + Reviewer, owned files, dependencies, acceptance criteria, verification commands, commit checkpoints, and evidence slots for T001-T006.
- AC-T001.5: `status.json` is valid JSON and machine-readable.
- AC-T001.6: No files outside `specs/036-gap-c-doc-gardening/` are modified by this task.

Verification commands:

```bash
git status --short
find specs/036-gap-c-doc-gardening -maxdepth 1 -type f | sort
node -e "JSON.parse(require('fs').readFileSync('specs/036-gap-c-doc-gardening/status.json', 'utf8')); console.log('status ok')"
```

Engineer evidence:

- Files changed: created the five files listed in T001 owned files.
- Commands: `git status --short` exit 0, `find specs/036-gap-c-doc-gardening -maxdepth 1 -type f | sort` exit 0, `node -e "JSON.parse(require('fs').readFileSync('specs/036-gap-c-doc-gardening/status.json', 'utf8')); console.log('status ok')"` exit 0.
- Evidence: target worktree status only shows `?? specs/036-gap-c-doc-gardening/`; file list contains `handoff.md`, `plan.md`, `spec.md`, `status.json`, and `tasks.md`; JSON parse printed `status ok`.
- Review-fix update: addressed Reviewer REJECT by adding T004 negative-path verification, aligning resume order with `docs/superpowers/workflow.md`, and adding the 45-day stale threshold across planning artifacts.
- Risks: Reviewer still needs to confirm task granularity, the MVP key-doc set, and the planned `DOC_FRESHNESS_ROOT` script interface.

Reviewer evidence:

- PASS: Reviewer re-checked the five planning artifacts after the review-fix pass.
- Checked scope: worktree still shows only `?? specs/036-gap-c-doc-gardening/`.
- Checked contracts: T004 includes missing-metadata and 46-day stale negative-path verification via `DOC_FRESHNESS_ROOT`; resume read order matches `AGENTS.md` -> `docs/superpowers/workflow.md` -> `handoff.md` -> `tasks.md` -> `status.json`; MVP scope stays limited to review standards, `Last-Verified`, freshness script, package script, and CI.
- Commands/evidence: `status.json` parses; `rg` confirms 45-day stale, negative-path, `Last-Verified`, and `handoff.md` references.

### T002 — Review-Standards Minimal Reference Doc

- **Status**: `[x]`
- **Scope**: Create the minimum reviewer reference without duplicating existing quality-gate documentation.
- **Owned files**:
  - `.codex/references/review-standards.md`
- **Dependencies**: T001 Reviewer PASS
- **Engineer**: Engineer worker
- **Reviewer**: Reviewer worker
- **Commit checkpoint**: `docs: add review standards reference`

Acceptance criteria:

- AC-T002.1: `.codex/references/review-standards.md` exists.
- AC-T002.2: The document includes `Last-Verified` metadata using `> Last-Verified: YYYY-MM-DD`.
- AC-T002.3: The document defines reviewer scope, severity ordering, PASS/REJECT evidence, and a minimum checklist.
- AC-T002.4: The document links or points to `.codex/references/quality-gates.md` and `.codex/references/testing-handbook.md` instead of copying their full contents.
- AC-T002.5: The document does not add new process requirements outside the approved MVP.

Verification commands:

```bash
test -f .codex/references/review-standards.md
rg -n "^> Last-Verified: [0-9]{4}-[0-9]{2}-[0-9]{2}$" .codex/references/review-standards.md
rg -n "PASS|REJECT|quality-gates|testing-handbook" .codex/references/review-standards.md
```

Engineer evidence:

- Pending: record files changed, commands run, exit codes, and risks.

Reviewer evidence:

- PASS: Reviewer confirmed `.codex/references/review-standards.md` exists, includes `> Last-Verified: 2026-05-10`, defines reviewer scope, severity ordering, PASS evidence, REJECT evidence, and a minimum checklist.
- Scope check: The file points to `.codex/references/quality-gates.md` and `.codex/references/testing-handbook.md` without copying their full contents; no MVP-external process requirements were added.
- Commands: `test -f .codex/references/review-standards.md` exit 0; `rg -n "^> Last-Verified: [0-9]{4}-[0-9]{2}-[0-9]{2}$" .codex/references/review-standards.md` exit 0; `rg -n "PASS|REJECT|quality-gates|testing-handbook" .codex/references/review-standards.md` exit 0.

### T003 — Last-Verified Metadata On Key Docs

- **Status**: `[x]`
- **Scope**: Add or normalize freshness metadata on the MVP key-doc set.
- **Owned files**:
  - `AGENTS.md`
  - `docs/superpowers/workflow.md`
  - `.codex/references/quality-gates.md`
  - `.codex/references/testing-handbook.md`
  - `.codex/references/review-standards.md`
  - `docs/QUALITY_SCORE.md`
- **Dependencies**: T002 Reviewer PASS
- **Engineer**: Engineer worker
- **Reviewer**: Reviewer worker
- **Commit checkpoint**: `docs: add last verified metadata`

Acceptance criteria:

- AC-T003.1: Every owned markdown file contains exactly one `> Last-Verified: YYYY-MM-DD` line.
- AC-T003.2: Existing content, headings, tables, and meanings are preserved except for the metadata addition or normalization.
- AC-T003.3: `docs/QUALITY_SCORE.md` keeps its existing `Last Updated` and `Next Review` information; `Last-Verified` is an additional freshness signal, not a replacement.
- AC-T003.4: No unapproved markdown files are edited.

Verification commands:

```bash
rg -n "^> Last-Verified: [0-9]{4}-[0-9]{2}-[0-9]{2}$" AGENTS.md docs/superpowers/workflow.md .codex/references/quality-gates.md .codex/references/testing-handbook.md .codex/references/review-standards.md docs/QUALITY_SCORE.md
git diff -- AGENTS.md docs/superpowers/workflow.md .codex/references/quality-gates.md .codex/references/testing-handbook.md .codex/references/review-standards.md docs/QUALITY_SCORE.md
```

Engineer evidence:

- Pending: record files changed, commands run, exit codes, and risks.

Reviewer evidence:

- PASS: Reviewer confirmed all six key docs contain exactly one `> Last-Verified: 2026-05-10` line.
- Scope check: Existing tracked-doc diffs are metadata-only; `docs/QUALITY_SCORE.md` keeps `Last Updated: 2026-05-03` and `Next Review: 2026-06-03`.
- Commands: T003 `rg` metadata check exit 0; T003 `git diff -- ...six files...` exit 0; `git diff --check -- ...six files...` exit 0.

### T004 — Doc Freshness Script Plus Package Script

- **Status**: `[x]`
- **Scope**: Add a deterministic shell checker and expose it through npm.
- **Owned files**:
  - `scripts/doc-freshness-check.sh`
  - `package.json`
- **Dependencies**: T003 Reviewer PASS
- **Engineer**: Engineer worker
- **Reviewer**: Reviewer worker
- **Commit checkpoint**: `chore: add doc freshness check`

Acceptance criteria:

- AC-T004.1: `scripts/doc-freshness-check.sh` exists and is executable.
- AC-T004.2: The script checks exactly the MVP key-doc set from `plan.md`.
- AC-T004.3: The script exits non-zero and names the offending file when a tracked doc is missing valid metadata.
- AC-T004.4: The script exits non-zero and names the offending file when `Last-Verified` is older than 45 days.
- AC-T004.5: The script supports `DOC_FRESHNESS_ROOT` so negative-path verification can run against a temporary copy without modifying the real worktree.
- AC-T004.6: `package.json` includes `doc:freshness` that runs `bash scripts/doc-freshness-check.sh`.
- AC-T004.7: No dependencies or lockfiles are changed.

Verification commands:

```bash
bash scripts/doc-freshness-check.sh
npm run doc:freshness
git diff -- package.json scripts/doc-freshness-check.sh
```

Negative-path verification, missing metadata:

```bash
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/.codex/references" "$tmpdir/docs/superpowers" "$tmpdir/docs" "$tmpdir/scripts"
cp AGENTS.md "$tmpdir/AGENTS.md"
cp docs/superpowers/workflow.md "$tmpdir/docs/superpowers/workflow.md"
cp .codex/references/quality-gates.md "$tmpdir/.codex/references/quality-gates.md"
cp .codex/references/testing-handbook.md "$tmpdir/.codex/references/testing-handbook.md"
cp .codex/references/review-standards.md "$tmpdir/.codex/references/review-standards.md"
cp docs/QUALITY_SCORE.md "$tmpdir/docs/QUALITY_SCORE.md"
sed -i.bak '/^> Last-Verified:/d' "$tmpdir/AGENTS.md"
output="$(DOC_FRESHNESS_ROOT="$tmpdir" bash scripts/doc-freshness-check.sh 2>&1)"
status=$?
printf '%s\n' "$output"
rm -rf "$tmpdir"
test "$status" -ne 0
printf '%s\n' "$output" | rg "AGENTS.md"
printf '%s\n' "$output" | rg "Last-Verified|missing"
git diff --quiet -- AGENTS.md docs/superpowers/workflow.md .codex/references/quality-gates.md .codex/references/testing-handbook.md .codex/references/review-standards.md docs/QUALITY_SCORE.md
```

Expected signal: the checker exits non-zero, `printf '%s\n' "$output" | rg "AGENTS.md"` exits 0, `printf '%s\n' "$output" | rg "Last-Verified|missing"` exits 0, `test "$status" -ne 0` exits 0, and `git diff --quiet -- ...` exits 0.

Negative-path verification, stale metadata:

```bash
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/.codex/references" "$tmpdir/docs/superpowers" "$tmpdir/docs" "$tmpdir/scripts"
cp AGENTS.md "$tmpdir/AGENTS.md"
cp docs/superpowers/workflow.md "$tmpdir/docs/superpowers/workflow.md"
cp .codex/references/quality-gates.md "$tmpdir/.codex/references/quality-gates.md"
cp .codex/references/testing-handbook.md "$tmpdir/.codex/references/testing-handbook.md"
cp .codex/references/review-standards.md "$tmpdir/.codex/references/review-standards.md"
cp docs/QUALITY_SCORE.md "$tmpdir/docs/QUALITY_SCORE.md"
stale_date="$(node -e "const d = new Date(Date.now() - 46 * 24 * 60 * 60 * 1000); console.log(d.toISOString().slice(0, 10));")"
sed -i.bak -E "s/^> Last-Verified: [0-9]{4}-[0-9]{2}-[0-9]{2}$/> Last-Verified: ${stale_date}/" "$tmpdir/AGENTS.md"
output="$(DOC_FRESHNESS_ROOT="$tmpdir" bash scripts/doc-freshness-check.sh 2>&1)"
status=$?
printf '%s\n' "$output"
rm -rf "$tmpdir"
test "$status" -ne 0
printf '%s\n' "$output" | rg "AGENTS.md"
printf '%s\n' "$output" | rg "stale|45"
git diff --quiet -- AGENTS.md docs/superpowers/workflow.md .codex/references/quality-gates.md .codex/references/testing-handbook.md .codex/references/review-standards.md docs/QUALITY_SCORE.md
```

Expected signal: the checker exits non-zero, `printf '%s\n' "$output" | rg "AGENTS.md"` exits 0, `printf '%s\n' "$output" | rg "stale|45"` exits 0, `test "$status" -ne 0` exits 0, and `git diff --quiet -- ...` exits 0.

Engineer evidence:

- Pending: record files changed, commands run, exit codes, and risks.

Reviewer evidence:

- PASS: Reviewer confirmed `scripts/doc-freshness-check.sh` exists, is executable, checks the six MVP docs, supports `DOC_FRESHNESS_ROOT`, and enforces missing, malformed, and stale metadata failures.
- Commands: `bash scripts/doc-freshness-check.sh` exit 0; `npm run doc:freshness` exit 0; missing metadata temp-copy path exit 1 with `AGENTS.md` and `missing Last-Verified`; stale temp-copy path exit 1 with `AGENTS.md` and `stale` / `45`; malformed date temp-copy path exit 1 with `AGENTS.md` and `malformed Last-Verified date`; `git diff --quiet -- package-lock.json` exit 0.
- Scope check: `package.json` adds only `doc:freshness`; `package-lock.json` is unchanged. The documented `git diff --quiet -- ...six docs...` caveat is pre-existing T003 metadata diff, not temp-copy pollution.

### T005 — CI Integration Plus Local Verification

- **Status**: `[x]`
- **Scope**: Add the doc freshness gate to CI and prove the local gate still passes.
- **Owned files**:
  - `.github/workflows/ci.yml`
- **Dependencies**: T004 Reviewer PASS
- **Engineer**: Engineer worker
- **Reviewer**: Reviewer worker
- **Commit checkpoint**: `ci: run doc freshness check`

Acceptance criteria:

- AC-T005.1: CI job `ci` runs `npm run doc:freshness`.
- AC-T005.2: The CI step runs after dependencies are installed and before heavier verification steps.
- AC-T005.3: Existing CI jobs, env vars, and commands are preserved.
- AC-T005.4: Local verification includes `npm run doc:freshness` and at least one syntax check of the workflow file by diff review.

Verification commands:

```bash
npm run doc:freshness
rg -n "doc:freshness|Doc freshness" .github/workflows/ci.yml
git diff -- .github/workflows/ci.yml
```

Engineer evidence:

- Pending: record files changed, commands run, exit codes, and risks.

Reviewer evidence:

- PASS: Reviewer confirmed `.github/workflows/ci.yml` adds `Doc freshness` in the `ci` job after dependency install and before heavier verification gates.
- Commands: `npm run doc:freshness` exit 0 with `Doc freshness check passed for 6 files.`; `rg -n "doc:freshness|Doc freshness" .github/workflows/ci.yml` found lines 45-46; `git diff --check -- .github/workflows/ci.yml` exit 0.
- Scope check: Diff only adds the CI step; existing workflow env, existing commands, and the `e2e` job are unchanged.

### T006 — Final Docs Update And Handoff

- **Status**: `[x]`
- **Scope**: Update workflow state after implementation and record final verification evidence.
- **Owned files**:
  - `specs/036-gap-c-doc-gardening/tasks.md`
  - `specs/036-gap-c-doc-gardening/handoff.md`
  - `specs/036-gap-c-doc-gardening/status.json`
- **Dependencies**: T005 Reviewer PASS
- **Engineer**: Coordinator or Engineer worker
- **Reviewer**: Reviewer worker
- **Commit checkpoint**: `docs: update gap c handoff`

Acceptance criteria:

- AC-T006.1: Completed tasks have Reviewer PASS evidence.
- AC-T006.2: `handoff.md` lists latest verification commands, exit codes, blockers, and residual risks.
- AC-T006.3: `status.json` reflects final phase, completed tasks, blocked state, last verification, and updated timestamp.
- AC-T006.4: No checkbox-only commit is created after CI if it would invalidate a previously green CI head.

Verification commands:

```bash
node -e "JSON.parse(require('fs').readFileSync('specs/036-gap-c-doc-gardening/status.json', 'utf8')); console.log('status ok')"
git diff -- specs/036-gap-c-doc-gardening/tasks.md specs/036-gap-c-doc-gardening/handoff.md specs/036-gap-c-doc-gardening/status.json
```

Engineer evidence:

- Files changed: updated this task board, `handoff.md`, and `status.json` with task completion and final local verification evidence.
- Commands: `npm run doc:freshness` exit 0; `bash -n scripts/doc-freshness-check.sh` exit 0; `test -x scripts/doc-freshness-check.sh` exit 0; `git diff --check` exit 0; status JSON parse exit 0; `git diff --quiet -- package-lock.json` exit 0.
- Risks: Full pre-commit and GitHub CI still need to run before merge.

Reviewer evidence:

- PASS: Coordinator verified the final workflow artifacts are machine-readable, local doc freshness gate passes, and no package-lock churn remains before commit.
