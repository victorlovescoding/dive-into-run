'use client';

import { useEffect } from 'react';
import styles from './CommentDeleteConfirm.module.css';

/**
 * 刪除留言確認 Dialog。
 * @param {object} props
 * @param {() => void} props.onConfirm - 確認刪除回呼。
 * @param {() => void} props.onCancel - 取消回呼。
 * @param {boolean} props.isDeleting - 是否刪除中。
 * @param {string | null} props.deleteError - 刪除錯誤訊息。
 */
export default function CommentDeleteConfirm({ onConfirm, onCancel, isDeleting, deleteError }) {
  // Escape key closes
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" className={styles.dialog}>
        <p className={styles.message}>確定刪除留言？</p>
        {deleteError && (
          <div role="alert" className={styles.errorAlert}>
            刪除失敗，請再試一次
          </div>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '刪除中…' : '確定刪除'}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isDeleting}
          >
            取消刪除
          </button>
        </div>
      </div>
    </div>
  );
}
