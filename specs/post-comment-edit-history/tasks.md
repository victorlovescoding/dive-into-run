# Post Comment Edit History Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/post-comment-edit-history/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer subagents, including code, executable tests, docs, workflow docs, ADRs, `.codex/**`, scripts, and config.
- Planner subagent slices repo-changing work. Main validates Planner output and dispatches; it does not self-slice repo-changing work.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence is one command per entry. Do not combine commands with shell chain operators.
- New `status.json` state uses schemaVersion 3 and records `currentHead`, `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and `incidents`.
- Final summaries must not imply deployed Firestore/storage rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
- Current authorization boundary: product implementation edit and commit are authorized by the user on 2026-06-03. Push, pull request, CI watch, merge, local main sync, and Firestore rules deploy remain unauthorized.

## Team And Parallelism

- Default: one Engineer and one Reviewer pair at a time.
- This plan intentionally serializes all tasks. Shared helper extraction and Firestore rules are high-risk shared surfaces and must not run in parallel with dependent implementation.
- T001 must complete and pass review before T002.
- T002 must complete and pass review before T003.
- T003 must complete and pass review before T004.
- T004 must complete and pass review before T005.
- Final integration gates run only after T001 through T005 are `completed`.

## Planner Output

- Dependency graph:
  - `implementation_edit_authorization` before T001 through T005.
  - T001 -> T002 -> T003 -> T004 -> T005 -> final integration gate.
- Parallel waves:
  - `wave-1`: T001.
  - `wave-2`: T002.
  - `wave-3`: T003.
  - `wave-4`: T004.
  - `wave-5`: T005.
- Final integration gate:
  - `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js src/runtime/hooks/usePostComments.test.jsx src/ui/posts/PostDetailScreen.test.jsx`: exit 0.
  - `npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js`: exit 0.
  - `npm run lint:changed`: exit 0, no new lint errors.
  - `npm run type-check:changed`: exit 0, no changed-file type errors.
  - `npm run depcruise`: exit 0, dependency direction preserved.
  - `git diff --check`: exit 0, no whitespace errors.
  - Browser evidence: post detail page shows an edited post comment marker, opens the shared history modal, and renders current plus history entries without console errors.

## Tasks

### T001 - Shared Comment Edit History Service

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer, service layer
- **Reviewer**: Reviewer, service contract
- **Commit checkpoint**: planned `service`, authorized
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required, changed=false, deployed=false
- **Incidents**: none

Scope:

- Create a shared service helper for comment edit history payload generation.
- Refactor event and post service payload builders to use the shared helper.
- Preserve event comment update behavior.
- Preserve post comment main document field name `comment`.
- Add focused service tests under this feature spec.

Non-scope:

- Do not modify repo, runtime, UI, Firestore rules, package files, or lockfiles.
- Do not change event comment UI behavior.
- Do not migrate post comment fields from `comment` to `content`.
- Do not add Firestore deploy or production data migration behavior.

Owned files:

- `src/service/comment-edit-history-service.js`
- `src/service/event-comment-service.js`
- `src/service/post-service.js`
- `specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-contract.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `src/runtime/client/use-cases/event-comment-use-cases.js`
- `src/runtime/client/use-cases/post-use-cases.js`

Dependencies:

- `implementation_edit_authorization`

Browser evidence:

- Not applicable for this non-UI slice.

Engineer instructions:

