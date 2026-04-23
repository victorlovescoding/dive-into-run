'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import {
  chunkArray,
  countTotalPoints,
  toMs,
  toNumber,
} from '@/runtime/events/event-runtime-helpers';
import { buildRoutePayload, buildUserPayload, getRemainingSeats } from '@/service/event-service';
import { listTaiwanCities, listTaiwanDistricts } from '@/service/taiwan-location-service';
import {
  createEvent,
  deleteEvent,
  fetchLatestEvents,
  fetchMyJoinedEventsForIds,
  fetchNextEvents,
  joinEvent,
  leaveEvent,
  queryEvents,
  updateEvent,
} from '@/runtime/client/use-cases/event-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
/**
 * @typedef {import('@/service/event-service').EventData} EventData
 */

/**
 * 依 event id 合併列表，保留第一次出現的項目順序。
 * @template {{ id?: string }} T
 * @param {T[]} current - 既有列表。
 * @param {T[]} incoming - 新列表。
 * @returns {T[]} 合併後列表。
 */
function mergeEventsById(current, incoming) {
  const map = new Map();
  [...current, ...incoming].forEach((event) => {
    if (event?.id && !map.has(event.id)) {
      map.set(event.id, event);
    }
  });
  return Array.from(map.values());
}

/**
 * events page runtime orchestration。
 * @returns {object} events page runtime state and handlers。
 */
