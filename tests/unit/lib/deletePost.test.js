import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { deletePost } from '@/lib/firebase-posts';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({
  db: 'mock-db',
}));

describe('deletePost', () => {
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);

    vi.mocked(doc).mockReturnValue(/** @type {*} */ ('post-ref'));
    vi.mocked(getDoc).mockResolvedValue(
      /** @type {*} */ ({
        exists: () => true,
      }),
    );
    vi.mocked(writeBatch).mockReturnValue(
      /** @type {*} */ ({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      }),
    );
  });

  it('should cascade-delete likes, comments, and post doc via writeBatch', async () => {
    const likeRefs = [{ ref: 'like-ref-1' }, { ref: 'like-ref-2' }];
    const commentRefs = [{ ref: 'comment-ref-1' }];

    vi.mocked(collection)
      .mockReturnValueOnce(/** @type {*} */ ('likes-col'))
      .mockReturnValueOnce(/** @type {*} */ ('comments-col'));

    vi.mocked(getDocs)
      .mockResolvedValueOnce(/** @type {*} */ ({ docs: likeRefs }))
      .mockResolvedValueOnce(/** @type {*} */ ({ docs: commentRefs }));

    const result = await deletePost('post-123');

    expect(doc).toHaveBeenCalledWith('mock-db', 'posts', 'post-123');
    expect(getDoc).toHaveBeenCalledWith('post-ref');
    expect(collection).toHaveBeenCalledWith('mock-db', 'posts', 'post-123', 'likes');
    expect(collection).toHaveBeenCalledWith('mock-db', 'posts', 'post-123', 'comments');
    expect(getDocs).toHaveBeenCalledWith('likes-col');
    expect(getDocs).toHaveBeenCalledWith('comments-col');
    expect(writeBatch).toHaveBeenCalledWith('mock-db');
    expect(mockBatchDelete.mock.calls.map(([ref]) => ref)).toEqual([
      'like-ref-1',
      'like-ref-2',
      'comment-ref-1',
      'post-ref',
    ]);
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('should delete only post doc when no likes or comments exist', async () => {
    vi.mocked(collection)
      .mockReturnValueOnce(/** @type {*} */ ('likes-col'))
      .mockReturnValueOnce(/** @type {*} */ ('comments-col'));

    vi.mocked(getDocs)
      .mockResolvedValueOnce(/** @type {*} */ ({ docs: [] }))
      .mockResolvedValueOnce(/** @type {*} */ ({ docs: [] }));

    const result = await deletePost('post-456');

    expect(writeBatch).toHaveBeenCalledWith('mock-db');
    expect(mockBatchDelete.mock.calls.map(([ref]) => ref)).toEqual(['post-ref']);
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('should throw when postId is empty', async () => {
    await expect(deletePost('')).rejects.toThrow('deletePost: postId is required');
  });

  it('should throw when post does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      /** @type {*} */ ({
        exists: () => false,
      }),
    );

    await expect(deletePost('non-existent')).rejects.toThrow('文章不存在');
  });

  it('should propagate error when batch.commit() rejects', async () => {
    vi.mocked(collection)
      .mockReturnValueOnce(/** @type {*} */ ('likes-col'))
      .mockReturnValueOnce(/** @type {*} */ ('comments-col'));

    vi.mocked(getDocs)
      .mockResolvedValueOnce(/** @type {*} */ ({ docs: [] }))
      .mockResolvedValueOnce(/** @type {*} */ ({ docs: [] }));

    mockBatchCommit.mockRejectedValue(new Error('Firestore batch failed'));

    await expect(deletePost('post-789')).rejects.toThrow('Firestore batch failed');
  });
});