- RED: add tests proving the shared helper trims new text, rejects empty text, rejects unchanged text, creates history `{ content: oldText, editedAt }`, and updates the configured current text field with `updatedAt` and `isEdited: true`.
- RED: add event-specific coverage proving `buildUpdateCommentPayload(newContent, oldContent, editedAtValue)` still returns `commentUpdate.content` and `historyPayload.content`.
- RED: add post-specific coverage proving `buildUpdateCommentPayload({ comment, currentComment, updatedAtValue })` returns `commentUpdate.comment`, `commentUpdate.updatedAt`, `commentUpdate.isEdited`, and history content normalized for modal consumption.
- GREEN: create `src/service/comment-edit-history-service.js` with JSDoc and no imports from runtime, repo, UI, or config layers.
- GREEN: update `src/service/event-comment-service.js` and `src/service/post-service.js` to delegate duplicated update/history payload logic to the shared helper.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: Shared helper supports event current text field `content` and post current text field `comment`.
- AC-T001.2: Event update payload shape stays compatible with existing event repo transaction.
- AC-T001.3: Post update payload preserves the post comment main document `comment` field.
- AC-T001.4: History entries produced for UI consumption use `content` and `editedAt`.
- AC-T001.5: Empty and unchanged update attempts throw before any repo write can be requested.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js` | Exit 0, shared helper and service contract tests pass. |
| `npm run lint:changed` | Exit 0, no new lint errors for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Shared helper sits in service layer and does not violate forward-only dependency direction.
- Event payload output remains compatible with current event transaction.
- Post service does not rename the post comment main document field to `content`.
- Required verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Diff touches non-owned files without prior coordinator approval.
- Event payload shape changes incompatibly.
- Post comment main document is migrated or renamed from `comment` to `content`.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer report: DONE_WITH_CONCERNS. T001 implementation complete; worktree lacked `node_modules`, so Engineer used a git-ignored `node_modules` symlink to run verification.
- Reviewer report: review_passed by Hubble. No blocking findings; T001 diff stayed within owned service/test files and `node_modules` is ignored.
- Command output summary:
  - `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js` -> exit 0, 1 file / 6 tests.
  - `npm run lint:changed` -> exit 0, React version warning only.
  - `npm run type-check:changed` -> exit 0, no changed-file type errors.
  - `git diff --check` -> exit 0, no whitespace errors.
- Changed files summary:
  - Created `src/service/comment-edit-history-service.js`.
  - Updated `src/service/event-comment-service.js` to use the shared helper while preserving `content` payloads.
  - Updated `src/service/post-service.js` to use the shared helper while preserving the `comment` field.
  - Created `specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js`.
- Phase commits: none.
- Rules deploy status: required, no rules changed yet.
- Incidents: none.

### T002 - Post Comment Transaction And Use-Case History API

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer, repo and use-case layer
- **Reviewer**: Reviewer, data flow
- **Commit checkpoint**: planned `post-data-flow`, authorized
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required, changed=false, deployed=false
- **Incidents**: none

Scope:

- Add post comment transaction update that writes history and updates the comment main document atomically.
- Add post comment history fetch repo API.
- Update post use-case update API to pass current text, build payloads, and expose history fetch.
- Add focused use-case tests under this feature spec.

Non-scope:

- Do not modify service helper files owned by T001 unless T001 is reopened through coordinator approval.
- Do not modify runtime hooks, UI screens, Firestore rules, package files, or lockfiles.
- Do not change post comment delete, notification, pagination, or soft-delete retention semantics.
- Do not deploy Firestore rules.

Owned files:

- `src/repo/client/firebase-posts-repo.js`
- `src/runtime/client/use-cases/post-use-cases.js`
- `specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js`

Read-only context:

- `src/service/comment-edit-history-service.js`
- `src/service/post-service.js`
- `src/repo/client/firebase-event-comments-repo.js`
- `src/runtime/client/use-cases/event-comment-use-cases.js`
- `src/runtime/hooks/usePostComments.js`
- `firestore.rules`

Dependencies:

- `implementation_edit_authorization`
- `T001`

Browser evidence:

- Not applicable for this non-UI slice.

Engineer instructions:

- RED: add use-case tests proving `updateComment(postId, commentId, { comment, currentComment })` builds history/update payload and calls the repo transaction API.
- RED: add tests proving unchanged or empty content rejects before calling the repo.
- RED: add tests proving history fetch returns entries normalized as `{ id, content, editedAt }`.
- GREEN: in `firebase-posts-repo`, replace simple post comment `updateDoc` behavior with an explicit transaction API for edit history, or add a new transaction function and migrate `post-use-cases` to it.
- GREEN: transaction must create a new history doc under `posts/{postId}/comments/{commentId}/history` and update the parent comment in the same transaction.
- GREEN: add a history fetch function that orders by `editedAt` ascending, matching `CommentHistoryModal` expectations.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: Post comment edits create exactly one history doc and one parent comment update in one transaction.
- AC-T002.2: Use-case update requires the previous comment text and does not write history for unchanged text.
- AC-T002.3: History fetch returns modal-ready `{ id, content, editedAt }` entries.
- AC-T002.4: Existing add/delete/list post comment behavior is unchanged.
- AC-T002.5: No Firestore rules deploy or rules claim is made by this task.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js` | Exit 0, post comment edit history use-case tests pass. |
| `npm run lint:changed` | Exit 0, no new lint errors for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Transaction creates history and updates parent comment atomically.
- Use-case preserves post comment `comment` field and exposes modal-ready history entries.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Diff leaves post comment edit as a standalone `updateDoc` without history transaction.
- Diff stores post comment main text under `content`.
- Diff changes unrelated post comment behavior.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer report: DONE. Added post comment edit transaction, history fetch use-case, and focused tests. After review rejection, changed transaction history content to come from the server comment snapshot.
- Reviewer report: review_passed by Mendel after one rejection. Original stale-client history P1 was resolved.
- Command output summary:
  - `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js` -> exit 0, 1 file / 7 tests.
  - `npm run lint:changed` -> exit 0, React version warning only.
  - `npm run type-check:changed` -> exit 0, no changed-file type errors.
  - `git diff --check` -> exit 0, no whitespace errors.
