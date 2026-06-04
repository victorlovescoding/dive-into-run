# Member Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate `/member` behind a settled signed-in auth state, hide the member navigation entry until a signed-in user exists, and show one login-required info toast after unauthenticated direct visits are replaced home.

**Architecture:** Keep this as a UX/routing guard, not an authorization boundary. Filter the shared Navbar item at the desktop and mobile consumers, guard the member page runtime after auth settles, suppress unauthenticated member UI rendering, and carry the post-redirect toast through `sessionStorage` so `ToastProvider` pathname clearing cannot remove it.

**Tech Stack:** Next.js App Router client components, React 19 hooks, JSDoc `checkJs`, Vitest browser project with React Testing Library, existing global Toast/Auth providers.

---

## Scope And Authorization

- Profile: P2 (C2/R2) because this is a small same-domain auth/profile UX change across client runtime, provider wiring, Navbar rendering, and focused tests.
- Worktree: `/private/tmp/dive-into-run-member-auth-gate`
- Branch: `codex/member-auth-gate`
- Current committed spec head: `723cc79`
- Engineer may modify only the implementation and test files named in this plan after main-agent dispatch grants edit authorization.
- Commit, push, PR creation, CI watch, merge, and local `main` sync are separate release boundaries. Do not run them unless the dispatch explicitly authorizes each boundary.
- Do not create `tasks.md`, `handoff.md`, `status.json`, or any full P4 artifact set for this P2 spec.
- Non-goals remain closed: no return-to-member-after-login behavior, no login/sign-out behavior changes, no `/member/favorites`, no service/repo/Firebase rules/schema/deployment work.

## File Responsibility Map

- Create `src/components/Navbar/member-nav-visibility.js`
  - Own the single rule for whether a nav item with `href === '/member'` is visible.
  - Return all public items unchanged.
  - Show `/member` only when `loading === false` and `user` is truthy.
- Create `src/components/Navbar/member-nav-visibility.test.js`
  - Prove the helper hides `/member` while loading and after unauthenticated auth settlement, preserves public items, and shows `/member` for signed-in users.
- Modify `src/components/Navbar/Navbar.jsx`
  - Derive desktop links from `getVisibleNavItems(NAV_ITEMS, { user, loading })`.
  - Keep `UserMenu`, notification bell, drawer state, and active-link behavior unchanged.
- Modify `src/components/Navbar/MobileDrawer.jsx`
  - Derive mobile drawer links from the same helper and auth state.
  - Keep drawer close, overlay, login, and sign-out behavior unchanged.
- Create `src/components/Navbar/Navbar.test.jsx`
  - Render the full Navbar with mocked auth/navigation and assert `會員頁面` is absent while loading, absent when unauthenticated, and present for signed-in users.
- Create `src/runtime/member-auth-gate-toast.js`
  - Own the exact toast message `請先登入才能進入會員中心`.
  - Own the `sessionStorage` key used to bridge the redirect.
  - Expose `markMemberAuthGateToastPending()` and `consumeMemberAuthGateToastPending()`.
- Create `src/runtime/member-auth-gate-toast.test.js`
  - Prove the storage flag is written once, consumed once, and missing storage is treated as no pending toast.
- Create `src/runtime/providers/MemberAuthGateToastBridge.jsx`
  - A client-only bridge under `ToastProvider` that consumes the pending flag only on `/`.
  - Schedules the info toast with `window.setTimeout(..., 0)` after the pathname-change effect cycle, so `ToastProvider`'s current `CLEAR_ALL` on pathname changes cannot erase it.
- Create `src/runtime/providers/MemberAuthGateToastBridge.test.jsx`
  - Prove a pending flag on `/` produces exactly one info toast message in the Toast context and consumes the flag.
  - Prove a pending flag away from `/` does not show the toast and remains pending.
- Modify `src/app/layout.jsx`
  - Render `<MemberAuthGateToastBridge />` inside `ToastProvider` so it survives the `/member` to `/` navigation.
  - Keep provider nesting and existing toast containers unchanged.
- Modify `src/runtime/hooks/useMemberPageRuntime.js`
  - Import `useRouter`.
  - After auth loading settles with no user, mark the login-required toast pending and call `router.replace('/')`.
  - Preserve all existing `!user` and `loading` mutation guards.
- Create `src/runtime/hooks/useMemberPageRuntime.test.jsx`
  - Prove the hook does not redirect while auth is loading.
  - Prove unauthenticated settled auth marks the toast flag and calls `replace('/')`.
  - Prove signed-in auth does not redirect.
