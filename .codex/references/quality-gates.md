# Quality Gates Reference

> Last-Verified: 2026-05-11
> Agent-only. What will block your commit and what architecture constraints exist.
> Coding style/formatting rules -> `.codex/rules/coding-rules.md`, `.codex/rules/code-style.md`
> Testing rules -> `.codex/rules/testing-standards.md`

---

## 1. Pre-commit Gate (11 Sequential Checks)

Any failure blocks the commit. Runs in this exact order:

| #   | Check                | Command                               | Blocks When                                             |
| --- | -------------------- | ------------------------------------- | ------------------------------------------------------- |
| 1   | ESLint               | `npm run lint -- --max-warnings 0`    | Any error OR warning (zero tolerance)                   |
| 2   | Type Check           | `npm run type-check` (`tsc --noEmit`) | Any JSDoc type error                                    |
| 3   | Dependency Cruiser   | `npm run depcruise`                   | Architecture rule violation                             |
| 4   | CSpell               | `npm run spellcheck`                  | Spelling error in `src`, `specs`, or `tests` JS/JSX     |
| 5   | Workflow State Check | `npm run workflow:check`              | Invalid workflow state, missing companion files, stale task sync |
| 6   | Workflow Links Check | `npm run workflow:links`              | Broken repo-local references in workflow-critical docs  |
| 7   | Vitest Browser       | `npx vitest run --project=browser`    | Any browser/jsdom unit or integration test failure      |
| 8   | Mock Boundary Audit  | `bash scripts/audit-mock-boundary.sh` | Forbidden internal-layer mock in executable tests       |
| 9   | Flaky Pattern Audit  | `npm run audit:flaky-patterns`        | Forbidden flaky assertion or fixed-sleep pattern        |
| 10  | useEffect Data Fetch Audit | `npm run audit:use-effect-data-fetching` | UI/component effect data fetch, Firebase/data-layer import, or exhaustive-deps suppression |
| 11  | Playwright Official Audit | `npm run audit:playwright-official-only` | Focused E2E tests, fixed sleeps, or non-official E2E imports |

`block-dangerous-commands.js` prevents bypassing via `--no-verify`, `git add -A`, `git add .`, `git commit -a`.

CI also runs workflow state/link checks plus mock-boundary, flaky-pattern,
useEffect data-fetch, and Playwright official-only audits as blocking steps.
Treat these as both local pre-commit and CI gates.

`npm run workflow:validate` validates `specs/*/status.json` workflow state.
Run it after changing Superpowers status files. It blocks chained
`lastVerification[].command` entries containing `&&` or `;`; record one command
per evidence entry instead.

---

## 2. Architecture Layers (dependency-cruiser)

Six canonical layers, **forward-only** dependency. Lower layers cannot import higher layers.

```
Types -> Config -> Repo -> Service -> Runtime -> UI
```

| Layer   | Path           | Purpose                                                  |
| ------- | -------------- | -------------------------------------------------------- |
| Types   | `src/types/`   | Domain type declarations, shared constants               |
| Config  | `src/config/`  | Infrastructure config (Firebase client/server, geo data) |
| Repo    | `src/repo/`    | Data access adapters (Firestore CRUD, external APIs)     |
| Service | `src/service/` | Business logic, validation, data transformations         |
| Runtime | `src/runtime/` | React hooks, providers, use-cases                        |
| UI      | `src/ui/`      | Render-only screen components                            |

Non-canonical dirs (`src/components/`, `src/contexts/`, `src/hooks/`, `src/data/`) are outside layer enforcement but have their own import restrictions (see ESLint rules below).

Type-only imports (JSDoc `@typedef`, `@param {import('...')}`) are **exempt** from all layer rules.

### 2.1 Layer Direction Rules (x5)

Each layer cannot import any layer above it.

```js
// ❌ src/repo/client/events-repo.js importing from runtime
import { useAuth } from '@/runtime/hooks/useAuth';

// ✅ Accept the value as a parameter from a higher-layer caller
export function fetchEvents(userId) {
  /* ... */
}
```

