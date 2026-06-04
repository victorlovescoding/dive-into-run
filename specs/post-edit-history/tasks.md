# Article Post Edit History Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/post-edit-history/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `specs/post-edit-history/handoff.md`, this file, and `specs/post-edit-history/status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer subagents, including code, docs, workflow docs, ADRs, `.codex/**`, scripts, and config.
- Planner has sliced this P4 feature into serialized Engineer/Reviewer task contracts. Main validates and dispatches; it does not implement.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence is one command per entry. Do not combine commands with `&&` or `;`.
- Final summaries must not imply deployed Firestore/storage rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Current Workflow State

- Profile: P4 Full Feature/Program.
- Phase: `implementation_ready`.
- Active task: `T002` after `T001` completion; do not dispatch until the `shared_core` commit checkpoint is created and branch-behind state is handled.
- Active wave: `wave-2`.
- Latest reviewer decision: `review_passed` for `T001` shared edit-history core and comment compatibility.
- Blocked: no.
- Next gate: commit `shared_core` checkpoint, then handle branch behind `origin/main` by 1 if current status still confirms it before dispatching `T002`.
- Authorization boundary: `edit=true`, `commit=true` after Engineer + Reviewer + fresh verification for reviewed implementation batches; `push=false`, `pullRequest=false`, `ciWatch=false`, `merge=false`, `localMainSync=false`, `deployFirestoreRules=false`.
- Branch/worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history` on `092-post-edit-history`, current HEAD `9025466aa75b19f3b24737acad5dd5c62126474e`, tracking `origin/main` at `b1cdaee96618983d333d1b6da2a78c0312e3b7ba`; `git status --short --branch` currently reports branch ahead 4 and behind 1.
- Rules deploy status: `required`, currently `changed=false`; T002 is expected to change `firestore.rules`, but deploy remains unauthorized.
- Incidents: none.
- Planning evidence:
  - Planner report: Produced serialized T001-T004 implementation task contracts; no production code, tests, rules, package files, config, or lockfiles modified.
  - T001 Engineer report: Implemented shared edit-history core, generic modal/runtime primitives, and comment compatibility within T001 owned files.
  - T001 Reviewer report: `review_passed` after a stale-load issue was fixed.
  - Command output summary:
    - `npx vitest run src/runtime/hooks/useEditHistoryModal.test.jsx src/components/EditHistoryModal.test.jsx src/components/CommentHistoryModal.test.jsx`: exit 0; 3 files / 11 tests passed.
    - `npx vitest run src/runtime/hooks/usePostComments.test.jsx src/ui/posts/PostDetailScreen.test.jsx`: exit 0; 2 files / 14 tests passed.
    - `npx vitest run src/runtime/hooks/useCommentMutations.test.jsx`: exit 0; 1 file / 4 tests passed.
    - `git status --short --branch`: exit 0; on `092-post-edit-history`; branch ahead 4 and behind 1 of `origin/main`; dirty files are T001 owned files plus workflow state files.
    - `git diff --check`: exit 0; no whitespace errors.
    - `npm run workflow:check`: exit 0; 17 status file(s) valid and 17 status file(s) synced; `specs/post-edit-history/status.json` ok and sync ok.
  - Changed files summary:
    - `specs/post-edit-history/plan.md`: decision-complete architecture, file responsibilities, verification strategy, and task slices.
    - `specs/post-edit-history/tasks.md`: dispatchable task contracts and dependency graph.
    - `specs/post-edit-history/handoff.md`: next-session state and first dispatchable task.
    - `specs/post-edit-history/status.json`: v3 machine-readable planning state.

## Dependency Graph

```text
T001 shared core
  -> T002 article persistence/rules/cleanup
      -> T003 post list/detail UI wiring
          -> T004 final integration gate/workflow state
