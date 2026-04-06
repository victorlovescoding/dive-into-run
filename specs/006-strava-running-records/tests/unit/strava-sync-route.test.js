import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocInstance = { get: mockGet, update: mockUpdate };

vi.mock('@/lib/firebase-admin', () => ({
  verifyAuthToken: vi.fn(),
  ensureValidStravaToken: vi.fn(),
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

import {
  verifyAuthToken,
  ensureValidStravaToken,
  syncStravaActivities,
} from '@/lib/firebase-admin';

const mockedVerifyAuth = /** @type {import('vitest').Mock} */ (verifyAuthToken);
const mockedEnsureToken = /** @type {import('vitest').Mock} */ (ensureValidStravaToken);
const mockedSync = /** @type {import('vitest').Mock} */ (syncStravaActivities);

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
    const twoMinAgo = Date.now() - 2 * 60 * 1000;
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: twoMinAgo }));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(429);
    expect(body.error).toBe('Sync cooldown active');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(body.retryAfter).toBeLessThanOrEqual(300);
  });

  it('skips cooldown when lastSyncAt is null (first sync)', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: null }));
    mockedEnsureToken.mockResolvedValue({ accessToken: 'access-token' });
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
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: tenMinAgo }));
    mockedEnsureToken.mockResolvedValue({ accessToken: 'access-token' });
    mockedSync.mockResolvedValue(3);

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('delegates token management to ensureValidStravaToken', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockTokenDoc());
    mockedEnsureToken.mockResolvedValue({ accessToken: 'refreshed-token' });
    mockedSync.mockResolvedValue(2);

    // Act
    await POST(createMockRequest());

    // Assert
    expect(mockedEnsureToken).toHaveBeenCalledWith('uid-123');
    expect(mockedSync).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'refreshed-token' }),
    );
  });

  it('returns 401 when ensureValidStravaToken returns error', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockTokenDoc());
    mockedEnsureToken.mockResolvedValue({ error: 'Token refresh failed' });

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
    const tenMinAgoMs = Date.now() - 10 * 60 * 1000;
    const expectedEpoch = Math.floor(tenMinAgoMs / 1000);
    mockGet.mockResolvedValue(createMockTokenDoc({ lastSyncAt: tenMinAgoMs }));
    mockedEnsureToken.mockResolvedValue({ accessToken: 'access-token' });
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
    mockedEnsureToken.mockResolvedValue({ accessToken: 'access-token' });
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
    mockedEnsureToken.mockResolvedValue({ accessToken: 'access-token' });
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
    mockedEnsureToken.mockResolvedValue({ accessToken: 'access-token' });
    mockedSync.mockRejectedValue(new Error('Strava API error'));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(body.error).toBe('Sync failed');
  });
});
