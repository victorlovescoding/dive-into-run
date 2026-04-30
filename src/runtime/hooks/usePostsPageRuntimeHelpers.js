import {
  getLatestPosts,
  getMorePosts,
  hasUserLikedPosts,
} from '@/runtime/client/use-cases/post-use-cases';

/**
 * 為 post list 補上當前使用者視角的 UI flags。
 * @param {Array<object>} postItems - 原始文章資料。
 * @param {string | null | undefined} userUid - 當前使用者 UID。
 * @param {Set<string>} [likedPostIds] - 已按讚文章 ID 集合。
 * @returns {Array<object>} 帶 liked / isAuthor 的文章。
 */
export function hydratePosts(postItems, userUid, likedPostIds = new Set()) {
  return (Array.isArray(postItems) ? postItems : []).map((postItem) => ({
    ...postItem,
    liked: likedPostIds.has(postItem.id),
    isAuthor: postItem.authorUid === userUid,
  }));
}

/**
 * 以 id 去重後把新文章接到列表尾端。
 * @param {Array<object>} previousPosts - 既有文章。
 * @param {Array<object>} nextPosts - 待追加文章。
 * @returns {Array<object>} 合併後文章。
 */
export function mergeUniquePosts(previousPosts, nextPosts) {
  const seenIds = new Set(previousPosts.map((postItem) => postItem.id));
  const freshPosts = nextPosts.filter((postItem) => !seenIds.has(postItem.id));
  return [...previousPosts, ...freshPosts];
}

/**
 * 取得文章列表的按讚集合。
 * @param {string | null | undefined} userUid - 當前使用者 UID。
 * @param {Array<{ id: string }>} postItems - 文章列表。
 * @returns {Promise<Set<string>>} 已按讚文章 ID 集合。
 */
export async function getLikedPostIdsForPosts(userUid, postItems) {
  if (!userUid || postItems.length === 0) {
    return new Set();
  }

  return hasUserLikedPosts(
    userUid,
    postItems.map((postItem) => postItem.id),
  );
}

/**
 * 載入第一頁文章並補齊使用者視角欄位。
 * @param {string | null | undefined} userUid - 當前使用者 UID。
 * @returns {Promise<{ posts: Array<object>, nextCursor: object | null }>} hydrated posts 與下一頁 cursor。
 */
export async function loadInitialPosts(userUid) {
  const latestPosts = await getLatestPosts();
  const likedPostIds = await getLikedPostIdsForPosts(userUid, latestPosts);

  return {
    posts: hydratePosts(latestPosts, userUid, likedPostIds),
    nextCursor: latestPosts.at(-1) ?? null,
  };
}

/**
 * 載入下一頁文章並補齊使用者視角欄位。
 * @param {object} params - 參數物件。
 * @param {object | null} params.nextCursor - 當前 cursor。
 * @param {string | null | undefined} params.userUid - 當前使用者 UID。
 * @param {number} params.pageSize - 單頁筆數。
 * @returns {Promise<{ posts: Array<object>, nextCursor: object | null }>} hydrated posts 與下一頁 cursor。
 */
export async function loadMorePostsPage({ nextCursor, userUid, pageSize }) {
  const morePosts = await getMorePosts(nextCursor);
  const likedPostIds = await getLikedPostIdsForPosts(userUid, morePosts);

  return {
    posts: hydratePosts(morePosts, userUid, likedPostIds),
    nextCursor: morePosts.length < pageSize ? null : (morePosts.at(-1) ?? null),
  };
}

/**
 * 建立新增/編輯表單 draft。
 * @param {object | null} postItem - 編輯中的文章；null 代表新增模式。
 * @returns {{ title: string, content: string, originalTitle: string, originalContent: string, editingPostId: string | null }} 表單 draft。
 */
export function createComposerDraft(postItem) {
  return {
    title: postItem?.title ?? '',
    content: postItem?.content ?? '',
    originalTitle: postItem?.title ?? '',
    originalContent: postItem?.content ?? '',
    editingPostId: postItem?.id ?? null,
  };
}

/**
 * 套用文章按讚 UI 狀態。
 * @param {Array<object>} previousPosts - 既有文章。
 * @param {string} postId - 文章 ID。
 * @param {boolean} liked - 目標 liked 狀態。
 * @param {number} likesCount - 目標 likesCount。
 * @returns {Array<object>} 更新後文章。
 */
export function applyPostLikeState(previousPosts, postId, liked, likesCount) {
  return previousPosts.map((postItem) =>
    postItem.id === postId ? { ...postItem, liked, likesCount } : postItem,
  );
}

/**
 * 更新本地文章列表中的標題與內容。
 * @param {Array<object>} previousPosts - 既有文章。
 * @param {string} editingPostId - 編輯中的文章 ID。
 * @param {string} title - 新標題。
 * @param {string} content - 新內容。
 * @returns {Array<object>} 更新後文章。
 */
export function replaceEditedPost(previousPosts, editingPostId, title, content) {
  return previousPosts.map((postItem) =>
    postItem.id === editingPostId
      ? { ...postItem, title: title.trim(), content: content.trim() }
      : postItem,
  );
}

/**
 * 從列表移除指定文章。
 * @param {Array<object>} previousPosts - 既有文章。
 * @param {string} postId - 文章 ID。
 * @returns {Array<object>} 更新後文章。
 */
export function removePostById(previousPosts, postId) {
  return previousPosts.filter((postItem) => postItem.id !== postId);
}

/**
 * 把新文章插到列表最前面。
 * @param {Array<object>} previousPosts - 既有文章。
 * @param {object} hydratedPost - 已補齊 UI flags 的文章。
 * @returns {Array<object>} 更新後文章。
 */
export function prependPost(previousPosts, hydratedPost) {
  return [hydratedPost, ...previousPosts];
}
