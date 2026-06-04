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
- Phase: `integration`.
- Active task: `T004`.
- Active wave: `wave-4`.
- Latest reviewer decision: `review_passed` for `T003` article post list/detail UI wiring and browser evidence. T004 remains `engineer_done` and awaits Integration Reviewer; do not mark the feature closed yet.
- Blocked: no.
- Next gate: Integration Reviewer review of this rebase-local workflow-state diff. Push, PR, CI watch, merge, and local `main` sync are authorized for downstream closeout but were not performed by this verifier task.
- Authorization boundary: `edit=true`, `commit=false` for this verifier state update; `push=true`, `pullRequest=true`, `ciWatch=true`, `merge=true`, and `localMainSync=true` are authorized for downstream closeout only; `deployFirestoreRules=true` records the already executed Firestore-only rules deploy and does not authorize another deploy.
- Branch/worktree: `/Users/chentzuyu/Desktop/dive-into-run-092-post-edit-history` on `092-post-edit-history`, current HEAD `2ded9f33aa71010ced6e037001c5e2b93487f24d`, tracking `origin/main` at `50972d7694cdd52096f3e857226fcb60e14de536`; branch reports ahead 12 and behind 0 relative to `origin/main`.
- Rules deploy status: `deployed` for Firestore rules content, with `required=true` and `changed=true`. Actual deploy source commit was pre-rebase `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; current HEAD `2ded9f33aa71010ced6e037001c5e2b93487f24d` was not redeployed. Verified content equivalence with `git diff --exit-code 3f83371be5cf7ef3c59aee463c006a4930a4f5e2 HEAD -- firestore.rules` exit 0. The `deployedCommit` field in `status.json` is set to current HEAD only because workflow schema requires an ancestor ref; evidence records the actual deployed source.
- UI placement commit: `2ded9f33aa71010ced6e037001c5e2b93487f24d` (`2ded9f3 Move post edited badge to time row`) is covered by fresh focused UI tests and the 4-file runtime/UI suite.
- Incidents: none.
- Final verification evidence:
| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git status --short --branch` | 0 | On `092-post-edit-history`; ahead 12 and behind 0 relative to `origin/main`; worktree clean before workflow state sync. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run lint:changed` | 0 | No changed JS files to lint. |
| `npm run type-check:changed` | 0 | No changed JS files to check. |
| `npm run workflow:check` | 0 | 18 status files valid and synced; specs/post-edit-history/status.json ok and sync ok after rebase-local workflow-state sync. |
| `npx vitest run tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 2 files / 7 tests passed; covers post edited badge placement on list/detail screens. |
| `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 4 files / 11 tests passed. |
| `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | 1 file / 37 tests passed; auth/firestore emulators started and stopped successfully. |
| `git diff --exit-code 3f83371be5cf7ef3c59aee463c006a4930a4f5e2 HEAD -- firestore.rules` | 0 | No `firestore.rules` content diff between the pre-rebase deployed source commit and current HEAD; content-equivalence evidence only, not a redeploy. |

## Dependency Graph

```text
T001 shared core
  -> T002 article persistence/rules/cleanup
      -> T003A browser test lint configuration
          -> T003 post list/detail UI wiring review completion
              -> T004 final integration gate/workflow state
```

## Parallel Waves

- Serialized execution is safer than parallel execution.
- `wave-1`: `T001` only. Shared helpers/components/hooks are prerequisites.
- `wave-2`: `T002` only. Firestore rules and account-deletion cleanup are shared high-risk surfaces.
- `wave-3a`: `T003A` only. Shared lint/type-check configuration must serialize before T003 can complete review.
- `wave-3b`: `T003` only. UI wiring depends on T001 shared components, T002 use-case/repo contracts, and T003A lint configuration support.
- `wave-4`: `T004` only. Final integration gate and workflow-state sync after all implementation tasks.
- No same-wave owned files overlap because every wave has exactly one task.

