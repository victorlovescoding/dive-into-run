# Code Review — 010-responsive-navbar

日期：2026-04-09

---

## Taste Rating: 🟡 **Acceptable** — Works, component extraction is solid, remaining issues are non-blocking

The 4 critical issues from the previous review have been addressed: `useRouter` is now mocked (53 tests passing), bare `history` replaced with `window.history` (lint clean), component extracted from 391 → 97 lines, and the popstate race condition fixed with a proper `closedByPopState` reset effect + `isDrawerOpen` guard in `closeDrawer`. The extraction into `useMobileDrawer` / `useUserMenu` / `MobileDrawer` / `UserMenu` is well-done — clean separation of concerns, z-index stacking context correctly preserved. The remaining issues are improvement-tier, not blocking.

---

## Linus-Style Analysis

### [CRITICAL ISSUES] (Must fix — these break fundamental principles)

**None.** All 4 previously-critical issues have been resolved:

1. ~~`useRouter` not mocked~~ — Fixed. All 3 integration test files now mock `useRouter` with `replace` and `push`. 53/53 tests pass.
2. ~~bare `history` usage~~ — Fixed. `window.history.back()` and `window.history.pushState()` at `useMobileDrawer.js` lines 74, 94, 123. `npm run lint` = 0 errors.
3. ~~391-line monolith~~ — Fixed. `Navbar.jsx` is 97 lines. Logic split into `useMobileDrawer.js` (148 lines), `useUserMenu.js` (84 lines), `MobileDrawer.jsx` (95 lines), `UserMenu.jsx` (85 lines), `nav-constants.js` (27 lines).
4. ~~popstate race condition~~ — Fixed. `closedByPopState.current = false` reset moved to a dedicated effect (`useMobileDrawer.js` lines 41-45) that fires when `isDrawerOpen` becomes false. `closeDrawer` has `if (!isDrawerOpen) return` guard (line 120).

### [IMPROVEMENT OPPORTUNITIES] (Should fix — violates good taste)

1. **[useMobileDrawer.js, Line 135] `router.replace(href)` still loses browser history**

   `handleLinkClick` still uses `router.replace(href)` instead of `router.push(href)`. This means users cannot press Back to return to the page they were on before clicking a drawer link. This was issue #5 in the previous review and remains unfixed.

   **Fix**: `router.push(href)` instead of `router.replace(href)`.

2. **[useMobileDrawer.js, Lines 113-115] `setTimeout(300)` magic number, no cleanup**

   The transition guard still uses a hardcoded `300` that's coupled to the CSS transition duration (`0.3s` in `.drawer`). If CSS changes, this silently desyncs.

   **Fix**: Extract `const TRANSITION_DURATION = 300;` as a named constant. Add cleanup in an unmount effect or clear the timer ref.

3. **[MobileDrawer.jsx, Line 86] Drawer sign-out still doesn't close drawer**

   Mobile drawer's sign-out button still calls `signOutUser` directly without closing the drawer first. Desktop dropdown (via `useUserMenu.handleSignOut`) closes the dropdown before signing out. Inconsistent behavior.

   **Fix**: Pass `closeDrawer` to MobileDrawer and wrap sign-out: `onClick={() => { closeDrawer(); signOutUser(); }}`.

4. **[UserMenu.jsx, Line 32 / MobileDrawer.jsx, Line 79] No error handling on `signInWithGoogle`**

   Both login buttons pass `signInWithGoogle` directly as `onClick`. If the popup is blocked or the user cancels, the rejected promise is unhandled.

   **Fix**: Wrap in a handler that catches `auth/popup-closed-by-user` errors silently.

5. **[Navbar.module.css, Line 111] `will-change: transform` permanently set on `.drawer`**

   Still on the base `.drawer` class, not conditionally on `.drawerOpen`. Wastes GPU memory for an element that transitions rarely.

   **Fix**: Move to `.drawerOpen` or apply via JS class just before transition.

### [STYLE NOTES] (Minor — only mention if genuinely important)

6. **[Navbar.module.css] Dark mode hardcoded colors**

   12+ instances of hardcoded colors (`#2563eb`, `rgba(0,0,0,0.05)`, `#e5e7eb`, `#9ca3af`) that won't adapt to dark mode. If dark mode is out of scope, this is acceptable as a known limitation.

7. **[nav-constants.js] No `'use client'` directive**

   `nav-constants.js` is imported by both client components (`MobileDrawer.jsx`, `Navbar.jsx`). It works because it only exports data/pure functions (no hooks or browser APIs), but adding `'use client'` would make the intent explicit and prevent future confusion if someone adds a hook here.

### [TESTING GAPS]

8. **[Integration tests] No tests for `history.pushState/popstate` behavior**

   The popstate integration (browser back button closes drawer) is the most complex state management in the component. It now has a correct implementation with the `closedByPopState` reset effect, but zero test coverage. A test that simulates `popstate` would validate the fix.

9. **[Integration tests] Duplicated test infrastructure (~56 lines)**

   `NavbarMobile.test.jsx` and `NavbarDesktop.test.jsx` still share ~56 identical lines of mock definitions, `renderNavbar` helpers, and `matchMedia` setup. Extract to a shared `test-helpers.js`.

10. **[Unit tests] `firebase-auth-helpers.test.js` is still a tautology**

    The test asserts `signInWithPopup` was called with `auth` and `provider` — which is literally the entire implementation. Zero regression protection.

### [TASK GAPS]

11. **[T009] `role="list"` specified in task but removed**

    T009 description says "將 T002 的 flat link list 包進 `<ul role="list">`". The implementation removed `role="list"` because `jsx-a11y/no-redundant-roles` flagged it. This is actually the correct call — the lint rule is right that `<ul>` has implicit list role. However, note that Safari strips the implicit role when `list-style: none` is applied via CSS. Since `.desktopLinks` uses `list-style: none` (line 220), VoiceOver users on Safari won't hear "list, 5 items". The contract (`navbar-contract.md` line 58) also specifies `role="list"`.

    **Verdict**: This is a known Safari accessibility bug. If Safari a11y matters, override the lint rule for this specific element. If not, document the tradeoff.

12. **[T014, T016] Marked complete but no E2E tests**

    The `specs/010-responsive-navbar/tests/e2e/` directory is empty. T014 (cross-viewport verification) and T016 (edge cases) have no Playwright tests. The implementations exist but verification was likely done manually.

---

## VERDICT

✅ **Worth merging** — All 4 critical blockers resolved. Core architecture is now clean.

The component extraction is well-executed: clear separation between drawer state machine (`useMobileDrawer`) and dropdown state machine (`useUserMenu`), z-index stacking context correctly preserved, DOM structure unchanged, 97-line composition in Navbar.jsx. The race condition fix (dedicated effect for `closedByPopState` reset + `isDrawerOpen` guard in `closeDrawer`) is the right approach.

Remaining items (issues 1-5) are improvement-tier and can be addressed in a follow-up. Issues 8-10 (testing gaps) are pre-existing from the original implementation.

**KEY INSIGHT:**
The extraction proves the original review's central claim: the two state machines (drawer + dropdown) were always independent. Pulling them into separate hooks required zero shared state — confirming the split was overdue and the component's complexity was purely accidental, not essential.
