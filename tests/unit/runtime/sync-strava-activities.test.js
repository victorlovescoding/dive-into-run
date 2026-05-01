import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock firebase-admin module ---
const mockVerifyIdToken = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
/** @type {import('vitest').Mock<(path: string, id: string) => { path: string, id: string }>} */
const mockDocRef = vi.fn((path, id) => ({ path, id }));
const mockServerTimestamp = vi.fn(() => ({ _serverTimestamp: true }));
const mockTimestampFromDate = vi.fn((date) => ({ _date: date }));

vi.mock('firebase-admin', () => {
  const firestoreFn = () => ({
    collection: vi.fn((path) => ({
      doc: (id) => mockDocRef(path, id),
    })),
    batch: () => ({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
  });

  firestoreFn.FieldValue = {
    serverTimestamp: mockServerTimestamp,
  };
  firestoreFn.Timestamp = {
    fromDate: mockTimestampFromDate,
  };

  const mockApp = {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
    firestore: firestoreFn,
  };

  return {
    default: {
      apps: [],
      initializeApp: vi.fn(() => mockApp),
      credential: {
        cert: vi.fn(),
        applicationDefault: vi.fn(),
      },
      auth: () => ({ verifyIdToken: mockVerifyIdToken }),
      firestore: firestoreFn,
    },
  };
});

// Mock global fetch for Strava API
vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

/**
 * Imports the split S003 runtime module exports used by this suite.
 * @returns {Promise<{
 *   verifyAuthToken: typeof import('@/runtime/server/use-cases/strava-server-use-cases').verifyAuthToken,
 *   syncStravaActivities: typeof import('@/runtime/server/use-cases/strava-server-use-cases').syncStravaActivities,
 * }>} Runtime exports under test.
 */
async function importStravaRuntimeModules() {
  const runtime = await import('@/runtime/server/use-cases/strava-server-use-cases');

  return {
    verifyAuthToken: runtime.verifyAuthToken,
    syncStravaActivities: runtime.syncStravaActivities,
  };
}

// --- Factory helpers ---

/**
 * @typedef {object} StravaActivity
 * @property {number} id - Strava activity ID.
 * @property {string} name - Activity name.
 * @property {string} type - Activity type.
 * @property {number} distance - Distance in meters.
 * @property {number} moving_time - Moving time in seconds.
 * @property {string} start_date - ISO date string.
 * @property {string} start_date_local - Local ISO date string.
 * @property {{ summary_polyline: string | null }} map - Map data.
 * @property {number} average_speed - Average speed in m/s.
 */

/**
 * Creates a mock Strava API activity.
 * @param {Partial<StravaActivity>} overrides - Fields to override.
 * @returns {StravaActivity} Mock activity object.
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

/**
 * Reads Firestore batch set calls as persisted document IDs and payloads.
 * @returns {{ docRef: { path: string, id: string }, payload: object, options: object }[]} Batch set records.
 */
function getBatchSetRecords() {
  return mockBatchSet.mock.calls.map(([docRef, payload, options]) => ({
    docRef,
    payload,
    options,
  }));
}

/**
 * Reads Firestore batch update calls as target document refs and payloads.
 * @returns {{ docRef: { path: string, id: string }, payload: object }[]} Batch update records.
 */
function getBatchUpdateRecords() {
  return mockBatchUpdate.mock.calls.map(([docRef, payload]) => ({
    docRef,
    payload,
  }));
}

describe('verifyAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts Bearer token and returns decoded uid', async () => {
    // Arrange
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-123' });
    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer valid-token-abc' },
    });

    // Act
    const { verifyAuthToken } = await importStravaRuntimeModules();
    const uid = await verifyAuthToken(request);

    // Assert
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token-abc');
    expect(uid).toBe('user-123');
  });

  it('returns null when no Authorization header', async () => {
    // Arrange
    const request = new Request('http://localhost/api/test');

    // Act
    const { verifyAuthToken } = await importStravaRuntimeModules();
    const uid = await verifyAuthToken(request);

    // Assert
    expect(uid).toBeNull();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('returns null when Authorization header has no Bearer prefix', async () => {
    // Arrange
    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Basic some-token' },
    });

    // Act
    const { verifyAuthToken } = await importStravaRuntimeModules();
    const uid = await verifyAuthToken(request);

    // Assert
    expect(uid).toBeNull();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('returns null when token verification fails', async () => {
    // Arrange
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    // Act
    const { verifyAuthToken } = await importStravaRuntimeModules();
    const uid = await verifyAuthToken(request);

    // Assert
    expect(uid).toBeNull();
  });
});

