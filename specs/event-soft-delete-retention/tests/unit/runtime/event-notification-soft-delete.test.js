import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((...path) => ({ kind: 'collection', path })),
  deleteField: vi.fn(() => ({ kind: 'deleteField' })),
  doc: vi.fn((...path) => ({ kind: 'doc', path })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value) => ({ op: 'limit', value })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ op: 'orderBy', field, direction })),
  query: vi.fn((...args) => ({ kind: 'query', args })),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  startAfter: vi.fn((doc) => ({ op: 'startAfter', doc })),
  Timestamp: {
    fromDate: vi.fn((date) => ({ kind: 'timestamp', iso: date.toISOString() })),
    now: vi.fn(() => ({ kind: 'timestampNow' })),
  },
  updateDoc: vi.fn(),
  where: vi.fn((field, op, value) => ({ op: 'where', field, comparator: op, value })),
  writeBatch: vi.fn(),
}));

const eventsRepoMocks = vi.hoisted(() => ({
  fetchParticipantUids: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: { kind: 'db' } }));
vi.mock('@/repo/client/firebase-events-repo', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchParticipantUids: eventsRepoMocks.fetchParticipantUids,
}));

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

/**
 * Build a minimal Firestore query snapshot mock.
 * @param {Array<object>} docs - Query document snapshots.
 * @returns {{ docs: Array<object> }} Query snapshot mock.
 */
function querySnapshot(docs) {
  return { docs };
}

describe('event notification soft-delete behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.getDoc.mockReset();
    firestoreMocks.getDocs.mockReset();
    firestoreMocks.writeBatch.mockReset();
    eventsRepoMocks.fetchParticipantUids.mockReset();
    eventsRepoMocks.fetchParticipantUids.mockResolvedValue([]);
  });

  it('treats notification-linked soft-deleted event reads as missing', async () => {
    const { fetchEventById } = await import('@/runtime/client/use-cases/event-use-cases');
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('event-1', {
        title: 'Deleted event',
        deletedAt: { seconds: 1 },
      }),
    );

    await expect(fetchEventById('event-1')).resolves.toBeNull();
  });

  it('treats notification-linked soft-deleted event comment reads as missing', async () => {
    const { getCommentById } = await import(
      '@/runtime/client/use-cases/event-comment-use-cases'
    );
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('comment-1', {
        content: 'Deleted comment',
        deletedAt: { seconds: 1 },
      }),
    );

    await expect(getCommentById('event-1', 'comment-1')).resolves.toBeNull();
  });

  it('does not notify a user whose only previous event comment is soft-deleted', async () => {
    const batch = { set: vi.fn(), commit: vi.fn() };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot([
        snapshot('comment-deleted', {
          authorUid: 'previous-commenter',
          deletedAt: { seconds: 1 },
        }),
      ]),
    );

    const { notifyEventNewComment } = await import(
      '@/runtime/client/use-cases/notification-use-cases'
    );
    await notifyEventNewComment('event-1', 'Event title', '', 'comment-new', {
      uid: 'actor',
      name: 'Actor',
      photoURL: '',
    });

    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('notifies a user who still has another active event comment', async () => {
    const batch = { set: vi.fn(), commit: vi.fn() };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot([
        snapshot('comment-deleted', {
          authorUid: 'previous-commenter',
          deletedAt: { seconds: 1 },
        }),
        snapshot('comment-active', {
          authorUid: 'previous-commenter',
        }),
      ]),
    );

    const { notifyEventNewComment } = await import(
      '@/runtime/client/use-cases/notification-use-cases'
    );
    await notifyEventNewComment('event-1', 'Event title', '', 'comment-new', {
      uid: 'actor',
      name: 'Actor',
      photoURL: '',
    });

    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls[0][1]).toMatchObject({
      recipientUid: 'previous-commenter',
      type: 'event_comment_reply',
      entityType: 'event',
      entityId: 'event-1',
      entityTitle: 'Event title',
      commentId: 'comment-new',
      actorUid: 'actor',
    });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
