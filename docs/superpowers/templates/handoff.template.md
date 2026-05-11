# <Feature Name> Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree:
- Branch:
- Current phase:
- Active task:
- Active wave:
- Latest reviewer decision:
- Last verified commit:
- Blocked: no
- Blocked reason:

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `specs/<feature>/handoff.md`
4. `specs/<feature>/tasks.md`
5. `specs/<feature>/status.json`
6. `specs/<feature>/spec.md` / `specs/<feature>/plan.md` as needed

## Next Action

<The next exact action for the coordinator or next subagent.>

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `<command>` | `<exit>` | `<short signal>` |

## Closeout Checklist

- [ ] `tasks.md` task states match `status.json`.
- [ ] Active task and active wave match `status.json`.
- [ ] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [ ] `lastVerification` has one entry per command.
- [ ] Changed files are intentionally in scope.
- [ ] Blockers are resolved or explicitly carried forward.

## Blockers

- <None / blocker with owner and required decision>

## Pitfalls

- <Known trap and how to avoid it>
