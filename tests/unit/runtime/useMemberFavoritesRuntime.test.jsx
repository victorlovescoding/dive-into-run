import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMemberFavoritesRuntime from '@/runtime/hooks/useMemberFavoritesRuntime';

const AUTH_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/AuthProvider');
const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const firestoreBoundary = vi.hoisted(() => ({
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  deleteDoc: vi.fn(),
  doc: vi.fn((_db, ...segments) => ({
    id: String(segments.at(-1) ?? ''),
    path: segments.join('/'),
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  query: vi.fn((source, ...constraints) => ({ path: source.path, constraints })),
  serverTimestamp: vi.fn(() => 'server-time'),
  setDoc: vi.fn(),
}));

const toastBoundary = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

const authContextValue = vi.hoisted(() => ({
  user: null,
  loading: false,
  setUser: vi.fn(),
}));

vi.mock(AUTH_PROVIDER_MODULE, async () => {
  const React = await import('react');
  return {
    AuthContext: React.createContext(authContextValue),
    default: function MockAuthProvider({ children }) {
      return children;
    },
  };
});

vi.mock('firebase/firestore', () => firestoreBoundary);
vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => toastBoundary,
}));

/**
 * @typedef {object} FavoriteFixture
 * @property {string} id - Favorite document ID.
 * @property {string} targetId - Target content ID.
 * @property {unknown} createdAt - Favorite timestamp.
 */

const favoriteStore = {
  favoritePosts: /** @type {FavoriteFixture[]} */ ([]),
  favoriteEvents: /** @type {FavoriteFixture[]} */ ([]),
};

const targetStore = {
  posts: /** @type {Map<string, object | null>} */ (new Map()),
  events: /** @type {Map<string, object | null>} */ (new Map()),
};

const mutationControls = {
  deleteFailure: false,
  restoreFailure: false,
};

/**
 * Creates a Firestore-like snapshot double.
 * @param {string} id - Snapshot ID.
 * @param {object | null} data - Snapshot payload; null means missing doc.
 * @returns {{ id: string, exists: () => boolean, data: () => object }} Snapshot double.
 */
