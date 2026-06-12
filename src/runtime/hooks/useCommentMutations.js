import { useState, useEffect, useRef, useCallback } from 'react';
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

  const [deletingComment, setDeletingComment] = useState(/** @type {CommentData | null} */ (null));
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(/** @type {string | null} */ (null));

  const [historyComment, setHistoryComment] = useState(/** @type {CommentData | null} */ (null));
  const [historyEntries, setHistoryEntries] = useState(/** @type {CommentHistoryEntry[]} */ ([]));
  const [historyError, setHistoryError] = useState(/** @type {string | null} */ (null));

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (content) => {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const newComment = await addComment(eventId, user, content);
        setComments((prev) => [newComment, ...prev]);
        setHighlightId(newComment.id);
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => setHighlightId(null), 2000);
        onSuccess?.(newComment.id);
        return true;
      } catch {
        setSubmitError('送出失敗，請再試一次');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [eventId, user, setComments, onSuccess],
  );

  const saveEditedComment = useCallback(
    async (targetComment, newContent) => {
      await updateComment(eventId, targetComment.id, newContent, targetComment.content);
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

  const handleEditSave = useCallback(
    async (newContent) => {
      await handleEditSaveWithResult(newContent);
    },
    [handleEditSaveWithResult],
  );

  const handleDeleteOpen = useCallback((comment) => {
    setDeletingComment(comment);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingComment) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteComment(eventId, deletingComment.id);
      setComments((prev) => prev.filter((c) => c.id !== deletingComment.id));
      options.onCommentDeleted?.(deletingComment.id);
      setDeletingComment(null);
    } catch {
      setDeleteError('刪除失敗，請再試一次');
    } finally {
      setIsDeleting(false);
    }
  }, [eventId, deletingComment, options, setComments]);

  const handleDeleteCancel = useCallback(() => {
    setDeletingComment(null);
    setDeleteError(null);
  }, []);

  const handleViewHistory = useCallback(
    async (comment) => {
      setHistoryComment(comment);
      setHistoryError(null);
      try {
        const entries = await fetchCommentHistory(eventId, comment.id);
        setHistoryEntries(entries);
      } catch {
        setHistoryError('載入編輯記錄失敗');
        setHistoryEntries([]);
      }
    },
    [eventId],
  );

  const handleHistoryClose = useCallback(() => {
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
