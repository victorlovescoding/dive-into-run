'use client';

import { createFirestoreTimestamp } from '@/config/client/firebase-timestamp';
import {
  notifyPostCommentReply,
  notifyPostNewComment,
} from '@/runtime/client/use-cases/notification-use-cases';

/**
 * @typedef {import('@/service/notification-service').Actor} Actor
 */

/**
 * 將留言加上目前使用者視角的 UI flag。
 * @param {Array<object>} comments - 原始留言清單。
 * @param {string | null | undefined} userUid - 目前使用者 UID。
 * @returns {Array<object>} 帶有 isAuthor 的留言清單。
 */
export function hydrateComments(comments, userUid) {
  return (Array.isArray(comments) ? comments : []).map((commentItem) => ({
    ...commentItem,
    isAuthor: commentItem.authorUid === userUid,
  }));
}

/**
 * @param {object} params - 通知所需資料。
 * @param {Actor | null} params.actor - 留言者。
 * @param {string} params.postId - 文章 ID。
 * @param {object} params.postDetail - 文章詳情。
 * @param {string} params.commentId - 新留言 ID。
 * @param {string} params.userUid - 目前使用者 UID。
 * @param {(message: string, type?: string) => void} params.showToast - Toast callback。
 */
export function notifySubmittedPostComment({
  actor,
  postId,
  postDetail,
  commentId,
  userUid,
  showToast,
}) {
  if (actor && userUid !== postDetail.authorUid) {
    notifyPostNewComment(postId, postDetail.title, postDetail.authorUid, commentId, actor).catch(
      (notifyError) => {
        console.error('通知建立失敗:', notifyError);
        showToast('通知發送失敗', 'error');
      },
    );
  }

  if (actor) {
    notifyPostCommentReply(postId, postDetail.title, postDetail.authorUid, commentId, actor).catch(
      (notifyError) => {
        console.error('跟帖通知失敗:', notifyError);
      },
    );
  }
}

/**
 * @param {object} params - fallback comment 所需資料。
 * @param {string} params.id - 新留言 ID。
 * @param {{ uid: string, name?: string, photoURL?: string }} params.user - 目前登入使用者。
 * @param {string} params.rawComment - 未裁切留言內容。
 * @returns {object} 新留言 fallback 資料。
 */
export function createSubmittedCommentFallback({ id, user, rawComment }) {
  return {
    id,
    authorUid: user.uid,
    authorName: user.name || '我',
    authorImgURL: user.photoURL || '',
    comment: rawComment,
    createdAt: createFirestoreTimestamp(new Date()),
  };
}
