'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getHostedEvents } from '@/lib/firebase-profile';
import DashboardEventCard from '@/components/DashboardEventCard';
import styles from './PublicProfile.module.css';

/** @typedef {import('@/lib/firebase-events').EventData} EventData */
/** @typedef {import('@/lib/firebase-member').MyEventItem} MyEventItem */
/** @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot */

/**
 * 將 `firebase-profile.getHostedEvents` 回傳的 `EventData` 正規化成
 * `DashboardEventCard` 所需的 `MyEventItem` shape。
 *
 * 為什麼在此元件內做 mapping：
 * 1. `EventData` 的 `title`、`location`、`participantsCount` 等欄位是
 *    optional（存在歷史資料可能缺欄位），`MyEventItem` 需要非 optional。
 * 2. 把正規化放在 UI 層避免改動 `DashboardEventCard` 的 contract；同時
 *    比把 fallback 塞進服務層更符合「服務層只做資料，UI 層做顯示 fallback」。
 * @param {EventData} event - 來自 firebase-profile 的活動資料。
 * @returns {MyEventItem} `DashboardEventCard` 能直接使用的事件項目。
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
 * 主辦活動列表元件（無限捲動）。
 *
 * 責任：
 * 1. 首次 mount 呼叫 `getHostedEvents(uid)`（不帶 lastDoc）取得第一頁。
 * 2. 若 `hasMore === true`，掛一個 sentinel 讓 `IntersectionObserver` 觸發
 *    `loadMore()` 帶上一次的 `lastDoc` 拉下一頁，新資料 append 到列表尾端。
 * 3. 載入中顯示「載入中」；首次載入失敗顯示「無法載入」；
 *    後續載入失敗保留既有項目並顯示「載入更多失敗」。
 * 4. 每筆活動透過 `DashboardEventCard` 以 `isHost={true}` 渲染。
 * @param {object} props - 元件屬性。
 * @param {string} props.uid - 目標使用者 UID（要查誰的主辦活動）。
 * @returns {import('react').ReactElement} 主辦活動列表。
 */
export default function ProfileEventList({ uid }) {
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
  // mountedRef 用於避免 unmount 後再 setState。Effect 1 原本用 closure
  // 內的 `cancelled` flag 已能防護首次載入，但 loadMore 是 useCallback
  // 建立的非同步函式，無法共用同一 flag。改成共用一個 mountedRef 讓
  // 「unmount 後不再 setState」的語意在整個元件內一致。
  const mountedRef = useRef(true);

  // --- Effects: mount/unmount lifecycle ---
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- Effects: 首次載入 ---
  useEffect(() => {
    if (!uid) return undefined;

    // closure 的 `cancelled` 防 uid 快速切換時舊 response 覆蓋新狀態；
    // `mountedRef` 則是整個元件層級的 unmount 防護（loadMore 也共用）。
    let cancelled = false;
    setIsInitialLoading(true);
    setInitialError(null);

    // 首次載入刻意傳一個空 options 物件（而非 undefined），讓呼叫現場清楚
    // 表達「沒有 lastDoc cursor」的語意；這也對齊測試 contract 的
    // `expect.not.objectContaining({ lastDoc: expect.anything() })` 斷言。
    getHostedEvents(uid, {})
      .then((page) => {
        if (cancelled || !mountedRef.current) return;
        setItems(page.items.map(toDashboardItem));
        lastDocRef.current = page.lastDoc;
        setHasMore(page.hasMore);
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        console.error('[ProfileEventList] initial load failed:', err);
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
      console.error('[ProfileEventList] load more failed:', err);
      setLoadMoreError('載入更多失敗');
    } finally {
      // isLoadingMoreRef 是 ref，即使 unmount 後重置也無害；但 setState
      // 必須 gate 在 mounted 檢查之內。
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

  // --- Render helpers ---
  const isEmpty = !isInitialLoading && !initialError && items.length === 0;

  return (
    <section className={styles.eventListSection} aria-label="主辦活動列表">
      <h2 className={styles.eventListTitle}>主辦活動</h2>

      {isInitialLoading && <p className={styles.loadingText}>載入中...</p>}

      {initialError && !isInitialLoading && items.length === 0 && (
        <p className={styles.errorText}>無法載入主辦活動</p>
      )}

      {isEmpty && <p className={styles.emptyText}>尚無主辦活動</p>}

      {items.length > 0 && (
        <div className={styles.eventList}>
          {items.map((/** @type {MyEventItem} */ event) => (
            <DashboardEventCard key={String(event.id)} event={event} isHost />
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />}

      {isLoadingMore && <p className={styles.loadMoreStatus}>載入中...</p>}

      {loadMoreError && <p className={styles.loadMoreError}>{loadMoreError}</p>}
    </section>
  );
}
