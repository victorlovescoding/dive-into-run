'use client';

import { useCallback, useState } from 'react';
import { createFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import { toMs, toNumber } from '@/runtime/events/event-runtime-helpers';
import { buildRoutePayload } from '@/service/event-service';
import { createEvent, deleteEvent, updateEvent } from '@/runtime/client/use-cases/event-use-cases';
/**
 * @typedef {import('@/service/event-service').EventData} EventData
 */

/**
 * @typedef {import('react').MutableRefObject<boolean>} MountedRef
 */

/**
 * @typedef {object} CreateEventContext
 * @property {string} hostUid - 主辦者 UID。
 * @property {string} hostName - 主辦者顯示名稱。
 * @property {string} hostPhotoURL - 主辦者頭像 URL。
 * @property {{ lat: number, lng: number }[][] | null} routeCoordinates - 路線座標陣列。
 * @property {() => void} resetCreateForm - 建立成功後重設表單狀態的回呼。
 */

/**
 * @typedef {object} UseEventMutationsParams
 * @property {MountedRef} isMountedRef - 元件是否仍掛載的 ref。
 * @property {(updater: EventData[] | ((previous: EventData[]) => EventData[])) => void} setEvents - 設定活動列表的 setter。
 * @property {(message: string, type?: string) => void} showToast - Toast 訊息顯示函式。
 * @property {CreateEventContext} createCtx - 建立活動所需的外部上下文。
 */

/**
 * @typedef {object} UseEventMutationsReturn
 * @property {EventData | null} editingEvent - 正在編輯的活動資料。
 * @property {boolean} isUpdating - 是否正在更新活動。
 * @property {string | null} deletingEventId - 正在刪除確認的活動 ID。
 * @property {boolean} isDeletingEvent - 是否正在刪除活動。
 * @property {boolean} isCreating - 是否正在建立活動。
 * @property {object | null} draftFormData - 建立失敗時暫存的表單草稿。
 * @property {(event: EventData) => void} handleEditEvent - 開啟編輯活動表單。
 * @property {() => void} handleEditCancel - 取消編輯活動。
 * @property {(changedData: { id: string, [key: string]: unknown }) => Promise<void>} handleEditSubmit - 提交活動編輯更新。
 * @property {(event: EventData) => void} handleDeleteEventRequest - 開啟刪除活動確認對話框。
 * @property {() => void} handleDeleteCancel - 取消刪除活動。
 * @property {(eventId: string) => Promise<void>} handleDeleteConfirm - 確認刪除活動。
 * @property {(event: import('react').FormEvent<HTMLFormElement>) => Promise<void>} handleSubmit - 提交建立活動表單。
 * @property {(data: object | null) => void} setDraftFormData - 設定表單草稿資料。
 */

/**
 * 管理活動建立、編輯與刪除的 mutation 操作。
 * @param {UseEventMutationsParams} params - mutation hook 所需的參數。
 * @returns {UseEventMutationsReturn} mutation 狀態與處理函式。
 */
export default function useEventMutations({ isMountedRef, setEvents, showToast, createCtx }) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftFormData, setDraftFormData] = useState(null);
  const [editingEvent, setEditingEvent] = useState(/** @type {EventData | null} */ (null));
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(/** @type {string | null} */ (null));
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

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
    [editingEvent, isMountedRef, setEvents, showToast],
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
    [isMountedRef, setEvents, showToast],
  );

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

      const routeCoordinatesSnapshot = Array.isArray(createCtx.routeCoordinates)
        ? createCtx.routeCoordinates.map((segment) =>
            segment.map((point) => ({ lat: point.lat, lng: point.lng })),
          )
        : null;

      const paceMin = Number(data.paceMinutes);
      const paceSecPart = Number(data.paceSeconds);
      const paceSec =
        Number.isFinite(paceMin) && Number.isFinite(paceSecPart) ? paceMin * 60 + paceSecPart : 0;

      const extra = {
        hostUid: createCtx.hostUid,
        hostName: createCtx.hostName,
        hostPhotoURL: createCtx.hostPhotoURL,
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
          /** @type {EventData} */ (newEventCard),
          ...previous.filter((item) => item.id !== newEventCard.id),
        ]);
        setDraftFormData(null);
        createCtx.resetCreateForm();
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
    [createCtx, isMountedRef, setEvents, showToast],
  );

  return {
    isCreating,
    draftFormData,
    setDraftFormData,
    editingEvent,
    isUpdating,
    deletingEventId,
    isDeletingEvent,
    handleSubmit,
    handleEditEvent,
    handleEditCancel,
    handleEditSubmit,
    handleDeleteEventRequest,
    handleDeleteCancel,
    handleDeleteConfirm,
  };
}
