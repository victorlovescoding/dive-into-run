'use client';

import styles from './EventDeleteConfirm.module.css';

/**
 * @file EventDeleteConfirm Component
 * @description 自訂刪除確認對話框，避免使用瀏覽器原生 confirm。
 */

/**
 * @typedef {object} EventDeleteConfirmProps
 * @property {string} eventId - 要刪除的活動 ID。
 * @property {(id: string) => void} onConfirm - 確認刪除的回呼。
 * @property {() => void} onCancel - 取消刪除的回呼。
 * @property {boolean} [isDeleting] - 是否正在刪除中。
 * @property {string} [deleteError] - 刪除失敗時的錯誤訊息。
 */

/**
 * EventDeleteConfirm — 刪除活動確認對話框。
 * 顯示「確定要刪除活動？」確認訊息，提供「是」與「否」兩個按鈕。
 * @param {EventDeleteConfirmProps} props - Component props.
 * @returns {import('react').ReactElement} 確認對話框元件。
 */
export default function EventDeleteConfirm({
  eventId,
  onConfirm,
  onCancel,
  isDeleting = false,
  deleteError = '',
}) {
  return (
    <div role="dialog" aria-modal="true" className={styles.dialog}>
      <p className={styles.message}>確定要刪除活動？</p>
      {deleteError && <div role="alert" className={styles.errorAlert}>{deleteError}</div>}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.confirmButton}
          onClick={() => onConfirm(eventId)}
          disabled={isDeleting}
        >
          {isDeleting ? '刪除中…' : '是，確認刪除'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isDeleting}
        >
          否，取消
        </button>
      </div>
    </div>
  );
}
