import { formatDateTime } from './event-formatters';

const EMPTY_FILTER_TEXT = '';

/**
 * 將任意值轉為非負整數，供卡片掃描資訊防守舊資料。
 * @param {unknown} value - 可能來自 Firestore 或舊資料的數值。
 * @returns {number} 非負整數；無法解析時回傳 0。
 */
function toNonNegativeInteger(value) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Math.floor(numberValue);
}

/**
 * 將日期值轉為 timestamp，支援 ISO 字串、Date、Firestore Timestamp。
 * @param {unknown} value - 日期來源值。
 * @returns {number | null} timestamp；無法解析時回傳 null。
 */
function toTimestampMs(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === 'object' && typeof /** @type {{ toDate?: unknown }} */ (value).toDate === 'function') {
    const date = /** @type {{ toDate: () => Date }} */ (value).toDate();
    const time = date.getTime();
    return Number.isFinite(time) ? time : null;
  }

  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * 建立活動名額掃描資料。
 * @param {object} event - 活動資料。
 * @param {(event: object) => number} getRemainingSeats - 剩餘名額計算器。
 * @returns {{ maxParticipants: number, remainingSeats: number, joinedCount: number, usagePercent: number } | null} 名額掃描資料。
 */
export function buildCapacitySummary(event, getRemainingSeats) {
  const maxParticipants = toNonNegativeInteger(
    /** @type {{ maxParticipants?: unknown }} */ (event).maxParticipants,
  );
  if (maxParticipants <= 0) return null;

  const rawRemainingSeats = toNonNegativeInteger(getRemainingSeats(event));
  const remainingSeats = Math.min(rawRemainingSeats, maxParticipants);
  const joinedCount = Math.max(0, maxParticipants - remainingSeats);
  const usagePercent = Math.min(100, Math.round((joinedCount / maxParticipants) * 100));

  return {
    maxParticipants,
    remainingSeats,
    joinedCount,
    usagePercent,
  };
}

/**
 * 依活動時間、報名截止與名額決定列表狀態 chip。
 * @param {object} event - 活動資料。
 * @param {number | null | undefined} remainingSeats - 剩餘名額。
 * @returns {{ label: string, tone: 'started' | 'closed' | 'full' | 'open' }} 狀態文案與樣式 tone。
 */
export function buildStatusChip(event, remainingSeats) {
  const now = Date.now();
  const eventTimeMs = toTimestampMs(/** @type {{ time?: unknown }} */ (event).time);
  const deadlineMs = toTimestampMs(
    /** @type {{ registrationDeadline?: unknown }} */ (event).registrationDeadline,
  );

  if (eventTimeMs !== null && now >= eventTimeMs) {
    return { label: '活動已開始', tone: 'started' };
  }
  if (deadlineMs !== null && now >= deadlineMs) {
    return { label: '報名已截止', tone: 'closed' };
  }
  if (typeof remainingSeats === 'number' && remainingSeats <= 0) {
    return { label: '已額滿', tone: 'full' };
  }
  return { label: '報名中', tone: 'open' };
}

/**
 * 建立卡片首屏掃描摘要。
 * @param {object} event - 活動資料。
 * @param {(event: object) => number} getRemainingSeats - 剩餘名額計算器。
 * @returns {{ runType: string, status: ReturnType<typeof buildStatusChip>, capacity: ReturnType<typeof buildCapacitySummary> }} 卡片掃描摘要。
 */
export function buildEventScanSummary(event, getRemainingSeats) {
  const capacity = buildCapacitySummary(event, getRemainingSeats);
  const runType = String(/** @type {{ runType?: unknown }} */ (event).runType || '').trim();

  return {
    runType,
    status: buildStatusChip(event, capacity?.remainingSeats),
    capacity,
  };
}

/**
 * 格式化篩選範圍 chip。
 * @param {string} minValue - 起始值。
 * @param {string} maxValue - 結束值。
 * @param {(value: string) => string} formatValue - 單一值格式化器。
 * @param {string} [emptyText] - 空值文字。
 * @returns {string} 範圍文案。
 */
function formatFilterRange(minValue, maxValue, formatValue, emptyText = '') {
  if (minValue && maxValue) return `${formatValue(minValue)} - ${formatValue(maxValue)}`;
  if (minValue) return `${formatValue(minValue)} 起`;
  if (maxValue) return `${formatValue(maxValue)} 前`;
  return emptyText;
}

/**
 * 格式化距離篩選範圍。
 * @param {string} minDistance - 最小距離。
 * @param {string} maxDistance - 最大距離。
 * @returns {string} 距離範圍文案。
 */
function formatDistanceFilter(minDistance, maxDistance) {
  if (minDistance && maxDistance) return `${minDistance} - ${maxDistance} km`;
  if (minDistance) return `${minDistance} km 以上`;
  if (maxDistance) return `${maxDistance} km 以下`;
  return '';
}

/**
 * 建立已套用篩選 chip 文案。
 * @param {{ city?: string, district?: string, startTime?: string, endTime?: string, minDistance?: string, maxDistance?: string, hasSeatsOnly?: boolean } | null | undefined} appliedFilters - 已套用的篩選條件。
 * @returns {string[]} chip 文案列表。
 */
export function buildAppliedFilterChips(appliedFilters) {
  const chips = [];
  const city = String(appliedFilters?.city || '').trim();
  const district = String(appliedFilters?.district || '').trim();
  const startTime = String(appliedFilters?.startTime || '').trim();
  const endTime = String(appliedFilters?.endTime || '').trim();
  const minDistance = String(appliedFilters?.minDistance || '').trim();
  const maxDistance = String(appliedFilters?.maxDistance || '').trim();

  const locationText = [city, district].filter(Boolean).join(' ');
  if (locationText) chips.push(`地點：${locationText}`);

  const timeText = formatFilterRange(startTime, endTime, formatDateTime, EMPTY_FILTER_TEXT);
  if (timeText) chips.push(`時間：${timeText}`);

  const distanceText = formatDistanceFilter(minDistance, maxDistance);
  if (distanceText) chips.push(`距離：${distanceText}`);

  if (appliedFilters?.hasSeatsOnly) chips.push('有名額');

  return chips;
}
