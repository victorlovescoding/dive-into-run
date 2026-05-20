# Saved Content Favorites Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/065-saved-content-favorites/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer subagents, including code, executable tests, docs, workflow docs, ADRs, `.codex/**`, scripts, and config.
- Planner subagent slices repo-changing work. Main validates Planner output and dispatches; it does not self-slice repo-changing work.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence is one command per entry. Do not combine commands with shell chain operators.
- Current workflow phase: `deployed_ready_for_local_sync`.
- Current HEAD: `34664f89d2f18ee707079886779348c8b01bcedc`; remote `origin/main` was last observed at `34664f89d2f18ee707079886779348c8b01bcedc` after PR #99 squash merge.
- Origin main base observed: `55130520c0e1ff9a5222bf3c6c2f41dfd97be3ed`.
- Historical branch commits already pushed before this repair: `e7394450f7393481a1bcc418ab6e0726993e240d` Add private content favorites; `d6ac09f9a64f694833be097e1a816f3bc2806a5c` Fix event detail landmark.
- Workflow/state repair commit: `95be04b582eb7c682d1a098f1cb3fac4aa66ee6a` Harden workflow closeout state.
- PR #99 squash merge commit on main: `34664f89d2f18ee707079886779348c8b01bcedc` Add saved content favorites (#99).
- Latest Plan Reviewer decision: `review_passed`.
- Plan Reviewer summary at review close: Planner plan, tasks, and status covered FR-001 through FR-025; prior findings were closed; status was valid and synced; no workflow drift; implementation was still unauthorized.
- User implementation edit authorization granted on 2026-05-19 by message `開工`.
- Current closeout authorization boundary: stage=true, commit=true, push=true, pullRequest=true, ciWatch=true, merge=true, localMainSync=true, deployFirestoreRules=true.
- Active task: none. Active wave: none.
- T004, T005, and T006 completed after Reviewer PASS and Coordinator state sync.
- T007 completed after script mapping, focused E2E cleanup, final verification, Reviewer PASS, and Coordinator state sync.
- Post-T007 permission-denied fallback was implemented and reviewed after the user report; the incident is resolved by durable recording plus fresh local verification.
- CI workflow state incident resolved: GitHub CI run `26150844340` failed `Workflow state check` while local `npm run workflow:check` passed. Root cause was GitHub shallow checkout missing ancestor commit objects for the closeout range guard; fix is CI checkout `fetch-depth: 0` plus allowlisting exactly `.github/workflows/ci.yml` as workflow evidence. Reviewer PASS was recorded for the checkout-depth fix, and rerun CI `26151638769` succeeded.
- PR #100 workflow links incident resolved: GitHub CI run `26152944921` failed `Workflow links check` while prior local `npm run workflow:links` passed because an untracked empty `specs/saved-content-favorites/` directory existed locally. GitHub checkout does not preserve empty directories, so inline-code examples in `docs/superpowers/workflow.md` and `.agents/skills/worktree/SKILL.md` pointed at a missing path. Fix: update both examples to existing `specs/065-saved-content-favorites/` and record the incident in handoff/tasks/status.
- Rules deploy status: deployed after PR #99 merge. `firebase deploy --only firestore:rules --project dive-into-run` exited 0, compiled `firestore.rules`, and released rules to `cloud.firestore`.
- Last verified commit: `34664f89d2f18ee707079886779348c8b01bcedc`.
- Blocked: no. Ready for deploy-evidence state PR/merge and final local main sync under the current explicit closeout authorization.

## Team And Parallelism

- Default: one Engineer and one Reviewer pair at a time.
- Same-wave parallelism is optional only for T004 and T005 after T001 and T003 pass review.
- If T004 and T005 run in parallel, assign separate Engineer and Reviewer lanes and keep owned files disjoint.
- T001, T002, T003, T006, T007, rules, shared UI primitives, ToastProvider, workflow state, commit, push, PR, merge, and local sync are serialized.
- T001 completed after Reviewer PASS and Coordinator state sync.
- T002 completed after Reviewer PASS and Coordinator state sync.
- T003 completed after Reviewer PASS and Coordinator state sync.
- T004 and T005 completed after same-wave parallel implementation, Reviewer PASS, and Coordinator state sync.
- T006 completed after Reviewer PASS and Coordinator state sync.
- T007 completed after Reviewer PASS and Coordinator state sync. Product code edits, package/config edits, commit, push, PR, merge, CI watch, deploy, and local main sync remain unauthorized for future work.

## Planner Output

- Dependency graph:
  - Plan review PASS and user implementation edit authorization are prerequisites for every task.
  - T001 before T004, T005, and T006.
  - T002 before T003 and T006.
  - T003 before T004 and T005.
  - T004, T005, and T006 before T007.
- Parallel waves:
  - `wave-1`: T001.
  - `wave-2`: T002.
  - `wave-3`: T003.
  - `wave-4`: T004 and T005 completed after separate Engineer/Reviewer lanes.
  - `wave-5`: T006 completed.
  - `wave-6`: T007 completed after branch-gate script mapping, focused E2E, final integration gates, Reviewer PASS, and Coordinator state sync.
- Final integration gate:
  - Run T007 verification commands after T001 through T006 pass review and state is synced.
  - Browser evidence is required for all UI routes listed in T004, T005, and T006.
  - Closeout is authorized by the current boundary after fresh verification.

## Tasks

### T001 - Firestore Favorites Foundation And Rules

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer lane 1, data and rules
- **Reviewer**: Reviewer lane 1, security and data contract
- **Commit checkpoint**: planned `feat: add favorites data foundation`, not authorized now
- **Authorization boundary**: implementation edit completed for T001 owned files only, commit=no, push=no, PR=no, merge=no, CI-watch=no, local-main-sync=no
- **Authorization evidence**: user granted implementation edit authorization on 2026-05-19 by message `開工`

Scope:

- Create the canonical data, service, and use-case boundary for post and event favorites.
- Add owner-only Firestore rules for `favoritePosts` and `favoriteEvents`.
- Add server rules tests and focused unit coverage for the data contract.
- Enforce favorite documents with only `targetId` and `createdAt`.

Non-scope:

- No UI, route, toast, or browser behavior changes.
- No public counts, tags, manual sort, notifications, recommendations, snapshots, migrations, or dependency changes.
- Do not modify files outside the owned files.
- Do not stage, commit, push, open a PR, merge, or sync local main.

Owned files:

- `src/repo/client/firebase-content-favorites-repo.js`
- `src/service/content-favorite-service.js`
- `src/runtime/client/use-cases/content-favorite-use-cases.js`
- `firestore.rules`
- `tests/server/rules/content-favorites.rules.test.js`
- `tests/unit/service/content-favorite-service.test.js`
- `tests/unit/runtime/content-favorite-use-cases.test.js`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-contract.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `.codex/references/quality-gates.md`
- `firestore.rules`
- `firestore.indexes.json`
- `src/repo/client/firebase-weather-favorites-repo.js`
- `src/repo/client/firebase-posts-repo.js`
- `src/repo/client/firebase-events-repo.js`
- `src/runtime/client/use-cases/post-use-cases.js`
- `src/runtime/client/use-cases/event-use-cases.js`
- `tests/unit/runtime/useWeatherFavorites.test.jsx`

