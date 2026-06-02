import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((...path) => ({ kind: 'collection', path })),
  deleteField: vi.fn(() => ({ kind: 'deleteField' })),
  doc: vi.fn((...path) => ({ kind: 'doc', path })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value) => ({ op: 'limit', value })),
  orderBy: vi.fn((field, direction) => ({ op: 'orderBy', field, direction })),
  query: vi.fn((...args) => ({ kind: 'query', args })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  startAfter: vi.fn((value) => ({ op: 'startAfter', value })),
  Timestamp: {
    fromDate: vi.fn((date) => ({ kind: 'timestamp', iso: date.toISOString() })),
  },
  where: vi.fn((field, op, value) => ({ op: 'where', field, comparator: op, value })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: { kind: 'db' } }));

/**
 * Build a minimal Firestore document snapshot double.
 * @param {string} id - Snapshot ID.
 * @param {object} data - Snapshot data.
 * @param {boolean} [exists] - Whether the snapshot exists.
 * @returns {{ id: string, exists: () => boolean, data: () => object }} Snapshot double.
 */
function snapshot(id, data, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => data,
  };
}

/**
 * Build a minimal Firestore query snapshot double.
 * @param {Array<object>} docs - Query document snapshots.
 * @returns {{ docs: Array<object> }} Query snapshot double.
 */
function querySnapshot(docs) {
  return { docs };
}

