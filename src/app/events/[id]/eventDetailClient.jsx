'use client';

import { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Timestamp as FirestoreTimestamp } from '@/lib/firestore-types';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  fetchEventById,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
  joinEvent,
  leaveEvent,
  updateEvent,
  deleteEvent,
  EVENT_NOT_FOUND_MESSAGE,
} from '@/lib/firebase-events';
import {
  buildUserPayload,
  isDeadlinePassed,
  normalizeRoutePolylines,
  toMs,
} from '@/lib/event-helpers';
import {
  notifyEventModified,
  notifyEventCancelled,
  notifyEventNewComment,
} from '@/lib/firebase-notifications';
import EventCardMenu from '@/components/EventCardMenu';
import EventEditForm from '@/components/EventEditForm';
import EventDeleteConfirm from '@/components/EventDeleteConfirm';
import CommentSection from '@/components/CommentSection';
import ShareButton from '@/components/ShareButton';
import UserLink from '@/components/UserLink';
import styles from '../events.module.css';

// Leaflet 只能在瀏覽器端跑
const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

/**
 * 格式化日期。
 * @param {string|object|null|undefined} value - 日期值。
 * @returns {string} 格式化後的字串。
 */
function formatDateTime(value) {
  if (!value) return '';

  // datetime-local 字串（例如 2025-12-27T13:17）
  if (typeof value === 'string') {
    return value.replace('T', ' ');
  }

  // Firestore Timestamp（有 toDate 方法）
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  return String(value);
}

/**
 * 計算活動狀態。
 * @param {object} root0 - 活動時間資料。
 * @param {string|object} root0.time - 活動時間。
 * @param {string|object} root0.registrationDeadline - 報名截止時間。
 * @returns {string} 活動狀態文字。
 */
function computeStatus({ time, registrationDeadline }) {
  const now = Date.now();
  const t = toMs(time);
  const ddl = toMs(registrationDeadline);

  if (t && now >= t) return '活動已開始';
  if (ddl && now >= ddl) return '報名已截止';
  return '報名中';
}

/**
 * 安全轉換數字。
 * @param {string | number | null | undefined} v - 要轉換的值。
 * @returns {number} 轉換後的數字，無效值回傳 0。
 */
function toNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 計算剩餘名額。
 * @param {import('@/lib/event-helpers').EventData} ev - 活動資料。
 * @param {number} [fallbackParticipantsCount] - 備用參加人數。
 * @returns {number} 剩餘名額。
 */
function getRemainingSeats(ev, fallbackParticipantsCount = 0) {
  if (typeof ev?.remainingSeats === 'number') return ev.remainingSeats;
  const max = toNumber(ev?.maxParticipants);
  const count =
    typeof ev?.participantsCount === 'number' ? ev.participantsCount : fallbackParticipantsCount;
  return Math.max(0, max - toNumber(count));
}

/**
 * 格式化配速。
 * @param {number|string|null|undefined} paceSec - 配速秒數。
 * @param {string} [fallbackText] - 備用文字。
 * @returns {string} 格式化後的配速。
 */
function formatPace(paceSec, fallbackText = '') {
  const n = typeof paceSec === 'number' ? paceSec : Number(paceSec);
  if (Number.isFinite(n) && n > 0) {
    const mm = Math.floor(n / 60);
    const ss = n % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }
  if (typeof fallbackText === 'string' && fallbackText.trim()) return fallbackText;
  return '';
}

/**
 * 活動詳情客戶端組件。
 * @param {object} root0 - 元件屬性。
 * @param {string} root0.id - 活動 ID。
 * @returns {import('react').ReactElement} 詳情頁面。
 */
