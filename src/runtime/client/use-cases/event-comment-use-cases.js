import { serverTimestamp } from 'firebase/firestore';
import {
  assertEventId,
  buildAddCommentPayload,
  buildAddedComment,
  buildUpdateCommentPayload,
  toCommentData,
  toCommentHistoryEntry,
} from '@/service/event-comment-service';
import {
  addEventCommentDocument,
  deleteEventCommentDocument,
  fetchEventCommentDocument,
  fetchEventCommentHistoryDocuments,
  fetchEventCommentPage,
  updateEventCommentDocument,
} from '@/repo/client/firebase-event-comments-repo';

/**
 * 取得留言列表（最新在前），支援分頁。
 * @param {string} eventId - 活動 ID。
 * @param {{
 *   afterDoc?: import('firebase/firestore').DocumentSnapshot,
 *   limitCount?: number
 * }} [options] - 分頁選項。
 * @returns {Promise<{
 *   comments: import('@/service/event-comment-service').CommentData[],
 *   lastDoc: import('firebase/firestore').DocumentSnapshot | null
 * }>} 留言與分頁游標。
 */
export async function fetchComments(eventId, options = {}) {
  assertEventId(eventId, 'fetchComments');

  const { docs, lastDoc } = await fetchEventCommentPage(eventId, options);
  return {
    comments: docs.map((snapshot) => toCommentData(snapshot)),
    lastDoc,
  };
}

/**
 * 取得單筆留言。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<import('@/service/event-comment-service').CommentData | null>} 留言資料或 null。
 */
export async function getCommentById(eventId, commentId) {
  if (!eventId || !commentId) {
    return null;
  }

  const snapshot = await fetchEventCommentDocument(eventId, commentId);
  return snapshot.exists() ? toCommentData(snapshot) : null;
}

/**
 * 新增留言。
 * @param {string} eventId - 活動 ID。
 * @param {{ uid: string, name?: string, photoURL?: string }} user - 使用者資料。
 * @param {string} content - 留言內容。
 * @returns {Promise<import('@/service/event-comment-service').CommentData>} 新留言完整資料。
 */
export async function addComment(eventId, user, content) {
  assertEventId(eventId, 'addComment');

  const { trimmed, payload } = buildAddCommentPayload(user, content, serverTimestamp());
  const docRef = await addEventCommentDocument(eventId, payload);

  return buildAddedComment(docRef.id, user, trimmed);
}

/**
 * 編輯留言。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @param {string} newContent - 新留言內容。
 * @param {string} oldContent - 原留言內容。
 * @returns {Promise<void>}
 */
export async function updateComment(eventId, commentId, newContent, oldContent) {
  assertEventId(eventId, 'updateComment');

  const { historyPayload, commentUpdate } = buildUpdateCommentPayload(
    newContent,
    oldContent,
    serverTimestamp(),
  );

  await updateEventCommentDocument(eventId, commentId, historyPayload, commentUpdate);
}

/**
 * 刪除留言。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<void>}
 */
export async function deleteComment(eventId, commentId) {
  if (!eventId || !commentId) {
    throw new Error('deleteComment: eventId and commentId are required');
  }

  await deleteEventCommentDocument(eventId, commentId);
}

/**
 * 取得留言編輯歷史。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<import('@/service/event-comment-service').CommentHistoryEntry[]>} 歷史記錄列表。
 */
export async function fetchCommentHistory(eventId, commentId) {
  if (!eventId || !commentId) {
    throw new Error('fetchCommentHistory: eventId and commentId are required');
  }

  const docs = await fetchEventCommentHistoryDocuments(eventId, commentId);
  return docs.map((snapshot) => toCommentHistoryEntry(snapshot));
}
