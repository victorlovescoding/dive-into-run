'use client';

import Link from 'next/link';
import BookmarkButton from '@/components/BookmarkButton';
import EventActionButtons from '@/components/EventActionButtons';
import EventCardMenu from '@/components/EventCardMenu';
import UserLink from '@/components/UserLink';
import { evaluateEventEditStartedLock } from '@/runtime/events/event-runtime-helpers';
import EventCardScanSummary from './EventCardScanSummary';
import { formatDateTime, formatPace, renderRouteLabel } from './event-formatters';
import styles from './EventsPageScreen.module.css';

/**
 * @typedef {object} EventListCardProps
 * @property {object} event - 活動資料。
 * @property {{ uid: string } | null | undefined} user - 目前登入的使用者。
 * @property {boolean} isCreating - 是否正在建立新活動。
 * @property {boolean} isFormOpen - 建立表單是否開啟。
 * @property {Record<string, 'joining' | 'leaving'>} pendingByEventId - 各活動操作等待狀態。
 * @property {Set<string>} myJoinedEventIds - 使用者已加入活動 ID。
 * @property {Record<string, 'checking' | 'joined' | 'notJoined'>} membershipStatusByEventId - 活動報名狀態。
 * @property {Set<string>} favoriteEventIds - 使用者已收藏活動 ID。
 * @property {(event: object) => number} getRemainingSeats - 剩餘名額計算器。
 * @property {(event: object) => void} onJoin - 加入活動回呼。
 * @property {(event: object) => void} onLeave - 退出活動回呼。
 * @property {(event: object) => void} onEdit - 編輯活動回呼。
 * @property {(event: object) => void} onDelete - 刪除活動回呼。
 * @property {(eventId: string) => void} onToggleFavoriteEvent - 切換收藏回呼。
 */

/**
 * @typedef {object} EventListCardData
 * @property {unknown} [city] - 活動縣市。
 * @property {unknown} [district] - 活動區域。
 * @property {unknown} [distanceKm] - 活動距離。
 * @property {unknown} [hostName] - 主揪名稱。
 * @property {unknown} [hostPhotoURL] - 主揪頭像。
 * @property {unknown} [hostUid] - 主揪使用者 ID。
 * @property {unknown} [maxParticipants] - 人數上限。
 * @property {unknown} [meetPlace] - 集合地點。
 * @property {unknown} [pace] - 備用配速文字。
 * @property {unknown} [paceSec] - 配速秒數。
 * @property {unknown} [registrationDeadline] - 報名截止時間。
 * @property {unknown} [time] - 活動開始時間。
 * @property {unknown} [title] - 活動標題。
 */

/**
 * 單張活動列表卡片。
 * @param {EventListCardProps} props - 卡片資料與操作回呼。
 * @returns {import('react').ReactElement} 活動卡片 JSX。
 */
export default function EventListCard({
  event,
  user,
  isCreating,
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
}) {
  const eventId = String(/** @type {{ id?: unknown }} */ (event).id);
  const {
    city: rawCity,
    district: rawDistrict,
    distanceKm: rawDistanceKm,
    hostName: rawHostName,
    hostPhotoURL: rawHostPhotoURL,
    hostUid: rawHostUid,
    maxParticipants: rawMaxParticipants,
    meetPlace: rawMeetPlace,
    pace: rawPace,
    paceSec: rawPaceSec,
    registrationDeadline: rawRegistrationDeadline,
    time: rawTime,
    title: rawTitle,
  } = /** @type {EventListCardData} */ (event);
  const routeLabel = renderRouteLabel(event);
  const hostUid = String(rawHostUid ?? '');
  const isHost = user?.uid === hostUid;
  const hostStartedLock = isHost ? evaluateEventEditStartedLock(event).startedLock : null;
  const editDisabledReason = hostStartedLock?.message || '';
  const deleteDisabledReason = hostStartedLock?.message || '';
  const title = String(rawTitle ?? '');
  const city = String(rawCity ?? '');
  const district = String(rawDistrict ?? '');
  const meetPlace = String(rawMeetPlace ?? '');
  const distanceKm = String(rawDistanceKm ?? '');
  const maxParticipants = String(rawMaxParticipants ?? '');
  const pace = String(rawPace ?? '');
  const paceSec = /** @type {number | string | null | undefined} */ (rawPaceSec);
  const time = /** @type {string | { toDate?: () => Date } | null | undefined} */ (
    rawTime
  );
  const registrationDeadline =
    /** @type {string | { toDate?: () => Date } | null | undefined} */ (rawRegistrationDeadline);

  return (
    <article
      className={styles.eventCard}
      aria-label={`${title} 活動卡片`}
      data-event-card-id={eventId}
      data-testid={`event-card-${eventId}`}
    >
      <div className={styles.eventMetaRow}>
        <div className={styles.eventMetaItem}>
          <span className={styles.eventMetaLabel}>時間</span>
          <span className={styles.eventMetaValue}>{formatDateTime(time)}</span>
        </div>
        <div className={styles.eventMetaItem}>
          <span className={styles.eventMetaLabel}>報名截止</span>
          <span className={styles.eventMetaValue}>{formatDateTime(registrationDeadline)}</span>
        </div>
      </div>

      <div className={styles.eventCardHeader}>
        <Link href={`/events/${eventId}`} className={styles.eventTitleLink}>
          <h3 className={styles.eventTitle}>{title}</h3>
        </Link>

        <div className={styles.eventCardTopActions} role="group" aria-label={`${title} 操作`}>
          <BookmarkButton
            isActive={favoriteEventIds.has(eventId)}
            label={`收藏活動：${title}`}
            activeLabel={`取消收藏活動：${title}`}
            onClick={() => onToggleFavoriteEvent(eventId)}
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

      <EventCardScanSummary event={event} getRemainingSeats={getRemainingSeats} />

      <dl className={styles.eventFactGrid}>
        <div className={styles.eventFact}>
          <dt>地點</dt>
          <dd>
            {city} {district}
          </dd>
        </div>
        <div className={styles.eventFact}>
          <dt>集合</dt>
          <dd>{meetPlace}</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>距離</dt>
          <dd className={styles.eventNumericValue}>{distanceKm} km</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>配速</dt>
          <dd className={styles.eventNumericValue}>
            {formatPace(paceSec, pace)} /km
          </dd>
        </div>
        <div className={styles.eventFact}>
          <dt>人數上限</dt>
          <dd className={styles.eventNumericValue}>{maxParticipants}</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>剩餘名額</dt>
          <dd className={styles.eventNumericValue}>{getRemainingSeats(event)}</dd>
        </div>
      </dl>

      <div className={styles.eventCardFooter}>
        <div className={styles.eventHostRouteGroup}>
          <div className={styles.hostRow}>
            <span className={styles.eventMetaLabel}>主揪</span>
            <UserLink
              uid={hostUid}
              name={String(rawHostName ?? '')}
              photoURL={String(rawHostPhotoURL ?? '')}
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
            isPending={pendingByEventId[eventId]}
            isCreating={isCreating}
            isFormOpen={isFormOpen}
            myJoinedEventIds={myJoinedEventIds}
            membershipStatus={membershipStatusByEventId[eventId]}
          />
        </div>
      </div>
    </article>
  );
}
