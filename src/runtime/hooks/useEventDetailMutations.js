'use client';

import { useCallback, useMemo, useState } from 'react';
import { createFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import { toMs } from '@/runtime/events/event-runtime-helpers';
import {
  deleteEvent,
  EVENT_NOT_FOUND_MESSAGE,
  fetchParticipants,
  updateEvent,
} from '@/runtime/client/use-cases/event-use-cases';
import {
  notifyEventCancelled,
  notifyEventModified,
  notifyEventNewComment,
} from '@/runtime/client/use-cases/notification-use-cases';
/**
 * @typedef {import('@/service/event-service').EventData} EventData
 */

/**
 * @typedef {object} MutationParams
 * @property {string} id - 活動 ID。
 * @property {EventData | null} event - 當前活動資料。
 * @property {(updater: (prev: EventData | null) => EventData | null) => void} setEvent - 更新活動資料的 setter。
 * @property {(error: string | null) => void} setError - 設定錯誤訊息的 setter。
 * @property {ReturnType<import('next/navigation').useRouter>} router - Next.js App Router 實例。
 * @property {{ uid?: string, name?: string, photoURL?: string } | null} user - 當前登入使用者。
 * @property {(message: string, type?: string) => void} showToast - Toast 訊息顯示函式。
 * @property {{ current: boolean }} isMountedRef - 元件是否仍掛載的 ref。
 */

/**
 * @typedef {object} MutationReturn
 * @property {EventData | null} editingEvent - 正在編輯的活動資料（null 表示未在編輯）。
 * @property {boolean} isUpdating - 是否正在提交編輯更新。
 * @property {string | null} deletingEventId - 正在刪除確認的活動 ID（null 表示未在刪除）。
 * @property {boolean} isDeletingEvent - 是否正在執行刪除操作。
 * @property {(nextEvent: EventData) => void} handleEditEvent - 開啟編輯表單。
 * @property {() => void} handleEditCancel - 取消編輯。
 * @property {(changedData: { id: string, [key: string]: unknown }) => Promise<void>} handleEditSubmit - 提交活動編輯更新。
 * @property {(nextEvent: EventData) => void} handleDeleteEventRequest - 開啟刪除確認對話框。
 * @property {() => void} handleDeleteCancel - 取消刪除。
 * @property {(eventId: string) => Promise<void>} handleDeleteConfirm - 確認刪除活動。
 * @property {(commentId: string) => void} handleCommentAdded - 處理新留言通知。
 */

/**
 * 活動詳情頁的編輯/刪除/留言通知相關 state 與 handlers。
 * 從 useEventDetailRuntime 拆出，管理活動的 mutation 操作。
 * @param {MutationParams} params - mutation 功能所需的外部依賴。
 * @returns {MutationReturn} mutation 相關 state 與 handlers。
 */
export default function useEventDetailMutations({
  id,
  event,
  setEvent,
  setError,
  router,
  user,
  showToast,
  isMountedRef,
}) {
  const [editingEvent, setEditingEvent] = useState(/** @type {EventData | null} */ (null));
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(/** @type {string | null} */ (null));
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const actor = useMemo(() => {
    if (!user?.uid) return null;
    return {
      uid: user.uid,
      name: user.name || '',
      photoURL: user.photoURL || '',
    };
  }, [user]);

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
    [actor, editingEvent, event?.title, isMountedRef, setEvent, showToast],
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
    [actor, event?.title, isMountedRef, router, setError, setEvent, showToast],
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

  return {
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
  };
}
