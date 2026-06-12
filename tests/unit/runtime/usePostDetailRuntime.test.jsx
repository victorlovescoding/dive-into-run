// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePostDetailRuntime from '../../../src/runtime/hooks/usePostDetailRuntime';

const mocks = vi.hoisted(() => ({
  usePostComments: vi.fn(),
  showToast: vi.fn(),
  push: vi.fn(),
  getPostDetail: vi.fn(),
  getLatestCommentsPage: vi.fn(),
  hasUserLikedPost: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

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
  addContentFavorite: vi.fn(),
  getFavoritedTargetIds: mocks.getFavoritedTargetIds,
  removeContentFavorite: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usePostComments.mockReturnValue(makePostComments());
  mocks.getPostDetail.mockResolvedValue(null);
  mocks.getLatestCommentsPage.mockResolvedValue({
    comments: [],
    nextCursor: null,
    hasMore: false,
  });
  mocks.hasUserLikedPost.mockResolvedValue(false);
  mocks.getFavoritedTargetIds.mockResolvedValue(new Set());
});

describe('usePostDetailRuntime comment target boundary', () => {
  it('returns pinned and visible comments from usePostComments to the screen runtime contract', () => {
    const { result } = renderHook(() => usePostDetailRuntime('post-1'));

    expect(result.current.pinnedComment).toBe(pinnedComment);
    expect(result.current.visibleComments).toBe(visibleComments);
    expect(result.current.activeTargetId).toBe('comment-old');
    expect(result.current.isLoadingTargetComment).toBe(false);
  });
});
