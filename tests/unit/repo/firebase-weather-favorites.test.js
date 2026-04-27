import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  isFavorited,
} from '@/repo/client/firebase-weather-favorites-repo';

// #region Mocks
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('@/config/client/firebase-client', () => ({
  db: {},
}));

const mockedAddDoc = /** @type {import('vitest').Mock} */ (addDoc);
const mockedDeleteDoc = /** @type {import('vitest').Mock} */ (deleteDoc);
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedQuery = /** @type {import('vitest').Mock} */ (query);
const mockedCollection = /** @type {import('vitest').Mock} */ (collection);
const mockedDoc = /** @type {import('vitest').Mock} */ (doc);
const mockedWhere = /** @type {import('vitest').Mock} */ (where);
const mockedOrderBy = /** @type {import('vitest').Mock} */ (orderBy);
// #endregion

// #region Helpers
/**
 * 建立 mock QuerySnapshot。
 * @param {Array<{id: string, data: object}>} docs - 文件陣列。
 * @returns {{ empty: boolean, docs: Array<{id: string, data: () => object}> }} mock snapshot。
 */
function mockSnapshot(docs) {
  return {
    empty: docs.length === 0,
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
  };
}

const sampleLocation = {
  countyCode: '65000',
  countyName: '新北市',
  townshipCode: '65000010',
  townshipName: '板橋區',
  displaySuffix: null,
};
// #endregion

describe('firebase-weather-favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCollection.mockReturnValue('collectionRef');
    mockedQuery.mockReturnValue('queryRef');
    mockedDoc.mockReturnValue('docRef');
    mockedWhere.mockReturnValue('whereClause');
    mockedOrderBy.mockReturnValue('orderByClause');
  });

  // --- addFavorite ---
  describe('addFavorite', () => {
    it('should add a new favorite when not duplicated', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(mockSnapshot([]));
      mockedAddDoc.mockResolvedValueOnce({ id: 'newDoc123' });

      // Act
      const docId = await addFavorite('user1', sampleLocation);

      // Assert
      expect(docId).toBe('newDoc123');
      expect(mockedAddDoc).toHaveBeenCalledTimes(1);
      expect(mockedAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          countyCode: '65000',
          countyName: '新北市',
          townshipCode: '65000010',
          townshipName: '板橋區',
        }),
      );
    });

    it('should return existing doc id when duplicate (no-op)', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(
        mockSnapshot([{ id: 'existingDoc456', data: sampleLocation }]),
      );

      // Act
      const docId = await addFavorite('user1', sampleLocation);

      // Assert
      expect(docId).toBe('existingDoc456');
      expect(mockedAddDoc).not.toHaveBeenCalled();
    });

    it('should include displaySuffix in addDoc payload', async () => {
      // Arrange
      const locationWithSuffix = {
        ...sampleLocation,
        countyCode: '10002',
        countyName: '宜蘭縣',
        townshipCode: '10002080',
        townshipName: '頭城鎮',
        displaySuffix: '（含龜山島）',
      };
      mockedGetDocs.mockResolvedValueOnce(mockSnapshot([]));
      mockedAddDoc.mockResolvedValueOnce({ id: 'newDoc789' });

      // Act
      await addFavorite('user1', locationWithSuffix);

      // Assert
      expect(mockedAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          displaySuffix: '（含龜山島）',
        }),
      );
    });
  });

  // --- removeFavorite ---
  describe('removeFavorite', () => {
    it('should delete the document with correct path', async () => {
      // Arrange
      mockedDeleteDoc.mockResolvedValueOnce(undefined);

      // Act
      await removeFavorite('user1', 'docToRemove');

      // Assert
      expect(mockedDoc).toHaveBeenCalled();
      expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  // --- getFavorites ---
  describe('getFavorites', () => {
    it('should return formatted array of favorites', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(
        mockSnapshot([
          { id: 'fav1', data: { ...sampleLocation, createdAt: { toDate: () => new Date() } } },
          {
            id: 'fav2',
            data: {
              countyCode: '63000',
              countyName: '臺北市',
              townshipCode: null,
              townshipName: null,
              displaySuffix: null,
              createdAt: { toDate: () => new Date() },
            },
          },
        ]),
      );

      // Act
      const favorites = await getFavorites('user1');

      // Assert
      expect(favorites).toHaveLength(2);
      expect(favorites[0].id).toBe('fav1');
      expect(favorites[0].countyName).toBe('新北市');
      expect(favorites[1].id).toBe('fav2');
      expect(favorites[1].countyName).toBe('臺北市');
    });

    it('should return empty array when no favorites exist', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(mockSnapshot([]));

      // Act
      const favorites = await getFavorites('user1');

      // Assert
      expect(favorites).toEqual([]);
    });

    it('should query with orderBy createdAt desc', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(mockSnapshot([]));

      // Act
      await getFavorites('user1');

      // Assert
      expect(mockedOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });

  // --- isFavorited ---
  describe('isFavorited', () => {
    it('should return favorited true with docId when match found', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(mockSnapshot([{ id: 'matchDoc', data: sampleLocation }]));

      // Act
      const result = await isFavorited('user1', '65000', '65000010');

      // Assert
      expect(result).toEqual({ favorited: true, docId: 'matchDoc' });
    });

    it('should return favorited false with null docId when no match', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(mockSnapshot([]));

      // Act
      const result = await isFavorited('user1', '65000', '65000010');

      // Assert
      expect(result).toEqual({ favorited: false, docId: null });
    });

    it('should handle county-only query (townshipCode null)', async () => {
      // Arrange
      mockedGetDocs.mockResolvedValueOnce(mockSnapshot([]));

      // Act
      await isFavorited('user1', '63000', null);

      // Assert
      expect(mockedWhere).toHaveBeenCalledWith('countyCode', '==', '63000');
      expect(mockedWhere).toHaveBeenCalledWith('townshipCode', '==', null);
    });
  });
});
