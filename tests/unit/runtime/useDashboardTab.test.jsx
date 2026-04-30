import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, waitFor } from '@testing-library/react';
import {
  createDeferred,
  installIntersectionObserverMock,
} from '../../_helpers/runtime-hook-test-helpers';
/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useDashboardTab').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useDashboardTab')).default;
}

/**
 * 建立 fetchFn 回傳結果。
 * @param {object[]} items - 此頁項目。
 * @param {object} [extra] - 額外欄位。
 * @returns {import('@/runtime/hooks/useDashboardTab').FetchResult} 結果。
 */
function makeFetchResult(items, extra = {}) {
  return { items, ...extra };
}

/**
 * 以真實 DOM sentinel 掛載 hook，讓 observer effect 用真正的 ref。
 * @param {Awaited<ReturnType<typeof loadHook>>} useDashboardTab - 目標 hook。
 * @param {string} uid - 使用者 UID。
 * @param {import('vitest').Mock} fetchFn - 分頁 fetch function。
 * @param {number} pageSize - 每頁數量。
 * @param {boolean} isActive - tab 是否啟用。
 * @returns {{ getCurrent: () => ReturnType<Awaited<ReturnType<typeof loadHook>>> | null, unmount: () => void }} 讀取目前 hook state 的 getter 與 unmount。
 */
function renderWithSentinel(useDashboardTab, uid, fetchFn, pageSize, isActive) {
  /** @type {ReturnType<Awaited<ReturnType<typeof loadHook>>> | null} */
  let latestValue = null;

  /**
   * 把本地 DOM node 綁到 hook 提供的 sentinel ref。
   * @param {{ targetRef: import('react').RefObject<HTMLDivElement | null> }} props - sentinel ref。
   * @returns {import('react').ReactElement} sentinel 元素。
   */
  function SentinelBinder({ targetRef }) {
    return <div ref={targetRef} />;
  }

  /**
   * 把 hook state 綁到真實 DOM sentinel。
   * @returns {import('react').ReactElement} sentinel 元素。
   */
  function Probe() {
    const hookValue = useDashboardTab(uid, fetchFn, pageSize, isActive);
    useEffect(() => {
      latestValue = hookValue;
    }, [hookValue]);
    return <SentinelBinder targetRef={hookValue.sentinelRef} />;
  }

  const view = render(<Probe />);
  return { getCurrent: () => latestValue, unmount: view.unmount };
}

/** @type {ReturnType<typeof installIntersectionObserverMock> | null} */
let observerMock = null;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  observerMock = installIntersectionObserverMock();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  observerMock?.restore();
  observerMock = null;
  vi.restoreAllMocks();
});

