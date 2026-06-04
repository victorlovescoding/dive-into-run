# Member Auth Gate Spec

## Product Intent

`/member` is a signed-in-only member center entry. Public navigation must not invite unauthenticated users into the member center, and direct unauthenticated visits must return users home with a clear login-required message.

The gate is a UX and routing guard. It does not replace runtime, service, repo, Firebase Auth, or Firebase rules checks.

## Current Problem

Unauthenticated users can currently reach `/member` and see member UI that looks editable even though mutations are guarded. The page can render the `跑者` fallback, `/default-avatar.png`, and the display-name form; submitting the name form silently returns because the runtime exits when no user is present or auth is still loading.

The member entry also must not be exposed in desktop Navbar or mobile drawer while auth is loading or when no signed-in user exists.

## Desired Behavior

- `/member` remains the member center route for signed-in users.
- While auth is loading, desktop Navbar and mobile drawer do not show the `會員頁面` link.
- When auth finishes with `user === null`, desktop Navbar and mobile drawer do not show the `會員頁面` link.
- When a signed-in user exists, desktop Navbar and mobile drawer show the `會員頁面` link to `/member`.
- Direct navigation to `/member` waits for auth loading to finish before deciding.
- If auth finishes with `user === null` on `/member`, the app uses `replace('/')` to send the user home.
- After the home redirect completes, the app shows an info toast with the exact message `請先登入才能進入會員中心`.
- `replace` is required so browser Back does not return to `/member` and immediately redirect again.
- The unauthenticated `/member` state does not render member profile controls, the `跑者` fallback, default avatar, or editable display-name form.
- Existing runtime and data-layer `!user` mutation guards remain in place.

## Non-Goals

- Do not implement return-to-member-after-login behavior.
- Do not change Google sign-in, sign-out, or login button behavior.
- Do not redesign Navbar, mobile drawer, or the member page layout.
- Do not change `/member/favorites`.
- Do not change profile, avatar, bio, dashboard, account deletion, notification, service, repo, Firebase Auth, Firestore rules, Storage rules, schema, migration, or deployment behavior.
- Do not treat this UX guard as a security boundary.
- Do not create a plan, task board, `handoff.md`, or `status.json` for this P2 spec.

## Acceptance Criteria

- `會員頁面` is absent from desktop Navbar while auth is loading.
- `會員頁面` is absent from desktop Navbar when auth has finished and `user` is null.
- `會員頁面` is absent from the mobile drawer while auth is loading.
- `會員頁面` is absent from the mobile drawer when auth has finished and `user` is null.
- A signed-in user sees the `會員頁面` navigation path to `/member` in desktop Navbar and mobile drawer.
- Visiting `/member` directly during auth loading does not redirect until loading is false.
- Visiting `/member` directly as an unauthenticated user redirects with `replace('/')`.
- After the redirect home, one visible info toast says `請先登入才能進入會員中心`.
- Browser Back after the redirect does not land the user back on `/member` for another redirect cycle.
- The unauthenticated member screen does not display `跑者`, `/default-avatar.png`, or an editable display-name form.
- Existing signed-in `/member` behavior remains unchanged.
- Runtime and data-layer guards for `!user` are still present after implementation.

## Risks And Implementation Constraints

- Redirecting before auth loading finishes can incorrectly send signed-in users home; the gate must wait for a settled auth state.
- `ToastProvider` clears toasts on pathname changes, so the login-required toast must be shown after the home redirect in a way that remains visible on `/`.
- React effects can run more than once in development; redirect and toast behavior must avoid duplicate visible toasts for one unauthenticated visit.
- Navbar and mobile drawer must apply the same member-link eligibility rule so desktop and mobile navigation do not diverge.
- The member-link filter must not hide unrelated public navigation items or authenticated-only UI that already has separate rules.
- The route guard must not remove existing mutation guards; unauthenticated UI prevention is not authorization.
- The scope intentionally omits return-to-member-after-login; no member-specific return target is added to the login flow.

## Verification Expectations

- Run `npm run lint:changed` after implementation and expect no changed-file lint errors.
- Run `npm run type-check:changed` after implementation and expect no changed-file type errors.
- Run a focused browser or Playwright check for desktop Navbar, mobile drawer, unauthenticated direct `/member`, and signed-in `/member`.
- Verify unauthenticated direct `/member` waits for auth resolution, redirects to `/` with history replacement, and shows exactly `請先登入才能進入會員中心` as an info toast.
- Verify browser Back after the redirect does not re-enter `/member`.
- Verify unauthenticated navigation does not show `會員頁面` on desktop or mobile.
- Verify signed-in navigation and signed-in `/member` behavior still work.
- Verify the diff keeps service/repo/Firebase rules/schema/deployment files untouched unless a future authorized task explicitly expands scope.