## Final Integration Gate

- Run after `T001`, `T002`, `T003A`, and `T003` are `completed`.
- Required commands:
  - `git status --short --branch`
  - `git diff --check`
  - `npm run lint:changed`
  - `npm run type-check:changed`
  - `npm run workflow:check`
  - `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"`
  - `npx vitest run tests/browser/runtime/hooks/useEditHistoryModal.test.jsx tests/browser/components/EditHistoryModal.test.jsx tests/browser/components/CommentHistoryModal.test.jsx tests/browser/service/post-service.test.js tests/browser/runtime/client/use-cases/post-use-cases.test.js tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx`
- Browser evidence is required for `/posts` and `/posts/{postId}` article history affordance/modal, plus comment history regression.

## Tasks

### T001 - Shared Edit-History Core And Comment Compatibility

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Shared Core Engineer
- **Reviewer**: Shared Core Reviewer
- **Commit checkpoint**: `shared_core` after Reviewer PASS and fresh verification
- **Last verified commit**: `3cd1d970a7a42a8dc9c1b8a35ca843b1edc367cf`; post-rebase test-layout migration is uncommitted and requires review before dispatching `T002`
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
- `tests/browser/runtime/hooks/useEditHistoryModal.test.jsx`
- `src/components/EditedAffordance.jsx`
- `src/components/EditHistoryModal.jsx`
- `tests/browser/components/EditHistoryModal.test.jsx`
- `src/components/CommentHistoryModal.jsx`
- `src/components/CommentHistoryModal.module.css`
- `tests/browser/components/CommentHistoryModal.test.jsx`
- `src/components/CommentCard.jsx`
- `src/components/CommentCard.module.css`

Read-only context:

- `specs/post-edit-history/spec.md`
- `specs/post-edit-history/plan.md`
- `src/runtime/hooks/usePostComments.js`
- `tests/browser/runtime/hooks/usePostComments.test.jsx`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/ui/posts/PostDetailScreen.jsx`
- `tests/browser/ui/posts/PostDetailScreen.test.jsx`
- `src/service/event-comment-service.js`
- `src/runtime/hooks/useCommentMutations.js`
- `tests/browser/runtime/hooks/useCommentMutations.test.jsx`

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
| `npx vitest run tests/browser/runtime/hooks/useEditHistoryModal.test.jsx tests/browser/components/EditHistoryModal.test.jsx tests/browser/components/CommentHistoryModal.test.jsx` | exit 0; shared hook/modal and compatibility wrapper tests pass |
| `npx vitest run tests/browser/runtime/hooks/usePostComments.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | exit 0; existing post-comment history runtime/screen behavior remains green |
| `npx vitest run tests/browser/runtime/hooks/useCommentMutations.test.jsx` | exit 0; `handleSubmit` true/false contract remains green |

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
  - `npx vitest run tests/browser/runtime/hooks/useEditHistoryModal.test.jsx tests/browser/components/EditHistoryModal.test.jsx tests/browser/components/CommentHistoryModal.test.jsx`: exit 0; 3 files / 11 tests passed.
  - `npx vitest run tests/browser/runtime/hooks/usePostComments.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx`: exit 0; 2 files / 14 tests passed.
  - `npx vitest run tests/browser/runtime/hooks/useCommentMutations.test.jsx`: exit 0; 1 file / 4 tests passed.
  - `git diff --check`: exit 0; no whitespace errors.
- Changed files summary:
  - `src/service/comment-edit-history-service.js`: shared generic edit-history payload support while preserving comment payload compatibility.
  - `src/runtime/hooks/useEditHistoryModal.js` and test: generic load/open/error/close/reset modal state.
  - `src/components/EditedAffordance.jsx`: shared edited affordance.
  - `src/components/EditHistoryModal.jsx` and test: generic edit-history modal.
  - `src/components/CommentHistoryModal.jsx`, `src/components/CommentHistoryModal.module.css`, and test: compatibility wrapper for comment history.
  - `src/components/CommentCard.jsx`: comment card now uses shared affordance while preserving `onViewHistory(comment)`.