describe('event soft delete repository and use cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.getDoc.mockReset();
    firestoreMocks.getDocs.mockReset();
    firestoreMocks.runTransaction.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T03:04:05.006Z'));
  });

  it('soft deletes only the event document without loading child collections', async () => {
    const { deleteEventTree } = await import('@/repo/client/firebase-events-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(snapshot('event-1', { hostUid: 'host-1' })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deleteEventTree('event-1', { uid: 'host-1' })).resolves.toEqual({
      ok: true,
      status: 'deleted',
    });

    const eventRef = { kind: 'doc', path: [{ kind: 'db' }, 'events', 'event-1'] };

    expect(tx.update).toHaveBeenCalledWith(
      eventRef,
      {
        deletedAt: { kind: 'serverTimestamp' },
        deletedByUid: 'host-1',
        deletedPurgeAt: { kind: 'timestamp', iso: '2026-08-26T03:04:05.006Z' },
      },
    );
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.update.mock.calls.map(([ref]) => ref)).toEqual([eventRef]);
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('rejects active event delete from a non-host actor without soft deleting', async () => {
    const { deleteEventTree } = await import('@/repo/client/firebase-events-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(snapshot('event-1', { hostUid: 'host-1' })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deleteEventTree('event-1', { uid: 'runner-1' })).rejects.toMatchObject({
      message: 'permission-denied',
      code: 'permission-denied',
    });

    expect(tx.update).not.toHaveBeenCalled();
    expect(firestoreMocks.serverTimestamp).not.toHaveBeenCalled();
    expect(firestoreMocks.Timestamp.fromDate).not.toHaveBeenCalled();
  });

  it('treats repeated event delete as a no-op success without rewriting audit fields', async () => {
    const { deleteEventTree } = await import('@/repo/client/firebase-events-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(
        snapshot('event-1', {
          hostUid: 'host-1',
          deletedAt: { seconds: 1 },
          deletedByUid: 'host-1',
          deletedPurgeAt: { seconds: 2 },
        }),
      ),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deleteEventTree('event-1', { uid: 'host-1' })).resolves.toEqual({
      ok: true,
      status: 'already_deleted',
    });

    expect(tx.update).not.toHaveBeenCalled();
    expect(firestoreMocks.serverTimestamp).not.toHaveBeenCalled();
    expect(firestoreMocks.Timestamp.fromDate).not.toHaveBeenCalled();
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('rejects repeated event delete from a non-host actor even after soft delete', async () => {
    const { deleteEventTree } = await import('@/repo/client/firebase-events-repo');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(
        snapshot('event-1', {
          hostUid: 'host-1',
          deletedAt: { seconds: 1 },
          deletedByUid: 'host-1',
          deletedPurgeAt: { seconds: 2 },
        }),
      ),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deleteEventTree('event-1', { uid: 'runner-1' })).rejects.toMatchObject({
      message: 'permission-denied',
      code: 'permission-denied',
    });

    expect(tx.update).not.toHaveBeenCalled();
    expect(firestoreMocks.serverTimestamp).not.toHaveBeenCalled();
    expect(firestoreMocks.Timestamp.fromDate).not.toHaveBeenCalled();
  });

  it('passes the deleting actor through the delete use case', async () => {
    const { deleteEvent } = await import('@/runtime/client/use-cases/event-use-cases');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(snapshot('event-1', { hostUid: 'host-1' })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(deleteEvent('event-1', { uid: 'host-1' })).resolves.toEqual({
      ok: true,
      status: 'deleted',
    });

    expect(tx.update).toHaveBeenCalledWith(
      { kind: 'doc', path: [{ kind: 'db' }, 'events', 'event-1'] },
      expect.objectContaining({ deletedByUid: 'host-1' }),
    );
  });

  it('returns null for a soft-deleted event detail', async () => {
    const { fetchEventById } = await import('@/runtime/client/use-cases/event-use-cases');
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot('event-1', { title: 'Deleted run', deletedAt: { seconds: 1 } }),
    );

    await expect(fetchEventById('event-1')).resolves.toBeNull();
  });

  it('rejects joinEvent on a soft-deleted event before participant reads or writes', async () => {
    const { joinEvent } = await import('@/runtime/client/use-cases/event-use-cases');
    const tx = {
      get: vi
        .fn()
        .mockResolvedValueOnce(
          snapshot('event-1', {
            title: 'Deleted run',
            maxParticipants: 10,
            participantsCount: 1,
            remainingSeats: 9,
            deletedAt: { seconds: 1 },
          }),
        )
        .mockResolvedValueOnce(snapshot('runner-1', {}, false)),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(
      joinEvent('event-1', { uid: 'runner-1', name: 'Runner', photoURL: 'runner.png' }),
    ).rejects.toThrow('活動不存在');

    expect(tx.get).toHaveBeenCalledTimes(1);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('rejects leaveEvent on a soft-deleted event before participant reads or writes', async () => {
    const { leaveEvent } = await import('@/runtime/client/use-cases/event-use-cases');
    const tx = {
      get: vi
        .fn()
        .mockResolvedValueOnce(
          snapshot('event-1', {
            title: 'Deleted run',
            maxParticipants: 10,
            participantsCount: 1,
            remainingSeats: 9,
            deletedAt: { seconds: 1 },
          }),
        )
        .mockResolvedValueOnce(snapshot('runner-1', { uid: 'runner-1' })),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(leaveEvent('event-1', { uid: 'runner-1' })).rejects.toThrow('活動不存在');

    expect(tx.get).toHaveBeenCalledTimes(1);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('rejects updateEvent on a soft-deleted event before updating general fields', async () => {
    const { updateEvent } = await import('@/runtime/client/use-cases/event-use-cases');
    const tx = {
      get: vi.fn().mockResolvedValueOnce(
        snapshot('event-1', {
          title: 'Deleted run',
          hostUid: 'host-1',
          deletedAt: { seconds: 1 },
        }),
      ),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) => callback(tx));

    await expect(updateEvent('event-1', { title: 'Stale edit' })).rejects.toThrow('活動不存在');

    expect(tx.update).not.toHaveBeenCalled();
  });

  it('returns only active events from latest, next, and query event pages', async () => {
    const { fetchLatestEvents, fetchNextEvents, queryEvents } = await import(
      '@/runtime/client/use-cases/event-use-cases'
    );
    const firstActive = snapshot('active-1', { title: 'Active run', time: { seconds: 2 } });
    const deleted = snapshot('deleted-1', {
      title: 'Deleted run',
      time: { seconds: 1 },
      deletedAt: { seconds: 1 },
    });
    const secondActive = snapshot('active-2', { title: 'Next run', time: { seconds: 0 } });
    const queriedActive = snapshot('active-3', { title: 'Queried run', time: { seconds: 3 } });
    const queriedDeleted = snapshot('deleted-2', {
      title: 'Deleted query run',
      time: { seconds: 2 },
      deletedAt: { seconds: 2 },
    });

    firestoreMocks.getDocs
      .mockResolvedValueOnce(querySnapshot([firstActive, deleted]))
      .mockResolvedValueOnce(querySnapshot([deleted, secondActive]))
      .mockResolvedValueOnce(querySnapshot([queriedDeleted, queriedActive]));

    await expect(fetchLatestEvents(10)).resolves.toEqual({
      events: [{ id: 'active-1', title: 'Active run', time: { seconds: 2 } }],
      lastDoc: deleted,
      hasMore: false,
    });
    await expect(
      fetchNextEvents(
        /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (
          /** @type {unknown} */ (firstActive)
        ),
        10,
      ),
    ).resolves.toEqual({
      events: [{ id: 'active-2', title: 'Next run', time: { seconds: 0 } }],
      lastDoc: secondActive,
      hasMore: false,
    });
    await expect(queryEvents()).resolves.toEqual([
      { id: 'active-3', title: 'Queried run', time: { seconds: 3 } },
    ]);
  });

  it('keeps hasMore true when a full raw page contains deleted tombstones', async () => {
    const { fetchLatestEvents } = await import('@/runtime/client/use-cases/event-use-cases');
    const rawDocs = [
      ...Array.from({ length: 9 }, (_, index) =>
        snapshot(`active-${index}`, { title: `Active ${index}`, time: { seconds: index } }),
      ),
      snapshot('deleted-9', {
        title: 'Deleted 9',
        time: { seconds: 9 },
        deletedAt: { seconds: 1 },
      }),
    ];

    firestoreMocks.getDocs.mockResolvedValueOnce(querySnapshot(rawDocs));

    await expect(fetchLatestEvents(10)).resolves.toMatchObject({
      events: rawDocs.slice(0, 9).map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      })),
      lastDoc: rawDocs[9],
      hasMore: true,
    });
  });
});

