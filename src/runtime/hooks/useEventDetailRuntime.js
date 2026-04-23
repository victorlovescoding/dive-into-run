'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import { toMs, toNumber } from '@/runtime/events/event-runtime-helpers';
import {
  buildUserPayload,
  getRemainingSeats,
  isDeadlinePassed,
  normalizeRoutePolylines,
} from '@/service/event-service';
import {
  deleteEvent,
  EVENT_NOT_FOUND_MESSAGE,
  fetchEventById,
  fetchMyJoinedEventsForIds,
  fetchParticipants,
  joinEvent,
  leaveEvent,
  updateEvent,
} from '@/runtime/client/use-cases/event-use-cases';
import {
  notifyEventCancelled,
  notifyEventModified,
  notifyEventNewComment,
} from '@/runtime/client/use-cases/notification-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
/**
 * @typedef {import('@/service/event-service').EventData} EventData
 */

/**
 * 計算活動狀態。
 * @param {object} params - 活動時間資料。
 * @param {string|object} params.time - 活動時間。
 * @param {string|object} params.registrationDeadline - 報名截止時間。
 * @returns {string} 活動狀態文字。
 */
function computeStatus({ time, registrationDeadline }) {
  const now = Date.now();
  const timeMs = toMs(time);
  const deadlineMs = toMs(registrationDeadline);

  if (timeMs && now >= timeMs) return '活動已開始';
  if (deadlineMs && now >= deadlineMs) return '報名已截止';
  return '報名中';
}

/**
 * 活動詳情頁 runtime orchestration。
 * @param {string} id - 活動 ID。
 * @returns {object} 活動詳情頁 state 與 handlers。
 */
