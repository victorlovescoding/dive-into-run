import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '@/contexts/AuthContext';

// Mock Firebase to avoid initialization errors
vi.mock('@/lib/firebase-client', () => ({
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

// Mock hooks
vi.mock('@/hooks/useStravaConnection', () => ({
  default: vi.fn(),
}));
vi.mock('@/hooks/useStravaActivities', () => ({
  default: vi.fn(),
}));
vi.mock('@/hooks/useStravaSync', () => ({
  default: vi.fn(),
}));

// Mock components
vi.mock('@/components/RunsLoginGuide', () => ({
  default: () => <div data-testid="login-guide">請先登入</div>,
}));
vi.mock('@/components/RunsConnectGuide', () => ({
  default: () => <div data-testid="connect-guide">連結 Strava</div>,
}));
vi.mock('@/components/RunsActivityList', () => ({
  default: ({ activities, isLoading, loadMore, hasMore, isLoadingMore }) => (
    <div data-testid="activity-list">
      {isLoading ? 'loading' : `${activities.length} activities`}
      {loadMore && <span data-testid="has-load-more" />}
      {typeof hasMore === 'boolean' && <span data-testid="has-has-more" />}
      {typeof isLoadingMore === 'boolean' && <span data-testid="has-is-loading-more" />}
    </div>
  ),
}));

import useStravaConnection from '@/hooks/useStravaConnection';
import useStravaActivities from '@/hooks/useStravaActivities';
import useStravaSync from '@/hooks/useStravaSync';
import RunsPage from '@/app/runs/page';

const mockedUseConnection = /** @type {import('vitest').Mock} */ (useStravaConnection);
const mockedUseActivities = /** @type {import('vitest').Mock} */ (useStravaActivities);
const mockedUseSync = /** @type {import('vitest').Mock} */ (useStravaSync);

/**
 * 用 AuthContext.Provider 包裝元件。
 * @param {import('react').ReactElement} ui - 要渲染的元件。
 * @param {object} [options] - 選項。
 * @param {object | null} [options.user] - 模擬使用者。
 * @param {boolean} [options.loading] - auth 載入狀態。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithAuth(ui, { user = null, loading = false } = {}) {
  return render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading }}>{ui}</AuthContext.Provider>,
  );
}

describe('RunsPage', () => {
  beforeEach(() => {
    mockedUseConnection.mockReturnValue({
      connection: null,
      isLoading: false,
      error: null,
    });
    mockedUseActivities.mockReturnValue({
      activities: [],
      isLoading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: true,
      isLoadingMore: false,
      refresh: vi.fn(),
    });
    mockedUseSync.mockReturnValue({
      sync: vi.fn(),
      isSyncing: false,
      cooldownRemaining: 0,
      error: null,
    });
  });

  it('shows loading skeleton when auth is loading', () => {
    renderWithAuth(<RunsPage />, { loading: true });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('login-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-guide')).not.toBeInTheDocument();
  });

  it('shows RunsLoginGuide when user is not logged in', () => {
    renderWithAuth(<RunsPage />, { user: null });

    expect(screen.getByTestId('login-guide')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-list')).not.toBeInTheDocument();
  });

  it('shows RunsConnectGuide when user is logged in but not connected', () => {
    renderWithAuth(<RunsPage />, {
      user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
    });

    expect(screen.getByTestId('connect-guide')).toBeInTheDocument();
    expect(screen.queryByTestId('login-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-list')).not.toBeInTheDocument();
  });

  it('shows athlete name and activity list when connected', () => {
    mockedUseConnection.mockReturnValue({
      connection: { connected: true, athleteName: 'John Runner', lastSyncAt: null },
      isLoading: false,
      error: null,
    });
    mockedUseActivities.mockReturnValue({
      activities: [{ id: '1' }, { id: '2' }],
      isLoading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: false,
      isLoadingMore: false,
      refresh: vi.fn(),
    });

    renderWithAuth(<RunsPage />, {
      user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
    });

    expect(screen.getByText('John Runner')).toBeInTheDocument();
    expect(screen.getByTestId('activity-list')).toHaveTextContent('2 activities');
    expect(screen.queryByTestId('login-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-guide')).not.toBeInTheDocument();
  });

  it('sync button calls sync function on click', async () => {
    const syncFn = vi.fn();
    mockedUseConnection.mockReturnValue({
      connection: { connected: true, athleteName: 'John', lastSyncAt: null },
      isLoading: false,
      error: null,
    });
    mockedUseSync.mockReturnValue({
      sync: syncFn,
      isSyncing: false,
      cooldownRemaining: 0,
      error: null,
    });

    const user = userEvent.setup();
    renderWithAuth(<RunsPage />, {
      user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
    });

    await user.click(screen.getByRole('button', { name: /同步/i }));
    expect(syncFn).toHaveBeenCalledTimes(1);
  });

  it('sync button is disabled during cooldown', () => {
    mockedUseConnection.mockReturnValue({
      connection: { connected: true, athleteName: 'John', lastSyncAt: null },
      isLoading: false,
      error: null,
    });
    mockedUseSync.mockReturnValue({
      sync: vi.fn(),
      isSyncing: false,
      cooldownRemaining: 45,
      error: null,
    });

    renderWithAuth(<RunsPage />, {
      user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
    });

    const syncButton = screen.getByRole('button', { name: /同步/i });
    expect(syncButton).toBeDisabled();
    expect(screen.getByText(/45/)).toBeInTheDocument();
  });

  it('calls refresh after successful sync', async () => {
    const syncFn = vi.fn().mockResolvedValue(true);
    const refreshFn = vi.fn();
    mockedUseConnection.mockReturnValue({
      connection: { connected: true, athleteName: 'John', lastSyncAt: null },
      isLoading: false,
      error: null,
    });
    mockedUseSync.mockReturnValue({
      sync: syncFn,
      isSyncing: false,
      cooldownRemaining: 0,
      error: null,
    });
    mockedUseActivities.mockReturnValue({
      activities: [],
      isLoading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: true,
      isLoadingMore: false,
      refresh: refreshFn,
    });

    const user = userEvent.setup();
    renderWithAuth(<RunsPage />, {
      user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
    });

    await user.click(screen.getByRole('button', { name: /同步/i }));

    await waitFor(() => {
      expect(refreshFn).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call refresh after failed sync', async () => {
    const syncFn = vi.fn().mockResolvedValue(false);
    const refreshFn = vi.fn();
    mockedUseConnection.mockReturnValue({
      connection: { connected: true, athleteName: 'John', lastSyncAt: null },
      isLoading: false,
      error: null,
    });
    mockedUseSync.mockReturnValue({
      sync: syncFn,
      isSyncing: false,
      cooldownRemaining: 0,
      error: null,
    });
    mockedUseActivities.mockReturnValue({
      activities: [],
      isLoading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: true,
      isLoadingMore: false,
      refresh: refreshFn,
    });

    const user = userEvent.setup();
    renderWithAuth(<RunsPage />, {
      user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
    });

    await user.click(screen.getByRole('button', { name: /同步/i }));

    await waitFor(() => {
      expect(syncFn).toHaveBeenCalledTimes(1);
    });
    expect(refreshFn).not.toHaveBeenCalled();
  });

  describe('disconnect', () => {
    /** @type {import('vitest').Mock} */
    let confirmSpy;

    const connectedUser = {
      uid: 'u1',
      name: 'Test',
      email: null,
      photoURL: null,
      getIdToken: vi.fn().mockResolvedValue('mock-token-123'),
    };

    beforeEach(() => {
      mockedUseConnection.mockReturnValue({
        connection: { connected: true, athleteName: 'John', lastSyncAt: null },
        isLoading: false,
        error: null,
      });
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(/** @type {Response} */ ({ ok: true }));
    });

    afterEach(() => {
      confirmSpy.mockRestore();
      vi.mocked(globalThis.fetch).mockRestore();
    });

    it('shows disconnect button when connected', () => {
      renderWithAuth(<RunsPage />, { user: connectedUser });

      expect(screen.getByRole('button', { name: '取消連結' })).toBeInTheDocument();
    });

    it('does not call API when user cancels confirm dialog', async () => {
      confirmSpy.mockReturnValue(false);
      const user = userEvent.setup();
      renderWithAuth(<RunsPage />, { user: connectedUser });

      await user.click(screen.getByRole('button', { name: '取消連結' }));

      expect(confirmSpy).toHaveBeenCalledWith('確定要取消連結 Strava 嗎？這會刪除所有跑步紀錄。');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('calls POST /api/strava/disconnect with Bearer token on confirm', async () => {
      confirmSpy.mockReturnValue(true);
      const user = userEvent.setup();
      renderWithAuth(<RunsPage />, { user: connectedUser });

      await user.click(screen.getByRole('button', { name: '取消連結' }));

      expect(connectedUser.getIdToken).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/strava/disconnect', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token-123' },
      });
    });

    it('shows "取消連結中…" and disables button while disconnecting', async () => {
      confirmSpy.mockReturnValue(true);
      /** @type {(value: Response) => void} */
      let resolveFetch;
      vi.mocked(globalThis.fetch).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      const user = userEvent.setup();
      renderWithAuth(<RunsPage />, { user: connectedUser });

      await user.click(screen.getByRole('button', { name: '取消連結' }));

      const btn = screen.getByRole('button', { name: '取消連結中…' });
      expect(btn).toBeDisabled();

      // resolveFetch is assigned inside Promise constructor
      await act(() => resolveFetch(/** @type {Response} */ ({ ok: true })));
    });
  });
});
