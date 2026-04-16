/**
 * @file Unit test for EVENT_NOT_FOUND_MESSAGE constant (firebase-events.js)
 * @description
 * TDD RED phase — 鎖住 `EVENT_NOT_FOUND_MESSAGE` 常數與 `deleteEvent` 在
 * 找不到活動時 reject 的契約，供 UI 層作為 race condition discriminator。
 * 與 `POST_NOT_FOUND_MESSAGE` 對稱（commit 8427e15）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doc, getDoc } from 'firebase/firestore';
import { deleteEvent, EVENT_NOT_FOUND_MESSAGE } from '@/lib/firebase-events';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({
  db: 'mock-db',
}));

describe('EVENT_NOT_FOUND_MESSAGE constant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue(
      /** @type {import('firebase/firestore').DocumentReference} */ (
        /** @type {unknown} */ ('event-ref')
      ),
    );
  });

  it('exports the exact string literal used by deleteEvent for missing docs', () => {
    expect(EVENT_NOT_FOUND_MESSAGE).toBe('活動不存在');
  });

  it('deleteEvent rejects with an Error whose message equals EVENT_NOT_FOUND_MESSAGE', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      /** @type {import('firebase/firestore').DocumentSnapshot} */ (
        /** @type {unknown} */ ({
          exists: () => false,
        })
      ),
    );

    await expect(deleteEvent('missing-id')).rejects.toThrow(EVENT_NOT_FOUND_MESSAGE);
  });

  it('deleteEvent rejects with an Error instance (not a string or other value)', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      /** @type {import('firebase/firestore').DocumentSnapshot} */ (
        /** @type {unknown} */ ({
          exists: () => false,
        })
      ),
    );

    await expect(deleteEvent('missing-id')).rejects.toBeInstanceOf(Error);
  });
});