- Modify `src/ui/member/MemberPageScreen.jsx`
  - Return `null` while `runtime.loading` or `!runtime.user`.
  - Render the existing signed-in profile UI unchanged once a user exists.
- Create `src/ui/member/MemberPageScreen.test.jsx`
  - Prove unauthenticated settled runtime does not render `跑者`, `/default-avatar.png` image alt text, or the editable display-name form.
  - Prove signed-in runtime still renders the display-name form and signed-in identity.

## Dependency Graph And Execution Shape

- Task 1 can run first: shared Navbar visibility helper and direct helper tests.
- Task 2 depends on Task 1: wire desktop/mobile navigation and add Navbar rendering tests.
- Task 3 can run in parallel with Task 1: redirect-toast storage helper, bridge, and bridge tests.
- Task 4 depends on Task 3: member runtime redirect, layout bridge wiring, screen suppression, and focused tests.
- Task 5 depends on Tasks 1-4: final verification and review handoff.
- Default to one Engineer/Reviewer pair. Do not split into same-wave writable lanes unless the dispatcher assigns completely disjoint owned files and a final integration gate.

## Task 1: Shared Member Nav Eligibility

**Files:**
- Create: `src/components/Navbar/member-nav-visibility.js`
- Create: `src/components/Navbar/member-nav-visibility.test.js`

- [ ] **Step 1: Write the failing helper tests**

Create `src/components/Navbar/member-nav-visibility.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { getVisibleNavItems } from './member-nav-visibility';

const navItems = [
  { href: '/', label: '首頁' },
  { href: '/events', label: '活動' },
  { href: '/member', label: '會員頁面' },
];

describe('getVisibleNavItems', () => {
  it('hides member navigation while auth is loading', () => {
    const result = getVisibleNavItems(navItems, { user: null, loading: true });

    expect(result).toEqual([
      { href: '/', label: '首頁' },
      { href: '/events', label: '活動' },
    ]);
  });

  it('hides member navigation after auth settles without a user', () => {
    const result = getVisibleNavItems(navItems, { user: null, loading: false });

    expect(result).toEqual([
      { href: '/', label: '首頁' },
      { href: '/events', label: '活動' },
    ]);
  });

  it('shows member navigation after auth settles with a signed-in user', () => {
    const result = getVisibleNavItems(navItems, {
      user: { uid: 'user-1' },
      loading: false,
    });

    expect(result).toEqual(navItems);
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
npx vitest run --project=browser src/components/Navbar/member-nav-visibility.test.js
```

Expected: exit 1 because `./member-nav-visibility` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/components/Navbar/member-nav-visibility.js`:

```js
const MEMBER_NAV_HREF = '/member';

/**
 * Returns Navbar items visible for the current auth state.
 * @template {{ href: string }} T
 * @param {T[]} navItems - All configured nav items.
 * @param {{ user: unknown, loading: boolean }} authState - Current auth state.
 * @returns {T[]} Visible nav items.
 */
export function getVisibleNavItems(navItems, { user, loading }) {
  const canShowMemberLink = !loading && Boolean(user);

  return navItems.filter((item) => item.href !== MEMBER_NAV_HREF || canShowMemberLink);
}
```

- [ ] **Step 4: Run the helper test and verify it passes**

Run:

```bash
npx vitest run --project=browser src/components/Navbar/member-nav-visibility.test.js
```

Expected: exit 0 and all `getVisibleNavItems` tests pass.

- [ ] **Step 5: Checkpoint if commit is authorized**

Only if the dispatch explicitly authorizes commits:

```bash
git add src/components/Navbar/member-nav-visibility.js src/components/Navbar/member-nav-visibility.test.js
git commit -m "test member nav visibility"
```

Expected: commit succeeds with no `Co-Authored-By`.

## Task 2: Wire Desktop And Mobile Navigation

**Files:**
- Modify: `src/components/Navbar/Navbar.jsx`
- Modify: `src/components/Navbar/MobileDrawer.jsx`
- Create: `src/components/Navbar/Navbar.test.jsx`
- Read-only if needed: `src/components/Navbar/nav-constants.js`

- [ ] **Step 1: Write the failing Navbar rendering tests**

Create `src/components/Navbar/Navbar.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import Navbar from './Navbar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/components/Notifications/NotificationBell', () => ({
  default: () => null,
}));

vi.mock('@/components/Notifications/NotificationPanel', () => ({
  default: () => null,
}));

