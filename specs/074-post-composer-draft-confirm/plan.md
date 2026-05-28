# Post Composer Draft Confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-local draft protection to the article composer for create and edit flows without changing Firestore schema, security rules, server behavior, or dependencies.

**Architecture:** Keep localStorage side effects in a focused repo-layer helper, then have runtime hooks compose the current user and composer target into draft operations. `ComposeModal` remains render/UI-only: it receives one close request callback, renders the confirmation dialog, and delegates save/continue/discard actions back to runtime. The implementation preserves the repo dependency direction: Repo -> Runtime -> UI.

**Tech Stack:** Next.js 15 App Router, React 19, JavaScript with JSDoc `checkJs`, localStorage, Vitest browser project, Testing Library.

---

## Summary

Feature 074 protects article composer input when a signed-in user closes the composer with unsaved content. The close request paths are X, Escape, and backdrop click. All three must route through one shared close guard. The guard opens a custom centered confirmation dialog with actions in this order: `存草稿`, `繼續編輯`, `不儲存並關閉`.

No Firestore collections, document payloads, rules, package metadata, or server-side behavior are involved. Stop immediately if implementation appears to require schema, rules, migration, dependency, or package-lock changes.

## Current Surfaces

- `src/components/ComposeModal.jsx` currently closes directly from the X button and conditionally closes from backdrop when there is no content. Escape currently only prevents close when content exists.
- `src/runtime/hooks/usePostsPageRuntime.js` opens create/edit composer targets from the posts feed and currently resets/closes after submit even when create/update fails.
- `src/runtime/hooks/usePostDetailRuntime.js` opens edit composer targets from the detail page and currently resets/closes after update failure.
- `src/runtime/hooks/usePostsPageRuntimeHelpers.js` already owns pure post-list helpers including `createComposerDraft`.
- `src/ui/posts/PostsPageScreen.jsx` and `src/ui/posts/PostDetailScreen.jsx` pass runtime state and handlers into `ComposeModal`.
- There is no committed `tests/` directory in this checkout. New tests should live next to source files under `src/**` so Vitest browser project picks them up.

## Architecture

- Draft key and payload persistence belongs in `src/repo/client/post-composer-draft-storage-repo.js`.
- Runtime hooks call repo helper functions directly because localStorage is browser persistence already in the client boundary. Do not add service, Firestore, server route, schema, rule, or dependency layers.
- `ComposeModal` gets a single `onRequestClose` prop and calls it from X, Escape, and backdrop. It renders a nested centered confirmation surface while the parent dialog remains open.
- Runtime hooks own draft target identity:
  - create key: `post-composer:draft:create:<uid>`
  - edit key: `post-composer:draft:edit:<uid>:<postId>`
- Draft payload shape is exactly:

```js
{
  title: string,
  content: string,
  updatedAt: string
}
```

`updatedAt` must be ISO-8601 so tests can compare a stable timestamp and user-facing tooling can inspect the value.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/repo/client/post-composer-draft-storage-repo.js` | Create | Build scoped draft keys, save/load/remove draft payloads, enforce 30-day expiry, remove invalid/unparsable/expired payloads, swallow storage availability errors. |
| `src/repo/client/post-composer-draft-storage-repo.test.js` | Create | TDD coverage for key scoping, valid save/load/remove, invalid payload cleanup, expired draft cleanup, and same-user same-target isolation. |
| `src/components/ComposeModal.jsx` | Modify | Replace direct close behavior with one close request path and render the custom confirmation dialog. |
| `src/components/ComposeModal.module.css` | Modify | Style the confirmation surface/actions using existing composer visual language, including primary, secondary, and danger treatments. |
| `src/components/ComposeModal.test.jsx` | Create | Component tests proving X, Escape, and backdrop call the shared close guard and dialog actions render/call handlers in the required order. |
| `src/runtime/hooks/usePostsPageRuntime.js` | Modify | Wire create/edit draft restore/save/discard/delete-on-success for the posts feed composer. Keep failed create/update open and preserve draft. |
| `src/runtime/hooks/usePostsPageRuntime.test.jsx` | Create | Runtime tests for create draft restore, edit draft isolation, save/discard handlers, success cleanup, and failed submit preservation. |
| `src/ui/posts/PostsPageScreen.jsx` | Modify | Pass feed runtime draft-confirm props into `ComposeModal`. |
| `src/runtime/hooks/usePostDetailRuntime.js` | Modify | Wire edit draft restore/save/discard/delete-on-success for the post detail composer. Keep failed update open and preserve draft. |
| `src/runtime/hooks/usePostDetailRuntime.test.jsx` | Create | Runtime tests for detail edit draft restore, success cleanup, failure preservation, and target-scoped discard. |
| `src/ui/posts/PostDetailScreen.jsx` | Modify | Pass detail runtime draft-confirm props into `ComposeModal`. |

## Draft Helper Interface

Implement this public repo-helper API unless Engineer finds a narrower equivalent that still satisfies all acceptance criteria:

```js
export const POST_COMPOSER_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function getPostComposerDraftKey({ uid, postId }) {}

export function savePostComposerDraft({ uid, postId, title, content, now = new Date(), storage = globalThis.localStorage }) {}

export function loadPostComposerDraft({ uid, postId, now = new Date(), storage = globalThis.localStorage }) {}

