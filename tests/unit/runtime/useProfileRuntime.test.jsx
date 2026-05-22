import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const {
  mockUseContext,
  mockCollection,
  mockCollectionGroup,
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockQuery,
  mockWhere,
  mockGetCountFromServer,
  mockRunTransaction,
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
  mockDoc: vi.fn((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
  })),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockGetCountFromServer: vi.fn(),
  mockRunTransaction: vi.fn(),
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
  collectionGroup: mockCollectionGroup,
  query: mockQuery,
  where: mockWhere,
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  getCountFromServer: mockGetCountFromServer,
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ type: 'serverTimestamp' })),
  runTransaction: mockRunTransaction,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * 設定 hook 看到的 AuthContext 值。
 * @param {{ uid: string, name?: string, photoURL?: string } | null} user - 當前登入者。
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
 * 建立 follow 文件列表 snapshot。
 * @param {Array<{ id: string, data: () => object }>} docs - 文件 snapshots。
 * @returns {{ docs: Array<{ id: string, data: () => object }>, size: number }} query snapshot。
 */
function createDocsSnapshot(docs) {
  return { docs, size: docs.length };
}

/**
 * 建立 follow 文件 snapshot。
 * @param {boolean} exists - 文件是否存在。
 * @returns {{ exists: () => boolean }} doc snapshot。
 */
function createDocSnapshot(exists) {
  return { exists: () => exists };
}

/**
 * 建立會維持 pending 的 promise 控制器。
 * @returns {{ promise: Promise<{ following: boolean, stateChanged: boolean }>, resolve: (value: { following: boolean, stateChanged: boolean }) => void, reject: (error: Error) => void }} deferred。
 */
