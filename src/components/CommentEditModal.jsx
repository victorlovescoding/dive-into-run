'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './CommentEditModal.module.css';

/**
 * 編輯留言 Modal。
 * @param {object} props - 元件 props。
 * @param {import('@/lib/firebase-comments').CommentData} props.comment - 正在編輯的留言。
 * @param {boolean} props.isUpdating - 是否更新中。
 * @param {(newContent: string) => void} props.onSave - 儲存回呼。
 * @param {() => void} props.onCancel - 取消回呼。
 * @returns {import('react').ReactElement} 編輯留言 Modal 元件。
 */
export default function CommentEditModal({ comment, isUpdating, onSave, onCancel }) {
  const [editContent, setEditContent] = useState(comment.content);
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  /** @param {import('react').SyntheticEvent<HTMLDialogElement>} e - dialog cancel 事件。 */
  function handleCancel(e) {
    e.preventDefault();
    onCancel();
  }

  const isUnchanged = editContent.trim() === comment.content;
  const isOverLimit = editContent.length > 500;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={handleCancel}>
      <h2 className={styles.title}>編輯留言</h2>
      <textarea
        className={styles.textarea}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        disabled={isUpdating}
      />
      {editContent.length > 450 && (
        <span className={`${styles.charCount} ${isOverLimit ? styles.charCountOver : ''}`}>
          {editContent.length}/500
        </span>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => onSave(editContent)}
          disabled={isUnchanged || isOverLimit || isUpdating}
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
    </dialog>
  );
}
