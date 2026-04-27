import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDoc } from 'firebase/firestore';
import { updatePost } from '@/lib/firebase-posts';

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

const mockedUpdateDoc = /** @type {import('vitest').Mock} */ (updateDoc);

describe('updatePost trims whitespace (RED — should FAIL before T007)', () => {
  beforeEach(() => {
    mockedUpdateDoc.mockClear();
  });

  it('trims leading and trailing whitespace from title and content', async () => {
    // Arrange
    const postId = 'post-1';
    const input = { title: '  hello  ', content: '  world  ' };

    // Act
    await updatePost(postId, input);

    // Assert
    expect(mockedUpdateDoc).toHaveBeenCalledOnce();
    expect(mockedUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
      title: 'hello',
      content: 'world',
    });
  });

  it('preserves middle whitespace in title and content', async () => {
    // Arrange
    const postId = 'post-1';
    const input = { title: 'hello  world', content: 'a\n\nb' };

    // Act
    await updatePost(postId, input);

    // Assert
    expect(mockedUpdateDoc).toHaveBeenCalledOnce();
    expect(mockedUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
      title: 'hello  world',
      content: 'a\n\nb',
    });
  });

  it('trims edges while preserving middle whitespace', async () => {
    // Arrange
    const postId = 'post-1';
    const input = { title: '  hello  world  ', content: '  a\n\nb  ' };

    // Act
    await updatePost(postId, input);

    // Assert
    expect(mockedUpdateDoc).toHaveBeenCalledOnce();
    expect(mockedUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
      title: 'hello  world',
      content: 'a\n\nb',
    });
  });
});
