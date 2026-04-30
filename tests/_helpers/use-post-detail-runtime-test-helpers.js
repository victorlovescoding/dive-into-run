import { vi } from 'vitest';

/** @typedef {import('@/service/post-service').Post} Post */
/** @typedef {import('@/service/post-service').Comment} Comment */
/** @typedef {import('@/runtime/providers/AuthProvider').AuthContextValue} AuthContextValue */

const hoistedBoundaryMocks = vi.hoisted(() => {
  const router = {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  };
  const searchParams = { get: vi.fn(() => null) };

  return {
    router,
    searchParams,
    docIdQueue: /** @type {string[]} */ ([]),
    mockUseRouter: vi.fn(() => router),
    mockUseSearchParams: vi.fn(() => searchParams),
    mockAddDoc: vi.fn(async () => ({ id: 'notification-1' })),
    mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
    mockCollectionGroup: vi.fn((_db, name) => ({ type: 'collectionGroup', path: name })),
    mockDoc: vi.fn((base, ...segments) => {
      if (base?.type === 'collection' && segments.length === 0) {
        const id = hoistedBoundaryMocks.docIdQueue.shift() ?? 'generated-doc';
        return { type: 'doc', path: `${base.path}/${id}`, id };
      }

      return {
        type: 'doc',
        path: base?.type === 'collection' ? [base.path, ...segments].join('/') : segments.join('/'),
        id: String(segments.at(-1) ?? ''),
      };
    }),
    mockDocumentId: vi.fn(() => '__name__'),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockIncrement: vi.fn((value) => ({ __op: 'increment', value })),
    mockLimit: vi.fn((count) => ({ type: 'limit', count })),
    mockOnSnapshot: vi.fn(),
    mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
    mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
    mockRunTransaction: vi.fn(),
    mockServerTimestamp: vi.fn(() => ({ __ts: 'serverTimestamp' })),
    mockStartAfter: vi.fn((...args) => ({ type: 'startAfter', args })),
    mockUpdateDoc: vi.fn(async () => undefined),
    mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
    mockWriteBatch: vi.fn(),
    mockTimestampFromDate: vi.fn((date) => ({ __ts: date.toISOString(), toDate: () => date })),
    mockTimestampNow: vi.fn(() => ({ __ts: 'now' })),
  };
});

export const postDetailRuntimeBoundaryMocks = hoistedBoundaryMocks;

vi.mock('next/navigation', () => ({
  useRouter: hoistedBoundaryMocks.mockUseRouter,
  useSearchParams: hoistedBoundaryMocks.mockUseSearchParams,
}));

vi.mock('firebase/firestore', () => ({
  addDoc: hoistedBoundaryMocks.mockAddDoc,
  collection: hoistedBoundaryMocks.mockCollection,
  collectionGroup: hoistedBoundaryMocks.mockCollectionGroup,
  doc: hoistedBoundaryMocks.mockDoc,
  documentId: hoistedBoundaryMocks.mockDocumentId,
  getDoc: hoistedBoundaryMocks.mockGetDoc,
  getDocs: hoistedBoundaryMocks.mockGetDocs,
  increment: hoistedBoundaryMocks.mockIncrement,
  limit: hoistedBoundaryMocks.mockLimit,
  onSnapshot: hoistedBoundaryMocks.mockOnSnapshot,
  orderBy: hoistedBoundaryMocks.mockOrderBy,
  query: hoistedBoundaryMocks.mockQuery,
  runTransaction: hoistedBoundaryMocks.mockRunTransaction,
  serverTimestamp: hoistedBoundaryMocks.mockServerTimestamp,
  startAfter: hoistedBoundaryMocks.mockStartAfter,
  updateDoc: hoistedBoundaryMocks.mockUpdateDoc,
  where: hoistedBoundaryMocks.mockWhere,
  writeBatch: hoistedBoundaryMocks.mockWriteBatch,
  Timestamp: {
    fromDate: hoistedBoundaryMocks.mockTimestampFromDate,
    now: hoistedBoundaryMocks.mockTimestampNow,
  },
}));

/**
 * @param {string} iso - ISO 日期字串。
 * @returns {import('firebase/firestore').Timestamp} Timestamp-like。
 */
export function fakeTs(iso) {
  const date = new Date(iso);
  return /** @type {import('firebase/firestore').Timestamp} */ (
    /** @type {unknown} */ ({ toDate: () => date, getTime: () => date.getTime() })
  );
}

