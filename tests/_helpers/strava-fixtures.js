/**
 * @file Shared Strava OAuth callback fixtures for audit P1-3 tests.
 * @description Plain data / Web API helpers only. No `@/repo/**` or
 * `@/runtime/**` imports so the test bucket stays forward-only.
 */

/**
 * @typedef {object} StravaAthletePayload
 * @property {number} id - Strava athlete ID.
 * @property {string} firstname - Athlete first name.
 * @property {string} lastname - Athlete last name.
 */

/**
 * @typedef {object} StravaActivityPayload
 * @property {number} id - Strava activity ID.
 * @property {string} name - Activity title.
 * @property {string} type - Strava activity type.
 * @property {number} distance - Distance in meters.
 * @property {number} moving_time - Moving time in seconds.
 * @property {string} start_date - ISO UTC start time.
 * @property {string} start_date_local - ISO local start time.
 * @property {{ summary_polyline: string | null }} map - Polyline summary.
 * @property {number} average_speed - Average speed in m/s.
 */

const DEFAULT_TOKEN = Object.freeze({
  access_token: 'strava-access-token',
  refresh_token: 'strava-refresh-token',
  expires_at: 1_900_000_000,
  expires_in: 21_600,
  token_type: 'Bearer',
});

const DEFAULT_ATHLETE = Object.freeze({
  id: 42,
  firstname: 'John',
  lastname: 'Doe',
});

const DEFAULT_RUN_ACTIVITY = Object.freeze({
  id: 101,
  name: 'Morning Run',
  type: 'Run',
  distance: 5200,
  moving_time: 1710,
  start_date: '2026-04-01T00:00:00Z',
  start_date_local: '2026-04-01T08:00:00',
  map: { summary_polyline: 'encoded-polyline' },
  average_speed: 3.04,
});

const DEFAULT_RIDE_ACTIVITY = Object.freeze({
  ...DEFAULT_RUN_ACTIVITY,
  id: 102,
  name: 'Evening Ride',
  type: 'Ride',
  distance: 18_000,
  moving_time: 2400,
  start_date: '2026-04-02T00:00:00Z',
  start_date_local: '2026-04-02T18:00:00',
  map: { summary_polyline: 'encoded-ride' },
  average_speed: 7.5,
});

const DEFAULT_TRAIL_RUN_ACTIVITY = Object.freeze({
  ...DEFAULT_RUN_ACTIVITY,
  id: 103,
  name: 'Hill Repeats',
  type: 'TrailRun',
  distance: 8400,
  moving_time: 3300,
  start_date: '2026-04-03T00:00:00Z',
  start_date_local: '2026-04-03T07:30:00',
  map: { summary_polyline: 'encoded-trail' },
  average_speed: 2.55,
});

/**
 * Builds a Strava activity payload with caller overrides.
 * @param {Partial<StravaActivityPayload>} [overrides] - Activity field overrides.
 * @returns {StravaActivityPayload} Full activity payload.
 */
export function createStravaActivity(overrides = {}) {
  return { ...DEFAULT_RUN_ACTIVITY, ...overrides };
}

/**
 * Builds a successful Strava token-exchange response.
 * @param {{ overrides?: Record<string, unknown> & { athlete?: Partial<StravaAthletePayload> } }} [params] - Optional payload overrides.
 * @returns {Response} JSON response with status 200.
 */
export function createStravaTokenExchangeResponse({ overrides = {} } = {}) {
  const { athlete: athleteOverrides, ...topOverrides } = overrides;
  const body = {
    ...DEFAULT_TOKEN,
    athlete: { ...DEFAULT_ATHLETE, ...(athleteOverrides ?? {}) },
    ...topOverrides,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Builds a Strava activities-list response.
 * @param {{ activities?: ReadonlyArray<Partial<StravaActivityPayload>> }} [params] - Optional activity overrides.
 * @returns {Response} JSON response with status 200.
 */
export function createStravaActivitiesResponse({ activities } = {}) {
  const body = (activities ?? [
    DEFAULT_RUN_ACTIVITY,
    DEFAULT_RIDE_ACTIVITY,
    DEFAULT_TRAIL_RUN_ACTIVITY,
  ]).map((activity) => createStravaActivity(activity));

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Builds a non-2xx Strava response body.
 * @param {number} status - HTTP status code.
 * @param {Record<string, unknown> | string} [body] - Response body.
 * @returns {Response} Response with the supplied status/body.
 */
export function createStravaErrorResponse(status, body = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);

  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Builds a POST request for the Strava callback route.
 * `authorizationHeader` lets callers model missing or malformed headers without
 * duplicating request-construction logic in route tests.
 * @param {{
 *   code?: string | null,
 *   idToken?: string | null,
 *   authorizationHeader?: string | null,
 *   url?: string,
 * }} [params] - Request overrides.
 * @returns {Request} Request ready for the route handler.
 */
export function createStravaCallbackRequest({
  code,
  idToken = 'valid-token',
  authorizationHeader,
  url = 'http://localhost:3000/api/strava/callback',
} = {}) {
  /** @type {Record<string, string>} */
  const headers = { 'Content-Type': 'application/json' };
  if (authorizationHeader !== undefined) {
    if (authorizationHeader !== null) {
      headers.Authorization = authorizationHeader;
    }
  } else if (idToken !== null && idToken !== undefined) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(code === null || code === undefined ? {} : { code }),
  });
}

export {
  DEFAULT_RIDE_ACTIVITY as STRAVA_DEFAULT_RIDE_ACTIVITY,
  DEFAULT_RUN_ACTIVITY as STRAVA_DEFAULT_RUN_ACTIVITY,
  DEFAULT_TRAIL_RUN_ACTIVITY as STRAVA_DEFAULT_TRAIL_RUN_ACTIVITY,
};
