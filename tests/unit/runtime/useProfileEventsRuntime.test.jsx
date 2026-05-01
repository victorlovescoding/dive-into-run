/**
 * @file Unit tests for `useProfileEventsRuntime` hook (T-P1-1-17).
 * @description
 * Mock 邊界只限 `firebase/firestore` + `@/config/client/firebase-client`。
 * `@/service/profile-service` 與 `@/repo/client/firebase-profile-repo` 走真實實作。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

const TEST_UID = 'user-abc';

/** @type {Array<{ observe: import('vitest').Mock, disconnect: import('vitest').Mock, trigger: (entries: Array<{ isIntersecting: boolean }>) => void }>} */
let observerControls = [];
/** @type {ReturnType<typeof vi.spyOn> | undefined} */
let consoleErrorSpy;

/**
 * 建立 mock event snapshot。
 * @param {string} id - 文件 ID。
 * @param {object} [overrides] - 覆寫欄位。
 * @returns {{ id: string, data: () => object }} snapshot。
 */
function createEventDoc(id, overrides = {}) {
  return {
    id,
    data: () => ({
      title: `活動 ${id}`,
      time: { toMillis: () => 0, toDate: () => new Date(0) },
      location: '臺北車站',
      city: '臺北市',
      participantsCount: 1,
      maxParticipants: 5,
      hostUid: TEST_UID,
      ...overrides,
    }),
  };
}

/**
 * 動態載入 hook，避免 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useProfileEventsRuntime').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useProfileEventsRuntime')).default;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockGetDocs.mockReset();
  observerControls = [];

  mockCollection.mockImplementation((_db, path) => ({ type: 'collection', path }));
  mockCollectionGroup.mockImplementation((_db, path) => ({ type: 'collectionGroup', path }));
  mockDoc.mockImplementation((_db, ...segments) => ({ type: 'doc', path: segments.join('/') }));
  mockWhere.mockImplementation((field, op, value) => ({ type: 'where', field, op, value }));
  mockOrderBy.mockImplementation((field, direction) => ({ type: 'orderBy', field, direction }));
  mockLimit.mockImplementation((value) => ({ type: 'limit', value }));
  mockStartAfter.mockImplementation((cursor) => ({ type: 'startAfter', cursor }));
  mockQuery.mockImplementation((target, ...constraints) => ({ target, constraints }));
  mockSetDoc.mockResolvedValue(undefined);

  global.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
    /** @type {unknown} */ (
      class MockIntersectionObserver {
        /**
         * @param {(entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void} callback - IO callback。
         */
        constructor(callback) {
          const observer = /** @type {IntersectionObserver} */ (/** @type {unknown} */ (this));
          const control = {
            observe: vi.fn(),
            disconnect: vi.fn(),
            trigger(entries) {
              callback(
                /** @type {IntersectionObserverEntry[]} */ (
                  /** @type {unknown} */ (entries)
                ),
                observer,
              );
            },
          };
          observerControls.push(control);
          this.observe = control.observe;
          this.disconnect = control.disconnect;
        }

        observe() {}

        disconnect() {}

        unobserve() {}

        takeRecords() {
          return /** @type {IntersectionObserverEntry[]} */ ([]);
        }
      }
    )
  );
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = undefined;
});

describe('useProfileEventsRuntime', () => {
  it('loads the first hosted-events page and maps fallback fields', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createEventDoc('ev-1', { title: '清晨慢跑' }),
        { id: 'ev-2', data: () => ({ time: { toMillis: () => 0, toDate: () => new Date(0) } }) },
      ],
    });

    const useProfileEventsRuntime = await loadHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    expect(result.current.isInitialLoading).toBe(true);

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].title).toBe('清晨慢跑');
    expect(result.current.items[1]).toMatchObject({
      title: '（未命名活動）',
      location: '',
      city: '',
      participantsCount: 0,
      maxParticipants: 0,
      hostUid: '',
    });
    expect(result.current.hasMore).toBe(false);
    expect(result.current.initialError).toBeNull();
    expect(mockWhere).toHaveBeenCalledWith('hostUid', '==', TEST_UID);
    expect(mockOrderBy).toHaveBeenCalledWith('time', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(6);
  });

  it('appends the next page and passes the visible last doc as cursor', async () => {
    const initialDocs = Array.from({ length: 6 }, (_, index) => createEventDoc(`p1-${index}`));
    mockGetDocs
      .mockResolvedValueOnce({ docs: initialDocs })
      .mockResolvedValueOnce({ docs: [createEventDoc('p2-0'), createEventDoc('p2-1')] });

    const useProfileEventsRuntime = await loadHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    act(() => {
      result.current.sentinelRef.current = document.createElement('div');
    });

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await waitFor(() => expect(observerControls[0]?.observe).toHaveBeenCalled());

    act(() => {
      observerControls[0]?.trigger([{ isIntersecting: true }]);
    });

    await waitFor(() => expect(result.current.items.map((item) => item.id)).toContain('p2-0'));

    expect(result.current.items).toHaveLength(7);
    expect(result.current.hasMore).toBe(false);
    expect(mockStartAfter).toHaveBeenLastCalledWith(initialDocs[4]);
  });

  it('disconnects the observer on unmount after pagination becomes active', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: Array.from({ length: 6 }, (_, index) => createEventDoc(`ev-${index}`)),
    });

    const useProfileEventsRuntime = await loadHook();
    const { result, unmount } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    act(() => {
      result.current.sentinelRef.current = document.createElement('div');
    });

    await waitFor(() => expect(observerControls[0]?.observe).toHaveBeenCalled());
    unmount();

    expect(observerControls[0]?.disconnect).toHaveBeenCalled();
  });

  it('returns an empty page without errors when no hosted events exist', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const useProfileEventsRuntime = await loadHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.initialError).toBeNull();
  });

  it('skips fetching when uid is empty and keeps the initial loading state', async () => {
    const useProfileEventsRuntime = await loadHook();
    const { result } = renderHook(() => useProfileEventsRuntime(''));

    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('sets initialError when the first page fails', async () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDocs.mockRejectedValueOnce(new Error('firestore unavailable'));

    const useProfileEventsRuntime = await loadHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.initialError).toBe('載入失敗');
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('keeps the current page and surfaces loadMoreError when pagination fails', async () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDocs
      .mockResolvedValueOnce({
        docs: Array.from({ length: 6 }, (_, index) => createEventDoc(`p1-${index}`)),
      })
      .mockRejectedValueOnce(new Error('network down'));

    const useProfileEventsRuntime = await loadHook();
    const { result } = renderHook(() => useProfileEventsRuntime(TEST_UID));

    act(() => {
      result.current.sentinelRef.current = document.createElement('div');
    });

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => {
      observerControls[0]?.trigger([{ isIntersecting: true }]);
    });

    await waitFor(() => expect(result.current.loadMoreError).toBe('載入更多失敗'));

    expect(result.current.items).toHaveLength(5);
    expect(result.current.isLoadingMore).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
