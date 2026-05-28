import { describe, expect, it } from 'vitest';
import {
  FAVORITE_CONTENT_TYPES,
  buildFavoriteTargetItem,
} from '@/service/content-favorite-service';

/**
 * Build a minimal Firestore document snapshot mock.
 * @param {string} id - Document ID.
 * @param {object} data - Snapshot data.
 * @param {boolean} [exists] - Whether the document exists.
 * @returns {{ id: string, exists: () => boolean, data: () => object }} Snapshot mock.
 */
function snapshot(id, data, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => data,
  };
}

describe('content favorite soft delete targets', () => {
  it('treats soft-deleted post targets as missing', () => {
    const item = buildFavoriteTargetItem({
      type: FAVORITE_CONTENT_TYPES.POST,
      favorite: { id: 'favorite-post-1', targetId: 'post-1', createdAt: { seconds: 3 } },
      targetSnapshot: snapshot('post-1', {
        title: 'Deleted post',
        deletedAt: { seconds: 1 },
      }),
    });

    expect(item).toEqual({
      type: FAVORITE_CONTENT_TYPES.POST,
      favoriteId: 'favorite-post-1',
      targetId: 'post-1',
      createdAt: { seconds: 3 },
      target: null,
      missing: true,
    });
  });

  it('keeps event favorites unchanged when the target exists', () => {
    const item = buildFavoriteTargetItem({
      type: FAVORITE_CONTENT_TYPES.EVENT,
      favorite: { id: 'favorite-event-1', targetId: 'event-1', createdAt: { seconds: 4 } },
      targetSnapshot: snapshot('event-1', {
        title: 'Event',
        deletedAt: { seconds: 1 },
      }),
    });

    expect(item).toEqual({
      type: FAVORITE_CONTENT_TYPES.EVENT,
      favoriteId: 'favorite-event-1',
      targetId: 'event-1',
      createdAt: { seconds: 4 },
      target: {
        id: 'event-1',
        title: 'Event',
        deletedAt: { seconds: 1 },
      },
      missing: false,
    });
  });
});
