'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createPost,
  deletePost,
  getPostDetail,
  toggleLikePost,
  updatePost,
  validatePostInput,
} from '@/runtime/client/use-cases/post-use-cases';
import {
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
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';

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

  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isLoadingNextRef = useRef(false);

  const userUid = user?.uid ?? null;

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
      applyComposerDraft(createComposerDraft(targetPost));
      setOpenMenuPostId('');
      dialogRef.current?.showModal();
    },
    [applyComposerDraft, posts, showToast],
  );

  /**
   * 切換文章按讚，失敗時 rollback。
   * @param {string} postId - 文章 ID。
   */
  const handlePressLike = useCallback(
    async (postId) => {
      if (!userUid) return;

      const targetPost = posts.find((postItem) => postItem.id === postId);
      if (!targetPost) return;

      const previousLiked = !!targetPost.liked;
      const previousCount = Number(targetPost.likesCount ?? 0);
      const nextCount = Math.max(0, previousCount + (previousLiked ? -1 : 1));

      setPosts((previousPosts) => applyPostLikeState(previousPosts, postId, !previousLiked, nextCount));

      const result = await toggleLikePost(postId, userUid);
      if (result !== 'fail') return;

      setPosts((previousPosts) => applyPostLikeState(previousPosts, postId, previousLiked, previousCount));
    },
    [posts, userUid],
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

      try {
        setIsSubmitting(true);

        if (editingPostId) {
          await updatePost(editingPostId, { title, content });
          setPosts((previousPosts) => replaceEditedPost(previousPosts, editingPostId, title, content));
          showToast('更新文章成功');
        } else {
          if (!user) return;

          const { id } = await createPost({ title, content, user });
          const createdPost = await getPostDetail(id);
          if (!createdPost) {
            throw new Error('created post not found');
          }

          const [hydratedPost] = hydratePosts([createdPost], user.uid ?? null);
          setPosts((previousPosts) => prependPost(previousPosts, hydratedPost));
          window.scrollTo({ top: 0, behavior: 'smooth' });
          showToast('發佈文章成功');
        }
      } catch (error) {
        console.error('Post submit error:', error);
        showToast(editingPostId ? '更新文章失敗，請稍後再試' : '發佈文章失敗，請稍後再試', 'error');
      } finally {
        setIsSubmitting(false);
      }

      applyComposerDraft(createComposerDraft(null));
      dialogRef.current?.close();
    },
    [applyComposerDraft, content, editingPostId, showToast, title, user],
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
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleComposeButton,
    handlePressLike,
    handleToggleOwnerMenu,
    handleDeletePost,
    handleSubmitPost,
  };
}
