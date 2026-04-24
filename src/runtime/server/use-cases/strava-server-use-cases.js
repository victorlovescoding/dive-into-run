import verifyFirebaseIdToken from '@/repo/server/firebase-auth-admin-repo';
import {
  getInitialStravaSyncAfterEpoch,
  getStravaSyncCooldownMs,
  isSupportedStravaActivityType,
  matchesStravaWebhookSubscriptionId,
  matchesStravaWebhookVerifyToken,
  requestStravaActivitiesPage,
  requestStravaActivity,
  requestStravaAuthorizationCodeExchange,
  requestStravaTokenRefresh,
} from '@/repo/server/strava-api-repo';
import {
  deleteStravaActivity,
  deleteStravaTokenAndDisconnect,
  deleteUserStravaActivities,
  getStravaConnection,
  getStravaToken,
  getUidByAthleteId,
  markStravaConnectionDisconnected,
  saveStravaConnection,
  saveStravaConnectionTokens,
  updateStravaLastSyncAt,
  updateStravaToken,
  writeStravaActivity,
  writeStravaActivities,
} from '@/repo/server/strava-server-repo';

const STRAVA_PAGE_SIZE = 100;

/**
 * @typedef {object} EnsureTokenResult
 * @property {string} [accessToken] - Valid Strava access token.
 * @property {string} [error] - Error message if token could not be obtained.
 */

/**
 * @typedef {object} StravaRouteResult
 * @property {number} status - HTTP status code.
 * @property {Record<string, unknown>} body - JSON response body.
 */

/**
 * @typedef {object} StravaWebhookEvent
 * @property {string} object_type - "activity" or "athlete".
 * @property {number} object_id - Strava activity or athlete ID.
 * @property {string} aspect_type - "create", "update", or "delete".
 * @property {Record<string, string>} updates - Changed fields.
 * @property {number} owner_id - Strava athlete ID of the event owner.
 * @property {number} subscription_id - Webhook subscription ID.
 * @property {number} event_time - Unix timestamp of the event.
 */

/**
 * Extracts a bearer token from a Request.
 * @param {Request} request - Incoming HTTP request.
 * @returns {string | null} Firebase ID token or null when absent/invalid.
 */
function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
}

/**
 * Verifies a Firebase auth bearer token from a Request.
 * @param {Request} request - Incoming HTTP request with Authorization header.
 * @returns {Promise<string | null>} Decoded user uid, or null if invalid/missing.
 */
async function verifyAuthToken(request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Ensures a valid Strava access token for the given uid.
 * Refreshes via Strava OAuth if expired, updates Firestore accordingly.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<EnsureTokenResult>} Object with accessToken or error.
 */
async function ensureValidStravaToken(uid) {
  const tokenData = await getStravaToken(uid);
  if (!tokenData) {
    return { error: 'Token not found' };
  }

  if (tokenData.expiresAt >= Math.floor(Date.now() / 1000)) {
    return { accessToken: tokenData.accessToken };
  }

  const refreshResponse = await requestStravaTokenRefresh(tokenData.refreshToken);

  if (!refreshResponse.ok) {
    await markStravaConnectionDisconnected(uid);
    return { error: 'Token refresh failed' };
  }

  const refreshData = await refreshResponse.json();
  await updateStravaToken({
    uid,
    accessToken: refreshData.access_token,
    refreshToken: refreshData.refresh_token,
    expiresAt: refreshData.expires_at,
  });

  return { accessToken: refreshData.access_token };
}

/**
 * Fetches a single activity from Strava and writes it to Firestore.
 * Filters by allowed running activity types.
 * @param {{ uid: string, accessToken: string, stravaActivityId: number }} params - Sync parameters.
 * @returns {Promise<boolean>} True if the activity was written to Firestore.
 */
