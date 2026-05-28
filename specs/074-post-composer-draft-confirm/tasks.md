# Post Composer Draft Confirm Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/074-post-composer-draft-confirm/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, this file, `specs/074-post-composer-draft-confirm/handoff.md`, and `specs/074-post-composer-draft-confirm/status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer subagents, including code, tests, docs, workflow docs, scripts, config, and UI.
- Planner subagent slices repo-changing work. Main validates Planner output and dispatches; it does not self-slice repo-changing work.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, CI watch, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence is one command per entry. Do not combine commands with `&&` or `;`.
- New `status.json` state uses schemaVersion 3 and records `currentHead`, `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and `incidents`.
- Final summaries must not imply deployed Firestore/storage rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Recommended maximum in this shared worktree: two Engineer/Reviewer pairs.
- Same-wave tasks require completely disjoint owned files and one Reviewer per lane.
- Shared helpers, config, lockfiles, workflow state, schema, security rules, migrations, and release-state writes must serialize.
- T003 and T004 may run in parallel only after T001 and T002 are `completed`, and only if neither task expands into shared files.

## Planner Output

- Dependency graph:
  - `T001 -> T002`
  - `T001 -> T003`
  - `T002 -> T003`
  - `T001 -> T004`
  - `T002 -> T004`
  - `T003 -> T005`
  - `T004 -> T005`
- Parallel waves:
  - `wave-1`: T001
  - `wave-2`: T002
  - `wave-3`: T003, T004
  - `wave-4`: T005
- Final integration gate:
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `npm run depcruise`: exit 0.
  - Browser evidence on `/posts`: X, Escape, and backdrop show the same confirmation dialog for unsaved create/edit content; draft restore toast appears; article A and B edit drafts remain isolated.

## Tasks

### T001 - Storage Helper And Tests

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `storage-helper`
- **Last verified commit**: uncommitted T001 diff verified in worktree
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Add a browser localStorage helper for post composer drafts.
- Add helper unit tests before implementation.
- Keep side effects in the repo/client layer.

Non-scope:

- Do not modify runtime hooks, UI components, CSS, Firestore, security rules, package metadata, or workflow state.
- Do not add dependencies.
- Do not create Firestore-backed drafts or autosave.

Owned files:

- `src/repo/client/post-composer-draft-storage-repo.js`
- `src/repo/client/post-composer-draft-storage-repo.test.js`

Read-only context:

- `specs/074-post-composer-draft-confirm/spec.md`
- `src/repo/client/weather-location-storage-repo.js`
- `vitest.config.mjs`
- `vitest.setup.jsx`

Dependencies:

- none

Browser evidence:

- not applicable

Engineer instructions:

- First create `src/repo/client/post-composer-draft-storage-repo.test.js`.
- Cover these exact test cases:
  - `getPostComposerDraftKey({ uid: 'u1', postId: null })` returns `post-composer:draft:create:u1`.
  - `getPostComposerDraftKey({ uid: 'u1', postId: 'p1' })` returns `post-composer:draft:edit:u1:p1`.
  - Saving a create draft stores only `title`, `content`, and `updatedAt`.
  - Loading a valid draft returns the same `title`, `content`, and `updatedAt`.
  - Removing an edit draft for `p1` does not remove edit draft `p2`.
  - Invalid JSON is removed and returns `null`.
  - Payloads with non-string `title`, `content`, or `updatedAt` are removed and return `null`.
  - Draft older than `POST_COMPOSER_DRAFT_MAX_AGE_MS` is removed and returns `null`.
  - Storage `setItem`, `getItem`, and `removeItem` exceptions do not throw.
- Then implement `src/repo/client/post-composer-draft-storage-repo.js` with this public API:

```js
export const POST_COMPOSER_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function getPostComposerDraftKey({ uid, postId }) {}

export function savePostComposerDraft({
  uid,
  postId,
  title,
  content,
  now = new Date(),
  storage = globalThis.localStorage,
}) {}

export function loadPostComposerDraft({
  uid,
  postId,
  now = new Date(),
  storage = globalThis.localStorage,
}) {}

export function removePostComposerDraft({
  uid,
  postId,
  storage = globalThis.localStorage,
}) {}
```

- Treat `postId === null` or `postId === undefined` as create mode.
- Missing `uid` returns `null` from key/load and performs no write/remove.
- Missing edit `postId` is not possible through this API because null means create mode.
- Use ISO-8601 string timestamps from `now.toISOString()`.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: Draft keys exactly match the spec key formats.
- AC-T001.2: Draft payloads include exactly `title`, `content`, and `updatedAt`.
- AC-T001.3: Draft load removes and ignores invalid, unparsable, or expired drafts.
- AC-T001.4: Remove operations affect only the current uid/target key.
- AC-T001.5: Storage unavailable errors do not throw.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/repo/client/post-composer-draft-storage-repo.test.js` | exit 0 and all helper tests pass |
| `npm run lint:changed` | exit 0 with no lint errors for changed files |
| `npm run type-check:changed` | exit 0 with no type-check errors for changed files |

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- Tests were written before implementation or Engineer reports a TDD-equivalent fail/pass sequence.
- Acceptance criteria are covered by test assertions.
- No runtime, UI, package metadata, Firestore, or rules files changed.

Reviewer REJECT criteria:

