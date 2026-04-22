/**
 * @file Unit tests for firebase-profile.js (client-side service layer).
 * @description
 * TDD RED phase — tests target functions that do NOT exist yet.
 * Covers public profile service contract per
 * `specs/012-public-profile/contracts/firebase-profile-api.md`.
 *
 * Functions under test:
 * - getUserProfile(uid)        — read users/{uid}, exclude email field
 * - getProfileStats(uid)       — parallel queries for hosted/joined/distance stats
 * - getHostedEvents(uid, opts) — paginated query for events hosted by uid
 * - updateUserBio(uid, bio)    — write bio with 150-char validation
 *
 * Rules:
 * 1. AAA Pattern (Arrange, Act, Assert).
 * 2. F.I.R.S.T principles — 100% isolated with vi.mock (no real Firebase).
 * 3. Never test mock behaviour — assert real function output.
 * 4. Mocked imports use typed alias of `import('vitest').Mock` to satisfy checkJs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — replace firebase/firestore + firebase-client
// ---------------------------------------------------------------------------

/** @type {import('vitest').Mock} */
const mockDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockCollection = vi.fn();
/** @type {import('vitest').Mock} */
const mockCollectionGroup = vi.fn();
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
const mockGetDoc = vi.fn();
/** @type {import('vitest').Mock} */
const mockGetDocs = vi.fn();
/** @type {import('vitest').Mock} */
const mockGetCountFromServer = vi.fn();
/** @type {import('vitest').Mock} */
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  getCountFromServer: mockGetCountFromServer,
  setDoc: mockSetDoc,
}));

vi.mock('@/config/client/firebase-client', () => ({
  db: 'mock-db',
}));

// ---------------------------------------------------------------------------
// Helpers — fabricate Firestore snapshot shapes
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MockProfileFields
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} email - Email（必須被服務層排除）。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介。
 * @property {{ seconds: number }} createdAt - 建立時間 timestamp 物件。
 */

/**
 * Build a mock DocumentSnapshot for getDoc().
 * @param {string} id - Document ID。
 * @param {Record<string, unknown> | undefined} data - Document data fields。
 * @param {boolean} [exists] - 是否存在，預設 true。
 * @returns {object} Mock DocumentSnapshot。
 */
function makeDocSnap(id, data, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => (exists ? data : undefined),
  };
}

/**
 * Build a mock QueryDocumentSnapshot returned inside getDocs().
 * @param {string} id - Document ID。
 * @param {Record<string, unknown>} data - Document data fields。
 * @returns {object} Mock QueryDocumentSnapshot。
 */
function makeQueryDocSnap(id, data) {
  return {
    id,
    exists: () => true,
    data: () => data,
    ref: { id },
  };
}

/**
 * Build a mock count snapshot for getCountFromServer().
 * @param {number} count - 數量。
 * @returns {{ data: () => { count: number } }} Mock count snapshot。
 */
function makeCountSnap(count) {
  return {
    data: () => ({ count }),
  };
}

// ---------------------------------------------------------------------------
// getUserProfile(uid)
// ---------------------------------------------------------------------------

describe('Unit: getUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應該回傳 PublicProfile 物件並排除 email 欄位', async () => {
    // Arrange
    const fields = {
      uid: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      photoURL: 'https://example.com/alice.jpg',
      bio: '熱愛跑步的工程師',
      createdAt: { seconds: 1700000000, nanoseconds: 0 },
    };
    mockGetDoc.mockResolvedValueOnce(makeDocSnap('user-1', fields));

    // Act
    const { getUserProfile } = await import('@/lib/firebase-profile');
    const result = await getUserProfile('user-1');

    // Assert
    expect(result).toEqual({
      uid: 'user-1',
      name: 'Alice',
      photoURL: 'https://example.com/alice.jpg',
      bio: '熱愛跑步的工程師',
      createdAt: fields.createdAt,
    });
    expect(result).not.toHaveProperty('email');
  });

  it('當文件不存在時應該回傳 null', async () => {
    // Arrange
    mockGetDoc.mockResolvedValueOnce(makeDocSnap('missing', undefined, false));

    // Act
    const { getUserProfile } = await import('@/lib/firebase-profile');
    const result = await getUserProfile('missing');

    // Assert
    expect(result).toBeNull();
  });

  it('當 bio 欄位不存在時 result.bio 應為 undefined（仍是 PublicProfile）', async () => {
    // Arrange — 沒有 bio 欄位的 user 文件
    const fields = {
      uid: 'user-2',
      name: 'Bob',
      email: 'bob@example.com',
      photoURL: '',
      createdAt: { seconds: 1700000000, nanoseconds: 0 },
    };
    mockGetDoc.mockResolvedValueOnce(makeDocSnap('user-2', fields));

    // Act
    const { getUserProfile } = await import('@/lib/firebase-profile');
    const result = await getUserProfile('user-2');

    // Assert
    expect(result).not.toBeNull();
    expect(result?.uid).toBe('user-2');
    expect(result?.bio).toBeUndefined();
    expect(result).not.toHaveProperty('email');
  });

  it('當 uid 為空字串時應拋出 Error', async () => {
    // Act + Assert
    const { getUserProfile } = await import('@/lib/firebase-profile');
    await expect(getUserProfile('')).rejects.toThrow('uid is required');
  });

  it('應該透過 doc(db, "users", uid) 取得文件參照', async () => {
    // Arrange
    mockGetDoc.mockResolvedValueOnce(makeDocSnap('missing', undefined, false));

    // Act
    const { getUserProfile } = await import('@/lib/firebase-profile');
    await getUserProfile('user-x');

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'user-x');
  });
});

