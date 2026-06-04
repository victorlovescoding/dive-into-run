import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMBER_AUTH_GATE_TOAST_STORAGE_KEY } from '@/runtime/member-auth-gate-toast';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import ToastProvider from '@/runtime/providers/ToastProvider';
import useMemberPageRuntime from './useMemberPageRuntime';

const navigationMocks = vi.hoisted(() => ({
  pathnameState: { current: '/member' },
  router: { replace: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMocks.pathnameState.current,
  useRouter: () => navigationMocks.router,
}));

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(() => () => {}),
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
  accountStatus: 'active',
  deletionScheduledFor: null,
  getIdToken: vi.fn(),
};

/**
 * Calls the member page runtime hook under the task-local provider harness.
 * @returns {null} No rendered UI.
 */
function RuntimeHarness() {
  useMemberPageRuntime();
  return null;
}

/**
 * Creates the provider tree for a controlled auth state.
 * @param {{ user: typeof signedInUser | null, loading: boolean }} authState - Auth state.
 * @returns {import('react').ReactElement} Runtime provider tree.
 */
function createRuntimeTree(authState) {
  return (
    <StrictMode>
      <AuthContext.Provider value={{ setUser: vi.fn(), ...authState }}>
        <ToastProvider>
          <RuntimeHarness />
        </ToastProvider>
      </AuthContext.Provider>
    </StrictMode>
  );
}

/**
 * Renders the runtime hook with a controlled auth state.
 * @param {{ user: typeof signedInUser | null, loading: boolean }} authState - Auth state.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderRuntime(authState) {
  return render(createRuntimeTree(authState));
}

describe('useMemberPageRuntime member auth gate', () => {
  beforeEach(() => {
    navigationMocks.pathnameState.current = '/member';
    navigationMocks.router.replace.mockClear();
    window.sessionStorage.clear();
  });

  it('does not redirect before auth loading settles', async () => {
    renderRuntime({ user: null, loading: true });

    await waitFor(() => {
      expect(navigationMocks.router.replace).not.toHaveBeenCalled();
    });
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();
  });

  it('redirects after auth loading settles without a user on the same mounted runtime', async () => {
    const { rerender } = renderRuntime({ user: null, loading: true });

    await waitFor(() => {
      expect(navigationMocks.router.replace).not.toHaveBeenCalled();
    });
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();

    rerender(createRuntimeTree({ user: null, loading: false }));

    await waitFor(() => {
      expect(navigationMocks.router.replace).toHaveBeenCalledTimes(1);
    });
    expect(navigationMocks.router.replace).toHaveBeenCalledWith('/');
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBe('1');
  });

  it('marks the login-required toast and replaces home when auth settles without a user', async () => {
    renderRuntime({ user: null, loading: false });

    await waitFor(() => {
      expect(navigationMocks.router.replace).toHaveBeenCalledTimes(1);
    });
    expect(navigationMocks.router.replace).toHaveBeenCalledWith('/');
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBe('1');
  });

  it('does not redirect signed-in users', async () => {
    renderRuntime({ user: signedInUser, loading: false });

    await waitFor(() => {
      expect(navigationMocks.router.replace).not.toHaveBeenCalled();
    });
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();
  });
});
