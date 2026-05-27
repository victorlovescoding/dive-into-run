import { NextResponse } from 'next/server';
import {
  cancelAccountDeletionRouteResult,
  getAccountDeletionRouteResult,
  requestAccountDeletionRouteResult,
} from '@/runtime/server/use-cases/account-deletion-server-use-cases';

/**
 * Returns the current user's account deletion state.
 * @param {Request} request - Incoming request.
 * @returns {Promise<NextResponse>} JSON response.
 */
export async function GET(request) {
  const result = await getAccountDeletionRouteResult(request);
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * Creates an account deletion request after recent sign-in.
 * @param {Request} request - Incoming request.
 * @returns {Promise<NextResponse>} JSON response.
 */
export async function POST(request) {
  const result = await requestAccountDeletionRouteResult(request);
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * Cancels the current user's pending account deletion request.
 * @param {Request} request - Incoming request.
 * @returns {Promise<NextResponse>} JSON response.
 */
export async function DELETE(request) {
  const result = await cancelAccountDeletionRouteResult(request);
  return NextResponse.json(result.body, { status: result.status });
}
