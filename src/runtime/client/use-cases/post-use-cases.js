import { serverTimestamp } from 'firebase/firestore';
import {
  buildAddCommentPayload,
  buildCreatePostPayload,
  buildUpdatePostPayload,
  isActiveRecord,
  toCommentData,
  toCommentDataList,
  toPostData,
  toPostDataList,
} from '@/service/post-service';
import {
  addPostDocument,
  addCommentDocument,
  deleteCommentDocument,
  deletePostTree,
  fetchCommentDocument,
  fetchLatestCommentDocuments,
  fetchLatestPostDocuments,
  fetchLikedPost,
  fetchLikedPostIds,
  fetchNextCommentDocuments,
  fetchNextPostDocuments,
  fetchNextPostDocumentsBySearch,
  fetchPostDocument,
  fetchPostDocumentsBySearch,
  toggleLikePost as toggleLikePostDocument,
  updateCommentDocument,
  updatePostDocument,
} from '@/repo/client/firebase-posts-repo';

export {
  POST_NOT_FOUND_MESSAGE,
  POST_TITLE_MAX_LENGTH,
  POST_CONTENT_MAX_LENGTH,
  validatePostInput,
} from '@/service/post-service';

/**
 * @typedef {import('@/service/post-service').Post} Post
 * @typedef {import('@/service/post-service').Comment} Comment
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 */

const POST_PAGE_SIZE = 10;

/**
 * 以 raw cursor 補齊 active record，避免 deleted docs 卡住分頁。
 * @template T
 * @param {object} root0 - 參數物件。
 * @param {QueryDocumentSnapshot[]} root0.initialDocs - 第一頁 raw docs。
 * @param {number} root0.pageSize - raw page size。
 * @param {(docs: QueryDocumentSnapshot[]) => T[]} root0.toRecords - raw docs 轉資料。
 * @param {(cursor: T) => Promise<{ docs: QueryDocumentSnapshot[] }>} root0.fetchNextPage - 取下一頁。
 * @returns {Promise<T[]>} active records。
 */
async function collectActiveRecords({ initialDocs, pageSize, toRecords, fetchNextPage }) {
  /**
   * @param {QueryDocumentSnapshot[]} rawDocs - Current raw page.
   * @param {T[]} activeRecords - Active records collected so far.
   * @returns {Promise<T[]>} Active records.
   */
  async function collect(rawDocs, activeRecords) {
    if (rawDocs.length === 0) return activeRecords.slice(0, pageSize);

    const records = toRecords(rawDocs);
    const activePageRecords = records.filter((record) =>
      isActiveRecord(/** @type {Record<string, unknown>} */ (record)),
    );
    const nextActiveRecords = [...activeRecords, ...activePageRecords];

    if (nextActiveRecords.length >= pageSize || rawDocs.length < pageSize) {
      return nextActiveRecords.slice(0, pageSize);
    }

    const rawCursor = records[records.length - 1];
    if (!rawCursor) return nextActiveRecords.slice(0, pageSize);
    const nextPage = await fetchNextPage(rawCursor);
    return collect(nextPage.docs, nextActiveRecords);
  }

  return collect(initialDocs, []);
}

/**
 * 以 active record 多取一筆來計算分頁狀態，避免滿頁時額外打空頁。
 * @template T
 * @param {object} root0 - 參數物件。
 * @param {QueryDocumentSnapshot[]} root0.initialDocs - 第一頁 raw docs。
 * @param {number} root0.pageSize - 回傳頁大小。
 * @param {(docs: QueryDocumentSnapshot[]) => T[]} root0.toRecords - raw docs 轉資料。
 * @param {(cursor: T) => Promise<{ docs: QueryDocumentSnapshot[] }>} root0.fetchNextPage - 取下一頁。
 * @returns {Promise<{ records: T[], nextCursor: T | null, hasMore: boolean }>} 分頁資料。
 */
