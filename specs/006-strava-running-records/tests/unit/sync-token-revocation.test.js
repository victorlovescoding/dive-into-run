/**
 * @file Unit tests for Strava token revocation edge case (T025).
 * @description
 * When ensureValidStravaToken returns an error (Strava revoked the token),
 * the sync route should return 401 with the error message.
 * The actual disconnection logic is now inside ensureValidStravaToken
 * (tested in firebase-admin-helpers.test.js).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Firestore chain ---
const mockGet = vi.fn();
const mockDocInstance = { get: mockGet };

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

import { verifyAuthToken, ensureValidStravaToken } from '@/lib/firebase-admin';

const mockedVerifyAuth = /** @type {import('vitest').Mock} */ (verifyAuthToken);
const mockedEnsureToken = /** @type {import('vitest').Mock} */ (ensureValidStravaToken);

import { POST } from '@/app/api/strava/sync/route';

// --- Helpers ---

/**
 * Creates a mock Firestore token document snapshot with an expired token.
 * @returns {{ exists: boolean, data: () => object }} Mock document snapshot.
 */
function createExpiredTokenDoc() {
  return {
    exists: true,
    data: () => ({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) - 100,
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
  });

  it('should return 401 when ensureValidStravaToken reports token refresh failure (401)', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-revoked-401');
    mockGet.mockResolvedValue(createExpiredTokenDoc());
    mockedEnsureToken.mockResolvedValue({ error: 'Token refresh failed' });

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Token refresh failed');
    expect(mockedEnsureToken).toHaveBeenCalledWith('uid-revoked-401');
  });

  it('should return 401 when ensureValidStravaToken reports token refresh failure (403)', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-revoked-403');
    mockGet.mockResolvedValue(createExpiredTokenDoc());
    mockedEnsureToken.mockResolvedValue({ error: 'Token refresh failed' });

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Token refresh failed');
    expect(mockedEnsureToken).toHaveBeenCalledWith('uid-revoked-403');
  });
});
