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
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  orderBy: mockOrderBy,
  query: mockQuery,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
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

describe('useEventsPageRuntime', () => {
  /** @type {ReturnType<typeof installIntersectionObserverMock>} */
  let observer;

  beforeEach(() => {
    observer = installIntersectionObserverMock();
    vi.clearAllMocks();
    mockShowToast.mockReset();
    mockSearchParamsGet.mockReturnValue(null);
    mockGetDoc.mockImplementation(createGetDocDispatcher());
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
});
