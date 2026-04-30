import { vi } from 'vitest';
/** @typedef {import('@/runtime/providers/AuthProvider').AuthContextValue} AuthContextValue */

const hoistedBoundaryMocks = vi.hoisted(() => {
  const router = {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  };

  return {
    router,
    mockUseRouter: vi.fn(() => router),
    mockUsePathname: vi.fn(() => '/events/test-event'),
    mockAddDoc: vi.fn(),
    mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockDoc: vi.fn((firstArg, ...segments) => {
      if (firstArg && typeof firstArg === 'object' && 'path' in firstArg && segments.length === 0) {
        return { type: 'doc', path: `${firstArg.path}/generated-doc`, id: 'generated-doc' };
      }

      return {
        type: 'doc',
        path: segments.join('/'),
        id: String(segments.at(-1) ?? ''),
      };
    }),
    mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
    mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
    mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
    mockLimit: vi.fn((count) => ({ type: 'limit', count })),
    mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
    mockRunTransaction: vi.fn(),
    mockWriteBatch: vi.fn(),
    mockDeleteField: vi.fn(() => ({ __sentinel: 'deleteField' })),
    mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
    mockUpdateDoc: vi.fn(),
    mockOnSnapshot: vi.fn(),
    mockTimestampFromDate: vi.fn((date) => ({ __ts: 'fromDate', toDate: () => date })),
    mockTimestampNow: vi.fn(() => ({ __ts: 'now' })),
  };
});

export const eventDetailRuntimeBoundaryMocks = hoistedBoundaryMocks;
vi.mock('next/navigation', () => ({
  useRouter: hoistedBoundaryMocks.mockUseRouter,
  usePathname: hoistedBoundaryMocks.mockUsePathname,
}));

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
  updateDoc: hoistedBoundaryMocks.mockUpdateDoc,
  onSnapshot: hoistedBoundaryMocks.mockOnSnapshot,
  Timestamp: {
    fromDate: hoistedBoundaryMocks.mockTimestampFromDate,
    now: hoistedBoundaryMocks.mockTimestampNow,
  },
}));

/**
 * @param {string} iso - ISO 日期字串。
 * @returns {{ toDate: () => Date, getTime: () => number }} Timestamp-like 物件。
 */
export function fakeTs(iso) {
  const date = new Date(iso);
  return { toDate: () => date, getTime: () => date.getTime() };
}

/**
 * @param {Partial<import('@/service/event-service').EventData>} [overrides] - 欄位覆寫。
 * @returns {import('@/service/event-service').EventData} 活動 fixture。
 */
export function createRuntimeEvent(overrides = {}) {
  return {
    id: overrides.id ?? 'event-1',
    title: overrides.title ?? 'Sunrise Run',
    hostUid: overrides.hostUid ?? 'host-1',
    city: overrides.city ?? '台北市',
    district: overrides.district ?? '信義區',
    time: overrides.time ?? fakeTs('2099-05-01T08:00:00Z'),
    registrationDeadline: overrides.registrationDeadline ?? fakeTs('2099-04-30T20:00:00Z'),
    distanceKm: overrides.distanceKm ?? 10,
    maxParticipants: overrides.maxParticipants ?? 4,
    participantsCount: overrides.participantsCount ?? 1,
    paceSec: overrides.paceSec ?? 360,
    route:
      overrides.route ?? {
        polylines: ['encoded-a'],
        pointsCount: 8,
        bbox: { minLat: 25, minLng: 121, maxLat: 25.1, maxLng: 121.1 },
      },
    ...overrides,
  };
}

/**
 * @param {Partial<{ id: string, uid: string, name: string, photoURL: string, eventId: string }>} [overrides] - 欄位覆寫。
 * @returns {{ id: string, uid: string, name: string, photoURL: string, eventId: string }} participant fixture。
 */
export function createRuntimeParticipant(overrides = {}) {
  return {
    id: overrides.id ?? 'u2',
    uid: overrides.uid ?? 'u2',
    name: overrides.name ?? 'Bob',
    photoURL: overrides.photoURL ?? '',
    eventId: overrides.eventId ?? 'event-1',
    ...overrides,
  };
}

/** @returns {{ exists: () => false, data: () => object }} 回傳不存在的 snapshot。 */
function createMissingSnapshot() {
  return { exists: () => false, data: () => ({}) };
}

