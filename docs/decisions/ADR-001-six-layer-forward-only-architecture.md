# ADR-001 Six-Layer Forward-Only Architecture

## Status

Accepted

## Date

2026-05-10

## Owner

Codex / repo maintainers

## Verification Status

Verified

## Verification Source

- `AGENTS.md` defines the six canonical layers and states dependency-cruiser enforces forward-only layer dependencies.
- `.dependency-cruiser.mjs` defines `CANONICAL_LAYER_PATTERNS`, `createLayerDirectionRules()`, and the mechanical forbidden rules for higher-layer imports.
- `docs/QUALITY_SCORE.md` tracks per-layer quality for `types/`, `config/`, `repo/`, `service/`, `runtime/`, and `ui/`.

## Supersedes

None

## Related

- `AGENTS.md`
- `.dependency-cruiser.mjs`
- `docs/QUALITY_SCORE.md`
- `docs/decisions/ADR-002-lib-compatibility-facade.md`
- `specs/037-gap-e-design-docs-adr/tasks.md`

## Context

This is a retrospective architecture record backed by current repo evidence. The repo already documents and mechanically checks a canonical layer model, but future agents need a durable ADR that separates the accepted layer contract from temporary session notes or historical migration context.

The accepted canonical order is:

```text
Types -> Config -> Repo -> Service -> Runtime -> UI
```

`AGENTS.md` names these layers as the canonical architecture. `.dependency-cruiser.mjs` encodes the same order in `createLayerDirectionRules()` by forbidding lower layers from runtime-importing higher layers. `docs/QUALITY_SCORE.md` uses the same layer names as the quality reporting surface.

## Decision

The durable application architecture is a six-layer forward-only model:

1. `src/types/` defines domain types and shared constants.
2. `src/config/` defines infrastructure configuration.
3. `src/repo/` defines data access adapters.
4. `src/service/` defines business logic, validation, and data transformations.
5. `src/runtime/` defines React hooks, providers, and use-cases.
6. `src/ui/` defines render-only screen components.

Runtime imports must move forward through that order only. A lower layer must not import a higher layer to reuse behavior. Move shared behavior down, pass values from the caller, or use JSDoc type-only imports when the dependency is only a type reference.

`dependency-cruiser` is the mechanical verification path for this decision. The authoritative executable gate is `.dependency-cruiser.mjs`, run through the repo's dependency-cruiser command. Documentary references are useful context, but the rule is only mechanically represented when dependency-cruiser can enforce it.

Future domain-first restructuring, such as replacing or materially reordering these layers around product domains, requires a new ADR. It must not be treated as an incidental refactor under this ADR.

## Consequences

- New production implementation should land in the canonical layer that owns its responsibility, not in a higher caller just because that caller currently needs it.
- Refactors that move logic across layers must preserve forward-only runtime imports.
- Existing compatibility or migration surfaces do not weaken the canonical layer order.
- The quality score matrix remains layer-aware, so architecture work should consider both dependency direction and the per-layer quality gaps recorded in `docs/QUALITY_SCORE.md`.
- A future architecture that prioritizes domain modules over this layer order is a different decision and needs explicit review.

## Agent Guidance

Before editing production code under `src/**`, check which canonical layer owns the behavior. If a dependency-cruiser layer rule fails, fix the direction of the dependency rather than suppressing the rule.

Avoid these patterns:

- Pulling service, runtime, or UI behavior into `src/types/`, `src/config/`, or `src/repo/`.
- Importing UI/runtime hooks from service or repo modules.
- Treating `src/app/` or `src/lib/` as a place to bypass layer ownership.
- Calling a domain-first restructuring "cleanup" without opening a new ADR.

## Verification

Run the dependency-cruiser gate after layer-affecting edits:

```bash
npm run depcruise
```

Also inspect the current evidence when updating this ADR:

```bash
rg -n "Types -> Config -> Repo -> Service -> Runtime -> UI|dependency-cruiser" AGENTS.md docs/decisions/ADR-001-six-layer-forward-only-architecture.md
rg -n "CANONICAL_LAYER_PATTERNS|createLayerDirectionRules|dependency-cruiser" .dependency-cruiser.mjs
rg -n "Per-Layer Quality|types/|config/|repo/|service/|runtime/|ui/" docs/QUALITY_SCORE.md
```
