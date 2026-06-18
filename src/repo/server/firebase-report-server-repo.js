import { adminDb } from '@/config/server/firebase-admin-app';

class DuplicateReportError extends Error {
  constructor(message = 'Duplicate report') {
    super(message);
    this.name = 'DuplicateReportError';
    this.code = 'report_duplicate';
  }
}

/**
 * Checks whether an Admin SDK create error is an already-exists failure.
 * @param {unknown} error - Caught error.
 * @returns {boolean} Whether the error means duplicate document id.
 */
function isAlreadyExistsError(error) {
  const candidate = /** @type {{ code?: unknown, message?: unknown }} */ (error);
  return (
    candidate?.code === 6 ||
    candidate?.code === 'already-exists' ||
    String(candidate?.message ?? '').includes('ALREADY_EXISTS')
  );
}

/**
 * Creates a report document without overwriting an existing deterministic id.
 * @param {string} reportId - Deterministic report document id.
 * @param {import('@/types/report-types').ReportDocument} reportDocument - Report payload.
 * @returns {Promise<void>} Write completion.
 */
export async function createReportDocument(reportId, reportDocument) {
  try {
    await adminDb.collection('reports').doc(reportId).create(reportDocument);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      throw new DuplicateReportError();
    }
    throw error;
  }
}

export { DuplicateReportError };
