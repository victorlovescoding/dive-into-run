import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockBatch = { set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => args.join('/')),
  addDoc: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
  doc: vi.fn(() => 'mock-doc-ref'),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock('@/repo/client/firebase-events-repo', async (importOriginal) => {
  const actual = /** @type {Record<string, unknown>} */ (await importOriginal());
  return {
    ...actual,
    fetchParticipantUids: vi.fn(),
  };
});
vi.mock('@/repo/client/firebase-notifications-repo', async (importOriginal) => {
  const actual = /** @type {Record<string, unknown>} */ (await importOriginal());
  return {
    ...actual,
    fetchDistinctEventCommentAuthors: vi.fn(),
  };
});
vi.mock('@/lib/notification-helpers', () => ({
  buildNotificationMessage: vi.fn((type) => `mock-message-${type}`),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { notifyEventNewComment } from '@/lib/firebase-notifications';
import { fetchParticipantUids } from '@/repo/client/firebase-events-repo';
import { fetchDistinctEventCommentAuthors } from '@/repo/client/firebase-notifications-repo';

// ---------------------------------------------------------------------------
// Typed aliases
// ---------------------------------------------------------------------------
const mockedFetchParticipantUids = /** @type {import('vitest').Mock} */ (fetchParticipantUids);
const mockedFetchDistinctEventCommentAuthors = /** @type {import('vitest').Mock} */ (
  fetchDistinctEventCommentAuthors
);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const EVENT_ID = 'event-abc';
const EVENT_TITLE = '週末登山團';
const HOST_UID = 'host-uid';
const COMMENT_ID = 'comment-xyz';
/** @type {import('@/lib/firebase-notifications').Actor} */
const ACTOR = { uid: 'actor1', name: 'Actor', photoURL: 'http://actor.jpg' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 取得 batch.set 所有呼叫的 notification type。
 * @returns {string[]} notification type 陣列。
 */
function getNotificationTypes() {
  return mockBatch.set.mock.calls.map(
    (/** @type {[unknown, {type: string}]} */ call) => call[1].type,
  );
}

/**
 * 取得 batch.set 所有呼叫的 recipientUid。
 * @returns {string[]} recipientUid 陣列。
 */
function getRecipientUids() {
  return mockBatch.set.mock.calls.map(
    (/** @type {[unknown, {recipientUid: string}]} */ call) => call[1].recipientUid,
  );
}

// ---------------------------------------------------------------------------
// notifyEventNewComment
// ---------------------------------------------------------------------------
describe('notifyEventNewComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // (A) Core Delivery — 正確發送
  // =========================================================================
  describe('Core Delivery — 正確發送', () => {
    it('主揪人收到 event_host_comment', async () => {
      // Arrange
      mockedFetchParticipantUids.mockResolvedValue([]);
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue([]);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, HOST_UID, COMMENT_ID, ACTOR);

      // Assert
      const types = getNotificationTypes();
      const recipients = getRecipientUids();
      expect(types).toContain('event_host_comment');
      expect(recipients).toContain(HOST_UID);

      const hostCall = mockBatch.set.mock.calls.find(
        (/** @type {[unknown, {recipientUid: string}]} */ call) =>
          call[1].recipientUid === HOST_UID,
      );
      expect(hostCall).toBeDefined();
      expect(hostCall[1]).toEqual({
        recipientUid: HOST_UID,
        type: 'event_host_comment',
        actorUid: ACTOR.uid,
        actorName: ACTOR.name,
        actorPhotoURL: ACTOR.photoURL,
        entityType: 'event',
        entityId: EVENT_ID,
        entityTitle: EVENT_TITLE,
        commentId: COMMENT_ID,
        message: 'mock-message-event_host_comment',
        read: false,
        createdAt: 'mock-timestamp',
      });
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('參加者收到 event_participant_comment', async () => {
      // Arrange
      mockedFetchParticipantUids.mockResolvedValue(['p1', 'p2']);
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue([]);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, HOST_UID, COMMENT_ID, ACTOR);

      // Assert
      const types = getNotificationTypes();
      const recipients = getRecipientUids();

      expect(types.filter((t) => t === 'event_participant_comment')).toHaveLength(2);
      expect(recipients).toContain('p1');
      expect(recipients).toContain('p2');

      ['p1', 'p2'].forEach((uid) => {
        const call = mockBatch.set.mock.calls.find(
          (/** @type {[unknown, {recipientUid: string}]} */ c) => c[1].recipientUid === uid,
        );
        expect(call[1]).toMatchObject({
          recipientUid: uid,
          type: 'event_participant_comment',
          entityType: 'event',
          entityId: EVENT_ID,
        });
      });
    });

    it('跟帖者收到 event_comment_reply', async () => {
      // Arrange — commenter 不是 host、不是 participant
      mockedFetchParticipantUids.mockResolvedValue([]);
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue(['commenter1', 'commenter2']);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, HOST_UID, COMMENT_ID, ACTOR);

      // Assert
      const types = getNotificationTypes();
      const recipients = getRecipientUids();

      expect(types.filter((t) => t === 'event_comment_reply')).toHaveLength(2);
      expect(recipients).toContain('commenter1');
      expect(recipients).toContain('commenter2');

      ['commenter1', 'commenter2'].forEach((uid) => {
        const call = mockBatch.set.mock.calls.find(
          (/** @type {[unknown, {recipientUid: string}]} */ c) => c[1].recipientUid === uid,
        );
        expect(call[1]).toMatchObject({
          recipientUid: uid,
          type: 'event_comment_reply',
          entityType: 'event',
          entityId: EVENT_ID,
        });
      });
    });
  });

  // =========================================================================
  // (B) Dedup Logic — 去重
  // =========================================================================
  describe('Dedup Logic — 去重', () => {
    it('主揪人+跟帖者 → 只收 event_host_comment', async () => {
      // Arrange — host 也是過去的 commenter
      mockedFetchParticipantUids.mockResolvedValue([]);
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue([HOST_UID, 'commenter1']);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, HOST_UID, COMMENT_ID, ACTOR);

      // Assert — host 只收一次，type 是 event_host_comment
      const hostCalls = mockBatch.set.mock.calls.filter(
        (/** @type {[unknown, {recipientUid: string}]} */ call) =>
          call[1].recipientUid === HOST_UID,
      );
      expect(hostCalls).toHaveLength(1);
      expect(hostCalls[0][1].type).toBe('event_host_comment');

      // commenter1 收到 event_comment_reply
      const commenter1Calls = mockBatch.set.mock.calls.filter(
        (/** @type {[unknown, {recipientUid: string}]} */ call) =>
          call[1].recipientUid === 'commenter1',
      );
      expect(commenter1Calls).toHaveLength(1);
      expect(commenter1Calls[0][1].type).toBe('event_comment_reply');
    });

    it('參加者+跟帖者 → 只收 event_participant_comment', async () => {
      // Arrange — p1 同時是 participant 和 past commenter
      mockedFetchParticipantUids.mockResolvedValue(['p1']);
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue(['p1', 'commenter1']);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, HOST_UID, COMMENT_ID, ACTOR);

      // Assert — p1 只收一次，type 是 event_participant_comment
      const p1Calls = mockBatch.set.mock.calls.filter(
        (/** @type {[unknown, {recipientUid: string}]} */ call) => call[1].recipientUid === 'p1',
      );
      expect(p1Calls).toHaveLength(1);
      expect(p1Calls[0][1].type).toBe('event_participant_comment');

      // commenter1 收到 event_comment_reply
      const commenter1Calls = mockBatch.set.mock.calls.filter(
        (/** @type {[unknown, {recipientUid: string}]} */ call) =>
          call[1].recipientUid === 'commenter1',
      );
      expect(commenter1Calls).toHaveLength(1);
      expect(commenter1Calls[0][1].type).toBe('event_comment_reply');
    });

    it('留言者本人不收通知', async () => {
      // Arrange — actor 出現在 host、participant、commenter 全部
      const actorAsHost = ACTOR.uid;
      mockedFetchParticipantUids.mockResolvedValue([ACTOR.uid, 'p1']);
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue([ACTOR.uid, 'commenter1']);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, actorAsHost, COMMENT_ID, ACTOR);

      // Assert — actor 完全不在 recipient 中
      const recipients = getRecipientUids();
      expect(recipients).not.toContain(ACTOR.uid);

      // p1 和 commenter1 正常收到
      expect(recipients).toContain('p1');
      expect(recipients).toContain('commenter1');
    });
  });

  // =========================================================================
  // (C) Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    it('無參加者+無跟帖者 → 只有 host 通知', async () => {
      // Arrange
      mockedFetchParticipantUids.mockResolvedValue([]);
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue([]);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, HOST_UID, COMMENT_ID, ACTOR);

      // Assert — 只有 host 1 則通知
      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      const recipients = getRecipientUids();
      const types = getNotificationTypes();
      expect(recipients).toEqual([HOST_UID]);
      expect(types).toEqual(['event_host_comment']);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('50-participant batch — 驗證 batch.set 呼叫次數正確', async () => {
      // Arrange — 50 participants + host + 3 comment authors (2 new)
      const participants = Array.from({ length: 50 }, (_, i) => ({
        uid: `p${i + 1}`,
      }));
      mockedFetchParticipantUids.mockResolvedValue(participants.map((participant) => participant.uid));
      // commenter-a and commenter-b are new; p1 already covered as participant
      mockedFetchDistinctEventCommentAuthors.mockResolvedValue(['commenter-a', 'commenter-b', 'p1']);

      // Act
      await notifyEventNewComment(EVENT_ID, EVENT_TITLE, HOST_UID, COMMENT_ID, ACTOR);

      // Assert
      // 1 (host) + 50 (participants) + 2 (new commenters, p1 deduped) = 53
      expect(mockBatch.set).toHaveBeenCalledTimes(53);

      const recipients = getRecipientUids();
      const types = getNotificationTypes();

      // host
      expect(recipients).toContain(HOST_UID);
      expect(types.filter((t) => t === 'event_host_comment')).toHaveLength(1);

      // 50 participants
      expect(types.filter((t) => t === 'event_participant_comment')).toHaveLength(50);

      // 2 new comment authors (p1 deduped)
      expect(types.filter((t) => t === 'event_comment_reply')).toHaveLength(2);
      expect(recipients).toContain('commenter-a');
      expect(recipients).toContain('commenter-b');

      // p1 只收 participant 通知，不重複收 comment_reply
      const p1Calls = mockBatch.set.mock.calls.filter(
        (/** @type {[unknown, {recipientUid: string}]} */ call) => call[1].recipientUid === 'p1',
      );
      expect(p1Calls).toHaveLength(1);
      expect(p1Calls[0][1].type).toBe('event_participant_comment');

      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });
});
