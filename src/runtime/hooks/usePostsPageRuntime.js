/* eslint-disable max-lines -- Posts feed runtime owns feed and composer orchestration. */
'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createPost,
  deletePost,
  fetchPostHistory,
  getPostDetail,
  toggleLikePost,
  updatePost,
  validatePostInput,
} from '@/runtime/client/use-cases/post-use-cases';
import {
  FAVORITE_CONTENT_TYPES,
  addContentFavorite,
  removeContentFavorite,
} from '@/runtime/client/use-cases/content-favorite-use-cases';
import {
  applyPostFavoriteState,
  applyPostLikeState,
  createComposerDraft,
  hydratePosts,
  loadInitialPosts,
  loadMorePostsPage,
  mergeUniquePosts,
  prependPost,
  removePostById,
  replaceEditedPost,
} from '@/runtime/hooks/usePostsPageRuntimeHelpers';
import {
  loadPostComposerDraft,
  removePostComposerDraft,
  savePostComposerDraft,
} from '@/repo/client/post-composer-draft-storage-repo';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import useEditHistoryModal from '@/runtime/hooks/useEditHistoryModal';

const PAGE_SIZE = 10;
const OBSERVER_MARGIN = '300px 0px';

/**
 * posts list 頁 runtime orchestration。
 * @returns {object} posts 頁面 state 與 handlers。
 */
