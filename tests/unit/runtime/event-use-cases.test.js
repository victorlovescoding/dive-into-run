import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteEvent,
  EVENT_STARTED_LOCK_METADATA,
  updateEvent,
} from '@/runtime/client/use-cases/event-use-cases';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn((...path) => ({ path })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  startAfter: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
  where: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

/**
 * 建立 event document snapshot fixture。
 * @param {object} data - Firestore event data。
 * @returns {{ exists: () => boolean, data: () => object }} Snapshot-like fixture。
 */
function snapshot(data) {
  return { exists: () => true, data: () => data };
}

/**
 * 建立 Timestamp-like fixture。
 * @param {string} iso - ISO timestamp 字串。
 * @returns {{ toDate: () => Date }} Timestamp-like value。
 */
function timestampLike(iso) {
  return { toDate: () => new Date(iso) };
}

/**
 * 讓 Firestore transaction mock 執行真實 repo callback。
 * @param {object} eventData - Transaction 讀到的 event data。
 * @returns {import('vitest').Mock} tx.update mock。
 */
function mockDeleteTransaction(eventData) {
  const update = vi.fn();
  firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) =>
    callback({
      get: vi.fn().mockResolvedValue(snapshot(eventData)),
      update,
    }),
  );
  return update;
}

/**
 * 讓 Firestore update transaction mock 執行真實 repo callback。
 * @param {object} eventData - Transaction 讀到的 event data。
 * @param {unknown} [updateError] - tx.update 要丟出的錯誤。
 * @returns {import('vitest').Mock} tx.update mock。
 */
function mockUpdateTransaction(eventData, updateError) {
  const update = vi.fn(() => {
    if (updateError) throw updateError;
  });
  firestoreMocks.runTransaction.mockImplementationOnce(async (_db, callback) =>
    callback({
      get: vi.fn().mockResolvedValue(snapshot(eventData)),
      update,
    }),
  );
  return update;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T10:00:00.000Z'));
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('updateEvent started-lock use-case mapping', () => {
  it('returns started-lock metadata for a host updating an already-started event before update', async () => {
    const update = mockUpdateTransaction({
      hostUid: 'host-1',
      time: timestampLike('2026-07-01T10:00:00.000Z'),
    });

    await expect(
      updateEvent('event-1', { title: 'New title' }, { uid: 'host-1' }),
    ).resolves.toEqual({
      ok: false,
      startedLock: EVENT_STARTED_LOCK_METADATA,
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('keeps permission rejection ahead of started-lock rejection for non-host updates', async () => {
    const update = mockUpdateTransaction({
      hostUid: 'host-1',
      time: timestampLike('2026-07-01T09:59:59.999Z'),
    });

    await expect(
      updateEvent('event-1', { title: 'New title' }, { uid: 'runner-1' }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'permission-denied',
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('does not guess started-lock metadata for missing actors on started updates', async () => {
    const permissionError = Object.assign(new Error('permission-denied'), {
      code: 'permission-denied',
    });
    const update = mockUpdateTransaction(
      {
        hostUid: 'host-1',
        time: timestampLike('2026-07-01T09:59:59.999Z'),
      },
      permissionError,
    );

    await expect(updateEvent('event-1', { title: 'New title' })).rejects.toBe(permissionError);

    expect(update).toHaveBeenCalled();
  });
});

describe('deleteEvent started-lock use-case mapping', () => {
  it('returns started-lock metadata for a host deleting an already-started event before soft delete', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot({ hostUid: 'host-1', time: timestampLike('2026-07-01T10:00:00.000Z') }),
    );

    await expect(deleteEvent('event-1', { uid: 'host-1' })).resolves.toEqual({
      ok: false,
      startedLock: EVENT_STARTED_LOCK_METADATA,
    });

    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it('delegates to the delete repo and preserves success before event start', async () => {
    const eventData = {
      hostUid: 'host-1',
      time: timestampLike('2026-07-01T10:00:00.001Z'),
    };
    firestoreMocks.getDoc.mockResolvedValueOnce(snapshot(eventData));
    const update = mockDeleteTransaction(eventData);

    await expect(deleteEvent('event-1', { uid: 'host-1' })).resolves.toMatchObject(
      {
        ok: true,
        status: 'deleted',
        startedLock: null,
      },
    );

    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: expect.arrayContaining(['events', 'event-1']) }),
      expect.objectContaining({ deletedByUid: 'host-1' }),
    );
  });

  it('keeps permission rejection ahead of started-lock rejection for non-host deletes', async () => {
    const eventData = {
      hostUid: 'host-1',
      time: timestampLike('2026-07-01T09:59:59.999Z'),
    };
    firestoreMocks.getDoc.mockResolvedValueOnce(snapshot(eventData));
    const update = mockDeleteTransaction(eventData);

    await expect(deleteEvent('event-1', { uid: 'runner-1' })).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'permission-denied',
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('does not guess started-lock metadata for missing actors on started deletes', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot({ hostUid: 'host-1', time: timestampLike('2026-07-01T09:59:59.999Z') }),
    );

    await expect(deleteEvent('event-1')).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'permission-denied',
    });

    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it('does not classify unrelated delete errors as started-lock metadata', async () => {
    const unrelatedError = new Error('network unavailable');
    firestoreMocks.getDoc.mockResolvedValueOnce(
      snapshot({ hostUid: 'host-1', time: timestampLike('2026-07-01T10:00:00.001Z') }),
    );
    firestoreMocks.runTransaction.mockRejectedValueOnce(unrelatedError);

    await expect(deleteEvent('event-1', { uid: 'host-1' })).rejects.toBe(unrelatedError);
  });
});