describe('useDashboardTab', () => {
  it('loads initial page and exposes hasMore when result reaches pageSize', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(makeFetchResult([{ id: 'a' }, { id: 'b' }, { id: 'c' }]));

    const useDashboardTab = await loadHook();
    const { result } = renderHook(() => useDashboardTab('u1', fetchFn, 3, true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetchFn).toHaveBeenLastCalledWith('u1', { prevResult: null, pageSize: 3 });
  });

  it('skips fetch when uid is missing or tab is inactive', async () => {
    const fetchFn = vi.fn();
    const useDashboardTab = await loadHook();
    const { result: missingUidResult } = renderHook(() => useDashboardTab(null, fetchFn, 5, true));
    const { result: inactiveTabResult } = renderHook(() => useDashboardTab('u1', fetchFn, 5, false));

    expect(fetchFn).not.toHaveBeenCalled();
    expect(missingUidResult.current.items).toEqual([]);
    expect(inactiveTabResult.current.isLoading).toBe(false);
  });

  it('sets error when initial fetch rejects', async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('network'));

    const useDashboardTab = await loadHook();
    const { result } = renderHook(() => useDashboardTab('u1', fetchFn, 5, true));

    await waitFor(() => {
      expect(result.current.error).toBe('載入失敗');
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('prevents duplicate initial loads on same props via initializedRef', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(makeFetchResult([{ id: 'a' }]));

    const useDashboardTab = await loadHook();
    const { result, rerender } = renderHook(
      ({ uid, isActive }) => useDashboardTab(uid, fetchFn, 5, isActive),
      { initialProps: { uid: 'u1', isActive: true } },
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    rerender({ uid: 'u1', isActive: true });

    expect(fetchFn.mock.calls[1]).toBeUndefined();
  });

  it('appends loadMore items and forwards prevResult to fetchFn', async () => {
    const firstResult = makeFetchResult([{ id: 'a' }, { id: 'b' }], { nextCursor: 2 });
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(firstResult)
      .mockResolvedValueOnce(makeFetchResult([{ id: 'c' }, { id: 'd' }], { nextCursor: 4 }));

    const useDashboardTab = await loadHook();
    const { result } = renderHook(() => useDashboardTab('u1', fetchFn, 2, true));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    act(() => {
      result.current.retryLoadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(4);
    });

    expect(fetchFn).toHaveBeenNthCalledWith(2, 'u1', {
      prevResult: firstResult,
      pageSize: 2,
    });
  });

  it('sets loadMoreError when loadMore rejects and keeps current items', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(makeFetchResult([{ id: 'a' }, { id: 'b' }]))
      .mockRejectedValueOnce(new Error('boom'));

    const useDashboardTab = await loadHook();
    const { result } = renderHook(() => useDashboardTab('u1', fetchFn, 2, true));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    act(() => {
      result.current.retryLoadMore();
    });

    await waitFor(() => {
      expect(result.current.loadMoreError).toBe('載入更多失敗');
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('guards against concurrent loadMore calls via isLoadingMoreRef', async () => {
    const deferred = createDeferred();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(makeFetchResult([{ id: 'a' }, { id: 'b' }]))
      .mockImplementationOnce(() => deferred.promise);

    const useDashboardTab = await loadHook();
    const { result } = renderHook(() => useDashboardTab('u1', fetchFn, 2, true));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    act(() => {
      result.current.retryLoadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(true);
    });

    act(() => {
      result.current.retryLoadMore();
    });

    expect(fetchFn.mock.calls[2]).toBeUndefined();

    await act(async () => {
      deferred.resolve(makeFetchResult([{ id: 'c' }]));
      await deferred.promise;
    });
  });

  it('does not load more when hasMore is false', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(makeFetchResult([{ id: 'a' }]));

    const useDashboardTab = await loadHook();
    const { result } = renderHook(() => useDashboardTab('u1', fetchFn, 2, true));

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });

    act(() => {
      result.current.retryLoadMore();
    });

    expect(fetchFn.mock.calls[1]).toBeUndefined();
  });

  it('loads more from IntersectionObserver and disconnects on unmount', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(makeFetchResult([{ id: 'a' }, { id: 'b' }]))
      .mockResolvedValueOnce(makeFetchResult([{ id: 'c' }, { id: 'd' }]));

    const useDashboardTab = await loadHook();
    const view = renderWithSentinel(useDashboardTab, 'u1', fetchFn, 2, true);

    await waitFor(() => {
      expect(view.getCurrent()?.items).toHaveLength(2);
    });

    await waitFor(() => {
      expect(observerMock?.observe).toHaveBeenCalled();
    });

    await act(async () => {
      observerMock?.trigger();
    });

    await waitFor(() => {
      expect(view.getCurrent()?.items).toHaveLength(4);
    });

    view.unmount();

    expect(observerMock?.disconnect).toHaveBeenCalled();
  });

  it('retry re-fetches after initial error', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce(makeFetchResult([{ id: 'a' }, { id: 'b' }]));

    const useDashboardTab = await loadHook();
    const { result } = renderHook(() => useDashboardTab('u1', fetchFn, 2, true));

    await waitFor(() => {
      expect(result.current.error).toBe('載入失敗');
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(true);
  });
});
