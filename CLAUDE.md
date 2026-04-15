# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Style

- Respond in **Taiwan Traditional Chinese** (正體中文)
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
npm run type-check   # TypeScript-powered JSDoc type checking (tsc -p tsconfig.check.json)
npm run type-check:changed  # 只顯示 changed files 的 type errors
npm run test         # Vitest (unit + integration, jsdom env)
npx vitest run specs/path/to/file.test.jsx  # Run a single test file
npx playwright test  # E2E tests (Chromium only, needs dev server)
npx playwright test specs/path/to/file.spec.js  # Single E2E test
npm run test:e2e:emulator  # E2E with Firebase Emulator (需先啟動 emulator)
firebase emulators:exec --only auth,firestore "npm run test:e2e:emulator"  # 一行啟動 emulator + 跑 E2E
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

## Strict Rules (Non-Negotiable)

1. **No `@ts-ignore`** — use `@ts-expect-error` with explanation if absolutely necessary. Verify with `grep -r "@ts-ignore" src specs`
2. **No logic in JSX** — extract complex logic into components or helper functions. JSX handles view only
3. **No `eslint-disable` for a11y rules** — fix the HTML structure (roles, labels, handlers) instead
4. **Meaningful JSDoc** — all new/modified exported functions must have JSDoc explaining intent and params, not boilerplate
   - `@typedef` must use lowercase `{object}`, not `{Object}`
   - Every `@property` must include a description (e.g. `@property {string} city - 活動所在縣市。`)
   - Every `@param` must include a description
5. **Task completion requires** 以下全部 pass：
   - `npm run type-check:branch` — 只檢查 branch 上改過的檔案的 JSDoc 型別
   - `npm run lint:branch` — 只檢查 branch 上改過的檔案的 ESLint
   - `npm run test` — Vitest unit + integration 測試
   - `npx playwright test` — E2E 測試（有 E2E spec 時才需要）
   開發中可用 `type-check:changed` / `lint:changed`（只看未 commit 的改動）加速迭代。
6. **cSpell** — project-specific words must be added to `cspell.json` at project root. Do not use inline `cspell:disable` comments
7. **IDE Diagnostics** — before marking a task complete, run `getDiagnostics` (via MCP) and fix all items with severity Warning, Hint, or Error. cSpell "Information" items can be ignored (but unknown words should still be added to `cspell.json`)
8. **Chore / Skill 修改的 Git 流程** — 修改 skill、constitution、CLAUDE.md、cspell.json 等非 feature 檔案時，**不論目前在 main 或 feature branch，一律禁止直接 commit**。必須：
   1. 回到主 repo 目錄，`git checkout main && git pull`
   2. `git checkout -b chore/描述` — 開獨立分支
   3. 修改 + commit
   4. `git checkout main && git merge chore/描述 && git branch -d chore/描述`
   5. 用 `git worktree list` 找出所有 active worktree
   6. 對每個 worktree 執行 `git -C <worktree-path> rebase main`（跳過 main 本身）
   7. 如果原本在 feature branch，切回去繼續工作

## Code Style Quick Reference

### Formatting

- **Semicolons**: always
- **Quotes**: single `'` in JS, double `"` in JSX attributes
- **Indent**: 2 spaces
- **Trailing commas**: ES5 (objects, arrays, params)
- **Variables**: `const` default, `let` only for reassignment, **never** `var`
- **Destructuring**: required for objects and arrays when accessing multiple properties

### JSDoc Patterns (checkJs: true)

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

## Testing Standards (Kent C. Dodds / Testing Trophy)

- **Integration (60%)** / **Unit (20%)** / **E2E (20%)**
- Test structure: `specs/<feature>/tests/[unit|integration|e2e]/`
- Test results: `specs/<feature>/test-results/[unit|integration|e2e]/`
  - `<feature>` 對應 git 分支名稱（e.g. `003-strict-type-fixes`）
- Unit tests: AAA pattern, F.I.R.S.T principles, 100% isolated (mock Firebase with `vi.mock`)
- Integration tests: **must** use `@testing-library/user-event` (`userEvent.setup()`). Never `fireEvent`. Use `screen.getByRole` over `container.querySelector`
- E2E tests: `page.getByRole`/`page.getByText` for locators. No `page.waitForTimeout()`
- Assertions: `@testing-library/jest-dom` matchers

## Environment & Secrets

- All secrets (API keys, tokens) in `.env` only — never commit them
- `.env` must be in `.gitignore`
