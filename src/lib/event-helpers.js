import polyline from '@mapbox/polyline';

// #region JSDoc Type Definitions
/**
 * @typedef {object} RoutePoint
 * @property {number} lat - 緯度。
 * @property {number} lng - 經度。
 */

/**
 * @typedef {object} RouteBBox
 * @property {number} minLat - 最小緯度。
 * @property {number} minLng - 最小經度。
 * @property {number} maxLat - 最大緯度。
 * @property {number} maxLng - 最大經度。
 */

/**
 * @typedef {object} RoutePayload
 * @property {string} polyline - 壓縮後的路線字串。
 * @property {number} pointsCount - 座標點數量。
 * @property {RouteBBox} bbox - 邊界範圍。
 */

/**
 * @typedef {object} FirestoreTimestamp
 * @property {function(): Date} toDate - 轉換為 Date 物件。
 */

/**
 * @typedef {object} EventData
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {string|FirestoreTimestamp} time - 活動時間。
 * @property {string|FirestoreTimestamp} registrationDeadline - 報名截止時間。
 * @property {string} city - 縣市。
 * @property {string} district - 區域。
 * @property {string} meetPlace - 集合地點。
 * @property {number} distanceKm - 距離（公里）。
 * @property {number} paceSec - 配速秒數。
 * @property {string} [pace] - 配速文字。
 * @property {number} maxParticipants - 人數上限。
 * @property {number} [participantsCount] - 目前參加人數。
 * @property {number} [remainingSeats] - 剩餘名額。
 * @property {string} hostUid - 主揪 UID。
 * @property {string} hostName - 主揪名稱。
 * @property {string} [runType] - 跑步類型。
 * @property {string} [description] - 活動說明。
 * @property {RoutePayload} [route] - 路線資料。
 * @property {RoutePoint[]} [routeCoordinates] - 路線座標。
 */

/**
 * @typedef {object} UserPayload
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 使用者名稱。
 * @property {string} photoURL - 大頭貼 URL。
 */
// #endregion JSDoc Type Definitions

/**
 * 將地圖繪製的座標點壓縮成 encoded polyline 字串
 * @param {RoutePoint[] | null} routeCoordinates - 座標陣列
 * @returns {RoutePayload | null} 壓縮後的路線資料，或 null
 */
export function buildRoutePayload(routeCoordinates) {
  if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) return null;

  /** @type {[number, number][]} */
  const points = routeCoordinates.map((p) => [Number(p.lat), Number(p.lng)]);
  if (points.some(([lat, lng]) => Number.isNaN(lat) || Number.isNaN(lng))) return null;

  const encoded = polyline.encode(points);

  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];

  for (let i = 0; i < points.length; i += 1) {
    const [lat, lng] = points[i];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return {
    polyline: encoded,
    pointsCount: points.length,
    bbox: {
      minLat,
      minLng,
      maxLat,
      maxLng,
    },
  };
}

/**
 * 格式化日期時間值（支援 string 或 Firestore Timestamp）
 * @param {string | FirestoreTimestamp | null | undefined} value - 日期時間值
 * @returns {string} 格式化後的日期字串
 */
export function formatDateTime(value) {
  if (!value) return '';

  if (typeof value === 'string') return value.replace('T', ' ');

  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  return String(value);
}

/**
 * 將秒數轉換為 MM:SS 配速格式
 * @param {number | string | null | undefined} paceSec - 配速秒數
 * @param {string} [fallbackText=''] - 無法轉換時的備用文字
 * @returns {string} 格式化後的配速字串
 */
export function formatPace(paceSec, fallbackText = '') {
  if (paceSec === null || paceSec === undefined || paceSec === '') {
    if (typeof fallbackText === 'string' && fallbackText.trim()) return fallbackText;
    return '';
  }
  const n = typeof paceSec === 'number' ? paceSec : Number(paceSec);
  if (Number.isFinite(n) && n >= 0) {
    const mm = Math.floor(n / 60);
    const ss = n % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  if (typeof fallbackText === 'string' && fallbackText.trim()) return fallbackText;
  return '';
}

/**
 * 將陣列分割為指定大小的子陣列
 * @template T
 * @param {T[]} arr - 要分割的陣列
 * @param {number} size - 每個子陣列的大小
 * @returns {T[][]} 分割後的二維陣列
 */
export function chunkArray(arr, size) {
  if (!Array.isArray(arr) || size <= 0) return [];
  /** @type {T[][]} */
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 安全地將值轉換為數字
 * @param {*} v - 要轉換的值
 * @returns {number} 轉換後的數字，無效值回傳 0
 */
export function toNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 計算活動的剩餘名額
 * @param {EventData} ev - 活動資料
 * @returns {number} 剩餘名額數
 */
export function getRemainingSeats(ev) {
  if (typeof ev?.remainingSeats === 'number') return ev.remainingSeats;
  const max = toNumber(ev?.maxParticipants);
  const count = toNumber(ev?.participantsCount);
  return Math.max(0, max - count);
}

/**
 * 建立使用者 payload
 * @param {{ uid?: string, name?: string, email?: string, photoURL?: string } | null} user - 使用者物件
 * @returns {UserPayload | null} 使用者 payload，或 null
 */
export function buildUserPayload(user) {
  if (!user?.uid) return null;
  return {
    uid: String(user.uid),
    name: String(user.name || (user.email ? user.email.split('@')[0] : '')),
    photoURL: String(user.photoURL || ''),
  };
}
