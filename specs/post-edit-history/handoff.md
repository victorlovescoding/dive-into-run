# Article Post Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history`
- Branch: `092-post-edit-history`
- Current head: `12b799e6d84f89e72da24a1f624b60b509d5e714`
- Remote head: `origin/main` at `64607617c9af07fbb8efc1d1a147964f7a589c50`
- Authorization boundary:
  - edit: true after Planner produces implementation task contracts; current coordinator state edits are limited to `specs/post-edit-history/spec.md`, `specs/post-edit-history/handoff.md`, `specs/post-edit-history/tasks.md`, and `specs/post-edit-history/status.json`
  - commit: true when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false
- Current phase: `spec_approved_planner_next`
- Active task: none
- Active wave: none
- Latest reviewer decision: `review_passed` for spec docs
- Last verified commit: `12b799e6d84f89e72da24a1f624b60b509d5e714`
- Phase commits: `spec_approved` -> `12b799e6d84f89e72da24a1f624b60b509d5e714`
- Rules deploy status: `required`; required later, changed=false, deployedCommit=null
- Incidents: none
- Blocked: no
- Blocked reason: none
- Latest reconciliation: 2026-06-04T03:26:07Z; synchronized `spec.md` approval metadata with existing `tasks.md`, `handoff.md`, and `status.json` state after user said `approve spec，開始實作文章已編輯功能`.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `specs/post-edit-history/handoff.md`
4. `specs/post-edit-history/tasks.md`
5. `specs/post-edit-history/status.json`
6. `specs/post-edit-history/spec.md`
7. `specs/post-edit-history/plan.md`

## Next Action

User approved the spec and explicitly authorized implementation to start after Planner task contracts. Coordinator should dispatch Planner next to produce implementation-ready task slices before any production code, tests, or rules edits.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git status --short --branch` | 0 | On `092-post-edit-history`; branch is ahead 1 and behind 1; modified files are `handoff.md`, `spec.md`, `status.json`, and `tasks.md`. |
| `git diff --check` | 0 | No whitespace errors. |
| `node -e "JSON.parse(require('fs').readFileSync('specs/post-edit-history/status.json', 'utf8')); console.log('status.json valid JSON')"` | 0 | `status.json valid JSON`. |
| `rg -n "Spec approved by: not\\syet" specs/post-edit-history` | 1 | No stale unapproved spec approval marker remains. |

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

- None for Planner dispatch.

## Latest Review State

- Reviewer returned `review_passed` for the spec docs.
- User approved the spec.
- Approval reconciliation completed on 2026-06-04: `spec.md` now matches `tasks.md`, `handoff.md`, and `status.json`.
- Planner dispatch is next; Planner owns slicing and implementation task contracts.
- Implementation edit phase is authorized after Planner task contracts.
- Commit is authorized when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches. Push, PR, CI watch, merge, local `main` sync, and rules deploy remain unauthorized.
- Package-lock cleanup is complete; the worktree was clean before this planning state update.

## Reviewer Attention

- Treat article post history path as fixed: `/posts/{postId}/history/{historyId}`.
- Treat article post history read policy as a user-reviewable spec decision, not an open question: same read visibility as the active article post; history is unavailable when the parent post is soft-deleted or otherwise inaccessible.
- Check that Planner preserves mandatory strict post-comment style validation: parent post update and history create cross-validate pre-edit `title` + `content`, timestamp, and parent `lastEditHistoryId` / `historyId` coupling.
- Check that `rulesDeployStatus.state=required` is acceptable at spec stage: no rules changed yet, but the feature is expected to require rules changes later.

## Pitfalls

- Do not treat this plan as implementation-ready; Planner has not sliced owned files or verification commands yet.
- Do not harden event comments in this feature.
- Do not claim deployed rules or deployed product behavior without rules deploy evidence.
- Do not push, create PR, watch CI, merge, sync local `main`, or deploy rules under the current authorization boundary.