- Changed files summary:
  - Updated `src/repo/client/firebase-posts-repo.js` with transaction-backed post comment edit history and history fetch.
  - Updated `src/runtime/client/use-cases/post-use-cases.js` with update payload wiring and `fetchCommentHistory`.
  - Created `specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js`.
- Phase commits: none.
- Rules deploy status: required, no rules changed yet.
- Incidents: none.

### T003 - Post Comment Runtime History State

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer, runtime hook
- **Reviewer**: Reviewer, runtime behavior
- **Commit checkpoint**: planned `runtime-ui`, authorized
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required, changed=false, deployed=false
- **Incidents**: none

Scope:

- Extend post comment hook return state with history modal data and handlers.
- Pass current post comment text into the updated post use-case.
- Update optimistic edit state to include `isEdited` and `updatedAt`.
- Add hook tests for success, rollback, and history fetch.

Non-scope:

- Do not modify service, repo, use-case, UI screen, Firestore rules, package files, or lockfiles.
- Do not change notification behavior or comment pagination.
- Do not introduce data fetching in UI components.

Owned files:

- `src/runtime/hooks/usePostComments.js`
- `src/runtime/hooks/usePostComments.test.jsx`

Read-only context:

- `src/runtime/client/use-cases/post-use-cases.js`
- `src/runtime/hooks/useCommentMutations.js`
- `src/components/CommentHistoryModal.jsx`
- `src/ui/posts/PostDetailScreen.jsx`

Dependencies:

- `implementation_edit_authorization`
- `T002`

Browser evidence:

- Not applicable for this runtime-only slice. UI browser evidence is required after T004.

Engineer instructions:

