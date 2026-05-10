# Gap E Design Docs ADR Plan

## Summary

新增 repo-local ADR 系統，讓跨功能設計決策從短條列規範升級成可查、可驗證、可被 agent 引用的文件。
實作以文件為主，不改 production code 或測試。

## Architecture

- `docs/decisions/INDEX.md` 是唯一 ADR 入口；其他文件只連到 index，不直接複製 ADR 清單。
- 每份 ADR 都是 retrospective decision record：描述目前已採用的決策、可驗證證據、trade-off、agent 執行指引。
- `AGENTS.md` 負責 onboarding 導航；`docs/superpowers/workflow.md` 負責在 planning 階段要求查 ADR 與維護 ADR。

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `docs/decisions/INDEX.md` | Create | ADR 目錄、狀態、verification status、何時新增或更新 ADR。 |
| `docs/decisions/ADR-TEMPLATE.md` | Create | 新 ADR 的固定欄位與寫作規則。 |
| `docs/decisions/ADR-001-six-layer-forward-only-architecture.md` | Create | 記錄 Types -> Config -> Repo -> Service -> Runtime -> UI forward-only 決策與 dependency-cruiser gate。 |
| `docs/decisions/ADR-002-lib-compatibility-facade.md` | Create | 記錄 `src/lib` 保留為 compatibility facade，但 canonical layers 不得 runtime-import `src/lib/**`。 |
| `docs/decisions/ADR-003-jsdoc-check-js-over-typescript.md` | Create | 記錄 JavaScript + JSDoc + `checkJs` + `tsc --noEmit` 的型別策略。 |
| `docs/decisions/ADR-004-superpowers-first-agent-workflow.md` | Create | 記錄 Superpowers-first workflow、`specs/<feature>/` durable artifacts、subagent Engineer/Reviewer gate。 |
| `docs/decisions/INDEX.md` | Modify | 實作後同步 4 份 seed ADR 的 status 與 verification status。 |
| `AGENTS.md` | Modify | Reference Docs 表格加入 ADR index。 |
| `docs/superpowers/workflow.md` | Modify | Planning 階段加入 ADR 查閱與維護規則。 |
| `specs/037-gap-e-design-docs-adr/tasks.md` | Modify | 實作期間由主 agent 依 Reviewer PASS 更新狀態。 |
| `specs/037-gap-e-design-docs-adr/handoff.md` | Modify | 實作期間記錄最新 state、verification、pitfalls。 |
| `specs/037-gap-e-design-docs-adr/status.json` | Modify | 實作期間更新 dispatcher 狀態。 |

## Testing Strategy

- Required reference before test work: `.codex/references/testing-handbook.md` is not required because this slice does not create executable tests.
- RED target: not applicable; this is documentation and navigation work.
- GREEN target: file existence, expected references, markdown diff hygiene, spellcheck.
- Regression coverage: `git diff --check` for whitespace / markdown diff hygiene, `npm run spellcheck` for doc spelling, `rg` checks for required paths and forbidden `docs/TECH_DEBT.md` diff.

## Risk And Stop Conditions

- Stop if implementation needs to modify `docs/TECH_DEBT.md`; user explicitly said to leave it untouched.
- Stop if an ADR requires unverifiable historical claims that cannot be backed by current repo files or known local evidence.
- Stop if `project-health/` evidence is needed as tracked source; it is ignored in this repo and should not be silently copied into the branch.
- Stop if the implementation expands into Gap F core beliefs, Gap C doc freshness, or review standards.
- Stop if `AGENTS.md`, `docs/superpowers/workflow.md`, or ADR contents contradict each other.

## Task Slices

- T001: Create ADR directory, index, and template.
- T002: Seed architecture ADRs for six-layer forward-only architecture and `src/lib` compatibility facade.
- T003: Seed workflow/type strategy ADRs for JSDoc/checkJs and Superpowers-first workflow.
- T004: Wire ADR index into onboarding and planning docs, and sync ADR index status.
- T005: Review, verify, and update handoff/status.