export default function useEventsPageRuntime() {
  const [isFormOpen, setFormOpen] = useState(false);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [filterTimeStart, setFilterTimeStart] = useState('');
  const [filterTimeEnd, setFilterTimeEnd] = useState('');
  const [filterDistanceMin, setFilterDistanceMin] = useState('');
  const [filterDistanceMax, setFilterDistanceMax] = useState('');
  const [filterHasSeatsOnly, setFilterHasSeatsOnly] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [minDateTime, setMinDateTime] = useState('');
  const [events, setEvents] = useState([]);
  const [isFilteredResults, setIsFilteredResults] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingByEventId, setPendingByEventId] = useState({});
  const [myJoinedEventIds, setMyJoinedEventIds] = useState(() => new Set());
  const isMountedRef = useRef(false);
  const membershipCheckedRef = useRef(new Set());
  const [draftFormData, setDraftFormData] = useState(null);
  const [editingEvent, setEditingEvent] = useState(/** @type {EventData | null} */ (null));
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(/** @type {string | null} */ (null));
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hostName = user?.name || (user?.email ? user.email.split('@')[0] : '');
  const cityOptions = useMemo(() => listTaiwanCities(), []);
  const filterDistrictOptions = useMemo(() => listTaiwanDistricts(filterCity), [filterCity]);
  const selectedDistrictOptions = useMemo(() => listTaiwanDistricts(selectedCity), [selectedCity]);
  const routePointCount = useMemo(
    () => (Array.isArray(routeCoordinates) ? countTotalPoints(routeCoordinates) : 0),
    [routeCoordinates],
  );

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

  useEffect(() => {
    if (!isFormOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFormOpen]);

  useEffect(() => {
    if (!isFilterOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFilterOpen]);

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

  useEffect(() => {
    if (!user?.uid) {
      setMyJoinedEventIds(new Set());
      membershipCheckedRef.current = new Set();
      return undefined;
    }

    const eventIds = events.map((event) => event?.id).filter(Boolean);
    const uncheckedIds = eventIds.filter((eventId) => !membershipCheckedRef.current.has(eventId));
    if (uncheckedIds.length === 0) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const batches = chunkArray(uncheckedIds, 30);
        const joinedEventIds = new Set();

        for (let index = 0; index < batches.length; index += 1) {
          const batch = batches[index];
          // eslint-disable-next-line no-await-in-loop
          const joined = await fetchMyJoinedEventsForIds(user.uid, batch);
          joined.forEach((eventId) => joinedEventIds.add(eventId));
        }

        uncheckedIds.forEach((eventId) => membershipCheckedRef.current.add(eventId));

        if (!cancelled && joinedEventIds.size > 0) {
          setMyJoinedEventIds((previous) => {
            const next = new Set(previous);
            joinedEventIds.forEach((eventId) => next.add(eventId));
            return next;
          });
        }
      } catch (error) {
        console.error('查詢已參加活動失敗:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [events, user?.uid]);

  const loadMore = useCallback(async () => {
    if (isFormOpen || isCreating) return;
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
  }, [cursor, hasMore, isCreating, isFormOpen, isLoadingEvents, isLoadingMore]);

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

  const handleOpenFilter = useCallback(() => {
    if (isFormOpen) return;
    setFilterOpen(true);
  }, [isFormOpen]);

  const handleCloseFilter = useCallback(() => {
    setFilterOpen(false);
  }, []);

  const handleCloseCreateForm = useCallback(() => {
    setFormOpen(false);
  }, []);

  const handleFilterCityChange = useCallback((value) => {
    setFilterCity(value);
    setFilterDistrict('');
  }, []);

  const handleSelectedCityChange = useCallback((value) => {
    setSelectedCity(value);
    setSelectedDistrict('');
  }, []);

  const handleEnableRoutePlanning = useCallback(() => {
    setShowMap(true);
  }, []);

  const handleDisableRoutePlanning = useCallback(() => {
    setShowMap(false);
    setRouteCoordinates(null);
  }, []);

  const handleToggleCreateRunForm = useCallback(() => {
    if (!user?.uid) {
      showToast('發起活動前請先登入', 'error');
      return;
    }

    if (isFormOpen) {
      setFormOpen(false);
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setMinDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);

    if (draftFormData) {
      setSelectedCity(draftFormData.city || '');
      setSelectedDistrict(draftFormData.district || '');

      if (draftFormData.planRoute === 'yes') {
        setShowMap(true);
        setRouteCoordinates(draftFormData.routeCoordinates || null);
      } else {
        setShowMap(false);
        setRouteCoordinates(null);
      }
    } else {
      setSelectedCity('');
      setSelectedDistrict('');
      setShowMap(false);
      setRouteCoordinates(null);
    }

    setFormOpen(true);
  }, [draftFormData, isFormOpen, showToast, user?.uid]);

  const handleClearFilters = useCallback(async () => {
    setFilterTimeStart('');
    setFilterTimeEnd('');
    setFilterDistanceMin('');
    setFilterDistanceMax('');
    setFilterHasSeatsOnly(false);
    setFilterCity('');
    setFilterDistrict('');
    setIsFilteredResults(false);
    await loadLatestPage({ replaceExisting: true });
  }, [loadLatestPage]);

  const handleSearchFilters = useCallback(async () => {
    setFilterOpen(false);
    setIsFiltering(true);
    setLoadError(null);

    const filters = {
      city: filterCity,
      district: filterDistrict,
      startTime: filterTimeStart,
      endTime: filterTimeEnd,
      minDistance: filterDistanceMin,
      maxDistance: filterDistanceMax,
      hasSeatsOnly: filterHasSeatsOnly,
    };

    try {
      const results = await queryEvents(filters);
      if (!isMountedRef.current) return;
      setEvents(results);
      setCursor(null);
      setLoadMoreError(null);
      setIsFilteredResults(true);
      setHasMore(false);
    } catch (error) {
      console.error('篩選失敗:', error);
      if (!isMountedRef.current) return;
      setLoadError('搜尋失敗，請稍後再試');
    } finally {
      if (isMountedRef.current) {
        setIsFiltering(false);
      }
    }
  }, [
    filterCity,
    filterDistrict,
    filterDistanceMax,
    filterDistanceMin,
    filterHasSeatsOnly,
    filterTimeEnd,
    filterTimeStart,
  ]);

  const handleSubmit = useCallback(
    /**
     * 提交建立活動表單。
     * @param {import('react').FormEvent<HTMLFormElement>} event - 表單提交事件。
     * @returns {Promise<void>}
     */
    async (event) => {
      event.preventDefault();
      setIsCreating(true);

      const formData = new FormData(event.currentTarget);
      const data = Object.fromEntries(formData.entries());

      const deadlineDate = new Date(/** @type {string} */ (data.registrationDeadline));
      const eventTime = new Date(/** @type {string} */ (data.time));
      if (deadlineDate >= eventTime) {
        showToast('報名截止時間必須在活動開始時間之前', 'error');
        setIsCreating(false);
        return;
      }

      const routeCoordinatesSnapshot = Array.isArray(routeCoordinates)
        ? routeCoordinates.map((segment) =>
            segment.map((point) => ({ lat: point.lat, lng: point.lng })),
          )
        : null;

      const paceMin = Number(data.paceMinutes);
      const paceSecPart = Number(data.paceSeconds);
      const paceSec =
        Number.isFinite(paceMin) && Number.isFinite(paceSecPart) ? paceMin * 60 + paceSecPart : 0;

      const extra = {
        hostUid: user?.uid || '',
        hostName: hostName || '',
        hostPhotoURL: user?.photoURL || '',
        route: buildRoutePayload(routeCoordinatesSnapshot),
      };

      try {
        const documentRef = await createEvent(data, extra);
        if (!isMountedRef.current) return;
        const newEventCard = {
          id: documentRef.id,
          ...data,
          ...extra,
          paceSec,
          routeCoordinates: routeCoordinatesSnapshot,
          participantsCount: 0,
          remainingSeats: toNumber(String(data.maxParticipants)),
        };

        setEvents((previous) => [
          newEventCard,
          ...previous.filter((item) => item.id !== newEventCard.id),
        ]);
        setDraftFormData(null);
        setFormOpen(false);
        setShowMap(false);
        setRouteCoordinates(null);
        setSelectedCity('');
        setSelectedDistrict('');
        showToast('建立活動成功');
      } catch (error) {
        console.error('建立活動失敗:', error);
        if (!isMountedRef.current) return;
        setDraftFormData({
          ...data,
          routeCoordinates: routeCoordinatesSnapshot,
        });
        showToast('建立活動失敗，請稍後再試', 'error');
      } finally {
        if (isMountedRef.current) {
          setIsCreating(false);
        }
      }
    },
    [hostName, routeCoordinates, showToast, user?.photoURL, user?.uid],
  );

  const handleJoinClick = useCallback(
    /**
     * 處理點擊參加活動。
     * @param {EventData} event - 活動資料。
     * @param {import('react').MouseEvent} clickEvent - 點擊事件。
     * @returns {Promise<void>}
     */
    async (event, clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();

      if (!user?.uid) {
        showToast('加入活動前請先登入', 'error');
        return;
      }
      if (event.hostUid === user.uid) {
        return;
      }

      const eventId = String(event.id);
      const payload = buildUserPayload(user);
      if (!payload) {
        return;
      }

      setPendingByEventId((previous) => ({ ...previous, [eventId]: 'joining' }));

      try {
        const result = await joinEvent(eventId, payload);
        if (!isMountedRef.current) return;

        if (result?.ok && (result.status === 'joined' || result.status === 'already_joined')) {
          setMyJoinedEventIds((previous) => {
            const next = new Set(previous);
            next.add(eventId);
            return next;
          });

          if (result.status === 'joined') {
            setEvents((previous) =>
              previous.map((item) => {
                if (String(item.id) !== eventId) return item;
                const remainingSeats = getRemainingSeats(item);
                const participantsCount = toNumber(item.participantsCount);
                return {
                  ...item,
                  remainingSeats: Math.max(0, remainingSeats - 1),
                  participantsCount: participantsCount + 1,
                };
              }),
            );
          }

          showToast('報名成功');
          return;
        }

        if (result?.ok === false && result.status === 'full') {
          showToast('本活動已額滿', 'error');
          setEvents((previous) =>
            previous.map((item) =>
              String(item.id) === eventId ? { ...item, remainingSeats: 0 } : item,
            ),
          );
          return;
        }

        showToast('報名失敗，請再試一次', 'error');
      } catch (error) {
        console.error('參加活動失敗:', error);
        if (!isMountedRef.current) return;
        showToast('報名失敗，請再試一次', 'error');
      } finally {
        if (isMountedRef.current) {
          setPendingByEventId((previous) => {
            const next = { ...previous };
            delete next[eventId];
            return next;
          });
        }
      }
    },
    [showToast, user],
  );

  const handleLeaveClick = useCallback(
    /**
     * 處理點擊退出活動。
     * @param {EventData} event - 活動資料。
     * @param {import('react').MouseEvent} clickEvent - 點擊事件。
     * @returns {Promise<void>}
     */
    async (event, clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();

      if (!user?.uid) {
        showToast('請先登入再操作', 'error');
        return;
      }

      const eventId = String(event.id);
      const payload = buildUserPayload(user);
      if (!payload) {
        return;
      }

      setPendingByEventId((previous) => ({ ...previous, [eventId]: 'leaving' }));

      try {
        const result = await leaveEvent(eventId, payload);
        if (!isMountedRef.current) return;

        if (result?.ok && (result.status === 'left' || result.status === 'not_joined')) {
          setMyJoinedEventIds((previous) => {
            const next = new Set(previous);
            next.delete(eventId);
            return next;
          });

          if (result.status === 'left') {
            setEvents((previous) =>
              previous.map((item) => {
                if (String(item.id) !== eventId) return item;
                const maxParticipants = toNumber(item.maxParticipants);
                const remainingSeats = getRemainingSeats(item);
                const participantsCount = toNumber(item.participantsCount);
                return {
                  ...item,
                  remainingSeats: Math.min(maxParticipants, remainingSeats + 1),
                  participantsCount: Math.max(0, participantsCount - 1),
                };
              }),
            );
          }

          showToast('已成功取消報名');
          return;
        }

        showToast('發生錯誤，請再重新取消報名', 'error');
      } catch (error) {
        console.error('退出活動失敗:', error);
        if (!isMountedRef.current) return;
        showToast('發生錯誤，請再重新取消報名', 'error');
      } finally {
        if (isMountedRef.current) {
          setPendingByEventId((previous) => {
            const next = { ...previous };
            delete next[eventId];
            return next;
          });
        }
      }
    },
    [showToast, user],
  );

  const handleEditEvent = useCallback(
    /**
     * 開啟編輯活動表單。
     * @param {EventData} event - 活動資料。
     */
    (event) => {
      setEditingEvent(event);
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
      const { id, ...fields } = changedData;

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
        await updateEvent(String(id), fields);
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
            new Date(mergedFields.registrationDeadline),
          );
        }

        setEvents((previous) =>
          previous.map((event) => {
            if (String(event.id) !== String(id)) return event;
            const updated = { ...event, ...mergedFields };
            if ('route' in mergedFields && mergedFields.route === null) {
              delete updated.route;
            }
            return updated;
          }),
        );

        showToast('更新活動成功');
        setEditingEvent(null);
      } catch (error) {
        console.error('更新活動失敗:', error);
        if (!isMountedRef.current) return;
        showToast('更新活動失敗，請稍後再試', 'error');
      } finally {
        if (isMountedRef.current) {
          setIsUpdating(false);
        }
      }
    },
    [editingEvent, showToast],
  );

  const handleDeleteEventRequest = useCallback(
    /**
     * 開啟刪除活動確認對話框。
     * @param {EventData} event - 活動資料。
     */
    (event) => {
      setDeletingEventId(String(event.id));
    },
    [],
  );

  const handleDeleteCancel = useCallback(() => {
    setDeletingEventId(null);
  }, []);

  const handleDeleteConfirm = useCallback(
    /**
     * 確認刪除活動。
     * @param {string} eventId - 要刪除的活動 ID。
     * @returns {Promise<void>}
     */
    async (eventId) => {
      setIsDeletingEvent(true);
      try {
        await deleteEvent(String(eventId));
        if (!isMountedRef.current) return;
        setEvents((previous) => previous.filter((event) => String(event.id) !== String(eventId)));
        setDeletingEventId(null);
        showToast('活動已刪除');
      } catch (error) {
        console.error('刪除活動失敗:', error);
        if (!isMountedRef.current) return;
        showToast('刪除活動失敗，請稍後再試', 'error');
      } finally {
        if (isMountedRef.current) {
          setIsDeletingEvent(false);
        }
      }
    },
    [showToast],
  );

  return {
    user,
    events,
    hostName,
    isFormOpen,
    isFilterOpen,
    filterTimeStart,
    filterTimeEnd,
    filterDistanceMin,
    filterDistanceMax,
    filterHasSeatsOnly,
    filterCity,
    filterDistrict,
    showMap,
    routeCoordinates,
    routePointCount,
    selectedCity,
    selectedDistrict,
    minDateTime,
    isFilteredResults,
    isLoadingEvents,
    isFiltering,
    loadError,
    isLoadingMore,
    loadMoreError,
    hasMore,
    sentinelRef,
    isCreating,
    pendingByEventId,
    myJoinedEventIds,
    draftFormData,
    editingEvent,
    isUpdating,
    deletingEventId,
    isDeletingEvent,
    cityOptions,
    filterDistrictOptions,
    selectedDistrictOptions,
    getRemainingSeats,
    setFilterTimeStart,
    setFilterTimeEnd,
    setFilterDistanceMin,
    setFilterDistanceMax,
    setFilterHasSeatsOnly,
    setFilterDistrict,
    setSelectedDistrict,
    setRouteCoordinates,
    handleOpenFilter,
    handleCloseFilter,
    handleFilterCityChange,
    handleSelectedCityChange,
    handleEnableRoutePlanning,
    handleDisableRoutePlanning,
    handleToggleCreateRunForm,
    handleCloseCreateForm,
    handleClearFilters,
    handleSearchFilters,
    handleSubmit,
    handleJoinClick,
    handleLeaveClick,
    handleEditEvent,
    handleEditCancel,
    handleEditSubmit,
    handleDeleteEventRequest,
    handleDeleteCancel,
    handleDeleteConfirm,
    loadMore,
  };
}
