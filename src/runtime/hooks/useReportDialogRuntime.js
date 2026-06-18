'use client';

import { useCallback, useRef, useState } from 'react';
import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASON_LABELS } from '@/constants/report-constants';
import { submitReport } from '@/runtime/client/use-cases/report-use-cases';

export const REPORT_REASON_REQUIRED_MESSAGE = '請選擇檢舉原因。';
export const REPORT_OTHER_DETAILS_REQUIRED_MESSAGE = '請填寫補充說明。';
export const REPORT_DETAILS_TOO_LONG_MESSAGE = '補充說明最多 500 字。';

export const REPORT_REASON_OPTIONS = Object.freeze(
  Object.entries(REPORT_REASON_LABELS).map(([value, label]) => Object.freeze({ value, label })),
);

/**
 * @typedef {object} ReportDialogErrors
 * @property {string | null} reason - Reason validation error.
 * @property {string | null} details - Details validation error.
 */

/**
 * @typedef {object} UseReportDialogRuntimeParams
 * @property {{ currentUser?: { getIdToken?: () => Promise<string | null> } | null } | null} [auth]
 *   Firebase Auth instance.
 * @property {{ getIdToken?: () => Promise<string | null> } | null} [currentUser]
 *   Explicit current user.
 * @property {string} targetType - Report target type.
 * @property {Record<string, string>} target - Target identity.
 * @property {string} [sourcePath] - Current route context.
 * @property {typeof submitReport} [submitReportUseCase] - Submit dependency.
 * @property {() => void} [onClose] - Close callback.
 * @property {(result: import('@/runtime/client/use-cases/report-use-cases').SubmitReportResult) => void} [onResult]
 *   Result callback for toast wiring.
 */

const EMPTY_ERRORS = Object.freeze({ reason: null, details: null });

/**
 * Validates report form state.
 * @param {string} reason - Selected reason.
 * @param {string} details - Reporter details.
 * @returns {ReportDialogErrors} Validation errors.
 */
function validateReportForm(reason, details) {
  if (!reason) return { reason: REPORT_REASON_REQUIRED_MESSAGE, details: null };
  if (details.length > REPORT_DETAILS_MAX_LENGTH) {
    return { reason: null, details: REPORT_DETAILS_TOO_LONG_MESSAGE };
  }
  if (reason === 'other' && details.trim().length === 0) {
    return { reason: null, details: REPORT_OTHER_DETAILS_REQUIRED_MESSAGE };
  }
  return EMPTY_ERRORS;
}

/**
 * Manages report dialog form validation, pending guard, and submit result state.
 * @param {UseReportDialogRuntimeParams} params - Runtime inputs.
 * @returns {object} Report dialog state and actions.
 */
export default function useReportDialogRuntime({
  auth = null,
  currentUser = auth?.currentUser ?? null,
  targetType,
  target,
  sourcePath = '',
  submitReportUseCase = submitReport,
  onClose,
  onResult,
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState(/** @type {ReportDialogErrors} */ (EMPTY_ERRORS));
  const [isPending, setIsPending] = useState(false);
  const [resultMessage, setResultMessage] = useState(/** @type {string | null} */ (null));
  const pendingRef = useRef(false);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (pendingRef.current) return null;

      const nextErrors = validateReportForm(reason, details);
      setErrors(nextErrors);
      setResultMessage(null);
      if (nextErrors.reason || nextErrors.details) return null;

      pendingRef.current = true;
      setIsPending(true);
      try {
        const result = await submitReportUseCase({
          auth,
          currentUser,
          targetType,
          target,
          reason,
          details: details.trim(),
          sourcePath,
        });
        setResultMessage(result.message);
        onResult?.(result);
        return result;
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [auth, currentUser, details, onResult, reason, sourcePath, submitReportUseCase, target, targetType],
  );

  return {
    reason,
    setReason,
    details,
    setDetails,
    errors,
    isPending,
    resultMessage,
    reasonOptions: REPORT_REASON_OPTIONS,
    detailsMaxLength: REPORT_DETAILS_MAX_LENGTH,
    handleClose,
    handleSubmit,
  };
}