vi.mock('@/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}));

const signedInUser = {
  uid: 'user-1',
  name: 'Runner One',
  email: 'runner@example.com',
  photoURL: null,
};

function renderNavbar(authState) {
  render(
    <AuthContext.Provider value={{ setUser: vi.fn(), ...authState }}>
      <Navbar />
    </AuthContext.Provider>,
  );
}

describe('Navbar member navigation visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render member links while auth is loading', () => {
    renderNavbar({ user: null, loading: true });

    expect(screen.queryByRole('link', { name: '會員頁面' })).not.toBeInTheDocument();
  });

  it('does not render member links after auth settles without a user', () => {
    renderNavbar({ user: null, loading: false });

    expect(screen.queryByRole('link', { name: '會員頁面' })).not.toBeInTheDocument();
  });

  it('renders member links for a signed-in user', () => {
    renderNavbar({ user: signedInUser, loading: false });

    expect(screen.getAllByRole('link', { name: '會員頁面' }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the Navbar rendering tests and verify they fail**

Run:

```bash
npx vitest run --project=browser src/components/Navbar/Navbar.test.jsx
```

Expected: exit 1 because unauthenticated states still render the `會員頁面` link.

- [ ] **Step 3: Wire `Navbar.jsx` through the helper**

Modify `src/components/Navbar/Navbar.jsx` imports:

```jsx
import { NAV_ITEMS, isActivePath } from './nav-constants';
import { getVisibleNavItems } from './member-nav-visibility';
```

Replace the `desktopLinks` declaration with:

```jsx
  const visibleNavItems = getVisibleNavItems(NAV_ITEMS, { user, loading });
  const desktopLinks = visibleNavItems.map((item) => {
    const active = isActivePath(pathname, item.href);
    const linkClass = active ? `${styles.link} ${styles.linkActive}` : styles.link;
    const ariaCurrent = active ? 'page' : undefined;

    return (
      <li key={item.href}>
        <Link href={item.href} className={linkClass} aria-current={ariaCurrent}>
          {item.label}
        </Link>
      </li>
    );
  });
```

Do not change the `UserMenu`, notification bell, drawer state, or sign-out code.

- [ ] **Step 4: Wire `MobileDrawer.jsx` through the helper**

Modify `src/components/Navbar/MobileDrawer.jsx` imports:

```jsx
import { NAV_ITEMS, isActivePath } from './nav-constants';
import { getVisibleNavItems } from './member-nav-visibility';
```

Replace the `drawerLinks` declaration with:

```jsx
  const visibleNavItems = getVisibleNavItems(NAV_ITEMS, { user, loading });
  const drawerLinks = visibleNavItems.map((item) => {
    const active = isActivePath(pathname, item.href);
    const linkClass = active
      ? `${styles.drawerLink} ${styles.drawerLinkActive}`
      : styles.drawerLink;
    const ariaCurrent = active ? 'page' : undefined;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={linkClass}
        onClick={handleLinkClick}
        aria-current={ariaCurrent}
      >
        {item.label}
      </Link>
    );
  });
```

Do not change drawer open/close, overlay, login, or sign-out behavior.

- [ ] **Step 5: Run focused Navbar tests and verify they pass**

Run:

```bash
npx vitest run --project=browser src/components/Navbar/member-nav-visibility.test.js src/components/Navbar/Navbar.test.jsx
```

Expected: exit 0 and all helper plus Navbar rendering tests pass.

- [ ] **Step 6: Stop if the configured member item is missing**

If the signed-in test fails because no `會員頁面` item exists in `NAV_ITEMS`, stop and report this exact mismatch to the dispatcher before editing `src/components/Navbar/nav-constants.js`. The approved spec assumes the existing navigation item points to `/member`; widening the plan to create or rename nav items needs a new authorization decision.

- [ ] **Step 7: Checkpoint if commit is authorized**

Only if the dispatch explicitly authorizes commits:

```bash
git add src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx src/components/Navbar/Navbar.test.jsx
git commit -m "gate member nav link"
```

Expected: commit succeeds with no `Co-Authored-By`.

## Task 3: Post-Redirect Toast Bridge

**Files:**
- Create: `src/runtime/member-auth-gate-toast.js`
- Create: `src/runtime/member-auth-gate-toast.test.js`
- Create: `src/runtime/providers/MemberAuthGateToastBridge.jsx`
- Create: `src/runtime/providers/MemberAuthGateToastBridge.test.jsx`

- [ ] **Step 1: Write the failing storage helper tests**

Create `src/runtime/member-auth-gate-toast.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MEMBER_AUTH_GATE_TOAST_STORAGE_KEY,
  consumeMemberAuthGateToastPending,
  markMemberAuthGateToastPending,
} from './member-auth-gate-toast';

describe('member auth gate toast storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('marks and consumes one pending login-required toast', () => {
    markMemberAuthGateToastPending();

    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBe('1');
    expect(consumeMemberAuthGateToastPending()).toBe(true);
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();
    expect(consumeMemberAuthGateToastPending()).toBe(false);
  });

  it('treats unavailable sessionStorage as no pending toast', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('sessionStorage unavailable');
    });

    expect(() => markMemberAuthGateToastPending()).not.toThrow();
    expect(consumeMemberAuthGateToastPending()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the storage helper tests and verify they fail**

Run:

```bash
npx vitest run --project=browser src/runtime/member-auth-gate-toast.test.js
```

Expected: exit 1 because `./member-auth-gate-toast` does not exist.

- [ ] **Step 3: Implement the storage helper**

Create `src/runtime/member-auth-gate-toast.js`:

```js
export const MEMBER_AUTH_GATE_TOAST_MESSAGE = '請先登入才能進入會員中心';
export const MEMBER_AUTH_GATE_TOAST_STORAGE_KEY = 'dive.memberAuthGateToastPending';

/**
 * Safely returns tab-scoped sessionStorage for client-side redirect state.
 * @returns {Storage | null} Session storage when available.
 */
function getSessionStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Marks that the next completed home navigation should show the member auth toast.
 * @returns {void}
 */
export function markMemberAuthGateToastPending() {
  getSessionStorage()?.setItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY, '1');
}

/**
 * Consumes one pending member auth toast marker.
 * @returns {boolean} True when a pending toast marker was consumed.
 */
export function consumeMemberAuthGateToastPending() {
  const storage = getSessionStorage();
  if (storage?.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY) !== '1') return false;

  storage.removeItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY);
  return true;
}
```

- [ ] **Step 4: Run the storage helper tests and verify they pass**

Run:

```bash
npx vitest run --project=browser src/runtime/member-auth-gate-toast.test.js
```

Expected: exit 0 and both storage helper tests pass.

- [ ] **Step 5: Write the failing toast bridge tests**

Create `src/runtime/providers/MemberAuthGateToastBridge.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MEMBER_AUTH_GATE_TOAST_MESSAGE,
  MEMBER_AUTH_GATE_TOAST_STORAGE_KEY,
  markMemberAuthGateToastPending,
} from '@/runtime/member-auth-gate-toast';
import ToastProvider, { useToast } from './ToastProvider';
import MemberAuthGateToastBridge from './MemberAuthGateToastBridge';

let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

function ToastProbe() {
  const { toasts } = useToast();

  return (
    <output aria-label="toast messages">
      {toasts.map((toast) => toast.message).join('|')}
    </output>
  );
}

function renderBridge() {
  render(
    <React.StrictMode>
      <ToastProvider>
        <MemberAuthGateToastBridge />
        <ToastProbe />
      </ToastProvider>
    </React.StrictMode>,
  );
}

describe('MemberAuthGateToastBridge', () => {
  beforeEach(() => {
    pathname = '/';
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('shows exactly one info toast on home when a marker is pending', async () => {
    markMemberAuthGateToastPending();

    renderBridge();

    await waitFor(() => {
      expect(screen.getByLabelText('toast messages')).toHaveTextContent(
        MEMBER_AUTH_GATE_TOAST_MESSAGE,
      );
    });
    expect(
      screen.getByLabelText('toast messages').textContent?.split(MEMBER_AUTH_GATE_TOAST_MESSAGE),
    ).toHaveLength(2);
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();
  });

  it('does not consume or show the marker away from home', async () => {
    pathname = '/events';
    markMemberAuthGateToastPending();

    renderBridge();

    await waitFor(() => {
      expect(screen.getByLabelText('toast messages')).toHaveTextContent('');
    });
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBe('1');
  });
});
```

- [ ] **Step 6: Run the bridge tests and verify they fail**

Run:

```bash
npx vitest run --project=browser src/runtime/providers/MemberAuthGateToastBridge.test.jsx
```

Expected: exit 1 because `./MemberAuthGateToastBridge` does not exist.

- [ ] **Step 7: Implement the toast bridge**

Create `src/runtime/providers/MemberAuthGateToastBridge.jsx`:

```jsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  MEMBER_AUTH_GATE_TOAST_MESSAGE,
  consumeMemberAuthGateToastPending,
} from '@/runtime/member-auth-gate-toast';
import { useToast } from './ToastProvider';

/**
 * Shows the member auth gate toast after the redirect has landed on home.
 * @returns {null} This component renders no UI.
 */
export default function MemberAuthGateToastBridge() {
  const pathname = usePathname();
  const { showToast } = useToast();

  useEffect(() => {
    if (pathname !== '/') return;
    if (!consumeMemberAuthGateToastPending()) return;

    window.setTimeout(() => {
      showToast(MEMBER_AUTH_GATE_TOAST_MESSAGE, 'info');
    }, 0);
  }, [pathname, showToast]);

  return null;
}
```

The `window.setTimeout(..., 0)` is intentional. `ToastProvider` currently clears all toasts in an effect whenever `pathname` changes, so the bridge schedules the new toast after the redirect commit's pathname effects have flushed.

- [ ] **Step 8: Run storage and bridge tests and verify they pass**

Run:

```bash
npx vitest run --project=browser src/runtime/member-auth-gate-toast.test.js src/runtime/providers/MemberAuthGateToastBridge.test.jsx
```

Expected: exit 0 and all storage plus bridge tests pass.

- [ ] **Step 9: Checkpoint if commit is authorized**

Only if the dispatch explicitly authorizes commits:

```bash
git add src/runtime/member-auth-gate-toast.js src/runtime/member-auth-gate-toast.test.js src/runtime/providers/MemberAuthGateToastBridge.jsx src/runtime/providers/MemberAuthGateToastBridge.test.jsx
git commit -m "add member auth toast bridge"
```

Expected: commit succeeds with no `Co-Authored-By`.

## Task 4: Member Route Guard And UI Suppression

**Files:**
- Modify: `src/runtime/hooks/useMemberPageRuntime.js`
- Create: `src/runtime/hooks/useMemberPageRuntime.test.jsx`
- Modify: `src/app/layout.jsx`
- Modify: `src/ui/member/MemberPageScreen.jsx`
- Create: `src/ui/member/MemberPageScreen.test.jsx`

- [ ] **Step 1: Write the failing runtime redirect tests**

Create `src/runtime/hooks/useMemberPageRuntime.test.jsx`:

```jsx
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import ToastProvider from '@/runtime/providers/ToastProvider';
import {
  MEMBER_AUTH_GATE_TOAST_STORAGE_KEY,
} from '@/runtime/member-auth-gate-toast';
import useMemberPageRuntime from './useMemberPageRuntime';

const replaceMock = vi.fn();
let pathname = '/member';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/repo/client/firebase-users-repo', () => ({
  updateUserName: vi.fn(),
  updateUserPhotoURL: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/avatar-upload-use-cases', () => ({
  uploadUserAvatar: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/account-deletion-use-cases', () => ({
  requestAccountDeletion: vi.fn(),
}));

