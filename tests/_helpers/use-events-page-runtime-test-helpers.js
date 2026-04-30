/**
 * 建立 Timestamp-like 測試物件。
 * @param {string} iso - ISO 日期字串。
 * @returns {{ toDate: () => Date }} Timestamp-like。
 */
function createTimestamp(iso) {
  const date = new Date(iso);
  return { toDate: () => date };
}

/**
 * 建立 events page 用的活動 fixture。
 * @param {number} index - 序號。
 * @param {Partial<import('@/service/event-service').EventData>} [overrides] - 覆寫欄位。
 * @returns {import('@/service/event-service').EventData} 活動 fixture。
 */
export function createEventFixture(index, overrides = {}) {
  return {
    id: `event-${index}`,
    title: `Run ${index}`,
    city: '臺北市',
    district: index % 2 === 0 ? '信義區' : '大安區',
    time: createTimestamp(`2030-01-${String(index).padStart(2, '0')}T07:00:00Z`),
    registrationDeadline: createTimestamp(`2029-12-${String(index).padStart(2, '0')}T23:00:00Z`),
    distanceKm: 5 + index,
    maxParticipants: 10,
    participantsCount: 1,
    remainingSeats: 9,
    paceSec: 360,
    hostUid: `host-${index}`,
    hostName: `Host ${index}`,
    hostPhotoURL: `https://example.com/host-${index}.png`,
    ...overrides,
  };
}

/**
 * 建立多筆活動 fixture。
 * @param {number} count - 筆數。
 * @param {number} [startIndex] - 起始序號。
 * @param {(index: number) => Partial<import('@/service/event-service').EventData>} [getOverrides] - 每筆覆寫函式。
 * @returns {import('@/service/event-service').EventData[]} 活動列表。
 */
export function createEventList(count, startIndex = 1, getOverrides) {
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    return createEventFixture(index, getOverrides ? getOverrides(index) : {});
  });
}

/**
 * 建立 Firestore query document snapshot。
 * @param {import('@/service/event-service').EventData} event - 活動資料。
 * @returns {{ id: string, data: () => import('@/service/event-service').EventData }} snapshot。
 */
export function createEventDoc(event) {
  return {
    id: String(event.id),
    data: () => event,
  };
}

/**
 * 建立 getDocs dispatcher，依 query constraints 決定回傳哪組 events。
 * @param {object} options - 設定。
 * @param {import('@/service/event-service').EventData[]} options.latestEvents - 初始頁資料。
 * @param {import('@/service/event-service').EventData[]} [options.nextEvents] - 下一頁資料。
 * @param {import('@/service/event-service').EventData[]} [options.filteredEvents] - 篩選結果。
 * @returns {(ref: { constraints?: Array<{ type?: string }> }) => Promise<{ docs: Array<{ id: string, data: () => import('@/service/event-service').EventData }> }>} getDocs dispatcher。
 */
export function createGetDocsDispatcher({ latestEvents, nextEvents = [], filteredEvents = [] }) {
  return async (ref) => {
    const constraints = ref?.constraints ?? [];
    if (constraints.some((constraint) => constraint?.type === 'startAfter')) {
      return { docs: nextEvents.map(createEventDoc) };
    }
    if (constraints.some((constraint) => constraint?.type === 'where')) {
      return { docs: filteredEvents.map(createEventDoc) };
    }
    return { docs: latestEvents.map(createEventDoc) };
  };
}

/**
 * 建立 getDoc dispatcher，供列表頁 membership 查詢使用。
 * @param {string[]} [joinedEventIds] - 已加入的 event id。
 * @returns {(ref: { path?: string, id?: string }) => Promise<{ exists: () => boolean, data: () => { uid: string } }>} getDoc dispatcher。
 */
export function createGetDocDispatcher(joinedEventIds = []) {
  return async (ref) => {
    const path = String(ref?.path ?? '');
    const segments = path.split('/');
    const eventId = segments[1] ?? String(ref?.id ?? '');
    return {
      exists: () => joinedEventIds.includes(eventId),
      data: () => ({ uid: segments[3] ?? 'user-1' }),
    };
  };
}

/**
 * 建立測試使用者。
 * @param {Partial<{ uid: string, name: string, email: string, photoURL: string, bio: string | null, getIdToken: () => Promise<string> }>} [overrides] - 覆寫欄位。
 * @returns {{ uid: string, name: string, email: string, photoURL: string, bio: string | null, getIdToken: () => Promise<string> }} 使用者。
 */
export function createTestUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    photoURL: 'https://example.com/alice.png',
    bio: null,
    getIdToken: async () => 'token-1',
    ...overrides,
  };
}
