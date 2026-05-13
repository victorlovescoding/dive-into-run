# Strict Src Types Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the report-only strict TypeScript/JSDoc island to cover `src/types/**` first, then fix only the minimal type-description issues revealed inside that island.

**Architecture:** `tsconfig.strict.json` remains the only strict island boundary. The root `tsconfig.json` and product code stay unchanged; any implementation fixes are limited to JSDoc/type declarations under `src/types/**` and must preserve runtime behavior and exported data shapes.

**Tech Stack:** Next.js 15, React 19, JavaScript with JSDoc `checkJs`, TypeScript 5 strict compiler report, npm scripts.

---

## File Structure

- Modify: `tsconfig.strict.json`
  - Owns the report-only strict compiler island.
  - Add `src/types/**/*` through `include` so all current and future files under `src/types/**` are checked without broadening the island to runtime, service, repo, UI, mocks, or tests.
  - Keep existing non-`src/types` strict files in `files`.
- Modify only if the strict report demands it: `src/types/not-found-messages.js`
  - Contains domain not-found message sentinels.
  - Allowed changes are JSDoc/type clarifications only; message values and exports must not change.
- Modify only if the strict report demands it: `src/types/weather-types.js`
  - Contains shared weather JSDoc typedefs.
  - Allowed changes are parameter, property, nullable, optional, literal, union, or typedef-reference clarifications only; exported typedef names and runtime `export {};` must remain compatible.
- Modify only if the strict report demands it: `src/types/css.d.ts`
  - Contains CSS module declarations.
  - Allowed changes are declaration-shape clarifications only; module name and default export semantics must remain compatible.

## Non-Scope

- Do not change `tsconfig.json`.
- Do not enable strict mode for the root project.
- Do not change runtime, service, repo, UI, route, mock, or product behavior.
- Do not widen strict coverage beyond `src/types/**` plus the existing explicit strict files.
- Do not convert `npm run type-check:strict-report` into a blocking gate.
- Do not add product tests, E2E tests, or browser Vitest tests for this quality-gate change.
- Do not fix unrelated lint, type, formatting, or flaky-test issues outside the approved island.
- Do not use broad `any`, `@ts-ignore`, or `@ts-expect-error` to silence diagnostics.

## Stop Conditions

- Stop if strict diagnostics require editing outside `tsconfig.strict.json` or `src/types/**`.
- Stop if a diagnostic can only be fixed by changing exported type semantics instead of clarifying the current shape.
- Stop if the `include` pattern pulls in files outside `src/types/**`.
- Stop if `src/types/**` disappears or no longer contains meaningful strict-checkable source/type files.
- Stop if verification fails for a known branch-wide issue unrelated to the strict island; report the command and evidence to the main agent.
- Stop if local pre-commit browser Vitest flake evidence is the only failing signal; this branch already has known full-suite flake evidence, and implementation must not depend on fixing it unless strict src changes caused the failure.

### Task 1: Expand the Strict Island and Fix Local Type Descriptions

**Files:**
- Modify: `tsconfig.strict.json`
- Modify only if reported by `npm run type-check:strict-report`: `src/types/not-found-messages.js`
- Modify only if reported by `npm run type-check:strict-report`: `src/types/weather-types.js`
- Modify only if reported by `npm run type-check:strict-report`: `src/types/css.d.ts`

- [ ] **Step 1: Check current strict island files**

Run: `sed -n '1,220p' tsconfig.strict.json`

Expected: `files` contains existing explicit strict entries, including `src/types/not-found-messages.js` and `src/types/weather-types.js`, and `include` is still empty before implementation.

- [ ] **Step 2: Confirm the `src/types/**` file set**

Run: `rg --files src/types`

Expected signal:

```text
src/types/weather-types.js
src/types/css.d.ts
src/types/not-found-messages.js
```

- [ ] **Step 3: Expand `tsconfig.strict.json` to include the full types island**

