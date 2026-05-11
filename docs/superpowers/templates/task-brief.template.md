# P1/P2 Task Brief

> Use for lightweight repo-changing work that does not need durable
> `specs/` artifacts. Keep this in the conversation, PR body, or scratchpad
> unless the user explicitly asks for a long-term repo doc.

## Task

- ID:
- Profile:
- Wave:
- Branch/worktree:
- Working directory:
- Status:

## Planner Output

- Dependency graph:
- Parallel waves:
- Owned files:
- Read-only context:
- Acceptance criteria:
- Verification plan:
- Final integration gate:

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

## Browser Evidence

- Required for UI task: <yes/no>
- Tool: <Chrome DevTools MCP / Codex Chrome plugin / Browser / not applicable>
- Target URL:
- Route or journey:
- Viewport or emulation:
- Screenshot artifact:
- Expected vs actual UI signal:
- Console and network findings:

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
