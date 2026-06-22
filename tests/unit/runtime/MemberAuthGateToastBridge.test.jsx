// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MemberAuthGateToastBridge from '../../../src/runtime/providers/MemberAuthGateToastBridge';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';

const mocks = vi.hoisted(() => ({
  consumeMemberAuthGateReturnTo: vi.fn(),
  consumeMemberAuthGateToastPending: vi.fn(),
  pathname: '/',
  replace: vi.fn(),
  showToast: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../../../src/runtime/providers/AuthProvider', async () => {
  const { createContext } = await vi.importActual('react');
  return {
    AuthContext: createContext({ user: null, setUser: () => {}, loading: true }),
  };
});

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../src/runtime/member-auth-gate-toast', () => ({
  MEMBER_AUTH_GATE_TOAST_MESSAGE: '請先登入才能進入會員中心',
  consumeMemberAuthGateReturnTo: mocks.consumeMemberAuthGateReturnTo,
  consumeMemberAuthGateToastPending: mocks.consumeMemberAuthGateToastPending,
}));

vi.mock('../../../src/runtime/client/use-cases/auth-use-cases', () => ({
  signInWithGoogleUseCase: mocks.signInWithGoogle,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.pathname = '/';
  mocks.consumeMemberAuthGateReturnTo.mockReturnValue('/member/favorites');
  mocks.consumeMemberAuthGateToastPending.mockReturnValue(true);
  mocks.signInWithGoogle.mockResolvedValue({ user: { uid: 'runner-1' } });
});

afterEach(() => {
  vi.useRealTimers();
});

const user = {
  uid: 'runner-1',
  name: 'Runner One',
  email: 'runner@example.test',
  photoURL: null,
  bio: null,
  accountStatus: 'active',
  deletionScheduledFor: null,
  getIdToken: vi.fn(),
};

/**
 * Renders the bridge with an auth context value.
 * @param {{ authUser?: typeof user | null, loading?: boolean, pathname?: string }} [options]
 *   Auth and route options.
 * @returns {ReturnType<typeof render>} Render result.
 */
function renderBridge({ authUser = null, loading = false, pathname = '/' } = {}) {
  mocks.pathname = pathname;

  return render(
    <AuthContext.Provider value={{ user: authUser, setUser: vi.fn(), loading }}>
      <MemberAuthGateToastBridge />
    </AuthContext.Provider>,
  );
}

describe('MemberAuthGateToastBridge', () => {
  it('shows the member auth toast with a login action on home', () => {
    renderBridge();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(mocks.showToast).toHaveBeenCalledWith(
      '請先登入才能進入會員中心',
      'info',
      expect.objectContaining({ label: '登入' }),
    );

    const action = mocks.showToast.mock.calls[0][2];
    action.callback();

    expect(mocks.signInWithGoogle).toHaveBeenLastCalledWith();
  });

  it('replaces home with the stored returnTo after auth finishes', () => {
    mocks.consumeMemberAuthGateToastPending.mockReturnValue(false);

    renderBridge({ authUser: user });

    expect(mocks.consumeMemberAuthGateReturnTo).toHaveBeenLastCalledWith();
    expect(mocks.replace).toHaveBeenCalledWith('/member/favorites');
  });

  it.each([
    ['auth is still loading', { authUser: user, loading: true, pathname: '/' }],
    ['visitor is still signed out', { authUser: null, loading: false, pathname: '/' }],
    ['current route is not home', { authUser: user, loading: false, pathname: '/member' }],
  ])('does not consume returnTo when %s', (_label, options) => {
    mocks.consumeMemberAuthGateToastPending.mockReturnValue(false);

    renderBridge(options);

    expect(mocks.consumeMemberAuthGateReturnTo).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('does not redirect when no valid returnTo is available', () => {
    mocks.consumeMemberAuthGateReturnTo.mockReturnValue(null);
    mocks.consumeMemberAuthGateToastPending.mockReturnValue(false);

    renderBridge({ authUser: user });

    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
