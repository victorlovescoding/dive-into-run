'use client';

import { useEffect, useRef } from 'react';
import styles from './CommentDeleteConfirm.module.css';

/**
 * 刪除留言確認 Dialog。
 * @param {object} props - 元件 props。
 * @param {() => void} props.onConfirm - 確認刪除回呼。
 * @param {() => void} props.onCancel - 取消回呼。
 * @param {boolean} props.isDeleting - 是否刪除中。
 * @param {string | null} props.deleteError - 刪除錯誤訊息。
 * @returns {import('react').ReactElement} 刪除確認 Dialog 元件。
 */
export default function CommentDeleteConfirm({ onConfirm, onCancel, isDeleting, deleteError }) {
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

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={handleCancel}>
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
          {isDeleting ? '刪除中\u2026' : '確定刪除'}
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
    </dialog>
  );
}
