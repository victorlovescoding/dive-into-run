/**
 * @typedef {object} NotificationItem
 * @property {string} id - Firestore document ID。
 * @property {string} recipientUid - 通知接收者 UID。
 * @property {'event_modified'|'event_cancelled'|'post_new_comment'} type - 通知類型。
 * @property {string} actorUid - 觸發者 UID。
 * @property {string} actorName - 觸發者顯示名稱。
 * @property {string} actorPhotoURL - 觸發者頭像 URL。
 * @property {'event'|'post'} entityType - 關聯實體類型。
 * @property {string} entityId - 關聯實體 ID。
 * @property {string} entityTitle - 關聯實體標題。
 * @property {string|null} commentId - 留言 ID。
 * @property {string} message - 完整通知訊息文字。
 * @property {boolean} read - 是否已讀。
 * @property {import('firebase/firestore').Timestamp} createdAt - 建立時間。
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * 將 Firestore Timestamp 格式化為相對時間中文字串。
 * @param {import('firebase/firestore').Timestamp | Date} timestamp - 時間。
 * @returns {string} 相對時間字串（如「剛剛」、「5 分鐘前」、「4/6」）。
 */
export function formatRelativeTime(timestamp) {
  const date =
    timestamp instanceof Date
      ? timestamp
      : /** @type {import('firebase/firestore').Timestamp} */ (timestamp).toDate();
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff <= MINUTE_MS) {
    return '剛剛';
  }

  const minutes = Math.floor(diff / MINUTE_MS);
  if (minutes < 60) {
    return `${minutes} 分鐘前`;
  }

  const hours = Math.floor(diff / HOUR_MS);
  if (diff < DAY_MS) {
    return `${hours} 小時前`;
  }

  const days = Math.floor(diff / DAY_MS);
  if (diff < WEEK_MS) {
    return `${days} 天前`;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/** @type {Record<string, (title: string) => string>} */
const MESSAGE_BUILDERS = {
  event_modified: (title) => `你所參加的『${title}』活動資訊有更動`,
  event_cancelled: (title) => `你所參加的『${title}』已取消`,
  post_new_comment: (title) => `你的文章『${title}』有一則新的留言`,
};

/**
 * 根據通知類型與實體標題組合通知訊息。
 * @param {'event_modified'|'event_cancelled'|'post_new_comment'} type - 通知類型。
 * @param {string} entityTitle - 實體標題。
 * @returns {string} 完整通知訊息。
 */
export function buildNotificationMessage(type, entityTitle) {
  const builder = MESSAGE_BUILDERS[type];
  return builder(entityTitle);
}

/**
 * 根據通知資料回傳導航 URL。
 * @param {NotificationItem} notification - 通知資料。
 * @returns {string} 導航目標 URL。
 */
export function getNotificationLink(notification) {
  const { type, entityId, commentId } = notification;

  if (type === 'post_new_comment') {
    return `/posts/${entityId}?commentId=${commentId}`;
  }

  return `/events/${entityId}`;
}
