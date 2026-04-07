import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/** @type {IntersectionObserverCallback | null} */
let observerCallback = null;
/** @type {import('vitest').Mock} */
let mockObserve;
/** @type {import('vitest').Mock} */
let mockDisconnect;

beforeEach(() => {
  observerCallback = null;
  mockObserve = vi.fn();
  mockDisconnect = vi.fn();

  global.IntersectionObserver = /** @type {any} */ (
    class {
      /** @param {IntersectionObserverCallback} cb */
      constructor(cb) {
        observerCallback = cb;
      }
      observe = mockObserve;
      unobserve = vi.fn();
      disconnect = mockDisconnect;
      takeRecords = () => /** @type {IntersectionObserverEntry[]} */ ([]);
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** @type {import('vitest').Mock} */
const mockFetchFn = vi.fn();

/**
 * 觸發 IntersectionObserver callback（模擬哨兵進入視窗）。
 */
function triggerIntersection() {
  if (observerCallback) {
    observerCallback([/** @type {any} */ ({ isIntersecting: true })], /** @type {any} */ ({}));
  }
}

describe('useDashboardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 動態 import，避免 module cache 影響 IntersectionObserver mock。
   * @returns {Promise<typeof import('@/hooks/useDashboardTab').default>} hook 函式。
   */
  async function importHook() {
    const mod = await import('@/hooks/useDashboardTab');
    return mod.default;
  }

  // --- 1. uid 為 null 時不 fetch ---
  it('does not fetch when uid is null', async () => {
    const useDashboardTab = await importHook();

    const { result } = renderHook(() => useDashboardTab(null, mockFetchFn, 10, true));

    expect(mockFetchFn).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  // --- 2. isActive=false 時不 fetch ---
  it('does not fetch when isActive is false', async () => {
    const useDashboardTab = await importHook();

    const { result } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 10, false));

    expect(mockFetchFn).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  // --- 3. isActive 首次變 true 時觸發 initial fetch ---
  it('triggers initial fetch when isActive first becomes true', async () => {
    const useDashboardTab = await importHook();
    mockFetchFn.mockResolvedValueOnce({ items: [{ id: '1' }] });

    const { result, rerender } = renderHook(
      /** @param {{ isActive: boolean }} props */
      ({ isActive }) => useDashboardTab('user-1', mockFetchFn, 10, isActive),
      { initialProps: { isActive: false } },
    );

    // Still inactive
    expect(mockFetchFn).not.toHaveBeenCalled();

    // Activate tab
    rerender({ isActive: true });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchFn).toHaveBeenCalledOnce();
    expect(mockFetchFn).toHaveBeenCalledWith('user-1', { prevResult: null, pageSize: 10 });
    expect(result.current.items).toEqual([{ id: '1' }]);
  });

  // --- 4. 已初始化後 isActive 切換不重複 fetch ---
  it('does not re-fetch when isActive toggles after initialization', async () => {
    const useDashboardTab = await importHook();
    mockFetchFn.mockResolvedValueOnce({ items: [{ id: '1' }] });

    const { result, rerender } = renderHook(
      /** @param {{ isActive: boolean }} props */
      ({ isActive }) => useDashboardTab('user-1', mockFetchFn, 10, isActive),
      { initialProps: { isActive: true } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchFn).toHaveBeenCalledOnce();

    // Toggle off then on
    rerender({ isActive: false });
    rerender({ isActive: true });

    // Should not fetch again
    expect(mockFetchFn).toHaveBeenCalledOnce();
  });

  // --- 5. initial fetch 成功 ---
  it('updates items and isLoading on successful initial fetch', async () => {
    const useDashboardTab = await importHook();
    const fakeItems = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    mockFetchFn.mockResolvedValueOnce({ items: fakeItems, nextCursor: 42 });

    const { result } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 3, true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(fakeItems);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(true);
  });

  // --- 6. initial fetch 失敗 → error + retry ---
  it('sets error on initial fetch failure and can retry', async () => {
    const useDashboardTab = await importHook();
    mockFetchFn.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 10, true));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([]);

    // Retry
    mockFetchFn.mockResolvedValueOnce({ items: [{ id: 'x' }] });

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });

    expect(result.current.items).toEqual([{ id: 'x' }]);
    expect(result.current.isLoading).toBe(false);
  });

  // --- 7. IntersectionObserver 觸發 loadMore ---
  it('triggers loadMore when IntersectionObserver fires', async () => {
    const useDashboardTab = await importHook();
    const page1 = Array.from({ length: 5 }, (_, i) => ({ id: `p1-${i}` }));
    const page1Result = { items: page1, nextCursor: 99 };

    // Use deferred resolve so we can set sentinelRef before fetch completes
    /** @type {(value: any) => void} */
    let resolveInitial;
    mockFetchFn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
    );

    const { result } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 5, true));

    // Set sentinelRef while fetch is in-flight
    const sentinel = document.createElement('div');
    result.current.sentinelRef.current = sentinel;

    // Now resolve initial fetch — hasMore becomes true, observer effect re-fires
    await act(async () => {
      resolveInitial(page1Result);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const page2 = [{ id: 'p2-0' }];
    mockFetchFn.mockResolvedValueOnce({ items: page2 });

    // Trigger observer — should call loadMore
    await act(async () => {
      triggerIntersection();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(6);
    });

    // Should pass prevResult containing page1 response
    expect(mockFetchFn).toHaveBeenCalledTimes(2);
    expect(mockFetchFn.mock.calls[1][1]).toMatchObject({
      prevResult: page1Result,
      pageSize: 5,
    });
  });

  // --- 8. loadMore 成功 → items 累加 ---
  it('appends items on loadMore success', async () => {
    const useDashboardTab = await importHook();
    const page1 = [{ id: 'a' }, { id: 'b' }];
    const page1Result = { items: page1, nextCursor: 1 };

    /** @type {(value: any) => void} */
    let resolveInitial;
    mockFetchFn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
    );

    const { result } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 2, true));

    const sentinel = document.createElement('div');
    result.current.sentinelRef.current = sentinel;

    await act(async () => {
      resolveInitial(page1Result);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const page2 = [{ id: 'c' }];
    mockFetchFn.mockResolvedValueOnce({ items: page2 });

    await act(async () => {
      triggerIntersection();
    });

    await waitFor(() => {
      expect(result.current.items).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    });
  });

  // --- 9. loadMore 失敗 → loadMoreError + retryLoadMore ---
  it('sets loadMoreError on loadMore failure and can retryLoadMore', async () => {
    const useDashboardTab = await importHook();
    const page1 = Array.from({ length: 5 }, (_, i) => ({ id: `${i}` }));
    const page1Result = { items: page1, lastDoc: 'cursor' };

    /** @type {(value: any) => void} */
    let resolveInitial;
    mockFetchFn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
    );

    const { result } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 5, true));

    const sentinel = document.createElement('div');
    result.current.sentinelRef.current = sentinel;

    await act(async () => {
      resolveInitial(page1Result);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockFetchFn.mockRejectedValueOnce(new Error('load more failed'));

    await act(async () => {
      triggerIntersection();
    });

    await waitFor(() => {
      expect(result.current.loadMoreError).not.toBeNull();
    });

    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.items).toEqual(page1);

    // retryLoadMore
    mockFetchFn.mockResolvedValueOnce({ items: [{ id: 'new' }] });

    await act(async () => {
      result.current.retryLoadMore();
    });

    await waitFor(() => {
      expect(result.current.loadMoreError).toBeNull();
    });

    expect(result.current.items).toHaveLength(6);
  });

  // --- 10. 所有資料載完 → hasMore = false ---
  it('sets hasMore to false when returned items < pageSize', async () => {
    const useDashboardTab = await importHook();
    // Return fewer items than pageSize
    mockFetchFn.mockResolvedValueOnce({ items: [{ id: 'only' }] });

    const { result } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 10, true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);
    expect(result.current.items).toEqual([{ id: 'only' }]);
  });

  // --- 11. unmount 後不更新 state ---
  it('does not update state after unmount', async () => {
    const useDashboardTab = await importHook();
    /** @type {(value: any) => void} */
    let resolveFetch;
    mockFetchFn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useDashboardTab('user-1', mockFetchFn, 10, true));

    // Wait for effect to fire and set isLoading
    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledOnce();
    });

    // Unmount before fetch resolves
    unmount();

    // Resolve after unmount — should not throw
    await act(async () => {
      resolveFetch({ items: [{ id: 'ghost' }] });
    });

    // If we get here without error, cancelled flag worked
    expect(result.current.items).toEqual([]);
  });
});