Replace the current file with this structure, preserving existing non-`src/types` strict entries and moving `src/types/**` ownership to `include`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "incremental": false,
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.strict.tsbuildinfo"
  },
  "files": [
    "next.config.mjs",
    "scripts/check-next-build-budget.mjs",
    "scripts/run-knip-report.mjs",
    "scripts/type-check-strict-report.mjs",
    "src/config/client/firebase-timestamp.js"
  ],
  "include": ["src/types/**/*"]
}
```

Expected: the strict island now covers every file under `src/types/**`, including `src/types/css.d.ts`, without adding any other source tree.

- [ ] **Step 4: Run the strict report to reveal island diagnostics**

Run: `npm run type-check:strict-report`

Expected signal if current `src/types/**` is already strict clean:

```text
Strict type-check report completed.
```

Expected signal if the script prints diagnostics: every diagnostic path is either `tsconfig.strict.json` or under `src/types/**`. Continue only with those files.

- [ ] **Step 5: Fix only minimal `src/types/**` JSDoc/type diagnostics**

Apply this decision rule for each diagnostic:

```text
If the diagnostic is in src/types/not-found-messages.js:
  Add or adjust JSDoc for constants only.
  Keep EVENT_NOT_FOUND_MESSAGE and POST_NOT_FOUND_MESSAGE values unchanged.

If the diagnostic is in src/types/weather-types.js:
  Adjust @typedef, @property, nullability, optionality, literal, or union annotations only.
  Keep UvInfo, AqiInfo, TodayWeather, TomorrowWeather, and WeatherInfo names compatible.
  Keep export {}; in place.

If the diagnostic is in src/types/css.d.ts:
  Adjust the declaration shape only.
  Keep declare module '*.module.css' and the default export available.

If the diagnostic requires runtime behavior, product code, root config, broad any, @ts-ignore, or @ts-expect-error:
  Stop and report the diagnostic to the main agent.
```

No change is expected in this step if Step 4 is already clean after the `include` expansion.

- [ ] **Step 6: Rerun the strict report**

Run: `npm run type-check:strict-report`

Expected: exits 0 and reports no strict diagnostics for `src/types/**`.

### Task 2: Review, Verification, and Commit Prep

**Files:**
- Inspect: `tsconfig.strict.json`
- Inspect: `src/types/not-found-messages.js` if changed
- Inspect: `src/types/weather-types.js` if changed
- Inspect: `src/types/css.d.ts` if changed

- [ ] **Step 1: Check the changed-file list**

Run: `git diff --name-only`

Expected: changed files are limited to:

```text
tsconfig.strict.json
src/types/not-found-messages.js
src/types/weather-types.js
src/types/css.d.ts
```

If fewer files changed, that is valid when the strict report was already clean. If any other file appears, stop and ask the main agent before continuing.

- [ ] **Step 2: Inspect the strict config diff**

Run: `git diff -- tsconfig.strict.json`

Expected signal:

```diff
-  "include": []
+  "include": ["src/types/**/*"]
```

The diff may also remove explicit `src/types/not-found-messages.js` and `src/types/weather-types.js` entries from `files` because `include` now owns the whole `src/types/**` island. Existing non-`src/types` strict entries must remain.

- [ ] **Step 3: Inspect any `src/types/**` diffs**

Run: `git diff -- src/types/not-found-messages.js src/types/weather-types.js src/types/css.d.ts`

Expected: diffs contain only JSDoc/type declaration clarifications. String values, runtime logic, export names, and product data shapes are unchanged.

- [ ] **Step 4: Run strict verification**

Run: `npm run type-check:strict-report`

Expected: exits 0 and reports no strict diagnostics from `src/types/**`.

- [ ] **Step 5: Run changed-file lint**

Run: `npm run lint:changed`

Expected: exits 0. If it reports only pre-existing unrelated files, stop and report the exact output to the main agent.

- [ ] **Step 6: Run changed-file type check**

Run: `npm run type-check:changed`

Expected: exits 0. If it reports only pre-existing unrelated files, stop and report the exact output to the main agent.

- [ ] **Step 7: Run whitespace diff check**

Run: `git diff --check`

Expected: no output and exit 0.

- [ ] **Step 8: Prepare the concrete staging command**

Use only concrete paths that changed. Do not run `git add .`, `git add -A`, or `git add --all`.

If only the strict config changed:

```bash
git add tsconfig.strict.json
```

If the strict config and weather typedefs changed:

```bash
git add tsconfig.strict.json src/types/weather-types.js
```

If all approved files changed:

```bash
git add tsconfig.strict.json src/types/not-found-messages.js src/types/weather-types.js src/types/css.d.ts
```

- [ ] **Step 9: Prepare commit metadata without committing**

Recommended commit message:

```text
chore: expand strict src types island
```

Do not stage or commit from the implementation subagent unless the main agent explicitly delegates closeout. Final PR closeout still requires GitHub `ci` and `e2e` green before merge.
