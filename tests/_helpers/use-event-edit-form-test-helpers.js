/**
 * @typedef {object} TimestampLike
 * @property {() => Date} toDate - 回傳對應的 Date 物件。
 */

/**
 * @typedef {object} RoutePoint
 * @property {number} lat - 緯度。
 * @property {number} lng - 經度。
 */

/**
 * 建立 Firestore Timestamp-like 物件，供 hook 初值轉換使用。
 * @param {string} iso - 可被 `Date` 解析的時間字串。
 * @returns {TimestampLike} Timestamp-like 物件。
 */
export function createTimestampLike(iso) {
  return {
    toDate: () => new Date(iso),
  };
}

/**
 * 將 ISO 字串轉成 `datetime-local` input 預期格式。
 * @param {string} iso - 可被 `Date` 解析的時間字串。
 * @returns {string} `YYYY-MM-DDTHH:mm` 格式字串。
 */
export function toDatetimeLocalString(iso) {
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 建立測試用路線座標。
 * @returns {RoutePoint[][]} 單段路線座標。
 */
export function createRouteCoordinates() {
  return [
    [
      { lat: 25.0, lng: 121.5 },
      { lat: 25.1, lng: 121.6 },
    ],
  ];
}

/**
 * 建立符合 `useEventEditForm` 真實輸入型別的活動 fixture。
 * @param {Partial<import('@/service/event-service').EventData>} [overrides] - 欄位覆寫。
 * @returns {import('@/service/event-service').EventData} 活動資料。
 */
export function createEvent(overrides = {}) {
  return /** @type {import('@/service/event-service').EventData} */ ({
    id: 'evt-1',
    title: '晨跑團',
    time: createTimestampLike('2026-05-10T07:00:00'),
    registrationDeadline: createTimestampLike('2026-05-09T20:00:00'),
    meetPlace: '大安森林公園',
    distanceKm: 5,
    maxParticipants: 10,
    participantsCount: 3,
    paceSec: 360,
    description: '輕鬆配速',
    city: '台北市',
    district: '大安區',
    runType: 'easy',
    ...overrides,
  });
}
