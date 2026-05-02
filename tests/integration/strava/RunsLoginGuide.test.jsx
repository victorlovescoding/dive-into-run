import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const authBoundary = vi.hoisted(() => ({
  signInWithPopup: vi.fn(),
}));

// Mock Firebase Auth popup boundary; the component still runs through the real local facade/repo.
vi.mock('firebase/auth', () => ({
  signInWithPopup: authBoundary.signInWithPopup,
}));

vi.mock('@/config/client/firebase-client', () => ({
  auth: { app: 'test-auth' },
  provider: { providerId: 'google.com' },
}));

import RunsLoginGuide from '@/components/RunsLoginGuide';

/**
 * 建立可手動 resolve/reject 的 Promise。
 * @returns {{
 *   promise: Promise<void>,
 *   resolve: () => void,
 *   reject: (reason: Error) => void,
 * }} Deferred promise.
 */
function createDeferred() {
  /** @type {(value?: void | PromiseLike<void>) => void} */
  let resolvePromise = () => {};
  /** @type {(reason: Error) => void} */
  let rejectPromise = () => {};
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

describe('RunsLoginGuide', () => {
  /** @type {ReturnType<typeof vi.spyOn> | undefined} */
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
  });

  it('renders login prompt heading', () => {
    render(<RunsLoginGuide />);

    const heading = screen.getByRole('heading', {
      name: /請先登入以查看跑步紀錄/,
    });
    expect(heading).toBeInTheDocument();
  });

  it('renders a login button', () => {
    render(<RunsLoginGuide />);

    const button = screen.getByRole('button', { name: /登入/ });
    expect(button).toBeInTheDocument();
  });

  it('shows busy state while Google sign-in is pending and recovers after success', async () => {
    const user = userEvent.setup();
    const signIn = createDeferred();
    authBoundary.signInWithPopup.mockReturnValueOnce(signIn.promise);

    render(<RunsLoginGuide />);

    await user.click(screen.getByRole('button', { name: '登入' }));

    const busyButton = screen.getByRole('button', { name: '處理中…' });
    expect(busyButton).toBeDisabled();
    expect(authBoundary.signInWithPopup).toHaveBeenCalledWith(
      { app: 'test-auth' },
      { providerId: 'google.com' },
    );

    signIn.resolve();
    await signIn.promise;

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登入' })).toBeEnabled();
    });
  });

  it('logs sign-in errors and clears busy state after failure', async () => {
    const user = userEvent.setup();
    const signIn = createDeferred();
    const error = new Error('popup closed');
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    authBoundary.signInWithPopup.mockReturnValueOnce(signIn.promise);

    render(<RunsLoginGuide />);

    await user.click(screen.getByRole('button', { name: '登入' }));
    expect(screen.getByRole('button', { name: '處理中…' })).toBeDisabled();

    signIn.reject(error);
    await expect(signIn.promise).rejects.toThrow('popup closed');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登入' })).toBeEnabled();
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
  });
});
