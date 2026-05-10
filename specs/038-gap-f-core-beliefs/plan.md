# Gap F Core Beliefs Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Codex-native core-beliefs decision framework and wire it into the repo entry map.

**Architecture:** `.codex/references/core-beliefs.md` is the canonical long-term document. `AGENTS.md` stays a compact map and links to the new reference. `specs/038-gap-f-core-beliefs/` stores execution state only.

**Tech Stack:** Markdown docs, repo Superpowers workflow artifacts, shell-based docs verification.

---

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `.codex/references/core-beliefs.md` | Create | Canonical Codex decision framework for agent trade-offs. |
| `AGENTS.md` | Modify | Add a Reference Docs row that points to core beliefs without expanding the content inline. |
| `specs/038-gap-f-core-beliefs/spec.md` | Create | Product intent, requirements, success criteria, and explicit non-goals. |
| `specs/038-gap-f-core-beliefs/plan.md` | Create | Technical plan, task split, verification commands, and stop conditions. |
| `specs/038-gap-f-core-beliefs/tasks.md` | Create | Engineer/reviewer task board and evidence slots. |
| `specs/038-gap-f-core-beliefs/handoff.md` | Create | Resume brief, current state, read order, and latest evidence. |
| `specs/038-gap-f-core-beliefs/status.json` | Create | Machine-readable dispatcher state. |

Read-only source files:

| Path | Use |
| ---- | --- |
| `AGENTS.md` | Current Codex entry map and Reference Docs table style. |
| `docs/superpowers/workflow.md` | Required workflow artifact structure and subagent/reviewer rules. |
| `/Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md` | Gap F source analysis; ignored in this worktree, so read from main checkout if needed. |
| `.codex/references/harness-articles/openai-codex.md` | Harness article summary and source concepts. |
| `.codex/references/harness-articles/cross-synthesis.md` | Cross-article patterns to avoid single-article overfitting. |
| `.codex/references/quality-gates.md` | Existing mechanical gate reference; avoid duplicating it. |
| `docs/TECH_DEBT.md` | Destination for durable debt, referenced by the findings-to-code-or-debt belief. |

## Document Shape

`.codex/references/core-beliefs.md` should contain:

- Purpose: decision framework for HOW to choose under ambiguity.
- Non-goals: not coding standards, not a replacement for workflow, not a bypass for gates.
- Nine core beliefs:
  - Repo-Visible Truth
  - Spec First, Then Plan
  - Small Task Slices, Paired Review
  - Evidence Before Claims
  - Mechanical Enforcement Over Documentation
  - Boundaries Are Product Infrastructure
  - Context Is Scarce
  - Prefer Boring, Inspectable Tech
  - Findings Become Code or Debt
- Guardrail on short feedback loops: quick iteration is good; skipping Reviewer PASS, fresh verification, pre-commit, CI, or PR workflow is not.

## Task Slices

### T001: Create workflow artifacts

**Owned files:** `specs/038-gap-f-core-beliefs/spec.md`, `plan.md`, `tasks.md`, `handoff.md`, `status.json`

- [x] Create `spec.md` from the approved Gap F scope.
- [x] Create `plan.md` with file responsibilities and verification strategy.
- [x] Create `tasks.md` with Engineer/Reviewer assignments and evidence slots.
- [x] Create `handoff.md` with resume order and current status.
- [x] Create valid `status.json`.

**Verification:** `node -e "JSON.parse(require('fs').readFileSync('specs/038-gap-f-core-beliefs/status.json','utf8')); console.log('status.json ok')"`

### T002: Implement Codex canonical reference

**Owned files:** `.codex/references/core-beliefs.md`, `AGENTS.md`

- [ ] Create `.codex/references/core-beliefs.md` with the document shape above.
- [ ] Add `.codex/references/core-beliefs.md` to `AGENTS.md` Reference Docs table.
- [ ] Do not add `.claude/references/core-beliefs.md` unless the user explicitly expands scope.
- [ ] Run `git diff --check -- .codex/references/core-beliefs.md AGENTS.md`.

**Engineer:** Worker subagent.
**Reviewer:** Reviewer subagent, then main-agent spot check.

### T003: Verify docs consistency

**Owned files:** all changed docs in this feature.

- [ ] Validate `status.json`.
- [ ] Run `git diff --check -- AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs`.
- [ ] Run `rg -n "[R]EPLACE_ME|[F]ILL_ME|[P]LACEHOLDER_VALUE" AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs` and confirm no unresolved placeholders.
- [ ] Inspect `git diff --stat` and `git diff --check` output.

**Reviewer:** Main agent plus reviewer subagent if T002 created substantive content concerns.

## Risk And Stop Conditions

- Stop if `AGENTS.md`, `docs/superpowers/workflow.md`, or Gap F source disagree on canonical placement.
- Stop if a worker modifies production code, executable tests, CI, hooks, dependency files, `.claude/**`, or unrelated specs.
- Stop if `.codex/references/core-beliefs.md` grows into a rules checklist instead of a decision framework.
- Stop if the doc proposes bypassing Reviewer PASS, fresh verification, pre-commit, CI, PR workflow, or protected branch rules.
- Stop if another worker edits the same owned files concurrently.

## Verification Strategy

Required commands:

```bash
node -e "JSON.parse(require('fs').readFileSync('specs/038-gap-f-core-beliefs/status.json','utf8')); console.log('status.json ok')"
git diff --check -- AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs
rg -n "[R]EPLACE_ME|[F]ILL_ME|[P]LACEHOLDER_VALUE" AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs
```

Optional broader docs sanity:

```bash
npm run spellcheck
```

No production-code or executable-test gate is required because this is a docs-only reference change.
