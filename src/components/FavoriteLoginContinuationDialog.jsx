'use client';

import styles from './FavoriteLoginContinuationDialog.module.css';

/**
 * @typedef {object} FavoriteLoginContinuationDialogProps
 * @property {{
 *   isOpen: boolean,
 *   title: string,
 *   body: string,
 *   primaryLabel: string,
 *   secondaryLabel: string,
 *   isSubmitting: boolean
 * }} dialogState - Dialog render state.
 * @property {() => void | Promise<void>} onConfirm - Primary action callback.
 * @property {() => void} onCancel - Secondary action callback.
 * @property {() => void} onClose - Close action callback.
 */

/**
 * Reusable dialog for unauthenticated event/post favorite continuation.
 * @param {FavoriteLoginContinuationDialogProps} props - Dialog props.
 * @returns {import('react').ReactElement | null} Dialog element.
 */
export default function FavoriteLoginContinuationDialog({
  dialogState,
  onConfirm,
  onCancel,
  onClose,
}) {
  if (!dialogState?.isOpen) return null;

  const titleId = 'favorite-login-continuation-title';
  const bodyId = 'favorite-login-continuation-body';

  return (
    <div className={styles.backdrop}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={dialogState.isSubmitting ? 'true' : 'false'}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {dialogState.title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => {
              onClose();
            }}
            aria-label="關閉收藏登入提示"
            disabled={dialogState.isSubmitting}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <p id={bodyId} className={styles.body}>
          {dialogState.body}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              onCancel();
            }}
            disabled={dialogState.isSubmitting}
          >
            {dialogState.secondaryLabel}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              onConfirm();
            }}
            disabled={dialogState.isSubmitting}
          >
            {dialogState.primaryLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
