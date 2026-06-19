'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * @template TComment
 * @typedef {object} UseCommentEditModalParams
 * @property {(comment: TComment, newContent: string) => Promise<void | boolean>} saveComment - 儲存留言編輯的 domain callback。
 * @property {string} [errorMessage] - 儲存失敗時顯示的錯誤訊息。
 */

/**
 * @template TComment
 * @typedef {object} UseCommentEditModalReturn
 * @property {TComment | null} editingComment - 目前正在編輯的留言。
 * @property {boolean} isUpdating - 是否正在儲存編輯。
 * @property {string | null} updateError - 儲存失敗錯誤訊息。
 * @property {(comment: TComment) => void} handleEditOpen - 開啟編輯 modal。
 * @property {(newContent: string) => Promise<boolean>} handleEditSave - 儲存目前編輯內容。
 * @property {() => void} handleEditCancel - 取消並關閉編輯 modal。
 */

/**
 * 管理留言編輯 modal state，儲存行為由呼叫端注入以保持 domain-neutral。
 * @template TComment
 * @param {UseCommentEditModalParams<TComment>} params - Hook 設定。
 * @returns {UseCommentEditModalReturn<TComment>} 編輯 modal 狀態與操作。
 */
export default function useCommentEditModal({
  saveComment,
  errorMessage = '更新失敗，請再試一次',
}) {
  const [editingComment, setEditingComment] = useState(/** @type {TComment | null} */ (null));
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(/** @type {string | null} */ (null));
  const isMountedRef = useRef(false);
  const saveRequestIdRef = useRef(0);

  useLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      saveRequestIdRef.current += 1;
    };
  }, []);

  const handleEditOpen = useCallback((comment) => {
    saveRequestIdRef.current += 1;
    setEditingComment(comment);
    setIsUpdating(false);
    setUpdateError(null);
  }, []);

  const handleEditCancel = useCallback(() => {
    saveRequestIdRef.current += 1;
    setEditingComment(null);
    setIsUpdating(false);
    setUpdateError(null);
  }, []);

  const handleEditSave = useCallback(
    async (newContent) => {
      if (!editingComment) return false;

      const saveRequestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = saveRequestId;
      const isCurrentSave = () =>
        isMountedRef.current && saveRequestIdRef.current === saveRequestId;

      setIsUpdating(true);
      setUpdateError(null);
      try {
        const saveResult = await saveComment(editingComment, newContent);
        if (!isCurrentSave() || saveResult === false) return false;

        setEditingComment(null);
        return true;
      } catch {
        if (!isCurrentSave()) return false;

        setUpdateError(errorMessage);
        return false;
      } finally {
        if (isCurrentSave()) {
          setIsUpdating(false);
        }
      }
    },
    [editingComment, errorMessage, saveComment],
  );

  return {
    editingComment,
    isUpdating,
    updateError,
    handleEditOpen,
    handleEditSave,
    handleEditCancel,
  };
}