### 2.2 Named Forbidden Rules (x8)

**canonical-no-import-lib** -- Canonical layers must not import `src/lib/`. Use the canonical home.

```js
// ❌ src/service/event-service.js
import { fetchEvents } from '@/lib/firebase-events';

// ✅ Import from the canonical repo layer
import { fetchEvents } from '@/repo/client/firebase-events-repo';
```

**provider-no-repo** -- `src/runtime/providers/` cannot import `src/repo/` directly. Route through service/use-case.

```js
// ❌ src/runtime/providers/EventProvider.js
import { fetchEvents } from '@/repo/client/firebase-events-repo';

// ✅ Route through service layer
import { getActiveEvents } from '@/service/event-service';
```

**provider-no-service** -- Providers cannot import `src/service/`. Providers inject cross-cutting context only (auth, toast). Business logic belongs in use-cases under `src/runtime/client/use-cases/`.

**entry-no-config-repo-direct-import** -- `src/app/` cannot import `src/config/` or `src/repo/` directly. Use service/runtime layer.

```js
// ❌ src/app/events/page.jsx
import { db } from '@/config/client/firebase-client-app';

// ✅ Go through service/runtime
import { useEventList } from '@/runtime/hooks/useEventList';
```

**server-only-no-client-import** -- Client-side files cannot import `**/server/**` or `*.server.js`. Server logic goes behind API routes or Server Components.

**server-deps-require-server-path** -- Files importing `firebase-admin` must be in `src/*/server/` or named `*.server.js`.

**production-no-specs-import** -- `src/` cannot import from `specs/`. Move utilities to `src/`.

### 2.3 Test Bucket Rules

| Bucket      | Allowed imports                                                                       | Denied imports                                        |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Unit        | lib, config, repo, service, runtime (excl. providers), ui, app/api                    | providers, components, contexts, hooks, app (non-API) |
| Integration | app, components, ui, contexts, hooks, runtime (incl. providers), lib, client config, data | repo, service, server config                          |
| E2E         | external packages + same-feature e2e relatives only                                   | All `src/`                                            |
| tests-helpers | external + relative (within `tests/_helpers`) only                                  | All `src/`                                            |

---

## 3. ESLint Mechanical Enforcement

Beyond the non-negotiable rules in `coding-rules.md`:

**300-line file limit** -- `src/**/*.{js,jsx}`, excludes `src/config/geo/**`. `skipBlankLines: true`, `skipComments: true`. Severity: error.

**Zero warning tolerance** -- `--max-warnings 0` in pre-commit. All warnings are treated as errors.

**Firebase import restriction** -- `src/app/`, `src/components/`, `src/hooks/`, `src/contexts/` cannot import `firebase/*` directly. Must use `src/lib/firebase-*.js` helpers.

```js
// ❌ src/components/EventCard.jsx
import { doc, getDoc } from 'firebase/firestore';

// ✅ Use lib facade
import { getEventById } from '@/lib/firebase-events';
```

**src/lib/ purity** -- `src/lib/` cannot import React, Next.js, or react-leaflet. It is a pure service facade.

**JSDoc requirement** -- All exported functions in `src/` must have JSDoc with `@param` descriptions. Severity: error in src/, warn in tests.

**no-console** -- `console.log` is banned. Use `console.warn` or `console.error`.

**React Hooks official compiler lint gates** -- `eslint-plugin-react-hooks`
`recommended-latest` is active and the compiler-facing rules are errors:
`rules-of-hooks`, `exhaustive-deps`, `purity`, `immutability`, `globals`,
`refs`, `set-state-in-render`, `set-state-in-effect`, `static-components`,
`component-hook-factories`, `preserve-manual-memoization`,
`incompatible-library`, `unsupported-syntax`, `config`, `gating`,
`error-boundaries`, `use-memo`, and `void-use-memo`.

