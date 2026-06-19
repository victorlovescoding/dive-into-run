import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchComments } from '@/runtime/client/use-cases/event-comment-use-cases';

/**
 * Merges comments while preserving existing order and dropping duplicate IDs.
 * @param {import('@/service/event-comment-service').CommentData[]} current - Current comments.
 * @param {import('@/service/event-comment-service').CommentData[]} incoming - Incoming comments.
 * @returns {import('@/service/event-comment-service').CommentData[]} Merged comments.
 */
function appendFreshComments(current, incoming) {
  const seen = new Set(current.map((comment) => comment.id));
  const fresh = incoming.filter((comment) => !seen.has(comment.id));
  return [...current, ...fresh];
}

/**
 * Reconciles a fresh fetch with same-event comments already in local state.
 * @param {import('@/service/event-comment-service').CommentData[]} current - Current comments.
 * @param {import('@/service/event-comment-service').CommentData[]} incoming - Fetched comments.
 * @returns {import('@/service/event-comment-service').CommentData[]} Reconciled comments.
 */
function prependLocalOnlyComments(current, incoming) {
  if (current.length === 0) return incoming;
  const incomingIds = new Set(incoming.map((comment) => comment.id));
  const localOnly = current.filter((comment) => !incomingIds.has(comment.id));
  return [...localOnly, ...incoming];
}

/**
 * @typedef {object} UseCommentsReturn
 * @property {import('@/service/event-comment-service').CommentData[]} comments - 留言列表。
 * @property {(updater: (prev: import('@/service/event-comment-service').CommentData[]) => import('@/service/event-comment-service').CommentData[]) => void} setComments - 更新留言列表。
 * @property {boolean} isLoading - 初始載入中。
 * @property {boolean} isLoadingMore - 載入更多中。
 * @property {boolean} hasMore - 是否還有更多留言。
 * @property {string | null} loadError - 初始載入失敗訊息。
 * @property {() => void} retryLoad - 重試初始載入。
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
    /** @type {import('@/service/event-comment-service').CommentData[]} */ ([]),
  );
  const [cursor, setCursor] = useState(
    /** @type {import('firebase/firestore').DocumentSnapshot | null} */ (null),
  );
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [loadMoreError, setLoadMoreError] = useState(/** @type {string | null} */ (null));

  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isMountedRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const loadMoreInFlightRef = useRef(
    /** @type {{ generation: number, cursor: import('firebase/firestore').DocumentSnapshot } | null} */ (
      null
    ),
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestGenerationRef.current += 1;
      loadMoreInFlightRef.current = null;
    };
  }, []);

  const loadInitialComments = useCallback(async () => {
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    loadMoreInFlightRef.current = null;

    const isCurrentRequest = () =>
      isMountedRef.current && requestGenerationRef.current === requestGeneration;

    setIsLoading(true);
    setIsLoadingMore(false);
    setLoadError(null);

    try {
      const result = await fetchComments(eventId);
      if (!isCurrentRequest()) return;

      setComments((prev) => prependLocalOnlyComments(prev, result.comments));
      setCursor(result.lastDoc);
      setHasMore(result.hasMore === true);
    } catch {
      if (!isCurrentRequest()) return;

      setLoadError('載入留言失敗');
    } finally {
      if (isCurrentRequest()) {
        setIsLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    setComments([]);
    setCursor(null);
    setHasMore(true);
    setIsLoadingMore(false);
    setLoadMoreError(null);
    loadInitialComments();
    return () => {
      requestGenerationRef.current += 1;
      loadMoreInFlightRef.current = null;
    };
  }, [eventId, loadInitialComments]);

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || loadMoreInFlightRef.current) return;
    const requestGeneration = requestGenerationRef.current;
    const requestCursor = cursor;
    loadMoreInFlightRef.current = { generation: requestGeneration, cursor: requestCursor };

    const isCurrentRequest = () =>
      isMountedRef.current &&
      requestGenerationRef.current === requestGeneration &&
      loadMoreInFlightRef.current?.cursor === requestCursor;

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const result = await fetchComments(eventId, { afterDoc: requestCursor, limitCount: 15 });
      if (!isCurrentRequest()) return;

      setComments((prev) => appendFreshComments(prev, result.comments));
      setCursor(result.lastDoc);
      setHasMore(result.hasMore === true);
    } catch {
      if (!isCurrentRequest()) return;

      setLoadMoreError('載入更多失敗');
    } finally {
      if (loadMoreInFlightRef.current?.cursor === requestCursor) {
        loadMoreInFlightRef.current = null;
      }
      if (
        isMountedRef.current &&
        requestGenerationRef.current === requestGeneration
      ) {
        setIsLoadingMore(false);
      }
    }
  }, [eventId, cursor, hasMore]);

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

  const retryLoad = useCallback(() => {
    loadInitialComments();
  }, [loadInitialComments]);

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
    loadError,
    retryLoad,
    loadMoreError,
    retryLoadMore,
    sentinelRef,
  };
}