Dependencies:

- Plan Reviewer PASS.
- Explicit user implementation edit authorization.

Browser evidence:

- Not applicable for this non-UI slice.

Engineer instructions:

- RED: add rules tests that prove owner read, owner create, owner delete, cross-user read denial, cross-user create denial, cross-user delete denial, update denial, invalid extra field denial, and doc id mismatch denial for both favorite collections.
- RED: add service and use-case tests that prove the favorite payload stores only `targetId` and `createdAt`, maps post and event collection names correctly, fetches favorite docs newest first, returns favorite id sets by target id, and returns missing target entries without dropping the favorite record.
- Run the T001 focused test commands and record the failing signals before implementation.
- GREEN: implement `firebase-content-favorites-repo` with Firestore SDK calls only. Use target id as favorite document id. Use `serverTimestamp()` for add. Use ordered owner subcollection queries for favorites page reads. Use direct doc reads for target resolution.
- GREEN: implement `content-favorite-service` with explicit post and event type mapping, payload validation, normalized favorite item shape, and missing-target shape.
- GREEN: implement use-cases that keep product decisions out of UI and runtime hooks.
- Modify `firestore.rules` so `users/{userId}/favoritePosts/{postId}` and `users/{userId}/favoriteEvents/{eventId}` allow owner read, create, and delete only, reject update, require doc id to match `targetId`, and reject fields beyond `targetId` and `createdAt`.
- Keep Firestore index changes out unless a focused command proves an index is required for the owner subcollection order query.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: Favorite docs are written only under `users/{uid}/favoritePosts/{postId}` and `users/{uid}/favoriteEvents/{eventId}`.
- AC-T001.2: Favorite docs contain `targetId` and `createdAt` only.
- AC-T001.3: Add, remove, list, batch status lookup, and latest target resolution use canonical repo, service, and use-case boundaries.
- AC-T001.4: Missing target documents are represented without failing the whole favorites page load.
- AC-T001.5: Rules tests prove owner-only read, create, delete, update rejection, cross-user denial, extra field denial, and doc id mismatch denial.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npm run test:server -- tests/server/rules/content-favorites.rules.test.js` | Exit 0, all content favorite rules tests pass. |
| `npx vitest run --project=browser tests/unit/service/content-favorite-service.test.js` | Exit 0, service contract tests pass. |
| `npx vitest run --project=browser tests/unit/runtime/content-favorite-use-cases.test.js` | Exit 0, use-case tests pass. |
| `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Rules enforce owner-only read, create, delete and reject update for both favorite collections.
- Rules tests include cross-user denial, invalid payload denial, and doc id mismatch denial for both favorite collections.
- Use-cases do not store target snapshots or public metadata.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Diff permits public or cross-user favorite access.
- Diff permits update on favorite docs.
- Diff stores title, summary, author, event data, public count, tag, sort, notification, or recommendation metadata.
- Diff changes package files or Firestore indexes without evidence and coordinator approval.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer report: implemented T001 owned data/rules/use-case foundation and focused tests.
- Reviewer report: final decision `review_passed`; no blocking findings.
- Reviewer residual risk: no direct test for payload `targetId: ''` against a normal doc id; current rule rejects via doc-id equality plus regex and empty doc ID is not a real matching path, so non-blocking.
- Command output summary:
  - `npm run test:server -- tests/server/rules/content-favorites.rules.test.js`: exit 0, 30 passed.
  - `npx vitest run --project=browser tests/unit/service/content-favorite-service.test.js`: exit 0, 7 passed.
  - `npx vitest run --project=browser tests/unit/runtime/content-favorite-use-cases.test.js`: exit 0, 8 passed.
  - `npm run lint:changed`: exit 0, existing React-version warning only.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check`: exit 0.
- Changed files summary:
  - `firestore.rules`
  - `src/repo/client/firebase-content-favorites-repo.js`
  - `src/service/content-favorite-service.js`
  - `src/runtime/client/use-cases/content-favorite-use-cases.js`
  - `tests/server/rules/content-favorites.rules.test.js`
  - `tests/unit/service/content-favorite-service.test.js`
  - `tests/unit/runtime/content-favorite-use-cases.test.js`

### T002 - Toast Undo Action Support

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer lane 1, shared runtime UI
- **Reviewer**: Reviewer lane 1, shared runtime UI
- **Commit checkpoint**: planned `feat: support toast undo actions`, not authorized now
- **Authorization boundary**: implementation edit=yes for T002 owned files only, commit=no, push=no, PR=no, merge=no, CI-watch=no, local-main-sync=no
- **Authorization evidence**: user granted T002 owned-file implementation edit authorization on 2026-05-19 by message `繼續啊`

Scope:

- Add optional action support to existing toast infrastructure for undo.
- Preserve existing `showToast(message, type)` behavior and existing call sites.
- Add integration coverage for action rendering and click behavior.

Non-scope:

- No favorites data model, page, post, or event UI changes.
- No notification system changes.
- No dependency changes.
- Do not modify files outside the owned files.

Owned files:

- `src/runtime/providers/ToastProvider.jsx`
- `src/runtime/providers/ToastProvider.d.ts`
- `src/components/Toast.jsx`
- `src/components/Toast.module.css`
- `tests/integration/shared/ToastUndo.test.jsx`

Read-only context:

- `AGENTS.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `.codex/references/quality-gates.md`
- `src/runtime/hooks/useWeatherFavorites.js`
- `tests/unit/runtime/useWeatherFavorites.test.jsx`

Dependencies:

- Plan Reviewer PASS.
- Explicit user implementation edit authorization.

Browser evidence:

- Not applicable for this shared primitive slice; T006 captures the undo journey in Browser.

Engineer instructions:

