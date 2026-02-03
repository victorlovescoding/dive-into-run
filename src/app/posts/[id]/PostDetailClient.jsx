'use client';

import Image from 'next/image';
import {
  useState, useEffect, useRef, useContext,
} from 'react';
import {
  getPostDetail,
  addComment,
  getLatestComments,
  getCommentById,
  toggleLikePost,
  hasUserLikedPost,
  updatePost,
  updateComment,
  deletePost,
  deleteComment,
  getMoreComments,
} from '@/lib/firebase-posts';
import { AuthContext } from '@/contexts/AuthContext';
import styles from '../postDetail.module.css';

const INFINITE_SCROLL_MARGIN = '300px 0px';
/**
 *
 * @param root0
 * @param root0.postId
 */
export default function PostDetailClient({ postId }) {
  const [postDetail, setPostDetail] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [commentEditing, setCommentEditing] = useState(null);
  const [isCommentEditing, setIsCommentEditing] = useState(false);
  const [isComposeEditing, setIsComposeEditing] = useState(false);
  const { user } = useContext(AuthContext);
  const [comment, setComment] = useState(''); // 只裝使用者即將送出的留言
  const [comments, setComments] = useState([]); // 裝所有留言
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const bottomRef = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  useEffect(() => {
    if (!postId) {
      return;
    }
    /**
     *
     */
    async function fetchPost() {
      const postDetailData = await getPostDetail(postId);
      setPostDetail(postDetailData);
      const commentsData = await getLatestComments(postId, 10);
      const last = commentsData[commentsData.length - 1]; // 上一頁最後一筆（snapshot）
      setNextCursor(last);
      // 這邊要先確認有沒有當前登入的使用者的留言（跑迴圈）
      setComments(
        commentsData.map((prev) => ({
          ...prev,
          isAuthor: prev.authorUid === user?.uid,
        })),
      );

      // setComments(commentsData)
      // 要拿postId去查使用者有沒有按過讚
      if (user?.uid) {
        const liked = await hasUserLikedPost(user.uid, postId);
        setPostDetail((prev) => ({
          ...prev,
          liked,
          isAuthor: prev.authorUid === user.uid,
        }));
      } else {
        setPostDetail((prev) => ({ ...prev, liked: false }));
      }
    }
    fetchPost();
  }, [postId, user?.uid]);

  useEffect(() => {
    if (!bottomRef.current || !nextCursor || isLoadingNext || !postId) return;
    const intersectionObserver = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0]; // 只觀察一個東西所以取第一筆資料
        if (!entry.isIntersecting || isLoadingNext) return; // 代表 目標元素有沒有「進到」觀測區域（root；你這裡是視窗 + rootMargin）。
        intersectionObserver.unobserve(entry.target); // 先暫停觀察，避免回呼抖動連觸
        setIsLoadingNext(true);
        let shouldReobserve = true; // 👈 本輪旗標
        try {
          const moreComments = await getMoreComments(postId, nextCursor); // 拿更多留言（21–40）
          if (moreComments.length === 0) {
            setNextCursor(null); // 沒有資料，標記尾頁
            shouldReobserve = false; // 本輪不要重掛
            return; // 直接進 finally（會結束載入並斷 observer）
          }
          const last = moreComments[moreComments.length - 1]; // 上一頁最後一筆（snapshot）
          setNextCursor(last);

          const hydrated = moreComments.map((prev) => ({
            ...prev,
            isAuthor: prev.authorUid === user?.uid,
          }));

          // 以 id 去重再追加
          setComments((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            const fresh = hydrated.filter((x) => !seen.has(x.id));
            return [...prev, ...fresh];
          });

          if (moreComments.length < 10) {
            setNextCursor(null); // 明確表示沒有下一頁
            shouldReobserve = false; // 👈 關鍵：這一輪就別重掛了
            // 跳到 finally
          }
        } catch (e) {
          console.error(e);
          // 失敗時可選擇繼續重掛（保持 shouldReobserve 為 true）
          shouldReobserve = false; // 錯誤時暫停重掛，避免頻繁重試
        } finally {
          setIsLoadingNext(false);
          if (shouldReobserve && bottomRef.current) {
            intersectionObserver.observe(bottomRef.current);
          } else {
            intersectionObserver.disconnect(); // 末頁或無游標就收尾
          }
        }
      },
      {
        root: null,
        threshold: 0,
        rootMargin: INFINITE_SCROLL_MARGIN, // 想提前一點就打開
      },
    );
    // start observing
    const el = bottomRef.current;
    intersectionObserver.observe(el);
    return () => {
      intersectionObserver.disconnect();
    };
  }, [
    postId,
    nextCursor,
    isLoadingNext,
    user?.uid,
    bottomRef.current,
    comments.length,
  ]);

  /**
   *
   * @param postId
   */
  function composeButtonHandler(postId) {
    // 按下寫文章按鈕後，跳出編輯頁面
    if (postId && !isComposeEditing) {
      setTitle(postDetail.title);
      setContent(postDetail.content);
      setIsComposeEditing(true);
      setEditingPostId(postId);
    } else if (postId && isComposeEditing) {
      setIsComposeEditing(false);
    } else if (!postId && !isComposeEditing) {
      setIsComposeEditing(true);
      setTitle('');
      setContent('');
    } else {
      setIsComposeEditing(false);
    }
  }

  /**
   *
   * @param e
   */
  async function handleSubmitPost(e) {
    e.preventDefault();
    if (editingPostId) {
      await updatePost(editingPostId, { title, content }); // 編輯
      setPostDetail((prev) => ({ ...prev, title, content })); // ✅ 只更新那一筆，不新增
    }
    setTitle('');
    setContent('');
    setIsComposeEditing(false);
    setEditingPostId(null);
  }

  /**
   *
   * @param postId
   * @param e
   */
  function toggleOwnerMenu(postId, e) {
    e.stopPropagation();
    if (postId === openMenuPostId) {
      setOpenMenuPostId('');
    } else {
      setOpenMenuPostId(postId);
    }
  }

  /**
   *
   * @param postId
   */
  async function deletePostHandler(postId) {
    if (confirm('確定要刪除文章？')) {
      await deletePost(postId);
    }
  }

  // 編輯留言function
  /**
   *
   * @param commentId
   */
  async function editCommentButtonHandler(commentId) {
    // 點擊編輯按鈕後，把isCommentEditing設定成true/false ，再拿著commentId到comments裡面尋找該留言內容並且放入comment的useState中
    const target = comments.find((c) => c.id === commentId);
    setCommentEditing(target);
    setComment(target.comment);
    setIsCommentEditing(true);
  }

  // 刪除留言function
  /**
   *
   * @param commentId
   */
  async function deleteCommentButtonHandler(commentId) {
    if (!confirm('確定要刪除留言？')) return;
    try {
      await deleteComment(postId, commentId);

      // 若正在編輯這則留言，先退出編輯狀態
      if (commentEditing?.id === commentId) {
        setCommentEditing(null);
        setIsCommentEditing(false);
        setComment('');
      }

      // 從 comments state 中移除該留言
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      // 前端同步把留言數 -1（避免出現負數）
      setPostDetail((prev) => ({
        ...prev,
        commentsCount: Math.max(0, Number(prev?.commentsCount ?? 0) - 1),
      }));
      // 關閉該留言的選單
      setOpenMenuPostId('');
    } catch (e) {
      alert('刪除失敗，請稍後再試');
      console.error(e);
    }
  }

  if (!postDetail) return <p>載入中...</p>;
  /**
   *
   * @param e
   */
  async function submitCommentHandler(e) {
    e.preventDefault();

    if (!comment.trim() || !user?.uid) return;
    // 下一行要新增如果commentEditing裡面沒有資料代表這是新的留言，就繼續跑下面的邏輯
    if (!commentEditing) {
      const { id } = await addComment(postId, { user, comment }); // 先拿到新留言 id
      setComment(''); // 清空輸入框

      // 拿「那一筆」的正式資料（含真正的 createdAt）
      const mine = await getCommentById(postId, id);

      // 統一補上 isAuthor（你就是作者）
      const hydrated = mine ?? {
        id,
        authorUid: user.uid,
        authorName: user.name || '我',
        authorImgURL: user.photoURL || '',
        comment,
        createdAt: new Date(),
      };
      // 關鍵：不管用哪個來源，最後都加上 isAuthor
      const withFlag = { ...hydrated, isAuthor: true };

      setComments((prev) => [withFlag, ...prev]);
      // 留言數+1
      setPostDetail((prev) => ({
        ...prev,
        commentsCount: Math.max(0, Number(prev?.commentsCount ?? 0) + 1),
      }));
    } else {
      const newText = comment.trim();
      const prevText = comments.find((c) => c.id === commentEditing.id)?.comment ?? '';
      // 樂觀更新：在還沒確定資料庫已經完成更新前就先顯示更新後的畫面
      setComments((prev) => prev.map((c) => (c.id === commentEditing.id ? { ...c, comment: newText } : c)));
      try {
        await updateComment(postId, commentEditing.id, { comment: newText });
      } catch (e) {
        // 回滾
        setComments((prev) => prev.map((c) => (c.id === commentEditing.id ? { ...c, comment: prevText } : c)));
      }
      setComment('');
      setCommentEditing(null);
      setIsCommentEditing(false);
    }
  }

  /**
   *
   * @param e
   */
  function handleCommentChange(e) {
    setComment(e.target.value);
  }

  /**
   *
   */
  async function handleToggleLike() {
    if (!user?.uid) return;
    // 如果資料庫更新失敗就會回復到原本的按讚狀態
    const prevLiked = !!postDetail?.liked;
    const prevCount = Number(postDetail?.likesCount ?? 0);
    // 樂觀更新
    setPostDetail((prev) => ({
      ...prev,
      liked: !prevLiked,
      likesCount: Math.max(0, prevCount + (prevLiked ? -1 : 1)),
    }));
    const result = await toggleLikePost(postId, user.uid);
    if (result === 'fail') {
      setPostDetail((prev) => ({
        ...prev,
        liked: prevLiked,
        likesCount: prevCount,
      }));
    }
  }

  return (
    <article>
      <div
        className={styles.postOwnerMenu}
        style={{ display: postDetail?.isAuthor ? 'block' : 'none' }}
      >
        <button
          id={`post-owner-menu-btn-${postDetail.id}`}
          type="button"
          className={styles.postOwnerMenuButton}
          aria-label="更多選項"
          aria-haspopup="menu"
          aria-expanded={openMenuPostId === postDetail.id ? 'true' : 'false'}
          aria-controls={`post-owner-menu-${postDetail.id}`}
          onClick={(e) => toggleOwnerMenu(postDetail.id, e)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <title>更多選項</title>
            <circle cx="6" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="18" cy="12" r="1.75" />
          </svg>
        </button>
        <ul
          id={`post-owner-menu-${postDetail.id}`}
          className={styles.postOwnerMenuList}
          role="menu"
          aria-labelledby={`post-owner-menu-btn-${postDetail.id}`}
          hidden={postDetail.id !== openMenuPostId}
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={styles.postOwnerMenuItem}
              onClick={() => composeButtonHandler(postDetail.id)}
            >
              編輯
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={styles.postOwnerMenuItem}
              onClick={() => deletePostHandler(postDetail.id)}
            >
              刪除
            </button>
          </li>
        </ul>
      </div>
      <h2>{postDetail.title}</h2>
      <p>{postDetail.content}</p>
      {/* 所有留言區 */}
      <ul>
        {comments.map((comment) => (
          <li key={comment.id} className={styles.commentContainer}>
            <div
              className={styles.commentOwnerMenu}
              style={{ display: comment?.isAuthor ? 'block' : 'none' }}
            >
              <button
                id={`comment-owner-menu-btn-${comment.id}`}
                type="button"
                className={styles.commentOwnerMenuButton}
                aria-label="更多選項"
                aria-haspopup="menu"
                aria-expanded={openMenuPostId === comment.id ? 'true' : 'false'}
                aria-controls={`comment-owner-menu-${comment.id}`}
                onClick={(e) => toggleOwnerMenu(comment.id, e)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>更多選項</title>
                  <circle cx="6" cy="12" r="1.75" />
                  <circle cx="12" cy="12" r="1.75" />
                  <circle cx="18" cy="12" r="1.75" />
                </svg>
              </button>
              <ul
                id={`post-owner-menu-${comment.id}`}
                className={styles.commentOwnerMenuList}
                role="menu"
                aria-labelledby={`comment-owner-menu-btn-${comment.id}`}
                hidden={comment.id !== openMenuPostId}
              >
                <li role="none">
                  {/* function要改 */}
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.commentOwnerMenuItem}
                    onClick={() => editCommentButtonHandler(comment.id)}
                  >
                    編輯
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.postOwnerMenuItem}
                    onClick={() => deleteCommentButtonHandler(comment.id)}
                  >
                    刪除
                  </button>
                </li>
              </ul>
            </div>
            <Image
              src={comment.authorImgURL}
              alt={`${comment.authorName}的大頭貼`}
              width={20}
              height={20}
            />
            <h2>{comment.authorName}</h2>
            <p>{comment.comment}</p>
            {/* 按讚、留言 */}
          </li>
        ))}
      </ul>
      <div>
        <button
          type="button"
          className={styles.metaButton}
          onClick={handleToggleLike}
        >
          <svg
            width="16"
            height="16"
            fill={postDetail?.liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M12 21s-6.2-4.35-9.2-8.35C1.2 10.35 2.2 6.5 5.5 5c2.1-1 4.7-.3 6.5 1.5C13.8 4.7 16.4 4 18.5 5c3.3 1.5 4.3 5.35 2.7 7.65C18.2 16.65 12 21 12 21z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.metaCount}>{postDetail.likesCount ?? 0}</span>
        </button>
        <svg
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <g transform="translate(24,0) scale(-1,1)">
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
        <span className={styles.metaCount}>
          {postDetail.commentsCount ?? 0}
        </span>
      </div>
      {/* 留言欄位 */}
      <div>
        <form onSubmit={submitCommentHandler}>
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              alt={`${user?.name ?? '使用者'}的大頭貼`}
              width={50}
              height={50}
            />
          ) : null}
          <label htmlFor="comment" className="sr-only">
            留言
          </label>
          <input
            id="comment"
            type="text"
            placeholder="留言"
            value={comment}
            onChange={handleCommentChange}
          />
          <button type="submit">送出</button>
        </form>
      </div>
      {/* 文章作者編輯欄位 */}
      {isComposeEditing && (
        <div className="compose">
          <h2>編輯文章頁面</h2>
          <form onSubmit={handleSubmitPost}>
            <input
              type="text"
              placeholder="標題"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="有什麼新鮮的？"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button type="submit">發佈</button>
          </form>
        </div>
      )}
      <div ref={bottomRef} className={styles.scrollerFooter}>
        我是底部
      </div>
    </article>
  );
}
