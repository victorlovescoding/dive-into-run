import Link from 'next/link';
import EventActionButtons from '@/components/EventActionButtons';
import EventCardMenu from '@/components/EventCardMenu';
import UserLink from '@/components/UserLink';
import { formatDateTime, formatPace, renderRouteLabel } from './event-formatters';
import styles from './EventsPageScreen.module.css';

/**
 * @typedef {object} EventsListSectionProps
 * @property {object[]} events - 要顯示的活動列表。
 * @property {import('firebase/auth').User | null | undefined} user - 目前登入的使用者。
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
 * @property {Record<string, boolean>} pendingByEventId - 各活動的操作等待狀態。
 * @property {Set<string>} myJoinedEventIds - 使用者已加入的活動 ID 集合。
 * @property {(event: object) => number} getRemainingSeats - 計算活動剩餘名額。
 * @property {(event: object) => void} onJoin - 加入活動的回呼。
 * @property {(event: object) => void} onLeave - 離開活動的回呼。
 * @property {(event: object) => void} onEdit - 編輯活動的回呼。
 * @property {(ev: object) => void} onDelete - 刪除活動的回呼。
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
  getRemainingSeats,
  onJoin,
  onLeave,
  onEdit,
  onDelete,
  onOpenFilter,
  loadMore,
}) {
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

      <div className={styles.eventList}>
        {!isLoadingEvents && !isFiltering && events.length === 0 ? (
          <div className={styles.emptyHint}>
            {isFilteredResults ? '沒有符合條件的活動' : '目前還沒有活動（先建立一筆看看）'}
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className={styles.eventCardWrapper}>
              <div className={styles.eventCard}>
                <Link href={`/events/${event.id}`} className={styles.eventTitleLink}>
                  <div className={styles.eventTitle}>{event.title}</div>
                </Link>

                <div className={styles.eventMeta}>
                  <div>
                    時間：
                    {formatDateTime(event.time)}
                  </div>
                  <div>
                    報名截止：
                    {formatDateTime(event.registrationDeadline)}
                  </div>
                  <div>
                    地點：
                    {event.city} {event.district}
                  </div>
                  <div>
                    集合：
                    {event.meetPlace}
                  </div>
                </div>

                <div className={styles.eventMeta}>
                  <div>
                    距離：
                    {event.distanceKm} km
                  </div>
                  <div>
                    配速：
                    {formatPace(event.paceSec, event.pace)} /km
                  </div>
                  <div>
                    人數上限：
                    {event.maxParticipants}
                  </div>
                  <div>
                    剩餘名額：
                    {getRemainingSeats(event)}
                  </div>
                </div>

                <div className={styles.eventMeta}>
                  <div className={styles.hostRow}>
                    <span>主揪：</span>
                    <UserLink
                      uid={event.hostUid}
                      name={event.hostName}
                      photoURL={event.hostPhotoURL}
                      size={24}
                    />
                  </div>
                  <div>
                    路線：
                    {renderRouteLabel(event)}
                  </div>
                </div>

                <div className={styles.eventCardActions}>
                  <EventActionButtons
                    event={event}
                    user={user}
                    onJoin={onJoin}
                    onLeave={onLeave}
                    isPending={pendingByEventId[String(event.id)]}
                    isCreating={isCreating}
                    isFormOpen={isFormOpen}
                    myJoinedEventIds={myJoinedEventIds}
                  />
                </div>
              </div>

              <div className={styles.eventCardMenuWrapper}>
                <EventCardMenu
                  event={event}
                  currentUserUid={user?.uid || null}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            </div>
          ))
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
