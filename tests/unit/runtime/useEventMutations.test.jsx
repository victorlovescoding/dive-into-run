// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventMutations from '../../../src/runtime/hooks/useEventMutations';

const startedLockReason = '活動已開始，無法編輯或刪除。';

const mocks = vi.hoisted(() => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock('../../../src/runtime/client/use-cases/event-use-cases', () => ({
  createEvent: mocks.createEvent,
  deleteEvent: mocks.deleteEvent,
  updateEvent: mocks.updateEvent,
}));

/**
 * Render list mutation hook with mutation collaborators.
 * @param {object} [root0] - Render options.
 * @param {string} [root0.hostUid] - Current actor UID injected through create context.
 * @returns {ReturnType<typeof renderHook> & {
 *   setEvents: import('vitest').Mock,
 *   showToast: import('vitest').Mock
 * }} Rendered hook and spies.
 */
function renderUseEventMutations({ hostUid = 'host-1' } = {}) {
  const setEvents = vi.fn();
  const showToast = vi.fn();
  const view = renderHook(() =>
    useEventMutations({
      isMountedRef: { current: true },
      setEvents,
      showToast,
      createCtx: {
        hostUid,
        hostName: '主揪一號',
        hostPhotoURL: 'https://example.test/host.png',
        routeCoordinates: null,
        resetCreateForm: vi.fn(),
      },
    }),
  );

  return { ...view, setEvents, showToast };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteEvent.mockResolvedValue({ ok: true, status: 'deleted', startedLock: null });
  mocks.updateEvent.mockResolvedValue({ ok: true, startedLock: null });
});

describe('useEventMutations permission-priority list mutations', () => {
  it('keeps non-host edit attempts on started events on the permission error path', async () => {
    mocks.updateEvent.mockResolvedValueOnce({
      ok: false,
      startedLock: {
        code: 'event_started_lock',
        status: 'started_locked',
        message: startedLockReason,
      },
    });
    const { result, setEvents, showToast } = renderUseEventMutations({ hostUid: 'runner-2' });
    const startedEvent = {
      id: 'event-1',
      hostUid: 'host-1',
      title: '已開始活動',
      time: '2026-07-01T10:00:00.000Z',
      registrationDeadline: '2026-07-01T09:00:00.000Z',
    };

    act(() => {
      result.current.handleEditEvent(startedEvent);
    });
    await act(async () => {
      await result.current.handleEditSubmit({
        id: 'event-1',
        title: '非主揪不應更新',
      });
    });

    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(setEvents).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('更新活動失敗，請稍後再試', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('更新活動成功');
    expect(result.current.editingEvent).toBe(startedEvent);
  });

  it('keeps unauthenticated edit attempts on started events on the sign-in error path', async () => {
    const { result, setEvents, showToast } = renderUseEventMutations({ hostUid: '' });
    const startedEvent = {
      id: 'event-1',
      hostUid: 'host-1',
      title: '已開始活動',
      time: '2026-07-01T10:00:00.000Z',
      registrationDeadline: '2026-07-01T09:00:00.000Z',
    };

    act(() => {
      result.current.handleEditEvent(startedEvent);
    });
    await act(async () => {
      await result.current.handleEditSubmit({
        id: 'event-1',
        title: '未登入不應更新',
      });
    });

    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(setEvents).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('編輯活動前請先登入', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('更新活動成功');
    expect(result.current.editingEvent).toBe(startedEvent);
  });

  it('keeps non-host delete attempts on started events on the permission error path', async () => {
    mocks.deleteEvent.mockResolvedValueOnce({
      ok: false,
      status: 'started_locked',
      startedLock: {
        code: 'event_started_lock',
        status: 'started_locked',
        message: startedLockReason,
      },
    });
    const { result, setEvents, showToast } = renderUseEventMutations({ hostUid: 'runner-2' });

    act(() => {
      result.current.handleDeleteEventRequest({ id: 'event-1', hostUid: 'host-1' });
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(setEvents).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('刪除活動失敗，請稍後再試', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('活動已刪除');
    expect(result.current.deletingEventId).toBe('event-1');
  });

  it('keeps unauthenticated delete attempts on started events on the sign-in error path', async () => {
    const { result, setEvents, showToast } = renderUseEventMutations({ hostUid: '' });

    act(() => {
      result.current.handleDeleteEventRequest({ id: 'event-1', hostUid: 'host-1' });
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(setEvents).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('刪除活動前請先登入', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('活動已刪除');
    expect(result.current.deletingEventId).toBe('event-1');
  });
});

describe('useEventMutations edit stale started-lock handling', () => {
  it('surfaces started-lock rejection without success toast or local list update', async () => {
    mocks.updateEvent.mockResolvedValue({
      ok: false,
      startedLock: {
        code: 'event_started_lock',
        status: 'started_locked',
        message: startedLockReason,
      },
    });
    const { result, setEvents, showToast } = renderUseEventMutations();
    const originalEvent = {
      id: 'event-1',
      title: '原本活動',
      time: '2026-07-01T10:00:00.000Z',
      registrationDeadline: '2026-07-01T09:00:00.000Z',
    };

    act(() => {
      result.current.handleEditEvent(originalEvent);
    });
    await act(async () => {
      await result.current.handleEditSubmit({
        id: 'event-1',
        title: '不應套用的活動標題',
      });
    });

    expect(mocks.updateEvent).toHaveBeenCalledWith(
      'event-1',
      {
        title: '不應套用的活動標題',
      },
      {
        uid: 'host-1',
      },
    );
    expect(setEvents).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('更新活動成功');
    expect(result.current.editingEvent).toBe(originalEvent);
  });
});

describe('useEventMutations delete stale started-lock handling', () => {
  it('keeps list event active when delete resolves with started-lock metadata', async () => {
    mocks.deleteEvent.mockResolvedValueOnce({
      ok: false,
      status: 'started_locked',
      startedLock: {
        code: 'event_started_lock',
        status: 'started_locked',
        message: startedLockReason,
      },
    });
    const { result, setEvents, showToast } = renderUseEventMutations();

    act(() => {
      result.current.handleDeleteEventRequest({ id: 'event-1' });
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).toHaveBeenCalledWith('event-1', {
      uid: 'host-1',
      name: '主揪一號',
      photoURL: 'https://example.test/host.png',
    });
    expect(setEvents).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('活動已刪除');
    expect(result.current.deletingEventId).toBe('event-1');
  });

  it('keeps list event active when delete throws a started-lock service error', async () => {
    mocks.deleteEvent.mockRejectedValueOnce(
      Object.assign(new Error(startedLockReason), { code: 'event_started_lock' }),
    );
    const { result, setEvents, showToast } = renderUseEventMutations();

    act(() => {
      result.current.handleDeleteEventRequest({ id: 'event-1' });
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(setEvents).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('活動已刪除');
    expect(result.current.deletingEventId).toBe('event-1');
  });
});
