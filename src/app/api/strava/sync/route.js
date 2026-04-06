import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb, verifyAuthToken, syncStravaActivities } from '@/lib/firebase-admin';

const COOLDOWN_MS = 3600000;
const TWO_MONTHS_SEC = 60 * 24 * 3600;

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

  const tokenDoc = await adminDb.collection('stravaTokens').doc(uid).get();
  if (!tokenDoc.exists) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tokenData = tokenDoc.data();

  // Cooldown check — skip if lastSyncAt is null (first sync)
  if (tokenData.lastSyncAt) {
    const lastSyncMs = tokenData.lastSyncAt.toDate().getTime();
    const elapsed = Date.now() - lastSyncMs;
    if (elapsed < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: 'Sync cooldown active', retryAfter: remainingSeconds },
        { status: 429 },
      );
    }
  }

  let { accessToken } = tokenData;

  // Token refresh if expired
  if (tokenData.expiresAt < Math.floor(Date.now() / 1000)) {
    const refreshResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refreshToken,
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
      }),
    });

    if (!refreshResponse.ok) {
      await adminDb.collection('stravaConnections').doc(uid).update({ connected: false });
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
    }

    const refreshData = await refreshResponse.json();
    accessToken = refreshData.access_token;

    await adminDb.collection('stravaTokens').doc(uid).update({
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token,
      expiresAt: refreshData.expires_at,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Determine afterEpoch
  const afterEpoch = tokenData.lastSyncAt
    ? Math.floor(tokenData.lastSyncAt.toDate().getTime() / 1000)
    : Math.floor(Date.now() / 1000) - TWO_MONTHS_SEC;

  try {
    const count = await syncStravaActivities({ uid, accessToken, afterEpoch });
    return NextResponse.json({ success: true, count });
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
