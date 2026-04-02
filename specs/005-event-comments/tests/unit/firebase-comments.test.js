/**
 * @file Unit Test for firebase-comments.js and comment helpers
 * @description
 * TDD RED phase — tests for comment CRUD functions that do NOT exist yet.
 * Covers: FR-002, FR-003, FR-006, FR-007, FR-008, FR-009, FR-011, FR-012,
 *         FR-013, FR-015, FR-016, FR-021, FR-024.
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. AAA Pattern (Arrange, Act, Assert) is mandatory.
 * 3. NO `console.log`.
 * 4. STRICT JSDoc is required.
 * 5. Mock Firebase at the correct level — preserve behavior tests depend on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

/** @type {import('vitest').Mock} */
const mockDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockCollection = vi.fn();
/** @type {import('vitest').Mock} */
const mockQuery = vi.fn();
/** @type {import('vitest').Mock} */
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
/** @type {import('vitest').Mock} */
const mockGetDoc = vi.fn().mockResolvedValue(
  /** @type {import('firebase/firestore').DocumentSnapshot} */ (
    /** @type {unknown} */ ({
      exists: () => true,
      id: 'comment-1',
      data: () => ({
        authorUid: 'user-1',
        authorName: 'Alice',
        authorPhotoURL: 'https://example.com/alice.jpg',
        content: '好棒的路線！',
        createdAt: { toDate: () => new Date('2026-04-02T14:30:00') },
        updatedAt: null,
        isEdited: false,
      }),
    })
  ),
);
/** @type {import('vitest').Mock} */
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-comment-id' });
/** @type {import('vitest').Mock} */
const mockOrderBy = vi.fn();
/** @type {import('vitest').Mock} */
const mockLimit = vi.fn();
/** @type {import('vitest').Mock} */
const mockStartAfter = vi.fn();
/** @type {import('vitest').Mock} */
const mockServerTimestamp = vi.fn(() => ({ _serverTimestamp: true }));
/** @type {import('vitest').Mock} */
const mockRunTransaction = vi.fn().mockImplementation(async (_, callback) => {
  const mockTx = {
    get: vi.fn().mockResolvedValue(
      /** @type {import('firebase/firestore').DocumentSnapshot} */ (
        /** @type {unknown} */ ({
          exists: () => true,
          data: () => ({
            authorUid: 'user-1',
            authorName: 'Alice',
            authorPhotoURL: 'https://example.com/alice.jpg',
            content: '原始留言',
            createdAt: { toDate: () => new Date('2026-04-02T14:30:00') },
            updatedAt: null,
            isEdited: false,
          }),
        })
      ),
    ),
    update: vi.fn(),
    set: vi.fn(),
  };
  return callback(mockTx);
});
/** @type {import('vitest').Mock} */
const mockWriteBatch = vi.fn(() => ({
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  query: mockQuery,
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  addDoc: mockAddDoc,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  serverTimestamp: mockServerTimestamp,
  runTransaction: mockRunTransaction,
  writeBatch: mockWriteBatch,
}));

vi.mock('@/lib/firebase-client', () => ({
  db: 'mock-db',
}));

// ---------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MockCommentData
 * @property {string} authorUid - 留言者 UID。
 * @property {string} authorName - 留言者名稱。
 * @property {string} authorPhotoURL - 留言者大頭貼 URL。
 * @property {string} content - 留言文字內容。
 * @property {{ toDate: () => Date }} createdAt - 建立時間 mock。
 * @property {{ toDate: () => Date } | null} updatedAt - 最後編輯時間 mock。
 * @property {boolean} isEdited - 是否曾被編輯。
 */

