import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  createMutationParams,
  createTestEvent,
  fakeTs,
  requireEvent,
} from '../../_helpers/use-event-detail-mutations-test-helpers';

/* 只 mock firebase/firestore、firebase client config、firebase timestamp；repo/service/runtime 走真實實作。 */

const {
  mockGetDoc,
  mockGetDocs,
  mockDoc,
  mockCollection,
  mockQuery,
  mockOrderBy,
  mockLimit,
  mockServerTimestamp,
  mockRunTransaction,
  mockWriteBatch,
  mockDeleteField,
  mockTimestampFromDate,
  mockCreateFirestoreTimestamp,
} = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockDoc: vi.fn((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
    id: String(segments.at(-1) ?? ''),
  })),
  mockCollection: vi.fn((_db, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  mockQuery: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  mockRunTransaction: vi.fn(),
  mockWriteBatch: vi.fn(),
  mockDeleteField: vi.fn(() => ({ __sentinel: 'deleteField' })),
  mockTimestampFromDate: vi.fn((date) => ({
    __ts: 'fromDate',
    date,
    toDate: () => date,
  })),
  mockCreateFirestoreTimestamp: vi.fn((date) => ({
    __ts: 'createdViaTimestamp',
    date,
    toDate: () => date,
  })),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  doc: mockDoc,
  collection: mockCollection,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  serverTimestamp: mockServerTimestamp,
  runTransaction: mockRunTransaction,
  writeBatch: mockWriteBatch,
  deleteField: mockDeleteField,
  Timestamp: { fromDate: mockTimestampFromDate },
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock('@/config/client/firebase-timestamp', () => ({
  createFirestoreTimestamp: mockCreateFirestoreTimestamp,
  getCurrentFirestoreTimestamp: vi.fn(() => ({ __ts: 'current' })),
}));

/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useEventDetailMutations').default>} hook 預設匯出。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useEventDetailMutations')).default;
}

/**
 * @param {ReturnType<typeof createMutationParams>} ctx - 測試上下文。
 * @returns {Promise<object>} render 結果。
 */
async function renderTarget(ctx) {
  const useEventDetailMutations = await loadHook();
  return renderHook(() => useEventDetailMutations(ctx.params));
}

/** @type {ReturnType<typeof vi.spyOn> | undefined} */
let consoleErrorSpy;
/** @type {ReturnType<typeof vi.spyOn> | undefined} */
let consoleWarnSpy;

