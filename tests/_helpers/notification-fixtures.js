import { createFirestoreDocSnapshot, createFirestoreQuerySnapshot } from './factories';

/**
 * @typedef {object} TimestampLike
 * @property {() => Date} toDate - Converts to Date.
 * @property {() => number} toMillis - Converts to epoch milliseconds.
 */

/**
 * @typedef {'event_modified'|'event_cancelled'|'post_new_comment'|'post_comment_reply'|'event_host_comment'|'event_participant_comment'|'event_comment_reply'} NotificationFixtureType
 */

/**
 * @typedef {object} NotificationFixture
 * @property {string} id - Notification ID.
 * @property {string} recipientUid - Recipient UID.
 * @property {NotificationFixtureType} type - Notification type.
 * @property {string} actorUid - Actor UID.
 * @property {string} actorName - Actor display name.
 * @property {string} actorPhotoURL - Actor avatar URL.
 * @property {'event'|'post'} entityType - Linked entity type.
 * @property {string} entityId - Linked entity ID.
 * @property {string} entityTitle - Linked entity title.
 * @property {string | null} commentId - Linked comment ID.
 * @property {string} message - Notification message.
 * @property {boolean} read - Whether the notification has been read.
 * @property {TimestampLike | Date | object} createdAt - Firestore timestamp-like value.
 */

/**
 * @typedef {object} NotificationListOptions
 * @property {number} [startIndex] - Starting numeric suffix.
 * @property {string} [prefix] - Notification ID prefix.
 * @property {boolean} [read] - Whether generated notifications are read.
 * @property {boolean} [descending] - Generate IDs from newest to oldest.
 * @property {(id: string, index: number) => Partial<NotificationFixture>} [getOverrides] - Per-item overrides.
 */

/**
 * Creates a timestamp-like test value.
 * @param {number} ms - Epoch milliseconds.
 * @returns {TimestampLike} Timestamp-like object.
 */
export function createTimestampLike(ms) {
  return {
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
}

/**
 * Creates a notification fixture with domain defaults.
 * @param {Partial<NotificationFixture>} [overrides] - Field overrides.
 * @returns {NotificationFixture} Notification fixture.
 */
export function createNotificationFixture(overrides = {}) {
  return {
    id: 'n1',
    recipientUid: 'user1',
    type: 'event_modified',
    actorUid: 'actor1',
    actorName: 'Test Actor',
    actorPhotoURL: 'https://example.com/photo.jpg',
    entityType: 'event',
    entityId: 'evt1',
    entityTitle: '週末跑步',
    commentId: null,
    message: '你所參加的『週末跑步』活動資訊有更動',
    read: false,
    createdAt: createTimestampLike(Date.now() - 5 * 60 * 1000),
    ...overrides,
  };
}

/**
 * Creates one indexed notification fixture with deterministic message and timestamp.
 * @param {string} id - Notification ID.
 * @param {number} [index] - Timestamp index; defaults to the numeric suffix in `id`.
 * @param {Partial<NotificationFixture>} [overrides] - Field overrides.
 * @returns {NotificationFixture} Notification fixture.
 */
export function createIndexedNotificationFixture(id, index, overrides = {}) {
  const parsedIndex = Number.parseInt(id.replace(/\D+/g, ''), 10);
  const numericIndex = index ?? (Number.isNaN(parsedIndex) ? 1 : parsedIndex);
  return createNotificationFixture({
    id,
    actorName: 'Actor',
    entityTitle: '跑步',
    message: `通知 ${id}`,
    createdAt: createTimestampLike(numericIndex * 1000),
    ...overrides,
  });
}

/**
 * Creates indexed notification fixtures with deterministic timestamps.
 * @param {number} count - Number of notifications.
 * @param {NotificationListOptions} [options] - List options.
 * @returns {NotificationFixture[]} Notification fixtures.
 */
export function createNotificationList(count, options = {}) {
  const { startIndex = 1, prefix = 'n', read = false, descending = false, getOverrides } = options;
  return Array.from({ length: count }, (_, offset) => {
    const index = descending ? startIndex + count - 1 - offset : startIndex + offset;
    const id = `${prefix}${index}`;
    return createIndexedNotificationFixture(id, index, {
      read,
      ...getOverrides?.(id, index),
    });
  });
}

/**
 * @typedef {object} NotificationDocOptions
 * @property {boolean} [includeIdInData] - Keep the ID inside the snapshot data payload.
 * @property {string} [path] - Firestore-like document path.
 */

/**
 * Wraps a notification fixture in a Firestore-like document snapshot.
 * @param {NotificationFixture} notification - Notification fixture.
 * @param {NotificationDocOptions} [options] - Snapshot options.
 * @returns {import('./factories').FirestoreDocSnapshot} Firestore-like document snapshot.
 */
export function createNotificationDocSnapshot(notification, options = {}) {
  const data = options.includeIdInData
    ? notification
    : Object.fromEntries(Object.entries(notification).filter(([key]) => key !== 'id'));

  return createFirestoreDocSnapshot(notification.id, data, {
    path: options.path ?? `notifications/${notification.id}`,
  });
}

/**
 * Creates a Firestore-like query snapshot for notification fixtures.
 * @param {NotificationFixture[]} notifications - Notification fixtures.
 * @param {NotificationFixture[]} [addedNotifications] - Added notification changes.
 * @returns {import('./factories').FirestoreQuerySnapshot} Firestore-like query snapshot.
 */
export function createNotificationQuerySnapshot(notifications, addedNotifications = []) {
  return createFirestoreQuerySnapshot(
    notifications.map((notification) => createNotificationDocSnapshot(notification)),
    {
      changes: addedNotifications.map((notification) => ({
        type: 'added',
        doc: createNotificationDocSnapshot(notification),
      })),
    },
  );
}
