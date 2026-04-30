import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (SDK boundary only — no internal lib/repo/service mocks)
// ---------------------------------------------------------------------------
const mockBatch = { set: vi.fn(), commit: vi.fn(() => Promise.resolve()) };

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
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
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
import { collection, addDoc, writeBatch, getDocs } from 'firebase/firestore';
import {
  notifyEventModified,
  notifyEventCancelled,
  notifyPostNewComment,
} from '@/lib/firebase-notifications';

// ---------------------------------------------------------------------------
// Typed aliases
// ---------------------------------------------------------------------------
const mockedWriteBatch = /** @type {import('vitest').Mock} */ (writeBatch);
const mockedAddDoc = /** @type {import('vitest').Mock} */ (addDoc);
const mockedCollection = /** @type {import('vitest').Mock} */ (collection);
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const actor = {
  uid: 'actor-uid',
  name: 'Actor Name',
  photoURL: 'https://photo.url/actor.jpg',
};

const participants = [{ uid: 'user-1' }, { uid: 'user-2' }, { uid: 'actor-uid' }];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 將 participant uids 包成 fetchParticipantDocuments 期望的 snapshot shape。
 * 真實 fetchParticipantUids 會 .map(d => d.data().uid || d.id)。
 * @param {string[]} uids - participant UID 列表。
 * @returns {{ docs: Array<{ id: string, data: () => { uid: string } }> }} fake snapshot。
 */
function buildParticipantsSnapshot(uids) {
  return {
    docs: uids.map((uid) => ({ id: uid, data: () => ({ uid }) })),
  };
}

// ---------------------------------------------------------------------------
// notifyEventModified
// ---------------------------------------------------------------------------
describe('notifyEventModified', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Drive real fetchParticipantUids → getDocs(query(collection(...))) → docs
    mockedGetDocs.mockResolvedValue(
      buildParticipantsSnapshot(participants.map((participant) => participant.uid)),
    );
  });

  it('should fetch participants and target the events/<id>/participants subcollection', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert — fetchParticipantDocuments 走真實 collection(db, 'events', eventId, 'participants')
    expect(mockedCollection).toHaveBeenCalledWith('mock-db', 'events', 'evt-1', 'participants');
    expect(mockedGetDocs).toHaveBeenCalled();
  });

  it('should create batch.set for each participant excluding actor', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert — 3 participants minus actor = 2
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
  });

  it('should set correct notification fields for each recipient', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert — payload 用真實 buildNotificationDoc + buildNotificationMessage 組出來
    expect(mockBatch.set).toHaveBeenCalledWith(expect.any(Object), {
      recipientUid: 'user-1',
      type: 'event_modified',
      actorUid: 'actor-uid',
      actorName: 'Actor Name',
      actorPhotoURL: 'https://photo.url/actor.jpg',
      entityType: 'event',
      entityId: 'evt-1',
      entityTitle: '週末登山團',
      commentId: null,
      message: '你所參加的『週末登山團』活動資訊有更動',
      read: false,
      createdAt: 'mock-server-timestamp',
    });
  });

  it('should call batch.commit', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('should NOT create notification for the actor themselves', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert
    const recipientUids = mockBatch.set.mock.calls.map((call) => call[1].recipientUid);
    expect(recipientUids).not.toContain('actor-uid');
  });

  it('should skip batch entirely when all participants are the actor', async () => {
    // Arrange
    mockedGetDocs.mockResolvedValue(buildParticipantsSnapshot(['actor-uid']));

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert
    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// notifyEventCancelled
// ---------------------------------------------------------------------------
describe('notifyEventCancelled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create batch notifications for participants excluding actor (legacy path: participants passed in)', async () => {
    // Arrange — participants passed directly (legacy signature)

    // Act
    await notifyEventCancelled('evt-2', '晨跑社練習', participants, actor);

    // Assert — 3 minus actor = 2; 不應觸發 fetchParticipantUids → 不應呼叫 events/.../participants getDocs
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });

  it('should set correct fields with type event_cancelled', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventCancelled('evt-2', '晨跑社練習', participants, actor);

    // Assert — payload 用真實 buildNotificationDoc + buildNotificationMessage 組出來
    expect(mockBatch.set).toHaveBeenCalledWith(expect.any(Object), {
      recipientUid: 'user-1',
      type: 'event_cancelled',
      actorUid: 'actor-uid',
      actorName: 'Actor Name',
      actorPhotoURL: 'https://photo.url/actor.jpg',
      entityType: 'event',
      entityId: 'evt-2',
      entityTitle: '晨跑社練習',
      commentId: null,
      message: '你所參加的『晨跑社練習』已取消',
      read: false,
      createdAt: 'mock-server-timestamp',
    });
  });

  it('should call batch.commit', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventCancelled('evt-2', '晨跑社練習', participants, actor);

    // Assert
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// notifyPostNewComment
// ---------------------------------------------------------------------------
describe('notifyPostNewComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAddDoc.mockResolvedValue({ id: 'new-doc-id' });
  });

  it('should call addDoc with correct notification fields', async () => {
    // Arrange
    const postAuthorUid = 'author-uid';

    // Act
    await notifyPostNewComment('post-1', '台北馬拉松心得', postAuthorUid, 'cmt-1', actor);

    // Assert — addDoc 走真實 collection(db, 'notifications')
    expect(mockedCollection).toHaveBeenCalledWith('mock-db', 'notifications');
    expect(mockedAddDoc).toHaveBeenCalledWith(expect.any(Object), {
      recipientUid: 'author-uid',
      type: 'post_new_comment',
      actorUid: 'actor-uid',
      actorName: 'Actor Name',
      actorPhotoURL: 'https://photo.url/actor.jpg',
      entityType: 'post',
      entityId: 'post-1',
      entityTitle: '台北馬拉松心得',
      commentId: 'cmt-1',
      message: '你的文章『台北馬拉松心得』有一則新的留言',
      read: false,
      createdAt: 'mock-server-timestamp',
    });
  });

  it('should NOT call addDoc when actor is the post author (self-comment)', async () => {
    // Arrange — actor comments on own post

    // Act
    await notifyPostNewComment('post-1', '台北馬拉松心得', 'actor-uid', 'cmt-2', actor);

    // Assert
    expect(mockedAddDoc).not.toHaveBeenCalled();
  });

  it('should use addDoc instead of writeBatch for single notification', async () => {
    // Arrange
    const postAuthorUid = 'author-uid';

    // Act
    await notifyPostNewComment('post-1', '台北馬拉松心得', postAuthorUid, 'cmt-1', actor);

    // Assert
    expect(mockedAddDoc).toHaveBeenCalledTimes(1);
    expect(mockedWriteBatch).not.toHaveBeenCalled();
  });
});
