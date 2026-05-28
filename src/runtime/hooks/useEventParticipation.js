'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chunkArray, toNumber } from '@/runtime/events/event-runtime-helpers';
import { buildUserPayload, getRemainingSeats } from '@/service/event-service';
import {
  fetchMyJoinedEventsForIds,
  joinEvent,
  leaveEvent,
} from '@/runtime/client/use-cases/event-use-cases';
/**
 * @typedef {import('@/service/event-service').EventData} EventData
 */

/**
 * @typedef {import('react').MutableRefObject<boolean>} MountedRef
 */

/**
 * @typedef {'checking' | 'joined' | 'notJoined'} MembershipStatus
 */

const MEMBERSHIP_LOOKUP_TIMEOUT_MS = 5000;

/**
 * @template T
 * @param {Promise<T>} promise - 要加上等待上限的 Promise。
 * @param {number} timeoutMs - timeout 毫秒數。
 * @returns {Promise<T>} 原 Promise 結果，或在超時後 reject。
 */
function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('membership lookup timed out'));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

/**
 * @typedef {object} UseEventParticipationParams
 * @property {{ uid?: string, name?: string, email?: string, photoURL?: string } | null} user - 當前登入使用者。
 * @property {EventData[]} events - 活動列表，用於查詢使用者已參加的活動。
 * @property {MountedRef} isMountedRef - 元件是否仍掛載的 ref。
 * @property {(updater: EventData[] | ((previous: EventData[]) => EventData[])) => void} setEvents - 設定活動列表的 setter。
 * @property {(message: string, type?: string) => void} showToast - Toast 訊息顯示函式。
 */

/**
 * @typedef {object} UseEventParticipationReturn
 * @property {Record<string, 'joining' | 'leaving'>} pendingByEventId - 各活動正在進行中的參加/退出操作。
 * @property {Set<string>} myJoinedEventIds - 當前使用者已參加的活動 ID 集合。
 * @property {Record<string, MembershipStatus>} membershipStatusByEventId - 各活動的報名狀態查詢結果。
 * @property {(event: EventData, clickEvent: import('react').MouseEvent) => Promise<void>} handleJoinClick - 處理點擊參加活動。
 * @property {(event: EventData, clickEvent: import('react').MouseEvent) => Promise<void>} handleLeaveClick - 處理點擊退出活動。
 */

/**
 * 管理活動列表頁的參加/退出狀態與操作。
 * 從 useEventsPageRuntime 拆出，包含 membership 檢查 effect、join/leave handlers。
 * @param {UseEventParticipationParams} params - 參加功能所需的外部依賴。
 * @returns {UseEventParticipationReturn} 參加相關的狀態與 handler。
 */
export default function useEventParticipation({
  user,
  events,
  isMountedRef,
  setEvents,
  showToast,
}) {
  const [pendingByEventId, setPendingByEventId] = useState({});
  const [myJoinedEventIds, setMyJoinedEventIds] = useState(() => new Set());
  const [membershipStatusByEventId, setMembershipStatusByEventId] = useState({});
  const [membershipUserUid, setMembershipUserUid] = useState(/** @type {string | null} */ (null));
  const membershipCheckedRef = useRef(new Set());
  const membershipUserUidRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const isLookupCurrent = (lookupUserUid) =>
      !cancelled && isMountedRef.current && membershipUserUidRef.current === lookupUserUid;

    if (!user?.uid) {
      membershipCheckedRef.current = new Set();
      membershipUserUidRef.current = null;
      queueMicrotask(() => {
        if (cancelled) return;
        setMyJoinedEventIds(new Set());
        setMembershipStatusByEventId({});
        setMembershipUserUid(null);
      });
      return () => {
        cancelled = true;
      };
    }

    if (membershipUserUidRef.current !== user.uid) {
      membershipCheckedRef.current = new Set();
      membershipUserUidRef.current = user.uid;
      queueMicrotask(() => {
        if (cancelled) return;
        setMyJoinedEventIds(new Set());
        setMembershipStatusByEventId({});
        setMembershipUserUid(user.uid);
      });
    }

    const eventIds = events.map((event) => event?.id).filter(Boolean).map(String);
    const uncheckedIds = eventIds.filter((eventId) => !membershipCheckedRef.current.has(eventId));
    if (uncheckedIds.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    const lookupUserUid = user.uid;

    queueMicrotask(() => {
      if (!isLookupCurrent(lookupUserUid)) return;
      setMembershipStatusByEventId((previous) => {
        const next = { ...previous };
        uncheckedIds.forEach((eventId) => {
          next[eventId] = 'checking';
        });
        return next;
      });
    });

    (async () => {
      try {
        const batches = chunkArray(uncheckedIds, 30);
        const joinedEventIds = new Set();

        for (let index = 0; index < batches.length; index += 1) {
          const batch = batches[index];
          // eslint-disable-next-line no-await-in-loop
          const joined = await withTimeout(
            fetchMyJoinedEventsForIds(lookupUserUid, batch),
            MEMBERSHIP_LOOKUP_TIMEOUT_MS,
          );
          joined.forEach((eventId) => joinedEventIds.add(eventId));
        }

        if (!isLookupCurrent(lookupUserUid)) {
          return;
        }

        setMyJoinedEventIds((previous) => {
          const next = new Set(previous);
          uncheckedIds.forEach((eventId) => {
            if (joinedEventIds.has(eventId)) {
              next.add(eventId);
            } else {
              next.delete(eventId);
            }
          });
          return next;
        });

        setMembershipStatusByEventId((previous) => {
          const next = { ...previous };
          uncheckedIds.forEach((eventId) => {
            next[eventId] = joinedEventIds.has(eventId) ? 'joined' : 'notJoined';
          });
          return next;
        });

        uncheckedIds.forEach((eventId) => membershipCheckedRef.current.add(eventId));
      } catch (error) {
        console.error('查詢已參加活動失敗:', error);
        if (!isLookupCurrent(lookupUserUid)) {
          return;
        }

        setMyJoinedEventIds((previous) => {
          const next = new Set(previous);
          uncheckedIds.forEach((eventId) => next.delete(eventId));
          return next;
        });

        setMembershipStatusByEventId((previous) => {
          const next = { ...previous };
          uncheckedIds.forEach((eventId) => {
            next[eventId] = 'notJoined';
          });
          return next;
        });

        uncheckedIds.forEach((eventId) => membershipCheckedRef.current.add(eventId));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [events, isMountedRef, user?.uid]);

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
          setMembershipStatusByEventId((previous) => ({ ...previous, [eventId]: 'joined' }));
          membershipCheckedRef.current.add(eventId);

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
          setMembershipStatusByEventId((previous) => ({ ...previous, [eventId]: 'notJoined' }));
          membershipCheckedRef.current.add(eventId);
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
    [isMountedRef, setEvents, showToast, user],
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
          setMembershipStatusByEventId((previous) => ({ ...previous, [eventId]: 'notJoined' }));
          membershipCheckedRef.current.add(eventId);

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
    [isMountedRef, setEvents, showToast, user],
  );

  const canExposeMembershipState = Boolean(user?.uid)
    && membershipUserUid === user.uid;

  return {
    pendingByEventId,
    myJoinedEventIds: canExposeMembershipState ? myJoinedEventIds : new Set(),
    membershipStatusByEventId: canExposeMembershipState ? membershipStatusByEventId : {},
    handleJoinClick,
    handleLeaveClick,
  };
}
