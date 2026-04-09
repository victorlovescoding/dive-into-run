# Code Review — 010-responsive-navbar

日期：2026-04-09

---

## Taste Rating: 🔴 **Needs improvement** — Fundamental engineering issues prevent merge

The component works, the spec coverage is thorough, and the a11y effort is genuine. But three hard facts block this: **43 of 53 tests fail** because `useRouter` is not mocked, **ESLint has 3 errors**, and the component is **391 lines** — nearly 2x the 200-line extraction threshold the plan explicitly set. These are not style nits; they are violations of the project's own stated standards.

---

## Linus-Style Analysis

### [CRITICAL ISSUES] (Must fix — these break fundamental principles)

1. **[src/components/Navbar/Navbar.jsx, Line 49] Tests crash on render — `useRouter` not mocked**

   `const router = useRouter();` is called during render. The integration test mocks only provide `usePathname`:

   ```js
   vi.mock('next/navigation', () => ({
     usePathname: () => mockUsePathname(),
   }));
   ```

   `useRouter` is `undefined`, so `useRouter()` throws `TypeError: useRouter is not a function`. **43 of 53 tests fail.** This means all 3 integration test suites are red. The `[x]` marks on T005-T012 in tasks.md are invalid — these tasks were never verified by passing tests.

   **Fix**: Add `useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() }))` to all three integration test mock factories.

2. **[src/components/Navbar/Navbar.jsx, Lines 100, 121, 193] ESLint `no-restricted-globals`: bare `history` usage**

   Three instances of `history.pushState()` and `history.back()` without the `window.` prefix. ESLint Airbnb config restricts bare `history` to avoid confusion with the history npm package.

   ```
   100:11  Error: Unexpected use of 'history'.  no-restricted-globals
   121:5   Error: Unexpected use of 'history'.  no-restricted-globals
   193:7   Error: Unexpected use of 'history'.  no-restricted-globals
   ```

   CLAUDE.md Rule 5: "Task completion requires `npm run lint` to pass." This rule was violated.

   **Fix**: Replace `history.pushState(...)` with `window.history.pushState(...)` and `history.back()` with `window.history.back()`.

3. **[src/components/Navbar/Navbar.jsx] 391 lines — 2x the stated extraction threshold**

   The plan explicitly said: "若 Navbar.jsx 超過 ~200 行，再拆分 MobileDrawer.jsx、UserMenu.jsx 等子元件". At 391 lines, this is nearly double. The component manages 2 independent state machines (drawer + dropdown), 8 separate `useEffect` hooks, and 3 conceptually distinct UI regions (hamburger/drawer, desktop links, user section). This is too much responsibility for one function.

   **Why this matters**: Good taste is about knowing when to split. 8 `useEffect` hooks is a code smell — it means the component is doing too many things. The drawer logic (popstate, scroll lock, transition guard, Escape, focus) is entirely independent of the dropdown logic (click outside, Escape, focus). They share zero state.

   **Fix**: Extract at minimum:
   - `MobileDrawer.jsx` — drawer state, scroll lock, popstate, Escape, focus management
   - `UserMenu.jsx` — dropdown state, click outside, Escape, focus management
   - Navbar.jsx becomes ~80 lines of composition

4. **[src/components/Navbar/Navbar.jsx, Lines 117-133 + 89-108 + 179-197] `history.pushState/back()` state machine is fragile**

   The drawer's history integration has 3 code paths that call `history.back()` (Escape handler, closeDrawer callback, handleLinkClick) and 1 path that sets `closedByPopState.current = true` (popstate listener + handleLinkClick). The `closedByPopState` ref acts as a mutex to prevent double-back, but:
   - If drawer is closed by overlay click → `closeDrawer()` calls `history.back()` → popstate fires → `closedByPopState` is set to `true` → but `closeDrawer` already reset it to `false` on line 195. **Race condition**: the order of `history.back()` (async) vs `closedByPopState = false` (sync) is undefined.
   - If `closeDrawer()` is called when drawer is already closed (e.g., by a stale event handler), `history.back()` navigates away from the current page — catastrophic.

   **Fix**: Simplify. Use a single `closeDrawer(source)` that checks `isDrawerOpen` before acting, and centralizes the `history.back()` decision based on whether the close was triggered by popstate or not. Or better: use a single state variable instead of a ref for the popstate flag.