- Diff touches non-owned files without prior coordinator approval.
- Verification is missing, stale, failed, or not the required command.
- Key strings, payload shape, TTL cleanup, invalid cleanup, or target isolation is wrong.
- Storage exceptions can propagate to runtime.

Evidence:

- Engineer report:
  - Status: DONE after one quality-review fix loop.
  - Files changed:
    - `src/repo/client/post-composer-draft-storage-repo.js`
    - `src/repo/client/post-composer-draft-storage-repo.test.js`
  - TDD evidence: RED failed on missing helper import, then GREEN passed 13 helper tests after implementation and regression fix.
- Reviewer report:
  - Spec compliance reviewer: `review_passed`, no findings.
  - Code quality reviewer: first `review_rejected` for unsafe `globalThis.localStorage` default-parameter lookup; re-review `review_passed`, no findings.
- Command output summary:
  - `npx vitest run --project=browser src/repo/client/post-composer-draft-storage-repo.test.js`: exit 0, 13 tests passed.
  - `npm run lint:changed`: exit 0, existing React settings warning only.
  - `npm run type-check:changed`: exit 0, no type errors in changed files.
- Changed files summary:
  - `src/repo/client/post-composer-draft-storage-repo.js`
    - Added scoped post composer draft localStorage helper with safe storage access, TTL, invalid cleanup, and target-specific removal.
  - `src/repo/client/post-composer-draft-storage-repo.test.js`
    - Added helper tests for key formats, payload shape, valid load, target isolation, invalid/expired cleanup, operation errors, and throwing global localStorage accessor.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T006 - Clean Close Regression Tests

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `release-follow-up`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `clean-close-regression-tests`
- **Last verified commit**: uncommitted T006 diff verified in worktree
- **Authorization boundary**: edit=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=yes, merge=yes, localMainSync=yes, deployFirestoreRules=yes
- **Rules deploy status**: deployed; Firestore and Storage rules released to Firebase project `dive-into-run`
- **Incidents**: none

Scope:

- Add regression coverage for clean create, unchanged feed edit, and unchanged detail edit composer close requests.
- Keep the slice test-only.

Non-scope:

- Do not modify production code, `ComposeModal`, UI screen tests, workflow state beyond coordinator sync, package metadata, Firestore/storage rules, or config.

Owned files:

- `src/runtime/hooks/usePostsPageRuntime.test.jsx`
- `src/runtime/hooks/usePostDetailRuntime.test.jsx`

Read-only context:

- `specs/074-post-composer-draft-confirm/spec.md`
- `specs/074-post-composer-draft-confirm/tasks.md`
- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/runtime/hooks/usePostDetailRuntime.js`

Dependencies:

- T005 completed

Browser evidence:

- not applicable; this is hook-level regression coverage for runtime close-guard branching.

Acceptance criteria:

- AC-T006.1: `/posts` clean create close leaves `isDraftConfirmOpen` false, resets composer state, and closes the dialog once.
- AC-T006.2: `/posts` unchanged edit close leaves `isDraftConfirmOpen` false, resets composer state, and closes the dialog once.
- AC-T006.3: `/posts/[id]` unchanged edit close leaves `isDraftConfirmOpen` false, resets composer state, and closes the dialog once.
- AC-T006.4: No production code changes are introduced.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx` | exit 0 and posts runtime tests pass |
| `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx` | exit 0 and detail runtime tests pass |
| `git diff -- src/runtime/hooks/usePostsPageRuntime.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx` | diff only adds requested regression tests in owned files |

Reviewer PASS criteria:

- Diff touches only owned test files for the T006 change.
- Focused runtime tests pass.
- No production files changed by T006.

Reviewer REJECT criteria:

- Production code or non-owned files changed for T006.
- Clean or unchanged close behavior is not asserted.
- Focused tests are missing or failed.

Evidence:

- Engineer report:
  - Status: DONE.
  - Files changed:
    - `src/runtime/hooks/usePostsPageRuntime.test.jsx`
    - `src/runtime/hooks/usePostDetailRuntime.test.jsx`
  - Added three hook-level regression tests for clean create, unchanged feed edit, and unchanged detail edit close paths.
- Reviewer report:
  - T006 clean-close regression reviewer: `review_passed`.
  - Diff only adds requested tests in owned files; focused runtime tests passed; no production files changed by T006.
- Command output summary:
  - `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx`: exit 0, 12 tests passed.
  - `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx`: exit 0, 7 tests passed.
  - `git diff -- src/runtime/hooks/usePostsPageRuntime.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx`: exit 0, diff only adds three requested tests.
  - `git diff --name-status`: exit 0, unstaged T006 diff only touched the two owned runtime hook test files.
- Changed files summary:
  - `src/runtime/hooks/usePostsPageRuntime.test.jsx`
    - Added clean create and unchanged feed edit close regression tests.
  - `src/runtime/hooks/usePostDetailRuntime.test.jsx`
    - Added unchanged detail edit close regression test.
- Phase commits: none.
- Rules deploy status: deployed; Firestore and Storage rules released to Firebase project `dive-into-run` with deploy evidence recorded in `status.json`.
- Incidents: none.

### T007 - Full Lint Baseline Remediation

- **State**: `completed`
- **Attempt**: 2
- **Wave**: `release-blocker`
- **Engineer**: Engineer/Debugger
- **Reviewer**: Reviewer
- **Commit checkpoint**: `react-hook-lint-baseline`
- **Last verified commit**: uncommitted T007 diff verified in worktree
- **Authorization boundary**: edit=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=yes, merge=yes, localMainSync=yes, deployFirestoreRules=yes
- **Rules deploy status**: deployed; Firestore and Storage rules released to Firebase project `dive-into-run`
- **Incidents**: none

