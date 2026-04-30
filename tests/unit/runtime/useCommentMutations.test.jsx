import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createCommentFixture, createHistorySnapshots } from '../../_helpers/comment-fixtures';
import {
  commentMutationBoundaryMocks,
  createCommentMutationProps,
  mockSuccessfulEditTransaction,
} from '../../_helpers/use-comment-mutations-test-helpers';

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock('@/config/client/firebase-timestamp', () => ({
  getCurrentFirestoreTimestamp: commentMutationBoundaryMocks.mockGetCurrentFirestoreTimestamp,
  createFirestoreTimestamp: vi.fn((date) => ({ __ts: 'fromDate', date })),
}));

/**
 * @param {ReturnType<typeof createCommentFixture>} comment - fixture comment。
 * @returns {import('@/service/event-comment-service').CommentData} comment data。
 */
function asCommentData(comment) {
  return /** @type {import('@/service/event-comment-service').CommentData} */ (
    /** @type {unknown} */ (comment)
  );
}

/**
 * @param {{
 *   eventId: string,
 *   user: object | null,
 *   setComments: import('vitest').Mock,
 *   onSuccess: import('vitest').Mock | undefined,
 * }} props - hook props。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any>>} render 結果。
 */
async function renderCommentMutationsHook(props) {
  const { default: useCommentMutations } = await import('@/runtime/hooks/useCommentMutations');
  return renderHook(() =>
    useCommentMutations(props.eventId, props.user, props.setComments, props.onSuccess),
  );
}