// ---------------------------------------------------------------------------
// getProfileStats(uid)
// ---------------------------------------------------------------------------

describe('Unit: getProfileStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應使用 events where hostUid==uid 計算 hostedCount', async () => {
    // Arrange
    mockGetCountFromServer
      .mockResolvedValueOnce(makeCountSnap(0))
      .mockResolvedValueOnce(makeCountSnap(0));

    // Act
    const { getProfileStats } = await import('@/lib/firebase-profile');
    await getProfileStats('user-1');

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'events');
    expect(mockWhere).toHaveBeenCalledWith('hostUid', '==', 'user-1');
  });

  it('應使用 collectionGroup("participants") where uid==uid 計算 joinedCount', async () => {
    // Arrange
    mockGetCountFromServer
      .mockResolvedValueOnce(makeCountSnap(0))
      .mockResolvedValueOnce(makeCountSnap(0));

    // Act
    const { getProfileStats } = await import('@/lib/firebase-profile');
    await getProfileStats('user-1');

    // Assert
    expect(mockCollectionGroup).toHaveBeenCalledWith('mock-db', 'participants');
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'user-1');
  });

  it('totalDistanceKm 永遠為 null 且不觸及 Strava collections (Strava 公開展示未實作)', async () => {
    // Arrange — hosted=3, joined=7；Strava mocks 刻意不設，若 code 嘗試查
    // stravaConnections 或 stravaActivities 就會拿到 undefined 並炸掉。
    mockGetCountFromServer
      .mockResolvedValueOnce(makeCountSnap(3))
      .mockResolvedValueOnce(makeCountSnap(7));

    // Act
    const { getProfileStats } = await import('@/lib/firebase-profile');
    const result = await getProfileStats('user-1');

    // Assert
    expect(result).toEqual({
      hostedCount: 3,
      joinedCount: 7,
      totalDistanceKm: null,
    });
    expect(mockCollection).not.toHaveBeenCalledWith('mock-db', 'stravaActivities');
    // 原本 fetchTotalDistanceKm 透過 doc(db,'stravaConnections',uid) 讀，
    // 現在整條 code path 已移除，doc() 在本函式內不應再被呼叫。
    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('當 uid 為空字串時應拋出 Error', async () => {
    // Act + Assert
    const { getProfileStats } = await import('@/lib/firebase-profile');
    await expect(getProfileStats('')).rejects.toThrow('uid is required');
  });
});

// ---------------------------------------------------------------------------
// getHostedEvents(uid, options?)
// ---------------------------------------------------------------------------