async function syncSingleStravaActivity({ uid, accessToken, stravaActivityId }) {
  const response = await requestStravaActivity({ accessToken, stravaActivityId });

  if (response.status === 404) {
    await deleteStravaActivity(stravaActivityId);
    return false;
  }

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status} ${response.statusText}`);
  }

  const activity = await response.json();
  if (!isSupportedStravaActivityType(activity.type)) {
    return false;
  }

  await writeStravaActivity(uid, activity);
  await updateStravaLastSyncAt(uid);
  return true;
}

/**
 * Fetches running activities from Strava API and syncs them to Firestore.
 * @param {{ uid: string, accessToken: string, afterEpoch: number }} params - Sync parameters.
 * @returns {Promise<number>} Number of activities synced.
 */
async function syncStravaActivities({ uid, accessToken, afterEpoch }) {
  let page = 1;
  let totalSynced = 0;

  while (true) {
    // eslint-disable-next-line no-await-in-loop -- pages must be fetched sequentially
    const response = await requestStravaActivitiesPage({
      accessToken,
      afterEpoch,
      page,
      perPage: STRAVA_PAGE_SIZE,
    });

    if (!response.ok) {
      throw new Error(`Strava API error: ${response.status} ${response.statusText}`);
    }

    // eslint-disable-next-line no-await-in-loop
    const activities = await response.json();
    const runActivities = activities.filter((/** @type {{ type: string }} */ activity) =>
      isSupportedStravaActivityType(activity.type),
    );

    if (runActivities.length > 0) {
      // eslint-disable-next-line no-await-in-loop -- writes must remain in page order
      await writeStravaActivities(uid, runActivities);
      totalSynced += runActivities.length;
    }

    if (activities.length < STRAVA_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  await updateStravaLastSyncAt(uid);
  return totalSynced;
}

/**
 * Exchanges a Strava OAuth code, persists connection state, and performs
 * the initial backfill sync.
 * @param {{ uid: string, code: string }} params - OAuth callback parameters.
 * @returns {Promise<StravaRouteResult>} HTTP-like result payload.
 */
async function connectStravaAccount({ uid, code }) {
  const tokenResponse = await requestStravaAuthorizationCodeExchange(code);

  if (!tokenResponse.ok) {
    return {
      status: 400,
      body: { error: 'Invalid authorization code' },
    };
  }

  const tokenData = await tokenResponse.json();
  const athleteName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`;

  await saveStravaConnectionTokens({
    uid,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: tokenData.expires_at,
    athleteId: tokenData.athlete.id,
  });
  await saveStravaConnection({
    uid,
    athleteId: tokenData.athlete.id,
    athleteName,
  });

  let syncedCount = 0;

  try {
    syncedCount = await syncStravaActivities({
      uid,
      accessToken: tokenData.access_token,
      afterEpoch: getInitialStravaSyncAfterEpoch(),
    });
  } catch {
    syncedCount = 0;
  }

  return {
    status: 200,
    body: {
      success: true,
      athleteName,
      syncedCount,
    },
  };
}

/**
 * Runs a user-triggered Strava sync with cooldown enforcement.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<StravaRouteResult>} HTTP-like result payload.
 */
