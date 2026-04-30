import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

const adminMock = vi.hoisted(() => {
  const docStore = new Map();
  const mockVerifyIdToken = vi.fn();
  const mockServerTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));
  const mockTimestampFromDate = vi.fn((date) => ({ toDate: () => date }));

  /**
   * Resets the in-memory admin mock state between tests.
   * @returns {void}
   */
  function reset() {
    docStore.clear();
    mockVerifyIdToken.mockReset();
    mockServerTimestamp.mockClear();
    mockTimestampFromDate.mockClear();
  }

  /**
   * Seeds a Firestore document into the in-memory store.
   * @param {string} path - Document path.
   * @param {Record<string, unknown>} data - Document data.
   * @returns {void}
   */
  function seedDoc(path, data) {
    docStore.set(path, data);
  }

  /**
   * Reads a Firestore document from the in-memory store.
   * @param {string} path - Document path.
   * @returns {Record<string, unknown> | undefined} Stored document data.
   */
  function readDoc(path) {
    return docStore.get(path);
  }

  /**
   * Creates a minimal Firestore document reference mock.
   * @param {string} path - Document path.
   * @returns {object} Document reference mock.
   */
  function createDocRef(path) {
    const id = path.split('/').at(-1);

    return {
      id,
      path,
      async get() {
        const data = docStore.get(path);
        return {
          id,
          exists: data !== undefined,
          data: () => data,
          ref: createDocRef(path),
        };
      },
      async set(data, options = undefined) {
        const previous = docStore.get(path);
        docStore.set(path, options?.merge && previous ? { ...previous, ...data } : { ...data });
      },
      async update(data) {
        docStore.set(path, { ...(docStore.get(path) ?? {}), ...data });
      },
      async delete() {
        docStore.delete(path);
      },
    };
  }

  /**
   * Creates a Firestore query snapshot shape.
   * @param {Array<object>} docs - Snapshot documents.
   * @returns {{ empty: boolean, size: number, docs: Array<object> }} Query snapshot.
   */
  function createSnapshot(docs) {
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
    };
  }

  /**
   * Lists direct child documents under a collection path.
   * @param {string} path - Collection path.
   * @returns {Array<object>} Collection document mocks.
   */
  function listCollectionDocs(path) {
    const prefix = `${path}/`;

    return [...docStore.entries()]
      .filter(([docPath]) => docPath.startsWith(prefix) && !docPath.slice(prefix.length).includes('/'))
      .map(([docPath, data]) => ({
        id: docPath.split('/').at(-1),
        exists: true,
        data: () => data,
        ref: createDocRef(docPath),
      }));
  }

  /**
   * Creates a chainable Firestore query mock.
   * @param {string} path - Collection path.
   * @param {Array<{ field: string, operator: string, value: unknown }>} [filters] - Applied filters.
   * @param {number | null} [limitCount] - Applied result limit.
   * @returns {object} Query mock.
   */
  function createQuery(path, filters = [], limitCount = null) {
    return {
      where(field, operator, value) {
        return createQuery(path, [...filters, { field, operator, value }], limitCount);
      },
      limit(value) {
        return createQuery(path, filters, value);
      },
      async get() {
        let docs = listCollectionDocs(path);

        for (const filter of filters) {
          docs = docs.filter((doc) => {
            if (filter.operator !== '==') {
              return false;
            }

            return doc.data()?.[filter.field] === filter.value;
          });
        }

        if (limitCount !== null) {
          docs = docs.slice(0, limitCount);
        }

        return createSnapshot(docs);
      },
    };
  }

  /**
   * Creates a Firestore collection reference mock.
   * @param {string} path - Collection path.
   * @returns {object} Collection reference mock.
   */
  function createCollectionRef(path) {
    return {
      path,
      doc(id) {
        return createDocRef(`${path}/${id}`);
      },
      where(field, operator, value) {
        return createQuery(path, [{ field, operator, value }], null);
      },
      limit(value) {
        return createQuery(path, [], value);
      },
      async get() {
        return createQuery(path).get();
      },
    };
  }

  /**
   * Applies a queued batch operation to the in-memory store.
   * @param {{ type: string, ref: { path: string }, data?: Record<string, unknown>, options?: { merge?: boolean } }} operation - Batch operation.
   * @returns {void}
   */
  function applyBatchOperation(operation) {
    if (operation.type === 'set') {
      const previous = docStore.get(operation.ref.path);
      docStore.set(
        operation.ref.path,
        operation.options?.merge && previous
          ? { ...previous, ...operation.data }
          : { ...operation.data },
      );
      return;
    }

    if (operation.type === 'update') {
      docStore.set(operation.ref.path, { ...(docStore.get(operation.ref.path) ?? {}), ...operation.data });
      return;
    }

    docStore.delete(operation.ref.path);
  }

  /**
   * Creates a Firestore write batch mock.
   * @returns {object} Batch mock.
   */
  function createBatch() {
    const operations = [];

    return {
      set: vi.fn((ref, data, options) => {
        operations.push({ type: 'set', ref, data, options });
      }),
      update: vi.fn((ref, data) => {
        operations.push({ type: 'update', ref, data });
      }),
      delete: vi.fn((ref) => {
        operations.push({ type: 'delete', ref });
      }),
      commit: vi.fn(async () => {
        operations.forEach(applyBatchOperation);
      }),
    };
  }

  const firestoreFn = () => ({
    collection: vi.fn((path) => createCollectionRef(path)),
    batch: vi.fn(() => createBatch()),
  });

  firestoreFn.FieldValue = {
    serverTimestamp: mockServerTimestamp,
  };
  firestoreFn.Timestamp = {
    fromDate: mockTimestampFromDate,
  };

  return {
    mockVerifyIdToken,
    firestoreFn,
    reset,
    seedDoc,
    readDoc,
  };
});

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: {
      applicationDefault: vi.fn(),
      cert: vi.fn(),
    },
    auth: () => ({ verifyIdToken: adminMock.mockVerifyIdToken }),
    firestore: adminMock.firestoreFn,
  },
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

