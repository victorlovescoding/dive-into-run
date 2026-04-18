# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- Be terse, casual, and treat the user as an expert
- Give actual code and concrete explanations — no high-level hand-waving
- Give the answer first, then explain if needed
- Before modifying any code, obtain explicit confirmation from the user
- **Thought debate partner (strictly non-negotiable)** — Act as a debate partner, not a yes-man. Challenge the user's assumptions, offer counterpoints, test their logic, and present different perspectives. Prioritize seeking truth over agreeing with them.
- **No speculation (strictly non-negotiable)** — When information is uncertain or unverifiable, reply `無法回答` and avoid guessing. Prefer verifying via web search / docs / code first; if still uncertain, say `無法回答`.

## Commands

```bash
npm run dev          # Dev server (Next.js + Turbopack) on localhost:3000
npm run build        # Production build
npm run lint         # ESLint (Airbnb + React Hooks + JSDoc via flat config)
npm run lint:changed # 只 lint git changed files
npm run type-check   # TypeScript-powered JSDoc type checking (tsc --noEmit)
npm run type-check:changed  # 只顯示 changed files 的 type errors
npm run spellcheck   # cSpell 拼字檢查 (src + specs)
npm run test         # Vitest (unit + integration, jsdom env)
npx vitest run specs/path/to/file.test.jsx  # Run a single test file
npx playwright test  # E2E tests (Chromium only, needs dev server)
npx playwright test specs/path/to/file.spec.js  # Single E2E test
npm run test:e2e:branch  # 自動偵測 branch → feature，選擇正確 config（emulator 或一般）
E2E_FEATURE=004-event-edit-delete npm run test:e2e:emulator  # 指定 feature 跑 E2E + emulator
firebase emulators:exec --only auth,firestore,storage "E2E_FEATURE=004-event-edit-delete npm run test:e2e:emulator"
```

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

## Guides（前饋控制 — 行動前指導）

### Strict Coding Rules (Non-Negotiable)

1. **No `@ts-ignore`** — use `@ts-expect-error` with explanation if absolutely necessary. Verify with `grep -r "@ts-ignore" src specs`
2. **No logic in JSX** — extract complex logic into components or helper functions. JSX handles view only
3. **No `eslint-disable` for a11y rules** — fix the HTML structure (roles, labels, handlers) instead
4. **Meaningful JSDoc** — all new/modified exported functions must have JSDoc explaining intent and params, not boilerplate
   - `@typedef` must use lowercase `{object}`, not `{Object}`
   - Every `@property` must include a description (e.g. `@property {string} city - 活動所在縣市。`)
   - Every `@param` must include a description

### Git Workflow (Non-Negotiable)

**所有改動都必須在分支進行，不可直接在 main commit。** 適用於所有類型：feature、fix、chore、style。

分支流程：

1. 回到主 repo 目錄，`git checkout main && git pull`
2. `git checkout -b <type>/描述` — 開獨立分支
3. 修改 + commit
4. `git checkout main && git merge <type>/描述 && git branch -d <type>/描述`
5. 用 `git worktree list` 找出所有 active worktree
6. 對每個 worktree 執行 `git -C <worktree-path> rebase main`（跳過 main 本身）
7. 如果原本在 feature branch，切回去繼續工作

### Code Style Quick Reference

> 完整編碼規範 → `.claude/references/coding-standards.md`

#### Formatting

- **Semicolons**: always
- **Quotes**: single `'` in JS, double `"` in JSX attributes
- **Indent**: 2 spaces
- **Trailing commas**: ES5 (objects, arrays, params)
- **Variables**: `const` default, `let` only for reassignment, **never** `var`
- **Destructuring**: required for objects and arrays when accessing multiple properties

#### JSDoc Patterns (checkJs: true)

```js
// Callback / function type
/** @param {(id: string) => void} onUpdate */

// Typedef
/** @typedef {{ id: string, name: string, email?: string }} User */

// Component props (destructured)
/**
 * @param {Object} props
 * @param {User} props.user
 * @param {(id: string) => void} props.onUpdate
 */
function UserCard({ user, onUpdate }) {}

// Import external type
/** @param {import('@/lib/types').Event} event */

// Type casting
const el = /** @type {HTMLInputElement} */ (document.getElementById('x'));
```

### Testing Standards (Kent C. Dodds / Testing Trophy)

> 完整測試手冊 → `.claude/references/testing-handbook.md`（待建）

