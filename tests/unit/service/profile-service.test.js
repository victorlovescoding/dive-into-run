import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHostedEvents,
  getProfileStats,
  getUserProfile,
  updateUserBio,
} from '@/service/profile-service';

const {
  mockCollection,
  mockCollectionGroup,
  mockDoc,
  mockGetCountFromServer,
  mockGetDoc,
  mockGetDocs,
  mockLimit,
  mockOrderBy,
  mockQuery,
  mockSetDoc,
  mockStartAfter,
  mockWhere,
} = vi.hoisted(() => ({
  mockCollection: vi.fn(),
  mockCollectionGroup: vi.fn(),
  mockDoc: vi.fn(),
  mockGetCountFromServer: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockQuery: vi.fn(),
  mockSetDoc: vi.fn(),
  mockStartAfter: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  doc: mockDoc,
  getCountFromServer: mockGetCountFromServer,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  orderBy: mockOrderBy,
  query: mockQuery,
  setDoc: mockSetDoc,
  startAfter: mockStartAfter,
  where: mockWhere,
}));

vi.mock('@/config/client/firebase-client', () => ({
  db: 'mock-db',
}));

/**
 * @param {boolean} exists 是否存在該文件。
 * @param {Record<string, unknown> | undefined} data 文件資料。
 * @returns {import('firebase/firestore').DocumentSnapshot} 模擬的文件快照。
 */
function createDocSnapshot(exists, data) {
  return /** @type {import('firebase/firestore').DocumentSnapshot} */ (
    /** @type {unknown} */ ({
      exists: () => exists,
      data: () => data,
    })
  );
}

/**
 * @param {number} count Firestore count 值。
 * @returns {{ data: () => { count: number } }} 模擬的 count snapshot。
 */
function createCountSnapshot(count) {
  return {
    data: () => ({ count }),
  };
}

/**
 * @param {string} id 文件 id。
 * @param {Record<string, unknown>} data 文件資料。
 * @returns {import('firebase/firestore').QueryDocumentSnapshot} 模擬的 query 文件快照。
 */
function createQueryDocumentSnapshot(id, data) {
  return /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (
    /** @type {unknown} */ ({
      id,
      data: () => data,
      ref: { id, path: `events/${id}` },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  mockDoc.mockImplementation((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
  }));
  mockCollection.mockImplementation((_db, path) => ({
    type: 'collection',
    path,
  }));
  mockCollectionGroup.mockImplementation((_db, path) => ({
    type: 'collectionGroup',
    path,
  }));
  mockWhere.mockImplementation((field, op, value) => ({
    type: 'where',
    field,
    op,
    value,
  }));
  mockOrderBy.mockImplementation((field, direction) => ({
    type: 'orderBy',
    field,
    direction,
  }));
  mockLimit.mockImplementation((value) => ({
    type: 'limit',
    value,
  }));
  mockStartAfter.mockImplementation((doc) => ({
    type: 'startAfter',
    doc,
  }));
  mockQuery.mockImplementation((target, ...constraints) => ({
    target,
    constraints,
  }));
  mockSetDoc.mockResolvedValue(undefined);
});

describe('profile-service', () => {
  it('getUserProfile 走真實 repo + mapper，回傳正規化 PublicProfile', async () => {
    mockGetDoc.mockResolvedValue(
      createDocSnapshot(true, {
        name: 'Amy',
        photoURL: 'https://img',
        bio: 'runner',
        createdAt: { kind: 'timestamp' },
        email: 'amy@example.com',
      }),
    );

    await expect(getUserProfile('u1')).resolves.toEqual({
      uid: 'u1',
      name: 'Amy',
      photoURL: 'https://img',
      bio: 'runner',
      createdAt: { kind: 'timestamp' },
    });

    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'u1');
    expect(mockGetDoc).toHaveBeenCalledWith({ type: 'doc', path: 'users/u1' });
  });

  it('getProfileStats 走 Firestore count 邊界，不 mock 內部 repo', async () => {
    mockGetCountFromServer
      .mockResolvedValueOnce(createCountSnapshot(2))
      .mockResolvedValueOnce(createCountSnapshot(7));

    await expect(getProfileStats('u1')).resolves.toEqual({
      hostedCount: 2,
      joinedCount: 7,
      totalDistanceKm: null,
    });

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'events');
    expect(mockCollectionGroup).toHaveBeenCalledWith('mock-db', 'participants');
    expect(mockWhere).toHaveBeenNthCalledWith(1, 'hostUid', '==', 'u1');
    expect(mockWhere).toHaveBeenNthCalledWith(2, 'uid', '==', 'u1');
    expect(mockGetCountFromServer).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        target: { type: 'collection', path: 'events' },
      }),
    );
    expect(mockGetCountFromServer).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: { type: 'collectionGroup', path: 'participants' },
      }),
    );
  });

  it('getHostedEvents 走真實 service/repo，透過 limit(pageSize + 1) 判斷 hasMore', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        createQueryDocumentSnapshot('e1', { time: { seconds: 20 }, title: 'A' }),
        createQueryDocumentSnapshot('e2', { time: { seconds: 10 }, title: 'B' }),
        createQueryDocumentSnapshot('e3', { time: { seconds: 5 }, title: 'C' }),
      ],
    });

    await expect(getHostedEvents('u1', { pageSize: 2 })).resolves.toEqual({
      items: [
        { id: 'e1', time: { seconds: 20 }, title: 'A' },
        { id: 'e2', time: { seconds: 10 }, title: 'B' },
      ],
      lastDoc: expect.objectContaining({
        id: 'e2',
        data: expect.any(Function),
      }),
      hasMore: true,
    });

    expect(mockLimit).toHaveBeenCalledWith(3);
    expect(mockStartAfter).not.toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalledWith('time', 'desc');
    expect(mockGetDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { type: 'collection', path: 'events' },
      }),
    );
  });

  it('updateUserBio trim 後透過 setDoc merge 寫入 repo 邊界', async () => {
    await updateUserBio('u1', '  hello  ');

    expect(mockSetDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'users/u1' },
      { bio: 'hello' },
      { merge: true },
    );
  });
});
