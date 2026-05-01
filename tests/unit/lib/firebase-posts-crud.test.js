/**
 * @file Unit test for firebase-posts.js Post 主線 (mock-audit D1)
 * @description
 * 補足 firebase-posts.js 8 個 Post 主線 exports 的 self-test，實際執行 lib 程式碼
 * （不整包 mock 自家 firebase-posts）。配套 2026-04-20 mock audit。
 *
 * Covers (D1):
 *   createPost / updatePost / deletePost (cascade)
 *   getLatestPosts / getMorePosts
 *   getPostsBySearch / getMorePostsBySearch
 *   getPostDetail
 *
 * 未覆蓋（留 D2）：Comments subcollection 6 exports、Likes 3 exports。
 *
 * Rules: AAA pattern、strict JSDoc、mock firebase/firestore + firebase-client。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
const mockDoc = vi.fn((_db, ...segments) => ({ _docRef: segments }));
/** @type {import('vitest').Mock} */
const mockCollection = vi.fn((_db, ...segments) => ({ _collectionRef: segments }));
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
const mockWriteBatch = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  serverTimestamp: mockServerTimestamp,
  limit: mockLimit,
  query: mockQuery,
  orderBy: mockOrderBy,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  runTransaction: vi.fn(),
  increment: vi.fn((n) => ({ _inc: n })),
  collectionGroup: vi.fn(),
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
 * @typedef {object} MockPostCursor
 * @property {string} id - 上一頁最後一筆文章 ID（作為 startAfter 分頁游標）。
 * @property {unknown} [postAt] - 上一頁最後一筆文章的 postAt Timestamp（時間分頁用）。
 * @property {string} [title] - 上一頁最後一筆文章的 title（搜尋分頁用）。
 */

// ---------------------------------------------------------------------------
// createPost
// ---------------------------------------------------------------------------

describe('Unit: createPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call addDoc with full payload and return {id} from ref', async () => {
    // Arrange
    const { createPost } = await import('@/lib/firebase-posts');
    mockAddDoc.mockResolvedValueOnce({ id: 'new-post-1' });
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'Alice', photoURL: 'https://img/a.jpg' };

    // Act
    const result = await createPost({ title: 'Hello', content: 'World', user });

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'posts');
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.authorUid).toBe('u1');
    expect(payload.title).toBe('Hello');
    expect(payload.content).toBe('World');
    expect(payload.authorImgURL).toBe('https://img/a.jpg');
    expect(payload.authorName).toBe('Alice');
    expect(payload.postAt).toEqual({ _serverTimestamp: true });
    expect(payload.likesCount).toBe(0);
    expect(payload.commentsCount).toBe(0);
    expect(result).toEqual({ id: 'new-post-1' });
  });

  it('should fallback authorName to 匿名使用者 when user.name missing', async () => {
    // Arrange
    const { createPost } = await import('@/lib/firebase-posts');
    mockAddDoc.mockResolvedValueOnce({ id: 'p1' });
    /** @type {MockUser} */
    const user = { uid: 'u1', photoURL: 'https://img/a.jpg' };

    // Act
    await createPost({ title: 'T', content: 'C', user });

    // Assert
    expect(mockAddDoc.mock.calls[0][1].authorName).toBe('匿名使用者');
  });

  it('should pass authorImgURL as undefined when user.photoURL missing', async () => {
    // Arrange
    const { createPost } = await import('@/lib/firebase-posts');
    mockAddDoc.mockResolvedValueOnce({ id: 'p1' });
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'Alice' };

    // Act
    await createPost({ title: 'T', content: 'C', user });

    // Assert
    expect(mockAddDoc.mock.calls[0][1].authorImgURL).toBeUndefined();
  });

  it('should throw with createPost: prefix when validation fails and not call addDoc', async () => {
    // Arrange
    const { createPost } = await import('@/lib/firebase-posts');
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'A', photoURL: '' };

    // Act & Assert
    await expect(createPost({ title: '', content: '', user })).rejects.toThrow(/^createPost:/);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('should propagate addDoc rejection', async () => {
    // Arrange
    const { createPost } = await import('@/lib/firebase-posts');
    mockAddDoc.mockRejectedValueOnce(new Error('addDoc failed'));
    /** @type {MockUser} */
    const user = { uid: 'u1', name: 'A' };

    // Act & Assert
    await expect(createPost({ title: 'T', content: 'C', user })).rejects.toThrow('addDoc failed');
  });
});

// ---------------------------------------------------------------------------
// updatePost
// ---------------------------------------------------------------------------