Scope:

- Fix existing React hook lint errors that blocked local pre-commit and CI full lint.
- Keep changes limited to the owned runtime hook/provider files reported by full lint.

Non-scope:

- Do not change package metadata, eslint config, CI, Firestore/storage rules, 074 product behavior, or staged feature files.

Owned files:

- `src/runtime/hooks/useDashboardTab.js`
- `src/runtime/hooks/useEventDetailMutations.js`
- `src/runtime/hooks/useEventDetailParticipation.js`
- `src/runtime/hooks/useEventDetailRuntime.js`
- `src/runtime/hooks/useEventParticipation.js`
- `src/runtime/hooks/useEventsPageRuntime.js`
- `src/runtime/hooks/useMemberPageRuntime.js`
- `src/runtime/hooks/useProfileEventsRuntime.js`
- `src/runtime/hooks/useProfileRuntime.js`
- `src/runtime/hooks/useStravaActivities.js`
- `src/runtime/hooks/useStravaSync.js`
- `src/runtime/providers/NotificationProvider.jsx`

Dependencies:

- T006 completed

Acceptance criteria:

- AC-T007.1: `npm run lint -- --max-warnings 0` exits 0.
- AC-T007.2: `npm run type-check:changed` exits 0.
- AC-T007.3: `npm run depcruise` exits 0.
- AC-T007.4: Diff is limited to owned runtime hook/provider files and adds no broad lint suppressions.
- AC-T007.5: Reviewer rejection findings are fixed without obvious stale-closure or state-after-unmount regressions.

Evidence:

- Engineer report:
  - Status: DONE after one review rejection fix loop.
  - Fixed full-lint React hook baseline errors in owned runtime hook/provider files.
  - Second pass fixed stale follow identity guard, toast queue overwrite risk, and dashboard stale async state writes.
- Reviewer report:
  - T007 lint-baseline reviewer: `review_passed`.
  - Full lint, changed-file type-check, and depcruise passed; previous rejection findings were fixed; no package/config/rules changes found.
- Command output summary:
  - `npm run lint -- --max-warnings 0`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `npm run depcruise`: exit 0, existing `MODULE_TYPELESS_PACKAGE_JSON` warning only.
  - `git diff --name-only`: exit 0, unstaged T007 diff limited to owned runtime hook/provider files.
  - `git diff --cached --name-only`: exit 0, staged 074 feature files were unchanged by T007.
- Changed files summary:
  - Fixed React hook lint issues for render-time ref access, set-state-in-effect, and preserve-manual-memoization.
  - No package metadata, eslint config, CI, Firebase rules, or 074 staged product files changed.
- Phase commits:
  - implementation: `9931cc1425e51b009d61cc4504a4132cdd0c3a8e` (`Add post composer draft recovery`)
  - lint-baseline: `78ffd7db0ca3809e0b02ee101d435ed93ba750b5` (`Fix React hook lint baseline`)
- Rules deploy status: deployed; Firestore and Storage rules released to Firebase project `dive-into-run` with deploy evidence recorded in `status.json`.
- Incidents: none.

### T008 - Rebase Type-Check Test Mock Fix

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `rebase-integration`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `rebase-typecheck-mocks`
- **Last verified commit**: uncommitted T008 diff verified in worktree
- **Authorization boundary**: edit=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=yes, merge=yes, localMainSync=yes, deployFirestoreRules=yes
- **Rules deploy status**: deployed; Firestore and Storage rules released to Firebase project `dive-into-run`
- **Incidents**: none

Scope:

- Update 074 runtime hook test user mocks for the account-deletion user shape added on `origin/main`.

Non-scope:

- Do not modify production code, workflow config, package metadata, Firebase rules, or unrelated tests.

Owned files:

- `src/runtime/hooks/usePostDetailRuntime.test.jsx`
- `src/runtime/hooks/usePostsPageRuntime.test.jsx`

Acceptance criteria:

- AC-T008.1: `npm run type-check` exits 0.
- AC-T008.2: The two affected focused runtime hook tests pass.
- AC-T008.3: Diff is limited to the two owned test files.

Evidence:

- Engineer report:
  - Status: DONE.
  - Added `ACCOUNT_DELETION_STATUS_ACTIVE` import plus `accountStatus` and `deletionScheduledFor` fields to the two affected runtime hook test user mocks.
- Reviewer report:
  - T008 rebase type-check reviewer: `review_passed`.
  - Diff only updates the two test mocks; full type-check and both focused runtime tests passed.
- Command output summary:
  - `npm run type-check`: exit 0.
  - `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx`: exit 0, 7 tests passed.
  - `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx`: exit 0, 12 tests passed.
  - `git diff -- src/runtime/hooks/usePostDetailRuntime.test.jsx src/runtime/hooks/usePostsPageRuntime.test.jsx`: exit 0, diff limited to the two owned test files.
- Changed files summary:
  - `src/runtime/hooks/usePostDetailRuntime.test.jsx`
    - Added account deletion status fields to the `USER` test mock.
  - `src/runtime/hooks/usePostsPageRuntime.test.jsx`
    - Added account deletion status fields to the `signedInUser` test mock.
