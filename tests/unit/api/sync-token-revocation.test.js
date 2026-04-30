import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-04-30T12:00:00Z');

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
   *   get: () => Promise<{ id: string, exists: boolean, data: () => object | undefined }>,
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
        };
      },
      async update(data) {
        docStore.set(path, { ...(docStore.get(path) ?? {}), ...data });
      },
    };
  }

  const firestoreFn = () => ({
    collection: vi.fn((path) => ({
      doc(id) {
        return createDocRef(`${path}/${id}`);
      },
    })),
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

import { POST } from '@/app/api/strava/sync/route';

/**
 * @returns {Request} Mock POST request with Authorization header.
 */
function createMockRequest() {
  return new Request('http://localhost/api/strava/sync', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
  });
}

describe('POST /api/strava/sync — token revocation', () => {
  beforeEach(() => {
    adminMock.reset();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('STRAVA_CLIENT_ID', 'strava-client-id');
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'strava-client-secret');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('refresh failure 時會回 401，並把 connection 標成 disconnected', async () => {
    const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
    adminMock.mockVerifyIdToken.mockResolvedValue({ uid: 'uid-revoked-401' });
    adminMock.seedDoc('stravaTokens/uid-revoked-401', {
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(NOW.getTime() / 1000) - 60,
    });
    adminMock.seedDoc('stravaConnections/uid-revoked-401', {
      connected: true,
      athleteId: 12345,
    });
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ code: 'invalid_grant' }] }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await POST(createMockRequest());

    expect(mockedFetch.mock.calls).toHaveLength(1);
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    );

    const refreshRequest = mockedFetch.mock.calls[0][1];
    expect(refreshRequest.body.toString()).toContain('grant_type=refresh_token');
    expect(refreshRequest.body.toString()).toContain('refresh_token=refresh-token');
    expect(refreshRequest.body.toString()).toContain('client_id=strava-client-id');
    expect(refreshRequest.body.toString()).toContain('client_secret=strava-client-secret');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token refresh failed' });
    expect(adminMock.readDoc('stravaConnections/uid-revoked-401')).toMatchObject({
      connected: false,
      athleteId: 12345,
    });
    expect(adminMock.readDoc('stravaTokens/uid-revoked-401')).toMatchObject({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
    });
  });
});
