import { isAccountDeletionHidden } from '@/config/account-deletion';
import { isSoftDeletedRecord } from '@/repo/post-soft-delete';
import buildCommentEditHistoryPayload, {
  buildEditHistoryPayload,
} from '@/service/comment-edit-history-service';

export { POST_NOT_FOUND_MESSAGE } from '@/types/not-found-messages';
export {
  POST_DELETE_RETENTION_DAYS,
  addDays,
  buildSoftDeletePayload,
  isSoftDeletedRecord,
} from '@/repo/post-soft-delete';

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
 * @property {import('firebase/firestore').Timestamp} [deletedAt] - 軟刪除時間。
 * @property {string} [deletedByUid] - 執行軟刪除的使用者 UID。
 * @property {import('firebase/firestore').Timestamp} [deletedPurgeAt] - 可永久刪除時間。
 */

/**
 * @typedef {object} Comment
 * @property {string} id - 留言 ID。
 * @property {string} authorUid - 留言者 UID。
 * @property {string} [authorName] - 留言者名稱。
 * @property {string} [authorImgURL] - 留言者大頭貼 URL。
 * @property {string} comment - 留言內容。
 * @property {import('firebase/firestore').Timestamp} [createdAt] - 留言時間。
 * @property {import('firebase/firestore').Timestamp} [deletedAt] - 軟刪除時間。
 * @property {string} [deletedByUid] - 執行軟刪除的使用者 UID。
 * @property {import('firebase/firestore').Timestamp} [deletedPurgeAt] - 可永久刪除時間。
 */

/** @type {number} 文章標題最大長度。 */
export const POST_TITLE_MAX_LENGTH = 50;

/** @type {number} 文章內容最大長度。 */
export const POST_CONTENT_MAX_LENGTH = 10000;

/** @type {number} 搜尋摘要命中前後保留字數。 */
const POST_SEARCH_SNIPPET_CONTEXT_LENGTH = 48;

/** @type {number} 標題命中時的預設內容摘要長度。 */
const POST_SEARCH_SUMMARY_MAX_LENGTH = 160;

/**
 * @typedef {object} PostSearchKeyword
 * @property {string} rawValue - 使用者輸入的原始關鍵字。
 * @property {string} value - trim 後的有效關鍵字。
 * @property {string} caseFoldedValue - 大小寫不敏感比對用關鍵字。
 */

/**
 * @typedef {object} PostSearchHighlightRange
 * @property {'title' | 'snippet'} field - 高亮目標欄位。
 * @property {number} start - 高亮起點（含）。
 * @property {number} end - 高亮終點（不含）。
 */

/**
 * @typedef {object} PostSearchMatch
 * @property {Post} post - 命中文章。
 * @property {'title' | 'content'} hitType - 主要命中層級。
 * @property {{ title: boolean, content: boolean }} matchedFields - 命中欄位。
 * @property {number} firstMatchIndex - 主要命中欄位中的第一個命中位置。
 * @property {string} snippet - 結果摘要。
 * @property {PostSearchHighlightRange[]} highlightRanges - UI 高亮 metadata。
 * @property {{ hitTypeRank: number, postAt: unknown, id: string }} rankKey - 排序鍵。
 */

/**
 * 判斷資料是否仍為可見 active 狀態。
 * @param {Record<string, unknown> | null | undefined} record - Firestore 正規化資料。
 * @returns {boolean} 沒有軟刪除欄位時為 true。
 */
export function isActiveRecord(record) {
  return !isAccountDeletionHidden(record) && !isSoftDeletedRecord(record);
}

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
 * 將搜尋關鍵字正規化。
 * @param {string | null | undefined} rawKeyword - 使用者輸入關鍵字。
 * @returns {PostSearchKeyword | null} 有效搜尋關鍵字；空白輸入回傳 null。
 */
export function normalizePostSearchKeyword(rawKeyword) {
  const rawValue = rawKeyword ?? '';
  const value = rawValue.trim();
  if (!value) return null;

  return {
    rawValue,
    value,
    caseFoldedValue: value.toLowerCase(),
  };
}

/**
 * 將任意值轉成搜尋比對文字。
 * @param {unknown} value - 欄位值。
 * @returns {string} 可搜尋文字。
 */
function toSearchableText(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * 建立內容摘要與摘要對應的原文 offset。
 * @param {string} content - 文章內容。
 * @param {number} matchIndex - 內容命中位置。
 * @param {number} keywordLength - 關鍵字長度。
 * @returns {{ snippet: string, offset: number }} 摘要與原文 offset。
 */
function buildContentHitSnippet(content, matchIndex, keywordLength) {
  const rawStart = Math.max(0, matchIndex - POST_SEARCH_SNIPPET_CONTEXT_LENGTH);
  const rawEnd = Math.min(
    content.length,
    matchIndex + keywordLength + POST_SEARCH_SNIPPET_CONTEXT_LENGTH,
  );
  const rawSnippet = content.slice(rawStart, rawEnd);
  const leadingWhitespaceLength = rawSnippet.length - rawSnippet.trimStart().length;

  return {
    snippet: rawSnippet.trim(),
    offset: rawStart + leadingWhitespaceLength,
  };
}

/**
 * 建立一般內容摘要。
 * @param {string} content - 文章內容。
 * @returns {string} 摘要。
 */
function buildDefaultPostSearchSnippet(content) {
  return content.slice(0, POST_SEARCH_SUMMARY_MAX_LENGTH).trim();
}

/**
 * 將時間欄位轉成排序用毫秒值。
 * @param {unknown} value - Timestamp-like、Date、number 或 string。
 * @returns {number} 可排序毫秒值；無效值為 0。
 */
function toSortableMillis(value) {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return Number(value.toMillis());
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isNaN(millis) ? 0 : millis;
  }

  return 0;
}

