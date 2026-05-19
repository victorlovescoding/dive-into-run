import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCollection = vi.fn((_db, ...segments) => ({
  type: 'collection',
  path: segments.join('/'),
}));
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn((_db, ...segments) => ({
  type: 'doc',
  path: segments.join('/'),
  id: String(segments.at(-1)),
}));
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockOrderBy = vi.fn((field, direction) => ({ type: 'orderBy', field, direction }));
const mockQuery = vi.fn((collectionRef, ...constraints) => ({
  type: 'query',
  path: collectionRef.path,
  constraints,
}));
const mockServerTimestamp = vi.fn(() => 'mock-server-timestamp');
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  orderBy: mockOrderBy,
  query: mockQuery,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

const runtime = await import('@/runtime/client/use-cases/content-favorite-use-cases');

/**
 * Creates a Firestore-like document snapshot for runtime tests.
 * @param {string} id - Snapshot ID.
 * @param {object} data - Snapshot data.
 * @param {boolean} [exists] - Whether the snapshot exists.
 * @returns {{ id: string, exists: () => boolean, data: () => object }} Snapshot double.
 */
function createSnapshot(id, data, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => data,
  };
}

/**
 * Casts intentionally invalid test input into the public targetId parameter shape.
 * @param {unknown} value - Invalid target ID candidate.
 * @returns {string} Value passed through as the function parameter.
 */
function asTargetId(value) {
  return /** @type {string} */ (value);
}

/**
 * Casts intentionally invalid test input into the public targetIds parameter shape.
 * @param {unknown[]} value - Invalid target ID candidates.
 * @returns {string[]} Values passed through as the function parameter.
 */
function asTargetIds(value) {
  return /** @type {string[]} */ (value);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('content favorite use-cases', () => {
  it('adds post favorites under the owner favoritePosts path with the canonical payload', async () => {
    await runtime.addContentFavorite({
      uid: 'user-1',
      type: runtime.FAVORITE_CONTENT_TYPES.POST,
      targetId: 'post-1',
    });

    expect(mockDoc).toHaveBeenCalledWith(
      'mock-db',
      'users',
      'user-1',
      'favoritePosts',
      'post-1',
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/favoritePosts/post-1' }),
      {
        targetId: 'post-1',
        createdAt: 'mock-server-timestamp',
      },
    );
  });

  it('rejects invalid target ids before adding a favorite document path', async () => {
    await expect(
      runtime.addContentFavorite({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.POST,
        targetId: asTargetId(null),
      }),
    ).rejects.toThrow('Content favorite targetId is required');
    await expect(
      runtime.addContentFavorite({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.POST,
        targetId: asTargetId(undefined),
      }),
    ).rejects.toThrow('Content favorite targetId is required');
    await expect(
      runtime.addContentFavorite({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.POST,
        targetId: '   ',
      }),
    ).rejects.toThrow('Content favorite targetId is required');

    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('removes event favorites from the owner favoriteEvents path', async () => {
    await runtime.removeContentFavorite({
      uid: 'user-1',
      type: runtime.FAVORITE_CONTENT_TYPES.EVENT,
      targetId: 'event-1',
    });

    expect(mockDoc).toHaveBeenCalledWith(
      'mock-db',
      'users',
      'user-1',
      'favoriteEvents',
      'event-1',
    );
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/favoriteEvents/event-1' }),
    );
  });

  it('rejects invalid target ids before deleting a favorite document path', async () => {
    await expect(
      runtime.removeContentFavorite({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.EVENT,
        targetId: asTargetId(null),
      }),
    ).rejects.toThrow('Content favorite targetId is required');
    await expect(
      runtime.removeContentFavorite({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.EVENT,
        targetId: asTargetId(undefined),
      }),
    ).rejects.toThrow('Content favorite targetId is required');
    await expect(
      runtime.removeContentFavorite({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.EVENT,
        targetId: '   ',
      }),
    ).rejects.toThrow('Content favorite targetId is required');

    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('loads favorite docs newest first and preserves the query order', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        createSnapshot('post-new', { targetId: 'post-new', createdAt: 'new-time' }),
        createSnapshot('post-old', { targetId: 'post-old', createdAt: 'old-time' }),
      ],
    });

    const result = await runtime.listContentFavorites({
      uid: 'user-1',
      type: runtime.FAVORITE_CONTENT_TYPES.POST,
    });

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'users', 'user-1', 'favoritePosts');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(result.map((favorite) => favorite.targetId)).toEqual(['post-new', 'post-old']);
  });

  it('returns a target id set for existing favorites in a batch status lookup', async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot('post-1', { createdAt: 'time-1' }))
      .mockResolvedValueOnce(createSnapshot('post-2', {}, false));

    const result = await runtime.getFavoritedTargetIds({
      uid: 'user-1',
      type: runtime.FAVORITE_CONTENT_TYPES.POST,
      targetIds: ['post-1', 'post-2'],
    });

    expect(Array.from(result)).toEqual(['post-1']);
    expect(mockDoc).toHaveBeenCalledWith(
      'mock-db',
      'users',
      'user-1',
      'favoritePosts',
      'post-1',
    );
    expect(mockDoc).toHaveBeenCalledWith(
      'mock-db',
      'users',
      'user-1',
      'favoritePosts',
      'post-2',
    );
  });

  it('rejects invalid target ids before batch status path lookup', async () => {
    await expect(
      runtime.getFavoritedTargetIds({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.POST,
        targetIds: asTargetIds(['post-1', null]),
      }),
    ).rejects.toThrow('Content favorite targetId is required');
    await expect(
      runtime.getFavoritedTargetIds({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.POST,
        targetIds: asTargetIds([undefined]),
      }),
    ).rejects.toThrow('Content favorite targetId is required');
    await expect(
      runtime.getFavoritedTargetIds({
        uid: 'user-1',
        type: runtime.FAVORITE_CONTENT_TYPES.POST,
        targetIds: ['   '],
      }),
    ).rejects.toThrow('Content favorite targetId is required');

    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('resolves latest target documents and keeps missing targets represented', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        createSnapshot('post-1', { targetId: 'post-1', createdAt: 'time-1' }),
        createSnapshot('post-missing', { targetId: 'post-missing', createdAt: 'time-2' }),
      ],
    });
    mockGetDoc
      .mockResolvedValueOnce(
        createSnapshot('post-1', {
          title: 'Latest title',
          content: 'Latest content',
        }),
      )
      .mockResolvedValueOnce(createSnapshot('post-missing', {}, false));

    const result = await runtime.loadContentFavoritesWithTargets({
      uid: 'user-1',
      type: runtime.FAVORITE_CONTENT_TYPES.POST,
    });

    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', 'post-1');
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', 'post-missing');
    expect(result).toEqual([
      {
        type: 'post',
        favoriteId: 'post-1',
        targetId: 'post-1',
        createdAt: 'time-1',
        target: {
          id: 'post-1',
          title: 'Latest title',
          content: 'Latest content',
        },
        missing: false,
      },
      {
        type: 'post',
        favoriteId: 'post-missing',
        targetId: 'post-missing',
        createdAt: 'time-2',
        target: null,
        missing: true,
      },
    ]);
  });
});
