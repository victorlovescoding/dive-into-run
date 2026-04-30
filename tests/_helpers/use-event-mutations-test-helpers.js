import { vi } from 'vitest';

/**
 * @typedef {object} RoutePoint
 * @property {number} lat - 緯度。
 * @property {number} lng - 經度。
 */

/**
 * @typedef {object} CreatePropsOptions
 * @property {RoutePoint[][] | null} [routeCoordinates] - 建立活動時的路線座標。
 * @property {object[]} [initialEvents] - 初始活動列表。
 */

/**
 * 建立 `useEventMutations` 測試 props，並保留一份可讀的 in-memory events state。
 * @param {CreatePropsOptions} [options] - props 覆寫。
 * @returns {{
 *   isMountedRef: { current: boolean },
 *   setEvents: import('vitest').Mock,
 *   getEvents: () => object[],
 *   showToast: import('vitest').Mock,
 *   createCtx: {
 *     hostUid: string,
 *     hostName: string,
 *     hostPhotoURL: string,
 *     routeCoordinates: RoutePoint[][] | null,
 *     resetCreateForm: import('vitest').Mock,
 *   },
 * }} hook props。
 */
export function createEventMutationProps(options = {}) {
  const eventsState = { current: [...(options.initialEvents ?? [])] };
  const setEvents = vi.fn((updater) => {
    eventsState.current =
      typeof updater === 'function' ? updater(eventsState.current) : [...updater];
  });

  return {
    isMountedRef: { current: true },
    setEvents,
    getEvents: () => eventsState.current,
    showToast: vi.fn(),
    createCtx: {
      hostUid: 'host-uid',
      hostName: 'Host',
      hostPhotoURL: 'host-photo',
      routeCoordinates: options.routeCoordinates ?? null,
      resetCreateForm: vi.fn(),
    },
  };
}

/**
 * 建立符合 hook 使用方式的真實表單 submit event。
 * @param {Partial<Record<string, string>>} [overrides] - 欄位覆寫。
 * @returns {{
 *   preventDefault: import('vitest').Mock,
 *   currentTarget: HTMLFormElement,
 * }} submit event。
 */
export function createEventSubmitEvent(overrides = {}) {
  const form = document.createElement('form');
  /** @type {Record<string, string>} */
  const values = {
    title: '清晨慢跑',
    city: '台北市',
    district: '中正區',
    meetPlace: '中正紀念堂',
    description: '一起跑',
    runType: 'Run',
    time: '2030-01-01T07:00',
    registrationDeadline: '2029-12-31T23:00',
    distanceKm: '10',
    maxParticipants: '5',
    paceMinutes: '6',
    paceSeconds: '0',
    ...overrides,
  };

  Object.entries(values).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.append(input);
  });

  return {
    preventDefault: vi.fn(),
    currentTarget: form,
  };
}
