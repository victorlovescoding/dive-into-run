# Gap E Design Docs ADR Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/037-gap-e-design-docs-adr/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Main agent is coordinator only for implementation tasks. File creation and edits belong to Engineer subagents; Reviewer subagents must independently verify before completion.
- A task can be checked only after Reviewer PASS.
- `docs/TECH_DEBT.md` is explicitly out of scope and must not be modified.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Parallel execution is allowed for T002 and T003 only if their owned ADR files remain disjoint and no shared index/workflow files are edited concurrently.
- Recommended maximum: 2 live Engineer subagents, followed by paired Reviewers.

## Tasks

### T001 — Create ADR Index And Template

- **Status**: `[x]` reviewer-pass
- **Scope**: Create the ADR directory entrypoint and reusable template.
- **Owned files**:
  - `docs/decisions/INDEX.md`
  - `docs/decisions/ADR-TEMPLATE.md`
- **Dependencies**: none
- **Engineer**: Documentation Engineer subagent
- **Reviewer**: Documentation Reviewer subagent
- **Commit checkpoint**: phase commit after T001-T004 pass review

Acceptance criteria:

- AC-T001.1: `docs/decisions/INDEX.md` lists all 4 planned ADR files with status and verification status.
- AC-T001.2: `ADR-TEMPLATE.md` includes `Agent Guidance` and `Verification` sections.
- AC-T001.3: Index explains when to create or update an ADR and warns against using ADRs for session state or tech debt tracking.

Verification commands:

```bash
test -f docs/decisions/INDEX.md
test -f docs/decisions/ADR-TEMPLATE.md
rg -n "ADR-001|ADR-002|ADR-003|ADR-004|Agent Guidance|Verification" docs/decisions
git diff -- docs/decisions/INDEX.md docs/decisions/ADR-TEMPLATE.md
```

Engineer evidence:

- DONE — T001 Documentation Engineer / 2026-05-10. Created `docs/decisions/INDEX.md` and `docs/decisions/ADR-TEMPLATE.md`. Ran `test -f` for both files, required `rg`, and `git diff -- docs/decisions/INDEX.md docs/decisions/ADR-TEMPLATE.md`; all exit 0. Noted that `git diff` does not show untracked file contents.

Reviewer evidence:

- PASS — T001 Documentation Reviewer / 2026-05-10. Verified AC-T001.1 through AC-T001.3: index lists ADR-001 through ADR-004 with Status and Verification Status; template includes required metadata, Agent Guidance, and Verification; index warns against ADRs for session state or tech debt tracking. `git status --short docs/TECH_DEBT.md docs/decisions` showed only `?? docs/decisions/`.

### T002 — Seed Architecture ADRs

- **Status**: `[x]` reviewer-pass
- **Scope**: Write the two ADRs that protect canonical architecture boundaries.
- **Owned files**:
  - `docs/decisions/ADR-001-six-layer-forward-only-architecture.md`
  - `docs/decisions/ADR-002-lib-compatibility-facade.md`
- **Dependencies**: T001
- **Engineer**: Architecture Documentation Engineer subagent
- **Reviewer**: Architecture Reviewer subagent
- **Commit checkpoint**: phase commit after T001-T004 pass review

Acceptance criteria:

- AC-T002.1: ADR-001 states the layer order `Types -> Config -> Repo -> Service -> Runtime -> UI` and cites `AGENTS.md`, `.dependency-cruiser.mjs`, and `docs/QUALITY_SCORE.md`.
- AC-T002.2: ADR-001 explains that dependency-cruiser is the mechanical verification path and that future domain-first restructuring requires a new ADR.
- AC-T002.3: ADR-002 states that `src/lib` is a compatibility facade / limited utility surface, not the canonical home for new implementation.
- AC-T002.4: ADR-002 states canonical layers must not runtime-import `src/lib/**` and cites the `canonical-no-import-lib` dependency-cruiser rule.
- AC-T002.5: Neither ADR invents unverified historical meeting context.

Verification commands:

```bash
test -f docs/decisions/ADR-001-six-layer-forward-only-architecture.md
test -f docs/decisions/ADR-002-lib-compatibility-facade.md
rg -n "Types -> Config -> Repo -> Service -> Runtime -> UI|canonical-no-import-lib|dependency-cruiser|src/lib" docs/decisions/ADR-001-six-layer-forward-only-architecture.md docs/decisions/ADR-002-lib-compatibility-facade.md
git diff -- docs/decisions/ADR-001-six-layer-forward-only-architecture.md docs/decisions/ADR-002-lib-compatibility-facade.md
```

