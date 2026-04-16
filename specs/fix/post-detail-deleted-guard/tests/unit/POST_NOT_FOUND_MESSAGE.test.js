import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doc, getDoc } from 'firebase/firestore';
import { deletePost, POST_NOT_FOUND_MESSAGE } from '@/lib/firebase-posts';

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

describe('POST_NOT_FOUND_MESSAGE constant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue(/** @type {*} */ ('post-ref'));
  });

  it('exports the exact string literal used by deletePost for missing docs', () => {
    expect(POST_NOT_FOUND_MESSAGE).toBe('文章不存在');
  });

  it('deletePost rejects with an Error whose message equals POST_NOT_FOUND_MESSAGE', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      /** @type {*} */ ({
        exists: () => false,
      }),
    );

    await expect(deletePost('missing-id')).rejects.toThrow(POST_NOT_FOUND_MESSAGE);
  });

  it('deletePost rejects with an Error instance (not a string or other value)', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      /** @type {*} */ ({
        exists: () => false,
      }),
    );

    await expect(deletePost('missing-id')).rejects.toBeInstanceOf(Error);
  });
});