async function collectActiveRecordPage({ initialDocs, pageSize, toRecords, fetchNextPage }) {
  const activeTarget = pageSize + 1;

  /**
   * @param {QueryDocumentSnapshot[]} rawDocs - Current raw page.
   * @param {T[]} activeRecords - Active records collected so far.
   * @returns {Promise<T[]>} Active records plus one sentinel when available.
   */
  async function collect(rawDocs, activeRecords) {
    if (rawDocs.length === 0) return activeRecords.slice(0, activeTarget);

    const records = toRecords(rawDocs);
    const activePageRecords = records.filter((record) =>
      isActiveRecord(/** @type {Record<string, unknown>} */ (record)),
    );
    const nextActiveRecords = [...activeRecords, ...activePageRecords];

    if (nextActiveRecords.length >= activeTarget || rawDocs.length < activeTarget) {
      return nextActiveRecords.slice(0, activeTarget);
    }

    const rawCursor = records[records.length - 1];
    if (!rawCursor) return nextActiveRecords.slice(0, activeTarget);
    const nextPage = await fetchNextPage(rawCursor);
    return collect(nextPage.docs, nextActiveRecords);
  }

  const activeRecords = await collect(initialDocs, []);
  const records = activeRecords.slice(0, pageSize);
  const hasMore = activeRecords.length > pageSize;

  return {
    records,
    nextCursor: hasMore ? records[records.length - 1] ?? null : null,
    hasMore,
  };
}

/**
 * 建立文章。
 * @param {object} root0 - 參數物件。
 * @param {string} root0.title - 文章標題。
 * @param {string} root0.content - 文章內容。
 * @param {{ uid: string, name?: string, photoURL?: string }} root0.user - 使用者資訊。
 * @returns {Promise<{ id: string }>} 新建文章的 ID。
 */
export async function createPost({ title, content, user }) {
  const payload = buildCreatePostPayload({
    title,
    content,
    user,
    postAtValue: serverTimestamp(),
  });
  const ref = await addPostDocument(payload);
  return { id: ref.id };
}

/**
 * 更新文章標題與內容。
 * @param {string} editingPostId - 要編輯的文章 ID。
 * @param {object} root0 - 參數物件。
 * @param {string} root0.title - 新標題。
 * @param {string} root0.content - 新內容。
 */
export async function updatePost(editingPostId, { title, content }) {
  const payload = buildUpdatePostPayload({ title, content });
  await updatePostDocument(editingPostId, payload);
}

/**
 * 取得最新 10 篇文章。
 * @returns {Promise<Post[]>} 最新文章陣列。
 */
export async function getLatestPosts() {
  const { docs } = await fetchLatestPostDocuments(POST_PAGE_SIZE);
  return collectActiveRecords({
    initialDocs: docs,
    pageSize: POST_PAGE_SIZE,
    toRecords: toPostDataList,
    fetchNextPage: (cursor) =>
      fetchNextPostDocuments(
        /** @type {Post & { postAt: import('firebase/firestore').Timestamp }} */ (cursor),
        POST_PAGE_SIZE,
      ),
  });
}

/**
 * 取得更多文章（分頁）。
 * @param {Post | null} last - 上一頁最後一筆文章。
 * @returns {Promise<Post[]>} 下一頁文章陣列。
 */
export async function getMorePosts(last) {
  if (!last) return [];
  const { docs } = await fetchNextPostDocuments(
    /** @type {import('@/service/post-service').Post & { postAt: import('firebase/firestore').Timestamp }} */ (
      last
    ),
    POST_PAGE_SIZE,
  );
  return collectActiveRecords({
    initialDocs: docs,
    pageSize: POST_PAGE_SIZE,
    toRecords: toPostDataList,
    fetchNextPage: (cursor) =>
      fetchNextPostDocuments(
        /** @type {Post & { postAt: import('firebase/firestore').Timestamp }} */ (cursor),
        POST_PAGE_SIZE,
      ),
  });
}

