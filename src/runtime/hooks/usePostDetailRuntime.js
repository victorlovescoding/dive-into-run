/* eslint-disable max-lines -- Existing detail runtime exceeds the shared limit after scoped draft lifecycle wiring. */
'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  POST_NOT_FOUND_MESSAGE,
  deletePost,
  getLatestCommentsPage,
  getPostDetail,
  hasUserLikedPost,
  toggleLikePost,
  updatePost,
  validatePostInput,
} from '@/runtime/client/use-cases/post-use-cases';
import {
  FAVORITE_CONTENT_TYPES,
  addContentFavorite,
  getFavoritedTargetIds,
  removeContentFavorite,
} from '@/runtime/client/use-cases/content-favorite-use-cases';
import {
  loadPostComposerDraft,
  removePostComposerDraft,
  savePostComposerDraft,
} from '@/repo/client/post-composer-draft-storage-repo';
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
  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);

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
      isFavorited: !!postDetail.isFavorited,
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
          setInitialComments({ comments: [], nextCursor: null, hasMore: false });
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
          setInitialComments({ comments: [], nextCursor: null, hasMore: false });
          setError(POST_DELETED_MESSAGE);
          return;
        }

        const commentsPage = await getLatestCommentsPage(postId, 10);
        if (cancelled || !isMountedRef.current) return;

        const [liked, favoritePostIds] = user?.uid
          ? await Promise.all([
              hasUserLikedPost(user.uid, postId),
              getFavoritedTargetIds({
                uid: user.uid,
                type: FAVORITE_CONTENT_TYPES.POST,
                targetIds: [postId],
              }),
            ])
          : [false, new Set()];
        const nextPostDetail = {
          ...postDetailData,
          liked,
          isFavorited: favoritePostIds.has(postId),
          isAuthor: user?.uid ? postDetailData.authorUid === user.uid : false,
        };

        if (cancelled || !isMountedRef.current) return;
        setPostDetail(nextPostDetail);
        setInitialComments(commentsPage);
      } catch (loadError) {
        console.error('讀取文章詳情失敗:', loadError);
        if (!cancelled && isMountedRef.current) {
          setPostDetail(null);
          setInitialComments({ comments: [], nextCursor: null, hasMore: false });
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

  const closeAndResetComposer = useCallback(() => {
    setTitle('');
    setContent('');
    setOriginalTitle('');
    setOriginalContent('');
    setEditingPostId(null);
    setIsDraftConfirmOpen(false);
    dialogRef.current?.close();
  }, []);

  const handleOpenEdit = useCallback(
    (targetId) => {
      if (!postDetail) return;
      if (targetId) {
        let nextTitle = postDetail.title;
        let nextContent = postDetail.content;

        if (user?.uid) {
          const draft = loadPostComposerDraft({ uid: user.uid, postId: targetId });
          if (draft) {
            nextTitle = draft.title;
            nextContent = draft.content;
            showToast('已恢復草稿');
          }
        }

        setTitle(nextTitle);
        setContent(nextContent);
        setOriginalTitle(postDetail.title);
        setOriginalContent(postDetail.content);
        setEditingPostId(targetId);
      }
      setIsDraftConfirmOpen(false);
      dialogRef.current?.showModal();
    },
    [postDetail, showToast, user],
  );

  const handleRequestComposerClose = useCallback(() => {
    const hasChanges =
      title.trim() !== originalTitle.trim() || content.trim() !== originalContent.trim();

    if (!hasChanges) {
      closeAndResetComposer();
      return;
    }

    setIsDraftConfirmOpen(true);
  }, [closeAndResetComposer, content, originalContent, originalTitle, title]);

  const handleSaveComposerDraft = useCallback(() => {
    if (user?.uid && editingPostId) {
      savePostComposerDraft({
        uid: user.uid,
        postId: editingPostId,
        title,
        content,
      });
    }
    closeAndResetComposer();
  }, [closeAndResetComposer, content, editingPostId, title, user]);

  const handleContinueEditingDraft = useCallback(() => {
    setIsDraftConfirmOpen(false);
  }, []);

  const handleDiscardComposerDraft = useCallback(() => {
    if (user?.uid && editingPostId) {
      removePostComposerDraft({ uid: user.uid, postId: editingPostId });
    }
    closeAndResetComposer();
  }, [closeAndResetComposer, editingPostId, user]);

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
          if (user?.uid) {
            removePostComposerDraft({ uid: user.uid, postId: editingPostId });
          }
          setPostDetail((prev) =>
            prev ? { ...prev, title: title.trim(), content: content.trim() } : prev,
          );
          showToast('更新文章成功');
          closeAndResetComposer();
        }
      } catch (submitError) {
        console.error('Post update error:', submitError);
        showToast('更新文章失敗，請稍後再試', 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [closeAndResetComposer, content, editingPostId, showToast, title, user],
  );

  const handleToggleMenu = useCallback((menuTargetId, event) => {
    event.stopPropagation();
    setOpenMenuPostId((prev) => (prev === menuTargetId ? '' : menuTargetId));
  }, []);

  /** 關閉目前展開的作者操作選單。 */
  const handleCloseMenu = useCallback(() => {
    setOpenMenuPostId('');
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
    if (!postDetail) return;

    if (!user?.uid) {
      showToast('請先登入才能按讚', 'info');
      return;
    }

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
  }, [postDetail, postId, showToast, user]);

  const handleToggleFavoritePost = useCallback(async () => {
    if (!user?.uid || !postDetail) {
      showToast('請先登入才能收藏', 'info');
      return;
    }

    const wasFavorited = !!postDetail.isFavorited;
    setPostDetail((prev) => (prev ? { ...prev, isFavorited: !wasFavorited } : prev));

    try {
      if (wasFavorited) {
        await removeContentFavorite({
          uid: user.uid,
          type: FAVORITE_CONTENT_TYPES.POST,
          targetId: postId,
        });
        showToast('已取消收藏', 'success');
        return;
      }

      await addContentFavorite({
        uid: user.uid,
        type: FAVORITE_CONTENT_TYPES.POST,
        targetId: postId,
      });
      showToast('已加入收藏', 'success');
    } catch (favoriteError) {
      console.error('Toggle post favorite error:', favoriteError);
      setPostDetail((prev) => (prev ? { ...prev, isFavorited: wasFavorited } : prev));
      showToast(
        wasFavorited ? '取消收藏失敗，請稍後再試' : '收藏失敗，請稍後再試',
        'error',
      );
    }
  }, [postDetail, postId, showToast, user]);

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
    isDraftConfirmOpen,
    isLoadingNext,
    openMenuPostId,
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleToggleMenu,
    handleCloseMenu,
    handleOpenEdit,
    handleRequestComposerClose,
    handleSaveComposerDraft,
    handleContinueEditingDraft,
    handleDiscardComposerDraft,
    handleSubmitPost,
    handleDeletePost,
    handleToggleLike,
    handleToggleFavoritePost,
    handleEditComment,
    handleDeleteComment,
    handleSubmitComment,
    handleCommentChange,
  };
}
