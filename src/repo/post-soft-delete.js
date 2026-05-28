/** @type {number} 文章與留言軟刪除保留天數。 */
export const POST_DELETE_RETENTION_DAYS = 90;

/**
 * 計算指定日期加上天數後的時間。
 * @param {Date} date - 基準時間。
 * @param {number} days - 要加上的天數。
 * @returns {Date} 加上天數後的新 Date。
 */
export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * 建立文章或留言軟刪除 payload。
 * @param {object} root0 - 參數物件。
 * @param {string | null | undefined} root0.actorUid - 執行軟刪除的使用者 UID。
 * @param {unknown} root0.deletedAtValue - 寫入 `deletedAt` 的時間值。
 * @param {unknown} root0.purgeAtValue - 寫入 `deletedPurgeAt` 的時間值。
 * @returns {{ deletedAt: unknown, deletedByUid: string, deletedPurgeAt: unknown }} 軟刪除欄位 payload。
 */
export function buildSoftDeletePayload({ actorUid, deletedAtValue, purgeAtValue }) {
  if (!actorUid) throw new Error('softDelete: actorUid is required');
  return { deletedAt: deletedAtValue, deletedByUid: actorUid, deletedPurgeAt: purgeAtValue };
}

/**
 * 判斷資料是否已被軟刪除。
 * @param {Record<string, unknown> | null | undefined} record - Firestore 正規化資料。
 * @returns {boolean} 有 `deletedAt` 欄位時為 true。
 */
export function isSoftDeletedRecord(record) {
  return !!record && Object.prototype.hasOwnProperty.call(record, 'deletedAt');
}
