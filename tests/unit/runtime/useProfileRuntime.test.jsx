import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const {
  mockUseContext,
  mockCollection,
  mockCollectionGroup,
  mockQuery,
  mockWhere,
  mockGetCountFromServer,
} = vi.hoisted(() => ({
  mockUseContext: vi.fn(),
  mockCollection: vi.fn((_db, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  mockCollectionGroup: vi.fn((_db, segment) => ({
    type: 'collectionGroup',
    path: segment,
  })),
  mockQuery: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockGetCountFromServer: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());

  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  query: mockQuery,
  where: mockWhere,
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getCountFromServer: mockGetCountFromServer,
  setDoc: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * 設定 hook 看到的 AuthContext 值。
 * @param {{ uid: string } | null} user - 當前登入者。
 * @returns {void}
 */
function mockAuth(user) {
  mockUseContext.mockReturnValue({
    user: user
      ? {
          name: null,
          email: null,
          photoURL: null,
          bio: null,
          getIdToken: () => Promise.resolve(''),
          ...user,
        }
      : null,
    loading: false,
    setUser() {},
  });
}

/**
 * 建立 getCountFromServer 的回傳 snapshot。
 * @param {number} count - 計數。
 * @returns {{ data: () => { count: number } }} snapshot。
 */
function createCountSnapshot(count) {
  return { data: () => ({ count }) };
}

/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useProfileRuntime').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useProfileRuntime')).default;
}

/**
 * 建立 ProfileRuntimeUser fixture。
 * @param {Partial<{ uid: string, name: string, photoURL: string, bio: string, createdAt: Date | { toDate: () => Date } }>} [overrides] - 覆寫欄位。
 * @returns {{ uid: string, name: string, photoURL: string, bio: string, createdAt: Date | { toDate: () => Date } }} profile user。
 */
function createProfileUser(overrides = {}) {
  return {
    uid: 'profile-uid',
    name: 'Profile Name',
    photoURL: 'https://example.com/photo.png',
    bio: 'hello',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** @type {ReturnType<typeof vi.spyOn> | undefined} */
let consoleErrorSpy;

describe('useProfileRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockUseContext.mockReset();
    mockAuth(null);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
  });

  it('fetches profile stats and exposes hosted/joined counts on success', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(3))
      .mockResolvedValueOnce(createCountSnapshot(7));
    mockAuth({ uid: 'viewer-uid' });

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ uid: 'profile-uid' });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    expect(result.current.isStatsLoading).toBe(true);
    expect(result.current.stats).toBeNull();
    expect(result.current.profileUid).toBe('profile-uid');
    expect(result.current.headerUser.name).toBe('Profile Name');
    expect(typeof result.current.headerUser.createdAt.toDate).toBe('function');

    await waitFor(() => {
      expect(result.current.isStatsLoading).toBe(false);
    });

    expect(result.current.stats).toEqual({
      hostedCount: 3,
      joinedCount: 7,
      totalDistanceKm: null,
    });
    expect(result.current.statsError).toBeNull();
    expect(result.current.isSelf).toBe(false);
    expect(mockWhere).toHaveBeenCalledWith('hostUid', '==', 'profile-uid');
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'profile-uid');
  });

  it('marks isSelf as true when viewer uid matches profile uid', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(0))
      .mockResolvedValueOnce(createCountSnapshot(0));
    mockAuth({ uid: 'profile-uid' });

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ uid: 'profile-uid' });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.isStatsLoading).toBe(false);
    });

    expect(result.current.isSelf).toBe(true);
  });

  it('keeps isSelf false and still fetches stats when no user is signed in', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(2))
      .mockResolvedValueOnce(createCountSnapshot(4));
    mockAuth(null);

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ uid: 'profile-uid' });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.isStatsLoading).toBe(false);
    });

    expect(result.current.isSelf).toBe(false);
    expect(result.current.stats).toEqual({
      hostedCount: 2,
      joinedCount: 4,
      totalDistanceKm: null,
    });
    expect(result.current.statsError).toBeNull();
  });

  it('exposes statsError and clears stats when getProfileStats rejects', async () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetCountFromServer.mockRejectedValueOnce(new Error('Firestore error'));
    mockAuth({ uid: 'viewer-uid' });

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ uid: 'profile-uid' });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.statsError).toBe('無法載入統計');
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.isStatsLoading).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('wraps Date createdAt with toDate adapter for ProfileHeader', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(0))
      .mockResolvedValueOnce(createCountSnapshot(0));
    mockAuth(null);

    const useProfileRuntime = await loadHook();
    const createdAt = new Date('2024-05-06T12:34:56Z');
    const profileUser = createProfileUser({ createdAt });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    expect(result.current.headerUser.createdAt.toDate()).toEqual(createdAt);
  });

  it('passes through Firestore-like createdAt without re-wrapping', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(0))
      .mockResolvedValueOnce(createCountSnapshot(0));
    mockAuth(null);

    const useProfileRuntime = await loadHook();
    const expectedDate = new Date('2024-06-07T08:09:10Z');
    const firestoreLike = { toDate: () => expectedDate };
    const profileUser = createProfileUser({ createdAt: firestoreLike });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    expect(result.current.headerUser.createdAt).toBe(firestoreLike);
    expect(result.current.headerUser.createdAt.toDate()).toEqual(expectedDate);
  });
});
