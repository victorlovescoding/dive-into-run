# Post Composer Draft Confirm Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-074-post-composer-draft-confirm`
- Branch: `074-post-composer-draft-confirm`
- Current head: `3f536fa42fb0e13c7425a6b6c651149889617d95` (`Add post composer draft confirm spec`)
- Remote head: `origin/main` at `08cc3b402c6b9d2c68d4c4986ae9c079a31592a0`
- Authorization boundary:
  - edit: yes, planning files only for current user authorization; implementation edits require later coordinator dispatch authorization
  - commit: no
  - push: no
  - pullRequest: no
  - ciWatch: no
  - merge: no
  - localMainSync: no
  - deployFirestoreRules: no
- Current phase: plan
- Active task: none
- Active wave: none
- Latest reviewer decision: none
- Last verified commit: none
- Phase commits:
  - spec: `3f536fa42fb0e13c7425a6b6c651149889617d95` (`Add post composer draft confirm spec`)
- Rules deploy status: `not_applicable`
- Incidents: none
- Blocked: no
- Blocked reason: none

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `docs/superpowers/task-contract.md`
5. `specs/074-post-composer-draft-confirm/handoff.md`
6. `specs/074-post-composer-draft-confirm/tasks.md`
7. `specs/074-post-composer-draft-confirm/status.json`
8. `specs/074-post-composer-draft-confirm/spec.md`
9. `specs/074-post-composer-draft-confirm/plan.md`

## Next Action

Coordinator should validate these planning files, then dispatch T001 to an Engineer subagent only after confirming implementation edit authorization. Do not dispatch T003 or T004 until T001 and T002 are completed and reviewed.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `sed -n '1,260p' AGENTS.md` | 0 | Confirmed startup contract, P4 artifact expectations, Engineer-first rule, one-command evidence rule, and authorization boundaries. |
| `sed -n '1,260p' docs/superpowers/workflow.md` | 0 | Confirmed P4 feature requires five-file artifact set under `specs/<feature>/`. |
| `sed -n '1,320p' docs/superpowers/task-profiles.md` | 0 | Confirmed new feature routes to P4, worktree required, rules deploy boundary separate. |
| `sed -n '1,320p' docs/superpowers/task-contract.md` | 0 | Confirmed task fields, lifecycle, status schema v3, and Reviewer gate. |
| `sed -n '1,260p' specs/074-post-composer-draft-confirm/spec.md` | 0 | Confirmed approved spec excludes schema, rules, server behavior, dependencies, and autosave. |
| `rg --files -g '*test*' -g '*spec*' -g '!specs/**'` | 0 | Found Vitest configs but no existing `tests/` directory or source tests in this checkout. |
| `nl -ba src/components/ComposeModal.jsx | sed -n '1,180p'` | 0 | Confirmed X/backdrop/Escape close handling is centralized in the component surface for planning. |
| `nl -ba src/runtime/hooks/usePostsPageRuntime.js | sed -n '140,350p'` | 0 | Confirmed posts feed open/submit/reset surfaces and failure-close risk. |
| `nl -ba src/runtime/hooks/usePostDetailRuntime.js | sed -n '160,230p'` | 0 | Confirmed detail edit open/submit/reset surfaces and failure-close risk. |
| `node scripts/validate-workflow-state.js specs/074-post-composer-draft-confirm/status.json` | 0 | Feature 074 status file validates against schemaVersion 3. |
| `node scripts/check-superpowers-state.js specs/074-post-composer-draft-confirm/status.json` | 0 | Feature 074 status file is valid and synced. |
| `git diff --check` | 0 | No whitespace errors reported by Git diff check. |
| `git status --short --untracked-files=all` | 0 | Four untracked owned planning files are present for feature 074. |

## Closeout Checklist

- [ ] `tasks.md` task states match `status.json`.
- [ ] Active task and active wave match `status.json`.
- [ ] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [ ] `lastVerification` has one entry per command.
- [ ] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits` reflect the latest verified state.
- [ ] `authorizationBoundary.deployFirestoreRules` is recorded and treated as separate from `edit`, `commit`, `push`, `pullRequest`, `ciWatch`, `merge`, and `localMainSync`.
- [ ] `rulesDeployStatus` matches the rules release state.
- [ ] Final summary does not imply deployed rules/product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
- [ ] PR/CI/merge notes explicitly carry release risk if rules are in a non-deployed state such as `required`, `pending`, or `blocked`.
- [ ] Open `incidents` are resolved, mitigated with an explicit carry-forward, or block closeout.
- [ ] Changed files are intentionally in scope.
- [ ] Blockers are resolved or explicitly carried forward.

## Blockers

- None.

## Pitfalls

- Do not let `ComposeModal` read or write localStorage; it should only render and delegate events.
- Do not keep the current failed-submit behavior. Both feed and detail runtimes currently reset/close after catch, but the spec requires failed publish/update to keep the composer open and preserve drafts.
- Do not use `window.confirm`; the spec requires a custom centered confirmation dialog.
- Do not remove all user drafts. Remove only the current composer target key.
- Do not treat local browser verification as deployed product behavior.
- Do not run closeout boundaries that are not authorized: commit, push, PR, CI watch, merge, local main sync, and rules deploy are currently unauthorized.
