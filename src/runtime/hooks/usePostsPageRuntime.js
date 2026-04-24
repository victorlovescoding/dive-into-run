'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createPost,
  deletePost,
  getLatestPosts,
  getMorePosts,
  getPostDetail,
  hasUserLikedPosts,
  toggleLikePost,
  updatePost,
  validatePostInput,
} from '@/runtime/client/use-cases/post-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';

const PAGE_SIZE = 10;
const OBSERVER_MARGIN = '300px 0px';

/**
 * 為 post list 補上當前使用者視角的 UI flags。
 * @param {Array<object>} postItems - 原始文章資料。
 * @param {string | null | undefined} userUid - 當前使用者 UID。
 * @param {Set<string>} [likedPostIds] - 已按讚文章 ID 集合。
 * @returns {Array<object>} 帶 liked / isAuthor 的文章。
 */
function hydratePosts(postItems, userUid, likedPostIds = new Set()) {
  return (Array.isArray(postItems) ? postItems : []).map((postItem) => ({
    ...postItem,
    liked: likedPostIds.has(postItem.id),
    isAuthor: postItem.authorUid === userUid,
  }));
}

/**
 * 以 id 去重後把新文章接到列表尾端。
 * @param {Array<object>} previousPosts - 既有文章。
 * @param {Array<object>} nextPosts - 待追加文章。
 * @returns {Array<object>} 合併後文章。
 */
function mergeUniquePosts(previousPosts, nextPosts) {
  const seenIds = new Set(previousPosts.map((postItem) => postItem.id));
  const freshPosts = nextPosts.filter((postItem) => !seenIds.has(postItem.id));
  return [...previousPosts, ...freshPosts];
}

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

  useEffect(() => {
    let cancelled = false;

    /** 載入第一頁文章與按讚狀態。 */
    async function loadPosts() {
      if (!cancelled) {
        setIsLoading(true);
      }

      try {
        const latestPosts = await getLatestPosts();
        if (cancelled) return;

        const likedPostIds =
          userUid && latestPosts.length > 0
            ? await hasUserLikedPosts(
                userUid,
                latestPosts.map((postItem) => postItem.id),
              )
            : new Set();

        if (cancelled) return;

        setPosts(hydratePosts(latestPosts, userUid, likedPostIds));
        setNextCursor(latestPosts[latestPosts.length - 1] ?? null);
      } catch (error) {
        console.error('取得文章失敗:', error);
        if (!cancelled) {
          setPosts([]);
          setNextCursor(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
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
          const morePosts = await getMorePosts(nextCursor);
          const likedPostIds =
            userUid && morePosts.length > 0
              ? await hasUserLikedPosts(
                  userUid,
                  morePosts.map((postItem) => postItem.id),
                )
              : new Set();
          const hydratedPosts = hydratePosts(morePosts, userUid, likedPostIds);

          setPosts((previousPosts) => mergeUniquePosts(previousPosts, hydratedPosts));
          setNextCursor(
            morePosts.length < PAGE_SIZE ? null : (morePosts[morePosts.length - 1] ?? null),
          );
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
      if (postId) {
        const targetPost = posts.find((postItem) => postItem.id === postId);
        if (!targetPost) {
          showToast('文章不存在，無法編輯', 'error');
          return;
        }

        setTitle(targetPost.title);
        setContent(targetPost.content);
        setOriginalTitle(targetPost.title);
        setOriginalContent(targetPost.content);
        setEditingPostId(postId);
      } else {
        setTitle('');
        setContent('');
        setOriginalTitle('');
        setOriginalContent('');
        setEditingPostId(null);
      }

      setOpenMenuPostId('');
      dialogRef.current?.showModal();
    },
    [posts, showToast],
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

      setPosts((previousPosts) =>
        previousPosts.map((postItem) =>
          postItem.id === postId
            ? {
                ...postItem,
                liked: !previousLiked,
                likesCount: Math.max(0, previousCount + (previousLiked ? -1 : 1)),
              }
            : postItem,
        ),
      );

      const result = await toggleLikePost(postId, userUid);
      if (result !== 'fail') return;

      setPosts((previousPosts) =>
        previousPosts.map((postItem) =>
          postItem.id === postId
            ? { ...postItem, liked: previousLiked, likesCount: previousCount }
            : postItem,
        ),
      );
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
        setPosts((previousPosts) => previousPosts.filter((postItem) => postItem.id !== postId));
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
          setPosts((previousPosts) =>
            previousPosts.map((postItem) =>
              postItem.id === editingPostId
                ? { ...postItem, title: title.trim(), content: content.trim() }
                : postItem,
            ),
          );
          showToast('更新文章成功');
        } else {
          if (!user) return;

          const { id } = await createPost({ title, content, user });
          const createdPost = await getPostDetail(id);
          if (!createdPost) {
            throw new Error('created post not found');
          }

          const [hydratedPost] = hydratePosts([createdPost], user.uid ?? null);
          setPosts((previousPosts) => [hydratedPost, ...previousPosts]);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          showToast('發佈文章成功');
        }
      } catch (error) {
        console.error('Post submit error:', error);
        showToast(editingPostId ? '更新文章失敗，請稍後再試' : '發佈文章失敗，請稍後再試', 'error');
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
    [content, editingPostId, showToast, title, user],
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