- RED: add integration tests proving `showToast('訊息', 'success')` still renders a legacy toast, and `showToast('已取消收藏', 'success', action)` renders an action button that invokes the supplied callback once when clicked.
- RED: include a test that the close button still removes the toast.
- Run the T002 focused test command and record the failing signal before implementation.
- GREEN: extend Toast item and context types with an optional action object containing a label and callback.
- GREEN: keep the existing two-argument showToast API working by making action optional as a third argument.
- GREEN: render the action button only when action exists, with accessible button text.
- GREEN: keep success and info auto-dismiss behavior. If a toast has an undo action, auto-dismiss may still remove it after the existing delay.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: Existing toast call sites do not need changes.
- AC-T002.2: A toast can render an undo action button.
- AC-T002.3: Clicking undo invokes the supplied callback and leaves removal behavior explicit through existing close or reducer flow.
- AC-T002.4: Toast types remain JSDoc and d.ts aligned.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/integration/shared/ToastUndo.test.jsx` | Exit 0, toast undo integration tests pass. |
| `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff preserves legacy toast API behavior.
- Undo action is accessible and does not require new dependencies.
- Tests prove legacy and action paths.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Existing `showToast(message, type)` call sites break.
- Undo action cannot be activated by keyboard.
- Toast action support leaks favorites-specific logic into ToastProvider.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer RED evidence: `npx vitest run --project=browser tests/integration/shared/ToastUndo.test.jsx`: exit 1; expected failure 2 failed / 2 passed, action button `復原` not found while legacy/close tests passed.
- Reviewer report: final decision `review_passed`; no blocking findings.
- Reviewer check highlights:
  - Legacy `showToast(message, type)` preserved; optional third arg action in `ToastProvider.jsx` / `ToastProvider.d.ts`.
  - Action renders only when present and is native `<button>` in `Toast.jsx`.
  - Close still calls `onClose(id)`.
  - success/info auto-dismiss remains 3000ms; error does not auto-dismiss.
  - No favorites-specific logic.
  - Tests cover legacy, action render/click, close remove.
- Command output summary:
  - `npx vitest run --project=browser tests/integration/shared/ToastUndo.test.jsx`: exit 0, 1 file / 4 tests passed.
  - `npm run lint:changed`: exit 0, existing React version settings warning only.
  - `npm run type-check:changed`: exit 0, no changed-file type errors.
  - `git diff --check`: exit 0.
- Residual risks:
  - Branch-wide tests not run; only T002 required verification.
  - Untracked test file required direct read during review; closeout must stage precise files later.
- Changed files summary:
  - `src/runtime/providers/ToastProvider.jsx`
  - `src/runtime/providers/ToastProvider.d.ts`
  - `src/components/Toast.jsx`
  - `src/components/Toast.module.css`
  - `tests/integration/shared/ToastUndo.test.jsx`

### T003 - Shared Bookmark Button Primitive

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer lane 1, shared UI
- **Reviewer**: Reviewer lane 1, accessibility and UI
- **Commit checkpoint**: planned `feat: add bookmark button primitive`, not authorized now
- **Authorization boundary**: implementation edit=yes for T003 owned files only, commit=no, push=no, PR=no, merge=no, CI-watch=no, local-main-sync=no
- **Authorization evidence**: user granted T003 owned-file implementation edit authorization on 2026-05-19 by message `繼續啊`

Scope:

- Create a reusable bookmark button for posts and events.
- Implement local outline and filled SVG states with no icon dependency.
- Provide accessible `aria-label`, `aria-pressed`, disabled state, and stable icon sizing.
- T003 owned-file implementation edits are authorized by the latest user message `繼續啊` on 2026-05-19.

Non-scope:

- No data fetching or favorite mutation logic.
- No post, event, or member route integration.
- No new icon package.
- Do not modify files outside the owned files.
- Commit, push, PR, merge, CI watch, and local main sync are not authorized.

Owned files:

- `src/components/BookmarkButton.jsx`
- `src/components/BookmarkButton.module.css`
- `tests/integration/shared/BookmarkButton.test.jsx`

Read-only context:

- `AGENTS.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `.codex/references/quality-gates.md`
- `src/components/PostCard.jsx`
- `src/components/PostCard.module.css`
- `src/ui/events/EventsPageScreen.module.css`
- `src/ui/events/EventDetailScreen.module.css`

Dependencies:

- T002.
- Plan Reviewer PASS.
- Explicit user implementation edit authorization.

Browser evidence:

- Not applicable for this primitive slice; placement evidence is required in T004, T005, and T006.

Engineer instructions:

- RED: add integration tests for inactive outline state, active filled state, `aria-pressed`, custom `aria-label`, disabled state, and click callback.
- Run the T003 focused test command and record the failing signal before implementation.
- GREEN: implement `BookmarkButton` as a button that receives `isActive`, `onClick`, `label`, `activeLabel`, `disabled`, and optional `className`.
- GREEN: use local SVG with `fill` based on active state and `stroke` as current color.
- GREEN: keep dimensions stable so adding the button does not resize post or event rows.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: Button is keyboard-operable and exposes `aria-label` plus `aria-pressed`.
- AC-T003.2: Inactive state is outline, active state is filled.
- AC-T003.3: No icon dependency is added.
- AC-T003.4: Component can be used in post feed, post detail, event feed, event detail, and member favorites cards.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/integration/shared/BookmarkButton.test.jsx` | Exit 0, bookmark button tests pass. |
| `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Button has accessible name and pressed state.
- Icon visual states match spec without dependency changes.
- Tests prove active, inactive, disabled, and click behavior.

Reviewer REJECT criteria:

- Button is not a native button.
- Button lacks `aria-pressed` or accessible label.
- New icon dependency is added.
- Verification is missing, stale, failed, or not from the required commands.

Evidence:

- Engineer RED evidence: `npx vitest run --project=browser tests/integration/shared/BookmarkButton.test.jsx`: exit 1; expected failure resolving `@/components/BookmarkButton` because primitive did not exist.
- Reviewer report: final decision `review_passed`; no blocking findings.
- Reviewer check highlights:
  - Native `<button>` with `type="button"`, `aria-label`, `aria-pressed`, `disabled`, and `onClick` in `src/components/BookmarkButton.jsx`.
  - Local inline SVG, no icon dependency, inactive `fill="none"` vs active `fill="currentColor"`.
  - Stable button/icon dimensions in `BookmarkButton.module.css`.
  - Tests cover inactive, active, label, disabled/no-click, enabled click behavior.
- Command output summary:
  - `npx vitest run --project=browser tests/integration/shared/BookmarkButton.test.jsx`: exit 0, 1 file / 5 tests passed.
  - `npm run lint:changed`: exit 0, existing React version settings warning only.
  - `npm run type-check:changed`: exit 0, no changed-file type errors.
  - `git diff --check`: exit 0.
- Residual risks:
  - Branch-wide tests not run; only required T003 verification.
  - Untracked files required direct read during review; closeout must stage precise files later.
  - Route/card integration and browser placement evidence intentionally deferred to later tasks.
- Changed files summary:
  - `src/components/BookmarkButton.jsx`
  - `src/components/BookmarkButton.module.css`
  - `tests/integration/shared/BookmarkButton.test.jsx`

### T004 - Post Feed And Post Detail Favorites

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Engineer lane 1, posts UI and runtime
- **Reviewer**: Reviewer lane 1, posts UI and runtime
- **Commit checkpoint**: planned `feat: add post bookmarks`, not authorized now
- **Authorization boundary**: implementation edit completed for T004 owned files only, commit=no, push=no, PR=no, merge=no, CI-watch=no, local-main-sync=no
- **Authorization evidence**: user granted T004 owned-file implementation edit authorization on 2026-05-19 by message `繼續啊`

Scope:

- Add bookmark buttons to every post feed item and post detail.
- Place the post feed bookmark at the far right of the bottom interaction row container.
- Place the post detail bookmark at the far right of the interaction row below body text.
- Add post favorite load, toggle, optimistic rollback, and toast behavior.

Non-scope:

- No event UI changes.
- No member favorites page.
- No Firestore rules changes beyond T001.
- No changes to like, comment, author menu, share, or post CRUD semantics except passing through favorite props.
- Do not modify files outside the owned files.
- Commit, push, PR, merge, CI watch, and local main sync are not authorized.

Owned files:

- `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/components/PostCard.jsx`
- `src/components/PostCard.module.css`
- `src/ui/posts/PostsPageScreen.jsx`
- `src/ui/posts/PostDetailScreen.jsx`
- `tests/unit/runtime/usePostsPageRuntime.test.jsx`
- `tests/unit/runtime/usePostDetailRuntime.test.jsx`
- `tests/integration/posts/PostCard.test.jsx`
- `tests/integration/posts/PostFeed.test.jsx`
- `tests/integration/posts/PostDetail.test.jsx`

Read-only context:

- `AGENTS.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `.codex/rules/sensors.md`
- `.codex/references/quality-gates.md`
- `src/runtime/client/use-cases/content-favorite-use-cases.js`
- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/components/PostCard.jsx`
- `src/components/PostCard.module.css`
- `src/ui/posts/PostsPageScreen.jsx`
- `src/ui/posts/PostDetailScreen.jsx`
- `tests/unit/runtime/usePostsPageRuntime.test.jsx`
- `tests/unit/runtime/usePostDetailRuntime.test.jsx`
- `tests/integration/posts/PostCard.test.jsx`
- `tests/integration/posts/PostFeed.test.jsx`
- `tests/integration/posts/PostDetail.test.jsx`

Dependencies:

- T001.
- T003.
- Plan Reviewer PASS.
- Explicit user implementation edit authorization.

Browser evidence:

- Required.
- Target URLs: `/posts` and one real `/posts/[id]` route from a visible card.
- Viewports: desktop 1280 by 800 and mobile 390 by 844.
- Expected signal: post feed bookmark is at the far right of the bottom interaction row container; post detail bookmark is at the far right of the interaction row below body text; no overlap; console has no new errors; network has no failed favorite write on unauthenticated click.
- Screenshot artifacts: record paths in Engineer report.

Engineer instructions:

- RED: extend posts runtime tests for favorite id hydration on initial load and next page, unauthenticated toast with no write, add success toast, add failure rollback, remove success toast, and remove failure rollback.
- RED: extend post detail runtime tests for initial favorite load, add, remove, and rollback.
- RED: extend PostCard and page integration tests for bookmark button aria label, pressed state, callback, and far-right meta row placement through class or DOM structure.
- Run the T004 focused test command and record the failing signal before implementation.
- GREEN: load favorite post ids through T001 use-cases when `user.uid` and visible post ids exist. Keep favorite state separate from likes.
- GREEN: implement `handleToggleFavoritePost` in list runtime with optimistic local id set update and required toast strings.
- GREEN: implement detail favorite state and toggle with rollback.
- GREEN: update `PostCard` to render `BookmarkButton` inside `metaBar` at the far right. Keep like and comment controls grouped on the left.
- GREEN: pass favorite state and toggle handler from `PostsPageScreen` and `PostDetailScreen`.
- Use `showToast('請先登入才能收藏', 'info')`, `showToast('已加入收藏', 'success')`, `showToast('收藏失敗，請稍後再試', 'error')`, `showToast('已取消收藏', 'success')`, and `showToast('取消收藏失敗，請稍後再試', 'error')` exactly for the matching cases.
- Modify only the owned files above.

Acceptance criteria:

- AC-T004.1: Every post feed item renders an accessible bookmark button.
- AC-T004.2: Post feed bookmark is far right of the bottom interaction row container.
- AC-T004.3: Post detail bookmark is far right in the interaction row below body text.
- AC-T004.4: Bookmark outline and filled states match favorite state.
- AC-T004.5: Unauthenticated click shows login toast and performs no favorite write.
- AC-T004.6: Add and remove success and failure rollback toasts match spec.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/usePostsPageRuntime.test.jsx tests/unit/runtime/usePostDetailRuntime.test.jsx tests/integration/posts/PostCard.test.jsx tests/integration/posts/PostFeed.test.jsx tests/integration/posts/PostDetail.test.jsx` | Exit 0, post favorite unit and integration tests pass. |
| `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Bookmark placement matches post feed and detail requirements.
- Runtime rollback restores previous favorite state on failed add or remove.
- Toast messages match the spec exactly.
- Browser evidence includes desktop and mobile for `/posts` and `/posts/[id]`.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Bookmark appears only next to like or comment icons instead of the far right row edge.
- Detail bookmark is not in the body interaction row.
- Unauthenticated click writes to Firestore or lacks login toast.
- Failure path does not rollback UI state.
- Verification or Browser evidence is missing, stale, failed, or incomplete.

Evidence:

- Engineer report: implemented T004 owned post feed/detail favorite state, bookmark placement, unauthenticated guard, optimistic rollback, and exact toast behavior.
- Reviewer report: final decision `review_passed`; no blocking findings.
- Reviewer check highlights:
  - Feed/detail placement at far-right row edge.
  - Detail bookmark is in the body interaction row below body text.
  - Unauthenticated toast returns before write.
  - Rollback restores prior favorite state.
  - Toast strings match the spec exactly.
- Browser evidence:
  - Report: `/private/tmp/dive-favorites-browser-evidence/report.json`.
  - `/posts` desktop/mobile: 8 bookmark buttons, `rightGapToRow=0`.
  - `/posts/[id]` desktop/mobile: 1 bookmark, `rightGapToRow=0`.
  - Unauthenticated `/posts` desktop/mobile: login toast visible and `favoriteRequests` empty.
  - Screenshots under `/private/tmp/dive-favorites-browser-evidence/`.
- Command output summary:
  - `npx vitest run --project=browser tests/unit/runtime/usePostsPageRuntime.test.jsx tests/unit/runtime/usePostDetailRuntime.test.jsx tests/integration/posts/PostCard.test.jsx tests/integration/posts/PostFeed.test.jsx tests/integration/posts/PostDetail.test.jsx`: exit 0, 5 files / 68 tests passed.
  - `npm run audit:use-effect-data-fetching`: exit 0, 0 findings.
  - `npm run lint:changed`: exit 0, existing React-version warning only.
  - `npm run type-check:changed`: exit 0, no changed-file type errors.
  - `git diff --check`: exit 0, no whitespace errors.
- Changed files summary:
  - `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
  - `src/runtime/hooks/usePostsPageRuntime.js`
  - `src/runtime/hooks/usePostDetailRuntime.js`
  - `src/components/PostCard.jsx`
  - `src/components/PostCard.module.css`
  - `src/ui/posts/PostsPageScreen.jsx`
  - `src/ui/posts/PostDetailScreen.jsx`
  - `tests/unit/runtime/usePostsPageRuntime.test.jsx`
  - `tests/unit/runtime/usePostDetailRuntime.test.jsx`
  - `tests/integration/posts/PostCard.test.jsx`
  - `tests/integration/posts/PostFeed.test.jsx`
  - `tests/integration/posts/PostDetail.test.jsx`

