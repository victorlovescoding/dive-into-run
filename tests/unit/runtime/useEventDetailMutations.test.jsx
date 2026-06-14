// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventDetailMutations from '../../../src/runtime/hooks/useEventDetailMutations';

const startedLockReason = '活動已開始，無法編輯或刪除。';

const mocks = vi.hoisted(() => ({
  deleteEvent: vi.fn(),
  fetchParticipants: vi.fn(),
  notifyEventCancelled: vi.fn(),
  notifyEventModified: vi.fn(),
  notifyEventNewComment: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock('../../../src/config/client/firebase-timestamp', () => ({
  createFirestoreTimestamp: (value) => ({
    toDate: () => value,
  }),
}));

vi.mock('../../../src/runtime/client/use-cases/event-use-cases', () => ({
  deleteEvent: mocks.deleteEvent,
  EVENT_NOT_FOUND_MESSAGE: '找不到活動',
  EVENT_STARTED_LOCK_METADATA: {
    code: 'event_started_lock',
    status: 'started_locked',
    message: '活動已開始，無法編輯或刪除。',
  },
  fetchParticipants: mocks.fetchParticipants,
  updateEvent: mocks.updateEvent,
}));

vi.mock('../../../src/runtime/client/use-cases/notification-use-cases', () => ({
  notifyEventCancelled: mocks.notifyEventCancelled,
  notifyEventModified: mocks.notifyEventModified,
  notifyEventNewComment: mocks.notifyEventNewComment,
}));

const hostUser = {
  uid: 'host-1',
  name: '主揪',
  photoURL: 'https://example.test/host.png',
};

const nonHostUser = {
  uid: 'runner-2',
  name: '跑友',
  photoURL: 'https://example.test/runner.png',
};

const event = {
  id: 'event-1',
  title: '晨跑',
  hostUid: 'host-1',
  time: '2026-07-01T10:00:00.000Z',
  registrationDeadline: '2026-06-30T10:00:00.000Z',
  route: { name: '河濱' },
};

const startedEvent = {
  ...event,
  time: '2026-01-01T10:00:00.000Z',
  registrationDeadline: '2025-12-31T10:00:00.000Z',
};

/**
 * Renders detail mutation hook with stable collaborators.
 * @param {object} [options] - Render overrides for permission scenarios.
 * @param {typeof event} [options.eventOverride] - Event passed into the hook.
 * @param {typeof hostUser | null} [options.userOverride] - User passed into the hook.
 * @returns {ReturnType<typeof renderHook> & {
 *   router: { push: ReturnType<typeof vi.fn> },
 *   setError: ReturnType<typeof vi.fn>,
 *   setEvent: ReturnType<typeof vi.fn>,
 *   showToast: ReturnType<typeof vi.fn>
 * }} Rendered hook utilities and mocked collaborators.
 */
function renderUseEventDetailMutations({ eventOverride = event, userOverride = hostUser } = {}) {
  const router = { push: vi.fn() };
  const setError = vi.fn();
  const setEvent = vi.fn();
  const showToast = vi.fn();

  const view = renderHook(() =>
    useEventDetailMutations({
      id: 'event-1',
      event: eventOverride,
      setEvent,
      setError,
      router,
      user: userOverride,
      showToast,
      isMountedRef: { current: true },
    }),
  );

  return { ...view, router, setError, setEvent, showToast };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.deleteEvent.mockResolvedValue({ ok: true, startedLock: null });
  mocks.fetchParticipants.mockResolvedValue([]);
  mocks.notifyEventCancelled.mockResolvedValue(undefined);
  mocks.notifyEventModified.mockResolvedValue(undefined);
  mocks.notifyEventNewComment.mockResolvedValue(undefined);
  mocks.updateEvent.mockResolvedValue({ ok: true, startedLock: null });
});

describe('useEventDetailMutations edit started-lock handling', () => {
  it('keeps non-host edit attempts permission-first instead of surfacing started-lock', async () => {
    mocks.updateEvent.mockResolvedValueOnce({
      ok: false,
      startedLock: { message: startedLockReason },
    });
    const { result, setEvent, showToast } = renderUseEventDetailMutations({
      eventOverride: startedEvent,
      userOverride: nonHostUser,
    });

    act(() => {
      result.current.handleEditEvent(startedEvent);
    });
    await act(async () => {
      await result.current.handleEditSubmit({
        id: 'event-1',
        title: '非主揪不可修改',
      });
    });

    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('更新活動失敗，請稍後再試', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(mocks.notifyEventModified).not.toHaveBeenCalled();
    expect(setEvent).not.toHaveBeenCalled();
    expect(result.current.editingEvent).toBe(startedEvent);
  });

  it('keeps unauthenticated edit attempts sign-in-first instead of surfacing started-lock', async () => {
    mocks.updateEvent.mockResolvedValueOnce({
      ok: false,
      startedLock: { message: startedLockReason },
    });
    const { result, setEvent, showToast } = renderUseEventDetailMutations({
      eventOverride: startedEvent,
      userOverride: null,
    });

    act(() => {
      result.current.handleEditEvent(startedEvent);
    });
    await act(async () => {
      await result.current.handleEditSubmit({
        id: 'event-1',
        title: '未登入不可修改',
      });
    });

    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('更新活動前請先登入', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(mocks.notifyEventModified).not.toHaveBeenCalled();
    expect(setEvent).not.toHaveBeenCalled();
    expect(result.current.editingEvent).toBe(startedEvent);
  });

  it('keeps stale edit rejection out of success state and local event updates', async () => {
    mocks.updateEvent.mockResolvedValueOnce({
      ok: false,
      startedLock: { message: startedLockReason },
    });
    const { result, setEvent, showToast } = renderUseEventDetailMutations();

    act(() => {
      result.current.handleEditEvent(event);
    });
    await act(async () => {
      await result.current.handleEditSubmit({
        id: 'event-1',
        title: '被 stale submit 擋下的標題',
      });
    });

    expect(mocks.updateEvent).toHaveBeenCalledWith('event-1', {
      title: '被 stale submit 擋下的標題',
    }, {
      uid: 'host-1',
      name: '主揪',
      photoURL: 'https://example.test/host.png',
    });
    expect(showToast).toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('更新活動成功');
    expect(mocks.notifyEventModified).not.toHaveBeenCalled();
    expect(setEvent).not.toHaveBeenCalled();
    expect(result.current.editingEvent).toBe(event);
  });
});

describe('useEventDetailMutations delete started-lock handling', () => {
  it('keeps non-host delete attempts permission-first instead of surfacing started-lock', async () => {
    mocks.deleteEvent.mockResolvedValueOnce({
      ok: false,
      status: 'started_locked',
      startedLock: { message: startedLockReason },
    });
    const { result, router, setError, setEvent, showToast } = renderUseEventDetailMutations({
      eventOverride: startedEvent,
      userOverride: nonHostUser,
    });

    act(() => {
      result.current.handleDeleteEventRequest(startedEvent);
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('刪除活動失敗，請稍後再試', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(mocks.fetchParticipants).not.toHaveBeenCalled();
    expect(mocks.notifyEventCancelled).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(setEvent).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(result.current.deletingEventId).toBe('event-1');
  });

  it('keeps unauthenticated delete attempts sign-in-first instead of surfacing started-lock', async () => {
    mocks.deleteEvent.mockResolvedValueOnce({
      ok: false,
      status: 'started_locked',
      startedLock: { message: startedLockReason },
    });
    const { result, router, setError, setEvent, showToast } = renderUseEventDetailMutations({
      eventOverride: startedEvent,
      userOverride: null,
    });

    act(() => {
      result.current.handleDeleteEventRequest(startedEvent);
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('刪除活動前請先登入', 'error');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
    expect(mocks.fetchParticipants).not.toHaveBeenCalled();
    expect(mocks.notifyEventCancelled).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(setEvent).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(result.current.deletingEventId).toBe('event-1');
  });

  it('keeps stale delete metadata rejection out of cancellation side effects and success state', async () => {
    mocks.deleteEvent.mockResolvedValueOnce({
      ok: false,
      status: 'started_locked',
      startedLock: { message: startedLockReason },
    });
    const { result, router, setError, setEvent, showToast } = renderUseEventDetailMutations();

    act(() => {
      result.current.handleDeleteEventRequest(event);
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).toHaveBeenCalledWith('event-1', {
      uid: 'host-1',
      name: '主揪',
      photoURL: 'https://example.test/host.png',
    });
    expect(mocks.fetchParticipants).not.toHaveBeenCalled();
    expect(mocks.notifyEventCancelled).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(startedLockReason, 'error');
    expect(showToast).not.toHaveBeenCalledWith('活動已刪除');
    expect(router.push).not.toHaveBeenCalled();
    expect(setEvent).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(result.current.deletingEventId).toBe('event-1');
  });

  it('keeps thrown stale delete rejection out of cancellation side effects and success state', async () => {
    mocks.deleteEvent.mockRejectedValueOnce(
      Object.assign(new Error(startedLockReason), { code: 'event_started_lock' }),
    );
    const { result, router, setError, setEvent, showToast } = renderUseEventDetailMutations();

    act(() => {
      result.current.handleDeleteEventRequest(event);
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.fetchParticipants).not.toHaveBeenCalled();
    expect(mocks.notifyEventCancelled).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(startedLockReason, 'error');
    expect(router.push).not.toHaveBeenCalled();
    expect(setEvent).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(result.current.deletingEventId).toBe('event-1');
  });

  it('keeps delete success UX when participant fetch fails after delete succeeds', async () => {
    mocks.fetchParticipants.mockRejectedValueOnce(new Error('participants unavailable'));
    const { result, router, setError, setEvent, showToast } = renderUseEventDetailMutations();

    act(() => {
      result.current.handleDeleteEventRequest(event);
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).toHaveBeenCalledWith('event-1', {
      uid: 'host-1',
      name: '主揪',
      photoURL: 'https://example.test/host.png',
    });
    expect(mocks.notifyEventCancelled).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalledWith('刪除活動失敗，請稍後再試', 'error');
    expect(router.push).toHaveBeenCalledWith('/events?toast=活動已刪除');
    expect(setEvent).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(result.current.deletingEventId).toBe(null);
  });

  it('keeps delete success UX when cancellation notification fails after delete succeeds', async () => {
    mocks.notifyEventCancelled.mockRejectedValueOnce(new Error('notification unavailable'));
    const { result, router, setError, setEvent, showToast } = renderUseEventDetailMutations();

    act(() => {
      result.current.handleDeleteEventRequest(event);
    });
    await act(async () => {
      await result.current.handleDeleteConfirm('event-1');
    });

    expect(mocks.deleteEvent).toHaveBeenCalledWith('event-1', {
      uid: 'host-1',
      name: '主揪',
      photoURL: 'https://example.test/host.png',
    });
    expect(mocks.fetchParticipants).toHaveBeenCalledWith('event-1');
    expect(mocks.notifyEventCancelled).toHaveBeenCalledWith('event-1', '晨跑', [], {
      uid: 'host-1',
      name: '主揪',
      photoURL: 'https://example.test/host.png',
    });
    expect(showToast).not.toHaveBeenCalledWith('刪除活動失敗，請稍後再試', 'error');
    expect(router.push).toHaveBeenCalledWith('/events?toast=活動已刪除');
    expect(setEvent).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(result.current.deletingEventId).toBe(null);
  });
});
