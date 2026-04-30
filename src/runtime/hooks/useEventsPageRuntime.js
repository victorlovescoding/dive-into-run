'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getRemainingSeats } from '@/service/event-service';
import { fetchLatestEvents, fetchNextEvents } from '@/runtime/client/use-cases/event-use-cases';
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
    events,
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
    sentinelRef,
    selectedDistrictOptions,
    getRemainingSeats,
    setSelectedDistrict,
    setRouteCoordinates,
    handleSelectedCityChange,
    handleEnableRoutePlanning,
    handleDisableRoutePlanning,
    handleToggleCreateRunForm,
    handleCloseCreateForm,
    loadMore,
    ...filterState,
    ...participationState,
    ...mutationState,
  };
}
