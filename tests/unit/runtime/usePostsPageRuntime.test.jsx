// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPostSearchPost } from '../../_helpers/posts-search-fixtures';
import usePostsPageRuntime from '../../../src/runtime/hooks/usePostsPageRuntime';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';

const mocks = vi.hoisted(() => ({
  addContentFavorite: vi.fn(),
  createPost: vi.fn(),
  deletePost: vi.fn(),
  fetchPostHistory: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
  getLatestPosts: vi.fn(),
  getMorePosts: vi.fn(),
  getPostDetail: vi.fn(),
  hasUserLikedPosts: vi.fn(),
  removeContentFavorite: vi.fn(),
  replace: vi.fn(),
  showToast: vi.fn(),
  signInWithGoogle: vi.fn(),
  toggleLikePost: vi.fn(),
  updatePost: vi.fn(),
  validatePostInput: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

vi.mock('../../../src/runtime/providers/AuthProvider', async () => {
  const { createContext } = await vi.importActual('react');
  return {
    AuthContext: createContext({ user: null, setUser: () => {}, loading: true }),
  };
});

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../src/runtime/client/use-cases/post-use-cases', () => ({
  createPost: mocks.createPost,
  deletePost: mocks.deletePost,
  fetchPostHistory: mocks.fetchPostHistory,
  getLatestPosts: mocks.getLatestPosts,
  getMorePosts: mocks.getMorePosts,
  getPostDetail: mocks.getPostDetail,
  hasUserLikedPosts: mocks.hasUserLikedPosts,
  toggleLikePost: mocks.toggleLikePost,
  updatePost: mocks.updatePost,
  validatePostInput: mocks.validatePostInput,
}));

vi.mock('../../../src/runtime/client/use-cases/content-favorite-use-cases', () => ({
  addContentFavorite: mocks.addContentFavorite,
  FAVORITE_CONTENT_TYPES: { POST: 'post' },
  getFavoritedTargetIds: mocks.getFavoritedTargetIds,
  removeContentFavorite: mocks.removeContentFavorite,
}));

vi.mock('../../../src/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock('../../../src/runtime/hooks/useEditHistoryModal', () => ({
  default: () => ({
    historyTarget: null,
    historyEntries: [],
    historyError: null,
    isHistoryOpen: false,
    handleViewHistory: vi.fn(),
    handleCloseHistory: vi.fn(),
  }),
}));

vi.mock('../../../src/repo/client/post-composer-draft-storage-repo', () => ({
  loadPostComposerDraft: vi.fn(),
  removePostComposerDraft: vi.fn(),
  savePostComposerDraft: vi.fn(),
}));

const viewer = {
  uid: 'posts-runtime-viewer',
  name: '文章頁測試者',
  email: 'posts@example.test',
  photoURL: 'https://example.test/avatar/posts.png',
  bio: null,
  accountStatus: 'active',
  deletionScheduledFor: null,
  getIdToken: vi.fn(),
};

const firstPost = createPostSearchPost({
  id: 'post-runtime-first',
  title: '第一篇文章',
  isFavorited: false,
});

const clickedPost = createPostSearchPost({
  id: 'post-runtime-clicked',
  title: '被點擊的文章',
  isFavorited: false,
});

/**
 * Renders posts page runtime with stable auth context.
 * @param {{ authUser?: typeof viewer | null }} [options] Render options.
 * @returns {ReturnType<typeof renderHook> & {
 *   setAuthUser: (nextUser: typeof viewer | null) => void
 * }} Rendered runtime hook.
 */