/**
 * Creates a mock Strava activity payload.
 * @param {Partial<{
 *   id: number,
 *   name: string,
 *   type: string,
 *   distance: number,
 *   moving_time: number,
 *   start_date: string,
 *   start_date_local: string,
 *   map: { summary_polyline: string | null },
 *   average_speed: number,
 * }>} overrides - Activity overrides.
 * @returns {object} Strava activity payload.
 */
function createActivity(overrides = {}) {
  return {
    id: 101,
    name: 'Morning Run',
    type: 'Run',
    distance: 5200,
    moving_time: 1710,
    start_date: '2026-04-01T00:00:00Z',
    start_date_local: '2026-04-01T08:00:00',
    map: { summary_polyline: 'encoded-polyline' },
    average_speed: 3.04,
    ...overrides,
  };
}

describe('POST /api/strava/callback', () => {
  beforeEach(() => {
    adminMock.reset();
    vi.stubEnv('STRAVA_CLIENT_ID', 'test-client-id');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-client-secret');
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns 401 when auth token is invalid', async () => {
    adminMock.mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));

    const response = await POST(createMockRequest({ body: { code: 'auth-code-xyz' } }));

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when code is missing from body', async () => {
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });

    const response = await POST(createMockRequest({ body: {} }));

    await expect(response.json()).resolves.toEqual({ error: 'Missing authorization code' });
    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when Strava rejects the authorization code', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockedFetch.mockResolvedValue(
      new Response('{}', {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await POST(createMockRequest({ body: { code: 'bad-code' } }));

    expect(mockedFetch).toHaveBeenCalledWith('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'bad-code',
        grant_type: 'authorization_code',
      }),
    });
    await expect(response.json()).resolves.toEqual({ error: 'Invalid authorization code' });
    expect(response.status).toBe(400);
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toBeUndefined();
  });

  it('stores tokens, syncs supported activities, and returns success', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockedFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_at: 1_900_000_000,
            athlete: {
              id: 42,
              firstname: 'John',
              lastname: 'Doe',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            createActivity(),
            createActivity({ id: 102, type: 'Ride' }),
            createActivity({ id: 103, type: 'TrailRun', name: 'Hill Repeats' }),
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const response = await POST(createMockRequest({ body: { code: 'auth-code-xyz' } }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      athleteName: 'John Doe',
      syncedCount: 2,
    });
    expect(response.status).toBe(200);
    expect(mockedFetch).toHaveBeenNthCalledWith(1, 'https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'auth-code-xyz',
        grant_type: 'authorization_code',
      }),
    });
    expect(mockedFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/v3/athlete/activities?after='),
      { headers: { Authorization: 'Bearer new-access-token' } },
    );
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1_900_000_000,
      athleteId: 42,
      connectedAt: { __type: 'serverTimestamp' },
      lastSyncAt: { __type: 'serverTimestamp' },
    });
    expect(adminMock.readDoc('stravaConnections/user-uid-123')).toMatchObject({
      connected: true,
      athleteId: 42,
      athleteName: 'John Doe',
      connectedAt: { __type: 'serverTimestamp' },
      lastSyncAt: { __type: 'serverTimestamp' },
    });
    expect(adminMock.readDoc('stravaActivities/101')).toMatchObject({
      uid: 'user-uid-123',
      stravaId: 101,
      name: 'Morning Run',
    });
    expect(adminMock.readDoc('stravaActivities/102')).toBeUndefined();
    expect(adminMock.readDoc('stravaActivities/103')).toMatchObject({
      uid: 'user-uid-123',
      stravaId: 103,
      name: 'Hill Repeats',
    });
  });

  it('still returns success when the initial sync fails', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'user-uid-123' });
    mockedFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_at: 1_900_000_000,
            athlete: {
              id: 42,
              firstname: 'Jane',
              lastname: 'Runner',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response('upstream error', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

    const response = await POST(createMockRequest({ body: { code: 'auth-code-xyz' } }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      athleteName: 'Jane Runner',
      syncedCount: 0,
    });
    expect(response.status).toBe(200);
    expect(adminMock.readDoc('stravaTokens/user-uid-123')).toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1_900_000_000,
      athleteId: 42,
    });
    expect(adminMock.readDoc('stravaConnections/user-uid-123')).toMatchObject({
      connected: true,
      athleteName: 'Jane Runner',
    });
    expect(adminMock.readDoc('stravaActivities/101')).toBeUndefined();
  });
});
