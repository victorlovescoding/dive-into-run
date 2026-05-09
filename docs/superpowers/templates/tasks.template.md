# <Feature Name> Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/<feature>/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Main agent is coordinator only. Code and executable test changes belong to Engineer subagents.
- A task can be checked only after Reviewer PASS.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Parallel waves require disjoint owned files and a final integration gate.

## Tasks

### T001 — <Task Title>

- **Status**: `[ ]`
- **Scope**: <one sentence>
- **Owned files**:
  - `<path>`
- **Dependencies**: none
- **Engineer**: <role>
- **Reviewer**: <role>
- **Commit checkpoint**: <none / phase commit name>

Acceptance criteria:

- AC-T001.1: <criterion>
- AC-T001.2: <criterion>

Verification commands:

```bash
<command>
```

Engineer evidence:

- <files changed, commands, exit codes, risks>

Reviewer evidence:

- <PASS/REJECT, checked diff, commands, exit codes>