async function syncStravaAccount(uid) {
  const tokenData = await getStravaToken(uid);
  if (!tokenData) {
    return {
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  if (tokenData.lastSyncAt) {
    const lastSyncMs = tokenData.lastSyncAt.toDate().getTime();
    const elapsed = Date.now() - lastSyncMs;
    if (elapsed < getStravaSyncCooldownMs()) {
      return {
        status: 429,
        body: {
          error: 'Sync cooldown active',
          retryAfter: Math.ceil((getStravaSyncCooldownMs() - elapsed) / 1000),
        },
      };
    }
  }

  const tokenResult = await ensureValidStravaToken(uid);
  if (tokenResult.error) {
    return {
      status: 401,
      body: { error: tokenResult.error },
    };
  }

  const afterEpoch = tokenData.lastSyncAt
    ? Math.floor(tokenData.lastSyncAt.toDate().getTime() / 1000)
    : getInitialStravaSyncAfterEpoch();

  try {
    const count = await syncStravaActivities({
      uid,
      accessToken: tokenResult.accessToken,
      afterEpoch,
    });

    return {
      status: 200,
      body: { success: true, count },
    };
  } catch {
    return {
      status: 500,
      body: { error: 'Sync failed' },
    };
  }
}

/**
 * Disconnects Strava for a user and removes synced activities.
 * @param {string} uid - Firebase user uid.
 * @returns {Promise<StravaRouteResult>} HTTP-like result payload.
 */
async function disconnectStravaAccount(uid) {
  const connection = await getStravaConnection(uid);
  if (!connection?.connected) {
    return {
      status: 400,
      body: { error: 'Not connected to Strava' },
    };
  }

  await deleteStravaTokenAndDisconnect(uid);
  await deleteUserStravaActivities(uid);

  return {
    status: 200,
    body: { success: true },
  };
}

/**
 * Validates Strava's webhook challenge request.
 * @param {Request} request - Incoming webhook verification request.
 * @returns {StravaRouteResult} HTTP-like challenge response.
 */
function buildStravaWebhookChallengeResponse(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  if (matchesStravaWebhookVerifyToken({ mode, verifyToken })) {
    return {
      status: 200,
      body: { 'hub.challenge': challenge },
    };
  }

  return {
    status: 403,
    body: { error: 'Forbidden' },
  };
}

/**
 * Checks whether a webhook event is for the configured Strava subscription.
 * @param {number | string | null | undefined} subscriptionId - Incoming subscription ID.
 * @returns {boolean} True when the event belongs to the configured subscription.
 */
function hasMatchingStravaWebhookSubscription(subscriptionId) {
  return matchesStravaWebhookSubscriptionId(subscriptionId);
}

/**
 * Handles an activity create or update event by fetching the activity
 * from Strava and writing it to Firestore.
 * @param {number} ownerId - Strava athlete ID.
 * @param {number} activityId - Strava activity ID.
 * @returns {Promise<void>}
 */
async function handleActivityCreateOrUpdate(ownerId, activityId) {
  const uid = await getUidByAthleteId(ownerId);
  if (!uid) {
    return;
  }

  const tokenResult = await ensureValidStravaToken(uid);
  if (tokenResult.error) {
    return;
  }

  await syncSingleStravaActivity({
    uid,
    accessToken: tokenResult.accessToken,
    stravaActivityId: activityId,
  });
}

/**
 * Handles athlete deauthorization by marking the connection as disconnected
 * and deleting stored tokens. Historical activities are preserved.
 * @param {number} ownerId - Strava athlete ID.
 * @returns {Promise<void>}
 */
async function handleAthleteDeauth(ownerId) {
  const uid = await getUidByAthleteId(ownerId);
  if (!uid) {
    return;
  }

  await deleteStravaTokenAndDisconnect(uid);
}

/**
 * Processes a Strava webhook event asynchronously.
 * @param {StravaWebhookEvent} event - Parsed webhook event payload.
 * @returns {Promise<void>}
 */
async function processWebhookEvent(event) {
  const {
    object_type: objectType,
    object_id: objectId,
    aspect_type: aspectType,
    owner_id: ownerId,
    updates,
  } = event;

  if (objectType === 'athlete' && aspectType === 'update' && updates?.authorized === 'false') {
    await handleAthleteDeauth(ownerId);
    return;
  }

  if (objectType !== 'activity') {
    return;
  }

  if (aspectType === 'create' || aspectType === 'update') {
    await handleActivityCreateOrUpdate(ownerId, objectId);
    return;
  }

  if (aspectType === 'delete') {
    await deleteStravaActivity(objectId);
  }
}

export {
  verifyAuthToken,
  ensureValidStravaToken,
  syncSingleStravaActivity,
  syncStravaActivities,
  connectStravaAccount,
  syncStravaAccount,
  disconnectStravaAccount,
  buildStravaWebhookChallengeResponse,
  hasMatchingStravaWebhookSubscription,
  processWebhookEvent,
};
