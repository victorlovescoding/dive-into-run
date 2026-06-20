# Research: 未登入使用者的收藏登入接續流程

## Decision: Page-local runtime flow instead of global auth redirect state

**Decision**: Store the pending favorite continuation intent only in the current page runtime/hook state. Do not write the intent to localStorage, sessionStorage, URL params, cookies, IndexedDB, Firestore, or a global provider.

**Rationale**: The spec requires that pending intent not survive page reload. Existing applicable favorite state is also page-local: event list state lives in `useEventsPageRuntime`, event detail state lives in `useEventDetailRuntime`, posts list/search/detail each own their rendered favorite flags. Page-local state lets success update only the item that triggered the flow, matching FR-017.

**Alternatives considered**:

- Global favorite continuation provider: rejected because it makes cross-page/global state synchronization easier to introduce accidentally.
- Session/local storage: rejected because reload must clear the pending intent.
- URL callback state: rejected because the sign-in flow uses Google popup, not a full-page login return route.

## Decision: Replace only unauthenticated favorite branches

**Decision**: Keep the existing signed-in toggle branches unchanged. For unauthenticated event/post favorite clicks on applicable pages, replace the current `請先登入才能收藏` toast branch with `openFavoriteLoginContinuation(...)`.

**Rationale**: Existing code already separates unauthenticated and signed-in behavior. Event list uses `useEventsPageRuntime` with a missing-uid toast before optimistic add/remove. Event detail, posts list, posts search, and post detail follow the same pattern. This creates a narrow implementation surface and protects FR-014.

**Alternatives considered**:

- Rewrite all favorite flows behind one new generic toggle function: rejected because it increases blast radius and risks changing signed-in behavior.
- Keep the toast and add a login action to it: rejected because the spec requires a lightweight dialog with two explicit buttons and delayed login popup.

## Decision: Add-only continuation after Google sign-in

**Decision**: After successful Google sign-in, call `addContentFavorite({ uid, type, targetId })` for the original item. Do not inspect current favorite state to decide between add/remove, and never call `removeContentFavorite` from the continuation path.

**Rationale**: The unauthenticated intent means "add to favorites" rather than "toggle". Existing `addContentFavorite` normalizes uid/target id and writes `users/{uid}/favoriteEvents/{eventId}` or `users/{uid}/favoritePosts/{postId}` through `setDoc`, making an already-favorited item an idempotent success.

**Alternatives considered**:

- Reuse signed-in toggle logic after login: rejected because if the item is already favorited it would remove the favorite, violating FR-008.
- Query favorite state before add: rejected because the add is already idempotent and the feature does not need extra reads.

## Decision: Use existing Google popup helper

**Decision**: Trigger Google login through the existing `signInWithGoogle` facade/use-case path only when the user presses `使用 Google 登入`.

**Rationale**: Existing Firebase Auth code exposes `signInWithGoogle` via `src/lib/firebase-auth-helpers.js`, backed by `signInWithPopup(auth, provider)` in `src/repo/client/firebase-auth-repo.js`. Current UI login entry points already use that helper, so the continuation does not need a new auth provider or route.

**Alternatives considered**:

- Redirect-based sign-in: rejected because the spec says lightweight dialog and current app uses popup helpers.
- Full login page: rejected by excluded scope.
- Email/password login: rejected by excluded scope.

## Decision: Keep auth failures retryable in the dialog

**Decision**: If Google sign-in is cancelled, the popup is closed, another popup request is cancelled, or sign-in otherwise rejects, keep the dialog open, reset the pending button state, do not call `addContentFavorite`, and do not show a success/failure toast from the favorite flow.

**Rationale**: The spec says login cancel/close/failure must keep the dialog open for retry and must not add a favorite. It also says the user should not be disturbed by an error prompt when actively exiting. Keeping the same dialog visible is the least surprising retry surface.

**Alternatives considered**:

- Close the dialog on auth failure: rejected because the user must be able to retry from the dialog.
- Show `收藏失敗，請稍後再試` for login failure: rejected because that message is reserved for automatic favorite add failure after login succeeds.

## Decision: Clear intent after favorite add failure

**Decision**: If sign-in succeeds but `addContentFavorite` fails, clear and close the continuation dialog, leave the page item in the unfavorited state, and show `收藏失敗，請稍後再試`.

**Rationale**: The retryable state is specified for login cancellation/close/failure. Add failure is a completed login flow that failed the automatic favorite step; the spec says to return to the original page state and show the favorite failure message.

**Alternatives considered**:

- Keep the dialog open after add failure: rejected because the dialog's primary action is login, and the user is already logged in after this failure.
- Optimistically mark favorite before add finishes: rejected because FR-011 requires the button remain unfavorited on add failure.

## Decision: Shared dialog component with content-type copy

**Decision**: Create one reusable dialog component with fixed title `登入後即可收藏`, primary button `使用 Google 登入`, secondary button `稍後再說`, close affordance, and body copy selected by content type.

**Rationale**: Event and post flows share the same shell and differ only by body copy. A shared component reduces drift and makes it easy to enforce "do not render target title/name".

**Alternatives considered**:

- Duplicate dialog markup in five screens: rejected because exact copy and accessibility behavior would drift.
- Put the target title in the dialog for clarity: rejected by explicit edge case and FR-003.

## Decision: Single pending intent guard

**Decision**: When a continuation dialog is already open or its login/add action is pending, additional unauthenticated favorite clicks must not create a second dialog, second popup, or second pending intent. The first pending intent remains authoritative until it succeeds, fails after add, is cancelled, or is closed.

**Rationale**: The spec says only one continuation flow can exist at a time. Ignoring later triggers is simpler and safer than replacing the target while a popup is possible.

**Alternatives considered**:

- Replace the pending target with the newest click: rejected because it can surprise the user after they already saw copy for the first click.
- Queue multiple intents: rejected by the "same time one flow" rule and unnecessary for MVP.

## Decision: Dialog accessibility follows existing modal conventions

**Decision**: Render the continuation dialog with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, explicit close button label, and button elements for both actions. Use CSS Modules for styling.

**Rationale**: Existing reusable dialogs use these semantics, including `ReportDialog` and event delete confirmation. This matches the repo's accessibility and UI consistency expectations without introducing a new dialog library.

**Alternatives considered**:

- Native `window.confirm`: rejected because it cannot provide the required copy/buttons or login action.
- Unlabeled custom overlay: rejected because it would fail accessibility expectations.

## Decision: Focused test strategy

**Decision**: Add unit coverage for helper/use-case/hook state transitions, integration coverage for dialog rendering and clicks, focused runtime tests for each applicable page branch, and page UI tests proving the dialog is rendered from runtime state.

**Rationale**: Existing tests mock Auth/Toast/Favorite use-cases with `vi.hoisted`/`vi.mock`, use React Testing Library for runtime hooks and components, and assert accessible roles/names for dialogs/buttons. The feature is mostly runtime/UI behavior, so emulator or Firestore rules tests are not needed unless later implementation changes persistence/rules.

**Alternatives considered**:

- Only manual browser testing: rejected because cancellation, retry, add failure, and signed-in regressions need deterministic coverage.
- Only unit tests: rejected because the specified dialog copy and page wiring are user-facing acceptance criteria.
