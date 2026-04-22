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
 * @typedef {import('@/service/event-comment-service').CommentData} ImportedCommentData
 * @typedef {import('@/service/event-comment-service').CommentHistoryEntry} ImportedCommentHistoryEntry
 */

export {
  fetchComments,
  getCommentById,
  addComment,
  updateComment,
  deleteComment,
  fetchCommentHistory,
} from '@/runtime/client/use-cases/event-comment-use-cases';
