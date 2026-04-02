'use client';

import { useEffect } from 'react';
import { formatCommentTimeFull } from '@/lib/event-helpers';
import styles from './CommentHistoryModal.module.css';

/**
 * 編輯記錄 Modal。
 * @param {object} props
 * @param {import('@/lib/firebase-comments').CommentData} props.comment - 當前留言。
 * @param {import('@/lib/firebase-comments').CommentHistoryEntry[]} props.history - 編輯歷史（editedAt asc）。
 * @param {() => void} props.onClose - 關閉回呼。
 */
export default function CommentHistoryModal({ comment, history, onClose }) {
  // Escape key closes
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reverse history for display (newest first), then oldest gets "原始版本" badge
  const reversedHistory = [...history].reverse();

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" className={styles.dialog}>
        <div className={styles.header}>
          <h2 className={styles.title}>編輯記錄</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </div>
        <ul className={styles.list}>
          {/* Current version */}
          <li className={styles.entry}>
            <div className={styles.entryHeader}>
              <span className={styles.badgeCurrent}>目前版本</span>
              {comment.updatedAt && (
                <time className={styles.entryTime}>{formatCommentTimeFull(comment.updatedAt)}</time>
              )}
            </div>
            <p className={styles.entryContent}>{comment.content}</p>
          </li>
          {/* History entries (newest to oldest) */}
          {reversedHistory.map((entry, i) => {
            const isOriginal = i === reversedHistory.length - 1;
            return (
              <li key={entry.id || i} className={styles.entry}>
                <div className={styles.entryHeader}>
                  {isOriginal && <span className={styles.badgeOriginal}>原始版本</span>}
                  <time className={styles.entryTime}>{formatCommentTimeFull(entry.editedAt)}</time>
                </div>
                <p className={styles.entryContent}>{entry.content}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
