/**
 * 將陣列分割為指定大小的子陣列。
 * @template T
 * @param {T[]} arr - 要分割的陣列。
 * @param {number} size - 每個子陣列的大小。
 * @returns {T[][]} 分割後的二維陣列。
 */
export function chunkArray(arr, size) {
  if (!Array.isArray(arr) || size <= 0) return [];

  /** @type {T[][]} */
  const out = [];
  for (let index = 0; index < arr.length; index += size) {
    out.push(arr.slice(index, index + size));
  }
  return out;
}

/**
 * 計算多段路線座標的總點數。
 * @param {import('@/service/event-service').RoutePoint[][] | null} coordsArray - 多段路線座標。
 * @returns {number} 總點數。
 */
export function countTotalPoints(coordsArray) {
  if (!Array.isArray(coordsArray)) return 0;
  return coordsArray.reduce((sum, line) => sum + line.length, 0);
}

/**
 * 安全轉換數字。
 * @param {string | number | null | undefined} value - 要轉換的值。
 * @returns {number} 轉換後的數字，無效值回傳 0。
 */
export function toNumber(value) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * 將日期值轉為毫秒時間戳（支援 string 或 Firestore Timestamp）。
 * @param {string | { toDate?: () => Date } | null | undefined} value - 日期值。
 * @returns {number | null} 毫秒時間戳，無效值回傳 null。
 */
export function toMs(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }
  return null;
}
