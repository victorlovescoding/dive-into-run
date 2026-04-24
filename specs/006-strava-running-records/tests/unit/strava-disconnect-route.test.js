import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedVerifyAuthToken, mockedDisconnectStravaAccount } = vi.hoisted(() => ({
  mockedVerifyAuthToken: vi.fn(),
  mockedDisconnectStravaAccount: vi.fn(),
}));

vi.mock('@/runtime/server/use-cases/strava-server-use-cases', () => ({
  verifyAuthToken: mockedVerifyAuthToken,
  disconnectStravaAccount: mockedDisconnectStravaAccount,
}));

import { POST } from '@/app/api/strava/disconnect/route';

/**
 * Creates a mock Request with Authorization header.
 * @returns {Request} Mock POST request.
 */
function createMockRequest() {
  return new Request('http://localhost/api/strava/disconnect', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
  });
}

describe('POST /api/strava/disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when auth token is invalid', async () => {
    mockedVerifyAuthToken.mockResolvedValue(null);

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
    expect(mockedDisconnectStravaAccount).not.toHaveBeenCalled();
  });

  it('delegates the authenticated uid to disconnectStravaAccount', async () => {
    mockedVerifyAuthToken.mockResolvedValue('uid-123');
    mockedDisconnectStravaAccount.mockResolvedValue({
      status: 200,
      body: { success: true },
    });

    const response = await POST(createMockRequest());

    expect(mockedDisconnectStravaAccount).toHaveBeenCalledWith('uid-123');
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.status).toBe(200);
  });

  it('forwards use-case failures', async () => {
    mockedVerifyAuthToken.mockResolvedValue('uid-123');
    mockedDisconnectStravaAccount.mockResolvedValue({
      status: 400,
      body: { error: 'Not connected to Strava' },
    });

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Not connected to Strava' });
    expect(response.status).toBe(400);
  });
});
