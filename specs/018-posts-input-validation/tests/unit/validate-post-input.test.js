import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/client/firebase-client', () => ({
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

import {
  validatePostInput,
  POST_TITLE_MAX_LENGTH,
  POST_CONTENT_MAX_LENGTH,
} from '@/lib/firebase-posts';

describe('validatePostInput', () => {
  describe('empty checks (US1)', () => {
    it('returns merged message when both title and content are empty strings', () => {
      // Arrange
      const input = { title: '', content: '' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入標題和內容');
    });

    it('returns merged message when both title and content are whitespace-only', () => {
      // Arrange
      const input = { title: '   ', content: '\t\n ' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入標題和內容');
    });

    it('returns title error when title is empty and content is valid', () => {
      // Arrange
      const input = { title: '', content: '有效內容' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入標題');
    });

    it('returns title error when title is whitespace-only and content is valid', () => {
      // Arrange
      const input = { title: '   ', content: '有效內容' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入標題');
    });

    it('returns content error when title is valid and content is empty', () => {
      // Arrange
      const input = { title: '有效標題', content: '' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入內容');
    });

    it('returns content error when title is valid and content is whitespace-only', () => {
      // Arrange
      const input = { title: '有效標題', content: '   ' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入內容');
    });
  });

  describe('length checks (US2)', () => {
    it('passes when title is exactly at max length', () => {
      // Arrange
      const title = 'a'.repeat(POST_TITLE_MAX_LENGTH);
      const input = { title, content: '有效內容' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBeNull();
    });

    it('returns title error when title is one char over max length', () => {
      // Arrange
      const title = 'a'.repeat(POST_TITLE_MAX_LENGTH + 1);
      const input = { title, content: '有效內容' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('標題不可超過 50 字');
    });

    it('passes when content is exactly at max length', () => {
      // Arrange
      const content = 'a'.repeat(POST_CONTENT_MAX_LENGTH);
      const input = { title: '有效標題', content };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBeNull();
    });

    it('returns content error when content is one char over max length', () => {
      // Arrange
      const content = 'a'.repeat(POST_CONTENT_MAX_LENGTH + 1);
      const input = { title: '有效標題', content };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('內容不可超過 10,000 字');
    });

    it('returns title error first when both title and content exceed max length', () => {
      // Arrange
      const title = 'a'.repeat(POST_TITLE_MAX_LENGTH + 1);
      const content = 'a'.repeat(POST_CONTENT_MAX_LENGTH + 1);
      const input = { title, content };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('標題不可超過 50 字');
    });
  });

  describe('edge cases', () => {
    it('counts emoji by string.length (😀 is 2 chars)', () => {
      // Arrange — 49 'a' + '😀' (length 2) = 51 total
      const title = `${'a'.repeat(POST_TITLE_MAX_LENGTH - 1)}😀`;
      const input = { title, content: '有效內容' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(title.length).toBe(POST_TITLE_MAX_LENGTH + 1);
      expect(result).toBe('標題不可超過 50 字');
    });

    it('trims leading/trailing spaces before length check', () => {
      // Arrange — 50 'a' padded with spaces = 50 after trim
      const title = `  ${'a'.repeat(POST_TITLE_MAX_LENGTH)}  `;
      const input = { title, content: '有效內容' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBeNull();
    });

    it('treats null title and content as empty strings', () => {
      // Arrange
      const input = { title: null, content: null };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入標題和內容');
    });

    it('treats undefined title and content as empty strings', () => {
      // Arrange
      const input = { title: undefined, content: undefined };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBe('請輸入標題和內容');
    });
  });

  describe('happy path', () => {
    it('returns null when both title and content are valid', () => {
      // Arrange
      const input = { title: '正常標題', content: '正常內容' };

      // Act
      const result = validatePostInput(input);

      // Assert
      expect(result).toBeNull();
    });
  });
});