describe('Unit: updatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call updateDoc with doc(posts, id) and { title, content }', async () => {
    // Arrange
    const { updatePost } = await import('@/lib/firebase-posts');
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    // Act
    await updatePost('post-1', { title: 'Title', content: 'Content' });

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', 'post-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({
      _docRef: ['posts', 'post-1'],
    }), {
      title: 'Title',
      content: 'Content',
    });
  });

  it('should throw with updatePost: prefix when validation fails and not call updateDoc', async () => {
    // Arrange
    const { updatePost } = await import('@/lib/firebase-posts');

    // Act & Assert
    await expect(updatePost('post-1', { title: '', content: '' })).rejects.toThrow(/^updatePost:/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('should propagate updateDoc rejection', async () => {
    // Arrange
    const { updatePost } = await import('@/lib/firebase-posts');
    mockUpdateDoc.mockRejectedValueOnce(new Error('updateDoc failed'));

    // Act & Assert
    await expect(updatePost('post-1', { title: 'T', content: 'C' })).rejects.toThrow(
      'updateDoc failed',
    );
  });
});

// ---------------------------------------------------------------------------
// deletePost (cascade delete via writeBatch)
// ---------------------------------------------------------------------------

describe('Unit: deletePost (cascade delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should batch.delete all likes + comments + post and commit', async () => {
    // Arrange
    const { deletePost } = await import('@/lib/firebase-posts');
    const likeDocs = [{ ref: 'like-ref-1' }, { ref: 'like-ref-2' }];
    const commentDocs = [{ ref: 'comment-ref-1' }];
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    mockGetDocs
      .mockResolvedValueOnce({ docs: likeDocs })
      .mockResolvedValueOnce({ docs: commentDocs });
    const batchDelete = vi.fn();
    const batchCommit = vi.fn().mockResolvedValueOnce(undefined);
    mockWriteBatch.mockReturnValueOnce({ delete: batchDelete, commit: batchCommit });

    // Act
    const result = await deletePost('post-1');

    // Assert
    expect(result).toEqual({ ok: true });
    expect(batchDelete.mock.calls.map(([ref]) => ref)).toEqual([
      'like-ref-1',
      'like-ref-2',
      'comment-ref-1',
      expect.objectContaining({ _docRef: ['posts', 'post-1'] }),
    ]);
    expect(batchCommit).toHaveBeenCalled();
  });

  it('should delete only post doc when no likes or comments exist', async () => {
    // Arrange
    const { deletePost } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });
    const batchDelete = vi.fn();
    const batchCommit = vi.fn().mockResolvedValueOnce(undefined);
    mockWriteBatch.mockReturnValueOnce({ delete: batchDelete, commit: batchCommit });

    // Act
    await deletePost('post-1');

    // Assert
    expect(batchDelete.mock.calls.map(([ref]) => ref)).toEqual([
      expect.objectContaining({ _docRef: ['posts', 'post-1'] }),
    ]);
  });

  it('should throw when postId is falsy', async () => {
    // Arrange
    const { deletePost } = await import('@/lib/firebase-posts');

    // Act & Assert
    await expect(deletePost('')).rejects.toThrow('deletePost: postId is required');
    await expect(deletePost(/** @type {string} */ (/** @type {unknown} */ (null)))).rejects.toThrow(
      'deletePost: postId is required',
    );
    await expect(
      deletePost(/** @type {string} */ (/** @type {unknown} */ (undefined))),
    ).rejects.toThrow('deletePost: postId is required');
  });

  it('should throw POST_NOT_FOUND_MESSAGE when post not exists and skip batch', async () => {
    // Arrange
    const { deletePost, POST_NOT_FOUND_MESSAGE } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    // Act & Assert
    await expect(deletePost('missing-post')).rejects.toThrow(POST_NOT_FOUND_MESSAGE);
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('should coerce non-string postId to String for doc path', async () => {
    // Arrange
    const { deletePost } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });
    mockWriteBatch.mockReturnValueOnce({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValueOnce(undefined),
    });

    // Act
    await deletePost(/** @type {string} */ (/** @type {unknown} */ (123)));

    // Assert: postRef call is doc('mock-db', 'posts', '123') — String coercion
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', '123');
    expect(typeof mockDoc.mock.calls[0][2]).toBe('string');
  });

  it('should propagate batch.commit rejection', async () => {
    // Arrange
    const { deletePost } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });
    mockWriteBatch.mockReturnValueOnce({
      delete: vi.fn(),
      commit: vi.fn().mockRejectedValueOnce(new Error('batch failed')),
    });

    // Act & Assert
    await expect(deletePost('post-1')).rejects.toThrow('batch failed');
  });
});

