# Sensors（反饋控制 — 行動後自我修正）

## 開發迭代品質確認（快速計算型 Sensors）

開發過程中用以下指令快速確認改動品質：

- `npm run type-check:changed` / `type-check:branch` — 快速確認 JSDoc 型別
- `npm run lint:changed` / `lint:branch` — 快速確認 ESLint
- `npm run test:browser -- --run` — 只跑 browser/jsdom Vitest unit + integration 測試
- `bash scripts/audit-mock-boundary.sh` — 快速確認 tests 內沒有違規 mock 內部 layer
- `bash scripts/audit-flaky-patterns.sh` — 快速確認 `tests/` 內沒有 call-count 或 fixed-sleep flaky pattern
- `npm run audit:use-effect-data-fetching` — 快速確認 UI/components 沒有 effect data fetch，runtime hooks 沒有 suppress exhaustive-deps
- `npm run audit:playwright-official-only` — 快速確認 E2E 沒有 `.only`、fixed sleep、非官方 Playwright imports
- `npm run workflow:validate` — 快速確認 `specs/*/status.json` workflow state；`lastVerification[].command` 必須一筆一 command，不能用 `&&` 或 `;` 串接
- `npm run test:branch` — 只跑當前 branch 的 Vitest unit + integration 測試
- `npm run test:e2e:branch` — 只跑當前 branch 的 Playwright E2E 測試（無 E2E 目錄時自動跳過）
- **commit 前不需額外跑檢查** — Husky pre-commit 會自動執行全專案 lint + type-check + depcruise + spellcheck + browser Vitest + mock-boundary audit + flaky-pattern audit + useEffect data-fetch audit + Playwright official audit

## Changed Surface → Required Verification Matrix

Use the smallest row set that covers the changed files. These commands are in
addition to focused reproduction or task-specific tests from the task contract.

| Changed surface | Required local verification |
| --------------- | --------------------------- |
| Workflow docs: `AGENTS.md`, `docs/superpowers/**`, `.codex/rules/**`, `.codex/references/**`, `.agents/skills/**` | `npm run workflow:validate`, `npm run workflow:check`, `npm run workflow:links`, `git diff --check` |
| Workflow scripts: `scripts/check-*.js`, `scripts/validate-workflow-state.js`, workflow npm scripts | The changed script command, `node scripts/check-superpowers-state.js --owned-files <owned paths...>` for explicit P1/P2 write sets, `npm run lint:changed`, `npm run type-check:changed`, `git diff --check` |
| General scripts: `scripts/**` | The changed script command or focused smoke test, `npm run lint:changed`, `npm run type-check:changed`, `git diff --check` |
| `src/service/**` | Focused unit test or `npm run test:branch`, `npm run lint:changed`, `npm run type-check:changed` |
| `src/runtime/**` | Focused hook/runtime test or `npm run test:branch`, `npm run audit:use-effect-data-fetching`, `npm run lint:changed`, `npm run type-check:changed` |
| `src/ui/**`, `src/components/**`, CSS modules, Tailwind-facing UI | Focused integration/browser test when available, `npm run lint:changed`, `npm run type-check:changed`, browser evidence sensor for meaningful UI changes |
| `src/app/**` pages/layouts/routes | Focused integration/server/API test as applicable, `npm run lint:changed`, `npm run type-check:changed`; UI routes also require browser evidence sensor; route/server changes also run server row |
| Server-only code: API routes, Firebase Admin, server adapters, rules helpers | Focused server test or `npm run test:server`, `npm run lint:changed`, `npm run type-check:changed` |
| E2E specs/helpers/config | Focused `npx playwright test ...` or `npm run test:e2e:branch`, `npm run audit:playwright-official-only`, `git diff --check` |
| Test-only unit/integration/server changes | Focused changed test command, `npm run lint:changed`, `npm run type-check:changed`, relevant mock/flaky audit when touched |
| `package.json` scripts or dependency metadata | Run the changed npm script, `npm run lint:changed`, `npm run type-check:changed`; stop and report if `package-lock.json` changes unexpectedly |
| Config affecting build/lint/type/dependency graph | Run the affected config command plus `npm run lint:changed` and `npm run type-check:changed`; use full gate when scope is shared or uncertain |

## Browser Evidence Sensor

UI task slices must include browser evidence. Prefer Chrome DevTools MCP when
callable. If it is not callable, use the Codex Chrome plugin or available
Browser surface and record the tool used.

Evidence must record:

- Target URL.
- Route or journey.
- Viewport or emulation.
- Console cleared before interaction.
- Snapshot before and after.
- Actions performed.
- Console errors and warnings.
- Failed network requests.
- Screenshot artifact.
- Expected vs actual UI signal.
- Trace, Lighthouse, or memory evidence only when the task explicitly asks for
  it or high-risk debugging needs it.
- Residual risk.

If no browser evidence surface is callable, UI conformance is blocked. Do not
fake verification. Browser evidence does not replace Playwright, Vitest, CI, or
Reviewer checks, and the main agent cannot use it for self-review.

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

Husky pre-commit 會自動執行 9 個 sequential checks，全部通過才能 commit：

1. `npm run lint -- --max-warnings 0`
2. `npm run type-check`
3. `npm run depcruise`
4. `npm run spellcheck`（檢查 `src`、`specs`、`tests` 的 JS/JSX）
5. `npx vitest run --project=browser`
6. `bash scripts/audit-mock-boundary.sh`
7. `npm run audit:flaky-patterns`（底層為 `scripts/audit-flaky-patterns.sh`）
8. `npm run audit:use-effect-data-fetching`
9. `npm run audit:playwright-official-only`

改測試 mock 時可先跑 `bash scripts/audit-mock-boundary.sh`；改 async assertion、wait 或 Playwright 等待策略時可先跑 `bash scripts/audit-flaky-patterns.sh`。改 UI/component/runtime hook effects 時跑 `npm run audit:use-effect-data-fetching`；改 E2E 或 E2E helpers 時跑 `npm run audit:playwright-official-only`。改 Superpowers workflow state 時跑 `npm run workflow:validate`。

## Failure Diagnosis SOP

失敗時先保留可相信的證據，再修：

1. 需要 exit code 決策時，避開裸 pipeline；用暫存輸出、`PIPESTATUS` 或 `set -o pipefail`。
2. 外部工具改檔後，下一次 edit 前先重讀該檔。
3. Pre-commit fail 後若有再改檔，重試 commit 前先 `git add <file>`，再看 `git diff --cached` 或 `git status`。
4. 用 stash 做隔離診斷時，stash 前後都跑 `git stash list`。
5. 大量 `TS2307 Cannot find module '@/...'` 先懷疑 tsconfig 沒載；改用 `npm run type-check` 或 `npx tsc --noEmit --project tsconfig.json`。

細節與例外情境見 `.codex/references/troubleshooting.md`。

## Code Review Gate

> 完整審查標準 → `.codex/references/review-standards.md`

Merge 前需通過 codereview-roasted 取得 🟢 Good taste + ✅ Worth merging。
