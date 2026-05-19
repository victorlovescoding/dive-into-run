import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPostCommentRaw } from '../../_helpers/post-comments-fixtures';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const {
  authState,
  docIdQueue,
  mockAddDoc,
  mockCollection,
  mockCollectionGroup,
  mockDeleteDoc,
  mockDoc,
  mockDocumentId,
  mockGetDoc,
  mockGetDocs,
  mockIncrement,
  mockLimit,
  mockOrderBy,
  mockQuery,
  mockRunTransaction,
  mockServerTimestamp,
  mockSetDoc,
  mockShowToast,
  mockStartAfter,
  mockTimestampFromDate,
  mockTimestampNow,
  mockUpdateDoc,
  mockUseContext,
  mockWhere,
  mockWriteBatch,
  router,
  searchParams,
} = vi.hoisted(() => ({
  authState: {
    current: { user: null, loading: false, setUser() {} },
  },
  docIdQueue: /** @type {string[]} */ ([]),
  mockAddDoc: vi.fn(async () => ({ id: 'notification-1' })),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockCollectionGroup: vi.fn((_db, name) => ({ type: 'collectionGroup', path: name })),
  mockDeleteDoc: vi.fn(async () => undefined),
  mockDoc: vi.fn((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      const id = docIdQueue.shift() ?? 'generated-doc';
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
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
  mockRunTransaction: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ __ts: 'serverTimestamp' })),
  mockSetDoc: vi.fn(async () => undefined),
  mockShowToast: vi.fn(),
  mockStartAfter: vi.fn((...args) => ({ type: 'startAfter', args })),
  mockTimestampFromDate: vi.fn((date) => ({ __ts: date.toISOString(), toDate: () => date })),
  mockTimestampNow: vi.fn(() => ({ __ts: 'now' })),
  mockUpdateDoc: vi.fn(async () => undefined),
  mockUseContext: vi.fn(),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockWriteBatch: vi.fn(),
  router: {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  },
  searchParams: { get: vi.fn(() => null) },
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));
vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  documentId: mockDocumentId,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  increment: mockIncrement,
  limit: mockLimit,
  orderBy: mockOrderBy,
  query: mockQuery,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  startAfter: mockStartAfter,
  Timestamp: {
    fromDate: mockTimestampFromDate,
    now: mockTimestampNow,
  },
  updateDoc: mockUpdateDoc,
  where: mockWhere,
  writeBatch: mockWriteBatch,
}));

const createSubmitEvent = () =>
  /** @type {Event} */ (/** @type {unknown} */ ({ preventDefault: vi.fn() }));

const createChangeEvent = (value) =>
  /** @type {Event} */ (/** @type {unknown} */ ({ target: { value } }));

/**
 * @param {string} iso - ISO 日期字串。
 * @returns {import('firebase/firestore').Timestamp} Timestamp-like。
 */
function fakeTs(iso) {
  const date = new Date(iso);
  return /** @type {import('firebase/firestore').Timestamp} */ (
    /** @type {unknown} */ ({ toDate: () => date, getTime: () => date.getTime() })
  );
}

/**
 * @param {Partial<import('@/service/post-service').Post>} [overrides] - 欄位覆寫。
 * @returns {import('@/service/post-service').Post} post fixture。
 */
