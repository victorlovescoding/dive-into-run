/**
 * @file Unit test for firebase-posts.js Comments subcollection + Likes (mock-audit D2)
 * @description
 * 補足 firebase-posts.js 9 個 exports 的 self-test，實際執行 lib 程式碼。
 * 接續 D1（Post 主線 8 exports），本檔覆蓋：
 *
 *   Comments subcollection (6):
 *     getLatestComments / getMoreComments / getCommentById
 *     addComment / updateComment / deleteComment
 *   Likes (3):
 *     toggleLikePost / hasUserLikedPosts / hasUserLikedPost
 *
 * 對 runTransaction 使用 closure capture pattern：在 mockImplementationOnce 裡
 * 把 tx.get/set/update/delete 指向 outer scope 的 vi.fn()，之後可直接 assert。
 *
 * Rules: AAA pattern、strict JSDoc、mock firebase/firestore + firebase-client。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

/** @type {import('vitest').Mock} */
const mockAddDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockUpdateDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockGetDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockGetDocs = vi.fn();
/** @type {import('vitest').Mock} */
const mockDoc = vi.fn((_db, ...segments) => ({
  _docRef: segments,
  id: segments.length > 0 ? segments[segments.length - 1] : 'auto-generated-id',
}));
/** @type {import('vitest').Mock} */
const mockCollection = vi.fn((_db, ...segments) => ({ _collectionRef: segments }));
/** @type {import('vitest').Mock} */
const mockCollectionGroup = vi.fn((_db, name) => ({ _collectionGroup: name }));
/** @type {import('vitest').Mock} */
const mockQuery = vi.fn((...args) => ({ _query: args }));
/** @type {import('vitest').Mock} */
const mockOrderBy = vi.fn((field, dir) => ({ _orderBy: [field, dir] }));
/** @type {import('vitest').Mock} */
const mockWhere = vi.fn((field, op, val) => ({ _where: [field, op, val] }));
/** @type {import('vitest').Mock} */
const mockLimit = vi.fn((n) => ({ _limit: n }));
/** @type {import('vitest').Mock} */
const mockStartAfter = vi.fn((...args) => ({ _startAfter: args }));
/** @type {import('vitest').Mock} */
const mockDocumentId = vi.fn(() => '__name__');
/** @type {import('vitest').Mock} */
const mockServerTimestamp = vi.fn(() => ({ _serverTimestamp: true }));
/** @type {import('vitest').Mock} */
const mockIncrement = vi.fn((n) => ({ _inc: n }));
/** @type {import('vitest').Mock} */
const mockRunTransaction = vi.fn();
/** @type {import('vitest').Mock} */
const mockWriteBatch = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  serverTimestamp: mockServerTimestamp,
  limit: mockLimit,
  query: mockQuery,
  orderBy: mockOrderBy,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  runTransaction: mockRunTransaction,
  increment: mockIncrement,
  where: mockWhere,
  writeBatch: mockWriteBatch,
  startAfter: mockStartAfter,
  documentId: mockDocumentId,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

// ---------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MockUser
 * @property {string} uid - 使用者 UID。
 * @property {string} [name] - 使用者顯示名稱。
 * @property {string} [photoURL] - 使用者大頭貼 URL。
 */

/**
 * @typedef {object} MockCommentCursor
 * @property {string} id - 上一頁最後一筆留言 ID。
 * @property {unknown} createdAt - 上一頁最後一筆留言的 createdAt Timestamp。
 */

/**
 * @typedef {object} MockTx
 * @property {import('vitest').Mock} get - Transaction get mock。
 * @property {import('vitest').Mock} set - Transaction set mock。
 * @property {import('vitest').Mock} update - Transaction update mock。
 * @property {import('vitest').Mock} delete - Transaction delete mock。
 */

/**
 * 建立 runTransaction mockImplementationOnce 的 helper — 回傳 closure-captured tx mocks。
 * @param {object} [opts] - 選項。
 * @param {object} [opts.getSnap] - tx.get 要 resolve 的 snapshot（預設 exists=true）。
 * @returns {MockTx} 可供 assert 的 tx methods。
 */
