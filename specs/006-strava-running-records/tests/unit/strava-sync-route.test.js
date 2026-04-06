import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocInstance = { get: mockGet, update: mockUpdate };

vi.mock('@/lib/firebase-admin', () => ({
  verifyAuthToken: vi.fn(),
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => mockDocInstance),
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

vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

import { POST } from '@/app/api/strava/sync/route';

// --- Helpers ---

/**
 * Creates a mock Firestore token document snapshot.
 * @param {object} [overrides] - Optional field overrides.
 * @param {string} [overrides.accessToken] - Strava access token.
 * @param {string} [overrides.refreshToken] - Strava refresh token.
 * @param {number} [overrides.expiresAt] - Token expiry epoch seconds.
 * @param {number} [overrides.athleteId] - Strava athlete ID.
 * @param {number|null} [overrides.lastSyncAt] - Last sync timestamp ms, or null for first sync.
 * @returns {{ exists: boolean, data: () => object }} Mock document snapshot.
 */
function createMockTokenDoc({
  accessToken = 'access-token',
  refreshToken = 'refresh-token',
  expiresAt = Math.floor(Date.now() / 1000) + 3600,
  athleteId = 12345,
  lastSyncAt = null,
} = {}) {
  return {
    exists: true,
    data: () => ({
      accessToken,
      refreshToken,
      expiresAt,
      athleteId,
      lastSyncAt: lastSyncAt ? { toDate: () => new Date(lastSyncAt) } : null,
    }),
  };
}

/**
 * Creates a mock Request with Authorization header.
 * @returns {Request} Mock POST request.
 */
function createMockRequest() {
  return new Request('http://localhost/api/strava/sync', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
  });
}

describe('POST /api/strava/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRAVA_CLIENT_ID', 'test-client-id');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-client-secret');
  });

  it('returns 401 when auth token is invalid', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue(null);

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 429 when cooldown is active', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: thirtyMinAgo }));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(429);
    expect(body.error).toBe('Sync cooldown active');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(body.retryAfter).toBeLessThanOrEqual(1800);
  });

  it('skips cooldown when lastSyncAt is null (first sync)', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: null }));
    mockedSync.mockResolvedValue(5);

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('allows sync after cooldown period', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: twoHoursAgo }));
    mockedSync.mockResolvedValue(3);

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('skips token refresh when token is still valid', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    const validExpiry = Math.floor(Date.now() / 1000) + 3600;
    mockGet.mockResolvedValue(createMockTokenDoc({ expiresAt: validExpiry }));
    mockedSync.mockResolvedValue(2);

    // Act
    await POST(createMockRequest());

    // Assert
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('refreshes token when expired and updates Firestore', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    const expiredAt = Math.floor(Date.now() / 1000) - 100;
    mockGet.mockResolvedValue(
      createMockTokenDoc({
        expiresAt: expiredAt,
        refreshToken: 'old-refresh',
      }),
    );
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 7200,
      }),
    });
    mockedSync.mockResolvedValue(1);

    // Act
    const response = await POST(createMockRequest());

    // Assert
    expect(response.status).toBe(200);
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      }),
    );
    // syncStravaActivities should receive the new access token
    expect(mockedSync).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'new-access',
      }),
    );
  });

  it('returns 401 when token refresh fails', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    const expiredAt = Math.floor(Date.now() / 1000) - 100;
    mockGet.mockResolvedValue(createMockTokenDoc({ expiresAt: expiredAt }));
    mockedFetch.mockResolvedValue({ ok: false, status: 400 });

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Token refresh failed');
  });

  it('calls syncStravaActivities with correct params using lastSyncAt as afterEpoch', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    const twoHoursAgoMs = Date.now() - 2 * 60 * 60 * 1000;
    const expectedEpoch = Math.floor(twoHoursAgoMs / 1000);
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: twoHoursAgoMs }));
    mockedSync.mockResolvedValue(4);

    // Act
    await POST(createMockRequest());

    // Assert
    expect(mockedSync).toHaveBeenCalledWith({
      uid: 'uid-123',
      accessToken: 'access-token',
      afterEpoch: expectedEpoch,
    });
  });

  it('uses twoMonthsAgo as afterEpoch when lastSyncAt is null', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: null }));
    mockedSync.mockResolvedValue(10);
    const twoMonthsAgo = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;

    // Act
    await POST(createMockRequest());

    // Assert
    const callArgs = mockedSync.mock.calls[0][0];
    expect(callArgs.uid).toBe('uid-123');
    expect(callArgs.accessToken).toBe('access-token');
    // Allow 2 second tolerance for timing
    expect(callArgs.afterEpoch).toBeGreaterThanOrEqual(twoMonthsAgo - 2);
    expect(callArgs.afterEpoch).toBeLessThanOrEqual(twoMonthsAgo + 2);
  });

  it('returns success with count', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockTokenDoc());
    mockedSync.mockResolvedValue(7);

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, count: 7 });
  });

  it('returns 500 when sync fails', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockTokenDoc());
    mockedSync.mockRejectedValue(new Error('Strava API error'));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(body.error).toBe('Sync failed');
  });
});