```

## Parallel Waves

- Serialized execution is safer than parallel execution.
- `wave-1`: `T001` only. Shared helpers/components/hooks are prerequisites.
- `wave-2`: `T002` only. Firestore rules and account-deletion cleanup are shared high-risk surfaces.
- `wave-3`: `T003` only. UI wiring depends on T001 shared components and T002 use-case/repo contracts.
- `wave-4`: `T004` only. Final integration gate and workflow-state sync after all implementation tasks.
- No same-wave owned files overlap because every wave has exactly one task.

## Final Integration Gate

- Run after `T001`, `T002`, and `T003` are `completed`.
- Required commands:
  - `git status --short --branch`
  - `git diff --check`
  - `npm run lint:changed`
  - `npm run type-check:changed`
  - `npm run workflow:check`
  - `firebase emulators:exec --only firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"`
  - `npx vitest run src/runtime/hooks/useEditHistoryModal.test.jsx src/components/EditHistoryModal.test.jsx src/components/CommentHistoryModal.test.jsx src/service/post-service.test.js src/runtime/client/use-cases/post-use-cases.test.js src/runtime/hooks/usePostsPageRuntime.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx src/ui/posts/PostsPageScreen.test.jsx src/ui/posts/PostDetailScreen.test.jsx`
- Browser evidence is required for `/posts` and `/posts/{postId}` article history affordance/modal, plus comment history regression.

## Tasks

### T001 - Shared Edit-History Core And Comment Compatibility

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Shared Core Engineer
- **Reviewer**: Shared Core Reviewer
- **Commit checkpoint**: `shared_core` after Reviewer PASS and fresh verification
- **Last verified commit**: working tree at `9025466aa75b19f3b24737acad5dd5c62126474e` plus uncommitted T001 implementation; commit checkpoint `shared_core` pending
- **Authorization boundary**: edit=yes, commit=yes after Reviewer PASS and fresh verification, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required; changed=false unless this task unexpectedly touches rules, which is not authorized
- **Incidents**: none

Scope:

- Create shared edit-history UI/runtime primitives.
- Preserve existing post-comment history behavior and `CommentHistoryModal` import API.
- Keep `buildCommentEditHistoryPayload` behavior stable while extracting only generic builder logic that comments and article posts can share later.

Non-scope:

- Do not edit article post persistence, Firestore rules, account-deletion cleanup, post list/detail article wiring, event-comment rules, package files, config, or lockfiles.
- Do not touch `src/runtime/hooks/useCommentMutations.js`; origin/main now depends on `handleSubmit => Promise<boolean>`.
- Do not change post-comment data shape or event-comment data shape.

Owned files:

- `src/service/comment-edit-history-service.js`
- `src/runtime/hooks/useEditHistoryModal.js`
- `src/runtime/hooks/useEditHistoryModal.test.jsx`
- `src/components/EditedAffordance.jsx`
- `src/components/EditHistoryModal.jsx`
- `src/components/EditHistoryModal.test.jsx`
- `src/components/CommentHistoryModal.jsx`
- `src/components/CommentHistoryModal.module.css`
- `src/components/CommentHistoryModal.test.jsx`
- `src/components/CommentCard.jsx`
- `src/components/CommentCard.module.css`

Read-only context:

- `specs/post-edit-history/spec.md`
- `specs/post-edit-history/plan.md`
- `src/runtime/hooks/usePostComments.js`
- `src/runtime/hooks/usePostComments.test.jsx`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/ui/posts/PostDetailScreen.jsx`
- `src/ui/posts/PostDetailScreen.test.jsx`
- `src/service/event-comment-service.js`
- `src/runtime/hooks/useCommentMutations.js`
- `src/runtime/hooks/useCommentMutations.test.jsx`

Dependencies:

- none

Browser evidence:

- not applicable for this non-wiring slice; component/runtime tests are required. T003 owns browser evidence.

Engineer instructions:

- Add `EditedAffordance` with the same visible `已編輯` text and accessible label semantics currently used by comments.
- Add `EditHistoryModal` that accepts current entry data plus previous history entries and can render title/content entries for article posts later.
- Keep `CommentHistoryModal` as a compatibility wrapper accepting `comment`, `history`, `historyError`, and `onClose`; its existing newest-first display and current-version display must remain.
- Add `useEditHistoryModal` for generic open/load/error/close/reset state and preserve the current comment failure behavior: failed fetch keeps the modal open and records the error.
- If `comment-edit-history-service.js` is generalized, keep `buildCommentEditHistoryPayload` exports and validation behavior backward compatible.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: Existing comment cards still show `已編輯` only when `comment.isEdited` is truthy and still call `onViewHistory(comment)`.
- AC-T001.2: `CommentHistoryModal` public props remain compatible with existing consumers.
- AC-T001.3: Generic modal can render current content-only entries and title+content-capable history entries without article-specific code in comment components.
- AC-T001.4: Generic modal state handles load success, load failure, and close reset.
- AC-T001.5: Event comment mutation submit `Promise<boolean>` behavior is untouched.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run src/runtime/hooks/useEditHistoryModal.test.jsx src/components/EditHistoryModal.test.jsx src/components/CommentHistoryModal.test.jsx` | exit 0; shared hook/modal and compatibility wrapper tests pass |
| `npx vitest run src/runtime/hooks/usePostComments.test.jsx src/ui/posts/PostDetailScreen.test.jsx` | exit 0; existing post-comment history runtime/screen behavior remains green |
| `npx vitest run src/runtime/hooks/useCommentMutations.test.jsx` | exit 0; `handleSubmit` true/false contract remains green |

