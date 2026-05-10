# ADR-003 JSDoc + `checkJs` Over Application TypeScript

## Status

Accepted

## Date

2026-05-10

## Owner

Codex / repo maintainers

## Verification Status

Verified

## Verification Source

- `AGENTS.md` states the app is pure JavaScript with JSDoc type safety and `checkJs: true`.
- `AGENTS.md` documents `npm run type-check` as TypeScript-powered JSDoc checking via `tsc --noEmit`.
- `tsconfig.json` enables `allowJs`, `checkJs`, and `noEmit`.
- `.codex/rules/code-style.md` defines JSDoc patterns for `checkJs: true`.
- `.codex/rules/coding-rules.md` requires meaningful JSDoc on new or modified exported functions.

## Supersedes

None

## Related

- `AGENTS.md`
- `tsconfig.json`
- `.codex/rules/code-style.md`
- `.codex/rules/coding-rules.md`
- `docs/decisions/INDEX.md`

## Context

This repo uses JavaScript source files while still requiring type feedback for application, spec, and test code. Future agents need a durable decision record so they do not introduce application TypeScript files or remove the JSDoc discipline when adding or refactoring code.

The current repo evidence points to a JavaScript + JSDoc strategy, not an application TypeScript migration.

## Decision

Use JavaScript with meaningful JSDoc and TypeScript `checkJs` for application type checking.

The repo type strategy is:

- Source, spec, and test code remain JavaScript / JSX.
- JSDoc carries type intent for functions, components, typedefs, imports, and casts.
- `tsconfig.json` keeps `allowJs: true`, `checkJs: true`, and `noEmit: true`.
- The type-check gate runs TypeScript in no-emit mode through `tsc --noEmit`.
- Do not convert application code to TypeScript by default.

## Consequences

- Type information must be maintained in JSDoc near the JavaScript implementation.
- New or modified exported functions need meaningful JSDoc that explains intent and parameters.
- Type-only references through JSDoc imports are allowed and do not violate forward-only runtime import rules.
- TypeScript remains a checker for JavaScript, not the implementation language for app code.
- A future application TypeScript migration would require a new accepted ADR or an update that supersedes this ADR.

## Agent Guidance

Before editing source, specs, or tests, check `AGENTS.md`, `tsconfig.json`, `.codex/rules/code-style.md`, and `.codex/rules/coding-rules.md`.

When adding or changing typed behavior:

- Prefer `.js` / `.jsx` files with JSDoc over new `.ts` / `.tsx` application files.
- Use lowercase `{object}` in typedefs.
- Add descriptions for `@param` and `@property` entries.
- Use `@typedef`, `@param {import(...)}`, and local casts where they clarify the contract.
- Do not use `@ts-ignore`; use an explained `@ts-expect-error` only when there is no cleaner option.

## Verification

Documentary and mechanical checks:

```bash
rg -n "checkJs|tsc --noEmit|JSDoc|pure JavaScript" AGENTS.md tsconfig.json .codex/rules/code-style.md .codex/rules/coding-rules.md
npm run type-check
```

The file-level decision can be revalidated by confirming `tsconfig.json` still has `allowJs`, `checkJs`, and `noEmit` enabled, and that repo guidance still points agents to JSDoc rather than application TypeScript.
