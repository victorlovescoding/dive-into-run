// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useNavbarSignIn from '../../../../src/components/Navbar/useNavbarSignIn';

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('../../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../../src/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

/**
 * Creates a controllable promise for pending state assertions.
 * @returns {{ promise: Promise<unknown>, resolve: (value?: unknown) => void }} Deferred promise.
 */
function createDeferred() {
  /** @type {(value?: unknown) => void} */
  let resolve = () => {};
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signInWithGoogle.mockResolvedValue({ user: { uid: 'runner-1' } });
});

describe('useNavbarSignIn', () => {
  it('sets pending state and ignores duplicate sign-in attempts', async () => {
    const deferred = createDeferred();
    mocks.signInWithGoogle.mockReturnValue(deferred.promise);
    const { result } = renderHook(() => useNavbarSignIn());

    let pendingSignIn = Promise.resolve();
    act(() => {
      pendingSignIn = result.current.handleSignIn();
    });

    expect(result.current.loginPending).toBe(true);

    let duplicateSignIn = Promise.resolve();
    act(() => {
      duplicateSignIn = result.current.handleSignIn();
    });

    await expect(duplicateSignIn).resolves.toBeUndefined();
    expect(mocks.signInWithGoogle.mock.calls).toHaveLength(1);

    await act(async () => {
      deferred.resolve();
      await pendingSignIn;
    });

    expect(result.current.loginPending).toBe(false);
  });

  it('shows a toast for non-cancelled sign-in failures', async () => {
    const error = new Error('popup blocked');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.signInWithGoogle.mockRejectedValue(error);
    const { result } = renderHook(() => useNavbarSignIn());

    await act(async () => {
      await result.current.handleSignIn();
    });

    expect(consoleError).toHaveBeenCalledWith(error);
    expect(mocks.showToast).toHaveBeenCalledWith('登入失敗，請稍後再試', 'error');

    consoleError.mockRestore();
  });

  it('silently resets pending state for user-cancelled sign-in failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.signInWithGoogle.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    const { result } = renderHook(() => useNavbarSignIn());

    await act(async () => {
      await result.current.handleSignIn();
    });

    expect(result.current.loginPending).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
    expect(mocks.showToast).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
