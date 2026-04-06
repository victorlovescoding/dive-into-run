import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  });
}

const adminDb = admin.firestore();

const ALLOWED_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

/**
 * Extracts Bearer token from request Authorization header and verifies it
 * via Firebase Admin Auth.
 * @param {Request} request - Incoming HTTP request with Authorization header.
 * @returns {Promise<string | null>} Decoded user uid, or null if invalid/missing.
 */
async function verifyAuthToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Maps a raw Strava API activity object to the Firestore document shape.
 * @param {string} uid - Firebase user uid.
 * @param {object} activity - Raw Strava API activity object.
 * @returns {object} Firestore document fields for stravaActivities collection.
 */
function mapStravaActivityToDoc(uid, activity) {
  return {
    uid,
    stravaId: activity.id,
    name: activity.name,
    type: activity.type,
    distanceMeters: activity.distance,
    movingTimeSec: activity.moving_time,
    startDate: admin.firestore.Timestamp.fromDate(new Date(activity.start_date)),
    startDateLocal: activity.start_date_local,
    summaryPolyline: activity.map?.summary_polyline || null,
    averageSpeed: activity.average_speed,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Looks up Firebase uid from a Strava athlete ID.
 * @param {number} athleteId - Strava athlete ID (owner_id from webhook).
 * @returns {Promise<string | null>} Firebase uid, or null if not found.
 */
async function getUidByAthleteId(athleteId) {
  const snap = await adminDb
    .collection('stravaTokens')
    .where('athleteId', '==', athleteId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * @typedef {object} EnsureTokenResult
 * @property {string} [accessToken] - Valid Strava access token.
 * @property {string} [error] - Error message if token could not be obtained.
 */

/**
 * Ensures a valid Strava access token for the given uid.
 * Refreshes via Strava OAuth if expired, updates Firestore accordingly.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<EnsureTokenResult>} Object with accessToken or error.
 */
async function ensureValidStravaToken(uid) {
  const tokenDoc = await adminDb.collection('stravaTokens').doc(uid).get();
  if (!tokenDoc.exists) {
    return { error: 'Token not found' };
  }
  const tokenData = tokenDoc.data();

  if (tokenData.expiresAt >= Math.floor(Date.now() / 1000)) {
    return { accessToken: tokenData.accessToken };
  }

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
    return { error: 'Token refresh failed' };
  }

  const refreshData = await refreshResponse.json();
  await adminDb.collection('stravaTokens').doc(uid).update({
    accessToken: refreshData.access_token,
    refreshToken: refreshData.refresh_token,
    expiresAt: refreshData.expires_at,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { accessToken: refreshData.access_token };
}

/**
 * Updates lastSyncAt timestamp on both stravaTokens and stravaConnections.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<void>}
 */
async function updateLastSyncAt(uid) {
  const batch = adminDb.batch();
  batch.update(adminDb.collection('stravaTokens').doc(uid), {
    lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.update(adminDb.collection('stravaConnections').doc(uid), {
    lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

/**
 * @typedef {object} SyncSingleParams
 * @property {string} uid - Firebase user uid.
 * @property {string} accessToken - Strava OAuth access token.
 * @property {number} stravaActivityId - Strava activity ID to fetch.
 */

/**
 * Fetches a single activity from Strava and writes it to Firestore.
 * Filters by ALLOWED_TYPES. Returns true if written, false if filtered out
 * or not found.
 * @param {SyncSingleParams} params - Parameters for single activity sync.
 * @returns {Promise<boolean>} True if activity was written to Firestore.
 */
async function syncSingleStravaActivity({ uid, accessToken, stravaActivityId }) {
  const response = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    await adminDb.collection('stravaActivities').doc(String(stravaActivityId)).delete();
    return false;
  }

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status} ${response.statusText}`);
  }

  const activity = await response.json();
  if (!ALLOWED_TYPES.includes(activity.type)) {
    return false;
  }

  const docRef = adminDb.collection('stravaActivities').doc(String(activity.id));
  await docRef.set(mapStravaActivityToDoc(uid, activity), { merge: true });
  await updateLastSyncAt(uid);
  return true;
}

/**
 * @typedef {object} SyncParams
 * @property {string} uid - Firebase user uid.
 * @property {string} accessToken - Strava OAuth access token.
 * @property {number} afterEpoch - Unix epoch to fetch activities after.
 */

/**
 * Fetches running activities from Strava API and syncs them to Firestore.
 * Filters to Run, TrailRun, VirtualRun types only. Writes to
 * stravaActivities/{stravaId} and updates lastSyncAt on stravaTokens
 * and stravaConnections docs.
 * @param {SyncParams} params - Sync parameters.
 * @returns {Promise<number>} Number of activities synced.
 */
async function syncStravaActivities({ uid, accessToken, afterEpoch }) {
  const PER_PAGE = 100;
  let page = 1;
  let totalSynced = 0;

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=${PER_PAGE}&page=${page}`;
    // eslint-disable-next-line no-await-in-loop -- pages must be fetched sequentially
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Strava API error: ${response.status} ${response.statusText}`);
    }

    // eslint-disable-next-line no-await-in-loop
    const activities = await response.json();
    const runActivities = activities.filter((/** @type {{ type: string }} */ a) =>
      ALLOWED_TYPES.includes(a.type),
    );

    if (runActivities.length > 0) {
      const batch = adminDb.batch();

      runActivities.forEach((activity) => {
        const docRef = adminDb.collection('stravaActivities').doc(String(activity.id));
        batch.set(docRef, mapStravaActivityToDoc(uid, activity), { merge: true });
      });

      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      totalSynced += runActivities.length;
    }

    if (activities.length < PER_PAGE) break;
    page += 1;
  }

  await updateLastSyncAt(uid);

  return totalSynced;
}

export {
  adminDb,
  verifyAuthToken,
  mapStravaActivityToDoc,
  getUidByAthleteId,
  ensureValidStravaToken,
  updateLastSyncAt,
  syncSingleStravaActivity,
  syncStravaActivities,
};
