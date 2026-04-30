import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn((_db, ...segments) => ({
  type: 'collection',
  path: segments.join('/'),
}));
const mockWriteBatch = vi.fn();
const mockDoc = vi.fn((base, ...segments) => {
  if (base?.type === 'collection') {
    return {
      type: 'doc',
      path: segments.length > 0 ? [base.path, ...segments].join('/') : `${base.path}/auto-id`,
      id: String(segments.at(-1) ?? 'auto-id'),
    };
  }

  return {
    type: 'doc',
    path: segments.join('/'),
    id: String(segments.at(-1) ?? 'auto-id'),
  };
});
const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockQuery = vi.fn((collectionRef, ...constraints) => ({
  type: 'query',
  path: collectionRef?.path,
  constraints,
}));
const mockWhere = vi.fn((field, op, value) => ({ type: 'where', field, op, value }));
const mockOrderBy = vi.fn((field, dir) => ({ type: 'orderBy', field, dir }));
const mockLimit = vi.fn((count) => ({ type: 'limit', count }));
const mockStartAfter = vi.fn((cursor) => ({ type: 'startAfter', cursor }));
const mockGetDoc = vi.fn();
const mockRunTransaction = vi.fn();
const batch = {
  set: vi.fn(),
  commit: vi.fn(),
};

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  writeBatch: mockWriteBatch,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  getDoc: mockGetDoc,
  runTransaction: mockRunTransaction,
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

const runtime = await import('@/runtime/client/use-cases/notification-use-cases');

/**
 * 建立 comments / participants 查詢用 snapshot。
 * @param {Array<{ id: string, data: object }>} docs - Firestore docs。
 * @returns {{ docs: Array<{ id: string, data: () => object }> }} snapshot。
 */
function createDocsSnapshot(docs) {
  return {
    docs: docs.map((docItem) => ({
      id: docItem.id,
      data: () => docItem.data,
    })),
  };
}

/**
 * 建立 onSnapshot 用 notification snapshot。
 * @param {Array<{ id: string, data: object }>} docs - Firestore docs。
 * @returns {{
 *   docs: Array<{ id: string, data: () => object }>,
 *   docChanges: () => Array<{ type: string, doc: { id: string, data: () => object } }>
 * }} snapshot。
 */
function createNotificationSnapshot(docs) {
  return {
    docs: docs.map((docItem) => ({
      id: docItem.id,
      data: () => docItem.data,
    })),
    docChanges: () => [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  batch.commit.mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue(batch);
});

describe('notification-use-cases split', () => {
  it('notifyPostCommentReply filters recipients in runtime', async () => {
    mockGetDocs.mockImplementation(async (ref) => {
      if (ref.path === 'posts/post-1/comments') {
        return createDocsSnapshot([
          { id: 'd1', data: { authorUid: 'actor' } },
          { id: 'd2', data: { authorUid: 'author' } },
          { id: 'd3', data: { authorUid: 'reply-target' } },
        ]);
      }

      return createDocsSnapshot([]);
    });

    await runtime.notifyPostCommentReply('post-1', '晨跑心得', 'author', 'c1', {
      uid: 'actor',
      name: 'Amy',
      photoURL: 'https://img',
    });

    expect(batch.set.mock.calls).toHaveLength(1);
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications/auto-id' }),
      expect.objectContaining({
        recipientUid: 'reply-target',
        type: 'post_comment_reply',
        entityType: 'post',
        entityId: 'post-1',
        entityTitle: '晨跑心得',
        commentId: 'c1',
        actorUid: 'actor',
        actorName: 'Amy',
        actorPhotoURL: 'https://img',
      }),
    );
    expect(batch.commit.mock.calls).toEqual([[]]);
  });

  it('notifyEventNewComment deduplicates host participants and comment authors in runtime', async () => {
    mockGetDocs.mockImplementation(async (ref) => {
      if (ref.path === 'events/event-1/participants') {
        return createDocsSnapshot([
          { id: 'host', data: { uid: 'host' } },
          { id: 'participant-1', data: { uid: 'participant-1' } },
          { id: 'actor', data: { uid: 'actor' } },
        ]);
      }

      if (ref.path === 'events/event-1/comments') {
        return createDocsSnapshot([
          { id: 'c1', data: { authorUid: 'actor' } },
          { id: 'c2', data: { authorUid: 'participant-1' } },
          { id: 'c3', data: { authorUid: 'commenter-1' } },
        ]);
      }

      return createDocsSnapshot([]);
    });

    await runtime.notifyEventNewComment('event-1', '週末活動', 'host', 'c2', {
      uid: 'actor',
      name: 'Amy',
      photoURL: 'https://img',
    });

    expect(mockGetDocs.mock.calls).toEqual([
      [expect.objectContaining({ path: 'events/event-1/participants' })],
      [expect.objectContaining({ path: 'events/event-1/comments' })],
    ]);
    expect(batch.set.mock.calls).toHaveLength(3);
    expect(batch.set.mock.calls.map((call) => call[1].recipientUid)).toEqual([
      'host',
      'participant-1',
      'commenter-1',
    ]);
    expect(batch.commit.mock.calls).toEqual([[]]);
  });

  it('watchNotifications maps raw documents to notification items', async () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    const unsubscribe = vi.fn();

    /** @type {(snapshot: any) => void} */
    let snapshotHandler;
    mockOnSnapshot.mockImplementation((_query, onNextCallback) => {
      snapshotHandler = onNextCallback;
      return unsubscribe;
    });

    const returnedUnsubscribe = runtime.watchNotifications('u1', onNext, onError);
    snapshotHandler(
      createNotificationSnapshot([
        {
          id: 'n1',
          data: {
            recipientUid: 'u1',
            type: 'post_new_comment',
            actorUid: 'actor-1',
            actorName: 'Amy',
            actorPhotoURL: 'https://img',
            entityType: 'post',
            entityId: 'post-1',
            entityTitle: '晨跑心得',
            commentId: 'c1',
            message: '你的文章有新留言',
            read: false,
            createdAt: 'mock-timestamp',
          },
        },
      ]),
    );

    expect(returnedUnsubscribe).toBe(unsubscribe);
    expect(onNext).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'n1',
          recipientUid: 'u1',
          entityId: 'post-1',
        }),
      ],
      expect.objectContaining({ id: 'n1' }),
    );
  });
});
