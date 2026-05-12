# PR G: Strict Src Types Island Design

## Problem

The current strict TypeScript/JSDoc island is too small. Source type-safety debt
can hide outside `tsconfig.strict.json`, so report-only strict checks do not yet
cover enough of the shared source type layer.

This is a quality gate follow-up, not product behavior work.

## Goals

- Expand the strict island with approach 1: include `src/types/**` first.
- Improve type-safety signal for the shared type layer without changing runtime
  behavior.
- Keep the strict gate report-only while implementation gathers and fixes
  focused JSDoc/type issues.
- Preserve existing root TypeScript behavior for the rest of the app.

## Non-Goals

- No root strict TypeScript rollout.
- No root `tsconfig.json` changes.
- No runtime, service, repo, UI, or product behavior changes.
- No config, helper, runtime, or test mock source-first cleanup.
- No broad strict include pattern beyond the approved `src/types/**` island.
- No conversion of the strict report-only gate into a blocking gate.

## Scope

PR G expands `tsconfig.strict.json` so the strict island includes
`src/types/**`.

Later Engineer implementation may only fix JSDoc/type issues inside
`src/types/**` as needed to make the strict report useful. Allowed fixes are
small type-description changes that preserve the existing data shape and
runtime behavior.

Allowed small fixes later:

- JSDoc parameter, return, and property type corrections.
- Nullable or optional annotations that match the existing shape.
- Type-only imports or typedef references.
- Clearer union or literal types when they do not change behavior.

## Architecture

`tsconfig.strict.json` remains the strict island definition. It should include
`src/types/**` and keep the existing strict compiler behavior isolated from the
root project config.

The root `tsconfig.json` must not change. The strict report remains
non-blocking; this PR only widens report coverage for the source type layer.

Implementation must avoid product logic edits. If strict errors reveal a need
for runtime/service/repo changes, the task stops instead of expanding scope.

## Type Flow

`tsconfig.strict.json` runs the TypeScript compiler with JavaScript support,
JSDoc checking, and strict mode through `allowJs`, `checkJs`, and `strict`.

After the include expansion, `src/types/**` enters the strict island. Any fixes
should improve type descriptions for implicit `any`, nullability, optional
properties, typedef shapes, and literal/union precision. The intended flow is:

1. `tsconfig.strict.json` defines the strict island.
2. The compiler evaluates the island with `allowJs`, `checkJs`, and `strict`.
3. `src/types/**` files produce report-only strict diagnostics.
4. Engineer fixes JSDoc/type descriptions inside `src/types/**` only when
   needed.
5. Product behavior and exported type semantics remain unchanged.

## Agent Ownership

Work happens in:

- Worktree: `/private/tmp/dive-into-run-strict-src-types-island`
- Branch: `codex/strict-src-types-island`

The main agent coordinates only. Repo-changing implementation goes to an
Engineer subagent first. A Reviewer subagent checks the implementation before
completion.

Engineer ownership for this design is limited to the approved task-owned path.
Later implementation ownership should be limited to `tsconfig.strict.json` and
necessary files under `src/types/**`, unless a revised task contract explicitly
changes that boundary.

## Stop Conditions

Stop and return to the main agent if any of these occur:

- Runtime, service, repo, UI, or other large behavior changes appear necessary.
- Fixing diagnostics would require broad `any`, `@ts-ignore`, or
  `@ts-expect-error`.
- Exported type semantics would change instead of only clarifying current
  shapes.
- The include pattern is too broad and pulls in island-outside errors.
- `src/types/**` is absent or too small to provide meaningful strict coverage.
- Verification fails for reasons outside the approved island.

## Verification

Required implementation verification:

- `npm run type-check:strict-report`
- `npm run lint:changed`
- `npm run type-check:changed`

PR closeout requires required GitHub checks `ci` and `e2e` green before GitHub
merge.

Do not run local full E2E by default. Run local full E2E only if Reviewer
feedback or CI evidence shows it is needed.

## Closeout

Default closeout sequence:

1. Commit the feature branch.
2. Push `codex/strict-src-types-island`.
3. Open a PR.
4. Wait for required `ci` and `e2e` checks to pass.
5. Merge on GitHub.
6. Run `git switch main`.
7. Run `git pull --ff-only origin main`.
8. Remain on `main`.