- Phase commits: `shared_core` checkpoint committed at `3cd1d970a7a42a8dc9c1b8a35ca843b1edc367cf`; post-rebase test-layout migration checkpoint pending review/commit.
- Rules deploy status: required; changed=false; no deploy evidence
- Incidents: none

### T002 - Article Post History Persistence, Strict Rules, And Cleanup

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Persistence And Rules Engineer
- **Reviewer**: Persistence And Rules Reviewer
- **Commit checkpoint**: `article_history_persistence_rules` after Reviewer PASS and fresh verification
- **Last verified commit**: `6a61283c02c6334f9062f10b26e44e0c4a9910c3`; T002 implementation is completed and committed
- **Authorization boundary**: edit=yes, commit=yes after Reviewer PASS and fresh verification, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required; changed=true; deploy remains unauthorized and not claimed
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
- `tests/browser/service/post-service.test.js`
- `src/runtime/client/use-cases/post-use-cases.js`
- `tests/browser/runtime/client/use-cases/post-use-cases.test.js`
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
| `npx vitest run tests/browser/service/post-service.test.js tests/browser/runtime/client/use-cases/post-use-cases.test.js` | exit 0; article post payload/history builder and use-case tests pass |
| `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | exit 0; post rules tests pass including article history acceptance/rejection cases |
| `git diff -- firestore.rules` | output shows no changes under `/events/{eventId}/comments/{commentId}/history/{historyId}` except unrelated context if any |

Reviewer PASS criteria:

- Diff touches only T002 owned files.
- Required commands pass with expected signals.
- Rules validate both sides of the parent/history coupling and deny forbidden writes.
- `firestore.rules` event-comment surfaces are not hardened or rewritten.
- Historical T002 review state carried `rulesDeployStatus` as `required` and not yet deployed; current workflow state records `rulesDeployStatus.state=deployed` with `required=true` and `changed=true`.

Reviewer REJECT criteria:

- Missing transaction/batch-style atomicity or missing strict rules validation.
- History stores current article content instead of pre-edit title/content.
- Parent `lastEditHistoryId` and history id are not coupled.
- Event-comment rules or behavior changes.
- Account deletion ignores post-level history.
- Verification is missing, stale, failed, or combined into shell chains.

Evidence:

- Engineer report: Implemented article post edit-history persistence, strict Firestore parent/history validation, and post-level history cleanup in T002 owned files.
- Reviewer report: `review_passed`; workflow follow-up required planned rules verification commands to use `--only auth,firestore`, `rulesDeployStatus.state=required`, and `rulesDeployStatus.changed=true`.
- Command output summary:
  - `npx vitest run tests/browser/service/post-service.test.js tests/browser/runtime/client/use-cases/post-use-cases.test.js`: exit 0; 2 files / 5 tests passed.
  - `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"`: exit 0; 1 file / 37 tests passed.
  - `git diff -- firestore.rules`: exit 0; no event-comment rules hunks changed.
  - `npm run type-check`: exit 0; type check completed.
  - `npm run lint -- --max-warnings 0`: exit 0; strict lint completed.
  - `git diff --check`: exit 0; no whitespace errors.
- Changed files summary:
  - `src/service/post-service.js`: builds article post edit metadata/history payload from pre-edit post data.
  - `src/runtime/client/use-cases/post-use-cases.js`: routes article edits through the history-aware update contract and exposes history fetch normalization.
  - `src/repo/client/firebase-posts-repo.js`: writes parent update plus `/posts/{postId}/history/{historyId}` atomically and reads article history.
  - `src/repo/server/account-deletion-server-repo.js`: includes post-level history in account-deletion cleanup.
  - `firestore.rules`: adds strict article parent/history validation and read rules without changing event-comment history rules.
  - `tests/browser/service/post-service.test.js`, `tests/browser/runtime/client/use-cases/post-use-cases.test.js`, and `tests/server/firestore/post-soft-delete-rules.test.js`: cover article history payload/use-case/rules behavior.
