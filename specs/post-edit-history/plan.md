# Article Post Edit History Plan

## Summary

Current phase: `planning_ready`. The spec is approved and implementation may
start from the task contracts in `tasks.md`.

The implementation uses Shared Core + Resource Adapters. Shared edit-history
code owns generic affordance/modal/state/snapshot concepts. Article posts own
their `/posts/{postId}/history/{historyId}` repo path, use-case contract,
Firestore rules validation, account-deletion cleanup, and article-specific UI
wiring.

## Architecture

- Shared core:
  - `EditedAffordance` renders the reusable `已編輯` button affordance.
  - `EditHistoryModal` renders a generic current-version + previous-version
    history modal.
  - `CommentHistoryModal` remains a compatibility wrapper so comment consumers
    do not need a broad migration.
  - `useEditHistoryModal` owns generic modal state and preserves the existing
    comment failure behavior: failed history load keeps the modal open and
    shows an error.
  - `comment-edit-history-service.js` may expose a generic snapshot/update
    builder while keeping the existing comment builder contract stable.
- Article post persistence:
  - Article edits must read the current post before writing.
  - The write must create `/posts/{postId}/history/{historyId}` with the
    pre-edit `title` and `content`.
  - The parent post update must write trimmed `title`, trimmed `content`,
    `updatedAt`, `isEdited=true`, and `lastEditHistoryId=<historyId>`.
  - Repo writes should use a transaction or batch shape that Firestore rules can
    validate atomically.
- Firestore rules:
  - `/posts/{postId}` update and `/posts/{postId}/history/{historyId}` create
    must cross-validate pre-edit `title` + `content`, timestamp equality, and
    parent `lastEditHistoryId` / `historyId` coupling.
  - Article history read visibility is fixed: same as active article post read
    visibility; parent soft-deleted or inaccessible means history is denied.
  - Event comment rules remain non-scope and must not be hardened here.
- UI/runtime:
  - `PostCard` is the shared article card for `/posts` and `/posts/{id}`.
  - List and detail runtime state should expose article post history state and
    handlers without regressing comment history state.
  - UI must show `已編輯` for edited article posts in list and detail, and the
    modal must show previous `title` and `content`.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/service/comment-edit-history-service.js` | Modify | Keep current comment builder stable and expose generic snapshot/update helpers where useful. |
| `src/runtime/hooks/useEditHistoryModal.js` | Create | Generic edit-history modal state for resource adapters. |
| `src/components/EditedAffordance.jsx` | Create | Shared `已編輯` affordance. |
| `src/components/EditHistoryModal.jsx` | Create | Generic edit-history modal presentation. |
| `src/components/CommentHistoryModal.jsx` | Modify | Thin compatibility wrapper over generic modal. |
| `src/components/CommentHistoryModal.module.css` | Modify | Modal styles reusable by generic wrapper without changing visible behavior. |
| `src/components/CommentCard.jsx` | Modify | Use shared affordance while preserving `onViewHistory(comment)`. |
| `src/components/CommentCard.module.css` | Modify | Style shared affordance usage if needed. |
| `src/service/post-service.js` | Modify | Build article post edit metadata and history payload from pre-edit post data. |
| `src/runtime/client/use-cases/post-use-cases.js` | Modify | Route article edits through atomic history write and expose history fetch normalization. |
| `src/repo/client/firebase-posts-repo.js` | Modify | Implement article post transaction and history reads under `/posts/{postId}/history/{historyId}`. |
| `src/repo/server/account-deletion-server-repo.js` | Modify | Delete post-level history during post tree cleanup. |
| `firestore.rules` | Modify | Add strict article post parent/history validation and read rules. |
| `src/components/PostCard.jsx` | Modify | Render article post edit affordance and trigger history view. |
| `src/components/PostCard.module.css` | Modify | Style article post edit affordance placement. |
| `src/runtime/hooks/usePostsPageRuntime.js` | Modify | Wire list-level article post history handlers/state. |
| `src/runtime/hooks/usePostDetailRuntime.js` | Modify | Wire detail-level article post history handlers/state alongside comment history. |
| `src/ui/posts/PostsPageScreen.jsx` | Modify | Pass article history handlers/state to list cards/modal. |
| `src/ui/posts/PostDetailScreen.jsx` | Modify | Pass article history handlers/state to detail card/modal without regressing comment modal. |
| Focused tests named in `tasks.md` | Modify/Create | Prove shared core compatibility, persistence/rules strictness, UI wiring, and integration behavior. |

## Verification Strategy

- Required local gates:
  - `npx vitest run src/runtime/hooks/useEditHistoryModal.test.jsx src/components/EditHistoryModal.test.jsx src/components/CommentHistoryModal.test.jsx`
  - `npx vitest run src/runtime/hooks/usePostComments.test.jsx src/ui/posts/PostDetailScreen.test.jsx`
  - `npx vitest run src/service/post-service.test.js src/runtime/client/use-cases/post-use-cases.test.js`
  - `firebase emulators:exec --only firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"`
  - `npx vitest run src/runtime/hooks/usePostsPageRuntime.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx src/ui/posts/PostsPageScreen.test.jsx src/ui/posts/PostDetailScreen.test.jsx`
  - `npm run lint:changed`
  - `npm run type-check:changed`
  - `npm run workflow:check`
