# P1/P2 Task Brief

> Use for lightweight repo-changing work that does not need durable
> `specs/` artifacts. Keep this in the conversation, PR body, or scratchpad
> unless the user explicitly asks for a long-term repo doc.

## Task

- ID:
- Profile:
- Branch/worktree:
- Working directory:
- Status:

## Scope

- Allowed change:
- User-visible or workflow outcome:

## Owned Files

- `path/to/file`

## Non-Scope

- Do not modify:
- Stop before:

## Verification

| Command | Expected signal |
| ------- | --------------- |
| `command` | exit 0 and key output |
| `node scripts/check-superpowers-state.js --owned-files <owned paths...>` | exit 0 and changed tracked/untracked files are inside owned files |

## Reviewer Criteria

PASS when:

- Diff only touches owned files.
- Scope and acceptance criteria are met.
- Verification evidence is fresh and matches expected signal.

REJECT when:

- Diff touches non-owned files.
- Verification is missing, stale, or failing.
- Behavior/docs drift outside scope.

## Final Evidence

- Changed files:
- Commands run with exit codes:
- Key signal:
- Risks or unverified items:
