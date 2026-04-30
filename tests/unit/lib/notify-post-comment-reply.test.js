import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (SDK boundary only — no internal lib/repo/service mocks)
// ---------------------------------------------------------------------------
const mockBatch = { set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  addDoc: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
  doc: vi.fn((base, ...segments) => {
    if (base?.type === 'collection') {
      return {
        type: 'doc',
        path: [base.path, ...segments].join('/') || `${base.path}/auto-id`,
      };
    }
    return { type: 'doc', path: segments.join('/') };
  }),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  limit: vi.fn((n) => ({ type: 'limit', n })),
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  collectionGroup: vi.fn(),
  documentId: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { collection, writeBatch, getDocs } from 'firebase/firestore';
import { notifyPostCommentReply } from '@/lib/firebase-notifications';

// ---------------------------------------------------------------------------
// Typed aliases
// ---------------------------------------------------------------------------
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedCollection = /** @type {import('vitest').Mock} */ (collection);
const mockedWriteBatch = /** @type {import('vitest').Mock} */ (writeBatch);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const POST_ID = 'post-abc';
const POST_TITLE = '週末好去處';
const POST_AUTHOR_UID = 'author-uid';
const COMMENT_ID = 'comment-xyz';
/** @type {import('@/lib/firebase-notifications').Actor} */
const ACTOR = { uid: 'actor-uid', name: 'Alice', photoURL: 'https://example.com/alice.jpg' };

const EXPECTED_MESSAGE = `你留言過的文章『${POST_TITLE}』有一則新的留言`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 將 authorUids 包成 fetchDistinctPostCommentAuthors 期望的 snapshot shape。
 * @param {string[]} authorUids - 過去留言者 UID 列表（可重複）。
 * @returns {{ docs: Array<{ data: () => { authorUid: string } }> }} fake snapshot。
 */
function buildCommentsSnapshot(authorUids) {
  return {
    docs: authorUids.map((authorUid) => ({ data: () => ({ authorUid }) })),
  };
}

// ---------------------------------------------------------------------------
// notifyPostCommentReply
// ---------------------------------------------------------------------------
describe('notifyPostCommentReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('批次通知曾留言者 — 3 位過去留言者各收到 1 則通知', async () => {
    // Arrange
    mockedGetDocs.mockResolvedValue(
      buildCommentsSnapshot(['commenter1', 'commenter2', 'commenter3']),
    );

    // Act
    await notifyPostCommentReply(POST_ID, POST_TITLE, POST_AUTHOR_UID, COMMENT_ID, ACTOR);

    // Assert — fetchDistinctPostCommentAuthors 走真實 collection(db, 'posts', POST_ID, 'comments')
    expect(mockedCollection).toHaveBeenCalledWith('mock-db', 'posts', POST_ID, 'comments');
    expect(mockedGetDocs).toHaveBeenCalled();
    expect(mockedWriteBatch).toHaveBeenCalledWith('mock-db');
    expect(mockBatch.set).toHaveBeenCalledTimes(3);

    // payload 用真實 buildNotificationDoc 組出來，含真實中文 message
    ['commenter1', 'commenter2', 'commenter3'].forEach((uid) => {
      expect(mockBatch.set).toHaveBeenCalledWith(expect.any(Object), {
        recipientUid: uid,
        type: 'post_comment_reply',
        actorUid: ACTOR.uid,
        actorName: ACTOR.name,
        actorPhotoURL: ACTOR.photoURL,
        entityType: 'post',
        entityId: POST_ID,
        entityTitle: POST_TITLE,
        commentId: COMMENT_ID,
        message: EXPECTED_MESSAGE,
        read: false,
        createdAt: 'mock-timestamp',
      });
    });

    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('排除留言者本人 — actor 在過去留言者名單中應被排除', async () => {
    // Arrange
    mockedGetDocs.mockResolvedValue(buildCommentsSnapshot([ACTOR.uid, 'commenter1', 'commenter2']));

    // Act
    await notifyPostCommentReply(POST_ID, POST_TITLE, POST_AUTHOR_UID, COMMENT_ID, ACTOR);

    // Assert — actor 被排除，只剩 2 則通知
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    const recipientUids = mockBatch.set.mock.calls.map(
      (/** @type {[unknown, {recipientUid: string}]} */ call) => call[1].recipientUid,
    );
    expect(recipientUids).not.toContain(ACTOR.uid);
    expect(recipientUids).toContain('commenter1');
    expect(recipientUids).toContain('commenter2');
  });

  it('排除文章作者 — postAuthorUid 在留言者名單中應被排除（他收 post_new_comment）', async () => {
    // Arrange
    mockedGetDocs.mockResolvedValue(buildCommentsSnapshot([POST_AUTHOR_UID, 'commenter1']));

    // Act
    await notifyPostCommentReply(POST_ID, POST_TITLE, POST_AUTHOR_UID, COMMENT_ID, ACTOR);

    // Assert — postAuthorUid 被排除，只剩 1 則通知
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    const recipientUids = mockBatch.set.mock.calls.map(
      (/** @type {[unknown, {recipientUid: string}]} */ call) => call[1].recipientUid,
    );
    expect(recipientUids).not.toContain(POST_AUTHOR_UID);
    expect(recipientUids).toContain('commenter1');
  });

  it('無過去留言者時不建立通知 — 空清單應 early return', async () => {
    // Arrange
    mockedGetDocs.mockResolvedValue(buildCommentsSnapshot([]));

    // Act
    await notifyPostCommentReply(POST_ID, POST_TITLE, POST_AUTHOR_UID, COMMENT_ID, ACTOR);

    // Assert — 不應呼叫 writeBatch
    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('同一作者多次留言只收一次通知 — dedup 由 fetchDistinctCommentAuthors 處理', async () => {
    // Arrange — commenter-a 出現 3 次，commenter-b 出現 2 次
    mockedGetDocs.mockResolvedValue(
      buildCommentsSnapshot([
        'commenter-a',
        'commenter-b',
        'commenter-a',
        'commenter-b',
        'commenter-a',
      ]),
    );

    // Act
    await notifyPostCommentReply(POST_ID, POST_TITLE, POST_AUTHOR_UID, COMMENT_ID, ACTOR);

    // Assert — fetchDistinctCommentAuthors 去重後只剩 2 位，batch.set 應只呼叫 2 次
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    const recipientUids = mockBatch.set.mock.calls.map(
      (/** @type {[unknown, {recipientUid: string}]} */ call) => call[1].recipientUid,
    );
    expect(recipientUids).toContain('commenter-a');
    expect(recipientUids).toContain('commenter-b');
  });
});