- Phase commits:
  - implementation: `9931cc1425e51b009d61cc4504a4132cdd0c3a8e` (`Add post composer draft recovery`)
  - lint-baseline: `78ffd7db0ca3809e0b02ee101d435ed93ba750b5` (`Fix React hook lint baseline`)
  - rebase-state: `f6c89e69338050787baefe0865feb47a55f6675f` (`Record post composer rebase state`)
- Rules deploy status: deployed; Firestore and Storage rules released to Firebase project `dive-into-run` with deploy evidence recorded in `status.json`.
- Incidents: none.

### Release Closeout Evidence

- Final focused tests: `npx vitest run --project=browser src/repo/client/post-composer-draft-storage-repo.test.js src/components/ComposeModal.test.jsx src/runtime/hooks/usePostsPageRuntime.test.jsx src/runtime/hooks/usePostDetailRuntime.test.jsx src/ui/posts/PostsPageScreen.test.jsx src/ui/posts/PostDetailScreen.test.jsx`: exit 0, 6 files and 40 tests passed.
- Repo gates: `npm run doc:freshness`, `npm run workflow:check`, `npm run workflow:links`, `git diff --check`, `npm run lint -- --max-warnings 0`, `npm run audit:use-effect-data-fetching`, `npm run type-check`, `npm run spellcheck`, `npm run depcruise`, and `npm run build`: exit 0.
- Rules deploy: `firebase deploy --only firestore:rules,storage --project dive-into-run --non-interactive`: exit 0; `firestore.rules` and `storage.rules` released to Firebase project `dive-into-run`.

### T002 - ComposeModal Shared Close Guard And Confirmation UI

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `compose-modal-close-guard`
- **Last verified commit**: uncommitted T002 diff verified in worktree
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Route X, Escape, and backdrop through one shared close request callback.
- Render a custom centered confirmation dialog surface inside the existing composer dialog.
- Add component tests for close routing and action ordering.

Non-scope:

- Do not modify runtime hooks, screens, repo helper, Firestore, security rules, package metadata, or workflow state.
- Do not implement localStorage reads/writes in the component.

Owned files:

- `src/components/ComposeModal.jsx`
- `src/components/ComposeModal.module.css`
- `src/components/ComposeModal.test.jsx`

Read-only context:

- `specs/074-post-composer-draft-confirm/spec.md`
- `src/ui/posts/PostsPageScreen.jsx`
- `src/ui/posts/PostDetailScreen.jsx`
- `vitest.config.mjs`
- `vitest.setup.jsx`

Dependencies:

- T001 completed

Browser evidence:

- not applicable for this component-only slice; component tests must cover the visible dialog and actions.

Engineer instructions:

- Add optional props to `ComposeModal` so existing callers can compile during this task:

```js
onRequestClose = () => dialogRef.current?.close(),
isDraftConfirmOpen = false,
onSaveDraft = () => {},
onContinueEditing = () => {},
onDiscardDraft = () => {},
```

- Replace the X button direct close with `onRequestClose()`.
- Replace Escape `handleCancel` logic so it always `preventDefault()` and calls `onRequestClose()`.
- Replace backdrop logic so outside clicks call `onRequestClose()` and never directly call `dialog.close()`.
- Preserve submit behavior, input behavior, dirty submit disabling, and existing labels.
- Render the confirmation only when `isDraftConfirmOpen` is true.
- Dialog text must be:
  - title: `要儲存這篇草稿嗎？`
  - body: `下次開啟文章編輯器時，可以繼續編輯目前內容。`
  - actions in order: `存草稿`, `繼續編輯`, `不儲存並關閉`
- `存草稿` calls `onSaveDraft`.
- `繼續編輯` calls `onContinueEditing`.
- `不儲存並關閉` calls `onDiscardDraft`.
- Style the confirmation with white surface, compact spacing, 8-12px radius, restrained shadow, existing purple primary button treatment, neutral secondary treatment, and danger treatment.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: X, Escape, and backdrop all call the same close request prop.
- AC-T002.2: The native dialog does not close directly from those triggers when the parent chooses to show confirmation.
- AC-T002.3: Confirmation copy and action order exactly match the spec.
- AC-T002.4: Each confirmation action calls only its corresponding handler.
- AC-T002.5: Existing submit button dirty/disabled behavior remains intact.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/components/ComposeModal.test.jsx` | exit 0 and component tests pass |
| `npm run lint:changed` | exit 0 with no lint errors for changed files |
| `npm run type-check:changed` | exit 0 with no type-check errors for changed files |

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- No localStorage or runtime target logic was added to the component.
- Confirmation UI is custom in-app UI, not `window.confirm`.
- Layer rules remain satisfied.

Reviewer REJECT criteria:

- Any close trigger bypasses `onRequestClose`.
- Action order, copy, or handler mapping is wrong.
- Component directly reads/writes localStorage.
- Native dialog closes before runtime can decide.

Evidence:

- Engineer report:
  - Status: DONE after one quality-review fix loop.
  - Files changed:
    - `src/components/ComposeModal.jsx`
    - `src/components/ComposeModal.module.css`
    - `src/components/ComposeModal.test.jsx`
  - TDD evidence: RED failed on missing close guard/confirmation behavior; GREEN passed 6 component tests after implementation and regression fix.
- Reviewer report:
  - Spec compliance reviewer: `review_passed`, no findings.
  - Code quality reviewer: first `review_rejected` for bubbled confirm clicks and background form operability; re-review `review_passed`, no findings.
- Command output summary:
  - `npx vitest run --project=browser src/components/ComposeModal.test.jsx`: exit 0, 6 tests passed.
  - `npm run lint:changed`: exit 0, existing React settings warning only.
  - `npm run type-check:changed`: exit 0, no type errors in changed files.
- Changed files summary:
  - `src/components/ComposeModal.jsx`
    - Routed X, Escape, and backdrop through `onRequestClose`; added custom draft confirmation UI and disabled background controls while it is open.
  - `src/components/ComposeModal.module.css`
    - Added centered confirmation dialog styles and disabled close-button styling.
  - `src/components/ComposeModal.test.jsx`
    - Added close guard, confirmation action, bubbled click, disabled background control, and submit dirty/disabled behavior tests.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T003 - Posts Feed Composer Draft Runtime

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `posts-feed-draft-runtime`
- **Last verified commit**: uncommitted T003 diff verified in worktree
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Wire create/edit draft restore, save, continue, discard, success cleanup, and failed-submit preservation for `/posts`.
- Pass draft-confirm props from `PostsPageScreen` to `ComposeModal`.
- Add runtime tests for feed composer behavior.

Non-scope:

- Do not modify post detail runtime/screen, `ComposeModal`, repo helper, Firestore, security rules, package metadata, or workflow state.
- Do not implement autosave.

Owned files:

- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/runtime/hooks/usePostsPageRuntime.test.jsx`
- `src/ui/posts/PostsPageScreen.jsx`

