# Article Post Edit History Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/post-edit-history/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `specs/post-edit-history/handoff.md`, this file, and `specs/post-edit-history/status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer subagents, including code, docs, workflow docs, ADRs, `.codex/**`, scripts, and config.
- Planner subagent slices repo-changing work after the user-approved `spec.md`. Main validates Planner output and dispatches; it does not self-slice repo-changing work.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence is one command per entry. Do not combine commands with `&&` or `;`.
- New `status.json` state uses schemaVersion 3 and records `currentHead`, `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and `incidents`.
- Final summaries must not imply deployed Firestore/storage rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Current Workflow State

- Profile: P4 Full Feature/Program.
- Phase: `spec_approved_planner_next`.
- Active task: none.
- Active wave: none.
- Latest reviewer decision: `review_passed` for spec docs.
- Blocked: no.
- Next gate: Planner dispatch. User approved the spec and explicitly authorized implementation edits after Planner task contracts.
- Authorization boundary: `edit=true` after Planner task contracts; `commit=true` when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches; `push=false`, `pullRequest=false`, `ciWatch=false`, `merge=false`, `localMainSync=false`, `deployFirestoreRules=false`.
- Package-lock cleanup is complete; the worktree was clean before planning state update.
- Post-rebase state: branch `092-post-edit-history` was successfully rebased onto `origin/main` at `b1cdaee96618983d333d1b6da2a78c0312e3b7ba`; current HEAD is rewritten spec-approved commit `d5568aea71f9b146ead4c460a42b62d25b4040e3`.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Planner output must include dependency graph, execution order, parallel waves, owned files, read-only context, acceptance criteria, verification plan, and final integration gate.
- Same-wave tasks require completely disjoint owned files, one Reviewer per lane, and a final integration gate.
- Shared helpers, config, lockfiles, workflow state, security rules, schema, and release-state writes must serialize or become prerequisite tasks.
- Recommended maximum in one shared worktree: two to three Engineer/Reviewer pairs.

## Planner Output

Planner has not run. This section is intentionally pending.

- Dependency graph: pending Planner.
- Parallel waves: pending Planner.
- Final integration gate: pending Planner.

Planner must account for these known serialization constraints:

- `firestore.rules` is a shared rules surface and cannot be edited in parallel with other rules/schema work.
- Shared edit-history components/hooks/builders are prerequisites for resource adapters that consume them.
- Article post service/repo/rules changes must use `/posts/{postId}/history/{historyId}` and align on strict cross-validation of pre-edit `title` + `content`, timestamp, and parent `lastEditHistoryId` / `historyId` coupling.
- Article post history read policy is fixed for this spec: same read visibility as the active article post; history is unavailable when the parent post is soft-deleted or otherwise inaccessible.
- Workflow state files under `specs/post-edit-history/` are coordinator-owned after this spec slice.

## Tasks

No dispatchable implementation tasks exist yet. Planner is next and owns slicing.

Pending after Planner run:

- `PENDING-1`: Define shared edit-history core and adapter contract.
- `PENDING-2`: Implement article post strict atomic edit-history write path at `/posts/{postId}/history/{historyId}` and Firestore rules.
- `PENDING-3`: Wire article post `已編輯` affordance and history modal in list/detail UI.
- `PENDING-4`: Add focused tests and final integration verification.

## Draft Acceptance Criteria For Planner

- AC-P.1: Every dispatchable task records state, attempt, wave, Engineer, Reviewer, owned files, read-only context, dependencies, non-scope, acceptance criteria, verification commands, browser evidence requirement, authorization boundary, and Reviewer PASS/REJECT criteria.
- AC-P.2: Same-wave tasks have disjoint owned files.
- AC-P.3: Any task touching `firestore.rules`, shared helpers, workflow state, package files, or lockfiles is serialized.
- AC-P.4: Firestore rules deploy remains a separate release boundary with `deployFirestoreRules=false` until explicitly authorized.
- AC-P.5: Planner must use the fixed article post history path and read visibility defined by `spec.md`.

## Evidence

- Engineer report: Spec Engineer drafted initial P4 workflow docs, then fixed Reviewer `review_rejected` findings about fixed article history path, strict validation language, and read visibility policy.
- Reviewer report: `review_passed` for spec docs.
- Reconciliation: 2026-06-04T03:26:07Z; synchronized stale `spec.md` approval metadata with the existing approved Planner-next state after user said `approve spec，開始實作文章已編輯功能`.
- Post-rebase state sync: 2026-06-04T03:38:38Z; local spec commits were rewritten after remote commit `b1cdaee96618983d333d1b6da2a78c0312e3b7ba`. Current HEAD is `d5568aea71f9b146ead4c460a42b62d25b4040e3`; phase remains `spec_approved_planner_next`; active task and active wave remain none; Planner remains next.
- Command output summary:
  - `git status --short --branch`: exit 0; on `092-post-edit-history`; branch is ahead 2 of `origin/main`; modified files are `handoff.md`, `status.json`, and `tasks.md`.
  - `git rev-parse HEAD`: exit 0; `d5568aea71f9b146ead4c460a42b62d25b4040e3`.
  - `git rev-parse origin/main`: exit 0; `b1cdaee96618983d333d1b6da2a78c0312e3b7ba`.
  - `git diff --check`: exit 0; no whitespace errors.
  - `npm run workflow:check`: exit 0; 17 status file(s) valid and 17 status file(s) synced; `specs/post-edit-history/status.json` ok and sync ok.
- Changed files summary:
  - `specs/post-edit-history/tasks.md`: current task board and rebase evidence.
  - `specs/post-edit-history/handoff.md`: next-session brief and rebase evidence.
  - `specs/post-edit-history/status.json`: machine-readable v3 post-rebase state.
- Phase commits: `spec_approved` -> `d5568aea71f9b146ead4c460a42b62d25b4040e3`.
- Last verified commit: `d5568aea71f9b146ead4c460a42b62d25b4040e3`.
- Authorization: implementation edits may begin after Planner task contracts; commits are authorized when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches. Push, PR, CI watch, merge, local `main` sync, and rules deploy remain unauthorized.
- Rules deploy status: `required`, `changed=false`, no deploy evidence.
- Incidents: none.
- Next step: dispatch Planner before implementation.
