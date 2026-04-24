import { NextResponse } from 'next/server';
import {
  disconnectStravaAccount,
  verifyAuthToken,
} from '@/runtime/server/use-cases/strava-server-use-cases';

/**
 * Handles Strava disconnect requests. Deletes stored tokens, marks connection
 * as disconnected, and removes all synced activities for the user.
 * @param {Request} request - Incoming POST request with Bearer token.
 * @returns {Promise<NextResponse>} JSON response with success status or error.
 */
export async function POST(request) {
  const uid = await verifyAuthToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await disconnectStravaAccount(uid);
  return NextResponse.json(result.body, { status: result.status });
}
