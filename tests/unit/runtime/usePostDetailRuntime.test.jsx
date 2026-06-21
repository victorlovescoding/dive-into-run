// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePostDetailRuntime from '../../../src/runtime/hooks/usePostDetailRuntime';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';

const mocks = vi.hoisted(() => ({
  addContentFavorite: vi.fn(),
  usePostComments: vi.fn(),
  showToast: vi.fn(),
  push: vi.fn(),
  getPostDetail: vi.fn(),
  getLatestCommentsPage: vi.fn(),
  hasUserLikedPost: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
  removeContentFavorite: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../src/runtime/providers/AuthProvider', async () => {
  const { createContext } = await vi.importActual('react');
  return {
    AuthContext: createContext({ user: null, setUser: () => {}, loading: true }),
  };
});

vi.mock('../../../src/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(),
}));

vi.mock('../../../src/runtime/hooks/usePostComments', () => ({
  default: mocks.usePostComments,
}));

vi.mock('../../../src/runtime/client/use-cases/post-use-cases', () => ({
  POST_NOT_FOUND_MESSAGE: '找不到這篇文章',
  deletePost: vi.fn(),
  fetchPostHistory: vi.fn(),
  getLatestCommentsPage: mocks.getLatestCommentsPage,
  getPostDetail: mocks.getPostDetail,
  hasUserLikedPost: mocks.hasUserLikedPost,
  toggleLikePost: vi.fn(),
  updatePost: vi.fn(),
  validatePostInput: vi.fn(),
}));

vi.mock('../../../src/runtime/client/use-cases/content-favorite-use-cases', () => ({
  FAVORITE_CONTENT_TYPES: { POST: 'post' },
  addContentFavorite: mocks.addContentFavorite,
  getFavoritedTargetIds: mocks.getFavoritedTargetIds,
  removeContentFavorite: mocks.removeContentFavorite,
}));

