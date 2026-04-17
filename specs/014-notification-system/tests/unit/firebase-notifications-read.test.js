import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({ db: 'mock-db' }));
vi.mock('@/lib/firebase-events', () => ({ fetchParticipants: vi.fn() }));
vi.mock('@/lib/notification-helpers', () => ({ buildNotificationMessage: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import {
  onSnapshot,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  doc,
  collection,
} from 'firebase/firestore';
import {
  watchNotifications,
  watchUnreadNotifications,
  fetchMoreNotifications,
  fetchMoreUnreadNotifications,
  markNotificationAsRead,
} from '@/lib/firebase-notifications';

// ---------------------------------------------------------------------------
// Typed aliases
// ---------------------------------------------------------------------------
const mockedOnSnapshot = /** @type {import('vitest').Mock} */ (onSnapshot);
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedUpdateDoc = /** @type {import('vitest').Mock} */ (updateDoc);
const mockedQuery = /** @type {import('vitest').Mock} */ (query);
const mockedWhere = /** @type {import('vitest').Mock} */ (where);
const mockedOrderBy = /** @type {import('vitest').Mock} */ (orderBy);
const mockedLimit = /** @type {import('vitest').Mock} */ (limit);
const mockedStartAfter = /** @type {import('vitest').Mock} */ (startAfter);
const mockedDoc = /** @type {import('vitest').Mock} */ (doc);
const mockedCollection = /** @type {import('vitest').Mock} */ (collection);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
/**
 * @param {Array<{ id: string, data: object }>} docs - 模擬的 Firestore 文件。
 * @param {Array<{ type: string, id: string, data: object }>} changes - 模擬的 docChanges。
 * @returns {{ docs: Array<{ id: string, data: () => object }>, docChanges: () => Array<{ type: string, doc: { id: string, data: () => object } }> }} mock Firestore snapshot。
 */
function createMockSnapshot(docs, changes = []) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
    docChanges: () =>
      changes.map((c) => ({
        type: c.type,
        doc: { id: c.id, data: () => c.data },
      })),
  };
}

// ---------------------------------------------------------------------------
// watchNotifications
// ---------------------------------------------------------------------------
describe('watchNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCollection.mockReturnValue('mock-collection-ref');
    mockedWhere.mockReturnValue('mock-where');
    mockedOrderBy.mockReturnValue('mock-orderBy');
    mockedLimit.mockReturnValue('mock-limit');
    mockedQuery.mockReturnValue('mock-query');
  });

  it('should call onSnapshot with correct query constraints', () => {
    // Arrange
    mockedOnSnapshot.mockReturnValue(vi.fn());

    // Act
    watchNotifications('uid-1', vi.fn(), vi.fn());

    // Assert
    expect(mockedCollection).toHaveBeenCalledWith('mock-db', 'notifications');
    expect(mockedWhere).toHaveBeenCalledWith('recipientUid', '==', 'uid-1');
    expect(mockedOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockedLimit).toHaveBeenCalledWith(5);
    expect(mockedOnSnapshot).toHaveBeenCalledWith(
      'mock-query',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('should return an unsubscribe function', () => {
    // Arrange
    const mockUnsub = vi.fn();
    mockedOnSnapshot.mockReturnValue(mockUnsub);

    // Act
    const unsub = watchNotifications('uid-1', vi.fn(), vi.fn());

    // Assert
    expect(unsub).toBe(mockUnsub);
  });

  it('should call onNext with mapped notifications on first snapshot (initial load)', () => {
    // Arrange
    /** @type {(snapshot: any) => void} */
    let snapshotCallback;
    mockedOnSnapshot.mockImplementation((q, onNextCb) => {
      snapshotCallback = onNextCb;
      return vi.fn();
    });
    const onNext = vi.fn();
    const onNew = vi.fn();
    watchNotifications('uid-1', onNext, vi.fn(), onNew);

    const snapshot = createMockSnapshot([
      { id: 'n1', data: { message: 'test1', read: false } },
      { id: 'n2', data: { message: 'test2', read: true } },
    ]);

    // Act
    snapshotCallback(snapshot);

    // Assert — onNext receives (notifications, lastDoc)
    expect(onNext).toHaveBeenCalledWith(
      [
        { id: 'n1', message: 'test1', read: false },
        { id: 'n2', message: 'test2', read: true },
      ],
      expect.objectContaining({ id: 'n2' }),
    );
  });

  it('should NOT call onNew on first snapshot (initial load)', () => {
    // Arrange
    /** @type {(snapshot: any) => void} */
    let snapshotCallback;
    mockedOnSnapshot.mockImplementation((q, onNextCb) => {
      snapshotCallback = onNextCb;
      return vi.fn();
    });
    const onNew = vi.fn();
    watchNotifications('uid-1', vi.fn(), vi.fn(), onNew);

    const snapshot = createMockSnapshot(
      [{ id: 'n1', data: { message: 'test1', read: false } }],
      [{ type: 'added', id: 'n1', data: { message: 'test1', read: false } }],
    );

    // Act
    snapshotCallback(snapshot);

    // Assert
    expect(onNew).not.toHaveBeenCalled();
  });

  it('should call onNext and onNew on subsequent snapshots', () => {
    // Arrange
    /** @type {(snapshot: any) => void} */
    let snapshotCallback;
    mockedOnSnapshot.mockImplementation((q, onNextCb) => {
      snapshotCallback = onNextCb;
      return vi.fn();
    });
    const onNext = vi.fn();
    const onNew = vi.fn();
    watchNotifications('uid-1', onNext, vi.fn(), onNew);

    // First snapshot (initial load)
    snapshotCallback(createMockSnapshot([{ id: 'n1', data: { message: 'old', read: false } }], []));

    // Second snapshot (subsequent)
    const secondSnapshot = createMockSnapshot(
      [
        { id: 'n1', data: { message: 'old', read: false } },
        { id: 'n3', data: { message: 'new', read: false } },
      ],
      [{ type: 'added', id: 'n3', data: { message: 'new', read: false } }],
    );

    // Act
    snapshotCallback(secondSnapshot);

    // Assert
    expect(onNext).toHaveBeenCalledTimes(2);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onNew).toHaveBeenCalledWith([{ id: 'n3', message: 'new', read: false }]);
  });

  it('should not throw when onNew is not provided on subsequent snapshots', () => {
    // Arrange
    /** @type {(snapshot: any) => void} */
    let snapshotCallback;
    mockedOnSnapshot.mockImplementation((q, onNextCb) => {
      snapshotCallback = onNextCb;
      return vi.fn();
    });
    watchNotifications('uid-1', vi.fn(), vi.fn());

    // First snapshot
    snapshotCallback(createMockSnapshot([], []));

    // Act & Assert — should not throw
    const secondSnapshot = createMockSnapshot(
      [{ id: 'n3', data: { message: 'new', read: false } }],
      [{ type: 'added', id: 'n3', data: { message: 'new', read: false } }],
    );
    expect(() => snapshotCallback(secondSnapshot)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// watchUnreadNotifications
// ---------------------------------------------------------------------------
describe('watchUnreadNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCollection.mockReturnValue('mock-collection-ref');
    mockedWhere.mockReturnValue('mock-where');
    mockedOrderBy.mockReturnValue('mock-orderBy');
    mockedLimit.mockReturnValue('mock-limit');
    mockedQuery.mockReturnValue('mock-query');
  });

  it('should call onSnapshot with query including read==false filter', () => {
    // Arrange
    mockedOnSnapshot.mockReturnValue(vi.fn());

    // Act
    watchUnreadNotifications('uid-1', vi.fn(), vi.fn());

    // Assert
    expect(mockedCollection).toHaveBeenCalledWith('mock-db', 'notifications');
    expect(mockedWhere).toHaveBeenCalledWith('recipientUid', '==', 'uid-1');
    expect(mockedWhere).toHaveBeenCalledWith('read', '==', false);
    expect(mockedOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockedLimit).toHaveBeenCalledWith(100);
    expect(mockedOnSnapshot).toHaveBeenCalledWith(
      'mock-query',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('should return unsubscribe function', () => {
    // Arrange
    const mockUnsub = vi.fn();
    mockedOnSnapshot.mockReturnValue(mockUnsub);

    // Act
    const unsub = watchUnreadNotifications('uid-1', vi.fn(), vi.fn());

    // Assert
    expect(unsub).toBe(mockUnsub);
  });

  it('should map snapshot docs to NotificationItem array', () => {
    // Arrange
    /** @type {(snapshot: any) => void} */
    let snapshotCallback;
    mockedOnSnapshot.mockImplementation((q, onNextCb) => {
      snapshotCallback = onNextCb;
      return vi.fn();
    });
    const onNext = vi.fn();
    watchUnreadNotifications('uid-1', onNext, vi.fn());

    const snapshot = createMockSnapshot([
      { id: 'n1', data: { message: 'unread1', read: false } },
      { id: 'n2', data: { message: 'unread2', read: false } },
    ]);

    // Act
    snapshotCallback(snapshot);

    // Assert — onNext receives (notifications, lastDoc)
    expect(onNext).toHaveBeenCalledWith(
      [
        { id: 'n1', message: 'unread1', read: false },
        { id: 'n2', message: 'unread2', read: false },
      ],
      expect.objectContaining({ id: 'n2' }),
    );
  });
});

// ---------------------------------------------------------------------------
// fetchMoreNotifications
// ---------------------------------------------------------------------------
describe('fetchMoreNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCollection.mockReturnValue('mock-collection-ref');
    mockedWhere.mockReturnValue('mock-where');
    mockedOrderBy.mockReturnValue('mock-orderBy');
    mockedStartAfter.mockReturnValue('mock-startAfter');
    mockedLimit.mockReturnValue('mock-limit');
    mockedQuery.mockReturnValue('mock-query');
  });

  it('should call getDocs with correct query constraints', async () => {
    // Arrange
    const afterDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ ({
      id: 'cursor-doc',
    });
    mockedGetDocs.mockResolvedValue({ docs: [] });

    // Act
    await fetchMoreNotifications('uid-1', afterDoc, 10);

    // Assert
    expect(mockedCollection).toHaveBeenCalledWith('mock-db', 'notifications');
    expect(mockedWhere).toHaveBeenCalledWith('recipientUid', '==', 'uid-1');
    expect(mockedOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockedStartAfter).toHaveBeenCalledWith(afterDoc);
    expect(mockedLimit).toHaveBeenCalledWith(10);
    expect(mockedGetDocs).toHaveBeenCalledWith('mock-query');
  });

  it('should default limitCount to 5 when not provided', async () => {
    // Arrange
    const afterDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ ({
      id: 'cursor-doc',
    });
    mockedGetDocs.mockResolvedValue({ docs: [] });

    // Act
    await fetchMoreNotifications('uid-1', afterDoc);

    // Assert
    expect(mockedLimit).toHaveBeenCalledWith(5);
  });

  it('should return notifications and lastDoc', async () => {
    // Arrange
    const afterDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ ({
      id: 'cursor-doc',
    });
    const mockDocs = [
      { id: 'n10', data: () => ({ message: 'page2-1', read: true }) },
      { id: 'n11', data: () => ({ message: 'page2-2', read: false }) },
    ];
    mockedGetDocs.mockResolvedValue({ docs: mockDocs });

    // Act
    const result = await fetchMoreNotifications('uid-1', afterDoc, 5);

    // Assert
    expect(result.notifications).toEqual([
      { id: 'n10', message: 'page2-1', read: true },
      { id: 'n11', message: 'page2-2', read: false },
    ]);
    expect(result.lastDoc).toBe(mockDocs[mockDocs.length - 1]);
  });

  it('should return lastDoc as null when no docs returned', async () => {
    // Arrange
    const afterDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ ({
      id: 'cursor-doc',
    });
    mockedGetDocs.mockResolvedValue({ docs: [] });

    // Act
    const result = await fetchMoreNotifications('uid-1', afterDoc, 5);

    // Assert
    expect(result.notifications).toEqual([]);
    expect(result.lastDoc).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchMoreUnreadNotifications
// ---------------------------------------------------------------------------
describe('fetchMoreUnreadNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCollection.mockReturnValue('mock-collection-ref');
    mockedWhere.mockReturnValue('mock-where');
    mockedOrderBy.mockReturnValue('mock-orderBy');
    mockedStartAfter.mockReturnValue('mock-startAfter');
    mockedLimit.mockReturnValue('mock-limit');
    mockedQuery.mockReturnValue('mock-query');
  });

  it('should call getDocs with query including read==false filter', async () => {
    // Arrange
    const afterDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ ({
      id: 'cursor-doc',
    });
    mockedGetDocs.mockResolvedValue({ docs: [] });

    // Act
    await fetchMoreUnreadNotifications('uid-1', afterDoc, 10);

    // Assert
    expect(mockedWhere).toHaveBeenCalledWith('recipientUid', '==', 'uid-1');
    expect(mockedWhere).toHaveBeenCalledWith('read', '==', false);
    expect(mockedOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockedStartAfter).toHaveBeenCalledWith(afterDoc);
    expect(mockedLimit).toHaveBeenCalledWith(10);
    expect(mockedGetDocs).toHaveBeenCalledWith('mock-query');
  });

  it('should return notifications and lastDoc', async () => {
    // Arrange
    const afterDoc = /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ ({
      id: 'cursor-doc',
    });
    const mockDocs = [{ id: 'n20', data: () => ({ message: 'unread-page2', read: false }) }];
    mockedGetDocs.mockResolvedValue({ docs: mockDocs });

    // Act
    const result = await fetchMoreUnreadNotifications('uid-1', afterDoc, 5);

    // Assert
    expect(result.notifications).toEqual([{ id: 'n20', message: 'unread-page2', read: false }]);
    expect(result.lastDoc).toBe(mockDocs[0]);
  });
});

// ---------------------------------------------------------------------------
// markNotificationAsRead
// ---------------------------------------------------------------------------
describe('markNotificationAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDoc.mockReturnValue('mock-doc-ref');
    mockedUpdateDoc.mockResolvedValue(undefined);
  });

  it('should call updateDoc with correct doc reference and read: true', async () => {
    // Arrange — done in beforeEach

    // Act
    await markNotificationAsRead('notif-123');

    // Assert
    expect(mockedDoc).toHaveBeenCalledWith('mock-db', 'notifications', 'notif-123');
    expect(mockedUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { read: true });
  });
});