/**
 * @typedef {object} MockUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 使用者名稱。
 * @property {string} photoURL - 大頭貼 URL。
 */

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Unit: fetchComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query comments ordered by createdAt DESC with limit', async () => {
    // Arrange
    const { fetchComments } = await import('@/lib/firebase-comments');

    /** @type {MockCommentData} */
    const commentData = {
      authorUid: 'user-1',
      authorName: 'Alice',
      authorPhotoURL: 'https://example.com/alice.jpg',
      content: '好棒的路線！',
      createdAt: { toDate: () => new Date('2026-04-02T14:30:00') },
      updatedAt: null,
      isEdited: false,
    };

    const mockDocSnap = { id: 'comment-1', data: () => commentData };
    mockGetDocs.mockResolvedValueOnce({ docs: [mockDocSnap] });

    // Act
    const result = await fetchComments('event-123');

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'events', 'event-123', 'comments');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(15);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].content).toBe('好棒的路線！');
  });

  it('should return empty array and null lastDoc when no comments exist', async () => {
    // Arrange
    const { fetchComments } = await import('@/lib/firebase-comments');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const result = await fetchComments('event-123');

    // Assert
    expect(result.comments).toEqual([]);
    expect(result.lastDoc).toBeNull();
  });

  it('should include doc id in each comment object', async () => {
    // Arrange
    const { fetchComments } = await import('@/lib/firebase-comments');

    const mockDocSnap = {
      id: 'comment-abc',
      data: () => ({
        authorUid: 'user-1',
        authorName: 'Bob',
        authorPhotoURL: '',
        content: '加油！',
        createdAt: { toDate: () => new Date('2026-04-01T10:00:00') },
        updatedAt: null,
        isEdited: false,
      }),
    };
    mockGetDocs.mockResolvedValueOnce({ docs: [mockDocSnap] });

    // Act
    const result = await fetchComments('event-123');

    // Assert
    expect(result.comments[0].id).toBe('comment-abc');
  });

  it('should accept custom limitCount', async () => {
    // Arrange
    const { fetchComments } = await import('@/lib/firebase-comments');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    await fetchComments('event-123', 30);

    // Assert
    expect(mockLimit).toHaveBeenCalledWith(30);
  });

  it('should throw when eventId is empty', async () => {
    // Arrange
    const { fetchComments } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(fetchComments('')).rejects.toThrow();
  });
});

describe('Unit: fetchMoreComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use startAfter with the provided cursor document', async () => {
    // Arrange
    const { fetchMoreComments } = await import('@/lib/firebase-comments');
    const cursorDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (
      /** @type {unknown} */ ({ id: 'cursor-doc' })
    );
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    await fetchMoreComments('event-123', cursorDoc);

    // Assert
    expect(mockStartAfter).toHaveBeenCalledWith(cursorDoc);
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(15);
  });

  it('should return empty when no more documents exist', async () => {
    // Arrange
    const { fetchMoreComments } = await import('@/lib/firebase-comments');
    const cursorDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (
      /** @type {unknown} */ ({ id: 'cursor-doc' })
    );
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const result = await fetchMoreComments('event-123', cursorDoc);

    // Assert
    expect(result.comments).toEqual([]);
    expect(result.lastDoc).toBeNull();
  });

  it('should throw when eventId is empty', async () => {
    // Arrange
    const { fetchMoreComments } = await import('@/lib/firebase-comments');
    const cursorDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (
      /** @type {unknown} */ ({ id: 'cursor-doc' })
    );

    // Act & Assert
    await expect(fetchMoreComments('', cursorDoc)).rejects.toThrow();
  });
});

describe('Unit: getCommentById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return comment data with id when document exists', async () => {
    // Arrange
    const { getCommentById } = await import('@/lib/firebase-comments');
    mockGetDoc.mockResolvedValueOnce(
      /** @type {import('firebase/firestore').DocumentSnapshot} */ (
        /** @type {unknown} */ ({
          exists: () => true,
          id: 'comment-1',
          data: () => ({
            authorUid: 'user-1',
            authorName: 'Alice',
            authorPhotoURL: 'https://example.com/alice.jpg',
            content: '測試留言',
            createdAt: { toDate: () => new Date('2026-04-02T14:30:00') },
            updatedAt: null,
            isEdited: false,
          }),
        })
      ),
    );

    // Act
    const result = await getCommentById('event-123', 'comment-1');

    // Assert
    expect(result).not.toBeNull();
    expect(result?.id).toBe('comment-1');
    expect(result?.content).toBe('測試留言');
  });

  it('should return null when document does not exist', async () => {
    // Arrange
    const { getCommentById } = await import('@/lib/firebase-comments');
    mockGetDoc.mockResolvedValueOnce(
      /** @type {import('firebase/firestore').DocumentSnapshot} */ (
        /** @type {unknown} */ ({
          exists: () => false,
        })
      ),
    );

    // Act
    const result = await getCommentById('event-123', 'non-existent');

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when eventId or commentId is empty', async () => {
    // Arrange
    const { getCommentById } = await import('@/lib/firebase-comments');

    // Act & Assert
    const result1 = await getCommentById('', 'comment-1');
    expect(result1).toBeNull();

    const result2 = await getCommentById('event-123', '');
    expect(result2).toBeNull();
  });
});