export default function usePostsPageRuntime() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
  const [reportDialogTarget, setReportDialogTarget] = useState(null);

  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isLoadingNextRef = useRef(false);

  const userUid = user?.uid ?? null;
  const loadArticleHistory = useCallback((targetPost) => fetchPostHistory(targetPost.id), []);
  const {
    historyTarget: articleHistoryPost,
    historyEntries: articleHistoryEntries,
    historyError: articleHistoryError,
    isHistoryOpen: isArticleHistoryOpen,
    handleViewHistory: handleViewArticleHistory,
    handleCloseHistory: handleCloseArticleHistory,
  } = useEditHistoryModal({
    loadHistory: loadArticleHistory,
    loadErrorMessage: '載入編輯記錄失敗',
  });

  /**
   * 套用新增/編輯表單 draft。
   * @param {{ title: string, content: string, originalTitle: string, originalContent: string, editingPostId: string | null }} draft - 表單 draft。
   */
  const applyComposerDraft = useCallback((draft) => {
    setTitle(draft.title);
    setContent(draft.content);
    setOriginalTitle(draft.originalTitle);
    setOriginalContent(draft.originalContent);
    setEditingPostId(draft.editingPostId);
  }, []);

  /** 關閉 composer 並清空目前表單狀態。 */
  const closeAndResetComposer = useCallback(() => {
    applyComposerDraft(createComposerDraft(null));
    setIsDraftConfirmOpen(false);
    dialogRef.current?.close();
  }, [applyComposerDraft]);

  /**
   * 取得目前 composer local draft target。
   * @returns {{ uid: string | null, postId: string | null }} Draft target。
   */
  const getCurrentComposerDraftTarget = useCallback(
    () => ({
      uid: userUid,
      postId: editingPostId ?? null,
    }),
    [editingPostId, userUid],
  );

  useEffect(() => {
    let cancelled = false;

    /** 載入第一頁文章與按讚狀態。 */
    async function loadPosts() {
      if (!cancelled) setIsLoading(true);
      try {
        const { posts: hydratedPosts, nextCursor: initialCursor } = await loadInitialPosts(userUid);
        if (cancelled) return;
        setPosts(hydratedPosts);
        setNextCursor(initialCursor);
      } catch (error) {
        console.error('取得文章失敗:', error);
        if (!cancelled) {
          setPosts([]);
          setNextCursor(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, [userUid]);

  useEffect(() => {
    const toastMessage = searchParams.get('toast');
    if (!toastMessage) return;
    showToast(toastMessage);
    router.replace('/posts', { scroll: false });
  }, [router, searchParams, showToast]);

  useEffect(() => {
    if (
      !bottomRef.current ||
      posts.length === 0 ||
      !nextCursor ||
      isLoadingNextRef.current ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || isLoadingNextRef.current) return;

        observer.unobserve(entry.target);
        isLoadingNextRef.current = true;
        setIsLoadingNext(true);

        try {
          const nextPage = await loadMorePostsPage({ nextCursor, userUid, pageSize: PAGE_SIZE });
          setPosts((previousPosts) => mergeUniquePosts(previousPosts, nextPage.posts));
          setNextCursor(nextPage.nextCursor);
        } catch (error) {
          console.error(error);
        } finally {
          isLoadingNextRef.current = false;
          setIsLoadingNext(false);
        }
      },
      { root: null, threshold: 0, rootMargin: OBSERVER_MARGIN },
    );

    const sentinel = bottomRef.current;
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [nextCursor, posts.length, userUid]);

  /**
   * 開啟新增/編輯 modal。
   * @param {string} [postId] - 編輯目標文章 ID。
   */
  const handleComposeButton = useCallback(
    (postId) => {
      const targetPost = postId ? posts.find((postItem) => postItem.id === postId) : null;
      if (postId && !targetPost) {
        showToast('文章不存在，無法編輯', 'error');
        return;
      }

      const baseDraft = createComposerDraft(targetPost);
      const savedDraft = userUid
        ? loadPostComposerDraft({ uid: userUid, postId: targetPost?.id ?? null })
        : null;
      const nextDraft = savedDraft
        ? {
            ...baseDraft,
            title: savedDraft.title,
            content: savedDraft.content,
          }
        : baseDraft;

      applyComposerDraft(nextDraft);
      if (savedDraft) {
        showToast('已恢復草稿');
      }
      setIsDraftConfirmOpen(false);
      setOpenMenuPostId('');
      dialogRef.current?.showModal();
    },
    [applyComposerDraft, posts, showToast, userUid],
  );

  /** 使用者要求關閉 composer 時，依 dirty 狀態決定關閉或顯示草稿確認。 */
  const handleRequestComposerClose = useCallback(() => {
    const hasUnsavedCreateContent =
      !editingPostId && (title.trim() !== '' || content.trim() !== '');
    const hasUnsavedEditContent =
      !!editingPostId &&
      (title.trim() !== originalTitle.trim() || content.trim() !== originalContent.trim());

    if (!hasUnsavedCreateContent && !hasUnsavedEditContent) {
      closeAndResetComposer();
      return;
    }

    setIsDraftConfirmOpen(true);
  }, [
    closeAndResetComposer,
    content,
    editingPostId,
    originalContent,
    originalTitle,
    title,
  ]);

  /** 儲存目前 composer 內容為 local draft，並關閉 composer。 */
  const handleSaveComposerDraft = useCallback(() => {
    const target = getCurrentComposerDraftTarget();
    savePostComposerDraft({
      ...target,
      title,
      content,
    });
    closeAndResetComposer();
  }, [closeAndResetComposer, content, getCurrentComposerDraftTarget, title]);

  /** 關閉草稿確認並回到 composer。 */
  const handleContinueEditingDraft = useCallback(() => {
    setIsDraftConfirmOpen(false);
  }, []);

  /** 移除目前 composer target 的 local draft，並關閉 composer。 */
  const handleDiscardComposerDraft = useCallback(() => {
    removePostComposerDraft(getCurrentComposerDraftTarget());
    closeAndResetComposer();
  }, [closeAndResetComposer, getCurrentComposerDraftTarget]);

  /**
   * 切換文章按讚，失敗時 rollback。
   * @param {string} postId - 文章 ID。
   */
  const handlePressLike = useCallback(
    async (postId) => {
      const targetPost = posts.find((postItem) => postItem.id === postId);
      if (!targetPost) return;

      if (!userUid) {
        showToast('請先登入才能按讚', 'info');
        return;
      }

      const previousLiked = !!targetPost.liked;
      const previousCount = Number(targetPost.likesCount ?? 0);
      const nextCount = Math.max(0, previousCount + (previousLiked ? -1 : 1));

      setPosts((previousPosts) => applyPostLikeState(previousPosts, postId, !previousLiked, nextCount));

      const result = await toggleLikePost(postId, userUid);
      if (result !== 'fail') return;

      setPosts((previousPosts) => applyPostLikeState(previousPosts, postId, previousLiked, previousCount));
    },
    [posts, showToast, userUid],
  );

  /**
   * 切換文章收藏，失敗時 rollback。
   * @param {string} postId - 文章 ID。
   */
  const handleToggleFavoritePost = useCallback(
    async (postId) => {
      if (!userUid) {
        showToast('請先登入才能收藏', 'info');
        return;
      }

      const targetPost = posts.find((postItem) => postItem.id === postId);
      if (!targetPost) return;

      const wasFavorited = !!targetPost.isFavorited;
      setPosts((previousPosts) => applyPostFavoriteState(previousPosts, postId, !wasFavorited));

      try {
        if (wasFavorited) {
          await removeContentFavorite({
            uid: userUid,
            type: FAVORITE_CONTENT_TYPES.POST,
            targetId: postId,
          });
          showToast('已取消收藏', 'success');
          return;
        }

        await addContentFavorite({
          uid: userUid,
          type: FAVORITE_CONTENT_TYPES.POST,
          targetId: postId,
        });
        showToast('已加入收藏', 'success');
      } catch (error) {
        console.error('Toggle favorite post error:', error);
        setPosts((previousPosts) => applyPostFavoriteState(previousPosts, postId, wasFavorited));
        showToast(
          wasFavorited ? '取消收藏失敗，請稍後再試' : '收藏失敗，請稍後再試',
          'error',
        );
      }
    },
    [posts, showToast, userUid],
  );

  /**
   * 切換作者操作選單。
   * @param {string} postId - 文章 ID。
   * @param {import('react').MouseEvent} event - click event。
   */
  const handleToggleOwnerMenu = useCallback((postId, event) => {
    event.stopPropagation();
    setOpenMenuPostId((currentPostId) => (currentPostId === postId ? '' : postId));
  }, []);

  /** 關閉目前展開的作者操作選單。 */
  const handleCloseOwnerMenu = useCallback(() => {
    setOpenMenuPostId('');
  }, []);

  /**
   * 開啟檢舉對話框。
   * @param {object} target - Report target descriptor.
   */
  const handleOpenReportDialog = useCallback((target) => {
    setOpenMenuPostId('');
    setReportDialogTarget(target);
  }, []);

  /** 關閉檢舉對話框。 */
  const handleCloseReportDialog = useCallback(() => {
    setReportDialogTarget(null);
  }, []);

  /**
   * 顯示檢舉送出結果。
   * @param {{ ok: boolean, message: string }} result - Submit result.
   */
  const handleReportResult = useCallback(
    (result) => {
      showToast(result.message, result.ok ? 'success' : 'error');
      if (result.ok) {
        setReportDialogTarget(null);
      }
    },
    [showToast],
  );

  /**
   * 刪除文章。
   * @param {string} postId - 文章 ID。
   */
  const handleDeletePost = useCallback(
    async (postId) => {
      // eslint-disable-next-line no-alert -- 保留既有原生刪除確認流程
      if (!window.confirm('確定要刪除文章？')) return;

      try {
        await deletePost(postId);
        setPosts((previousPosts) => removePostById(previousPosts, postId));
        if (openMenuPostId === postId) {
          setOpenMenuPostId('');
        }
        showToast('文章已刪除');
      } catch (error) {
        console.error('Delete post error:', error);
        showToast('刪除文章失敗，請稍後再試', 'error');
      }
    },
    [openMenuPostId, showToast],
  );

  /**
   * 送出新增/編輯文章。
   * @param {import('react').FormEvent<HTMLFormElement>} event - form submit event。
   */
  const handleSubmitPost = useCallback(
    async (event) => {
      event.preventDefault();

      const validationError = validatePostInput({ title, content });
      if (validationError) {
        showToast(validationError, 'error');
        return;
      }

      const draftTarget = getCurrentComposerDraftTarget();

      try {
        setIsSubmitting(true);

        if (editingPostId) {
          await updatePost(editingPostId, { title, content });
          removePostComposerDraft(draftTarget);
          setPosts((previousPosts) =>
            replaceEditedPost(previousPosts, editingPostId, title, content).map((postItem) =>
              postItem.id === editingPostId ? { ...postItem, isEdited: true } : postItem,
            ),
          );
          showToast('更新文章成功');
          closeAndResetComposer();
          return;
        } else {
          if (!user) return;

          const { id } = await createPost({ title, content, user });
          const createdPost = await getPostDetail(id);
          if (!createdPost) {
            throw new Error('created post not found');
          }

          const [hydratedPost] = hydratePosts([createdPost], user.uid ?? null);
          removePostComposerDraft(draftTarget);
          setPosts((previousPosts) => prependPost(previousPosts, hydratedPost));
          window.scrollTo({ top: 0, behavior: 'smooth' });
          showToast('發佈文章成功');
          closeAndResetComposer();
        }
      } catch (error) {
        console.error('Post submit error:', error);
        showToast(editingPostId ? '更新文章失敗，請稍後再試' : '發佈文章失敗，請稍後再試', 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      closeAndResetComposer,
      content,
      editingPostId,
      getCurrentComposerDraftTarget,
      showToast,
      title,
      user,
    ],
  );

  return {
    user,
    title,
    content,
    originalTitle,
    originalContent,
    isSubmitting,
    editingPostId,
    isLoading,
    posts,
    openMenuPostId,
    isLoadingNext,
    isDraftConfirmOpen,
    reportDialogTarget,
    articleHistoryPost,
    articleHistoryEntries,
    articleHistoryError,
    isArticleHistoryOpen,
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleComposeButton,
    handlePressLike,
    handleToggleFavoritePost,
    handleToggleOwnerMenu,
    handleCloseOwnerMenu,
    handleOpenReportDialog,
    handleCloseReportDialog,
    handleReportResult,
    handleDeletePost,
    handleSubmitPost,
    handleViewArticleHistory,
    handleCloseArticleHistory,
    handleRequestComposerClose,
    handleSaveComposerDraft,
    handleContinueEditingDraft,
    handleDiscardComposerDraft,
  };
}
