import { countTotalPoints } from '@/runtime/events/event-runtime-helpers';

/**
 * 格式化日期時間值（支援 string 或 Firestore Timestamp）。
 * @param {string | { toDate?: () => Date } | null | undefined} value - 日期時間值。
 * @returns {string} 格式化後的日期字串。
 */
export function formatDateTime(value) {
  if (!value) return '';

  if (typeof value === 'string') return value.replace('T', ' ');

  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  return String(value);
}

/**
 * 將秒數轉換為 MM:SS 配速格式。
 * @param {number | string | null | undefined} paceSec - 配速秒數。
 * @param {string} [fallbackText] - 無法轉換時的備用文字。
 * @returns {string} 格式化後的配速字串。
 */
export function formatPace(paceSec, fallbackText = '') {
  if (paceSec === null || paceSec === undefined || paceSec === '') {
    if (typeof fallbackText === 'string' && fallbackText.trim()) return fallbackText;
    return '';
  }

  const normalizedPace = typeof paceSec === 'number' ? paceSec : Number(paceSec);
  if (Number.isFinite(normalizedPace) && normalizedPace >= 0) {
    const minutes = Math.floor(normalizedPace / 60);
    const seconds = normalizedPace % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (typeof fallbackText === 'string' && fallbackText.trim()) return fallbackText;
  return '';
}

/**
 * 將活動路線資料格式化為顯示文字（已設定/未設定）。
 * @param {import('@/service/event-service').EventData} event - 活動資料。
 * @returns {string} 顯示用的路線狀態描述。
 */
export function renderRouteLabel(event) {
  const points = countTotalPoints(event.routeCoordinates);
  if (points > 0) return `已設定（${points} 點）`;
  if (event.route?.pointsCount) return `已設定（${event.route.pointsCount} 點）`;
  return '未設定';
}