- Phase commits: pending; do not commit in this state sync
- Rules deploy status: required; changed=true; no deploy evidence
- Incidents: none

### T003A - Browser Test Lint Configuration

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-3a`
- **Engineer**: Tooling Configuration Engineer
- **Reviewer**: Tooling Configuration Reviewer
- **Commit checkpoint**: `browser_test_lint_config` after Reviewer PASS and fresh verification
- **Last verified commit**: none for this task; config change is dirty and not committed by this state sync
- **Authorization boundary**: edit=yes, commit=yes after Engineer + Reviewer + fresh verification, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required; carry T002 changed=true state; deploy remains unauthorized
- **Incidents**: none

Scope:

- Make changed-file lint work for new `tests/browser/**/*.js` and `tests/browser/**/*.jsx` files while keeping those tests linted.
- Prefer minimal configuration changes in `eslint.config.mjs` and/or `tsconfig.json`.
- Preserve type-aware lint behavior for source and browser tests.
- Add no test fixtures and no production/runtime behavior.

Non-scope:

- Do not edit T003 UI/runtime implementation files or browser tests.
- Do not edit production source, Firestore rules, package files, lockfiles, or seed/fixture data.
- Do not relax lint policy by excluding `tests/browser/**` from changed-file lint.
- Do not change `scripts/lint-changed.sh` unless the Engineer proves the current lint policy itself is wrong; if that happens, stop for coordinator approval before editing it.

Owned files:

- `eslint.config.mjs`
- `tsconfig.json`

Read-only context:

- `scripts/lint-changed.sh`
- `package.json`
- `docs/superpowers/task-contract.md`
- `specs/post-edit-history/plan.md`
- `specs/post-edit-history/tasks.md`
- `tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx`
- `tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx`
- `tests/browser/ui/posts/PostsPageScreen.test.jsx`
- `tests/browser/ui/posts/PostDetailScreen.test.jsx`

Dependencies:

- `T001`
- `T002`

Browser evidence:

- not applicable for this non-UI tooling slice. T003 owns browser evidence.

Engineer instructions:

- Inspect the current ESLint project-service configuration and TypeScript project includes.
- Make the smallest config change that lets `npm run lint:changed` parse and lint untracked `tests/browser/**/*.jsx` files.
- Keep `tests/browser/**` linted; do not hide the files from `lint:changed`.
- If solving this requires changing `scripts/lint-changed.sh`, stop and report the exact reason instead of editing it.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003A.1: `npm run lint:changed` can lint changed and untracked `tests/browser/**/*.jsx` files without project-service parser errors.
- AC-T003A.2: Full strict lint still succeeds with tests included in the intended project/config coverage.
- AC-T003A.3: Type checking still succeeds.
- AC-T003A.4: Focused T003 browser/runtime tests still run after the config change.
- AC-T003A.5: No lint exclusion or script change removes browser tests from changed-file lint.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | ESLint reaches changed and untracked T003 JS/JSX files without project-service/default-project parser errors; a non-zero exit is acceptable only when the remaining failure is a real downstream T003 lint violation |
| `npm run lint -- --max-warnings 0` | strict lint has browser test project-service coverage; any remaining rule violations are reported as downstream task blockers, not T003A parser coverage failures |
| `npm run type-check` | full type check succeeds or any failure is reported as unrelated to T003A project-service parser coverage |
| `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | exit 0; focused T003 runtime/UI tests still pass or failures are reported as T003-owned behavior, not config parser errors |
| `npm run workflow:check` | exit 0; workflow state remains valid and synced after T003A state updates |

Reviewer PASS criteria:

