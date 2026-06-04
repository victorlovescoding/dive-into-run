# Article Post Edit History Plan

## Summary

Current phase: `integration`. T001, T002, T003A, and T003 are completed and
committed. T003 article post list/detail UI wiring is committed as
`article_history_ui` at `4d80d098a4f2e2cb65387f55db8c9f1d4a4cc296` with
Reviewer `review_passed` and Browser/Playwright evidence PASS. T004 final
integration verification was committed as `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`; the Firestore-only
rules deploy from that commit is now recorded and awaits deploy-state review.

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
| `eslint.config.mjs` | Modify in T003A only | Keep browser/jsdom tests linted by including `tests/browser/**` in the type-aware lint project service/default-project coverage. |
| `tsconfig.json` | Modify in T003A only | Include browser/jsdom tests in the TypeScript project graph when needed for type-aware linting. |

## Verification Strategy

- Required local gates:
  - `npx vitest run tests/browser/runtime/hooks/useEditHistoryModal.test.jsx tests/browser/components/EditHistoryModal.test.jsx tests/browser/components/CommentHistoryModal.test.jsx`
  - `npx vitest run tests/browser/runtime/hooks/usePostComments.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx`
  - `npx vitest run tests/browser/service/post-service.test.js tests/browser/runtime/client/use-cases/post-use-cases.test.js`
  - `firebase emulators:exec --only auth,firestore --project dive-into-run "npx vitest run tests/server/firestore/post-soft-delete-rules.test.js"`
  - `npx vitest run tests/browser/runtime/hooks/usePostsPageRuntime.test.jsx tests/browser/runtime/hooks/usePostDetailRuntime.test.jsx tests/browser/ui/posts/PostsPageScreen.test.jsx tests/browser/ui/posts/PostDetailScreen.test.jsx`
  - `npm run lint:changed`
  - `npm run lint -- --max-warnings 0`
  - `npm run type-check`
  - `npm run type-check:changed`
  - `npm run workflow:check`
- Browser evidence target:
  - Browser setup may sign in through the app, create an article post, edit that
    article post, and then capture evidence for that same edited article. This
    is allowed only through app/browser interaction and must not require code,
    test, config, seed, or fixture changes.
  - In `/posts`, the edited article post shows `已編輯`; clicking it opens a
    history modal with previous title/content.
  - In `/posts/{postId}`, the same edited article post shows `已編輯` in the
    detail card; modal close works and comment history still works when a
    suitable edited comment already exists or can be created through the app.
  - Capture desktop and mobile screenshots plus console/network findings.
  - If deterministic seeded data or a code/data fixture becomes required to
    produce evidence, stop and add a separate fixture task instead of widening
    T003 or T003A.
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
  `3f83371be5cf7ef3c59aee463c006a4930a4f5e2` (`3f83371 Record final integration verification`) after T004 commit.
- Remote head snapshot: captured from `origin/main` at
  `14515eee2d730d25c7f73fa8eb5c1315504787e8`; current branch reports ahead 10
  and behind 0 relative to `origin/main`.
- Post-rebase test-layout migration: T001 browser/jsdom tests live under
  `tests/browser/...` and are committed in the current head.
- T003 blocker: resolved. T003A fixed type-aware ESLint project coverage for
  `tests/browser/**`; T003 later resolved the no-restricted-syntax
  `toHaveBeenCalledTimes(N)` issue and T004 reran Browser/Playwright article
  history evidence against emulator-backed local data.
- T004 state: committed as `integration_gate`; deploy-state record is pending review and must not be treated as feature closeout.
- Last verified commit policy: `lastVerifiedCommit` records the local HEAD/ref
  covered by fresh verification; dirty workflow doc edits must be described in
  `lastVerification` until committed.
- Phase commit checkpoints:
  - `spec_approved`
  - `post_rebase_state`
  - `plan_and_tasks`
  - `shared_core`
  - `shared_core_test_layout`
  - `article_history_persistence_rules`
  - `browser_test_lint_config`
  - `article_history_ui`
  - `integration_gate` -> `3f83371be5cf7ef3c59aee463c006a4930a4f5e2`
- Rules deploy status: `deployed`; T002 changed `firestore.rules`, so
  `required=true` and `changed=true` remain. Deploy evidence records project
  `dive-into-run`, command `firebase deploy --only firestore:rules`, target
  `cloud.firestore/firestore.rules`, and deployedCommit=`3f83371be5cf7ef3c59aee463c006a4930a4f5e2`.
  Only Firestore rules were deployed; hosting, functions, storage, and indexes
  were not deployed.
- Incident handling: any open incident blocks dispatch, commit, push, PR, CI,
  merge, local main sync, and rules deploy until resolved or explicitly carried
  forward.

## Release Boundary

- Firestore/storage rules deploy authorization:
  `authorizationBoundary.deployFirestoreRules=true` for the already executed Firestore-only rules deploy.
- Rules deploy is separate from edit, commit, push, PR, CI, merge, and local
  `main` sync.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
- Push, PR creation, CI watch, merge, and local `main` sync remain unauthorized.
- No additional deploy is authorized; the recorded deploy was Firestore rules only.

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
- T003A: Browser test lint configuration for `tests/browser/**`.
- T003: Article post list/detail UI wiring and browser evidence.
- T004: Final integration verification and workflow state sync.
