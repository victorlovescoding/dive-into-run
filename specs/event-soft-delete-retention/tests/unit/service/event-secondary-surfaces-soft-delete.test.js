import { describe, expect, it, vi } from 'vitest';
import {
  buildMyEventsPage,
} from '@/service/member-dashboard-service';
import {
  FAVORITE_CONTENT_TYPES,
  buildFavoriteTargetItem,
} from '@/service/content-favorite-service';

vi.mock('@/config/server/firebase-admin-app', () => ({ adminDb: {} }));

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

/**
 * Build a fake parent document ref.
 * @param {'posts' | 'events'} collectionId - Parent collection id.
 * @param {string} id - Parent document id.
 * @returns {{ id: string, path: string, parent: { id: string } }} Parent ref.
 */
function parentRef(collectionId, id) {
  return {
    id,
    path: `${collectionId}/${id}`,
    parent: { id: collectionId },
  };
}

/**
 * Build a fake parent document snapshot.
 * @param {boolean} exists - Whether the parent document exists.
 * @param {Record<string, unknown>} [data] - Parent payload.
 * @returns {{ exists: boolean, data: () => Record<string, unknown> }} Parent snapshot.
 */
function parentSnapshot(exists, data = {}) {
  return {
    exists,
    data: () => data,
  };
}

/**
 * Build a fake Admin SDK collectionGroup comment snapshot.
 * @param {string} id - Comment id.
 * @param {{ id: string, path: string, parent: { id: string } }} parent - Parent doc ref.
 * @param {Record<string, unknown>} data - Comment payload.
 * @returns {{ id: string, exists: boolean, ref: { path: string, parent: { parent: object } }, data: () => Record<string, unknown> }} Comment snapshot.
 */
function commentSnapshot(id, parent, data) {
  return {
    id,
    exists: true,
    ref: {
      path: `${parent.path}/comments/${id}`,
      parent: { parent },
    },
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

  it('hides event comments whose parent event is missing or soft-deleted', async () => {
    const { buildVisibleMemberCommentDocuments } = await import(
      '@/repo/server/firebase-member-comments-server-repo'
    );
    const activeEvent = parentRef('events', 'active-event');
    const deletedEvent = parentRef('events', 'deleted-event');
    const missingEvent = parentRef('events', 'missing-event');
    const parentSnapshots = new Map([
      [activeEvent.path, parentSnapshot(true, { title: 'Active event' })],
      [
        deletedEvent.path,
        parentSnapshot(true, {
          title: 'Deleted event',
          deletedAt: { seconds: 1 },
        }),
      ],
    ]);

    const documents = await buildVisibleMemberCommentDocuments(
      [
        commentSnapshot('active-event-comment', activeEvent, {
          authorUid: 'user-1',
          content: 'Visible event comment',
          createdAt: { seconds: 3 },
        }),
        commentSnapshot('deleted-event-comment', deletedEvent, {
          authorUid: 'user-1',
          content: 'Hidden deleted event parent',
          createdAt: { seconds: 2 },
        }),
        commentSnapshot('missing-event-comment', missingEvent, {
          authorUid: 'user-1',
          content: 'Hidden missing event parent',
          createdAt: { seconds: 1 },
        }),
      ],
      {
        fetchParentSnapshot: async (ref) => parentSnapshots.get(ref.path) ?? parentSnapshot(false),
      },
    );

    expect(documents.map((document) => document.id)).toEqual(['active-event-comment']);
    expect(documents[0]).toMatchObject({
      source: 'event',
      parentId: 'active-event',
      parentTitle: 'Active event',
      data: {
        authorUid: 'user-1',
        content: 'Visible event comment',
        createdAt: { seconds: 3 },
      },
      cursor: 'events/active-event/comments/active-event-comment',
    });
  });
});
