/**
 * @file Unit Test for updateEvent and deleteEvent (firebase-events.js)
 * @description
 * TDD RED phase — tests for event edit/delete functions that do NOT exist yet.
 * Covers: FR-008, FR-009, FR-011, FR-012, FR-013, FR-015.
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. AAA Pattern (Arrange, Act, Assert) is mandatory.
 * 3. NO `console.log`.
 * 4. STRICT JSDoc is required.
 * 5. Mock Firebase at the correct level — preserve behavior tests depend on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/firestore at module level
vi.mock('firebase/firestore', () => {
  const mockDoc = vi.fn();
  const mockCollection = vi.fn();
  const mockUpdateDoc = vi.fn();
  const mockDeleteDoc = vi.fn();
  const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
  const mockRunTransaction = vi.fn().mockImplementation(async (_, callback) => {
    const mockTx = {
      get: vi.fn().mockResolvedValue(
        /** @type {import('firebase/firestore').DocumentSnapshot} */ (
          /** @type {unknown} */ ({
            exists: () => true,
            data: () => ({ participantsCount: 8, maxParticipants: 10, remainingSeats: 2 }),
          })
        ),
      ),
      update: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    return callback(mockTx);
  });
  const mockGetDoc = vi.fn().mockResolvedValue(
    /** @type {import('firebase/firestore').DocumentSnapshot} */ (
      /** @type {unknown} */ ({
        exists: () => true,
        data: () => ({ participantsCount: 0, maxParticipants: 10, remainingSeats: 10 }),
      })
    ),
  );
  const mockQuery = vi.fn();
  const mockWriteBatch = vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }));

  return {
    doc: mockDoc,
    collection: mockCollection,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    getDocs: mockGetDocs,
    getDoc: mockGetDoc,
    runTransaction: mockRunTransaction,
    query: mockQuery,
    writeBatch: mockWriteBatch,
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    where: vi.fn(),
    addDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    Timestamp: {
      fromDate: vi.fn((d) => ({
        seconds: Math.floor(d.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => d,
      })),
    },
  };
});

vi.mock('@/lib/firebase-client', () => ({
  db: 'mock-db',
}));

/**
 * @typedef {object} MockEventData
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {string} hostUid - 主揪 UID。
 * @property {number} maxParticipants - 人數上限。
 * @property {number} participantsCount - 目前參加人數。
 * @property {number} remainingSeats - 剩餘名額。
 * @property {number} distanceKm - 距離（公里）。
 * @property {number} paceSec - 配速秒數。
 * @property {string} city - 縣市。
 * @property {string} district - 區域。
 */

describe('Unit: updateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update event fields in Firestore and return updated data', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');
    const eventId = 'event-123';
    const updatedFields = {
      title: '更新後的活動標題',
      distanceKm: 15,
      description: '更新後的活動說明',
    };

    // Act
    const result = await updateEvent(eventId, updatedFields);

    // Assert
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
  });

  it('should throw error when eventId is missing', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');

    // Act & Assert
    await expect(updateEvent('', { title: 'test' })).rejects.toThrow();
  });

  it('should throw error when updatedFields is empty or not an object', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');

    // Act & Assert
    await expect(updateEvent('event-123', null)).rejects.toThrow();
  });

  it('should reject maxParticipants lower than current participantsCount (FR-015)', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');
    const eventId = 'event-123';

    // 目前已有 8 人報名，嘗試設為 5 人上限 → 應被拒絕
    const updatedFields = {
      maxParticipants: 5,
    };

    // Act & Assert
    // updateEvent 內部應讀取目前 participantsCount 並拒絕此更新
    await expect(updateEvent(eventId, updatedFields)).rejects.toThrow(/人數上限/);
  });

  it('should allow maxParticipants equal to current participantsCount', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');
    const eventId = 'event-123';

    // 目前已有 8 人報名，設為 8 人上限 → 應允許
    const updatedFields = {
      maxParticipants: 8,
    };

    // Act
    const result = await updateEvent(eventId, updatedFields);

    // Assert
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
  });

  it('should recalculate remainingSeats when maxParticipants is updated', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');
    const { runTransaction } = await import('firebase/firestore');

    const mockUpdate = vi.fn();
    vi.mocked(runTransaction).mockImplementationOnce(async (_, callback) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue(
          /** @type {import('firebase/firestore').DocumentSnapshot} */ (
            /** @type {unknown} */ ({
              exists: () => true,
              data: () => ({ participantsCount: 8, maxParticipants: 10, remainingSeats: 2 }),
            })
          ),
        ),
        update: mockUpdate,
        set: vi.fn(),
        delete: vi.fn(),
      };
      return callback(mockTx);
    });

    const eventId = 'event-123';

    // 目前 8 人報名，改上限為 12 → remainingSeats 應為 4
    const updatedFields = { maxParticipants: 12 };

    // Act
    const result = await updateEvent(eventId, updatedFields);

    // Assert
    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][1]).toEqual(
      expect.objectContaining({ remainingSeats: 4, maxParticipants: 12 }),
    );
  });

  it('should convert string timestamps to Firestore Timestamps', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');
    const { runTransaction, Timestamp } = await import('firebase/firestore');

    const mockUpdate = vi.fn();
    vi.mocked(runTransaction).mockImplementationOnce(async (_, callback) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue(
          /** @type {import('firebase/firestore').DocumentSnapshot} */ (
            /** @type {unknown} */ ({
              exists: () => true,
              data: () => ({
                participantsCount: 0,
                maxParticipants: 10,
                remainingSeats: 10,
                time: { toDate: () => new Date('2026-05-01T10:00') },
                registrationDeadline: { toDate: () => new Date('2026-04-25T10:00') },
              }),
            })
          ),
        ),
        update: mockUpdate,
        set: vi.fn(),
        delete: vi.fn(),
      };
      return callback(mockTx);
    });

    // Act — time 早於 existing registrationDeadline 會觸發驗證錯誤，所以一起傳
    const result = await updateEvent('event-123', {
      time: '2026-04-01T08:00',
      registrationDeadline: '2026-03-31T08:00',
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(Timestamp.fromDate).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        time: expect.objectContaining({ seconds: expect.any(Number) }),
      }),
    );
  });

  it('should handle update failure gracefully', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');
    const { runTransaction } = await import('firebase/firestore');

    vi.mocked(runTransaction).mockRejectedValueOnce(new Error('Firestore write failed'));

    const eventId = 'event-123';
    const updatedFields = { title: 'new title' };

    // Act & Assert
    await expect(updateEvent(eventId, updatedFields)).rejects.toThrow();
  });

  it('should throw error when event does not exist', async () => {
    // Arrange
    const { updateEvent } = await import('@/lib/firebase-events');
    const { runTransaction } = await import('firebase/firestore');

    vi.mocked(runTransaction).mockImplementationOnce(async (_, callback) => {
      const mockTx = {
        get: vi
          .fn()
          .mockResolvedValue(
            /** @type {import('firebase/firestore').DocumentSnapshot} */ (
              /** @type {unknown} */ ({ exists: () => false })
            ),
          ),
        update: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };
      return callback(mockTx);
    });

    const eventId = 'non-existent-event';
    const updatedFields = { title: 'test' };

    // Act & Assert
    await expect(updateEvent(eventId, updatedFields)).rejects.toThrow();
  });
});

