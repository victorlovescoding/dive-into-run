# Quality Gates Reference

> Agent-only. What will block your commit and what architecture constraints exist.
> Coding style/formatting rules -> `.codex/rules/coding-rules.md`, `.codex/rules/code-style.md`
> Testing rules -> `.codex/rules/testing-standards.md`

---

## 1. Pre-commit Gate (5 Sequential Checks)

Any failure blocks the commit. Runs in this exact order:

| #   | Check              | Command                               | Blocks When                           |
| --- | ------------------ | ------------------------------------- | ------------------------------------- |
| 1   | ESLint             | `npm run lint -- --max-warnings 0`    | Any error OR warning (zero tolerance) |
| 2   | Type Check         | `npm run type-check` (`tsc --noEmit`) | Any JSDoc type error                  |
| 3   | Dependency Cruiser | `npm run depcruise`                   | Architecture rule violation           |
| 4   | CSpell             | `npm run spellcheck`                  | Spelling error in src/specs           |
| 5   | Vitest             | `npx vitest run --project=browser`    | Any test failure                      |

`block-dangerous-commands.js` prevents bypassing via `--no-verify`, `git add -A`, `git add .`, `git commit -a`.

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
| Unit        | lib, config, repo, service, runtime (excl. providers), app/api                        | providers, components, contexts, hooks, app (non-API) |
| Integration | app, components, contexts, hooks, runtime (incl. providers), lib, client config, data | repo, service, server config                          |
| E2E         | external packages + same-feature e2e relatives only                                   | All `src/`                                            |
| test-utils  | external + relative (within test-utils) only                                          | All `src/`                                            |

---

## 3. ESLint Mechanical Enforcement

Beyond the 4 non-negotiable rules in `coding-rules.md`:

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

---

## 4. Dangerous Command Blocks

`block-dangerous-commands.js` (PreToolUse hook) blocks 20 patterns:

| Category           | Examples                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Batch delete       | `rm -rf *`, `find -delete`, `git rm -r`                                                                |
| Git irreversible   | `git push --force`, `git reset --hard`, `git clean`, `git branch -D`, `git checkout --`, `git restore` |
| Bypass prevention  | `--no-verify`, `-n` flag, `git add -A`, `git add .`, `git commit -a`                                   |
| Privilege & leak   | `sudo`, `env`, `printenv`                                                                              |
| System destruction | `mkfs`, `dd`, `reboot`, `shutdown`                                                                     |

---

## 5. Quick Don't List

| Forbidden                              | Alternative                           | Enforced by                  |
| -------------------------------------- | ------------------------------------- | ---------------------------- |
| `@ts-ignore`                           | `@ts-expect-error` + explanation      | ESLint                       |
| `eslint-disable` a11y rules            | Fix HTML structure                    | ESLint                       |
| `console.log`                          | `console.warn` / `.error`             | ESLint                       |
| `var`                                  | `const` / `let`                       | ESLint                       |
| `fireEvent` (tests)                    | `userEvent.setup()`                   | ESLint                       |
| `container.querySelector` (tests)      | `screen.getByRole`                    | ESLint                       |
| File > 300 lines                       | Split into sub-hooks/components       | ESLint max-lines             |
| Higher layer import                    | Move function down or accept as param | dependency-cruiser           |
| `src/lib/` import from canonical layer | Import from canonical home            | dependency-cruiser           |
| `firebase/*` in UI layers              | `src/lib/firebase-*.js`               | ESLint no-restricted-imports |
| `--no-verify`                          | Fix the pre-commit failure            | block-dangerous-commands.js  |
| `git add -A` / `git add .`             | Stage specific files by name          | block-dangerous-commands.js  |

---

## 6. Dev Sensors (Quick Self-Check)

Run these during development, don't wait for pre-commit:

| Command                      | Scope                            | When to use                         |
| ---------------------------- | -------------------------------- | ----------------------------------- |
| `npm run lint:changed`       | Git changed files                | After completing a file             |
| `npm run type-check:changed` | Git changed files (filtered tsc) | After modifying function signatures |
| `npm run test:branch`        | Branch vitest only               | After completing a feature slice    |

PostToolUse hook auto-runs single-file ESLint after every Edit/Write (non-blocking).
Full sensor reference -> `.codex/rules/sensors.md`

---

## Source Config Files

- ESLint: `eslint.config.mjs`
- Dependency cruiser: `.dependency-cruiser.mjs`
- Test bucket policy: `specs/021-layered-dependency-architecture/test-buckets/policy.js`
- Pre-commit: `.husky/pre-commit`
- Dangerous commands: `.codex/hooks/block-dangerous-commands.js`
- Codex hooks: `.codex/hooks.json`