/**
 * @param {Partial<Post>} [overrides] - 欄位覆寫。
 * @returns {Post} post fixture。
 */
export function createRuntimePost(overrides = {}) {
  return {
    id: overrides.id ?? 'post-1',
    authorUid: overrides.authorUid ?? 'author-1',
    title: overrides.title ?? '晨跑日記',
    content: overrides.content ?? '今天跑得不錯',
    authorName: overrides.authorName ?? 'Author',
    authorImgURL: overrides.authorImgURL ?? '',
    postAt: overrides.postAt ?? fakeTs('2099-05-01T08:00:00Z'),
    likesCount: overrides.likesCount ?? 3,
    commentsCount: overrides.commentsCount ?? 2,
    ...overrides,
  };
}

/**
 * @returns {{ set: import('vitest').Mock, delete: import('vitest').Mock, update: import('vitest').Mock, commit: import('vitest').Mock }} batch double。
 */
function createWriteBatchDouble() {
  return {
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * @param {string} id - 文件 ID。
 * @param {object} data - 文件資料。
 * @returns {{ id: string, exists: () => boolean, data: () => object, ref: { path: string } }} snapshot。
 */
function createDocSnapshot(id, data) {
  return {
    id,
    exists: () => true,
    data: () => data,
    ref: { path: `posts/post-1/comments/${id}` },
  };
}

/** @returns {{ exists: () => false, data: () => object }} 不存在的 snapshot。 */
function createMissingSnapshot() {
  return { exists: () => false, data: () => ({}) };
}

/** 重置 boundary mocks。 */
export function resetPostDetailRuntimeBoundaryMocks() {
  vi.clearAllMocks();
  hoistedBoundaryMocks.docIdQueue.length = 0;
  hoistedBoundaryMocks.mockUseRouter.mockImplementation(() => hoistedBoundaryMocks.router);
  hoistedBoundaryMocks.mockUseSearchParams.mockImplementation(() => hoistedBoundaryMocks.searchParams);
  hoistedBoundaryMocks.searchParams.get.mockReturnValue(null);
  hoistedBoundaryMocks.mockGetDoc.mockImplementation(async () => createMissingSnapshot());
  hoistedBoundaryMocks.mockGetDocs.mockImplementation(async () => ({ docs: [] }));
  hoistedBoundaryMocks.mockWriteBatch.mockImplementation(() => createWriteBatchDouble());
  hoistedBoundaryMocks.mockRunTransaction.mockReset();
}

/**
 * @param {{
 *   postId: string,
 *   post?: Post | null,
 *   comments?: Comment[],
 *   likedByUserUids?: string[],
 * }} options - Firestore 測試資料。
 */
export function installPostDetailRuntimeFirestore({
  postId,
  post = createRuntimePost({ id: postId }),
  comments = [],
  likedByUserUids = [],
}) {
  hoistedBoundaryMocks.mockGetDoc.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === `posts/${postId}`) {
      return post ? createDocSnapshot(postId, post) : createMissingSnapshot();
    }

    if (path.startsWith(`posts/${postId}/likes/`)) {
      const uid = path.split('/').at(-1) ?? '';
      return likedByUserUids.includes(uid)
        ? createDocSnapshot(uid, { uid, postId })
        : createMissingSnapshot();
    }

    if (path.startsWith(`posts/${postId}/comments/`)) {
      return createMissingSnapshot();
    }

    return createMissingSnapshot();
  });

  hoistedBoundaryMocks.mockGetDocs.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === `posts/${postId}/comments`) {
      return {
        docs: comments.map((comment) => createDocSnapshot(String(comment.id), comment)),
      };
    }

    if (path === `posts/${postId}/likes`) {
      return {
        docs: likedByUserUids.map((uid) => ({
          id: uid,
          ref: { path: `posts/${postId}/likes/${uid}` },
          data: () => ({ uid, postId }),
        })),
      };
    }

    return { docs: [] };
  });
}

/** @param {{ postId: string }} options - add comment transaction 參數。 */
export function primeAddCommentTransaction({ postId }) {
  hoistedBoundaryMocks.mockRunTransaction.mockImplementationOnce(async (_db, callback) =>
    callback({
      get: vi.fn(async (ref) => {
        const path = String(ref?.path ?? '');
        if (path === `posts/${postId}`) {
          return createDocSnapshot(postId, createRuntimePost({ id: postId }));
        }
        return createMissingSnapshot();
      }),
      set: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    }),
  );
}
