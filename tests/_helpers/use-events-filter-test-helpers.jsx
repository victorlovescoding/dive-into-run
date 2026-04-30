import { useEffect, useRef } from 'react';
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * 建立 useEventsFilter 所需的 setter / loader spies。
 * @param {{ isFormOpen?: boolean }} [overrides] - 覆寫設定。
 * @returns {{
 *   setEvents: import('vitest').Mock,
 *   setCursor: import('vitest').Mock,
 *   setLoadError: import('vitest').Mock,
 *   setLoadMoreError: import('vitest').Mock,
 *   setHasMore: import('vitest').Mock,
 *   loadLatestPage: import('vitest').Mock,
 *   isFormOpen: boolean
 * }} harness。
 */
export function createEventsFilterHarness(overrides = {}) {
  return {
    setEvents: vi.fn(),
    setCursor: vi.fn(),
    setLoadError: vi.fn(),
    setLoadMoreError: vi.fn(),
    setHasMore: vi.fn(),
    loadLatestPage: vi.fn().mockResolvedValue(undefined),
    isFormOpen: overrides.isFormOpen ?? false,
  };
}

/**
 * 以 mounted ref 包住 useEventsFilter，模擬父層 runtime 行為。
 * @param {typeof import('@/runtime/hooks/useEventsFilter').default} useEventsFilter - 目標 hook。
 * @param {ReturnType<typeof createEventsFilterHarness>} harness - 父層 spies。
 * @returns {import('@testing-library/react').RenderHookResult<ReturnType<typeof import('@/runtime/hooks/useEventsFilter').default>, unknown>}
 *   renderHook 結果。
 */
export function renderEventsFilterHook(useEventsFilter, harness) {
  return renderHook(() => {
    const isMountedRef = useRef(true);
    useEffect(() => () => {
      isMountedRef.current = false;
    }, []);

    return useEventsFilter({
      isFormOpen: harness.isFormOpen,
      isMountedRef,
      setEvents: harness.setEvents,
      setCursor: harness.setCursor,
      setLoadError: harness.setLoadError,
      setLoadMoreError: harness.setLoadMoreError,
      setHasMore: harness.setHasMore,
      loadLatestPage: harness.loadLatestPage,
    });
  });
}

/**
 * 建立活動 snapshot。
 * @param {string} id - doc id。
 * @param {object} data - doc data。
 * @returns {{ id: string, data: () => object }} snapshot。
 */
export function createEventDoc(id, data) {
  return { id, data: () => data };
}
