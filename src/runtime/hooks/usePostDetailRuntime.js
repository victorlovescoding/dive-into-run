'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createFirestoreTimestamp } from '@/lib/firebase-firestore-timestamp';
import {
  POST_NOT_FOUND_MESSAGE,
  addComment,
  deleteComment,
  deletePost,
  getCommentById,
  getLatestComments,
  getMoreComments,
  getPostDetail,
  hasUserLikedPost,
  toggleLikePost,
  updateComment,
  updatePost,
  validatePostInput,
} from '@/runtime/client/use-cases/post-use-cases';
import {
  notifyPostCommentReply,
  notifyPostNewComment,
} from '@/runtime/client/use-cases/notification-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';

const INFINITE_SCROLL_MARGIN = '300px 0px';
const POST_DELETED_MESSAGE = '找不到這篇文章（可能已被刪除）';

/**
 * 將留言加上目前使用者視角的 UI flag。
 * @param {Array<object>} comments - 原始留言清單。
 * @param {string | null | undefined} userUid - 目前使用者 UID。
 * @returns {Array<object>} 帶有 isAuthor 的留言清單。
 */
function hydrateComments(comments, userUid) {
  return (Array.isArray(comments) ? comments : []).map((commentItem) => ({
    ...commentItem,
    isAuthor: commentItem.authorUid === userUid,
  }));
}

/**
 * 文章詳情頁 runtime orchestration。
 * @param {string} postId - 文章 ID。
 * @returns {object} 詳情頁 state 與 handlers。
 */