// ---------------------------------------------------------------------------
// getLatestPosts
// ---------------------------------------------------------------------------

describe('Unit: getLatestPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query with orderBy(postAt desc) + orderBy(documentId desc) + limit(10)', async () => {
    // Arrange
    const { getLatestPosts } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    await getLatestPosts();

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'posts');
    expect(mockOrderBy).toHaveBeenCalledWith('postAt', 'desc');
    expect(mockOrderBy).toHaveBeenCalledWith('__name__', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should map docs to Post objects with id field spread', async () => {
    // Arrange
    const { getLatestPosts } = await import('@/lib/firebase-posts');
    const docs = [
      { id: 'p1', data: () => ({ title: 'T1', authorUid: 'u1' }) },
      { id: 'p2', data: () => ({ title: 'T2', authorUid: 'u2' }) },
    ];
    mockGetDocs.mockResolvedValueOnce({ docs });

    // Act
    const result = await getLatestPosts();

    // Assert
    expect(result).toEqual([
      { id: 'p1', title: 'T1', authorUid: 'u1' },
      { id: 'p2', title: 'T2', authorUid: 'u2' },
    ]);
  });

  it('should return empty array when no docs', async () => {
    // Arrange
    const { getLatestPosts } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const result = await getLatestPosts();

    // Assert
    expect(result).toEqual([]);
  });

  it('should propagate getDocs rejection', async () => {
    // Arrange
    const { getLatestPosts } = await import('@/lib/firebase-posts');
    mockGetDocs.mockRejectedValueOnce(new Error('getDocs failed'));

    // Act & Assert
    await expect(getLatestPosts()).rejects.toThrow('getDocs failed');
  });
});

// ---------------------------------------------------------------------------
// getMorePosts (pagination)
// ---------------------------------------------------------------------------

describe('Unit: getMorePosts (pagination)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array and not call getDocs when last is null', async () => {
    // Arrange
    const { getMorePosts } = await import('@/lib/firebase-posts');

    // Act
    const result = await getMorePosts(null);

    // Assert
    expect(result).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('should call startAfter(last.postAt, last.id) when last provided', async () => {
    // Arrange
    const { getMorePosts } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    /** @type {MockPostCursor} */
    const last = { id: 'p-last', postAt: 'last-ts' };

    // Act
    await getMorePosts(
      /** @type {import('@/lib/firebase-posts').Post} */ (/** @type {unknown} */ (last)),
    );

    // Assert
    expect(mockStartAfter).toHaveBeenCalledWith('last-ts', 'p-last');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should map docs to Post objects with id field', async () => {
    // Arrange
    const { getMorePosts } = await import('@/lib/firebase-posts');
    const docs = [{ id: 'p3', data: () => ({ title: 'T3' }) }];
    mockGetDocs.mockResolvedValueOnce({ docs });
    /** @type {MockPostCursor} */
    const last = { id: 'p-last', postAt: 'last-ts' };

    // Act
    const result = await getMorePosts(
      /** @type {import('@/lib/firebase-posts').Post} */ (/** @type {unknown} */ (last)),
    );

    // Assert
    expect(result).toEqual([{ id: 'p3', title: 'T3' }]);
  });

  it('should propagate getDocs rejection', async () => {
    // Arrange
    const { getMorePosts } = await import('@/lib/firebase-posts');
    mockGetDocs.mockRejectedValueOnce(new Error('getDocs failed'));
    /** @type {MockPostCursor} */
    const last = { id: 'p', postAt: 't' };

    // Act & Assert
    await expect(
      getMorePosts(
        /** @type {import('@/lib/firebase-posts').Post} */ (/** @type {unknown} */ (last)),
      ),
    ).rejects.toThrow('getDocs failed');
  });
});

// ---------------------------------------------------------------------------
// getPostsBySearch
// ---------------------------------------------------------------------------

