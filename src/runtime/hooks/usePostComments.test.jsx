import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import { usePostCommentsInfiniteScroll } from '@/runtime/hooks/usePostCommentsEffects';
import usePostComments from './usePostComments';

const navigationMock = vi.hoisted(() => ({
  searchParams: {
    get: vi.fn(() => null),
  },
}));

const postUseCasesMock = vi.hoisted(() => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  getCommentById: vi.fn(),
  updateComment: vi.fn(),
}));

const notificationUseCasesMock = vi.hoisted(() => ({
  notifyPostCommentReply: vi.fn(),
  notifyPostNewComment: vi.fn(),
}));

const postCommentsEffectsMock = vi.hoisted(() => ({
  usePostCommentsInfiniteScroll: vi.fn(),
  useScrollToHighlightedComment: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock('@/runtime/client/use-cases/post-use-cases', () => ({
  addComment: postUseCasesMock.addComment,
  deleteComment: postUseCasesMock.deleteComment,
  getCommentById: postUseCasesMock.getCommentById,
  updateComment: postUseCasesMock.updateComment,
}));

vi.mock('@/runtime/client/use-cases/notification-use-cases', () => ({
  notifyPostCommentReply: notificationUseCasesMock.notifyPostCommentReply,
  notifyPostNewComment: notificationUseCasesMock.notifyPostNewComment,
}));

vi.mock('@/runtime/hooks/usePostCommentsEffects', () => ({
  usePostCommentsInfiniteScroll: postCommentsEffectsMock.usePostCommentsInfiniteScroll,
  useScrollToHighlightedComment: postCommentsEffectsMock.useScrollToHighlightedComment,
}));

const signedInUser = {
  uid: 'user-1',
  name: 'Runner',
  photoURL: '',
};

const postDetail = {
  id: 'post-1',
  title: 'Post title',
  authorUid: 'author-1',
  commentsCount: 0,
};

const existingComment = {
  id: 'comment-1',
  authorUid: 'user-1',
  authorName: 'Runner',
  authorImgURL: '',
  comment: 'Original post comment',
  createdAt: null,
};

/**
 * 建立 hook 測試 wrapper。
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} showToast - Toast spy。
 * @returns {import('react').ComponentType<object>} Wrapper。
 */
function createWrapper(showToast) {
  return function RuntimeWrapper({ children }) {
    return (
      <ToastContext.Provider value={{ toasts: [], showToast, removeToast: vi.fn() }}>
        {children}
      </ToastContext.Provider>
    );
  };
}

/**
 * Render post comments runtime hook.
 * @param {object} [params] - Render options。
 * @param {typeof signedInUser | null} [params.user] - Auth user。
 * @param {typeof postDetail | null} [params.loadedPost] - Loaded post detail。
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} [params.showToast] - Toast spy。
 * @returns {import('@testing-library/react').RenderHookResult<ReturnType<typeof usePostComments>, unknown> & { setPostDetail: ReturnType<typeof vi.fn> }} Hook result with spies。
 */
function renderCommentsRuntime({
  user = signedInUser,
  loadedPost = postDetail,
  showToast = vi.fn(),
} = {}) {
  const setPostDetail = vi.fn();
  const setOpenMenuPostId = vi.fn();
  const view = renderHook(
    () =>
      usePostComments({
        postId: 'post-1',
        user,
        postDetail: loadedPost,
        setPostDetail,
        setOpenMenuPostId,
      }),
    { wrapper: createWrapper(showToast) },
  );
  return Object.assign(view, { setPostDetail });
}

/**
 * 建立表單 submit event double。
 * @returns {Event} Submit event double。
 */
function submitEvent() {
  return /** @type {Event} */ (/** @type {unknown} */ ({ preventDefault: vi.fn() }));
}

/**
 * 建立留言輸入 change event double。
 * @param {string} value - 輸入文字。
 * @returns {Event} Change event double。
 */
function commentChangeEvent(value) {
  return /** @type {Event} */ (/** @type {unknown} */ ({ target: { value } }));
}

/**
 * 設定 hook 初始留言資料。
 * @param {ReturnType<typeof renderCommentsRuntime>} view - Hook render result。
 * @param {Array<object>} comments - 初始留言。
 */
function seedComments(view, comments = [existingComment]) {
  act(() => {
    view.result.current.setInitialComments({ comments, nextCursor: null, hasMore: false });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  navigationMock.searchParams.get.mockReturnValue(null);
  postUseCasesMock.updateComment.mockResolvedValue(undefined);
});

describe('usePostComments infinite-scroll contract', () => {
  test('tracks hasMore from initial comment page metadata and passes it to the effect', () => {
    const view = renderCommentsRuntime();
    const nextCursor = { id: 'comment-cursor', createdAt: { seconds: 1 } };

    act(() => {
      view.result.current.setInitialComments({
        comments: [existingComment],
        nextCursor,
        hasMore: true,
      });
    });

    expect(vi.mocked(usePostCommentsInfiniteScroll)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nextCursor,
        hasMore: true,
      }),
    );

    act(() => {
      view.result.current.setInitialComments({
        comments: [existingComment],
        nextCursor: null,
        hasMore: false,
      });
    });

    expect(vi.mocked(usePostCommentsInfiniteScroll)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nextCursor: null,
        hasMore: false,
      }),
    );
  });
});

