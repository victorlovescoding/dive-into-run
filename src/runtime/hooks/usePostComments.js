'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import {
  addComment,
  deleteComment,
  getCommentById,
  updateComment,
} from '@/runtime/client/use-cases/post-use-cases';
import {
  notifyPostCommentReply,
  notifyPostNewComment,
} from '@/runtime/client/use-cases/notification-use-cases';
import {
  usePostCommentsInfiniteScroll,
  useScrollToHighlightedComment,
} from '@/runtime/hooks/usePostCommentsEffects';
import useCommentEditModal from '@/runtime/hooks/useCommentEditModal';
import { useToast } from '@/runtime/providers/ToastProvider';

/**
 * 將留言加上目前使用者視角的 UI flag。
 * @param {Array<object>} comments - 原始留言清單。
 * @param {string | null | undefined} userUid - 目前使用者 UID。
 * @returns {Array<object>} 帶有 isAuthor 的留言清單。
 */
function hydrateComments(comments, userUid) {
  return (Array.isArray(comments) ? comments : []).map((commentItem) => ({
    ...commentItem,
    isAuthor: commentItem.authorUid === userUid,
  }));
}

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
 * @property {boolean} isUpdating - 是否正在儲存留言編輯。
 * @property {string | null} updateError - 留言編輯錯誤訊息。
 * @property {string | null} highlightedCommentId - 需高亮的留言 ID。
 * @property {boolean} isLoadingNext - 是否正在載入下一頁留言。
 * @property {import('react').RefObject<HTMLDivElement | null>} bottomRef - 無限捲動哨兵元素 ref。
 * @property {(commentId: string, newContent?: string) => void | Promise<boolean>} handleEditComment - 開啟或相容儲存指定留言。
 * @property {(newContent: string) => Promise<boolean>} handleEditSave - 儲存目前編輯留言。
 * @property {() => void} handleEditCancel - 取消目前編輯留言。
 * @property {(commentId: string) => Promise<void>} handleDeleteComment - 刪除指定留言。
 * @property {(event: Event) => Promise<void>} handleSubmitComment - 送出或更新留言。
 * @property {(event: Event) => void} handleCommentChange - 留言輸入框 onChange。
 * @property {(data: { comments: Array<object>, nextCursor: object | null }) => void} setInitialComments - 由父層設定初始留言與 cursor。
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
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isMountedRef = useRef(false);
  const userUid = user?.uid ?? null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const highlightedCommentId = searchParams.get('commentId');

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
   * @param {{ comments: Array<object>, nextCursor: object | null }} data - 初始留言資料。
   */
  const setInitialComments = useCallback(
    (data) => {
      setComments(hydrateComments(data.comments, userUid));
      setNextCursor(data.nextCursor);
    },
    [userUid],
  );

  usePostCommentsInfiniteScroll({
    bottomRef,
    nextCursor,
    isLoadingNext,
    postId,
    userUid,
    commentsLength: comments.length,
    isMountedRef,
    setIsLoadingNext,
    setNextCursor,
    setComments,
    hydrateComments,
  });
  useScrollToHighlightedComment(searchParams);

  // --- Handlers ---

  const saveEditedPostComment = useCallback(
    async (targetComment, newContent) => {
      const trimmedText = newContent.trim();
      const previousText =
        comments.find((commentItem) => commentItem.id === targetComment.id)?.comment ??
        targetComment.comment ??
        '';

      setComments((prev) =>
        prev.map((commentItem) =>
          commentItem.id === targetComment.id
            ? { ...commentItem, comment: trimmedText }
            : commentItem,
        ),
      );

      try {
        await updateComment(postId, targetComment.id, { comment: trimmedText });
      } catch (saveError) {
        setComments((prev) =>
          prev.map((commentItem) =>
            commentItem.id === targetComment.id
              ? { ...commentItem, comment: previousText }
              : commentItem,
          ),
        );
        throw saveError;
      }
    },
    [comments, postId],
  );

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
   * 送出新留言或更新正在編輯的留言。
   * @param {Event} event - 表單送出事件。
   */
  const handleSubmitComment = useCallback(
    async (event) => {
      event.preventDefault();

      const trimmedComment = comment.trim();
      if (!trimmedComment || !postDetail) return;

      if (!user?.uid) {
        showToast('請先登入才能留言', 'info');
        return;
      }

      const rawComment = comment;
      const { id } = await addComment(postId, { user, comment: rawComment });

      if (!actor) return;

      if (user.uid !== postDetail.authorUid) {
        notifyPostNewComment(postId, postDetail.title, postDetail.authorUid, id, actor).catch(
          (notifyError) => {
            console.error('通知建立失敗:', notifyError);
            showToast('通知發送失敗', 'error');
          },
        );
      }

      notifyPostCommentReply(postId, postDetail.title, postDetail.authorUid, id, actor).catch(
        (notifyError) => {
          console.error('跟帖通知失敗:', notifyError);
        },
      );

      setComment('');

      const mine = await getCommentById(postId, id);
      const hydratedComment = mine ?? {
        id,
        authorUid: user.uid,
        authorName: user.name || '我',
        authorImgURL: user.photoURL || '',
        comment: rawComment,
        createdAt: createFirestoreTimestamp(new Date()),
      };

      setComments((prev) => [{ ...hydratedComment, isAuthor: true }, ...prev]);
      setPostDetail((prev) =>
        prev
          ? {
              ...prev,
              commentsCount: Math.max(0, Number(prev.commentsCount ?? 0) + 1),
            }
          : prev,
      );
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
    isUpdating,
    updateError,
    highlightedCommentId,
    isLoadingNext,
    bottomRef,
    handleEditComment,
    handleEditSave,
    handleEditCancel,
    handleDeleteComment,
    handleSubmitComment,
    handleCommentChange,
    setInitialComments,
  };
}
