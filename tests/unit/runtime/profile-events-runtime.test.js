/**
 * @file Unit tests for `useProfileEventsRuntime` hook.
 * @description
 * Mock Firestore boundary and allowed config stub while keeping real
 * `service/profile-service -> repo/client/firebase-profile-repo` flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const {
  mockCollection,
  mockCollectionGroup,
  mockDoc,
  mockGetCountFromServer,
  mockGetDoc,
  mockGetDocs,
  mockLimit,
  mockOrderBy,
  mockQuery,
  mockSetDoc,
  mockStartAfter,
  mockWhere,
} = vi.hoisted(() => ({
  mockCollection: vi.fn(),
  mockCollectionGroup: vi.fn(),
  mockDoc: vi.fn(),
  mockGetCountFromServer: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockQuery: vi.fn(),
  mockSetDoc: vi.fn(),
  mockStartAfter: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  doc: mockDoc,
  getCountFromServer: mockGetCountFromServer,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  orderBy: mockOrderBy,
  query: mockQuery,
  setDoc: mockSetDoc,
  startAfter: mockStartAfter,
  where: mockWhere,
}));

vi.mock('@/config/client/firebase-client', () => ({
  db: 'mock-db',
}));

const TEST_UID = 'user-abc';

/**
 * 建立 count 筆 mock QueryDocumentSnapshot。
 * @param {number} count - 數量。
 * @param {string} [prefix] - ID 前綴。
 * @returns {Array<{ id: string, data: () => object }>} 活動資料。
 */
function makeEventDocs(count, prefix = 'p1') {
  const base = Date.now();
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    data: () => ({
      title: `Event ${prefix}-${index}`,
      time: {
        toMillis: () => base - index * 86400000,
        toDate: () => new Date(base - index * 86400000),
      },
      hostUid: TEST_UID,
    }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  mockCollection.mockImplementation((_db, path) => ({
    type: 'collection',
    path,
  }));
  mockCollectionGroup.mockImplementation((_db, path) => ({
    type: 'collectionGroup',
    path,
  }));
  mockDoc.mockImplementation((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
  }));
  mockWhere.mockImplementation((field, op, value) => ({
    type: 'where',
    field,
    op,
    value,
  }));
  mockOrderBy.mockImplementation((field, direction) => ({
    type: 'orderBy',
    field,
    direction,
  }));
  mockLimit.mockImplementation((value) => ({
    type: 'limit',
    value,
  }));
  mockStartAfter.mockImplementation((doc) => ({
    type: 'startAfter',
    doc,
  }));
  mockQuery.mockImplementation((target, ...constraints) => ({
    target,
    constraints,
  }));
  mockSetDoc.mockResolvedValue(undefined);

  /**
   * 測試用 IntersectionObserver mock。
   * @returns {void}
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

/**
 * 動態載入 hook（避免 module cache 影響）。
 * @returns {Promise<typeof import('@/runtime/hooks/useProfileEventsRuntime').default>} hook function。
 */
async function importHook() {
  const mod = await import('@/runtime/hooks/useProfileEventsRuntime');
  return mod.default;
}

describe('Unit: useProfileEventsRuntime', () => {
  it('loads initial page on mount', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: makeEventDocs(3),
    });

    const useProfileEventsRuntime = await importHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0].id).toBe('p1-0');
    expect(result.current.hasMore).toBe(false);
    expect(result.current.initialError).toBeNull();
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'events');
    expect(mockWhere).toHaveBeenCalledWith('hostUid', '==', TEST_UID);
    expect(mockOrderBy).toHaveBeenCalledWith('time', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(6);
    expect(mockStartAfter).not.toHaveBeenCalled();
    expect(mockGetDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { type: 'collection', path: 'events' },
      }),
    );
  });

  it('sets initialError when initial fetch fails', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('network down'));

    const useProfileEventsRuntime = await importHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.initialError).toBe('載入失敗');
    expect(result.current.items).toHaveLength(0);
  });

  it('maps EventData to MyEventItem with fallback values', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'ev-1',
          data: () => ({
            time: { toMillis: () => 0, toDate: () => new Date(0) },
          }),
        },
      ],
    });

    const useProfileEventsRuntime = await importHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    const item = result.current.items[0];
    expect(item.title).toBe('（未命名活動）');
    expect(item.location).toBe('');
    expect(item.city).toBe('');
    expect(item.participantsCount).toBe(0);
    expect(item.maxParticipants).toBe(0);
    expect(item.hostUid).toBe('');
  });

  it('does not fetch more when service reports hasMore false', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: makeEventDocs(2),
    });

    const useProfileEventsRuntime = await importHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);
    expect(mockGetDocs.mock.calls[1]).toBeUndefined();
  });

  it('provides sentinelRef for IntersectionObserver', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: makeEventDocs(1),
    });

    const useProfileEventsRuntime = await importHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.sentinelRef).toBeDefined();
    expect(result.current.sentinelRef).toHaveProperty('current');
  });

  it('sets isInitialLoading to true during fetch', async () => {
    mockGetDocs.mockImplementationOnce(() => new Promise(() => {}));

    const useProfileEventsRuntime = await importHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.items).toHaveLength(0);
  });
});
