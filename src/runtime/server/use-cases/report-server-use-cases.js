import { createAdminServerTimestamp } from '@/config/server/firebase-admin-app';
import verifyFirebaseIdToken from '@/repo/server/firebase-auth-admin-repo';
import { createReportDocument } from '@/repo/server/firebase-report-server-repo';
import { readReportTargetDocuments } from '@/repo/server/firebase-report-target-server-repo';
import {
  REPORT_ERROR_CODES,
  REPORT_MESSAGES,
  REPORT_STATUS,
} from '@/constants/report-constants';
import {
  ReportValidationError,
  buildReportDocument,
  normalizeReportRequest,
} from '@/service/report-service';
import {
  SelfReportForbiddenError,
  TargetUnavailableError,
  resolveReportTarget,
} from '@/service/report-target-resolver';

/**
 * Extracts a bearer token from a Request.
 * @param {Request} request - Incoming request.
 * @returns {string | null} Bearer token or null.
 */
function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

/**
 * Builds a route-style result.
 * @param {number} status - HTTP status.
 * @param {Record<string, unknown>} body - JSON body.
 * @returns {import('@/types/report-types').ReportRouteResult} Result.
 */
function routeResult(status, body) {
  return { status, body };
}

/**
 * Builds an error route result.
 * @param {number} status - HTTP status.
 * @param {string} code - Error code.
 * @param {string} [message] - User-facing message.
 * @returns {import('@/types/report-types').ReportRouteResult} Error result.
 */
function errorResult(status, code, message = REPORT_MESSAGES.GENERIC_ERROR) {
  return routeResult(status, {
    ok: false,
    code,
    message,
  });
}

/**
 * Checks whether an error came from duplicate report creation.
 * @param {unknown} error - Candidate error.
 * @returns {boolean} Whether duplicate.
 */
function isDuplicateReportError(error) {
  return /** @type {{ code?: unknown, name?: unknown }} */ (error)?.code === 'report_duplicate';
}

/**
 * Creates a content report from an authenticated request and parsed payload.
 * @param {object} params - Use-case params.
 * @param {Request} params.request - Incoming request.
 * @param {unknown} params.payload - Parsed request JSON.
 * @returns {Promise<import('@/types/report-types').ReportRouteResult>} Route result.
 */
export async function createReportServerUseCase({ request, payload }) {
  const token = getBearerToken(request);
  if (!token) {
    return errorResult(401, REPORT_ERROR_CODES.UNAUTHENTICATED);
  }

  let reporterUid;
  try {
    const decoded = await verifyFirebaseIdToken(token);
    reporterUid = decoded.uid;
  } catch {
    return errorResult(401, REPORT_ERROR_CODES.UNAUTHENTICATED);
  }

  try {
    const normalizedRequest = normalizeReportRequest(payload);
    const targetDocuments = await readReportTargetDocuments(normalizedRequest.targetIdentity);
    const targetSnapshot = resolveReportTarget({
      targetIdentity: normalizedRequest.targetIdentity,
      reporterUid,
      targetDocuments,
    });
    const { reportId, document } = buildReportDocument({
      normalizedRequest,
      reporterUid,
      targetSnapshot,
      createdAt: createAdminServerTimestamp(),
    });

    await createReportDocument(reportId, document);

    return routeResult(201, {
      ok: true,
      reportId,
      status: REPORT_STATUS.OPEN,
      message: REPORT_MESSAGES.SUCCESS,
    });
  } catch (error) {
    if (error instanceof ReportValidationError) {
      return errorResult(400, REPORT_ERROR_CODES.INVALID_REQUEST);
    }
    if (error instanceof SelfReportForbiddenError) {
      return errorResult(
        403,
        REPORT_ERROR_CODES.SELF_REPORT_FORBIDDEN,
        REPORT_MESSAGES.SELF_REPORT,
      );
    }
    if (error instanceof TargetUnavailableError) {
      return errorResult(404, REPORT_ERROR_CODES.TARGET_UNAVAILABLE);
    }
    if (isDuplicateReportError(error)) {
      return errorResult(409, REPORT_ERROR_CODES.DUPLICATE_REPORT, REPORT_MESSAGES.DUPLICATE);
    }

    return errorResult(500, REPORT_ERROR_CODES.INTERNAL_ERROR);
  }
}

export default createReportServerUseCase;