const signedInUser = {
  uid: 'user-1',
  name: 'Runner One',
  email: 'runner@example.com',
  photoURL: null,
  bio: null,
};

function RuntimeHarness() {
  useMemberPageRuntime();
  return null;
}

function renderRuntime(authState) {
  render(
    <AuthContext.Provider value={{ setUser: vi.fn(), ...authState }}>
      <ToastProvider>
        <RuntimeHarness />
      </ToastProvider>
    </AuthContext.Provider>,
  );
}

describe('useMemberPageRuntime member auth gate', () => {
  beforeEach(() => {
    pathname = '/member';
    replaceMock.mockClear();
    window.sessionStorage.clear();
  });

  it('does not redirect before auth loading settles', async () => {
    renderRuntime({ user: null, loading: true });

    await waitFor(() => {
      expect(replaceMock).not.toHaveBeenCalled();
    });
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();
  });

  it('marks the login-required toast and replaces home when auth settles without a user', async () => {
    renderRuntime({ user: null, loading: false });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledTimes(1);
    });
    expect(replaceMock).toHaveBeenCalledWith('/');
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBe('1');
  });

  it('does not redirect signed-in users', async () => {
    renderRuntime({ user: signedInUser, loading: false });

    await waitFor(() => {
      expect(replaceMock).not.toHaveBeenCalled();
    });
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the runtime tests and verify they fail**

Run:

```bash
npx vitest run --project=browser src/runtime/hooks/useMemberPageRuntime.test.jsx
```

Expected: exit 1 because `useMemberPageRuntime` does not call `replace('/')` or mark the toast flag.

- [ ] **Step 3: Implement the runtime redirect guard**

Modify `src/runtime/hooks/useMemberPageRuntime.js` imports:

```js
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import { markMemberAuthGateToastPending } from '@/runtime/member-auth-gate-toast';
```

Inside `useMemberPageRuntime()`, after `const { showToast } = useToast();`, add:

```js
  const router = useRouter();
  const unauthRedirectStartedRef = useRef(false);
```

After the `inputFileRef` declaration, add:

```js
  useEffect(() => {
    if (loading || user) return;
    if (unauthRedirectStartedRef.current) return;

    unauthRedirectStartedRef.current = true;
    markMemberAuthGateToastPending();
    router.replace('/');
  }, [loading, router, user]);
```

Do not remove or weaken these existing guards:

```js
      if (!file || !user) return;
```

```js
      if (!user || loading) return;
```

```js
    if (!user || accountDeletionSubmitting) return;
```

- [ ] **Step 4: Wire the toast bridge into the root layout**

Modify `src/app/layout.jsx` imports:

```jsx
import MemberAuthGateToastBridge from '@/runtime/providers/MemberAuthGateToastBridge';
```

Inside `<ToastProvider>`, render the bridge next to the existing toast UI:

```jsx
          <ToastProvider>
            <NotificationProvider>
              <AccountDeletionGate>
                <Navbar />
                {children}
              </AccountDeletionGate>
              <NotificationToast />
              <ToastContainer />
              <MemberAuthGateToastBridge />
            </NotificationProvider>
          </ToastProvider>
```

Do not change the order of `AuthProvider`, `ToastProvider`, `NotificationProvider`, or `AccountDeletionGate`.

- [ ] **Step 5: Write the failing member screen suppression tests**

Create `src/ui/member/MemberPageScreen.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MemberPageScreen from './MemberPageScreen';

const signedInUser = {
  uid: 'user-1',
  name: 'Runner One',
  email: 'runner@example.com',
  photoURL: null,
};

function createRuntime(overrides) {
  return {
    user: null,
    loading: false,
    name: '',
    inputFileRef: { current: null },
    onNameChange: vi.fn(),
    triggerFilePicker: vi.fn(),
    onAvatarFileChange: vi.fn(),
    onSubmitNewName: vi.fn(),
    ...overrides,
  };
}

describe('MemberPageScreen auth-state rendering', () => {
  it('renders no member profile controls for unauthenticated settled auth', () => {
    const { container } = render(
      <MemberPageScreen
        runtime={createRuntime({ user: null, loading: false })}
        bioEditor={null}
        dashboardTabs={null}
        accountDeletionDangerZone={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/跑者/u)).not.toBeInTheDocument();
    expect(screen.queryByAltText('大頭貼')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('顯示名稱')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '變更名稱' })).not.toBeInTheDocument();
  });

  it('renders no member profile controls while auth is loading', () => {
    const { container } = render(
      <MemberPageScreen
        runtime={createRuntime({ user: null, loading: true })}
        bioEditor={null}
        dashboardTabs={null}
        accountDeletionDangerZone={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/跑者/u)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('顯示名稱')).not.toBeInTheDocument();
  });

  it('keeps signed-in member profile controls unchanged', () => {
    render(
      <MemberPageScreen
        runtime={createRuntime({
          user: signedInUser,
          loading: false,
          name: 'Runner One',
        })}
        bioEditor={<section aria-label="bio slot" />}
        dashboardTabs={<section aria-label="dashboard slot" />}
        accountDeletionDangerZone={<section aria-label="danger slot" />}
      />,
    );

    expect(screen.getByRole('heading', { name: '你好，Runner One' })).toBeInTheDocument();
    expect(screen.getByLabelText('顯示名稱')).toHaveValue('Runner One');
    expect(screen.getByRole('button', { name: '變更名稱' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看我的公開檔案' })).toHaveAttribute(
      'href',
      '/users/user-1',
    );
    expect(screen.getByRole('link', { name: '我的收藏' })).toHaveAttribute(
      'href',
      '/member/favorites',
    );
  });
});
```

- [ ] **Step 6: Run the screen tests and verify they fail**

Run:

```bash
npx vitest run --project=browser src/ui/member/MemberPageScreen.test.jsx
```

Expected: exit 1 because unauthenticated runtime still renders member profile controls.

- [ ] **Step 7: Suppress unauthenticated/loading member screen UI**

Modify `src/ui/member/MemberPageScreen.jsx` destructuring to include `loading`:

```jsx
  const {
    user,
    loading,
    name,
    inputFileRef,
    onNameChange,
    triggerFilePicker,
    onAvatarFileChange,
    onSubmitNewName,
  } = runtime;
```

Add this guard before `const userLabel = ...`:

```jsx
  if (loading || !user) return null;
```

Keep the existing signed-in markup below the guard unchanged.

- [ ] **Step 8: Run focused member runtime and screen tests and verify they pass**

Run:

```bash
npx vitest run --project=browser src/runtime/hooks/useMemberPageRuntime.test.jsx src/runtime/providers/MemberAuthGateToastBridge.test.jsx src/ui/member/MemberPageScreen.test.jsx
```

Expected: exit 0 and all route guard, toast bridge, and screen suppression tests pass.

- [ ] **Step 9: Checkpoint if commit is authorized**

Only if the dispatch explicitly authorizes commits:

```bash
git add src/runtime/hooks/useMemberPageRuntime.js src/runtime/hooks/useMemberPageRuntime.test.jsx src/app/layout.jsx src/ui/member/MemberPageScreen.jsx src/ui/member/MemberPageScreen.test.jsx
git commit -m "gate direct member visits"
```

Expected: commit succeeds with no `Co-Authored-By`.

## Task 5: Final Verification And Reviewer Handoff

**Files:**
- Read-only verification over changed files and focused tests.
- No new files.

- [ ] **Step 1: Run all focused browser-unit tests for this feature**

Run:

```bash
npx vitest run --project=browser src/components/Navbar/member-nav-visibility.test.js src/components/Navbar/Navbar.test.jsx src/runtime/member-auth-gate-toast.test.js src/runtime/providers/MemberAuthGateToastBridge.test.jsx src/runtime/hooks/useMemberPageRuntime.test.jsx src/ui/member/MemberPageScreen.test.jsx
```

Expected: exit 0 and all member auth gate browser-unit tests pass.

- [ ] **Step 2: Run changed-file lint**

Run:

```bash
npm run lint:changed
```

Expected: exit 0 and no lint errors for changed files.

- [ ] **Step 3: Run changed-file type check**

Run:

```bash
npm run type-check:changed
```

Expected: exit 0 and no changed-file type errors.

- [ ] **Step 4: Run dependency direction check**

Run:

```bash
npm run depcruise
```

Expected: exit 0. Runtime files must not import UI/components/app files; components may import same-folder helpers only.

- [ ] **Step 5: Run whitespace diff check**

Run:

```bash
git diff --check
```

Expected: exit 0 with no output.

- [ ] **Step 6: Run focused browser verification**

Run the app:

```bash
npm run dev
```

Then verify in a browser:

- Desktop unauthenticated loading/settled state: `會員頁面` is absent from the Navbar.
- Mobile drawer unauthenticated loading/settled state: `會員頁面` is absent from drawer links.
- Signed-in state: `會員頁面` appears in desktop Navbar and mobile drawer and links to `/member`.
- Direct unauthenticated `/member`: no member controls render, auth resolution is allowed to settle, then `replace('/')` lands on home.
- After landing on `/`, one visible info toast says `請先登入才能進入會員中心`.
- Browser Back after that redirect does not land back on `/member` for another redirect loop.
- Signed-in `/member`: existing profile controls, bio slot, dashboard slot, account deletion slot, public-profile link, favorites link, avatar/name handlers, and runtime mutation guards still behave as before.

Expected: every bullet matches the approved spec. If a browser-only issue appears, capture the exact route, auth state, observed DOM text, console error, and whether the focused unit tests still pass.

- [ ] **Step 7: Confirm untouched non-scope files**

Run:

```bash
git diff --name-only
```

Expected changed files are limited to:

```text
src/app/layout.jsx
src/components/Navbar/MobileDrawer.jsx
src/components/Navbar/Navbar.jsx
src/components/Navbar/Navbar.test.jsx
src/components/Navbar/member-nav-visibility.js
src/components/Navbar/member-nav-visibility.test.js
src/runtime/hooks/useMemberPageRuntime.js
src/runtime/hooks/useMemberPageRuntime.test.jsx
src/runtime/member-auth-gate-toast.js
src/runtime/member-auth-gate-toast.test.js
src/runtime/providers/MemberAuthGateToastBridge.jsx
src/runtime/providers/MemberAuthGateToastBridge.test.jsx
src/ui/member/MemberPageScreen.jsx
src/ui/member/MemberPageScreen.test.jsx
```

If any service, repo, Firebase Auth, Firestore rules, Storage rules, schema, migration, deployment, login flow, sign-out flow, `/member/favorites`, or unrelated UI files appear, stop and report scope drift.

- [ ] **Step 8: Reviewer handoff**

Provide the Reviewer:

- Profile and scope: P2 member auth UX/routing gate only.
- Changed files list from `git diff --name-only`.
- Focused test command from Step 1 with exit code.
- `npm run lint:changed` exit code.
- `npm run type-check:changed` exit code.
- `npm run depcruise` exit code.
- `git diff --check` exit code.
- Browser verification notes for desktop Navbar, mobile drawer, direct `/member`, toast, Back behavior, and signed-in `/member`.
- Confirmation that existing `!user` mutation guards in `useMemberPageRuntime.js` remain present.

Reviewer decision must be one of `review_passed`, `review_rejected`, or `blocked`.

## Acceptance Criteria Mapping

- `會員頁面` absent from desktop Navbar while auth loading: Task 1 helper tests, Task 2 Navbar test `does not render member links while auth is loading`, Task 5 browser verification.
- `會員頁面` absent from desktop Navbar when auth settled and `user === null`: Task 1 helper tests, Task 2 Navbar test `does not render member links after auth settles without a user`, Task 5 browser verification.
- `會員頁面` absent from mobile drawer while auth loading: Task 1 helper tests, Task 2 full Navbar render includes drawer DOM, Task 5 browser verification.
- `會員頁面` absent from mobile drawer when auth settled and `user === null`: Task 1 helper tests, Task 2 full Navbar render includes drawer DOM, Task 5 browser verification.
- Signed-in user sees `會員頁面` path to `/member`: Task 1 signed-in helper test, Task 2 signed-in Navbar test, Task 5 browser verification.
- Direct `/member` waits for auth loading to finish: Task 4 runtime test `does not redirect before auth loading settles`.
- Unauthenticated settled `/member` uses `replace('/')`: Task 4 runtime test `marks the login-required toast and replaces home`.
- Home redirect shows one info toast `請先登入才能進入會員中心`: Task 3 bridge test, Task 5 browser verification.
- Browser Back does not re-enter `/member` redirect loop: Task 4 requires `router.replace('/')`, Task 5 browser verification.
- Unauthenticated member screen does not display `跑者`, `/default-avatar.png`, or editable display-name form: Task 4 screen suppression tests.
- Existing signed-in `/member` behavior remains unchanged: Task 4 signed-in screen test plus Task 5 signed-in browser verification.
- Runtime/data-layer `!user` guards remain: Task 4 implementation step explicitly preserves guards, Task 5 Reviewer handoff confirms them.

## Stop Conditions

- Stop before implementation if the worktree is not on `codex/member-auth-gate` or if unrelated dirty files block a clean scoped diff.
- Stop if a required edit would touch service, repo, Firebase Auth, Firestore rules, Storage rules, schema, migration, deployment, login, sign-out, `/member/favorites`, or unrelated UI behavior.
- Stop if `NAV_ITEMS` does not already contain the approved existing `/member` item labeled `會員頁面`; creating or renaming nav items is outside this plan.
- Stop if the redirect-toast bridge cannot be made to show one toast after `ToastProvider` pathname clearing without changing ToastProvider semantics for unrelated toasts.
- Stop if browser verification shows duplicate visible login-required toasts for one unauthenticated direct visit.
- Stop if `npm run lint:changed`, `npm run type-check:changed`, `npm run depcruise`, focused Vitest, or `git diff --check` fails after two focused fix attempts for the same symptom; dispatch a Debugger with the failing command and exact output.

## Implementation Risks

- `ToastProvider` currently clears all toasts in a `useEffect` keyed by `pathname`. Showing the login-required toast before or during `router.replace('/')` risks clearing it; the bridge defers the toast until the home route is active.
- React development effects can run more than once. The bridge consumes the storage marker before scheduling the toast so repeated effects do not create duplicate visible toasts.
- A route-local state ref in `/member` cannot reliably show a post-redirect toast because the member page unmounts after `replace('/')`; the storage marker survives that unmount inside the same browser tab.
- Hiding the member nav link only in one consumer would create desktop/mobile divergence; the helper is shared by `Navbar.jsx` and `MobileDrawer.jsx`.
- Returning `null` for unauthenticated/loading member screen avoids rendering editable-looking controls before redirect, but it creates a brief blank content area during auth loading. This is acceptable for this spec because it does not request a member-page loading UI redesign.
- The guard is not a security boundary. Existing runtime/data-layer guards and Firebase rules must stay intact.

## Final Integration Gate

The implementation is ready for Reviewer only when all of these are true:

- Focused browser-unit tests pass with exit 0.
- `npm run lint:changed` exits 0.
- `npm run type-check:changed` exits 0.
- `npm run depcruise` exits 0.
- `git diff --check` exits 0.
- Browser verification confirms desktop Navbar, mobile drawer, direct `/member`, one info toast after home redirect, Back behavior, and signed-in `/member`.
- `git diff --name-only` is limited to the file list in Task 5 Step 7.
- No `tasks.md`, `handoff.md`, `status.json`, service/repo/Firebase rules/schema/deployment, login, sign-out, or `/member/favorites` changes exist.
