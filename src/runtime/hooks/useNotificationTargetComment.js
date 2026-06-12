'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * @typedef {object} NotificationTargetCommentParams
 * @property {string | null | undefined} targetCommentId - URL 通知指定的留言 ID。
 * @property {string | null | undefined} submittedCommentId - 本地剛送出的留言 ID，優先於 URL target。
 * @property {Array<object>} comments - 目前分頁已載入的留言。
 * @property {(commentId: string) => Promise<object | null>} loadCommentById - 單筆載入留言 adapter。
 * @property {(comment: object) => object} normalizeComment - 將 domain 留言轉成 UI 可用 shape。
 * @property {(comment: object) => string | null | undefined} getCommentId - 讀取留言 ID 的 adapter。
 * @property {boolean} [isReady] - 是否已可判斷 target 不在目前 comments 內。
 */

/**
 * @typedef {object} NotificationTargetCommentReturn
 * @property {object | null} pinnedComment - 置頂顯示的通知留言，不會寫回 pagination comments。
 * @property {Array<object>} visibleComments - 去掉 pinned ID 後的一般留言列表。
 * @property {string | null} activeTargetId - 給 scroll/highlight 使用的有效 target ID。
 * @property {boolean} isLoadingTargetComment - 是否正在載入 URL target 留言。
 * @property {(comment: object) => void} updatePinnedComment - 更新 standalone pinned target。
 * @property {(commentId: string) => void} removePinnedComment - 移除 standalone pinned target。
 */

/**
 * Orchestrates notification target comments without knowing post/event schemas.
 * Local submissions always override URL targets; URL targets are either pinned
 * from the current page or fetched as one standalone comment.
 * @param {NotificationTargetCommentParams} params - Target comment adapter contract.
 * @returns {NotificationTargetCommentReturn} Pinned target and deduped comments.
 */
export default function useNotificationTargetComment({
  targetCommentId,
  submittedCommentId,
  comments,
  loadCommentById,
  normalizeComment,
  getCommentId,
  isReady = true,
}) {
  const activeTargetId = submittedCommentId ?? targetCommentId ?? null;
  const urlTargetId = submittedCommentId ? null : targetCommentId ?? null;
  const [loadedTarget, setLoadedTarget] = useState({
    commentId: /** @type {string | null} */ (null),
    comment: /** @type {object | null} */ (null),
  });
  const [loadingTargetId, setLoadingTargetId] = useState(/** @type {string | null} */ (null));
  const [removedTargetId, setRemovedTargetId] = useState(/** @type {string | null} */ (null));

  const currentPageTarget = useMemo(() => {
    if (!urlTargetId) return null;
    return comments.find((comment) => getCommentId(comment) === urlTargetId) ?? null;
  }, [comments, getCommentId, urlTargetId]);

  useEffect(() => {
    if (!isReady || !urlTargetId || currentPageTarget || removedTargetId === urlTargetId) {
      return undefined;
    }

    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoadingTargetId(urlTargetId);
        return loadCommentById(urlTargetId);
      })
      .then((comment) => {
        if (cancelled) return;
        setLoadedTarget({
          commentId: urlTargetId,
          comment: comment ? normalizeComment(comment) : null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedTarget({
            commentId: urlTargetId,
            comment: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTargetId((current) => (current === urlTargetId ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPageTarget, isReady, loadCommentById, normalizeComment, removedTargetId, urlTargetId]);

  const pinnedComment = useMemo(() => {
    if (removedTargetId === urlTargetId) return null;
    if (!urlTargetId) return null;
    if (currentPageTarget) return normalizeComment(currentPageTarget);
    return loadedTarget.commentId === urlTargetId ? loadedTarget.comment : null;
  }, [currentPageTarget, loadedTarget, normalizeComment, removedTargetId, urlTargetId]);

  const pinnedCommentId = pinnedComment ? getCommentId(pinnedComment) : null;
  const visibleComments = useMemo(() => {
    if (!pinnedCommentId) return comments;
    return comments.filter((comment) => getCommentId(comment) !== pinnedCommentId);
  }, [comments, getCommentId, pinnedCommentId]);

  /**
   * Updates the standalone fetched target without mutating paginated comments.
   * @param {object} comment - Updated comment data.
   */
  function updatePinnedComment(comment) {
    const commentId = getCommentId(comment);
    if (!commentId || commentId !== urlTargetId) return;
    setRemovedTargetId(null);
    setLoadedTarget({ commentId, comment: normalizeComment(comment) });
  }

  /**
   * Removes the standalone fetched target without mutating paginated comments.
   * @param {string} commentId - Removed comment ID.
   */
  function removePinnedComment(commentId) {
    if (!commentId || commentId !== urlTargetId) return;
    setRemovedTargetId(commentId);
    setLoadedTarget({ commentId, comment: null });
  }

  return {
    pinnedComment,
    visibleComments,
    activeTargetId,
    isLoadingTargetComment: loadingTargetId === urlTargetId,
    updatePinnedComment,
    removePinnedComment,
  };
}
