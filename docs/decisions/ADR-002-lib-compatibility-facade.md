# ADR-002 src/lib Compatibility Facade

## Status

Accepted

## Date

2026-05-10

## Owner

Codex / repo maintainers

## Verification Status

Verified

## Verification Source

- `AGENTS.md` defines `src/lib/` as a compatibility facade that re-exports to canonical layers.
- `.dependency-cruiser.mjs` defines the `canonical-no-import-lib` rule, which blocks canonical layers from runtime-importing `src/lib/**`.
- `docs/QUALITY_SCORE.md` tracks `lib/` separately from the canonical six-layer quality rows, with a known JSDoc gap for the facade layer.

## Supersedes

None

## Related

- `AGENTS.md`
- `.dependency-cruiser.mjs`
- `docs/QUALITY_SCORE.md`
- `docs/decisions/ADR-001-six-layer-forward-only-architecture.md`
- `specs/037-gap-e-design-docs-adr/tasks.md`

## Context

This is a retrospective architecture record backed by current repo evidence. `src/lib` exists in the repo and is still visible to consumers, but the canonical implementation homes are the six layers defined in ADR-001.

The ambiguity this ADR resolves is whether `src/lib` is still a general implementation layer. It is not. It is a compatibility facade and limited utility surface, not the canonical home for new production implementation.

## Decision

`src/lib/` is retained as a compatibility facade and limited utility surface. Its main role is to keep older import paths working while implementation moves to canonical layers such as `src/repo/`, `src/service/`, `src/runtime/`, or `src/config/`.

New implementation must be placed in the canonical layer that owns the behavior. A `src/lib/**` file may re-export, adapt, or provide narrow compatibility for existing callers, but it must not become the durable owner of domain data access, business logic, runtime orchestration, or render behavior.

Canonical layers must not runtime-import `src/lib/**`. `.dependency-cruiser.mjs` enforces this through the `canonical-no-import-lib` rule, whose message directs agents to import from the canonical home instead. Type-only JSDoc imports are exempt by the shared dependency-type filter, but runtime edges are forbidden.

## Consequences

- Existing consumers may keep using facade imports until a scoped migration removes them.
- New canonical code should import directly from canonical homes, not through `src/lib`.
- Moving logic from `src/lib` into canonical layers may require leaving a small re-export facade behind for compatibility.
- `src/lib` documentation and JSDoc quality still matter because downstream consumers may read or import facade files during migration.
- A broad removal of `src/lib` or a change that makes it canonical again requires a new ADR or an explicit update to this ADR.

## Agent Guidance

When adding or moving production behavior, first identify the canonical owner:

- data access -> `src/repo/`
- business rules and transformations -> `src/service/`
- hooks, providers, and client use-cases -> `src/runtime/`
- render-only screens -> `src/ui/`
- infrastructure config -> `src/config/`
- domain declarations and constants -> `src/types/`

Use `src/lib` only when preserving an existing public import path or adding a small utility that does not belong to a canonical domain layer. If a canonical file imports from `src/lib`, find the facade's re-export source and import that canonical target instead.

Avoid these patterns:

- Adding new domain implementation under `src/lib`.
- Routing canonical layer imports through `src/lib` for convenience.
- Treating a passing unit test as proof that a `src/lib` runtime edge is acceptable.
- Suppressing or bypassing `canonical-no-import-lib`.

## Verification

Run the dependency-cruiser gate after edits that touch `src/lib` or canonical imports:

```bash
npm run depcruise
```

Also inspect the executable rule and documentary references when updating this ADR:

```bash
rg -n "src/lib|compatibility facade" AGENTS.md docs/decisions/ADR-002-lib-compatibility-facade.md
rg -n "canonical-no-import-lib|src/lib" .dependency-cruiser.mjs
rg -n "lib/|Layer-Level Known Gaps" docs/QUALITY_SCORE.md
```
