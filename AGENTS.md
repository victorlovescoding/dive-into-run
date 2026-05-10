# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

> Codex source of truth: `AGENTS.md`.
> `CLAUDE.md` may exist for Claude-specific workflows, but Codex must not treat it as authoritative when the two documents diverge.

## Required Context

Before doing substantial work in this repo, load the project memory at:

- `~/.codex/memories/global/AGENTS.md`
- `~/.codex/memories/-Users-chentzuyu-Desktop-dive-into-run/AGENTS.md`
- `~/.codex/memories/-Users-chentzuyu-Desktop-dive-into-run/MEMORY.md`
- the referenced files under `~/.codex/memories/-Users-chentzuyu-Desktop-dive-into-run/entries/`
- the referenced files under `~/.codex/memories/-Users-chentzuyu-Desktop-dive-into-run/references/`

If the Codex project memory is missing or stale, fall back to:

- `~/.codex/memories/global/AGENTS.md`
- `.claude/rules/`
- `.claude/references/`
- `project-health/`

This is a required project onboarding step, not an optional reference.

## Commands

```bash
npm run dev                 # Dev server (Next.js + Turbopack) on localhost:3000
npm run build               # Production build
npm run lint                # ESLint (Airbnb + React Hooks + JSDoc via flat config)
npm run lint:changed        # 只 lint git changed files
npm run type-check          # TypeScript-powered JSDoc type checking (tsc --noEmit)
npm run type-check:changed  # 只顯示 changed files 的 type errors
npm run spellcheck          # cSpell 拼字檢查 (src + specs + tests)
npm run test                # Browser/jsdom Vitest project only (same as test:browser)
npm run test:browser        # Browser/jsdom Vitest only (unit + integration)
npm run test:server         # Server Vitest via Firebase Auth/Firestore emulator
npm run test:coverage       # Coverage via Firebase Auth/Firestore emulator
npx vitest run tests/unit/path/to/file.test.jsx   # 單一 Vitest 檔
npx playwright test tests/e2e/path/to/file.spec.js # 單一 Playwright 檔
```

> E2E 指令參考 → `.codex/rules/e2e-commands.md`（參考文件，不是 Codex native Rules auto-load）
> Repo-wide lint audit 可用 `npm run lint`（目前等於 `eslint src specs tests`）。需要避開 npm wrapper 或臨時加 CLI flags 時，才直接用等價的 `npx eslint src specs tests ...`。

## Architecture

- **Next.js 15 / React 19** with App Router — pure JavaScript (no TypeScript), type safety via JSDoc + `checkJs: true`
- **Path alias**: `@/` → `./src/`
- **Firebase v9+** (Firestore) as backend — all Firebase interactions go through canonical layers (`src/repo/`, `src/service/`); `src/lib/firebase-*.js` serves as compatibility facade
- **Leaflet / React-Leaflet** for map features
- **CSS Modules** + Tailwind CSS 4 for styling
- **Vitest** for unit/integration tests (jsdom), **Playwright** for E2E (Chromium only)
- **dependency-cruiser** enforces forward-only layer dependencies (`npm run depcruise`)

### Key Directories

Six canonical layers with forward-only dependency: Types → Config → Repo → Service → Runtime → UI

| Path              | Purpose                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| `src/types/`      | Domain type declarations, shared constants                                          |
| `src/config/`     | Infrastructure config (Firebase client/server, geo data)                            |
| `src/repo/`       | Data access adapters (Firestore CRUD, external APIs)                                |
| `src/service/`    | Business logic, validation, data transformations                                    |
| `src/runtime/`    | React hooks, providers (Auth/Toast/Notification), use-cases                         |
| `src/ui/`         | Render-only screen components (receive state from runtime)                          |
| `src/app/`        | Next.js App Router thin entries (page/layout/route only)                            |
| `src/lib/`        | Compatibility facade — re-exports to canonical layers                               |
| `src/components/` | Shared React components                                                             |
| `specs/`          | Feature specs and planning artifacts only — no executable tests or test directories |
| `tests/`          | Executable tests: unit, integration, e2e, server, and shared `_helpers`             |

## Guides（前饋控制）

下列 `.codex/rules/*.md` 是 repo 內的參考文件與檢查清單，供 Codex 按需閱讀；它們不是 Codex 官方 Rules DSL，也不保證會被 runtime 自動載入。`.claude/rules/*.md` 保留作 legacy provenance。

