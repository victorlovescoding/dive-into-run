import { NextResponse } from 'next/server';
import {
  connectStravaAccount,
  verifyAuthToken,
} from '@/runtime/server/use-cases/strava-server-use-cases';

/**
 * Handles Strava OAuth callback. Exchanges authorization code for tokens,
 * stores credentials in Firestore, and triggers initial activity sync.
 * @param {Request} request - Incoming POST request with Firebase auth and Strava code.
 * @returns {Promise<Response>} JSON response with success status, athlete name, and synced count.
 */
export async function POST(request) {
  const uid = await verifyAuthToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const result = await connectStravaAccount({ uid, code });
  return NextResponse.json(result.body, { status: result.status });
}