function setupTxOnce(opts = {}) {
  const getSnap = /** @type {{ exists: () => boolean, data?: () => object }} */ (
    opts.getSnap ?? { exists: () => true, data: () => ({}) }
  );
  /** @type {MockTx} */
  const tx = {
    get: vi.fn().mockResolvedValue(getSnap),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  mockRunTransaction.mockImplementationOnce((_db, callback) => callback(tx));
  return tx;
}

// ---------------------------------------------------------------------------
// getLatestComments
// ---------------------------------------------------------------------------

describe('Unit: getLatestComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query posts/{id}/comments with orderBy(createdAt desc) + orderBy(__name__ desc) + limit(n)', async () => {
    // Arrange
    const { getLatestComments } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    await getLatestComments('post-1', 5);

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'posts', 'post-1', 'comments');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockOrderBy).toHaveBeenCalledWith('__name__', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('should map docs to Comment objects with id field', async () => {
    // Arrange
    const { getLatestComments } = await import('@/lib/firebase-posts');
    const docs = [
      { id: 'c1', data: () => ({ comment: 'hi', authorUid: 'u1' }) },
      { id: 'c2', data: () => ({ comment: 'yo', authorUid: 'u2' }) },
    ];
    mockGetDocs.mockResolvedValueOnce({ docs });

    // Act
    const result = await getLatestComments('post-1', 10);

    // Assert
    expect(result).toEqual([
      { id: 'c1', comment: 'hi', authorUid: 'u1' },
      { id: 'c2', comment: 'yo', authorUid: 'u2' },
    ]);
  });

  it('should return empty array when no docs', async () => {
    // Arrange
    const { getLatestComments } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const result = await getLatestComments('post-1', 10);

    // Assert
    expect(result).toEqual([]);
  });

  it('should propagate getDocs rejection', async () => {
    // Arrange
    const { getLatestComments } = await import('@/lib/firebase-posts');
    mockGetDocs.mockRejectedValueOnce(new Error('getDocs failed'));

    // Act & Assert
    await expect(getLatestComments('post-1', 10)).rejects.toThrow('getDocs failed');
  });
});

// ---------------------------------------------------------------------------
// getMoreComments (pagination — 無 !last 早返回)
// ---------------------------------------------------------------------------

describe('Unit: getMoreComments (pagination)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call startAfter(last.createdAt, last.id) and limit(10)', async () => {
    // Arrange
    const { getMoreComments } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    /** @type {MockCommentCursor} */
    const last = { id: 'c-last', createdAt: 'ts-last' };

    // Act
    await getMoreComments(
      'post-1',
      /** @type {import('@/lib/firebase-posts').Comment} */ (/** @type {unknown} */ (last)),
    );

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'posts', 'post-1', 'comments');
    expect(mockStartAfter).toHaveBeenCalledWith('ts-last', 'c-last');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should map docs to Comment objects with id field', async () => {
    // Arrange
    const { getMoreComments } = await import('@/lib/firebase-posts');
    const docs = [{ id: 'c3', data: () => ({ comment: 'later' }) }];
    mockGetDocs.mockResolvedValueOnce({ docs });
    /** @type {MockCommentCursor} */
    const last = { id: 'c-last', createdAt: 'ts-last' };

    // Act
    const result = await getMoreComments(
      'post-1',
      /** @type {import('@/lib/firebase-posts').Comment} */ (/** @type {unknown} */ (last)),
    );

    // Assert
    expect(result).toEqual([{ id: 'c3', comment: 'later' }]);
  });

  it('should propagate getDocs rejection', async () => {
    // Arrange
    const { getMoreComments } = await import('@/lib/firebase-posts');
    mockGetDocs.mockRejectedValueOnce(new Error('fail'));
    /** @type {MockCommentCursor} */
    const last = { id: 'c', createdAt: 't' };

    // Act & Assert
    await expect(
      getMoreComments(
        'post-1',
        /** @type {import('@/lib/firebase-posts').Comment} */ (/** @type {unknown} */ (last)),
      ),
    ).rejects.toThrow('fail');
  });
});

// ---------------------------------------------------------------------------
// getCommentById
// ---------------------------------------------------------------------------

