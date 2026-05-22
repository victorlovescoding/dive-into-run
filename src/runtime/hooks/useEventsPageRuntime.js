'use client';

/* eslint-disable max-lines -- Existing page runtime orchestration exceeds the project file-length cap. */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getRemainingSeats } from '@/service/event-service';
import { fetchLatestEvents, fetchNextEvents } from '@/runtime/client/use-cases/event-use-cases';
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
import useEventsFilter from '@/runtime/hooks/useEventsFilter';
import useEventsPageCreateFormState from '@/runtime/hooks/useEventsPageCreateFormState';
import useEventMutations from '@/runtime/hooks/useEventMutations';
import useEventParticipation from '@/runtime/hooks/useEventParticipation';
/**
 * @typedef {import('@/service/event-service').EventData} EventData
 */

/**
 * @typedef {object} MergeableEvent
 * @property {string} [id] - 活動識別碼。
 */

/**
 * 依 event id 合併列表，保留第一次出現的項目順序。
 * @template {MergeableEvent} T
 * @param {T[]} current - 既有列表。
 * @param {T[]} incoming - 新列表。
 * @returns {T[]} 合併後列表。
 */
const mergeEventsById = (current, incoming) => {
  const map = new Map();
  [...current, ...incoming].forEach((event) => {
    if (event?.id && !map.has(event.id)) {
      map.set(event.id, event);
    }
  });
  return Array.from(map.values());
};

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
 * @param {object} event - 活動資料。
 * @param {string} event.hostUid - 主揪 UID。
 * @param {string} [event.hostName] - 主揪名稱。
 * @param {string} [event.hostPhotoURL] - 主揪頭像。
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
 * events page runtime orchestration。
 * @returns {object} events page runtime state and handlers。
 */