describe('events page runtime soft-delete pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('keeps loading from a full raw page even when tombstones reduce visible events', async () => {
    vi.resetModules();
    const rawCursor = { id: 'raw-deleted-10' };
    const runtimeMocks = {
      addContentFavorite: vi.fn(),
      fetchLatestEvents: vi.fn().mockResolvedValue({
        events: Array.from({ length: 9 }, (_, index) => ({
          id: `active-${index}`,
          title: `Active ${index}`,
        })),
        lastDoc: rawCursor,
        hasMore: true,
      }),
      fetchNextEvents: vi.fn().mockResolvedValue({
        events: [{ id: 'active-10', title: 'Active 10' }],
        lastDoc: { id: 'raw-active-10' },
        hasMore: false,
      }),
      getFavoritedTargetIds: vi.fn().mockResolvedValue(new Set()),
      removeContentFavorite: vi.fn(),
      replace: vi.fn(),
      showToast: vi.fn(),
    };

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ replace: runtimeMocks.replace }),
      useSearchParams: () => ({ get: vi.fn(() => null) }),
    }));
    vi.doMock('@/runtime/client/use-cases/event-use-cases', () => ({
      fetchLatestEvents: runtimeMocks.fetchLatestEvents,
      fetchNextEvents: runtimeMocks.fetchNextEvents,
    }));
    vi.doMock('@/runtime/client/use-cases/content-favorite-use-cases', () => ({
      FAVORITE_CONTENT_TYPES: { EVENT: 'event' },
      addContentFavorite: runtimeMocks.addContentFavorite,
      getFavoritedTargetIds: runtimeMocks.getFavoritedTargetIds,
      removeContentFavorite: runtimeMocks.removeContentFavorite,
    }));
    vi.doMock('@/runtime/hooks/useEventsFilter', () => ({
      default: vi.fn(() => ({})),
    }));
    vi.doMock('@/runtime/hooks/useEventsPageCreateFormState', () => ({
      default: vi.fn(() => ({
        isFormOpen: false,
        showMap: false,
        routeCoordinates: [],
        routePointCount: 0,
        selectedCity: '',
        selectedDistrict: '',
        selectedDistrictOptions: [],
        minDateTime: '',
        setSelectedDistrict: vi.fn(),
        setRouteCoordinates: vi.fn(),
        resetCreateForm: vi.fn(),
        handleCloseCreateForm: vi.fn(),
        handleSelectedCityChange: vi.fn(),
        handleEnableRoutePlanning: vi.fn(),
        handleDisableRoutePlanning: vi.fn(),
        handleToggleCreateRunForm: vi.fn(),
      })),
    }));
    vi.doMock('@/runtime/hooks/useEventMutations', () => ({
      default: vi.fn(() => ({
        draftFormData: null,
        isCreating: false,
      })),
    }));
    vi.doMock('@/runtime/hooks/useEventParticipation', () => ({
      default: vi.fn(() => ({})),
    }));

    const { AuthContext } = await import('@/runtime/providers/AuthProvider');
    const { ToastContext } = await import('@/runtime/providers/ToastProvider');
    const { default: useEventsPageRuntime } = await import(
      '@/runtime/hooks/useEventsPageRuntime'
    );
    /**
     * Render hook providers.
     * @param {{ children?: import('react').ReactNode }} props - Wrapper props.
     * @returns {import('react').ReactElement} Provider tree.
     */
    const wrapper = ({ children }) =>
      createElement(
        AuthContext.Provider,
        { value: { user: null, setUser: vi.fn(), loading: false } },
        createElement(
          ToastContext.Provider,
          {
            value: {
              toasts: [],
              showToast: runtimeMocks.showToast,
              removeToast: vi.fn(),
            },
          },
          children,
        ),
      );

    const view = renderHook(() => useEventsPageRuntime(), { wrapper });

    await waitFor(() => expect(view.result.current.events).toHaveLength(9));
    expect(view.result.current.hasMore).toBe(true);

    await act(async () => {
      await view.result.current.loadMore();
    });

    expect(runtimeMocks.fetchNextEvents).toHaveBeenCalledWith(rawCursor, 10);
    await waitFor(() => expect(view.result.current.events).toHaveLength(10));
    expect(view.result.current.hasMore).toBe(false);
  });
});