### [IMPROVEMENT OPPORTUNITIES] (Should fix — violates good taste)

5. **[src/components/Navbar/Navbar.jsx, Lines 200-209] `router.replace(href)` loses browser history**

   `handleLinkClick` prevents the Link's default behavior and manually calls `router.replace(href)`. `replace` removes the current history entry — meaning users **cannot press Back to return** to the page they were on before clicking a drawer link. This is a "never break userspace" violation.

   **Why it exists**: To coordinate drawer closing with navigation and avoid the back button hitting the pushState entry. But the fix is wrong — it breaks a fundamental browser contract.

   **Fix**: Use `router.push(href)` instead of `replace`. Handle the pushState cleanup separately by calling `history.back()` before navigation (which pops the drawer entry), or remove the pushState pattern entirely and handle the Android back button differently.

6. **[src/components/Navbar/Navbar.jsx, Lines 180-187] `isTransitioning` ref with `setTimeout(300)` — magic number, no cleanup**

   The transition guard uses a hardcoded 300ms timeout that isn't tied to the actual CSS transition duration. If CSS changes to 200ms or 500ms, this silently breaks. Worse, if the component unmounts during the 300ms window, `isTransitioning.current` is set on a stale ref — harmless in React but still sloppy.

   **Fix**: Define `const TRANSITION_DURATION = 300;` as a named constant shared between JS and CSS (or use `transitionend` event instead of timeout). Add cleanup: `const timer = setTimeout(...); return () => clearTimeout(timer);` — but since this is in a callback, not an effect, use a ref for the timer ID and clear it in an unmount effect.

7. **[src/components/Navbar/Navbar.jsx, Line 253] Missing `role="list"` on desktop `<ul>`**

   The contract at `contracts/navbar-contract.md` line 117 specifies `<ul role="list">`. The implementation uses `<ul className={styles.desktopLinks}>` without explicit `role="list"`. The CSS applies `list-style: none`, which causes **Safari to remove the implicit list role** for accessibility. VoiceOver users on Safari won't hear "list, 5 items".

   **Fix**: Add `role="list"` to `<ul className={styles.desktopLinks}>`.

8. **[src/components/Navbar/Navbar.module.css, Line 111] `will-change: transform` permanently set on `.drawer`**

   `will-change` tells the browser to allocate GPU memory for compositing. Setting it permanently on an element that transitions maybe twice per session wastes memory. The spec says "提示瀏覽器預先分配 GPU 記憶體" — yes, but permanently is wrong.

   **Fix**: Move `will-change: transform` to `.drawerOpen` or add it via a class just before the transition starts.

9. **[src/components/Navbar/Navbar.jsx, Line 380] Drawer sign-out doesn't close drawer**

   Desktop sign-out uses `handleSignOut` which closes the dropdown first (line 218). Mobile drawer sign-out directly calls `signOutUser` (line 380) without closing the drawer. After signing out, the drawer remains open showing stale auth state until the AuthContext re-renders.

   **Fix**: Wrap the drawer sign-out in a handler that calls `closeDrawer()` then `signOutUser()`.

10. **[src/components/Navbar/Navbar.jsx, Line 275] No error handling on `signInWithGoogle` click**

    Both the desktop login button (line 275) and drawer login button (line 373) pass `signInWithGoogle` directly as `onClick`. If the popup is blocked by the browser or the user closes it, the rejected promise is unhandled. In strict mode, this can log console errors and confuse users.

    **Fix**: Wrap in a handler that catches and silently handles `auth/popup-closed-by-user` errors.

### [STYLE NOTES] (Minor — only mention if genuinely important)

11. **[src/components/Navbar/Navbar.jsx, Line 391] `isActivePath` and `NAV_ITEMS` exported from component file**

    These are pure data/functions exported from a 391-line component file. To unit test `isActivePath`, the test file has to `vi.mock` three modules (`next/navigation`, `@/contexts/AuthContext`, `@/lib/firebase-auth-helpers`) just to import the function. This is a design smell — pure logic should live in a separate file.

    **Fix**: Move `isActivePath` to `src/lib/nav-helpers.js` or `src/components/Navbar/nav-utils.js`. Move `NAV_ITEMS` to a shared config file or the same utils file.

