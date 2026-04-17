import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-client', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn().mockReturnValue('mock-doc-ref'),
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

import { updateDoc } from 'firebase/firestore';
import { updatePost } from '@/lib/firebase-posts';

const mockedUpdateDoc = /** @type {import('vitest').Mock} */ (updateDoc);

describe('updatePost validation guard', () => {
  beforeEach(() => {
    mockedUpdateDoc.mockClear();
  });

  describe('validation rejects invalid input (RED — should FAIL before T010)', () => {
    it('throws when both title and content are empty', async () => {
      // Arrange
      const postId = 'post-1';
      const input = { title: '', content: '' };

      // Act & Assert
      await expect(updatePost(postId, input)).rejects.toThrow('updatePost: 請輸入標題和內容');
    });

    it('throws when title is empty', async () => {
      // Arrange
      const postId = 'post-1';
      const input = { title: '', content: '有效內容' };

      // Act & Assert
      await expect(updatePost(postId, input)).rejects.toThrow('updatePost: 請輸入標題');
    });

    it('throws when content is empty', async () => {
      // Arrange
      const postId = 'post-1';
      const input = { title: '有效標題', content: '' };

      // Act & Assert
      await expect(updatePost(postId, input)).rejects.toThrow('updatePost: 請輸入內容');
    });

    it('throws when title exceeds 50 chars', async () => {
      // Arrange
      const postId = 'post-1';
      const input = { title: 'a'.repeat(51), content: '有效內容' };

      // Act & Assert
      await expect(updatePost(postId, input)).rejects.toThrow('updatePost: 標題不可超過 50 字');
    });

    it('does not call updateDoc when validation fails', async () => {
      // Arrange
      const postId = 'post-1';
      const input = { title: '', content: '' };

      // Act — swallow the expected rejection
      try {
        await updatePost(postId, input);
      } catch {
        // expected
      }

      // Assert
      expect(mockedUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('happy path (should PASS even now)', () => {
    it('calls updateDoc with valid input', async () => {
      // Arrange
      const postId = 'post-1';
      const input = { title: '有效標題', content: '有效內容' };

      // Act
      await updatePost(postId, input);

      // Assert
      expect(mockedUpdateDoc).toHaveBeenCalledOnce();
      expect(mockedUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        title: '有效標題',
        content: '有效內容',
      });
    });
  });
});
