import { describe, expect, it, vi, beforeEach } from 'vitest';

const addPostDocument = vi.fn();
const updatePostDocument = vi.fn();
const fetchPostDocument = vi.fn();
const fetchLatestPostDocuments = vi.fn();
const fetchNextPostDocuments = vi.fn();
const fetchPostDocumentsBySearch = vi.fn();
const fetchNextPostDocumentsBySearch = vi.fn();
const fetchLatestCommentDocuments = vi.fn();
const fetchNextCommentDocuments = vi.fn();
const fetchCommentDocument = vi.fn();
const toggleLikePost = vi.fn();
const addCommentDocument = vi.fn();
const updateCommentDocument = vi.fn();
const deleteCommentDocument = vi.fn();
const fetchLikedPostIds = vi.fn();
const fetchLikedPost = vi.fn();
const deletePostTree = vi.fn();

vi.mock('@/repo/client/firebase-posts-repo', () => ({
  addPostDocument,
  updatePostDocument,
  fetchPostDocument,
  fetchLatestPostDocuments,
  fetchNextPostDocuments,
  fetchPostDocumentsBySearch,
  fetchNextPostDocumentsBySearch,
  fetchLatestCommentDocuments,
  fetchNextCommentDocuments,
  fetchCommentDocument,
  toggleLikePost,
  addCommentDocument,
  updateCommentDocument,
  deleteCommentDocument,
  fetchLikedPostIds,
  fetchLikedPost,
  deletePostTree,
}));

const runtime = await import('@/runtime/client/use-cases/post-use-cases');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('post-use-cases split', () => {
  it('createPost uses service validation and repo write', async () => {
    addPostDocument.mockResolvedValue({ id: 'post-1' });

    const result = await runtime.createPost({
      title: '  測試標題  ',
      content: '測試內容',
      user: { uid: 'u1', name: 'Amy', photoURL: 'https://img' },
    });

    expect(result).toEqual({ id: 'post-1' });
    expect(addPostDocument).toHaveBeenCalledTimes(1);
    expect(addPostDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '  測試標題  ',
        content: '測試內容',
        authorUid: 'u1',
        authorName: 'Amy',
        authorImgURL: 'https://img',
        likesCount: 0,
        commentsCount: 0,
      }),
    );
  });

  it('getPostDetail warns on missing document and normalizes snapshots', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchPostDocument.mockResolvedValue(null);

    await expect(runtime.getPostDetail('missing')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('No such document!');
    warnSpy.mockRestore();
  });

  it('addComment trims content and preserves repo-facing comment payload', async () => {
    addCommentDocument.mockResolvedValue({ id: 'c1' });

    const result = await runtime.addComment('post-1', {
      user: { uid: 'u1', name: 'Amy', photoURL: 'https://img' },
      comment: '  hello world  ',
    });

    expect(result).toEqual({ id: 'c1' });
    expect(addCommentDocument).toHaveBeenCalledWith(
      'post-1',
      expect.objectContaining({
        authorUid: 'u1',
        authorName: 'Amy',
        authorImgURL: 'https://img',
        comment: 'hello world',
      }),
    );
  });

  it('hasUserLikedPosts delegates to repo', async () => {
    fetchLikedPostIds.mockResolvedValue(new Set(['p1']));

    const result = await runtime.hasUserLikedPosts('u1', ['p1', 'p2']);

    expect(result.has('p1')).toBe(true);
    expect(fetchLikedPostIds).toHaveBeenCalledWith('u1', ['p1', 'p2']);
  });
});
