# Gap F Core Beliefs Handoff

## Current State

- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-038-gap-f-core-beliefs`
- Branch: `038-gap-f-core-beliefs`
- Base: `main` at `cdb4e921fcd1a484dabfbbe860977d35bb087df7`
- Scope: docs-only Gap F implementation.
- Canonical target: `.codex/references/core-beliefs.md`
- AGENTS entry: add one Reference Docs row.
- Claude mirror: out of scope unless the user explicitly asks.

## Read Order For Resume

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `specs/038-gap-f-core-beliefs/spec.md`
4. `specs/038-gap-f-core-beliefs/plan.md`
5. `specs/038-gap-f-core-beliefs/tasks.md`
6. `specs/038-gap-f-core-beliefs/status.json`
7. `.codex/references/core-beliefs.md` if it exists

## Source Evidence

- Gap F source analysis: `/Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md`, section `Gap F: Core Beliefs / Agent 操作哲學`.
- Codex source of truth: `AGENTS.md`.
- Workflow backend: `docs/superpowers/workflow.md`.
- Harness article reference: `.codex/references/harness-articles/openai-codex.md`.
- Cross-article synthesis: `.codex/references/harness-articles/cross-synthesis.md`.

## Implementation Notes

- This feature should not modify production code, executable tests, CI, hooks, dependencies, lockfiles, or `.claude/**`.
- Do not create a third canonical location under `docs/...`.
- Keep `AGENTS.md` as a compact map. Add only a table row; do not paste beliefs inline.
- Keep core beliefs short and decision-oriented.
- Make the short-feedback-loop belief explicit: fast correction does not bypass gates.

## Latest Verification

- Reviewer re-review PASS on 2026-05-10.
- Final verification passed on 2026-05-10:
  - `node -e "JSON.parse(require('fs').readFileSync('specs/038-gap-f-core-beliefs/status.json','utf8')); console.log('status.json ok')"`
  - `git diff --check -- AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs`
  - `rg -n "[R]EPLACE_ME|[F]ILL_ME|[P]LACEHOLDER_VALUE" AGENTS.md .codex/references/core-beliefs.md specs/038-gap-f-core-beliefs`
  - `rg -n "^## " .codex/references/core-beliefs.md`
  - `git status --short --branch`

## Blockers

- None currently.

## Pitfalls

- `project-health/` is ignored in this worktree and may only exist in the original checkout; use the absolute path above for historical Gap F context.
- Existing `.codex/references/quality-gates.md` already owns mechanical gate details; do not duplicate its checklist.
- `docs/superpowers/workflow.md` already owns implementation lifecycle; core beliefs should explain trade-off thinking, not restate every workflow step.