/**
 * 建立單篇文章的搜尋命中資料。
 * @param {(Post & Record<string, unknown>) | null | undefined} post - 候選文章。
 * @param {PostSearchKeyword | null | undefined} keyword - 正規化關鍵字。
 * @returns {PostSearchMatch | null} 命中資料；不可見或未命中時為 null。
 */
export function buildPostSearchMatch(post, keyword) {
  if (!post || !keyword || !isActiveRecord(post)) return null;

  const title = toSearchableText(post.title);
  const content = toSearchableText(post.content);
  const caseFoldedTitle = title.toLowerCase();
  const caseFoldedContent = content.toLowerCase();
  const titleMatchIndex = caseFoldedTitle.indexOf(keyword.caseFoldedValue);
  const contentMatchIndex = caseFoldedContent.indexOf(keyword.caseFoldedValue);
  const titleMatches = titleMatchIndex >= 0;
  const contentMatches = contentMatchIndex >= 0;

  if (!titleMatches && !contentMatches) return null;

  const hitType = titleMatches ? 'title' : 'content';
  const firstMatchIndex = titleMatches ? titleMatchIndex : contentMatchIndex;
  /** @type {PostSearchHighlightRange[]} */
  const highlightRanges = [];
  const snippetInfo = contentMatches
    ? buildContentHitSnippet(content, contentMatchIndex, keyword.value.length)
    : { snippet: buildDefaultPostSearchSnippet(content), offset: 0 };

  if (titleMatches) {
    highlightRanges.push({
      field: 'title',
      start: titleMatchIndex,
      end: titleMatchIndex + keyword.value.length,
    });
  }

  if (contentMatches) {
    highlightRanges.push({
      field: 'snippet',
      start: contentMatchIndex - snippetInfo.offset,
      end: contentMatchIndex - snippetInfo.offset + keyword.value.length,
    });
  }

  return {
    post,
    hitType,
    matchedFields: {
      title: titleMatches,
      content: contentMatches,
    },
    firstMatchIndex,
    snippet: snippetInfo.snippet,
    highlightRanges,
    rankKey: {
      hitTypeRank: hitType === 'title' ? 0 : 1,
      postAt: post.postAt,
      id: post.id,
    },
  };
}

/**
 * 排序搜尋命中資料。
 * @param {Array<PostSearchMatch | null | undefined>} matches - 未排序命中資料。
 * @returns {PostSearchMatch[]} 已排序命中資料。
 */
export function sortPostSearchMatches(matches) {
  return matches
    .filter((match) => Boolean(match))
    .sort((left, right) => {
      const hitTypeDiff = left.rankKey.hitTypeRank - right.rankKey.hitTypeRank;
      if (hitTypeDiff !== 0) return hitTypeDiff;

      const timeDiff =
        toSortableMillis(right.rankKey.postAt) - toSortableMillis(left.rankKey.postAt);
      if (timeDiff !== 0) return timeDiff;

      return String(right.rankKey.id).localeCompare(String(left.rankKey.id));
    });
}

/**
 * 從候選文章中篩選並排序搜尋結果。
 * @param {Array<Post & Record<string, unknown>>} posts - 候選文章。
 * @param {string | null | undefined} rawKeyword - 使用者輸入關鍵字。
 * @returns {PostSearchMatch[]} 已排序搜尋結果。
 */
export function filterAndRankPostSearchMatches(posts, rawKeyword) {
  const keyword = normalizePostSearchKeyword(rawKeyword);
  if (!keyword) return [];

  return sortPostSearchMatches(posts.map((post) => buildPostSearchMatch(post, keyword)));
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
 * @param {Post} root0.currentPost - 目前文章，會保存到 history。
 * @param {unknown} root0.updatedAtValue - 由 runtime 注入的 `updatedAt`/`editedAt` 值。
 * @param {string} root0.historyId - 本次 history 文件 ID。
 * @returns {{ historyPayload: object, postUpdate: object }} Firestore transaction payload。
 */
export function buildUpdatePostPayload({ title, content, currentPost, updatedAtValue, historyId }) {
  const error = validatePostInput({ title, content });
  if (error) throw new Error(`updatePost: ${error}`);

  if (!currentPost || typeof currentPost.title !== 'string' || typeof currentPost.content !== 'string') {
    throw new Error('updatePost: current post is required');
  }
  if (typeof historyId !== 'string' || !historyId) {
    throw new Error('updatePost: historyId is required');
  }

  const { historyPayload, updatePayload } = buildEditHistoryPayload({
    fields: [
      {
        newText: title,
        oldText: currentPost.title,
        currentTextField: 'title',
        fieldLabel: 'title',
        maxLength: POST_TITLE_MAX_LENGTH,
      },
      {
        newText: content,
        oldText: currentPost.content,
        currentTextField: 'content',
        fieldLabel: 'content',
        maxLength: POST_CONTENT_MAX_LENGTH,
      },
    ],
    updatedAtValue,
    functionName: 'updatePost',
    unchangedMessage: 'content unchanged',
  });

  return {
    historyPayload,
    postUpdate: {
      ...updatePayload,
      lastEditHistoryId: historyId,
    },
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
  return buildCommentEditHistoryPayload({
    newText: comment,
    oldText: currentComment,
    currentTextField: 'comment',
    updatedAtValue,
    fieldLabel: 'comment',
    functionName: 'updateComment',
  });
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
 * 判斷文章或留言是否可公開顯示。
 * @param {Record<string, unknown> | null | undefined} data - Firestore data.
 * @returns {boolean} true when visible.
 */
export function isPublicPostRecordVisible(data) {
  return isActiveRecord(data);
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
