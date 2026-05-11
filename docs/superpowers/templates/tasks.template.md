# <Feature Name> Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/<feature>/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Main agent is coordinator only. Code and executable test changes belong to Engineer subagents.
- A task can become `completed` only after `review_passed` and coordinator
  state sync.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Parallel waves require completely disjoint owned files, one Reviewer per lane,
  and a final integration gate.
- Shared helpers, config, lockfiles, and workflow state must serialize or become
  a prerequisite shared-helper task.

## Tasks

### T001 - <Task Title>

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: <role>
- **Reviewer**: <role>
- **Commit checkpoint**: <none / phase commit name>

Scope:

- <what this task may change>

Non-scope:

- <what this task must not change>

Owned files:

- `<path>`

Read-only context:

- `<path>`

Dependencies:

- <none / task IDs / user decision>

Engineer instructions:

- <concrete implementation instruction>
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: <criterion>
- AC-T001.2: <criterion>

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `<command>` | <exit 0 and key output / no relevant errors> |

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- Acceptance criteria are covered by tests, docs evidence, or explicit
  rationale.
- Layer, testing, and workflow rules remain satisfied.
- Behavior or docs changes stay inside scope and non-scope is untouched.

Reviewer REJECT criteria:

- Diff touches non-owned files without prior coordinator approval.
- Verification is missing, stale, failed, or not the required command.
- Acceptance criteria are unmet or unsupported by evidence.
- Layer, testing, or workflow rules are violated.
- Behavior or docs changed outside scope or inside non-scope.

Evidence:

- Engineer report:
  - <files changed, commands, exit codes, risks>
- Reviewer report:
  - <review_passed/review_rejected/blocked, checked diff, commands, exit codes>
- Command output summary:
  - `<command>`: <short signal>
- Changed files summary:
  - `<path>`
    - <why changed>
