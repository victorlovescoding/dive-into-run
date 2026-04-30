import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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

vi.mock('@/config/client/firebase-client', () => ({
  db: 'mock-db',
}));

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
 * @returns {Promise<typeof import('@/runtime/hooks/useStravaConnection').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useStravaConnection')).default;
}

describe('useStravaConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockUseContext.mockReset();
    mockAuth(null);
  });

  it('shows loading initially then displays connection data', async () => {
    const unsubscribe = vi.fn();

    /** @type {(snapshot: any) => void} */
    let snapshotHandler;
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      snapshotHandler = onNext;
      return unsubscribe;
    });

    mockAuth({
      uid: 'u1',
      name: 'User',
      email: null,
      photoURL: null,
    });

    const useStravaConnection = await loadHook();
    const { result } = renderHook(() => useStravaConnection());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      snapshotHandler({
        exists: () => true,
        data: () => ({
          connected: true,
          athleteId: 12345,
          athleteName: 'Test Runner',
          connectedAt: { toDate: () => new Date() },
          lastSyncAt: null,
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.connection?.athleteName).toBe('Test Runner');
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'stravaConnections', 'u1');
  });

  it('shows none when user is not logged in', async () => {
    const useStravaConnection = await loadHook();
    const { result } = renderHook(() => useStravaConnection());

    expect(result.current.connection).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('shows none when connection is null', async () => {
    /** @type {(snapshot: any) => void} */
    let snapshotHandler;
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      snapshotHandler = onNext;
      return vi.fn();
    });

    mockAuth({
      uid: 'u2',
      name: 'User2',
      email: null,
      photoURL: null,
    });

    const useStravaConnection = await loadHook();
    const { result } = renderHook(() => useStravaConnection());

    await act(async () => {
      snapshotHandler({
        exists: () => false,
      });
    });

    await waitFor(() => {
      expect(result.current.connection).toBeNull();
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('cleans up listener on unmount', async () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    mockAuth({
      uid: 'u3',
      name: 'User3',
      email: null,
      photoURL: null,
    });

    const useStravaConnection = await loadHook();
    const { unmount } = renderHook(() => useStravaConnection());

    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('handles listener setup error', async () => {
    mockOnSnapshot.mockImplementation(() => {
      throw new Error('Firestore unavailable');
    });

    mockAuth({
      uid: 'u4',
      name: 'User4',
      email: null,
      photoURL: null,
    });

    const useStravaConnection = await loadHook();
    const { result } = renderHook(() => useStravaConnection());

    await waitFor(() => {
      expect(result.current.error).toBe('Strava 連線狀態載入失敗');
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.connection).toBeNull();
  });
});
