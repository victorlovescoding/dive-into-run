/**
 * @typedef {object} NotificationItem
 * @property {string} id - Firestore document ID。
 * @property {string} recipientUid - 通知接收者 UID。
 * @property {NotificationType} type - 通知類型。
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

/**
 * @typedef {'event_modified'|'event_cancelled'|'post_new_comment'|'post_comment_reply'|'event_host_comment'|'event_participant_comment'|'event_comment_reply'|'event_host_joined'} NotificationType
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

export { buildNotificationMessage } from '@/service/notification-service';

const POST_COMMENT_TYPES = new Set(['post_new_comment', 'post_comment_reply']);
const EVENT_COMMENT_TYPES = new Set([
  'event_host_comment',
  'event_participant_comment',
  'event_comment_reply',
]);
const EVENT_TYPES = new Set([
  ...EVENT_COMMENT_TYPES,
  'event_modified',
  'event_cancelled',
  'event_host_joined',
]);

/**
 * Resolves the notification destination family.
 * @param {NotificationItem} notification - 通知資料。
 * @returns {'/posts'|'/events'} 導航根路徑。
 */
function getNotificationBasePath(notification) {
  if (POST_COMMENT_TYPES.has(notification.type)) {
    return '/posts';
  }

  if (EVENT_TYPES.has(notification.type)) {
    return '/events';
  }

  return notification.entityType === 'post' ? '/posts' : '/events';
}

/**
 * 根據通知資料回傳導航 URL。
 * @param {NotificationItem} notification - 通知資料。
 * @returns {string} 導航目標 URL。
 */
export function getNotificationLink(notification) {
  const { type, entityId, commentId } = notification;
  const basePath = getNotificationBasePath(notification);

  if (!entityId) {
    return basePath;
  }

  const detailPath = `${basePath}/${entityId}`;
  const hasCommentTarget = POST_COMMENT_TYPES.has(type) || EVENT_COMMENT_TYPES.has(type);

  if (hasCommentTarget && commentId) {
    return `${detailPath}?commentId=${commentId}`;
  }

  return detailPath;
}