describe('Unit: getCommentById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return Comment with id when doc exists', async () => {
    // Arrange
    const { getCommentById } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'c-1',
      data: () => ({ comment: 'hi', authorUid: 'u1' }),
    });

    // Act
    const result = await getCommentById('post-1', 'c-1');

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', 'post-1', 'comments', 'c-1');
    expect(result).toEqual({ id: 'c-1', comment: 'hi', authorUid: 'u1' });
  });

  it('should return null when doc does not exist', async () => {
    // Arrange
    const { getCommentById } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    // Act
    const result = await getCommentById('post-1', 'missing');

    // Assert
    expect(result).toBeNull();
  });

  it('should propagate getDoc rejection', async () => {
    // Arrange
    const { getCommentById } = await import('@/lib/firebase-posts');
    mockGetDoc.mockRejectedValueOnce(new Error('getDoc failed'));

    // Act & Assert
    await expect(getCommentById('post-1', 'c-1')).rejects.toThrow('getDoc failed');
  });
});

// ---------------------------------------------------------------------------
// toggleLikePost — catch 吞 error → 'fail'
// ---------------------------------------------------------------------------

describe('Unit: toggleLikePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw "No uid" synchronously when uid falsy (not enter runTransaction)', async () => {
    // Arrange
    const { toggleLikePost } = await import('@/lib/firebase-posts');

    // Act & Assert
    await expect(toggleLikePost('post-1', '')).rejects.toThrow('No uid');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('should decrement likesCount and delete likeRef when already liked', async () => {
    // Arrange
    const { toggleLikePost } = await import('@/lib/firebase-posts');
    const tx = setupTxOnce({ getSnap: { exists: () => true } });

    // Act
    const result = await toggleLikePost('post-1', 'u1');

    // Assert
    expect(result).toBe('success');
    // postRef has id='post-1', likeRef has id='u1' (from enhanced mockDoc)
    expect(tx.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }), {
      likesCount: { _inc: -1 },
    });
    expect(tx.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
    expect(tx.set).not.toHaveBeenCalled();
  });

  it('should increment likesCount and set likeRef when not yet liked', async () => {
    // Arrange
    const { toggleLikePost } = await import('@/lib/firebase-posts');
    const tx = setupTxOnce({ getSnap: { exists: () => false } });

    // Act
    const result = await toggleLikePost('post-1', 'u1');

    // Assert
    expect(result).toBe('success');
    expect(tx.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }), {
      likesCount: { _inc: 1 },
    });
    expect(tx.set).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), {
      uid: 'u1',
      postId: 'post-1',
      createdAt: { _serverTimestamp: true },
    });
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('should return "fail" (not throw) when runTransaction rejects', async () => {
    // Arrange
    const { toggleLikePost } = await import('@/lib/firebase-posts');
    mockRunTransaction.mockRejectedValueOnce(new Error('tx failed'));

    // Act
    const result = await toggleLikePost('post-1', 'u1');

    // Assert — catch 吞 error，回 'fail' 而非 throw
    expect(result).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// addComment — 最複雜，涵蓋 validation / tx / console.error / re-throw
// ---------------------------------------------------------------------------

describe('Unit: addComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw "No user" when user missing or uid missing (not enter tx)', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-posts');

    // Act & Assert
    await expect(
      addComment('post-1', {
        user: /** @type {MockUser} */ (/** @type {unknown} */ (null)),
        comment: 'hi',
      }),
    ).rejects.toThrow('No user');
    await expect(
      addComment('post-1', {
        user: /** @type {MockUser} */ (/** @type {unknown} */ ({})),
        comment: 'hi',
      }),
    ).rejects.toThrow('No user');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('should throw "Empty comment" when comment is empty or whitespace only (not enter tx)', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-posts');
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'Alice' };

    // Act & Assert
    await expect(addComment('post-1', { user, comment: '' })).rejects.toThrow('Empty comment');
    await expect(addComment('post-1', { user, comment: '   ' })).rejects.toThrow('Empty comment');
    await expect(
      addComment('post-1', {
        user,
        comment: /** @type {string} */ (/** @type {unknown} */ (null)),
      }),
    ).rejects.toThrow('Empty comment');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('should set comment + update commentsCount +1 and return {id} on happy path', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-posts');
    const tx = setupTxOnce({ getSnap: { exists: () => true } });
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'Alice', photoURL: 'https://img/a.jpg' };

    // Act
    const result = await addComment('post-1', { user, comment: '  hello  ' });

    // Assert
    expect(result).toEqual({ id: expect.any(String) });
    expect(tx.set).toHaveBeenCalledWith(expect.objectContaining({ id: 'auto-generated-id' }), expect.any(Object));
    const setPayload = tx.set.mock.calls[0][1];
    expect(setPayload.authorUid).toBe('u1');
    expect(setPayload.authorName).toBe('Alice');
    expect(setPayload.authorImgURL).toBe('https://img/a.jpg');
    expect(setPayload.comment).toBe('hello'); // trimmed
    expect(setPayload.createdAt).toEqual({ _serverTimestamp: true });
    expect(tx.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }), {
      commentsCount: { _inc: 1 },
    });
  });

  it('should fallback authorName to 匿名使用者 when user.name missing', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-posts');
    const tx = setupTxOnce({ getSnap: { exists: () => true } });
    /** @type {MockUser} */
    const user = { uid: 'u1', photoURL: 'https://img/a.jpg' };

    // Act
    await addComment('post-1', { user, comment: 'hi' });

    // Assert
    expect(tx.set.mock.calls[0][1].authorName).toBe('匿名使用者');
  });

  it('should fallback authorImgURL to empty string when user.photoURL missing', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-posts');
    const tx = setupTxOnce({ getSnap: { exists: () => true } });
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'Bob' };

    // Act
    await addComment('post-1', { user, comment: 'hi' });

    // Assert
    expect(tx.set.mock.calls[0][1].authorImgURL).toBe('');
  });

  it('should log + re-throw "Post not found" when post does not exist in tx', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-posts');
    setupTxOnce({ getSnap: { exists: () => false } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'Alice' };

    // Act & Assert
    await expect(addComment('post-1', { user, comment: 'hi' })).rejects.toThrow('Post not found');
    expect(errorSpy).toHaveBeenCalledWith('新增留言失敗:', expect.any(Error));

    errorSpy.mockRestore();
  });

  it('should log + re-throw when runTransaction itself rejects', async () => {
    // Arrange
    const { addComment } = await import('@/lib/firebase-posts');
    mockRunTransaction.mockRejectedValueOnce(new Error('tx failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'Alice' };

    // Act & Assert
    await expect(addComment('post-1', { user, comment: 'hi' })).rejects.toThrow('tx failed');
    expect(errorSpy).toHaveBeenCalledWith('新增留言失敗:', expect.any(Error));

    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// updateComment — 無 trim、無驗證（現況測）
// ---------------------------------------------------------------------------

describe('Unit: updateComment (no trim, no validation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should updateDoc with raw comment (no trim, no validation)', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-posts');
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    // Act — 故意帶前後空白，確認無 trim
    await updateComment('post-1', 'c-1', { comment: '  raw  ' });

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', 'post-1', 'comments', 'c-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({
      _docRef: ['posts', 'post-1', 'comments', 'c-1'],
    }), { comment: '  raw  ' });
  });

  it('should propagate updateDoc rejection', async () => {
    // Arrange
    const { updateComment } = await import('@/lib/firebase-posts');
    mockUpdateDoc.mockRejectedValueOnce(new Error('updateDoc failed'));

    // Act & Assert
    await expect(updateComment('post-1', 'c-1', { comment: 'x' })).rejects.toThrow(
      'updateDoc failed',
    );
  });
});

