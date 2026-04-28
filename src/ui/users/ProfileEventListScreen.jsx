'use client';

import DashboardEventCard from '@/components/DashboardEventCard';
import styles from '@/app/users/[uid]/PublicProfile.module.css';

/** @typedef {import('@/service/member-dashboard-service').MyEventItem} MyEventItem */

/**
 * @typedef {object} ProfileEventsRuntimeState
 * @property {MyEventItem[]} items - 已 mapping 的活動列表。
 * @property {boolean} isInitialLoading - 首次載入中。
 * @property {boolean} isLoadingMore - 載入更多中。
 * @property {boolean} hasMore - 是否還有下一頁。
 * @property {string | null} initialError - 首次載入失敗訊息。
 * @property {string | null} loadMoreError - 載入更多失敗訊息。
 * @property {import('react').RefObject<HTMLDivElement | null>} sentinelRef - sentinel ref。
 */

/**
 * 主辦活動列表 render-only screen。
 * @param {object} props - Component props。
 * @param {ProfileEventsRuntimeState} props.runtime - runtime hook 回傳的 state。
 * @returns {import('react').ReactElement} 主辦活動列表 UI。
 */
export default function ProfileEventListScreen({ runtime }) {
  const {
    items,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    initialError,
    loadMoreError,
    sentinelRef,
  } = runtime;

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

      {hasMore && (
        <div
          ref={sentinelRef}
          className={styles.sentinel}
          aria-hidden="true"
          data-testid="profile-event-list-sentinel"
        />
      )}

      {isLoadingMore && <p className={styles.loadMoreStatus}>載入中...</p>}

      {loadMoreError && <p className={styles.loadMoreError}>{loadMoreError}</p>}
    </section>
  );
}
