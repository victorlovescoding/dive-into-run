# <Feature Name> Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree:
- Branch:
- Current head:
- Remote head:
- Authorization boundary:
  - edit:
  - commit:
  - push:
  - pullRequest:
  - ciWatch:
  - merge:
  - localMainSync:
  - deployFirestoreRules:
- Current phase:
- Active task:
- Active wave:
- Latest reviewer decision:
- Last verified commit:
- Phase commits:
- Rules deploy status:
- Incidents:
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
- [ ] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits`
      reflect the latest verified state.
- [ ] `authorizationBoundary.deployFirestoreRules` is recorded and treated as
      separate from `edit`, `commit`, `push`, `pullRequest`, `ciWatch`,
      `merge`, and `localMainSync`.
- [ ] `rulesDeployStatus` matches the rules release state.
- [ ] Final summary does not imply deployed rules/product behavior unless
      `rulesDeployStatus.state` is `deployed` with deploy evidence.
- [ ] PR/CI/merge notes explicitly carry release risk if rules are in a
      non-deployed state such as `required`, `pending`, or `blocked`.
- [ ] Open `incidents` are resolved, mitigated with an explicit carry-forward,
      or block closeout.
- [ ] Changed files are intentionally in scope.
- [ ] Blockers are resolved or explicitly carried forward.

## Blockers

- <None / blocker with owner and required decision>

## Pitfalls

- <Known trap and how to avoid it>
