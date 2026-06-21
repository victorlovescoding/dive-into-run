# Implementation Plan: 未登入使用者的收藏登入接續流程

**Branch**: `110-favorite-login-continuation` | **Spec Key**: `106-favorite-login-continuation` | **Date**: 2026-06-20 | **Spec**: `specs/106-favorite-login-continuation/spec.md`
**Input**: Feature specification from `specs/106-favorite-login-continuation/spec.md`

**Note**: This is the long-term Spec Kit planning artifact for the explicit `$speckit-plan` workflow. Ordinary repo work must continue to use `AGENTS.md` Context Routing first. `setup-plan.sh` was executed with `SPECIFY_FEATURE=106-favorite-login-continuation` because the current git branch is `110-favorite-login-continuation` while the accepted spec directory is `specs/106-favorite-login-continuation`.

## Summary

Build a page-local continuation flow for unauthenticated event and post favorite clicks. Instead of showing only the existing `請先登入才能收藏` toast, applicable pages open a lightweight dialog with the exact spec copy, start Google popup sign-in only after the user presses `使用 Google 登入`, then add the original event/post favorite with the existing content favorite use-case. After a successful automatic add, only the current page item that triggered the flow is marked favorited and the toast `登入成功，已加入收藏` is shown.

The implementation must preserve all existing signed-in favorite toggle behavior. The new flow is add-only for unauthenticated intent; it never toggles off, never persists across reloads, never displays the target title/name in the dialog, and never applies to weather favorites, member favorites, running records, comments, likes, or any route outside `/events`, `/events/[id]`, `/posts`, `/posts/search`, and `/posts/[id]`.

## Technical Context

**Language/Version**: JavaScript ES6+ with JSDoc and `checkJs: true`; Next.js 15 App Router; React 19.
**Primary Dependencies**: Firebase v9 Auth/Firestore client repos and facades, existing `content-favorite-use-cases`, React runtime hooks, CSS Modules, Vitest, React Testing Library, Playwright for browser verification.
**Storage**: Existing Firestore owner subcollections `users/{uid}/favoriteEvents/{eventId}` and `users/{uid}/favoritePosts/{postId}` through `addContentFavorite`; no new durable storage for pending intent.
**Testing**: Vitest unit tests for helper/hook/runtime branches, React Testing Library integration tests for the dialog and page wiring, focused existing runtime/UI tests for events/posts, and optional Playwright/manual browser validation for Google popup behavior.
**Target Platform**: Browser-based Next.js web app.
**Project Type**: Single Next.js web application.
**Performance Goals**: Opening the dialog is local state only. A successful continuation performs one Google popup flow and one favorite add write. No cross-page/global favorite synchronization, no list reload, and no favorite history query are required.
**Constraints**: Preserve forward-only dependencies `Types -> Config -> Repo -> Service -> Runtime -> UI`; UI files render only; runtime owns continuation state and side effects; Firebase calls stay in repo/use-case layers; pending intent is memory-only and must disappear on page reload; only one pending continuation may exist at a time; auth cancellation/close/failure keeps the dialog open and does not add a favorite; auto-add failure clears the intent, leaves the item unfavorited, and shows `收藏失敗，請稍後再試`.
**Scale/Scope**: One reusable dialog component, one reusable continuation runtime hook/use-case helper, five page/runtime wiring points, and focused tests. No full login page, no email/password path, no member favorites page changes, and no weather favorite changes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Design Gate

