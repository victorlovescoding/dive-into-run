// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventDetailParticipation from '../../../src/runtime/hooks/useEventDetailParticipation';

const startedLockReason = '活動已開始，無法編輯或刪除。';

const mocks = vi.hoisted(() => ({
  fetchMyJoinedEventsForIds: vi.fn(),
  fetchParticipants: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  notifyEventHostJoined: vi.fn(),
}));

vi.mock('../../../src/runtime/client/use-cases/event-use-cases', () => ({
  fetchMyJoinedEventsForIds: mocks.fetchMyJoinedEventsForIds,
  fetchParticipants: mocks.fetchParticipants,
  joinEvent: mocks.joinEvent,
  leaveEvent: mocks.leaveEvent,
}));

vi.mock('../../../src/runtime/client/use-cases/notification-use-cases', () => ({
  notifyEventHostJoined: mocks.notifyEventHostJoined,
}));

const runner = {
  uid: 'runner-1',
  name: '跑者一號',
  photoURL: 'https://example.test/runner.png',
};

const startedEvent = {
  id: 'event-1',
  title: '已開始晨跑',
  hostUid: 'host-1',
  time: '2026-01-01T10:00:00.000Z',
  registrationDeadline: '2026-12-31T10:00:00.000Z',
  maxParticipants: 5,
  participantsCount: 1,
  remainingSeats: 4,
};

const runnerParticipant = {
  id: 'runner-1',
  uid: 'runner-1',
  name: '跑者一號',
  photoURL: 'https://example.test/runner.png',
  eventId: 'event-1',
};

/**
 * Renders participation hook with a mutable event setter spy.
 * @param {object} [options] - Render options.
 * @param {typeof startedEvent} [options.eventOverride] - Event fixture passed to the hook.
 * @returns {ReturnType<typeof renderHook> & {
 *   getCurrentEvent: () => typeof startedEvent,
 *   setEvent: import('vitest').Mock,
 *   showToast: import('vitest').Mock
 * }} Rendered hook and collaborators.
 */
function renderUseEventDetailParticipation({ eventOverride = startedEvent } = {}) {
  let currentEvent = eventOverride;
  const isMountedRef = { current: true };
  const setEvent = vi.fn((updater) => {
    currentEvent = updater(currentEvent);
  });
  const showToast = vi.fn();
  const view = renderHook(() =>
    useEventDetailParticipation({
      id: 'event-1',
      event: currentEvent,
      setEvent,
      user: runner,
      showToast,
      isMountedRef,
    }),
  );

  return {
    ...view,
    getCurrentEvent: () => currentEvent,
    setEvent,
    showToast,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchParticipants.mockResolvedValue([]);
  mocks.fetchMyJoinedEventsForIds.mockResolvedValue(new Set());
  mocks.joinEvent.mockResolvedValue({ ok: true, status: 'joined' });
  mocks.leaveEvent.mockResolvedValue({ ok: true, status: 'left' });
  mocks.notifyEventHostJoined.mockResolvedValue(undefined);
});

describe('useEventDetailParticipation started event participation', () => {
  it('keeps join behavior available for started events when existing rules allow joining', async () => {
    const { result, getCurrentEvent, showToast } = renderUseEventDetailParticipation();

    await waitFor(() => {
      expect(mocks.fetchParticipants).toHaveBeenCalledWith('event-1', 200);
      expect(mocks.fetchMyJoinedEventsForIds).toHaveBeenCalledWith('runner-1', ['event-1']);
      expect(result.current.isJoined).toBe(false);
    });

    await act(async () => {
      await result.current.handleJoin();
    });

    expect(mocks.joinEvent).toHaveBeenCalledWith('event-1', {
      uid: 'runner-1',
      name: '跑者一號',
      photoURL: 'https://example.test/runner.png',
    });
    expect(result.current.isJoined).toBe(true);
    expect(result.current.participants).toEqual([runnerParticipant]);
    expect(getCurrentEvent()).toEqual({
      ...startedEvent,
      participantsCount: 2,
      remainingSeats: 3,
    });
    expect(mocks.notifyEventHostJoined).toHaveBeenCalledWith(
      'event-1',
      '已開始晨跑',
      'host-1',
      {
        uid: 'runner-1',
        name: '跑者一號',
        photoURL: 'https://example.test/runner.png',
      },
    );
    expect(showToast).toHaveBeenCalledWith('報名成功');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
  });

  it('keeps leave behavior available for started events when existing rules allow leaving', async () => {
    mocks.fetchParticipants.mockResolvedValueOnce([runnerParticipant]);
    mocks.fetchMyJoinedEventsForIds.mockResolvedValueOnce(new Set(['event-1']));
    const { result, getCurrentEvent, showToast } = renderUseEventDetailParticipation({
      eventOverride: {
        ...startedEvent,
        participantsCount: 2,
        remainingSeats: 3,
      },
    });

    await waitFor(() => {
      expect(result.current.participants).toEqual([runnerParticipant]);
    });

    await act(async () => {
      await result.current.handleLeave();
    });

    expect(mocks.leaveEvent).toHaveBeenCalledWith('event-1', {
      uid: 'runner-1',
      name: '跑者一號',
      photoURL: 'https://example.test/runner.png',
    });
    expect(result.current.isJoined).toBe(false);
    expect(result.current.participants).toEqual([]);
    expect(getCurrentEvent()).toEqual({
      ...startedEvent,
      participantsCount: 1,
      remainingSeats: 4,
    });
    expect(showToast).toHaveBeenCalledWith('已成功取消報名');
    expect(showToast).not.toHaveBeenCalledWith(startedLockReason, 'error');
  });
});