### T005 - Event Feed And Event Detail Favorites

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Engineer lane 2, events UI and runtime
- **Reviewer**: Reviewer lane 2, events UI and runtime
- **Commit checkpoint**: planned `feat: add event bookmarks`, not authorized now
- **Authorization boundary**: implementation edit completed for T005 owned files only, commit=no, push=no, PR=no, merge=no, CI-watch=no, local-main-sync=no
- **Authorization evidence**: user granted T005 owned-file implementation edit authorization on 2026-05-19 by message `繼續啊`

Scope:

- Add bookmark buttons to every event feed card and event detail page.
- Place event feed bookmark in the top-right action cluster near but separate from the host menu.
- Place event detail bookmark in the title-area top-right action cluster near share, status, and menu.
- Add event favorite load, toggle, optimistic rollback, and toast behavior.

Non-scope:

- No post UI changes.
- No member favorites page.
- No changes to join, leave, event edit, event delete, comments, map, or share behavior except action cluster layout.
- Do not modify files outside the owned files.
- Commit, push, PR, merge, CI watch, and local main sync are not authorized.

Owned files:

- `src/runtime/hooks/useEventsPageRuntime.js`
- `src/runtime/hooks/useEventDetailRuntime.js`
- `src/ui/events/EventsPageScreen.jsx`
- `src/ui/events/EventsListSection.jsx`
- `src/ui/events/EventsPageScreen.module.css`
- `src/ui/events/EventDetailScreen.jsx`
- `src/ui/events/EventDetailScreen.module.css`
- `tests/unit/runtime/useEventsPageRuntime.test.jsx`
- `tests/unit/runtime/useEventDetailRuntime.test.jsx`
- `tests/integration/events/EventFavorites.test.jsx`

Read-only context:

- `AGENTS.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `.codex/rules/sensors.md`
- `.codex/references/quality-gates.md`
- `src/runtime/client/use-cases/content-favorite-use-cases.js`
- `src/runtime/hooks/useEventsPageRuntime.js`
- `src/runtime/hooks/useEventDetailRuntime.js`
- `src/ui/events/EventsPageScreen.jsx`
- `src/ui/events/EventsListSection.jsx`
- `src/ui/events/EventsPageScreen.module.css`
- `src/ui/events/EventDetailScreen.jsx`
- `src/ui/events/EventDetailScreen.module.css`
- `tests/unit/runtime/useEventsPageRuntime.test.jsx`
- `tests/unit/runtime/useEventDetailRuntime.test.jsx`
- `tests/e2e/events.spec.js`
- `tests/e2e/event-edit-delete.spec.js`

Dependencies:

- T001.
- T003.
- Plan Reviewer PASS.
- Explicit user implementation edit authorization.

Browser evidence:

- Required.
- Target URLs: `/events` and one real `/events/[id]` route from a visible card.
- Viewports: desktop 1280 by 800 and mobile 390 by 844.
- Expected signal: every event card has bookmark in a top-right action cluster near but separate from the three-dot menu; event detail bookmark appears near share, status, and menu; non-host users still see bookmark when menu is absent; no overlap; console has no new errors.
- Screenshot artifacts: record paths in Engineer report.

Engineer instructions:

- RED: extend event runtime tests for favorite id refresh after initial load, pagination, and filter-driven list replacement; unauthenticated toast with no write; add and remove success; add and remove failure rollback.
- RED: extend event detail runtime tests for initial favorite load, add, remove, and rollback.
- RED: add event integration tests for feed bookmark accessibility, pressed state, separation from host menu, and detail header placement.
- Run the T005 focused test command and record the failing signal before implementation.
- GREEN: maintain a favorite event id set in event list runtime keyed by event id. Refresh it when visible event ids or `user.uid` changes without mutating event data in a loop.
- GREEN: implement `handleToggleFavoriteEvent` with optimistic local id set update and required toast strings.
- GREEN: implement detail favorite state and toggle with rollback.
- GREEN: add `BookmarkButton` to `EventsListSection` in a top-right action cluster that remains separate from the host menu.
- GREEN: add `BookmarkButton` to `EventDetailScreen` in `detailHeaderRight` near share, status, and menu.
- Use the exact toast strings required by T004.
- Modify only the owned files above.

Acceptance criteria:

- AC-T005.1: Every event feed card renders an accessible bookmark button.
- AC-T005.2: Feed bookmark is near but separate from the host menu and remains visible when the menu is absent.
- AC-T005.3: Event detail bookmark is in the title-area top-right action cluster near share, status, and menu.
- AC-T005.4: Bookmark outline and filled states match favorite state.
- AC-T005.5: Unauthenticated click shows login toast and performs no favorite write.
- AC-T005.6: Add and remove success and failure rollback toasts match spec.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventFavorites.test.jsx` | Exit 0, event favorite unit and integration tests pass. |
| `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Bookmark placement matches event feed and event detail requirements.
- Runtime rollback restores previous favorite state on failed add or remove.
- Toast messages match the spec exactly.
- Browser evidence includes desktop and mobile for `/events` and `/events/[id]`.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Bookmark is placed inside the host menu.
- Bookmark is missing for non-host users.
- Detail bookmark is not in the title-area action cluster.
- Unauthenticated click writes to Firestore or lacks login toast.
- Verification or Browser evidence is missing, stale, failed, or incomplete.

Evidence:

- Engineer report: implemented T005 owned event feed/detail favorite state, bookmark placement, unauthenticated guard, optimistic rollback, exact toast behavior, and mobile detail overlap fix.
- Reviewer report: final decision `review_passed`; no blocking findings.
- Reviewer check highlights:
  - Feed bookmark is outside the host menu in `eventCardTopActions`.
  - Detail bookmark is in the title action cluster with share/status/menu.
  - Unauthenticated path returns before writes with exact login toast.
  - Rollback restores prior favorite state.
  - Toast strings match the spec exactly.
  - Mobile detail overlap fix is present.
- Browser evidence:
  - Report: `/private/tmp/dive-favorites-browser-evidence/report.json`.
  - `/events` desktop/mobile: 4 bookmark buttons in row `eventCardTopActions`.
  - `/events/[id]` desktop/mobile: 1 bookmark in row `detailHeaderRight`.
  - No `consoleErrors` or `failedRequests`.
  - Mobile detail has no visible overlap after fix.
  - Unauthenticated `/events` desktop/mobile: login toast visible and `favoriteRequests` empty.
  - Screenshots under `/private/tmp/dive-favorites-browser-evidence/`.
- Command output summary:
  - `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventFavorites.test.jsx`: exit 0, 3 files / 25 tests passed.
  - `npm run audit:use-effect-data-fetching`: exit 0, 0 findings.
  - `npm run lint:changed`: exit 0, existing React-version warning only.
  - `npm run type-check:changed`: exit 0, no changed-file type errors.
  - `git diff --check`: exit 0, no whitespace errors.
- Changed files summary:
  - `src/runtime/hooks/useEventsPageRuntime.js`
  - `src/runtime/hooks/useEventDetailRuntime.js`
  - `src/ui/events/EventsPageScreen.jsx`
  - `src/ui/events/EventsListSection.jsx`
  - `src/ui/events/EventsPageScreen.module.css`
  - `src/ui/events/EventDetailScreen.jsx`
  - `src/ui/events/EventDetailScreen.module.css`
  - `tests/unit/runtime/useEventsPageRuntime.test.jsx`
  - `tests/unit/runtime/useEventDetailRuntime.test.jsx`
  - `tests/integration/events/EventFavorites.test.jsx`

### T006 - Member Favorites Page

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-5`
- **Engineer**: Engineer lane 1, member favorites page
- **Reviewer**: Reviewer lane 1, member favorites page
- **Commit checkpoint**: planned `feat: add member favorites page`, not authorized now
- **Authorization boundary**: implementation edit=yes for T006 owned files only, commit=no, push=no, PR=no, merge=no, CI-watch=no, local-main-sync=no
- **Authorization evidence**: user granted T006 owned-file implementation edit authorization on 2026-05-19 by task dispatch `state-sync-after-wave-4-review`

