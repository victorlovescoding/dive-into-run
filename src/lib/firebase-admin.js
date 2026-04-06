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
        batch.set(
          docRef,
          {
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
          },
          { merge: true },
        );
      });

      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      totalSynced += runActivities.length;
    }

    if (activities.length < PER_PAGE) break;
    page += 1;
  }

  if (totalSynced > 0) {
    const finalBatch = adminDb.batch();
    const tokensRef = adminDb.collection('stravaTokens').doc(uid);
    const connectionsRef = adminDb.collection('stravaConnections').doc(uid);
    finalBatch.update(tokensRef, { lastSyncAt: admin.firestore.FieldValue.serverTimestamp() });
    finalBatch.update(connectionsRef, { lastSyncAt: admin.firestore.FieldValue.serverTimestamp() });
    await finalBatch.commit();
  }

  return totalSynced;
}

export { adminDb, verifyAuthToken, syncStravaActivities };