describe('usePostComments guest interaction guards', () => {
  test('toasts and preserves comment text when a guest submits a non-empty comment', async () => {
    const showToast = vi.fn();
    const view = renderCommentsRuntime({ user: null, showToast });

    act(() => {
      view.result.current.handleCommentChange(commentChangeEvent(' 留言內容 '));
    });

    await act(async () => {
      await view.result.current.handleSubmitComment(submitEvent());
    });

    expect(showToast).toHaveBeenCalledWith('請先登入才能留言', 'info');
    expect(postUseCasesMock.addComment).not.toHaveBeenCalled();
    expect(notificationUseCasesMock.notifyPostNewComment).not.toHaveBeenCalled();
    expect(notificationUseCasesMock.notifyPostCommentReply).not.toHaveBeenCalled();
    expect(view.setPostDetail).not.toHaveBeenCalled();
    expect(view.result.current.comment).toBe(' 留言內容 ');
  });
});

describe('usePostComments edit modal behavior', () => {
  test('opens edit modal state without copying text into the bottom input', () => {
    const view = renderCommentsRuntime();
    seedComments(view);

    act(() => {
      view.result.current.handleCommentChange(commentChangeEvent('bottom draft'));
    });
    act(() => {
      view.result.current.handleEditComment('comment-1');
    });

    expect(view.result.current.comment).toBe('bottom draft');
    expect(view.result.current.editingComment).toMatchObject({
      id: 'comment-1',
      comment: 'Original post comment',
    });
  });

  test('saves edited post comments with the exact trimmed payload and closes the modal', async () => {
    const view = renderCommentsRuntime();
    seedComments(view);

    act(() => {
      view.result.current.handleCommentChange(commentChangeEvent('bottom draft'));
    });
    act(() => {
      view.result.current.handleEditComment('comment-1');
    });
    await act(async () => {
      await view.result.current.handleEditSave(' Updated post comment ');
    });

    expect(postUseCasesMock.updateComment).toHaveBeenLastCalledWith('post-1', 'comment-1', {
      comment: 'Updated post comment',
    });
    expect(view.result.current.comments[0]).toMatchObject({
      comment: 'Updated post comment',
    });
    expect(view.result.current.comment).toBe('bottom draft');
    expect(view.result.current.editingComment).toBeNull();
    expect(view.result.current.updateError).toBeNull();
  });

  test('rolls back local post comment text and keeps the modal open after save failure', async () => {
    postUseCasesMock.updateComment.mockRejectedValueOnce(new Error('failed'));
    const view = renderCommentsRuntime();
    seedComments(view);

    act(() => {
      view.result.current.handleEditComment('comment-1');
    });
    await act(async () => {
      await view.result.current.handleEditSave('Failed post comment');
    });

    expect(view.result.current.comments[0]).toMatchObject({
      comment: 'Original post comment',
    });
    expect(view.result.current.editingComment).toMatchObject({
      id: 'comment-1',
    });
    expect(view.result.current.updateError).toBe('更新失敗，請再試一次');
  });

  test('cancel closes edit modal state without changing input or comments', () => {
    const view = renderCommentsRuntime();
    seedComments(view);

    act(() => {
      view.result.current.handleCommentChange(commentChangeEvent('bottom draft'));
    });
    act(() => {
      view.result.current.handleEditComment('comment-1');
    });
    act(() => {
      view.result.current.handleEditCancel();
    });

    expect(view.result.current.comment).toBe('bottom draft');
    expect(view.result.current.comments[0]).toMatchObject({
      comment: 'Original post comment',
    });
    expect(view.result.current.editingComment).toBeNull();
    expect(view.result.current.updateError).toBeNull();
  });
});