describe('syncStravaActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches Strava API with correct URL and Bearer token', async () => {
    // Arrange
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    await syncStravaActivities({
      uid: 'user-1',
      accessToken: 'strava-token-xyz',
      afterEpoch: 1700000000,
    });

    // Assert
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/athlete/activities?after=1700000000&per_page=100&page=1',
      {
        headers: { Authorization: 'Bearer strava-token-xyz' },
      },
    );
  });

  it('filters activities to only Run/TrailRun/VirtualRun types', async () => {
    // Arrange
    const activities = [
      createStravaActivity({ id: 1, type: 'Run' }),
      createStravaActivity({ id: 2, type: 'Ride' }),
      createStravaActivity({ id: 3, type: 'TrailRun' }),
      createStravaActivity({ id: 4, type: 'Swim' }),
      createStravaActivity({ id: 5, type: 'VirtualRun' }),
      createStravaActivity({ id: 6, type: 'Walk' }),
    ];
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(activities),
    });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    const count = await syncStravaActivities({
      uid: 'user-1',
      accessToken: 'token',
      afterEpoch: 0,
    });

    // Assert
    expect(count).toBe(3);
    expect(getBatchSetRecords()).toEqual([
      expect.objectContaining({
        docRef: { path: 'stravaActivities', id: '1' },
        payload: expect.objectContaining({ stravaId: 1, type: 'Run' }),
        options: { merge: true },
      }),
      expect.objectContaining({
        docRef: { path: 'stravaActivities', id: '3' },
        payload: expect.objectContaining({ stravaId: 3, type: 'TrailRun' }),
        options: { merge: true },
      }),
      expect.objectContaining({
        docRef: { path: 'stravaActivities', id: '5' },
        payload: expect.objectContaining({ stravaId: 5, type: 'VirtualRun' }),
        options: { merge: true },
      }),
    ]);
  });

  it('batch writes correct field mapping to stravaActivities/{stravaId}', async () => {
    // Arrange
    const activity = createStravaActivity({
      id: 99999,
      name: 'Evening Run',
      type: 'Run',
      distance: 10500.3,
      moving_time: 3600,
      start_date: '2024-03-10T06:30:00Z',
      start_date_local: '2024-03-10T14:30:00',
      map: { summary_polyline: 'encoded-poly' },
      average_speed: 2.92,
    });
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([activity]),
    });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    await syncStravaActivities({
      uid: 'user-abc',
      accessToken: 'token',
      afterEpoch: 0,
    });

    // Assert
    expect(mockDocRef).toHaveBeenCalledWith('stravaActivities', '99999');
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      {
        uid: 'user-abc',
        stravaId: 99999,
        name: 'Evening Run',
        type: 'Run',
        distanceMeters: 10500.3,
        movingTimeSec: 3600,
        startDate: { _date: new Date('2024-03-10T06:30:00Z') },
        startDateLocal: '2024-03-10T14:30:00',
        summaryPolyline: 'encoded-poly',
        averageSpeed: 2.92,
        syncedAt: { _serverTimestamp: true },
      },
      { merge: true },
    );
  });

  it('sets summaryPolyline to null when map.summary_polyline is missing', async () => {
    // Arrange
    const activity = createStravaActivity({ id: 777, map: { summary_polyline: null } });
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([activity]),
    });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    await syncStravaActivities({
      uid: 'user-1',
      accessToken: 'token',
      afterEpoch: 0,
    });

    // Assert
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ summaryPolyline: null }),
      { merge: true },
    );
  });

  it('updates lastSyncAt on both stravaTokens and stravaConnections in final batch', async () => {
    // Arrange
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([createStravaActivity({ id: 1 })]),
    });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    await syncStravaActivities({
      uid: 'user-sync',
      accessToken: 'token',
      afterEpoch: 0,
    });

    // Assert
    expect(mockDocRef).toHaveBeenCalledWith('stravaTokens', 'user-sync');
    expect(mockDocRef).toHaveBeenCalledWith('stravaConnections', 'user-sync');
    expect(getBatchUpdateRecords()).toEqual([
      {
        docRef: { path: 'stravaTokens', id: 'user-sync' },
        payload: { lastSyncAt: { _serverTimestamp: true } },
      },
      {
        docRef: { path: 'stravaConnections', id: 'user-sync' },
        payload: { lastSyncAt: { _serverTimestamp: true } },
      },
    ]);
  });

  it('returns correct synced count', async () => {
    // Arrange
    const activities = [
      createStravaActivity({ id: 1, type: 'Run' }),
      createStravaActivity({ id: 2, type: 'TrailRun' }),
      createStravaActivity({ id: 3, type: 'VirtualRun' }),
    ];
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(activities),
    });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    const count = await syncStravaActivities({
      uid: 'user-1',
      accessToken: 'token',
      afterEpoch: 0,
    });

    // Assert
    expect(count).toBe(3);
  });

  it('throws when Strava API returns non-ok response', async () => {
    // Arrange
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    // Act & Assert
    const { syncStravaActivities } = await importStravaRuntimeModules();
    await expect(
      syncStravaActivities({
        uid: 'user-1',
        accessToken: 'bad-token',
        afterEpoch: 0,
      }),
    ).rejects.toThrow();
  });

  it('paginates when first page returns per_page results', async () => {
    // Arrange — page 1: 100 activities (full page), page 2: 1 activity (partial)
    const page1 = Array.from({ length: 100 }, (_, i) =>
      createStravaActivity({ id: i + 1, type: 'Run' }),
    );
    const page2 = [createStravaActivity({ id: 201, type: 'Run' })];

    mockedFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page1) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page2) });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    const count = await syncStravaActivities({
      uid: 'user-paginate',
      accessToken: 'token',
      afterEpoch: 0,
    });

    // Assert
    expect(count).toBe(101);
    expect(mockedFetch).toHaveBeenNthCalledWith(
      1,
      'https://www.strava.com/api/v3/athlete/activities?after=0&per_page=100&page=1',
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(mockedFetch).toHaveBeenNthCalledWith(
      2,
      'https://www.strava.com/api/v3/athlete/activities?after=0&per_page=100&page=2',
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(getBatchSetRecords()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        docRef: { path: 'stravaActivities', id: '1' },
        payload: expect.objectContaining({ stravaId: 1 }),
        options: { merge: true },
      }),
      expect.objectContaining({
        docRef: { path: 'stravaActivities', id: '100' },
        payload: expect.objectContaining({ stravaId: 100 }),
        options: { merge: true },
      }),
      expect.objectContaining({
        docRef: { path: 'stravaActivities', id: '201' },
        payload: expect.objectContaining({ stravaId: 201 }),
        options: { merge: true },
      }),
    ]));
    expect(getBatchUpdateRecords()).toEqual([
      {
        docRef: { path: 'stravaTokens', id: 'user-paginate' },
        payload: { lastSyncAt: { _serverTimestamp: true } },
      },
      {
        docRef: { path: 'stravaConnections', id: 'user-paginate' },
        payload: { lastSyncAt: { _serverTimestamp: true } },
      },
    ]);
  });

  it('returns 0 for empty activities response', async () => {
    // Arrange
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    // Act
    const { syncStravaActivities } = await importStravaRuntimeModules();
    const count = await syncStravaActivities({
      uid: 'user-1',
      accessToken: 'token',
      afterEpoch: 0,
    });

    // Assert
    expect(count).toBe(0);
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(getBatchUpdateRecords()).toEqual([
      {
        docRef: { path: 'stravaTokens', id: 'user-1' },
        payload: { lastSyncAt: { _serverTimestamp: true } },
      },
      {
        docRef: { path: 'stravaConnections', id: 'user-1' },
        payload: { lastSyncAt: { _serverTimestamp: true } },
      },
    ]);
  });
});
