# Gap G Specs Index Spec

## Purpose

Create a minimal specs index so future agents can locate feature specs, understand their current status, and find related decisions without scanning every `specs/` directory.

## Why

Gap G identified that `specs/INDEX.md` did not exist, while the number of spec directories had grown enough that directory names alone are no longer a reliable navigation surface. The fix is intentionally small: add the index and the 039 workflow handoff artifacts only.

## Requirements

- Create `specs/INDEX.md`.
- Include all current specs listed for Gap G, including numbered specs, `fix/post-detail-deleted-guard`, `gap-b-tech-debt-tracker`, and `039-gap-g-specs-index`.
- Use conservative status labels from the requested legend only.
- Include minimal navigation fields: spec name, domain, status, summary, key files, and related specs or domains.
- Keep this docs-only. Do not modify production code, executable tests, scripts, package files, CI, hooks, or generated outputs.
- Do not update `AGENTS.md` or `docs/superpowers/workflow.md`.
- Do not add automation, generators, lint rules, dependency-cruiser rules, or gates.
- Future specs should add one row to `specs/INDEX.md` when the spec is created.

## Non-Goals

- No onboarding read-order change.
- No status audit beyond the provided inventory.
- No migration of historical spec artifacts.
- No PR, commit, or merge work in this task.

## Acceptance Criteria

- `specs/INDEX.md` exists with title `# Specs Index`.
- The index has the exact table columns `Spec | Domain | Status | Summary | Key files | Related`.
- The status legend includes `Active`, `Completed`, `Verified`, `Ready to merge`, `Task-complete`, `Needs fixes`, `Needs test fix`, `Incomplete`, and `Completed?`.
- `Completed?` is documented as intentionally conservative when old artifacts have completion clues but evidence is inconsistent or incomplete.
- 039 handoff artifacts exist under `specs/039-gap-g-specs-index/`.
- Verification uses markdown/json/diff checks only.
