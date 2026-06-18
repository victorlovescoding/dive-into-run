'use client';

import useReportDialogRuntime from '@/runtime/hooks/useReportDialogRuntime';
import { getReportTargetMetadata } from './ReportMenuItem';
import styles from './ReportDialog.module.css';

/**
 * @typedef {object} ReportDialogProps
 * @property {boolean} isOpen - Whether the report dialog is visible.
 * @property {() => void} onClose - Close callback.
 * @property {{ currentUser?: { getIdToken?: () => Promise<string | null> } | null } | null} [auth]
 *   Firebase Auth instance.
 * @property {{ getIdToken?: () => Promise<string | null> } | null} [currentUser]
 *   Explicit current user.
 * @property {string} targetType - Report target type.
 * @property {Record<string, string>} target - Target identity.
 * @property {string} preview - Untrusted client preview for user confirmation.
 * @property {string} [sourcePath] - Current route context.
 * @property {import('@/runtime/client/use-cases/report-use-cases').submitReport} [submitReportUseCase]
 *   Submit dependency for tests.
 * @property {(result: import('@/runtime/client/use-cases/report-use-cases').SubmitReportResult) => void} [onResult]
 *   Result callback.
 */

/**
 * Accessible reusable report modal form.
 * @param {ReportDialogProps} props - Dialog props.
 * @returns {import('react').ReactElement | null} Report dialog.
 */
export default function ReportDialog({
  isOpen,
  onClose,
  auth = null,
  currentUser = auth?.currentUser ?? null,
  targetType,
  target,
  preview,
  sourcePath = '',
  submitReportUseCase,
  onResult,
}) {
  const metadata = getReportTargetMetadata(targetType);
  const runtime = useReportDialogRuntime({
    auth,
    currentUser,
    targetType,
    target,
    sourcePath,
    submitReportUseCase,
    onClose,
    onResult,
  });

  if (!isOpen || !metadata) return null;

  const alertMessage = runtime.errors.reason || runtime.errors.details;
  const detailsId = 'report-dialog-details';
  const titleId = 'report-dialog-title';
  const reasonErrorId = 'report-dialog-reason-error';
  const detailsErrorId = 'report-dialog-details-error';

  return (
    <div className={styles.backdrop}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={runtime.handleSubmit}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {metadata.dialogTitle}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={runtime.handleClose}
            aria-label="關閉檢舉視窗"
          >
            ×
          </button>
        </header>

        <section className={styles.previewBlock} aria-label={metadata.previewLabel}>
          <h3 className={styles.previewLabel}>{metadata.previewLabel}</h3>
          <p className={styles.previewText}>{preview}</p>
        </section>

        <fieldset
          className={styles.reasonGroup}
          aria-describedby={runtime.errors.reason ? reasonErrorId : undefined}
        >
          <legend className={styles.fieldLabel}>檢舉原因</legend>
          <div className={styles.reasonGrid}>
            {runtime.reasonOptions.map((option) => (
              <label key={option.value} className={styles.reasonOption}>
                <input
                  type="radio"
                  name="report-reason"
                  value={option.value}
                  checked={runtime.reason === option.value}
                  onChange={() => runtime.setReason(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={styles.detailsLabel} htmlFor={detailsId}>
          補充說明
        </label>
        <textarea
          id={detailsId}
          className={styles.detailsTextarea}
          value={runtime.details}
          onChange={(event) => runtime.setDetails(event.target.value)}
          aria-describedby={runtime.errors.details ? detailsErrorId : undefined}
        />
        <div className={styles.detailsMeta}>
          <span>{runtime.details.length}/{runtime.detailsMaxLength}</span>
        </div>

        {alertMessage && (
          <div
            id={runtime.errors.reason ? reasonErrorId : detailsErrorId}
            role="alert"
            className={styles.errorAlert}
          >
            {alertMessage}
          </div>
        )}
        {runtime.resultMessage && (
          <div role="status" className={styles.resultMessage}>
            {runtime.resultMessage}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={runtime.handleClose}
          >
            取消
          </button>
          <button type="submit" className={styles.submitButton} disabled={runtime.isPending}>
            {runtime.isPending ? '送出中...' : '送出檢舉'}
          </button>
        </div>
      </form>
    </div>
  );
}
