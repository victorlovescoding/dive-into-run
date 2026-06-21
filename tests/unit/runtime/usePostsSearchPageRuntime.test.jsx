// @vitest-environment jsdom

import { pathToFileURL } from 'node:url';
import { useEffect } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';
import {
  createPostSearchCursor,
  createPostSearchMatch,
  createPostSearchPage,
  createPostSearchPost,
  POST_SEARCH_CHINESE_KEYWORD,
  POST_SEARCH_KEYWORD,
  POST_SEARCH_VIEWER_UID,
} from '../../_helpers/posts-search-fixtures';
import {
  mockPostsSearchNavigation,
  resetPostsSearchRuntimeMocks,
} from '../../_helpers/posts-search-runtime-mocks.jsx';

const POSTS_SEARCH_RUNTIME_MODULE_URL = pathToFileURL(
  `${process.cwd()}/src/runtime/hooks/usePostsSearchPageRuntime.js`,
);

const mocks = vi.hoisted(() => ({
  addContentFavorite: vi.fn(),
  deletePost: vi.fn(),
  fetchPostHistory: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
  getPostDetail: vi.fn(),
  hasUserLikedPosts: vi.fn(),
  removeContentFavorite: vi.fn(),
  searchPublicActivePosts: vi.fn(),
  signInWithGoogle: vi.fn(),
  showToast: vi.fn(),
  toggleLikePost: vi.fn(),
  updatePost: vi.fn(),
  validatePostInput: vi.fn(),
}));

const navigation = mockPostsSearchNavigation();

const intersectionObserverRecords = [];

class MockIntersectionObserver {
  /**
   * @param {IntersectionObserverCallback} callback Observer callback.
   * @param {IntersectionObserverInit} [options] Observer options.
   */
  constructor(callback, options = {}) {
    this.callback = callback;
    this.options = options;
    this.observedElements = new Set();
    intersectionObserverRecords.push(this);
  }

  /**
   * @param {Element} target Observed target.
   * @returns {void}
   */
  observe(target) {
    this.observedElements.add(target);
  }

  /**
   * @param {Element} target Observed target.
   * @returns {void}
   */
  unobserve(target) {
    this.observedElements.delete(target);
  }

  /** @returns {void} */
  disconnect() {
    this.observedElements.clear();
  }

  /**
   * Triggers the observer callback for a test-controlled target.
   * @param {Element} target Observed target.
   * @param {boolean} [isIntersecting] Intersection state.
   * @returns {Promise<void>} Callback completion.
   */
  async trigger(target, isIntersecting = true) {
    const entry = /** @type {IntersectionObserverEntry} */ ({
      isIntersecting,
      target,
      intersectionRatio: isIntersecting ? 1 : 0,
    });
    await this.callback([entry], /** @type {IntersectionObserver} */ (this));
  }
}

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
  deletePost: mocks.deletePost,
  fetchPostHistory: mocks.fetchPostHistory,
  getPostDetail: mocks.getPostDetail,
  hasUserLikedPosts: mocks.hasUserLikedPosts,
  searchPublicActivePosts: mocks.searchPublicActivePosts,
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

