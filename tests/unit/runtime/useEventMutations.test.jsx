import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  createEventMutationProps,
  createEventSubmitEvent,
} from '../../_helpers/use-event-mutations-test-helpers';

const {
  mockAddDoc,
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
  mockAddDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockDoc: vi.fn((_db, ...segments) => ({ type: 'doc', path: segments.join('/'), id: String(segments.at(-1) ?? '') })),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  mockRunTransaction: vi.fn(),
  mockWriteBatch: vi.fn(),
  mockDeleteField: vi.fn(() => ({ __sentinel: 'deleteField' })),
  mockTimestampFromDate: vi.fn((date) => ({ __ts: 'fromDate', toDate: () => date })),
  mockCreateFirestoreTimestamp: vi.fn((date) => ({ __ts: 'fromDate', toDate: () => date })),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
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
  getCurrentFirestoreTimestamp: vi.fn(() => ({ __ts: 'now' })),
}));

/** @returns {Promise<typeof import('@/runtime/hooks/useEventMutations').default>} hook 模組。 */
async function loadHook() {
  return (await import('@/runtime/hooks/useEventMutations')).default;
}

describe('useEventMutations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('create', () => {
    it('creates an event, dedupes the list, and resets the form', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'event-new' });
      const props = createEventMutationProps({
        routeCoordinates: [[{ lat: 25, lng: 121 }]],
        initialEvents: [{ id: 'event-new', title: '舊資料' }, { id: 'event-keep', title: '保留' }],
      });
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));
      const submitEvent = createEventSubmitEvent();

      await act(async () => {
        await result.current.handleSubmit(/** @type {any} */ (submitEvent));
      });

      await waitFor(() => expect(props.showToast).toHaveBeenLastCalledWith('建立活動成功'));

      expect(submitEvent.preventDefault).toHaveBeenCalled();
      expect(mockAddDoc).toHaveBeenCalled();
      expect(props.createCtx.resetCreateForm).toHaveBeenCalled();
      expect(props.getEvents()).toHaveLength(2);
      expect(props.getEvents()[0]).toMatchObject({ id: 'event-new', title: '清晨慢跑' });
      expect(props.getEvents()[1]).toMatchObject({ id: 'event-keep', title: '保留' });
      expect(result.current.draftFormData).toBeNull();
      expect(result.current.isCreating).toBe(false);
    });

    it('blocks invalid deadline values before calling createEvent', async () => {
      const props = createEventMutationProps();
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      await act(async () => {
        await result.current.handleSubmit(
          /** @type {any} */ (
            createEventSubmitEvent({
              time: '2030-01-01T07:00',
              registrationDeadline: '2030-01-01T07:00',
            })
          ),
        );
      });

      expect(props.showToast).toHaveBeenLastCalledWith('報名截止時間必須在活動開始時間之前', 'error');
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(result.current.isCreating).toBe(false);
    });

    it('stores draft data and shows an error toast when create fails', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('firestore down'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const props = createEventMutationProps({ routeCoordinates: [[{ lat: 25, lng: 121 }]] });
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      await act(async () => {
        await result.current.handleSubmit(/** @type {any} */ (createEventSubmitEvent()));
      });

      await waitFor(() =>
        expect(props.showToast).toHaveBeenLastCalledWith('建立活動失敗，請稍後再試', 'error'),
      );

      expect(props.setEvents).not.toHaveBeenCalled();
      expect(props.createCtx.resetCreateForm).not.toHaveBeenCalled();
      expect(result.current.draftFormData).toMatchObject({ title: '清晨慢跑', city: '台北市' });
      expect(result.current.isCreating).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('skips state updates after unmount during create completion', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'event-new' });
      const props = createEventMutationProps();
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      await act(async () => {
        props.isMountedRef.current = false;
        await result.current.handleSubmit(/** @type {any} */ (createEventSubmitEvent()));
      });

      expect(props.setEvents).not.toHaveBeenCalled();
      expect(props.showToast).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates an event and closes edit mode on success', async () => {
      mockRunTransaction.mockImplementationOnce(async (_db, callback) =>
        callback({
          get: vi.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              participantsCount: 0,
              remainingSeats: 10,
              maxParticipants: 10,
              time: { toDate: () => new Date('2030-01-01T07:00:00Z') },
              registrationDeadline: { toDate: () => new Date('2029-12-31T23:00:00Z') },
            }),
          }),
          update: vi.fn(),
        }),
      );
      const props = createEventMutationProps({ initialEvents: [{ id: 'event-1', title: '舊標題' }] });
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      act(() => {
        result.current.handleEditEvent(/** @type {any} */ ({ id: 'event-1', time: '2030-01-01T07:00', registrationDeadline: '2029-12-31T23:00' }));
      });
      await act(async () => {
        await result.current.handleEditSubmit({ id: 'event-1', title: 'Updated title' });
      });

      await waitFor(() => expect(props.showToast).toHaveBeenLastCalledWith('更新活動成功'));

      expect(mockRunTransaction).toHaveBeenCalled();
      expect(props.getEvents()[0]).toMatchObject({ id: 'event-1', title: 'Updated title' });
      expect(result.current.editingEvent).toBeNull();
      expect(result.current.isUpdating).toBe(false);
    });

    it('blocks invalid edited deadline values before transaction', async () => {
      const props = createEventMutationProps();
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      act(() => {
        result.current.handleEditEvent(/** @type {any} */ ({ id: 'event-1', time: '2030-01-01T07:00', registrationDeadline: '2029-12-31T23:00' }));
      });
      await act(async () => {
        await result.current.handleEditSubmit({
          id: 'event-1',
          time: '2030-01-01T07:00',
          registrationDeadline: '2030-01-01T07:00',
        });
      });

      expect(props.showToast).toHaveBeenLastCalledWith('報名截止時間必須在活動開始時間之前', 'error');
      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(result.current.isUpdating).toBe(false);
    });

    it('shows an error toast when update fails', async () => {
      mockRunTransaction.mockRejectedValueOnce(new Error('tx failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const props = createEventMutationProps();
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      await act(async () => {
        await result.current.handleEditSubmit({ id: 'event-1', title: 'whatever' });
      });

      await waitFor(() =>
        expect(props.showToast).toHaveBeenLastCalledWith('更新活動失敗，請稍後再試', 'error'),
      );

      expect(props.setEvents).not.toHaveBeenCalled();
      expect(result.current.isUpdating).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('deletes an event and removes it from the list', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });
      mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });
      const batchCommit = vi.fn().mockResolvedValueOnce(undefined);
      mockWriteBatch.mockReturnValueOnce({ delete: vi.fn(), commit: batchCommit });
      const props = createEventMutationProps({
        initialEvents: [{ id: 'event-1', title: '刪除我' }, { id: 'event-2', title: '保留我' }],
      });
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      act(() => result.current.handleDeleteEventRequest(/** @type {any} */ ({ id: 'event-1' })));
      await act(async () => {
        await result.current.handleDeleteConfirm('event-1');
      });

      await waitFor(() => expect(props.showToast).toHaveBeenLastCalledWith('活動已刪除'));

      expect(batchCommit).toHaveBeenCalled();
      expect(props.getEvents()).toEqual([{ id: 'event-2', title: '保留我' }]);
      expect(result.current.deletingEventId).toBeNull();
      expect(result.current.isDeletingEvent).toBe(false);
    });

    it('shows an error toast when delete fails', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const props = createEventMutationProps();
      const useEventMutations = await loadHook();
      const { result } = renderHook(() => useEventMutations(props));

      await act(async () => {
        await result.current.handleDeleteConfirm('event-missing');
      });

      await waitFor(() =>
        expect(props.showToast).toHaveBeenLastCalledWith('刪除活動失敗，請稍後再試', 'error'),
      );

      expect(props.setEvents).not.toHaveBeenCalled();
      expect(result.current.isDeletingEvent).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  it('clears edit and delete state through cancel handlers', async () => {
    const props = createEventMutationProps();
    const useEventMutations = await loadHook();
    const { result } = renderHook(() => useEventMutations(props));

    act(() => {
      result.current.handleEditEvent(/** @type {any} */ ({ id: 'event-1' }));
      result.current.handleDeleteEventRequest(/** @type {any} */ ({ id: 'event-1' }));
    });
    act(() => {
      result.current.handleEditCancel();
      result.current.handleDeleteCancel();
    });

    expect(result.current.editingEvent).toBeNull();
    expect(result.current.deletingEventId).toBeNull();
  });
});