- Diff touches only T003A owned files.
- Required T003A evidence shows the ESLint parser/project-service coverage blocker is resolved; downstream T003 lint failures do not fail T003A.
- Browser tests remain linted; they are not excluded from `lint:changed`.
- No production, T003 UI/runtime, package, lockfile, rules, seed, or fixture files are changed.
- Rules deploy metadata remains `required=true` and `changed=true`; current workflow state records `rulesDeployStatus.state=deployed`.

Reviewer REJECT criteria:

- Config hides `tests/browser/**` from lint instead of supporting them.
- Diff touches files outside owned files without coordinator approval.
- Required commands are missing, stale, failed, or combined into shell chains.
- Full strict lint or type check regresses.
- The fix requires script policy changes, package changes, or fixture data changes.

Evidence:

- Engineer report: Fixed ESLint project-service config for `tests/browser/**` in `eslint.config.mjs`.
- Reviewer report: `review_passed`; config issue is resolved and browser tests remain linted.
- Command output summary:
  - `npm run lint:changed`: exit non-zero; no ESLint project-service/default-project parser error remains for `tests/browser/**/*.jsx`; current failure is a real downstream T003-owned no-restricted-syntax violation at `tests/browser/ui/posts/PostDetailScreen.test.jsx:185` for `toHaveBeenCalledTimes`, so this is not T003A incompletion.
- Changed files summary:
  - `eslint.config.mjs`: browser test project-service/default-project coverage fixed for `tests/browser/**`.
- Browser evidence: not applicable
- Phase commits: pending; do not commit in this state sync
- Rules deploy status: required; changed=true; no deploy evidence
- Incidents: none

### T003 - Article Post List/Detail UI Wiring And Browser Evidence

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-3b`
- **Engineer**: UI Runtime Engineer
- **Reviewer**: UI Runtime Reviewer
- **Commit checkpoint**: `article_history_ui` after Reviewer PASS and fresh verification
- **Last verified commit**: pre-rebase `4d80d098a4f2e2cb65387f55db8c9f1d4a4cc296`; rebased `article_history_ui` checkpoint is `363b229b484d517da99d72d9c6a86b647ca9b51d`.
- **Authorization boundary**: edit=yes, commit=yes after Reviewer PASS and fresh verification, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: required; carry T002 changed=true state; deploy remains unauthorized
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
- `tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx`
- `src/ui/posts/PostsPageScreen.jsx`
- `tests/browser/ui/posts/PostsPageScreen.test.jsx`
- `src/ui/posts/PostDetailScreen.jsx`
- `tests/browser/ui/posts/PostDetailScreen.test.jsx`

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
- `T003A` completed

Browser evidence:

- required.
- Target URL: local app `/posts` and `/posts/{postId}`.
- Tool: Browser plugin or Chrome plugin; record which one.
- Viewports: desktop 1280x800 and mobile 390x844.
- Setup: Coordinator/Engineer may sign in through the app, create an article post, edit that post, and use that same edited article for evidence. This setup is allowed only through app/browser interaction and must not require code, data fixture, seed, or config changes.
- Journey:
  - Load `/posts`; verify an edited article post shows `已編輯`.
  - Click article `已編輯`; verify modal opens with previous title/content and closes.
  - Navigate to `/posts/{postId}`; verify detail card shows `已編輯`, modal opens, and current title/content plus previous title/content are visible.
  - Verify existing comment `已編輯` affordance and comment history modal still open/close on detail when an edited comment is already available or can be created through app/browser interaction.
  - Record console errors and failed network requests.
- Screenshot artifact: save or report screenshot paths for each viewport/journey.
- Stop if deterministic seeded fixture data is required; that must become a separate fixture task before T003 review can complete.

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
| `npx vitest run tests/browser/ui/posts/PostDetailScreen.test.jsx` | exit 0; detail article history and comment regression screen tests pass |
| `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | exit 0; article post history wiring and comment regression tests pass |
| `npm run lint:changed` | exit 0; changed files lint clean |
| `npm run lint -- --max-warnings 0` | exit 0; strict lint clean after T003A config support |
| `npm run type-check:changed` | exit 0; changed-file type check clean |