// ---------------------------------------------------------------------------
// deleteComment — not-exists silent success
// ---------------------------------------------------------------------------

describe('Unit: deleteComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should tx.delete + tx.update(commentsCount -1) when comment exists', async () => {
    // Arrange
    const { deleteComment } = await import('@/lib/firebase-posts');
    const tx = setupTxOnce({ getSnap: { exists: () => true } });

    // Act
    await deleteComment('post-1', 'c-1');

    // Assert
    expect(tx.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-1' }));
    expect(tx.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }), {
      commentsCount: { _inc: -1 },
    });
  });

  it('should silently resolve without tx.delete/update when comment does not exist', async () => {
    // Arrange
    const { deleteComment } = await import('@/lib/firebase-posts');
    const tx = setupTxOnce({ getSnap: { exists: () => false } });

    // Act & Assert — resolves undefined（視為成功，不 throw）
    await expect(deleteComment('post-1', 'missing')).resolves.toBeUndefined();
    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('should propagate runTransaction rejection (no outer catch)', async () => {
    // Arrange
    const { deleteComment } = await import('@/lib/firebase-posts');
    mockRunTransaction.mockRejectedValueOnce(new Error('tx failed'));

    // Act & Assert
    await expect(deleteComment('post-1', 'c-1')).rejects.toThrow('tx failed');
  });
});

