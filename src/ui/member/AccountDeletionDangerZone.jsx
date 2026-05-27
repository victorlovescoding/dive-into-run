'use client';

import styles from './AccountDeletionDangerZone.module.css';

/**
 * @param {object} props - Component props.
 * @param {object} props.runtime - Account deletion runtime.
 * @returns {import('react').ReactElement} Danger Zone UI.
 */
export default function AccountDeletionDangerZone({ runtime }) {
  const {
    modalOpen,
    submitting,
    error,
    openModal,
    closeModal,
    confirmDeletion,
  } = runtime;
  const confirmButtonText = submitting ? '處理中...' : '重新驗證並刪除';
  let dialog = null;

  if (modalOpen) {
    dialog = (
      <div className={styles.modalBackdrop} role="presentation">
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-deletion-confirm-title"
        >
          <h3 id="account-deletion-confirm-title" className={styles.modalTitle}>
            確認刪除帳號
          </h3>
          <p className={styles.modalCopy}>
            系統會要求你重新驗證 Google 帳號。送出後帳號會進入 30 天等待期，期間只能取消刪除或登出。
          </p>
          <p className={styles.modalCopy}>
            期滿後 Auth 帳號、個人資料、公開內容、收藏、追蹤、通知、Strava 資料與頭像會被永久清除。
          </p>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={closeModal}
              disabled={submitting}
            >
              取消
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={confirmDeletion}
              disabled={submitting}
            >
              {confirmButtonText}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.dangerZone} aria-labelledby="account-deletion-heading">
      <h2 id="account-deletion-heading" className={styles.heading}>
        Danger Zone
      </h2>
      <p className={styles.copy}>
        刪除帳號後，公開檔案、文章、留言與主辦活動會立刻隱藏。30 天內可以取消，期滿後會永久清除資料。
      </p>
      <button
        type="button"
        className={styles.dangerButton}
        onClick={openModal}
        disabled={submitting}
      >
        刪除帳號
      </button>

      {dialog}
    </section>
  );
}
