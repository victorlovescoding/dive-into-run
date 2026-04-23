import { decode } from '@mapbox/polyline';

/**
 * 將距離從公尺格式化為公里字串。
 * @param {number} meters - 距離（公尺）。
 * @returns {string} 格式化後的距離，如 "5.2 km"。
 */
export function formatDistance(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * 根據移動時間與距離計算配速。
 * @param {number} movingTimeSec - 移動時間（秒）。
 * @param {number} distanceMeters - 距離（公尺）。
 * @returns {string} 格式化後的配速，如 "5'29\"/km"。距離為零時回傳 "-'--\"/km"。
 */
export function formatPace(movingTimeSec, distanceMeters) {
  if (distanceMeters === 0) {
    return '-\'--"/km';
  }
  const totalSecondsPerKm = movingTimeSec / (distanceMeters / 1000);
  const minutes = Math.floor(totalSecondsPerKm / 60);
  const seconds = Math.floor(totalSecondsPerKm % 60);
  return `${minutes}'${String(seconds).padStart(2, '0')}"/km`;
}

/**
 * 將秒數格式化為時間字串。
 * @param {number} seconds - 總秒數。
 * @returns {string} 格式化後的時間，不足一小時為 "mm:ss"，超過為 "h:mm:ss"。
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * 解碼 Google Encoded Polyline 為座標陣列。
 * @param {string | null | undefined} encoded - 編碼後的 polyline 字串。
 * @returns {[number, number][]} 座標陣列 [[lat, lng], ...]，輸入為空時回傳空陣列。
 */
export function decodePolyline(encoded) {
  if (!encoded) {
    return [];
  }
  return decode(encoded);
}

// ---------------------------------------------------------------------------
// Run Calendar helpers
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} 活動類型對應的中文標籤。 */
export const RUN_TYPE_LABELS = {
  Run: '戶外',
  VirtualRun: '室內',
  TrailRun: '越野',
};

/**
 * 產生月曆網格陣列。
 * @param {number} year - 年份。
 * @param {number} month - 月份（0-11）。
 * @returns {(number|null)[]} 日期陣列，null 為前置空格。
 */
export function buildCalendarGrid(year, month) {
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  /** @type {(number|null)[]} */
  const nullPadding = Array.from({ length: startDay }, () => null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return [...nullPadding, ...days];
}

/**
 * @typedef {object} DayRunSummary
 * @property {string} type - 活動類型。
 * @property {number} totalMeters - 該類型當日總距離（公尺）。
 */

/**
 * @typedef {object} DayActivities
 * @property {string} dateKey - 日期 key（YYYY-MM-DD 格式）。
 * @property {number} day - 日期數字（1-31）。
 * @property {DayRunSummary[]} runs - 各類型跑步摘要（已聚合）。
 * @property {number} totalMeters - 當日全類型總距離（公尺）。
 */

/**
 * @typedef {object} MonthTypeSummary
 * @property {string} type - 活動類型。
 * @property {number} totalMeters - 該類型當月總距離（公尺）。
 * @property {string} label - 顯示標籤（如「戶外」「室內」「越野」）。
 */

/**
 * @typedef {object} MonthSummary
 * @property {number} totalMeters - 當月全類型總距離（公尺）。
 * @property {MonthTypeSummary[]} byType - 各類型小計（僅含有紀錄的類型）。
 */

export { groupActivitiesByDay, calcMonthSummary } from '@/service/strava-data-service';