Read-only context:

- `specs/074-post-composer-draft-confirm/spec.md`
- `src/repo/client/post-composer-draft-storage-repo.js`
- `src/components/ComposeModal.jsx`
- `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
- `src/runtime/client/use-cases/post-use-cases.js`
- `src/runtime/providers/AuthProvider.jsx`
- `src/runtime/providers/ToastProvider.jsx`
- `vitest.config.mjs`
- `vitest.setup.jsx`

Dependencies:

- T001 completed
- T002 completed

Browser evidence:

- Required in final integration gate, not required inside this isolated runtime slice unless Engineer changes visible screen behavior beyond prop wiring.

Engineer instructions:

- Add runtime state for the feed composer confirmation, for example:

```js
const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
```

- Add a close/reset helper for the feed composer that clears title/content/originals/editing id and closes the native dialog.
- Add a current target helper using `userUid` and `editingPostId`:
  - create target: `{ uid: userUid, postId: null }`
  - edit target: `{ uid: userUid, postId: editingPostId }`
- On `handleComposeButton(postId)`:
  - Keep the existing missing-post toast.
  - Use `createComposerDraft(targetPost)` for base state.
  - Load draft with `loadPostComposerDraft({ uid: userUid, postId: targetPost?.id ?? null })` only when `userUid` exists.
  - If a draft exists, apply draft `title/content` while preserving base `originalTitle/originalContent/editingPostId`.
  - Show toast `已恢復草稿` after applying a restored draft.
  - Clear confirmation state and open the dialog.
- Implement `handleRequestComposerClose`:
  - If create mode has no trimmed title/content, close/reset immediately.
  - If edit mode title/content equals original title/content after trim comparison, close/reset immediately.
  - Otherwise open confirmation state.
- Implement `handleSaveComposerDraft`:
  - Save current `title/content` to the current target using T001 helper.
  - Close confirmation and close/reset composer.
- Implement `handleContinueEditingDraft`:
  - Close only confirmation state.
- Implement `handleDiscardComposerDraft`:
  - Remove only current target draft.
  - Close confirmation and close/reset composer.
- Update `handleSubmitPost`:
  - On successful update, remove edit target draft, update posts, toast success, close/reset.
  - On successful create, remove create target draft, prepend hydrated post, scroll, toast success, close/reset.
  - On failed create/update, keep composer open, keep title/content, do not remove draft, and show existing error toast.
  - Do not reset or close in a shared post-try block after catch.
- Return these runtime fields:

```js
isDraftConfirmOpen,
handleRequestComposerClose,
handleSaveComposerDraft,
handleContinueEditingDraft,
handleDiscardComposerDraft,
```

- Pass those fields from `src/ui/posts/PostsPageScreen.jsx` into `ComposeModal`.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: Opening create composer restores only `post-composer:draft:create:<uid>` and shows `已恢復草稿`.
- AC-T003.2: Opening edit composer for post A restores only `post-composer:draft:edit:<uid>:<postAId>`.
- AC-T003.3: Edit draft restore preserves original post title/content for dirty comparison.
- AC-T003.4: X/Escape/backdrop close requests with unsaved feed composer content open confirmation.
- AC-T003.5: `存草稿` saves current feed composer target and closes the composer.
- AC-T003.6: `繼續編輯` keeps the composer open and does not write/remove draft.
- AC-T003.7: `不儲存並關閉` removes only the current target draft and closes the composer.
- AC-T003.8: Successful create/update removes only current target draft.
- AC-T003.9: Failed create/update keeps composer open and preserves draft storage.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx` | exit 0 and feed runtime tests pass |
| `npm run lint:changed` | exit 0 with no lint errors for changed files |
| `npm run type-check:changed` | exit 0 with no type-check errors for changed files |

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- Draft helper imports flow from repo/client into runtime only.
- Failed submit path keeps composer open and does not remove draft.
- No post detail files, Firestore, rules, package metadata, or shared helper files changed.

