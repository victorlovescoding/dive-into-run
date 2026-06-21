'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EventListCard from './EventListCard';
import { buildAppliedFilterChips } from './event-list-scanning';
import styles from './EventsPageScreen.module.css';

const CARD_NAVIGATION_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[data-card-navigation="ignore"]',
].join(',');

/**
 * 判斷卡片點擊來源是否屬於既有互動元素，避免背景導覽攔截控制項。
 * @param {EventTarget | null} target - 點擊事件來源。
 * @returns {boolean} 是否應忽略卡片背景導覽。
 */
export function isInteractiveCardTarget(target) {
  const element =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return Boolean(element?.closest(CARD_NAVIGATION_SELECTOR));
}

/**
 * @typedef {object} EventsListSectionProps
 * @property {object[]} events - 要顯示的活動列表。
 * @property {{ uid: string } | null | undefined} user - 目前登入的使用者。
 * @property {boolean} isLoadingEvents - 是否正在初次載入活動。
 * @property {boolean} isFiltering - 是否正在執行篩選。
 * @property {boolean} isCreating - 是否正在建立新活動。
 * @property {string | null} loadError - 載入活動時的錯誤訊息。
 * @property {boolean} isFilteredResults - 目前列表是否為篩選結果。
 * @property {{ city?: string, district?: string, startTime?: string, endTime?: string, minDistance?: string, maxDistance?: string, hasSeatsOnly?: boolean }} appliedFilters - 已套用篩選條件。
 * @property {boolean} isLoadingMore - 是否正在載入更多活動。
 * @property {string | null} loadMoreError - 載入更多活動時的錯誤訊息。
 * @property {boolean} hasMore - 是否還有更多活動可載入。
 * @property {import('react').RefObject<HTMLDivElement | null>} sentinelRef - 無限滾動觸發哨兵元素的 ref。
 * @property {boolean} isFormOpen - 建立表單是否開啟中。
 * @property {Record<string, 'joining' | 'leaving'>} pendingByEventId - 各活動的操作等待狀態。
 * @property {Set<string>} myJoinedEventIds - 使用者已加入的活動 ID 集合。
 * @property {Record<string, 'checking' | 'joined' | 'notJoined'>} membershipStatusByEventId - 各活動的報名狀態。
 * @property {Set<string>} favoriteEventIds - 使用者已收藏的活動 ID 集合。
 * @property {(event: object) => number} getRemainingSeats - 計算活動剩餘名額。
 * @property {(event: object) => void} onJoin - 加入活動的回呼。
 * @property {(event: object) => void} onLeave - 離開活動的回呼。
 * @property {(event: object) => void} onEdit - 編輯活動的回呼。
 * @property {(ev: object) => void} onDelete - 刪除活動的回呼。
 * @property {(eventId: string) => void} onToggleFavoriteEvent - 切換活動收藏的回呼。
 * @property {() => void} onOpenFilter - 開啟篩選面板的回呼。
 * @property {() => void} loadMore - 載入更多活動的回呼。
 */

/**
 * 活動列表區塊，負責呈現活動卡片列表、載入/篩選/建立中狀態、
 * 空狀態提示，以及無限滾動的底部哨兵。
 * @param {EventsListSectionProps} props - 列表區塊所需的資料與回呼。
 * @returns {import('react').ReactElement} 列表區塊 JSX。
 */
