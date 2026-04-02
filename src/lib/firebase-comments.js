/**
 * @file Service layer for event comments (Firestore).
 * @description
 * CRUD operations for comments subcollection under events.
 * TDD stub — functions are declared but NOT implemented yet.
 */

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
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

/**
 * @typedef {object} CommentData
 * @property {string} id - 留言 ID。
 * @property {string} authorUid - 留言者 UID。
 * @property {string} authorName - 留言者名稱。
 * @property {string} authorPhotoURL - 留言者大頭貼 URL。
 * @property {string} content - 留言內容。
 * @property {import('firebase/firestore').Timestamp} createdAt - 建立時間。
 * @property {import('firebase/firestore').Timestamp | null} updatedAt - 最後編輯時間。
 * @property {boolean} isEdited - 是否曾被編輯。
 */

/**
 * @typedef {object} CommentHistoryEntry
 * @property {string} id - 歷史記錄 ID。
 * @property {string} content - 該版本的留言內容。
 * @property {import('firebase/firestore').Timestamp} editedAt - 該版本被取代的時間。
 */

/**
 * @typedef {object} FetchCommentsResult
 * @property {CommentData[]} comments - 留言列表。
 * @property {import('firebase/firestore').DocumentSnapshot | null} lastDoc - 分頁游標。
 */

/**
 * @typedef {object} FetchCommentsOptions
 * @property {import('firebase/firestore').DocumentSnapshot} [afterDoc] - 分頁游標，傳入則從此文件之後開始。
 * @property {number} [limitCount] - 每頁筆數，預設 15。
 */

/**
 * 取得留言列表（最新在前），支援分頁。
 * @param {string} eventId - 活動 ID。
 * @param {FetchCommentsOptions} [options] - 分頁選項。
 * @returns {Promise<FetchCommentsResult>} 留言與分頁游標。
 */
export async function fetchComments(eventId, options = {}) {
  if (!eventId) throw new Error('fetchComments: eventId is required');

  const { afterDoc, limitCount = 15 } = options;
  const ref = collection(db, 'events', eventId, 'comments');
  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [orderBy('createdAt', 'desc'), limit(limitCount)];
  if (afterDoc) constraints.push(startAfter(afterDoc));

  const q = query(ref, ...constraints);
  const snap = await getDocs(q);
  /** @type {CommentData[]} */
  const comments = snap.docs.map((d) => /** @type {CommentData} */ ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { comments, lastDoc };
}

/**
 * 取得單筆留言。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<CommentData | null>} 留言資料或 null。
 */
export async function getCommentById(eventId, commentId) {
  if (!eventId || !commentId) return null;

  const ref = doc(db, 'events', eventId, 'comments', commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return /** @type {CommentData} */ ({ id: snap.id, ...snap.data() });
}

/**
 * 新增留言。
 * @param {string} eventId - 活動 ID。
 * @param {{ uid: string, name: string, photoURL: string }} user - 使用者資料。
 * @param {string} content - 留言內容。
 * @returns {Promise<CommentData>} 新留言完整資料。
 */
export async function addComment(eventId, user, content) {
  if (!eventId) throw new Error('addComment: eventId is required');
  if (!user?.uid) throw new Error('addComment: user.uid is required');

  const trimmed = content.trim();
  if (!trimmed) throw new Error('addComment: content is required');
  if (trimmed.length > 500) throw new Error('addComment: content exceeds 500 characters');

  const ref = collection(db, 'events', eventId, 'comments');
  const docRef = await addDoc(ref, {
    authorUid: user.uid,
    authorName: user.name || '',
    authorPhotoURL: user.photoURL || '',
    content: trimmed,
    createdAt: serverTimestamp(),
    updatedAt: null,
    isEdited: false,
  });

  return /** @type {CommentData} */ ({
    id: docRef.id,
    authorUid: user.uid,
    authorName: user.name || '',
    authorPhotoURL: user.photoURL || '',
    content: trimmed,
    createdAt: Timestamp.now(),
    updatedAt: null,
    isEdited: false,
  });
}

/**
 * 編輯留言（含歷史記錄）。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @param {string} newContent - 新留言內容。
 * @param {string} oldContent - 原留言內容。
 * @returns {Promise<void>}
 */
export async function updateComment(eventId, commentId, newContent, oldContent) {
  if (!eventId) throw new Error('updateComment: eventId is required');

  const trimmed = newContent.trim();
  if (!trimmed) throw new Error('updateComment: newContent is required');
  if (trimmed.length > 500) throw new Error('updateComment: newContent exceeds 500 characters');
  if (trimmed === oldContent) throw new Error('updateComment: content unchanged');

  const commentRef = doc(db, 'events', eventId, 'comments', commentId);
  const historyCol = collection(db, 'events', eventId, 'comments', commentId, 'history');
  const historyDocRef = doc(historyCol);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(commentRef);
    if (!snap.exists()) throw new Error('Comment not found');

    tx.set(historyDocRef, {
      content: oldContent,
      editedAt: serverTimestamp(),
    });

    tx.update(commentRef, {
      content: trimmed,
      updatedAt: serverTimestamp(),
      isEdited: true,
    });
  });
}

/**
 * 刪除留言（含歷史記錄）。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<void>}
 */
export async function deleteComment(eventId, commentId) {
  if (!eventId || !commentId) throw new Error('deleteComment: eventId and commentId are required');

  const commentRef = doc(db, 'events', eventId, 'comments', commentId);
  const historyRef = collection(db, 'events', eventId, 'comments', commentId, 'history');
  const historySnap = await getDocs(historyRef);

  const batch = writeBatch(db);
  historySnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(commentRef);
  await batch.commit();
}

/**
 * 取得留言的編輯記錄。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<CommentHistoryEntry[]>} 編輯記錄列表。
 */
export async function fetchCommentHistory(eventId, commentId) {
  if (!eventId || !commentId)
    throw new Error('fetchCommentHistory: eventId and commentId are required');

  const ref = collection(db, 'events', eventId, 'comments', commentId, 'history');
  const q = query(ref, orderBy('editedAt', 'asc'));
  const snap = await getDocs(q);

  return snap.docs.map((d) => /** @type {CommentHistoryEntry} */ ({ id: d.id, ...d.data() }));
}