function createRuntimePost(overrides = {}) {
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

/** @returns {{ set: import('vitest').Mock, delete: import('vitest').Mock, update: import('vitest').Mock, commit: import('vitest').Mock }} batch double。 */
function createWriteBatchDouble() {
  return {
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

/** 重置 Firestore / router boundary mocks。 */
function resetPostDetailRuntimeBoundaryMocks() {
  docIdQueue.length = 0;
  searchParams.get.mockReturnValue(null);
  mockGetDoc.mockImplementation(async () => createMissingSnapshot());
  mockGetDocs.mockImplementation(async () => ({ docs: [] }));
  mockWriteBatch.mockImplementation(() => createWriteBatchDouble());
  mockRunTransaction.mockReset();
  mockSetDoc.mockResolvedValue(undefined);
  mockDeleteDoc.mockResolvedValue(undefined);
}

/**
 * @param {{
 *   postId: string,
 *   post?: import('@/service/post-service').Post | null,
 *   comments?: import('@/service/post-service').Comment[],
 *   likedByUserUids?: string[],
 *   favoritePostIds?: string[],
 * }} options - Firestore 測試資料。
 */
function installPostDetailRuntimeFirestore({
  postId,
  post = createRuntimePost({ id: postId }),
  comments = [],
  likedByUserUids = [],
  favoritePostIds = [],
}) {
  mockGetDoc.mockImplementation(async (ref) => {
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
    if (path === `users/me-uid/favoritePosts/${postId}`) {
      return favoritePostIds.includes(postId)
        ? createDocSnapshot(postId, { targetId: postId })
        : createMissingSnapshot();
    }
    return createMissingSnapshot();
  });

  mockGetDocs.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === `posts/${postId}/comments`) {
      return { docs: comments.map((comment) => createDocSnapshot(String(comment.id), comment)) };
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
function primeAddCommentTransaction({ postId }) {
  mockRunTransaction.mockImplementationOnce(async (_db, callback) =>
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

/**
 * @param {{ postId?: string, user?: object | null }} [options] - render 選項。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any> & { showToast: import('vitest').Mock, router: typeof router }>} render 結果。
 */
async function renderPostDetailRuntimeHook(options = {}) {
  const { default: usePostDetailRuntime } = await import('@/runtime/hooks/usePostDetailRuntime');
  authState.current = {
    user:
      options.user === undefined
        ? {
            uid: 'me-uid',
            name: 'Me',
            email: 'me@example.com',
            photoURL: '',
            bio: null,
            getIdToken: vi.fn().mockResolvedValue('token'),
          }
        : options.user,
    setUser: vi.fn(),
    loading: false,
  };

  return {
    ...renderHook(() => usePostDetailRuntime(options.postId ?? 'post-1')),
    showToast: mockShowToast,
    router,
  };
}

describe('usePostDetailRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
    resetPostDetailRuntimeBoundaryMocks();
  });

  it('loads post detail and hydrates initial comments through the real comments hook', async () => {
    const postId = 'post-1';
    const post = createRuntimePost({
      id: postId,
      authorUid: 'author-1',
      title: '晨跑日記',
      likesCount: 5,
      commentsCount: 2,
    });

    installPostDetailRuntimeFirestore({
      postId,
      post,
      comments: [
        createPostCommentRaw({ id: 'c1', authorUid: 'me-uid', comment: '我的留言' }),
        createPostCommentRaw({ id: 'c2', authorUid: 'u2', comment: '別人的留言' }),
      ],
      likedByUserUids: ['me-uid'],
    });

    const { result } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.post).toMatchObject({
      id: postId,
      title: '晨跑日記',
      liked: true,
      isAuthor: false,
      likesCount: 5,
      commentsCount: 2,
    });
    expect(result.current.comments.map((comment) => comment.isAuthor)).toEqual([true, false]);
    expect(result.current.shareUrl).toContain(`/posts/${postId}`);
  });

  it('loads post detail and hydrates initial favorite state', async () => {
    const postId = 'post-1';
    installPostDetailRuntimeFirestore({
      postId,
      post: createRuntimePost({ id: postId }),
      favoritePostIds: [postId],
    });

    const { result } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.post).toMatchObject({
      id: postId,
      isFavorited: true,
    });
  });

  it('adds a post favorite and shows success toast', async () => {
    const postId = 'post-1';
    installPostDetailRuntimeFirestore({
      postId,
      post: createRuntimePost({ id: postId }),
    });

    const { result, showToast } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.post).toMatchObject({ isFavorited: false });
    });

    await act(async () => {
      await result.current.handleToggleFavoritePost();
    });

    expect(result.current.post).toMatchObject({ id: postId, isFavorited: true });
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/me-uid/favoritePosts/post-1' }),
      expect.objectContaining({ targetId: postId }),
    );
    expect(showToast).toHaveBeenCalledWith('已加入收藏', 'success');
  });

  it('removes a post favorite and shows success toast', async () => {
    const postId = 'post-1';
    installPostDetailRuntimeFirestore({
      postId,
      post: createRuntimePost({ id: postId }),
      favoritePostIds: [postId],
    });

    const { result, showToast } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.post).toMatchObject({ isFavorited: true });
    });

    await act(async () => {
      await result.current.handleToggleFavoritePost();
    });

    expect(result.current.post).toMatchObject({ id: postId, isFavorited: false });
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/me-uid/favoritePosts/post-1' }),
    );
    expect(showToast).toHaveBeenCalledWith('已取消收藏', 'success');
  });

  it('rolls back a failed add favorite', async () => {
    const postId = 'post-1';
    installPostDetailRuntimeFirestore({
      postId,
      post: createRuntimePost({ id: postId }),
    });
    mockSetDoc.mockRejectedValueOnce(new Error('write failed'));

    const { result, showToast } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.post).toMatchObject({ isFavorited: false });
    });

    await act(async () => {
      await result.current.handleToggleFavoritePost();
    });

    expect(result.current.post).toMatchObject({ id: postId, isFavorited: false });
    expect(showToast).toHaveBeenCalledWith('收藏失敗，請稍後再試', 'error');
  });

  it('rolls back a failed remove favorite', async () => {
    const postId = 'post-1';
    installPostDetailRuntimeFirestore({
      postId,
      post: createRuntimePost({ id: postId }),
      favoritePostIds: [postId],
    });
    mockDeleteDoc.mockRejectedValueOnce(new Error('delete failed'));

    const { result, showToast } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.post).toMatchObject({ isFavorited: true });
    });

    await act(async () => {
      await result.current.handleToggleFavoritePost();
    });

    expect(result.current.post).toMatchObject({ id: postId, isFavorited: true });
    expect(showToast).toHaveBeenCalledWith('取消收藏失敗，請稍後再試', 'error');
  });

  it('surfaces the missing-post state and keeps comments empty', async () => {
    const postId = 'missing-post';
    installPostDetailRuntimeFirestore({ postId, post: null });
    const { result, router } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.post).toBeNull();
    expect(result.current.comments).toEqual([]);
    expect(result.current.error).toBe('找不到這篇文章（可能已被刪除）');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('submits a new comment through the real comments hook composition', async () => {
    const postId = 'post-2';
    const post = createRuntimePost({
      id: postId,
      authorUid: 'author-2',
      commentsCount: 1,
    });

    installPostDetailRuntimeFirestore({
      postId,
      post,
      comments: [createPostCommentRaw({ id: 'c1', authorUid: 'u2', comment: '先留言' })],
    });
    docIdQueue.push('comment-new');
    primeAddCommentTransaction({ postId });

    const { result } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.handleCommentChange(createChangeEvent('新的留言'));
    });

    await act(async () => {
      await result.current.handleSubmitComment(createSubmitEvent());
    });

    await waitFor(() => {
      expect(result.current.comments[0]?.id).toBe('comment-new');
    });

    expect(result.current.comments[0]).toMatchObject({
      authorUid: 'me-uid',
      comment: '新的留言',
      isAuthor: true,
    });
    expect(result.current.post?.commentsCount).toBe(2);
  });

  it('redirects to the posts list after delete success', async () => {
    const postId = 'post-3';
    installPostDetailRuntimeFirestore({
      postId,
      post: createRuntimePost({ id: postId, commentsCount: 1 }),
      comments: [createPostCommentRaw({ id: 'c1', authorUid: 'u3' })],
      likedByUserUids: ['me-uid'],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result, router } = await renderPostDetailRuntimeHook({ postId });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleDeletePost(postId);
    });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/posts?toast=文章已刪除');
    });

    confirmSpy.mockRestore();
  });
});