describe('Unit: addComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** @type {MockUser} */
  const validUser = {
    uid: 'user-1',
    name: 'Alice',
    photoURL: 'https://example.com/alice.jpg',
  };

  it('should addDoc with correct fields and serverTimestamp', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-comments');

    // Act
    const result = await addComment('event-123', validUser, '好棒的路線！');

    // Assert
    expect(result).toEqual({ id: 'new-comment-id' });
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const addDocArg = mockAddDoc.mock.calls[0][1];
    expect(addDocArg.authorUid).toBe('user-1');
    expect(addDocArg.authorName).toBe('Alice');
    expect(addDocArg.authorPhotoURL).toBe('https://example.com/alice.jpg');
    expect(addDocArg.content).toBe('好棒的路線！');
    expect(addDocArg.createdAt).toEqual({ _serverTimestamp: true });
    expect(addDocArg.updatedAt).toBeNull();
    expect(addDocArg.isEdited).toBe(false);
  });

  it('should trim content before saving', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-comments');

    // Act
    await addComment('event-123', validUser, '  前後有空白  ');

    // Assert
    const addDocArg = mockAddDoc.mock.calls[0][1];
    expect(addDocArg.content).toBe('前後有空白');
  });

  it('should throw when content is empty or whitespace only', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(addComment('event-123', validUser, '')).rejects.toThrow();
    await expect(addComment('event-123', validUser, '   ')).rejects.toThrow();
  });

  it('should throw when content exceeds 500 characters', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-comments');
    const longContent = 'A'.repeat(501);

    // Act & Assert
    await expect(addComment('event-123', validUser, longContent)).rejects.toThrow();
  });

  it('should throw when user is null or missing uid', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(
      addComment('event-123', /** @type {MockUser} */ (/** @type {unknown} */ (null)), '留言'),
    ).rejects.toThrow();
    await expect(
      addComment(
        'event-123',
        /** @type {MockUser} */ (/** @type {unknown} */ ({ name: 'No UID' })),
        '留言',
      ),
    ).rejects.toThrow();
  });

  it('should throw when eventId is empty', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(addComment('', validUser, '留言')).rejects.toThrow();
  });

  it('should propagate Firestore errors', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-comments');
    mockAddDoc.mockRejectedValueOnce(new Error('Firestore write failed'));

    // Act & Assert
    await expect(addComment('event-123', validUser, '留言')).rejects.toThrow(
      'Firestore write failed',
    );
  });
});

describe('Unit: updateComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run transaction: read comment, addDoc history, update comment', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-comments');

    const mockTxUpdate = vi.fn();
    const mockTxSet = vi.fn();
    mockRunTransaction.mockImplementationOnce(async (_, callback) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue(
          /** @type {import('firebase/firestore').DocumentSnapshot} */ (
            /** @type {unknown} */ ({
              exists: () => true,
              data: () => ({
                content: '原始留言',
                createdAt: { toDate: () => new Date('2026-04-02T14:30:00') },
                updatedAt: null,
                isEdited: false,
              }),
            })
          ),
        ),
        update: mockTxUpdate,
        set: mockTxSet,
      };
      return callback(mockTx);
    });

    // Act
    await updateComment('event-123', 'comment-1', '更新後的留言', '原始留言');

    // Assert
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxSet).toHaveBeenCalledTimes(1);
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);

    const updateArg = mockTxUpdate.mock.calls[0][1];
    expect(updateArg.content).toBe('更新後的留言');
    expect(updateArg.isEdited).toBe(true);
    expect(updateArg.updatedAt).toEqual({ _serverTimestamp: true });
  });

  it('should trim newContent before comparing and saving', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-comments');

    const mockTxUpdate = vi.fn();
    const mockTxSet = vi.fn();
    mockRunTransaction.mockImplementationOnce(async (_, callback) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue(
          /** @type {import('firebase/firestore').DocumentSnapshot} */ (
            /** @type {unknown} */ ({
              exists: () => true,
              data: () => ({
                content: '原始留言',
                createdAt: { toDate: () => new Date('2026-04-02T14:30:00') },
                updatedAt: null,
                isEdited: false,
              }),
            })
          ),
        ),
        update: mockTxUpdate,
        set: mockTxSet,
      };
      return callback(mockTx);
    });

    // Act
    await updateComment('event-123', 'comment-1', '  更新內容  ', '原始留言');

    // Assert
    const updateArg = mockTxUpdate.mock.calls[0][1];
    expect(updateArg.content).toBe('更新內容');
  });

  it('should throw when newContent trim equals oldContent', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(
      updateComment('event-123', 'comment-1', '  原始留言  ', '原始留言'),
    ).rejects.toThrow();
  });

  it('should throw when newContent is empty after trim', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(updateComment('event-123', 'comment-1', '   ', '原始留言')).rejects.toThrow();
  });

  it('should throw when newContent exceeds 500 characters', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-comments');
    const longContent = 'B'.repeat(501);

    // Act & Assert
    await expect(
      updateComment('event-123', 'comment-1', longContent, '原始留言'),
    ).rejects.toThrow();
  });

  it('should throw when comment does not exist in transaction', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-comments');
    mockRunTransaction.mockImplementationOnce(async (_, callback) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue(
          /** @type {import('firebase/firestore').DocumentSnapshot} */ (
            /** @type {unknown} */ ({
              exists: () => false,
            })
          ),
        ),
        update: vi.fn(),
        set: vi.fn(),
      };
      return callback(mockTx);
    });

    // Act & Assert
    await expect(updateComment('event-123', 'non-existent', '新內容', '舊內容')).rejects.toThrow();
  });

  it('should propagate transaction failure', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-comments');
    mockRunTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

    // Act & Assert
    await expect(updateComment('event-123', 'comment-1', '新內容', '舊內容')).rejects.toThrow(
      'Transaction failed',
    );
  });
});

