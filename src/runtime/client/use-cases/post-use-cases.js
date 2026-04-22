import { serverTimestamp } from 'firebase/firestore';
import {
  buildAddCommentPayload,
  buildCreatePostPayload,
  buildUpdatePostPayload,
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

export { POST_NOT_FOUND_MESSAGE, POST_TITLE_MAX_LENGTH, POST_CONTENT_MAX_LENGTH, validatePostInput } from '@/service/post-service';

/**
 * @typedef {import('@/service/post-service').Post} Post
 * @typedef {import('@/service/post-service').Comment} Comment
 */

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
  const { docs } = await fetchLatestPostDocuments(10);
  return toPostDataList(docs);
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
    10,
  );
  return toPostDataList(docs);
}

/**
 * 依關鍵字搜尋文章。
 * @param {string} searchTerm - 搜尋關鍵字。
 * @returns {Promise<Post[]>} 搜尋結果文章陣列。
 */
export async function getPostsBySearch(searchTerm) {
  const docs = await fetchPostDocumentsBySearch(searchTerm);
  return toPostDataList(docs);
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
  return toPostDataList(docs);
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
  return toPostData(snapshot);
}

/**
 * 取得文章最新留言。
 * @param {string} id - 文章 ID。
 * @param {number} numberOfComments - 要取得的留言數量。
 * @returns {Promise<Comment[]>} 留言陣列。
 */
export async function getLatestComments(id, numberOfComments) {
  const { docs } = await fetchLatestCommentDocuments(id, numberOfComments);
  return toCommentDataList(docs);
}

/**
 * 取得更多留言（分頁）。
 * @param {string} id - 文章 ID。
 * @param {Comment} last - 上一頁最後一筆留言。
 * @returns {Promise<Comment[]>} 下一頁留言陣列。
 */
export async function getMoreComments(id, last) {
  const { docs } = await fetchNextCommentDocuments(
    id,
    /** @type {import('@/service/post-service').Comment & { createdAt: import('firebase/firestore').Timestamp }} */ (
      last
    ),
    10,
  );
  return toCommentDataList(docs);
}

/**
 * 依留言 ID 取得單筆留言。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<Comment | null>} 留言資料，不存在時回傳 null。
 */
export async function getCommentById(postId, commentId) {
  const snapshot = await fetchCommentDocument(postId, commentId);
  return snapshot ? toCommentData(snapshot) : null;
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
 * @returns {Promise<void>}
 */
export async function deleteComment(postId, commentId) {
  await deleteCommentDocument(postId, commentId);
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
 * 刪除文章及其所有 likes、comments subcollection（cascade delete）。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<{ ok: boolean }>} 刪除結果。
 */
export async function deletePost(postId) {
  return deletePostTree(postId);
}
