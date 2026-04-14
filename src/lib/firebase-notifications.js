import {
  collection,
  addDoc,
  writeBatch,
  doc,
  serverTimestamp,
  onSnapshot,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { db } from './firebase-client';
import { fetchParticipants } from './firebase-events';
import { buildNotificationMessage } from './notification-helpers';

/**
 * @typedef {object} Actor
 * @property {string} uid - 觸發者 UID。
 * @property {string} name - 觸發者顯示名稱。
 * @property {string} photoURL - 觸發者頭像 URL。
 */

/**
 * 建立「活動被修改」通知給所有參加者（排除觸發者）。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {Actor} actor - 修改活動的使用者。
 * @returns {Promise<void>}
 */
export async function notifyEventModified(eventId, eventTitle, actor) {
  const participants = await fetchParticipants(eventId);
  const recipients = participants.filter((p) => p.uid !== actor.uid);
  if (recipients.length === 0) return;

  const message = buildNotificationMessage('event_modified', eventTitle);
  const batch = writeBatch(db);

  recipients.forEach((p) => {
    const ref = doc(collection(db, 'notifications'));
    batch.set(ref, {
      recipientUid: p.uid,
      type: 'event_modified',
      actorUid: actor.uid,
      actorName: actor.name,
      actorPhotoURL: actor.photoURL,
      entityType: 'event',
      entityId: eventId,
      entityTitle: eventTitle,
      commentId: null,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * 建立「活動已取消」通知給所有參加者（排除觸發者）。
 * 參加者清單由呼叫端預先取得並傳入。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {{ uid: string }[]} participants - 預先取得的參加者清單。
 * @param {Actor} actor - 取消活動的使用者。
 * @returns {Promise<void>}
 */
export async function notifyEventCancelled(eventId, eventTitle, participants, actor) {
  const recipients = participants.filter((p) => p.uid !== actor.uid);
  if (recipients.length === 0) return;

  const message = buildNotificationMessage('event_cancelled', eventTitle);
  const batch = writeBatch(db);

  recipients.forEach((p) => {
    const ref = doc(collection(db, 'notifications'));
    batch.set(ref, {
      recipientUid: p.uid,
      type: 'event_cancelled',
      actorUid: actor.uid,
      actorName: actor.name,
      actorPhotoURL: actor.photoURL,
      entityType: 'event',
      entityId: eventId,
      entityTitle: eventTitle,
      commentId: null,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * 建立「文章有新留言」通知給文章作者。
 * 若留言者就是文章作者本人則不發通知。
 * @param {string} postId - 文章 ID。
 * @param {string} postTitle - 文章標題。
 * @param {string} postAuthorUid - 文章作者 UID。
 * @param {string} commentId - 留言 ID。
 * @param {Actor} actor - 留言的使用者。
 * @returns {Promise<void>}
 */
export async function notifyPostNewComment(postId, postTitle, postAuthorUid, commentId, actor) {
  if (actor.uid === postAuthorUid) return;

  const message = buildNotificationMessage('post_new_comment', postTitle);

  await addDoc(collection(db, 'notifications'), {
    recipientUid: postAuthorUid,
    type: 'post_new_comment',
    actorUid: actor.uid,
    actorName: actor.name,
    actorPhotoURL: actor.photoURL,
    entityType: 'post',
    entityId: postId,
    entityTitle: postTitle,
    commentId,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Read / Update functions
// ---------------------------------------------------------------------------

/**
 * 監聽使用者最新通知（即時更新）。
 * @param {string} uid - 使用者 UID。
 * @param {(notifications: import('./notification-helpers').NotificationItem[], lastDoc?: import('firebase/firestore').QueryDocumentSnapshot | null) => void} onNext - 完整列表回呼，第二參數為最後一筆 doc snapshot（分頁游標）。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @param {(newNotifications: import('./notification-helpers').NotificationItem[]) => void} [onNew] - 新增通知回呼（排除首次載入）。
 * @returns {() => void} 退訂函式。
 */
export function watchNotifications(uid, onNext, onError, onNew) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(5),
  );

  let isInitialLoad = true;

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      onNext(
        /** @type {import('./notification-helpers').NotificationItem[]} */ (notifications),
        snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      );

      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }

      if (onNew) {
        const added = snapshot
          .docChanges()
          .filter((change) => change.type === 'added')
          .map((change) => ({
            id: change.doc.id,
            ...change.doc.data(),
          }));
        if (added.length > 0) {
          onNew(/** @type {import('./notification-helpers').NotificationItem[]} */ (added));
        }
      }
    },
    onError,
  );
}

/**
 * 監聽使用者未讀通知（即時更新），用於未讀計數與「未讀」分頁。
 * @param {string} uid - 使用者 UID。
 * @param {(notifications: import('./notification-helpers').NotificationItem[], lastDoc?: import('firebase/firestore').QueryDocumentSnapshot | null) => void} onNext - 資料回呼，第二參數為最後一筆 doc snapshot（分頁游標）。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @returns {() => void} 退訂函式。
 */
export function watchUnreadNotifications(uid, onNext, onError) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(100),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      onNext(
        /** @type {import('./notification-helpers').NotificationItem[]} */ (notifications),
        snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      );
    },
    onError,
  );
}

/**
 * 載入更多通知（分頁查詢）。
 * @param {string} uid - 使用者 UID。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數，預設 5。
 * @returns {Promise<{ notifications: import('./notification-helpers').NotificationItem[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchMoreNotifications(uid, afterDoc, limitCount) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    orderBy('createdAt', 'desc'),
    startAfter(afterDoc),
    limit(limitCount || 5),
  );

  const snapshot = await getDocs(q);
  const notifications = /** @type {import('./notification-helpers').NotificationItem[]} */ (
    snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  );

  return {
    notifications,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 載入更多未讀通知（分頁查詢）。
 * @param {string} uid - 使用者 UID。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數，預設 5。
 * @returns {Promise<{ notifications: import('./notification-helpers').NotificationItem[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchMoreUnreadNotifications(uid, afterDoc, limitCount) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    startAfter(afterDoc),
    limit(limitCount || 5),
  );

  const snapshot = await getDocs(q);
  const notifications = /** @type {import('./notification-helpers').NotificationItem[]} */ (
    snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  );

  return {
    notifications,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 標記單則通知為已讀。
 * @param {string} notificationId - 通知 document ID。
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}