Scope:

- Add `/member/favorites` route with `收藏文章` and `收藏活動` tabs.
- Add visible `/member` entry labeled `我的收藏` that links to `/member/favorites`.
- Load latest target docs by favorite id and preserve newest favorite order.
- Render linked cards for existing targets and missing-target cards with remove.
- Implement optimistic remove and toast undo restore.

Non-scope:

- No post feed, post detail, event feed, or event detail bookmark placement changes.
- No dashboard tab behavior changes beyond adding the member entry link.
- No target snapshots, public counts, tags, manual sort, notifications, or recommendations.
- Do not modify files outside the owned files.

Owned files:

- `src/app/member/favorites/page.jsx`
- `src/runtime/hooks/useMemberFavoritesRuntime.js`
- `src/ui/member/MemberFavoritesScreen.jsx`
- `src/ui/member/MemberFavoritesScreen.module.css`
- `src/ui/member/MemberPageScreen.jsx`
- `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`
- `tests/integration/member/MemberFavoritesPage.test.jsx`

Read-only context:

- `AGENTS.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `.codex/rules/sensors.md`
- `.codex/references/quality-gates.md`
- `src/runtime/client/use-cases/content-favorite-use-cases.js`
- `src/service/member-dashboard-service.js`
- `src/repo/client/firebase-member-repo.js`
- `src/ui/member/MemberPageScreen.jsx`
- `src/ui/member/DashboardTabsScreen.jsx`

Dependencies:

- T001.
- T002.
- Plan Reviewer PASS.
- Explicit user implementation edit authorization.

Browser evidence:

- Required.
- Target URLs: `/member` and `/member/favorites`.
- Viewports: desktop 1280 by 800 and mobile 390 by 844.
- Expected signal: `/member` has a visible entry labeled exactly `我的收藏` linking to `/member/favorites`; favorites page has two tabs; newest favorites appear first; existing cards link to `/posts/[id]` or `/events/[id]`; missing target card says `內容已不存在`; remove hides item optimistically; undo restores it; console has no new errors.
- Screenshot artifacts: record paths in Engineer report.

Engineer instructions:

- RED: add runtime tests for loading post and event tabs, newest favorite ordering, latest target doc resolution, missing target shaping, optimistic remove, undo restore, remove failure rollback, and restore failure rollback.
- RED: add integration tests for `/member` visible `我的收藏` entry, `/member/favorites` tabs, card links, missing-target remove, and toast undo action.
- Run the T006 focused test command and record the failing signal before implementation.
- GREEN: create a thin App Router page that calls `useMemberFavoritesRuntime` and renders `MemberFavoritesScreen`.
- GREEN: runtime loads favorite posts and favorite events through T001 use-cases. It must not duplicate target title or summary into favorite docs.
- GREEN: UI renders tab buttons with role semantics matching existing dashboard tabs where practical.
- GREEN: remove action updates the list optimistically and calls remove use-case. On success, show `已取消收藏` with undo action. Undo calls add use-case and reloads or restores the item. On remove failure, restore the previous list and show `取消收藏失敗，請稍後再試`.
- GREEN: missing targets render `內容已不存在` and a remove button, with no detail link.
- GREEN: add a visible `/member/favorites` entry labeled exactly `我的收藏` in `MemberPageScreen` for signed-in users.
- Modify only the owned files above.

Acceptance criteria:

- AC-T006.1: `/member` shows a visible signed-in entry labeled exactly `我的收藏` that links to `/member/favorites`.
- AC-T006.2: `/member/favorites` has `收藏文章` and `收藏活動` tabs.
- AC-T006.3: Favorites are ordered by favorite `createdAt` newest first.
- AC-T006.4: Existing target cards route to `/posts/[id]` or `/events/[id]`.
- AC-T006.5: Missing targets render `內容已不存在` and allow remove.
- AC-T006.6: Remove is optimistic and toast undo restores the favorite.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFavoritesRuntime.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | Exit 0, member favorites unit and integration tests pass. |
| `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- `/member` visible entry label is exactly `我的收藏` and its href is `/member/favorites`.
- Favorites page reads latest target docs by id and stores no snapshots.
- Missing target and undo flows are covered by tests.
- Browser evidence includes `/member` and `/member/favorites` on desktop and mobile.
- Verification commands pass with fresh evidence.

Reviewer REJECT criteria:

- Favorites page drops missing targets instead of rendering `內容已不存在`.
- Remove is not optimistic or undo does not restore.
- UI stores target snapshots in favorite docs.
- `/member` entry is missing, not visible, mislabeled, or does not link to `/member/favorites`.
- Verification or Browser evidence is missing, stale, failed, or incomplete.

Evidence:

- Engineer report: implemented T006 member favorites route/page wiring, runtime, signed-in member link, tabs, card links, missing-target handling, optimistic remove, and undo restore coverage.
- Reviewer report: final decision `review_passed`; no findings.
- Reviewer closed previous blockers:
  - `loadType` uses memoized `uid`, not `user.uid`.
  - Dependencies are coherent.
  - Mock user includes `photoURL`, `bio`, and `getIdToken`.