Reviewer REJECT criteria:

- Create/edit keys are mixed.
- Post A action can read, overwrite, or remove post B draft.
- Failed submit closes or resets the composer.
- `PostsPageScreen` does not pass the new props to `ComposeModal`.
- Any write expands outside owned files.

Evidence:

- Engineer report:
  - Status: DONE_WITH_CONCERNS.
  - Files changed:
    - `src/runtime/hooks/usePostsPageRuntime.js`
    - `src/runtime/hooks/usePostsPageRuntime.test.jsx`
    - `src/ui/posts/PostsPageScreen.jsx`
  - TDD evidence: RED showed missing draft restore, close handlers, submit cleanup/preservation, and screen prop wiring; GREEN passed 11 feed runtime/screen tests.
  - Concern: file-level `max-lines` disables were added in owned runtime/test files because this slice did not include helper extraction.
- Reviewer report:
  - Spec compliance reviewer: `review_passed`, no findings.
  - Code quality reviewer: `review_passed`, no blockers; max-lines disables noted as follow-up debt.
- Command output summary:
  - `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx`: exit 0, 11 tests passed.
  - `npm run lint:changed`: exit 0, existing React settings warning only.
  - `npm run type-check:changed`: exit 0, no type errors in changed files.
- Changed files summary:
  - `src/runtime/hooks/usePostsPageRuntime.js`
    - Added create/edit draft restore, target-scoped confirm actions, failed-submit preservation, and success cleanup.
  - `src/runtime/hooks/usePostsPageRuntime.test.jsx`
    - Added feed runtime tests for create/edit restore isolation, close guard, confirm actions, submit cleanup, and failed-submit preservation.
  - `src/ui/posts/PostsPageScreen.jsx`
    - Passed draft confirmation state and handlers to `ComposeModal`.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T004 - Post Detail Composer Draft Runtime

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `post-detail-draft-runtime`
- **Last verified commit**: uncommitted T004 diff verified in worktree
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Wire edit draft restore, save, continue, discard, success cleanup, and failed-update preservation for `/posts/[id]`.
- Pass draft-confirm props from `PostDetailScreen` to `ComposeModal`.
- Add runtime tests for detail composer behavior.

Non-scope:

- Do not modify posts feed runtime/screen, `ComposeModal`, repo helper, Firestore, security rules, package metadata, or workflow state.
- Do not add create-composer behavior to post detail.

Owned files:

- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/runtime/hooks/usePostDetailRuntime.test.jsx`
- `src/ui/posts/PostDetailScreen.jsx`

Read-only context:

- `specs/074-post-composer-draft-confirm/spec.md`
- `src/repo/client/post-composer-draft-storage-repo.js`
- `src/components/ComposeModal.jsx`
- `src/runtime/client/use-cases/post-use-cases.js`
- `src/runtime/providers/AuthProvider.jsx`
- `src/runtime/providers/ToastProvider.jsx`
- `src/ui/posts/PostDetailScreen.jsx`
- `vitest.config.mjs`
- `vitest.setup.jsx`

Dependencies:

- T001 completed
- T002 completed

Browser evidence:

- Required in final integration gate, not required inside this isolated runtime slice unless Engineer changes visible screen behavior beyond prop wiring.

Engineer instructions:

- Add runtime state for detail composer confirmation, for example:

```js
const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
```

- Add a close/reset helper that clears title/content/originals/editing id and closes the native dialog.
- On `handleOpenEdit(targetId)`:
  - Preserve existing no-post guard.
  - Set base state from `postDetail.title` and `postDetail.content`.
  - Load draft with `loadPostComposerDraft({ uid: user?.uid, postId: targetId })` only when `user?.uid` and `targetId` exist.
  - If a draft exists, apply draft `title/content`, keep original title/content from `postDetail`, and show toast `已恢復草稿`.
  - Clear confirmation state and open the dialog.
- Implement `handleRequestComposerClose`:
  - If edit title/content equals original title/content after trim comparison, close/reset immediately.
  - Otherwise open confirmation state.
- Implement `handleSaveComposerDraft`:
  - Save current title/content to `post-composer:draft:edit:<uid>:<editingPostId>`.
  - Close confirmation and close/reset composer.
- Implement `handleContinueEditingDraft`:
  - Close only confirmation state.
- Implement `handleDiscardComposerDraft`:
  - Remove only current edit target draft.
  - Close confirmation and close/reset composer.
- Update `handleSubmitPost`:
  - On successful update, remove only current edit target draft, update `postDetail`, toast success, close/reset.
  - On failed update, keep composer open, keep title/content, do not remove draft, and show existing error toast.
  - Do not reset or close after catch.
- Return these runtime fields:

```js
isDraftConfirmOpen,
handleRequestComposerClose,
handleSaveComposerDraft,
handleContinueEditingDraft,
handleDiscardComposerDraft,
```

- Pass those fields from `src/ui/posts/PostDetailScreen.jsx` into `ComposeModal`.
- Modify only the owned files above.

Acceptance criteria:

- AC-T004.1: Opening edit composer restores only `post-composer:draft:edit:<uid>:<postId>` and shows `已恢復草稿`.
- AC-T004.2: Restored edit draft preserves original post title/content for dirty comparison.
- AC-T004.3: X/Escape/backdrop close requests with unsaved detail edit content open confirmation.
- AC-T004.4: `存草稿` saves current detail edit target and closes the composer.
- AC-T004.5: `繼續編輯` keeps the composer open and does not write/remove draft.
- AC-T004.6: `不儲存並關閉` removes only the current edit target draft and closes the composer.
- AC-T004.7: Successful update removes only current edit target draft.
- AC-T004.8: Failed update keeps composer open and preserves draft storage.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx` | exit 0 and detail runtime tests pass |
| `npm run lint:changed` | exit 0 with no lint errors for changed files |
| `npm run type-check:changed` | exit 0 with no type-check errors for changed files |

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- Failed update path keeps composer open and does not remove draft.
- No posts feed files, Firestore, rules, package metadata, or shared helper files changed.