export default function EventsListSection({
  events,
  user,
  isLoadingEvents,
  isFiltering,
  isCreating,
  loadError,
  isFilteredResults,
  appliedFilters = {},
  isLoadingMore,
  loadMoreError,
  hasMore,
  sentinelRef,
  isFormOpen,
  pendingByEventId,
  myJoinedEventIds,
  membershipStatusByEventId,
  favoriteEventIds,
  getRemainingSeats,
  onJoin,
  onLeave,
  onEdit,
  onDelete,
  onToggleFavoriteEvent,
  onOpenFilter,
  loadMore,
}) {
  const router = useRouter();
  const eventListRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isEmptyEventsList = !isLoadingEvents && !isFiltering && events.length === 0;
  const emptyEventsMessage = isFilteredResults ? '沒有符合條件的活動' : '目前還沒有活動（先建立一筆看看）';
  const activeFilterChips = buildAppliedFilterChips(appliedFilters);

  /**
   * 處理活動卡片背景點擊導覽；互動子元素維持自己的行為。
   * @param {string} eventId - 活動 ID。
   * @param {MouseEvent} clickEvent - 卡片點擊事件。
   */
  const handleCardClick = useCallback((eventId, clickEvent) => {
    if (isInteractiveCardTarget(clickEvent.target)) return;
    router.push(`/events/${eventId}`);
  }, [router]);

  useEffect(() => {
    const eventList = eventListRef.current;
    if (!eventList) return undefined;

    /**
     * 從列表層代理卡片背景點擊，避免讓卡片本身成為鍵盤焦點。
     * @param {MouseEvent} clickEvent - 列表內的原生點擊事件。
     */
    function handleEventListClick(clickEvent) {
      if (!(clickEvent.target instanceof Element)) return;

      const eventCard = clickEvent.target.closest('[data-event-card-id]');
      if (!(eventCard instanceof HTMLElement) || !eventList.contains(eventCard)) return;

      const eventId = eventCard.dataset.eventCardId;
      if (!eventId) return;

      handleCardClick(eventId, clickEvent);
    }

    eventList.addEventListener('click', handleEventListClick);
    return () => eventList.removeEventListener('click', handleEventListClick);
  }, [handleCardClick]);

  const eventCards = events.map((event) => (
    <EventListCard
      key={String(event.id)}
      event={event}
      user={user}
      isCreating={isCreating}
      isFormOpen={isFormOpen}
      pendingByEventId={pendingByEventId}
      myJoinedEventIds={myJoinedEventIds}
      membershipStatusByEventId={membershipStatusByEventId}
      favoriteEventIds={favoriteEventIds}
      getRemainingSeats={getRemainingSeats}
      onJoin={onJoin}
      onLeave={onLeave}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleFavoriteEvent={onToggleFavoriteEvent}
    />
  ));

  return (
    <div className={styles.eventsSection}>
      <div className={styles.eventsHeaderRow}>
        <h2 className={styles.eventsTitle}>活動列表</h2>

        <button
          type="button"
          className={styles.filterButton}
          aria-label="篩選活動"
          onClick={onOpenFilter}
        >
          <svg
            className={styles.filterIcon}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M3 5h18l-7 8v5l-4 1v-6L3 5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {activeFilterChips.length > 0 && (
        <div className={styles.activeFilterChips} aria-label="已套用篩選">
          {activeFilterChips.map((chip) => (
            <span key={chip} className={styles.activeFilterChip}>
              {chip}
            </span>
          ))}
        </div>
      )}

      {isLoadingEvents && (
        <div className={styles.statusRow} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <span>正在載入活動…</span>
        </div>
      )}

      {isFiltering && (
        <div className={styles.statusRow} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <span>正在篩選活動…</span>
        </div>
      )}

      {isCreating && (
        <div className={styles.statusRow} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <span>正在建立活動…</span>
        </div>
      )}

      {loadError && (
        <div className={styles.errorCard} role="alert">
          {loadError}
        </div>
      )}

      <div ref={eventListRef} className={styles.eventList}>
        {isEmptyEventsList ? (
          <div className={styles.emptyHint}>{emptyEventsMessage}</div>
        ) : (
          eventCards
        )}
      </div>

      <div className={styles.loadMoreArea}>
        {isLoadingMore && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>載入更多活動…</span>
          </div>
        )}

        {loadMoreError && (
          <div className={styles.errorCard} role="alert">
            {loadMoreError}
            <button
              type="button"
              className={styles.retryButton}
              onClick={loadMore}
              disabled={isLoadingMore || isLoadingEvents || isCreating || isFormOpen}
            >
              重試
            </button>
          </div>
        )}

        {!hasMore && events.length > 0 && <div className={styles.endHint}>已經到底了</div>}

        <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      </div>
    </div>
  );
}
