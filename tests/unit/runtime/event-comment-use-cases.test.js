import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchComments } from '@/runtime/client/use-cases/event-comment-use-cases';

const firestoreMocks = vi.hoisted(() => ({
  Timestamp: {
    now: vi.fn(() => ({ seconds: 123 })),
  },
  addDoc: vi.fn(),
  collection: vi.fn((...path) => ({ path })),
  doc: vi.fn((...path) => ({ path })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count) => ({ __type: 'limit', count })),
  orderBy: vi.fn((field, direction) => ({ __type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  startAfter: vi.fn((snapshot) => ({ __type: 'startAfter', snapshot })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ auth: { currentUser: null }, db: {} }));

/**
 * Builds a Firestore snapshot-like event comment.
 * @param {string} id - Comment ID.
 * @param {Record<string, unknown>} [overrides] - Data overrides.
 * @returns {{ id: string, data: () => Record<string, unknown> }} Snapshot-like comment.
 */
function commentSnapshot(id, overrides = {}) {
  return {
    id,
    data: () => ({
      authorUid: 'user-1',
      authorName: '跑者一號',
      authorPhotoURL: 'https://example.test/avatar.png',
      content: `留言 ${id}`,
      createdAt: { seconds: 100 },
      updatedAt: null,
      isEdited: false,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchComments visible pagination', () => {
  it('returns hasMore false without a cursor when the visible page exactly fills the collection', async () => {
    const first = commentSnapshot('event-comment-1');
    const second = commentSnapshot('event-comment-2');
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [first, second],
    });

    const result = await fetchComments('event-1', { limitCount: 2 });

    expect(firestoreMocks.limit).toHaveBeenLastCalledWith(3);
    expect(result.comments.map((comment) => comment.id)).toEqual([
      'event-comment-1',
      'event-comment-2',
    ]);
    expect(result.hasMore).toBe(false);
    expect(result.lastDoc).toBeNull();
  });

  it('returns hasMore true and keeps the cursor at the last returned visible comment when a visible sentinel exists', async () => {
    const first = commentSnapshot('event-comment-1');
    const second = commentSnapshot('event-comment-2');
    const sentinel = commentSnapshot('event-comment-3');
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [first, second, sentinel],
    });

    const result = await fetchComments('event-1', { limitCount: 2 });

    expect(result.comments.map((comment) => comment.id)).toEqual([
      'event-comment-1',
      'event-comment-2',
    ]);
    expect(result.hasMore).toBe(true);
    expect(result.lastDoc).toBe(second);
  });

  it('scans past hidden or deleted raw docs before deciding a full visible page has no more results', async () => {
    const first = commentSnapshot('event-comment-1');
    const hidden = commentSnapshot('event-comment-hidden', { accountDeletionHidden: true });
    const deleted = commentSnapshot('event-comment-deleted', {
      deletedAt: { seconds: 101 },
      deletedByUid: 'moderator-1',
    });
    const second = commentSnapshot('event-comment-2');
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [first, hidden, deleted],
      })
      .mockResolvedValueOnce({
        docs: [second],
      });

    const result = await fetchComments('event-1', { limitCount: 2 });

    expect(firestoreMocks.startAfter).toHaveBeenLastCalledWith(deleted);
    expect(firestoreMocks.limit).toHaveBeenLastCalledWith(3);
    expect(result.comments.map((comment) => comment.id)).toEqual([
      'event-comment-1',
      'event-comment-2',
    ]);
    expect(result.hasMore).toBe(false);
    expect(result.lastDoc).toBeNull();
  });
});
