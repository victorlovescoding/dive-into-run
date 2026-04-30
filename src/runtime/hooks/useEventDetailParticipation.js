'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import bindParticipantsOverlayListeners from '@/runtime/events/event-detail-participation-runtime-helpers';
import { toNumber } from '@/runtime/events/event-runtime-helpers';
import { buildUserPayload, getRemainingSeats, isDeadlinePassed } from '@/service/event-service';
import {
  fetchMyJoinedEventsForIds,
  fetchParticipants,
  joinEvent,
  leaveEvent,
} from '@/runtime/client/use-cases/event-use-cases';
/**
 * @typedef {import('@/service/event-service').EventData} EventData
 */

/**
 * @typedef {object} ParticipationParams
 * @property {string} id - 活動 ID。
 * @property {EventData | null} event - 當前活動資料。
 * @property {(updater: (prev: EventData | null) => EventData | null) => void} setEvent - 更新活動資料的 setter。
 * @property {{ uid?: string, name?: string, photoURL?: string } | null} user - 當前登入使用者。
 * @property {(message: string, type?: string) => void} showToast - Toast 訊息顯示函式。
 * @property {{ current: boolean }} isMountedRef - 元件是否仍掛載的 ref。
 */

/**
 * @typedef {object} ParticipationReturn
 * @property {Array<{ id: string, uid: string, name: string, photoURL: string, eventId: string }>} participants - 參加者清單。
 * @property {boolean} participantsLoading - 是否正在載入參加者清單。
 * @property {string | null} participantsError - 參加者清單載入錯誤訊息。
 * @property {boolean} isParticipantsOpen - 參加者名單 overlay 是否開啟。
 * @property {import('react').RefObject<HTMLDivElement | null>} participantsOverlayRef - 參加者名單 overlay DOM ref。
 * @property {'joining' | 'leaving' | null} pending - 目前進行中的參加/退出操作。
 * @property {boolean} isJoined - 當前使用者是否已參加此活動。
 * @property {number} remainingSeats - 剩餘可報名名額。
 * @property {string} participationState - 使用者參加狀態（unavailable/login_required/host/joined/full/deadline_passed/can_join）。
 * @property {() => Promise<void>} refreshParticipants - 重新載入參加者清單。
 * @property {() => Promise<void>} handleJoin - 報名參加活動。
 * @property {() => Promise<void>} handleLeave - 取消報名。
 * @property {() => Promise<void>} handleOpenParticipants - 開啟參加者名單 overlay。
 * @property {() => void} handleCloseParticipants - 關閉參加者名單 overlay。
 */

/**
 * 活動詳情頁的參加相關 state 與 handlers。
 * 從 useEventDetailRuntime 拆出，管理參加者清單、報名/退出、overlay 互動。
 * @param {ParticipationParams} params - 參加功能所需的外部依賴。
 * @returns {ParticipationReturn} 參加相關 state 與 handlers。
 */
export default function useEventDetailParticipation({
  id,
  event,
  setEvent,
  user,
  showToast,
  isMountedRef,
}) {
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState(null);
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const participantsOverlayRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const [pending, setPending] = useState(/** @type {'joining' | 'leaving' | null} */ (null));
  const [isJoined, setIsJoined] = useState(false);

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
  }, [id, isMountedRef]);

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
  }, [id, isMountedRef, user?.uid]);

  const handleCloseParticipants = useCallback(() => {
    setParticipantsOpen(false);
  }, []);

  useEffect(() => {
    if (!isParticipantsOpen) return undefined;
    return bindParticipantsOverlayListeners(
      participantsOverlayRef.current,
      handleCloseParticipants,
    );
  }, [handleCloseParticipants, isParticipantsOpen]);

  const handleOpenParticipants = useCallback(async () => {
    setParticipantsOpen(true);
    await refreshParticipants();
  }, [refreshParticipants]);

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
  }, [event, id, isMountedRef, participants.length, setEvent, showToast, user]);

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
  }, [id, isMountedRef, participants.length, setEvent, showToast, user]);

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

  return {
    participants,
    participantsLoading,
    participantsError,
    isParticipantsOpen,
    participantsOverlayRef,
    pending,
    isJoined,
    remainingSeats,
    participationState,
    refreshParticipants,
    handleJoin,
    handleLeave,
    handleOpenParticipants,
    handleCloseParticipants,
  };
}