export default function usePostDetailRuntime(postId) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [postDetail, setPostDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentEditing, setCommentEditing] = useState(null);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const highlightedCommentId = searchParams.get('commentId');
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/posts/${postId}` : `/posts/${postId}`;

  const actor = useMemo(() => {
    if (!user?.uid) return null;
    return {
      uid: user.uid,
      name: user.name || '',
      photoURL: user.photoURL || '',
    };
  }, [user]);

  const post = useMemo(() => {
    if (!postDetail) return null;
    return {
      ...postDetail,
      liked: !!postDetail.liked,
      isAuthor: !!postDetail.isAuthor,
    };
  }, [postDetail]);

  useEffect(() => {
    let cancelled = false;

    /** 載入文章詳情與首批留言。 */
    async function loadPostDetail() {
      if (!postId) {
        if (!cancelled && isMountedRef.current) {
          setPostDetail(null);
          setComments([]);
          setNextCursor(null);
          setError(POST_DELETED_MESSAGE);
          setLoading(false);
        }
        return;
      }

      if (!cancelled && isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const postDetailData = await getPostDetail(postId);
        if (cancelled || !isMountedRef.current) return;

        if (!postDetailData) {
          setPostDetail(null);
          setComments([]);
          setNextCursor(null);
          setError(POST_DELETED_MESSAGE);
          return;
        }

        const commentsData = await getLatestComments(postId, 10);
        if (cancelled || !isMountedRef.current) return;

        const last = commentsData[commentsData.length - 1] ?? null;
        const nextPostDetail =
          user?.uid
            ? {
                ...postDetailData,
                liked: await hasUserLikedPost(user.uid, postId),
                isAuthor: postDetailData.authorUid === user.uid,
              }
            : {
                ...postDetailData,
                liked: false,
                isAuthor: false,
              };

        if (cancelled || !isMountedRef.current) return;
        setPostDetail(nextPostDetail);
        setNextCursor(last);
        setComments(hydrateComments(commentsData, user?.uid));
      } catch (loadError) {
        console.error('讀取文章詳情失敗:', loadError);
        if (!cancelled && isMountedRef.current) {
          setPostDetail(null);
          setComments([]);
          setNextCursor(null);
          setError('讀取文章詳情失敗，請稍後再試');
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadPostDetail();

    return () => {
      cancelled = true;
    };
  }, [postId, user?.uid]);

  useEffect(() => {
    if (
      !bottomRef.current ||
      !nextCursor ||
      isLoadingNext ||
      !postId ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || isLoadingNext) return;

        observer.unobserve(entry.target);
        if (isMountedRef.current) {
          setIsLoadingNext(true);
        }

        let shouldReobserve = true;
        try {
          const moreComments = await getMoreComments(postId, nextCursor);
          if (!isMountedRef.current) return;

          if (moreComments.length === 0) {
            setNextCursor(null);
            shouldReobserve = false;
            return;
          }

          const last = moreComments[moreComments.length - 1] ?? null;
          const hydratedComments = hydrateComments(moreComments, user?.uid);

          setNextCursor(last);
          setComments((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            const fresh = hydratedComments.filter((item) => !seen.has(item.id));
            return [...prev, ...fresh];
          });

          if (moreComments.length < 10) {
            setNextCursor(null);
            shouldReobserve = false;
          }
        } catch (loadMoreError) {
          console.error(loadMoreError);
          shouldReobserve = false;
        } finally {
          if (!isMountedRef.current) {
            observer.disconnect();
          } else {
            setIsLoadingNext(false);
            if (shouldReobserve && bottomRef.current) {
              observer.observe(bottomRef.current);
            } else {
              observer.disconnect();
            }
          }
        }
      },
      { root: null, threshold: 0, rootMargin: INFINITE_SCROLL_MARGIN },
    );

    const sentinel = bottomRef.current;
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [comments.length, isLoadingNext, nextCursor, postId, user?.uid]);

  useEffect(() => {
    const commentId = searchParams.get('commentId');
    if (!commentId) return undefined;

    let attempts = 0;
    const maxAttempts = 20;
    const timer = setInterval(() => {
      attempts += 1;
      const element = document.getElementById(commentId);
      if (element) {
        clearInterval(timer);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('commentHighlight');
        element.addEventListener(
          'animationend',
          () => {
            element.classList.remove('commentHighlight');
          },
          { once: true },
        );
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [searchParams]);

  const handleOpenEdit = useCallback(
    (targetId) => {
      if (!postDetail) return;
      if (targetId) {
        setTitle(postDetail.title);
        setContent(postDetail.content);
        setOriginalTitle(postDetail.title);
        setOriginalContent(postDetail.content);
        setEditingPostId(targetId);
      }
      dialogRef.current?.showModal();
    },
    [postDetail],
  );

  const handleSubmitPost = useCallback(
    async (event) => {
      event.preventDefault();

      const validationError = validatePostInput({ title, content });
      if (validationError) {
        showToast(validationError, 'error');
        return;
      }

      try {
        setIsSubmitting(true);
        if (editingPostId) {
          await updatePost(editingPostId, { title, content });
          setPostDetail((prev) =>
            prev ? { ...prev, title: title.trim(), content: content.trim() } : prev,
          );
          showToast('更新文章成功');
        }
      } catch (submitError) {
        console.error('Post update error:', submitError);
        showToast('更新文章失敗，請稍後再試', 'error');
      } finally {
        setIsSubmitting(false);
      }

      setTitle('');
      setContent('');
      setOriginalTitle('');
      setOriginalContent('');
      setEditingPostId(null);
      dialogRef.current?.close();
    },
    [content, editingPostId, showToast, title],
  );

  const handleToggleMenu = useCallback((menuTargetId, event) => {
    event.stopPropagation();
    setOpenMenuPostId((prev) => (prev === menuTargetId ? '' : menuTargetId));
  }, []);

  const handleDeletePost = useCallback(
    async (targetPostId) => {
      // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
      if (!window.confirm('確定要刪除文章？')) return;

      try {
        await deletePost(targetPostId);
        router.push('/posts?toast=文章已刪除');
      } catch (deleteError) {
        if (deleteError instanceof Error && deleteError.message === POST_NOT_FOUND_MESSAGE) {
          console.warn('Delete post skipped: already deleted by another session');
          setPostDetail(null);
          setError(POST_DELETED_MESSAGE);
          return;
        }
        console.error('Delete post error:', deleteError);
        showToast('刪除文章失敗，請稍後再試', 'error');
      }
    },
    [router, showToast],
  );

  const handleToggleLike = useCallback(async () => {
    if (!user?.uid || !postDetail) return;

    const prevLiked = !!postDetail.liked;
    const prevCount = Number(postDetail.likesCount ?? 0);
    setPostDetail((prev) =>
      prev
        ? {
            ...prev,
            liked: !prevLiked,
            likesCount: Math.max(0, prevCount + (prevLiked ? -1 : 1)),
          }
        : prev,
    );

    const result = await toggleLikePost(postId, user.uid);
    if (result === 'fail') {
      setPostDetail((prev) =>
        prev
          ? {
              ...prev,
              liked: prevLiked,
              likesCount: prevCount,
            }
          : prev,
      );
    }
  }, [postDetail, postId, user?.uid]);

  const handleEditComment = useCallback(
    (commentId) => {
      const target = comments.find((commentItem) => commentItem.id === commentId);
      if (!target) return;
      setCommentEditing(target);
      setComment(target.comment);
    },
    [comments],
  );

  const handleDeleteComment = useCallback(
    async (commentId) => {
      // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
      if (!window.confirm('確定要刪除留言？')) return;

      try {
        await deleteComment(postId, commentId);

        if (commentEditing?.id === commentId) {
          setCommentEditing(null);
          setComment('');
        }

        setComments((prev) => prev.filter((commentItem) => commentItem.id !== commentId));
        setPostDetail((prev) =>
          prev
            ? {
                ...prev,
                commentsCount: Math.max(0, Number(prev.commentsCount ?? 0) - 1),
              }
            : prev,
        );
        setOpenMenuPostId('');
      } catch (deleteError) {
        showToast('刪除失敗，請稍後再試', 'error');
        console.error(deleteError);
      }
    },
    [commentEditing?.id, postId, showToast],
  );

  const handleSubmitComment = useCallback(
    async (event) => {
      event.preventDefault();

      if (!comment.trim() || !user?.uid || !postDetail) return;

      if (!commentEditing) {
        const rawComment = comment;
        const { id } = await addComment(postId, { user, comment: rawComment });

        if (!actor) return;

        if (user.uid !== postDetail.authorUid) {
          notifyPostNewComment(postId, postDetail.title, postDetail.authorUid, id, actor).catch(
            (notifyError) => {
              console.error('通知建立失敗:', notifyError);
              showToast('通知發送失敗', 'error');
            },
          );
        }

        notifyPostCommentReply(postId, postDetail.title, postDetail.authorUid, id, actor).catch(
          (notifyError) => {
            console.error('跟帖通知失敗:', notifyError);
          },
        );

        setComment('');

        const mine = await getCommentById(postId, id);
        const hydratedComment =
          mine ?? {
            id,
            authorUid: user.uid,
            authorName: user.name || '我',
            authorImgURL: user.photoURL || '',
            comment: rawComment,
            createdAt: createFirestoreTimestamp(new Date()),
          };

        setComments((prev) => [{ ...hydratedComment, isAuthor: true }, ...prev]);
        setPostDetail((prev) =>
          prev
            ? {
                ...prev,
                commentsCount: Math.max(0, Number(prev.commentsCount ?? 0) + 1),
              }
            : prev,
        );
        return;
      }

      const newText = comment.trim();
      const prevText = comments.find((commentItem) => commentItem.id === commentEditing.id)?.comment ?? '';

      setComments((prev) =>
        prev.map((commentItem) =>
          commentItem.id === commentEditing.id ? { ...commentItem, comment: newText } : commentItem,
        ),
      );

      try {
        await updateComment(postId, commentEditing.id, { comment: newText });
      } catch {
        setComments((prev) =>
          prev.map((commentItem) =>
            commentItem.id === commentEditing.id
              ? { ...commentItem, comment: prevText }
              : commentItem,
          ),
        );
      }

      setComment('');
      setCommentEditing(null);
    },
    [actor, comment, commentEditing, comments, postDetail, postId, showToast, user],
  );

  const handleCommentChange = useCallback((event) => {
    setComment(event.target.value);
  }, []);

  return {
    user,
    post,
    loading,
    error,
    shareUrl,
    comments,
    highlightedCommentId,
    comment,
    title,
    content,
    originalTitle,
    originalContent,
    isSubmitting,
    isLoadingNext,
    openMenuPostId,
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleToggleMenu,
    handleOpenEdit,
    handleSubmitPost,
    handleDeletePost,
    handleToggleLike,
    handleEditComment,
    handleDeleteComment,
    handleSubmitComment,
    handleCommentChange,
  };
}
