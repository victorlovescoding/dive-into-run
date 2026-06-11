import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import usePostComments from '../../../src/runtime/hooks/usePostComments';

const mocks = vi.hoisted(() => ({
  addComment: vi.fn(),
  getCommentById: vi.fn(),
  notifyPostCommentReply: vi.fn(),
  notifyPostNewComment: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
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

vi.mock('../../../src/runtime/client/use-cases/post-use-cases', () => ({
  addComment: mocks.addComment,
  deleteComment: vi.fn(),
  fetchCommentHistory: vi.fn(),
  getCommentById: mocks.getCommentById,
  updateComment: vi.fn(),
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
  mocks.getCommentById.mockResolvedValue(null);
  mocks.notifyPostCommentReply.mockResolvedValue(undefined);
  mocks.notifyPostNewComment.mockResolvedValue(undefined);
});

describe('usePostComments submit runtime', () => {
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
});
