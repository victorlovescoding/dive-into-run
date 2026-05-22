import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMemberFollowingRuntime from '@/runtime/hooks/useMemberFollowingRuntime';
import { doc, getDocs, runTransaction } from 'firebase/firestore';

const AUTH_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/AuthProvider');
const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const toastBoundary = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

const authContextValue = vi.hoisted(() => ({
  user: null,
  loading: false,
  setUser: vi.fn(),
}));

const firestoreBoundary = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn((_db, ...segments) => ({
    id: String(segments.at(-1) ?? ''),
    path: segments.join('/'),
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  limit: vi.fn((count) => ({ count })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  query: vi.fn((source, ...constraints) => ({ path: source.path, constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-time'),
  startAfter: vi.fn((cursor) => ({ cursor })),
  updateDoc: vi.fn(),
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
  writeBatch: vi.fn(() => ({
    commit: vi.fn(),
    set: vi.fn(),
  })),
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

vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => toastBoundary,
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    this.setCustomParameters = vi.fn();
  }),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreBoundary);

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getStorage: vi.fn(() => ({})),
}));

const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedRunTransaction = /** @type {import('vitest').Mock} */ (runTransaction);

/**
 * @typedef {object} FollowRow
 * @property {string} uid - Followed runner UID.
 * @property {string} name - Followed runner display name.
 * @property {string} photoURL - Followed runner avatar.
 * @property {unknown} createdAt - Follow creation timestamp.
 */

/**
 * Creates a Firestore-like follow document snapshot.
 * @param {FollowRow} row - Follow row fixture.
 * @returns {{ id: string, data: () => object }} Snapshot double.
 */
function createFollowSnapshot(row) {
  return {
    id: row.uid,
    data: () => ({
      targetUid: row.uid,
      targetName: row.name,
      targetPhotoURL: row.photoURL,
      createdAt: row.createdAt,
    }),
  };
}

/**
 * Creates a Firestore transaction double for an existing follow relationship.
 * @returns {{ get: () => Promise<{ exists: () => boolean, data: () => { followersCount: number } }>, set: import('vitest').Mock, update: import('vitest').Mock, delete: import('vitest').Mock }} Transaction double.
 */
function createUnfollowTransaction() {
  return {
    get: async () => ({
      exists: () => true,
      data: () => ({ followersCount: 1 }),
    }),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Defers a mutation promise for optimistic assertions.
 * @returns {{ promise: Promise<void>, resolve: () => void, reject: (error: Error) => void }} Deferred control.
 */
function createDeferred() {
  /** @type {(value?: void | PromiseLike<void>) => void} */
  let resolve = () => {};
  /** @type {(reason?: Error) => void} */
  let reject = () => {};
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

/**
 * Creates a signed-in member fixture.
 * @returns {{ uid: string, name: string, email: string, photoURL: string, bio: string, getIdToken: () => Promise<string> }} Auth user.
 */
function createUser() {
  return {
    uid: 'viewer-uid',
    name: 'Viewer Runner',
    email: 'viewer@example.test',
    photoURL: 'https://example.test/viewer.png',
    bio: '',
    getIdToken: async () => 'token',
  };
}

/**
 * Renders the member following runtime.
 * @param {{ user?: ReturnType<typeof createUser> | null }} [options] - Render options.
 * @returns {import('@testing-library/react').RenderHookResult<object, unknown>} Hook result.
 */
function renderRuntime({ user = createUser() } = {}) {
  Object.assign(authContextValue, {
    user,
    loading: false,
    setUser: vi.fn(),
  });

  return renderHook(() => useMemberFollowingRuntime());
}

const followingRows = /** @type {FollowRow[]} */ ([
  {
    uid: 'runner-a',
    name: 'Runner A',
    photoURL: 'https://example.test/a.png',
    createdAt: { seconds: 20 },
  },
  {
    uid: 'runner-b',
    name: 'Runner B',
    photoURL: '',
    createdAt: { seconds: 10 },
  },
]);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(authContextValue, {
    user: null,
    loading: false,
    setUser: vi.fn(),
  });
  mockedGetDocs.mockResolvedValue({
    docs: followingRows.map(createFollowSnapshot),
    size: followingRows.length,
  });
  mockedRunTransaction.mockImplementation(async (_db, callback) =>
    callback(createUnfollowTransaction()),
  );
});

describe('useMemberFollowingRuntime', () => {
  it('loads the signed-in viewer following list and derives the displayed count from the list', async () => {
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items.map((item) => item.uid)).toEqual(['runner-a', 'runner-b']);
    });

    expect(result.current.followingCount).toBe(2);
    expect(result.current.requiresSignIn).toBe(false);
    expect(getDocs).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/viewer-uid/following' }),
    );
  });

  it('exposes a signed-out guard and skips following list reads when no member is signed in', async () => {
    const { result } = renderRuntime({ user: null });

    await waitFor(() => {
      expect(result.current.requiresSignIn).toBe(true);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.followingCount).toBe(0);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('optimistically removes a followed runner and keeps it removed after unfollow succeeds', async () => {
    const deferred = createDeferred();
    mockedRunTransaction.mockImplementationOnce((_db, callback) =>
      deferred.promise.then(() => callback(createUnfollowTransaction())),
    );
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    let mutationPromise = /** @type {Promise<void> | undefined} */ (undefined);
    act(() => {
      mutationPromise = result.current.unfollow(result.current.items[0]);
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.uid)).toEqual(['runner-b']);
    });
    expect(result.current.pendingTargetUid).toBe('runner-a');

    await act(async () => {
      deferred.resolve();
      await mutationPromise;
    });

    expect(result.current.items.map((item) => item.uid)).toEqual(['runner-b']);
    expect(result.current.pendingTargetUid).toBeNull();
    expect(doc).toHaveBeenCalledWith({}, 'users', 'viewer-uid', 'following', 'runner-a');
  });

  it('restores the row and shows an error toast when unfollow fails', async () => {
    const deferred = createDeferred();
    mockedRunTransaction.mockReturnValueOnce(deferred.promise);
    const { result } = renderRuntime();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    let mutationPromise = /** @type {Promise<void> | undefined} */ (undefined);
    act(() => {
      mutationPromise = result.current.unfollow(result.current.items[0]);
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.uid)).toEqual(['runner-b']);
    });

    await act(async () => {
      deferred.reject(new Error('unfollow failed'));
      await mutationPromise;
    });

    expect(result.current.items.map((item) => item.uid)).toEqual(['runner-a', 'runner-b']);
    expect(toastBoundary.showToast).toHaveBeenCalledWith(
      '取消追蹤失敗，請稍後再試',
      'error',
    );
  });
});