function renderUsePostsPageRuntime({ authUser = viewer } = {}) {
  let currentAuthUser = authUser;
  const utils = renderHook(() => usePostsPageRuntime(), {
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLatestPosts.mockResolvedValue([firstPost, clickedPost]);
  mocks.getMorePosts.mockResolvedValue([]);
  mocks.hasUserLikedPosts.mockResolvedValue(new Set());
  mocks.getFavoritedTargetIds.mockResolvedValue(new Set());
  mocks.signInWithGoogle.mockResolvedValue({
    user: { uid: 'runner-after-google' },
  });
  mocks.validatePostInput.mockReturnValue(null);
});

describe('usePostsPageRuntime favorite login continuation', () => {
  it('opens the post continuation dialog for unauthenticated favorite clicks without toast', async () => {
    const { result } = renderUsePostsPageRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual([
        firstPost.id,
        clickedPost.id,
      ]);
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost(clickedPost.id);
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

  it('patches only the clicked post as favorited after continuation success', async () => {
    const { result } = renderUsePostsPageRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual([
        firstPost.id,
        clickedPost.id,
      ]);
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost(clickedPost.id);
    });
    await act(async () => {
      await getRuntimeHandler(result.current, 'confirmContinuation')();
    });

    expect(mocks.signInWithGoogle).toHaveBeenCalled();
    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-after-google',
      type: 'post',
      targetId: clickedPost.id,
    });
    expect(result.current.posts.map((post) => [post.id, post.isFavorited])).toEqual([
      [firstPost.id, false],
      [clickedPost.id, true],
    ]);
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });

  it('keeps the continuation favorite when signed-in initial hydrate returns stale empty favorites after add success', async () => {
    const pendingAddFavorite = createDeferred();
    const staleSignedInFavoriteIds = createDeferred();
    mocks.addContentFavorite.mockReturnValueOnce(pendingAddFavorite.promise);
    mocks.getFavoritedTargetIds.mockReturnValueOnce(staleSignedInFavoriteIds.promise);

    const { result, setAuthUser } = renderUsePostsPageRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual([
        firstPost.id,
        clickedPost.id,
      ]);
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost(clickedPost.id);
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
        targetId: clickedPost.id,
      });
    });

    act(() => {
      setAuthUser({ ...viewer, uid: 'runner-after-google' });
    });
    await waitFor(() => {
      expect(mocks.getFavoritedTargetIds).toHaveBeenCalledWith({
        uid: 'runner-after-google',
        type: 'post',
        targetIds: [firstPost.id, clickedPost.id],
      });
    });

    await act(async () => {
      pendingAddFavorite.resolve(undefined);
      await confirmPromise;
    });
    expect(result.current.posts.find((post) => post.id === clickedPost.id)?.isFavorited).toBe(
      true,
    );

    await act(async () => {
      staleSignedInFavoriteIds.resolve(new Set());
      await staleSignedInFavoriteIds.promise;
    });

    expect(result.current.posts.find((post) => post.id === clickedPost.id)?.isFavorited).toBe(
      true,
    );
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });
});

describe('usePostsPageRuntime signed-in favorite regressions', () => {
  it('keeps signed-in add favorite on the existing branch without opening continuation', async () => {
    const { result } = renderUsePostsPageRuntime();

    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual([
        firstPost.id,
        clickedPost.id,
      ]);
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost(clickedPost.id);
    });

    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'posts-runtime-viewer',
      type: 'post',
      targetId: clickedPost.id,
    });
    expect(mocks.removeContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.posts.map((post) => [post.id, post.isFavorited])).toEqual([
      [firstPost.id, false],
      [clickedPost.id, true],
    ]);
    expect(mocks.showToast).toHaveBeenCalledWith('已加入收藏', 'success');
  });

  it('keeps signed-in remove favorite on the existing branch without opening continuation', async () => {
    mocks.getFavoritedTargetIds.mockResolvedValueOnce(new Set([clickedPost.id]));
    const { result } = renderUsePostsPageRuntime();

    await waitFor(() => {
      expect(result.current.posts.find((post) => post.id === clickedPost.id)?.isFavorited).toBe(
        true,
      );
    });
    await act(async () => {
      await result.current.handleToggleFavoritePost(clickedPost.id);
    });

    expect(mocks.removeContentFavorite).toHaveBeenCalledWith({
      uid: 'posts-runtime-viewer',
      type: 'post',
      targetId: clickedPost.id,
    });
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.posts.find((post) => post.id === clickedPost.id)?.isFavorited).toBe(
      false,
    );
    expect(mocks.showToast).toHaveBeenCalledWith('已取消收藏', 'success');
  });
});
