'use client';

import { useEffect, useState, useContext, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic'; // 導入 dynamic
import Link from 'next/link';
import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import {
  buildRoutePayload,
  countTotalPoints,
  formatDateTime,
  formatPace,
  chunkArray,
  toNumber,
  getRemainingSeats,
  buildUserPayload,
} from '@/lib/event-helpers';
import { AuthContext } from '@/contexts/AuthContext';
import styles from './events.module.css';
import EventActionButtons from '@/components/EventActionButtons';
import {
  createEvent,
  fetchLatestEvents,
  fetchNextEvents,
  queryEvents,
  joinEvent,
  leaveEvent,
  fetchMyJoinedEventsForIds,
  updateEvent,
  deleteEvent,
} from '@/lib/firebase-events';
import EventCardMenu from '@/components/EventCardMenu';
import EventEditForm from '@/components/EventEditForm';
import EventDeleteConfirm from '@/components/EventDeleteConfirm';
import taiwanLocations from '@/lib/taiwan-locations';

// 動態載入 EventMap 元件，關閉 SSR
const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

/**
 * 揪團跑步主頁面。
 * @returns {import('react').ReactElement} 頁面組件。
 */
export default function RunTogetherPage() {
  const [isFormOpen, setFormOpen] = useState(false);
  // ✅ 篩選浮層（先做空白 UI）
  const [isFilterOpen, setFilterOpen] = useState(false);
  // ✅ 篩選表單
  // 2. 活動日期/時間
  const [filterTimeStart, setFilterTimeStart] = useState('');
  const [filterTimeEnd, setFilterTimeEnd] = useState('');
  // 4. 跑步距離 (km)
  const [filterDistanceMin, setFilterDistanceMin] = useState('');
  const [filterDistanceMax, setFilterDistanceMax] = useState('');
  // 6. 是否還有名額
  const [filterHasSeatsOnly, setFilterHasSeatsOnly] = useState(true);
  // 7. 縣市 + 區
  const [filterCity, setFilterCity] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const { user } = useContext(AuthContext);

  // ✅ 表單相關 state
  const [showMap, setShowMap] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [minDateTime, setMinDateTime] = useState('');

  // ✅ 活動列表
  const [events, setEvents] = useState([]);
  const [isFilteredResults, setIsFilteredResults] = useState(false); // 是否為篩選後的結果

  // ✅ 初次載入（進頁面抓最新 10 筆）
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false); // 正在篩選中
  const [loadError, setLoadError] = useState(null);

  // ✅ 無限滾動（載入更多）
  const [cursor, setCursor] = useState(null); // DocumentSnapshot
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);

  // ✅ 建立活動狀態
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // ✅ 參加/退出：成功/失敗字卡（不使用 alert）
  const [actionMessage, setActionMessage] = useState(null);

  // ✅ 參加/退出：每張卡片的按鈕 loading 狀態
  const [pendingByEventId, setPendingByEventId] = useState({});

  // ✅ 我已參加哪些活動
  const [myJoinedEventIds, setMyJoinedEventIds] = useState(() => new Set());
  const membershipCheckedRef = useRef(new Set());

  // ✅ 上次建立失敗時保留的草稿
  const [draftFormData, setDraftFormData] = useState(null);

  // ✅ 編輯活動
  const [editingEvent, setEditingEvent] = useState(/** @type {object|null} */ (null));
  const [isUpdating, setIsUpdating] = useState(false);

  // ✅ 刪除活動
  const [deletingEventId, setDeletingEventId] = useState(/** @type {string|null} */ (null));
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const hostName = user?.name || (user?.email ? user.email.split('@')[0] : '');

  // 表單打開時鎖住 body 捲動
  useEffect(() => {
    if (!isFormOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFormOpen]);

  // 篩選浮層打開時鎖住 body 捲動
  useEffect(() => {
    if (!isFilterOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFilterOpen]);

  // 進入 events 頁面時，先載入最新 10 筆活動
  useEffect(() => {
    let cancelled = false;

    /**
     * 執行初始資料載入。
     */
    async function run() {
      setIsLoadingEvents(true);
      setLoadError(null);

      try {
        const { events: latest, lastDoc } = await fetchLatestEvents(10);

        if (!cancelled) {
          setEvents((prev) => {
            const map = new Map();
            [...prev, ...latest].forEach((ev) => {
              if (ev?.id && !map.has(ev.id)) map.set(ev.id, ev);
            });
            return Array.from(map.values());
          });

          setCursor(lastDoc);
          setHasMore(latest.length === 10 && !!lastDoc);
        }
      } catch (err) {
        console.error('載入活動失敗:', err);
        if (!cancelled) setLoadError('載入活動失敗，請稍後再試');
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // events 清單變動就補查「我是否已參加」
  useEffect(() => {
    if (!user?.uid) {
      setMyJoinedEventIds(new Set());
      membershipCheckedRef.current = new Set();
      return undefined;
    }

    const ids = events.map((e) => e?.id).filter(Boolean);
    const newIds = ids.filter((id) => !membershipCheckedRef.current.has(id));
    if (newIds.length === 0) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const batches = chunkArray(newIds, 30);
        const joined = new Set();

        for (let i = 0; i < batches.length; i += 1) {
          const batch = batches[i];
          // eslint-disable-next-line no-await-in-loop
          const set = await fetchMyJoinedEventsForIds(user.uid, batch);
          set.forEach((id) => joined.add(id));
        }

        newIds.forEach((id) => membershipCheckedRef.current.add(id));

        if (!cancelled && joined.size > 0) {
          setMyJoinedEventIds((prev) => {
            const next = new Set(prev);
            joined.forEach((id) => next.add(id));
            return next;
          });
        }
      } catch (err) {
        console.error('查詢已參加活動失敗:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [events, user?.uid]);

  /**
   * 載入更多活動。
   * @returns {Promise<void>}
   */
  const loadMore = useCallback(async () => {
    if (isFormOpen || isCreating) return;
    if (!hasMore || !cursor || isLoadingEvents || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const { events: next, lastDoc } = await fetchNextEvents(cursor, 10);

      setEvents((prev) => {
        const map = new Map();
        [...prev, ...next].forEach((ev) => {
          if (ev?.id && !map.has(ev.id)) map.set(ev.id, ev);
        });
        return Array.from(map.values());
      });

      setCursor(lastDoc);
      if (next.length < 10 || !lastDoc) setHasMore(false);
      setLoadMoreError(null);
    } catch (err) {
      console.error('載入更多活動失敗:', err);
      setLoadMoreError('載入更多活動失敗，請稍後再試');
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, isCreating, isFormOpen, isLoadingEvents, isLoadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    if (!hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '0px 0px 300px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  /**
   * 切換建立活動表單顯示狀態。
   */
  function handleToggleCreateRunForm() {
    if (!user?.uid) {
      setActionMessage({ type: 'error', message: '發起活動前請先登入' });
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

      const { planRoute } = draftFormData;
      if (planRoute === 'yes') {
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
  }

  /**
   * 清除所有篩選條件並重新載入原始活動列表。
   * @returns {Promise<void>}
   */
  async function handleClearFilters() {
    setFilterTimeStart('');
    setFilterTimeEnd('');
    setFilterDistanceMin('');
    setFilterDistanceMax('');
    setFilterHasSeatsOnly(true);
    setFilterCity('');
    setFilterDistrict('');
    setIsFilteredResults(false);

    // 重新載入原始活動列表，恢復 pagination 狀態
    setIsLoadingEvents(true);
    setLoadError(null);

    try {
      const { events: latest, lastDoc } = await fetchLatestEvents(10);
      setEvents(latest);
      setCursor(lastDoc);
      setHasMore(latest.length === 10 && !!lastDoc);
    } catch (err) {
      console.error('載入活動失敗:', err);
      setLoadError('載入活動失敗，請稍後再試');
    } finally {
      setIsLoadingEvents(false);
    }
  }

  /**
   * 根據目前設定的篩選條件執行搜尋。
   * @returns {Promise<void>}
   */
  async function handleSearchFilters() {
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
      setEvents(results);
      setIsFilteredResults(true);
      setHasMore(false); // MVP 篩選結果暫不支援載入更多
    } catch (err) {
      console.error('篩選失敗:', err);
      setLoadError('搜尋失敗，請稍後再試');
    } finally {
      setIsFiltering(false);
    }
  }

  /**
   * 提交建立活動表單。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單提交事件。
   * @returns {Promise<void>}
   */
  async function handleSubmit(e) {
    e.preventDefault();

    setCreateError(null);
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const routeCoordinatesSnapshot = Array.isArray(routeCoordinates)
      ? routeCoordinates.map((seg) => seg.map((p) => ({ lat: p.lat, lng: p.lng })))
      : null;

    // ✅ UI 用下拉（分/秒），資料層與 Firestore 只存 paceSec（number）
    const paceMin = Number(data.paceMinutes);
    const paceSecPart = Number(data.paceSeconds);
    const paceSec =
      Number.isFinite(paceMin) && Number.isFinite(paceSecPart) ? paceMin * 60 + paceSecPart : 0;

    const route = buildRoutePayload(routeCoordinatesSnapshot);

    const extra = {
      hostUid: user?.uid || '',
      hostName: hostName || '',
      hostPhotoURL: user?.photoURL || '',
      route,
    };

    try {
      const docRef = await createEvent(data, extra);

      const newEventCard = {
        id: docRef.id,
        ...data,
        ...extra,
        paceSec,
        routeCoordinates: routeCoordinatesSnapshot,

        // 參加功能：UI 快取
        participantsCount: 0,
        remainingSeats: toNumber(data.maxParticipants),
      };

      setEvents((prev) => [newEventCard, ...prev.filter((ev) => ev.id !== newEventCard.id)]);
      setDraftFormData(null);

      setFormOpen(false);
      setShowMap(false);
      setRouteCoordinates(null);
      setSelectedCity('');
      setSelectedDistrict('');

      setIsCreating(false);
    } catch (err) {
      console.error('建立活動失敗:', err);

      setDraftFormData({
        ...data,
        routeCoordinates: routeCoordinatesSnapshot,
      });

      setCreateError('建立活動失敗，請再建立一次');
      setIsCreating(false);
    }
  }

  /**
   * 處理點擊參加活動。
   * @param {import('@/lib/event-helpers').EventData} ev - 活動資料。
   * @param {import('react').MouseEvent} clickEvent - 點擊事件。
   * @returns {Promise<void>}
   */
  const handleJoinClick = useCallback(
    async (
      /** @type {import('@/lib/event-helpers').EventData} */ ev,
      /** @type {import('react').MouseEvent} */ clickEvent,
    ) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();

      if (!user?.uid) {
        setActionMessage({ type: 'error', message: '加入活動前請先登入' });
        return;
      }
      if (ev.hostUid === user.uid) return;

      const eventId = String(ev.id);
      const payload = buildUserPayload(user);
      if (!payload) return;

      setActionMessage(null);
      setPendingByEventId((prev) => ({ ...prev, [eventId]: 'joining' }));

      try {
        const res = await joinEvent(eventId, payload);

        if (res?.ok && (res.status === 'joined' || res.status === 'already_joined')) {
          setMyJoinedEventIds((prev) => {
            const next = new Set(prev);
            next.add(eventId);
            return next;
          });

          if (res.status === 'joined') {
            setEvents((prev) =>
              prev.map((item) => {
                if (String(item.id) !== eventId) return item;
                const remaining = getRemainingSeats(item);
                const count = toNumber(item.participantsCount);
                return {
                  ...item,
                  remainingSeats: Math.max(0, remaining - 1),
                  participantsCount: count + 1,
                };
              }),
            );
          }

          setActionMessage({ type: 'success', message: '報名成功' });
          return;
        }

        if (res?.ok === false && res.status === 'full') {
          setActionMessage({ type: 'error', message: '本活動已額滿' });
          setEvents((prev) =>
            prev.map((item) =>
              String(item.id) === eventId ? { ...item, remainingSeats: 0 } : item,
            ),
          );
          return;
        }

        setActionMessage({ type: 'error', message: '報名失敗，請再試一次' });
      } catch (err) {
        console.error('參加活動失敗:', err);
        setActionMessage({ type: 'error', message: '報名失敗，請再試一次' });
      } finally {
        setPendingByEventId((prev) => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
    },
    [user],
  );

  /**
   * 處理點擊退出活動。
   * @param {import('@/lib/event-helpers').EventData} ev - 活動資料。
   * @param {import('react').MouseEvent} clickEvent - 點擊事件。
   * @returns {Promise<void>}
   */
  const handleLeaveClick = useCallback(
    async (
      /** @type {import('@/lib/event-helpers').EventData} */ ev,
      /** @type {import('react').MouseEvent} */ clickEvent,
    ) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();

      if (!user?.uid) {
        setActionMessage({ type: 'error', message: '請先登入再操作' });
        return;
      }

      const eventId = String(ev.id);
      const payload = buildUserPayload(user);
      if (!payload) return;

      setActionMessage(null);
      setPendingByEventId((prev) => ({ ...prev, [eventId]: 'leaving' }));

      try {
        const res = await leaveEvent(eventId, payload);

        if (res?.ok && (res.status === 'left' || res.status === 'not_joined')) {
          setMyJoinedEventIds((prev) => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });

          if (res.status === 'left') {
            setEvents((prev) =>
              prev.map((item) => {
                if (String(item.id) !== eventId) return item;

                const max = toNumber(item.maxParticipants);
                const remaining = getRemainingSeats(item);
                const count = toNumber(item.participantsCount);
                return {
                  ...item,
                  remainingSeats: Math.min(max, remaining + 1),
                  participantsCount: Math.max(0, count - 1),
                };
              }),
            );
          }

          setActionMessage({ type: 'success', message: '已成功取消報名' });
          return;
        }

        setActionMessage({
          type: 'error',
          message: '發生錯誤，請再重新取消報名',
        });
      } catch (err) {
        console.error('退出活動失敗:', err);
        setActionMessage({
          type: 'error',
          message: '發生錯誤，請再重新取消報名',
        });
      } finally {
        setPendingByEventId((prev) => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
    },
    [user],
  );

  /**
   * 開啟編輯活動表單。
   * @param {object} ev - 活動資料。
   */
  const handleEditEvent = useCallback(
    (/** @type {import('@/lib/event-helpers').EventData} */ ev) => {
      setEditingEvent(ev);
    },
    [],
  );

  /**
   * 取消編輯。
   */
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
      const { id, ...fields } = changedData;
      setIsUpdating(true);
      try {
        await updateEvent(String(id), fields);
        // 將 string timestamp 轉回 Firestore Timestamp，避免本地 state 與 Firestore 資料型別不一致
        const mergedFields = { ...fields };
        if (typeof mergedFields.time === 'string' && mergedFields.time) {
          mergedFields.time = FirestoreTimestamp.fromDate(new Date(mergedFields.time));
        }
        if (
          typeof mergedFields.registrationDeadline === 'string' &&
          mergedFields.registrationDeadline
        ) {
          mergedFields.registrationDeadline = FirestoreTimestamp.fromDate(
            new Date(mergedFields.registrationDeadline),
          );
        }
        setEvents((prev) =>
          prev.map((ev) => {
            if (String(ev.id) !== String(id)) return ev;
            const updated = { ...ev, ...mergedFields };
            // 若 route 被清除，從本地 state 移除
            if ('route' in mergedFields && mergedFields.route === null) {
              delete updated.route;
            }
            return updated;
          }),
        );
        setEditingEvent(null);
      } catch {
        setActionMessage({ type: 'error', message: '更新活動失敗，請再試一次' });
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  /**
   * 開啟刪除活動確認對話框。
   * @param {object} ev - 活動資料。
   */
  const handleDeleteEventRequest = useCallback(
    (/** @type {import('@/lib/event-helpers').EventData} */ ev) => {
      setDeletingEventId(String(ev.id));
      setDeleteError('');
    },
    [],
  );

  /**
   * 取消刪除活動。
   */
  const handleDeleteCancel = useCallback(() => {
    setDeletingEventId(null);
    setDeleteError('');
  }, []);

  /**
   * 確認刪除活動。
   * @param {string} eventId - 要刪除的活動 ID。
   * @returns {Promise<void>}
   */
  const handleDeleteConfirm = useCallback(async (/** @type {string} */ eventId) => {
    setIsDeletingEvent(true);
    setDeleteError('');
    try {
      await deleteEvent(String(eventId));
      setEvents((prev) => prev.filter((ev) => String(ev.id) !== String(eventId)));
      setDeletingEventId(null);
      setActionMessage({ type: 'success', message: '刪除成功' });
    } catch {
      setDeleteError('發生錯誤，請再試一次');
    } finally {
      setIsDeletingEvent(false);
    }
  }, []);

  return (
    <div className={styles.pageContainer}>
      <h1>這是揪團跑步頁面</h1>

      <div className={styles.eventsSection}>
        <div className={styles.eventsHeaderRow}>
          <h2 className={styles.eventsTitle}>活動列表</h2>

          <button
            type="button"
            className={styles.filterButton}
            aria-label="篩選活動"
            onClick={() => {
              if (isFormOpen) return; // 先避免兩個浮層同時開
              setFilterOpen(true);
            }}
          >
            <svg
              className={styles.filterIcon}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 5h18l-7 8v5l-4 1v-6L3 5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {isLoadingEvents && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在載入活動…</span>
          </div>
        )}

        {isFiltering && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在篩選活動…</span>
          </div>
        )}

        {isCreating && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在建立活動…</span>
          </div>
        )}

        {loadError && (
          <div className={styles.errorCard} role="alert">
            {loadError}
          </div>
        )}

        {createError && (
          <div className={styles.errorCard} role="alert">
            {createError}
          </div>
        )}

        {actionMessage && (
          <div
            className={actionMessage.type === 'success' ? styles.successCard : styles.errorCard}
            role={actionMessage.type === 'error' ? 'alert' : 'status'}
          >
            {actionMessage.message}
          </div>
        )}

        <div className={styles.eventList}>
          {!isLoadingEvents && !isFiltering && events.length === 0 ? (
            <div className={styles.emptyHint}>
              {isFilteredResults ? '沒有符合條件的活動' : '目前還沒有活動（先建立一筆看看）'}
            </div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className={styles.eventCardWrapper}>
                <Link href={`/events/${ev.id}`} className={styles.eventLink}>
                  <div className={styles.eventCard}>
                    <div className={styles.eventTitle}>{ev.title}</div>

                    <div className={styles.eventMeta}>
                      <div>
                        時間：
                        {formatDateTime(ev.time)}
                      </div>
                      <div>
                        報名截止：
                        {formatDateTime(ev.registrationDeadline)}
                      </div>
                      <div>
                        地點：
                        {ev.city} {ev.district}
                      </div>
                      <div>
                        集合：
                        {ev.meetPlace}
                      </div>
                    </div>

                    <div className={styles.eventMeta}>
                      <div>
                        距離：
                        {ev.distanceKm} km
                      </div>
                      <div>
                        配速：
                        {formatPace(ev.paceSec, ev.pace)} /km
                      </div>
                      <div>
                        人數上限：
                        {ev.maxParticipants}
                      </div>
                      <div>
                        剩餘名額：
                        {getRemainingSeats(ev)}
                      </div>
                    </div>

                    <div className={styles.eventMeta}>
                      <div>
                        主揪：
                        {ev.hostName}
                      </div>
                      <div>
                        路線：
                        {(() => {
                          const pts = countTotalPoints(ev.routeCoordinates);
                          if (pts > 0) {
                            return `已設定（${pts} 點）`;
                          }
                          if (ev.route?.pointsCount) {
                            return `已設定（${ev.route.pointsCount} 點）`;
                          }
                          return '未設定';
                        })()}
                      </div>
                    </div>

                    {/* ✅ 參加/退出活動（events 列表版） */}
                    <div className={styles.eventCardActions}>
                      <EventActionButtons
                        event={ev}
                        user={user}
                        onJoin={handleJoinClick}
                        onLeave={handleLeaveClick}
                        isPending={pendingByEventId[String(ev.id)]}
                        isCreating={isCreating}
                        isFormOpen={isFormOpen}
                        myJoinedEventIds={myJoinedEventIds}
                      />
                    </div>
                  </div>
                </Link>

                {/* ✅ 編輯/刪除選單：在 Link 外，避免點擊觸發頁面跳轉 */}
                <div className={styles.eventCardMenuWrapper}>
                  <EventCardMenu
                    event={ev}
                    currentUserUid={user?.uid || null}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEventRequest}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.loadMoreArea}>
          {isLoadingMore && (
            <div className={styles.statusRow} role="status" aria-live="polite">
              <div className={styles.spinner} aria-hidden="true" />
              <span>載入更多活動…</span>
            </div>
          )}

          {loadMoreError && (
            <div className={styles.errorCard} role="alert">
              {loadMoreError}
              <button
                type="button"
                className={styles.retryButton}
                onClick={loadMore}
                disabled={isLoadingMore || isLoadingEvents || isCreating || isFormOpen}
              >
                重試
              </button>
            </div>
          )}

          {!hasMore && events.length > 0 && <div className={styles.endHint}>已經到底了</div>}

          <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
        </div>
      </div>

      {!isFormOpen && (
        <button type="button" onClick={handleToggleCreateRunForm} className={styles.mainButton}>
          ＋ 新增跑步揪團
        </button>
      )}

      {isFilterOpen && (
        <div className={styles.filterOverlay}>
          <div
            className={styles.overlayBackground}
            role="button"
            aria-label="關閉篩選"
            onClick={() => setFilterOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                setFilterOpen(false);
              }
            }}
            tabIndex={0}
          />
          <div
            className={styles.filterCard}
            role="dialog"
            aria-modal="true"
            aria-label="篩選活動詳情"
          >
            <div className={styles.filterHeader}>
              <div className={styles.filterHeaderTitle}>篩選活動</div>
              <button
                type="button"
                className={styles.filterCloseButton}
                aria-label="關閉篩選"
                onClick={() => setFilterOpen(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.filterBody}>
              {/* 1) 是否還有名額 (移至最前) */}
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>名額狀況</div>
                <div className={styles.filterToggleRow}>
                  <span className={styles.filterToggleLabel}>只顯示還有名額的活動</span>
                  <label className={styles.switch} htmlFor="filterHasSeatsOnly">
                    <input
                      type="checkbox"
                      id="filterHasSeatsOnly"
                      checked={filterHasSeatsOnly}
                      onChange={(e) => setFilterHasSeatsOnly(e.target.checked)}
                      aria-label="只顯示還有名額的活動"
                    />
                    <span className={`${styles.slider} ${styles.round}`} />
                  </label>
                </div>
              </div>

              {/* 2) 揪團人 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                <label htmlFor="filterHost" className={styles.filterLabel}>
                  揪團人
                </label>
                ...
              </div>
              */}

              {/* 2) 活動日期/時間 */}
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>活動時間</div>
                <div className={styles.filterRow}>
                  <div className={styles.filterRowItem}>
                    <input
                      type="datetime-local"
                      id="filterTimeStart"
                      className={styles.filterTextField}
                      value={filterTimeStart}
                      onChange={(e) => setFilterTimeStart(e.target.value)}
                      aria-label="活動開始時間（起）"
                    />
                  </div>
                  <span className={styles.filterSeparator}>至</span>
                  <div className={styles.filterRowItem}>
                    <input
                      type="datetime-local"
                      id="filterTimeEnd"
                      className={styles.filterTextField}
                      value={filterTimeEnd}
                      onChange={(e) => setFilterTimeEnd(e.target.value)}
                      aria-label="活動開始時間（迄）"
                    />
                  </div>
                </div>
              </div>

              {/* 3) 報名截止時間 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 4) 跑步距離 (km) */}
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>跑步距離 (km)</div>
                <div className={styles.filterRow}>
                  <div className={styles.filterRowItem}>
                    <input
                      type="number"
                      id="filterDistanceMin"
                      className={styles.filterTextField}
                      placeholder="最小距離"
                      aria-label="最小跑步距離"
                      min={0}
                      step={0.1}
                      value={filterDistanceMin}
                      onChange={(e) => setFilterDistanceMin(e.target.value)}
                    />
                  </div>
                  <span className={styles.filterSeparator}>-</span>
                  <div className={styles.filterRowItem}>
                    <input
                      type="number"
                      id="filterDistanceMax"
                      className={styles.filterTextField}
                      placeholder="最大距離"
                      aria-label="最大跑步距離"
                      min={0}
                      step={0.1}
                      value={filterDistanceMax}
                      onChange={(e) => setFilterDistanceMax(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 5) 配速 (分:秒) (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 7) 縣市 + 區 */}
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>活動區域</div>
                <div className={styles.filterRow}>
                  <label htmlFor="filterCity" className={styles.flex1}>
                    <span className="sr-only">選擇縣市</span>
                    <select
                      id="filterCity"
                      className={styles.selectField}
                      value={filterCity}
                      onChange={(e) => {
                        setFilterCity(e.target.value);
                        setFilterDistrict('');
                      }}
                    >
                      <option value="">所有縣市</option>
                      {Object.keys(taiwanLocations).map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label htmlFor="filterDistrict" className={styles.flex1}>
                    <span className="sr-only">選擇區域</span>
                    <select
                      id="filterDistrict"
                      className={styles.selectField}
                      value={filterDistrict}
                      onChange={(e) => setFilterDistrict(e.target.value)}
                      disabled={!filterCity}
                    >
                      <option value="">所有區域</option>
                      {filterCity &&
                        taiwanLocations[filterCity]?.map((/** @type {string} */ dist) => (
                          <option key={dist} value={dist}>
                            {dist}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* 8) 限制人數 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 9) 跑步類型 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 底部按鈕區 */}
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={styles.filterClearButton}
                  onClick={handleClearFilters}
                >
                  清除
                </button>
                <button
                  type="button"
                  className={styles.filterSearchButton}
                  onClick={handleSearchFilters}
                >
                  搜尋
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.uid && isFormOpen && (
        <div className={styles.formOverlay}>
          <form className={styles.googleFormCard} onSubmit={handleSubmit}>
            <div className={styles.formHeaderAccent} />

            <div className={styles.formHeader}>
              <h2>揪團表單</h2>
              <p className={styles.formDescription}>請填寫詳細資訊讓跑友們加入</p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="hostName">
                揪團人
                <input
                  id="hostName"
                  type="text"
                  name="hostName"
                  value={hostName}
                  readOnly
                  aria-readonly="true"
                  placeholder="將自動帶入您的會員名稱"
                />
              </label>
              <div className={styles.focusBorder} />
              <small className={styles.helperText}>由登入帳號自動帶入，無法修改</small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="title">
                活動名稱
                <input
                  id="title"
                  type="text"
                  name="title"
                  required
                  placeholder="例如：大安森林公園輕鬆跑"
                  defaultValue={draftFormData?.title || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="time">
                活動時間
                <input
                  id="time"
                  type="datetime-local"
                  name="time"
                  min={minDateTime}
                  required
                  defaultValue={draftFormData?.time || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="registrationDeadline">
                報名截止時間
                <input
                  id="registrationDeadline"
                  type="datetime-local"
                  name="registrationDeadline"
                  min={minDateTime}
                  required
                  defaultValue={draftFormData?.registrationDeadline || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="city">
                活動區域
                <div className={styles.flexRowGap10}>
                  <select
                    id="city"
                    name="city"
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value);
                      setSelectedDistrict('');
                    }}
                    required
                    className={`${styles.selectField} ${styles.flex1}`}
                  >
                    <option value="" disabled>
                      請選擇縣市
                    </option>
                    {Object.keys(taiwanLocations).map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>

                  <select
                    id="district"
                    name="district"
                    aria-label="選擇區域"
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    required
                    className={`${styles.selectField} ${styles.flex1}`}
                  >
                    <option value="" disabled>
                      請選擇區域
                    </option>
                    {selectedCity &&
                      taiwanLocations[selectedCity]?.map((/** @type {string} */ dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                  </select>
                </div>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="meetPlace">
                集合地點
                <input
                  id="meetPlace"
                  type="text"
                  name="meetPlace"
                  required
                  placeholder="例如：大安森林公園 2號出口"
                  defaultValue={draftFormData?.meetPlace || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="runType">
                跑步類型
                <select
                  name="runType"
                  id="runType"
                  className={styles.selectField}
                  required
                  defaultValue={draftFormData?.runType || ''}
                >
                  <option value="" disabled>
                    請選擇跑步類型
                  </option>
                  <option value="easy_run">輕鬆慢跑（Easy Run）</option>
                  <option value="long_run">長距離慢跑（Long Run）</option>
                  <option value="tempo_run">節奏跑（Tempo Run）</option>
                  <option value="interval_training">間歇訓練（Interval Training）</option>
                  <option value="hill_training">坡度訓練（Hill Training）</option>
                  <option value="fartlek">變速跑（Fartlek）</option>
                  <option value="trail_run">越野跑（Trail Run）</option>
                  <option value="social_run">休閒社交跑（Social Run）</option>
                </select>
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="distanceKm">
                距離（公里）
                <input
                  id="distanceKm"
                  name="distanceKm"
                  type="number"
                  min={0.1}
                  step={0.1}
                  required
                  placeholder="10"
                  defaultValue={draftFormData?.distanceKm || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>目標配速（每公里）</div>
              <div className={`${styles.flexRowGap10} ${styles.flexAlignCenter}`}>
                <label htmlFor="paceMinutes" className={styles.flexAlignCenter}>
                  <select
                    id="paceMinutes"
                    name="paceMinutes"
                    className={`${styles.selectField} ${styles.centerSelect}`}
                    required
                    defaultValue={draftFormData?.paceMinutes || ''}
                  >
                    <option value="" disabled hidden>
                      分
                    </option>
                    {[...Array(19)].map((_, i) => {
                      const val = String(i + 2).padStart(2, '0');
                      return (
                        <option key={val} value={val}>
                          {i + 2}
                        </option>
                      );
                    })}
                  </select>
                  <span className={styles.paceUnit}>分</span>
                </label>

                <label htmlFor="paceSeconds" className={styles.flexAlignCenter}>
                  <select
                    id="paceSeconds"
                    name="paceSeconds"
                    className={`${styles.selectField} ${styles.centerSelect}`}
                    required
                    defaultValue={draftFormData?.paceSeconds || ''}
                  >
                    <option value="" disabled hidden>
                      秒
                    </option>
                    {[...Array(60).keys()].map((s) => {
                      const label = String(s).padStart(2, '0');
                      return (
                        <option key={s} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <span className={styles.paceUnit}>秒</span>
                </label>
              </div>
              <div className={styles.focusBorder} />
              <small className={styles.helperText}>請選擇每公里的配速時間</small>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>是否需要繪製活動路線？</div>
              <div className={styles.radioGroup}>
                <label htmlFor="planRouteYes">
                  <input
                    type="radio"
                    id="planRouteYes"
                    name="planRoute"
                    value="yes"
                    required
                    defaultChecked={draftFormData?.planRoute === 'yes'}
                    onChange={() => setShowMap(true)}
                  />{' '}
                  是
                </label>
                <label htmlFor="planRouteNo">
                  <input
                    type="radio"
                    id="planRouteNo"
                    name="planRoute"
                    value="no"
                    required
                    defaultChecked={draftFormData?.planRoute === 'no'}
                    onChange={() => {
                      setShowMap(false);
                      setRouteCoordinates(null);
                    }}
                  />{' '}
                  否
                </label>
              </div>
              <div className={styles.focusBorder} />
            </div>

            {showMap && (
              <div className={styles.formGroup}>
                <div className={styles.formLabel}>繪製活動路線</div>
                <EventMap onRouteDrawn={setRouteCoordinates} />
                {routeCoordinates && (
                  <p className={styles.helperText}>
                    路線已繪製，包含 {countTotalPoints(routeCoordinates)} 個點。
                  </p>
                )}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="maxParticipants">
                人數上限
                <input
                  id="maxParticipants"
                  name="maxParticipants"
                  type="number"
                  min={2}
                  defaultValue={draftFormData?.maxParticipants || '2'}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">
                活動說明
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="請說明活動內容、注意事項、集合細節等"
                  className={styles.textareaField}
                  defaultValue={draftFormData?.description || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setFormOpen(false)}
                disabled={isCreating}
              >
                取消
              </button>
              <button type="submit" className={styles.submitButton} disabled={isCreating}>
                {isCreating ? '建立中…' : '建立活動'}
              </button>
            </div>
          </form>
        </div>
      )}

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
            deleteError={deleteError}
          />
        </div>
      )}
    </div>
  );
}