export default function useEventDetailRuntime(id) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();

  const [event, setEvent] = useState(
    /** @type {EventData | null} */ (null),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState(null);
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const participantsOverlayRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const [pending, setPending] = useState(/** @type {'joining' | 'leaving' | null} */ (null));
  const [editingEvent, setEditingEvent] = useState(
    /** @type {EventData | null} */ (null),
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(/** @type {string | null} */ (null));
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const actor = useMemo(() => {
    if (!user?.uid) return null;
    return {
      uid: user.uid,
      name: user.name || '',
      photoURL: user.photoURL || '',
    };
  }, [user]);

  const refreshParticipants = useCallback(async () => {
    if (!id) return;

    if (isMountedRef.current) {
      setParticipantsLoading(true);
      setParticipantsError(null);
    }

    try {
      const list = await fetchParticipants(id, 200);
      if (!isMountedRef.current) return;
      setParticipants(Array.isArray(list) ? list : []);
    } catch (refreshError) {
      console.error('讀取參加名單失敗:', refreshError);
      if (!isMountedRef.current) return;
      setParticipantsError('讀取參加名單失敗，請稍後再試');
    } finally {
      if (isMountedRef.current) {
        setParticipantsLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    /** 載入活動詳情資料。 */
    async function run() {
      if (!id) {
        if (!cancelled && isMountedRef.current) {
          setEvent(null);
          setError('找不到這個活動（可能已被刪除）');
          setLoading(false);
        }
        return;
      }

      if (!cancelled && isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await fetchEventById(id);
        if (cancelled || !isMountedRef.current) return;

        if (!data) {
          setEvent(null);
          setError('找不到這個活動（可能已被刪除）');
          return;
        }

        setEvent(
          /** @type {EventData} */ (/** @type {unknown} */ (data)),
        );
      } catch (loadError) {
        console.error('讀取活動詳情失敗:', loadError);
        if (!cancelled && isMountedRef.current) {
          setError('讀取活動詳情失敗，請稍後再試');
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);

  useEffect(() => {
    let cancelled = false;

    /** 查詢目前使用者是否已參加此活動。 */
    async function run() {
      setIsJoined(false);
      if (!user?.uid || !id) return;

      try {
        const joinedIds = await fetchMyJoinedEventsForIds(user.uid, [String(id)]);
        if (cancelled || !isMountedRef.current) return;
        setIsJoined(joinedIds instanceof Set ? joinedIds.has(String(id)) : false);
      } catch (joinedError) {
        console.error('查詢是否已參加失敗:', joinedError);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [id, user?.uid]);

  const hasOverlay = isParticipantsOpen || editingEvent !== null || deletingEventId !== null;

  useEffect(() => {
    if (!hasOverlay) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOverlay]);

  const handleCloseParticipants = useCallback(() => {
    setParticipantsOpen(false);
  }, []);

  useEffect(() => {
    if (!isParticipantsOpen) return undefined;

    const overlay = participantsOverlayRef.current;

    /**
     * participants overlay backdrop click handler。
     * @param {MouseEvent} eventObject - 原生滑鼠事件。
     */
    function handleClick(eventObject) {
      if (eventObject.target === overlay) {
        handleCloseParticipants();
      }
    }

    /**
     * participants overlay escape handler。
     * @param {KeyboardEvent} eventObject - 原生鍵盤事件。
     */
    function handleKeyDown(eventObject) {
      if (eventObject.key === 'Escape') {
        handleCloseParticipants();
      }
    }

    overlay?.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      overlay?.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCloseParticipants, isParticipantsOpen]);

  const handleOpenParticipants = useCallback(async () => {
    setParticipantsOpen(true);
    await refreshParticipants();
  }, [refreshParticipants]);

  const handleEditEvent = useCallback(
    /**
     * 開啟編輯表單。
     * @param {EventData} nextEvent - 活動資料。
     */
    (nextEvent) => {
      setEditingEvent(/** @type {EventData} */ (nextEvent));
    },
    [],
  );

  const handleEditCancel = useCallback(() => {
    setEditingEvent(null);
  }, []);

  const handleEditSubmit = useCallback(
    /**
     * 提交活動編輯更新。
     * @param {{ id: string, [key: string]: unknown }} changedData - 含 id 與變更欄位的物件。
     * @returns {Promise<void>}
     */
    async (changedData) => {
      const { id: eventId, ...fields } = changedData;

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

        if (actor) {
          notifyEventModified(String(eventId), event?.title || '', actor).catch((notifyError) => {
            console.error('通知建立失敗:', notifyError);
            showToast('通知發送失敗', 'error');
          });
        }

        if (!isMountedRef.current) return;

        const mergedFields = { ...fields };
        if (typeof mergedFields.time === 'string' && mergedFields.time) {
          mergedFields.time = createFirestoreTimestamp(new Date(mergedFields.time));
        }
        if (
          typeof mergedFields.registrationDeadline === 'string' &&
          mergedFields.registrationDeadline
        ) {
          mergedFields.registrationDeadline = createFirestoreTimestamp(
            new Date(/** @type {string} */ (mergedFields.registrationDeadline)),
          );
        }

        setEvent((previous) => {
          if (!previous) return previous;
          const updatedEvent = { ...previous, ...mergedFields };
          if ('route' in mergedFields && mergedFields.route === null) {
            delete updatedEvent.route;
          }
          return updatedEvent;
        });
        setEditingEvent(null);
        showToast('更新活動成功');
      } catch (updateError) {
        console.error('更新活動失敗:', updateError);
        if (isMountedRef.current) {
          showToast('更新活動失敗，請稍後再試', 'error');
        }
      } finally {
        if (isMountedRef.current) {
          setIsUpdating(false);
        }
      }
    },
    [actor, editingEvent, event?.title, showToast],
  );

  const handleDeleteEventRequest = useCallback(
    /**
     * 開啟刪除確認對話框。
     * @param {EventData} nextEvent - 活動資料。
     */
    (nextEvent) => {
      setDeletingEventId(String(nextEvent.id));
    },
    [],
  );

  const handleDeleteCancel = useCallback(() => {
    setDeletingEventId(null);
  }, []);

  const handleDeleteConfirm = useCallback(
    /**
     * 確認刪除活動，成功後導回活動列表。
     * @param {string} eventId - 要刪除的活動 ID。
     * @returns {Promise<void>}
     */
    async (eventId) => {
      if (!actor) {
        showToast('刪除活動前請先登入', 'error');
        return;
      }

      setIsDeletingEvent(true);
      try {
        const currentParticipants = await fetchParticipants(String(eventId));
        await notifyEventCancelled(String(eventId), event?.title || '', currentParticipants, actor);
        await deleteEvent(String(eventId));

        if (!isMountedRef.current) return;
        setDeletingEventId(null);
        router.push('/events?toast=活動已刪除');
      } catch (deleteError) {
        if (deleteError instanceof Error && deleteError.message === EVENT_NOT_FOUND_MESSAGE) {
          console.warn('Delete event skipped: already deleted by another session');
          if (!isMountedRef.current) return;
          setDeletingEventId(null);
          setEvent(null);
          setError('找不到這個活動（可能已被刪除）');
          return;
        }

        console.error('刪除活動失敗:', deleteError);
        if (isMountedRef.current) {
          showToast('刪除活動失敗，請稍後再試', 'error');
        }
      } finally {
        if (isMountedRef.current) {
          setIsDeletingEvent(false);
        }
      }
    },
    [actor, event?.title, router, showToast],
  );

  const handleCommentAdded = useCallback(
    /**
     * 處理新留言通知：留言建立後觸發活動留言通知。
     * @param {string} commentId - 新留言 ID。
     */
    (commentId) => {
      if (!event || !actor) return;
      notifyEventNewComment(String(id), event.title, event.hostUid, commentId, actor).catch(
        (notifyError) => {
          console.error('活動留言通知失敗:', notifyError);
        },
      );
    },
    [actor, event, id],
  );

  const handleJoin = useCallback(async () => {
    if (!event || !user?.uid) {
      showToast('加入活動前請先登入', 'error');
      return;
    }
    if (event.hostUid === user.uid) return;

    const payload = buildUserPayload(user);
    if (!payload) return;

    setPending('joining');

    try {
      const result = await joinEvent(String(id), payload);
      if (!isMountedRef.current) return;

      if (result?.ok && (result.status === 'joined' || result.status === 'already_joined')) {
        setIsJoined(true);

        if (result.status === 'joined') {
          setEvent((previous) => {
            if (!previous) return previous;
            const previousCount = toNumber(previous.participantsCount ?? participants.length);
            const previousRemaining = getRemainingSeats(previous, participants.length);
            return {
              ...previous,
              participantsCount: previousCount + 1,
              remainingSeats: Math.max(0, previousRemaining - 1),
            };
          });

          setParticipants((previous) => {
            const uid = String(user.uid);
            if (previous.some((participant) => String(participant.uid) === uid)) {
              return previous;
            }
            return [
              {
                id: uid,
                uid,
                name: payload.name,
                photoURL: payload.photoURL,
                eventId: String(id),
              },
              ...previous,
            ];
          });
        }

        showToast('報名成功');
      } else if (result?.ok === false && result.status === 'full') {
        showToast('本活動已額滿', 'error');
        setEvent((previous) => (previous ? { ...previous, remainingSeats: 0 } : previous));
      } else {
        showToast('報名失敗，請再試一次', 'error');
      }
    } catch (joinError) {
      console.error('參加活動失敗:', joinError);
      if (isMountedRef.current) {
        showToast('報名失敗，請再試一次', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setPending(null);
      }
    }
  }, [event, id, participants.length, showToast, user]);

  const handleLeave = useCallback(async () => {
    if (!user?.uid) return;

    const payload = buildUserPayload(user);
    if (!payload) return;

    setPending('leaving');

    try {
      const result = await leaveEvent(String(id), payload);
      if (!isMountedRef.current) return;

      if (result?.ok && (result.status === 'left' || result.status === 'not_joined')) {
        setIsJoined(false);
        setEvent((previous) => {
          if (!previous) return previous;
          const maxParticipants = toNumber(previous.maxParticipants);
          const previousCount = toNumber(previous.participantsCount ?? participants.length);
          const previousRemaining = getRemainingSeats(previous, participants.length);
          return {
            ...previous,
            participantsCount: Math.max(0, previousCount - 1),
            remainingSeats: Math.min(maxParticipants, previousRemaining + 1),
          };
        });

        setParticipants((previous) =>
          previous.filter((participant) => String(participant.uid) !== String(user.uid)),
        );

        showToast('已成功取消報名');
      } else {
        showToast('發生錯誤，請再重新取消報名', 'error');
      }
    } catch (leaveError) {
      console.error('退出活動失敗:', leaveError);
      if (isMountedRef.current) {
        showToast('發生錯誤，請再重新取消報名', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setPending(null);
      }
    }
  }, [id, participants.length, showToast, user]);

  const statusText = useMemo(() => {
    if (!event) return '';
    return computeStatus({
      time: event.time,
      registrationDeadline: event.registrationDeadline,
    });
  }, [event]);

  const routePolylines = useMemo(() => normalizeRoutePolylines(event?.route), [event?.route]);
  const hasRoute = routePolylines.length > 0;
  const routePointCount = useMemo(() => {
    if (typeof event?.route?.pointsCount === 'number') {
      return event.route.pointsCount;
    }
    return routePolylines.flat().length;
  }, [event?.route?.pointsCount, routePolylines]);
  const remainingSeats = useMemo(
    () => getRemainingSeats(event, participants.length),
    [event, participants.length],
  );

  const participationState = useMemo(() => {
    if (!event) return 'unavailable';
    if (!user?.uid) return 'login_required';
    if (event.hostUid === user.uid) return 'host';
    if (isJoined) return 'joined';
    if (remainingSeats <= 0) return 'full';
    if (isDeadlinePassed(event)) return 'deadline_passed';
    return 'can_join';
  }, [event, isJoined, remainingSeats, user?.uid]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return `/events/${id}`;
    }
    return `${window.location.origin}/events/${id}`;
  }, [id]);

  return {
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
  };
}
