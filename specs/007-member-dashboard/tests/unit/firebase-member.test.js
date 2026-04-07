/**
 * @file Unit tests for firebase-member.js
 * @description
 * TDD RED phase — tests for member dashboard service functions.
 * Covers: fetchMyEventIds, fetchMyEvents, fetchMyPosts, fetchMyComments.
 *
 * Rules:
 * 1. AAA Pattern (Arrange, Act, Assert).
 * 2. F.I.R.S.T principles — 100% isolated with vi.mock.
 * 3. Mock Firebase at module level; never test mock behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

/** @type {import('vitest').Mock} */
const mockGetDocs = vi.fn();
/** @type {import('vitest').Mock} */
const mockGetDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockCollection = vi.fn();
/** @type {import('vitest').Mock} */
const mockCollectionGroup = vi.fn();
/** @type {import('vitest').Mock} */
const mockQuery = vi.fn();
/** @type {import('vitest').Mock} */
const mockWhere = vi.fn();
/** @type {import('vitest').Mock} */
const mockOrderBy = vi.fn();
/** @type {import('vitest').Mock} */
const mockLimit = vi.fn();
/** @type {import('vitest').Mock} */
const mockStartAfter = vi.fn();
/** @type {import('vitest').Mock} */
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  doc: mockDoc,
}));

vi.mock('@/lib/firebase-client', () => ({
  db: 'mock-db',
}));

// ---------------------------------------------------------------------------
// Helpers — create mock Firestore docs
// ---------------------------------------------------------------------------

/**
 * Build a mock QueryDocumentSnapshot.
 * @param {string} id - Document ID.
 * @param {Record<string, unknown>} data - Document data fields.
 * @param {object} [refOverride] - Optional custom ref for path traversal.
 * @returns {object} Mock doc snapshot.
 */
function makeMockDoc(id, data, refOverride) {
  return {
    id,
    data: () => data,
    exists: () => true,
    ref: refOverride ?? { id },
  };
}

/**
 * Build a mock DocumentSnapshot from getDoc().
 * @param {string} id - Document ID.
 * @param {Record<string, unknown>} data - Document data fields.
 * @param {boolean} [exists] - Whether the doc exists.
 * @returns {object} Mock doc snapshot.
 */
function makeMockGetDocResult(id, data, exists = true) {
  return {
    id,
    data: () => (exists ? data : undefined),
    exists: () => exists,
  };
}

/**
 * Build a mock ref with parent chain for comment docs.
 * @param {string} commentId - Comment document ID.
 * @param {string} parentCollection - 'posts' or 'events'.
 * @param {string} parentId - Parent document ID.
 * @returns {object} Mock ref with parent traversal.
 */
function makeCommentRef(commentId, parentCollection, parentId) {
  return {
    id: commentId,
    parent: {
      id: 'comments',
      parent: {
        id: parentId,
        parent: {
          id: parentCollection,
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Unit: fetchMyEventIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return participantIds and hostedIds from parallel queries', async () => {
    // Arrange
    const participantDocs = [
      makeMockDoc('p1', { uid: 'user-1', eventId: 'event-A' }),
      makeMockDoc('p2', { uid: 'user-1', eventId: 'event-B' }),
    ];
    const hostedDocs = [makeMockDoc('event-C', { hostUid: 'user-1', title: 'My Event' })];
    mockGetDocs
      .mockResolvedValueOnce({ docs: participantDocs })
      .mockResolvedValueOnce({ docs: hostedDocs });

    // Act
    const { fetchMyEventIds } = await import('@/lib/firebase-member');
    const result = await fetchMyEventIds('user-1');

    // Assert
    expect(result.participantIds).toEqual(['event-A', 'event-B']);
    expect(result.hostedIds).toEqual(['event-C']);
  });

  it('should return empty arrays when user has no events', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });

    // Act
    const { fetchMyEventIds } = await import('@/lib/firebase-member');
    const result = await fetchMyEventIds('user-no-events');

    // Assert
    expect(result.participantIds).toEqual([]);
    expect(result.hostedIds).toEqual([]);
  });

  it('should call collectionGroup for participants and collection for events', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });

    // Act
    const { fetchMyEventIds } = await import('@/lib/firebase-member');
    await fetchMyEventIds('user-1');

    // Assert
    expect(mockCollectionGroup).toHaveBeenCalledWith('mock-db', 'participants');
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'events');
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'user-1');
    expect(mockWhere).toHaveBeenCalledWith('hostUid', '==', 'user-1');
  });
});

