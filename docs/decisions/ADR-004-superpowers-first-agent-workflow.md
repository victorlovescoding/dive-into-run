# ADR-004 Superpowers-First Agent Workflow

## Status

Accepted

## Date

2026-05-10

## Owner

Codex / repo maintainers

## Verification Status

Partially Verified

## Verification Source

- `AGENTS.md` defines the Development Lifecycle as Superpowers-first workflow.
- `AGENTS.md` states `speckit.*` is legacy workflow and is not used by default unless the user explicitly requests it.
- `docs/superpowers/workflow.md` defines Superpowers as the repo workflow language and `specs/<feature>/...` as the durable state backend.
- `docs/superpowers/workflow.md` requires `spec.md`, `plan.md`, `tasks.md`, `handoff.md`, and `status.json` under each workflow feature.
- `specs/037-gap-e-design-docs-adr/tasks.md` records that `status.json` adoption is still a known workflow gap to acknowledge in this ADR.

## Supersedes

None

## Related

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/templates/`
- `specs/037-gap-e-design-docs-adr/tasks.md`
- `docs/decisions/INDEX.md`

## Context

The repo uses multiple planning and agent-workflow conventions over time. Future agents need a single durable record for the current default workflow so new feature work does not drift back to legacy `speckit.*` behavior or transcript-only state.

This is a retrospective record backed by current repo documents. It does not claim every historical spec already follows the current workflow.

## Decision

Use Superpowers-first workflow as the default agent workflow for this repo.

Superpowers-first supersedes legacy `speckit.*` by default. Agents should use `speckit.*` only when the user explicitly asks for that legacy workflow.

For new Superpowers-first feature work, the intended durable state set lives under `specs/<feature>/`:

- `spec.md`
- `plan.md`
- `tasks.md`
- `handoff.md`
- `status.json`

`spec.md` records product intent, `plan.md` records implementation strategy, `tasks.md` records task slices and Engineer/Reviewer gates, `handoff.md` records session resume state, and `status.json` records machine-readable dispatcher state.

`status.json` adoption is still a known workflow gap: current workflow docs require it, and this feature uses it, but agents must not assume every historical `specs/<feature>/` directory already has a complete or current `status.json`.

## Consequences

- New long-running feature work must keep state on disk instead of relying on chat transcript continuity.
- The main agent should coordinate, dispatch, update workflow state, and verify evidence rather than directly editing production code during implementation task slices.
- Engineer and Reviewer responsibilities must be recorded in `tasks.md`.
- Resume flows should read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, `tasks.md`, and `status.json` before continuing.
- Historical specs may be incomplete, stale, or built under older conventions; agents must inspect the actual files before treating them as compliant.

## Agent Guidance

Before starting or resuming substantial feature work:

- Read `AGENTS.md` and `docs/superpowers/workflow.md`.
- Find the feature directory under `specs/<feature>/`.
- Read `spec.md`, `plan.md`, `tasks.md`, `handoff.md`, and `status.json` when present.
- If any required state file is missing, stale, or contradictory, treat that as a workflow gap to reconcile rather than inventing state from memory.
- Do not default to `speckit.*`.
- Do not claim historical compliance without checking the feature directory.

## Verification

Documentary checks:

```bash
rg -n "Superpowers-first|speckit|spec.md|plan.md|tasks.md|handoff.md|status.json" AGENTS.md docs/superpowers/workflow.md specs/037-gap-e-design-docs-adr/tasks.md
```

This decision is only partially mechanically verified because the workflow documents define the intended durable state set, but repository-wide `status.json` adoption across all historical specs is not guaranteed.
