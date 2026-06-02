import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import useCommentEditModal from './useCommentEditModal';

const comment = {
  id: 'comment-1',
  content: 'Original comment',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCommentEditModal', () => {
  test('opens, cancels, and clears stale update errors', async () => {
    const saveComment = vi.fn().mockRejectedValueOnce(new Error('failed'));
    const view = renderHook(() => useCommentEditModal({ saveComment }));

    act(() => {
      view.result.current.handleEditOpen(comment);
    });
    await act(async () => {
      await view.result.current.handleEditSave('Next comment');
    });

    expect(view.result.current.updateError).toBe('更新失敗，請再試一次');
    expect(view.result.current.editingComment).toEqual(comment);

    act(() => {
      view.result.current.handleEditCancel();
    });

    expect(view.result.current.editingComment).toBeNull();
    expect(view.result.current.updateError).toBeNull();
  });

  test('passes the active comment and new content to the injected save callback', async () => {
    const saveComment = vi.fn().mockResolvedValue(undefined);
    const view = renderHook(() => useCommentEditModal({ saveComment }));

    act(() => {
      view.result.current.handleEditOpen(comment);
    });
    await act(async () => {
      await view.result.current.handleEditSave('Updated comment');
    });

    expect(saveComment).toHaveBeenLastCalledWith(comment, 'Updated comment');
    expect(view.result.current.editingComment).toBeNull();
    expect(view.result.current.isUpdating).toBe(false);
    expect(view.result.current.updateError).toBeNull();
  });
});
