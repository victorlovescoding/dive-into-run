# ADR-005 Risk-Based Task Profiles

## Status

Accepted

## Date

2026-05-11

## Owner

Codex / repo maintainers

## Verification Status

Partially Verified

## Verification Source

- `AGENTS.md` routes work through `docs/superpowers/task-profiles.md` before
  the full feature lifecycle.
- `docs/superpowers/workflow.md` defines Task Profile Routing before Required
  Feature Artifacts.
- `docs/superpowers/task-profiles.md` defines Complexity, Risk, Profile
  selection, escalation, and non-negotiable safety rules.
- `docs/superpowers/task-profiles.md` states P1/P2/P3 reduce artifact weight,
  not Engineer-first or Reviewer-default ownership.
- `docs/decisions/INDEX.md` lists this ADR.

## Supersedes

None

## Related

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `docs/decisions/ADR-004-superpowers-first-agent-workflow.md`
- `docs/decisions/INDEX.md`

## Context

ADR-004 established Superpowers-first workflow and the durable five-file feature
artifact set. That full feature workflow is appropriate for new features,
multi-session work, and high-risk programs, but it is too heavy for many
bugfix, maintenance, refactor, and docs tasks.

The repo already moved toward phase-gated and conditional review behavior:
Engineer/Reviewer gates remain important, but the artifact and coordination
cost should match actual task risk.

Future agents need a durable rule that prevents two failure modes:

- Lightweight bugfixes becoming process-heavy by default.
- High-risk changes being treated as casual edits because the diff looks small.

## Decision

Adopt risk-based task profiles as the workflow routing layer before execution.

Agents must classify each task by:

- Complexity C0-C4.
- Risk R0-R4.
- Profile P0-P4 selected by `max(Complexity, Risk)`.

Any R4 task escalates directly to P4. If classification is uncertain, agents
must choose the higher profile or stop and ask.

P1/P2 work does not create the full feature five-file set by default. P3 work
uses an explicit task contract and keeps durable artifacts compact unless the
work crosses sessions or needs dispatcher continuity. For P1/P2/P3, lightweight
means lighter artifacts and ceremony, not main-agent self-editing: repo-changing
edits go first to an Engineer subagent. P4 work uses the full Superpowers
feature workflow and required durable artifact set.

This decision does not bypass safety gates. Branch isolation, owned-file and
non-scope boundaries, Reviewer subagent checks for non-read-only repo-changing
work, fresh verification, PR/CI, protected `main`, and stop conditions remain
required. Pure read-only exploration may use a read-only subagent and usually
needs no Reviewer.

## Consequences

- Low-risk work should spend less time on durable artifacts and reviewer
  ceremony, but still routes non-read-only edits through Engineer and Reviewer
  subagents by default.
- Normal bugfix and maintenance work still needs clear scope, focused
  verification, and regression coverage when behavior changes.
- High-risk fixes and refactors still require explicit task contracts and
  review gates.
- R4 and P4 work escalates to the full feature workflow even when the code diff
  appears small.
- Future agents must classify work before execution and record or report the
  profile when it affects workflow weight.
- Historical specs are not retroactively reclassified unless a future task
  reopens them.

## Agent Guidance

Before changing files:

1. Read `docs/superpowers/task-profiles.md`.
2. Classify Complexity and Risk.
3. Select the Profile.
4. For P1/P2/P3 repo-changing work, dispatch an Engineer before edits and a
   Reviewer before completion.
5. Use the selected workflow weight without weakening repo safety rules.

Stop and ask when the task needs schema, security rules, migration, data
deletion, permissions, secrets, new dependencies, irreversible operations, or
scope expansion not already approved.

## Verification

Documentary checks:

```bash
rg -n "task profile|risk-based|C0|R0|P0|ADR-005" AGENTS.md docs/superpowers docs/decisions
npm run workflow:validate
```

This decision is partially mechanically verified because current validation
checks workflow state shape, while profile classification remains an agent
judgment step.
