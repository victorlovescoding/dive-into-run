/**
 * @file Server-env unit tests for src/lib/firebase-admin.js.
 *
 * Runs under the `server` vitest project (node env) wrapped by
 * `firebase emulators:exec --only auth,firestore`. Unlike the mock-based
 * tests under specs/006-strava-running-records/tests/unit/, this file does
 * NOT mock `firebase-admin` — it imports the real module so v8 coverage
 * records actual execution of firebase-admin.js.
 *
 * Strava HTTP calls are still mocked via `vi.stubGlobal('fetch', ...)`
 * because the emulator only speaks Firestore/Auth, not Strava.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-test';

/**
 * Clear all Firestore documents via emulator REST API.
 * Uses the captured originalFetch so test-level fetch stubs don't interfere.
 * @returns {Promise<void>} Resolves when the emulator DELETE completes.
 */
async function clearFirestore() {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`;
  const res = await originalFetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to clear Firestore: ${res.status}`);
}

/**
 * Create a user in Auth emulator and return its idToken.
 * Uses Auth emulator REST endpoint with the fake "owner" API key.
 * @returns {Promise<{ idToken: string, uid: string }>} Fresh idToken plus the emulator-generated uid.
 */
async function createAuthUser() {
  const url = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=owner`;
  const res = await originalFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const data = await res.json();
  return { idToken: data.idToken, uid: data.localId };
}

beforeAll(async () => {
  await clearFirestore();
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  await clearFirestore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// mapStravaActivityToDoc — pure function
// ---------------------------------------------------------------------------

describe('mapStravaActivityToDoc', () => {
  it('maps Strava API fields to Firestore document shape', async () => {
    const { mapStravaActivityToDoc } = await import('@/lib/firebase-admin');
    const activity = {
      id: 12345,
      name: 'Morning Run',
      type: 'Run',
      distance: 5200.5,
      moving_time: 1800,
      start_date: '2024-01-15T08:00:00Z',
      start_date_local: '2024-01-15T16:00:00',
      map: { summary_polyline: 'abc123' },
      average_speed: 2.89,
    };

    const doc = mapStravaActivityToDoc('user-1', activity);

    expect(doc).toMatchObject({
      uid: 'user-1',
      stravaId: 12345,
      name: 'Morning Run',
      type: 'Run',
      distanceMeters: 5200.5,
      movingTimeSec: 1800,
      startDateLocal: '2024-01-15T16:00:00',
      summaryPolyline: 'abc123',
      averageSpeed: 2.89,
    });
    // startDate is a real admin Timestamp
    expect(doc.startDate.toDate().toISOString()).toBe('2024-01-15T08:00:00.000Z');
  });

  it('sets summaryPolyline to null when map is missing', async () => {
    const { mapStravaActivityToDoc } = await import('@/lib/firebase-admin');
    const doc = mapStravaActivityToDoc('u1', {
      id: 1,
      name: 'x',
      type: 'Run',
      distance: 0,
      moving_time: 0,
      start_date: '2024-01-01T00:00:00Z',
      start_date_local: '2024-01-01T08:00:00',
      average_speed: 0,
    });
    expect(doc.summaryPolyline).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getUidByAthleteId — Firestore emulator
// ---------------------------------------------------------------------------

describe('getUidByAthleteId', () => {
  it('returns uid when an athlete doc with matching athleteId exists', async () => {
    const { adminDb, getUidByAthleteId } = await import('@/lib/firebase-admin');
    await adminDb.collection('stravaTokens').doc('uid-found').set({ athleteId: 99999 });

    const uid = await getUidByAthleteId(99999);

    expect(uid).toBe('uid-found');
  });

  it('returns null when no doc matches the athleteId', async () => {
    const { getUidByAthleteId } = await import('@/lib/firebase-admin');
    const uid = await getUidByAthleteId(11111);
    expect(uid).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// verifyAuthToken — Auth emulator
// ---------------------------------------------------------------------------

describe('verifyAuthToken', () => {
  it('returns null when Authorization header is missing', async () => {
    const { verifyAuthToken } = await import('@/lib/firebase-admin');
    const req = new Request('http://test.local/');
    expect(await verifyAuthToken(req)).toBeNull();
  });

  it('returns null when Authorization header lacks Bearer prefix', async () => {
    const { verifyAuthToken } = await import('@/lib/firebase-admin');
    const req = new Request('http://test.local/', {
      headers: { Authorization: 'Basic abc' },
    });
    expect(await verifyAuthToken(req)).toBeNull();
  });

  it('returns null when Bearer token is invalid', async () => {
    const { verifyAuthToken } = await import('@/lib/firebase-admin');
    const req = new Request('http://test.local/', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(await verifyAuthToken(req)).toBeNull();
  });

  it('returns uid when Bearer token is a valid Auth emulator idToken', async () => {
    const { verifyAuthToken } = await import('@/lib/firebase-admin');
    const { idToken, uid } = await createAuthUser();
    const req = new Request('http://test.local/', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(await verifyAuthToken(req)).toBe(uid);
  });
});

// ---------------------------------------------------------------------------
// ensureValidStravaToken — Firestore emulator + mocked Strava fetch
// ---------------------------------------------------------------------------

describe('ensureValidStravaToken', () => {
  it('returns accessToken when current token is still valid', async () => {
    const { adminDb, ensureValidStravaToken } = await import('@/lib/firebase-admin');
    await adminDb
      .collection('stravaTokens')
      .doc('u1')
      .set({
        accessToken: 'valid-token',
        refreshToken: 'r',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

    const result = await ensureValidStravaToken('u1');

    expect(result).toEqual({ accessToken: 'valid-token' });
  });

  it('refreshes the token when expired and returns the new accessToken', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 7200,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('STRAVA_CLIENT_ID', 'cid');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-secret');

    const { adminDb, ensureValidStravaToken } = await import('@/lib/firebase-admin');
    await adminDb
      .collection('stravaTokens')
      .doc('u1')
      .set({
        accessToken: 'old',
        refreshToken: 'r-old',
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });

    const result = await ensureValidStravaToken('u1');

    expect(result).toEqual({ accessToken: 'new-token' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/oauth/token',
      expect.objectContaining({ method: 'POST' }),
    );
    const updated = await adminDb.collection('stravaTokens').doc('u1').get();
    expect(updated.data()).toMatchObject({
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
    });
  });

  it('returns error and marks connection disconnected when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    vi.stubEnv('STRAVA_CLIENT_ID', 'cid');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-secret');

    const { adminDb, ensureValidStravaToken } = await import('@/lib/firebase-admin');
    await adminDb
      .collection('stravaTokens')
      .doc('u1')
      .set({
        accessToken: 'old',
        refreshToken: 'bad',
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });
    await adminDb.collection('stravaConnections').doc('u1').set({ connected: true });

    const result = await ensureValidStravaToken('u1');

    expect(result).toEqual({ error: 'Token refresh failed' });
    const conn = await adminDb.collection('stravaConnections').doc('u1').get();
    expect(conn.data()?.connected).toBe(false);
  });

  it('returns error when no token doc exists', async () => {
    const { ensureValidStravaToken } = await import('@/lib/firebase-admin');
    const result = await ensureValidStravaToken('ghost');
    expect(result).toEqual({ error: 'Token not found' });
  });
});

// ---------------------------------------------------------------------------
// updateLastSyncAt — Firestore emulator batch
// ---------------------------------------------------------------------------

describe('updateLastSyncAt', () => {
  it('updates lastSyncAt on both stravaTokens and stravaConnections', async () => {
    const { adminDb, updateLastSyncAt } = await import('@/lib/firebase-admin');
    await adminDb.collection('stravaTokens').doc('u1').set({ accessToken: 'a' });
    await adminDb.collection('stravaConnections').doc('u1').set({ connected: true });

    await updateLastSyncAt('u1');

    const tokenDoc = await adminDb.collection('stravaTokens').doc('u1').get();
    const connDoc = await adminDb.collection('stravaConnections').doc('u1').get();
    expect(tokenDoc.data()?.lastSyncAt).toBeDefined();
    expect(connDoc.data()?.lastSyncAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// syncSingleStravaActivity — Firestore emulator + mocked fetch
// ---------------------------------------------------------------------------

describe('syncSingleStravaActivity', () => {
  it('fetches the activity and writes it to Firestore when type is Run', async () => {
    const activity = {
      id: 555,
      name: 'Run',
      type: 'Run',
      distance: 5000,
      moving_time: 1800,
      start_date: '2024-01-15T08:00:00Z',
      start_date_local: '2024-01-15T16:00:00',
      map: { summary_polyline: 'p' },
      average_speed: 2.77,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => activity,
      }),
    );

    const { adminDb, syncSingleStravaActivity } = await import('@/lib/firebase-admin');
    await adminDb.collection('stravaTokens').doc('u1').set({ accessToken: 'a' });
    await adminDb.collection('stravaConnections').doc('u1').set({ connected: true });

    const result = await syncSingleStravaActivity({
      uid: 'u1',
      accessToken: 'a',
      stravaActivityId: 555,
    });

    expect(result).toBe(true);
    const doc = await adminDb.collection('stravaActivities').doc('555').get();
    expect(doc.exists).toBe(true);
    expect(doc.data()).toMatchObject({ uid: 'u1', stravaId: 555, type: 'Run' });
  });

  it('returns false and does not write when type is not allowed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 666,
          name: 'Ride',
          type: 'Ride',
          distance: 0,
          moving_time: 0,
          start_date: '2024-01-01T00:00:00Z',
          start_date_local: '2024-01-01T00:00:00',
          average_speed: 0,
        }),
      }),
    );

    const { adminDb, syncSingleStravaActivity } = await import('@/lib/firebase-admin');

    const result = await syncSingleStravaActivity({
      uid: 'u1',
      accessToken: 'a',
      stravaActivityId: 666,
    });

    expect(result).toBe(false);
    const doc = await adminDb.collection('stravaActivities').doc('666').get();
    expect(doc.exists).toBe(false);
  });

  it('deletes the Firestore doc and returns false when Strava returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { adminDb, syncSingleStravaActivity } = await import('@/lib/firebase-admin');
    await adminDb.collection('stravaActivities').doc('999').set({ stale: true });

    const result = await syncSingleStravaActivity({
      uid: 'u1',
      accessToken: 'a',
      stravaActivityId: 999,
    });

    expect(result).toBe(false);
    const doc = await adminDb.collection('stravaActivities').doc('999').get();
    expect(doc.exists).toBe(false);
  });

  it('throws when Strava returns a non-404 error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const { syncSingleStravaActivity } = await import('@/lib/firebase-admin');

    await expect(
      syncSingleStravaActivity({ uid: 'u1', accessToken: 'a', stravaActivityId: 1 }),
    ).rejects.toThrow(/500/);
  });
});

// ---------------------------------------------------------------------------
// syncStravaActivities — Firestore emulator + mocked fetch pagination
// ---------------------------------------------------------------------------

describe('syncStravaActivities', () => {
  it('filters allowed types and writes them to Firestore, returning count', async () => {
    const activities = [
      {
        id: 1,
        name: 'R1',
        type: 'Run',
        distance: 5000,
        moving_time: 1800,
        start_date: '2024-01-15T08:00:00Z',
        start_date_local: '2024-01-15T16:00:00',
        map: { summary_polyline: 'a' },
        average_speed: 2.77,
      },
      {
        id: 2,
        name: 'Ride',
        type: 'Ride',
        distance: 0,
        moving_time: 0,
        start_date: '2024-01-15T08:00:00Z',
        start_date_local: '2024-01-15T16:00:00',
        average_speed: 0,
      },
      {
        id: 3,
        name: 'Trail',
        type: 'TrailRun',
        distance: 6000,
        moving_time: 2400,
        start_date: '2024-01-16T08:00:00Z',
        start_date_local: '2024-01-16T16:00:00',
        map: { summary_polyline: 'b' },
        average_speed: 2.5,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => activities,
      }),
    );

    const { adminDb, syncStravaActivities } = await import('@/lib/firebase-admin');
    await adminDb.collection('stravaTokens').doc('u1').set({ accessToken: 'a' });
    await adminDb.collection('stravaConnections').doc('u1').set({ connected: true });

    const count = await syncStravaActivities({ uid: 'u1', accessToken: 'a', afterEpoch: 0 });

    expect(count).toBe(2);
    const snap = await adminDb.collection('stravaActivities').get();
    const ids = snap.docs.map((d) => d.id).sort();
    expect(ids).toEqual(['1', '3']);
  });

  it('returns 0 and writes nothing when Strava returns an empty page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    const { adminDb, syncStravaActivities } = await import('@/lib/firebase-admin');
    await adminDb.collection('stravaTokens').doc('u1').set({ accessToken: 'a' });
    await adminDb.collection('stravaConnections').doc('u1').set({ connected: true });

    const count = await syncStravaActivities({ uid: 'u1', accessToken: 'a', afterEpoch: 0 });

    expect(count).toBe(0);
    const snap = await adminDb.collection('stravaActivities').get();
    expect(snap.empty).toBe(true);
  });

  it('throws when Strava returns non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );

    const { syncStravaActivities } = await import('@/lib/firebase-admin');

    await expect(
      syncStravaActivities({ uid: 'u1', accessToken: 'a', afterEpoch: 0 }),
    ).rejects.toThrow(/503/);
  });
});