export default function EventDetailClient({ id }) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // participants
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState(null);
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const participantsOverlayRef = useRef(null);

  // join/leave UI
  const [pending, setPending] = useState(null); // 'joining' | 'leaving' | null

  // edit/delete UI
  const [editingEvent, setEditingEvent] = useState(
    /** @type {import('@/lib/event-helpers').EventData|null} */ (null),
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(/** @type {string|null} */ (null));
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const [isJoined, setIsJoined] = useState(false);

  const refreshParticipants = useCallback(async () => {
    if (!id) return;

    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const list = await fetchParticipants(id, 200);
      setParticipants(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('讀取參加名單失敗:', err);
      setParticipantsError('讀取參加名單失敗，請稍後再試');
    } finally {
      setParticipantsLoading(false);
    }
  }, [id]);

  // 讀活動詳情
  useEffect(() => {
    let cancelled = false;

    /** 載入活動詳情資料。 */
    async function run() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchEventById(id);
        if (cancelled) return;

        if (!data) {
          setEvent(null);
          setError('找不到這個活動（可能已被刪除）');
          return;
        }

        setEvent(data);
      } catch (err) {
        console.error('讀取活動詳情失敗:', err);
        if (!cancelled) setError('讀取活動詳情失敗，請稍後再試');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 進頁就抓參加名單
  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);

  // 查「我是否已參加」(避免靠 participants 陣列判斷會受 limit 影響)
  useEffect(() => {
    let cancelled = false;

    /** 查詢目前使用者是否已參加此活動。 */
    async function run() {
      setIsJoined(false);
      if (!user?.uid || !id) return;

      try {
        const set = await fetchMyJoinedEventsForIds(user.uid, [String(id)]);
        if (cancelled) return;
        setIsJoined(set instanceof Set ? set.has(String(id)) : false);
      } catch (err) {
        console.error('查詢是否已參加失敗:', err);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, id]);

  // overlay 開啟時鎖住 body 滾動
  const hasOverlay = isParticipantsOpen || editingEvent !== null || deletingEventId !== null;
  useEffect(() => {
    if (hasOverlay) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
    return undefined;
  }, [hasOverlay]);

  // participants overlay：backdrop click + Escape 以原生 listener 處理，避免 jsx-a11y 違規
  useEffect(() => {
    if (!isParticipantsOpen) return undefined;
    const overlay = participantsOverlayRef.current;
    const handleClick = (/** @type {MouseEvent} */ e) => {
      if (e.target === overlay) setParticipantsOpen(false);
    };
    const handleKeyDown = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') setParticipantsOpen(false);
    };
    overlay?.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      overlay?.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isParticipantsOpen]);

  // ── 編輯 handlers ──

  /**
   * 開啟編輯表單。
   * @param {import('@/lib/event-helpers').EventData} ev - 活動資料。
   */
  const handleEditEvent = useCallback(
    (/** @type {import('@/lib/event-helpers').EventData} */ ev) => {
      setEditingEvent(ev);
    },
    [],
  );

  /** 取消編輯。 */
  const handleEditCancel = useCallback(() => {
    setEditingEvent(null);
  }, []);

  /**
   * 提交活動編輯更新。
   * @param {object} changedData - 含 id 與變更欄位的物件。
   * @returns {Promise<void>}
   */
  const handleEditSubmit = useCallback(
    async (/** @type {{ id: string, [key: string]: unknown }} */ changedData) => {
      const { id: eventId, ...fields } = changedData;

      // 報名截止時間必須在活動開始時間之前
      if ('time' in fields || 'registrationDeadline' in fields) {
        const effectiveTime = fields.time ?? editingEvent?.time;
        const effectiveDeadline = fields.registrationDeadline ?? editingEvent?.registrationDeadline;
        const deadlineMs = toMs(/** @type {string} */ (effectiveDeadline));
        const timeMs = toMs(/** @type {string} */ (effectiveTime));
        if (deadlineMs !== null && timeMs !== null && deadlineMs >= timeMs) {
          showToast('報名截止時間必須在活動開始時間之前', 'error');
          return;
        }
      }

      setIsUpdating(true);
      try {
        await updateEvent(String(eventId), fields);

        // 通知參加者活動已修改（fire-and-forget）
        notifyEventModified(String(eventId), event?.title || '', {
          uid: user.uid,
          name: user.name || '',
          photoURL: user.photoURL || '',
        }).catch((notifyErr) => {
          console.error('通知建立失敗:', notifyErr);
          showToast('通知發送失敗', 'error');
        });

        const mergedFields = { ...fields };
        if (typeof mergedFields.time === 'string' && mergedFields.time) {
          mergedFields.time = FirestoreTimestamp.fromDate(new Date(mergedFields.time));
        }
        if (
          typeof mergedFields.registrationDeadline === 'string' &&
          mergedFields.registrationDeadline
        ) {
          mergedFields.registrationDeadline = FirestoreTimestamp.fromDate(
            new Date(/** @type {string} */ (mergedFields.registrationDeadline)),
          );
        }
        setEvent((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, ...mergedFields };
          // 若 route 被清除，從本地 state 移除
          if ('route' in mergedFields && mergedFields.route === null) {
            delete updated.route;
          }
          return updated;
        });
        showToast('更新活動成功');
        setEditingEvent(null);
      } catch (err) {
        console.error('更新活動失敗:', err);
        showToast('更新活動失敗，請稍後再試', 'error');
      } finally {
        setIsUpdating(false);
      }
    },
    [showToast, event?.title, user, editingEvent],
  );

  // ── 刪除 handlers ──

  /**
   * 開啟刪除確認對話框。
   * @param {import('@/lib/event-helpers').EventData} ev - 活動資料。
   */
  const handleDeleteEventRequest = useCallback(
    (/** @type {import('@/lib/event-helpers').EventData} */ ev) => {
      setDeletingEventId(String(ev.id));
    },
    [],
  );

  /** 取消刪除。 */
  const handleDeleteCancel = useCallback(() => {
    setDeletingEventId(null);
  }, []);

  /**
   * 確認刪除活動，成功後導回活動列表。
   * @param {string} eventId - 要刪除的活動 ID。
   * @returns {Promise<void>}
   */
  const handleDeleteConfirm = useCallback(
    async (/** @type {string} */ eventId) => {
      setIsDeletingEvent(true);
      try {
        // 取得參加者清單（刪除後就讀不到了）
        const currentParticipants = await fetchParticipants(String(eventId));
        // 通知參加者活動已取消
        await notifyEventCancelled(String(eventId), event?.title || '', currentParticipants, {
          uid: user.uid,
          name: user.name || '',
          photoURL: user.photoURL || '',
        });

        await deleteEvent(String(eventId));
        setDeletingEventId(null);
        router.push('/events?toast=活動已刪除');
      } catch (err) {
        // Race condition：其他 tab / session 已先刪除此活動。
        // 沿用載入時已刪除的紅卡片 UI（setEvent(null) + setError），避免誤導
        // 使用者以為自己的刪除操作失敗。用 warn 級 log 留 trace 但不觸發
        // Next.js dev overlay（只有 console.error 會）。
        if (err instanceof Error && err.message === EVENT_NOT_FOUND_MESSAGE) {
          console.warn('Delete event skipped: already deleted by another session');
          setDeletingEventId(null);
          setEvent(null);
          setError('找不到這個活動（可能已被刪除）');
          return;
        }
        console.error('刪除活動失敗:', err);
        showToast('刪除活動失敗，請稍後再試', 'error');
      } finally {
        setIsDeletingEvent(false);
      }
    },
    [router, showToast, event?.title, user],
  );

  /**
   * 處理新留言通知：留言建立後觸發活動留言通知。
   * @param {string} commentId - 新留言 ID。
   */
  const handleCommentAdded = useCallback(
    (/** @type {string} */ commentId) => {
      if (!event || !user) return;
      notifyEventNewComment(String(id), event.title, event.hostUid, commentId, {
        uid: user.uid,
        name: user.name || '',
        photoURL: user.photoURL || '',
      }).catch((err) => {
        console.error('活動留言通知失敗:', err);
      });
    },
    [id, event, user],
  );

  const statusText = useMemo(() => {
    if (!event) return '';
    return computeStatus({
      time: event.time,
      registrationDeadline: event.registrationDeadline,
    });
  }, [event]);

  const hasRoute = normalizeRoutePolylines(event?.route).length > 0;

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
            {/* 基本資訊 */}
            <div className={styles.eventCard}>
              <div className={styles.detailHeader}>
                <div className={styles.eventTitle}>{event.title}</div>
                <div className={styles.detailHeaderRight}>
                  <ShareButton title={event.title} url={`${window.location.origin}/events/${id}`} />
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
                  {getRemainingSeats(event, participants.length)}
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

              {/* ✅ 參加/退出 + 參加名單 */}
              <div className={styles.detailActions}>
                {/* 參加名單 */}
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={async () => {
                    setParticipantsOpen(true);
                    await refreshParticipants();
                  }}
                >
                  看看誰有參加
                </button>

                {/* 參加/退出 */}
                {!user?.uid && (
                  <div className={`${styles.helperText} ${styles.alignSelfCenter}`}>
                    加入活動前請先登入
                  </div>
                )}
                {user?.uid &&
                  event.hostUid !== user.uid &&
                  (() => {
                    const remaining = getRemainingSeats(event, participants.length);

                    if (isJoined) {
                      return (
                        <button
                          type="button"
                          className={`${styles.submitButton} ${styles.leaveButton}`}
                          onClick={async () => {
                            if (!user?.uid) return;
                            const payload = buildUserPayload(user);
                            if (!payload) return;

                            setPending('leaving');
                            try {
                              const res = await leaveEvent(String(id), payload);
                              if (
                                res?.ok &&
                                (res.status === 'left' || res.status === 'not_joined')
                              ) {
                                setIsJoined(false);

                                // UI 快取更新（counts/seats + participants list）
                                setEvent((prev) => {
                                  if (!prev) return prev;
                                  const max = toNumber(prev.maxParticipants);
                                  const prevCount = toNumber(
                                    prev.participantsCount ?? participants.length,
                                  );
                                  const prevRemaining = getRemainingSeats(
                                    prev,
                                    participants.length,
                                  );
                                  return {
                                    ...prev,
                                    participantsCount: Math.max(0, prevCount - 1),
                                    remainingSeats: Math.min(max, prevRemaining + 1),
                                  };
                                });

                                setParticipants((prev) =>
                                  prev.filter((p) => String(p.uid) !== String(user.uid)),
                                );

                                showToast('已成功取消報名');
                              } else {
                                showToast('發生錯誤，請再重新取消報名', 'error');
                              }
                            } catch (err) {
                              console.error('退出活動失敗:', err);
                              showToast('發生錯誤，請再重新取消報名', 'error');
                            } finally {
                              setPending(null);
                            }
                          }}
                          disabled={pending != null}
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
                      );
                    }

                    if (remaining <= 0) {
                      return (
                        <button
                          type="button"
                          className={`${styles.submitButton} ${styles.soldOutButton}`}
                          disabled
                          aria-disabled="true"
                        >
                          已額滿
                        </button>
                      );
                    }

                    if (isDeadlinePassed(event)) {
                      return (
                        <button
                          type="button"
                          className={styles.submitButton}
                          disabled
                          aria-disabled="true"
                        >
                          報名已截止
                        </button>
                      );
                    }

                    return (
                      <button
                        type="button"
                        className={styles.submitButton}
                        onClick={async () => {
                          if (!user?.uid) return;
                          const payload = buildUserPayload(user);
                          if (!payload) return;

                          setPending('joining');
                          try {
                            const res = await joinEvent(String(id), payload);

                            if (
                              res?.ok &&
                              (res.status === 'joined' || res.status === 'already_joined')
                            ) {
                              setIsJoined(true);

                              if (res.status === 'joined') {
                                // UI 快取更新（counts/seats + participants list）
                                setEvent((prev) => {
                                  if (!prev) return prev;
                                  const prevCount = toNumber(
                                    prev.participantsCount ?? participants.length,
                                  );
                                  const prevRemaining = getRemainingSeats(
                                    prev,
                                    participants.length,
                                  );
                                  return {
                                    ...prev,
                                    participantsCount: prevCount + 1,
                                    remainingSeats: Math.max(0, prevRemaining - 1),
                                  };
                                });

                                setParticipants((prev) => {
                                  const uid = String(user.uid);
                                  if (prev.some((p) => String(p.uid) === uid)) return prev;
                                  return [
                                    {
                                      id: uid,
                                      uid,
                                      name: payload.name,
                                      photoURL: payload.photoURL,
                                      eventId: String(id),
                                    },
                                    ...prev,
                                  ];
                                });
                              }

                              showToast('報名成功');
                            } else if (res?.ok === false && res.status === 'full') {
                              showToast('本活動已額滿', 'error');
                              setEvent((prev) => (prev ? { ...prev, remainingSeats: 0 } : prev));
                            } else {
                              showToast('報名失敗，請再試一次', 'error');
                            }
                          } catch (err) {
                            console.error('參加活動失敗:', err);
                            showToast('報名失敗，請再試一次', 'error');
                          } finally {
                            setPending(null);
                          }
                        }}
                        disabled={pending != null}
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
                    );
                  })()}
              </div>
            </div>

            {/* 活動說明 */}
            <div className={styles.eventCard}>
              <div className={`${styles.eventTitle} ${styles.fontSize16}`}>活動說明</div>
              <div className={styles.eventMeta}>
                {event.description?.trim() ? event.description : '尚未填寫活動說明'}
              </div>
            </div>

            {/* 路線 */}
            <div className={styles.eventCard}>
              <div className={`${styles.eventTitle} ${styles.fontSize16}`}>活動路線</div>

              {!hasRoute ? (
                <div className={styles.eventMeta}>此活動未設定路線</div>
              ) : (
                <>
                  <div className={styles.eventMeta}>
                    已設定路線（
                    {event.route?.pointsCount ?? '?'} 點）
                  </div>

                  <div className={styles.detailMapContainer}>
                    <EventMap
                      mode="view"
                      encodedPolylines={normalizeRoutePolylines(event.route)}
                      bbox={event.route.bbox}
                      height={420}
                    />
                  </div>
                </>
              )}
            </div>

            <CommentSection eventId={id} onCommentAdded={handleCommentAdded} />

            {/* ✅ Participants Overlay */}
            {isParticipantsOpen && (
              <div
                ref={participantsOverlayRef}
                role="dialog"
                aria-modal="true"
                className={styles.participantsOverlay}
                tabIndex={-1}
              >
                <div className={styles.participantsCard}>
                  <div className={styles.participantsHeader}>
                    <div className={styles.participantsTitle}>參加名單</div>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setParticipantsOpen(false)}
                    >
                      關閉
                    </button>
                  </div>

                  <div className={styles.participantsBody}>
                    {participantsLoading && (
                      <div
                        className={`${styles.statusRow} ${styles.marginBottom12}`}
                        role="status"
                        aria-live="polite"
                      >
                        <div className={styles.spinner} aria-hidden="true" />
                        <span>正在載入參加名單…</span>
                      </div>
                    )}

                    {participantsError && (
                      <div className={styles.errorCard} role="alert">
                        {participantsError}
                        <button
                          type="button"
                          className={`${styles.retryButton} ${styles.marginLeft10}`}
                          onClick={refreshParticipants}
                        >
                          重試
                        </button>
                      </div>
                    )}

                    {!participantsLoading && !participantsError && participants.length === 0 ? (
                      <div className={styles.emptyHint}>目前還沒有人報名</div>
                    ) : (
                      <div className={styles.participantsList}>
                        {participants.map((p) => (
                          <div key={String(p.uid || p.id)} className={styles.participantItem}>
                            <UserLink
                              uid={String(p.uid || p.id)}
                              name={p.name || '（未命名）'}
                              photoURL={p.photoURL}
                              size={36}
                              className={styles.participantLink}
                            />
                            <div className={styles.participantStatus}>已參加</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 編輯活動 overlay */}
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

      {/* 刪除確認 overlay */}
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
