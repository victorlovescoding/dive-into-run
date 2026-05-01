import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCollection = vi.fn((_db, ...segments) => ({
  type: 'collection',
  path: segments.join('/'),
}));
const mockLimit = vi.fn((count) => ({ type: 'limit', count }));
const mockQuery = vi.fn((collectionRef, ...constraints) => ({
  type: 'query',
  path: collectionRef?.path,
  constraints,
}));
const mockOrderBy = vi.fn((field, dir) => ({ type: 'orderBy', field, dir }));
const mockDoc = vi.fn((base, ...segments) => {
  if (base?.type === 'collection' && segments.length === 0) {
    return {
      type: 'doc',
      path: `${base.path}/generated-comment-id`,
      id: 'generated-comment-id',
    };
  }

  if (base?.type === 'collection') {
    return {
      type: 'doc',
      path: [base.path, ...segments].join('/'),
      id: String(segments.at(-1) ?? 'generated-comment-id'),
    };
  }

  return {
    type: 'doc',
    path: segments.join('/'),
    id: String(segments.at(-1) ?? 'generated-comment-id'),
  };
});
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockRunTransaction = vi.fn();
const mockIncrement = vi.fn((value) => ({ __type: 'increment', value }));
const mockCollectionGroup = vi.fn((_db, ...segments) => ({
  type: 'collectionGroup',
  path: segments.join('/'),
}));
const mockWhere = vi.fn((field, op, value) => ({ type: 'where', field, op, value }));
const mockWriteBatch = vi.fn();
const mockStartAfter = vi.fn((...values) => ({ type: 'startAfter', values }));
const mockDocumentId = vi.fn(() => '__name__');
const mockServerTimestamp = vi.fn(() => 'mock-server-timestamp');

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  limit: mockLimit,
  query: mockQuery,
  orderBy: mockOrderBy,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  runTransaction: mockRunTransaction,
  increment: mockIncrement,
  collectionGroup: mockCollectionGroup,
  where: mockWhere,
  writeBatch: mockWriteBatch,
  startAfter: mockStartAfter,
  documentId: mockDocumentId,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

const runtime = await import('@/runtime/client/use-cases/post-use-cases');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('post-use-cases split', () => {
  /** @type {ReturnType<typeof vi.spyOn> | undefined} */
  let consoleWarnSpy;

  afterEach(() => {
    consoleWarnSpy?.mockRestore();
    consoleWarnSpy = undefined;
  });

  it('createPost uses service validation and repo write', async () => {
    mockAddDoc.mockResolvedValue({ id: 'post-1' });

    const result = await runtime.createPost({
      title: '  測試標題  ',
      content: '測試內容',
      user: { uid: 'u1', name: 'Amy', photoURL: 'https://img' },
    });

    expect(result).toEqual({ id: 'post-1' });
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'posts' }),
      expect.objectContaining({
        title: '  測試標題  ',
        content: '測試內容',
        authorUid: 'u1',
        authorName: 'Amy',
        authorImgURL: 'https://img',
        likesCount: 0,
        commentsCount: 0,
        postAt: 'mock-server-timestamp',
      }),
    );
  });

  it('getPostDetail warns on missing document and normalizes snapshots', async () => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await expect(runtime.getPostDetail('missing')).resolves.toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith('No such document!');
  });

  it('addComment trims content and preserves repo-facing comment payload', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: () => true }),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));

    const result = await runtime.addComment('post-1', {
      user: { uid: 'u1', name: 'Amy', photoURL: 'https://img' },
      comment: '  hello world  ',
    });

    expect(result).toEqual({ id: 'generated-comment-id' });
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'posts/post-1/comments/generated-comment-id',
        id: 'generated-comment-id',
      }),
      expect.objectContaining({
        authorUid: 'u1',
        authorName: 'Amy',
        authorImgURL: 'https://img',
        comment: 'hello world',
        createdAt: 'mock-server-timestamp',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'posts/post-1', id: 'post-1' }),
      { commentsCount: { __type: 'increment', value: 1 } },
    );
  });

  it('hasUserLikedPosts delegates to repo', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'like-1',
          data: () => ({ postId: 'p1' }),
        },
      ],
    });

    const result = await runtime.hasUserLikedPosts('u1', ['p1', 'p2']);

    expect(result.has('p1')).toBe(true);
    expect(mockCollectionGroup).toHaveBeenCalledWith('mock-db', 'likes');
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'u1');
    expect(mockWhere).toHaveBeenCalledWith('postId', 'in', ['p1', 'p2']);
  });
});
