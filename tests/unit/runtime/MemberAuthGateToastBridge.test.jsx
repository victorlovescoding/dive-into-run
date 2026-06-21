// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MemberAuthGateToastBridge from '../../../src/runtime/providers/MemberAuthGateToastBridge';

const mocks = vi.hoisted(() => ({
  consumeMemberAuthGateToastPending: vi.fn(),
  pathname: '/',
  showToast: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../src/runtime/member-auth-gate-toast', () => ({
  MEMBER_AUTH_GATE_TOAST_MESSAGE: '請先登入才能進入會員中心',
  consumeMemberAuthGateToastPending: mocks.consumeMemberAuthGateToastPending,
}));

vi.mock('../../../src/runtime/client/use-cases/auth-use-cases', () => ({
  signInWithGoogleUseCase: mocks.signInWithGoogle,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.pathname = '/';
  mocks.consumeMemberAuthGateToastPending.mockReturnValue(true);
  mocks.signInWithGoogle.mockResolvedValue({ user: { uid: 'runner-1' } });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MemberAuthGateToastBridge', () => {
  it('shows the member auth toast with a login action on home', () => {
    render(<MemberAuthGateToastBridge />);

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
});
