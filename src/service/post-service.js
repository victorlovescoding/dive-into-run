/**
 * @typedef {object} Post
 * @property {string} id - 文章 ID。
 * @property {string} authorUid - 作者 UID。
 * @property {string} title - 文章標題。
 * @property {string} content - 文章內容。
 * @property {string} [authorImgURL] - 作者大頭貼 URL。
 * @property {string} [authorName] - 作者顯示名稱。
 * @property {import('firebase/firestore').Timestamp} [postAt] - 發文時間。
 * @property {number} [likesCount] - 按讚數。
 * @property {number} [commentsCount] - 留言數。
 */

/**
 * @typedef {object} Comment
 * @property {string} id - 留言 ID。
 * @property {string} authorUid - 留言者 UID。
 * @property {string} [authorName] - 留言者名稱。
 * @property {string} [authorImgURL] - 留言者大頭貼 URL。
 * @property {string} comment - 留言內容。
 * @property {import('firebase/firestore').Timestamp} [createdAt] - 留言時間。
 */

/** @type {number} 文章標題最大長度。 */
export const POST_TITLE_MAX_LENGTH = 50;

/** @type {number} 文章內容最大長度。 */
export const POST_CONTENT_MAX_LENGTH = 10000;

/**
 * 當文章不存在時 deletePost 拋出的錯誤訊息常數。
 * @type {string}
 */
export const POST_NOT_FOUND_MESSAGE = '文章不存在';

/**
 * 驗證文章輸入是否合規。
 * @param {object} input - 驗證目標。
 * @param {string} input.title - 文章標題（raw，未 trim）。
 * @param {string} input.content - 文章內容（raw，未 trim）。
 * @returns {string | null} 第一個驗證錯誤訊息，或 null 表示通過。
 */
export function validatePostInput({ title, content }) {
  const t = (title ?? '').trim();
  const c = (content ?? '').trim();

  if (!t && !c) return '請輸入標題和內容';
  if (!t) return '請輸入標題';
  if (!c) return '請輸入內容';
  if (t.length > POST_TITLE_MAX_LENGTH) return '標題不可超過 50 字';
  if (c.length > POST_CONTENT_MAX_LENGTH) return '內容不可超過 10,000 字';

  return null;
}

/**
 * 建立新文章寫入 payload。
 * @param {object} root0 - 參數物件。
 * @param {string} root0.title - 文章標題。
 * @param {string} root0.content - 文章內容。
 * @param {{ uid: string, name?: string, photoURL?: string }} root0.user - 使用者資訊。
 * @param {unknown} root0.postAtValue - 由 runtime 注入的 `postAt` 值。
 * @returns {object} Firestore payload。
 */
export function buildCreatePostPayload({ title, content, user, postAtValue }) {
  const error = validatePostInput({ title, content });
  if (error) throw new Error(`createPost: ${error}`);

  return {
    authorUid: user.uid,
    title,
    content,
    authorImgURL: user.photoURL || undefined,
    authorName: user.name || '匿名使用者',
    postAt: postAtValue,
    likesCount: 0,
    commentsCount: 0,
  };
}

/**
 * 建立更新文章 payload。
 * @param {object} root0 - 參數物件。
 * @param {string} root0.title - 新標題。
 * @param {string} root0.content - 新內容。
 * @returns {object} Firestore payload。
 */
export function buildUpdatePostPayload({ title, content }) {
  const error = validatePostInput({ title, content });
  if (error) throw new Error(`updatePost: ${error}`);

  return {
    title: title.trim(),
    content: content.trim(),
  };
}

/**
 * 建立新增留言 payload。
 * @param {object} root0 - 參數物件。
 * @param {{ uid: string, name?: string, photoURL?: string }} root0.user - 使用者資訊。
 * @param {string} root0.comment - 留言內容。
 * @param {unknown} root0.createdAtValue - 由 runtime 注入的 `createdAt` 值。
 * @returns {{ trimmed: string, payload: object }} 新留言 payload。
 */
export function buildAddCommentPayload({ user, comment, createdAtValue }) {
  if (!user?.uid) {
    throw new Error('No user');
  }

  const trimmed = (comment ?? '').trim();
  if (!trimmed) {
    throw new Error('Empty comment');
  }

  return {
    trimmed,
    payload: {
      authorUid: user.uid,
      authorName: user.name || '匿名使用者',
      authorImgURL: user.photoURL || '',
      comment: trimmed,
      createdAt: createdAtValue,
    },
  };
}

/**
 * 建立更新留言 transaction payload。
 * @param {object} root0 - 參數物件。
 * @param {string} root0.comment - 新留言內容。
 * @param {string} root0.currentComment - 目前留言內容。
 * @param {unknown} root0.updatedAtValue - 由 runtime 注入的 `updatedAt` 值。
 * @returns {{ commentUpdate: object, historyPayload: object }} transaction payload。
 */
export function buildUpdateCommentPayload({ comment, currentComment, updatedAtValue }) {
  const trimmed = (comment ?? '').trim();
  if (!trimmed) {
    throw new Error('updateComment: comment is required');
  }

  if (trimmed === currentComment) {
    throw new Error('updateComment: content unchanged');
  }

  return {
    historyPayload: {
      comment: currentComment,
      editedAt: updatedAtValue,
    },
    commentUpdate: {
      comment: trimmed,
      updatedAt: updatedAtValue,
      isEdited: true,
    },
  };
}

/**
 * 將 Firestore snapshot 正規化成 UI 使用的 post object。
 * @param {{ id: string, data: () => object }} snapshot - Firestore 文件快照。
 * @returns {Post} post object。
 */
export function toPostData(snapshot) {
  return /** @type {Post} */ ({
    id: snapshot.id,
    ...snapshot.data(),
  });
}

/**
 * 將多筆 Firestore snapshot 正規化成 post array。
 * @param {Array<{ id: string, data: () => object }>} snapshots - Firestore 文件快照列表。
 * @returns {Post[]} post array。
 */
export function toPostDataList(snapshots) {
  return snapshots.map((snapshot) => toPostData(snapshot));
}

/**
 * 將留言 snapshot 正規化成 `Comment`。
 * @param {{ id: string, data: () => object }} snapshot - Firestore 文件快照。
 * @returns {Comment} 留言資料。
 */
export function toCommentData(snapshot) {
  return /** @type {Comment} */ ({
    id: snapshot.id,
    ...snapshot.data(),
  });
}

/**
 * 將多筆留言 snapshot 正規化成 comment array。
 * @param {Array<{ id: string, data: () => object }>} snapshots - Firestore 文件快照列表。
 * @returns {Comment[]} comment array。
 */
export function toCommentDataList(snapshots) {
  return snapshots.map((snapshot) => toCommentData(snapshot));
}
