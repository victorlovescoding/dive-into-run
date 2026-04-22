/**
 * @typedef {object} Actor
 * @property {string} uid - 觸發者 UID。
 * @property {string} name - 觸發者顯示名稱。
 * @property {string} photoURL - 觸發者頭像 URL。
 */

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
 * @typedef {'event_modified'|'event_cancelled'|'post_new_comment'|'post_comment_reply'|'event_host_comment'|'event_participant_comment'|'event_comment_reply'} NotificationType
 */

/**
 * 建立 Firestore notification document 的共用 helper。
 * @param {object} params - 通知文件欄位。
 * @param {string} params.recipientUid - 通知接收者 UID。
 * @param {string} params.type - 通知類型（如 'post_new_comment'）。
 * @param {string} params.entityType - 實體類型（'post' 或 'event'）。
 * @param {string} params.entityId - 實體 ID。
 * @param {string} params.entityTitle - 實體標題。
 * @param {string|null} params.commentId - 留言 ID。
 * @param {string} params.message - 通知訊息文字。
 * @param {Actor} params.actor - 觸發者資訊。
 * @param {unknown} params.createdAtValue - 由 runtime 注入的 createdAt 值。
 * @returns {object} Firestore notification document。
 */
export function buildNotificationDoc({
  recipientUid,
  type,
  entityType,
  entityId,
  entityTitle,
  commentId,
  message,
  actor,
  createdAtValue,
}) {
  return {
    recipientUid,
    type,
    actorUid: actor.uid,
    actorName: actor.name,
    actorPhotoURL: actor.photoURL,
    entityType,
    entityId,
    entityTitle,
    commentId,
    message,
    read: false,
    createdAt: createdAtValue,
  };
}

/**
 * 將 Firestore snapshot 正規化成 NotificationItem。
 * @param {{ id: string, data: () => object }} snapshot - Firestore 文件快照。
 * @returns {NotificationItem} 通知資料。
 */
export function toNotificationItem(snapshot) {
  return /** @type {NotificationItem} */ ({
    id: snapshot.id,
    ...snapshot.data(),
  });
}

/**
 * 將多筆 Firestore snapshot 正規化成 NotificationItem[]。
 * @param {Array<{ id: string, data: () => object }>} snapshots - Firestore 文件快照列表。
 * @returns {NotificationItem[]} 通知資料陣列。
 */
export function toNotificationItems(snapshots) {
  return snapshots.map((snapshot) => toNotificationItem(snapshot));
}