vi.mock('../../../src/repo/client/firebase-auth-repo', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock('../../../src/repo/client/firebase-auth-repo', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock('../../../src/runtime/hooks/useEditHistoryModal', async () => {
  const { useCallback, useState } = await vi.importActual('react');

  /**
   * Test-local edit history modal hook mock that preserves the production hook
   * contract closely enough for runtime wiring assertions.
   * @param {object} options Mock hook options.
   * @param {(target: object) => Promise<Array<object>>} options.loadHistory History loader.
   * @param {string} [options.loadErrorMessage] Error message.
   * @returns {object} Mock edit history modal state and handlers.
   */
  function useMockEditHistoryModal({ loadHistory, loadErrorMessage = '載入編輯記錄失敗' }) {
    const [historyEntries, setHistoryEntries] = useState([]);
    const [historyError, setHistoryError] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);

    const handleCloseHistory = useCallback(() => {
      setHistoryEntries([]);
      setHistoryError(null);
      setHistoryTarget(null);
    }, []);

    const handleViewHistory = useCallback(
      async (target) => {
        setHistoryEntries([]);
        setHistoryError(null);
        setHistoryTarget(target);

        try {
          const entries = await loadHistory(target);
          setHistoryEntries(Array.isArray(entries) ? entries : []);
        } catch {
          setHistoryEntries([]);
          setHistoryError(loadErrorMessage);
        }
      },
      [loadHistory, loadErrorMessage],
    );

    return {
      historyEntries,
      historyError,
      historyTarget,
      isHistoryOpen: historyTarget !== null,
      handleCloseHistory,
      handleViewHistory,
    };
  }

  return {
    default: useMockEditHistoryModal,
  };
});

/**
 * @typedef {() => {
 *   keyword: string,
 *   searchInput: string,
 *   setSearchInput: (value: string) => void,
 *   results: Array<{ post: { id: string } }>,
 *   status?: 'idle' | 'loading' | 'success' | 'empty' | 'loadingMore' | 'error',
 *   errorMessage?: string | null,
 *   hasMore?: boolean,
 *   isLoadingNext?: boolean,
 *   title?: string,
 *   content?: string,
 *   originalTitle?: string,
 *   originalContent?: string,
 *   editingPostId?: string | null,
 *   isSubmitting?: boolean,
 *   bottomRef?: { current: HTMLDivElement | null },
 *   dialogRef?: { current: HTMLDialogElement | null },
 *   openMenuPostId?: string,
 *   articleHistoryEntries?: Array<object>,
 *   articleHistoryError?: string | null,
 *   articleHistoryPost?: object | null,
 *   isArticleHistoryOpen?: boolean,
 *   dialogState?: object,
 *   handleSubmitSearch: (event?: { preventDefault?: () => void }) => void | Promise<void>,
 *   handleRetrySearch?: () => void | Promise<void>,
 *   handlePressLike?: (postId: string) => void | Promise<void>,
 *   handleToggleFavoritePost?: (postId: string) => void | Promise<void>,
 *   handleToggleOwnerMenu?: (postId: string, event?: { stopPropagation?: () => void }) => void,
 *   handleCloseOwnerMenu?: () => void,
 *   handleEditPost?: (postId: string) => void,
 *   handleDeletePost?: (postId: string) => void | Promise<void>,
 *   handleSubmitPost?: (event: { preventDefault?: () => void }) => void | Promise<void>,
 *   handleViewArticleHistory?: (post: object) => void | Promise<void>,
 *   handleCloseArticleHistory?: () => void,
 *   confirmContinuation?: () => Promise<void>,
 *   cancelContinuation?: () => void,
 *   closeContinuation?: () => void,
 * }} UsePostsSearchPageRuntime
 */

/** @type {UsePostsSearchPageRuntime} */
let usePostsSearchPageRuntime = () => {
  throw new Error('usePostsSearchPageRuntime has not been loaded');
};

const viewer = {
  uid: POST_SEARCH_VIEWER_UID,
  name: '搜尋頁測試者',
  email: 'searcher@example.test',
  photoURL: 'https://example.test/avatar/searcher.png',
  bio: null,
  accountStatus: 'active',
  deletionScheduledFor: null,
  getIdToken: vi.fn(),
};

/**
 * Dynamically resolves the future runtime hook so this TDD RED file stays
 * lint/type clean before T017 adds the module.
 * @returns {Promise<void>} Hook module load completion.
 */
async function loadPostsSearchPageRuntime() {
  const runtimeModule = await import(POSTS_SEARCH_RUNTIME_MODULE_URL.href);
  const hook = Reflect.get(runtimeModule, 'default');
  expect(typeof hook).toBe('function');
  usePostsSearchPageRuntime = /** @type {UsePostsSearchPageRuntime} */ (hook);
}

/**
 * Renders the posts search page runtime with stable auth context.
 * @param {{ user?: typeof viewer | null }} [options] Render options.
 * @returns {ReturnType<typeof renderHook<ReturnType<UsePostsSearchPageRuntime>, unknown>> & {
 *   setAuthUser: (nextUser: typeof viewer | null) => void,
 * }} Rendered runtime hook.
 */
function renderUsePostsSearchPageRuntime({ user = viewer } = {}) {
  let currentUser = user;
  const utils = renderHook(() => usePostsSearchPageRuntime(), {
    wrapper: ({ children }) => (
      <AuthContext.Provider value={{ user: currentUser, setUser: vi.fn(), loading: false }}>
        {children}
      </AuthContext.Provider>
    ),
  });

  return {
    ...utils,
    setAuthUser(nextUser) {
      currentUser = nextUser;
      utils.rerender();
    },
  };
}

/**
 * @typedef {object} RuntimeHostSnapshot
 * @property {Array<{ post: { id: string } }>} results - Current search results.
 * @property {'idle' | 'loading' | 'success' | 'empty' | 'loadingMore' | 'error'} status
 *   Current search status.
 * @property {string | null} errorMessage - Current user-facing error message.
 * @property {boolean} hasMore - Whether more search results are available.
 * @property {boolean} isLoadingNext - Whether the next page is loading.
 */

/**
 * Renders a production-like search runtime host that attaches the bottom ref
 * when search results first render.
 * @param {{ onRuntime?: (runtime: RuntimeHostSnapshot) => void }} [options]
 *   Runtime host options.
 * @returns {ReturnType<typeof render>} Rendered runtime host.
 */
function renderPostsSearchRuntimeHost({ onRuntime = () => {} } = {}) {
  /**
   * @returns {import('react').ReactElement | null} Runtime host element.
   */
  function PostsSearchRuntimeHost() {
    const { bottomRef, errorMessage, hasMore, isLoadingNext, results, status } =
      usePostsSearchPageRuntime();

    useEffect(() => {
      onRuntime({ errorMessage, hasMore, isLoadingNext, results, status });
    }, [errorMessage, hasMore, isLoadingNext, results, status]);

    return results.length > 0 ? <div data-testid="search-bottom-sentinel" ref={bottomRef} /> : null;
  }

  return render(
    <AuthContext.Provider value={{ user: viewer, setUser: vi.fn(), loading: false }}>
      <PostsSearchRuntimeHost />
    </AuthContext.Provider>,
  );
}

/**
 * Returns a runtime handler after asserting the future contract exists.
 * @param {ReturnType<UsePostsSearchPageRuntime>} runtime Runtime hook value.
 * @param {keyof ReturnType<UsePostsSearchPageRuntime>} name Handler name.
 * @returns {(...args: Array<unknown>) => unknown} Runtime handler.
 */
function getRuntimeHandler(runtime, name) {
  const handler = Reflect.get(runtime, name);
  expect(typeof handler).toBe('function');
  return /** @type {(...args: Array<unknown>) => unknown} */ (handler);
}

/**
 * Loads one search result into the runtime from the URL q parameter.
 * @param {ReturnType<typeof createPostSearchPost>} post Result post.
 * @param {{ user?: typeof viewer | null }} [options] Render options.
 * @returns {ReturnType<typeof renderUsePostsSearchPageRuntime>} Rendered hook.
 */
async function renderRuntimeWithSearchResult(post, options = {}) {
  mocks.searchPublicActivePosts.mockResolvedValueOnce(
    createPostSearchPage({
      keyword: POST_SEARCH_KEYWORD,
      items: [createPostSearchMatch({ post })],
      nextCursor: null,
      hasMore: false,
      scannedCount: 1,
    }),
  );
  navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

  const view = renderUsePostsSearchPageRuntime(options);
  await waitFor(() => {
    expect(view.result.current.results.map((match) => match.post.id)).toEqual([post.id]);
  });
  return view;
}

/** @returns {void} */
function installMockIntersectionObserver() {
  intersectionObserverRecords.length = 0;
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
}

/**
 * Returns the newest mock observer.
 * @returns {MockIntersectionObserver} Latest observer.
 */
function getLatestIntersectionObserver() {
  const observer = intersectionObserverRecords.at(-1);
  expect(observer).toBeDefined();
  return /** @type {MockIntersectionObserver} */ (observer);
}

/**
 * Creates a controllable promise for loading-state assertions.
 * @template T
 * @returns {{
 *   promise: Promise<T>,
 *   resolve: (value: T | PromiseLike<T>) => void,
 *   reject: (reason?: unknown) => void,
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

beforeAll(async () => {
  await loadPostsSearchPageRuntime();
});

beforeEach(() => {
  vi.resetAllMocks();
  resetPostsSearchRuntimeMocks();
  mocks.searchPublicActivePosts.mockResolvedValue(
    createPostSearchPage({
      items: [],
      nextCursor: null,
      hasMore: false,
      scannedCount: 0,
    }),
  );
  mocks.getFavoritedTargetIds.mockResolvedValue(new Set());
  mocks.hasUserLikedPosts.mockResolvedValue(new Set());
  mocks.signInWithGoogle.mockResolvedValue({
    user: { uid: 'runner-after-google' },
  });
  mocks.updatePost.mockResolvedValue(undefined);
  mocks.validatePostInput.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('usePostsSearchPageRuntime URL validation', () => {
  it.each([
    ['missing q', ''],
    ['blank q', { q: '   ' }],
  ])('redirects to /posts without searching when %s is provided', async (_label, searchParams) => {
    navigation.setSearchParams(searchParams);

    renderUsePostsSearchPageRuntime();

    await waitFor(() => {
      expect(navigation.router.replace).toHaveBeenCalledWith('/posts');
    });
    expect(mocks.searchPublicActivePosts).not.toHaveBeenCalled();
  });

  it('redirects and clears retained results when q becomes invalid after a successful search', async () => {
    const resultPost = createPostSearchPost({ id: 'post-search-valid-before-invalid-q' });
    mocks.searchPublicActivePosts.mockResolvedValueOnce(
      createPostSearchPage({
        keyword: POST_SEARCH_KEYWORD,
        items: [createPostSearchMatch({ post: resultPost })],
        nextCursor: null,
        hasMore: false,
        scannedCount: 1,
      }),
    );
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    const view = renderUsePostsSearchPageRuntime();
    await waitFor(() => {
      expect(view.result.current.results.map((match) => match.post.id)).toEqual([resultPost.id]);
    });

    navigation.setSearchParams('q=%20%20%20');
    view.rerender();

    await waitFor(() => {
      expect(navigation.router.replace).toHaveBeenCalledWith('/posts');
    });
    expect(view.result.current.keyword).toBe('');
    expect(view.result.current.searchInput).toBe('');
    expect(view.result.current.results).toEqual([]);
    expect(mocks.searchPublicActivePosts).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: POST_SEARCH_KEYWORD }),
    );
    expect(mocks.searchPublicActivePosts).not.toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '' }),
    );
  });
});

describe('usePostsSearchPageRuntime initial search', () => {
  it('loads the first search page from a valid q URL using the current viewer uid', async () => {
    const resultPost = createPostSearchPost({ id: 'post-search-runtime-hit' });
    const resultMatch = createPostSearchMatch({ post: resultPost });
    mocks.searchPublicActivePosts.mockResolvedValueOnce(
      createPostSearchPage({
        keyword: POST_SEARCH_KEYWORD,
        items: [resultMatch],
        nextCursor: null,
        hasMore: false,
        scannedCount: 1,
      }),
    );
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    const { result } = renderUsePostsSearchPageRuntime();

    await waitFor(() => {
      expect(result.current.results.map((match) => match.post.id)).toEqual([resultPost.id]);
    });
    expect(mocks.searchPublicActivePosts).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: POST_SEARCH_KEYWORD,
        userUid: POST_SEARCH_VIEWER_UID,
        pageSize: expect.any(Number),
        cursor: null,
      }),
    );
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });

  it('hydrates keyword state and the editable search input from the trimmed URL q', async () => {
    navigation.setSearchParams({ q: `  ${POST_SEARCH_CHINESE_KEYWORD}  ` });

    const { result } = renderUsePostsSearchPageRuntime();

    await waitFor(() => {
      expect(result.current.keyword).toBe(POST_SEARCH_CHINESE_KEYWORD);
    });
    expect(result.current.searchInput).toBe(POST_SEARCH_CHINESE_KEYWORD);
    expect(mocks.searchPublicActivePosts).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: POST_SEARCH_CHINESE_KEYWORD }),
    );
  });
});

describe('usePostsSearchPageRuntime search form navigation', () => {
  it('pushes a new encoded search URL when submitting a changed nonblank keyword', async () => {
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });
    const { result } = renderUsePostsSearchPageRuntime();

    await waitFor(() => {
      expect(result.current.searchInput).toBe(POST_SEARCH_KEYWORD);
    });

    await act(async () => {
      result.current.setSearchInput(`  ${POST_SEARCH_CHINESE_KEYWORD} hill  `);
    });
    await act(async () => {
      await result.current.handleSubmitSearch();
    });

    expect(navigation.router.push).toHaveBeenCalledWith(
      `/posts/search?q=${encodeURIComponent(`${POST_SEARCH_CHINESE_KEYWORD} hill`)}`,
    );
  });

  it('returns to /posts when the retained search input is cleared and submitted', async () => {
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });
    const { result } = renderUsePostsSearchPageRuntime();

    await waitFor(() => {
      expect(result.current.searchInput).toBe(POST_SEARCH_KEYWORD);
    });

    await act(async () => {
      result.current.setSearchInput('   ');
    });
    await act(async () => {
      await result.current.handleSubmitSearch();
    });

    expect(navigation.router.push).toHaveBeenCalledWith('/posts');
  });
});

describe('usePostsSearchPageRuntime favorite login continuation', () => {
  it('opens the post continuation dialog for unauthenticated favorite clicks without toast', async () => {
    const post = createPostSearchPost({ id: 'post-search-continuation-open' });
    const { result } = await renderRuntimeWithSearchResult(post, { user: null });

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(post.id);
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

  it('patches only the clicked nested search result after continuation success', async () => {
    const firstPost = createPostSearchPost({
      id: 'post-search-continuation-first',
      isFavorited: false,
    });
    const clickedPost = createPostSearchPost({
      id: 'post-search-continuation-clicked',
      isFavorited: false,
    });
    mocks.searchPublicActivePosts.mockResolvedValueOnce(
      createPostSearchPage({
        keyword: POST_SEARCH_KEYWORD,
        items: [
          createPostSearchMatch({ post: firstPost }),
          createPostSearchMatch({ post: clickedPost }),
        ],
        nextCursor: null,
        hasMore: false,
        scannedCount: 2,
      }),
    );
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    const { result } = renderUsePostsSearchPageRuntime({ user: null });
    await waitFor(() => {
      expect(result.current.results.map((match) => match.post.id)).toEqual([
        firstPost.id,
        clickedPost.id,
      ]);
    });
    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(clickedPost.id);
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
    expect(result.current.results.map((match) => [match.post.id, match.post.isFavorited])).toEqual([
      [firstPost.id, false],
      [clickedPost.id, true],
    ]);
    expect(mocks.showToast).toHaveBeenCalledWith(
      '登入成功，已加入收藏',
      'success',
      expect.arrayContaining([
        expect.objectContaining({ label: '查看收藏', callback: expect.any(Function) }),
        expect.objectContaining({ label: '復原', callback: expect.any(Function) }),
      ]),
    );
  });

  it('keeps the continuation favorite when signed-in search reload returns stale empty favorites after add success', async () => {
    const firstPost = createPostSearchPost({
      id: 'post-search-continuation-stale-first',
      isFavorited: false,
    });
    const clickedPost = createPostSearchPost({
      id: 'post-search-continuation-stale-clicked',
      isFavorited: false,
    });
    const initialSearchPage = createPostSearchPage({
      keyword: POST_SEARCH_KEYWORD,
      items: [
        createPostSearchMatch({ post: firstPost }),
        createPostSearchMatch({ post: clickedPost }),
      ],
      nextCursor: null,
      hasMore: false,
      scannedCount: 2,
    });
    const staleSignedInSearchPage = createPostSearchPage({
      keyword: POST_SEARCH_KEYWORD,
      items: [
        createPostSearchMatch({ post: firstPost }),
        createPostSearchMatch({ post: clickedPost }),
      ],
      nextCursor: null,
      hasMore: false,
      scannedCount: 2,
    });
    const pendingAddFavorite = createDeferred();
    const staleSignedInFavorites = createDeferred();
    mocks.searchPublicActivePosts
      .mockResolvedValueOnce(initialSearchPage)
      .mockResolvedValueOnce(staleSignedInSearchPage);
    mocks.addContentFavorite.mockReturnValueOnce(pendingAddFavorite.promise);
    mocks.getFavoritedTargetIds.mockReturnValueOnce(staleSignedInFavorites.promise);
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    const { result, setAuthUser } = renderUsePostsSearchPageRuntime({ user: null });
    await waitFor(() => {
      expect(result.current.results.map((match) => match.post.id)).toEqual([
        firstPost.id,
        clickedPost.id,
      ]);
    });
    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(clickedPost.id);
    });

    /** @type {Promise<void>} */
    let confirmPromise;
    act(() => {
      confirmPromise = /** @type {Promise<void>} */ (
        getRuntimeHandler(result.current, 'confirmContinuation')()
      );
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
    await act(async () => {
      staleSignedInFavorites.resolve(new Set());
      await staleSignedInFavorites.promise;
    });

    expect(result.current.results.map((match) => [match.post.id, match.post.isFavorited])).toEqual([
      [firstPost.id, false],
      [clickedPost.id, true],
    ]);
    expect(mocks.showToast).toHaveBeenCalledWith(
      '登入成功，已加入收藏',
      'success',
      expect.arrayContaining([
        expect.objectContaining({ label: '查看收藏', callback: expect.any(Function) }),
        expect.objectContaining({ label: '復原', callback: expect.any(Function) }),
      ]),
    );
  });
});

