import {
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  limit,
  query,
  orderBy,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  increment,
  collectionGroup,
  where,
  writeBatch,
  startAfter,
  documentId,
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

/** @type {number} 文章標題最大長度。 */
export const POST_TITLE_MAX_LENGTH = 50;

/** @type {number} 文章內容最大長度。 */
export const POST_CONTENT_MAX_LENGTH = 10000;

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
 * @typedef {object} Post
 * @property {string} id - 文章 ID。
 * @property {string} authorUid - 作者 UID。
 * @property {string} title - 文章標題。
 * @property {string} content - 文章內容。
 * @property {string} [authorImgURL] - 作者大頭貼 URL。
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

/**
 * 建立新文章。
 * @param {object} root0 - 參數物件。
 * @param {string} root0.title - 文章標題。
 * @param {string} root0.content - 文章內容。
 * @param {{ uid: string, photoURL?: string }} root0.user - 使用者資訊。
 * @returns {Promise<{ id: string }>} 新建文章的 ID。
 */
export async function createPost({ title, content, user }) {
  const error = validatePostInput({ title, content });
  if (error) throw new Error(`createPost: ${error}`);

  const ref = await addDoc(collection(db, 'posts'), {
    authorUid: user.uid,
    title,
    content,
    authorImgURL: user.photoURL,
    postAt: serverTimestamp(),
    likesCount: 0,
    commentsCount: 0,
  });
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
  const error = validatePostInput({ title, content });
  if (error) throw new Error(`updatePost: ${error}`);

  await updateDoc(doc(db, 'posts', editingPostId), {
    title,
    content,
  });
}

/**
 * 取得最新 10 篇文章。
 * @returns {Promise<Post[]>} 最新文章陣列。
 */
export async function getLatestPosts() {
  const q = query(
    collection(db, 'posts'),
    orderBy('postAt', 'desc'),
    orderBy(documentId(), 'desc'),
    limit(10),
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map(
    (d) =>
      /** @type {Post} */ ({
        id: d.id,
        ...d.data(),
      }),
  );
}

/**
 * 取得更多文章（分頁）。
 * @param {Post | null} last - 上一頁最後一筆文章。
 * @returns {Promise<Post[]>} 下一頁文章陣列。
 */
export async function getMorePosts(last) {
  if (!last) return [];
  const q = query(
    collection(db, 'posts'),
    orderBy('postAt', 'desc'),
    orderBy(documentId(), 'desc'),
    // orderBy(firebase.firestore.FieldPath.documentId(), "desc"),
    startAfter(last.postAt, last.id), // 也可改成 .startAfter(last.data().postAt, last.id)
    limit(10),
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map(
    (d) =>
      /** @type {Post} */ ({
        id: d.id,
        ...d.data(),
      }),
  );
}

/**
 * 依關鍵字搜尋文章。
 * @param {string} searchTerm - 搜尋關鍵字。
 * @returns {Promise<Post[]>} 搜尋結果文章陣列。
 */
export async function getPostsBySearch(searchTerm) {
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const q = query(
    collection(db, 'posts'),
    where('title', '>=', normalizedSearchTerm),
    where('title', '<=', `${normalizedSearchTerm}\uf8ff`),
    orderBy('title'),
    orderBy(documentId()), // 保持唯一排序，防止 title 相同時順序不穩定
    limit(10),
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map(
    (d) =>
      /** @type {Post} */ ({
        id: d.id,
        ...d.data(),
      }),
  );
}

/**
 * 依關鍵字搜尋更多文章（分頁）。
 * @param {string} searchTerm - 搜尋關鍵字。
 * @param {Post | null} last - 上一頁最後一筆文章。
 * @returns {Promise<Post[]>} 下一頁搜尋結果。
 */
export async function getMorePostsBySearch(searchTerm, last) {
  if (!last) return [];
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const q = query(
    collection(db, 'posts'),
    where('title', '>=', normalizedSearchTerm),
    where('title', '<=', `${normalizedSearchTerm}\uf8ff`),
    orderBy('title'),
    orderBy(documentId()),
    startAfter(last.title, last.id), // 以 title 和 id 作為分頁基準
    limit(10),
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map(
    (d) =>
      /** @type {Post} */ ({
        id: d.id,
        ...d.data(),
      }),
  );
}

/**
 * 取得單篇文章詳情。
 * @param {string} id - 文章 ID。
 * @returns {Promise<Post | null>} 文章資料，不存在時回傳 null。
 */
export async function getPostDetail(id) {
  const docRef = doc(db, 'posts', id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const postDetailData = /** @type {Post} */ ({ id: docSnap.id, ...docSnap.data() }); // 解開完直接回傳
    // 傳到ui層
    return postDetailData;
  }
  // docSnap.data() will be undefined in this case
  console.warn('No such document!');
  return null;
}

/**
 * 取得文章最新留言。
 * @param {string} id - 文章 ID。
 * @param {number} numberOfComments - 要取得的留言數量。
 * @returns {Promise<Comment[]>} 留言陣列。
 */
export async function getLatestComments(id, numberOfComments) {
  const q = query(
    collection(db, 'posts', id, 'comments'),
    orderBy('createdAt', 'desc'),
    orderBy(documentId(), 'desc'),
    limit(numberOfComments),
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map(
    (d) =>
      /** @type {Comment} */ ({
        id: d.id,
        ...d.data(),
      }),
  );
}

/**
 * 取得更多留言（分頁）。
 * @param {string} id - 文章 ID。
 * @param {Comment} last - 上一頁最後一筆留言。
 * @returns {Promise<Comment[]>} 下一頁留言陣列。
 */
export async function getMoreComments(id, last) {
  const q = query(
    collection(db, 'posts', id, 'comments'),
    orderBy('createdAt', 'desc'),
    orderBy(documentId(), 'desc'),
    startAfter(last.createdAt, last.id),
    limit(10),
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map(
    (d) =>
      /** @type {Comment} */ ({
        id: d.id,
        ...d.data(),
      }),
  );
}

/**
 * 依留言 ID 取得單筆留言（用於取得留言時間）。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<Comment | null>} 留言資料，不存在時回傳 null。
 */
export async function getCommentById(postId, commentId) {
  const ref = doc(db, 'posts', postId, 'comments', commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return /** @type {Comment} */ ({ id: snap.id, ...snap.data() });
}

/**
 * 切換文章按讚狀態。
 * @param {string} postId - 文章 ID。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<'success' | 'fail'>} 操作結果。
 */
export async function toggleLikePost(postId, uid) {
  if (!uid) {
    throw new Error('No uid');
  }
  const postRef = doc(db, 'posts', postId);
  const likeRef = doc(db, 'posts', postId, 'likes', uid);

  // 同時likesCount+1 & 到posts/{postId}/likes/{uid}
  try {
    await runTransaction(db, async (transaction) => {
      const likeSnap = await transaction.get(likeRef);
      if (likeSnap.exists()) {
        // 已經按過讚，就變成收回讚
        transaction.update(postRef, {
          likesCount: increment(-1),
        });
        transaction.delete(likeRef);
      } else {
        // 未按過 → 建立 like doc ＋ likesCount +1
        transaction.update(postRef, {
          likesCount: increment(1),
        });
        transaction.set(likeRef, {
          uid,
          postId,
          createdAt: serverTimestamp(),
        });
      } // 已按過就取消按讚
    });
    return 'success';
    // console.log("Transaction successfully committed!");
  } catch {
    return 'fail';
    // console.log("Transaction failed");
    // throw error
  }
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
  if (!user?.uid) throw new Error('No user');
  const text = (comment ?? '').trim();
  if (!text) throw new Error('Empty comment');

  const postRef = doc(db, 'posts', postId);
  const commentsCol = collection(db, 'posts', postId, 'comments');
  const newCommentRef = doc(commentsCol); // 先產生新留言的 ref（交易內用 set）
  try {
    await runTransaction(db, async (transaction) => {
      // 確認貼文存在（避免對不存在的貼文加計數）
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) throw new Error('Post not found');

      // 新增留言（交易內）
      transaction.set(newCommentRef, {
        authorUid: user.uid,
        authorName: user.name || '匿名使用者',
        authorImgURL: user.photoURL || '',
        comment: text,
        createdAt: serverTimestamp(),
      });

      // 同步讓 commentsCount +1（交易內）
      transaction.update(postRef, { commentsCount: increment(1) });
    });

    // 交易成功，回傳新留言 ID
    return { id: newCommentRef.id };
  } catch (error) {
    console.error('新增留言失敗:', error);
    throw error; // 讓 UI 可以接到錯誤並回滾
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
  const updateCommentRef = doc(db, 'posts', postId, 'comments', commentId);

  // Set the "capital" field of the city 'DC'
  await updateDoc(updateCommentRef, {
    comment,
  });
}

/**
 * 刪除留言並同步扣減留言數。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 */
export async function deleteComment(postId, commentId) {
  const postRef = doc(db, 'posts', postId);
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(commentRef);
    if (!snap.exists()) return; // 已被刪就當成功
    tx.delete(commentRef); // 刪留言
    tx.update(postRef, { commentsCount: increment(-1) }); // 扣 1
  });
}

/**
 * 批次查詢使用者是否按過指定文章的讚。
 * @param {string} uid - 使用者 UID。
 * @param {string[]} postIds - 要查詢的文章 ID 陣列。
 * @returns {Promise<Set<string>>} 已按讚的文章 ID 集合。
 */
export async function hasUserLikedPosts(uid, postIds) {
  if (!uid || !Array.isArray(postIds) || postIds.length === 0) {
    return new Set(); // 空集合
  }
  const q = query(
    collectionGroup(db, 'likes'),
    where('uid', '==', uid),
    where('postId', 'in', postIds),
  );
  const snap = await getDocs(q);
  return new Set(snap.docs.map((d) => d.data().postId)); // 用set 日後好判斷有沒有liked
}

/**
 * 檢查使用者是否按過單篇文章的讚。
 * @param {string} uid - 使用者 UID。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<boolean>} 是否已按讚。
 */
export async function hasUserLikedPost(uid, postId) {
  try {
    const likeRef = doc(db, 'posts', postId, 'likes', uid);
    const snap = await getDoc(likeRef);
    return snap.exists();
  } catch (err) {
    console.error('hasUserLikedPost failed:', err);
    return false;
  }
}

/**
 * 刪除文章及其所有 likes、comments subcollection（cascade delete）。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<{ ok: boolean }>} 刪除結果。
 */
export async function deletePost(postId) {
  if (!postId) throw new Error('deletePost: postId is required');

  const pid = String(postId);
  const postRef = doc(db, 'posts', pid);

  const snap = await getDoc(postRef);
  if (!snap.exists()) throw new Error('文章不存在');

  // --- 取得 likes 子集合所有文件 ---
  const likesSnap = await getDocs(collection(db, 'posts', pid, 'likes'));
  // --- 取得 comments 子集合所有文件 ---
  const commentsSnap = await getDocs(collection(db, 'posts', pid, 'comments'));

  // NOTE: Firestore writeBatch 上限 500 筆操作。
  // 目前單篇文章不預期超過此限制，若未來超過需改用分批 commit。
  const batch = writeBatch(db);

  likesSnap.docs.forEach((d) => batch.delete(d.ref));
  commentsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(postRef);

  await batch.commit();
  return { ok: true };
}
