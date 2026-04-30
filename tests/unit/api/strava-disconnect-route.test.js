import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const adminMock = vi.hoisted(() => {
  const docStore = new Map();
  const mockVerifyIdToken = vi.fn();

  /** Reset in-memory Admin SDK state between tests. */
  function reset() {
    docStore.clear();
    mockVerifyIdToken.mockReset();
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
   *   update: (data: object) => Promise<void>,
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
      async update(data) {
        docStore.set(path, { ...(docStore.get(path) ?? {}), ...data });
      },
    };
  }

  /**
   * @param {Array<{ id: string, data: () => object, ref: ReturnType<typeof createDocRef> }>} docs Query result docs.
   * @returns {{ empty: boolean, size: number, docs: Array<{ id: string, data: () => object, ref: ReturnType<typeof createDocRef> }> }} Firestore-like snapshot.
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
   * @returns {Array<{ id: string, data: () => object, ref: ReturnType<typeof createDocRef> }>} Collection docs.
   */
  function listCollectionDocs(path) {
    const prefix = `${path}/`;

    return [...docStore.entries()]
      .filter(([docPath]) => docPath.startsWith(prefix) && !docPath.slice(prefix.length).includes('/'))
      .map(([docPath, data]) => ({
        id: docPath.split('/').at(-1),
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
   *   doc: (id: string) => ReturnType<typeof createDocRef>,
   *   where: (field: string, operator: string, value: unknown) => ReturnType<typeof createQuery>,
   * }} Firestore-like collection ref mock.
   */
  function createCollectionRef(path) {
    return {
      doc(id) {
        return createDocRef(`${path}/${id}`);
      },
      where(field, operator, value) {
        return createQuery(path, [{ field, operator, value }], null);
      },
    };
  }

  /**
   * @param {{ type: 'update' | 'delete', ref: ReturnType<typeof createDocRef>, data?: object }} operation Pending batch operation.
   * @returns {void}
   */
  function applyBatchOperation(operation) {
    if (operation.type === 'update') {
      docStore.set(operation.ref.path, { ...(docStore.get(operation.ref.path) ?? {}), ...operation.data });
      return;
    }

    docStore.delete(operation.ref.path);
  }

  /**
   * @returns {{
   *   update: import('vitest').Mock,
   *   delete: import('vitest').Mock,
   *   commit: import('vitest').Mock,
   * }} Firestore-like write batch mock.
   */
  function createBatch() {
    const operations = [];

    return {
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

import { POST } from '@/app/api/strava/disconnect/route';

/**
 * @returns {Request} Mock POST request with Authorization header.
 */
function createMockRequest() {
  return new Request('http://localhost/api/strava/disconnect', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
  });
}

describe('POST /api/strava/disconnect', () => {
  beforeEach(() => {
    adminMock.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when auth token is invalid', async () => {
    adminMock.mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
  });

  it('returns 400 when the user is not connected to Strava', async () => {
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'uid-123' });
    adminMock.seedDoc('stravaConnections/uid-123', { connected: false });

    const response = await POST(createMockRequest());

    await expect(response.json()).resolves.toEqual({ error: 'Not connected to Strava' });
    expect(response.status).toBe(400);
  });

  it('disconnects the user and deletes only that user activity docs', async () => {
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'uid-123' });
    adminMock.seedDoc('stravaConnections/uid-123', { connected: true, athleteId: 321 });
    adminMock.seedDoc('stravaTokens/uid-123', { accessToken: 'token-123' });
    adminMock.seedDoc('stravaActivities/101', { uid: 'uid-123', name: 'Morning Run' });
    adminMock.seedDoc('stravaActivities/102', { uid: 'uid-123', name: 'Evening Run' });
    adminMock.seedDoc('stravaActivities/201', { uid: 'uid-other', name: 'Other User Run' });

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(adminMock.readDoc('stravaTokens/uid-123')).toBeUndefined();
    expect(adminMock.readDoc('stravaConnections/uid-123')).toMatchObject({
      connected: false,
      athleteId: 321,
    });
    expect(adminMock.readDoc('stravaActivities/101')).toBeUndefined();
    expect(adminMock.readDoc('stravaActivities/102')).toBeUndefined();
    expect(adminMock.readDoc('stravaActivities/201')).toMatchObject({
      uid: 'uid-other',
      name: 'Other User Run',
    });
  });
});
