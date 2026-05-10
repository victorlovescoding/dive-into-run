# Gap E Design Docs ADR Spec

## Summary

建立輕量 `docs/decisions/` ADR 系統，補上 OpenAI harness Gap E 指出的跨功能設計決策入口。
這次只記錄已經成為 repo 現行制度、且容易影響 agent 行為的 4 個核心決策。

## User Scenarios

- 新 session 開始規劃跨 feature 改動時，agent 可以從 `docs/decisions/INDEX.md` 找到已定案的架構與工作流決策，不重新辯論 JSDoc、六層架構、`src/lib` facade、或 Superpowers workflow。
- Engineer subagent 實作時，能從單份 ADR 看到「該遵守什麼、為什麼、證據在哪裡」，避免只靠 `AGENTS.md` 的短條列。
- Reviewer subagent 檢查計畫或 diff 時，能用 ADR 的 Verification 區塊確認決策不是未驗證口號。

## Requirements

- 建立 `docs/decisions/INDEX.md`，列出 ADR 清單、status、verification status、何時新增或更新 ADR。
- 建立 `docs/decisions/ADR-TEMPLATE.md`，欄位必須包含 `Status`、`Date`、`Owner`、`Verification Status`、`Verification Source`、`Related`、`Context`、`Decision`、`Consequences`、`Agent Guidance`、`Verification`。
- Seed 4 份 Accepted retrospective ADR：
  - `ADR-001-six-layer-forward-only-architecture.md`
  - `ADR-002-lib-compatibility-facade.md`
  - `ADR-003-jsdoc-check-js-over-typescript.md`
  - `ADR-004-superpowers-first-agent-workflow.md`
- `AGENTS.md` 的 Reference Docs 表格必須加入 `docs/decisions/INDEX.md`。
- `docs/superpowers/workflow.md` 的 planning 階段必須提醒：跨 feature 架構或流程決策先查 ADR；引入新長期決策時新增或更新 ADR。
- ADR 不得假裝有不可驗證的原始歷史；若是 retrospective，必須明寫證據來自目前 repo 狀態、規範與機械 gate。

## Success Criteria

- `docs/decisions/` 存在，並至少包含 index、template、4 份 ADR。
- 每份 ADR 都有 Agent Guidance 與 Verification 區塊。
- `AGENTS.md` 與 `docs/superpowers/workflow.md` 能把後續 agent 導向 ADR index。
- `docs/TECH_DEBT.md` 沒有被修改。
- `git diff --check` 與 `npm run spellcheck` 通過，或若失敗則回報明確原因。

## Out Of Scope

- 不建立 `docs/TECH_DEBT.md` 連結或更新規則；使用者已明確要求「設計決策不放 tech debt」先不動。
- 不 seed CSS Modules + Tailwind ADR；此決策先延後，避免首輪 scope 膨脹。
- 不補 `.codex/references/review-standards.md`；那是另一個缺口，不綁進 Gap E。
- 不修改 production code、executable tests、CI、ESLint、dependency-cruiser、package files。
- 不把 ignored `project-health/` 文件搬進 branch；它只能當本機研究 evidence。

## User Authorization

- Spec approved by: user / 2026-05-10
- One-time automated execution authorization: no; this session currently authorized planning artifacts only
