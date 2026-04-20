# Sensors（反饋控制 — 行動後自我修正）

## 開發迭代品質確認（快速計算型 Sensors）

開發過程中用以下指令快速確認改動品質：

- `npm run type-check:changed` / `type-check:branch` — 快速確認 JSDoc 型別
- `npm run lint:changed` / `lint:branch` — 快速確認 ESLint
- `npm run test:branch` — 只跑當前 branch 的 Vitest unit + integration 測試
- `npm run test:e2e:branch` — 只跑當前 branch 的 Playwright E2E 測試（無 E2E 目錄時自動跳過）
- **commit 前不需額外跑檢查** — Husky pre-commit 會自動執行全專案 lint + type-check + spellcheck + vitest

## IDE Diagnostics（中速推理型 Sensor）

Before marking a task complete, run `getDiagnostics` (via MCP) and fix items by severity:

| Severity    | 處理方式                              |
| ----------- | ------------------------------------- |
| Error       | 必修                                  |
| Warning     | 必修                                  |
| Hint        | 必修                                  |
| Information | cSpell 專用 — 加詞到 cspell.json 即可 |

## cSpell（計算型 Sensor）

Project-specific words must be added to `cspell.json` at project root. Do not use inline `cspell:disable` comments.

## Pre-commit Gate（自動化閘門）

Husky pre-commit 會自動執行：`lint` → `type-check` → `spellcheck` → `vitest`。全部通過才能 commit。

## Code Review Gate

> 完整審查標準 → `.claude/references/review-standards.md`（待建）

Merge 前需通過 codereview-roasted 取得 🟢 Good taste + ✅ Worth merging。
