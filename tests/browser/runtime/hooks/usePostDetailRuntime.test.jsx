import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import usePostDetailRuntime from '@/runtime/hooks/usePostDetailRuntime';
import { fetchPostHistory } from '@/runtime/client/use-cases/post-use-cases';

const showToast = vi.fn();
const setInitialComments = vi.fn();

const usePostCommentsMock = vi.hoisted(() =>
  vi.fn(() => ({
    comments: [],
    comment: '',
    historyComment: null,
    historyEntries: [],
    historyError: null,
    highlightedCommentId: null,
    isLoadingNext: false,
    bottomRef: { current: null },
    handleEditComment: vi.fn(),
    handleDeleteComment: vi.fn(),
    handleViewHistory: vi.fn(),
    handleCloseHistory: vi.fn(),
    handleSubmitComment: vi.fn(),
    handleCommentChange: vi.fn(),
    setInitialComments,
  })),
);

const useCaseMocks = vi.hoisted(() => ({
  POST_NOT_FOUND_MESSAGE: '文章不存在',
  deletePost: vi.fn(),
  fetchPostHistory: vi.fn(),
  getLatestCommentsPage: vi.fn(),
  getPostDetail: vi.fn(),
  hasUserLikedPost: vi.fn(),
  toggleLikePost: vi.fn(),
  updatePost: vi.fn(),
  validatePostInput: vi.fn(() => null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
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

vi.mock('@/runtime/client/use-cases/post-use-cases', () => useCaseMocks);

vi.mock('@/runtime/client/use-cases/content-favorite-use-cases', () => ({
  FAVORITE_CONTENT_TYPES: { POST: 'post' },
  addContentFavorite: vi.fn(),
  getFavoritedTargetIds: vi.fn(() => new Set()),
  removeContentFavorite: vi.fn(),
}));

vi.mock('@/repo/client/post-composer-draft-storage-repo', () => ({
  loadPostComposerDraft: vi.fn(() => null),
  removePostComposerDraft: vi.fn(),
  savePostComposerDraft: vi.fn(),
}));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('@/runtime/hooks/usePostComments', () => ({
  default: usePostCommentsMock,
}));

const postDetail = {
  id: 'post-1',
  title: 'Current title',
  content: 'Current content',
  authorUid: 'author-1',
  likesCount: 0,
  commentsCount: 1,
  isEdited: true,
};

/**
 * Render detail runtime with a stable auth context.
 * @returns {ReturnType<typeof renderHook>} Hook view.
 */
function renderRuntime() {
  return renderHook(() => usePostDetailRuntime('post-1'), {
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
  useCaseMocks.getPostDetail.mockResolvedValue(postDetail);
  useCaseMocks.getLatestCommentsPage.mockResolvedValue({
    comments: [],
    nextCursor: null,
    hasMore: false,
  });
});

describe('usePostDetailRuntime article history', () => {
  test('opens and resets article post history modal state alongside comment history state', async () => {
    vi.mocked(fetchPostHistory).mockResolvedValueOnce([
      {
        id: 'history-1',
        title: 'Previous title',
        content: 'Previous content',
      },
    ]);
    const view = renderRuntime();

    await waitFor(() => expect(view.result.current.post?.title).toBe('Current title'));
    await act(async () => {
      await view.result.current.handleViewArticleHistory(view.result.current.post);
    });

    expect(fetchPostHistory).toHaveBeenCalledWith('post-1');
    expect(view.result.current.articleHistoryPost).toMatchObject({
      id: 'post-1',
      title: 'Current title',
      content: 'Current content',
    });
    expect(view.result.current.articleHistoryEntries).toEqual([
      {
        id: 'history-1',
        title: 'Previous title',
        content: 'Previous content',
      },
    ]);
    expect(view.result.current.articleHistoryError).toBeNull();
    expect(view.result.current.isArticleHistoryOpen).toBe(true);
    expect(view.result.current.historyComment).toBeNull();
    expect(view.result.current.handleViewHistory).toEqual(expect.any(Function));
    expect(view.result.current.handleCloseHistory).toEqual(expect.any(Function));

    act(() => {
      view.result.current.handleCloseArticleHistory();
    });

    expect(view.result.current.articleHistoryPost).toBeNull();
    expect(view.result.current.articleHistoryEntries).toEqual([]);
    expect(view.result.current.articleHistoryError).toBeNull();
    expect(view.result.current.isArticleHistoryOpen).toBe(false);
  });

  test('keeps current post state visible when article history load fails', async () => {
    vi.mocked(fetchPostHistory).mockRejectedValueOnce(new Error('network failed'));
    const view = renderRuntime();

    await waitFor(() => expect(view.result.current.post?.title).toBe('Current title'));
    await act(async () => {
      await view.result.current.handleViewArticleHistory(view.result.current.post);
    });

    expect(view.result.current.post).toMatchObject({
      id: 'post-1',
      title: 'Current title',
      content: 'Current content',
    });
    expect(view.result.current.articleHistoryPost).toMatchObject({
      id: 'post-1',
      title: 'Current title',
      content: 'Current content',
    });
    expect(view.result.current.articleHistoryEntries).toEqual([]);
    expect(view.result.current.articleHistoryError).toBe('載入編輯記錄失敗');
    expect(view.result.current.isArticleHistoryOpen).toBe(true);
  });
});