- **Integration (60%)** / **Unit (20%)** / **E2E (20%)**
- Test structure: `specs/<feature>/tests/[unit|integration|e2e]/`
- Test results: `specs/<feature>/test-results/[unit|integration|e2e]/`
  - `<feature>` 對應 git 分支名稱（e.g. `003-strict-type-fixes`）
- Unit tests: AAA pattern, F.I.R.S.T principles, 100% isolated (mock Firebase with `vi.mock`)
- Integration tests: **must** use `@testing-library/user-event` (`userEvent.setup()`). Never `fireEvent`. Use `screen.getByRole` over `container.querySelector`
- E2E tests: `page.getByRole`/`page.getByText` for locators. No `page.waitForTimeout()`
- Assertions: `@testing-library/jest-dom` matchers

### Development Lifecycle（開發生命週期）

每個階段都有明確的 Guide（前饋）和 Sensor（反饋）：

1. **需求釐清** — Plan mode + speckit.clarify / AskMe 確認需求完整
   - 複雜功能：先用 frontend-design skill 討論 UI → 產出 PRD/spec.md
   - 簡單功能：詳細功能敘述即可
2. **規格制定** — speckit.specify（如有 PRD 要求參考）
3. **技術規劃** — Plan mode + speckit.plan（DB schema、RWD 等技術細節）
   - 可加開 frontend-design subagent 討論 UI 實作
4. **任務拆分** — Plan mode + speckit.tasks
   - 輸入：plan.md + data-model.md + quickstart.md + research.md + spec.md
   - 重點：分析相依性、最大化平行執行的 subagent/team 數量
5. **品質審核** — Plan mode + speckit.analyze
   - 產出 critical/high/medium issues → 開新 session 交叉驗證
6. **TDD 實作** — speckit.implement
   - 每個 task：先寫測試（RED）→ 最少代碼通過（GREEN）→ 重構（REFACTOR）
   - 通過 REFACTOR 才算完成，再進下一個 task
7. **Code Review** — codereview-roasted
   - 對照 tasks.md 檢查代碼品質 → 逐一修復 issues
   - 重跑直到：🟢 Good taste + ✅ Worth merging
8. **Merge** — 通過 roasted review 後 merge 回 main

## Sensors（反饋控制 — 行動後自我修正）

### 開發迭代品質確認（快速計算型 Sensors）

開發過程中用以下指令快速確認改動品質：

- `npm run type-check:changed` / `type-check:branch` — 快速確認 JSDoc 型別
- `npm run lint:changed` / `lint:branch` — 快速確認 ESLint
- `npm run test:branch` — 只跑當前 branch 的 Vitest unit + integration 測試
- `npm run test:e2e:branch` — 只跑當前 branch 的 Playwright E2E 測試（無 E2E 目錄時自動跳過）
- **commit 前不需額外跑檢查** — Husky pre-commit 會自動執行全專案 lint + type-check + spellcheck + vitest

### IDE Diagnostics（中速推理型 Sensor）

Before marking a task complete, run `getDiagnostics` (via MCP) and fix items by severity:

| Severity    | 處理方式                              |
| ----------- | ------------------------------------- |
| Error       | 必修                                  |
| Warning     | 必修                                  |
| Hint        | 必修                                  |
| Information | cSpell 專用 — 加詞到 cspell.json 即可 |

### cSpell（計算型 Sensor）

Project-specific words must be added to `cspell.json` at project root. Do not use inline `cspell:disable` comments.

### Pre-commit Gate（自動化閘門）

Husky pre-commit 會自動執行：`lint` → `type-check` → `spellcheck` → `vitest`。全部通過才能 commit。

### Code Review Gate

> 完整審查標準 → `.claude/references/review-standards.md`（待建）

Merge 前需通過 codereview-roasted 取得 🟢 Good taste + ✅ Worth merging。

## Reference Docs（分層 Context — 按需載入）

詳細規範獨立存放，agent 需要時再讀取：

| 文件                                     | 狀態    | 用途                         |
| ---------------------------------------- | ------- | ---------------------------- |
| `.claude/references/coding-standards.md` | ✅ 已有 | 完整編碼規範與品質防線       |
| `.claude/references/testing-handbook.md` | 🔜 待建 | 測試撰寫完整手冊             |
| `.claude/references/review-standards.md` | 🔜 待建 | Code Review 標準與 checklist |

## Environment & Secrets

- All secrets (API keys, tokens) in `.env` only — never commit them
- `.env` must be in `.gitignore`
