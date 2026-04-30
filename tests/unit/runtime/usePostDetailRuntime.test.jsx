import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPostCommentRaw } from '../../_helpers/post-comments-fixtures';
import {
  createRuntimePost,
  installPostDetailRuntimeFirestore,
  postDetailRuntimeBoundaryMocks,
  primeAddCommentTransaction,
  resetPostDetailRuntimeBoundaryMocks,
} from '../../_helpers/use-post-detail-runtime-test-helpers';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const { authState, mockShowToast, mockUseContext } = vi.hoisted(() => ({
  authState: {
    current: { user: null, loading: false, setUser() {} },
  },
  mockShowToast: vi.fn(),
  mockUseContext: vi.fn(),
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

const createSubmitEvent = () =>
  /** @type {Event} */ (/** @type {unknown} */ ({ preventDefault: vi.fn() }));

const createChangeEvent = (value) =>
  /** @type {Event} */ (/** @type {unknown} */ ({ target: { value } }));

/**
 * 動態載入 hook，確保 helper 內的 boundary mocks 先完成註冊。
 * @param {{ postId?: string, user?: object | null }} [options] - render 選項。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any> & { showToast: import('vitest').Mock, router: typeof postDetailRuntimeBoundaryMocks.router }>} render 結果。
 */
/**
 * @param {{ postId?: string, user?: object | null }} [options] - render 選項。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any> & { showToast: import('vitest').Mock, router: typeof postDetailRuntimeBoundaryMocks.router }>} render 結果。
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
    router: postDetailRuntimeBoundaryMocks.router,
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
    postDetailRuntimeBoundaryMocks.docIdQueue.push('comment-new');
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
