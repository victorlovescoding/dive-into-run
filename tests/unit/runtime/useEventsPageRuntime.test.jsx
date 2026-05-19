import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useEventsPageRuntime from '@/runtime/hooks/useEventsPageRuntime';
import { createEventSubmitEvent } from '../../_helpers/use-event-mutations-test-helpers';
import { installIntersectionObserverMock } from '../../_helpers/runtime-hook-test-helpers';
import {
  createEventFixture,
  createEventList,
  createGetDocDispatcher,
  createGetDocsDispatcher,
  createTestUser,
} from '../../_helpers/use-events-page-runtime-test-helpers';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const {
  authState,
  mockAddDoc,
  mockCollection,
  mockDeleteDoc,
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockLimit,
  mockOrderBy,
  mockQuery,
  mockRunTransaction,
  mockServerTimestamp,
  mockShowToast,
  mockStartAfter,
  mockSetDoc,
  mockTimestampFromDate,
  mockUseContext,
  mockWhere,
  mockReplace,
  mockSearchParamsGet,
} = vi.hoisted(() => ({
  authState: {
    current: { user: null, setUser: vi.fn(), loading: false },
  },
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn((base, ...segments) => ({
    type: 'doc',
    path: base?.type === 'collection' ? [base.path, ...segments].join('/') : segments.join('/'),
    id: String(segments.at(-1) ?? ''),
  })),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
  mockRunTransaction: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  mockShowToast: vi.fn(),
  mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  mockSetDoc: vi.fn(),
  mockTimestampFromDate: vi.fn((date) => ({ type: 'timestamp', toDate: () => date })),
  mockUseContext: vi.fn(),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockReplace: vi.fn(),
  mockSearchParamsGet: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  orderBy: mockOrderBy,
  query: mockQuery,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  startAfter: mockStartAfter,
  where: mockWhere,
  writeBatch: vi.fn(),
  deleteField: vi.fn(() => ({ __sentinel: 'deleteField' })),
  Timestamp: { fromDate: mockTimestampFromDate, now: vi.fn(() => ({ __ts: 'now' })) },
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

/**
 * @typedef {object} WrapperResult
 * @property {import('vitest').Mock} showToast - toast mock。
 */

/**
 * @param {{ user?: ReturnType<typeof createTestUser> | null, showToast?: import('vitest').Mock }} [options] - wrapper 設定。
 * @returns {WrapperResult} wrapper 與 toast mock。
 */
function createWrapper(options = {}) {
  authState.current = {
    user: options.user === undefined ? createTestUser() : options.user,
    setUser: vi.fn(),
    loading: false,
  };

  return {
    showToast: options.showToast ?? mockShowToast,
  };
}

/**
 * @param {ReturnType<typeof createEventSubmitEvent>} submitEvent - helper 產生的 submit event。
 * @returns {import('react').FormEvent<HTMLFormElement>} 可傳給 runtime 的 form event。
 */
function asFormEvent(submitEvent) {
  return /** @type {import('react').FormEvent<HTMLFormElement>} */ (
    /** @type {unknown} */ (submitEvent)
  );
}

/**
 * 建立 favorite document snapshot。
 * @param {string} eventId - 活動 ID。
 * @param {boolean} exists - favorite 是否存在。
 * @returns {{ id: string, exists: () => boolean, data: () => { targetId: string, createdAt: string } }} snapshot。
 */
function createFavoriteSnapshot(eventId, exists) {
  return {
    id: eventId,
    exists: () => exists,
    data: () => ({ targetId: eventId, createdAt: `favorite-${eventId}` }),
  };
}

/**
 * 建立同時支援報名狀態與活動收藏狀態的 getDoc dispatcher。
 * @param {object} [options] - dispatcher 設定。
 * @param {string[]} [options.joinedEventIds] - 已報名活動 ID。
 * @param {string[]} [options.favoriteEventIds] - 已收藏活動 ID。
 * @returns {(ref: { path?: string, id?: string }) => Promise<object>} getDoc dispatcher。
 */
function createEventPageGetDocDispatcher({ joinedEventIds = [], favoriteEventIds = [] } = {}) {
  const membershipDispatcher = createGetDocDispatcher(joinedEventIds);
  const favorites = new Set(favoriteEventIds.map(String));

  return async (ref) => {
    const path = String(ref?.path ?? '');
    const favoriteMatch = path.match(/^users\/[^/]+\/favoriteEvents\/([^/]+)$/);
    if (favoriteMatch) {
      const eventId = favoriteMatch[1];
      return createFavoriteSnapshot(eventId, favorites.has(eventId));
    }
    return membershipDispatcher(ref);
  };
}

/**
 * 建立 Firestore permission-denied error。
 * @returns {Error & { code: string }} permission-denied error。
 */
function createPermissionDeniedError() {
  return Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });
}

describe('useEventsPageRuntime', () => {
  /** @type {ReturnType<typeof installIntersectionObserverMock>} */
  let observer;

  beforeEach(() => {
    observer = installIntersectionObserverMock();
    vi.clearAllMocks();
    mockShowToast.mockReset();
    mockSearchParamsGet.mockReturnValue(null);
    mockGetDoc.mockImplementation(createGetDocDispatcher());
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    observer.restore();
  });

  it('loads the initial page and consumes toast search params through router.replace', async () => {
    mockSearchParamsGet.mockImplementation((key) => (key === 'toast' ? '活動已建立' : null));
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(2) }));
    const { showToast } = createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });

    expect(showToast).toHaveBeenCalledWith('活動已建立');
    expect(mockReplace).toHaveBeenCalledWith('/events', { scroll: false });
    expect(result.current.hostName).toBe('Alice');
    expect(result.current.isLoadingEvents).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });

  it('runs the real filter hook to swap in filtered results and then clear back to latest', async () => {
    const latestEvents = createEventList(2);
    const filteredEvents = [createEventFixture(7, { city: '臺北市', district: '信義區' })];
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents, filteredEvents }));
    createWrapper({ user: null });
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });

    act(() => {
      result.current.handleFilterCityChange('臺北市');
      result.current.setFilterDistrict('信義區');
    });
    await act(async () => {
      await result.current.handleSearchFilters();
    });

    expect(result.current.events.map((event) => event.id)).toEqual(['event-7']);
    expect(result.current.isFilteredResults).toBe(true);
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.handleClearFilters();
    });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });
    expect(result.current.isFilteredResults).toBe(false);
  });

  it('runs the real mutations hook to create a new event and close the form', async () => {
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(1) }));
    mockAddDoc.mockResolvedValueOnce({ id: 'event-new' });
    const { showToast } = createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    act(() => {
      result.current.handleToggleCreateRunForm();
    });

    await act(async () => {
      await result.current.handleSubmit(
        asFormEvent(createEventSubmitEvent({ title: '新的晨跑團', city: '臺北市' })),
      );
    });

    await waitFor(() => {
      expect(result.current.events[0]?.id).toBe('event-new');
    });

    expect(showToast).toHaveBeenLastCalledWith('建立活動成功');
    expect(result.current.isFormOpen).toBe(false);
    expect(result.current.selectedCity).toBe('');
  });

  it('loads the next page through the real loadMore path and dedupes repeated ids', async () => {
    const latestEvents = createEventList(10);
    const nextEvents = [latestEvents[9], createEventFixture(11)];
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents, nextEvents }));
    createWrapper({ user: null });
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(10);
    });
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(11);
    });

    expect(result.current.events.filter((event) => event.id === latestEvents[9].id)).toHaveLength(1);
    expect(result.current.events.at(-1)?.id).toBe('event-11');
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('refreshes favorite event ids after initial load', async () => {
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(2) }));
    mockGetDoc.mockImplementation(
      createEventPageGetDocDispatcher({ favoriteEventIds: ['event-1'] }),
    );
    createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(Array.from(result.current.favoriteEventIds)).toEqual(['event-1']);
    });
  });

  it('keeps the initial events when favorite status hydration is permission denied', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(2) }));
    mockGetDoc.mockImplementation(async (ref) => {
      if (String(ref?.path ?? '').includes('/favoriteEvents/')) {
        throw createPermissionDeniedError();
      }
      return createGetDocDispatcher()(ref);
    });
    createWrapper();

    try {
      const { result } = renderHook(() => useEventsPageRuntime());
      const initialFavoriteEventIds = result.current.favoriteEventIds;

      await waitFor(() => {
        expect(result.current.events).toHaveLength(2);
      });
      await waitFor(() => {
        expect(mockGetDoc).toHaveBeenCalledWith(
          expect.objectContaining({ path: 'users/user-1/favoriteEvents/event-1' }),
        );
      });
      await waitFor(() => {
        expect(result.current.favoriteEventIds).not.toBe(initialFavoriteEventIds);
      });

      expect(result.current.favoriteEventIds.size).toBe(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('preserves existing favorite event ids when favorite hydration fails without permission-denied', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const latestEvents = createEventList(2);
    const filteredEvents = [createEventFixture(7, { city: '臺北市', district: '信義區' })];
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents, filteredEvents }));
    mockGetDoc.mockImplementation(
      createEventPageGetDocDispatcher({ favoriteEventIds: ['event-1'] }),
    );
    createWrapper();

    try {
      const { result } = renderHook(() => useEventsPageRuntime());

      await waitFor(() => {
        expect(Array.from(result.current.favoriteEventIds)).toEqual(['event-1']);
      });

      mockGetDoc.mockImplementation(async (ref) => {
        if (String(ref?.path ?? '').includes('/favoriteEvents/')) {
          throw new Error('network failed');
        }
        return createGetDocDispatcher()(ref);
      });

      act(() => {
        result.current.handleFilterCityChange('臺北市');
        result.current.setFilterDistrict('信義區');
      });
      await act(async () => {
        await result.current.handleSearchFilters();
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '載入活動收藏狀態失敗:',
          expect.objectContaining({ message: 'network failed' }),
        );
      });

      expect(Array.from(result.current.favoriteEventIds)).toEqual(['event-1']);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('refreshes favorite event ids after pagination adds visible events', async () => {
    const latestEvents = createEventList(10);
    const nextEvents = [createEventFixture(11)];
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents, nextEvents }));
    mockGetDoc.mockImplementation(
      createEventPageGetDocDispatcher({ favoriteEventIds: ['event-1', 'event-11'] }),
    );
    createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.favoriteEventIds.has('event-1')).toBe(true);
    });

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(Array.from(result.current.favoriteEventIds).sort()).toEqual(['event-1', 'event-11']);
    });
  });

  it('replaces favorite event ids when filters replace the visible list', async () => {
    const latestEvents = createEventList(2);
    const filteredEvents = [createEventFixture(7, { city: '臺北市', district: '信義區' })];
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents, filteredEvents }));
    mockGetDoc.mockImplementation(
      createEventPageGetDocDispatcher({ favoriteEventIds: ['event-1', 'event-7'] }),
    );
    createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.favoriteEventIds.has('event-1')).toBe(true);
    });

    act(() => {
      result.current.handleFilterCityChange('臺北市');
      result.current.setFilterDistrict('信義區');
    });
    await act(async () => {
      await result.current.handleSearchFilters();
    });

    await waitFor(() => {
      expect(Array.from(result.current.favoriteEventIds)).toEqual(['event-7']);
    });
  });

  it('shows a login toast and skips writes when an anonymous user toggles an event favorite', async () => {
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(1) }));
    const { showToast } = createWrapper({ user: null });
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent('event-1');
    });

    expect(showToast).toHaveBeenCalledWith('請先登入才能收藏', 'info');
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('adds an event favorite optimistically and shows a success toast', async () => {
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(1) }));
    mockGetDoc.mockImplementation(createEventPageGetDocDispatcher());
    const { showToast } = createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent('event-1');
    });

    expect(result.current.favoriteEventIds.has('event-1')).toBe(true);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/favoriteEvents/event-1' }),
      expect.objectContaining({ targetId: 'event-1' }),
    );
    expect(showToast).toHaveBeenLastCalledWith('已加入收藏', 'success');
  });

  it('removes an event favorite optimistically and shows a success toast', async () => {
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(1) }));
    mockGetDoc.mockImplementation(
      createEventPageGetDocDispatcher({ favoriteEventIds: ['event-1'] }),
    );
    const { showToast } = createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.favoriteEventIds.has('event-1')).toBe(true);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent('event-1');
    });

    expect(result.current.favoriteEventIds.has('event-1')).toBe(false);
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/favoriteEvents/event-1' }),
    );
    expect(showToast).toHaveBeenLastCalledWith('已取消收藏', 'success');
  });

  it('rolls back an optimistic add when adding an event favorite fails', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('write failed'));
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(1) }));
    mockGetDoc.mockImplementation(createEventPageGetDocDispatcher());
    const { showToast } = createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent('event-1');
    });

    expect(result.current.favoriteEventIds.has('event-1')).toBe(false);
    expect(showToast).toHaveBeenLastCalledWith('收藏失敗，請稍後再試', 'error');
  });

  it('rolls back an optimistic remove when removing an event favorite fails', async () => {
    mockDeleteDoc.mockRejectedValueOnce(new Error('delete failed'));
    mockGetDocs.mockImplementation(createGetDocsDispatcher({ latestEvents: createEventList(1) }));
    mockGetDoc.mockImplementation(
      createEventPageGetDocDispatcher({ favoriteEventIds: ['event-1'] }),
    );
    const { showToast } = createWrapper();
    const { result } = renderHook(() => useEventsPageRuntime());

    await waitFor(() => {
      expect(result.current.favoriteEventIds.has('event-1')).toBe(true);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent('event-1');
    });

    expect(result.current.favoriteEventIds.has('event-1')).toBe(true);
    expect(showToast).toHaveBeenLastCalledWith('取消收藏失敗，請稍後再試', 'error');
  });
});