- Contract checks:
  - `/member` signed-in `我的收藏` link routes to `/member/favorites`.
  - `/member/favorites` route/page wiring exists.
  - Tabs `收藏文章` and `收藏活動` are covered.
  - Card hrefs are covered for `/posts/:id` and `/events/:id`.
  - Missing target and undo restore are covered.
- Browser evidence:
  - `/member/favorites` desktop/mobile tabs verified with 0 console errors.
  - `/member` live unauth limitation covered by integration test for signed-in link.
  - Empty live data means cards, missing target, remove, and undo are covered by focused tests.
  - Screenshots: `/private/tmp/t006-desktop-member.png`, `/private/tmp/t006-desktop-member-favorites.png`, `/private/tmp/t006-mobile-member.png`, `/private/tmp/t006-mobile-member-favorites.png`.
- Command output summary:
  - `npx vitest run --project=browser tests/unit/runtime/useMemberFavoritesRuntime.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx`: exit 0, 2 files / 10 tests passed.
  - `npm run audit:use-effect-data-fetching`: exit 0, 0 findings.
  - `npm run lint:changed`: exit 0, existing React settings warning only.
  - `npm run type-check:changed`: exit 0, no changed-file type errors.
  - `git diff --check`: exit 0, no output.
  - `git status --short`: dirty feature worktree as expected.
- Changed files summary:
  - `src/app/member/favorites/page.jsx`
  - `src/runtime/hooks/useMemberFavoritesRuntime.js`
  - `src/ui/member/MemberFavoritesScreen.jsx`
  - `src/ui/member/MemberFavoritesScreen.module.css`
  - `src/ui/member/MemberPageScreen.jsx`
  - `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`
  - `tests/integration/member/MemberFavoritesPage.test.jsx`

