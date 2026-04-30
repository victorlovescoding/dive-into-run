import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-04-30T12:00:00Z');

const adminMock = vi.hoisted(() => {
  const docStore = new Map();
  const mockVerifyIdToken = vi.fn();
  const mockServerTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));
  const mockTimestampFromDate = vi.fn((date) => ({ toDate: () => date }));

  /** Reset in-memory Admin SDK state between tests. */
  function reset() {
    docStore.clear();
    mockVerifyIdToken.mockReset();
    mockServerTimestamp.mockClear();
    mockTimestampFromDate.mockClear();
  }

  /**
   * @param {string} path Firestore document path.
   * @param {object} data Firestore document data.
   */
  function seedDoc(path, data) {
    docStore.set(path, data);
  }

  /**
   * @param {string} path Firestore document path.
   * @returns {object | undefined} Stored document data.
   */
  function readDoc(path) {
    return docStore.get(path);
  }

  /**
   * @param {string} path Firestore document path.
   * @returns {{
   *   id: string,
   *   path: string,
   *   get: () => Promise<{ id: string, exists: boolean, data: () => object | undefined, ref: ReturnType<typeof createDocRef> }>,
   *   set: (data: object, options?: { merge?: boolean }) => Promise<void>,
   *   update: (data: object) => Promise<void>,
   *   delete: () => Promise<void>,
   * }} Firestore-like document ref mock.
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
   * @param {Array<{ id: string, exists: boolean, data: () => object, ref: ReturnType<typeof createDocRef> }>} docs Query result docs.
   * @returns {{ empty: boolean, size: number, docs: Array<{ id: string, exists: boolean, data: () => object, ref: ReturnType<typeof createDocRef> }> }} Firestore-like snapshot.
   */
  function createSnapshot(docs) {
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
    };
  }

  /**
   * @param {string} path Firestore collection path.
   * @returns {Array<{ id: string, exists: boolean, data: () => object, ref: ReturnType<typeof createDocRef> }>} Collection docs.
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
   * @param {string} path Firestore collection path.
   * @param {Array<{ field: string, operator: string, value: unknown }>} [filters] Equality filters.
   * @param {number | null} [limitCount] Maximum doc count.
   * @returns {{
   *   where: (field: string, operator: string, value: unknown) => ReturnType<typeof createQuery>,
   *   limit: (value: number) => ReturnType<typeof createQuery>,
   *   get: () => Promise<ReturnType<typeof createSnapshot>>,
   * }} Firestore-like query mock.
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
            if (filter.operator !== '==') return false;
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
   * @param {string} path Firestore collection path.
   * @returns {{
   *   path: string,
   *   doc: (id: string) => ReturnType<typeof createDocRef>,
   *   where: (field: string, operator: string, value: unknown) => ReturnType<typeof createQuery>,
   *   limit: (value: number) => ReturnType<typeof createQuery>,
   *   get: () => Promise<ReturnType<typeof createSnapshot>>,
   * }} Firestore-like collection ref mock.
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
   * @param {{ type: 'set' | 'update' | 'delete', ref: ReturnType<typeof createDocRef>, data?: object, options?: { merge?: boolean } }} operation Pending batch operation.
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
   * @returns {{
   *   set: import('vitest').Mock,
   *   update: import('vitest').Mock,
   *   delete: import('vitest').Mock,
   *   commit: import('vitest').Mock,
   * }} Firestore-like write batch mock.
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

/**
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
 * }>} overrides Activity overrides.
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

describe('POST /api/strava/sync', () => {
  beforeEach(() => {
    adminMock.reset();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns 401 when auth token is invalid', async () => {
    adminMock.mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
  });

  it('delegates the authenticated uid to real sync flow', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'uid-123' });
    adminMock.seedDoc('stravaTokens/uid-123', {
      accessToken: 'existing-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(NOW.getTime() / 1000) + 3600,
    });
    adminMock.seedDoc('stravaConnections/uid-123', { connected: true });
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify([createActivity(), createActivity({ id: 102, type: 'Ride' })]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await POST(createMockRequest());

    expect(mockedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v3/athlete/activities?after='),
      { headers: { Authorization: 'Bearer existing-token' } },
    );
    await expect(response.json()).resolves.toEqual({ success: true, count: 1 });
    expect(response.status).toBe(200);
    expect(adminMock.readDoc('stravaActivities/101')).toMatchObject({
      uid: 'uid-123',
      stravaId: 101,
      name: 'Morning Run',
    });
    expect(adminMock.readDoc('stravaTokens/uid-123')).toMatchObject({
      lastSyncAt: { __type: 'serverTimestamp' },
    });
  });

  it('forwards non-200 use-case responses', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'uid-123' });
    adminMock.seedDoc('stravaTokens/uid-123', {
      accessToken: 'existing-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(NOW.getTime() / 1000) + 3600,
      lastSyncAt: { toDate: () => new Date(NOW.getTime() - 10_000) },
    });

    const response = await POST(createMockRequest());

    expect(mockedFetch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: 'Sync cooldown active',
      retryAfter: 290,
    });
    expect(response.status).toBe(429);
  });
});
