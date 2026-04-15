'use client';

import { useState, useContext, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './posts.module.css';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  createPost,
  updatePost,
  getLatestPosts,
  getPostDetail,
  toggleLikePost,
  hasUserLikedPosts,
  deletePost,
  getMorePosts,
  validatePostInput,
} from '@/lib/firebase-posts';

/**
 * 文章列表頁面，含發文、編輯、刪除、按讚與無限滾動。
 * @returns {import('react').JSX.Element} 文章列表頁面。
 */
export default function PostPage() {
  const [isComposeEditing, setIsComposeEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const bottomRef = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

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
    if (!bottomRef.current || posts.length === 0 || !nextCursor || isLoadingNext) return undefined;
    const intersectionObserver = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0]; // 只觀察一個東西所以取第一筆資料
        if (!entry.isIntersecting || isLoadingNext) return; // 代表 目標元素有沒有「進到」觀測區域（root；你這裡是視窗 + rootMargin）。
        intersectionObserver.unobserve(entry.target); // 先暫停觀察，避免回呼抖動連觸
        setIsLoadingNext(true);
        let shouldReobserve = true; // 👈 本輪旗標

        try {
          const morePosts = await getMorePosts(nextCursor); // 拿更多文章（21–40）
          const last = morePosts[morePosts.length - 1]; // 上一頁最後一筆（snapshot）
          setNextCursor(last);
          const postIds = morePosts.map((p) => p.id); // 抽出 id
          if (!user?.uid) {
            const hydrated = morePosts.map((p) => ({
              ...p,
              liked: false,
            }));
            // 以 id 去重再追加
            setPosts((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              const fresh = hydrated.filter((x) => !seen.has(x.id));
              return [...prev, ...fresh];
            });
            if (morePosts.length < 10) {
              setNextCursor(null);
              shouldReobserve = false;
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
            shouldReobserve = false; // 👈 關鍵：這一輪就別重掛了
            // 跳到 finally
          }
        } catch (e) {
          console.error(e);
          // 失敗時可選擇繼續重掛（保持 shouldReobserve 為 true）
        } finally {
          setIsLoadingNext(false);
          if (shouldReobserve && bottomRef.current) {
            intersectionObserver.observe(entry.target);
          } else {
            intersectionObserver.disconnect(); // 末頁或無游標就收尾
          }
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
  }, [posts.length, nextCursor, user?.uid, isLoadingNext]);

  /**
   * 切換文章編輯/新增模式。
   * @param {string} [postId] - 要編輯的文章 ID，未傳則為新增模式。
   */
  function composeButtonHandler(postId) {
    // 按下寫文章按鈕後，跳出編輯頁面
    if (postId && !isComposeEditing) {
      // 要把編輯的原文、標題塞入 title content useState 裡面
      const p = posts.find((x) => x.id === postId);
      if (!p) {
        showToast('文章不存在，無法編輯', 'error');
        return;
      }
      setTitle(p.title);
      setContent(p.content);
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
   * 送出新文章或更新既有文章。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單送出事件。
   */
  async function handleSubmitPost(e) {
    e.preventDefault();

    const validationError = validatePostInput({ title, content });
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    try {
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
    }

    setTitle('');
    setContent('');
    setIsComposeEditing(false);
    setEditingPostId(null);
  }

  /**
   * 切換文章按讚狀態，搭配樂觀更新。
   * @param {string} postId - 文章 ID。
   */
  async function pressLikeButton(postId) {
    if (!user?.uid) return;
    const target = posts.find((p) => p.id === postId);
    if (!target) return;
    const prevLiked = !!target.liked;
    const prevCount = Number(target.likesCount ?? 0);
    // 樂觀更新
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
        prev.map((p) => (p.id === postId ? { ...p, liked: prevLiked, likesCount: prevCount } : p)),
      );
    }
  }
  /**
   * 切換文章作者操作選單顯示。
   * @param {string} postId - 文章 ID。
   * @param {import('react').MouseEvent} e - 滑鼠點擊事件。
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
   * 確認後刪除文章並從列表移除。
   * @param {string} postId - 要刪除的文章 ID。
   */
  async function deletePostHandler(postId) {
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
  }

  return (
    <div>
      <h1>文章河道</h1>
      <ul className={styles.postsContainer}>
        {posts.map((post) => (
          <li className={styles.postContainer} key={post.id}>
            <div
              className={styles.postOwnerMenu}
              style={{ display: post?.isAuthor ? 'block' : 'none' }}
            >
              <button
                id={`post-owner-menu-btn-${post.id}`}
                type="button"
                className={styles.postOwnerMenuButton}
                aria-label="更多選項"
                aria-haspopup="menu"
                aria-expanded={openMenuPostId === post.id ? 'true' : 'false'}
                aria-controls={`post-owner-menu-${post.id}`}
                onClick={(e) => toggleOwnerMenu(post.id, e)}
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
                id={`post-owner-menu-${post.id}`}
                className={styles.postOwnerMenuList}
                role="menu"
                aria-labelledby={`post-owner-menu-btn-${post.id}`}
                hidden={post.id !== openMenuPostId}
              >
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.postOwnerMenuItem}
                    onClick={() => composeButtonHandler(post.id)}
                  >
                    編輯
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.postOwnerMenuItem}
                    onClick={() => deletePostHandler(post.id)}
                  >
                    刪除
                  </button>
                </li>
              </ul>
            </div>
            <Link href={`/posts/${post.id}`}>
              <strong>{post.title}</strong>
              <p>{post.content}</p>
            </Link>
            <div>
              <button
                type="button"
                onClick={() => pressLikeButton(post.id)}
                className={styles.metaButton}
              >
                <svg
                  width="16"
                  height="16"
                  fill={post.liked ? 'currentColor' : 'none'}
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
                <span className={styles.metaCount}>{post.likesCount ?? 0}</span>
              </button>
              <Link href={`/posts/${post.id}`} className={styles.metaButton}>
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
                <span className={styles.metaCount}>{post.commentsCount ?? 0}</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {user && (
        <>
          <button type="button" className={styles.compose} onClick={() => composeButtonHandler()}>
            ➕
          </button>
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
        </>
      )}
      <div ref={bottomRef} className={styles.scrollerFooter}>
        我是底部
      </div>
    </div>
  );
}