12. **[src/components/Navbar/Navbar.module.css] Dark mode only partially supported**

    `.navbar` uses `var(--background, #ffffff)` for background, which works with the dark mode CSS variables in `globals.css`. But `.linkActive` hard-codes `color: #2563eb` (blue), `.skeleton` hard-codes `background-color: #e5e7eb`, and `.drawerAuth` hard-codes `border-top: 1px solid rgba(0, 0, 0, 0.1)`. These will look wrong on dark backgrounds.

    **Note**: If dark mode is out of scope for this feature, this is fine — but flag it as a known limitation.

### [TESTING GAPS]

13. **[specs/010-responsive-navbar/tests/unit/firebase-auth-helpers.test.js] Mocks Aren't Tests**

    This entire test file mocks `signInWithPopup` and `signOut`, then asserts they were called with `auth` and `provider`. The implementation is literally `return signInWithPopup(auth, provider)` — a one-line function. The test is just re-stating the implementation. It cannot catch regressions because any change to the implementation would also require changing the mock.

    **Verdict**: These tests add maintenance burden with zero regression protection. Either delete them (the integration tests cover the auth flow through real component interactions) or test at a higher level.

14. **[specs/010-responsive-navbar/tests/unit/isActivePath.test.js] Excessive mocking for a pure function**

    The test requires 3 `vi.mock` calls for modules it never uses, just because `isActivePath` is exported from `Navbar.jsx`. This is a direct consequence of issue #11. If the function were in its own file, the test would be 20 lines with zero mocks.

15. **[specs/010-responsive-navbar/tests/integration/] No tests for `history.pushState/popstate` behavior**

    T016 marks the following edge cases as `[x]` complete:
    - 手機旋轉時面板適應或自動關閉
    - 滑出面板展開時按瀏覽器返回鍵關閉面板
    - 快速連續點擊漢堡按鈕不導致狀態不一致

    None of these have corresponding tests. The popstate behavior is the most complex state management in the component and has the race condition described in issue #4. Testing it would have revealed the bug.

16. **[specs/010-responsive-navbar/tests/integration/] Duplicated test infrastructure**

    `NavbarMobile.test.jsx` and `NavbarDesktop.test.jsx` have identical:
    - Mock definitions (Link, Image, usePathname, AuthContext, firebase-auth-helpers)
    - `renderNavbar()` helper function
    - `matchMedia` mock setup in `beforeEach`

    ~50 lines of boilerplate duplicated verbatim. Extract to a shared `specs/010-responsive-navbar/tests/helpers/navbar-test-utils.jsx`.

### [TASK GAPS]

17. **[T005-T012] All marked `[x]` but tests fail — unverified completion**

    43 of 53 tests crash due to missing `useRouter` mock. The tasks were marked complete without running tests successfully. CLAUDE.md strict rule: "Task completion requires `npm run type-check` and `npm run lint` to pass." Both lint (3 errors) and tests (43 failures) are red.

18. **[T014] Cross-viewport verification — no evidence**

    T014 says "test responsive behavior at 320px, 375px, 768px, 1024px, 1920px breakpoints". There are no E2E tests and no test results to verify this was actually done. No screenshots, no Playwright viewport tests.

19. **[T016] Edge cases marked done but untested**

    Popstate handler (issue #4), orientation change, and rapid-click guard (issue #6) are marked complete. The implementations exist in code but have no test coverage. The popstate implementation has a race condition that a test would have caught.

---

## VERDICT

❌ **Needs rework** — Fundamental issues must be addressed before merge

**Blocking issues (must fix before re-review):**

1. Fix `useRouter` mock in all 3 integration test files — get tests passing
2. Fix 3 ESLint `no-restricted-globals` errors (`history` → `window.history`)
3. Extract `MobileDrawer` and `UserMenu` sub-components (391 → ~80 lines for Navbar)
4. Fix `router.replace` → `router.push` to preserve browser history
5. Add `role="list"` to desktop `<ul>` per contract

**Should fix:** 6. Simplify or at minimum test the popstate state machine 7. Handle drawer sign-out (close drawer before signing out) 8. Add error handling for `signInWithGoogle` popup

**KEY INSIGHT:**
The component tries to be a single monolith managing two independent state machines (drawer + dropdown) plus a fragile browser history integration, resulting in 8 `useEffect` hooks and a 391-line file with race conditions. The fix isn't patching — it's splitting the component into focused pieces with clear responsibilities, which the plan already anticipated but didn't follow through on.