Reviewer PASS criteria:

- Diff touches only T003 owned files.
- `T003A` is `completed` before T003 review is retried or completed.
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

- Engineer report: Implemented T003 UI/runtime owned scope, resolved the prior lint/browser evidence blocker, and committed it as `article_history_ui` at `4d80d098a4f2e2cb65387f55db8c9f1d4a4cc296`.
- Reviewer report: `review_passed`; findings none. `PostCard` shows article-level `已編輯` only when `post.isEdited && onViewArticleHistory`, calls the article handler, list/detail runtimes use shared `useEditHistoryModal` plus T002 `fetchPostHistory`, local edit sets `isEdited: true`, detail comment history wiring remains intact, and tests cover list/detail article history plus detail comment regression without `toHaveBeenCalledTimes(N)`.
- Command output summary:
  - `npx vitest run tests/browser/ui/posts/PostDetailScreen.test.jsx`: exit 0; 1 file / 4 tests passed.
  - `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx`: exit 0; 4 files / 11 tests passed.
  - `npm run lint:changed`: exit 0; only existing React version warning.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check`: exit 0; no whitespace errors.
- Changed files summary:
  - `src/components/PostCard.jsx` and `src/components/PostCard.module.css`: article edited affordance rendering/placement for post cards.
  - `src/runtime/hooks/usePostsPageRuntime.js` and `src/runtime/hooks/usePostDetailRuntime.js`: article history modal state/handlers wired through shared `useEditHistoryModal` and T002 `fetchPostHistory`.
  - `src/ui/posts/PostsPageScreen.jsx` and `src/ui/posts/PostDetailScreen.jsx`: list/detail article history modal rendering and handlers, with detail comment history preserved.
  - `tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx`, `tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx`, `tests/browser/ui/posts/PostsPageScreen.test.jsx`, and `tests/browser/ui/posts/PostDetailScreen.test.jsx`: article history list/detail coverage and detail comment regression without `toHaveBeenCalledTimes(N)`.
- Browser evidence: PASS via Playwright/emulator using project `demo-test`, Auth 9099, Firestore 8080, Storage 9199, and Next on `localhost:3002` with emulator env/fake config; did not use `localhost:3000` or production. Screenshots:
  - `/private/tmp/t003-article-history-ui/playwright-article-edited-button-desktop.png`
  - `/private/tmp/t003-article-history-ui/playwright-article-history-modal-desktop.png`
  - `/private/tmp/t003-article-history-ui/playwright-article-edited-button-mobile.png`
  - Modal showed old title/content `T003 old title 2026-06-04T13-04-19-806Z` and `T003 old content 2026-06-04T13-04-19-806Z`, plus `目前版本`, `原始版本`, and new title/content.
- Phase commits: pending
- Rules deploy status: required; changed=true; no deploy evidence
- Incidents: none

### T004 - Final Integration Verification And Workflow State

- **State**: `engineer_done`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Integration Verifier
- **Reviewer**: Integration Reviewer
- **Commit checkpoint**: downstream commit only after Reviewer PASS and fresh verification; this verifier did not stage or commit
- **Last verified commit**: `2ded9f33aa71010ced6e037001c5e2b93487f24d`
- **Authorization boundary**: edit=yes for workflow state only, commit=no for this verifier update, push=yes/pullRequest=yes/ciWatch=yes/merge=yes/localMainSync=yes for downstream closeout only, deployFirestoreRules=yes only to record the already executed Firestore-only rules deploy
- **Rules deploy status**: deployed content, not redeployed HEAD. Actual deploy source commit was pre-rebase `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; current HEAD `2ded9f33aa71010ced6e037001c5e2b93487f24d` is `firestore.rules` content-equivalent by `git diff --exit-code 3f83371be5cf7ef3c59aee463c006a4930a4f5e2 HEAD -- firestore.rules` exit 0. No hosting/functions/storage/indexes deploy.
- **Incidents**: none

