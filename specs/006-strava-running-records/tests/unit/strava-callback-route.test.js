import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock firebase-admin module ---
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDocRef = { set: mockSet };

vi.mock('@/lib/firebase-admin', () => ({
  verifyAuthToken: vi.fn(),
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => mockDocRef),
    })),
  },
  syncStravaActivities: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
      },
    },
  },
}));

import { verifyAuthToken, syncStravaActivities } from '@/lib/firebase-admin';

const mockedVerifyAuth = /** @type {import('vitest').Mock} */ (verifyAuthToken);
const mockedSync = /** @type {import('vitest').Mock} */ (syncStravaActivities);

// Mock global fetch for Strava token exchange
vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

// --- Helper ---

/**
 * Creates a mock POST request for the Strava callback endpoint.
 * @param {{ body?: Record<string, unknown>, token?: string }} options - Request options.
 * @returns {Request} Mock request object.
 */
function createMockRequest({ body = {}, token = 'valid-token' } = {}) {
  return new Request('http://localhost:3000/api/strava/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Creates a mock Strava token exchange response.
 * @returns {{ ok: true, json: () => Promise<Record<string, unknown>> }} Successful Strava response.
 */
function createStravaTokenResponse() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        access_token: 'strava-access-token',
        refresh_token: 'strava-refresh-token',
        expires_at: 1700000000,
        athlete: {
          id: 12345,
          firstname: 'John',
          lastname: 'Doe',
        },
      }),
  };
}

describe('POST /api/strava/callback', () => {
  /** @type {typeof import('@/app/api/strava/callback/route').POST} */
  let POST;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    vi.stubEnv('STRAVA_CLIENT_ID', 'test-client-id');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-client-secret');

    // Default: auth succeeds
    mockedVerifyAuth.mockResolvedValue('user-uid-123');

    // Default: Strava token exchange succeeds
    mockedFetch.mockResolvedValue(createStravaTokenResponse());

    // Default: sync succeeds
    mockedSync.mockResolvedValue(5);

    // Re-import to get fresh module per test
    const mod = await import('@/app/api/strava/callback/route');
    POST = mod.POST;
  });

  it('returns 401 when auth token is invalid', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue(null);
    const request = createMockRequest();

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when code is missing from body', async () => {
    // Arrange
    const request = createMockRequest({ body: {} });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing authorization code');
  });

  it('exchanges code with Strava API using correct params', async () => {
    // Arrange
    const request = createMockRequest({ body: { code: 'auth-code-xyz' } });

    // Act
    await POST(request);

    // Assert
    expect(mockedFetch).toHaveBeenCalledWith('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'auth-code-xyz',
        grant_type: 'authorization_code',
      }),
    });
  });

  it('returns 400 when Strava token exchange fails', async () => {
    // Arrange
    mockedFetch.mockResolvedValue({ ok: false, status: 401 });
    const request = createMockRequest({ body: { code: 'bad-code' } });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid authorization code');
  });

  it('writes stravaTokens and stravaConnections to Firestore without lastSyncAt', async () => {
    // Arrange
    const request = createMockRequest({ body: { code: 'auth-code-xyz' } });
    const { adminDb } = await import('@/lib/firebase-admin');
    const mockedCollection = /** @type {import('vitest').Mock} */ (adminDb.collection);

    // Act
    await POST(request);

    // Assert — stravaTokens write
    const tokenCalls = mockedCollection.mock.calls.filter(
      (/** @type {string[]} */ c) => c[0] === 'stravaTokens',
    );
    expect(tokenCalls).toHaveLength(1);

    const tokenData = mockSet.mock.calls[0][0];
    expect(tokenData).toEqual(
      expect.objectContaining({
        accessToken: 'strava-access-token',
        refreshToken: 'strava-refresh-token',
        expiresAt: 1700000000,
        athleteId: 12345,
        connectedAt: { _serverTimestamp: true },
      }),
    );
    expect(tokenData).not.toHaveProperty('lastSyncAt');

    // Assert — stravaConnections write
    const connectionCalls = mockedCollection.mock.calls.filter(
      (/** @type {string[]} */ c) => c[0] === 'stravaConnections',
    );
    expect(connectionCalls).toHaveLength(1);

    const connectionData = mockSet.mock.calls[1][0];
    expect(connectionData).toEqual(
      expect.objectContaining({
        connected: true,
        athleteId: 12345,
        athleteName: 'John Doe',
        connectedAt: { _serverTimestamp: true },
      }),
    );
    expect(connectionData).not.toHaveProperty('lastSyncAt');
  });

  it('triggers syncStravaActivities after successful connection', async () => {
    // Arrange
    const request = createMockRequest({ body: { code: 'auth-code-xyz' } });

    // Act
    await POST(request);

    // Assert
    expect(mockedSync).toHaveBeenCalledOnce();
    const syncArgs = mockedSync.mock.calls[0][0];
    expect(syncArgs.uid).toBe('user-uid-123');
    expect(syncArgs.accessToken).toBe('strava-access-token');
    expect(syncArgs.afterEpoch).toBeTypeOf('number');

    // afterEpoch should be ~60 days ago (within a small tolerance)
    const expectedEpoch = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;
    expect(Math.abs(syncArgs.afterEpoch - expectedEpoch)).toBeLessThan(5);
  });

  it('returns success with athleteName and syncedCount', async () => {
    // Arrange
    mockedSync.mockResolvedValue(12);
    const request = createMockRequest({ body: { code: 'auth-code-xyz' } });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      athleteName: 'John Doe',
      syncedCount: 12,
    });
  });

  it('returns success with syncedCount=0 when sync fails gracefully', async () => {
    // Arrange
    mockedSync.mockRejectedValue(new Error('Strava API down'));
    const request = createMockRequest({ body: { code: 'auth-code-xyz' } });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      athleteName: 'John Doe',
      syncedCount: 0,
    });
  });
});