describe('Unit: getHostedEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('預設 pageSize=5，hasMore=false 時 items 應為實際筆數', async () => {
    // Arrange — 回傳 3 筆（< pageSize+1 = 6 → hasMore=false）
    const docs = [
      makeQueryDocSnap('e1', { hostUid: 'u1', title: 'Event 1' }),
      makeQueryDocSnap('e2', { hostUid: 'u1', title: 'Event 2' }),
      makeQueryDocSnap('e3', { hostUid: 'u1', title: 'Event 3' }),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    const result = await getHostedEvents('u1');

    // Assert
    expect(result.items).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.lastDoc).toBe(docs[2]);
    // limit 應為 pageSize+1
    expect(mockLimit).toHaveBeenCalledWith(6);
  });

  it('當回傳筆數 > pageSize 時 hasMore=true 且 items 只取前 pageSize 筆', async () => {
    // Arrange — pageSize=5，回傳 6 筆（pageSize+1）
    const docs = Array.from({ length: 6 }, (_, i) =>
      makeQueryDocSnap(`e${i}`, { hostUid: 'u1', title: `E${i}` }),
    );
    mockGetDocs.mockResolvedValueOnce({ docs });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    const result = await getHostedEvents('u1', { pageSize: 5 });

    // Assert
    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(true);
    // lastDoc 應為截斷後的最後一筆（第 5 筆 index=4），不是第 6 筆
    expect(result.lastDoc).toBe(docs[4]);
  });

  it('items 每筆應包含 id 並展開 data() 內容', async () => {
    // Arrange
    const docs = [
      makeQueryDocSnap('event-A', {
        hostUid: 'u1',
        title: 'Morning Run',
        city: '台北市',
        distanceKm: 5,
      }),
    ];
    mockGetDocs.mockResolvedValueOnce({ docs });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    const result = await getHostedEvents('u1');

    // Assert
    expect(result.items[0]).toEqual({
      id: 'event-A',
      hostUid: 'u1',
      title: 'Morning Run',
      city: '台北市',
      distanceKm: 5,
    });
  });

  it('當查無資料時應回傳 { items: [], lastDoc: null, hasMore: false }', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    const result = await getHostedEvents('u1');

    // Assert
    expect(result).toEqual({
      items: [],
      lastDoc: null,
      hasMore: false,
    });
  });

  it('應使用 events where hostUid==uid 並 orderBy time desc', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    await getHostedEvents('u1');

    // Assert
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'events');
    expect(mockWhere).toHaveBeenCalledWith('hostUid', '==', 'u1');
    expect(mockOrderBy).toHaveBeenCalledWith('time', 'desc');
  });

  it('當提供 options.lastDoc 時應使用 startAfter cursor', async () => {
    // Arrange
    const cursor = makeQueryDocSnap('prev-last', { hostUid: 'u1' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    await getHostedEvents('u1', { lastDoc: cursor });

    // Assert
    expect(mockStartAfter).toHaveBeenCalledWith(cursor);
  });

  it('未提供 lastDoc 時不應呼叫 startAfter', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    await getHostedEvents('u1');

    // Assert
    expect(mockStartAfter).not.toHaveBeenCalled();
  });

  it('支援自訂 pageSize 並對應 limit(pageSize+1)', async () => {
    // Arrange
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    // Act
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    await getHostedEvents('u1', { pageSize: 10 });

    // Assert
    expect(mockLimit).toHaveBeenCalledWith(11);
  });

  it('當 uid 為空字串時應拋出 Error', async () => {
    // Act + Assert
    const { getHostedEvents } = await import('@/lib/firebase-profile');
    await expect(getHostedEvents('')).rejects.toThrow('uid is required');
  });
});

// ---------------------------------------------------------------------------
// updateUserBio(uid, bio)
// ---------------------------------------------------------------------------

describe('Unit: updateUserBio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('合法 bio (≤150 字) 應呼叫 setDoc 並 merge:true', async () => {
    // Arrange
    mockSetDoc.mockResolvedValueOnce(undefined);
    const bio = '熱愛跑步的工程師，每週至少跑 30 公里';

    // Act
    const { updateUserBio } = await import('@/lib/firebase-profile');
    await updateUserBio('user-1', bio);

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'user-1');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const setDocArgs = mockSetDoc.mock.calls[0];
    expect(setDocArgs[1]).toEqual({ bio });
    expect(setDocArgs[2]).toEqual({ merge: true });
  });

  it('應 trim bio 後再寫入 Firestore', async () => {
    // Arrange
    mockSetDoc.mockResolvedValueOnce(undefined);
    const bioWithSpaces = '   有空白的簡介   ';

    // Act
    const { updateUserBio } = await import('@/lib/firebase-profile');
    await updateUserBio('user-1', bioWithSpaces);

    // Assert
    const setDocArgs = mockSetDoc.mock.calls[0];
    expect(setDocArgs[1]).toEqual({ bio: '有空白的簡介' });
  });

  it('剛好 150 字應該成功寫入', async () => {
    // Arrange
    mockSetDoc.mockResolvedValueOnce(undefined);
    const bio = 'A'.repeat(150);

    // Act
    const { updateUserBio } = await import('@/lib/firebase-profile');
    await updateUserBio('user-1', bio);

    // Assert
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('超過 150 字應拋出 Error 且不呼叫 setDoc', async () => {
    // Arrange
    const tooLong = 'A'.repeat(151);

    // Act + Assert
    const { updateUserBio } = await import('@/lib/firebase-profile');
    await expect(updateUserBio('user-1', tooLong)).rejects.toThrow('簡介不得超過 150 字');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('uid 為空字串時應拋出 Error', async () => {
    // Act + Assert
    const { updateUserBio } = await import('@/lib/firebase-profile');
    await expect(updateUserBio('', '正常 bio')).rejects.toThrow('uid is required');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('空字串 bio 應允許（清除既有簡介）', async () => {
    // Arrange
    mockSetDoc.mockResolvedValueOnce(undefined);

    // Act
    const { updateUserBio } = await import('@/lib/firebase-profile');
    await updateUserBio('user-1', '');

    // Assert — 空字串應寫入（trim 後仍為空，視為清除）
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][1]).toEqual({ bio: '' });
  });
});