vi.mock('../../../src/repo/client/firebase-auth-repo', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock('../../../src/repo/client/post-composer-draft-storage-repo', () => ({
  loadPostComposerDraft: vi.fn(),
  removePostComposerDraft: vi.fn(),
  savePostComposerDraft: vi.fn(),
}));

const pinnedComment = {
  id: 'comment-old',
  authorUid: 'runner-old',
  content: '通知中的文章留言',
};

const visibleComments = [
  {
    id: 'comment-newer',
    authorUid: 'runner-new',
    content: '一般文章留言',
  },
];

const viewer = {
  uid: 'post-detail-viewer',
  name: '文章詳情測試者',
  email: 'detail@example.test',
  photoURL: 'https://example.test/avatar/detail.png',
  bio: null,
  accountStatus: 'active',
  deletionScheduledFor: null,
  getIdToken: vi.fn(),
};

const postDetail = {
  id: 'post-1',
  title: '文章標題',
  content: '文章內容',
  authorUid: 'author-1',
  authorName: '作者',
  commentsCount: 0,
  likesCount: 0,
};

/**
 * Builds the mocked usePostComments contract used by post detail runtime.
 * @param {object} [overrides] Contract overrides.
 * @returns {object} Mocked post comments hook return.
 */
function makePostComments(overrides = {}) {
  return {
    comments: visibleComments,
    pinnedComment,
    visibleComments,
    activeTargetId: 'comment-old',
    isLoadingTargetComment: false,
    comment: '',
    historyComment: null,
    historyEntries: [],
    historyError: null,
    highlightedCommentId: 'comment-old',
    isLoadingNext: false,
    bottomRef: { current: null },
    handleEditComment: vi.fn(),
    handleDeleteComment: vi.fn(),
    handleViewHistory: vi.fn(),
    handleCloseHistory: vi.fn(),
    handleSubmitComment: vi.fn(),
    handleCommentChange: vi.fn(),
    setInitialComments: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders post detail runtime with stable auth context.
 * @param {{ authUser?: typeof viewer | null, id?: string }} [options] Render options.
 * @returns {ReturnType<typeof renderHook> & {
 *   setAuthUser: (nextUser: typeof viewer | null) => void
 * }} Rendered hook.
 */
function renderUsePostDetailRuntime({ authUser = viewer, id = 'post-1' } = {}) {
  let currentAuthUser = authUser;
  const utils = renderHook(() => usePostDetailRuntime(id), {
    wrapper: ({ children }) => (
      <AuthContext.Provider value={{ user: currentAuthUser, setUser: vi.fn(), loading: false }}>
        {children}
      </AuthContext.Provider>
    ),
  });

  return {
    ...utils,
    setAuthUser(nextUser) {
      currentAuthUser = nextUser;
      utils.rerender();
    },
  };
}

/**
 * Creates a controllable promise for race-condition assertions.
 * @template T
 * @returns {{
 *   promise: Promise<T>,
 *   resolve: (value: T | PromiseLike<T>) => void,
 *   reject: (reason?: unknown) => void
 * }} Deferred promise controls.
 */
function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve = () => {};
  /** @type {(reason?: unknown) => void} */
  let reject = () => {};
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

/**
 * Returns a runtime handler after asserting the contract exists.
 * @param {Record<string, unknown>} runtime Runtime hook value.
 * @param {string} name Handler name.
 * @returns {(...args: Array<unknown>) => unknown} Runtime handler.
 */
function getRuntimeHandler(runtime, name) {
  const handler = Reflect.get(runtime, name);
  expect(typeof handler).toBe('function');
  return /** @type {(...args: Array<unknown>) => unknown} */ (handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usePostComments.mockReturnValue(makePostComments());
  mocks.getPostDetail.mockResolvedValue(postDetail);
  mocks.getLatestCommentsPage.mockResolvedValue({
    comments: [],
    nextCursor: null,
    hasMore: false,
  });
  mocks.hasUserLikedPost.mockResolvedValue(false);
  mocks.getFavoritedTargetIds.mockResolvedValue(new Set());
  mocks.signInWithGoogle.mockResolvedValue({
    user: { uid: 'runner-after-google' },
  });
});

describe('usePostDetailRuntime comment target boundary', () => {
  it('returns pinned and visible comments from usePostComments to the screen runtime contract', () => {
    const { result } = renderUsePostDetailRuntime();

    expect(result.current.pinnedComment).toBe(pinnedComment);
    expect(result.current.visibleComments).toBe(visibleComments);
    expect(result.current.activeTargetId).toBe('comment-old');
    expect(result.current.isLoadingTargetComment).toBe(false);
  });
});

describe('usePostDetailRuntime favorite login continuation', () => {
  it('opens the post continuation dialog for unauthenticated favorite clicks without toast', async () => {
    const { result } = renderUsePostDetailRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.post?.id).toBe('post-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost('post-1');
    });

    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'post',
      body: '登入後會自動將這篇文章加入收藏。',
      isSubmitting: false,
    });
    expect(mocks.showToast).not.toHaveBeenCalledWith('請先登入才能收藏', 'info');
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
  });

  it('does not open continuation when the post detail is missing', async () => {
    mocks.getPostDetail.mockResolvedValueOnce(null);
    const { result } = renderUsePostDetailRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.post).toBeNull();
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost('post-1');
    });

    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(mocks.showToast).not.toHaveBeenCalledWith('請先登入才能收藏', 'info');
  });

  it('patches the detail favorite state after continuation success for the clicked post', async () => {
    const { result } = renderUsePostDetailRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.post?.id).toBe('post-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost('post-1');
    });
    await act(async () => {
      await getRuntimeHandler(result.current, 'confirmContinuation')();
    });

    expect(mocks.signInWithGoogle).toHaveBeenCalled();
    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-after-google',
      type: 'post',
      targetId: 'post-1',
    });
    expect(result.current.post?.isFavorited).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });

  it('keeps the continuation favorite when signed-in detail reload returns stale empty favorites after add success', async () => {
    const pendingAddFavorite = createDeferred();
    const staleSignedInFavorites = createDeferred();
    mocks.addContentFavorite.mockReturnValueOnce(pendingAddFavorite.promise);
    mocks.getFavoritedTargetIds.mockReturnValueOnce(staleSignedInFavorites.promise);

    const { result, setAuthUser } = renderUsePostDetailRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.post?.id).toBe('post-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost('post-1');
    });

    /** @type {Promise<void>} */
    let confirmPromise;
    act(() => {
      confirmPromise = getRuntimeHandler(result.current, 'confirmContinuation')();
    });

    await waitFor(() => {
      expect(mocks.addContentFavorite).toHaveBeenCalledWith({
        uid: 'runner-after-google',
        type: 'post',
        targetId: 'post-1',
      });
    });

    act(() => {
      setAuthUser({ ...viewer, uid: 'runner-after-google' });
    });
    await waitFor(() => {
      expect(mocks.getFavoritedTargetIds).toHaveBeenCalledWith({
        uid: 'runner-after-google',
        type: 'post',
        targetIds: ['post-1'],
      });
    });

    await act(async () => {
      pendingAddFavorite.resolve(undefined);
      await confirmPromise;
    });
    expect(result.current.post?.isFavorited).toBe(true);

    await act(async () => {
      staleSignedInFavorites.resolve(new Set());
      await staleSignedInFavorites.promise;
    });

    expect(result.current.post?.isFavorited).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });
});

describe('usePostDetailRuntime signed-in favorite regressions', () => {
  it('keeps signed-in add favorite on the existing branch without opening continuation', async () => {
    const { result } = renderUsePostDetailRuntime();

    await waitFor(() => {
      expect(result.current.post?.id).toBe('post-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost('post-1');
    });

    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'post-detail-viewer',
      type: 'post',
      targetId: 'post-1',
    });
    expect(mocks.removeContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.post?.isFavorited).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('已加入收藏', 'success');
  });

  it('keeps signed-in remove favorite on the existing branch without opening continuation', async () => {
    mocks.getFavoritedTargetIds.mockResolvedValueOnce(new Set(['post-1']));
    const { result } = renderUsePostDetailRuntime();

    await waitFor(() => {
      expect(result.current.post?.isFavorited).toBe(true);
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost('post-1');
    });

    expect(mocks.removeContentFavorite).toHaveBeenCalledWith({
      uid: 'post-detail-viewer',
      type: 'post',
      targetId: 'post-1',
    });
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.post?.isFavorited).toBe(false);
    expect(mocks.showToast).toHaveBeenCalledWith('已取消收藏', 'success');
  });
});
