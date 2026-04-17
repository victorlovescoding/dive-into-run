import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({
  db: 'mock-db',
}));

vi.mock('@/lib/firebase-events', () => ({
  fetchParticipants: vi.fn(),
}));

vi.mock('@/lib/notification-helpers', () => ({
  buildNotificationMessage: vi.fn((type, title) => `mock-message-${type}-${title}`),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { fetchParticipants } from '@/lib/firebase-events';
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
const mockedDoc = /** @type {import('vitest').Mock} */ (doc);
const mockedFetchParticipants = /** @type {import('vitest').Mock} */ (fetchParticipants);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const actor = {
  uid: 'actor-uid',
  name: 'Actor Name',
  photoURL: 'https://photo.url/actor.jpg',
};

const participants = [{ uid: 'user-1' }, { uid: 'user-2' }, { uid: 'actor-uid' }];

/** @returns {{ set: import('vitest').Mock, commit: import('vitest').Mock }} mock WriteBatch。 */
function createMockBatch() {
  return { set: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
}

// ---------------------------------------------------------------------------
// notifyEventModified
// ---------------------------------------------------------------------------
describe('notifyEventModified', () => {
  /** @type {ReturnType<typeof createMockBatch>} */
  let mockBatch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch = createMockBatch();
    mockedWriteBatch.mockReturnValue(mockBatch);
    mockedFetchParticipants.mockResolvedValue(participants);
    mockedCollection.mockReturnValue('mock-collection-ref');
    mockedDoc.mockImplementation(() => `mock-doc-ref-${Math.random()}`);
  });

  it('should call fetchParticipants with the eventId', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert
    expect(mockedFetchParticipants).toHaveBeenCalledWith('evt-1');
  });

  it('should create batch.set for each participant excluding actor', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert — 3 participants minus actor = 2
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
  });

  it('should set correct notification fields for each recipient', async () => {
    // Arrange
    mockedDoc.mockReturnValue('mock-doc-ref');

    // Act
    await notifyEventModified('evt-1', '週末登山團', actor);

    // Assert
    expect(mockBatch.set).toHaveBeenCalledWith('mock-doc-ref', {
      recipientUid: 'user-1',
      type: 'event_modified',
      actorUid: 'actor-uid',
      actorName: 'Actor Name',
      actorPhotoURL: 'https://photo.url/actor.jpg',
      entityType: 'event',
      entityId: 'evt-1',
      entityTitle: '週末登山團',
      commentId: null,
      message: 'mock-message-event_modified-週末登山團',
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
    mockedFetchParticipants.mockResolvedValue([{ uid: 'actor-uid' }]);

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
  /** @type {ReturnType<typeof createMockBatch>} */
  let mockBatch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch = createMockBatch();
    mockedWriteBatch.mockReturnValue(mockBatch);
    mockedCollection.mockReturnValue('mock-collection-ref');
    mockedDoc.mockReturnValue('mock-doc-ref');
  });

  it('should create batch notifications for participants excluding actor', async () => {
    // Arrange — participants passed directly

    // Act
    await notifyEventCancelled('evt-2', '晨跑社練習', participants, actor);

    // Assert — 3 minus actor = 2
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockedFetchParticipants).not.toHaveBeenCalled();
  });

  it('should set correct fields with type event_cancelled', async () => {
    // Arrange — done in beforeEach

    // Act
    await notifyEventCancelled('evt-2', '晨跑社練習', participants, actor);

    // Assert
    expect(mockBatch.set).toHaveBeenCalledWith('mock-doc-ref', {
      recipientUid: 'user-1',
      type: 'event_cancelled',
      actorUid: 'actor-uid',
      actorName: 'Actor Name',
      actorPhotoURL: 'https://photo.url/actor.jpg',
      entityType: 'event',
      entityId: 'evt-2',
      entityTitle: '晨跑社練習',
      commentId: null,
      message: 'mock-message-event_cancelled-晨跑社練習',
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
    mockedCollection.mockReturnValue('mock-collection-ref');
  });

  it('should call addDoc with correct notification fields', async () => {
    // Arrange
    const postAuthorUid = 'author-uid';

    // Act
    await notifyPostNewComment('post-1', '台北馬拉松心得', postAuthorUid, 'cmt-1', actor);

    // Assert
    expect(mockedAddDoc).toHaveBeenCalledWith('mock-collection-ref', {
      recipientUid: 'author-uid',
      type: 'post_new_comment',
      actorUid: 'actor-uid',
      actorName: 'Actor Name',
      actorPhotoURL: 'https://photo.url/actor.jpg',
      entityType: 'post',
      entityId: 'post-1',
      entityTitle: '台北馬拉松心得',
      commentId: 'cmt-1',
      message: 'mock-message-post_new_comment-台北馬拉松心得',
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
