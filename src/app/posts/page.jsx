'use client';

import {
  useState, useContext, useEffect, useRef,
} from 'react';
import Link from 'next/link';
import styles from './posts.module.css';
import { AuthContext } from '@/contexts/AuthContext';
import {
  createPost,
  updatePost,
  getLatestPosts,
  getPostDetail,
  toggleLikePost,
  hasUserLikedPosts,
  deletePost,
  getMorePosts,
} from '@/lib/firebase-posts';

/**
 *
 */
export default function PostPage() {
  const [isComposeEditing, setIsComposeEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { user } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const bottomRef = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  useEffect(() => {
    /**
     *
     */
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

  useEffect(() => {
    if (
      !bottomRef.current
      || posts.length === 0
      || !nextCursor
      || isLoadingNext
    ) return;
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
   *
   * @param postId
   */
  function composeButtonHandler(postId) {
    // 按下寫文章按鈕後，跳出編輯頁面
    if (postId && !isComposeEditing) {
      // 要把編輯的原文、標題塞入 title content useState 裡面
      const p = posts.find((x) => x.id === postId);
      // if (!p) return; // 安全檢查
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
   *
   * @param e
   */
  async function handleSubmitPost(e) {
    e.preventDefault();

    if (editingPostId) {
      await updatePost(editingPostId, { title, content }); // 編輯
      setPosts((prev) => prev.map((p) => (p.id === editingPostId ? { ...p, title, content } : p))); // ✅ 只更新那一筆，不新增
    } else {
      const { id } = await createPost({ title, content, user }); // 新增
      const minePost = await getPostDetail(id);
      const hydrated = {
        ...minePost,
        liked: false,
        isAuthor: user?.uid ? minePost.authorUid === user.uid : false,
      }; // 只在新增時撈一次
      setPosts((prev) => [hydrated, ...prev]); // ✅ prepend 只有新增
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTitle('');
    setContent('');
    setIsComposeEditing(false);
    setEditingPostId(null);
  }

  /**
   *
   * @param postId
   */
  async function pressLikeButton(postId) {
    if (!user?.uid) return;
    // 樂觀更新寫這裡
    // 拿著被點讚的那篇postId去取得他的liked 和 likesCount
    // 拿著被點讚的那篇 postId，做不可變的樂觀更新（一次 setPosts）
    setPosts(
      (
        prev, // prev是拿之前的 post useState利用map換成新的[]
      ) => prev.map((p) => {
        if (p.id !== postId) return p;
        const prevLiked = !!p.liked;
        const prevCount = Number(p.likesCount ?? 0);
        const nextLiked = !prevLiked;
        const nextCount = Math.max(0, prevCount + (prevLiked ? -1 : 1));
        return { ...p, liked: nextLiked, likesCount: nextCount };
      }),
    );
    const result = await toggleLikePost(postId, user.uid); // 寫回 Firestore
    // 如果更新成功就不維持狀態，更新失敗則回復原本狀態
    if (result == 'fail') {
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        const prevLiked = !!p.liked;
        const prevCount = Number(p.likesCount ?? 0);
        const nextLiked = !prevLiked;
        const nextCount = Math.max(0, prevCount + (prevLiked ? -1 : 1));
        return { ...p, liked: nextLiked, likesCount: nextCount };
      }));
    }
  }
  /**
   *
   * @param postId
   * @param e
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
   *
   * @param postId
   */
  async function deletePostHandler(postId) {
    if (!confirm('確定要刪除文章？')) return;
    await deletePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (openMenuPostId === postId) setOpenMenuPostId(''); // 關掉菜單
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
                <span className={styles.metaCount}>
                  {post.commentsCount ?? 0}
                </span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {user && (
        <>
          <button
            type="button"
            className={styles.compose}
            onClick={() => composeButtonHandler()}
          >
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