Reviewer PASS criteria:

- Diff touches only T001 owned files.
- Required commands pass with the expected signal.
- `CommentHistoryModal` remains a thin compatibility wrapper and consumers do not need migration in this task.
- No article post persistence, Firestore rules, event-comment rules, package, config, or lockfile changes are present.
- No deployed rules/product behavior claim is made.

Reviewer REJECT criteria:

- Diff touches non-owned files without coordinator approval.
- Comment history UI/runtime behavior regresses or tests are missing.
- `useCommentMutations` or event-comment rules are changed.
- Shared abstractions contain article-post path/rules knowledge instead of generic history concepts.
- Verification is missing, stale, failed, or combined into shell chains.

Evidence:

- Engineer report: Implemented shared edit-history core and comment compatibility in T001 owned files.
- Reviewer report: `review_passed` after one rejected stale-load issue was fixed.
- Command output summary:
  - `npx vitest run src/runtime/hooks/useEditHistoryModal.test.jsx src/components/EditHistoryModal.test.jsx src/components/CommentHistoryModal.test.jsx`: exit 0; 3 files / 11 tests passed.
  - `npx vitest run src/runtime/hooks/usePostComments.test.jsx src/ui/posts/PostDetailScreen.test.jsx`: exit 0; 2 files / 14 tests passed.
  - `npx vitest run src/runtime/hooks/useCommentMutations.test.jsx`: exit 0; 1 file / 4 tests passed.
  - `git diff --check`: exit 0; no whitespace errors.
- Changed files summary:
  - `src/service/comment-edit-history-service.js`: shared generic edit-history payload support while preserving comment payload compatibility.
  - `src/runtime/hooks/useEditHistoryModal.js` and test: generic load/open/error/close/reset modal state.
  - `src/components/EditedAffordance.jsx`: shared edited affordance.
  - `src/components/EditHistoryModal.jsx` and test: generic edit-history modal.
  - `src/components/CommentHistoryModal.jsx`, `src/components/CommentHistoryModal.module.css`, and test: compatibility wrapper for comment history.
  - `src/components/CommentCard.jsx`: comment card now uses shared affordance while preserving `onViewHistory(comment)`.
- Phase commits: pending `shared_core` checkpoint.
- Rules deploy status: required; changed=false; no deploy evidence
- Incidents: none

### T002 - Article Post History Persistence, Strict Rules, And Cleanup

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Persistence And Rules Engineer
- **Reviewer**: Persistence And Rules Reviewer
- **Commit checkpoint**: `article_history_persistence_rules` after Reviewer PASS and fresh verification
- **Last verified commit**: none for this task
- **Authorization boundary**: edit=yes, commit=yes after Reviewer PASS and fresh verification, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required; changed=true expected after this task; deploy remains unauthorized
- **Incidents**: none

Scope:

- Implement article post edit history persistence at `/posts/{postId}/history/{historyId}`.
- Enforce strict parent/history atomic validation in Firestore rules.
- Add post-level history cleanup in account deletion.
- Add focused service/use-case/rules tests.

Non-scope:

- Do not edit UI screens/cards except through read-only context.
- Do not harden event-comment rules or change event-comment repo/service behavior.
- Do not add migrations/backfills for existing posts.
- Do not deploy rules.
- Do not edit package files, config, or lockfiles.

Owned files:

