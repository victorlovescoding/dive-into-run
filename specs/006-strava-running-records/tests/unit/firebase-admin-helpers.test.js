import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock firebase-admin module ---
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockQueryGet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockServerTimestamp = vi.fn(() => ({ _serverTimestamp: true }));
const mockTimestampFromDate = vi.fn((date) => ({ _date: date }));

/** @type {import('vitest').Mock} */
const mockDocRef = vi.fn(() => ({
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDeleteDoc,
  id: 'mock-ref',
}));

vi.mock('firebase-admin', () => {
  const firestoreFn = () => ({
    collection: vi.fn(() => ({
      doc: mockDocRef,
      where: mockWhere,
    })),
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
  });

  firestoreFn.FieldValue = { serverTimestamp: mockServerTimestamp };
  firestoreFn.Timestamp = { fromDate: mockTimestampFromDate };

  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      credential: { applicationDefault: vi.fn() },
      auth: () => ({ verifyIdToken: vi.fn() }),
      firestore: firestoreFn,
    },
  };
});

// Mock global fetch
vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

// --- Helpers ---

/**
 * Creates a mock Strava API activity.
 * @param {object} [overrides] - Fields to override.
 * @returns {object} Mock activity object.
 */
function createStravaActivity(overrides = {}) {
  return {
    id: 12345,
    name: 'Morning Run',
    type: 'Run',
    distance: 5200.5,
    moving_time: 1800,
    start_date: '2024-01-15T08:00:00Z',
    start_date_local: '2024-01-15T16:00:00',
    map: { summary_polyline: 'abc123polyline' },
    average_speed: 2.89,
    ...overrides,
  };
}

describe('mapStravaActivityToDoc', () => {
  it('maps Strava API fields to Firestore document shape', async () => {
    // Arrange
    const activity = createStravaActivity();

    // Act
    const { mapStravaActivityToDoc } = await import('@/lib/firebase-admin');
    const doc = mapStravaActivityToDoc('user-1', activity);

    // Assert
    expect(doc).toEqual({
      uid: 'user-1',
      stravaId: 12345,
      name: 'Morning Run',
      type: 'Run',
      distanceMeters: 5200.5,
      movingTimeSec: 1800,
      startDate: { _date: new Date('2024-01-15T08:00:00Z') },
      startDateLocal: '2024-01-15T16:00:00',
      summaryPolyline: 'abc123polyline',
      averageSpeed: 2.89,
      syncedAt: { _serverTimestamp: true },
    });
  });

  it('sets summaryPolyline to null when map is missing', async () => {
    // Arrange
    const activity = createStravaActivity({ map: undefined });

    // Act
    const { mapStravaActivityToDoc } = await import('@/lib/firebase-admin');
    const doc = mapStravaActivityToDoc('user-1', activity);

    // Assert
    expect(doc.summaryPolyline).toBeNull();
  });
});

describe('getUidByAthleteId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ get: mockQueryGet });
  });

  it('returns uid when athlete is found', async () => {
    // Arrange
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ id: 'uid-found-123' }],
    });

    // Act
    const { getUidByAthleteId } = await import('@/lib/firebase-admin');
    const uid = await getUidByAthleteId(99999);

    // Assert
    expect(uid).toBe('uid-found-123');
    expect(mockWhere).toHaveBeenCalledWith('athleteId', '==', 99999);
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('returns null when athlete is not found', async () => {
    // Arrange
    mockQueryGet.mockResolvedValue({ empty: true, docs: [] });

    // Act
    const { getUidByAthleteId } = await import('@/lib/firebase-admin');
    const uid = await getUidByAthleteId(11111);

    // Assert
    expect(uid).toBeNull();
  });
});

describe('ensureValidStravaToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRAVA_CLIENT_ID', 'test-client-id');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-client-secret');
  });

  it('returns accessToken when token is still valid', async () => {
    // Arrange
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ accessToken: 'valid-token', expiresAt: futureExpiry }),
    });

    // Act
    const { ensureValidStravaToken } = await import('@/lib/firebase-admin');
    const result = await ensureValidStravaToken('uid-123');

    // Assert
    expect(result).toEqual({ accessToken: 'valid-token' });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('refreshes token when expired and returns new accessToken', async () => {
    // Arrange
    const expiredAt = Math.floor(Date.now() / 1000) - 100;
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: expiredAt,
      }),
    });
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 7200,
      }),
    });

    // Act
    const { ensureValidStravaToken } = await import('@/lib/firebase-admin');
    const result = await ensureValidStravaToken('uid-123');

    // Assert
    expect(result).toEqual({ accessToken: 'new-token' });
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/oauth/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      }),
    );
  });

  it('returns error and marks disconnected when refresh fails', async () => {
    // Arrange
    const expiredAt = Math.floor(Date.now() / 1000) - 100;
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        accessToken: 'old-token',
        refreshToken: 'bad-refresh',
        expiresAt: expiredAt,
      }),
    });
    mockedFetch.mockResolvedValue({ ok: false, status: 400 });

    // Act
    const { ensureValidStravaToken } = await import('@/lib/firebase-admin');
    const result = await ensureValidStravaToken('uid-123');

    // Assert
    expect(result).toEqual({ error: 'Token refresh failed' });
    expect(mockUpdate).toHaveBeenCalledWith({ connected: false });
  });

  it('returns error when token doc does not exist', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });

    // Act
    const { ensureValidStravaToken } = await import('@/lib/firebase-admin');
    const result = await ensureValidStravaToken('uid-ghost');

    // Assert
    expect(result).toEqual({ error: 'Token not found' });
  });
});

describe('syncSingleStravaActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches single activity and writes to Firestore when type is Run', async () => {
    // Arrange
    const activity = createStravaActivity({ id: 555, type: 'Run' });
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => activity,
    });

    // Act
    const { syncSingleStravaActivity } = await import('@/lib/firebase-admin');
    const result = await syncSingleStravaActivity({
      uid: 'uid-123',
      accessToken: 'token-abc',
      stravaActivityId: 555,
    });

    // Assert
    expect(result).toBe(true);
    expect(mockedFetch).toHaveBeenCalledWith('https://www.strava.com/api/v3/activities/555', {
      headers: { Authorization: 'Bearer token-abc' },
    });
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'uid-123', stravaId: 555 }),
      { merge: true },
    );
  });

  it('returns false and does not write when type is not allowed', async () => {
    // Arrange
    const activity = createStravaActivity({ id: 666, type: 'Ride' });
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => activity,
    });

    // Act
    const { syncSingleStravaActivity } = await import('@/lib/firebase-admin');
    const result = await syncSingleStravaActivity({
      uid: 'uid-123',
      accessToken: 'token-abc',
      stravaActivityId: 666,
    });

    // Assert
    expect(result).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('deletes Firestore doc and returns false when Strava returns 404', async () => {
    // Arrange
    mockedFetch.mockResolvedValue({ ok: false, status: 404 });

    // Act
    const { syncSingleStravaActivity } = await import('@/lib/firebase-admin');
    const result = await syncSingleStravaActivity({
      uid: 'uid-123',
      accessToken: 'token-abc',
      stravaActivityId: 999,
    });

    // Assert
    expect(result).toBe(false);
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('throws when Strava returns non-404 error', async () => {
    // Arrange
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    // Act & Assert
    const { syncSingleStravaActivity } = await import('@/lib/firebase-admin');
    await expect(
      syncSingleStravaActivity({
        uid: 'uid-123',
        accessToken: 'token-abc',
        stravaActivityId: 888,
      }),
    ).rejects.toThrow('Strava API error: 500 Internal Server Error');
  });
});