Engineer evidence:

- DONE — T002 Architecture Documentation Engineer / 2026-05-10. Created `docs/decisions/ADR-001-six-layer-forward-only-architecture.md` and `docs/decisions/ADR-002-lib-compatibility-facade.md`. Ran both `test -f` checks, required `rg`, and `git status --short docs/decisions`; all exit 0.

Reviewer evidence:

- PASS — T002 Architecture Reviewer / 2026-05-10. Verified AC-T002.1 through AC-T002.5: ADR-001 states layer order and cites `AGENTS.md`, `.dependency-cruiser.mjs`, `docs/QUALITY_SCORE.md`; ADR-001 identifies dependency-cruiser as the mechanical gate and requires a new ADR for domain-first restructuring; ADR-002 defines `src/lib` as compatibility facade / limited utility surface and cites `canonical-no-import-lib`; neither ADR invents unverifiable historical context. `docs/TECH_DEBT.md` untouched.

### T003 — Seed Type Strategy And Workflow ADRs

- **Status**: `[x]` reviewer-pass
- **Scope**: Write the two ADRs that protect type-checking and agent workflow decisions.
- **Owned files**:
  - `docs/decisions/ADR-003-jsdoc-check-js-over-typescript.md`
  - `docs/decisions/ADR-004-superpowers-first-agent-workflow.md`
- **Dependencies**: T001
- **Engineer**: Workflow Documentation Engineer subagent
- **Reviewer**: Workflow Reviewer subagent
- **Commit checkpoint**: phase commit after T001-T004 pass review

Acceptance criteria:

- AC-T003.1: ADR-003 states the repo uses JavaScript + JSDoc + `checkJs: true` + `tsc --noEmit`, not application TypeScript.
- AC-T003.2: ADR-003 cites `AGENTS.md`, `tsconfig.json`, `.codex/rules/code-style.md`, and `.codex/rules/coding-rules.md`.
- AC-T003.3: ADR-004 states Superpowers-first workflow supersedes legacy `speckit.*` by default.
- AC-T003.4: ADR-004 states `specs/<feature>/spec.md`, `plan.md`, `tasks.md`, `handoff.md`, and `status.json` are the intended durable state set, while acknowledging `status.json` adoption is still a known workflow gap.
- AC-T003.5: Neither ADR claims every historical spec already complies with the current workflow.

Verification commands:

```bash
test -f docs/decisions/ADR-003-jsdoc-check-js-over-typescript.md
test -f docs/decisions/ADR-004-superpowers-first-agent-workflow.md
rg -n "checkJs|tsc --noEmit|Superpowers-first|speckit|status.json" docs/decisions/ADR-003-jsdoc-check-js-over-typescript.md docs/decisions/ADR-004-superpowers-first-agent-workflow.md
git diff -- docs/decisions/ADR-003-jsdoc-check-js-over-typescript.md docs/decisions/ADR-004-superpowers-first-agent-workflow.md
```

Engineer evidence:

- DONE — T003 Workflow/Type Strategy Documentation Engineer / 2026-05-10. Created `docs/decisions/ADR-003-jsdoc-check-js-over-typescript.md` and `docs/decisions/ADR-004-superpowers-first-agent-workflow.md`. Ran both `test -f` checks, required `rg`, and `git status --short docs/decisions docs/TECH_DEBT.md`; all exit 0.

Reviewer evidence:

- PASS — T003 Workflow/Type Strategy Reviewer / 2026-05-10. Verified AC-T003.1 through AC-T003.5: ADR-003 records JavaScript + JSDoc + `checkJs: true` + `tsc --noEmit`; ADR-003 cites required docs; ADR-004 records Superpowers-first over legacy `speckit.*`, intended five-file durable state set, and the `status.json` adoption caveat; it does not claim every historical spec complies. `docs/TECH_DEBT.md` untouched.

### T004 — Wire ADR Index And Sync Status

- **Status**: `[x]` reviewer-pass
- **Scope**: Add minimal references from repo onboarding and planning workflow to the ADR index, and sync index status after seed ADR creation.
- **Owned files**:
  - `docs/decisions/INDEX.md`
  - `AGENTS.md`
  - `docs/superpowers/workflow.md`
