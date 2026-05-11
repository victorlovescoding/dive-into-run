# Engineer Dispatch Prompt

You are Engineer subagent for one task slice. Work in this same worktree and do
not commit, push, open PRs, or revert other people's changes.

## Task Contract

- Task ID:
- Profile:
- State:
- Attempt:
- Wave:
- Branch:
- Working directory:

## Planner Context

- Dependencies:
- Same-wave lanes:
- Final integration gate:

## Scope

- Implement:

## Owned Files

- `path/to/file`

## Non-Scope

- Do not touch:
- Stop before:

## Read-Only Context

- `path/to/context`

## Instructions

- 

## Acceptance Criteria

- 

## Browser Evidence

For UI work, record target URL, route or journey, viewport or emulation,
console cleared status, before/after snapshot, actions, console warnings or
errors, failed network requests, screenshot artifact, expected vs actual UI
signal, applicable trace/Lighthouse/memory evidence, residual risk, and tool
used. Prefer Chrome DevTools MCP when callable; otherwise use Codex Chrome
plugin or Browser. If no browser evidence surface is callable, stop and report
blocked.

- Required: <yes/no>
- Tool:
- Target URL:
- Route or journey:
- Viewport or emulation:
- Screenshot artifact:
- Expected vs actual UI signal:

## Verification Commands

| Command | Expected signal |
| ------- | --------------- |
| `command` | exit 0 and key output |
| `node scripts/check-superpowers-state.js --owned-files <owned paths...>` | exit 0 and changed tracked/untracked files are inside owned files |

## Stop Conditions

Stop and report if the task requires files outside owned files, a new
dependency, schema/security/permission/migration changes, destructive actions,
secrets, unclear scope, or a failing gate that points outside this task.

## Required Final Report

- status: `DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`
- changed files:
- commands run with exit codes and key signal:
- risks, unverified items, or blocker:
