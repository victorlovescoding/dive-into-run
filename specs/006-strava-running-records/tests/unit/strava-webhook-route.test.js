import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedBuildStravaWebhookChallengeResponse,
  mockedHasMatchingStravaWebhookSubscription,
  mockedProcessWebhookEvent,
} = vi.hoisted(() => ({
  mockedBuildStravaWebhookChallengeResponse: vi.fn(),
  mockedHasMatchingStravaWebhookSubscription: vi.fn(),
  mockedProcessWebhookEvent: vi.fn(),
}));

vi.mock('@/runtime/server/use-cases/strava-server-use-cases', () => ({
  buildStravaWebhookChallengeResponse: mockedBuildStravaWebhookChallengeResponse,
  hasMatchingStravaWebhookSubscription: mockedHasMatchingStravaWebhookSubscription,
  processWebhookEvent: mockedProcessWebhookEvent,
}));

import { GET, POST } from '@/app/api/strava/webhook/route';

/**
 * Creates a mock Strava webhook event payload.
 * @param {object} [overrides] - Optional field overrides.
 * @returns {object} Mock webhook event.
 */
function createWebhookEvent(overrides = {}) {
  return {
    object_type: 'activity',
    object_id: 123456,
    aspect_type: 'create',
    updates: {},
    owner_id: 99999,
    subscription_id: 42,
    event_time: 1700000000,
    ...overrides,
  };
}

describe('GET /api/strava/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates the challenge response builder result', async () => {
    mockedBuildStravaWebhookChallengeResponse.mockReturnValue({
      status: 200,
      body: { 'hub.challenge': 'abc123' },
    });
    const request = new Request(
      'http://localhost/api/strava/webhook?hub.mode=subscribe&hub.challenge=abc123',
    );

    const response = GET(request);

    expect(mockedBuildStravaWebhookChallengeResponse).toHaveBeenCalledWith(request);
    await expect(response.json()).resolves.toEqual({ 'hub.challenge': 'abc123' });
    expect(response.status).toBe(200);
  });

  it('forwards challenge validation failures', async () => {
    mockedBuildStravaWebhookChallengeResponse.mockReturnValue({
      status: 403,
      body: { error: 'Forbidden' },
    });

    const response = GET(new Request('http://localhost/api/strava/webhook'));

    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(response.status).toBe(403);
  });
});

describe('POST /api/strava/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when subscription_id does not match', async () => {
    mockedHasMatchingStravaWebhookSubscription.mockReturnValue(false);
    const event = createWebhookEvent({ subscription_id: 999 });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(mockedHasMatchingStravaWebhookSubscription).toHaveBeenCalledWith(999);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid subscription' });
    expect(response.status).toBe(403);
    expect(mockedProcessWebhookEvent).not.toHaveBeenCalled();
  });

  it('fires and forgets valid webhook events', async () => {
    mockedHasMatchingStravaWebhookSubscription.mockReturnValue(true);
    mockedProcessWebhookEvent.mockResolvedValue(undefined);
    const event = createWebhookEvent();
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(mockedHasMatchingStravaWebhookSubscription).toHaveBeenCalledWith(42);
    expect(mockedProcessWebhookEvent).toHaveBeenCalledWith(event);
    expect(await response.text()).toBe('OK');
    expect(response.status).toBe(200);
  });

  it('still returns 200 when background processing rejects', async () => {
    mockedHasMatchingStravaWebhookSubscription.mockReturnValue(true);
    mockedProcessWebhookEvent.mockRejectedValue(new Error('background failure'));
    const event = createWebhookEvent({ object_id: 777 });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(mockedProcessWebhookEvent).toHaveBeenCalledWith(event);
    expect(await response.text()).toBe('OK');
    expect(response.status).toBe(200);
  });
});
