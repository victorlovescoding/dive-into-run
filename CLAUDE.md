# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 個人偏好（terse / debate partner / no speculation）→ `~/.claude/CLAUDE.md`

## Commands

```bash
npm run dev                 # Dev server (Next.js + Turbopack) on localhost:3000
npm run build               # Production build
npm run lint                # ESLint (Airbnb + React Hooks + JSDoc via flat config)
npm run lint:changed        # 只 lint git changed files
npm run type-check          # TypeScript-powered JSDoc type checking (tsc --noEmit)
npm run type-check:changed  # 只顯示 changed files 的 type errors
npm run spellcheck          # cSpell 拼字檢查 (src + specs + tests)
npm run test                # Full Vitest projects; server project requires Firebase Emulator
npm run test:browser        # Browser/jsdom Vitest only (unit + integration)
npm run test:server         # Server Vitest via Firebase Auth/Firestore emulator
npm run test:coverage       # Coverage via Firebase Auth/Firestore emulator
npx vitest run tests/unit/path/to/file.test.jsx   # 單一 Vitest 檔
npx playwright test tests/e2e/path/to/file.spec.js # 單一 Playwright 檔
```

> E2E 指令 → `.claude/rules/e2e-commands.md`（碰 `tests/e2e/**` 時自動載入）
> Repo-wide audit 一律用 `npx eslint src specs tests`，不是 `npm run lint`

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

Path-scoped rules（只在碰到對應檔案時自動載入）：

| Rule                                 | 觸發路徑                                  | 內容                                                                                                                |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `.claude/rules/coding-rules.md`      | `src/**`, `specs/**`, `tests/**`          | 6 條 Non-Negotiable（無 @ts-ignore、無 JSX logic、無 eslint-disable a11y、JSDoc、forward-only imports、300 行上限） |
| `.claude/rules/code-style.md`        | `src/**`, `specs/**`, `tests/**` (js/jsx) | Formatting + JSDoc patterns                                                                                         |
| `.claude/rules/testing-standards.md` | `tests/**`, test/spec 檔                  | Testing Trophy、AAA、userEvent                                                                                      |
| `.claude/rules/e2e-commands.md`      | `tests/e2e/**`                            | Playwright + emulator 指令                                                                                          |
| `.claude/rules/sensors.md`           | 無 paths（always loaded）                 | type-check/lint/test + IDE Diagnostics + pre-commit gate                                                            |

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

| 文件                                     | 狀態    | 用途                                                                            |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `.claude/references/quality-gates.md`    | ✅ 已有 | Pre-commit gate、架構層規則、ESLint 防線、ban list 一覽                         |
| `.claude/references/testing-handbook.md` | ✅ 已有 | 測試撰寫完整手冊                                                                |
| `.claude/references/review-standards.md` | 🔜 待建 | Code Review 標準與 checklist                                                    |
| `.claude/references/harness-articles/`   | ✅ 已有 | 5 篇 harness engineering 文章摘要（Fowler、OpenAI、Anthropic、Datadog、Stripe） |
| `docs/QUALITY_SCORE.md`                  | ✅ 已有 | Per-layer + per-domain 品質矩陣（coverage、lint、type-check、JSDoc、test 分佈） |

## Environment & Secrets

- All secrets (API keys, tokens) in `.env` only — never commit them
- `.env` must be in `.gitignore`
