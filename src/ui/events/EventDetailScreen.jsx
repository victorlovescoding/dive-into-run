'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import CommentSection from '@/components/CommentSection';
import EventCardMenu from '@/components/EventCardMenu';
import EventDeleteConfirm from '@/components/EventDeleteConfirm';
import EventEditForm from '@/components/EventEditForm';
import ShareButton from '@/components/ShareButton';
import UserLink from '@/components/UserLink';
import { formatDateTime, formatPace } from './event-formatters';
import styles from './EventDetailScreen.module.css';
import ParticipantsModal from './ParticipantsModal';

const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

/**
 * 活動詳情頁 UI screen。
 * @param {object} props - 元件 props。
 * @param {string} props.id - 活動 ID。
 * @param {object} props.runtime - 由 runtime boundary 提供的 state 與 handlers。
 * @returns {import('react').ReactElement} 活動詳情頁 UI。
 */
export default function EventDetailScreen({ id, runtime }) {
  const {
    user,
    event,
    loading,
    error,
    participants,
    participantsLoading,
    participantsError,
    isParticipantsOpen,
    participantsOverlayRef,
    pending,
    editingEvent,
    isUpdating,
    deletingEventId,
    isDeletingEvent,
    statusText,
    hasRoute,
    routePolylines,
    routePointCount,
    remainingSeats,
    participationState,
    shareUrl,
    handleOpenParticipants,
    handleCloseParticipants,
    refreshParticipants,
    handleJoin,
    handleLeave,
    handleEditEvent,
    handleEditCancel,
    handleEditSubmit,
    handleDeleteEventRequest,
    handleDeleteCancel,
    handleDeleteConfirm,
    handleCommentAdded,
  } = runtime;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.eventsSection}>
        <Link href="/events" className={styles.backLink}>
          ← 回到活動列表
        </Link>

        {loading && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在載入活動詳情…</span>
          </div>
        )}

        {error && (
          <div className={styles.errorCard} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && event && (
          <>
            <div className={styles.eventCard}>
              <div className={styles.detailHeader}>
                <div className={styles.eventTitle}>{event.title}</div>
                <div className={styles.detailHeaderRight}>
                  <ShareButton title={event.title} url={shareUrl} />
                  <div className={styles.statusPill}>{statusText}</div>
                  <EventCardMenu
                    event={event}
                    currentUserUid={user?.uid || null}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEventRequest}
                  />
                </div>
              </div>

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
                  {remainingSeats}
                </div>
              </div>

              <div className={styles.eventMeta}>
                <div className={styles.hostRow}>
                  <span>主揪：</span>
                  <UserLink
                    uid={event.hostUid}
                    name={event.hostName}
                    photoURL={event.hostPhotoURL}
                    size={28}
                  />
                </div>
              </div>

              <div className={styles.detailActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleOpenParticipants}
                >
                  看看誰有參加
                </button>

                {participationState === 'login_required' && (
                  <div className={`${styles.helperText} ${styles.alignSelfCenter}`}>
                    加入活動前請先登入
                  </div>
                )}

                {participationState === 'joined' && (
                  <button
                    type="button"
                    className={`${styles.submitButton} ${styles.leaveButton}`}
                    onClick={handleLeave}
                    disabled={pending !== null}
                  >
                    {pending === 'leaving' ? (
                      <span className={styles.spinnerLabel}>
                        <div className={`${styles.spinner} ${styles.buttonSpinner}`} />
                        取消中…
                      </span>
                    ) : (
                      '退出活動'
                    )}
                  </button>
                )}

                {participationState === 'full' && (
                  <button
                    type="button"
                    className={`${styles.submitButton} ${styles.soldOutButton}`}
                    disabled
                    aria-disabled="true"
                  >
                    已額滿
                  </button>
                )}

                {participationState === 'deadline_passed' && (
                  <button
                    type="button"
                    className={styles.submitButton}
                    disabled
                    aria-disabled="true"
                  >
                    報名已截止
                  </button>
                )}

                {participationState === 'can_join' && (
                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={handleJoin}
                    disabled={pending !== null}
                  >
                    {pending === 'joining' ? (
                      <span className={styles.spinnerLabel}>
                        <div className={`${styles.spinner} ${styles.buttonSpinner}`} />
                        報名中…
                      </span>
                    ) : (
                      '參加活動'
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className={styles.eventCard}>
              <div className={`${styles.eventTitle} ${styles.fontSize16}`}>活動說明</div>
              <div className={styles.eventMeta}>
                {event.description?.trim() ? event.description : '尚未填寫活動說明'}
              </div>
            </div>

            <div className={styles.eventCard}>
              <div className={`${styles.eventTitle} ${styles.fontSize16}`}>活動路線</div>

              {!hasRoute ? (
                <div className={styles.eventMeta}>此活動未設定路線</div>
              ) : (
                <>
                  <div className={styles.eventMeta}>
                    已設定路線（
                    {routePointCount || '?'} 點）
                  </div>

                  <div className={styles.detailMapContainer}>
                    <EventMap
                      mode="view"
                      encodedPolylines={routePolylines}
                      bbox={event.route?.bbox}
                      height={420}
                    />
                  </div>
                </>
              )}
            </div>

            <CommentSection eventId={id} onCommentAdded={handleCommentAdded} />

            <ParticipantsModal
              participants={participants}
              loading={participantsLoading}
              error={participantsError}
              isOpen={isParticipantsOpen}
              onClose={handleCloseParticipants}
              onRetry={refreshParticipants}
              overlayRef={participantsOverlayRef}
              hostUid={event.hostUid}
            />
          </>
        )}
      </div>

      {editingEvent && (
        <div className={styles.editFormOverlay}>
          <EventEditForm
            event={editingEvent}
            onSubmit={handleEditSubmit}
            onCancel={handleEditCancel}
            isSubmitting={isUpdating}
          />
        </div>
      )}

      {deletingEventId && (
        <div className={styles.deleteConfirmOverlay}>
          <EventDeleteConfirm
            eventId={deletingEventId}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
            isDeleting={isDeletingEvent}
          />
        </div>
      )}
    </div>
  );
}
