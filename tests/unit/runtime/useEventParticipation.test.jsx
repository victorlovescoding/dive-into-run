import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import {
  createJoinedDispatcher,
  createTransactionRunner,
} from '../../_helpers/event-participation-fixtures';

const { mockDoc, mockCollection, mockGetDoc, mockRunTransaction, mockServerTimestamp } = vi.hoisted(
  () => ({
    mockDoc: vi.fn((_db, ...segments) => ({ type: 'doc', path: segments.join('/') })),
    mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
    mockGetDoc: vi.fn(),
    mockRunTransaction: vi.fn(),
    mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  }),
);

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  getDoc: mockGetDoc,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
  Timestamp: {
    fromDate: vi.fn((date) => ({ __ts: 'fromDate', date })),
  },
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * @returns {Promise<typeof import('@/runtime/hooks/useEventParticipation').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useEventParticipation')).default;
}

/**
 * @param {Partial<import('@/service/event-service').EventData>} [overrides] - event 欄位覆寫。
 * @returns {import('@/service/event-service').EventData} 可直接餵給 hook 的 event fixture。
 */
function createEvent(overrides = {}) {
  return {
    id: overrides.id ?? 'event-1',
    city: overrides.city ?? '台北市',
    district: overrides.district ?? '中正區',
    time: overrides.time ?? '2030-01-01T07:00:00.000Z',
    registrationDeadline: overrides.registrationDeadline ?? '2029-12-31T23:00:00.000Z',
    meetPlace: overrides.meetPlace ?? '中正紀念堂',
    distanceKm: overrides.distanceKm ?? 10,
    maxParticipants: overrides.maxParticipants ?? 5,
    participantsCount: overrides.participantsCount ?? 1,
    remainingSeats: overrides.remainingSeats ?? 4,
    paceSec: overrides.paceSec ?? 360,
    hostUid: overrides.hostUid ?? 'host-1',
    hostName: overrides.hostName ?? 'Host',
    hostPhotoURL: overrides.hostPhotoURL ?? '',
    title: overrides.title ?? 'Sunny Run',
    ...overrides,
  };
}

/**
 * @param {{ user?: { uid: string, name: string, email?: string, photoURL?: string } | null, events?: import('@/service/event-service').EventData[] }} [overrides] - user/events 覆寫。
 * @returns {{
 *   user: { uid: string, name: string, email?: string, photoURL?: string } | null,
 *   events: import('@/service/event-service').EventData[],
 *   setEvents: import('vitest').Mock,
 *   showToast: import('vitest').Mock,
 * }} hook props。
 */
function createProps(overrides = {}) {
  return {
    user:
      overrides.user === undefined
        ? { uid: 'u1', name: 'Alice', email: 'a@b.com', photoURL: '' }
        : overrides.user,
    events: overrides.events ?? [],
    setEvents: vi.fn(),
    showToast: vi.fn(),
  };
}

/**
 * @param {typeof import('@/runtime/hooks/useEventParticipation').default} useEventParticipation - 目標 hook。
 * @param {{
 *   user: { uid: string, name: string, email?: string, photoURL?: string } | null,
 *   events: import('@/service/event-service').EventData[],
 *   setEvents: import('vitest').Mock,
 *   showToast: import('vitest').Mock,
 * }} initialProps - renderHook 初始 props。
 * @returns {import('@testing-library/react').RenderHookResult<ReturnType<typeof import('@/runtime/hooks/useEventParticipation').default>, unknown>} hook render 結果。
 */
function renderTarget(useEventParticipation, initialProps) {
  return renderHook(
    ({ user, events, setEvents, showToast }) => {
      const isMountedRef = useRef(true);
      return useEventParticipation({ user, events, setEvents, showToast, isMountedRef });
    },
    { initialProps },
  );
}

/**
 * @param {import('vitest').Mock} setEvents - `setEvents` mock。
 * @param {import('@/service/event-service').EventData[]} previousEvents - updater 的前一版 events。
 * @returns {import('@/service/event-service').EventData[]} 更新後活動列表。
 */
function applyLatestUpdater(setEvents, previousEvents) {
  const updater = setEvents.mock.calls.at(-1)?.[0];
  return typeof updater === 'function' ? updater(previousEvents) : previousEvents;
}

/**
 * @returns {import('react').MouseEvent} click event。
 */
function createClickEvent() {
  return /** @type {import('react').MouseEvent} */ (
    /** @type {unknown} */ ({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })
  );
}

/** @type {ReturnType<typeof vi.spyOn> | undefined} */
let consoleErrorSpy;

