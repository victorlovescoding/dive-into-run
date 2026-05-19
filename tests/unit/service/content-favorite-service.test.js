import { describe, expect, it } from 'vitest';
import {
  FAVORITE_CONTENT_TYPES,
  buildFavoritePayload,
  buildFavoriteTargetItem,
  getFavoriteCollectionName,
  getTargetCollectionName,
  normalizeFavoriteDocuments,
  toFavoriteTargetIdSet,
} from '@/service/content-favorite-service';

/**
 * Creates a Firestore-like document snapshot for service tests.
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

describe('content-favorite-service', () => {
  it('builds favorite payloads with only targetId and createdAt', () => {
    const payload = buildFavoritePayload('post-1', 'created-at-value');

    expect(payload).toEqual({
      targetId: 'post-1',
      createdAt: 'created-at-value',
    });
    expect(Object.keys(payload)).toEqual(['targetId', 'createdAt']);
  });

  it('rejects null, undefined, and blank target ids before building a payload', () => {
    expect(() => buildFavoritePayload(asTargetId(null), 'created-at-value')).toThrow(
      'Favorite targetId is required',
    );
    expect(() => buildFavoritePayload(asTargetId(undefined), 'created-at-value')).toThrow(
      'Favorite targetId is required',
    );
    expect(() => buildFavoritePayload('   ', 'created-at-value')).toThrow(
      'Favorite targetId is required',
    );
  });

  it('maps post and event favorite collections and target collections', () => {
    expect(getFavoriteCollectionName(FAVORITE_CONTENT_TYPES.POST)).toBe('favoritePosts');
    expect(getTargetCollectionName(FAVORITE_CONTENT_TYPES.POST)).toBe('posts');
    expect(getFavoriteCollectionName(FAVORITE_CONTENT_TYPES.EVENT)).toBe('favoriteEvents');
    expect(getTargetCollectionName(FAVORITE_CONTENT_TYPES.EVENT)).toBe('events');
  });

  it('normalizes favorite documents while preserving newest-first query order', () => {
    const favorites = normalizeFavoriteDocuments([
      createSnapshot('post-new', { targetId: 'post-new', createdAt: 'new-time' }),
      createSnapshot('post-old', { targetId: 'post-old', createdAt: 'old-time' }),
    ]);

    expect(favorites).toEqual([
      { id: 'post-new', targetId: 'post-new', createdAt: 'new-time' },
      { id: 'post-old', targetId: 'post-old', createdAt: 'old-time' },
    ]);
  });

  it('rejects persisted favorite documents with whitespace-only target ids', () => {
    expect(() =>
      normalizeFavoriteDocuments([
        createSnapshot('blank-target', { targetId: '   ', createdAt: 'new-time' }),
      ]),
    ).toThrow('Favorite targetId is required');
  });

  it('rejects persisted favorite documents with missing target ids', () => {
    expect(() =>
      normalizeFavoriteDocuments([
        createSnapshot('missing-target', { createdAt: 'new-time' }),
      ]),
    ).toThrow('Favorite targetId is required');
  });

  it('builds favorite target id sets from existing favorite status document ids', () => {
    const result = toFavoriteTargetIdSet([
      createSnapshot('post-1', { createdAt: 'time-1' }),
      createSnapshot('post-2', { targetId: 'wrong-payload-id', createdAt: 'time-2' }),
      createSnapshot('post-3', { targetId: 'post-3', createdAt: 'time-3' }, false),
    ]);

    expect(Array.from(result)).toEqual(['post-1', 'post-2']);
  });

  it('skips existing favorite status snapshots with invalid document ids', () => {
    const result = toFavoriteTargetIdSet([
      createSnapshot('   ', { targetId: 'payload-id', createdAt: 'time-1' }),
      createSnapshot('post-1', { createdAt: 'time-2' }),
    ]);

    expect(Array.from(result)).toEqual(['post-1']);
  });

  it('represents missing target documents without dropping the favorite row', () => {
    const result = buildFavoriteTargetItem({
      type: FAVORITE_CONTENT_TYPES.POST,
      favorite: { id: 'post-missing', targetId: 'post-missing', createdAt: 'new-time' },
      targetSnapshot: createSnapshot('post-missing', {}, false),
    });

    expect(result).toEqual({
      type: 'post',
      favoriteId: 'post-missing',
      targetId: 'post-missing',
      createdAt: 'new-time',
      target: null,
      missing: true,
    });
  });
});
