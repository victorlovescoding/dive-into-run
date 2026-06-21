'use client';

import { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BookmarkButton from '@/components/BookmarkButton';
import EventActionButtons from '@/components/EventActionButtons';
import EventCardMenu from '@/components/EventCardMenu';
import UserLink from '@/components/UserLink';
import { evaluateEventEditStartedLock } from '@/runtime/events/event-runtime-helpers';
import {
  EVENT_AVAILABILITY_BADGE_LABELS, EVENT_AVAILABILITY_BADGE_STYLE_KEYS,
  getEventAvailabilityBadgeState, getEventPersonalBadgeLabel,
} from './event-status-badges';
import { formatDateTime, formatPace, renderRouteLabel } from './event-formatters';
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

  const eventCards = events.map((event) => {
    const eventId = String(event.id);
    const routeLabel = renderRouteLabel(event);
    const isHost = user?.uid === event.hostUid;
    const remainingSeats = getRemainingSeats(event);
    const availabilityStatus = getEventAvailabilityBadgeState(event, remainingSeats);
    const availabilityBadgeClassName = [
      styles.eventStatusBadge,
      styles[EVENT_AVAILABILITY_BADGE_STYLE_KEYS[availabilityStatus]],
    ].join(' ');
    const personalBadgeLabel = getEventPersonalBadgeLabel({
      event,
      eventId,
      user,
      membershipStatus: membershipStatusByEventId[eventId],
      myJoinedEventIds,
    });
    const hostStartedLock = isHost ? evaluateEventEditStartedLock(event).startedLock : null;
    const editDisabledReason = hostStartedLock?.message || '';
    const deleteDisabledReason = hostStartedLock?.message || '';

    return (
      <article
        key={event.id}
        className={styles.eventCard}
        aria-label={`${event.title} 活動卡片`}
        data-event-card-id={eventId}
        data-testid={`event-card-${eventId}`}
      >
        <div className={styles.eventMetaRow}>
          <div className={styles.eventMetaItem}>
            <span className={styles.eventMetaLabel}>時間</span>
            <span className={styles.eventMetaValue}>{formatDateTime(event.time)}</span>
          </div>
          <div className={styles.eventMetaItem}>
            <span className={styles.eventMetaLabel}>報名截止</span>
            <span className={styles.eventMetaValue}>
              {formatDateTime(event.registrationDeadline)}
            </span>
          </div>
        </div>

        <div className={styles.eventCardHeader}>
          <div className={styles.eventTitleCluster}>
            <Link href={`/events/${event.id}`} className={styles.eventTitleLink}>
              <h3 className={styles.eventTitle}>{event.title}</h3>
            </Link>
            <div className={styles.eventStatusBadgeGroup} aria-label={`${event.title} 狀態`}>
              <span className={availabilityBadgeClassName}>
                {EVENT_AVAILABILITY_BADGE_LABELS[availabilityStatus]}
              </span>
              {personalBadgeLabel && (
                <span className={`${styles.eventStatusBadge} ${styles.eventPersonalBadge}`}>
                  {personalBadgeLabel}
                </span>
              )}
            </div>
          </div>

          <div
            className={styles.eventCardTopActions}
            role="group"
            aria-label={`${event.title} 操作`}
          >
            <BookmarkButton
              isActive={favoriteEventIds.has(String(event.id))}
              label={`收藏活動：${event.title}`}
              activeLabel={`取消收藏活動：${event.title}`}
              onClick={() => onToggleFavoriteEvent(String(event.id))}
            />
            <EventCardMenu
              event={event}
              currentUserUid={user?.uid || null}
              onEdit={onEdit}
              onDelete={onDelete}
              editDisabledReason={editDisabledReason}
              deleteDisabledReason={deleteDisabledReason}
            />
          </div>
        </div>

        <dl className={styles.eventFactGrid}>
          <div className={styles.eventFact}>
            <dt>地點</dt>
            <dd>
              {event.city} {event.district}
            </dd>
          </div>
          <div className={styles.eventFact}>
            <dt>集合</dt>
            <dd>{event.meetPlace}</dd>
          </div>
          <div className={styles.eventFact}>
            <dt>距離</dt>
            <dd className={styles.eventNumericValue}>{event.distanceKm} km</dd>
          </div>
          <div className={styles.eventFact}>
            <dt>配速</dt>
            <dd className={styles.eventNumericValue}>{formatPace(event.paceSec, event.pace)} /km</dd>
          </div>
          <div className={styles.eventFact}>
            <dt>人數上限</dt>
            <dd className={styles.eventNumericValue}>{event.maxParticipants}</dd>
          </div>
          <div className={styles.eventFact}>
            <dt>剩餘名額</dt>
            <dd className={styles.eventNumericValue}>{remainingSeats}</dd>
          </div>
        </dl>

        <div className={styles.eventCardFooter}>
          <div className={styles.eventHostRouteGroup}>
            <div className={styles.hostRow}>
              <span className={styles.eventMetaLabel}>主揪</span>
              <UserLink
                uid={event.hostUid}
                name={event.hostName}
                photoURL={event.hostPhotoURL}
                size={24}
              />
            </div>
            <span className={styles.routePill}>
              路線：
              {routeLabel}
            </span>
          </div>

          <div className={styles.eventParticipationSlot} data-card-navigation="ignore">
            <EventActionButtons
              event={event}
              user={user}
              onJoin={onJoin}
              onLeave={onLeave}
              isPending={pendingByEventId[String(event.id)]}
              isCreating={isCreating}
              isFormOpen={isFormOpen}
              myJoinedEventIds={myJoinedEventIds}
              membershipStatus={membershipStatusByEventId[String(event.id)]}
            />
          </div>
        </div>
      </article>
    );
  });

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
