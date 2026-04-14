'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useContext } from 'react';
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
import { useToast } from '@/contexts/ToastContext';
import { notifyPostNewComment } from '@/lib/firebase-notifications';
import ShareButton from '@/components/ShareButton';
import UserLink from '@/components/UserLink';
import styles from '../postDetail.module.css';

const INFINITE_SCROLL_MARGIN = '300px 0px';
/**
 * 文章詳情頁面客戶端元件，含留言、按讚與無限滾動。
 * @param {object} root0 - 元件屬性。
 * @param {string} root0.postId - 文章 ID。
 * @returns {import('react').JSX.Element} 文章詳情頁面。
 */
export default function PostDetailClient({ postId }) {
  const [postDetail, setPostDetail] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [commentEditing, setCommentEditing] = useState(null);
  const [isComposeEditing, setIsComposeEditing] = useState(false);
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    /** 載入文章詳情及留言資料。 */
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
    if (!bottomRef.current || !nextCursor || isLoadingNext || !postId) return undefined;
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
  }, [postId, nextCursor, isLoadingNext, user?.uid, comments.length]);

  // Scroll-to-comment: 從通知點擊導航至留言時滾動到指定留言
  useEffect(() => {
    const commentId = searchParams.get('commentId');
    if (!commentId) return undefined;

    // 需要等留言載入完成，使用 setTimeout 確保 DOM 已更新
    const timer = setTimeout(() => {
      const el = document.getElementById(commentId);
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('commentHighlight');

      /** 動畫結束後移除高亮 class。 */
      const handleAnimationEnd = () => {
        el.classList.remove('commentHighlight');
      };
      el.addEventListener('animationend', handleAnimationEnd, { once: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchParams]);

  /**
   * 切換文章編輯模式，並載入既有內容。
   * @param {string} targetId - 文章 ID。
   */
  function composeButtonHandler(targetId) {
    // 按下寫文章按鈕後，跳出編輯頁面
    if (targetId && !isComposeEditing) {
      setTitle(postDetail.title);
      setContent(postDetail.content);
      setIsComposeEditing(true);
      setEditingPostId(targetId);
    } else if (targetId && isComposeEditing) {
      setIsComposeEditing(false);
    } else if (!targetId && !isComposeEditing) {
      setIsComposeEditing(true);
      setTitle('');
      setContent('');
    } else {
      setIsComposeEditing(false);
    }
  }

  /**
   * 送出編輯後的文章更新。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單送出事件。
   */
  async function handleSubmitPost(e) {
    e.preventDefault();
    try {
      if (editingPostId) {
        await updatePost(editingPostId, { title, content });
        setPostDetail((prev) => ({ ...prev, title, content }));
        showToast('更新文章成功');
      }
    } catch (err) {
      console.error('Post update error:', err);
      showToast('更新文章失敗，請稍後再試', 'error');
    }
    setTitle('');
    setContent('');
    setIsComposeEditing(false);
    setEditingPostId(null);
  }

  /**
   * 切換文章或留言的作者操作選單顯示。
   * @param {string} menuTargetId - 文章或留言 ID。
   * @param {import('react').MouseEvent} e - 滑鼠點擊事件。
   */
  function toggleOwnerMenu(menuTargetId, e) {
    e.stopPropagation();
    if (menuTargetId === openMenuPostId) {
      setOpenMenuPostId('');
    } else {
      setOpenMenuPostId(menuTargetId);
    }
  }

  /**
   * 確認後刪除文章。
   * @param {string} targetPostId - 要刪除的文章 ID。
   */
  async function deletePostHandler(targetPostId) {
    // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
    if (!window.confirm('確定要刪除文章？')) return;
    try {
      await deletePost(targetPostId);
      router.push('/posts?toast=文章已刪除');
    } catch (err) {
      console.error('Delete post error:', err);
      showToast('刪除文章失敗，請稍後再試', 'error');
    }
  }

  // 編輯留言function
  /**
   * 進入留言編輯模式，載入該留言內容。
   * @param {string} commentId - 要編輯的留言 ID。
   */
  async function editCommentButtonHandler(commentId) {
    // 點擊編輯按鈕後，把isCommentEditing設定成true/false ，再拿著commentId到comments裡面尋找該留言內容並且放入comment的useState中
    const target = comments.find((c) => c.id === commentId);
    setCommentEditing(target);
    setComment(target.comment);
  }

  // 刪除留言function
  /**
   * 確認後刪除留言，並同步更新前端狀態。
   * @param {string} commentId - 要刪除的留言 ID。
   */
  async function deleteCommentButtonHandler(commentId) {
    // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
    if (!window.confirm('確定要刪除留言？')) return;
    try {
      await deleteComment(postId, commentId);

      // 若正在編輯這則留言，先退出編輯狀態
      if (commentEditing?.id === commentId) {
        setCommentEditing(null);
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
    } catch (err) {
      showToast('刪除失敗，請稍後再試', 'error');
      console.error(err);
    }
  }

  if (!postDetail) return <p>載入中...</p>;
  /**
   * 送出新留言或更新既有留言。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單送出事件。
   */
  async function submitCommentHandler(e) {
    e.preventDefault();

    if (!comment.trim() || !user?.uid) return;
    // 下一行要新增如果commentEditing裡面沒有資料代表這是新的留言，就繼續跑下面的邏輯
    if (!commentEditing) {
      const { id } = await addComment(postId, { user, comment }); // 先拿到新留言 id

      // 通知文章作者有新留言（自己留言不通知，fire-and-forget）
      if (user.uid !== postDetail.authorUid) {
        notifyPostNewComment(postId, postDetail.title, postDetail.authorUid, id, {
          uid: user.uid,
          name: user.name || '',
          photoURL: user.photoURL || '',
        }).catch((notifyErr) => {
          console.error('通知建立失敗:', notifyErr);
          showToast('通知發送失敗', 'error');
        });
      }

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
      setComments((prev) =>
        prev.map((c) => (c.id === commentEditing.id ? { ...c, comment: newText } : c)),
      );
      try {
        await updateComment(postId, commentEditing.id, { comment: newText });
      } catch {
        // 回滾
        setComments((prev) =>
          prev.map((c) => (c.id === commentEditing.id ? { ...c, comment: prevText } : c)),
        );
      }
      setComment('');
      setCommentEditing(null);
    }
  }

  /**
   * 處理留言輸入框內容變更。
   * @param {import('react').ChangeEvent<HTMLInputElement>} e - 輸入框變更事件。
   */
  function handleCommentChange(e) {
    setComment(e.target.value);
  }

  /** 切換文章按讚狀態，搭配樂觀更新與失敗回滾。 */
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
      <div className={styles.titleRow}>
        <h2>{postDetail.title}</h2>
        <ShareButton title={postDetail.title} url={`${window.location.origin}/posts/${postId}`} />
      </div>
      <p>{postDetail.content}</p>
      {/* 所有留言區 */}
      <ul>
        {comments.map((commentItem) => (
          <li key={commentItem.id} id={commentItem.id} className={styles.commentContainer}>
            <div
              className={styles.commentOwnerMenu}
              style={{ display: commentItem?.isAuthor ? 'block' : 'none' }}
            >
              <button
                id={`comment-owner-menu-btn-${commentItem.id}`}
                type="button"
                className={styles.commentOwnerMenuButton}
                aria-label="更多選項"
                aria-haspopup="menu"
                aria-expanded={openMenuPostId === commentItem.id ? 'true' : 'false'}
                aria-controls={`comment-owner-menu-${commentItem.id}`}
                onClick={(e) => toggleOwnerMenu(commentItem.id, e)}
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
                id={`post-owner-menu-${commentItem.id}`}
                className={styles.commentOwnerMenuList}
                role="menu"
                aria-labelledby={`comment-owner-menu-btn-${commentItem.id}`}
                hidden={commentItem.id !== openMenuPostId}
              >
                <li role="none">
                  {/* function要改 */}
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.commentOwnerMenuItem}
                    onClick={() => editCommentButtonHandler(commentItem.id)}
                  >
                    編輯
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.postOwnerMenuItem}
                    onClick={() => deleteCommentButtonHandler(commentItem.id)}
                  >
                    刪除
                  </button>
                </li>
              </ul>
            </div>
            <UserLink
              uid={commentItem.authorUid}
              name={commentItem.authorName ?? '使用者'}
              photoURL={commentItem.authorImgURL}
              size={20}
            />
            <p>{commentItem.comment}</p>
            {/* 按讚、留言 */}
          </li>
        ))}
      </ul>
      <div>
        <button type="button" className={styles.metaButton} onClick={handleToggleLike}>
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
        <span className={styles.metaCount}>{postDetail.commentsCount ?? 0}</span>
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
          <input
            type="text"
            placeholder="留言"
            aria-label="留言"
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