describe('Unit: deleteComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should writeBatch: query history subcollection then delete all plus comment', async () => {
    // Arrange
    const { deleteComment } = await import('@/lib/firebase-comments');

    const historyDocs = [
      { ref: { id: 'h1', path: 'events/e/comments/c/history/h1' } },
      { ref: { id: 'h2', path: 'events/e/comments/c/history/h2' } },
    ];
    mockGetDocs.mockResolvedValueOnce(
      /** @type {import('firebase/firestore').QuerySnapshot} */ (
        /** @type {unknown} */ ({ docs: historyDocs })
      ),
    );

    const mockBatchDelete = vi.fn();
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValueOnce(
      /** @type {import('firebase/firestore').WriteBatch} */ (
        /** @type {unknown} */ ({
          delete: mockBatchDelete,
          commit: mockBatchCommit,
        })
      ),
    );

    // Act
    await deleteComment('event-123', 'comment-1');

    // Assert
    expect(mockWriteBatch).toHaveBeenCalledTimes(1);
    // 2 history + 1 comment = 3 deletes
    expect(mockBatchDelete).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('should succeed when comment has no history entries', async () => {
    // Arrange
    const { deleteComment } = await import('@/lib/firebase-comments');
    mockGetDocs.mockResolvedValueOnce(
      /** @type {import('firebase/firestore').QuerySnapshot} */ (
        /** @type {unknown} */ ({ docs: [] })
      ),
    );

    const mockBatchDelete = vi.fn();
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValueOnce(
      /** @type {import('firebase/firestore').WriteBatch} */ (
        /** @type {unknown} */ ({
          delete: mockBatchDelete,
          commit: mockBatchCommit,
        })
      ),
    );

    // Act
    await deleteComment('event-123', 'comment-1');

    // Assert
    // Only the comment doc itself
    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('should throw when eventId or commentId is empty', async () => {
    // Arrange
    const { deleteComment } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(deleteComment('', 'comment-1')).rejects.toThrow();
    await expect(deleteComment('event-123', '')).rejects.toThrow();
  });

  it('should propagate batch commit failure', async () => {
    // Arrange
    const { deleteComment } = await import('@/lib/firebase-comments');
    mockGetDocs.mockResolvedValueOnce(
      /** @type {import('firebase/firestore').QuerySnapshot} */ (
        /** @type {unknown} */ ({ docs: [] })
      ),
    );
    mockWriteBatch.mockReturnValueOnce(
      /** @type {import('firebase/firestore').WriteBatch} */ (
        /** @type {unknown} */ ({
          delete: vi.fn(),
          commit: vi.fn().mockRejectedValueOnce(new Error('Batch commit failed')),
        })
      ),
    );

    // Act & Assert
    await expect(deleteComment('event-123', 'comment-1')).rejects.toThrow('Batch commit failed');
  });
});

describe('Unit: fetchCommentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return history entries ordered by editedAt ASC', async () => {
    // Arrange
    const { fetchCommentHistory } = await import('@/lib/firebase-comments');

    const historyDocs = [
      {
        id: 'h1',
        data: () => ({
          content: '第一版',
          editedAt: { toDate: () => new Date('2026-04-02T10:00:00') },
        }),
      },
      {
        id: 'h2',
        data: () => ({
          content: '第二版',
          editedAt: { toDate: () => new Date('2026-04-02T11:00:00') },
        }),
      },
    ];
    mockGetDocs.mockResolvedValueOnce({ docs: historyDocs });

    // Act
    const result = await fetchCommentHistory('event-123', 'comment-1');

    // Assert
    expect(mockOrderBy).toHaveBeenCalledWith('editedAt', 'asc');
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('第一版');
    expect(result[1].content).toBe('第二版');
  });

  it('should return empty array when no history exists', async () => {
    // Arrange
    const { fetchCommentHistory } = await import('@/lib/firebase-comments');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const result = await fetchCommentHistory('event-123', 'comment-1');

    // Assert
    expect(result).toEqual([]);
  });

  it('should throw when eventId or commentId is empty', async () => {
    // Arrange
    const { fetchCommentHistory } = await import('@/lib/firebase-comments');

    // Act & Assert
    await expect(fetchCommentHistory('', 'comment-1')).rejects.toThrow();
    await expect(fetchCommentHistory('event-123', '')).rejects.toThrow();
  });
});