describe('usePostsSearchPageRuntime signed-in favorite regressions', () => {
  it('keeps signed-in add favorite on the existing branch without opening continuation', async () => {
    const post = createPostSearchPost({ id: 'post-search-signed-in-add' });
    const { result } = await renderRuntimeWithSearchResult(post);

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(post.id);
    });

    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: POST_SEARCH_VIEWER_UID,
      type: 'post',
      targetId: post.id,
    });
    expect(mocks.removeContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.results[0].post).toMatchObject({
      id: post.id,
      isFavorited: true,
    });
    expect(mocks.showToast).toHaveBeenCalledWith(
      '已加入收藏',
      'success',
      expect.arrayContaining([
        expect.objectContaining({ label: '查看收藏', callback: expect.any(Function) }),
        expect.objectContaining({ label: '復原', callback: expect.any(Function) }),
      ]),
    );
  });

  it('lets the signed-in add favorite toast navigate to favorites or undo the add', async () => {
    const post = createPostSearchPost({ id: 'post-search-signed-in-add-undo' });
    const { result } = await renderRuntimeWithSearchResult(post);

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(post.id);
    });

    const actions = mocks.showToast.mock.calls.find((call) => call[0] === '已加入收藏')?.[2];
    expect(actions).toEqual([
      expect.objectContaining({ label: '查看收藏', callback: expect.any(Function) }),
      expect.objectContaining({ label: '復原', callback: expect.any(Function) }),
    ]);

    actions[0].callback();
    expect(navigation.router.push).toHaveBeenCalledWith('/member/favorites');

    await act(async () => {
      await actions[1].callback();
    });
    expect(mocks.removeContentFavorite).toHaveBeenCalledWith({
      uid: POST_SEARCH_VIEWER_UID,
      type: 'post',
      targetId: post.id,
    });
    expect(result.current.results[0].post).toMatchObject({
      id: post.id,
      isFavorited: false,
    });
  });

  it('keeps signed-in remove favorite on the existing branch without opening continuation', async () => {
    const post = createPostSearchPost({ id: 'post-search-signed-in-remove' });
    mocks.getFavoritedTargetIds.mockResolvedValueOnce(new Set([post.id]));
    const { result } = await renderRuntimeWithSearchResult(post);

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(post.id);
    });

    expect(mocks.removeContentFavorite).toHaveBeenCalledWith({
      uid: POST_SEARCH_VIEWER_UID,
      type: 'post',
      targetId: post.id,
    });
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.results[0].post).toMatchObject({
      id: post.id,
      isFavorited: false,
    });
    expect(mocks.showToast).toHaveBeenCalledWith('已取消收藏', 'success');
  });
});