describe('useCommentMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handleSubmit', () => {
    it('adds a comment, updates list state, and notifies success', async () => {
      commentMutationBoundaryMocks.mockAddDoc.mockResolvedValueOnce({ id: 'new-1' });
      const props = createCommentMutationProps({
        initialComments: [createCommentFixture({ id: 'existing-1', content: 'keep me' })],
        withOnSuccess: true,
      });
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleSubmit('  hello world  ');
      });

      await waitFor(() => expect(result.current.highlightId).toBe('new-1'));

      expect(commentMutationBoundaryMocks.mockAddDoc).toHaveBeenLastCalledWith(
        { type: 'collection', path: 'events/event-1/comments' },
        expect.objectContaining({
          authorUid: 'u1',
          authorName: 'Alice',
          authorPhotoURL: '',
          content: 'hello world',
          isEdited: false,
          updatedAt: null,
        }),
      );
      expect(props.getComments()[0]).toMatchObject({
        id: 'new-1',
        content: 'hello world',
        createdAt: { __ts: 'now' },
      });
      expect(props.getComments()[1]).toMatchObject({ id: 'existing-1' });
      expect(result.current.submitKey).toBe(1);
      expect(result.current.submitError).toBeNull();
      expect(result.current.isSubmitting).toBe(false);
      expect(props.onSuccess).toHaveBeenLastCalledWith('new-1');
    });

    it.each([
      ['missing user', { user: null }, 'hi'],
      ['blank content', {}, '   '],
    ])('surfaces submitError for %s and skips firestore write', async (_label, overrides, content) => {
      const props = createCommentMutationProps(overrides);
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleSubmit(content);
      });

      await waitFor(() => expect(result.current.submitError).toBe('送出失敗，請再試一次'));

      expect(commentMutationBoundaryMocks.mockAddDoc).not.toHaveBeenCalled();
      expect(props.setComments).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('surfaces submitError when addDoc rejects', async () => {
      commentMutationBoundaryMocks.mockAddDoc.mockRejectedValueOnce(new Error('firestore down'));
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleSubmit('hi');
      });

      await waitFor(() => expect(result.current.submitError).toBe('送出失敗，請再試一次'));

      expect(props.setComments).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('keeps the latest highlight timer when submits happen back to back', async () => {
      vi.useFakeTimers();
      commentMutationBoundaryMocks.mockAddDoc
        .mockResolvedValueOnce({ id: 'first' })
        .mockResolvedValueOnce({ id: 'second' });
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleSubmit('first');
      });
      expect(result.current.highlightId).toBe('first');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
        await result.current.handleSubmit('second');
      });
      expect(result.current.highlightId).toBe('second');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(result.current.highlightId).toBe('second');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(result.current.highlightId).toBeNull();
    });
  });

  describe('handleEditSave', () => {
    it('writes history + comment update through transaction and closes edit mode', async () => {
      const tx = mockSuccessfulEditTransaction();
      const props = createCommentMutationProps({
        initialComments: [createCommentFixture({ id: 'c1', content: 'old content' })],
      });
      const { result } = await renderCommentMutationsHook(props);

      act(() => {
        result.current.handleEditOpen(
          asCommentData(createCommentFixture({ id: 'c1', content: 'old content' })),
        );
      });
      await act(async () => {
        await result.current.handleEditSave('  new content  ');
      });

      await waitFor(() => expect(result.current.editingComment).toBeNull());

      expect(tx.get).toHaveBeenCalledWith({ type: 'doc', path: 'events/event-1/comments/c1', id: 'c1' });
      expect(tx.set).toHaveBeenCalledWith(
        { type: 'doc', path: 'events/event-1/comments/c1/history/generated-doc', id: 'generated-doc' },
        { content: 'old content', editedAt: { __sentinel: 'serverTimestamp' } },
      );
      expect(tx.update).toHaveBeenCalledWith(
        { type: 'doc', path: 'events/event-1/comments/c1', id: 'c1' },
        { content: 'new content', updatedAt: { __sentinel: 'serverTimestamp' }, isEdited: true },
      );
      expect(props.getComments()[0]).toMatchObject({
        id: 'c1',
        content: 'new content',
        isEdited: true,
        updatedAt: { __ts: 'current' },
      });
      expect(result.current.updateError).toBeNull();
      expect(result.current.isUpdating).toBe(false);
    });

    it('surfaces updateError when transaction rejects', async () => {
      commentMutationBoundaryMocks.mockRunTransaction.mockRejectedValueOnce(new Error('tx failed'));
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);

      act(() => {
        result.current.handleEditOpen(asCommentData(createCommentFixture()));
      });
      await act(async () => {
        await result.current.handleEditSave('changed');
      });

      await waitFor(() => expect(result.current.updateError).toBe('更新失敗，請再試一次'));

      expect(props.setComments).not.toHaveBeenCalled();
      expect(result.current.editingComment).toMatchObject({ id: 'c1' });
      expect(result.current.isUpdating).toBe(false);
    });

    it('is a no-op when there is no editing target', async () => {
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleEditSave('whatever');
      });

      expect(commentMutationBoundaryMocks.mockRunTransaction).not.toHaveBeenCalled();
      expect(result.current.updateError).toBeNull();
    });
  });

  describe('handleDeleteConfirm', () => {
    it('deletes history + comment and removes the item from local list', async () => {
      const batchDelete = vi.fn();
      const batchCommit = vi.fn().mockResolvedValueOnce(undefined);
      commentMutationBoundaryMocks.mockGetDocs.mockResolvedValueOnce({
        docs: [{ ref: { id: 'h1', path: 'events/event-1/comments/c1/history/h1' } }],
      });
      commentMutationBoundaryMocks.mockWriteBatch.mockReturnValueOnce({
        delete: batchDelete,
        commit: batchCommit,
      });
      const props = createCommentMutationProps({
        initialComments: [createCommentFixture({ id: 'c1' }), createCommentFixture({ id: 'c2' })],
      });
      const { result } = await renderCommentMutationsHook(props);

      act(() => {
        result.current.handleDeleteOpen(
          asCommentData(createCommentFixture({ id: 'c1', content: 'bye' })),
        );
      });
      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      await waitFor(() => expect(result.current.deletingComment).toBeNull());

      expect(batchDelete).toHaveBeenNthCalledWith(1, {
        id: 'h1',
        path: 'events/event-1/comments/c1/history/h1',
      });
      expect(batchDelete).toHaveBeenNthCalledWith(2, {
        type: 'doc',
        path: 'events/event-1/comments/c1',
        id: 'c1',
      });
      expect(batchCommit).toHaveBeenCalledOnce();
      expect(props.getComments()).toHaveLength(1);
      expect(props.getComments()[0]).toMatchObject({ id: 'c2' });
      expect(result.current.deleteError).toBeNull();
      expect(result.current.isDeleting).toBe(false);
    });

    it('surfaces deleteError and keeps modal state when delete fails', async () => {
      const batchCommit = vi.fn().mockRejectedValueOnce(new Error('permission denied'));
      commentMutationBoundaryMocks.mockGetDocs.mockResolvedValueOnce({ docs: [] });
      commentMutationBoundaryMocks.mockWriteBatch.mockReturnValueOnce({
        delete: vi.fn(),
        commit: batchCommit,
      });
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);
      const target = asCommentData(
        createCommentFixture({ id: 'c2', authorUid: 'u-other', content: 'x' }),
      );

      act(() => {
        result.current.handleDeleteOpen(target);
      });
      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      await waitFor(() => expect(result.current.deleteError).toBe('刪除失敗，請再試一次'));

      expect(result.current.deletingComment).toEqual(target);
      expect(props.setComments).not.toHaveBeenCalled();
      expect(result.current.isDeleting).toBe(false);
    });

    it('is a no-op when there is no deleting target', async () => {
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      expect(commentMutationBoundaryMocks.mockGetDocs).not.toHaveBeenCalled();
      expect(result.current.deleteError).toBeNull();
    });
  });

  describe('handleViewHistory', () => {
    it('loads history entries on success', async () => {
      commentMutationBoundaryMocks.mockGetDocs.mockResolvedValueOnce({
        docs: createHistorySnapshots([
          { id: 'h1', content: 'v1' },
          { id: 'h2', content: 'v2' },
        ]),
      });
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleViewHistory(
          asCommentData(createCommentFixture({ isEdited: true })),
        );
      });

      await waitFor(() => expect(result.current.historyEntries).toHaveLength(2));

      expect(result.current.historyEntries.map((entry) => entry.id)).toEqual(['h1', 'h2']);
      expect(result.current.historyError).toBeNull();
    });

    it('surfaces historyError when loading history fails', async () => {
      commentMutationBoundaryMocks.mockGetDocs.mockRejectedValueOnce(new Error('history failed'));
      const props = createCommentMutationProps();
      const { result } = await renderCommentMutationsHook(props);

      await act(async () => {
        await result.current.handleViewHistory(
          asCommentData(createCommentFixture({ isEdited: true })),
        );
      });

      await waitFor(() => expect(result.current.historyError).toBe('載入編輯記錄失敗'));

      expect(result.current.historyEntries).toEqual([]);
    });
  });
});
