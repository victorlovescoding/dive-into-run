'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import {
  addComment,
  deleteComment,
  fetchCommentHistory,
  getCommentById,
  updateComment,
} from '@/runtime/client/use-cases/post-use-cases';
import {
  createSubmittedCommentFallback,
  hydrateComments,
  notifySubmittedPostComment,
} from '@/runtime/hooks/usePostCommentsHelpers';
import {
  usePostCommentsInfiniteScroll,
} from '@/runtime/hooks/usePostCommentsEffects';
import useCommentScrollTarget from '@/runtime/hooks/useCommentScrollTarget';
import useCommentEditModal from '@/runtime/hooks/useCommentEditModal';
import { useToast } from '@/runtime/providers/ToastProvider';

/**
 * @typedef {object} PostCommentsParams
 * @property {string} postId - 文章 ID。
 * @property {{ uid: string, name?: string, photoURL?: string } | null | undefined} user - 目前登入使用者。
 * @property {object | null} postDetail - 文章詳情（用於通知與留言數更新）。
 * @property {(updater: (prev: object | null) => object | null) => void} setPostDetail - 更新文章詳情的 setter。
 * @property {(id: string) => void} setOpenMenuPostId - 設定開啟選單的文章 ID。
 */

/**
 * @typedef {object} PostCommentsReturn
 * @property {Array<object>} comments - 帶有 isAuthor 的留言清單。
 * @property {string} comment - 目前留言輸入框文字。
 * @property {object | null} editingComment - 正在編輯中的留言。
 * @property {object | null} commentEditing - 舊名稱相容欄位，等同 editingComment。
 * @property {object | null} historyComment - 正在檢視編輯歷史的留言。
 * @property {Array<object>} historyEntries - 編輯歷史列表。
 * @property {string | null} historyError - 編輯歷史載入錯誤訊息。
 * @property {boolean} isUpdating - 是否正在儲存留言編輯。
 * @property {string | null} updateError - 留言編輯錯誤訊息。
 * @property {string | null} highlightedCommentId - 需高亮的留言 ID。
 * @property {boolean} isLoadingNext - 是否正在載入下一頁留言。
 * @property {boolean} isSubmitting - 是否正在送出新留言。
 * @property {boolean} hasMore - 是否仍有下一頁留言。
 * @property {import('react').RefObject<HTMLDivElement | null>} bottomRef - 無限捲動哨兵元素 ref。
 * @property {(commentId: string, newContent?: string) => void | Promise<boolean>} handleEditComment - 開啟或相容儲存指定留言。
 * @property {(newContent: string) => Promise<boolean>} handleEditSave - 儲存目前編輯留言。
 * @property {() => void} handleEditCancel - 取消目前編輯留言。
 * @property {(commentId: string) => Promise<void>} handleDeleteComment - 刪除指定留言。
 * @property {(comment: object) => Promise<void>} handleViewHistory - 查看留言編輯歷史。
 * @property {() => void} handleCloseHistory - 關閉編輯歷史 modal。
 * @property {() => void} handleHistoryClose - 舊名稱相容欄位，等同 handleCloseHistory。
 * @property {(contentOrEvent: string | Event) => Promise<boolean>} handleSubmitComment - 送出新留言。
 * @property {(event: Event) => void} handleCommentChange - 留言輸入框 onChange。
 * @property {(data: { comments: Array<object>, nextCursor: object | null, hasMore?: boolean }) => void} setInitialComments - 由父層設定初始留言與 cursor。
 */

/**
 * 管理文章留言的狀態、無限捲動、高亮與 CRUD 操作。
 * @param {PostCommentsParams} params - 留言 hook 所需參數。
 * @returns {PostCommentsReturn} 留言狀態與操作。
 */