- RED: extend `usePostComments.test.jsx` to prove save calls `updateComment` with the trimmed new text and previous comment text.
- RED: test optimistic success updates local `comment`, `isEdited`, and `updatedAt`.
- RED: test save failure rolls back `comment`, `isEdited`, and `updatedAt`.
- RED: test `handleViewHistory` loads history entries and sets `historyComment`, `historyEntries`, and `historyError`; test close handler clears modal state.
- GREEN: add history state and handlers in `usePostComments` following the event comment hook shape where practical.
- GREEN: return the new state and handlers for PostDetailScreen.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: Runtime hook exposes `historyComment`, `historyEntries`, `historyError`, `handleViewHistory`, and `handleCloseHistory` or equivalent names documented by tests.
- AC-T003.2: Successful edit sets post comment local state to edited without waiting for a full page reload.
- AC-T003.3: Failed edit restores previous text and edit metadata.
- AC-T003.4: History fetch failure opens the modal with an error state or records `historyError` without crashing.
- AC-T003.5: Existing add/delete/edit modal behavior remains covered by existing tests.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/runtime/hooks/usePostComments.test.jsx` | Exit 0, post comment hook tests pass. |
| `npm run lint:changed` | Exit 0, no new lint errors for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Hook keeps data fetching in runtime, not UI.
- Optimistic update and rollback cover edit metadata, not only text.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Diff fetches history from UI/component effects.
- Diff omits rollback for `isEdited` or `updatedAt`.
- Diff changes unrelated post comment behaviors.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer report: DONE. Added runtime history state/handlers, currentComment payload wiring, optimistic edit metadata, rollback tests, and history fetch tests.
- Reviewer report: review_passed by Curie. No blocking findings; current T003 working-tree diff and required gates reviewed.
- Command output summary:
  - `npx vitest run --project=browser src/runtime/hooks/usePostComments.test.jsx` -> exit 0, 1 file / 7 tests.
  - `npm run lint:changed` -> exit 0, React version warning only.
  - `npm run type-check:changed` -> exit 0, no changed-file type errors.
  - `git diff --check` -> exit 0, no whitespace errors.
- Changed files summary:
  - Updated `src/runtime/hooks/usePostComments.js` with history modal state/handlers and currentComment edit payloads.
  - Updated `src/runtime/hooks/usePostComments.test.jsx` for edit metadata, rollback, and history fetch behavior.
- Phase commits: none.
- Rules deploy status: required, no rules changed yet.
- Incidents: none.

### T004 - PostDetailScreen History UI Wiring

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Engineer, UI wiring
- **Reviewer**: Reviewer, UI behavior
- **Commit checkpoint**: planned `runtime-ui`, authorized
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required, changed=false, deployed=false
- **Incidents**: none

Scope:

- Wire post detail comments to `CommentCard` history behavior.
- Render `CommentHistoryModal` from post detail runtime state.
- Normalize post comment `comment` into `content` for shared components.
- Add PostDetailScreen tests for edited marker and modal wiring.

Non-scope:

- Do not modify runtime hook, use-case, repo, service, Firestore rules, CSS, package files, or lockfiles.
- Do not redesign comment UI or modal styling.
- Do not change event comment UI.

Owned files:

- `src/ui/posts/PostDetailScreen.jsx`
- `src/ui/posts/PostDetailScreen.test.jsx`

Read-only context:

- `src/components/CommentCard.jsx`
- `src/components/CommentHistoryModal.jsx`
- `src/runtime/hooks/usePostComments.js`
- `src/components/CommentSection.jsx`

Dependencies:

- `implementation_edit_authorization`
- `T003`

Browser evidence:

- Required after implementation. Target: post detail page with one edited post comment. Viewports: desktop and mobile. Expected signal: edited marker is visible, clicking it opens history modal, modal content does not overlap and console has no relevant errors.

Engineer instructions:

- RED: update `PostDetailScreen.test.jsx` to prove an edited post comment renders the `已編輯` action instead of being forced to unedited.
- RED: test clicking `已編輯` calls the runtime history handler with the normalized comment.
- RED: test `CommentHistoryModal` renders when runtime history state is present and receives normalized current/history content.
- GREEN: import and render `CommentHistoryModal` using runtime state.
- GREEN: update `mapToCommentCardData` so `updatedAt` and `isEdited` come from the post comment item.
- GREEN: pass `onViewHistory` to `CommentCard`.
- Modify only the owned files above.

Acceptance criteria:

- AC-T004.1: PostDetailScreen no longer hard-codes `updatedAt: null` and `isEdited: false`.
- AC-T004.2: Edited post comments show the same `已編輯` affordance as event comments.
- AC-T004.3: Post detail history modal uses shared `CommentHistoryModal`.
- AC-T004.4: Post comment current text is normalized from `comment` to `content` for shared UI only.
- AC-T004.5: Existing edit/delete/comment form tests still pass.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/ui/posts/PostDetailScreen.test.jsx` | Exit 0, post detail screen tests pass. |
| `npm run lint:changed` | Exit 0, no new lint errors for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- UI normalization does not mutate source post comment objects.
- Browser evidence is recorded before final completion if UI behavior is claimed.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Diff hides or removes existing comment edit/delete behavior.
- Diff changes modal styling or unrelated UI layout.
- Diff claims browser verification without screenshot/tool evidence.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer report: DONE_WITH_CONCERNS. Wired post detail history UI and tests; browser evidence not run.
- Reviewer report: review_passed by Maxwell. No blocking findings; production shared component contracts checked manually by reviewer.
- Command output summary:
  - `npx vitest run --project=browser src/ui/posts/PostDetailScreen.test.jsx` -> exit 0, 1 file / 6 tests.
  - `npm run lint:changed` -> exit 0, React version warning only.
  - `npm run type-check:changed` -> exit 0, no changed-file type errors.
  - `git diff --check` -> exit 0, no whitespace errors.
