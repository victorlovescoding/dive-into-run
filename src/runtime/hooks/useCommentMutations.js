import { useState, useLayoutEffect, useRef, useCallback } from 'react';
import {
  addComment,
  updateComment,
  deleteComment,
  fetchCommentHistory,
} from '@/runtime/client/use-cases/event-comment-use-cases';
import { getCurrentFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import useCommentEditModal from '@/runtime/hooks/useCommentEditModal';

/**
 * @typedef {import('@/service/event-comment-service').CommentData} CommentData
 * @typedef {import('@/service/event-comment-service').CommentHistoryEntry} CommentHistoryEntry
 */

/**
 * @typedef {object} UseCommentMutationsReturn
 * @property {boolean} isSubmitting - 送出留言中。
 * @property {string | null} submitError - 送出錯誤訊息。
 * @property {string | null} highlightId - 高亮留言 ID。
 * @property {(content: string) => Promise<boolean>} handleSubmit - 送出新留言。
 * @property {CommentData | null} editingComment - 正在編輯的留言。
 * @property {boolean} isUpdating - 編輯更新中。
 * @property {string | null} updateError - 編輯更新錯誤訊息。
 * @property {(comment: CommentData) => void} handleEditOpen - 開啟編輯 modal。
 * @property {(newContent: string) => Promise<void>} handleEditSave - 儲存編輯。
 * @property {() => void} handleEditCancel - 取消編輯。
 * @property {CommentData | null} deletingComment - 正在刪除的留言。
 * @property {boolean} isDeleting - 刪除中。
 * @property {string | null} deleteError - 刪除錯誤訊息。
 * @property {(comment: CommentData) => void} handleDeleteOpen - 開啟刪除確認。
 * @property {() => Promise<void>} handleDeleteConfirm - 確認刪除。
 * @property {() => void} handleDeleteCancel - 取消刪除。
 * @property {CommentData | null} historyComment - 查看歷史的留言。
 * @property {CommentHistoryEntry[]} historyEntries - 編輯歷史列表。
 * @property {string | null} historyError - 歷史載入錯誤訊息。
 * @property {(comment: CommentData) => Promise<void>} handleViewHistory - 查看編輯記錄。
 * @property {() => void} handleHistoryClose - 關閉歷史 modal。
 */

/**
 * 管理留言的新增、編輯、刪除與歷史記錄 state。
 * @param {string} eventId - 活動 ID。
 * @param {{ uid: string, name: string, photoURL: string } | null} user - 目前使用者。
 * @param {(updater: (prev: CommentData[]) => CommentData[]) => void} setComments - 更新留言列表。
 * @param {((commentId: string) => void)} [onSuccess] - 新留言建立成功後的回呼。
 * @param {{ onCommentUpdated?: (comment: CommentData) => void, onCommentDeleted?: (commentId: string) => void }} [options] - 獨立 pinned target 同步 callbacks。
 * @returns {UseCommentMutationsReturn} mutation 狀態與操作。
 */
export default function useCommentMutations(eventId, user, setComments, onSuccess, options = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(/** @type {string | null} */ (null));
  const [highlightId, setHighlightId] = useState(/** @type {string | null} */ (null));
  const highlightTimeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const isMountedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const submitRequestIdRef = useRef(0);
  const editRequestIdRef = useRef(0);
  const deleteRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const eventGuardRef = useRef({ eventId, generation: 0 });

  const [deletingComment, setDeletingComment] = useState(/** @type {CommentData | null} */ (null));
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(/** @type {string | null} */ (null));

  const [historyComment, setHistoryComment] = useState(/** @type {CommentData | null} */ (null));
  const [historyEntries, setHistoryEntries] = useState(/** @type {CommentHistoryEntry[]} */ ([]));
  const [historyError, setHistoryError] = useState(/** @type {string | null} */ (null));

  if (eventGuardRef.current.eventId !== eventId) {
    eventGuardRef.current = {
      eventId,
      generation: eventGuardRef.current.generation + 1,
    };
    submitInFlightRef.current = false;
  }

  useLayoutEffect(
    () => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        submitRequestIdRef.current += 1;
        editRequestIdRef.current += 1;
        deleteRequestIdRef.current += 1;
        historyRequestIdRef.current += 1;
        submitInFlightRef.current = false;
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = null;
        }
      };
    },
    [],
  );

  useLayoutEffect(() => {
    submitRequestIdRef.current += 1;
    editRequestIdRef.current += 1;
    deleteRequestIdRef.current += 1;
    historyRequestIdRef.current += 1;
    submitInFlightRef.current = false;
    setIsSubmitting(false);
    setSubmitError(null);
    setHighlightId(null);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setDeletingComment(null);
    setIsDeleting(false);
    setDeleteError(null);
    setHistoryComment(null);
    setHistoryEntries([]);
    setHistoryError(null);
  }, [eventId]);

  const handleSubmit = useCallback(
    async (content) => {
      if (submitInFlightRef.current) return false;

      submitInFlightRef.current = true;
      const submitRequestId = submitRequestIdRef.current + 1;
      const eventGeneration = eventGuardRef.current.generation;
      submitRequestIdRef.current = submitRequestId;
      const isCurrentSubmit = () =>
        isMountedRef.current &&
        eventGuardRef.current.generation === eventGeneration &&
        submitRequestIdRef.current === submitRequestId;

      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const newComment = await addComment(eventId, user, content);
        if (!isCurrentSubmit()) return false;

        setComments((prev) => [newComment, ...prev]);
        setHighlightId(newComment.id);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightId(null);
          highlightTimeoutRef.current = null;
        }, 2000);
        onSuccess?.(newComment.id);
        return true;
      } catch {
        if (!isCurrentSubmit()) return false;

        setSubmitError('送出失敗，請再試一次');
        return false;
      } finally {
        if (isCurrentSubmit()) {
          submitInFlightRef.current = false;
          setIsSubmitting(false);
        }
      }
    },
    [eventId, user, setComments, onSuccess],
  );

  const saveEditedComment = useCallback(
    async (targetComment, newContent) => {
      const editRequestId = editRequestIdRef.current + 1;
      const eventGeneration = eventGuardRef.current.generation;
      editRequestIdRef.current = editRequestId;
      const isCurrentEdit = () =>
        isMountedRef.current &&
        eventGuardRef.current.generation === eventGeneration &&
        editRequestIdRef.current === editRequestId;

      try {
        await updateComment(eventId, targetComment.id, newContent, targetComment.content);
      } catch (error) {
        if (!isCurrentEdit()) return false;
        throw error;
      }

      if (!isCurrentEdit()) return false;

      const updatedComment = {
        ...targetComment,
        content: newContent.trim(),
        isEdited: true,
        updatedAt: getCurrentFirestoreTimestamp(),
      };
      setComments((prev) =>
        prev.map((c) =>
          c.id === targetComment.id ? updatedComment : c,
        ),
      );
      options.onCommentUpdated?.(updatedComment);
      return true;
    },
    [eventId, options, setComments],
  );

  const {
    editingComment,
    isUpdating,
    updateError,
    handleEditOpen,
    handleEditSave: handleEditSaveWithResult,
    handleEditCancel,
  } = useCommentEditModal({ saveComment: saveEditedComment });

  useLayoutEffect(() => {
    handleEditCancel();
  }, [eventId, handleEditCancel]);

  const handleEditSave = useCallback(
    async (newContent) => {
      await handleEditSaveWithResult(newContent);
    },
    [handleEditSaveWithResult],
  );

  const handleDeleteOpen = useCallback((comment) => {
    deleteRequestIdRef.current += 1;
    setDeletingComment(comment);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingComment) return;
    const targetComment = deletingComment;
    const deleteRequestId = deleteRequestIdRef.current + 1;
    const eventGeneration = eventGuardRef.current.generation;
    deleteRequestIdRef.current = deleteRequestId;
    const isCurrentDelete = () =>
      isMountedRef.current &&
      eventGuardRef.current.generation === eventGeneration &&
      deleteRequestIdRef.current === deleteRequestId;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteComment(eventId, targetComment.id);
      if (!isCurrentDelete()) return;

      setComments((prev) => prev.filter((c) => c.id !== targetComment.id));
      options.onCommentDeleted?.(targetComment.id);
      setDeletingComment(null);
    } catch {
      if (!isCurrentDelete()) return;

      setDeleteError('刪除失敗，請再試一次');
    } finally {
      if (isCurrentDelete()) {
        setIsDeleting(false);
      }
    }
  }, [eventId, deletingComment, options, setComments]);

  const handleDeleteCancel = useCallback(() => {
    deleteRequestIdRef.current += 1;
    setDeletingComment(null);
    setDeleteError(null);
  }, []);

  const handleViewHistory = useCallback(
    async (comment) => {
      const historyRequestId = historyRequestIdRef.current + 1;
      const eventGeneration = eventGuardRef.current.generation;
      historyRequestIdRef.current = historyRequestId;
      const isCurrentHistory = () =>
        isMountedRef.current &&
        eventGuardRef.current.generation === eventGeneration &&
        historyRequestIdRef.current === historyRequestId;

      setHistoryComment(comment);
      setHistoryEntries([]);
      setHistoryError(null);
      try {
        const entries = await fetchCommentHistory(eventId, comment.id);
        if (!isCurrentHistory()) return;

        setHistoryEntries(entries);
      } catch {
        if (!isCurrentHistory()) return;

        setHistoryError('載入編輯記錄失敗');
        setHistoryEntries([]);
      }
    },
    [eventId],
  );

  const handleHistoryClose = useCallback(() => {
    historyRequestIdRef.current += 1;
    setHistoryComment(null);
    setHistoryEntries([]);
    setHistoryError(null);
  }, []);

  return {
    isSubmitting,
    submitError,
    highlightId,
    handleSubmit,
    editingComment,
    isUpdating,
    updateError,
    handleEditOpen,
    handleEditSave,
    handleEditCancel,
    deletingComment,
    isDeleting,
    deleteError,
    handleDeleteOpen,
    handleDeleteConfirm,
    handleDeleteCancel,
    historyComment,
    historyEntries,
    historyError,
    handleViewHistory,
    handleHistoryClose,
  };
}
