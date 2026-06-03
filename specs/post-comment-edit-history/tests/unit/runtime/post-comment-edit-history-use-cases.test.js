import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn((...path) => ({ kind: 'collection', path })),
  limit: vi.fn((value) => ({ op: 'limit', value })),
  query: vi.fn((...args) => ({ kind: 'query', args })),
  orderBy: vi.fn((field, direction) => ({ op: 'orderBy', field, direction })),
  doc: vi.fn((...path) => ({
    kind: 'doc',
    path,
    ...(path.length === 1 && path[0]?.kind === 'collection' ? { id: 'generated-history-id' } : {}),
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((value) => ({ op: 'increment', value })),
  collectionGroup: vi.fn((...path) => ({ kind: 'collectionGroup', path })),
  where: vi.fn((field, op, value) => ({ op: 'where', field, comparator: op, value })),
  startAfter: vi.fn((...values) => ({ op: 'startAfter', values })),
  documentId: vi.fn(() => '__name__'),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: { kind: 'db' } }));

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

describe('post comment edit history use cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.addDoc.mockReset();
    firestoreMocks.updateDoc.mockReset();
    firestoreMocks.getDoc.mockReset();
    firestoreMocks.getDocs.mockReset();
    firestoreMocks.runTransaction.mockReset();
  });

  it('updates a post comment by writing history and the parent comment in one transaction', async () => {
    const { updateComment } = await import('@/runtime/client/use-cases/post-use-cases');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(snapshot('comment-1', { comment: 'old comment' })),
      set: vi.fn(),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await updateComment('post-1', 'comment-1', {
      comment: '  new comment  ',
      currentComment: 'old comment',
    });

    const commentRef = {
      kind: 'doc',
      path: [{ kind: 'db' }, 'posts', 'post-1', 'comments', 'comment-1'],
    };
    const historyDocRef = {
      kind: 'doc',
      path: [
        {
          kind: 'collection',
          path: [{ kind: 'db' }, 'posts', 'post-1', 'comments', 'comment-1', 'history'],
        },
      ],
      id: 'generated-history-id',
    };

    expect(firestoreMocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(tx.get).toHaveBeenCalledWith(commentRef);
    expect(tx.set).toHaveBeenCalledWith(historyDocRef, {
      content: 'old comment',
      editedAt: { kind: 'serverTimestamp' },
    });
    expect(tx.update).toHaveBeenCalledWith(commentRef, {
      comment: 'new comment',
      updatedAt: { kind: 'serverTimestamp' },
      isEdited: true,
      lastEditHistoryId: 'generated-history-id',
    });
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
  });

  it('writes history content from the transaction snapshot when currentComment is stale', async () => {
    const { updateComment } = await import('@/runtime/client/use-cases/post-use-cases');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(
        snapshot('comment-1', {
          comment: 'server current comment',
        }),
      ),
      set: vi.fn(),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await updateComment('post-1', 'comment-1', {
      comment: 'new comment',
      currentComment: 'stale client comment',
    });

    expect(tx.set).toHaveBeenCalledWith(
      {
        kind: 'doc',
        path: [
          {
            kind: 'collection',
            path: [{ kind: 'db' }, 'posts', 'post-1', 'comments', 'comment-1', 'history'],
          },
        ],
        id: 'generated-history-id',
      },
      {
        content: 'server current comment',
        editedAt: { kind: 'serverTimestamp' },
      },
    );
    expect(tx.update).toHaveBeenCalledWith(
      {
        kind: 'doc',
        path: [{ kind: 'db' }, 'posts', 'post-1', 'comments', 'comment-1'],
      },
      {
        comment: 'new comment',
        updatedAt: { kind: 'serverTimestamp' },
        isEdited: true,
        lastEditHistoryId: 'generated-history-id',
      },
    );
  });

  it('does not write history when the transaction snapshot already has the requested comment', async () => {
    const { updateComment } = await import('@/runtime/client/use-cases/post-use-cases');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(
        snapshot('comment-1', {
          comment: 'new comment',
        }),
      ),
      set: vi.fn(),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await updateComment('post-1', 'comment-1', {
      comment: ' new comment ',
      currentComment: 'stale client comment',
    });

    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects empty post comment edits before writing to the repo', async () => {
    const { updateComment } = await import('@/runtime/client/use-cases/post-use-cases');

    await expect(
      updateComment('post-1', 'comment-1', {
        comment: '   ',
        currentComment: 'old comment',
      }),
    ).rejects.toThrow('updateComment: comment is required');

    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
  });

  it('rejects unchanged post comment edits before writing to the repo', async () => {
    const { updateComment } = await import('@/runtime/client/use-cases/post-use-cases');

    await expect(
      updateComment('post-1', 'comment-1', {
        comment: '  same comment  ',
        currentComment: 'same comment',
      }),
    ).rejects.toThrow('updateComment: content unchanged');

    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
  });

  it('requires the current post comment text before writing edit history', async () => {
    const { updateComment } = await import('@/runtime/client/use-cases/post-use-cases');
    const missingCurrentCommentPayload = /** @type {{ comment: string, currentComment: string }} */ ({
      comment: 'new comment',
    });

    await expect(
      updateComment('post-1', 'comment-1', missingCurrentCommentPayload),
    ).rejects.toThrow('updateComment: currentComment is required');

    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
  });

  it('returns modal-ready post comment history ordered by editedAt ascending', async () => {
    const { fetchCommentHistory } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDoc.mockResolvedValueOnce(snapshot('comment-1', { comment: 'current' }));
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot([
        snapshot('history-1', {
          content: 'oldest comment',
          editedAt: { seconds: 1 },
          ignored: true,
        }),
        snapshot('history-2', {
          content: 'newer comment',
          editedAt: { seconds: 2 },
        }),
      ]),
    );

    await expect(fetchCommentHistory('post-1', 'comment-1')).resolves.toEqual([
      { id: 'history-1', content: 'oldest comment', editedAt: { seconds: 1 } },
      { id: 'history-2', content: 'newer comment', editedAt: { seconds: 2 } },
    ]);

    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('editedAt', 'asc');
    expect(firestoreMocks.query).toHaveBeenCalledWith(
      {
        kind: 'collection',
        path: [{ kind: 'db' }, 'posts', 'post-1', 'comments', 'comment-1', 'history'],
      },
      { op: 'orderBy', field: 'editedAt', direction: 'asc' },
    );
  });

  it('does not return retained history for a soft-deleted post comment', async () => {
    const { fetchCommentHistory } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('comment-1', {
        comment: 'deleted comment',
        deletedAt: { seconds: 1 },
      }),
    );
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot([snapshot('history-1', { content: 'old', editedAt: { seconds: 1 } })]),
    );

    await expect(fetchCommentHistory('post-1', 'comment-1')).resolves.toEqual([]);

    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });
});
