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
 * @property {object | null} commentEditing - 正在編輯中的留言。
 * @property {string | null} highlightedCommentId - 需高亮的留言 ID。
 * @property {boolean} isLoadingNext - 是否正在載入下一頁留言。
 * @property {import('react').RefObject<HTMLDivElement | null>} bottomRef - 無限捲動哨兵元素 ref。
 * @property {(commentId: string) => void} handleEditComment - 開始編輯指定留言。
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
  const [commentEditing, setCommentEditing] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const highlightedCommentId = searchParams.get('commentId');

  const actor = useMemo(() => {
    if (!user?.uid) return null;
    return {
      uid: user.uid,
      name: user.name || '',
      photoURL: user.photoURL || '',
    };
  }, [user]);

  /**
   * 由父層（loadPostDetail）設定初始留言與 cursor。
   * @param {{ comments: Array<object>, nextCursor: object | null }} data - 初始留言資料。
   */
  const setInitialComments = useCallback(
    (data) => {
      setComments(hydrateComments(data.comments, user?.uid));
      setNextCursor(data.nextCursor);
    },
    [user?.uid],
  );

  usePostCommentsInfiniteScroll({
    bottomRef,
    nextCursor,
    isLoadingNext,
    postId,
    userUid: user?.uid,
    commentsLength: comments.length,
    isMountedRef,
    setIsLoadingNext,
    setNextCursor,
    setComments,
    hydrateComments,
  });
  useScrollToHighlightedComment(searchParams);

  // --- Handlers ---

  /**
   * 開始編輯指定留言。
   * @param {string} commentId - 要編輯的留言 ID。
   */
  const handleEditComment = useCallback(
    (commentId) => {
      const target = comments.find((commentItem) => commentItem.id === commentId);
      if (!target) return;
      setCommentEditing(target);
      setComment(target.comment);
    },
    [comments],
  );

  /**
   * 刪除指定留言。
   * @param {string} commentId - 要刪除的留言 ID。
   */
  const handleDeleteComment = useCallback(
    async (commentId) => {
      // eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
      if (!window.confirm('確定要刪除留言？')) return;

      try {
        await deleteComment(postId, commentId);

        if (commentEditing?.id === commentId) {
          setCommentEditing(null);
          setComment('');
        }

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
    [commentEditing?.id, postId, setOpenMenuPostId, setPostDetail, showToast],
  );

  /**
   * 送出新留言或更新正在編輯的留言。
   * @param {Event} event - 表單送出事件。
   */
  const handleSubmitComment = useCallback(
    async (event) => {
      event.preventDefault();

      if (!comment.trim() || !user?.uid || !postDetail) return;

      if (!commentEditing) {
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
        return;
      }

      const newText = comment.trim();
      const prevText =
        comments.find((commentItem) => commentItem.id === commentEditing.id)?.comment ?? '';

      setComments((prev) =>
        prev.map((commentItem) =>
          commentItem.id === commentEditing.id ? { ...commentItem, comment: newText } : commentItem,
        ),
      );

      try {
        await updateComment(postId, commentEditing.id, { comment: newText });
      } catch {
        setComments((prev) =>
          prev.map((commentItem) =>
            commentItem.id === commentEditing.id
              ? { ...commentItem, comment: prevText }
              : commentItem,
          ),
        );
      }

      setComment('');
      setCommentEditing(null);
    },
    [actor, comment, commentEditing, comments, postDetail, postId, setPostDetail, showToast, user],
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
    commentEditing,
    highlightedCommentId,
    isLoadingNext,
    bottomRef,
    handleEditComment,
    handleDeleteComment,
    handleSubmitComment,
    handleCommentChange,
    setInitialComments,
  };
}
