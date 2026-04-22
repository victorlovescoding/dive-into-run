import { Timestamp } from 'firebase/firestore';

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
 * 驗證 eventId。
 * @param {string} eventId - 活動 ID。
 * @param {string} functionName - 呼叫函式名稱。
 */
export function assertEventId(eventId, functionName) {
  if (!eventId) {
    throw new Error(`${functionName}: eventId is required`);
  }
}

/**
 * 驗證留言內容並回傳 trim 後結果。
 * @param {string} content - 留言內容。
 * @param {string} fieldLabel - 錯誤訊息用欄位名稱。
 * @param {string} functionName - 呼叫函式名稱。
 * @returns {string} trim 後留言內容。
 */
export function validateCommentContent(content, fieldLabel, functionName) {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error(`${functionName}: ${fieldLabel} is required`);
  }

  if (trimmed.length > 500) {
    throw new Error(`${functionName}: ${fieldLabel} exceeds 500 characters`);
  }

  return trimmed;
}

/**
 * 建立新增留言 payload。
 * @param {{ uid: string, name?: string, photoURL?: string }} user - 使用者資料。
 * @param {string} content - 留言內容。
 * @param {unknown} createdAtValue - 由 runtime 注入的 createdAt 值。
 * @returns {{ trimmed: string, payload: object }} 新增留言 payload。
 */
export function buildAddCommentPayload(user, content, createdAtValue) {
  if (!user?.uid) {
    throw new Error('addComment: user.uid is required');
  }

  const trimmed = validateCommentContent(content, 'content', 'addComment');

  return {
    trimmed,
    payload: {
      authorUid: user.uid,
      authorName: user.name || '',
      authorPhotoURL: user.photoURL || '',
      content: trimmed,
      createdAt: createdAtValue,
      updatedAt: null,
      isEdited: false,
    },
  };
}

/**
 * 建立 addComment 回傳物件。
 * @param {string} id - 留言 ID。
 * @param {{ uid: string, name?: string, photoURL?: string }} user - 使用者資料。
 * @param {string} trimmed - trim 後的留言內容。
 * @returns {CommentData} 新留言完整資料。
 */
export function buildAddedComment(id, user, trimmed) {
  return {
    id,
    authorUid: user.uid,
    authorName: user.name || '',
    authorPhotoURL: user.photoURL || '',
    content: trimmed,
    createdAt: Timestamp.now(),
    updatedAt: null,
    isEdited: false,
  };
}

/**
 * 建立更新留言 transaction payload。
 * @param {string} newContent - 新留言內容。
 * @param {string} oldContent - 原留言內容。
 * @param {unknown} editedAtValue - 由 runtime 注入的 editedAt/updatedAt 值。
 * @returns {{ historyPayload: object, commentUpdate: object }} transaction payload。
 */
export function buildUpdateCommentPayload(newContent, oldContent, editedAtValue) {
  const trimmed = validateCommentContent(newContent, 'newContent', 'updateComment');

  if (trimmed === oldContent) {
    throw new Error('updateComment: content unchanged');
  }

  return {
    historyPayload: {
      content: oldContent,
      editedAt: editedAtValue,
    },
    commentUpdate: {
      content: trimmed,
      updatedAt: editedAtValue,
      isEdited: true,
    },
  };
}

/**
 * 將留言 snapshot 正規化成 `CommentData`。
 * @param {{ id: string, data: () => object }} snapshot - Firestore 文件快照。
 * @returns {CommentData} 留言資料。
 */
export function toCommentData(snapshot) {
  return /** @type {CommentData} */ ({
    id: snapshot.id,
    ...snapshot.data(),
  });
}

/**
 * 將留言歷史 snapshot 正規化成 `CommentHistoryEntry`。
 * @param {{ id: string, data: () => object }} snapshot - Firestore 文件快照。
 * @returns {CommentHistoryEntry} 留言歷史資料。
 */
export function toCommentHistoryEntry(snapshot) {
  return /** @type {CommentHistoryEntry} */ ({
    id: snapshot.id,
    ...snapshot.data(),
  });
}
