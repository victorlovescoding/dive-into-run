import { vi } from 'vitest';
import { createFirestoreDocSnapshot } from './factories';

export { createFirestoreDocSnapshot as createDocSnapshot } from './factories';

/**
 * @typedef {object} ParticipantDoc
 * @property {string} id - 文件 ID（通常與 uid 相同）。
 * @property {string} uid - 參加者 UID。
 * @property {string} name - 參加者顯示名稱。
 * @property {string} photoURL - 參加者頭像 URL。
 * @property {string} eventId - 所屬活動 ID。
 */

/**
 * @typedef {object} EventFixtureOverrides
 * @property {string} [id] - 活動 ID。
 * @property {string} [hostUid] - 主辦者 UID。
 * @property {number} [maxParticipants] - 報名上限。
 * @property {number} [participantsCount] - 目前參加人數。
 * @property {number} [remainingSeats] - 剩餘名額（明確指定時覆寫計算）。
 * @property {string|null|{ toDate: () => Date }} [registrationDeadline] - 報名截止時間（ISO 字串或 Timestamp-like）。
 */

/**
 * @typedef {object} EventFixture
 * @property {string} id - 活動 ID。
 * @property {string} hostUid - 主辦者 UID。
 * @property {number} maxParticipants - 報名上限。
 * @property {number} participantsCount - 目前參加人數。
 * @property {number} remainingSeats - 剩餘名額。
 * @property {string} registrationDeadline - 報名截止時間 ISO 字串。
 * @property {string} title - 活動標題。
 */

/**
 * 建立可被 hook 直接吃的 event fixture。
 * @param {EventFixtureOverrides} [overrides] - 覆寫欄位。
 * @returns {EventFixture} event fixture。
 */
export function createEventFixture(overrides = {}) {
  const max = overrides.maxParticipants ?? 5;
  const count = overrides.participantsCount ?? 1;
  return /** @type {EventFixture} */ ({
    id: overrides.id ?? 'event-1',
    hostUid: overrides.hostUid ?? 'host-1',
    maxParticipants: max,
    participantsCount: count,
    remainingSeats: overrides.remainingSeats ?? Math.max(0, max - count),
    registrationDeadline:
      overrides.registrationDeadline ?? new Date(Date.now() + 86_400_000).toISOString(),
    title: 'Sunny Run',
  });
}

/**
 * 建立 participant 文件 snapshot 列表（給 fetchParticipants 用）。
 * @param {ParticipantDoc[]} participants - 參加者陣列。
 * @returns {Array<{ id: string, data: () => ParticipantDoc }>} snapshot 陣列。
 */
export function createParticipantSnapshots(participants) {
  return participants.map((participant) =>
    createFirestoreDocSnapshot(participant.id, /** @type {object} */ (participant)),
  );
}

/**
 * 建立 hook 必要的 props（含 setEvent / showToast / isMountedRef）。
 * @param {object} options - 設定。
 * @param {EventFixture | null} options.event - 初始活動資料。
 * @param {{ uid?: string, name?: string, photoURL?: string } | null} options.user - 使用者。
 * @param {string} [options.id] - 活動 ID（預設取 event.id 或 'event-1'）。
 * @returns {{
 *   id: string,
 *   event: EventFixture | null,
 *   setEvent: import('vitest').Mock,
 *   user: { uid?: string, name?: string, photoURL?: string } | null,
 *   showToast: import('vitest').Mock,
 *   isMountedRef: { current: boolean },
 * }} hook props。
 */
export function createHookProps({ event, user, id }) {
  const eventState = { current: event };
  /** @type {import('vitest').Mock} */
  const setEvent = vi.fn((updater) => {
    eventState.current = typeof updater === 'function' ? updater(eventState.current) : updater;
  });
  return {
    id: id ?? event?.id ?? 'event-1',
    event,
    setEvent,
    user,
    showToast: vi.fn(),
    isMountedRef: { current: true },
  };
}

/**
 * 為 getDoc 建立 path-based dispatcher，模擬 fetchJoinedParticipantDocuments
 * 對每個 eventId 各打一次 getDoc 的行為。
 * @param {Set<string>} joinedEventIds - 此 user 已參加的活動 ID 集合。
 * @returns {(ref: { path?: string }) => Promise<{ exists: () => boolean }>} getDoc 實作。
 */
export function createJoinedDispatcher(joinedEventIds) {
  return async (ref) => {
    const path = String(ref?.path ?? '');
    const segments = path.split('/');
    const eventsIndex = segments.indexOf('events');
    const participantsIndex = segments.indexOf('participants');
    const eventId =
      eventsIndex >= 0 && segments.length > eventsIndex + 1 ? segments[eventsIndex + 1] : '';
    const isParticipantPath = participantsIndex >= 0 && participantsIndex === eventsIndex + 2;
    const exists = isParticipantPath && joinedEventIds.has(eventId);
    return { exists: () => exists };
  };
}

/**
 * 建立 runTransaction 模擬器：以 in-memory event/participant 狀態跑 transaction callback。
 * 只用於 join / leave 路徑，會把真實 service 的 plan 結果應用到 in-memory state，
 * 讓後續 assertion 能讀取最終 event/participant 狀態。
 * @param {object} options - 初始狀態。
 * @param {object} options.eventData - event document data（必含 maxParticipants / participantsCount）。
 * @param {boolean} [options.participantExists] - 使用者是否已存在 participant。
 * @returns {{
 *   runTransaction: (db: unknown, callback: (tx: object) => Promise<unknown>) => Promise<unknown>,
 *   getState: () => { eventData: object, participantExists: boolean, eventUpdates: object | null, participantCreate: object | null, participantDelete: boolean },
 * }} runTransaction 模擬器。
 */
export function createTransactionRunner({ eventData, participantExists = false }) {
  const state = {
    eventData: { ...eventData },
    participantExists,
    /** @type {object | null} */
    eventUpdates: null,
    /** @type {object | null} */
    participantCreate: null,
    participantDelete: false,
  };

  const runTransaction = async (_db, callback) => {
    const tx = {
      get: async (ref) => {
        const path = String(ref?.path ?? '');
        if (path.includes('/participants/')) {
          return { exists: () => state.participantExists, data: () => ({}) };
        }
        return { exists: () => true, data: () => state.eventData };
      },
      set: (_ref, payload) => {
        state.participantCreate = payload;
        state.participantExists = true;
      },
      delete: () => {
        state.participantDelete = true;
        state.participantExists = false;
      },
      update: (_ref, payload) => {
        state.eventUpdates = payload;
        state.eventData = { ...state.eventData, ...payload };
      },
    };
    return callback(tx);
  };

  return {
    runTransaction,
    getState: () => state,
  };
}
