import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import usePostsPageRuntime from '@/runtime/hooks/usePostsPageRuntime';
import { fetchPostHistory } from '@/runtime/client/use-cases/post-use-cases';

const showToast = vi.fn();

const helperMocks = vi.hoisted(() => ({
  applyPostFavoriteState: vi.fn((posts) => posts),
  applyPostLikeState: vi.fn((posts) => posts),
  createComposerDraft: vi.fn(() => ({
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    editingPostId: null,
  })),
  hydratePosts: vi.fn((posts) => posts),
  loadInitialPosts: vi.fn(),
  loadMorePostsPage: vi.fn(),
  mergeUniquePosts: vi.fn((previousPosts, nextPosts) => [...previousPosts, ...nextPosts]),
  prependPost: vi.fn((posts, post) => [post, ...posts]),
  removePostById: vi.fn((posts, postId) => posts.filter((post) => post.id !== postId)),
  replaceEditedPost: vi.fn((posts) => posts),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/runtime/providers/AuthProvider', async () => {
  const React = await vi.importActual('react');

  return {
    AuthContext: React.createContext({
      user: null,
      setUser: () => {},
      loading: false,
    }),
    default({ children }) {
      return children;
    },
  };
});

vi.mock('@/runtime/client/use-cases/post-use-cases', () => ({
  createPost: vi.fn(),
  deletePost: vi.fn(),
  fetchPostHistory: vi.fn(),
  getPostDetail: vi.fn(),
  toggleLikePost: vi.fn(),
  updatePost: vi.fn(),
  validatePostInput: vi.fn(() => null),
}));

vi.mock('@/runtime/client/use-cases/content-favorite-use-cases', () => ({
  FAVORITE_CONTENT_TYPES: { POST: 'post' },
  addContentFavorite: vi.fn(),
  removeContentFavorite: vi.fn(),
}));

vi.mock('@/runtime/hooks/usePostsPageRuntimeHelpers', () => helperMocks);

vi.mock('@/repo/client/post-composer-draft-storage-repo', () => ({
  loadPostComposerDraft: vi.fn(() => null),
  removePostComposerDraft: vi.fn(),
  savePostComposerDraft: vi.fn(),
}));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

const editedPost = {
  id: 'post-1',
  title: 'Current title',
  content: 'Current content',
  authorUid: 'author-1',
  likesCount: 0,
  commentsCount: 0,
  liked: false,
  isEdited: true,
};

/**
 * Render posts runtime with a stable auth context.
 * @returns {ReturnType<typeof renderHook>} Hook view.
 */
function renderRuntime() {
  return renderHook(() => usePostsPageRuntime(), {
    wrapper({ children }) {
      return (
        <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
          {children}
        </AuthContext.Provider>
      );
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  helperMocks.loadInitialPosts.mockResolvedValue({
    posts: [editedPost],
    nextCursor: null,
  });
});

describe('usePostsPageRuntime article history', () => {
  test('opens and resets article post history modal state', async () => {
    vi.mocked(fetchPostHistory).mockResolvedValueOnce([
      {
        id: 'history-1',
        title: 'Previous title',
        content: 'Previous content',
      },
    ]);
    const view = renderRuntime();

    await waitFor(() => expect(view.result.current.posts).toEqual([editedPost]));
    await act(async () => {
      await view.result.current.handleViewArticleHistory(editedPost);
    });

    expect(fetchPostHistory).toHaveBeenCalledWith('post-1');
    expect(view.result.current.articleHistoryPost).toBe(editedPost);
    expect(view.result.current.articleHistoryEntries).toEqual([
      {
        id: 'history-1',
        title: 'Previous title',
        content: 'Previous content',
      },
    ]);
    expect(view.result.current.articleHistoryError).toBeNull();
    expect(view.result.current.isArticleHistoryOpen).toBe(true);

    act(() => {
      view.result.current.handleCloseArticleHistory();
    });

    expect(view.result.current.articleHistoryPost).toBeNull();
    expect(view.result.current.articleHistoryEntries).toEqual([]);
    expect(view.result.current.articleHistoryError).toBeNull();
    expect(view.result.current.isArticleHistoryOpen).toBe(false);
  });

  test('keeps current posts unchanged and exposes an error when history load fails', async () => {
    vi.mocked(fetchPostHistory).mockRejectedValueOnce(new Error('network failed'));
    const view = renderRuntime();

    await waitFor(() => expect(view.result.current.posts).toEqual([editedPost]));
    await act(async () => {
      await view.result.current.handleViewArticleHistory(editedPost);
    });

    expect(view.result.current.posts).toEqual([editedPost]);
    expect(view.result.current.articleHistoryPost).toBe(editedPost);
    expect(view.result.current.articleHistoryEntries).toEqual([]);
    expect(view.result.current.articleHistoryError).toBe('載入編輯記錄失敗');
    expect(view.result.current.isArticleHistoryOpen).toBe(true);
  });
});
