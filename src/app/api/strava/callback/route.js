import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb, verifyAuthToken, syncStravaActivities } from '@/lib/firebase-admin';

const STRAVA_TOKEN_URL = 'https://www.strava.com/api/v3/oauth/token';
const TWO_MONTHS_SECONDS = 60 * 24 * 3600;

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

  const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: 'Invalid authorization code' }, { status: 400 });
  }

  const tokenData = await tokenResponse.json();
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    athlete,
  } = tokenData;
  const athleteName = `${athlete.firstname} ${athlete.lastname}`;

  await adminDb.collection('stravaTokens').doc(uid).set({
    accessToken,
    refreshToken,
    expiresAt,
    athleteId: athlete.id,
    connectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await adminDb.collection('stravaConnections').doc(uid).set({
    connected: true,
    athleteId: athlete.id,
    athleteName,
    connectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const twoMonthsAgoEpoch = Math.floor(Date.now() / 1000) - TWO_MONTHS_SECONDS;
  let syncedCount = 0;

  try {
    syncedCount = await syncStravaActivities({
      uid,
      accessToken,
      afterEpoch: twoMonthsAgoEpoch,
    });
  } catch {
    syncedCount = 0;
  }

  return NextResponse.json({ success: true, athleteName, syncedCount });
}
