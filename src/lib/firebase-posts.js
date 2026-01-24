import { db } from "@/lib/firebase-client";
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
  deleteDoc,
  startAfter,
  documentId,
} from "firebase/firestore";
export async function createPost({ title, content, user }) {
  const ref = await addDoc(collection(db, "posts"), {
    authorUid: user.uid,
    title: title,
    content: content,
    authorImgURL: user.photoURL,
    postAt: serverTimestamp(),
    likesCount: 0,
    commentsCount: 0,
  });
  return { id: ref.id };
}

export async function updatePost(editingPostId, { title, content }) {
  await updateDoc(doc(db, "posts", editingPostId), {
    title: title,
    content: content,
  });
}

export async function getLatestPosts() {
  const q = query(
    collection(db, "posts"),
    orderBy("postAt", "desc"),
    orderBy(documentId(), "desc"),
    limit(10)
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function getMorePosts(last) {
  if (!last) return [];
  const q = query(
    collection(db, "posts"),
    orderBy("postAt", "desc"),
    orderBy(documentId(), "desc"),
    //orderBy(firebase.firestore.FieldPath.documentId(), "desc"),
    startAfter(last.postAt, last.id), // 也可改成 .startAfter(last.data().postAt, last.id)
    limit(10)
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function getPostsBySearch(searchTerm) {
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const q = query(
    collection(db, "posts"),
    where("title", ">=", normalizedSearchTerm),
    where("title", "<=", normalizedSearchTerm + "\uf8ff"),
    orderBy("title"),
    orderBy(documentId()), // 保持唯一排序，防止 title 相同時順序不穩定
    limit(10)
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function getMorePostsBySearch(searchTerm, last) {
  if (!last) return [];
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const q = query(
    collection(db, "posts"),
    where("title", ">=", normalizedSearchTerm),
    where("title", "<=", normalizedSearchTerm + "\uf8ff"),
    orderBy("title"),
    orderBy(documentId()),
    startAfter(last.title, last.id), // 以 title 和 id 作為分頁基準
    limit(10)
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function getPostDetail(id) {
  const docRef = doc(db, "posts", id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const postDetailData = { id: docSnap.id, ...docSnap.data() }; // ✅ 解開完直接回傳
    //傳到ui層
    return postDetailData;
  } else {
    // docSnap.data() will be undefined in this case
    console.log("No such document!");
  }
}

export async function getLatestComments(id, numberOfComments) {
  const q = query(
    collection(db, "posts", id, "comments"),
    orderBy("createdAt", "desc"),
    orderBy(documentId(), "desc"),
    limit(numberOfComments)
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function getMoreComments(id, last) {
  const q = query(
    collection(db, "posts", id, "comments"),
    orderBy("createdAt", "desc"),
    orderBy(documentId(), "desc"),
    startAfter(last.createdAt, last.id),
    limit(10)
  );
  const docSnap = await getDocs(q);
  return docSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

//拿著剛剛使用者送出的留言ID去抓到留言時間
export async function getCommentById(postId, commentId) {
  const ref = doc(db, "posts", postId, "comments", commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function toggleLikePost(postId, uid) {
  if (!uid) {
    throw new Error("No uid");
  }
  const postRef = doc(db, "posts", postId);
  const likeRef = doc(db, "posts", postId, "likes", uid);

  //同時likesCount+1 & 到posts/{postId}/likes/{uid}
  try {
    await runTransaction(db, async (transaction) => {
      const likeSnap = await transaction.get(likeRef);
      if (likeSnap.exists()) {
        //已經按過讚，就變成收回讚
        transaction.update(postRef, {
          likesCount: increment(-1),
        });
        transaction.delete(likeRef);
      } else {
        //未按過 → 建立 like doc ＋ likesCount +1
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
    return "success";
    // console.log("Transaction successfully committed!");
  } catch (e) {
    return "fail";
    // console.log("Transaction failed: ", e);
    // throw(e)
  }
}

//需要把留言者名字、大頭貼url、留言內容、留言時間寫上去
export async function addComment(postId, { user, comment }) {
  if (!user?.uid) throw new Error("No user");
  const text = (comment ?? "").trim();
  if (!text) throw new Error("Empty comment");

  const postRef = doc(db, "posts", postId);
  const commentsCol = collection(db, "posts", postId, "comments");
  const newCommentRef = doc(commentsCol); // 先產生新留言的 ref（交易內用 set）
  try {
    await runTransaction(db, async (transaction) => {
      // 確認貼文存在（避免對不存在的貼文加計數）
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) throw new Error("Post not found");

      // 新增留言（交易內）
      transaction.set(newCommentRef, {
        authorUid: user.uid,
        authorName: user.name || "匿名使用者",
        authorImgURL: user.photoURL || "",
        comment: text,
        createdAt: serverTimestamp(),
      });

      // 同步讓 commentsCount +1（交易內）
      transaction.update(postRef, { commentsCount: increment(1) });
    });

    // 交易成功，回傳新留言 ID
    return { id: newCommentRef.id };
  } catch (error) {
    console.error("新增留言失敗:", error);
    throw error; // 讓 UI 可以接到錯誤並回滾
  }
}

export async function updateComment(postId, commentId, { comment }) {
  const updateCommentRef = doc(db, "posts", postId, "comments", commentId);

  // Set the "capital" field of the city 'DC'
  await updateDoc(updateCommentRef, {
    comment: comment,
  });
}

export async function deleteComment(postId, commentId) {
  const postRef = doc(db, "posts", postId);
  const commentRef = doc(db, "posts", postId, "comments", commentId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(commentRef);
    if (!snap.exists()) return; // 已被刪就當成功
    tx.delete(commentRef); // 刪留言
    tx.update(postRef, { commentsCount: increment(-1) }); // 扣 1
  });
}

//拿著使用者的uid去資料庫找使用者按過哪幾篇貼文讚
export async function hasUserLikedPosts(uid, postIds) {
  if (!uid || !Array.isArray(postIds) || postIds.length === 0) {
    return new Set(); // 空集合
  }
  const q = query(
    collectionGroup(db, "likes"),
    where("uid", "==", uid),
    where("postId", "in", postIds)
  );
  const snap = await getDocs(q);
  return new Set(snap.docs.map((d) => d.data().postId)); //用set 日後好判斷有沒有liked
}

//詳文頁檢查使用者有沒有按過這篇文章讚
export async function hasUserLikedPost(uid, postId) {
  try {
    const likeRef = doc(db, "posts", postId, "likes", uid);
    const snap = await getDoc(likeRef);
    return snap.exists();
  } catch (err) {
    console.error("hasUserLikedPost failed:", err);
    return false;
  }
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, "posts", postId));
}
