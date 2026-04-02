import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchComments } from '@/lib/firebase-comments';

/**
 * @typedef {object} UseCommentsReturn
 * @property {import('@/lib/firebase-comments').CommentData[]} comments - 留言列表。
 * @property {(updater: (prev: import('@/lib/firebase-comments').CommentData[]) => import('@/lib/firebase-comments').CommentData[]) => void} setComments - 更新留言列表。
 * @property {boolean} isLoading - 初始載入中。
 * @property {boolean} isLoadingMore - 載入更多中。
 * @property {boolean} hasMore - 是否還有更多留言。
 * @property {string | null} loadMoreError - 載入更多失敗訊息。
 * @property {() => void} retryLoadMore - 重試載入更多。
 * @property {import('react').RefObject<HTMLDivElement | null>} sentinelRef - IntersectionObserver 哨兵 ref。
 */

/**
 * 管理留言列表的 fetch、分頁與 infinite scroll。
 * @param {string} eventId - 活動 ID。
 * @returns {UseCommentsReturn} 留言狀態與操作。
 */
export default function useComments(eventId) {
  const [comments, setComments] = useState(
    /** @type {import('@/lib/firebase-comments').CommentData[]} */ ([]),
  );
  const [cursor, setCursor] = useState(
    /** @type {import('firebase/firestore').DocumentSnapshot | null} */ (null),
  );
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(/** @type {string | null} */ (null));

  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // --- Initial fetch ---
  useEffect(() => {
    let cancelled = false;
    /**
     * 載入初始留言。
     */
    async function load() {
      setIsLoading(true);
      try {
        const result = await fetchComments(eventId);
        if (!cancelled) {
          setComments(result.comments);
          setCursor(result.lastDoc);
          setHasMore(result.lastDoc !== null);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // --- Load more (infinite scroll) ---
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !cursor) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await fetchComments(eventId, { afterDoc: cursor, limitCount: 15 });
      setComments((prev) => [...prev, ...result.comments]);
      setCursor(result.lastDoc);
      setHasMore(result.lastDoc !== null);
    } catch {
      setLoadMoreError('載入更多失敗');
    } finally {
      setIsLoadingMore(false);
    }
  }, [eventId, cursor, isLoadingMore]);

  // --- IntersectionObserver sentinel ---
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '0px 0px 300px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  /**
   * 重試載入更多。
   */
  const retryLoadMore = useCallback(() => {
    setLoadMoreError(null);
    loadMore();
  }, [loadMore]);

  return {
    comments,
    setComments,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreError,
    retryLoadMore,
    sentinelRef,
  };
}
