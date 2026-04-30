/**
 * @file Option B contract tests for `POST /api/strava/callback`.
 * @description Audit P1-3 requires the real route/use-case/repo stack to run
 * without mocking `@/runtime/server/use-cases/strava-server-use-cases` or
 * `@/repo/server/**`. This suite keeps the unit project and only mocks the
 * external boundaries: `firebase-admin` and `globalThis.fetch`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStravaActivitiesResponse,
  createStravaActivity,
  createStravaCallbackRequest,
  createStravaErrorResponse,
  createStravaTokenExchangeResponse,
} from '../../_helpers/strava-fixtures.js';
import adminMock from './strava-callback-route-admin-mock.js';

const originalFetch = globalThis.fetch;
const { POST } = await import('@/app/api/strava/callback/route');

/**
 * Builds a callback request while allowing missing/malformed auth headers.
 * @param {{ code?: string | null, idToken?: string | null, authorizationHeader?: string | null }} [options] - Request overrides.
 * @returns {Request} Strava callback request.
 */
function createMockRequest(options = {}) {
  return createStravaCallbackRequest(options);
}

/**
 * Returns the expected Strava token exchange payload.
 * @param {string} code - Authorization code.
 * @returns {{ method: string, headers: { 'Content-Type': string }, body: string }} Fetch init.
 */
function createTokenExchangePayload(code) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      code,
      grant_type: 'authorization_code',
    }),
  };
}

