# Gap F Core Beliefs Tasks

## Status

- Feature: `038-gap-f-core-beliefs`
- Branch: `038-gap-f-core-beliefs`
- Mode: docs-only, subagent-assisted
- Current phase: complete

## T001: Workflow Artifacts

- Status: Completed
- Engineer: Main agent
- Reviewer: Main agent self-check, final reviewer subagent
- Owned files:
  - `specs/038-gap-f-core-beliefs/spec.md`
  - `specs/038-gap-f-core-beliefs/plan.md`
  - `specs/038-gap-f-core-beliefs/tasks.md`
  - `specs/038-gap-f-core-beliefs/handoff.md`
  - `specs/038-gap-f-core-beliefs/status.json`
- Dependencies: User approval for Codex canonical scope.
- Acceptance criteria:
  - The five Superpowers workflow artifacts exist.
  - `status.json` parses as JSON.
  - Artifacts agree that this is docs-only and `.codex/references/core-beliefs.md` is canonical.
  - No artifact asks for production code, tests, CI, hooks, dependency, or `.claude/**` edits.
- Verification commands:
  - `node -e "JSON.parse(require('fs').readFileSync('specs/038-gap-f-core-beliefs/status.json','utf8')); console.log('status.json ok')"`
  - `git diff --check -- specs/038-gap-f-core-beliefs`
- Commit checkpoint: after T001 and T002 pass review, include with docs batch commit.
- Evidence:
  - `status.json` parsed successfully during initial and final docs verification.
  - `git diff --check -- specs/038-gap-f-core-beliefs` passed during initial artifact check.

## T002: Core Beliefs Reference

- Status: Completed
- Engineer: Worker subagent
- Reviewer: Reviewer subagent plus main-agent spot check
- Owned files:
  - `.codex/references/core-beliefs.md`
  - `AGENTS.md`
- Dependencies: T001 plan scope and read-only research findings.
- Acceptance criteria:
  - `.codex/references/core-beliefs.md` exists and is the canonical Codex reference.
  - `AGENTS.md` Reference Docs table links to `.codex/references/core-beliefs.md`.
  - The reference contains 7 to 10 beliefs and uses them as decision framework, not duplicate coding standards.
  - The reference points readers to existing rules, gates, workflow, and tech-debt docs instead of copying their full content.
  - The reference explicitly says quick iteration does not bypass Reviewer PASS, fresh verification, pre-commit, CI, PR workflow, or protected branch rules.
  - No `.claude/references/core-beliefs.md` or `docs/...` copy is created.
- Verification commands:
  - `git diff --check -- .codex/references/core-beliefs.md AGENTS.md`
  - `rg -n "core-beliefs" AGENTS.md .codex/references/core-beliefs.md`
- Commit checkpoint: after reviewer PASS and T003 docs checks.
- Evidence:
  - Worker subagent created `.codex/references/core-beliefs.md` and updated the `AGENTS.md` Reference Docs table.
  - Reviewer first REJECTED missing workflow/debt references and incomplete guardrail wording.
  - Worker fixed both findings in `.codex/references/core-beliefs.md`.
  - Reviewer re-review PASS confirmed section count, guardrails, canonical placement, and docs-only scope.

## T003: Docs Consistency Verification

- Status: Completed
- Engineer: Main agent
- Reviewer: Main agent plus reviewer subagent if needed
- Owned files:
  - All changed docs in this feature.
- Dependencies: T001 and T002 file changes complete.
- Acceptance criteria:
  - `status.json` is valid JSON.
  - `git diff --check` passes for all changed paths.
  - Placeholder scan returns no unresolved placeholders.
  - `git status --short --branch` shows only intended docs changes.
- Verification commands:
  - `node -e "JSON.parse(require('fs').readFileSync('specs/038-gap-f-core-beliefs/status.json','utf8')); console.log('status.json ok')"`
  - `git diff --check -- AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs`
  - `rg -n "[R]EPLACE_ME|[F]ILL_ME|[P]LACEHOLDER_VALUE" AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs`
  - `git status --short --branch`
- Commit checkpoint: ready for user decision after verification.
- Evidence:
  - Final verification passed on 2026-05-10.
