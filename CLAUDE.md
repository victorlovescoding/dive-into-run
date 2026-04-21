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
npm run spellcheck          # cSpell 拼字檢查 (src + specs)
npm run test                # Vitest (unit + integration, jsdom env)
npx vitest run specs/path/to/file.test.jsx   # 單一 vitest 檔
```

> E2E 指令 → `.claude/rules/e2e-commands.md`（碰 `specs/**/e2e/` 時自動載入）
> Repo-wide audit 一律用 `npx eslint src specs`，不是 `npm run lint`

## Architecture

- **Next.js 15 / React 19** with App Router — pure JavaScript (no TypeScript), type safety via JSDoc + `checkJs: true`
- **Path alias**: `@/` → `./src/`
- **Firebase v9+** (Firestore) as backend — all Firebase interactions go through `src/lib/firebase-*.js`
- **Leaflet / React-Leaflet** for map features
- **CSS Modules** + Tailwind CSS 4 for styling
- **Vitest** for unit/integration tests (jsdom), **Playwright** for E2E (Chromium only)

### Key Directories

| Path              | Purpose                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `src/app/`        | Next.js App Router pages (events, login, member, posts, signout)      |
| `src/lib/`        | Service layer — Firebase clients, domain helpers (`event-helpers.js`) |
| `src/components/` | Shared React components                                               |
| `src/contexts/`   | React Context providers (Auth)                                        |
| `src/types/`      | Type declarations (CSS modules)                                       |
| `specs/`          | Feature specs + tests — one folder per git branch/feature             |

## Guides（前饋控制）

Path-scoped rules（只在碰到對應檔案時自動載入）：

| Rule                                 | 觸發路徑                      | 內容                                                                                   |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------- |
| `.claude/rules/coding-rules.md`      | `src/**`, `specs/**`          | 4 條 Non-Negotiable（無 @ts-ignore、無 JSX logic、無 eslint-disable a11y、JSDoc 規範） |
| `.claude/rules/code-style.md`        | `src/**`, `specs/**` (js/jsx) | Formatting + JSDoc patterns                                                            |
| `.claude/rules/testing-standards.md` | `specs/**`, test/spec 檔      | Testing Trophy、AAA、userEvent                                                         |
| `.claude/rules/e2e-commands.md`      | `specs/**/e2e/**`             | Playwright + emulator 指令                                                             |
| `.claude/rules/sensors.md`           | 無 paths（always loaded）     | type-check/lint/test + IDE Diagnostics + pre-commit gate                               |

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

| 文件                                     | 狀態      | 用途                                                                            |
| ---------------------------------------- | --------- | ------------------------------------------------------------------------------- |
| `.claude/references/coding-standards.md` | ✅ 已有   | 完整編碼規範與品質防線                                                          |
| `.claude/references/testing-handbook.md` | ✅ 已有   | 測試撰寫完整手冊                                                                |
| `.claude/references/review-standards.md` | 🔜 待建   | Code Review 標準與 checklist                                                    |
| `.claude/references/harness-articles/`   | ✅ 已有   | 5 篇 harness engineering 文章摘要（Fowler、OpenAI、Anthropic、Datadog、Stripe） |
| `docs/harness-migration/PROGRESS.md`     | 🔄 進行中 | Harness 六層架構遷移進度（13 PR）                                               |

## Environment & Secrets

- All secrets (API keys, tokens) in `.env` only — never commit them
- `.env` must be in `.gitignore`