describe('Unit: formatCommentTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format Firestore Timestamp to month/day hour:minute in 24hr', async () => {
    // Arrange
    const { formatCommentTime } = await import('@/lib/event-helpers');
    const timestamp = /** @type {import('firebase/firestore').Timestamp} */ (
      /** @type {unknown} */ ({
        toDate: () => new Date('2026-04-02T14:30:00'),
      })
    );

    // Act
    const result = formatCommentTime(timestamp);

    // Assert
    expect(result).toBe('4/2 14:30');
  });

  it('should pad minutes but not pad month or day', async () => {
    // Arrange
    const { formatCommentTime } = await import('@/lib/event-helpers');
    const timestamp = /** @type {import('firebase/firestore').Timestamp} */ (
      /** @type {unknown} */ ({
        toDate: () => new Date('2026-01-05T09:05:00'),
      })
    );

    // Act
    const result = formatCommentTime(timestamp);

    // Assert
    expect(result).toBe('1/5 09:05');
  });

  it('should handle midnight as 00:00', async () => {
    // Arrange
    const { formatCommentTime } = await import('@/lib/event-helpers');
    const timestamp = /** @type {import('firebase/firestore').Timestamp} */ (
      /** @type {unknown} */ ({
        toDate: () => new Date('2026-12-25T00:00:00'),
      })
    );

    // Act
    const result = formatCommentTime(timestamp);

    // Assert
    expect(result).toBe('12/25 00:00');
  });

  it('should return empty string for null or undefined', async () => {
    // Arrange
    const { formatCommentTime } = await import('@/lib/event-helpers');

    // Act & Assert
    expect(
      formatCommentTime(
        /** @type {import('firebase/firestore').Timestamp} */ (/** @type {unknown} */ (null)),
      ),
    ).toBe('');
    expect(
      formatCommentTime(
        /** @type {import('firebase/firestore').Timestamp} */ (/** @type {unknown} */ (undefined)),
      ),
    ).toBe('');
  });
});

describe('Unit: formatCommentTimeFull', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format to YYYY年M月D日 HH:MM', async () => {
    // Arrange
    const { formatCommentTimeFull } = await import('@/lib/event-helpers');
    const timestamp = /** @type {import('firebase/firestore').Timestamp} */ (
      /** @type {unknown} */ ({
        toDate: () => new Date('2026-04-02T14:30:00'),
      })
    );

    // Act
    const result = formatCommentTimeFull(timestamp);

    // Assert
    expect(result).toBe('2026年4月2日 14:30');
  });

  it('should return empty string for null or undefined', async () => {
    // Arrange
    const { formatCommentTimeFull } = await import('@/lib/event-helpers');

    // Act & Assert
    expect(
      formatCommentTimeFull(
        /** @type {import('firebase/firestore').Timestamp} */ (/** @type {unknown} */ (null)),
      ),
    ).toBe('');
    expect(
      formatCommentTimeFull(
        /** @type {import('firebase/firestore').Timestamp} */ (/** @type {unknown} */ (undefined)),
      ),
    ).toBe('');
  });
});