describe('event detail mutation soft delete notification flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('notifies participants before soft-deleting an active detail event', async () => {
    vi.resetModules();
    const runtimeMocks = {
      deleteEvent: vi.fn().mockResolvedValue({ ok: true, status: 'deleted' }),
      fetchParticipants: vi.fn().mockResolvedValue([{ uid: 'runner-1' }]),
      notifyEventCancelled: vi.fn().mockResolvedValue(undefined),
      notifyEventModified: vi.fn(),
      notifyEventNewComment: vi.fn(),
      push: vi.fn(),
      setError: vi.fn(),
      setEvent: vi.fn(),
      showToast: vi.fn(),
      updateEvent: vi.fn(),
    };

    vi.doMock('@/runtime/client/use-cases/event-use-cases', () => ({
      EVENT_NOT_FOUND_MESSAGE: 'Event not found',
      deleteEvent: runtimeMocks.deleteEvent,
      fetchParticipants: runtimeMocks.fetchParticipants,
      updateEvent: runtimeMocks.updateEvent,
    }));
    vi.doMock('@/runtime/client/use-cases/notification-use-cases', () => ({
      notifyEventCancelled: runtimeMocks.notifyEventCancelled,
      notifyEventModified: runtimeMocks.notifyEventModified,
      notifyEventNewComment: runtimeMocks.notifyEventNewComment,
    }));

    const { default: useEventDetailMutations } = await import(
      '@/runtime/hooks/useEventDetailMutations'
    );
    const view = renderHook(() =>
      useEventDetailMutations({
        id: 'event-1',
        event: /** @type {import('@/service/event-service').EventData} */ (
          /** @type {unknown} */ ({ id: 'event-1', title: 'Morning run', hostUid: 'host-1' })
        ),
        setEvent: runtimeMocks.setEvent,
        setError: runtimeMocks.setError,
        router: /** @type {ReturnType<import('next/navigation').useRouter>} */ (
          /** @type {unknown} */ ({ push: runtimeMocks.push })
        ),
        user: { uid: 'host-1', name: 'Host', photoURL: 'host.png' },
        showToast: runtimeMocks.showToast,
        isMountedRef: { current: true },
      }),
    );

    await act(async () => {
      await view.result.current.handleDeleteConfirm('event-1');
    });

    expect(runtimeMocks.fetchParticipants).toHaveBeenCalledWith('event-1');
    expect(runtimeMocks.notifyEventCancelled).toHaveBeenCalledWith(
      'event-1',
      'Morning run',
      [{ uid: 'runner-1' }],
      {
        uid: 'host-1',
        name: 'Host',
        photoURL: 'host.png',
      },
    );
    expect(runtimeMocks.deleteEvent).toHaveBeenCalledWith('event-1', {
      uid: 'host-1',
      name: 'Host',
      photoURL: 'host.png',
    });
    expect(runtimeMocks.notifyEventCancelled.mock.invocationCallOrder[0]).toBeLessThan(
      runtimeMocks.deleteEvent.mock.invocationCallOrder[0],
    );
    expect(runtimeMocks.push).toHaveBeenCalledWith('/events?toast=活動已刪除');
  });

  it('blocks active detail delete when participant lookup for cancellation notification fails', async () => {
    vi.resetModules();
    const runtimeMocks = {
      deleteEvent: vi.fn().mockResolvedValue({ ok: true, status: 'deleted' }),
      fetchParticipants: vi.fn().mockRejectedValue(new Error('participants unavailable')),
      notifyEventCancelled: vi.fn().mockResolvedValue(undefined),
      notifyEventModified: vi.fn(),
      notifyEventNewComment: vi.fn(),
      push: vi.fn(),
      setError: vi.fn(),
      setEvent: vi.fn(),
      showToast: vi.fn(),
      updateEvent: vi.fn(),
    };

    vi.doMock('@/runtime/client/use-cases/event-use-cases', () => ({
      EVENT_NOT_FOUND_MESSAGE: 'Event not found',
      deleteEvent: runtimeMocks.deleteEvent,
      fetchParticipants: runtimeMocks.fetchParticipants,
      updateEvent: runtimeMocks.updateEvent,
    }));
    vi.doMock('@/runtime/client/use-cases/notification-use-cases', () => ({
      notifyEventCancelled: runtimeMocks.notifyEventCancelled,
      notifyEventModified: runtimeMocks.notifyEventModified,
      notifyEventNewComment: runtimeMocks.notifyEventNewComment,
    }));

    const { default: useEventDetailMutations } = await import(
      '@/runtime/hooks/useEventDetailMutations'
    );
    const view = renderHook(() =>
      useEventDetailMutations({
        id: 'event-1',
        event: /** @type {import('@/service/event-service').EventData} */ (
          /** @type {unknown} */ ({ id: 'event-1', title: 'Morning run', hostUid: 'host-1' })
        ),
        setEvent: runtimeMocks.setEvent,
        setError: runtimeMocks.setError,
        router: /** @type {ReturnType<import('next/navigation').useRouter>} */ (
          /** @type {unknown} */ ({ push: runtimeMocks.push })
        ),
        user: { uid: 'host-1', name: 'Host', photoURL: 'host.png' },
        showToast: runtimeMocks.showToast,
        isMountedRef: { current: true },
      }),
    );

    await act(async () => {
      await view.result.current.handleDeleteConfirm('event-1');
    });

    expect(runtimeMocks.fetchParticipants).toHaveBeenCalledWith('event-1');
    expect(runtimeMocks.notifyEventCancelled).not.toHaveBeenCalled();
    expect(runtimeMocks.deleteEvent).not.toHaveBeenCalled();
    expect(runtimeMocks.push).not.toHaveBeenCalled();
    expect(runtimeMocks.showToast).toHaveBeenCalledWith(
      '刪除活動失敗，請稍後再試',
      'error',
    );
  });

  it('blocks active detail delete when cancellation notification write fails', async () => {
    vi.resetModules();
    const runtimeMocks = {
      deleteEvent: vi.fn().mockResolvedValue({ ok: true, status: 'deleted' }),
      fetchParticipants: vi.fn().mockResolvedValue([{ uid: 'runner-1' }]),
      notifyEventCancelled: vi.fn().mockRejectedValue(new Error('notification unavailable')),
      notifyEventModified: vi.fn(),
      notifyEventNewComment: vi.fn(),
      push: vi.fn(),
      setError: vi.fn(),
      setEvent: vi.fn(),
      showToast: vi.fn(),
      updateEvent: vi.fn(),
    };

    vi.doMock('@/runtime/client/use-cases/event-use-cases', () => ({
      EVENT_NOT_FOUND_MESSAGE: 'Event not found',
      deleteEvent: runtimeMocks.deleteEvent,
      fetchParticipants: runtimeMocks.fetchParticipants,
      updateEvent: runtimeMocks.updateEvent,
    }));
    vi.doMock('@/runtime/client/use-cases/notification-use-cases', () => ({
      notifyEventCancelled: runtimeMocks.notifyEventCancelled,
      notifyEventModified: runtimeMocks.notifyEventModified,
      notifyEventNewComment: runtimeMocks.notifyEventNewComment,
    }));

    const { default: useEventDetailMutations } = await import(
      '@/runtime/hooks/useEventDetailMutations'
    );
    const view = renderHook(() =>
      useEventDetailMutations({
        id: 'event-1',
        event: /** @type {import('@/service/event-service').EventData} */ (
          /** @type {unknown} */ ({ id: 'event-1', title: 'Morning run', hostUid: 'host-1' })
        ),
        setEvent: runtimeMocks.setEvent,
        setError: runtimeMocks.setError,
        router: /** @type {ReturnType<import('next/navigation').useRouter>} */ (
          /** @type {unknown} */ ({ push: runtimeMocks.push })
        ),
        user: { uid: 'host-1', name: 'Host', photoURL: 'host.png' },
        showToast: runtimeMocks.showToast,
        isMountedRef: { current: true },
      }),
    );

    await act(async () => {
      await view.result.current.handleDeleteConfirm('event-1');
    });

    expect(runtimeMocks.fetchParticipants).toHaveBeenCalledWith('event-1');
    expect(runtimeMocks.notifyEventCancelled).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.deleteEvent).not.toHaveBeenCalled();
    expect(runtimeMocks.push).not.toHaveBeenCalled();
    expect(runtimeMocks.showToast).toHaveBeenCalledWith(
      '刪除活動失敗，請稍後再試',
      'error',
    );
  });

  it('blocks non-host detail delete before participant lookup or cancellation notification', async () => {
    vi.resetModules();
    const runtimeMocks = {
      deleteEvent: vi.fn().mockResolvedValue({ ok: true, status: 'deleted' }),
      fetchParticipants: vi.fn().mockResolvedValue([{ uid: 'runner-1' }]),
      notifyEventCancelled: vi.fn().mockResolvedValue(undefined),
      notifyEventModified: vi.fn(),
      notifyEventNewComment: vi.fn(),
      push: vi.fn(),
      setError: vi.fn(),
      setEvent: vi.fn(),
      showToast: vi.fn(),
      updateEvent: vi.fn(),
    };

    vi.doMock('@/runtime/client/use-cases/event-use-cases', () => ({
      EVENT_NOT_FOUND_MESSAGE: 'Event not found',
      deleteEvent: runtimeMocks.deleteEvent,
      fetchParticipants: runtimeMocks.fetchParticipants,
      updateEvent: runtimeMocks.updateEvent,
    }));
    vi.doMock('@/runtime/client/use-cases/notification-use-cases', () => ({
      notifyEventCancelled: runtimeMocks.notifyEventCancelled,
      notifyEventModified: runtimeMocks.notifyEventModified,
      notifyEventNewComment: runtimeMocks.notifyEventNewComment,
    }));

    const { default: useEventDetailMutations } = await import(
      '@/runtime/hooks/useEventDetailMutations'
    );
    const view = renderHook(() =>
      useEventDetailMutations({
        id: 'event-1',
        event: /** @type {import('@/service/event-service').EventData} */ (
          /** @type {unknown} */ ({ id: 'event-1', title: 'Morning run', hostUid: 'host-1' })
        ),
        setEvent: runtimeMocks.setEvent,
        setError: runtimeMocks.setError,
        router: /** @type {ReturnType<import('next/navigation').useRouter>} */ (
          /** @type {unknown} */ ({ push: runtimeMocks.push })
        ),
        user: { uid: 'runner-1', name: 'Runner', photoURL: 'runner.png' },
        showToast: runtimeMocks.showToast,
        isMountedRef: { current: true },
      }),
    );

    await act(async () => {
      await view.result.current.handleDeleteConfirm('event-1');
    });

    expect(runtimeMocks.fetchParticipants).not.toHaveBeenCalled();
    expect(runtimeMocks.notifyEventCancelled).not.toHaveBeenCalled();
    expect(runtimeMocks.deleteEvent).not.toHaveBeenCalled();
    expect(runtimeMocks.push).not.toHaveBeenCalled();
    expect(runtimeMocks.showToast).toHaveBeenCalledWith(
      '刪除活動失敗，請稍後再試',
      'error',
    );
  });
});