describe('POST /api/strava/callback', () => {
  beforeEach(() => {
    adminMock.reset();
    vi.stubEnv('STRAVA_CLIENT_ID', 'test-client-id');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-client-secret');
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns 401 when auth token is invalid', async () => {
    adminMock.verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const response = await POST(createMockRequest({ code: 'auth-code-xyz' }));

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['Authorization header is missing', createMockRequest({ code: 'auth-code-xyz', idToken: null })],
    [
      'Authorization header is malformed',
      createMockRequest({ code: 'auth-code-xyz', authorizationHeader: 'Token valid-token' }),
    ],
  ])('returns 401 when %s', async (_label, request) => {
    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
    expect(adminMock.verifyIdToken).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when code is missing from body', async () => {
    adminMock.verifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Missing authorization code' });
    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when Strava rejects the authorization code', async () => {
    const mockFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.verifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockFetch.mockResolvedValue(createStravaErrorResponse(400, { message: 'bad code' }));

    const response = await POST(createMockRequest({ code: 'bad-code' }));

    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://www.strava.com/api/v3/oauth/token',
      createTokenExchangePayload('bad-code'),
    );
    await expect(response.json()).resolves.toEqual({ error: 'Invalid authorization code' });
    expect(response.status).toBe(400);
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toBeUndefined();
  });

  it('bubbles token-exchange network errors', async () => {
    const mockFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.verifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockFetch.mockRejectedValueOnce(new Error('token exchange down'));

    await expect(POST(createMockRequest({ code: 'auth-code-xyz' }))).rejects.toThrow(
      'token exchange down',
    );
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toBeUndefined();
    expect(adminMock.readDoc('stravaConnections/user-uid-123')).toBeUndefined();
  });

  it('stores tokens, syncs supported activities, and returns success', async () => {
    const mockFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.verifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockFetch
      .mockResolvedValueOnce(createStravaTokenExchangeResponse())
      .mockResolvedValueOnce(createStravaActivitiesResponse());

    const response = await POST(createMockRequest({ code: 'auth-code-xyz' }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      athleteName: 'John Doe',
      syncedCount: 2,
    });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://www.strava.com/api/v3/oauth/token',
      createTokenExchangePayload('auth-code-xyz'),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/v3/athlete/activities?after='),
      { headers: { Authorization: 'Bearer strava-access-token' } },
    );
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toMatchObject({
      accessToken: 'strava-access-token',
      refreshToken: 'strava-refresh-token',
      expiresAt: 1_900_000_000,
      athleteId: 42,
      connectedAt: { __type: 'serverTimestamp' },
      lastSyncAt: { __type: 'serverTimestamp' },
    });
    expect(adminMock.readDoc('stravaConnections/user-uid-123')).toMatchObject({
      connected: true,
      athleteId: 42,
      athleteName: 'John Doe',
      connectedAt: { __type: 'serverTimestamp' },
      lastSyncAt: { __type: 'serverTimestamp' },
    });
    expect(adminMock.readDoc('stravaActivities/101')).toMatchObject({
      uid: 'user-uid-123',
      stravaId: 101,
      name: 'Morning Run',
    });
    expect(adminMock.readDoc('stravaActivities/102')).toBeUndefined();
    expect(adminMock.readDoc('stravaActivities/103')).toMatchObject({
      uid: 'user-uid-123',
      stravaId: 103,
      name: 'Hill Repeats',
    });
  });

  it('still returns success when the initial sync returns a Strava error response', async () => {
    const mockFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.verifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockFetch
      .mockResolvedValueOnce(
        createStravaTokenExchangeResponse({
          overrides: { athlete: { firstname: 'Jane', lastname: 'Runner' } },
        }),
      )
      .mockResolvedValueOnce(createStravaErrorResponse(500, 'upstream error'));

    const response = await POST(createMockRequest({ code: 'auth-code-xyz' }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      athleteName: 'Jane Runner',
      syncedCount: 0,
    });
    expect(response.status).toBe(200);
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toMatchObject({
      accessToken: 'strava-access-token',
      refreshToken: 'strava-refresh-token',
      athleteId: 42,
    });
    expect(adminMock.readDoc('stravaConnections/user-uid-123')).toMatchObject({
      connected: true,
      athleteName: 'Jane Runner',
    });
    expect(adminMock.readDoc('stravaActivities/101')).toBeUndefined();
  });

  it('still returns success when the initial sync hits a network error', async () => {
    const mockFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.verifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockFetch
      .mockResolvedValueOnce(
        createStravaTokenExchangeResponse({
          overrides: { athlete: { firstname: 'Crash', lastname: 'Runner' } },
        }),
      )
      .mockRejectedValueOnce(new Error('activity sync down'));

    const response = await POST(createMockRequest({ code: 'auth-code-xyz' }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      athleteName: 'Crash Runner',
      syncedCount: 0,
    });
    expect(response.status).toBe(200);
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toMatchObject({
      accessToken: 'strava-access-token',
      refreshToken: 'strava-refresh-token',
      athleteId: 42,
    });
    expect(adminMock.readDoc('stravaConnections/user-uid-123')).toMatchObject({
      connected: true,
      athleteName: 'Crash Runner',
    });
  });

  it('overwrites an already-connected account on duplicate callback', async () => {
    const mockFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.verifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    adminMock.seedDoc('stravaTokens/user-uid-123', {
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresAt: 1_700_000_000,
      athleteId: 7,
    });
    adminMock.seedDoc('stravaConnections/user-uid-123', {
      connected: true,
      athleteId: 7,
      athleteName: 'Old Runner',
    });
    mockFetch
      .mockResolvedValueOnce(
        createStravaTokenExchangeResponse({
          overrides: {
            access_token: 'replacement-access-token',
            refresh_token: 'replacement-refresh-token',
            athlete: { id: 88, firstname: 'Repeat', lastname: 'Runner' },
          },
        }),
      )
      .mockResolvedValueOnce(
        createStravaActivitiesResponse({
          activities: [
            createStravaActivity({ id: 101, name: 'Repeat Run' }),
            createStravaActivity({ id: 104, name: 'Treadmill', type: 'VirtualRun' }),
          ],
        }),
      );

    const response = await POST(createMockRequest({ code: 'auth-code-xyz' }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      athleteName: 'Repeat Runner',
      syncedCount: 2,
    });
    expect(response.status).toBe(200);
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toMatchObject({
      accessToken: 'replacement-access-token',
      refreshToken: 'replacement-refresh-token',
      athleteId: 88,
    });
    expect(adminMock.readDoc('stravaConnections/user-uid-123')).toMatchObject({
      connected: true,
      athleteId: 88,
      athleteName: 'Repeat Runner',
    });
    expect(adminMock.readDoc('stravaActivities/101')).toMatchObject({
      uid: 'user-uid-123',
      stravaId: 101,
      name: 'Repeat Run',
    });
    expect(adminMock.readDoc('stravaActivities/104')).toMatchObject({
      uid: 'user-uid-123',
      stravaId: 104,
      name: 'Treadmill',
    });
  });
});