- **Dependencies**: T001
- **Engineer**: Workflow Documentation Engineer subagent
- **Reviewer**: Workflow Reviewer subagent
- **Commit checkpoint**: phase commit after T001-T004 pass review

Acceptance criteria:

- AC-T004.1: `AGENTS.md` Reference Docs table includes `docs/decisions/INDEX.md`.
- AC-T004.2: `docs/superpowers/workflow.md` planning guidance says cross-feature architecture/workflow decisions must check ADRs first.
- AC-T004.3: Workflow guidance says new long-term cross-feature decisions should create or update an ADR.
- AC-T004.4: `docs/decisions/INDEX.md` marks ADR-001 through ADR-004 as Accepted with the same verification status as the ADR files.
- AC-T004.5: `docs/TECH_DEBT.md` remains untouched.

Verification commands:

```bash
rg -n "docs/decisions/INDEX.md|ADR" AGENTS.md docs/superpowers/workflow.md
rg -n "Accepted|Verified|Partially Verified" docs/decisions/INDEX.md
git diff -- AGENTS.md docs/superpowers/workflow.md docs/decisions/INDEX.md
git status --short docs/TECH_DEBT.md
```

Engineer evidence:

- DONE — T004 Workflow Documentation Engineer / 2026-05-10. Updated `AGENTS.md`, `docs/superpowers/workflow.md`, and `docs/decisions/INDEX.md`. Ran required `rg` checks, `git diff -- AGENTS.md docs/superpowers/workflow.md docs/decisions/INDEX.md`, and `git status --short docs/TECH_DEBT.md`; all exit 0.

Reviewer evidence:

- PASS — T004 Workflow Documentation Reviewer / 2026-05-10. Verified AC-T004.1 through AC-T004.5: `AGENTS.md` links `docs/decisions/INDEX.md`; workflow planning guidance checks ADRs first and creates/updates ADRs for new long-term cross-feature decisions; index status matches all four ADR files; `docs/TECH_DEBT.md` untouched.

### T005 — Final Review, Verification, And Handoff

- **Status**: `[x]` reviewer-pass
- **Scope**: Confirm all docs are coherent, run final verification, and update workflow state artifacts.
- **Owned files**:
  - `specs/037-gap-e-design-docs-adr/tasks.md`
  - `specs/037-gap-e-design-docs-adr/handoff.md`
  - `specs/037-gap-e-design-docs-adr/status.json`
- **Dependencies**: T001, T002, T003, T004 all Reviewer PASS
- **Engineer**: Coordinator
- **Reviewer**: Final Reviewer subagent
- **Commit checkpoint**: final docs evidence commit only if state artifacts intentionally changed

Acceptance criteria:

- AC-T005.1: T001-T004 have Reviewer PASS evidence.
- AC-T005.2: `git diff --check` passes.
- AC-T005.3: `npm run spellcheck` passes, or failures are documented with exact words/files and no completion claim is made.
- AC-T005.4: `git status --short` contains only expected files.
- AC-T005.5: `handoff.md` and `status.json` record latest verified state.

Verification commands:

```bash
git diff --check
npm run spellcheck
git status --short --branch
```

Engineer evidence:

- DONE — Coordinator / 2026-05-11. Verified T001 through T004 all have Reviewer PASS evidence. Ran `git diff --check` (exit 0), `/Users/chentzuyu/.nvm/versions/node/v22.22.0/bin/npm run spellcheck` (exit 0, 427 files checked, 0 issues), `/Users/chentzuyu/.nvm/versions/node/v22.22.0/bin/npm run lint:changed` (exit 0, no changed JS files), and `git status --short --branch` (exit 0, only expected ADR/planning/onboarding/workflow files changed). Confirmed `/Users/chentzuyu/.nvm/versions/node/v22.22.0/bin/node --version` is `v22.22.0` and npm is `10.9.4`.

Reviewer evidence:

- PASS — T005 Final Reviewer / 2026-05-11. Reviewed the full diff and found no required fixes. Verified ADR index/template, ADR-001 through ADR-004, `AGENTS.md`, `docs/superpowers/workflow.md`, and T005 evidence against T001-T005 acceptance criteria. Confirmed `docs/TECH_DEBT.md`, `package.json`, and `package-lock.json` have no diff. Non-blocking note: branch was behind `origin/main` by 3 before closeout rebase.