export default function usePostComments({
  postId,
  user,
  postDetail,
  setPostDetail,
  setOpenMenuPostId,
}) {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCommentId, setSubmittedCommentId] = useState(
    /** @type {string | null} */ (null),
  );
  const [historyComment, setHistoryComment] = useState(/** @type {object | null} */ (null));
  const [historyEntries, setHistoryEntries] = useState(/** @type {Array<object>} */ ([]));
  const [historyError, setHistoryError] = useState(/** @type {string | null} */ (null));

  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isMountedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const userUid = user?.uid ?? null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const urlCommentId = searchParams.get('commentId');
  const highlightedCommentId = submittedCommentId ?? urlCommentId;

  const actor = useMemo(() => {
    if (!userUid) return null;
    return {
      uid: userUid,
      name: user.name || '',
      photoURL: user.photoURL || '',
    };
  }, [user, userUid]);

  /**
   * 由父層（loadPostDetail）設定初始留言與 cursor。
   * @param {{ comments: Array<object>, nextCursor: object | null, hasMore?: boolean }} data - 初始留言資料。
   */
  const setInitialComments = useCallback(
    (data) => {
      setComments(hydrateComments(data.comments, userUid));
      setNextCursor(data.nextCursor);
      setHasMore(typeof data.hasMore === 'boolean' ? data.hasMore : Boolean(data.nextCursor));
    },
    [userUid],
  );

  usePostCommentsInfiniteScroll({
    bottomRef,
    nextCursor,
    hasMore,
    isLoadingNext,
    postId,
    userUid,
    commentsLength: comments.length,
    isMountedRef,
    setIsLoadingNext,
    setNextCursor,
    setHasMore,
    setComments,
    hydrateComments,
  });
  useCommentScrollTarget(highlightedCommentId);

  // --- Handlers ---

  const saveEditedPostComment = useCallback(
    async (targetComment, newContent) => {
      const trimmedText = newContent.trim();
      const currentComment =
        comments.find((commentItem) => commentItem.id === targetComment.id) ?? targetComment;
      const previousText = currentComment.comment ?? targetComment.comment ?? '';
      const previousIsEdited = currentComment.isEdited ?? targetComment.isEdited ?? false;
      const previousUpdatedAt = currentComment.updatedAt ?? targetComment.updatedAt ?? null;
      const optimisticUpdatedAt = createFirestoreTimestamp(new Date());

      setComments((prev) =>
        prev.map((commentItem) =>
          commentItem.id === targetComment.id
            ? {
                ...commentItem,
                comment: trimmedText,
                isEdited: true,
                updatedAt: optimisticUpdatedAt,
              }
            : commentItem,
        ),
      );

      try {
        await updateComment(postId, targetComment.id, {
          comment: trimmedText,
          currentComment: previousText,
        });
      } catch (saveError) {
        setComments((prev) =>
          prev.map((commentItem) =>
            commentItem.id === targetComment.id
              ? {
                  ...commentItem,
                  comment: previousText,
                  isEdited: previousIsEdited,
                  updatedAt: previousUpdatedAt,
                }
              : commentItem,
          ),
        );
        throw saveError;
      }
    },
    [comments, postId],
  );

  const handleViewHistory = useCallback(
    async (targetComment) => {
      setHistoryComment(targetComment);
      setHistoryError(null);

      try {
        const entries = await fetchCommentHistory(postId, targetComment.id);
        setHistoryEntries(entries);
      } catch {
        setHistoryError('載入編輯記錄失敗');
        setHistoryEntries([]);
      }
    },
    [postId],
  );

  const handleCloseHistory = useCallback(() => {
    setHistoryComment(null);
    setHistoryEntries([]);
    setHistoryError(null);
  }, []);

  const {
    editingComment,
    isUpdating,
    updateError,
    handleEditOpen,
    handleEditSave,
    handleEditCancel,
  } = useCommentEditModal({ saveComment: saveEditedPostComment });

  const editingCommentId = editingComment?.id ?? null;

  /**
   * 開始編輯指定留言；第二參數保留給既有 runtime bridge 的儲存相容路徑。
   * @param {string} commentId - 要編輯的留言 ID。
   * @param {string} [newContent] - 相容儲存內容。
   * @returns {void | Promise<boolean>} 開啟時無回傳；相容儲存時回傳成功狀態。
   */
  const handleEditComment = useCallback(
    (commentId, newContent) => {
      if (typeof newContent === 'string') {
        return handleEditSave(newContent);
      }

      const target = comments.find((commentItem) => commentItem.id === commentId);
      if (!target) return undefined;

      handleEditOpen(target);
      setOpenMenuPostId('');
      return undefined;
    },
    [comments, handleEditOpen, handleEditSave, setOpenMenuPostId],
  );

  /**
   * 刪除指定留言。
   * @param {string} commentId - 要刪除的留言 ID。
   */
  const handleDeleteComment = useCallback(
    async (commentId) => {
      if (!userUid) {
        showToast('請先登入才能刪除留言', 'error');
        return;
      }

      // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
      if (!window.confirm('確定要刪除留言？')) return;

      try {
        await deleteComment(postId, commentId, userUid);

        if (editingCommentId === commentId) handleEditCancel();

        setComments((prev) => prev.filter((commentItem) => commentItem.id !== commentId));
        setPostDetail((prev) =>
          prev
            ? {
                ...prev,
                commentsCount: Math.max(0, Number(prev.commentsCount ?? 0) - 1),
              }
            : prev,
        );
        setOpenMenuPostId('');
      } catch (deleteError) {
        showToast('刪除失敗，請稍後再試', 'error');
        console.error(deleteError);
      }
    },
    [
      editingCommentId,
      handleEditCancel,
      postId,
      setOpenMenuPostId,
      setPostDetail,
      showToast,
      userUid,
    ],
  );

  /**
   * 送出新留言。
   * @param {string | Event} contentOrEvent - 新留言內容；舊表單事件路徑會使用目前 draft。
   * @returns {Promise<boolean>} 成功送出時為 true，失敗或被擋下時為 false。
   */
  const handleSubmitComment = useCallback(
    async (contentOrEvent) => {
      if (typeof contentOrEvent !== 'string') {
        contentOrEvent.preventDefault();
      }

      if (isSubmittingRef.current) return false;

      const rawComment = typeof contentOrEvent === 'string' ? contentOrEvent : comment;
      const trimmedComment = rawComment.trim();
      if (!trimmedComment || !postDetail) return false;

      if (!user?.uid) {
        showToast('請先登入才能留言', 'info');
        return false;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);

      try {
        let id;
        try {
          ({ id } = await addComment(postId, { user, comment: rawComment }));
        } catch (submitError) {
          console.error(submitError);
          return false;
        }

        notifySubmittedPostComment({
          actor,
          postId,
          postDetail,
          commentId: id,
          userUid: user.uid,
          showToast,
        });

        setComment('');

        const mine = await getCommentById(postId, id).catch((fetchError) => {
          console.error('留言讀取失敗:', fetchError);
          return null;
        });
        const hydratedComment =
          mine ?? createSubmittedCommentFallback({ id, user, rawComment });

        setComments((prev) => [{ ...hydratedComment, isAuthor: true }, ...prev]);
        setSubmittedCommentId(id);
        setPostDetail((prev) =>
          prev
            ? {
                ...prev,
                commentsCount: Math.max(0, Number(prev.commentsCount ?? 0) + 1),
              }
            : prev,
        );
        return true;
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [actor, comment, postDetail, postId, setPostDetail, showToast, user],
  );

  /**
   * 留言輸入框 onChange handler。
   * @param {Event} event - input change 事件。
   */
  const handleCommentChange = useCallback((event) => {
    setComment(event.target.value);
  }, []);

  return {
    comments,
    comment,
    editingComment,
    commentEditing: editingComment,
    historyComment,
    historyEntries,
    historyError,
    isUpdating,
    updateError,
    highlightedCommentId,
    isLoadingNext,
    isSubmitting,
    hasMore,
    bottomRef,
    handleEditComment,
    handleEditSave,
    handleEditCancel,
    handleDeleteComment,
    handleViewHistory,
    handleCloseHistory,
    handleHistoryClose: handleCloseHistory,
    handleSubmitComment,
    handleCommentChange,
    setInitialComments,
  };
}
