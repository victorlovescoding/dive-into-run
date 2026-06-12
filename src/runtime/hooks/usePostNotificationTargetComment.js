'use client';

import { useCallback } from 'react';
import { getCommentById } from '@/runtime/client/use-cases/post-use-cases';
import useNotificationTargetComment from '@/runtime/hooks/useNotificationTargetComment';

/**
 * @typedef {object} PostNotificationTargetCommentReturn
 * @property {object | null} pinnedComment - 置頂顯示的通知留言。
 * @property {Array<object>} visibleComments - 去掉 pinned ID 後的一般留言列表。
 * @property {string | null} activeTargetId - 給 scroll/highlight 使用的 target ID。
 * @property {boolean} isLoadingTargetComment - 是否正在載入通知留言。
 * @property {(comment: object) => void} updatePinnedComment - 更新 standalone pinned target。
 * @property {(commentId: string) => void} removePinnedComment - 移除 standalone pinned target。
 */

/**
 * Normalizes post comments into the shared CommentCard-facing target shape.
 * @param {object} commentItem - Raw post comment data.
 * @param {string | null} userUid - Current user UID.
 * @returns {object} Normalized post comment.
 */
function normalizePostTargetComment(commentItem, userUid) {
  return {
    ...commentItem,
    authorName: commentItem.authorName ?? '使用者',
    authorPhotoURL: commentItem.authorPhotoURL ?? commentItem.authorImgURL,
    content: commentItem.content ?? commentItem.comment ?? '',
    comment: commentItem.comment ?? commentItem.content ?? '',
    updatedAt: commentItem.updatedAt ?? null,
    isEdited: commentItem.isEdited ?? false,
    isAuthor: commentItem.isAuthor ?? commentItem.authorUid === userUid,
  };
}

/**
 * Reads a post comment id for the shared target comment hook.
 * @param {object} commentItem - Post comment data.
 * @returns {string} Post comment id.
 */
function getPostCommentId(commentItem) {
  return commentItem.id;
}

/**
 * Wires post-specific adapters into the shared notification target comment hook.
 * @param {object} params - Hook params.
 * @param {string} params.postId - Post ID.
 * @param {string | null} params.userUid - Current user UID.
 * @param {string | null} params.urlCommentId - URL notification comment ID.
 * @param {string | null} params.submittedCommentId - Locally submitted comment ID.
 * @param {Array<object>} params.comments - Current paginated post comments.
 * @param {boolean} params.isReady - Whether initial paginated comments are loaded.
 * @returns {PostNotificationTargetCommentReturn} Target comment state.
 */
export default function usePostNotificationTargetComment({
  postId,
  userUid,
  urlCommentId,
  submittedCommentId,
  comments,
  isReady,
}) {
  const loadNotificationTargetComment = useCallback(
    (commentId) => getCommentById(postId, commentId),
    [postId],
  );

  const normalizeNotificationTargetComment = useCallback(
    (commentItem) => normalizePostTargetComment(commentItem, userUid),
    [userUid],
  );

  return useNotificationTargetComment({
    targetCommentId: urlCommentId,
    submittedCommentId,
    comments,
    loadCommentById: loadNotificationTargetComment,
    normalizeComment: normalizeNotificationTargetComment,
    getCommentId: getPostCommentId,
    isReady,
  });
}
