import { serverTimestamp } from 'firebase/firestore';
import {
  assertEventId,
  buildAddCommentPayload,
  buildAddedComment,
  buildUpdateCommentPayload,
  isPublicEventCommentVisible,
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
 * Collect visible event comments while advancing through raw Firestore pages.
 * @param {object} options - Pagination options.
 * @param {string} options.eventId - Event ID.
 * @param {import('firebase/firestore').DocumentSnapshot | undefined} options.afterDoc - Initial cursor.
 * @param {number} options.limitCount - Visible page size.
 * @param {import('@/service/event-comment-service').CommentData[]} [options.comments] - Accumulated visible comments.
 * @returns {Promise<{
 *   comments: import('@/service/event-comment-service').CommentData[],
 *   lastDoc: import('firebase/firestore').DocumentSnapshot | null
 * }>} Visible comments and raw cursor.
 */
async function collectVisibleEventCommentPage(options) {
  const { eventId, afterDoc, limitCount, comments = [] } = options;
  const page = await fetchEventCommentPage(eventId, { afterDoc, limitCount });
  if (page.docs.length === 0) {
    return { comments, lastDoc: null };
  }

  /** @type {import('firebase/firestore').DocumentSnapshot | null} */
  let lastDoc = null;
  const nextComments = [...comments];

  for (const snapshot of page.docs) {
    lastDoc = snapshot;
    if (isPublicEventCommentVisible(snapshot.data())) {
      nextComments.push(toCommentData(snapshot));
      if (nextComments.length >= limitCount) {
        return { comments: nextComments, lastDoc: snapshot };
      }
    }
  }

  if (page.docs.length < limitCount) {
    return {
      comments: nextComments,
      lastDoc: nextComments.length === comments.length ? null : lastDoc,
    };
  }

  return collectVisibleEventCommentPage({
    eventId,
    afterDoc: lastDoc ?? undefined,
    limitCount,
    comments: nextComments,
  });
}

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

  const { afterDoc, limitCount = 15 } = options;
  return collectVisibleEventCommentPage({ eventId, afterDoc, limitCount });
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
  if (!snapshot.exists() || !isPublicEventCommentVisible(snapshot.data())) {
    return null;
  }

  return toCommentData(snapshot);
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

  const commentSnapshot = await fetchEventCommentDocument(eventId, commentId);
  if (!commentSnapshot.exists() || !isPublicEventCommentVisible(commentSnapshot.data())) {
    return [];
  }

  const docs = await fetchEventCommentHistoryDocuments(eventId, commentId);
  return docs.map((snapshot) => toCommentHistoryEntry(snapshot));
}
