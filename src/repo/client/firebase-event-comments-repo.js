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
} from 'firebase/firestore';
import { auth, db } from '@/config/client/firebase-client';
import {
  buildSoftDeletePayload,
  isSoftDeletedRecord,
} from '@/repo/soft-delete-retention';

/**
 * @typedef {import('firebase/firestore').QueryConstraint} QueryConstraint
 * @typedef {import('firebase/firestore').DocumentSnapshot} DocumentSnapshot
 */

/**
 * Builds the product-path permission error for unauthorized event comment deletes.
 * @returns {Error & { code: string }} Permission-denied error.
 */
function createPermissionDeniedError() {
  return Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
}

/**
 * Reads the current Firebase Auth UID for event comment soft-delete writes.
 * @returns {string} Actor UID.
 */
function requireCurrentActorUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw createPermissionDeniedError();
  return String(uid);
}

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
    if (!snapshot.exists() || isSoftDeletedRecord(snapshot.data())) {
      throw new Error('Comment not found');
    }

    tx.set(historyDocRef, historyPayload);
    tx.update(commentRef, commentUpdate);
  });
}

/**
 * 軟刪除留言並保留 history 子集合。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<void>}
 */
export async function deleteEventCommentDocument(eventId, commentId) {
  const actorUid = requireCurrentActorUid();
  const commentRef = doc(db, 'events', eventId, 'comments', commentId);

  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(commentRef);
    if (!snapshot.exists()) return;
    if (isSoftDeletedRecord(snapshot.data())) return;

    const deletedAt = new Date();
    const payload = buildSoftDeletePayload({
      actorUid,
      deletedAt,
    });

    tx.update(commentRef, payload);
  });
}

/**
 * 取得留言歷史列表。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<DocumentSnapshot[]>} 歷史文件列表。
 */
export async function fetchEventCommentHistoryDocuments(eventId, commentId) {
  const snapshot = await getDocs(
    query(
      collection(db, 'events', eventId, 'comments', commentId, 'history'),
      orderBy('editedAt', 'asc'),
    ),
  );

  return snapshot.docs;
}
