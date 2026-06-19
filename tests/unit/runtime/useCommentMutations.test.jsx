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
 * Creates a manually controlled promise for async race assertions.
 * @returns {{
 *   promise: Promise<unknown>,
 *   resolve: (value: unknown) => void,
 *   reject: (reason?: unknown) => void
 * }} Deferred promise controls.
 */
function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve = () => {};
  /** @type {(reason?: unknown) => void} */
  let reject = () => {};
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

/**
 * Builds a normalized event comment.
 * @param {string} id - Comment ID.
 * @returns {import('@/service/event-comment-service').CommentData} Event comment.
 */
function eventComment(id) {
  return {
    id,
    authorUid: 'user-1',
    authorName: '跑者一號',
    authorPhotoURL: 'https://example.test/avatar.png',
    content: `留言 ${id}`,
    createdAt: null,
    updatedAt: null,
    isEdited: false,
  };
}

/**
 * Builds a normalized event comment history entry.
 * @param {string} id - History entry ID.
 * @returns {import('@/service/event-comment-service').CommentHistoryEntry} History entry.
 */
function historyEntry(id) {
  return {
    id,
    content: `歷史 ${id}`,
    editedAt: null,
  };
}

/**
 * Renders event comment mutations with callback spies.
 * @param {string} [eventId] - Event ID.
 * @returns {object} Rendered hook and collaborators.
 */
function renderUseCommentMutations(eventId = 'event-1') {
  const setComments = vi.fn();
  const onCommentAdded = vi.fn();
  const onCommentUpdated = vi.fn();
  const onCommentDeleted = vi.fn();
  const view = renderHook(() =>
    useCommentMutations(eventId, user, setComments, onCommentAdded, {
      onCommentUpdated,
      onCommentDeleted,
    }),
  );

  return { ...view, onCommentAdded, setComments, onCommentUpdated, onCommentDeleted };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateComment.mockResolvedValue(undefined);
  mocks.deleteComment.mockResolvedValue(undefined);
  mocks.addComment.mockResolvedValue(eventComment('event-comment-new'));
  mocks.getCurrentFirestoreTimestamp.mockReturnValue({ seconds: 123 });
});

