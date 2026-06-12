// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCommentMutations from '../../../src/runtime/hooks/useCommentMutations';

const mocks = vi.hoisted(() => ({
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  fetchCommentHistory: vi.fn(),
  getCurrentFirestoreTimestamp: vi.fn(),
}));

vi.mock('../../../src/runtime/client/use-cases/event-comment-use-cases', () => ({
  addComment: mocks.addComment,
  updateComment: mocks.updateComment,
  deleteComment: mocks.deleteComment,
  fetchCommentHistory: mocks.fetchCommentHistory,
}));

vi.mock('../../../src/config/client/firebase-timestamp', () => ({
  getCurrentFirestoreTimestamp: mocks.getCurrentFirestoreTimestamp,
}));

const user = {
  uid: 'user-1',
  name: '跑者一號',
  photoURL: 'https://example.test/avatar.png',
};

const fetchedPinnedComment = {
  id: 'event-comment-old',
  authorUid: 'user-1',
  authorName: '跑者一號',
  authorPhotoURL: 'https://example.test/avatar.png',
  content: '舊活動留言',
  createdAt: null,
  updatedAt: null,
  isEdited: false,
};

/**
 * Renders event comment mutations with callback spies.
 * @returns {object} Rendered hook and collaborators.
 */
function renderUseCommentMutations() {
  const setComments = vi.fn();
  const onCommentAdded = vi.fn();
  const onCommentUpdated = vi.fn();
  const onCommentDeleted = vi.fn();
  const view = renderHook(() =>
    useCommentMutations('event-1', user, setComments, onCommentAdded, {
      onCommentUpdated,
      onCommentDeleted,
    }),
  );

  return { ...view, setComments, onCommentUpdated, onCommentDeleted };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateComment.mockResolvedValue(undefined);
  mocks.deleteComment.mockResolvedValue(undefined);
  mocks.getCurrentFirestoreTimestamp.mockReturnValue({ seconds: 123 });
});

describe('useCommentMutations target comment callbacks', () => {
  it('notifies the standalone pinned target when an event comment edit succeeds', async () => {
    const { result, onCommentUpdated } = renderUseCommentMutations();

    act(() => {
      result.current.handleEditOpen(fetchedPinnedComment);
    });
    await act(async () => {
      await result.current.handleEditSave('更新後活動留言');
    });

    expect(mocks.updateComment).toHaveBeenCalledWith(
      'event-1',
      'event-comment-old',
      '更新後活動留言',
      '舊活動留言',
    );
    expect(onCommentUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-comment-old',
        content: '更新後活動留言',
        isEdited: true,
        updatedAt: { seconds: 123 },
      }),
    );
  });

  it('notifies the standalone pinned target when an event comment delete succeeds', async () => {
    const { result, onCommentDeleted } = renderUseCommentMutations();

    act(() => {
      result.current.handleDeleteOpen(fetchedPinnedComment);
    });
    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(mocks.deleteComment).toHaveBeenCalledWith('event-1', 'event-comment-old');
    expect(onCommentDeleted).toHaveBeenCalledWith('event-comment-old');
  });
});
