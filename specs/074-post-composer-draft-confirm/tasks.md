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

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `storage-helper`
- **Last verified commit**: none
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

- Engineer report: pending until dispatch.
- Reviewer report: pending until dispatch.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T002 - ComposeModal Shared Close Guard And Confirmation UI

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `compose-modal-close-guard`
- **Last verified commit**: none
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

- Engineer report: pending until dispatch.
- Reviewer report: pending until dispatch.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T003 - Posts Feed Composer Draft Runtime

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `posts-feed-draft-runtime`
- **Last verified commit**: none
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

- Engineer report: pending until dispatch.
- Reviewer report: pending until dispatch.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T004 - Post Detail Composer Draft Runtime

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer
- **Reviewer**: Reviewer
- **Commit checkpoint**: `post-detail-draft-runtime`
- **Last verified commit**: none
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

- Engineer report: pending until dispatch.
- Reviewer report: pending until dispatch.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.

### T005 - Final Integration And Workflow Gate

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Verifier
- **Reviewer**: Reviewer
- **Commit checkpoint**: `integration-gate`
- **Last verified commit**: none
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

- Engineer report: pending until dispatch.
- Reviewer report: pending until dispatch.
- Command output summary: pending until dispatch.
- Changed files summary: pending until dispatch.
- Phase commits: none.
- Rules deploy status: state `not_applicable`, evidence none.
- Incidents: none.
