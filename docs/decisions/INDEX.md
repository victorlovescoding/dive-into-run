# Architecture Decision Records

This directory records durable cross-feature architecture and workflow decisions for this repo.

Use ADRs for decisions that future agents must preserve across features. Do not use ADRs for session state, task progress, handoff notes, or tech debt tracking. Keep session state in `specs/<feature>/handoff.md` / `status.json`; keep debt tracking outside ADRs.

## ADR List

| ADR | Decision | Status | Verification Status |
| --- | -------- | ------ | ------------------- |
| ADR-001 | Six-layer forward-only architecture | Accepted | Verified |
| ADR-002 | `src/lib` compatibility facade | Accepted | Verified |
| ADR-003 | JSDoc + `checkJs` over application TypeScript | Accepted | Verified |
| ADR-004 | Superpowers-first agent workflow | Accepted | Partially Verified |

## When To Add Or Update ADRs

Add an ADR when a decision:

- Applies across multiple features or long-lived repo workflows.
- Changes architecture, layer boundaries, testing strategy, agent workflow, or documentation governance.
- Creates a rule future Engineers and Reviewers must follow.

Update an ADR when:

- The decision changes, is superseded, or gains an important exception.
- The verification source changes, such as a new lint rule, dependency-cruiser rule, CI gate, or canonical doc.
- A planned ADR is accepted or rejected.

Do not update ADRs just to record a session result, temporary blocker, task checklist, or known tech debt. Use the feature task board, handoff, status file, or dedicated debt tracker instead.
