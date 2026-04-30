import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockUseContext, mockFetch } = vi.hoisted(() => ({
  mockUseContext: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());

  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * 設定 hook 看到的 AuthContext 值。
 * @param {{ getIdToken: () => Promise<string> } | null} user - 使用者或 null。
 * @returns {void}
 */
function mockAuth(user) {
  mockUseContext.mockReturnValue({
    user,
    loading: false,
    setUser() {},
  });
}

/**
 * 建立 Firestore Timestamp-like 物件。
 * @param {Date} date - 上次同步時間。
 * @returns {{ toDate: () => Date }} Timestamp-like。
 */
function createTimestamp(date) {
  return { toDate: () => date };
}

/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useStravaSync').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useStravaSync')).default;
}

describe('useStravaSync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', mockFetch);
    mockUseContext.mockReset();
    mockFetch.mockReset();
    mockAuth(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('syncs successfully when auth token exists', async () => {
    const getIdToken = vi.fn().mockResolvedValue('token-123');
    mockAuth({ getIdToken });
    mockFetch.mockResolvedValueOnce({ ok: true });

    const useStravaSync = await loadHook();
    const { result } = renderHook(() => useStravaSync(null));

    /** @type {boolean | undefined} */
    let syncResult;
    await act(async () => {
      syncResult = await result.current.sync();
    });

    expect(syncResult).toBe(true);
    expect(mockFetch).toHaveBeenLastCalledWith('/api/strava/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
    });
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('shows cooldown remaining and counts down to zero', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:05:00.000Z'));

    const useStravaSync = await loadHook();
    const lastSyncAt = createTimestamp(new Date('2030-01-01T00:00:03.000Z'));
    const { result } = renderHook(() => useStravaSync(lastSyncAt));

    expect(result.current.cooldownRemaining).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.cooldownRemaining).toBe(2);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.cooldownRemaining).toBe(0);
  });

  it('returns false and does not call API during cooldown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:05:00.000Z'));

    const getIdToken = vi.fn().mockResolvedValue('token-cooldown');
    mockAuth({ getIdToken });

    const useStravaSync = await loadHook();
    const lastSyncAt = createTimestamp(new Date('2030-01-01T00:00:03.000Z'));
    const { result } = renderHook(() => useStravaSync(lastSyncAt));

    /** @type {boolean | undefined} */
    let syncResult;
    await act(async () => {
      syncResult = await result.current.sync();
    });

    expect(syncResult).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(getIdToken).not.toHaveBeenCalled();
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns false and skips fetch when user is missing', async () => {
    const useStravaSync = await loadHook();
    const { result } = renderHook(() => useStravaSync(null));

    /** @type {boolean | undefined} */
    let syncResult;
    await act(async () => {
      syncResult = await result.current.sync();
    });

    expect(syncResult).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.isSyncing).toBe(false);
  });

  it('stores API error when sync response is not ok', async () => {
    mockAuth({ getIdToken: vi.fn().mockResolvedValue('token-456') });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: '同步冷卻中' }),
    });

    const useStravaSync = await loadHook();
    const { result } = renderHook(() => useStravaSync(null));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('同步冷卻中');
    });
    expect(result.current.isSyncing).toBe(false);
  });

  it('stores generic error when fetch throws', async () => {
    mockAuth({ getIdToken: vi.fn().mockResolvedValue('token-789') });
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const useStravaSync = await loadHook();
    const { result } = renderHook(() => useStravaSync(null));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('同步失敗，請稍後再試');
    });
    expect(result.current.isSyncing).toBe(false);
  });
});
