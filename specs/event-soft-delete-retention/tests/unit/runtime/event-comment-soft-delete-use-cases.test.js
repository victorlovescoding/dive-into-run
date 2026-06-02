import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clientState = vi.hoisted(() => ({
  auth: {
    currentUser: { uid: 'actor-1' },
  },
}));

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((...path) => ({ kind: 'collection', path })),
  doc: vi.fn((...path) => ({ kind: 'doc', path })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value) => ({ op: 'limit', value })),
  orderBy: vi.fn((field, direction) => ({ op: 'orderBy', field, direction })),
  query: vi.fn((...args) => ({ kind: 'query', args })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  startAfter: vi.fn((cursor) => ({ op: 'startAfter', cursor })),
  Timestamp: {
    fromDate: vi.fn((date) => ({ kind: 'timestamp', iso: date.toISOString() })),
    now: vi.fn(() => ({ kind: 'timestampNow' })),
  },
  writeBatch: vi.fn(),
}));

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({
  auth: clientState.auth,
  db: { kind: 'db' },
}));

/**
 * Build a minimal Firestore document snapshot mock.
 * @param {string} id - Document ID.
 * @param {object} data - Snapshot data.
 * @param {boolean} [exists] - Whether the document exists.
 * @returns {import('firebase/firestore').DocumentSnapshot & { ref: object }} Snapshot mock.
 */
function snapshot(id, data, exists = true) {
  return /** @type {import('firebase/firestore').DocumentSnapshot & { ref: object }} */ ({
    id,
    exists: () => exists,
    data: () => data,
    ref: { kind: 'docRef', id },
  });
}

/**
 * Build a minimal Firestore query snapshot mock.
 * @param {Array<object>} docs - Query document snapshots.
 * @returns {{ docs: Array<object> }} Query snapshot mock.
 */
function querySnapshot(docs) {
  return { docs };
}