function createFollowDeferred() {
  /** @type {(value: { following: boolean, stateChanged: boolean }) => void} */
  let resolve = () => {};
  /** @type {(error: Error) => void} */
  let reject = () => {};
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
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
 * @param {Partial<{ uid: string, name: string, photoURL: string, bio: string, createdAt: Date | { toDate: () => Date }, followersCount: number }>} [overrides] - 覆寫欄位。
 * @returns {{ uid: string, name: string, photoURL: string, bio: string, createdAt: Date | { toDate: () => Date }, followersCount?: number }} profile user。
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
    mockGetDoc.mockResolvedValue(createDocSnapshot(false));
    mockGetDocs.mockResolvedValue(createDocsSnapshot([]));
    mockRunTransaction.mockImplementation(() =>
      Promise.resolve({ following: true, stateChanged: false }),
    );
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

  it('exposes public follow counts and list loading for signed-out visitors without a follow button', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(1))
      .mockResolvedValueOnce(createCountSnapshot(2));
    mockGetDocs
      .mockResolvedValueOnce(
        createDocsSnapshot([
          {
            id: 'target-a',
            data: () => ({
              targetUid: 'target-a',
              targetName: 'Target A',
              targetPhotoURL: '',
              createdAt: 'now',
            }),
          },
        ]),
      )
      .mockResolvedValueOnce(
        createDocsSnapshot([
          {
            id: 'follower-a',
            data: () => ({
              followerUid: 'follower-a',
              followerName: 'Follower A',
              followerPhotoURL: '',
              createdAt: 'later',
            }),
          },
        ]),
      );
    mockAuth(null);

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ followersCount: 6 });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.followCounts).toEqual(
        expect.objectContaining({ followersCount: 6, followingCount: 1 }),
      );
    });
    expect(result.current.followControl).toEqual(
      expect.objectContaining({ isVisible: false, isPending: false }),
    );

    await act(async () => {
      await result.current.followListModal.open('followers');
    });

    await waitFor(() => {
      expect(result.current.followListModal).toEqual(
        expect.objectContaining({
          isOpen: true,
          direction: 'followers',
          rows: [expect.objectContaining({ uid: 'follower-a', name: 'Follower A' })],
        }),
      );
    });
  });

  it('optimistically follows and unfollows a non-self profile', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(0))
      .mockResolvedValueOnce(createCountSnapshot(0));
    mockGetDoc.mockResolvedValue(createDocSnapshot(false));
    mockGetDocs.mockResolvedValue(createDocsSnapshot([]));
    mockAuth({ uid: 'viewer-uid', name: 'Viewer Runner', photoURL: '' });

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({
      uid: 'target-uid',
      name: 'Target Runner',
      followersCount: 2,
    });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.followControl).toEqual(
        expect.objectContaining({ isVisible: true, isFollowing: false }),
      );
    });

    await act(async () => {
      await result.current.followControl.onToggle();
    });

    expect(result.current.followControl).toEqual(
      expect.objectContaining({ isFollowing: true, isPending: false, label: '追蹤中' }),
    );
    expect(result.current.followCounts.followersCount).toBe(3);

    mockRunTransaction.mockResolvedValueOnce({ following: false, stateChanged: true });

    await act(async () => {
      await result.current.followControl.onToggle();
    });

    expect(result.current.followControl).toEqual(
      expect.objectContaining({ isFollowing: false, isPending: false }),
    );
    expect(result.current.followCounts.followersCount).toBe(2);
  });

  it('disables the follow button and exposes a pending label while mutation is in flight', async () => {
    const deferred = createFollowDeferred();
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(0))
      .mockResolvedValueOnce(createCountSnapshot(0));
    mockGetDoc.mockResolvedValue(createDocSnapshot(false));
    mockGetDocs.mockResolvedValue(createDocsSnapshot([]));
    mockRunTransaction.mockReturnValueOnce(deferred.promise);
    mockAuth({ uid: 'viewer-uid', name: 'Viewer Runner', photoURL: '' });

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ uid: 'target-uid', followersCount: 0 });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.followControl.isVisible).toBe(true);
    });

    act(() => {
      result.current.followControl.onToggle();
    });

    expect(result.current.followControl).toEqual(
      expect.objectContaining({ isPending: true, label: '追蹤中' }),
    );

    await act(async () => {
      deferred.resolve({ following: true, stateChanged: true });
      await deferred.promise;
    });
  });

  it('rolls back optimistic follow state and exposes a toast when follow fails', async () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(0))
      .mockResolvedValueOnce(createCountSnapshot(0));
    mockGetDoc.mockResolvedValue(createDocSnapshot(false));
    mockGetDocs.mockResolvedValue(createDocsSnapshot([]));
    mockRunTransaction.mockRejectedValueOnce(new Error('write failed'));
    mockAuth({ uid: 'viewer-uid', name: 'Viewer Runner', photoURL: '' });

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ uid: 'target-uid', followersCount: 4 });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.followControl.isVisible).toBe(true);
    });

    await act(async () => {
      await result.current.followControl.onToggle();
    });

    expect(result.current.followControl).toEqual(
      expect.objectContaining({ isFollowing: false, isPending: false }),
    );
    expect(result.current.followCounts.followersCount).toBe(4);
    expect(result.current.toastMessage).toBe('追蹤失敗，請稍後再試。');
  });

  it('hides follow controls for the signed-in profile owner', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(0))
      .mockResolvedValueOnce(createCountSnapshot(0));
    mockGetDocs.mockResolvedValue(createDocsSnapshot([]));
    mockAuth({ uid: 'profile-uid', name: 'Profile Name', photoURL: '' });

    const useProfileRuntime = await loadHook();
    const profileUser = createProfileUser({ uid: 'profile-uid', followersCount: 8 });
    const { result } = renderHook(() => useProfileRuntime(profileUser));

    await waitFor(() => {
      expect(result.current.followCounts.followingCount).toBe(0);
    });

    expect(result.current.followControl).toEqual(
      expect.objectContaining({ isVisible: false, isFollowing: false }),
    );
  });
});