- **I. SDD/TDD**: PASS. `specs/106-favorite-login-continuation/spec.md` and `checklists/requirements.md` are complete and contain no unresolved clarification markers. This plan creates only planning artifacts; executable tests must be added under `tests/**` during implementation.
- **II. Strict Layered Architecture**: PASS. The planned flow keeps Firebase Auth and favorite writes behind runtime use-cases and existing repo/service boundaries. UI receives render state and callbacks only.
- **III. UX & Consistency**: PASS. Dialog copy is Traditional Chinese and exact to the spec. Existing favorite buttons remain the entry points; the dialog must use accessible `role="dialog"`/`aria-modal` conventions already used by local modal components.
- **IV. Performance & Concurrency**: PASS. The continuation is page-local memory state and a single idempotent favorite add (`setDoc` via existing content favorite use-case). No shared aggregate mutation or transaction is introduced.
- **V/VI. Code Quality & Modern Standards**: PASS. Future implementation remains JavaScript with JSDoc, CSS Modules, React 19 hook rules, no JSX-heavy logic, and no lint/cSpell bypasses.
- **VII. Security & Secrets**: PASS. No secrets or new env vars. Google sign-in uses the existing Firebase Auth provider.
- **VIII. Agent Interaction Protocol**: PASS. User explicitly authorized long-term Spec Kit planning artifacts and `AGENTS.md` marker update only. No product code, tests, staging, commit, push, PR, merge, or local main sync is authorized.
- **IX. Strict Coding Iron Rules**: PASS. Planned UI component owns markup only; continuation branching and side effects stay in runtime/helper code.

### Post-Design Gate

- **Design artifacts**: PASS. `research.md`, `data-model.md`, `contracts/favorite-login-continuation.md`, and `quickstart.md` define the implementation boundaries needed for `$speckit-tasks`.
- **Clarifications**: PASS. No unresolved clarification markers remain.
- **Scope boundary**: PASS. The design explicitly excludes member favorites, weather favorites, non-event/post favorites, full login pages, email/password auth, cross-page state sync, and signed-in favorite behavior changes.
- **Agent context update**: PASS with repo-specific exception. The generic `.specify/scripts/bash/update-agent-context.sh` script was intentionally not used because it can append generic Active Technologies/Recent Changes sections to `AGENTS.md`. This repo requires a marker-only update that preserves explicit-only Spec Kit language.

## Project Structure

### Documentation (this feature)

```text
specs/106-favorite-login-continuation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── favorite-login-continuation.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Future `$speckit-tasks` output, not created by this plan
```

### Source Code (planned implementation paths)

```text
src/
├── components/
│   ├── FavoriteLoginContinuationDialog.jsx
│   └── FavoriteLoginContinuationDialog.module.css
├── runtime/
│   ├── client/
│   │   └── use-cases/
│   │       └── favorite-login-continuation-use-cases.js
│   ├── favorites/
│   │   └── favorite-login-continuation-helpers.js
│   └── hooks/
│       └── useFavoriteLoginContinuation.js
├── runtime/hooks/
│   ├── useEventsPageRuntime.js
│   ├── useEventDetailRuntime.js
│   ├── usePostsPageRuntime.js
│   ├── usePostsSearchPageRuntime.js
│   └── usePostDetailRuntime.js
└── ui/
    ├── events/
    │   ├── EventsPageScreen.jsx
    │   └── EventDetailScreen.jsx
    └── posts/
        ├── PostsPageScreen.jsx
        ├── PostsSearchPageScreen.jsx
        └── PostDetailScreen.jsx
```

Existing favorite entry points to preserve and extend:

- `/events`: `src/runtime/hooks/useEventsPageRuntime.js` currently shows `請先登入才能收藏` when `user?.uid` is missing and otherwise toggles `favoriteEventIds`; `src/ui/events/EventsPageScreen.jsx` passes `handleToggleFavoriteEvent` to `EventsListSection`.
- `/events/[id]`: `src/runtime/hooks/useEventDetailRuntime.js` currently shows the same login toast when unauthenticated and otherwise toggles `isFavoriteEvent`; `src/ui/events/EventDetailScreen.jsx` renders `BookmarkButton`.
- `/posts`: `src/runtime/hooks/usePostsPageRuntime.js` currently shows the login toast when `userUid` is missing and otherwise toggles `post.isFavorited`; `src/ui/posts/PostsPageScreen.jsx` passes the handler to `PostCard`.
- `/posts/search`: `src/runtime/hooks/usePostsSearchPageRuntime.js` currently shows the login toast when `userUid` is missing and otherwise toggles nested search result `post.isFavorited`.
- `/posts/[id]`: `src/runtime/hooks/usePostDetailRuntime.js` currently shows the login toast when unauthenticated and otherwise toggles detail `postDetail.isFavorited`; `src/ui/posts/PostDetailScreen.jsx` passes the handler to `PostCard`.