| 文件                                | 建議查閱時機                              | 內容                                                                                                                     |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `.codex/rules/coding-rules.md`      | `src/**`, `specs/**`, `tests/**`          | 6 條 Non-Negotiable（無 @ts-ignore、無 JSX logic、無 eslint-disable a11y、JSDoc 規範、forward-only imports、300 行上限） |
| `.codex/rules/code-style.md`        | `src/**`, `specs/**`, `tests/**` (js/jsx) | Formatting + JSDoc patterns                                                                                              |
| `.codex/rules/testing-standards.md` | `tests/**`, test/spec 檔                  | Testing Trophy、AAA、userEvent                                                                                           |
| `.codex/rules/e2e-commands.md`      | `tests/e2e/**`                            | Playwright + emulator 指令                                                                                               |
| `.codex/rules/sensors.md`           | 需要跑驗證或檢查 gate 時                  | type-check/lint/test + IDE Diagnostics + pre-commit gate                                                                 |

### Git Workflow (Non-Negotiable)

**所有改動都必須在分支進行，不可直接在 main commit。** 適用所有類型：feature、fix、chore、style。

1. `git checkout main && git pull`
2. `git checkout -b <type>/描述` — 開獨立分支
3. 修改 + commit
4. `git checkout main && git merge <type>/描述 && git branch -d <type>/描述`
5. `git worktree list` → 每個非 main worktree 執行 `git -C <path> rebase main`
6. 如果原本在 feature branch，切回去繼續工作

### Development Lifecycle

Superpowers-first workflow。完整契約見 `docs/superpowers/workflow.md`；本節只保留入口地圖。

1. **隔離 workspace** — `using-git-worktrees`
   - 不在 `main` 直接修改或 commit。
2. **需求釐清** — `brainstorming`
   - 使用者只需要參與這一階段；批准 `spec.md` 並給一次啟動授權後，後續可由 agent 團隊自動執行。
3. **規格文件** — `specs/<feature>/spec.md`
   - 只寫 WHAT/WHY、使用者情境、驗收標準；技術細節留給 plan。
4. **技術規劃** — `writing-plans` → `specs/<feature>/plan.md`
   - 決定資料流、檔案責任、測試策略、風險與停損條件。
5. **任務拆分** — `specs/<feature>/tasks.md` + `status.json`
   - 每個 task slice 必須有 Engineer + Reviewer、owned files、dependencies、acceptance criteria、verification commands、commit checkpoint。
6. **TDD 實作** — `subagent-driven-development`
   - 主 agent 只做 dispatcher/coordinator；不得直接改 production code/test。
   - Engineer 寫測試/修 bug 前必讀 `.codex/references/testing-handbook.md`，並走 RED → GREEN → REFACTOR。
7. **Review / Debug** — paired Reviewer + `receiving-code-review` / `systematic-debugging`
   - Reviewer PASS 前不得勾選 task；Reviewer REJECT 退回同一 Engineer 修到 PASS。
8. **驗證與收尾** — `verification-before-completion` → `finishing-a-development-branch`
   - Fresh verification evidence 後才可 commit / push / PR / merge。
   - 預設 closeout：push feature branch → 開 PR → CI green → GitHub merge PR → 本地 `main` fast-forward 到 `origin/main`。

`speckit.*` 屬 legacy workflow；除非使用者明確要求，Codex 不預設使用。

## Reference Docs（分層 Context — 按需載入）

| 文件                                    | 狀態    | 用途                                                                            |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `.codex/references/core-beliefs.md`     | ✅ 已有 | HOW decision framework；協助 agent 在 tradeoff、review、refactor 時做判斷       |
| `.codex/references/quality-gates.md`    | ✅ 已有 | Pre-commit gate、架構層規則、ESLint 防線、ban list 一覽                         |
| `.codex/references/testing-handbook.md` | ✅ 已有 | 測試撰寫完整手冊                                                                |
| `.codex/references/review-standards.md` | 🔜 待建 | Code Review 標準與 checklist                                                    |
| `.codex/references/harness-articles/`   | ✅ 已有 | 5 篇 harness engineering 文章摘要（Fowler、OpenAI、Anthropic、Datadog、Stripe） |
| `docs/superpowers/workflow.md`          | ✅ 已有 | Superpowers-first agent workflow、durable artifacts、subagent/reviewer gate     |
| `docs/QUALITY_SCORE.md`                 | ✅ 已有 | Per-layer + per-domain 品質矩陣（coverage、lint、type-check、JSDoc、test 分佈） |

## Environment & Secrets

- All secrets (API keys, tokens) in `.env` only — never commit them
- `.env` must be in `.gitignore`