/**
 * @param {import('@/service/event-service').EventData} event - 活動 fixture。
 * @returns {{ id: string | undefined, exists: () => true, data: () => import('@/service/event-service').EventData }} 回傳存在的活動 snapshot。
 */
function createEventSnapshot(event) {
  return { id: event.id, exists: () => true, data: () => event };
}

/**
 * @param {object[]} docs - docs 陣列。
 * @returns {{ docs: object[] }} getDocs 風格結果。
 */
function createDocsSnapshot(docs) {
  return { docs };
}

/** @returns {{ set: import('vitest').Mock, delete: import('vitest').Mock, update: import('vitest').Mock, commit: import('vitest').Mock }} 可重複使用的 batch double。 */
function createWriteBatchDouble() {
  return {
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

/** 重置每個測試共用的 boundary mock 狀態。 */
export function resetEventDetailRuntimeBoundaryMocks() {
  vi.clearAllMocks();
  hoistedBoundaryMocks.mockUseRouter.mockImplementation(() => hoistedBoundaryMocks.router);
  hoistedBoundaryMocks.mockUsePathname.mockImplementation(() => '/events/test-event');
  hoistedBoundaryMocks.mockGetDoc.mockImplementation(async () => createMissingSnapshot());
  hoistedBoundaryMocks.mockGetDocs.mockImplementation(async () => createDocsSnapshot([]));
  hoistedBoundaryMocks.mockRunTransaction.mockReset();
  hoistedBoundaryMocks.mockWriteBatch.mockImplementation(() => createWriteBatchDouble());
  hoistedBoundaryMocks.mockDeleteField.mockImplementation(() => ({ __sentinel: 'deleteField' }));
  hoistedBoundaryMocks.mockServerTimestamp.mockImplementation(() => ({ __sentinel: 'serverTimestamp' }));
  hoistedBoundaryMocks.mockTimestampFromDate.mockImplementation((date) => ({
    __ts: 'fromDate',
    toDate: () => date,
  }));
  hoistedBoundaryMocks.mockTimestampNow.mockImplementation(() => ({ __ts: 'now' }));
}

/** @param {{ id: string, event?: import('@/service/event-service').EventData | null, participants?: Array<{ id: string, uid: string, name: string, photoURL: string, eventId: string }>, joinedByUser?: Record<string, string[]> }} options - Firestore 測試資料。 */
export function installEventDetailRuntimeFirestore({
  id,
  event = createRuntimeEvent({ id }),
  participants = [],
  joinedByUser = {},
}) {
  hoistedBoundaryMocks.mockGetDoc.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === `events/${id}`) {
      return event ? createEventSnapshot(event) : createMissingSnapshot();
    }

    const joinedMatch = path.match(new RegExp(`^events/${id}/participants/([^/]+)$`));
    if (joinedMatch) {
      const uid = joinedMatch[1];
      const joinedIds = new Set((joinedByUser[uid] ?? []).map(String));
      return { exists: () => joinedIds.has(String(id)), data: () => ({ uid }) };
    }

    return createMissingSnapshot();
  });

  hoistedBoundaryMocks.mockGetDocs.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === `events/${id}/participants`) {
      return createDocsSnapshot(
        participants.map((participant) => ({
          id: participant.id,
          ref: { path: `events/${id}/participants/${participant.id}` },
          data: () => participant,
        })),
      );
    }

    if (path === `events/${id}/comments`) {
      return createDocsSnapshot([]);
    }

    if (path.includes(`/comments/`) && path.endsWith('/history')) {
      return createDocsSnapshot([]);
    }

    return createDocsSnapshot([]);
  });
}

/** @param {{ event: import('@/service/event-service').EventData, uid?: string, participantExists?: boolean }} options - join transaction 設定。 */
export function primeJoinTransaction({ event, uid = 'u1', participantExists = false }) {
  hoistedBoundaryMocks.mockRunTransaction.mockImplementationOnce(async (_db, callback) =>
    callback({
      get: vi.fn(async (ref) => {
        const path = String(ref?.path ?? '');
        if (path === `events/${event.id}`) {
          return createEventSnapshot(event);
        }
        if (path === `events/${event.id}/participants/${uid}`) {
          return { exists: () => participantExists, data: () => ({ uid }) };
        }
        return createMissingSnapshot();
      }),
      set: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    }),
  );
}
