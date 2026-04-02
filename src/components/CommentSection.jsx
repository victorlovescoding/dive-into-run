'use client';

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useComments from '@/hooks/useComments';
import useCommentMutations from '@/hooks/useCommentMutations';
import CommentCard from '@/components/CommentCard';
import CommentInput from '@/components/CommentInput';
import CommentEditModal from '@/components/CommentEditModal';
import CommentDeleteConfirm from '@/components/CommentDeleteConfirm';
import CommentHistoryModal from '@/components/CommentHistoryModal';
import styles from './CommentSection.module.css';

/**
 * 留言區容器元件，管理所有留言相關 state 與子元件。
 * @param {object} props - 元件 props。
 * @param {string} props.eventId - 活動 ID。
 * @returns {import('react').ReactElement} 留言區元件。
 */
export default function CommentSection({ eventId }) {
  const { user } = useContext(AuthContext);

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

  const {
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
  } = useCommentMutations(eventId, user, setComments);

  return (
    <section aria-label="留言區" className={styles.section}>
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
      {!isLoading && !loadError && comments.length === 0 && (
        <p className={styles.empty}>還沒有人留言</p>
      )}
      {!isLoading && comments.length > 0 && (
        <ul className={styles.list} style={user ? { paddingBottom: 80 } : undefined}>
          {comments.map((c) => (
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
      {!isLoading && !hasMore && comments.length > 0 && (
        <p className={styles.endHint}>已顯示所有留言</p>
      )}
      {submitError && (
        <div role="alert" className={styles.submitError}>
          送出失敗，請再試一次
        </div>
      )}
      {user && (
        // @ts-expect-error — key 是 React 特殊 prop，不在 CommentInput JSDoc 型別中但為合法用法
        <CommentInput key={submitKey} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
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
