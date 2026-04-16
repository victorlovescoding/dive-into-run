'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useContext, useCallback } from 'react';
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
  validatePostInput,
  POST_NOT_FOUND_MESSAGE,
} from '@/lib/firebase-posts';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { notifyPostNewComment, notifyPostCommentReply } from '@/lib/firebase-notifications';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import ShareButton from '@/components/ShareButton';
import PostCard from '@/components/PostCard';
import CommentCard from '@/components/CommentCard';
import ComposeModal from '@/components/ComposeModal';
import styles from '../postDetail.module.css';

const INFINITE_SCROLL_MARGIN = '300px 0px';

/**
 * 將 PostDetailClient 的留言物件映射為 CommentCard 期望的 CommentData 格式。
 * @param {object} commentItem - 原始留言物件。
 * @param {string} commentItem.id - 留言 ID。
 * @param {string} commentItem.authorUid - 留言者 UID。
 * @param {string} [commentItem.authorName] - 留言者名稱。
 * @param {string} [commentItem.authorImgURL] - 留言者頭像 URL。
 * @param {string} commentItem.comment - 留言內容。
 * @param {import('firebase/firestore').Timestamp} commentItem.createdAt - 建立時間。
 * @returns {import('@/lib/firebase-comments').CommentData} CommentCard 格式資料。
 */
function mapToCommentCardData(commentItem) {
  return {
    id: commentItem.id,
    authorUid: commentItem.authorUid,
    authorName: commentItem.authorName ?? '使用者',
    authorPhotoURL: commentItem.authorImgURL,
    content: commentItem.comment,
    createdAt: commentItem.createdAt,
    updatedAt: null,
    isEdited: false,
  };
}

/**
 * 文章詳情頁面客戶端元件，含留言、按讚與無限滾動。
 * @param {object} root0 - 元件屬性。
 * @param {string} root0.postId - 文章 ID。
 * @returns {import('react').JSX.Element} 文章詳情頁面。
 */