describe('usePostsSearchPageRuntime US4 recovery and pagination', () => {
  it('loads the next page when the bottom sentinel intersects', async () => {
    installMockIntersectionObserver();
    const firstCursor = createPostSearchCursor({ lastPostId: 'post-search-first-page' });
    const firstPost = createPostSearchPost({ id: 'post-search-first-page' });
    const nextPost = createPostSearchPost({ id: 'post-search-next-page' });
    mocks.searchPublicActivePosts
      .mockResolvedValueOnce(
        createPostSearchPage({
          keyword: POST_SEARCH_KEYWORD,
          items: [createPostSearchMatch({ post: firstPost })],
          nextCursor: firstCursor,
          hasMore: true,
          scannedCount: 10,
        }),
      )
      .mockResolvedValueOnce(
        createPostSearchPage({
          keyword: POST_SEARCH_KEYWORD,
          items: [createPostSearchMatch({ post: nextPost })],
          nextCursor: null,
          hasMore: false,
          scannedCount: 16,
        }),
      );
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    let runtime = /** @type {RuntimeHostSnapshot | null} */ (null);
    renderPostsSearchRuntimeHost({
      onRuntime: (nextRuntime) => {
        runtime = nextRuntime;
      },
    });
    const sentinel = await screen.findByTestId('search-bottom-sentinel');
    await waitFor(() => {
      expect(getLatestIntersectionObserver().observedElements.has(sentinel)).toBe(true);
    });
    await act(async () => {
      await getLatestIntersectionObserver().trigger(sentinel);
    });

    await waitFor(() => {
      expect(runtime?.results.map((match) => match.post.id)).toEqual([
        firstPost.id,
        nextPost.id,
      ]);
    });
    expect(mocks.searchPublicActivePosts).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        keyword: POST_SEARCH_KEYWORD,
        userUid: POST_SEARCH_VIEWER_UID,
        cursor: firstCursor,
      }),
    );
    expect(runtime?.hasMore).toBe(false);
  });

  it('exposes loadingMore while an intersection-triggered page is in flight', async () => {
    installMockIntersectionObserver();
    const firstCursor = createPostSearchCursor({ lastPostId: 'post-search-loading-more-cursor' });
    const firstPost = createPostSearchPost({ id: 'post-search-loading-more-first' });
    const nextPost = createPostSearchPost({ id: 'post-search-loading-more-next' });
    const nextPage = createDeferred();
    mocks.searchPublicActivePosts
      .mockResolvedValueOnce(
        createPostSearchPage({
          keyword: POST_SEARCH_KEYWORD,
          items: [createPostSearchMatch({ post: firstPost })],
          nextCursor: firstCursor,
          hasMore: true,
          scannedCount: 10,
        }),
      )
      .mockReturnValueOnce(nextPage.promise);
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    let runtime = /** @type {RuntimeHostSnapshot | null} */ (null);
    renderPostsSearchRuntimeHost({
      onRuntime: (nextRuntime) => {
        runtime = nextRuntime;
      },
    });
    const sentinel = await screen.findByTestId('search-bottom-sentinel');
    await waitFor(() => {
      expect(getLatestIntersectionObserver().observedElements.has(sentinel)).toBe(true);
    });
    await act(async () => {
      await getLatestIntersectionObserver().trigger(sentinel);
    });

    await waitFor(() => {
      expect(runtime?.status).toBe('loadingMore');
    });
    expect(runtime?.isLoadingNext).toBe(true);

    await act(async () => {
      nextPage.resolve(
        createPostSearchPage({
          keyword: POST_SEARCH_KEYWORD,
          items: [createPostSearchMatch({ post: nextPost })],
          nextCursor: null,
          hasMore: false,
          scannedCount: 16,
        }),
      );
      await nextPage.promise;
    });

    await waitFor(() => {
      expect(runtime?.status).toBe('success');
    });
  });

  it('keeps existing results when load more fails', async () => {
    installMockIntersectionObserver();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const firstCursor = createPostSearchCursor({ lastPostId: 'post-search-load-more-error-cursor' });
    const firstPost = createPostSearchPost({ id: 'post-search-load-more-error-first' });
    mocks.searchPublicActivePosts
      .mockResolvedValueOnce(
        createPostSearchPage({
          keyword: POST_SEARCH_KEYWORD,
          items: [createPostSearchMatch({ post: firstPost })],
          nextCursor: firstCursor,
          hasMore: true,
          scannedCount: 10,
        }),
      )
      .mockRejectedValueOnce(new Error('load more unavailable'));
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    let runtime = /** @type {RuntimeHostSnapshot | null} */ (null);
    renderPostsSearchRuntimeHost({
      onRuntime: (nextRuntime) => {
        runtime = nextRuntime;
      },
    });
    const sentinel = await screen.findByTestId('search-bottom-sentinel');
    await waitFor(() => {
      expect(getLatestIntersectionObserver().observedElements.has(sentinel)).toBe(true);
    });
    await act(async () => {
      await getLatestIntersectionObserver().trigger(sentinel);
    });

    await waitFor(() => {
      expect(runtime?.status).toBe('error');
    });
    expect(runtime?.results.map((match) => match.post.id)).toEqual([firstPost.id]);
    expect(runtime?.errorMessage).toBe('搜尋失敗，請稍後再試');
    expect(runtime?.hasMore).toBe(true);
  });

  it('retries initial failure with the retained keyword', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retryPost = createPostSearchPost({ id: 'post-search-retry-result' });
    mocks.searchPublicActivePosts
      .mockRejectedValueOnce(new Error('initial search unavailable'))
      .mockResolvedValueOnce(
        createPostSearchPage({
          keyword: POST_SEARCH_KEYWORD,
          items: [createPostSearchMatch({ post: retryPost })],
          nextCursor: null,
          hasMore: false,
          scannedCount: 1,
        }),
      );
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    const { result } = renderUsePostsSearchPageRuntime();
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleRetrySearch')();
    });

    await waitFor(() => {
      expect(result.current.results.map((match) => match.post.id)).toEqual([retryPost.id]);
    });
    expect(result.current.keyword).toBe(POST_SEARCH_KEYWORD);
    expect(result.current.searchInput).toBe(POST_SEARCH_KEYWORD);
    expect(mocks.searchPublicActivePosts).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        keyword: POST_SEARCH_KEYWORD,
        cursor: null,
      }),
    );
  });

  it('retains the keyword and editable search input after an initial search error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.searchPublicActivePosts.mockRejectedValueOnce(new Error('initial search unavailable'));
    navigation.setSearchParams({ q: `  ${POST_SEARCH_CHINESE_KEYWORD}  ` });

    const { result } = renderUsePostsSearchPageRuntime();

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.keyword).toBe(POST_SEARCH_CHINESE_KEYWORD);
    expect(result.current.searchInput).toBe(POST_SEARCH_CHINESE_KEYWORD);
    expect(result.current.errorMessage).toBe('搜尋失敗，請稍後再試');
  });
});