- `src/service/post-service.js`
- `src/service/post-service.test.js`
- `src/runtime/client/use-cases/post-use-cases.js`
- `src/runtime/client/use-cases/post-use-cases.test.js`
- `src/repo/client/firebase-posts-repo.js`
- `src/repo/server/account-deletion-server-repo.js`
- `firestore.rules`
- `tests/server/firestore/post-soft-delete-rules.test.js`

Read-only context:

- `specs/post-edit-history/spec.md`
- `specs/post-edit-history/plan.md`
- `src/service/comment-edit-history-service.js`
- `src/service/event-comment-service.js`
- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/repo/client/firebase-event-comments-repo.js`
- `tests/server/firestore/event-soft-delete-rules.test.js`

Dependencies:

- `T001`

Browser evidence:

- not applicable for persistence/rules slice; T003 owns UI browser evidence.

Engineer instructions:

- Change article post update flow so it reads the current post, builds a pre-edit history entry, and writes parent update plus history create atomically.
- Save pre-edit `title` and `content` in every `/posts/{postId}/history/{historyId}` entry.
- Parent update must include trimmed new `title`, trimmed new `content`, `updatedAt`, `isEdited=true`, and `lastEditHistoryId=<historyId>`.
- Firestore rules must reject direct parent edit without matching history, standalone history create, fake pre-edit title/content, mismatched timestamp, mismatched history id, non-author writes, invalid payload fields, update/delete of history, and read when parent post is soft-deleted/inaccessible.
- Account deletion must remove post-level history before deleting the post.
- Keep post-comment strict behavior green and do not tighten event-comment rules.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: Editing article post title/content creates one immutable history doc under `/posts/{postId}/history/{historyId}` with pre-edit `title` and `content`.
- AC-T002.2: Parent post update and history create cross-validate pre-edit title/content, timestamp, and `lastEditHistoryId` / `historyId`.
- AC-T002.3: Article history read follows active post read visibility and is denied when the parent post is soft-deleted or inaccessible.
- AC-T002.4: Existing post-comment history strict validation remains green.
- AC-T002.5: Event-comment rules are not modified.
- AC-T002.6: Account deletion cleanup includes post-level history.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run src/service/post-service.test.js src/runtime/client/use-cases/post-use-cases.test.js` | exit 0; article post payload/history builder and use-case tests pass |
| `firebase emulators:exec --only firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | exit 0; post rules tests pass including article history acceptance/rejection cases |
| `git diff -- firestore.rules` | output shows no changes under `/events/{eventId}/comments/{commentId}/history/{historyId}` except unrelated context if any |

Reviewer PASS criteria:

- Diff touches only T002 owned files.
- Required commands pass with expected signals.
- Rules validate both sides of the parent/history coupling and deny forbidden writes.
- `firestore.rules` event-comment surfaces are not hardened or rewritten.
- `rulesDeployStatus` is carried as `required`, not `deployed`.

Reviewer REJECT criteria:

- Missing transaction/batch-style atomicity or missing strict rules validation.
- History stores current article content instead of pre-edit title/content.
- Parent `lastEditHistoryId` and history id are not coupled.
- Event-comment rules or behavior changes.
- Account deletion ignores post-level history.
- Verification is missing, stale, failed, or combined into shell chains.

Evidence:

- Engineer report: pending
- Reviewer report: pending
- Command output summary: pending
- Changed files summary: pending
- Phase commits: pending
- Rules deploy status: required; changed=true expected; no deploy evidence
- Incidents: none

### T003 - Article Post List/Detail UI Wiring And Browser Evidence

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: UI Runtime Engineer
- **Reviewer**: UI Runtime Reviewer
- **Commit checkpoint**: `article_history_ui` after Reviewer PASS and fresh verification
- **Last verified commit**: none for this task
- **Authorization boundary**: edit=yes, commit=yes after Reviewer PASS and fresh verification, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required; carry T002 state; deploy remains unauthorized
- **Incidents**: none

Scope:

- Wire article post `已編輯` affordance and history modal into `/posts` and `/posts/{postId}`.
- Add runtime state/handlers for article post history in list and detail.
- Keep comment history modal behavior working in post detail.
- Add focused runtime/UI tests and browser evidence.

Non-scope:

- Do not edit persistence/rules/account-deletion files from T002.
- Do not edit shared core files from T001 unless Reviewer identifies a plan flaw and coordinator updates the task.
- Do not touch event-comment UI files outside the allowed context.
- Do not edit package files, config, lockfiles, or deploy rules.

Owned files:

- `src/components/PostCard.jsx`
- `src/components/PostCard.module.css`
- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/runtime/hooks/usePostsPageRuntime.test.jsx`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/runtime/hooks/usePostDetailRuntime.test.jsx`
- `src/ui/posts/PostsPageScreen.jsx`
- `src/ui/posts/PostsPageScreen.test.jsx`
- `src/ui/posts/PostDetailScreen.jsx`
- `src/ui/posts/PostDetailScreen.test.jsx`

Read-only context:

- `specs/post-edit-history/spec.md`
- `specs/post-edit-history/plan.md`
- `src/components/EditedAffordance.jsx`
- `src/components/EditHistoryModal.jsx`
- `src/components/CommentHistoryModal.jsx`
- `src/components/CommentCard.jsx`
- `src/runtime/hooks/useEditHistoryModal.js`
- `src/runtime/hooks/usePostComments.js`
- `src/runtime/client/use-cases/post-use-cases.js`
- `src/service/post-service.js`

Dependencies:

- `T001`
- `T002`

Browser evidence:

- required.
- Target URL: local app `/posts` and `/posts/{postId}`.
- Tool: Browser plugin or Chrome plugin; record which one.
- Viewports: desktop 1280x800 and mobile 390x844.
- Journey:
  - Load `/posts`; verify an edited article post shows `已編輯`.
  - Click article `已編輯`; verify modal opens with previous title/content and closes.
  - Navigate to `/posts/{postId}`; verify detail card shows `已編輯`, modal opens, and current title/content plus previous title/content are visible.
  - Verify existing comment `已編輯` affordance and comment history modal still open/close on detail.
  - Record console errors and failed network requests.
- Screenshot artifact: save or report screenshot paths for each viewport/journey.

Engineer instructions:

- Extend `PostCard` with article history affordance props without breaking existing owner menu, link, like, favorite, and `children` behavior.
- In list/detail runtimes, expose article history modal state and handlers using the T001 shared hook and T002 history fetch/use-case contract.
- In `PostsPageScreen` and `PostDetailScreen`, render the article history modal and pass handlers to `PostCard`.
- Preserve existing post-comment history state and `CommentHistoryModal` rendering in detail.
- Update focused tests for list runtime, detail runtime, list screen, and detail screen.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: Edited article posts show `已編輯` in both list and detail UI.
- AC-T003.2: Clicking article `已編輯` opens a modal showing pre-edit title and content.
- AC-T003.3: Modal close resets article history state.
- AC-T003.4: Failed article history load leaves an error visible without corrupting current post state.
- AC-T003.5: Existing comment history modal behavior remains green in detail.
- AC-T003.6: No UI text overlaps or layout regressions in desktop/mobile browser evidence.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run src/runtime/hooks/usePostsPageRuntime.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx src/ui/posts/PostsPageScreen.test.jsx src/ui/posts/PostDetailScreen.test.jsx` | exit 0; article post history wiring and comment regression tests pass |
| `npm run lint:changed` | exit 0; changed files lint clean |
| `npm run type-check:changed` | exit 0; changed-file type check clean |

