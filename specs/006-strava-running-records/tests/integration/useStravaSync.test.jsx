import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('@/config/client/firebase-client', () => ({
  db: {},
  auth: {},
}));

vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

import useStravaSync from '@/runtime/hooks/useStravaSync';

const mockGetIdToken = vi.fn().mockResolvedValue('mock-id-token');

const mockUser = {
  uid: 'u1',
  name: 'Test',
  email: null,
  photoURL: null,
  getIdToken: mockGetIdToken,
};

/**
 * 以 AuthContext.Provider 包裝元件並 render。
 * @param {import('react').ReactElement} ui - 要渲染的元件。
 * @param {object | null} [user] - 模擬使用者。
 * @returns {ReturnType<typeof render>} render 結果。
 */
function renderWithAuth(ui, user = mockUser) {
  return render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading: false }}>
      {ui}
    </AuthContext.Provider>,
  );
}

/**
 * 消費 useStravaSync hook 的測試元件。
 * @param {object} props - 元件 props。
 * @param {{ toDate: () => Date } | null} props.lastSyncAt - 上次同步時間。
 * @returns {import('react').ReactElement} 渲染結果。
 */
function TestComponent({ lastSyncAt }) {
  const { sync, isSyncing, cooldownRemaining, error } = useStravaSync(lastSyncAt);
  return (
    <div>
      <button type="button" onClick={sync} disabled={isSyncing || cooldownRemaining > 0}>
        Sync
      </button>
      <span data-testid="syncing">{String(isSyncing)}</span>
      <span data-testid="cooldown">{cooldownRemaining}</span>
      {error && <div role="alert">{error}</div>}
    </div>
  );
}

describe('useStravaSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls POST /api/strava/sync with Bearer token on sync()', async () => {
    const user = userEvent.setup();

    renderWithAuth(<TestComponent lastSyncAt={null} />);

    await user.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith('/api/strava/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-id-token' },
      });
    });
  });

  it('shows isSyncing=true during API call', async () => {
    let resolveFetch;
    mockedFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const user = userEvent.setup();

    renderWithAuth(<TestComponent lastSyncAt={null} />);

    expect(screen.getByTestId('syncing')).toHaveTextContent('false');

    await user.click(screen.getByRole('button', { name: 'Sync' }));

    expect(screen.getByTestId('syncing')).toHaveTextContent('true');

    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve({}) });
    });

    expect(screen.getByTestId('syncing')).toHaveTextContent('false');
  });

  it('shows cooldownRemaining counting down from lastSyncAt', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-06T12:00:00Z');
    vi.setSystemTime(now);

    // lastSyncAt = 2 minutes ago -> 180s remaining (300 - 120)
    const twoMinAgo = new Date('2026-04-06T11:58:00Z');
    const lastSyncAt = { toDate: () => twoMinAgo };

    renderWithAuth(<TestComponent lastSyncAt={lastSyncAt} />);

    expect(screen.getByTestId('cooldown')).toHaveTextContent('180');

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId('cooldown')).toHaveTextContent('170');
  });

  it('cooldownRemaining is 0 when lastSyncAt is null', () => {
    renderWithAuth(<TestComponent lastSyncAt={null} />);

    expect(screen.getByTestId('cooldown')).toHaveTextContent('0');
  });

  it('does not call API when already syncing (double-sync guard)', async () => {
    let resolveFetch;
    mockedFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const user = userEvent.setup();

    renderWithAuth(<TestComponent lastSyncAt={null} />);

    await user.click(screen.getByRole('button', { name: 'Sync' }));
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // Button should be disabled now, but also test the guard directly
    // Re-enable button manually won't happen, but we verify fetch count
    expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled();

    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('shows error on sync failure', async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '同步失敗' }),
    });

    const user = userEvent.setup();

    renderWithAuth(<TestComponent lastSyncAt={null} />);

    await user.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('同步失敗');
    });
  });

  it('sync() resolves to true on success', async () => {
    /** @type {boolean | undefined} */
    let syncResult;

    /** @returns {import('react').ReactElement} 測試用按鈕元件。 */
    function ResultComponent() {
      const { sync } = useStravaSync(null);
      return (
        <button
          type="button"
          onClick={async () => {
            syncResult = await sync();
          }}
        >
          Sync
        </button>
      );
    }

    const user = userEvent.setup();
    renderWithAuth(<ResultComponent />);

    await user.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(syncResult).toBe(true);
    });
  });

  it('sync() resolves to false on failure', async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '同步失敗' }),
    });

    /** @type {boolean | undefined} */
    let syncResult;

    /** @returns {import('react').ReactElement} 測試用按鈕元件。 */
    function ResultComponent() {
      const { sync } = useStravaSync(null);
      return (
        <button
          type="button"
          onClick={async () => {
            syncResult = await sync();
          }}
        >
          Sync
        </button>
      );
    }

    const user = userEvent.setup();
    renderWithAuth(<ResultComponent />);

    await user.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(syncResult).toBe(false);
    });
  });

  it('cleans up interval on unmount', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-06T12:00:00Z');
    vi.setSystemTime(now);

    const oneMinAgo = new Date('2026-04-06T11:59:00Z');
    const lastSyncAt = { toDate: () => oneMinAgo };

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderWithAuth(<TestComponent lastSyncAt={lastSyncAt} />);

    expect(screen.getByTestId('cooldown')).toHaveTextContent('240');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
