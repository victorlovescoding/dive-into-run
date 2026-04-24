import {
  STRAVA_TOKEN_URL,
  STRAVA_ACTIVITIES_URL,
  STRAVA_ALLOWED_ACTIVITY_TYPES,
  STRAVA_INITIAL_SYNC_HISTORY_WINDOW_SECONDS,
  STRAVA_SYNC_COOLDOWN_MS,
  getStravaActivityUrl,
  getStravaClientCredentials,
  getStravaWebhookSubscriptionId,
  getStravaWebhookVerifyToken,
} from '@/config/server/strava-server-config';

/**
 * Exchanges a Strava authorization code for OAuth tokens.
 * @param {string} code - Strava OAuth authorization code.
 * @returns {Promise<Response>} Raw Strava token exchange response.
 */
async function requestStravaAuthorizationCodeExchange(code) {
  const { clientId, clientSecret } = getStravaClientCredentials();

  return fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
}

/**
 * Refreshes a Strava access token.
 * @param {string} refreshToken - Existing Strava refresh token.
 * @returns {Promise<Response>} Raw Strava refresh response.
 */
async function requestStravaTokenRefresh(refreshToken) {
  const { clientId, clientSecret } = getStravaClientCredentials();

  return fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
}

/**
 * Fetches a single Strava activity.
 * @param {{ accessToken: string, stravaActivityId: number }} params - Request parameters.
 * @returns {Promise<Response>} Raw Strava activity response.
 */
async function requestStravaActivity({ accessToken, stravaActivityId }) {
  return fetch(getStravaActivityUrl(stravaActivityId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Fetches one page of Strava athlete activities.
 * @param {{ accessToken: string, afterEpoch: number, page: number, perPage: number }} params - Request parameters.
 * @returns {Promise<Response>} Raw Strava activity list response.
 */
async function requestStravaActivitiesPage({ accessToken, afterEpoch, page, perPage }) {
  const url = `${STRAVA_ACTIVITIES_URL}?after=${afterEpoch}&per_page=${perPage}&page=${page}`;

  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Checks whether an activity type is part of the supported running subset.
 * @param {string} type - Strava activity type.
 * @returns {boolean} True when the activity should be synced.
 */
function isSupportedStravaActivityType(type) {
  return STRAVA_ALLOWED_ACTIVITY_TYPES.includes(type);
}

/**
 * Calculates the default initial sync history-window epoch.
 * @returns {number} Unix epoch seconds.
 */
function getInitialStravaSyncAfterEpoch() {
  return Math.floor(Date.now() / 1000) - STRAVA_INITIAL_SYNC_HISTORY_WINDOW_SECONDS;
}

/**
 * Returns the Strava sync cooldown in milliseconds.
 * @returns {number} Cooldown duration.
 */
function getStravaSyncCooldownMs() {
  return STRAVA_SYNC_COOLDOWN_MS;
}

/**
 * Checks whether an incoming webhook verify token matches the configured secret.
 * @param {{ mode: string | null, verifyToken: string | null }} params - Webhook verification params.
 * @returns {boolean} True when the webhook verification is valid.
 */
function matchesStravaWebhookVerifyToken({ mode, verifyToken }) {
  return mode === 'subscribe' && verifyToken === getStravaWebhookVerifyToken();
}

/**
 * Checks whether an incoming webhook subscription ID matches the configured subscription.
 * @param {number | string | null | undefined} subscriptionId - Incoming subscription ID.
 * @returns {boolean} True when the event belongs to the configured subscription.
 */
function matchesStravaWebhookSubscriptionId(subscriptionId) {
  return String(subscriptionId) === getStravaWebhookSubscriptionId();
}

export {
  requestStravaAuthorizationCodeExchange,
  requestStravaTokenRefresh,
  requestStravaActivity,
  requestStravaActivitiesPage,
  isSupportedStravaActivityType,
  getInitialStravaSyncAfterEpoch,
  getStravaSyncCooldownMs,
  matchesStravaWebhookVerifyToken,
  matchesStravaWebhookSubscriptionId,
};
