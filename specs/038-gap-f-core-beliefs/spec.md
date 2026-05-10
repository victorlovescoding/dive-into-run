# Gap F Core Beliefs Spec

## Summary

建立 Codex-native 的 core beliefs 文件，補上 Gap F 缺少的 agent decision framework。

這份文件要回答 agent 在灰色地帶如何取捨，不重複 coding rules、quality gates、workflow steps，也不把過時或不可見的 project-health 報告當成長期入口。

## User Scenarios

- 作為新 session 的 Codex agent，我能從 `AGENTS.md` 找到核心操作哲學，知道遇到 trade-off 時該如何判斷。
- 作為 task dispatcher，我能區分哪些原則只是哲學、哪些應該升級成 lint、test、script、CI gate 或 `docs/TECH_DEBT.md` item。
- 作為 reviewer，我能用同一套 beliefs 檢查 agent 是否把「快速修正」誤用成繞過 Reviewer PASS、fresh verification 或 protected branch 的理由。
- 作為 repo owner，我能保留 Claude legacy provenance，但讓 Codex canonical source of truth 維持單一入口。

## Requirements

- R1: 建立 `.codex/references/core-beliefs.md` 作為 Codex canonical core-beliefs 文件。
- R2: `AGENTS.md` 的 Reference Docs 表必須加入 `.codex/references/core-beliefs.md`，但不能內嵌全文。
- R3: Core beliefs 必須是 HOW / decision framework，不是第二份 coding standards 或 quality-gates checklist。
- R4: 文件必須明確指向 `.codex/rules/*`、`.codex/references/quality-gates.md`、`docs/superpowers/workflow.md`、`docs/TECH_DEBT.md` 等既有來源，避免重複。
- R5: 文件必須包含 7 到 10 條可操作 beliefs，並覆蓋 repo-visible truth、spec-first、subagent/reviewer pairing、evidence、mechanical enforcement、layer boundaries、context scarcity、boring inspectable tech、findings-to-code-or-debt。
- R6: 文件必須防止把 OpenAI 的 short-feedback-loop 思維誤讀成可以跳過 Reviewer PASS、fresh verification、pre-commit、CI 或 PR workflow。
- R7: 不建立 `docs/...` 第三份 canonical source；不預設建立 `.claude/references/core-beliefs.md`。
- R8: 本工作不得修改 production code、executable tests、CI、hooks、dependencies 或 lockfiles。
- R9: Superpowers workflow artifacts 必須存在於 `specs/038-gap-f-core-beliefs/`，讓後續 session 可恢復。

## Success Criteria

- SC1: `.codex/references/core-beliefs.md` 存在，內容短、可掃讀，且清楚界定它不是 coding rules。
- SC2: `AGENTS.md` Reference Docs 表含 `.codex/references/core-beliefs.md` 一列。
- SC3: `spec.md`、`plan.md`、`tasks.md`、`handoff.md`、`status.json` 存在且互相一致。
- SC4: `status.json` 是有效 JSON。
- SC5: `git diff --check` 對本次 docs 變更通過。
- SC6: `rg -n "[R]EPLACE_ME|[F]ILL_ME|[P]LACEHOLDER_VALUE"` 在新增 artifact 範圍沒有未填內容。

## Out Of Scope

- Production code changes.
- Unit、integration、server、E2E test changes.
- 新增或修改 lint rule、script、CI job、hook、dependency。
- 建立 `.claude/references/core-beliefs.md` mirror。
- 建立 `docs/design-docs/`、ADR index、doc-gardening automation 或 specs index。
- 修復 Gap B/C/D/E/G 的其他項目。

## User Authorization

- Spec approved by user on 2026-05-10.
- One-time automated execution authorization: yes on 2026-05-10.
