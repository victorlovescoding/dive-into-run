import { describe, expect, it } from 'vitest';
import {
  buildMyEventsPage,
} from '@/service/member-dashboard-service';
import {
  FAVORITE_CONTENT_TYPES,
  buildFavoriteTargetItem,
} from '@/service/content-favorite-service';

/**
 * Build a minimal favorite target snapshot.
 * @param {string} id - Snapshot ID.
 * @param {object} data - Snapshot data.
 * @param {boolean} [exists] - Whether the target exists.
 * @returns {{ id: string, exists: () => boolean, data: () => object }} Snapshot double.
 */
function targetSnapshot(id, data, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => data,
  };
}

describe('event secondary surfaces soft-delete filtering', () => {
  it('hides deleted member events and backfills the visible page from later active events', () => {
    const result = buildMyEventsPage(
      [
        {
          id: 'deleted-newest',
          data: {
            title: 'Deleted newest',
            time: { seconds: 30 },
            deletedAt: { seconds: 1 },
          },
        },
        {
          id: 'active-middle',
          data: {
            title: 'Active middle',
            time: { seconds: 20 },
          },
        },
        {
          id: 'active-oldest',
          data: {
            title: 'Active oldest',
            time: { seconds: 10 },
          },
        },
      ],
      ['deleted-newest', 'active-middle'],
      2,
    );

    expect(result.items.map((event) => event.id)).toEqual(['active-middle', 'active-oldest']);
    expect(result.nextCursor).toBeNull();
    expect(result.allEvents.map((event) => event.id)).toEqual(['active-middle', 'active-oldest']);
    expect(result.hostedIds).toEqual(new Set(['deleted-newest', 'active-middle']));
  });

  it('treats soft-deleted event favorite targets as missing', () => {
    const favorite = {
      id: 'event-1',
      targetId: 'event-1',
      createdAt: { seconds: 1 },
    };

    expect(
      buildFavoriteTargetItem({
        type: FAVORITE_CONTENT_TYPES.EVENT,
        favorite,
        targetSnapshot: targetSnapshot('event-1', {
          title: 'Deleted event',
          deletedAt: { seconds: 2 },
        }),
      }),
    ).toEqual({
      type: FAVORITE_CONTENT_TYPES.EVENT,
      favoriteId: 'event-1',
      targetId: 'event-1',
      createdAt: { seconds: 1 },
      target: null,
      missing: true,
    });
  });
});
