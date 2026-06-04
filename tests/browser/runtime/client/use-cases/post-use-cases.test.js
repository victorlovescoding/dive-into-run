import { beforeEach, describe, expect, test, vi } from 'vitest';

const SERVER_TIMESTAMP = { kind: 'serverTimestamp' };

const repoMocks = vi.hoisted(() => ({
  addPostDocument: vi.fn(),
  addCommentDocument: vi.fn(),
  createPostHistoryDocumentId: vi.fn(),
  deleteCommentDocument: vi.fn(),
  deletePostTree: vi.fn(),
  fetchCommentDocument: vi.fn(),
  fetchCommentHistoryDocuments: vi.fn(),
  fetchLatestCommentDocuments: vi.fn(),
  fetchLatestPostDocuments: vi.fn(),
  fetchLikedPost: vi.fn(),
  fetchLikedPostIds: vi.fn(),
  fetchNextCommentDocuments: vi.fn(),
  fetchNextPostDocuments: vi.fn(),
  fetchNextPostDocumentsBySearch: vi.fn(),
  fetchPostDocument: vi.fn(),
  fetchPostDocumentsBySearch: vi.fn(),
  fetchPostHistoryDocuments: vi.fn(),
  toggleLikePost: vi.fn(),
  updateCommentDocument: vi.fn(),
  updatePostDocument: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(() => SERVER_TIMESTAMP),
}));

vi.mock('@/repo/client/firebase-posts-repo', () => repoMocks);

describe('post-use-cases article edit history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates an article post through one history-coupled repo write', async () => {
    const { updatePost } = await import('@/runtime/client/use-cases/post-use-cases');
    repoMocks.createPostHistoryDocumentId.mockReturnValueOnce('history-1');
    repoMocks.fetchPostDocument.mockResolvedValueOnce({
      id: 'post-1',
      data: () => ({
        authorUid: 'author-1',
        title: 'Old title',
        content: 'Old content',
      }),
    });

    await updatePost('post-1', {
      title: '  New title  ',
      content: '  New content  ',
    });

    expect(repoMocks.fetchPostDocument).toHaveBeenCalledWith('post-1');
    expect(repoMocks.createPostHistoryDocumentId).toHaveBeenCalledWith('post-1');
    expect(repoMocks.updatePostDocument).toHaveBeenCalledWith(
      'post-1',
      'history-1',
      {
        title: 'Old title',
        content: 'Old content',
        editedAt: SERVER_TIMESTAMP,
      },
      {
        title: 'New title',
        content: 'New content',
        updatedAt: SERVER_TIMESTAMP,
        isEdited: true,
        lastEditHistoryId: 'history-1',
      },
    );
  });

  test('throws when updating a missing or soft-deleted article post', async () => {
    const { updatePost } = await import('@/runtime/client/use-cases/post-use-cases');
    repoMocks.createPostHistoryDocumentId.mockReturnValueOnce('history-1');
    repoMocks.fetchPostDocument.mockResolvedValueOnce(null);

    await expect(
      updatePost('missing-post', {
        title: 'New title',
        content: 'New content',
      }),
    ).rejects.toThrow('文章不存在');

    expect(repoMocks.updatePostDocument).not.toHaveBeenCalled();
  });

  test('fetches active article post history entries', async () => {
    const { fetchPostHistory } = await import('@/runtime/client/use-cases/post-use-cases');
    repoMocks.fetchPostDocument.mockResolvedValueOnce({
      id: 'post-1',
      data: () => ({
        title: 'Current title',
        content: 'Current content',
      }),
    });
    repoMocks.fetchPostHistoryDocuments.mockResolvedValueOnce([
      {
        id: 'history-1',
        data: () => ({
          title: 'Old title',
          content: 'Old content',
          editedAt: SERVER_TIMESTAMP,
        }),
      },
    ]);

    await expect(fetchPostHistory('post-1')).resolves.toEqual([
      {
        id: 'history-1',
        title: 'Old title',
        content: 'Old content',
        editedAt: SERVER_TIMESTAMP,
      },
    ]);
  });
});
