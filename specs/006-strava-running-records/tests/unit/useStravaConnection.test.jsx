import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const { mockedAuthState } = vi.hoisted(() => ({
  mockedAuthState: { user: null },
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: () => mockedAuthState,
  };
});

vi.mock('@/config/client/firebase-client', () => ({
  db: {},
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

vi.mock('@/lib/firebase-users', () => ({
  loginCheckUserData: vi.fn(),
  watchUserProfile: vi.fn(),
}));

vi.mock('@/repo/client/firebase-strava-repo', () => ({
  listenStravaConnection: vi.fn(),
}));

import { listenStravaConnection } from '@/repo/client/firebase-strava-repo';
import useStravaConnection from '@/runtime/hooks/useStravaConnection';

const mockedListen = /** @type {import('vitest').Mock} */ (listenStravaConnection);

/**
 * 透過 mocked React.useContext 注入測試用使用者。
 * @param {import('react').ReactElement} ui - 要渲染的元件。
 * @param {object} [options] - 選項。
 * @param {{ uid: string, name: string|null, email: string|null, photoURL: string|null }|null} [options.user] - 使用者。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithAuth(ui, { user: partialUser = null } = {}) {
  mockedAuthState.user = partialUser
    ? { bio: null, getIdToken: () => Promise.resolve(''), ...partialUser }
    : null;
  return render(ui);
}

/**
 * 消費 useStravaConnection hook 的測試元件。
 * @returns {import('react').ReactElement} 渲染結果。
 */
function TestComponent() {
  const { connection, isLoading, error } = useStravaConnection();
  if (isLoading) return <div role="status">Loading</div>;
  if (error) return <div role="alert">{error}</div>;
  return <div data-testid="connection">{connection?.athleteName ?? 'none'}</div>;
}

describe('useStravaConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuthState.user = null;
  });

  it('shows loading initially then displays connection data', async () => {
    const unsubscribe = vi.fn();
    mockedListen.mockImplementation((_uid, callback) => {
      setTimeout(() => {
        callback({
          connected: true,
          athleteId: 12345,
          athleteName: 'Test Runner',
          connectedAt: { toDate: () => new Date() },
          lastSyncAt: null,
        });
      }, 0);
      return unsubscribe;
    });

    renderWithAuth(<TestComponent />, {
      user: { uid: 'u1', name: 'User', email: null, photoURL: null },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Loading');

    await act(async () => {
      await new Promise((r) => {
        setTimeout(r, 10);
      });
    });

    expect(screen.getByTestId('connection')).toHaveTextContent('Test Runner');
    expect(mockedListen).toHaveBeenCalledWith('u1', expect.any(Function));
  });

  it('shows none when user is not logged in', () => {
    renderWithAuth(<TestComponent />, { user: null });

    expect(screen.getByTestId('connection')).toHaveTextContent('none');
    expect(mockedListen).not.toHaveBeenCalled();
  });

  it('shows none when connection is null', async () => {
    const unsubscribe = vi.fn();
    mockedListen.mockImplementation((_uid, callback) => {
      setTimeout(() => {
        callback(null);
      }, 0);
      return unsubscribe;
    });

    renderWithAuth(<TestComponent />, {
      user: { uid: 'u2', name: 'User2', email: null, photoURL: null },
    });

    await act(async () => {
      await new Promise((r) => {
        setTimeout(r, 10);
      });
    });

    expect(screen.getByTestId('connection')).toHaveTextContent('none');
  });

  it('cleans up listener on unmount', () => {
    const unsubscribe = vi.fn();
    mockedListen.mockReturnValue(unsubscribe);

    const { unmount } = renderWithAuth(<TestComponent />, {
      user: { uid: 'u3', name: 'User3', email: null, photoURL: null },
    });

    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('handles listener error', async () => {
    mockedListen.mockImplementation((_uid, _callback) => {
      throw new Error('Firestore unavailable');
    });

    renderWithAuth(<TestComponent />, {
      user: { uid: 'u4', name: 'User4', email: null, photoURL: null },
    });

    await act(async () => {
      await new Promise((r) => {
        setTimeout(r, 10);
      });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Strava 連線狀態載入失敗');
  });
});