// ---------------------------------------------------------------------------
// hasUserLikedPosts — collectionGroup + where in
// ---------------------------------------------------------------------------

describe('Unit: hasUserLikedPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty Set and skip getDocs when uid falsy', async () => {
    // Arrange
    const { hasUserLikedPosts } = await import('@/lib/firebase-posts');

    // Act
    const result = await hasUserLikedPosts('', ['p1']);

    // Assert
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('should return empty Set when postIds is not an array', async () => {
    // Arrange
    const { hasUserLikedPosts } = await import('@/lib/firebase-posts');

    // Act
    const result = await hasUserLikedPosts(
      'u1',
      /** @type {string[]} */ (/** @type {unknown} */ ('not-array')),
    );

    // Assert
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('should return empty Set when postIds is empty array', async () => {
    // Arrange
    const { hasUserLikedPosts } = await import('@/lib/firebase-posts');

    // Act
    const result = await hasUserLikedPosts('u1', []);

    // Assert
    expect(result.size).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('should query collectionGroup(likes) with where uid + where postId in, returning Set of postIds', async () => {
    // Arrange
    const { hasUserLikedPosts } = await import('@/lib/firebase-posts');
    const docs = [
      { data: () => ({ postId: 'p1', uid: 'u1' }) },
      { data: () => ({ postId: 'p3', uid: 'u1' }) },
    ];
    mockGetDocs.mockResolvedValueOnce({ docs });

    // Act
    const result = await hasUserLikedPosts('u1', ['p1', 'p2', 'p3']);

    // Assert
    expect(mockCollectionGroup).toHaveBeenCalledWith('mock-db', 'likes');
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'u1');
    expect(mockWhere).toHaveBeenCalledWith('postId', 'in', ['p1', 'p2', 'p3']);
    expect(result).toBeInstanceOf(Set);
    expect(result.has('p1')).toBe(true);
    expect(result.has('p3')).toBe(true);
    expect(result.has('p2')).toBe(false);
    expect(result.size).toBe(2);
  });

  it('should propagate getDocs rejection', async () => {
    // Arrange
    const { hasUserLikedPosts } = await import('@/lib/firebase-posts');
    mockGetDocs.mockRejectedValueOnce(new Error('getDocs failed'));

    // Act & Assert
    await expect(hasUserLikedPosts('u1', ['p1'])).rejects.toThrow('getDocs failed');
  });
});

// ---------------------------------------------------------------------------
// hasUserLikedPost — catch 吞 error → false
// ---------------------------------------------------------------------------

describe('Unit: hasUserLikedPost (singular)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when like doc exists', async () => {
    // Arrange
    const { hasUserLikedPost } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });

    // Act
    const result = await hasUserLikedPost('u1', 'post-1');

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', 'post-1', 'likes', 'u1');
    expect(result).toBe(true);
  });

  it('should return false when like doc does not exist', async () => {
    // Arrange
    const { hasUserLikedPost } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    // Act
    const result = await hasUserLikedPost('u1', 'post-1');

    // Assert
    expect(result).toBe(false);
  });

  it('should return false (not throw) and console.error when getDoc rejects', async () => {
    // Arrange
    const { hasUserLikedPost } = await import('@/lib/firebase-posts');
    mockGetDoc.mockRejectedValueOnce(new Error('getDoc failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const result = await hasUserLikedPost('u1', 'post-1');

    // Assert — catch 吞 error，回 false 而非 throw
    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('hasUserLikedPost failed:', expect.any(Error));

    errorSpy.mockRestore();
  });
});
