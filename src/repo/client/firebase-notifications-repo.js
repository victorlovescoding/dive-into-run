import {
  collection,
  addDoc,
  writeBatch,
  doc,
  onSnapshot,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 */

/**
 * 新增單則通知文件。
 * @param {object} payload - Firestore payload。
 * @returns {Promise<import('firebase/firestore').DocumentReference>} 新文件參照。
 */
export async function addNotificationDocument(payload) {
  return addDoc(collection(db, 'notifications'), payload);
}

/**
 * 批次建立通知文件。
 * @param {object[]} payloads - Firestore payload 列表。
 * @returns {Promise<void>}
 */
export async function addNotificationDocuments(payloads) {
  if (!payloads.length) return;

  const batch = writeBatch(db);
  payloads.forEach((payload) => {
    batch.set(doc(collection(db, 'notifications')), payload);
  });

  await batch.commit();
}

/**
 * 查詢 comments subcollection 中所有不重複的 authorUid。
 * @param {import('firebase/firestore').CollectionReference} commentsRef - comments collection reference。
 * @returns {Promise<string[]>} 不重複的 authorUid 陣列。
 */
export async function fetchDistinctCommentAuthors(commentsRef) {
  const snapshot = await getDocs(commentsRef);
  const uids = snapshot.docs.map((d) => d.data().authorUid);
  return [...new Set(uids)];
}

/**
 * 取得文章 comments subcollection 中所有不重複的 authorUid。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<string[]>} 不重複的 authorUid 陣列。
 */
export async function fetchDistinctPostCommentAuthors(postId) {
  return fetchDistinctCommentAuthors(collection(db, 'posts', postId, 'comments'));
}

/**
 * 取得活動 comments subcollection 中所有不重複的 authorUid。
 * @param {string} eventId - 活動 ID。
 * @returns {Promise<string[]>} 不重複的 authorUid 陣列。
 */
export async function fetchDistinctEventCommentAuthors(eventId) {
  return fetchDistinctCommentAuthors(collection(db, 'events', eventId, 'comments'));
}

/**
 * 監聽使用者最新通知文件。
 * @param {string} uid - 使用者 UID。
 * @param {(docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null) => void} onNext - 完整文件回呼。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @param {(docs: QueryDocumentSnapshot[]) => void} [onNew] - 新增通知回呼（排除首次載入）。
 * @returns {() => void} 退訂函式。
 */
export function watchNotificationDocuments(uid, onNext, onError, onNew) {
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
      onNext(
        snapshot.docs,
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
          .map((change) => change.doc);

        if (added.length > 0) {
          onNew(added);
        }
      }
    },
    onError,
  );
}

/**
 * 監聽使用者未讀通知文件。
 * @param {string} uid - 使用者 UID。
 * @param {(docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null) => void} onNext - 完整文件回呼。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @returns {() => void} 退訂函式。
 */
export function watchUnreadNotificationDocuments(uid, onNext, onError) {
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
      onNext(
        snapshot.docs,
        snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      );
    },
    onError,
  );
}

/**
 * 載入更多通知文件。
 * @param {string} uid - 使用者 UID。
 * @param {QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchMoreNotificationDocuments(uid, afterDoc, limitCount) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    orderBy('createdAt', 'desc'),
    startAfter(afterDoc),
    limit(limitCount || 5),
  );

  const snapshot = await getDocs(q);
  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 載入更多未讀通知文件。
 * @param {string} uid - 使用者 UID。
 * @param {QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchMoreUnreadNotificationDocuments(uid, afterDoc, limitCount) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    startAfter(afterDoc),
    limit(limitCount || 5),
  );

  const snapshot = await getDocs(q);
  return {
    docs: snapshot.docs,
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
