'use client';

import { Suspense, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import PostCard from '@/components/PostCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import ComposePrompt from '@/components/ComposePrompt';
import ComposeModal from '@/components/ComposeModal';
import {
  getLatestPosts,
  toggleLikePost,
  hasUserLikedPosts,
  deletePost,
  getMorePosts,
  createPost,
  updatePost,
  getPostDetail,
  validatePostInput,
} from '@/lib/firebase-posts';
import styles from './posts.module.css';

/**
 * 文章列表頁面，含發文、編輯、刪除、按讚與無限滾動。
 * @returns {import('react').JSX.Element} 文章列表頁面。
 */
function PostPageContent() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const dialogRef = useRef(null);
  const bottomRef = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const isLoadingNextRef = useRef(false);

  useEffect(() => {
    /** 載入最新文章列表並查詢按讚狀態。 */
    async function fetchPosts() {
      try {
        const postsData = await getLatestPosts();
        const last = postsData[postsData.length - 1]; // 上一頁最後一筆（snapshot）
        setNextCursor(last);
        const postIds = postsData.map((p) => p.id); // 抽出 id
        if (!user?.uid) {
          // 拿使用者的UID，在posts useState跑迴圈檢查每一篇post.authorUid跟UID是否相同，如果是就新增一個新陣列叫做isAuthor：true，如果不是就false
          setPosts(
            postsData.map((p) => ({
              ...p,
              liked: false,
              isAuthor: false,
            })),
          );
          return;
        }

        // 有使用者才去查自己按過哪些
        const likedSet = await hasUserLikedPosts(user.uid, postIds);
        setPosts(
          postsData.map((p) => ({
            ...p,
            liked: likedSet.has(p.id),
            isAuthor: p.authorUid === user.uid,
          })),
        ); // ✅ 把資料存進 state
      } catch (err) {
        console.error('取得文章失敗:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPosts();
  }, [user?.uid]);

  // 讀取導航帶來的 toast 訊息（例如從詳情頁刪除後跳轉）
  useEffect(() => {
    const toastMsg = searchParams.get('toast');
    if (toastMsg) {
      showToast(toastMsg);
      router.replace('/posts', { scroll: false });
    }
  }, [searchParams, showToast, router]);

  useEffect(() => {
    if (!bottomRef.current || posts.length === 0 || !nextCursor || isLoadingNextRef.current)
      return undefined;
    const intersectionObserver = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0]; // 只觀察一個東西所以取第一筆資料
        if (!entry.isIntersecting || isLoadingNextRef.current) return;
        intersectionObserver.unobserve(entry.target); // 先暫停觀察，避免回呼抖動連觸
        isLoadingNextRef.current = true;
        setIsLoadingNext(true);

        try {
          const morePosts = await getMorePosts(nextCursor); // 拿更多文章（21–40）
          const last = morePosts[morePosts.length - 1]; // 上一頁最後一筆（snapshot）
          setNextCursor(last);
          const postIds = morePosts.map((p) => p.id); // 抽出 id
          if (!user?.uid) {
            const hydrated = morePosts.map((p) => ({
              ...p,
              liked: false,
              isAuthor: false,
            }));
            // 以 id 去重再追加
            setPosts((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              const fresh = hydrated.filter((x) => !seen.has(x.id));
              return [...prev, ...fresh];
            });
            if (morePosts.length < 10) {
              setNextCursor(null);
            }
            return;
          }

          // 有使用者才去查自己按過哪些
          const likedSet = await hasUserLikedPosts(user.uid, postIds);
          const hydrated = morePosts.map((p) => ({
            ...p,
            liked: likedSet.has(p.id),
            isAuthor: p.authorUid === user.uid,
          }));
          setPosts((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            const fresh = hydrated.filter((x) => !seen.has(x.id));
            return [...prev, ...fresh];
          }); // 先去重再併到尾端
          if (morePosts.length < 10) {
            setNextCursor(null); // 明確表示沒有下一頁
          }
        } catch (e) {
          console.error(e);
        } finally {
          isLoadingNextRef.current = false;
          setIsLoadingNext(false);
        }
      },
      {
        root: null,
        threshold: 0,
        rootMargin: '300px 0px', // 想提前一點就打開
      },
    );
    // start observing
    const el = bottomRef.current;
    intersectionObserver.observe(el);
    return () => {
      intersectionObserver.disconnect();
    };
  }, [posts.length, nextCursor, user?.uid]);

  /**
   * 開啟發文或編輯 Modal，帶入對應表單值。
   * @param {string} [postId] - 要編輯的文章 ID，未傳則為新增模式。
   */
  const composeButtonHandler = useCallback(
    (postId) => {
      if (postId) {
        const p = posts.find((x) => x.id === postId);
        if (!p) {
          showToast('文章不存在，無法編輯', 'error');
          return;
        }
        setTitle(p.title);
        setContent(p.content);
        setOriginalTitle(p.title);
        setOriginalContent(p.content);
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
   * 切換文章按讚狀態，搭配樂觀更新。
   * @param {string} postId - 文章 ID。
   */
  const pressLikeButton = useCallback(
    async (postId) => {
      if (!user?.uid) return;
      const target = posts.find((p) => p.id === postId);
      if (!target) return;
      const prevLiked = !!target.liked;
      const prevCount = Number(target.likesCount ?? 0);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            liked: !prevLiked,
            likesCount: Math.max(0, prevCount + (prevLiked ? -1 : 1)),
          };
        }),
      );
      const result = await toggleLikePost(postId, user.uid);
      if (result === 'fail') {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, liked: prevLiked, likesCount: prevCount } : p,
          ),
        );
      }
    },
    [user?.uid, posts],
  );

  /**
   * 切換文章作者操作選單顯示。
   * @param {string} postId - 文章 ID。
   * @param {import('react').MouseEvent} e - 滑鼠點擊事件。
   */
  const toggleOwnerMenu = useCallback(
    (postId, e) => {
      e.stopPropagation();
      if (postId === openMenuPostId) {
        setOpenMenuPostId('');
      } else {
        setOpenMenuPostId(postId);
      }
    },
    [openMenuPostId],
  );

  /**
   * 確認後刪除文章並從列表移除。
   * @param {string} postId - 要刪除的文章 ID。
   */
  const deletePostHandler = useCallback(
    async (postId) => {
      // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
      if (!window.confirm('確定要刪除文章？')) return;
      try {
        await deletePost(postId);
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        if (openMenuPostId === postId) setOpenMenuPostId('');
        showToast('文章已刪除');
      } catch (err) {
        console.error('Delete post error:', err);
        showToast('刪除文章失敗，請稍後再試', 'error');
      }
    },
    [openMenuPostId, showToast],
  );

  /**
   * 送出發文或編輯表單，成功後關閉 Modal 並更新列表。
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
        setIsSubmitting(true);
        if (editingPostId) {
          await updatePost(editingPostId, { title, content });
          setPosts((prev) =>
            prev.map((p) => (p.id === editingPostId ? { ...p, title, content } : p)),
          );
          showToast('更新文章成功');
        } else {
          const { id } = await createPost({ title, content, user });
          const minePost = await getPostDetail(id);
          const hydrated = {
            ...minePost,
            liked: false,
            isAuthor: user?.uid ? minePost.authorUid === user.uid : false,
          };
          setPosts((prev) => [hydrated, ...prev]);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          showToast('發佈文章成功');
        }
      } catch (err) {
        console.error('Post submit error:', err);
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
    [title, content, editingPostId, user, showToast],
  );

  /**
   * 渲染文章列表，無文章時顯示空狀態提示。
   * @returns {import('react').ReactNode} 文章列表或空狀態。
   */
  function renderPostList() {
    if (isLoading) {
      return <PostCardSkeleton count={3} />;
    }
    if (posts.length === 0) {
      return <p className={styles.emptyState}>還沒有文章，成為第一個分享的人吧！</p>;
    }
    return posts.map((post) => (
      <PostCard
        key={post.id}
        post={post}
        openMenuPostId={openMenuPostId}
        onToggleMenu={toggleOwnerMenu}
        onEdit={composeButtonHandler}
        onDelete={deletePostHandler}
        onLike={pressLikeButton}
      />
    ));
  }

  return (
    <div className={styles.feed}>
      <h1 className={styles.feedTitle}>文章河道</h1>
      {user && <ComposePrompt userPhotoURL={user.photoURL} onClick={composeButtonHandler} />}
      {renderPostList()}
      {isLoadingNext && <PostCardSkeleton count={1} />}
      <div ref={bottomRef} className={styles.scrollSentinel} />
      <ComposeModal
        dialogRef={dialogRef}
        title={title}
        content={content}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onSubmit={handleSubmitPost}
        isEditing={!!editingPostId}
        originalTitle={originalTitle}
        originalContent={originalContent}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

/**
 * 貼文主頁面（包含 Suspense boundary 以支援 useSearchParams）。
 * @returns {import('react').ReactElement} 頁面組件。
 */
export default function PostPage() {
  return (
    <Suspense>
      <PostPageContent />
    </Suspense>
  );
}
