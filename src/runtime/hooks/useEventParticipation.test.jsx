/* eslint-disable jsdoc/require-jsdoc -- Focused hook tests use local doubles. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  fetchMyJoinedEventsForIds,
  joinEvent,
  leaveEvent,
} from '@/runtime/client/use-cases/event-use-cases';
import { notifyEventHostJoined } from '@/runtime/client/use-cases/notification-use-cases';
import useEventParticipation from './useEventParticipation';

vi.mock('@/runtime/client/use-cases/event-use-cases', () => ({
  fetchMyJoinedEventsForIds: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/notification-use-cases', () => ({
  notifyEventHostJoined: vi.fn(),
}));

const fetchMyJoinedEventsForIdsMock = vi.mocked(fetchMyJoinedEventsForIds);
const joinEventMock = vi.mocked(joinEvent);
const leaveEventMock = vi.mocked(leaveEvent);
const notifyEventHostJoinedMock = vi.mocked(notifyEventHostJoined);

const user = {
  uid: 'runner-1',
  name: '小明',
  email: 'runner@example.com',
  photoURL: 'runner.png',
};

const event = {
  id: 'event-1',
  title: '週末晨跑',
  hostUid: 'host-1',
  maxParticipants: 5,
  participantsCount: 1,
  remainingSeats: 4,
};

const actorPayload = {
  uid: 'runner-1',
  name: '小明',
  photoURL: 'runner.png',
};

const clickEvent = {
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
};

function renderParticipation(options = {}) {
  const showToast = vi.fn();
  const isMountedRef = { current: true };
  const initialEvents = options.events ?? [event];
  const currentUser = options.user ?? user;

  const view = renderHook(() => {
    const [events, setEvents] = useState(initialEvents);
    const participation = useEventParticipation({
      user: currentUser,
      events,
      isMountedRef,
      setEvents,
      showToast,
    });

    return {
      events,
      participation,
    };
  });

  return { ...view, showToast, isMountedRef };
}

async function joinFromList(view, eventRecord = event) {
  await waitFor(() =>
    expect(
      view.result.current.participation.membershipStatusByEventId[String(eventRecord.id)],
    ).toBe('notJoined'),
  );

  await act(async () => {
    await view.result.current.participation.handleJoinClick(eventRecord, clickEvent);
  });
}

async function leaveFromList(view, eventRecord = event) {
  await waitFor(() =>
    expect(
      view.result.current.participation.membershipStatusByEventId[String(eventRecord.id)],
    ).toBe('notJoined'),
  );

  await act(async () => {
    await view.result.current.participation.handleLeaveClick(eventRecord, clickEvent);
  });
}

describe('useEventParticipation host join notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMyJoinedEventsForIdsMock.mockResolvedValue(new Set());
    joinEventMock.mockResolvedValue({ ok: true, status: 'joined' });
    leaveEventMock.mockResolvedValue({ ok: true, status: 'left' });
    notifyEventHostJoinedMock.mockResolvedValue(undefined);
  });

  test('notifies the event host after a newly joined list-page signup succeeds', async () => {
    const view = renderParticipation();

    await joinFromList(view);

    expect(joinEventMock).toHaveBeenCalledWith('event-1', actorPayload);
    expect(notifyEventHostJoinedMock).toHaveBeenCalledTimes(1);
    expect(notifyEventHostJoinedMock).toHaveBeenCalledWith(
      'event-1',
      '週末晨跑',
      'host-1',
      actorPayload,
    );
    expect(view.showToast).toHaveBeenCalledWith('報名成功');
    expect(view.result.current.events[0]).toMatchObject({
      participantsCount: 2,
      remainingSeats: 3,
    });
  });

  test('does not notify for an already joined list-page result', async () => {
    joinEventMock.mockResolvedValue({ ok: true, status: 'already_joined' });
    const view = renderParticipation();

    await joinFromList(view);

    expect(notifyEventHostJoinedMock).not.toHaveBeenCalled();
    expect(view.showToast).toHaveBeenCalledWith('報名成功');
  });

  test('does not notify for a full list-page result', async () => {
    joinEventMock.mockResolvedValue({ ok: false, status: 'full' });
    const view = renderParticipation();

    await joinFromList(view);

    expect(notifyEventHostJoinedMock).not.toHaveBeenCalled();
    expect(view.showToast).toHaveBeenCalledWith('本活動已額滿', 'error');
  });

  test('does not notify for a failed list-page result', async () => {
    joinEventMock.mockResolvedValue(/** @type {any} */ ({ ok: false, status: 'failed' }));
    const view = renderParticipation();

    await joinFromList(view);

    expect(notifyEventHostJoinedMock).not.toHaveBeenCalled();
    expect(view.showToast).toHaveBeenCalledWith('報名失敗，請再試一次', 'error');
  });

  test('does not notify when leaving from the list page', async () => {
    const view = renderParticipation();

    await leaveFromList(view);

    expect(leaveEventMock).toHaveBeenCalledWith('event-1', actorPayload);
    expect(notifyEventHostJoinedMock).not.toHaveBeenCalled();
    expect(view.showToast).toHaveBeenCalledWith('已成功取消報名');
    expect(view.result.current.participation.myJoinedEventIds.has('event-1')).toBe(false);
    expect(view.result.current.participation.membershipStatusByEventId['event-1']).toBe(
      'notJoined',
    );
    expect(view.result.current.events[0]).toMatchObject({
      participantsCount: 0,
      remainingSeats: 5,
    });
  });

  test('does not join or notify when the signed-in user is the host', async () => {
    const hostEvent = { ...event, hostUid: 'runner-1' };
    const view = renderParticipation({ events: [hostEvent] });

    await joinFromList(view, hostEvent);

    expect(joinEventMock).not.toHaveBeenCalled();
    expect(notifyEventHostJoinedMock).not.toHaveBeenCalled();
  });

  test('logs notification rejection without blocking list-page join success', async () => {
    const notifyError = new Error('notification failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    notifyEventHostJoinedMock.mockRejectedValue(notifyError);
    const view = renderParticipation();

    await joinFromList(view);

    expect(view.showToast).toHaveBeenCalledWith('報名成功');
    expect(view.showToast).not.toHaveBeenCalledWith('報名失敗，請再試一次', 'error');
    expect(view.result.current.participation.myJoinedEventIds.has('event-1')).toBe(true);
    expect(view.result.current.participation.membershipStatusByEventId['event-1']).toBe('joined');
    expect(view.result.current.events[0]).toMatchObject({
      participantsCount: 2,
      remainingSeats: 3,
    });
    await waitFor(() =>
      expect(consoleErrorSpy).toHaveBeenCalledWith('建立主揪報名通知失敗:', notifyError),
    );
    consoleErrorSpy.mockRestore();
  });
});