describe('useEventParticipation', () => {
  beforeEach(() => {
    vi.resetModules();
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockGetDoc.mockReset();
    mockRunTransaction.mockReset();
    mockServerTimestamp.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
  });

  it('skips membership fetch when user is missing', async () => {
    const useEventParticipation = await loadHook();
    const props = createProps({ user: null, events: [createEvent({ id: 'e1' })] });
    const { result } = renderTarget(useEventParticipation, props);

    await waitFor(() => {
      expect(result.current.myJoinedEventIds.size).toBe(0);
    });

    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('fetches joined ids in 30-item chunks for large event lists', async () => {
    const useEventParticipation = await loadHook();
    const events = Array.from({ length: 35 }, (_, index) => createEvent({ id: `e${index + 1}` }));
    const joinedIds = new Set(events.slice(0, 5).concat(events.slice(30)).map((event) => String(event.id)));
    const props = createProps({ events });

    mockGetDoc.mockImplementation(createJoinedDispatcher(joinedIds));

    const { result } = renderTarget(useEventParticipation, props);

    await waitFor(() => {
      expect(result.current.myJoinedEventIds.size).toBe(10);
    });

    expect(mockGetDoc.mock.calls).toHaveLength(35);
  });

  it('joins an event and updates remaining seats plus participants count', async () => {
    const useEventParticipation = await loadHook();
    const event = createEvent({
      id: 'e1',
      maxParticipants: 10,
      participantsCount: 3,
      remainingSeats: 7,
      hostUid: 'host-other',
    });
    const props = createProps({ events: [event] });
    const txRunner = createTransactionRunner({
      eventData: { maxParticipants: 10, participantsCount: 3, remainingSeats: 7 },
      participantExists: false,
    });

    mockRunTransaction.mockImplementationOnce(txRunner.runTransaction);

    const { result } = renderTarget(useEventParticipation, props);

    await act(async () => {
      await result.current.handleJoinClick(event, createClickEvent());
    });

    await waitFor(() => {
      expect(result.current.myJoinedEventIds.has('e1')).toBe(true);
    });

    const nextEvents = applyLatestUpdater(props.setEvents, [event]);
    expect(nextEvents[0].remainingSeats).toBe(6);
    expect(nextEvents[0].participantsCount).toBe(4);
    expect(props.showToast).toHaveBeenLastCalledWith('報名成功');
    expect(result.current.pendingByEventId.e1).toBeUndefined();
  });

  it('marks remaining seats as zero when join hits capacity contention', async () => {
    const useEventParticipation = await loadHook();
    const event = createEvent({
      id: 'e1',
      maxParticipants: 5,
      participantsCount: 5,
      remainingSeats: 0,
    });
    const props = createProps({ events: [event] });
    const txRunner = createTransactionRunner({
      eventData: { maxParticipants: 5, participantsCount: 5, remainingSeats: 0 },
      participantExists: false,
    });

    mockRunTransaction.mockImplementationOnce(txRunner.runTransaction);

    const { result } = renderTarget(useEventParticipation, props);

    await act(async () => {
      await result.current.handleJoinClick(event, createClickEvent());
    });

    await waitFor(() => {
      expect(props.showToast).toHaveBeenLastCalledWith('本活動已額滿', 'error');
    });

    const nextEvents = applyLatestUpdater(props.setEvents, [event]);
    expect(nextEvents[0].remainingSeats).toBe(0);
    expect(result.current.myJoinedEventIds.has('e1')).toBe(false);
  });

  it('shows join error toast and clears pending state when transaction fails', async () => {
    const useEventParticipation = await loadHook();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const event = createEvent({ id: 'e1' });
    const props = createProps({ events: [event] });

    mockRunTransaction.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderTarget(useEventParticipation, props);

    await act(async () => {
      await result.current.handleJoinClick(event, createClickEvent());
    });

    await waitFor(() => {
      expect(props.showToast).toHaveBeenLastCalledWith('報名失敗，請再試一次', 'error');
    });

    expect(result.current.pendingByEventId.e1).toBeUndefined();
  });

  it('leaves an event and restores remaining seats while reducing participants count', async () => {
    const useEventParticipation = await loadHook();
    const event = createEvent({
      id: 'e1',
      maxParticipants: 10,
      participantsCount: 4,
      remainingSeats: 6,
    });
    const props = createProps({ events: [event] });
    const txRunner = createTransactionRunner({
      eventData: { maxParticipants: 10, participantsCount: 4, remainingSeats: 6 },
      participantExists: true,
    });

    mockRunTransaction.mockImplementationOnce(txRunner.runTransaction);

    const { result } = renderTarget(useEventParticipation, props);

    await act(async () => {
      await result.current.handleLeaveClick(event, createClickEvent());
    });

    await waitFor(() => {
      expect(props.showToast).toHaveBeenLastCalledWith('已成功取消報名');
    });

    const nextEvents = applyLatestUpdater(props.setEvents, [event]);
    expect(nextEvents[0].remainingSeats).toBe(7);
    expect(nextEvents[0].participantsCount).toBe(3);
    expect(result.current.pendingByEventId.e1).toBeUndefined();
  });

  it('blocks leave when user is not logged in', async () => {
    const useEventParticipation = await loadHook();
    const event = createEvent({ id: 'e1' });
    const props = createProps({ user: null, events: [event] });
    const { result } = renderTarget(useEventParticipation, props);

    await act(async () => {
      await result.current.handleLeaveClick(event, createClickEvent());
    });

    expect(props.showToast).toHaveBeenLastCalledWith('請先登入再操作', 'error');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
