const STRAVA_TOKEN_URL = 'https://www.strava.com/api/v3/oauth/token';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const STRAVA_ALLOWED_ACTIVITY_TYPES = Object.freeze(['Run', 'TrailRun', 'VirtualRun']);
const STRAVA_INITIAL_SYNC_HISTORY_WINDOW_SECONDS = 60 * 24 * 3600;
const STRAVA_SYNC_COOLDOWN_MS = 300000;

/**
 * Builds the Strava activity detail API URL.
 * @param {number} stravaActivityId - Strava activity ID.
 * @returns {string} Activity detail URL.
 */
function getStravaActivityUrl(stravaActivityId) {
  return `https://www.strava.com/api/v3/activities/${stravaActivityId}`;
}

/**
 * Reads Strava OAuth client credentials from server env.
 * @returns {{ clientId: string | undefined, clientSecret: string | undefined }} OAuth client credentials.
 */
function getStravaClientCredentials() {
  return {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
  };
}

/**
 * Reads the Strava webhook verify token from server env.
 * @returns {string | undefined} Strava webhook verify token.
 */
function getStravaWebhookVerifyToken() {
  return process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
}

/**
 * Reads the Strava webhook subscription ID from server env.
 * @returns {string | undefined} Strava webhook subscription ID.
 */
function getStravaWebhookSubscriptionId() {
  return process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID;
}

export {
  STRAVA_TOKEN_URL,
  STRAVA_ACTIVITIES_URL,
  STRAVA_ALLOWED_ACTIVITY_TYPES,
  STRAVA_INITIAL_SYNC_HISTORY_WINDOW_SECONDS,
  STRAVA_SYNC_COOLDOWN_MS,
  getStravaActivityUrl,
  getStravaClientCredentials,
  getStravaWebhookVerifyToken,
  getStravaWebhookSubscriptionId,
};
