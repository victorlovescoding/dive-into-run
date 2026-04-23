'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getHostedEvents } from '@/service/profile-service';

/** @typedef {import('@/service/event-service').EventData} EventData */
/** @typedef {import('@/service/member-dashboard-service').MyEventItem} MyEventItem */
/** @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot */

/**
 * @typedef {object} ProfileEventsRuntimeState
 * @property {MyEventItem[]} items - 已 mapping 成 DashboardEventCard shape 的活動列表。
 * @property {boolean} isInitialLoading - 首次載入中。
 * @property {boolean} isLoadingMore - 載入更多中。
 * @property {boolean} hasMore - 是否還有下一頁。
 * @property {string | null} initialError - 首次載入失敗訊息。
 * @property {string | null} loadMoreError - 載入更多失敗訊息。
 * @property {import('react').RefObject<HTMLDivElement | null>} sentinelRef - IntersectionObserver sentinel ref。
 */

/**
 * 將 `getHostedEvents` 回傳的 `EventData` 正規化成
 * `DashboardEventCard` 所需的 `MyEventItem` shape。
 * @param {EventData} event - 來自 profile-service 的活動資料。
 * @returns {MyEventItem} DashboardEventCard 能直接使用的事件項目。
 */
function toDashboardItem(event) {
  return /** @type {MyEventItem} */ ({
    id: /** @type {string} */ (event.id ?? ''),
    title: event.title ?? '（未命名活動）',
    time: event.time,
    location: event.location ?? '',
    city: event.city ?? '',
    participantsCount: event.participantsCount ?? 0,
    maxParticipants: event.maxParticipants ?? 0,
    hostUid: event.hostUid ?? '',
  });
}

/**
 * Profile hosted events runtime hook — 封裝無限捲動 state management。
 *
 * 責任：
 * 1. 首次 mount 呼叫 `getHostedEvents(uid)` 取得第一頁。
 * 2. 若 `hasMore === true`，掛 IntersectionObserver 觸發 loadMore。
 * 3. 管理 loading / error / items state。
 * @param {string} uid - 目標使用者 UID。
 * @returns {ProfileEventsRuntimeState} runtime state。
 */
export default function useProfileEventsRuntime(uid) {
  // --- State ---
  const [items, setItems] = useState(/** @type {MyEventItem[]} */ (/** @type {unknown} */ ([])));
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [initialError, setInitialError] = useState(/** @type {string | null} */ (null));
  const [loadMoreError, setLoadMoreError] = useState(/** @type {string | null} */ (null));

  // --- Refs ---
  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const lastDocRef = useRef(/** @type {QueryDocumentSnapshot | null} */ (null));
  const isLoadingMoreRef = useRef(false);
  const mountedRef = useRef(true);

  // --- Effects: mount/unmount lifecycle ---
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- Effects: initial load ---
  useEffect(() => {
    if (!uid) return undefined;

    let cancelled = false;
    setIsInitialLoading(true);
    setInitialError(null);

    getHostedEvents(uid, {})
      .then((page) => {
        if (cancelled || !mountedRef.current) return;
        setItems(page.items.map(toDashboardItem));
        lastDocRef.current = page.lastDoc;
        setHasMore(page.hasMore);
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        console.error('[useProfileEventsRuntime] initial load failed:', err);
        setInitialError('載入失敗');
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setIsInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // --- Handlers: load more ---
  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return;
    if (!hasMore) return;
    if (!uid) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await getHostedEvents(uid, { lastDoc: lastDocRef.current });
      if (!mountedRef.current) return;
      setItems((prev) => [...prev, ...page.items.map(toDashboardItem)]);
      lastDocRef.current = page.lastDoc;
      setHasMore(page.hasMore);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[useProfileEventsRuntime] load more failed:', err);
      setLoadMoreError('載入更多失敗');
    } finally {
      isLoadingMoreRef.current = false;
      if (mountedRef.current) setIsLoadingMore(false);
    }
  }, [uid, hasMore]);

  // --- Effects: IntersectionObserver ---
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    if (!hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: '0px 0px 200px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return {
    items,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    initialError,
    loadMoreError,
    sentinelRef,
  };
}
