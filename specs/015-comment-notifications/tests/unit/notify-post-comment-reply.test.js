import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockBatch = { set: vi.fn(), commit: vi.fn() };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection-ref'),
  addDoc: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
  doc: vi.fn(() => 'mock-doc-ref'),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({ db: 'mock-db' }));
vi.mock('@/lib/firebase-events', () => ({ fetchParticipants: vi.fn() }));
vi.mock('@/lib/notification-helpers', () => ({
  buildNotificationMessage: vi.fn(() => 'mock-message'),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { collection, writeBatch, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { buildNotificationMessage } from '@/lib/notification-helpers';
import { notifyPostCommentReply } from '@/lib/firebase-notifications';

// ---------------------------------------------------------------------------
// Typed aliases
// ---------------------------------------------------------------------------
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedCollection = /** @type {import('vitest').Mock} */ (collection);
const mockedWriteBatch = /** @type {import('vitest').Mock} */ (writeBatch);
const mockedDoc = /** @type {import('vitest').Mock} */ (doc);
const mockedServerTimestamp = /** @type {import('vitest').Mock} */ (serverTimestamp);
const mockedBuildMessage = /** @type {import('vitest').Mock} */ (buildNotificationMessage);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const POST_ID = 'post-abc';
const POST_TITLE = '週末好去處';
const POST_AUTHOR_UID = 'author-uid';
const COMMENT_ID = 'comment-xyz';
/** @type {import('@/lib/firebase-notifications').Actor} */
const ACTOR = { uid: 'actor-uid', name: 'Alice', photoURL: 'https://example.com/alice.jpg' };

// ---------------------------------------------------------------------------
// notifyPostCommentReply
// ---------------------------------------------------------------------------
describe('notifyPostCommentReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('批次通知曾留言者 — 3 位過去留言者各收到 1 則通知', async () => {
    // Arrange
    mockedGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ authorUid: 'commenter1' }) },
        { data: () => ({ authorUid: 'commenter2' }) },
        { data: () => ({ authorUid: 'commenter3' }) },
      ],
    });

    // Act
    await notifyPostCommentReply(POST_ID, POST_TITLE, POST_AUTHOR_UID, COMMENT_ID, ACTOR);

    // Assert
    expect(mockedCollection).toHaveBeenCalledWith('mock-db', 'posts', POST_ID, 'comments');
    expect(mockedGetDocs).toHaveBeenCalled();
    expect(mockedBuildMessage).toHaveBeenCalledWith('post_comment_reply', POST_TITLE);
    expect(mockedWriteBatch).toHaveBeenCalledWith('mock-db');
    expect(mockBatch.set).toHaveBeenCalledTimes(3);

    ['commenter1', 'commenter2', 'commenter3'].forEach((uid) => {
      expect(mockBatch.set).toHaveBeenCalledWith('mock-doc-ref', {
        recipientUid: uid,
        type: 'post_comment_reply',
        actorUid: ACTOR.uid,
        actorName: ACTOR.name,
        actorPhotoURL: ACTOR.photoURL,
        entityType: 'post',
        entityId: POST_ID,
        entityTitle: POST_TITLE,
        commentId: COMMENT_ID,
        message: 'mock-message',
        read: false,
        createdAt: 'mock-timestamp',
      });
    });

    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('排除留言者本人 — actor 在過去留言者名單中應被排除', async () => {
    // Arrange
    mockedGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ authorUid: ACTOR.uid }) },
        { data: () => ({ authorUid: 'commenter1' }) },
        { data: () => ({ authorUid: 'commenter2' }) },
      ],
    });

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
    mockedGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ authorUid: POST_AUTHOR_UID }) },
        { data: () => ({ authorUid: 'commenter1' }) },
      ],
    });

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
    mockedGetDocs.mockResolvedValue({ docs: [] });

    // Act
    await notifyPostCommentReply(POST_ID, POST_TITLE, POST_AUTHOR_UID, COMMENT_ID, ACTOR);

    // Assert — 不應呼叫 writeBatch
    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('同一作者多次留言只收一次通知 — dedup 由 fetchDistinctCommentAuthors 處理', async () => {
    // Arrange — commenter-a 出現 3 次，commenter-b 出現 2 次
    mockedGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ authorUid: 'commenter-a' }) },
        { data: () => ({ authorUid: 'commenter-b' }) },
        { data: () => ({ authorUid: 'commenter-a' }) },
        { data: () => ({ authorUid: 'commenter-b' }) },
        { data: () => ({ authorUid: 'commenter-a' }) },
      ],
    });

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
