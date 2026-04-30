import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

const adminMock = vi.hoisted(() => {
  const docStore = new Map();
  const mockServerTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));
  const mockTimestampFromDate = vi.fn((date) => ({ toDate: () => date }));

  /**
   * Resets the in-memory admin mock state between tests.
   * @returns {void}
   */
  function reset() {
    docStore.clear();
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
    auth: () => ({ verifyIdToken: vi.fn() }),
    firestore: adminMock.firestoreFn,
  },
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
    id: 123456,
    name: 'Webhook Run',
    type: 'Run',
    distance: 8000,
    moving_time: 2500,
    start_date: '2026-04-01T00:00:00Z',
    start_date_local: '2026-04-01T08:00:00',
    map: { summary_polyline: 'encoded-polyline' },
    average_speed: 3.2,
    ...overrides,
  };
}

/**
 * Lets queued async webhook side effects settle before assertions.
 * @returns {Promise<void>}
 */
async function flushBackgroundWork() {
  for (let count = 0; count < 8; count += 1) {
    await Promise.resolve();
  }
}

describe('GET /api/strava/webhook', () => {
  beforeEach(() => {
    adminMock.reset();
    vi.stubEnv('STRAVA_WEBHOOK_VERIFY_TOKEN', 'verify-me');
    vi.stubEnv('STRAVA_WEBHOOK_SUBSCRIPTION_ID', '42');
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns the challenge when verify token matches env', async () => {
    const response = GET(
      new Request(
        'http://localhost/api/strava/webhook?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=verify-me',
      ),
    );

    await expect(response.json()).resolves.toEqual({ 'hub.challenge': 'abc123' });
    expect(response.status).toBe(200);
  });

  it('returns 403 when verify token does not match env', async () => {
    const response = GET(
      new Request(
        'http://localhost/api/strava/webhook?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=wrong-token',
      ),
    );

    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(response.status).toBe(403);
  });
});

describe('POST /api/strava/webhook', () => {
  beforeEach(() => {
    adminMock.reset();
    vi.stubEnv('STRAVA_WEBHOOK_VERIFY_TOKEN', 'verify-me');
    vi.stubEnv('STRAVA_WEBHOOK_SUBSCRIPTION_ID', '42');
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns 403 when subscription_id does not match env', async () => {
    const request = new Request('http://localhost/api/strava/webhook', {
      method: 'POST',
      body: JSON.stringify(createWebhookEvent({ subscription_id: 999 })),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: 'Invalid subscription' });
    expect(response.status).toBe(403);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 200 immediately and syncs activity events in the background', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.seedDoc('stravaTokens/uid-123', {
      athleteId: 99999,
      accessToken: 'existing-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    adminMock.seedDoc('stravaConnections/uid-123', { connected: true });
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify(createActivity()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/strava/webhook', {
        method: 'POST',
        body: JSON.stringify(createWebhookEvent()),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(await response.text()).toBe('OK');
    expect(response.status).toBe(200);
    await flushBackgroundWork();
    expect(mockedFetch).toHaveBeenCalledWith('https://www.strava.com/api/v3/activities/123456', {
      headers: { Authorization: 'Bearer existing-token' },
    });
    expect(adminMock.readDoc('stravaActivities/123456')).toMatchObject({
      uid: 'uid-123',
      stravaId: 123456,
      name: 'Webhook Run',
    });
    expect(adminMock.readDoc('stravaTokens/uid-123')).toMatchObject({
      lastSyncAt: { __type: 'serverTimestamp' },
    });
    expect(adminMock.readDoc('stravaConnections/uid-123')).toMatchObject({
      lastSyncAt: { __type: 'serverTimestamp' },
    });
  });

  it('still returns 200 when background processing fails', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.seedDoc('stravaTokens/uid-123', {
      athleteId: 99999,
      accessToken: 'existing-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    adminMock.seedDoc('stravaConnections/uid-123', { connected: true });
    mockedFetch.mockResolvedValue(
      new Response('upstream error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/strava/webhook', {
        method: 'POST',
        body: JSON.stringify(createWebhookEvent({ object_id: 777 })),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(await response.text()).toBe('OK');
    expect(response.status).toBe(200);
    await flushBackgroundWork();
    expect(mockedFetch).toHaveBeenCalledWith('https://www.strava.com/api/v3/activities/777', {
      headers: { Authorization: 'Bearer existing-token' },
    });
    expect(adminMock.readDoc('stravaActivities/777')).toBeUndefined();
  });

  it('processes athlete deauthorization in the background', async () => {
    adminMock.seedDoc('stravaTokens/uid-123', {
      athleteId: 99999,
      accessToken: 'existing-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    adminMock.seedDoc('stravaConnections/uid-123', { connected: true });

    const response = await POST(
      new Request('http://localhost/api/strava/webhook', {
        method: 'POST',
        body: JSON.stringify(
          createWebhookEvent({
            object_type: 'athlete',
            aspect_type: 'update',
            updates: { authorized: 'false' },
          }),
        ),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(await response.text()).toBe('OK');
    expect(response.status).toBe(200);
    await flushBackgroundWork();
    expect(adminMock.readDoc('stravaTokens/uid-123')).toBeUndefined();
    expect(adminMock.readDoc('stravaConnections/uid-123')).toMatchObject({
      connected: false,
    });
  });
});
