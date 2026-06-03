import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn((...path) => ({ kind: 'collection', path })),
  limit: vi.fn((value) => ({ op: 'limit', value })),
  query: vi.fn((...args) => ({ kind: 'query', args })),
  orderBy: vi.fn((field, direction) => ({ op: 'orderBy', field, direction })),
  doc: vi.fn((...path) => ({ kind: 'doc', path })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((value) => ({ op: 'increment', value })),
  collectionGroup: vi.fn((...path) => ({ kind: 'collectionGroup', path })),
  where: vi.fn((field, op, value) => ({ op: 'where', field, comparator: op, value })),
  writeBatch: vi.fn(),
  startAfter: vi.fn((...values) => ({ op: 'startAfter', values })),
  documentId: vi.fn(() => '__name__'),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  Timestamp: {
    fromDate: vi.fn((date) => ({ kind: 'timestamp', iso: date.toISOString() })),
  },
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

describe('post/comment soft delete use cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.addDoc.mockReset();
    firestoreMocks.updateDoc.mockReset();
    firestoreMocks.getDoc.mockReset();
    firestoreMocks.getDocs.mockReset();
    firestoreMocks.runTransaction.mockReset();
    firestoreMocks.writeBatch.mockReset();
    vi.setSystemTime(new Date('2026-05-28T03:04:05.006Z'));
  });

  it('soft deletes a post document without deleting child collections', async () => {
    const { deletePostTree } = await import('@/repo/client/firebase-posts-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(snapshot('post-1', { authorUid: 'author-1' })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));
    firestoreMocks.getDocs.mockResolvedValue(querySnapshot([]));

    await expect(deletePostTree('post-1')).resolves.toEqual({ ok: true });

    expect(tx.update).toHaveBeenCalledWith(
      { kind: 'doc', path: [{ kind: 'db' }, 'posts', 'post-1'] },
      {
        deletedAt: { kind: 'serverTimestamp' },
        deletedByUid: 'author-1',
        deletedPurgeAt: { kind: 'timestamp', iso: '2026-08-26T03:04:05.006Z' },
      },
    );
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });

  it('treats repeated post delete as a no-op success without rewriting audit fields', async () => {
    const { deletePostTree } = await import('@/repo/client/firebase-posts-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(
        snapshot('post-1', {
          authorUid: 'author-1',
          deletedAt: { seconds: 1 },
          deletedByUid: 'original-actor',
          deletedPurgeAt: { seconds: 2 },
        }),
      ),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deletePostTree('post-1')).resolves.toEqual({ ok: true });

    expect(tx.update).not.toHaveBeenCalled();
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(firestoreMocks.serverTimestamp).not.toHaveBeenCalled();
    expect(firestoreMocks.Timestamp.fromDate).not.toHaveBeenCalled();
  });

  /**
   * Build a full raw post page of soft-deleted records.
   * @param {string} prefix - Snapshot ID prefix.
   * @returns {Array<object>} Deleted post snapshots.
   */
  function deletedPostPage(prefix) {
    return Array.from({ length: 10 }, (_, index) =>
      snapshot(`${prefix}-${index}`, {
        title: `${prefix} ${index}`,
        postAt: { seconds: 20 - index },
        deletedAt: { seconds: 1 },
      }),
    );
  }

  it('soft deletes an active comment once and clamps commentsCount at zero', async () => {
    const { deleteCommentDocument } = await import('@/repo/client/firebase-posts-repo');
    const tx = {
      get: vi
        .fn()
        .mockResolvedValueOnce(snapshot('comment-1', { comment: 'hi' }))
        .mockResolvedValueOnce(snapshot('post-1', { commentsCount: 0 })),
      update: vi.fn(),
      delete: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await deleteCommentDocument('post-1', 'comment-1', 'actor-1');

    expect(tx.update).toHaveBeenCalledWith(
      { kind: 'doc', path: [{ kind: 'db' }, 'posts', 'post-1', 'comments', 'comment-1'] },
      {
        deletedAt: { kind: 'serverTimestamp' },
        deletedByUid: 'actor-1',
        deletedPurgeAt: { kind: 'timestamp', iso: '2026-08-26T03:04:05.006Z' },
      },
    );
    expect(tx.update).toHaveBeenCalledWith(
      { kind: 'doc', path: [{ kind: 'db' }, 'posts', 'post-1'] },
      { commentsCount: 0 },
    );
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('does not decrement commentsCount when deleting an already soft-deleted comment', async () => {
    const { deleteCommentDocument } = await import('@/repo/client/firebase-posts-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(snapshot('comment-1', { deletedAt: { seconds: 1 } })),
      update: vi.fn(),
      delete: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await deleteCommentDocument('post-1', 'comment-1', 'actor-1');

    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('returns null for a soft-deleted post detail', async () => {
    const { getPostDetail } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('post-1', { title: 'gone', deletedAt: { seconds: 1 } }),
    );

    await expect(getPostDetail('post-1')).resolves.toBeNull();
  });

  it('continues post pagination past a deleted raw page', async () => {
    const { getLatestPosts } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDocs
      .mockResolvedValueOnce(querySnapshot(deletedPostPage('deleted')))
      .mockResolvedValueOnce(
        querySnapshot([snapshot('active-1', { title: 'active', postAt: { seconds: 1 } })]),
      );

    await expect(getLatestPosts()).resolves.toEqual([
      { id: 'active-1', title: 'active', postAt: { seconds: 1 } },
    ]);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith({ seconds: 11 }, 'deleted-9');
  });

  it('continues search pagination past a deleted raw page', async () => {
    const { getPostsBySearch } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDocs
      .mockResolvedValueOnce(querySnapshot(deletedPostPage('run-deleted')))
      .mockResolvedValueOnce(
        querySnapshot([snapshot('active-1', { title: 'run active', postAt: { seconds: 1 } })]),
      );

    await expect(getPostsBySearch('run')).resolves.toEqual([
      { id: 'active-1', title: 'run active', postAt: { seconds: 1 } },
    ]);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith('run-deleted 9', 'run-deleted-9');
  });

  it('returns null for a soft-deleted comment lookup', async () => {
    const { getCommentById } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('comment-1', { comment: 'gone', deletedAt: { seconds: 1 } }),
    );

    await expect(getCommentById('post-1', 'comment-1')).resolves.toBeNull();
  });

  it('returns active comments only from latest and next comment pages', async () => {
    const { getLatestComments, getMoreComments } = await import(
      '@/runtime/client/use-cases/post-use-cases'
    );
    firestoreMocks.getDocs
      .mockResolvedValueOnce(
        querySnapshot([
          snapshot('active-1', { comment: 'active', createdAt: { seconds: 2 } }),
          snapshot('deleted-1', { comment: 'deleted', deletedAt: { seconds: 1 } }),
        ]),
      )
      .mockResolvedValueOnce(
        querySnapshot([
          snapshot('active-2', { comment: 'more', createdAt: { seconds: 1 } }),
          snapshot('deleted-2', { comment: 'deleted more', deletedAt: { seconds: 1 } }),
        ]),
      );

    await expect(getLatestComments('post-1', 10)).resolves.toEqual([
      { id: 'active-1', comment: 'active', createdAt: { seconds: 2 } },
    ]);
    await expect(
      getMoreComments(
        'post-1',
        /** @type {import('@/service/post-service').Comment} */ ({
          id: 'active-1',
          createdAt: { seconds: 2 },
        }),
      ),
    ).resolves.toEqual([{ id: 'active-2', comment: 'more', createdAt: { seconds: 1 } }]);
  });

  it('returns comment page metadata without a boundary empty probe', async () => {
    const { getLatestCommentsPage, getMoreCommentsPage, getLatestComments } = await import(
      '@/runtime/client/use-cases/post-use-cases'
    );
    const firstEleven = Array.from({ length: 11 }, (_, index) =>
      snapshot(`comment-${index + 1}`, {
        comment: `comment ${index + 1}`,
        createdAt: { seconds: 30 - index },
      }),
    );
    const secondTen = Array.from({ length: 10 }, (_, index) =>
      snapshot(`comment-${index + 11}`, {
        comment: `comment ${index + 11}`,
        createdAt: { seconds: 19 - index },
      }),
    );
    firestoreMocks.getDocs
      .mockResolvedValueOnce(querySnapshot(firstEleven))
      .mockResolvedValueOnce(querySnapshot(secondTen))
      .mockResolvedValueOnce(querySnapshot(firstEleven));

    const firstPage = await getLatestCommentsPage('post-1', 10);
    expect(firstPage).toEqual({
      comments: firstEleven.slice(0, 10).map((doc) => ({ id: doc.id, ...doc.data() })),
      nextCursor: { id: 'comment-10', comment: 'comment 10', createdAt: { seconds: 21 } },
      hasMore: true,
    });

    const secondPage = await getMoreCommentsPage('post-1', firstPage.nextCursor, 10);
    expect(secondPage).toEqual({
      comments: secondTen.map((doc) => ({ id: doc.id, ...doc.data() })),
      nextCursor: null,
      hasMore: false,
    });

    await expect(getLatestComments('post-1', 10)).resolves.toHaveLength(10);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(3);
    expect(firestoreMocks.limit).toHaveBeenCalledWith(11);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith({ seconds: 21 }, 'comment-10');
  });

  it('calculates comment page hasMore from active records beyond hidden raw docs', async () => {
    const { getLatestCommentsPage } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDocs
      .mockResolvedValueOnce(
        querySnapshot([
          snapshot('active-1', { comment: 'active 1', createdAt: { seconds: 5 } }),
          snapshot('deleted-1', {
            comment: 'deleted',
            createdAt: { seconds: 4 },
            deletedAt: { seconds: 1 },
          }),
          snapshot('active-2', { comment: 'active 2', createdAt: { seconds: 3 } }),
        ]),
      )
      .mockResolvedValueOnce(
        querySnapshot([
          snapshot('hidden-1', {
            comment: 'hidden',
            createdAt: { seconds: 2 },
            accountDeletionHidden: true,
          }),
          snapshot('active-3', { comment: 'active 3', createdAt: { seconds: 1 } }),
        ]),
      );

    await expect(getLatestCommentsPage('post-1', 2)).resolves.toEqual({
      comments: [
        { id: 'active-1', comment: 'active 1', createdAt: { seconds: 5 } },
        { id: 'active-2', comment: 'active 2', createdAt: { seconds: 3 } },
      ],
      nextCursor: { id: 'active-2', comment: 'active 2', createdAt: { seconds: 3 } },
      hasMore: true,
    });
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith({ seconds: 3 }, 'active-2');
  });

  it('continues comment pagination using raw deleted cursors', async () => {
    const { getLatestComments } = await import('@/runtime/client/use-cases/post-use-cases');
    firestoreMocks.getDocs
      .mockResolvedValueOnce(
        querySnapshot([
          snapshot('deleted-2', {
            comment: 'deleted newer',
            createdAt: { seconds: 3 },
            deletedAt: { seconds: 1 },
          }),
          snapshot('deleted-1', {
            comment: 'deleted older',
            createdAt: { seconds: 2 },
            deletedAt: { seconds: 1 },
          }),
          snapshot('deleted-0', {
            comment: 'deleted oldest',
            createdAt: { seconds: 1.5 },
            deletedAt: { seconds: 1 },
          }),
        ]),
      )
      .mockResolvedValueOnce(
        querySnapshot([snapshot('active-1', { comment: 'active', createdAt: { seconds: 1 } })]),
      );

    await expect(getLatestComments('post-1', 2)).resolves.toEqual([
      { id: 'active-1', comment: 'active', createdAt: { seconds: 1 } },
    ]);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith({ seconds: 1.5 }, 'deleted-0');
  });

  it('does not start comment delete work without an actor uid', async () => {
    const { deleteComment } = await import('@/runtime/client/use-cases/post-use-cases');

    await expect(deleteComment('post-1', 'comment-1', null)).resolves.toBeUndefined();

    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it('rejects new comments under a soft-deleted post', async () => {
    const { addCommentDocument } = await import('@/repo/client/firebase-posts-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(snapshot('post-1', { deletedAt: { seconds: 1 } })),
      set: vi.fn(),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(addCommentDocument('post-1', { comment: 'blocked' })).rejects.toThrow(
      'Post not found',
    );
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
});
