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
npm run spellcheck          # cSpell 拼字檢查 (src + specs)
npm run test                # Vitest (unit + integration, jsdom env)
npx vitest run specs/path/to/file.test.jsx   # 單一 vitest 檔
```

> E2E 指令參考 → `.codex/rules/e2e-commands.md`（參考文件，不是 Codex native Rules auto-load）
> Repo-wide audit 一律用 `npx eslint src specs`，不是 `npm run lint`

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

| Path              | Purpose                                                     |
| ----------------- | ----------------------------------------------------------- |
| `src/types/`      | Domain type declarations, shared constants                  |
| `src/config/`     | Infrastructure config (Firebase client/server, geo data)    |
| `src/repo/`       | Data access adapters (Firestore CRUD, external APIs)        |
| `src/service/`    | Business logic, validation, data transformations            |
| `src/runtime/`    | React hooks, providers (Auth/Toast/Notification), use-cases |
| `src/ui/`         | Render-only screen components (receive state from runtime)  |
| `src/app/`        | Next.js App Router thin entries (page/layout/route only)    |
| `src/lib/`        | Compatibility facade — re-exports to canonical layers       |
| `src/components/` | Shared React components                                     |
| `specs/`          | Feature specs + tests — one folder per git branch/feature   |

## Guides（前饋控制）

下列 `.codex/rules/*.md` 是 repo 內的參考文件與檢查清單，供 Codex 按需閱讀；它們不是 Codex 官方 Rules DSL，也不保證會被 runtime 自動載入。`.claude/rules/*.md` 保留作 legacy provenance。

| 文件                                | 建議查閱時機                  | 內容                                                                                                                     |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `.codex/rules/coding-rules.md`      | `src/**`, `specs/**`          | 6 條 Non-Negotiable（無 @ts-ignore、無 JSX logic、無 eslint-disable a11y、JSDoc 規範、forward-only imports、300 行上限） |
| `.codex/rules/code-style.md`        | `src/**`, `specs/**` (js/jsx) | Formatting + JSDoc patterns                                                                                              |
| `.codex/rules/testing-standards.md` | `specs/**`, test/spec 檔      | Testing Trophy、AAA、userEvent                                                                                           |
| `.codex/rules/e2e-commands.md`      | `specs/**/e2e/**`             | Playwright + emulator 指令                                                                                               |
| `.codex/rules/sensors.md`           | 需要跑驗證或檢查 gate 時      | type-check/lint/test + IDE Diagnostics + pre-commit gate                                                                 |

### Git Workflow (Non-Negotiable)

**所有改動都必須在分支進行，不可直接在 main commit。** 適用所有類型：feature、fix、chore、style。

1. `git checkout main && git pull`
2. `git checkout -b <type>/描述` — 開獨立分支
3. 修改 + commit
4. `git checkout main && git merge <type>/描述 && git branch -d <type>/描述`
5. `git worktree list` → 每個非 main worktree 執行 `git -C <path> rebase main`
6. 如果原本在 feature branch，切回去繼續工作

### Development Lifecycle

8 階段開發流程，每階段都有 Guide（前饋）和 Sensor（反饋）：

1. **需求釐清** — Plan mode + speckit.clarify / AskUserQuestion
   - 複雜功能：frontend-design skill 討論 UI → PRD/spec.md
2. **規格制定** — speckit.specify（只放 WHAT/WHY，技術細節留 Plan）
3. **技術規劃** — Plan mode + speckit.plan（DB schema、RWD、frontend-design subagent）
4. **任務拆分** — Plan mode + speckit.tasks（依賴分析、最大化平行）
5. **品質審核** — Plan mode + speckit.analyze → 新 session 交叉驗證
6. **TDD 實作** — speckit.implement（嚴格 RED→GREEN→REFACTOR per task）
7. **Code Review** — codereview-roasted → 逐一修 issues → 🟢 Good taste + ✅ Worth merging
8. **Merge** — 通過 roasted review 後 merge 回 main（main 受 PR + 2 status check 保護）

## Reference Docs（分層 Context — 按需載入）

| 文件                                    | 狀態    | 用途                                                                            |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `.codex/references/quality-gates.md`    | ✅ 已有 | Pre-commit gate、架構層規則、ESLint 防線、ban list 一覽                         |
| `.codex/references/testing-handbook.md` | ✅ 已有 | 測試撰寫完整手冊                                                                |
| `.codex/references/review-standards.md` | 🔜 待建 | Code Review 標準與 checklist                                                    |
| `.codex/references/harness-articles/`   | ✅ 已有 | 5 篇 harness engineering 文章摘要（Fowler、OpenAI、Anthropic、Datadog、Stripe） |
| `docs/QUALITY_SCORE.md`                 | ✅ 已有 | Per-layer + per-domain 品質矩陣（coverage、lint、type-check、JSDoc、test 分佈） |

## Environment & Secrets

- All secrets (API keys, tokens) in `.env` only — never commit them
- `.env` must be in `.gitignore`