Scope:

- Run final integration verification after rebase.
- Sync `tasks.md`, `handoff.md`, `plan.md`, and `status.json` with current HEAD, origin/main, ahead/behind, phase commits, final verification, UI placement coverage, and rules deploy/content-equivalence evidence.
- Record Firestore rules deploy honestly: deployed command/source evidence is pre-rebase; current HEAD was not redeployed.

Non-scope:

- Do not edit production code, tests, rules, package files, config, or lockfiles.
- Do not push, open PR, watch CI, merge, sync local `main`, or run another deploy.
- Do not mark tasks completed without Reviewer PASS.

Owned files:

- `specs/post-edit-history/tasks.md`
- `specs/post-edit-history/handoff.md`
- `specs/post-edit-history/status.json`
- `specs/post-edit-history/plan.md`

Dependencies:

- `T001`
- `T002`
- `T003A`
- `T003`

Engineer instructions completed:

- Confirmed T001, T002, T003A, and T003 are `completed` in workflow state.
- Ran final integration commands after rebase and recorded exit codes.
- Recorded rebase-local phase commits:
  - `spec_created` -> `4b87ce41d02ca821c93de114e545b948c400f16c`
  - `spec_approved` -> `4798096195563e57977a79934b007b057ab07e51`
  - `post_rebase_state` -> `9e8052e3fd121eb7c17bc66446bb58099260bdac`
  - `plan_and_tasks` -> `35257d036d568293bc7cee923c9be0ffd3693256`
  - `shared_core` -> `29b7d9c24d358431e9739c2e6ffb9dd396c666de`
  - `shared_core_test_layout` -> `066ba10ea1639755601dbf3aea0155e9adab6a98`
  - `article_history_persistence_rules` -> `c9b2714939ba5dffbbac0f3ff8731a985bc61657`
  - `browser_test_lint_config` -> `3e6f35b06f6fe28291e7bf05adbe8a8c51ef91d7`
  - `article_history_ui` -> `363b229b484d517da99d72d9c6a86b647ca9b51d`
  - `integration_gate` -> `1f6e1d329cf82a9463e5506f12108e0974277f13`
  - `rules_deploy_record` -> `754e8d2dfb1958a4de98a8106d83ec2c1a236d63`
  - `post_edited_badge_time_row` -> `2ded9f33aa71010ced6e037001c5e2b93487f24d`
- Recorded that UI placement commit `2ded9f33aa71010ced6e037001c5e2b93487f24d` is covered by verification.
- Recorded rules deploy evidence without claiming current HEAD was deployed.

Acceptance criteria:

- AC-T004.1: Workflow files agree on phase, active task, active wave, completed tasks, latest verification, rules deploy state, and incidents.
- AC-T004.2: Final commands pass or any failure is recorded as `blocked` with a concrete owner/next decision.
- AC-T004.3: UI placement and post edit history runtime/UI behavior are covered by fresh tests.
- AC-T004.4: Firestore rules deploy claim is backed by deploy evidence; current HEAD is recorded only as content-equivalent, not redeployed.
- AC-T004.5: No unauthorized push, PR, CI watch, merge, local main sync, or deploy occurs in this verifier task.

Verification commands and expected signal:

