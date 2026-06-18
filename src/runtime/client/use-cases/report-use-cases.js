import { REPORT_ERROR_CODES, REPORT_MESSAGES } from '@/constants/report-constants';

export const REPORT_SUCCESS_MESSAGE = REPORT_MESSAGES.SUCCESS;
export const REPORT_DUPLICATE_MESSAGE = REPORT_MESSAGES.DUPLICATE;
export const REPORT_SELF_MESSAGE = REPORT_MESSAGES.SELF_REPORT;
export const REPORT_GENERIC_ERROR_MESSAGE = REPORT_MESSAGES.GENERIC_ERROR;

/**
 * @typedef {object} SubmitReportResult
 * @property {boolean} ok - Report request success state.
 * @property {number} status - HTTP-like status.
 * @property {string | null} code - Stable API error code when failed.
 * @property {string | null} reportId - Created report id when available.
 * @property {string} message - User-facing result message.
 */

/**
 * @typedef {object} SubmitReportParams
 * @property {{ currentUser?: { getIdToken?: () => Promise<string | null> } | null } | null} [auth]
 *   Firebase Auth instance carrying currentUser.
 * @property {{ getIdToken?: () => Promise<string | null> } | null} [currentUser]
 *   Explicit current user, preferred over auth.currentUser.
 * @property {(input: string, init: RequestInit) => Promise<Response | { ok: boolean, status: number, json?: () => Promise<Record<string, unknown>> }>} [fetchImpl]
 *   Fetch implementation for tests or browser runtime.
 * @property {string} targetType - Report target type.
 * @property {Record<string, string>} target - Target identity ids.
 * @property {string} reason - Stable report reason key.
 * @property {string} [details] - Optional reporter details.
 * @property {string} [sourcePath] - Current app route context.
 */

/**
 * Maps API status/code to the user-facing message contract.
 * @param {number} status - HTTP status.
 * @param {string | null} code - API error code.
 * @returns {string} Stable user-facing message.
 */
function mapReportMessage(status, code) {
  if (status === 409 || code === REPORT_ERROR_CODES.DUPLICATE_REPORT) {
    return REPORT_DUPLICATE_MESSAGE;
  }
  if (status === 403 || code === REPORT_ERROR_CODES.SELF_REPORT_FORBIDDEN) {
    return REPORT_SELF_MESSAGE;
  }
  return REPORT_GENERIC_ERROR_MESSAGE;
}

/**
 * Reads JSON from a response-like object.
 * @param {{ json?: () => Promise<Record<string, unknown>> }} response - Fetch response.
 * @returns {Promise<Record<string, unknown>>} Parsed JSON object or empty object.
 */
async function readJson(response) {
  if (typeof response.json !== 'function') return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * Returns an unauthenticated failure without touching the network.
 * @returns {SubmitReportResult} Unauthenticated report result.
 */
function unauthenticatedResult() {
  return {
    ok: false,
    status: 401,
    code: REPORT_ERROR_CODES.UNAUTHENTICATED,
    reportId: null,
    message: REPORT_GENERIC_ERROR_MESSAGE,
  };
}

/**
 * Submits a content report through the Phase 1 API boundary.
 * @param {SubmitReportParams} params - Report submit parameters.
 * @returns {Promise<SubmitReportResult>} Stable client result.
 */
export async function submitReport({
  auth = null,
  currentUser = auth?.currentUser ?? null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  targetType,
  target,
  reason,
  details = '',
  sourcePath = '',
}) {
  const token = await currentUser?.getIdToken?.();
  if (!token || typeof fetchImpl !== 'function') return unauthenticatedResult();

  try {
    const response = await fetchImpl('/api/reports', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetType,
        target,
        reason,
        details: String(details).trim(),
        sourcePath,
      }),
    });
    const body = await readJson(response);

    if (response.ok && body.ok !== false) {
      return {
        ok: true,
        status: response.status,
        code: null,
        reportId: typeof body.reportId === 'string' ? body.reportId : null,
        message: REPORT_SUCCESS_MESSAGE,
      };
    }

    const code = typeof body.code === 'string' ? body.code : null;
    return {
      ok: false,
      status: response.status,
      code,
      reportId: null,
      message: mapReportMessage(response.status, code),
    };
  } catch {
    return {
      ok: false,
      status: 500,
      code: REPORT_ERROR_CODES.INTERNAL_ERROR,
      reportId: null,
      message: REPORT_GENERIC_ERROR_MESSAGE,
    };
  }
}
