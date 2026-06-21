/* eslint-disable max-lines -- Events page runtime coordinates list, filters, create form, participation, and favorite continuation. */
'use client';

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
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import useEventsFilter from '@/runtime/hooks/useEventsFilter';
import useEventsPageCreateFormState from '@/runtime/hooks/useEventsPageCreateFormState';
import useEventMutations from '@/runtime/hooks/useEventMutations';
import useEventParticipation from '@/runtime/hooks/useEventParticipation';
import useFavoriteLoginContinuation from '@/runtime/hooks/useFavoriteLoginContinuation';
import createContentFavoriteSuccessActions from '@/runtime/hooks/content-favorite-toast-actions';
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
  const favoriteEventMutationVersionRef = useRef(0);
  const sentinelRef = useRef(null);
  const isMountedRef = useRef(false);

  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hostName = user?.name || (user?.email ? user.email.split('@')[0] : '');
  const {
    isFormOpen,
    routeCoordinates,
    resetCreateForm,
    handleToggleCreateRunForm: toggleCreateRunForm,
    ...createFormScreenState
  } = useEventsPageCreateFormState({ showToast });

  const loadLatestPage = useCallback(async ({ replaceExisting = false } = {}) => {
    if (isMountedRef.current) {
      setIsLoadingEvents(true);
      setLoadError(null);
    }

    try {
      const page = await fetchLatestEvents(10);
      const { events: latest, lastDoc } = page;
      if (!isMountedRef.current) return;

      setEvents((previous) => (replaceExisting ? latest : mergeEventsById(previous, latest)));
      setCursor(lastDoc);
      setHasMore(page.hasMore);
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

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || visibleEventIds.length === 0) {
      let cancelled = false;
      queueMicrotask(() => { if (!cancelled) setFavoriteEventIds(new Set()); });
      return () => { cancelled = true; };
    }

    let cancelled = false;

    /** 依目前可見活動 ID 批次同步收藏狀態。 */
    async function refreshFavoriteEventIds() {
      const syncMutationVersion = favoriteEventMutationVersionRef.current;
      try {
        const ids = await getFavoritedTargetIds({
          uid,
          type: FAVORITE_CONTENT_TYPES.EVENT,
          targetIds: visibleEventIds,
        });
        if (
          !cancelled
          && isMountedRef.current
          && syncMutationVersion === favoriteEventMutationVersionRef.current
        ) {
          setFavoriteEventIds(ids);
        }
      } catch (error) {
        const isPermissionDenied =
          error && typeof error === 'object'
          && /** @type {{ code?: unknown }} */ (error).code === 'permission-denied';
        if (
          isPermissionDenied
          && !cancelled
          && isMountedRef.current
          && syncMutationVersion === favoriteEventMutationVersionRef.current
        ) {
          setFavoriteEventIds(new Set());
        }
        if (isPermissionDenied) return;
        console.error('載入活動收藏狀態失敗:', error);
      }
    }

    refreshFavoriteEventIds();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, visibleEventIdKey, visibleEventIds]);

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

  const handleContinuationFavoriteAdded = useCallback(({ contentType, targetId }) => {
    if (contentType !== FAVORITE_CONTENT_TYPES.EVENT) return;
    favoriteEventMutationVersionRef.current += 1;
    setFavoriteEventIds((previous) => {
      const next = new Set(previous);
      next.add(targetId);
      return next;
    });
  }, []);

  const handleContinuationFavoriteUndone = useCallback(({ contentType, targetId }) => {
    if (contentType !== FAVORITE_CONTENT_TYPES.EVENT) return;
    favoriteEventMutationVersionRef.current += 1;
    setFavoriteEventIds((previous) => {
      const next = new Set(previous);
      next.delete(targetId);
      return next;
    });
  }, []);

  const getFavoriteAddedToastActions = useCallback(
    ({ contentType, targetId, uid }) => {
      if (contentType !== FAVORITE_CONTENT_TYPES.EVENT || !uid) return [];
      return createContentFavoriteSuccessActions({
        router,
        uid,
        type: FAVORITE_CONTENT_TYPES.EVENT,
        targetId,
        onUndoSuccess: () => {
          handleContinuationFavoriteUndone({ contentType, targetId });
        },
        showToast,
      });
    },
    [handleContinuationFavoriteUndone, router, showToast],
  );

  const {
    dialogState,
    openContinuation,
    confirmContinuation,
    cancelContinuation,
    closeContinuation,
  } = useFavoriteLoginContinuation({
    showToast,
    onFavoriteAdded: handleContinuationFavoriteAdded,
    getFavoriteAddedToastActions,
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
      if (!targetId) return;

      const uid = user?.uid;
      if (!uid) {
        openContinuation({ contentType: FAVORITE_CONTENT_TYPES.EVENT, targetId });
        return;
      }

      const wasFavorite = favoriteEventIds.has(targetId);
      favoriteEventMutationVersionRef.current += 1;
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
          showToast('已加入收藏', 'success', createContentFavoriteSuccessActions({
            router,
            uid,
            type: FAVORITE_CONTENT_TYPES.EVENT,
            targetId,
            onUndoSuccess: () => {
              favoriteEventMutationVersionRef.current += 1;
              setFavoriteEventIds((previous) => {
                const next = new Set(previous);
                next.delete(targetId);
                return next;
              });
            },
            showToast,
          }));
        }
      } catch (error) {
        console.error('切換活動收藏失敗:', error);
        favoriteEventMutationVersionRef.current += 1;
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
    [favoriteEventIds, openContinuation, router, showToast, user?.uid],
  );

  const loadMore = useCallback(async () => {
    if (isFormOpen || mutationState.isCreating) return;
    if (!hasMore || !cursor || isLoadingEvents || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const page = await fetchNextEvents(cursor, 10);
      const { events: nextEvents, lastDoc } = page;
      if (!isMountedRef.current) return;
      setEvents((previous) => mergeEventsById(previous, nextEvents));
      setCursor(lastDoc);
      setHasMore(page.hasMore);
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
    events,
    hostName,
    isFormOpen,
    routeCoordinates,
    ...createFormScreenState,
    isLoadingEvents,
    loadError,
    isLoadingMore,
    loadMoreError,
    hasMore,
    favoriteEventIds: visibleEventIds.length > 0 ? favoriteEventIds : new Set(),
    dialogState,
    sentinelRef,
    getRemainingSeats,
    handleToggleCreateRunForm,
    handleToggleFavoriteEvent,
    confirmContinuation,
    cancelContinuation,
    closeContinuation,
    loadMore,
    ...filterState,
    ...participationState,
    ...mutationState,
  };
}
