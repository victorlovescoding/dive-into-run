import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @typedef {object} FetchResult
 * @property {object[]} items - 回傳的資料項目。
 * @property {number | null} [nextCursor] - offset-based cursor（用於 fetchMyEvents）。
 * @property {import('firebase/firestore').QueryDocumentSnapshot | null} [lastDoc] - Firestore document cursor（用於 fetchMyPosts / fetchMyComments）。
 */

/**
 * @typedef {object} UseDashboardTabReturn
 * @property {object[]} items - 目前載入的項目。
 * @property {boolean} isLoading - 初始載入中。
 * @property {boolean} isLoadingMore - 載入更多中。
 * @property {boolean} hasMore - 是否還有更多。
 * @property {string | null} error - 初始載入錯誤訊息。
 * @property {() => void} retry - 重試初始載入。
 * @property {string | null} loadMoreError - 載入更多錯誤訊息。
 * @property {() => void} retryLoadMore - 重試載入更多。
 * @property {import('react').RefObject<HTMLDivElement | null>} sentinelRef - 哨兵 ref。
 * @property {FetchResult | null} prevResult - 上一次 fetch 的完整結果（含 service layer 額外欄位）。
 */

/**
 * 管理單一 dashboard tab 的分頁資料。
 * @param {string | null} uid - 使用者 ID。
 * @param {(uid: string, options: object) => Promise<FetchResult>} fetchFn - 服務層 fetch 函式。
 * @param {number} pageSize - 每頁筆數。
 * @param {boolean} isActive - 此 tab 是否 active。
 * @returns {UseDashboardTabReturn} tab 狀態與操作。
 */
export default function useDashboardTab(uid, fetchFn, pageSize, isActive) {
  const [items, setItems] = useState(/** @type {object[]} */ ([]));
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [loadMoreError, setLoadMoreError] = useState(/** @type {string | null} */ (null));

  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const initializedRef = useRef(false);
  const prevResultRef = useRef(/** @type {FetchResult | null} */ (null));
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    if (!uid || !isActive || initializedRef.current) return undefined;

    let cancelled = false;

    /** 執行初始載入。 */
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchFn(uid, { prevResult: null, pageSize });
        if (cancelled) return;
        initializedRef.current = true;
        setItems(result.items);
        prevResultRef.current = result;
        setHasMore(result.items.length >= pageSize);
      } catch (err) {
        if (cancelled) return;
        console.error('[DashboardTab] initial load failed:', err);
        setError('載入失敗');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [uid, isActive, fetchFn, pageSize]);

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore || !uid) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await fetchFn(uid, {
        prevResult: prevResultRef.current,
        pageSize,
      });
      setItems((prev) => [...prev, ...result.items]);
      prevResultRef.current = result;
      setHasMore(result.items.length >= pageSize);
    } catch (err) {
      console.error('[DashboardTab] load more failed:', err);
      setLoadMoreError('載入更多失敗');
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [uid, hasMore, fetchFn, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !isActive || !hasMore || isLoadingMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '0px 0px 300px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isActive, hasMore, isLoadingMore, loadMore]);

  const retry = useCallback(() => {
    if (!uid) return;
    setError(null);
    setIsLoading(true);
    fetchFn(uid, { prevResult: null, pageSize })
      .then((/** @type {FetchResult} */ result) => {
        initializedRef.current = true;
        setItems(result.items);
        prevResultRef.current = result;
        setHasMore(result.items.length >= pageSize);
      })
      .catch((err) => {
        console.error('[DashboardTab] retry failed:', err);
        setError('載入失敗');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [uid, fetchFn, pageSize]);

  const retryLoadMore = useCallback(() => {
    setLoadMoreError(null);
    loadMore();
  }, [loadMore]);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    retry,
    loadMoreError,
    retryLoadMore,
    sentinelRef,
    prevResult: prevResultRef.current,
  };
}