describe('Unit: fetchMyEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all event IDs, batch getDoc, sort by time desc, and return first page', async () => {
    // Arrange — fetchMyEventIds returns IDs
    const participantDocs = [
      makeMockDoc('p1', { uid: 'user-1', eventId: 'event-1' }),
      makeMockDoc('p2', { uid: 'user-1', eventId: 'event-2' }),
    ];
    const hostedDocs = [makeMockDoc('event-3', { hostUid: 'user-1' })];
    mockGetDocs
      .mockResolvedValueOnce({ docs: participantDocs })
      .mockResolvedValueOnce({ docs: hostedDocs });

    // Arrange — getDoc for each event
    const ts1 = { seconds: 1000, toMillis: () => 1000000 };
    const ts2 = { seconds: 2000, toMillis: () => 2000000 };
    const ts3 = { seconds: 3000, toMillis: () => 3000000 };

    mockGetDoc
      .mockResolvedValueOnce(
        makeMockGetDocResult('event-1', {
          title: 'Event 1',
          time: ts1,
          location: 'A',
          city: 'Taipei',
          participantsCount: 3,
          maxParticipants: 10,
          hostUid: 'host-x',
        }),
      )
      .mockResolvedValueOnce(
        makeMockGetDocResult('event-2', {
          title: 'Event 2',
          time: ts2,
          location: 'B',
          city: 'Kaohsiung',
          participantsCount: 5,
          maxParticipants: 20,
          hostUid: 'host-y',
        }),
      )
      .mockResolvedValueOnce(
        makeMockGetDocResult('event-3', {
          title: 'Event 3',
          time: ts3,
          location: 'C',
          city: 'Taichung',
          participantsCount: 1,
          maxParticipants: 5,
          hostUid: 'user-1',
        }),
      );

    // Act
    const { fetchMyEvents } = await import('@/lib/firebase-member');
    const result = await fetchMyEvents('user-1', { pageSize: 2 });

    // Assert — sorted by time desc: event-3, event-2, event-1
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('event-3');
    expect(result.items[1].id).toBe('event-2');
    expect(result.nextCursor).toBe(2);
    expect(result.hostedIds).toBeInstanceOf(Set);
    expect(result.hostedIds.has('event-3')).toBe(true);
    expect(result.allEvents).toHaveLength(3);
  });

  it('should return null nextCursor when all items fit in one page', async () => {
    // Arrange
    mockGetDocs
      .mockResolvedValueOnce({ docs: [makeMockDoc('p1', { uid: 'u1', eventId: 'e1' })] })
      .mockResolvedValueOnce({ docs: [] });
    mockGetDoc.mockResolvedValueOnce(
      makeMockGetDocResult('e1', {
        title: 'Only',
        time: { seconds: 100, toMillis: () => 100000 },
        location: 'X',
        city: 'Y',
        participantsCount: 1,
        maxParticipants: 5,
        hostUid: 'other',
      }),
    );

    // Act
    const { fetchMyEvents } = await import('@/lib/firebase-member');
    const result = await fetchMyEvents('u1', { pageSize: 5 });

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('should use default pageSize of 5 when not specified', async () => {
    // Arrange — 7 events
    const participantDocs = Array.from({ length: 7 }, (_, i) =>
      makeMockDoc(`p${i}`, { uid: 'u1', eventId: `e${i}` }),
    );
    mockGetDocs
      .mockResolvedValueOnce({ docs: participantDocs })
      .mockResolvedValueOnce({ docs: [] });
    for (let i = 0; i < 7; i++) {
      mockGetDoc.mockResolvedValueOnce(
        makeMockGetDocResult(`e${i}`, {
          title: `Ev ${i}`,
          time: { seconds: i * 100, toMillis: () => i * 100000 },
          location: 'L',
          city: 'C',
          participantsCount: 1,
          maxParticipants: 10,
          hostUid: 'h',
        }),
      );
    }

    // Act
    const { fetchMyEvents } = await import('@/lib/firebase-member');
    const result = await fetchMyEvents('u1');

    // Assert
    expect(result.items).toHaveLength(5);
    expect(result.nextCursor).toBe(5);
  });

  it('should slice from allEvents when allEvents is provided (subsequent pages)', async () => {
    // Arrange — pre-built allEvents array (already sorted)
    const allEvents = /** @type {any[]} */ (
      Array.from({ length: 8 }, (_, i) => ({
        id: `e${7 - i}`,
        title: `Ev ${7 - i}`,
        time: { seconds: (7 - i) * 100, toMillis: () => (7 - i) * 100000 },
        location: 'L',
        city: 'C',
        participantsCount: 1,
        maxParticipants: 10,
        hostUid: 'h',
      }))
    );

    // Act — page 2, nextCursor=5, pageSize=5
    const { fetchMyEvents } = await import('@/lib/firebase-member');
    const result = await fetchMyEvents('u1', {
      prevResult: { nextCursor: 5, allEvents, hostedIds: new Set() },
      pageSize: 5,
    });

    // Assert — should get remaining 3 items
    expect(result.items).toHaveLength(3);
    expect(result.items[0].id).toBe('e2');
    expect(result.nextCursor).toBeNull();
    // Should NOT call getDocs or getDoc (no fetching)
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('should skip non-existent events during batch getDoc', async () => {
    // Arrange
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          makeMockDoc('p1', { uid: 'u1', eventId: 'exists' }),
          makeMockDoc('p2', { uid: 'u1', eventId: 'gone' }),
        ],
      })
      .mockResolvedValueOnce({ docs: [] });
    mockGetDoc
      .mockResolvedValueOnce(
        makeMockGetDocResult('exists', {
          title: 'E',
          time: { seconds: 100, toMillis: () => 100000 },
          location: 'L',
          city: 'C',
          participantsCount: 1,
          maxParticipants: 5,
          hostUid: 'h',
        }),
      )
      .mockResolvedValueOnce(makeMockGetDocResult('gone', {}, false));

    // Act
    const { fetchMyEvents } = await import('@/lib/firebase-member');
    const result = await fetchMyEvents('u1');

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('exists');
  });

  it('should deduplicate IDs when user is both participant and host of same event', async () => {
    // Arrange
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [makeMockDoc('p1', { uid: 'u1', eventId: 'shared-event' })],
      })
      .mockResolvedValueOnce({
        docs: [makeMockDoc('shared-event', { hostUid: 'u1' })],
      });
    mockGetDoc.mockResolvedValueOnce(
      makeMockGetDocResult('shared-event', {
        title: 'Shared',
        time: { seconds: 100, toMillis: () => 100000 },
        location: 'L',
        city: 'C',
        participantsCount: 1,
        maxParticipants: 5,
        hostUid: 'u1',
      }),
    );

    // Act
    const { fetchMyEvents } = await import('@/lib/firebase-member');
    const result = await fetchMyEvents('u1');

    // Assert — should only fetch once despite appearing in both queries
    expect(result.items).toHaveLength(1);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });
});

