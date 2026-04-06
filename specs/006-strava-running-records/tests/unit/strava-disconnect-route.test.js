import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (vi.hoisted ensures availability in vi.mock factory) ---
const {
  mockGet,
  mockUpdate,
  mockDelete,
  mockDocInstance,
  mockQueryGet,
  mockWhere,
  mockBatchDelete,
  mockBatchCommit,
  mockBatch,
} = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockDocInstance = { get: mockGet, update: mockUpdate, delete: mockDelete };

  const mockQueryGet = vi.fn();
  const mockWhere = vi.fn(() => ({
    limit: vi.fn(() => ({ get: mockQueryGet })),
  }));

  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockBatch = vi.fn(() => ({
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  }));

  return {
    mockGet,
    mockUpdate,
    mockDelete,
    mockDocInstance,
    mockQueryGet,
    mockWhere,
    mockBatchDelete,
    mockBatchCommit,
    mockBatch,
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  verifyAuthToken: vi.fn(),
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => mockDocInstance),
      where: mockWhere,
    })),
    batch: mockBatch,
  },
}));

vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
      },
    },
  },
}));

import { verifyAuthToken } from '@/lib/firebase-admin';

const mockedVerifyAuth = /** @type {import('vitest').Mock} */ (verifyAuthToken);

import { POST } from '@/app/api/strava/disconnect/route';

// --- Helpers ---

/**
 * Creates a mock Request with Authorization header.
 * @returns {Request} Mock POST request.
 */
function createMockRequest() {
  return new Request('http://localhost/api/strava/disconnect', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
  });
}

/**
 * Creates a mock Firestore document snapshot for stravaConnections.
 * @param {object} [options] - Snapshot options.
 * @param {boolean} [options.exists] - Whether the document exists.
 * @param {boolean} [options.connected] - Connection status.
 * @returns {{ exists: boolean, data: () => (object | undefined) }} Mock snapshot.
 */
function createMockConnectionDoc({ exists = true, connected = true } = {}) {
  return {
    exists,
    data: () => (exists ? { connected, athleteId: 12345 } : undefined),
  };
}

/**
 * Creates mock activity document snapshots for query results.
 * @param {number} count - Number of activity docs to generate.
 * @returns {{ docs: Array<{ ref: object }>, empty: boolean }} Mock query snapshot.
 */
function createMockActivitySnapshot(count) {
  const docs = Array.from({ length: count }, (_, i) => ({
    ref: { id: `activity-${i}`, path: `stravaActivities/activity-${i}` },
  }));
  return { docs, empty: count === 0 };
}

describe('POST /api/strava/disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when auth token is invalid', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue(null);

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when stravaConnections doc does not exist', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockConnectionDoc({ exists: false }));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Not connected to Strava');
  });

  it('returns 400 when user is not connected (connected=false)', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockConnectionDoc({ connected: false }));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Not connected to Strava');
  });

  it('successfully disconnects — deletes tokens, updates connection, deletes activities', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockConnectionDoc());
    mockQueryGet
      .mockResolvedValueOnce(createMockActivitySnapshot(3))
      .mockResolvedValueOnce(createMockActivitySnapshot(0));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled(); // stravaTokens deleted
    expect(mockUpdate).toHaveBeenCalledWith({ connected: false }); // stravaConnections updated
    expect(mockBatchDelete).toHaveBeenCalledTimes(3); // 3 activities deleted
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('handles case with no activities to delete', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockConnectionDoc());
    mockQueryGet.mockResolvedValue(createMockActivitySnapshot(0));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled(); // stravaTokens still deleted
    expect(mockUpdate).toHaveBeenCalledWith({ connected: false });
    expect(mockBatchDelete).not.toHaveBeenCalled(); // no activities to delete
  });

  it('handles pagination when activities exceed 500 (batch delete in loop)', async () => {
    // Arrange
    mockedVerifyAuth.mockResolvedValue('uid-123');
    mockGet.mockResolvedValue(createMockConnectionDoc());
    mockQueryGet
      .mockResolvedValueOnce(createMockActivitySnapshot(500))
      .mockResolvedValueOnce(createMockActivitySnapshot(200))
      .mockResolvedValueOnce(createMockActivitySnapshot(0));

    // Act
    const response = await POST(createMockRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockBatchDelete).toHaveBeenCalledTimes(700); // 500 + 200
    // batch.commit called for each batch of deletes (2 batches with docs)
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });
});
