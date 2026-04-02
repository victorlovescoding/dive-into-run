/**
 * @file Service layer for event comments (Firestore).
 * @description
 * CRUD operations for comments subcollection under events.
 * TDD stub — functions are declared but NOT implemented yet.
 */

// eslint-disable-next-line no-unused-vars
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
 * 取得留言列表（最新在前）。
 * @param {string} eventId - 活動 ID。
 * @param {number} [limitCount=15] - 每頁筆數。
 * @returns {Promise<FetchCommentsResult>} 留言與分頁游標。
 */
export async function fetchComments(eventId, limitCount = 15) {
  void eventId;
  void limitCount;
  throw new Error('Not implemented');
}

/**
 * 載入更多留言（分頁）。
 * @param {string} eventId - 活動 ID。
 * @param {import('firebase/firestore').DocumentSnapshot} afterDoc - 上一頁的最後文件。
 * @param {number} [limitCount=15] - 每頁筆數。
 * @returns {Promise<FetchCommentsResult>} 留言與分頁游標。
 */
export async function fetchMoreComments(eventId, afterDoc, limitCount = 15) {
  void eventId;
  void afterDoc;
  void limitCount;
  throw new Error('Not implemented');
}

/**
 * 取得單筆留言。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<CommentData | null>} 留言資料或 null。
 */
export async function getCommentById(eventId, commentId) {
  void eventId;
  void commentId;
  throw new Error('Not implemented');
}

/**
 * 新增留言。
 * @param {string} eventId - 活動 ID。
 * @param {{ uid: string, name: string, photoURL: string }} user - 使用者資料。
 * @param {string} content - 留言內容。
 * @returns {Promise<{ id: string }>} 新留言 ID。
 */
export async function addComment(eventId, user, content) {
  void eventId;
  void user;
  void content;
  throw new Error('Not implemented');
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
  void eventId;
  void commentId;
  void newContent;
  void oldContent;
  throw new Error('Not implemented');
}

/**
 * 刪除留言（含歷史記錄）。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<void>}
 */
export async function deleteComment(eventId, commentId) {
  void eventId;
  void commentId;
  throw new Error('Not implemented');
}

/**
 * 取得留言的編輯記錄。
 * @param {string} eventId - 活動 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<CommentHistoryEntry[]>} 編輯記錄列表。
 */
export async function fetchCommentHistory(eventId, commentId) {
  void eventId;
  void commentId;
  throw new Error('Not implemented');
}
