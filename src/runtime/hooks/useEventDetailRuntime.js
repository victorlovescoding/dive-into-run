'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toMs } from '@/runtime/events/event-runtime-helpers';
import { normalizeRoutePolylines } from '@/service/event-service';
import { fetchEventById } from '@/runtime/client/use-cases/event-use-cases';
import {
  addContentFavorite,
  FAVORITE_CONTENT_TYPES,
  getFavoritedTargetIds,
  removeContentFavorite,
} from '@/runtime/client/use-cases/content-favorite-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import useEventDetailParticipation from '@/runtime/hooks/useEventDetailParticipation';
import useEventDetailMutations from '@/runtime/hooks/useEventDetailMutations';
import useFavoriteLoginContinuation from '@/runtime/hooks/useFavoriteLoginContinuation';
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

  const [event, setEvent] = useState(/** @type {EventData | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavoriteEvent, setIsFavoriteEvent] = useState(false);
  const [isTogglingFavoriteEvent, setIsTogglingFavoriteEvent] = useState(false);

  const isMountedRef = useRef(false);
  const favoriteEventMutationVersionRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const activeEventId = event && String(event.id) === String(id) ? String(id) : '';

  const {
    participants,
    participantsLoading,
    participantsError,
    isParticipantsOpen,
    participantsOverlayRef,
    pending,
    remainingSeats,
    participationState,
    refreshParticipants,
    handleJoin,
    handleLeave,
    handleOpenParticipants,
    handleCloseParticipants,
  } = useEventDetailParticipation({
    id: activeEventId,
    event,
    setEvent,
    user,
    showToast,
    isMountedRef,
  });

  const {
    editingEvent,
    isUpdating,
    deletingEventId,
    isDeletingEvent,
    handleEditEvent,
    handleEditCancel,
    handleEditSubmit,
    handleDeleteEventRequest,
    handleDeleteCancel,
    handleDeleteConfirm,
    handleCommentAdded,
  } = useEventDetailMutations({
    id,
    event,
    setEvent,
    setError,
    router,
    user,
    showToast,
    isMountedRef,
  });

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

        setEvent(/** @type {EventData} */ (/** @type {unknown} */ (data)));
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
    const uid = user?.uid;
    if (!uid || !id) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setIsFavoriteEvent(false);
      });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;

    /** 同步目前活動詳情的收藏狀態。 */
    async function refreshFavoriteState() {
      const syncMutationVersion = favoriteEventMutationVersionRef.current;
      try {
        const ids = await getFavoritedTargetIds({
          uid,
          type: FAVORITE_CONTENT_TYPES.EVENT,
          targetIds: [id],
        });
        if (
          !cancelled
          && isMountedRef.current
          && syncMutationVersion === favoriteEventMutationVersionRef.current
        ) {
          setIsFavoriteEvent(ids.has(id));
        }
      } catch (favoriteError) {
        console.error('載入活動收藏狀態失敗:', favoriteError);
        if (
          !cancelled
          && isMountedRef.current
          && syncMutationVersion === favoriteEventMutationVersionRef.current
        ) {
          setIsFavoriteEvent(false);
        }
      }
    }

    refreshFavoriteState();
    return () => {
      cancelled = true;
    };
  }, [id, user?.uid]);

  const handleContinuationFavoriteAdded = useCallback(({ contentType, targetId }) => {
    if (contentType !== FAVORITE_CONTENT_TYPES.EVENT) return;
    if (String(targetId) !== String(id)) return;
    favoriteEventMutationVersionRef.current += 1;
    setIsFavoriteEvent(true);
  }, [id]);

  const {
    dialogState,
    openContinuation,
    confirmContinuation,
    cancelContinuation,
    closeContinuation,
  } = useFavoriteLoginContinuation({
    showToast,
    onFavoriteAdded: handleContinuationFavoriteAdded,
  });

  const handleToggleFavoriteEvent = useCallback(async () => {
    if (!id || isTogglingFavoriteEvent) return;

    const uid = user?.uid;
    if (!uid) {
      openContinuation({ contentType: FAVORITE_CONTENT_TYPES.EVENT, targetId: id });
      return;
    }

    const wasFavorite = isFavoriteEvent;
    favoriteEventMutationVersionRef.current += 1;
    setIsTogglingFavoriteEvent(true);
    setIsFavoriteEvent(!wasFavorite);

    try {
      if (wasFavorite) {
        await removeContentFavorite({ uid, type: FAVORITE_CONTENT_TYPES.EVENT, targetId: id });
        showToast('已取消收藏', 'success');
      } else {
        await addContentFavorite({ uid, type: FAVORITE_CONTENT_TYPES.EVENT, targetId: id });
        showToast('已加入收藏', 'success');
      }
    } catch (favoriteError) {
      console.error('切換活動收藏失敗:', favoriteError);
      favoriteEventMutationVersionRef.current += 1;
      setIsFavoriteEvent(wasFavorite);
      showToast(
        wasFavorite ? '取消收藏失敗，請稍後再試' : '收藏失敗，請稍後再試',
        'error',
      );
    } finally {
      if (isMountedRef.current) {
        setIsTogglingFavoriteEvent(false);
      }
    }
  }, [id, isFavoriteEvent, isTogglingFavoriteEvent, openContinuation, showToast, user?.uid]);

  const hasOverlay = isParticipantsOpen || editingEvent !== null || deletingEventId !== null;

  useEffect(() => {
    if (!hasOverlay) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOverlay]);

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
    isFavoriteEvent: id ? isFavoriteEvent : false,
    isTogglingFavoriteEvent,
    dialogState,
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
    handleToggleFavoriteEvent,
    confirmContinuation,
    cancelContinuation,
    closeContinuation,
  };
}
