// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import usePostComments from '../../../src/runtime/hooks/usePostComments';

const mocks = vi.hoisted(() => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  getCommentById: vi.fn(),
  notifyPostCommentReply: vi.fn(),
  notifyPostNewComment: vi.fn(),
  searchParamCommentId: null,
  showToast: vi.fn(),
  updateComment: vi.fn(),
  useCommentScrollTarget: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key) => (key === 'commentId' ? mocks.searchParamCommentId : null),
  }),
}));

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../src/config/client/firebase-timestamp', () => ({
  createFirestoreTimestamp: (value) => ({
    toDate: () => value,
  }),
}));

vi.mock('../../../src/runtime/hooks/usePostCommentsEffects', () => ({
  usePostCommentsInfiniteScroll: vi.fn(),
  useScrollToHighlightedComment: vi.fn(),
}));

vi.mock('../../../src/runtime/hooks/useCommentScrollTarget', () => ({
  default: mocks.useCommentScrollTarget,
}));

vi.mock('../../../src/runtime/client/use-cases/post-use-cases', () => ({
  addComment: mocks.addComment,
  deleteComment: mocks.deleteComment,
  fetchCommentHistory: vi.fn(),
  getCommentById: mocks.getCommentById,
  updateComment: mocks.updateComment,
}));

vi.mock('../../../src/runtime/client/use-cases/notification-use-cases', () => ({
  notifyPostCommentReply: mocks.notifyPostCommentReply,
  notifyPostNewComment: mocks.notifyPostNewComment,
}));

/**
 * Creates a manually controlled promise for asserting pending submit state.
 * @returns {{
 *   promise: Promise<unknown>,
 *   resolve: (value: unknown) => void,
 *   reject: (reason?: unknown) => void
 * }} Deferred promise controls.
 */
function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve;
  /** @type {(reason?: unknown) => void} */
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const user = {
  uid: 'user-1',
  name: 'Runtime Tester',
  photoURL: 'https://example.test/avatar.png',
};

const postDetail = {
  id: 'post-1',
  title: 'Post title',
  authorUid: 'author-1',
  commentsCount: 0,
};

/**
 * Renders usePostComments with stable default collaborators.
 * @param {Partial<Parameters<typeof usePostComments>[0]>} [overrides] Hook
 *   argument overrides.
 * @returns {ReturnType<typeof renderHook> & {
 *   setOpenMenuPostId: ReturnType<typeof vi.fn>,
 *   setPostDetail: ReturnType<typeof vi.fn>
 * }} Rendered hook utilities and mocked setters.
 */
function renderUsePostComments(overrides = {}) {
  const setPostDetail = vi.fn();
  const setOpenMenuPostId = vi.fn();

  const view = renderHook(() =>
    usePostComments({
      postId: 'post-1',
      user,
      postDetail,
      setPostDetail,
      setOpenMenuPostId,
      ...overrides,
    }),
  );

  return { ...view, setOpenMenuPostId, setPostDetail };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParamCommentId = null;
  mocks.getCommentById.mockResolvedValue(null);
  mocks.deleteComment.mockResolvedValue(undefined);
  mocks.updateComment.mockResolvedValue(undefined);
  mocks.notifyPostCommentReply.mockResolvedValue(undefined);
  mocks.notifyPostNewComment.mockResolvedValue(undefined);
  window.confirm = vi.fn(() => true);
});