describe('event comment soft-delete use cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T03:04:05.006Z'));
    vi.clearAllMocks();
    clientState.auth.currentUser = { uid: 'actor-1' };
    firestoreMocks.addDoc.mockReset();
    firestoreMocks.getDoc.mockReset();
    firestoreMocks.getDocs.mockReset();
    firestoreMocks.runTransaction.mockReset();
    firestoreMocks.writeBatch.mockReset();
    firestoreMocks.writeBatch.mockReturnValue({
      commit: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('soft deletes only the event comment document and leaves history retained', async () => {
    const { deleteEventCommentDocument } = await import(
      '@/repo/client/firebase-event-comments-repo'
    );
    const tx = {
      delete: vi.fn(),
      get: vi.fn().mockResolvedValueOnce(snapshot('comment-1', { authorUid: 'commenter-1' })),
      set: vi.fn(),
      update: vi.fn(),
    };
    firestoreMocks.getDocs.mockResolvedValue(querySnapshot([]));
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deleteEventCommentDocument('event-1', 'comment-1')).resolves.toBeUndefined();

    const expectedDeletedAt = new Date('2026-05-28T03:04:05.006Z');
    const expectedDeletedPurgeAt = new Date(expectedDeletedAt.getTime() + RETENTION_MS);

    expect(tx.update).toHaveBeenCalledWith(
      { kind: 'doc', path: [{ kind: 'db' }, 'events', 'event-1', 'comments', 'comment-1'] },
      {
        deletedAt: expectedDeletedAt,
        deletedByUid: 'actor-1',
        deletedPurgeAt: expectedDeletedPurgeAt,
      },
    );
    const [, payload] = tx.update.mock.calls[0];
    expect(payload.deletedAt).toBeInstanceOf(Date);
    expect(payload.deletedPurgeAt).toBeInstanceOf(Date);
    expect(payload.deletedPurgeAt.getTime() - payload.deletedAt.getTime()).toBe(RETENTION_MS);
    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });

  it('treats repeated event comment delete as a no-op success', async () => {
    const { deleteEventCommentDocument } = await import(
      '@/repo/client/firebase-event-comments-repo'
    );
    const tx = {
      delete: vi.fn(),
      get: vi.fn().mockResolvedValueOnce(
        snapshot('comment-1', {
          authorUid: 'commenter-1',
          deletedAt: { seconds: 1 },
          deletedByUid: 'first-actor',
          deletedPurgeAt: { seconds: 2 },
        }),
      ),
      update: vi.fn(),
    };
    firestoreMocks.getDocs.mockResolvedValue(querySnapshot([]));
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deleteEventCommentDocument('event-1', 'comment-1')).resolves.toBeUndefined();

    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
    expect(firestoreMocks.serverTimestamp).not.toHaveBeenCalled();
    expect(firestoreMocks.Timestamp.fromDate).not.toHaveBeenCalled();
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });

  it('returns null for a soft-deleted event comment lookup', async () => {
    const { getCommentById } = await import(
      '@/runtime/client/use-cases/event-comment-use-cases'
    );
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('comment-1', {
        content: 'Deleted',
        createdAt: { seconds: 1 },
        deletedAt: { seconds: 2 },
      }),
    );

    await expect(getCommentById('event-1', 'comment-1')).resolves.toBeNull();
  });

  it('rejects stale edits for soft-deleted event comments before writing history', async () => {
    const { updateComment } = await import(
      '@/runtime/client/use-cases/event-comment-use-cases'
    );
    const tx = {
      get: vi.fn().mockResolvedValueOnce(
        snapshot('comment-1', {
          content: 'Deleted',
          createdAt: { seconds: 1 },
          deletedAt: { seconds: 2 },
        }),
      ),
      set: vi.fn(),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(
      updateComment('event-1', 'comment-1', 'new content', 'old content'),
    ).rejects.toThrow('Comment not found');
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('does not return retained history for a soft-deleted event comment', async () => {
    const { fetchCommentHistory } = await import(
      '@/runtime/client/use-cases/event-comment-use-cases'
    );
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('comment-1', {
        content: 'Deleted',
        createdAt: { seconds: 1 },
        deletedAt: { seconds: 2 },
      }),
    );
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot([snapshot('history-1', { content: 'old', editedAt: { seconds: 1 } })]),
    );

    await expect(fetchCommentHistory('event-1', 'comment-1')).resolves.toEqual([]);
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('backfills comment pagination after deleted raw records', async () => {
    const { fetchComments } = await import(
      '@/runtime/client/use-cases/event-comment-use-cases'
    );
    const rawDeleted = snapshot('deleted-1', {
      content: 'Deleted',
      createdAt: { seconds: 4 },
      deletedAt: { seconds: 1 },
    });
    const rawActiveOne = snapshot('active-1', {
      content: 'Active one',
      createdAt: { seconds: 3 },
    });
    const rawActiveTwo = snapshot('active-2', {
      content: 'Active two',
      createdAt: { seconds: 2 },
    });
    firestoreMocks.getDocs
      .mockResolvedValueOnce(querySnapshot([rawDeleted, rawActiveOne]))
      .mockResolvedValueOnce(querySnapshot([rawActiveTwo]));

    await expect(fetchComments('event-1', { limitCount: 2 })).resolves.toEqual({
      comments: [
        { id: 'active-1', content: 'Active one', createdAt: { seconds: 3 } },
        { id: 'active-2', content: 'Active two', createdAt: { seconds: 2 } },
      ],
      lastDoc: rawActiveTwo,
    });
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(rawActiveOne);
  });

  it('returns no cursor when pagination ends with only deleted raw comments', async () => {
    const { fetchComments } = await import(
      '@/runtime/client/use-cases/event-comment-use-cases'
    );
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot([
        snapshot('deleted-1', {
          content: 'Deleted newer',
          createdAt: { seconds: 4 },
          deletedAt: { seconds: 1 },
        }),
        snapshot('deleted-2', {
          content: 'Deleted older',
          createdAt: { seconds: 3 },
          deletedAt: { seconds: 1 },
        }),
      ]),
    );

    await expect(fetchComments('event-1', { limitCount: 3 })).resolves.toEqual({
      comments: [],
      lastDoc: null,
    });
  });

  it('uses the caller-provided cursor before backfilling more comment pages', async () => {
    const { fetchComments } = await import(
      '@/runtime/client/use-cases/event-comment-use-cases'
    );
    const callerCursor = snapshot('cursor-1', { createdAt: { seconds: 5 } });
    const rawDeleted = snapshot('deleted-1', {
      content: 'Deleted',
      createdAt: { seconds: 4 },
      deletedAt: { seconds: 1 },
    });
    const rawActive = snapshot('active-1', {
      content: 'Active',
      createdAt: { seconds: 3 },
    });
    firestoreMocks.getDocs
      .mockResolvedValueOnce(querySnapshot([rawDeleted]))
      .mockResolvedValueOnce(querySnapshot([rawActive]));

    await expect(
      fetchComments('event-1', { afterDoc: callerCursor, limitCount: 1 }),
    ).resolves.toEqual({
      comments: [{ id: 'active-1', content: 'Active', createdAt: { seconds: 3 } }],
      lastDoc: rawActive,
    });
    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(1, callerCursor);
    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(2, rawDeleted);
  });
});