### T007 - E2E Coverage And Final Integration Gate

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-6`
- **Engineer**: Engineer lane 1, E2E and integration
- **Reviewer**: Reviewer lane 1, verifier-oriented review
- **Commit checkpoint**: planned `test: cover saved favorites journey`, not authorized now
- **Authorization boundary**: test edit=yes for `tests/e2e/saved-content-favorites.spec.js` and `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`; script mapping edit=yes only for `scripts/test-e2e-branch.sh`; product-code edit=no, package/config edit=no, commit=no, push=no, PR=no, merge=no, CI-watch=no, local-main-sync=no
- **Authorization evidence**: user granted option 1 on 2026-05-19 by message `1`, authorizing T007 test edits only for the two test files above. User granted T007 issue 1 on 2026-05-19 by message `好`, authorizing only the `scripts/test-e2e-branch.sh` branch E2E mapping update.

Scope:

- Add E2E coverage for the integrated saved favorites journey.
- Run final integration gates after T001 through T006 pass review.
- Record Browser evidence references from prior UI tasks and the E2E run.
- Current authorization permitted creating `tests/e2e/saved-content-favorites.spec.js`, editing `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`, and adding `saved-content-favorites.spec.js` to `scripts/test-e2e-branch.sh` emulator branch E2E mapping.

Non-scope:

- No production behavior changes unless a prior task is explicitly reopened by Coordinator.
- No package changes.
- No product code edits. No test edits outside `tests/e2e/saved-content-favorites.spec.js` and `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`.
- No script edits outside the `scripts/test-e2e-branch.sh` branch E2E mapping.
- No staging, commit, push, PR, merge, CI watch, or local main sync.
- Do not modify files outside the owned files.

Owned files:

- `tests/e2e/saved-content-favorites.spec.js`
- `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`
- `scripts/test-e2e-branch.sh`

Read-only context:

- `AGENTS.md`
- `.codex/rules/e2e-commands.md`
- `.codex/rules/testing-standards.md`
- `.codex/rules/sensors.md`
- `.codex/references/quality-gates.md`
- `tests/e2e/posts-ui.spec.js`
- `tests/e2e/events.spec.js`
- `tests/e2e/event-edit-delete.spec.js`

Dependencies:

- T004.
- T005.
- T006.
- Plan Reviewer PASS.
- Explicit user test-edit authorization for the two T007 test files.
- Explicit user authorization for T007 issue 1 branch E2E mapping in `scripts/test-e2e-branch.sh`.

Browser evidence:

- Required through Playwright trace or screenshots plus manual Browser evidence summary.
- Target journey: login, favorite a post from `/posts`, verify filled state, visit post detail and verify state, favorite an event from `/events`, verify event detail state, open `/member/favorites`, verify tabs and links, remove one item, undo, then verify restored.
- Viewports: desktop 1280 by 800 and mobile 390 by 844 if the E2E harness supports viewport projects; otherwise run one focused viewport and record manual Browser evidence for the other.

Engineer instructions:

- RED: add E2E tests for unauthenticated bookmark login toast and signed-in favorite journey across post feed, post detail, event feed, event detail, and member favorites page.
- Run the focused E2E command and record the failing signal before any E2E support changes.
- GREEN: complete only E2E spec adjustments inside `tests/e2e/saved-content-favorites.spec.js` and dependency/mock boundary adjustments inside `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`. If the journey needs seed, helper, product, package, or config changes outside these owned files, stop for Coordinator plan update.
- After focused E2E passes, run the final integration commands one by one.
- Record exact exit codes and concise output signals for every command.
- Current dispatch authorizes test edits only in the two owned files. Do not modify any product, package, config, or other test file.

Acceptance criteria:

- AC-T007.1: E2E covers unauthenticated login-required toast for bookmark action.
- AC-T007.2: E2E covers signed-in add and filled icon state for post and event bookmarks.
- AC-T007.3: E2E covers `/member/favorites` tabs, card links, remove, and undo.
- AC-T007.4: Final integration commands pass or any failure is diagnosed as pre-existing, unrelated, or a blocker with evidence.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx playwright test --config playwright.emulator.config.mjs tests/e2e/saved-content-favorites.spec.js` | Exit 0, saved favorites E2E passes. |
| `npm run test:branch` | Exit 0, branch Vitest gate passes. |
| `npm run test:e2e:branch` | Exit 0 or documented skip when no changed E2E spec is routed. |
| `npm run depcruise` | Exit 0, dependency direction passes. |
| `bash scripts/audit-mock-boundary.sh` | Exit 0, no forbidden internal mocks. |
| `bash scripts/audit-flaky-patterns.sh` | Exit 0, no flaky test patterns. |
| `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| `npm run audit:playwright-official-only` | Exit 0, E2E official-only audit passes. |
| `npm run workflow:validate` | Exit 0, workflow status files are valid. |
| `npm run workflow:check` | Exit 0, workflow state is synced. |
| `git diff --check` | Exit 0, no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only the E2E owned file unless Coordinator approved a plan update.
- E2E uses Playwright official imports and web-first locators.
- E2E contains no fixed sleeps, focused tests, or non-relative project imports.
- Final integration gates pass or failures are recorded as blockers with evidence.

Reviewer REJECT criteria:

- E2E relies on source imports or fixed waits.
- E2E misses the member favorites remove and undo journey.
- A final integration command fails without diagnosis.
- Verification or Browser evidence is missing, stale, failed, or incomplete.

Evidence:

- Latest Engineer report: T007 test edits completed in `tests/e2e/saved-content-favorites.spec.js` and `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`; mapping Engineer added `saved-content-favorites.spec.js` to `scripts/test-e2e-branch.sh` `is_emulator_spec()` only; focused E2E REST `documentExists()` was fixed within the authorized E2E file by adding `Authorization: Bearer owner`.
- Latest Reviewer report: `review_passed` for T007 test content, branch E2E mapping, and E2E REST auth cleanup.
- Post-T007 permission-denied fallback incident: user reported that after login, `/posts` and `/events` showed console `FirebaseError: Missing or insufficient permissions.` Root cause was localhost:3001 connecting to production Firestore while background favorite status hydration reads `users/{uid}/favoritePosts|favoriteEvents/{targetId}`; if production rules do not yet include the new favorite subcollection rules, Firestore returns `permission-denied`.
- Post-T007 fallback behavior: background favorite status hydration treats only `permission-denied` as an empty/no-op fallback to avoid console noise and page break; generic errors still throw/log; user-triggered add/remove favorite failures still rollback and show toast.
- Post-T007 authorization note: existing state did not contain explicit product-code edit authorization for this follow-up. Do not infer authorization.
- Post-T007 Reviewer decision: `review_passed`; no blocking findings.
- Post-T007 RED evidence: focused unit failed before fix; posts regression expected posts length 2 but got 0; events regression saw `console.error('載入活動收藏狀態失敗:', permission-denied)`.
- Post-T007 residual risk: permission-denied fallback remains defensive for stale clients or rule propagation delays; active user write failures still toast.
- Rules deploy status: deployed after PR #99 merge; production deploy evidence is recorded in `status.json.rulesDeployStatus`.
- Current workflow state is verified for closeout at `34664f89d2f18ee707079886779348c8b01bcedc`.
- PR #99 CI incident `INC-CI-WORKFLOW-STATE-SHALLOW-CHECKOUT`: GitHub CI run `26150844340` failed `Workflow state check`; local `npm run workflow:check` passed. Root cause was shallow checkout missing ancestor commit objects. Fix: `.github/workflows/ci.yml` checkout `fetch-depth: 0` and `scripts/check-superpowers-state.js` allowlist entry for exactly `.github/workflows/ci.yml` as workflow evidence, not the whole `.github/` tree. Reviewer PASS recorded for the CI checkout-depth fix; rerun CI `26151638769` succeeded.
- PR #100 CI incident `INC-CI-WORKFLOW-LINKS-EMPTY-DIR`: GitHub CI run `26152944921` failed `Workflow links check`; local `npm run workflow:links` had passed only because an untracked empty `specs/saved-content-favorites/` directory still existed locally. GitHub checkout omitted that empty directory, exposing stale inline-code references in `docs/superpowers/workflow.md` and `.agents/skills/worktree/SKILL.md`. Fix: point both examples at existing `specs/065-saved-content-favorites/` and verify in a clean archive copy without the empty directory.
- PR #99 GitHub checks on head `23b9e0e3a572f61cb2f4834feba6f700ec035ed5`: `CI` run `26151638769` succeeded, including `ci` and `e2e`; `Firestore Rules Gate` run `26151638732` succeeded; `Quality Budgets` run `26151638734` succeeded.
- PR #99 was squash merged to `main` at `34664f89d2f18ee707079886779348c8b01bcedc`.
- Firestore rules deploy: `firebase deploy --only firestore:rules --project dive-into-run` exited 0; `firestore.rules` compiled successfully and was released to `cloud.firestore`.
- Legacy active spec directory `specs/saved-content-favorites/` was removed so future agents see only `specs/065-saved-content-favorites/`.
- Current closeout authorization includes commit, push, PR, CI-watch, merge, deploy, and local-main-sync. Product code edits and package/config edits remain non-scope for future work.
- Command output summary:
  - `firebase emulators:exec --only auth,firestore,storage --project=demo-test "npx playwright test --config playwright.emulator.config.mjs tests/e2e/saved-content-favorites.spec.js"`: exit 0; 3 passed; Reviewer rerun also 3 passed (14.4s).
  - `TEST_E2E_BRANCH_CHANGED_SPECS=tests/e2e/saved-content-favorites.spec.js npm run test:e2e:branch`: sandbox first failed with port EPERM; escalated rerun exit 0; branch script routed spec to `Emulator specs without feature setup`; Playwright 3 passed (15.0s).
  - `npm run test:e2e:branch`: exit 0; historical normal changed detection run documented a skip before commit and push, while forced branch evidence validated mapping and spec execution.
  - `npm run test:branch`: exit 0; browser Vitest 7 passed / 89 tests; server rules 6 passed / 88 tests.
  - `npm run depcruise`: exit 0; no dependency violations found (1540 modules, 3898 dependencies), with existing MODULE_TYPELESS warning only.
  - `bash scripts/audit-mock-boundary.sh`: exit 0; 0 findings.
  - `bash scripts/audit-flaky-patterns.sh`: exit 0; 0 findings.
  - `npm run audit:use-effect-data-fetching`: exit 0; 0 findings.
  - `npm run audit:playwright-official-only`: exit 0; 0 findings.
  - `npm run workflow:validate`: exit 0; 6 status files valid.
  - `npm run workflow:check`: exit 0; 6 status files synced.
  - `git diff --check`: exit 0; no output.
  - `npm run lint:changed`: exit 0; existing React-version warning only.
  - `npm run type-check:changed`: exit 0; no changed-file type errors.
  - Post-T007 GREEN: `npx vitest run --project=browser tests/unit/runtime/usePostsPageRuntime.test.jsx tests/unit/runtime/useEventsPageRuntime.test.jsx`: exit 0; 2 files / 28 tests passed.
  - Post-T007 `npm run lint:changed`: exit 0; existing React-version warning only.
  - Post-T007 `npm run type-check:changed`: exit 0; no changed-file type errors.
  - Post-T007 `git diff --check`: exit 0.
- Changed files summary:
  - `scripts/test-e2e-branch.sh`
  - `tests/e2e/saved-content-favorites.spec.js`
  - `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`
  - Post-T007 permission-denied fallback: `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
  - Post-T007 permission-denied fallback: `src/runtime/hooks/useEventsPageRuntime.js`
  - Post-T007 permission-denied fallback: `tests/unit/runtime/usePostsPageRuntime.test.jsx`
  - Post-T007 permission-denied fallback: `tests/unit/runtime/useEventsPageRuntime.test.jsx`