describe('usePostsSearchPageRuntime personalized result interactions', () => {
  it('guards anonymous like and favorite interactions without mutating search results', async () => {
    const resultPost = createPostSearchPost({
      id: 'post-search-anonymous-guard',
      likesCount: 5,
    });
    const { result } = await renderRuntimeWithSearchResult(resultPost, { user: null });

    await act(async () => {
      await getRuntimeHandler(result.current, 'handlePressLike')(resultPost.id);
    });
    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(resultPost.id);
    });

    expect(mocks.showToast).toHaveBeenNthCalledWith(1, '請先登入才能按讚', 'info');
    expect(mocks.showToast).not.toHaveBeenCalledWith('請先登入才能收藏', 'info');
    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'post',
      body: '登入後會自動將這篇文章加入收藏。',
    });
    expect(mocks.toggleLikePost).not.toHaveBeenCalled();
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
    expect(mocks.removeContentFavorite).not.toHaveBeenCalled();
    expect(result.current.results[0].post).toMatchObject({
      id: resultPost.id,
      liked: false,
      isFavorited: false,
      likesCount: 5,
    });
  });

  it('hydrates liked, favorite, and owner flags for authenticated search results', async () => {
    const likedPost = createPostSearchPost({
      id: 'post-search-liked-runtime',
      authorUid: 'another-runner',
    });
    const favoritedPost = createPostSearchPost({
      id: 'post-search-favorited-runtime',
      authorUid: 'another-runner',
    });
    const ownedPost = createPostSearchPost({
      id: 'post-search-owned-runtime',
      authorUid: POST_SEARCH_VIEWER_UID,
    });
    mocks.searchPublicActivePosts.mockResolvedValueOnce(
      createPostSearchPage({
        keyword: POST_SEARCH_KEYWORD,
        items: [
          createPostSearchMatch({ post: likedPost }),
          createPostSearchMatch({ post: favoritedPost }),
          createPostSearchMatch({ post: ownedPost }),
        ],
        nextCursor: null,
        hasMore: false,
        scannedCount: 3,
      }),
    );
    mocks.hasUserLikedPosts.mockResolvedValueOnce(new Set([likedPost.id]));
    mocks.getFavoritedTargetIds.mockResolvedValueOnce(new Set([favoritedPost.id]));
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    const { result } = renderUsePostsSearchPageRuntime();

    await waitFor(() => {
      expect(result.current.results).toEqual([
        expect.objectContaining({
          post: expect.objectContaining({
            id: likedPost.id,
            liked: true,
            isFavorited: false,
            isAuthor: false,
          }),
        }),
        expect.objectContaining({
          post: expect.objectContaining({
            id: favoritedPost.id,
            liked: false,
            isFavorited: true,
            isAuthor: false,
          }),
        }),
        expect.objectContaining({
          post: expect.objectContaining({
            id: ownedPost.id,
            liked: false,
            isFavorited: false,
            isAuthor: true,
          }),
        }),
      ]);
    });
    expect(mocks.hasUserLikedPosts).toHaveBeenCalledWith(
      POST_SEARCH_VIEWER_UID,
      [likedPost.id, favoritedPost.id, ownedPost.id],
    );
    expect(mocks.getFavoritedTargetIds).toHaveBeenCalledWith({
      uid: POST_SEARCH_VIEWER_UID,
      type: 'post',
      targetIds: [likedPost.id, favoritedPost.id, ownedPost.id],
    });
  });

  it('rolls optimistic like state back when toggling a search result fails', async () => {
    const resultPost = createPostSearchPost({
      id: 'post-search-like-rollback',
      likesCount: 2,
    });
    mocks.toggleLikePost.mockResolvedValueOnce('fail');
    const { result } = await renderRuntimeWithSearchResult(resultPost);

    await act(async () => {
      await getRuntimeHandler(result.current, 'handlePressLike')(resultPost.id);
    });

    expect(mocks.toggleLikePost).toHaveBeenCalledWith(resultPost.id, POST_SEARCH_VIEWER_UID);
    expect(result.current.results[0].post).toMatchObject({
      id: resultPost.id,
      liked: false,
      likesCount: 2,
    });
  });

  it('rolls optimistic favorite state back when adding a search result favorite fails', async () => {
    const resultPost = createPostSearchPost({ id: 'post-search-favorite-rollback' });
    mocks.addContentFavorite.mockRejectedValueOnce(new Error('favorite unavailable'));
    const { result } = await renderRuntimeWithSearchResult(resultPost);

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleToggleFavoritePost')(resultPost.id);
    });

    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: POST_SEARCH_VIEWER_UID,
      type: 'post',
      targetId: resultPost.id,
    });
    expect(result.current.results[0].post).toMatchObject({
      id: resultPost.id,
      isFavorited: false,
    });
    expect(mocks.showToast).toHaveBeenCalledWith('收藏失敗，請稍後再試', 'error');
  });

  it('opens and closes the owner menu for author search results', async () => {
    const ownedPost = createPostSearchPost({
      id: 'post-search-owner-menu',
      authorUid: POST_SEARCH_VIEWER_UID,
    });
    const { result } = await renderRuntimeWithSearchResult(ownedPost);
    const stopPropagation = vi.fn();

    act(() => {
      getRuntimeHandler(result.current, 'handleToggleOwnerMenu')(ownedPost.id, {
        stopPropagation,
      });
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(result.current.openMenuPostId).toBe(ownedPost.id);

    act(() => {
      getRuntimeHandler(result.current, 'handleToggleOwnerMenu')(ownedPost.id, {
        stopPropagation,
      });
    });

    expect(result.current.openMenuPostId).toBe('');

    act(() => {
      getRuntimeHandler(result.current, 'handleToggleOwnerMenu')(ownedPost.id, {
        stopPropagation,
      });
      getRuntimeHandler(result.current, 'handleCloseOwnerMenu')();
    });

    expect(result.current.openMenuPostId).toBe('');
  });

  it('removes a deleted search result without leaving the search page', async () => {
    const resultPost = createPostSearchPost({ id: 'post-search-delete-removal' });
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    mocks.deletePost.mockResolvedValueOnce(undefined);
    const { result } = await renderRuntimeWithSearchResult(resultPost);

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleDeletePost')(resultPost.id);
    });

    expect(window.confirm).toHaveBeenCalledWith('確定要刪除文章？');
    expect(mocks.deletePost).toHaveBeenCalledWith(resultPost.id);
    expect(result.current.results).toEqual([]);
    expect(navigation.router.push).not.toHaveBeenCalledWith('/posts?toast=文章已刪除');
  });

  it('opens an author edit modal and updates the matching search result after submit', async () => {
    const originalHighlightRanges = [
      { field: 'title', start: 0, end: POST_SEARCH_KEYWORD.length },
      { field: 'snippet', start: 12, end: 12 + POST_SEARCH_KEYWORD.length },
    ];
    const originalSnippet = `Before the ${POST_SEARCH_KEYWORD} segment.`;
    const resultPost = createPostSearchPost({
      id: 'post-search-edit-result',
      authorUid: POST_SEARCH_VIEWER_UID,
      title: `${POST_SEARCH_KEYWORD} original title`,
      content: 'Original searchable content.',
      isEdited: false,
    });
    mocks.searchPublicActivePosts.mockResolvedValueOnce(
      createPostSearchPage({
        keyword: POST_SEARCH_KEYWORD,
        items: [
          createPostSearchMatch({
            post: resultPost,
            snippet: originalSnippet,
            highlightRanges: originalHighlightRanges,
          }),
        ],
        nextCursor: null,
        hasMore: false,
        scannedCount: 1,
      }),
    );
    navigation.setSearchParams({ q: POST_SEARCH_KEYWORD });

    const { result } = renderUsePostsSearchPageRuntime();
    await waitFor(() => {
      expect(result.current.results.map((match) => match.post.id)).toEqual([resultPost.id]);
    });

    const showModal = vi.fn();
    const close = vi.fn();
    const handleEditPost = getRuntimeHandler(result.current, 'handleEditPost');
    act(() => {
      result.current.dialogRef.current = /** @type {HTMLDialogElement} */ ({ showModal, close });
      handleEditPost(resultPost.id);
    });

    expect(showModal).toHaveBeenCalled();
    expect(result.current.editingPostId).toBe(resultPost.id);
    expect(result.current.title).toBe(resultPost.title);
    expect(result.current.content).toBe(resultPost.content);
    expect(result.current.originalTitle).toBe(resultPost.title);
    expect(result.current.originalContent).toBe(resultPost.content);

    act(() => {
      result.current.setTitle?.('  Updated reef title  ');
      result.current.setContent?.('  Updated reef body  ');
    });
    await act(async () => {
      await getRuntimeHandler(result.current, 'handleSubmitPost')({ preventDefault: vi.fn() });
    });

    expect(mocks.updatePost).toHaveBeenCalledWith(resultPost.id, {
      title: '  Updated reef title  ',
      content: '  Updated reef body  ',
    });
    expect(result.current.results[0]).toMatchObject({
      snippet: originalSnippet,
      highlightRanges: originalHighlightRanges,
      post: {
        id: resultPost.id,
        title: 'Updated reef title',
        content: 'Updated reef body',
        isEdited: true,
      },
    });
    expect(close).toHaveBeenCalled();
    expect(result.current.editingPostId).toBeNull();
    expect(mocks.showToast).toHaveBeenCalledWith('更新文章成功');
  });

  it('opens and closes article history modal state through the history use case', async () => {
    const resultPost = createPostSearchPost({
      id: 'post-search-history-modal',
      isEdited: true,
    });
    const historyEntries = [
      {
        id: 'post-search-history-entry',
        title: 'Before edit',
        content: 'Previous search result content.',
      },
    ];
    mocks.fetchPostHistory.mockResolvedValueOnce(historyEntries);
    const { result } = await renderRuntimeWithSearchResult(resultPost);

    await act(async () => {
      await getRuntimeHandler(result.current, 'handleViewArticleHistory')(result.current.results[0].post);
    });

    expect(mocks.fetchPostHistory).toHaveBeenCalledWith(resultPost.id);
    expect(result.current.articleHistoryPost).toMatchObject({ id: resultPost.id });
    expect(result.current.articleHistoryEntries).toEqual(historyEntries);
    expect(result.current.articleHistoryError).toBeNull();
    expect(result.current.isArticleHistoryOpen).toBe(true);

    act(() => {
      getRuntimeHandler(result.current, 'handleCloseArticleHistory')();
    });

    expect(result.current.articleHistoryPost).toBeNull();
    expect(result.current.articleHistoryEntries).toEqual([]);
    expect(result.current.isArticleHistoryOpen).toBe(false);
  });
});
