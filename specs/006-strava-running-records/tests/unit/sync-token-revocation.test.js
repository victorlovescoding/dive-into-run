/**
 * @file Unit tests for Strava token revocation edge case (T025).
 * @description
 * The sync route is now a thin entry that delegates token refresh failures to
 * the runtime use-case layer. This suite keeps the route-level contract test:
 * a 401 use-case result must be forwarded unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedVerifyAuthToken, mockedSyncStravaAccount } = vi.hoisted(() => ({
  mockedVerifyAuthToken: vi.fn(),
  mockedSyncStravaAccount: vi.fn(),
}));

vi.mock('@/runtime/server/use-cases/strava-server-use-cases', () => ({
  verifyAuthToken: mockedVerifyAuthToken,
  syncStravaAccount: mockedSyncStravaAccount,
}));

import { POST } from '@/app/api/strava/sync/route';

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

  it('forwards a 401 token refresh failure from syncStravaAccount', async () => {
    mockedVerifyAuthToken.mockResolvedValue('uid-revoked-401');
    mockedSyncStravaAccount.mockResolvedValue({
      status: 401,
      body: { error: 'Token refresh failed' },
    });

    const response = await POST(createMockRequest());

    expect(mockedSyncStravaAccount).toHaveBeenCalledWith('uid-revoked-401');
    await expect(response.json()).resolves.toEqual({ error: 'Token refresh failed' });
    expect(response.status).toBe(401);
  });
});
