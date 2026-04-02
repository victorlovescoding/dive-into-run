'use client';

import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import {
  fetchComments,
  fetchMoreComments,
  addComment,
  getCommentById,
  updateComment,
  deleteComment,
  fetchCommentHistory,
} from '@/lib/firebase-comments';
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
  const [comments, setComments] = useState(
    /** @type {import('@/lib/firebase-comments').CommentData[]} */ ([]),
  );
  const [cursor, setCursor] = useState(
    /** @type {import('firebase/firestore').DocumentSnapshot | null} */ (null),
  );
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(/** @type {string | null} */ (null));
  const [highlightId, setHighlightId] = useState(/** @type {string | null} */ (null));

  // US3 edit state
  const [editingComment, setEditingComment] = useState(
    /** @type {import('@/lib/firebase-comments').CommentData | null} */ (null),
  );
  const [isUpdating, setIsUpdating] = useState(false);

  // US4 delete state
  const [deletingComment, setDeletingComment] = useState(
    /** @type {import('@/lib/firebase-comments').CommentData | null} */ (null),
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(/** @type {string | null} */ (null));

  // History modal state
  const [historyComment, setHistoryComment] = useState(
    /** @type {import('@/lib/firebase-comments').CommentData | null} */ (null),
  );
  const [historyEntries, setHistoryEntries] = useState(
    /** @type {import('@/lib/firebase-comments').CommentHistoryEntry[]} */ ([]),
  );

  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // --- Initial fetch ---
  useEffect(() => {
    let cancelled = false;
    /**
     * 載入初始留言。
     */
    async function load() {
      setIsLoading(true);
      try {
        const result = await fetchComments(eventId);
        if (!cancelled) {
          setComments(result.comments);
          setCursor(result.lastDoc);
          setHasMore(result.lastDoc !== null);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // --- Load more (infinite scroll) ---
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !cursor) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchMoreComments(eventId, cursor, 15);
      setComments((prev) => [...prev, ...result.comments]);
      setCursor(result.lastDoc);
      setHasMore(result.lastDoc !== null);
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false);
    }
  }, [eventId, cursor, isLoadingMore]);

  // --- IntersectionObserver sentinel ---
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '0px 0px 300px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // --- US2: Submit new comment ---
  /** @type {(content: string) => Promise<void>} */
  const handleSubmit = useCallback(
    async (content) => {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const { id } = await addComment(eventId, user, content);
        const newComment = await getCommentById(eventId, id);
        setComments((prev) => [newComment, ...prev]);
        setHighlightId(id);
        setTimeout(() => setHighlightId(null), 2000);
      } catch {
        setSubmitError('送出失敗，請再試一次');
      } finally {
        setIsSubmitting(false);
      }
    },
    [eventId, user],
  );

  // --- US3: Edit comment ---
  /** @type {(comment: import('@/lib/firebase-comments').CommentData) => void} */
  const handleEditOpen = useCallback((comment) => {
    setEditingComment(comment);
  }, []);

  /** @type {(newContent: string) => Promise<void>} */
  const handleEditSave = useCallback(
    async (newContent) => {
      if (!editingComment) return;
      setIsUpdating(true);
      try {
        await updateComment(eventId, editingComment.id, newContent, editingComment.content);
        setComments((prev) =>
          prev.map((c) =>
            c.id === editingComment.id
              ? {
                  ...c,
                  content: newContent.trim(),
                  isEdited: true,
                  updatedAt: { toDate: () => new Date() },
                }
              : c,
          ),
        );
        setEditingComment(null);
      } catch {
        // stay in modal on failure
      } finally {
        setIsUpdating(false);
      }
    },
    [eventId, editingComment],
  );

  /** @type {() => void} */
  const handleEditCancel = useCallback(() => {
    setEditingComment(null);
  }, []);

  // --- US4: Delete comment ---
  /** @type {(comment: import('@/lib/firebase-comments').CommentData) => void} */
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
  }, [eventId, deletingComment]);

  /** @type {() => void} */
  const handleDeleteCancel = useCallback(() => {
    setDeletingComment(null);
    setDeleteError(null);
  }, []);

  // --- History modal ---
  /** @type {(comment: import('@/lib/firebase-comments').CommentData) => Promise<void>} */
  const handleViewHistory = useCallback(
    async (comment) => {
      setHistoryComment(comment);
      try {
        const entries = await fetchCommentHistory(eventId, comment.id);
        setHistoryEntries(entries);
      } catch {
        setHistoryEntries([]);
      }
    },
    [eventId],
  );

  /** @type {() => void} */
  const handleHistoryClose = useCallback(() => {
    setHistoryComment(null);
    setHistoryEntries([]);
  }, []);

  return (
    <section aria-label="留言區" className={styles.section}>
      {isLoading && (
        <div role="status" className={styles.loading}>
          載入中...
        </div>
      )}
      {!isLoading && comments.length === 0 && <p className={styles.empty}>還沒有人留言</p>}
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
      {!isLoading && hasMore && <div ref={sentinelRef} className={styles.sentinel} />}
      {!isLoading && !hasMore && comments.length > 0 && (
        <p className={styles.endHint}>已顯示所有留言</p>
      )}
      {submitError && (
        <div role="alert" className={styles.submitError}>
          送出失敗，請再試一次
        </div>
      )}
      {user && (
        <CommentInput
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      )}
      {editingComment && (
        <CommentEditModal
          comment={editingComment}
          isUpdating={isUpdating}
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
          onClose={handleHistoryClose}
        />
      )}
    </section>
  );
}
