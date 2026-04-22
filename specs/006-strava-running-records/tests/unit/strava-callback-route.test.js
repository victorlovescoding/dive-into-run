import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedVerifyAuthToken, mockedConnectStravaAccount } = vi.hoisted(() => ({
  mockedVerifyAuthToken: vi.fn(),
  mockedConnectStravaAccount: vi.fn(),
}));

vi.mock('@/runtime/server/use-cases/strava-server-use-cases', () => ({
  verifyAuthToken: mockedVerifyAuthToken,
  connectStravaAccount: mockedConnectStravaAccount,
}));

import { POST } from '@/app/api/strava/callback/route';

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

describe('POST /api/strava/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when auth token is invalid', async () => {
    mockedVerifyAuthToken.mockResolvedValue(null);

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
    expect(mockedConnectStravaAccount).not.toHaveBeenCalled();
  });

  it('returns 400 when code is missing from body', async () => {
    mockedVerifyAuthToken.mockResolvedValue('user-uid-123');

    const response = await POST(createMockRequest({ body: {} }));

    await expect(response.json()).resolves.toEqual({ error: 'Missing authorization code' });
    expect(response.status).toBe(400);
    expect(mockedConnectStravaAccount).not.toHaveBeenCalled();
  });

  it('delegates uid and code to connectStravaAccount', async () => {
    mockedVerifyAuthToken.mockResolvedValue('user-uid-123');
    mockedConnectStravaAccount.mockResolvedValue({
      status: 200,
      body: {
        success: true,
        athleteName: 'John Doe',
        syncedCount: 12,
      },
    });

    const response = await POST(createMockRequest({ body: { code: 'auth-code-xyz' } }));

    expect(mockedConnectStravaAccount).toHaveBeenCalledWith({
      uid: 'user-uid-123',
      code: 'auth-code-xyz',
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      athleteName: 'John Doe',
      syncedCount: 12,
    });
    expect(response.status).toBe(200);
  });

  it('forwards use-case failures', async () => {
    mockedVerifyAuthToken.mockResolvedValue('user-uid-123');
    mockedConnectStravaAccount.mockResolvedValue({
      status: 400,
      body: { error: 'Invalid authorization code' },
    });

    const response = await POST(createMockRequest({ body: { code: 'bad-code' } }));

    await expect(response.json()).resolves.toEqual({ error: 'Invalid authorization code' });
    expect(response.status).toBe(400);
  });
});