Reviewer PASS criteria:

- Diff touches only T003 owned files.
- Required commands pass with expected signals.
- Browser evidence covers `/posts` and `/posts/{postId}` on desktop and mobile.
- Article affordance/modal works and comment history is not regressed.
- No persistence/rules/event-comment/package/config/lockfile changes are present.

Reviewer REJECT criteria:

- UI requires changes outside T003 owned files without coordinator approval.
- Browser evidence is missing, blank, overlapping, or has material console/network errors.
- Article history modal shows current content as history instead of pre-edit title/content.
- Comment history affordance/modal regresses.
- Verification is missing, stale, failed, or combined into shell chains.

Evidence:

- Engineer report: pending
- Reviewer report: pending
- Command output summary: pending
- Changed files summary: pending
- Browser evidence: pending
- Phase commits: pending
- Rules deploy status: carry T002; no deploy evidence
- Incidents: none

### T004 - Final Integration Verification And Workflow State

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Integration Verifier
- **Reviewer**: Integration Reviewer
- **Commit checkpoint**: `integration_gate` after Reviewer PASS and fresh verification if workflow state changed
- **Last verified commit**: none for this task
- **Authorization boundary**: edit=yes for workflow state only, commit=yes after Reviewer PASS and fresh verification, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required if `firestore.rules` changed; deploy remains unauthorized
- **Incidents**: none