- Changed files summary:
  - Updated `src/ui/posts/PostDetailScreen.jsx` to pass `onViewHistory` and render `CommentHistoryModal`.
  - Updated `src/ui/posts/PostDetailScreen.jsx` to preserve `isEdited`/`updatedAt` and normalize `comment` to `content` for shared UI.
  - Updated `src/ui/posts/PostDetailScreen.test.jsx` for edited affordance and history modal wiring.
- Browser evidence: final HTTP page-load check passed for `/posts`; modal click evidence remains limited because local browser automation was blocked by Crashpad permissions and sampled public posts did not have edited comments to click.
- Phase commits: none.
- Rules deploy status: required, no rules changed yet.
- Incidents: none.

### T005 - Post Comment History Firestore Rules

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-5`
- **Engineer**: Engineer, Firestore rules
- **Reviewer**: Reviewer, Security/Rules
- **Commit checkpoint**: planned `rules`, authorized
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required, changed=true, deployed=false
- **Incidents**: none

Scope:

- Add Firestore rules for `posts/{postId}/comments/{commentId}/history/{historyId}`.
- Add rules tests for read, create, update denial, delete denial, and deleted parent behavior.
- Keep rules deploy as a separate unauthorized release boundary.

Non-scope:

- Do not modify product source, runtime, UI, service, repo, package files, lockfiles, or Firestore indexes.
- Do not deploy Firestore rules.
- Do not change event history rules unless a test proves a shared helper in rules is required and coordinator updates the plan.

Owned files:

- `firestore.rules`
- `tests/server/firestore/post-soft-delete-rules.test.js`

Read-only context:

- `docs/superpowers/task-contract.md`
- `src/repo/client/firebase-posts-repo.js`
- `tests/server/firestore/event-soft-delete-rules.test.js`
- `src/runtime/client/use-cases/post-use-cases.js`

Dependencies:

- `implementation_edit_authorization`
- `T004`

Browser evidence:

- Not applicable for rules-only slice.

Engineer instructions:

- RED: add rules tests proving active post history read succeeds for a visible post comment history doc.
- RED: add tests proving comment author can create a valid history doc under an active post comment.
- RED: add tests proving non-author, anonymous, deleted-post, invalid payload, update, and delete attempts fail.
- GREEN: add the narrow nested history match under the existing post comment rules.
- GREEN: restrict create payload to the agreed history contract and reject update/delete.
- Modify only the owned files above.
- Do not run or imply an actual deploy.

Acceptance criteria:

- AC-T005.1: Active post comment history read is allowed according to the same audience as visible post comments.
- AC-T005.2: Only the parent post comment author can create history.
- AC-T005.3: History create requires valid content and editedAt fields.
- AC-T005.4: History update and delete are denied.
- AC-T005.5: Rules deploy remains not authorized and not evidenced.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js` | Exit 0, post Firestore rules tests pass. |
| `npm run lint:changed` | Exit 0, no new lint errors for changed files. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Rules create path is limited to the comment author and active post.
- Rules update/delete are false for history.
- Reviewer confirms no deploy command was run or claimed.
- Required verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Diff permits non-author history creation.
- Diff permits history update/delete.
- Diff weakens existing post comment or event comment rules outside scope.
- Diff implies rules are deployed without `rulesDeployStatus.state=deployed` and deploy evidence.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer report: DONE_WITH_CONCERNS. Bare server vitest lacked emulator env; local `firebase emulators:exec` verification passed. No deploy command was run.
- Reviewer report: review_passed by McClintock. No blocking findings; rules scope and tests reviewed; no deploy command was run.
- Command output summary:
  - `firebase emulators:exec --only auth,firestore --project demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"` -> exit 0, 1 file / 21 tests.
  - `npm run lint:changed` -> exit 0, React version warning only.
  - `git diff --check` -> exit 0, no whitespace errors.
- Changed files summary:
  - Updated `firestore.rules` with post comment history read/create/update/delete rules.
  - Updated `tests/server/firestore/post-soft-delete-rules.test.js` with post comment history allow/deny coverage.
- Phase commits: none.
- Rules deploy status: required, changed=true, no deploy evidence.
- Incidents: none.
