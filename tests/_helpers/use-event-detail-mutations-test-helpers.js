import { vi } from 'vitest';

/**
 * @typedef {Parameters<typeof import('@/runtime/hooks/useEventDetailMutations').default>[0]} HookParams
 * @typedef {import('@/service/event-service').EventData} TestEvent
 */

/**
 * @typedef {object} CreateMutationParamsOptions
 * @property {string} [id] - 活動 ID。
 * @property {HookParams['user']} [user] - 覆寫登入使用者。
 * @property {HookParams['event']} [event] - 覆寫活動資料。
 * @property {boolean} [isMounted] - 覆寫 mounted 狀態。
 */

/**
 * @typedef {object} RouterDouble
 * @property {import('vitest').Mock} back - Router back mock。
 * @property {import('vitest').Mock} forward - Router forward mock。
 * @property {import('vitest').Mock} prefetch - Router prefetch mock。
 * @property {import('vitest').Mock} push - Router push mock。
 * @property {import('vitest').Mock} refresh - Router refresh mock。
 * @property {import('vitest').Mock} replace - Router replace mock。
 */

/**
 * @typedef {object} MutationTestContext
 * @property {HookParams} params - 傳給 hook 的 params。
 * @property {RouterDouble} router - Router mock double。
 * @property {import('vitest').Mock} setEventMock - setEvent mock。
 * @property {import('vitest').Mock} setErrorMock - setError mock。
 * @property {import('vitest').Mock} showToastMock - showToast mock。
 * @property {() => TestEvent | null} getEvent - 取得目前 in-memory event state。
 * @property {() => string | null} getError - 取得目前 in-memory error state。
 */

/**
 * 建立測試用 Timestamp-like 物件。
 * @param {string} iso - ISO 時間字串。
 * @returns {{ toDate: () => Date, getTime: () => number }} Timestamp-like。
 */
export function fakeTs(iso) {
  const date = new Date(iso);
  return { toDate: () => date, getTime: () => date.getTime() };
}

/**
 * 建立符合 EventData 介面的活動 fixture。
 * @param {Partial<TestEvent>} [overrides] - 覆寫欄位。
 * @returns {TestEvent} 活動 fixture。
 */
export function createTestEvent(overrides = {}) {
  return {
    id: 'e1',
    title: 'Morning Run',
    hostUid: 'host-1',
    city: '台北市',
    district: '信義區',
    time: fakeTs('2026-05-01T08:00:00Z'),
    registrationDeadline: fakeTs('2026-04-30T20:00:00Z'),
    distanceKm: 10,
    maxParticipants: 10,
    participantsCount: 3,
    paceSec: 360,
    ...overrides,
  };
}

/**
 * 建立 hook 所需依賴，並保留一份可檢查的 in-memory event/error state。
 * @param {CreateMutationParamsOptions} [options] - 覆寫欄位。
 * @returns {MutationTestContext} 測試上下文。
 */
export function createMutationParams(options = {}) {
  const id = options.id ?? 'e1';
  const eventState = {
    current:
      options.event === undefined
        ? createTestEvent({ id })
        : /** @type {TestEvent | null} */ (options.event),
  };
  const errorState = { current: /** @type {string | null} */ (null) };

  const setEventMock = vi.fn(
    /**
     * @param {Parameters<HookParams['setEvent']>[0] | TestEvent | null} nextEvent - setEvent updater 或直接值。
     */
    (nextEvent) => {
      eventState.current =
        typeof nextEvent === 'function' ? nextEvent(eventState.current) : nextEvent;
    },
  );
  const setErrorMock = vi.fn(
    /**
     * @param {Parameters<HookParams['setError']>[0]} nextError - 下一個錯誤訊息。
     */
    (nextError) => {
      errorState.current = nextError;
    },
  );

  /** @type {RouterDouble} */
  const router = {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  };

  const showToastMock = vi.fn();
  const user =
    options.user === undefined ? { uid: 'u1', name: 'Alice', photoURL: '' } : options.user;
  const typedRouter = /** @type {HookParams['router']} */ (router);
  const typedShowToast = /** @type {HookParams['showToast']} */ (showToastMock);

  /** @type {HookParams} */
  const params = {
    id,
    event: eventState.current,
    setEvent: /** @type {HookParams['setEvent']} */ (setEventMock),
    setError: /** @type {HookParams['setError']} */ (setErrorMock),
    router: typedRouter,
    user,
    showToast: typedShowToast,
    isMountedRef: { current: options.isMounted ?? true },
  };

  return {
    params,
    router,
    setEventMock,
    setErrorMock,
    showToastMock,
    getEvent: () => eventState.current,
    getError: () => errorState.current,
  };
}

/**
 * 將 nullable event 窄化成可安全傳入 handler 的活動資料。
 * @param {HookParams['event']} event - 可能為 null 的活動資料。
 * @returns {TestEvent} 非 null 活動資料。
 */
export function requireEvent(event) {
  if (!event) {
    throw new Error('Test event is required');
  }
  return event;
}
