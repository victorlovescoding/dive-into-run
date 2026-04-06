/**
 * @file Unit tests for Strava token revocation edge case (T025).
 * @description
 * When token refresh fails with 401/403 (Strava revoked the token),
 * the sync route should update stravaConnections/{uid} to { connected: false }
 * before returning the error response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Firestore chain per collection ---
const mockTokensDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockTokensDocGet = vi.fn();
const mockTokensDocInstance = { get: mockTokensDocGet, update: mockTokensDocUpdate };

const mockConnectionsDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockConnectionsDocInstance = { update: mockConnectionsDocUpdate };

vi.mock('@/lib/firebase-admin', () => ({
  verifyAuthToken: vi.fn(),
  adminDb: {
    collection: vi.fn((/** @type {string} */ name) => {
      if (name === 'stravaTokens') {
        return { doc: vi.fn(() => mockTokensDocInstance) };
      }
      if (name === 'stravaConnections') {
        return { doc: vi.fn(() => mockConnectionsDocInstance) };
      }
      return { doc: vi.fn(() => ({ get: vi.fn(), update: vi.fn() })) };
    }),
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

import { verifyAuthToken } from '@/lib/firebase-admin';

const mockedVerifyAuth = /** @type {import('vitest').Mock} */ (verifyAuthToken);

vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

import { POST } from '@/app/api/strava/sync/route';

// --- Helpers ---

/**
 * Creates a mock Firestore token document snapshot with an expired token.
 * @param {object} [overrides] - Optional field overrides.
 * @param {string} [overrides.accessToken] - Strava access token.
 * @param {string} [overrides.refreshToken] - Strava refresh token.
 * @param {number} [overrides.expiresAt] - Token expiry epoch seconds (defaults to expired).
 * @returns {{ exists: boolean, data: () => object }} Mock document snapshot.
 */
function createExpiredTokenDoc({
  accessToken = 'access-token',
  refreshToken = 'refresh-token',
  expiresAt = Math.floor(Date.now() / 1000) - 100,
} = {}) {
  return {
    exists: true,
    data: () => ({
      accessToken,
      refreshToken,
      expiresAt,
      athleteId: 12345,
      lastSyncAt: null,
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

describe('POST /api/strava/sync — token revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRAVA_CLIENT_ID', 'test-client-id');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-client-secret');
  });

  it('should set stravaConnections to disconnected when token refresh returns 401', async () => {
    // Arrange
    const uid = 'uid-revoked-401';
    mockedVerifyAuth.mockResolvedValue(uid);
    mockTokensDocGet.mockResolvedValue(createExpiredTokenDoc());
    mockedFetch.mockResolvedValue({ ok: false, status: 401 });

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert — stravaConnections must be marked disconnected
    expect(mockConnectionsDocUpdate).toHaveBeenCalledWith({ connected: false });
    expect(response.status).toBe(401);
    expect(body.error).toBe('Token refresh failed');
  });

  it('should set stravaConnections to disconnected when token refresh returns 403', async () => {
    // Arrange
    const uid = 'uid-revoked-403';
    mockedVerifyAuth.mockResolvedValue(uid);
    mockTokensDocGet.mockResolvedValue(createExpiredTokenDoc());
    mockedFetch.mockResolvedValue({ ok: false, status: 403 });

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert — stravaConnections must be marked disconnected
    expect(mockConnectionsDocUpdate).toHaveBeenCalledWith({ connected: false });
    expect(response.status).toBe(401);
    expect(body.error).toBe('Token refresh failed');
  });
});
