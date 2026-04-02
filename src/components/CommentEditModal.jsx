'use client';

import { useState, useEffect } from 'react';
import styles from './CommentEditModal.module.css';

/**
 * 編輯留言 Modal。
 * @param {object} props
 * @param {import('@/lib/firebase-comments').CommentData} props.comment - 正在編輯的留言。
 * @param {boolean} props.isUpdating - 是否更新中。
 * @param {(newContent: string) => void} props.onSave - 儲存回呼。
 * @param {() => void} props.onCancel - 取消回呼。
 */
export default function CommentEditModal({ comment, isUpdating, onSave, onCancel }) {
  const [editContent, setEditContent] = useState(comment.content);

  // Escape key closes modal
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const isUnchanged = editContent.trim() === comment.content;

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" className={styles.dialog}>
        <h2 className={styles.title}>編輯留言</h2>
        <textarea
          className={styles.textarea}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          disabled={isUpdating}
        />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => onSave(editContent)}
            disabled={isUnchanged || isUpdating}
          >
            {isUpdating ? '更新中\u2026' : '完成編輯'}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isUpdating}
          >
            取消編輯
          </button>
        </div>
      </div>
    </div>
  );
}
