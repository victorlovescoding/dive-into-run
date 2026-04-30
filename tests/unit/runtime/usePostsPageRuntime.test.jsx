import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import usePostsPageRuntime from '@/runtime/hooks/usePostsPageRuntime';
import { installIntersectionObserverMock } from '../../_helpers/runtime-hook-test-helpers';
import {
  createCollectionDoc,
  createDocsDispatcher,
  createDocumentSnapshot,
  createPostFixture,
  createPostList,
  createTestUser,
} from '../../_helpers/use-posts-page-runtime-test-helpers';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const {
  authState,
  mockAddDoc,
  mockCollection,
  mockCollectionGroup,
  mockDoc,
  mockDocumentId,
  mockGetDoc,
  mockGetDocs,
  mockIncrement,
  mockLimit,
  mockOrderBy,
  mockQuery,
  mockReplace,
  mockRunTransaction,
  mockSearchParamsGet,
  mockServerTimestamp,
  mockShowToast,
  mockStartAfter,
  mockUpdateDoc,
  mockUseContext,
  mockWhere,
  mockWriteBatch,
} = vi.hoisted(() => ({
  authState: {
    current: { user: null, setUser: vi.fn(), loading: false },
  },
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockCollectionGroup: vi.fn((_db, groupId) => ({ type: 'collectionGroup', path: groupId })),
  mockDoc: vi.fn((base, ...segments) => ({
    type: 'doc',
    path: base?.type === 'collection' ? [base.path, ...segments].join('/') : segments.join('/'),
    id: String(segments.at(-1) ?? ''),
  })),
  mockDocumentId: vi.fn(() => '__name__'),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockIncrement: vi.fn((value) => ({ __type: 'increment', value })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
  mockReplace: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  mockShowToast: vi.fn(),
  mockStartAfter: vi.fn((...cursor) => ({ type: 'startAfter', cursor })),
  mockUpdateDoc: vi.fn(),
  mockUseContext: vi.fn(),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockWriteBatch: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
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
  startAfter: mockStartAfter,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
  writeBatch: mockWriteBatch,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

/**
 * @param {{ user?: ReturnType<typeof createTestUser> | null, showToast?: import('vitest').Mock }} [options] - wrapper 設定。
 * @returns {{ showToast: import('vitest').Mock }} toast mock。
 */
function createWrapper(options = {}) {
  authState.current = {
    user: options.user === undefined ? createTestUser() : options.user,
    setUser: vi.fn(),
    loading: false,
  };

  return {
    showToast: options.showToast ?? mockShowToast,
  };
}

/**
 * @returns {import('react').FormEvent<HTMLFormElement> & { preventDefault: import('vitest').Mock }} submit event。
 */
function createSubmitEvent() {
  return /** @type {import('react').FormEvent<HTMLFormElement> & { preventDefault: import('vitest').Mock }} */ (
    /** @type {unknown} */ ({ preventDefault: vi.fn() })
  );
}

describe('usePostsPageRuntime', () => {
  /** @type {ReturnType<typeof installIntersectionObserverMock>} */
  let observer;

  beforeEach(() => {
    observer = installIntersectionObserverMock();
    vi.clearAllMocks();
    mockShowToast.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('scrollTo', vi.fn());
    mockAddDoc.mockResolvedValue({ id: 'post-new' });
    mockGetDoc.mockResolvedValue(createDocumentSnapshot('missing', null));
    mockGetDocs.mockImplementation(createDocsDispatcher());
    mockSearchParamsGet.mockReturnValue(null);
  });

  afterEach(() => {
    observer.restore();
    vi.unstubAllGlobals();
  });

  it('loads the initial feed and hydrates liked and isAuthor flags', async () => {
    const latestPosts = [
      createPostFixture(1, { authorUid: 'user-1' }),
      createPostFixture(2, { authorUid: 'user-2' }),
    ];
    mockGetDocs.mockImplementation(createDocsDispatcher({ latestPosts, likedPostIds: ['post-2'] }));
    createWrapper();
    const { result } = renderHook(() => usePostsPageRuntime());

    result.current.bottomRef.current = document.createElement('div');

    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    expect(result.current.posts[0]).toMatchObject({ id: 'post-1', isAuthor: true, liked: false });
    expect(result.current.posts[1]).toMatchObject({ id: 'post-2', isAuthor: false, liked: true });
    expect(result.current.isLoading).toBe(false);
  });

  it('loads the next page through the observer and dedupes repeated ids', async () => {
    const latestPosts = createPostList(10);
    const nextPosts = [latestPosts[9], createPostFixture(11)];
    mockGetDocs.mockImplementation(createDocsDispatcher({ latestPosts, nextPosts }));
    createWrapper({ user: null });
    const { result } = renderHook(() => usePostsPageRuntime());
    const sentinel = document.createElement('div');

    result.current.bottomRef.current = sentinel;

    await waitFor(() => expect(result.current.posts).toHaveLength(10));
    await waitFor(() => expect(observer.observe).toHaveBeenCalled());

    act(() => {
      observer.trigger([{ isIntersecting: true }]);
    });

    await waitFor(() => expect(result.current.posts).toHaveLength(11));

    expect(result.current.posts.filter((post) => post.id === latestPosts[9].id)).toHaveLength(1);
    expect(result.current.posts.at(-1)?.id).toBe('post-11');
    expect(result.current.isLoadingNext).toBe(false);
  });

  it('creates a post, prepends hydrated detail, and resets the composer state', async () => {
    const createdPost = createPostFixture(9, {
      id: 'post-new',
      authorUid: 'user-1',
      authorName: 'Alice',
      authorImgURL: 'https://example.com/alice.png',
      title: '新的文章',
      content: '新的內容',
    });
    mockGetDoc.mockImplementation(async (ref) =>
      ref?.path === 'posts/post-new'
        ? createDocumentSnapshot('post-new', createdPost)
        : createDocumentSnapshot('missing', null),
    );
    mockGetDocs.mockImplementation(createDocsDispatcher({ latestPosts: [] }));
    const { showToast } = createWrapper();
    const { result } = renderHook(() => usePostsPageRuntime());
    const dialog = { close: vi.fn(), showModal: vi.fn() };
    const submitEvent = createSubmitEvent();

    result.current.dialogRef.current = /** @type {HTMLDialogElement} */ (/** @type {unknown} */ (dialog));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setTitle('新的文章');
      result.current.setContent('新的內容');
    });

    await act(async () => {
      await result.current.handleSubmitPost(submitEvent);
    });

    await waitFor(() => expect(result.current.posts[0]?.id).toBe('post-new'));

    expect(mockAddDoc).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'posts' }), {
      authorUid: 'user-1',
      authorName: 'Alice',
      authorImgURL: 'https://example.com/alice.png',
      title: '新的文章',
      content: '新的內容',
      postAt: { __sentinel: 'serverTimestamp' },
      likesCount: 0,
      commentsCount: 0,
    });
    expect(showToast).toHaveBeenLastCalledWith('發佈文章成功');
    expect(globalThis.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(dialog.close).toHaveBeenCalled();
    expect(submitEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
  });

  it('deletes a post through the real cascade path and removes it from the list', async () => {
    const latestPosts = [createPostFixture(1), createPostFixture(2)];
    const batch = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    mockWriteBatch.mockReturnValue(batch);
    mockGetDocs.mockImplementation(
      createDocsDispatcher({
        latestPosts,
        collectionDocs: {
          'posts/post-1/likes': [createCollectionDoc('posts/post-1/likes/like-1')],
          'posts/post-1/comments': [createCollectionDoc('posts/post-1/comments/comment-1')],
        },
      }),
    );
    mockGetDoc.mockImplementation(async (ref) =>
      ref?.path === 'posts/post-1'
        ? createDocumentSnapshot('post-1', latestPosts[0])
        : createDocumentSnapshot('missing', null),
    );
    const { showToast } = createWrapper({ user: null });
    const { result } = renderHook(() => usePostsPageRuntime());

    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    act(() => {
      result.current.handleToggleOwnerMenu('post-1', {
        stopPropagation: vi.fn(),
      });
    });

    await act(async () => {
      await result.current.handleDeletePost('post-1');
    });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    expect(batch.commit).toHaveBeenCalled();
    expect(showToast).toHaveBeenLastCalledWith('文章已刪除');
    expect(result.current.posts[0]?.id).toBe('post-2');
    expect(result.current.openMenuPostId).toBe('');
  });

  it('keeps unauthenticated users in read-only mode for create flow', async () => {
    mockGetDocs.mockImplementation(createDocsDispatcher({ latestPosts: [createPostFixture(1)] }));
    const { showToast } = createWrapper({ user: null });
    const { result } = renderHook(() => usePostsPageRuntime());
    const submitEvent = createSubmitEvent();

    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    act(() => {
      result.current.setTitle('未登入文章');
      result.current.setContent('未登入內容');
    });

    await act(async () => {
      await result.current.handleSubmitPost(submitEvent);
    });

    expect(mockCollectionGroup).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(result.current.posts[0]).toMatchObject({ id: 'post-1', liked: false, isAuthor: false });
    expect(result.current.isSubmitting).toBe(false);
  });
});
