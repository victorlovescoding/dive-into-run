'use client';

/* eslint-disable max-lines -- Detail runtime composes multiple owned hooks and already exceeds the file cap. */

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
import {
  followRunner,
  getRunnerFollowStatus,
  unfollowRunner,
} from '@/runtime/client/use-cases/follow-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import useEventDetailParticipation from '@/runtime/hooks/useEventDetailParticipation';
import useEventDetailMutations from '@/runtime/hooks/useEventDetailMutations';
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
 * 建立 follow use-case 需要的 actor profile。
 * @param {{ uid: string, name?: string | null, displayName?: string | null, email?: string | null, photoURL?: string | null }} user - Auth user。
 * @returns {{ uid: string, name: string, photoURL: string }} Follow actor。
 */
function toFollowActor(user) {
  const fallbackName = user.email ? user.email.split('@')[0] : '跑友';
  return {
    uid: user.uid,
    name: user.name || user.displayName || fallbackName,
    photoURL: user.photoURL || '',
  };
}

/**
 * 建立活動主揪 target profile。
 * @param {NonNullable<import('@/service/event-service').EventData>} event - 活動資料。
 * @returns {{ uid: string, name: string, photoURL: string }} Follow target。
 */
function toHostFollowTarget(event) {
  return {
    uid: String(event.hostUid || ''),
    name: event.hostName || '跑友',
    photoURL: event.hostPhotoURL || '',
  };
}

/**
 * 依 follow 狀態建立按鈕 label。
 * @param {boolean} isFollowing - 是否追蹤中。
 * @param {boolean} isPending - 是否等待 mutation。
 * @returns {string} Follow button label。
 */
function buildFollowLabel(isFollowing, isPending) {
  if (isPending && !isFollowing) return '取消中...';
  return isFollowing ? '追蹤中' : '追蹤';
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
  const [isFollowingHost, setIsFollowingHost] = useState(false);
  const [isTogglingHostFollow, setIsTogglingHostFollow] = useState(false);

  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
  } = useEventDetailParticipation({ id, event, setEvent, user, showToast, isMountedRef });

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
      setIsFavoriteEvent(false);
      return undefined;
    }

    let cancelled = false;

    /** 同步目前活動詳情的收藏狀態。 */
    async function refreshFavoriteState() {
      try {
        const ids = await getFavoritedTargetIds({
          uid,
          type: FAVORITE_CONTENT_TYPES.EVENT,
          targetIds: [id],
        });
        if (!cancelled && isMountedRef.current) {
          setIsFavoriteEvent(ids.has(id));
        }
      } catch (favoriteError) {
        console.error('載入活動收藏狀態失敗:', favoriteError);
        if (!cancelled && isMountedRef.current) {
          setIsFavoriteEvent(false);
        }
      }
    }

    refreshFavoriteState();
    return () => {
      cancelled = true;
    };
  }, [id, user?.uid]);

  useEffect(() => {
    const followerUid = user?.uid;
    const targetUid = event?.hostUid;
    if (!followerUid || !targetUid || followerUid === targetUid) {
      setIsFollowingHost(false);
      setIsTogglingHostFollow(false);
      return undefined;
    }

    let cancelled = false;

    /** 同步目前活動主揪的追蹤狀態。 */
    async function refreshHostFollowState() {
      try {
        const status = await getRunnerFollowStatus({ followerUid, targetUid });
        if (!cancelled && isMountedRef.current) {
          setIsFollowingHost(status);
        }
      } catch (followError) {
        console.error('載入活動主揪追蹤狀態失敗:', followError);
        if (!cancelled && isMountedRef.current) {
          setIsFollowingHost(false);
        }
      }
    }

    refreshHostFollowState();
    return () => {
      cancelled = true;
    };
  }, [event?.hostUid, user?.uid]);

  const handleToggleFavoriteEvent = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      showToast('請先登入才能收藏', 'info');
      return;
    }
    if (!id || isTogglingFavoriteEvent) return;

    const wasFavorite = isFavoriteEvent;
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
  }, [id, isFavoriteEvent, isTogglingFavoriteEvent, showToast, user?.uid]);

  const handleToggleHostFollow = useCallback(async () => {
    const currentUser = user;
    const targetUid = event?.hostUid;
    if (!currentUser?.uid) {
      showToast('請先登入才能追蹤', 'info');
      return;
    }
    if (!event || !targetUid || targetUid === currentUser.uid || isTogglingHostFollow) {
      return;
    }

    const wasFollowing = isFollowingHost;
    const nextFollowing = !wasFollowing;

    setIsTogglingHostFollow(true);
    setIsFollowingHost(nextFollowing);

    try {
      const result = nextFollowing
        ? await followRunner({
            follower: toFollowActor(currentUser),
            target: toHostFollowTarget(event),
          })
        : await unfollowRunner({ followerUid: currentUser.uid, targetUid });

      setIsFollowingHost(result.following);
      showToast(nextFollowing ? '已開始追蹤' : '已取消追蹤', 'success');
    } catch (followError) {
      console.error('切換活動主揪追蹤狀態失敗:', followError);
      setIsFollowingHost(wasFollowing);
      showToast(
        nextFollowing ? '追蹤失敗，請稍後再試。' : '取消追蹤失敗，請稍後再試。',
        'error',
      );
    } finally {
      if (isMountedRef.current) {
        setIsTogglingHostFollow(false);
      }
    }
  }, [event, isFollowingHost, isTogglingHostFollow, showToast, user]);

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
  const hostFollowControl = useMemo(() => {
    const isVisible = Boolean(user?.uid && event?.hostUid && user.uid !== event.hostUid);
    const label = buildFollowLabel(isFollowingHost, isTogglingHostFollow);

    return {
      isVisible,
      isFollowing: isVisible ? isFollowingHost : false,
      isPending: isVisible ? isTogglingHostFollow : false,
      label: isVisible ? label : '追蹤',
      onToggle: handleToggleHostFollow,
    };
  }, [
    event?.hostUid,
    handleToggleHostFollow,
    isFollowingHost,
    isTogglingHostFollow,
    user?.uid,
  ]);

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
    isFavoriteEvent,
    isTogglingFavoriteEvent,
    hostFollowControl,
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
    handleToggleHostFollow,
  };
}