export default function PostDetailClient({ postId }) {
  // -- State --
  const [postDetail, setPostDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [commentEditing, setCommentEditing] = useState(null);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  // -- Context --
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // -- Refs --
  const bottomRef = useRef(null);
  const dialogRef = useRef(null);

  // -- Derived values --
  const highlightedCommentId = searchParams.get('commentId');
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/posts/${postId}`
      : `/posts/${postId}`;

  const enrichedPost = postDetail
    ? {
        ...postDetail,
        liked: !!postDetail.liked,
        isAuthor: !!postDetail.isAuthor,
      }
    : null;

  // -- Effects --

  useEffect(() => {
    if (!postId) return undefined;
    let cancelled = false;

    /** 載入文章詳情及留言資料；文章不存在時進入 error 分支。 */
    async function fetchPost() {
      setLoading(true);
      setError(null);
      try {
        const postDetailData = await getPostDetail(postId);
        if (cancelled) return;

        if (!postDetailData) {
          setPostDetail(null);
          setError('找不到這篇文章（可能已被刪除）');
          return;
        }

        setPostDetail(postDetailData);

        const commentsData = await getLatestComments(postId, 10);
        if (cancelled) return;
        const last = commentsData[commentsData.length - 1];
        setNextCursor(last);
        setComments(
          commentsData.map((prev) => ({
            ...prev,
            isAuthor: prev.authorUid === user?.uid,
          })),
        );

        if (user?.uid) {
          const liked = await hasUserLikedPost(user.uid, postId);
          if (cancelled) return;
          setPostDetail((prev) =>
            prev
              ? {
                  ...prev,
                  liked,
                  isAuthor: prev.authorUid === user.uid,
                }
              : prev,
          );
        } else {
          setPostDetail((prev) => (prev ? { ...prev, liked: false } : prev));
        }
      } catch (err) {
        console.error('讀取文章詳情失敗:', err);
        if (!cancelled) setError('讀取文章詳情失敗，請稍後再試');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPost();
    return () => {
      cancelled = true;
    };
  }, [postId, user?.uid]);

  useEffect(() => {
    if (!bottomRef.current || !nextCursor || isLoadingNext || !postId) {
      return undefined;
    }
    const intersectionObserver = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || isLoadingNext) return;
        intersectionObserver.unobserve(entry.target);
        setIsLoadingNext(true);
        let shouldReobserve = true;
        try {
          const moreComments = await getMoreComments(postId, nextCursor);
          if (moreComments.length === 0) {
            setNextCursor(null);
            shouldReobserve = false;
            return;
          }
          const last = moreComments[moreComments.length - 1];
          setNextCursor(last);

          const hydrated = moreComments.map((prev) => ({
            ...prev,
            isAuthor: prev.authorUid === user?.uid,
          }));

          setComments((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            const fresh = hydrated.filter((x) => !seen.has(x.id));
            return [...prev, ...fresh];
          });

          if (moreComments.length < 10) {
            setNextCursor(null);
            shouldReobserve = false;
          }
        } catch (e) {
          console.error(e);
          shouldReobserve = false;
        } finally {
          setIsLoadingNext(false);
          if (shouldReobserve && bottomRef.current) {
            intersectionObserver.observe(bottomRef.current);
          } else {
            intersectionObserver.disconnect();
          }
        }
      },
      {
        root: null,
        threshold: 0,
        rootMargin: INFINITE_SCROLL_MARGIN,
      },
    );
    const el = bottomRef.current;
    intersectionObserver.observe(el);
    return () => {
      intersectionObserver.disconnect();
    };
  }, [postId, nextCursor, isLoadingNext, user?.uid, comments.length]);

  useEffect(() => {
    const commentId = searchParams.get('commentId');
    if (!commentId) return undefined;

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

  // -- Handlers --

  /**
   * 開啟 ComposeModal 編輯文章。
   * @param {string} targetId - 文章 ID。
   */
  const composeButtonHandler = useCallback(
    (targetId) => {
      if (!postDetail) return;
      if (targetId) {
        setTitle(postDetail.title);
        setContent(postDetail.content);
        setEditingPostId(targetId);
      }
      dialogRef.current?.showModal();
    },
    [postDetail],
  );

  /**
   * 送出編輯後的文章更新。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單送出事件。
   */
  const handleSubmitPost = useCallback(
    async (e) => {
      e.preventDefault();

      const validationError = validatePostInput({ title, content });
      if (validationError) {
        showToast(validationError, 'error');
        return;
      }

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
      setEditingPostId(null);
      dialogRef.current?.close();
    },
    [title, content, editingPostId, showToast],
  );

  /**
   * 切換文章或留言的作者操作選單顯示。
   * @param {string} menuTargetId - 文章或留言 ID。
   * @param {import('react').MouseEvent} e - 滑鼠點擊事件。
   */
  const toggleOwnerMenu = useCallback(
    (menuTargetId, e) => {
      e.stopPropagation();
      if (menuTargetId === openMenuPostId) {
        setOpenMenuPostId('');
      } else {
        setOpenMenuPostId(menuTargetId);
      }
    },
    [openMenuPostId],
  );

  /**
   * 確認後刪除文章。
   * @param {string} targetPostId - 要刪除的文章 ID。
   */
  const deletePostHandler = useCallback(
    async (targetPostId) => {
      // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
      if (!window.confirm('確定要刪除文章？')) return;
      try {
        await deletePost(targetPostId);
        router.push('/posts?toast=文章已刪除');
      } catch (err) {
        // Race condition：其他 tab / session 已先刪除此篇文章。
        // 沿用 e358a82「載入時已刪除」的紅卡片 UI，避免誤導使用者以為
        // 自己先前的刪除操作失敗。用 warn 級 log 留 trace 但不觸發
        // Next.js dev overlay（只有 console.error 會）。
        if (err instanceof Error && err.message === POST_NOT_FOUND_MESSAGE) {
          console.warn('Delete post skipped: already deleted by another session');
          setPostDetail(null);
          setError('找不到這篇文章（可能已被刪除）');
          return;
        }
        console.error('Delete post error:', err);
        showToast('刪除文章失敗，請稍後再試', 'error');
      }
    },
    [router, showToast],
  );

  /**
   * 按讚包裝函式，搭配樂觀更新與失敗回滾。忽略 PostCard 傳入的 postId。
   */
  const handleToggleLikeWrapper = useCallback(async () => {
    if (!user?.uid || !postDetail) return;
    const prevLiked = !!postDetail?.liked;
    const prevCount = Number(postDetail?.likesCount ?? 0);
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
  }, [postId, user?.uid, postDetail]);

  /**
   * 進入留言編輯模式，載入該留言內容。
   * @param {string} commentId - 要編輯的留言 ID。
   */
  async function editCommentButtonHandler(commentId) {
    const target = comments.find((c) => c.id === commentId);
    setCommentEditing(target);
    setComment(target.comment);
  }

  /**
   * 確認後刪除留言，並同步更新前端狀態。
   * @param {string} commentId - 要刪除的留言 ID。
   */
  async function deleteCommentButtonHandler(commentId) {
    // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
    if (!window.confirm('確定要刪除留言？')) return;
    try {
      await deleteComment(postId, commentId);

      if (commentEditing?.id === commentId) {
        setCommentEditing(null);
        setComment('');
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));

      setPostDetail((prev) => ({
        ...prev,
        commentsCount: Math.max(0, Number(prev?.commentsCount ?? 0) - 1),
      }));
      setOpenMenuPostId('');
    } catch (err) {
      showToast('刪除失敗，請稍後再試', 'error');
      console.error(err);
    }
  }

  /**
   * 送出新留言或更新既有留言。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單送出事件。
   */
  async function submitCommentHandler(e) {
    e.preventDefault();

    if (!comment.trim() || !user?.uid || !postDetail) return;
    if (!commentEditing) {
      const { id } = await addComment(postId, { user, comment });
      const actor = { uid: user.uid, name: user.name || '', photoURL: user.photoURL || '' };

      if (user.uid !== postDetail.authorUid) {
        notifyPostNewComment(postId, postDetail.title, postDetail.authorUid, id, actor).catch(
          (notifyErr) => {
            console.error('通知建立失敗:', notifyErr);
            showToast('通知發送失敗', 'error');
          },
        );
      }

      notifyPostCommentReply(postId, postDetail.title, postDetail.authorUid, id, actor).catch(
        (notifyErr) => {
          console.error('跟帖通知失敗:', notifyErr);
        },
      );

      setComment('');

      const mine = await getCommentById(postId, id);

      const hydrated = mine ?? {
        id,
        authorUid: user.uid,
        authorName: user.name || '我',
        authorImgURL: user.photoURL || '',
        comment,
        createdAt: new Date(),
      };
      const withFlag = { ...hydrated, isAuthor: true };

      setComments((prev) => [withFlag, ...prev]);
      setPostDetail((prev) => ({
        ...prev,
        commentsCount: Math.max(0, Number(prev?.commentsCount ?? 0) + 1),
      }));
    } else {
      const newText = comment.trim();
      const prevText = comments.find((c) => c.id === commentEditing.id)?.comment ?? '';
      setComments((prev) =>
        prev.map((c) => (c.id === commentEditing.id ? { ...c, comment: newText } : c)),
      );
      try {
        await updateComment(postId, commentEditing.id, { comment: newText });
      } catch {
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

  // -- Render --

  return (
    <div className={styles.detailContainer}>
      <Link href="/posts" className={styles.backLink}>
        ← 回到文章列表
      </Link>

      {loading && (
        <div className={styles.statusRow} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <span>正在載入文章詳情…</span>
        </div>
      )}

      {error && (
        <div className={styles.errorCard} role="alert">
          {error}
        </div>
      )}

      {!loading && !error && postDetail && (
        <>
          <PostCard
            post={enrichedPost}
            truncate={false}
            openMenuPostId={openMenuPostId}
            onToggleMenu={toggleOwnerMenu}
            onEdit={composeButtonHandler}
            onDelete={deletePostHandler}
            onLike={handleToggleLikeWrapper}
          >
            <ShareButton title={postDetail.title} url={shareUrl} />
          </PostCard>

          <section className={styles.commentsSection}>
            <h3 className={styles.commentsTitle}>留言 ({postDetail?.commentsCount ?? 0})</h3>
            {comments.map((commentItem) => (
              <CommentCard
                key={commentItem.id}
                comment={mapToCommentCardData(commentItem)}
                isOwner={!!commentItem.isAuthor}
                isHighlighted={commentItem.id === highlightedCommentId}
                onEdit={(c) => {
                  editCommentButtonHandler(c.id);
                }}
                onDelete={(c) => {
                  deleteCommentButtonHandler(c.id);
                }}
              />
            ))}
          </section>

          <form onSubmit={submitCommentHandler} className={styles.commentForm}>
            {user?.photoURL && (
              <Image
                src={user.photoURL}
                alt={`${user?.name ?? '使用者'}的大頭貼`}
                width={36}
                height={36}
                className={styles.commentAvatar}
              />
            )}
            <input
              type="text"
              placeholder="留言"
              aria-label="留言"
              value={comment}
              onChange={handleCommentChange}
              className={styles.commentInput}
            />
            <button type="submit" className={styles.commentSubmit}>
              送出
            </button>
          </form>

          <ComposeModal
            dialogRef={dialogRef}
            title={title}
            content={content}
            onTitleChange={setTitle}
            onContentChange={setContent}
            onSubmit={handleSubmitPost}
            isEditing
          />

          {isLoadingNext && <PostCardSkeleton count={1} />}
          <div ref={bottomRef} className={styles.scrollSentinel} />
        </>
      )}
    </div>
  );
}
