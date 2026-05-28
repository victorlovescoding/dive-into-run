# Post And Comment Soft Delete Retention Handoff

## Current State

- Branch: `codex/post-comment-soft-delete-retention-spec`
- Spec commit: `8b7e74b3c0fd3f9efc378b0d1f7a16ed5d92f6ef`
- Current phase: local implementation complete. T001 through T006 are completed
  with final local verification and Reviewer PASS. The implementation remains
  dirty/uncommitted in this worktree.
- User approved the written spec on 2026-05-28.
- Implementation edits are authorized. Commit, push, PR, CI watch, merge,
  local main sync, Firestore rules deploy, and Firebase Functions deploy are
  not authorized.

## Read Order On Resume

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `specs/post-comment-soft-delete-retention/spec.md`
5. `specs/post-comment-soft-delete-retention/plan.md`
6. `specs/post-comment-soft-delete-retention/tasks.md`
7. `specs/post-comment-soft-delete-retention/status.json`

## Key Decisions

- User chose notification eligibility based on active comments only.
- User chose Firebase scheduled functions for automatic 90-day purge because
  deployment hosting for the Next app is undecided.
- User chose post delete as O(1): mark only the post document deleted, then
  purge the full post tree after retention expires.
- User chose comment delete as per-comment soft delete with `commentsCount`
  decrement.
- User chose no restore behavior.
- Purge code must live inside the `functions/` deploy boundary or an explicitly
  shared module included by that package. It must not depend on root `@/` alias.

## Latest Verification

- Before spec commit, commit hook passed lint, type-check, depcruise,
  spellcheck, workflow check, workflow links, and use-effect audit.
- Planning artifact self-review on 2026-05-27T18:25Z:
  - `rg -n "TBD|TODO|<[^>]+>|fill in|implement later|Similar to Task|appropriate error|add validation|handle edge cases|\\?\\?" specs/post-comment-soft-delete-retention`: exit 1, no placeholders.
  - `git diff --check -- specs/post-comment-soft-delete-retention`: exit 0.
  - `npm run workflow:check`: exit 0, 9 status files valid and synced.
- T001 attempt 1 on 2026-05-27T18:44Z:
  - RED evidence: root-path service test failed because soft-delete helper
    exports were missing.
  - GREEN evidence: root-path service test passed after helper implementation.
  - Blocker: `npm run lint:changed` failed because root `tests/unit/**` is not
    included in `tsconfig.json`; browser/unit feature tests must live under
    `specs/post-comment-soft-delete-retention/tests/**`.
  - Coordinator updated T001/T002/T003/T005 browser test paths to spec-local
    paths. Server rules test remains under `tests/server/**` because the server
    Vitest project includes that path.
- T001 attempt 2 on 2026-05-27T18:47Z:
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js`:
    exit 0, 1 file / 4 tests passed.
  - `npm run lint:changed`: exit 0, existing React version settings warning
    only.
  - `npm run type-check:changed`: exit 0.
  - Spec review: `review_passed`, no spec-compliance issues found.
  - Code quality review: `review_passed`, no code-quality issues found.
- T002 final on 2026-05-27T22:39Z:
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js`:
    exit 0, 12 tests passed.
  - `npm run lint:changed`: exit 0, existing React version settings warning
    only.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check --` T002 files: exit 0.
  - Spec review: `review_passed`, no spec-compliance issues found.
  - Code quality review: final `review_passed`, no code-quality issues found.
- T003 final on 2026-05-27T23:06Z:
  - Focused T003 Vitest tests: exit 0, 4 files / 9 tests passed.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0.
  - Spec review: `review_passed`, no spec-compliance issues found.
  - Code quality review: `review_passed`, no code-quality issues found.
- T004 blocked on 2026-05-27T23:31Z:
  - Direct post/comment rules implementation reached emulator GREEN, but code
    quality/security review rejected the recursive collectionGroup rule.
  - CollectionGroup coverage reproduced the blocker: the required emulator
    command exited 1 with 11 tests run and 2 failures for active post and event
    comment collectionGroup list queries.
  - Firestore error: `Variable is not bound in path template. for 'list'`.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0.
- T004 redesign engineer_done on 2026-05-28T05:30Z:
  - Root cause confirmed: Firestore rules-only cannot safely bind recursive
    parent paths for broad `collectionGroup('comments')` list queries while post
    delete remains parent-only/O(1).
  - Chosen fix: member dashboard comments now use `/api/member/comments` with
    `Authorization: Bearer <Firebase ID token>`; Admin SDK queries own comments
    by `authorUid == uid` and `createdAt desc`, then filters deleted comments
    and comments under missing/deleted post parents. Event direct comment
    behavior remains unchanged.
  - Firestore rules now reject broad client `collectionGroup('comments')`
    reads; direct `posts/{postId}/comments/{commentId}` still requires active
    parent post and direct event comment reads remain allowed.
  - RED: focused runtime test failed before
    `src/repo/server/firebase-member-comments-server-repo.js` existed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js`:
    exit 0, 1 file / 7 tests passed.
  - `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"`:
    exit 0, 1 file / 10 tests passed.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0.
  - No Firestore rules, Firebase Functions, indexes, app, commit, push, PR, CI
    watch, merge, or local main sync was run.
