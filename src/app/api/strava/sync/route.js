import { NextResponse } from 'next/server';
import {
  adminDb,
  verifyAuthToken,
  ensureValidStravaToken,
  syncStravaActivities,
} from '@/lib/firebase-admin';

const COOLDOWN_MS = 300000; // 5 minutes
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

  const result = await ensureValidStravaToken(uid);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // Determine afterEpoch
  const afterEpoch = tokenData.lastSyncAt
    ? Math.floor(tokenData.lastSyncAt.toDate().getTime() / 1000)
    : Math.floor(Date.now() / 1000) - TWO_MONTHS_SEC;

  try {
    const count = await syncStravaActivities({
      uid,
      accessToken: result.accessToken,
      afterEpoch,
    });
    return NextResponse.json({ success: true, count });
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