function createSnapshot(id, data) {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

/**
 * Defers a promise so optimistic UI can be asserted before persistence settles.
 * @returns {{ promise: Promise<void>, resolve: () => void }} Deferred control.
 */
function createDeferred() {
  /** @type {(value?: void | PromiseLike<void>) => void} */
  let resolve = () => {};
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

/**
 * Picks a fixture bucket by collection name.
 * @param {string | undefined} collectionName - Firestore collection name.
 * @returns {FavoriteFixture[]} Favorite fixture bucket.
 */
function getFavoritesByCollection(collectionName) {
  return collectionName === 'favoriteEvents'
    ? favoriteStore.favoriteEvents
    : favoriteStore.favoritePosts;
}

/**
 * Replaces a favorite fixture bucket by collection name.
 * @param {string | undefined} collectionName - Firestore collection name.
 * @param {FavoriteFixture[]} favorites - New favorite fixtures.
 * @returns {void}
 */
function setFavoritesByCollection(collectionName, favorites) {
  if (collectionName === 'favoriteEvents') {
    favoriteStore.favoriteEvents = favorites;
    return;
  }
  favoriteStore.favoritePosts = favorites;
}

/**
 * Picks a target fixture map by collection name.
 * @param {string | undefined} collectionName - Firestore collection name.
 * @returns {Map<string, object | null>} Target fixture map.
 */
function getTargetsByCollection(collectionName) {
  return collectionName === 'events' ? targetStore.events : targetStore.posts;
}

/**
 * Renders the member favorites runtime with auth context.
 * @returns {import('@testing-library/react').RenderHookResult<object, unknown>} Hook result.
 */
function renderRuntime() {
  Object.assign(authContextValue, {
    user: {
      uid: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      photoURL: null,
      bio: null,
      getIdToken: vi.fn(async () => 'token-1'),
    },
    loading: false,
    setUser: vi.fn(),
  });

  return renderHook(() => useMemberFavoritesRuntime());
}

beforeEach(() => {
  vi.clearAllMocks();
  favoriteStore.favoritePosts = [
    { id: 'post-new', targetId: 'post-new', createdAt: { seconds: 30 } },
    { id: 'post-missing', targetId: 'post-missing', createdAt: { seconds: 20 } },
    { id: 'post-old', targetId: 'post-old', createdAt: { seconds: 10 } },
  ];
  favoriteStore.favoriteEvents = [
    { id: 'event-new', targetId: 'event-new', createdAt: { seconds: 40 } },
  ];
  targetStore.posts = new Map([
    ['post-new', { title: 'Latest Post Title', excerpt: 'fresh post body' }],
    ['post-missing', null],
    ['post-old', { title: 'Older Post Title', excerpt: 'old post body' }],
  ]);
  targetStore.events = new Map([
    [
      'event-new',
      {
        title: 'Latest Event Title',
        city: '臺北市',
        location: '大安森林公園',
        participantsCount: 7,
      },
    ],
  ]);
  mutationControls.deleteFailure = false;
  mutationControls.restoreFailure = false;

  firestoreBoundary.getDocs.mockImplementation(async (queryRef) => {
    const collectionName = String(queryRef.path).split('/').at(-1);
    return {
      docs: [...getFavoritesByCollection(collectionName)].map((favorite) =>
        createSnapshot(favorite.id, {
          targetId: favorite.targetId,
          createdAt: favorite.createdAt,
        }),
      ),
    };
  });

  firestoreBoundary.getDoc.mockImplementation(async (docRef) => {
    const [collectionName, targetId] = String(docRef.path).split('/').slice(-2);
    return createSnapshot(targetId, getTargetsByCollection(collectionName).get(targetId) ?? null);
  });

  firestoreBoundary.deleteDoc.mockImplementation(async (docRef) => {
    if (mutationControls.deleteFailure) {
      throw new Error('delete failed');
    }
    const [collectionName, targetId] = String(docRef.path).split('/').slice(-2);
    setFavoritesByCollection(
      collectionName,
      getFavoritesByCollection(collectionName).filter(
        (favorite) => favorite.targetId !== targetId,
      ),
    );
  });

  firestoreBoundary.setDoc.mockImplementation(async (docRef, payload) => {
    if (mutationControls.restoreFailure) {
      throw new Error('restore failed');
    }
    const [collectionName, targetId] = String(docRef.path).split('/').slice(-2);
    setFavoritesByCollection(collectionName, [
      {
        id: targetId,
        targetId: payload.targetId,
        createdAt: { seconds: 99 },
      },
      ...getFavoritesByCollection(collectionName),
    ]);
  });
});

describe('useMemberFavoritesRuntime', () => {
  it('loads favorite posts newest first and resolves latest target documents', async () => {
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items.map((item) => item.targetId)).toEqual([
        'post-new',
        'post-missing',
        'post-old',
      ]);
    });

    expect(result.current.items[0].target.title).toBe('Latest Post Title');
    expect(firestoreBoundary.doc).toHaveBeenCalledWith('mock-db', 'posts', 'post-new');
    expect(firestoreBoundary.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  it('loads favorite events when the event tab is selected', async () => {
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items[0]?.targetId).toBe('post-new');
    });

    await act(async () => {
      result.current.selectTab(1);
    });

    await waitFor(() => {
      expect(result.current.activeType).toBe('event');
      expect(result.current.items.map((item) => item.targetId)).toEqual(['event-new']);
    });
    expect(result.current.items[0].target.title).toBe('Latest Event Title');
    expect(firestoreBoundary.doc).toHaveBeenCalledWith('mock-db', 'events', 'event-new');
  });

  it('keeps missing targets visible in the favorite list shape', async () => {
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items.some((item) => item.missing)).toBe(true);
    });

    const missingItem = result.current.items.find((item) => item.targetId === 'post-missing');
    expect(missingItem).toMatchObject({
      type: 'post',
      favoriteId: 'post-missing',
      targetId: 'post-missing',
      target: null,
      missing: true,
    });
  });

  it('removes a favorite optimistically and exposes an undo toast action after success', async () => {
    const deleteDeferred = createDeferred();
    firestoreBoundary.deleteDoc.mockImplementationOnce(async (docRef) => {
      await deleteDeferred.promise;
      const [, targetId] = String(docRef.path).split('/').slice(-2);
      favoriteStore.favoritePosts = favoriteStore.favoritePosts.filter(
        (favorite) => favorite.targetId !== targetId,
      );
    });
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    await act(async () => {
      result.current.removeFavorite(result.current.items[0]);
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.targetId)).toEqual([
        'post-missing',
        'post-old',
      ]);
    });

    deleteDeferred.resolve();

    await waitFor(() => {
      expect(toastBoundary.showToast).toHaveBeenCalledWith(
        '已取消收藏',
        'success',
        expect.objectContaining({ label: '復原', callback: expect.any(Function) }),
      );
    });
  });

  it('undoes a successful remove by restoring and reloading the favorite item', async () => {
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items[0]?.targetId).toBe('post-new');
    });

    await act(async () => {
      await result.current.removeFavorite(result.current.items[0]);
    });

    const undoAction = toastBoundary.showToast.mock.calls.find(
      ([message]) => message === '已取消收藏',
    )?.[2];

    await act(async () => {
      await undoAction.callback();
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.targetId)).toContain('post-new');
    });
    expect(firestoreBoundary.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/favoritePosts/post-new' }),
      { targetId: 'post-new', createdAt: 'server-time' },
    );
  });

  it('rolls back optimistic removal when the remove request fails', async () => {
    mutationControls.deleteFailure = true;
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    await act(async () => {
      await result.current.removeFavorite(result.current.items[0]);
    });

    expect(result.current.items.map((item) => item.targetId)).toEqual([
      'post-new',
      'post-missing',
      'post-old',
    ]);
    expect(toastBoundary.showToast).toHaveBeenCalledWith(
      '取消收藏失敗，請稍後再試',
      'error',
    );
  });

  it('rolls back an optimistic undo restore when restoring the favorite fails', async () => {
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items[0]?.targetId).toBe('post-new');
    });

    await act(async () => {
      await result.current.removeFavorite(result.current.items[0]);
    });

    mutationControls.restoreFailure = true;
    const undoAction = toastBoundary.showToast.mock.calls.find(
      ([message]) => message === '已取消收藏',
    )?.[2];

    await act(async () => {
      await undoAction.callback();
    });

    expect(result.current.items.map((item) => item.targetId)).not.toContain('post-new');
    expect(toastBoundary.showToast).toHaveBeenCalledWith(
      '恢復收藏失敗，請稍後再試',
      'error',
    );
  });
});
