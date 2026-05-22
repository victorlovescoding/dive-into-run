import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn((_db, ...segments) => ({
  type: 'collection',
  path: segments.join('/'),
}));
const mockDoc = vi.fn((_db, ...segments) => ({
  type: 'doc',
  path: segments.join('/'),
  id: String(segments.at(-1)),
}));
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockLimit = vi.fn((count) => ({ type: 'limit', count }));
const mockOnSnapshot = vi.fn();
const mockOrderBy = vi.fn((field, direction) => ({ type: 'orderBy', field, direction }));
const mockQuery = vi.fn((collectionRef, ...constraints) => ({
  type: 'query',
  path: collectionRef.path,
  constraints,
}));
const mockRunTransaction = vi.fn();
const mockServerTimestamp = vi.fn(() => 'mock-server-time');
const mockStartAfter = vi.fn((cursor) => ({ type: 'startAfter', cursor }));
const mockUpdateDoc = vi.fn();
const mockWhere = vi.fn((field, op, value) => ({ type: 'where', field, op, value }));
const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
  orderBy: mockOrderBy,
  query: mockQuery,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
  startAfter: mockStartAfter,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
  writeBatch: mockWriteBatch,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

const runtime = await import('@/runtime/client/use-cases/follow-use-cases');

const follower = {
  uid: 'viewer',
  name: 'Viewer Runner',
  photoURL: 'https://example.test/viewer.png',
};

const target = {
  uid: 'target',
  name: 'Target Runner',
  photoURL: 'https://example.test/target.png',
};

/**
 * Creates a Firestore-like snapshot from the in-memory store.
 * @param {string} path - Document path.
 * @param {Map<string, object>} store - In-memory document store.
 * @returns {{ id: string, exists: () => boolean, data: () => object }} Snapshot double.
 */
function createSnapshot(path, store) {
  return {
    id: String(path.split('/').at(-1)),
    exists: () => store.has(path),
    data: () => ({ ...(store.get(path) || {}) }),
  };
}

/**
 * Creates a transaction double that mutates the provided in-memory store.
 * @param {Map<string, object>} store - In-memory document store.
 * @returns {{
 *   get: (ref: { path: string }) => Promise<{ id: string, exists: () => boolean, data: () => object }>,
 *   set: (ref: { path: string }, payload: object) => void,
 *   update: (ref: { path: string }, payload: object) => void,
 *   delete: (ref: { path: string }) => void
 * }} Transaction double.
 */
function createTransaction(store) {
  return {
    get: async (ref) => createSnapshot(ref.path, store),
    set: (ref, payload) => {
      store.set(ref.path, { ...payload });
    },
    update: (ref, payload) => {
      store.set(ref.path, {
        ...(store.get(ref.path) || {}),
        ...payload,
      });
    },
    delete: (ref) => {
      store.delete(ref.path);
    },
  };
}

/**
 * Seeds the two public user documents used by follow transaction tests.
 * @returns {Map<string, object>} In-memory document store.
 */
function seedUserStore() {
  return new Map([
    ['users/viewer', { uid: 'viewer', followersCount: 0 }],
    ['users/target', { uid: 'target', followersCount: 0 }],
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddDoc.mockResolvedValue({ id: 'notification-id' });
});

describe('follow use-cases', () => {
  it('creates mirrored docs, updates counts, and notifies the target on a new follow', async () => {
    const store = seedUserStore();
    mockRunTransaction.mockImplementation(async (_db, callback) =>
      callback(createTransaction(store)),
    );

    const result = await runtime.followRunner({ follower, target });

    expect(result).toEqual({ following: true, stateChanged: true });
    expect(store.get('users/viewer/following/target')).toMatchObject({
      followerUid: 'viewer',
      targetUid: 'target',
      status: 'following',
    });
    expect(store.get('users/target/followers/viewer')).toMatchObject({
      followerUid: 'viewer',
      targetUid: 'target',
      status: 'following',
    });
    expect(store.get('users/viewer')).not.toHaveProperty('followingCount');
    expect(store.get('users/target')).toMatchObject({ followersCount: 1 });
    expect(mockAddDoc.mock.calls).toHaveLength(1);
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications' }),
      expect.objectContaining({
        recipientUid: 'target',
        type: 'runner_followed',
        actorUid: 'viewer',
        actorName: 'Viewer Runner',
        actorPhotoURL: 'https://example.test/viewer.png',
        entityType: 'user',
        entityId: 'viewer',
        entityTitle: 'Viewer Runner',
        commentId: null,
        message: 'Viewer Runner 已開始追蹤你。',
        read: false,
      }),
    );
  });

  it('keeps repeated follow idempotent and creates no duplicate notification', async () => {
    const store = seedUserStore();
    store.set('users/viewer/following/target', { followerUid: 'viewer', targetUid: 'target' });
    store.set('users/target/followers/viewer', { followerUid: 'viewer', targetUid: 'target' });
    store.set('users/viewer', { uid: 'viewer', followersCount: 0 });
    store.set('users/target', { uid: 'target', followersCount: 1 });
    mockRunTransaction.mockImplementation(async (_db, callback) =>
      callback(createTransaction(store)),
    );

    const result = await runtime.followRunner({ follower, target });

    expect(result).toEqual({ following: true, stateChanged: false });
    expect(store.get('users/viewer')).not.toHaveProperty('followingCount');
    expect(store.get('users/target')).toMatchObject({ followersCount: 1 });
    expect(mockAddDoc.mock.calls).toHaveLength(0);
  });

  it('deletes mirrored docs and decrements counts when unfollowing', async () => {
    const store = seedUserStore();
    store.set('users/viewer/following/target', { followerUid: 'viewer', targetUid: 'target' });
    store.set('users/target/followers/viewer', { followerUid: 'viewer', targetUid: 'target' });
    store.set('users/viewer', { uid: 'viewer', followersCount: 0 });
    store.set('users/target', { uid: 'target', followersCount: 1 });
    mockRunTransaction.mockImplementation(async (_db, callback) =>
      callback(createTransaction(store)),
    );

    const result = await runtime.unfollowRunner({
      followerUid: 'viewer',
      targetUid: 'target',
    });

    expect(result).toEqual({ following: false, stateChanged: true });
    expect(store.has('users/viewer/following/target')).toBe(false);
    expect(store.has('users/target/followers/viewer')).toBe(false);
    expect(store.get('users/viewer')).not.toHaveProperty('followingCount');
    expect(store.get('users/target')).toMatchObject({ followersCount: 0 });
  });

  it('creates a new notification after unfollow then refollow', async () => {
    const store = seedUserStore();
    mockRunTransaction.mockImplementation(async (_db, callback) =>
      callback(createTransaction(store)),
    );

    await runtime.followRunner({ follower, target });
    await runtime.unfollowRunner({ followerUid: 'viewer', targetUid: 'target' });
    await runtime.followRunner({ follower, target });

    expect(mockAddDoc.mock.calls).toHaveLength(2);
  });

  it('rejects self-follow before starting a transaction', async () => {
    await expect(runtime.followRunner({ follower, target: follower })).rejects.toThrow(
      'Self follow is not allowed',
    );

    expect(mockRunTransaction.mock.calls).toHaveLength(0);
    expect(mockAddDoc.mock.calls).toHaveLength(0);
  });

  it('derives following count from the public following subcollection', async () => {
    mockGetDocs.mockResolvedValueOnce({ size: 2, docs: [] });

    const result = await runtime.getRunnerFollowingCount({ uid: 'viewer' });

    expect(result).toBe(2);
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'users', 'viewer', 'following');
  });
});