export default function useEventsPageRuntime() {
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [favoriteEventIds, setFavoriteEventIds] = useState(() => new Set());
  const [hostFollowStatusByUid, setHostFollowStatusByUid] = useState(() => ({}));
  const [hostFollowPendingByUid, setHostFollowPendingByUid] = useState(() => ({}));
  const sentinelRef = useRef(null);
  const isMountedRef = useRef(false);

  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hostName = user?.name || (user?.email ? user.email.split('@')[0] : '');
  const {
    isFormOpen,
    showMap,
    routeCoordinates,
    routePointCount,
    selectedCity,
    selectedDistrict,
    selectedDistrictOptions,
    minDateTime,
    setSelectedDistrict,
    setRouteCoordinates,
    resetCreateForm,
    handleCloseCreateForm,
    handleSelectedCityChange,
    handleEnableRoutePlanning,
    handleDisableRoutePlanning,
    handleToggleCreateRunForm: toggleCreateRunForm,
  } = useEventsPageCreateFormState({ showToast });

  const loadLatestPage = useCallback(async ({ replaceExisting = false } = {}) => {
    if (isMountedRef.current) {
      setIsLoadingEvents(true);
      setLoadError(null);
    }

    try {
      const { events: latest, lastDoc } = await fetchLatestEvents(10);
      if (!isMountedRef.current) return;

      setEvents((previous) => (replaceExisting ? latest : mergeEventsById(previous, latest)));
      setCursor(lastDoc);
      setHasMore(latest.length === 10 && Boolean(lastDoc));
      setLoadMoreError(null);
    } catch (error) {
      console.error('載入活動失敗:', error);
      if (!isMountedRef.current) return;
      setLoadError('載入活動失敗，請稍後再試');
    } finally {
      if (isMountedRef.current) {
        setIsLoadingEvents(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const filterState = useEventsFilter({
    isFormOpen,
    isMountedRef,
    setEvents,
    setCursor,
    setLoadError,
    setLoadMoreError,
    setHasMore,
    loadLatestPage,
  });

  useEffect(() => {
    if (!isFormOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFormOpen]);

  useEffect(() => {
    const toastMessage = searchParams.get('toast');
    if (toastMessage) {
      showToast(toastMessage);
      router.replace('/events', { scroll: false });
    }
  }, [router, searchParams, showToast]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await loadLatestPage();
    })();

    return () => {
      cancelled = true;
    };
  }, [loadLatestPage]);

  const participationState = useEventParticipation({
    user,
    events,
    isMountedRef,
    setEvents,
    showToast,
  });

  const visibleEventIds = useMemo(
    () => events.map((event) => String(event?.id || '')).filter(Boolean),
    [events],
  );
  const visibleEventIdKey = visibleEventIds.join('\n');
  const visibleFollowableHostUids = useMemo(() => {
    const currentUid = user?.uid;
    if (!currentUid) return [];

    const uids = new Set();
    events.forEach((event) => {
      const hostUid = String(event?.hostUid || '').trim();
      if (hostUid && hostUid !== currentUid) {
        uids.add(hostUid);
      }
    });
    return Array.from(uids);
  }, [events, user?.uid]);
  const visibleFollowableHostUidKey = visibleFollowableHostUids.join('\n');

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || visibleEventIds.length === 0) {
      setFavoriteEventIds(new Set());
      return undefined;
    }

    let cancelled = false;

    /** 依目前可見活動 ID 批次同步收藏狀態。 */
    async function refreshFavoriteEventIds() {
      try {
        const ids = await getFavoritedTargetIds({
          uid,
          type: FAVORITE_CONTENT_TYPES.EVENT,
          targetIds: visibleEventIds,
        });
        if (!cancelled && isMountedRef.current) { setFavoriteEventIds(ids); }
      } catch (error) {
        const isPermissionDenied =
          error && typeof error === 'object'
          && /** @type {{ code?: unknown }} */ (error).code === 'permission-denied';
        if (isPermissionDenied && !cancelled && isMountedRef.current) { setFavoriteEventIds(new Set()); }
        if (isPermissionDenied) return;
        console.error('載入活動收藏狀態失敗:', error);
      }
    }

    refreshFavoriteEventIds();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, visibleEventIdKey, visibleEventIds]);

  useEffect(() => {
    const followerUid = user?.uid;
    if (!followerUid || visibleFollowableHostUids.length === 0) {
      setHostFollowStatusByUid({});
      setHostFollowPendingByUid({});
      return undefined;
    }

    let cancelled = false;

    /** 依目前可見主揪 UID 批次同步追蹤狀態。 */
    async function refreshHostFollowState() {
      try {
        const entries = await Promise.all(
          visibleFollowableHostUids.map(async (targetUid) => [
            targetUid,
            await getRunnerFollowStatus({ followerUid, targetUid }),
          ]),
        );

        if (!cancelled && isMountedRef.current) {
          setHostFollowStatusByUid(
            Object.fromEntries(entries.map(([targetUid, isFollowing]) => [targetUid, isFollowing])),
          );
        }
      } catch (error) {
        if (!cancelled && isMountedRef.current) {
          console.error('載入活動主揪追蹤狀態失敗:', error);
          setHostFollowStatusByUid({});
        }
      }
    }

    refreshHostFollowState();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, visibleFollowableHostUidKey, visibleFollowableHostUids]);

  const createCtx = useMemo(
    () => ({
      hostUid: user?.uid || '',
      hostName: hostName || '',
      hostPhotoURL: user?.photoURL || '',
      routeCoordinates,
      resetCreateForm,
    }),
    [hostName, resetCreateForm, routeCoordinates, user?.photoURL, user?.uid],
  );

  const mutationState = useEventMutations({
    isMountedRef,
    setEvents,
    showToast,
    createCtx,
  });

  const handleToggleCreateRunForm = useCallback(() => {
    toggleCreateRunForm({
      draftFormData: mutationState.draftFormData,
      userUid: user?.uid,
    });
  }, [mutationState.draftFormData, toggleCreateRunForm, user?.uid]);

  const handleToggleFavoriteEvent = useCallback(
    async (eventId) => {
      const targetId = String(eventId || '');
      const uid = user?.uid;
      if (!uid) {
        showToast('請先登入才能收藏', 'info');
        return;
      }
      if (!targetId) return;

      const wasFavorite = favoriteEventIds.has(targetId);
      setFavoriteEventIds((previous) => {
        const next = new Set(previous);
        if (wasFavorite) next.delete(targetId);
        else next.add(targetId);
        return next;
      });

      try {
        if (wasFavorite) {
          await removeContentFavorite({ uid, type: FAVORITE_CONTENT_TYPES.EVENT, targetId });
          showToast('已取消收藏', 'success');
        } else {
          await addContentFavorite({ uid, type: FAVORITE_CONTENT_TYPES.EVENT, targetId });
          showToast('已加入收藏', 'success');
        }
      } catch (error) {
        console.error('切換活動收藏失敗:', error);
        setFavoriteEventIds((previous) => {
          const next = new Set(previous);
          if (wasFavorite) next.add(targetId);
          else next.delete(targetId);
          return next;
        });
        showToast(
          wasFavorite ? '取消收藏失敗，請稍後再試' : '收藏失敗，請稍後再試',
          'error',
        );
      }
    },
    [favoriteEventIds, showToast, user?.uid],
  );

  const handleToggleHostFollow = useCallback(
    async (event) => {
      const currentUser = user;
      const targetUid = String(event?.hostUid || '').trim();
      if (!currentUser?.uid) {
        showToast('請先登入才能追蹤', 'info');
        return;
      }
      if (!targetUid || targetUid === currentUser.uid || hostFollowPendingByUid[targetUid]) {
        return;
      }

      const wasFollowing = Boolean(hostFollowStatusByUid[targetUid]);
      const nextFollowing = !wasFollowing;

      setHostFollowPendingByUid((previous) => ({ ...previous, [targetUid]: true }));
      setHostFollowStatusByUid((previous) => ({ ...previous, [targetUid]: nextFollowing }));

      try {
        const result = nextFollowing
          ? await followRunner({
              follower: toFollowActor(currentUser),
              target: toHostFollowTarget(event),
            })
          : await unfollowRunner({ followerUid: currentUser.uid, targetUid });

        setHostFollowStatusByUid((previous) => ({
          ...previous,
          [targetUid]: result.following,
        }));
        showToast(nextFollowing ? '已開始追蹤' : '已取消追蹤', 'success');
      } catch (error) {
        console.error('切換活動主揪追蹤狀態失敗:', error);
        setHostFollowStatusByUid((previous) => ({ ...previous, [targetUid]: wasFollowing }));
        showToast(
          nextFollowing ? '追蹤失敗，請稍後再試。' : '取消追蹤失敗，請稍後再試。',
          'error',
        );
      } finally {
        if (isMountedRef.current) {
          setHostFollowPendingByUid((previous) => ({ ...previous, [targetUid]: false }));
        }
      }
    },
    [hostFollowPendingByUid, hostFollowStatusByUid, showToast, user],
  );

  const hostFollowStateByUid = useMemo(() => {
    if (!user?.uid) return {};

    return Object.fromEntries(
      visibleFollowableHostUids.map((targetUid) => {
        const isFollowing = Boolean(hostFollowStatusByUid[targetUid]);
        const isPending = Boolean(hostFollowPendingByUid[targetUid]);
        return [
          targetUid,
          {
            isVisible: true,
            isFollowing,
            isPending,
            label: buildFollowLabel(isFollowing, isPending),
          },
        ];
      }),
    );
  }, [
    hostFollowPendingByUid,
    hostFollowStatusByUid,
    user?.uid,
    visibleFollowableHostUids,
  ]);

  const eventsWithHostFollowControls = useMemo(
    () =>
      events.map((event) => {
        const hostUid = String(event?.hostUid || '').trim();
        const followState = hostFollowStateByUid[hostUid];
        if (!followState) return event;

        return {
          ...event,
          hostFollowControl: {
            ...followState,
            onToggle: () => handleToggleHostFollow(event),
          },
        };
      }),
    [events, handleToggleHostFollow, hostFollowStateByUid],
  );

  const loadMore = useCallback(async () => {
    if (isFormOpen || mutationState.isCreating) return;
    if (!hasMore || !cursor || isLoadingEvents || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const { events: nextEvents, lastDoc } = await fetchNextEvents(cursor, 10);
      if (!isMountedRef.current) return;
      setEvents((previous) => mergeEventsById(previous, nextEvents));
      setCursor(lastDoc);
      setHasMore(nextEvents.length === 10 && Boolean(lastDoc));
      setLoadMoreError(null);
    } catch (error) {
      console.error('載入更多活動失敗:', error);
      if (!isMountedRef.current) return;
      setLoadMoreError('載入更多活動失敗，請稍後再試');
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [cursor, hasMore, mutationState.isCreating, isFormOpen, isLoadingEvents, isLoadingMore]);

  useEffect(() => {
    const sentinelElement = sentinelRef.current;
    if (!sentinelElement || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: '0px 0px 300px 0px', threshold: 0 },
    );

    observer.observe(sentinelElement);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return {
    user,
    events: eventsWithHostFollowControls,
    hostName,
    isFormOpen,
    showMap,
    routeCoordinates,
    routePointCount,
    selectedCity,
    selectedDistrict,
    minDateTime,
    isLoadingEvents,
    loadError,
    isLoadingMore,
    loadMoreError,
    hasMore,
    favoriteEventIds,
    hostFollowStateByUid,
    sentinelRef,
    selectedDistrictOptions,
    getRemainingSeats,
    setSelectedDistrict,
    setRouteCoordinates,
    handleSelectedCityChange,
    handleEnableRoutePlanning,
    handleDisableRoutePlanning,
    handleToggleCreateRunForm,
    handleToggleFavoriteEvent,
    handleToggleHostFollow,
    handleCloseCreateForm,
    loadMore,
    ...filterState,
    ...participationState,
    ...mutationState,
  };
}