export function removePostComposerDraft({ uid, postId, storage = globalThis.localStorage }) {}
```

Expected behavior:

- `postId` `null` or `undefined` means create target.
- Missing `uid` or missing edit `postId` must return `null` from key/load and perform no storage write/remove.
- `savePostComposerDraft` writes only `{ title, content, updatedAt }`.
- `loadPostComposerDraft` returns `{ title, content, updatedAt }` only when payload is parseable, fields are strings, and `updatedAt` is no older than 30 days.
- Invalid, unparsable, or expired payloads are removed with `removeItem(key)` and return `null`.
- Storage `getItem`, `setItem`, or `removeItem` exceptions are swallowed and treated as unavailable storage.

## Runtime Data Flow

1. User opens create composer from posts feed:
   - Runtime builds create target from `user.uid`.
   - Runtime loads `post-composer:draft:create:<uid>`.
   - If valid draft exists, apply title/content and show toast `已恢復草稿`.
   - If no draft exists, apply empty title/content.
2. User opens edit composer from posts feed or detail:
   - Runtime builds edit target from `user.uid` and `postId`.
   - Runtime loads `post-composer:draft:edit:<uid>:<postId>`.
   - If valid draft exists, apply draft title/content while preserving original title/content from the post for dirty comparison.
   - If no draft exists, apply the post title/content.
3. User requests close by X, Escape, or backdrop:
   - `ComposeModal` calls `onRequestClose`.
   - Runtime checks unsaved state for the current target.
   - If no unsaved content, close and reset composer state.
   - If unsaved content exists, set confirmation open.
4. User chooses `存草稿`:
   - Runtime saves current title/content to the current target key and closes/resets composer state.
5. User chooses `繼續編輯`:
   - Runtime closes only confirmation state. Main composer remains open.
6. User chooses `不儲存並關閉`:
   - Runtime removes only the current target key and closes/resets composer state.
7. Successful publish/update:
   - Runtime removes only the current target key, then closes/resets composer state.
8. Failed publish/update:
   - Runtime leaves composer open, does not reset title/content, and does not remove the draft.

## Verification Strategy

Required local gates:

- `npx vitest run --project=browser src/repo/client/post-composer-draft-storage-repo.test.js`
- `npx vitest run --project=browser src/components/ComposeModal.test.jsx`
- `npx vitest run --project=browser src/runtime/hooks/usePostsPageRuntime.test.jsx`
- `npx vitest run --project=browser src/runtime/hooks/usePostDetailRuntime.test.jsx`
- `npm run lint:changed`
- `npm run type-check:changed`
- `npm run depcruise`

Browser/manual evidence target:

- Start `npm run dev` only during implementation verification, open `/posts`, sign in with an existing dev account/session, create text, close via X/backdrop/Escape, verify the dialog and the three actions.
- Verify edit draft isolation by saving a draft for article A, saving a different draft for article B, reopening each target, and observing only its own restored content plus toast `已恢復草稿`.
- Do not claim deployed product behavior from local browser evidence.

Regression risk and mitigation:

- Risk: current submit handlers close after failed create/update. Mitigation: runtime tests must assert failed submit keeps the composer open and preserves draft state.
- Risk: edit drafts overwrite the wrong post. Mitigation: helper tests and runtime tests must include two different edit targets.
- Risk: close triggers diverge. Mitigation: component tests must prove X, Escape, and backdrop all call the same `onRequestClose` callback.
- Risk: localStorage unavailable in private browsing. Mitigation: helper catches storage errors and runtime still closes/continues without throwing.

## Workflow State

- Status schema: v3.
- Current head snapshot: capture local branch `074-post-composer-draft-confirm` at the spec commit before planning edits.
- Remote head snapshot: capture current tracking remote `origin/main`; this branch is ahead by the spec commit.
- Last verified commit policy: keep `lastVerifiedCommit` null during planning; set it only after implementation verification passes on a specific commit.
- Phase commit checkpoints:
  - `spec`: `3f536fa42fb0e13c7425a6b6c651149889617d95` (`Add post composer draft confirm spec`)
  - `plan`: to be filled only if a future authorized commit records these planning files
  - `implementation`: to be filled after Engineer/Reviewer implementation
- Rules deploy status: `not_applicable`.
- Incident handling: any schema, security rules, dependency, package metadata, or Firestore requirement opens a blocker and stops dispatch.

## Release Boundary

- Firestore/storage rules deploy authorization:
  `authorizationBoundary.deployFirestoreRules=false`.
- Rules deploy is separate from edit, commit, push, PR, CI, merge, and local `main` sync.
- Final summaries must not imply deployed rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence. This feature should keep `rulesDeployStatus.state=not_applicable`.

## Risk And Stop Conditions

- Stop if implementing the feature requires Firestore schema/rules, Storage rules, server routes, migrations, package metadata, or new dependencies.
- Stop if localStorage scoping cannot be implemented with the current signed-in `user.uid`.
- Stop if task implementation requires writing outside the task owned files.
- Stop if runtime failure handling cannot keep the composer open without changing broader post create/update use cases.
- Stop if same-wave tasks would touch a shared file.
- Stop if verification fails for a reason outside the task slice and the failure is not understood.

## Task Slices

- T001: Storage helper and tests.
- T002: ComposeModal shared close guard and confirmation UI.
- T003: Posts feed composer draft runtime wiring.
- T004: Post detail composer draft runtime wiring.
- T005: Final integration and workflow-state gate.

Dependency graph:

```text
T001 -> T002
T001 -> T003
T002 -> T003
T001 -> T004
T002 -> T004
T003 -> T005
T004 -> T005
```

Parallel waves:

- `wave-1`: T001
- `wave-2`: T002
- `wave-3`: T003 and T004 may run in parallel because owned files are disjoint after T001/T002 land.
- `wave-4`: T005 final integration gate.

Same-wave constraint:

- Do not run T003 and T004 in parallel if either task expands into `src/components/ComposeModal.jsx`, `src/components/ComposeModal.module.css`, `src/repo/client/post-composer-draft-storage-repo.js`, package metadata, or workflow state.