describe('Unit: getPostsBySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should normalize searchTerm to lowercase in where clauses', async () => {
    // Arrange
    const { getPostsBySearch } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    await getPostsBySearch('Hello World');

    // Assert
    expect(mockWhere).toHaveBeenCalledWith('title', '>=', 'hello world');
    expect(mockWhere).toHaveBeenCalledWith('title', '<=', 'hello world\uf8ff');
  });

  it('should apply orderBy(title) + orderBy(documentId) + limit(10)', async () => {
    // Arrange
    const { getPostsBySearch } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    await getPostsBySearch('test');

    // Assert
    expect(mockOrderBy).toHaveBeenCalledWith('title');
    expect(mockOrderBy).toHaveBeenCalledWith('__name__');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should return mapped Post results', async () => {
    // Arrange
    const { getPostsBySearch } = await import('@/lib/firebase-posts');
    const docs = [{ id: 'p1', data: () => ({ title: 'hello' }) }];
    mockGetDocs.mockResolvedValueOnce({ docs });

    // Act
    const result = await getPostsBySearch('hello');

    // Assert
    expect(result).toEqual([{ id: 'p1', title: 'hello' }]);
  });

  it('should return empty array when no matches', async () => {
    // Arrange
    const { getPostsBySearch } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const result = await getPostsBySearch('nomatch');

    // Assert
    expect(result).toEqual([]);
  });

  it('should propagate getDocs rejection', async () => {
    // Arrange
    const { getPostsBySearch } = await import('@/lib/firebase-posts');
    mockGetDocs.mockRejectedValueOnce(new Error('search failed'));

    // Act & Assert
    await expect(getPostsBySearch('x')).rejects.toThrow('search failed');
  });
});

// ---------------------------------------------------------------------------
// getMorePostsBySearch (search pagination)
// ---------------------------------------------------------------------------

describe('Unit: getMorePostsBySearch (pagination)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array and not call getDocs when last is null', async () => {
    // Arrange
    const { getMorePostsBySearch } = await import('@/lib/firebase-posts');

    // Act
    const result = await getMorePostsBySearch('hello', null);

    // Assert
    expect(result).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('should call startAfter(last.title, last.id) when last provided', async () => {
    // Arrange
    const { getMorePostsBySearch } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    /** @type {MockPostCursor} */
    const last = { id: 'p1', title: 'Hello' };

    // Act
    await getMorePostsBySearch(
      'hello',
      /** @type {import('@/lib/firebase-posts').Post} */ (/** @type {unknown} */ (last)),
    );

    // Assert
    expect(mockStartAfter).toHaveBeenCalledWith('Hello', 'p1');
  });

  it('should apply same normalized where/orderBy as getPostsBySearch', async () => {
    // Arrange
    const { getMorePostsBySearch } = await import('@/lib/firebase-posts');
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    /** @type {MockPostCursor} */
    const last = { id: 'p1', title: 't' };

    // Act
    await getMorePostsBySearch(
      'Search',
      /** @type {import('@/lib/firebase-posts').Post} */ (/** @type {unknown} */ (last)),
    );

    // Assert
    expect(mockWhere).toHaveBeenCalledWith('title', '>=', 'search');
    expect(mockWhere).toHaveBeenCalledWith('title', '<=', 'search\uf8ff');
  });

  it('should propagate getDocs rejection', async () => {
    // Arrange
    const { getMorePostsBySearch } = await import('@/lib/firebase-posts');
    mockGetDocs.mockRejectedValueOnce(new Error('fail'));
    /** @type {MockPostCursor} */
    const last = { id: 'p', title: 't' };

    // Act & Assert
    await expect(
      getMorePostsBySearch(
        'x',
        /** @type {import('@/lib/firebase-posts').Post} */ (/** @type {unknown} */ (last)),
      ),
    ).rejects.toThrow('fail');
  });
});

// ---------------------------------------------------------------------------
// getPostDetail
// ---------------------------------------------------------------------------

describe('Unit: getPostDetail', () => {
  /** @type {ReturnType<typeof vi.spyOn> | undefined} */
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy?.mockRestore();
    consoleWarnSpy = undefined;
  });

  it('should return Post object with id when doc exists', async () => {
    // Arrange
    const { getPostDetail } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'post-1',
      data: () => ({ title: 'T', authorUid: 'u1' }),
    });

    // Act
    const result = await getPostDetail('post-1');

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'posts', 'post-1');
    expect(result).toEqual({ id: 'post-1', title: 'T', authorUid: 'u1' });
  });

  it('should return null and console.warn when doc not exists', async () => {
    // Arrange
    const { getPostDetail } = await import('@/lib/firebase-posts');
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const result = await getPostDetail('missing');

    // Assert
    expect(result).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith('No such document!');
  });

  it('should propagate getDoc rejection', async () => {
    // Arrange
    const { getPostDetail } = await import('@/lib/firebase-posts');
    mockGetDoc.mockRejectedValueOnce(new Error('getDoc failed'));

    // Act & Assert
    await expect(getPostDetail('p1')).rejects.toThrow('getDoc failed');
  });
});