describe('Unit: deleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete the event document from Firestore', async () => {
    // Arrange
    const { deleteEvent } = await import('@/lib/firebase-events');
    const eventId = 'event-to-delete';

    // Act
    const result = await deleteEvent(eventId);

    // Assert
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
  });

  it('should also delete all participants in the subcollection (FR-011)', async () => {
    // Arrange
    const { deleteEvent } = await import('@/lib/firebase-events');
    const { getDocs, writeBatch } = await import('firebase/firestore');

    // 模擬 participants 子集合有 3 筆資料
    vi.mocked(getDocs).mockResolvedValueOnce(
      /** @type {import('firebase/firestore').QuerySnapshot} */ (
        /** @type {unknown} */ ({
          docs: [
            { ref: { id: 'p1', path: 'events/e/participants/p1' } },
            { ref: { id: 'p2', path: 'events/e/participants/p2' } },
            { ref: { id: 'p3', path: 'events/e/participants/p3' } },
          ],
        })
      ),
    );

    const eventId = 'event-with-participants';

    // Act
    const result = await deleteEvent(eventId);

    // Assert
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);

    // writeBatch 應被呼叫一次，batch.delete 應呼叫 4 次（3 participants + 1 event）
    expect(vi.mocked(writeBatch)).toHaveBeenCalledTimes(1);
    const batch = vi.mocked(writeBatch).mock.results[0].value;
    expect(batch.delete).toHaveBeenCalledTimes(4);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('should throw error when eventId is missing', async () => {
    // Arrange
    const { deleteEvent } = await import('@/lib/firebase-events');

    // Act & Assert
    await expect(deleteEvent('')).rejects.toThrow();
  });

  it('should throw error when event does not exist', async () => {
    // Arrange
    const { deleteEvent } = await import('@/lib/firebase-events');
    const { getDoc } = await import('firebase/firestore');

    // @ts-expect-error — partial DocumentSnapshot mock: only exists() needed
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false });

    const eventId = 'non-existent-event';

    // Act & Assert
    await expect(deleteEvent(eventId)).rejects.toThrow();
  });

  it('should handle delete failure gracefully', async () => {
    // Arrange
    const { deleteEvent } = await import('@/lib/firebase-events');
    const { writeBatch } = await import('firebase/firestore');

    vi.mocked(writeBatch).mockReturnValueOnce(
      /** @type {import('firebase/firestore').WriteBatch} */ (
        /** @type {unknown} */ ({
          delete: vi.fn(),
          commit: vi.fn().mockRejectedValueOnce(new Error('Batch commit failed')),
        })
      ),
    );

    const eventId = 'event-123';

    // Act & Assert
    await expect(deleteEvent(eventId)).rejects.toThrow();
  });

  it('should succeed even when event has no participants', async () => {
    // Arrange
    const { deleteEvent } = await import('@/lib/firebase-events');
    const { getDocs, writeBatch } = await import('firebase/firestore');

    // @ts-expect-error — partial QuerySnapshot mock: only `docs` needed
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] });

    const eventId = 'event-no-participants';

    // Act
    const result = await deleteEvent(eventId);

    // Assert
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);

    // 只刪 event 本身，batch.delete 應呼叫 1 次
    const batch = vi.mocked(writeBatch).mock.results[0].value;
    expect(batch.delete).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
