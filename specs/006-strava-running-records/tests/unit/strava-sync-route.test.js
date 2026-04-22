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

describe('POST /api/strava/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when auth token is invalid', async () => {
    mockedVerifyAuthToken.mockResolvedValue(null);

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
    expect(mockedSyncStravaAccount).not.toHaveBeenCalled();
  });

  it('delegates the authenticated uid to syncStravaAccount', async () => {
    mockedVerifyAuthToken.mockResolvedValue('uid-123');
    mockedSyncStravaAccount.mockResolvedValue({
      status: 200,
      body: { success: true, count: 7 },
    });

    const response = await POST(createMockRequest());

    expect(mockedSyncStravaAccount).toHaveBeenCalledWith('uid-123');
    await expect(response.json()).resolves.toEqual({ success: true, count: 7 });
    expect(response.status).toBe(200);
  });

  it('forwards non-200 use-case responses', async () => {
    mockedVerifyAuthToken.mockResolvedValue('uid-123');
    mockedSyncStravaAccount.mockResolvedValue({
      status: 429,
      body: { error: 'Sync cooldown active', retryAfter: 120 },
    });

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'Sync cooldown active',
      retryAfter: 120,
    });
    expect(response.status).toBe(429);
  });
});