- T004 review rejection fixed on 2026-05-28T05:49Z:
  - Code-quality/security review rejected attempt 4 because the API accepted raw
    Firestore cursor paths and used `adminDb.doc(afterCursor).get()` without
    path/ownership validation. It also rejected unbounded server recursion that
    could scan unlimited deleted/missing-parent comments in one request.
  - Attempt 5 validates cursor paths against exactly
    `posts/{postId}/comments/{commentId}` or
    `events/{eventId}/comments/{commentId}`, loads only valid comment cursor
    docs, and requires cursor `authorUid` to match the verified uid. Invalid
    cursor errors map to HTTP 400.
  - Attempt 5 adds a raw comment scan budget per server request. If the budget
    is exhausted before enough visible comments are found, the response returns
    the last scanned raw comment cursor so a later request can continue without
    skipping active comments.
  - RED: new cursor-security and raw-budget tests failed because
    `fetchVisibleMemberCommentDocumentsPage()` did not exist.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js`:
    exit 0, 1 file / 10 tests passed.
  - `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"`:
    exit 0, 1 file / 10 tests passed.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0.
  - Spec compliance review: `review_passed`, no findings.
  - Code-quality/security re-review after attempt 5 rejection fix:
    `review_passed`, no blocking findings.
  - No Firestore rules, Firebase Functions, indexes, app, commit, push, PR, CI
    watch, merge, or local main sync was run.
- T005 final on 2026-05-28T00:33Z:
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js`:
    exit 0, 1 file / 9 tests passed.
  - `node --check functions/index.js`: exit 0.
  - `node --check functions/post-retention-purge.js`: exit 0.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0.
  - `rg "@/|src/|\\.\\./src" functions/*.js`: exit 1, no root source or alias
    imports.
  - `git diff --check --` T005 files: exit 0.
  - Spec review: final `review_passed`, no spec-compliance issues found.
  - Code quality/security review: final `review_passed`, no blocking findings.
  - No Firebase Functions, Firestore rules, or Firestore index deploy was run.
- T006 final integration verification on 2026-05-28T06:01:40Z:
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/post-service-soft-delete.test.js`:
    exit 0, 1 file / 4 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/post-soft-delete-use-cases.test.js`:
    exit 0, 1 file / 12 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/member-dashboard-soft-delete.test.js`:
    exit 0, 1 file / 2 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/service/content-favorite-soft-delete.test.js`:
    exit 0, 1 file / 2 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/member-dashboard-soft-delete-use-cases.test.js`:
    exit 0, 1 file / 10 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/runtime/notification-soft-delete.test.js`:
    exit 0, 1 file / 3 tests passed.
  - `npx vitest run --project=browser specs/post-comment-soft-delete-retention/tests/unit/functions/post-retention-purge.test.js`:
    exit 0, 1 file / 9 tests passed.
  - `firebase emulators:exec --only auth,firestore --project=demo-test "npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js"`:
    exit 0, 1 file / 10 tests passed.
  - `node --check functions/index.js`: exit 0.
  - `node --check functions/post-retention-purge.js`: exit 0.
  - `npm run lint:changed`: exit 0, existing React version warning only.
  - `npm run type-check:changed`: exit 0, no type errors in changed files.
  - `npm run workflow:check`: exit 0, 9 status files valid and synced.
  - `git diff --check`: exit 0.
  - T006 Reviewer review passed on 2026-05-28T06:09:10Z. Reviewer reran
    `npm run workflow:check` exit 0 and `git diff --check` exit 0, confirmed
    workflow state is synced, evidence is dirty-working-tree scoped, and no
    unauthorized release boundary was crossed.
  - `lastVerifiedCommit` remains null because evidence covers dirty local
    working tree, not a committed implementation.
  - `rulesDeployStatus.state` remains `required`; no deploy evidence,
    deployed commit, commit, push, PR, CI watch, merge, local main sync,
    Firestore rules deploy, or Firebase Functions deploy was run.

## Next Action

Local implementation and workflow verification are complete. Next steps require
explicit authorization for the relevant release boundary: staging concrete
files, commit, push, PR, CI watch, merge, local main sync, Firestore rules
deploy, Firebase Functions deploy, and index deploy are all still unauthorized.
Do not claim deployed rules/functions/indexes or product deployment; this branch
only has local implementation and local verification evidence.

## Pitfalls

- Firestore rules are not filters. The dashboard comments query is now a server
  boundary; do not reintroduce direct client `collectionGroup('comments')`.
- Firestore collectionGroup list rules cannot use an unbound recursive parent
  path to read parent post state. Do not retry that rules-only approach.
- The approved plan avoids a data backfill migration. Stop if implementation
  appears to require backfilling legacy posts/comments.
- `functions/` is a separate deploy package. Root `src/**` aliases are not
  available there by default.
- Rules deploy and Functions deploy are separate release boundaries.
- `.superpowers/` is currently untracked in this workspace and unrelated to
  this feature.
- Root `tests/unit/**` is not inside `tsconfig.json`; do not create browser
  unit tests there unless the plan explicitly includes an ESLint/tsconfig
  change.
