import { NextResponse } from 'next/server';
import {
  REPORT_ERROR_CODES,
  REPORT_MESSAGES,
} from '@/constants/report-constants';
import { createReportServerUseCase } from '@/runtime/server/use-cases/report-server-use-cases';

/**
 * Builds a generic JSON error response.
 * @param {number} status - HTTP status.
 * @param {string} code - Error code.
 * @returns {NextResponse} JSON response.
 */
function jsonError(status, code) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message: REPORT_MESSAGES.GENERIC_ERROR,
    },
    { status },
  );
}

/**
 * Handles report creation.
 * @param {Request} request - Incoming request.
 * @returns {Promise<NextResponse>} JSON response.
 */
export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, REPORT_ERROR_CODES.INVALID_REQUEST);
  }

  try {
    const result = await createReportServerUseCase({ request, payload });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return jsonError(500, REPORT_ERROR_CODES.INTERNAL_ERROR);
  }
}
