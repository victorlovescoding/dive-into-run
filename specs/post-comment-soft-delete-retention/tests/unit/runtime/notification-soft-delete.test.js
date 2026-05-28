import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((...path) => ({ kind: 'collection', path })),
  doc: vi.fn((...path) => ({ kind: 'doc', path })),
  getDocs: vi.fn(),
  limit: vi.fn((value) => ({ op: 'limit', value })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ op: 'orderBy', field, direction })),
  query: vi.fn((...args) => ({ kind: 'query', args })),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  startAfter: vi.fn((doc) => ({ op: 'startAfter', doc })),
  updateDoc: vi.fn(),
  where: vi.fn((field, op, value) => ({ op: 'where', field, comparator: op, value })),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: { kind: 'db' } }));
vi.mock('@/repo/client/firebase-events-repo', () => ({ fetchParticipantUids: vi.fn() }));

/**
 * Build a minimal Firestore document snapshot mock.
 * @param {string} id - Document ID.
 * @param {object} data - Snapshot data.
 * @returns {{ id: string, data: () => object }} Snapshot mock.
 */
function snapshot(id, data) {
  return {
    id,
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

describe('notification soft delete recipient discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.addDoc.mockReset();
    firestoreMocks.getDocs.mockReset();
    firestoreMocks.writeBatch.mockReset();
  });

  it('does not notify a user whose only previous post comment is soft-deleted', async () => {
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

    const { notifyPostCommentReply } = await import(
      '@/runtime/client/use-cases/notification-use-cases'
    );
    await notifyPostCommentReply('post-1', 'Post title', 'post-author', 'comment-new', {
      uid: 'actor',
      name: 'Actor',
      photoURL: '',
    });

    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('notifies a user who still has another active post comment', async () => {
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

    const { notifyPostCommentReply } = await import(
      '@/runtime/client/use-cases/notification-use-cases'
    );
    await notifyPostCommentReply('post-1', 'Post title', 'post-author', 'comment-new', {
      uid: 'actor',
      name: 'Actor',
      photoURL: '',
    });

    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls[0][1]).toMatchObject({
      recipientUid: 'previous-commenter',
      type: 'post_comment_reply',
      entityType: 'post',
      entityId: 'post-1',
      entityTitle: 'Post title',
      commentId: 'comment-new',
      actorUid: 'actor',
    });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('does not create reply notifications for invalid active post comment author UIDs', async () => {
    const batch = { set: vi.fn(), commit: vi.fn() };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot([
        snapshot('comment-missing-author', {}),
        snapshot('comment-empty-author', { authorUid: '' }),
        snapshot('comment-blank-author', { authorUid: '   ' }),
        snapshot('comment-non-string-author', { authorUid: 123 }),
      ]),
    );

    const { notifyPostCommentReply } = await import(
      '@/runtime/client/use-cases/notification-use-cases'
    );
    await notifyPostCommentReply('post-1', 'Post title', 'post-author', 'comment-new', {
      uid: 'actor',
      name: 'Actor',
      photoURL: '',
    });

    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });
});
