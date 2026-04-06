/**
 * @file Unit Test for firebase-strava.js — Client Firestore service layer
 * @description
 * TDD RED phase — tests for Strava connection listener and activities query.
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. AAA Pattern (Arrange, Act, Assert) is mandatory.
 * 3. NO `console.log`.
 * 4. STRICT JSDoc is required.
 * 5. Mock Firebase at the correct level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

/** @type {import('vitest').Mock} */
const mockDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockCollection = vi.fn();
/** @type {import('vitest').Mock} */
const mockOnSnapshot = vi.fn();
/** @type {import('vitest').Mock} */
const mockQuery = vi.fn();
/** @type {import('vitest').Mock} */
const mockWhere = vi.fn();
/** @type {import('vitest').Mock} */
const mockOrderBy = vi.fn();
/** @type {import('vitest').Mock} */
const mockLimit = vi.fn();
/** @type {import('vitest').Mock} */
const mockStartAfter = vi.fn();
/** @type {import('vitest').Mock} */
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  collection: (...args) => mockCollection(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  startAfter: (...args) => mockStartAfter(...args),
  getDocs: (...args) => mockGetDocs(...args),
}));

vi.mock('@/lib/firebase-client', () => ({ db: 'mock-db' }));

// ---------------------------------------------------------------------------
// Test Suites — listenStravaConnection
// ---------------------------------------------------------------------------