Scope:

- Run final integration verification after T001-T003 are `completed`.
- Sync `tasks.md`, `handoff.md`, and `status.json` with final local evidence.
- Record rules deploy state accurately without claiming deployment.

Non-scope:

- Do not edit production code, tests, rules, package files, config, or lockfiles.
- Do not push, open PR, watch CI, merge, sync local `main`, or deploy rules.
- Do not mark tasks completed without Reviewer PASS.

Owned files:

- `specs/post-edit-history/tasks.md`
- `specs/post-edit-history/handoff.md`
- `specs/post-edit-history/status.json`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-contract.md`
- `docs/superpowers/status.schema.json`
- `specs/post-edit-history/spec.md`
- `specs/post-edit-history/plan.md`
- T001-T003 Engineer and Reviewer reports
- `git status --short --branch`
- `git diff --name-only`

Dependencies:

- `T001`
- `T002`
- `T003`

Browser evidence:

- required by validation, but T004 may reuse T003 reviewed browser evidence if it includes target URL, route/journey, viewport, tool, screenshot artifact, expected vs actual UI signal, and console/network findings. If missing or stale, rerun browser verification before PASS.

Engineer instructions:

- Confirm T001, T002, and T003 are `completed` in `tasks.md` and `status.json`.
- Run the final integration commands one at a time and record exit codes and concise signals.
- Update workflow state to reflect latest task states, current head, last verification, phase commits, rules deploy state, and any incidents.
- If `firestore.rules` changed, keep `rulesDeployStatus.state=required`, `required=true`, `changed=true`, `deployedCommit=null`, and no deploy evidence.
- Modify only the owned workflow files above.

Acceptance criteria:

- AC-T004.1: `tasks.md`, `handoff.md`, and `status.json` agree on phase, active task, active wave, completed tasks, latest verification, rules deploy state, and incidents.
- AC-T004.2: Final commands pass or any failure is recorded as `blocked` with a concrete owner/next decision.
- AC-T004.3: Browser evidence is present and reviewed for article list/detail and comment history regression.
- AC-T004.4: No deployed rules or deployed product behavior claim is made.
- AC-T004.5: No unauthorized push, PR, CI watch, merge, local main sync, or rules deploy occurs.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `git status --short --branch` | exit 0; branch is `092-post-edit-history`; only expected reviewed files are dirty or tree is clean after authorized commits |
| `git diff --check` | exit 0; no whitespace errors |
| `npm run lint:changed` | exit 0; changed files lint clean |
| `npm run type-check:changed` | exit 0; changed-file type check clean |
| `npm run workflow:check` | exit 0; `specs/post-edit-history/status.json` valid and synced |
| `firebase emulators:exec --only firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | exit 0; post rules tests pass |
| `npx vitest run src/runtime/hooks/useEditHistoryModal.test.jsx src/components/EditHistoryModal.test.jsx src/components/CommentHistoryModal.test.jsx src/service/post-service.test.js src/runtime/client/use-cases/post-use-cases.test.js src/runtime/hooks/usePostsPageRuntime.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx src/ui/posts/PostsPageScreen.test.jsx src/ui/posts/PostDetailScreen.test.jsx` | exit 0; focused shared/persistence/UI tests pass |

Reviewer PASS criteria:

- Diff touches only T004 owned workflow files.
- Final verification and browser evidence are fresh enough for the current head/working tree.
- Workflow files are synced and pass `npm run workflow:check`.
- Rules deploy state is accurate and no deployment claim is made.
- Authorization boundary is respected.

Reviewer REJECT criteria:

- Workflow state files drift.
- Any final gate fails without a recorded blocker.
- Browser evidence is absent or stale.
- Summary/state implies deployed rules or deployed product behavior without deploy evidence.
- Unauthorized closeout action occurs.

Evidence:

- Engineer report: pending
- Reviewer report: pending
- Command output summary: pending
- Changed files summary: pending
- Browser evidence: pending
- Phase commits: pending
- Rules deploy status: required; no deploy evidence
- Incidents: none
