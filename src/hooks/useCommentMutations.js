import { useState, useEffect, useRef, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  addComment,
  updateComment,
  deleteComment,
  fetchCommentHistory,
} from '@/lib/firebase-comments';

/**
 * @typedef {import('@/lib/firebase-comments').CommentData} CommentData
 * @typedef {import('@/lib/firebase-comments').CommentHistoryEntry} CommentHistoryEntry
 */

/**
 * @typedef {object} UseCommentMutationsReturn
 * @property {boolean} isSubmitting - 送出留言中。
 * @property {string | null} submitError - 送出錯誤訊息。
 * @property {string | null} highlightId - 高亮留言 ID。
 * @property {number} submitKey - 用於 key reset CommentInput。
 * @property {(content: string) => Promise<void>} handleSubmit - 送出新留言。
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
 * @returns {UseCommentMutationsReturn} mutation 狀態與操作。
 */
export default function useCommentMutations(eventId, user, setComments) {
  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(/** @type {string | null} */ (null));
  const [highlightId, setHighlightId] = useState(/** @type {string | null} */ (null));
  const [submitKey, setSubmitKey] = useState(0);
  const highlightTimeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  // Edit state
  const [editingComment, setEditingComment] = useState(/** @type {CommentData | null} */ (null));
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(/** @type {string | null} */ (null));

  // Delete state
  const [deletingComment, setDeletingComment] = useState(/** @type {CommentData | null} */ (null));
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(/** @type {string | null} */ (null));

  // History state
  const [historyComment, setHistoryComment] = useState(/** @type {CommentData | null} */ (null));
  const [historyEntries, setHistoryEntries] = useState(/** @type {CommentHistoryEntry[]} */ ([]));
  const [historyError, setHistoryError] = useState(/** @type {string | null} */ (null));

  // Cleanup highlight timeout on unmount
  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    },
    [],
  );

  // --- Submit ---
  /** @type {(content: string) => Promise<void>} */
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
        setSubmitKey((k) => k + 1);
      } catch {
        setSubmitError('送出失敗，請再試一次');
      } finally {
        setIsSubmitting(false);
      }
    },
    [eventId, user, setComments],
  );

  // --- Edit ---
  /** @type {(comment: CommentData) => void} */
  const handleEditOpen = useCallback((comment) => {
    setEditingComment(comment);
    setUpdateError(null);
  }, []);

  /** @type {(newContent: string) => Promise<void>} */
  const handleEditSave = useCallback(
    async (newContent) => {
      if (!editingComment) return;
      setIsUpdating(true);
      setUpdateError(null);
      try {
        await updateComment(eventId, editingComment.id, newContent, editingComment.content);
        setComments((prev) =>
          prev.map((c) =>
            c.id === editingComment.id
              ? {
                  ...c,
                  content: newContent.trim(),
                  isEdited: true,
                  updatedAt: Timestamp.now(),
                }
              : c,
          ),
        );
        setEditingComment(null);
      } catch {
        setUpdateError('更新失敗，請再試一次');
      } finally {
        setIsUpdating(false);
      }
    },
    [eventId, editingComment, setComments],
  );

  /** @type {() => void} */
  const handleEditCancel = useCallback(() => {
    setEditingComment(null);
    setUpdateError(null);
  }, []);

  // --- Delete ---
  /** @type {(comment: CommentData) => void} */
  const handleDeleteOpen = useCallback((comment) => {
    setDeletingComment(comment);
    setDeleteError(null);
  }, []);

  /** @type {() => Promise<void>} */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingComment) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteComment(eventId, deletingComment.id);
      setComments((prev) => prev.filter((c) => c.id !== deletingComment.id));
      setDeletingComment(null);
    } catch {
      setDeleteError('刪除失敗，請再試一次');
    } finally {
      setIsDeleting(false);
    }
  }, [eventId, deletingComment, setComments]);

  /** @type {() => void} */
  const handleDeleteCancel = useCallback(() => {
    setDeletingComment(null);
    setDeleteError(null);
  }, []);

  // --- History ---
  /** @type {(comment: CommentData) => Promise<void>} */
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

  /** @type {() => void} */
  const handleHistoryClose = useCallback(() => {
    setHistoryComment(null);
    setHistoryEntries([]);
    setHistoryError(null);
  }, []);

  return {
    isSubmitting,
    submitError,
    highlightId,
    submitKey,
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
