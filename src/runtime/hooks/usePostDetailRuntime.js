'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  POST_NOT_FOUND_MESSAGE,
  deletePost,
  getLatestComments,
  getPostDetail,
  hasUserLikedPost,
  toggleLikePost,
  updatePost,
  validatePostInput,
} from '@/runtime/client/use-cases/post-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import usePostComments from '@/runtime/hooks/usePostComments';

const POST_DELETED_MESSAGE = '找不到這篇文章（可能已被刪除）';

/**
 * 文章詳情頁 runtime orchestration。
 * @param {string} postId - 文章 ID。
 * @returns {object} 詳情頁 state 與 handlers。
 */
export default function usePostDetailRuntime(postId) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();

  const [postDetail, setPostDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);

  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    comments,
    comment,
    highlightedCommentId,
    isLoadingNext,
    bottomRef,
    handleEditComment,
    handleDeleteComment,
    handleSubmitComment,
    handleCommentChange,
    setInitialComments,
  } = usePostComments({ postId, user, postDetail, setPostDetail, setOpenMenuPostId });

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/posts/${postId}`
      : `/posts/${postId}`;

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
          setInitialComments({ comments: [], nextCursor: null });
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
          setInitialComments({ comments: [], nextCursor: null });
          setError(POST_DELETED_MESSAGE);
          return;
        }

        const commentsData = await getLatestComments(postId, 10);
        if (cancelled || !isMountedRef.current) return;

        const last = commentsData[commentsData.length - 1] ?? null;
        const nextPostDetail = user?.uid
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
        setInitialComments({ comments: commentsData, nextCursor: last });
      } catch (loadError) {
        console.error('讀取文章詳情失敗:', loadError);
        if (!cancelled && isMountedRef.current) {
          setPostDetail(null);
          setInitialComments({ comments: [], nextCursor: null });
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
  }, [postId, setInitialComments, user?.uid]);

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
