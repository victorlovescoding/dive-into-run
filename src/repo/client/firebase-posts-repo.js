import {
  addDoc,
  updateDoc,
  collection,
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';
import { POST_NOT_FOUND_MESSAGE } from '@/types/not-found-messages';

/**
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 * @typedef {import('firebase/firestore').DocumentSnapshot} DocumentSnapshot
 * @typedef {{ id: string, postAt: import('firebase/firestore').Timestamp }} PostCursor
 * @typedef {{ id: string, title: string }} PostSearchCursor
 * @typedef {{ id: string, createdAt: import('firebase/firestore').Timestamp }} CommentCursor
 */

/**
 * 新增文章文件。
 * @param {object} payload - Firestore event payload。
 * @returns {Promise<import('firebase/firestore').DocumentReference>} 新文件參照。
 */
export async function addPostDocument(payload) {
  return addDoc(collection(db, 'posts'), payload);
}

/**
 * 更新文章文件。
 * @param {string} postId - 文章 ID。
 * @param {object} payload - Firestore payload。
 * @returns {Promise<void>}
 */
export async function updatePostDocument(postId, payload) {
  await updateDoc(doc(db, 'posts', String(postId)), payload);
}

/**
 * 取得最新文章頁。
 * @param {number} limitCount - 每頁數量。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 查詢結果。
 */
export async function fetchLatestPostDocuments(limitCount) {
  const snapshot = await getDocs(
    query(
      collection(db, 'posts'),
      orderBy('postAt', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(limitCount),
    ),
  );

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 取得更多文章頁。
 * @param {PostCursor} afterDoc - 上一頁最後一筆文件。
 * @param {number} limitCount - 每頁數量。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 查詢結果。
 */
export async function fetchNextPostDocuments(afterDoc, limitCount) {
  const snapshot = await getDocs(
    query(
      collection(db, 'posts'),
      orderBy('postAt', 'desc'),
      orderBy(documentId(), 'desc'),
      startAfter(afterDoc.postAt, afterDoc.id),
      limit(limitCount),
    ),
  );

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 依關鍵字搜尋文章。
 * @param {string} searchTerm - 搜尋關鍵字。
 * @returns {Promise<QueryDocumentSnapshot[]>} 搜尋結果文件列表。
 */
export async function fetchPostDocumentsBySearch(searchTerm) {
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const snapshot = await getDocs(
    query(
      collection(db, 'posts'),
      where('title', '>=', normalizedSearchTerm),
      where('title', '<=', `${normalizedSearchTerm}\uf8ff`),
      orderBy('title'),
      orderBy(documentId()),
      limit(10),
    ),
  );

  return snapshot.docs;
}

/**
 * 依關鍵字搜尋更多文章（分頁）。
 * @param {string} searchTerm - 搜尋關鍵字。
 * @param {PostSearchCursor} afterDoc - 上一頁最後一筆文件。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 搜尋結果。
 */
export async function fetchNextPostDocumentsBySearch(searchTerm, afterDoc) {
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const snapshot = await getDocs(
    query(
      collection(db, 'posts'),
      where('title', '>=', normalizedSearchTerm),
      where('title', '<=', `${normalizedSearchTerm}\uf8ff`),
      orderBy('title'),
      orderBy(documentId()),
      startAfter(afterDoc.title, afterDoc.id),
      limit(10),
    ),
  );

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 取得單篇文章文件。
 * @param {string} id - 文章 ID。
 * @returns {Promise<DocumentSnapshot | null>} 文件快照或 null。
 */
export async function fetchPostDocument(id) {
  const snapshot = await getDoc(doc(db, 'posts', String(id)));
  return snapshot.exists() ? snapshot : null;
}

/**
 * 取得文章最新留言頁。
 * @param {string} postId - 文章 ID。
 * @param {number} limitCount - 每頁數量。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 查詢結果。
 */
export async function fetchLatestCommentDocuments(postId, limitCount) {
  const snapshot = await getDocs(
    query(
      collection(db, 'posts', String(postId), 'comments'),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(limitCount),
    ),
  );

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 取得更多留言頁。
 * @param {string} postId - 文章 ID。
 * @param {CommentCursor} afterDoc - 上一頁最後一筆留言。
 * @param {number} limitCount - 每頁數量。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 查詢結果。
 */
export async function fetchNextCommentDocuments(postId, afterDoc, limitCount) {
  const snapshot = await getDocs(
    query(
      collection(db, 'posts', String(postId), 'comments'),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      startAfter(afterDoc.createdAt, afterDoc.id),
      limit(limitCount),
    ),
  );

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 依留言 ID 取得單筆留言文件。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<DocumentSnapshot | null>} 留言文件或 null。
 */
export async function fetchCommentDocument(postId, commentId) {
  const snapshot = await getDoc(doc(db, 'posts', String(postId), 'comments', String(commentId)));
  return snapshot.exists() ? snapshot : null;
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
  const postRef = doc(db, 'posts', String(postId));
  const likeRef = doc(db, 'posts', String(postId), 'likes', String(uid));

  try {
    await runTransaction(db, async (transaction) => {
      const likeSnap = await transaction.get(likeRef);
      if (likeSnap.exists()) {
        transaction.update(postRef, {
          likesCount: increment(-1),
        });
        transaction.delete(likeRef);
      } else {
        transaction.update(postRef, {
          likesCount: increment(1),
        });
        transaction.set(likeRef, {
          uid,
          postId,
          createdAt: serverTimestamp(),
        });
      }
    });
    return 'success';
  } catch {
    return 'fail';
  }
}

/**
 * 新增留言到文章。
 * @param {string} postId - 文章 ID。
 * @param {object} payload - Firestore payload。
 * @returns {Promise<{ id: string }>} 新留言的 ID。
 */
export async function addCommentDocument(postId, payload) {
  const postRef = doc(db, 'posts', String(postId));
  const commentsCol = collection(db, 'posts', String(postId), 'comments');
  const newCommentRef = doc(commentsCol);

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) throw new Error('Post not found');

    transaction.set(newCommentRef, payload);
    transaction.update(postRef, { commentsCount: increment(1) });
  });

  return { id: newCommentRef.id };
}

/**
 * 更新留言內容。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @param {object} payload - 要更新的 payload。
 * @returns {Promise<void>} 無回傳值。
 */
export async function updateCommentDocument(postId, commentId, payload) {
  await updateDoc(doc(db, 'posts', String(postId), 'comments', String(commentId)), payload);
}

/**
 * 刪除留言並同步扣減留言數。
 * @param {string} postId - 文章 ID。
 * @param {string} commentId - 留言 ID。
 * @returns {Promise<void>}
 */
export async function deleteCommentDocument(postId, commentId) {
  const postRef = doc(db, 'posts', String(postId));
  const commentRef = doc(db, 'posts', String(postId), 'comments', String(commentId));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(commentRef);
    if (!snap.exists()) return;
    tx.delete(commentRef);
    tx.update(postRef, { commentsCount: increment(-1) });
  });
}

/**
 * 批次查詢使用者是否按過指定文章的讚。
 * @param {string} uid - 使用者 UID。
 * @param {string[]} postIds - 要查詢的文章 ID 陣列。
 * @returns {Promise<Set<string>>} 已按讚的文章 ID 集合。
 */
export async function fetchLikedPostIds(uid, postIds) {
  if (!uid || !Array.isArray(postIds) || postIds.length === 0) {
    return new Set();
  }

  const q = query(
    collectionGroup(db, 'likes'),
    where('uid', '==', uid),
    where('postId', 'in', postIds),
  );
  const snap = await getDocs(q);
  return new Set(snap.docs.map((d) => d.data().postId));
}

/**
 * 檢查使用者是否按過單篇文章的讚。
 * @param {string} uid - 使用者 UID。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<boolean>} 是否已按讚。
 */
export async function fetchLikedPost(uid, postId) {
  const likeRef = doc(db, 'posts', String(postId), 'likes', String(uid));
  const snap = await getDoc(likeRef);
  return snap.exists();
}

/**
 * 刪除文章及其所有 likes、comments subcollection。
 * @param {string} postId - 文章 ID。
 * @returns {Promise<{ ok: boolean }>} 刪除結果。
 */
export async function deletePostTree(postId) {
  if (!postId) throw new Error('deletePost: postId is required');

  const pid = String(postId);
  const postRef = doc(db, 'posts', pid);

  const snap = await getDoc(postRef);
  if (!snap.exists()) throw new Error(POST_NOT_FOUND_MESSAGE);

  const likesSnap = await getDocs(collection(db, 'posts', pid, 'likes'));
  const commentsSnap = await getDocs(collection(db, 'posts', pid, 'comments'));

  const batch = writeBatch(db);
  likesSnap.docs.forEach((d) => batch.delete(d.ref));
  commentsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(postRef);

  await batch.commit();
  return { ok: true };
}