describe('Unit: fetchMyPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query posts by authorUid, ordered by postAt desc, with limit', async () => {
    // Arrange
    const postDocs = [
      makeMockDoc('post-1', {
        authorUid: 'u1',
        title: 'Post 1',
        content: 'Hello',
        postAt: { seconds: 2000 },
        likesCount: 5,
        commentsCount: 2,
      }),
      makeMockDoc('post-2', {
        authorUid: 'u1',
        title: 'Post 2',
        content: 'World',
        postAt: { seconds: 1000 },
        likesCount: 3,
        commentsCount: 1,
      }),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: postDocs });

    // Act
    const { fetchMyPosts } = await import('@/lib/firebase-member');
    const result = await fetchMyPosts('u1', { pageSize: 5 });

    // Assert
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('post-1');
    expect(result.items[0].title).toBe('Post 1');
    // 2 results < pageSize 5 → no more pages
    expect(result.lastDoc).toBeNull();
  });

  it('should return null lastDoc when results are fewer than pageSize', async () => {
    // Arrange
    const postDocs = [
      makeMockDoc('post-1', {
        authorUid: 'u1',
        title: 'Only Post',
        content: 'C',
        postAt: { seconds: 100 },
        likesCount: 0,
        commentsCount: 0,
      }),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: postDocs });

    // Act
    const { fetchMyPosts } = await import('@/lib/firebase-member');
    const result = await fetchMyPosts('u1', { pageSize: 5 });

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.lastDoc).toBeNull();
  });

  it('should use startAfter when afterDoc is provided', async () => {
    // Arrange
    const afterDocMock = makeMockDoc('prev-last', { authorUid: 'u1' });
    const postDocs = [
      makeMockDoc('post-3', {
        authorUid: 'u1',
        title: 'Post 3',
        content: 'C3',
        postAt: { seconds: 500 },
        likesCount: 1,
        commentsCount: 0,
      }),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: postDocs });

    // Act
    const { fetchMyPosts } = await import('@/lib/firebase-member');
    await fetchMyPosts('u1', { prevResult: { lastDoc: afterDocMock }, pageSize: 5 });

    // Assert
    expect(mockStartAfter).toHaveBeenCalledWith(afterDocMock);
  });

  it('should return empty items when no posts found', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { fetchMyPosts } = await import('@/lib/firebase-member');
    const result = await fetchMyPosts('u1');

    // Assert
    expect(result.items).toEqual([]);
    expect(result.lastDoc).toBeNull();
  });

  it('should use default pageSize of 5', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { fetchMyPosts } = await import('@/lib/firebase-member');
    await fetchMyPosts('u1');

    // Assert
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('should set lastDoc to last element when results equal pageSize', async () => {
    // Arrange
    const postDocs = Array.from({ length: 5 }, (_, i) =>
      makeMockDoc(`post-${i}`, {
        authorUid: 'u1',
        title: `P${i}`,
        content: `C${i}`,
        postAt: { seconds: (5 - i) * 100 },
        likesCount: 0,
        commentsCount: 0,
      }),
    );
    mockGetDocs.mockResolvedValueOnce({ docs: postDocs });

    // Act
    const { fetchMyPosts } = await import('@/lib/firebase-member');
    const result = await fetchMyPosts('u1', { pageSize: 5 });

    // Assert
    expect(result.lastDoc).toBe(postDocs[4]);
  });
});

