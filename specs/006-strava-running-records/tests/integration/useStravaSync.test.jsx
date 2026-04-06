import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/firebase-client', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    },
  },
}));

vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

import { auth } from '@/lib/firebase-client';
import useStravaSync from '@/hooks/useStravaSync';

const mockedGetIdToken = /** @type {import('vitest').Mock} */ (auth.currentUser.getIdToken);

/**
 * 消費 useStravaSync hook 的測試元件。
 * @param {object} props - 元件 props。
 * @param {{ toDate: () => Date } | null} props.lastSyncAt - 上次同步時間。
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

    render(<TestComponent lastSyncAt={null} />);

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

    render(<TestComponent lastSyncAt={null} />);

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

    // lastSyncAt = 30 minutes ago -> 30 min (1800s) remaining
    const thirtyMinAgo = new Date('2026-04-06T11:30:00Z');
    const lastSyncAt = { toDate: () => thirtyMinAgo };

    render(<TestComponent lastSyncAt={lastSyncAt} />);

    expect(screen.getByTestId('cooldown')).toHaveTextContent('1800');

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId('cooldown')).toHaveTextContent('1790');
  });

  it('cooldownRemaining is 0 when lastSyncAt is null', () => {
    render(<TestComponent lastSyncAt={null} />);

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

    render(<TestComponent lastSyncAt={null} />);

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

    render(<TestComponent lastSyncAt={null} />);

    await user.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('同步失敗');
    });
  });

  it('cleans up interval on unmount', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-06T12:00:00Z');
    vi.setSystemTime(now);

    const tenMinAgo = new Date('2026-04-06T11:50:00Z');
    const lastSyncAt = { toDate: () => tenMinAgo };

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = render(<TestComponent lastSyncAt={lastSyncAt} />);

    expect(screen.getByTestId('cooldown')).toHaveTextContent('3000');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
