# Risk-Based Workflow Profiles

> Last-Verified: 2026-05-11

This document routes work into the lightest Superpowers workflow profile that
still preserves branch isolation, owned-file discipline, fresh verification,
and PR/CI closeout.

Use this before execution for bugfix, maintenance, refactor, docs, and feature
work. If classification is unclear, choose the higher profile or stop and ask.

## Classification

Classify every task on two axes:

- Complexity: how broad the implementation surface is.
- Risk: how costly the failure mode is.

Profile selection is `max(Complexity, Risk)`.

Any R4 task escalates directly to P4 even when implementation complexity looks
small.

## Complexity

| Level | Meaning |
| ----- | ------- |
| C0 | Read-only inspection, no repo change. |
| C1 | Single-file change or one small function/component. |
| C2 | Same domain or same layer, usually 2-5 files. |
| C3 | Cross-layer change, shared helper/config/test architecture, or multiple domains. |
| C4 | New feature, long-running work, multi-session work, or multi-task program. |

## Risk

| Level | Meaning |
| ----- | ------- |
| R0 | No runtime risk: docs-only, read-only, formatting with no behavior change. |
| R1 | Low-risk UI, copy, style, or non-core behavior. |
| R2 | Normal product behavior: hook, service, repo logic, or regression coverage needed. |
| R3 | Auth, Firebase, server behavior, E2E flow, race condition, flaky test, shared infra, or data-flow change. |
| R4 | Schema, security rules, migration, data deletion, permissions, secrets, new dependency, or irreversible operation. |

## Profiles

| Profile | Name | Default workflow |
| ------- | ---- | ---------------- |
| P0 | Read-only | Inspect, answer, or report. No edits. |
| P1 | Quick Fix | Narrow edit, focused verification, concise final evidence. |
| P2 | Standard Bugfix/Maintenance | Focused plan in conversation or task brief, targeted test/verification, optional reviewer based on risk. |
| P3 | High-risk Fix/Refactor | Explicit task contract, owned files, targeted Engineer/Reviewer pass, compact durable artifact only when work crosses sessions. |
| P4 | Full Feature/Program | Full Superpowers feature workflow and durable five-file artifact set under `specs/<feature>/`. |

P1 and P2 do not create the full `spec.md`, `plan.md`, `tasks.md`,
`handoff.md`, and `status.json` set by default. They still need clear scope,
owned files, and fresh verification evidence.

P3 should keep durable artifacts compact. Create or update a durable handoff,
task note, or status artifact only when the task spans sessions, needs
dispatcher continuity, or would otherwise depend on transcript memory.

P4 uses the complete feature workflow and the required five-file artifact set.

## Non-Negotiables

Lightweight profiles do not bypass repo safety rules:

- Work must stay on a branch, never direct-to-`main`.
- Respect owned files, non-scope, and user changes.
- Keep branch/PR/CI closeout expectations from `AGENTS.md`.
- Run fresh verification before claiming completion.
- Stop on unclear scope, contradictory docs, forbidden scope expansion, or
  destructive/irreversible operations.

## Scenario Examples

| Scenario | Classification | Profile | Notes |
| -------- | -------------- | ------- | ----- |
| Fix a typo or update docs wording | C1/R0 | P1 | No full feature artifact set; verify with focused search or docs check. |
| Single-file UI display bug | C1/R1 | P1 | Target the component and run the smallest relevant UI/unit check when available. |
| Service regression with coverage | C2/R2 | P2 | Add or update focused regression coverage; no automatic feature five-file set. |
| Firebase listener flaky behavior | C3/R3 | P3 | Needs explicit task contract, Engineer/Reviewer gate, and targeted emulator or E2E evidence. |
| New product feature | C4/R2 or higher | P4 | New features default to full feature workflow and durable artifacts. |

If a task mentions schema, rules, migration, permissions, secrets, dependency
changes, data deletion, or any irreversible operation, classify it R4 and route
to P4 before implementation.
