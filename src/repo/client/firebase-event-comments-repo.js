import {
  doc,
  collection,
  query,
  getDocs,
  getDoc,
  addDoc,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * @typedef {import('firebase/firestore').QueryConstraint} QueryConstraint
 * @typedef {import('firebase/firestore').DocumentSnapshot} DocumentSnapshot
 */

/**
 * 取得留言頁。
 * @param {string} eventId - 活動 ID。
 * @param {{ afterDoc?: DocumentSnapshot, limitCount?: number }} [options] - 分頁選項。
 * @returns {Promise<{ docs: DocumentSnapshot[], lastDoc: DocumentSnapshot | null }>} 留言頁資料。
 */
export async function fetchEventCommentPage(eventId, options = {}) {
  const { afterDoc, limitCount = 15 } = options;
  const ref = collection(db, 'events', eventId, 'comments');
  /** @type {QueryConstraint[]} */
  const constraints = [orderBy('createdAt', 'desc'), limit(limitCount)];

  if (afterDoc) {
    constraints.push(startAfter(afterDoc));
  }

  const snapshot = await getDocs(query(ref, ...constraints));
  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 取得單筆留言文件。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<DocumentSnapshot>} 文件快照。
 */
export async function fetchEventCommentDocument(eventId, commentId) {
  return getDoc(doc(db, 'events', eventId, 'comments', commentId));
}

/**
 * 新增留言文件。
 * @param {string} eventId - 活動 ID。
 * @param {object} payload - Firestore payload。
 * @returns {Promise<import('firebase/firestore').DocumentReference>} 新文件參照。
 */
export async function addEventCommentDocument(eventId, payload) {
  return addDoc(collection(db, 'events', eventId, 'comments'), payload);
}

/**
 * 更新留言並寫入歷史。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @param {object} historyPayload - 要寫入 history 子集合的 payload。
 * @param {object} commentUpdate - 要更新到 comment 文件的 payload。
 * @returns {Promise<void>}
 */
export async function updateEventCommentDocument(
  eventId,
  commentId,
  historyPayload,
  commentUpdate,
) {
  const commentRef = doc(db, 'events', eventId, 'comments', commentId);
  const historyCollectionRef = collection(db, 'events', eventId, 'comments', commentId, 'history');
  const historyDocRef = doc(historyCollectionRef);

  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(commentRef);
    if (!snapshot.exists()) {
      throw new Error('Comment not found');
    }

    tx.set(historyDocRef, historyPayload);
    tx.update(commentRef, commentUpdate);
  });
}

/**
 * 刪除留言及其 history 子集合。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<void>}
 */
export async function deleteEventCommentDocument(eventId, commentId) {
  const commentRef = doc(db, 'events', eventId, 'comments', commentId);
  const historyRef = collection(db, 'events', eventId, 'comments', commentId, 'history');
  const historySnapshot = await getDocs(historyRef);
  const batch = writeBatch(db);

  historySnapshot.docs.forEach((historyDoc) => batch.delete(historyDoc.ref));
  batch.delete(commentRef);

  await batch.commit();
}

/**
 * 取得留言歷史列表。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<DocumentSnapshot[]>} 歷史文件列表。
 */
export async function fetchEventCommentHistoryDocuments(eventId, commentId) {
  const snapshot = await getDocs(
    query(collection(db, 'events', eventId, 'comments', commentId, 'history'), orderBy('editedAt', 'asc')),
  );

  return snapshot.docs;
}
