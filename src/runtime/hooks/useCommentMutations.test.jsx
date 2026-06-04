import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import useCommentMutations from './useCommentMutations';

const eventCommentUseCasesMock = vi.hoisted(() => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  fetchCommentHistory: vi.fn(),
  updateComment: vi.fn(),
}));

const timestampMock = vi.hoisted(() => ({
  updatedAt: { seconds: 1, nanoseconds: 2 },
}));

vi.mock('@/runtime/client/use-cases/event-comment-use-cases', () => ({
  addComment: eventCommentUseCasesMock.addComment,
  deleteComment: eventCommentUseCasesMock.deleteComment,
  fetchCommentHistory: eventCommentUseCasesMock.fetchCommentHistory,
  updateComment: eventCommentUseCasesMock.updateComment,
}));

vi.mock('@/config/client/firebase-timestamp', () => ({
  getCurrentFirestoreTimestamp: () => timestampMock.updatedAt,
}));

const user = {
  uid: 'user-1',
  name: 'Runner',
  photoURL: '',
};

const comment = {
  id: 'comment-1',
  authorUid: 'user-1',
  authorName: 'Runner',
  authorPhotoURL: '',
  content: 'Original comment',
  createdAt: null,
  updatedAt: null,
  isEdited: false,
};

/**
 * Render event comment mutations with local comments state.
 * @param {Array<typeof comment>} initialComments - Initial comments list.
 * @returns {import('@testing-library/react').RenderHookResult<object, unknown>} Hook render result.
 */
function renderMutations(initialComments = [comment]) {
  return renderHook(() => {
    const [comments, setComments] = useState(initialComments);
    const mutations = useCommentMutations('event-1', user, setComments);
    return { comments, ...mutations };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  eventCommentUseCasesMock.updateComment.mockResolvedValue(undefined);
});

describe('useCommentMutations edit behavior', () => {
  test('returns true after successfully adding a comment without exposing input remount state', async () => {
    const newComment = { ...comment, id: 'comment-2', content: 'New event comment' };
    eventCommentUseCasesMock.addComment.mockResolvedValueOnce(newComment);
    const onSuccess = vi.fn();
    const view = renderHook(() => {
      const [comments, setComments] = useState([comment]);
      const mutations = useCommentMutations('event-1', user, setComments, onSuccess);
      return { comments, ...mutations };
    });

    let result;
    await act(async () => {
      result = await view.result.current.handleSubmit('New event comment');
    });

    expect(result).toBe(true);
    expect(eventCommentUseCasesMock.addComment).toHaveBeenCalledWith('event-1', user, 'New event comment');
    expect(view.result.current.comments[0]).toEqual(newComment);
    expect(onSuccess).toHaveBeenCalledWith('comment-2');
    expect(view.result.current.submitError).toBeNull();
    expect(view.result.current).not.toHaveProperty('submitKey');
  });

  test('returns false and preserves local comments after add failure', async () => {
    eventCommentUseCasesMock.addComment.mockRejectedValueOnce(new Error('failed'));
    const view = renderMutations();

    let result;
    await act(async () => {
      result = await view.result.current.handleSubmit('Will fail');
    });

    expect(result).toBe(false);
    expect(view.result.current.comments).toEqual([comment]);
    expect(view.result.current.submitError).toBe('送出失敗，請再試一次');
    expect(view.result.current).not.toHaveProperty('submitKey');
  });

  test('uses the shared edit modal state and preserves event edited metadata', async () => {
    const view = renderMutations();

    act(() => {
      view.result.current.handleEditOpen(comment);
    });
    await act(async () => {
      await view.result.current.handleEditSave(' Updated comment ');
    });

    expect(eventCommentUseCasesMock.updateComment).toHaveBeenLastCalledWith(
      'event-1',
      'comment-1',
      ' Updated comment ',
      'Original comment',
    );
    expect(view.result.current.comments[0]).toMatchObject({
      content: 'Updated comment',
      isEdited: true,
      updatedAt: timestampMock.updatedAt,
    });
    expect(view.result.current.editingComment).toBeNull();
    expect(view.result.current.updateError).toBeNull();
  });

  test('keeps the modal open and leaves local comments unchanged after save failure', async () => {
    eventCommentUseCasesMock.updateComment.mockRejectedValueOnce(new Error('failed'));
    const view = renderMutations();

    act(() => {
      view.result.current.handleEditOpen(comment);
    });
    await act(async () => {
      await view.result.current.handleEditSave('Failed update');
    });

    expect(view.result.current.comments[0]).toMatchObject({
      content: 'Original comment',
      isEdited: false,
      updatedAt: null,
    });
    expect(view.result.current.editingComment).toEqual(comment);
    expect(view.result.current.updateError).toBe('更新失敗，請再試一次');
  });
});