describe('event list mutation soft delete actor forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('passes the current host actor when deleting from the events list', async () => {
    vi.resetModules();
    vi.doUnmock('@/runtime/hooks/useEventMutations');
    const runtimeMocks = {
      createEvent: vi.fn(),
      deleteEvent: vi.fn().mockResolvedValue({ ok: true, status: 'deleted' }),
      setEvents: vi.fn(),
      showToast: vi.fn(),
      updateEvent: vi.fn(),
    };

    vi.doMock('@/runtime/client/use-cases/event-use-cases', () => ({
      createEvent: runtimeMocks.createEvent,
      deleteEvent: runtimeMocks.deleteEvent,
      updateEvent: runtimeMocks.updateEvent,
    }));

    const { default: useEventMutations } = await import('@/runtime/hooks/useEventMutations');
    const view = renderHook(() =>
      useEventMutations({
        isMountedRef: { current: true },
        setEvents: runtimeMocks.setEvents,
        showToast: runtimeMocks.showToast,
        createCtx: {
          hostUid: 'host-1',
          hostName: 'Host',
          hostPhotoURL: 'host.png',
          routeCoordinates: null,
          resetCreateForm: vi.fn(),
        },
      }),
    );

    await act(async () => {
      await view.result.current.handleDeleteConfirm('event-1');
    });

    expect(runtimeMocks.deleteEvent).toHaveBeenCalledWith('event-1', {
      uid: 'host-1',
      name: 'Host',
      photoURL: 'host.png',
    });
    expect(runtimeMocks.showToast).toHaveBeenCalledWith('活動已刪除');
  });
});