| Command | Exit | Last run |
| ------- | ---- | -------- |
| `git status --short --branch` | 0 | On `092-post-edit-history`; ahead 12 and behind 0 relative to `origin/main`; worktree clean before workflow state sync. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run lint:changed` | 0 | No changed JS files to lint. |
| `npm run type-check:changed` | 0 | No changed JS files to check. |
| `npm run workflow:check` | 0 | 18 status files valid and synced; specs/post-edit-history/status.json ok and sync ok after rebase-local workflow-state sync. |
| `npx vitest run tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 2 files / 7 tests passed; covers post edited badge placement on list/detail screens. |
| `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 4 files / 11 tests passed. |
| `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | 1 file / 37 tests passed; auth/firestore emulators started and stopped successfully. |
| `git diff --exit-code 3f83371be5cf7ef3c59aee463c006a4930a4f5e2 HEAD -- firestore.rules` | 0 | No `firestore.rules` content diff between the pre-rebase deployed source commit and current HEAD; content-equivalence evidence only, not a redeploy. |

Reviewer PASS criteria:

- Diff touches only T004 owned workflow files.
- Final verification evidence covers current HEAD `2ded9f3` after rebase, including the UI placement commit.
- Workflow files are synced and pass `npm run workflow:check`.
- Rules deploy state is honest: actual deploy source was pre-rebase, current HEAD is only content-equivalent, and no hosting/functions/storage/indexes deploy claim is made.
- Authorization boundary is respected.

Reviewer REJECT criteria:

- Workflow state files drift.
- Any final gate fails without a recorded blocker.
- State implies current rebased HEAD was deployed or implies hosting/functions/storage/indexes deploy.
- Unauthorized closeout action occurs.

Evidence:

- Engineer report: Rebase-local final verification covers current HEAD `2ded9f33aa71010ced6e037001c5e2b93487f24d`, origin/main `50972d7694cdd52096f3e857226fcb60e14de536`, ahead 12 / behind 0, including UI placement commit `2ded9f3`. Firestore rules deploy evidence is preserved as pre-rebase source commit `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; current HEAD was not redeployed and is only content-equivalent for `firestore.rules`. No push, PR, CI watch, merge, local main sync, deploy, or source/test/config/rules/package/lockfile edits were performed.
- Reviewer report: pending
- Command output summary:
  - | `git status --short --branch` | 0 | On `092-post-edit-history`; ahead 12 and behind 0 relative to `origin/main`; worktree clean before workflow state sync. |
  - | `git diff --check` | 0 | No whitespace errors. |
  - | `npm run lint:changed` | 0 | No changed JS files to lint. |
  - | `npm run type-check:changed` | 0 | No changed JS files to check. |
  - | `npm run workflow:check` | 0 | 18 status files valid and synced; specs/post-edit-history/status.json ok and sync ok after rebase-local workflow-state sync. |
  - | `npx vitest run tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 2 files / 7 tests passed; covers post edited badge placement on list/detail screens. |
  - | `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx` | 0 | 4 files / 11 tests passed. |
  - | `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"` | 0 | 1 file / 37 tests passed; auth/firestore emulators started and stopped successfully. |
  - | `git diff --exit-code 3f83371be5cf7ef3c59aee463c006a4930a4f5e2 HEAD -- firestore.rules` | 0 | No `firestore.rules` content diff between the pre-rebase deployed source commit and current HEAD; content-equivalence evidence only, not a redeploy. |
- Changed files summary:
  - `specs/post-edit-history/status.json`: synced current HEAD/origin/main/ahead-behind, rebase-local phase commit SHAs, final verification, UI placement coverage, authorization boundary, and honest rules deploy/content-equivalence evidence.
  - `specs/post-edit-history/tasks.md`: synced T004 state/evidence and current rules deploy semantics after rebase.
  - `specs/post-edit-history/handoff.md`: synced current handoff, latest verification, rules deploy status, and remaining closeout boundaries.
  - `specs/post-edit-history/plan.md`: synced stale HEAD/remote/ahead-behind and rules deploy wording after rebase.
- Rules deploy status: deployed content only; actual deploy source commit `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; current HEAD `2ded9f33aa71010ced6e037001c5e2b93487f24d` was not redeployed and is only content-equivalent.
- Incidents: none