describe('useCommentMutations submit runtime', () => {
  it('blocks duplicate submit calls while addComment is pending', async () => {
    const pendingSubmit = createDeferred();
    mocks.addComment.mockReturnValue(pendingSubmit.promise);
    const { result } = renderUseCommentMutations();

    let firstSubmit;
    let secondSubmit;
    act(() => {
      firstSubmit = result.current.handleSubmit('不要重複送出');
      secondSubmit = result.current.handleSubmit('不要重複送出');
    });

    expect(mocks.addComment).toHaveBeenNthCalledWith(
      1,
      'event-1',
      user,
      '不要重複送出',
    );
    expect(mocks.addComment).not.toHaveBeenNthCalledWith(
      2,
      'event-1',
      user,
      '不要重複送出',
    );

    await act(async () => {
      pendingSubmit.resolve(eventComment('event-comment-new'));
    });
    await expect(firstSubmit).resolves.toBe(true);
    await expect(secondSubmit).resolves.toBe(false);
  });

  it('does not prepend or signal success when submit resolves after eventId changes', async () => {
    const pendingSubmit = createDeferred();
    mocks.addComment.mockReturnValueOnce(pendingSubmit.promise);
    const setComments = vi.fn();
    const onCommentAdded = vi.fn();
    const view = renderHook(
      ({ eventId }) => useCommentMutations(eventId, user, setComments, onCommentAdded),
      { initialProps: { eventId: 'event-1' } },
    );

    /** @type {Promise<boolean>} */
    let submitResult;
    act(() => {
      submitResult = view.result.current.handleSubmit('舊活動留言');
    });

    view.rerender({ eventId: 'event-2' });
    await act(async () => {
      pendingSubmit.resolve(eventComment('event-comment-stale'));
    });

    await expect(submitResult).resolves.toBe(false);
    expect(setComments).not.toHaveBeenCalled();
    expect(onCommentAdded).not.toHaveBeenCalled();
  });

  it('clears submit highlight and stale timeout when eventId changes', async () => {
    vi.useFakeTimers();
    mocks.addComment
      .mockResolvedValueOnce(eventComment('event-comment-a'))
      .mockResolvedValueOnce(eventComment('event-comment-b'));
    let view;

    try {
      view = renderHook(
        ({ eventId }) => useCommentMutations(eventId, user, vi.fn()),
        { initialProps: { eventId: 'event-1' } },
      );

      await act(async () => {
        await view.result.current.handleSubmit('活動 A 留言');
      });

      expect(view.result.current.highlightId).toBe('event-comment-a');

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      view.rerender({ eventId: 'event-2' });

      expect(view.result.current.highlightId).toBeNull();

      await act(async () => {
        await view.result.current.handleSubmit('活動 B 留言');
      });

      expect(view.result.current.highlightId).toBe('event-comment-b');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(view.result.current.highlightId).toBe('event-comment-b');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(view.result.current.highlightId).toBeNull();
    } finally {
      view?.unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe('useCommentMutations stale async guards', () => {
  it('does not let stale edit success close or unlock a newer event edit save', async () => {
    const staleEdit = createDeferred();
    const currentEdit = createDeferred();
    mocks.updateComment
      .mockReturnValueOnce(staleEdit.promise)
      .mockReturnValueOnce(currentEdit.promise);
    const view = renderHook(
      ({ eventId }) => useCommentMutations(eventId, user, vi.fn()),
      { initialProps: { eventId: 'event-1' } },
    );
    const nextEventComment = eventComment('event-2-current');

    act(() => {
      view.result.current.handleEditOpen(fetchedPinnedComment);
    });
    /** @type {Promise<void> | undefined} */
    let staleSave;
    act(() => {
      staleSave = view.result.current.handleEditSave('舊活動更新');
    });

    view.rerender({ eventId: 'event-2' });
    act(() => {
      view.result.current.handleEditOpen(nextEventComment);
    });
    /** @type {Promise<void> | undefined} */
    let currentSave;
    act(() => {
      currentSave = view.result.current.handleEditSave('新活動更新');
    });

    await act(async () => {
      staleEdit.resolve(undefined);
      await staleSave;
    });

    expect(view.result.current.editingComment).toEqual(nextEventComment);
    expect(view.result.current.isUpdating).toBe(true);
    expect(view.result.current.updateError).toBeNull();

    await act(async () => {
      currentEdit.resolve(undefined);
      await currentSave;
    });
  });

  it('clears edit modal and loading immediately when eventId changes during edit save', async () => {
    const pendingEdit = createDeferred();
    mocks.updateComment.mockReturnValueOnce(pendingEdit.promise);
    const view = renderHook(
      ({ eventId }) => useCommentMutations(eventId, user, vi.fn()),
      { initialProps: { eventId: 'event-1' } },
    );

    act(() => {
      view.result.current.handleEditOpen(fetchedPinnedComment);
    });
    act(() => {
      view.result.current.handleEditSave('舊活動更新');
    });

    expect(view.result.current.isUpdating).toBe(true);

    view.rerender({ eventId: 'event-2' });

    expect(view.result.current.editingComment).toBeNull();
    expect(view.result.current.isUpdating).toBe(false);
    expect(view.result.current.updateError).toBeNull();

    await act(async () => {
      pendingEdit.resolve(undefined);
    });
  });

  it('does not let stale edit failure write error or unlock a newer event edit save', async () => {
    const staleEdit = createDeferred();
    const currentEdit = createDeferred();
    mocks.updateComment
      .mockReturnValueOnce(staleEdit.promise)
      .mockReturnValueOnce(currentEdit.promise);
    const view = renderHook(
      ({ eventId }) => useCommentMutations(eventId, user, vi.fn()),
      { initialProps: { eventId: 'event-1' } },
    );
    const nextEventComment = eventComment('event-2-current');

    act(() => {
      view.result.current.handleEditOpen(fetchedPinnedComment);
    });
    /** @type {Promise<void> | undefined} */
    let staleSave;
    act(() => {
      staleSave = view.result.current.handleEditSave('舊活動更新');
    });

    view.rerender({ eventId: 'event-2' });
    act(() => {
      view.result.current.handleEditOpen(nextEventComment);
    });
    /** @type {Promise<void> | undefined} */
    let currentSave;
    act(() => {
      currentSave = view.result.current.handleEditSave('新活動更新');
    });

    await act(async () => {
      staleEdit.reject(new Error('stale edit failure'));
      await staleSave;
    });

    expect(view.result.current.editingComment).toEqual(nextEventComment);
    expect(view.result.current.isUpdating).toBe(true);
    expect(view.result.current.updateError).toBeNull();

    await act(async () => {
      currentEdit.resolve(undefined);
      await currentSave;
    });
  });

  it('does not update comments or pinned target when edit resolves after eventId changes', async () => {
    const pendingEdit = createDeferred();
    mocks.updateComment.mockReturnValueOnce(pendingEdit.promise);
    const setComments = vi.fn();
    const onCommentUpdated = vi.fn();
    const view = renderHook(
      ({ eventId }) =>
        useCommentMutations(eventId, user, setComments, undefined, { onCommentUpdated }),
      { initialProps: { eventId: 'event-1' } },
    );

    act(() => {
      view.result.current.handleEditOpen(fetchedPinnedComment);
    });

    /** @type {Promise<void> | undefined} */
    let saveResult;
    act(() => {
      saveResult = view.result.current.handleEditSave('不應寫入的新內容');
    });

    view.rerender({ eventId: 'event-2' });
    await act(async () => {
      pendingEdit.resolve(undefined);
      await saveResult;
    });

    expect(mocks.updateComment).toHaveBeenCalledWith(
      'event-1',
      'event-comment-old',
      '不應寫入的新內容',
      '舊活動留言',
    );
    expect(setComments).not.toHaveBeenCalled();
    expect(onCommentUpdated).not.toHaveBeenCalled();
  });

  it('does not show stale edit errors when edit rejects after eventId changes', async () => {
    const pendingEdit = createDeferred();
    mocks.updateComment.mockReturnValueOnce(pendingEdit.promise);
    const view = renderHook(
      ({ eventId }) => useCommentMutations(eventId, user, vi.fn()),
      { initialProps: { eventId: 'event-1' } },
    );

    act(() => {
      view.result.current.handleEditOpen(fetchedPinnedComment);
    });

    /** @type {Promise<void> | undefined} */
    let saveResult;
    act(() => {
      saveResult = view.result.current.handleEditSave('不應顯示錯誤的新內容');
    });

    view.rerender({ eventId: 'event-2' });
    await act(async () => {
      pendingEdit.reject(new Error('stale edit failure'));
      await saveResult;
    });

    expect(view.result.current.updateError).toBeNull();
  });

  it('does not update comments, pinned target, or modal state when delete resolves after eventId changes', async () => {
    const pendingDelete = createDeferred();
    mocks.deleteComment.mockReturnValueOnce(pendingDelete.promise);
    const setComments = vi.fn();
    const onCommentDeleted = vi.fn();
    const view = renderHook(
      ({ eventId }) =>
        useCommentMutations(eventId, user, setComments, undefined, { onCommentDeleted }),
      { initialProps: { eventId: 'event-1' } },
    );

    act(() => {
      view.result.current.handleDeleteOpen(fetchedPinnedComment);
    });

    /** @type {Promise<void> | undefined} */
    let deleteResult;
    act(() => {
      deleteResult = view.result.current.handleDeleteConfirm();
    });

    view.rerender({ eventId: 'event-2' });

    expect(view.result.current.deletingComment).toBeNull();
    expect(view.result.current.isDeleting).toBe(false);
    expect(view.result.current.deleteError).toBeNull();

    await act(async () => {
      pendingDelete.resolve(undefined);
      await deleteResult;
    });

    expect(mocks.deleteComment).toHaveBeenCalledWith('event-1', 'event-comment-old');
    expect(setComments).not.toHaveBeenCalled();
    expect(onCommentDeleted).not.toHaveBeenCalled();
    expect(view.result.current.deletingComment).toBeNull();
    expect(view.result.current.isDeleting).toBe(false);
    expect(view.result.current.deleteError).toBeNull();
  });

  it('does not show stale delete errors when delete rejects after eventId changes', async () => {
    const pendingDelete = createDeferred();
    mocks.deleteComment.mockReturnValueOnce(pendingDelete.promise);
    const view = renderHook(
      ({ eventId }) => useCommentMutations(eventId, user, vi.fn()),
      { initialProps: { eventId: 'event-1' } },
    );

    act(() => {
      view.result.current.handleDeleteOpen(fetchedPinnedComment);
    });

    /** @type {Promise<void> | undefined} */
    let deleteResult;
    act(() => {
      deleteResult = view.result.current.handleDeleteConfirm();
    });

    view.rerender({ eventId: 'event-2' });
    await act(async () => {
      pendingDelete.reject(new Error('stale delete failure'));
      await deleteResult;
    });

    expect(view.result.current.deletingComment).toBeNull();
    expect(view.result.current.isDeleting).toBe(false);
    expect(view.result.current.deleteError).toBeNull();
  });

  it('keeps newer history entries when an older history request resolves last', async () => {
    const firstHistory = createDeferred();
    const secondHistory = createDeferred();
    mocks.fetchCommentHistory
      .mockReturnValueOnce(firstHistory.promise)
      .mockReturnValueOnce(secondHistory.promise);
    const commentA = eventComment('comment-a');
    const commentB = eventComment('comment-b');
    const newerEntries = [historyEntry('history-b')];
    const olderEntries = [historyEntry('history-a')];
    const { result } = renderUseCommentMutations();

    /** @type {Promise<void> | undefined} */
    let firstResult;
    act(() => {
      firstResult = result.current.handleViewHistory(commentA);
    });

    /** @type {Promise<void> | undefined} */
    let secondResult;
    act(() => {
      secondResult = result.current.handleViewHistory(commentB);
    });

    await act(async () => {
      secondHistory.resolve(newerEntries);
      await secondResult;
    });
    await act(async () => {
      firstHistory.resolve(olderEntries);
      await firstResult;
    });

    expect(result.current.historyComment).toEqual(commentB);
    expect(result.current.historyEntries).toEqual(newerEntries);
    expect(result.current.historyError).toBeNull();
  });
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