/**
 * 依關鍵字搜尋文章。
 * @param {string} searchTerm - 搜尋關鍵字。
 * @returns {Promise<Post[]>} 搜尋結果文章陣列。
 */
export async function getPostsBySearch(searchTerm) {
  const docs = await fetchPostDocumentsBySearch(searchTerm);
  return collectActiveRecords({
    initialDocs: docs,
    pageSize: POST_PAGE_SIZE,
    toRecords: toPostDataList,
    fetchNextPage: (cursor) =>
      fetchNextPostDocumentsBySearch(
        searchTerm,
        /** @type {Post & { title: string }} */ (cursor),
      ),
  });
}

/**
 * 依關鍵字搜尋更多文章（分頁）。
 * @param {string} searchTerm - 搜尋關鍵字。
 * @param {Post | null} last - 上一頁最後一筆文章。
 * @returns {Promise<Post[]>} 下一頁搜尋結果。
 */
export async function getMorePostsBySearch(searchTerm, last) {
  if (!last) return [];
  const { docs } = await fetchNextPostDocumentsBySearch(searchTerm, last);
  return collectActiveRecords({
    initialDocs: docs,
    pageSize: POST_PAGE_SIZE,
    toRecords: toPostDataList,
    fetchNextPage: (cursor) =>
      fetchNextPostDocumentsBySearch(
        searchTerm,
        /** @type {Post & { title: string }} */ (cursor),
      ),
  });
}

/**
 * 取得單篇文章詳情。
 * @param {string} id - 文章 ID。
 * @returns {Promise<Post | null>} 文章資料，不存在時回傳 null。
 */
export async function getPostDetail(id) {
  if (!id) return null;
  const snapshot = await fetchPostDocument(id);
  if (!snapshot) {
    console.warn('No such document!');
    return null;
  }
  const post = toPostData(snapshot);
  return isActiveRecord(post) ? post : null;
}

/**
 * 取得文章最新留言頁。
 * @param {string} id - 文章 ID。
 * @param {number} numberOfComments - 要取得的留言數量。
 * @returns {Promise<{ comments: Comment[], nextCursor: Comment | null, hasMore: boolean }>} 留言頁。
 */
