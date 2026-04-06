import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockBatchDelete = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockDocInstance = { delete: mockDelete };

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => mockDocInstance),
    })),
    batch: vi.fn(() => ({
      delete: mockBatchDelete,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    })),
  },
  getUidByAthleteId: vi.fn(),
  ensureValidStravaToken: vi.fn(),
  syncSingleStravaActivity: vi.fn(),
}));

import {
  getUidByAthleteId,
  ensureValidStravaToken,
  syncSingleStravaActivity,
  adminDb,
} from '@/lib/firebase-admin';

const mockedGetUid = /** @type {import('vitest').Mock} */ (getUidByAthleteId);
const mockedEnsureToken = /** @type {import('vitest').Mock} */ (ensureValidStravaToken);
const mockedSyncSingle = /** @type {import('vitest').Mock} */ (syncSingleStravaActivity);

import { GET, POST } from '@/app/api/strava/webhook/route';

// --- Helpers ---

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

describe('GET /api/strava/webhook (subscription validation)', () => {
  beforeEach(() => {
    vi.stubEnv('STRAVA_WEBHOOK_VERIFY_TOKEN', 'my-verify-token');
  });

  it('returns hub.challenge when verify_token matches', async () => {
    // Arrange
    const url =
      'http://localhost/api/strava/webhook?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=my-verify-token';
    const request = new Request(url);

    // Act
    const response = GET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({ 'hub.challenge': 'abc123' });
  });

  it('returns 403 when verify_token does not match', async () => {
    // Arrange
    const url =
      'http://localhost/api/strava/webhook?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=wrong-token';
    const request = new Request(url);

    // Act
    const response = GET(request);

    // Assert
    expect(response.status).toBe(403);
  });

  it('returns 403 when hub.mode is not subscribe', async () => {
    // Arrange
    const url =
      'http://localhost/api/strava/webhook?hub.mode=unsubscribe&hub.challenge=abc123&hub.verify_token=my-verify-token';
    const request = new Request(url);

    // Act
    const response = GET(request);

    // Assert
    expect(response.status).toBe(403);
  });

  it('returns 403 when hub.mode is missing', async () => {
    // Arrange
    const url =
      'http://localhost/api/strava/webhook?hub.challenge=abc123&hub.verify_token=my-verify-token';
    const request = new Request(url);

    // Act
    const response = GET(request);

    // Assert
    expect(response.status).toBe(403);
  });
});

describe('POST /api/strava/webhook (event processing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRAVA_WEBHOOK_SUBSCRIPTION_ID', '42');
  });

  it('returns 403 when subscription_id does not match', async () => {
    // Arrange
    const event = createWebhookEvent({ subscription_id: 999 });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(403);
  });

  it('returns 200 for valid event', async () => {
    // Arrange
    mockedGetUid.mockResolvedValue('uid-123');
    mockedEnsureToken.mockResolvedValue({ accessToken: 'token-abc' });
    mockedSyncSingle.mockResolvedValue(true);

    const event = createWebhookEvent();
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
  });

  it('calls syncSingleStravaActivity for activity create event', async () => {
    // Arrange
    mockedGetUid.mockResolvedValue('uid-123');
    mockedEnsureToken.mockResolvedValue({ accessToken: 'token-abc' });
    mockedSyncSingle.mockResolvedValue(true);

    const event = createWebhookEvent({ aspect_type: 'create', object_id: 555, owner_id: 88888 });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    await POST(request);
    // Allow fire-and-forget to settle
    await vi.waitFor(() => expect(mockedSyncSingle).toHaveBeenCalled());

    // Assert
    expect(mockedGetUid).toHaveBeenCalledWith(88888);
    expect(mockedEnsureToken).toHaveBeenCalledWith('uid-123');
    expect(mockedSyncSingle).toHaveBeenCalledWith({
      uid: 'uid-123',
      accessToken: 'token-abc',
      stravaActivityId: 555,
    });
  });

  it('calls syncSingleStravaActivity for activity update event', async () => {
    // Arrange
    mockedGetUid.mockResolvedValue('uid-456');
    mockedEnsureToken.mockResolvedValue({ accessToken: 'token-def' });
    mockedSyncSingle.mockResolvedValue(true);

    const event = createWebhookEvent({ aspect_type: 'update', object_id: 777 });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    await POST(request);
    await vi.waitFor(() => expect(mockedSyncSingle).toHaveBeenCalled());

    // Assert
    expect(mockedSyncSingle).toHaveBeenCalledWith(
      expect.objectContaining({ stravaActivityId: 777 }),
    );
  });

  it('deletes activity from Firestore for activity delete event', async () => {
    // Arrange
    const event = createWebhookEvent({ aspect_type: 'delete', object_id: 333 });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    await POST(request);
    await vi.waitFor(() => expect(mockDelete).toHaveBeenCalled());

    // Assert
    expect(adminDb.collection).toHaveBeenCalledWith('stravaActivities');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('handles athlete deauth by deleting token and marking disconnected', async () => {
    // Arrange
    mockedGetUid.mockResolvedValue('uid-deauth');

    const event = createWebhookEvent({
      object_type: 'athlete',
      aspect_type: 'update',
      owner_id: 77777,
      updates: { authorized: 'false' },
    });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    await POST(request);
    await vi.waitFor(() => expect(mockedGetUid).toHaveBeenCalled());

    // Assert
    expect(mockedGetUid).toHaveBeenCalledWith(77777);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('does not process unknown object_type', async () => {
    // Arrange
    const event = createWebhookEvent({ object_type: 'unknown' });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
    expect(mockedGetUid).not.toHaveBeenCalled();
    expect(mockedSyncSingle).not.toHaveBeenCalled();
  });

  it('silently handles when athlete not found for create event', async () => {
    // Arrange
    mockedGetUid.mockResolvedValue(null);

    const event = createWebhookEvent({ aspect_type: 'create' });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    const response = await POST(request);
    await vi.waitFor(() => expect(mockedGetUid).toHaveBeenCalled());

    // Assert
    expect(response.status).toBe(200);
    expect(mockedEnsureToken).not.toHaveBeenCalled();
  });

  it('silently handles when token refresh fails for create event', async () => {
    // Arrange
    mockedGetUid.mockResolvedValue('uid-123');
    mockedEnsureToken.mockResolvedValue({ error: 'Token refresh failed' });

    const event = createWebhookEvent({ aspect_type: 'create' });
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    const response = await POST(request);
    await vi.waitFor(() => expect(mockedEnsureToken).toHaveBeenCalled());

    // Assert
    expect(response.status).toBe(200);
    expect(mockedSyncSingle).not.toHaveBeenCalled();
  });
});
