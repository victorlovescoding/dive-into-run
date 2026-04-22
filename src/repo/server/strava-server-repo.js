import {
  adminDb,
  createAdminServerTimestamp,
  createAdminTimestampFromDate,
} from '@/config/server/firebase-admin-app';

const STRAVA_ACTIVITY_BATCH_LIMIT = 500;

/**
 * @typedef {object} StravaTokenRecord
 * @property {string} accessToken - Strava access token.
 * @property {string} refreshToken - Strava refresh token.
 * @property {number} expiresAt - Expiry epoch seconds.
 * @property {number} [athleteId] - Linked Strava athlete ID.
 * @property {{ toDate: () => Date } | null | undefined} [lastSyncAt] - Last sync timestamp.
 */

/**
 * @typedef {object} StravaConnectionRecord
 * @property {boolean} connected - Whether the account is currently connected.
 * @property {number} [athleteId] - Linked Strava athlete ID.
 * @property {string} [athleteName] - Human-readable athlete name.
 * @property {{ toDate: () => Date } | null | undefined} [lastSyncAt] - Last sync timestamp.
 */

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
    startDate: createAdminTimestampFromDate(new Date(activity.start_date)),
    startDateLocal: activity.start_date_local,
    summaryPolyline: activity.map?.summary_polyline || null,
    averageSpeed: activity.average_speed,
    syncedAt: createAdminServerTimestamp(),
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

  if (snap.empty) {
    return null;
  }

  return snap.docs[0].id;
}

/**
 * Reads a user's Strava token record.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<StravaTokenRecord | null>} Token data or null when missing.
 */
async function getStravaToken(uid) {
  const tokenDoc = await adminDb.collection('stravaTokens').doc(uid).get();
  if (!tokenDoc.exists) {
    return null;
  }

  return /** @type {StravaTokenRecord | null} */ (tokenDoc.data() ?? null);
}

/**
 * Reads a user's Strava connection record.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<StravaConnectionRecord | null>} Connection data or null when missing.
 */
async function getStravaConnection(uid) {
  const connectionDoc = await adminDb.collection('stravaConnections').doc(uid).get();
  if (!connectionDoc.exists) {
    return null;
  }

  return /** @type {StravaConnectionRecord | null} */ (connectionDoc.data() ?? null);
}

/**
 * Persists Strava token credentials after OAuth exchange.
 * @param {{
 *   uid: string,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt: number,
 *   athleteId: number,
 * }} params - Token write payload.
 * @returns {Promise<void>}
 */
async function saveStravaConnectionTokens({
  uid,
  accessToken,
  refreshToken,
  expiresAt,
  athleteId,
}) {
  await adminDb.collection('stravaTokens').doc(uid).set({
    accessToken,
    refreshToken,
    expiresAt,
    athleteId,
    connectedAt: createAdminServerTimestamp(),
  });
}

/**
 * Persists client-readable Strava connection state.
 * @param {{
 *   uid: string,
 *   athleteId: number,
 *   athleteName: string,
 * }} params - Connection write payload.
 * @returns {Promise<void>}
 */
async function saveStravaConnection({ uid, athleteId, athleteName }) {
  await adminDb.collection('stravaConnections').doc(uid).set({
    connected: true,
    athleteId,
    athleteName,
    connectedAt: createAdminServerTimestamp(),
  });
}

/**
 * Updates a user's Strava token after refresh.
 * @param {{
 *   uid: string,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt: number,
 * }} params - Refresh payload.
 * @returns {Promise<void>}
 */
async function updateStravaToken({ uid, accessToken, refreshToken, expiresAt }) {
  await adminDb.collection('stravaTokens').doc(uid).update({
    accessToken,
    refreshToken,
    expiresAt,
    updatedAt: createAdminServerTimestamp(),
  });
}

/**
 * Marks a user's Strava connection as disconnected.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<void>}
 */
async function markStravaConnectionDisconnected(uid) {
  await adminDb.collection('stravaConnections').doc(uid).update({ connected: false });
}

/**
 * Updates lastSyncAt on both token and connection docs.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<void>}
 */
async function updateStravaLastSyncAt(uid) {
  const batch = adminDb.batch();
  batch.update(adminDb.collection('stravaTokens').doc(uid), {
    lastSyncAt: createAdminServerTimestamp(),
  });
  batch.update(adminDb.collection('stravaConnections').doc(uid), {
    lastSyncAt: createAdminServerTimestamp(),
  });
  await batch.commit();
}

/**
 * Writes a single Strava activity document.
 * @param {string} uid - Firebase user uid.
 * @param {object} activity - Raw Strava API activity object.
 * @returns {Promise<void>}
 */
async function writeStravaActivity(uid, activity) {
  const docRef = adminDb.collection('stravaActivities').doc(String(activity.id));
  await docRef.set(mapStravaActivityToDoc(uid, activity), { merge: true });
}

/**
 * Writes multiple Strava activity documents in a batch.
 * @param {string} uid - Firebase user uid.
 * @param {object[]} activities - Raw Strava API activity objects.
 * @returns {Promise<void>}
 */
async function writeStravaActivities(uid, activities) {
  const batch = adminDb.batch();

  activities.forEach((activity) => {
    const docRef = adminDb.collection('stravaActivities').doc(String(activity.id));
    batch.set(docRef, mapStravaActivityToDoc(uid, activity), { merge: true });
  });

  await batch.commit();
}

/**
 * Deletes a single Strava activity document.
 * @param {number} stravaActivityId - Strava activity ID.
 * @returns {Promise<void>}
 */
async function deleteStravaActivity(stravaActivityId) {
  await adminDb.collection('stravaActivities').doc(String(stravaActivityId)).delete();
}

/**
 * Deletes token state and marks the connection as disconnected in one batch.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<void>}
 */
async function deleteStravaTokenAndDisconnect(uid) {
  const batch = adminDb.batch();
  batch.delete(adminDb.collection('stravaTokens').doc(uid));
  batch.update(adminDb.collection('stravaConnections').doc(uid), { connected: false });
  await batch.commit();
}

/**
 * Deletes all synced Strava activities for a user in batches.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<void>}
 */
async function deleteUserStravaActivities(uid) {
  const activitiesRef = adminDb.collection('stravaActivities');
  const activitiesQuery = activitiesRef.where('uid', '==', uid).limit(STRAVA_ACTIVITY_BATCH_LIMIT);
  let snapshot = await activitiesQuery.get();

  while (!snapshot.empty) {
    const batch = adminDb.batch();
    snapshot.docs.forEach((activityDoc) => {
      batch.delete(activityDoc.ref);
    });
    // eslint-disable-next-line no-await-in-loop -- batch deletes must run sequentially to avoid exceeding Firestore limits
    await batch.commit();
    // eslint-disable-next-line no-await-in-loop -- must re-query after each batch commit
    snapshot = await activitiesQuery.get();
  }
}

export {
  mapStravaActivityToDoc,
  getUidByAthleteId,
  getStravaToken,
  getStravaConnection,
  saveStravaConnectionTokens,
  saveStravaConnection,
  updateStravaToken,
  markStravaConnectionDisconnected,
  updateStravaLastSyncAt,
  writeStravaActivity,
  writeStravaActivities,
  deleteStravaActivity,
  deleteStravaTokenAndDisconnect,
  deleteUserStravaActivities,
};