- Browser evidence target:
  - In `/posts`, an edited article post shows `已編輯`; clicking it opens a
    history modal with previous title/content.
  - In `/posts/{postId}`, the same edited article post shows `已編輯` in the
    detail card; modal close works and comment history still works.
  - Capture desktop and mobile screenshots plus console/network findings.
- Regression risk and mitigation:
  - Comment history regression: keep `CommentHistoryModal` API stable and run
    post comment runtime/screen tests.
  - Rules overreach: rules tests must continue proving event comments are not
    newly constrained by this feature; no event-comment rules writes are owned.
  - Non-atomic article writes: rules and repo/use-case tests must reject missing
    history, mismatched history id, mismatched timestamp, and fake pre-edit
    title/content.

## Workflow State

- Status schema: v3.
- Current head snapshot: captured from `092-post-edit-history` at
  `9025466aa75b19f3b24737acad5dd5c62126474e` before planning doc edits.
- Remote head snapshot: captured from `origin/main` at
  `b1cdaee96618983d333d1b6da2a78c0312e3b7ba`.
- Last verified commit policy: `lastVerifiedCommit` records the local HEAD/ref
  covered by fresh verification; dirty workflow doc edits must be described in
  `lastVerification` until committed.
- Phase commit checkpoints:
  - `spec_approved`
  - `post_rebase_state`
  - `shared_core`
  - `article_history_persistence_rules`
  - `article_history_ui`
  - `integration_gate`
- Rules deploy status: `required`; implementation is expected to change
  `firestore.rules`, but deploy remains unauthorized.
- Incident handling: any open incident blocks dispatch, commit, push, PR, CI,
  merge, local main sync, and rules deploy until resolved or explicitly carried
  forward.

## Release Boundary

- Firestore/storage rules deploy authorization:
  `authorizationBoundary.deployFirestoreRules=false`.
- Rules deploy is separate from edit, commit, push, PR, CI, merge, and local
  `main` sync.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
- Push, PR creation, CI watch, merge, local `main` sync, and rules deploy are
  not authorized in the current boundary.

## Risk And Stop Conditions

- Stop if implementation needs migration/backfill for existing posts.
- Stop if article post history path changes away from
  `/posts/{postId}/history/{historyId}`.
- Stop if article history read visibility would differ from active post read
  visibility without user approval.
- Stop if strict parent/history validation cannot be expressed without a broad
  rules rewrite.
- Stop if event comment rules or event comment mutation behavior must change.
- Stop if a new dependency, package-lock change, schema migration, destructive
  operation, or rules deploy is required.
- Stop if same-wave tasks need overlapping owned files.

## Task Slices

- T001: Shared edit-history core and comment compatibility.
- T002: Article post history persistence, strict rules, and cleanup.
- T003: Article post list/detail UI wiring and browser evidence.
- T004: Final integration verification and workflow state sync.
