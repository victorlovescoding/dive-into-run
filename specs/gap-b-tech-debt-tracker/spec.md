# Gap B Tech-Debt Tracker Spec

## Summary

Create and maintain the formal workflow artifacts for Gap B and the durable technical-debt tracker for this repo.

The tracker must make known debt discoverable to future agents, reviewers, and maintainers without relying on scattered handoff notes, old review files, project-health reports, or conversation memory.

## User Scenarios

- As a future agent starting a refactor, I can find known technical debt from one durable entry point before deciding what to clean up opportunistically.
- As a reviewer, I can record acceptable-but-not-ideal findings in a persistent place instead of leaving them only in a review comment or session handoff.
- As the repo owner, I can distinguish long-lived product or architecture debt from immediate session state and recurring agent-operation gotchas.
- As a coordinator resuming this feature, I can read the Superpowers artifacts and dispatch docs-only tasks without touching production code or executable tests.

## Requirements

- R1: The formal execution artifacts must exist under `specs/gap-b-tech-debt-tracker/`.
- R2: The future tracker must be a versioned repo document and a single discoverable entry point for active and resolved technical debt.
- R3: The future tracker must preserve each debt item's severity, domain, description, origin, status, and enough evidence to let a later agent verify it.
- R4: The seed inventory must use existing evidence sources, including Gap B source analysis, quality-score known gaps, relevant handoffs, code-review deferred items, and project memory entries.
- R5: Session-local state must remain in feature handoff files; recurring cross-feature agent pitfalls belong in memory; mechanically enforceable rules should become lint, test, script, or CI checks instead of tracker-only prose.
- R6: This workflow must not plan production code changes or executable test changes.
- R7: Future updates must be reviewer-gated before a task is marked complete.

## Success Criteria

- SC1: `spec.md`, `plan.md`, `tasks.md`, `handoff.md`, and `status.json` are present and internally consistent.
- SC2: `status.json` is valid JSON and exposes dispatcher-ready state.
- SC3: `tasks.md` contains Engineer and Reviewer roles, owned files, dependencies, acceptance criteria, verification commands, commit checkpoints, and evidence sections for every task.
- SC4: The future execution path is docs-only and limits writes to `docs/TECH_DEBT.md` plus this feature's status artifacts unless the user explicitly expands scope.
- SC5: The handoff tells the next session exactly what to read, where the ignored Gap B source lives, what is verified, and which pitfalls to avoid.

## Out Of Scope

- Production code changes.
- Executable unit, integration, server, or E2E test changes.
- New dependencies, scripts, CI jobs, hooks, or branch-protection changes.
- Moving or deleting project-health reports, handoff files, memory files, or review files.
- Solving the listed debt items during tracker creation.

## User Authorization

- Spec approved by user on 2026-05-10.
- One-time automated execution authorization: yes on 2026-05-10.
