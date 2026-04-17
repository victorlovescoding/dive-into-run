import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-client', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn(),
  collectionGroup: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
}));

import { addDoc } from 'firebase/firestore';
import { createPost } from '@/lib/firebase-posts';

const mockedAddDoc = /** @type {import('vitest').Mock} */ (addDoc);

/** @type {{ uid: string, photoURL: string }} */
const mockUser = { uid: 'test-uid', photoURL: 'test.jpg' };

describe('createPost validation guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAddDoc.mockResolvedValue({ id: 'mock-id' });
  });

  // --- Validation (RED phase: should FAIL) ---

  it('throws when title and content are both empty', async () => {
    // Arrange
    const input = { title: '', content: '', user: mockUser };

    // Act & Assert
    await expect(createPost(input)).rejects.toThrow('createPost: 請輸入標題和內容');
  });

  it('throws when title is empty', async () => {
    // Arrange
    const input = { title: '', content: '有效內容', user: mockUser };

    // Act & Assert
    await expect(createPost(input)).rejects.toThrow('createPost: 請輸入標題');
  });

  it('throws when content is empty', async () => {
    // Arrange
    const input = { title: '有效標題', content: '', user: mockUser };

    // Act & Assert
    await expect(createPost(input)).rejects.toThrow('createPost: 請輸入內容');
  });

  it('throws when title exceeds 50 characters', async () => {
    // Arrange
    const input = { title: 'a'.repeat(51), content: '有效', user: mockUser };

    // Act & Assert
    await expect(createPost(input)).rejects.toThrow('createPost: 標題不可超過 50 字');
  });

  it('does NOT call addDoc when validation fails', async () => {
    // Arrange
    const input = { title: '', content: '', user: mockUser };

    // Act
    try {
      await createPost(input);
    } catch {
      // expected
    }

    // Assert
    expect(mockedAddDoc).not.toHaveBeenCalled();
  });

  // --- Happy path (should PASS even now) ---

  it('calls addDoc and returns id for valid input', async () => {
    // Arrange
    const input = { title: '有效標題', content: '有效內容', user: mockUser };

    // Act
    const result = await createPost(input);

    // Assert
    expect(result).toEqual({ id: 'mock-id' });
    expect(mockedAddDoc).toHaveBeenCalledTimes(1);
  });
});
