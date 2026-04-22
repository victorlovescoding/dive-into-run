import { NextResponse } from 'next/server';
import {
  syncStravaAccount,
  verifyAuthToken,
} from '@/runtime/server/use-cases/strava-server-use-cases';

/**
 * Handles Strava activity sync requests. Verifies auth, checks cooldown,
 * refreshes token if expired, then delegates to syncStravaActivities.
 * @param {Request} request - Incoming POST request with Bearer token.
 * @returns {Promise<NextResponse>} JSON response with sync result or error.
 */
export async function POST(request) {
  const uid = await verifyAuthToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await syncStravaAccount(uid);
  return NextResponse.json(result.body, { status: result.status });
}
