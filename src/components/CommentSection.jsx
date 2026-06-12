'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useContext, useMemo, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { getCommentById } from '@/runtime/client/use-cases/event-comment-use-cases';
import useComments from '@/runtime/hooks/useComments';
import useCommentMutations from '@/runtime/hooks/useCommentMutations';
import useCommentScrollTarget from '@/runtime/hooks/useCommentScrollTarget';
import useNotificationTargetComment from '@/runtime/hooks/useNotificationTargetComment';
import CommentCard from '@/components/CommentCard';
import CommentInput from '@/components/CommentInput';
import CommentEditModal from '@/components/CommentEditModal';
import CommentDeleteConfirm from '@/components/CommentDeleteConfirm';
import CommentHistoryModal from '@/components/CommentHistoryModal';
import styles from './CommentSection.module.css';

/**
 * Event comments already use the shared CommentCard shape.
 * @param {object} comment - Event comment data.
 * @returns {object} CommentCard-compatible event comment.
 */
function normalizeEventComment(comment) {
  return comment;
}

/**
 * Reads an event comment id.
 * @param {object} comment - Event comment data.
 * @returns {string} Event comment id.
 */
function getEventCommentId(comment) {
  return comment.id;
}

/**
 * 留言區容器元件，管理所有留言相關 state 與子元件。
 * @param {object} props - 元件 props。
 * @param {string} props.eventId - 活動 ID。
 * @param {((commentId: string) => void)} [props.onCommentAdded] - 新留言建立後的回呼。
 * @returns {import('react').ReactElement} 留言區元件。
 */
export default function CommentSection({ eventId, onCommentAdded }) {
  const { user } = useContext(AuthContext);
  const [submittedCommentId, setSubmittedCommentId] = useState(/** @type {string | null} */ (null));

  const {
    comments,
    setComments,
    isLoading,
    hasMore,
    loadError,
    retryLoad,
    loadMoreError,
    retryLoadMore,
    sentinelRef,
  } = useComments(eventId);

  const searchParams = useSearchParams();
  const urlCommentId = searchParams.get('commentId');
  const loadNotificationTargetComment = useCallback(
    (commentId) => getCommentById(eventId, commentId),
    [eventId],
  );
  const {
    pinnedComment,
    visibleComments,
    activeTargetId,
    updatePinnedComment,
    removePinnedComment,
  } = useNotificationTargetComment({
    targetCommentId: urlCommentId,
    submittedCommentId,
    comments,
    loadCommentById: loadNotificationTargetComment,
    normalizeComment: normalizeEventComment,
    getCommentId: getEventCommentId,
    isReady: !isLoading,
  });
  const targetMutationCallbacks = useMemo(
    () => ({
      onCommentUpdated: updatePinnedComment,
      onCommentDeleted: removePinnedComment,
    }),
    [removePinnedComment, updatePinnedComment],
  );
  const {
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
  } = useCommentMutations(eventId, user, setComments, (commentId) => {
    setSubmittedCommentId(commentId);
    onCommentAdded?.(commentId);
  }, targetMutationCallbacks);
  const hasPinnedComment = !!pinnedComment;
  const hasVisibleComments = visibleComments.length > 0;
  const shouldRenderComposer = !!user;
  const sectionClassName = shouldRenderComposer
    ? `${styles.section} ${styles.withComposerReserve}`
    : styles.section;

  useCommentScrollTarget(activeTargetId);

  return (
    <section aria-label="留言區" className={sectionClassName}>
      {isLoading && (
        <div role="status" className={styles.loading}>
          載入中...
        </div>
      )}
      {loadError && (
        <div role="alert" className={styles.loadError}>
          <span>{loadError}</span>
          <button type="button" className={styles.retryButton} onClick={retryLoad}>
            重試
          </button>
        </div>
      )}
      {!isLoading && !loadError && !hasPinnedComment && !hasVisibleComments && (
        <p className={styles.empty}>還沒有人留言</p>
      )}
      {!isLoading && pinnedComment && (
        <div className={styles.pinnedComment}>
          <span className={styles.pinnedLabel}>通知中的留言</span>
          <CommentCard
            comment={pinnedComment}
            isOwner={user?.uid === pinnedComment.authorUid}
            isHighlighted={pinnedComment.id === activeTargetId}
            onEdit={handleEditOpen}
            onDelete={handleDeleteOpen}
            onViewHistory={handleViewHistory}
          />
        </div>
      )}
      {!isLoading && hasVisibleComments && (
        <ul className={styles.list}>
          {visibleComments.map((c) => (
            <li key={c.id} className={styles.listItem}>
              <CommentCard
                comment={c}
                isOwner={user?.uid === c.authorUid}
                isHighlighted={c.id === highlightId}
                onEdit={handleEditOpen}
                onDelete={handleDeleteOpen}
                onViewHistory={handleViewHistory}
              />
            </li>
          ))}
        </ul>
      )}
      {!isLoading && hasMore && !loadMoreError && (
        <div ref={sentinelRef} className={styles.sentinel} />
      )}
      {loadMoreError && (
        <div className={styles.loadMoreError}>
          <span>{loadMoreError}</span>
          <button type="button" className={styles.retryButton} onClick={retryLoadMore}>
            重試
          </button>
        </div>
      )}
      {!isLoading && !hasMore && (hasPinnedComment || hasVisibleComments) && (
        <p className={styles.endHint}>已顯示所有留言</p>
      )}
      {submitError && (
        <div role="alert" className={styles.submitError}>
          送出失敗，請再試一次
        </div>
      )}
      {shouldRenderComposer && (
        <CommentInput
          user={user}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          className={styles.eventComposer}
        />
      )}
      {editingComment && (
        <CommentEditModal
          comment={editingComment}
          isUpdating={isUpdating}
          updateError={updateError}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        />
      )}
      {deletingComment && (
        <CommentDeleteConfirm
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting}
          deleteError={deleteError}
        />
      )}
      {historyComment && (
        <CommentHistoryModal
          comment={historyComment}
          history={historyEntries}
          historyError={historyError}
          onClose={handleHistoryClose}
        />
      )}
    </section>
  );
}
