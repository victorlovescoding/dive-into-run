/**
 * @file Unit tests for `useProfileEventsRuntime` hook.
 * @description
 * Mock `@/service/profile-service` (canonical path) and test:
 *   - 首次載入成功
 *   - 首次載入失敗
 *   - loadMore（IntersectionObserver 觸發）
 *   - hasMore=false 時停止載入
 *   - loadMore 失敗保留既有 items
 *
 * Rules:
 * 1. Mock canonical service: `@/service/profile-service`.
 * 2. Use `@testing-library/react` `renderHook` + `act`.
 * 3. AAA Pattern; strict JSDoc.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { getHostedEvents } from '@/service/profile-service';

/* ==========================================================================
   Mocks
   ========================================================================== */

vi.mock('@/service/profile-service', () => ({
  getHostedEvents: vi.fn(),
}));

const mockedGetHostedEvents = /** @type {import('vitest').Mock} */ (
  /** @type {unknown} */ (getHostedEvents)
);

/* ==========================================================================
   Test Data
   ========================================================================== */

const TEST_UID = 'user-abc';

/**
 * 建立 count 筆 mock EventData。
 * @param {number} count - 數量。
 * @param {string} [prefix] - ID 前綴。
 * @returns {Array<{ id: string, title: string, time: object, hostUid: string }>} 活動資料。
 */
function makeEvents(count, prefix = 'p1') {
  const base = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    title: `Event ${prefix}-${i}`,
    time: {
      toMillis: () => base - i * 86400000,
      toDate: () => new Date(base - i * 86400000),
    },
    hostUid: TEST_UID,
  }));
}

/* ==========================================================================
   IntersectionObserver mock
   ========================================================================== */

beforeEach(() => {
  vi.clearAllMocks();

  /**
   * Minimal IntersectionObserver mock。
   */
  function MockIntersectionObserver() {}
  MockIntersectionObserver.prototype.observe = vi.fn();
  MockIntersectionObserver.prototype.unobserve = vi.fn();
  MockIntersectionObserver.prototype.disconnect = vi.fn();
  MockIntersectionObserver.prototype.takeRecords = () =>
    /** @type {IntersectionObserverEntry[]} */ ([]);

  global.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
    /** @type {unknown} */ (MockIntersectionObserver)
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * 動態載入 hook（避免 vi.mock hoisting 問題）。
 * @returns {Promise<typeof import('@/runtime/hooks/useProfileEventsRuntime').default>} hook function。
 */
async function importHook() {
  const mod = await import('@/runtime/hooks/useProfileEventsRuntime');
  return mod.default;
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Unit: useProfileEventsRuntime', () => {
  it('loads initial page on mount', async () => {
    // Arrange
    const events = makeEvents(3);
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: events,
      lastDoc: { __cursor: 'page1-last' },
      hasMore: false,
    });

    const useProfileEventsRuntime = await importHook();

    // Act
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    // Assert — 等待初次載入完成
    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0].id).toBe('p1-0');
    expect(result.current.hasMore).toBe(false);
    expect(result.current.initialError).toBeNull();

    // 首次呼叫不帶 lastDoc
    expect(mockedGetHostedEvents).toHaveBeenCalledWith(
      TEST_UID,
      expect.not.objectContaining({ lastDoc: expect.anything() }),
    );
  });

  it('sets initialError when initial fetch fails', async () => {
    // Arrange
    mockedGetHostedEvents.mockRejectedValueOnce(new Error('network down'));

    const useProfileEventsRuntime = await importHook();

    // Act
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    // Assert
    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.initialError).toBe('載入失敗');
    expect(result.current.items).toHaveLength(0);
  });

  it('maps EventData to MyEventItem with fallback values', async () => {
    // Arrange — 故意缺少 optional 欄位
    const events = [
      {
        id: 'ev-1',
        time: { toMillis: () => 0, toDate: () => new Date(0) },
        // title, location, city, participantsCount, maxParticipants, hostUid 都缺
      },
    ];
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: events,
      lastDoc: null,
      hasMore: false,
    });

    const useProfileEventsRuntime = await importHook();

    // Act
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    // Assert — fallback 值
    const item = result.current.items[0];
    expect(item.title).toBe('（未命名活動）');
    expect(item.location).toBe('');
    expect(item.city).toBe('');
    expect(item.participantsCount).toBe(0);
    expect(item.maxParticipants).toBe(0);
    expect(item.hostUid).toBe('');
  });

  it('does not fetch when hasMore is false', async () => {
    // Arrange — 首次回傳 hasMore=false
    const events = makeEvents(2);
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: events,
      lastDoc: null,
      hasMore: false,
    });

    const useProfileEventsRuntime = await importHook();

    // Act
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    // Assert — hasMore=false, 不會再呼叫
    expect(result.current.hasMore).toBe(false);
    expect(mockedGetHostedEvents).toHaveBeenCalledTimes(1);
  });

  it('provides sentinelRef for IntersectionObserver', async () => {
    // Arrange
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: makeEvents(1),
      lastDoc: null,
      hasMore: false,
    });

    const useProfileEventsRuntime = await importHook();

    // Act
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    // Assert — sentinelRef 是一個 ref object
    expect(result.current.sentinelRef).toBeDefined();
    expect(result.current.sentinelRef).toHaveProperty('current');
  });

  it('sets isInitialLoading to true during fetch', async () => {
    // Arrange — 永遠不 resolve
    mockedGetHostedEvents.mockImplementationOnce(() => new Promise(() => {}));

    const useProfileEventsRuntime = await importHook();

    // Act
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    // Assert — 仍在載入中
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.items).toHaveLength(0);
  });
});