describe('useEventDetailMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
    consoleWarnSpy?.mockRestore();
    consoleWarnSpy = undefined;
  });

  describe('handleEditSubmit', () => {
    it('updates event state on success and closes edit mode', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockRunTransaction.mockImplementationOnce(async (_db, callback) =>
        callback({
          get: vi.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              participantsCount: 3,
              time: fakeTs('2026-05-01T08:00:00Z'),
              registrationDeadline: fakeTs('2026-04-30T20:00:00Z'),
            }),
          }),
          update: vi.fn(),
        }),
      );
      const ctx = createMutationParams();
      const { result } = await renderTarget(ctx);
      act(() => {
        result.current.handleEditEvent(requireEvent(ctx.getEvent()));
      });
      await act(async () => {
        await result.current.handleEditSubmit({
          id: 'e1',
          title: 'Updated Title',
          time: '2026-05-02T08:00:00Z',
          registrationDeadline: '2026-05-01T20:00:00Z',
        });
      });
      await waitFor(() => {
        expect(ctx.showToastMock).toHaveBeenLastCalledWith('更新活動成功');
      });
      expect(mockRunTransaction).toHaveBeenCalled();
      expect(mockCreateFirestoreTimestamp).toHaveBeenCalled();
      expect(ctx.getEvent()).toMatchObject({
        title: 'Updated Title',
        time: { __ts: 'createdViaTimestamp' },
        registrationDeadline: { __ts: 'createdViaTimestamp' },
      });
      expect(result.current.editingEvent).toBeNull();
      expect(result.current.isUpdating).toBe(false);
    });

    it('surfaces the capacity guard when maxParticipants drops below joined count', async () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRunTransaction.mockImplementationOnce(async (_db, callback) =>
        callback({
          get: vi.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              participantsCount: 8,
              time: fakeTs('2026-05-01T08:00:00Z'),
              registrationDeadline: fakeTs('2026-04-30T20:00:00Z'),
            }),
          }),
          update: vi.fn(),
        }),
      );
      const ctx = createMutationParams({ event: createTestEvent({ participantsCount: 8, maxParticipants: 10 }) });
      const { result } = await renderTarget(ctx);
      act(() => {
        result.current.handleEditEvent(requireEvent(ctx.getEvent()));
      });
      await act(async () => {
        await result.current.handleEditSubmit({ id: 'e1', maxParticipants: 5 });
      });
      await waitFor(() => {
        expect(ctx.showToastMock).toHaveBeenLastCalledWith('更新活動失敗，請稍後再試', 'error');
      });
      expect(ctx.setEventMock).not.toHaveBeenCalled();
      expect(ctx.getEvent()).toMatchObject({ maxParticipants: 10, participantsCount: 8 });
      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe('handleDeleteConfirm', () => {
    it('deletes the event tree and redirects to the events page', async () => {
      mockGetDocs
        .mockResolvedValueOnce({ docs: [{ id: 'u-other', data: () => ({ uid: 'u-other' }) }] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });
      mockWriteBatch
        .mockReturnValueOnce({ set: vi.fn(), commit: vi.fn().mockResolvedValueOnce(undefined) })
        .mockReturnValueOnce({
          delete: vi.fn(),
          commit: vi.fn().mockResolvedValueOnce(undefined),
        });
      const ctx = createMutationParams();
      const { result } = await renderTarget(ctx);
      act(() => {
        result.current.handleDeleteEventRequest(requireEvent(ctx.getEvent()));
      });
      await act(async () => {
        await result.current.handleDeleteConfirm('e1');
      });
      await waitFor(() => {
        expect(ctx.router.push).toHaveBeenCalledWith('/events?toast=活動已刪除');
      });
      expect(mockWriteBatch).toHaveBeenCalled();
      expect(result.current.deletingEventId).toBeNull();
      expect(result.current.isDeletingEvent).toBe(false);
    });

    it('requires auth before deleting', async () => {
      const ctx = createMutationParams({ user: null });
      const { result } = await renderTarget(ctx);

      await act(async () => {
        await result.current.handleDeleteConfirm('e1');
      });

      expect(ctx.showToastMock).toHaveBeenLastCalledWith('刪除活動前請先登入', 'error');
      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(mockWriteBatch).not.toHaveBeenCalled();
      expect(ctx.router.push).not.toHaveBeenCalled();
    });

    it('treats an already-deleted event as a guarded race path', async () => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const ctx = createMutationParams();
      const { result } = await renderTarget(ctx);
      act(() => {
        result.current.handleDeleteEventRequest(requireEvent(ctx.getEvent()));
      });
      await act(async () => {
        await result.current.handleDeleteConfirm('e1');
      });
      await waitFor(() => {
        expect(ctx.getError()).toBe('找不到這個活動（可能已被刪除）');
      });
      expect(ctx.getEvent()).toBeNull();
      expect(ctx.router.push).not.toHaveBeenCalled();
      expect(result.current.deletingEventId).toBeNull();
      expect(result.current.isDeletingEvent).toBe(false);
    });

    it('shows the generic failure toast for non-race delete errors', async () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetDocs.mockRejectedValueOnce(new Error('boom'));
      const ctx = createMutationParams();
      const { result } = await renderTarget(ctx);

      act(() => { result.current.handleDeleteEventRequest(requireEvent(ctx.getEvent())); });
      await act(async () => { await result.current.handleDeleteConfirm('e1'); });

      await waitFor(() => {
        expect(ctx.showToastMock).toHaveBeenLastCalledWith('刪除活動失敗，請稍後再試', 'error');
      });

      expect(ctx.router.push).not.toHaveBeenCalled();
      expect(result.current.isDeletingEvent).toBe(false);
    });
  });

  it('sends comment-added notifications through the real notification use case', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [{ id: 'u2', data: () => ({ uid: 'u2' }) }] })
      .mockResolvedValueOnce({ docs: [{ data: () => ({ authorUid: 'u3' }) }] });
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValueOnce(undefined);
    mockWriteBatch.mockReturnValueOnce({ set: batchSet, commit: batchCommit });
    const ctx = createMutationParams();
    const { result } = await renderTarget(ctx);

    act(() => { result.current.handleCommentAdded('comment-1'); });

    await waitFor(() => { expect(batchCommit).toHaveBeenCalled(); });
    expect(batchSet.mock.calls.some(([, payload]) => payload.type === 'event_host_comment')).toBe(true);
    expect(batchSet.mock.calls.some(([, payload]) => payload.type === 'event_participant_comment')).toBe(true);
    expect(batchSet.mock.calls.some(([, payload]) => payload.type === 'event_comment_reply')).toBe(true);
  });
});