describe('Unit: listenStravaConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set up onSnapshot on correct doc path stravaConnections/{uid}', async () => {
    // Arrange
    const { listenStravaConnection } = await import('@/lib/firebase-strava');
    const mockDocRef = { _type: 'docRef' };
    mockDoc.mockReturnValue(mockDocRef);
    mockOnSnapshot.mockReturnValue(vi.fn());

    // Act
    listenStravaConnection('user-123', vi.fn());

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'stravaConnections', 'user-123');
    expect(mockOnSnapshot).toHaveBeenCalledWith(
      mockDocRef,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('should call callback with doc data when snapshot fires (doc exists)', async () => {
    // Arrange
    const { listenStravaConnection } = await import('@/lib/firebase-strava');
    const callback = vi.fn();
    mockDoc.mockReturnValue({ _type: 'docRef' });

    /** @type {Function} */
    let snapshotHandler;
    mockOnSnapshot.mockImplementation((_, onNext) => {
      snapshotHandler = onNext;
      return vi.fn();
    });

    const mockSnap = {
      exists: () => true,
      data: () => ({
        connected: true,
        athleteId: 12345,
        athleteName: 'Runner',
        connectedAt: { toDate: () => new Date() },
        lastSyncAt: null,
      }),
    };

    // Act
    listenStravaConnection('user-123', callback);
    snapshotHandler(mockSnap);

    // Assert
    expect(callback).toHaveBeenCalledWith({
      connected: true,
      athleteId: 12345,
      athleteName: 'Runner',
      connectedAt: expect.any(Object),
      lastSyncAt: null,
    });
  });

  it('should call callback with null when doc does not exist', async () => {
    // Arrange
    const { listenStravaConnection } = await import('@/lib/firebase-strava');
    const callback = vi.fn();
    mockDoc.mockReturnValue({ _type: 'docRef' });

    /** @type {Function} */
    let snapshotHandler;
    mockOnSnapshot.mockImplementation((_, onNext) => {
      snapshotHandler = onNext;
      return vi.fn();
    });

    const mockSnap = {
      exists: () => false,
    };

    // Act
    listenStravaConnection('user-123', callback);
    snapshotHandler(mockSnap);

    // Assert
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('should return unsubscribe function from onSnapshot', async () => {
    // Arrange
    const { listenStravaConnection } = await import('@/lib/firebase-strava');
    const mockUnsub = vi.fn();
    mockDoc.mockReturnValue({ _type: 'docRef' });
    mockOnSnapshot.mockReturnValue(mockUnsub);

    // Act
    const unsub = listenStravaConnection('user-123', vi.fn());

    // Assert
    expect(unsub).toBe(mockUnsub);
  });

  it('should pass error handler to onSnapshot that calls callback with null', async () => {
    // Arrange
    const { listenStravaConnection } = await import('@/lib/firebase-strava');
    const callback = vi.fn();
    mockDoc.mockReturnValue({ _type: 'docRef' });

    /** @type {Function} */
    let errorHandler;
    mockOnSnapshot.mockImplementation((_, _onNext, onError) => {
      errorHandler = onError;
      return vi.fn();
    });

    // Act
    listenStravaConnection('user-123', callback);
    errorHandler(new Error('Permission denied'));

    // Assert
    expect(callback).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// Test Suites — getStravaActivities
// ---------------------------------------------------------------------------

describe('Unit: getStravaActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query with correct where/orderBy/limit', async () => {
    // Arrange
    const { getStravaActivities } = await import('@/lib/firebase-strava');
    const mockCollRef = { _type: 'collRef' };
    const mockQueryRef = { _type: 'queryRef' };
    const mockWhereConstraint = { _type: 'where' };
    const mockOrderByConstraint = { _type: 'orderBy' };
    const mockLimitConstraint = { _type: 'limit' };

    mockCollection.mockReturnValue(mockCollRef);
    mockWhere.mockReturnValue(mockWhereConstraint);
    mockOrderBy.mockReturnValue(mockOrderByConstraint);
    mockLimit.mockReturnValue(mockLimitConstraint);
    mockQuery.mockReturnValue(mockQueryRef);
    mockGetDocs.mockResolvedValue({ docs: [] });

    // Act
    await getStravaActivities('user-123', 10);

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'stravaActivities');
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'user-123');
    expect(mockOrderBy).toHaveBeenCalledWith('startDate', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(mockQuery).toHaveBeenCalledWith(
      mockCollRef,
      mockWhereConstraint,
      mockOrderByConstraint,
      mockLimitConstraint,
    );
    expect(mockGetDocs).toHaveBeenCalledWith(mockQueryRef);
  });

  it('should return activities array and lastDoc from query result', async () => {
    // Arrange
    const { getStravaActivities } = await import('@/lib/firebase-strava');

    const mockDocSnap1 = {
      id: 'activity-1',
      data: () => ({
        uid: 'user-123',
        stravaId: 111,
        name: 'Morning Run',
        type: 'Run',
        distanceMeters: 5000,
        movingTimeSec: 1500,
        startDate: { toDate: () => new Date() },
        startDateLocal: '2026-04-05T07:00:00',
        summaryPolyline: 'abc123',
        averageSpeed: 3.33,
        syncedAt: { toDate: () => new Date() },
      }),
    };
    const mockDocSnap2 = {
      id: 'activity-2',
      data: () => ({
        uid: 'user-123',
        stravaId: 222,
        name: 'Evening Run',
        type: 'Run',
        distanceMeters: 10000,
        movingTimeSec: 3000,
        startDate: { toDate: () => new Date() },
        startDateLocal: '2026-04-04T18:00:00',
        summaryPolyline: null,
        averageSpeed: 3.33,
        syncedAt: { toDate: () => new Date() },
      }),
    };

    mockCollection.mockReturnValue({ _type: 'collRef' });
    mockWhere.mockReturnValue({ _type: 'where' });
    mockOrderBy.mockReturnValue({ _type: 'orderBy' });
    mockLimit.mockReturnValue({ _type: 'limit' });
    mockQuery.mockReturnValue({ _type: 'queryRef' });
    mockGetDocs.mockResolvedValue({ docs: [mockDocSnap1, mockDocSnap2] });

    // Act
    const result = await getStravaActivities('user-123', 10);

    // Assert
    expect(result.activities).toHaveLength(2);
    expect(result.activities[0].id).toBe('activity-1');
    expect(result.activities[0].name).toBe('Morning Run');
    expect(result.activities[1].id).toBe('activity-2');
    expect(result.activities[1].name).toBe('Evening Run');
    expect(result.lastDoc).toBe(mockDocSnap2);
  });

  it('should handle pagination with startAfter when lastDoc provided', async () => {
    // Arrange
    const { getStravaActivities } = await import('@/lib/firebase-strava');
    const cursorDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (
      /** @type {unknown} */ ({ id: 'cursor-doc' })
    );

    const mockCollRef = { _type: 'collRef' };
    const mockQueryRef = { _type: 'queryRef' };
    const mockWhereConstraint = { _type: 'where' };
    const mockOrderByConstraint = { _type: 'orderBy' };
    const mockLimitConstraint = { _type: 'limit' };
    const mockStartAfterConstraint = { _type: 'startAfter' };

    mockCollection.mockReturnValue(mockCollRef);
    mockWhere.mockReturnValue(mockWhereConstraint);
    mockOrderBy.mockReturnValue(mockOrderByConstraint);
    mockLimit.mockReturnValue(mockLimitConstraint);
    mockStartAfter.mockReturnValue(mockStartAfterConstraint);
    mockQuery.mockReturnValue(mockQueryRef);
    mockGetDocs.mockResolvedValue({ docs: [] });

    // Act
    await getStravaActivities('user-123', 10, cursorDoc);

    // Assert
    expect(mockStartAfter).toHaveBeenCalledWith(cursorDoc);
    expect(mockQuery).toHaveBeenCalledWith(
      mockCollRef,
      mockWhereConstraint,
      mockOrderByConstraint,
      mockStartAfterConstraint,
      mockLimitConstraint,
    );
  });

  it('should return empty array and null lastDoc when no results', async () => {
    // Arrange
    const { getStravaActivities } = await import('@/lib/firebase-strava');

    mockCollection.mockReturnValue({ _type: 'collRef' });
    mockWhere.mockReturnValue({ _type: 'where' });
    mockOrderBy.mockReturnValue({ _type: 'orderBy' });
    mockLimit.mockReturnValue({ _type: 'limit' });
    mockQuery.mockReturnValue({ _type: 'queryRef' });
    mockGetDocs.mockResolvedValue({ docs: [] });

    // Act
    const result = await getStravaActivities('user-123', 10);

    // Assert
    expect(result.activities).toEqual([]);
    expect(result.lastDoc).toBeNull();
  });

  it('should propagate query error', async () => {
    // Arrange
    const { getStravaActivities } = await import('@/lib/firebase-strava');

    mockCollection.mockReturnValue({ _type: 'collRef' });
    mockWhere.mockReturnValue({ _type: 'where' });
    mockOrderBy.mockReturnValue({ _type: 'orderBy' });
    mockLimit.mockReturnValue({ _type: 'limit' });
    mockQuery.mockReturnValue({ _type: 'queryRef' });
    mockGetDocs.mockRejectedValue(new Error('Firestore query failed'));

    // Act & Assert
    await expect(getStravaActivities('user-123', 10)).rejects.toThrow('Firestore query failed');
  });
});