**Next official Core Web Vitals hardening** -- `@next/next/core-web-vitals`
is active, with official rules promoted to errors where configured.
`@next/next/no-img-element` is an error. Legitimate exceptions require a
path-level documented ESLint override; inline disables are not acceptable.

**Testing Library official rules** -- non-E2E tests enforce awaited async
queries/events/utils, no awaited sync queries/events, `screen` queries,
no `container`/node access, no `waitFor` side effects, no multiple
assertions/snapshots inside `waitFor`, and `userEvent.setup()`.

**Vitest official rules** -- non-E2E tests enforce `@vitest/eslint-plugin`
recommended rules plus no focused, disabled, or commented-out tests,
`expect-expect`, `valid-expect`, no identical titles, and no standalone
`expect`. `tests/server/rules/**` is the only scoped exception where
`assertSucceeds` and `assertFails` count as assertions.

Existing non-official ESLint plugins (`eslint-plugin-react`, `jsx-a11y`,
`import`, `jsdoc`, `eslint-comments`) remain legacy gates. This change
does not expand their policy beyond current configured rules.

---

## 4. Audit Blockers

**Mock boundary audit** -- `scripts/audit-mock-boundary.sh` blocks casual mocks of internal repo layers in executable tests. Mock external boundaries instead; do not mock `@/lib`, `@/repo`, `@/service`, or `@/runtime` except explicitly allowed provider boundaries.

**Flaky pattern audit** -- `scripts/audit-flaky-patterns.sh` blocks the audited flaky-pattern ids: `toHaveBeenCalledTimes`, `new Promise + setTimeout`, `setTimeout + Promise`, and `page.waitForTimeout`.

**useEffect data-fetching audit** -- `npm run audit:use-effect-data-fetching`
blocks direct data fetching in `src/ui/**` and `src/components/**` effects,
including direct `fetch`, Firebase imports, repo/service imports, or
`@/lib/firebase-*` imports. It also blocks `react-hooks/exhaustive-deps`
suppression in `src/ui/**`, `src/components/**`, and `src/runtime/hooks/**`.

**Playwright official-only audit** -- `npm run audit:playwright-official-only`
blocks `.only`, `page.waitForTimeout`, obvious fixed sleeps, Playwright test
API imports from anything except `@playwright/test`, and E2E imports that are
not `@playwright/test`, Node builtins, or relative helpers. Prefer locators
and web-first assertions; reviewers still check this when AST enforcement is
not reliable.

All four audits are commit blockers through `.husky/pre-commit` and blocking
CI steps.

### 4.1 Review Checklist Limitations

Some official-guidance semantics are review checklist items because the
current audits intentionally do not try to prove them from AST alone:

- Runtime hook effects that fetch or listen must synchronize with an external
  system, include cleanup or stale guards, keep dependencies honest, and avoid
  derived state.
- Playwright E2E should prefer locators and web-first assertions when a
  mechanical audit cannot reliably distinguish intent.

---

## 5. Permission And Dangerous Command Blocks

New or changed permission `deny` rules are for true irreversible, rare
destructive operations. The current hook also blocks a small explicit set of
defense-bypass and secret-leak commands; treat those as hook behavior, not a
reason to hard-deny normal workflow actions.

Do not add deny rules for deploys, ordinary writes, database migrations,
Firestore add/update operations, CI triggers, or non-force `git push`. If a
command is ambiguous, prompt/approval is the safer default because the user can
judge the concrete context.

`block-dangerous-commands.js` (PreToolUse hook) currently blocks these patterns:

| Category                      | Examples                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Filesystem destruction        | `rm -rf /`, `rm -rf *`, `find -delete`, `git rm -r`                                                           |
| Network script execution      | `curl ... \| sh`, `wget ... \| bash`                                                                          |
| Git ref rewrite / destruction | `git push --force`, `git push origin +branch`, `git push --delete`, `git push origin :branch`, `git reset --hard`, `git clean`, `git branch -D`, `git checkout --`, `git restore` |
| Gate bypass                   | `git commit --no-verify`, `git commit -n`, `git add -A`, `git add --all`, `git add .`, `git commit -a`        |
| Privilege / leak / system     | `sudo`, `env`, `printenv`, `chmod 777`, `chmod 666`, `chown root`, `mkfs`, `dd`, `fdisk`, `parted`, `reboot`, `shutdown`, `halt`, `poweroff`, writes to block devices, fork bombs |

