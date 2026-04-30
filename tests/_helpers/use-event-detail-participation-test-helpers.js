import { vi } from 'vitest';

const hoistedBoundaryMocks = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockGetDocs: vi.fn(),
  mockGetDoc: vi.fn(),
  mockDoc: vi.fn((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
    id: String(segments.at(-1) ?? ''),
  })),
  mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  mockRunTransaction: vi.fn(),
  mockWriteBatch: vi.fn(),
  mockDeleteField: vi.fn(() => ({ __sentinel: 'deleteField' })),
  mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  mockTimestampFromDate: vi.fn((date) => ({ __ts: 'fromDate', toDate: () => date })),
}));

/**
 * Firestore / Firebase client 邊界 mocks。
 * @type {{
 *   mockAddDoc: import('vitest').Mock,
 *   mockCollection: import('vitest').Mock,
 *   mockGetDocs: import('vitest').Mock,
 *   mockGetDoc: import('vitest').Mock,
 *   mockDoc: import('vitest').Mock,
 *   mockQuery: import('vitest').Mock,
 *   mockWhere: import('vitest').Mock,
 *   mockOrderBy: import('vitest').Mock,
 *   mockLimit: import('vitest').Mock,
 *   mockStartAfter: import('vitest').Mock,
 *   mockRunTransaction: import('vitest').Mock,
 *   mockWriteBatch: import('vitest').Mock,
 *   mockDeleteField: import('vitest').Mock,
 *   mockServerTimestamp: import('vitest').Mock,
 *   mockTimestampFromDate: import('vitest').Mock,
 * }}
 */
export const eventDetailParticipationBoundaryMocks = hoistedBoundaryMocks;

vi.mock('firebase/firestore', () => ({
  addDoc: hoistedBoundaryMocks.mockAddDoc,
  collection: hoistedBoundaryMocks.mockCollection,
  getDocs: hoistedBoundaryMocks.mockGetDocs,
  getDoc: hoistedBoundaryMocks.mockGetDoc,
  doc: hoistedBoundaryMocks.mockDoc,
  query: hoistedBoundaryMocks.mockQuery,
  where: hoistedBoundaryMocks.mockWhere,
  orderBy: hoistedBoundaryMocks.mockOrderBy,
  limit: hoistedBoundaryMocks.mockLimit,
  startAfter: hoistedBoundaryMocks.mockStartAfter,
  runTransaction: hoistedBoundaryMocks.mockRunTransaction,
  writeBatch: hoistedBoundaryMocks.mockWriteBatch,
  deleteField: hoistedBoundaryMocks.mockDeleteField,
  serverTimestamp: hoistedBoundaryMocks.mockServerTimestamp,
  Timestamp: { fromDate: hoistedBoundaryMocks.mockTimestampFromDate },
}));

/**
 * @typedef {object} EventDetailUserFixture
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} [photoURL] - 大頭貼。
 * @property {string} [email] - Email。
 */

/**
 * 建立 `EventData` fixture。
 * @param {Partial<import('@/service/event-service').EventData>} [overrides] - 欄位覆寫。
 * @returns {import('@/service/event-service').EventData} event fixture。
 */
export function createEventDetailEvent(overrides = {}) {
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
    remainingSeats: overrides.remainingSeats,
    paceSec: overrides.paceSec ?? 360,
    hostUid: overrides.hostUid ?? 'host-1',
    hostName: overrides.hostName ?? 'Host',
    hostPhotoURL: overrides.hostPhotoURL ?? '',
    title: overrides.title ?? 'Sunny Run',
    ...overrides,
  };
}

/**
 * 建立 participant fixture。
 * @param {Partial<{ id: string, uid: string, name: string, photoURL: string, eventId: string }>} [overrides] - 欄位覆寫。
 * @returns {{ id: string, uid: string, name: string, photoURL: string, eventId: string }} participant fixture。
 */
export function createParticipantFixture(overrides = {}) {
  return {
    id: overrides.id ?? 'u1',
    uid: overrides.uid ?? 'u1',
    name: overrides.name ?? 'Alice',
    photoURL: overrides.photoURL ?? '',
    eventId: overrides.eventId ?? 'event-1',
  };
}

/**
 * 將 participant 陣列包成 getDocs 可回傳的 snapshot docs。
 * @param {Array<{ id: string, uid: string, name: string, photoURL: string, eventId: string }>} participants - 參加者列表。
 * @returns {{ docs: Array<{ id: string, data: () => object }> }} snapshot 結果。
 */
export function createParticipantsSnapshot(participants) {
  return {
    docs: participants.map((participant) => ({
      id: participant.id,
      data: () => participant,
    })),
  };
}

/**
 * 建立 path-aware 的 joined participant `getDoc` dispatcher。
 * @param {Record<string, string[]>} joinedByUser - key 是 uid，value 是已參加 eventId 陣列。
 * @returns {(ref: { path?: string }) => Promise<{ exists: () => boolean }>} getDoc mock implementation。
 */
export function createJoinedByUserDispatcher(joinedByUser) {
  return async (ref) => {
    const segments = String(ref?.path ?? '').split('/');
    const eventId = segments[1] ?? '';
    const uid = segments[3] ?? '';
    const joinedIds = new Set((joinedByUser[uid] ?? []).map(String));
    return { exists: () => joinedIds.has(String(eventId)) };
  };
}

/**
 * 建立 hook props，並保留可讀取的 event state。
 * @param {{
 *   event: import('@/service/event-service').EventData | null,
 *   user?: EventDetailUserFixture | null,
 *   id?: string,
 * }} options - props 選項。
 * @returns {{
 *   id: string,
 *   event: import('@/service/event-service').EventData | null,
 *   setEvent: import('vitest').Mock,
 *   user: EventDetailUserFixture | null,
 *   showToast: import('vitest').Mock,
 *   isMountedRef: { current: boolean },
 *   getEvent: () => import('@/service/event-service').EventData | null,
 * }} hook props。
 */
export function createEventDetailParticipationProps(options) {
  const eventState = { current: options.event };
  const setEvent = vi.fn((updater) => {
    eventState.current =
      typeof updater === 'function' ? updater(eventState.current) : updater;
  });

  return {
    id: options.id ?? options.event?.id ?? 'event-1',
    event: options.event,
    setEvent,
    user:
      options.user === undefined
        ? { uid: 'u1', name: 'Alice', photoURL: '', email: 'alice@example.com' }
        : options.user,
    showToast: vi.fn(),
    isMountedRef: { current: true },
    getEvent: () => eventState.current,
  };
}