export async function getLatestCommentsPage(id, numberOfComments = POST_PAGE_SIZE) {
  const querySize = numberOfComments + 1;
  const { docs } = await fetchLatestCommentDocuments(id, querySize);
  const page = await collectActiveRecordPage({
    initialDocs: docs,
    pageSize: numberOfComments,
    toRecords: toCommentDataList,
    fetchNextPage: (cursor) =>
      fetchNextCommentDocuments(
        id,
        /** @type {Comment & { createdAt: import('firebase/firestore').Timestamp }} */ (cursor),
        querySize,
      ),
  });

  return {
    comments: page.records,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

/**
 * 取得文章最新留言。
 * @param {string} id - 文章 ID。
 * @param {number} numberOfComments - 要取得的留言數量。
 * @returns {Promise<Comment[]>} 留言陣列。
 */
export async function getLatestComments(id, numberOfComments) {
  const page = await getLatestCommentsPage(id, numberOfComments);
  return page.comments;
}

/**
 * 取得更多留言頁。
 * @param {string} id - 文章 ID。
 * @param {Comment | null} last - 上一頁最後一筆留言。
 * @param {number} [numberOfComments] - 要取得的留言數量。
 * @returns {Promise<{ comments: Comment[], nextCursor: Comment | null, hasMore: boolean }>} 留言頁。
 */
export async function getMoreCommentsPage(id, last, numberOfComments = POST_PAGE_SIZE) {
  if (!last) return { comments: [], nextCursor: null, hasMore: false };
  const querySize = numberOfComments + 1;
  const { docs } = await fetchNextCommentDocuments(
    id,
    /** @type {import('@/service/post-service').Comment & { createdAt: import('firebase/firestore').Timestamp }} */ (
      last
    ),
    querySize,
  );
  const page = await collectActiveRecordPage({
    initialDocs: docs,
    pageSize: numberOfComments,
    toRecords: toCommentDataList,
    fetchNextPage: (cursor) =>
      fetchNextCommentDocuments(
        id,
        /** @type {Comment & { createdAt: import('firebase/firestore').Timestamp }} */ (cursor),
        querySize,
      ),
  });

  return {
    comments: page.records,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

/**
 * 取得更多留言（分頁）。
 * @param {string} id - 文章 ID。
 * @param {Comment} last - 上一頁最後一筆留言。
 * @returns {Promise<Comment[]>} 下一頁留言陣列。
 */
export async function getMoreComments(id, last) {
  const page = await getMoreCommentsPage(id, last, POST_PAGE_SIZE);
  return page.comments;
}

/**
 * 依留言 ID 取得單筆留言。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<Comment | null>} 留言資料，不存在時回傳 null。
 */
export async function getCommentById(postId, commentId) {
  const snapshot = await fetchCommentDocument(postId, commentId);
  if (!snapshot) return null;
  const comment = toCommentData(snapshot);
  return isActiveRecord(comment) ? comment : null;
}

/**
 * 切換文章按讚狀態。
 * @param {string} postId - 文章 ID。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<'success' | 'fail'>} 操作結果。
 */
export async function toggleLikePost(postId, uid) {
  return toggleLikePostDocument(postId, uid);
}

/**
 * 新增留言到文章。
 * @param {string} postId - 文章 ID。
 * @param {object} root0 - 參數物件。
 * @param {{ uid: string, name?: string, photoURL?: string }} root0.user - 留言者資訊。
 * @param {string} root0.comment - 留言內容。
 * @returns {Promise<{ id: string }>} 新留言的 ID。
 */
export async function addComment(postId, { user, comment }) {
  try {
    const { payload } = buildAddCommentPayload({
      user,
      comment,
      createdAtValue: serverTimestamp(),
    });
    const result = await addCommentDocument(postId, payload);
    return { id: result.id };
  } catch (error) {
    console.error('新增留言失敗:', error);
    throw error;
  }
}

/**
 * 更新留言內容。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @param {object} root0 - 參數物件。
 * @param {string} root0.comment - 新留言內容。
 * @returns {Promise<void>} 無回傳值。
 */
export async function updateComment(postId, commentId, { comment }) {
  await updateCommentDocument(postId, commentId, { comment });
}

/**
 * 刪除留言並同步扣減留言數。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @param {string | null | undefined} actorUid - 執行刪除的使用者 UID；缺少時視為 no-op。
 * @returns {Promise<void>}
 */
export async function deleteComment(postId, commentId, actorUid) {
  if (!actorUid) return;
  await deleteCommentDocument(postId, commentId, actorUid);
}

/**
 * 批次查詢使用者是否按過指定文章的讚。
 * @param {string} uid - 使用者 UID。
 * @param {string[]} postIds - 要查詢的文章 ID 陣列。
 * @returns {Promise<Set<string>>} 已按讚的文章 ID 集合。
 */
export async function hasUserLikedPosts(uid, postIds) {
  return fetchLikedPostIds(uid, postIds);
}

/**
 * 檢查使用者是否按過單篇文章的讚。
 * @param {string} uid - 使用者 UID。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<boolean>} 是否已按讚。
 */
export async function hasUserLikedPost(uid, postId) {
  try {
    return await fetchLikedPost(uid, postId);
  } catch (error) {
    console.error('hasUserLikedPost failed:', error);
    return false;
  }
}

/**
 * 軟刪除文章，保留 likes、comments subcollection 供 retention/purge 流程處理。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<{ ok: boolean }>} 刪除結果。
 */
export async function deletePost(postId) {
  return deletePostTree(postId);
}