describe('usePostComments submit runtime', () => {
  test('uses the URL comment id as the initial scroll target', () => {
    mocks.searchParamCommentId = 'comment-from-url';

    renderUsePostComments();

    expect(mocks.useCommentScrollTarget).toHaveBeenCalledWith('comment-from-url');
  });

  test('fetches a URL target missing from initial post comments and exposes it as pinned', async () => {
    mocks.searchParamCommentId = 'comment-old';
    mocks.getCommentById.mockResolvedValueOnce({
      id: 'comment-old',
      authorUid: 'runner-old',
      authorName: '舊留言者',
      authorImgURL: 'https://example.test/old.png',
      comment: '初始頁沒有的舊留言',
      createdAt: null,
      updatedAt: null,
      isEdited: false,
    });
    const { result } = renderUsePostComments();

    act(() => {
      result.current.setInitialComments({
        comments: [
          {
            id: 'comment-newer',
            authorUid: 'runner-new',
            authorName: '新留言者',
            comment: '初始頁留言',
            createdAt: null,
          },
        ],
        nextCursor: null,
      });
    });

    await waitFor(() => expect(result.current.pinnedComment?.id).toBe('comment-old'));

    expect(mocks.getCommentById).toHaveBeenCalledWith('post-1', 'comment-old');
    expect(result.current.pinnedComment).toMatchObject({
      id: 'comment-old',
      authorUid: 'runner-old',
      authorName: '舊留言者',
      authorPhotoURL: 'https://example.test/old.png',
      content: '初始頁沒有的舊留言',
      isAuthor: false,
    });
    expect(result.current.visibleComments.map((commentItem) => commentItem.id)).toEqual([
      'comment-newer',
    ]);
    expect(result.current.activeTargetId).toBe('comment-old');
  });

  test('keeps post target loading silent when the URL target is missing or hidden', async () => {
    mocks.searchParamCommentId = 'comment-hidden';
    mocks.getCommentById.mockResolvedValueOnce(null);
    const { result } = renderUsePostComments();

    act(() => {
      result.current.setInitialComments({
        comments: [
          {
            id: 'comment-newer',
            authorUid: 'runner-new',
            authorName: '新留言者',
            comment: '初始頁留言',
            createdAt: null,
          },
        ],
        nextCursor: null,
      });
    });

    await waitFor(() =>
      expect(mocks.getCommentById).toHaveBeenCalledWith('post-1', 'comment-hidden'),
    );

    expect(result.current.pinnedComment).toBeNull();
    expect(result.current.visibleComments.map((commentItem) => commentItem.id)).toEqual([
      'comment-newer',
    ]);
  });

  test('submits the provided content string, exposes pending state, and returns true on success', async () => {
    const pendingAdd = createDeferred();
    mocks.addComment.mockReturnValue(pendingAdd.promise);
    const { result } = renderUsePostComments();

    let submitResult;
    let submitPromise;
    await act(async () => {
      submitPromise = result.current.handleSubmitComment('Runtime comment').catch((error) => error);
    });

    expect(mocks.addComment).toHaveBeenNthCalledWith(1, 'post-1', {
      user,
      comment: 'Runtime comment',
    });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      pendingAdd.resolve({ id: 'comment-1' });
      submitResult = await submitPromise;
    });

    expect(submitResult).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.comment).toBe('');
  });

  test('blocks duplicate submits while a submit is pending', async () => {
    const pendingAdd = createDeferred();
    mocks.addComment.mockReturnValue(pendingAdd.promise);
    const { result } = renderUsePostComments();

    let firstSubmit;
    let duplicateResult;
    await act(async () => {
      firstSubmit = result.current
        .handleSubmitComment('Do not duplicate')
        .catch((error) => error);
      duplicateResult = await result.current
        .handleSubmitComment('Do not duplicate')
        .catch((error) => error);
    });

    expect(mocks.addComment.mock.calls).toHaveLength(1);
    expect(duplicateResult).toBe(false);
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      pendingAdd.resolve({ id: 'comment-1' });
      await firstSubmit;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  test('signals failure when submit fails so the caller can preserve the draft', async () => {
    mocks.addComment.mockRejectedValue(new Error('write failed'));
    const { result } = renderUsePostComments();

    let didSignalFailure = false;
    await act(async () => {
      try {
        didSignalFailure =
          (await result.current.handleSubmitComment('Draft should stay')) === false;
      } catch {
        didSignalFailure = true;
      }
    });

    expect(mocks.addComment).toHaveBeenCalledWith('post-1', {
      user,
      comment: 'Draft should stay',
    });
    expect(didSignalFailure).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
  });

  test('scrolls to the locally submitted post comment id after a successful submit', async () => {
    mocks.searchParamCommentId = 'comment-from-url';
    mocks.addComment.mockResolvedValue({ id: 'comment-new' });
    const { result } = renderUsePostComments();

    await act(async () => {
      await result.current.handleSubmitComment('Scroll to me');
    });

    expect(mocks.useCommentScrollTarget).toHaveBeenLastCalledWith('comment-new');
  });

  test('lets a locally submitted post comment override the URL target pin', async () => {
    mocks.searchParamCommentId = 'comment-from-url';
    mocks.addComment.mockResolvedValue({ id: 'comment-new' });
    mocks.getCommentById.mockImplementation((_postId, commentId) => {
      if (commentId === 'comment-from-url') {
        return Promise.resolve({
          id: 'comment-from-url',
          authorUid: 'runner-old',
          authorName: '通知留言者',
          comment: '通知中的舊留言',
          createdAt: null,
        });
      }
      return Promise.resolve({
        id: 'comment-new',
        authorUid: user.uid,
        authorName: user.name,
        authorPhotoURL: user.photoURL,
        comment: 'Scroll to me',
        createdAt: null,
      });
    });
    const { result } = renderUsePostComments();

    act(() => {
      result.current.setInitialComments({ comments: [], nextCursor: null });
    });
    await waitFor(() => expect(result.current.pinnedComment?.id).toBe('comment-from-url'));

    await act(async () => {
      await result.current.handleSubmitComment('Scroll to me');
    });

    expect(result.current.activeTargetId).toBe('comment-new');
    expect(result.current.pinnedComment).toBeNull();
    expect(mocks.useCommentScrollTarget).toHaveBeenLastCalledWith('comment-new');
  });

  test('updates a fetched pinned post comment after editing it', async () => {
    mocks.searchParamCommentId = 'comment-old';
    mocks.getCommentById.mockResolvedValueOnce({
      id: 'comment-old',
      authorUid: user.uid,
      authorName: user.name,
      authorImgURL: 'https://example.test/old.png',
      comment: '編輯前通知留言',
      createdAt: null,
      updatedAt: null,
      isEdited: false,
    });
    const { result } = renderUsePostComments();

    act(() => {
      result.current.setInitialComments({ comments: [], nextCursor: null });
    });
    await waitFor(() => expect(result.current.pinnedComment?.id).toBe('comment-old'));

    act(() => {
      result.current.handleEditComment('comment-old');
    });
    await act(async () => {
      await result.current.handleEditSave('編輯後通知留言');
    });

    expect(mocks.updateComment).toHaveBeenCalledWith('post-1', 'comment-old', {
      comment: '編輯後通知留言',
      currentComment: '編輯前通知留言',
    });
    expect(result.current.pinnedComment).toMatchObject({
      id: 'comment-old',
      content: '編輯後通知留言',
      comment: '編輯後通知留言',
      isEdited: true,
    });
  });

  test('removes a fetched pinned post comment after deleting it', async () => {
    mocks.searchParamCommentId = 'comment-old';
    mocks.getCommentById.mockResolvedValueOnce({
      id: 'comment-old',
      authorUid: user.uid,
      authorName: user.name,
      comment: '要刪除的通知留言',
      createdAt: null,
    });
    const { result } = renderUsePostComments();

    act(() => {
      result.current.setInitialComments({ comments: [], nextCursor: null });
    });
    await waitFor(() => expect(result.current.pinnedComment?.id).toBe('comment-old'));

    await act(async () => {
      await result.current.handleDeleteComment('comment-old');
    });

    expect(mocks.deleteComment).toHaveBeenCalledWith('post-1', 'comment-old', user.uid);
    expect(result.current.pinnedComment).toBeNull();
    expect(result.current.visibleComments).toEqual([]);
  });

  test('keeps the URL scroll target when post comment submit fails', async () => {
    mocks.searchParamCommentId = 'comment-from-url';
    mocks.addComment.mockRejectedValue(new Error('write failed'));
    const { result } = renderUsePostComments();

    await act(async () => {
      await result.current.handleSubmitComment('Draft should stay');
    });

    expect(mocks.useCommentScrollTarget).toHaveBeenLastCalledWith('comment-from-url');
    expect(mocks.useCommentScrollTarget).not.toHaveBeenCalledWith('comment-new');
  });
});
