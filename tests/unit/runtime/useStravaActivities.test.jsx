import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createStravaActivityDoc } from '../../_helpers/strava-fixtures';

const {
  mockUseContext,
  mockDoc,
  mockCollection,
  mockOnSnapshot,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockStartAfter,
  mockGetDocs,
} = vi.hoisted(() => ({
  mockUseContext: vi.fn(),
  mockDoc: vi.fn((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
    id: String(segments.at(-1) ?? ''),
  })),
  mockCollection: vi.fn((_db, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  mockOnSnapshot: vi.fn(),
  mockQuery: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  mockGetDocs: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());

  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  getDocs: mockGetDocs,
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * 設定 hook 看到的 AuthContext 值。
 * @param {{ uid: string, name?: string|null, email?: string|null, photoURL?: string|null }|null} user - 使用者。
 * @returns {void}
 */
function mockAuth(user) {
  mockUseContext.mockReturnValue({
    user: user ? { bio: null, getIdToken: () => Promise.resolve(''), ...user } : null,
    loading: false,
    setUser() {},
  });
}

/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useStravaActivities').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useStravaActivities')).default;
}

describe('useStravaActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockUseContext.mockReset();
    mockAuth(null);
  });

  it('shows loading then displays activities', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createStravaActivityDoc('doc1', { stravaId: 12345, name: '晨跑', uid: 'u1' }),
        createStravaActivityDoc('doc2', { stravaId: 67890, name: '夜跑', uid: 'u1' }),
      ],
    });

    mockAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.activities).toHaveLength(2);
    });

    expect(result.current.activities.map((activity) => activity.name)).toEqual(['晨跑', '夜跑']);
    expect(result.current.isLoading).toBe(false);
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'u1');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('shows empty list when user not logged in', async () => {
    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('shows empty list when no activities returned', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAuth({ uid: 'u2', name: 'Empty', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
  });

  it('shows error when query fails', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));
    mockAuth({ uid: 'u3', name: 'Error', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.error).toBe('活動載入失敗');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('stores lastDoc from initial load for pagination cursor', async () => {
    const docs = Array.from({ length: 10 }, (_, index) =>
      createStravaActivityDoc(`doc${index + 1}`, {
        stravaId: index + 1,
        name: `Run ${index + 1}`,
        uid: 'u1',
      }),
    );
    mockGetDocs.mockResolvedValueOnce({ docs });
    mockAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.activities).toHaveLength(10);
    });

    expect(result.current.hasMore).toBe(true);
  });

  it('sets hasMore to false when returned page is shorter than page size', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [createStravaActivityDoc('doc1', { stravaId: 1, name: 'Run 1', uid: 'u1' })],
    });
    mockAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.activities).toHaveLength(1);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore appends activities to existing list', async () => {
    const fakeCursor = createStravaActivityDoc('doc1', { stravaId: 1, name: 'Run 1', uid: 'u1' });

    mockGetDocs.mockResolvedValueOnce({
      docs: [fakeCursor],
    });
    mockAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.activities.map((activity) => activity.name)).toEqual(['Run 1']);
    });

    mockGetDocs.mockResolvedValueOnce({
      docs: [createStravaActivityDoc('doc2', { stravaId: 2, name: 'Run 2', uid: 'u1' })],
    });

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.activities.map((activity) => activity.name)).toEqual(['Run 1', 'Run 2']);
    });

    expect(mockStartAfter).toHaveBeenCalledWith(fakeCursor);
  });

  it('isLoadingMore is true during loadMore, false after', async () => {
    const fakeCursor = createStravaActivityDoc('doc1', { stravaId: 1, name: 'Run 1', uid: 'u1' });

    /** @type {(value: any) => void} */
    let resolveLoadMore;
    /** @type {void|Promise<void>|undefined} */
    let loadMorePromise;

    mockGetDocs.mockResolvedValueOnce({
      docs: [fakeCursor],
    });
    mockAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.activities.map((activity) => activity.name)).toEqual(['Run 1']);
    });

    mockGetDocs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
    );

    act(() => {
      loadMorePromise = result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(true);
    });

    await act(async () => {
      resolveLoadMore({
        docs: [createStravaActivityDoc('doc2', { stravaId: 2, name: 'Run 2', uid: 'u1' })],
      });
      await loadMorePromise;
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });
  });

  it('refresh re-fetches activities from scratch', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [createStravaActivityDoc('doc1', { stravaId: 1, name: 'Run 1', uid: 'u1' })],
    });
    mockAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.activities.map((activity) => activity.name)).toEqual(['Run 1']);
    });

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createStravaActivityDoc('doc1', { stravaId: 1, name: 'Run 1', uid: 'u1' }),
        createStravaActivityDoc('doc2', { stravaId: 2, name: 'Run 2', uid: 'u1' }),
      ],
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.activities.map((activity) => activity.name)).toEqual(['Run 1', 'Run 2']);
    });

    expect(mockGetDocs.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        path: 'stravaActivities',
        constraints: expect.arrayContaining([
          expect.objectContaining({ type: 'where', field: 'uid', value: 'u1' }),
          expect.objectContaining({ type: 'limit', count: 10 }),
        ]),
      }),
    );
  });

  it('loadMore guards against concurrent calls', async () => {
    const fakeCursor = createStravaActivityDoc('doc1', { stravaId: 1, name: 'Run 1', uid: 'u1' });

    /** @type {(value: any) => void} */
    let resolveLoadMore;
    /** @type {void|Promise<void>|undefined} */
    let loadMorePromise;

    mockGetDocs.mockResolvedValueOnce({
      docs: [fakeCursor],
    });
    mockAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    const useStravaActivities = await loadHook();
    const { result } = renderHook(() => useStravaActivities());

    await waitFor(() => {
      expect(result.current.activities.map((activity) => activity.name)).toEqual(['Run 1']);
    });

    mockGetDocs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
    );

    act(() => {
      loadMorePromise = result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(true);
    });

    act(() => {
      result.current.loadMore();
    });

    expect(mockGetDocs.mock.calls[2]).toBeUndefined();

    await act(async () => {
      resolveLoadMore({
        docs: [createStravaActivityDoc('doc2', { stravaId: 2, name: 'Run 2', uid: 'u1' })],
      });
      await loadMorePromise;
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });
  });
});