Reviewer REJECT criteria:

- Detail edit reads/removes create draft or another post's edit draft.
- Failed update closes or resets the composer.
- `PostDetailScreen` does not pass the new props to `ComposeModal`.
- Any write expands outside owned files.

Evidence:

- Engineer report:
  - Status: DONE_WITH_CONCERNS.
  - Files changed:
    - `src/runtime/hooks/usePostDetailRuntime.js`
    - `src/runtime/hooks/usePostDetailRuntime.test.jsx`
    - `src/ui/posts/PostDetailScreen.jsx`
  - TDD evidence: RED showed missing draft restore, close handlers, submit cleanup/preservation, and screen prop wiring; GREEN passed 7 detail runtime/screen tests.
  - Concern: file-level `max-lines` disables were added in owned runtime/test files because this slice did not include helper extraction.
- Reviewer report:
  - Spec compliance reviewer: `review_passed`, no findings.
  - Code quality reviewer: `review_passed`, no blockers; max-lines disables noted as follow-up debt.
- Command output summary:
  - `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx`: exit 0, 7 tests passed.
  - `npm run lint:changed`: exit 0 after T003/T004 integration, existing React settings warning only.
  - `npm run type-check:changed`: exit 0 after T003/T004 integration, no type errors in changed files.
- Changed files summary:
  - `src/runtime/hooks/usePostDetailRuntime.js`
    - Added edit draft restore, target-scoped confirm actions, failed-update preservation, and success cleanup.
  - `src/runtime/hooks/usePostDetailRuntime.test.jsx`
    - Added detail runtime tests for edit restore isolation, close guard, confirm actions, submit cleanup, and failed-update preservation.
  - `src/ui/posts/PostDetailScreen.jsx`
    - Passed draft confirmation state and handlers to `ComposeModal`.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T005 - Final Integration And Workflow Gate

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Verifier
- **Reviewer**: Reviewer
- **Commit checkpoint**: `integration-gate`
- **Last verified commit**: uncommitted implementation diff verified in worktree
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Verify the integrated feature after T001-T004 are `completed`.
- Update only workflow state if coordinator later authorizes state sync after reviewed implementation.

Non-scope:

- Do not modify production source, tests, package metadata, Firestore, security rules, or unrelated docs in this gate.
- Do not commit, push, create PR, watch CI, merge, sync local main, or deploy rules.

Owned files:

- none for source/test changes
- `specs/074-post-composer-draft-confirm/tasks.md` only if coordinator authorizes workflow state sync
- `specs/074-post-composer-draft-confirm/handoff.md` only if coordinator authorizes workflow state sync
- `specs/074-post-composer-draft-confirm/status.json` only if coordinator authorizes workflow state sync

Read-only context:

- `specs/074-post-composer-draft-confirm/spec.md`
- `specs/074-post-composer-draft-confirm/plan.md`
- `specs/074-post-composer-draft-confirm/tasks.md`
- `specs/074-post-composer-draft-confirm/status.json`
- `src/repo/client/post-composer-draft-storage-repo.js`
- `src/components/ComposeModal.jsx`
- `src/runtime/hooks/usePostsPageRuntime.js`
- `src/runtime/hooks/usePostDetailRuntime.js`
- `src/ui/posts/PostsPageScreen.jsx`
- `src/ui/posts/PostDetailScreen.jsx`

Dependencies:

- T001 completed
- T002 completed
- T003 completed
- T004 completed

Browser evidence:

- Required. Target URL: `/posts`.
- Journey:
  - Open new article composer, type title/body, press X, confirm dialog appears.
  - Choose `繼續編輯`, composer remains open.
  - Press Escape, confirm dialog appears.
  - Choose `存草稿`, composer closes.
  - Reopen new article composer, draft restores and toast `已恢復草稿` appears.
  - Save a different draft for edit article A and edit article B.
  - Reopen article A and B separately and verify each restores only its own draft.
  - Choose `不儲存並關閉` for one target and verify only that target draft is removed.
- Viewport: desktop 1280x800 minimum; add mobile viewport if UI layout looks cramped.
- Tool: Browser plugin or Playwright if available in the implementation session.
- Screenshot artifact: required for the confirmation dialog.
- Console/network findings: record any relevant errors; block if close/draft flow logs runtime errors.

Engineer instructions:

- Run the command gates one at a time and record exit codes.
- Run focused browser/manual verification after local unit gates pass.
- Confirm `git diff --name-only` contains only planned source/test/workflow files from T001-T004 plus authorized workflow state.
- Confirm no `firestore.rules`, `storage.rules`, package metadata, lockfile, or dependency file changed.
- Modify only workflow state files if coordinator explicitly authorizes state sync.

Acceptance criteria:

- AC-T005.1: All task-specific tests from T001-T004 pass.
- AC-T005.2: `lint:changed`, `type-check:changed`, and `depcruise` pass.
- AC-T005.3: Browser/manual evidence covers create, edit, X, Escape, backdrop, save draft, continue editing, discard, restore toast, two edit target isolation, and successful submit cleanup.
- AC-T005.4: Diff contains no schema, rules, dependency, package metadata, server route, or unrelated doc changes.
- AC-T005.5: `rulesDeployStatus.state` remains `not_applicable`.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser src/repo/client/post-composer-draft-storage-repo.test.js` | exit 0 and helper tests pass |
| `npx vitest run --project=browser src/components/ComposeModal.test.jsx` | exit 0 and component tests pass |
| `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx` | exit 0 and feed runtime tests pass |
| `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx` | exit 0 and detail runtime tests pass |
| `npm run lint:changed` | exit 0 with no lint errors for changed files |
| `npm run type-check:changed` | exit 0 with no type-check errors for changed files |
| `npm run depcruise` | exit 0 with no dependency direction violations |
| `git diff --check` | exit 0 with no whitespace errors |
| `git diff --name-only` | output contains only planned files and authorized workflow state |

Reviewer PASS criteria:

- Diff and command evidence support all acceptance criteria.
- Browser/manual evidence includes the required dialog screenshot and target-isolation notes.
- No non-scope files changed.
- State files match if workflow sync was authorized.

Reviewer REJECT criteria:

- Any required command is missing or failed.
- Browser/manual evidence is missing for close triggers or target isolation.
- Diff includes schema, rules, package metadata, lockfile, server route, dependency, or unrelated doc changes.
- State files drift after authorized workflow sync.

Evidence:

- Engineer report:
  - Status: verification complete, reviewer pending.
  - Required focused tests, UI prop-wiring tests, lint, changed-file type-check, depcruise, diff whitespace check, and changed-file scope checks passed.
  - Browser evidence was captured against Firebase Auth/Firestore/Storage emulators and Next dev server on `http://localhost:3002`.
  - The depcruise fix moved screen prop-wiring tests from runtime-layer test files into UI-layer screen test files.
- Reviewer report:
  - Final T005 reviewer: `review_passed`.
  - Evidence covered focused tests, UI wiring tests, lint, type-check, depcruise, diff checks, browser check screenshot, changed-file scope, no rules/package/server/unrelated changes, runtime tests without UI imports, UI-layer prop coverage, and workflow state validation/sync.
  - Earlier depcruise-fix reviewer concern was about cumulative T001-T004/workflow diffs in the shared worktree, not a structural failure; runtime tests no longer import `@/ui/**` and UI-layer tests preserve screen-to-`ComposeModal` prop coverage.
- Command output summary:
  - `npx vitest run --project=browser src/repo/client/post-composer-draft-storage-repo.test.js`: exit 0, 13 tests passed.
  - `npx vitest run --project=browser src/components/ComposeModal.test.jsx`: exit 0, 6 tests passed.
  - `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx`: exit 0, 10 tests passed after moving screen wiring coverage to UI test.
  - `npx vitest run --project=browser src/ui/posts/PostsPageScreen.test.jsx`: exit 0, 1 test passed.
  - `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx`: exit 0, 6 tests passed after moving screen wiring coverage to UI test.
  - `npx vitest run --project=browser src/ui/posts/PostDetailScreen.test.jsx`: exit 0, 1 test passed.
  - `npm run lint:changed`: exit 0, existing React settings warning only.
  - `npm run type-check:changed`: exit 0, no type errors in changed files.
  - `npm run depcruise`: exit 0, no dependency violations found; existing `MODULE_TYPELESS_PACKAGE_JSON` warning only.
  - `git diff --check`: exit 0, no whitespace errors.
  - `git status --short --untracked-files=all`: exit 0, changed files limited to planned source/test files and authorized workflow state.
  - `git diff --name-only`: exit 0, tracked changed files limited to planned source files and workflow state.
  - `git ls-files --others --exclude-standard`: exit 0, untracked files limited to planned new source/test files.
  - `node /private/tmp/post-draft-browser-check.mjs`: exit 0, emulator browser check passed.
- Browser evidence:
  - Signed in through Firebase Auth emulator.
  - X close showed the custom confirm for dirty create content.
  - `繼續編輯` kept the create composer content.
  - Escape showed the same custom confirm.
  - `存草稿` persisted `post-composer:draft:create:<uid>`.
  - Reopening create composer restored draft content and showed toast `已恢復草稿`.
  - `不儲存並關閉` removed only the current create draft and closed.
  - Article A and Article B edit drafts were saved under separate edit targets and restored independently.
  - Backdrop close showed the same custom confirm for dirty edit content.
  - Successful update closed composer and removed the active edit draft.
  - Screenshot: `/private/tmp/post-draft-browser-check.png`.
- Changed files summary:
  - Production source: `ComposeModal` close guard/confirmation UI, posts feed runtime/screen draft integration, post detail runtime/screen draft integration, and localStorage draft helper.
  - Tests: helper tests, `ComposeModal` tests, posts feed runtime tests, post detail runtime tests, and UI-layer screen prop wiring tests.
  - Workflow state: feature 074 tasks, handoff, and status were updated with dispatch, review, and verification evidence.
  - No Firestore rules, Storage rules, package metadata, lockfile, dependency, server route, or unrelated docs changed.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.