For normal feature branch publishing, use `git push -u origin HEAD`. Do not
treat non-force push as destructive.

---

## 6. Quick Don't List

| Forbidden                              | Alternative                           | Enforced by                  |
| -------------------------------------- | ------------------------------------- | ---------------------------- |
| `@ts-ignore`                           | `@ts-expect-error` + explanation      | ESLint                       |
| `eslint-disable` a11y rules            | Fix HTML structure                    | ESLint                       |
| `console.log`                          | `console.warn` / `.error`             | ESLint                       |
| `var`                                  | `const` / `let`                       | ESLint                       |
| `fireEvent` (tests)                    | `userEvent.setup()`                   | ESLint                       |
| `container.querySelector` (tests)      | `screen.getByRole`                    | ESLint                       |
| Awaited sync Testing Library query/event | Await only async query/event/userEvent | ESLint                     |
| Multiple assertions or side effects in `waitFor` | One observable assertion, no side effects | ESLint                |
| `test.only` / `describe.only`          | Remove focus marker                   | ESLint / Playwright audit    |
| Disabled or commented-out tests        | Delete or fix the test                | ESLint                       |
| File > 300 lines                       | Split into sub-hooks/components       | ESLint max-lines             |
| `<img>` in Next UI                     | `next/image` or path-level documented override | ESLint              |
| UI/component effect data fetch         | Runtime/service boundary              | `audit:use-effect-data-fetching` |
| Higher layer import                    | Move function down or accept as param | dependency-cruiser           |
| `src/lib/` import from canonical layer | Import from canonical home            | dependency-cruiser           |
| `firebase/*` in UI layers              | `src/lib/firebase-*.js`               | ESLint no-restricted-imports |
| Internal layer mocks in tests          | Mock external boundaries              | `audit-mock-boundary.sh`     |
| `toHaveBeenCalledTimes` / audited fixed sleeps | Behavior assertions / async waits     | `audit-flaky-patterns.sh`    |
| E2E non-official imports               | `@playwright/test` + relative helpers | `audit:playwright-official-only` |
| `--no-verify`                          | Fix the pre-commit failure            | block-dangerous-commands.js  |
| `git add -A` / `git add .`             | Stage specific files by name          | block-dangerous-commands.js  |

---

## 7. Dev Sensors (Quick Self-Check)

Run these during development, don't wait for pre-commit:

| Command                      | Scope                            | When to use                         |
| ---------------------------- | -------------------------------- | ----------------------------------- |
| `npm run lint:changed`       | Git changed files                | After completing a file             |
| `npm run type-check:changed` | Git changed files (filtered tsc) | After modifying function signatures |
| `bash scripts/audit-mock-boundary.sh` | Executable tests | After changing test mocks |
| `bash scripts/audit-flaky-patterns.sh` | Executable tests under `tests/` | After changing async assertions or waits |
| `npm run audit:use-effect-data-fetching` | `src/ui`, `src/components`, `src/runtime/hooks` | After changing effects or data-fetch boundaries |
| `npm run audit:playwright-official-only` | Playwright E2E | After changing E2E tests or helpers |
| `npm run test:branch`        | Branch vitest only               | After completing a feature slice    |

Full sensor reference -> `.codex/rules/sensors.md`

---

## Source Config Files

- ESLint: `eslint.config.mjs`
- Dependency cruiser: `.dependency-cruiser.mjs`
- Test bucket policy: `specs/021-layered-dependency-architecture/test-buckets/policy.js`
- Pre-commit: `.husky/pre-commit`
- Dangerous commands: `.codex/hooks/block-dangerous-commands.js`
- Codex hooks: `.codex/hooks.json`