describe('Unit: fetchMyComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query collectionGroup comments by authorUid, ordered by createdAt desc', async () => {
    // Arrange
    const commentDocs = [
      makeMockDoc(
        'c1',
        { authorUid: 'u1', comment: 'Nice post!', createdAt: { seconds: 2000 } },
        makeCommentRef('c1', 'posts', 'post-1'),
      ),
      makeMockDoc(
        'c2',
        { authorUid: 'u1', content: 'Great event!', createdAt: { seconds: 1000 } },
        makeCommentRef('c2', 'events', 'event-1'),
      ),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: commentDocs });

    // Mock parent getDoc for titles
    mockGetDoc
      .mockResolvedValueOnce(makeMockGetDocResult('post-1', { title: 'My Post' }))
      .mockResolvedValueOnce(makeMockGetDocResult('event-1', { title: 'My Event' }));

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    const result = await fetchMyComments('u1', { pageSize: 5 });

    // Assert
    expect(result.items).toHaveLength(2);

    // First comment — from post, text normalized from 'comment' field
    expect(result.items[0].id).toBe('c1');
    expect(result.items[0].source).toBe('post');
    expect(result.items[0].parentId).toBe('post-1');
    expect(result.items[0].parentTitle).toBe('My Post');
    expect(result.items[0].text).toBe('Nice post!');

    // Second comment — from event, text normalized from 'content' field
    expect(result.items[1].id).toBe('c2');
    expect(result.items[1].source).toBe('event');
    expect(result.items[1].parentId).toBe('event-1');
    expect(result.items[1].parentTitle).toBe('My Event');
    expect(result.items[1].text).toBe('Great event!');

    // titleCache should be returned for cross-page reuse
    expect(result.titleCache).toBeInstanceOf(Map);
    expect(result.titleCache.get('post-1')).toBe('My Post');
    expect(result.titleCache.get('event-1')).toBe('My Event');
  });

  it('should use titleCache to skip already-fetched parent titles', async () => {
    // Arrange
    const commentDocs = [
      makeMockDoc(
        'c1',
        { authorUid: 'u1', comment: 'Comment 1', createdAt: { seconds: 2000 } },
        makeCommentRef('c1', 'posts', 'post-1'),
      ),
      makeMockDoc(
        'c2',
        { authorUid: 'u1', comment: 'Comment 2', createdAt: { seconds: 1000 } },
        makeCommentRef('c2', 'posts', 'post-1'),
      ),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: commentDocs });
    mockGetDoc.mockResolvedValueOnce(makeMockGetDocResult('post-1', { title: 'Cached Post' }));

    // Act — pass empty titleCache via prevResult
    const titleCache = new Map();
    const { fetchMyComments } = await import('@/lib/firebase-member');
    const result = await fetchMyComments('u1', {
      prevResult: { lastDoc: null, titleCache },
      pageSize: 5,
    });

    // Assert — only 1 getDoc call for the 2 comments (same parent)
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(result.items[0].parentTitle).toBe('Cached Post');
    expect(result.items[1].parentTitle).toBe('Cached Post');
    // titleCache should be updated
    expect(titleCache.get('post-1')).toBe('Cached Post');
  });

  it('should use pre-populated titleCache and skip fetch entirely', async () => {
    // Arrange
    const commentDocs = [
      makeMockDoc(
        'c1',
        { authorUid: 'u1', comment: 'Already cached', createdAt: { seconds: 1000 } },
        makeCommentRef('c1', 'posts', 'post-cached'),
      ),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: commentDocs });

    const titleCache = new Map([['post-cached', 'Pre-cached Title']]);

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    const result = await fetchMyComments('u1', {
      prevResult: { lastDoc: null, titleCache },
      pageSize: 5,
    });

    // Assert — no getDoc calls, title from cache
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(result.items[0].parentTitle).toBe('Pre-cached Title');
  });

  it('should use startAfter when afterDoc is provided', async () => {
    // Arrange
    const afterDocMock = makeMockDoc('prev-comment', { authorUid: 'u1' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    await fetchMyComments('u1', { prevResult: { lastDoc: afterDocMock }, pageSize: 5 });

    // Assert
    expect(mockStartAfter).toHaveBeenCalledWith(afterDocMock);
  });

  it('should return null lastDoc when results are fewer than pageSize', async () => {
    // Arrange
    const commentDocs = [
      makeMockDoc(
        'c1',
        { authorUid: 'u1', comment: 'Solo', createdAt: { seconds: 100 } },
        makeCommentRef('c1', 'posts', 'p1'),
      ),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: commentDocs });
    mockGetDoc.mockResolvedValueOnce(makeMockGetDocResult('p1', { title: 'T' }));

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    const result = await fetchMyComments('u1', { pageSize: 5 });

    // Assert
    expect(result.lastDoc).toBeNull();
  });

  it('should set lastDoc when results equal pageSize', async () => {
    // Arrange
    const commentDocs = Array.from({ length: 3 }, (_, i) =>
      makeMockDoc(
        `c${i}`,
        { authorUid: 'u1', comment: `C${i}`, createdAt: { seconds: (3 - i) * 100 } },
        makeCommentRef(`c${i}`, 'posts', `p${i}`),
      ),
    );
    mockGetDocs.mockResolvedValueOnce({ docs: commentDocs });
    for (let i = 0; i < 3; i++) {
      mockGetDoc.mockResolvedValueOnce(makeMockGetDocResult(`p${i}`, { title: `T${i}` }));
    }

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    const result = await fetchMyComments('u1', { pageSize: 3 });

    // Assert
    expect(result.lastDoc).toBe(commentDocs[2]);
  });

  it('should handle non-existent parent docs gracefully', async () => {
    // Arrange
    const commentDocs = [
      makeMockDoc(
        'c1',
        { authorUid: 'u1', comment: 'Orphaned', createdAt: { seconds: 100 } },
        makeCommentRef('c1', 'posts', 'deleted-post'),
      ),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: commentDocs });
    mockGetDoc.mockResolvedValueOnce(makeMockGetDocResult('deleted-post', {}, false));

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    const result = await fetchMyComments('u1', { pageSize: 5 });

    // Assert — should still include the comment, with fallback title
    expect(result.items).toHaveLength(1);
    expect(result.items[0].parentTitle).toBe('(已刪除)');
  });

  it('should return empty items when no comments found', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    const result = await fetchMyComments('u1');

    // Assert
    expect(result.items).toEqual([]);
    expect(result.lastDoc).toBeNull();
  });

  it('should use default pageSize of 5', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { fetchMyComments } = await import('@/lib/firebase-member');
    await fetchMyComments('u1');

    // Assert
    expect(mockLimit).toHaveBeenCalledWith(5);
  });
});