describe('event detail runtime soft-deleted reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('does not load participants when the event detail read resolves as deleted', async () => {
    vi.resetModules();
    const runtimeMocks = {
      addContentFavorite: vi.fn(),
      deleteEvent: vi.fn(),
      fetchEventById: vi.fn().mockResolvedValue(null),
      fetchMyJoinedEventsForIds: vi.fn(),
      fetchParticipants: vi.fn(),
      getFavoritedTargetIds: vi.fn().mockResolvedValue(new Set()),
      joinEvent: vi.fn(),
      leaveEvent: vi.fn(),
      notifyEventCancelled: vi.fn(),
      notifyEventModified: vi.fn(),
      notifyEventNewComment: vi.fn(),
      removeContentFavorite: vi.fn(),
      routerPush: vi.fn(),
      showToast: vi.fn(),
      updateEvent: vi.fn(),
    };

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: runtimeMocks.routerPush }),
    }));
    vi.doMock('@/runtime/client/use-cases/event-use-cases', () => ({
      EVENT_NOT_FOUND_MESSAGE: 'Event not found',
      deleteEvent: runtimeMocks.deleteEvent,
      fetchEventById: runtimeMocks.fetchEventById,
      fetchMyJoinedEventsForIds: runtimeMocks.fetchMyJoinedEventsForIds,
      fetchParticipants: runtimeMocks.fetchParticipants,
      joinEvent: runtimeMocks.joinEvent,
      leaveEvent: runtimeMocks.leaveEvent,
      updateEvent: runtimeMocks.updateEvent,
    }));
    vi.doMock('@/runtime/client/use-cases/content-favorite-use-cases', () => ({
      FAVORITE_CONTENT_TYPES: { EVENT: 'event' },
      addContentFavorite: runtimeMocks.addContentFavorite,
      getFavoritedTargetIds: runtimeMocks.getFavoritedTargetIds,
      removeContentFavorite: runtimeMocks.removeContentFavorite,
    }));
    vi.doMock('@/runtime/client/use-cases/notification-use-cases', () => ({
      notifyEventCancelled: runtimeMocks.notifyEventCancelled,
      notifyEventModified: runtimeMocks.notifyEventModified,
      notifyEventNewComment: runtimeMocks.notifyEventNewComment,
    }));
    vi.doMock('@/runtime/events/event-detail-participation-runtime-helpers', () => ({
      default: vi.fn(() => undefined),
    }));
    const commentSectionMock = vi.fn(() =>
      createElement('div', { 'data-testid': 'event-comments' }, 'comments'),
    );
    vi.doMock('@/components/CommentSection', () => ({
      default: commentSectionMock,
    }));

    const { AuthContext } = await import('@/runtime/providers/AuthProvider');
    const { ToastContext } = await import('@/runtime/providers/ToastProvider');
    const { default: EventDetailScreen } = await import('@/ui/events/EventDetailScreen');
    const { default: useEventDetailRuntime } = await import(
      '@/runtime/hooks/useEventDetailRuntime'
    );
    const authUser = {
      uid: 'host-1',
      name: 'Host',
      email: 'host@example.com',
      photoURL: '',
      bio: null,
      accountStatus: 'active',
      deletionScheduledFor: null,
      getIdToken: vi.fn().mockResolvedValue('token'),
    };
    /**
     * Render hook providers.
     * @param {{ children?: import('react').ReactNode }} props - Wrapper props.
     * @returns {import('react').ReactElement} Provider tree.
     */
    const wrapper = ({ children }) =>
      createElement(
        AuthContext.Provider,
        {
          value: {
            user: authUser,
            setUser: vi.fn(),
            loading: false,
          },
        },
        createElement(
          ToastContext.Provider,
          {
            value: {
              toasts: [],
              showToast: runtimeMocks.showToast,
              removeToast: vi.fn(),
            },
          },
          children,
        ),
      );

    const view = renderHook(() => useEventDetailRuntime('event-1'), { wrapper });

    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current.event).toBeNull();
    expect(view.result.current.error).toBe('找不到這個活動（可能已被刪除）');
    expect(runtimeMocks.fetchEventById).toHaveBeenCalledWith('event-1');
    expect(runtimeMocks.fetchParticipants).not.toHaveBeenCalled();
    expect(runtimeMocks.fetchMyJoinedEventsForIds).not.toHaveBeenCalled();

    render(
      createElement(EventDetailScreen, { id: 'event-1', runtime: view.result.current }),
    );
    expect(commentSectionMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('event-comments')).toBeNull();

    act(() => {
      view.unmount();
    });
  });
});