### Test Structure (planned)

```text
tests/
├── unit/
│   ├── runtime/
│   │   ├── favorite-login-continuation-helpers.test.js
│   │   ├── favorite-login-continuation-use-cases.test.js
│   │   ├── useFavoriteLoginContinuation.test.jsx
│   │   ├── useEventsPageRuntime.test.jsx
│   │   ├── usePostsSearchPageRuntime.test.jsx
│   │   └── usePostDetailRuntime.test.jsx
│   └── ui/
│       ├── events/
│       │   ├── EventsListSection.test.jsx
│       │   └── EventDetailScreen.test.jsx
│       └── posts/
│           ├── PostsPageScreen.test.jsx
│           ├── PostsSearchPageScreen.test.jsx
│           └── PostDetailScreen.test.jsx
├── integration/
│   └── favorites/
│       └── FavoriteLoginContinuationDialog.test.jsx
└── e2e/
    └── favorite-login-continuation.spec.js
```

The exact test filenames may be adjusted by `$speckit-tasks` to match nearby local conventions, but tests must stay under `tests/**`.

**Structure Decision**: Keep the flow in the existing single-app layout. Add a reusable runtime hook/use-case and dialog, then wire each applicable page to the same continuation contract while each page remains responsible for its own local favorite-state update after success. Do not create route handlers, Firestore schema changes, or a global favorite store.

## Task Sequencing Guidance For `$speckit-tasks`

1. **Pure helper contract first**: add helper/reducer tests for copy selection, single-intent guard, state transitions, auth-error classification, and no-persistence defaults.
2. **Client use-case next**: test `signInWithGoogle` success, popup cancel/close/failure, `addContentFavorite` success, already-favorited idempotent success, and add failure mapping.
3. **Reusable hook after use-case**: test open, cancel, close, confirm, retry, pending guard, success callback, failure callback, and no second pending flow.
4. **Dialog component before page wiring**: test exact title/body/buttons, no target title/name rendering, close button, primary button disabled/pending state, and accessible dialog role/name.
5. **Event runtimes**: replace unauthenticated toast branches on `/events` and `/events/[id]` with continuation open; keep signed-in add/remove behavior unchanged.
6. **Post runtimes**: replace unauthenticated toast branches on `/posts`, `/posts/search`, and `/posts/[id]` with continuation open; keep signed-in add/remove behavior unchanged.
7. **Screen wiring**: render the dialog in the five applicable screens and pass the runtime contract through existing screen boundaries.
8. **Regression and browser verification**: cover cancellation/retry, auth failure, add failure rollback, already-favorited success, and excluded pages/types.

Parallelization candidates after the pure helper contract lands: dialog tests, client use-case tests, and page UI wiring tests can be drafted in parallel because their write sets are separate. Runtime wiring tasks should be sequenced by page family to avoid conflicting edits in shared hooks.

## Complexity Tracking

No constitution violations are required for this plan.

### Gate Notes

- **Add-only continuation**: The unauthenticated intent always calls `addContentFavorite`; it must never call `removeContentFavorite`.
- **Idempotent already-favorited success**: Existing `addContentFavorite` writes the favorite document with the target id, so a repeated add is a success path and must not toggle off.
- **Manual AGENTS marker patch**: Use a marker-only patch for `AGENTS.md`; do not run `.specify/scripts/bash/update-agent-context.sh` for this repo.
- **No persistent intent**: Do not use localStorage, sessionStorage, URL params, cookies, IndexedDB, or Firestore to remember the pending intent.
